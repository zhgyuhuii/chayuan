import { getApplication } from './documentActions.js'

const SCOPE_LABELS = {
  selection: '当前选择的文字',
  paragraph: '当前段落',
  document: '全文'
}

const COLOR_NAME_MAP = {
  黑色: '#000000',
  黑: '#000000',
  白色: '#FFFFFF',
  白: '#FFFFFF',
  红色: '#FF0000',
  红: '#FF0000',
  蓝色: '#0000FF',
  蓝: '#0000FF',
  绿色: '#00AA00',
  绿: '#00AA00',
  黄色: '#FFFF00',
  黄: '#FFFF00',
  橙色: '#FFA500',
  橙: '#FFA500',
  紫色: '#800080',
  紫: '#800080',
  灰色: '#808080',
  灰: '#808080',
  灰黑: '#4B5563',
  粉色: '#FF69B4',
  粉: '#FF69B4',
  青色: '#00FFFF',
  青: '#00FFFF',
  棕色: '#8B4513',
  棕: '#8B4513'
}

const HIGHLIGHT_COLOR_INDEX_MAP = {
  '#000000': 1,
  '#0000FF': 2,
  '#00FFFF': 3,
  '#00AA00': 4,
  '#FF00FF': 5,
  '#FF0000': 6,
  '#FFFF00': 7,
  '#FFFFFF': 8,
  '#000080': 9,
  '#008080': 10,
  '#008000': 11,
  '#800080': 12,
  '#800000': 13,
  '#808000': 14,
  '#808080': 15,
  '#C0C0C0': 16
}

const ALIGNMENT_VALUE_MAP = {
  left: 0,
  center: 1,
  right: 2,
  justify: 3
}

const MATCH_MODE_LABELS = {
  plain: '普通匹配',
  'whole-word': '整词匹配',
  regex: '正则匹配'
}

const HEADING_LEVEL_LABELS = {
  1: '一级标题',
  2: '二级标题',
  3: '三级标题',
  4: '四级标题',
  5: '五级标题',
  6: '六级标题'
}

function normalizeText(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
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

function normalizeBooleanValue(value) {
  if (value == null || value === '') return null
  if (typeof value === 'boolean') return value
  const raw = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'on', 'enable', 'enabled', 'bold', '加粗', '是'].includes(raw)) return true
  if (['false', '0', 'no', 'off', 'disable', 'disabled', 'normal', '取消加粗', '否'].includes(raw)) return false
  return null
}

function normalizeTargetSelector(rawTarget = {}) {
  const source = rawTarget && typeof rawTarget === 'object' ? rawTarget : {}
  const kind = String(
    source.kind ||
    source.type ||
    source.targetType ||
    ''
  ).trim().toLowerCase()
  if (!kind) return null
  const normalizedKind = ['heading', 'body', 'table-cell', 'table', 'style-name'].includes(kind)
    ? kind
    : ''
  if (!normalizedKind) return null
  const level = safeNumber(source.level ?? source.headingLevel)
  const styleName = String(source.styleName || '').trim()
  return {
    kind: normalizedKind,
    level: Number.isFinite(level) && level > 0 ? Number(level) : null,
    styleName
  }
}

function normalizeColorValue(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const alias = COLOR_NAME_MAP[raw]
  if (alias) return alias
  const normalized = raw.startsWith('#') ? raw : `#${raw}`
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toUpperCase()
  }
  return ''
}

function hexToOfficeColor(value) {
  const normalized = normalizeColorValue(value)
  if (!normalized) return null
  const r = Number.parseInt(normalized.slice(1, 3), 16)
  const g = Number.parseInt(normalized.slice(3, 5), 16)
  const b = Number.parseInt(normalized.slice(5, 7), 16)
  return r + (g << 8) + (b << 16)
}

function getHighlightColorIndex(value) {
  const normalized = normalizeColorValue(value)
  if (!normalized) return null
  return HIGHLIGHT_COLOR_INDEX_MAP[normalized] ?? null
}

function safeNumber(value) {
  if (value == null) return null
  if (typeof value === 'string' && String(value).trim() === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeAlignment(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (['left', '左对齐', '居左', '左'].includes(raw)) return 'left'
  if (['center', '居中', '居中对齐', '中间对齐'].includes(raw)) return 'center'
  if (['right', '右对齐', '居右', '右'].includes(raw)) return 'right'
  if (['justify', '两端对齐'].includes(raw)) return 'justify'
  return ''
}

function normalizeLineSpacing(lineSpacing) {
  if (lineSpacing == null || lineSpacing === '') return null
  if (typeof lineSpacing === 'number') {
    return { mode: 'multiple', value: lineSpacing }
  }
  if (typeof lineSpacing === 'string') {
    const raw = lineSpacing.trim().toLowerCase()
    if (!raw) return null
    if (raw === 'single' || raw === '单倍') return { mode: 'multiple', value: 1 }
    if (raw === '1.5' || raw === '1.5倍' || raw === 'one-half' || raw === 'oneandhalf') {
      return { mode: 'multiple', value: 1.5 }
    }
    if (raw === 'double' || raw === '双倍') return { mode: 'multiple', value: 2 }
    const numeric = safeNumber(raw)
    return numeric == null ? null : { mode: 'multiple', value: numeric }
  }
  if (typeof lineSpacing === 'object') {
    const mode = String(lineSpacing.mode || lineSpacing.type || 'multiple').trim().toLowerCase()
    const value = safeNumber(lineSpacing.value)
    if (value == null) return null
    return {
      mode: mode === 'fixed' ? 'fixed' : 'multiple',
      value
    }
  }
  return null
}

export function normalizeDocumentFormatIntent(rawIntent = {}) {
  if (!rawIntent || typeof rawIntent !== 'object') return null
  const styleSource = rawIntent.styleChanges && typeof rawIntent.styleChanges === 'object'
    ? rawIntent.styleChanges
    : {}
  const fontName = String(
    styleSource.fontName ||
    styleSource.fontFamily ||
    rawIntent.fontName ||
    rawIntent.fontFamily ||
    ''
  ).trim()
  const intent = String(rawIntent.intent || rawIntent.type || '').trim().toLowerCase()
  const searchText = String(
    rawIntent.searchText ||
    rawIntent.keyword ||
    rawIntent.query ||
    styleSource.searchText ||
    ''
  ).trim()
  const normalized = {
    intent: intent || 'document-format',
    scope: normalizeScope(rawIntent.scope || rawIntent.targetScope || rawIntent.rangeScope),
    searchText,
    targetSelector: normalizeTargetSelector(
      rawIntent.targetSelector ||
      rawIntent.target ||
      (rawIntent.targetKind || rawIntent.headingLevel || rawIntent.styleName
        ? {
            kind: rawIntent.targetKind,
            level: rawIntent.headingLevel,
            styleName: rawIntent.styleName
          }
        : null)
    ),
    caseSensitive: rawIntent.caseSensitive === true,
    matchMode: normalizeMatchMode(rawIntent.matchMode || rawIntent.searchMode || rawIntent.searchType),
    styleChanges: {
      bold: normalizeBooleanValue(styleSource.bold ?? rawIntent.bold),
      italic: normalizeBooleanValue(styleSource.italic ?? rawIntent.italic),
      underline: normalizeBooleanValue(styleSource.underline ?? rawIntent.underline),
      fontName,
      fontSize: safeNumber(styleSource.fontSize ?? rawIntent.fontSize),
      fontColor: normalizeColorValue(styleSource.fontColor ?? styleSource.color ?? rawIntent.fontColor ?? rawIntent.color),
      backgroundColor: normalizeColorValue(
        styleSource.backgroundColor ??
        styleSource.highlightColor ??
        rawIntent.backgroundColor ??
        rawIntent.highlightColor
      ),
      lineSpacing: normalizeLineSpacing(styleSource.lineSpacing ?? rawIntent.lineSpacing),
      alignment: normalizeAlignment(styleSource.alignment ?? rawIntent.alignment),
      firstLineIndent: safeNumber(styleSource.firstLineIndent ?? rawIntent.firstLineIndent),
      spaceBefore: safeNumber(styleSource.spaceBefore ?? rawIntent.spaceBefore),
      spaceAfter: safeNumber(styleSource.spaceAfter ?? rawIntent.spaceAfter)
    }
  }
  const hasStyleChanges = hasAnyStyleChanges(normalized.styleChanges)
  if (normalized.intent && !['document-format', 'format', 'style'].includes(normalized.intent)) return null
  if (!normalized.searchText && !normalized.targetSelector && !hasStyleChanges) return null
  return {
    ...normalized,
    hasStyleChanges
  }
}

function hasAnyStyleChanges(styleChanges = {}) {
  return styleChanges.bold != null ||
    styleChanges.italic != null ||
    styleChanges.underline != null ||
    !!styleChanges.fontName ||
    safeNumber(styleChanges.fontSize) != null ||
    !!styleChanges.fontColor ||
    !!styleChanges.backgroundColor ||
    !!styleChanges.lineSpacing ||
    !!styleChanges.alignment ||
    safeNumber(styleChanges.firstLineIndent) != null ||
    safeNumber(styleChanges.spaceBefore) != null ||
    safeNumber(styleChanges.spaceAfter) != null
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

function resolveScopeRange(scope, fixedRange = null) {
  const doc = getActiveDocument()
  if (!doc) {
    throw new Error('当前没有打开文档')
  }
  if (fixedRange && Number.isFinite(Number(fixedRange.start)) && Number.isFinite(Number(fixedRange.end))) {
    return {
      doc,
      scope,
      label: SCOPE_LABELS[scope] || '当前范围',
      range: doc.Range(Number(fixedRange.start), Number(fixedRange.end))
    }
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
  const selection = getSelection()
  const selectedText = normalizeText(selection?.Text || '').trim()
  const range = duplicateRange(getSelectionRange())
  if (!range || !selectedText) {
    throw new Error('请先选中需要处理的文字')
  }
  return {
    doc,
    scope: 'selection',
    label: SCOPE_LABELS.selection,
    range
  }
}

function getRangeCoordinates(range) {
  return {
    start: Number(range?.Start || 0),
    end: Number(range?.End || 0)
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
      matches.push(doc.Range(baseStart + startOffset, baseStart + startOffset + matchedText.length))
    }
    if (!regex.global) break
    match = regex.exec(text)
  }
  return matches
}

function rangeIntersects(range, start, end) {
  if (!range) return false
  const rangeStart = Number(range.Start || 0)
  const rangeEnd = Number(range.End || rangeStart)
  return rangeEnd >= start && rangeStart <= end
}

function getParagraphStyleName(paragraph) {
  try {
    return String(paragraph?.Style?.NameLocal || paragraph?.Style?.Name || paragraph?.Range?.Style?.NameLocal || paragraph?.Range?.Style?.Name || '').trim()
  } catch (_) {
    return ''
  }
}

function parseHeadingLevelFromStyleName(styleName) {
  const text = String(styleName || '').trim()
  if (!text) return null
  const numeric = text.match(/(?:标题|heading)\s*([1-9])/i)
  if (numeric?.[1]) return Number(numeric[1])
  const chinese = text.match(/标题\s*([一二三四五六七八九])/)
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  return chinese?.[1] ? map[chinese[1]] || null : null
}

function isHeadingParagraph(paragraph, level = null) {
  const styleName = getParagraphStyleName(paragraph)
  const normalized = styleName.toLowerCase()
  const headingLevel = parseHeadingLevelFromStyleName(styleName)
  const matched = normalized.includes('标题') || normalized.includes('heading')
  if (!matched) return false
  if (level == null) return true
  return headingLevel === Number(level)
}

function isParagraphInTable(paragraph) {
  try {
    return Number(paragraph?.Range?.Cells?.Count || 0) > 0
  } catch (_) {
    return false
  }
}

function collectParagraphRanges(doc, scopeRange, predicate) {
  const paragraphs = doc?.Paragraphs
  const total = Number(paragraphs?.Count || 0)
  if (!paragraphs || total <= 0) return []
  const ranges = []
  for (let i = 1; i <= total; i++) {
    try {
      const paragraph = paragraphs.Item(i)
      const range = duplicateRange(paragraph?.Range)
      if (!range) continue
      if (!rangeIntersects(range, Number(scopeRange?.Start || 0), Number(scopeRange?.End || 0))) continue
      if (!predicate(paragraph, range)) continue
      ranges.push(range)
    } catch (_) {
      continue
    }
  }
  return ranges
}

function collectTableCellRanges(doc, scopeRange) {
  const tables = doc?.Tables
  const tableCount = Number(tables?.Count || 0)
  if (!tables || tableCount <= 0) return []
  const ranges = []
  for (let i = 1; i <= tableCount; i++) {
    try {
      const table = tables.Item(i)
      const rows = table?.Rows
      const rowCount = Number(rows?.Count || 0)
      for (let rowIndex = 1; rowIndex <= rowCount; rowIndex++) {
        const row = rows.Item(rowIndex)
        const cells = row?.Cells
        const cellCount = Number(cells?.Count || 0)
        for (let cellIndex = 1; cellIndex <= cellCount; cellIndex++) {
          const cell = cells.Item(cellIndex)
          const cellRange = duplicateRange(cell?.Range)
          if (!cellRange) continue
          if (!rangeIntersects(cellRange, Number(scopeRange?.Start || 0), Number(scopeRange?.End || 0))) continue
          ranges.push(cellRange)
        }
      }
    } catch (_) {
      continue
    }
  }
  return ranges
}

function buildTargetSelectorRanges(doc, scopeRange, targetSelector) {
  const selector = normalizeTargetSelector(targetSelector)
  if (!selector) return []
  if (selector.kind === 'heading') {
    return collectParagraphRanges(doc, scopeRange, (paragraph) => isHeadingParagraph(paragraph, selector.level))
  }
  if (selector.kind === 'body') {
    return collectParagraphRanges(doc, scopeRange, (paragraph, range) => {
      const text = normalizeText(range?.Text || '').trim()
      if (!text) return false
      return !isHeadingParagraph(paragraph) && !isParagraphInTable(paragraph)
    })
  }
  if (selector.kind === 'table-cell') {
    return collectTableCellRanges(doc, scopeRange)
  }
  if (selector.kind === 'table') {
    const tables = doc?.Tables
    const tableCount = Number(tables?.Count || 0)
    const ranges = []
    for (let i = 1; i <= tableCount; i++) {
      try {
        const tableRange = duplicateRange(tables.Item(i)?.Range)
        if (!tableRange) continue
        if (!rangeIntersects(tableRange, Number(scopeRange?.Start || 0), Number(scopeRange?.End || 0))) continue
        ranges.push(tableRange)
      } catch (_) {
        continue
      }
    }
    return ranges
  }
  if (selector.kind === 'style-name' && selector.styleName) {
    const expected = selector.styleName.toLowerCase()
    return collectParagraphRanges(doc, scopeRange, (paragraph) => getParagraphStyleName(paragraph).toLowerCase().includes(expected))
  }
  return []
}

function getTargetSelectorLabel(targetSelector) {
  const selector = normalizeTargetSelector(targetSelector)
  if (!selector) return ''
  if (selector.kind === 'heading') {
    return selector.level ? (HEADING_LEVEL_LABELS[selector.level] || `${selector.level}级标题`) : '标题'
  }
  if (selector.kind === 'body') return '正文段落'
  if (selector.kind === 'table-cell') return '表格单元格'
  if (selector.kind === 'table') return '表格'
  if (selector.kind === 'style-name') return selector.styleName ? `样式“${selector.styleName}”` : '指定样式'
  return ''
}

function buildResolvedTargetRanges(doc, scopeRange, intent) {
  const structuralRanges = intent?.targetSelector
    ? buildTargetSelectorRanges(doc, scopeRange, intent.targetSelector)
    : []
  if (intent?.searchText) {
    const bases = structuralRanges.length > 0 ? structuralRanges : [scopeRange]
    const matches = []
    bases.forEach((baseRange) => {
      matches.push(...buildMatchRanges(doc, baseRange, intent.searchText, intent))
    })
    return matches
  }
  if (structuralRanges.length > 0) return structuralRanges
  return [scopeRange]
}

function uniqueParagraphRanges(ranges = []) {
  const unique = new Map()
  ranges.forEach((range) => {
    try {
      const paragraphRange = duplicateRange(range?.Paragraphs?.Item?.(1)?.Range)
      const start = Number(paragraphRange?.Start || 0)
      const end = Number(paragraphRange?.End || start)
      const key = `${start}:${end}`
      if (paragraphRange && !unique.has(key)) {
        unique.set(key, paragraphRange)
      }
    } catch (_) {
      // Ignore ranges that cannot resolve their paragraph container.
    }
  })
  return Array.from(unique.values())
}

function applyCharacterStyle(range, styleChanges) {
  const font = range?.Font
  if (font) {
    if (styleChanges.bold != null) font.Bold = styleChanges.bold ? 1 : 0
    if (styleChanges.italic != null) font.Italic = styleChanges.italic ? 1 : 0
    if (styleChanges.underline != null) font.Underline = styleChanges.underline ? 1 : 0
    if (styleChanges.fontName) {
      font.Name = styleChanges.fontName
      try {
        if (typeof font.NameFarEast !== 'undefined') {
          font.NameFarEast = styleChanges.fontName
        }
      } catch (_) {
        // Some environments do not expose NameFarEast.
      }
    }
    if (safeNumber(styleChanges.fontSize) != null) {
      font.Size = Number(styleChanges.fontSize)
    }
    const fontColor = hexToOfficeColor(styleChanges.fontColor)
    if (fontColor != null) {
      font.Color = fontColor
    }
  }
  if (styleChanges.backgroundColor) {
    const backgroundColor = hexToOfficeColor(styleChanges.backgroundColor)
    let applied = false
    if (backgroundColor != null) {
      try {
        if (range?.Shading) {
          range.Shading.BackgroundPatternColor = backgroundColor
          applied = true
        }
      } catch (_) {
        // Fallback to highlight color when shading is unavailable.
      }
    }
    if (!applied) {
      const highlightIndex = getHighlightColorIndex(styleChanges.backgroundColor)
      if (highlightIndex != null && typeof range?.HighlightColorIndex !== 'undefined') {
        try {
          range.HighlightColorIndex = highlightIndex
        } catch (_) {
          // Ignore highlight failures when the host does not support it.
        }
      }
    }
  }
}

function applyParagraphStyle(range, styleChanges) {
  const paragraphFormat = range?.ParagraphFormat
  if (!paragraphFormat) return
  if (styleChanges.lineSpacing) {
    const lineSpacing = styleChanges.lineSpacing
    if (lineSpacing.mode === 'fixed' && typeof paragraphFormat.SetFixedLineSpacing === 'function') {
      paragraphFormat.SetFixedLineSpacing(Number(lineSpacing.value), 0)
    } else {
      paragraphFormat.LineSpacingRule = Number(lineSpacing.value)
    }
  }
  if (styleChanges.alignment) {
    const app = getApplication()
    const enumMap = app?.Enum?.WdAlignmentMode
    const enumKey = styleChanges.alignment === 'left'
      ? 'wdLeft'
      : styleChanges.alignment === 'center'
        ? 'wdCenter'
        : styleChanges.alignment === 'right'
          ? 'wdRight'
          : 'wdJustify'
    if (enumMap && typeof paragraphFormat.SetAlignment === 'function' && enumMap[enumKey] !== undefined) {
      paragraphFormat.SetAlignment(enumMap[enumKey])
    } else if (typeof paragraphFormat.Alignment !== 'undefined') {
      paragraphFormat.Alignment = ALIGNMENT_VALUE_MAP[styleChanges.alignment]
    }
  }
  if (safeNumber(styleChanges.firstLineIndent) != null && typeof paragraphFormat.CharacterUnitFirstLineIndent !== 'undefined') {
    paragraphFormat.CharacterUnitFirstLineIndent = Number(styleChanges.firstLineIndent)
  }
  if (safeNumber(styleChanges.spaceBefore) != null && typeof paragraphFormat.SpaceBefore !== 'undefined') {
    paragraphFormat.SpaceBefore = Number(styleChanges.spaceBefore)
  }
  if (safeNumber(styleChanges.spaceAfter) != null && typeof paragraphFormat.SpaceAfter !== 'undefined') {
    paragraphFormat.SpaceAfter = Number(styleChanges.spaceAfter)
  }
}

export function describeDocumentFormatChanges(styleChanges = {}) {
  const parts = []
  if (styleChanges.bold === true) parts.push('加粗')
  if (styleChanges.bold === false) parts.push('取消加粗')
  if (styleChanges.italic === true) parts.push('斜体')
  if (styleChanges.italic === false) parts.push('取消斜体')
  if (styleChanges.underline === true) parts.push('添加下划线')
  if (styleChanges.underline === false) parts.push('取消下划线')
  if (styleChanges.fontName) parts.push(`字体改为${styleChanges.fontName}`)
  if (safeNumber(styleChanges.fontSize) != null) parts.push(`字号改为${Number(styleChanges.fontSize)} 磅`)
  if (styleChanges.fontColor) parts.push(`文字颜色改为${styleChanges.fontColor}`)
  if (styleChanges.backgroundColor) parts.push(`背景色改为${styleChanges.backgroundColor}`)
  if (styleChanges.lineSpacing) {
    const spacing = styleChanges.lineSpacing
    parts.push(
      spacing.mode === 'fixed'
        ? `固定行间距改为${spacing.value}磅`
        : `行间距改为${spacing.value}倍`
    )
  }
  if (styleChanges.alignment) {
    const alignmentLabel = styleChanges.alignment === 'left'
      ? '左对齐'
      : styleChanges.alignment === 'center'
        ? '居中对齐'
        : styleChanges.alignment === 'right'
          ? '右对齐'
          : '两端对齐'
    parts.push(alignmentLabel)
  }
  if (safeNumber(styleChanges.firstLineIndent) != null) parts.push(`首行缩进改为${Number(styleChanges.firstLineIndent)}字符`)
  if (safeNumber(styleChanges.spaceBefore) != null) parts.push(`段前间距改为${Number(styleChanges.spaceBefore)}磅`)
  if (safeNumber(styleChanges.spaceAfter) != null) parts.push(`段后间距改为${Number(styleChanges.spaceAfter)}磅`)
  return parts
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

function setTemporaryPreviewHighlight(range, enabled) {
  const value = enabled ? 7 : 0
  try {
    if (typeof range?.HighlightColorIndexTemp !== 'undefined') {
      range.HighlightColorIndexTemp = value
      return true
    }
  } catch (_) {
    // Ignore temporary preview highlight failures on unsupported hosts.
  }
  return false
}

export function previewDocumentFormatMatches(intent) {
  const normalizedIntent = normalizeDocumentFormatIntent(intent)
  if (!normalizedIntent?.searchText && !normalizedIntent?.targetSelector) {
    return { ok: true, previewedCount: 0 }
  }
  const { doc, range } = resolveScopeRange(normalizedIntent.scope, intent?.scopeRange)
  const matchRanges = buildResolvedTargetRanges(doc, range, normalizedIntent)
  let previewedCount = 0
  matchRanges.forEach((targetRange) => {
    if (setTemporaryPreviewHighlight(targetRange, true)) {
      previewedCount += 1
    }
  })
  return { ok: true, previewedCount }
}

export function clearDocumentFormatPreview(intent) {
  const normalizedIntent = normalizeDocumentFormatIntent(intent)
  if (!normalizedIntent?.searchText && !normalizedIntent?.targetSelector) {
    return { ok: true, clearedCount: 0 }
  }
  const { doc, range } = resolveScopeRange(normalizedIntent.scope, intent?.scopeRange)
  const matchRanges = buildResolvedTargetRanges(doc, range, normalizedIntent)
  let clearedCount = 0
  matchRanges.forEach((targetRange) => {
    if (setTemporaryPreviewHighlight(targetRange, false)) {
      clearedCount += 1
    }
  })
  return { ok: true, clearedCount }
}

export function createDocumentFormatPreview(intent) {
  const normalizedIntent = normalizeDocumentFormatIntent(intent)
  if (!normalizedIntent) {
    throw new Error('未识别到可执行的格式设置指令')
  }
  const { doc, label, range } = resolveScopeRange(normalizedIntent.scope)
  const scopeRangeInfo = getRangeCoordinates(range)
  const targetRanges = buildResolvedTargetRanges(doc, range, normalizedIntent)
  const matchCount = targetRanges.length
  const changeSummary = describeDocumentFormatChanges(normalizedIntent.styleChanges)
  const searchModeSummary = describeSearchMode(normalizedIntent)
  const targetSelectorLabel = getTargetSelectorLabel(normalizedIntent.targetSelector)
  if (changeSummary.length === 0) {
    throw new Error('未识别到需要修改的格式属性')
  }
  const summaryText = normalizedIntent.searchText
    ? `${label}${targetSelectorLabel ? `中的${targetSelectorLabel}` : ''}总共有 ${matchCount} 处与“${normalizedIntent.searchText}”相匹配的结果${searchModeSummary.length ? `（${searchModeSummary.join('，')}）` : ''}。`
    : targetSelectorLabel
      ? `将直接对${label}中的${targetSelectorLabel}应用以下格式设置。`
      : `将直接对${label}应用以下格式设置。`
  const confirmPrompt = `是否确认${changeSummary.join('、')}？`
  return {
    intent: {
      ...normalizedIntent,
      scopeRange: scopeRangeInfo,
      documentName: String(doc?.Name || doc?.FullName || '').trim()
    },
    summaryText,
    confirmPrompt,
    scopeLabel: label,
    matchCount,
    searchText: normalizedIntent.searchText,
    targetSelectorLabel,
    matchMode: normalizedIntent.matchMode,
    caseSensitive: normalizedIntent.caseSensitive,
    changeSummary,
    canApply: targetRanges.length > 0
  }
}

export function executeDocumentFormatAction(intent) {
  const normalizedIntent = normalizeDocumentFormatIntent(intent)
  if (!normalizedIntent) {
    throw new Error('格式任务参数无效')
  }
  const { doc, label, range } = resolveScopeRange(normalizedIntent.scope, intent?.scopeRange)
  const searchText = normalizedIntent.searchText
  const targetSelectorLabel = getTargetSelectorLabel(normalizedIntent.targetSelector)
  const targets = buildResolvedTargetRanges(doc, range, normalizedIntent)
  if (targets.length === 0) {
    if (searchText) {
      throw new Error(`在${label}${targetSelectorLabel ? `中的${targetSelectorLabel}` : ''}没有找到“${searchText}”`)
    }
    throw new Error(`在${label}${targetSelectorLabel ? `中没有找到${targetSelectorLabel}` : ''}可处理的内容`)
  }
  targets.forEach((targetRange) => applyCharacterStyle(targetRange, normalizedIntent.styleChanges))
  const needsParagraphStyle = !!(
    normalizedIntent.styleChanges.lineSpacing ||
    normalizedIntent.styleChanges.alignment ||
    safeNumber(normalizedIntent.styleChanges.firstLineIndent) != null ||
    safeNumber(normalizedIntent.styleChanges.spaceBefore) != null ||
    safeNumber(normalizedIntent.styleChanges.spaceAfter) != null
  )
  const paragraphTargets = needsParagraphStyle
    ? uniqueParagraphRanges(targets)
    : []
  paragraphTargets.forEach((targetRange) => applyParagraphStyle(targetRange, normalizedIntent.styleChanges))
  const changeSummary = describeDocumentFormatChanges(normalizedIntent.styleChanges)
  return {
    ok: true,
    appliedCount: targets.length,
    paragraphCount: paragraphTargets.length,
    scopeLabel: label,
    searchText,
    message: searchText
      ? `已在${label}${targetSelectorLabel ? `中的${targetSelectorLabel}` : ''}处理 ${targets.length} 处“${searchText}”，并完成${changeSummary.join('、')}。`
      : `已对${label}${targetSelectorLabel ? `中的${targetSelectorLabel}` : ''}完成${changeSummary.join('、')}。`
  }
}
