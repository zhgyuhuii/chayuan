#!/usr/bin/env node
/* eslint-env node */
/**
 * agent 传输层真key直连测试 — 验证流式主通道在真实 OpenAI 兼容网关上的行为：
 *   L1 流式文本：onText 多次增量（非流式回落只会给 1 次全量）
 *   L2 流式 tool_calls 聚合：delta.tool_calls 分片 → 完整 tool_call → 执行 → 回灌 → 收尾
 *   L3 同轮多工具：一次 assistant 消息里多个 tool_calls 的 index 聚合与顺序
 *
 * 真实代码 = src/agent-core（AgentLoop）+ agentCoreTransport + chatApi（含 onEvent 流式）；
 * 仅桩 modelSettings（key 从环境变量注入，不落仓库）与 desktopStore。
 *
 * 用法：CHAYUAN_LIVE_DEEPSEEK_KEY=sk-xxx node scripts/test-agent-transport-live.mjs
 * 可选：CHAYUAN_LIVE_BASE_URL（默认 https://api.deepseek.com）
 *       CHAYUAN_LIVE_MODEL（默认 deepseek-chat）
 */
import { build } from 'esbuild'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const STUBS = {
  // src/utils/modelSettings.js → key/地址/模型清单全部来自环境变量
  [join(REPO, 'src/utils/modelSettings.js')]: `
    export function getModelConfig(providerId) {
      return {
        apiKey: process.env.CHAYUAN_LIVE_DEEPSEEK_KEY || '',
        apiUrl: process.env.CHAYUAN_LIVE_BASE_URL || 'https://api.deepseek.com',
        enabled: true,
        modelSeries: [process.env.CHAYUAN_LIVE_MODEL || 'deepseek-chat'],
        models: [process.env.CHAYUAN_LIVE_MODEL || 'deepseek-chat']
      }
    }
    export const RIBBON_MODEL_TO_PROVIDER = {}
    export function parseModelCompositeId() { return null }
  `,
  // src/services/desktop/desktopStore.js → 桌面镜像组不参与
  [join(REPO, 'src/services/desktop/desktopStore.js')]: `
    export function getBaseUrl() { return '' }
    export function isDesktopProviderId() { return false }
  `
}

const stubPlugin = {
  name: 'live-stubs',
  setup(b) {
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

const runnerSource = `
const A = (cond, msg) => { if (!cond) throw new Error('断言失败: ' + msg) }
const MODEL = {
  providerId: 'DEEPSEEK',
  modelId: process.env.CHAYUAN_LIVE_MODEL || 'deepseek-chat',
  id: 'DEEPSEEK|deepseek-chat',
  name: 'DeepSeek(直连)'
}

const makeSkill = (tools, handlers) => ({
  systemPrompt: '你是测试代理。按用户指令调用工具或直接回答。',
  tools,
  buildContext: () => '',
  async executeTool(call) {
    const fn = handlers[call.name] || (() => 'ok')
    const output = await fn(call.input || {})
    return { output: String(output), summary: call.name, mutated: false }
  }
})

const runLoop = ({ instruction, tools, handlers }) => new Promise((resolveLoop, rejectLoop) => {
  const seen = { onTextCalls: 0, turns: 0, firstTextAt: 0, startedAt: Date.now(), toolCalls: [] }
  const skill = makeSkill(tools, handlers)
  const { AgentLoop } = await0
  const loop = new AgentLoop({
    transport: createTransport({ model: MODEL, onTurnStart: () => { seen.turns += 1 } }),
    skill,
    events: {
      onText: (t) => {
        seen.onTextCalls += 1
        if (!seen.firstTextAt) seen.firstTextAt = Date.now()
      },
      onToolStart: (call) => seen.toolCalls.push({ name: call.name, input: call.input }),
      onDone: (r) => resolveLoop({ ...seen, result: r, totalMs: Date.now() - seen.startedAt }),
      onError: (e) => rejectLoop(new Error('loop error: ' + e))
    },
    maxTurns: 6
  })
  loop.run(instruction)
})

// ── L1 流式文本：增量 onText 多次（回落非流式时只会有 1 次全量回调） ──
{
  const out = await runLoop({
    instruction: '不要调用任何工具。用一句话回答：流式测试成功。',
    tools: [{ name: 'noop', description: '什么都不做', inputSchema: { type: 'object', properties: {} } }],
    handlers: { noop: () => 'noop' }
  })
  A(out.result.text.length > 0, 'L1 有文本: ' + out.result.text)
  A(out.onTextCalls >= 3, 'L1 onText 增量次数>=3 (流式生效), got ' + out.onTextCalls)
  console.log('✓ L1 流式文本 onText=' + out.onTextCalls + ' 首字延迟=' + (out.firstTextAt - out.startedAt) + 'ms 总耗时=' + out.totalMs + 'ms')
}

// ── L2 流式 tool_calls 聚合：真实分片流 → 完整调用 → 执行 → 回灌 → 收尾 ──
{
  const out = await runLoop({
    instruction: '调用 get_current_time 工具，然后用一句话报告它返回的时间（包含年份）。',
    tools: [{ name: 'get_current_time', description: '获取当前时间', inputSchema: { type: 'object', properties: {} } }],
    handlers: { get_current_time: () => '2026-09-17 12:00:00 (测试固定值)' }
  })
  A(out.toolCalls.length === 1 && out.toolCalls[0].name === 'get_current_time', 'L2 工具被调用一次, got ' + JSON.stringify(out.toolCalls))
  A(out.result.text.includes('2026'), 'L2 收尾引用了工具结果, text=' + out.result.text.slice(0, 80))
  console.log('✓ L2 流式 tool_calls 聚合+回灌收尾 turns=' + out.turns)
}

// ── L3 同轮多工具：一条 assistant 消息里多个 tool_calls 的 index 聚合 ──
{
  const out = await runLoop({
    instruction: '在同一轮里同时调用 add(a=2,b=3) 和 multiply(a=4,b=5) 两个工具，然后用一句话报告两个结果。',
    tools: [
      { name: 'add', description: '加法', inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] } },
      { name: 'multiply', description: '乘法', inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] } }
    ],
    handlers: {
      add: (i) => 'a+b=' + (Number(i.a) + Number(i.b)),
      multiply: (i) => 'a*b=' + (Number(i.a) * Number(i.b))
    }
  })
  const names = out.toolCalls.map(c => c.name).sort()
  A(JSON.stringify(names) === JSON.stringify(['add', 'multiply']), 'L3 两个工具都被调用, got ' + JSON.stringify(names))
  A(out.result.text.includes('5') && out.result.text.includes('20'), 'L3 收尾含两个结果(5/20), text=' + out.result.text.slice(0, 80))
  A(out.turns <= 3, 'L3 轮次<=3 (同轮批量), turns=' + out.turns)
  console.log('✓ L3 同轮多工具聚合 turns=' + out.turns)
}

console.log('ALL LIVE SCENARIOS PASSED')
`

const tmp = await mkdtemp(join(tmpdir(), 'agent-transport-live-'))
const runner = join(tmp, 'runner.mjs')
// runner 里 transport/AgentLoop 由 esbuild 从真实源码注入（见 alias 注入）
await writeFile(runner, `
import { createAgentCoreTransport } from ${JSON.stringify(join(REPO, 'src/services/mcpBridge/agentCoreTransport.js'))}
import { AgentLoop } from ${JSON.stringify(join(REPO, 'src/agent-core/index'))}
const await0 = { AgentLoop }
const createTransport = createAgentCoreTransport
${runnerSource}
`)

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
  const res = spawnSync(process.execPath, [join(tmp, 'bundle.mjs')], {
    encoding: 'utf8',
    timeout: 240000,
    env: { ...process.env }
  })
  process.stdout.write(res.stdout || '')
  if (res.stderr) process.stderr.write(res.stderr)
  process.exitCode = res.status === 0 && (res.stdout || '').includes('ALL LIVE SCENARIOS PASSED') ? 0 : 1
} finally {
  await rm(tmp, { recursive: true, force: true }).catch(() => {})
}
