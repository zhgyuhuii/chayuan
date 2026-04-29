/**
 * signalStore - 助手进化的 5 类信号采集底座
 *
 * 设计原则:
 *   - 不存原文,只存 hash + length(隐私优先)
 *   - 30 天滚动窗口,每助手最多 1000 条
 *   - 写入异步,绝不阻塞主线程
 *   - 失败容忍,不 throw
 *
 * 5 类信号:
 *   1. thumbs    用户 👍/👎
 *   2. accept    用户写回后未撤销
 *   3. reject    写回后 30 秒内被 Undo
 *   4. task      任务完成/失败/降级/超时
 *   5. audit     能力审计(策略命中)
 *   6. golden    黄金样本(手工/导入)— 注:这一类直接走
 *                assistantRegressionSampleStore,不进 signalStore
 *
 * 数据可被 P3 阶段的 RACE 评估器、失败聚类器消费。
 */

import { loadGlobalSettings, saveGlobalSettings } from '../../globalSettings.js'

const STORAGE_KEY = 'chayuan/v2/assistantSignalStore'
const MAX_DAYS = 30
const MAX_PER_ASSISTANT = 1000
const MAX_TOTAL = 8000

const VALID_TYPES = new Set(['thumbs', 'accept', 'reject', 'task', 'audit', 'feedback'])

// 异步写入队列,合并多次 append 为单次落盘
let pendingQueue = []
let flushScheduled = false

function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function safeString(value, fallback = '') {
  const s = String(value ?? '').trim()
  return s || fallback
}

/**
 * 简易非加密 hash(djb2),够给同输入归并就行,不用于安全场景。
 */
function fastHash(str) {
  let h = 5381
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
    h = h | 0
  }
  return (h >>> 0).toString(36)
}

function loadStore() {
  const settings = loadGlobalSettings()
  const raw = settings?.[STORAGE_KEY]
  return Array.isArray(raw) ? raw.filter(item => item && typeof item === 'object') : []
}

function saveStore(records) {
  const trimmed = pruneRecords(records)
  saveGlobalSettings({ [STORAGE_KEY]: trimmed })
}

function pruneRecords(records) {
  const cutoff = Date.now() - MAX_DAYS * 86400000
  // 按 assistantId 分组,每组限 MAX_PER_ASSISTANT
  const byAssistant = new Map()
  for (const rec of records) {
    if (!rec || rec.timestamp < cutoff) continue
    const key = rec.assistantId || '_unknown'
    const arr = byAssistant.get(key) || []
    arr.push(rec)
    byAssistant.set(key, arr)
  }
  let total = []
  for (const [, arr] of byAssistant) {
    arr.sort((a, b) => b.timestamp - a.timestamp)
    total = total.concat(arr.slice(0, MAX_PER_ASSISTANT))
  }
  total.sort((a, b) => b.timestamp - a.timestamp)
  return total.slice(0, MAX_TOTAL)
}

function scheduleFlush() {
  if (flushScheduled) return
  flushScheduled = true
  const flush = () => {
    flushScheduled = false
    if (pendingQueue.length === 0) return
    const drained = pendingQueue
    pendingQueue = []
    try {
      const current = loadStore()
      const next = [...drained, ...current]
      saveStore(next)
    } catch (_) {
      // 失败丢弃,不 throw
    }
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(flush, { timeout: 1500 })
  } else {
    setTimeout(flush, 250)
  }
}

/**
 * 标准化外部传入的 signal,生成完整记录。
 *
 * 必填:type, assistantId
 * 可选:version, taskId, input, output, duration, tokens, success,
 *      failureCode, userNote, metadata, timestamp
 */
export function appendSignal(signal = {}) {
  const type = safeString(signal.type)
  if (!VALID_TYPES.has(type)) return ''
  const assistantId = safeString(signal.assistantId)
  if (!assistantId) return ''

  const inputStr = String(signal.input ?? '')
  const outputStr = String(signal.output ?? '')

  const id = `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const record = {
    id,
    type,
    assistantId,
    version: safeString(signal.version, '1.0.0'),
    timestamp: safeNumber(signal.timestamp, Date.now()),
    taskId: safeString(signal.taskId),
    inputHash: inputStr ? fastHash(inputStr) : '',
    inputLength: inputStr.length,
    outputHash: outputStr ? fastHash(outputStr) : '',
    outputLength: outputStr.length,
    duration: safeNumber(signal.duration, 0),
    tokens: safeNumber(signal.tokens, 0),
    success: signal.success !== false,
    failureCode: safeString(signal.failureCode),
    userNote: safeString(signal.userNote).slice(0, 500),
    documentAction: safeString(signal.documentAction),
    metadata: signal.metadata && typeof signal.metadata === 'object'
      ? sanitizeMetadata(signal.metadata)
      : null
  }

  pendingQueue.push(record)
  scheduleFlush()
  return id
}

/**
 * 把 metadata 对象限制到原始值/字符串,避免外部传 DOM/COM 对象。
 */
function sanitizeMetadata(meta, depth = 0) {
  if (depth > 3) return null
  const out = {}
  for (const [k, v] of Object.entries(meta)) {
    const key = String(k).slice(0, 80)
    if (v == null) continue
    const t = typeof v
    if (t === 'string') out[key] = v.slice(0, 500)
    else if (t === 'number' && Number.isFinite(v)) out[key] = v
    else if (t === 'boolean') out[key] = v
    else if (Array.isArray(v)) out[key] = v.slice(0, 10).map(item => {
      const tt = typeof item
      return tt === 'string' || tt === 'number' || tt === 'boolean' ? item : null
    }).filter(item => item != null)
    else if (t === 'object') out[key] = sanitizeMetadata(v, depth + 1)
  }
  return out
}

/**
 * 列出某助手最近 N 天的信号,可按 type 过滤。
 */
export function listSignalsByAssistant(assistantId, options = {}) {
  const id = safeString(assistantId)
  if (!id) return []
  const days = safeNumber(options.days, MAX_DAYS)
  const cutoff = Date.now() - days * 86400000
  const types = Array.isArray(options.types)
    ? new Set(options.types.filter(Boolean))
    : null
  return loadStore().filter(rec =>
    rec.assistantId === id &&
    rec.timestamp >= cutoff &&
    (!types || types.has(rec.type))
  )
}

export function listSignalsByVersion(assistantId, version, options = {}) {
  const v = safeString(version)
  return listSignalsByAssistant(assistantId, options).filter(rec => rec.version === v)
}

/**
 * 计算失败率(reject + task 失败 + thumbs down)/ 总信号数。
 */
export function computeFailureRate(assistantId, days = 7) {
  const signals = listSignalsByAssistant(assistantId, { days })
  if (signals.length === 0) return 0
  const failed = signals.filter(rec =>
    rec.type === 'reject' ||
    (rec.type === 'task' && rec.success === false) ||
    (rec.type === 'thumbs' && rec.metadata?.value === 'down')
  ).length
  return failed / signals.length
}

/**
 * 计算接受率(accept + thumbs up)/ 总信号数。
 */
export function computeAcceptRate(assistantId, days = 7) {
  const signals = listSignalsByAssistant(assistantId, { days })
  if (signals.length === 0) return 0
  const accepted = signals.filter(rec =>
    rec.type === 'accept' ||
    (rec.type === 'thumbs' && rec.metadata?.value === 'up')
  ).length
  return accepted / signals.length
}

/**
 * 用户主动清除某助手的全部信号。
 */
export function clearSignalsForAssistant(assistantId, options = {}) {
  const id = safeString(assistantId)
  if (!id) return 0
  const before = safeNumber(options.before, Date.now())
  const all = loadStore()
  const remained = all.filter(rec =>
    rec.assistantId !== id || rec.timestamp >= before
  )
  saveStore(remained)
  return all.length - remained.length
}

/**
 * 清空全部信号(用户隐私重置)。
 */
export function clearAllSignals() {
  saveStore([])
}

/**
 * 导出信号为 JSON 字符串(用户主动导出)。
 */
export function exportSignals(assistantId) {
  const data = assistantId
    ? listSignalsByAssistant(assistantId, { days: MAX_DAYS })
    : loadStore()
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    schemaVersion: 'signals@1',
    count: data.length,
    records: data
  }, null, 2)
}

/**
 * 总览统计(供设置页"我的信号"面板)。
 */
export function getSignalStats() {
  const all = loadStore()
  const now = Date.now()
  const day = 86400000
  const last7 = all.filter(r => now - r.timestamp < 7 * day)
  const last30 = all.filter(r => now - r.timestamp < 30 * day)

  const byType = {}
  for (const rec of all) {
    byType[rec.type] = (byType[rec.type] || 0) + 1
  }
  const byAssistant = {}
  for (const rec of all) {
    byAssistant[rec.assistantId] = (byAssistant[rec.assistantId] || 0) + 1
  }
  return {
    total: all.length,
    last7Days: last7.length,
    last30Days: last30.length,
    byType,
    byAssistant,
    storageKey: STORAGE_KEY
  }
}

/**
 * 同步刷新(测试或退出前可调用,确保 pendingQueue 落盘)。
 */
export function flushSignalsSync() {
  if (pendingQueue.length === 0) return
  const drained = pendingQueue
  pendingQueue = []
  flushScheduled = false
  try {
    const current = loadStore()
    saveStore([...drained, ...current])
  } catch (_) {}
}

export default {
  appendSignal,
  listSignalsByAssistant,
  listSignalsByVersion,
  computeFailureRate,
  computeAcceptRate,
  clearSignalsForAssistant,
  clearAllSignals,
  exportSignals,
  getSignalStats,
  flushSignalsSync
}
