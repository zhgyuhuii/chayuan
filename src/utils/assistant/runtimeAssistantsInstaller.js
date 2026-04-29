/**
 * runtimeAssistantsInstaller — 启动期把 P3+P5+P5+ 的 18 个新助手注入到用户列表
 *
 * 解决问题:
 *   - 18 个新助手数据已写入 builtinAssistantsExtra.js / P5.js / P5Plus.js
 *   - 但 assistantRegistry.getBuiltinAssistants() 是 const 数组,运行时无法扩展
 *   - merge helper 只在非主线 externalAssistants.listAllKnownAssistants() 调用,实际 UI 看不到
 *
 * 解决方案:
 *   启动期(App.vue onMounted)调一次 installRuntimeAssistants():
 *     1. 读 customAssistants 仓库
 *     2. 遍历 18 个新助手,id 不在仓库且不在 _uninstallMarker 列表 → 注入
 *     3. 注入时标记 _source: 'auto-installed' + _autoInstalledAt
 *     4. 用户编辑 / 删除后 → 写 _uninstallMarker(防止"复活")
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
const CURRENT_VERSION = 1   // 改这个数字 → 强制重新检查注入

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
 * 启动期注入。返回 { installed, skipped, total }。
 * 重复调用幂等(基于 id 检查)。
 */
export async function installRuntimeAssistants(options = {}) {
  const force = options.force === true
  const settings = loadGlobalSettings()
  const lastVersion = Number(settings[INSTALL_KEY]) || 0

  // 已是当前版本且非 force → 直接 return(避免每次启动重新 saveCustomAssistants)
  if (!force && lastVersion >= CURRENT_VERSION) {
    return { installed: 0, skipped: 0, alreadyAtVersion: true, version: lastVersion }
  }

  let m
  try { m = await getSettingsModule() }
  catch (e) { return { installed: 0, skipped: 0, error: 'assistantSettings 不可用: ' + String(e?.message || e) } }

  let custom = []
  try { custom = m.getCustomAssistants() || [] } catch (_) {}
  const existingIds = new Set(custom.map(a => String(a?.id || '').trim()))
  const uninstalled = new Set(getUninstalledIds())

  const toInstall = []
  let skipped = 0

  for (const tpl of ALL_NEW_ASSISTANTS) {
    const id = tpl.id
    if (existingIds.has(id)) { skipped += 1; continue }
    if (uninstalled.has(id) && !force) { skipped += 1; continue }
    toInstall.push({
      ...JSON.parse(JSON.stringify(tpl)),
      enabled: true,
      isPromoted: false,
      _source: 'auto-installed',
      _autoInstalledAt: new Date().toISOString(),
      _autoInstallVersion: CURRENT_VERSION
    })
  }

  if (toInstall.length === 0) {
    saveGlobalSettings({ [INSTALL_KEY]: CURRENT_VERSION })
    return { installed: 0, skipped, alreadyAtVersion: false, version: CURRENT_VERSION }
  }

  try {
    m.saveCustomAssistants([...custom, ...toInstall])
    saveGlobalSettings({ [INSTALL_KEY]: CURRENT_VERSION })

    // 注入后给每个新助手 register anchor(漂移检测的基线),静默失败不影响主流程
    try {
      const { autoRegisterAnchor } = await import('./anchorAutoRegister.js')
      for (const a of toInstall) {
        try { autoRegisterAnchor(a) } catch (_) {}
      }
    } catch (_) { /* anchor 模块缺失也不致命 */ }

    return { installed: toInstall.length, skipped, version: CURRENT_VERSION }
  } catch (e) {
    return { installed: 0, skipped, error: String(e?.message || e) }
  }
}

/**
 * 列出哪些是 auto-installed(给设置页 / 调试用)。
 */
export async function listAutoInstalled() {
  let custom = []
  try {
    const m = await getSettingsModule()
    custom = m.getCustomAssistants() || []
  } catch (_) {}
  return custom.filter(a => a?._source === 'auto-installed')
}

/**
 * 用户主动批量卸载 auto-installed 助手(给"还原"按钮用)。
 */
export async function uninstallAllAutoInstalled() {
  let m
  try { m = await getSettingsModule() } catch (_) { return { uninstalled: 0 } }
  let custom = []
  try { custom = m.getCustomAssistants() || [] } catch (_) {}
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
