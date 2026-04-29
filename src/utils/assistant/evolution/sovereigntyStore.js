/**
 * sovereigntyStore — 用户主权状态机
 *
 * v2 计划 P3 项「用户主权(暂停 30 天 / 永不建议 / 重置 anchor / 冻结 v1.x)」。
 * 4 种独立状态,各助手独立配置,持久到 localStorage。
 *
 * 状态:
 *   - paused          暂停建议,有截止时间(默认 30 天)。到期自动恢复
 *   - never_suggest   永不主动建议(用户可手动触发)
 *   - frozen_at_version  冻结在某个版本,不接受任何候选(包括用户手动)
 *   - anchor_reset_pending  下次 evaluate 时刷新 anchor 锚点(基于当前活跃版重新注册)
 *
 * 任意状态都允许"清除",回归默认(完全自动)。
 * 进化系统在 evaluateNeed / promote 之前应该先 check 这里。
 */

import { loadGlobalSettings, saveGlobalSettings } from '../../globalSettings.js'

const KEY = 'evolutionSovereignty'

function load() {
  const s = loadGlobalSettings()
  return s[KEY] && typeof s[KEY] === 'object' ? s[KEY] : {}
}

function save(map) {
  return saveGlobalSettings({ [KEY]: map })
}

function ensure(map, assistantId) {
  if (!map[assistantId]) map[assistantId] = {}
  return map[assistantId]
}

/* ────────── 状态读 ────────── */

/**
 * 取某助手的有效主权状态(惰性清理过期)。
 * 返回:{ paused, pauseUntil, neverSuggest, frozenAt, anchorResetPending }
 */
export function getSovereignty(assistantId) {
  const id = String(assistantId || '').trim()
  if (!id) return blank()
  const map = load()
  const e = map[id]
  if (!e) return blank()
  const now = Date.now()
  let dirty = false
  // 自动 expire pause
  if (e.paused && e.pauseUntil && now > e.pauseUntil) {
    e.paused = false
    e.pauseUntil = 0
    dirty = true
  }
  if (dirty) save(map)
  return {
    paused: !!e.paused,
    pauseUntil: e.pauseUntil || 0,
    neverSuggest: !!e.neverSuggest,
    frozenAt: String(e.frozenAt || ''),
    anchorResetPending: !!e.anchorResetPending
  }
}

function blank() {
  return { paused: false, pauseUntil: 0, neverSuggest: false, frozenAt: '', anchorResetPending: false }
}

/**
 * 是否允许"主动建议"(自动评估 + 灰度 + 晋升)。
 *   - paused / neverSuggest / frozenAt 任一 → false
 */
export function isAutomationAllowed(assistantId) {
  const s = getSovereignty(assistantId)
  if (s.paused) return false
  if (s.neverSuggest) return false
  if (s.frozenAt) return false
  return true
}

/* ────────── 状态写 ────────── */

/**
 * 暂停 N 天(默认 30)。
 */
export function pauseSuggestion(assistantId, days = 30) {
  const id = String(assistantId || '').trim()
  if (!id) return null
  const ms = Math.max(1, Number(days) || 30) * 86400000
  const map = load()
  const e = ensure(map, id)
  e.paused = true
  e.pauseUntil = Date.now() + ms
  save(map)
  return { paused: true, pauseUntil: e.pauseUntil }
}

export function resumeSuggestion(assistantId) {
  const id = String(assistantId || '').trim()
  const map = load()
  if (!map[id]) return false
  map[id].paused = false
  map[id].pauseUntil = 0
  save(map)
  return true
}

export function setNeverSuggest(assistantId, on = true) {
  const id = String(assistantId || '').trim()
  if (!id) return false
  const map = load()
  const e = ensure(map, id)
  e.neverSuggest = !!on
  save(map)
  return e.neverSuggest
}

/**
 * 冻结在某个版本。可以传空字符串解冻。
 */
export function freezeAtVersion(assistantId, versionId = '') {
  const id = String(assistantId || '').trim()
  if (!id) return ''
  const map = load()
  const e = ensure(map, id)
  e.frozenAt = String(versionId || '')
  save(map)
  return e.frozenAt
}

/**
 * 标记 anchor 待重置 — 下一次 evaluate 时,系统应基于当前活跃版重新注册 anchor。
 */
export function markAnchorResetPending(assistantId, on = true) {
  const id = String(assistantId || '').trim()
  if (!id) return false
  const map = load()
  const e = ensure(map, id)
  e.anchorResetPending = !!on
  save(map)
  return e.anchorResetPending
}

export function consumeAnchorResetPending(assistantId) {
  const id = String(assistantId || '').trim()
  const map = load()
  if (!map[id]?.anchorResetPending) return false
  map[id].anchorResetPending = false
  save(map)
  return true
}

/** 清除所有状态(回归默认完全自动)。 */
export function clearSovereignty(assistantId) {
  const id = String(assistantId || '').trim()
  const map = load()
  if (map[id]) {
    delete map[id]
    save(map)
    return true
  }
  return false
}

/* ────────── 列表 / 调试 ────────── */

export function listAllSovereignty() {
  const map = load()
  return Object.entries(map).map(([id, v]) => ({ assistantId: id, ...v }))
}

export default {
  getSovereignty,
  isAutomationAllowed,
  pauseSuggestion,
  resumeSuggestion,
  setNeverSuggest,
  freezeAtVersion,
  markAnchorResetPending,
  consumeAnchorResetPending,
  clearSovereignty,
  listAllSovereignty
}
