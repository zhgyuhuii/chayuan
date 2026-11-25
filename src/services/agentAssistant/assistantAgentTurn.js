/**
 * 助手 agent 回合执行器（助手 agent 化 A-2，核心模块）
 *
 * 双轨执行（P0-4）：
 *  - agent 轨：instruction 编译 → runMcpChatOrchestrator（AgentLoop + MCP 工具）
 *    → expectedWriteTool 兜底检测 → 未执行则经 sidecar 派发通道补写（callLocalTool，
 *    dispatch 侧自带写锁 FIFO + 文档身份校验——禁止本 webview 直调 documentActions，
 *    三审 P0-1）
 *  - direct 轨（FC 弱模型自动降级）：chatCompletion 直调生成（无 tools，继承
 *    providerFetch 智谱转发）→ buildDirectWriteToolArgs → callLocalTool 写回
 *
 * UI 无关：所有 UI 状态经 events 回调注入（onProgress/onTurnText/onTodos/onSnapshot），
 * 面板（runAssistantAgentTurn 接线到 mcpSteps 字段族）与 headless（空回调）共用本模块。
 */

import { runMcpChatOrchestrator } from '../mcpBridge/mcpChatOrchestrator.js'
import { callLocalTool } from '../mcpBridge/mcpHttpClient.js'
import { chatCompletion, streamChatCompletion, getChatApiConfigByProvider } from '../../utils/chatApi.js'
import { getFlatModelsFromSettings, parseModelCompositeId } from '../../utils/modelSettings.js'
import { getConfiguredAssistantModelId, loadDefaultModelsByCategory } from '../../utils/assistantSettings.js'
import { inferModelType, matchesModelType } from '../../utils/modelTypeUtils.js'
import { buildAssistantAgentInstruction, extractOutputBody } from '../../utils/assistantAgentInstruction.js'
import {
  resolveAssistantLane,
  markModelFcUnsupported,
  buildDirectWriteToolArgs,
  shouldDisableThinking
} from '../../utils/assistantAgentDispatch.js'
import { appendSignal } from '../../utils/assistant/evolution/signalStore.js'
import { splitTransformChunks } from '../../utils/transformChunks.js'

/** 写回兜底工具调用经 sidecar 的超时（与 agentCoreSkill 的写工具一致量级） */
/**
 * callLocalTool 的 MCP result 不抛工具级错误（isError:true 在返回体里）——
 * 不检查就 wroteBack 假阳性（真机 2026-11-21：补写 LOCATE 失败却报已写回）。
 */
function assertToolResultOk(result) {
  const sc = result?.structuredContent || {}
  if (result?.isError === true) {
    throw new Error(String(sc?.message || sc?.code || '写入失败'))
  }
  if (sc && typeof sc === 'object' && sc.ok === false) {
    throw new Error(String(sc?.message || sc?.code || '写入失败'))
  }
  return result
}

const DIRECT_WRITE_TIMEOUT_MS = 180000

/**
 * 回合级信号写入（P0-5）：schema 兼容旧 'task' 信号（raceEvaluator/failureCluster/
 * 进化中心继续有数据）。失败容忍——信号采集不阻塞回合。
 */
function persistAgentTurnSignal({ assistantId, lane, success, failureCode = '', documentAction = '', inputText = '', outputText = '', elapsedMs = 0, degraded = false, wroteBack = false }) {
  try {
    appendSignal({
      type: 'task',
      assistantId: String(assistantId || ''),
      input: String(inputText || '').slice(0, 4000),
      output: String(outputText || '').slice(0, 4000),
      duration: Number(elapsedMs) || 0,
      success: !!success,
      failureCode: success ? '' : (String(failureCode || '') || 'agent_turn_failed'),
      documentAction: String(documentAction || ''),
      userNote: degraded ? 'fc_unsupported_downgraded_to_direct' : '',
      metadata: {
        lane,
        anchor_hit: wroteBack,
        writeTargetCount: wroteBack ? 1 : 0,
        degraded: !!degraded
      }
    })
  } catch { /* 信号采集失败不阻塞任务 */ }
}

/**
 * 助手模型解析（headless/ribbon 无面板上下文时用；与 runner resolveModel 同
 * 优先级链的轻量版）：显式 conversationModelId → 助手分类默认 → 对话默认跟随 →
 * 第一个 apiUrl 配置齐全的模型。每个候选校验 provider 真配了 apiUrl（死候选跳过）。
 */
export function resolveAssistantModel({ assistantId = '', conversationModelId = '', modelType = 'chat' } = {}) {
  const flat = getFlatModelsFromSettings(modelType)
  const byComposite = (compositeId) => {
    const id = String(compositeId || '').trim()
    if (!id) return null
    const found = flat.find((item) => item.id === id)
    if (found) return found
    const parsed = parseModelCompositeId(id)
    if (!parsed) return null
    const inferredType = inferModelType(parsed.modelId)
    if (modelType && !matchesModelType(inferredType, modelType)) return null
    return { id, providerId: parsed.providerId, modelId: parsed.modelId, name: parsed.modelId, type: modelType }
  }
  const candidates = [
    byComposite(conversationModelId),
    byComposite(getConfiguredAssistantModelId(assistantId)),
    byComposite(modelType === 'chat' ? String(loadDefaultModelsByCategory()?.chat || '') : '')
  ].filter(Boolean)
  const usable = (m) => {
    try { return !!getChatApiConfigByProvider(m.providerId, m.modelId) } catch { return false }
  }
  for (const m of candidates) {
    if (usable(m)) return m
  }
  if (flat[0]) return flat[0]
  return candidates[0] || null
}

/**
 * 执行一个助手 agent 回合。
 * @param {object} opts
 * @param {string} opts.assistantId 助手 id（评测/信号用）
 * @param {string} [opts.label] 助手显示名
 * @param {string} [opts.systemPrompt] 助手人格（personaSystemPrompt 注入点，P0-1）
 * @param {string} [opts.userPromptTemplate] 助手提示词模板（{{input}}）
 * @param {string} [opts.inputText] 任务输入（选区文本/全文提取/用户输入；全文场景可为空）
 * @param {string} [opts.inputSource] 'selection'|'document'|'none'
 * @param {boolean} [opts.hasSelection]
 * @param {number} [opts.inputLength]
 * @param {string} [opts.effectiveDocumentAction] insert/append/replace/.../none
 * @param {object} opts.model { providerId, modelId, id?, name? }
 * @param {string} [opts.host] 'wps'|'et'|'wpp'
 * @param {string} [opts.writeBaselineToken] 回合基线 token（调用方生成）
 * @param {string} [opts.targetDocumentId]
 * @param {Array} [opts.historyMessages] 跨回合上下文种子
 * @param {Array} [opts.previousTodos]
 * @param {AbortSignal} [opts.signal]
 * @param {boolean} [opts.allowDirectFallback=true] agent 轨 FC 失败时是否自动降级 direct 重跑
 * @param {object} [opts.events] { onProgress, onTurnText, onTodos, onSnapshot }
 * @returns {Promise<{ok:boolean, handled:boolean, lane:'agent'|'direct', content?:string,
 *   steps?:Array, executedTools?:string[], wroteBack?:boolean, fallbackReason?:string,
 *   degraded?:boolean, error?:Error}>}
 */
/**
 * 统一执行管线判定（2026-11-21 终局架构裁决）：
 * 助手定义（inputSource/documentAction）+ 发起快照（选区文本/start/end/绑定 pin）
 * 在启动一刻就确定了【做什么/对谁做/在哪做】——agent-core 的职责是直接干活：
 * 确定性管线（一次变换/生成调用 + 一次声明动作写回）是正路，agent 循环只是
 * 「超长/模糊/多步」任务的兜底例外。一套逻辑覆盖全部助手（校对/媒体/安全等
 * 特殊工具类另有专用管线，不经本函数）。
 * @returns {{kind:'direct'|'agent', mode?:'transform'|'generate'}}
 */
export function resolveExecutionPipeline({ inputSource = 'document', inputText = '', effectiveDocumentAction = 'replace', selectionRange = null, forcePipeline = '' } = {}) {
  if (forcePipeline === 'agent') return { kind: 'agent' }
  const action = String(effectiveDocumentAction || '').trim()
  const inline = String(inputText || '')
  const GEN = new Set(['insert', 'append', 'prepend', 'none'])
  const XFORM = new Set(['replace'])
  // 选区/全文变换：≤8000 单次直出；8000-60000 分块直出（旧版「分段单次对话」同构，
  // 确定性数据流——每块一次调用、合并一次写回，零思考轮次）；>60000 agent 兜底
  if (XFORM.has(action) && inline.trim() && inline.length <= 60000) {
    return { kind: 'direct', mode: 'transform' }
  }
  // 生成类：空输入合法（从零产出——写邮件/通知/出题）
  if (GEN.has(action) && inline.length <= 8000) {
    return { kind: 'direct', mode: 'generate' }
  }
  // 超长/模糊/多步：agent 兜底例外
  return { kind: 'agent' }
}

export async function runAssistantAgentExecution(opts = {}) {
  const {
    assistantId = '',
    label = '',
    systemPrompt = '',
    userPromptTemplate = '{{input}}',
    inputText = '',
    inputSource = 'document',
    hasSelection = false,
    inputLength = 0,
    effectiveDocumentAction = 'insert',
    fastLaneEligible = false,
    selectionRange = null,
    thinkingEnabled = false,
    variables = {},
    model = {},
    host = 'wps',
    writeBaselineToken = '',
    targetDocumentId,
    expectDocId = '',
    historyMessages = [],
    previousTodos = [],
    signal,
    allowDirectFallback = true,
    forcePipeline = '',
    events = {}
  } = opts
  const { onProgress, onTurnText, onTurnReasoning, onTodos, onSnapshot } = events

  const providerId = String(model?.providerId || '')
  const modelId = String(model?.modelId || '')
  const startedAtMs = Date.now()

  const pipeline = resolveExecutionPipeline({ inputSource, inputText, effectiveDocumentAction, selectionRange, forcePipeline })
  // FC-弱模型没有工具调用能力：agent 指定任务也一律直出（既有语义保持）
  const lane = pipeline.kind === 'agent'
    ? resolveAssistantLane({ providerId, modelId, fastLaneEligible })
    : 'direct'

  if (lane === 'direct') {
    const direct = await runDirectLane({ label, systemPrompt, userPromptTemplate, inputText, inputSource, hasSelection, inputLength, effectiveDocumentAction, model, assistantId, signal, events, expectDocId, variables, thinkingEnabled, selectionRange, transform: pipeline.mode === 'transform' })
    // 直出失败兜底（一次）：模型错误/空输出 → agent 轨重跑（AbortError 不兜底；
    // 写入失败走 ok:true + writeBackError——正文已在消息卡交付，无需重跑）
    if (
      direct.ok === false &&
      allowDirectFallback &&
      forcePipeline !== 'agent' &&
      direct.error?.name !== 'AbortError' &&
      signal?.aborted !== true
    ) {
      onProgress?.({ at: Date.now(), label: '直出未成功，自动切换完整模式重试' }, [])
      return runAssistantAgentExecution({ ...opts, forcePipeline: 'agent' })
    }
    return direct
  }

  // ── agent 轨 ──
  const { instruction, expectedWriteTools, expectWrite } = buildAssistantAgentInstruction({
    label,
    userPromptTemplate,
    inputText,
    inputSource,
    hasSelection,
    inputLength,
    effectiveDocumentAction,
    host,
    lane: 'agent',
    variables
  })

  // 分档轮数预算（2026-11-21 用户裁决 A）：生成类 6 / 改写批注类 12 / 其它默认。
  // 每轮 = 一次模型调用全额延迟；「写一篇大美河山」类任务 2-4 轮即可交付
  const GENERATION_ACTIONS = new Set(['insert', 'append', 'prepend', 'none', 'insert-after'])
  const REWRITE_ACTIONS = new Set(['replace', 'comment', 'comment-replace', 'link-comment'])
  const roundBudget = GENERATION_ACTIONS.has(String(effectiveDocumentAction || '').trim())
    ? 6
    : REWRITE_ACTIONS.has(String(effectiveDocumentAction || '').trim()) ? 12 : 0
  let out
  try {
    out = await runMcpChatOrchestrator({
      userText: instruction,
      personaSystemPrompt: systemPrompt,
      roundBudget,
      model,
      selectionCtx: hasSelection
        ? { hasSelection: true, preview: String(inputText || '').slice(0, 2000), charCount: inputLength }
        : null,
      targetDocumentId,
      writeBaselineToken,
      historyMessages,
      previousTodos,
      signal,
      onProgress,
      onTurnText,
      onTurnReasoning,
      onTodos,
      onSnapshot,
      thinkingDisabled: shouldDisableThinking(providerId, '', thinkingEnabled)
    })
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    persistAgentTurnSignal({ assistantId, lane: 'agent', success: false, failureCode: 'mcp_error', documentAction: effectiveDocumentAction, inputText, elapsedMs: Date.now() - startedAtMs })
    return { ok: false, handled: false, lane: 'agent', fallbackReason: 'mcp_error', error: e }
  }

  // 基础设施未就绪 → 交调用方回落（回落目标由调用方定：面板降任务卡提示、headless 报错）
  if (out?.fallback && out.reason && out.reason !== 'model_error') {
    persistAgentTurnSignal({ assistantId, lane: 'agent', success: false, failureCode: out.reason, documentAction: effectiveDocumentAction, inputText, elapsedMs: Date.now() - startedAtMs })
    return { ok: false, handled: false, lane: 'agent', fallbackReason: out.reason, steps: out.steps }
  }

  // FC 不支持 → 标记模型 + 自动降级 direct 重跑一次（弱模型用户无感）
  if (out?.reason === 'model_error' && out?.toolsUnsupported && allowDirectFallback) {
    markModelFcUnsupported(providerId, modelId)
    persistAgentTurnSignal({ assistantId, lane: 'agent', success: false, failureCode: 'fc_unsupported', documentAction: effectiveDocumentAction, inputText, elapsedMs: Date.now() - startedAtMs, degraded: true })
    onProgress?.({ at: Date.now(), label: '模型不支持工具调用，降级为直调模式重试' }, [])
    const direct = await runDirectLane({ label, systemPrompt, userPromptTemplate, inputText, inputSource, hasSelection, inputLength, effectiveDocumentAction, model, assistantId, signal, events, expectDocId, degraded: true, variables, thinkingEnabled, selectionRange, transform: resolveExecutionPipeline({ inputSource, inputText, effectiveDocumentAction, selectionRange }).mode === 'transform' })
    return { ...direct, degraded: true }
  }

  if (!out?.ok) {
    persistAgentTurnSignal({ assistantId, lane: 'agent', success: false, failureCode: out?.reason || 'model_error', documentAction: effectiveDocumentAction, inputText, elapsedMs: Date.now() - startedAtMs })
    return { ok: false, handled: true, lane: 'agent', fallbackReason: out?.reason || 'model_error', content: out?.content, steps: out?.steps }
  }

  // ── 写回契约兜底检测（三审 P0-1：补写必须走 sidecar 派发通道）──
  let wroteBack = false
  let writeBackError = null
  // 兜底补写内容校验（真机 2026-11-21：模型工具失败后的解释文本被兜写进文档）。
  // content 是失败/停止类说明时绝不补写——那些只属于回答文本。
  const CONTENT_FAILURE_RE = /(NO_ACTIVE_DOCUMENT|LOCATE_(NOT_FOUND|MISMATCH)|DOC_SWITCHED|已达到(工具调用)?轮次上限|请(您)?手动(打开|在)|按(纪律|要求)已?停止|写回前校验失败)/
  const contentLooksLikeFailure = CONTENT_FAILURE_RE.test(String(out.content || ''))
  if (expectWrite && expectedWriteTools.length) {
    const executed = Array.isArray(out.executedTools) ? out.executedTools : []
    // 写工具族等价匹配（三审 P0-3）：apply_ops 的 insert/replace 类与单工具等价
    wroteBack = executed.some((n) => {
      const name = String(n || '').replace(/^chayuan__/, '').replace(/^[a-z0-9]+__/, '')
      return expectedWriteTools.some((t) => name === t)
        || (name === 'document_apply_ops' && expectedWriteTools.includes('document_apply_ops'))
    })
    if (!wroteBack && !contentLooksLikeFailure) {
      const write = buildDirectWriteToolArgs({
        effectiveDocumentAction,
        inputText,
        hasSelection,
        outputText: out.content,
        title: label || assistantId,
        expectDocId,
        selectionRange
      })
      if (write) {
        try {
          assertToolResultOk(await callLocalTool(write.toolName, write.args, { signal, timeoutMs: DIRECT_WRITE_TIMEOUT_MS }))
          wroteBack = true
        } catch (e) {
          writeBackError = e
        }
      }
    }
  } else if (!expectWrite) {
    wroteBack = false
  }

  persistAgentTurnSignal({
    assistantId,
    lane: 'agent',
    success: true,
    documentAction: effectiveDocumentAction,
    inputText,
    outputText: out.content,
    elapsedMs: Date.now() - startedAtMs,
    wroteBack
  })

  return {
    ok: true,
    handled: true,
    lane: 'agent',
    content: out.content,
    steps: out.steps,
    executedTools: out.executedTools,
    proofreadCard: out.proofreadCard,
    todos: out.todos,
    loopMessages: out.loopMessages,
    wroteBack,
    writeBackError
  }
}

/**
 * direct 轨：直调生成（无 tools）+ 指令式写回（经 sidecar 派发）。
 * FC 弱模型的主轨道；agent 轨 FC 失败的自动降级目标。
 */
async function runDirectLane({
  label, systemPrompt, userPromptTemplate, inputText, inputSource,
  hasSelection, inputLength, effectiveDocumentAction, model, assistantId,
  signal, events = {}, degraded = false, expectDocId = '', variables = {}, thinkingEnabled = false, selectionRange = null, transform = false
}) {
  const { onProgress, onTurnText } = events
  const { instruction, expectedWriteTools, expectWrite } = buildAssistantAgentInstruction({
    label,
    userPromptTemplate,
    inputText,
    inputSource,
    hasSelection,
    inputLength,
    effectiveDocumentAction,
    host: 'wps',
    lane: 'direct',
    variables
  })
  // direct 轨的驱动消息 = 任务指令（含内联原文/自读指引）+ 人格前缀（无 FC 时人格只能在消息里）
  const persona = String(systemPrompt || '').trim()
  const messages = [
    ...(persona || transform ? [{
      role: 'system',
      content: [
        `你是「${label || '助手'}」。${persona}`,
        transform ? [
          '【变换纪律】你此刻是文本变换引擎（翻译/润色/改写……按用户消息执行）：',
          '- 输出与原文【逐段一一对应】：段落数量、顺序与原文完全一致，不得合并或拆分段落。',
          '- 绝对不输出任何 Markdown 标记（#、*、-、>、|）——只输出纯文本段落，每段一行。',
          '- 不解释、不加前缀后缀、不输出原文——只输出变换结果本身。'
        ].join('\n') : ''
      ].filter(Boolean).join('\n')
    }] : []),
    { role: 'user', content: instruction }
  ]

  onProgress?.({ at: Date.now(), label: degraded ? '直调模式生成中…' : '生成中…' }, [])

  // ── 超长变换：分块直出（2026-11-21 补齐旧版「分段单次对话」最后一块）──
  // >8000 字选区变换：按段界切块 → 逐块一次调用（确定性数据流，零思考轮次）→
  // 无损重组 → 走共用快照+写回。逐块流式进度（用户实时看到已完成的累计译文）。
  if (transform && String(inputText || '').length > 8000) {
    const sourceText = String(inputText || '')
    const chunks = splitTransformChunks(sourceText, 3000)
    const systemContent = messages[0]?.content || ''
    const thinkOff = shouldDisableThinking(model?.providerId, model?.apiUrl, thinkingEnabled)
      ? { thinking: { type: 'disabled' } }
      : {}
    const outputs = []
    let chunkReasoningAcc = ''
    const total = chunks.length
    onProgress?.({ at: Date.now(), label: `超长变换：分 ${total} 块逐块直出`, detail: `${sourceText.length} 字` }, [])
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw Object.assign(new Error('已停止'), { name: 'AbortError' })
      const chunk = chunks[i]
      const { instruction: chunkInstruction } = buildAssistantAgentInstruction({
        label,
        userPromptTemplate,
        inputText: chunk.text,
        inputSource,
        hasSelection,
        inputLength: chunk.text.length,
        effectiveDocumentAction,
        host: 'wps',
        lane: 'direct',
        variables
      })
      const chunkMessages = [
        ...(systemContent ? [{ role: 'system', content: systemContent + `\n【分块任务】全文共 ${total} 块，当前是第 ${i + 1}/${total} 块。只变换本块内容；本块与相邻块在原文中无缝衔接——不得添加任何衔接说明、问候或重复。` }] : []),
        { role: 'user', content: chunkInstruction }
      ]
      stepless: {
        outputs.push(await new Promise((resolve, reject) => {
          let acc = ''
          streamChatCompletion({
            providerId: model?.providerId,
            modelId: model?.modelId,
            messages: chunkMessages,
            ...thinkOff,
            signal,
            onEvent: (obj) => {
              const delta = obj?.choices?.[0]?.delta
              if (!delta) return
              // 思考流透传（分块路径此前漏接——🧠 开启时思考卡在长文变换中空白）
              if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
                chunkReasoningAcc += delta.reasoning_content
                events.onTurnReasoning?.(delta.reasoning_content, chunkReasoningAcc)
              }
              if (typeof delta.content === 'string' && delta.content) {
                acc += delta.content
                // 进度 = 已完成块的累计 + 当前块实时输出
                events.onTurnText?.(outputs.map(o => o.text).join('') + chunks.slice(0, i).map(c => c.sep).join('') + (chunks[i]?.sep === '' ? '' : '') + acc)
              }
            },
            onDone: () => resolve(acc.trim()),
            onError: (m2) => reject(new Error(m2 || '流式请求失败'))
          })
        }))
        break stepless
      }
    }
    // 无损重组（sep 语义见 splitTransformChunks：''=同段延续，'\n'=段界）
    const content = outputs.map((o, i) => (o || '') + (chunks[i]?.sep || '')).join('').trim()
    onTurnText?.(content)
    // 落到共用「快照+写回」段（与单块路径同一出口）
    return await finishDirectLane({ content, transform, inputText, effectiveDocumentAction, hasSelection, selectionRange, expectDocId, title: label || assistantId, model, assistantId, signal, inputSource, events, degraded, startedAtMs: Date.now(), label2: label })
  }

  // 流式生成：思考增量（reasoning_content）与正文增量实时回调——思考在
  // 执行过程步骤列表实时可见（与 agent 轨「模型思考中」步骤同款视觉）
  let content = ''
  try {
    content = await new Promise((resolve, reject) => {
      let acc = ''
      let reasoningAcc = ''
      streamChatCompletion({
        providerId: model?.providerId,
        modelId: model?.modelId,
        messages,
        // 快速轨禁思考（性能实测 3.3 倍提速，输出质量不损失）：仅智谱系注入
        ...(shouldDisableThinking(model?.providerId, model?.apiUrl, thinkingEnabled) ? { thinking: { type: 'disabled' } } : {}),
        signal,
        onEvent: (obj) => {
          const delta = obj?.choices?.[0]?.delta
          if (!delta) return
          if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
            reasoningAcc += delta.reasoning_content
            events.onTurnReasoning?.(delta.reasoning_content, reasoningAcc)
          }
          if (typeof delta.content === 'string' && delta.content) {
            acc += delta.content
            events.onTurnText?.(acc)
          }
        },
        onDone: () => resolve(acc),
        onError: (m) => reject(new Error(m || '流式请求失败'))
      })
    })
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    persistAgentTurnSignal({ assistantId, lane: 'direct', success: false, failureCode: 'direct_model_error', documentAction: effectiveDocumentAction, inputText, degraded })
    return { ok: false, handled: true, lane: 'direct', error: e, content: String(e?.message || e) }
  }
  content = String(content || '').trim()
  if (!content) {
    persistAgentTurnSignal({ assistantId, lane: 'direct', success: false, failureCode: 'empty_output', documentAction: effectiveDocumentAction, inputText, degraded })
    return { ok: false, handled: true, lane: 'direct', error: new Error('模型未返回可用内容'), content: '' }
  }
  // 输出纯度提取（真机 2026-11-21「替换的内容不正确」）：【OUTPUT】标记间的正文，
  // 剥离模型复读的原文/前导解释；未守约的模型原样返回
  content = extractOutputBody(content)
  if (!content) {
    persistAgentTurnSignal({ assistantId, lane: 'direct', success: false, failureCode: 'empty_output', documentAction: effectiveDocumentAction, inputText, degraded })
    return { ok: false, handled: true, lane: 'direct', error: new Error('模型未返回可用内容'), content: '' }
  }
  onTurnText?.(content)

  // 快照+写回公共出口（单块与分块两条路同汇于此）
  return await finishDirectLane({
    content,
    transform,
    inputText,
    effectiveDocumentAction,
    hasSelection,
    selectionRange,
    expectDocId,
    title: label || assistantId,
    label: label || '助手',
    assistantId,
    signal,
    events,
    degraded,
    inputSource
  })
}

/**
 * 直出公共出口：空内容守卫 → 写前快照 → 按声明动作写回 → 信号落账。
 * 单块与分块两条路同汇于此（content 由调用方产出）。
 */
async function finishDirectLane(ctx) {
  // ⚠️ 写回前的文件级备份已移除（同 agent 轨——doc.Save 在回合钩子时机触发
  // ksojscore SIGBUS，见 orchestrator captureDocSnapshot 注释）。撤销挂账重设计。
  let wroteBack = false
  let writeBackError = null
  const write = buildDirectWriteToolArgs({
    effectiveDocumentAction: ctx.effectiveDocumentAction,
    inputText: ctx.inputText,
    hasSelection: ctx.hasSelection,
    outputText: ctx.content,
    title: ctx.title,
    expectDocId: ctx.expectDocId,
    selectionRange: ctx.selectionRange
  })
  // 撤销快照（写前采集，只读安全；带 pin 时读绑定文档，否则活动文档）。
  // >80K 文档 get_text 受限失败 → 无快照 → 撤销卡不可用（如实降级）。
  let snapshot = null
  try {
    const snapRes = await callLocalTool('document.get_text', ctx.expectDocId ? { __expectedDocId: ctx.expectDocId } : {}, { signal: ctx.signal, timeoutMs: 60000 })
    const preText = String(snapRes?.structuredContent?.text || '')
    if (preText) snapshot = { docId: ctx.expectDocId || '', text: preText }
  } catch (_) { snapshot = null }
  if (write) {
    try {
      assertToolResultOk(await callLocalTool(write.toolName, write.args, { signal: ctx.signal, timeoutMs: DIRECT_WRITE_TIMEOUT_MS }))
      wroteBack = true
    } catch (e) {
      writeBackError = e
    }
  }

  persistAgentTurnSignal({
    assistantId: ctx.assistantId,
    lane: 'direct',
    success: true,
    documentAction: ctx.effectiveDocumentAction,
    inputText: ctx.inputText,
    outputText: ctx.content,
    elapsedMs: 0,
    degraded: ctx.degraded,
    wroteBack
  })

  return {
    ok: true,
    handled: true,
    lane: 'direct',
    content: ctx.content,
    executedTools: wroteBack ? [write.toolName] : [],
    wroteBack,
    writeBackError,
    snapshot,
    backupId: ''
  }
}
