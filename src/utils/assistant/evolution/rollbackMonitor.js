/**
 * rollbackMonitor - 自动回滚监控
 *
 * 晋升后 7 天观察期内,任一 RACE 维度连续 3 个采样点跌破阈值 → 自动回滚到上一版。
 *
 * 设计:
 *   - 采样 = 每天 1 次(后台 timer 或主动触发)
 *   - 跌破 = 单维度低于该助手 profile 的阈值
 *   - 连续 3 次 = 用 ring buffer 跟踪
 *   - 回滚 = 调用 assistantVersionStore.restoreAssistantVersion(prevVersionId)
 *           + 写一条 signal(metadata.rolled_back=true)
 */

import { computeHealthScore } from './raceEvaluator.js'
import { getThresholds } from './gateProfiles.js'
import { loadGlobalSettings, saveGlobalSettings } from '../../globalSettings.js'

const MONITOR_KEY = 'chayuan/v2/rollbackMonitorState'
const OBSERVATION_DAYS = 7
const SAMPLES_REQUIRED_TO_ROLLBACK = 3
const MAX_HISTORY_SAMPLES = 14

function safeString(value, fallback = '') {
  const s = String(value ?? '').trim()
  return s || fallback
}

function safeNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function loadState() {
  const settings = loadGlobalSettings()
  const raw = settings?.[MONITOR_KEY]
  return raw && typeof raw === 'object' ? raw : {}
}

function saveState(state) {
  saveGlobalSettings({ [MONITOR_KEY]: state })
}

/**
 * 注册"晋升后观察期":开始监控某助手的某个版本。
 *
 *   options:
 *     assistantId
 *     versionId        (新晋升的版本)
 *     previousVersionId (上一版,出问题就回滚到它)
 *     observationDays   (默认 7)
 */
export function startObservation(options = {}) {
  const id = safeString(options.assistantId)
  const ver = safeString(options.versionId)
  const prev = safeString(options.previousVersionId)
  if (!id || !ver) return null

  const state = loadState()
  state[id] = {
    assistantId: id,
    versionId: ver,
    previousVersionId: prev,
    startedAt: Date.now(),
    expiresAt: Date.now() + safeNumber(options.observationDays, OBSERVATION_DAYS) * 86400000,
    samples: [],
    rolledBack: false,
    rollbackReason: ''
  }
  saveState(state)
  return state[id]
}

export function getObservation(assistantId) {
  const state = loadState()
  return state[safeString(assistantId)] || null
}

export function listObservations() {
  const state = loadState()
  const now = Date.now()
  return Object.values(state).filter(s => !s.expiresAt || s.expiresAt > now || !s.rolledBack)
}

export function endObservation(assistantId) {
  const id = safeString(assistantId)
  const state = loadState()
  if (state[id]) {
    delete state[id]
    saveState(state)
  }
}

/**
 * 采样一次:计算当前 RACE,加入观察期 ring buffer,判断是否需要回滚。
 *
 *   options:
 *     assistant: 当前助手对象(用于 profile 推断)
 *     callRollback: async (prevVersionId, reason) => void (回滚执行函数,由调用方注入)
 *
 *   返回:
 *     { sampled, rolledBack, reason, sample }
 */
export async function sampleAndDecide(options = {}) {
  const id = safeString(options.assistantId || options.assistant?.id)
  if (!id) return { sampled: false, reason: 'missing assistantId' }

  const obs = getObservation(id)
  if (!obs) return { sampled: false, reason: '不在观察期' }

  if (Date.now() > obs.expiresAt) {
    // 观察期结束,自动 end
    endObservation(id)
    return { sampled: false, reason: '观察期已结束' }
  }
  if (obs.rolledBack) {
    return { sampled: false, reason: '已回滚' }
  }

  const health = computeHealthScore(options.assistant || { id }, {
    version: obs.versionId,
    days: 1   // 单日采样
  })
  if (!health) return { sampled: false, reason: '健康分计算失败' }

  const { thresholds } = getThresholds(options.assistant || { id })
  const sample = {
    timestamp: Date.now(),
    R: health.R,
    A: health.A,
    C: health.C,
    E: health.E,
    total: health.total,
    breachedDimensions: []
  }
  if (health.R < thresholds.R) sample.breachedDimensions.push('R')
  if (health.A < thresholds.A) sample.breachedDimensions.push('A')
  if (health.C < thresholds.C) sample.breachedDimensions.push('C')
  if (health.E < thresholds.E) sample.breachedDimensions.push('E')

  // 写入 ring buffer
  const state = loadState()
  const o = state[id]
  if (!o) return { sampled: false, reason: '观察记录丢失' }
  o.samples = [...(o.samples || []), sample].slice(-MAX_HISTORY_SAMPLES)
  saveState(state)

  // 判断是否连续 3 次跌破同一维度
  const breach = consecutiveBreach(o.samples, SAMPLES_REQUIRED_TO_ROLLBACK)
  if (!breach) {
    return { sampled: true, rolledBack: false, sample }
  }

  if (typeof options.callRollback !== 'function') {
    return { sampled: true, rolledBack: false, reason: '满足回滚条件但未注入 callRollback', sample, breach }
  }

  // 触发回滚
  const reason = `连续 ${SAMPLES_REQUIRED_TO_ROLLBACK} 个采样点维度 ${breach} 跌破阈值`
  try {
    if (o.previousVersionId) {
      await options.callRollback(o.previousVersionId, reason)
    }
    o.rolledBack = true
    o.rollbackReason = reason
    saveState(state)
    return { sampled: true, rolledBack: true, reason, sample, breach }
  } catch (e) {
    return { sampled: true, rolledBack: false, reason: `回滚执行失败: ${e?.message || e}`, sample, breach }
  }
}

/**
 * 检查最后 N 个样本是否都跌破同一维度。
 * 返回该维度名,或 null(没有连续跌破)。
 */
function consecutiveBreach(samples, requiredN) {
  if (!Array.isArray(samples) || samples.length < requiredN) return null
  const recent = samples.slice(-requiredN)
  const dims = ['R', 'A', 'C', 'E', 'total']
  for (const d of dims) {
    if (recent.every(s => Array.isArray(s.breachedDimensions) && s.breachedDimensions.includes(d))) {
      return d
    }
  }
  return null
}

/**
 * 用户主动回滚(7 天观察期内一键 ↶):
 * 走相同入口,但 reason='user-initiated',不需要满足连续跌破条件。
 */
export async function userRollback(assistantId, callRollback) {
  const id = safeString(assistantId)
  const obs = getObservation(id)
  if (!obs?.previousVersionId) return { ok: false, reason: '无可回滚的上一版' }
  if (typeof callRollback !== 'function') return { ok: false, reason: '未注入 callRollback' }

  try {
    await callRollback(obs.previousVersionId, 'user-initiated')
    const state = loadState()
    if (state[id]) {
      state[id].rolledBack = true
      state[id].rollbackReason = 'user-initiated'
      saveState(state)
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e?.message || String(e) }
  }
}

export default {
  startObservation,
  getObservation,
  listObservations,
  endObservation,
  sampleAndDecide,
  userRollback,
  OBSERVATION_DAYS,
  SAMPLES_REQUIRED_TO_ROLLBACK
}
