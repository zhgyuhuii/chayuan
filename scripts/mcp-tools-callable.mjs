#!/usr/bin/env node
/**
 * Advertise + callable sweep for every MCP tool (safe probes, no destructive confirms).
 * Does not start wpsjs debug — use mcp-wps-selftest.mjs for full E2E.
 *
 *   node scripts/mcp-tools-callable.mjs
 *   node scripts/mcp-tools-callable.mjs --port 62589
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOOLS, SERVER_INFO } from '../mcp-sidecar/lib/toolCatalog.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const PORT = Number(portIdx >= 0 ? args[portIdx + 1] : process.env.CHAYUAN_MCP_PORT || 62588)
const BASE = `http://127.0.0.1:${PORT}`
const START = args.includes('--start')

const expected = TOOLS.map((t) => t.name)

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
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  })
}

async function ensure() {
  const h = await fetchJson(`${BASE}/healthz`).catch(() => ({ ok: false }))
  if (h.ok) return null
  if (!START) throw new Error(`sidecar offline at ${BASE} (pass --start to spawn)`)
  const child = spawn(process.execPath, [path.join(root, 'mcp-sidecar', 'server.mjs')], {
    cwd: root,
    env: { ...process.env, CHAYUAN_MCP_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  child.stdout.on('data', (d) => process.stdout.write(String(d)))
  child.stderr.on('data', (d) => process.stderr.write(String(d)))
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 300))
    const hh = await fetchJson(`${BASE}/healthz`).catch(() => ({ ok: false }))
    if (hh.ok) return child
  }
  throw new Error('sidecar spawn timeout')
}

const probes = {
  wps_status: {},
  wps_launch: {},
  document_open: { path: 'C:\\__chayuan_selftest_missing__.docx', viaOs: false },
  document_ensure_open: { path: 'C:\\__chayuan_selftest_missing__.docx' },
  document_list_open: {},
  document_activate: { query: '__missing__' },
  document_meta: {},
  document_list_paragraphs: { limit: 3 },
  document_chunks: { cursor: 0, limit: 1, chunkLength: 500 },
  document_get_text: {},
  document_locate: { text: '的', maxMatches: 2 },
  document_replace: { originalText: '的', newText: '的' },
  document_insert: { text: 'x', position: 'append' },
  document_apply_ops: { action: 'replace', operations: [{ originalText: '的', outputText: '的' }] },
  document_new: null,
  document_save: {},
  declassify_status: {},
  declassify_preview: {},
  declassify_apply: { password: 'x', keywords: [] },
  declassify_restore: { password: 'x' },
  kb_retrieve: { query: 't' },
  proofread_run: { dryRun: true },
  proofread_apply_comments: { taskId: 'x' },
  proofread_job_poll: { jobId: 'x' },
  assistants_list_domains: {},
  assistants_search: { query: '校对', limit: 3 },
  assistants_get: { id: '__x__' },
  format_run: { changes: { bold: true }, scope: 'selection' },
  format_para: { changes: { align: 'left' }, scope: 'selection' },
  format_apply_ops: { operations: [{ originalText: '的', changes: { bold: true } }] },
  system_fonts_list: { limit: 10 },
  comment: { action: 'list', limit: 10 },
  revision: { action: 'list', limit: 5 },
  layout: { action: 'page', orientation: 'portrait' },
  nav: { action: 'outline', maxLevel: 3 },
  toc: { action: 'update' },
  bookmark: { action: 'list', limit: 10 },
  table: { action: 'list', limit: 10 },
  caption: { action: 'list', limit: 10 },
  field: { action: 'list', limit: 10 },
  image: { action: 'list', limit: 10 },
  hyperlink: { action: 'list', limit: 10 },
  headerfooter: { action: 'get' },
  watermark: { action: 'set', text: 'x' },
  style: { action: 'list', limit: 10 },
  export: { action: 'file', format: 'pdf', path: 'C:\\__missing__.pdf' }
}

async function main() {
  console.log(`[tools-callable] catalog=${SERVER_INFO.version} expected=${expected.length} base=${BASE}`)
  const child = await ensure()
  const init = await mcpCall('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'tools-callable', version: '1' }
  })
  console.log('[tools-callable] serverInfo', init.data?.result?.serverInfo)

  const list = await mcpCall('tools/list', {}, 2)
  const names = (list.data?.result?.tools || []).map((t) => t.name)
  const missing = expected.filter((n) => !names.includes(n))
  const extra = names.filter((n) => !expected.includes(n))
  console.log(`[tools-callable] advertised=${names.length} missing=${missing.length} extra=${extra.length}`)
  if (missing.length) console.log('  missing:', missing.join(', '))

  let id = 10
  let ok = 0
  let fail = 0
  const rows = []
  for (const name of expected) {
    if (probes[name] === null) {
      rows.push({ name, ok: true, detail: 'skipped' })
      ok += 1
      continue
    }
    if (!names.includes(name)) {
      rows.push({ name, ok: false, detail: 'not in tools/list' })
      fail += 1
      continue
    }
    id += 1
    const res = await mcpCall('tools/call', { name, arguments: probes[name] || {} }, id)
    const sc = res.data?.result?.structuredContent || {}
    const code = sc.code || ''
    const fatal = code === 'TOOL_NOT_FOUND' || /Unknown tool/i.test(String(sc.message || ''))
    if (fatal) {
      rows.push({ name, ok: false, detail: code || sc.message })
      fail += 1
    } else {
      rows.push({ name, ok: true, detail: code || 'ok' })
      ok += 1
    }
  }
  console.log(`[tools-callable] ok=${ok} fail=${fail}`)
  const outPath = path.join(root, 'mcp-sidecar', 'last-tools-callable.json')
  fs.writeFileSync(outPath, JSON.stringify({ at: new Date().toISOString(), version: SERVER_INFO.version, ok, fail, rows }, null, 2))
  console.log('[tools-callable] wrote', outPath)
  if (child) child.kill()
  if (fail) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
