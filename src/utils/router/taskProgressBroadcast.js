/**
 * taskProgressBroadcast — 跨窗口任务进度广播
 *
 * v2 计划 P1-B10:WPS 加载项有多个 dialog 窗口(主 task pane / 助手对话框 / 设置等),
 * 任务进度需要跨窗口同步;localStorage 太慢,直接用 BroadcastChannel。
 *
 * API:
 *   import { publishProgress, subscribeProgress } from '...'
 *
 *   publishProgress({ taskId, kind: 'progress', current, total, stage, ... })
 *   const unsub = subscribeProgress(msg => { ... })
 *
 * 特性:
 *   - BroadcastChannel API(原生,跨同 origin tab/iframe/popup 通信)
 *   - 不可用时 fallback 到 storage event(慢但兼容)
 *   - 节流 100ms,避免高频进度淹没
 *   - taskId 过滤 helper:onlyTask(taskId, fn) → wrapped subscriber
 */

const CHANNEL_NAME = 'chayuan-task-progress'
const FALLBACK_KEY = 'chayuanTaskProgressBroadcast'
const THROTTLE_MS = 100

let _channel = null
let _useFallback = false
const _lastByTask = new Map()

function ensureChannel() {
  if (_channel || _useFallback) return
  if (typeof window === 'undefined') return
  if (typeof BroadcastChannel === 'function') {
    try {
      _channel = new BroadcastChannel(CHANNEL_NAME)
      return
    } catch { /* fallthrough */ }
  }
  _useFallback = true
}

/** 发送进度。high-frequency caller 自动 throttle。 */
export function publishProgress(message = {}) {
  if (!message || !message.taskId) return false
  const now = Date.now()
  const last = _lastByTask.get(message.taskId) || 0
  // 终态(done/error/cancelled)不节流
  const terminal = ['done', 'error', 'cancelled'].includes(message.kind)
  if (!terminal && now - last < THROTTLE_MS) return false
  _lastByTask.set(message.taskId, now)

  const payload = {
    ...message,
    _ts: now
  }
  ensureChannel()
  if (_channel) {
    try { _channel.postMessage(payload) } catch (_) {}
    return true
  }
  // fallback: localStorage 触发 storage event
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(payload))
  } catch (_) { return false }
  return true
}

/**
 * 订阅进度。返回 unsubscribe。
 *   subscribeProgress(msg => { ... })
 */
export function subscribeProgress(fn) {
  if (typeof fn !== 'function') return () => {}
  ensureChannel()

  if (_channel) {
    const handler = (e) => {
      try { fn(e.data) } catch (_) {}
    }
    _channel.addEventListener('message', handler)
    return () => {
      try { _channel.removeEventListener('message', handler) } catch (_) {}
    }
  }
  // fallback
  if (typeof window === 'undefined') return () => {}
  const handler = (e) => {
    if (e.key !== FALLBACK_KEY || !e.newValue) return
    try { fn(JSON.parse(e.newValue)) } catch (_) {}
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}

/** 只关心特定 taskId 的便捷封装。 */
export function onlyTask(taskId, fn) {
  const id = String(taskId || '')
  return subscribeProgress(msg => {
    if (msg && msg.taskId === id) fn(msg)
  })
}

/** 关闭 channel(测试或卸载时用)。 */
export function closeChannel() {
  if (_channel) {
    try { _channel.close() } catch (_) {}
    _channel = null
  }
  _useFallback = false
  _lastByTask.clear()
}

export default {
  publishProgress,
  subscribeProgress,
  onlyTask,
  closeChannel
}
