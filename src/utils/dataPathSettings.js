/**
 * 数据路径设置 - 所有本地数据统一保存到此路径
 * 存储于固定位置的配置文件（使用文件系统），下次加载时自动读取
 */

const STORAGE_KEY = 'NdDataPath'
const CONFIG_FILE_NAME = 'chayuan_data_path.txt'

function isDataPathDebugEnabled() {
  try {
    return window?.__CHAYUAN_DEBUG_DATA_PATH__ === true
  } catch (_) {
    return false
  }
}

function debugDataPath(...args) {
  if (isDataPathDebugEnabled()) console.debug(...args)
}

function normalizeStoredDataPathValue(value) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim()
  }
  return ''
}

function getApplication() {
  return window.Application || window.opener?.Application || window.parent?.Application || null
}

/**
 * 检测操作系统类型
 */
function detectOS() {
  // Windows: 通过 ActiveXObject 检测（仅 IE/Windows 特有）
  if (typeof ActiveXObject !== 'undefined') {
    return 'windows'
  }
  
  // Mac: 通过 navigator.platform 或 userAgent 检测
  const platform = navigator.platform || ''
  const userAgent = navigator.userAgent || ''
  if (/Mac|iPod|iPhone|iPad/.test(platform) || /Macintosh/.test(userAgent)) {
    return 'mac'
  }
  
  // Linux: 通过 navigator.platform 检测
  if (/Linux/.test(platform)) {
    return 'linux'
  }
  
  // 默认：根据路径分隔符判断（Unix 风格）
  return 'unix'
}

/**
 * 获取操作系统类型
 */
export function getOSType() {
  return detectOS()
}

/**
 * 判断是否为 Windows
 */
export function isWindows() {
  return detectOS() === 'windows'
}

/**
 * 判断是否为 Mac
 */
export function isMac() {
  return detectOS() === 'mac'
}

/**
 * 判断是否为 Linux
 */
export function isLinux() {
  return detectOS() === 'linux'
}

const _isWindows = isWindows()

export function pathSep() {
  return _isWindows ? '\\' : '/'
}

/**
 * 从已知路径推导用户主目录
 * 如 /Users/zyh/Downloads -> /Users/zyh，C:/Users/xxx/Downloads -> C:\Users\xxx
 */
function getUserHomeFromPath(pathStr) {
  if (!pathStr || typeof pathStr !== 'string') return null
  const s = pathStr.replace(/^file:\/\//i, '').replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = s.split('/').filter(Boolean)
  if (_isWindows && parts.length >= 3) {
    return parts.slice(0, 3).join('\\')
  }
  if (!_isWindows && parts.length >= 2) {
    return '/' + parts.slice(0, -1).join('/')
  }
  return null
}

/**
 * 规范化 WPS Env 返回的路径（去 file://、统一分隔符）
 */
function normalizeEnvPath(raw) {
  if (!raw || typeof raw !== 'string') return ''
  const sep = pathSep()
  let s = raw.replace(/^file:\/\//i, '').trim()
  s = s.replace(/[/\\]+$/g, '')
  s = s.replace(/[/\\]+/g, sep)
  return s
}

/**
 * 从 WPS Env 推导用户主目录（供默认路径使用）
 * 优先 GetHomePath（API 直接给出主目录，比从下载路径反推可靠）
 * @returns {string|null}
 */
function resolveUserHomeDir() {
  try {
    const app = getApplication()
    if (!app?.Env) return null
    if (typeof app.Env.GetHomePath === 'function') {
      const hp = normalizeEnvPath(String(app.Env.GetHomePath() || ''))
      if (hp) return hp
    }
    if (typeof app.Env.GetDownloadPath === 'function') {
      const dl = String(app.Env.GetDownloadPath() || '')
      const h = getUserHomeFromPath(dl)
      if (h) return h
    }
    if (typeof app.Env.GetDesktopPath === 'function') {
      const dt = String(app.Env.GetDesktopPath() || '')
      return getUserHomeFromPath(dt)
    }
  } catch (e) {
    // Best-effort host path probing; fall back to default path below.
  }
  return null
}

/**
 * 获取操作系统默认数据路径（常规应用数据存储位置）
 * Windows: %APPDATA%\chayuan (C:\Users\<user>\AppData\Roaming\chayuan)
 * macOS: ~/Library/Application Support/chayuan
 * Linux: ~/.config/chayuan
 */
export function getDefaultDataPath() {
  try {
    const userHome = resolveUserHomeDir()
    if (!userHome) return 'chayuan_data'

    const sep = pathSep()
    const osType = detectOS()
    if (osType === 'windows') {
      return userHome + sep + 'AppData' + sep + 'Roaming' + sep + 'chayuan'
    } else if (osType === 'mac') {
      return userHome + sep + 'Library' + sep + 'Application Support' + sep + 'chayuan'
    } else if (osType === 'linux') {
      return userHome + sep + '.config' + sep + 'chayuan'
    } else {
      return userHome + sep + '.config' + sep + 'chayuan'
    }
  } catch (e) {
    console.warn('获取默认数据路径失败:', e)
  }
  return 'chayuan_data'
}

/**
 * 未单独配置「数据路径」时，日志目录的 OS 默认位置（与业务数据目录分离，符合各平台惯例）
 *
 * - Windows: %LOCALAPPDATA%\\chayuan\\Logs（用户本地、不参与漫游，适合体积较大的日志）
 * - macOS: ~/Library/Logs/chayuan（Apple 推荐的用户日志目录）
 * - Linux / 其他 Unix: ~/.local/state/chayuan/log（XDG Base Directory：state 用于运行时状态与日志类数据）
 *
 * 无法解析用户目录时优先使用 %TEMP%/chayuan/logs（通常为绝对路径且可写），最后才退化为相对路径 chayuan_data/logs。
 *
 * @returns {string}
 */
export function getDefaultLogDir() {
  try {
    const userHome = resolveUserHomeDir()
    if (!userHome) {
      const app = getApplication()
      if (app?.Env && typeof app.Env.GetTempPath === 'function') {
        const tmp = normalizeEnvPath(String(app.Env.GetTempPath() || ''))
        if (tmp) {
          return pathJoin(tmp, 'chayuan', 'logs')
        }
      }
      return 'chayuan_data' + pathSep() + 'logs'
    }

    const sep = pathSep()
    const osType = detectOS()
    if (osType === 'windows') {
      return userHome + sep + 'AppData' + sep + 'Local' + sep + 'chayuan' + sep + 'Logs'
    }
    if (osType === 'mac') {
      return userHome + sep + 'Library' + sep + 'Logs' + sep + 'chayuan'
    }
    // Linux 与其他 Unix：对齐 XDG_STATE_HOME 默认 ~/.local/state/<app>/log
    return userHome + sep + '.local' + sep + 'state' + sep + 'chayuan' + sep + 'log'
  } catch (e) {
    console.warn('获取默认日志目录失败:', e)
  }
  return 'chayuan_data' + pathSep() + 'logs'
}

/**
 * 获取配置文件路径（固定位置）
 */
// eslint-disable-next-line no-unused-vars
function getConfigFilePath() {
  try {
    const app = getApplication()
    if (!app?.Env) return null
    
    const sep = pathSep()
    let configDir = null
    
    // 尝试获取用户主目录
    if (typeof app.Env.GetDownloadPath === 'function') {
      const dl = String(app.Env.GetDownloadPath() || '')
      const userHome = getUserHomeFromPath(dl)
      if (userHome) {
        const osType = detectOS()
        if (osType === 'windows') {
          configDir = userHome + sep + 'AppData' + sep + 'Roaming' + sep + 'chayuan'
        } else if (osType === 'mac') {
          configDir = userHome + sep + 'Library' + sep + 'Application Support' + sep + 'chayuan'
        } else if (osType === 'linux') {
          configDir = userHome + sep + '.config' + sep + 'chayuan'
        } else {
          // 其他 Unix 系统
          configDir = userHome + sep + '.config' + sep + 'chayuan'
        }
      }
    }
    
    if (!configDir && typeof app.Env.GetDesktopPath === 'function') {
      const dt = String(app.Env.GetDesktopPath() || '')
      const userHome = getUserHomeFromPath(dt)
      if (userHome) {
        const osType = detectOS()
        if (osType === 'windows') {
          configDir = userHome + sep + 'AppData' + sep + 'Roaming' + sep + 'chayuan'
        } else if (osType === 'mac') {
          configDir = userHome + sep + 'Library' + sep + 'Application Support' + sep + 'chayuan'
        } else if (osType === 'linux') {
          configDir = userHome + sep + '.config' + sep + 'chayuan'
        } else {
          // 其他 Unix 系统
          configDir = userHome + sep + '.config' + sep + 'chayuan'
        }
      }
    }
    
    if (!configDir) return null
    
    return configDir + sep + CONFIG_FILE_NAME
  } catch (e) {
    console.warn('getConfigFilePath: 获取配置路径失败:', e)
    return null
  }
}

/**
 * 获取已设置的数据路径（空字符串表示未设置，使用默认逻辑）
 * @returns {string|null} 配置的路径，未设置则 null
 */
export function getDataPath() {
  try {
    const app = getApplication()
    if (!app) {
      console.warn('getDataPath: Application 不可用')
      return null
    }
    
    let raw = null
    
    // 方法1: 优先从 WPS PluginStorage 读取
    if (app?.PluginStorage) {
      try {
        const psVal = app.PluginStorage.getItem(STORAGE_KEY)
        debugDataPath('getDataPath: 从 PluginStorage 读取:', { 
          raw: psVal, 
          type: typeof psVal, 
          key: STORAGE_KEY,
          isUndefined: psVal === undefined,
          isNull: psVal === null
        })
        
        const psStr = normalizeStoredDataPathValue(psVal)
        if (psStr) {
          raw = psStr
          debugDataPath('getDataPath: 从 PluginStorage 读取到值:', psStr)
        }
      } catch (psError) {
        console.error('getDataPath: PluginStorage 读取失败:', psError)
      }
    }
    
    // 方法2: 如果 PluginStorage 没有值，尝试从 localStorage 读取（备用）
    if ((raw === undefined || raw === null || raw === '') && typeof localStorage !== 'undefined') {
      try {
        const lsVal = localStorage.getItem(STORAGE_KEY)
        debugDataPath('getDataPath: 从 localStorage 读取:', { 
          raw: lsVal, 
          type: typeof lsVal, 
          key: STORAGE_KEY 
        })
        
        const lsStr = normalizeStoredDataPathValue(lsVal)
        if (lsStr) {
          raw = lsStr
          debugDataPath('getDataPath: 从 localStorage 读取到值:', raw)
          
          // 如果 localStorage 有值但 PluginStorage 没有，尝试同步到 PluginStorage
          if (app?.PluginStorage && raw) {
            try {
              app.PluginStorage.setItem(STORAGE_KEY, raw)
              debugDataPath('getDataPath: 已同步 localStorage 的值到 PluginStorage')
            } catch (syncError) {
              console.warn('getDataPath: 同步到 PluginStorage 失败:', syncError)
            }
          }
        }
      } catch (lsError) {
        console.warn('getDataPath: localStorage 读取失败（非关键）:', lsError)
      }
    }
    
    // 如果值是 undefined 或 null，表示从未设置过
    if (raw === undefined || raw === null || raw === '') {
      debugDataPath('getDataPath: 未找到已保存的值')
      return null
    }
    
    // 转换为字符串并去除首尾空格
    const s = String(raw).trim()
    debugDataPath('getDataPath: 处理后的值:', s)
    
    // 如果处理后是空字符串，也表示未设置（用户清空了设置）
    if (s === '') {
      debugDataPath('getDataPath: 值为空字符串，返回 null')
      return null
    }
    
    debugDataPath('getDataPath: 返回路径:', s)
    return s
  } catch (e) {
    console.error('getDataPath: 读取失败:', e)
    return null
  }
}

/**
 * 获取实际使用的数据目录（优先使用设置路径，否则 null 表示用原有逻辑）
 * @returns {string|null}
 */
export function getEffectiveDataDir() {
  const configured = getDataPath()
  if (configured) return normalizeDataPath(configured)
  return null
}

/** 规范化用户输入的数据目录路径（与保存到存储时的规则一致） */
export function normalizeDataPath(p) {
  if (!p || typeof p !== 'string') return p
  let s = String(p).trim().replace(/^file:\/\//i, '')
  const sep = pathSep()
  s = s.replace(/[/\\]+/g, sep).replace(new RegExp(sep + '+$'), '')
  return s
}

/**
 * 保存数据路径设置
 * 使用 WPS PluginStorage 作为主要存储方式（WPS 官方推荐的持久化存储）
 * @param {string} path - 路径，空字符串表示清除设置
 */
export function setDataPath(path) {
  try {
    const app = getApplication()
    if (!app) {
      console.error('setDataPath: Application 不可用')
      return false
    }
    
    // 规范化路径
    const val = path && typeof path === 'string' ? normalizeDataPath(path) : ''
    console.log('setDataPath: 准备保存:', { 
      input: path, 
      normalized: val, 
      key: STORAGE_KEY,
      isEmpty: val === ''
    })
    
    // 主要存储方式：使用 WPS PluginStorage（WPS 官方推荐的持久化存储方式）
    if (!app?.PluginStorage) {
      console.error('setDataPath: PluginStorage 不可用')
      return false
    }
    
    try {
      // 保存到 PluginStorage（主要存储）
      app.PluginStorage.setItem(STORAGE_KEY, val)
      console.log('setDataPath: 已保存到 PluginStorage')
      
      // 同时保存到 localStorage（备用存储，确保持久化）
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, val)
          console.log('setDataPath: 已同步保存到 localStorage（备用）')
        } catch (lsError) {
          console.warn('setDataPath: localStorage 保存失败（非关键）:', lsError)
        }
      }
      
      // 立即验证保存是否成功
      const verify = app.PluginStorage.getItem(STORAGE_KEY)
      const verifyStr = verify !== undefined && verify !== null ? String(verify).trim() : ''
      console.log('setDataPath: PluginStorage 保存后验证:', { 
        saved: verifyStr, 
        expected: val, 
        match: verifyStr === val,
        verifyType: typeof verify
      })
      
      // 验证 localStorage（如果可用）
      if (typeof localStorage !== 'undefined') {
        try {
          const lsVerify = localStorage.getItem(STORAGE_KEY)
          const lsVerifyStr = lsVerify !== null ? String(lsVerify).trim() : ''
          console.log('setDataPath: localStorage 保存后验证:', { 
            saved: lsVerifyStr, 
            expected: val, 
            match: lsVerifyStr === val
          })
          
          // 如果 PluginStorage 验证失败但 localStorage 成功，也算成功
          if (verifyStr !== val && lsVerifyStr === val) {
            console.warn('setDataPath: PluginStorage 验证失败，但 localStorage 验证成功')
            return true
          }
        } catch (lsVerifyError) {
          console.warn('setDataPath: localStorage 验证失败（非关键）:', lsVerifyError)
        }
      }
      
      if (verifyStr !== val) {
        console.error('setDataPath: PluginStorage 保存验证失败')
        return false
      }
      
      console.log('setDataPath: PluginStorage 保存成功并验证通过')
      return true
    } catch (psError) {
      console.error('setDataPath: PluginStorage 操作失败:', psError)
      
      // 如果 PluginStorage 失败，尝试只保存到 localStorage
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, val)
          console.log('setDataPath: PluginStorage 失败，已保存到 localStorage（备用）')
          return true
        } catch (lsError) {
          console.error('setDataPath: localStorage 也失败:', lsError)
        }
      }
      
      return false
    }
  } catch (e) {
    console.error('setDataPath: 保存失败:', e)
    return false
  }
}

/**
 * 拼接数据路径下的文件或子目录路径
 * @param {string} fileName - 文件名或子路径，如 'model' 或 'model/xxx.aidocx'
 * @returns {string|null} 完整路径，未设置数据路径则 null
 */
export function joinDataPath(fileName) {
  const base = getEffectiveDataDir()
  if (!base) return null
  const sep = pathSep()
  const part = (fileName || '').replace(/^[/\\]+/, '').replace(/[/\\]+/g, sep)
  return base + sep + part
}

/** 子目录：导入的文档模板 .aidocx 文件 */
export const SUBDIR_MODEL = 'model'

/**
 * 获取 model 目录完整路径（导入模板存储）
 */
export function getModelDir() {
  return joinDataPath(SUBDIR_MODEL)
}

/**
 * 拼接路径（使用系统分隔符）
 */
export function pathJoin(...parts) {
  const sep = pathSep()
  return parts.filter(Boolean).join(sep)
}

/**
 * 确保目录存在（递归创建父目录）
 */
export function ensureDir(fs, dirPath) {
  if (!fs?.Mkdir || !dirPath) return false
  try {
    fs.Mkdir(dirPath)
    return true
  } catch (e) {
    try {
      const parts = dirPath.split(/[/\\]/).filter(Boolean)
      if (parts.length === 0) return false
      let current = _isWindows ? (parts[0] + ':') : ('/' + parts[0])
      for (let i = 1; i < parts.length; i++) {
        current = pathJoin(current, parts[i])
        try {
          fs.Mkdir(current)
        } catch (e2) {
          // Directory may already exist; continue creating the remaining path.
        }
      }
      return true
    } catch (e3) {
      console.warn('ensureDir 失败:', dirPath, e3)
      return false
    }
  }
}
