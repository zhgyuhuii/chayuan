#!/usr/bin/env node
/* eslint-env node */
/**
 * 迁移后综合验收：内置 agent 循环 + 提示词触发助手 + 任务执行 + 单助手直执行。
 *
 * 框架：真实 DeepSeek + 真实 AgentLoop + 真实 dispatch（含 4500+ 助手目录的
 * assistants.search/get）+ 仿真文档回报。场景：
 *   T1 提示词模糊意图 → 是否会自主发现 assistants_search 并触发
 *   T2 明确文档任务   → 是否按系统提示词走格式/替换工具并执行
 *   T3 摘要类指令     → 是否通读文档后产出摘要（assistant 式直执行）
 *
 * 用法：DEEPSEEK_API_KEY=sk-xxx node scripts/dev/agent-assistants-live.mjs
 */
import { build } from 'esbuild'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const KEY = process.env.DEEPSEEK_API_KEY || ''
if (!KEY) { console.error('missing DEEPSEEK_API_KEY'); process.exit(2) }

const DOC_TEXT = [
  '产品部季度总结',
  '本季度销售额完成了目标的百分之九十，相比上季度有所提升。',
  '用户反馈集中在安装流程复杂、界面不够直观两个问题上。',
  '下季度计划优化新手指引，并增加模板中心。'
].join('\n')

const STUBS = {
  [join(REPO, 'src/utils/chatApi.js')]: `
    export async function chatCompletionMessage(body) {
      const tools = Array.isArray(body.tools) ? body.tools : []
      globalThis.__T__.turns.push(tools.length)
      const payload = { model: 'deepseek-chat', messages: body.messages, stream: false,
        ...(tools.length ? { tools, tool_choice: 'auto' } : {}) }
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + globalThis.__T__.key },
        body: JSON.stringify(payload)
      })
      const text = await res.text()
      if (!res.ok) throw new Error('DeepSeek ' + res.status + ': ' + text.slice(0, 160))
      const msg = JSON.parse(text).choices?.[0]?.message || {}
      console.log('[model]', JSON.stringify((msg.tool_calls || []).map(c => c.function?.name)), '|', String(msg.content || '').slice(0, 80).replace(/\\n/g, ' '))
      return { role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls || [], raw: {} }
    }
    export async function chatCompletion(opts = {}) {
      // dispatch 内部（脱敏服务等）用的非流式补全——本轮测试不覆盖其细节
      return ''
    }
    export async function streamChatCompletion() {}
  `,
  [join(REPO, 'src/services/mcpBridge/mcpServerRegistry.js')]: `
    export const CHAYUAN_SERVER_ID = 'chayuan'
    export function getEnabledMcpServers() { return [{ id: 'chayuan', name: '察元 MCP' }] }
    export function isChayuanToolAllowed(name) { return !String(name).startsWith('declassify_') }
    export function namespaceToolName(s, t) { return s + '__' + t }
    export function parseNamespacedTool(ns) {
      const i = String(ns).indexOf('__')
      if (i < 0) return { serverId: '', toolName: String(ns) }
      return { serverId: String(ns).slice(0, i), toolName: String(ns).slice(i + 2) }
    }
  `,
  // 只桩 callLocalTool 的「文档执行」半边（需要 WPS 的部分）；assistants_* 走
  // 真实 dispatch（esbuild 直接打包 assistantsDispatch → assistantDomainManifest）
  [join(REPO, 'src/services/mcpBridge/mcpHttpClient.js')]: `
    export async function healthz() { return { online: true, ok: true, agentOnline: true } }
    export async function initializeLocal() {}
    export async function listLocalTools() { return globalThis.__T__.toolCatalog }
    export async function listUpstreamTools() { return [] }
    export async function syncUpstreamAllowlist() {}
    export async function callUpstreamTool() { return { ok: true } }
    export async function callLocalTool(name, args) {
      const log = globalThis.__T__
      if (log) log.toolCalls.push({ name, args })
      console.log('[tool]', name, JSON.stringify(args || {}).slice(0, 140))
      // assistants_* 走真实 dispatch（4500+ 助手目录）；其余文档工具用仿真回报
      if (name === 'assistants_search' || name === 'assistants_get' || name === 'assistants_list_domains') {
        const { dispatchMcpJob } = await import('__DISPATCH__')
        const method = name === 'assistants_search' ? 'assistants.search'
          : name === 'assistants_get' ? 'assistants.get' : 'assistants.list_domains'
        return await dispatchMcpJob({ method, params: args || {} })
      }
      const doc = (globalThis.__T__ || {}).docText || ''
      switch (name) {
        case 'document_meta':
          return { ok: true, name: 'q3.docx', charCount: doc.length, structuredContent: { ok: true, name: 'q3.docx', charCount: doc.length } }
        case 'document_get_text':
          return { ok: true, text: doc, structuredContent: { ok: true, text: doc } }
        case 'document_chunks':
          return { ok: true, chunks: [{ start: 0, end: doc.length, text: doc }], nextCursor: null, structuredContent: { ok: true, chunks: [{ start: 0, end: doc.length, text: doc }], nextCursor: null } }
        case 'document_apply_ops':
          return { ok: true, applied: (args?.operations || args?.ops || []).length, dryRun: args?.dryRun === true, structuredContent: { ok: true, applied: (args?.operations || args?.ops || []).length } }
        case 'document_replace':
          return { ok: true, replaced: 1, structuredContent: { ok: true, replaced: 1 } }
        case 'format_run':
          return { ok: true, formatted: 1, structuredContent: { ok: true, formatted: 1 } }
        case 'format_apply_ops':
          return { ok: true, formatted: (args?.operations || []).length, structuredContent: { ok: true, formatted: (args?.operations || []).length } }
        case 'document_add_comment':
          return { ok: true, added: 1, structuredContent: { ok: true, added: 1 } }
        default:
          return { ok: true, tool: name, structuredContent: { ok: true, tool: name } }
      }
    }
  `,
  [join(REPO, 'src/utils/taskListStore.js')]: `
    export function getActiveTask() { return null }
    export function getTaskById() { return null }
    export function addTask(t) { return t }
    export function updateTask() { return null }
    export function initSync() {}
    export function subscribe() { return () => {} }
  `
}

const stubPlugin = {
  name: 't-stubs',
  setup(b) {
    const entries = Object.entries(STUBS).map(([abs, contents], i) => ({ abs, contents, ns: 'stub-' + i }))
    b.onResolve({ filter: /.*/ }, (args) => {
      if (!args.importer || !args.path.startsWith('.')) return undefined
      const abs = resolve(dirname(args.importer), args.path)
      const hit = entries.find(e => e.abs === abs)
      if (hit) return { path: abs, namespace: hit.ns }
      return undefined
    })
    for (const e of entries) {
      b.onLoad({ filter: /.*/, namespace: e.ns }, () => ({ contents: e.contents, loader: 'js', resolveDir: REPO }))
    }
  }
}

async function fetchToolCatalog() {
  const list = await fetch('http://127.0.0.1:62588/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
  })
  const tools = (await list.json())?.result?.tools || []
  if (!tools.length) throw new Error('sidecar offline?')
  return tools
}

const runnerSource = `
// node 环境跑 webview 代码的最小 window 桩（dispatch → globalSettings 链需要）
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { protocol: 'file:', href: 'file:///x/index.html' },
    Application: null
  }
}
import { runMcpChatOrchestrator } from './ORCH'
// __T__ 由每个场景的 runner 源码头部静态注入（子进程无法继承父进程内存）
const T = globalThis.__T__
const out = await runMcpChatOrchestrator({
  userText: T.prompt,
  model: { providerId: 'DEEPSEEK', modelId: 'deepseek-chat', id: 'DEEPSEEK|deepseek-chat', name: 'DeepSeek' },
  selectionCtx: { hasSelection: false, fileName: 'q3.docx' },
  onProgress: (s) => { if (!s.__progress) console.log('  [step]', s.label) }
})
const calls = (T.toolCalls || []).map(c => c.name)
console.log('OUTJSON:' + JSON.stringify({ ok: out.ok, fallback: out.fallback || '', content: String(out.content || '').slice(0, 260), calls }))
`

async function runScenario(name, prompt, toolCatalog) {
  console.log('\n========== ' + name + ' ==========')
  console.log('提示词:', prompt)
  const tmp = await mkdtemp(join(tmpdir(), 'agent-t-'))
  const runner = join(tmp, 'runner.mjs')
      const runnerCode = 'globalThis.__T__={key:' + JSON.stringify(KEY) + ',docText:' + JSON.stringify(DOC_TEXT) + ',prompt:' + JSON.stringify(prompt) + ',toolCalls:[],turns:[],toolCatalog:' + JSON.stringify(toolCatalog) + '};\n' +
    runnerSource
      .replace("'./ORCH'", JSON.stringify(join(REPO, 'src/services/mcpBridge/mcpChatOrchestrator.js')))
      .replace("'./DISPATCH'", JSON.stringify(join(REPO, 'src/services/mcpBridge/dispatch.js')))
  await writeFile(runner, runnerCode)
  globalThis.__T = { key: KEY, docText: DOC_TEXT, prompt, toolCalls: [], turns: [] }
  try {
    await build({
      entryPoints: [runner], bundle: true, platform: 'browser', format: 'esm',
      outfile: join(tmp, 'b.mjs'), logLevel: 'silent',
      plugins: [stubPlugin, {
        name: 't-stubs-dispatch',
        setup(b2) {
          // stub 源码里的 __DISPATCH__ 占位 → 真实 dispatch.js（define 替换为绝对路径）
          b2.onResolve({ filter: /__DISPATCH__/ }, () => ({ path: join(REPO, 'src/services/mcpBridge/dispatch.js'), external: false }))
        }
      }],
      define: { '__DISPATCH__': JSON.stringify(join(REPO, 'src/services/mcpBridge/dispatch.js')) }
    })
    const res = spawnSync(process.execPath, [join(tmp, 'b.mjs')], { encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 })
    process.stdout.write(res.stdout || '')
    if (res.stderr) process.stderr.write(String(res.stderr).slice(0, 800))
    const line = (res.stdout || '').split('\n').find(l => l.startsWith('OUTJSON:'))
    return line ? JSON.parse(line.slice(8)) : { ok: false, calls: [] }
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}

async function main() {
  const toolCatalog = await fetchToolCatalog()
  console.log(`[t] sidecar tool catalog: ${toolCatalog.length} tools`)
  const only = process.argv[2] // 可传 'T1'/'T2'/'T3' 只跑单场景
  const results = []
  const cases = [
    ['T1 提示词触发助手（模糊意图，应自主发现 assistants_search）', '帮我看看有没有合适的助手可以把这份季度总结改写得更专业'],
    ['T2 明确文档任务（格式+替换）', '把文档标题加粗，并把"百分之九十"改成"90%"'],
    ['T3 摘要类指令（助手式直执行）', '帮我把这篇季度总结精简成一段话的摘要']
  ].filter(([tag]) => !only || tag.startsWith(only))
  for (const [name, prompt] of cases) {
    const r = await runScenario(name, prompt, toolCatalog)
    results.push([name, r])
  }
  console.log('\n========== SUMMARY ==========')
  for (const [name, r] of results) {
    console.log((r.ok ? 'PASS' : 'FAIL'), '|', name)
    console.log('      tools:', JSON.stringify(r.calls))
  }
  process.exit(results.every(([, r]) => r.ok) ? 0 : 1)
}

main().catch(e => { console.error('[t] failed:', e?.message || e); process.exit(1) })
