import { getActiveDocument, getApplication } from './documentActions.js'

function normalizePath(path) {
  return String(path || '').replace(/^file:\/\/\/?/i, '').replace(/\\/g, '/').trim()
}

function getDocumentDefaultFileName(doc, fallbackExtension = 'docx') {
  let docName = String(doc?.Name || '文档').trim() || '文档'
  const lastDot = docName.lastIndexOf('.')
  if (lastDot > 0) {
    docName = docName.slice(0, lastDot)
  }
  return `${docName}.${String(fallbackExtension || 'docx').replace(/^\.+/, '')}`
}

function getDocumentFormat(doc) {
  const app = getApplication()
  const extension = String(doc?.Name || '').split('.').pop().toLowerCase()
  if (extension === 'doc') return app?.Enum?.wdFormatDocument ?? 0
  return app?.Enum?.wdFormatXMLDocument ?? 12
}

function ensureSavePath(path, doc, fallbackExtension = 'docx') {
  const normalized = normalizePath(path)
  if (!normalized) return ''
  if (/\.[a-z0-9]+$/i.test(normalized)) return normalized
  return `${normalized}.${String(fallbackExtension || 'docx').replace(/^\.+/, '')}`
}

export function getCurrentDocumentSavePath(doc = getActiveDocument()) {
  const dir = normalizePath(doc?.Path || '')
  const name = String(doc?.Name || '').trim()
  if (!dir || !name) return ''
  return `${dir}/${name}`.replace(/\/+/g, '/')
}

export function openDocumentSaveAsDialog(options = {}) {
  const app = getApplication()
  const doc = options.doc || getActiveDocument()
  if (!app || !doc) return ''
  const defaultFileName = getDocumentDefaultFileName(doc, options.extension || 'docx')
  const fileFilter = options.fileFilter || 'Word文档 (*.docx), *.docx'
  try {
    if (typeof app.GetSaveAsFileName === 'function') {
      const path = app.GetSaveAsFileName(defaultFileName, fileFilter, 1, options.title || '另存文档', '保存')
      return ensureSavePath(path, doc, options.extension || 'docx')
    }
  } catch (_) {
    // continue to FileDialog fallback
  }
  try {
    const fileDialog = app.FileDialog(2)
    fileDialog.Title = options.title || '另存文档'
    fileDialog.InitialFileName = defaultFileName
    try {
      fileDialog.Filters.Clear()
      fileDialog.Filters.Add('Word 文档', '*.docx', 1)
      fileDialog.FilterIndex = 1
    } catch (_) {
      // ignore filter failures in restricted hosts
    }
    if (fileDialog.Show() === -1) {
      return ensureSavePath(fileDialog.SelectedItems.Item(1), doc, options.extension || 'docx')
    }
  } catch (_) {
    return ''
  }
  return ''
}

export function saveActiveDocument() {
  const doc = getActiveDocument()
  if (!doc) throw new Error('当前没有打开文档')
  const currentPath = getCurrentDocumentSavePath(doc)
  if (!currentPath) {
    throw new Error('当前文档尚未保存，请先提供保存路径或使用另存为')
  }
  // Save() 经 jsaddons 桥执行会崩 WPS(2026-09-17 真机实验A:调用即崩,与
  // Documents.Add 同族的 ksojscore 崩溃)。改用 SaveAs2 原地另存达成保存语义;
  // Save 仅作无 SaveAs2 环境的兜底。
  if (typeof doc.SaveAs2 === 'function') {
    doc.SaveAs2(currentPath, getDocumentFormat(doc))
  } else if (typeof doc.Save === 'function') {
    doc.Save()
  } else {
    throw new Error('当前环境不支持保存文档')
  }
  return {
    path: currentPath,
    fileName: currentPath.split('/').pop() || '文档'
  }
}

export function saveActiveDocumentAs(path) {
  const doc = getActiveDocument()
  if (!doc) throw new Error('当前没有打开文档')
  const finalPath = ensureSavePath(path, doc, 'docx')
  if (!finalPath) throw new Error('请提供有效的保存路径')
  if (typeof doc.SaveAs2 !== 'function') {
    throw new Error('当前环境不支持另存文档')
  }
  doc.SaveAs2(finalPath, getDocumentFormat(doc))
  return {
    path: finalPath,
    fileName: finalPath.split('/').pop() || '文档'
  }
}

export function saveActiveDocumentWithPassword(password, path = '') {
  const doc = getActiveDocument()
  if (!doc) throw new Error('当前没有打开文档')
  const finalPassword = String(password || '').trim()
  if (!finalPassword) throw new Error('请提供文档密码')
  const currentPath = getCurrentDocumentSavePath(doc)
  const finalPath = ensureSavePath(path || currentPath, doc, 'docx')
  if (!finalPath) {
    throw new Error('当前文档尚未保存，请先提供保存路径')
  }
  if (typeof doc.SaveAs2 !== 'function') {
    throw new Error('当前环境不支持密码保存文档')
  }
  doc.SaveAs2(finalPath, getDocumentFormat(doc), false, finalPassword)
  return {
    path: finalPath,
    fileName: finalPath.split('/').pop() || '文档'
  }
}

export function saveActiveDocumentWithoutPassword(path = '') {
  const doc = getActiveDocument()
  if (!doc) throw new Error('当前没有打开文档')
  const currentPath = getCurrentDocumentSavePath(doc)
  const finalPath = ensureSavePath(path || currentPath, doc, 'docx')
  if (!finalPath) {
    throw new Error('当前文档尚未保存，请先提供保存路径')
  }
  if (typeof doc.SaveAs2 !== 'function') {
    throw new Error('当前环境不支持移除文档密码后保存')
  }
  doc.SaveAs2(finalPath, getDocumentFormat(doc), false, '')
  return {
    path: finalPath,
    fileName: finalPath.split('/').pop() || '文档'
  }
}

/**
 * 宿主感知的活动对象：文字=ActiveDocument、表格=ActiveWorkbook、演示=ActivePresentation。
 * 安全加密能力按此对象跨三宿主复用（SaveAs2 第 4 参=打开密码）。
 */
export function getActiveSaveObject() {
  const app = getApplication()
  return app?.ActiveDocument || app?.ActiveWorkbook || app?.ActivePresentation || null
}

function getDefaultSaveFormat(obj) {
  const name = String(obj?.Name || '')
  const ext = name.split('.').pop().toLowerCase()
  // 格式常量按 MS 兼容枚举（WPS ET/WPP 沿用）：51=xlsx 50=xlsb 62=csv 24=pptx；doc/docx 走 Writer 枚举
  if (ext === 'doc' || ext === 'docx') return getDocumentFormat(obj)
  if (ext === 'xls' || ext === 'et') return 44
  if (ext === 'xlsb') return 50
  if (ext === 'csv') return 62
  if (ext === 'ppt') return 16
  return 51
}

function getObjectSavePath(obj, path = '') {
  const dir = normalizePath(obj?.Path || '')
  const name = String(obj?.Name || '').trim()
  const fallbackExt = name.includes('.') ? name.split('.').pop() : ''
  if (path && normalizePath(path)) {
    return ensureSavePath(normalizePath(path), obj, fallbackExt)
  }
  if (!dir || !name) return ''
  return `${dir}/${name}`.replace(/\/+/g, '/')
}

/**
 * 按宿主可用的 API 尝试带密码另存：
 * - Writer: SaveAs2(路径, 格式, LockComments, 密码)
 * - ET:     SaveAs(路径, 格式, 密码, 写保留密码, …)（Workbook 无 SaveAs2）
 * - WPP:    SaveAs2 优先，退回 SaveAs / SaveCopyAs
 * 返回实际使用的 API 名，便于真机验证桩记录。
 */
function saveObjectWithPasswordByHost(obj, finalPath, fmt, pwd) {
  if (typeof obj.SaveAs2 === 'function') {
    obj.SaveAs2(finalPath, fmt, false, pwd)
    return 'SaveAs2'
  }
  if (typeof obj.SaveAs === 'function') {
    obj.SaveAs(finalPath, fmt, pwd)
    return 'SaveAs'
  }
  if (typeof obj.SaveCopyAs === 'function') {
    obj.SaveCopyAs(finalPath, fmt, pwd)
    return 'SaveCopyAs'
  }
  throw new Error('当前环境不支持密码保存')
}

function saveObjectWithoutPasswordByHost(obj, finalPath, fmt, strategy = 0) {
  // ET 空串密码语义与 Writer 不同：验证桩用 strategy 选定单一策略，
  // 外部读回验证哪种真正移除打开密码；strategy=0 按优先级顺序尝试
  const attempts = []
  if (typeof obj.SaveAs2 === 'function') attempts.push(() => { obj.SaveAs2(finalPath, fmt, false, ''); return 'SaveAs2-empty' })
  if (typeof obj.SaveAs === 'function') {
    attempts.push(() => { obj.SaveAs(finalPath, fmt, ''); return 'SaveAs-empty' })
    attempts.push(() => { obj.SaveAs(finalPath, fmt); return 'SaveAs-nopwd' })
  }
  if (typeof obj.SaveCopyAs === 'function') attempts.push(() => { obj.SaveCopyAs(finalPath, fmt, ''); return 'SaveCopyAs-empty' })
  if (strategy > 0 && strategy <= attempts.length) return attempts[strategy - 1]()
  let lastErr = null
  for (const attempt of attempts) {
    try { return attempt() } catch (e) { lastErr = e }
  }
  throw lastErr || new Error('当前环境不支持移除密码保存')
}

/** 跨宿主：为活动对象（文档/工作簿/演示稿）设置打开密码并另存 */
export function saveActiveObjectWithPassword(password, path = '') {
  const obj = getActiveSaveObject()
  if (!obj) throw new Error('当前没有可加密的文档/工作簿/演示稿')
  const finalPassword = String(password || '').trim()
  if (!finalPassword) throw new Error('请提供密码')
  const currentPath = getCurrentDocumentSavePath(obj)
  const finalPath = getObjectSavePath(obj, path || currentPath)
  if (!finalPath) throw new Error('当前对象尚未保存，请先提供保存路径')
  const api = saveObjectWithPasswordByHost(obj, finalPath, getDefaultSaveFormat(obj), finalPassword)
  return { path: finalPath, fileName: String(finalPath).split('/').pop() || '文件', api }
}

/** 跨宿主：移除活动对象的打开密码并另存 */
export function saveActiveObjectWithoutPassword(path = '', strategy = 0) {
  const obj = getActiveSaveObject()
  if (!obj) throw new Error('当前没有可解密的文档/工作簿/演示稿')
  const currentPath = getCurrentDocumentSavePath(obj)
  const finalPath = getObjectSavePath(obj, path || currentPath)
  if (!finalPath) throw new Error('当前对象尚未保存，请先提供保存路径')
  const api = saveObjectWithoutPasswordByHost(obj, finalPath, getDefaultSaveFormat(obj), strategy)
  return { path: finalPath, fileName: String(finalPath).split('/').pop() || '文件', api }
}
