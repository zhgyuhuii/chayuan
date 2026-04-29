/**
 * workflowToolsP1 — W3 阶段的 4 个 P1 节点 + 节点契约扩展
 *
 * 与 workflowToolsExtra(W2 的 4 个 P0 节点)平行,合并时优先级:
 *   builtin > extra(W2) > p1(W3) > 用户注册
 *
 * 节点(plan-workflow-orchestration §4.2):
 *   - sub-workflow   把另一工作流当节点调用,递归 + 深度 5 + 循环检测
 *   - chat-once      直接 LLM 调用(免去配助手)
 *   - chat-stream    流式 LLM 调用,逐 chunk 触发
 *   - try-catch      抓下游失败 + 兜底分支
 *
 * + 节点契约扩展(estimateCost / validate)
 */

import { chatCompletion } from '../chatApi.js'
import { streamChatCompletionAbortAware } from '../chatApiAbortAware.js'
import { emit } from './workflowProgressChannel.js'
import { startTimer as startPerfTimer } from '../perfTracker.js'

/* ────────────────────────────────────────────────────────────
 * 节点元数据
 * ──────────────────────────────────────────────────────────── */

export const P1_TOOLS = [
  {
    type: 'sub-workflow',
    title: '子工作流',
    icon: '⊞',
    group: 'core',
    groupLabel: '核心节点',
    description: '把另一个工作流当作节点调用,可递归(深度上限 5,自动检测循环引用)。',
    config: {
      workflowId: { type: 'string', label: '子工作流 ID', required: true },
      inputBinding: { type: 'object', label: '输入绑定', default: { mode: 'auto' } },
      varsMapping: { type: 'object', label: '变量映射(子流入参 → 父变量)', default: {} },
      timeoutMs: { type: 'number', label: '超时(毫秒)', default: 600000 }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [
      { name: 'out', type: 'any', description: '子工作流的最终输出' },
      { name: 'subInstanceId', type: 'string' }
    ]
  },
  {
    type: 'chat-once',
    title: 'LLM 一次性调用',
    icon: '💬',
    group: 'core',
    groupLabel: '核心节点',
    description: '直接发一条 LLM 调用,免去先建助手。适合简单一次性问答 / 临时改写。',
    config: {
      providerId: { type: 'string', label: '提供商', placeholder: 'openai / anthropic / aliyun-bailian' },
      modelId: { type: 'string', label: '模型 ID', placeholder: '留空 = 跟随默认' },
      systemPrompt: { type: 'string', label: '系统提示词' },
      userPrompt: { type: 'string', label: '用户提示词模板', required: true },
      temperature: { type: 'number', label: '温度', default: 0.3, min: 0, max: 1.5 },
      maxTokens: { type: 'number', label: '最大 token', default: 1500 },
      forceJson: { type: 'boolean', label: '强制 JSON 输出', default: false }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [
      { name: 'out', type: 'string' },
      { name: 'parsed', type: 'object', description: 'forceJson 时的解析结果' }
    ]
  },
  {
    type: 'chat-stream',
    title: 'LLM 流式调用',
    icon: '⚡',
    group: 'core',
    groupLabel: '核心节点',
    description: '流式调用,逐 chunk 透传给下游节点(下游必须支持流式输入)。',
    config: {
      providerId: { type: 'string', label: '提供商' },
      modelId: { type: 'string', label: '模型 ID' },
      systemPrompt: { type: 'string', label: '系统提示词' },
      userPrompt: { type: 'string', label: '用户提示词模板', required: true },
      temperature: { type: 'number', label: '温度', default: 0.3 },
      maxTokens: { type: 'number', label: '最大 token', default: 2000 }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [
      { name: 'out', type: 'string', description: '完整文本(流结束后)' },
      { name: 'chunks', type: 'array<string>', description: '逐 chunk 数组(供需要的下游)' }
    ]
  },
  {
    type: 'try-catch',
    title: 'try-catch',
    icon: '⚠',
    group: 'control',
    groupLabel: '控制流',
    description: '把一段子图包成 try 块,失败时流入 catch 分支。',
    config: {
      tryNodeIds: { type: 'array<string>', label: 'try 块节点', default: [] },
      catchNodeIds: { type: 'array<string>', label: 'catch 块节点', default: [] },
      catchOnError: { type: 'boolean', label: '是否捕获 error 类型', default: true },
      catchOnTimeout: { type: 'boolean', label: '是否捕获 timeout', default: true },
      reraise: { type: 'boolean', label: 'catch 后是否重新抛出', default: false }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [
      { name: 'out', type: 'any', description: 'try 成功 → try 输出;失败 → catch 输出' },
      { name: 'caught', type: 'boolean' },
      { name: 'error', type: 'object', description: '若被捕获则包含 error 对象' }
    ]
  }
]

/* ────────────────────────────────────────────────────────────
 * 执行实现
 * ──────────────────────────────────────────────────────────── */

const SUBWORKFLOW_DEPTH_LIMIT = 5

export async function executeP1Tool(node, context = {}) {
  const type = node?.type
  switch (type) {
    case 'sub-workflow': return runSubWorkflow(node, context)
    case 'chat-once':    return runChatOnce(node, context)
    case 'chat-stream':  return runChatStream(node, context)
    case 'try-catch':    return runTryCatch(node, context)
    default:
      return { ok: false, error: `executeP1Tool: 未知 type ${type}` }
  }
}

/* ────────── sub-workflow ────────── */

async function runSubWorkflow(node, ctx) {
  const cfg = node.config || node.payload || {}
  const targetId = String(cfg.workflowId || '').trim()
  if (!targetId) return { ok: false, error: '缺 workflowId' }

  // 检查深度
  const depth = (ctx.parentInstanceChain?.length || 0) + 1
  if (depth > SUBWORKFLOW_DEPTH_LIMIT) {
    return { ok: false, error: `子工作流深度超限 (${depth} > ${SUBWORKFLOW_DEPTH_LIMIT})` }
  }
  // 检查循环引用
  if ((ctx.parentInstanceChain || []).includes(targetId)) {
    return { ok: false, error: `检测到循环引用:${targetId}` }
  }
  // 调度子工作流(由 runner 提供 startSubInstance)
  if (typeof ctx.startSubInstance !== 'function') {
    return { ok: false, error: 'context.startSubInstance 未提供' }
  }

  emit('node:run', {
    instanceId: ctx.instanceId,
    nodeId: node.id,
    nodeType: 'sub-workflow',
    targetId,
    depth
  })

  const timeoutMs = Number(cfg.timeoutMs) || 600000
  const timeoutCtrl = new AbortController()
  const timer = setTimeout(() => timeoutCtrl.abort('sub-timeout'), timeoutMs)

  try {
    const result = await ctx.startSubInstance({
      workflowId: targetId,
      input: ctx.input,
      varsMapping: cfg.varsMapping || {},
      parentInstanceChain: [...(ctx.parentInstanceChain || []), ctx.instanceId],
      signal: anySignal([ctx.signal, timeoutCtrl.signal])
    })
    clearTimeout(timer)
    return {
      ok: true,
      output: result?.output ?? null,
      subInstanceId: result?.instanceId || ''
    }
  } catch (e) {
    clearTimeout(timer)
    return { ok: false, error: String(e?.message || e) }
  }
}

/* ────────── chat-once ────────── */

async function runChatOnce(node, ctx) {
  const cfg = node.config || node.payload || {}
  const userPrompt = String(cfg.userPrompt || '')
  if (!userPrompt) return { ok: false, error: '缺 userPrompt' }

  const interpolated = ctx.resolveExpr ? String(ctx.resolveExpr(userPrompt) || userPrompt) : userPrompt
  const messages = []
  if (cfg.systemPrompt) {
    messages.push({ role: 'system', content: ctx.resolveExpr ? String(ctx.resolveExpr(cfg.systemPrompt)) : cfg.systemPrompt })
  }
  messages.push({ role: 'user', content: interpolated })

  const stop = startPerfTimer({ kind: 'workflow.chat-once', providerId: cfg.providerId || 'default', modelId: cfg.modelId || 'default' })
  try {
    const extra = {}
    if (cfg.forceJson) extra.response_format = { type: 'json_object' }
    if (cfg.maxTokens) extra.max_tokens = cfg.maxTokens

    const text = await chatCompletion({
      providerId: cfg.providerId || ctx.defaultModel?.providerId,
      modelId: cfg.modelId || ctx.defaultModel?.modelId,
      messages,
      temperature: typeof cfg.temperature === 'number' ? cfg.temperature : 0.3,
      signal: ctx.signal,
      ...extra
    })
    stop({ ok: true, bytes: String(text || '').length })

    let parsed = null
    if (cfg.forceJson) {
      try { parsed = JSON.parse(String(text || '{}')) } catch (_) {}
    }
    return { ok: true, output: text, parsed }
  } catch (e) {
    stop({ ok: false, note: String(e?.message || e).slice(0, 80) })
    return { ok: false, error: String(e?.message || e) }
  }
}

/* ────────── chat-stream ────────── */

async function runChatStream(node, ctx) {
  const cfg = node.config || node.payload || {}
  const userPrompt = String(cfg.userPrompt || '')
  if (!userPrompt) return { ok: false, error: '缺 userPrompt' }

  const interpolated = ctx.resolveExpr ? String(ctx.resolveExpr(userPrompt) || userPrompt) : userPrompt
  const messages = []
  if (cfg.systemPrompt) {
    messages.push({ role: 'system', content: ctx.resolveExpr ? String(ctx.resolveExpr(cfg.systemPrompt)) : cfg.systemPrompt })
  }
  messages.push({ role: 'user', content: interpolated })

  const chunks = []
  const stop = startPerfTimer({ kind: 'workflow.chat-stream', providerId: cfg.providerId || 'default', modelId: cfg.modelId || 'default' })

  try {
    const result = await streamChatCompletionAbortAware({
      providerId: cfg.providerId || ctx.defaultModel?.providerId,
      modelId: cfg.modelId || ctx.defaultModel?.modelId,
      messages,
      temperature: typeof cfg.temperature === 'number' ? cfg.temperature : 0.3,
      max_tokens: cfg.maxTokens || 2000,
      signal: ctx.signal,
      onChunk: (chunk) => {
        chunks.push(String(chunk || ''))
        emit('node:progress', {
          instanceId: ctx.instanceId,
          nodeId: node.id,
          nodeType: 'chat-stream',
          partial: result?.text || '',
          chunkCount: chunks.length
        })
      }
    })

    if (result?.aborted) {
      stop({ ok: false, note: result.reason })
      return { ok: false, error: 'aborted: ' + result.reason, output: result.text, chunks }
    }
    if (result?.error) {
      stop({ ok: false, note: String(result.error?.message || result.error).slice(0, 80) })
      return { ok: false, error: String(result.error?.message || result.error), output: result.text, chunks }
    }
    stop({ ok: true, bytes: result.text.length })
    return { ok: true, output: result.text, chunks }
  } catch (e) {
    stop({ ok: false, note: String(e?.message || e).slice(0, 80) })
    return { ok: false, error: String(e?.message || e), chunks }
  }
}

/* ────────── try-catch ────────── */

async function runTryCatch(node, ctx) {
  const cfg = node.config || node.payload || {}
  const tryIds = Array.isArray(cfg.tryNodeIds) ? cfg.tryNodeIds : []
  const catchIds = Array.isArray(cfg.catchNodeIds) ? cfg.catchNodeIds : []
  if (typeof ctx.runChildNodes !== 'function') {
    return { ok: false, error: 'context.runChildNodes 未提供' }
  }

  emit('node:run', {
    instanceId: ctx.instanceId,
    nodeId: node.id,
    nodeType: 'try-catch'
  })

  let tryError = null
  let tryOutput = null
  try {
    tryOutput = await ctx.runChildNodes(tryIds, { branch: 'try' })
    return { ok: true, output: tryOutput, caught: false }
  } catch (e) {
    tryError = e
    const isError = e && cfg.catchOnError !== false
    const isTimeout = String(e?.code || '') === 'TIMEOUT' && cfg.catchOnTimeout !== false
    if (!isError && !isTimeout) {
      // 不在 catch 范围内 → 透传
      throw e
    }
  }

  // catch 块
  let catchOutput = null
  try {
    catchOutput = await ctx.runChildNodes(catchIds, {
      branch: 'catch',
      scopeVars: {
        __error: { message: String(tryError?.message || tryError), code: tryError?.code }
      }
    })
  } catch (catchErr) {
    return {
      ok: false,
      error: `catch 自身失败:${catchErr?.message || catchErr}`,
      caught: true,
      tryError: { message: String(tryError?.message || tryError) }
    }
  }

  if (cfg.reraise) {
    // 跑完 catch 后还是抛
    throw tryError
  }

  return {
    ok: true,
    output: catchOutput,
    caught: true,
    error: { message: String(tryError?.message || tryError) }
  }
}

/* ────────────────────────────────────────────────────────────
 * 节点契约 — estimateCost / validate(W3.5)
 * ──────────────────────────────────────────────────────────── */

/**
 * 估算节点成本(LLM 调用次数 / 大概延迟 / 字节)。
 * 编辑器调此函数累计整个工作流的成本预览。
 */
export function estimateNodeCost(node, ctx = {}) {
  const cfg = node?.config || node?.payload || {}
  switch (node?.type) {
    case 'assistant-invoke':
      return { llmCalls: 1, ms: 3000, bytes: 2000 }
    case 'parallel': {
      const branches = Array.isArray(cfg.branches) ? cfg.branches : []
      return { llmCalls: branches.length, ms: 3000, bytes: 2000 * branches.length }
    }
    case 'loop': {
      const iterations = cfg.mode === 'times' ? Number(cfg.times) || 1 : 10  // 估算 10
      return { llmCalls: iterations, ms: 3000 * Math.ceil(iterations / (cfg.maxConcurrent || 1)), bytes: 2000 * iterations }
    }
    case 'human-confirm':
      return { llmCalls: 0, ms: 30000, bytes: 0, requiresHuman: true }
    case 'sub-workflow':
      return { llmCalls: 5, ms: 15000, bytes: 5000, isEstimate: true }
    case 'chat-once':
    case 'chat-stream':
      return { llmCalls: 1, ms: 2500, bytes: Number(cfg.maxTokens) * 2 || 3000 }
    case 'try-catch':
    case 'aggregate-list':
    case 'condition-check':
    case 'json-extract':
    case 'text-template':
    case 'set-variables':
    case 'field-mapper':
    case 'content-merge':
    case 'text-replace':
    case 'regex-extract':
      return { llmCalls: 0, ms: 50, bytes: 200 }
    case 'capability-bus':
    case 'wps-capability':
      return { llmCalls: 0, ms: 200, bytes: 500 }
    case 'http-request':
      return { llmCalls: 0, ms: 800, bytes: 1500 }
    case 'delay':
      return { llmCalls: 0, ms: Number(cfg.delayMs) || 1000, bytes: 0 }
    default:
      return { llmCalls: 0, ms: 100, bytes: 100 }
  }
}

/**
 * 估算整个工作流的累计成本。
 *   workflow:{ nodes: [...], edges: [...] }
 *   返回:{ llmCalls, ms, bytes, perNodeBreakdown[], warnings[] }
 */
export function estimateWorkflowCost(workflow) {
  const nodes = (workflow?.nodes || []).filter(n => n && n.type && n.type !== '__start__' && n.type !== '__end__')
  let total = { llmCalls: 0, ms: 0, bytes: 0 }
  const breakdown = []
  const warnings = []

  for (const node of nodes) {
    const cost = estimateNodeCost(node)
    total.llmCalls += cost.llmCalls
    total.ms += cost.ms
    total.bytes += cost.bytes
    breakdown.push({ nodeId: node.id, type: node.type, ...cost })
    if (cost.requiresHuman) warnings.push(`节点 ${node.id} 需要人工介入`)
    if (cost.isEstimate) warnings.push(`节点 ${node.id}(${node.type})成本是粗略估计`)
  }

  if (total.llmCalls > 20) warnings.push(`总 LLM 调用 ${total.llmCalls} 次,可能消耗较多配额`)
  if (total.ms > 60000) warnings.push(`预估总时长 ${(total.ms/1000).toFixed(1)}s,>1 分钟`)

  return { ...total, perNodeBreakdown: breakdown, warnings, nodeCount: nodes.length }
}

/**
 * 校验节点配置。返回 { ok, errors[] }
 */
export function validateNode(node, workflow) {
  const errors = []
  if (!node?.type) errors.push('节点缺 type')
  const cfg = node?.config || node?.payload || {}

  switch (node.type) {
    case 'assistant-invoke':
      if (!cfg.assistantId) errors.push(`${node.id}: 缺 assistantId`)
      break
    case 'sub-workflow':
      if (!cfg.workflowId) errors.push(`${node.id}: 缺 workflowId`)
      if (workflow?.id && cfg.workflowId === workflow.id) errors.push(`${node.id}: 不能引用自身`)
      break
    case 'chat-once':
    case 'chat-stream':
      if (!cfg.userPrompt) errors.push(`${node.id}: 缺 userPrompt`)
      break
    case 'parallel':
      if (!Array.isArray(cfg.branches) || cfg.branches.length < 2) {
        errors.push(`${node.id}: parallel 至少 2 个分支`)
      }
      break
    case 'loop':
      if (cfg.mode === 'for-each' && !cfg.itemsExpr) {
        errors.push(`${node.id}: for-each 模式必须填 itemsExpr`)
      }
      if (cfg.mode === 'times' && !(Number(cfg.times) > 0)) {
        errors.push(`${node.id}: times 必须 > 0`)
      }
      break
    case 'human-confirm':
      if (cfg.timeoutMs && cfg.timeoutMs < 1000) {
        errors.push(`${node.id}: timeoutMs 过小,< 1 秒`)
      }
      break
    case 'try-catch':
      if (!Array.isArray(cfg.tryNodeIds) || cfg.tryNodeIds.length === 0) {
        errors.push(`${node.id}: try 块至少 1 个节点`)
      }
      break
  }

  return { ok: errors.length === 0, errors }
}

/**
 * 校验整个工作流。
 */
export function validateWorkflowExtended(workflow) {
  const errors = []
  if (!workflow) return { ok: false, errors: ['workflow 为空'] }
  for (const node of (workflow.nodes || [])) {
    const r = validateNode(node, workflow)
    errors.push(...r.errors)
  }
  // 检查孤儿节点(无入边且非 start)
  const incoming = new Map()
  for (const e of (workflow.edges || [])) {
    incoming.set(e.target, (incoming.get(e.target) || 0) + 1)
  }
  for (const node of (workflow.nodes || [])) {
    if (node.type === '__start__') continue
    if ((incoming.get(node.id) || 0) === 0) {
      errors.push(`孤儿节点 ${node.id}: 无入边`)
    }
  }
  return { ok: errors.length === 0, errors }
}

function anySignal(signals) {
  const list = (signals || []).filter(Boolean)
  if (list.length === 0) return undefined
  if (list.length === 1) return list[0]
  const ctrl = new AbortController()
  for (const s of list) {
    if (s.aborted) { ctrl.abort(s.reason); break }
    s.addEventListener('abort', () => ctrl.abort(s.reason), { once: true })
  }
  return ctrl.signal
}

export default {
  P1_TOOLS,
  executeP1Tool,
  estimateNodeCost,
  estimateWorkflowCost,
  validateNode,
  validateWorkflowExtended
}
