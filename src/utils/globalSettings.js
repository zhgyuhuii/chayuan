/**
 * 全局设置 - 持久化存储
 * 注意：WPS PluginStorage 在加载项关闭后不持久化，必须使用文件或 localStorage
 * 策略：优先文件（数据路径下 settings.json），备用 localStorage（跨会话持久化）
 */

import { getEffectiveDataDir, joinDataPath, ensureDir, getDefaultDataPath } from './dataPathSettings.js'
import { MCP_BASE_URL as MCP_BASE_URL_FOR_SETTINGS } from '../services/mcpBridge/config.js'

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

// 启动引导（一次性）：WPS 沙盒里 webview 直接读用户设置文件不可靠，且 CEF 缓存
// 清理会带走 localStorage——从 sidecar 桥接一份宿主侧设置播种进 localStorage，
// 之后 loadFromLocalStorage 稳定命中（2026-09-30 VM 实测模型配置丢失的根治）。
let _sidecarSeeded = false
// 播种是否已收尾（命中本地 / 拉回成功 / 拉回失败都算）。推送 sidecar 必须等它——
// 否则重装后 localStorage 全空时的早期保存（如迁移标记）会以「空配置+单键」
// 覆盖 sidecar 磁盘真源里的完整 modelConfigs（覆盖竞态，2026-11-21 复盘补的闸）
let _sidecarSeedSettled = false
function seedFromSidecar() {
  if (_sidecarSeeded) return
  _sidecarSeeded = true
  if (typeof localStorage === 'undefined') { _sidecarSeedSettled = true; return }
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
  if (raw && JSON.parse(raw || '{}')?.modelConfigs && Object.keys(JSON.parse(raw).modelConfigs || {}).length) {
    _sidecarSeedSettled = true
    flushSidecarSave()
    return
  }
  try {
    const base = String(MCP_BASE_URL_FOR_SETTINGS || '').replace(/\/+$/, '')
    if (!base) { _sidecarSeedSettled = true; return }
    fetch(`${base}/app-settings`, { headers: { Accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.modelConfigs && Object.keys(data.modelConfigs).length) {
          const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}')
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...data, ...existing, modelConfigs: { ...data.modelConfigs, ...(existing.modelConfigs || {}) } }))
          // 本窗口自己 setItem 不触发 storage 事件，而 loadRaw 首跑已把空对象留在
          // _cache——不失效缓存的话，播种拉回的配置要重启 WPS 才能被读到
          _invalidateGlobalSettingsCache()
        }
      })
      .catch(() => {})
      .finally(() => {
        // 拉回/拉空/失败都收尾：挂起的推送按（可能已回填的）最新缓存执行
        _sidecarSeedSettled = true
        flushSidecarSave()
      })
  } catch (_) {
    _sidecarSeedSettled = true
  }
}

// sidecar 磁盘真源推送（debounce 500ms 合并连续保存）：webview 文件层在 macOS
// 沙盒 WPS 上从未成功过（~/Library/Application Support/chayuan 磁盘不存在——
// 设置窗口 Env 注入不可靠 → home 解析失败 → 相对路径被 saveToFile 的
// isAbsolutePath 拒掉，静默失败），重装/清 CEF 缓存会带走 localStorage。
// 配置落 sidecar（~/.config/chayuan/settings.json，用户态无沙盒、重装不动）后，
// 下次启动经 seedFromSidecar 拉回——重装不用重新配置。fire-and-forget：失败
// 静默（localStorage 仍保本会话；sidecar 是跨重装的恢复层，不是本会话读路径）。
let _sidecarSaveTimer = null
let _sidecarSavePending = null
// 播种收尾后（或 debounce 到期且播种已收尾）执行真正的推送。推送前重新
// loadGlobalSettings：播种可能刚回填过 localStorage 并失效了缓存，直接用调用方
// 传入的 merged 会退化成「空配置+单键」覆盖真源
function flushSidecarSave() {
  if (_sidecarSaveTimer) return // debounce 未到期，timer 到期时自然执行
  if (!_sidecarSeedSettled) return // 播种未收尾：挂起，收尾时再 flush
  const base = String(MCP_BASE_URL_FOR_SETTINGS || '').replace(/\/+$/, '')
  if (!base) return
  try {
    const payload = loadGlobalSettings()
    if (!payload || typeof payload !== 'object') return
    fetch(`${base}/app-settings/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {})
  } catch (_) { /* sidecar 不在线时静默：localStorage 仍是本会话读路径 */ }
}
function scheduleSidecarSave(merged) {
  _sidecarSavePending = merged
  if (_sidecarSaveTimer) return
  _sidecarSaveTimer = setTimeout(() => {
    _sidecarSaveTimer = null
    flushSidecarSave()
  }, 500)
}

function loadRaw() {
  const fromFile = loadFromFile()
  if (fromFile) return fromFile
  const fromLocal = loadFromLocalStorage()
  if (fromLocal) { seedFromSidecar(); return fromLocal }
  seedFromSidecar()
  const fromPlugin = loadFromPluginStorage()
  return fromPlugin
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

// 最近一次 saveGlobalSettings 失败的原因,供调用方给用户更准确的提示。
// null = 无失败 / 'quota' = localStorage 配额已满 / 'unavailable' = 文件与 localStorage 均不可用。
let _lastSaveFailureReason = null

export function getLastSaveFailureReason() {
  return _lastSaveFailureReason
}

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
      console.info('globalSettings saveToFile: 当前应用宿主不支持带分隔符的文件路径,改用 localStorage 持久化。')
      return false
    }
    console.warn('globalSettings saveToFile:', e)
    return false
  }
}

// 区分配额超限和其它异常。之前这里 catch 后静默 return false,QuotaExceededError
// 连控制台都看不到,根因无法定位(“助手设置保存失败”查不到原因)。
function isQuotaExceededError(e) {
  if (!e) return false
  return e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 || e.code === 1014
}

function saveToLocalStorage(obj) {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(obj))
    return true
  } catch (e) {
    if (isQuotaExceededError(e)) {
      _lastSaveFailureReason = 'quota'
      console.error('globalSettings saveToLocalStorage: localStorage 配额已满,无法写入。', e)
    } else {
      console.error('globalSettings saveToLocalStorage 失败:', e)
    }
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
  _lastSaveFailureReason = null
  const current = loadGlobalSettings()
  const merged = { ...current, ...(partial && typeof partial === 'object' ? partial : {}) }
  let fileOk = false
  let storageOk = false
  fileOk = saveToFile(merged)
  storageOk = saveToLocalStorage(merged) // 失败为配额时会置 _lastSaveFailureReason='quota'
  saveToPluginStorage(merged)
  if (!fileOk && !storageOk) {
    if (!_lastSaveFailureReason) _lastSaveFailureReason = 'unavailable'
    console.error('globalSettings: 保存失败（文件和 localStorage 均不可用）')
    return false
  }
  _lastSaveFailureReason = null
  // 文件路径已被宿主拒绝时,saveToFile 内部已一次性 info 提示,这里就不再每次都 warn。
  if (!fileOk && !_fileWriteDisabled) {
    console.warn('globalSettings: 文件保存失败，已保存到 localStorage')
  }
  // 写盘后刷新缓存,下游 memo 通过 version 判断重算
  _cache = merged
  _cacheVersion++
  // 推送 sidecar 磁盘真源（debounce 500ms）：与文件层/localStorage 成败无关，
  // 这里是「重装后恢复」的唯一可靠来源，必须无条件尝试
  scheduleSidecarSave(merged)
  return true
}
