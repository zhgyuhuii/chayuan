import { resolveExactTextStats } from '../utils/exactTextStats.js'

export function computeTextMetrics(text = '') {
  const value = String(text || '')
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const cjkChars = (normalized.match(/[\u4e00-\u9fa5]/g) || []).length
  const words = (normalized.match(/[A-Za-z0-9_]+/g) || []).length
  const lines = normalized ? normalized.split('\n').length : 0
  return {
    chars: normalized.length,
    nonWhitespaceChars: normalized.replace(/\s+/g, '').length,
    cjkChars,
    words,
    lines
  }
}

export function analyzeTextStats(payload = {}) {
  const text = String(payload.text || '')
  const materialText = payload.materialText
  return {
    metrics: computeTextMetrics(text),
    exactStats: resolveExactTextStats(text, { materialText })
  }
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', (event) => {
    const { id, type, payload } = event.data || {}
    if (type !== 'text-stats') return
    try {
      self.postMessage({ id, ok: true, result: analyzeTextStats(payload || {}) })
    } catch (error) {
      self.postMessage({ id, ok: false, error: String(error?.message || error || 'text stats worker error') })
    }
  })
}

export default {
  computeTextMetrics,
  analyzeTextStats
}
