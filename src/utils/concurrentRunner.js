/**
 * concurrentRunner - 并发池(worker pool)
 *
 * 替代 assistantTaskRunner 内严格串行的 `for-await chunk → chatCompletion`,
 * 用 N 个 worker 并发消费 chunk 队列,**保持原序号写回**(不按完成顺序)。
 *
 * 典型场景:
 *   const results = await runConcurrently(chunks, async (chunk, i) => {
 *     return await chatCompletion({ ..., signal: ctrl.signal })
 *   }, { concurrency: 4, onProgress: (done, total) => updateTask(done) })
 *
 * 设计细节:
 *   - 每段独立 try/catch,单段失败不影响其他段
 *   - 失败段 result = { error, index, ... }
 *   - 取消传播:外部 AbortController,所有 worker 共享 signal
 *   - 进度回调(done, total, lastIndex, lastResult)
 */

function safeNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

class CancelError extends Error {
  constructor(reason = '任务已取消') {
    super(reason)
    this.name = 'AbortError'
    this.code = 'TASK_CANCELLED'
  }
}

/**
 * 主入口。
 *
 *   items:       任意数组
 *   worker:      async (item, index, ctx) => result
 *                ctx 包含 { signal, isCancelled, cancel }
 *   options:
 *     concurrency:   默认 4(本地模型建议 1,云端 4-8)
 *     signal:        外部 AbortSignal
 *     onProgress:    (done, total, lastIndex, lastResult) => void
 *     onError:       (err, index) => void(单段失败 hook)
 *     stopOnError:   true 则任一段失败即取消其他段;默认 false
 *     retryFailed:   单段失败重试次数(默认 0)
 *     retryDelayMs:  重试间隔(默认 500)
 *
 *   返回:与 items 等长的 results 数组,失败位为 { error: Error, index, item }
 */
export async function runConcurrently(items, worker, options = {}) {
  if (!Array.isArray(items) || typeof worker !== 'function') return []
  const total = items.length
  if (total === 0) return []

  const concurrency = Math.min(
    safeNumber(options.concurrency, 4),
    total
  )
  const stopOnError = options.stopOnError === true
  const retryFailed = Math.max(0, safeNumber(options.retryFailed, 0))
  const retryDelayMs = safeNumber(options.retryDelayMs, 500)

  const results = new Array(total)
  let cursor = 0
  let completed = 0
  const ctrl = new AbortController()

  // 把外部 signal 绑过来
  if (options.signal) {
    if (options.signal.aborted) {
      ctrl.abort()
    } else {
      options.signal.addEventListener('abort', () => ctrl.abort(), { once: true })
    }
  }

  function isCancelled() {
    return ctrl.signal.aborted
  }

  async function tryRun(item, i) {
    let lastErr = null
    for (let attempt = 0; attempt <= retryFailed; attempt++) {
      if (isCancelled()) {
        lastErr = new CancelError()
        break
      }
      try {
        const ctx = {
          signal: ctrl.signal,
          isCancelled,
          cancel: () => ctrl.abort()
        }
        const out = await worker(item, i, ctx)
        return { ok: true, value: out }
      } catch (e) {
        lastErr = e
        if (e?.name === 'AbortError' || e?.code === 'TASK_CANCELLED') break
        if (attempt < retryFailed) {
          await new Promise(r => setTimeout(r, retryDelayMs))
        }
      }
    }
    return { ok: false, error: lastErr || new Error('unknown error') }
  }

  async function workerLoop(workerId) {
    while (true) {
      if (isCancelled()) return
      const i = cursor++
      if (i >= total) return
      const result = await tryRun(items[i], i)
      if (result.ok) {
        results[i] = result.value
      } else {
        results[i] = { error: result.error, index: i, item: items[i] }
        if (typeof options.onError === 'function') {
          try { options.onError(result.error, i) } catch (_) {}
        }
        if (stopOnError) {
          ctrl.abort()
        }
      }
      completed++
      if (typeof options.onProgress === 'function') {
        try {
          options.onProgress(completed, total, i, results[i])
        } catch (_) {}
      }
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, (_, k) => workerLoop(k))
  )

  return results
}

/**
 * 带 chunk 顺序保证 + 即写回的版本。
 *
 *   onChunkDone(index, value) — 单段完成立刻回调,可用于流式写回(每完成一段就插一段批注)。
 *   不保证回调顺序与 index 一致(有可能后段先完成),由 onChunkDone 内部决定排序策略。
 *
 *   想要"严格按段顺序写回"时,在 onProgress 内只写"已连续完成"前缀:
 *     let writeCursor = 0
 *     onProgress: (done, total, lastIndex, lastResult) => {
 *       while (results[writeCursor] !== undefined) {
 *         applyToParagraph(writeCursor, results[writeCursor])
 *         writeCursor++
 *       }
 *     }
 */
export async function runConcurrentlyStreaming(items, worker, options = {}) {
  return runConcurrently(items, worker, options)
}

/**
 * 构造一个 chunk-aware 的 LLM worker(便利函数)。
 *
 *   const worker = makeChatChunkWorker({
 *     buildMessages: chunk => [...],
 *     callChat: async (messages, signal) => chatCompletion({ messages, signal })
 *   })
 *   const outs = await runConcurrently(chunks, worker, { concurrency: 4 })
 */
export function makeChatChunkWorker({ buildMessages, callChat }) {
  return async (chunk, index, ctx) => {
    const messages = buildMessages(chunk, index)
    return await callChat(messages, ctx.signal, chunk, index)
  }
}

export default {
  runConcurrently,
  runConcurrentlyStreaming,
  makeChatChunkWorker,
  CancelError
}
