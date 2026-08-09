/**
 * Proxy Streamable HTTP MCP calls to user-registered upstream servers.
 * Only URLs present in the allowlist (posted by the addon) may be contacted.
 */
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'

const sessions = new Map() // serverId -> { sessionId, url, headers, expiresAt }
const SESSION_TTL_MS = 30 * 60 * 1000
const DEFAULT_TIMEOUT_MS = 60_000

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '')
}

function isHttpUrl(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function fetchJson(url, { method = 'POST', headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  return new Promise((resolve, reject) => {
    let parsed
    try {
      parsed = new URL(url)
    } catch (e) {
      reject(Object.assign(new Error('INVALID_URL'), { code: 'INVALID_URL' }))
      return
    }
    const lib = parsed.protocol === 'https:' ? https : http
    const payload = body == null ? null : Buffer.from(JSON.stringify(body), 'utf8')
    const reqHeaders = {
      Accept: 'application/json, text/event-stream',
      ...headers,
      'Content-Type': 'application/json'
    }
    if (payload) reqHeaders['Content-Length'] = payload.length

    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers: reqHeaders
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          const sessionId = String(res.headers['mcp-session-id'] || '')
          let json = null
          if (text) {
            try {
              json = JSON.parse(text)
            } catch {
              json = { raw: text.slice(0, 2000) }
            }
          }
          resolve({
            status: res.statusCode || 0,
            sessionId,
            json,
            text
          })
        })
      }
    )
    req.setTimeout(timeoutMs, () => {
      req.destroy(Object.assign(new Error('UPSTREAM_TIMEOUT'), { code: 'UPSTREAM_TIMEOUT' }))
    })
    if (signal) {
      if (signal.aborted) {
        req.destroy(Object.assign(new Error('aborted'), { code: 'ABORTED' }))
        return
      }
      signal.addEventListener('abort', () => {
        req.destroy(Object.assign(new Error('aborted'), { code: 'ABORTED' }))
      }, { once: true })
    }
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function resolveTarget(allowlist, body) {
  const list = Array.isArray(allowlist) ? allowlist : []
  const serverId = String(body?.serverId || '').trim()
  const urlFromBody = normalizeUrl(body?.url)
  let entry = null
  if (serverId) {
    entry = list.find(s => String(s?.id || '') === serverId) || null
  }
  if (!entry && urlFromBody) {
    entry = list.find(s => normalizeUrl(s?.url) === urlFromBody) || null
  }
  if (!entry) {
    const err = new Error('UPSTREAM_NOT_ALLOWLISTED')
    err.code = 'UPSTREAM_NOT_ALLOWLISTED'
    throw err
  }
  const url = normalizeUrl(entry.url)
  if (!isHttpUrl(url)) {
    const err = new Error('INVALID_UPSTREAM_URL')
    err.code = 'INVALID_UPSTREAM_URL'
    throw err
  }
  return {
    id: String(entry.id || serverId || 'upstream'),
    url,
    headers: entry.headers && typeof entry.headers === 'object' ? { ...entry.headers } : {}
  }
}

async function ensureSession(target) {
  const cached = sessions.get(target.id)
  if (cached && cached.url === target.url && cached.expiresAt > Date.now() && cached.sessionId) {
    return cached
  }
  const init = await fetchJson(target.url, {
    headers: target.headers,
    body: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'chayuan-wps-upstream-proxy', version: '0.1.0' }
      }
    }
  })
  if (init.status >= 400) {
    const err = new Error(`UPSTREAM_INIT_FAILED:${init.status}`)
    err.code = 'UPSTREAM_INIT_FAILED'
    err.details = init.json
    throw err
  }
  const sessionId = init.sessionId || ''
  // notifications/initialized (ignore errors)
  try {
    await fetchJson(target.url, {
      headers: {
        ...target.headers,
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {})
      },
      body: {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {}
      }
    })
  } catch { /* ignore */ }

  const entry = {
    sessionId,
    url: target.url,
    headers: target.headers,
    expiresAt: Date.now() + SESSION_TTL_MS
  }
  sessions.set(target.id, entry)
  return entry
}

async function rpc(target, method, params, { signal } = {}) {
  const sess = await ensureSession(target)
  const res = await fetchJson(target.url, {
    signal,
    headers: {
      ...target.headers,
      ...(sess.sessionId ? { 'Mcp-Session-Id': sess.sessionId } : {})
    },
    body: {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params: params || {}
    }
  })
  if (res.sessionId) {
    sess.sessionId = res.sessionId
    sess.expiresAt = Date.now() + SESSION_TTL_MS
    sessions.set(target.id, sess)
  }
  if (res.status === 404 || (res.json?.error && /session/i.test(String(res.json.error.message || '')))) {
    sessions.delete(target.id)
  }
  if (res.status >= 400) {
    const err = new Error(`UPSTREAM_HTTP_${res.status}`)
    err.code = 'UPSTREAM_HTTP_ERROR'
    err.details = res.json
    throw err
  }
  if (res.json?.error) {
    const err = new Error(res.json.error.message || 'UPSTREAM_RPC_ERROR')
    err.code = res.json.error.code || 'UPSTREAM_RPC_ERROR'
    err.details = res.json.error
    throw err
  }
  return res.json?.result
}

export function createUpstreamProxy() {
  /** @type {Array<{id:string,url:string,headers?:object,name?:string}>} */
  let allowlist = []

  return {
    setAllowlist(list) {
      allowlist = Array.isArray(list)
        ? list
          .filter(s => s && isHttpUrl(normalizeUrl(s.url)))
          .map(s => ({
            id: String(s.id || '').trim(),
            name: String(s.name || s.id || '').trim(),
            url: normalizeUrl(s.url),
            headers: s.headers && typeof s.headers === 'object' ? { ...s.headers } : {}
          }))
          .filter(s => s.id && s.url)
        : []
      // drop sessions for removed servers
      for (const key of sessions.keys()) {
        if (!allowlist.some(s => s.id === key)) sessions.delete(key)
      }
      return { ok: true, count: allowlist.length }
    },
    getAllowlist() {
      return allowlist.map(s => ({ id: s.id, name: s.name, url: s.url }))
    },
    async probe(body) {
      const target = resolveTarget(allowlist, body)
      const result = await rpc(target, 'tools/list', {})
      const tools = Array.isArray(result?.tools) ? result.tools : []
      return {
        ok: true,
        serverId: target.id,
        url: target.url,
        toolCount: tools.length,
        tools: tools.slice(0, 30).map(t => ({ name: t.name, description: String(t.description || '').slice(0, 160) }))
      }
    },
    async listTools(body, opts) {
      const target = resolveTarget(allowlist, body)
      const result = await rpc(target, 'tools/list', {}, opts)
      return {
        serverId: target.id,
        tools: Array.isArray(result?.tools) ? result.tools : []
      }
    },
    async callTool(body, opts) {
      const target = resolveTarget(allowlist, body)
      const name = String(body?.name || '').trim()
      if (!name) {
        const err = new Error('TOOL_NAME_REQUIRED')
        err.code = 'TOOL_NAME_REQUIRED'
        throw err
      }
      const result = await rpc(target, 'tools/call', {
        name,
        arguments: body?.arguments && typeof body.arguments === 'object' ? body.arguments : {}
      }, opts)
      return {
        serverId: target.id,
        result
      }
    }
  }
}
