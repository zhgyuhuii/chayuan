// Markdown -> WPS 文档 富格式渲染。
// 解析器(parseMarkdownBlocks)为纯函数,可单元测试;渲染器(renderMarkdownBlocksToDocument)走
// WPS COM,逐块 try/catch:任一块富渲染失败则以纯文本兜底,整体失败由调用方退回原始文本插入。

function toDocText(text) {
  return String(text || '').replace(/\r\n/g, '\r').replace(/\n/g, '\r')
}

// 行内:把 **加粗** 解析成 runs;去掉 `代码`、*斜体*、[文字](链接) 等语法符号,保留可读文本。
export function parseInlineRuns(text) {
  let s = String(text || '')
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '')          // 图片
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')        // 链接 -> 文字
  s = s.replace(/`([^`]+)`/g, '$1')                    // 行内代码
  const runs = []
  const re = /\*\*([^*]+)\*\*|__([^_]+)__/g
  let last = 0, m
  const pushPlain = (t) => { if (t) runs.push({ text: t.replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1'), bold: false }) }
  while ((m = re.exec(s)) !== null) {
    pushPlain(s.slice(last, m.index))
    runs.push({ text: m[1] || m[2] || '', bold: true })
    last = m.index + m[0].length
  }
  pushPlain(s.slice(last))
  return runs.filter(r => r.text)
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(line)
}
function splitTableRow(line) {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map(c => c.trim())
}

// 解析为块数组:{type:'heading',level,runs} | {type:'paragraph',runs} | {type:'list',ordered,items:[runs]} | {type:'table',headers:[],rows:[[]]}
/**
 * CJK 感知的软换行合并：前一字符是 CJK/全角时无缝拼接（中文断行无空格），
 * 否则按英文惯例补空格。2026-11-21「大美河/山」碎裂教训：模型会手动断行，
 * 逐行成块=每行一个段落，文档碎成渣。
 */
function joinSoftLines(a, b) {
  const prev = String(a || '').slice(-1)
  const next = String(b || '').slice(0, 1)
  if (!prev) return b
  if (!next) return a
  const cjk = (ch) => /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef「」『』]/.test(ch)
  return (cjk(prev) || cjk(next)) ? a + b : a + ' ' + b
}

export function parseMarkdownBlocks(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const blocks = []
  let inFence = false
  let pendingPlain = ''          // 连续普通行缓冲（标准 markdown：空行才是段落边界）
  let pendingPlainClosable = false // 上一行是否普通行（列表续行判定用）
  const flushPlain = () => {
    if (pendingPlain.trim()) blocks.push({ type: 'paragraph', runs: parseInlineRuns(pendingPlain.trim()) })
    pendingPlain = ''
  }
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.replace(/\s+$/, '')
    if (/^\s*```/.test(line)) { flushPlain(); inFence = !inFence; pendingPlainClosable = false; continue }
    if (inFence) {
      pendingPlain = joinSoftLines(pendingPlain, line)
      pendingPlainClosable = true
      continue
    }
    if (!line.trim()) { flushPlain(); pendingPlainClosable = false; continue }
    // 表格:当前行含 | 且下一行是分隔行
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushPlain()
      const headers = splitTableRow(line)
      const rows = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() && !isTableSeparator(lines[i])) {
        rows.push(splitTableRow(lines[i])); i++
      }
      i--
      blocks.push({ type: 'table', headers, rows })
      pendingPlainClosable = false
      continue
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) { flushPlain(); blocks.push({ type: 'heading', level: h[1].length, runs: parseInlineRuns(h[2]) }); pendingPlainClosable = false; continue }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/)
    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/)
    if (ul || ol) {
      flushPlain()
      const ordered = !!ol
      const item = parseInlineRuns(ul ? ul[1] : ol[2])
      const prev = blocks[blocks.length - 1]
      if (prev && prev.type === 'list' && prev.ordered === ordered) prev.items.push(item)
      else blocks.push({ type: 'list', ordered, items: [item] })
      pendingPlainClosable = true
      continue
    }
    // 列表项的续行（紧贴上一条列表行、无空行分隔）→ 并入该条目，不另起段落
    const prevBlock = blocks[blocks.length - 1]
    if (pendingPlainClosable && !pendingPlain.trim() && prevBlock && prevBlock.type === 'list' && prevBlock.items.length) {
      const joined = joinSoftLines(prevBlock.items[prevBlock.items.length - 1].map(r => r.text).join(''), line.trim())
      prevBlock.items[prevBlock.items.length - 1] = parseInlineRuns(joined)
      continue
    }
    // 引用 > 去标记；普通行进缓冲合并（软换行容忍——模型手动断行不再碎成多段落）
    const q = line.match(/^\s*>\s?(.*)$/)
    pendingPlain = joinSoftLines(pendingPlain, q ? q[1] : line)
    pendingPlainClosable = true
  }
  flushPlain()
  return blocks
}

export function markdownHasRichContent(markdown) {
  const s = String(markdown || '')
  return /(^|\n)\s*\|.*\|/.test(s) || /(^|\n)#{1,6}\s/.test(s) || /\*\*[^*]+\*\*/.test(s) || /(^|\n)\s*[-*+]\s+/.test(s) || /(^|\n)\s*\d+[.)]\s+/.test(s)
}

const HEADING_SIZE = { 1: 18, 2: 16, 3: 14, 4: 13, 5: 12, 6: 12 }

// 在 doc 文本位置 startPos 处依序渲染块;返回渲染结束位置。逐块 try/catch 兜底为纯文本。
/**
 * markdown 标题级 → 文档内置样式（用户裁决 2026-11-21：md 标题必须与文档样式体系
 * 一致——「标题 1/2/3」，而非手动加粗字号的伪标题）。真实样式才能被目录域识别、
 * 进导航窗格、随文档主题变化。三级兜底：wdStyle 枚举常量 → 中文样式名 → 英文样式名；
 * 全失败返回 false，由调用方回落手动字号加粗（旧视觉兜底不丢）。
 */
const HEADING_WD_STYLE = { 1: -2, 2: -3, 3: -4 } // wdStyleHeading1/2/3
function applyHeadingStyleToRange(doc, hr, level) {
  const lv = Number(level) || 1
  const wdId = HEADING_WD_STYLE[lv]
  if (wdId !== undefined) {
    try { hr.Style = wdId; return true } catch (_) { /* 枚举常量形态不可用 */ }
  }
  for (const name of [`标题 ${lv}`, `Heading ${lv}`]) {
    try { hr.Style = name; return true } catch (_) { /* 该名称形态不可用 */ }
  }
  return false
}

export function renderMarkdownBlocksToDocument(doc, startPos, blocks) {
  let pos = Number(startPos) || 0
  const insertPlainParagraph = (text) => {
    const t = toDocText(text)
    const r = doc.Range(pos, pos)
    r.InsertAfter(t + '\r')
    pos = pos + t.length + 1
    return { start: pos - t.length - 1, end: pos - 1 }
  }
  const applyRunsBold = (paraStart, runs) => {
    let cur = paraStart
    for (const run of runs) {
      const txt = toDocText(run.text)
      const rEnd = cur + txt.length
      if (run.bold) { try { doc.Range(cur, rEnd).Font.Bold = true } catch (_) { /* 加粗失败忽略 */ } }
      cur = rEnd
    }
  }
  for (const b of blocks) {
    try {
      if (b.type === 'table' && doc?.Tables && typeof doc.Tables.Add === 'function') {
        const nCols = Math.max(1, b.headers.length)
        const all = [b.headers, ...b.rows]
        const nRows = Math.max(1, all.length)
        const table = doc.Tables.Add(doc.Range(pos, pos), nRows, nCols)
        for (let ri = 0; ri < all.length; ri++) {
          for (let ci = 0; ci < nCols; ci++) {
            try { table.Cell(ri + 1, ci + 1).Range.Text = toDocText(String(all[ri][ci] != null ? all[ri][ci] : '')) } catch (_) { /* 单元格忽略 */ }
          }
        }
        try { if (table.Rows && table.Rows.First && table.Rows.First.Range) table.Rows.First.Range.Font.Bold = true } catch (_) { /* 表头加粗忽略 */ }
        pos = Number(table.Range.End) || pos
      } else if (b.type === 'heading') {
        const text = b.runs.map(r => r.text).join('')
        const seg = insertPlainParagraph(text)
        try {
          const hr = doc.Range(seg.start, seg.end)
          // 样式优先（标题 1/2/3，目录域可识别）；样式不可用回落手动字号加粗
          if (!applyHeadingStyleToRange(doc, hr, b.level)) {
            hr.Font.Bold = true
            hr.Font.Size = HEADING_SIZE[b.level] || 13
          }
        } catch (_) { /* 标题样式忽略 */ }
      } else if (b.type === 'list') {
        b.items.forEach((runs, idx) => {
          const prefix = b.ordered ? `${idx + 1}. ` : '• '
          const text = prefix + runs.map(r => r.text).join('')
          const seg = insertPlainParagraph(text)
          applyRunsBold(seg.start + prefix.length, runs)
        })
      } else {
        const text = b.runs.map(r => r.text).join('')
        const seg = insertPlainParagraph(text)
        applyRunsBold(seg.start, b.runs)
      }
    } catch (_) {
      // 单块整体失败:退回纯文本插入,不中断后续块
      try { insertPlainParagraph(b.runs ? b.runs.map(r => r.text).join('') : '') } catch (__) { /* ignore */ }
    }
  }
  return pos
}

