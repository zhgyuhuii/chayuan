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
export function parseMarkdownBlocks(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const blocks = []
  let inFence = false
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.replace(/\s+$/, '')
    if (/^\s*```/.test(line)) { inFence = !inFence; continue }
    if (inFence) { if (line.trim()) blocks.push({ type: 'paragraph', runs: [{ text: line, bold: false }] }); continue }
    if (!line.trim()) continue
    // 表格:当前行含 | 且下一行是分隔行
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line)
      const rows = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() && !isTableSeparator(lines[i])) {
        rows.push(splitTableRow(lines[i])); i++
      }
      i--
      blocks.push({ type: 'table', headers, rows })
      continue
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) { blocks.push({ type: 'heading', level: h[1].length, runs: parseInlineRuns(h[2]) }); continue }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/)
    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/)
    if (ul || ol) {
      const ordered = !!ol
      const item = parseInlineRuns(ul ? ul[1] : ol[2])
      const prev = blocks[blocks.length - 1]
      if (prev && prev.type === 'list' && prev.ordered === ordered) prev.items.push(item)
      else blocks.push({ type: 'list', ordered, items: [item] })
      continue
    }
    // 引用 > 去标记
    const q = line.match(/^\s*>\s?(.*)$/)
    blocks.push({ type: 'paragraph', runs: parseInlineRuns(q ? q[1] : line) })
  }
  return blocks
}

export function markdownHasRichContent(markdown) {
  const s = String(markdown || '')
  return /(^|\n)\s*\|.*\|/.test(s) || /(^|\n)#{1,6}\s/.test(s) || /\*\*[^*]+\*\*/.test(s) || /(^|\n)\s*[-*+]\s+/.test(s) || /(^|\n)\s*\d+[.)]\s+/.test(s)
}

const HEADING_SIZE = { 1: 18, 2: 16, 3: 14, 4: 13, 5: 12, 6: 12 }

// 在 doc 文本位置 startPos 处依序渲染块;返回渲染结束位置。逐块 try/catch 兜底为纯文本。
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
        try { const hr = doc.Range(seg.start, seg.end); hr.Font.Bold = true; hr.Font.Size = HEADING_SIZE[b.level] || 13 } catch (_) { /* 标题样式忽略 */ }
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

