/**
 * rateLimiter — Token bucket 限流器,LLM 调用专用
 *
 * 解决 P6 问题:进化系统任意触发都会发出大量 API 请求,瞬间耗光配额 / 触发 rate limit。
 *
 * 设计:
 *   - 多桶(按 providerId 分):每个 provider 独立桶
 *   - 每秒补 N 个 token,最多攒 M 个
 *   - acquire() 等待直到有 token,或超时拒绝
 *
 * 用法:
 *   const limiter = createLimiter({ ratePerSecond: 5, burst: 10 })
 *   await limiter.acquire('openai')
 *   const result = await chatCompletion(...)
 *
 *   // 装饰器:
 *   const limited = withRateLimit(chatCompletion, { ratePerSecond: 5 })
 *   await limited({ providerId: 'openai', ... })
 *
 * Feature flag:rateLimiter(默认 false,需用户开启)
 */

import { isEnabled } from '../featureFlags.js'

const FLAG = 'rateLimiter'

const DEFAULT_RATE = 5     // 每秒 5 个
const DEFAULT_BURST = 10   // 攒 10 个
const DEFAULT_TIMEOUT = 30000  // 等待最多 30 秒

class TokenBucket {
  constructor(rate = DEFAULT_RATE, burst = DEFAULT_BURST) {
    this.rate = rate
    this.burst = burst
    this.tokens = burst
    this.lastRefill = Date.now()
    this.queue = []   // 排队等 token 的 resolver
  }

  refill() {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000
    this.tokens = Math.min(this.burst, this.tokens + elapsed * this.rate)
    this.lastRefill = now
  }

  tryAcquire() {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return true
    }
    return false
  }

  /**
   * 异步等待获取 token。超时 → reject。
   */
  acquire(timeoutMs = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      if (this.tryAcquire()) { resolve(); return }
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex(q => q.timer === timer)
        if (idx >= 0) this.queue.splice(idx, 1)
        reject(new Error(`rate-limit timeout (${timeoutMs}ms)`))
      }, timeoutMs)
      this.queue.push({ resolve, timer })
      // 启动定时检查
      if (!this._tickTimer) this.startTick()
    })
  }

  startTick() {
    this._tickTimer = setInterval(() => {
      this.refill()
      while (this.tokens >= 1 && this.queue.length > 0) {
        this.tokens -= 1
        const { resolve, timer } = this.queue.shift()
        clearTimeout(timer)
        resolve()
      }
      if (this.queue.length === 0) {
        clearInterval(this._tickTimer)
        this._tickTimer = null
      }
    }, 200)
  }

  status() {
    this.refill()
    return {
      tokens: Math.floor(this.tokens),
      burst: this.burst,
      rate: this.rate,
      pending: this.queue.length
    }
  }
}

/* ────────── 多桶管理 ────────── */

const _buckets = new Map()

export function createLimiter(options = {}) {
  return new TokenBucket(
    Number(options.ratePerSecond) || DEFAULT_RATE,
    Number(options.burst) || DEFAULT_BURST
  )
}

/**
 * 全局多桶接口:每个 provider 一个桶。
 */
export async function acquire(providerId, options = {}) {
  if (!isEnabled(FLAG)) return  // flag 关闭 → 直通
  const key = String(providerId || 'default')
  if (!_buckets.has(key)) {
    _buckets.set(key, createLimiter(options))
  }
  return _buckets.get(key).acquire(options.timeoutMs)
}

/**
 * 给 chatCompletion 等异步函数加 rate-limit 装饰器。
 *   const limited = withRateLimit(chatCompletion)
 *   await limited({ providerId: 'openai', ... })  // 自动等 token
 */
export function withRateLimit(fn, options = {}) {
  if (typeof fn !== 'function') return fn
  return async function rateLimited(args = {}) {
    if (isEnabled(FLAG)) {
      await acquire(args.providerId, options)
    }
    return fn(args)
  }
}

export function getStatus() {
  const out = {}
  for (const [key, bucket] of _buckets) {
    out[key] = bucket.status()
  }
  return out
}

export function reset() {
  _buckets.clear()
}

export default {
  createLimiter,
  acquire,
  withRateLimit,
  getStatus,
  reset
}
