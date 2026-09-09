/**
 * aiAssistantDockManager - AI 助手形态状态机（float / left / right / bottom）
 *
 * 计划文档：plans/plan-ai-assistant-docking.md
 * 平台实测依据：scripts/probe-dock/（WPS Mac 12.1.28492）
 *
 * 职责：
 *   1. 形态记忆与打开语义（openAs：float=ShowDialog，其余=CreateTaskPane）
 *   2. 浮窗↔停靠原子交接（先建后关：markHandover → 建面板 → ready 握手 → 验尺寸 → 关旧）
 *   3. 尺寸设置规范：DockPosition 切换后延迟 ≥400ms 再设 Width/Height（立即设会得到
 *      14px 坏死面板，且同步读回值是假的）；以面板页 resize 回报的真实 innerWidth/Height
 *      （PluginStorage）为准，有界重试，禁止相信 Width/Height 读回值
 *   4. 运行时能力探测缓存（按 Application.Version）：回报 <50px 或超时判该方向不支持
 *
 * 面板页（AIAssistantDialog.vue，?mode=taskpane）配合约定：
 *   - 挂载即写 PANE_READY_KEY {bootId, updatedAt}，随后每次 resize 防抖刷新
 *     PANE_SIZE_KEY {bootId, w, h, updatedAt}
 *   - 以 {mode:'taskpane', takeOverHandover:true} 认领单实例锁（见 aiAssistantWindowManager）
 *
 * 跨 webview 存储说明：PluginStorage 为加载项级共享（ribbon/TaskPane/ShowDialog 三方），
 * localStorage 同源共享（探针实测）。旧停靠面板无枚举 API，WPS 重启残留的孤儿面板
 * 仅能靠锁 15s 过期自愈，属已知限制。
 */

import Util from '../../components/js/util.js'
import { getApp } from './hostBridge.js'
import {
  HANDOVER_INSTANCE_ID,
  markAIAssistantHandover,
  readAIAssistantLock,
  restoreAIAssistantLock,
  sendAIAssistantCloseRequest
} from '../aiAssistantWindowManager.js'

export const DOCK_MODES = ['float', 'left', 'right', 'bottom']

// msoCTPDockPosition* 的规范值（MSO 稳定枚举，探针确认 WPS 运行时 Enum 全部存在；
// 宿主 Enum 缺项时兜底，bottom 无历史可用值则依赖 Enum 必须存在）
const POSITION_ENUM_NAMES = {
  left: 'msoCTPDockPositionLeft',
  right: 'msoCTPDockPositionRight',
  bottom: 'msoCTPDockPositionBottom'
}
const CANONICAL_POSITION_VALUES = { left: 0, right: 2, bottom: 3 }

// PluginStorage keys（面板页协议 key 单独导出给 AIAssistantDialog.vue 使用）
export const PANE_PROTOCOL_KEYS = {
  ready: 'ai_assistant_pane_ready',
  size: 'ai_assistant_pane_size'
}
const KEYS = {
  mode: 'ai_assistant_dock_mode',
  paneId: 'ai_assistant_taskpane_id',
  probe: 'ai_assistant_dock_probe',
  width: 'ai_assistant_dock_width',
  height: 'ai_assistant_dock_height',
  ...PANE_PROTOCOL_KEYS
}

export const TIMING_DEFAULTS = {
  settleDelayMs: 400, // DockPosition→Width/Height 首设延迟（探针：≥~400ms 才不触发布局竞态）
  sizeTotalMs: 9000, // 尺寸观察总窗口（探针：赋值落地延迟 0.7~3.5s 且随重设变长，窗口要足够长）
  sizeExactGraceMs: 3500, // 此窗口内坚持等精确匹配；过后接受健康默认尺寸（共识：不可设用默认）
  sizeSetAttempts: 2, // 总赋值次数上限：频繁重设疑似推迟布局沉降（探针 round2 时间线）
  sizePollMs: 300,
  verifyIntervalMs: 200,
  pollsPerAttempt: 2,
  readyTimeoutMs: 15000, // 面板页（重 Vue 应用）ready 握手超时；冷启动首载较慢，放宽到 15s
  readyPollMs: 250,
  closeGraceMs: 60, // undock 时浮窗创建后到关旧面板的宽限
  markerFreshMs: 15000,
  markerClockSkewMs: 1500 // 跨 webview 时间戳比对允差
}

export const SIZE_LIMITS = {
  minWidth: 280,
  maxWidth: 720,
  minHeight: 200,
  maxHeight: 640,
  minSupportedPx: 50, // 低于此判该方向停靠坏死/不支持
  tolerancePx: 16 // 面板页回报与目标尺寸的比对容差
}
export const DEFAULT_PANE_SIZE = { width: 420, height: 320 }

/**
 * 左右停靠的目标宽度：屏幕一半（与 WPS 文档平分屏幕宽度，用户口径即屏幕）。
 * manager 运行在 WPS webview 里，window.screen 与 WPS 主窗口同屏；
 * 取不到 screen 时回落旧默认 420。
 */
function resolveHalfScreenWidthPx() {
  try {
    const w = Number(window.screen?.availWidth || window.screen?.width || 0)
    if (Number.isFinite(w) && w >= 2 * SIZE_LIMITS.minWidth) {
      return Math.floor(w / 2)
    }
  } catch (_) {}
  return DEFAULT_PANE_SIZE.width
}

const FLOAT_DIALOG_TITLE = '察元 AI 助手'
const FLOAT_DIALOG_SIZE = { width: 900, height: 700 }

// ---------------------------------------------------------------------------
// 纯逻辑（node 单测直接覆盖）
// ---------------------------------------------------------------------------

export function normalizeDockMode(mode) {
  const value = String(mode || '').trim().toLowerCase()
  return DOCK_MODES.includes(value) ? value : null
}

export function clampPaneSizeValue(value, min, max) {
  // 注意 Number(null)/Number('') 均为 0 而非 NaN，必须显式挡掉，否则缺失记忆会落到下限
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return Math.min(max, Math.max(min, Math.round(num)))
}

/**
 * 面板页回报的尺寸是否达到目标（探针校准：底栏 set Height 320 → innerHeight 320，误差极小）。
 * @param {{w:number,h:number}} report 面板页回报
 * @param {'left'|'right'|'bottom'} mode
 * @param {number} target 目标 Width（left/right）或 Height（bottom）
 */
export function isAcceptableSizeReport(report, mode, target) {
  if (!report) return false
  const dim = mode === 'bottom' ? Number(report.h) : Number(report.w)
  if (!Number.isFinite(dim) || dim < SIZE_LIMITS.minSupportedPx) return false
  return Math.abs(dim - target) <= SIZE_LIMITS.tolerancePx
}

/** 面板健康判定：回报尺寸 ≥50px（14px 坏死面板不算） */
export function isHealthySizeReport(report, mode) {
  if (!report) return false
  const dim = mode === 'bottom' ? Number(report.h) : Number(report.w)
  return Number.isFinite(dim) && dim >= SIZE_LIMITS.minSupportedPx
}

export function buildAIAssistantPaneUrl(mode, query = {}) {
  const params = new URLSearchParams({ mode: 'taskpane', dock: mode })
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      params.set(key, String(value))
    }
  })
  return `${Util.GetUrlPath()}${Util.GetRouterHash()}/ai-assistant?${params.toString()}`
}

// ---------------------------------------------------------------------------
// 工厂（依赖注入，生产用 getAIAssistantDockManager() 单例）
// ---------------------------------------------------------------------------

export function createAIAssistantDockManager(deps = {}) {
  const timing = { ...TIMING_DEFAULTS, ...(deps.timing || {}) }
  const getApplication = deps.getApplication || getApp
  const buildPaneUrl = deps.buildPaneUrl || buildAIAssistantPaneUrl
  const openFloat =
    deps.openFloat ||
    function defaultOpenFloat(query = {}) {
      const app = getApplication()
      if (!app || typeof app.ShowDialog !== 'function') {
        throw new Error('ShowDialog unavailable')
      }
      const queryString = new URLSearchParams(query || {}).toString()
      const url = `${Util.GetUrlPath()}${Util.GetRouterHash()}/ai-assistant${queryString ? `?${queryString}` : ''}`
      app.ShowDialog(
        url,
        FLOAT_DIALOG_TITLE,
        FLOAT_DIALOG_SIZE.width * (window.devicePixelRatio || 1),
        FLOAT_DIALOG_SIZE.height * (window.devicePixelRatio || 1),
        false
      )
    }
  const scheduler = deps.scheduler || {
    delay: (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
  }

  let readyBootId = null // 最近一次 ready 握手确认的面板页 bootId，尺寸回报须同源

  // -- PluginStorage 读写（值均为字符串；JSON 键容错解析） --
  function storage() {
    return getApplication()?.PluginStorage || null
  }
  function readRaw(key) {
    try {
      const value = storage()?.getItem(key)
      return value === undefined || value === null ? null : String(value)
    } catch (_) {
      return null
    }
  }
  function writeRaw(key, value) {
    try {
      storage()?.setItem(key, String(value))
      return true
    } catch (_) {
      return false
    }
  }
  function readJson(key) {
    try {
      const raw = readRaw(key)
      return raw ? JSON.parse(raw) : null
    } catch (_) {
      return null
    }
  }
  function removeRaw(key) {
    try {
      storage()?.removeItem(key)
    } catch (_) {}
  }

  function delay(ms) {
    return scheduler.delay(ms)
  }

  // -- 形态记忆 --
  function getMode() {
    return normalizeDockMode(readRaw(KEYS.mode)) || 'float'
  }
  function setMode(mode) {
    const normalized = normalizeDockMode(mode)
    if (!normalized) return false
    return writeRaw(KEYS.mode, normalized)
  }

  // -- 面板对象 --
  function getOpenPane() {
    const app = getApplication()
    const id = readRaw(KEYS.paneId)
    if (!id || !app || typeof app.GetTaskPane !== 'function') return null
    try {
      const pane = app.GetTaskPane(id)
      if (pane && pane.ID !== undefined) return pane
    } catch (_) {}
    removeRaw(KEYS.paneId)
    return null
  }
  function hasOpenPane() {
    return getOpenPane() !== null
  }
  function focusOpenPane() {
    const pane = getOpenPane()
    if (!pane) return false
    try {
      pane.Visible = true
    } catch (_) {}
    return true
  }
  function safeDeletePane(pane) {
    if (!pane) return
    try {
      if (typeof pane.Delete === 'function') pane.Delete()
      else pane.Visible = false
    } catch (_) {
      try {
        pane.Visible = false
      } catch (_2) {}
    }
  }
  function clearPaneIdIfMatches(paneId) {
    if (String(readRaw(KEYS.paneId) || '') === String(paneId)) {
      removeRaw(KEYS.paneId)
    }
  }
  function clearPaneState() {
    removeRaw(KEYS.paneId)
    removeRaw(KEYS.ready)
    removeRaw(KEYS.size)
  }

  // -- 探测缓存（按 WPS 版本） --
  function appVersion() {
    try {
      return String(getApplication()?.Version || 'unknown')
    } catch (_) {
      return 'unknown'
    }
  }
  function readProbeCache() {
    const cache = readJson(KEYS.probe)
    return cache && typeof cache === 'object' ? cache : null
  }
  function cacheProbeResult(mode, supported) {
    const version = appVersion()
    const cache = readProbeCache()
    const next = cache && cache.version === version ? cache : { version, results: {} }
    next.results = { ...(next.results || {}), [mode]: !!supported }
    next.updatedAt = Date.now()
    writeRaw(KEYS.probe, JSON.stringify(next))
  }
  /**
   * 运行时探测缓存读取：true/false=已探测结论，null=未知（尚未探测）。
   * 探测不主动触发：结论由真实 openAs/dockTo 尝试（成功或坏死超时）回填。
   */
  function isDockSupported(mode) {
    if (mode === 'float') return true
    const cached = readProbeCache()?.results?.[mode]
    return typeof cached === 'boolean' ? cached : null
  }
  function getCachedSupportMap() {
    const cache = readProbeCache()
    return cache && cache.version === appVersion() ? { ...(cache.results || {}) } : {}
  }

  // -- 尺寸设置规范（探针配方：延迟首设 + 面板页回报验证 + 有界重试） --
  function resolveTargetSize(mode) {
    if (mode === 'bottom') {
      const height =
        clampPaneSizeValue(readRaw(KEYS.height), SIZE_LIMITS.minHeight, SIZE_LIMITS.maxHeight) ||
        DEFAULT_PANE_SIZE.height
      return { axis: 'height', value: height }
    }
    // 左/右：屏幕一半（用户约定），不套 maxWidth 上限（1920 屏即 960）；
    // 最小可用宽仍受 minWidth 保护
    const half = resolveHalfScreenWidthPx()
    const width = Math.max(SIZE_LIMITS.minWidth, half)
    return { axis: 'width', value: width }
  }
  function readSizeReport(createdAt) {
    const report = readJson(KEYS.size)
    if (!report || !readyBootId || report.bootId !== readyBootId) return null
    // createdAt 为 CreateTaskPane 前一刻的时间戳；回报必须晚于它（留跨 webview 时钟允差）
    if (Number(report.updatedAt || 0) < createdAt - timing.markerClockSkewMs) return null
    return report
  }
  // 尺寸设置规范（修订版，按计划共识 9「可设则记忆，不可设用 WPS 默认」）：
  // - 目标：面板健康（回报尺寸 ≥50px，见 isHealthySizeReport）即接受；Width/Height
  //   精确落地是 best-effort，落地了才写入尺寸记忆。探针 round2 只对 Height 证实过
  //   延迟赋值生效；宽度赋值落地慢（0.7~3.5s）且频繁重设疑似推迟沉降，因此赋值
  //   次数受限、精确匹配只等一个宽限期，之后按健康默认放行。
  // - 只有始终无健康回报（页面没起来/14px 坏死）才判该方向不支持。
  async function applyAndVerifyPaneSize(pane, mode, createdAt) {
    await delay(timing.settleDelayMs)
    const target = resolveTargetSize(mode)
    const startedAt = Date.now()
    let setCount = 0
    let sawReport = false
    let lastDim = -1
    let stableCount = 0
    while (Date.now() - startedAt < timing.sizeTotalMs) {
      if (setCount < timing.sizeSetAttempts) {
        try {
          if (target.axis === 'width') pane.Width = target.value
          else pane.Height = target.value
        } catch (_) {}
        setCount += 1
      }
      await delay(timing.sizePollMs)
      const report = readSizeReport(createdAt)
      if (report) sawReport = true
      if (isAcceptableSizeReport(report, mode, target.value)) {
        writeRaw(target.axis === 'width' ? KEYS.width : KEYS.height, String(target.value))
        return { ok: true, exact: true, sawReport }
      }
      // 稳定即接受：赋值已尝试 + 连续 3 次回报同一健康尺寸 → WPS 忽略赋值
      // （本机实测如此）时不再空等完整宽限期，切换耗时从 3.5s+ 降到 ~1.3s
      if (isHealthySizeReport(report, mode)) {
        const dim = mode === 'bottom' ? Number(report.h) : Number(report.w)
        if (dim === lastDim) stableCount += 1
        else { lastDim = dim; stableCount = 1 }
        if (setCount >= 1 && stableCount >= 3) {
          return { ok: true, exact: false, sawReport }
        }
      } else {
        lastDim = -1
        stableCount = 0
      }
      const pastGrace = Date.now() - startedAt >= timing.sizeExactGraceMs
      if (pastGrace && isHealthySizeReport(report, mode)) {
        return { ok: true, exact: false, sawReport }
      }
    }
    // sawReport=false 表示面板页始终没有回报（加载失败/极慢），非”方向坏死”实证
    return { ok: false, sawReport }
  }

  // -- ready 握手（面板页挂载即写 {bootId}，bootId 变化=新页面实例） --
  async function waitPaneReady(beforeMarker, createdAt) {
    const deadline = Date.now() + timing.readyTimeoutMs
    while (Date.now() < deadline) {
      await delay(timing.readyPollMs)
      const marker = readJson(KEYS.ready)
      if (
        marker &&
        marker.bootId &&
        marker.bootId !== beforeMarker?.bootId &&
        Number(marker.updatedAt || 0) >= createdAt - timing.markerClockSkewMs &&
        Date.now() - Number(marker.updatedAt || 0) < timing.markerFreshMs
      ) {
        readyBootId = marker.bootId
        return marker
      }
    }
    return null
  }

  // -- 运行时能力检查 --
  function resolveDockEnumValue(mode) {
    const name = POSITION_ENUM_NAMES[mode]
    if (!name) return undefined
    const fromApp = getApplication()?.Enum?.[name]
    return typeof fromApp === 'number' ? fromApp : CANONICAL_POSITION_VALUES[mode]
  }
  function canDockAtRuntime(mode) {
    const app = getApplication()
    if (!app || typeof app.CreateTaskPane !== 'function' || typeof app.GetTaskPane !== 'function') {
      return false
    }
    return resolveDockEnumValue(mode) !== undefined
  }

  function createPane(mode, query) {
    const app = getApplication()
    const url = buildPaneUrl(mode, query)
    try {
      const pane = app.CreateTaskPane(url)
      if (!pane || pane.ID === undefined) {
        throw new Error('CreateTaskPane 返回空对象')
      }
      // 探针顺序：先 DockPosition 后 Visible
      pane.DockPosition = resolveDockEnumValue(mode)
      pane.Visible = true
      return pane
    } catch (e) {
      // 带出 WPS 底层异常（如对话框 webview 不允许创建面板），透传到 UI 提示
      throw new Error(`create-taskpane-failed: ${e?.message || e}`)
    }
  }

  function fallbackToFloat(query, reason) {
    try {
      openFloat(query)
    } catch (e) {
      return { ok: false, reason: `${reason};float-fallback-failed`, error: e }
    }
    setMode('float')
    return { ok: false, reason, fallback: 'float' }
  }

  /**
   * 切到停靠形态（浮窗→停靠 / 停靠→停靠 / 冷启动直接停靠共用）。
   * 原子交接：markHandover → CreateTaskPane → ready 握手 → 验尺寸 → 关旧形态。
   * 任何一步失败：回滚锁 + 删新建面板；原形态为浮窗则保持浮窗，否则回退打开浮窗。
   */
  async function dockTo(mode, query = {}) {
    const normalized = normalizeDockMode(mode)
    if (!normalized || normalized === 'float') {
      return { ok: false, reason: 'invalid-mode' }
    }
    if (!canDockAtRuntime(normalized)) {
      cacheProbeResult(normalized, false)
      return fallbackToFloat(query, `dock-unsupported:${normalized}`)
    }

    // 停靠间互切快路径：活面板直接改 DockPosition（探针 round1 验证过同一面板
    // 切换位置可用），免掉新 webview 冷启动整页重载与锁交接——从数秒降到亚秒。
    // 快路径任何异常都回落全量「先建后关」路径。
    const activePane = getOpenPane()
    const currentDockMode = getMode()
    if (activePane && currentDockMode !== 'float' && normalized !== currentDockMode) {
      try {
        activePane.DockPosition = resolveDockEnumValue(normalized)
        // 发起方（面板页自身）就是存活证明；同步 readyBootId 后做轻量尺寸校验
        const currentReport = readJson(KEYS.size)
        if (!currentReport?.bootId) throw new Error('fast-no-report')
        readyBootId = currentReport.bootId
        const sizeResult = await applyAndVerifyPaneSize(activePane, normalized, 0)
        if (!sizeResult.ok) throw new Error('fast-size-unhealthy')
        setMode(normalized)
        cacheProbeResult(normalized, true)
        return { ok: true, mode: normalized, fast: true }
      } catch (_) {
        // 回落全量路径（下方 markHandover → CreateTaskPane → …）
      }
    }

    const previousLock = readAIAssistantLock()
    const previousOwnerId =
      previousLock && previousLock.instanceId !== HANDOVER_INSTANCE_ID && !previousLock.handover
        ? previousLock.instanceId
        : null
    const previousPane = getOpenPane()
    const previousPaneId = readRaw(KEYS.paneId)

    const mark = markAIAssistantHandover('taskpane')
    if (!mark.ok) {
      return fallbackToFloat(query, 'handover-write-failed')
    }

    const createdAt = Date.now()
    const beforeReady = readJson(KEYS.ready)
    let createdPane = null
    readyBootId = null
    try {
      createdPane = createPane(normalized, query)
      writeRaw(KEYS.paneId, String(createdPane.ID))

      const ready = await waitPaneReady(beforeReady, createdAt)
      if (!ready) throw new Error('pane-ready-timeout')

      const sizeResult = await applyAndVerifyPaneSize(createdPane, normalized, createdAt)
      if (!sizeResult.ok) {
        // 只有“面板页活着但尺寸坏死(<50px)”才缓存为该方向不支持；
        // 零回报（页面没起来）不缓存，避免慢机器被误判永久隐藏入口
        if (sizeResult.sawReport) cacheProbeResult(normalized, false)
        throw new Error('pane-size-verify-failed')
      }
      cacheProbeResult(normalized, true)
      setMode(normalized)

      // 交接收尾（先建后关）：优先删旧停靠面板，其次请求旧浮窗自行关闭
      if (previousPane && String(previousPane.ID) !== String(createdPane.ID)) {
        safeDeletePane(previousPane)
      } else if (previousOwnerId) {
        sendAIAssistantCloseRequest(previousOwnerId)
      }
      return { ok: true, mode: normalized }
    } catch (e) {
      if (createdPane) {
        safeDeletePane(createdPane)
        clearPaneIdIfMatches(createdPane.ID)
      }
      // 面板 id 记忆恢复为旧面板（dock→dock 失败时旧面板仍是活实例）
      if (previousPaneId && previousPane) writeRaw(KEYS.paneId, previousPaneId)
      restoreAIAssistantLock(mark.previous)
      if (previousOwnerId || previousPane) {
        return { ok: false, reason: String(e?.message || e), keptPrevious: true }
      }
      return fallbackToFloat(query, String(e?.message || e))
    }
  }

  /** 停靠 → 浮窗：先开浮窗（reopen 认领交接锁），宽限后删旧面板。 */
  async function undockToFloat(query = {}) {
    const mark = markAIAssistantHandover('float')
    if (!mark.ok) {
      return { ok: false, reason: 'handover-write-failed' }
    }
    try {
      openFloat({ ...(query || {}), reopen: '1' })
    } catch (e) {
      restoreAIAssistantLock(mark.previous)
      return { ok: false, reason: 'float-open-failed', error: e }
    }
    await delay(timing.closeGraceMs)
    const pane = getOpenPane()
    // 先落库再删面板：面板页自身发起 undock 时，Delete 可能连带销毁本 webview，
    // 删除之后的语句不保证执行
    clearPaneState()
    setMode('float')
    if (pane) safeDeletePane(pane)
    return { ok: true, mode: 'float' }
  }

  /**
   * 按形态打开：float=ShowDialog；停靠=复用已开面板或走 dockTo 原子交接。
   * 切换中途失败自动回退浮窗（静默，调用方可选提示）。
   */
  async function openAs(mode, query = {}) {
    const normalized = normalizeDockMode(mode) || 'float'
    if (normalized === 'float') {
      try {
        openFloat(query)
      } catch (e) {
        return { ok: false, reason: 'float-open-failed', error: e }
      }
      setMode('float')
      return { ok: true, mode: 'float' }
    }
    if (getMode() === normalized) {
      const pane = getOpenPane()
      if (pane) {
        try {
          pane.Visible = true
        } catch (_) {}
        return { ok: true, mode: normalized, alreadyOpen: true }
      }
    }
    return dockTo(normalized, query)
  }

  /** 全形态关闭（保持形态记忆，下次按上次形态打开）。 */
  function closeAll() {
    const pane = getOpenPane()
    // 与 undockToFloat 同理：Delete 可能销毁发起方 webview，存储写入全部前置
    clearPaneState()
    const lock = readAIAssistantLock()
    if (lock && lock.instanceId && lock.instanceId !== HANDOVER_INSTANCE_ID && !lock.handover) {
      sendAIAssistantCloseRequest(lock.instanceId)
    }
    if (pane) safeDeletePane(pane)
  }

  return {
    getMode,
    setMode,
    openAs,
    dockTo,
    undockToFloat,
    closeAll,
    isDockSupported,
    getCachedSupportMap,
    hasOpenPane,
    focusOpenPane
  }
}

let singleton = null

/**
 * 生产单例。首次调用可传 overrides（一般无需：默认依赖即为生产行为，
 * Application 句柄按 hostBridge 约定每次调用现取、永不缓存）。
 */
export function getAIAssistantDockManager(overrides = {}) {
  if (!singleton) {
    singleton = createAIAssistantDockManager(overrides)
  }
  return singleton
}
