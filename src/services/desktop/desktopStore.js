/**
 * desktopStore — 「察元桌面版」感知状态的单一真源。
 *
 * 状态形态：
 *   { online: boolean, baseUrl: string,
 *     models: [{ id, name, group }],   // desktop 上全部可用对话模型；group 为分组键
 *     modelsReady: boolean, checkedAt: number|null }
 *
 * - models 镜像 chayuan-desktop 已配置的全部对话模型（云端 + 本地）；group 为分组键：
 *   本地运行时统一为 'local'，云端为平台名（platform_name / runtime）。
 * - 选任意模型聊天都经稳定端口 62581 转发，desktop 自己持有云端 key，WPS 端无需配密钥。
 * - 持久化：snapshot 写入 globalSettings 的 'desktopIntegration' namespace，冷启动先 hydrate
 *   快照（先显示模型清单），刷新时再由 desktopProbe 校正。
 * - 订阅：KbSelectorDialog / ModelSelector / AIAssistantDialog 通过 subscribe 响应变化。
 */
import { loadGlobalSettings, saveGlobalSettings } from '../../utils/globalSettings.js'

// desktop 镜像组的 providerId 前缀；用 `CHAYUAN_DESKTOP::<group>` 与用户自配 provider 区分、不冲突。
export const DESKTOP_PROVIDER_PREFIX = 'CHAYUAN_DESKTOP::'
export const DESKTOP_BASE_URL = 'http://127.0.0.1:62581'
const SNAPSHOT_KEY = 'desktopIntegration'

const listeners = new Set()

function _defaultState() {
  return { online: false, baseUrl: DESKTOP_BASE_URL, models: [], modelsReady: false, checkedAt: null }
}

let _state = _hydrate()

function _hydrate() {
  try {
    const all = loadGlobalSettings() || {}
    const snap = all[SNAPSHOT_KEY]
    if (snap && typeof snap === 'object') {
      return {
        online: false, // 快照仅用于先显示模型；在线状态必须由实时 detect 决定
        baseUrl: snap.baseUrl || DESKTOP_BASE_URL,
        models: Array.isArray(snap.models) ? snap.models : [],
        modelsReady: !!snap.modelsReady,
        // checkedAt 置空：快照不喂"已探测"结论，避免 detect 前徽标用陈旧时间戳误报"未检测到"
        checkedAt: null
      }
    }
  } catch (_) { /* ignore */ }
  return _defaultState()
}

function _persist() {
  try {
    saveGlobalSettings({ [SNAPSHOT_KEY]: {
      baseUrl: _state.baseUrl,
      models: _state.models,
      modelsReady: _state.modelsReady,
      checkedAt: _state.checkedAt
    } })
  } catch (_) { /* ignore */ }
}

export function getState() { return { ..._state, models: _state.models.slice() } }

export function setState(partial) {
  _state = { ..._state, ...(partial || {}) }
  if (!Array.isArray(_state.models)) _state.models = []
  _persist()
  for (const fn of listeners) { try { fn(getState()) } catch (_) { /* ignore */ } }
  return getState()
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }

export function isOnline() { return !!_state.online }
export function getBaseUrl() { return _state.baseUrl || DESKTOP_BASE_URL }

/** 供模型下拉用：在线时返回 desktop 全部对话模型 [{id,name,group}]，离线返回 [] */
export function getDesktopModels() { return _state.online ? _state.models.slice() : [] }

/** 判断某 providerId 是否是 desktop 镜像组（聊天需经 62581 转发） */
export function isDesktopProviderId(providerId) {
  return String(providerId || '').startsWith(DESKTOP_PROVIDER_PREFIX)
}

export function _resetForTest() { _state = _defaultState() }
