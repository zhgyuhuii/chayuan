/**
 * chatApiAbortAware — chatApi 的"abort 干净版"
 *
 * 解决 P6 问题:streamChatCompletion abort 后 partial state(已收到的 chunk
 * 仍触发 onChunk,onError 可能延迟)未清理。
 *
 * 改进:
 *   1. abort 后 onChunk / onDone / onError 全部停止触发
 *   2. abort 调用方拿到 partial buffered text 而非空字符串
 *   3. abort reason 透传(不只是空 AbortError)
 *
 * Feature flag:experimentalAbortV2(默认 false)。
 *
 * 用法:
 *   import { streamChatCompletionAbortAware } from '...'
 *
 *   const ctrl = new AbortController()
 *   const promise = streamChatCompletionAbortAware({ ..., signal: ctrl.signal })
 *   ctrl.abort('user-cancel')
 *   const { text, aborted, reason } = await promise
 */

import { streamChatCompletion } from './chatApi.js'

/**
 * 包装 streamChatCompletion,提供 cleaner abort 语义。
 * 返回 Promise<{ text, aborted, reason, error }>
 *
 * - 正常完成:{ text: <full>, aborted: false }
 * - abort:{ text: <partial buffer>, aborted: true, reason: <reason> }
 * - 错误:{ text: <partial>, aborted: false, error: <err> }
 */
export function streamChatCompletionAbortAware(options = {}) {
  const externalSignal = options.signal
  const internal = new AbortController()
  // 把外部 abort 同步到内部
  if (externalSignal) {
    if (externalSignal.aborted) internal.abort(externalSignal.reason || 'pre-aborted')
    externalSignal.addEventListener('abort', () => {
      internal.abort(externalSignal.reason || 'aborted')
    }, { once: true })
  }

  let buffered = ''
  let resolved = false
  let resolveOuter

  const promise = new Promise((resolve) => { resolveOuter = resolve })

  const guardedResolve = (payload) => {
    if (resolved) return
    resolved = true
    resolveOuter(payload)
  }

  // 单独监听 abort,提前 resolve
  internal.signal.addEventListener('abort', () => {
    guardedResolve({
      text: buffered,
      aborted: true,
      reason: internal.signal.reason || 'aborted',
      error: null
    })
  }, { once: true })

  try {
    streamChatCompletion({
      providerId: options.providerId,
      modelId: options.modelId,
      ribbonModelId: options.ribbonModelId,
      messages: options.messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      response_format: options.response_format,
      signal: internal.signal,
      onChunk: (chunk) => {
        if (resolved) return  // 已 abort,不再接受
        buffered += String(chunk || '')
        try { options.onChunk?.(chunk, buffered) } catch (_) {}
      },
      onDone: () => {
        if (resolved) return
        try { options.onDone?.(buffered) } catch (_) {}
        guardedResolve({ text: buffered, aborted: false, reason: '', error: null })
      },
      onError: (err) => {
        if (resolved) return
        try { options.onError?.(err) } catch (_) {}
        guardedResolve({
          text: buffered,
          aborted: false,
          reason: '',
          error: err instanceof Error ? err : new Error(String(err || '流式失败'))
        })
      }
    })
  } catch (e) {
    guardedResolve({ text: buffered, aborted: false, reason: '', error: e })
  }

  return promise
}

export default { streamChatCompletionAbortAware }
