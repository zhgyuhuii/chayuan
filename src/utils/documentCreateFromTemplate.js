/**
 * 从模板新建文档 —— 三宿主统一管线（方案 v2.2 唯一新核心模块）。
 *
 * 红线：绝不调用 Documents.Add()/Workbooks.Add()/Presentations.Add()（真机实证
 * 经加载项调用崩 WPS，见 commit 3ed811d）。一切新建 = 复制模板副本 → Open 打开
 * → 写「新建未保存」标记（保存时强制另存）→ 绑定会话身份。
 *
 * 双通路打开：jsapi Open 失败时退 OS 级打开（Windows 走 WScript.Shell，等同用户
 * 双击；Mac 沙盒无法 spawn，返回 OS_OPEN_NEEDED 由调用方提示用户手动打开）。
 *
 * 新建标记载体沿用 documentIdentity.js 真机实证的三宿主写法：
 * Writer=Variables / WPP=Tags / ET=Names（RefersTo 必须字面量公式 '="1"'）。
 */

import { detectAddonType, HOST_LABELS } from './host/hostType.js'
import { normalizeTemplateKind, copyTemplateToTempForNew, resolveTemplateSource } from './documentTemplates.js'
import { ensureDocumentChatLinkId } from './documentIdentity.js'

const NEW_FILE_MARKER_KEY = 'NdNewFile'
const ACTIVE_POLL_INTERVAL_MS = 150
const ACTIVE_POLL_MAX_TRIES = 20

/** 宿主 → 模板 kind 映射（同宿主约束的根基） */
export const HOST_KIND = { wps: 'doc', et: 'sheet', wpp: 'slide' }

export function detectHostKind() {
  return HOST_KIND[detectAddonType()] || 'doc'
}

/**
 * 同宿主闸门：模板 kind 与当前宿主不一致时拒绝，给出切换宿主指引。
 * @returns {{ok:boolean, error?:string, hostKind?:string}}
 */
export function assertSameHostKind(kind) {
  const hostKind = detectHostKind()
  if (String(kind || '') !== hostKind) {
    return {
      ok: false,
      hostKind,
      error: `该模板是${kind === 'doc' ? ' Word' : kind === 'sheet' ? ' Excel' : ' PPT'}模板，请在 WPS ${HOST_LABELS[hostKind] || '文字'}中继续使用对应类型的模板`
    }
  }
  return { ok: true, hostKind }
}

// ── 新建标记（三宿主通用载体，写法照抄 documentIdentity.js 真机实证结论） ──

function markerWriteVariables(obj, value) {
  if (!obj?.Variables) return false
  try {
    obj.Variables.Add(NEW_FILE_MARKER_KEY, value)
    return true
  } catch (_) {
    try {
      const existing = obj.Variables.Item(NEW_FILE_MARKER_KEY)
      if (existing) {
        existing.Value = value
        return true
      }
    } catch (__) { /* 无既存项 */ }
    return false
  }
}

function markerWriteTags(obj, value) {
  if (!obj?.Tags) return false
  try {
    obj.Tags.Add(NEW_FILE_MARKER_KEY, value)
    return true
  } catch (_) {
    return false
  }
}

function markerWriteNames(obj, value) {
  if (!obj?.Names) return false
  try {
    // RefersTo 必须字符串字面量公式形式，裸字符串会毒化工作簿（真机实证）
    obj.Names.Add(NEW_FILE_MARKER_KEY, `="${value}"`)
    return true
  } catch (_) {
    return false
  }
}

const MARKER_WRITERS = [markerWriteVariables, markerWriteTags, markerWriteNames]
const MARKER_REMOVERS = [
  (obj) => { try { obj?.Variables?.Item(NEW_FILE_MARKER_KEY)?.Delete(); return true } catch (_) { return false } },
  (obj) => { try { obj?.Tags?.Delete(NEW_FILE_MARKER_KEY); return true } catch (_) { return false } },
  (obj) => { try { obj?.Names?.Item(NEW_FILE_MARKER_KEY)?.Delete(); return true } catch (_) { return false } }
]

function markerReadVariables(obj) {
  try { return String(obj?.Variables?.Item(NEW_FILE_MARKER_KEY)?.Value || '') === '1' } catch (_) { return false }
}
function markerReadTags(obj) {
  try {
    const got = obj?.Tags?.Item(NEW_FILE_MARKER_KEY)
    if (typeof got === 'string') return got === '1'
  } catch (_) { /* fallthrough */ }
  try {
    const n = Number(obj?.Tags?.Count || 0)
    for (let i = 1; i <= n; i++) {
      if (String(obj.Tags.Name(i)).toUpperCase() === NEW_FILE_MARKER_KEY.toUpperCase()) {
        return String(obj.Tags.Value(i)) === '1'
      }
    }
  } catch (_) { /* fallthrough */ }
  return false
}
function markerReadNames(obj) {
  try {
    const raw = obj?.Names?.Item(NEW_FILE_MARKER_KEY)?.Value || obj?.Names?.Item(NEW_FILE_MARKER_KEY)?.RefersTo
    return String(raw || '').replace(/^=/, '').replace(/"/g, '') === '1'
  } catch (_) { return false }
}
const MARKER_READERS = [markerReadVariables, markerReadTags, markerReadNames]

/** 标记活动对象为「从模板新建的未保存文件」（保存时由 ribbon OnDocumentBeforeSave 强制另存） */
export function setNewFileMarkerAny(obj, isNew = true) {
  if (!obj) return false
  if (!isNew) return clearNewFileMarkerAny(obj)
  for (const write of MARKER_WRITERS) {
    try {
      if (write(obj, '1')) {
        // 写后即读校验
        if (MARKER_READERS.some(read => { try { return read(obj) } catch (_) { return false } })) return true
      }
    } catch (_) { /* 试下一个载体 */ }
  }
  return false
}

export function clearNewFileMarkerAny(obj) {
  if (!obj) return false
  let cleared = false
  for (const remove of MARKER_REMOVERS) {
    try { if (remove(obj)) cleared = true } catch (_) { /* 逐载体清 */ }
  }
  return cleared
}

export function isNewFileAny(obj) {
  if (!obj) return false
  for (const read of MARKER_READERS) {
    try { if (read(obj)) return true } catch (_) { /* 试下一个载体 */ }
  }
  return false
}

// ── 打开通路 ──

function toFileUrl(localPath) {
  let path = String(localPath || '').replace(/\\/g, '/')
  if (path.match(/^[A-Za-z]:/)) path = '/' + path
  if (!path.startsWith('/')) path = '/' + path
  return 'file://' + encodeURI(path)
}

/** 按宿主取活动对象 */
export function getActiveObjectByKind(kind) {
  const app = window.Application
  if (!app) return null
  const resolved = normalizeTemplateKind(kind)
  try {
    if (resolved === 'sheet') return app.ActiveWorkbook || null
    if (resolved === 'slide') return app.ActivePresentation || null
    return app.ActiveDocument || null
  } catch (_) {
    return null
  }
}

/**
 * 已打开守卫（2026-10-15 真机崩溃教训）：jsapi Open 一个已在 WPS 打开的同路径文档
 * 会触发 ksojscore EXC_BAD_ACCESS 崩溃（SIGBUS，崩溃报告 122137.ips 实证）。
 * 命中已打开 → 直接激活该文档并返回，绝不重复 Open。
 */
function findOpenDocumentByPath(path, kind) {
  const app = window.Application
  const resolved = normalizeTemplateKind(kind)
  const target = String(path || '').replace(/\\/g, '/').toLowerCase()
  try {
    if (resolved === 'sheet') {
      const n = Number(app.Workbooks.Count || 0)
      for (let i = 1; i <= n; i++) {
        const wb = app.Workbooks.Item(i)
        if (String(wb.FullName || '').replace(/\\/g, '/').toLowerCase() === target) return wb
      }
    } else if (resolved === 'slide') {
      const n = Number(app.Presentations.Count || 0)
      for (let i = 1; i <= n; i++) {
        const pr = app.Presentations.Item(i)
        if (String(pr.FullName || '').replace(/\\/g, '/').toLowerCase() === target) return pr
      }
    } else {
      const n = Number(app.Documents.Count || 0)
      for (let i = 1; i <= n; i++) {
        const dc = app.Documents.Item(i)
        if (String(dc.FullName || '').replace(/\\/g, '/').toLowerCase() === target) return dc
      }
    }
  } catch (_) { /* 枚举失败按未打开处理 */ }
  return null
}

function openWithJsapi(path, kind) {
  // 已打开守卫：命中即激活返回（调用方据非空对象跳过 Open）
  const already = findOpenDocumentByPath(path, kind)
  if (already) return already
  const app = window.Application
  const resolved = normalizeTemplateKind(kind)
  if (resolved === 'sheet') {
    if (typeof app.Workbooks?.Open !== 'function') throw new Error('当前环境不支持 Workbooks.Open')
    return app.Workbooks.Open(path) || null
  }
  if (resolved === 'slide') {
    if (typeof app.Presentations?.Open !== 'function') throw new Error('当前环境不支持 Presentations.Open')
    return app.Presentations.Open(path) || null
  }
  if (typeof app.Documents?.Open === 'function') {
    // 既有通路：Open(fileName, ConfirmConversions, ReadOnly, AddToRecentFiles)
    const doc = app.Documents.Open(path, false, false, true)
    if (doc) return doc
  }
  if (typeof app.Documents?.OpenFromUrl === 'function') {
    app.Documents.OpenFromUrl(toFileUrl(path))
    return null // OpenFromUrl 异步，交由轮询取活动文档
  }
  throw new Error('当前环境不支持打开文档')
}

/** OS 级打开兜底：Windows 走 WScript.Shell；Mac/Linux 沙盒无法 spawn，请求 sidecar 代开 */
async function openWithOs(path) {
  if (typeof ActiveXObject !== 'undefined') {
    try {
      // eslint-disable-next-line no-undef
      const shell = new ActiveXObject('WScript.Shell')
      shell.Run('"' + String(path).replace(/\//g, '\\') + '"', 1, false)
      return { ok: true, viaOs: true }
    } catch (e) {
      console.warn('openWithOs WScript.Shell 失败:', e)
    }
  }
  // sidecar 通路（Mac 沙盒唯一可行的自动打开方式；token 门禁与 /agent/* 同级）
  try {
    const { MCP_BASE_URL } = await import('../services/mcpBridge/config.js')
    const token = window.Application?.PluginStorage?.getItem('chayuan_mcp_token') ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('chayuan_mcp_token') : '')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(MCP_BASE_URL + '/open-local-file', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { 'x-chayuan-token': token } : {}) },
      body: JSON.stringify({ path }),
      signal: controller.signal
    }).finally(() => clearTimeout(timer))
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok) return { ok: true, viaOs: true }
    console.warn('sidecar open-local-file 失败:', data?.error || res.status)
  } catch (e) {
    console.warn('sidecar open-local-file 不可达:', e?.message || e)
  }
  return { ok: false, code: 'OS_OPEN_NEEDED', path }
}

async function waitForActiveObject(kind, startedAt = Date.now()) {
  for (let i = 0; i < ACTIVE_POLL_MAX_TRIES; i++) {
    const obj = getActiveObjectByKind(kind)
    if (obj) return obj
    await new Promise(resolve => setTimeout(resolve, ACTIVE_POLL_INTERVAL_MS))
    if (Date.now() - startedAt > ACTIVE_POLL_INTERVAL_MS * ACTIVE_POLL_MAX_TRIES) break
  }
  return getActiveObjectByKind(kind)
}

/**
 * 从模板创建新文档（唯一入口）。
 * @param {{templateId?:string, templateRef?:string, templatePath?:string, blank?:boolean|string, kind?:string}} source
 * @returns {Promise<{ok:boolean, path?:string, name?:string, kind?:string, viaOs?:boolean, obj?:object, error?:string, code?:string}>}
 */
export async function createFromTemplate(source = {}) {
  const resolved = resolveTemplateSource(source)
  if (!resolved.ok) return resolved

  const kind = normalizeTemplateKind(source.kind || resolved.kind, resolved.path)
  const gate = assertSameHostKind(kind)
  if (!gate.ok) return { ok: false, code: 'HOST_KIND_MISMATCH', error: gate.error, kind }

  // 1. 复制到临时目录（失败不污染任何用户位置）
  const copy = copyTemplateToTempForNew(resolved.path, kind)
  if (!copy.ok) return { ok: false, error: copy.error, kind }

  // 2. jsapi 打开 → 失败退 OS 级打开
  // 打开前活动对象快照：异步打开（OpenFromUrl）失败时会轮询到「前一个」文档，
  // 若活动对象未变化则绝不能标记（否则会把用户现有文档误标为新建未保存）
  const beforeObj = getActiveObjectByKind(kind)
  // 副本路径已被打开（重复运行场景）→ 直接激活复用，绝不二次 Open（ksojscore 崩溃防线）
  const alreadyOpen = findOpenDocumentByPath(copy.path, kind)
  if (alreadyOpen) {
    try { ensureDocumentChatLinkId(alreadyOpen) } catch (_) { /* 非阻塞 */ }
    return { ok: true, path: copy.path, name: resolved.name, kind, viaOs: false, reused: true, obj: alreadyOpen }
  }
  let viaOs = false
  let obj = null
  try {
    obj = openWithJsapi(copy.path, kind)
  } catch (e) {
    console.warn('jsapi 打开失败，尝试 OS 级打开:', e?.message || e)
    const osResult = await openWithOs(copy.path)
    if (!osResult.ok) {
      return { ok: false, code: osResult.code, path: osResult.path, kind, error: '无法自动打开文档，请手动双击打开该文件后继续：' + copy.path }
    }
    viaOs = true
  }

  // 3. 等待活动对象并补标记 + 会话身份
  const active = obj || await waitForActiveObject(kind)
  let marked = false
  if (active && (obj || active !== beforeObj)) {
    marked = setNewFileMarkerAny(active, true)
    try { ensureDocumentChatLinkId(active) } catch (_) { /* 身份非阻塞 */ }
  } else {
    console.warn('打开后未捕获到新的活动对象，跳过新建标记（避免误标既有文档）')
  }

  return { ok: true, path: copy.path, name: resolved.name, kind, viaOs, marked, obj: active }
}

/**
 * 交付：把当前活动文档另存到最终路径并清除新建标记（SaveAs2 通路，不做文件移动——
 * 打开中的文件有写锁）。成功后文档留在最终路径继续可编辑。
 * @param {{savePath:string}} options
 * @returns {{ok:boolean, path?:string, fileName?:string, error?:string}}
 */
export function deliverActiveDocument(options = {}) {
  const savePath = String(options.savePath || '').trim()
  if (!savePath) return { ok: false, error: '缺少保存路径' }

  const app = window.Application
  const obj = app?.ActiveDocument || app?.ActiveWorkbook || app?.ActivePresentation
  if (!obj) return { ok: false, error: '当前没有活动文档' }

  // 格式常量按扩展名映射（docx=12 / xlsx=51 / pptx=24 系，与 documentFileActions 同源规则）
  let format
  try {
    const ext = (savePath.split('.').pop() || '').toLowerCase()
    const byExt = { docx: 12, doc: 0, xlsx: 51, et: 44, pptx: 24, ppsx: 25 }
    format = byExt[ext]
  } catch (_) { format = undefined }

  const trySave = (fn) => { try { return fn() } catch (e) { console.warn('deliverActiveDocument 保存形态失败:', e?.message || e); return false } }

  let saved = false
  if (format !== undefined) saved = trySave(() => !!obj.SaveAs2(savePath, format))
  if (!saved) saved = trySave(() => !!obj.SaveAs2(savePath))
  if (!saved) saved = trySave(() => !!obj.SaveAs(savePath))
  if (!saved) return { ok: false, error: '另存失败：所有保存形态均被拒绝（路径不可写或格式不支持）' }

  clearNewFileMarkerAny(obj)
  const fileName = String(savePath).split(/[/\\]/).pop()
  return { ok: true, path: savePath, fileName }
}
