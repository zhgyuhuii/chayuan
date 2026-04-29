import { planTextChunks } from '../services/documentIntelligence/chunkPlanner.js'

export function planChunksInWorkerCore(payload = {}) {
  return planTextChunks(payload.text || '', {
    strategy: payload.strategy,
    chunkSettings: payload.chunkSettings,
    includeMetadata: payload.includeMetadata
  })
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', (event) => {
    const { id, type, payload } = event.data || {}
    if (type !== 'plan-chunks') return
    try {
      self.postMessage({ id, ok: true, result: planChunksInWorkerCore(payload || {}) })
    } catch (error) {
      self.postMessage({ id, ok: false, error: String(error?.message || error || 'chunk planner worker error') })
    }
  })
}

export default {
  planChunksInWorkerCore
}
