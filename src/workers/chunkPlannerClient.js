import { planChunksInWorkerCore } from './chunkPlannerWorker.js'

let worker = null
let seq = 0
const pending = new Map()

function getWorker() {
  if (worker) return worker
  if (typeof Worker === 'undefined') return null
  try {
    const url = new URL('./chunkPlannerWorker.js', import.meta.url)
    worker = new Worker(url, { type: 'module' })
    worker.addEventListener('message', (event) => {
      const { id, ok, result, error } = event.data || {}
      const slot = pending.get(id)
      if (!slot) return
      pending.delete(id)
      if (ok) slot.resolve(result)
      else slot.reject(new Error(error || 'chunk planner worker error'))
    })
    worker.addEventListener('error', () => {
      worker = null
    })
    return worker
  } catch {
    return null
  }
}

export async function planChunksInWorker(payload = {}, options = {}) {
  const instance = getWorker()
  if (!instance) return planChunksInWorkerCore(payload)
  return new Promise((resolve, reject) => {
    const id = `chk_${++seq}_${Date.now().toString(36)}`
    pending.set(id, { resolve, reject })
    try {
      instance.postMessage({ id, type: 'plan-chunks', payload })
    } catch (error) {
      pending.delete(id)
      try { resolve(planChunksInWorkerCore(payload)) } catch { reject(error) }
      return
    }
    setTimeout(() => {
      if (!pending.has(id)) return
      pending.delete(id)
      try { resolve(planChunksInWorkerCore(payload)) } catch { reject(new Error('chunk planner worker timeout')) }
    }, Number(options.timeoutMs || 5000))
  })
}

export default {
  planChunksInWorker
}
