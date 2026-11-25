/**
 * MCP document primitives: meta/chunks/locate/replace/insert/comment/apply_ops/new/save/declassify/kb.
 */
import {
  getActiveDocument,
  getDocumentText,
  applyDocumentAction,
  applyStructuredExecutionPlan
} from '../../utils/documentActions.js'
import {
  getDocumentChunksWithPositionsAsync,
  getSelectionChunksWithPositionsAsync
} from '../../utils/documentChunker.js'
import { getChunkSettings } from '../../utils/chunkSettings.js'
import { saveActiveDocument, saveActiveDocumentAs, saveActiveObjectWithPassword, saveActiveObjectWithoutPassword } from '../../utils/documentFileActions.js'
import {
  getCurrentDeclassifyStatus,
  buildDeclassifyPreview,
  applyDocumentDeclassify,
  restoreDocumentDeclassify
} from '../../utils/documentDeclassifyService.js'
import { retrieveKbContextForAssistant } from '../../services/kb/retrievalMiddleware.js'
import { getAssistantKbBinding } from '../../utils/assistant/kbAssistantBinding.js'
import { resolveBoundDocument } from '../../utils/chat/docTarget.js'
import { parseMarkdownBlocks } from '../../utils/markdownDocumentRenderer.js'

export const DOCUMENT_GET_TEXT_MAX_CHARS = 80_000
export const DOCUMENT_CHUNKS_LIMIT_MAX = 8
export const DOCUMENT_CHUNKS_LIMIT_DEFAULT = 2

function requireDoc(params = {}) {
  // Model S（plans/Model S 共识定稿）：dispatch 门已按会话绑定解析成功并留
  // __boundDocKey/__boundDocLinkId，这里二次解析取新鲜 COM 代理对象——绑定文档
  // 非活动也照常操作（S2 静默路径，2026-11-21 探针实证）；解析失败报 DOC_NOT_OPEN。
  // 无绑定标记时回落 ActiveDocument（无 pin 链路旧语义，行为不变）。
  const boundKey = String(params?.__boundDocKey || '').trim()
  if (boundKey) {
    const resolved = resolveBoundDocument({
      docId: boundKey,
      docLinkId: String(params?.__boundDocLinkId || '')
    })
    if (!resolved.ok) {
      const err = new Error(resolved.message)
      err.code = 'DOC_NOT_OPEN'
      err.docPath = boundKey
      throw err
    }
    return resolved.doc
  }
  const doc = getActiveDocument()
  if (!doc) {
    const err = new Error('当前没有打开文档')
    err.code = 'NO_ACTIVE_DOCUMENT'
    throw err
  }
  return doc
}

function docInfo(doc = getActiveDocument()) {
  if (!doc) return { open: false }
  try {
    return {
      open: true,
      name: String(doc.Name || ''),
      fullName: String(doc.FullName || ''),
      saved: !!doc.Saved,
      addonType: 'wps'
    }
  } catch (e) {
    return { open: false, error: e?.message || String(e) }
  }
}

function requireConfirmed(params) {
  if (params?.confirmed !== true) {
    const err = new Error('confirmed: true required')
    err.code = 'CONFIRMATION_REQUIRED'
    throw err
  }
}

function normalizeNeedle(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

/**
 * Find all matches (capped) via Word Find; prefer nearest to hintStart when returning best.
 */
function locateTextInDoc(doc, text, { hintStart = 0, maxMatches = 20 } = {}) {
  const needle = normalizeNeedle(text)
  if (!doc || needle.length < 1) {
    return { matches: [], needle }
  }
  const docEnd = Number(doc?.Content?.End || 0)
  const matches = []
  let cursor = 0
  let guard = 0
  const limit = Math.min(Math.max(Number(maxMatches) || 20, 1), 50)
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
    try {
      find.ClearFormatting?.()
    } catch { /* ignore */ }
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
    let live = ''
    try {
      live = String(doc.Range(mStart, mEnd).Text || '')
    } catch { /* ignore */ }
    matches.push({
      start: mStart,
      end: mEnd,
      text: live,
      charCount: live.length
    })
    cursor = mEnd > cursor ? mEnd : cursor + 1
  }
  const hint = Number(hintStart) || 0
  const ranked = matches
    .map((m, i) => ({ ...m, distance: Math.abs(m.start - hint), matchIndex: i }))
    .sort((a, b) => a.distance - b.distance || a.start - b.start)
  return {
    needle,
    matchCount: ranked.length,
    matches: ranked,
    best: ranked[0] || null
  }
}

function resolveWritableRange(doc, params = {}) {
  const expected = normalizeNeedle(params.originalText || params.expectedText || params.anchorText || '')
  const start = Number(params.start)
  const end = Number(params.end)
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    let live = ''
    try {
      live = String(doc.Range(start, end).Text || '')
    } catch {
      live = ''
    }
    if (!expected || normalizeNeedle(live) === expected) {
      return {
        start,
        end,
        liveText: live,
        matchedBy: expected ? 'absolute-range' : 'absolute-range-no-expected',
        safeForReplace: !!expected && normalizeNeedle(live) === expected
      }
    }
    const err = new Error('Range text does not match expectedText')
    err.code = 'LOCATE_MISMATCH'
    err.details = { start, end, expected, live: live.slice(0, 200) }
    throw err
  }
  if (expected) {
    const located = locateTextInDoc(doc, expected, {
      hintStart: Number(params.hintStart) || start || 0,
      maxMatches: 1
    })
    if (!located.best) {
      const err = new Error(`Text not found: ${expected.slice(0, 80)}`)
      err.code = 'LOCATE_NOT_FOUND'
      throw err
    }
    return {
      start: located.best.start,
      end: located.best.end,
      liveText: located.best.text,
      matchedBy: 'word-find',
      safeForReplace: true
    }
  }
  // Fall back to selection
  try {
    const sel = window.Application?.Selection?.Range
    if (sel && Number(sel.End) > Number(sel.Start)) {
      return {
        start: Number(sel.Start),
        end: Number(sel.End),
        liveText: String(sel.Text || ''),
        matchedBy: 'selection',
        safeForReplace: true
      }
    }
  } catch { /* ignore */ }
  const err = new Error('Provide start/end + expectedText, or originalText, or a selection')
  err.code = 'INVALID_PARAMS'
  throw err
}

export async function handleDocumentMeta(params = {}) {
  const doc = requireDoc(params)
  const settings = getChunkSettings()
  const chunkLength = Number(params.chunkLength) > 0 ? Number(params.chunkLength) : settings.chunkLength
  const overlapLength = Number(params.overlapLength) >= 0 ? Number(params.overlapLength) : settings.overlapLength
  let charCount = 0
  let paragraphCount = 0
  try {
    charCount = String(doc.Content?.Text || '').length
  } catch {
    charCount = String(getDocumentText(doc) || '').length
  }
  try {
    paragraphCount = Number(doc.Paragraphs?.Count || 0)
  } catch {
    paragraphCount = 0
  }
  // Lightweight estimate — avoid full chunking on meta for million-char docs
  const approxChunks = Math.max(1, Math.ceil(charCount / Math.max(chunkLength - overlapLength, 1)))
  return {
    ...docInfo(doc),
    charCount,
    paragraphCount,
    chunkSettings: { chunkLength, overlapLength, splitStrategy: settings.splitStrategy },
    estimatedChunkCount: approxChunks,
    recommendChunks: charCount > DOCUMENT_GET_TEXT_MAX_CHARS,
    getTextMaxChars: DOCUMENT_GET_TEXT_MAX_CHARS
  }
}

/**
 * List paragraphs with start/end anchors for NL workflows like
 * 「翻译每一段，把译文插到段落后面」— external LLM translates; client writebacks via insert-after.
 */
export async function handleDocumentListParagraphs(params = {}) {
  const doc = requireDoc(params)
  let total = 0
  try {
    total = Number(doc.Paragraphs?.Count || 0)
  } catch {
    total = 0
  }
  const limit = Math.min(Math.max(Number(params.limit) || 40, 1), 120)
  // 1-based paragraph index in WPS
  let cursor = Math.max(1, Math.floor(Number(params.cursor) || 1))
  const skipEmpty = params.skipEmpty !== false
  const paragraphs = []
  const maxScan = Math.min(total, cursor + limit * 3) // allow skipping empties
  for (let i = cursor; i <= total && i <= maxScan && paragraphs.length < limit; i++) {
    try {
      const p = doc.Paragraphs.Item(i)
      const range = p?.Range
      const raw = String(range?.Text || '')
      const text = raw.replace(/\r+$/g, '').replace(/\u0007/g, '').trim()
      if (skipEmpty && !text) {
        cursor = i + 1
        continue
      }
      paragraphs.push({
        index: i,
        start: Number(range?.Start || 0),
        end: Number(range?.End || 0),
        text,
        charCount: text.length
      })
      cursor = i + 1
    } catch {
      cursor = i + 1
    }
    if (paragraphs.length % 20 === 0) {
      await new Promise((r) => setTimeout(r, 0))
    }
  }
  const hasMore = cursor <= total
  return {
    paragraphs,
    totalParagraphs: total,
    returned: paragraphs.length,
    nextCursor: hasMore ? cursor : null,
    hasMore,
    document: docInfo(doc),
    hint:
      '用户说「翻译每一段并插到段后」时：对本页每段由模型生成译文，再调用 document_apply_ops(action=insert-after) 或 document_insert(position=after)；从文档末段往前写以免锚点漂移。'
  }
}

export async function handleDocumentChunks(params = {}) {
  const doc = requireDoc(params)
  const settings = getChunkSettings()
  const chunkLength = Math.min(
    Math.max(Number(params.chunkLength) || settings.chunkLength, 500),
    16000
  )
  const overlapLength = Math.min(
    Math.max(Number(params.overlapLength) >= 0 ? Number(params.overlapLength) : settings.overlapLength, 0),
    Math.floor(chunkLength * 0.5)
  )
  const cursor = Math.max(0, Math.floor(Number(params.cursor) || 0))
  const limit = Math.min(
    Math.max(Number(params.limit) || DOCUMENT_CHUNKS_LIMIT_DEFAULT, 1),
    DOCUMENT_CHUNKS_LIMIT_MAX
  )
  const scope = params.scope === 'selection' ? 'selection' : 'document'
  const overrides = { chunkLength, overlapLength, splitStrategy: params.splitStrategy || settings.splitStrategy }

  let all
  if (scope === 'selection') {
    const selection = window.Application?.Selection
    all = await getSelectionChunksWithPositionsAsync(doc, selection, overrides, { yieldEveryParagraphs: 40 })
  } else {
    all = await getDocumentChunksWithPositionsAsync(doc, overrides, { yieldEveryParagraphs: 40 })
  }

  const totalChunks = all.length
  const slice = all.slice(cursor, cursor + limit).map((c, i) => ({
    chunkIndex: cursor + i,
    start: Number(c.start),
    end: Number(c.end),
    text: String(c.text || ''),
    charCount: String(c.text || '').length,
    riskLevel: c.riskProfile?.level || 'low'
  }))
  const nextCursor = cursor + slice.length
  const hasMore = nextCursor < totalChunks
  const payloadBytes = JSON.stringify(slice).length
  const TRUNCATE_AT = 480_000
  let truncated = false
  let chunks = slice
  if (payloadBytes > TRUNCATE_AT && chunks.length > 1) {
    chunks = chunks.slice(0, 1)
    truncated = true
  }

  return {
    scope,
    cursor,
    limit,
    totalChunks,
    hasMore: truncated ? true : hasMore,
    nextCursor: truncated ? cursor + chunks.length : (hasMore ? nextCursor : null),
    truncated,
    chunkSettings: overrides,
    chunks,
    document: docInfo(doc)
  }
}

export async function handleDocumentGetTextGuarded(params = {}) {
  const scope = params.scope === 'selection' ? 'selection' : 'document'
  const force = params.force === true
  let text = ''
  if (scope === 'selection') {
    try {
      text = String(window.Application?.ActiveDocument?.ActiveWindow?.Selection?.Range?.Text || '')
    } catch {
      text = ''
    }
  }
  if (!text) {
    // Model S：按绑定解析取全文（有绑定标记强制可解析；无标记回落活动文档）
    const doc = requireDoc(params)
    text = String(getDocumentText(doc) || '')
  }
  if (!force && text.length > DOCUMENT_GET_TEXT_MAX_CHARS) {
    const err = new Error(
      `Document too large (${text.length} chars). Use document_chunks for pagination, or pass force:true.`
    )
    err.code = 'DOCUMENT_TOO_LARGE'
    err.details = {
      charCount: text.length,
      maxChars: DOCUMENT_GET_TEXT_MAX_CHARS,
      hint: 'Call document_meta then document_chunks with cursor/limit'
    }
    throw err
  }
  return {
    text,
    charCount: text.length,
    scope,
    forced: force && text.length > DOCUMENT_GET_TEXT_MAX_CHARS,
    document: docInfo()
  }
}

export async function handleDocumentLocate(params = {}) {
  const doc = requireDoc(params)
  const text = String(params.text || params.query || params.originalText || '').trim()
  if (!text) {
    const err = new Error('text required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const located = locateTextInDoc(doc, text, {
    hintStart: Number(params.hintStart) || 0,
    maxMatches: Number(params.maxMatches) || 20
  })
  return {
    ...located,
    document: docInfo(doc)
  }
}

export async function handleDocumentReplace(params = {}) {
  const doc = requireDoc(params)
  // let（非 const）：replace 通道写前会做 markdown 纯文本化重赋值
  let newText = String(params.newText ?? params.text ?? '')
  const resolved = resolveWritableRange(doc, params)
  if (params.confirmed !== true) {
    return {
      preview: true,
      action: 'replace',
      requiresConfirmation: true,
      range: { start: resolved.start, end: resolved.end, matchedBy: resolved.matchedBy },
      originalText: resolved.liveText,
      newText,
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  if (!resolved.safeForReplace && params.allowUnsafe !== true) {
    const err = new Error('LOCATE_MISMATCH: refusing replace without verified originalText')
    err.code = 'LOCATE_MISMATCH'
    throw err
  }
  // replace 通道写前纯文本化（2026-11-21 用户裁决「保持原段落与样式」的最后防线）：
  // 模型偶尔不守「纯文本输出」契约，把 ##/**/- 带进 newText → 会原样落进文档。
  // 用渲染解析器反向提取纯文本（粗体等内联标记剥壳保文字、表格摊平为行），
  // 幂等（纯文本输入原样通过）。仅 replace 通道——append/insert 的 markdown 是
  // 有意输入（渲染成真实格式）。
  if (/(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>)|\*\*|\|/.test(newText)) {
    try {
      const blocks = parseMarkdownBlocks(newText)
      const paras = []
      for (const b of blocks) {
        if (b.type === 'heading' || b.type === 'paragraph') paras.push(b.runs.map(r => r.text).join(''))
        else if (b.type === 'list') for (const item of b.items) paras.push(item.map(r => r.text).join(''))
        else if (b.type === 'table') paras.push(...[b.headers, ...b.rows].map(row => row.map(c => String(c ?? '').trim()).join('  ')))
      }
      const plain = paras.filter(x => x.trim()).join('\n').trim()
      if (plain) newText = plain
    } catch (_) { /* 解析失败按原文写 */ }
  }
  const targetRange = doc.Range(resolved.start, resolved.end)
  // 逐段原位替换（2026-11-21 用户裁决「翻译/重写必须保持原段落与样式」）：输出段数
  // 与目标区段落数一致时，逐段改写段内文本——每段的样式天然保留（只动文本不动段落
  // 对象）；逆序处理避免位置漂移。段数不一致 → 回落整段替换（\r 分段）。
  if (params.paragraphWise === true) {
    // 逐段原位替换（2026-11-21 用户裁决「翻译/重写必须保持原段落与样式」）：
    // 正向采集每个非空段落的 [start,end,尾标记]（数值位置），段数与输出一致时
    // 【逆序】改写段内文本——后面的段先改，前面段的位置不受影响（数值定位无漂移）。
    // 每段只动文本不动段落对象 → 段落样式天然保留。段数不一致 → 回落整段替换。
    let srcInfo = null
    try {
      const paras = targetRange.Paragraphs
      const n = Number(paras?.Count || 0)
      srcInfo = []
      for (let i = 1; i <= n; i++) {
        try {
          const pr = paras.Item(i).Range
          const t = String(pr?.Text || '')
          const body = t.replace(/[\r\n]+$/, '')
          if (body.trim()) srcInfo.push({ start: Number(pr.Start), end: Number(pr.End), body, trailing: t.slice(body.length) })
        } catch (_) { /* 单段异常跳过 */ }
      }
    } catch (_) { srcInfo = null }
    const outParas = String(newText || '').replace(/\r\n/g, '\n').split('\n').map(x => x.trim()).filter(x => x)
    if (srcInfo && srcInfo.length && outParas.length === srcInfo.length) {
      try {
        for (let i = srcInfo.length - 1; i >= 0; i--) {
          const seg = srcInfo[i]
          const pr = doc.Range(seg.start, seg.end)
          pr.Text = (outParas[i] || '') + (seg.trailing || '\r')
        }
        return {
          ok: true,
          action: 'replace',
          rendered: 'paragraph-wise',
          message: `已按原段落结构替换 ${srcInfo.length} 段（样式保留）`,
          range: { start: resolved.start, end: resolved.end },
          document: docInfo(doc)
        }
      } catch (e) {
        console.warn('逐段替换失败，回落整段替换:', e)
      }
    }
  }
  const result = applyDocumentAction('replace', newText, {
    doc,
    title: params.title || '察元 MCP 替换',
    targetRange,
    strictTargetAction: true,
    safeReplacePayload: {
      originalText: resolved.liveText,
      start: resolved.start,
      end: resolved.end
    }
  })
  return {
    preview: false,
    ok: true,
    ...result,
    range: { start: resolved.start, end: resolved.end },
    document: docInfo(doc)
  }
}

export async function handleDocumentInsert(params = {}) {
  const doc = requireDoc(params)
  const text = String(params.text || '')
  if (!text) {
    const err = new Error('text required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const position = String(params.position || params.action || 'insert').toLowerCase()
  const actionMap = {
    insert: 'insert',
    after: 'insert-after',
    'insert-after': 'insert-after',
    before: 'prepend',
    prepend: 'prepend',
    append: 'append'
  }
  const action = actionMap[position] || 'insert'

  let options = { doc, title: params.title || '察元 MCP 插入' }
  const hasAnchor =
    params.originalText ||
    params.expectedText ||
    (Number.isFinite(Number(params.start)) && Number.isFinite(Number(params.end)))
  if (hasAnchor) {
    const resolved = resolveWritableRange(doc, params)
    options.targetRange = doc.Range(resolved.start, resolved.end)
    options._resolved = resolved
  }

  if (params.confirmed !== true) {
    return {
      preview: true,
      action,
      requiresConfirmation: true,
      text,
      range: options._resolved
        ? { start: options._resolved.start, end: options._resolved.end }
        : null,
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const { _resolved, ...applyOpts } = options
  const result = applyDocumentAction(action, text, applyOpts)
  return {
    preview: false,
    ok: true,
    ...result,
    document: docInfo(doc)
  }
}

export async function handleDocumentAddComment(params = {}) {
  requireConfirmed(params)
  const doc = requireDoc(params)
  const text = String(params.text || '')
  if (!text) {
    const err = new Error('text required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const anchorText = String(
    params.originalText || params.expectedText || params.anchorText || ''
  ).trim()
  // 表格精确批注：有原文时走 Find + Select + Scope 复核，避免 Comments.Add 挂到整格
  if (anchorText) {
    const { addCommentPinnedToExactText } = await import('../../utils/documentAnchorResolve.js')
    const pinned = addCommentPinnedToExactText(doc, anchorText, text, {
      hintStart: Number(params.hintStart) || Number(params.start) || 0,
      prefix: String(params.prefix || ''),
      suffix: String(params.suffix || ''),
      sentence: String(params.sentence || ''),
      preferredStart: Number(params.start),
      preferredEnd: Number(params.end)
    })
    if (!pinned?.ok) {
      const err = new Error(pinned?.reasonLabel || '无法精确批注到原文')
      err.code = pinned?.reasonCode || 'ANCHOR_FAILED'
      throw err
    }
    return {
      ok: true,
      action: 'comment',
      charCount: text.length,
      message: pinned.reasonLabel || '已添加批注',
      matchedBy: pinned.matchedBy,
      warning: pinned.warning || null,
      range: { start: pinned.start, end: pinned.end },
      scope: pinned.scope || null,
      writeTargets: [{
        action: 'comment',
        start: pinned.start,
        end: pinned.end,
        originalText: anchorText,
        outputText: text
      }],
      document: docInfo(doc)
    }
  }
  const hasAnchor = Number.isFinite(Number(params.start)) && Number.isFinite(Number(params.end))
  const options = { doc, title: params.title || '察元 MCP 批注' }
  if (hasAnchor) {
    const resolved = resolveWritableRange(doc, params)
    options.targetRange = doc.Range(resolved.start, resolved.end)
  }
  const result = applyDocumentAction('comment', text, options)
  return {
    ok: true,
    action: 'comment',
    charCount: text.length,
    ...result,
    document: docInfo(doc)
  }
}

export async function handleDocumentApplyOps(params = {}) {
  const doc = requireDoc(params)
  const ops = Array.isArray(params.operations || params.ops) ? (params.operations || params.ops) : []
  if (!ops.length) {
    const err = new Error('operations required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const action = String(params.action || 'replace').trim() || 'replace'
  const normalized = ops.slice(0, 200).map((op, i) => ({
    id: op.id || `op-${i}`,
    start: Number(op.start),
    end: Number(op.end),
    originalText: String(op.originalText || op.expectedText || ''),
    outputText: String(op.outputText ?? op.newText ?? op.text ?? ''),
    commentText: String(op.commentText || ''),
    prefix: String(op.prefix || ''),
    suffix: String(op.suffix || ''),
    chunkStart: Number(op.chunkStart),
    chunkEnd: Number(op.chunkEnd)
  }))

  if (params.confirmed !== true) {
    const previewOps = []
    for (const op of normalized) {
      try {
        const resolved = resolveWritableRange(doc, {
          start: op.start,
          end: op.end,
          originalText: op.originalText,
          hintStart: op.start
        })
        previewOps.push({
          id: op.id,
          ok: true,
          action,
          start: resolved.start,
          end: resolved.end,
          originalText: resolved.liveText,
          outputText: op.outputText,
          matchedBy: resolved.matchedBy
        })
      } catch (e) {
        previewOps.push({
          id: op.id,
          ok: false,
          code: e.code || 'ERROR',
          message: e.message
        })
      }
    }
    return {
      preview: true,
      requiresConfirmation: true,
      action,
      operationCount: normalized.length,
      operations: previewOps,
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  // applyStructuredExecutionPlan builds paragraph writebacks from contentBlocks;
  // MCP clients send operations[] — mirror them so insert-after/replace hit per-paragraph path.
  const contentBlocks = normalized
    .filter((op) => String(op.outputText || '').trim())
    .map((op, i) => ({
      start: Number.isFinite(op.start) ? op.start : 0,
      end: Number.isFinite(op.end) ? op.end : 0,
      paragraphIndex: i,
      inputText: op.originalText,
      outputText: op.outputText,
      quality: { level: 'ok' }
    }))
  const result = applyStructuredExecutionPlan(
    {
      requestContext: { documentAction: action, chunkWriteMode: 'paragraph-body' },
      operations: normalized.map((op) => ({
        ...op,
        text: op.originalText,
        type: action,
        replacementText: op.outputText
      })),
      contentBlocks,
      aggregatedContent: normalized.map((o) => o.outputText).join('\n')
    },
    { doc, title: params.title || '察元 MCP 批量写回' }
  )
  return {
    preview: false,
    ok: true,
    ...result,
    document: docInfo(doc)
  }
}

export async function handleDocumentNew() {
  const err = new Error('已禁用自动新建文档，请在当前打开的文档中编写；没有文档时请先手动打开目标文档。')
  err.code = 'DOCUMENT_CREATION_DISABLED'
  throw err
}

export async function handleDocumentSave(params = {}) {
  const path = String(params.path || '').trim()
  try {
    const result = path ? saveActiveDocumentAs(path) : saveActiveDocument()
    return { ok: true, ...result, document: docInfo() }
  } catch (e) {
    const err = new Error(e?.message || 'Save failed')
    err.code = 'DOCUMENT_SAVE_FAILED'
    throw err
  }
}

function normalizeDocPath(p) {
  return String(p || '').trim().replace(/\//g, '\\').toLowerCase()
}

function pathOrNameMatches(docMeta, needle) {
  const q = normalizeDocPath(needle)
  if (!q) return false
  const name = String(docMeta?.name || '').toLowerCase()
  const full = normalizeDocPath(docMeta?.fullName)
  const base = q.split('\\').filter(Boolean).pop() || q
  if (full && full === q) return true
  if (name && (name === q || name === base)) return true
  if (full && base && full.endsWith('\\' + base)) return true
  // fuzzy: substring on name / full path / basename without extension
  const nameNoExt = name.replace(/\.docx?$/i, '')
  const baseNoExt = base.replace(/\.docx?$/i, '')
  if (name.includes(q) || full.includes(q) || name.includes(base) || nameNoExt.includes(baseNoExt)) return true
  return false
}

/**
 * Collect open docs. Prefer Windows collection; fall back to Documents.
 * Each Item access is try/caught (some WPS builds hang on bad Items — skip failures).
 */
function collectOpenDocuments(app) {
  const items = []
  const seen = new Set()
  const pushDoc = (doc, extra = {}) => {
    if (!doc) return
    try {
      const fullName = String(doc.FullName || '')
      const name = String(doc.Name || '')
      const key = normalizeDocPath(fullName || name)
      if (!key || seen.has(key)) return
      seen.add(key)
      items.push({
        index: items.length + 1,
        name,
        fullName,
        saved: !!doc.Saved,
        ...extra
      })
    } catch { /* skip */ }
  }

  try {
    const windows = app?.Windows
    const n = Number(windows?.Count || 0)
    for (let i = 1; i <= n; i++) {
      try {
        const w = windows.Item(i)
        pushDoc(w?.Document, { windowIndex: i })
      } catch { /* skip window */ }
    }
  } catch { /* ignore */ }

  if (!items.length) {
    try {
      const docs = app?.Documents
      const n = Number(docs?.Count || 0)
      for (let i = 1; i <= n; i++) {
        try {
          pushDoc(docs.Item(i), { documentIndex: i })
        } catch { /* skip */ }
      }
    } catch { /* ignore */ }
  }

  // Always include ActiveDocument even if enumeration failed
  try {
    pushDoc(app?.ActiveDocument, { fromActive: true })
  } catch { /* ignore */ }

  return items
}

function markActive(items, app) {
  let activeName = ''
  let activeFull = ''
  try {
    activeName = String(app?.ActiveDocument?.Name || '')
    activeFull = String(app?.ActiveDocument?.FullName || '')
  } catch { /* ignore */ }
  return items.map((it) => ({
    ...it,
    active:
      (!!activeFull && normalizeDocPath(it.fullName) === normalizeDocPath(activeFull)) ||
      (!!activeName && String(it.name) === activeName)
  }))
}

export async function handleDocumentListOpen(params = {}) {
  const app = window.Application
  if (!app) {
    const err = new Error('WPS Application unavailable')
    err.code = 'WPS_API_UNAVAILABLE'
    throw err
  }
  const items = markActive(collectOpenDocuments(app), app)
  const query = String(params.query || '').trim()
  const filtered = query ? items.filter((it) => pathOrNameMatches(it, query)) : items
  return {
    ok: true,
    total: items.length,
    returned: filtered.length,
    items: filtered,
    active: docInfo(getActiveDocument())
  }
}

/**
 * Switch ActiveDocument among already-open windows/docs.
 * Does not open from disk unless openIfMissing+path.
 */
export async function handleDocumentActivate(params = {}) {
  const app = window.Application
  if (!app?.Documents) {
    const err = new Error('Documents API unavailable')
    err.code = 'WPS_API_UNAVAILABLE'
    throw err
  }

  const path = String(params.path || '').trim()
  const name = String(params.name || '').trim()
  const query = String(params.query || params.title || '').trim()
  const index = Number(params.index)
  const needle = path || name || query

  const before = docInfo(getActiveDocument())

  // Already the active document?
  if (needle && before.open && pathOrNameMatches(before, needle)) {
    try {
      app.ActiveDocument?.Activate?.()
    } catch { /* ignore */ }
    try {
      if (app && typeof app.Visible !== 'undefined') app.Visible = true
      app.Activate?.()
    } catch { /* ignore */ }
    return {
      ok: true,
      switched: false,
      alreadyActive: true,
      document: before,
      previous: before
    }
  }

  let activated = null

  // Direct Item lookup by path / name / basename (Word/WPS often supports this without full enum)
  const tryActivateItem = (key) => {
    if (!key) return null
    try {
      const d = app.Documents.Item(key)
      if (d) {
        d.Activate?.()
        return d
      }
    } catch { /* ignore */ }
    return null
  }

  if (path) activated = tryActivateItem(path)
  if (!activated && name) activated = tryActivateItem(name)
  if (!activated && needle) {
    const base = needle.replace(/\//g, '\\').split('\\').filter(Boolean).pop()
    if (base) activated = tryActivateItem(base)
  }

  // Enumerate open docs / windows and Activate match
  if (!activated && (needle || Number.isFinite(index))) {
    const open = collectOpenDocuments(app)
    let hit = null
    if (Number.isFinite(index) && index >= 1) {
      hit = open[index - 1] || open.find((it) => it.documentIndex === index || it.windowIndex === index)
    }
    if (!hit && needle) {
      const matches = open.filter((it) => pathOrNameMatches(it, needle))
      if (matches.length === 1) hit = matches[0]
      else if (matches.length > 1) {
        // prefer exact name/fullName
        hit =
          matches.find((it) => normalizeDocPath(it.fullName) === normalizeDocPath(needle)) ||
          matches.find((it) => String(it.name).toLowerCase() === needle.toLowerCase()) ||
          matches[0]
      }
    }
    if (hit) {
      // Prefer window activate when we have windowIndex
      if (hit.windowIndex != null) {
        try {
          app.Windows.Item(hit.windowIndex).Activate?.()
          activated = app.ActiveDocument
        } catch { /* fall through */ }
      }
      if (!activated) {
        activated =
          tryActivateItem(hit.fullName) ||
          tryActivateItem(hit.name) ||
          (hit.documentIndex != null ? tryActivateItem(hit.documentIndex) : null)
      }
    }
  }

  // Optional: open from disk if missing
  if (!activated && params.openIfMissing === true && path) {
    try {
      let opened = null
      try {
        opened = app.Documents.Open(path, false, false, true)
      } catch {
        opened = app.Documents.Open(path)
      }
      opened?.Activate?.()
      activated = opened || app.ActiveDocument
    } catch (e) {
      const err = new Error(e?.message || `无法打开并切换到: ${path}`)
      err.code = 'DOCUMENT_ACTIVATE_FAILED'
      throw err
    }
  }

  const after = docInfo(getActiveDocument())
  const matched =
    !!activated ||
    (needle ? pathOrNameMatches(after, needle) : Number.isFinite(index) && after.open)

  if (!matched) {
    const open = markActive(collectOpenDocuments(app), app)
    const err = new Error(
      needle
        ? `未找到已打开的文档：${needle}。可用 document_list_open 查看当前窗口。`
        : '请提供 path / name / query / index'
    )
    err.code = needle ? 'DOCUMENT_NOT_OPEN' : 'INVALID_PARAMS'
    err.details = { openDocuments: open, active: after }
    throw err
  }

  try {
    if (app && typeof app.Visible !== 'undefined') app.Visible = true
    app.Activate?.()
    app.ActiveDocument?.Activate?.()
  } catch { /* ignore */ }

  return {
    ok: true,
    switched: normalizeDocPath(before.fullName || before.name) !== normalizeDocPath(after.fullName || after.name),
    alreadyActive: false,
    previous: before,
    document: after,
    openCount: collectOpenDocuments(app).length
  }
}

export async function handleDeclassifyStatus() {
  return {
    ...getCurrentDeclassifyStatus(),
    document: docInfo()
  }
}

export async function handleDeclassifyPreview(params = {}) {
  const keywords = Array.isArray(params.keywords) ? params.keywords : []
  if (!keywords.length) {
    const err = new Error('keywords array required for preview (client LLM extracts secrets)')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  // Model S：文本缺省时按绑定解析取全文（有绑定标记则强制可解析；无标记回落活动文档）
  const doc = params.text != null ? null : requireDoc(params)
  const text = params.text != null ? String(params.text) : getDocumentText(doc)
  const preview = buildDeclassifyPreview(keywords, text)
  return {
    preview: true,
    ...preview,
    document: docInfo()
  }
}

export async function handleDeclassifyApply(params = {}) {
  requireConfirmed(params)
  const password = String(params.password || '')
  if (!password) {
    const err = new Error('password required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const keywordEntries = Array.isArray(params.keywords)
    ? params.keywords
    : (Array.isArray(params.keywordEntries) ? params.keywordEntries : [])
  if (!keywordEntries.length) {
    const err = new Error('keywords / keywordEntries required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const result = await applyDocumentDeclassify({
    password,
    keywordEntries,
    assistantOutput: params.assistantOutput
  })
  return {
    ok: true,
    applied: true,
    // never echo password
    document: docInfo(),
    summary: result && typeof result === 'object'
      ? {
          replacementCount: result.replacementCount ?? result.count,
          taskId: result.taskId || result.lifecycleTaskId
        }
      : { raw: true }
  }
}

export async function handleDeclassifyRestore(params = {}) {
  requireConfirmed(params)
  const password = String(params.password || '')
  if (!password) {
    const err = new Error('password required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const result = await restoreDocumentDeclassify(password)
  return {
    ok: true,
    restored: true,
    document: docInfo(),
    summary: result && typeof result === 'object'
      ? { taskId: result.taskId || result.lifecycleTaskId }
      : { raw: true }
  }
}

export async function handleSecurityEncryptSave(params = {}) {
  requireConfirmed(params)
  const password = String(params.password || '')
  if (!password) {
    const err = new Error('password required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const result = saveActiveObjectWithPassword(password, String(params.savePath || ''))
  return {
    ok: true,
    encrypted: true,
    // 永不回显密码
    path: result.path,
    fileName: result.fileName,
    document: docInfo()
  }
}

export async function handleSecurityDecryptSave(params = {}) {
  requireConfirmed(params)
  const result = saveActiveObjectWithoutPassword(String(params.savePath || ''), Number(params.attempt) || 0)
  return {
    ok: true,
    decrypted: true,
    api: result.api,
    path: result.path,
    fileName: result.fileName,
    document: docInfo()
  }
}

export async function handleKbRetrieve(params = {}) {
  const query = String(params.query || params.text || '').trim()
  if (!query) {
    const err = new Error('query required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  let binding = null
  let bindingSource = 'none'
  if (params.binding && typeof params.binding === 'object') {
    binding = params.binding
    bindingSource = 'params'
  } else if (Array.isArray(params.kbNames) && params.kbNames.length) {
    binding = {
      kbNames: params.kbNames,
      kuIds: Array.isArray(params.kuIds) ? params.kuIds : [],
      topK: Number(params.topK) || 5,
      connectionId: String(params.connectionId || '')
    }
    bindingSource = 'params'
  } else {
    try {
      binding = getAssistantKbBinding()
      bindingSource = binding ? 'current-chat' : 'none'
    } catch {
      binding = null
      bindingSource = 'error'
    }
  }
  const result = await retrieveKbContextForAssistant(binding, query, {})
  return {
    query: query.slice(0, 500),
    context: result.context || '',
    notice: result.notice || '',
    // 绑定来源诊断：再次出现「未绑定」时据此区分面板没发布 / getter 没注册 / 读失败
    bindingSource,
    bindingKbCount: Array.isArray(binding?.kbNames) ? binding.kbNames.length : 0,
    sourceCount: Array.isArray(result.sources) ? result.sources.length : 0,
    sources: (result.sources || []).slice(0, 24).map((c) => ({
      text: String(c.text || '').slice(0, 2000),
      file_name: c.file_name || c.kb_name || '',
      score: c.score
    })),
    document: docInfo()
  }
}

export default {
  handleDocumentMeta,
  handleDocumentListParagraphs,
  handleDocumentChunks,
  handleDocumentGetTextGuarded,
  handleDocumentLocate,
  handleDocumentReplace,
  handleDocumentInsert,
  handleDocumentAddComment,
  handleDocumentApplyOps,
  handleDocumentNew,
  handleDocumentSave,
  handleDeclassifyStatus,
  handleDeclassifyPreview,
  handleDeclassifyApply,
  handleDeclassifyRestore,
  handleKbRetrieve
}
