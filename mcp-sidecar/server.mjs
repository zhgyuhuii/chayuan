#!/usr/bin/env node
/**
 * chayuan-mcp sidecar
 * - Streamable HTTP MCP at /mcp
 * - Agent long-poll at /agent/*
 * - healthz at /healthz
 */
import http from 'node:http'
import fs from 'node:fs'
import {
  ensureDataDir,
  getDataDir,
  getPort,
  loadOrCreateToken,
  lockFilePath,
  HEALTHZ_PATH,
  MCP_PATH,
  PROTOCOL_VERSION,
  DEFAULT_PORT
} from './lib/config.mjs'
import path from 'node:path'
import { createAgentHub } from './lib/agentHub.mjs'
import { createMcpHandler } from './lib/mcpHandler.mjs'
import { isWebSocketUpgrade, acceptWebSocket } from './lib/miniWs.mjs'
import { createAuditLog } from './lib/auditLog.mjs'
import { writeMcpServerJson, findWpsExecutable, launchWps } from './lib/platformBridge.mjs'
import { createUpstreamProxy } from './lib/upstreamProxy.mjs'

const dataDir = ensureDataDir()
const token = loadOrCreateToken()
const port = getPort()
const agentHub = createAgentHub()
const startedAt = Date.now()
/** @type {Array<{ at: number, source: string }>} */
const spikeMarkers = []
/** @type {null | object} */
let selftestReport = null
const selftestReportPath = () => path.join(dataDir, 'selftest-report.json')

function loadSelftestReport() {
  try {
    if (fs.existsSync(selftestReportPath())) {
      selftestReport = JSON.parse(fs.readFileSync(selftestReportPath(), 'utf8'))
    }
  } catch { /* ignore */ }
}
loadSelftestReport()

function saveSelftestReport(report) {
  selftestReport = { ...report, savedAt: Date.now() }
  try {
    fs.writeFileSync(selftestReportPath(), JSON.stringify(selftestReport, null, 2), 'utf8')
  } catch (e) {
    console.warn('[chayuan-mcp] selftest report save failed:', e.message)
  }
  return selftestReport
}

function spikesDir() {
  const dir = path.join(dataDir, 'spikes')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function readDiskMarkers() {
  try {
    const dir = spikesDir()
    return fs.readdirSync(dir)
      .filter(n => n.startsWith('marker-'))
      .map(n => {
        const full = path.join(dir, n)
        const st = fs.statSync(full)
        return { name: n, mtimeMs: st.mtimeMs }
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, 20)
  } catch {
    return []
  }
}

function acquireLock() {
  const lock = lockFilePath()
  try {
    if (fs.existsSync(lock)) {
      const prev = JSON.parse(fs.readFileSync(lock, 'utf8') || '{}')
      if (prev.pid && prev.pid !== process.pid) {
        try {
          process.kill(prev.pid, 0)
          console.error(`[chayuan-mcp] already running pid=${prev.pid} port=${prev.port || port}`)
          console.error(`[chayuan-mcp] dataDir=${dataDir}`)
          process.exit(2)
        } catch {
          // stale lock
        }
      }
    }
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, port, startedAt }, null, 2), 'utf8')
  } catch (e) {
    console.warn('[chayuan-mcp] lock write failed:', e.message)
  }
  const cleanup = () => {
    try {
      if (fs.existsSync(lock)) {
        const cur = JSON.parse(fs.readFileSync(lock, 'utf8') || '{}')
        if (cur.pid === process.pid) fs.unlinkSync(lock)
      }
    } catch { /* ignore */ }
  }
  process.on('exit', cleanup)
  process.on('SIGINT', () => { cleanup(); process.exit(0) })
  process.on('SIGTERM', () => { cleanup(); process.exit(0) })
}

function getServerMeta() {
  return {
    name: 'chayuan-wps',
    version: '0.1.0',
    url: `http://127.0.0.1:${port}${MCP_PATH}`,
    healthz: `http://127.0.0.1:${port}${HEALTHZ_PATH}`,
    dataDir,
    protocolVersion: PROTOCOL_VERSION,
    uptimeMs: Date.now() - startedAt,
    pid: process.pid
  }
}

const audit = createAuditLog(dataDir)
const mcpServerMeta = writeMcpServerJson(dataDir, port)
console.log(`[chayuan-mcp] mcp-server.json → ${mcpServerMeta.file}`)

async function waitForAgent(timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const st = agentHub.status()
    if (st.agentOnline) return st
    await new Promise(r => setTimeout(r, 500))
  }
  return agentHub.status()
}

async function launchWpsAndWait(params = {}) {
  const waitAgentMs = Math.min(Math.max(Number(params.waitAgentMs) || 20000, 3000), 120000)
  const already = agentHub.status()
  if (already.agentOnline) {
    // Avoid trusting a zombie registration after WPS was killed.
    try {
      await agentHub.callAgent('wps.status', {}, { timeoutMs: 5_000 })
      return {
        wpsRunning: true,
        agentOnline: true,
        launched: false,
        elapsedMs: 0,
        exe: mcpServerMeta.config.wpsExecutable || findWpsExecutable(mcpServerMeta.file)
      }
    } catch {
      // fall through — spawn / wait for a fresh Agent
    }
  }
  const exe = params.exe || mcpServerMeta.config.wpsExecutable || findWpsExecutable(mcpServerMeta.file)
  const spawned = launchWps(exe)
  if (!spawned.ok) {
    const err = new Error(spawned.error || 'WPS_SPAWN_FAILED')
    err.code = spawned.code || 'WPS_SPAWN_FAILED'
    throw err
  }
  const t0 = Date.now()
  const st = await waitForAgent(waitAgentMs)
  const result = {
    wpsRunning: !!st.agentOnline,
    agentOnline: !!st.agentOnline,
    launched: true,
    pid: spawned.pid,
    exe: spawned.exe,
    elapsedMs: Date.now() - t0
  }
  if (!st.agentOnline) {
    const err = new Error('WPS started but Agent did not connect in time — check add-in loaded')
    err.code = 'AGENT_CONNECT_TIMEOUT'
    err.details = result
    throw err
  }
  audit.append({ tool: 'wps_launch', ...result })
  return result
}

const mcp = createMcpHandler({
  agentHub,
  getServerMeta,
  audit,
  launchWpsAndWait
})
const upstreamProxy = createUpstreamProxy()

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(null)
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(Object.assign(new Error('Invalid JSON'), { code: -32700 }))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, body, headers = {}) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    ...headers
  })
  res.end(data)
}

function unauthorized(res) {
  sendJson(res, 401, { error: 'unauthorized' })
}

/**
 * Auth disabled by product decision: clients connect with URL only.
 * Sidecar binds 127.0.0.1 — localhost boundary is the trust model.
 * Optional Bearer/token still accepted for backward compatibility, never required.
 */
function checkAuth(_req) {
  return true
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id, X-Chayuan-Token')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id')
}

async function handleMcp(req, res) {
  if (req.method === 'GET') {
    // Minimal SSE keepalive for clients that expect it
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    res.write(': ok\n\n')
    const t = setInterval(() => {
      try { res.write(': ping\n\n') } catch { clearInterval(t) }
    }, 15000)
    req.on('close', () => clearInterval(t))
    return
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' })
    return
  }

  let body
  try {
    body = await readBody(req)
  } catch {
    sendJson(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null })
    return
  }

  const sessionHeader = String(req.headers['mcp-session-id'] || '')
  const messages = Array.isArray(body) ? body : [body]
  const responses = []
  let sessionId = sessionHeader || ''

  for (const msg of messages) {
    const out = await mcp.handleMessage(msg, { sessionId })
    if (out?.sessionId) sessionId = out.sessionId
    if (out?.notification) continue
    if (out?.error) {
      responses.push({ jsonrpc: '2.0', id: out.id ?? msg?.id ?? null, error: out.error })
    } else if (out?.result !== undefined) {
      responses.push({ jsonrpc: '2.0', id: out.id ?? msg?.id ?? null, result: out.result })
    }
  }

  const headers = {}
  if (sessionId) headers['Mcp-Session-Id'] = sessionId

  if (responses.length === 0) {
    res.writeHead(202, headers)
    res.end()
    return
  }
  if (responses.length === 1 && !Array.isArray(body)) {
    sendJson(res, 200, responses[0], headers)
    return
  }
  sendJson(res, 200, responses, headers)
}

async function handleAgent(req, res, pathname) {
  if (pathname === '/agent/register' && req.method === 'POST') {
    const body = (await readBody(req)) || {}
    sendJson(res, 200, agentHub.register(body))
    return
  }
  if (pathname === '/agent/heartbeat' && req.method === 'POST') {
    const body = (await readBody(req)) || {}
    sendJson(res, 200, agentHub.heartbeat(body.agentId))
    return
  }
  if (pathname === '/agent/poll' && req.method === 'GET') {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const agentId = url.searchParams.get('agentId') || ''
    const timeout = Number(url.searchParams.get('timeout') || 25)
    const out = await agentHub.poll(agentId, timeout * 1000)
    sendJson(res, 200, out)
    return
  }
  if (pathname === '/agent/result' && req.method === 'POST') {
    const body = (await readBody(req)) || {}
    sendJson(res, 200, agentHub.submitResult(body))
    return
  }
  if (pathname === '/agent/status' && req.method === 'GET') {
    sendJson(res, 200, agentHub.status())
    return
  }
  sendJson(res, 404, { error: 'not_found' })
}

acquireLock()

const server = http.createServer(async (req, res) => {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
  const pathname = url.pathname

  try {
    if (pathname === HEALTHZ_PATH) {
      sendJson(res, 200, {
        ok: true,
        ...getServerMeta(),
        agent: agentHub.status()
      })
      return
    }

    // Connection info for settings page (URL only; token optional legacy field)
    if (pathname === '/token' && req.method === 'GET') {
      sendJson(res, 200, {
        url: getServerMeta().url,
        port,
        authRequired: false,
        // legacy: still expose file token if present, but clients must not require it
        token: null
      })
      return
    }

    if (pathname === MCP_PATH) {
      await handleMcp(req, res)
      return
    }

    // Upstream HTTP MCP proxy (allowlisted URLs only; for in-page multi-MCP client)
    if (pathname.startsWith('/upstream/')) {
      if (pathname === '/upstream/allowlist' && req.method === 'POST') {
        const body = (await readBody(req)) || {}
        sendJson(res, 200, upstreamProxy.setAllowlist(body.servers || body.allowlist || []))
        return
      }
      if (pathname === '/upstream/allowlist' && req.method === 'GET') {
        sendJson(res, 200, { ok: true, servers: upstreamProxy.getAllowlist() })
        return
      }
      if (pathname === '/upstream/probe' && req.method === 'POST') {
        try {
          const body = (await readBody(req)) || {}
          sendJson(res, 200, await upstreamProxy.probe(body))
        } catch (e) {
          sendJson(res, 400, { ok: false, error: e.code || 'UPSTREAM_PROBE_FAILED', message: e.message, details: e.details })
        }
        return
      }
      if (pathname === '/upstream/listTools' && req.method === 'POST') {
        try {
          const body = (await readBody(req)) || {}
          sendJson(res, 200, await upstreamProxy.listTools(body))
        } catch (e) {
          sendJson(res, 400, { ok: false, error: e.code || 'UPSTREAM_LIST_FAILED', message: e.message, details: e.details })
        }
        return
      }
      if (pathname === '/upstream/callTool' && req.method === 'POST') {
        try {
          const body = (await readBody(req)) || {}
          sendJson(res, 200, await upstreamProxy.callTool(body))
        } catch (e) {
          sendJson(res, 400, { ok: false, error: e.code || 'UPSTREAM_CALL_FAILED', message: e.message, details: e.details })
        }
        return
      }
      sendJson(res, 404, { error: 'not_found', hint: 'POST /upstream/allowlist|probe|listTools|callTool' })
      return
    }

    if (pathname.startsWith('/agent/')) {
      await handleAgent(req, res, pathname)
      return
    }

    // Selftest report from WPS Agent (spikes + discovery)
    if (pathname === '/selftest/report') {
      if (req.method === 'POST') {
        const body = (await readBody(req)) || {}
        const saved = saveSelftestReport({
          ...body,
          receivedAt: Date.now(),
          agent: agentHub.status()
        })
        sendJson(res, 200, { ok: true, report: saved })
        return
      }
      if (req.method === 'GET') {
        sendJson(res, 200, {
          ok: true,
          report: selftestReport,
          agent: agentHub.status(),
          server: getServerMeta()
        })
        return
      }
    }

    // Spike marker: ShellExecute helper posts here / settings polls GET
    if (pathname === '/spike/marker') {
      if (req.method === 'POST') {
        const body = (await readBody(req)) || {}
        const entry = { at: Date.now(), source: String(body.source || 'http') }
        spikeMarkers.unshift(entry)
        if (spikeMarkers.length > 50) spikeMarkers.length = 50
        try {
          fs.writeFileSync(
            path.join(spikesDir(), `marker-http-${entry.at}.txt`),
            JSON.stringify(entry),
            'utf8'
          )
        } catch { /* ignore */ }
        sendJson(res, 200, { ok: true, entry })
        return
      }
      if (req.method === 'GET') {
        // GET allows bootstrap for local spike UI (still localhost-only bind)
        sendJson(res, 200, {
          ok: true,
          markers: [...spikeMarkers],
          diskMarkers: readDiskMarkers()
        })
        return
      }
    }

    sendJson(res, 404, { error: 'not_found', hint: 'MCP at /mcp, health at /healthz' })
  } catch (e) {
    console.error('[chayuan-mcp]', e)
    sendJson(res, 500, { error: e.message || String(e) })
  }
})

server.on('upgrade', (req, socket, head) => {
  socket.on('error', () => {
    try { socket.destroy() } catch { /* ignore */ }
  })
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
    if (url.pathname !== '/agent-ws' || !isWebSocketUpgrade(req)) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
      socket.destroy()
      return
    }
    // Spike WS is intentionally open on localhost for capability probe
    acceptWebSocket(req, socket, head)
  } catch (e) {
    console.warn('[chayuan-mcp] ws upgrade failed:', e.message)
    try { socket.destroy() } catch { /* ignore */ }
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`[chayuan-mcp] listening http://127.0.0.1:${port}`)
  console.log(`[chayuan-mcp] MCP      http://127.0.0.1:${port}${MCP_PATH}`)
  console.log(`[chayuan-mcp] healthz  http://127.0.0.1:${port}${HEALTHZ_PATH}`)
  console.log(`[chayuan-mcp] WS spike ws://127.0.0.1:${port}/agent-ws`)
  console.log(`[chayuan-mcp] dataDir  ${dataDir}`)
  console.log(`[chayuan-mcp] auth     none (URL only; localhost bind)`)
  console.log(`[chayuan-mcp] protocol ${PROTOCOL_VERSION}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[chayuan-mcp] port ${port || DEFAULT_PORT} in use`)
    process.exit(3)
  }
  console.error(err)
  process.exit(1)
})
