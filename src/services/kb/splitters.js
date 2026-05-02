/**
 * splitters — T1 结构切分 + T2 自适应归并
 *
 * 详见 plan-knowledge-base-integration.md §3.2.5.2 / §3.2.5.5
 *
 * v1 stub:导出真实接口签名 + 朴素实现;Phase 3 完成完整版。
 */

const SENTENCE_BREAKS = /([。！？；!?;]|\.\s+|\n)/g

export function splitByStructure(text) {
  const t = String(text || '')
  if (!t) return []
  // Markdown heading 优先(支持 # / ## / ###)
  const headingRe = /^(#{1,6})\s+(.+)$/gm
  const matches = [...t.matchAll(headingRe)]
  if (matches.length >= 2) {
    const out = []
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index
      const end = i + 1 < matches.length ? matches[i + 1].index : t.length
      const section = t.slice(start, end).trim()
      if (section) out.push({ id: `s${i}`, text: section, kind: 'heading' })
    }
    return out
  }
  // 退化:段落(\n\n+)
  return splitByParagraph(t)
}

export function splitByParagraph(text) {
  const t = String(text || '')
  if (!t) return []
  const parts = t.split(/\n{2,}/g).map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return []
  return parts.map((p, i) => ({ id: `p${i}`, text: p, kind: 'paragraph' }))
}

export function splitBySentenceWindow(text, maxLen = 400, overlap = 80) {
  const t = String(text || '')
  if (!t) return []
  // 按句标点切句,再用 maxLen/overlap 滑窗合并
  const sentences = []
  let buf = ''
  for (const ch of t) {
    buf += ch
    if (/[。！？；!?;\n]/.test(ch)) {
      if (buf.trim()) sentences.push(buf.trim())
      buf = ''
    }
  }
  if (buf.trim()) sentences.push(buf.trim())
  if (sentences.length === 0) return [{ id: 'w0', text: t, kind: 'window' }]

  const out = []
  let cursor = 0
  let idx = 0
  while (cursor < sentences.length) {
    let curLen = 0
    let end = cursor
    while (end < sentences.length && curLen + sentences[end].length <= maxLen) {
      curLen += sentences[end].length
      end++
    }
    if (end === cursor) end = cursor + 1
    const chunk = sentences.slice(cursor, end).join('')
    out.push({ id: `w${idx++}`, text: chunk, kind: 'window' })
    if (end >= sentences.length) break
    // overlap:回退至少 1 句以保留上下文
    let back = end - 1
    let backLen = sentences[back]?.length || 0
    while (back > cursor && backLen < overlap) {
      back--
      backLen += sentences[back]?.length || 0
    }
    cursor = back + 1
    if (cursor <= 0) cursor = end
  }
  return out
}

export function mergeShort(units, minLen = 120) {
  if (!Array.isArray(units) || units.length === 0) return []
  const out = []
  for (const u of units) {
    const last = out[out.length - 1]
    if (last && (u.text || '').length < minLen && (last.text || '').length < minLen * 3) {
      last.text = `${last.text}\n${u.text}`
      last.id = `${last.id}+${u.id}`
    } else {
      out.push({ ...u })
    }
  }
  return out
}

export function splitLong(units, { maxLen = 800, window = 400, overlap = 80 } = {}) {
  if (!Array.isArray(units)) return []
  const out = []
  for (const u of units) {
    const text = u.text || ''
    if (text.length <= maxLen) {
      out.push(u)
      continue
    }
    const subs = splitBySentenceWindow(text, window, overlap)
    subs.forEach((s, i) => out.push({
      id: `${u.id}.${i}`,
      text: s.text,
      kind: u.kind,
      parentId: u.id
    }))
  }
  return out
}

/** T1 + T2 一起跑,给 queryPlanner 用 */
export function planUnits(text, { minLen = 120, maxLen = 800, window = 400, overlap = 80 } = {}) {
  let units = splitByStructure(text)
  if (units.length === 0) units = splitByParagraph(text)
  if (units.length === 0) units = splitBySentenceWindow(text, window, overlap)
  units = mergeShort(units, minLen)
  units = splitLong(units, { maxLen, window, overlap })
  return units
}

export default {
  splitByStructure, splitByParagraph, splitBySentenceWindow,
  mergeShort, splitLong, planUnits
}
