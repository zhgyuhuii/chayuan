/**
 * evolutionBoot — 助手进化系统一键启动
 *
 * 把进化系统从"零件齐全但需手工拼装"变成"一行启动":
 *   1. 用项目现有 chatApi.chatCompletion 构造 runOnSamples
 *   2. 通过 registryAdapter.buildEvolutionDeps 织入 deps
 *   3. installEvolutionScheduler 起 daily cron
 *
 * 用法(在 main.js 或某个早期初始化点):
 *
 *   import { bootEvolutionSystem } from '@/utils/assistant/evolution/evolutionBoot.js'
 *
 *   // 简单 / 默认:
 *   const stop = bootEvolutionSystem({
 *     model: { providerId: 'openai', modelId: 'gpt-4o-mini' }
 *   })
 *
 *   // 高级:自定义运行器(例如本地模型、特殊 header):
 *   const stop = bootEvolutionSystem({
 *     model: { providerId: 'openai', modelId: 'gpt-4o-mini' },
 *     runSample: async (cand, input) => myLLM.run(cand.systemPrompt, input)
 *   })
 *
 *   // 关闭(开发热重载或登出时):
 *   stop()
 */

import { chatCompletion } from '../../chatApi.js'
import { buildEvolutionDeps } from './registryAdapter.js'
import { installEvolutionScheduler, getSchedulerConfig } from './scheduler.js'

const DEFAULT_TEMPERATURE = 0.3       // 候选评估时低温度,看的是稳定性
const DEFAULT_MAX_PARALLEL = 2        // 同一候选 N 个样本最多并发 2 路 — 避免 burst

/**
 * 默认 runSample 实现:候选 prompt + 输入 → 文本输出。
 * 调用方可通过 options.runSample 重写。
 */
async function defaultRunSample(model, candidateAssistant, input, signal) {
  const messages = [
    {
      role: 'system',
      content: String(candidateAssistant?.systemPrompt || '')
    },
    {
      role: 'user',
      content: String(input || '')
    }
  ]
  const text = await chatCompletion({
    providerId: model.providerId,
    modelId: model.modelId,
    messages,
    temperature: typeof candidateAssistant?.temperature === 'number'
      ? candidateAssistant.temperature
      : DEFAULT_TEMPERATURE,
    signal
  })
  return String(text || '')
}

/**
 * 用 runSample 把 samples[] 跑成 outputs[](同长度)。
 * 控制并发,失败的样本返回 ''(不抛错,让 judge 跳过)。
 */
async function runSamplesParallel(model, candidateAssistant, samples, runSample, options = {}) {
  const max = Math.max(1, Math.min(options.maxParallel || DEFAULT_MAX_PARALLEL, 8))
  const results = new Array(samples.length).fill('')
  let cursor = 0

  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= samples.length) return
      const sample = samples[i]
      const input = sample?.input || sample?.userInput || ''
      if (!input) { results[i] = ''; continue }
      try {
        const out = await runSample(candidateAssistant, input)
        results[i] = String(out || '')
      } catch (_) {
        results[i] = ''
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(max, samples.length) }, worker))
  return results
}

/**
 * 主入口:启动进化系统。返回 stop 函数。
 */
export function bootEvolutionSystem(options = {}) {
  if (!options.model?.providerId || !options.model?.modelId) {
    throw new Error('bootEvolutionSystem: 必须提供 model: { providerId, modelId }')
  }
  const model = options.model
  const runSampleFn = typeof options.runSample === 'function'
    ? options.runSample
    : (cand, input) => defaultRunSample(model, cand, input)

  const runOnSamples = async (candidateAssistant, samples) => {
    if (!Array.isArray(samples) || samples.length === 0) return []
    return runSamplesParallel(model, candidateAssistant, samples, runSampleFn, {
      maxParallel: options.maxParallel
    })
  }

  const deps = buildEvolutionDeps({ model, runOnSamples })

  const stopScheduler = installEvolutionScheduler({
    deps,
    checkIntervalMs: options.checkIntervalMs,
    beforeRun: options.beforeRun,
    afterRun: options.afterRun
  })

  if (typeof window !== 'undefined') {
    // 暴露给 EvolutionStatusPanel.vue 等组件直接用,避免重复构造 deps
    window.__chayuanEvolutionDeps = deps
  }

  return function stopEvolutionSystem() {
    try { stopScheduler?.() } catch (_) {}
    if (typeof window !== 'undefined' && window.__chayuanEvolutionDeps === deps) {
      delete window.__chayuanEvolutionDeps
    }
  }
}

/**
 * 快速读取当前 deps(在已 boot 的前提下)。
 * 给 EvolutionStatusPanel 等组件用,避免每个调用方都重新 build。
 */
export function getCurrentEvolutionDeps() {
  if (typeof window !== 'undefined' && window.__chayuanEvolutionDeps) {
    return window.__chayuanEvolutionDeps
  }
  return null
}

/**
 * 快速 check:进化系统当前状态(给设置面板/状态条用)。
 */
export function getEvolutionStatus() {
  return {
    booted: typeof window !== 'undefined' && !!window.__chayuanEvolutionDeps,
    scheduler: getSchedulerConfig()
  }
}

export default {
  bootEvolutionSystem,
  getCurrentEvolutionDeps,
  getEvolutionStatus
}
