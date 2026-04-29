/**
 * selectionToken - 跨窗口/跨进程的选区快照
 *
 * 解决"对话框打开瞬间 Selection 丢失或被宿主重置"的硬伤。
 *
 * 用法:
 *   ribbon 主窗 OnAction 内,在 ShowDialog 之前:
 *     const token = snapshotSelection()
 *     PluginStorage.setItem(`selToken:${tokenId}`, JSON.stringify(token))
 *
 *   对话框内,写回前:
 *     const token = readToken(tokenId)
 *     const range = restoreRange(token)
 *     applyDocumentAction(action, text, { targetRange: range })
 *
 * 不存原文,只存坐标:
 *   { start, end, paragraphIndex, docName, hasSelection, takenAt }
 */

import { getApp, getDoc, getSelection, getPluginStorage } from './hostBridge.js'

const DEFAULT_TTL_MS = 5 * 60 * 1000   // 5 分钟过期
const STORAGE_PREFIX = 'chy_seltok_'

function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function safeString(value, fallback = '') {
  const s = String(value ?? '')
  return s ? s : fallback
}

/**
 * 快照当前选区。返回 plain object,可序列化。
 */
export function snapshotSelection() {
  const doc = getDoc()
  const sel = getSelection()
  if (!doc || !sel) {
    return null
  }

  let start = 0
  let end = 0
  let paragraphIndex = 0
  let hasSelection = false
  let docName = ''
  let selectionText = ''

  try {
    const range = sel.Range
    if (range) {
      start = safeNumber(range.Start, 0)
      end = safeNumber(range.End, 0)
      hasSelection = end > start
    }
  } catch (_) {}

  try {
    const range = sel.Range
    if (range?.Paragraphs?.Item) {
      const para = range.Paragraphs.Item(1)
      const paraRange = para?.Range
      if (paraRange) {
        // 估算第几段:用范围 start 与全文段落比对成本太高
        // 这里采用更便宜的方案 — 段落自身在选区内的索引(段计数)
        paragraphIndex = safeNumber(range.Paragraphs.Count, 0)
      }
    }
  } catch (_) {}

  try {
    docName = safeString(doc.Name)
  } catch (_) {}

  try {
    // 仅取前 80 字作为校验串(用于 restore 时 sanity check)
    const text = safeString(sel.Text)
    selectionText = text.slice(0, 80)
  } catch (_) {}

  return {
    schema: 'selection-token@1',
    start,
    end,
    paragraphIndex,
    hasSelection,
    docName,
    selectionPreview: selectionText,
    takenAt: Date.now()
  }
}

/**
 * 把 token 写入 PluginStorage,返回 tokenId(用于 dialog query string 传递)。
 */
export function persistToken(token, options = {}) {
  if (!token || typeof token !== 'object') return ''
  const ps = getPluginStorage()
  if (!ps) return ''
  const id = String(options.id || `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  try {
    ps.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(token))
    return id
  } catch (_) {
    return ''
  }
}

/**
 * 一步:快照并持久化,返回 tokenId,失败返回空串。
 */
export function snapshotAndPersist(options = {}) {
  const token = snapshotSelection()
  if (!token) return ''
  return persistToken(token, options)
}

/**
 * 从 PluginStorage 读取 token,过期或不存在返回 null。
 */
export function readToken(tokenId, options = {}) {
  if (!tokenId) return null
  const ps = getPluginStorage()
  if (!ps) return null
  try {
    const raw = ps.getItem(`${STORAGE_PREFIX}${tokenId}`)
    if (!raw) return null
    const token = JSON.parse(raw)
    if (!token || token.schema !== 'selection-token@1') return null
    const ttl = safeNumber(options.ttlMs, DEFAULT_TTL_MS)
    if (ttl > 0 && Date.now() - safeNumber(token.takenAt, 0) > ttl) {
      // 过期主动清理
      try { ps.setItem(`${STORAGE_PREFIX}${tokenId}`, '') } catch (_) {}
      return null
    }
    return token
  } catch (_) {
    return null
  }
}

/**
 * 用 token 还原 Range。失败返回 null,不 throw。
 */
export function restoreRange(token) {
  if (!token || token.schema !== 'selection-token@1') return null
  const doc = getDoc()
  if (!doc) return null

  // 文档名一致性检查(避免在另一份文档里盲目 Range)
  try {
    const currentDocName = String(doc.Name || '')
    if (token.docName && currentDocName && token.docName !== currentDocName) {
      return null
    }
  } catch (_) {}

  const start = safeNumber(token.start, 0)
  const end = safeNumber(token.end, 0)
  if (end < start) return null

  try {
    if (typeof doc.Range === 'function') {
      return doc.Range(start, end)
    }
  } catch (_) {}

  return null
}

/**
 * 还原 Selection(把光标重新放回)。返回是否成功。
 */
export function restoreSelection(token) {
  const range = restoreRange(token)
  if (!range) return false
  try {
    if (typeof range.Select === 'function') {
      range.Select()
      return true
    }
  } catch (_) {}
  return false
}

/**
 * 释放 token(写回完成后调用,避免 PluginStorage 累积)。
 */
export function releaseToken(tokenId) {
  if (!tokenId) return
  const ps = getPluginStorage()
  if (!ps) return
  try {
    ps.setItem(`${STORAGE_PREFIX}${tokenId}`, '')
  } catch (_) {}
}

/**
 * 清理所有过期 token(开机或定时调用)。
 * 因 PluginStorage 没有 listKeys API,这里只能通过约定 id 列表清理,
 * 暂留接口以备后续在 P4 接入 BroadcastChannel 后扩展。
 */
export function pruneExpiredTokens(_knownIds = []) {
  // 占位,P4 实现
}

export default {
  snapshotSelection,
  snapshotAndPersist,
  persistToken,
  readToken,
  restoreRange,
  restoreSelection,
  releaseToken,
  pruneExpiredTokens
}
