/**
 * WPS/Word 文档锚点解析：表格单元格标记（\\u0007）、空段跳过等会导致
 * 「chunk 字符串下标 + chunkStart ≠ Range 绝对坐标」。
 * 本模块以 live Range.Text 复核 + Find 重定位为准，relativeRangeMap 仅作提示。
 */
import {
  mapNormalizedRangeToRawRange,
  normalizeTextWithIndexMap
} from './documentPositionUtils.js'

export function normalizeComparableAnchorText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\n\u0007]+$/g, '')
    .replace(/\u0007/g, '')
    .trim()
}

function liveRangeText(doc, start, end) {
  try {
    return String(doc?.Range?.(start, end)?.Text || '')
  } catch {
    return ''
  }
}

/**
 * 用 relativeRangeMap 把 chunk 内相对下标映射到文档绝对坐标。
 * 表格中空段被跳过时，chunkStart+offset 会漂；按 unit.absoluteStart 换算可纠偏。
 */
export function mapChunkRelativeViaRangeMap(chunkOrMap, relativeStart, relativeEnd) {
  const relStart = Number(relativeStart)
  const relEnd = Number(relativeEnd)
  if (!Number.isFinite(relStart) || !Number.isFinite(relEnd) || relEnd <= relStart) {
    return null
  }
  const map = Array.isArray(chunkOrMap)
    ? chunkOrMap
    : (Array.isArray(chunkOrMap?.relativeRangeMap) ? chunkOrMap.relativeRangeMap : [])
  if (!map.length) return null

  const unit = map.find((entry) => {
    const a = Number(entry?.chunkRelativeStart)
    const b = Number(entry?.chunkRelativeEnd)
    return Number.isFinite(a) && Number.isFinite(b) && relStart >= a && relStart < b
  }) || map.find((entry) => {
    const a = Number(entry?.chunkRelativeStart)
    const b = Number(entry?.chunkRelativeEnd)
    return Number.isFinite(a) && Number.isFinite(b) && relStart >= a && relStart <= b
  })
  if (!unit) return null

  const unitRelStart = Number(unit.chunkRelativeStart) || 0
  const absBase = Number(unit.absoluteStart)
  if (!Number.isFinite(absBase)) return null
  const start = absBase + (relStart - unitRelStart)
  const end = absBase + (relEnd - unitRelStart)
  if (!(end > start)) return null
  return { start, end, matchedBy: 'relative-range-map' }
}

export function mapChunkOffsetToAbsolute(chunk, relativeStart, relativeEnd) {
  const viaMap = mapChunkRelativeViaRangeMap(chunk, relativeStart, relativeEnd)
  if (viaMap) return viaMap

  const chunkStart = Number(chunk?.start || 0)
  const rawChunkText = String(chunk?.text ?? chunk?.rawText ?? '')
  if (rawChunkText) {
    const info = normalizeTextWithIndexMap(rawChunkText)
    // relativeStart/End 可能已是 raw 下标（findIssueRangeDetailed 返回 raw）
    const asRaw = {
      start: chunkStart + Number(relativeStart),
      end: chunkStart + Number(relativeEnd),
      matchedBy: 'chunk-start-offset'
    }
    // 若像 normalized 下标，再尝试映射
    if (
      Number(relativeEnd) <= info.normalized.length
      && info.normalized
      && info.normalized.length !== info.raw.length
    ) {
      const mapped = mapNormalizedRangeToRawRange(info, Number(relativeStart), Number(relativeEnd))
      if (mapped) {
        return {
          start: chunkStart + Number(mapped.rawStart || 0),
          end: chunkStart + Number(mapped.rawEnd || 0),
          matchedBy: 'chunk-start-normalized'
        }
      }
    }
    return asRaw
  }
  return {
    start: chunkStart + Number(relativeStart),
    end: chunkStart + Number(relativeEnd),
    matchedBy: 'chunk-start-offset'
  }
}

function scoreFindCandidate(matchStart, hintStart, prefix, suffix, before, after) {
  let score = 0
  const hint = Number(hintStart) || 0
  const distance = Math.abs(matchStart - hint)
  score += Math.max(0, 5000 - distance)
  const p = normalizeComparableAnchorText(prefix)
  const s = normalizeComparableAnchorText(suffix)
  const beforeN = normalizeComparableAnchorText(before)
  const afterN = normalizeComparableAnchorText(after)
  if (p && beforeN.endsWith(p)) score += 2000 + p.length
  else if (p && beforeN.includes(p)) score += 800
  if (s && afterN.startsWith(s)) score += 2000 + s.length
  else if (s && afterN.includes(s)) score += 800
  return score
}

/**
 * 用 WPS Find 按原文定位真实 Range（表格漂移时的权威来源）。
 */
export function findTextRangeInDocument(doc, expectedText, {
  hintStart = 0,
  prefix = '',
  suffix = '',
  maxMatches = 40
} = {}) {
  const needle = String(expectedText || '')
  if (!doc || !needle) return null
  // 单字错别字在表格中很常见，不能拒绝 length===1
  if (normalizeComparableAnchorText(needle).length < 1) return null

  try {
    const docEnd = Number(doc?.Content?.End || 0)
    if (!(docEnd > 0)) return null
    const want = normalizeComparableAnchorText(needle)
    const matches = []
    let cursor = 0
    let guard = 0
    const limit = Math.min(Math.max(Number(maxMatches) || 40, 1), 80)

    while (cursor < docEnd && guard < 400 && matches.length < limit) {
      guard += 1
      let r
      try {
        r = doc.Range(cursor, docEnd)
      } catch {
        break
      }
      const find = r?.Find
      if (!find) break
      try { find.ClearFormatting?.() } catch { /* ignore */ }
      try {
        find.Text = needle
        find.Forward = true
        find.MatchWildcards = false
      } catch { /* ignore */ }
      let ok = false
      try {
        ok = !!find.Execute()
      } catch {
        ok = false
      }
      if (!ok) break
      const mStart = Number(r.Start)
      const mEnd = Number(r.End)
      if (!(mEnd > mStart)) break

      const live = liveRangeText(doc, mStart, mEnd)
      if (normalizeComparableAnchorText(live) === want) {
        const before = liveRangeText(doc, Math.max(0, mStart - 24), mStart)
        const after = liveRangeText(doc, mEnd, Math.min(docEnd, mEnd + 24))
        matches.push({
          start: mStart,
          end: mEnd,
          score: scoreFindCandidate(mStart, hintStart, prefix, suffix, before, after)
        })
      }
      cursor = mEnd > cursor ? mEnd : cursor + 1
    }

    if (!matches.length) return null
    matches.sort((a, b) => b.score - a.score || a.start - b.start)
    const best = matches[0]
    const second = matches[1]
    // 无上下文且多命中过近时，仍取 hint 最近（score 已含距离）
    if (second && best.score - second.score < 50 && !prefix && !suffix) {
      // 仍返回 best（按 hint 距离），但标记 ambiguous
      return {
        start: best.start,
        end: best.end,
        matchedBy: 'word-find',
        reasonCode: 'word_find_ambiguous',
        reasonLabel: 'Word查找定位（存在相近重复，已按邻近位置选取）'
      }
    }
    return {
      start: best.start,
      end: best.end,
      matchedBy: 'word-find',
      reasonCode: 'word_find_relocated',
      reasonLabel: 'Word查找重定位（规避表格坐标漂移）'
    }
  } catch {
    return null
  }
}

function rangesMatchExpected(doc, start, end, expectedText) {
  const live = normalizeComparableAnchorText(liveRangeText(doc, start, end))
  const want = normalizeComparableAnchorText(expectedText)
  return !!want && live === want
}

/**
 * 在已知 chunk 相对 range 时，解析并复核绝对 Range。
 * 顺序：relativeRangeMap → chunkStart+offset → live 复核 → Find 兜底。
 */
export function resolveAbsoluteAnchorFromChunkRange(doc, {
  chunkStart = 0,
  chunkEnd = null,
  chunkText = '',
  relativeRangeMap = null,
  relativeStart,
  relativeEnd,
  expectedText = '',
  prefix = '',
  suffix = '',
  matchReasonCode = '',
  matchReasonLabel = ''
} = {}) {
  const text = String(expectedText || '').trim()
  if (!doc || !text) {
    return { ok: false, reasonCode: 'missing_anchor', reasonLabel: '缺少定位片段' }
  }

  const chunk = {
    start: Number(chunkStart) || 0,
    end: Number.isFinite(Number(chunkEnd)) ? Number(chunkEnd) : undefined,
    text: String(chunkText || ''),
    relativeRangeMap: Array.isArray(relativeRangeMap) ? relativeRangeMap : []
  }

  const candidates = []
  const viaMap = mapChunkRelativeViaRangeMap(chunk, relativeStart, relativeEnd)
  if (viaMap) candidates.push(viaMap)
  candidates.push({
    start: chunk.start + Number(relativeStart),
    end: chunk.start + Number(relativeEnd),
    matchedBy: 'chunk-start-offset'
  })

  for (const cand of candidates) {
    if (!cand || !(Number(cand.end) > Number(cand.start))) continue
    if (rangesMatchExpected(doc, cand.start, cand.end, text)) {
      return {
        ok: true,
        start: cand.start,
        end: cand.end,
        reasonCode: matchReasonCode || cand.matchedBy || 'verified_offset',
        reasonLabel: matchReasonLabel || '坐标复核通过',
        matchedBy: cand.matchedBy
      }
    }
  }

  // 2) 在 chunk 绝对范围内用 Find（缩小歧义）
  const hint = candidates[0]?.start ?? chunk.start
  let scoped = null
  if (Number.isFinite(chunk.end) && chunk.end > chunk.start) {
    // 先用全文 Find，再用 hint；scoped Find 在部分 WPS 上不稳定
    scoped = findTextRangeInDocument(doc, text, {
      hintStart: hint,
      prefix,
      suffix
    })
  } else {
    scoped = findTextRangeInDocument(doc, text, {
      hintStart: hint,
      prefix,
      suffix
    })
  }

  if (scoped && rangesMatchExpected(doc, scoped.start, scoped.end, text)) {
    return {
      ok: true,
      start: scoped.start,
      end: scoped.end,
      reasonCode: scoped.reasonCode || 'word_find_relocated',
      reasonLabel: scoped.reasonLabel || 'Word查找重定位（规避表格坐标漂移）',
      matchedBy: scoped.matchedBy || 'word-find'
    }
  }

  return {
    ok: false,
    reasonCode: 'anchor_drift_unresolved',
    reasonLabel: '表格/坐标漂移后仍无法可靠定位到原文'
  }
}
