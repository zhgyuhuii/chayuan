/**
 * WPS Addon MCP Agent — HTTP long-poll client against sidecar.
 */
import {
  MCP_BASE_URL,
  MCP_DEFAULT_PORT,
  MCP_HEALTHZ_URL,
  MCP_PROTOCOL_VERSION,
  PLUGIN_STORAGE_AGENT_ID_KEY,
  PLUGIN_STORAGE_TOKEN_KEY,
  getAddonVersion
} from './config.js'
import { dispatchMcpJob } from './dispatch.js'

const POLL_TIMEOUT_SEC = 25
const HEARTBEAT_MS = 20_000
const RECONNECT_BASE_MS = 1500
const RECONNECT_MAX_MS = 20_000

let _running = false
let _agentId = ''
let _token = ''
let _loopPromise = null
let _heartbeatTimer = null
let _backoff = RECONNECT_BASE_MS
let _autoSpikeStarted = false

function storageGet(key) {
  try {
    return window.Application?.PluginStorage?.getItem?.(key)
  } catch {
    return null
  }
}

function storageSet(key, value) {
  try {
    window.Application?.PluginStorage?.setItem?.(key, value)
  } catch { /* ignore */ }
}

export function getStoredToken() {
  return String(storageGet(PLUGIN_STORAGE_TOKEN_KEY) || _token || '').trim()
}

export function setStoredToken(token) {
  _token = String(token || '').trim()
  if (_token) storageSet(PLUGIN_STORAGE_TOKEN_KEY, _token)
}

function ensureAgentId() {
  if (_agentId) return _agentId
  const existing = String(storageGet(PLUGIN_STORAGE_AGENT_ID_KEY) || '').trim()
  if (existing) {
    _agentId = existing
    return _agentId
  }
  _agentId = `wps-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  storageSet(PLUGIN_STORAGE_AGENT_ID_KEY, _agentId)
  return _agentId
}

async function fetchJson(url, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {})
  }
  // MCP/Agent: no token required (localhost-only sidecar)
  // 客户端超时：sidecar 在 25s 长轮询中途被杀时，半死 TCP 连接会让 fetch 永久挂起，
  // 卡死 loop() 的重连循环（catch 永远跑不到）。AbortController 到点必 abort → 抛错 → 退避重连。
  const timeoutMs = Number(options.timeoutMs) || 0
  let timer = null
  const init = { ...options, headers }
  if (timeoutMs > 0) {
    const controller = new AbortController()
    init.signal = controller.signal
    timer = setTimeout(() => controller.abort(), timeoutMs)
  }
  try {
    const res = await fetch(url, init)
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`)
      err.status = res.status
      err.data = data
      throw err
    }
    return data
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function probeSidecar() {
  try {
    const data = await fetchJson(MCP_HEALTHZ_URL, { method: 'GET', timeoutMs: 6000 })
    return { online: true, ...data }
  } catch {
    return { online: false }
  }
}

/**
 * Bootstrap token from sidecar (localhost bootstrap=1 once if we have no token).
 */
export async function syncTokenFromSidecar() {
  let token = getStoredToken()
  if (token) {
    _token = token
    return token
  }
  try {
    const data = await fetchJson(`${MCP_BASE_URL}/token?bootstrap=1`)
    if (data?.token) {
      setStoredToken(data.token)
      return data.token
    }
  } catch { /* ignore */ }
  return ''
}

async function register() {
  const agentId = ensureAgentId()
  await syncTokenFromSidecar()
  const body = {
    agentId,
    protocolVersion: MCP_PROTOCOL_VERSION,
    addonVersion: getAddonVersion(),
    windowId: String(window.name || 'ribbon')
  }
  const data = await fetchJson(`${MCP_BASE_URL}/agent/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: 12000
  })
  _backoff = RECONNECT_BASE_MS
  try {
    const { recordAgentAliveTick } = await import('./spikes.js')
    recordAgentAliveTick('register')
  } catch { /* ignore */ }
  scheduleAutoSelftest()
  return data
}

/**
 * After first successful register: run spikes once and POST /selftest/report
 * so external `npm run mcp:selftest` can discover results without clicking UI.
 */
function scheduleAutoSelftest() {
  if (_autoSpikeStarted) return
  _autoSpikeStarted = true
  setTimeout(async () => {
    try {
      const spikes = await import('./spikes.js')
      const results = await spikes.runMcpSpikes()
      const status = await getMcpBridgeStatus()
      await fetchJson(`${MCP_BASE_URL}/selftest/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'addon-auto',
          protocolVersion: MCP_PROTOCOL_VERSION,
          status,
          spikes: results,
          page: {
            href: String(window.location?.href || '').slice(0, 200),
            protocol: String(window.location?.protocol || '')
          }
        })
      })
      console.info('[mcpAgent] auto selftest report uploaded')
    } catch (e) {
      console.warn('[mcpAgent] auto selftest failed:', e?.message || e)
      try {
        await fetchJson(`${MCP_BASE_URL}/selftest/report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'addon-auto',
            error: e?.message || String(e)
          })
        })
      } catch { /* ignore */ }
    }
  }, 2500)
}

async function pollOnce() {
  const agentId = ensureAgentId()
  const url = `${MCP_BASE_URL}/agent/poll?agentId=${encodeURIComponent(agentId)}&timeout=${POLL_TIMEOUT_SEC}`
  // 客户端超时略大于服务端 25s 长轮询持有时间：健康轮询会在 25s 内正常返回；
  // sidecar 中途死亡则到 30s 强制 abort → 抛错 → loop() 退避重连（不再永久挂起）。
  return fetchJson(url, { method: 'GET', timeoutMs: (POLL_TIMEOUT_SEC + 5) * 1000 })
}

async function postResult(jobId, ok, result, error) {
  const agentId = ensureAgentId()
  return fetchJson(`${MCP_BASE_URL}/agent/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      jobId,
      ok,
      result: ok ? result : undefined,
      error: ok ? undefined : error
    }),
    timeoutMs: 30000
  })
}

const JOB_HARD_TIMEOUT_MS = 55_000
/**
 * Per-method hard timeout (ms). The default 55s is a blunt safeguard against
 * sync WPS API hangs that block the WebView event loop — but it is FAR too short
 * for LLM-bound operations (proofread iterates chunks and calls the model per
 * chunk; a large table doc of ~1700 entries easily exceeds 55s). Those ops are
 * almost entirely `await` (model HTTP / chunked reads) and yield the event loop,
 * so a longer cap is safe and is what unblocks big-document 校对/替换.
 * Keep dot-form keys (match dispatchMcpJob's `job.method`, e.g. 'proofread.run').
 */
const JOB_TIMEOUT_BY_METHOD = {
  'proofread.run': 300_000,
  'proofread.apply_comments': 300_000,
  'document.apply_ops': 180_000,
  'document.chunks': 180_000,
  'document.replace': 120_000,
  'document.insert': 120_000,
  'declassify.apply': 300_000,
  'declassify.restore': 120_000,
  'assistants.search': 120_000,
  'assistants.get': 180_000
}
function timeoutForJob(method) {
  return JOB_TIMEOUT_BY_METHOD[method] || JOB_HARD_TIMEOUT_MS
}

function withHardTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Agent handler timeout: ${label}`)
      err.code = 'AGENT_HANDLER_TIMEOUT'
      reject(err)
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function handleJob(job) {
  if (!job?.jobId) return
  try {
    // Note: sync WPS API hangs still block the event loop; avoid Documents.Item etc.
    const result = await withHardTimeout(
      Promise.resolve().then(() => dispatchMcpJob({ method: job.method, params: job.params })),
      timeoutForJob(job.method),
      job.method || 'job'
    )
    await postResult(job.jobId, true, result)
  } catch (e) {
    await postResult(job.jobId, false, null, {
      code: e.code || 'AGENT_JOB_FAILED',
      message: e.message || String(e),
      details: e.details
    })
  }
}

function startHeartbeat() {
  stopHeartbeat()
  _heartbeatTimer = setInterval(async () => {
    if (!_running) return
    try {
      await fetchJson(`${MCP_BASE_URL}/agent/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: ensureAgentId() }),
        timeoutMs: 10000
      })
      try {
        const { recordAgentAliveTick } = await import('./spikes.js')
        recordAgentAliveTick('heartbeat')
      } catch { /* ignore */ }
    } catch { /* reconnect loop will handle */ }
  }, HEARTBEAT_MS)
}

function stopHeartbeat() {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer)
    _heartbeatTimer = null
  }
}

async function loop() {
  while (_running) {
    try {
      const health = await probeSidecar()
      if (!health.online) {
        console.info('[mcpAgent] sidecar offline, retry…')
        await sleep(_backoff)
        _backoff = Math.min(_backoff * 1.5, RECONNECT_MAX_MS)
        continue
      }
      await register()
      startHeartbeat()
      while (_running) {
        const out = await pollOnce()
        if (out?.error?.code === 'AGENT_NOT_REGISTERED') {
          await register()
          continue
        }
        if (out?.job) {
          await handleJob(out.job)
        }
      }
    } catch (e) {
      console.warn('[mcpAgent] loop error:', e?.message || e)
      stopHeartbeat()
      await sleep(_backoff)
      _backoff = Math.min(_backoff * 1.5, RECONNECT_MAX_MS)
    }
  }
  stopHeartbeat()
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export function startMcpAgent() {
  if (_running) return _loopPromise
  _running = true
  console.info(`[mcpAgent] starting long-poll → ${MCP_BASE_URL} (port ${MCP_DEFAULT_PORT})`)
  _loopPromise = loop().finally(() => {
    _loopPromise = null
  })
  return _loopPromise
}

export function stopMcpAgent() {
  _running = false
  stopHeartbeat()
}

export function isMcpAgentRunning() {
  return _running
}

export async function getMcpBridgeStatus() {
  const health = await probeSidecar()
  return {
    agentRunning: _running,
    agentId: _agentId || String(storageGet(PLUGIN_STORAGE_AGENT_ID_KEY) || ''),
    tokenPresent: !!getStoredToken(),
    sidecar: health,
    mcpUrl: `${MCP_BASE_URL}/mcp`,
    protocolVersion: MCP_PROTOCOL_VERSION
  }
}

export default {
  startMcpAgent,
  stopMcpAgent,
  isMcpAgentRunning,
  probeSidecar,
  syncTokenFromSidecar,
  getMcpBridgeStatus,
  getStoredToken,
  setStoredToken
}
