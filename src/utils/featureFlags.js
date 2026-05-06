/**
 * featureFlags — 运行时功能开关
 *
 * 用法:
 *   import { isEnabled, setFlag } from '@/utils/featureFlags.js'
 *   if (isEnabled('enhancedSend')) doNewPath()
 *
 *   setFlag('enhancedSend', true)        // 启用
 *   setFlag('enhancedSend', false)       // 关闭
 *
 * 持久到 localStorage,跨刷新生效。
 * 默认所有 flag 都 false(谨慎默认)。
 */

const KEY = 'chayuanFeatureFlags'

const KNOWN_FLAGS = Object.freeze({
  enhancedSend:        { default: false, description: '启用 enhancedSend 高置信短路 + 乐观流式' },
  shadowDoubleRun:     { default: false, description: '所有 chatCompletion 同步触发 runWithShadow' },
  parallelChunksAuto:  { default: false, description: '默认开启 parallelChunks=4(否则需助手 config 显式)' },
  rolloutBucketing:    { default: false, description: '启用 5%→25%→50%→100% 灰度分桶' },
  personalMemoryInject:{ default: false, description: '把 personalMemory 注入 system prompt' },
  rateLimiter:         { default: false, description: '启用 LLM 调用 token bucket 限流' },
  experimentalAbortV2: { default: false, description: '启用改进的 chatApiAbortAware' },
  kbRemoteIntegration: { default: true,  description: '启用远程知识库集成(检索/引用/下载);灰度回滚开关' }
})

function load() {
  try {
    const raw = window?.localStorage?.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch { return {} }
}

function save(map) {
  try { window?.localStorage?.setItem(KEY, JSON.stringify(map)) } catch {}
}

const _listeners = new Set()
function notify(flag, value) {
  for (const fn of _listeners) {
    try { fn({ flag, value }) } catch (_) {}
  }
}

/* ────────── API ────────── */

export function isEnabled(flag) {
  if (!KNOWN_FLAGS[flag]) return false
  const map = load()
  if (Object.prototype.hasOwnProperty.call(map, flag)) return map[flag] === true
  return KNOWN_FLAGS[flag].default
}

export function setFlag(flag, on) {
  if (!KNOWN_FLAGS[flag]) {
    if (typeof console !== 'undefined') console.warn(`[featureFlags] 未知 flag: ${flag}`)
    return false
  }
  const map = load()
  map[flag] = !!on
  save(map)
  notify(flag, !!on)
  return true
}

export function listFlags() {
  return Object.entries(KNOWN_FLAGS).map(([flag, meta]) => ({
    flag,
    description: meta.description,
    default: meta.default,
    current: isEnabled(flag)
  }))
}

export function resetAll() {
  save({})
  for (const [flag, meta] of Object.entries(KNOWN_FLAGS)) {
    notify(flag, meta.default)
  }
}

export function subscribe(fn) {
  if (typeof fn !== 'function') return () => {}
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

export const FLAGS = Object.freeze(Object.keys(KNOWN_FLAGS))

export default {
  isEnabled,
  setFlag,
  listFlags,
  resetAll,
  subscribe,
  FLAGS
}
