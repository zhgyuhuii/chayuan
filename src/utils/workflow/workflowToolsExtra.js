/**
 * workflowToolsExtra — 4 个 P0 优先级新节点类型 + 注册扩展机制
 *
 * 现有 workflowTools.js 的 BUILTIN_WORKFLOW_TOOLS 是 const 数组,无扩展接口。
 * 这里:
 *   1. 提供本模块自己的 EXTRA_TOOLS 数组 + getExtraTools()
 *   2. 提供 mergeWithBuiltin(builtinList) helper,让编辑器和 runner 可以拿到完整列表
 *   3. 提供 executeExtraTool(node, ctx) 给 workflowRunner 调度
 *
 * 4 个新类型(plan-workflow-orchestration §4.2):
 *   - assistant-invoke   调用一个内置或自定义助手
 *   - parallel           显式并行 fan-out + 等待 join
 *   - loop               遍历数组或 N 次,每轮跑子图
 *   - human-confirm      暂停等用户确认
 */

import { runConcurrently } from '../concurrentRunner.js'
import { emit } from './workflowProgressChannel.js'

/* ────────────────────────────────────────────────────────────
 * 工具元数据(供编辑器渲染表单)
 * ──────────────────────────────────────────────────────────── */

export const EXTRA_TOOLS = [
  /* 1. assistant-invoke */
  {
    type: 'assistant-invoke',
    title: '调用助手',
    icon: '🤖',
    group: 'core',
    groupLabel: '核心节点',
    description: '调用一个已配置的助手(内置或自定义),执行其完整任务流(选区/全文 → LLM → 写回)。',
    config: {
      assistantId: { type: 'string', label: '助手 ID', required: true, placeholder: '如:analysis.legal-clause-audit' },
      inputBinding: { type: 'object', label: '输入绑定', default: { mode: 'auto' } },
      overrideModel: { type: 'string', label: '覆盖模型', placeholder: '留空则用助手默认模型' },
      overrideAction: { type: 'string', label: '覆盖文档动作', placeholder: '如 comment / replace / none' },
      previewOnly: { type: 'boolean', label: '只生成不写回', default: false },
      timeoutMs: { type: 'number', label: '超时(毫秒)', default: 120000 }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [
      { name: 'out', type: 'string', description: '助手原始输出' },
      { name: 'parsed', type: 'object', description: '若助手输出 JSON 则为解析后对象' }
    ]
  },

  /* 2. parallel */
  {
    type: 'parallel',
    title: '并行执行',
    icon: '⫤',
    group: 'control',
    groupLabel: '控制流',
    description: '同时跑多个分支,按 waitMode 等待:all=全部完成 / any=任一完成 / first-success=任一成功(失败的跳过)。',
    config: {
      branches: {
        type: 'array',
        label: '分支列表',
        description: '每个分支是一组节点 ID,以拓扑序执行',
        minItems: 2,
        default: [[], []]
      },
      waitMode: {
        type: 'enum',
        label: '等待模式',
        values: ['all', 'any', 'first-success'],
        default: 'all'
      },
      concurrency: {
        type: 'number',
        label: '最大并发',
        default: 4,
        min: 1,
        max: 16
      }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [
      { name: 'out', type: 'array<any>', description: '各分支结果数组(顺序与 branches 一致;失败位为 null)' },
      { name: 'firstWinner', type: 'any', description: '最先成功的分支结果(仅 any/first-success 模式有意义)' }
    ]
  },

  /* 3. loop */
  {
    type: 'loop',
    title: '循环遍历',
    icon: '🔁',
    group: 'control',
    groupLabel: '控制流',
    description: '对数组逐项跑子图,或固定次数迭代。每轮的 __index / __item 暴露在子图变量中。',
    config: {
      mode: {
        type: 'enum',
        label: '循环类型',
        values: ['for-each', 'times'],
        default: 'for-each'
      },
      itemsExpr: {
        type: 'string',
        label: '数组表达式',
        description: '形如 {{nodes.n2.output.items}}',
        placeholder: '{{vars.list}}'
      },
      times: {
        type: 'number',
        label: '次数(times 模式用)',
        default: 3, min: 1, max: 1000
      },
      childNodeIds: {
        type: 'array<string>',
        label: '循环体节点 ID',
        default: []
      },
      maxConcurrent: {
        type: 'number',
        label: '并行迭代数(1 = 顺序)',
        default: 1, min: 1, max: 8
      },
      stopOnError: {
        type: 'boolean',
        label: '错误时停止',
        default: true
      },
      maxIterations: {
        type: 'number',
        label: '最大迭代上限(防死循环)',
        default: 100, min: 1, max: 10000
      }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [
      { name: 'out', type: 'array<any>', description: '每轮迭代的输出数组' },
      { name: 'count', type: 'number', description: '实际执行的迭代次数' }
    ]
  },

  /* 4. human-confirm */
  {
    type: 'human-confirm',
    title: '人工确认',
    icon: '✋',
    group: 'control',
    groupLabel: '控制流',
    description: '暂停工作流,等用户在 UI 上点击「批准」或「驳回」。可设置超时自动跳分支。',
    config: {
      title: { type: 'string', label: '提示标题', default: '请确认是否继续' },
      detail: { type: 'string', label: '提示详情', default: '' },
      previewExpr: {
        type: 'string',
        label: '预览内容表达式',
        description: '展示给用户看的内容,如 {{nodes.n3.output}}',
        placeholder: '{{nodes.n3.output}}'
      },
      timeoutMs: {
        type: 'number',
        label: '超时(毫秒,0 = 永久等)',
        default: 600000   // 10 分钟
      },
      timeoutAction: {
        type: 'enum',
        label: '超时行为',
        values: ['approve', 'reject', 'fail'],
        default: 'reject'
      },
      approveLabel: { type: 'string', label: '批准按钮文字', default: '批准' },
      rejectLabel: { type: 'string', label: '驳回按钮文字', default: '驳回' }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [
      { name: 'out', type: 'any', description: '透传上游输入(approve 路径)' },
      { name: 'decision', type: 'enum<approve|reject|timeout>', description: '用户决策结果' }
    ]
  }
]

/* ────────────────────────────────────────────────────────────
 * 注册扩展接口
 * ──────────────────────────────────────────────────────────── */

const _customExtras = []

/**
 * 业务方/插件可注册自己的工具类型。
 *   定义需含 type / title / config / 与 EXTRA_TOOLS 同型。
 */
export function registerExtraTool(definition) {
  if (!definition?.type) return false
  if (EXTRA_TOOLS.find(t => t.type === definition.type)) return false
  _customExtras.push(definition)
  return true
}

export function getExtraTools() {
  return [...EXTRA_TOOLS, ..._customExtras].map(t => deepClone(t))
}

export function getExtraToolByType(type) {
  const all = getExtraTools()
  return all.find(t => t.type === type) || null
}

/**
 * 给 workflowTools.getWorkflowTools() 的结果再追加 extras。
 * 编辑器和 runner 应用此 helper 拿"全集合"。
 */
export function mergeWithBuiltin(builtinList) {
  const builtin = Array.isArray(builtinList) ? builtinList : []
  const seen = new Set(builtin.map(t => t.type))
  const result = [...builtin]
  for (const t of getExtraTools()) {
    if (!seen.has(t.type)) result.push(t)
  }
  return result
}

function deepClone(v) {
  return JSON.parse(JSON.stringify(v))
}

/* ────────────────────────────────────────────────────────────
 * 执行实现
 * ──────────────────────────────────────────────────────────── */

/**
 * 执行一个 extra 节点。由 workflowRunner 在调度到这些节点时调用。
 *
 *   node:    workflow node 对象(含 type / config / payload)
 *   context: { instanceId, vars, nodeOutputs, runChildNode, callAssistant, requestUserConfirm, signal }
 *
 *   runChildNode(nodeId, scopeVars) → output  // 由 runner 提供,用于 parallel / loop 子图
 *   callAssistant(assistantId, input, opts) → text
 *   requestUserConfirm({ title, detail, preview, timeoutMs }) → 'approve' | 'reject' | 'timeout'
 *
 * 返回:{ ok, output, parsed?, decision?, count?, error? }
 */
export async function executeExtraTool(node, context = {}) {
  const type = node?.type
  switch (type) {
    case 'assistant-invoke':
      return runAssistantInvoke(node, context)
    case 'parallel':
      return runParallel(node, context)
    case 'loop':
      return runLoop(node, context)
    case 'human-confirm':
      return runHumanConfirm(node, context)
    default:
      return { ok: false, error: `executeExtraTool: 未知 type ${type}` }
  }
}

/* ────────── 1. assistant-invoke ────────── */

async function runAssistantInvoke(node, ctx) {
  const cfg = node.config || node.payload || {}
  const assistantId = String(cfg.assistantId || '').trim()
  if (!assistantId) return { ok: false, error: '缺 assistantId' }
  if (typeof ctx.callAssistant !== 'function') {
    return { ok: false, error: 'context.callAssistant 未提供' }
  }

  emit('node:run', {
    instanceId: ctx.instanceId,
    nodeId: node.id,
    nodeType: 'assistant-invoke',
    assistantId,
    startedAt: Date.now()
  })

  const timeoutMs = Number(cfg.timeoutMs) || 120000
  const timeoutCtrl = new AbortController()
  const timeoutTimer = setTimeout(() => timeoutCtrl.abort('timeout'), timeoutMs)

  try {
    const text = await ctx.callAssistant(assistantId, ctx.input, {
      overrideModel: cfg.overrideModel || '',
      overrideAction: cfg.overrideAction || '',
      previewOnly: cfg.previewOnly === true,
      signal: anySignal([ctx.signal, timeoutCtrl.signal])
    })
    clearTimeout(timeoutTimer)
    let parsed = null
    if (typeof text === 'string' && text.trim().startsWith('{')) {
      try { parsed = JSON.parse(text) } catch (_) {}
    }
    return { ok: true, output: text, parsed }
  } catch (e) {
    clearTimeout(timeoutTimer)
    return { ok: false, error: String(e?.message || e) }
  }
}

/* ────────── 2. parallel ────────── */

async function runParallel(node, ctx) {
  const cfg = node.config || node.payload || {}
  const branches = Array.isArray(cfg.branches) ? cfg.branches : []
  if (branches.length === 0) return { ok: true, output: [] }
  const waitMode = ['all', 'any', 'first-success'].includes(cfg.waitMode) ? cfg.waitMode : 'all'
  const concurrency = Math.max(1, Math.min(Number(cfg.concurrency) || 4, 16))

  if (typeof ctx.runChildNodes !== 'function') {
    return { ok: false, error: 'context.runChildNodes 未提供' }
  }

  emit('node:run', {
    instanceId: ctx.instanceId,
    nodeId: node.id,
    nodeType: 'parallel',
    branchCount: branches.length,
    waitMode
  })

  const branchPromises = branches.map((branchNodeIds, idx) =>
    ctx.runChildNodes(Array.isArray(branchNodeIds) ? branchNodeIds : [], { branchIndex: idx })
  )

  if (waitMode === 'all') {
    const results = await runConcurrently(
      branchPromises.map((p, i) => ({ p, i })),
      async ({ p }) => p,
      { concurrency, stopOnError: false }
    )
    const outputs = results.map(r => r && typeof r === 'object' && r.error ? null : r)
    const firstWinner = outputs.find(o => o != null) || null
    const allOk = outputs.every(o => o != null)
    return { ok: allOk, output: outputs, firstWinner }
  }

  // any / first-success — 谁先返回就赢
  return new Promise(resolve => {
    const outputs = new Array(branchPromises.length).fill(null)
    let resolved = false
    let completed = 0
    branchPromises.forEach((p, i) => {
      p.then(value => {
        outputs[i] = value
        if (!resolved && (waitMode === 'any' || (waitMode === 'first-success' && value != null))) {
          resolved = true
          resolve({ ok: true, output: outputs, firstWinner: value })
        }
      }).catch(() => {
        outputs[i] = null
      }).finally(() => {
        completed += 1
        if (completed === branchPromises.length && !resolved) {
          resolved = true
          const firstWinner = outputs.find(o => o != null) || null
          resolve({
            ok: firstWinner != null,
            output: outputs,
            firstWinner,
            error: firstWinner == null ? '所有分支都失败' : ''
          })
        }
      })
    })
  })
}

/* ────────── 3. loop ────────── */

async function runLoop(node, ctx) {
  const cfg = node.config || node.payload || {}
  const mode = cfg.mode === 'times' ? 'times' : 'for-each'
  const childIds = Array.isArray(cfg.childNodeIds) ? cfg.childNodeIds : []
  const maxIter = Math.max(1, Math.min(Number(cfg.maxIterations) || 100, 10000))
  const maxConcurrent = Math.max(1, Math.min(Number(cfg.maxConcurrent) || 1, 8))
  const stopOnError = cfg.stopOnError !== false

  let items
  if (mode === 'times') {
    const n = Math.max(1, Math.min(Number(cfg.times) || 1, maxIter))
    items = Array.from({ length: n }, (_, i) => i)
  } else {
    // for-each: 解析 itemsExpr
    items = ctx.resolveExpr ? ctx.resolveExpr(cfg.itemsExpr || '') : []
    if (!Array.isArray(items)) items = []
    if (items.length > maxIter) items = items.slice(0, maxIter)
  }

  if (items.length === 0) return { ok: true, output: [], count: 0 }
  if (typeof ctx.runChildNodes !== 'function') {
    return { ok: false, error: 'context.runChildNodes 未提供' }
  }

  emit('node:run', {
    instanceId: ctx.instanceId,
    nodeId: node.id,
    nodeType: 'loop',
    iterations: items.length,
    mode
  })

  const outputs = new Array(items.length).fill(null)
  let firstError = null
  let abort = false

  await runConcurrently(items, async (item, index) => {
    if (abort) return null
    if (ctx.signal?.aborted) return null
    try {
      const value = await ctx.runChildNodes(childIds, {
        loopIndex: index,
        loopItem: item,
        scopeVars: { __index: index, __item: item }
      })
      outputs[index] = value
      emit('node:progress', {
        instanceId: ctx.instanceId,
        nodeId: node.id,
        nodeType: 'loop',
        completed: index + 1,
        total: items.length
      })
      return value
    } catch (e) {
      if (!firstError) firstError = e
      if (stopOnError) abort = true
      return null
    }
  }, { concurrency: maxConcurrent, signal: ctx.signal })

  return {
    ok: !firstError || !stopOnError,
    output: outputs,
    count: outputs.filter(o => o != null).length,
    error: firstError ? String(firstError?.message || firstError) : ''
  }
}

/* ────────── 4. human-confirm ────────── */

async function runHumanConfirm(node, ctx) {
  const cfg = node.config || node.payload || {}
  if (typeof ctx.requestUserConfirm !== 'function') {
    return { ok: false, error: 'context.requestUserConfirm 未提供' }
  }

  const previewExpr = String(cfg.previewExpr || '')
  const previewText = ctx.resolveExpr ? String(ctx.resolveExpr(previewExpr) || '') : ''

  emit('workflow:pause', {
    instanceId: ctx.instanceId,
    nodeId: node.id,
    reason: 'human-confirm',
    title: cfg.title,
    detail: cfg.detail,
    preview: previewText.slice(0, 1000)
  })

  const timeoutMs = Number(cfg.timeoutMs) || 0
  const timeoutAction = ['approve', 'reject', 'fail'].includes(cfg.timeoutAction)
    ? cfg.timeoutAction
    : 'reject'

  let decision = 'reject'
  try {
    decision = await Promise.race([
      ctx.requestUserConfirm({
        title: cfg.title || '请确认是否继续',
        detail: cfg.detail || '',
        preview: previewText,
        approveLabel: cfg.approveLabel || '批准',
        rejectLabel: cfg.rejectLabel || '驳回',
        signal: ctx.signal
      }),
      timeoutMs > 0
        ? new Promise(resolve => setTimeout(() => resolve('timeout'), timeoutMs))
        : new Promise(() => {})  // 永久等
    ])
  } catch (_) {
    decision = 'reject'
  }

  emit('workflow:resume', {
    instanceId: ctx.instanceId,
    nodeId: node.id,
    decision
  })

  if (decision === 'timeout') {
    if (timeoutAction === 'fail') {
      return { ok: false, error: '人工确认超时', decision: 'timeout' }
    }
    return { ok: timeoutAction === 'approve', output: ctx.input, decision: 'timeout' }
  }

  return {
    ok: decision === 'approve',
    output: decision === 'approve' ? ctx.input : null,
    decision
  }
}

/* ────────── 内部:多 signal 合并 ────────── */

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
  EXTRA_TOOLS,
  registerExtraTool,
  getExtraTools,
  getExtraToolByType,
  mergeWithBuiltin,
  executeExtraTool
}
