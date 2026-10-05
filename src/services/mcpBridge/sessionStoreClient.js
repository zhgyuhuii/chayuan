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
  // 双通道（真机实证面板 webview 的 FS 探针常读不到 token 文件）：
  // ①agentClient register 成功时播种的 PluginStorage 键 ②token 文件兜底
  try {
    _cachedToken = String(window.Application?.PluginStorage?.getItem('mcp_sidecar_token') || '').trim() || ''
  } catch (_) {
    _cachedToken = ''
  }
  if (!_cachedToken) {
    try {
      _cachedToken = readSidecarToken() || ''
    } catch (_) {
      _cachedToken = ''
    }
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
/** 诊断日志：写穿链路可观测（fetch 尝试/结果落 PluginStorage，vars_probe
 *  phase=log key=ss_debug 可带出）——真机排障用 */
function ssDebug(entry) {
  try {
    const ps = window.Application?.PluginStorage
    if (!ps) return
    const raw = ps.getItem('ss_debug')
    const arr = raw ? (JSON.parse(raw) || []) : []
    arr.push({ t: Date.now(), ...entry })
    ps.setItem('ss_debug', JSON.stringify(arr.slice(-20)))
  } catch (_) { /* ignore */ }
}

export function putSessionStore(scopeKey, { historyJson, currentChatId }) {
  try {
    const tk = token()
    ssDebug({ op: 'put', scope: String(scopeKey).slice(0, 30), token: tk ? 'yes' : 'NO', bytes: (historyJson || '').length })
    fetch(url(scopeKey), {
      method: 'PUT',
      headers: headers(),
      // savedAt 单调写序：服务端拒旧（fire-and-forget 乱序到达时旧不盖新）
      body: JSON.stringify({ historyJson: historyJson || '[]', currentChatId: currentChatId || '', savedAt: Date.now() })
    }).then(
      (res) => ssDebug({ op: 'put-resp', status: res.status, ok: res.ok }),
      (err) => ssDebug({ op: 'put-err', error: String(err?.message || err).slice(0, 80) })
    ).catch(() => { /* sidecar 不可用：静默降级 */ })
  } catch (e) {
    ssDebug({ op: 'put-throw', error: String(e?.message || e).slice(0, 80) })
  }
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
