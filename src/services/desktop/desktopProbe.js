/**
 * desktopProbe — 探测本机「察元桌面版」并同步状态。
 * 只走稳定端口 62581：/healthz 探活 → /v1/models 列全部对话模型 → 确保本机 KB 连接。
 */
import { DESKTOP_BASE_URL, setState, getState } from './desktopStore.js'
import {
  listConnections, upsertConnection, getCurrentConnection, setCurrentConnection
} from '../kb/connectionStore.js'

const LOCAL_RUNTIMES = ['ollama', 'vllm', 'llamacpp', 'llama', 'xinference', 'auto']

/**
 * 从 /v1/models 响应解析"全部可用对话模型"，兼容 runtime / platform_name 两种字段形态。
 * 返回 [{ id, name, group }]：group 为分组键——本地运行时统一 'local'，云端用平台名。
 */
export function parseDesktopChatModels(data) {
  const list = Array.isArray(data?.data) ? data.data : []
  return list.filter(m => {
    if (!m || typeof m !== 'object') return false
    const cat = String(m.category || m.model_type || '').toLowerCase()
    const isChat = cat === '' || cat === 'llm' || cat === 'chat'
    if (!isChat) return false
    const status = String(m.status || '').toLowerCase()
    const available = m.available !== false && status !== 'broken' && status !== 'removed'
    return available
  }).map(m => {
    const runtime = String(m.runtime || '').toLowerCase()
    const platform = String(m.platform_name || '').toLowerCase()
    const isLocal = LOCAL_RUNTIMES.includes(runtime) || platform.startsWith('local')
    const group = isLocal ? 'local' : (platform || runtime || 'desktop')
    return { id: String(m.id), name: String(m.display_name || m.name || m.id), group }
  })
}

/** 确保存在一条指向桌面版的免登录 KB 连接；当前无连接时设为当前 */
export function ensureLocalKbConnection(baseUrl = DESKTOP_BASE_URL) {
  const norm = String(baseUrl).replace(/\/+$/, '')
  let conn = listConnections().find(
    c => String(c.baseUrl || '').replace(/\/+$/, '') === norm && c.authMode === 'none'
  )
  if (!conn) {
    conn = upsertConnection({
      id: 'kb-conn-desktop-local',
      name: '察元桌面版（本机）',
      baseUrl: norm,
      authMode: 'none',
      jwt: { username: '', ciphertext_password: '' },
      hmac: { appId: '', ciphertext_appSecret: '' }
    })
  }
  if (!getCurrentConnection()) setCurrentConnection(conn.id)
  return conn
}

async function _fetchWithTimeout(url, timeoutMs) {
  let ctrl = null
  let timer = null
  if (typeof AbortController !== 'undefined') {
    ctrl = new AbortController()
    timer = setTimeout(() => { try { ctrl.abort('timeout') } catch (_) { /* ignore */ } }, timeoutMs)
  }
  try {
    return await fetch(url, { signal: ctrl?.signal, credentials: 'omit' })
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * 探测桌面版。无论在线与否都会 setState 并返回最新状态。
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function detect({ timeoutMs = 2500 } = {}) {
  const baseUrl = DESKTOP_BASE_URL
  let online = false
  try {
    const resp = await _fetchWithTimeout(`${baseUrl}/healthz`, timeoutMs)
    online = !!resp && resp.ok
  } catch (_) { online = false }

  if (!online) {
    setState({ online: false, baseUrl, models: [], modelsReady: false, checkedAt: Date.now() })
    return getState()
  }

  let models = []
  try {
    const resp = await _fetchWithTimeout(`${baseUrl}/v1/models`, timeoutMs)
    if (resp && resp.ok) models = parseDesktopChatModels(await resp.json())
  } catch (_) { /* 模型拉取失败不影响在线判定 */ }

  try { ensureLocalKbConnection(baseUrl) } catch (_) { /* 连接写入失败不阻断 */ }

  setState({ online: true, baseUrl, models, modelsReady: models.length > 0, checkedAt: Date.now() })
  return getState()
}
