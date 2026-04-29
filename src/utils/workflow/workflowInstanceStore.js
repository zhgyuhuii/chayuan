/**
 * workflowInstanceStore — 工作流运行实例的 IndexedDB 持久化
 *
 * 解决问题:
 *   现有 workflowRunner 的 activeWorkflowRuns 是 in-memory Map,
 *   页面刷新即丢,>5 分钟的长流程中途崩溃零线索。
 *
 * 设计:
 *   - 单 DB:chayuanWorkflow
 *   - 单 store:instances(keyPath: id, indexes: status, definitionId, startedAt)
 *   - 每个节点 done 后同步快照(snapshot at each step)
 *   - listResumable():找 status='running' 但 ownerWindow 已死的 instance
 *
 * API 兼容 workflowRunner 的内部状态结构,新增 persist/load/listResumable。
 */

const DB_NAME = 'chayuanWorkflow'
const STORE = 'instances'
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
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('definitionId', 'definitionId', { unique: false })
        store.createIndex('startedAt', 'startedAt', { unique: false })
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

/* ────────── 写 ────────── */

/**
 * 持久化 instance(insert or replace)。
 * 推荐每个节点完成后调一次。
 */
export async function persistInstance(instance) {
  if (!instance?.id) return false
  const record = {
    id: String(instance.id),
    definitionId: String(instance.definitionId || ''),
    definitionVersion: String(instance.definitionVersion || ''),
    taskId: String(instance.taskId || ''),
    status: String(instance.status || 'pending'),
    startedAt: Number(instance.startedAt) || Date.now(),
    updatedAt: Date.now(),
    cursor: instance.cursor || { ready: [], inflight: [] },
    vars: instance.vars || {},
    snapshot: instance.snapshot || {},
    undoBundleId: instance.undoBundleId || '',
    ownerWindow: instance.ownerWindow || '',
    parentInstanceId: instance.parentInstanceId || '',
    metadata: instance.metadata || {}
  }
  await withStore('readwrite', store => store.put(record))
  return true
}

export async function updateInstanceStatus(id, status, extra = {}) {
  const cur = await getInstance(id)
  if (!cur) return false
  cur.status = status
  cur.updatedAt = Date.now()
  Object.assign(cur, extra)
  await persistInstance(cur)
  return true
}

export async function deleteInstance(id) {
  if (!id) return false
  await withStore('readwrite', store => store.delete(String(id)))
  return true
}

/* ────────── 读 ────────── */

export async function getInstance(id) {
  if (!id) return null
  return withStore('readonly', store => {
    return new Promise(resolve => {
      const req = store.get(String(id))
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  })
}

export async function listInstances(options = {}) {
  return withStore('readonly', store => {
    return new Promise(resolve => {
      const out = []
      const req = options.status
        ? store.index('status').openCursor(IDBKeyRange.only(String(options.status)))
        : store.openCursor()
      req.onsuccess = (e) => {
        const cursor = e.target.result
        if (!cursor) { resolve(out); return }
        out.push(cursor.value)
        cursor.continue()
      }
      req.onerror = () => resolve(out)
    })
  })
}

/**
 * 找出"应该恢复"的 instance(status=running 但 ownerWindow 已死)。
 *   options.aliveWindowIds:当前活跃窗口 id 集合(由 leaderElection 提供)
 */
export async function listResumable(options = {}) {
  const all = await listInstances({ status: 'running' })
  if (!all.length) return []
  const aliveSet = new Set(options.aliveWindowIds || [])
  return all.filter(i => {
    // ownerWindow 在 aliveSet 中 → 还在跑;否则 → 可恢复
    return !i.ownerWindow || !aliveSet.has(i.ownerWindow)
  })
}

/* ────────── 工具 ────────── */

export async function getStats() {
  const all = await listInstances()
  const byStatus = {}
  for (const i of all) {
    byStatus[i.status] = (byStatus[i.status] || 0) + 1
  }
  return { total: all.length, byStatus }
}

/**
 * 清空(测试 / 用户主动清理用)。
 *   options.olderThanDays:只清这天数以前的(默认全清)
 */
export async function clearAll(options = {}) {
  if (!options.olderThanDays) {
    await withStore('readwrite', store => store.clear())
    return
  }
  const cutoff = Date.now() - Number(options.olderThanDays) * 86400000
  const all = await listInstances()
  let deleted = 0
  for (const i of all) {
    if (i.updatedAt < cutoff) {
      await deleteInstance(i.id)
      deleted += 1
    }
  }
  return { deleted }
}

export default {
  persistInstance,
  updateInstanceStatus,
  deleteInstance,
  getInstance,
  listInstances,
  listResumable,
  getStats,
  clearAll
}
