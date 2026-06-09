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
 *   - contextText?         选区/全文/附件等额外材料,只给模型分析,不作为检索 query
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
import { fetchList as fetchKbCatalog } from './kbCatalog.js'
import { invalidate as invalidateKbCatalog } from './kbCatalogCache.js'

const NO_KB_NOTICE = '【知识库提示】未在已绑定的知识库中检索到相关内容,请基于一般常识回答,并明示"知识库未覆盖"。'
const STALE_KB_NOTICE = '【知识库提示】绑定的知识库已被删除或权限被收回,本次未做检索,请在侧栏重新选择。'

/** 把 binding.kbNames / kuIds 都规范成 doc:/src:/office: 前缀的 ku_id 形式 */
function _normalizeKuId(name) {
  const text = String(name || '').trim()
  if (!text) return ''
  if (/^(doc|src|office):/.test(text)) return text
  return `doc:${text}`
}

/**
 * 用最近的 catalog 把 binding 中"已不存在 / 无权"的 KB 剔掉。
 * - 命中缓存即用,5 分钟 TTL 期内零网络;过期 / force=true 才走网络。
 * - 拿不到 catalog(网络挂 / 接口缺)→ 直接放行,不阻塞搜索。
 */
async function _filterBindingByCatalog(connection, binding, { force = false, signal } = {}) {
  let list = []
  try {
    list = await fetchKbCatalog(connection, { force, signal })
  } catch (e) {
    return binding   // 兜底:catalog 出错就不过滤,让 runSearch 自己继续
  }
  if (!Array.isArray(list) || list.length === 0) return binding
  const accessible = new Set(list.map(item => _normalizeKuId(item?.kuId || item?.id || item?.kb_name)))
  const keep = (binding.kbNames || [])
    .map(_normalizeKuId)
    .filter(name => accessible.has(name))
  if (keep.length === binding.kbNames?.length) return binding   // 全部命中,无需修
  const keepSet = new Set(keep)
  const filteredSourceRefs = (binding.sourceRefs || []).filter(r => keepSet.has(_normalizeKuId(r?.kuId)))
  return {
    ...binding,
    kbNames: keep,
    kuIds: keep,
    sourceRefs: filteredSourceRefs
  }
}

export async function applyKbRetrievalIfBound(ctx) {
  // plan v1.3 §5.6 灰度开关:被关闭后整条 KB 链路绕过,kbBindings 仍保留但不影响 chat
  try {
    if (!_isFlagEnabled('kbRemoteIntegration')) return ctx
  } catch (e) { /* 缺 featureFlags 模块时默认放行 */ }

  const rawBinding = _normalizeBinding(ctx?.chat?.kbBindings)
  if (!rawBinding?.kbNames?.length) return ctx

  const connection = (rawBinding.connectionId ? getConnection(rawBinding.connectionId) : null) || getCurrentConnection()
  if (!connection) return ctx

  const queryText = ctx.kbQueryText || ctx.userMessage?.content || ''
  if (!queryText.trim()) return ctx

  const mode = ctx.kbMode || 'qa'

  // 第 1 道防御:用 catalog 预过滤 binding,把已被删除 / 收回权限的 KB 剔掉,
  // 避免明知不可用还硬调 search_batch。catalog 缓存 5 分钟,正常路径零网络。
  let binding = await _filterBindingByCatalog(connection, rawBinding, { signal: ctx.abortSignal })
  if (!binding.kbNames?.length) {
    // 绑定的 KB 全数不可用 → 不发起检索,提示用户去侧栏重选
    if (!ctx.assistantMessageMeta) ctx.assistantMessageMeta = {}
    ctx.assistantMessageMeta.kbStaleBinding = true
    ctx.assistantMessageMeta.kbBindings = rawBinding
    _prependSystemMessage(ctx, STALE_KB_NOTICE)
    return ctx
  }

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
    const status = Number(e?.status || 0)
    // 第 2 道防御:服务端已强制拒绝(403 无权 / 404 不存在)→ 缓存就是脏的,
    // 强制刷一次 catalog 让用户下次发消息能看到正确列表;本次不报"检索失败",
    // 静默走"未注入 KB"分支,避免红字噪音。
    if (status === 403 || status === 404) {
      try { invalidateKbCatalog(`list:${connection.id}`) } catch (_) { /* noop */ }
      // 异步预热(不 await,不阻塞当前 chat 链路)
      Promise.resolve().then(() => fetchKbCatalog(connection, { force: true })).catch(() => {})
      if (!ctx.assistantMessageMeta) ctx.assistantMessageMeta = {}
      ctx.assistantMessageMeta.kbStaleBinding = true
      ctx.assistantMessageMeta.kbBindings = rawBinding
      _prependSystemMessage(ctx, STALE_KB_NOTICE)
      return ctx
    }
    // 其他失败(超时 / 5xx / 网络 / 未识别错误):仍按原行为记 kbError,UI 红条提示
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
    selectionText: ctx.selectionText,
    contextText: ctx.contextText
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

/**
 * 给「助手执行器」用:对绑定 KB 检索,返回可注入提示词的**上下文字符串**(不改 messages)。
 * 与 applyKbRetrievalIfBound 共用 connection 解析 / catalog 预过滤 / runSearch,行为一致。
 * @returns {Promise<{context:string, notice:string, sources:any[]}>}
 *   context 非空 → 命中片段拼接;为空时 notice 给出原因(未绑定/未连接/未命中/失败)。
 */
export async function retrieveKbContextForAssistant(rawBinding, queryText, { signal, chatCompletion } = {}) {
  try { if (!_isFlagEnabled('kbRemoteIntegration')) return { context: '', notice: '', sources: [] } } catch (e) { /* 缺 flag 默认放行 */ }
  const binding0 = _normalizeBinding(rawBinding)
  if (!binding0?.kbNames?.length) return { context: '', notice: '未绑定知识库,无法对比;请先在对话侧栏选择知识库后重试。', sources: [] }
  const connection = (binding0.connectionId ? getConnection(binding0.connectionId) : null) || getCurrentConnection()
  if (!connection) return { context: '', notice: '知识库未连接。', sources: [] }
  const q = String(queryText || '').trim()
  if (!q) return { context: '', notice: '', sources: [] }
  let binding = await _filterBindingByCatalog(connection, binding0, { signal })
  if (!binding.kbNames?.length) return { context: '', notice: STALE_KB_NOTICE, sources: [] }
  let result
  try {
    result = await runSearch({ connection, query: q.slice(0, 12000), kbBindings: binding, mode: 'verify', signal, chatCompletion })
  } catch (e) {
    return { context: '', notice: '知识库检索失败:' + (e?.message || String(e)), sources: [] }
  }
  const sources = result?.chunks || []
  if (!sources.length) return { context: '', notice: NO_KB_NOTICE, sources: [] }
  const context = sources.slice(0, 24)
    .map((c, i) => `【片段${i + 1}·${c.file_name || c.kb_name || 'KB'}】\n${String(c.text || '').trim()}`)
    .join('\n\n')
  return { context, notice: '', sources }
}

function _normalizeBinding(raw) {
  const cfg = raw?.config && typeof raw.config === 'object' ? raw.config : {}
  const sourceRefs = Array.from(new Map(
    (Array.isArray(raw?.sourceRefs) ? raw.sourceRefs : [])
      .map(r => ({
        kuId: String(r?.kuId || r?.kb_id || r?.id || '').trim(),
        kind: String(r?.kind || '').trim(),
        subKind: String(r?.subKind || r?.sub_kind || '').trim(),
        name: String(r?.name || r?.displayName || r?.display_name || '').trim()
      }))
      .filter(r => r.kuId)
      .map(r => [r.kuId, r])
  ).values())
  const kuIds = Array.from(new Set([
    ...(Array.isArray(raw?.kuIds) ? raw.kuIds : []),
    ...sourceRefs.map(r => r.kuId)
  ].map(v => String(v || '').trim()).filter(Boolean)))
  const kbNames = Array.from(new Set(
    [
      ...(Array.isArray(raw?.kbNames) ? raw.kbNames : []),
      ...kuIds
    ]
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
    kuIds,
    sourceRefs,
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
