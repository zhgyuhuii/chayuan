/**
 * ribbonBusDispatcher — ribbon button id ↔ capability-bus.target 双向映射
 *
 * v2 计划 P4「Ribbon OnAction 80+ case 改写为 bus.execute」当前不动 ribbon.js,
 * 这里做"反向映射":提供一个 dispatcher,内部决定 button 对应的 bus target,
 * ribbon.js 不需要任何改动也能让 ⌘K / 外部脚本通过 bus.execute 触发同样的逻辑。
 *
 * 用法:
 *   import { dispatchByButton, registerBusBinding } from '...'
 *
 *   // 注册映射:btnXXX → namespace.action
 *   registerBusBinding('btnSpellCheck', 'docQuality.spellCheck')
 *
 *   // 当 ⌘K 命令或 marketplace 等需要触发 ribbon 行为时:
 *   await dispatchByButton('btnSpellCheck', { foo: 1 })
 *   // 内部:若 bus 已注册 'docQuality.spellCheck' → bus.execute;否则 ribbon.OnAction 兜底
 */

import { execute, hasCapability } from './capabilityBus.js'

const _bindings = new Map()  // btnId → busTarget

/**
 * 注册一个 ribbon button → bus target 的映射。
 */
export function registerBusBinding(btnId, busTarget) {
  const id = String(btnId || '').trim()
  const target = String(busTarget || '').trim()
  if (!id || !target) return false
  _bindings.set(id, target)
  return true
}

export function unregisterBusBinding(btnId) {
  return _bindings.delete(String(btnId || '').trim())
}

export function getBusBinding(btnId) {
  return _bindings.get(String(btnId || '').trim()) || ''
}

export function listBusBindings() {
  return Array.from(_bindings.entries()).map(([btnId, target]) => ({ btnId, target }))
}

/**
 * 优先走 bus,失败/没注册则 fallback 到 ribbon.OnAction。
 *   options.ribbon  显式传入 ribbon 对象;省略则取 window.ribbon
 */
export async function dispatchByButton(btnId, params = {}, options = {}) {
  const id = String(btnId || '').trim()
  if (!id) return { ok: false, reason: 'empty btnId', via: '' }

  const target = _bindings.get(id)
  if (target && hasCapability(target)) {
    try {
      const result = await execute(target, params)
      return { ok: true, result, via: 'bus' }
    } catch (e) {
      // bus 路径执行失败 → 不 fallback,因为是真实失败
      return { ok: false, reason: String(e?.message || e), via: 'bus' }
    }
  }

  // 兜底:ribbon.OnAction
  const ribbon = options.ribbon || (typeof window !== 'undefined' ? window.ribbon : null)
  if (ribbon && typeof ribbon.OnAction === 'function') {
    try {
      ribbon.OnAction({ Id: id })
      return { ok: true, via: 'ribbon' }
    } catch (e) {
      return { ok: false, reason: String(e?.message || e), via: 'ribbon' }
    }
  }
  return { ok: false, reason: 'no bus binding and no ribbon.OnAction available', via: '' }
}

/**
 * 批量注册一组绑定。
 */
export function registerBusBindings(map) {
  if (!map || typeof map !== 'object') return 0
  let count = 0
  for (const [btnId, target] of Object.entries(map)) {
    if (registerBusBinding(btnId, target)) count += 1
  }
  return count
}

/* ────────── 默认建议绑定(供调用方一次性注册) ────────── */

/**
 * 项目当前主要功能的"默认 bus 命名空间建议"。
 * 不强制注册 — 调用方按需 registerBusBindings(SUGGESTED_BINDINGS)。
 */
export const SUGGESTED_BINDINGS = Object.freeze({
  // 文档质量
  btnSpellCheck:    'docQuality.spellCheck',
  btnDocumentCheck: 'docQuality.securityCheck',
  btnAITraceCheck:  'docQuality.aiTraceCheck',

  // 助手
  btnAIAssistant:           'assistant.openDialog',
  btnCustomAssistantCreate: 'assistant.createCustom',
  btnCustomAssistantManage: 'assistant.manageCustom',
  btnTaskOrchestration:     'assistant.openTaskOrchestration',
  btnTaskList:              'assistant.openTaskList',

  // 表格 / 图片
  btnSelectAllTables:       'tableOps.selectAll',
  btnTableAutoWidth:        'tableOps.autoWidth',
  btnSelectAllImages:       'imageOps.selectAll',
  btnUniformImageFormat:    'imageOps.uniformFormat',

  // 文本批处理
  btnAppendReplaceText:     'textBatch.appendReplace',
  btnDeleteTextRow:         'textBatch.deleteRow',

  // 模板 / 表单
  btnDocumentDeclassify:    'declassify.run',
  btnFormAudit:             'formAudit.run',

  // 关于
  btnAboutChayuan:          'misc.about'
})

export default {
  registerBusBinding,
  registerBusBindings,
  unregisterBusBinding,
  getBusBinding,
  listBusBindings,
  dispatchByButton,
  SUGGESTED_BINDINGS
}
