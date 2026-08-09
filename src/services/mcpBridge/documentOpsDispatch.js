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
import { saveActiveDocument, saveActiveDocumentAs } from '../../utils/documentFileActions.js'
import {
  getCurrentDeclassifyStatus,
  buildDeclassifyPreview,
  applyDocumentDeclassify,
  restoreDocumentDeclassify
} from '../../utils/documentDeclassifyService.js'
import { retrieveKbContextForAssistant } from '../../services/kb/retrievalMiddleware.js'
import { getAssistantKbBinding } from '../../utils/assistant/kbAssistantBinding.js'

export const DOCUMENT_GET_TEXT_MAX_CHARS = 80_000
export const DOCUMENT_CHUNKS_LIMIT_MAX = 8
export const DOCUMENT_CHUNKS_LIMIT_DEFAULT = 2

function requireDoc() {
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
  const doc = requireDoc()
  const settings = getChunkSettings()
  const chunkLength = Number(params.chunkLength) > 0 ? Number(params.chunkLength) : settings.chunkLength
  const overlapLength = Number(params.overlapLength) >= 0 ? Number(params.overlapLength) : settings.overlapLength
  let charCount = 0
  let paragraphCount = 0
  try {
    charCount = String(doc.Content?.Text || '').length
  } catch {
    charCount = String(getDocumentText() || '').length
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
  const doc = requireDoc()
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
  const doc = requireDoc()
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
  if (!text) text = String(getDocumentText() || '')
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
  const doc = requireDoc()
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
  const doc = requireDoc()
  const newText = String(params.newText ?? params.text ?? '')
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
  const targetRange = doc.Range(resolved.start, resolved.end)
  const result = applyDocumentAction('replace', newText, {
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
  const doc = requireDoc()
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

  let options = { title: params.title || '察元 MCP 插入' }
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
  const doc = requireDoc()
  const text = String(params.text || '')
  if (!text) {
    const err = new Error('text required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const hasAnchor =
    params.originalText ||
    params.expectedText ||
    params.anchorText ||
    (Number.isFinite(Number(params.start)) && Number.isFinite(Number(params.end)))
  const options = { title: params.title || '察元 MCP 批注' }
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
  const doc = requireDoc()
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
    { title: params.title || '察元 MCP 批量写回' }
  )
  return {
    preview: false,
    ok: true,
    ...result,
    document: docInfo(doc)
  }
}

export async function handleDocumentNew(params = {}) {
  const app = window.Application
  if (!app?.Documents) {
    const err = new Error('Documents API unavailable')
    err.code = 'WPS_API_UNAVAILABLE'
    throw err
  }
  const templatePath = String(params.templatePath || params.path || '').trim()
  if (templatePath) {
    try {
      if (typeof app.Documents.Open === 'function') {
        try {
          app.Documents.Open(templatePath, false, false, true)
        } catch {
          app.Documents.Open(templatePath)
        }
      } else if (typeof app.Documents.OpenFromUrl === 'function') {
        app.Documents.OpenFromUrl(templatePath)
      } else {
        throw new Error('Open unavailable')
      }
      return { ok: true, created: false, openedTemplate: true, document: docInfo() }
    } catch (e) {
      const err = new Error(e?.message || 'Failed to open template')
      err.code = 'DOCUMENT_NEW_FAILED'
      throw err
    }
  }
  try {
    if (typeof app.Documents.Add === 'function') {
      app.Documents.Add()
    } else {
      const err = new Error('Documents.Add unavailable')
      err.code = 'WPS_API_UNAVAILABLE'
      throw err
    }
  } catch (e) {
    if (e?.code) throw e
    const err = new Error(e?.message || 'Documents.Add failed')
    err.code = 'DOCUMENT_NEW_FAILED'
    throw err
  }
  return { ok: true, created: true, document: docInfo() }
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
  const text = params.text != null ? String(params.text) : getDocumentText()
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

export async function handleKbRetrieve(params = {}) {
  const query = String(params.query || params.text || '').trim()
  if (!query) {
    const err = new Error('query required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  let binding = null
  if (params.binding && typeof params.binding === 'object') {
    binding = params.binding
  } else if (Array.isArray(params.kbNames) && params.kbNames.length) {
    binding = {
      kbNames: params.kbNames,
      kuIds: Array.isArray(params.kuIds) ? params.kuIds : [],
      topK: Number(params.topK) || 5,
      connectionId: String(params.connectionId || '')
    }
  } else {
    try {
      binding = getAssistantKbBinding()
    } catch {
      binding = null
    }
  }
  const result = await retrieveKbContextForAssistant(binding, query, {})
  return {
    query: query.slice(0, 500),
    context: result.context || '',
    notice: result.notice || '',
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
