/**
 * workflowProgressChannel — 工作流执行事件的跨窗口广播
 *
 * 解决问题:
 *   多个 dialog 窗口都想看工作流进度。当前 workflowRunner 的事件只在
 *   启动它的窗口可见,其他窗口无法订阅。
 *
 * 协议:
 *   - 用 BroadcastChannel('chayuan-workflow-progress')
 *   - 每个事件都带 instanceId,订阅方可按 id 过滤
 *   - 发送侧节流(同 instance 同 nodeId 的 progress 事件 100ms throttle)
 *
 * 事件类型(与 plan-workflow-orchestration §5.4 对应):
 *   workflow:start / workflow:done / workflow:fail / workflow:cancel /
 *   workflow:pause / workflow:resume /
 *   node:ready / node:run / node:progress / node:done /
 *   node:error / node:retry
 *
 * 用法(发送侧):
 *   import { emit } from '@/utils/workflow/workflowProgressChannel.js'
 *   emit('node:run', { instanceId, nodeId, startedAt })
 *
 * 用法(订阅侧):
 *   import { onEvent, onlyInstance } from '...'
 *   const unsub = onlyInstance(instanceId, ev => { ... })
 */

const CHANNEL = 'chayuan-workflow-progress'
const THROTTLE_MS = 100

const VALID_EVENTS = new Set([
  'workflow:start', 'workflow:done', 'workflow:fail',
  'workflow:cancel', 'workflow:pause', 'workflow:resume',
  'node:ready', 'node:run', 'node:progress',
  'node:done', 'node:error', 'node:retry'
])

let _channel = null
let _useFallback = false
const _localListeners = new Set()
const _lastEmitAt = new Map()  // `${instanceId}:${nodeId}:${eventType}` → ts

function ensureChannel() {
  if (_channel || _useFallback) return _channel
  if (typeof window === 'undefined' || typeof BroadcastChannel !== 'function') {
    _useFallback = true
    return null
  }
  try {
    _channel = new BroadcastChannel(CHANNEL)
    _channel.addEventListener('message', e => {
      for (const fn of _localListeners) {
        try { fn(e.data) } catch (_) {}
      }
    })
  } catch { _useFallback = true }
  return _channel
}

/**
 * Emit 一个工作流事件。
 *   eventType:见 VALID_EVENTS
 *   payload:{ instanceId(必填), nodeId?, ... }
 */
export function emit(eventType, payload = {}) {
  if (!VALID_EVENTS.has(eventType)) {
    if (typeof console !== 'undefined') console.warn(`[workflowProgressChannel] 未知事件: ${eventType}`)
    return false
  }
  if (!payload?.instanceId) return false

  // 节流(progress 事件高频)
  if (eventType === 'node:progress') {
    const key = `${payload.instanceId}:${payload.nodeId || ''}:progress`
    const last = _lastEmitAt.get(key) || 0
    if (Date.now() - last < THROTTLE_MS) return false
    _lastEmitAt.set(key, Date.now())
  }

  const message = {
    eventType,
    timestamp: Date.now(),
    ...payload
  }

  // 本地订阅者(同窗口)
  for (const fn of _localListeners) {
    try { fn(message) } catch (_) {}
  }

  // 跨窗口
  const ch = ensureChannel()
  if (ch) {
    try { ch.postMessage(message) } catch (_) {}
  }
  return true
}

/**
 * 订阅所有事件。返回 unsubscribe。
 */
export function onEvent(fn) {
  if (typeof fn !== 'function') return () => {}
  ensureChannel()  // 确保跨窗口监听已挂上
  _localListeners.add(fn)
  return () => _localListeners.delete(fn)
}

/**
 * 只关心特定 instanceId 的事件。
 */
export function onlyInstance(instanceId, fn) {
  const id = String(instanceId || '')
  return onEvent(message => {
    if (message?.instanceId === id) fn(message)
  })
}

/**
 * 关心特定事件类型的所有实例。
 */
export function onlyEvent(eventType, fn) {
  return onEvent(message => {
    if (message?.eventType === eventType) fn(message)
  })
}

/**
 * 关闭 channel(测试用)。
 */
export function close() {
  if (_channel) {
    try { _channel.close() } catch (_) {}
    _channel = null
  }
  _useFallback = false
  _localListeners.clear()
  _lastEmitAt.clear()
}

export const EVENTS = Array.from(VALID_EVENTS)

export default {
  emit,
  onEvent,
  onlyInstance,
  onlyEvent,
  close,
  EVENTS
}
