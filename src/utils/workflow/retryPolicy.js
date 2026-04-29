/**
 * retryPolicy — 工作流节点的重试策略 + 熔断器(W3.4)
 *
 * 用法:
 *   import { withRetry, makeBreaker } from './retryPolicy.js'
 *
 *   const breaker = makeBreaker({ failureThreshold: 5, resetMs: 30_000 })
 *   const result = await withRetry(
 *     () => doSomething(),
 *     { retries: 3, backoff: 'exp', baseMs: 500, breaker, signal }
 *   )
 *
 * 策略:
 *   - retries: 总重试次数(0 = 不重试)
 *   - backoff: 'fixed' | 'linear' | 'exp'
 *   - baseMs: 第一次 backoff 间隔
 *   - jitter: 0..1,避免多个调用同步 backoff
 *   - signal: AbortSignal,中途取消立即停
 *   - retryOn: (err) => boolean,默认重试所有非 AbortError 错误
 *   - breaker: 熔断器实例(open 时直接 fail)
 */

const DEFAULT = {
  retries: 2,
  backoff: 'exp',
  baseMs: 500,
  maxMs: 30000,
  jitter: 0.2
}

/**
 * 包装一个 async 函数,加重试逻辑。
 * 返回 { ok, value?, error?, attempts }
 */
export async function withRetry(fn, options = {}) {
  const cfg = { ...DEFAULT, ...options }
  const breaker = cfg.breaker
  const retryOn = typeof cfg.retryOn === 'function' ? cfg.retryOn : (e) => e?.name !== 'AbortError'

  let lastError = null
  for (let attempt = 0; attempt <= cfg.retries; attempt++) {
    if (cfg.signal?.aborted) {
      return { ok: false, error: new Error('aborted'), attempts: attempt }
    }
    if (breaker?.isOpen?.()) {
      return { ok: false, error: new Error('circuit breaker open'), attempts: attempt }
    }

    try {
      const value = await fn(attempt)
      breaker?.recordSuccess?.()
      return { ok: true, value, attempts: attempt + 1 }
    } catch (e) {
      lastError = e
      breaker?.recordFailure?.()
      if (!retryOn(e)) {
        return { ok: false, error: e, attempts: attempt + 1 }
      }
      if (attempt >= cfg.retries) break

      const delay = computeBackoff(cfg, attempt)
      await sleep(delay, cfg.signal)
    }
  }
  return { ok: false, error: lastError, attempts: cfg.retries + 1 }
}

function computeBackoff(cfg, attempt) {
  let base
  switch (cfg.backoff) {
    case 'fixed':  base = cfg.baseMs; break
    case 'linear': base = cfg.baseMs * (attempt + 1); break
    case 'exp':
    default:       base = cfg.baseMs * Math.pow(2, attempt); break
  }
  base = Math.min(base, cfg.maxMs)
  // jitter
  const j = cfg.jitter > 0 ? base * cfg.jitter * (Math.random() - 0.5) * 2 : 0
  return Math.max(0, base + j)
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'))
    const t = setTimeout(resolve, ms)
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(t)
        reject(new Error('aborted'))
      }, { once: true })
    }
  })
}

/* ────────── 熔断器 ────────── */

/**
 * 熔断器:N 次失败后打开,resetMs 后允许 half-open 探测,成功则关闭。
 */
export function makeBreaker(options = {}) {
  const failureThreshold = Number(options.failureThreshold) || 5
  const resetMs = Number(options.resetMs) || 30000
  const halfOpenAttempts = Number(options.halfOpenAttempts) || 1

  let failures = 0
  let openedAt = 0
  let halfOpenInflight = 0
  let state = 'closed'  // 'closed' | 'open' | 'half-open'

  function isOpen() {
    if (state === 'closed') return false
    if (state === 'open') {
      if (Date.now() - openedAt > resetMs) {
        state = 'half-open'
        halfOpenInflight = 0
        return false
      }
      return true
    }
    // half-open
    return halfOpenInflight >= halfOpenAttempts
  }

  function recordSuccess() {
    failures = 0
    if (state === 'half-open') {
      state = 'closed'
      halfOpenInflight = 0
    }
  }

  function recordFailure() {
    if (state === 'half-open') {
      state = 'open'
      openedAt = Date.now()
      return
    }
    failures += 1
    if (failures >= failureThreshold) {
      state = 'open'
      openedAt = Date.now()
    }
  }

  function reset() {
    state = 'closed'
    failures = 0
    openedAt = 0
    halfOpenInflight = 0
  }

  function getState() {
    return { state, failures, openedAt, threshold: failureThreshold }
  }

  return { isOpen, recordSuccess, recordFailure, reset, getState }
}

/* ────────── 节点级别封装 ────────── */

/**
 * 给一个节点的 execute 函数加上 retry + breaker。
 * 节点 config 里支持:retries / backoff / baseMs / circuitBreaker
 */
export function withNodeRetry(executeFn) {
  const breakers = new Map()  // nodeId → breaker

  return async function nodeWithRetry(node, ctx) {
    const cfg = node?.config || node?.payload || {}
    const retries = Math.max(0, Math.min(Number(cfg.retries) || 0, 5))
    if (retries === 0 && !cfg.circuitBreaker) {
      return executeFn(node, ctx)
    }

    let breaker = null
    if (cfg.circuitBreaker) {
      if (!breakers.has(node.id)) {
        breakers.set(node.id, makeBreaker({
          failureThreshold: cfg.breakerThreshold || 5,
          resetMs: cfg.breakerResetMs || 30000
        }))
      }
      breaker = breakers.get(node.id)
    }

    const result = await withRetry(
      async (attempt) => {
        const r = await executeFn(node, ctx)
        if (!r?.ok) {
          const err = new Error(r?.error || 'node failed')
          err.nodeResult = r
          throw err
        }
        return r
      },
      {
        retries,
        backoff: cfg.backoff || 'exp',
        baseMs: cfg.baseMs || 500,
        breaker,
        signal: ctx?.signal
      }
    )

    if (result.ok) return result.value
    return {
      ok: false,
      error: String(result.error?.message || result.error || ''),
      attempts: result.attempts,
      ...(result.error?.nodeResult || {})
    }
  }
}

export default {
  withRetry,
  makeBreaker,
  withNodeRetry
}
