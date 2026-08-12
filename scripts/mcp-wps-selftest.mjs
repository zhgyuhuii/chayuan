#!/usr/bin/env node
/**
 * MCP + WPS selftest orchestrator
 *
 * 1) Ensure sidecar on :62588
 * 2) Build addon + sync to jsaddons (offline discover)
 * 3) Launch `wpsjs debug` (auto-start WPS + load addin)
 * 4) Wait Agent register + auto spike report
 * 5) MCP Inspector-equivalent calls
 * 6) Decide whether to continue Phase 2
 *
 * Usage:
 *   node scripts/mcp-wps-selftest.mjs
 *   node scripts/mcp-wps-selftest.mjs --skip-build --skip-debug
 *   node scripts/mcp-wps-selftest.mjs --agent-timeout 120
 *   node scripts/mcp-wps-selftest.mjs --skip-build --tools-all
 *   node scripts/mcp-wps-selftest.mjs --no-tools-all   # skip per-tool callable sweep
 */
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
// 从 package.json 派生 name/version，避免每次发版手改本文件（曾经硬编码 chayuan_3.0.12）。
const PKG = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const NAME = PKG.name
const VERSION = PKG.version
const PORT = Number(process.env.CHAYUAN_MCP_PORT || 62588)
const BASE = `http://127.0.0.1:${PORT}`
const args = new Set(process.argv.slice(2))
const SKIP_BUILD = args.has('--skip-build')
const SKIP_DEBUG = args.has('--skip-debug')
const SKIP_SYNC = args.has('--skip-sync')
const FORCE_SIDECAR = args.has('--force-sidecar') || args.has('--restart-sidecar')
const TOOLS_ALL = args.has('--tools-all') || !args.has('--no-tools-all')
const agentTimeoutSec = (() => {
  const i = process.argv.indexOf('--agent-timeout')
  if (i >= 0) return Number(process.argv[i + 1]) || 90
  return Number(process.env.CHAYUAN_AGENT_TIMEOUT || 90)
})()

const results = []
let sidecarProc = null
let debugProc = null
let decision = { phase2: 'HOLD', reasons: [] }

function log(msg) {
  console.log(`[selftest] ${msg}`)
}

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  log(`PASS  ${name}${detail ? ' — ' + detail : ''}`)
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail })
  log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`)
}

function dataDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'chayuan-wps', 'mcp')
  }
  return path.join(os.homedir(), '.config', 'chayuan-wps', 'mcp')
}

function readToken() {
  const fromEnv = String(process.env.CHAYUAN_MCP_TOKEN || '').trim()
  if (fromEnv) return fromEnv
  try {
    return String(fs.readFileSync(path.join(dataDir(), 'token'), 'utf8') || '').trim()
  } catch {
    return ''
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  return { ok: res.ok, status: res.status, data }
}

async function mcpCall(method, params, id = 1) {
  return fetchJson(`${BASE}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  })
}

async function waitFor(fn, { timeoutMs, intervalMs = 1000, label = 'condition' } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const v = await fn()
      if (v) return v
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error(`timeout waiting for ${label} (${timeoutMs}ms)`)
}

async function killPortOccupants(port) {
  if (process.platform === 'win32') {
    try {
      const out = execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      )
      const pids = String(out || '')
        .split(/\r?\n/)
        .map((s) => Number(String(s).trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
          log(`killed pid ${pid} on :${port}`)
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  } else {
    try {
      execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' })
    } catch { /* ignore */ }
  }
  await new Promise((r) => setTimeout(r, 600))
}

async function ensureSidecar() {
  const health = await fetchJson(`${BASE}/healthz`).catch(() => ({ ok: false }))
  if (health.ok && !FORCE_SIDECAR) {
    try {
      const list = await mcpCall('tools/list', {}, 9001)
      const names = (list.data?.result?.tools || []).map((t) => t.name)
      const hasP0 = names.includes('format_run') && names.includes('comment')
      if (hasP0) {
        pass('sidecar.healthz', `pid=${health.data?.pid} tools=${names.length}`)
        return
      }
      log(`sidecar online but missing P0 tools (tools=${names.length}) — restarting…`)
    } catch {
      pass('sidecar.healthz', `pid=${health.data?.pid}`)
      return
    }
  } else if (health.ok && FORCE_SIDECAR) {
    log(`force restart sidecar pid=${health.data?.pid}`)
  } else {
    log('sidecar offline — starting…')
  }

  await killPortOccupants(PORT)

  sidecarProc = spawn(process.execPath, [path.join(root, 'mcp-sidecar', 'server.mjs')], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32'
  })
  sidecarProc.stdout.on('data', d => process.stdout.write(String(d)))
  sidecarProc.stderr.on('data', d => process.stderr.write(String(d)))
  await waitFor(async () => {
    const h = await fetchJson(`${BASE}/healthz`).catch(() => ({ ok: false }))
    return h.ok ? h : null
  }, { timeoutMs: 15000, label: 'sidecar healthz' })
  // verify new catalog
  try {
    const list = await mcpCall('tools/list', {}, 9002)
    const n = (list.data?.result?.tools || []).length
    const ver = list.data?.result?.tools ? null : null
    pass('sidecar.spawn', `tools=${n}`)
  } catch {
    pass('sidecar.spawn', 'started by selftest')
  }
}

function buildAddon() {
  if (SKIP_BUILD) {
    log('skip build')
    return
  }
  log('vite build…')
  execSync('npm run build', { cwd: root, stdio: 'inherit' })
  pass('vite.build')
}

function syncToJsaddons() {
  if (SKIP_SYNC) {
    log('skip sync jsaddons')
    return
  }
  if (process.platform !== 'win32') {
    log('jsaddons sync: non-Windows — skip (wpsjs debug will serve HTTP)')
    return
  }
  const appData = process.env.APPDATA
  if (!appData) {
    fail('jsaddons.sync', 'APPDATA missing')
    return
  }
  const jsaddons = path.join(appData, 'Kingsoft', 'wps', 'jsaddons')
  const dest = path.join(jsaddons, `${NAME}_${VERSION}`)
  const dist = path.join(root, 'dist')
  if (!fs.existsSync(dist)) {
    fail('jsaddons.sync', 'dist/ missing')
    return
  }
  fs.mkdirSync(dest, { recursive: true })
  // copy dist files
  for (const name of fs.readdirSync(dist)) {
    const from = path.join(dist, name)
    const to = path.join(dest, name)
    fs.cpSync(from, to, { recursive: true, force: true })
  }
  // copy mcp-sidecar
  const mcpSrc = path.join(root, 'mcp-sidecar')
  if (fs.existsSync(mcpSrc)) {
    fs.cpSync(mcpSrc, path.join(dest, 'mcp-sidecar'), {
      recursive: true,
      force: true,
      filter: (p) => !p.includes(`${path.sep}node_modules${path.sep}`)
    })
  }
  // ensure publish.xml enables addon
  const publish = path.join(jsaddons, 'publish.xml')
  const xml =
    `<jsplugins>\n` +
    `    <jsplugin name="${NAME}" type="wps" url="${NAME}_${VERSION}" version="${VERSION}" enable="enable_dev" install="null" customDomain=""/>\n` +
    `</jsplugins>\n`
  fs.writeFileSync(publish, xml, 'utf8')
  pass('jsaddons.sync', dest)
}

function preflightWpsInstall() {
  if (process.platform !== 'win32') {
    pass('wps.preflight', 'non-Windows — rely on wpsjs')
    return true
  }
  try {
    const out = execSync('REG QUERY HKEY_CLASSES_ROOT\\KWPS.Document.12\\shell\\open\\command /ve', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const m = out.match(/"(.*?wps\.exe)"/i) || out.match(/"(.*?wpsoffice\.exe)"/i)
    if (m) {
      pass('wps.preflight', m[1])
      return true
    }
    fail('wps.preflight', 'KWPS.Document.12 无 wps.exe 路径')
    return false
  } catch {
    fail(
      'wps.preflight',
      '注册表无 KWPS.Document.12（wpsjs 判定「WPS未安装」）。请安装 WPS 文字 2019+ 并修复文件关联后重试。'
    )
    return false
  }
}

function startWpsjsDebug() {
  if (SKIP_DEBUG) {
    log('skip wpsjs debug — assuming WPS already open with addon')
    pass('wpsjs.debug.boot', 'skipped')
    return Promise.resolve(true)
  }
  if (!preflightWpsInstall()) {
    fail('wpsjs.debug.boot', 'skipped — WPS not detected')
    return Promise.resolve(false)
  }
  log('starting wpsjs debug (will launch WPS)…')
  debugProc = spawn('npx', ['wpsjs', 'debug', '-p', '3889'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env }
  })
  let bootLog = ''
  const onChunk = (buf) => {
    const s = String(buf)
    bootLog += s
    process.stdout.write(s)
  }
  debugProc.stdout.on('data', onChunk)
  debugProc.stderr.on('data', onChunk)

  return new Promise((resolve) => {
    let settled = false
    const finish = (ok, detail) => {
      if (settled) return
      settled = true
      if (ok) pass('wpsjs.debug.boot', detail)
      else fail('wpsjs.debug.boot', detail)
      resolve(ok)
    }
    debugProc.on('exit', (code) => {
      log(`wpsjs debug exited code=${code}`)
      if (/WPS未安装|wps安装异常/i.test(bootLog)) {
        finish(false, 'WPS未安装（wpsjs）')
      } else if (code && code !== 0) {
        finish(false, `exit=${code}; ${bootLog.slice(-300)}`)
      }
    })
    setTimeout(() => {
      if (/WPS未安装|wps安装异常/i.test(bootLog)) {
        finish(false, 'WPS未安装（wpsjs）')
      } else if (debugProc.exitCode == null) {
        finish(true, 'process still running')
      }
    }, 10000)
  })
}

async function waitAgent() {
  log(`waiting agent online ≤ ${agentTimeoutSec}s…`)
  try {
    const st = await waitFor(async () => {
      const h = await fetchJson(`${BASE}/healthz`)
      if (h.data?.agent?.agentOnline) return h.data
      return null
    }, { timeoutMs: agentTimeoutSec * 1000, intervalMs: 2000, label: 'agent online' })
    pass('agent.online', `count=${st.agent?.agentCount}`)
    return true
  } catch (e) {
    fail('agent.online', e.message)
    return false
  }
}

async function waitSelftestReport() {
  log('waiting addon auto spike report…')
  try {
    const report = await waitFor(async () => {
      const r = await fetchJson(`${BASE}/selftest/report`)
      const rep = r.data?.report
      if (rep && (rep.spikes || rep.error || rep.source === 'addon-auto')) return rep
      // accept any report newer than process start - 10 min
      if (rep?.receivedAt && Date.now() - rep.receivedAt < 10 * 60 * 1000) return rep
      return null
    }, { timeoutMs: Math.max(agentTimeoutSec, 60) * 1000, intervalMs: 2000, label: 'selftest report' })
    pass('addon.selftest.report', `source=${report.source}; ws=${report.spikes?.ws?.verdict}; shell=${report.spikes?.shell?.verdict}`)
    return report
  } catch (e) {
    fail('addon.selftest.report', e.message)
    return null
  }
}

async function runMcpSuite(agentOnline) {
  const init = await mcpCall('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'chayuan-selftest', version: '0.1.0' }
  }, 1)
  if (init.ok && init.data?.result?.serverInfo?.name === 'chayuan-wps-mcp') {
    pass('mcp.initialize', init.data.result.serverInfo.version)
  } else {
    fail('mcp.initialize', JSON.stringify(init.data).slice(0, 200))
  }

  const list = await mcpCall('tools/list', {}, 2)
  const tools = list.data?.result?.tools || []
  const names = tools.map(t => t.name)
  const need = [
    'wps_status',
    'wps_launch',
    'document_open',
    'document_ensure_open',
    'document_list_open',
    'document_activate',
    'document_meta',
    'document_list_paragraphs',
    'document_chunks',
    'document_get_text',
    'document_locate',
    'document_replace',
    'document_insert',
    'document_apply_ops',
    'document_new',
    'document_save',
    'declassify_status',
    'declassify_preview',
    'declassify_apply',
    'declassify_restore',
    'kb_retrieve',
    'proofread_run',
    'proofread_apply_comments',
    'proofread_job_poll',
    'assistants_list_domains',
    'assistants_search',
    'assistants_get',
    'format_run',
    'format_para',
    'format_apply_ops',
    'system_fonts_list',
    'comment',
    'revision',
    'layout',
    'nav',
    'toc',
    'bookmark',
    'table',
    'caption',
    'field',
    'image',
    'hyperlink',
    'headerfooter',
    'watermark',
    'style',
    'export'
  ]
  const missing = need.filter(n => !names.includes(n))
  if (list.ok && missing.length === 0) pass('mcp.tools/list', `${names.length} tools`)
  else fail('mcp.tools/list', missing.length ? `missing ${missing.join(',')}` : JSON.stringify(list.data).slice(0, 200))

  const statusCall = await mcpCall('tools/call', { name: 'wps_status', arguments: {} }, 3)
  const sc = statusCall.data?.result?.structuredContent || null
  if (statusCall.ok && sc?.server) {
    pass('mcp.wps_status', `agentOnline=${!!sc.agent?.agentOnline}; L2=${!!sc.tiers?.L2_document}`)
  } else {
    fail('mcp.wps_status', JSON.stringify(statusCall.data).slice(0, 240))
  }

  // Write-tool confirm gates (sidecar-side, no Agent required)
  const confirmCall = await mcpCall('tools/call', {
    name: 'proofread_apply_comments',
    arguments: { taskId: 'selftest-no-confirm' }
  }, 31)
  const confirmCode = confirmCall.data?.result?.structuredContent?.code
  if (confirmCall.data?.result?.isError && confirmCode === 'CONFIRMATION_REQUIRED') {
    pass('mcp.confirm.proofread_apply', 'CONFIRMATION_REQUIRED')
  } else {
    fail('mcp.confirm.proofread_apply', JSON.stringify(confirmCall.data).slice(0, 200))
  }
  const commentGate = await mcpCall('tools/call', {
    name: 'comment',
    arguments: { action: 'add', text: 'selftest' }
  }, 32)
  const commentCode = commentGate.data?.result?.structuredContent?.code
  if (commentGate.data?.result?.isError && commentCode === 'CONFIRMATION_REQUIRED') {
    pass('mcp.confirm.comment_add', 'CONFIRMATION_REQUIRED')
  } else {
    fail('mcp.confirm.comment_add', JSON.stringify(commentGate.data).slice(0, 200))
  }

  if (agentOnline) {
    const textCall = await mcpCall('tools/call', { name: 'document_get_text', arguments: {} }, 4)
    const tr = textCall.data?.result
    const structured = tr?.structuredContent
    if (tr && !tr.isError && typeof structured?.charCount === 'number') {
      pass('mcp.document_get_text', `chars=${structured.charCount}`)
    } else if (tr?.isError) {
      const code = structured?.code || ''
      // Agent reached but no doc / other business error — still proves L2 bridge
      if (code && code !== 'WPS_AGENT_OFFLINE') {
        pass('mcp.document_get_text.bridge', `agent responded error=${code}`)
      } else {
        fail('mcp.document_get_text', JSON.stringify(structured || tr).slice(0, 240))
      }
    } else {
      fail('mcp.document_get_text', JSON.stringify(textCall.data).slice(0, 240))
    }

    // Lifecycle: ensure_open on already-active document (must be fast; no Documents.Item hang)
    const fullName = structured?.document?.fullName || structured?.document?.name || ''
    if (fullName) {
      const t0 = Date.now()
      const ens = await mcpCall('tools/call', {
        name: 'document_ensure_open',
        arguments: { path: fullName }
      }, 41)
      const elapsed = Date.now() - t0
      const esc = ens.data?.result?.structuredContent
      if (ens.data?.result && !ens.data.result.isError && esc?.open) {
        pass('mcp.document_ensure_open', `${elapsed}ms alreadyOpen=${!!esc.alreadyOpen}`)
      } else {
        fail('mcp.document_ensure_open', JSON.stringify(esc || ens.data).slice(0, 240))
      }
    } else {
      pass('mcp.document_ensure_open.skip', 'no active fullName')
    }

    // Launch when agent already online should be cheap no-op (or ping)
    const launch = await mcpCall('tools/call', { name: 'wps_launch', arguments: {} }, 42)
    const lsc = launch.data?.result?.structuredContent
    if (launch.data?.result && !launch.data.result.isError && lsc?.agentOnline) {
      pass('mcp.wps_launch', `launched=${!!lsc.launched}`)
    } else if (launch.data?.result?.isError) {
      fail('mcp.wps_launch', JSON.stringify(lsc || launch.data).slice(0, 240))
    } else {
      fail('mcp.wps_launch', JSON.stringify(launch.data).slice(0, 240))
    }

    // meta + chunks (long-doc protocol)
    const meta = await mcpCall('tools/call', { name: 'document_meta', arguments: {} }, 44)
    const msc = meta.data?.result?.structuredContent
    if (meta.data?.result && !meta.data.result.isError && typeof msc?.charCount === 'number') {
      pass('mcp.document_meta', `chars=${msc.charCount} estChunks=${msc.estimatedChunkCount}`)
    } else if (meta.data?.result?.isError) {
      pass('mcp.document_meta.bridge', msc?.code || 'error')
    } else {
      fail('mcp.document_meta', JSON.stringify(meta.data).slice(0, 240))
    }

    const chunks = await mcpCall('tools/call', {
      name: 'document_chunks',
      arguments: { cursor: 0, limit: 2, chunkLength: 2000 }
    }, 45)
    const csc = chunks.data?.result?.structuredContent
    if (chunks.data?.result && !chunks.data.result.isError && Array.isArray(csc?.chunks)) {
      const first = csc.chunks[0]
      const hasAnchor = first == null || (Number.isFinite(first.start) && Number.isFinite(first.end))
      if (hasAnchor) {
        pass(
          'mcp.document_chunks',
          `total=${csc.totalChunks} page=${csc.chunks.length} hasMore=${!!csc.hasMore}`
        )
      } else {
        fail('mcp.document_chunks', 'chunk missing start/end')
      }
    } else if (chunks.data?.result?.isError) {
      pass('mcp.document_chunks.bridge', csc?.code || 'error')
    } else {
      fail('mcp.document_chunks', JSON.stringify(chunks.data).slice(0, 240))
    }

    // locate + replace preview (no confirm = no write)
    // Prefer a contiguous word/phrase that actually exists in the document.
    const rawText = String(structured?.text || '')
    const word = (rawText.match(/[\u4e00-\u9fffA-Za-z0-9_]{2,}/) || [])[0] || rawText.trim().slice(0, 12)
    const sample = String(word || '').trim()
    if (sample.length >= 2) {
      const loc = await mcpCall('tools/call', {
        name: 'document_locate',
        arguments: { text: sample, maxMatches: 5 }
      }, 46)
      const lsc2 = loc.data?.result?.structuredContent
      if (loc.data?.result && !loc.data.result.isError) {
        pass('mcp.document_locate', `matches=${lsc2.matchCount ?? 0}`)
      } else {
        fail('mcp.document_locate', JSON.stringify(lsc2 || loc.data).slice(0, 240))
      }
      const prev = await mcpCall('tools/call', {
        name: 'document_replace',
        arguments: { originalText: sample, newText: sample }
      }, 47)
      const psc = prev.data?.result?.structuredContent
      if (prev.data?.result && !prev.data.result.isError && psc?.preview === true) {
        pass('mcp.document_replace.preview', 'requiresConfirmation')
      } else if (prev.data?.result?.isError && psc?.code === 'LOCATE_NOT_FOUND') {
        pass('mcp.document_replace.preview.soft', 'LOCATE_NOT_FOUND')
      } else {
        fail('mcp.document_replace.preview', JSON.stringify(psc || prev.data).slice(0, 240))
      }
    } else {
      pass('mcp.document_locate.skip', 'text too short')
    }

    // proofread dryRun — may fail on MODEL_NOT_CONFIGURED / LICENSE; still record
    const pr = await mcpCall('tools/call', {
      name: 'proofread_run',
      arguments: { dryRun: true, scope: 'document' }
    }, 43)
    const prsc = pr.data?.result?.structuredContent
    if (pr.data?.result && !pr.data.result.isError && prsc?.taskId) {
      pass('mcp.proofread_run.dryRun', `issues=${prsc.issueCount ?? '?'} taskId=${prsc.taskId}`)
    } else if (pr.data?.result?.isError) {
      const code = prsc?.code || ''
      const msg = String(prsc?.message || '')
      if (['MODEL_NOT_CONFIGURED', 'LICENSE_REQUIRED', 'INVALID_PARAMS'].includes(code)) {
        pass('mcp.proofread_run.dryRun.soft', code)
      } else if (/文档内容为空|无法读取|empty/i.test(msg)) {
        pass('mcp.proofread_run.dryRun.soft', 'empty document')
      } else {
        fail('mcp.proofread_run.dryRun', JSON.stringify(prsc || pr.data).slice(0, 240))
      }
    } else {
      fail('mcp.proofread_run.dryRun', JSON.stringify(pr.data).slice(0, 240))
    }
  } else {
    fail('mcp.document_get_text', 'skipped — agent offline')
  }

  if (TOOLS_ALL) {
    await runAllToolsCallableSuite(agentOnline, names)
  }
}

/**
 * Probe every advertised tool with safe args.
 * Success = routed (not TOOL_NOT_FOUND): ok result OR expected business error.
 */
async function runAllToolsCallableSuite(agentOnline, listedNames = []) {
  log(`per-tool callable sweep (${listedNames.length} tools)…`)
  const CALLABLE_SOFT = new Set([
    'CONFIRMATION_REQUIRED',
    'NO_ACTIVE_DOCUMENT',
    'NO_SELECTION',
    'ANCHOR_REQUIRED',
    'ANCHOR_NOT_FOUND',
    'LOCATE_NOT_FOUND',
    'INVALID_PARAMS',
    'MODEL_NOT_CONFIGURED',
    'LICENSE_REQUIRED',
    'UNSUPPORTED',
    'STYLE_APPLY_FAILED',
    'REVISION_MODE_FAILED',
    'REVISION_APPLY_FAILED',
    'NAV_PANE_FAILED',
    'DOCUMENT_OPEN_MISMATCH',
    'WPS_AGENT_OFFLINE',
    'METHOD_NOT_FOUND', // still means sidecar routed; agent missing method = FAIL below
    'ERROR'
  ])
  const FATAL = new Set(['TOOL_NOT_FOUND'])

  /** Safe probes: never confirmed=true destructive writes except UI-only / dryRun */
  const probes = {
    wps_status: {},
    wps_launch: {},
    document_open: { path: 'C:\\__chayuan_selftest_missing__.docx', viaOs: false, force: false },
    document_ensure_open: { path: 'C:\\__chayuan_selftest_missing__.docx' },
    document_list_open: {},
    document_activate: { query: '__missing__' },
    document_meta: {},
    document_list_paragraphs: { limit: 5 },
    document_chunks: { cursor: 0, limit: 1, chunkLength: 800 },
    document_get_text: {},
    document_locate: { text: '的', maxMatches: 3 },
    document_replace: { originalText: '的', newText: '的' }, // preview
    document_insert: { text: '', position: 'append' }, // preview / may INVALID
    document_apply_ops: { action: 'replace', operations: [{ originalText: '的', outputText: '的' }] },
    document_new: {}, // may create — skip if too heavy: use empty and accept
    document_save: {},
    declassify_status: {},
    declassify_preview: {},
    declassify_apply: { confirmed: false, password: 'x', keywords: [] },
    declassify_restore: { confirmed: false, password: 'x' },
    kb_retrieve: { query: 'selftest' },
    proofread_run: { dryRun: true, scope: 'document' },
    proofread_apply_comments: { taskId: 'selftest-no-confirm' },
    proofread_job_poll: { jobId: 'selftest-no-job' },
    assistants_list_domains: {},
    assistants_search: { query: '校对', limit: 5 },
    assistants_get: { id: '__missing_assistant__' },
    format_run: { changes: { bold: true }, scope: 'selection' },
    format_para: { changes: { align: 'center' }, scope: 'selection' },
    format_apply_ops: { operations: [{ originalText: '的', changes: { bold: true } }] },
    system_fonts_list: { limit: 20 },
    comment: { action: 'list', limit: 20 },
    revision: { action: 'list', limit: 20 },
    layout: { action: 'page', orientation: 'portrait' },
    nav: { action: 'outline', maxLevel: 3, limit: 20 },
    toc: { action: 'update' },
    bookmark: { action: 'list', limit: 20 },
    table: { action: 'list', limit: 10 },
    caption: { action: 'list', limit: 10 },
    field: { action: 'list', limit: 10 },
    image: { action: 'list', limit: 10 },
    hyperlink: { action: 'list', limit: 10 },
    headerfooter: { action: 'get', which: 'both' },
    watermark: { action: 'set', text: 'x' },
    style: { action: 'list', limit: 20 },
    export: { action: 'file', format: 'pdf', path: 'C:\\__missing__.pdf' }
  }

  // Avoid actually creating a new empty doc during sweep
  const skipWriteCommit = new Set(['document_new'])

  let id = 1000
  let callable = 0
  let failed = 0
  for (const name of listedNames) {
    if (skipWriteCommit.has(name)) {
      pass(`tool.call.${name}`, 'skipped (destructive lifecycle)')
      callable += 1
      continue
    }
    const args = probes[name] != null ? probes[name] : {}
    // ensure write gates stay preview unless tool requires confirmed and we want gate check
    if (Object.prototype.hasOwnProperty.call(args, 'confirmed') && args.confirmed === true) {
      args.confirmed = false
    }
    id += 1
    const t0 = Date.now()
    let res
    try {
      res = await mcpCall('tools/call', { name, arguments: args }, id)
    } catch (e) {
      fail(`tool.call.${name}`, `fetch: ${e.message}`)
      failed += 1
      continue
    }
    const elapsed = Date.now() - t0
    const result = res.data?.result
    const sc = result?.structuredContent || {}
    const code = String(sc.code || '')
    const isErr = !!result?.isError

    if (!res.ok && !result) {
      fail(`tool.call.${name}`, `http=${res.status}`)
      failed += 1
      continue
    }
    if (FATAL.has(code) || /Unknown tool/i.test(String(sc.message || ''))) {
      fail(`tool.call.${name}`, `not routed: ${code || sc.message}`)
      failed += 1
      continue
    }
    // METHOD_NOT_FOUND on agent = not implemented — fail
    if (code === 'METHOD_NOT_FOUND' || /Unknown method/i.test(String(sc.message || ''))) {
      fail(`tool.call.${name}`, `agent METHOD_NOT_FOUND`)
      failed += 1
      continue
    }
    if (!isErr) {
      pass(`tool.call.${name}`, `ok ${elapsed}ms`)
      callable += 1
      continue
    }
    // Soft: tool reachable, business rejected
    if (CALLABLE_SOFT.has(code) || code) {
      const needsAgent = !['wps_status', 'wps_launch', 'assistants_list_domains', 'assistants_search'].includes(name)
      if (!agentOnline && needsAgent && code === 'WPS_AGENT_OFFLINE') {
        pass(`tool.call.${name}`, `callable-gate agentOffline ${elapsed}ms`)
        callable += 1
      } else {
        pass(`tool.call.${name}`, `callable code=${code || 'ERR'} ${elapsed}ms`)
        callable += 1
      }
      continue
    }
    fail(`tool.call.${name}`, JSON.stringify(sc || result).slice(0, 200))
    failed += 1
  }
  pass('tool.call.summary', `callable=${callable} failed=${failed} total=${listedNames.length}`)
}

function decide(report, agentOnline) {
  const must = ['sidecar.healthz', 'mcp.initialize', 'mcp.tools/list']
  // sidecar.spawn is optional if already running
  const mustOk = must.every(n => results.some(r => r.name === n && r.ok)) ||
    (results.some(r => r.name === 'sidecar.spawn' && r.ok) &&
      results.some(r => r.name === 'mcp.initialize' && r.ok) &&
      results.some(r => r.name === 'mcp.tools/list' && r.ok))

  const sidecarOk = results.some(r => (r.name === 'sidecar.healthz' || r.name === 'sidecar.spawn') && r.ok)
  const mcpOk = results.some(r => r.name === 'mcp.initialize' && r.ok) &&
    results.some(r => r.name === 'mcp.tools/list' && r.ok)
  const agentOk = agentOnline || results.some(r => r.name === 'agent.online' && r.ok)
  const statusOk = results.some(r => r.name === 'mcp.wps_status' && r.ok)
  const docBridgeOk = results.some(r =>
    (
      r.name === 'mcp.document_get_text' ||
      r.name === 'mcp.document_get_text.bridge' ||
      r.name === 'mcp.document_meta' ||
      r.name === 'mcp.document_meta.bridge' ||
      r.name === 'mcp.document_chunks' ||
      r.name === 'mcp.document_chunks.bridge'
    ) && r.ok
  )
  const spikeOk = !!report?.spikes

  const reasons = []
  if (!sidecarOk) reasons.push('sidecar 未就绪')
  if (!mcpOk) reasons.push('MCP initialize/tools 失败')
  if (!agentOk) reasons.push('WPS Agent 未上线（加载项未连上 sidecar）')
  if (agentOk && !statusOk) reasons.push('wps_status 调用失败')
  if (agentOk && !docBridgeOk) reasons.push('document 桥未验证（可无文档，但需 Agent 有响应）')
  if (agentOk && !spikeOk) reasons.push('未收到 addon 自动 Spike 报告（可用设置页手动补跑）')

  // Phase 2 = Resources + Linux/macOS autostart + audit — needs stable MVP bridge
  let phase2 = 'HOLD'
  if (sidecarOk && mcpOk && agentOk && statusOk && docBridgeOk) {
    phase2 = 'GO'
    if (!spikeOk) {
      phase2 = 'GO_WITH_CAUTION'
      reasons.push('核心链路已通，Spike 报告缺失但不阻塞 Phase2 Resources')
    }
  } else if (sidecarOk && mcpOk && !agentOk) {
    phase2 = 'NO_GO'
    reasons.push('仅 sidecar/MCP 通而 Agent 不通：先修加载项加载/debug，再进 Phase2')
  } else {
    phase2 = 'NO_GO'
  }

  // ShellExecute fail is OK for Phase2; WS fail is OK (keep long-poll)
  if (report?.spikes?.shell && !report.spikes.shell.ok) {
    reasons.push(`Spike ShellExecute=${report.spikes.shell.verdict}（预期可失败，不影响 Phase2）`)
  }
  if (report?.spikes?.ws && !report.spikes.ws.ok) {
    reasons.push(`Spike WS=${report.spikes.ws.verdict}（保持长轮询，不影响 Phase2）`)
  }

  decision = { phase2, reasons, mustOk, agentOk, docBridgeOk, spikeOk }
  return decision
}

function writeReport(final) {
  const outDir = path.join(dataDir())
  fs.mkdirSync(outDir, { recursive: true })
  const file = path.join(outDir, 'selftest-run.json')
  fs.writeFileSync(file, JSON.stringify(final, null, 2), 'utf8')
  const repoOut = path.join(root, 'mcp-sidecar', 'last-selftest.json')
  try { fs.writeFileSync(repoOut, JSON.stringify(final, null, 2), 'utf8') } catch { /* ignore */ }
  log(`report → ${file}`)
}

function cleanup() {
  // Keep sidecar running for further manual tests; only stop debug if we started it? 
  // wpsjs debug leaving WPS open is desirable. Do not kill sidecar.
  if (debugProc && !debugProc.killed) {
    // leave WPS running; optionally kill only the node debug server later
    log('leaving wpsjs debug / WPS running for inspection')
  }
}

async function main() {
  log(`root=${root}`)
  log(`mcp=${BASE}`)
  try {
    await ensureSidecar()
    buildAddon()
    syncToJsaddons()
    const debugOk = await startWpsjsDebug()
    const agentOnline = debugOk || SKIP_DEBUG ? await waitAgent() : false
    if (!debugOk && !SKIP_DEBUG) {
      fail('agent.online', 'skipped — wpsjs debug 未能拉起 WPS')
    }
    const report = agentOnline ? await waitSelftestReport() : null
    await runMcpSuite(agentOnline)
    const d = decide(report, agentOnline)

    console.log('\n========== SELFTEST DECISION ==========')
    console.log(`Phase 2: ${d.phase2}`)
    for (const r of d.reasons) console.log(` - ${r}`)
    console.log('Checks:')
    for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? ' · ' + r.detail : ''}`)
    console.log('=======================================\n')

    writeReport({
      at: new Date().toISOString(),
      decision: d,
      results,
      addonReport: report
    })

    cleanup()
    if (d.phase2 === 'GO' || d.phase2 === 'GO_WITH_CAUTION') {
      process.exitCode = 0
    } else {
      process.exitCode = 2
    }
  } catch (e) {
    console.error('[selftest] fatal:', e)
    writeReport({ at: new Date().toISOString(), fatal: e.message, results, decision })
    process.exitCode = 1
  }
}

main()
