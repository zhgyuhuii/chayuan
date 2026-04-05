const LOCK_PREFIX = 'nd_task_progress_window_'
const FOCUS_REQUEST_KEY = 'nd_task_progress_window_focus_request'
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
  if (!lock || !lock.instanceId) return false
  const updatedAt = Number(lock.updatedAt || 0)
  return Date.now() - updatedAt < STALE_MS
}

function focusCurrentWindow() {
  try {
    if (window.focus) window.focus()
  } catch (_) {}
}

export function createTaskProgressWindowSession(taskId) {
  const normalizedTaskId = String(taskId || '')
  const lockKey = `${LOCK_PREFIX}${normalizedTaskId}`
  const instanceId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  let heartbeatTimer = null
  let storageHandler = null
  let unloadHandler = null
  let active = false

  function writeLock() {
    return writeStorageJson(lockKey, {
      taskId: normalizedTaskId,
      instanceId,
      updatedAt: Date.now()
    })
  }

  function requestExistingWindowFocus(targetInstanceId) {
    writeStorageJson(FOCUS_REQUEST_KEY, {
      taskId: normalizedTaskId,
      targetInstanceId: String(targetInstanceId || ''),
      requesterInstanceId: instanceId,
      requestedAt: Date.now()
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
    if (!active) return
    if (event.key !== FOCUS_REQUEST_KEY) return
    const payload = readStorageJson(FOCUS_REQUEST_KEY)
    if (!payload) return
    if (String(payload.taskId || '') !== normalizedTaskId) return
    if (String(payload.targetInstanceId || '') !== instanceId) return
    focusCurrentWindow()
  }

  function claimOwnership() {
    if (!normalizedTaskId) return { ok: false, reason: 'missing_task_id' }
    const current = readStorageJson(lockKey)
    if (isFreshLock(current) && current.instanceId !== instanceId) {
      requestExistingWindowFocus(current.instanceId)
      return { ok: false, reason: 'duplicate', ownerInstanceId: current.instanceId }
    }
    if (!writeLock()) {
      return { ok: false, reason: 'storage_unavailable' }
    }
    const confirmed = readStorageJson(lockKey)
    if (!confirmed || confirmed.instanceId !== instanceId) {
      if (confirmed?.instanceId) {
        requestExistingWindowFocus(confirmed.instanceId)
      }
      return { ok: false, reason: 'duplicate', ownerInstanceId: confirmed?.instanceId || '' }
    }
    active = true
    storageHandler = onStorage
    window.addEventListener('storage', storageHandler)
    unloadHandler = releaseOwnership
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
    const current = readStorageJson(lockKey)
    if (current?.instanceId === instanceId) {
      removeStorageKey(lockKey)
    }
  }

  return {
    claimOwnership,
    releaseOwnership,
    focusCurrentWindow
  }
}
