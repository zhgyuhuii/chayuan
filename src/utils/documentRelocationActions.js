import { getApplication } from './documentActions.js'

const SOURCE_LABELS = {
  'paragraph-index': '指定段落',
  'current-paragraph': '当前段落',
  'paragraph-keyword': '命中段落'
}

const DESTINATION_LABELS = {
  'paragraph-index': '指定段落',
  'current-paragraph': '当前段落',
  'document-start': '文首',
  'document-end': '文末'
}

const KEYWORD_RELATION_LABELS = {
  any: '任一关键词',
  all: '全部关键词'
}

function getActiveDocument() {
  return getApplication()?.ActiveDocument || null
}

function duplicateRange(range) {
  if (!range) return null
  try {
    return typeof range.Duplicate === 'function' ? range.Duplicate() : range
  } catch (_) {
    return range
  }
}

function parseNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeText(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function toDocumentText(text) {
  return String(text || '').replace(/\r\n/g, '\r').replace(/\n/g, '\r')
}

function normalizeScope(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (['document', 'all', 'full-document', '全文'].includes(raw)) return 'document'
  if (['paragraph', 'current-paragraph'].includes(raw)) return 'paragraph'
  return 'document'
}

function normalizeOperation(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (['move', 'relocate', '移动'].includes(raw)) return 'move'
  if (['copy', 'duplicate', '复制', '拷贝'].includes(raw)) return 'copy'
  return ''
}

function normalizePreserveFormatting(value) {
  if (value === false) return false
  const raw = String(value ?? '').trim().toLowerCase()
  if (['false', '0', 'no', 'plain-text', 'plaintext', '纯文本', '文本'].includes(raw)) return false
  return true
}

function normalizePlaceholderText(value) {
  return String(value ?? '').trim()
}

function normalizePlacement(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (['after', '后', '后面', '之后'].includes(raw)) return 'after'
  return 'before'
}

function normalizeSourceType(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (['paragraph-index', 'paragraph_index', 'index'].includes(raw)) return 'paragraph-index'
  if (['current-paragraph', 'current_paragraph', 'paragraph'].includes(raw)) return 'current-paragraph'
  if (['paragraph-keyword', 'paragraph_keyword', 'keyword-paragraph'].includes(raw)) return 'paragraph-keyword'
  return ''
}

function normalizeKeywordRelation(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (['all', 'and', '全部', '都包含', '同时包含'].includes(raw)) return 'all'
  return 'any'
}

function normalizeTargetMode(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (['first', 'first-n', 'first_n', '前', '最前'].includes(raw)) return 'first'
  if (['last', 'last-n', 'last_n', '后', '最后'].includes(raw)) return 'last'
  return 'all'
}

function safeCount(value) {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? Math.max(1, Math.floor(count)) : null
}

function buildKeywordList(rawIntent = {}, searchText = '') {
  const source = Array.isArray(rawIntent.keywordList)
    ? rawIntent.keywordList
    : Array.isArray(rawIntent.searchTerms)
      ? rawIntent.searchTerms
      : []
  const list = source.map(item => String(item || '').trim()).filter(Boolean)
  if (list.length > 0) return list
  return searchText ? [searchText] : []
}

function normalizeDestinationType(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (['paragraph-index', 'paragraph_index', 'index'].includes(raw)) return 'paragraph-index'
  if (['current-paragraph', 'current_paragraph', 'paragraph'].includes(raw)) return 'current-paragraph'
  if (['document-start', 'start', 'doc-start', '文首'].includes(raw)) return 'document-start'
  if (['document-end', 'end', 'doc-end', '文末'].includes(raw)) return 'document-end'
  return ''
}

function getCurrentParagraphRange() {
  const selection = getApplication()?.Selection
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

function getParagraphRangeByIndex(doc, index) {
  const paragraphs = doc?.Paragraphs
  const total = Number(paragraphs?.Count || 0)
  if (!paragraphs || total <= 0) {
    throw new Error('文档中没有可处理的段落')
  }
  if (!Number.isFinite(index) || index < 1 || index > total) {
    throw new Error(`文档共有 ${total} 段，无法定位第 ${index} 段`)
  }
  return duplicateRange(paragraphs.Item(index)?.Range)
}

function getParagraphIndexByRange(doc, targetRange) {
  const paragraphs = doc?.Paragraphs
  const total = Number(paragraphs?.Count || 0)
  const start = Number(targetRange?.Start || -1)
  if (!paragraphs || total <= 0 || start < 0) return null
  for (let i = 1; i <= total; i++) {
    try {
      const range = paragraphs.Item(i)?.Range
      if (Number(range?.Start || -2) === start) return i
    } catch (_) {}
  }
  return null
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildRegex(keyword, caseSensitive = false) {
  const query = String(keyword || '').trim()
  if (!query) return null
  return new RegExp(escapeRegex(query), caseSensitive ? 'g' : 'gi')
}

function getParagraphTargetsByKeywords(doc, keywordList = [], keywordRelation = 'any', caseSensitive = false) {
  const paragraphs = doc?.Paragraphs
  const total = Number(paragraphs?.Count || 0)
  if (!paragraphs || total <= 0 || keywordList.length === 0) return []
  const regexes = keywordList.map(keyword => buildRegex(keyword, caseSensitive)).filter(Boolean)
  if (regexes.length === 0) return []
  const targets = []
  for (let i = 1; i <= total; i++) {
    try {
      const range = duplicateRange(paragraphs.Item(i)?.Range)
      const text = normalizeText(range?.Text || '').trim()
      if (!text) continue
      const matchedCount = regexes.reduce((count, regex) => {
        regex.lastIndex = 0
        return count + (regex.test(text) ? 1 : 0)
      }, 0)
      const matched = keywordRelation === 'all'
        ? matchedCount === regexes.length
        : matchedCount > 0
      regexes.forEach(regex => { regex.lastIndex = 0 })
      if (!matched) continue
      targets.push({
        index: i,
        start: Number(range?.Start || 0),
        end: Number(range?.End || 0),
        text: String(range?.Text || ''),
        range
      })
    } catch (_) {
      continue
    }
  }
  return targets
}

function sortTargetsDesc(targets = []) {
  return [...targets].sort((a, b) => Number(b.start || 0) - Number(a.start || 0))
}

function countTargetsBeforeIndex(targets = [], index) {
  return targets.filter(item => Number(item.index || 0) < Number(index || 0)).length
}

function buildSourceText(targets = []) {
  return targets.map(item => String(item.text || '')).join('')
}

function getSourceTextLength(targets = []) {
  return targets.reduce((sum, item) => sum + String(item?.text || '').length, 0)
}

function selectTargets(targets = [], targetMode = 'all', limitCount = null) {
  if (!Array.isArray(targets) || targets.length === 0) return []
  const limit = safeCount(limitCount)
  if (targetMode === 'first') {
    return targets.slice(0, limit || 1)
  }
  if (targetMode === 'last') {
    const amount = limit || 1
    return targets.slice(Math.max(0, targets.length - amount))
  }
  if (limit) {
    return targets.slice(0, limit)
  }
  return targets
}

function insertTextAt(doc, position, text) {
  const range = doc.Range(Number(position || 0), Number(position || 0))
  range.Text = String(text || '')
}

function buildPlaceholderParagraphText(text) {
  const content = toDocumentText(text)
  return content ? `${content}\r` : '\r'
}

function insertFormattedTargetsAt(doc, position, targets = []) {
  let cursor = Number(position || 0)
  targets.forEach((target) => {
    const sourceRange = duplicateRange(target?.range)
    const insertionRange = doc.Range(cursor, cursor)
    if (!sourceRange || sourceRange.FormattedText == null) {
      throw new Error('当前环境不支持富文本段落复制')
    }
    insertionRange.FormattedText = sourceRange.FormattedText
    cursor = Number(insertionRange.End || cursor)
  })
  return {
    insertedLength: getSourceTextLength(targets),
    usedFormattedText: true
  }
}

function insertSourceContentAt(doc, position, targets = [], preserveFormatting = true) {
  if (preserveFormatting) {
    try {
      return insertFormattedTargetsAt(doc, position, targets)
    } catch (_) {
      // Fall back to plain text insertion when formatted insertion is unsupported.
    }
  }
  const text = buildSourceText(targets)
  insertTextAt(doc, position, text)
  return {
    insertedLength: text.length,
    usedFormattedText: false
  }
}

function getAdjustedTargetRange(doc, target, insertPosition, insertedLength) {
  const start = Number(target?.start || 0)
  const end = Number(target?.end || start)
  const shift = start >= Number(insertPosition || 0) ? Number(insertedLength || 0) : 0
  return doc.Range(start + shift, end + shift)
}

function rewriteOriginalTargets(doc, targets = [], insertPosition, insertedLength, placeholderText = '') {
  const replacementText = normalizePlaceholderText(placeholderText)
  sortTargetsDesc(targets).forEach((target) => {
    const range = getAdjustedTargetRange(doc, target, insertPosition, insertedLength)
    if (replacementText) {
      range.Text = buildPlaceholderParagraphText(replacementText)
      return
    }
    range.Delete()
  })
}

function getDestinationParagraphIndex(doc, destinationType, destinationIndex) {
  if (destinationType === 'paragraph-index') return Number(destinationIndex || 0) || null
  if (destinationType !== 'current-paragraph') return null
  const currentRange = getCurrentParagraphRange()
  return currentRange ? getParagraphIndexByRange(doc, currentRange) : null
}

function isDestinationInsideSourceTargets(doc, intent, sourceTargets = []) {
  const sourceIndices = sourceTargets.map(item => Number(item.index || 0)).filter(Boolean)
  if (sourceIndices.length === 0) return false
  const destinationParagraphIndex = getDestinationParagraphIndex(doc, intent.destinationType, intent.destinationIndex)
  return destinationParagraphIndex != null && sourceIndices.includes(Number(destinationParagraphIndex))
}

function getDestinationPoint(doc, destinationType, destinationIndex, placement) {
  if (destinationType === 'document-start') {
    return {
      label: DESTINATION_LABELS['document-start'],
      position: 0
    }
  }
  if (destinationType === 'document-end') {
    return {
      label: DESTINATION_LABELS['document-end'],
      position: Number(doc?.Content?.End || 0)
    }
  }
  const range = destinationType === 'current-paragraph'
    ? getCurrentParagraphRange()
    : getParagraphRangeByIndex(doc, destinationIndex)
  if (!range) {
    throw new Error('无法定位目标段落')
  }
  return {
    label: destinationType === 'current-paragraph'
      ? DESTINATION_LABELS['current-paragraph']
      : `第 ${destinationIndex} 段${placement === 'after' ? '后' : '前'}`,
    position: placement === 'after' ? Number(range.End || 0) : Number(range.Start || 0),
    paragraphIndex: destinationType === 'current-paragraph' ? getParagraphIndexByRange(doc, range) : destinationIndex
  }
}

function resolveSourceTargets(doc, intent) {
  if (intent.sourceType === 'paragraph-index') {
    const range = getParagraphRangeByIndex(doc, intent.sourceIndex)
    return [{
      index: Number(intent.sourceIndex || 0),
      start: Number(range?.Start || 0),
      end: Number(range?.End || 0),
      text: String(range?.Text || ''),
      range
    }]
  }
  if (intent.sourceType === 'current-paragraph') {
    const range = getCurrentParagraphRange()
    if (!range) {
      throw new Error('无法获取当前段落，请先把光标放到需要移动或复制的段落内')
    }
    return [{
      index: Number(getParagraphIndexByRange(doc, range) || 0),
      start: Number(range?.Start || 0),
      end: Number(range?.End || 0),
      text: String(range?.Text || ''),
      range
    }]
  }
  if (intent.sourceType === 'paragraph-keyword') {
    return selectTargets(
      getParagraphTargetsByKeywords(doc, intent.keywordList, intent.keywordRelation, intent.caseSensitive),
      intent.targetMode,
      intent.limitCount
    )
  }
  return []
}

export function normalizeDocumentRelocationIntent(rawIntent = {}) {
  if (!rawIntent || typeof rawIntent !== 'object') return null
  const intent = String(rawIntent.intent || rawIntent.type || '').trim().toLowerCase()
  if (intent && !['document-relocation', 'relocation', 'move', 'copy'].includes(intent)) return null
  const operation = normalizeOperation(rawIntent.operation || rawIntent.action || intent)
  const sourceType = normalizeSourceType(rawIntent.sourceType || rawIntent.source || rawIntent.fromType)
  const destinationType = normalizeDestinationType(rawIntent.destinationType || rawIntent.destination || rawIntent.toType)
  const sourceIndex = parseNumber(rawIntent.sourceIndex || rawIntent.fromIndex)
  const destinationIndex = parseNumber(rawIntent.destinationIndex || rawIntent.toIndex)
  const searchText = String(rawIntent.searchText || rawIntent.keyword || '').trim()
  const keywordList = buildKeywordList(rawIntent, searchText)
  const keywordRelation = normalizeKeywordRelation(rawIntent.keywordRelation || rawIntent.keywordMode || rawIntent.matchRelation)
  const targetMode = normalizeTargetMode(rawIntent.targetMode || rawIntent.pickMode || rawIntent.selector)
  const limitCount = safeCount(rawIntent.limitCount || rawIntent.count || rawIntent.targetCount)
  const placement = normalizePlacement(rawIntent.placement || rawIntent.position)
  if (!operation || !sourceType || !destinationType) return null
  if (sourceType === 'paragraph-index' && (!Number.isFinite(sourceIndex) || sourceIndex < 1)) return null
  if (destinationType === 'paragraph-index' && (!Number.isFinite(destinationIndex) || destinationIndex < 1)) return null
  if (sourceType === 'paragraph-keyword' && keywordList.length === 0) return null
  return {
    intent: 'document-relocation',
    operation,
    scope: normalizeScope(rawIntent.scope),
    sourceType,
    sourceIndex: sourceType === 'paragraph-index' ? Number(sourceIndex) : null,
    searchText: sourceType === 'paragraph-keyword' ? searchText : '',
    keywordList: sourceType === 'paragraph-keyword' ? keywordList : [],
    keywordRelation,
    targetMode,
    limitCount,
    caseSensitive: rawIntent.caseSensitive === true,
    placeholderText: normalizePlaceholderText(rawIntent.placeholderText || rawIntent.originPlaceholderText),
    preserveFormatting: normalizePreserveFormatting(rawIntent.preserveFormatting),
    destinationType,
    destinationIndex: destinationType === 'paragraph-index' ? Number(destinationIndex) : null,
    placement
  }
}

export function createDocumentRelocationPreview(intent) {
  const normalizedIntent = normalizeDocumentRelocationIntent(intent)
  if (!normalizedIntent) {
    throw new Error('未识别到可执行的移动或复制操作')
  }
  const doc = getActiveDocument()
  if (!doc) throw new Error('当前没有打开文档')
  const sourceTargets = resolveSourceTargets(doc, normalizedIntent)
  const destinationPoint = getDestinationPoint(
    doc,
    normalizedIntent.destinationType,
    normalizedIntent.destinationIndex,
    normalizedIntent.placement
  )
  const sourceLabel = normalizedIntent.sourceType === 'paragraph-index'
    ? `第 ${normalizedIntent.sourceIndex} 段`
    : normalizedIntent.sourceType === 'current-paragraph'
      ? SOURCE_LABELS['current-paragraph']
      : normalizedIntent.keywordList.length > 1
        ? `命中关键词条件的段落`
        : `包含“${normalizedIntent.searchText}”的段落`
  const actionLabel = normalizedIntent.operation === 'move' ? '移动' : '复制'
  const extraSummary = normalizedIntent.sourceType === 'paragraph-keyword' && normalizedIntent.keywordList.length > 1
    ? `（${KEYWORD_RELATION_LABELS[normalizedIntent.keywordRelation] || normalizedIntent.keywordRelation}）`
    : ''
  const previewNotes = []
  if (normalizedIntent.placeholderText) {
    previewNotes.push(`原位置替换为“${normalizedIntent.placeholderText}”`)
  }
  if (!normalizedIntent.preserveFormatting) {
    previewNotes.push('按纯文本插入')
  }
  return {
    intent: normalizedIntent,
    scopeLabel: '段落级操作',
    sourceLabel,
    destinationLabel: destinationPoint.label,
    targetCount: sourceTargets.length,
    changeSummary: [`${actionLabel}${sourceLabel}`, `${actionLabel}到${destinationPoint.label}`, ...previewNotes],
    summaryText: `${sourceLabel}${extraSummary}共命中 ${sourceTargets.length} 段，将${actionLabel}到${destinationPoint.label}。${previewNotes.length ? previewNotes.join('，') + '。' : ''}`,
    confirmPrompt: `是否确认${actionLabel}${sourceTargets.length} 段内容？`,
    canApply: sourceTargets.length > 0
  }
}

export function executeDocumentRelocationAction(intent) {
  const normalizedIntent = normalizeDocumentRelocationIntent(intent)
  if (!normalizedIntent) {
    throw new Error('移动或复制参数无效')
  }
  const doc = getActiveDocument()
  if (!doc) throw new Error('当前没有打开文档')
  const sourceTargets = resolveSourceTargets(doc, normalizedIntent)
  if (sourceTargets.length === 0) {
    throw new Error('未找到可移动或复制的段落')
  }
  if (
    normalizedIntent.operation === 'move' &&
    isDestinationInsideSourceTargets(doc, normalizedIntent, sourceTargets)
  ) {
    return {
      ok: true,
      movedCount: 0,
      operation: normalizedIntent.operation,
      message: '目标位置位于待移动段落内部，未执行移动。'
    }
  }
  const destinationPoint = getDestinationPoint(
    doc,
    normalizedIntent.destinationType,
    normalizedIntent.destinationIndex,
    normalizedIntent.placement
  )
  const insertResult = insertSourceContentAt(
    doc,
    destinationPoint.position,
    sourceTargets,
    normalizedIntent.preserveFormatting
  )
  if (normalizedIntent.operation === 'move' || normalizedIntent.placeholderText) {
    rewriteOriginalTargets(
      doc,
      sourceTargets,
      destinationPoint.position,
      insertResult.insertedLength,
      normalizedIntent.placeholderText
    )
  }

  const messageParts = [
    normalizedIntent.operation === 'move'
      ? `已将 ${sourceTargets.length} 段内容移动到${destinationPoint.label}。`
      : `已将 ${sourceTargets.length} 段内容复制到${destinationPoint.label}。`
  ]
  if (normalizedIntent.placeholderText) {
    messageParts.push(`原位置已替换为“${normalizedIntent.placeholderText}”。`)
  }
  if (normalizedIntent.preserveFormatting && !insertResult.usedFormattedText) {
    messageParts.push('当前环境未能保留原格式，已按纯文本插入。')
  }
  return {
    ok: true,
    movedCount: sourceTargets.length,
    operation: normalizedIntent.operation,
    message: messageParts.join('')
  }
}
