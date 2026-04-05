import { activateDialogWindow } from './windowActivation.js'

const LOCK_KEY = 'nd_settings_window_lock'
const REQUEST_KEY = 'nd_settings_window_request'
const STALE_MS = 15000
const HEARTBEAT_MS = 5000

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
  if (menu) normalized.menu = menu
  if (item) normalized.item = item
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

export function openSettingsWindow(query = {}, options = {}) {
  const normalizedQuery = normalizeQuery(query)
  if (focusExistingSettingsWindow(normalizedQuery)) return true
  const title = String(options?.title || '设置').trim() || '设置'
  const width = Number(options?.width) || 800
  const height = Number(options?.height) || 1000
  const url = buildSettingsWindowUrl(normalizedQuery)
  if (window.Application?.ShowDialog) {
    window.Application.ShowDialog(
      url,
      title,
      width * (window.devicePixelRatio || 1),
      height * (window.devicePixelRatio || 1),
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
