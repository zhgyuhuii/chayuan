/**
 * taskTieredStorage — 任务分层存储(T-1.3 + T-3.2)
 *
 * 分两层:
 *   - Hot(localStorage):最近 50 条任务 + 所有 starred 任务
 *   - Cold(IndexedDB):全部历史任务
 *
 * 自动迁移:任务数 > HOT_LIMIT 时,把 endedAt 最早且未 starred 的迁到 Cold,
 * 保证 hot 层 ≤ 50 条。
 *
 * API 兼容 taskListStore.getTasks()(返回 hot 层),
 * 新增 listAll / listColdOnly / promote(从 cold 拉回 hot)。
 */

const DB_NAME = 'chayuanTasks'
const STORE = 'archive'
const VERSION = 1

const HOT_LIMIT = 50

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
        store.createIndex('endedAt', 'endedAt', { unique: false })
        store.createIndex('kind', 'kind', { unique: false })
        store.createIndex('starred', 'starred', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

async function withStore(mode, fn) {
  let db
  try { db = await openDB() }
  catch (_) { return null }   // IDB 不可用 → 静默降级,caller 自行处理 null
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const store = tx.objectStore(STORE)
    const out = fn(store)
    tx.oncomplete = () => resolve(out)
    tx.onerror = () => reject(tx.error)
  })
}

/* ────────── Cold(IDB)写 ────────── */

export async function archiveTask(task) {
  if (!task?.id) return false
  const record = {
    ...task,
    archivedAt: Date.now()
  }
  await withStore('readwrite', store => store.put(record))
  return true
}

export async function archiveMany(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return 0
  await withStore('readwrite', store => {
    for (const t of tasks) {
      if (t?.id) store.put({ ...t, archivedAt: Date.now() })
    }
  })
  return tasks.length
}

/* ────────── Cold 读 ────────── */

export async function listColdTasks(options = {}) {
  const result = await withStore('readonly', store => {
    return new Promise(resolve => {
      const out = []
      const limit = Number(options.limit) || 200
      const reverse = options.reverse !== false  // 默认时间倒序
      const idx = store.index('endedAt')
      const req = idx.openCursor(null, reverse ? 'prev' : 'next')
      req.onsuccess = (e) => {
        const cursor = e.target.result
        if (!cursor || out.length >= limit) { resolve(out); return }
        if (options.kind && cursor.value.kind !== options.kind) {
          cursor.continue(); return
        }
        if (options.starredOnly && !cursor.value.starred) {
          cursor.continue(); return
        }
        out.push(cursor.value)
        cursor.continue()
      }
      req.onerror = () => resolve(out)
    })
  })
  return result || []
}

export async function getColdTask(id) {
  if (!id) return null
  return withStore('readonly', store => {
    return new Promise(resolve => {
      const req = store.get(String(id))
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  })
}

export async function deleteColdTask(id) {
  if (!id) return false
  await withStore('readwrite', store => store.delete(String(id)))
  return true
}

export async function getColdStats() {
  return withStore('readonly', store => {
    return new Promise(resolve => {
      const req = store.count()
      req.onsuccess = () => resolve({ total: req.result })
      req.onerror = () => resolve({ total: 0 })
    })
  })
}

/* ────────── Hot ↔ Cold 迁移 ────────── */

/**
 * 选哪些任务该被驱逐到 cold:
 *   - 状态终态(completed / failed / cancelled / archived)
 *   - 未 starred
 *   - 超过 HOT_LIMIT 之外按 endedAt 升序(最早的先走)
 */
export function selectEvictableTasks(allTasks) {
  if (!Array.isArray(allTasks)) return []
  const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'archived', 'done'])
  const eligible = allTasks
    .filter(t => TERMINAL.has(t.status) && !t.starred)
    .sort((a, b) => (a.endedAt || a.updatedAt || 0) - (b.endedAt || b.updatedAt || 0))

  const totalKeepCount = HOT_LIMIT
  const totalEligible = allTasks.filter(t => TERMINAL.has(t.status) && !t.starred)
  const evictCount = Math.max(0, totalEligible.length - totalKeepCount)
  return eligible.slice(0, evictCount)
}

/**
 * 把候选 task 写入 cold,返回这些 ID 让 caller 从 hot 删除。
 */
export async function evictToCold(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return []
  await archiveMany(tasks)
  return tasks.map(t => t.id)
}

/**
 * 把一个 cold task 拉回 hot(用户点 "重看" / "重跑" 时)。
 * caller 负责再写入 taskListStore;本函数只读取。
 */
export async function promoteToHot(taskId) {
  const t = await getColdTask(taskId)
  return t  // 业务方决定怎么处理
}

/* ────────── 综合统计 ────────── */

export async function getOverallStats(hotTasks = []) {
  const cold = await getColdStats()
  return {
    hot: hotTasks.length,
    cold: cold.total,
    total: hotTasks.length + cold.total,
    hotLimit: HOT_LIMIT
  }
}

/**
 * 清空 cold(危险操作 — 用户主动调用)。
 *   options.olderThanDays  仅清这天数前的(保留近期)
 */
export async function clearCold(options = {}) {
  if (!options.olderThanDays) {
    await withStore('readwrite', store => store.clear())
    return { deletedAll: true }
  }
  const cutoff = Date.now() - Number(options.olderThanDays) * 86400000
  let deleted = 0
  await withStore('readwrite', store => {
    return new Promise(resolve => {
      const req = store.openCursor()
      req.onsuccess = (e) => {
        const cursor = e.target.result
        if (!cursor) { resolve(); return }
        if ((cursor.value.endedAt || cursor.value.updatedAt || 0) < cutoff && !cursor.value.starred) {
          cursor.delete()
          deleted += 1
        }
        cursor.continue()
      }
      req.onerror = () => resolve()
    })
  })
  return { deleted }
}

export default {
  archiveTask,
  archiveMany,
  listColdTasks,
  getColdTask,
  deleteColdTask,
  getColdStats,
  selectEvictableTasks,
  evictToCold,
  promoteToHot,
  getOverallStats,
  clearCold,
  HOT_LIMIT
}
