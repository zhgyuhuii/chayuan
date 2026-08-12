#!/usr/bin/env node
/**
 * Supplemental visible demo: blank page + TOC on the desktop essay.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const PORT = Number(process.env.CHAYUAN_MCP_PORT || 62588)
const BASE = `http://127.0.0.1:${PORT}`
let rpcId = 1

async function mcp(method, params = {}) {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'rpc error')
  return data.result
}

async function tool(name, args = {}) {
  const t0 = Date.now()
  const result = await mcp('tools/call', { name, arguments: args })
  let parsed = result
  if (Array.isArray(result?.content)) {
    const text = result.content.map((c) => c?.text || '').join('\n')
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { text, isError: result?.isError }
    }
  }
  const ok = !(result?.isError || parsed?.error || parsed?.code)
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name} ${Date.now() - t0}ms ${JSON.stringify(parsed).slice(0, 200)}`)
  if (!ok) throw new Error(`${name} failed: ${JSON.stringify(parsed)}`)
  return parsed
}

function resolveDocPath() {
  const tip = path.join(root, '.tmp-demo-doc-path.txt')
  if (fs.existsSync(tip)) {
    const p = fs.readFileSync(tip, 'utf8').trim().replace(/^\uFEFF/, '')
    if (p && fs.existsSync(p)) return p
  }
  const desktop = path.join(process.env.USERPROFILE || '', 'Desktop')
  const hit = fs.readdirSync(desktop).find((n) => n.includes('妈妈') && n.endsWith('.docx'))
  if (!hit) throw new Error('doc not found')
  return path.join(desktop, hit)
}

async function main() {
  const docPath = resolveDocPath()
  console.log('[demo2] doc=', docPath)
  const health = await (await fetch(`${BASE}/healthz`)).json()
  if (!health?.agent?.agentOnline) throw new Error('agent offline')

  await mcp('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mcp-demo-toc-blank', version: '1.0.0' }
  })

  await tool('document_open', { path: docPath, viaOs: true, force: true, activate: true })
  const want = path.basename(docPath)
  let meta = null
  for (let i = 0; i < 12; i++) {
    meta = await tool('document_meta', {})
    const name = String(meta?.name || '')
    const full = String(meta?.fullName || '')
    console.log(`[demo2] active=${name}`)
    if (name.includes('妈妈') || full.includes('妈妈') || full.includes(want)) break
    await new Promise((r) => setTimeout(r, 1500))
    await tool('document_open', { path: docPath, viaOs: true, force: true, activate: true })
    if (i === 11) throw new Error(`active doc is still ${name}, expected ${want}`)
  }

  // Ensure title is Heading 1 so TOC has at least one entry
  await tool('style_apply', {
    styleName: '标题 1',
    originalText: '爱唠叨的妈妈',
    confirmed: true
  })
  await tool('document_add_comment', {
    text: '实现了MCP工具-style_apply功能：正文标题设为「标题 1」供目录收录',
    originalText: '爱唠叨的妈妈',
    confirmed: true
  })

  // Insert TOC near document start (before title)
  await tool('toc_insert', {
    confirmed: true,
    title: '目录',
    upperLevel: 1,
    lowerLevel: 3,
    originalText: '爱唠叨的妈妈',
    position: 'before'
  })
  await tool('document_add_comment', {
    text: '实现了MCP工具-toc_insert功能：在文首插入自动目录（可 Ctrl 点击跳转）',
    originalText: '目录',
    confirmed: true
  })

  await tool('toc_update', { confirmed: true, index: 1 })
  await tool('document_add_comment', {
    text: '实现了MCP工具-toc_update功能：已刷新目录条目/页码',
    originalText: '目录',
    confirmed: true
  })

  // Marker + blank page near verification appendix
  const marker = '【样本·空白页】下一工具将插入一整页空白'
  await tool('document_insert', {
    text: `\n${marker}\n`,
    position: 'append',
    confirmed: true
  })
  await tool('page_blank_insert', {
    confirmed: true,
    position: 'after',
    originalText: marker
  })
  await tool('document_add_comment', {
    text: '实现了MCP工具-page_blank_insert功能：在此标记后插入空白页（翻页可见整页空白）',
    originalText: marker,
    confirmed: true
  })

  await tool('document_save', { path: docPath })
  console.log('[demo2] done — saved', docPath)
}

main().catch((e) => {
  console.error('[demo2] fatal', e)
  process.exit(1)
})
