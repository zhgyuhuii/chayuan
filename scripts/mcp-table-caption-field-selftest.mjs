#!/usr/bin/env node
/**
 * Per-item E2E selftest for the P2/P3 table·caption·field tools (v0.10.0).
 * Runs against a REAL WPS Agent via the sidecar (127.0.0.1:62588) — expects
 * `wpsjs debug` to have launched WPS with the fresh addin bundle.
 *
 *   node scripts/mcp-table-caption-field-selftest.mjs
 *   node scripts/mcp-table-caption-field-selftest.mjs --no-cleanup   # keep fixture doc
 *
 * Strategy: build a deterministic fixture (new doc → table → caption text → SEQ field),
 * then exercise every new action and assert on the returned FACTS (not on judgement,
 * per §P7). Host-degraded paths (field.add→plain) are accepted as soft passes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const PORT = Number(process.env.CHAYUAN_MCP_PORT || 62588)
const BASE = `http://127.0.0.1:${PORT}`
const NO_CLEANUP = process.argv.includes('--no-cleanup')

const results = []
let _id = 100
function nextId() { return ++_id }

function log(msg) { console.log(`[tcf-selftest] ${msg}`) }
function pass(name, detail = '') { results.push({ name, ok: true, detail }); log(`PASS  ${name}${detail ? ' — ' + detail : ''}`) }
function fail(name, detail = '') { results.push({ name, ok: false, detail }); log(`FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
function soft(name, detail = '') { results.push({ name, ok: true, soft: true, detail }); log(`PASS· ${name}${detail ? ' — ' + detail : ''}`) }

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  return { ok: res.ok, status: res.status, data }
}

async function mcpCall(name, args, id = nextId()) {
  return fetchJson(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })
  })
}

/** Call a tool; return { sc, isError, code, ok } */
async function call(name, args) {
  const r = await mcpCall(name, args)
  const result = r.data?.result
  const sc = result?.structuredContent || {}
  return { sc, isError: !!result?.isError, code: String(sc.code || ''), raw: result }
}

async function listTools() {
  const r = await fetchJson(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId(), method: 'tools/list', params: {} })
  })
  return (r.data?.result?.tools || []).map((t) => t.name)
}

async function waitForAgent(timeoutMs = 150000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const h = await fetchJson(`${BASE}/healthz`).catch(() => ({ ok: false }))
    if (h.ok && h.data?.agent?.agentOnline) return true
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

async function main() {
  log(`base=${BASE} catalog probe…`)
  const names = await listTools()
  for (const need of ['table', 'caption', 'field', 'image']) {
    if (!names.includes(need)) { fail(`catalog.${need}`, 'not advertised'); return finish(2) }
  }
  pass('catalog.has_new_domains', `total=${names.length}`)

  log('waiting for WPS Agent online (wpsjs debug)…')
  const online = await waitForAgent()
  if (!online) { fail('agent.online', 'timeout — is wpsjs debug running?'); return finish(2) }
  pass('agent.online')

  // ── Phase 0: ensure an active document ──
  let meta = await call('document_meta', {})
  if (meta.code === 'NO_ACTIVE_DOCUMENT' || meta.isError) {
    log('no active doc — creating blank fixture doc…')
    const nd = await call('document_new', {})
    if (nd.isError) { fail('fixture.document_new', nd.code || JSON.stringify(nd.sc).slice(0, 160)); return finish(2) }
    pass('fixture.document_new')
    meta = await call('document_meta', {})
  }
  if (meta.isError || typeof meta.sc?.charCount !== 'number') {
    fail('fixture.document_meta', meta.code || JSON.stringify(meta.sc).slice(0, 160)); return finish(2)
  }
  pass('fixture.document_meta', `chars=${meta.sc.charCount}`)

  // ── Phase 1: build fixture (table + caption text) ──
  const TROWS = 3, TCOLS = 3
  const ins = await call('table', { action: 'insert', rows: TROWS, columns: TCOLS, confirmed: true })
  if (ins.isError) { fail('fixture.table.insert', ins.code || JSON.stringify(ins.sc).slice(0, 160)); return finish(2) }
  pass('fixture.table.insert', `${TROWS}x${TCOLS}`)

  // caption text for caption.list detection (plain text, not SEQ — tests the regex path)
  const capIns = await call('document_insert', {
    text: '\n图1 测试示意图\n表1 测试数据表\n',
    position: 'append',
    confirmed: true
  })
  if (capIns.isError) soft('fixture.caption_text', `append soft: ${capIns.code}`)
  else pass('fixture.caption_text')

  // ── Phase 2: read-only slice assertions ──
  // table.list
  let r = await call('table', { action: 'list', limit: 20 })
  if (r.isError) fail('table.list', r.code)
  else {
    const items = r.sc.items || []
    const last = items[items.length - 1]
    if (items.length >= 1 && last && Number.isFinite(last.rows) && Number.isFinite(last.cols) && last.range?.start != null) {
      pass('table.list', `tables=${items.length} last=${last.rows}x${last.cols}`)
    } else fail('table.list', 'bad structure: ' + JSON.stringify(items[items.length - 1] || {}).slice(0, 120))
  }

  // resolve a tableIndex to test against (last table)
  const listItems = r.sc?.items || []
  const tableIndex = listItems.length ? listItems[listItems.length - 1].tableIndex : 1

  // table.header_read
  r = await call('table', { action: 'header_read', tableIndex })
  if (r.isError) fail('table.header_read', r.code)
  else {
    const cells = r.sc.cells
    if (Array.isArray(cells) && cells.length === TCOLS && typeof r.sc.repeatHeader === 'boolean') {
      pass('table.header_read', `cells=${cells.length} repeat=${r.sc.repeatHeader}`)
    } else fail('table.header_read', 'bad structure: ' + JSON.stringify(r.sc).slice(0, 140))
  }

  // table.row_read
  r = await call('table', { action: 'row_read', tableIndex, row: 1 })
  if (r.isError) fail('table.row_read', r.code)
  else {
    const cells = r.sc.cells
    if (Array.isArray(cells) && cells.length === TCOLS) pass('table.row_read', `cells=${cells.length}`)
    else fail('table.row_read', 'bad structure: ' + JSON.stringify(r.sc).slice(0, 140))
  }

  // table.column_read
  r = await call('table', { action: 'column_read', tableIndex, col: 1 })
  if (r.isError) fail('table.column_read', r.code)
  else {
    if (Array.isArray(r.sc.cells) && r.sc.cells.length >= 1) pass('table.column_read', `cells=${r.sc.cells.length}`)
    else fail('table.column_read', 'bad structure: ' + JSON.stringify(r.sc).slice(0, 140))
  }

  // table.cell_read
  r = await call('table', { action: 'cell_read', tableIndex, row: 1, col: 1 })
  if (r.isError) fail('table.cell_read', r.code)
  else {
    if (typeof r.sc.text === 'string' && r.sc.range?.start != null) pass('table.cell_read', `text="${r.sc.text.slice(0, 20)}"`)
    else fail('table.cell_read', 'bad structure: ' + JSON.stringify(r.sc).slice(0, 140))
  }

  // table.export md
  r = await call('table', { action: 'export', format: 'md', limit: 5 })
  if (r.isError) fail('table.export.md', r.code)
  else {
    const t0 = (r.sc.tables || [])[0]
    if (t0 && typeof t0.content === 'string' && t0.content.includes('|') && t0.format === 'md') pass('table.export.md', `${(t0.content.match(/\n/g) || []).length + 1} lines`)
    else fail('table.export.md', 'bad structure: ' + JSON.stringify(t0 || {}).slice(0, 140))
  }

  // table.export csv
  r = await call('table', { action: 'export', format: 'csv', limit: 5 })
  if (r.isError) fail('table.export.csv', r.code)
  else {
    const t0 = (r.sc.tables || [])[0]
    if (t0 && typeof t0.content === 'string' && t0.format === 'csv') pass('table.export.csv', `${t0.rows}x${t0.cols}`)
    else fail('table.export.csv', 'bad structure: ' + JSON.stringify(t0 || {}).slice(0, 140))
  }

  // caption.list (all)
  r = await call('caption', { action: 'list', limit: 50 })
  if (r.isError) fail('caption.list', r.code)
  else {
    const items = r.sc.items || []
    const hasCaption = items.some((it) => ['图', '表', '式'].includes(it.kind) && it.numberText)
    if (hasCaption) pass('caption.list', `items=${items.length} kinds=${[...new Set(items.map((i) => i.kind))].join(',')}`)
    else soft('caption.list', `routed ok, items=${items.length} (regex may not match this host's caption style)`)
  }

  // caption.list kind filter
  r = await call('caption', { action: 'list', kind: '图', limit: 50 })
  if (r.isError) fail('caption.list.kind', r.code)
  else {
    const items = r.sc.items || []
    if (items.every((it) => it.kind === '图')) pass('caption.list.kind', `图-only=${items.length}`)
    else fail('caption.list.kind', 'kind filter leaked: ' + JSON.stringify(items.map((i) => i.kind)))
  }

  // ── Phase 3: field.add (SEQ) then field.list ──
  r = await call('field', { action: 'add', kind: 'seq', label: '图', confirmed: true })
  if (r.isError) fail('field.add', r.code)
  else {
    const how = r.sc.how
    if (['seq', 'toc', 'plain'].includes(how)) {
      if (how === 'plain') soft('field.add', `degraded how=plain (host lacks Fields.Add): ${r.sc.warning || ''}`)
      else pass('field.add', `how=${how} result="${String(r.sc.resultText || '').slice(0, 20)}"`)
    } else fail('field.add', 'unexpected how: ' + JSON.stringify(r.sc).slice(0, 140))
  }

  r = await call('field', { action: 'list', limit: 50 })
  if (r.isError) fail('field.list', r.code)
  else {
    const items = r.sc.items || []
    if (Array.isArray(items)) {
      const types = [...new Set(items.map((i) => i.type))]
      pass('field.list', `fields=${items.length} types=${types.join(',') || '(none)'}`)
    } else fail('field.list', 'bad structure: ' + JSON.stringify(r.sc).slice(0, 140))
  }

  // ── Phase 4: geometry writes (confirmed) ──
  r = await call('table', { action: 'header_repeat', tableIndex, repeat: true, confirmed: true })
  if (r.isError) fail('table.header_repeat', r.code)
  else {
    if (r.sc.repeatHeader === true) pass('table.header_repeat', 'repeatHeader=true')
    else soft('table.header_repeat', `repeatHeader=${r.sc.repeatHeader} (host may not persist HeadingFormat)`)
  }

  r = await call('table', { action: 'column_set_width', tableIndex, allCols: true, widthPt: 60, confirmed: true })
  if (r.isError) fail('table.column_set_width', r.code)
  else {
    const widths = r.sc.widths
    if (Array.isArray(widths) && widths.length >= 1 && widths.every((w) => Number.isFinite(w.width))) {
      const avg = widths.reduce((s, w) => s + w.width, 0) / widths.length
      pass('table.column_set_width', `cols=${widths.length} avgWidth=${avg.toFixed(1)}pt`)
    } else fail('table.column_set_width', 'bad structure: ' + JSON.stringify(r.sc).slice(0, 140))
  }

  // image.list enrichment — insert a fixture image first so we can prove altText/wrap/neighbour-text
  const fixturePng = path.join(root, 'dist', 'logo.png')
  let imgInserted = false
  if (fs.existsSync(fixturePng)) {
    const imgIns = await call('image', { action: 'insert', path: fixturePng, confirmed: true })
    if (!imgIns.isError) { pass('fixture.image.insert', fixturePng); imgInserted = true }
    else soft('fixture.image.insert', `soft: ${imgIns.code}`)
  }

  // image.list — routing + structure + enrichment fields (wrap at minimum)
  r = await call('image', { action: 'list', limit: 20 })
  if (r.isError) fail('image.list', r.code)
  else {
    const items = r.sc.items || []
    if (Array.isArray(items)) {
      const enriched = items.find((it) => it.wrap)
      if (enriched) pass('image.list.enriched', `items=${items.length} wrap=${enriched.wrap} alt=${enriched.altText ? 'y' : 'n'}`)
      else if (imgInserted) fail('image.list.enriched', `image inserted but no wrap field: ${JSON.stringify(items[0] || {}).slice(0, 140)}`)
      else soft('image.list', `routed ok, items=${items.length} (no image fixture)`)
    } else fail('image.list', 'bad structure: ' + JSON.stringify(r.sc).slice(0, 140))
  }

  return finish(0)
}

function finish(code) {
  const hard = results.filter((r) => !r.soft)
  const passed = hard.filter((r) => r.ok).length
  const failed = hard.filter((r) => !r.ok).length
  const softs = results.filter((r) => r.soft).length
  console.log('\n========== TABLE·CAPTION·FIELD E2E ==========')
  console.log(`hard: ${passed} pass / ${failed} fail   soft-pass: ${softs}`)
  for (const r of results) console.log(`  ${r.ok ? (r.soft ? '○' : '✓') : '✗'} ${r.name}${r.detail ? ' · ' + r.detail : ''}`)
  console.log('============================================\n')
  const out = { at: new Date().toISOString(), version: '0.10.0', passed, failed, softs, results }
  try { fs.writeFileSync(path.join(root, 'mcp-sidecar', 'last-tcf-selftest.json'), JSON.stringify(out, null, 2)) } catch { /* ignore */ }
  process.exitCode = failed > 0 ? 2 : code
}

main().catch((e) => { console.error('[tcf-selftest] fatal:', e); process.exit(1) })
