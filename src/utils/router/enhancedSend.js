/**
 * enhancedSend — sendMessage 链路的高层"组合外挂"
 *
 * 不动 AIAssistantDialog.vue(19111 行)的 sendMessage,
 * 把"快速本地分类 + 乐观流式 + abort 中断 + perf 记录"
 * 拼成一个**业务方主动调用**的封装。
 *
 *   const send = createEnhancedSender({
 *     providerId, modelId,
 *     getSelection,           // () => string  当前选区
 *     getAttachments,         // () => any[]   附件
 *     onShortcut,             // ({ kind, score }) => void  本地分类高置信回调
 *     onChunk, onDone, onError
 *   })
 *
 *   await send(userText)
 *
 * 内部:
 *   1. fastClassifyAndShortcut → 高置信(score≥85)且 kind=chat → 直接 enhancedStream
 *      ↳ 跳过原本可能 4 次 LLM 路由判定,首字符理论可压到 ≤500ms
 *   2. 非高置信 → 把分类结果交给 onShortcut,业务方自行决定走 sendMessage 原链路
 *   3. 流式过程自动写 perfTracker(kind 含 'send' 标签)
 *   4. AbortController 暴露给调用方:`send.abort()` 中断当前
 */

import { fastClassifyAndShortcut } from './sendMessageEnhanced.js'
import { enhancedStream } from './enhancedChatApi.js'

const SHORTCUT_THRESHOLD = 85

/**
 * 创建一个增强 sender。返回的函数:
 *   send(text) → Promise<string>   chat 路径返回完整文本;非 chat 抛 'use-fallback'
 *   send.abort()                    中断当前流式
 *   send.lastClassification         上次分类结果(调试用)
 */
export function createEnhancedSender(options = {}) {
  const cfg = {
    providerId: options.providerId,
    modelId: options.modelId,
    ribbonModelId: options.ribbonModelId,
    systemPrompt: options.systemPrompt || '',
    threshold: typeof options.threshold === 'number' ? options.threshold : SHORTCUT_THRESHOLD,
    cache: options.cache !== false
  }
  let _ctrl = null

  const send = async function send(userText) {
    const text = String(userText || '').trim()
    if (!text) return ''

    // 1. 本地快速分类
    const classification = fastClassifyAndShortcut(text, {
      hasSelection: !!options.getSelection?.(),
      attachments: options.getAttachments?.() || []
    })
    send.lastClassification = classification

    // 2. 高置信 chat → 直接走流式;否则交给调用方走原链路
    const isShortcut =
      classification.kind === 'chat' &&
      classification.score >= cfg.threshold
    if (!isShortcut) {
      try { options.onShortcut?.(classification) } catch (_) {}
      // 抛特定 sentinel 错误,业务方 catch 后回退原 sendMessage
      const e = new Error('use-fallback')
      e.code = 'USE_FALLBACK'
      e.classification = classification
      throw e
    }

    // 3. abort 控制
    if (_ctrl) { try { _ctrl.abort('superseded') } catch (_) {} }
    _ctrl = new AbortController()

    // 4. 流式调用(enhancedStream 已自动 perfTracker + withPromptCache)
    try {
      const full = await enhancedStream({
        providerId: cfg.providerId,
        modelId: cfg.modelId,
        ribbonModelId: cfg.ribbonModelId,
        systemPrompt: cfg.systemPrompt,
        userText: text,
        kind: 'send.shortcut',
        cache: cfg.cache,
        signal: _ctrl.signal,
        onChunk: options.onChunk,
        onDone: options.onDone,
        onError: options.onError
      })
      return full
    } finally {
      _ctrl = null
    }
  }

  send.abort = function abort(reason) {
    if (!_ctrl) return false
    try { _ctrl.abort(reason || 'manual-abort') } catch (_) {}
    _ctrl = null
    return true
  }

  send.lastClassification = null

  return send
}

/**
 * 一次性快捷:不创建 sender,直接发一条消息(适合脚本/测试)。
 */
export async function sendOnce(options = {}) {
  const send = createEnhancedSender(options)
  return send(options.userText || '')
}

export default {
  createEnhancedSender,
  sendOnce,
  SHORTCUT_THRESHOLD
}
