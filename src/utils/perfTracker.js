/**
 * perfTracker — LLM 调用延迟环形缓冲 + 统计
 *
 * 给 enhancedChatApi、assistantTaskRunner、chatApi 等任何 LLM 入口用的
 * 一个轻量观测工具:
 *
 *   record({ kind, providerId, modelId, durationMs, ok, bytes? })
 *   getStats()    → { p50, p95, p99, avg, count, byKind, byModel, recent }
 *   subscribe(fn) → 数据更新时回调(ms 级 throttled,UI 用)
 *   clear()       → 清空
 *
 * 设计:
 *   - 环形缓冲(默认 500 条),内存 < 50KB
 *   - 不写 localStorage,session 内观测,不污染存储
 *   - subscribe 通知是 200ms throttled,避免高频回调把 UI 卡住
 *
 * 使用约定:
 *   - kind:string,例如 'stream'/'once'/'router'/'judge'/'chunked.item'
 *   - durationMs:必填,number
 *   - ok:boolean,失败也要记(失败的延迟也是数据)
 */

const MAX_RECORDS = 500
const NOTIFY_THROTTLE_MS = 200

const _records = []
const _listeners = new Set()
let _notifyTimer = null
let _lastNotifyAt = 0

/* ────────── 内部 ────────── */

function safeNumber(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function safeString(v) {
  return String(v == null ? '' : v).trim()
}

function notify() {
  const now = Date.now()
  const sinceLast = now - _lastNotifyAt
  if (sinceLast >= NOTIFY_THROTTLE_MS) {
    _lastNotifyAt = now
    if (_notifyTimer) { clearTimeout(_notifyTimer); _notifyTimer = null }
    for (const fn of _listeners) {
      try { fn(getStats()) } catch (_) {}
    }
    return
  }
  if (_notifyTimer) return
  _notifyTimer = setTimeout(() => {
    _notifyTimer = null
    _lastNotifyAt = Date.now()
    for (const fn of _listeners) {
      try { fn(getStats()) } catch (_) {}
    }
  }, NOTIFY_THROTTLE_MS - sinceLast)
}

function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0
  const idx = Math.min(sortedArr.length - 1, Math.floor(sortedArr.length * p))
  return sortedArr[idx]
}

/* ────────── 写入 ────────── */

export function record(entry = {}) {
  const e = {
    ts:         Date.now(),
    kind:       safeString(entry.kind) || 'unknown',
    providerId: safeString(entry.providerId),
    modelId:    safeString(entry.modelId),
    durationMs: safeNumber(entry.durationMs, 0),
    ok:         entry.ok !== false,
    bytes:      safeNumber(entry.bytes, 0),
    note:       safeString(entry.note)
  }
  _records.push(e)
  if (_records.length > MAX_RECORDS) _records.splice(0, _records.length - MAX_RECORDS)
  notify()
  return e
}

/**
 * 计时器糖:
 *   const stop = startTimer({ kind, providerId, modelId })
 *   try { ... } finally { stop({ ok: true, bytes }) }
 */
export function startTimer(meta = {}) {
  const t0 = Date.now()
  return function stop(extra = {}) {
    return record({
      ...meta,
      ...extra,
      durationMs: Date.now() - t0
    })
  }
}

/**
 * 包装一个 async 函数:自动记录开始/结束 + 失败也算耗时。
 *   const wrapped = wrapAsync('once', async () => doStuff(), { providerId, modelId })
 *   const result = await wrapped()
 */
export function wrapAsync(kind, fn, meta = {}) {
  return async (...args) => {
    const stop = startTimer({ kind, ...meta })
    try {
      const out = await fn(...args)
      stop({ ok: true })
      return out
    } catch (e) {
      stop({ ok: false, note: String(e?.message || e).slice(0, 80) })
      throw e
    }
  }
}

/* ────────── 读取 ────────── */

/** 当前所有记录的统计(全量计算,500 条规模下毫秒级)。 */
export function getStats() {
  const total = _records.length
  if (total === 0) {
    return {
      count: 0, ok: 0, fail: 0,
      avg: 0, p50: 0, p95: 0, p99: 0,
      byKind: {}, byModel: {},
      recent: []
    }
  }

  const durations = _records.map(r => r.durationMs).sort((a, b) => a - b)
  const sum = durations.reduce((a, b) => a + b, 0)
  const okCount = _records.filter(r => r.ok).length

  const byKind = {}
  const byModel = {}
  for (const r of _records) {
    if (!byKind[r.kind]) byKind[r.kind] = { count: 0, sum: 0, fail: 0 }
    byKind[r.kind].count += 1
    byKind[r.kind].sum += r.durationMs
    if (!r.ok) byKind[r.kind].fail += 1

    const mk = `${r.providerId}/${r.modelId}` || 'unknown'
    if (!byModel[mk]) byModel[mk] = { count: 0, sum: 0, fail: 0 }
    byModel[mk].count += 1
    byModel[mk].sum += r.durationMs
    if (!r.ok) byModel[mk].fail += 1
  }

  // 转 byKind / byModel 为带 avg 的形式
  for (const obj of [byKind, byModel]) {
    for (const k of Object.keys(obj)) {
      const e = obj[k]
      e.avg = Math.round(e.sum / Math.max(1, e.count))
    }
  }

  return {
    count: total,
    ok:   okCount,
    fail: total - okCount,
    avg:  Math.round(sum / total),
    p50:  percentile(durations, 0.50),
    p95:  percentile(durations, 0.95),
    p99:  percentile(durations, 0.99),
    byKind,
    byModel,
    // 最近 20 条(从新到旧)
    recent: _records.slice(-20).reverse()
  }
}

export function listAll() {
  return _records.slice()
}

export function clear() {
  _records.length = 0
  notify()
}

/* ────────── 订阅(给 Vue 组件用) ────────── */

export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {}
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

export default {
  record,
  startTimer,
  wrapAsync,
  getStats,
  listAll,
  clear,
  subscribe
}
