import { analyzeTextStats } from './textStatsWorker.js'

let worker = null
let seq = 0
const pending = new Map()

function getWorker() {
  if (worker) return worker
  if (typeof Worker === 'undefined') return null
  try {
    const url = new URL('./textStatsWorker.js', import.meta.url)
    worker = new Worker(url, { type: 'module' })
    worker.addEventListener('message', (event) => {
      const { id, ok, result, error } = event.data || {}
      const slot = pending.get(id)
      if (!slot) return
      pending.delete(id)
      if (ok) slot.resolve(result)
      else slot.reject(new Error(error || 'text stats worker error'))
    })
    worker.addEventListener('error', () => {
      worker = null
    })
    return worker
  } catch {
    return null
  }
}

export async function analyzeTextStatsInWorker(payload = {}, options = {}) {
  const instance = getWorker()
  if (!instance) return analyzeTextStats(payload)
  return new Promise((resolve, reject) => {
    const id = `txt_${++seq}_${Date.now().toString(36)}`
    pending.set(id, { resolve, reject })
    try {
      instance.postMessage({ id, type: 'text-stats', payload })
    } catch (error) {
      pending.delete(id)
      try { resolve(analyzeTextStats(payload)) } catch { reject(error) }
      return
    }
    setTimeout(() => {
      if (!pending.has(id)) return
      pending.delete(id)
      try { resolve(analyzeTextStats(payload)) } catch { reject(new Error('text stats worker timeout')) }
    }, Number(options.timeoutMs || 5000))
  })
}

export default {
  analyzeTextStatsInWorker
}
