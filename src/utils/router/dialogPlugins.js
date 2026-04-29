/**
 * dialogPlugins — AIAssistantDialog 的"插件钩子"机制
 *
 * v2 计划 P3 项「AIAssistantDialog 拆 6 子组件」当前不做(19111 行,无 runtime 测试条件)。
 * 退而求其次:提供一个"业务方主动接入"的钩子点,让未来拆分时有迁移目标。
 *
 * 钩子点(任意一个 hook 失败不影响其他):
 *   - 'beforeSend'(text, ctx)         发送前;返回 false 中断
 *   - 'afterClassify'(intent, ctx)   本地分类完成后
 *   - 'beforeStream'(req, ctx)       流式调用前
 *   - 'afterStream'(text, ctx)       流式完成后
 *   - 'beforeApply'(action, ctx)     文档动作执行前
 *   - 'afterApply'(result, ctx)      文档动作执行后
 *
 * 用法:
 *   import { registerHook, runHooks } from '@/utils/router/dialogPlugins.js'
 *
 *   // 插件 A:
 *   registerHook('beforeSend', async (text, ctx) => {
 *     if (text.length > 5000) {
 *       ctx.shouldUseChunking = true
 *     }
 *   })
 *
 *   // 在 sendMessage 内(AIAssistantDialog 主动调):
 *   const ctx = { ... }
 *   const ok = await runHooks('beforeSend', text, ctx)
 *   if (!ok) return
 */

const _hooks = new Map()  // hookName → Set<fn>

const VALID_HOOKS = new Set([
  'beforeSend',
  'afterClassify',
  'beforeStream',
  'afterStream',
  'beforeApply',
  'afterApply',
  'onError'
])

/**
 * 注册一个钩子。返回 unregister 函数。
 */
export function registerHook(name, fn) {
  if (!VALID_HOOKS.has(name)) {
    if (typeof console !== 'undefined') console.warn(`[dialogPlugins] 未知 hook: ${name}`)
    return () => {}
  }
  if (typeof fn !== 'function') return () => {}
  if (!_hooks.has(name)) _hooks.set(name, new Set())
  _hooks.get(name).add(fn)
  return () => _hooks.get(name)?.delete(fn)
}

/**
 * 顺序运行某个 hook 下的所有钩子。
 * 任一钩子返回严格 false → runHooks 整体返回 false(用于中断流程)。
 * 钩子异常 → 仅打 warn,不影响其他钩子和返回值。
 */
export async function runHooks(name, ...args) {
  const set = _hooks.get(name)
  if (!set || set.size === 0) return true
  let allowed = true
  for (const fn of set) {
    try {
      const out = await fn(...args)
      if (out === false) allowed = false
    } catch (e) {
      if (typeof console !== 'undefined') {
        console.warn(`[dialogPlugins] hook ${name} 抛异常:`, e?.message || e)
      }
    }
  }
  return allowed
}

/** 列出当前注册情况(给 doctor / 调试看)。 */
export function listHooks() {
  const out = {}
  for (const [name, set] of _hooks) {
    out[name] = set.size
  }
  return out
}

/** 反注册某个 hook 的所有钩子。 */
export function clearHooks(name) {
  if (name) _hooks.delete(name)
  else _hooks.clear()
}

export default {
  registerHook,
  runHooks,
  listHooks,
  clearHooks,
  VALID_HOOKS: Array.from(VALID_HOOKS)
}
