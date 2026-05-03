/**
 * retrievalMiddleware — 给 sendPipeline 用的注入 hook
 *
 * 详见 plan §3.2.9
 *
 * 用法(在 chatFlow / documentFlow / assistantFlow 准备 messagesForApi 之后):
 *
 *   import { applyKbRetrievalIfBound } from '../kb/retrievalMiddleware.js'
 *   ctx = await applyKbRetrievalIfBound(ctx)
 *
 * ctx 约定字段:
 *   - chat:                { id, kbBindings? }
 *   - userMessage:         { content }
 *   - kbQueryText?         发起检索用的文本(默认 userMessage.content)
 *   - kbMode?              'qa' | 'verify' | 'summarize'(默认 qa)
 *   - messagesForApi:      [{role, content}] 准备发给 LLM 的消息
 *   - assistantMessageMeta:   会写入 kbSources / kbBatchPlan / kbCitations
 *   - abortSignal?
 *
 * 行为:
 *   1. 未绑 KB → 直通
 *   2. 检索 0 命中 → 在 system 注入"知识库未命中"提示,UI 标橙
 *   3. 检索成功 → 用 promptBuilder 构 system prompt,前置到 messagesForApi
 *   4. 把 sources + plan 元信息挂到 assistantMessageMeta 给气泡 UI 用
 */

import { getConnection, getCurrentConnection } from './connectionStore.js'
import { run as runSearch } from './searchOrchestrator.js'
import { build as buildPrompt } from './promptBuilder.js'
import { isEnabled as _isFlagEnabled } from '../../utils/featureFlags.js'

const NO_KB_NOTICE = '【知识库提示】未在已绑定的知识库中检索到相关内容,请基于一般常识回答,并明示"知识库未覆盖"。'

export async function applyKbRetrievalIfBound(ctx) {
  // plan v1.3 §5.6 灰度开关:被关闭后整条 KB 链路绕过,kbBindings 仍保留但不影响 chat
  try {
    if (!_isFlagEnabled('kbRemoteIntegration')) return ctx
  } catch (e) { /* 缺 featureFlags 模块时默认放行 */ }

  const binding = _normalizeBinding(ctx?.chat?.kbBindings)
  if (!binding?.kbNames?.length) return ctx

  const connection = (binding.connectionId ? getConnection(binding.connectionId) : null) || getCurrentConnection()
  if (!connection) return ctx

  const queryText = ctx.kbQueryText || ctx.userMessage?.content || ''
  if (!queryText.trim()) return ctx

  const mode = ctx.kbMode || 'qa'

  let result
  try {
    result = await runSearch({
      connection,
      query: queryText,
      kbBindings: binding,
      mode,
      signal: ctx.abortSignal,
      onPhase: ctx.onKbPhase,
      chatCompletion: ctx.chatCompletionForDistill
    })
  } catch (e) {
    // 失败不致命:在 ctx 上记一笔,let UI render warning
    if (ctx.assistantMessageMeta) {
      ctx.assistantMessageMeta.kbError = e.message || String(e)
    }
    return ctx
  }

  const sources = result?.chunks || []
  if (!ctx.assistantMessageMeta) ctx.assistantMessageMeta = {}
  ctx.assistantMessageMeta.kbSources = sources
  ctx.assistantMessageMeta.kbBySection = result?.bySection
  ctx.assistantMessageMeta.kbPlan = result?.plan
  ctx.assistantMessageMeta.kbTimings = result?.timings
  ctx.assistantMessageMeta.kbConnectionId = connection.id
  ctx.assistantMessageMeta.kbBindings = binding

  if (sources.length === 0) {
    _prependSystemMessage(ctx, NO_KB_NOTICE)
    return ctx
  }

  const { systemPrompt, userPrompt, citationMap, error: pbError } = buildPrompt({
    mode,
    sources,
    userQuery: queryText,
    selectionText: ctx.selectionText
  })
  ctx.assistantMessageMeta.kbCitationMap = citationMap

  // promptBuilder 显式报错时(如 verify 缺 selectionText),挂到 meta 给 UI 展示
  if (pbError) {
    ctx.assistantMessageMeta.kbPromptError = pbError
    if (pbError === 'missing_selection') {
      ctx.assistantMessageMeta.kbWarning =
        '⚠️ 核对模式需要先在文档里选中要核对的段落,本次将仅展示检索到的相关知识片段供你参考。'
    }
  }

  // 注入 system prompt;若用户最后一条 message 是 selection 类型,可改写 user content
  _prependSystemMessage(ctx, systemPrompt)

  const last = ctx.messagesForApi[ctx.messagesForApi.length - 1]
  if (last && last.role === 'user' && userPrompt) {
    // userPrompt 内含【知识库片段】和【问题】;QA 也必须替换,否则模型看不到检索内容。
    last.content = userPrompt
  }

  return ctx
}

function _normalizeBinding(raw) {
  const cfg = raw?.config && typeof raw.config === 'object' ? raw.config : {}
  const kbNames = Array.from(new Set(
    (Array.isArray(raw?.kbNames) ? raw.kbNames : [])
      .map(v => String(v || '').trim())
      .filter(Boolean)
  ))
  const topK = Number(raw?.topK ?? cfg.topK)
  const finalTopK = Number(raw?.finalTopK ?? cfg.finalTopK)
  const scoreThreshold = Number(raw?.scoreThreshold ?? cfg.scoreThreshold)
  const mergeStrategy = String(raw?.mergeStrategy || raw?.fusion || cfg.mergeStrategy || cfg.fusion || 'rrf').trim() || 'rrf'
  return {
    ...raw,
    kbNames,
    connectionId: String(raw?.connectionId || '').trim(),
    topK: Number.isFinite(topK) && topK > 0 ? topK : 5,
    finalTopK: Number.isFinite(finalTopK) && finalTopK > 0 ? finalTopK : undefined,
    scoreThreshold: Number.isFinite(scoreThreshold) ? scoreThreshold : undefined,
    hybrid: (raw?.hybrid ?? cfg.hybrid) !== false,
    rerank: (raw?.rerank ?? cfg.rerank) === true,
    mergeStrategy,
    config: {
      ...cfg,
      topK: Number.isFinite(topK) && topK > 0 ? topK : 5,
      fusion: mergeStrategy,
      hybrid: (raw?.hybrid ?? cfg.hybrid) !== false,
      rerank: (raw?.rerank ?? cfg.rerank) === true
    }
  }
}

function _prependSystemMessage(ctx, content) {
  if (!Array.isArray(ctx.messagesForApi)) ctx.messagesForApi = []
  // 与现有 system 合并,避免重复 system 块
  const idx = ctx.messagesForApi.findIndex(m => m.role === 'system')
  if (idx >= 0) {
    ctx.messagesForApi[idx] = { role: 'system', content: `${ctx.messagesForApi[idx].content}\n\n${content}` }
  } else {
    ctx.messagesForApi.unshift({ role: 'system', content })
  }
}

export default { applyKbRetrievalIfBound }
