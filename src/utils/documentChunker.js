/**
 * 文档分块 - 根据段落截取设置将文档分块，并保留位置信息（用于后续批注定位）
 * 支持大文档：按段落迭代，避免一次性加载全文
 */

import { getChunkSettings } from './chunkSettings.js'
import { normalizeTextWithIndexMap, mapNormalizedRangeToRawRange } from './documentPositionUtils.js'

function normalizeRangeText(text) {
  return (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function assessChunkRiskProfile(text) {
  const normalized = normalizeRangeText(text)
  const lineBreakCount = (normalized.match(/\n/g) || []).length
  const slashCount = (normalized.match(/[\\/]/g) || []).length
  const numberingLineCount = normalized
    .split('\n')
    .filter(line => /^\s*(?:第[0-9一二三四五六七八九十百千]+[章节篇部卷]|[一二三四五六七八九十百千]+[、.]|\d+(?:\.\d+)*(?:[、.．)）]))/.test(line))
    .length
  const tableLikeLineCount = normalized
    .split('\n')
    .filter(line => {
      const trimmed = String(line || '').trim()
      if (!trimmed) return false
      const pipeCount = (trimmed.match(/\|/g) || []).length
      const tabCount = (trimmed.match(/\t/g) || []).length
      const multiSpaceCols = (trimmed.match(/\s{2,}/g) || []).length
      return pipeCount >= 2 || tabCount >= 2 || multiSpaceCols >= 3
    })
    .length
  const punctuationDense = normalized.length > 0
    ? ((normalized.match(/[()（）【】[\]\\/|]/g) || []).length / normalized.length) >= 0.08
    : false
  const reasonCodes = []
  let level = 'low'
  if (lineBreakCount >= 3) reasonCodes.push('multi_line_chunk')
  if (slashCount >= 3) reasonCodes.push('slash_dense_text')
  if (numberingLineCount >= 2) reasonCodes.push('numbering_dense_text')
  if (tableLikeLineCount >= 2) reasonCodes.push('table_like_text')
  if (punctuationDense) reasonCodes.push('punctuation_dense_text')
  if (reasonCodes.length >= 3 || tableLikeLineCount >= 2) level = 'high'
  else if (reasonCodes.length >= 1) level = 'medium'
  const riskReasonLabelMap = {
    multi_line_chunk: '换行较多',
    slash_dense_text: '斜杠较多',
    numbering_dense_text: '编号较密集',
    table_like_text: '疑似表格或多列文本',
    punctuation_dense_text: '符号密度较高'
  }
  return {
    level,
    reasonCodes,
    reasonLabels: reasonCodes.map(code => riskReasonLabelMap[code] || code),
    message: reasonCodes.length > 0
      ? `文本特征风险：${reasonCodes.map(code => riskReasonLabelMap[code] || code).join('、')}`
      : '文本特征风险低',
    lineBreakCount,
    slashCount,
    numberingLineCount,
    tableLikeLineCount,
    punctuationDense
  }
}

function pushChunkBoundaries(boundaries, start, end) {
  if (end > start) boundaries.push({ start, end })
}

function splitLongRange(boundaries, info, start, end, maxUnitLength) {
  let cursor = start
  while (cursor < end) {
    const sliceEnd = Math.min(cursor + maxUnitLength, end)
    if (sliceEnd >= end) {
      pushChunkBoundaries(boundaries, cursor, end)
      break
    }
    let cut = -1
    const segment = info.normalized.slice(cursor, sliceEnd)
    const preferredChars = ['。', '！', '？', '；', ';', '，', ',', '\n', ' ']
    for (const ch of preferredChars) {
      const idx = segment.lastIndexOf(ch)
      if (idx > Math.floor(segment.length * 0.5)) {
        cut = cursor + idx + 1
        break
      }
    }
    if (cut <= cursor) cut = sliceEnd
    pushChunkBoundaries(boundaries, cursor, cut)
    cursor = cut
  }
}

function splitRangeIntoUnits(rawText, start, { splitStrategy, chunkLength }) {
  const info = normalizeTextWithIndexMap(rawText)
  if (!info.normalized) return []
  if (splitStrategy === 'paragraph') {
    return [{
      rawText: info.raw,
      text: info.normalized,
      start,
      end: start + info.raw.length,
      rawStart: 0,
      rawEnd: info.raw.length,
      normalizedStart: 0,
      normalizedEnd: info.normalized.length
    }]
  }

  const maxUnitLength = splitStrategy === 'char'
    ? Math.max(200, Math.min(chunkLength, 800))
    : Math.max(120, Math.min(chunkLength, 600))
  const boundaries = []
  let segStart = 0

  if (splitStrategy === 'sentence') {
    const closers = new Set(['"', '\'', '”', '’', '】', '》', '）', ')', ']', '」', '』'])
    const punct = new Set(['。', '！', '？', '!', '?', '；', ';'])
    for (let i = 0; i < info.normalized.length; i++) {
      const ch = info.normalized[i]
      if (!punct.has(ch)) continue
      let end = i + 1
      while (end < info.normalized.length && closers.has(info.normalized[end])) end++
      if (end - segStart > maxUnitLength) {
        splitLongRange(boundaries, info, segStart, end, maxUnitLength)
      } else {
        pushChunkBoundaries(boundaries, segStart, end)
      }
      segStart = end
    }
    if (segStart < info.normalized.length) {
      if (info.normalized.length - segStart > maxUnitLength) {
        splitLongRange(boundaries, info, segStart, info.normalized.length, maxUnitLength)
      } else {
        pushChunkBoundaries(boundaries, segStart, info.normalized.length)
      }
    }
  } else {
    splitLongRange(boundaries, info, 0, info.normalized.length, maxUnitLength)
  }

  return boundaries
    .map(({ start: normalizedStart, end: normalizedEnd }) => {
      const mapped = mapNormalizedRangeToRawRange(info, normalizedStart, normalizedEnd)
      if (!mapped || !mapped.text.trim()) return null
      return {
        rawText: mapped.rawText,
        text: mapped.text,
        start: start + mapped.rawStart,
        end: start + mapped.rawEnd,
        rawStart: mapped.rawStart,
        rawEnd: mapped.rawEnd,
        normalizedStart,
        normalizedEnd
      }
    })
    .filter(Boolean)
}

function chunkParagraphRanges(paragraphs, { chunkLength, overlapLength, splitStrategy }) {
  if (!paragraphs || paragraphs.Count === 0) return []
  const chunks = []
  let currentChunk = { texts: [], start: null, end: null, len: 0, paragraphRefs: [] }

  function pushParagraphRef(chunk, ref) {
    if (!chunk || !ref) return
    const existing = chunk.paragraphRefs.find(item => Number(item.paragraphIndex) === Number(ref.paragraphIndex))
    if (existing) {
      existing.chunkRelativeStart = Math.min(Number(existing.chunkRelativeStart || 0), Number(ref.chunkRelativeStart || 0))
      existing.chunkRelativeEnd = Math.max(Number(existing.chunkRelativeEnd || 0), Number(ref.chunkRelativeEnd || 0))
      existing.absoluteStart = Math.min(Number(existing.absoluteStart || 0), Number(ref.absoluteStart || 0))
      existing.absoluteEnd = Math.max(Number(existing.absoluteEnd || 0), Number(ref.absoluteEnd || 0))
      return
    }
    chunk.paragraphRefs.push(ref)
  }

  function flushChunk(keepOverlap = false) {
    if (currentChunk.texts.length === 0) return
    const rawText = currentChunk.texts.map(t => t.rawText).join('')
    const text = currentChunk.texts.map(t => t.text).join('')
    let relativeCursor = 0
    const relativeRangeMap = currentChunk.texts.map((unit) => {
      const entry = {
        paragraphIndex: Number(unit.paragraphIndex || 0),
        paragraphOrder: Number(unit.paragraphOrder || 0),
        paragraphAbsoluteStart: Number(unit.paragraphAbsoluteStart || 0),
        paragraphAbsoluteEnd: Number(unit.paragraphAbsoluteEnd || 0),
        paragraphPreview: String(unit.paragraphPreview || '').trim(),
        absoluteStart: Number(unit.start || 0),
        absoluteEnd: Number(unit.end || 0),
        paragraphRelativeStart: Number(unit.rawStart || 0),
        paragraphRelativeEnd: Number(unit.rawEnd || 0),
        normalizedRelativeStart: Number(unit.normalizedStart || 0),
        normalizedRelativeEnd: Number(unit.normalizedEnd || 0),
        chunkRelativeStart: relativeCursor,
        chunkRelativeEnd: relativeCursor + String(unit.text || '').length,
        textPreview: String(unit.text || '').trim()
      }
      relativeCursor = entry.chunkRelativeEnd
      return entry
    })
    chunks.push({
      text: rawText,
      normalizedText: text,
      start: currentChunk.start,
      end: currentChunk.end,
      index: chunks.length,
      paragraphRefs: currentChunk.paragraphRefs.slice(),
      relativeRangeMap,
      riskProfile: assessChunkRiskProfile(text)
    })
    if (keepOverlap && overlapLength > 0) {
      let overlapLen = 0
      const overlapTexts = []
      for (let i = currentChunk.texts.length - 1; i >= 0 && overlapLen < overlapLength; i--) {
        overlapTexts.unshift(currentChunk.texts[i])
        overlapLen += currentChunk.texts[i].text.length
      }
      currentChunk = {
        texts: overlapTexts,
        start: overlapTexts[0]?.start ?? currentChunk.start,
        end: currentChunk.end,
        len: overlapLen,
        paragraphRefs: []
      }
      overlapTexts.forEach((unit) => {
        pushParagraphRef(currentChunk, {
          paragraphIndex: Number(unit.paragraphIndex || 0),
          paragraphOrder: Number(unit.paragraphOrder || 0),
          absoluteStart: Number(unit.start || 0),
          absoluteEnd: Number(unit.end || 0),
          chunkRelativeStart: 0,
          chunkRelativeEnd: 0,
          paragraphPreview: String(unit.paragraphPreview || '').trim()
        })
      })
    } else {
      currentChunk = { texts: [], start: null, end: null, len: 0, paragraphRefs: [] }
    }
  }

  for (let i = 1; i <= paragraphs.Count; i++) {
    try {
      const para = paragraphs.Item(i)
      const rng = para.Range
      if (!rng) continue
      const rawText = String(rng.Text || '')
      const start = Number(rng.Start)
      const end = Number(rng.End)
      const normalizedText = normalizeRangeText(rawText)
      if (splitStrategy === 'paragraph' && normalizedText === '\n') continue

      const units = splitRangeIntoUnits(rawText, start, { splitStrategy, chunkLength })
      for (const unit of units) {
        if (!unit.text.trim() && currentChunk.texts.length === 0) continue
        const enrichedUnit = {
          ...unit,
          paragraphIndex: i - 1,
          paragraphOrder: i,
          paragraphAbsoluteStart: start,
          paragraphAbsoluteEnd: end,
          paragraphPreview: normalizeRangeText(rawText).trim().slice(0, 120)
        }
        currentChunk.texts.push(enrichedUnit)
        if (currentChunk.start == null) currentChunk.start = unit.start
        currentChunk.end = unit.end
        currentChunk.len += unit.text.length
        pushParagraphRef(currentChunk, {
          paragraphIndex: i - 1,
          paragraphOrder: i,
          absoluteStart: unit.start,
          absoluteEnd: unit.end,
          chunkRelativeStart: 0,
          chunkRelativeEnd: 0,
          paragraphPreview: normalizeRangeText(rawText).trim().slice(0, 120)
        })

        if (currentChunk.len >= chunkLength) {
          flushChunk(true)
        }
      }
    } catch (e) {
      console.warn('documentChunker paragraph error:', e)
    }
  }

  if (currentChunk.texts.length > 0) {
    flushChunk(false)
  }
  return chunks
}

/**
 * 与 chunkParagraphRanges 逻辑一致；每隔 yieldEveryParagraphs 段 await 一次，让 CrBrowserMain 处理事件，降低 WPS COM 长循环诱发宿主 abort 的概率。
 * @param {number} yieldEveryParagraphs 0 表示不 yield（行为等同同步版）
 */
async function chunkParagraphRangesAsync(paragraphs, { chunkLength, overlapLength, splitStrategy }, yieldEveryParagraphs = 0) {
  if (!paragraphs || paragraphs.Count === 0) return []
  const chunks = []
  let currentChunk = { texts: [], start: null, end: null, len: 0, paragraphRefs: [] }

  function pushParagraphRef(chunk, ref) {
    if (!chunk || !ref) return
    const existing = chunk.paragraphRefs.find(item => Number(item.paragraphIndex) === Number(ref.paragraphIndex))
    if (existing) {
      existing.chunkRelativeStart = Math.min(Number(existing.chunkRelativeStart || 0), Number(ref.chunkRelativeStart || 0))
      existing.chunkRelativeEnd = Math.max(Number(existing.chunkRelativeEnd || 0), Number(ref.chunkRelativeEnd || 0))
      existing.absoluteStart = Math.min(Number(existing.absoluteStart || 0), Number(ref.absoluteStart || 0))
      existing.absoluteEnd = Math.max(Number(existing.absoluteEnd || 0), Number(ref.absoluteEnd || 0))
      return
    }
    chunk.paragraphRefs.push(ref)
  }

  function flushChunk(keepOverlap = false) {
    if (currentChunk.texts.length === 0) return
    const rawText = currentChunk.texts.map(t => t.rawText).join('')
    const text = currentChunk.texts.map(t => t.text).join('')
    let relativeCursor = 0
    const relativeRangeMap = currentChunk.texts.map((unit) => {
      const entry = {
        paragraphIndex: Number(unit.paragraphIndex || 0),
        paragraphOrder: Number(unit.paragraphOrder || 0),
        paragraphAbsoluteStart: Number(unit.paragraphAbsoluteStart || 0),
        paragraphAbsoluteEnd: Number(unit.paragraphAbsoluteEnd || 0),
        paragraphPreview: String(unit.paragraphPreview || '').trim(),
        absoluteStart: Number(unit.start || 0),
        absoluteEnd: Number(unit.end || 0),
        paragraphRelativeStart: Number(unit.rawStart || 0),
        paragraphRelativeEnd: Number(unit.rawEnd || 0),
        normalizedRelativeStart: Number(unit.normalizedStart || 0),
        normalizedRelativeEnd: Number(unit.normalizedEnd || 0),
        chunkRelativeStart: relativeCursor,
        chunkRelativeEnd: relativeCursor + String(unit.text || '').length,
        textPreview: String(unit.text || '').trim()
      }
      relativeCursor = entry.chunkRelativeEnd
      return entry
    })
    chunks.push({
      text: rawText,
      normalizedText: text,
      start: currentChunk.start,
      end: currentChunk.end,
      index: chunks.length,
      paragraphRefs: currentChunk.paragraphRefs.slice(),
      relativeRangeMap,
      riskProfile: assessChunkRiskProfile(text)
    })
    if (keepOverlap && overlapLength > 0) {
      let overlapLen = 0
      const overlapTexts = []
      for (let j = currentChunk.texts.length - 1; j >= 0 && overlapLen < overlapLength; j--) {
        overlapTexts.unshift(currentChunk.texts[j])
        overlapLen += currentChunk.texts[j].text.length
      }
      currentChunk = {
        texts: overlapTexts,
        start: overlapTexts[0]?.start ?? currentChunk.start,
        end: currentChunk.end,
        len: overlapLen,
        paragraphRefs: []
      }
      overlapTexts.forEach((unit) => {
        pushParagraphRef(currentChunk, {
          paragraphIndex: Number(unit.paragraphIndex || 0),
          paragraphOrder: Number(unit.paragraphOrder || 0),
          absoluteStart: Number(unit.start || 0),
          absoluteEnd: Number(unit.end || 0),
          chunkRelativeStart: 0,
          chunkRelativeEnd: 0,
          paragraphPreview: String(unit.paragraphPreview || '').trim()
        })
      })
    } else {
      currentChunk = { texts: [], start: null, end: null, len: 0, paragraphRefs: [] }
    }
  }

  const y = Math.max(0, Math.floor(Number(yieldEveryParagraphs) || 0))
  for (let i = 1; i <= paragraphs.Count; i++) {
    if (y > 0 && i > 1 && (i - 1) % y === 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    try {
      const para = paragraphs.Item(i)
      const rng = para.Range
      if (!rng) continue
      const rawText = String(rng.Text || '')
      const start = Number(rng.Start)
      const end = Number(rng.End)
      const normalizedText = normalizeRangeText(rawText)
      if (splitStrategy === 'paragraph' && normalizedText === '\n') continue

      const units = splitRangeIntoUnits(rawText, start, { splitStrategy, chunkLength })
      for (const unit of units) {
        if (!unit.text.trim() && currentChunk.texts.length === 0) continue
        const enrichedUnit = {
          ...unit,
          paragraphIndex: i - 1,
          paragraphOrder: i,
          paragraphAbsoluteStart: start,
          paragraphAbsoluteEnd: end,
          paragraphPreview: normalizeRangeText(rawText).trim().slice(0, 120)
        }
        currentChunk.texts.push(enrichedUnit)
        if (currentChunk.start == null) currentChunk.start = unit.start
        currentChunk.end = unit.end
        currentChunk.len += unit.text.length
        pushParagraphRef(currentChunk, {
          paragraphIndex: i - 1,
          paragraphOrder: i,
          absoluteStart: unit.start,
          absoluteEnd: unit.end,
          chunkRelativeStart: 0,
          chunkRelativeEnd: 0,
          paragraphPreview: normalizeRangeText(rawText).trim().slice(0, 120)
        })

        if (currentChunk.len >= chunkLength) {
          flushChunk(true)
        }
      }
    } catch (e) {
      console.warn('documentChunker paragraph error:', e)
    }
  }

  if (currentChunk.texts.length > 0) {
    flushChunk(false)
  }
  return chunks
}

/**
 * 从 Word/WPS 文档提取带位置信息的分块
 * @param {object} doc - Application.ActiveDocument
 * @param {{ chunkLength?: number, overlapLength?: number, splitStrategy?: string }} overrides - 可选覆盖
 * @returns {Array<{ text: string, normalizedText: string, start: number, end: number, index: number }>}
 */
export function getDocumentChunksWithPositions(doc, overrides = {}) {
  if (!doc) return []
  const { chunkLength, overlapLength, splitStrategy } = { ...getChunkSettings(), ...overrides }

  try {
    const paragraphs = doc.Paragraphs
    if (!paragraphs || paragraphs.Count === 0) {
      const content = doc.Content
      if (!content) return []
      const rawText = String(content.Text || '')
      const text = normalizeRangeText(rawText)
      if (!text.trim()) return []
      const start = content.Start != null ? Number(content.Start) : 0
      const end = content.End != null ? Number(content.End) : start + rawText.length
      return [{ text: rawText, normalizedText: text, start, end, index: 0, riskProfile: assessChunkRiskProfile(text) }]
    }
    return chunkParagraphRanges(paragraphs, { chunkLength, overlapLength, splitStrategy })
  } catch (e) {
    console.error('getDocumentChunksWithPositions:', e)
    return []
  }
}

/**
 * 大文档时分段让出主线程，供摘要等长 COM 路径使用。
 * @param {{ yieldEveryParagraphs?: number }} yieldOpts 每隔多少段 await 一次；0 时行为与 {@link getDocumentChunksWithPositions} 一致（但不走本函数）。
 */
export async function getDocumentChunksWithPositionsAsync(doc, overrides = {}, yieldOpts = {}) {
  if (!doc) return []
  const { chunkLength, overlapLength, splitStrategy } = { ...getChunkSettings(), ...overrides }
  const yieldEveryParagraphs = Math.max(0, Math.floor(Number(yieldOpts.yieldEveryParagraphs) || 0))

  try {
    const paragraphs = doc.Paragraphs
    if (!paragraphs || paragraphs.Count === 0) {
      const content = doc.Content
      if (!content) return []
      const rawText = String(content.Text || '')
      const text = normalizeRangeText(rawText)
      if (!text.trim()) return []
      const start = content.Start != null ? Number(content.Start) : 0
      const end = content.End != null ? Number(content.End) : start + rawText.length
      return [{ text: rawText, normalizedText: text, start, end, index: 0, riskProfile: assessChunkRiskProfile(text) }]
    }
    return await chunkParagraphRangesAsync(paragraphs, { chunkLength, overlapLength, splitStrategy }, yieldEveryParagraphs)
  } catch (e) {
    console.error('getDocumentChunksWithPositionsAsync:', e)
    return []
  }
}

/**
 * 获取选区范围内的分块（用于「检查当前选中」）
 * @param {object} doc - ActiveDocument
 * @param {object} selection - Application.Selection
 */
export function getSelectionChunksWithPositions(doc, selection, overrides = {}) {
  if (!doc || !selection?.Range) return []
  const { chunkLength, overlapLength, splitStrategy } = { ...getChunkSettings(), ...overrides }
  const range = selection.Range
  const start = Number(range.Start)
  const end = Number(range.End)
  const rawText = String(range.Text || '')
  const text = normalizeRangeText(rawText)
  if (!text.trim()) return []

  try {
    const paragraphs = range.Paragraphs
    if (!paragraphs || paragraphs.Count === 0) {
      return [{ text: rawText, normalizedText: text, start, end, index: 0, riskProfile: assessChunkRiskProfile(text) }]
    }
    const selectionParagraphs = {
      Count: paragraphs.Count,
      Item(i) {
        const para = paragraphs.Item(i)
        const paraRange = para?.Range
        if (!paraRange) return { Range: null }
        const clipStart = Math.max(start, Number(paraRange.Start))
        const clipEnd = Math.min(end, Number(paraRange.End))
        if (clipEnd <= clipStart) return { Range: null }
        return {
          Range: doc.Range(clipStart, clipEnd)
        }
      }
    }
    const chunks = chunkParagraphRanges(selectionParagraphs, { chunkLength, overlapLength, splitStrategy })
    return chunks.length > 0 ? chunks : [{ text: rawText, normalizedText: text, start, end, index: 0, riskProfile: assessChunkRiskProfile(text) }]
  } catch (e) {
    console.warn('getSelectionChunksWithPositions:', e)
    return [{ text: rawText, normalizedText: text, start, end, index: 0, riskProfile: assessChunkRiskProfile(text) }]
  }
}

/**
 * 选区分块异步版，逻辑同 {@link getSelectionChunksWithPositions}，段落遍历时可让出主线程。
 */
export async function getSelectionChunksWithPositionsAsync(doc, selection, overrides = {}, yieldOpts = {}) {
  if (!doc || !selection?.Range) return []
  const { chunkLength, overlapLength, splitStrategy } = { ...getChunkSettings(), ...overrides }
  const yieldEveryParagraphs = Math.max(0, Math.floor(Number(yieldOpts.yieldEveryParagraphs) || 0))
  const range = selection.Range
  const start = Number(range.Start)
  const end = Number(range.End)
  const rawText = String(range.Text || '')
  const text = normalizeRangeText(rawText)
  if (!text.trim()) return []

  try {
    const paragraphs = range.Paragraphs
    if (!paragraphs || paragraphs.Count === 0) {
      return [{ text: rawText, normalizedText: text, start, end, index: 0, riskProfile: assessChunkRiskProfile(text) }]
    }
    const selectionParagraphs = {
      Count: paragraphs.Count,
      Item(i) {
        const para = paragraphs.Item(i)
        const paraRange = para?.Range
        if (!paraRange) return { Range: null }
        const clipStart = Math.max(start, Number(paraRange.Start))
        const clipEnd = Math.min(end, Number(paraRange.End))
        if (clipEnd <= clipStart) return { Range: null }
        return {
          Range: doc.Range(clipStart, clipEnd)
        }
      }
    }
    const chunks = await chunkParagraphRangesAsync(selectionParagraphs, { chunkLength, overlapLength, splitStrategy }, yieldEveryParagraphs)
    return chunks.length > 0 ? chunks : [{ text: rawText, normalizedText: text, start, end, index: 0, riskProfile: assessChunkRiskProfile(text) }]
  } catch (e) {
    console.warn('getSelectionChunksWithPositionsAsync:', e)
    return [{ text: rawText, normalizedText: text, start, end, index: 0, riskProfile: assessChunkRiskProfile(text) }]
  }
}
