import { activateDialogWindow } from './windowActivation.js'

const LOCK_KEY = 'nd_ai_assistant_window_lock'
const REQUEST_KEY = 'nd_ai_assistant_window_request'
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
  if (String(query?.from || '').trim() === 'context') {
    normalized.from = 'context'
  }
  if (String(query?.reopen || '').trim() === '1') {
    normalized.reopen = '1'
  }
  const prompt = String(query?.prompt || '').trim()
  if (prompt) {
    normalized.prompt = prompt
  }
  if (String(query?.autoSend || '').trim() === '1') {
    normalized.autoSend = '1'
  }
  const multimodal = String(query?.multimodal || '').trim().toLowerCase()
  if (['image', 'audio', 'video'].includes(multimodal)) {
    normalized.multimodal = multimodal
  }
  return normalized
}

function normalizeAction(action) {
  return action === 'reopen' ? 'reopen' : 'focus'
}

function sendWindowRequest(ownerInstanceId, action = 'focus', query = {}) {
  return writeStorageJson(REQUEST_KEY, {
    targetInstanceId: String(ownerInstanceId || ''),
    action: normalizeAction(action),
    query: normalizeQuery(query),
    requestedAt: Date.now()
  })
}

export function focusExistingAIAssistantWindow(query = {}) {
  const current = readStorageJson(LOCK_KEY)
  if (!isFreshLock(current)) return false
  sendWindowRequest(current.instanceId, 'focus', query)
  return true
}

export function reopenExistingAIAssistantWindow(query = {}) {
  const current = readStorageJson(LOCK_KEY)
  if (!isFreshLock(current)) return false

  const ownerInstanceId = String(current.instanceId || '')
  if (!ownerInstanceId) return false

  sendWindowRequest(ownerInstanceId, 'reopen', query)
  // 立即释放旧锁，让新窗口可以同步打开并接管所有权。
  removeStorageKey(LOCK_KEY)
  return true
}

export function createAIAssistantWindowSession(onRequest) {
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
    const action = normalizeAction(payload.action)
    if (action === 'focus') {
      focusCurrentWindow()
    }
    onRequest?.({
      action,
      query: normalizeQuery(payload.query)
    })
  }

  function claimOwnership(initialQuery = {}) {
    const current = readStorageJson(LOCK_KEY)
    const allowReopen = String(initialQuery?.reopen || '').trim() === '1'
    if (isFreshLock(current) && current.instanceId !== instanceId && !allowReopen) {
      sendWindowRequest(current.instanceId, 'focus', initialQuery)
      return { ok: false, reason: 'duplicate', ownerInstanceId: current.instanceId }
    }
    if (!writeLock()) {
      return { ok: false, reason: 'storage_unavailable' }
    }
    const confirmed = readStorageJson(LOCK_KEY)
    if (!confirmed || confirmed.instanceId !== instanceId) {
      if (confirmed?.instanceId) {
        sendWindowRequest(confirmed.instanceId, 'focus', initialQuery)
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
