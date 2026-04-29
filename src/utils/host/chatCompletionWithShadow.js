/**
 * chatCompletionWithShadow — chatCompletion 的"双跑"包装
 *
 * 解决 P6 问题:shadowRunner.runWithShadow 写好了但无人调用 → 影子机制空转。
 *
 * 用法(替代直接调 chatCompletion):
 *   const text = await chatCompletionWithShadow({
 *     providerId, modelId, messages,
 *     shadowKey: { assistantId, kind, isLocalModel }
 *   })
 *   // 内部:
 *   //   1. 跑 baseline(原 chatCompletion)→ 立即返回结果
 *   //   2. 若该 assistantId 当前有 shadow candidate + featureFlag 开启
 *   //      → queueMicrotask 异步触发 shadow run(不阻塞主结果)
 *
 * Feature flag:`shadowDoubleRun`(默认 false)
 */

import { chatCompletion } from '../chatApi.js'
import { runWithShadow } from '../assistant/evolution/shadowRunner.js'
import { isEnabled } from '../featureFlags.js'

const FLAG = 'shadowDoubleRun'

/**
 * 调用 chatCompletion;若开启 shadowDoubleRun + 该助手有 shadow candidate,
 * 则同步触发 shadow run(不影响主返回)。
 */
export async function chatCompletionWithShadow(options = {}) {
  const baselineFn = () => chatCompletion({
    providerId: options.providerId,
    modelId: options.modelId,
    ribbonModelId: options.ribbonModelId,
    messages: options.messages,
    temperature: options.temperature,
    signal: options.signal,
    ...(options.extraBody || {})
  })

  // 没开关或缺 shadowKey → 直接走 baseline
  if (!isEnabled(FLAG) || !options.shadowKey?.assistantId) {
    return baselineFn()
  }

  // 通过 runWithShadow:它返回 baseline 结果,异步触发 shadow
  return runWithShadow({
    assistantId: options.shadowKey.assistantId,
    kind: options.shadowKey.kind,
    isLocalModel: options.shadowKey.isLocalModel === true,
    baselineRun: baselineFn,
    shadowRun: async (shadowCandidate) => {
      // 用 shadow candidate 的 systemPrompt 替换 messages 中的 system
      const shadowMessages = (options.messages || []).map(m => {
        if (m.role === 'system' && shadowCandidate?.candidatePrompt) {
          return { ...m, content: shadowCandidate.candidatePrompt }
        }
        return m
      })
      return chatCompletion({
        providerId: options.providerId,
        modelId: options.modelId,
        ribbonModelId: options.ribbonModelId,
        messages: shadowMessages,
        temperature: options.temperature,
        signal: options.signal,
        ...(options.extraBody || {})
      })
    }
  })
}

export default {
  chatCompletionWithShadow
}
