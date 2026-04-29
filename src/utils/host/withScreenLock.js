/**
 * withScreenLock - 批量写回时关闭屏幕重排,提速 5-10x
 *
 * WPS COM 每次 range.Text= 都会触发屏幕重绘 + 重新分页,
 * 100 段批量替换可达 0.5-2 秒纯渲染开销。
 *
 * 包一层后:
 *   app.ScreenUpdating = false
 *   activeDoc.Repagination = false
 * 完成后无论成功失败都恢复原值。
 *
 * 用法:
 *   import { withScreenLock } from './host/withScreenLock.js'
 *   withScreenLock(() => {
 *     for (const item of items) {
 *       doc.Range(item.start, item.end).Text = item.text
 *     }
 *   })
 */

import { getApp, getDoc } from './hostBridge.js'

/**
 * 同步版本。
 * @param {Function} fn 必须是同步函数(不返回 Promise)
 * @param {Object} options
 *   - skipRepagination: true 时跳过 Repagination 控制(默认 false)
 *   - onError: 异常回调(不阻塞 finally 恢复)
 */
export function withScreenLock(fn, options = {}) {
  if (typeof fn !== 'function') return undefined

  const app = getApp()
  if (!app) {
    return fn()
  }

  let prevScreen = null
  let prevRepagination = null
  let lockedScreen = false
  let lockedRepagination = false

  try {
    try {
      prevScreen = app.ScreenUpdating
      app.ScreenUpdating = false
      lockedScreen = true
    } catch (_) {}

    if (options.skipRepagination !== true) {
      try {
        const doc = getDoc()
        if (doc) {
          prevRepagination = doc.Repagination
          doc.Repagination = false
          lockedRepagination = true
        }
      } catch (_) {}
    }

    return fn()
  } catch (e) {
    if (typeof options.onError === 'function') {
      try { options.onError(e) } catch (_) {}
    }
    throw e
  } finally {
    if (lockedRepagination) {
      try {
        const doc = getDoc()
        if (doc && prevRepagination !== null) doc.Repagination = prevRepagination
      } catch (_) {}
    }
    if (lockedScreen) {
      try {
        if (prevScreen !== null) app.ScreenUpdating = prevScreen
      } catch (_) {}
    }
  }
}

/**
 * 异步版本。fn 可返回 Promise。
 */
export async function withScreenLockAsync(fn, options = {}) {
  if (typeof fn !== 'function') return undefined

  const app = getApp()
  if (!app) {
    return await fn()
  }

  let prevScreen = null
  let prevRepagination = null
  let lockedScreen = false
  let lockedRepagination = false

  try {
    try {
      prevScreen = app.ScreenUpdating
      app.ScreenUpdating = false
      lockedScreen = true
    } catch (_) {}

    if (options.skipRepagination !== true) {
      try {
        const doc = getDoc()
        if (doc) {
          prevRepagination = doc.Repagination
          doc.Repagination = false
          lockedRepagination = true
        }
      } catch (_) {}
    }

    return await fn()
  } catch (e) {
    if (typeof options.onError === 'function') {
      try { options.onError(e) } catch (_) {}
    }
    throw e
  } finally {
    if (lockedRepagination) {
      try {
        const doc = getDoc()
        if (doc && prevRepagination !== null) doc.Repagination = prevRepagination
      } catch (_) {}
    }
    if (lockedScreen) {
      try {
        if (prevScreen !== null) app.ScreenUpdating = prevScreen
      } catch (_) {}
    }
  }
}

export default {
  withScreenLock,
  withScreenLockAsync
}
