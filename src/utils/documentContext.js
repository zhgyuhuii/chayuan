import { getApplication, hasMeaningfulSelectionText } from './documentActions.js'

const WD_COLLAPSE_END = 0
const WD_COLLAPSE_START = 1
const WD_NUMBER_OF_PAGES_IN_DOCUMENT = 2
const WD_STATISTIC_WORDS = 0
const WD_STATISTIC_PAGES = 2
const WD_STATISTIC_CHARACTERS = 3
const WD_STATISTIC_PARAGRAPHS = 4
const WD_STATISTIC_CHARACTERS_WITH_SPACES = 5

const PAGE_NUMBER_INFORMATION_CONSTANTS = [3, 7, 8, 1]

const ALIGNMENT_LABELS = {
  0: '左对齐',
  1: '居中',
  2: '右对齐',
  3: '两端对齐',
  4: '分散对齐',
  5: '中部对齐',
  7: '左对齐',
  8: '两端对齐',
  9: '阿拉伯对齐',
  10: '泰文分散对齐'
}

function safeGet(getter, fallback = '') {
  try {
    const value = getter()
    return value == null ? fallback : value
  } catch (_) {
    return fallback
  }
}

function normalizeContextText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .split('\u0007').join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function truncateContextText(text, maxChars = 120000) {
  const normalized = String(text || '')
  const limit = Math.max(1000, Number(maxChars || 120000))
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}\n\n[全文过长，已截断显示前 ${limit} 字符]`
}

function getSelection() {
  const app = getApplication()
  return app?.Selection || app?.ActiveWindow?.Selection || app?.ActiveDocument?.Selection || null
}

function getSelectionRange(selection) {
  return selection?.Range || null
}

function getParagraphText(paragraph) {
  return normalizeContextText(safeGet(() => paragraph?.Range?.Text || '', ''))
}

function getCurrentParagraph(selection) {
  return safeGet(
    () => selection?.Paragraphs?.Item(1) || selection?.Range?.Paragraphs?.Item(1) || null,
    null
  )
}

function getCurrentTableCellText(selection) {
  const readCells = (cells) => {
    try {
      if (!cells || cells.Count <= 0) return ''
      return normalizeContextText(cells.Item(1)?.Range?.Text || '')
    } catch (_) {
      return ''
    }
  }
  return readCells(selection?.Cells) || readCells(selection?.Range?.Cells)
}

function getRangeParagraphIndex(doc, paragraphRange) {
  const paragraphs = doc?.Paragraphs
  const targetStart = Number(paragraphRange?.Start || 0)
  const targetEnd = Number(paragraphRange?.End || targetStart)
  const total = Number(paragraphs?.Count || 0)
  if (!paragraphs || total <= 0) {
    return { index: 0, total: 0 }
  }
  for (let i = 1; i <= total; i++) {
    try {
      const paraRange = paragraphs.Item(i)?.Range
      if (!paraRange) continue
      const start = Number(paraRange.Start || 0)
      const end = Number(paraRange.End || start)
      if (targetStart >= start && targetStart <= end) {
        return { index: i, total }
      }
      if (targetEnd >= start && targetEnd <= end) {
        return { index: i, total }
      }
    } catch (_) {
      continue
    }
  }
  return { index: 0, total }
}

function getNeighborParagraphText(doc, index) {
  if (!doc?.Paragraphs || index <= 0) return ''
  try {
    return getParagraphText(doc.Paragraphs.Item(index))
  } catch (_) {
    return ''
  }
}

function describeColor(value) {
  if (value == null || value === '') return ''
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  const hex = `#${(numeric >>> 0).toString(16).slice(-6).padStart(6, '0').toUpperCase()}`
  return `${hex} (${numeric})`
}

function formatBooleanLabel(value, truthyLabel, falsyLabel = '否') {
  if (value == null || value === '') return ''
  return Number(value) === 0 || value === false ? falsyLabel : truthyLabel
}

function getFormattingSummary(range, paragraph) {
  const font = safeGet(() => range?.Font || paragraph?.Range?.Font || null, null)
  const paragraphFormat = safeGet(
    () => range?.ParagraphFormat || paragraph?.Range?.ParagraphFormat || null,
    null
  )
  const styleName = safeGet(
    () => paragraph?.Style?.NameLocal || paragraph?.Style?.Name || range?.Style?.NameLocal || range?.Style?.Name || '',
    ''
  )
  const alignment = safeGet(() => paragraphFormat?.Alignment, '')

  return {
    styleName: String(styleName || '').trim(),
    alignment: alignment === '' ? '' : Number(alignment),
    alignmentLabel: alignment === '' ? '' : (ALIGNMENT_LABELS[Number(alignment)] || `对齐方式${alignment}`),
    fontName: String(safeGet(() => font?.Name || '', '') || '').trim(),
    fontSize: safeGet(() => font?.Size, ''),
    fontColor: describeColor(safeGet(() => font?.Color, '')),
    highlightColor: describeColor(safeGet(() => font?.HighlightColorIndex, '')),
    bold: formatBooleanLabel(safeGet(() => font?.Bold, ''), '是'),
    italic: formatBooleanLabel(safeGet(() => font?.Italic, ''), '是'),
    underline: formatBooleanLabel(safeGet(() => font?.Underline, ''), '是')
  }
}

function buildDocumentExcerpt(doc, range, maxChars = 800) {
  if (!doc || typeof doc.Range !== 'function') return ''
  const limit = Math.max(160, Number(maxChars || 800))
  const start = Number(range?.Start || 0)
  const end = Number(range?.End || start)
  const half = Math.floor(limit / 2)
  try {
    const excerptRange = doc.Range(Math.max(0, start - half), Math.max(end, start + half))
    return normalizeContextText(excerptRange?.Text || '').slice(0, limit)
  } catch (_) {
    return ''
  }
}

function getRangeText(range) {
  return normalizeContextText(safeGet(() => range?.Text || '', ''))
}

function duplicateRange(range) {
  return safeGet(() => range?.Duplicate?.() || range, range)
}

function getParagraphPositionText(position) {
  if (!position?.paragraphIndex || !position?.paragraphCount) return ''
  return `第 ${position.paragraphIndex} / ${position.paragraphCount} 段`
}

function getRangePageNumber(range) {
  if (!range) return 0
  try {
    let targetRange = range
    if (typeof range.Duplicate === 'function') {
      const duplicatedRange = range.Duplicate()
      if (duplicatedRange) {
        targetRange = duplicatedRange
        if (typeof duplicatedRange.Collapse === 'function') {
          duplicatedRange.Collapse(WD_COLLAPSE_START)
        }
      }
    }
    if (!targetRange || typeof targetRange.Information !== 'function') return 0
    for (const pageConst of PAGE_NUMBER_INFORMATION_CONSTANTS) {
      const pageInfo = safeGet(() => targetRange.Information(pageConst), '')
      const pageNumber = parseInt(pageInfo, 10)
      if (!Number.isNaN(pageNumber) && pageNumber > 0) return pageNumber
    }
  } catch (_) {
    return 0
  }
  return 0
}

function computeDocStatistic(doc, statisticType) {
  if (!doc || typeof doc.ComputeStatistics !== 'function') return 0
  const value = safeGet(() => doc.ComputeStatistics(statisticType), 0)
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
}

function maybeRepaginateDocument(doc, paragraphCount = 0) {
  if (!doc || typeof doc.Repaginate !== 'function') return
  if (paragraphCount > 0 && paragraphCount >= 10000) return
  safeGet(() => {
    doc.Repaginate()
    return true
  }, false)
}

function getDocumentStats(doc, range, paragraphCount = 0) {
  const normalizedDocumentText = normalizeContextText(safeGet(() => doc?.Content?.Text || '', ''))
  const characters = computeDocStatistic(doc, WD_STATISTIC_CHARACTERS) || normalizedDocumentText.length
  const charactersWithSpaces = computeDocStatistic(doc, WD_STATISTIC_CHARACTERS_WITH_SPACES) || String(safeGet(() => doc?.Content?.Text || '', '')).length
  const words = computeDocStatistic(doc, WD_STATISTIC_WORDS) || 0
  const statsParagraphs = computeDocStatistic(doc, WD_STATISTIC_PARAGRAPHS)
  const resolvedParagraphCount = statsParagraphs || Number(paragraphCount || 0)

  let totalPages = computeDocStatistic(doc, WD_STATISTIC_PAGES)
  if (!totalPages) {
    totalPages = Number(safeGet(() => range?.Information?.(WD_NUMBER_OF_PAGES_IN_DOCUMENT), 0)) || 0
  }
  if (!totalPages) {
    maybeRepaginateDocument(doc, resolvedParagraphCount)
    totalPages = computeDocStatistic(doc, WD_STATISTIC_PAGES)
      || Number(safeGet(() => range?.Information?.(WD_NUMBER_OF_PAGES_IN_DOCUMENT), 0)) || 0
  }

  return {
    totalPages,
    wordCount: words,
    characterCount: characters,
    characterCountWithSpaces: charactersWithSpaces,
    paragraphCount: resolvedParagraphCount,
    currentPage: getRangePageNumber(range)
  }
}

export function getSelectionContextSnapshot(options = {}) {
  const app = getApplication()
  const doc = app?.ActiveDocument
  const selection = getSelection()
  const range = getSelectionRange(selection)
  if (!doc || !selection || !range) {
    return {
      kind: 'unknown',
      text: '',
      selectionText: '',
      currentParagraphText: '',
      previousParagraphText: '',
      nextParagraphText: '',
      documentName: '',
      documentCharCount: 0,
      documentExcerpt: '',
      documentStats: {
        totalPages: 0,
        wordCount: 0,
        characterCount: 0,
        characterCountWithSpaces: 0,
        paragraphCount: 0,
        currentPage: 0
      },
      position: {
        hasSelection: false,
        rangeStart: 0,
        rangeEnd: 0,
        paragraphIndex: 0,
        paragraphCount: 0,
        paragraphLabel: ''
      },
      formatting: {}
    }
  }

  const hasImageSelection = safeGet(
    () => (selection.InlineShapes && selection.InlineShapes.Count > 0) ||
      (selection.ShapeRange && selection.ShapeRange.Count > 0),
    false
  )
  if (hasImageSelection) {
    return {
      kind: 'image',
      text: '',
      selectionText: '',
      currentParagraphText: '',
      previousParagraphText: '',
      nextParagraphText: '',
      documentName: String(safeGet(() => doc?.Name || '', '') || ''),
      documentCharCount: Number(safeGet(() => doc?.Content?.Text?.length || 0, 0)),
      documentExcerpt: '',
      documentStats: getDocumentStats(doc, range, 0),
      position: {
        hasSelection: false,
        rangeStart: Number(range.Start || 0),
        rangeEnd: Number(range.End || 0),
        paragraphIndex: 0,
        paragraphCount: 0,
        paragraphLabel: ''
      },
      formatting: {}
    }
  }

  const selectionText = normalizeContextText(safeGet(() => selection.Text || '', ''))
  const tableCellText = getCurrentTableCellText(selection)
  const currentParagraph = getCurrentParagraph(selection)
  const currentParagraphText = getParagraphText(currentParagraph)
  const documentText = normalizeContextText(safeGet(() => doc?.Content?.Text || '', ''))
  const candidateSelectionText = tableCellText || selectionText
  const hasMeaningfulSelection = hasMeaningfulSelectionText(candidateSelectionText, 2)

  let kind = 'unknown'
  let sourceText = ''
  if (hasMeaningfulSelection && tableCellText) {
    kind = 'table-cell'
    sourceText = tableCellText
  } else if (hasMeaningfulSelection && selectionText) {
    kind = 'selection'
    sourceText = selectionText
  } else if (documentText) {
    kind = 'document'
    sourceText = truncateContextText(documentText, options.fullDocumentMaxChars || 120000)
  } else if (currentParagraphText) {
    kind = 'paragraph'
    sourceText = currentParagraphText
  } else {
    sourceText = getRangeText(range)
  }

  const currentParagraphRange = duplicateRange(safeGet(() => currentParagraph?.Range, null))
  const paragraphPosition = getRangeParagraphIndex(doc, currentParagraphRange || range)
  const documentStats = getDocumentStats(doc, range, paragraphPosition.total)
  const position = {
    hasSelection: hasMeaningfulSelection,
    rangeStart: Number(safeGet(() => range.Start, 0)),
    rangeEnd: Number(safeGet(() => range.End, 0)),
    paragraphIndex: paragraphPosition.index,
    paragraphCount: paragraphPosition.total,
    paragraphLabel: getParagraphPositionText(paragraphPosition)
  }

  return {
    kind,
    text: sourceText,
    selectionText,
    currentParagraphText,
    previousParagraphText: getNeighborParagraphText(doc, paragraphPosition.index - 1),
    nextParagraphText: getNeighborParagraphText(doc, paragraphPosition.index + 1),
    documentName: String(safeGet(() => doc?.Name || doc?.FullName || '', '') || ''),
    documentCharCount: Number(safeGet(() => normalizeContextText(doc?.Content?.Text || '').length, 0)),
    documentExcerpt: buildDocumentExcerpt(doc, range, options.documentExcerptLimit || 800),
    documentStats,
    position,
    formatting: getFormattingSummary(range, currentParagraph)
  }
}

export function buildSelectionContextPrompt(snapshot) {
  if (!snapshot?.text) return ''
  const lines = []
  lines.push(`来源类型：${snapshot.kind || 'unknown'}`)
  if (snapshot.position?.paragraphLabel) {
    lines.push(`当前位置：${snapshot.position.paragraphLabel}`)
  }
  if (Number.isFinite(Number(snapshot.position?.rangeStart)) && Number.isFinite(Number(snapshot.position?.rangeEnd))) {
    lines.push(`文档范围：${snapshot.position.rangeStart}-${snapshot.position.rangeEnd}`)
  }
  if (snapshot.documentName) {
    lines.push(`文档名称：${snapshot.documentName}`)
  }
  if (snapshot.documentCharCount > 0) {
    lines.push(`文档字符数：${snapshot.documentCharCount}`)
  }
  if (snapshot.documentStats?.totalPages > 0) {
    lines.push(`文档总页数：${snapshot.documentStats.totalPages}`)
  }
  if (snapshot.documentStats?.currentPage > 0) {
    lines.push(`当前位置页码：第 ${snapshot.documentStats.currentPage} 页`)
  }
  if (snapshot.documentStats?.wordCount > 0) {
    lines.push(`文档词数：${snapshot.documentStats.wordCount}`)
  }
  if (snapshot.documentStats?.characterCount > 0) {
    lines.push(`文档字数/字符数：${snapshot.documentStats.characterCount}`)
  }
  if (snapshot.documentStats?.characterCountWithSpaces > 0) {
    lines.push(`含空格字符数：${snapshot.documentStats.characterCountWithSpaces}`)
  }
  if (snapshot.documentStats?.paragraphCount > 0) {
    lines.push(`文档段落数：${snapshot.documentStats.paragraphCount}`)
  }

  const formatParts = [
    snapshot.formatting?.styleName ? `样式 ${snapshot.formatting.styleName}` : '',
    snapshot.formatting?.fontName ? `字体 ${snapshot.formatting.fontName}` : '',
    snapshot.formatting?.fontSize ? `字号 ${snapshot.formatting.fontSize}` : '',
    snapshot.formatting?.fontColor ? `文字颜色 ${snapshot.formatting.fontColor}` : '',
    snapshot.formatting?.highlightColor ? `高亮 ${snapshot.formatting.highlightColor}` : '',
    snapshot.formatting?.alignmentLabel ? `对齐 ${snapshot.formatting.alignmentLabel}` : '',
    snapshot.formatting?.bold ? `加粗 ${snapshot.formatting.bold}` : '',
    snapshot.formatting?.italic ? `斜体 ${snapshot.formatting.italic}` : '',
    snapshot.formatting?.underline ? `下划线 ${snapshot.formatting.underline}` : ''
  ].filter(Boolean)

  if (formatParts.length > 0) {
    lines.push(`格式信息：${formatParts.join('；')}`)
  }

  lines.push('来源文本：')
  lines.push('---')
  lines.push(String(snapshot.text || '').trim())
  lines.push('---')

  if (snapshot.currentParagraphText && snapshot.currentParagraphText !== snapshot.text) {
    lines.push('当前段落：')
    lines.push('---')
    lines.push(snapshot.currentParagraphText)
    lines.push('---')
  }
  if (snapshot.previousParagraphText) {
    lines.push('上文段落：')
    lines.push('---')
    lines.push(snapshot.previousParagraphText)
    lines.push('---')
  }
  if (snapshot.nextParagraphText) {
    lines.push('下文段落：')
    lines.push('---')
    lines.push(snapshot.nextParagraphText)
    lines.push('---')
  }
  if (snapshot.documentExcerpt) {
    lines.push('文档局部片段：')
    lines.push('---')
    lines.push(snapshot.documentExcerpt)
    lines.push('---')
  }

  return lines.join('\n')
}

export {
  WD_COLLAPSE_END,
  WD_COLLAPSE_START
}
