/**
 * signalStoreIDB — signalStore 的 IndexedDB 后端
 *
 * 解决 P6 问题:localStorage 5MB 上限,1000 助手 × 100 信号/月很容易撑爆。
 *
 * API 兼容 signalStore.js,调用方可以无缝切换:
 *   import * as oldStore from './signalStore.js'
 *   import * as newStore from './signalStoreIDB.js'
 *
 *   // 切换:
 *   const store = isEnabled('signalStoreIDB') ? newStore : oldStore
 *
 * 实现:
 *   - 单 DB:chayuanEvolution
 *   - 单 store:signals(keyPath: id, indexes: assistantId, timestamp, type)
 *   - 写入:async,但保持调用方代码同步可工作(返回 id 不 await)
 */

const DB_NAME = 'chayuanEvolution'
const STORE = 'signals'
const VERSION = 1

let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB 不可用'))
      return
    }
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('assistantId', 'assistantId', { unique: false })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('type', 'type', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

async function withStore(mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const out = fn(store)
    tx.oncomplete = () => resolve(out)
    tx.onerror = () => reject(tx.error)
  })
}

/* ────────── API(同 signalStore) ────────── */

export async function appendSignal(signal) {
  if (!signal?.assistantId || !signal?.type) return ''
  const id = signal.id || `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const record = {
    id,
    type: signal.type,
    assistantId: signal.assistantId,
    version: signal.version || '1.0.0',
    timestamp: signal.timestamp || Date.now(),
    taskId: signal.taskId || '',
    success: signal.success !== false,
    failureCode: signal.failureCode || '',
    userNote: String(signal.userNote || '').slice(0, 500),
    documentAction: signal.documentAction || '',
    duration: Number(signal.duration) || 0,
    metadata: signal.metadata && typeof signal.metadata === 'object' ? { ...signal.metadata } : null
  }
  await withStore('readwrite', (store) => {
    store.put(record)
  })
  return id
}

export async function listSignalsByAssistant(assistantId, options = {}) {
  if (!assistantId) return []
  const days = Number(options.days) || 30
  const since = Date.now() - days * 86400000
  return withStore('readonly', (store) => {
    return new Promise((resolve) => {
      const idx = store.index('assistantId')
      const out = []
      const req = idx.openCursor(IDBKeyRange.only(assistantId))
      req.onsuccess = (e) => {
        const cursor = e.target.result
        if (!cursor) { resolve(out); return }
        if (cursor.value.timestamp >= since) out.push(cursor.value)
        cursor.continue()
      }
      req.onerror = () => resolve(out)
    })
  })
}

export async function computeFailureRate(assistantId, days = 7) {
  const list = await listSignalsByAssistant(assistantId, { days })
  if (!list.length) return 0
  const failed = list.filter(s => s.success === false).length
  return failed / list.length
}

export async function clearAllSignals() {
  await withStore('readwrite', (store) => store.clear())
}

export async function clearSignalsForAssistant(assistantId) {
  if (!assistantId) return 0
  let count = 0
  await withStore('readwrite', (store) => {
    return new Promise((resolve) => {
      const idx = store.index('assistantId')
      const req = idx.openCursor(IDBKeyRange.only(assistantId))
      req.onsuccess = (e) => {
        const cursor = e.target.result
        if (!cursor) { resolve(); return }
        cursor.delete()
        count += 1
        cursor.continue()
      }
      req.onerror = () => resolve()
    })
  })
  return count
}

export async function getSignalStats() {
  return withStore('readonly', (store) => {
    return new Promise((resolve) => {
      const req = store.count()
      req.onsuccess = () => resolve({ totalSignals: req.result, backend: 'IndexedDB' })
      req.onerror = () => resolve({ totalSignals: 0, backend: 'IndexedDB-error' })
    })
  })
}

export default {
  appendSignal,
  listSignalsByAssistant,
  computeFailureRate,
  clearAllSignals,
  clearSignalsForAssistant,
  getSignalStats
}
