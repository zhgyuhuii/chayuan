/**
 * Thin Streamable HTTP MCP client for local chayuan sidecar + upstream proxy.
 */
import { MCP_URL, MCP_BASE_URL, MCP_HEALTHZ_URL } from './config.js'
import {
  CHAYUAN_SERVER_ID,
  getUpstreamAllowlistPayload,
  getEnabledMcpServers
} from './mcpServerRegistry.js'

const PROTOCOL = '2025-03-26'

function abortError(signal) {
  if (signal?.aborted) {
    const err = new Error('aborted')
    err.name = 'AbortError'
    throw err
  }
}

const SIDECAR_OFFLINE_HINT =
  '本机 MCP sidecar（127.0.0.1:62588）未运行。请先在设置页点击「启动本机服务」，或在仓库根目录执行：npm run mcp:sidecar'

function networkErrorMessage(err) {
  const raw = String(err?.message || err || '')
  if (/Failed to fetch|NetworkError|ECONNREFUSED|abort|timeout|timed out/i.test(raw)) {
    return SIDECAR_OFFLINE_HINT
  }
  return raw || SIDECAR_OFFLINE_HINT
}

async function postJson(url, body, { headers = {}, signal, timeoutMs = 60000 } = {}) {
  abortError(signal)
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const onParent = () => ctrl?.abort()
  if (signal && ctrl) {
    if (signal.aborted) ctrl.abort()
    else signal.addEventListener('abort', onParent, { once: true })
  }
  const timer = timeoutMs > 0
    ? setTimeout(() => ctrl?.abort(), timeoutMs)
    : null
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers
      },
      body: JSON.stringify(body),
      signal: ctrl?.signal || signal
    })
    const sessionId = res.headers.get('Mcp-Session-Id') || res.headers.get('mcp-session-id') || ''
    const text = await res.text()
    let json = null
    if (text) {
      try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 2000) } }
    }
    return { ok: res.ok, status: res.status, sessionId, json, text }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      sessionId: '',
      json: { message: networkErrorMessage(e), error: 'NETWORK_ERROR' },
      text: ''
    }
  } finally {
    if (timer) clearTimeout(timer)
    if (signal && ctrl) signal.removeEventListener?.('abort', onParent)
  }
}

export async function healthz({ signal } = {}) {
  try {
    const res = await fetch(MCP_HEALTHZ_URL, { method: 'GET', signal })
    if (!res.ok) {
      return {
        ok: false,
        online: false,
        status: res.status,
        error: `healthz HTTP ${res.status}`
      }
    }
    const data = await res.json()
    return {
      ok: !!data?.ok,
      online: true,
      agentOnline: !!data?.agent?.agentOnline,
      data
    }
  } catch (e) {
    return { ok: false, online: false, error: networkErrorMessage(e) }
  }
}

let localSessionId = ''
let localRpcId = 1

async function localRpc(method, params = {}, { signal } = {}) {
  const headers = {}
  if (localSessionId) headers['Mcp-Session-Id'] = localSessionId
  const id = localRpcId++
  const res = await postJson(MCP_URL, {
    jsonrpc: '2.0',
    id,
    method,
    params
  }, { headers, signal })
  if (res.sessionId) localSessionId = res.sessionId
  if (!res.ok) {
    const err = new Error(res.json?.error?.message || `MCP HTTP ${res.status}`)
    err.code = 'MCP_HTTP_ERROR'
    err.details = res.json
    throw err
  }
  if (res.json?.error) {
    const err = new Error(res.json.error.message || 'MCP_RPC_ERROR')
    err.code = res.json.error.code || 'MCP_RPC_ERROR'
    err.details = res.json.error
    throw err
  }
  return res.json?.result
}

export async function initializeLocal({ signal } = {}) {
  localSessionId = ''
  const result = await localRpc('initialize', {
    protocolVersion: PROTOCOL,
    capabilities: {},
    clientInfo: { name: 'chayuan-wps-assistant-page', version: '0.1.0' }
  }, { signal })
  try {
    await postJson(MCP_URL, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    }, {
      headers: localSessionId ? { 'Mcp-Session-Id': localSessionId } : {},
      signal
    })
  } catch { /* ignore */ }
  return result
}

export async function listLocalTools({ signal } = {}) {
  if (!localSessionId) await initializeLocal({ signal })
  const result = await localRpc('tools/list', {}, { signal })
  return Array.isArray(result?.tools) ? result.tools : []
}

export async function callLocalTool(name, args = {}, { signal } = {}) {
  if (!localSessionId) await initializeLocal({ signal })
  return localRpc('tools/call', {
    name: String(name || ''),
    arguments: args && typeof args === 'object' ? args : {}
  }, { signal })
}

export async function syncUpstreamAllowlist({ signal } = {}) {
  const servers = getUpstreamAllowlistPayload()
  const res = await postJson(`${MCP_BASE_URL}/upstream/allowlist`, { servers }, { signal, timeoutMs: 15000 })
  if (!res.ok) {
    const err = new Error(res.json?.message || '同步上游 MCP 白名单失败')
    err.code = 'ALLOWLIST_SYNC_FAILED'
    throw err
  }
  return res.json
}

export async function probeUpstream(serverId, { signal } = {}) {
  await syncUpstreamAllowlist({ signal })
  const res = await postJson(`${MCP_BASE_URL}/upstream/probe`, { serverId }, { signal, timeoutMs: 30000 })
  if (!res.ok || res.json?.ok === false) {
    const err = new Error(res.json?.message || '上游测连失败')
    err.code = res.json?.error || 'UPSTREAM_PROBE_FAILED'
    err.details = res.json
    throw err
  }
  return res.json
}

/**
 * Probe builtin or upstream MCP and return tools for settings UI.
 * @param {{ id: string, url?: string, headers?: Record<string,string>, builtin?: boolean }} server
 */
export async function probeMcpServerDetail(server, { signal } = {}) {
  const id = String(server?.id || '').trim()
  const isBuiltin = !!server?.builtin || id === CHAYUAN_SERVER_ID
  if (isBuiltin) {
    const hz = await healthz({ signal })
    if (!hz.online) {
      return {
        ok: false,
        online: false,
        serverId: CHAYUAN_SERVER_ID,
        url: MCP_URL,
        toolCount: 0,
        tools: [],
        message: hz.error || SIDECAR_OFFLINE_HINT
      }
    }
    try {
      await initializeLocal({ signal })
      const tools = await listLocalTools({ signal })
      return {
        ok: true,
        online: true,
        serverId: CHAYUAN_SERVER_ID,
        url: MCP_URL,
        agentOnline: !!hz.agentOnline,
        toolCount: tools.length,
        tools: tools.map(t => ({
          name: t.name,
          description: String(t.description || ''),
          inputSchema: t.inputSchema || null
        })),
        message: hz.agentOnline ? '已连接（Agent 在线）' : '已连接（Agent 未注册）'
      }
    } catch (e) {
      return {
        ok: false,
        online: false,
        serverId: CHAYUAN_SERVER_ID,
        url: MCP_URL,
        toolCount: 0,
        tools: [],
        message: e?.message || '测连失败'
      }
    }
  }

  // Ensure draft/current server is in allowlist before probe
  const extras = getUpstreamAllowlistPayload().filter(s => s.id !== id)
  if (server?.url) {
    extras.push({
      id: id || 'draft',
      name: String(server.name || id || 'draft'),
      url: String(server.url).trim().replace(/\/+$/, ''),
      headers: server.headers && typeof server.headers === 'object' ? server.headers : {}
    })
  }
  const allowRes = await postJson(`${MCP_BASE_URL}/upstream/allowlist`, { servers: extras }, { signal, timeoutMs: 15000 })
  if (!allowRes.ok) {
    return {
      ok: false,
      online: false,
      serverId: id,
      url: server?.url || '',
      toolCount: 0,
      tools: [],
      message: allowRes.json?.message || '同步白名单失败（请先启动本机 sidecar）'
    }
  }
  const probeId = id || 'draft'
  try {
    const res = await postJson(`${MCP_BASE_URL}/upstream/probe`, { serverId: probeId }, { signal, timeoutMs: 30000 })
    if (!res.ok || res.json?.ok === false) {
      return {
        ok: false,
        online: false,
        serverId: probeId,
        url: server?.url || '',
        toolCount: 0,
        tools: [],
        message: res.json?.message || '上游测连失败'
      }
    }
    const tools = Array.isArray(res.json?.tools) ? res.json.tools : []
    // Prefer full list when available
    let fullTools = tools
    try {
      const listed = await listUpstreamTools(probeId, { signal })
      if (listed.length) fullTools = listed
    } catch { /* probe tools preview is enough */ }
    return {
      ok: true,
      online: true,
      serverId: probeId,
      url: server?.url || res.json?.url || '',
      toolCount: Number(res.json?.toolCount || fullTools.length || 0),
      tools: fullTools.map(t => ({
        name: t.name,
        description: String(t.description || ''),
        inputSchema: t.inputSchema || null
      })),
      message: `已连接 · ${Number(res.json?.toolCount || fullTools.length || 0)} 个工具`
    }
  } catch (e) {
    return {
      ok: false,
      online: false,
      serverId: probeId,
      url: server?.url || '',
      toolCount: 0,
      tools: [],
      message: e?.message || '上游测连失败'
    }
  }
}

export async function listUpstreamTools(serverId, { signal } = {}) {
  await syncUpstreamAllowlist({ signal })
  const res = await postJson(`${MCP_BASE_URL}/upstream/listTools`, { serverId }, { signal, timeoutMs: 30000 })
  if (!res.ok || res.json?.error) {
    const err = new Error(res.json?.message || '上游 tools/list 失败')
    err.code = res.json?.error || 'UPSTREAM_LIST_FAILED'
    throw err
  }
  return Array.isArray(res.json?.tools) ? res.json.tools : []
}

export async function callUpstreamTool(serverId, name, args = {}, { signal } = {}) {
  await syncUpstreamAllowlist({ signal })
  const res = await postJson(`${MCP_BASE_URL}/upstream/callTool`, {
    serverId,
    name,
    arguments: args && typeof args === 'object' ? args : {}
  }, { signal, timeoutMs: 120000 })
  if (!res.ok || res.json?.error) {
    const err = new Error(res.json?.message || '上游 tools/call 失败')
    err.code = res.json?.error || 'UPSTREAM_CALL_FAILED'
    err.details = res.json
    throw err
  }
  return res.json?.result
}

/**
 * Aggregate health for document-agent toggle.
 * green = chayuan online; yellow = only upstream usable; gray = none
 * @param {{ signal?: AbortSignal, ensureSidecar?: Function, deep?: boolean }} [opts]
 * deep=true probes each upstream (settings / manual refresh); send path uses shallow.
 */
export async function probeMcpHealthBundle({ signal, ensureSidecar, deep = false } = {}) {
  let health = await healthz({ signal })
  if (!health.online && typeof ensureSidecar === 'function') {
    try {
      await ensureSidecar()
      health = await healthz({ signal })
    } catch { /* ignore */ }
  }

  const enabled = getEnabledMcpServers()
  const chayuanEnabled = enabled.some(s => s.id === CHAYUAN_SERVER_ID)
  const upstreamEnabled = enabled.filter(s => s.id !== CHAYUAN_SERVER_ID)

  let chayuanOk = false
  if (chayuanEnabled && health.online) {
    try {
      await initializeLocal({ signal })
      chayuanOk = true
    } catch {
      chayuanOk = false
    }
  }

  let upstreamOkCount = 0
  const upstreamErrors = []
  if (health.online && upstreamEnabled.length) {
    try {
      await syncUpstreamAllowlist({ signal })
      if (deep) {
        for (const s of upstreamEnabled) {
          try {
            await probeUpstream(s.id, { signal })
            upstreamOkCount += 1
          } catch (e) {
            upstreamErrors.push({ id: s.id, message: e.message })
          }
        }
      } else {
        // Shallow: allowlist sync success + enabled upstreams count as tentatively ok
        upstreamOkCount = upstreamEnabled.length
      }
    } catch (e) {
      upstreamErrors.push({ id: '*', message: e.message })
    }
  }

  const anyOk = chayuanOk || upstreamOkCount > 0
  let level = 'gray'
  if (chayuanOk) level = 'green'
  else if (upstreamOkCount > 0) level = 'yellow'

  return {
    anyOk,
    level,
    chayuanOk,
    agentOnline: !!health.agentOnline,
    sidecarOnline: !!health.online,
    upstreamOkCount,
    upstreamTotal: upstreamEnabled.length,
    upstreamErrors,
    health
  }
}
