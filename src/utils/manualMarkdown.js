/**
 * Lightweight Markdown → HTML for the in-app user manual.
 * Supports: headings, paragraphs, lists, tables, fences, blockquotes,
 * hr, inline code/bold/links. Not a full CommonMark parser.
 */

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function slugify(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section'
}

function renderInline(text) {
  let s = escapeHtml(text)
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  return s
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(line)
}

function splitTableRow(line) {
  let s = String(line || '').trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

export function extractManualToc(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
  const toc = []
  const used = new Set()
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/)
    if (!m) continue
    const title = m[1].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
    if (/^目录$/.test(title)) continue
    let id = slugify(title)
    let n = 2
    while (used.has(id)) {
      id = `${slugify(title)}-${n++}`
    }
    used.add(id)
    toc.push({ id, title })
  }
  return toc
}

export function renderManualMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
  const html = []
  const usedIds = new Set()
  let i = 0
  let inFence = false
  let fenceBuf = []

  const headingId = (title) => {
    let id = slugify(title)
    let n = 2
    while (usedIds.has(id)) id = `${slugify(title)}-${n++}`
    usedIds.add(id)
    return id
  }

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.replace(/\s+$/, '')

    if (/^\s*```/.test(line)) {
      if (!inFence) {
        inFence = true
        fenceBuf = []
      } else {
        inFence = false
        html.push(`<pre><code>${escapeHtml(fenceBuf.join('\n'))}</code></pre>`)
        fenceBuf = []
      }
      i += 1
      continue
    }
    if (inFence) {
      fenceBuf.push(raw)
      i += 1
      continue
    }

    if (!line.trim()) {
      i += 1
      continue
    }

    if (/^---+\s*$/.test(line)) {
      html.push('<hr />')
      i += 1
      continue
    }

    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(line)
      const rows = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() && !isTableSeparator(lines[i])) {
        rows.push(splitTableRow(lines[i]))
        i += 1
      }
      html.push('<table><thead><tr>')
      headers.forEach((h) => html.push(`<th>${renderInline(h)}</th>`))
      html.push('</tr></thead><tbody>')
      rows.forEach((row) => {
        html.push('<tr>')
        row.forEach((cell) => html.push(`<td>${renderInline(cell)}</td>`))
        html.push('</tr>')
      })
      html.push('</tbody></table>')
      continue
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const title = h[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
      // Skip the auto "目录" section body; TOC is provided by the UI nav.
      if (level === 2 && /^目录$/.test(title)) {
        i += 1
        while (i < lines.length && !/^##\s+/.test(lines[i])) i += 1
        continue
      }
      const id = level === 2 ? headingId(title) : ''
      const idAttr = id ? ` id="${id}"` : ''
      html.push(`<h${level}${idAttr}>${renderInline(title)}</h${level}>`)
      i += 1
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const parts = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        parts.push(lines[i].replace(/^\s*>\s?/, ''))
        i += 1
      }
      html.push(`<blockquote><p>${renderInline(parts.join(' '))}</p></blockquote>`)
      continue
    }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/)
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ul || ol) {
      const ordered = !!ol
      const items = []
      while (i < lines.length) {
        const u = lines[i].match(/^\s*[-*+]\s+(.*)$/)
        const o = lines[i].match(/^\s*\d+[.)]\s+(.*)$/)
        if (ordered ? !o : !u) break
        items.push(ordered ? o[1] : u[1])
        i += 1
      }
      const tag = ordered ? 'ol' : 'ul'
      html.push(`<${tag}>${items.map((t) => `<li>${renderInline(t)}</li>`).join('')}</${tag}>`)
      continue
    }

    // Skip markdown TOC link-only lines under 目录 (already skipped as section)
    if (/^\s*\d+\.\s+\[.+\]\(#.+\)\s*$/.test(line)) {
      i += 1
      continue
    }

    html.push(`<p>${renderInline(line)}</p>`)
    i += 1
  }

  return html.join('\n')
}
