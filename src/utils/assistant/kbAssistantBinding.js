/**
 * kbAssistantBinding — 把「当前对话绑定的知识库」暴露给助手执行器。
 *
 * 背景:kbBindings 是 per-chat 状态(存在 AIAssistantDialog 的 currentChat 上),
 * 而助手执行器(assistantTaskRunner)在另一层,不经过对话的 messagesForApi 管线。
 * 与其把 kbBindings 穿过 runAssistant→runAssistantTaskFromMessage→executeAssistantTask
 * 多层调用链(易错、改动面大),不如用一个轻量 provider:
 *   - 对话挂载时注册一个 getter(返回 this.currentChatKbBinding);
 *   - 执行器在运行「KB 对比类」助手(useKnowledgeBase=true)时调用 getter 取当前绑定。
 *
 * getter 失效/未注册/抛错 → 返回 null,执行器据此提示"未绑定知识库",不会崩。
 *
 * 跨 webview 说明:chat_turn 生成循环托管在 ribbon 基座 webview(chatTurnRunner),
 * 基座模块实例与本页 getter 互不可见——对话页每次绑定变更把规范化绑定发布到
 * PluginStorage(加载项级共享),基座注册存储版 getter 读取。否则基座回合里的
 * kb 检索工具永远拿到空绑定,误报「当前对话没有绑定知识库」。
 */

let _getter = null

const BINDING_STORAGE_KEY = 'ai_chat_kb_binding'

function sharedStorage() {
  try {
    return window.Application?.PluginStorage || null
  } catch (_) {
    return null
  }
}

/** 对话层注册:fn 返回规范化后的 kbBinding({ kbNames, kuIds, sourceRefs, connectionId, ... })。 */
export function setAssistantKbBindingGetter(fn) {
  _getter = typeof fn === 'function' ? fn : null
}

/** 执行器读取当前对话绑定的知识库;未注册或出错返回 null。 */
export function getAssistantKbBinding() {
  if (!_getter) return null
  try {
    return _getter() || null
  } catch (e) {
    return null
  }
}

/** 对话页发布当前绑定(每次变更调用)。空绑定清除键:解绑后基座回合不再读到旧值。 */
export function publishAssistantKbBinding(binding) {
  try {
    const store = sharedStorage()
    if (!store) return
    const hasBound = !!(binding && Array.isArray(binding.kbNames) && binding.kbNames.length)
    const payload = hasBound ? JSON.stringify({ ...binding, updatedAt: Date.now() }) : ''
    if ((store.getItem(BINDING_STORAGE_KEY) ?? '') === payload) return
    if (hasBound) store.setItem(BINDING_STORAGE_KEY, payload)
    else store.removeItem(BINDING_STORAGE_KEY)
  } catch (_) { /* 发布失败仅降级:基座回合提示未绑定,不阻断对话 */ }
}

function readPublishedAssistantKbBinding() {
  try {
    const raw = sharedStorage()?.getItem(BINDING_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.kbNames) && parsed.kbNames.length ? parsed : null
  } catch (_) {
    return null
  }
}

/** 直接读共享绑定（基座回合参数直传场景的回落源）。 */
export function readAssistantKbBinding() {
  return readPublishedAssistantKbBinding()
}

/** 基座 webview 注册:读取对话页发布的共享绑定(基座拿不到面板 webview 的内存 getter)。 */
export function registerStoredAssistantKbBindingGetter() {
  setAssistantKbBindingGetter(readPublishedAssistantKbBinding)
}

export default { setAssistantKbBindingGetter, getAssistantKbBinding }
