#!/usr/bin/env node
/**
 * Comprehensive feature test driven ENTIRELY through MCP (every call below is a
 * real JSON-RPC `tools/call` to the sidecar at 127.0.0.1:62588 — no direct WPS
 * automation). Targets the live 爱唠叨的妈妈.docx:
 *   - READS  run on Table 2 (real content 序号/名称/地址/备注)  — non-destructive
 *   - WRITES run on Table 1 (disposable empty 3×3 test target) — preserves original content
 *   - caption / field / image are doc-wide
 * Collects every result into mcp-sidecar/last-feature-test.json for the report + comments.
 *
 *   node scripts/mcp-feature-test-ondoc.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.CHAYUAN_MCP_PORT || 62588)
const BASE = `http://127.0.0.1:${PORT}`
const results = []
let _id = 500
const nextId = () => ++_id

async function mcpCall(name, args) {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId(), method: 'tools/call', params: { name, arguments: args } })
  })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { raw: text } }
  const result = data?.result
  const sc = result?.structuredContent || {}
  const errMsg = result?.isError ? (result.content?.[0]?.text || JSON.stringify(sc)) : ''
  return { sc, isError: !!result?.isError, code: String(sc.code || ''), errMsg, raw: result }
}

/** Run one feature probe; record {feature, action, args, ok, summary, detail}. */
async function probe(feature, name, args, { summarize = (sc) => JSON.stringify(sc).slice(0, 200), ok = (r) => !r.isError } = {}) {
  const r = await mcpCall(name, args)
  const passed = ok(r)
  const entry = {
    feature, tool: name, args,
    ok: passed,
    code: r.code || (passed ? 'OK' : 'ERROR'),
    summary: passed ? summarize(r.sc) : (r.errMsg || r.code || 'failed'),
    sc: r.sc
  }
  results.push(entry)
  console.log(`  ${passed ? '✓' : '✗'} ${feature.padEnd(28)} ${entry.summary}`)
  return r
}

async function main() {
  console.log('=== MCP feature test on 爱唠叨的妈妈.docx (all via tools/call) ===')

  // 0. active doc check
  const doc = await mcpCall('document_meta', {})
  console.log('active doc:', doc.sc?.name, '| chars:', doc.sc?.charCount)

  // 1. table.list (read) — discover tables
  const tl = await probe('table.list', 'table', { action: 'list', limit: 20 },
    { summarize: (sc) => `${(sc.items || []).length} tables: ` + (sc.items || []).map((t) => `T${t.tableIndex}=${t.rows}x${t.cols}`).join(' ') })
  const items = tl.sc.items || []
  const emptyTable = items.find((t) => !t.headerSnippet) || items[0]   // Table 1 (empty)
  const contentTable = items.find((t) => t.headerSnippet) || items[1]  // Table 2 (序号/名称…)
  const TI_READ = contentTable?.tableIndex ?? 2
  const TI_WRITE = emptyTable?.tableIndex ?? 1
  console.log(`    → READS on Table ${TI_READ}, WRITES on Table ${TI_WRITE}`)

  // 2. header_read (read) on content table
  await probe('table.header_read', 'table', { action: 'header_read', tableIndex: TI_READ },
    { summarize: (sc) => `cells=[${(sc.cells || []).map((c) => c.text).join('|')}] repeat=${sc.repeatHeader}` })

  // 3. row_read (read)
  await probe('table.row_read', 'table', { action: 'row_read', tableIndex: TI_READ, row: 1 },
    { summarize: (sc) => `row1 cells=[${(sc.cells || []).map((c) => c.text).join('|')}]` })

  // 4. column_read (read)
  await probe('table.column_read', 'table', { action: 'column_read', tableIndex: TI_READ, col: 1 },
    { summarize: (sc) => `col1 cells=[${(sc.cells || []).slice(0, 5).map((c) => c.text).join('|')}]` })

  // 5. cell_read (read)
  await probe('table.cell_read', 'table', { action: 'cell_read', tableIndex: TI_READ, row: 2, col: 2 },
    { summarize: (sc) => `cell(2,2)="${sc.text}" range=${sc.range?.start}-${sc.range?.end}` })

  // 6. export md (read)
  await probe('table.export(md)', 'table', { action: 'export', format: 'md', limit: 3 },
    { summarize: (sc) => `serialized ${(sc.tables || []).length} tables (md)` })

  // 7. caption.list (read)
  await probe('caption.list', 'caption', { action: 'list', limit: 50 },
    { summarize: (sc) => `${(sc.items || []).length} captions: ` + (sc.items || []).map((c) => `${c.kind}${c.numberText}${c.isSeqField ? '(SEQ)' : ''}`).join(' ') })

  // 8. field.list (read)
  await probe('field.list', 'field', { action: 'list', limit: 50 },
    { summarize: (sc) => `${(sc.items || []).length} fields: ` + [...new Set((sc.items || []).map((f) => f.type))].join(',') })

  // 9. image.list (read, enrichment)
  await probe('image.list', 'image', { action: 'list', limit: 20 },
    { summarize: (sc) => `${(sc.items || []).length} images` + ((sc.items || [])[0] ? ` (wrap=${(sc.items || [])[0].wrap})` : '') })

  // ── WRITES on the disposable Table 1 (confirmed=true) ──
  console.log('    — structure writes on Table', TI_WRITE, '—')

  // 10. header_repeat (write)
  await probe('table.header_repeat', 'table', { action: 'header_repeat', tableIndex: TI_WRITE, repeat: true, confirmed: true },
    { summarize: (sc) => `repeatHeader=${sc.repeatHeader}` })

  // 11. column_set_width (write)
  await probe('table.column_set_width', 'table', { action: 'column_set_width', tableIndex: TI_WRITE, allCols: true, widthPt: 60, confirmed: true },
    { summarize: (sc) => `set ${sc.applied?.allCols ? 'all' : '1'} col(s) → avg ${((sc.widths || []).reduce((s, w) => s + w.width, 0) / Math.max(1, (sc.widths || []).length)).toFixed(1)}pt` })

  // 12. row_insert (NEW write) — insert 1 row after row 1
  const ri = await probe('table.row_insert', 'table', { action: 'row_insert', tableIndex: TI_WRITE, row: 1, where: 'after', count: 1, confirmed: true },
    { summarize: (sc) => `inserted ${sc.insertedRows} row(s) ${sc.where} row ${sc.atRow} → now ${sc.rows} rows` })

  // 13. column_insert (NEW write) — insert 1 column after col 1
  const ci = await probe('table.column_insert', 'table', { action: 'column_insert', tableIndex: TI_WRITE, col: 1, where: 'after', count: 1, confirmed: true },
    { summarize: (sc) => `inserted ${sc.insertedColumns} col(s) ${sc.where} col ${sc.atCol} → now ${sc.cols} cols` })

  // 14. cell_merge vertical = 合并行 (merge rows 3-4 in col 1)  [do vertical first on clean grid]
  await probe('table.cell_merge(行)', 'table', { action: 'cell_merge', tableIndex: TI_WRITE, row1: 3, col1: 1, row2: 4, col2: 1, confirmed: true },
    { summarize: (sc) => `merged (${sc.merged?.top},${sc.merged?.left})-(${sc.merged?.bottom},${sc.merged?.right}) dir=${sc.direction}` })

  // 15. cell_merge horizontal = 合并列 (merge cols 2-3 in last row)
  await probe('table.cell_merge(列)', 'table', { action: 'cell_merge', tableIndex: TI_WRITE, row1: 4, col1: 2, row2: 4, col2: 3, confirmed: true },
    { summarize: (sc) => `merged (${sc.merged?.top},${sc.merged?.left})-(${sc.merged?.bottom},${sc.merged?.right}) dir=${sc.direction}` })

  // 16. field.add (write) — add a SEQ 图 caption field at end
  await probe('field.add(SEQ图)', 'field', { action: 'add', kind: 'seq', label: '图', confirmed: true },
    { summarize: (sc) => `how=${sc.how} result="${sc.resultText}"` })

  // 17. final table.list — show Table 1 final geometry after writes
  const tlf = await probe('table.list(final)', 'table', { action: 'list', limit: 20 },
    { summarize: (sc) => (sc.items || []).map((t) => `T${t.tableIndex}=${t.rows}x${t.cols}${t.hasMerged ? '(merged)' : ''}`).join(' ') })

  // summary
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n=== ${passed} passed / ${failed} failed of ${results.length} ===`)

  const out = {
    at: new Date().toISOString(), doc: doc.sc?.name,
    readTable: TI_READ, writeTable: TI_WRITE,
    passed, failed, total: results.length, results
  }
  fs.writeFileSync(path.resolve('mcp-sidecar', 'last-feature-test.json'), JSON.stringify(out, null, 2))
  console.log('wrote mcp-sidecar/last-feature-test.json')
}
main().catch((e) => { console.error('fatal:', e); process.exit(1) })
