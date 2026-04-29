/**
 * ribbon/modelHelpers — 从 ribbon.js 抽出的纯函数工具
 *
 * 只放无副作用、不依赖 window.Application 的逻辑。
 * 状态相关的 modelList / selectedModelIndex / loadModelList / setDefaultModels
 * **不动**,仍留在 ribbon.js 中(它们与 PluginStorage / ribbonUI 强耦合,
 * 拆出来风险大于收益)。
 *
 * 这层主要服务于:
 *   - ribbon.js 内部 import 后,模块顶部少一些杂项
 *   - 单元测试可直接 import 测试,不需要桩 window
 *   - 未来如果要做 ribbon 全量拆分,这里是已经 ready 的着陆点
 */

/** OpenAI 系列模型 id 关键字,用于默认选中。大小写不敏感比较时用。 */
export const OPENAI_MODEL_IDS = Object.freeze([
  'gpt-4o', 'gpt-4', 'gpt-4-turbo',
  'o1', 'o3', 'o4',
  'gpt_o1', 'gpt-5', 'gpt-3.5',
  'openai'
])

/**
 * 找列表中第一个 OpenAI 系模型的下标。找不到 → 0(默认选第一个)。
 *   list: [{ id, ... }] 或 string[]
 */
export function getOpenAIModelIndex(list) {
  if (!Array.isArray(list) || list.length === 0) return 0
  const idx = list.findIndex(m => {
    if (!m) return false
    const idStr = typeof m === 'string' ? m : String(m.id || '')
    return OPENAI_MODEL_IDS.includes(idStr.toLowerCase())
  })
  return idx >= 0 ? idx : 0
}

/**
 * 在 modelList 里按 id 找下标;找不到返回 -1。
 *   兼容 id 大小写混用。
 */
export function findModelIndexById(list, id) {
  if (!Array.isArray(list) || list.length === 0 || !id) return -1
  const target = String(id).toLowerCase()
  return list.findIndex(m => {
    if (!m) return false
    const idStr = typeof m === 'string' ? m : String(m.id || '')
    return idStr.toLowerCase() === target
  })
}

/**
 * 给模型对象推断显示名:优先 m.name → m.label → m.id → 'unknown'。
 */
export function getDisplayName(model) {
  if (!model) return 'unknown'
  if (typeof model === 'string') return model
  return String(model.name || model.label || model.id || 'unknown')
}

/**
 * 把一个模型记录归一化为一个稳定的 lookup key。用于持久化 selectedModel 时不依赖 index。
 */
export function getStableKey(model) {
  if (!model) return ''
  if (typeof model === 'string') return model
  return String(model.id || model.name || '')
}

export default {
  OPENAI_MODEL_IDS,
  getOpenAIModelIndex,
  findModelIndexById,
  getDisplayName,
  getStableKey
}
