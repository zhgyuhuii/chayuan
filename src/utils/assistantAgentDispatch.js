/**
 * 助手执行双轨分流器（助手 agent 化 P0-4）
 *
 * 职责：
 *  1. FC 能力记忆：agent 回合因「模型不支持工具调用」失败时标记该模型（会话级），
 *     后续该模型助手直接走 direct 轨，不再撞死 agent 轨道。
 *  2. 车道判定：resolveAssistantLane → 'agent'（完整 AgentLoop）| 'direct'（直调生成+指令式写回）。
 *  3. direct 轨写回参数构造：按 documentAction 把模型输出组装成 sidecar 写工具参数
 *     （写回本身经 callLocalTool → sidecar → dispatch，自带写锁 FIFO + __expectedDocId）。
 *
 * direct 轨支持的写回：insert 系（document_insert）与 replace（document_replace）。
 * comment 系动作在 direct 轨退化为「结果仅在消息里」（批注需要逐条 issues 结构，
 * 直调单文本构造不可靠——返回 null 由调用方决定是否提示降级）。
 */

const _fcUnsupportedModels = new Set()

export function modelFcKey(providerId, modelId) {
  return `${String(providerId || '')}::${String(modelId || '')}`
}

/** agent 回合因工具调用不支持而失败时标记（会话级记忆，重启失效重探测） */
export function markModelFcUnsupported(providerId, modelId) {
  const key = modelFcKey(providerId, modelId)
  if (key !== '::') _fcUnsupportedModels.add(key)
}

export function isModelFcUnsupported(providerId, modelId) {
  return _fcUnsupportedModels.has(modelFcKey(providerId, modelId))
}

/** 仅供测试/重置 */
export function resetModelFcMemory() {
  _fcUnsupportedModels.clear()
}

/**
 * 快速轨判定（性能优化）：选区/短文本已内联 + 单动作写回的任务不需要 AgentLoop
 * （不需要模型自主读文档）——direct 轨 1 次生成+派发写回，比 agent 轨快 2-3 倍
 * （agent 轨两轮完整 LLM 调用 + 每轮全量 45 工具 schema + reasoning 思考链×2）。
 */
export function isFastLaneEligible({ inputText = '', inputLength = 0, effectiveDocumentAction = 'insert', kbBound = false } = {}) {
  if (kbBound) return false
  const action = String(effectiveDocumentAction || '').trim()
  const inlineLen = String(inputText || '').length || Number(inputLength) || 0
  // 生成类（从零产出，2026-11-21 全面直出裁决）：空输入合法——写邮件/通知/出题
  // 的「无输入」不该被一票否决进 agent 轨空转仪式；一次生成 + 一次落盘即完成。
  // 变换类（replace）必须有内联原文（没原文就没变换对象），且 ≤8000（长文 agent 自主读）
  if (['insert', 'append', 'prepend', 'none'].includes(action)) return inlineLen <= 8000
  if (!inlineLen || inlineLen > 8000) return false // 无内联/长文：agent 需要自主读文档
  return action === 'replace'
}

/**
 * 车道判定。
 * @param {object} opts
 * @param {string} [opts.providerId] @param {string} [opts.modelId]
 * @param {string} [opts.forceLane] 调用方显式覆盖（'agent'|'direct'，测试/设置用）
 * @param {boolean} [opts.fastLaneEligible] 快速轨判定（选区内联+单动作，调用方算好传入）
 * @returns {'agent'|'direct'}
 */
export function resolveAssistantLane({ providerId, modelId, forceLane, fastLaneEligible = false } = {}) {
  if (forceLane === 'agent' || forceLane === 'direct') return forceLane
  if (isModelFcUnsupported(providerId, modelId)) return 'direct'
  return fastLaneEligible ? 'direct' : 'agent'
}

/** 锚点安全上限：WPS Find 对长 needle 不可用（三审 P0-1），超限不做锚点式写回 */
const ANCHOR_TEXT_LIMIT = 2000


/**
 * 思考开关判定（性能实测 2026-11-21）：glm-5.3-flash 扩写任务思考开启 16.7s
 * （reasoning 1037/1282 tokens——80% 生成量在思考），关闭后 5.1s（输出长度相当）。
 * 快速轨（direct）的简单任务禁思考 → 接近大模型原始速度。仅智谱系注入
 * （thinking 参数为智谱 GLM 专有；其它厂商未知参数有严格解析风险——Agnes rust
 * serde 实测过严格拒绝未知字段）。
 */
export function shouldDisableThinking(providerId, apiUrl = '', thinkingEnabled = false) {
  // 用户思考模式开关优先：开启=保持模型默认思考（不注入 disabled）
  if (thinkingEnabled) return false
  const pid = String(providerId || '').toUpperCase()
  const url = String(apiUrl || '').toLowerCase()
  return pid.includes('ZHIPU') || pid.includes('GLM') || url.includes('bigmodel.cn')
}

/**
 * direct 轨写回参数构造：把模型输出组装成 sidecar 写工具调用参数。
 * @param {object} opts
 * @param {string} opts.effectiveDocumentAction
 * @param {string} [opts.inputText] 选区/全文原文（作 originalText 锚点）
 * @param {boolean} [opts.hasSelection]
 * @param {string} opts.outputText 模型生成正文
 * @param {string} [opts.title] 撤销/账本标题
 * @param {string} [opts.expectDocId] 目标文档身份（发起侧取活动对象，注入 __expectedDocId
 *   保留字段——dispatch 写锁排队期间比对身份，防切档后写错文件；headless 容器注入）
 * @returns {{ toolName: string, args: object } | null} null=该动作无 direct 写回
 *   （comment 系/none，或锚点超长——超长全文 replace/选区 insert-after 的 originalText
 *   定位必 LOCATE 失败，宁可不兜写让结果留在消息里，也不静默写失败）
 */
export function buildDirectWriteToolArgs({ effectiveDocumentAction = 'insert', inputText = '', hasSelection = false, outputText = '', title = '', expectDocId = '', selectionRange = null } = {}) {
  const action = String(effectiveDocumentAction || 'insert')
  const output = String(outputText ?? '')
  if (!output) return null
  const anchorText = String(inputText || '')
  const anchorUsable = !!anchorText && anchorText.length <= ANCHOR_TEXT_LIMIT
  const pin = String(expectDocId || '').trim()
  const base = {
    confirmed: true,
    ...(title ? { title } : {}),
    // 保留字段（dispatch.js:590-595 剥离后作写锁身份校验，不进真实 WPS 调用）
    ...(pin ? { __expectedDocId: pin } : {})
  }
  // 选区偏移快照（发起时 doc.Range start/end——三审真机：模型转手的 originalText
  // 与文档实时文本存在换行/空白差异 → LOCATE 失败；偏移定位是根治）
  const sel = selectionRange && typeof selectionRange === 'object'
    ? { start: Number(selectionRange.start), end: Number(selectionRange.end) }
    : null
  const selUsable = sel && Number.isFinite(sel.start) && Number.isFinite(sel.end) && sel.end >= sel.start

  switch (action) {
    case 'insert':
    case 'insert-after': {
      // 有选区偏移：apply_ops insert-after（选区段后插入，start/end+originalText 校验，
      // normalizeNeedle 归一换行——不依赖 Find，多段/含换行选区均可）
      if (selUsable) {
        return { toolName: 'document_apply_ops', args: { ...base, action: 'insert-after', operations: [{ start: sel.start, end: sel.end, originalText: anchorText || undefined, outputText: output.replace(/^\n/, '') }] } }
      }
      // 锚点可用：document_insert position=after
      if (hasSelection && anchorUsable) {
        return { toolName: 'document_insert', args: { ...base, text: /^\n/.test(output) ? output : `\n${output}`, position: 'after', originalText: anchorText } }
      }
      return { toolName: 'document_insert', args: { ...base, text: /^\n/.test(output) ? output : `\n${output}`, position: 'append' } }
    }
    case 'append':
    case 'prepend': {
      const position = action === 'prepend' ? 'prepend' : 'append'
      return { toolName: 'document_insert', args: { ...base, text: /^\n/.test(output) || position === 'prepend' ? output : `\n${output}`, position } }
    }
    case 'replace':
    case 'comment-replace': {
      // 有选区偏移：start/end 定位 + originalText 做 expected 校验
      // （resolveWritableRange: safeForReplace = !!expected && normalizeNeedle(live)===expected
      //   —— 缺 originalText 会被「盲写守卫」拒绝（LOCATE_MISMATCH）；expected 用发起侧
      //   快照原文（normalizeNeedle 归一换行后与 live 必然一致，不依赖 Find，长文/多段均可））
      if (selUsable) {
        // paragraphWise（2026-11-21 用户裁决「翻译/重写保持原段落与样式」）：输出段数
        // 与目标区段数一致时逐段原位替换——每段样式天然保留
        return { toolName: 'document_replace', args: { ...base, start: sel.start, end: sel.end, originalText: anchorText, newText: output, paragraphWise: true } }
      }
      // 锚点兜底（Find 定位路径）：短文本锚点可用时走 originalText-only
      if (!anchorUsable) return null
      return { toolName: 'document_replace', args: { ...base, originalText: anchorText, newText: output } }
    }
    case 'comment':
    case 'none':
    default:
      return null
  }
}
