/**
 * workflowToolsP2 — W7 阶段的高级节点(W7.2-7.4)
 *
 * 节点:
 *   - aggregate-list   把上游多输出聚合成数组
 *   - map-reduce       数组 → map → reduce
 *   - code-snippet     沙箱化 JS 代码段
 *   - rag-retrieve     从 ragIndex 检索 top-k
 *   - embedding        文本 → 向量(占位)
 *   - image-gen        图像生成(via chatApiMultimodal)
 *   - audio-gen        语音生成(占位)
 *   - video-gen        视频生成(占位)
 */

import { lintCode, runSandbox } from './codeSandbox.js'
import { query as ragQuery } from '../assistant/ragIndex.js'
import { isVisionCapable } from '../chatApiMultimodal.js'
import { startTimer as startPerfTimer } from '../perfTracker.js'

export const P2_TOOLS = [
  {
    type: 'aggregate-list',
    title: '聚合列表',
    icon: 'Σ',
    group: 'transform',
    groupLabel: '数据加工',
    description: '把上游多个节点的输出聚合成一个数组,顺序由 sources 决定。',
    config: {
      sources: { type: 'array<string>', label: '上游节点 ID 列表' },
      filterEmpty: { type: 'boolean', label: '过滤空值', default: true }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [{ name: 'out', type: 'array<any>' }]
  },
  {
    type: 'map-reduce',
    title: 'Map-Reduce',
    icon: 'M·R',
    group: 'transform',
    groupLabel: '数据加工',
    description: '对数组先 map(每项跑表达式)再 reduce(累积)。',
    config: {
      itemsExpr: { type: 'string', label: '数组表达式', placeholder: '{{vars.list}}' },
      mapExpr: { type: 'string', label: 'map 表达式', placeholder: 'item.score' },
      reduceMode: { type: 'enum', label: 'reduce 模式', values: ['sum', 'avg', 'count', 'max', 'min', 'concat'], default: 'sum' },
      initial: { type: 'any', label: '初始值', default: 0 }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [
      { name: 'out', type: 'any', description: 'reduce 结果' },
      { name: 'mapped', type: 'array<any>' }
    ]
  },
  {
    type: 'code-snippet',
    title: '代码片段',
    icon: '{}',
    group: 'transform',
    groupLabel: '数据加工',
    description: '在沙箱中跑一段 JS。仅允许 input → output,无外部 IO,5s 超时。',
    config: {
      code: { type: 'string', label: '代码', required: true, placeholder: 'return input.x + input.y' },
      timeoutMs: { type: 'number', label: '超时(毫秒)', default: 5000 }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [{ name: 'out', type: 'any' }]
  },
  {
    type: 'rag-retrieve',
    title: 'RAG 检索',
    icon: '🔍',
    group: 'integration',
    groupLabel: '集成连接',
    description: '从已索引的文档检索 top-k 相关 chunk。',
    config: {
      query: { type: 'string', label: '查询文本(可用 {{...}} 模板)', required: true },
      topK: { type: 'number', label: 'top-k', default: 3, min: 1, max: 20 }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [
      { name: 'out', type: 'array<{ docId, chunkIndex, text, score }>' },
      { name: 'context', type: 'string', description: 'top-k 拼接成的上下文' }
    ]
  },
  {
    type: 'embedding',
    title: '文本向量化',
    icon: '⌬',
    group: 'integration',
    groupLabel: '集成连接',
    description: '把文本转为向量(需用户接入 embedding backend)。',
    config: {
      model: { type: 'string', label: 'embedding 模型', default: 'text-embedding-3-small' },
      input: { type: 'string', label: '输入文本' }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [{ name: 'out', type: 'array<number>', description: 'N 维向量' }]
  },
  {
    type: 'image-gen',
    title: '图像生成',
    icon: '🖼',
    group: 'integration',
    groupLabel: '集成连接',
    description: '根据文本生成图像(需 vision/image 模型)。',
    config: {
      providerId: { type: 'string', label: '提供商' },
      modelId: { type: 'string', label: '模型 ID' },
      prompt: { type: 'string', label: '提示词', required: true },
      aspectRatio: { type: 'string', label: '宽高比', default: '1:1' }
    },
    inputPorts: [{ name: 'in', type: 'any' }],
    outputPorts: [
      { name: 'out', type: 'string', description: 'data:image/...' },
      { name: 'mimeType', type: 'string' }
    ]
  },
  {
    type: 'audio-gen',
    title: '语音生成',
    icon: '🔊',
    group: 'integration',
    groupLabel: '集成连接',
    description: 'TTS 文本转语音(占位 — 需用户接 TTS 服务)。',
    config: {
      voice: { type: 'string', label: '音色', default: 'default' },
      speed: { type: 'number', label: '语速', default: 1.0 }
    },
    inputPorts: [{ name: 'in', type: 'string' }],
    outputPorts: [{ name: 'out', type: 'string', description: 'data:audio/...' }]
  },
  {
    type: 'video-gen',
    title: '视频生成',
    icon: '🎬',
    group: 'integration',
    groupLabel: '集成连接',
    description: '文本生成短视频(占位 — 需用户接服务)。',
    config: {
      duration: { type: 'string', label: '时长', default: '6s' },
      aspectRatio: { type: 'string', label: '宽高比', default: '16:9' }
    },
    inputPorts: [{ name: 'in', type: 'string' }],
    outputPorts: [{ name: 'out', type: 'string', description: 'video URL / data URL' }]
  }
]

/* ────────────────────────────────────────────────────────────
 * 执行实现
 * ──────────────────────────────────────────────────────────── */

export async function executeP2Tool(node, context = {}) {
  const type = node?.type
  switch (type) {
    case 'aggregate-list': return runAggregateList(node, context)
    case 'map-reduce':     return runMapReduce(node, context)
    case 'code-snippet':   return runCodeSnippet(node, context)
    case 'rag-retrieve':   return runRagRetrieve(node, context)
    case 'embedding':      return runEmbedding(node, context)
    case 'image-gen':      return runImageGen(node, context)
    case 'audio-gen':      return runAudioGen(node, context)
    case 'video-gen':      return runVideoGen(node, context)
    default:
      return { ok: false, error: `executeP2Tool: 未知 type ${type}` }
  }
}

async function runAggregateList(node, ctx) {
  const cfg = node.config || node.payload || {}
  const sources = Array.isArray(cfg.sources) ? cfg.sources : []
  const result = []
  for (const id of sources) {
    const v = ctx.nodeOutputs?.[id]
    if (cfg.filterEmpty !== false && (v == null || v === '')) continue
    result.push(v)
  }
  return { ok: true, output: result }
}

async function runMapReduce(node, ctx) {
  const cfg = node.config || node.payload || {}
  let items = ctx.resolveExpr ? ctx.resolveExpr(cfg.itemsExpr || '') : []
  if (!Array.isArray(items)) items = []

  // map
  const mapped = []
  for (const item of items) {
    let v = item
    if (cfg.mapExpr) {
      try {
        // 简易表达式:仅暴露 item / index
        const fn = new Function('item', 'index', `return ${cfg.mapExpr}`)
        v = fn(item, mapped.length)
      } catch (_) { v = null }
    }
    mapped.push(v)
  }

  // reduce
  const initial = cfg.initial !== undefined ? cfg.initial : 0
  let out
  switch (cfg.reduceMode) {
    case 'sum': out = mapped.reduce((s, x) => s + (Number(x) || 0), Number(initial) || 0); break
    case 'avg': out = mapped.length === 0 ? 0 : mapped.reduce((s, x) => s + (Number(x) || 0), 0) / mapped.length; break
    case 'count': out = mapped.length; break
    case 'max': out = mapped.length === 0 ? null : Math.max(...mapped.map(x => Number(x) || -Infinity)); break
    case 'min': out = mapped.length === 0 ? null : Math.min(...mapped.map(x => Number(x) || Infinity)); break
    case 'concat': out = mapped.map(x => String(x ?? '')).join(''); break
    default: out = mapped
  }
  return { ok: true, output: out, mapped }
}

async function runCodeSnippet(node, ctx) {
  const cfg = node.config || node.payload || {}
  if (!cfg.code) return { ok: false, error: '缺 code' }
  const lint = lintCode(cfg.code)
  if (!lint.ok) return { ok: false, error: 'lint: ' + lint.errors.join(';') }
  return runSandbox(cfg.code, {
    input: ctx.input,
    timeoutMs: Number(cfg.timeoutMs) || 5000
  })
}

async function runRagRetrieve(node, ctx) {
  const cfg = node.config || node.payload || {}
  const queryText = ctx.resolveExpr ? String(ctx.resolveExpr(cfg.query || '')) : (cfg.query || '')
  if (!queryText) return { ok: false, error: '缺 query' }
  try {
    const hits = await ragQuery(queryText, { topK: Number(cfg.topK) || 3 })
    const context = (hits || []).map(h => h.text).join('\n\n')
    return { ok: true, output: hits, context }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

async function runEmbedding(node, ctx) {
  const cfg = node.config || node.payload || {}
  const text = cfg.input || ctx.input
  if (!text) return { ok: false, error: '缺 input' }
  // 占位:真实场景调 OpenAI embeddings API
  // 这里返回 dummy 向量(haseh 派生)以让流程能跑通
  const vec = textToDummyVector(String(text), 1536)
  return { ok: true, output: vec, _placeholder: true }
}

function textToDummyVector(text, dim) {
  const v = new Array(dim).fill(0)
  for (let i = 0; i < text.length; i++) {
    v[i % dim] += text.charCodeAt(i) / 1000
  }
  // L2 normalize
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
  return v.map(x => x / norm)
}

async function runImageGen(node, ctx) {
  const cfg = node.config || node.payload || {}
  if (!cfg.prompt) return { ok: false, error: '缺 prompt' }
  if (!isVisionCapable(cfg.modelId || '')) {
    return { ok: false, error: `模型 ${cfg.modelId} 不支持视觉/图像` }
  }
  // 真实实现需要接对应 image API(DALL-E / Midjourney / 通义万相)
  // 这里走占位
  const stop = startPerfTimer({ kind: 'workflow.image-gen', providerId: cfg.providerId || 'placeholder', modelId: cfg.modelId || 'placeholder' })
  stop({ ok: false, note: 'placeholder' })
  return {
    ok: false,
    error: 'image-gen 是占位实现,请接入实际图像生成 API',
    _placeholder: true
  }
}

async function runAudioGen(node, ctx) {
  return { ok: false, error: 'audio-gen 是占位实现', _placeholder: true }
}

async function runVideoGen(node, ctx) {
  return { ok: false, error: 'video-gen 是占位实现', _placeholder: true }
}

export default {
  P2_TOOLS,
  executeP2Tool
}
