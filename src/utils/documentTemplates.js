/**
 * 文档模板管理 - 导入的 .aidocx 模板存储与读取
 * 若设置了数据路径：模板文件复制到 dataPath/model/，清单保存到 dataPath/chayuan_document_templates.json
 * 否则使用 PluginStorage 存储清单，模板路径为用户选择的原路径
 */

import { getEffectiveDataDir, getModelDir, joinDataPath, ensureDir, pathJoin, pathSep } from './dataPathSettings.js'

const STORAGE_KEY = 'chayuan_document_templates'
const LEGACY_STORAGE_KEY = 'niudang_document_templates'
const FILE_NAME = 'chayuan_document_templates.json'
const LEGACY_FILE_NAME = 'niudang_document_templates.json'
const isWin = typeof ActiveXObject !== 'undefined'

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
      } catch (e) {}
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
  } catch (e) {}
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
        } catch (e) {}
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
 * 获取文档模板清单
 * @returns {Array<{id:string, path:string, name:string, addedAt:string}>}
 */
export function loadDocumentTemplates() {
  const list = getStorage()
  return Array.isArray(list) ? list : []
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
 * @returns {Promise<{ok:boolean, id?:string, error?:string}>}
 */
export function addDocumentTemplateFromFile(file) {
  return new Promise((resolve) => {
    if (!file || !(file instanceof File)) {
      resolve({ ok: false, error: '文件无效' })
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
          addedAt: new Date().toISOString()
        }
        list.push(item)
        if (!setStorage(list)) {
          resolve({ ok: false, error: '保存清单失败' })
          return
        }
        resolve({ ok: true, id })
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
 * @returns {{ok:boolean, id?:string, error?:string}}
 */
export function addDocumentTemplate(path, name) {
  if (!path || typeof path !== 'string') {
    return { ok: false, error: '路径无效' }
  }
  const normalized = String(path).trim().replace(/^file:\/\//i, '').replace(/\\\\/g, '/')
  if (!normalized) return { ok: false, error: '路径无效' }

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
    addedAt: new Date().toISOString()
  }
  list.push(item)
  if (!setStorage(list)) return { ok: false, error: '保存失败' }
  return { ok: true, id }
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

    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Macintosh/.test(navigator.userAgent)
    const isLinux = /Linux/.test(navigator.platform) && !isMac

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
 * .aidocx 本质为 docx 格式，复制为 .docx 便于 WPS 识别并避免扩展名导致崩溃
 * @param {string} templatePath - 模板文件路径（通常在 dataPath/model/ 下）
 * @returns {{ok:boolean, path?:string, error?:string}}
 */
export function copyTemplateToTempForNew(templatePath) {
  if (!templatePath || typeof templatePath !== 'string') {
    return { ok: false, error: '模板路径无效' }
  }
  try {
    const app = window.Application
    const fs = app?.FileSystem
    if (!fs) return { ok: false, error: 'FileSystem 不可用' }

    let tempDir = ''
    if (app?.Env?.GetTempPath) {
      const raw = app.Env.GetTempPath()
      tempDir = String(raw || '').replace(/^file:\/\//i, '').replace(/\\/g, '/').replace(/\/+$/, '')
      console.log('GetTempPath 返回:', tempDir)
    }
    if (!tempDir && getEffectiveDataDir()) {
      tempDir = pathJoin(getEffectiveDataDir(), '_temp')
      console.log('使用数据路径下的临时目录:', tempDir)
      ensureDir(fs, tempDir)
    }
    if (!tempDir) {
      const fallbackDir = isWin ? 'C:\\Temp' : '/tmp'
      tempDir = pathJoin(fallbackDir, 'chayuan_temp')
      console.log('使用备用临时目录:', tempDir)
      try {
        ensureDir(fs, tempDir)
      } catch (e) {
        console.warn('创建备用临时目录失败:', e)
      }
    }
    if (!tempDir) return { ok: false, error: '无法获取临时目录' }

    const baseName = templatePath.split(/[/\\]/).pop() || 'template'
    const nameWithoutExt = baseName.replace(/\.(aidocx|docx)$/i, '')
    const tempFileName = 'chayuan_new_' + Date.now() + '.docx'
    const tempPath = pathJoin(tempDir, tempFileName)
    const tempForFs = isWin ? tempPath.replace(/\//g, '\\') : tempPath.replace(/\\/g, '/')

    console.log('复制模板:', { from: templatePath, to: tempForFs, tempDir })
    
    if (!ensureDir(fs, tempDir)) {
      console.warn('临时目录创建可能失败:', tempDir)
    }
    
    const srcForFs = isWin ? templatePath.replace(/\//g, '\\') : templatePath.replace(/\\/g, '/')
    console.log('源文件路径（格式化后）:', srcForFs)
    
    const copySuccess = copyFile(srcForFs, tempForFs)
    if (copySuccess) {
      console.log('模板复制成功:', tempForFs)
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
 * 是否应使用文件选择器（数据路径已设置时用 File 对象直接写入，否则用路径）
 */
export function shouldUseFileInputForImport() {
  return !!getModelDir()
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

      const fileFilter = '察元模板 (*.aidocx), *.aidocx'
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
      fd.Filters.Add('察元模板 (*.aidocx)', '*.aidocx', 1)
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
