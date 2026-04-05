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
  if (typeof doc.Save === 'function') {
    doc.Save()
  } else if (typeof doc.SaveAs2 === 'function') {
    doc.SaveAs2(currentPath, getDocumentFormat(doc))
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
