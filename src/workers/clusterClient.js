/**
 * clusterClient — clusterWorker 的客户端封装
 *
 * 自动 fallback:如果浏览器不支持 Worker / Vite 不可用,
 * 直接在主线程跑同样的算法。
 */

import { clusterFailures } from './clusterWorker.js'

let _worker = null
let _seq = 0
const _pending = new Map()

function getWorker() {
  if (_worker) return _worker
  if (typeof Worker === 'undefined') return null
  try {
    // Vite 编译期会把 ?worker 处理成 worker 构造器
    const url = new URL('./clusterWorker.js', import.meta.url)
    _worker = new Worker(url, { type: 'module' })
    _worker.addEventListener('message', (e) => {
      const { id, ok, result, error } = e.data || {}
      const slot = _pending.get(id)
      if (!slot) return
      _pending.delete(id)
      if (ok) slot.resolve(result)
      else slot.reject(new Error(error || 'worker error'))
    })
    _worker.addEventListener('error', () => {
      // 一旦 worker 出错,后续 fallback 主线程
      _worker = null
    })
    return _worker
  } catch {
    return null
  }
}

/**
 * 在 worker 中跑聚类。失败 / 不可用时 fallback 主线程。
 *   返回 cluster 数组。
 */
export async function clusterInWorker(signals, options = {}) {
  const w = getWorker()
  if (!w) {
    // 主线程 fallback
    return clusterFailures(signals, options)
  }
  return new Promise((resolve, reject) => {
    const id = `cl_${++_seq}_${Date.now().toString(36)}`
    _pending.set(id, { resolve, reject })
    try {
      w.postMessage({ id, type: 'cluster', payload: { signals, options } })
    } catch (e) {
      _pending.delete(id)
      // postMessage 失败 → fallback
      try { resolve(clusterFailures(signals, options)) } catch { reject(e) }
    }
    // 5 秒超时:可能 worker 卡住
    setTimeout(() => {
      if (_pending.has(id)) {
        _pending.delete(id)
        // fallback 主线程
        try { resolve(clusterFailures(signals, options)) } catch { reject(new Error('worker timeout')) }
      }
    }, 5000)
  })
}

export default { clusterInWorker }
