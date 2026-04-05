import { getApplication } from './documentActions.js'

const SCOPE_LABELS = {
  selection: '当前选择的文字',
  paragraph: '当前段落',
  document: '全文'
}

const MATCH_MODE_LABELS = {
  plain: '普通匹配',
  'whole-word': '整词匹配',
  regex: '正则匹配'
}

const TARGET_UNIT_LABELS = {
  text: '关键词',
  paragraph: '段落'
}

const KEYWORD_RELATION_LABELS = {
  any: '任一关键词',
  all: '全部关键词'
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

function duplicateRange(range) {
  if (!range) return null
  try {
    return typeof range.Duplicate === 'function' ? range.Duplicate() : range
  } catch (_) {
    return range
  }
}

function normalizeScope(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (['selection', 'selected', 'selected-text', 'range'].includes(raw)) return 'selection'
  if (['paragraph', 'current-paragraph'].includes(raw)) return 'paragraph'
  if (['document', 'all', 'full-document', '全文'].includes(raw)) return 'document'
  return 'selection'
}

function normalizeMatchMode(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (['regex', 'regexp', 'regular-expression', '正则'].includes(raw)) return 'regex'
  if (['whole-word', 'wholeword', 'word', '整词'].includes(raw)) return 'whole-word'
  return 'plain'
}

function normalizeOperation(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (['delete', 'remove', '删', '删除'].includes(raw)) return 'delete'
  if (['replace', 'substitute', '替换'].includes(raw)) return 'replace'
  return ''
}

function normalizeText(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function toDocumentText(text) {
  return String(text || '').replace(/\r\n/g, '\r').replace(/\n/g, '\r')
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

function resolveScopeRange(scope) {
  const doc = getActiveDocument()
  if (!doc) {
    throw new Error('当前没有打开文档')
  }
  if (scope === 'document') {
    return {
      doc,
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
      label: SCOPE_LABELS.paragraph,
      range
    }
  }
  const selection = getSelection()
  const selectedText = normalizeText(selection?.Text || '').trim()
  const range = duplicateRange(getSelectionRange())
  if (!range || !selectedText) {
    throw new Error('请先选中需要处理的文字')
  }
  return {
    doc,
    label: SCOPE_LABELS.selection,
    range
  }
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildRegexFromIntent(keyword, options = {}) {
  const query = String(keyword || '')
  if (!query) return null
  const flags = options.caseSensitive ? 'g' : 'gi'
  if (options.matchMode === 'regex') {
    return new RegExp(query, flags)
  }
  if (options.matchMode === 'whole-word') {
    return new RegExp(`(^|[^A-Za-z0-9_])(${escapeRegex(query)})(?=$|[^A-Za-z0-9_])`, flags)
  }
  return new RegExp(escapeRegex(query), flags)
}

function buildMatchRanges(doc, scopeRange, keyword, options = {}) {
  const text = String(scopeRange?.Text || '')
  const query = String(keyword || '')
  if (!query) return []
  const baseStart = Number(scopeRange.Start || 0)
  const regex = buildRegexFromIntent(query, options)
  if (!regex) return []
  const matches = []
  let match = regex.exec(text)
  while (match) {
    const startOffset = options.matchMode === 'whole-word'
      ? match.index + String(match[1] || '').length
      : match.index
    const matchedText = options.matchMode === 'whole-word'
      ? String(match[2] || '')
      : String(match[0] || '')
    if (matchedText) {
      matches.push({
        start: baseStart + startOffset,
        end: baseStart + startOffset + matchedText.length,
        text: matchedText
      })
    }
    if (!regex.global) break
    match = regex.exec(text)
  }
  return matches
}

function describeSearchMode(intent = {}) {
  const parts = []
  if (intent.matchMode && intent.matchMode !== 'plain') {
    parts.push(MATCH_MODE_LABELS[intent.matchMode] || intent.matchMode)
  }
  if (intent.caseSensitive) {
    parts.push('区分大小写')
  }
  return parts
}

function sortMatchesDesc(matches = []) {
  return [...matches].sort((a, b) => Number(b.end || 0) - Number(a.end || 0))
}

function normalizeTargetUnit(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (['paragraph', 'para', '段落', 'matched-paragraph'].includes(raw)) return 'paragraph'
  return 'text'
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
  const list = source
    .map(item => String(item || '').trim())
    .filter(Boolean)
  if (list.length > 0) return list
  return searchText ? [searchText] : []
}

function getParagraphTargetsForMatches(doc, matches = []) {
  const unique = new Map()
  matches.forEach((match) => {
    try {
      const paragraphRange = duplicateRange(doc.Range(Number(match.start || 0), Number(match.end || 0))?.Paragraphs?.Item?.(1)?.Range)
      const start = Number(paragraphRange?.Start || 0)
      const end = Number(paragraphRange?.End || start)
      if (!paragraphRange || end <= start) return
      const key = `${start}:${end}`
      if (!unique.has(key)) {
        unique.set(key, {
          start,
          end,
          range: paragraphRange
        })
      }
    } catch (_) {
      // Ignore paragraphs that cannot be resolved from current match.
    }
  })
  return Array.from(unique.values())
}

function rangeIntersects(range, start, end) {
  const rangeStart = Number(range?.Start || 0)
  const rangeEnd = Number(range?.End || rangeStart)
  return rangeEnd >= start && rangeStart <= end
}

function buildKeywordRegexes(keywordList = [], caseSensitive = false) {
  return keywordList
    .map(keyword => buildRegexFromIntent(keyword, { matchMode: 'plain', caseSensitive }))
    .filter(Boolean)
}

function collectParagraphTargetsByKeywords(doc, scopeRange, keywordList = [], keywordRelation = 'any', caseSensitive = false) {
  const paragraphs = doc?.Paragraphs
  const total = Number(paragraphs?.Count || 0)
  if (!paragraphs || total <= 0 || keywordList.length === 0) return []
  const start = Number(scopeRange?.Start || 0)
  const end = Number(scopeRange?.End || start)
  const regexes = buildKeywordRegexes(keywordList, caseSensitive)
  const targets = []
  for (let i = 1; i <= total; i++) {
    try {
      const range = duplicateRange(paragraphs.Item(i)?.Range)
      const text = normalizeText(range?.Text || '').trim()
      if (!range || !text) continue
      if (!rangeIntersects(range, start, end)) continue
      const matchedCount = regexes.reduce((count, regex) => {
        regex.lastIndex = 0
        return count + (regex.test(text) ? 1 : 0)
      }, 0)
      const matched = keywordRelation === 'all'
        ? matchedCount === regexes.length
        : matchedCount > 0
      regexes.forEach((regex) => { regex.lastIndex = 0 })
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

function replaceParagraphTarget(doc, target, text) {
  const content = `${toDocumentText(text)}\r`
  doc.Range(Number(target.start || 0), Number(target.end || 0)).Text = content
}

export function normalizeDocumentTextEditIntent(rawIntent = {}) {
  if (!rawIntent || typeof rawIntent !== 'object') return null
  const intent = String(rawIntent.intent || rawIntent.type || '').trim().toLowerCase()
  if (intent && !['document-text-edit', 'text-edit', 'replace', 'delete'].includes(intent)) return null
  const operation = normalizeOperation(rawIntent.operation || rawIntent.action || rawIntent.editType || intent)
  const searchText = String(rawIntent.searchText || rawIntent.keyword || rawIntent.query || '').trim()
  const replacementText = String(rawIntent.replacementText ?? rawIntent.replaceText ?? rawIntent.toText ?? rawIntent.targetText ?? '').trim()
  const targetUnit = normalizeTargetUnit(rawIntent.targetUnit || rawIntent.targetType || rawIntent.applyTo)
  const keywordList = buildKeywordList(rawIntent, searchText)
  const keywordRelation = normalizeKeywordRelation(rawIntent.keywordRelation || rawIntent.keywordMode || rawIntent.matchRelation)
  const targetMode = normalizeTargetMode(rawIntent.targetMode || rawIntent.pickMode || rawIntent.selector)
  const limitCount = safeCount(rawIntent.limitCount || rawIntent.count || rawIntent.targetCount)
  if (!operation || !searchText) return null
  if (operation === 'replace' && replacementText === '') return null
  return {
    intent: 'document-text-edit',
    operation,
    scope: normalizeScope(rawIntent.scope || rawIntent.targetScope || rawIntent.rangeScope),
    searchText,
    keywordList,
    keywordRelation,
    replacementText,
    targetUnit,
    targetMode,
    limitCount,
    matchMode: normalizeMatchMode(rawIntent.matchMode || rawIntent.searchMode || rawIntent.searchType),
    caseSensitive: rawIntent.caseSensitive === true
  }
}

export function createDocumentTextEditPreview(intent) {
  const normalizedIntent = normalizeDocumentTextEditIntent(intent)
  if (!normalizedIntent) {
    throw new Error('未识别到可执行的关键词操作')
  }
  const { doc, label, range } = resolveScopeRange(normalizedIntent.scope)
  const matches = buildMatchRanges(doc, range, normalizedIntent.searchText, normalizedIntent)
  const paragraphTargets = normalizedIntent.targetUnit === 'paragraph'
    ? selectTargets(
        collectParagraphTargetsByKeywords(
          doc,
          range,
          normalizedIntent.keywordList,
          normalizedIntent.keywordRelation,
          normalizedIntent.caseSensitive
        ),
        normalizedIntent.targetMode,
        normalizedIntent.limitCount
      )
    : []
  const textTargets = normalizedIntent.targetUnit === 'text'
    ? selectTargets(matches, normalizedIntent.targetMode, normalizedIntent.limitCount)
    : []
  const targetCount = normalizedIntent.targetUnit === 'paragraph' ? paragraphTargets.length : textTargets.length
  const searchModeSummary = describeSearchMode(normalizedIntent)
  const keywordSummary = normalizedIntent.keywordList.length > 1
    ? `关键词关系：${KEYWORD_RELATION_LABELS[normalizedIntent.keywordRelation] || normalizedIntent.keywordRelation}`
    : ''
  const summaryText = normalizedIntent.targetUnit === 'paragraph'
    ? `${label}中共有 ${targetCount} 个命中段落${[...searchModeSummary, keywordSummary].filter(Boolean).length ? `（${[...searchModeSummary, keywordSummary].filter(Boolean).join('，')}）` : ''}。`
    : `${label}中共有 ${targetCount} 处与“${normalizedIntent.searchText}”匹配的结果${searchModeSummary.length ? `（${searchModeSummary.join('，')}）` : ''}。`
  const changeSummary = normalizedIntent.operation === 'delete'
    ? [normalizedIntent.targetUnit === 'paragraph' ? `删除命中段落` : `删除关键词“${normalizedIntent.searchText}”`]
    : [normalizedIntent.targetUnit === 'paragraph' ? `将命中段落替换为“${normalizedIntent.replacementText}”` : `将“${normalizedIntent.searchText}”替换为“${normalizedIntent.replacementText}”`]
  const confirmPrompt = normalizedIntent.operation === 'delete'
    ? `是否确认删除这 ${targetCount} 个${TARGET_UNIT_LABELS[normalizedIntent.targetUnit] || '对象'}？`
    : `是否确认替换这 ${targetCount} 个${TARGET_UNIT_LABELS[normalizedIntent.targetUnit] || '对象'}？`
  return {
    intent: normalizedIntent,
    summaryText,
    confirmPrompt,
    scopeLabel: label,
    searchText: normalizedIntent.searchText,
    keywordList: normalizedIntent.keywordList,
    keywordRelation: normalizedIntent.keywordRelation,
    replacementText: normalizedIntent.replacementText,
    targetUnit: normalizedIntent.targetUnit,
    targetMode: normalizedIntent.targetMode,
    limitCount: normalizedIntent.limitCount,
    matchMode: normalizedIntent.matchMode,
    caseSensitive: normalizedIntent.caseSensitive,
    matchCount: textTargets.length,
    targetCount,
    changeSummary,
    canApply: targetCount > 0
  }
}

export function executeDocumentTextEditAction(intent) {
  const normalizedIntent = normalizeDocumentTextEditIntent(intent)
  if (!normalizedIntent) {
    throw new Error('关键词操作参数无效')
  }
  const { doc, label, range } = resolveScopeRange(normalizedIntent.scope)
  const matches = buildMatchRanges(doc, range, normalizedIntent.searchText, normalizedIntent)
  const paragraphTargets = normalizedIntent.targetUnit === 'paragraph'
    ? selectTargets(
        collectParagraphTargetsByKeywords(
          doc,
          range,
          normalizedIntent.keywordList,
          normalizedIntent.keywordRelation,
          normalizedIntent.caseSensitive
        ),
        normalizedIntent.targetMode,
        normalizedIntent.limitCount
      )
    : []
  const textTargets = normalizedIntent.targetUnit === 'text'
    ? selectTargets(matches, normalizedIntent.targetMode, normalizedIntent.limitCount)
    : []
  const targets = normalizedIntent.targetUnit === 'paragraph' ? paragraphTargets : textTargets
  if (targets.length === 0) {
    throw new Error(`在${label}中没有找到“${normalizedIntent.searchText}”`)
  }
  if (normalizedIntent.targetUnit === 'paragraph') {
    [...paragraphTargets].sort((a, b) => Number(b.end || 0) - Number(a.end || 0)).forEach((target) => {
      if (normalizedIntent.operation === 'delete') {
        doc.Range(Number(target.start || 0), Number(target.end || 0)).Delete()
      } else {
        replaceParagraphTarget(doc, target, normalizedIntent.replacementText)
      }
    })
  } else {
    const replacement = normalizedIntent.operation === 'delete'
      ? ''
      : toDocumentText(normalizedIntent.replacementText)
    sortMatchesDesc(textTargets).forEach((match) => {
      doc.Range(Number(match.start || 0), Number(match.end || 0)).Text = replacement
    })
  }
  return {
    ok: true,
    operation: normalizedIntent.operation,
    appliedCount: targets.length,
    scopeLabel: label,
    searchText: normalizedIntent.searchText,
    keywordList: normalizedIntent.keywordList,
    keywordRelation: normalizedIntent.keywordRelation,
    replacementText: normalizedIntent.replacementText,
    targetUnit: normalizedIntent.targetUnit,
    targetMode: normalizedIntent.targetMode,
    limitCount: normalizedIntent.limitCount,
    message: normalizedIntent.operation === 'delete'
      ? normalizedIntent.targetUnit === 'paragraph'
        ? `已在${label}删除 ${targets.length} 个命中段落。`
        : `已在${label}删除 ${targets.length} 处“${normalizedIntent.searchText}”。`
      : normalizedIntent.targetUnit === 'paragraph'
        ? `已在${label}将 ${targets.length} 个命中段落替换为“${normalizedIntent.replacementText}”。`
        : `已在${label}将 ${targets.length} 处“${normalizedIntent.searchText}”替换为“${normalizedIntent.replacementText}”。`
  }
}
