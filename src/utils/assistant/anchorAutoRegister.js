/**
 * anchorAutoRegister — 助手创建/导入时自动 registerAnchor
 *
 * 解决 P6 问题:promotionFlow 用 getAnchor 检测漂移,但没人在助手创建时
 * 注册 anchor → driftScore 永远 = 0 → 漂移检测形同虚设。
 *
 * 用法:
 *   import { autoRegisterAnchor, scanAndRegisterAllAnchors } from '...'
 *
 *   // 创建/导入助手后立即调:
 *   autoRegisterAnchor(assistant)
 *
 *   // 启动期一次性扫描已存在的助手:
 *   scanAndRegisterAllAnchors()
 */

import { registerAnchor, getAnchor } from './evolution/anchorPrompt.js'

/**
 * 给一个助手对象注册 anchor。
 * 已注册过 → 跳过(除非 force=true)。
 */
export function autoRegisterAnchor(assistant, options = {}) {
  if (!assistant?.id) return null
  const existing = getAnchor(assistant.id)
  if (existing && options.force !== true) return existing

  return registerAnchor(assistant.id, {
    systemPrompt: String(assistant.systemPrompt || ''),
    userPromptTemplate: String(assistant.userPromptTemplate || '')
  }, { force: options.force === true })
}

/**
 * 扫描 customAssistants + builtin,给所有未注册的助手补 anchor。
 *   options.getAssistants  函数,返回 assistant 数组;省略则用 import 的 getCustomAssistants
 *   options.includeBuiltin 默认 true
 */
export async function scanAndRegisterAllAnchors(options = {}) {
  let assistants = []
  if (typeof options.getAssistants === 'function') {
    assistants = (await options.getAssistants()) || []
  } else {
    try {
      const settings = await import('../assistantSettings.js')
      const custom = settings.getCustomAssistants?.() || []
      assistants = [...assistants, ...custom]
    } catch (_) {}
    if (options.includeBuiltin !== false) {
      try {
        const reg = await import('../assistantRegistry.js')
        const builtin = reg.getBuiltinAssistants?.() || []
        assistants = [...assistants, ...builtin]
      } catch (_) {}
    }
  }

  let registered = 0
  let skipped = 0
  for (const a of assistants) {
    const r = autoRegisterAnchor(a)
    if (r) registered += 1
    else skipped += 1
  }
  return { total: assistants.length, registered, skipped }
}

export default {
  autoRegisterAnchor,
  scanAndRegisterAllAnchors
}
