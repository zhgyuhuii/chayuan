/**
 * AgentTransport 适配层：把 chayuan-office agent-core 的 AgentTransport 接口
 * 落到本项目的 chatApi.js（OpenAI 兼容 /chat/completions）。
 *
 * 2026-09-17 起改为流式为主：每轮模型请求走 streamChatCompletion，文本增量经
 * onDelta 即时透出（循环层 → 编排器 onTurnText → 对话框流式渲染，消除每轮
 * 3-10s 的死寂感），tool_calls 按 OpenAI 流式分片（delta.tool_calls[index]）
 * 聚合完整后再回灌。总耗时与非流式相同——收益在首字延迟与过程可见性。
 * 回落通道：流式出错且尚未产生任何输出（典型：网关不支持 stream+tools、SSE
 * 损坏）时，用非流式 chatCompletionMessage 重试同一请求体一次；非流式也空
 * 返回时报 "(empty stream)"，命中循环层的空流退避重试契约。
 *
 * agent-core 约定：应用自带传输实现，循环只认 stream(request, callbacks) → handle。
 * 这里每次 stream 即一轮模型请求；本地 AbortController 挂到外层 signal 上，
 * handle.cancel()（用户停止/循环重置）可即时掐断在途请求。
 */
import { chatCompletionMessage, streamChatCompletion } from '../../utils/chatApi.js'

/** agent-core AgentMessage[] → OpenAI wire messages（system 单独放最前） */
export function agentMessagesToWire(messages) {
  const out = []
  for (const m of messages || []) {
    if (m?.role === 'user') {
      // 视觉输入（上游 AgentImage 收割对接，2026-11-25）：带图片的 user 消息转
      // OpenAI 多模态 content parts（data URL）。支持 vision 的网关按 parts 解析；
      // 不支持的会报错——编排器在 model_error 返回体提示用户去掉图片或换模型
      const images = Array.isArray(m.images) ? m.images.filter(i => i && i.base64) : []
      if (!images.length) {
        out.push({ role: 'user', content: m.text || '' })
      } else {
        out.push({
          role: 'user',
          content: [
            { type: 'text', text: m.text || '' },
            ...images.map(i => ({
              type: 'image_url',
              image_url: { url: `data:${String(i.mime || 'image/png')};base64,${i.base64}` }
            }))
          ]
        })
      }
    } else if (m?.role === 'assistant') {
      out.push({
        role: 'assistant',
        // 与旧编排器一致：无文本时发 null（部分网关拒绝空字符串 assistant 内容）
        content: m.text || null,
        ...(Array.isArray(m.toolCalls) && m.toolCalls.length
          ? {
              tool_calls: m.toolCalls.map(c => ({
                id: String(c.id),
                type: 'function',
                function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) }
              }))
            }
          : {})
      })
    } else if (m?.role === 'tool') {
      for (const r of m.results || []) {
        out.push({ role: 'tool', tool_call_id: String(r.id), content: r.output || '' })
      }
    }
  }
  return out
}

/** OpenAI tool_call → agent-core AgentToolCall（入参 JSON 非法时走 inputError 重试通道） */
export function wireToolCallToAgent(call, index) {
  const name = call?.function?.name || call?.name || ''
  const raw = call?.function?.arguments ?? call?.arguments
  let input = {}
  let inputError
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) input = parsed
      else inputError = '工具入参不是 JSON 对象'
    } catch (e) {
      inputError = String(e?.message || e)
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    input = raw
  }
  return {
    id: String(call?.id || `call_${index}`),
    name: String(name),
    input,
    ...(inputError ? { inputError } : {})
  }
}

/**
 * tool_calls 流式分片聚合器。OpenAI 兼容流把一次调用拆成若干
 * delta.tool_calls 分片（按 index 归位），id/name 在首个分片整体给出，
 * arguments 逐段追加；聚合完按 index 顺序还原成非流式 tool_call。
 */
function createToolCallAggregator() {
  const byIndex = new Map()
  return {
    push(fragment) {
      if (!fragment || typeof fragment !== 'object') return
      const idx = Number.isFinite(fragment.index) ? fragment.index : 0
      let agg = byIndex.get(idx)
      if (!agg) {
        agg = { id: '', name: '', args: '' }
        byIndex.set(idx, agg)
      }
      if (fragment.id) agg.id = String(fragment.id)
      const fn = fragment.function || {}
      if (typeof fn.name === 'string' && fn.name && agg.name !== fn.name) agg.name += fn.name
      if (typeof fn.arguments === 'string') agg.args += fn.arguments
    },
    count() {
      return byIndex.size
    },
    calls() {
      return [...byIndex.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([i, agg]) => ({
          id: agg.id || `call_${i}`,
          type: 'function',
          function: { name: agg.name, arguments: agg.args || '{}' }
        }))
    }
  }
}

function toOpenAiTools(tools) {
  return (tools || []).map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: String(t.description || '').slice(0, 1200),
      parameters: t.inputSchema || { type: 'object', properties: {} }
    }
  }))
}

/**
 * OpenAI usage → agent-core AgentTokenUsage（2026-11-25 审计：此前 transport 从不发
 * onUsage，引擎的用量统计恒缺席）。流式终块与非流式响应的 usage 字段名通用；
 * cacheWriteTokens 上游无对应字段，按 types.ts 缺席语义不造零。
 */
function mapOpenAiUsage(u) {
  if (!u || typeof u !== 'object') return null
  const out = {}
  const input = Number(u.prompt_tokens)
  if (Number.isFinite(input)) out.inputTokens = input
  const output = Number(u.completion_tokens)
  if (Number.isFinite(output)) out.outputTokens = output
  const cached = Number(u.prompt_tokens_details?.cached_tokens)
  if (Number.isFinite(cached)) out.cacheReadTokens = cached
  return (out.inputTokens !== undefined || out.outputTokens !== undefined) ? out : null
}

/**
 * @param {object} opts
 * @param {object} opts.model - { providerId, modelId, id(ribbon 兼容), name }
 * @param {AbortSignal} [opts.signal] - 外层取消信号（对话框的 AbortController）
 * @param {(turnNo: number) => void} [opts.onTurnStart] - 每轮模型请求前回调（进度步骤）
 * @returns {import('../../agent-core/index').AgentTransport}
 */
export function createAgentCoreTransport({ model, signal, onTurnStart, onTurnReasoning, thinkingDisabled = false } = {}) {
  let turnNo = 0
  return {
    stream(request, cb) {

      let settled = false
      const hasLocalCtrl = typeof AbortController !== 'undefined'
      const localCtrl = hasLocalCtrl ? new AbortController() : null
      const abortFromParent = () => localCtrl?.abort(signal?.reason || 'parent-abort')
      if (signal && localCtrl) {
        if (signal.aborted) abortFromParent()
        else signal.addEventListener('abort', abortFromParent, { once: true })
      }
      const cleanup = () => {
        if (signal && localCtrl) signal.removeEventListener('abort', abortFromParent)
      }
      const fail = (err) => {
        if (settled) return
        settled = true
        cleanup()
        cb.onError(err?.message || String(err))
      }
      try {
        turnNo += 1
        onTurnStart?.(turnNo)
        const body = {
          // 思考模式开关（用户可控）：关闭时智谱 GLM 系禁思考（实测扩写 16.7s→5.1s，
          // 输出质量不损失）；非智谱厂商不注入（未知字段严格解析风险）
          ...(thinkingDisabled ? { thinking: { type: 'disabled' } } : {}),
          providerId: model?.providerId,
          modelId: model?.modelId,
          ribbonModelId: model?.id,
          messages: [
            { role: 'system', content: request.system },
            ...agentMessagesToWire(request.messages)
          ],
          signal: localCtrl?.signal
        }
        if (Array.isArray(request.tools) && request.tools.length) {
          body.tools = toOpenAiTools(request.tools)
          body.tool_choice = 'auto'
        }

        const toolAgg = createToolCallAggregator()
        let streamedText = ''
        // 供应商用量：流式在终块 usage（部分网关带 stream_options include_usage 才发，
        // 被动读取不注入请求字段——未知字段严格解析的网关会报错）
        let usageFromStream = null

        const emitToolCallsAndDone = () => {
          toolAgg.calls().forEach((c, i) => cb.onToolCall(wireToolCallToAgent(c, i)))
          cb.onDone()
        }

        // 回落通道：流式失败且零输出 → 非流式整取同一请求体一次。
        // 已流出任何内容/工具分片时不再重试（重放会与 UI 已见增量重复）。
        const fallbackNonStreaming = (reason) => {
          if (settled) return
          if (toolAgg.count()) {
            // 工具参数分片未聚完连接即断：完整 tool call 从未投递、历史未被
            // 触碰，带上契约标记让循环层安全重放一轮（已透出的文本会被重渲）。
            fail(new Error(`流在工具参数传输中途中断 (while sending tool arguments); the connection was dropped`))
            return
          }
          if (streamedText) {
            fail(new Error(reason))
            return
          }
          chatCompletionMessage(body)
            .then(msg => {
              if (settled) return
              settled = true
              cleanup()
              const content = String(msg?.content || '')
              const calls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : []
              if (!content && !calls.length) {
                // 命中循环层空流退避契约：同请求幂等重发（1s/3s 退避）
                cb.onError('模型返回为空 (empty stream)')
                return
              }
              const usage = mapOpenAiUsage(msg?.raw?.usage || msg?.usage)
              if (usage) cb.onUsage?.(usage)
              if (content) cb.onDelta(content)
              calls.forEach((c, i) => cb.onToolCall(wireToolCallToAgent(c, i)))
              cb.onDone()
            })
            .catch(fail)
        }

        streamChatCompletion({
          ...body,
          onEvent: (obj) => {
            if (obj?.usage) usageFromStream = obj.usage
            const delta = obj?.choices?.[0]?.delta
            if (!delta) return
            if (typeof delta.content === 'string' && delta.content) {
              streamedText += delta.content
              cb.onDelta(delta.content)
            }
            if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
              // 思考流旁路（思考展示）：loop 层消费 onReasoning 做预算守卫但不透出
              // 事件，transport 在此旁路给编排器写进「模型思考」步骤（项目侧文件，
              // 不动 agent-core vendor）
              onTurnReasoning?.(delta.reasoning_content)
              if (typeof cb.onReasoning === 'function') cb.onReasoning(delta.reasoning_content)
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const frag of delta.tool_calls) toolAgg.push(frag)
            }
          },
          onDone: () => {
            if (settled) return
            // 空流（无文本无工具分片）交给回落通道：先非流式再试，仍空则报 empty stream
            if (!streamedText && !toolAgg.count()) {
              fallbackNonStreaming('流式响应为空')
              return
            }
            settled = true
            cleanup()
            const usage = mapOpenAiUsage(usageFromStream)
            if (usage) cb.onUsage?.(usage)
            emitToolCallsAndDone()
          },
          onError: (err) => fallbackNonStreaming(err || '流式请求失败')
        })
      } catch (e) {
        fail(e)
      }
      return {
        cancel() {
          // 掐断在途请求；chatApi 会以 AbortError reject，走 fail → cb.onError，
          // 循环侧由 cancel 标志收尾（AgentStreamHandle 约定 cancel 后仍要有终态回调）。
          localCtrl?.abort('cancelled')
        }
      }
    }
  }
}
