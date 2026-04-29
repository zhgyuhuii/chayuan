/**
 * registryAdapter — 把 promotionFlow 的 deps 接到项目现有的
 *   assistantSettings.js (customAssistants 仓库)
 * + assistantVersionStore.js (版本史 + 快照)
 *
 * promotionFlow 不直接读项目存储,而是接收一个 deps 对象。
 * 这层 adapter 把那个抽象 deps 实现到现有存储。
 *
 * 用法:
 *   import { buildEvolutionDeps } from '@/utils/assistant/evolution/registryAdapter.js'
 *   import { runDailyEvaluationCycle } from '@/utils/assistant/evolution/promotionFlow.js'
 *
 *   const deps = buildEvolutionDeps({
 *     model: { providerId: 'openai', modelId: 'gpt-4o-mini' },
 *     runOnSamples: async (candidateAssistant, samples) => {
 *       // 调用方负责按 candidateAssistant.systemPrompt + sample.input 跑一次 LLM
 *       const out = []
 *       for (const s of samples) {
 *         const text = await streamChatCompletionToText({
 *           providerId, modelId,
 *           messages: [
 *             { role: 'system', content: candidateAssistant.systemPrompt || '' },
 *             { role: 'user',   content: s.input || '' }
 *           ]
 *         })
 *         out.push(text)
 *       }
 *       return out
 *     }
 *   })
 *   await runDailyEvaluationCycle({ deps })
 */

import {
  getCustomAssistants,
  saveCustomAssistants,
  getCustomAssistantById
} from '../../assistantSettings.js'
import {
  appendAssistantVersion,
  getAssistantVersionById,
  listAssistantVersions,
  promoteAssistantVersion
} from '../../assistantVersionStore.js'

/* ────────────────────────────────────────────────────────────
 * dep 实现
 * ──────────────────────────────────────────────────────────── */

export function listAssistantsForEvolution() {
  // 只对自定义助手做进化(内置助手不能改 prompt)
  return getCustomAssistants() || []
}

export function getAssistantForEvolution(id) {
  return getCustomAssistantById(id)
}

/**
 * 把候选写入版本史,标记为 isPromoted=false。
 * 候选**不会**立即变成活跃 — 走灰度,通过后再 setActiveVersion 才生效。
 */
export function addCandidateVersion(assistantId, candidateAssistant) {
  if (!candidateAssistant) throw new Error('addCandidateVersion: candidateAssistant 为空')
  const record = appendAssistantVersion({
    assistantId,
    version: candidateAssistant.version || `evolved-${new Date().toISOString().slice(0, 10)}`,
    isPromoted: false,
    repairReason: candidateAssistant?._evolution?.rootCause || '',
    changeSummary: candidateAssistant?._evolution?.repairReason || '自动进化候选',
    snapshot: candidateAssistant,
    sourceAssistantIds: [assistantId],
    evaluation: {
      source: 'auto-evolution',
      generatedAt: candidateAssistant?._evolution?.generatedAt
    }
  })
  return record?.versionId || null
}

/**
 * 把指定版本设为「活跃」,即:
 *   ① 用版本快照覆盖 customAssistants 里对应 id 的助手主体
 *   ② 在 versionStore 里把该版本标记为 isPromoted
 *
 * 这是 promotionFlow.promote 的实际写入点;也是 promotionFlow.rollbackByUser 的回滚路径
 * (回滚就是把 previousVersionId 当做"目标活跃版"来 setActiveVersion)。
 */
export function setActiveVersion(assistantId, versionId) {
  const record = getAssistantVersionById(versionId)
  if (!record) throw new Error(`setActiveVersion: 未找到版本 ${versionId}`)
  if (!record.snapshot || typeof record.snapshot !== 'object') {
    throw new Error(`setActiveVersion: 版本 ${versionId} 缺少 snapshot,无法应用`)
  }
  if (record.assistantId !== assistantId) {
    throw new Error(`setActiveVersion: 版本归属不匹配 (${record.assistantId} ≠ ${assistantId})`)
  }

  const list = getCustomAssistants() || []
  const idx = list.findIndex(a => String(a?.id || '').trim() === assistantId)
  const now = new Date().toISOString()
  const merged = {
    ...(idx >= 0 ? list[idx] : {}),
    ...record.snapshot,
    id: assistantId,
    updatedAt: now
  }
  const next = idx >= 0
    ? list.map((item, i) => i === idx ? merged : item)
    : [...list, merged]
  saveCustomAssistants(next)

  // 标记版本史:同 family 内只有这一版 isPromoted=true
  try { promoteAssistantVersion(versionId) } catch (_) {
    // 即使版本史 flag 标记失败,active body 已写入。这里不 throw,避免触发不必要的回滚循环。
  }
  return merged
}

/**
 * 当前活跃版的 versionId — 用于 startObservation 的 previousVersionId,
 * 以及 compareCandidate 的 baselineVersion。
 */
export function getActiveVersionId(assistantId) {
  const versions = listAssistantVersions(assistantId) || []
  const promoted = versions.find(v => v?.isPromoted === true)
  if (promoted?.versionId) return promoted.versionId
  // 退化:返回最近一次创建的版本
  const sorted = [...versions].sort((a, b) =>
    String(b?.createdAt || '').localeCompare(String(a?.createdAt || ''))
  )
  return sorted[0]?.versionId || null
}

/* ────────────────────────────────────────────────────────────
 * 一键构造 deps
 * ──────────────────────────────────────────────────────────── */

/**
 * 一次性返回符合 promotionFlow.deps 契约的对象。
 *
 *   options:
 *     model        - { providerId, modelId }   候选生成 + 评判用模型(必填)
 *     runOnSamples - async (cand, samples) => string[]   预审执行器(必填)
 *
 * 调用方提供 model + runOnSamples 这两块"对外副作用",其余从现有存储读写。
 */
export function buildEvolutionDeps(options = {}) {
  if (!options.model?.providerId || !options.model?.modelId) {
    throw new Error('buildEvolutionDeps: 必须提供 model: { providerId, modelId }')
  }
  if (typeof options.runOnSamples !== 'function') {
    throw new Error('buildEvolutionDeps: 必须提供 runOnSamples(candidateAssistant, samples) 函数')
  }
  return {
    listAssistants:      listAssistantsForEvolution,
    getAssistant:        getAssistantForEvolution,
    addCandidateVersion: addCandidateVersion,
    setActiveVersion:    setActiveVersion,
    getActiveVersionId:  getActiveVersionId,
    runOnSamples:        options.runOnSamples,
    model:               options.model
  }
}

export default {
  listAssistantsForEvolution,
  getAssistantForEvolution,
  addCandidateVersion,
  setActiveVersion,
  getActiveVersionId,
  buildEvolutionDeps
}
