#!/usr/bin/env node
/**
 * Open a desktop doc via MCP and apply visible format demos + comments.
 * Usage: node scripts/mcp-demo-visible-verify.mjs [path-to.docx]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const PORT = Number(process.env.CHAYUAN_MCP_PORT || 62588)
const BASE = `http://127.0.0.1:${PORT}`

let rpcId = 1
const results = []

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  return { ok: res.ok, status: res.status, data }
}

async function mcp(method, params = {}) {
  const id = rpcId++
  const r = await fetchJson(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  })
  if (r.data?.error) {
    const e = new Error(r.data.error.message || 'rpc error')
    e.code = r.data.error.code
    e.data = r.data.error
    throw e
  }
  return r.data?.result
}

async function tool(name, args = {}) {
  const t0 = Date.now()
  try {
    const result = await mcp('tools/call', { name, arguments: args })
    const content = result?.content
    let parsed = result
    if (Array.isArray(content)) {
      const text = content.map((c) => c?.text || '').join('\n')
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = { text, isError: result?.isError }
      }
    }
    const ok = !(result?.isError || parsed?.error || parsed?.code)
    results.push({ name, ok, ms: Date.now() - t0, detail: summarize(parsed) })
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} ${Date.now() - t0}ms ${summarize(parsed)}`)
    return parsed
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, detail: e.message })
    console.log(`[FAIL] ${name} ${Date.now() - t0}ms ${e.message}`)
    return { error: e.message, code: e.code }
  }
}

function summarize(v) {
  try {
    const s = JSON.stringify(v)
    return s.length > 180 ? s.slice(0, 180) + '…' : s
  } catch {
    return String(v)
  }
}

function resolveDocPath() {
  const arg = process.argv[2]
  if (arg && fs.existsSync(arg)) return path.resolve(arg)
  const tip = path.join(root, '.tmp-demo-doc-path.txt')
  if (fs.existsSync(tip)) {
    const p = fs.readFileSync(tip, 'utf8').trim().replace(/^\uFEFF/, '')
    if (p && fs.existsSync(p)) return p
  }
  const desktop = path.join(process.env.USERPROFILE || '', 'Desktop')
  const files = fs.readdirSync(desktop).filter((n) => n.endsWith('.docx'))
  const hit = files.find((n) => n.includes('妈妈') || n.includes('唠叨'))
  if (hit) return path.join(desktop, hit)
  throw new Error('找不到桌面《爱唠叨的妈妈.docx》')
}

const SAMPLES = [
  { key: 'bold', text: '【样本·加粗】妈妈总爱唠叨' },
  { key: 'strike', text: '【样本·删除线】这句话将被划掉样式' },
  { key: 'font', text: '【样本·楷体】字体改为楷体效果' },
  { key: 'size', text: '【样本·字号】字号调整为18磅' },
  { key: 'color', text: '【样本·红色】文字颜色改为红色' },
  { key: 'italic', text: '【样本·斜体下划线】斜体并加下划线' },
  { key: 'highlight', text: '【样本·高亮】这段文字加黄色高亮' },
  { key: 'para', text: '【样本·段落居中】本段将居中对齐' },
  { key: 'style', text: '【样本·标题样式】应用标题样式可见' },
  { key: 'batch', text: '【样本·批量格式】批量工具一次改样子' },
  { key: 'replace', text: '【样本·替换前】原文将被替换为新词' },
  { key: 'insert', text: '【样本·插入锚点】其后会插入一行说明' }
]

async function main() {
  const docPath = resolveDocPath()
  console.log('[demo] doc=', docPath)

  const health = await fetchJson(`${BASE}/healthz`)
  if (!health.ok) throw new Error('sidecar offline')
  if (!health.data?.agent?.agentOnline) throw new Error('WPS Agent offline — 请保持 WPS/加载项在线')

  await mcp('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mcp-demo-visible-verify', version: '1.0.0' }
  })

  await tool('wps_status', {})
  let opened = await tool('document_open', {
    path: docPath,
    viaOs: true,
    force: true,
    activate: true
  })
  // Retry until active document name matches the target file
  const want = path.basename(docPath).replace(/\.docx$/i, '')
  for (let i = 0; i < 8; i++) {
    const meta = await tool('document_meta', {})
    const name = String(meta?.name || meta?.document?.name || '')
    const full = String(meta?.fullName || meta?.document?.fullName || '')
    console.log(`[demo] active=${name} full=${full}`)
    if (name.includes(want) || full.includes(want) || full.replace(/\//g, '\\').includes(docPath.replace(/\//g, '\\'))) {
      opened = meta
      break
    }
    await new Promise((r) => setTimeout(r, 1500))
    opened = await tool('document_open', { path: docPath, viaOs: true, force: true, activate: true })
  }
  const paras = await tool('document_list_paragraphs', { limit: 20 })
  void opened

  const appendix =
    '\n\n———————— MCP 工具可见验证（请对照批注） ————————\n' +
    SAMPLES.map((s) => s.text).join('\n') +
    '\n'

  await tool('document_insert', {
    text: appendix,
    position: 'append',
    confirmed: true
  })
  await tool('document_add_comment', {
    text: '实现了MCP工具-document_insert功能：文末追加验证样本区',
    originalText: '———————— MCP 工具可见验证（请对照批注） ————————',
    confirmed: true
  })

  // format_run demos
  const runDemos = [
    { text: SAMPLES[0].text, changes: { bold: true }, label: 'format_run：加粗' },
    { text: SAMPLES[1].text, changes: { strike: true }, label: 'format_run：删除线' },
    { text: SAMPLES[2].text, changes: { name: '楷体' }, label: 'format_run：调整字体(楷体)' },
    { text: SAMPLES[3].text, changes: { size: 18 }, label: 'format_run：调整字体大小(18pt)' },
    { text: SAMPLES[4].text, changes: { color: '#FF0000' }, label: 'format_run：文字颜色红色' },
    { text: SAMPLES[5].text, changes: { italic: true, underline: true }, label: 'format_run：斜体+下划线' },
    { text: SAMPLES[6].text, changes: { highlight: 'yellow' }, label: 'format_run：高亮' }
  ]

  for (const d of runDemos) {
    await tool('format_run', { originalText: d.text, changes: d.changes, confirmed: true })
    await tool('document_add_comment', {
      text: `实现了MCP工具-${d.label}`,
      originalText: d.text,
      confirmed: true
    })
  }

  await tool('format_para', {
    originalText: SAMPLES[7].text,
    changes: { align: 'center', lineSpacing: 1.5 },
    confirmed: true
  })
  await tool('document_add_comment', {
    text: '实现了MCP工具-format_para功能：段落居中+1.5倍行距',
    originalText: SAMPLES[7].text,
    confirmed: true
  })

  const styles = await tool('style_list', { headingOnly: true, limit: 20 })
  const styleName =
    styles?.styles?.[0]?.name ||
    styles?.items?.[0]?.name ||
    styles?.list?.[0]?.name ||
    '标题 1'
  await tool('style_apply', {
    styleName,
    originalText: SAMPLES[8].text,
    confirmed: true
  })
  await tool('document_add_comment', {
    text: `实现了MCP工具-style_apply功能：应用样式「${styleName}」`,
    originalText: SAMPLES[8].text,
    confirmed: true
  })

  await tool('format_apply_ops', {
    confirmed: true,
    operations: [
      { originalText: SAMPLES[9].text, changes: { bold: true, color: '#0000FF', size: 14 } }
    ]
  })
  await tool('document_add_comment', {
    text: '实现了MCP工具-format_apply_ops功能：批量加粗+蓝色+14pt',
    originalText: SAMPLES[9].text,
    confirmed: true
  })

  const fonts = await tool('system_fonts_list', { query: '宋', limit: 10 })
  await tool('document_add_comment', {
    text: `实现了MCP工具-system_fonts_list功能：检索到字体数≈${
      fonts?.fonts?.length || fonts?.names?.length || fonts?.count || '见返回'
    }`,
    originalText: SAMPLES[2].text,
    confirmed: true
  })

  const loc = await tool('nav_location', { originalText: SAMPLES[0].text })
  await tool('document_add_comment', {
    text: `实现了MCP工具-nav_location功能：定位信息 ${summarize(loc)}`,
    originalText: SAMPLES[0].text,
    confirmed: true
  })

  await tool('document_replace', {
    originalText: '【样本·替换前】原文将被替换为新词',
    newText: '【样本·替换后】MCP已完成替换验证',
    confirmed: true
  })
  await tool('document_add_comment', {
    text: '实现了MCP工具-document_replace功能：原文替换为新词',
    originalText: '【样本·替换后】MCP已完成替换验证',
    confirmed: true
  })

  await tool('document_insert', {
    text: '\n【样本·插入结果】这是 document_insert(position=after) 插入的一行',
    position: 'after',
    originalText: SAMPLES[11].text,
    confirmed: true
  })
  await tool('document_add_comment', {
    text: '实现了MCP工具-document_insert(after)功能：锚点段落后插入说明行',
    originalText: '【样本·插入结果】这是 document_insert(position=after) 插入的一行',
    confirmed: true
  })

  const comments = await tool('comment_list', { limit: 50 })
  await tool('document_add_comment', {
    text: `实现了MCP工具-comment_list功能：当前批注约 ${
      comments?.comments?.length || comments?.total || comments?.count || '见返回'
    } 条`,
    originalText: '———————— MCP 工具可见验证（请对照批注） ————————',
    confirmed: true
  })

  // soft / read tools leave a breadcrumb comment on title line of appendix
  const revMode = await tool('revision_mode', { enabled: true, show: true })
  await tool('document_add_comment', {
    text: `实现了MCP工具-revision_mode功能：已开启修订 ${summarize(revMode)}`,
    originalText: SAMPLES[1].text,
    confirmed: true
  })
  // tiny visible track-change then list
  await tool('document_replace', {
    originalText: '【样本·删除线】这句话将被划掉样式',
    newText: '【样本·删除线】这句话将被划掉样式（修订痕迹）',
    confirmed: true
  })
  await tool('revision_mode', { enabled: false, show: true })

  const revList = await tool('revision_list', { limit: 10 })
  await tool('document_add_comment', {
    text: `实现了MCP工具-revision_list功能：${summarize(revList)}`,
    originalText: SAMPLES[3].text,
    confirmed: true
  })

  await tool('nav_pane_set', { visible: true })
  await tool('document_add_comment', {
    text: '实现了MCP工具-nav_pane_set功能：尝试打开导航窗格',
    originalText: SAMPLES[4].text,
    confirmed: true
  })

  // Keep portrait; only bump top margin slightly so change is visible but printable
  const layout = await tool('layout_page', {
    orientation: 'portrait',
    marginTop: 2.54,
    confirmed: true
  })
  await tool('document_add_comment', {
    text: `实现了MCP工具-layout_page功能：竖向+上边距约2.54cm ${summarize(layout)}`,
    originalText: SAMPLES[5].text,
    confirmed: true
  })

  await tool('break_insert', {
    kind: 'page',
    originalText: SAMPLES[11].text,
    confirmed: true
  })
  await tool('document_add_comment', {
    text: '实现了MCP工具-break_insert功能：在插入锚点后加了分页符（往后翻页可见）',
    originalText: SAMPLES[11].text,
    confirmed: true
  })

  // locate + chunks + get_text + meta already partially used
  await tool('document_locate', { text: '妈妈', maxMatches: 3 })
  await tool('document_chunks', { cursor: 0, limit: 1, chunkLength: 400 })
  await tool('document_get_text', {})
  await tool('kb_retrieve', { query: '妈妈' })
  await tool('assistants_list_domains', {})
  await tool('assistants_search', { query: '校对', limit: 3 })
  await tool('declassify_status', {})
  await tool('proofread_job_poll', { jobId: 'demo-nonexistent' })

  await tool('document_add_comment', {
    text: '实现了MCP工具-document_locate/document_chunks/document_get_text/kb_retrieve 等只读调用（已自动跑通）',
    originalText: SAMPLES[6].text,
    confirmed: true
  })

  await tool('document_save', { path: docPath })

  const out = path.join(root, 'mcp-sidecar', 'last-demo-visible-verify.json')
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        docPath,
        parasHint: paras,
        results,
        pass: results.filter((r) => r.ok).length,
        fail: results.filter((r) => !r.ok).length
      },
      null,
      2
    ),
    'utf8'
  )
  console.log(`[demo] report → ${out}`)
  console.log(`[demo] pass=${results.filter((r) => r.ok).length} fail=${results.filter((r) => !r.ok).length}`)
}

main().catch((e) => {
  console.error('[demo] fatal', e)
  process.exit(1)
})
