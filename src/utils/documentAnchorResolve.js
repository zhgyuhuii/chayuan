/**
 * WPS/Word 文档锚点解析与精确批注。
 *
 * 表格场景关键事实：
 * 1) chunk 字符串下标 + chunkStart ≠ Range 绝对坐标（单元格标记 \\u0007 / 空段）
 * 2) Comments.Add 会在文中插入批注锚点字符，且若 Range 碰到行/格尾标记会挂错或失败
 * 3) 重复短词仅靠 live 文本相等会误收漂移候选
 *
 * 权威路径：Find 锁定原文 → 裁掉尾部标记 → Select → Comments.Add → 回读 Scope 复核。
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

function scoreFindCandidate(matchStart, hintStart, prefix, suffix, before, after) {
  let score = 0
  const hint = Number(hintStart) || 0
  const distance = Math.abs(matchStart - hint)
  score += Math.max(0, 8000 - distance)
  const p = normalizeComparableAnchorText(prefix)
  const s = normalizeComparableAnchorText(suffix)
  const beforeN = normalizeComparableAnchorText(before)
  const afterN = normalizeComparableAnchorText(after)
  if (p && beforeN.endsWith(p)) score += 5000 + p.length * 10
  else if (p && beforeN.includes(p)) score += 1200
  if (s && afterN.startsWith(s)) score += 5000 + s.length * 10
  else if (s && afterN.includes(s)) score += 1200
  return score
}

/**
 * 裁掉 Range 尾部的段落/单元格/批注锚点标记，避免挂到整格或行尾。
 */
export function trimDocumentRangeEndMarks(doc, start, end) {
  let s = Number(start)
  let e = Number(end)
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return { start: s, end: e }
  let guard = 0
  while (e > s && guard < 8) {
    guard += 1
    let ch = ''
    try {
      ch = String(doc.Range(e - 1, e)?.Text || '')
    } catch {
      break
    }
    // \\u0007 单元格/行标记；\\r 段尾；\\u0001/\\u0005 等为批注/特殊锚点
    if (ch === '\r' || ch === '\n' || ch === '\u0007' || ch === '\u0001' || ch === '\u0005' || ch === '\u0002') {
      e -= 1
      continue
    }
    break
  }
  return { start: s, end: e }
}

function rangesMatchExpected(doc, start, end, expectedText) {
  const live = normalizeComparableAnchorText(liveRangeText(doc, start, end))
  const want = normalizeComparableAnchorText(expectedText)
  return !!want && live === want
}

/**
 * 用 WPS Find 枚举全部命中并按 hint/上下文打分。
 */
export function findTextRangeInDocument(doc, expectedText, {
  hintStart = 0,
  prefix = '',
  suffix = '',
  sentence = '',
  maxMatches = 60
} = {}) {
  const needle = String(expectedText || '')
  if (!doc || !needle) return null
  if (normalizeComparableAnchorText(needle).length < 1) return null

  try {
    const docEnd = Number(doc?.Content?.End || 0)
    if (!(docEnd > 0)) return null
    const want = normalizeComparableAnchorText(needle)
    const sentenceN = normalizeComparableAnchorText(sentence)
    const matches = []
    let cursor = 0
    let guard = 0
    const limit = Math.min(Math.max(Number(maxMatches) || 60, 1), 100)

    while (cursor < docEnd && guard < 500 && matches.length < limit) {
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
        find.Wrap = 0 // wdFindStop
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

      const trimmed = trimDocumentRangeEndMarks(doc, mStart, mEnd)
      const live = liveRangeText(doc, trimmed.start, trimmed.end)
      if (normalizeComparableAnchorText(live) === want) {
        const before = liveRangeText(doc, Math.max(0, trimmed.start - 36), trimmed.start)
        const after = liveRangeText(doc, trimmed.end, Math.min(docEnd, trimmed.end + 36))
        let score = scoreFindCandidate(trimmed.start, hintStart, prefix, suffix, before, after)
        if (sentenceN) {
          const window = normalizeComparableAnchorText(before + live + after)
          if (window.includes(sentenceN)) score += 8000 + sentenceN.length
        }
        matches.push({
          start: trimmed.start,
          end: trimmed.end,
          score,
          // 保留 Find 命中时的 Range 快照坐标（Add 前）
          findStart: mStart,
          findEnd: mEnd
        })
      }
      // 批注锚点可能占 1~2 字符；搜索步进至少 +1，表格内宁可多跳
      cursor = (mEnd > cursor ? mEnd : cursor + 1)
    }

    if (!matches.length) return null
    matches.sort((a, b) => b.score - a.score || a.start - b.start)
    const best = matches[0]
    const second = matches[1]
    const ambiguous = !!(second && best.score - second.score < 80)
    return {
      start: best.start,
      end: best.end,
      matchCount: matches.length,
      ambiguous,
      matchedBy: 'word-find',
      reasonCode: ambiguous ? 'word_find_ambiguous' : 'word_find_exact',
      reasonLabel: ambiguous
        ? 'Word查找定位（存在相近重复，已按上下文/邻近位置选取）'
        : 'Word查找精确定位'
    }
  } catch {
    return null
  }
}

/**
 * 解析绝对锚点：Find 优先；offset/map 仅作 hint，且短词/多命中时不得单独胜出。
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
  sentence = '',
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

  const viaMap = mapChunkRelativeViaRangeMap(chunk, relativeStart, relativeEnd)
  const viaOffset = {
    start: chunk.start + Number(relativeStart),
    end: chunk.start + Number(relativeEnd),
    matchedBy: 'chunk-start-offset'
  }
  const hint = Number(viaMap?.start ?? viaOffset.start) || chunk.start

  // 权威：始终跑 Find；短词或可能重复时禁止只用 offset
  const found = findTextRangeInDocument(doc, text, {
    hintStart: hint,
    prefix,
    suffix,
    sentence
  })
  if (found && rangesMatchExpected(doc, found.start, found.end, text)) {
    return {
      ok: true,
      start: found.start,
      end: found.end,
      reasonCode: found.reasonCode || 'word_find_exact',
      reasonLabel: found.reasonLabel || 'Word查找精确定位',
      matchedBy: 'word-find',
      matchCount: found.matchCount,
      ambiguous: !!found.ambiguous
    }
  }

  // Find 失败时才回退：map/offset 必须 live 复核通过
  for (const cand of [viaMap, viaOffset]) {
    if (!cand || !(Number(cand.end) > Number(cand.start))) continue
    const trimmed = trimDocumentRangeEndMarks(doc, cand.start, cand.end)
    if (rangesMatchExpected(doc, trimmed.start, trimmed.end, text)) {
      return {
        ok: true,
        start: trimmed.start,
        end: trimmed.end,
        reasonCode: matchReasonCode || cand.matchedBy || 'verified_offset',
        reasonLabel: matchReasonLabel || '坐标复核通过（Find 未命中）',
        matchedBy: cand.matchedBy
      }
    }
  }

  return {
    ok: false,
    reasonCode: 'anchor_drift_unresolved',
    reasonLabel: '无法将批注精确锚到原文（表格坐标/查找均失败）'
  }
}

function readCommentScope(comment) {
  try {
    const scope = comment?.Scope || comment?.Reference || null
    if (!scope) return null
    return {
      start: Number(scope.Start),
      end: Number(scope.End),
      text: String(scope.Text || '')
    }
  } catch {
    return null
  }
}

/**
 * 将批注精确钉到原文：Find → 裁尾标 → Select → Add → Scope 复核。
 */
export function addCommentPinnedToExactText(doc, expectedText, commentText, {
  hintStart = 0,
  prefix = '',
  suffix = '',
  sentence = '',
  preferredStart = null,
  preferredEnd = null
} = {}) {
  const text = String(expectedText || '').trim()
  const body = String(commentText || '')
  if (!doc?.Comments || !text || !body) {
    return { ok: false, reasonCode: 'missing_anchor', reasonLabel: '缺少定位片段或批注内容' }
  }

  let start = Number(preferredStart)
  let end = Number(preferredEnd)
  let matchedBy = 'preferred-range'
  let reasonCode = 'preferred_range'
  let reasonLabel = '使用已解析坐标'

  const preferOk = Number.isFinite(start) && Number.isFinite(end) && end > start
    && rangesMatchExpected(doc, start, end, text)

  if (!preferOk) {
    const found = findTextRangeInDocument(doc, text, {
      hintStart: Number.isFinite(start) ? start : hintStart,
      prefix,
      suffix,
      sentence
    })
    if (!found) {
      return { ok: false, reasonCode: 'anchor_not_found', reasonLabel: '未找到定位点' }
    }
    start = found.start
    end = found.end
    matchedBy = found.matchedBy
    reasonCode = found.reasonCode
    reasonLabel = found.reasonLabel
  } else {
    const trimmed = trimDocumentRangeEndMarks(doc, start, end)
    start = trimmed.start
    end = trimmed.end
  }

  if (!rangesMatchExpected(doc, start, end, text)) {
    return { ok: false, reasonCode: 'anchor_mismatch', reasonLabel: '定位文本与原文不一致' }
  }

  const tryAddAt = (s, e) => {
    const range = doc.Range(s, e)
    // WPS 部分版本对表格批注更认 Selection
    try { range.Select?.() } catch { /* ignore */ }
    let comment = null
    try {
      // 优先 Range.Comments.Add（Word 宏常见写法，表格更稳）
      if (range.Comments && typeof range.Comments.Add === 'function') {
        comment = range.Comments.Add(range, body)
      } else {
        comment = doc.Comments.Add(range, body)
      }
    } catch {
      try {
        const sel = window.Application?.Selection?.Range
        if (sel) comment = doc.Comments.Add(sel, body)
      } catch { /* ignore */ }
    }
    return comment
  }

  let comment = null
  try {
    comment = tryAddAt(start, end)
  } catch (e) {
    // 行尾标记错误：再收缩 1 格重试
    if (end - 1 > start) {
      try { comment = tryAddAt(start, end - 1) } catch { /* ignore */ }
    }
    if (!comment) {
      console.warn('addCommentPinnedToExactText failed:', e)
      return { ok: false, reasonCode: 'wps_comment_failed', reasonLabel: 'WPS 批注写入失败' }
    }
  }

  if (!comment) {
    return { ok: false, reasonCode: 'wps_comment_failed', reasonLabel: 'WPS 批注写入失败' }
  }

  const scope = readCommentScope(comment)
  if (scope && Number.isFinite(scope.start) && Number.isFinite(scope.end) && scope.end > scope.start) {
    const scopeOk = normalizeComparableAnchorText(scope.text) === normalizeComparableAnchorText(text)
      || rangesMatchExpected(doc, scope.start, scope.end, text)
    if (!scopeOk) {
      // Scope 被扩到整格/整段：再尝试一次「Find + Selection」强绑
      const again = findTextRangeInDocument(doc, text, {
        hintStart: start,
        prefix,
        suffix,
        sentence
      })
      if (again) {
        try {
          const r2 = doc.Range(again.start, again.end)
          r2.Select?.()
          const c2 = doc.Comments.Add(window.Application.Selection.Range, body)
          const scope2 = readCommentScope(c2)
          if (scope2 && rangesMatchExpected(doc, scope2.start, scope2.end, text)) {
            // 尽力删除误挂的第一条（忽略失败）
            try { comment.Delete?.() } catch { /* ignore */ }
            return {
              ok: true,
              start: scope2.start,
              end: scope2.end,
              reasonCode: 'word_find_selection_rebind',
              reasonLabel: 'Selection 重绑后精确锚到原文',
              matchedBy: 'word-find-selection',
              scope: scope2
            }
          }
        } catch { /* ignore */ }
      }
      return {
        ok: true,
        start,
        end,
        reasonCode: 'comment_scope_expanded',
        reasonLabel: '已添加批注，但 WPS 将锚点扩展到更大范围（常见于表格单元格）',
        matchedBy,
        scope,
        warning: 'scope_expanded'
      }
    }
    return {
      ok: true,
      start: scope.start,
      end: scope.end,
      reasonCode,
      reasonLabel,
      matchedBy,
      scope
    }
  }

  return {
    ok: true,
    start,
    end,
    reasonCode,
    reasonLabel,
    matchedBy
  }
}

// 兼容旧导出名
export function mapChunkOffsetToAbsolute(chunk, relativeStart, relativeEnd) {
  const viaMap = mapChunkRelativeViaRangeMap(chunk, relativeStart, relativeEnd)
  if (viaMap) return viaMap
  const chunkStart = Number(chunk?.start || 0)
  return {
    start: chunkStart + Number(relativeStart),
    end: chunkStart + Number(relativeEnd),
    matchedBy: 'chunk-start-offset'
  }
}
