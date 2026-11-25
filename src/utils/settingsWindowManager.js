import { activateDialogWindow } from './windowActivation.js'
import { detectAddonType } from './host/hostType.js'

const LOCK_KEY = 'nd_settings_window_lock'
const REQUEST_KEY = 'nd_settings_window_request'
// 「撤销+重开」通道（2026-11-21 macOS 真机实证）：设置窗口开着但被压在 WPS 文档
// 窗口后面时，焦点通道（window.focus）在 macOS CEF 无法把 ShowDialog 原生窗口带到
// 前台，activateDialogWindow 的 restoreHostWindow 反而把文档窗口抬到更高一层——
// 表现为「点击打开设置永远无反应」。改为写 revoke 让旧窗口自行关闭并重开新窗口
// （WPS 前台时新开的 ShowDialog 必然置顶）。代价：可见旧窗口的未保存草稿会丢——
// 但藏在后面的窗口本来就看不见，无感知损失。
const REVOKE_KEY = 'nd_settings_window_revoke'
const STALE_MS = 15000
const HEARTBEAT_MS = 5000
const REVOKE_TTL_MS = 3000
const REOPEN_DELAY_MS = 400
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
  // host:打开方所在宿主(wps/et/wpp)。设置窗口是独立 ShowDialog webview,其内
  // window.Application 注入时机不可靠——由调用方(ribbon/助手面板,宿主判定可靠)
  // 显式传入,设置页据此对助手设置清单做宿主分流。
  const host = String(query?.host || '').trim().toLowerCase()
  if (menu) normalized.menu = menu
  if (item) normalized.item = item
  if (sub) normalized.sub = sub
  if (host) normalized.host = host
  return normalized
}

function sendFocusRequest(ownerInstanceId, query = {}) {
  return writeStorageJson(REQUEST_KEY, {
    targetInstanceId: String(ownerInstanceId || ''),
    query: normalizeQuery(query),
    requestedAt: Date.now()
  })
}

function isMacPlatform() {
  try {
    return /Mac/i.test(String((typeof navigator !== 'undefined' && navigator.platform) || ''))
  } catch (_) {
    return false
  }
}

function writeRevoke(targetInstanceId) {
  return writeStorageJson(REVOKE_KEY, {
    targetInstanceId: String(targetInstanceId || ''),
    at: Date.now()
  })
}

// 该实例是否被最近一次 revoke 撤销（revoke 窗口期内新窗口可接管旧锁）
function isRevoked(targetInstanceId) {
  const revoke = readStorageJson(REVOKE_KEY)
  if (!revoke) return false
  if (String(revoke.targetInstanceId || '') !== String(targetInstanceId || '')) return false
  return Date.now() - Number(revoke.at || 0) < REVOKE_TTL_MS
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

// 弹出设置窗口的原语（首开与 revoke 重开共用）：title/尺寸/URL 构造 + ShowDialog
// 或 window.open 回退。尺寸规则见 openSettingsWindow 内注释（真常量，唯一真源）。
function showSettingsDialog(normalizedQuery, options = {}) {
  const title = String(options?.title || '设置').trim() || '设置'
  const width = Number(options?.width) || 1000
  const height = Number(options?.height) || 680
  const url = buildSettingsWindowUrl(normalizedQuery)
  if (window.Application?.ShowDialog) {
    window.Application.ShowDialog(
      url,
      title,
      width,
      height,
      false
    )
    return
  }
  window.open(url, '_blank', 'noopener')
}

// macOS「撤销+重开」：写 revoke 让锁主旧窗口自关，稍后重开新窗口。
// 重开前复核锁：若期间已有别的窗口接管（如另一入口先开了），跳过避免双窗。
function scheduleSettingsReopen(revokedInstanceId, normalizedQuery, options = {}) {
  window.setTimeout(() => {
    try {
      const current = readStorageJson(LOCK_KEY)
      if (current && isFreshLock(current) && current.instanceId !== revokedInstanceId) return
      showSettingsDialog(normalizedQuery, options)
    } catch (_) { /* 重开失败不阻塞调用方 */ }
  }, REOPEN_DELAY_MS)
}

export function openSettingsWindow(query = {}, options = {}) {
  // host 默认取调用方 webview 的宿主判定(调用方可显式覆盖)。新窗口走 URL 参数、
  // 已开窗口走焦点请求,两条通道都会把 host 带给设置窗口。
  const normalizedQuery = {
    host: detectAddonType(),
    ...normalizeQuery(query)
  }
  const current = readStorageJson(LOCK_KEY)
  if (isFreshLock(current)) {
    if (isMacPlatform()) {
      // macOS：焦点通道抬不动 ShowDialog 原生窗口（见文件头 REVOKE_KEY 注释），
      // 走「撤销+重开」。revokedInstanceId 备给重开复核。
      const revokedInstanceId = current.instanceId
      writeRevoke(revokedInstanceId)
      scheduleSettingsReopen(revokedInstanceId, normalizedQuery, options)
      return true
    }
    sendFocusRequest(current.instanceId, normalizedQuery)
    return true
  }
  // 2026-06-03:设置窗口尺寸的【唯一真源】。全部 7 个入口都走本方法。
  //
  // 【为什么从对话框 / 从顶部 ribbon 打开尺寸不一致】
  //   ribbon、AI 对话框是各自独立的 webview,WPS 给它们不同的缩放比,
  //   所以同一行代码里的 window.devicePixelRatio / screen.availWidth 在不同 webview
  //   取值不同。任何「× dpr」「÷ dpr」「× screen.availWidth」的算法都会随调用方 webview
  //   变化 → 两个入口算出不同的数 → 窗口大小不一致。这就是反复修都修不一致的根。
  //
  // 【修法】传一个【真常量】——不乘 dpr、不读 screen。每个入口传给 ShowDialog 的
  //   数字完全相同,窗口自然一致。绝对尺寸取一个四周留白、保存按钮可见的值。
  showSettingsDialog(normalizedQuery, options)
  return true
}

export function createSettingsWindowSession(onRequest, onRevoke) {
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
    if (!active) return
    if (event.key === REVOKE_KEY) {
      // 被 openSettingsWindow 的「撤销+重开」撤掉：释放锁并自关，给新窗口让路。
      // 新窗口接管后本实例的心跳/监听全部停止，不会和新窗口抢锁。
      const revoke = readStorageJson(REVOKE_KEY)
      if (!revoke || String(revoke.targetInstanceId || '') !== instanceId) return
      releaseOwnership()
      onRevoke?.()
      return
    }
    if (event.key !== REQUEST_KEY) return
    const payload = readStorageJson(REQUEST_KEY)
    if (!payload) return
    if (String(payload.targetInstanceId || '') !== instanceId) return
    focusCurrentWindow()
    onRequest?.(normalizeQuery(payload.query))
  }

  function claimOwnership(initialQuery = {}) {
    const current = readStorageJson(LOCK_KEY)
    if (isFreshLock(current) && current.instanceId !== instanceId) {
      // revoke 窗口期内允许接管：旧锁可能是死窗口（WPS 关窗不触发 beforeunload）
      // 留下的新鲜锁，不接管会让重开的新窗口 80ms 自关 → 依旧「打不开」。
      if (!isRevoked(current.instanceId)) {
        sendFocusRequest(current.instanceId, initialQuery)
        return { ok: false, reason: 'duplicate', ownerInstanceId: current.instanceId }
      }
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
