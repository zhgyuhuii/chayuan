import { executeDocumentFormatAction } from './documentFormatActions.js'
import { insertBlankPageAtPosition, insertPageBreakAtPosition, insertTableAtPosition } from './documentInsertActions.js'

const STORAGE_KEY = 'NdDocumentOperationLedger'
const ARCHIVE_LIMIT = 200

function getApplication() {
  return window.Application || window.opener?.Application || window.parent?.Application || null
}

function safeParse(raw, fallback = null) {
  if (!raw) return fallback
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch (_) {
    return fallback
  }
}

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function truncateText(text = '', maxLength = 280) {
  const normalized = normalizeString(text)
  if (!normalized) return ''
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
}

function cloneValue(value, fallback = null) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (_) {
    return fallback
  }
}

function getStorageBucket() {
  const app = getApplication()
  const localRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : ''
  const pluginRaw = app?.PluginStorage?.getItem(STORAGE_KEY)
  return safeParse(localRaw || pluginRaw, { batches: [] }) || { batches: [] }
}

function saveStorageBucket(bucket = {}) {
  const payload = JSON.stringify(bucket || { batches: [] })
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, payload)
  }
  try {
    getApplication()?.PluginStorage?.setItem(STORAGE_KEY, payload)
  } catch (_) {}
  return true
}

function buildOperationEntry(target = {}, index = 0, context = {}) {
  const action = normalizeString(target?.action, 'none')
  const replayPayload = cloneValue(target?.replayPayload || target?.metadata || null, null)
  const replayableActions = new Set([
    'replace',
    'delete',
    'insert-after',
    'insert',
    'comment',
    'link-comment',
    'comment-replace',
    'append',
    'prepend',
    'format-selection',
    'insert-table',
    'insert-page-break',
    'insert-blank-page',
    'replace-selection-text',
    'paste-text',
    'append-text-to-document',
    'duplicate-selection-text'
  ])
  return {
    id: normalizeString(target?.id, `doc_op_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`),
    action,
    start: Number.isFinite(Number(target?.start)) ? Number(target.start) : null,
    end: Number.isFinite(Number(target?.end)) ? Number(target.end) : null,
    paragraphIndex: Number.isFinite(Number(target?.paragraphIndex)) ? Number(target.paragraphIndex) : null,
    locateKey: normalizeString(target?.locateKey),
    originalText: truncateText(target?.originalText, 320),
    outputText: truncateText(target?.outputText, 320),
    downgraded: target?.downgraded === true,
    styleIssues: Array.isArray(context?.styleValidation?.issues) ? context.styleValidation.issues.slice(0, 8) : [],
    styleSeverity: normalizeString(context?.styleValidation?.severity, 'none'),
    replayable: replayableActions.has(action),
    replayPayload,
    replaySupportReason: replayableActions.has(action) ? '' : `暂不支持重放该操作：${action || 'unknown'}`,
    createdAt: new Date().toISOString()
  }
}

export function createDocumentOperationBatch(record = {}) {
  const now = new Date().toISOString()
  const writeTargets = Array.isArray(record?.writeTargets) ? record.writeTargets : []
  const operations = writeTargets.map((item, index) => buildOperationEntry(item, index, record))
  return {
    id: normalizeString(record.id, `doc_batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    taskId: normalizeString(record.taskId),
    assistantId: normalizeString(record.assistantId),
    backupId: normalizeString(record.backupId),
    title: normalizeString(record.title, '文档操作账本'),
    summary: normalizeString(record.summary),
    action: normalizeString(record.action),
    launchSource: normalizeString(record.launchSource),
    planPreview: {
      beforeText: truncateText(record?.planPreview?.beforeText || record?.previewBefore, 320),
      afterText: truncateText(record?.planPreview?.afterText || record?.previewAfter, 320)
    },
    qualityGate: cloneValue(record.qualityGate, {}),
    styleValidation: cloneValue(record.styleValidation, {}),
    operations,
    metadata: cloneValue(record.metadata, {}),
    createdAt: normalizeString(record.createdAt, now),
    updatedAt: normalizeString(record.updatedAt, now)
  }
}

export function appendDocumentOperationBatch(record = {}) {
  const bucket = getStorageBucket()
  const batch = createDocumentOperationBatch(record)
  const batches = [batch, ...(Array.isArray(bucket.batches) ? bucket.batches : [])]
    .filter(Boolean)
    .slice(0, ARCHIVE_LIMIT)
  saveStorageBucket({ batches })
  return batch
}

export function listDocumentOperationBatches(filters = {}) {
  const taskId = normalizeString(filters.taskId)
  const backupId = normalizeString(filters.backupId)
  return (getStorageBucket().batches || []).filter((item) => {
    if (taskId && item.taskId !== taskId) return false
    if (backupId && item.backupId !== backupId) return false
    return true
  })
}

export function getDocumentOperationBatchById(id = '') {
  const normalized = normalizeString(id)
  if (!normalized) return null
  return (getStorageBucket().batches || []).find(item => item.id === normalized) || null
}

function replayReplace(doc, entry) {
  const selectionRange = getApplication()?.Selection?.Range || null
  const hasExplicitRange = entry.start != null || entry.end != null
  const range = hasExplicitRange
    ? doc.Range(Number(entry.start || 0), Number(entry.end || 0))
    : selectionRange
  if (!range) throw new Error('当前没有可替换的选区，无法重放该操作')
  range.Text = String(entry.outputText || '')
}

function replayDelete(doc, entry) {
  const selectionRange = getApplication()?.Selection?.Range || null
  const hasExplicitRange = entry.start != null || entry.end != null
  const range = hasExplicitRange
    ? doc.Range(Number(entry.start || 0), Number(entry.end || entry.start || 0))
    : selectionRange
  if (!range) throw new Error('当前没有可删除的选区，无法重放该操作')
  range.Text = ''
}

function replayInsertAfter(doc, entry) {
  const selectionRange = getApplication()?.Selection?.Range || null
  const hasExplicitRange = entry.start != null || entry.end != null
  const range = hasExplicitRange
    ? doc.Range(Number(entry.end || entry.start || 0), Number(entry.end || entry.start || 0))
    : selectionRange
  if (!range) throw new Error('当前没有可插入的选区，无法重放该操作')
  if (typeof range.InsertAfter === 'function') {
    range.InsertAfter(String(entry.outputText || ''))
  } else {
    range.Text = `${String(range.Text || '')}${String(entry.outputText || '')}`
  }
}

function replayComment(doc, entry) {
  const range = doc.Range(Number(entry.start || 0), Number(entry.end || entry.start || 0))
  const commentText = String(entry.outputText || '').trim()
  if (!commentText) return
  if (doc?.Comments?.Add) {
    doc.Comments.Add(range, commentText)
    return
  }
  if (range?.Comments?.Add) {
    range.Comments.Add(range, commentText)
    return
  }
  throw new Error('当前宿主不支持批注回放')
}

function replayCommentReplace(doc, entry) {
  replayComment(doc, entry)
  if (entry.start != null && entry.end != null) {
    replayReplace(doc, entry)
  }
}

function replayAppend(doc, entry) {
  const range = doc.Range(Number(doc?.Content?.End || 0), Number(doc?.Content?.End || 0))
  if (typeof range.InsertAfter === 'function') {
    range.InsertAfter(String(entry.outputText || ''))
  } else {
    range.Text = `${String(range.Text || '')}${String(entry.outputText || '')}`
  }
}

function replayPrepend(doc, entry) {
  const range = doc.Range(Number(doc?.Content?.Start || 0), Number(doc?.Content?.Start || 0))
  if (typeof range.InsertBefore === 'function') {
    range.InsertBefore(String(entry.outputText || ''))
  } else {
    range.Text = `${String(entry.outputText || '')}${String(range.Text || '')}`
  }
}

function replayFormatSelection(entry = {}) {
  const payload = entry?.replayPayload && typeof entry.replayPayload === 'object'
    ? entry.replayPayload
    : {}
  return executeDocumentFormatAction({
    scope: 'selection',
    ...payload
  })
}

function replayInsertTable(entry = {}) {
  return insertTableAtPosition({
    pageNumber: entry?.paragraphIndex,
    ...(entry?.replayPayload && typeof entry.replayPayload === 'object' ? entry.replayPayload : {})
  })
}

function replayInsertPageBreak(entry = {}) {
  return insertPageBreakAtPosition({
    pageNumber: entry?.paragraphIndex,
    ...(entry?.replayPayload && typeof entry.replayPayload === 'object' ? entry.replayPayload : {})
  })
}

function replayInsertBlankPage(entry = {}) {
  return insertBlankPageAtPosition({
    pageNumber: entry?.paragraphIndex,
    ...(entry?.replayPayload && typeof entry.replayPayload === 'object' ? entry.replayPayload : {})
  })
}

export function replayDocumentOperationEntry(entry = {}) {
  const doc = getApplication()?.ActiveDocument
  if (!doc) throw new Error('当前没有打开文档，无法重放该操作')
  const action = normalizeString(entry?.action)
  if (action === 'replace') {
    replayReplace(doc, entry)
  } else if (action === 'delete') {
    replayDelete(doc, entry)
  } else if (action === 'insert-after' || action === 'insert') {
    replayInsertAfter(doc, entry)
  } else if (action === 'comment' || action === 'link-comment') {
    replayComment(doc, entry)
  } else if (action === 'comment-replace') {
    replayCommentReplace(doc, entry)
  } else if (action === 'append') {
    replayAppend(doc, entry)
  } else if (action === 'prepend') {
    replayPrepend(doc, entry)
  } else if (action === 'format-selection') {
    replayFormatSelection(entry)
  } else if (action === 'insert-table') {
    replayInsertTable(entry)
  } else if (action === 'insert-page-break') {
    replayInsertPageBreak(entry)
  } else if (action === 'insert-blank-page') {
    replayInsertBlankPage(entry)
  } else if (action === 'replace-selection-text') {
    replayReplace(doc, entry)
  } else if (action === 'paste-text' || action === 'duplicate-selection-text') {
    replayInsertAfter(doc, entry)
  } else if (action === 'append-text-to-document') {
    replayAppend(doc, entry)
  } else {
    throw new Error(entry?.replaySupportReason || `暂不支持重放该操作：${action || 'unknown'}`)
  }
  return {
    ok: true,
    action,
    message: `已重放操作：${action}`
  }
}

export function replayDocumentOperationBatch(batchId = '', options = {}) {
  const batch = getDocumentOperationBatchById(batchId)
  if (!batch) {
    throw new Error('未找到可重放的操作账本')
  }
  const operationId = normalizeString(options.operationId)
  const targets = operationId
    ? batch.operations.filter(item => item.id === operationId)
    : batch.operations
  if (!targets.length) {
    throw new Error(operationId ? '未找到指定操作' : '该账本没有可重放操作')
  }
  const results = []
  const skipped = []
  targets.forEach((item) => {
    if (item?.replayable === false) {
      skipped.push({
        id: item.id,
        action: item.action,
        reason: item.replaySupportReason || '当前操作不支持重放'
      })
      return
    }
    results.push(replayDocumentOperationEntry(item))
  })
  return {
    batchId: batch.id,
    replayedCount: results.length,
    skippedCount: skipped.length,
    skipped,
    results
  }
}

export function exportDocumentOperationBatch(batchId = '') {
  const batch = getDocumentOperationBatchById(batchId)
  if (!batch) return ''
  return JSON.stringify(batch, null, 2)
}
