/**
 * 会话小设置存储。
 *
 * 写操作权限三档模式（confirm/auto/full）已于 2026-09-17 移除：文档智能体的
 * 写操作不再弹确认卡，按用户指令直接执行（confirmed 由 skill 层对 chayuan 写
 * 工具统一注入，见 agentCoreSkill.js needsAutoConfirm）。本文件只保留与权限
 * 无关的设置项。
 *
 * 现管设置：表单型 pending（参数收集卡）的自动继续秒数（默认 5）。
 */

const DIALOG_AUTO_CONTINUE_SECONDS_KEY = 'chayuan_ai_dialog_auto_continue_seconds'
const DEFAULT_AUTO_CONTINUE_SECONDS = 5

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

/** 表单型 pending（参数收集/执行选择）自动继续秒数 */
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
