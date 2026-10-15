/**
 * 文档模板管理 - 导入的 .aidocx 模板存储与读取
 * 若设置了数据路径：模板文件复制到 dataPath/model/，清单保存到 dataPath/chayuan_document_templates.json
 * 否则使用 PluginStorage 存储清单，模板路径为用户选择的原路径
 */

import { getEffectiveDataDir, getModelDir, joinDataPath, ensureDir, pathJoin } from './dataPathSettings.js'
import { BLANK_ASSETS } from './blankAssets.js'

const STORAGE_KEY = 'chayuan_document_templates'
const LEGACY_STORAGE_KEY = 'niudang_document_templates'
const FILE_NAME = 'chayuan_document_templates.json'
const LEGACY_FILE_NAME = 'niudang_document_templates.json'
const isWin = typeof ActiveXObject !== 'undefined'

/** 模板种类：doc=文字 / sheet=表格 / slide=演示（三宿主同宿主使用的根基字段） */
export const TEMPLATE_KINDS = ['doc', 'sheet', 'slide']

const KIND_EXTENSIONS = {
  doc: ['.aidocx', '.docx', '.doc', '.dotx'],
  sheet: ['.xlsx', '.xls', '.et', '.csv', '.ett'],
  slide: ['.pptx', '.ppt', '.dps', '.potx']
}

/** 按扩展名推断模板 kind；无法识别返回 null */
export function kindFromFileExtension(path) {
  const lower = String(path || '').toLowerCase().trim()
  for (const [kind, exts] of Object.entries(KIND_EXTENSIONS)) {
    if (exts.some(ext => lower.endsWith(ext))) return kind
  }
  return null
}

/** 归一化 kind：显式 kind 优先，其次扩展名推断，最后默认 doc（兼容旧 .aidocx 数据） */
export function normalizeTemplateKind(kind, path) {
  const raw = String(kind || '').toLowerCase().trim()
  if (TEMPLATE_KINDS.includes(raw)) return raw
  return kindFromFileExtension(path) || 'doc'
}

/** kind 对应的「新建副本」落盘扩展名（.aidocx 复制为 .docx 便于 WPS 识别） */
export function targetExtensionForKind(kind) {
  return { doc: '.docx', sheet: '.xlsx', slide: '.pptx' }[normalizeTemplateKind(kind)] || '.docx'
}

/** 文档变量名：标记为从模板新建的未保存文件，保存时需弹出另存为 */
export const NEW_FILE_VAR_NAME = 'NdNewFile'

/** 设置/清除新文件标记 */
export function setNewFileMarker(doc, isNew) {
  if (!doc?.Variables) return
  try {
    if (isNew) {
      try {
        const v = doc.Variables.Item(NEW_FILE_VAR_NAME)
        if (v) v.Value = '1'
      } catch (e) {
        doc.Variables.Add(NEW_FILE_VAR_NAME, '1')
      }
    } else {
      try {
        const v = doc.Variables.Item(NEW_FILE_VAR_NAME)
        if (v) v.Delete()
      } catch (_) { /* 标记不存在即视为已清除 */ }
    }
  } catch (e) {
    console.warn('setNewFileMarker:', e)
  }
}

/** 检查文档是否为新文件（未保存过） */
export function isNewFile(doc) {
  if (!doc?.Variables) return false
  try {
    const v = doc.Variables.Item(NEW_FILE_VAR_NAME)
    return v && String(v.Value || '') === '1'
  } catch (_) { /* 无标记载体 */ }
  return false
}

function loadFromFile() {
  try {
    const fs = window.Application?.FileSystem
    if (!fs?.readFileString && !fs?.ReadFile) return null
    const tryRead = (name) => {
      const path = joinDataPath(name)
      if (!path) return null
      const raw = fs.readFileString ? fs.readFileString(path) : fs.ReadFile(path)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
    const fromNew = tryRead(FILE_NAME)
    if (fromNew !== null) return fromNew
    return tryRead(LEGACY_FILE_NAME)
  } catch (e) {
    return null
  }
}

function saveToFile(list) {
  try {
    const path = joinDataPath(FILE_NAME)
    if (!path) return false
    const fs = window.Application?.FileSystem
    if (!fs?.writeFileString && !fs?.WriteFile) return false
    const dir = getEffectiveDataDir()
    ensureDir(fs, dir)
    const json = JSON.stringify(list)
    return !!(fs.writeFileString ? fs.writeFileString(path, json) : fs.WriteFile(path, json))
  } catch (e) {
    return false
  }
}

function getStorage() {
  try {
    if (getEffectiveDataDir()) {
      const fromFile = loadFromFile()
      if (fromFile !== null) return fromFile
    }
    const app = window.Application
    if (!app?.PluginStorage) return []
    let raw = app.PluginStorage.getItem(STORAGE_KEY)
    if (!raw) raw = app.PluginStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.warn('读取文档模板清单失败:', e)
    return []
  }
}

function setStorage(list) {
  try {
    if (getEffectiveDataDir()) {
      if (saveToFile(list)) {
        try {
          window.Application?.PluginStorage?.setItem(STORAGE_KEY, JSON.stringify(list))
        } catch (_) { /* 文件通道已成功，镜像失败不阻塞 */ }
        return true
      }
    }
    const app = window.Application
    if (!app?.PluginStorage) return false
    app.PluginStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    return true
  } catch (e) {
    console.warn('保存文档模板清单失败:', e)
    return false
  }
}

/**
 * 获取文档模板清单（读时归一化 kind，旧数据无 kind 按扩展名/默认 doc 迁移）
 * @returns {Array<{id:string, path:string, name:string, addedAt:string, kind:string}>}
 */
export function loadDocumentTemplates() {
  const list = getStorage()
  return (Array.isArray(list) ? list : []).map(t => ({
    ...t,
    kind: normalizeTemplateKind(t?.kind, t?.path)
  }))
}

/**
 * 按显示名/路径模糊解析模板（聊天引用「用我那个合同模板」时用）
 * 命中顺序：精确名 > 名包含 > 路径包含；kind 不匹配的条目不参与
 */
export function findTemplateByRef(reference, { kind = null } = {}) {
  const ref = String(reference || '').trim()
  if (!ref) return null
  const candidates = loadDocumentTemplates().filter(t => !kind || t.kind === kind)
  const lower = ref.toLowerCase()
  return candidates.find(t => (t.name || '').toLowerCase() === lower)
    || candidates.find(t => (t.name || '').toLowerCase().includes(lower))
    || candidates.find(t => String(t.path || '').toLowerCase().includes(lower))
    || null
}

/**
 * 复制文件到目标路径（支持二进制如 .aidocx）
 */
export function copyFile(src, dest) {
  try {
    const fs = window.Application?.FileSystem
    if (!fs) {
      console.error('copyFile: FileSystem 不可用')
      return false
    }

    const toNative = (p) => (isWin ? String(p).replace(/\//g, '\\') : String(p).replace(/\\/g, '/'))
    const srcPath = toNative(src)
    const destPath = toNative(dest)

    console.log('copyFile: 尝试复制', { srcPath, destPath })

    if (typeof fs.copyFileSync === 'function') {
      try {
        const ok = fs.copyFileSync(srcPath, destPath)
        if (ok) {
          console.log('copyFile: copyFileSync 成功')
          return true
        }
      } catch (e) {
        console.warn('copyFile: copyFileSync 失败:', e?.message || e)
      }
    }
    if (typeof fs.readAsBinaryString === 'function' && typeof fs.writeAsBinaryString === 'function') {
      try {
        console.log('copyFile: 尝试 readAsBinaryString')
        const bin = fs.readAsBinaryString(srcPath)
        if (bin == null || bin === undefined) {
          console.warn('copyFile: readAsBinaryString 返回空值')
          return false
        }
        const written = fs.writeAsBinaryString(destPath, bin)
        if (written) {
          console.log('copyFile: writeAsBinaryString 成功')
          return true
        }
        console.warn('copyFile: writeAsBinaryString 返回 false')
      } catch (e) {
        console.warn('copyFile: readAsBinaryString/writeAsBinaryString 失败:', e?.message || e)
      }
    }
    if (typeof fs.ReadFileAsArrayBuffer === 'function' && typeof fs.writeAsBinaryString === 'function') {
      try {
        console.log('copyFile: 尝试 ReadFileAsArrayBuffer')
        const arr = fs.ReadFileAsArrayBuffer(srcPath)
        if (!arr) {
          console.warn('copyFile: ReadFileAsArrayBuffer 返回空值')
          return false
        }
        const bytes = new Uint8Array(arr)
        let bin = ''
        const chunk = 8192
        for (let i = 0; i < bytes.length; i += chunk) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)))
        }
        const written = fs.writeAsBinaryString(destPath, bin)
        if (written) {
          console.log('copyFile: ReadFileAsArrayBuffer + writeAsBinaryString 成功')
          return true
        }
        console.warn('copyFile: writeAsBinaryString 返回 false')
      } catch (e) {
        console.warn('copyFile: ReadFileAsArrayBuffer/writeAsBinaryString 失败:', e?.message || e)
      }
    }
    console.error('copyFile: 所有复制方法都失败')
    return false
  } catch (e) {
    console.error('copyFile: 异常:', e)
    return false
  }
}

/**
 * 将 ArrayBuffer 转为 binary string（供 writeAsBinaryString 使用）
 */
function arrayBufferToBinaryString(arr) {
  const bytes = new Uint8Array(arr)
  let bin = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)))
  }
  return bin
}

/**
 * 从 File 对象写入到目标路径（用于设置了数据路径时，避免 FileSystem 读取源路径受限）
 */
function writeFileFromBuffer(fs, destPath, arrayBuffer) {
  if (!fs?.writeAsBinaryString) return false
  const bin = arrayBufferToBinaryString(arrayBuffer)
  return !!fs.writeAsBinaryString(destPath, bin)
}

/**
 * 添加文档模板（从 File 对象，用于数据路径已设置时）
 * @param {File} file - 用户选择的文件对象
 * @param {string} [kind] - 模板种类 doc|sheet|slide，缺省按扩展名推断
 * @returns {Promise<{ok:boolean, id?:string, kind?:string, error?:string}>}
 */
export function addDocumentTemplateFromFile(file, kind = null) {
  return new Promise((resolve) => {
    if (!file || !(file instanceof File)) {
      resolve({ ok: false, error: '文件无效' })
      return
    }
    const resolvedKind = normalizeTemplateKind(kind, file?.name)
    if (!resolvedKind) {
      resolve({ ok: false, error: '不支持的模板格式（仅支持 docx/xlsx/pptx 系）' })
      return
    }
    const modelDir = getModelDir()
    if (!modelDir) {
      resolve({ ok: false, error: '未设置数据路径，请先在设置中配置数据路径' })
      return
    }

    const baseName = (file.name || 'template.aidocx').replace(/[<>:"|?*]/g, '_')
    const id = 'tpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const destName = baseName.replace(/\.aidocx$/i, '') + '_' + id.slice(-6) + '.aidocx'
    const targetPath = pathJoin(modelDir, destName)
    const displayName = (file.name || '未命名模板').replace(/\.aidocx$/i, '')

    const fs = window.Application?.FileSystem
    if (!fs?.writeAsBinaryString) {
      resolve({ ok: false, error: '当前环境不支持文件写入' })
      return
    }

    ensureDir(fs, getEffectiveDataDir())
    ensureDir(fs, modelDir)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const buf = reader.result
        if (!(buf instanceof ArrayBuffer)) {
          resolve({ ok: false, error: '读取文件失败' })
          return
        }
        const destForFs = isWin ? targetPath.replace(/\//g, '\\') : targetPath.replace(/\\/g, '/')
        if (!writeFileFromBuffer(fs, destForFs, buf)) {
          resolve({ ok: false, error: '写入数据目录失败，请检查路径权限' })
          return
        }
        const list = getStorage()
        const item = {
          id,
          path: targetPath,
          name: displayName,
          kind: resolvedKind,
          addedAt: new Date().toISOString()
        }
        list.push(item)
        if (!setStorage(list)) {
          resolve({ ok: false, error: '保存清单失败' })
          return
        }
        resolve({ ok: true, id, kind: resolvedKind })
      } catch (e) {
        resolve({ ok: false, error: e?.message || '添加失败' })
      }
    }
    reader.onerror = () => resolve({ ok: false, error: '读取文件失败' })
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 添加文档模板（从路径，用于未设置数据路径时）
 * @param {string} path - 模板文件完整路径
 * @param {string} [name] - 显示名称，默认从路径提取文件名
 * @param {string} [kind] - 模板种类 doc|sheet|slide，缺省按扩展名推断
 * @returns {{ok:boolean, id?:string, kind?:string, error?:string}}
 */
export function addDocumentTemplate(path, name, kind = null) {
  if (!path || typeof path !== 'string') {
    return { ok: false, error: '路径无效' }
  }
  const normalized = String(path).trim().replace(/^file:\/\//i, '').replace(/\\\\/g, '/')
  if (!normalized) return { ok: false, error: '路径无效' }
  const resolvedKind = normalizeTemplateKind(kind, normalized)
  if (!resolvedKind) {
    return { ok: false, error: '不支持的模板格式（仅支持 docx/xlsx/pptx 系）' }
  }

  const list = getStorage()
  const displayName = (name || '').trim() || normalized.split(/[/\\]/).pop() || '未命名模板'
  const id = 'tpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)

  let destPath = normalized
  const modelDir = getModelDir()
  if (modelDir) {
    const fs = window.Application?.FileSystem
    if (fs) {
      ensureDir(fs, getEffectiveDataDir())
      ensureDir(fs, modelDir)
      const baseName = normalized.split(/[/\\]/).pop() || 'template.aidocx'
      const safeName = baseName.replace(/[<>:"|?*]/g, '_')
      const destName = safeName.replace(/\.aidocx$/i, '') + '_' + id.slice(-6) + '.aidocx'
      const targetPath = pathJoin(modelDir, destName)
      if (copyFile(normalized, targetPath)) {
        destPath = targetPath
      } else {
        destPath = normalized
        console.warn('无法复制到数据目录，将使用原路径')
      }
    }
  }
  if (!modelDir) {
    const exists = list.some(t => (t.path || '').toLowerCase() === normalized.toLowerCase())
    if (exists) return { ok: false, error: '该模板已存在' }
  }

  const item = {
    id,
    path: destPath,
    name: displayName,
    kind: resolvedKind,
    addedAt: new Date().toISOString()
  }
  list.push(item)
  if (!setStorage(list)) return { ok: false, error: '保存失败' }
  return { ok: true, id, kind: resolvedKind }
}

/**
 * 删除文档模板
 * @param {string} id - 模板 id
 * @returns {boolean}
 */
export function removeDocumentTemplate(id) {
  const list = getStorage().filter(t => t.id !== id)
  if (list.length === getStorage().length) return false
  return setStorage(list)
}

/**
 * 从已知路径推导用户主目录
 */
function getUserHomeFromPath(pathStr) {
  if (!pathStr || typeof pathStr !== 'string') return null
  const s = pathStr.replace(/^file:\/\//i, '').replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = s.split('/').filter(Boolean)
  if (isWin && parts.length >= 3) {
    return parts.slice(0, 3).join('\\')
  }
  if (!isWin && parts.length >= 2) {
    return '/' + parts.slice(0, -1).join('/')
  }
  return null
}

/**
 * 获取桌面路径（跨平台：Windows/Mac/Linux）
 * @returns {string|null} 桌面路径，失败返回 null
 */
export function getDesktopPath() {
  try {
    const app = window.Application
    if (!app?.Env) return null

    if (typeof app.Env.GetDesktopPath === 'function') {
      const desktop = String(app.Env.GetDesktopPath() || '')
        .replace(/^file:\/\//i, '')
        .replace(/\\/g, '/')
        .replace(/\/+$/, '')
      if (desktop) {
        console.log('通过 GetDesktopPath 获取桌面路径:', desktop)
        return desktop
      }
    }


    if (typeof app.Env.GetDownloadPath === 'function') {
      const download = String(app.Env.GetDownloadPath() || '')
      const userHome = getUserHomeFromPath(download)
      if (userHome) {
        const desktopPath = pathJoin(userHome, 'Desktop')
        console.log('通过用户主目录推导桌面路径:', desktopPath)
        return desktopPath
      }
    }

    console.warn('无法获取桌面路径')
    return null
  } catch (e) {
    console.warn('getDesktopPath 失败:', e)
    return null
  }
}

/**
 * 复制模板到桌面并返回路径（用于打开）
 * @param {string} templatePath - 模板文件路径
 * @returns {{ok:boolean, path?:string, error?:string}}
 */
export function copyTemplateToDesktop(templatePath) {
  if (!templatePath || typeof templatePath !== 'string') {
    return { ok: false, error: '模板路径无效' }
  }
  try {
    const app = window.Application
    const fs = app?.FileSystem
    if (!fs) return { ok: false, error: 'FileSystem 不可用' }

    const desktopDir = getDesktopPath()
    if (!desktopDir) {
      return { ok: false, error: '无法获取桌面路径，请检查系统环境' }
    }

    const baseName = templatePath.split(/[/\\]/).pop() || 'template'
    const nameWithoutExt = baseName.replace(/\.(aidocx|docx)$/i, '')
    const destFileName = nameWithoutExt + '_' + Date.now() + '.docx'
    const destPath = pathJoin(desktopDir, destFileName)
    const destForFs = isWin ? destPath.replace(/\//g, '\\') : destPath.replace(/\\/g, '/')

    console.log('复制模板到桌面:', { from: templatePath, to: destForFs, desktopDir })

    const srcForFs = isWin ? templatePath.replace(/\//g, '\\') : templatePath.replace(/\\/g, '/')
    const copySuccess = copyFile(srcForFs, destForFs)
    
    if (copySuccess) {
      console.log('模板复制到桌面成功:', destForFs)
      return { ok: true, path: destForFs }
    }
    
    const errorMsg = `复制到桌面失败：无法从 ${templatePath} 复制到 ${destForFs}`
    console.error(errorMsg)
    return { ok: false, error: errorMsg }
  } catch (e) {
    console.error('copyTemplateToDesktop 异常:', e)
    return { ok: false, error: e?.message || '复制失败: ' + String(e) }
  }
}

/**
 * 复制模板到临时文件并返回路径，供新建文档时打开
 * doc 类（.aidocx 本质 docx）复制为 .docx 便于 WPS 识别并避免扩展名导致崩溃；
 * sheet/slide 类保持原生扩展名
 * @param {string} templatePath - 模板文件路径（通常在 dataPath/model/ 下）
 * @param {string} [kind] - 模板种类 doc|sheet|slide，缺省按扩展名推断
 * @returns {{ok:boolean, path?:string, error?:string}}
 */
export function copyTemplateToTempForNew(templatePath, kind = null) {
  if (!templatePath || typeof templatePath !== 'string') {
    return { ok: false, error: '模板路径无效' }
  }
  const resolvedKind = normalizeTemplateKind(kind, templatePath)
  try {
    const app = window.Application
    const fs = app?.FileSystem
    if (!fs) return { ok: false, error: 'FileSystem 不可用' }

    let tempDir = ''
    if (app?.Env?.GetTempPath) {
      const raw = app.Env.GetTempPath()
      tempDir = String(raw || '').replace(/^file:\/\//i, '').replace(/\\/g, '/').replace(/\/+$/, '')
    }
    if (!tempDir && getEffectiveDataDir()) {
      tempDir = pathJoin(getEffectiveDataDir(), '_temp')
      ensureDir(fs, tempDir)
    }
    if (!tempDir) {
      const fallbackDir = isWin ? 'C:\\Temp' : '/tmp'
      tempDir = pathJoin(fallbackDir, 'chayuan_temp')
      try {
        ensureDir(fs, tempDir)
      } catch (e) {
        console.warn('创建备用临时目录失败:', tempDir, e)
      }
    }
    if (!tempDir) return { ok: false, error: '无法获取临时目录' }

    const ext = targetExtensionForKind(resolvedKind)
    const tempFileName = 'chayuan_new_' + Date.now() + ext
    const tempPath = pathJoin(tempDir, tempFileName)
    const tempForFs = isWin ? tempPath.replace(/\//g, '\\') : tempPath.replace(/\\/g, '/')

    if (!ensureDir(fs, tempDir)) {
      console.warn('临时目录创建可能失败:', tempDir)
    }

    const srcForFs = isWin ? templatePath.replace(/\//g, '\\') : templatePath.replace(/\\/g, '/')
    const copySuccess = copyFile(srcForFs, tempForFs)
    if (copySuccess) {
      return { ok: true, path: tempForFs }
    }

    const errorMsg = `复制失败：无法从 ${templatePath} 复制到 ${tempForFs}。请检查：1) 源文件是否存在 2) 是否有读取权限 3) 临时目录是否有写入权限`
    console.error(errorMsg)
    return { ok: false, error: errorMsg }
  } catch (e) {
    console.error('copyTemplateToTempForNew 异常:', e)
    return { ok: false, error: e?.message || '复制失败: ' + String(e) }
  }
}

/**
 * 确保空白模板文件就位并返回路径（不登记进模板库，按需落盘到临时目录）
 * 空白新建 = 从空白模板复制打开，绕开 Documents.Add() 崩溃路径，Mac 亦可用
 * @param {string} kind - doc|sheet|slide
 * @returns {{ok:boolean, path?:string, name?:string, error?:string}}
 */
export function ensureBlankTemplateFile(kind) {
  const resolvedKind = normalizeTemplateKind(kind)
  const b64 = BLANK_ASSETS[resolvedKind]
  if (!b64) return { ok: false, error: `暂无 ${resolvedKind} 类空白模板` }

  try {
    const app = window.Application
    const fs = app?.FileSystem
    if (!fs?.writeAsBinaryString) return { ok: false, error: '当前环境不支持文件写入' }

    let tempDir = ''
    if (getEffectiveDataDir()) {
      tempDir = pathJoin(getEffectiveDataDir(), '_temp')
    } else if (app?.Env?.GetTempPath) {
      tempDir = String(app.Env.GetTempPath() || '').replace(/^file:\/\//i, '').replace(/\\/g, '/').replace(/\/+$/, '')
    }
    if (!tempDir) tempDir = pathJoin(isWin ? 'C:\\Temp' : '/tmp', 'chayuan_temp')
    ensureDir(fs, tempDir)

    const ext = targetExtensionForKind(resolvedKind)
    const blankPath = pathJoin(tempDir, 'chayuan_blank' + ext)
    const blankForFs = isWin ? blankPath.replace(/\//g, '\\') : blankPath.replace(/\\/g, '/')

    // base64 → binary string → 落盘（同 writeFileFromBuffer 通路）
    const raw = atob(b64)
    if (!fs.writeAsBinaryString(blankForFs, raw)) {
      return { ok: false, error: '空白模板落盘失败，请检查数据路径/临时目录写入权限' }
    }
    const def = { doc: '空白文档', sheet: '空白表格', slide: '空白演示' }[resolvedKind]
    return { ok: true, path: blankForFs, name: def }
  } catch (e) {
    console.error('ensureBlankTemplateFile 异常:', e)
    return { ok: false, error: e?.message || '空白模板准备失败' }
  }
}

/** 模板扩展名（含点），目录枚举时过滤候选 */
const TEMPLATE_FILE_RE = /\.(aidocx|docx|doc|dotx|xlsx|xlsm|xls|et|ett|pptx|ppsx|ppt|dps|potx)$/i

/**
 * 目录引用解析：ref 指向真实目录时枚举其中模板文件。
 * 支持口语化引用：「桌面」「模板」「桌面/模板」「模板文件夹」（自动探测 ~/Desktop/<ref> 等位置，
 * 并尝试「模板文件夹」→「模板」别名）。仅命中一个模板文件时直接返回；多个则返回候选列表。
 */
function resolveTemplateDir(dirRef) {
  try {
    const fs = window.Application?.FileSystem
    if (!fs?.readdirSync) return { ok: false, error: 'DIR unsupported' }
    let home = ''
    try {
      home = String(window.Application?.Env?.GetHomePath?.() || '')
        .replace(/^file:\/\//i, '').replace(/\\/g, '/').replace(/\/+$/, '')
    } catch (_) { home = '' }
    const raw = String(dirRef || '').trim().replace(/^file:\/\//i, '').replace(/\\/g, '/')
    const candidates = []
    if (raw.startsWith('/') || /^[A-Za-z]:\//.test(raw)) candidates.push(raw)
    else if (home) candidates.push(`${home}/Desktop/${raw}`, `${home}/Documents/${raw}`, `${home}/${raw}`)
    // 口语别名：模板文件夹 → 模板
    const expanded = []
    for (const c of candidates) {
      expanded.push(c)
      if (/模板文件夹$/.test(c)) expanded.push(c.replace(/模板文件夹$/, '模板'))
    }
    for (const dir of expanded) {
      let names = []
      try { names = fs.readdirSync(isWin ? dir.replace(/\//g, '\\') : dir) || [] } catch (_) { continue }
      const hits = names.filter(n => TEMPLATE_FILE_RE.test(n))
      if (!hits.length) continue
      if (hits.length === 1) {
        const p = `${dir}/${hits[0]}`
        return { ok: true, path: p, name: hits[0].replace(/\.[^.]+$/, ''), kind: normalizeTemplateKind(null, p) }
      }
      return { ok: false, error: `目录「${dir}」下有多个模板：${hits.join('、')}。请指定具体文件名或直接上传附件`, candidates: hits }
    }
    return { ok: false, error: 'DIR not found' }
  } catch (e) {
    return { ok: false, error: e?.message || 'DIR error' }
  }
}

/**
 * 裸文件名查找：在桌面/模板/文档/下载等常见目录中探测同名模板文件
 * （用户说「用 软件设计模式.pptx 生成」这类场景——文件在桌面或模板文件夹里但没给全路径）
 */
function findTemplateFileByBareName(filename) {
  try {
    const fs = window.Application?.FileSystem
    if (!fs?.readdirSync) return null
    let home = ''
    try {
      home = String(window.Application?.Env?.GetHomePath?.() || '')
        .replace(/^file:\/\//i, '').replace(/\\/g, '/').replace(/\/+$/, '')
    } catch (_) { home = '' }
    const dirs = home
      ? [`${home}/Desktop`, `${home}/Desktop/模板`, `${home}/Desktop/模板文件夹`, `${home}/Documents`, `${home}/Downloads`]
      : []
    for (const dir of dirs) {
      let names = []
      try { names = fs.readdirSync(isWin ? dir.replace(/\//g, '\\') : dir) || [] } catch (_) { continue }
      const hit = names.find(n => n.toLowerCase() === String(filename).toLowerCase())
      if (hit) {
        const p = `${dir}/${hit}`
        return { ok: true, path: p, name: hit.replace(/\.[^.]+$/, ''), kind: normalizeTemplateKind(null, p) }
      }
    }
    return null
  } catch (_) {
    return null
  }
}

/**
 * 统一解析模板来源：模板库 id / 库名引用 / 目录或文件路径 / 空白
 * @param {{templateId?:string, templateRef?:string, templatePath?:string, blank?:boolean|string, kind?:string}} source
 * @returns {{ok:boolean, path?:string, name?:string, kind?:string, error?:string, candidates?:string[]}}
 */
export function resolveTemplateSource(source = {}) {
  if (source.blank) {
    const kind = normalizeTemplateKind(typeof source.blank === 'string' ? source.blank : source.kind)
    const blank = ensureBlankTemplateFile(kind)
    if (!blank.ok) return blank
    return { ok: true, path: blank.path, name: blank.name || '空白文档', kind }
  }
  if (source.templateId) {
    const t = loadDocumentTemplates().find(x => x.id === source.templateId)
    if (!t?.path) return { ok: false, error: '模板库中未找到该模板' }
    return { ok: true, path: t.path, name: t.name, kind: t.kind }
  }
  if (source.templateRef) {
    const ref = String(source.templateRef).trim()
    // 1) 库名/模糊匹配
    const t = findTemplateByRef(ref, { kind: source.kind || null })
    if (t) return { ok: true, path: t.path, name: t.name, kind: t.kind }
    // 2) 裸文件名：在桌面/模板等常见目录探测同名文件
    if (TEMPLATE_FILE_RE.test(ref) && !/[\\/]/.test(ref)) {
      const bare = findTemplateFileByBareName(ref)
      if (bare) return bare
    }
    // 3) 目录引用（「桌面/模板」「模板文件夹」这类口语指代）
    if (!TEMPLATE_FILE_RE.test(ref)) {
      const dir = resolveTemplateDir(ref)
      if (dir.ok) return dir
      if (dir.candidates?.length) return dir // 目录存在但多候选：错误信息带候选
    }
    // 4) 完整文件路径
    if (/[\\/]/.test(ref) || /^[A-Za-z]:/.test(ref)) {
      const normalized = ref.replace(/^file:\/\//i, '')
      if (kindFromFileExtension(normalized)) {
        return { ok: true, path: normalized, name: (normalized.split(/[/\\]/).pop() || '模板').replace(/\.[^.]+$/, ''), kind: normalizeTemplateKind(source.kind, normalized) }
      }
      return { ok: false, error: '无法识别的模板格式（支持 docx/xlsx/pptx 系）：' + ref }
    }
    return { ok: false, error: `模板库中未找到「${ref}」。可直接上传模板附件、给出完整路径或文件夹，或先用「存为模板」入库` }
  }
  if (source.templatePath) {
    const normalized = String(source.templatePath).trim().replace(/^file:\/\//i, '')
    const kind = normalizeTemplateKind(source.kind, normalized)
    if (!kindFromFileExtension(normalized)) {
      return { ok: false, error: '无法识别的模板格式（支持 docx/xlsx/pptx 系）' }
    }
    return { ok: true, path: normalized, name: (normalized.split(/[/\\]/).pop() || '模板').replace(/\.[^.]+$/, ''), kind }
  }
  return { ok: false, error: '缺少模板来源（templateId/templateRef/templatePath/blank 任选其一）' }
}

/**
 * 是否应使用文件选择器（数据路径已设置时用 File 对象直接写入，否则用路径）
 */
export function shouldUseFileInputForImport() {
  return !!getModelDir()
}

/**
 * 把聊天附件的 File 对象落盘到临时目录（不登记入库——入库走「用后询问」）
 * @param {File} file - 用户附件
 * @returns {Promise<{ok:boolean, path?:string, name?:string, kind?:string, error?:string}>}
 */
export function materializeAttachmentToTemp(file) {
  return new Promise((resolve) => {
    if (!file || !(file instanceof File)) {
      resolve({ ok: false, error: '附件无效' })
      return
    }
    const kind = normalizeTemplateKind(null, file?.name)
    if (!kindFromFileExtension(file?.name)) {
      resolve({ ok: false, error: '该附件不是可用的模板格式（支持 docx/xlsx/pptx 系）' })
      return
    }
    try {
      const fs = window.Application?.FileSystem
      if (!fs?.writeAsBinaryString) {
        resolve({ ok: false, error: '当前环境不支持文件写入' })
        return
      }
      let tempDir = ''
      if (getEffectiveDataDir()) tempDir = pathJoin(getEffectiveDataDir(), '_temp')
      else if (window.Application?.Env?.GetTempPath) {
        tempDir = String(window.Application.Env.GetTempPath() || '').replace(/^file:\/\//i, '').replace(/\\/g, '/').replace(/\/+$/, '')
      }
      if (!tempDir) tempDir = pathJoin(isWin ? 'C:\\Temp' : '/tmp', 'chayuan_temp')
      ensureDir(fs, tempDir)

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const buf = reader.result
          if (!(buf instanceof ArrayBuffer)) {
            resolve({ ok: false, error: '读取附件失败' })
            return
          }
          const safeName = 'chayuan_attach_' + Date.now() + '_' + String(file.name || 'template').replace(/[<>:"|?*\\/]/g, '_')
          const target = pathJoin(tempDir, safeName)
          const targetForFs = isWin ? target.replace(/\//g, '\\') : target.replace(/\\/g, '/')
          if (!writeFileFromBuffer(fs, targetForFs, buf)) {
            resolve({ ok: false, error: '附件落盘失败，请检查数据路径/临时目录写入权限' })
            return
          }
          resolve({ ok: true, path: targetForFs, name: String(file.name || '').replace(/\.[^.]+$/, ''), kind })
        } catch (e) {
          resolve({ ok: false, error: e?.message || '附件处理失败' })
        }
      }
      reader.onerror = () => resolve({ ok: false, error: '读取附件失败' })
      reader.readAsArrayBuffer(file)
    } catch (e) {
      resolve({ ok: false, error: e?.message || '附件处理失败' })
    }
  })
}

function detectAddonTypeSafe() {
  try {
    const app = window.Application
    if (!app) return 'wps'
    const has = (key) => { try { return !!app[key] } catch { return false } }
    if (has('Workbooks')) return 'et'
    if (has('Presentations')) return 'wpp'
    return 'wps'
  } catch (_) {
    return 'wps'
  }
}

/**
 * 把当前活动文档另存为模板并登记入库（三宿主通用，「存为模板」闭环）。
 * @param {{name?:string}} options - name 缺省取活动文档名
 * @returns {{ok:boolean, path?:string, name?:string, kind?:string, id?:string, error?:string}}
 */
export function saveActiveDocumentAsTemplate(options = {}) {
  try {
    const app = window.Application
    const obj = app?.ActiveDocument || app?.ActiveWorkbook || app?.ActivePresentation
    if (!obj) return { ok: false, error: '当前没有活动文档' }
    const modelDir = getModelDir()
    if (!modelDir) return { ok: false, error: '未设置数据路径，请先在设置中配置数据路径' }
    const fs = app?.FileSystem
    if (!fs) return { ok: false, error: 'FileSystem 不可用' }

    const kind = normalizeTemplateKind(null, String(obj?.FullName || obj?.Name || ''))
      || ({ wps: 'doc', et: 'sheet', wpp: 'slide' }[detectAddonTypeSafe()] || 'doc')
    const rawName = String(options.name || obj?.Name || '').replace(/\.[^.]+$/, '').trim() || '我的模板'
    const safeName = rawName.replace(/[<>:"|?*\\/]/g, '_')

    const ext = kind === 'sheet' ? '.xlsx' : kind === 'slide' ? '.pptx' : '.aidocx'
    const id = 'tpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const targetPath = pathJoin(modelDir, safeName + '_' + id.slice(-6) + ext)
    const targetForFs = isWin ? targetPath.replace(/\//g, '\\') : targetPath.replace(/\\/g, '/')

    ensureDir(fs, getEffectiveDataDir())
    ensureDir(fs, modelDir)

    // SaveAs2 直接落模板库目录（格式按扩展名映射；三级回退同 deliverActiveDocument）
    const fmt = { '.aidocx': 12, '.xlsx': 51, '.pptx': 24 }[ext]
    let saved = false
    const trySave = (fn) => { try { return !!fn() } catch (e) { console.warn('saveActiveDocumentAsTemplate 保存形态失败:', e?.message || e); return false } }
    if (fmt !== undefined) saved = trySave(() => !!obj.SaveAs2(targetForFs, fmt))
    if (!saved) saved = trySave(() => !!obj.SaveAs2(targetForFs))
    if (!saved) saved = trySave(() => !!obj.SaveAs(targetForFs))
    if (!saved) return { ok: false, error: '另存失败：无法写入模板库目录' }

    const reg = addDocumentTemplate(targetPath, safeName, kind)
    if (!reg.ok) return { ok: false, error: '模板已保存但登记失败：' + (reg.error || '') }
    return { ok: true, path: targetPath, name: safeName, kind, id: reg.id }
  } catch (e) {
    console.error('saveActiveDocumentAsTemplate 异常:', e)
    return { ok: false, error: e?.message || '存为模板失败' }
  }
}

/**
 * 通过 WPS 文件选择器选择 .aidocx 文件路径
 * @returns {Promise<string|null>} 选中路径，取消则 null
 */
export function pickAidocFile() {
  return new Promise((resolve) => {
    try {
      const app = window.Application
      if (!app) {
        resolve(null)
        return
      }

      const fileFilter = '察元模板 (*.aidocx *.docx *.xlsx *.pptx), *.aidocx;*.docx;*.xlsx;*.pptx'
      const filterIndex = 1

      // 优先使用 GetOpenFileName（若 WPS 支持）
      if (typeof app.GetOpenFileName === 'function') {
        try {
          const path = app.GetOpenFileName('', fileFilter, filterIndex, '选择模板文件', '打开')
          if (path && path !== false && String(path).trim()) {
            const p = String(path).replace(/^file:\/\//i, '').replace(/\\\\/g, '/')
            resolve(p)
            return
          }
          resolve(null)
          return
        } catch (e) {
          console.warn('GetOpenFileName 不可用:', e?.message)
        }
      }

      // 回退到 FileDialog(1) msoFileDialogOpen
      const fd = app.FileDialog(1)
      fd.Title = '选择模板文件'
      fd.AllowMultiSelect = false
      fd.Filters.Clear()
      fd.Filters.Add('察元模板', '*.aidocx;*.docx;*.xlsx;*.pptx', 1)
      fd.FilterIndex = 1
      if (fd.Show() === -1) {
        const item = fd.SelectedItems.Item(1)
        if (item) {
          const p = String(item).replace(/^file:\/\//i, '').replace(/\\\\/g, '/')
          resolve(p)
          return
        }
      }
      resolve(null)
    } catch (e) {
      console.warn('选择模板文件失败:', e)
      resolve(null)
    }
  })
}
