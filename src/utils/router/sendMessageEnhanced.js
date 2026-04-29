/**
 * sendMessageEnhanced - sendMessage 链路的"增强中间件"
 *
 * 不直接改 AIAssistantDialog.vue 824 KB 的 sendMessage(风险大),
 * 提供一组 opt-in helper,业务方主动调用即可获得:
 *
 *   1. 本地意图分类(localIntentClassifier)— 高置信跳过 LLM 路由
 *   2. 乐观流式 + abort 中断 — 兜底流式与路由判定并行赛跑
 *   3. 路由模型解耦 — 路由用小模型,会话用大模型
 *   4. saveHistory 自动节流(throttledPersist)
 *   5. 信号上报(SignalStore)— 用户行为反馈
 *
 * 接入方式(渐进):
 *
 *   // 在 AIAssistantDialog.methods.sendMessage 内,最早期插入:
 *   import { fastClassifyAndShortcut } from '@/utils/router/sendMessageEnhanced.js'
 *
 *   const shortcut = fastClassifyAndShortcut(text, {
 *     hasSelection: !!this.resolveBestSelectionContext()?.text,
 *     attachments: this.attachments
 *   })
 *   if (shortcut.kind === 'chat' && shortcut.confidence === 'high') {
 *     // 直接进 chat,跳过原本 4 次 LLM 路由
 *     return this._proceedAsChat(text, prepared)
 *   }
 *   // 否则走原有 resolvePrimaryConversationIntent
 */

import { classifyIntent, isHighConfidence } from './localIntentClassifier.js'
import { idleDebounce } from '../throttledPersist.js'
import { appendSignal } from '../assistant/evolution/signalStore.js'
import { streamChatCompletion } from '../chatApi.js'
import { withPromptCache } from '../chatApiEnhancers.js'

/**
 * 入口 1:快速本地分类。
 * 高置信结果可让调用方直接短路,跳过 LLM 路由。
 *
 *   options: { hasSelection, attachments }
 *
 *   返回: classifyIntent 的标准结果 + shortcut 字段
 */
export function fastClassifyAndShortcut(text, options = {}) {
  const result = classifyIntent(text, options)
  return {
    ...result,
    shortcut: isHighConfidence(result) ? 'high-confidence-skip-llm' : ''
  }
}

/**
 * 入口 2:乐观流式 + abort 中断。
 *
 * 调用方提供一个"兜底 chat 请求构造器" buildOptimisticBody(text)
 * 和一个"对话框消息收集器" assistantMsg(由 prepareOutgoingMessages 生成)。
 *
 *   ① 立刻 streamChatCompletion 兜底(乐观)
 *   ② 同时调用方并行跑路由
 *   ③ 路由判定为 chat → resolve 直接接管 optimistic 输出
 *   ④ 路由判定为非 chat → abort,丢弃乐观输出
 *
 * 用法(伪代码):
 *
 *   const optimistic = startOptimisticStream({
 *     buildBody: () => ({ providerId, modelId, messages: [...] }),
 *     onChunk: (delta) => this.appendOptimisticChunk(delta),
 *     onError: (err) => console.warn('optimistic fail:', err)
 *   })
 *   try {
 *     const intent = await this.resolvePrimaryConversationIntentFast(text)
 *     if (intent.kind === 'chat') {
 *       optimistic.accept()             // 把已生成的字符接管为正式 chat
 *       await optimistic.done           // 等剩余流式完成
 *     } else {
 *       optimistic.discard()
 *       // 走非 chat 链路
 *     }
 *   } catch (e) { optimistic.discard() }
 */
export function startOptimisticStream(options = {}) {
  const ctrl = new AbortController()
  let accepted = false
  let discarded = false
  let buffered = ''
  let resolveDone, rejectDone
  const done = new Promise((res, rej) => { resolveDone = res; rejectDone = rej })

  const cfg = options.buildBody?.()
  if (!cfg) {
    return {
      ctrl,
      done: Promise.resolve(),
      accept() {},
      discard() {},
      isAccepted() { return false },
      isDiscarded() { return true }
    }
  }

  const messages = options.skipPromptCache
    ? cfg.messages
    : withPromptCache(cfg.messages || [], { providerId: cfg.providerId })

  // 启动兜底流式
  streamChatCompletion({
    ...cfg,
    messages,
    signal: ctrl.signal,
    onChunk: (delta) => {
      if (discarded) return
      if (accepted) {
        options.onChunk?.(delta)
      } else {
        buffered += String(delta || '')
        // 也允许调用方实时看到(标记为 optimistic)
        options.onOptimisticChunk?.(delta, buffered)
      }
    },
    onDone: () => {
      if (accepted) options.onDone?.()
      resolveDone({ accepted, discarded, buffered })
    },
    onError: (err) => {
      options.onError?.(err)
      rejectDone(err)
    }
  })

  return {
    ctrl,
    done,
    /** 接管:把已缓存的 buffer 一次 flush 给调用方,后续 chunk 直接送 onChunk */
    accept() {
      if (accepted || discarded) return
      accepted = true
      if (buffered && typeof options.onChunk === 'function') {
        // 一次性把已收集的兜底字符送出去
        options.onChunk(buffered, { catchup: true })
      }
    },
    /** 丢弃:abort 流式,已缓存内容作废 */
    discard(reason) {
      if (accepted || discarded) return
      discarded = true
      try { ctrl.abort(reason || 'optimistic-discarded') } catch (_) {}
      options.onDiscard?.(buffered)
    },
    isAccepted()  { return accepted },
    isDiscarded() { return discarded }
  }
}

/**
 * 入口 3:为 AIAssistantDialog.saveHistory 制造节流版。
 *
 *   const debouncedSave = makeThrottledHistorySaver({
 *     getValue: () => this.chatHistory,
 *     write: (blob) => localStorage.setItem('chatHistory', blob),
 *     wait: 250
 *   })
 *
 *   // 之后所有 saveHistory() 改为 debouncedSave()
 */
export function makeThrottledHistorySaver(options = {}) {
  const wait = Number(options.wait) || 250
  const getValue = typeof options.getValue === 'function' ? options.getValue : () => null
  const write = typeof options.write === 'function' ? options.write : () => {}
  let lastBlob = ''
  const doSave = () => {
    let value, blob
    try {
      value = getValue()
      blob = JSON.stringify(value)
    } catch (e) {
      return
    }
    if (blob === lastBlob) return
    try { write(blob); lastBlob = blob } catch (_) {}
  }
  return idleDebounce(doSave, { wait, idle: true, leading: false })
}

/**
 * 入口 4:任务结束时的"用户接受/撤销"信号采集 helper。
 *
 *   监听 30 秒内 Application.OnDocumentChange,
 *   若发生编辑就视为"用户主动改动了 AI 写回的位置",
 *   不一定是"撤销",但作为一个"低置信 reject"信号。
 *
 *   严格 30s undo 检测需要更精细的代码,本 helper 只做"可能撤销"标记。
 *
 *   用法:
 *     onWriteback({ assistantId, version, taskId, writeTargets })
 *       .then(result => result.userEdited && console.log('30 s 内有编辑动作'))
 */
export function onWriteback(options = {}) {
  const id = String(options.assistantId || '').trim()
  const writeAt = Date.now()
  let userEdited = false
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      // 写一条信号:accept(没编辑) / reject(有编辑)
      appendSignal({
        type: userEdited ? 'reject' : 'accept',
        assistantId: id,
        version: options.version,
        taskId: options.taskId,
        documentAction: options.action,
        success: !userEdited,
        userNote: userEdited ? '30 秒内有编辑动作(可能撤销)' : '',
        metadata: {
          writeTargetCount: Array.isArray(options.writeTargets) ? options.writeTargets.length : 0,
          undoneWithinMs: userEdited ? Date.now() - writeAt : 0
        }
      })
      resolve({ userEdited, writeAt })
    }, 30000)

    // 简易"是否有编辑"探测:监听 selectionchange 频率(WPS 没暴露 OnDocumentChange 给 web-app,
    // 这是替代方案;P3 再接入真正的 Application.ApiEvent.AddApiEventListener)
    let lastTs = 0
    const handler = () => {
      const t = Date.now()
      if (t - writeAt < 30000 && t - lastTs > 200) {
        // 用户在写回后 30s 内有焦点变化,认为发生了编辑(误差范围内)
        userEdited = true
      }
      lastTs = t
    }
    try { document.addEventListener('selectionchange', handler, { passive: true }) } catch (_) {}

    setTimeout(() => {
      try { document.removeEventListener('selectionchange', handler) } catch (_) {}
    }, 30100)
  })
}

/**
 * 入口 5:写一条用户 thumbs 信号(👍 / 👎)。
 *
 *   recordThumbs({
 *     assistantId, version, taskId,
 *     value: 'up' | 'down',
 *     note?: string
 *   })
 */
export function recordThumbs(options = {}) {
  const value = options.value === 'up' ? 'up' : 'down'
  return appendSignal({
    type: 'thumbs',
    assistantId: options.assistantId,
    version: options.version,
    taskId: options.taskId,
    documentAction: options.action,
    success: value === 'up',
    userNote: options.note || '',
    metadata: { value }
  })
}

export default {
  fastClassifyAndShortcut,
  startOptimisticStream,
  makeThrottledHistorySaver,
  onWriteback,
  recordThumbs
}
