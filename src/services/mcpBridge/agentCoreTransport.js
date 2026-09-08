/**
 * AgentTransport 适配层：把 chayuan-office agent-core 的 AgentTransport 接口
 * 落到本项目的 chatApi.js（OpenAI 兼容 /chat/completions，非流式）。
 *
 * agent-core 约定：应用自带传输实现，循环只认 stream(request, callbacks) → handle。
 * 这里每次 stream 即一轮模型请求；本地 AbortController 挂到外层 signal 上，
 * handle.cancel()（用户停止/循环重置）可即时掐断在途请求。
 */
import { chatCompletionMessage } from '../../utils/chatApi.js'

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
        chatCompletionMessage(body)
          .then(msg => {
            if (settled) return
            settled = true
            cleanup()
            const content = String(msg?.content || '')
            if (content) cb.onDelta(content)
            const calls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : []
            calls.forEach((c, i) => cb.onToolCall(wireToolCallToAgent(c, i)))
            cb.onDone()
          })
          .catch(fail)
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
