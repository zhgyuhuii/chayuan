/**
 * ribbon/actionHelpers — ribbon.js 抽离的纯函数(标签/可见性/上下文菜单)
 *
 * v2 P3「ribbon.js 拆为 5 个子模块」中的 labels / menus 部分。
 * 严格只移动**纯函数**,不动 stateful 部分(modelList / 动态 slot 等)。
 *
 * 这些函数可以从 ribbon.js OnGetLabel / OnGetGroupLabel / OnGetContextMenuLabel /
 * OnGetVisible 中提取出来,业务方在 ribbon.js 中 import 后调用。
 */

/* ────────── Label 派生 ────────── */

/**
 * 给定 controlId + label 词典,返回最终展示 label。
 * 不在词典里 → 返回 fallback(默认空串)。
 */
export function deriveLabel(controlId, dict, fallback = '') {
  const id = String(controlId || '')
  if (!id || !dict || typeof dict !== 'object') return fallback
  return dict[id] || fallback
}

/**
 * 把可能含 XML 特殊字符的 label 转成 ribbon XML 安全字符串。
 * 注意:这个函数与 ribbon.js 内既有的 escapeXml 重复,但作为 pure utility 暴露
 * 便于其他模块复用。
 */
export function escapeXmlForLabel(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/* ────────── 上下文菜单可见性 ────────── */

/**
 * 上下文菜单(右键)条目可见性判定。
 *   options:
 *     selectionType  'text' | 'image' | 'table-cell' | 'paragraph' | 'none'
 *     visibleFor     该 control 想要的 selection 类型(数组)
 *
 *   返回 true/false 用于 OnGetContextMenuVisible。
 */
export function isContextMenuVisibleFor(selectionType, visibleFor) {
  const t = String(selectionType || '')
  if (!t) return false
  if (!Array.isArray(visibleFor) || visibleFor.length === 0) return true
  return visibleFor.includes(t)
}

/**
 * 根据 controlId 的命名约定判断它属于哪一类:
 *   主菜单/上下文菜单/动态助手槽/翻译子菜单/...
 */
export function classifyControlId(controlId) {
  const id = String(controlId || '')
  if (!id) return 'unknown'
  if (id.startsWith('btnAssistantPrimarySlot')) return 'primary-slot'
  if (id.startsWith('btnAssistantContextMore')) return 'context-more'
  if (id.startsWith('btnTextAnalysis')) return 'text-analysis'
  if (id.startsWith('btnTranslate_')) return 'translate-lang'
  if (id.startsWith('btnContext')) return 'context-menu'
  if (id.startsWith('btnAI')) return 'ai-feature'
  if (id.startsWith('btnDoc')) return 'doc-feature'
  if (id.startsWith('btnTable')) return 'table-feature'
  if (id.startsWith('btnImage')) return 'image-feature'
  if (id.startsWith('btnSpell')) return 'spell-feature'
  if (id.startsWith('menu')) return 'menu-host'
  return 'misc'
}

/* ────────── Group label 派生 ────────── */

/**
 * 给一个 group key 返回展示用的 label;不在词典里 → 返回 key 本身。
 */
export function deriveGroupLabel(groupKey, dict = {}) {
  const k = String(groupKey || '')
  if (!k) return ''
  return dict[k] || k
}

/* ────────── PrimarySlot 占位 ────────── */

/**
 * 给定 visibleSlotCount(默认 4)和当前已绑定的 dynamic assistants,
 * 输出一个 controlId → 是否应可见的对照表。
 *   ribbon.OnGetVisible 可以用此结果直接返回。
 */
export function buildSlotVisibilityMap(assistants, visibleSlotCount = 4) {
  const arr = Array.isArray(assistants) ? assistants : []
  const cap = Math.max(0, Number(visibleSlotCount) || 0)
  const map = {}
  for (let i = 0; i < cap; i += 1) {
    map[`btnAssistantPrimarySlot${i}`] = !!arr[i]
  }
  return map
}

export default {
  deriveLabel,
  escapeXmlForLabel,
  isContextMenuVisibleFor,
  classifyControlId,
  deriveGroupLabel,
  buildSlotVisibilityMap
}
