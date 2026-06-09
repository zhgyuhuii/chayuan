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
 */

let _getter = null

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

export default { setAssistantKbBindingGetter, getAssistantKbBinding }
