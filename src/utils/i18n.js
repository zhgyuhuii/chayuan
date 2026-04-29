/**
 * i18n — 极简 i18n 骨架
 *
 * 目标:让 ⌘K 命令、按钮、横幅文案可切语言。不引入大库(no vue-i18n 依赖)。
 *
 * 用法:
 *   import { t, setLocale, getLocale } from '@/utils/i18n.js'
 *   t('cmd.evo.run')       // 当前语言下的字符串
 *   setLocale('en-US')     // 切换;触发 subscribe 回调
 *
 * 特性:
 *   - 多 locale 单文件:{ 'zh-CN': {...}, 'en-US': {...} }
 *   - 嵌套 key:t('cmd.evo.run')
 *   - 缺 key 回退:zh-CN → key 字符串(便于发现缺失)
 *   - 占位符:t('hello', { name: 'World' }) → 'Hello, World'(`{name}` 替换)
 *   - localStorage 持久(key=`chayuanLocale`)
 *   - subscribe 给 Vue 组件做响应式更新
 *
 * 调用方仍可继续用硬编码字符串 — 这层只是新增能力,不强制迁移。
 */

const STORAGE_KEY = 'chayuanLocale'
const DEFAULT_LOCALE = 'zh-CN'
const FALLBACK_LOCALE = 'zh-CN'

/* ────────── 翻译表 ────────── */

const MESSAGES = {
  'zh-CN': {
    'cmd.group.ribbon': 'ribbon',
    'cmd.group.evolution': '进化',
    'cmd.group.diagnostic': '诊断',
    'cmd.group.appearance': '外观',
    'cmd.group.model': '模型',

    'cmd.evo.page.open': '打开助手进化中心',
    'cmd.evo.boot': '启动/重启进化系统(基于当前默认模型)',
    'cmd.evo.cycle.run': '运行助手进化评估周期',
    'cmd.evo.snapshot.log': '查看助手健康度快照',
    'cmd.evo.scheduler.toggle': '切换进化系统每日自动调度',

    'cmd.perf.page.open': '打开 LLM 延迟监控页',
    'cmd.perf.stats.log': '查看 LLM 调用延迟统计',
    'cmd.perf.stats.clear': '清空 LLM 延迟统计',

    'cmd.theme.toggle': '切换暗色 / 亮色主题',
    'cmd.theme.auto': '主题:跟随系统',

    'welcome.headline': '察元焕新升级',
    'welcome.tip.cmdk': '唤起命令面板,所有功能键盘可达',
    'welcome.link.evolution': '助手进化中心',
    'welcome.link.perf': 'LLM 延迟监控',
    'welcome.link.theme': '一键切换暗色',

    'evo.not_booted.hint': '进化系统尚未启动',
    'evo.cycle.completed': '周期完成'
  },
  'en-US': {
    'cmd.group.ribbon': 'Ribbon',
    'cmd.group.evolution': 'Evolution',
    'cmd.group.diagnostic': 'Diagnostic',
    'cmd.group.appearance': 'Appearance',
    'cmd.group.model': 'Model',

    'cmd.evo.page.open': 'Open Assistant Evolution Center',
    'cmd.evo.boot': 'Start / restart evolution system (use current default model)',
    'cmd.evo.cycle.run': 'Run evaluation cycle now',
    'cmd.evo.snapshot.log': 'Show assistant health snapshot',
    'cmd.evo.scheduler.toggle': 'Toggle daily auto-evaluation',

    'cmd.perf.page.open': 'Open LLM Latency Monitor',
    'cmd.perf.stats.log': 'Show LLM call latency stats',
    'cmd.perf.stats.clear': 'Clear LLM latency stats',

    'cmd.theme.toggle': 'Toggle dark / light theme',
    'cmd.theme.auto': 'Theme: follow system',

    'welcome.headline': 'Chayuan, refreshed',
    'welcome.tip.cmdk': 'opens the command palette — every feature keyboard-accessible',
    'welcome.link.evolution': 'Evolution Center',
    'welcome.link.perf': 'Latency Monitor',
    'welcome.link.theme': 'Try dark mode',

    'evo.not_booted.hint': 'Evolution system not booted',
    'evo.cycle.completed': 'Cycle completed'
  }
}

/* ────────── 状态 ────────── */

let _locale = (() => {
  try {
    const v = window?.localStorage?.getItem(STORAGE_KEY)
    if (v && MESSAGES[v]) return v
  } catch {}
  return DEFAULT_LOCALE
})()
const _listeners = new Set()

/* ────────── API ────────── */

/** 当前语言 code(zh-CN / en-US)。 */
export function getLocale() {
  return _locale
}

/** 切换语言。无效 code 静默忽略。 */
export function setLocale(locale) {
  if (!MESSAGES[locale] || locale === _locale) return _locale
  _locale = locale
  try { window?.localStorage?.setItem(STORAGE_KEY, locale) } catch {}
  for (const fn of _listeners) {
    try { fn(_locale) } catch (_) {}
  }
  return _locale
}

/** 翻译。缺 key → 回退默认 locale → 返回 key 本身。支持 {name} 占位符。 */
export function t(key, vars) {
  let str = MESSAGES[_locale]?.[key]
  if (str == null) str = MESSAGES[FALLBACK_LOCALE]?.[key]
  if (str == null) str = String(key)
  if (vars && typeof vars === 'object') {
    str = str.replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? String(vars[k]) : m)
  }
  return str
}

/** 订阅 locale 变化,返回 unsubscribe 函数。 */
export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {}
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

/** 已支持的 locale 清单。 */
export function listLocales() {
  return Object.keys(MESSAGES)
}

/** 给第三方/扩展加自己的翻译表。同 key 后注册的覆盖前者。 */
export function extendMessages(locale, dict) {
  if (!MESSAGES[locale]) MESSAGES[locale] = {}
  if (!dict || typeof dict !== 'object') return
  Object.assign(MESSAGES[locale], dict)
}

export default {
  t,
  getLocale,
  setLocale,
  listLocales,
  subscribe,
  extendMessages
}
