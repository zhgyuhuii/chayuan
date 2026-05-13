import { activateDialogWindow } from './windowActivation.js'

const LOCK_KEY = 'nd_settings_window_lock'
const REQUEST_KEY = 'nd_settings_window_request'
const STALE_MS = 15000
const HEARTBEAT_MS = 5000
export const DEFAULT_SETTINGS_WINDOW_WIDTH = 1120
export const DEFAULT_SETTINGS_WINDOW_HEIGHT = 820

function readStorageJson(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

function writeStorageJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (_) {
    return false
  }
}

function removeStorageKey(key) {
  try {
    window.localStorage.removeItem(key)
  } catch (_) {}
}

function isFreshLock(lock) {
  if (!lock?.instanceId) return false
  return Date.now() - Number(lock.updatedAt || 0) < STALE_MS
}

function focusCurrentWindow() {
  activateDialogWindow()
}

function normalizeQuery(query) {
  const normalized = {}
  const menu = String(query?.menu || '').trim()
  const item = String(query?.item || '').trim()
  // sub:在 menu='general' / 'general-settings' 时指定子菜单(例如 'kb' 表示知识库设置)。
  // 之前白名单只保留 menu 和 item,sub 在窗口间传递的过程中被丢,导致点击"前往设置"
  // 跳到设置页但停留在默认子页,看不到知识库设置。
  const sub = String(query?.sub || '').trim()
  if (menu) normalized.menu = menu
  if (item) normalized.item = item
  if (sub) normalized.sub = sub
  return normalized
}

function sendFocusRequest(ownerInstanceId, query = {}) {
  return writeStorageJson(REQUEST_KEY, {
    targetInstanceId: String(ownerInstanceId || ''),
    query: normalizeQuery(query),
    requestedAt: Date.now()
  })
}

function buildSettingsWindowUrl(query = {}) {
  const normalizedQuery = normalizeQuery(query)
  const queryString = new URLSearchParams(normalizedQuery).toString()
  const routeWithQuery = `/settings${queryString ? `?${queryString}` : ''}`
  let base = ''
  try {
    base = window.Application?.PluginStorage?.getItem('AddinBaseUrl') || ''
  } catch (_) {}
  if (!base) {
    if (window.location.protocol === 'file:') {
      base = window.location.href.replace(/#.*$/, '').replace(/\/index\.html$/i, '')
    } else {
      base = `${window.location.origin}${window.location.pathname}`.replace(/\/index\.html$/i, '')
    }
  }
  const clean = String(base || '')
    .replace(/#.*$/, '')
    .replace(/\/index\.html$/i, '')
    .replace(/\/+$/, '')
  if (clean.startsWith('file:')) {
    return `${clean}/index.html#${routeWithQuery}`
  }
  return `${clean}/#${routeWithQuery}`
}

export function focusExistingSettingsWindow(query = {}) {
  const current = readStorageJson(LOCK_KEY)
  if (!isFreshLock(current)) return false
  sendFocusRequest(current.instanceId, query)
  return true
}

/*
 * 默认按显示器可用尺寸"上下左右各留 100px"打开 — 让窗口尽量铺满屏幕。
 * DEFAULT_SETTINGS_WINDOW_WIDTH/HEIGHT 不再作为目标值使用,只作为屏幕信息缺失时
 * 的兜底参考。下界(MIN_*)对应内容(架构图 + 左侧导航)的最小可读尺寸 — 在
 * 1366×768 这类小笔记本上,"avail - 200" 会得到 1166×528,显得过于压扁;
 * 提到 1080×720 后,小屏上让 WPS 自动 clamp 到屏幕(效果≈全屏),大屏继续走
 * "avail - 200"。
 */
const SAFE_MARGIN_EACH_SIDE = 100   // 用户要求:上下左右各留 100px
const MIN_SETTINGS_W = 1080
const MIN_SETTINGS_H = 720

function fillScreen(axis) {
  const isW = axis === 'w'
  const avail = isW
    ? (window.screen?.availWidth || DEFAULT_SETTINGS_WINDOW_WIDTH)
    : (window.screen?.availHeight || DEFAULT_SETTINGS_WINDOW_HEIGHT)
  const min = isW ? MIN_SETTINGS_W : MIN_SETTINGS_H
  return Math.max(min, avail - SAFE_MARGIN_EACH_SIDE * 2)
}

export function openSettingsWindow(query = {}, options = {}) {
  const normalizedQuery = normalizeQuery(query)
  if (focusExistingSettingsWindow(normalizedQuery)) return true
  const title = String(options?.title || '设置').trim() || '设置'
  const dpr = window.devicePixelRatio || 1
  // 默认尺寸 = availSize - 200(100 左 + 100 右 / 100 上 + 100 下);
  // 显式传 options.width / height 仍然优先,留给特殊场景。
  const width = Number(options?.width) || fillScreen('w')
  const height = Number(options?.height) || fillScreen('h')
  const url = buildSettingsWindowUrl(normalizedQuery)
  if (window.Application?.ShowDialog) {
    window.Application.ShowDialog(
      url,
      title,
      width * dpr,
      height * dpr,
      false
    )
    return true
  }
  window.open(url, '_blank', 'noopener')
  return true
}

export function createSettingsWindowSession(onRequest) {
  const instanceId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  let heartbeatTimer = null
  let storageHandler = null
  let unloadHandler = null
  let active = false

  function writeLock() {
    return writeStorageJson(LOCK_KEY, {
      instanceId,
      updatedAt: Date.now()
    })
  }

  function startHeartbeat() {
    heartbeatTimer = window.setInterval(() => {
      if (!active) return
      writeLock()
    }, HEARTBEAT_MS)
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  function onStorage(event) {
    if (!active || event.key !== REQUEST_KEY) return
    const payload = readStorageJson(REQUEST_KEY)
    if (!payload) return
    if (String(payload.targetInstanceId || '') !== instanceId) return
    focusCurrentWindow()
    onRequest?.(normalizeQuery(payload.query))
  }

  function claimOwnership(initialQuery = {}) {
    const current = readStorageJson(LOCK_KEY)
    if (isFreshLock(current) && current.instanceId !== instanceId) {
      sendFocusRequest(current.instanceId, initialQuery)
      return { ok: false, reason: 'duplicate', ownerInstanceId: current.instanceId }
    }
    if (!writeLock()) {
      return { ok: false, reason: 'storage_unavailable' }
    }
    const confirmed = readStorageJson(LOCK_KEY)
    if (!confirmed || confirmed.instanceId !== instanceId) {
      if (confirmed?.instanceId) {
        sendFocusRequest(confirmed.instanceId, initialQuery)
      }
      return { ok: false, reason: 'duplicate', ownerInstanceId: confirmed?.instanceId || '' }
    }
    active = true
    storageHandler = onStorage
    unloadHandler = releaseOwnership
    window.addEventListener('storage', storageHandler)
    window.addEventListener('beforeunload', unloadHandler)
    startHeartbeat()
    return { ok: true }
  }

  function releaseOwnership() {
    active = false
    stopHeartbeat()
    if (storageHandler) {
      window.removeEventListener('storage', storageHandler)
      storageHandler = null
    }
    if (unloadHandler) {
      window.removeEventListener('beforeunload', unloadHandler)
      unloadHandler = null
    }
    const current = readStorageJson(LOCK_KEY)
    if (current?.instanceId === instanceId) {
      removeStorageKey(LOCK_KEY)
    }
  }

  return {
    claimOwnership,
    releaseOwnership
  }
}
