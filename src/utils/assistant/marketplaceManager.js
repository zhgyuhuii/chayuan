/**
 * marketplaceManager — 应用市场安装 / 卸载 / 简易签名校验
 *
 * v2 计划 P5「应用市场骨架(签名验证 + 安装/卸载)」。本地实现版本:
 *   - install(packageJson)  → 校验 + 注册
 *   - uninstall(id)         → 反注册 + 清状态
 *   - listInstalled()       → 已安装清单
 *   - 签名:用 djb2 hash + 已知公钥前缀做"轻量校验"(非密码学安全,仅防意外篡改)
 *
 * 真正密码学签名留给后续(Web Crypto SubtleCrypto)。
 */

import { registerExternalAssistant, unregisterExternalAssistant } from './externalAssistants.js'
import { loadGlobalSettings, saveGlobalSettings } from '../globalSettings.js'

const INSTALLED_KEY = 'marketplaceInstalled'
const TRUSTED_PUBLISHERS = Object.freeze([
  'chayuan-official',
  'chayuan-team',
  'chayuan-community'
])

/* ────────── 内部 ────────── */

function loadInstalled() {
  const s = loadGlobalSettings()
  return Array.isArray(s[INSTALLED_KEY]) ? s[INSTALLED_KEY] : []
}
function saveInstalled(list) {
  return saveGlobalSettings({ [INSTALLED_KEY]: list })
}

/** djb2 hash;用于轻量"签名"对照。 */
function djb2(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * 计算包的"指纹"(把 assistant 字段 + publisher 串起来 hash)。
 *   伪签名 = `${publisher}:${djb2(...)}`
 *   pkg.signature 必须等于此值才视为有效。
 */
function computeFingerprint(pkg) {
  const a = pkg.assistant || {}
  const payload = [
    pkg.publisher || '',
    a.id || '',
    a.label || '',
    a.systemPrompt || '',
    a.userPromptTemplate || ''
  ].join('|')
  return `${pkg.publisher || 'unknown'}:${djb2(payload)}`
}

/* ────────── 安装 / 卸载 ────────── */

/**
 * 安装一个 marketplace 包。
 *   pkg = {
 *     publisher: 'chayuan-official',  // 必须在 TRUSTED_PUBLISHERS 中
 *     signature: '...',                // 等于 computeFingerprint(pkg)
 *     packageId: 'pkg.spell-check-pro',
 *     version: '1.2.3',
 *     installedAt?,
 *     assistant: { ...same as builtin schema... }
 *   }
 *
 * 返回 { ok, error, packageId }
 */
export function install(pkg, options = {}) {
  if (!pkg || typeof pkg !== 'object') return { ok: false, error: 'pkg 必填' }
  if (!pkg.publisher) return { ok: false, error: '缺 publisher' }
  if (!TRUSTED_PUBLISHERS.includes(pkg.publisher) && options.allowUntrusted !== true) {
    return { ok: false, error: `publisher "${pkg.publisher}" 不在受信任列表中(用 options.allowUntrusted=true 强装)` }
  }
  const expected = computeFingerprint(pkg)
  if (pkg.signature !== expected && options.skipSignatureCheck !== true) {
    return { ok: false, error: `签名不匹配(expected=${expected}, got=${pkg.signature})` }
  }
  const a = pkg.assistant
  if (!a?.systemPrompt) return { ok: false, error: 'assistant.systemPrompt 缺失' }

  const packageId = String(pkg.packageId || `pkg.${a.id}`)
  const externalId = `ext.market.${packageId}`

  const list = loadInstalled()
  const idx = list.findIndex(p => p.packageId === packageId)
  const record = {
    packageId,
    publisher: pkg.publisher,
    version: String(pkg.version || '0.0.1'),
    assistantId: externalId,
    installedAt: idx >= 0 ? list[idx].installedAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  // 先反注册旧版(若已安装)
  if (idx >= 0) {
    try { unregisterExternalAssistant(list[idx].assistantId) } catch (_) {}
    list[idx] = record
  } else {
    list.push(record)
  }
  saveInstalled(list)

  const r = registerExternalAssistant({ ...a, id: externalId })
  if (!r.ok) {
    // 回滚
    saveInstalled(list.filter(p => p.packageId !== packageId))
    return { ok: false, error: `assistant 注册失败: ${r.error}` }
  }
  return { ok: true, packageId, assistantId: externalId }
}

/**
 * 卸载一个 package(通过 packageId)。
 */
export function uninstall(packageId) {
  const id = String(packageId || '')
  const list = loadInstalled()
  const idx = list.findIndex(p => p.packageId === id)
  if (idx < 0) return { ok: false, error: '未安装' }
  const record = list[idx]
  try { unregisterExternalAssistant(record.assistantId) } catch (_) {}
  saveInstalled(list.filter((_, i) => i !== idx))
  return { ok: true, packageId: id }
}

/* ────────── 查询 ────────── */

export function listInstalled() {
  return loadInstalled()
}

export function getInstalled(packageId) {
  return loadInstalled().find(p => p.packageId === String(packageId || '')) || null
}

export function isInstalled(packageId) {
  return loadInstalled().some(p => p.packageId === String(packageId || ''))
}

/* ────────── 工具 ────────── */

/**
 * 给开发者打一个合法签名(用于自行编译插件包并发到 marketplace 时)。
 */
export function signPackage(pkg) {
  return computeFingerprint(pkg)
}

export const TRUSTED_PUBLISHER_LIST = TRUSTED_PUBLISHERS

export default {
  install,
  uninstall,
  listInstalled,
  getInstalled,
  isInstalled,
  signPackage,
  TRUSTED_PUBLISHER_LIST
}
