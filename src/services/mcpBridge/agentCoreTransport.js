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
      out.push({ role: 'user', content: m.text || '' })
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
 * @param {object} opts
 * @param {object} opts.model - { providerId, modelId, id(ribbon 兼容), name }
 * @param {AbortSignal} [opts.signal] - 外层取消信号（对话框的 AbortController）
 * @param {(turnNo: number) => void} [opts.onTurnStart] - 每轮模型请求前回调（进度步骤）
 * @returns {import('../../agent-core/index').AgentTransport}
 */
export function createAgentCoreTransport({ model, signal, onTurnStart } = {}) {
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

        const emitToolCallsAndDone = () => {
          toolAgg.calls().forEach((c, i) => cb.onToolCall(wireToolCallToAgent(c, i)))
          cb.onDone()
        }

        // 回落通道：流式失败且零输出 → 非流式整取同一请求体一次。
        // 已流出任何内容/工具分片时不再重试（重放会与 UI 已见增量重复）。
        const fallbackNonStreaming = (reason) => {
          if (settled) return
          if (streamedText || toolAgg.count()) {
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
              if (content) cb.onDelta(content)
              calls.forEach((c, i) => cb.onToolCall(wireToolCallToAgent(c, i)))
              cb.onDone()
            })
            .catch(fail)
        }

        streamChatCompletion({
          ...body,
          onEvent: (obj) => {
            const delta = obj?.choices?.[0]?.delta
            if (!delta) return
            if (typeof delta.content === 'string' && delta.content) {
              streamedText += delta.content
              cb.onDelta(delta.content)
            }
            if (typeof delta.reasoning_content === 'string' && delta.reasoning_content && typeof cb.onReasoning === 'function') {
              cb.onReasoning(delta.reasoning_content)
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
