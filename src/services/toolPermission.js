/**
 * 工具权限层（三档权限模式）。
 *
 * 对照 Claude Code 的 default / acceptEdits / bypassPermissions 与 opencode 的
 * read+edit / full-access(yolo)：
 *
 * | 档位      | 读/预览(dryRun) | 写操作(confirmed)            | 语义               |
 * |-----------|----------------|------------------------------|--------------------|
 * | confirm   | 直通           | 确认卡，不自动倒计时，不确认=拒绝 | 权限型确认默认拒绝 |
 * | auto      | 直通           | 自动批准 + 首次写前强制快照     | 快照可撤销兜底     |
 * | full      | 直通           | 直通，仅审计                  | yolo               |
 *
 * 铁律：模型入参的 confirmed 在 skill 入口已剥除（见 agentCoreSkill.js），
 * 本层是 confirmed 的唯一合法来源。
 *
 * 另管一项设置：表单型 pending（参数收集卡）的自动继续秒数（默认 5）。
 * 权限型 pending（写确认/修订模式）永不自动放行，不读该秒数。
 */

const TOOL_PERMISSION_STORAGE_KEY = 'chayuan_ai_tool_permission_mode'
const DIALOG_AUTO_CONTINUE_SECONDS_KEY = 'chayuan_ai_dialog_auto_continue_seconds'
const DEFAULT_AUTO_CONTINUE_SECONDS = 5

export const TOOL_PERMISSION_MODES = ['confirm', 'auto', 'full']

export const TOOL_PERMISSION_MODE_META = {
  confirm: {
    label: '变更前确认',
    short: '确认',
    hint: '每次写文档前弹确认卡；不确认即拒绝该操作（推荐）'
  },
  auto: {
    label: '自动执行',
    short: '自动',
    hint: '写操作自动执行，首次写入前自动创建快照、可用撤销卡回滚'
  },
  full: {
    label: '完全访问',
    short: '全开',
    hint: '写操作直通不做拦截（等同 yolo 模式），仅记录审计'
  }
}

export function isToolPermissionMode(value) {
  return TOOL_PERMISSION_MODES.includes(String(value || '').trim())
}

function pluginStorageGet(key) {
  try {
    const app = typeof window !== 'undefined' ? window.Application : null
    if (!app?.PluginStorage?.getItem) return null
    return app.PluginStorage.getItem(key)
  } catch {
    return null
  }
}

function pluginStorageSet(key, value) {
  try {
    const app = typeof window !== 'undefined' ? window.Application : null
    if (!app?.PluginStorage?.setItem) return
    app.PluginStorage.setItem(key, String(value))
  } catch {
    /* ignore */
  }
}

export function loadToolPermissionMode() {
  const raw = String(pluginStorageGet(TOOL_PERMISSION_STORAGE_KEY) || '').trim()
  return isToolPermissionMode(raw) ? raw : 'confirm'
}

export function saveToolPermissionMode(mode) {
  if (!isToolPermissionMode(mode)) return false
  pluginStorageSet(TOOL_PERMISSION_STORAGE_KEY, mode)
  return true
}

/**
 * 写操作裁决：confirm 档交给调用方弹卡；auto/full 直接放行。
 * @returns {{ approved: boolean, viaCard: boolean, mode: string }}
 */
export function resolveWriteDecision(mode, { turnAllowedTools = null, namespacedName = '' } = {}) {
  const m = isToolPermissionMode(mode) ? mode : loadToolPermissionMode()
  if (turnAllowedTools && namespacedName && turnAllowedTools.has(namespacedName)) {
    return { approved: true, viaCard: false, mode: m }
  }
  if (m === 'auto' || m === 'full') return { approved: true, viaCard: false, mode: m }
  return { approved: false, viaCard: true, mode: m }
}

/** 表单型 pending（参数收集/执行选择）自动继续秒数；权限型确认不使用此值 */
export function loadDialogAutoContinueSeconds() {
  const n = Number(pluginStorageGet(DIALOG_AUTO_CONTINUE_SECONDS_KEY))
  return Number.isFinite(n) && n >= 1 && n <= 120 ? Math.floor(n) : DEFAULT_AUTO_CONTINUE_SECONDS
}

export function saveDialogAutoContinueSeconds(seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n) || n < 1 || n > 120) return false
  pluginStorageSet(DIALOG_AUTO_CONTINUE_SECONDS_KEY, String(Math.floor(n)))
  return true
}
