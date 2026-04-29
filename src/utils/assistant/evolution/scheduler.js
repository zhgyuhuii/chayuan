/**
 * scheduler — promotionFlow 的定时驱动器
 *
 * 在 main process / Vue app 启动时调用 installEvolutionScheduler,
 * 它会:
 *   1. 立即跑一次(若距离上次 ≥ 23h)— 防止 app 长时间没开导致积压
 *   2. 每天 03:xx 触发一次 runDailyEvaluationCycle
 *   3. 把上次结果存到 localStorage,supports「跳过本次」「立即触发」
 *
 * 设计:
 *   - 用 setInterval 而非 cron(没有 main process,纯 web 加载项)
 *   - 三层保护:页面可见性 / 网络在线 / 用户配置开关
 *   - 失败不抛错,失败信息写到 lastResult 让面板能看到
 */

import { runDailyEvaluationCycle } from './promotionFlow.js'

const STORAGE_KEY = 'evolutionSchedulerState'
const DEFAULT_HOUR = 3                   // 03:xx 触发
const DEFAULT_INTERVAL_MS = 30 * 60_000  // 每 30 分钟检查一次"是不是该跑了"
const MIN_GAP_MS = 23 * 60 * 60_000      // 两次实际跑动至少间隔 23 小时

let timerHandle = null

/* ────────── 状态持久化 ────────── */

function loadState() {
  try {
    const raw = window?.localStorage?.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveState(state) {
  try {
    window?.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* 静默失败 — 没存储也能跑,只是失去去重 */ }
}

/* ────────── 配置(可被 UI 修改) ────────── */

export function getSchedulerConfig() {
  const s = loadState()
  return {
    enabled: s.enabled !== false,
    triggerHour: typeof s.triggerHour === 'number' ? s.triggerHour : DEFAULT_HOUR,
    lastRunAt: s.lastRunAt || 0,
    lastResult: s.lastResult || null,
    nextEligibleAt: s.lastRunAt ? s.lastRunAt + MIN_GAP_MS : 0
  }
}

export function setSchedulerEnabled(enabled) {
  const s = loadState()
  s.enabled = enabled !== false
  saveState(s)
  return s.enabled
}

export function setSchedulerHour(hour) {
  const h = Number(hour)
  if (!Number.isFinite(h) || h < 0 || h > 23) return
  const s = loadState()
  s.triggerHour = Math.floor(h)
  saveState(s)
}

/* ────────── 触发判定 ────────── */

function shouldRunNow(state, cfg) {
  if (state.enabled === false) return false
  const now = Date.now()
  if (state.lastRunAt && now - state.lastRunAt < MIN_GAP_MS) return false

  const nowHour = new Date(now).getHours()
  const targetHour = typeof state.triggerHour === 'number' ? state.triggerHour : DEFAULT_HOUR
  // 命中目标小时 → 跑;或距离上次超过 25h(漏跑兜底)
  if (nowHour === targetHour) return true
  if (state.lastRunAt && now - state.lastRunAt > 25 * 60 * 60_000) return true
  return false
}

function isPageVisible() {
  try {
    return typeof document === 'undefined' || document.visibilityState !== 'hidden'
  } catch { return true }
}

function isOnline() {
  try {
    return typeof navigator === 'undefined' || navigator.onLine !== false
  } catch { return true }
}

/* ────────── 主入口 ────────── */

/**
 * 立即跑一次(忽略时间窗口判定)。
 * 用于面板上的「立即触发」按钮。
 */
export async function runEvolutionNow(options = {}) {
  const startedAt = Date.now()
  let result
  try {
    result = await runDailyEvaluationCycle(options)
  } catch (e) {
    result = { error: String(e?.message || e), durationMs: Date.now() - startedAt }
  }
  const s = loadState()
  s.lastRunAt = Date.now()
  s.lastResult = result
  saveState(s)
  return result
}

/**
 * 安装定时器:每 30 分钟检查一次,命中窗口就跑。
 * 同时监听 window 的 online/offline 事件:
 *   - offline 时:不主动跑,但 timer 不停(节省 cpu);事件触发时 console.info
 *   - online 时:立即跑一次 tick(刚回来可能积压了任务)
 * 返回 stop 函数(同时移除事件监听)。
 */
export function installEvolutionScheduler(options = {}) {
  if (timerHandle) {
    // 重复安装 — 先清理
    clearInterval(timerHandle)
    timerHandle = null
  }
  const intervalMs = Number(options.checkIntervalMs) || DEFAULT_INTERVAL_MS

  const tick = async () => {
    const state = loadState()
    if (!shouldRunNow(state, options)) return
    if (!isPageVisible() || !isOnline()) return
    if (typeof options.beforeRun === 'function') {
      try { if ((await options.beforeRun()) === false) return } catch { return }
    }
    await runEvolutionNow(options)
    if (typeof options.afterRun === 'function') {
      try { await options.afterRun(loadState().lastResult) } catch (_) {}
    }
  }

  // 启动时延迟 60s 跑首次检查(避开 app 冷启动峰值)
  const warmup = setTimeout(() => { tick().catch(() => {}) }, 60_000)
  timerHandle = setInterval(() => { tick().catch(() => {}) }, intervalMs)

  // 网络状态监听:回到在线 → 立即 tick;离线 → 仅日志
  let onlineHandler = null
  let offlineHandler = null
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    onlineHandler = () => {
      if (typeof console !== 'undefined') console.info('[evolution-scheduler] 网络恢复,触发一次评估')
      tick().catch(() => {})
    }
    offlineHandler = () => {
      if (typeof console !== 'undefined') console.info('[evolution-scheduler] 网络断开,暂停评估直到恢复')
    }
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
  }

  return function stopScheduler() {
    clearTimeout(warmup)
    clearInterval(timerHandle)
    timerHandle = null
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      if (onlineHandler) window.removeEventListener('online', onlineHandler)
      if (offlineHandler) window.removeEventListener('offline', offlineHandler)
    }
  }
}

export default {
  installEvolutionScheduler,
  runEvolutionNow,
  getSchedulerConfig,
  setSchedulerEnabled,
  setSchedulerHour
}
