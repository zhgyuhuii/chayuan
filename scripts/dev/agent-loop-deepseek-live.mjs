#!/usr/bin/env node
/* eslint-env node */
/**
 * 诊断：agent-core 迁移后的内循环 + 真实 DeepSeek + 仿真文档工具回报。
 *
 * 背景：用户报「打开文档，提示词=帮我查找错别字并批注出来，迁移后没法正常批注」。
 * WPS 加载项在本机无法加载（jsaddons 信任链问题），但迁移(a93e841)只改了
 * loop/transport/skill 三层——工具执行层（sidecar→WPS dispatch）未动。
 * 本脚本锁定被改动层：真实 DeepSeek 模型行为 + 真实循环代码 + 工具目录/schema
 * 取自 sidecar（tools/list 静态可取），工具「执行结果」用仿真回报（形状对照
 * spellCheckService 实际输出）。
 *
 * 用法：DEEPSEEK_API_KEY=sk-xxx node scripts/dev/agent-loop-deepseek-live.mjs [提示词]
 */
import { build } from 'esbuild'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const KEY = process.env.DEEPSEEK_API_KEY || ''
const PROMPT = process.argv[2] || '帮我查找错别字并批注出来'
if (!KEY) {
  console.error('missing DEEPSEEK_API_KEY')
  process.exit(2)
}

const DOC_TEXT = [
  '察元智能文档测试稿',
  '今天天汽真好，我们一起去公圆散步。他昨天壹直在图书管看书，回来时买了一框苹果。',
  '这篇文章的主题思想表达的非常深刻，但是里面有几处错别字需要修改。',
  '老师说要按时的完成作业，不能拖廷。同学们都表示赞称。'
].join('\n')

const PROOFREAD_ISSUES = [
  { chunkIndex: 0, issues: [
    { text: '天汽', suggestion: '天气', type: 'typo', reason: '错别字：汽→气' },
    { text: '公圆', suggestion: '公园', type: 'typo', reason: '错别字：圆→园' },
    { text: '壹直', suggestion: '一直', type: 'typo', reason: '错别字：壹→一' },
    { text: '图书管', suggestion: '图书馆', type: 'typo', reason: '错别字：管→馆' },
    { text: '一框苹果', suggestion: '一筐苹果', type: 'typo', reason: '错别字：框→筐' }
  ] },
  { chunkIndex: 1, issues: [
    { text: '拖廷', suggestion: '拖延', type: 'typo', reason: '错别字：廷→延' },
    { text: '赞称', suggestion: '赞成', type: 'typo', reason: '错别字：称→成' }
  ] }
]

/* ── 桩：chatApi 走真实 DeepSeek；工具执行用仿真回报 ── */

const STUBS = {
  [join(REPO, 'src/utils/chatApi.js')]: `
    export async function chatCompletionMessage(body) {
      const log = globalThis.__DIAG__
      const tools = Array.isArray(body.tools) ? body.tools : []
      const messages = [
        ...(body.messages || [])
      ]
      const payload = {
        model: globalThis.__DIAG__.apiModel,
        messages,
        stream: false,
        ...(tools.length ? { tools, tool_choice: body.tool_choice || 'auto' } : {})
      }
      log.turns.push({ kind: 'request', tools: tools.length, messages: messages.map(m => ({ role: m.role, head: String(m.content ?? JSON.stringify(m.tool_calls ?? '')).slice(0, 160) })) })
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + globalThis.__DIAG__.key },
        body: JSON.stringify(payload)
      })
      const text = await res.text()
      if (!res.ok) {
        log.turns.push({ kind: 'http-error', status: res.status, body: text.slice(0, 500) })
        throw new Error('DeepSeek ' + res.status + ': ' + text.slice(0, 300))
      }
      const data = JSON.parse(text)
      const msg = data.choices?.[0]?.message || {}
      log.turns.push({ kind: 'response', content: String(msg.content || ''), reasoning: String(msg.reasoning_content || '').slice(0, 120), tool_calls: (msg.tool_calls || []).map(c => ({ id: c.id, name: c.function?.name, arguments: c.function?.arguments })) })
      console.log('[model] ->', JSON.stringify((msg.tool_calls || []).map(c => c.function?.name)), 'content:', String(msg.content || '').slice(0, 100))
      return { role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls || [], raw: data }
    }
  `,
  [join(REPO, 'src/services/mcpBridge/mcpServerRegistry.js')]: `
    export const CHAYUAN_SERVER_ID = 'chayuan'
    export function getEnabledMcpServers() {
      return [{ id: 'chayuan', name: '察元 MCP' }]
    }
    export function isChayuanToolAllowed(name) {
      return !String(name).startsWith('declassify_')
    }
    export function namespaceToolName(serverId, toolName) {
      return serverId + '__' + toolName
    }
    export function parseNamespacedTool(ns) {
      const i = String(ns).indexOf('__')
      if (i < 0) return { serverId: '', toolName: String(ns) }
      return { serverId: String(ns).slice(0, i), toolName: String(ns).slice(i + 2) }
    }
  `,
  [join(REPO, 'src/services/mcpBridge/mcpHttpClient.js')]: `
    export async function healthz() {
      return { online: true }
    }
    export async function initializeLocal() {}
    export async function listLocalTools() {
      return globalThis.__DIAG__.toolCatalog
    }
    export async function listUpstreamTools() { return [] }
    export async function syncUpstreamAllowlist() {}
    export async function callLocalTool(name, args) {
      const log = globalThis.__DIAG__
      console.log('[tool exec]', name, JSON.stringify(args).slice(0, 220))
      log.toolCalls.push({ name, args })
      const doc = globalThis.__DIAG__.docText
      switch (name) {
        case 'document_meta':
          return { ok: true, name: 'typos.docx', charCount: doc.length, paragraphCount: 5, structuredContent: { ok: true, name: 'typos.docx', charCount: doc.length, paragraphCount: 5 } }
        case 'document_get_text':
          return { ok: true, text: doc, structuredContent: { ok: true, text: doc } }
        case 'document_chunks':
          return { ok: true, chunks: [{ start: 0, end: doc.length, text: doc }], nextCursor: null, structuredContent: { ok: true, chunks: [{ start: 0, end: doc.length, text: doc }], nextCursor: null } }
        case 'document_list_paragraphs':
          return { ok: true, paragraphs: doc.split('\\n').map((text, i) => ({ index: i, text })), structuredContent: { ok: true } }
        case 'document_locate':
          return { ok: true, matches: [], structuredContent: { ok: true, matches: [] } }
        case 'proofread_run': {
          const all = globalThis.__DIAG__.issues.flatMap(c => c.issues)
          return {
            ok: true,
            isError: false,
            taskId: 'task-diag-001',
            scope: args?.scope || 'document',
            dryRun: args?.dryRun !== false,
            issueCount: all.length,
            issues: globalThis.__DIAG__.issues,
            summary: '发现 ' + all.length + ' 处疑似错别字',
            structuredContent: {
              ok: true, taskId: 'task-diag-001', scope: args?.scope || 'document',
              issueCount: all.length, issues: globalThis.__DIAG__.issues,
              summary: '发现 ' + all.length + ' 处疑似错别字'
            }
          }
        }
        case 'comment':
          return { ok: true, added: 1, structuredContent: { ok: true, added: 1 } }
        default:
          return { ok: true, tool: name, structuredContent: { ok: true, tool: name } }
      }
    }
    export async function callUpstreamTool() { return { ok: true } }
  `,
  [join(REPO, 'src/utils/taskListStore.js')]: `
    export function getActiveTask() { return null }
  `
}

const stubPlugin = {
  name: 'diag-stubs',
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

/* ── 拉取 sidecar 真实工具目录 → 注入 → 跑编排器 ── */

async function fetchToolCatalog() {
  const init = await fetch('http://127.0.0.1:62588/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'diag', version: '0' } } })
  })
  const list = await fetch('http://127.0.0.1:62588/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  })
  const data = await list.json()
  const tools = data?.result?.tools || []
  if (!tools.length) throw new Error('sidecar tools/list empty — sidecar online?')
  return tools
}

const runnerSource = `
const { runMcpChatOrchestrator } = await import('./ORCH_IMPORT')
globalThis.__DIAG__ = __DIAG_JSON__
const result = await runMcpChatOrchestrator({
  userText: __PROMPT_JSON__,
  model: { providerId: 'DEEPSEEK', modelId: 'deepseek-chat', id: 'DEEPSEEK|deepseek-chat', name: 'DeepSeek' },
  selectionCtx: { hasSelection: false, fileName: 'typos.docx' },
  kbBound: false,
  historyMessages: [],
  onProgress: (step) => console.log('[step]', step.label, '|', String(step.detail || '').slice(0, 110))
})
const diag = globalThis.__DIAG__
console.log('\\n===== RESULT =====')
console.log(JSON.stringify({ ok: result.ok, fallback: result.fallback, reason: result.reason, content: (result.content || '').slice(0, 900), proofreadCard: result.proofreadCard ? { taskId: result.proofreadCard.taskId, issueCount: result.proofreadCard.issueCount, intent: result.proofreadCard.intent } : null, pendingConfirms: result.pendingConfirms, steps: (result.steps || []).map(s => s.label) }, null, 2))
console.log('\\n===== MODEL TURNS =====')
for (const t of diag.turns) console.log(JSON.stringify(t).slice(0, 400))
console.log('\\n===== TOOL EXECUTIONS =====')
for (const c of diag.toolCalls) console.log(c.name, JSON.stringify(c.args).slice(0, 160))
`

async function main() {
  const catalog = await fetchToolCatalog()
  console.log(`[diag] sidecar tool catalog: ${catalog.length} tools`)
  const diag = {
    key: KEY,
    apiModel: 'deepseek-chat',
    toolCatalog: catalog,
    docText: DOC_TEXT,
    issues: PROOFREAD_ISSUES,
    turns: [],
    toolCalls: []
  }
  const tmp = await mkdtemp(join(tmpdir(), 'agent-diag-'))
  const runner = join(tmp, 'runner.mjs')
  await writeFile(runner, runnerSource
    .replace('./ORCH_IMPORT', join(REPO, 'src/services/mcpBridge/mcpChatOrchestrator.js'))
    .replace('__DIAG_JSON__', JSON.stringify(diag))
    .replace('__PROMPT_JSON__', JSON.stringify(PROMPT)))
  try {
    await build({ entryPoints: [runner], bundle: true, platform: 'browser', format: 'esm', outfile: join(tmp, 'bundle.mjs'), plugins: [stubPlugin], logLevel: 'silent' })
    const res = spawnSync(process.execPath, [join(tmp, 'bundle.mjs')], { encoding: 'utf8', timeout: 240000, maxBuffer: 32 * 1024 * 1024 })
    process.stdout.write(res.stdout || '')
    if (res.stderr) process.stderr.write('\n[stderr] ' + res.stderr.slice(0, 2000))
    process.exitCode = 0
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch(e => { console.error('[diag] failed:', e); process.exit(1) })
