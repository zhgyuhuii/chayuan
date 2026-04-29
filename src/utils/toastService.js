/**
 * toastService — 全局 Toast 通知服务
 *
 * 用法:
 *   import toast from '@/utils/toastService.js'
 *   toast.success('已保存')
 *   toast.error('保存失败', { detail: '网络断开' })
 *   toast.info('进化系统已启动')
 *   toast.warn('即将达到配额上限')
 *
 * UI 通过 ToastContainer.vue 订阅本服务并渲染。
 */

const _listeners = new Set()
let _seq = 0

const DEFAULT_TIMEOUT = 4000
const MAX_TOASTS = 5

const _active = []

function notify() {
  const snapshot = _active.slice()
  for (const fn of _listeners) {
    try { fn(snapshot) } catch (_) {}
  }
}

function makeToast(level, message, options = {}) {
  const id = `toast_${++_seq}_${Date.now().toString(36)}`
  const toast = {
    id,
    level,
    message: String(message || ''),
    detail: String(options.detail || ''),
    actionLabel: options.actionLabel || '',
    onAction: typeof options.onAction === 'function' ? options.onAction : null,
    timeout: typeof options.timeout === 'number' ? options.timeout : DEFAULT_TIMEOUT,
    createdAt: Date.now()
  }
  _active.unshift(toast)
  if (_active.length > MAX_TOASTS) _active.length = MAX_TOASTS
  notify()
  if (toast.timeout > 0) {
    setTimeout(() => dismiss(id), toast.timeout)
  }
  return id
}

export function success(message, options) { return makeToast('success', message, options) }
export function info(message, options)    { return makeToast('info',    message, options) }
export function warn(message, options)    { return makeToast('warn',    message, options) }
export function error(message, options)   { return makeToast('error',   message, { ...options, timeout: options?.timeout ?? 6000 }) }

export function dismiss(id) {
  const idx = _active.findIndex(t => t.id === id)
  if (idx < 0) return false
  _active.splice(idx, 1)
  notify()
  return true
}

export function dismissAll() {
  _active.length = 0
  notify()
}

export function list() { return _active.slice() }

export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {}
  _listeners.add(fn)
  // 立即调一次,让 UI 拿到当前状态
  try { fn(_active.slice()) } catch (_) {}
  return () => _listeners.delete(fn)
}

/**
 * 把 reportError 的输出也接入 toast(便于统一错误提示)。
 *   const detach = bindReportError()
 */
export function bindReportError() {
  if (typeof window === 'undefined') return () => {}
  const handler = (e) => {
    if (!e?.detail) return
    const { title, error: err } = e.detail
    error(String(title || '错误'), {
      detail: String(err?.message || err || ''),
      timeout: 8000
    })
  }
  window.addEventListener('chayuan:report-error', handler)
  return () => window.removeEventListener('chayuan:report-error', handler)
}

export default {
  success,
  info,
  warn,
  error,
  dismiss,
  dismissAll,
  list,
  subscribe,
  bindReportError
}
