/**
 * fileParseDispatch — MCP `file_parse` 的 webview 执行体（method: file.parse）。
 *
 * 职责：sidecar 已完成路径归一/别名解析/fs 探测（存在、大小、mtime、魔数），
 * 这里接收规范化文件清单，做：
 *   1) 逐文件 extractFileText（L1/L2 矩阵，src/utils/fileTextExtractor.js）
 *   2) token 预算分配（多文件按 size^0.7 加权，防小文件饿死）
 *   3) 三种返回模式：
 *      - auto（默认）：≤预算全文直出；超预算 → 导航式摘要（outline + 头50% +
 *        中段采样 + 尾25%），并给 recommendedMode:'chunk'
 *      - full：强制全文（480KB JSON 硬闸 + 40 万字符顶，truncated 标记）
 *      - chunk：翻页协议（cursor/limit/nextCursor/hasMore，契约同 document_chunks），
 *        幂等重切（无服务端会话），fingerprint=mtime+size 校验文件变更，
 *        支持 rangeStart/rangeEnd 随机访问（偏移来自 outline）
 *   4) 命中「已打开且未保存」文档时补 note（磁盘为旧版本警示）
 *
 * 只读工具：不写任何文档、不落盘（除读取）。
 */

import { extractFileText, extensionOf } from '../../utils/fileTextExtractor.js'
import { estimateTokens, charsBudgetFor, charsPerTokenOf } from '../../utils/tokenEstimator.js'
import { splitTextIntoChunks } from '../../utils/chunkSettings.js'

const MAX_FILES = 8
const HARD_JSON_BYTES = 480_000        // 单次响应 JSON 字节顶（document_chunks 同款先例）
const MAX_FULL_CHARS = 400_000         // full 模式单文件字符顶
const HUGE_FILE_BYTES = 200 * 1024 * 1024  // 硬拒
const BIG_FILE_BYTES = 50 * 1024 * 1024    // 仅允许 chunk
const DEFAULT_BUDGET_TOKENS = 6000
const MAX_BUDGET_TOKENS = 200_000
const DEFAULT_CHUNK_TOKENS = 2000
const CHUNK_LIMIT_MAX = 4
const JSON_OVERHEAD_FACTOR = 1.08      // JSON 序列化开销安全系数

function clampBudgetTokens(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_BUDGET_TOKENS
  return Math.min(Math.max(Math.floor(n), 200), MAX_BUDGET_TOKENS)
}

/** 路径命中当前宿主「已打开且未保存」的文档 → 补警示 note */
function noteUnsavedIfOpen(path) {
  // 两侧统一按 / 归一再比对：Windows FullName 用 \，macOS 用 /——单侧归一
  // 会让另一侧永不相等（警示静默失效）
  const canon = (s) => String(s || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  try {
    const app = window.Application
    const p = canon(path)
    const collections = []
    if (app?.Documents?.Count) collections.push(app.Documents)
    if (app?.Workbooks?.Count) collections.push(app.Workbooks)
    if (app?.Presentations?.Count) collections.push(app.Presentations)
    for (const col of collections) {
      for (let i = 1; i <= col.Count; i++) {
        const doc = col.Item(i)
        const full = canon(doc?.FullName)
        if (full && full === p) {
          const saved = (() => { try { return doc.Saved === true } catch (_) { return true } })()
          if (!saved) return '注意：该文件正在 WPS 中打开且有未保存修改，本次读取的是磁盘上的旧版本。'
        }
      }
    }
  } catch (_) { /* 探测失败不影响主流程 */ }
  return ''
}

/** 导航式摘要：outline 目录 + 头 50% + 中段均匀采样 + 尾 25%（全按字符预算）。
 *  outline 实扣预算（120 项目录本身可达数千字符，固定比例会导致总装超预算）。 */
function buildDigest(text, outline, charsBudget, includeOutline) {
  const parts = []
  let outlineChars = 0
  if (includeOutline && outline && outline.length) {
    const outlineText = '【结构目录】\n' + outline
      .slice(0, 120)
      .map(o => `${'  '.repeat(Math.max(0, (o.level || 1) - 1))}- ${o.title}（offset ${o.offset}）`)
      .join('\n')
    outlineChars = outlineText.length
    parts.push({ text: outlineText, label: '' })
  }
  const bodyBudget = Math.max(300, Math.floor(charsBudget) - outlineChars - 40)
  const headLen = Math.floor(bodyBudget * 0.5)
  const tailLen = Math.floor(bodyBudget * 0.25)
  const midBudget = bodyBudget - headLen - tailLen
  const total = text.length
  parts.push({ text: text.slice(0, headLen), label: '【开头】' })
  if (total > headLen + tailLen + midBudget * 4) {
    const snippetCount = 5
    const snippetLen = Math.max(60, Math.floor(midBudget / snippetCount))
    const zoneStart = headLen
    const zoneEnd = Math.max(zoneStart + snippetLen, total - tailLen)
    const step = Math.max(1, Math.floor((zoneEnd - zoneStart - snippetLen) / (snippetCount - 1)))
    const snippets = []
    for (let i = 0; i < snippetCount; i++) {
      const at = zoneStart + i * step
      if (at + snippetLen <= zoneEnd) snippets.push(text.slice(at, at + snippetLen))
    }
    if (snippets.length) {
      const omitted = total - headLen - tailLen - snippets.reduce((m, s) => m + s.length, 0)
      parts.push({
        text: `…[中段省略约 ${Math.max(0, omitted)} 字，采样如下]…\n` + snippets.join('\n……\n'),
        label: '【中段采样】'
      })
    }
  }
  parts.push({ text: text.slice(Math.max(0, total - tailLen)), label: '【结尾】' })
  const assembled = parts
    .map(p => (p.label ? `${p.label}\n${p.text}` : p.text))
    .join('\n\n')
  return { text: assembled, truncated: true }
}

/** 多文件预算分配：weight = charCount^0.7，保底 500 tokens。
 *  空 text 的 ok 文件也参与分配：0 ≤ 保底预算 → 走全文直出分支返回空串，
 *  否则 0 <= undefined 为 false 会误落 digest 分支产出「开头/结尾」壳摘要。 */
function allocateBudgets(entries, budgetTokens) {
  const parsed = entries.filter(e => e.ok)
  if (!parsed.length) return
  const weights = new Map()
  let total = 0
  for (const e of parsed) {
    const w = Math.pow(Math.max(1, e.fullText.length), 0.7)
    weights.set(e, w)
    total += w
  }
  for (const e of parsed) {
    e.budgetTokens = Math.max(500, Math.floor(budgetTokens * (weights.get(e) / total)))
  }
}

/**
 * file.parse 主入口
 * @param {{
 *   files: Array<{ path: string, name: string, sizeBytes: number, mtimeMs: number, ext?: string }>,
 *   mode?: 'auto'|'full'|'chunk', budgetTokens?: number, chunkTokens?: number,
 *   cursor?: number, limit?: number, rangeStart?: number, rangeEnd?: number,
 *   sheet?: string, raw?: boolean, includeOutline?: boolean, expectedFingerprint?: string
 * }} params
 */
export async function handleFileParse(params) {
  const files = Array.isArray(params?.files) ? params.files.slice(0, MAX_FILES) : []
  if (!files.length) {
    const err = new Error('files 为空（sidecar 应在派发前完成路径解析与探测）')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const mode = ['auto', 'full', 'chunk'].includes(params.mode) ? params.mode : 'auto'
  const budgetTokens = clampBudgetTokens(params.budgetTokens)
  const includeOutline = params.includeOutline !== false

  for (const f of files) {
    if (Number(f.sizeBytes) > HUGE_FILE_BYTES) {
      const err = new Error(`文件过大（${(f.sizeBytes / 1024 / 1024).toFixed(0)}MB > 200MB 上限）：${f.name}`)
      err.code = 'FILE_TOO_LARGE'
      throw err
    }
  }
  if (files.some(f => Number(f.sizeBytes) > BIG_FILE_BYTES) && mode !== 'chunk') {
    const err = new Error('超过 50MB 的大文件仅支持 mode:"chunk" 分块读取')
    err.code = 'BIG_FILE_CHUNK_ONLY'
    throw err
  }

  // 1) 逐文件解析（字节读取 + 格式矩阵）
  const entries = []
  for (const f of files) {
    const base = {
      path: f.path,
      name: f.name,
      ext: extensionOf(f.name),
      sizeBytes: Number(f.sizeBytes) || 0,
      mtimeMs: Number(f.mtimeMs) || 0,
      fingerprint: `${Number(f.sizeBytes) || 0}-${Number(f.mtimeMs) || 0}`
    }
    const note = noteUnsavedIfOpen(f.path)
    if (note) base.note = note
    const result = await extractFileText({ path: f.path, name: f.name, sheet: params.sheet })
    if (!result.ok) {
      entries.push({ ...base, ok: false, error: result.error, code: result.code, convertTo: result.convertTo })
      continue
    }
    entries.push({
      ...base,
      ok: true,
      kind: result.kind,
      meta: result.meta || {},
      outline: result.outline || [],
      fullText: result.text || '',
      tokenEstimate: estimateTokens(result.text || '')
    })
  }

  // 2) chunk 模式：全文件顺序拼接的扁平分页（确定性重切 + fingerprint 校验）
  if (mode === 'chunk') {
    return buildChunkResponse(entries, params, includeOutline)
  }

  // 3) auto / full 模式：预算分配 + 装配
  allocateBudgets(entries, budgetTokens)
  const outFiles = []
  let consumed = 0
  let rangeApplied = false
  for (const e of entries) {
    if (!e.ok) {
      outFiles.push({ path: e.path, name: e.name, ext: e.ext, sizeBytes: e.sizeBytes, ok: false, error: e.error, code: e.code, convertTo: e.convertTo })
      continue
    }
    const fileOut = {
      path: e.path,
      name: e.name,
      ext: e.ext,
      kind: e.kind,
      sizeBytes: e.sizeBytes,
      mtimeMs: e.mtimeMs,
      fingerprint: e.fingerprint,
      ok: true,
      meta: { ...e.meta, tokenEstimate: e.tokenEstimate, outline: includeOutline ? e.outline.slice(0, 120) : [] }
    }
    if (e.note) fileOut.note = e.note

    if (mode === 'full') {
      const hardChars = Math.floor(MAX_FULL_CHARS / JSON_OVERHEAD_FACTOR / Math.max(1, entries.filter(x => x.ok).length))
      const truncated = e.fullText.length > hardChars
      fileOut.text = truncated ? e.fullText.slice(0, hardChars) : e.fullText
      fileOut.truncated = truncated
      fileOut.consumedTokens = estimateTokens(fileOut.text)
      fileOut.recommendedMode = 'chunk'
    } else {
      // auto
      if (params && typeof params.rangeStart === 'number' && !rangeApplied) {
        // 随机访问：单文件意义最明确，多文件时只作用于首个解析成功的文件
        rangeApplied = true
        const start = Math.max(0, Math.floor(Number(params.rangeStart) || 0))
        const end = typeof params.rangeEnd === 'number'
          ? Math.min(e.fullText.length, Math.max(start, Math.floor(Number(params.rangeEnd) || 0)))
          : Math.min(e.fullText.length, start + charsBudgetFor(e.fullText, e.budgetTokens))
        fileOut.range = { start, end }
        fileOut.text = e.fullText.slice(start, end)
        fileOut.truncated = end < e.fullText.length
        fileOut.consumedTokens = estimateTokens(fileOut.text)
        fileOut.recommendedMode = 'chunk'
      } else if (e.tokenEstimate <= e.budgetTokens) {
        fileOut.text = e.fullText
        fileOut.truncated = false
        fileOut.consumedTokens = e.tokenEstimate
        fileOut.recommendedMode = 'none'
      } else {
        const charsBudget = charsBudgetFor(e.fullText, e.budgetTokens)
        const digest = buildDigest(e.fullText, e.outline, charsBudget, includeOutline)
        fileOut.text = digest.text
        fileOut.truncated = true
        fileOut.consumedTokens = estimateTokens(digest.text)
        fileOut.recommendedMode = 'chunk'
      }
    }
    outFiles.push(fileOut)
    consumed += fileOut.consumedTokens || 0
  }

  const payload = {
    ok: outFiles.some(f => f.ok),
    mode,
    budgetTokens,
    charsPerTokenAssumed: charsPerTokenOf(entries.find(e => e.ok)?.fullText || ''),
    files: outFiles,
    totalTokenEstimate: entries.reduce((m, e) => m + (e.tokenEstimate || 0), 0),
    consumedTokens: consumed,
    failedCount: outFiles.filter(f => !f.ok).length
  }

  // 4) 480KB JSON 硬闸：超限整体压缩采样（auto）或减块（不会发生在 full 之外的模式）
  let serialized = JSON.stringify(payload)
  if (serialized.length > HARD_JSON_BYTES) {
    const shrink = HARD_JSON_BYTES / serialized.length
    for (const f of payload.files) {
      if (typeof f.text === 'string' && f.text.length > 1000) {
        const keep = Math.max(1000, Math.floor(f.text.length * shrink * 0.9))
        f.text = f.text.slice(0, keep) + `\n…[响应超 480KB 上限，已整体压缩采样，请改用 mode:"chunk" 分块读取]…`
        f.truncated = true
        f.consumedTokens = estimateTokens(f.text)
      }
    }
    payload.truncated = true
    serialized = JSON.stringify(payload)
  }
  return payload
}

function buildChunkResponse(entries, params, includeOutline) {
  const chunkTokens = Math.min(Math.max(Number(params.chunkTokens) || DEFAULT_CHUNK_TOKENS, 200), 16000)
  const limit = Math.min(Math.max(Number(params.limit) || 2, 1), CHUNK_LIMIT_MAX)
  const cursor = Math.max(0, Number(params.cursor) || 0)

  const flat = []
  for (const e of entries) {
    if (!e.ok) continue
    const chunkLength = Math.max(500, charsBudgetFor(e.fullText, chunkTokens))
    const overlapLength = Math.min(200, Math.floor(chunkLength * 0.05))
    const pieces = splitTextIntoChunks(e.fullText, { chunkLength, overlapLength, splitStrategy: 'paragraph' })
    pieces.forEach((text, i) => {
      flat.push({
        file: e.name,
        path: e.path,
        chunkIndex: i,
        fileChunkCount: pieces.length,
        text,
        charCount: text.length,
        tokenEstimate: estimateTokens(text)
      })
    })
  }
  if (!flat.length) {
    return {
      ok: false,
      mode: 'chunk',
      files: entries.map(e => ({ path: e.path, name: e.name, ok: e.ok, error: e.error, code: e.code, convertTo: e.convertTo })),
      error: '没有可分块的已解析文件'
    }
  }
  const slices = flat.slice(cursor, cursor + limit)
  const fileChanged = params.expectedFingerprint
    ? entries.length === 1 && entries[0].fingerprint !== params.expectedFingerprint
    : false
  return {
    ok: true,
    mode: 'chunk',
    chunkTokens,
    cursor,
    limit,
    totalChunks: flat.length,
    hasMore: cursor + limit < flat.length,
    nextCursor: Math.min(cursor + limit, flat.length),
    fileChanged,
    fingerprint: entries.length === 1 ? entries[0].fingerprint : entries.map(e => e.fingerprint).join('|'),
    files: entries.map(e => ({
      path: e.path,
      name: e.name,
      ext: e.ext,
      kind: e.kind,
      ok: e.ok,
      error: e.error,
      code: e.code,
      convertTo: e.convertTo,
      meta: e.ok ? { ...e.meta, tokenEstimate: e.tokenEstimate, outline: includeOutline ? e.outline.slice(0, 120) : [] } : undefined
    })),
    chunks: slices.map(c => ({ ...c, tokenEstimate: c.tokenEstimate }))
  }
}

/**
 * L3 旧版格式转换（method: file.convert，由 sidecar 定向派发到对应宿主）：
 * 打开临时副本（ReadOnly，不动用户原文件）→ 另存为新格式 → 关闭 → 返回新路径。
 * 宿主与格式常量按 sidecar 的 convertMap 对齐：doc/wps→docx(pdf)、ppt/dps→pptx(pdf)、et→xlsx(pdf)。
 */
export async function handleFileConvert(params) {
  const srcPath = String(params?.srcPath || '').trim()
  const targetExt = String(params?.targetExt || '').toLowerCase()
  const host = String(params?.host || '').toLowerCase()
  if (!srcPath || !targetExt) {
    const err = new Error('srcPath/targetExt 必填')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const app = window.Application
  if (!app) {
    const err = new Error('WPS Application 不可用')
    err.code = 'HOST_UNAVAILABLE'
    throw err
  }
  const outPath = srcPath.replace(/\.[^.]+$/, '') + '.' + targetExt
  // wps: wdFormatPDF=17, wdFormatXMLDocument=12；et: xlPDF=57, xlOpenXMLWorkbook=51；wpp: ppSaveAsPDF=32, ppSaveAsOpenXMLPresentation=24
  const formats = {
    wps: { pdf: 17, docx: 12 },
    et: { pdf: 57, xlsx: 51 },
    wpp: { pdf: 32, pptx: 24 }
  }
  const fileFormat = formats[host]?.[targetExt]
  if (!fileFormat) {
    const err = new Error(`宿主 ${host || '(未知)'} 不支持导出 .${targetExt}`)
    err.code = 'UNSUPPORTED_CONVERSION'
    throw err
  }

  let opened = null
  try {
    if (host === 'et') {
      opened = app.Workbooks.Open(srcPath, 0, true)
      opened.SaveAs2(outPath, fileFormat)
      opened.Close(false)
    } else if (host === 'wpp') {
      // Open(path, ReadOnly, Untitled, WithWindow=false 避免闪窗)
      opened = app.Presentations.Open(srcPath, true, false, false)
      opened.SaveAs(outPath, fileFormat)
      opened.Close()
    } else {
      opened = app.Documents.Open(srcPath, false, true)
      opened.SaveAs2(outPath, fileFormat)
      opened.Close(false)
    }
    return { ok: true, path: outPath, host, targetExt }
  } catch (e) {
    try { if (opened) opened.Close(false) } catch (_) { /* 已尽力 */ }
    const err = new Error(`宿主 ${host} 转换失败：${e?.message || e}`)
    err.code = 'CONVERT_FAILED'
    throw err
  }
}

export default { handleFileParse, handleFileConvert }
