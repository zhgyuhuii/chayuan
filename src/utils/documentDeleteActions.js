import { getApplication } from './documentActions.js'

const SCOPE_LABELS = {
  selection: '当前选择范围',
  paragraph: '当前段落',
  document: '全文'
}

const TARGET_LABELS = {
  selection: '选中内容',
  paragraph: '当前段落',
  document: '全文',
  table: '表格',
  image: '图片',
  comment: '批注',
  'paragraph-index': '指定段落'
}

function normalizeText(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function safeNumber(value) {
  if (value == null || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function parseChineseNumberToken(rawValue) {
  const token = String(rawValue || '').trim()
  if (!token) return NaN
  if (/^\d+$/.test(token)) return Number(token)
  const normalized = token.replace(/两/g, '二')
  const directMap = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  }
  if (directMap[normalized] != null) return directMap[normalized]
  if (/^十[一二三四五六七八九]$/.test(normalized)) {
    return 10 + directMap[normalized.slice(1)]
  }
  if (/^[一二三四五六七八九]十$/.test(normalized)) {
    return directMap[normalized[0]] * 10
  }
  if (/^[一二三四五六七八九]十[一二三四五六七八九]$/.test(normalized)) {
    return directMap[normalized[0]] * 10 + directMap[normalized[2]]
  }
  return NaN
}

function duplicateRange(range) {
  if (!range) return null
  try {
    return typeof range.Duplicate === 'function' ? range.Duplicate() : range
  } catch (_) {
    return range
  }
}

function getActiveDocument() {
  return getApplication()?.ActiveDocument || null
}

function getSelection() {
  return getApplication()?.Selection || null
}

function getSelectionRange() {
  return getSelection()?.Range || null
}

function normalizeScope(value, fallback = 'selection') {
  const raw = String(value || '').trim().toLowerCase()
  if (['selection', 'selected', 'selected-text', 'range'].includes(raw)) return 'selection'
  if (['paragraph', 'current-paragraph'].includes(raw)) return 'paragraph'
  if (['document', 'all', 'full-document', '全文'].includes(raw)) return 'document'
  return fallback
}

function normalizeTarget(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (['selection', 'selected', 'selected-text', 'range', 'text'].includes(raw)) return 'selection'
  if (['paragraph', 'current-paragraph'].includes(raw)) return 'paragraph'
  if (['document', 'all', 'full-document', '全文'].includes(raw)) return 'document'
  if (['table', 'tables'].includes(raw)) return 'table'
  if (['image', 'images', 'picture', 'pictures'].includes(raw)) return 'image'
  if (['comment', 'comments', 'annotation', 'annotations'].includes(raw)) return 'comment'
  if (['paragraph-index', 'paragraph_number', 'paragraphnumber', 'nth-paragraph'].includes(raw)) return 'paragraph-index'
  return ''
}

function getCurrentParagraphRange() {
  const selection = getSelection()
  try {
    return duplicateRange(
      selection?.Paragraphs?.Item?.(1)?.Range ||
      selection?.Range?.Paragraphs?.Item?.(1)?.Range ||
      null
    )
  } catch (_) {
    return null
  }
}

function resolveScopeRange(scope, options = {}) {
  const doc = getActiveDocument()
  if (!doc) {
    throw new Error('当前没有打开文档')
  }
  if (scope === 'document') {
    return {
      doc,
      scope,
      label: SCOPE_LABELS.document,
      range: duplicateRange(doc.Content)
    }
  }
  if (scope === 'paragraph') {
    const range = getCurrentParagraphRange()
    if (!range) {
      throw new Error('无法获取当前段落，请先把光标放到需要处理的段落内')
    }
    return {
      doc,
      scope,
      label: SCOPE_LABELS.paragraph,
      range
    }
  }
  const range = duplicateRange(getSelectionRange())
  if (!range) {
    throw new Error('请先选中内容，或将光标放到需要处理的位置')
  }
  const isCollapsed = Number(range.Start || 0) === Number(range.End || 0)
  if (isCollapsed && options.requireExpandedSelection) {
    throw new Error('请先选中需要删除的内容')
  }
  return {
    doc,
    scope: 'selection',
    label: SCOPE_LABELS.selection,
    range
  }
}

function rangeIntersects(range, start, end) {
  if (!range) return false
  const rangeStart = Number(range.Start || 0)
  const rangeEnd = Number(range.End || rangeStart)
  return rangeEnd >= start && rangeStart <= end
}

function getRangeCoordinates(range) {
  return {
    start: Number(range?.Start || 0),
    end: Number(range?.End || 0)
  }
}

function getParagraphRangeByIndex(doc, index) {
  const paragraphs = doc?.Paragraphs
  const total = Number(paragraphs?.Count || 0)
  if (!paragraphs || total <= 0) {
    throw new Error('文档中没有可删除的段落')
  }
  if (!Number.isFinite(index) || index < 1 || index > total) {
    throw new Error(`文档共有 ${total} 段，无法定位第 ${index} 段`)
  }
  return duplicateRange(paragraphs.Item(index)?.Range)
}

function buildRangeDeleteTarget(doc, range, label) {
  const coords = getRangeCoordinates(range)
  return {
    type: 'range',
    label,
    start: coords.start,
    end: coords.end,
    delete() {
      doc.Range(coords.start, coords.end).Delete()
    }
  }
}

function collectTableTargets(doc, scopeRange) {
  const tables = doc?.Tables
  const tableCount = Number(tables?.Count || 0)
  if (!tables || tableCount <= 0) return []
  const targets = []
  for (let i = 1; i <= tableCount; i++) {
    try {
      const table = tables.Item(i)
      const range = duplicateRange(table?.Range)
      if (!range) continue
      if (!rangeIntersects(range, Number(scopeRange?.Start || 0), Number(scopeRange?.End || 0))) continue
      targets.push({
        type: 'table',
        label: '表格',
        start: Number(range.Start || 0),
        order: i,
        delete() {
          if (typeof table?.Delete === 'function') {
            table.Delete()
            return
          }
          doc.Range(Number(range.Start || 0), Number(range.End || 0)).Delete()
        }
      })
    } catch (_) {
      continue
    }
  }
  return targets
}

function isPictureInlineShape(inlineShape) {
  if (!inlineShape) return false
  try {
    const type = inlineShape.Type
    if (type === 3 || type === 4) return true
    return !!inlineShape.PictureFormat
  } catch (_) {
    return false
  }
}

function collectInlineImageTargets(doc, scopeRange) {
  const inlineShapes = doc?.InlineShapes
  const count = Number(inlineShapes?.Count || 0)
  if (!inlineShapes || count <= 0) return []
  const targets = []
  for (let i = 1; i <= count; i++) {
    try {
      const shape = inlineShapes.Item(i)
      const range = duplicateRange(shape?.Range)
      if (!range || !isPictureInlineShape(shape)) continue
      if (!rangeIntersects(range, Number(scopeRange?.Start || 0), Number(scopeRange?.End || 0))) continue
      const coords = getRangeCoordinates(range)
      targets.push({
        type: 'inline-image',
        label: '图片',
        start: coords.start,
        order: i,
        delete() {
          doc.Range(coords.start, coords.end).Delete()
        }
      })
    } catch (_) {
      continue
    }
  }
  return targets
}

function isPictureShape(shape) {
  if (!shape) return false
  try {
    const type = shape.Type
    return type === 13 || type === 1
  } catch (_) {
    return false
  }
}

function collectFloatingImageTargets(doc, scopeRange) {
  const shapes = doc?.Shapes
  const count = Number(shapes?.Count || 0)
  if (!shapes || count <= 0) return []
  const targets = []
  for (let i = 1; i <= count; i++) {
    try {
      const shape = shapes.Item(i)
      if (!isPictureShape(shape)) continue
      const anchor = duplicateRange(shape?.Anchor)
      if (!anchor) continue
      if (!rangeIntersects(anchor, Number(scopeRange?.Start || 0), Number(scopeRange?.End || 0))) continue
      targets.push({
        type: 'floating-image',
        label: '图片',
        start: Number(anchor.Start || 0),
        order: i,
        delete() {
          shape.Delete()
        }
      })
    } catch (_) {
      continue
    }
  }
  return targets
}

function getCommentScopeRange(comment) {
  try {
    return duplicateRange(comment?.Scope || comment?.Reference || comment?.Range || null)
  } catch (_) {
    return null
  }
}

function collectCommentTargets(doc, scopeRange) {
  const comments = doc?.Comments
  const count = Number(comments?.Count || 0)
  if (!comments || count <= 0) return []
  const targets = []
  for (let i = 1; i <= count; i++) {
    try {
      const comment = comments.Item(i)
      const range = getCommentScopeRange(comment)
      if (!range) continue
      if (!rangeIntersects(range, Number(scopeRange?.Start || 0), Number(scopeRange?.End || 0))) continue
      targets.push({
        type: 'comment',
        label: '批注',
        start: Number(range.Start || 0),
        order: i,
        delete() {
          if (typeof comment?.Delete === 'function') {
            comment.Delete()
            return
          }
          throw new Error('当前环境不支持直接删除批注')
        }
      })
    } catch (_) {
      continue
    }
  }
  return targets
}

function sortDeleteTargets(targets = []) {
  return [...targets].sort((a, b) => {
    const bStart = Number(b?.start || 0)
    const aStart = Number(a?.start || 0)
    if (bStart !== aStart) return bStart - aStart
    return Number(b?.order || 0) - Number(a?.order || 0)
  })
}

function resolveDeleteTargets(intent) {
  const normalized = normalizeDocumentDeleteIntent(intent)
  if (!normalized) {
    throw new Error('删除任务参数无效')
  }
  const doc = getActiveDocument()
  if (!doc) {
    throw new Error('当前没有打开文档')
  }
  if (normalized.target === 'document') {
    const range = duplicateRange(doc.Content)
    return {
      scopeLabel: SCOPE_LABELS.document,
      targetLabel: TARGET_LABELS.document,
      targets: [buildRangeDeleteTarget(doc, range, TARGET_LABELS.document)]
    }
  }
  if (normalized.target === 'paragraph-index') {
    const range = getParagraphRangeByIndex(doc, normalized.paragraphIndex)
    return {
      scopeLabel: '指定段落',
      targetLabel: `第 ${normalized.paragraphIndex} 段`,
      targets: [buildRangeDeleteTarget(doc, range, `第 ${normalized.paragraphIndex} 段`)]
    }
  }
  if (normalized.target === 'paragraph') {
    const range = getCurrentParagraphRange()
    if (!range) {
      throw new Error('无法获取当前段落，请先把光标放到需要删除的段落内')
    }
    return {
      scopeLabel: SCOPE_LABELS.paragraph,
      targetLabel: TARGET_LABELS.paragraph,
      targets: [buildRangeDeleteTarget(doc, range, TARGET_LABELS.paragraph)]
    }
  }
  if (normalized.target === 'selection') {
    const { label, range } = resolveScopeRange('selection', { requireExpandedSelection: true })
    return {
      scopeLabel: label,
      targetLabel: TARGET_LABELS.selection,
      targets: [buildRangeDeleteTarget(doc, range, TARGET_LABELS.selection)]
    }
  }
  const { label, range } = resolveScopeRange(normalized.scope, { requireExpandedSelection: false })
  if (normalized.target === 'table') {
    return {
      scopeLabel: label,
      targetLabel: TARGET_LABELS.table,
      targets: collectTableTargets(doc, range)
    }
  }
  if (normalized.target === 'image') {
    return {
      scopeLabel: label,
      targetLabel: TARGET_LABELS.image,
      targets: [
        ...collectInlineImageTargets(doc, range),
        ...collectFloatingImageTargets(doc, range)
      ]
    }
  }
  if (normalized.target === 'comment') {
    return {
      scopeLabel: label,
      targetLabel: TARGET_LABELS.comment,
      targets: collectCommentTargets(doc, range)
    }
  }
  throw new Error('当前删除类型暂不支持')
}

export function normalizeDocumentDeleteIntent(rawIntent = {}) {
  if (!rawIntent || typeof rawIntent !== 'object') return null
  const intent = String(rawIntent.intent || rawIntent.type || '').trim().toLowerCase()
  if (intent && !['document-delete', 'delete', 'remove'].includes(intent)) return null
  const target = normalizeTarget(rawIntent.target || rawIntent.deleteTarget || rawIntent.object || rawIntent.objectType)
  const paragraphIndex = safeNumber(rawIntent.paragraphIndex)
    ?? safeNumber(rawIntent.index)
    ?? (() => {
      const parsed = parseChineseNumberToken(rawIntent.paragraphNumber)
      return Number.isFinite(parsed) ? parsed : null
    })()
  if (!target) return null
  if (target === 'paragraph-index' && (!Number.isFinite(paragraphIndex) || paragraphIndex < 1)) {
    return null
  }
  const scope = target === 'document'
    ? 'document'
    : target === 'paragraph'
      ? 'paragraph'
      : target === 'selection'
        ? 'selection'
        : target === 'paragraph-index'
          ? 'document'
          : normalizeScope(rawIntent.scope || rawIntent.targetScope || rawIntent.rangeScope, 'selection')
  return {
    intent: 'document-delete',
    target,
    scope,
    paragraphIndex: target === 'paragraph-index' ? Number(paragraphIndex) : null
  }
}

function getDeleteActionSummary(intent, count, scopeLabel, targetLabel) {
  if (intent.target === 'document') return '将清空全文内容。'
  if (intent.target === 'paragraph-index') return `将删除第 ${intent.paragraphIndex} 段。`
  if (intent.target === 'paragraph') return '将删除当前段落。'
  if (intent.target === 'selection') return '将删除当前选中内容。'
  return `${scopeLabel}内共定位到 ${count} 个${targetLabel}。`
}

function getDeleteConfirmPrompt(intent, count, targetLabel) {
  if (intent.target === 'document') return '是否确认清空全文？'
  if (intent.target === 'paragraph-index') return `是否确认删除第 ${intent.paragraphIndex} 段？`
  if (intent.target === 'paragraph') return '是否确认删除当前段落？'
  if (intent.target === 'selection') return '是否确认删除当前选中内容？'
  if (count <= 0) return `未找到可删除的${targetLabel}。`
  return count === 1
    ? `是否确认删除该${targetLabel}？`
    : `是否确认删除这 ${count} 个${targetLabel}？`
}

export function createDocumentDeletePreview(intent) {
  const normalizedIntent = normalizeDocumentDeleteIntent(intent)
  if (!normalizedIntent) {
    throw new Error('未识别到可执行的删除指令')
  }
  const { scopeLabel, targetLabel, targets } = resolveDeleteTargets(normalizedIntent)
  const count = targets.length
  const summaryText = getDeleteActionSummary(normalizedIntent, count, scopeLabel, targetLabel)
  return {
    intent: normalizedIntent,
    summaryText,
    confirmPrompt: getDeleteConfirmPrompt(normalizedIntent, count, targetLabel),
    scopeLabel,
    targetLabel,
    targetCount: count,
    paragraphIndex: normalizedIntent.paragraphIndex,
    changeSummary: [normalizedIntent.target === 'document' ? '清空全文' : `删除${targetLabel}`],
    canApply: count > 0
  }
}

export function executeDocumentDeleteAction(intent) {
  const normalizedIntent = normalizeDocumentDeleteIntent(intent)
  if (!normalizedIntent) {
    throw new Error('删除任务参数无效')
  }
  const { scopeLabel, targetLabel, targets } = resolveDeleteTargets(normalizedIntent)
  if (targets.length === 0) {
    throw new Error(`未找到可删除的${targetLabel}`)
  }
  const orderedTargets = sortDeleteTargets(targets)
  let deletedCount = 0
  orderedTargets.forEach((target) => {
    target.delete()
    deletedCount += 1
  })
  return {
    ok: true,
    deletedCount,
    scopeLabel,
    targetLabel,
    paragraphIndex: normalizedIntent.paragraphIndex,
    message: normalizedIntent.target === 'document'
      ? '已清空全文内容。'
      : normalizedIntent.target === 'paragraph-index'
        ? `已删除第 ${normalizedIntent.paragraphIndex} 段。`
        : normalizedIntent.target === 'paragraph'
          ? '已删除当前段落。'
          : normalizedIntent.target === 'selection'
            ? '已删除当前选中内容。'
            : `已从${scopeLabel}删除 ${deletedCount} 个${targetLabel}。`
  }
}
