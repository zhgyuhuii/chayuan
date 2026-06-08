/**
 * desktopStore — 「察元桌面版」感知状态的单一真源。
 *
 * 状态形态：
 *   { online: boolean, baseUrl: string, localModels: [{id,name}],
 *     modelsReady: boolean, checkedAt: number|null }
 *
 * - 持久化：snapshot 写入 globalSettings 的 'desktopIntegration' namespace，
 *   冷启动先 hydrate 快照（先显示上次结果），刷新时再由 desktopProbe 校正。
 * - 订阅：KbSelectorDialog / ModelSelector / AIAssistantDialog 通过 subscribe 响应变化。
 */
import { loadGlobalSettings, saveGlobalSettings } from '../../utils/globalSettings.js'

export const DESKTOP_LOCAL_PROVIDER_ID = 'CHAYUAN_DESKTOP_LOCAL'
export const DESKTOP_BASE_URL = 'http://127.0.0.1:62581'
const SNAPSHOT_KEY = 'desktopIntegration'

const listeners = new Set()

function _defaultState() {
  return { online: false, baseUrl: DESKTOP_BASE_URL, localModels: [], modelsReady: false, checkedAt: null }
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
        localModels: Array.isArray(snap.localModels) ? snap.localModels : [],
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
      localModels: _state.localModels,
      modelsReady: _state.modelsReady,
      checkedAt: _state.checkedAt
    } })
  } catch (_) { /* ignore */ }
}

export function getState() { return { ..._state, localModels: _state.localModels.slice() } }

export function setState(partial) {
  _state = { ..._state, ...(partial || {}) }
  if (!Array.isArray(_state.localModels)) _state.localModels = []
  _persist()
  for (const fn of listeners) { try { fn(getState()) } catch (_) { /* ignore */ } }
  return getState()
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }

export function isOnline() { return !!_state.online }
export function getBaseUrl() { return _state.baseUrl || DESKTOP_BASE_URL }

/** 供模型下拉用：在线时返回本地对话模型 [{id,name}]，离线返回 [] */
export function getLocalModels() { return _state.online ? _state.localModels.slice() : [] }

export function _resetForTest() { _state = _defaultState() }
