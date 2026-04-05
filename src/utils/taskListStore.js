/**
 * 通用任务清单存储 - 支持跨窗口同步（Popup、主窗口等）
 * 任务类型：spell-check、translate、summary 等
 * 通过 localStorage + storage 事件实现多窗口同步
 */

const STORAGE_KEY = 'NdTaskList'
const STORAGE_VERSION = 1
const ARCHIVE_LIMIT = 200

/** @typedef {'pending'|'running'|'completed'|'failed'|'cancelled'|'abnormal'} TaskStatus */
/** @typedef {{ id: string, type: string, title: string, status: TaskStatus, progress?: number, total?: number, current?: number, data?: object, error?: string, createdAt: string, startedAt?: string, endedAt?: string, updatedAt: string }} Task */

let tasks = []
let archivedTasks = []
let listeners = new Set()

function parseStoredState(raw) {
  const emptyState = { tasks: [], archivedTasks: [] }
  if (!raw) return emptyState
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return { tasks: parsed, archivedTasks: [] }
    }
    if (parsed && typeof parsed === 'object') {
      return {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        archivedTasks: Array.isArray(parsed.archivedTasks) ? parsed.archivedTasks : []
      }
    }
  } catch (e) {
    console.warn('taskListStore parseStoredState:', e)
  }
  return emptyState
}

function cloneTaskSnapshot(task) {
  try {
    return JSON.parse(JSON.stringify(task))
  } catch (_) {
    return task ? {
      ...task,
      data: task.data && typeof task.data === 'object' ? { ...task.data } : task.data
    } : null
  }
}

function isTerminalTaskStatus(status) {
  return ['completed', 'failed', 'cancelled', 'abnormal'].includes(String(status || ''))
}

function archiveTaskSnapshot(task) {
  if (!task || !isTerminalTaskStatus(task.status)) return
  const snapshot = cloneTaskSnapshot(task)
  if (!snapshot) return
  snapshot.archivedAt = new Date().toISOString()
  const next = archivedTasks.filter(item => item?.id !== snapshot.id)
  next.unshift(snapshot)
  archivedTasks = next.slice(0, ARCHIVE_LIMIT)
}

function isWorkflowChildTask(task) {
  return !!task?.data?.parentWorkflowTaskId
}

function getTopLevelTasks(list) {
  return (list || []).filter(task => !isWorkflowChildTask(task))
}

function loadFromStorage() {
  try {
    const localState = parseStoredState(localStorage?.getItem(STORAGE_KEY))
    if (localState.tasks.length > 0 || localState.archivedTasks.length > 0) return localState
  } catch (e) {
    console.warn('taskListStore loadFromStorage:', e)
  }
  try {
    const pluginRaw = window.Application?.PluginStorage?.getItem(STORAGE_KEY)
    const pluginState = parseStoredState(pluginRaw)
    if (pluginState.tasks.length > 0 || pluginState.archivedTasks.length > 0) return pluginState
  } catch (e) {
    console.warn('taskListStore loadFromPluginStorage:', e)
  }
  return { tasks: [], archivedTasks: [] }
}

function saveToStorage() {
  try {
    const payload = {
      version: STORAGE_VERSION,
      tasks,
      archivedTasks,
      updatedAt: new Date().toISOString()
    }
    localStorage?.setItem(STORAGE_KEY, JSON.stringify(payload))
    // 同时写入 PluginStorage 供 WPS 环境使用
    try {
      window.Application?.PluginStorage?.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (_) {}
  } catch (e) {
    console.warn('taskListStore saveToStorage:', e)
  }
}

function notify() {
  listeners.forEach(fn => {
    try {
      fn([...tasks])
    } catch (e) {
      console.warn('taskListStore listener error:', e)
    }
  })
}

function persistAndNotify() {
  saveToStorage()
  notify()
}

/**
 * 订阅任务列表变化
 * @param {function(Task[]): void} fn
 * @returns {function(): void} 取消订阅
 */
export function subscribe(fn) {
  listeners.add(fn)
  fn([...tasks])
  return () => listeners.delete(fn)
}

/**
 * 获取当前任务列表
 */
export function getTasks() {
  syncTasksFromStorage()
  return [...tasks]
}

export function syncTasksFromStorage() {
  const state = loadFromStorage()
  tasks = Array.isArray(state?.tasks) ? state.tasks : []
  archivedTasks = Array.isArray(state?.archivedTasks) ? state.archivedTasks : []
  return [...tasks]
}

/**
 * 添加任务
 * @param {Partial<Task> & { type: string, title: string }} task
 * @returns {string} 任务 id
 */
export function addTask(task) {
  const id = task.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const now = new Date().toISOString()
  const t = {
    id,
    type: task.type || 'unknown',
    title: task.title || '未命名任务',
    status: task.status || 'pending',
    progress: task.progress ?? 0,
    total: task.total ?? 0,
    current: task.current ?? 0,
    data: task.data ?? {},
    error: task.error,
    createdAt: task.createdAt || now,
    startedAt: task.startedAt || now,
    endedAt: task.endedAt || '',
    updatedAt: now
  }
  tasks.push(t)
  persistAndNotify()
  return id
}

/**
 * 更新任务
 * @param {string} id
 * @param {Partial<Task>} updates
 */
export function updateTask(id, updates) {
  const idx = tasks.findIndex(t => t.id === id)
  if (idx < 0) return
  const t = tasks[idx]
  const now = new Date().toISOString()
  const nextStatus = updates?.status
  const endedAt = nextStatus && ['completed', 'failed', 'cancelled', 'abnormal'].includes(nextStatus)
    ? (updates?.endedAt || t.endedAt || now)
    : (updates?.endedAt ?? t.endedAt)
  Object.assign(t, updates, {
    startedAt: t.startedAt || updates?.startedAt || now,
    endedAt,
    updatedAt: now
  })
  archiveTaskSnapshot(t)
  persistAndNotify()
}

/**
 * 获取任务
 * @param {string} id
 */
export function getTaskById(id) {
  syncTasksFromStorage()
  return tasks.find(t => t.id === id) || archivedTasks.find(t => t.id === id) || null
}

/**
 * 获取当前正在运行的任务
 */
export function getActiveTask() {
  return tasks.find(t => t.status === 'running') || null
}

/**
 * 移除任务
 * @param {string} id
 */
export function removeTask(id) {
  const removable = new Set([id])
  const target = tasks.find(t => t.id === id)
  if (target?.data?.kind === 'workflow' || target?.type === 'workflow') {
    tasks.forEach(task => {
      if (task?.data?.parentWorkflowTaskId === id) {
        removable.add(task.id)
      }
    })
  }
  tasks.filter(t => removable.has(t.id)).forEach(archiveTaskSnapshot)
  tasks = tasks.filter(t => !removable.has(t.id))
  persistAndNotify()
}

/**
 * 清空已完成/失败/取消的任务
 */
export function clearCompletedTasks() {
  const removableTopLevelIds = new Set(
    getTopLevelTasks(tasks)
      .filter(t => t.status !== 'running' && t.status !== 'pending')
      .map(t => t.id)
  )
  tasks.filter(t => removableTopLevelIds.has(t.id) || removableTopLevelIds.has(t?.data?.parentWorkflowTaskId)).forEach(archiveTaskSnapshot)
  tasks = tasks.filter(t => {
    if (removableTopLevelIds.has(t.id)) return false
    if (removableTopLevelIds.has(t?.data?.parentWorkflowTaskId)) return false
    return true
  })
  persistAndNotify()
}

/**
 * 将长时间未更新的 running 任务标记为异常结束（例如进程崩溃、未正确写回状态）。
 * @param {{ maxAgeMs?: number }} options 默认 24 小时无更新则视为异常
 */
export function reconcileStaleRunningTasks(options = {}) {
  syncTasksFromStorage()
  const maxAgeMs = Number(options.maxAgeMs) > 0 ? Number(options.maxAgeMs) : 24 * 60 * 60 * 1000
  const now = Date.now()
  const staleIds = tasks
    .filter((task) => {
      if (task.status !== 'running') return false
      const updated = new Date(task.updatedAt || task.startedAt || task.createdAt || 0).getTime()
      return Number.isFinite(updated) && now - updated > maxAgeMs
    })
    .map((task) => task.id)
  staleIds.forEach((id) => {
    updateTask(id, {
      status: 'abnormal',
      error: '长时间未更新，已标记为异常结束'
    })
  })
  return staleIds.length
}

/**
 * 初始化并监听跨窗口同步（其他标签页或弹窗的变更）
 */
export function initSync() {
  syncTasksFromStorage()
  try {
    reconcileStaleRunningTasks()
  } catch (e) {
    console.warn('reconcileStaleRunningTasks:', e)
  }
  const onStorage = (e) => {
    if (e?.key === STORAGE_KEY && e?.newValue) {
      try {
        const parsed = parseStoredState(e.newValue)
        tasks = Array.isArray(parsed.tasks) ? parsed.tasks : []
        archivedTasks = Array.isArray(parsed.archivedTasks) ? parsed.archivedTasks : []
        notify()
      } catch (_) {}
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }
}
