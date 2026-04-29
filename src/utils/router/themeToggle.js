/**
 * themeToggle — 暗色模式切换的极小工具
 *
 * tokens.css 已支持:
 *   - 默认:跟随系统 prefers-color-scheme
 *   - 显式覆盖:[data-theme="dark"] / [data-theme="light"](优先级高于系统)
 *
 * 这层就是把上面的"显式覆盖"包成 set/get/toggle + localStorage 持久化。
 *
 * 用法:
 *   import { setTheme, getTheme, toggleTheme, applyStoredTheme } from '@/utils/router/themeToggle.js'
 *
 *   // App 初始化时(让上次选择立即生效):
 *   applyStoredTheme()
 *
 *   // ⌘K 命令 / 设置面板:
 *   toggleTheme()
 *
 * 不会"反向"动到 prefers-color-scheme — 用户清掉显式选择时会再次跟随系统。
 */

const STORAGE_KEY = 'chayuanTheme'
const VALID = new Set(['light', 'dark', 'auto'])

/* ────────── 内部 ────────── */

function loadStored() {
  try {
    const v = window?.localStorage?.getItem(STORAGE_KEY)
    return VALID.has(v) ? v : 'auto'
  } catch { return 'auto' }
}

function persist(theme) {
  try {
    if (theme === 'auto') window?.localStorage?.removeItem(STORAGE_KEY)
    else window?.localStorage?.setItem(STORAGE_KEY, theme)
  } catch { /* 静默 */ }
}

function detectSystemDark() {
  try {
    return window?.matchMedia?.('(prefers-color-scheme: dark)').matches === true
  } catch { return false }
}

/* ────────── 写 ────────── */

/**
 * 设置主题。值:'light' | 'dark' | 'auto'。
 * 'auto' 会清掉 data-theme,让系统偏好生效。
 */
export function setTheme(theme) {
  const next = VALID.has(theme) ? theme : 'auto'
  if (typeof document === 'undefined') return next
  const root = document.documentElement
  if (next === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', next)
  persist(next)
  return next
}

/**
 * 切换:auto/light → dark,dark → light。
 * 返回切换后的值。
 */
export function toggleTheme() {
  const cur = getTheme()
  // auto 状态下:看系统当前,反向切到 light/dark
  if (cur === 'auto') {
    return setTheme(detectSystemDark() ? 'light' : 'dark')
  }
  return setTheme(cur === 'dark' ? 'light' : 'dark')
}

/* ────────── 读 ────────── */

/** 当前显式主题(localStorage 中的值;无则 'auto')。 */
export function getTheme() {
  return loadStored()
}

/** 当前**生效**主题:解开 'auto' 看系统。返回 'light' | 'dark'。 */
export function getEffectiveTheme() {
  const cur = getTheme()
  if (cur === 'light' || cur === 'dark') return cur
  return detectSystemDark() ? 'dark' : 'light'
}

/**
 * 启动时调用一次,把 localStorage 里的选择写到 document.documentElement。
 * 没存过 → 不动 DOM,系统偏好继续生效。
 */
export function applyStoredTheme() {
  const stored = loadStored()
  if (stored === 'auto') return 'auto'
  return setTheme(stored)
}

export default {
  setTheme,
  toggleTheme,
  getTheme,
  getEffectiveTheme,
  applyStoredTheme
}
