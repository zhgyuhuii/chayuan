/**
 * shadowRunner - 影子双跑
 *
 * 候选版本不直接接管,而是每次用户真实调用助手时,在后台并行调用候选版本,
 * 记录两边输出但**只把基线结果展示给用户**。
 *
 * 优点:
 *   - 100% 真实流量数据,不需要打扰用户
 *   - 出问题不影响生产
 *   - 与 A/B 灰度互补:影子先跑,稳定后再灰度
 *
 * 限流策略(政企必须):
 *   - 用户级月度配额(默认 100)
 *   - 全局限频(每分钟 1 次)
 *   - 关键任务禁用(全文扫描类)
 *   - 用户开关(默认关闭)
 *   - 仅本地模型免配额
 */

import { loadGlobalSettings, saveGlobalSettings } from '../../globalSettings.js'
import { appendSignal } from './signalStore.js'

const SHADOW_CONFIG_KEY = 'chayuan/v2/shadowRunnerConfig'
const SHADOW_CANDIDATES_KEY = 'chayuan/v2/shadowCandidates'
const SHADOW_USAGE_KEY = 'chayuan/v2/shadowUsage'
const SHADOW_COMPARISONS_KEY = 'chayuan/v2/shadowComparisons'

const DEFAULT_CONFIG = Object.freeze({
  enabled: false,                  // 默认关闭
  maxPerMonth: 100,                // 月度配额
  rateLimitPerMinute: 1,           // 限频
  disabledForKeyKinds: ['document'], // 关键任务禁用(全文扫描类)
  localModelExempt: true           // 本地模型不计配额
})

function safeNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function safeString(value, fallback = '') {
  const s = String(value ?? '').trim()
  return s || fallback
}

function loadJson(key, fallback) {
  const settings = loadGlobalSettings()
  const raw = settings?.[key]
  return raw && typeof raw === 'object' ? raw : (typeof fallback === 'function' ? fallback() : fallback)
}

function saveJson(key, value) {
  saveGlobalSettings({ [key]: value })
}

/* ---------------- 配置 ---------------- */

export function getShadowConfig() {
  const stored = loadJson(SHADOW_CONFIG_KEY, () => ({}))
  return { ...DEFAULT_CONFIG, ...stored }
}

export function setShadowConfig(partial = {}) {
  const next = { ...getShadowConfig(), ...partial }
  saveJson(SHADOW_CONFIG_KEY, next)
  return next
}

/* ---------------- 候选注册 ---------------- */

/**
 * 设置某助手的影子候选版本(versionId 来自 assistantVersionStore)。
 * 每个助手只能有 1 个活跃候选,设置新的会替换旧的。
 */
export function setShadowCandidate(assistantId, versionId, options = {}) {
  const id = safeString(assistantId)
  const ver = safeString(versionId)
  if (!id || !ver) return false
  const store = loadJson(SHADOW_CANDIDATES_KEY, () => ({}))
  store[id] = {
    assistantId: id,
    versionId: ver,
    setAt: Date.now(),
    expiresAt: Date.now() + safeNumber(options.shadowDays, 7) * 86400000,
    note: safeString(options.note)
  }
  saveJson(SHADOW_CANDIDATES_KEY, store)
  return true
}

export function getShadowCandidate(assistantId) {
  const id = safeString(assistantId)
  if (!id) return null
  const store = loadJson(SHADOW_CANDIDATES_KEY, () => ({}))
  const record = store[id]
  if (!record) return null
  if (record.expiresAt && record.expiresAt < Date.now()) {
    delete store[id]
    saveJson(SHADOW_CANDIDATES_KEY, store)
    return null
  }
  return record
}

export function clearShadowCandidate(assistantId) {
  const id = safeString(assistantId)
  if (!id) return false
  const store = loadJson(SHADOW_CANDIDATES_KEY, () => ({}))
  if (!store[id]) return false
  delete store[id]
  saveJson(SHADOW_CANDIDATES_KEY, store)
  return true
}

export function listShadowCandidates() {
  const store = loadJson(SHADOW_CANDIDATES_KEY, () => ({}))
  const now = Date.now()
  return Object.values(store).filter(r => !r.expiresAt || r.expiresAt > now)
}

/* ---------------- 配额与限频 ---------------- */

function getUsage() {
  return loadJson(SHADOW_USAGE_KEY, () => ({ monthKey: '', count: 0, lastRunAt: 0 }))
}
function saveUsage(u) { saveJson(SHADOW_USAGE_KEY, u) }

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getQuotaStatus() {
  const cfg = getShadowConfig()
  const usage = getUsage()
  const monthKey = currentMonthKey()
  if (usage.monthKey !== monthKey) {
    return { used: 0, max: cfg.maxPerMonth, remaining: cfg.maxPerMonth, monthKey }
  }
  return {
    used: usage.count,
    max: cfg.maxPerMonth,
    remaining: Math.max(0, cfg.maxPerMonth - usage.count),
    monthKey
  }
}

function checkRateLimit(cfg) {
  const usage = getUsage()
  const interval = 60000 / Math.max(1, cfg.rateLimitPerMinute)
  return Date.now() - safeNumber(usage.lastRunAt, 0) >= interval
}

function consumeQuota(isLocal) {
  const usage = getUsage()
  const monthKey = currentMonthKey()
  if (usage.monthKey !== monthKey) {
    saveUsage({ monthKey, count: isLocal ? 0 : 1, lastRunAt: Date.now() })
  } else {
    saveUsage({
      monthKey,
      count: isLocal ? usage.count : usage.count + 1,
      lastRunAt: Date.now()
    })
  }
}

/* ---------------- 主入口:run with shadow ---------------- */

/**
 * 包一层 baseline runner,根据策略决定是否跑影子。
 *
 *   options:
 *     assistantId
 *     baselineRun: () => Promise<baselineResult>   (必填,真正给用户看的运行)
 *     shadowRun:   (candidateRecord) => Promise<candidateResult>   (必填)
 *     inputForCompare: 用于评估对比的 input(可省略)
 *     isLocalModel: 用本地模型时为 true(不计配额)
 *     kind:        任务种类(document / selection / paragraph...)
 *
 *   返回 baselineResult。影子跑 fully async,不阻塞 UI。
 */
export async function runWithShadow(options = {}) {
  const baselineFn = options.baselineRun
  if (typeof baselineFn !== 'function') {
    throw new Error('runWithShadow: baselineRun is required')
  }
  const baselineResult = await baselineFn()

  // 异步触发影子,不阻塞返回
  queueMicrotask(() => {
    triggerShadowAsync(options, baselineResult).catch(() => {})
  })

  return baselineResult
}

async function triggerShadowAsync(options, baselineResult) {
  const cfg = getShadowConfig()
  if (!cfg.enabled) return

  const assistantId = safeString(options.assistantId)
  if (!assistantId) return

  const candidate = getShadowCandidate(assistantId)
  if (!candidate) return

  if (cfg.disabledForKeyKinds?.includes(safeString(options.kind))) return

  const isLocal = options.isLocalModel === true && cfg.localModelExempt === true

  if (!isLocal) {
    const quota = getQuotaStatus()
    if (quota.remaining <= 0) return
    if (!checkRateLimit(cfg)) return
  }

  const shadowFn = options.shadowRun
  if (typeof shadowFn !== 'function') return

  const startedAt = Date.now()
  let candidateResult, error
  try {
    candidateResult = await shadowFn(candidate)
  } catch (e) {
    error = e
  }
  const duration = Date.now() - startedAt
  consumeQuota(isLocal)

  recordComparison({
    assistantId,
    candidateVersionId: candidate.versionId,
    baselineSuccess: !!baselineResult && !baselineResult.error,
    candidateSuccess: !error,
    duration,
    error: error?.message || '',
    timestamp: Date.now(),
    inputPreview: safeString(options.inputForCompare).slice(0, 240)
  })

  // 写一条进化信号(给 RACE 评估器观察候选)
  appendSignal({
    type: 'task',
    assistantId,
    version: candidate.versionId,
    duration,
    success: !error,
    failureCode: error?.code || (error ? 'shadow_error' : ''),
    metadata: {
      shadow: true,
      compareToBaseline: !!baselineResult
    }
  })
}

/* ---------------- 比较结果存储 ---------------- */

const MAX_COMPARISONS = 500

function recordComparison(record) {
  const list = loadJson(SHADOW_COMPARISONS_KEY, () => [])
  const next = Array.isArray(list) ? list : []
  next.unshift(record)
  saveJson(SHADOW_COMPARISONS_KEY, next.slice(0, MAX_COMPARISONS))
}

export function getShadowComparisons(options = {}) {
  const id = safeString(options.assistantId)
  const days = safeNumber(options.days, 7)
  const cutoff = Date.now() - days * 86400000
  const list = loadJson(SHADOW_COMPARISONS_KEY, () => [])
  if (!Array.isArray(list)) return []
  return list.filter(r =>
    (!id || r.assistantId === id) &&
    r.timestamp >= cutoff
  )
}

export function getShadowStats(assistantId) {
  const list = getShadowComparisons({ assistantId, days: 30 })
  if (list.length === 0) return null
  const success = list.filter(r => r.candidateSuccess).length
  const both = list.filter(r => r.baselineSuccess && r.candidateSuccess).length
  return {
    runs: list.length,
    candidateSuccessRate: success / list.length,
    bothSuccessRate: both / list.length,
    avgDurationMs: Math.round(list.reduce((s, r) => s + (r.duration || 0), 0) / list.length)
  }
}

export default {
  getShadowConfig,
  setShadowConfig,
  setShadowCandidate,
  getShadowCandidate,
  clearShadowCandidate,
  listShadowCandidates,
  getQuotaStatus,
  runWithShadow,
  getShadowComparisons,
  getShadowStats
}
