/**
 * kbPlannerWorker — 把"四层漏斗"前三层 (T1 splitter / T2 merge / T3 cluster)
 * 卸载到 worker 线程,避免 100k 字长文档卡 UI。
 *
 * plan v1.3 §3.2.10:与 chunkPlannerWorker 平行,只跑纯计算路径。
 *
 * 重要约束:
 *   - T4 (LLM distill) 不在 worker 里跑(worker 内拿不到上层 chatCompletion 闭包),
 *     所以 worker 路径只覆盖"无 distill"档(text ≤ 20k 字 / 显式 disableDistill);
 *   - 主线程对 > 20k 字的长文本仍走完整 queryPlanner.plan,worker 路径直接 fallback。
 */
import { plan as _planQueries } from '../services/kb/queryPlanner.js'

export async function planKbQueriesInWorkerCore(payload = {}) {
  const text = String(payload.text || '')
  const mode = payload.mode || 'qa'
  const options = payload.options || {}
  const noopChatCompletion = async () => ''
  const queries = await _planQueries(text, mode, {
    ...options,
    chatCompletion: noopChatCompletion,
    onPhase: undefined,
  })
  return { queries: Array.isArray(queries) ? queries : [], distillBypassed: true }
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', async (event) => {
    const { id, type, payload } = event.data || {}
    if (type !== 'plan-kb-queries') return
    try {
      const result = await planKbQueriesInWorkerCore(payload || {})
      self.postMessage({ id, ok: true, result })
    } catch (error) {
      self.postMessage({
        id, ok: false,
        error: String(error?.message || error || 'kb planner worker error'),
      })
    }
  })
}

export default { planKbQueriesInWorkerCore }
