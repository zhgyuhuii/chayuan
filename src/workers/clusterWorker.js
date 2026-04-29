/**
 * clusterWorker — 失败聚类的 Web Worker 版本
 *
 * 解决 P6 问题:failureCluster.clusterFailuresForAssistant 在主线程跑,
 * 1000+ 信号时会阻塞 UI。
 *
 * 用法(在主线程):
 *   import { clusterInWorker } from '@/workers/clusterClient.js'
 *   const clusters = await clusterInWorker(signals, { minSize: 2 })
 *
 * 本文件本身是 Worker code(self.addEventListener message),
 * Vite 用 ?worker query 挂载: import Worker from './clusterWorker.js?worker'
 */

// 失败判定:与 failureCluster.isFailure 同语义
function isFailure(s) {
  if (!s) return false
  if (s.success === false) return true
  if (s.type === 'thumbs' && s.metadata?.value === 'down') return true
  if (s.type === 'reject') return true
  return false
}

// 规则聚类 key:基于 errorKind + documentAction
function ruleKey(signal) {
  const meta = signal.metadata || {}
  const k = meta.errorKind || signal.failureCode || 'generic'
  const act = signal.documentAction || 'na'
  return `${k}::${act}`
}

function clusterFailures(signals, options = {}) {
  const minSize = Number(options.minSize) || 2
  const days = Number(options.days) || 7
  const since = Date.now() - days * 86400000

  const failures = (signals || [])
    .filter(s => s && s.timestamp >= since)
    .filter(isFailure)

  if (failures.length < minSize) return []

  const groups = new Map()
  for (const s of failures) {
    const key = ruleKey(s)
    if (!groups.has(key)) groups.set(key, { cluster: key, count: 0, samples: [], assistantId: s.assistantId, windowDays: days })
    const g = groups.get(key)
    g.count += 1
    if (g.samples.length < 5) g.samples.push(s)   // 每 cluster 最多 5 个样本
  }

  return [...groups.values()]
    .filter(g => g.count >= minSize)
    .sort((a, b) => b.count - a.count)
}

// Worker message handler
if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', (e) => {
    const { id, type, payload } = e.data || {}
    if (type !== 'cluster') return
    try {
      const result = clusterFailures(payload?.signals || [], payload?.options || {})
      self.postMessage({ id, ok: true, result })
    } catch (err) {
      self.postMessage({ id, ok: false, error: String(err?.message || err) })
    }
  })
}

// 也导出供测试 / fallback 使用
export { clusterFailures, isFailure }
export default { clusterFailures, isFailure }
