/**
 * 会话历史持久层客户端（I1 session-store）。
 *
 * PluginStorage 在加载项关闭后不持久化（真机实证，globalSettings.js 注释），
 * sidecar /session-store/<scopeKey> 为 JSON 文件持久层：
 * - 写穿（write-through）：面板每次落盘 PluginStorage 后 fire-and-forget PUT，
 *   失败静默（sidecar 不可用时面板仍以 PluginStorage 内存副本工作——降级路径）
 * - 回填（懒迁移）：PluginStorage miss 时 GET 一次，命中则写回 PluginStorage
 * 全部带 X-Chayuan-Token（与 /clipboard、/agent/* 同级鉴权）。
 */
import { readSidecarToken } from './webviewFsProbe.js'

const SIDECAR_BASE = 'http://127.0.0.1:62588'
let _cachedToken = null

function token() {
  if (_cachedToken !== null) return _cachedToken
  try {
    _cachedToken = readSidecarToken() || ''
  } catch (_) {
    _cachedToken = ''
  }
  return _cachedToken
}

function url(scopeKey) {
  return `${SIDECAR_BASE}/session-store/${encodeURIComponent(scopeKey)}`
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Chayuan-Token': token()
  }
}

/** 写穿：失败静默（降级——面板继续用 PluginStorage） */
export function putSessionStore(scopeKey, { historyJson, currentChatId }) {
  try {
    fetch(url(scopeKey), {
      method: 'PUT',
      headers: headers(),
      // savedAt 单调写序：服务端拒旧（fire-and-forget 乱序到达时旧不盖新）
      body: JSON.stringify({ historyJson: historyJson || '[]', currentChatId: currentChatId || '', savedAt: Date.now() })
    }).catch(() => { /* sidecar 不可用：静默降级 */ })
  } catch (_) { /* fetch 本身不可用：静默降级 */ }
}

/**
 * 回填：PluginStorage miss 时查询持久层。
 * @returns {Promise<{historyJson:string, currentChatId:string}|null>} 未命中/不可用返回 null
 */
export async function fetchSessionStore(scopeKey) {
  try {
    const res = await fetch(url(scopeKey), { headers: headers() })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.exists !== true) return null
    const historyJson = String(data.historyJson || '[]')
    if (!historyJson || historyJson === '[]') return null
    return { historyJson, currentChatId: String(data.currentChatId || '') }
  } catch (_) {
    return null
  }
}
