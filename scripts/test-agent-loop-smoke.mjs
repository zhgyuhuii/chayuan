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
  // src/utils/chatApi.js → 暴露编排器传输层用到的两个入口：
  // streamChatCompletion（流式主通道，与真实实现同构）+ chatCompletionMessage（回落）
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
    export async function streamChatCompletion(opts) {
      const m = globalThis.__MOCK__
      m.requests.push({
        providerId: opts.providerId, modelId: opts.modelId, ribbonModelId: opts.ribbonModelId,
        messages: opts.messages, tools: opts.tools, tool_choice: opts.tool_choice
      })
      const step = m.chatScript[m.chatIdx]
      if (step && step.throw) {
        // 流式报错不消耗脚本步：传输层会拿同一请求体做非流式回落，
        // 届时命中同一错误步（镜像真实网关对同 body 返回同 4xx）
        opts.onError?.(step.throw.message || String(step.throw))
        return
      }
      m.chatIdx += 1
      if (!step) { opts.onError?.('chat script exhausted'); return }
      await new Promise(r => setTimeout(r, step.delay || 0))
      // 文本按 delta 分片、tool_calls 走 OpenAI 流式分片（index/id/name/arguments）
      for (const frag of String(step.content || '').match(/[\\s\\S]{1,7}/g) || []) {
        opts.onEvent?.({ choices: [{ delta: { content: frag } }] })
      }
      const calls = Array.isArray(step.tool_calls) ? step.tool_calls : []
      calls.forEach((c, i) => opts.onEvent?.({
        choices: [{ delta: { tool_calls: [{ index: i, id: c.id, function: { name: c.function.name, arguments: c.function.arguments } }] } }]
      }))
      opts.onDone?.()
    }
  `,
  // src/services/mcpBridge/mcpServerRegistry.js
  [join(REPO, 'src/services/mcpBridge/mcpServerRegistry.js')]: `
    export const CHAYUAN_SERVER_ID = 'chayuan'
    export function getEnabledMcpServers() {
      const m = globalThis.__MOCK__
      return m.servers || [{ id: 'chayuan', name: '察元 MCP' }]
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
      const m = globalThis.__MOCK__
      return { ok: true, online: true, agentOnline: m.agentOnline !== false }
    }
    export async function initializeLocal() {}
    export async function listLocalTools() {
      return globalThis.__MOCK__.localTools
    }
    export async function listUpstreamTools(serverId) {
      return (globalThis.__MOCK__.upstreamTools || []).map(t => ({ ...t, serverId }))
    }
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

// 场景 2：写操作直通执行——confirmed 由 skill 层自动注入（2026-09-17 移除人工确认闸门）
{
  const m = baseMock()
  m.chatScript = [
    { tool_calls: [toolCall('c1', 'chayuan__document_replace', { originalText: 'a', newText: 'b' })] },
    { content: '已替换。' }
  ]
  const r = await run({})
  A(r.ok === true, 'S2 ok')
  A(m.localCalls.length === 1 && m.localCalls[0].name === 'document_replace', 'S2 write tool executed directly')
  A(m.localCalls[0].args.confirmed === true, 'S2 confirmed injected by skill layer')
  A(!r.pendingConfirms, 'S2 no pendingConfirms in result')
  const toolMsg = m.requests[1].messages.find(x => x.role === 'tool' && x.tool_call_id === 'c1')
  A(toolMsg && !toolMsg.content.includes('CONFIRM_REQUIRED'), 'S2 tool result is real output, not confirm envelope')
  console.log('✓ S2 写操作直通（confirmed 自动注入）')
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
// （流式主通道报错后传输层先做一次非流式回落——同一 body 同样 4xx——
//   失败上抛编排器才降级；降级请求取最后一条，不再是固定下标 1）
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
  const degradedReq = m.requests[m.requests.length - 1]
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

// 场景 8：sidecar 在线但 WPS Agent 未注册 → 快速失败，不进模型循环
// （否则模型会连续多轮撞 WPS_AGENT_OFFLINE 烧完轮次上限，用户看到「没法正常批注」）
{
  const m = baseMock({ agentOnline: false })
  const r = await run({})
  A(r.ok === false && r.fallback === true, 'S8 ok=false fallback')
  A(r.reason === 'agent_offline', 'S8 reason agent_offline, got ' + r.reason)
  A(m.requests.length === 0, 'S8 no model request fired')
  A(String(r.content || '').includes('Agent'), 'S8 actionable message')
  console.log('✓ S8 Agent 离线快速失败')
}

// 场景 9：模型自带 confirmed:true 被剥除后由 skill 层重新注入——仍只执行一次
{
  const m = baseMock()
  m.chatScript = [
    { tool_calls: [toolCall('c1', 'chayuan__document_replace', { originalText: '永鹅', newText: '咏鹅', confirmed: true })] },
    { content: '已替换。' }
  ]
  const r = await run({})
  A(r.ok === true, 'S9 ok')
  A(m.localCalls.length === 1, 'S9 executed exactly once')
  A(m.localCalls[0].args.confirmed === true, 'S9 confirmed is client-injected (not model-supplied passthrough)')
  console.log('✓ S9 模型 confirmed:true 剥除后由客户端重新注入')
}

// 场景 10：写操作 dryRun 预览——预览不是落笔，不注入 confirmed（预览语义保留）
{
  const m = baseMock()
  m.chatScript = [
    { tool_calls: [toolCall('c1', 'chayuan__document_replace', { originalText: 'a', newText: 'b', dryRun: true })] },
    { content: '预览完成。' }
  ]
  const r = await run({})
  A(r.ok === true && m.localCalls.length === 1, 'S10 dryRun executed')
  A(m.localCalls[0].args.confirmed === undefined, 'S10 dryRun preview carries no confirmed')
  console.log('✓ S10 dryRun 预览不带 confirmed')
}

// 场景 11：proofread_apply_comments 是落笔动作——即使带 dryRun 也注入 confirmed
{
  const m = baseMock()
  m.localTools.push({ name: 'proofread_apply_comments', description: '批注落笔', inputSchema: { type: 'object', properties: { taskId: { type: 'string' } } } })
  m.chatScript = [
    { tool_calls: [toolCall('c1', 'chayuan__proofread_apply_comments', { taskId: 't1', dryRun: true })] },
    { content: '已写成批注。' }
  ]
  const r = await run({})
  A(r.ok === true && m.localCalls.length === 1, 'S11 apply_comments executed')
  A(m.localCalls[0].args.confirmed === true, 'S11 apply_comments always confirmed (sidecar gate)')
  console.log('✓ S11 proofread_apply_comments 无条件注入 confirmed')
}

// 场景 12：循环守卫熔断错误（含 "tool" 字样）不触发 JSON 降级整轮重跑（PR6/H4）
// Agent 离线 → 连续 8 轮全失败 → 守卫返回 "Every tool call failed…" →
// 旧正则 /tool|…/ 误判「模型不支持 tools」→ 降级再烧 16 轮。修复后只跑一次。
{
  const m = baseMock()
  m.chatScript = [
    { throw: new Error('Every tool call failed for 8 turns in a row; the run was stopped. Please send the request again') },
    { content: 'should never run' }
  ]
  const r = await run({})
  A(r.ok === false && r.fallback === true && r.reason === 'model_error', 'S12 model_error, got ' + r.reason)
  // 2 次 = 流式主通道 + 非流式回落（传输层内部重试，非循环层降级重跑）
  A(m.requests.length === 2, 'S12 loop ran exactly once (transport fallback only), requests=' + m.requests.length)
  A(!r.steps.some(s => s.label.includes('JSON 兼容层')), 'S12 no JSON-compat step')
  A(String(r.content).includes('连续多轮工具调用全部失败'), 'S12 localized guard message, got ' + r.content)
  console.log('✓ S12 守卫熔断错误不触发降级重跑')
}

// 场景 13：上游工具直通——readOnly 启发式随确认闸门一并移除，读写都直接执行
{
  const m = baseMock()
  m.servers = [{ id: 'chayuan', name: '察元 MCP' }, { id: 'upstream', name: '上游服务' }]
  m.upstreamTools = [
    { name: 'get_weather', description: '查天气' },
    { name: 'read_config', description: '读配置', annotations: { readOnlyHint: true } },
    { name: 'send_notification', description: '发通知', annotations: { readOnlyHint: false } }
  ]
  m.chatScript = [
    {
      tool_calls: [
        toolCall('c1', 'upstream__get_weather', { city: '北京' }),
        toolCall('c2', 'upstream__send_notification', { text: 'hi' })
      ]
    },
    { content: '已完成天气查询并发出通知。' }
  ]
  const r = await run({})
  A(r.ok === true, 'S13 ok')
  const names = m.localCalls.map(c => c.name).sort()
  A(JSON.stringify(names) === JSON.stringify(['upstream__get_weather', 'upstream__send_notification']), 'S13 读写工具均直通执行, calls=' + JSON.stringify(names))
  console.log('✓ S13 上游工具直通（无 readOnly 拦截）')
}

// 场景 14：跨回合上下文——loopHistory restore 进模型请求，工具结论可续问（PR7）
{
  const m = baseMock()
  m.chatScript = [{ content: '刚才第二段已改为「咏鹅」，就是那首唐诗。' }]
  const loopHistory = [
    { role: 'user', text: '把第二段改成咏鹅' },
    { role: 'assistant', text: '', toolCalls: [{ id: 't1', name: 'chayuan__document_replace', input: { originalText: '永鹅', newText: '咏鹅', confirmed: true } }] },
    { role: 'tool', results: [{ id: 't1', name: 'chayuan__document_replace', output: '{"ok":true,"replaced":1}', isError: false }] },
    { role: 'assistant', text: '已把「永鹅」改为「咏鹅」。' }
  ]
  const r = await run({ loopHistory })
  A(r.ok === true, 'S14 ok')
  const req = m.requests[0]
  A(req.messages.some(x => x.role === 'user' && x.content === '把第二段改成咏鹅'), 'S14 历史用户消息进入请求')
  A(req.messages.some(x => x.role === 'tool' && x.tool_call_id === 't1'), 'S14 历史工具结果进入请求（追问可答）')
  A(Array.isArray(r.loopMessages) && r.loopMessages.length >= 4, 'S14 结果返回 loopMessages 供下回合续接')
  console.log('✓ S14 跨回合上下文 restore（工具结论不丢）')
}

// 场景 15：空流 → 非流式回落整取（流式主通道返回零内容零工具时的兜底链路）
{
  const m = baseMock()
  m.chatScript = [
    { content: '', tool_calls: [] },
    { content: '经非流式回落取得完整回复。' }
  ]
  const r = await run({})
  A(r.ok === true, 'S15 ok')
  A(r.content.includes('非流式回落'), 'S15 fallback content used, got: ' + r.content)
  A(m.requests.length === 2, 'S15 stream attempt + non-stream fallback, requests=' + m.requests.length)
  console.log('✓ S15 空流回落非流式整取')
}

// 场景 16：跨回合轻上下文——陈旧工具输出截断 + 尾部预算，回灌请求不再全量携带旧输出
{
  const m = baseMock()
  m.chatScript = [{ content: '好的。' }]
  const bigOutput = 'X'.repeat(8000)
  const loopHistory = [
    { role: 'user', text: '第一轮指令' },
    { role: 'assistant', text: '', toolCalls: [{ id: 't1', name: 'chayuan__document_locate', input: { text: 'a' } }] },
    { role: 'tool', results: [{ id: 't1', name: 'chayuan__document_locate', output: bigOutput, isError: false }] },
    { role: 'assistant', text: '第一轮完成。' },
    { role: 'user', text: '第二轮指令' },
    { role: 'assistant', text: '', toolCalls: [{ id: 't2', name: 'chayuan__document_locate', input: { text: 'b' } }] },
    { role: 'tool', results: [{ id: 't2', name: 'chayuan__document_locate', output: bigOutput, isError: false }] },
    { role: 'assistant', text: '第二轮完成。' }
  ]
  const r = await run({ loopHistory })
  A(r.ok === true, 'S16 ok')
  A(Array.isArray(r.loopMessages), 'S16 loopMessages returned')
  const stored = JSON.stringify(r.loopMessages)
  A(!stored.includes(bigOutput), 'S16 大体积工具输出不再原样持久化')
  A(stored.includes('第一轮完成') && stored.includes('第二轮完成'), 'S16 助手结论文本保留（追问可答）')
  A(stored.length < 8000 * 1.2, 'S16 持久化体积受控, size=' + stored.length)
  console.log('✓ S16 跨回合轻上下文（陈旧输出截断）')
}

console.log('ALL SCENARIOS PASSED')
`

/* ────────── 构建 + 执行 ────────── */

const tmp = await mkdtemp(join(tmpdir(), 'agent-loop-smoke-'))
const runner = join(tmp, 'runner.mjs')
// Windows 反斜杠路径拼进模板字符串会被当转义序列吃掉（D:\code → D:code），统一改写为正斜杠
await writeFile(runner, runnerSource.replace('./ORCH_IMPORT', join(REPO, 'src/services/mcpBridge/mcpChatOrchestrator.js').replace(/\\/g, '/')))

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
