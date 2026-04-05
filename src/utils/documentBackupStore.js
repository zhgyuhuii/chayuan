import { ensureDir, getEffectiveDataDir, pathJoin, pathSep } from './dataPathSettings.js'
import { getActiveDocument, getApplication } from './documentActions.js'
import { getCurrentDocumentSavePath, saveActiveDocument } from './documentFileActions.js'
import { copyFile } from './documentTemplates.js'

const STORAGE_KEY = 'NdDocumentBackups'
const STORAGE_VERSION = 1
const ARCHIVE_LIMIT = 120

function normalizePath(path) {
  return String(path || '')
    .replace(/^file:\/\/\/?/i, '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .trim()
}

function getFileNameWithoutExtension(fileName = '') {
  const normalized = String(fileName || '').trim()
  const lastDot = normalized.lastIndexOf('.')
  if (lastDot <= 0) return normalized || 'document'
  return normalized.slice(0, lastDot)
}

function getFileExtension(fileName = '', fallback = 'docx') {
  const normalized = String(fileName || '').trim()
  const lastDot = normalized.lastIndexOf('.')
  if (lastDot <= 0) return String(fallback || 'docx').replace(/^\.+/, '')
  return normalized.slice(lastDot + 1).replace(/^\.+/, '') || String(fallback || 'docx').replace(/^\.+/, '')
}

function getDocumentDir(sourcePath = '') {
  const normalized = normalizePath(sourcePath)
  if (!normalized) return ''
  const parts = normalized.split('/')
  parts.pop()
  if (parts.length === 0) return ''
  const dir = parts.join('/')
  if (/^[A-Za-z]:$/.test(dir)) return `${dir}/`
  return dir
}

function parseStoredState(raw) {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.records)) return parsed.records
  } catch (error) {
    console.warn('documentBackupStore parseStoredState:', error)
  }
  return []
}

function loadStoredRecords() {
  try {
    const localRaw = localStorage?.getItem(STORAGE_KEY)
    const localRecords = parseStoredState(localRaw)
    if (localRecords.length > 0) return localRecords
  } catch (error) {
    console.warn('documentBackupStore load localStorage:', error)
  }
  try {
    const pluginRaw = getApplication()?.PluginStorage?.getItem(STORAGE_KEY)
    const pluginRecords = parseStoredState(pluginRaw)
    if (pluginRecords.length > 0) return pluginRecords
  } catch (error) {
    console.warn('documentBackupStore load PluginStorage:', error)
  }
  return []
}

function saveStoredRecords(records = []) {
  const payload = JSON.stringify({
    version: STORAGE_VERSION,
    records: (Array.isArray(records) ? records : []).slice(0, ARCHIVE_LIMIT),
    updatedAt: new Date().toISOString()
  })
  try {
    localStorage?.setItem(STORAGE_KEY, payload)
  } catch (error) {
    console.warn('documentBackupStore save localStorage:', error)
  }
  try {
    getApplication()?.PluginStorage?.setItem(STORAGE_KEY, payload)
  } catch (error) {
    console.warn('documentBackupStore save PluginStorage:', error)
  }
}

function getBackupRootDir(sourcePath = '') {
  const fs = getApplication()?.FileSystem
  if (!fs) return ''
  const configuredDir = getEffectiveDataDir()
  const sourceDir = getDocumentDir(sourcePath)
  const root = configuredDir
    ? pathJoin(configuredDir, '_document_backups')
    : sourceDir
      ? pathJoin(sourceDir, '.chayuan_backups')
      : ''
  if (!root) return ''
  ensureDir(fs, root)
  return pathSep() === '\\' ? root.replace(/\//g, '\\') : root.replace(/\\/g, '/')
}

function buildBackupFilePath(sourcePath = '', doc = null) {
  const rootDir = getBackupRootDir(sourcePath)
  if (!rootDir) return ''
  const docName = String(doc?.Name || sourcePath.split('/').pop() || '文档').trim() || '文档'
  const baseName = getFileNameWithoutExtension(docName).replace(/[<>:"|?*]/g, '_') || '文档'
  const extension = getFileExtension(docName, 'docx')
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return pathJoin(rootDir, `${baseName}_backup_${timestamp}_${Math.random().toString(36).slice(2, 7)}.${extension}`)
}

export function canCreateDocumentBackup(doc = getActiveDocument()) {
  const fs = getApplication()?.FileSystem
  if (!fs) return false
  return !!normalizePath(getCurrentDocumentSavePath(doc))
}

export function getDocumentBackupRecords() {
  return loadStoredRecords()
}

export function getDocumentBackupRecordById(id) {
  const normalizedId = String(id || '').trim()
  if (!normalizedId) return null
  return loadStoredRecords().find(item => String(item?.id || '').trim() === normalizedId) || null
}

export function createDocumentBackupRecord(options = {}) {
  const doc = options.doc || getActiveDocument()
  if (!doc) {
    throw new Error('当前没有打开文档，无法备份')
  }
  const sourcePath = normalizePath(getCurrentDocumentSavePath(doc))
  if (!sourcePath) {
    throw new Error('当前文档尚未保存，暂不支持备份源文件')
  }
  const backupPath = buildBackupFilePath(sourcePath, doc)
  if (!backupPath) {
    throw new Error('未找到可用备份目录，无法备份源文件')
  }

  // 先落盘当前文档状态，再复制到备份目录，避免备份内容落后于用户当前看到的正文。
  saveActiveDocument()
  if (!copyFile(sourcePath, backupPath)) {
    throw new Error('复制源文件到备份目录失败')
  }

  const record = {
    id: `doc_backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    sourcePath,
    backupPath: normalizePath(backupPath),
    documentName: String(doc?.Name || '').trim() || sourcePath.split('/').pop() || '文档',
    taskId: String(options.taskId || '').trim(),
    assistantId: String(options.assistantId || '').trim(),
    reason: String(options.reason || '').trim() || 'document-processing-preview-apply',
    launchSource: String(options.launchSource || '').trim(),
    metadata: options.metadata && typeof options.metadata === 'object' ? options.metadata : {}
  }
  const records = loadStoredRecords()
  saveStoredRecords([record, ...records.filter(item => item?.id !== record.id)])
  return record
}

function reopenDocumentFromPath(path = '') {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath) return false
  const app = getApplication()
  if (!app?.Documents) return false
  try {
    if (typeof app.Documents.OpenFromUrl === 'function') {
      app.Documents.OpenFromUrl(normalizedPath)
      return true
    }
  } catch (_) {
    // continue to other open methods
  }
  try {
    if (typeof app.Documents.Open === 'function') {
      app.Documents.Open(normalizedPath)
      return true
    }
  } catch (_) {
    return false
  }
  return false
}

export function restoreDocumentBackupRecordById(id, options = {}) {
  const record = getDocumentBackupRecordById(id)
  if (!record) {
    throw new Error('未找到可恢复的文档备份记录')
  }
  const sourcePath = normalizePath(record.sourcePath)
  const backupPath = normalizePath(record.backupPath)
  if (!sourcePath || !backupPath) {
    throw new Error('备份记录缺少源文件或备份文件路径')
  }
  const activeDoc = options.doc || getActiveDocument()
  const activePath = normalizePath(getCurrentDocumentSavePath(activeDoc))
  const needReopen = !!activeDoc && activePath && activePath === sourcePath
  if (needReopen && typeof activeDoc.Close === 'function') {
    try {
      activeDoc.Close(getApplication()?.Enum?.wdDoNotSaveChanges ?? false)
    } catch (_) {
      try {
        activeDoc.Close(false)
      } catch (_) {
        // continue and still try to overwrite source file
      }
    }
  }
  if (!copyFile(backupPath, sourcePath)) {
    throw new Error('从备份恢复源文件失败')
  }
  const reopened = needReopen ? reopenDocumentFromPath(sourcePath) : false
  return {
    ok: true,
    backupId: record.id,
    sourcePath,
    backupPath,
    reopened,
    message: reopened
      ? '已从备份恢复文档，并重新打开原文件。'
      : '已从备份恢复文档。'
  }
}
