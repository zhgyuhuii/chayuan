/**
 * kbPlannerClient — 主线程入口。
 *
 * 路由策略:
 *   - 短/中文本(≤ 20 000 字,无需 distill)→ 推 worker 跑 T1+T2+T3
 *   - 长文本(> 20 000 字,需 LLM distill)→ 直接走主线程 queryPlanner.plan
 *     (因为 chatCompletion 闭包不能跨 worker 序列化)
 *   - worker 不可用 / 超时 → fallback 主线程
 *
 * 接口:
 *   planKbQueriesViaWorker({ text, mode, options, chatCompletion, signal })
 *     → Array<{ tag, sectionIds, text, weight }>(与 queryPlanner.plan 一致)
 */
import { planKbQueriesInWorkerCore } from './kbPlannerWorker.js'
import { plan as _planQueriesFull } from '../services/kb/queryPlanner.js'

const _DISTILL_THRESHOLD = 20_000

let worker = null
let seq = 0
const pending = new Map()

function getWorker() {
  if (worker) return worker
  if (typeof Worker === 'undefined') return null
  try {
    const url = new URL('./kbPlannerWorker.js', import.meta.url)
    worker = new Worker(url, { type: 'module' })
    worker.addEventListener('message', (event) => {
      const { id, ok, result, error } = event.data || {}
      const slot = pending.get(id)
      if (!slot) return
      pending.delete(id)
      if (ok) slot.resolve(result)
      else slot.reject(new Error(error || 'kb planner worker error'))
    })
    worker.addEventListener('error', () => { worker = null })
    return worker
  } catch (e) {
    return null
  }
}

async function _runWorker(payload, options = {}) {
  const instance = getWorker()
  if (!instance) return planKbQueriesInWorkerCore(payload)
  return new Promise((resolve, reject) => {
    const id = `kbp_${++seq}_${Date.now().toString(36)}`
    pending.set(id, { resolve, reject })
    try {
      instance.postMessage({ id, type: 'plan-kb-queries', payload })
    } catch (e) {
      pending.delete(id)
      try { resolve(planKbQueriesInWorkerCore(payload)) } catch { reject(e) }
      return
    }
    setTimeout(() => {
      if (!pending.has(id)) return
      pending.delete(id)
      try { resolve(planKbQueriesInWorkerCore(payload)) }
      catch { reject(new Error('kb planner worker timeout')) }
    }, Number(options.timeoutMs || 8000))
  })
}

export async function planKbQueriesViaWorker(args = {}) {
  const text = String(args.text || '')
  const mode = args.mode || 'qa'
  const options = args.options || {}
  if (!text.trim()) return []

  // 长文本 → 主线程跑(distill 需要 chatCompletion)
  if (text.length > _DISTILL_THRESHOLD || typeof options.forceMainThread === 'function' || options.forceMainThread === true) {
    return _planQueriesFull(text, mode, {
      ...options,
      chatCompletion: args.chatCompletion || (async () => ''),
      signal: args.signal,
    })
  }

  // 短/中文本 → worker(T1+T2+T3)
  try {
    const out = await _runWorker(
      { text, mode, options },
      { timeoutMs: args.timeoutMs },
    )
    return Array.isArray(out?.queries) ? out.queries : []
  } catch (e) {
    // worker 失败回退主线程
    return _planQueriesFull(text, mode, {
      ...options,
      chatCompletion: args.chatCompletion || (async () => ''),
      signal: args.signal,
    })
  }
}

export default { planKbQueriesViaWorker }
