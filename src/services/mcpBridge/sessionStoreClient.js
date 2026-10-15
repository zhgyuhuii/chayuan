/**
 * 会话历史持久层客户端（I1 session-store）。
 *
 * PluginStorage 在加载项关闭后不持久化（真机实证，globalSettings.js 注释），
 * sidecar /session-store/<scopeKey> 为 JSON 文件持久层：
 * - 写穿（write-through）：面板每次落盘 PluginStorage 后 fire-and-forget PUT，
 *   失败静默（sidecar 不可用时面板仍以 PluginStorage 内存副本工作——降级路径）
 * - 回填（懒迁移）：PluginStorage miss 时 GET 一次，命中则写回 PluginStorage
 * 全部带 X-Chayuan-Token（与 /clipboard、/agent/* 同级鉴权）。
 *
 * token 三通道（真机缺陷修复：WPS 重启后 PluginStorage 为空、agent 注册尚未
 * 播种、文件探针不可达——旧实现把空 token 永久缓存，整场会话所有写穿被 401
 * 拒绝=历史零落盘，退出 WPS 即全部丢失）：
 *   ① PluginStorage 播种键（agentClient 注册成功时写）
 *   ② Application.FileSystem 读 sidecar token 文件
 *   ③ 环回 bootstrap（GET /token?bootstrap=1，无鉴权）——agentClient.syncTokenFromSidecar
 * 空值永不缓存；401 视为 token 失效，清缓存重取并重试一次。
 */
import { readSidecarToken } from './webviewFsProbe.js'
import { syncTokenFromSidecar } from './agentClient.js'

const SIDECAR_BASE = 'http://127.0.0.1:62588'
let _cachedToken = null

function token() {
  // 只缓存非空 token：空值可能是"播种时序未到"而非真没有，每次重新解析
  if (_cachedToken) return _cachedToken
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

async function ensureToken() {
  const direct = token()
  if (direct) return direct
  // 第三条：环回 bootstrap 直取（无需鉴权）并回写播种（与 agentClient 注册链路同源）
  try {
    const bootstrapped = await syncTokenFromSidecar()
    if (bootstrapped) {
      _cachedToken = String(bootstrapped).trim()
      return _cachedToken
    }
  } catch (_) { /* sidecar 未起：由调用方按无 token 降级重试 */ }
  return token()
}

function invalidateToken() {
  _cachedToken = null
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

async function putWithRetry(scopeKey, body) {
  const res = await fetch(url(scopeKey), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body)
  })
  // 401 = token 失效（缓存了空/旧值）：清缓存重取重试一次
  if (res.status === 401) {
    invalidateToken()
    await ensureToken()
    return fetch(url(scopeKey), {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body)
    })
  }
  return res
}

/** 写穿：失败静默（降级——面板继续用 PluginStorage） */
export function putSessionStore(scopeKey, { historyJson, currentChatId }) {
  ;(async () => {
    try {
      const tk = await ensureToken()
      ssDebug({ op: 'put', scope: String(scopeKey).slice(0, 30), token: tk ? 'yes' : 'NO', bytes: (historyJson || '').length })
      if (!tk) {
        ssDebug({ op: 'put-skip', reason: 'no-token' })
        return
      }
      // savedAt 单调写序：服务端拒旧（fire-and-forget 乱序到达时旧不盖新）
      const body = { historyJson: historyJson || '[]', currentChatId: currentChatId || '', savedAt: Date.now() }
      const res = await putWithRetry(scopeKey, body)
      ssDebug({ op: 'put-resp', status: res.status, ok: res.ok })
    } catch (e) {
      ssDebug({ op: 'put-err', error: String(e?.message || e).slice(0, 80) })
    }
  })()
}

/**
 * 回填：PluginStorage miss 时查询持久层。
 * @returns {Promise<{historyJson:string, currentChatId:string}|null>} 未命中/不可用返回 null
 */
export async function fetchSessionStore(scopeKey) {
  try {
    const tk = await ensureToken()
    if (!tk) return null
    let res = await fetch(url(scopeKey), { headers: headers() })
    if (res.status === 401) {
      invalidateToken()
      await ensureToken()
      res = await fetch(url(scopeKey), { headers: headers() })
    }
    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.exists !== true) return null
    const historyJson = String(data.historyJson || '[]')
    if (!historyJson || historyJson === '[]') return null
    return {
      historyJson,
      currentChatId: String(data.currentChatId || ''),
      savedAt: Number(data.savedAt || 0)
    }
  } catch (_) {
    return null
  }
}
