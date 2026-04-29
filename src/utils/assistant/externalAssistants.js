/**
 * externalAssistants — 第三方/用户扩展助手注册 SDK
 *
 * 让用户脚本/插件在运行时插入新助手,不必动 assistantRegistry.js 主文件。
 * 注册的助手会:
 *   - 被 listAllKnownAssistants() 列出(builtin + extra + P5 + external)
 *   - 出现在 /marketplace 页面
 *   - 在用户启用后(saveCustomAssistants),走与 customAssistant 相同的运行时
 *
 * 安全约束:
 *   - external 助手默认 isEnabled=false,需要用户在 marketplace 显式启用
 *   - id 必须以 'ext.' 前缀(避免与 builtin 冲突)
 *   - 不允许覆盖已存在的 builtin id
 *
 * 用法(用户/插件脚本):
 *   import { registerExternalAssistant } from '@/utils/assistant/externalAssistants.js'
 *   registerExternalAssistant({
 *     id: 'ext.legal-cn-tax',
 *     label: '中国增值税条款检查',
 *     icon: '💰',
 *     systemPrompt: '...',
 *     userPromptTemplate: '...',
 *     defaultAction: 'comment',
 *     defaultOutputFormat: 'json',
 *     defaultInputSource: 'document'
 *   })
 */

import { getBuiltinAssistantMap } from '../assistantRegistry.js'
import { mergeExtraIntoBuiltins } from './builtinAssistantsExtra.js'
import { mergeP5IntoBuiltins } from './builtinAssistantsP5.js'

const _externals = new Map()
const _listeners = new Set()

const REQUIRED_PREFIX = 'ext.'
const REQUIRED_FIELDS = ['id', 'label', 'systemPrompt']

function notify() {
  for (const fn of _listeners) {
    try { fn(listExternalAssistants()) } catch (_) {}
  }
}

function validate(asst) {
  if (!asst || typeof asst !== 'object') {
    return 'asst 必须是对象'
  }
  for (const f of REQUIRED_FIELDS) {
    if (!asst[f]) return `缺少必填字段: ${f}`
  }
  if (!String(asst.id).startsWith(REQUIRED_PREFIX)) {
    return `id 必须以 "${REQUIRED_PREFIX}" 开头(避免与内置助手冲突)`
  }
  // 不允许覆盖 builtin
  const builtinMap = getBuiltinAssistantMap?.() || {}
  if (builtinMap[asst.id]) {
    return `id "${asst.id}" 与内置助手冲突`
  }
  return ''
}

function normalize(asst) {
  return {
    id: String(asst.id).trim(),
    label: String(asst.label).trim(),
    shortLabel: asst.shortLabel || asst.label,
    icon: asst.icon || '🧩',
    group: asst.group || 'analysis',
    modelType: asst.modelType || 'chat',
    defaultModelCategory: asst.defaultModelCategory || 'chat',
    supportsRibbon: asst.supportsRibbon === true,
    defaultDisplayLocations: Array.isArray(asst.defaultDisplayLocations)
      ? asst.defaultDisplayLocations
      : ['ribbon-more'],
    allowedActions: Array.isArray(asst.allowedActions)
      ? asst.allowedActions
      : ['replace', 'comment', 'append', 'insert-after'],
    defaultAction: asst.defaultAction || 'comment',
    defaultOutputFormat: asst.defaultOutputFormat || 'plain',
    defaultInputSource: asst.defaultInputSource || 'selection-preferred',
    description: asst.description || '',
    systemPrompt: asst.systemPrompt,
    userPromptTemplate: asst.userPromptTemplate || '{text}',
    _source: 'external',
    _registeredAt: Date.now()
  }
}

/* ────────── 注册 ────────── */

/**
 * 注册一个外部助手。返回 { ok, error, assistantId }。
 */
export function registerExternalAssistant(assistant) {
  const err = validate(assistant)
  if (err) return { ok: false, error: err, assistantId: '' }
  const norm = normalize(assistant)
  _externals.set(norm.id, norm)
  notify()
  return { ok: true, error: '', assistantId: norm.id }
}

/**
 * 批量注册。返回 { registered: number, errors: [{id, error}] }。
 */
export function registerExternalAssistants(list) {
  const result = { registered: 0, errors: [] }
  for (const item of (list || [])) {
    const r = registerExternalAssistant(item)
    if (r.ok) result.registered += 1
    else result.errors.push({ id: item?.id, error: r.error })
  }
  return result
}

export function unregisterExternalAssistant(id) {
  const removed = _externals.delete(String(id || '').trim())
  if (removed) notify()
  return removed
}

/* ────────── 读 ────────── */

export function listExternalAssistants() {
  return Array.from(_externals.values())
}

export function getExternalAssistant(id) {
  return _externals.get(String(id || '').trim()) || null
}

export function hasExternalAssistant(id) {
  return _externals.has(String(id || '').trim())
}

/* ────────── 一站式 union 视图 ────────── */

/**
 * 把 builtin + extra(P3) + P5 + external 4 类汇总成一个去重列表。
 * 同 id 优先 builtin > extra > P5 > external(防止用户用 ext. 之外的 id 注册时混淆)。
 */
export function listAllKnownAssistants(baseBuiltins) {
  // baseBuiltins 通常是 getBuiltinAssistants() 的返回(为避免循环引用,由调用方提供)
  let merged = Array.isArray(baseBuiltins) ? baseBuiltins : []
  merged = mergeExtraIntoBuiltins(merged)
  merged = mergeP5IntoBuiltins(merged)
  // external:严格 ext. 前缀,不会与上面 id 冲突
  const seen = new Set(merged.map(a => a?.id))
  for (const ext of listExternalAssistants()) {
    if (!seen.has(ext.id)) merged.push(JSON.parse(JSON.stringify(ext)))
  }
  return merged
}

/* ────────── 订阅(给 marketplace 页用) ────────── */

export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {}
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

export default {
  registerExternalAssistant,
  registerExternalAssistants,
  unregisterExternalAssistant,
  listExternalAssistants,
  getExternalAssistant,
  hasExternalAssistant,
  listAllKnownAssistants,
  subscribe
}
