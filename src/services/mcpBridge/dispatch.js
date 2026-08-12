/**
 * Unified MCP Agent dispatcher — handles jobs from sidecar long-poll.
 */
import {
  startSpellCheckAllTask,
  startSpellCheckSelectionTask,
  applySpellCheckIssueComment,
  applySkippedSpellCheckComments
} from '../../utils/spellCheckService.js'
import { getTaskById, updateTask } from '../../utils/taskListStore.js'
import { gateCapability } from './licenseGate.js'
import { MCP_PROTOCOL_VERSION, getAddonVersion } from './config.js'
import {
  handleAssistantsListDomains,
  handleAssistantsSearch,
  handleAssistantsGet
} from './assistantsDispatch.js'
import {
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
  handleDocumentListOpen,
  handleDocumentActivate,
  handleDeclassifyStatus,
  handleDeclassifyPreview,
  handleDeclassifyApply,
  handleDeclassifyRestore,
  handleKbRetrieve
} from './documentOpsDispatch.js'
import {
  handleCommentList,
  handleCommentDelete,
  handleFormatRun,
  handleFormatPara,
  handleFormatApplyOps,
  handleSystemFontsList,
  handleStyleList,
  handleStyleApply,
  handleNavLocation,
  handleBreakInsert,
  handlePageBlankInsert,
  handleRevisionMode,
  handleRevisionList,
  handleRevisionApply,
  handleNavPaneSet,
  handleLayoutPage,
  handleTocInsert,
  handleTocUpdate
} from './formatReviewDispatch.js'
import {
  handleLayoutColumns,
  handleNavOutline,
  handleBookmarkList,
  handleBookmarkGoto,
  handleTableInsert,
  handleTableList,
  handleTableHeaderRead,
  handleTableRowRead,
  handleTableColumnRead,
  handleTableCellRead,
  handleTableHeaderRepeat,
  handleTableColumnSetWidth,
  handleTableExport,
  handleTableRowInsert,
  handleTableColumnInsert,
  handleTableCellMerge,
  handleCaptionList,
  handleFieldList,
  handleFieldAdd,
  handleImageList,
  handleImageInsert,
  handleImageDelete,
  handleImageExport,
  handleHyperlinkList,
  handleHyperlinkAdd,
  handleHyperlinkDelete,
  handleHeaderFooterGet,
  handleHeaderFooterSet,
  handleWatermarkSet,
  handleWatermarkClear,
  handleDocumentExport,
  handleStyleAudit
} from './objectStructureDispatch.js'
import { activateHostWindow } from '../../utils/windowActivation.js'

/** Bring opened doc + WPS main window to foreground (Open alone often leaves UI hidden/behind). */
function revealOpenedDocument(activate = true) {
  if (activate === false) return { activated: false }
  const app = window.Application
  try {
    if (app && typeof app.Visible !== 'undefined') app.Visible = true
  } catch { /* ignore */ }
  try {
    const doc = app?.ActiveDocument
    if (doc && typeof doc.Activate === 'function') doc.Activate()
  } catch { /* ignore */ }
  try {
    activateHostWindow()
  } catch { /* ignore */ }
  return { activated: true }
}

function getUiVisibility() {
  const app = window.Application
  const ui = {
    applicationVisible: null,
    windowState: null,
    windowVisible: null,
    likelyHidden: null
  }
  try {
    if (app && typeof app.Visible !== 'undefined') ui.applicationVisible = !!app.Visible
  } catch { /* ignore */ }
  try {
    const host = app?.ActiveWindow
    if (host) {
      ui.windowState = host.WindowState
      try {
        ui.windowVisible = !!host.Visible
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  const minimized = app?.Enum?.wdWindowStateMinimize ?? 2
  ui.likelyHidden =
    ui.applicationVisible === false ||
    ui.windowVisible === false ||
    ui.windowState === minimized
  return ui
}

function getActiveDocumentInfo() {
  try {
    const app = window.Application
    const doc = app?.ActiveDocument
    const ui = getUiVisibility()
    if (!doc) return { open: false, ui }
    return {
      open: true,
      name: String(doc.Name || ''),
      fullName: String(doc.FullName || ''),
      saved: !!doc.Saved,
      addonType: 'wps',
      ui
    }
  } catch (e) {
    return { open: false, error: e?.message || String(e), ui: getUiVisibility() }
  }
}

/** Normalize local paths for case-insensitive compare (Windows-oriented). */
function normalizeDocPath(p) {
  return String(p || '').trim().replace(/\//g, '\\').toLowerCase()
}

/**
 * Match path against a document. Uses ActiveDocument fields only —
 * never Documents.Item (sync hang observed on some WPS builds).
 */
function pathMatchesDoc(doc, filePath) {
  if (!doc) return false
  const target = normalizeDocPath(filePath)
  if (!target) return false
  const targetName = target.split('\\').filter(Boolean).pop() || ''
  try {
    const full = normalizeDocPath(doc.FullName || '')
    const name = String(doc.Name || '').toLowerCase()
    if (full && full === target) return true
    if (targetName && name === targetName) return true
    if (targetName && full.endsWith('\\' + targetName)) return true
    return false
  } catch {
    return false
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function openLocalDocument(filePath) {
  const app = window.Application
  if (!app?.Documents) {
    const err = new Error('Documents API unavailable')
    err.code = 'WPS_API_UNAVAILABLE'
    throw err
  }
  if (/^https?:\/\//i.test(filePath)) {
    const err = new Error('network URL open not allowed in MVP; use local path')
    err.code = 'PATH_NOT_ALLOWED'
    throw err
  }
  let lastError = null
  // Prefer Documents.Open for local paths — OpenFromUrl has hung on some WPS builds/file types.
  try {
    if (typeof app.Documents.Open === 'function') {
      let opened = null
      try {
        opened = app.Documents.Open(filePath, false, false, true)
      } catch {
        opened = app.Documents.Open(filePath)
      }
      await sleep(150)
      try {
        if (opened && typeof opened.Activate === 'function') opened.Activate()
      } catch { /* ignore */ }
      return
    }
  } catch (e) {
    lastError = e
  }
  try {
    if (typeof app.Documents.OpenFromUrl === 'function') {
      app.Documents.OpenFromUrl(filePath)
      for (let i = 0; i < 20; i++) {
        await sleep(100)
        if (pathMatchesDoc(app.ActiveDocument, filePath)) return
        try {
          if (app.ActiveDocument && String(app.ActiveDocument.Name || '')) return
        } catch { /* ignore */ }
      }
      return
    }
  } catch (e) {
    lastError = e
  }
  const err = new Error(lastError?.message || 'Documents.Open / OpenFromUrl unavailable')
  err.code = lastError ? 'DOCUMENT_OPEN_FAILED' : 'WPS_API_UNAVAILABLE'
  throw err
}

function collectIssuesFromTask(taskId) {
  const task = getTaskById(taskId)
  if (!task) return { taskId, issues: [], commentCount: 0 }
  const issues = []
  const items = Array.isArray(task.data?.items) ? task.data.items : []
  items.forEach((item, itemIndex) => {
    const parsed = Array.isArray(item?.parsedItems) ? item.parsedItems : []
    parsed.forEach((issue, issueIndex) => {
      issues.push({
        itemIndex,
        issueIndex,
        text: issue?.text || issue?.original || '',
        reason: issue?.reason || '',
        suggestion: issue?.suggestion || '',
        sentence: issue?.sentence || '',
        prefix: issue?.prefix || '',
        suffix: issue?.suffix || '',
        anchorStatus: issue?.anchorStatus || '',
        qualityLevel: issue?.qualityLevel || ''
      })
    })
  })
  return {
    taskId,
    status: task.status,
    issueCount: issues.length,
    commentCount: Number(task.data?.commentCount || 0),
    issues,
    preview: task.data?.mcpDryRun === true
  }
}

async function handleProofreadRun(params = {}) {
  const gate = gateCapability('spell-check')
  if (!gate.allowed) {
    const err = new Error(gate.reason || 'LICENSE_REQUIRED')
    err.code = gate.code || 'LICENSE_REQUIRED'
    throw err
  }

  const dryRun = params.dryRun !== false
  const scope = params.scope === 'selection' ? 'selection' : 'document'

  const starter = scope === 'selection' ? startSpellCheckSelectionTask : startSpellCheckAllTask
  let started
  try {
    started = starter({
      dryRun,
      headless: true,
      mcpJob: true,
      onError: (msg) => console.warn('[mcpBridge] proofread:', msg)
    })
  } catch (e) {
    if (/模型|model|配置/i.test(String(e?.message || ''))) {
      const err = new Error(e.message || 'MODEL_NOT_CONFIGURED')
      err.code = 'MODEL_NOT_CONFIGURED'
      throw err
    }
    throw e
  }

  const { taskId, promise } = started
  try {
    await promise
  } catch (e) {
    if (/模型|model|配置/i.test(String(e?.message || ''))) {
      const err = new Error(e.message || 'MODEL_NOT_CONFIGURED')
      err.code = 'MODEL_NOT_CONFIGURED'
      throw err
    }
    throw e
  }

  try {
    const task = getTaskById(taskId)
    if (task) {
      updateTask(taskId, {
        data: { ...(task.data || {}), mcpDryRun: dryRun }
      })
    }
  } catch { /* ignore */ }
  const summary = collectIssuesFromTask(taskId)

  return {
    ...summary,
    dryRun,
    document: getActiveDocumentInfo(),
    mode: params.mode || 'assistant'
  }
}

async function handleApplyComments(params = {}) {
  if (params.confirmed !== true) {
    const err = new Error('confirmed: true required')
    err.code = 'CONFIRMATION_REQUIRED'
    throw err
  }

  const gate = gateCapability('spell-check')
  if (!gate.allowed) {
    const err = new Error(gate.reason || 'LICENSE_REQUIRED')
    err.code = gate.code || 'LICENSE_REQUIRED'
    throw err
  }

  const taskId = String(params.taskId || '')
  if (!taskId) {
    const err = new Error('taskId required')
    err.code = 'INVALID_PARAMS'
    throw err
  }

  const maxComments = Number(params.maxComments) > 0 ? Number(params.maxComments) : 200
  let applied = 0
  let failed = 0
  const errors = []

  if (Array.isArray(params.targets) && params.targets.length) {
    for (const t of params.targets.slice(0, maxComments)) {
      try {
        await applySpellCheckIssueComment(taskId, Number(t.itemIndex), Number(t.issueIndex))
        applied++
      } catch (e) {
        failed++
        errors.push({ target: t, message: e?.message || String(e) })
      }
    }
  } else {
    // Apply all skipped (dryRun sets document_action_none → skipped)
    try {
      const r = await applySkippedSpellCheckComments(taskId, null)
      applied = Number(r?.appliedCount || 0)
    } catch (e) {
      // Fallback: walk issues
      const summary = collectIssuesFromTask(taskId)
      for (const issue of summary.issues.slice(0, maxComments)) {
        try {
          await applySpellCheckIssueComment(taskId, issue.itemIndex, issue.issueIndex)
          applied++
        } catch (err) {
          failed++
          errors.push({
            target: { itemIndex: issue.itemIndex, issueIndex: issue.issueIndex },
            message: err?.message || String(err)
          })
        }
      }
    }
  }

  return {
    taskId,
    applied,
    failed,
    errors: errors.slice(0, 20),
    document: getActiveDocumentInfo(),
    ...collectIssuesFromTask(taskId)
  }
}

/**
 * @param {{ method: string, params?: any }} job
 */
export async function dispatchMcpJob(job = {}) {
  const method = String(job.method || '')
  const params = job.params || {}

  switch (method) {
    case 'wps.status':
      return {
        protocolVersion: MCP_PROTOCOL_VERSION,
        addonVersion: getAddonVersion(),
        agentOnline: true,
        document: getActiveDocumentInfo(),
        addonType: 'wps'
      }
    case 'document.get_text':
      return handleDocumentGetTextGuarded(params)
    case 'document.meta':
      return handleDocumentMeta(params)
    case 'document.list_paragraphs':
      return handleDocumentListParagraphs(params)
    case 'document.chunks':
      return handleDocumentChunks(params)
    case 'document.locate':
      return handleDocumentLocate(params)
    case 'document.replace':
      return handleDocumentReplace(params)
    case 'document.insert':
      return handleDocumentInsert(params)
    case 'document.apply_ops':
      return handleDocumentApplyOps(params)
    case 'document.new':
      return handleDocumentNew(params)
    case 'document.save':
      return handleDocumentSave(params)
    case 'document.list_open':
      return handleDocumentListOpen(params)
    case 'document.activate':
      return handleDocumentActivate(params)
    case 'declassify.status':
      return handleDeclassifyStatus(params)
    case 'declassify.preview':
      return handleDeclassifyPreview(params)
    case 'declassify.apply':
      return handleDeclassifyApply(params)
    case 'declassify.restore':
      return handleDeclassifyRestore(params)
    case 'kb.retrieve':
      return handleKbRetrieve(params)
    case 'document.open': {
      const filePath = String(params.path || '').trim()
      if (!filePath) {
        const err = new Error('path required')
        err.code = 'INVALID_PARAMS'
        throw err
      }
      const activate = params.activate !== false
      const app = window.Application
      if (pathMatchesDoc(app?.ActiveDocument, filePath)) {
        const reveal = revealOpenedDocument(activate)
        return {
          ok: true,
          opened: false,
          alreadyOpen: true,
          path: filePath,
          document: getActiveDocumentInfo(),
          ...reveal
        }
      }
      await openLocalDocument(filePath)
      const info = getActiveDocumentInfo()
      if (!pathMatchesDoc(app?.ActiveDocument, filePath)) {
        const err = new Error(`Opened document does not match path: ${filePath}`)
        err.code = 'DOCUMENT_OPEN_MISMATCH'
        err.details = { path: filePath, document: info }
        throw err
      }
      const reveal = revealOpenedDocument(activate)
      return { ok: true, opened: true, path: filePath, document: info, ...reveal }
    }
    case 'document.ensure_open': {
      const filePath = String(params.path || '').trim()
      if (!filePath) {
        const err = new Error('path required')
        err.code = 'INVALID_PARAMS'
        throw err
      }
      const activate = params.activate !== false
      const app = window.Application
      // Avoid Documents.Item enumeration — can block the Agent poll loop forever.
      if (pathMatchesDoc(app?.ActiveDocument, filePath)) {
        const reveal = revealOpenedDocument(activate)
        return {
          open: true,
          alreadyOpen: true,
          path: filePath,
          document: getActiveDocumentInfo(),
          ...reveal
        }
      }
      // Open alone often leaves WPS behind other windows — always reveal after.
      await openLocalDocument(filePath)
      const info = getActiveDocumentInfo()
      const matched = pathMatchesDoc(app?.ActiveDocument, filePath)
      if (!matched) {
        const err = new Error(`Could not ensure open for path: ${filePath}`)
        err.code = 'DOCUMENT_OPEN_MISMATCH'
        err.details = { path: filePath, document: info }
        throw err
      }
      const reveal = revealOpenedDocument(activate)
      return {
        open: true,
        opened: true,
        path: filePath,
        document: info,
        ...reveal
      }
    }
    case 'document.add_comment':
      return handleDocumentAddComment(params)
    case 'comment.list':
      return handleCommentList(params)
    case 'comment.delete':
      return handleCommentDelete(params)
    case 'format.run':
      return handleFormatRun(params)
    case 'format.para':
      return handleFormatPara(params)
    case 'format.apply_ops':
      return handleFormatApplyOps(params)
    case 'system.fonts_list':
      return handleSystemFontsList(params)
    case 'style.list':
      return handleStyleList(params)
    case 'style.apply':
      return handleStyleApply(params)
    case 'nav.location':
      return handleNavLocation(params)
    case 'break.insert':
      return handleBreakInsert(params)
    case 'page.blank_insert':
      return handlePageBlankInsert(params)
    case 'revision.mode':
      return handleRevisionMode(params)
    case 'revision.list':
      return handleRevisionList(params)
    case 'revision.apply':
      return handleRevisionApply(params)
    case 'nav.pane_set':
      return handleNavPaneSet(params)
    case 'layout.page':
      return handleLayoutPage(params)
    case 'layout.columns':
      return handleLayoutColumns(params)
    case 'toc.insert':
      return handleTocInsert(params)
    case 'toc.update':
      return handleTocUpdate(params)
    case 'nav.outline':
      return handleNavOutline(params)
    case 'bookmark.list':
      return handleBookmarkList(params)
    case 'bookmark.goto':
      return handleBookmarkGoto(params)
    case 'table.insert':
      return handleTableInsert(params)
    case 'table.list':
      return handleTableList(params)
    case 'table.header_read':
      return handleTableHeaderRead(params)
    case 'table.row_read':
      return handleTableRowRead(params)
    case 'table.column_read':
      return handleTableColumnRead(params)
    case 'table.cell_read':
      return handleTableCellRead(params)
    case 'table.header_repeat':
      return handleTableHeaderRepeat(params)
    case 'table.column_set_width':
      return handleTableColumnSetWidth(params)
    case 'table.export':
      return handleTableExport(params)
    case 'table.row_insert':
      return handleTableRowInsert(params)
    case 'table.column_insert':
      return handleTableColumnInsert(params)
    case 'table.cell_merge':
      return handleTableCellMerge(params)
    case 'caption.list':
      return handleCaptionList(params)
    case 'field.list':
      return handleFieldList(params)
    case 'field.add':
      return handleFieldAdd(params)
    case 'image.list':
      return handleImageList(params)
    case 'image.insert':
      return handleImageInsert(params)
    case 'image.delete':
      return handleImageDelete(params)
    case 'image.export':
      return handleImageExport(params)
    case 'hyperlink.list':
      return handleHyperlinkList(params)
    case 'hyperlink.add':
      return handleHyperlinkAdd(params)
    case 'hyperlink.delete':
      return handleHyperlinkDelete(params)
    case 'headerfooter.get':
      return handleHeaderFooterGet(params)
    case 'headerfooter.set':
      return handleHeaderFooterSet(params)
    case 'watermark.set':
      return handleWatermarkSet(params)
    case 'watermark.clear':
      return handleWatermarkClear(params)
    case 'document.export':
      return handleDocumentExport(params)
    case 'style.audit':
      return handleStyleAudit(params)
    case 'proofread.run':
      return handleProofreadRun(params)
    case 'proofread.apply_comments':
      return handleApplyComments(params)
    case 'proofread.job_poll': {
      const taskId = String(params.jobId || params.taskId || '')
      const task = getTaskById(taskId)
      if (!task) {
        return { jobId: taskId, status: 'not_found' }
      }
      return {
        jobId: taskId,
        status: task.status,
        progress: task.progress,
        current: task.current,
        total: task.total,
        ...collectIssuesFromTask(taskId)
      }
    }
    case 'assistants.list_domains':
      return handleAssistantsListDomains(params)
    case 'assistants.search':
      return handleAssistantsSearch(params)
    case 'assistants.get':
      return handleAssistantsGet(params)
    default: {
      const err = new Error(`Unknown method: ${method}`)
      err.code = 'METHOD_NOT_FOUND'
      throw err
    }
  }
}

export default { dispatchMcpJob }
