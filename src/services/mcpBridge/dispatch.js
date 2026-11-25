/**
 * Unified MCP Agent dispatcher — handles jobs from sidecar long-poll.
 */
import { withDocumentWriteLock } from '../documentWriteLock.js'
import { registerStoredAssistantKbBindingGetter } from '../../utils/assistant/kbAssistantBinding.js'

// 本 dispatcher 在 ribbon 基座 webview 常驻（agentClient 于 OnAddinLoad 引入），
// kb.retrieve 等 KB 工具 job 都在此执行：必须在此注册存储版 KB 绑定 getter。
// 只在 chatTurnRunner 注册不够——面板本地编排的回合不经过基座 chat.turn，
// 其工具调用仍派回本 webview，那时 chatTurnRunner 根本没加载过
registerStoredAssistantKbBindingGetter()
import {
  startSpellCheckAllTask,
  startSpellCheckSelectionTask,
  applySpellCheckIssueComment,
  applySkippedSpellCheckComments
} from '../../utils/spellCheckService.js'
import { getTaskById, updateTask } from '../../utils/taskListStore.js'
import { gateCapability } from './licenseGate.js'
import { MCP_PROTOCOL_VERSION, getAddonVersion } from './config.js'
import { handleFileParse, handleFileConvert } from './fileParseDispatch.js'
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
  handleSecurityEncryptSave,
  handleSecurityDecryptSave,
  handleKbRetrieve
} from './documentOpsDispatch.js'
import {
  handleCommentList,
  handleCommentDelete,
  handleFormatRead,
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
import { logEvent } from '../../utils/globalErrorLogger.js'
import { detectAddonType, hostLabel } from '../../utils/host/hostType.js'
import { handleSpreadsheetAction, SPREADSHEET_WRITE_ACTIONS } from './spreadsheetDispatch.js'
import { handleFootnoteAction } from './footnoteDispatch.js'
import { handlePresentationAction, PRESENTATION_WRITE_ACTIONS } from './presentationDispatch.js'
import { runVarsProbe } from './varsProbe.js'
import { describeDocumentIdentity } from '../../utils/documentIdentity.js'
import { getHostActiveObjectId } from './hostDispatch.js'
import { resolveBoundDocument } from '../../utils/chat/docTarget.js'
import { runTemplateGenerationTask } from '../../utils/templateGenerationTask.js'

// 聊天回合托管（AI助手对话跟随文档）：懒加载——只有 ribbon 基座真正接到 chat.*
// job 时才拉取模块（连带 orchestrator/agent-core 的 chunk），其它 webview 零开销
let _chatTurnRunnerMod = null
function loadChatTurnRunner() {
  if (!_chatTurnRunnerMod) _chatTurnRunnerMod = import('./chatTurnRunner.js')
  return _chatTurnRunnerMod
}

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
    const ui = getUiVisibility()
    const host = detectAddonType()
    // 宿主感知：按当前宿主读取活动对象（window.Application 即宿主根对象）
    const probe = (get, fields) => {
      try {
        const obj = get()
        if (!obj) return null
        const out = { open: true }
        for (const [key, get2] of Object.entries(fields)) {
          out[key] = get2(obj)
        }
        return out
      } catch (e) {
        return { open: false, error: e?.message || String(e) }
      }
    }
    const identity = (o) => String(o.FullName || o.Name || '')
    const info =
      host === 'et'
        ? probe(() => app?.ActiveWorkbook, { name: (o) => String(o.Name || ''), fullName: identity, saved: (o) => !!o.Saved, sheetCount: (o) => Number(o.Worksheets?.Count || 0), activeSheet: (o) => String(o.ActiveSheet?.Name || '') })
        : host === 'wpp'
          ? probe(() => app?.ActivePresentation, { name: (o) => String(o.Name || ''), fullName: identity, saved: (o) => !!o.Saved, slideCount: (o) => Number(o.Slides?.Count || 0) })
          : probe(() => app?.ActiveDocument, { name: (o) => String(o.Name || ''), fullName: identity, saved: (o) => !!o.Saved })
    if (!info) return { open: false, ui, addonType: host }
    return { ...info, ui, addonType: host }
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

/**
 * 在全部打开文档里按路径找已开的窗口对象（Windows 集合优先，Documents 兜底）。
 * 【SIGBUS 雷点护栏，2026-11-21 真机】Documents.Open 对一个已打开（哪怕非活动）的
 * 云缓存文档二次打开会带崩整个 WPS 主进程（ksojscore→jswpsapi，CrBrowserMain）——
 * document.open/ensure_open 必须先走本探测，命中即 Activate 既有窗口，绝不重 Open。
 */
function findOpenedWindowByPath(filePath) {
  const app = window.Application
  if (!app) return null
  const tryDoc = (doc) => {
    if (!pathMatchesDoc(doc, filePath)) return null
    try { return doc?.ActiveWindow || doc?.Window || null } catch (_) { return null }
  }
  // Writer：Windows.Item(i).Document 直取（顺带拿到窗口对象，Activate 精准）
  try {
    const windows = app.Windows
    const n = Number(windows?.Count || 0)
    for (let i = 1; i <= n; i++) {
      let w = null
      let doc = null
      try { w = windows.Item(i); doc = w?.Document } catch (_) { continue }
      if (pathMatchesDoc(doc, filePath)) return { window: w, doc }
    }
  } catch (_) { /* ignore */ }
  // 兜底：Documents 集合逐项比对（窗口对象从文档的 ActiveWindow 回取）
  try {
    const docs = app.Documents
    const n = Number(docs?.Count || 0)
    for (let i = 1; i <= n; i++) {
      let doc = null
      try { doc = docs.Item(i) } catch (_) { continue }
      if (pathMatchesDoc(doc, filePath)) {
        let w = null
        try { w = doc?.ActiveWindow || null } catch (_) { w = null }
        return { window: w, doc }
      }
    }
  } catch (_) { /* ignore */ }
  return null
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
 * 会写当前文档（或切换活动文档）的 MCP 方法：必须持文档写锁串行执行。
 * 纯读方法（get_text/chunks/locate/list 类）不拿锁，多会话并行互不阻塞。
 */
const DOC_WRITE_METHODS = new Set([
  'document.replace',
  'document.insert',
  'document.apply_ops',
  'document.new',
  'document.save',
  'document.activate',
  'document.open',
  'document.ensure_open',
  'document.add_comment',
  'comment.delete',
  'format.run',
  'format.para',
  'format.apply_ops',
  'style.apply',
  'break.insert',
  'page.blank_insert',
  'revision.mode',
  'revision.apply',
  'layout.columns',
  'toc.insert',
  'toc.update',
  'table.insert',
  'table.header_repeat',
  'table.column_set_width',
  'table.row_insert',
  'table.column_insert',
  'table.cell_merge',
  'field.add',
  'image.insert',
  'image.delete',
  'hyperlink.add',
  'hyperlink.delete',
  'headerfooter.set',
  'watermark.set',
  'watermark.clear',
  'declassify.apply',
  'declassify.restore',
  'document.security_encrypt_save',
  'document.security_decrypt_save',
  'proofread.apply_comments',
  // 脚注/尾注（footnote 聚合域，2026-11-25 收割对接）：写动作走文档写锁串行
  'footnote.add',
  'footnote.delete'
])

/**
 * 写方法判定：Writer 白名单 + 表格/演示 action 集合（前缀路由）。
 */
function isWriteMethod(method) {
  if (DOC_WRITE_METHODS.has(method)) return true
  if (method.startsWith('spreadsheet.')) {
    return SPREADSHEET_WRITE_ACTIONS.has(method.slice('spreadsheet.'.length))
  }
  if (method.startsWith('presentation.')) {
    return PRESENTATION_WRITE_ACTIONS.has(method.slice('presentation.'.length))
  }
  return false
}

/**
 * @param {{ method: string, params?: any }} job
 */
// Re-entrancy guard: prevents concurrent dispatchMcpJob calls from interleaving
// synchronous WPS API calls on the main thread, which can corrupt the ksojscore
// JIT code cache and cause EXC_BAD_ACCESS crashes.
let _isDispatching = false
const _dispatchQueue = []

// 派发看门狗预算（毫秒）：必须 ≥ sidecar 对该 method 的 callAgent 超时（看门狗是
// 队列解堵的兜底，不是和 sidecar 抢跑）。看门狗到点：放弃等待永不 settle 的
// handler（其 promise 悬空，若日后 settle 为幂等空转），向 sidecar 回
// AGENT_HANDLER_TIMEOUT 错误结果，队列立即放行——单次挂死不再永久堵死整个
// webview 派发队列（真机事故：挂死的 pdf 解析把队列堵死数小时，所有后续 job
// 超时、agent 反复被踢又回锅，直到人工重启 sidecar）。
const JOB_WATCHDOG_MS = {
  'template.generate': 960_000,
  'proofread.run': 660_000,
  'proofread.apply_comments': 330_000,
  'file.parse': 330_000,
  'file.convert': 210_000,
  'chat.turn': 90_000,
  // agentClient/sidecar 对这两个 method 的预算都是 300s——落进默认 210s 会被
  // 看门狗抢跑：合法慢任务被误报超时、handler 悬空继续写文档、写锁还被强放
  'declassify.apply': 330_000,
  'declassify.restore': 330_000
}
const JOB_WATCHDOG_DEFAULT_MS = 210_000

// 运行日志序号：job_start/job_end 按 id 配对；崩溃后日志里无 end 的最大 id = 崩溃时执行中的 job
let _jobLogSeq = 0

/** handler promise 与看门狗竞速；看门狗先到则 reject（handler 悬空继续） */
function raceWatchdog(handlerPromise, ms, method) {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(Object.assign(
        new Error(`Agent handler watchdog: ${method} 超过 ${Math.round(ms / 1000)}s 未完成，已放弃等待并放行队列`),
        { code: 'AGENT_HANDLER_TIMEOUT' }
      ))
    }, ms)
    Promise.resolve(handlerPromise).then(
      (v) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

export async function dispatchMcpJob(job = {}) {
  if (_isDispatching) {
    return new Promise((resolve, reject) => {
      _dispatchQueue.push({ job, resolve, reject })
    })
  }

  _isDispatching = true
  const method = String(job.method || '')
  const reqId = ++_jobLogSeq
  const startedAt = Date.now()
  const isWrite = isWriteMethod(method)
  logEvent('job_start', { reqId, method, write: isWrite })
  const jobEndLog = (outcome, extra = {}) => {
    logEvent('job_end', {
      reqId,
      method,
      outcome,
      ms: Date.now() - startedAt,
      ...extra
    })
  }
  // handler 全程封装为独立 promise：看门狗到点时外层先返回（finally 放行队列），
  // handler 悬空继续——它若日后 settle，结果被丢弃，不再影响任何人
  let lockHandle = null
  const handler = (async () => {
    const params = { ...(job.params || {}) }
    // __baselineToken 为页面回合的 OCC 基线保留字段（agentCoreSkill 注入）：
    // 写锁按回合隔离校验基线，此字段不得进入真实 WPS 调用参数。
    // 缺失（direct 快速轨/programmatic 直写，2026-11-21 真机）→ baselineToken=null
    // 显式跳过 OCC 指纹校验——跨 webview 基线不可达（面板刷的基线在另一个引擎
    // 实例里，dispatch 校验必然误报 DOCUMENT_MODIFIED）；文档身份校验（__expectedDocId）
    // 与写锁串行仍生效，防误写防线不降级。
    const hasBaselineToken = !!String(params.__baselineToken || '').trim()
    const baselineToken = hasBaselineToken ? String(params.__baselineToken) : null
    delete params.__baselineToken
    const expectDocId = params.__expectedDocId
    delete params.__expectedDocId
    const docLinkIdPin = String(params.__docLinkId || '').trim()
    delete params.__docLinkId
    if (docLinkIdPin || expectDocId) {
      // Model S 绑定解析（plans/Model S 共识定稿 Q1/Q4；S2 探针实证集合解析可用）：
      // 绑定文档「在打开集合里可解析」即放行——非活动允许（写入走对象模型静默路径，
      // 焦点零打扰），只有解析不到（文档已关）才失败 DOC_NOT_OPEN（孤儿会话执行侧形态，
      // 上层据此给重开/改绑出路）。docLinkId 优先（随另存/改名/拷贝走），docId 兜底。
      // 旧「活动对象比对」语义废弃：切走文档不再误杀回合（2026-11-21 写回失败根因链）。
      let resolved
      try {
        resolved = resolveBoundDocument({ docLinkId: docLinkIdPin, docId: expectDocId || '' })
      } catch (resolverError) {
        // 门层容错（2026-11-21 const 全灭教训）：解析器自身抛错（bug 类）≠ 绑定可解析
        // ——按 DOC_NOT_OPEN 拒绝并带出真实错误，绝不静默回落活动文档（误写风险）
        throw Object.assign(
          new Error(`绑定解析失败：${String(resolverError?.message || resolverError).slice(0, 120)}`),
          { code: 'DOC_NOT_OPEN', docPath: expectDocId || '' }
        )
      }
      if (!resolved.ok) {
        throw Object.assign(new Error(resolved.message), { code: 'DOC_NOT_OPEN', docPath: expectDocId || '' })
      }
      // 解析结果留给 handler 层 requireDoc 二次解析取新鲜 COM 代理
      params.__boundDocKey = resolved.key
      params.__boundDocLinkId = docLinkIdPin || resolved.docLinkId || ''
    }
    if (isWrite) {
      // 多会话并行的写互斥：拿不到锁自动 FIFO 排队，轮到时校验活动文档身份与
      // 本回合（baselineToken）的 OCC 基线——其它回合开新基线不会洗白本校验
      // occAdvisory（2026-11-21 真机多轮实证）：MCP 派发写的 baselineToken 来自其它
      // webview 实例（面板/执行侧），基线表 per-webview 内存态不可达 → 指纹校验
      // 误报率 100%。降级为放行：防误写由 __expectedDocId 身份校验 + originalText
      // 文本匹配 + 写锁 FIFO 三道硬防线承担（occAdvisory 语义见 documentWriteLock）。
      const lock = withDocumentWriteLock(
        // baselineToken 显式传透（null 含）——spread 条件会把它展开成缺省，写锁里
        // String(null||'') 退回匿名槽拿陈旧基线硬校验（2026-11-21 真机误报根因）
        { label: method, occAdvisory: true, baselineToken, ...(expectDocId !== undefined ? { expectDocId } : {}) },
        () => dispatchMcpJobInner(method, params)
      )
      lockHandle = lock
      return lock.promise
    }
    return dispatchMcpJobInner(method, params)
  })()
  const watchdogMs = JOB_WATCHDOG_MS[method] || JOB_WATCHDOG_DEFAULT_MS
  try {
    const v = await raceWatchdog(handler, watchdogMs, method)
    jobEndLog('ok')
    return v
  } catch (e) {
    if (e?.code === 'AGENT_HANDLER_TIMEOUT') {
      // 挂死的若是写 job，连带强制放锁并跳过其链节——否则后续所有写操作在
      // 锁的 FIFO 链上二次排队。按本 job 的 lockId 匹配：挂死的若只是排队者
      // （持锁者是同 method 的健康 job），严格匹配保证不误杀健康持锁者
      if (isWrite) {
        try {
          const { forceReleaseLock } = await import('../documentWriteLock.js')
          forceReleaseLock(lockHandle?.id)
        } catch (_) { /* 锁模块异常不影响放行 */ }
      }
      jobEndLog('watchdog-timeout', { code: e.code, watchdogMs })
    } else {
      jobEndLog('error', { code: e?.code || '', message: String(e?.message || '').slice(0, 200) })
    }
    throw e
  } finally {
    _isDispatching = false
    const next = _dispatchQueue.shift()
    if (next) {
      Promise.resolve().then(() => dispatchMcpJob(next.job).then(next.resolve, next.reject))
    }
  }
}

async function dispatchMcpJobInner(method, params) {
  // 聊天回合托管（AI助手对话跟随文档）：ack 模式——handleChatTurn 立即返回，
  // 回合循环 detached 执行（跨文档切换存活）；绝不能 await 编排器，否则再入
  // 守卫会把后续内部工具 job 全部堵死在 _dispatchQueue
  if (method === 'chat.turn' || method === 'chat.turn_cancel') {
    const mod = await loadChatTurnRunner()
    return method === 'chat.turn'
      ? mod.handleChatTurn(params)
      : mod.cancelChatTurn(params)
  }
  // 表格/演示宿主工具：前缀路由（agentHub 已按宿主投递，这里双保险再按 action 分发）
  // 安全加密（跨宿主）：必须放在 spreadsheet./presentation. 前缀分支之前，
  // 否则会被前缀路由截获进 requireHost 的域处理器。agentHub 已按前缀把
  // spreadsheet.*/presentation.* 投给对应宿主，document.* 投给文字宿主；
  // 三者共用宿主感知的保存核心（ActiveDocument/Workbook/Presentation 择一存在者）
  if (method === 'spreadsheet.security_encrypt_save' || method === 'presentation.security_encrypt_save' || method === 'document.security_encrypt_save') {
    return handleSecurityEncryptSave(params)
  }
  if (method === 'spreadsheet.security_decrypt_save' || method === 'presentation.security_decrypt_save' || method === 'document.security_decrypt_save') {
    return handleSecurityDecryptSave(params)
  }
  if (method.startsWith('spreadsheet.')) {
    return handleSpreadsheetAction(method.slice('spreadsheet.'.length), params)
  }
  if (method.startsWith('presentation.')) {
    return handlePresentationAction(method.slice('presentation.'.length), params)
  }
  // 脚注/尾注（Writer 宿主专属；agentHub 默认前缀路由到 wps 宿主）
  if (method.startsWith('footnote.')) {
    return handleFootnoteAction(method.slice('footnote.'.length), params)
  }
  switch (method) {
    case 'wps.status':
      return {
        protocolVersion: MCP_PROTOCOL_VERSION,
        addonVersion: getAddonVersion(),
        agentOnline: true,
        document: getActiveDocumentInfo(),
        addonType: detectAddonType(),
        // 排查探针（定位后移除）：面板作用域同步心跳 + 本 webview 宿主对象探测
        scopeDebug: (() => {
          try {
            const raw = window.Application?.PluginStorage?.getItem('ai_chat_scope_debug')
            return raw ? JSON.parse(raw) : null
          } catch (_) { return null }
        })(),
        eventHealth: (() => {
          try {
            const raw = window.Application?.PluginStorage?.getItem('ai_event_health')
            return raw ? JSON.parse(raw) : null
          } catch (_) { return null }
        })(),
        probe: (() => {
          const app = window.Application
          const out = {}
          try { out.activeDocument = app?.ActiveDocument ? !!app.ActiveDocument : false } catch (_) { out.activeDocument = 'throw' }
          try { out.activeWorkbook = app?.ActiveWorkbook ? !!app.ActiveWorkbook : false } catch (_) { out.activeWorkbook = 'throw' }
          try { out.activePresentation = app?.ActivePresentation ? !!app.ActivePresentation : false } catch (_) { out.activePresentation = 'throw' }
          return out
        })()
      }
    case 'document.get_text':
      return handleDocumentGetTextGuarded(params)
    case 'document.meta':
      return handleDocumentMeta(params)
    // T1 三维探针（临时排查：Writer Variables 对照组），结论回填后移除
    case 'document.vars_probe':
      return runVarsProbe('wps', params)
    // 文档身份载体诊断/补写（I2 测试通道，Writer 组）
    case 'document.identity_probe': {
      const doc = (() => { try { return window.Application?.ActiveDocument || null } catch (_) { return null } })()
      return { host: 'wps', ...describeDocumentIdentity(doc, { ensure: params.ensure === true }) }
    }
    case 'document.list_paragraphs':
      return handleDocumentListParagraphs(params)
    case 'document.chunks':
      return handleDocumentChunks(params)
    // 文件级解析（file_parse 工具）：宿主无关，任意在线 webview 可执行；
    // sidecar 已完成路径归一/别名解析/fs 探测，这里只做提取与预算装配
    case 'file.parse':
      return handleFileParse(params)
    // L3 旧版格式转换：sidecar 按扩展名定向派发（doc→wps / et 系→et / ppt 系→wpp）
    case 'file.convert':
      return handleFileConvert(params)
    case 'document.locate':
      return handleDocumentLocate(params)
    case 'document.replace':
      return handleDocumentReplace(params)
    case 'document.insert':
      return handleDocumentInsert(params)
    case 'document.apply_ops':
      return handleDocumentApplyOps(params)
    // 模板生成管线（2026-10-15）：宿主无关（文件级执行），任意在线 webview 可跑。
    // 长任务（LLM 计划+QC 1-3 分钟），经 agentHub 长轮询异步派发。
    case 'template.generate':
      return runTemplateGenerationTask({
        templatePath: String(params.templatePath || '').trim(),
        requirement: String(params.requirement || '').trim(),
        referenceContext: String(params.referenceContext || '').trim(),
        pageTarget: Number(params.pageTarget) || 0,
        toneFollow: params.toneFollow !== false,
        qcRounds: Number(params.qcRounds) || undefined,
        planOnly: params.planOnly === true || String(params.planOnly) === 'true'
      })
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
      // SIGBUS 护栏（2026-11-21 真机）：已开但非活动的文档绝不二次 Open——
      // 激活既有窗口返回（Documents.Open 对已开云文档二次打开 = 主进程崩溃）
      const openedWindow = findOpenedWindowByPath(filePath)
      if (openedWindow) {
        try { openedWindow.window?.Activate?.() } catch (_) { /* 激活失败不致命 */ }
        const reveal = revealOpenedDocument(activate)
        return {
          ok: true,
          opened: false,
          alreadyOpen: true,
          reactivated: true,
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
      // SIGBUS 护栏（同 document.open）：已开非活动 → 激活既有窗口，绝不二次 Open
      const ensureOpenedWindow = findOpenedWindowByPath(filePath)
      if (ensureOpenedWindow) {
        try { ensureOpenedWindow.window?.Activate?.() } catch (_) { /* 激活失败不致命 */ }
        const reveal = revealOpenedDocument(activate)
        return {
          open: true,
          alreadyOpen: true,
          reactivated: true,
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
    case 'format.read':
      return handleFormatRead(params)
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
