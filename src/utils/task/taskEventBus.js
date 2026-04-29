/**
 * taskEventBus — 跨窗口任务事件总线(T-1.2)
 *
 * 复用 W1.3 workflowProgressChannel 的模式,但作用对象是「任务」(不限于工作流)。
 * 任何 runner 都可 emit;任何 UI / 服务可订阅。
 *
 * 事件类型:
 *   task:created / task:queued / task:started / task:progress /
 *   task:paused / task:resumed / task:completed / task:failed /
 *   task:cancelled / task:archived / task:starred / task:retried
 *
 * 节流:`task:progress` 100ms 同 taskId 节流。
 */

const CHANNEL = 'chayuan-task-events'
const PROGRESS_THROTTLE_MS = 100

const VALID = new Set([
  'task:created', 'task:queued', 'task:started', 'task:progress',
  'task:paused', 'task:resumed', 'task:completed', 'task:failed',
  'task:cancelled', 'task:archived', 'task:starred', 'task:retried'
])

let _channel = null
const _localListeners = new Set()
const _lastEmit = new Map()  // taskId → ts(progress)

function ensureChannel() {
  if (_channel) return _channel
  if (typeof window === 'undefined' || typeof BroadcastChannel !== 'function') return null
  try {
    _channel = new BroadcastChannel(CHANNEL)
    _channel.addEventListener('message', e => {
      for (const fn of _localListeners) {
        try { fn(e.data) } catch (_) {}
      }
    })
  } catch { /* fallback to local-only */ }
  return _channel
}

export function emit(eventType, payload = {}) {
  if (!VALID.has(eventType)) return false
  if (!payload?.taskId) return false

  if (eventType === 'task:progress') {
    const last = _lastEmit.get(payload.taskId) || 0
    if (Date.now() - last < PROGRESS_THROTTLE_MS) return false
    _lastEmit.set(payload.taskId, Date.now())
  }

  const message = { eventType, timestamp: Date.now(), ...payload }
  for (const fn of _localListeners) {
    try { fn(message) } catch (_) {}
  }
  const ch = ensureChannel()
  if (ch) {
    try { ch.postMessage(message) } catch (_) {}
  }
  return true
}

export function onEvent(fn) {
  if (typeof fn !== 'function') return () => {}
  ensureChannel()
  _localListeners.add(fn)
  return () => _localListeners.delete(fn)
}

export function onlyTask(taskId, fn) {
  const id = String(taskId || '')
  return onEvent(msg => {
    if (msg?.taskId === id) fn(msg)
  })
}

export function onlyKind(kind, fn) {
  return onEvent(msg => {
    if (msg?.kind === kind) fn(msg)
  })
}

export function onlyEvent(eventType, fn) {
  return onEvent(msg => {
    if (msg?.eventType === eventType) fn(msg)
  })
}

export function close() {
  if (_channel) { try { _channel.close() } catch (_) {} _channel = null }
  _localListeners.clear()
  _lastEmit.clear()
}

export const EVENTS = Array.from(VALID)

export default {
  emit,
  onEvent,
  onlyTask,
  onlyKind,
  onlyEvent,
  close,
  EVENTS
}
