#!/usr/bin/env node
/* eslint-env node */
/**
 * agent-loop 冒烟测试 — mcpChatOrchestrator 切换到 agent-core AgentLoop 内核后的行为锁定。
 *
 * 原理：用 esbuild（vite 自带依赖，零新增）把编排器连同 vendor 的 .ts 循环打包成单文件，
 * 浏览器侧依赖（chatApi / mcpHttpClient / mcpServerRegistry / taskListStore）以桩模块替换，
 * 桩通过 globalThis.__MOCK__ 由各场景注入脚本化响应。
 *
 * 用法：node scripts/test-agent-loop-smoke.mjs
 * 退出码 0 = 全部通过；1 = 有失败。
 */
import { build } from 'esbuild'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* ────────── 桩模块 ────────── */

const STUBS = {
  // src/utils/chatApi.js → 只暴露编排器用到的 chatCompletionMessage
  [join(REPO, 'src/utils/chatApi.js')]: `
    export async function chatCompletionMessage(body) {
      const m = globalThis.__MOCK__
      m.requests.push(body)
      const step = m.chatScript[m.chatIdx]
      m.chatIdx += 1
      if (!step) throw new Error('chat script exhausted')
      if (step.throw) throw step.throw
      await new Promise(r => setTimeout(r, step.delay || 0))
      return {
        role: 'assistant',
        content: step.content || '',
        tool_calls: step.tool_calls || [],
        raw: {}
      }
    }
  `,
  // src/services/mcpBridge/mcpServerRegistry.js
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
  // src/services/mcpBridge/mcpHttpClient.js
  [join(REPO, 'src/services/mcpBridge/mcpHttpClient.js')]: `
    export async function healthz() {
      return { online: true }
    }
    export async function initializeLocal() {}
    export async function listLocalTools() {
      return globalThis.__MOCK__.localTools
    }
    export async function listUpstreamTools() { return [] }
    export async function syncUpstreamAllowlist() {}
    export async function callLocalTool(name, args, { signal } = {}) {
      const m = globalThis.__MOCK__
      m.localCalls.push({ name, args })
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, m.toolDelay || 0)
        if (signal) signal.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })) }, { once: true })
      })
      if (m.localToolImpl) return m.localToolImpl(name, args)
      return { ok: true, tool: name, args }
    }
    export async function callUpstreamTool(serverId, toolName, args) {
      globalThis.__MOCK__.localCalls.push({ name: serverId + '__' + toolName, args })
      return { ok: true }
    }
  `,
  // src/utils/taskListStore.js
  [join(REPO, 'src/utils/taskListStore.js')]: `
    export function getActiveTask() { return null }
  `
}

const stubPlugin = {
  name: 'smoke-stubs',
  setup(b) {
    // esbuild 的 args.path 是相对导入串（'../../utils/chatApi.js'），需结合 importer 解析出绝对路径精确匹配
    const entries = Object.entries(STUBS).map(([abs, contents]) => ({ abs, contents, ns: 'stub-' + abs.length + '-' + hash(abs) }))
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

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/* ────────── 场景（在 bundle 里执行） ────────── */

const runnerSource = `
const A = (cond, msg) => { if (!cond) throw new Error('断言失败: ' + msg) }
const baseMock = (extra = {}) => {
  globalThis.__MOCK__ = {
    requests: [], chatScript: [], chatIdx: 0,
    localCalls: [],
    localTools: [
      { name: 'document_locate', description: '定位文本', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } },
      { name: 'document_replace', description: '替换文本', inputSchema: { type: 'object', properties: { originalText: { type: 'string' }, newText: { type: 'string' } } } },
      { name: 'proofread_run', description: '校对', inputSchema: { type: 'object', properties: { dryRun: { type: 'boolean' } } } }
    ],
    ...extra
  }
  return globalThis.__MOCK__
}
const toolCall = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } })
const run = (m) => import('./ORCH_IMPORT').then(mod => mod.runMcpChatOrchestrator({
  userText: '帮我处理文档',
  model: { providerId: 'DEEPSEEK', modelId: 'deepseek-chat', id: 'DEEPSEEK|deepseek-chat', name: 'DeepSeek' },
  ...m
}))

// 场景 1：正常工具循环（工具调用 → 结果回灌 → 文本收尾）
{
  const m = baseMock()
  m.chatScript = [
    { tool_calls: [toolCall('c1', 'chayuan__document_locate', { text: '错字' })] },
    { content: '找到了一处，已定位。' }
  ]
  const r = await run({})
  A(r.ok === true, 'S1 ok')
  A(r.content.includes('找到了一处'), 'S1 content: ' + r.content)
  A(m.localCalls.length === 1 && m.localCalls[0].name === 'document_locate', 'S1 tool executed')
  A(r.steps.some(s => s.label.startsWith('调用 chayuan__document_locate')), 'S1 step 调用')
  A(r.steps.some(s => s.label.startsWith('完成 chayuan__document_locate')), 'S1 step 完成')
  A(r.steps.some(s => s.label.startsWith('模型思考（第 1 轮）')), 'S1 step 模型思考')
  // 第二轮请求应包含 tool 结果消息（role:'tool' 配对 c1）
  const second = m.requests[1]
  A(second.messages.some(x => x.role === 'tool' && x.tool_call_id === 'c1'), 'S1 tool result paired')
  console.log('✓ S1 正常工具循环')
}

// 场景 2：写操作无 confirmHandler → CONFIRM_REQUIRED，不执行
{
  const m = baseMock()
  m.chatScript = [
    { tool_calls: [toolCall('c1', 'chayuan__document_replace', { originalText: 'a', newText: 'b' })] },
    { content: '该写操作需要用户确认后执行。' }
  ]
  const r = await run({})
  A(r.ok === true, 'S2 ok')
  A(m.localCalls.length === 0, 'S2 write tool NOT executed')
  A(r.pendingConfirms.length === 1 && r.pendingConfirms[0].toolName === 'document_replace', 'S2 pendingConfirms')
  const toolMsg = m.requests[1].messages.find(x => x.role === 'tool' && x.tool_call_id === 'c1')
  A(toolMsg && toolMsg.content.includes('CONFIRM_REQUIRED'), 'S2 CONFIRM_REQUIRED fed back')
  console.log('✓ S2 写操作确认闸门（CONFIRM_REQUIRED）')
}

// 场景 3：写操作带 dryRun → 直通执行
{
  const m = baseMock()
  m.chatScript = [
    { tool_calls: [toolCall('c1', 'chayuan__document_replace', { originalText: 'a', newText: 'b', dryRun: true })] },
    { content: '预览完成。' }
  ]
  const r = await run({})
  A(r.ok === true && m.localCalls.length === 1, 'S3 dryRun executed')
  A(m.localCalls[0].args.dryRun === true, 'S3 args passthrough')
  console.log('✓ S3 dryRun 预览直通')
}

// 场景 4：模型报 tools 不支持 → 自动切 JSON 兼容协议整轮重跑
{
  const m = baseMock()
  m.chatScript = [
    { throw: new Error('400 This model does not support tools') },
    { content: '{"tool":"chayuan__document_locate","arguments":{"text":"错字"}}' },
    { content: '已通过兼容协议定位完成。' }
  ]
  const r = await run({})
  A(r.ok === true, 'S4 ok')
  A(m.localCalls.length === 1 && m.localCalls[0].name === 'document_locate', 'S4 degraded tool executed')
  A(r.steps.some(s => s.label.includes('JSON 兼容层')), 'S4 step 兼容层')
  // 降级请求不携带 tools，system 带 JSON 协议后缀
  const degradedReq = m.requests[1]
  A(!degradedReq.tools, 'S4 degraded request has no tools field')
  A(degradedReq.messages[0].content.includes('JSON'), 'S4 degraded system suffix')
  console.log('✓ S4 tools 不支持自动降级')
}

// 场景 5：坏入参（非法 JSON arguments）→ 不执行、回灌修正提示后模型改对
{
  const m = baseMock()
  m.chatScript = [
    { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'chayuan__document_locate', arguments: '{bad json' } }] },
    { tool_calls: [toolCall('c2', 'chayuan__document_locate', { text: '错字' })] },
    { content: '好了。' }
  ]
  const r = await run({})
  A(r.ok === true, 'S5 ok')
  // 第一次坏入参不应执行，第二次应执行
  A(m.localCalls.length === 1 && m.localCalls[0].args.text === '错字', 'S5 only good call executed')
  const fixMsg = m.requests[1].messages.find(x => x.role === 'tool' && x.tool_call_id === 'c1')
  A(fixMsg && fixMsg.content.includes('failed to parse'), 'S5 parse error fed back')
  console.log('✓ S5 坏入参不执行并回灌修正')
}

// 场景 6：用户停止 → 以 AbortError(name/code) reject
{
  const m = baseMock()
  m.toolDelay = 5000
  m.chatScript = [
    { tool_calls: [toolCall('c1', 'chayuan__document_locate', { text: 'x' })] },
    { content: 'never' }
  ]
  const ctrl = new AbortController()
  let rejected = null
  const p = run({ signal: ctrl.signal }).catch(e => { rejected = e; return null })
  setTimeout(() => ctrl.abort(), 120)
  await p
  A(rejected && rejected.name === 'AbortError' && rejected.code === 'ABORTED', 'S6 AbortError reject, got: ' + rejected)
  console.log('✓ S6 取消以 AbortError reject')
}

// 场景 7：历史消息进入请求（滚动窗口 8 条）
{
  const m = baseMock()
  m.chatScript = [{ content: '收到。' }]
  const history = Array.from({ length: 10 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: '历史消息' + i
  }))
  const r = await run({ historyMessages: history })
  A(r.ok === true, 'S7 ok')
  const req = m.requests[0]
  const histMsgs = req.messages.filter(x => x.role !== 'system' && x.role !== 'user' || (x.role === 'user' && x.content !== '帮我处理文档'))
  // 最后 8 条历史 + 本轮 user
  const nonSystem = req.messages.filter(x => x.role !== 'system')
  A(nonSystem.length === 9, 'S7 history trimmed to 8 + current, got ' + nonSystem.length)
  A(nonSystem[0].content === '历史消息2', 'S7 oldest kept is 历史消息2, got ' + nonSystem[0].content)
  console.log('✓ S7 历史滚动窗口（8 条）')
}

console.log('ALL SCENARIOS PASSED')
`

/* ────────── 构建 + 执行 ────────── */

const tmp = await mkdtemp(join(tmpdir(), 'agent-loop-smoke-'))
const runner = join(tmp, 'runner.mjs')
await writeFile(runner, runnerSource.replace('./ORCH_IMPORT', join(REPO, 'src/services/mcpBridge/mcpChatOrchestrator.js')))

try {
  await build({
    entryPoints: [runner],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    outfile: join(tmp, 'bundle.mjs'),
    plugins: [stubPlugin],
    logLevel: 'silent'
  })
  const res = spawnSync(process.execPath, [join(tmp, 'bundle.mjs')], { encoding: 'utf8', timeout: 30000 })
  process.stdout.write(res.stdout || '')
  if (res.stderr) process.stderr.write(res.stderr)
  process.exitCode = res.status === 0 && res.stdout.includes('ALL SCENARIOS PASSED') ? 0 : 1
} finally {
  await rm(tmp, { recursive: true, force: true }).catch(() => {})
}
