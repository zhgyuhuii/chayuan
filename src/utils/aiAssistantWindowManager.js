import { activateDialogWindow } from './windowActivation.js'

const LOCK_KEY = 'nd_ai_assistant_window_lock'
const REQUEST_KEY = 'nd_ai_assistant_window_request'
const STALE_MS = 15000
const HEARTBEAT_MS = 5000

// 形态交接（浮窗↔停靠）期间写在锁上的占位 instanceId：
// 旧实例心跳见到 handover 标记只暂不上写，新实例凭 takeOverHandover 认领接管。
const HANDOVER_INSTANCE_ID = '__ai_assistant_handover__'

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
  const kbMode = String(query?.kbMode || '').trim().toLowerCase()
  if (['verify', 'summarize', 'qa'].includes(kbMode)) {
    normalized.kbMode = kbMode
  }
  return normalized
}

function normalizeLockMode(mode) {
  return mode === 'taskpane' ? 'taskpane' : 'float'
}

function isHandoverLock(lock) {
  return !!lock && lock.handover === true && lock.instanceId === HANDOVER_INSTANCE_ID
}

function normalizeAction(action) {
  return action === 'reopen' || action === 'close' ? action : 'focus'
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

export function createAIAssistantWindowSession(onRequest, options = {}) {
  const instanceId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const heartbeatMs = Number(options.heartbeatMs) > 0 ? Number(options.heartbeatMs) : HEARTBEAT_MS
  let lockMode = normalizeLockMode(options.mode)
  let heartbeatTimer = null
  let storageHandler = null
  let unloadHandler = null
  let active = false

  // 认领/接管时无条件上写（调用方已通过重复检查）
  function writeLockForce() {
    return writeStorageJson(LOCK_KEY, {
      instanceId,
      updatedAt: Date.now(),
      mode: lockMode
    })
  }

  // 心跳上写：交接期间让位保留标记；被真实接管则彻底退场，避免旧窗口反复覆盖新实例
  function heartbeatWriteLock() {
    if (!active) return
    const current = readStorageJson(LOCK_KEY)
    if (current && current.instanceId !== instanceId && isFreshLock(current)) {
      if (isHandoverLock(current)) return
      releaseOwnership()
      return
    }
    writeLockForce()
  }

  function startHeartbeat() {
    heartbeatTimer = window.setInterval(heartbeatWriteLock, heartbeatMs)
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

  function claimOwnership(initialQuery = {}, claimOptions = {}) {
    lockMode = normalizeLockMode(claimOptions.mode)
    const allowReopen = String(initialQuery?.reopen || '').trim() === '1'
    const current = readStorageJson(LOCK_KEY)
    const foreign = current && current.instanceId !== instanceId ? current : null
    // 停靠面板由 dockManager 在交接事务内创建，凭 handover 标记接管锁
    const handoverTakeover = !!(foreign && isHandoverLock(foreign) && claimOptions.takeOverHandover === true)
    if (foreign && !handoverTakeover && !allowReopen && isFreshLock(foreign)) {
      sendWindowRequest(foreign.instanceId, 'focus', initialQuery)
      return { ok: false, reason: 'duplicate', ownerInstanceId: foreign.instanceId }
    }
    if (!writeLockForce()) {
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

export { HANDOVER_INSTANCE_ID }

/**
 * 读取当前 AI 助手单实例锁（无锁/损坏返回 null）。
 */
export function readAIAssistantLock() {
  return readStorageJson(LOCK_KEY)
}

/**
 * 形态切换事务开始：把锁标记为“交接中”。
 * 旧实例（浮窗/旧面板）的心跳见到 handover 标记会暂不上写；
 * 新实例（CreateTaskPane 的面板页 / 新浮窗）凭 takeOverHandover 或 reopen 认领。
 * @returns {{ ok: boolean, previous: object|null }} previous 为交接前的锁记录，失败回滚用
 */
export function markAIAssistantHandover(mode = 'taskpane') {
  const previous = readStorageJson(LOCK_KEY)
  const ok = writeStorageJson(LOCK_KEY, {
    instanceId: HANDOVER_INSTANCE_ID,
    handover: true,
    mode: normalizeLockMode(mode),
    updatedAt: Date.now()
  })
  return { ok, previous }
}

/**
 * 交接失败回滚：恢复原持有者的锁记录（原持有者心跳随即自然续写）。
 * previous 无效（本来就没有持有者）时直接清锁。
 */
export function restoreAIAssistantLock(previous) {
  if (previous && previous.instanceId && !isHandoverLock(previous)) {
    return writeStorageJson(LOCK_KEY, {
      ...previous,
      updatedAt: Date.now()
    })
  }
  removeStorageKey(LOCK_KEY)
  return false
}

/**
 * 请求某个持有者实例自行关闭（dockTo 原子交接的“先建后关”收尾步骤）。
 */
export function sendAIAssistantCloseRequest(ownerInstanceId) {
  if (!ownerInstanceId || ownerInstanceId === HANDOVER_INSTANCE_ID) return false
  return writeStorageJson(REQUEST_KEY, {
    targetInstanceId: String(ownerInstanceId),
    action: 'close',
    query: {},
    requestedAt: Date.now()
  })
}
