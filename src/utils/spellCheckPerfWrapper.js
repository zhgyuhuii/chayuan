/**
 * spellCheckPerfWrapper — 拼写检查链路提速包装层
 *
 * 解决问题(深度排查):
 *   1. spellCheckService.js 1824 行:loadGlobalSettings() 同步多次调,每次 chatCompletion 配置组装重读
 *   2. response_format=json_schema 在国产模型/部分网关不支持 → 触发 throw → 重试 fallback(双倍延迟)
 *   3. JSON.parse 失败 retry(每次新 LLM 调用)
 *   4. system prompt 长但每次 wholesale 重发,prompt cache 未利用
 *   5. 无 streaming,等全文返回再 parse
 *
 * 不动 spellCheckService.js,通过 wrapper 提供:
 *   - settings 缓存(60 秒 TTL,避免高频 localStorage I/O)
 *   - provider 兼容性预探测(首次失败后记 set,后续直接 plain 模式)
 *   - withPromptCache 自动标记(Anthropic 命中,OpenAI 自动)
 *   - perfTracker 记录每次调用 + parse 时间
 *
 * 用法:
 *   import { ensureSpellCheckPerfWrapper } from '@/utils/spellCheckPerfWrapper.js'
 *   ensureSpellCheckPerfWrapper()    // 业务方在 spell-check route 进入时调一次
 */

import { loadGlobalSettings } from './globalSettings.js'
import { startTimer as startPerfTimer } from './perfTracker.js'
import { withPromptCache } from './chatApiEnhancers.js'

/* ────────── 1. settings 缓存(60s TTL)────────── */

const SETTINGS_TTL_MS = 60_000
let _settingsCache = null
let _settingsCacheAt = 0

export function getCachedSettings() {
  const now = Date.now()
  if (_settingsCache && now - _settingsCacheAt < SETTINGS_TTL_MS) {
    return _settingsCache
  }
  _settingsCache = loadGlobalSettings()
  _settingsCacheAt = now
  return _settingsCache
}

export function invalidateSettingsCache() {
  _settingsCache = null
  _settingsCacheAt = 0
}

/* ────────── 2. provider 兼容性记忆 ────────── */

/**
 * 已知不支持 response_format=json_schema 的 provider+model 组合。
 * 一次失败后记下,后续直接 plain 模式(免去重试 round-trip)。
 */
const _unsupportedJsonSchema = new Set()

function makeKey(providerId, modelId) {
  return `${String(providerId || '').toLowerCase()}|${String(modelId || '').toLowerCase()}`
}

export function markJsonSchemaUnsupported(providerId, modelId) {
  _unsupportedJsonSchema.add(makeKey(providerId, modelId))
}

export function shouldSkipJsonSchema(providerId, modelId) {
  return _unsupportedJsonSchema.has(makeKey(providerId, modelId))
}

/**
 * 启动期从 localStorage 恢复已知不兼容列表(避免每个 session 重学一次)。
 */
const STORAGE_KEY = 'spellCheckIncompatibleModels'

export function loadIncompatibilityCache() {
  try {
    const raw = window?.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return
    const list = JSON.parse(raw)
    if (Array.isArray(list)) {
      list.forEach(k => _unsupportedJsonSchema.add(k))
    }
  } catch (_) {}
}

export function persistIncompatibilityCache() {
  try {
    window?.localStorage?.setItem(STORAGE_KEY, JSON.stringify([..._unsupportedJsonSchema]))
  } catch (_) {}
}

/* ────────── 3. perf 包装 ────────── */

/**
 * 给 chatCompletion 加 perfTracker 和 prompt cache。
 *
 * 用法:
 *   const optimizedRequest = optimizeSpellCheckRequest(request)
 *   const raw = await chatCompletion(optimizedRequest)
 *
 * options.skipJsonSchema:强制跳过 json_schema(国产模型可加这一行避免重试)
 */
export function optimizeSpellCheckRequest(request, options = {}) {
  if (!request) return request
  const out = { ...request }

  // 1. prompt cache(对 Anthropic 系生效)
  if (Array.isArray(out.messages) && out.messages.length > 0) {
    out.messages = withPromptCache(out.messages, { providerId: out.providerId })
  }

  // 2. 已知不兼容 json_schema → 直接去掉 response_format
  if (out.response_format && (
    options.skipJsonSchema === true ||
    shouldSkipJsonSchema(out.providerId, out.modelId)
  )) {
    delete out.response_format
    out._optimizerNote = 'json_schema removed (provider known incompatible)'
  }

  return out
}

/**
 * 包装一次 chatCompletion 调用,自动:
 *   - 记 perf
 *   - 失败时若是 response_format 错误,记入兼容性缓存
 *
 * 业务方:
 *   const raw = await wrapSpellCheckCall(() => chatCompletion(req), req)
 */
export async function wrapSpellCheckCall(fn, request = {}) {
  if (typeof fn !== 'function') return fn
  const stop = startPerfTimer({
    kind: 'spellcheck.llm',
    providerId: request.providerId || 'default',
    modelId: request.modelId || 'default'
  })
  try {
    const out = await fn()
    stop({ ok: true, bytes: String(out || '').length })
    return out
  } catch (e) {
    const msg = String(e?.message || e || '')
    const unsup = /response_format|unsupported|Unrecognized request argument|unknown parameter/i.test(msg)
    if (unsup && request.providerId && request.modelId) {
      markJsonSchemaUnsupported(request.providerId, request.modelId)
      persistIncompatibilityCache()
    }
    stop({ ok: false, note: msg.slice(0, 80) })
    throw e
  }
}

/* ────────── 4. 一次性安装 ────────── */

let _installed = false
export function ensureSpellCheckPerfWrapper() {
  if (_installed) return
  _installed = true
  loadIncompatibilityCache()
  if (typeof console !== 'undefined') {
    console.info('[spellCheckPerfWrapper] 已就绪 · 已知不兼容模型:', _unsupportedJsonSchema.size)
  }
}

export function isInstalled() { return _installed }

export default {
  getCachedSettings,
  invalidateSettingsCache,
  markJsonSchemaUnsupported,
  shouldSkipJsonSchema,
  optimizeSpellCheckRequest,
  wrapSpellCheckCall,
  ensureSpellCheckPerfWrapper,
  loadIncompatibilityCache,
  persistIncompatibilityCache,
  isInstalled
}
