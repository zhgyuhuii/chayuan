/**
 * telemetryPipeline — 遥测数据管道骨架
 *
 * 目的:把 perfTracker / signalStore / 关键 UI 事件 batch 上报到后端,
 * 但严格遵守:
 *   - 默认 opt-out(用户必须明确同意)
 *   - 永不发送原文(只发结构化指标 / hash)
 *   - 离线缓冲 + 在线 batch
 *   - 用户可一键导出 / 删除自己所有 telemetry 数据
 *
 * 当前实现:
 *   - sendToEndpoint 留空(用户提供 endpoint 后启用)
 *   - 本地 ring buffer + flush 触发条件
 *
 * 合规:GDPR Art. 7(明确同意)+ 中国《个人信息保护法》(单独同意 + 撤回)
 */

import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'

const CONSENT_KEY = 'telemetryConsent'
const BUFFER_KEY = 'telemetryBuffer'
const MAX_BUFFER = 500
const BATCH_SIZE = 50
const FLUSH_INTERVAL_MS = 60_000

let _endpoint = ''
let _bufferCache = null
let _flushTimer = null

/* ────────── 同意管理 ────────── */

export function getConsent() {
  const s = loadGlobalSettings()
  return s[CONSENT_KEY] === true
}

export function grantConsent() {
  saveGlobalSettings({ [CONSENT_KEY]: true })
  return true
}

export function revokeConsent() {
  saveGlobalSettings({ [CONSENT_KEY]: false })
  // 撤回时清空 buffer
  saveGlobalSettings({ [BUFFER_KEY]: [] })
  _bufferCache = []
  return true
}

export function isOptedIn() {
  return getConsent()
}

/* ────────── 缓冲 ────────── */

function loadBuffer() {
  if (_bufferCache) return _bufferCache
  const s = loadGlobalSettings()
  _bufferCache = Array.isArray(s[BUFFER_KEY]) ? s[BUFFER_KEY] : []
  return _bufferCache
}

function saveBuffer() {
  saveGlobalSettings({ [BUFFER_KEY]: _bufferCache || [] })
}

/**
 * 记录一条遥测事件。
 *   ev: { kind, action, value?, metadata? }
 *
 * 自动:
 *   - 若用户未同意 → no-op
 *   - 不发原文(metadata 必须是已脱敏 / hash 过)
 */
export function record(ev) {
  if (!isOptedIn()) return false
  if (!ev?.kind) return false
  const safe = {
    kind: String(ev.kind),
    action: String(ev.action || ''),
    value: typeof ev.value === 'number' ? ev.value : null,
    metadata: ev.metadata && typeof ev.metadata === 'object' ? sanitize(ev.metadata) : null,
    ts: Date.now()
  }
  const buf = loadBuffer()
  buf.push(safe)
  if (buf.length > MAX_BUFFER) buf.splice(0, buf.length - MAX_BUFFER)
  saveBuffer()

  if (buf.length >= BATCH_SIZE) {
    flushNow().catch(() => {})
  } else if (!_flushTimer) {
    _flushTimer = setTimeout(() => {
      _flushTimer = null
      flushNow().catch(() => {})
    }, FLUSH_INTERVAL_MS)
  }
  return true
}

/**
 * 脱敏:递归只保留原始类型 + 字符串截断到 80 字符。
 * metadata 不应该出现长文本(原文)— 这里 hard-truncate 防止泄露。
 */
function sanitize(meta, depth = 0) {
  if (depth > 3) return null
  const out = {}
  for (const [k, v] of Object.entries(meta)) {
    const key = String(k).slice(0, 60)
    if (v == null) continue
    const t = typeof v
    if (t === 'string') out[key] = v.slice(0, 80)
    else if (t === 'number' && Number.isFinite(v)) out[key] = v
    else if (t === 'boolean') out[key] = v
    else if (Array.isArray(v)) out[key] = v.slice(0, 10).map(x => typeof x === 'object' ? sanitize(x, depth + 1) : x)
    else if (t === 'object') out[key] = sanitize(v, depth + 1)
  }
  return out
}

/* ────────── 上报 ────────── */

export function setEndpoint(url) {
  _endpoint = String(url || '').trim()
}

export async function flushNow() {
  if (!isOptedIn()) return { sent: 0, reason: 'no-consent' }
  if (!_endpoint) return { sent: 0, reason: 'no-endpoint' }
  const buf = loadBuffer()
  if (buf.length === 0) return { sent: 0, reason: 'empty' }
  const batch = buf.slice(0, BATCH_SIZE)
  try {
    const res = await fetch(_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // 成功 → 移除已发送的
    _bufferCache = buf.slice(batch.length)
    saveBuffer()
    return { sent: batch.length }
  } catch (e) {
    return { sent: 0, error: String(e?.message || e) }
  }
}

/* ────────── 用户数据控制 ────────── */

export function exportMyData() {
  return JSON.stringify({
    consent: getConsent(),
    buffer: loadBuffer(),
    exportedAt: new Date().toISOString()
  }, null, 2)
}

export function deleteMyData() {
  saveGlobalSettings({ [BUFFER_KEY]: [] })
  _bufferCache = []
  return true
}

export default {
  getConsent,
  grantConsent,
  revokeConsent,
  isOptedIn,
  record,
  flushNow,
  setEndpoint,
  exportMyData,
  deleteMyData
}
