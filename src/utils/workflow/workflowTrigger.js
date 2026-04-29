/**
 * workflowTrigger — 工作流触发器(W7.5)
 *
 * 支持:
 *   1. cron 触发器(每天 / 每小时 / 自定义表达式)
 *   2. 文档事件触发(DocumentOpen / DocumentBeforeSave 等 WPS API event)
 *   3. 手动触发(用户 ⌘K / 按钮)
 *
 * 持久化:loadGlobalSettings(workflowTriggers)
 *
 * cron 表达式简化版:
 *   '*\/5 * * * *'  — 每 5 分钟
 *   '0 3 * * *'    — 每天 03:00
 *   '0 0 * * 1'    — 每周一 00:00
 */

import { loadGlobalSettings, saveGlobalSettings } from '../globalSettings.js'

const KEY = 'workflowTriggers'
const TICK_INTERVAL = 60_000  // 每分钟检查一次

const _activeTimers = new Map()  // triggerId → intervalId
const _docEventListeners = new Map()  // triggerId → cleanup
let _tickTimer = null

/* ────────── 持久化 ────────── */

export function listTriggers() {
  const s = loadGlobalSettings()
  return Array.isArray(s[KEY]) ? s[KEY] : []
}

export function getTrigger(id) {
  return listTriggers().find(t => t.id === id) || null
}

export function saveTrigger(trigger) {
  if (!trigger?.id || !trigger?.workflowId) return false
  const list = listTriggers()
  const idx = list.findIndex(t => t.id === trigger.id)
  const record = {
    ...trigger,
    enabled: trigger.enabled !== false,
    updatedAt: Date.now()
  }
  if (idx >= 0) list[idx] = record
  else list.push({ ...record, createdAt: Date.now() })
  saveGlobalSettings({ [KEY]: list })
  return true
}

export function deleteTrigger(id) {
  const list = listTriggers().filter(t => t.id !== id)
  saveGlobalSettings({ [KEY]: list })
  // 清掉运行中的
  if (_activeTimers.has(id)) {
    clearInterval(_activeTimers.get(id))
    _activeTimers.delete(id)
  }
  if (_docEventListeners.has(id)) {
    try { _docEventListeners.get(id)() } catch (_) {}
    _docEventListeners.delete(id)
  }
  return true
}

/* ────────── cron 解析 ────────── */

/**
 * 简化 cron:5 字段(分 时 日 月 周)。
 * 仅支持 *、数字、,/-/*\/N。
 */
export function shouldFireNow(cronExpr, now = new Date()) {
  if (!cronExpr) return false
  const parts = String(cronExpr).split(/\s+/)
  if (parts.length !== 5) return false
  const [m, h, d, mo, w] = parts
  return matchPart(m, now.getMinutes(), 0, 59)
    && matchPart(h, now.getHours(), 0, 23)
    && matchPart(d, now.getDate(), 1, 31)
    && matchPart(mo, now.getMonth() + 1, 1, 12)
    && matchPart(w, now.getDay(), 0, 6)
}

function matchPart(expr, value, min, max) {
  const e = String(expr || '*').trim()
  if (e === '*') return true
  // step:*/5
  const stepMatch = e.match(/^\*\/(\d+)$/)
  if (stepMatch) return value % Number(stepMatch[1]) === 0
  // range:1-5
  const rangeMatch = e.match(/^(\d+)-(\d+)$/)
  if (rangeMatch) {
    const a = Number(rangeMatch[1]), b = Number(rangeMatch[2])
    return value >= a && value <= b
  }
  // list:1,3,5
  if (e.includes(',')) {
    return e.split(',').some(p => matchPart(p, value, min, max))
  }
  // single
  return Number(e) === value
}

/* ────────── 启动 / 停止 ────────── */

let _onTrigger = null   // 用户的 trigger 回调(参数 trigger 对象)

export function installTriggerEngine(options = {}) {
  if (typeof options.onTrigger !== 'function') {
    throw new Error('installTriggerEngine: onTrigger 必填,签名 (trigger, runtimeContext) → Promise')
  }
  _onTrigger = options.onTrigger

  // cron tick
  if (!_tickTimer) {
    _tickTimer = setInterval(() => { tickAll().catch(() => {}) }, TICK_INTERVAL)
  }

  // 文档事件
  rewireDocEventListeners()

  return function uninstall() {
    if (_tickTimer) { clearInterval(_tickTimer); _tickTimer = null }
    for (const [id, cleanup] of _docEventListeners) {
      try { cleanup() } catch (_) {}
    }
    _docEventListeners.clear()
    _onTrigger = null
  }
}

async function tickAll() {
  if (!_onTrigger) return
  const triggers = listTriggers().filter(t => t.enabled && t.kind === 'cron')
  for (const t of triggers) {
    if (shouldFireNow(t.cronExpr)) {
      try { await _onTrigger(t, { reason: 'cron-tick' }) } catch (_) {}
    }
  }
}

function rewireDocEventListeners() {
  // 清旧
  for (const [id, cleanup] of _docEventListeners) {
    try { cleanup() } catch (_) {}
  }
  _docEventListeners.clear()

  if (typeof window === 'undefined' || !window.Application?.ApiEvent) return

  const triggers = listTriggers().filter(t => t.enabled && t.kind === 'doc-event')
  for (const t of triggers) {
    const eventName = String(t.eventName || '').trim()
    if (!eventName) continue
    const handlerName = `__chayuanTrigger_${t.id}`
    window[handlerName] = function() {
      if (_onTrigger) {
        try { _onTrigger(t, { reason: 'doc-event', eventName }) } catch (_) {}
      }
    }
    try {
      window.Application.ApiEvent.AddApiEventListener(eventName, handlerName)
      _docEventListeners.set(t.id, () => {
        try { window.Application.ApiEvent.RemoveApiEventListener(eventName, handlerName) } catch (_) {}
        delete window[handlerName]
      })
    } catch (_) { /* WPS API 失败静默 */ }
  }
}

/**
 * 用户改了 triggers 后调,重新挂载 doc 事件。
 */
export function refreshTriggers() {
  rewireDocEventListeners()
}

/* ────────── 手动触发 ────────── */

export async function fireTrigger(triggerId, runtimeContext = {}) {
  const t = getTrigger(triggerId)
  if (!t) return { ok: false, error: 'trigger not found' }
  if (!t.enabled) return { ok: false, error: 'trigger disabled' }
  if (!_onTrigger) return { ok: false, error: 'engine not installed' }
  try {
    await _onTrigger(t, { reason: 'manual', ...runtimeContext })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

export const SUPPORTED_DOC_EVENTS = Object.freeze([
  'DocumentOpen',
  'DocumentBeforeSave',
  'DocumentBeforeClose',
  'WindowActivate',
  'NewDocument'
])

export default {
  listTriggers,
  getTrigger,
  saveTrigger,
  deleteTrigger,
  shouldFireNow,
  installTriggerEngine,
  refreshTriggers,
  fireTrigger,
  SUPPORTED_DOC_EVENTS
}
