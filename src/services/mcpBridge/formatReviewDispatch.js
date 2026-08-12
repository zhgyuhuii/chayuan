/**
 * MCP P0 format / comment-list / revision / nav / layout handlers (Agent side).
 */
import { getActiveDocument, getApplication } from '../../utils/documentActions.js'
import {
  normalizeDocumentFormatIntent,
  executeDocumentFormatAction,
  describeDocumentFormatChanges,
  previewDocumentFormatMatches
} from '../../utils/documentFormatActions.js'
import {
  insertBlankPageAtPosition,
  insertPageBreakAtPosition
} from '../../utils/documentInsertActions.js'

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

function locateFirst(doc, text, hintStart = 0) {
  const needle = normalizeNeedle(text)
  if (!needle) return null
  const docEnd = Number(doc?.Content?.End || 0)
  let cursor = Math.max(0, Number(hintStart) || 0)
  let guard = 0
  let best = null
  while (cursor < docEnd && guard < 80) {
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
      find.Text = needle
      find.Forward = true
      find.MatchWildcards = false
    } catch { /* ignore */ }
    let ok = false
    try {
      ok = !!find.Execute()
    } catch {
      break
    }
    if (!ok) break
    const start = Number(r.Start)
    const end = Number(r.End)
    const candidate = { start, end, text: needle }
    if (best == null || Math.abs(start - hintStart) < Math.abs(best.start - hintStart)) {
      best = candidate
    }
    cursor = end > start ? end : start + 1
    if (hintStart <= 0) break
  }
  return best
}

function resolveAnchorRange(doc, params = {}) {
  const app = getApplication()
  const start = Number(params.start)
  const end = Number(params.end)
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return { start, end, range: doc.Range(start, end), how: 'range' }
  }
  const originalText = String(params.originalText || '').trim()
  if (originalText) {
    const hit = locateFirst(doc, originalText, Number(params.hintStart) || 0)
    if (!hit) {
      const err = new Error(`未找到锚点文本：${originalText.slice(0, 40)}`)
      err.code = 'ANCHOR_NOT_FOUND'
      throw err
    }
    return { start: hit.start, end: hit.end, range: doc.Range(hit.start, hit.end), how: 'originalText' }
  }
  const scope = String(params.scope || '').trim()
  if (scope === 'selection') {
    const sel = app?.Selection?.Range
    if (!sel) {
      const err = new Error('当前无选区')
      err.code = 'NO_SELECTION'
      throw err
    }
    return { start: Number(sel.Start), end: Number(sel.End), range: sel, how: 'selection' }
  }
  if (scope === 'paragraph') {
    const para = app?.Selection?.Paragraphs?.Item?.(1)?.Range
    if (!para) {
      const err = new Error('无法解析当前段落')
      err.code = 'NO_PARAGRAPH'
      throw err
    }
    return { start: Number(para.Start), end: Number(para.End), range: para, how: 'paragraph' }
  }
  if (scope === 'document') {
    const content = doc.Content
    return { start: Number(content.Start || 0), end: Number(content.End || 0), range: content, how: 'document' }
  }
  // default: selection if any, else fail for writes that need an anchor
  const sel = app?.Selection?.Range
  if (sel && Number(sel.End) > Number(sel.Start)) {
    return { start: Number(sel.Start), end: Number(sel.End), range: sel, how: 'selection' }
  }
  return null
}

function mapChangesToIntent(changes = {}, extra = {}) {
  const c = changes || {}
  const styleChanges = {
    bold: c.bold,
    italic: c.italic,
    underline: c.underline,
    strike: c.strike,
    fontName: c.name || c.fontName,
    fontSize: c.size,
    fontColor: c.color,
    backgroundColor: c.highlight,
    alignment: c.align,
    lineSpacing: c.lineSpacing != null ? { mode: 'multiple', value: c.lineSpacing } : undefined,
    spaceBefore: c.spaceBefore,
    spaceAfter: c.spaceAfter,
    firstLineIndent: c.firstLineIndent
  }
  return {
    intent: 'document-format',
    scope: extra.scope || 'selection',
    searchText: extra.searchText || '',
    scopeRange: extra.scopeRange || null,
    styleChanges,
    phonetic: c.phonetic,
    sizeDelta: c.sizeDelta
  }
}

function applySizeDelta(range, sizeDelta) {
  if (sizeDelta == null || !range?.Font) return null
  const delta = Number(sizeDelta)
  if (!Number.isFinite(delta) || delta === 0) return null
  try {
    const cur = Number(range.Font.Size) || 12
    range.Font.Size = Math.max(1, cur + delta)
    return range.Font.Size
  } catch {
    return null
  }
}

function applyPhonetic(range, phonetic) {
  const text = String(phonetic || '').trim()
  if (!text || !range) return false
  try {
    if (typeof range.PhoneticGuide === 'function') {
      range.PhoneticGuide(text)
      return true
    }
  } catch { /* ignore */ }
  return false
}

function buildWillChange(changes = {}) {
  return describeDocumentFormatChanges({
    bold: changes.bold,
    italic: changes.italic,
    underline: changes.underline,
    strike: changes.strike,
    fontName: changes.name,
    fontSize: changes.size,
    fontColor: changes.color,
    backgroundColor: changes.highlight,
    alignment: changes.align,
    lineSpacing: changes.lineSpacing != null ? { mode: 'multiple', value: changes.lineSpacing } : null,
    spaceBefore: changes.spaceBefore,
    spaceAfter: changes.spaceAfter,
    firstLineIndent: changes.firstLineIndent
  }).concat(
    changes.sizeDelta != null ? [`字号${Number(changes.sizeDelta) > 0 ? '+' : ''}${changes.sizeDelta}`] : [],
    changes.phonetic ? [`拼音:${changes.phonetic}`] : []
  )
}

export async function handleCommentList(params = {}) {
  const doc = requireDoc()
  const comments = doc.Comments
  const total = Number(comments?.Count || 0)
  const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 300)
  const authorFilter = String(params.author || '').trim().toLowerCase()
  const items = []
  for (let i = 1; i <= total && items.length < limit; i++) {
    try {
      const c = comments.Item(i)
      const author = String(c?.Author || c?.Initial || '')
      if (authorFilter && !author.toLowerCase().includes(authorFilter)) continue
      const range = c?.Scope || c?.Range
      const anchor = String(range?.Text || '').replace(/\r/g, '').slice(0, 120)
      items.push({
        index: i,
        author,
        text: String(c?.Range?.Text || c?.Text || '').replace(/\r/g, '\n').trim(),
        anchorText: anchor,
        start: Number(range?.Start),
        end: Number(range?.End)
      })
    } catch { /* skip broken comment */ }
  }
  return {
    ok: true,
    total,
    returned: items.length,
    items,
    document: docInfo(doc)
  }
}

export async function handleCommentDelete(params = {}) {
  const doc = requireDoc()
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: ['delete comment(s)'],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const comments = doc.Comments
  let deleted = 0
  const index = Number(params.index)
  if (Number.isFinite(index) && index >= 1) {
    try {
      comments.Item(index).Delete()
      deleted = 1
    } catch (e) {
      const err = new Error(e?.message || `删除批注失败: ${index}`)
      err.code = 'COMMENT_DELETE_FAILED'
      throw err
    }
  } else if (params.all === true) {
    for (let i = Number(comments?.Count || 0); i >= 1; i--) {
      try {
        comments.Item(i).Delete()
        deleted += 1
      } catch { /* skip */ }
    }
  } else if (params.originalText) {
    const needle = String(params.originalText)
    for (let i = Number(comments?.Count || 0); i >= 1; i--) {
      try {
        const c = comments.Item(i)
        const anchor = String((c?.Scope || c?.Range)?.Text || '')
        const body = String(c?.Range?.Text || c?.Text || '')
        if (anchor.includes(needle) || body.includes(needle)) {
          c.Delete()
          deleted += 1
        }
      } catch { /* skip */ }
    }
    if (!deleted) {
      const err = new Error('未找到匹配批注')
      err.code = 'COMMENT_NOT_FOUND'
      throw err
    }
  } else {
    const err = new Error('Provide index, originalText, or all:true')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  return { ok: true, preview: false, deleted, document: docInfo(doc) }
}

export async function handleFormatRun(params = {}) {
  const doc = requireDoc()
  const changes = params.changes || {}
  if (!changes || typeof changes !== 'object') {
    const err = new Error('changes required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const willChange = buildWillChange(changes)
  const preview = params.confirmed !== true

  const anchor = resolveAnchorRange(doc, params)
  if (!anchor && !params.originalText && params.scope !== 'document') {
    // allow search-only via originalText already handled; if nothing, try format engine with searchText
  }

  const intentExtra = {
    scope: params.scope || (anchor?.how === 'document' ? 'document' : 'selection'),
    searchText: String(params.originalText || '').trim(),
    scopeRange: anchor ? { Start: anchor.start, End: anchor.end } : null
  }

  // sizeDelta / phonetic need a concrete range
  if (preview) {
    if (intentExtra.searchText) {
      try {
        const matched = previewDocumentFormatMatches(mapChangesToIntent(changes, intentExtra))
        return {
          ok: true,
          preview: true,
          hits: matched?.matchCount || matched?.appliedCount || 0,
          willChange,
          anchors: matched?.matches || [],
          nextHint: 'Call again with confirmed=true to apply',
          document: docInfo(doc)
        }
      } catch (e) {
        return {
          ok: true,
          preview: true,
          hits: anchor ? 1 : 0,
          willChange,
          anchors: anchor ? [{ start: anchor.start, end: anchor.end }] : [],
          warning: e?.message || String(e),
          nextHint: 'Call again with confirmed=true to apply',
          document: docInfo(doc)
        }
      }
    }
    return {
      ok: true,
      preview: true,
      hits: anchor ? 1 : 0,
      willChange,
      anchors: anchor ? [{ start: anchor.start, end: anchor.end, how: anchor.how }] : [],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }

  requireConfirmed(params)

  // When originalText/start/end already resolved to a concrete range, apply ON that range.
  // Do not re-search inside the live Selection (often a collapsed caret → "没有找到").
  if (anchor?.range) {
    const styleIntent = normalizeDocumentFormatIntent({
      ...mapChangesToIntent(changes, { scope: 'selection' }),
      scope: 'selection',
      searchText: '',
      scopeRange: { Start: anchor.start, End: anchor.end }
    })
    try {
      anchor.range.Select?.()
    } catch { /* ignore */ }
    if (styleIntent?.hasStyleChanges) {
      executeDocumentFormatAction({
        ...styleIntent,
        scope: 'selection',
        searchText: ''
      })
    }
    const newSize = applySizeDelta(anchor.range, changes.sizeDelta)
    const phoneticOk = applyPhonetic(anchor.range, changes.phonetic)
    return {
      ok: true,
      preview: false,
      hits: 1,
      willChange,
      applied: { size: newSize, phonetic: phoneticOk },
      anchors: [{ start: anchor.start, end: anchor.end, how: anchor.how }],
      document: docInfo(doc)
    }
  }

  const mapped = mapChangesToIntent(changes, {
    ...intentExtra,
    // Without a resolved anchor, search whole document — not the caret selection.
    scope: params.scope || (intentExtra.searchText ? 'document' : 'selection')
  })
  if (changes.size != null) mapped.styleChanges.fontSize = Number(changes.size)
  const result = executeDocumentFormatAction(mapped)
  // phonetic on first match if requested
  if (changes.phonetic && intentExtra.searchText) {
    const hit = locateFirst(doc, intentExtra.searchText, Number(params.hintStart) || 0)
    if (hit) applyPhonetic(doc.Range(hit.start, hit.end), changes.phonetic)
  }
  return {
    ok: true,
    preview: false,
    hits: result.appliedCount || 0,
    willChange,
    message: result.message,
    document: docInfo(doc)
  }
}

export async function handleFormatPara(params = {}) {
  const changes = { ...(params.changes || {}) }
  // reuse format_run path — paragraph fields only
  return handleFormatRun({
    ...params,
    changes: {
      align: changes.align,
      lineSpacing: changes.lineSpacing,
      spaceBefore: changes.spaceBefore,
      spaceAfter: changes.spaceAfter,
      firstLineIndent: changes.firstLineIndent
    }
  })
}

export async function handleFormatApplyOps(params = {}) {
  const doc = requireDoc()
  const ops = Array.isArray(params.operations) ? params.operations.slice(0, 100) : []
  if (!ops.length) {
    const err = new Error('operations required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      hits: ops.length,
      willChange: ops.map((op) => buildWillChange(op.changes || {})),
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const results = []
  // Apply from document end toward start when start offsets exist
  const ordered = [...ops].sort((a, b) => (Number(b.start) || 0) - (Number(a.start) || 0))
  for (const op of ordered) {
    const kind = String(op.kind || 'run')
    const fn = kind === 'para' ? handleFormatPara : handleFormatRun
    // eslint-disable-next-line no-await-in-loop
    const one = await fn({ ...op, confirmed: true })
    results.push({ ok: !!one?.ok, hits: one?.hits || 0 })
  }
  return {
    ok: true,
    preview: false,
    hits: results.reduce((s, r) => s + (r.hits || 0), 0),
    results,
    document: docInfo(doc)
  }
}

export async function handleSystemFontsList(params = {}) {
  const app = getApplication()
  const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 400)
  const query = String(params.query || '').trim().toLowerCase()
  const names = []
  const fontNames = app?.FontNames
  const count = Number(fontNames?.Count || 0)
  if (count > 0) {
    for (let i = 1; i <= count && names.length < limit; i++) {
      try {
        const n = String(fontNames.Item(i) || '')
        if (!n) continue
        if (query && !n.toLowerCase().includes(query)) continue
        names.push(n)
      } catch { /* skip */ }
    }
  }
  return { ok: true, total: count || names.length, returned: names.length, fonts: names }
}

export async function handleStyleList(params = {}) {
  const doc = requireDoc()
  const styles = doc.Styles
  const total = Number(styles?.Count || 0)
  const limit = Math.min(Math.max(Number(params.limit) || 80, 1), 300)
  const query = String(params.query || '').trim().toLowerCase()
  const headingOnly = params.headingOnly === true
  const items = []
  for (let i = 1; i <= total && items.length < limit; i++) {
    try {
      const s = styles.Item(i)
      const name = String(s?.NameLocal || s?.Name || '')
      if (!name) continue
      if (query && !name.toLowerCase().includes(query)) continue
      if (headingOnly && !/标题|heading|标题\s*\d/i.test(name)) continue
      items.push({ index: i, name })
    } catch { /* skip */ }
  }
  return { ok: true, total, returned: items.length, styles: items, document: docInfo(doc) }
}

export async function handleStyleApply(params = {}) {
  const doc = requireDoc()
  const styleName = String(params.styleName || '').trim()
  if (!styleName) {
    const err = new Error('styleName required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const anchor = resolveAnchorRange(doc, params)
  if (!anchor) {
    const err = new Error('需要锚点（originalText / start-end / scope）')
    err.code = 'ANCHOR_REQUIRED'
    throw err
  }
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      hits: 1,
      willChange: [`style=${styleName}`],
      anchors: [{ start: anchor.start, end: anchor.end }],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  try {
    anchor.range.Style = styleName
  } catch (e) {
    try {
      const st = doc.Styles.Item(styleName)
      anchor.range.Style = st
    } catch (e2) {
      const err = new Error(e2?.message || e?.message || '应用样式失败')
      err.code = 'STYLE_APPLY_FAILED'
      throw err
    }
  }
  return {
    ok: true,
    preview: false,
    hits: 1,
    willChange: [`style=${styleName}`],
    anchors: [{ start: anchor.start, end: anchor.end }],
    document: docInfo(doc)
  }
}

export async function handleNavLocation(params = {}) {
  const doc = requireDoc()
  const app = getApplication()
  const anchor = resolveAnchorRange(doc, {
    ...params,
    scope: params.scope || (params.originalText || params.start != null ? undefined : 'selection')
  })
  if (!anchor?.range) {
    const err = new Error('需要锚点或选区')
    err.code = 'ANCHOR_REQUIRED'
    throw err
  }
  const info = (wd) => {
    try {
      return Number(anchor.range.Information?.(wd))
    } catch {
      return null
    }
  }
  // Word/WPS Information constants (common)
  const wdActiveEndPageNumber = app?.Enum?.wdActiveEndPageNumber ?? 3
  const wdFirstCharacterLineNumber = app?.Enum?.wdFirstCharacterLineNumber ?? 10
  return {
    ok: true,
    page: info(wdActiveEndPageNumber),
    line: info(wdFirstCharacterLineNumber),
    start: anchor.start,
    end: anchor.end,
    document: docInfo(doc)
  }
}

export async function handleBreakInsert(params = {}) {
  requireConfirmed(params)
  const doc = requireDoc()
  const kind = String(params.kind || 'page')
  if (params.originalText) {
    const hit = locateFirst(doc, params.originalText, 0)
    if (hit) {
      try {
        doc.Range(hit.end, hit.end).Select?.()
      } catch { /* ignore */ }
    }
  }
  if (kind === 'page') {
    insertPageBreakAtPosition({})
    return { ok: true, kind, document: docInfo(doc) }
  }
  const app = getApplication()
  const sel = app?.Selection?.Range || doc.Content
  const map = {
    section: app?.Enum?.wdSectionBreakNextPage ?? 2,
    column: app?.Enum?.wdColumnBreak ?? 8
  }
  const breakType = map[kind]
  if (breakType == null || typeof sel.InsertBreak !== 'function') {
    const err = new Error(`不支持的分隔符类型或宿主无 InsertBreak: ${kind}`)
    err.code = 'UNSUPPORTED'
    throw err
  }
  sel.InsertBreak(breakType)
  return { ok: true, kind, document: docInfo(doc) }
}

export async function handlePageBlankInsert(params = {}) {
  requireConfirmed(params)
  const doc = requireDoc()
  if (params.position === 'after' && params.originalText) {
    const hit = locateFirst(doc, String(params.originalText), 0)
    if (hit) {
      try {
        doc.Range(hit.end, hit.end).Select?.()
      } catch { /* ignore */ }
    }
  }
  insertBlankPageAtPosition({})
  return { ok: true, document: docInfo(doc) }
}

export async function handleRevisionMode(params = {}) {
  const doc = requireDoc()
  const enabled = params.enabled === true
  try {
    doc.TrackRevisions = enabled
  } catch (e) {
    const err = new Error(e?.message || '无法设置修订模式')
    err.code = 'REVISION_MODE_FAILED'
    throw err
  }
  if (params.show != null) {
    try {
      doc.ShowRevisions = params.show === true
    } catch { /* optional */ }
  }
  return {
    ok: true,
    enabled,
    show: params.show,
    document: docInfo(doc)
  }
}

export async function handleRevisionList(params = {}) {
  const doc = requireDoc()
  const revs = doc.Revisions
  const total = Number(revs?.Count || 0)
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200)
  const items = []
  for (let i = 1; i <= total && items.length < limit; i++) {
    try {
      const r = revs.Item(i)
      items.push({
        index: i,
        author: String(r?.Author || ''),
        type: r?.Type,
        date: String(r?.Date || ''),
        text: String(r?.Range?.Text || '').replace(/\r/g, '').slice(0, 80)
      })
    } catch { /* skip */ }
  }
  return { ok: true, total, returned: items.length, items, document: docInfo(doc) }
}

export async function handleRevisionApply(params = {}) {
  requireConfirmed(params)
  const doc = requireDoc()
  const action = String(params.action || '').trim()
  const scope = String(params.scope || 'all')
  if (action !== 'accept' && action !== 'reject') {
    const err = new Error('action must be accept|reject')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  if (scope === 'all') {
    try {
      if (action === 'accept') doc.AcceptAllRevisions?.()
      else doc.RejectAllRevisions?.()
    } catch (e) {
      const err = new Error(e?.message || '批量接受/拒绝失败')
      err.code = 'REVISION_APPLY_FAILED'
      throw err
    }
    return { ok: true, action, scope: 'all', document: docInfo(doc) }
  }
  const indexes = Array.isArray(params.indexes) ? params.indexes.map(Number).filter((n) => n >= 1) : []
  // delete from high index to low
  const ordered = [...indexes].sort((a, b) => b - a)
  let done = 0
  for (const idx of ordered) {
    try {
      const r = doc.Revisions.Item(idx)
      if (action === 'accept') r.Accept?.()
      else r.Reject?.()
      done += 1
    } catch { /* skip */ }
  }
  return { ok: true, action, scope: 'indexes', applied: done, document: docInfo(doc) }
}

export async function handleNavPaneSet(params = {}) {
  const app = getApplication()
  const visible = params.visible === true
  try {
    if (app?.ActiveWindow) {
      if (typeof app.ActiveWindow.DocumentMap !== 'undefined') {
        app.ActiveWindow.DocumentMap = visible
      } else if (app.ActiveWindow.View && typeof app.ActiveWindow.View.ShowTabs !== 'undefined') {
        // best-effort fallback — some builds use different flags
        app.ActiveWindow.DocumentMap = visible
      }
    }
  } catch (e) {
    const err = new Error(e?.message || '无法设置导航窗格')
    err.code = 'NAV_PANE_FAILED'
    throw err
  }
  return { ok: true, visible, uiOnly: true }
}

export async function handleLayoutPage(params = {}) {
  const doc = requireDoc()
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: [
        params.orientation ? `orientation=${params.orientation}` : null,
        params.marginTop != null ? `marginTop=${params.marginTop}` : null
      ].filter(Boolean),
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const ps = doc.PageSetup
  if (!ps) {
    const err = new Error('PageSetup unavailable')
    err.code = 'UNSUPPORTED'
    throw err
  }
  const app = getApplication()
  if (params.orientation === 'landscape') {
    ps.Orientation = app?.Enum?.wdOrientLandscape ?? 1
  } else if (params.orientation === 'portrait') {
    ps.Orientation = app?.Enum?.wdOrientPortrait ?? 0
  }
  if (params.marginTop != null) ps.TopMargin = Number(params.marginTop)
  if (params.marginBottom != null) ps.BottomMargin = Number(params.marginBottom)
  if (params.marginLeft != null) ps.LeftMargin = Number(params.marginLeft)
  if (params.marginRight != null) ps.RightMargin = Number(params.marginRight)
  return { ok: true, preview: false, document: docInfo(doc) }
}

function resolveInsertRange(doc, params = {}) {
  if (params.originalText) {
    const hit = locateFirst(doc, String(params.originalText), Number(params.hintStart) || 0)
    if (!hit) {
      const err = new Error(`未找到锚点文本：${String(params.originalText).slice(0, 40)}`)
      err.code = 'ANCHOR_NOT_FOUND'
      throw err
    }
    const at = params.position === 'before' ? hit.start : hit.end
    return doc.Range(at, at)
  }
  const start = Number(params.start)
  if (Number.isFinite(start)) {
    return doc.Range(start, start)
  }
  const app = getApplication()
  return app?.Selection?.Range || doc.Range(0, 0)
}

/**
 * Insert a Word/WPS TOC field (heading styles). Prefer after an anchor near doc start.
 */
export async function handleTocInsert(params = {}) {
  const doc = requireDoc()
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: ['insert TOC field'],
      levels: {
        upper: Number(params.upperLevel) || 1,
        lower: Number(params.lowerLevel) || 3
      },
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const app = getApplication()
  const upper = Math.min(9, Math.max(1, Number(params.upperLevel) || 1))
  const lower = Math.min(9, Math.max(upper, Number(params.lowerLevel) || 3))
  const title = params.title === false || params.title === ''
    ? ''
    : String(params.title == null ? '目录' : params.title).trim()

  let insertAt = resolveInsertRange(doc, params)
  try {
    insertAt.Select?.()
  } catch { /* ignore */ }

  if (title) {
    try {
      const sel = app?.Selection
      if (sel?.TypeText) {
        sel.TypeText(`${title}\r`)
      } else {
        insertAt.InsertBefore?.(`${title}\r`)
      }
      insertAt = resolveInsertRange(doc, {
        originalText: title,
        position: 'after',
        hintStart: Number(params.hintStart) || 0
      })
      try {
        insertAt.Select?.()
      } catch { /* ignore */ }
    } catch { /* title optional */ }
  }

  const useHyperlinks = params.useHyperlinks !== false
  const includePageNumbers = params.includePageNumbers !== false
  const rightAlign = params.rightAlignPageNumbers !== false
  // TOC field switches: \o levels, \h hyperlinks, \z hide in web, \u outline levels
  const switches = [
    `\\o "${upper}-${lower}"`,
    useHyperlinks ? '\\h' : '',
    '\\z',
    '\\u',
    includePageNumbers ? '' : '\\n',
    rightAlign ? '' : ''
  ]
    .filter(Boolean)
    .join(' ')
  const fieldCode = `TOC ${switches}`.trim()
  const wdFieldTOC = app?.Enum?.wdFieldTOC ?? 13

  let how = 'fields'
  try {
    if (!doc.Fields || typeof doc.Fields.Add !== 'function') {
      throw new Error('Fields.Add unavailable')
    }
    doc.Fields.Add(insertAt, wdFieldTOC, fieldCode, true)
  } catch (e1) {
    how = 'tablesOfContents'
    const tocs = doc.TablesOfContents
    if (!tocs || typeof tocs.Add !== 'function') {
      const err = new Error(e1?.message || '当前宿主不支持插入目录')
      err.code = 'UNSUPPORTED'
      throw err
    }
    try {
      tocs.Add(
        insertAt,
        true,
        upper,
        lower,
        false,
        rightAlign,
        includePageNumbers,
        '',
        useHyperlinks,
        true,
        true
      )
    } catch (e2) {
      try {
        tocs.Add(insertAt, true, upper, lower)
      } catch (e3) {
        const err = new Error(e3?.message || e2?.message || e1?.message || '插入目录失败')
        err.code = 'TOC_INSERT_FAILED'
        throw err
      }
    }
  }

  // Best-effort update so page numbers appear immediately
  try {
    const tocs = doc.TablesOfContents
    const n = Number(tocs?.Count || 0)
    if (n > 0 && typeof tocs.Item(n).Update === 'function') tocs.Item(n).Update()
  } catch { /* ignore */ }
  try {
    const fields = doc.Fields
    const n = Number(fields?.Count || 0)
    for (let i = n; i >= 1; i--) {
      const f = fields.Item(i)
      if (Number(f?.Type) === wdFieldTOC && typeof f.Update === 'function') {
        f.Update()
        break
      }
    }
  } catch { /* ignore */ }

  return {
    ok: true,
    preview: false,
    how,
    tocCount: Number(doc.TablesOfContents?.Count || 0),
    fieldCount: Number(doc.Fields?.Count || 0),
    upperLevel: upper,
    lowerLevel: lower,
    title: title || null,
    fieldCode,
    document: docInfo(doc)
  }
}

export async function handleTocUpdate(params = {}) {
  const doc = requireDoc()
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: ['TOC Update'],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const app = getApplication()
  const wdFieldTOC = app?.Enum?.wdFieldTOC ?? 13
  const tocs = doc.TablesOfContents
  const tocTotal = Number(tocs?.Count || 0)
  let updated = 0

  if (tocTotal > 0) {
    const index = Math.min(tocTotal, Math.max(1, Number(params.index) || 1))
    try {
      const toc = tocs.Item(index)
      if (typeof toc.Update === 'function') toc.Update()
      else if (typeof toc.UpdatePageNumbers === 'function') toc.UpdatePageNumbers()
      else throw new Error('目录对象不支持 Update')
      updated += 1
      return {
        ok: true,
        preview: false,
        how: 'tablesOfContents',
        tocIndex: index,
        total: tocTotal,
        updated,
        document: docInfo(doc)
      }
    } catch (e) {
      // fall through to Fields
      if (e?.code) throw e
    }
  }

  const fields = doc.Fields
  const fieldTotal = Number(fields?.Count || 0)
  for (let i = 1; i <= fieldTotal; i++) {
    try {
      const f = fields.Item(i)
      if (Number(f?.Type) !== wdFieldTOC) continue
      if (typeof f.Update === 'function') {
        f.Update()
        updated += 1
      }
    } catch { /* skip */ }
  }
  if (!updated) {
    const err = new Error('文档中没有目录可更新')
    err.code = 'TOC_NOT_FOUND'
    throw err
  }
  return {
    ok: true,
    preview: false,
    how: 'fields',
    total: fieldTotal,
    updated,
    document: docInfo(doc)
  }
}
