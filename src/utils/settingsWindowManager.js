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

export function openSettingsWindow(query = {}, options = {}) {
  const normalizedQuery = normalizeQuery(query)
  if (focusExistingSettingsWindow(normalizedQuery)) return true
  const title = String(options?.title || '设置').trim() || '设置'
  // 2026-06-03:设置窗口尺寸的【唯一真源】。全部 7 个入口(AI 助手左下角设置 /
  // 顶部 ribbon 设置 / 助手设置 / 知识库设置 / 模型设置 / Popup 助手设置)都走本方法。
  //
  // 【为什么之前两个入口尺寸不一致】
  //   - ShowDialog 的宽高参数 = 目标窗口的 CSS 像素,WPS 内部自己处理 DPI 缩放
  //     (见 host/showAdaptiveDialog.js,它故意不乘 dpr)。
  //   - 但 ribbon webview 与对话框 webview 被 WPS 用了不同的缩放比,
  //     window.devicePixelRatio / screen.availWidth(CSS 像素)在两个 webview 里取值不同。
  //   - 所以旧代码 `800 * dpr`:对话框 webview(dpr≈2)算出 1600 → 全屏遮挡保存;
  //     ribbon webview(dpr≈1)算出 800 → 超小。同源不同值,无法统一。
  //
  // 【ShowDialog 真实行为(由实测三组现象反推)】
  //   实际物理窗口 = 传入参数 × 调用方 webview 的 devicePixelRatio。
  //     旧 `800×dpr`:对话框(dpr≈2)→1600 再被 ×2 → 全屏;ribbon(dpr≈1)→800 → 超小。
  //     若传"物理值"不除 dpr:对话框又被 ×2 → 太高/太大;ribbon 正常。
  //   (这也是 host/showAdaptiveDialog.js 传 availWidth(CSS)=物理/dpr 能跨 webview 一致的原因:
  //    它传 CSS 像素,ShowDialog ×dpr 正好抵消。)
  //
  // 【修法】
  //   1) 用唯一跨 webview 不变的【物理屏尺寸】= availWidth(CSS) × dpr 做 clamp,得到目标物理尺寸。
  //   2) 参数 = 目标物理尺寸 ÷ dpr。ShowDialog 再 ×dpr 还原成同一物理窗口 → 两入口完全一致。
  //   留边不全屏、有下限不过小。
  const dpr = window.devicePixelRatio || 1
  const physAvailW = (Number(window.screen?.availWidth) || 1600) * dpr
  const physAvailH = (Number(window.screen?.availHeight) || 900) * dpr
  const MARGIN = 160 // 物理像素:每边各留约 80px,保证四周有空隙、保存按钮可见
  const clampPhys = (avail, min, max) => Math.max(min, Math.min(avail - MARGIN, max))
  const physW = clampPhys(physAvailW, 900, 1280)
  const physH = clampPhys(physAvailH, 620, 860)
  // 关键:÷ dpr,抵消 ShowDialog 内部的 ×dpr,使两个不同缩放的 webview 得到相同物理窗口。
  const width = Number(options?.width) || physW / dpr
  const height = Number(options?.height) || physH / dpr
  const url = buildSettingsWindowUrl(normalizedQuery)
  if (window.Application?.ShowDialog) {
    window.Application.ShowDialog(
      url,
      title,
      width,
      height,
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
