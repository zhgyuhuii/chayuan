/**
 * runtimeAssistantsInstaller — 迁移旧版自动安装的内置助手
 *
 * 旧版本曾把 18 个内置助手写入 customAssistants。由于这些模板使用
 * label/shortLabel 而不是自定义助手的 name 字段,会显示为“未命名助手”。
 * 现在这些助手已直接注册为 builtin,启动期只负责清理旧的 auto-installed 副本。
 *
 * 业务方接 onMounted 一行调用即可。
 */

// 注意:assistantSettings.js 通过 assistantRegistry → assistantIcons 链依赖 @iconify/utils,
// 在 Node 测试环境下 @iconify/utils 不可用 → 改为 lazy dynamic import,运行时才解析。
import { EXTRA_BUILTIN_ASSISTANTS } from './builtinAssistantsExtra.js'
import { P5_BUILTIN_ASSISTANTS } from './builtinAssistantsP5.js'
import { P5_PLUS_BUILTIN_ASSISTANTS } from './builtinAssistantsP5Plus.js'
import { loadGlobalSettings, saveGlobalSettings } from '../globalSettings.js'

let _settingsModule = null
async function getSettingsModule() {
  if (_settingsModule) return _settingsModule
  _settingsModule = await import('../assistantSettings.js')
  return _settingsModule
}

const UNINSTALL_KEY = 'autoInstalledAssistantsUninstalled'
const INSTALL_KEY = 'autoInstalledAssistantsLastVersion'
const CUSTOM_ASSISTANTS_KEY = 'customAssistants'
const CURRENT_VERSION = 2

/* ────────── 卸载标记(防"复活") ────────── */

function getUninstalledIds() {
  const s = loadGlobalSettings()
  return Array.isArray(s[UNINSTALL_KEY]) ? s[UNINSTALL_KEY] : []
}

export function markAsUninstalled(assistantId) {
  const id = String(assistantId || '').trim()
  if (!id) return
  const list = getUninstalledIds()
  if (!list.includes(id)) {
    saveGlobalSettings({ [UNINSTALL_KEY]: [...list, id] })
  }
}

export function clearUninstallMarkers() {
  saveGlobalSettings({ [UNINSTALL_KEY]: [] })
}

/* ────────── 注入逻辑 ────────── */

const ALL_NEW_ASSISTANTS = [
  ...EXTRA_BUILTIN_ASSISTANTS,
  ...P5_BUILTIN_ASSISTANTS,
  ...P5_PLUS_BUILTIN_ASSISTANTS
]

/**
 * 启动期迁移。返回 { migrated, kept, total }。
 * 重复调用幂等。
 */
export async function installRuntimeAssistants(options = {}) {
  const force = options.force === true
  const settings = loadGlobalSettings()
  const lastVersion = Number(settings[INSTALL_KEY]) || 0

  // 已是当前版本且非 force → 直接 return(避免每次启动重新 saveCustomAssistants)
  if (!force && lastVersion >= CURRENT_VERSION) {
    return { migrated: 0, kept: 0, alreadyAtVersion: true, version: lastVersion }
  }

  let m
  try { m = await getSettingsModule() }
  catch (e) { return { installed: 0, skipped: 0, error: 'assistantSettings 不可用: ' + String(e?.message || e) } }

  const rawCustom = Array.isArray(settings[CUSTOM_ASSISTANTS_KEY]) ? settings[CUSTOM_ASSISTANTS_KEY] : null
  let custom = []
  if (rawCustom) {
    custom = rawCustom
  } else {
    try { custom = m.getCustomAssistants() || [] } catch (_) {}
  }
  const builtinIds = new Set(ALL_NEW_ASSISTANTS.map(item => String(item?.id || '').trim()).filter(Boolean))
  const remaining = []
  const migrated = []
  for (const assistant of custom) {
    const id = String(assistant?.id || '').trim()
    const isOldAutoInstalled = assistant?._source === 'auto-installed' && builtinIds.has(id)
    if (isOldAutoInstalled) {
      migrated.push(id)
    } else {
      remaining.push(assistant)
    }
  }

  if (migrated.length === 0) {
    saveGlobalSettings({ [INSTALL_KEY]: CURRENT_VERSION })
    return { migrated: 0, kept: remaining.length, alreadyAtVersion: false, version: CURRENT_VERSION }
  }

  try {
    m.saveCustomAssistants(remaining)
    saveGlobalSettings({ [INSTALL_KEY]: CURRENT_VERSION })
    return { migrated: migrated.length, kept: remaining.length, version: CURRENT_VERSION }
  } catch (e) {
    return { migrated: 0, kept: custom.length, error: String(e?.message || e) }
  }
}

/**
 * 列出哪些是 auto-installed(给设置页 / 调试用)。
 */
export async function listAutoInstalled() {
  const settings = loadGlobalSettings()
  const custom = Array.isArray(settings[CUSTOM_ASSISTANTS_KEY]) ? settings[CUSTOM_ASSISTANTS_KEY] : []
  return custom.filter(a => a?._source === 'auto-installed')
}

/**
 * 用户主动批量卸载 auto-installed 助手(给"还原"按钮用)。
 */
export async function uninstallAllAutoInstalled() {
  let m
  try { m = await getSettingsModule() } catch (_) { return { uninstalled: 0 } }
  const settings = loadGlobalSettings()
  const custom = Array.isArray(settings[CUSTOM_ASSISTANTS_KEY]) ? settings[CUSTOM_ASSISTANTS_KEY] : []
  const remaining = []
  const uninstalledIds = []
  for (const a of custom) {
    if (a?._source === 'auto-installed') {
      uninstalledIds.push(a.id)
    } else {
      remaining.push(a)
    }
  }
  if (uninstalledIds.length === 0) return { uninstalled: 0 }
  try {
    m.saveCustomAssistants(remaining)
    const existing = getUninstalledIds()
    saveGlobalSettings({
      [UNINSTALL_KEY]: Array.from(new Set([...existing, ...uninstalledIds]))
    })
    return { uninstalled: uninstalledIds.length }
  } catch (e) {
    return { uninstalled: 0, error: String(e?.message || e) }
  }
}

export const NEW_ASSISTANT_COUNT = ALL_NEW_ASSISTANTS.length

export default {
  installRuntimeAssistants,
  markAsUninstalled,
  clearUninstallMarkers,
  listAutoInstalled,
  uninstallAllAutoInstalled,
  NEW_ASSISTANT_COUNT
}
