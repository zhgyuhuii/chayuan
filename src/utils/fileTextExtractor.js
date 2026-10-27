/**
 * fileTextExtractor — 文件级文本提取矩阵（file_parse 的 L1/L2 层）。
 *
 * 输入：本地路径（经 WPS FileSystem 读字节）→ 按扩展名 + 魔数分派：
 *   L1 纯文本直读（UTF-8/UTF-16/GBK 自动探测，未知扩展做二进制嗅探）
 *   L2 结构化解析：docx(mammoth) / pdf(pdfjs) / xlsx·xls·csv(SheetJS) /
 *      pptx(jszip 逐 slide) / html·htm(剥标签) / eml / zip(条目清单) / svg
 *   旧版二进制（doc/ppt/et/dps…OLE）与图片音视频不在本层——返回带 code 的错误，
 *   由 sidecar 编排 L3 宿主转换或 L4 拒绝。
 *
 * 产出统一形状：{ ok, kind, text, meta, outline }，outline 为带字符偏移的
 * 结构目录（章节/页/工作表/幻灯片），供 file_parse 的 chunk 随机访问（rangeStart）。
 */

import { normalizeText } from './textNormalize.js'
import { sampleHeadTail } from './tokenEstimator.js'

// ── 路径 → 字节 ──

/** 读本地文件字节（三级回退经验同 templateStyleReader.readTemplateBytes） */
export function readLocalFileBytes(path) {
  const fs = window.Application?.FileSystem
  if (!fs) {
    const err = new Error('WPS FileSystem 不可用，无法读取本地路径；请改用附件上传通道')
    err.code = 'FS_UNAVAILABLE'
    throw err
  }
  const native = (p) => (typeof ActiveXObject !== 'undefined' ? String(p).replace(/\//g, '\\') : String(p).replace(/\\/g, '/'))
  const p = native(path)
  if (typeof fs.ReadFileAsArrayBuffer === 'function') {
    const arr = fs.ReadFileAsArrayBuffer(p)
    if (arr) return arr instanceof ArrayBuffer ? arr : new Uint8Array(arr).buffer
  }
  if (typeof fs.readAsBinaryString === 'function') {
    const bin = fs.readAsBinaryString(p)
    if (bin) {
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff
      return bytes.buffer
    }
  }
  const err = new Error('路径不可读：' + path)
  err.code = 'PATH_UNREADABLE'
  throw err
}

// ── 扩展名 / 魔数 ──

// 已知纯文本扩展名白名单（L1）。未列出的扩展名走「魔数 + 二进制嗅探」兜底而非
// 直接拒绝——同一代码路径，未知格式（如 .gitignore 之外的私有 .prop）也能读。
// 导出供诊断/工具页展示当前文本格式覆盖面。
export const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'jsonl', 'ndjson', 'yaml', 'yml',
  'toml', 'ini', 'cfg', 'conf', 'properties', 'env', 'log', 'sql', 'diff', 'patch',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'vue', 'svelte', 'py', 'java', 'kt', 'c',
  'h', 'cpp', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'sh', 'bash', 'zsh',
  'bat', 'cmd', 'ps1', 'tex', 'rst', 'org', 'wiki', 'srt', 'vtt', 'lrc', 'ass',
  'ssa', 'sub', 'gitignore', 'editorconfig', 'htaccess', 'graphql', 'proto', 'makefile'
])

const DOCX_LIKE = new Set(['docx', 'aidocx', 'dotx'])
const SPREADSHEET_LIKE = new Set(['xlsx', 'xlsm', 'xls', 'et', 'ett', 'csv', 'tsv'])
const PPTX_LIKE = new Set(['pptx', 'ppsx', 'potx', 'dpsx'])
const HTML_LIKE = new Set(['html', 'htm', 'xhtml'])
const LEGACY_BINARY = new Set(['doc', 'ppt', 'pps', 'dps', 'et', 'ett', 'wps', 'msg', 'ofd'])
const IMAGE_LIKE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tiff', 'tif'])
const MEDIA_LIKE = new Set(['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'])

export function extensionOf(name) {
  const n = String(name || '').toLowerCase()
  const m = n.match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

function magicOf(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b) return 'zip'
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf'
  if (b.length >= 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'ole'
  return ''
}

// ── 字符集探测解码 ──

function decodeWithCharset(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  // BOM 优先
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(b.subarray(3)), charset: 'utf-8' }
  }
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(b.subarray(2)), charset: 'utf-16le' }
  }
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(b.subarray(2)), charset: 'utf-16be' }
  }
  const sample = b.subarray(0, Math.min(b.length, 65536))
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample)
    return { text: new TextDecoder('utf-8').decode(b), charset: 'utf-8' }
  } catch (_) { /* 落到 GBK */ }
  try {
    new TextDecoder('gbk', { fatal: true }).decode(sample)
    return { text: new TextDecoder('gbk').decode(b), charset: 'gbk' }
  } catch (_) { /* 落到宽松 utf-8（带替换符） */ }
  return { text: new TextDecoder('utf-8').decode(b), charset: 'utf-8-loose' }
}

/** 前 8KB 是否疑似二进制：NUL 字节即二进制；utf-8 与 gbk 双双解码失败才算二进制
 *  （纯 GBK 字节流 utf-8 必败——必须给 GBK 通道留机会） */
function looksBinary(bytes) {
  const len = Math.min(bytes.byteLength ?? (bytes.length || 0), 8192)
  const b = bytes instanceof Uint8Array ? bytes.subarray(0, len) : new Uint8Array(bytes, 0, len)
  let nulls = 0
  for (let i = 0; i < b.length; i++) if (b[i] === 0) nulls++
  if (nulls > 2) return true
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(b)
    return false
  } catch (_) { /* 落到 GBK */ }
  try {
    new TextDecoder('gbk', { fatal: true }).decode(b)
    return false
  } catch (_) {
    return true
  }
}

// ── 各格式提取器 ──

async function loadMammoth() {
  const mod = await import('mammoth')
  return mod?.default && typeof mod.default.extractRawText === 'function' ? mod.default : mod
}

async function loadPdfJs() {
  // pdfjs-dist v5 主构建需要 Promise.withResolvers（Chrome 119+）；WPS webview 的
  // CEF 内核偏旧会抛 "Promise.withResolvers is not a function"——特性检测后回落
  // legacy 构建（同版本、为旧浏览器保留的转译产物）。
  // worker 装配：legacy 直引不带 worker，需 `?url` 指定 workerSrc 起真 module
  // worker（真机实证可用）；不要用主线程 fake-worker——LoopbackPort 流式通道在
  // 旧内核挂起（300s 无响应）。主线程侧唯一不兼容点是 getTextContent 内部对
  // ReadableStream 的 for-await（Chrome 124+），由 pdfPageText 的 getReader 消费规避。
  const legacy = typeof Promise.withResolvers !== 'function'
  const mod = legacy
    ? await import('pdfjs-dist/legacy/build/pdf.mjs')
    : await import('pdfjs-dist/webpack.mjs')
  const pdfjs = mod?.default && typeof mod.default.getDocument === 'function' ? mod.default : mod
  if (pdfjs?.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
    try {
      const w = legacy
        ? await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
        : await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      if (w?.default) pdfjs.GlobalWorkerOptions.workerSrc = w.default
    } catch (_) { /* worker 资产失败时由 pdfjs 自行兜底 */ }
  }
  return pdfjs
}

async function loadXlsx() {
  const mod = await import('xlsx')
  return mod?.default && typeof mod.default.read === 'function' ? mod.default : mod
}

async function loadJsZip() {
  return (await import('jszip')).default
}

/**
 * 兼容旧内核的 pdf 页文本提取。
 * pdfjs v5 的 getTextContent 内部对 ReadableStream 做 for-await 异步迭代
 * （Chrome 124+ 才支持 ReadableStream async 迭代），旧 CEF 报
 * "t is not async iterable"——这里手动 getReader() 消费同一个流
 * （getReader 自 Chrome 43 可用），失败再回落 getTextContent。
 */
export async function pdfPageText(page) {
  try {
    if (typeof page.streamTextContent !== 'function') throw new Error('no streamTextContent')
    const stream = page.streamTextContent({ includeMarkedContent: false })
    const reader = stream.getReader()
    const items = []
    const styles = Object.create(null)
    let lang = null
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value?.lang && !lang) lang = value.lang
      if (value?.styles) Object.assign(styles, value.styles)
      if (Array.isArray(value?.items)) items.push(...value.items)
    }
    return { items, styles, lang }
  } catch (_) {
    return page.getTextContent()
  }
}

/** docx：mammoth 全文 + jszip 抽 Heading1-3 做 outline（偏移在全文里顺序定位） */
async function extractDocx(bytes) {
  const mammoth = await loadMammoth()
  const result = await mammoth.extractRawText({ arrayBuffer: bytes })
  const text = normalizeText(result?.value || '')
  const outline = []
  try {
    const JSZip = await loadJsZip()
    const zip = await JSZip.loadAsync(bytes)
    const docXml = zip.file('word/document.xml')
    if (docXml) {
      const xml = new DOMParser().parseFromString(await docXml.async('string'), 'application/xml')
      const paragraphs = Array.from(xml.getElementsByTagName('w:p'))
      let cursor = 0
      for (const p of paragraphs) {
        const styleEl = p.getElementsByTagName('w:pStyle')[0]
        const style = styleEl?.getAttribute('w:val') || ''
        if (!/^[Hh]eading[123]$|^d[123]$/.test(style)) continue
        const headingText = normalizeText(
          Array.from(p.getElementsByTagName('w:t')).map(t => t.textContent || '').join('')
        )
        if (!headingText || headingText.length > 80) continue
        const at = text.indexOf(headingText, cursor)
        if (at < 0) continue
        outline.push({ title: headingText, offset: at, charCount: headingText.length, level: Number(style.slice(-1)) || 1 })
        cursor = at + headingText.length
      }
    }
  } catch (_) { /* outline 失败不影响正文 */ }
  return { kind: 'docx', text, meta: {}, outline }
}

/** pdf：逐页文本（页码分节），outline=页 */
async function extractPdf(bytes) {
  const pdfjs = await loadPdfJs()
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false, isEvalSupported: false })
  const pdf = await loadingTask.promise
  const pages = []
  const outline = []
  let offset = 0
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await pdfPageText(page)
    const normalized = normalizeText(content.items.map(item => String(item?.str || '')).join(' '))
    const header = `第 ${i} 页`
    pages.push(`${header}\n${normalized || '（本页无可提取文本，疑似扫描件）'}`)
    outline.push({ title: header, offset, charCount: header.length + 1 + normalized.length, level: 1 })
    offset += header.length + normalized.length + 2
  }
  return { kind: 'pdf', text: normalizeText(pages.join('\n\n')), meta: { pages: pdf.numPages }, outline }
}

/** 表格：SheetJS 全表 → 「工作表：名\n行 | 行」分节，outline=工作表；sheet 参数可选单表 */
async function extractSpreadsheet(bytes, { sheet } = {}) {
  const XLSX = await loadXlsx()
  const workbook = XLSX.read(bytes, { type: 'array' })
  const names = workbook?.SheetNames || []
  const wanted = sheet && names.includes(sheet) ? [sheet] : names
  const sections = []
  const outline = []
  let offset = 0
  let totalRows = 0
  let totalCols = 0
  for (const name of wanted) {
    const s = workbook?.Sheets?.[name]
    if (!s) continue
    const rows = XLSX.utils.sheet_to_json(s, { header: 1, blankrows: false, defval: '' })
    totalRows += rows.length
    const cols = rows.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0)
    totalCols = Math.max(totalCols, cols)
    const body = rows
      .map(r => (Array.isArray(r) ? r.map(c => normalizeText(c == null ? '' : String(c))).join(' | ') : ''))
      .filter(Boolean)
      .join('\n')
    const header = `工作表：${name}（${rows.length} 行 × ${cols} 列）`
    const section = `${header}\n${body}`
    sections.push(section)
    outline.push({ title: header, offset, charCount: section.length, level: 1 })
    offset += section.length + 2
  }
  return {
    kind: 'xlsx',
    text: normalizeText(sections.join('\n\n')),
    meta: { sheets: names, rows: totalRows, cols: totalCols },
    outline
  }
}

/** pptx：jszip 逐 slide 提取 <a:t>（按文档序）+ 备注，outline=幻灯片 */
async function extractPptx(bytes) {
  const JSZip = await loadJsZip()
  const zip = await JSZip.loadAsync(bytes)
  const slideFiles = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]))
  if (!slideFiles.length) throw new Error('pptx 内无幻灯片')
  const sections = []
  const outline = []
  let offset = 0
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = new DOMParser().parseFromString(await zip.file(slideFiles[i]).async('string'), 'application/xml')
    const texts = Array.from(xml.getElementsByTagName('a:t')).map(t => normalizeText(t.textContent || '')).filter(Boolean)
    const noteNum = slideFiles[i].match(/(\d+)/)[1]
    const noteFile = zip.file(`ppt/notesSlides/notesSlide${noteNum}.xml`)
    let notes = ''
    if (noteFile) {
      const noteXml = new DOMParser().parseFromString(await noteFile.async('string'), 'application/xml')
      notes = normalizeText(
        Array.from(noteXml.getElementsByTagName('a:t')).map(t => t.textContent || '').join(' ')
      )
    }
    const header = `第 ${i + 1} 页`
    const body = texts.join('\n')
    const section = [header, body, notes ? `备注：${notes}` : ''].filter(Boolean).join('\n')
    sections.push(section)
    outline.push({ title: header, offset, charCount: section.length, level: 1 })
    offset += section.length + 2
  }
  return {
    kind: 'pptx',
    text: normalizeText(sections.join('\n\n')),
    meta: { slides: slideFiles.length },
    outline
  }
}

/** html/xhtml：剥 script/style，块级标签转换行，h1-h6 保留为行并做 outline。
 *  公共导出 extractHtmlText 供面板附件读取复用（HTML 原文 90%+ 是 style/script
 *  噪音，截断后模型只见 CSS 看不到正文——真机案例：架构图.html 前 12000 字符
 *  仅 17 个汉字）。 */
function extractHtml(rawText) {
  const withoutHead = String(rawText || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  const titleMatch = withoutHead.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? normalizeText(titleMatch[1]) : ''
  const headings = []
  const withHeadingMarks = withoutHead.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
    const t = normalizeText(String(inner).replace(/<[^>]+>/g, ''))
    if (t && t.length <= 120) headings.push({ title: t, level: Number(level) })
    return `\n${t}\n`
  })
  const text = normalizeText(
    String(withHeadingMarks)
      .replace(/<\/(p|div|section|article|li|tr|br|table|ul|ol|dl|dd|dt|h[1-6]|blockquote|pre)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&[a-z]+;/gi, '')
  )
  const outline = []
  let cursor = 0
  for (const h of headings) {
    const at = text.indexOf(h.title, cursor)
    if (at < 0) continue
    outline.push({ title: h.title, offset: at, charCount: h.title.length, level: h.level })
    cursor = at + h.title.length
  }
  return { kind: 'html', text, meta: title ? { title } : {}, outline }
}

/** eml：MIME 头 + 正文（quoted-printable/base64 按声明解码，charset 按声明） */
function extractEml(rawText) {
  const s = String(rawText || '')
  const divider = s.indexOf('\r\n\r\n') >= 0 ? '\r\n\r\n' : '\n\n'
  const cut = s.indexOf(divider)
  const headerBlock = cut >= 0 ? s.slice(0, cut) : s
  const bodyRaw = cut >= 0 ? s.slice(cut + divider.length) : ''
  const headerLine = (name) => {
    const m = headerBlock.match(new RegExp(`^${name}:\\s*([\\s\\S]*?)(?=\\n[^ \\t]|$)`, 'im'))
    return m ? normalizeText(String(m[1]).replace(/\r?\n[ \t]+/g, ' ')) : ''
  }
  const contentType = headerLine('Content-Transfer-Encoding') || ''
  let body = bodyRaw
  if (/quoted-printable/i.test(contentType)) {
    // QP 解出的是字节流（正文 charset 常为 utf-8）——必须按字节重新解码，
    // 直接 fromCharCode 会得到 mojibake
    const hex = body.replace(/=\r?\n/g, '')
    const bytes = []
    for (let i = 0; i < hex.length; i++) {
      if (hex[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(hex.slice(i + 1, i + 3))) {
        bytes.push(parseInt(hex.slice(i + 1, i + 3), 16))
        i += 2
      } else {
        const code = hex.charCodeAt(i)
        if (code < 256) bytes.push(code)
        else hex.slice(i, i + 1).split('').forEach(ch => { const c = ch.charCodeAt(0); bytes.push(c & 0xff, c >> 8) })
      }
    }
    try { body = new TextDecoder('utf-8').decode(new Uint8Array(bytes)) } catch (_) { /* 保留原文 */ }
  } else if (/base64/i.test(contentType)) {
    try {
      const bin = atob(bodyRaw.replace(/\s+/g, ''))
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      body = new TextDecoder('utf-8').decode(bytes)
    } catch (_) { /* 保留原文 */ }
  }
  const subject = headerLine('Subject')
  const from = headerLine('From')
  const to = headerLine('To')
  const date = headerLine('Date')
  const text = normalizeText(
    ['主题：' + subject, from && `发件人：${from}`, to && `收件人：${to}`, date && `时间：${date}`, '', body]
      .filter(l => l !== undefined)
      .join('\n')
  )
  return { kind: 'eml', text, meta: { subject }, outline: subject ? [{ title: subject, offset: 0, charCount: subject.length, level: 1 }] : [] }
}

/** zip：条目清单（名字 + 解压大小），正文即清单文本 */
async function extractZipListing(bytes) {
  const JSZip = await loadJsZip()
  const zip = await JSZip.loadAsync(bytes)
  const entries = Object.values(zip.files)
    .filter(f => !f.dir)
    .map(f => ({ name: f.name, bytes: f._data?.uncompressedSize || 0 }))
    .slice(0, 500)
  const text = entries.length
    ? `压缩包共 ${entries.length} 个文件：\n` + entries.map(e => `- ${e.name}${e.bytes ? `（${e.bytes} B）` : ''}`).join('\n')
    : '空压缩包'
  return { kind: 'zip', text, meta: { entries: entries.length }, outline: [] }
}

/** 纯文本/markdown：直读；outline 取 md 标题 + 中式序号行 */
function outlineFromPlainText(text) {
  const outline = []
  let cursor = 0
  const lines = String(text || '').split('\n')
  for (const line of lines) {
    const t = line.trim()
    let level = 0
    let title = ''
    const md = t.match(/^(#{1,6})\s+(.{1,80})$/)
    if (md) {
      level = md[1].length
      title = md[2].trim()
    } else if (/^(第[一二三四五六七八九十百\d]+[章节篇部]|[{（(]?[一二三四五六七八九十]+[）)、.．]\s?).{0,60}$/.test(t) && t.length <= 60) {
      level = 1
      title = t
    } else if (/^\d+(\.\d+)*[、.．\s].{1,60}$/.test(t) && t.length <= 60 && /^\d+(\.\d+)*[、.．\s]/.test(t) && (t.match(/^\d+(\.\d+)*/)[0].split('.').length <= 2)) {
      level = 2
      title = t
    }
    if (level && title) {
      const at = text.indexOf(line, cursor)
      if (at >= 0) {
        outline.push({ title, offset: at, charCount: line.length, level })
        cursor = at + line.length
      }
    }
  }
  return outline.slice(0, 200)
}

// ── 主入口 ──

/**
 * 提取文件文本（L1/L2）。
 * @param {{ path?: string, name?: string, bytes?: ArrayBuffer, sheet?: string }} input
 * @returns {Promise<{ ok: boolean, kind?: string, text?: string, meta?: object, outline?: Array, error?: string, code?: string }>}
 */
export async function extractFileText(input) {
  const name = String(input?.name || input?.path || '')
  const ext = extensionOf(name)
  let bytes = input?.bytes
  if (!bytes && input?.path) bytes = readLocalFileBytes(input.path)
  if (!bytes) {
    return { ok: false, error: '缺少文件字节或路径', code: 'INVALID_INPUT' }
  }

  try {
    if (IMAGE_LIKE.has(ext) || MEDIA_LIKE.has(ext)) {
      return {
        ok: false,
        code: 'MEDIA_NOT_TEXT',
        error: '图片/音视频不走文本解析——请用察元面板附件上传（自动走视觉识别/转写管线）'
      }
    }
    if (ext === 'pdf' || magicOf(bytes) === 'pdf') {
      return { ok: true, ...(await extractPdf(bytes)) }
    }
    if (DOCX_LIKE.has(ext)) {
      if (magicOf(bytes) === 'ole') return legacyError(ext, 'docx')
      return { ok: true, ...(await extractDocx(bytes)) }
    }
    if (PPTX_LIKE.has(ext)) {
      if (magicOf(bytes) === 'ole') return legacyError(ext, 'pptx')
      return { ok: true, ...(await extractPptx(bytes)) }
    }
    if (SPREADSHEET_LIKE.has(ext)) {
      if (magicOf(bytes) === 'ole' && ext !== 'csv' && ext !== 'tsv') return legacyError(ext, 'xlsx')
      return { ok: true, ...(await extractSpreadsheet(bytes, { sheet: input?.sheet })) }
    }
    if (HTML_LIKE.has(ext)) {
      const { text, charset } = decodeWithCharset(bytes)
      return { ok: true, ...extractHtml(text), meta: { charset } }
    }
    if (ext === 'svg') {
      const { text, charset } = decodeWithCharset(bytes)
      const stripped = normalizeText(String(text).replace(/<[^>]+>/g, ' '))
      return { ok: true, kind: 'svg', text: stripped, meta: { charset }, outline: [] }
    }
    if (ext === 'eml') {
      const { text, charset } = decodeWithCharset(bytes)
      return { ok: true, ...extractEml(text), meta: { charset } }
    }
    if (ext === 'zip') {
      return { ok: true, ...(await extractZipListing(bytes)) }
    }
    if (LEGACY_BINARY.has(ext)) {
      return legacyError(ext, ext === 'doc' ? 'docx' : ext === 'ofd' ? 'pdf' : null)
    }
    if (['rar', '7z', 'exe', 'dll', 'msi', 'bin'].includes(ext) || magicOf(bytes) === 'ole') {
      return { ok: false, code: 'UNSUPPORTED_BINARY', error: `暂不支持解析 ${ext || '该二进制'} 格式` }
    }
    // L1 纯文本（含未知扩展名：嗅探后放行）
    const magic = magicOf(bytes)
    if (magic === 'zip' || magic === 'ole') {
      return { ok: false, code: 'UNSUPPORTED_BINARY', error: `按内容疑似 ${magic === 'zip' ? 'ZIP/Office 容器' : 'OLE 旧版二进制'}，扩展名 .${ext || '(无)'} 与内容不符，无法按文本解析` }
    }
    if (looksBinary(bytes)) {
      return { ok: false, code: 'BINARY_CONTENT', error: `文件内容为二进制（.${ext || '未知扩展名'}），无法按文本解析` }
    }
    const { text, charset } = decodeWithCharset(bytes)
    const normalized = normalizeText(text)
    return {
      ok: true,
      kind: ext === 'md' || ext === 'markdown' ? 'markdown' : 'text',
      text: normalized,
      meta: { charset },
      outline: outlineFromPlainText(normalized)
    }
  } catch (e) {
    return { ok: false, error: String(e?.message || e), code: e?.code || 'PARSE_FAILED' }
  }
}

function legacyError(ext, convertTo) {
  return {
    ok: false,
    code: 'LEGACY_NEEDS_CONVERT',
    convertTo,
    error: `.${ext} 是旧版二进制格式，需经对应 WPS 宿主转换为 ${convertTo || '新版格式'} 后解析`
  }
}

export { sampleHeadTail, extractHtml as extractHtmlText }
export default { extractFileText, readLocalFileBytes, extensionOf, extractHtmlText: extractHtml }
