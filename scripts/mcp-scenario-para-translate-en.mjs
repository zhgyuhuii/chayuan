/**
 * MCP scenario: translate each paragraph to English, insert after each paragraph.
 *
 * Flow (external LLM role simulated in this script):
 *   document_new → write sample ZH paragraphs
 *   → split paragraphs → translate each
 *   → document_apply_ops(action=insert-after) preview → confirm
 *   → verify ZH/EN interleaving
 *
 * Env:
 *   CHAYUAN_MCP_URL          default http://127.0.0.1:62588/mcp
 *   CHAYUAN_TEST_DOC         if set, open this file instead of creating a sample
 *   CHAYUAN_MAX_PARAS        max paragraphs to translate (default 12)
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.env.CHAYUAN_MCP_URL || 'http://127.0.0.1:62588/mcp'
const EXISTING_DOC = String(process.env.CHAYUAN_TEST_DOC || '').trim()
const MAX_PARAS = Number(process.env.CHAYUAN_MAX_PARAS) || 12

let rpcId = 1

async function mcp(method, params) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params })
  })
  const data = await res.json()
  if (data.error) {
    const err = new Error(data.error.message || 'RPC error')
    err.code = data.error.code
    throw err
  }
  return data.result
}

async function tool(name, args = {}) {
  const result = await mcp('tools/call', { name, arguments: args })
  const sc = result?.structuredContent
  if (result?.isError) {
    const err = new Error(sc?.message || `tool ${name} failed`)
    err.code = sc?.code || 'TOOL_ERROR'
    err.details = sc
    throw err
  }
  return sc ?? result
}

function step(t) {
  console.log(`\n=== ${t} ===`)
}
function pass(m, d = '') {
  console.log(`PASS  ${m}${d ? ' — ' + d : ''}`)
}

/** Sample body: short, distinct paragraphs for locate + insert-after. */
const SAMPLE_PARAS = [
  '春天来了，河边的柳树抽出了嫩芽。',
  '孩子们在草地上放风筝，笑声传得很远。',
  '傍晚时分，夕阳把湖面染成了金色。'
]

/** Stand-in for external LLM translation (fixed for reproducible GO). */
const TRANSLATIONS = {
  '春天来了，河边的柳树抽出了嫩芽。':
    'Spring has come; the willow trees by the river have sprouted tender buds.',
  '孩子们在草地上放风筝，笑声传得很远。':
    'Children are flying kites on the grass, and their laughter carries far.',
  '傍晚时分，夕阳把湖面染成了金色。':
    'At dusk, the setting sun dyes the lake a golden color.'
}

function splitParagraphs(text) {
  return String(text || '')
    .replace(/\u0007/g, '')
    .split(/\r\n|\r|\n/)
    .map((p) => p.replace(/\u000b/g, '').trim())
    .filter((p) => p.length > 0)
}

/** Naive fallback when paragraph is not in the sample dictionary. */
function translateParagraph(zh) {
  if (TRANSLATIONS[zh]) return TRANSLATIONS[zh]
  // Keep scenario runnable on arbitrary docs without a live LLM:
  // wrap as explicit EN placeholder the user can spot in WPS.
  const short = zh.length > 80 ? `${zh.slice(0, 80)}…` : zh
  return `[EN] ${short}`
}

async function main() {
  const report = {
    mode: EXISTING_DOC ? 'existing-doc' : 'sample-doc',
    paragraphs: [],
    ops: [],
    ok: true
  }

  step('0. Agent')
  const st = await tool('wps_status')
  if (!st?.agent?.agentOnline) throw new Error('WPS Agent offline — open WPS with 察元 add-in')
  pass('agent online', st.ui?.warning || '')

  step('1. Prepare document')
  if (EXISTING_DOC) {
    if (!fs.existsSync(EXISTING_DOC)) throw new Error(`File not found: ${EXISTING_DOC}`)
    const opened = await tool('document_open', {
      path: EXISTING_DOC,
      viaOs: true,
      force: true,
      activate: true
    })
    pass(
      'document_open',
      `name=${opened?.document?.name || '?'} viaOs=${opened?.openedViaOs} ui=${opened?.ui?.documentVisibleInWindowTitle}`
    )
  } else {
    await tool('document_new', {})
    const body = SAMPLE_PARAS.join('\n') + '\n'
    await tool('document_insert', { text: body, position: 'append', confirmed: true })
    pass('document_new + sample paragraphs', `count=${SAMPLE_PARAS.length}`)
  }

  step('2. Read + split paragraphs')
  const got = await tool('document_get_text', { force: true })
  const paras = splitParagraphs(got.text).slice(0, MAX_PARAS)
  pass('paragraphs', `count=${paras.length} chars=${got.charCount}`)
  paras.forEach((p, i) => console.log(`  [#${i}] ${p.slice(0, 60)}${p.length > 60 ? '…' : ''}`))
  if (!paras.length) throw new Error('no paragraphs found')

  step('3. Locate each paragraph + translate (external-LLM stand-in)')
  const operations = []
  let hint = 0
  for (let i = 0; i < paras.length; i++) {
    const zh = paras[i]
    // Skip paragraphs that already look like our inserted EN lines
    if (/^\[EN\]\s/.test(zh) || /^Spring has come/.test(zh) || /^Children are flying/.test(zh) || /^At dusk/.test(zh)) {
      console.log(`  skip #${i} (already EN-looking)`)
      continue
    }
    const en = translateParagraph(zh)
    let start = null
    let end = null
    try {
      const loc = await tool('document_locate', { text: zh, hintStart: hint, maxMatches: 3 })
      const m = (loc.matches || loc.results || [])[0] || loc
      start = Number(m.start ?? m.Start)
      end = Number(m.end ?? m.End)
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        // Some payloads nest under matches[0]
        const first = loc.matches?.[0]
        start = Number(first?.start)
        end = Number(first?.end)
      }
      if (Number.isFinite(end)) hint = end
    } catch (e) {
      console.warn(`  locate fail #${i}:`, e.code || e.message)
    }
    const op = {
      id: `p${i}`,
      start: Number.isFinite(start) ? start : undefined,
      end: Number.isFinite(end) ? end : undefined,
      originalText: zh,
      outputText: en
    }
    operations.push(op)
    report.paragraphs.push({ index: i, zh, en, start: op.start, end: op.end })
    console.log(`  + #${i} → ${en.slice(0, 70)}${en.length > 70 ? '…' : ''}`)
  }
  if (!operations.length) throw new Error('no translate operations (all skipped?)')
  pass('ops prepared', `count=${operations.length}`)

  step('4. Insert EN after each paragraph (bottom→top, avoid offset drift)')
  // Prefer per-paragraph document_insert(position=after): matches the user prompt
  // “翻译每一段…插入到每段后面”, and is more reliable than bulk apply_ops today.
  const ordered = [...operations].sort((a, b) => {
    const ae = Number.isFinite(a.end) ? a.end : -1
    const be = Number.isFinite(b.end) ? b.end : -1
    return be - ae
  })
  let inserted = 0
  const insertErrors = []
  for (const op of ordered) {
    try {
      // Preview first (optional soft check)
      await tool('document_insert', {
        text: `\n${op.outputText}`,
        position: 'after',
        originalText: op.originalText,
        start: op.start,
        end: op.end,
        confirmed: false
      })
      const res = await tool('document_insert', {
        text: `\n${op.outputText}`,
        position: 'after',
        originalText: op.originalText,
        start: op.start,
        end: op.end,
        confirmed: true
      })
      inserted++
      console.log(`  + after「${op.originalText.slice(0, 16)}…」 → ${res?.action || 'after'}`)
      report.ops.push({ id: op.id, ok: true, action: res?.action })
    } catch (e) {
      insertErrors.push({ id: op.id, code: e.code, message: e.message })
      console.warn(`  ! fail ${op.id}:`, e.code || e.message)
      report.ops.push({ id: op.id, ok: false, code: e.code, message: e.message })
    }
  }
  pass('inserts', `ok=${inserted} fail=${insertErrors.length}`)
  if (inserted === 0) throw new Error('no paragraphs received EN insert')

  step('6. Verify interleaving')
  const final = await tool('document_get_text', { force: true })
  const finalParas = splitParagraphs(final.text)
  console.log('--- final paragraphs ---')
  finalParas.forEach((p, i) => console.log(`  [${i}] ${p}`))
  console.log('------------------------')

  let verified = 0
  if (!EXISTING_DOC) {
    // Expect: ZH0, EN0, ZH1, EN1, ZH2, EN2
    for (let i = 0; i < SAMPLE_PARAS.length; i++) {
      const zhAt = finalParas.indexOf(SAMPLE_PARAS[i])
      const en = TRANSLATIONS[SAMPLE_PARAS[i]]
      const enAt = finalParas.indexOf(en)
      const okPair = zhAt >= 0 && enAt === zhAt + 1
      console.log(
        okPair ? `  OK pair #${i}` : `  FAIL pair #${i}`,
        `zh@${zhAt} en@${enAt}`
      )
      if (okPair) verified++
    }
    if (verified !== SAMPLE_PARAS.length) {
      throw new Error(`interleave verify failed: ${verified}/${SAMPLE_PARAS.length}`)
    }
    pass('interleave', `${verified}/${SAMPLE_PARAS.length} pairs`)
  } else {
    // Existing doc: at least as many EN markers / translated lines as ops
    const enCount = finalParas.filter(
      (p) =>
        /^\[EN\]\s/.test(p) ||
        operations.some((op) => op.outputText && p.includes(op.outputText.slice(0, 24)))
    ).length
    verified = enCount
    pass('en lines present', `count≈${enCount}`)
    if (enCount < Math.min(3, operations.length)) {
      throw new Error(`too few EN insertions: ${enCount}`)
    }
  }

  report.finalCharCount = final.charCount
  report.finalParagraphCount = finalParas.length
  report.verifiedPairs = verified
  report.finalPreview = finalParas.slice(0, 24)

  const outDir = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
    'chayuan-wps',
    'mcp'
  )
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'scenario-para-translate-en.json')
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8')
  console.log('\n========== SCENARIO GO ==========')
  console.log('report →', outFile)
}

main().catch((e) => {
  console.error('\n========== SCENARIO FAIL ==========')
  console.error(e.code || '', e.message)
  if (e.details) console.error(JSON.stringify(e.details).slice(0, 800))
  process.exit(1)
})
