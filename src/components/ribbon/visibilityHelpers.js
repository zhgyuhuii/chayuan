/**
 * ribbon/visibilityHelpers — Ribbon 控件可见性判定纯函数
 *
 * v2 P0 项:`OnGetVisible` 隐藏未占用 PrimarySlot,避免 label 重复 / "占位空按钮"
 * 已是当前痛点。这里给 ribbon.js 提供决策函数,业务方在 OnGetVisible 中调用。
 *
 * 不动 ribbon.js 本体(WPS COM 接线复杂,避免 blind 改),
 * 仅提供"判定逻辑"的纯函数 + 单元可测。
 */

/** PrimarySlot ID 前缀 */
const PRIMARY_SLOT_PREFIX = 'btnAssistantPrimarySlot'

/**
 * 给定 controlId,判断它是否应该可见。
 *   options:
 *     getDynamicAssistantBySlot(slotIndex) → assistant | null
 *     getRibbonSlotIndex(controlId) → number(>=0 = 该 slot 的 index)
 *     visibleSlotCount             已配置的可见 slot 数(默认 4)
 *
 * 规则:
 *   - controlId 不属于 PrimarySlot 体系 → 总是 true(交还给现有规则)
 *   - 属于 slot N,但 N >= visibleSlotCount → false
 *   - 该 slot 没绑定助手 → false
 *   - 否则 → true
 */
export function shouldShowPrimarySlot(controlId, options = {}) {
  const id = String(controlId || '')
  if (!id.startsWith(PRIMARY_SLOT_PREFIX)) return null  // 不归我管,交还
  const visible = Number(options.visibleSlotCount) >= 0 ? Number(options.visibleSlotCount) : 4
  const getSlot = options.getRibbonSlotIndex
  const getAsst = options.getDynamicAssistantBySlot
  if (typeof getSlot !== 'function' || typeof getAsst !== 'function') return true

  const slotIndex = getSlot(id)
  if (slotIndex < 0) return true       // 不是 slot,放过
  if (slotIndex >= visible) return false
  const asst = getAsst(slotIndex)
  return !!asst
}

/**
 * 从一组 dynamic assistant 列表 + 可见上限,推断"应该出现哪些 slot id"。
 * 用于在 OnGetVisible 之外做提前剪枝。
 */
export function listVisibleSlotIds(assistants, visibleSlotCount = 4) {
  const arr = Array.isArray(assistants) ? assistants : []
  const cap = Math.max(0, Number(visibleSlotCount) || 0)
  const out = []
  for (let i = 0; i < cap; i += 1) {
    if (arr[i]) out.push(`${PRIMARY_SLOT_PREFIX}${i}`)
  }
  return out
}

/**
 * Ribbon Label 去重检查器:
 *   collectDuplicateLabels(labelsByControlId) → 返回重复的 label → [controlIds]
 */
export function collectDuplicateLabels(labelsByControlId) {
  const map = new Map()
  for (const [id, label] of Object.entries(labelsByControlId || {})) {
    const key = String(label || '').trim()
    if (!key) continue
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(id)
  }
  const dup = {}
  for (const [label, ids] of map) {
    if (ids.length >= 2) dup[label] = ids
  }
  return dup
}

export default {
  shouldShowPrimarySlot,
  listVisibleSlotIds,
  collectDuplicateLabels,
  PRIMARY_SLOT_PREFIX
}
