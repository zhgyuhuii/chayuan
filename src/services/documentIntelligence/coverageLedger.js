function nowIso() {
  return new Date().toISOString()
}

function normalizeChunkId(chunk, index) {
  return String(chunk?.id || chunk?.chunkId || (chunk?.index ?? index))
}

export function createCoverageLedger(chunks = [], options = {}) {
  const normalizedChunks = (Array.isArray(chunks) ? chunks : []).map((chunk, index) => ({
    id: normalizeChunkId(chunk, index),
    index,
    status: 'pending',
    startedAt: '',
    endedAt: '',
    retryCount: 0,
    inputChars: String(chunk?.text || chunk?.normalizedText || '').length,
    outputChars: 0,
    error: '',
    hash: ''
  }))
  return {
    id: String(options.id || `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    taskType: String(options.taskType || '').trim(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    total: normalizedChunks.length,
    chunks: normalizedChunks
  }
}

function findEntry(ledger, chunkIdOrIndex) {
  if (!ledger || !Array.isArray(ledger.chunks)) return null
  return ledger.chunks.find(item => item.id === String(chunkIdOrIndex) || item.index === Number(chunkIdOrIndex)) || null
}

export function markChunkStarted(ledger, chunkIdOrIndex) {
  const entry = findEntry(ledger, chunkIdOrIndex)
  if (!entry) return ledger
  entry.status = 'running'
  entry.startedAt = nowIso()
  entry.error = ''
  ledger.updatedAt = entry.startedAt
  return ledger
}

export function markChunkCompleted(ledger, chunkIdOrIndex, output = '') {
  const entry = findEntry(ledger, chunkIdOrIndex)
  if (!entry) return ledger
  entry.status = 'completed'
  entry.endedAt = nowIso()
  entry.outputChars = String(output || '').length
  entry.hash = String(output || '').slice(0, 120)
  entry.error = ''
  ledger.updatedAt = entry.endedAt
  return ledger
}

export function markChunkFailed(ledger, chunkIdOrIndex, error = '') {
  const entry = findEntry(ledger, chunkIdOrIndex)
  if (!entry) return ledger
  entry.status = 'failed'
  entry.endedAt = nowIso()
  entry.error = String(error?.message || error || '处理失败').slice(0, 300)
  entry.retryCount += 1
  ledger.updatedAt = entry.endedAt
  return ledger
}

export function getCoverageSummary(ledger) {
  const chunks = Array.isArray(ledger?.chunks) ? ledger.chunks : []
  const total = chunks.length
  const completed = chunks.filter(item => item.status === 'completed').length
  const failed = chunks.filter(item => item.status === 'failed').length
  const running = chunks.filter(item => item.status === 'running').length
  const pending = Math.max(0, total - completed - failed - running)
  return {
    total,
    completed,
    failed,
    running,
    pending,
    coverageRate: total > 0 ? completed / total : 0,
    done: total > 0 && completed + failed === total,
    ok: total > 0 && completed === total
  }
}

export default {
  createCoverageLedger,
  markChunkStarted,
  markChunkCompleted,
  markChunkFailed,
  getCoverageSummary
}
