/**
 * 全局设置 - 持久化存储
 * 注意：WPS PluginStorage 在加载项关闭后不持久化，必须使用文件或 localStorage
 * 策略：优先文件（数据路径下 settings.json），备用 localStorage（跨会话持久化）
 */

import { getEffectiveDataDir, joinDataPath, ensureDir, getDefaultDataPath } from './dataPathSettings.js'

const FILE_NAME = 'settings.json'
const PLUGIN_STORAGE_KEY = 'NdGlobalSettings'
const LOCAL_STORAGE_KEY = 'NdGlobalSettings'

function getSettingsBaseDir() {
  return getEffectiveDataDir() || getDefaultDataPath()
}

function getSettingsPath() {
  const base = getSettingsBaseDir()
  if (!base) return null
  const sep = base.includes('\\') ? '\\' : '/'
  const part = (FILE_NAME || '').replace(/^[/\\]+/, '').replace(/[/\\]+/g, sep)
  return base + sep + part
}

function loadFromFile() {
  try {
    const path = joinDataPath(FILE_NAME) || getSettingsPath()
    if (!path) return null
    const fs = window.Application?.FileSystem
    if (!fs?.readFileString && !fs?.ReadFile) return null
    const raw = fs.readFileString ? fs.readFileString(path) : fs.ReadFile(path)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

function loadFromLocalStorage() {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw === null || raw === '') return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (e) {
    return null
  }
}

function loadFromPluginStorage() {
  try {
    const raw = window.Application?.PluginStorage?.getItem(PLUGIN_STORAGE_KEY)
    if (raw === undefined || raw === null || raw === '') return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (e) {
    return null
  }
}

function loadRaw() {
  return loadFromFile() || loadFromLocalStorage() || loadFromPluginStorage()
}

function isAbsolutePath(p) {
  if (!p || typeof p !== 'string') return false
  const s = p.trim()
  return s.startsWith('/') || /^[A-Za-z]:[\\/]/.test(s)
}

// 某些 WPS 宿主版本里 FileSystem.writeFileString 把第一个参数当作 key 而非路径,
// 含 / 或 \ 时直接抛 'path cannot contains "/" or "\\"'。每次 saveToFile 都重试只会
// 在控制台刷屏,而 localStorage 兜底其实是工作的。一旦命中此错误就一次性 disable 文件路径,
// 后续调用静默走 localStorage / PluginStorage。
let _fileWriteDisabled = false

function _isPathSeparatorRejection(err) {
  const msg = String(err?.message || err || '').toLowerCase()
  return msg.includes('path cannot') && (msg.includes('/') || msg.includes('\\'))
}

function saveToFile(obj) {
  if (_fileWriteDisabled) return false
  try {
    const path = joinDataPath(FILE_NAME) || getSettingsPath()
    if (!path) return false
    if (!isAbsolutePath(path)) return false
    const base = getSettingsBaseDir()
    if (!base) return false
    const fs = window.Application?.FileSystem
    if (!fs?.writeFileString && !fs?.WriteFile) return false
    ensureDir(fs, base)
    const json = JSON.stringify(obj, null, 2)
    return !!(fs.writeFileString ? fs.writeFileString(path, json) : fs.WriteFile(path, json))
  } catch (e) {
    if (_isPathSeparatorRejection(e)) {
      _fileWriteDisabled = true
      console.info('globalSettings saveToFile: 当前 WPS 宿主不支持带分隔符的文件路径,改用 localStorage 持久化。')
      return false
    }
    console.warn('globalSettings saveToFile:', e)
    return false
  }
}

function saveToLocalStorage(obj) {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(obj))
    return true
  } catch (e) {
    return false
  }
}

function saveToPluginStorage(obj) {
  try {
    if (!window.Application?.PluginStorage) return false
    window.Application.PluginStorage.setItem(PLUGIN_STORAGE_KEY, JSON.stringify(obj))
    return true
  } catch (e) {
    return false
  }
}

/*
 * 内存缓存。原实现里 loadGlobalSettings() 每次都触发一次 WPS FileSystem 读 + JSON.parse
 * 整个 settings blob,而 ribbon 动态菜单(察元AI助理 / 察元AI编审 / 更多)展开时会扇出
 * 100+ 次 loadGlobalSettings(每个 assistant × 每个位置 × per-item GetImage),累计上百
 * 次同步磁盘 I/O,这是"切菜单卡顿"的核心瓶颈。
 *
 * 策略:
 *   - 第一次 load 读盘,结果留在 _cache,后续 load 直接返回 _cache 引用
 *   - saveGlobalSettings 写盘成功后直接把新 merged 对象写回 _cache,version++
 *   - version 计数让外部 memo(loadAssistantSettings 等)可以判断自己的缓存是否过期
 *   - 外部并发写(例如 devtools 改 localStorage)罕见,提供 _invalidateGlobalSettingsCache 兜底
 *
 * 调用方约定:不要 mutate loadGlobalSettings() 的返回值;需要修改请用 saveGlobalSettings。
 */
let _cache = null
let _cacheVersion = 0

export function loadGlobalSettings() {
  if (_cache !== null) return _cache
  const raw = loadRaw()
  _cache = raw && typeof raw === 'object' ? raw : {}
  return _cache
}

export function getGlobalSettingsVersion() {
  return _cacheVersion
}

export function _invalidateGlobalSettingsCache() {
  _cache = null
  _cacheVersion++
}

// 跨窗口同步:设置窗口保存后会写 localStorage(LOCAL_STORAGE_KEY)。其它 webview
// (如 AI 助手窗口)此前缓存的 _cache 不会自动失效,导致读到旧配置(例如刚填的
// API 地址读不到)。这里监听 storage 事件,别的窗口改了设置就失效本窗口缓存,
// 下次 loadGlobalSettings() 自动重新读盘。(窗口管理器已依赖同源跨 webview 的
// storage 事件,机制可用。)
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  try {
    window.addEventListener('storage', (event) => {
      if (event && event.key === LOCAL_STORAGE_KEY) {
        _invalidateGlobalSettingsCache()
      }
    })
    // 兜底(WPS dialog webview 的跨窗口 storage 事件未必可靠):窗口重新获得焦点
    // 或变为可见时,失效缓存 —— 在设置窗口保存后切回 AI 助手/对话窗口即重读最新
    // 配置,无需重启 WPS。focus/visibilitychange 在 WPS webview 中必然触发。
    window.addEventListener('focus', () => { _invalidateGlobalSettingsCache() })
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') _invalidateGlobalSettingsCache()
      })
    }
  } catch (_) { /* 静默:监听失败不影响主流程 */ }
}

/**
 * 保存全局设置（合并到现有设置）
 * 同时写入文件和 localStorage，确保关闭 WPS 后数据不丢失
 */
export function saveGlobalSettings(partial) {
  const current = loadGlobalSettings()
  const merged = { ...current, ...(partial && typeof partial === 'object' ? partial : {}) }
  let fileOk = false
  let storageOk = false
  fileOk = saveToFile(merged)
  storageOk = saveToLocalStorage(merged)
  saveToPluginStorage(merged)
  if (!fileOk && !storageOk) {
    console.error('globalSettings: 保存失败（文件和 localStorage 均不可用）')
    return false
  }
  // 文件路径已被宿主拒绝时,saveToFile 内部已一次性 info 提示,这里就不再每次都 warn。
  if (!fileOk && !_fileWriteDisabled) {
    console.warn('globalSettings: 文件保存失败，已保存到 localStorage')
  }
  // 写盘后刷新缓存,下游 memo 通过 version 判断重算
  _cache = merged
  _cacheVersion++
  return true
}
