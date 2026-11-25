#!/usr/bin/env node
/* eslint-env node */
/**
 * chayuan-mcp sidecar
 * - Streamable HTTP MCP at /mcp
 * - Agent long-poll at /agent/*
 * - healthz at /healthz
 */
import http from 'node:http'
import fs from 'node:fs'
import { Readable } from 'node:stream'
// Node <18（Win7/8 回落运行时装 Node 14/16）补全局 fetch/AbortController；Node 18+ 零副作用
import './lib/fetchPolyfill.mjs'
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
import { writeMcpServerJson, findWpsExecutable, launchWps, openFileWithOs } from './lib/platformBridge.mjs'
import { createUpstreamProxy } from './lib/upstreamProxy.mjs'
import { imageSearchTool, generateImageTool, saveTmpImage } from './lib/imageTools.mjs'
import { listSkillPacks, saveSkillPack, removeSkillPack } from './lib/skillPackStore.mjs'
import { loadAppSettings, saveAppSettings } from './lib/appSettingsStore.mjs'
import { probeResource, saveWebResourcesConfig, loadWebResourcesConfig } from './lib/webResources.mjs'

const dataDir = ensureDataDir()
const token = loadOrCreateToken()
const port = getPort()
// audit 同时充当 sidecar 运行日志：agentHub 的 job 派发/结果/超时均写入 audit.jsonl，
// 与前端 logs/YYYY-M-D.log 双向印证（崩溃时 sidecar 侧最后 dispatch 的 method =
// WPS 内正在执行的调用，前端侧对应 job_start 无 job_end）
const audit = createAuditLog(dataDir)
const agentHub = createAgentHub({ logger: (entry) => audit.append(entry) })
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

function tryStopPid(pid) {
  if (!pid || pid === process.pid) return false
  try {
    process.kill(pid, 0)
  } catch {
    return false
  }
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    try { process.kill(pid) } catch { /* ignore */ }
  }
  const deadline = Date.now() + 2500
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0)
    } catch {
      return true
    }
    const waitUntil = Date.now() + 50
    while (Date.now() < waitUntil) { /* spin */ }
  }
  try { process.kill(pid, 'SIGKILL') } catch { /* ignore */ }
  return true
}

function acquireLock() {
  const lock = lockFilePath()
  try {
    if (fs.existsSync(lock)) {
      const prev = JSON.parse(fs.readFileSync(lock, 'utf8') || '{}')
      if (prev.pid && prev.pid !== process.pid) {
        let alive = false
        try {
          process.kill(prev.pid, 0)
          alive = true
        } catch {
          // stale lock
        }
        if (alive) {
          const prevPort = Number(prev.port) || 0
          // Port migration (e.g. 3920 → 62588): stop the old instance and take over.
          if (prevPort && prevPort !== port) {
            console.warn(
              `[chayuan-mcp] replacing old sidecar pid=${prev.pid} port=${prevPort} → ${port}`
            )
            tryStopPid(prev.pid)
          } else {
            console.error(`[chayuan-mcp] already running pid=${prev.pid} port=${prevPort || port}`)
            console.error(`[chayuan-mcp] dataDir=${dataDir}`)
            process.exit(2)
          }
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
    name: 'chayuan-wps-mcp',
    version: '0.1.0',
    url: `http://127.0.0.1:${port}${MCP_PATH}`,
    healthz: `http://127.0.0.1:${port}${HEALTHZ_PATH}`,
    dataDir,
    protocolVersion: PROTOCOL_VERSION,
    uptimeMs: Date.now() - startedAt,
    pid: process.pid
  }
}

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

/** 指定宿主的 agent 在线等待（template.* 宿主感知路由配套：doc→wps / 表格→et / 演示→wpp） */
async function waitForHostAgent(host, timeoutMs = 20000) {
  const start = Date.now()
  const h = String(host || '').toLowerCase()
  while (Date.now() - start < timeoutMs) {
    const st = agentHub.status()
    const hosts = st?.agent?.hosts || {}
    if (st.agentOnline && (h === 'any' || hosts[h])) return st
    await new Promise(r => setTimeout(r, 500))
  }
  return agentHub.status()
}

async function launchWpsAndWait(params = {}) {
  const waitAgentMs = Math.min(Math.max(Number(params.waitAgentMs) || 20000, 3000), 120000)
  const already = agentHub.status()
  const needHost = String(params.host || '').toLowerCase()
  const hostAlreadyOnline = already.agentOnline && (!needHost || (already?.agent?.hosts || {})[needHost])
  if (hostAlreadyOnline) {
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
  // host: 'wps'|'et'|'wpp' —— wps_launch 可指定拉起表格/演示组件（agentHub 按
  // 宿主分槽后，需要对应宿主的执行者在线才能操作 ET/WPP）
  const spawned = launchWps(exe, { host: params.host })
  if (!spawned.ok) {
    const err = new Error(spawned.error || 'WPS_SPAWN_FAILED')
    err.code = spawned.code || 'WPS_SPAWN_FAILED'
    throw err
  }
  const t0 = Date.now()
  const st = params.host
    ? await waitForHostAgent(params.host, waitAgentMs)
    : await waitForAgent(waitAgentMs)
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
  launchWpsAndWait,
  dataDir
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
 * 最小 token 鉴权（PR8）：sidecar 只绑 127.0.0.1，但本机任意进程都是等效客户端——
 * 此前 declassify_apply 可被直调且自选密码、/upstream/allowlist POST 无鉴权可把
 * sidecar 变成 SSRF 跳板、/agent/* 可被冒名提交假结果。现要求敏感路由携带
 * X-Chayuan-Token（与 dataDir/token 比对；页面/加载项经 Application.FileSystem
 * 同源读取该文件）。普通文档工具的 /mcp tools/call 仍开放给外部 MCP 客户端
 * （Claude Code 等走 preview→commit 协议合法使用 confirmed）。
 */
function isTrusted(req) {
  const header = String(req.headers['x-chayuan-token'] || '').trim()
  return !!header && header === token
}

/** 兼容旧调用点：开放路由恒过 */
function checkAuth(_req) {
  return true
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id, X-Chayuan-Token')
  // PUT 必须在列（session-store 写穿走 PUT；真机实证缺 PUT 时 CEF preflight
  // 直接拦截、面板 fire-and-forget 静默失败——写穿从未生效）
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
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

  const client = isTrusted(req) ? 'trusted' : 'anonymous'
  for (const msg of messages) {
    const out = await mcp.handleMessage(msg, { sessionId, client })
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
  // Agent 长轮询是 WPS 加载项专属通道：任意本机进程可注册假 agent / 提交假结果
  // 投毒工具调用，故整个 /agent/* 要求 token
  if (!isTrusted(req)) {
    // 拒绝留痕（排查「agent 离线但 sidecar 正常」的关键证据：401=客户端没拿到
    // token，常见于 http origin 的 dev 页面读不到 dataDir/token 文件）
    try {
      audit.append({
        ev: 'agent_rejected',
        route: pathname,
        ua: String(req.headers['user-agent'] || '').slice(0, 120),
        origin: String(req.headers['origin'] || '').slice(0, 120)
      })
    } catch { /* ignore */ }
    unauthorized(res)
    return
  }
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
      // bootstrap=1：为拿不到文件 token 的客户端（wpsjs debug 的 http origin 页面
      // 无法从 URL 推导家目录读 dataDir/token）发放真 token，解开 /agent/* 的注册
      // 死锁（2026-09-17 实锤：dev 模式 register 匿名 401 → agent 永远离线，
      // 而 healthz//mcp 开放 → 表现为「sidecar 正常但加载项未注册」）。
      // 安全等价：sidecar 仅绑 127.0.0.1，且 token 文件本机本就 -rw-r--r-- 可读；
      // token 防的是无本机文件能力的远程方（环回不可达），发放不降低防护。
      if (url.searchParams.get('bootstrap') === '1') {
        sendJson(res, 200, {
          url: getServerMeta().url,
          port,
          authRequired: true,
          token
        })
        return
      }
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
        // allowlist 决定 sidecar 可向哪些 http(s) 目标发请求（SSRF 面）：写入需 token
        if (!isTrusted(req)) {
          unauthorized(res)
          return
        }
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

    // 厂商请求转发（直连预检死厂商，如智谱 WAF 把 OPTIONS 短路成 200 空头）：WPS webview
    // 是浏览器环境、带 Authorization+JSON 必须预检，直连必死；本端点以 Node 进程代发
    // （无 CORS 概念），chayuan-office 桌面版同构机制的 sidecar 版。路径名沿用
    // /proxy/chat（兼容已发布调用方），语义已扩展为通用转发（method 可选，GET /v1/models
    // 探测同样适用）。
    // 门禁与 /clipboard 同级（token + 仅环回监听）；/upstream 那套 allowlist 不适配
    // 「用户可在设置里填任意厂商 URL」的形态，scheme 白名单 + token 门禁足够
    // （token 持有方经 /session-store 等路由本已有同等本地权限）。
    if (pathname === '/proxy/chat' && req.method === 'POST') {
      if (!isTrusted(req)) { unauthorized(res); return }
      const payload = (await readBody(req)) || {}
      let target
      try { target = new URL(String(payload?.url || '')) } catch {
        sendJson(res, 400, { error: 'bad_url', message: 'payload.url must be an absolute http(s) URL' })
        return
      }
      if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        sendJson(res, 400, { error: 'bad_scheme', message: 'only http/https upstream allowed' })
        return
      }
      const headers = { ...(payload?.headers && typeof payload.headers === 'object' ? payload.headers : {}) }
      // hop-by-hop 与自证头不过桥：host 由 fetch 自决，body 本侧已重新序列化
      for (const h of ['host', 'content-length', 'connection', 'x-chayuan-token']) delete headers[h]
      const method = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'].includes(String(payload?.method || '').toUpperCase())
        ? String(payload.method).toUpperCase()
        : 'POST'
      // body 本侧按 JSON 重发；调用方漏带 content-type 时（Node fetch 会默认
      // text/plain，部分厂商拒收）补 application/json 兜底。GET 探测无 body。
      const hasBody = payload?.body != null && method !== 'GET' && method !== 'HEAD'
      if (hasBody && !Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'application/json'
      }
      const ctrl = new AbortController()
      // 客户端断连（用户停止生成/超时 abort）→ 同步掐断上游；连接保活时
      // res 'close' 只在响应结束后触发，writableEnded 守卫避免误杀已完成请求
      res.on('close', () => { if (!res.writableEnded) { try { ctrl.abort() } catch { /* already aborted */ } } })
      let up
      try {
        up = await fetch(target, {
          method,
          headers,
          body: hasBody ? JSON.stringify(payload.body) : undefined,
          signal: ctrl.signal
        })
      } catch (e) {
        if (!res.headersSent) sendJson(res, 502, { error: 'upstream_unreachable', message: String(e?.message || e) })
        return
      }
      const contentType = (typeof up.headers?.get === 'function' && up.headers.get('content-type'))
        || (payload?.stream ? 'text/event-stream' : 'application/json')
      // 流式桥接仅在有 web body 流的运行时可用（Node>=17 / Bun）；Node 14/16 polyfill
      // 无 body 属性，回落全量缓冲（旧部署机失去逐字出字，不失去正确性）
      if (payload?.stream && up.body && typeof Readable.fromWeb === 'function') {
        res.writeHead(up.status, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' })
        Readable.fromWeb(up.body).on('error', () => res.destroy()).pipe(res)
      } else {
        const text = await up.text().catch(() => '')
        res.writeHead(up.status, { 'Content-Type': contentType })
        res.end(text)
      }
      return
    }

    if (pathname.startsWith('/agent/')) {
      await handleAgent(req, res, pathname)
      return
    }

    // 图像工具（三级生图）：image_search / generate_image 为侧车原生（无需 webview），
    // /tmp-image 承接 svg_add 光栅化产物的落盘（token 门禁与 /agent/* 同级）
    // 剪贴板读取（设置窗口粘贴按钮用）：webview 的 navigator.clipboard 在 CEF 里被
    // 权限拒绝（真机实证 NotAllowedError 且 catch 静默 = "点了没反应"），由 sidecar
    // 用系统命令读剪贴板（mac: pbpaste / win: clip / linux: xclip）
    if (pathname === '/clipboard' && req.method === 'GET') {
      if (!isTrusted(req)) { unauthorized(res); return }
      const { execFile } = await import('node:child_process')
      const plat = process.platform
      const read = () => new Promise((resolve) => {
        try {
          if (plat === 'darwin') execFile('pbpaste', [], { maxBuffer: 2 * 1024 * 1024, timeout: 3000 }, (e, out) => resolve(e ? '' : String(out)))
          else if (plat === 'win32') execFile('cmd', ['/c', 'clip'], { maxBuffer: 2 * 1024 * 1024, timeout: 3000 }, (e) => {
            // clip.exe 只能写；读用 powershell Get-Clipboard
            if (e) return resolve('')
            execFile('powershell', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], { maxBuffer: 2 * 1024 * 1024, timeout: 5000 }, (e2, out2) => resolve(e2 ? '' : String(out2)))
          })
          else execFile('xclip', ['-selection', 'clipboard', '-o'], { maxBuffer: 2 * 1024 * 1024, timeout: 3000 }, (e, out) => resolve(e ? '' : String(out)))
        } catch (_) { resolve('') }
      })
      const text = (await read()).slice(0, 64 * 1024)
      sendJson(res, 200, { text })
      return
    }
    // 会话历史持久层（I1 session-store）：PluginStorage 不持久化（真机实证），
    // webview 写穿此端点、缓存 miss 时回填（懒迁移）。scopeKey base64url 化
    // 落盘防路径穿越；单 scope ≤300KB 硬顶。
    if (pathname.startsWith('/session-store/') && (req.method === 'GET' || req.method === 'PUT')) {
      if (!isTrusted(req)) { unauthorized(res); return }
      const rawKey = decodeURIComponent(pathname.slice('/session-store/'.length))
      if (!rawKey || rawKey.length > 200) { sendJson(res, 400, { error: 'bad scopeKey' }); return }
      // 传输层硬顶（审查 P2-1）：content-length 预检，超限在进内存前拒绝
      if (req.method === 'PUT') {
        const declared = Number(req.headers['content-length'] || 0)
        if (declared > 400 * 1024) { sendJson(res, 413, { error: 'payload too large' }); return }
      }
      const { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } = await import('node:fs')
      const dir = path.join(dataDir, 'session-store')
      const file = path.join(dir, Buffer.from(rawKey, 'utf8').toString('base64url') + '.json')
      if (req.method === 'GET') {
        try {
          const payload = JSON.parse(readFileSync(file, 'utf8'))
          sendJson(res, 200, { exists: true, ...payload })
        } catch (_) {
          sendJson(res, 200, { exists: false })
        }
        return
      }
      const body = (await readBody(req)) || {}
      const historyJson = typeof body.historyJson === 'string' ? body.historyJson : '[]'
      if (historyJson.length > 300 * 1024) { sendJson(res, 413, { error: 'payload too large' }); return }
      const currentChatId = String(body.currentChatId || '').slice(0, 120)
      const savedAt = Number(body.savedAt) > 0 ? Number(body.savedAt) : Date.now()
      try {
        mkdirSync(dir, { recursive: true })
        // 写序保护（审查 P2-3）：拒绝旧于已存 savedAt 的写入——fire-and-forget
        // 并发到达顺序不定，旧数据不得覆盖新数据
        let existingSavedAt = 0
        try {
          existingSavedAt = Number(JSON.parse(readFileSync(file, 'utf8')).savedAt || 0)
        } catch (_) { /* 无既存文件 */ }
        if (existingSavedAt > savedAt) { sendJson(res, 200, { ok: false, skipped: 'stale' }); return }
        writeFileSync(file, JSON.stringify({ historyJson, currentChatId, savedAt }), 'utf8')
        // 数量上限（审查 P2-2）：与面板 30 键 LRU 对齐的服务端兜底，超 200 个
        // 按 mtime 驱逐最旧
        try {
          const files = readdirSync(dir).filter(x => x.endsWith('.json'))
          if (files.length > 200) {
            const withTime = files.map(x => ({ x, t: statSync(path.join(dir, x)).mtimeMs }))
            withTime.sort((p, q) => p.t - q.t)
            for (const { x } of withTime.slice(0, files.length - 200)) unlinkSync(path.join(dir, x))
          }
        } catch (_) { /* 清理失败不影响主流程 */ }
        sendJson(res, 200, { ok: true })
      } catch (e) {
        sendJson(res, 500, { error: String(e?.message || e) })
      }
      return
    }
    if (pathname === '/tmp-image' && req.method === 'POST') {
      if (!isTrusted(req)) { unauthorized(res); return }
      const body = (await readBody(req)) || {}
      sendJson(res, 200, saveTmpImage(dataDir, body))
      return
    }
    // GET /tmp-image/file?name=xx.png&token=..：向面板 webview 提供 tmp-images
    // 已落盘图片的 HTTP 直显/下载通道（面板读不到容器外 dataDir 路径，但
    // 127.0.0.1 的 img/fetch 没问题；token 走 query——img 标签不能带 header）
    if (pathname === '/tmp-image/file' && req.method === 'GET') {
      const u = new URL(req.url, 'http://x')
      const qToken = String(u.searchParams.get('token') || '').trim()
      if (!isTrusted(req) && (!qToken || qToken !== token)) { unauthorized(res); return }
      const { findTmpImageFile } = await import('./lib/imageTools.mjs')
      const file = findTmpImageFile(dataDir, u.searchParams.get('name') || '')
      if (!file) { sendJson(res, 404, { error: 'not found' }); return }
      const ext = (/\.([a-z0-9]+)$/i.exec(file)?.[1] || 'png').toLowerCase()
      const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }
      cors(res)
      res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600' })
      fs.createReadStream(file).pipe(res)
      return
    }
    // 附件落盘路径注册表（file_parse 的「附件N」别名源）：面板把非纯文本附件
    // materialize 到 数据目录/_temp 后登记（trusted），file_parse 按别名解析。
    if (pathname === '/attachments/register' && req.method === 'PUT') {
      if (!isTrusted(req)) { unauthorized(res); return }
      const body = (await readBody(req)) || {}
      const { createAttachmentRegistry } = await import('./lib/attachmentRegistry.mjs')
      sendJson(res, 200, createAttachmentRegistry({ dataDir }).register(body || {}))
      return
    }
    if (pathname === '/attachments/list' && req.method === 'GET') {
      if (!isTrusted(req)) { unauthorized(res); return }
      const { createAttachmentRegistry } = await import('./lib/attachmentRegistry.mjs')
      sendJson(res, 200, createAttachmentRegistry({ dataDir }).list())
      return
    }
    // 模板新建通路的 viaOs 兜底：webview（尤其 Mac 沙盒）无法 spawn，由 sidecar
    // 以用户双击等价的 OS 方式打开办公文档（扩展名白名单 + isTrusted 门禁）
    if (pathname === '/open-local-file' && req.method === 'POST') {
      if (!isTrusted(req)) { unauthorized(res); return }
      const body = (await readBody(req)) || {}
      sendJson(res, 200, openFileWithOs(String(body?.path || '')))
      return
    }
    // 网络资源搜索（设置：默认设置 → 网络资源搜索；三级生图 Tier2 的资源面）：
    //   /web-resources/config — 启用清单落盘 dataDir/web-resources.json（image_search 消费）
    //   /web-resources/test   — 按各资源协议发最小真实请求（设置页「测试」按钮）
    if (pathname === '/web-resources/config' && req.method === 'POST') {
      if (!isTrusted(req)) { unauthorized(res); return }
      const body = (await readBody(req)) || {}
      try {
        const clean = saveWebResourcesConfig(dataDir, body)
        sendJson(res, 200, { ok: true, count: clean.providers.length })
      } catch (e) {
        sendJson(res, 500, { ok: false, error: String(e?.message || e) })
      }
      return
    }
    if (pathname === '/web-resources/test' && req.method === 'POST') {
      if (!isTrusted(req)) { unauthorized(res); return }
      const body = (await readBody(req)) || {}
      try {
        sendJson(res, 200, await probeResource(String(body?.id || ''), {
          apiKey: String(body?.apiKey || ''),
          baseUrl: String(body?.baseUrl || '')
        }))
      } catch (e) {
        sendJson(res, 500, { ok: false, error: String(e?.message || e) })
      }
      return
    }
    if (pathname === '/web-resources/config' && req.method === 'GET') {
      if (!isTrusted(req)) { unauthorized(res); return }
      sendJson(res, 200, { ok: true, ...loadWebResourcesConfig(dataDir) })
      return
    }
    // 配置桥：把宿主侧用户设置（~/.config/chayuan/settings.json）暴露给加载项
    // webview 引导自身 localStorage——WPS 沙盒里 webview 直接读该文件不可靠，
    // 且 CEF 缓存清理会带走 localStorage（2026-09-30 实测模型配置丢失根因）。
    // 2026-11-21 起该文件成为配置磁盘真源（webview 保存时 POST /app-settings/save
    // 落盘，重装后经本端点拉回）。【不挂 token 门禁】——播种场景恰是重装后
    // localStorage 清空、token 引导链也可能为空，挂门禁会让恢复通道永久 401
    // （旧实现带 isTrusted 但 seedFromSidecar 不带 token = 播种从未工作过）。
    // 安全面与 /skillpack/* 同款：仅绑定 127.0.0.1。
    if (pathname === '/app-settings' && req.method === 'GET') {
      sendJson(res, 200, loadAppSettings())
      return
    }
    // 全局设置落盘（webview saveGlobalSettings 异步推送，整体 JSON 覆盖写）。
    // 覆盖语义与 webview 端一致：调用方先 load merge 再整体 POST。
    if (pathname === '/app-settings/save' && req.method === 'POST') {
      const body = (await readBody(req)) || {}
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(res, 400, { ok: false, error: 'body must be a JSON object' })
        return
      }
      sendJson(res, 200, { ok: true, ...saveAppSettings(body) })
      return
    }
    if (pathname === '/image/search' && req.method === 'POST') {
      if (!isTrusted(req)) { unauthorized(res); return }
      const body = (await readBody(req)) || {}
      sendJson(res, 200, await imageSearchTool(dataDir, body))
      return
    }
    if (pathname === '/image/generate' && req.method === 'POST') {
      if (!isTrusted(req)) { unauthorized(res); return }
      const body = (await readBody(req)) || {}
      sendJson(res, 200, await generateImageTool(dataDir, body))
      return
    }

    // 技能包磁盘存储（面板「我的技能」/技能市场下载落点）：PluginStorage 配额装
    // 不下真实技能包，存储层落到 sidecar 文件系统（dataDir/skills/<name>/）。
    // 不挂 token 门禁——与 /mcp tools/call、/app-settings 同款安全模型：
    // sidecar 仅绑 127.0.0.1，token 防的是环回不可达的远程方，本机 webview 的
    // token 引导（/token bootstrap 响应读取）在部分 webview 被 CORS 挡住，
    // 强制门禁会让「我的技能」在面板侧永远 401（2026-11-21 实证）。
    if (pathname === '/skillpack/list' && req.method === 'GET') {
      const packsNow = listSkillPacks(dataDir)
      sendJson(res, 200, { ok: true, packs: packsNow })
      return
    }
    if (pathname === '/skillpack/save' && req.method === 'POST') {
      const body = (await readBody(req)) || {}
      sendJson(res, 200, saveSkillPack(dataDir, body?.pack ?? body))
      return
    }
    if (pathname === '/skillpack/remove' && req.method === 'POST') {
      const body = (await readBody(req)) || {}
      sendJson(res, 200, removeSkillPack(dataDir, String(body?.name || '')))
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
  console.log(`[chayuan-mcp] auth     token-gated: /agent/*, /upstream/allowlist POST, declassify_* tools`)
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

// ── 心跳文件 ────────────────────────────────────────────────────────────────
// 供 WPS 加载项 webview 经 Application.FileSystem 读取（HTTP fetch 被 WPS
// jsaddons 安全层拦截时，这是唯一能区分「sidecar 没起」vs「环回被掐」的旁路
// 通道，见 2026-09-09 排障：jsaddinblockhost.ini 拉黑后 healthz fetch 全灭
// 而进程健在）。3s 一写，开销可忽略；写失败静默（如目录被删）。
const HEARTBEAT_FILE = path.join(dataDir, 'runtime', 'sidecar-heartbeat.json')
function writeHeartbeat() {
  try {
    fs.mkdirSync(path.dirname(HEARTBEAT_FILE), { recursive: true })
    fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify({
      at: Date.now(),
      pid: process.pid,
      port,
      startedAt
    }), 'utf-8')
  } catch { /* best-effort */ }
}
writeHeartbeat()
setInterval(writeHeartbeat, 3000).unref?.()
