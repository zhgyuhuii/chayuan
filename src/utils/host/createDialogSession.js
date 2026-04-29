/**
 * createDialogSession — 5 套 *WindowManager 的统一收敛入口
 *
 * v2 计划 P3「5 套 *WindowManager 收敛为 createDialogSession」。
 * 不动现有的 *WindowManager,提供一个新的统一入口供新 dialog 使用,
 * 旧 dialog 逐步迁移。
 *
 * 一个 session 表示"打开一个 dialog 窗口 + 监听其状态 + 在它关闭时清理"。
 * 实例间是独立的,可同时打开多个。
 *
 * 用法:
 *   const session = createDialogSession({
 *     route: '/form-edit-dialog',
 *     query: { bookmarkId: 'xxx' },
 *     width: 920, height: 680,
 *     onMessage: (data) => { ... },     // 子窗口 postMessage 上来
 *     onClose: () => { ... }
 *   })
 *
 *   session.send({ kind: 'init', payload })  // 向子窗口发消息
 *   session.close()                           // 关掉
 *   session.url                                // 当前 URL
 */

import { showAdaptiveDialog } from './showAdaptiveDialog.js'

let _sessionSeq = 0
const _sessions = new Map()

/**
 * 创建一个新的 dialog session。
 */
export function createDialogSession(options = {}) {
  const id = `session_${++_sessionSeq}_${Date.now().toString(36)}`
  const route = String(options.route || '/dialog')
  const query = options.query || {}

  const queryString = new URLSearchParams({ ...query, _session: id }).toString()
  const url = (typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}#${route}?${queryString}`
    : `${route}?${queryString}`)

  // postMessage 路由(window.opener / parent / 自身 BroadcastChannel 任一都行)
  const onMessage = options.onMessage
  const messageHandler = onMessage
    ? (e) => {
        // 简单过滤:消息中带 _session 字段且匹配
        const data = e?.data
        if (data && typeof data === 'object' && data._session === id) {
          try { onMessage(data) } catch (_) {}
        }
      }
    : null
  if (messageHandler && typeof window !== 'undefined') {
    window.addEventListener('message', messageHandler)
  }

  // 通过 hostBridge 的 showAdaptiveDialog 打开;它内部会 fallback 到 window.Application.ShowDialog
  let opened = false
  try {
    showAdaptiveDialog({
      url,
      title: String(options.title || '察元'),
      width: Number(options.width) || 800,
      height: Number(options.height) || 600,
      modal: options.modal === true
    })
    opened = true
  } catch (e) {
    if (typeof console !== 'undefined') {
      console.warn(`[createDialogSession] showAdaptiveDialog 失败,fallback window.open:`, e?.message || e)
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', `width=${options.width || 800},height=${options.height || 600}`)
      opened = true
    }
  }

  const session = {
    id,
    route,
    url,
    isOpen: opened,
    send(payload) {
      // BroadcastChannel 跨窗口
      try {
        if (typeof BroadcastChannel === 'function') {
          const ch = new BroadcastChannel(`chayuan-session-${id}`)
          ch.postMessage(payload)
          ch.close()
          return true
        }
      } catch (_) {}
      // fallback: window.opener postMessage(子窗口往父窗口反向)
      try {
        if (typeof window !== 'undefined' && window.opener) {
          window.opener.postMessage({ ...payload, _session: id }, '*')
          return true
        }
      } catch (_) {}
      return false
    },
    close() {
      session.isOpen = false
      if (messageHandler && typeof window !== 'undefined') {
        window.removeEventListener('message', messageHandler)
      }
      _sessions.delete(id)
      if (typeof options.onClose === 'function') {
        try { options.onClose() } catch (_) {}
      }
    }
  }

  _sessions.set(id, session)
  return session
}

/** 当前活跃 session 数量(给 doctor / 调试看)。 */
export function listActiveSessions() {
  return Array.from(_sessions.values()).map(s => ({ id: s.id, route: s.route, isOpen: s.isOpen }))
}

export function getSession(id) {
  return _sessions.get(String(id || '')) || null
}

export default {
  createDialogSession,
  listActiveSessions,
  getSession
}
