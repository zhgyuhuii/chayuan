/**
 * enhancedChatApi — chatApi.js 的"增强 drop-in"
 *
 * 把 P1 的零碎工具(`chatApiEnhancers` + `concurrentRunner`)拼成一组高一层的入口,
 * 让调用方不用关心:
 *   - 该不该加 prompt cache(由 providerId 自动决定)
 *   - 该不该用 JSON schema(由 kind/schema 自动开)
 *   - router 调用要不要降温(自动 0)
 *   - judge 调用要不要中等温度(自动 0.1)
 *   - chunk 并行(默认 4 路 worker)
 *
 * 不动 `chatApi.js` 主文件 —— 这层是 opt-in,业务方主动 import 才生效。
 *
 * 用法:
 *
 *   // 普通对话流式:
 *   import { enhancedStream } from '@/utils/router/enhancedChatApi.js'
 *   await enhancedStream({
 *     providerId, modelId,
 *     systemPrompt, userText,
 *     onChunk, onDone
 *   })
 *
 *   // router 一次性、低温度:
 *   const verdict = await enhancedOnce({
 *     providerId, modelId,
 *     kind: 'router',
 *     systemPrompt, userText
 *   })
 *
 *   // judge 一次性、中等温度、强制 JSON:
 *   const score = await enhancedOnce({
 *     kind: 'judge', schema: judgeSchema,
 *     providerId, modelId, systemPrompt, userText
 *   })
 *
 *   // 长文档 chunked 并发(每片调用 chatCompletion):
 *   const partials = await enhancedChunked({
 *     providerId, modelId, kind: 'chat',
 *     chunks: paragraphArray,
 *     buildSystem: () => '你是摘要器',
 *     buildUser:   (chunk) => `请简化:\n${chunk}`,
 *     concurrency: 4
 *   })
 */

import { streamChatCompletion, chatCompletion } from '../chatApi.js'
import {
  withPromptCache,
  withJsonSchema,
  withJsonObject,
  asRouterCall,
  asJudgeCall
} from '../chatApiEnhancers.js'
import { runConcurrently, runConcurrentlyStreaming } from '../concurrentRunner.js'
import { startTimer } from '../perfTracker.js'

/* ────────────────────────────────────────────────────────────
 * 内部:把 (kind, cache, schema) 映射为 (messages, extraBody)
 * ──────────────────────────────────────────────────────────── */

function buildMessages(systemPrompt, userText, options = {}) {
  const messages = []
  const sys = String(systemPrompt || '').trim()
  if (sys) messages.push({ role: 'system', content: sys })
  if (Array.isArray(options.history)) {
    for (const m of options.history) {
      if (m?.role && m?.content != null) messages.push(m)
    }
  }
  const usr = String(userText || '').trim()
  if (usr) messages.push({ role: 'user', content: usr })

  if (options.cache !== false) {
    return withPromptCache(messages, { providerId: options.providerId })
  }
  return messages
}

function buildExtraBody(options = {}) {
  let extra = {}
  if (options.kind === 'router') {
    extra = asRouterCall(extra)
  } else if (options.kind === 'judge') {
    extra = asJudgeCall(extra, { strict: options.strict })
  }

  if (options.schema && typeof options.schema === 'object') {
    extra = withJsonSchema(extra, {
      schema: options.schema,
      name:   options.schemaName || 'Output',
      strict: options.strict !== false
    })
  } else if (options.jsonObject) {
    extra = withJsonObject(extra)
  }

  if (options.temperature != null) extra.temperature = options.temperature
  if (options.maxTokens != null)   extra.max_tokens = options.maxTokens
  if (options.topP != null)        extra.top_p = options.topP

  return extra
}

/* ────────────────────────────────────────────────────────────
 * 1. 流式:enhancedStream
 * ──────────────────────────────────────────────────────────── */

/**
 * 流式调用,自动应用 prompt cache。
 * options:
 *   providerId, modelId        必填
 *   systemPrompt, userText     文本来源(2 选 1 或都给)
 *   history                    [{role,content}] 之前的会话
 *   cache                      默认 true(OpenAI 自动命中,Anthropic 显式打 tag)
 *   schema / jsonObject        可选 — 强制 JSON 输出
 *   temperature/maxTokens/topP 覆盖项
 *   signal                     AbortSignal
 *   onChunk(delta) / onDone(full) / onError(err)
 *
 * 返回:Promise<full text>
 */
export function enhancedStream(options = {}) {
  const messages = buildMessages(options.systemPrompt, options.userText, options)
  const extra = buildExtraBody(options)

  let buffered = ''
  const stopTimer = startTimer({
    kind: 'stream' + (options.kind ? '.' + options.kind : ''),
    providerId: options.providerId,
    modelId: options.modelId
  })
  return new Promise((resolve, reject) => {
    streamChatCompletion({
      providerId: options.providerId,
      modelId:    options.modelId,
      ribbonModelId: options.ribbonModelId,
      messages,
      ...extra,
      signal: options.signal,
      onChunk: (chunk) => {
        buffered += String(chunk || '')
        try { options.onChunk?.(chunk, buffered) } catch (_) {}
      },
      onDone: () => {
        stopTimer({ ok: true, bytes: buffered.length })
        try { options.onDone?.(buffered) } catch (_) {}
        resolve(buffered)
      },
      onError: (err) => {
        stopTimer({ ok: false, note: String(err?.message || err).slice(0, 80) })
        try { options.onError?.(err) } catch (_) {}
        reject(err instanceof Error ? err : new Error(String(err || '流式失败')))
      }
    })
  })
}

/* ────────────────────────────────────────────────────────────
 * 2. 非流式 once:enhancedOnce
 * ──────────────────────────────────────────────────────────── */

export async function enhancedOnce(options = {}) {
  const messages = buildMessages(options.systemPrompt, options.userText, options)
  const extra = buildExtraBody(options)
  const stopTimer = startTimer({
    kind: 'once' + (options.kind ? '.' + options.kind : ''),
    providerId: options.providerId,
    modelId: options.modelId
  })
  try {
    const out = await chatCompletion({
      providerId: options.providerId,
      modelId:    options.modelId,
      ribbonModelId: options.ribbonModelId,
      messages,
      signal: options.signal,
      ...extra
    })
    stopTimer({ ok: true, bytes: String(out || '').length })
    return out
  } catch (e) {
    stopTimer({ ok: false, note: String(e?.message || e).slice(0, 80) })
    throw e
  }
}

/* ────────────────────────────────────────────────────────────
 * 3. 长文 chunked 并发:enhancedChunked
 * ──────────────────────────────────────────────────────────── */

/**
 * 把一组 chunks 用同一个 system prompt 并发跑 chat completion。
 * 特性:
 *   - 自动并发(默认 4)
 *   - 每条独立失败不影响其他,失败位返回 ''
 *   - 自动 prompt cache(systemPrompt 是稳定的,Anthropic 命中率高)
 *
 * options:
 *   providerId, modelId, ribbonModelId  必填(model)
 *   chunks                              string[]
 *   buildSystem(): string
 *   buildUser(chunk, index): string
 *   kind / schema / temperature / maxTokens / cache  传给 buildExtraBody
 *   concurrency                         默认 4
 *   onProgress(done, total)
 *   signal                              AbortSignal
 *
 * 返回:string[](与 chunks 同长度)
 */
export async function enhancedChunked(options = {}) {
  const chunks = Array.isArray(options.chunks) ? options.chunks : []
  if (chunks.length === 0) return []
  const buildSystem = typeof options.buildSystem === 'function' ? options.buildSystem : () => ''
  const buildUser   = typeof options.buildUser   === 'function' ? options.buildUser   : (c) => String(c || '')
  const concurrency = Math.max(1, Math.min(options.concurrency || 4, 16))

  // systemPrompt 是稳定的 → 通过 cache 复用
  const systemPrompt = String(buildSystem() || '')

  const worker = async (chunk, index) => {
    if (options.signal?.aborted) return ''
    try {
      return await enhancedOnce({
        providerId:    options.providerId,
        modelId:       options.modelId,
        ribbonModelId: options.ribbonModelId,
        systemPrompt,
        userText:      buildUser(chunk, index),
        cache:         options.cache !== false,
        kind:          options.kind,
        schema:        options.schema,
        schemaName:    options.schemaName,
        temperature:   options.temperature,
        maxTokens:     options.maxTokens,
        signal:        options.signal
      })
    } catch (_) {
      return ''
    }
  }

  const runner = typeof options.onChunkResult === 'function'
    ? runConcurrentlyStreaming
    : runConcurrently

  return runner(chunks, worker, {
    concurrency,
    signal: options.signal,
    // concurrentRunner 的回调签名:(completed, total, index, value)
    onProgress: (completed, total, index, value) => {
      try { options.onProgress?.(completed, total) } catch (_) {}
      if (typeof options.onChunkResult === 'function' && index != null) {
        try { options.onChunkResult(index, value) } catch (_) {}
      }
    }
  })
}

/* ────────────────────────────────────────────────────────────
 * 4. router / judge 便捷别名
 * ──────────────────────────────────────────────────────────── */

/** Router 模式快速调用:温度 0,短输出。 */
export function routerCall(options = {}) {
  return enhancedOnce({ ...options, kind: 'router' })
}

/** Judge 模式快速调用:温度 0.1,带 schema。 */
export function judgeCall(options = {}) {
  return enhancedOnce({ ...options, kind: 'judge' })
}

export default {
  enhancedStream,
  enhancedOnce,
  enhancedChunked,
  routerCall,
  judgeCall
}
