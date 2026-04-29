/**
 * candidateGenerator - 候选版本生成器(v2)
 *
 * v1 在 assistantPromptRecommendationService.js,只做 1 个候选,无 anchor 约束。
 * v2 改进:
 *   - N=3 候选,温度梯度(0.2 / 0.5 / 0.8)保证多样性
 *   - 强约束 anchor:候选必须保留原始能力边界
 *   - 失败证据嵌入 prompt,要求模型针对性修复
 *   - 结构化 JSON 输出(走 chatApiEnhancers.withJsonSchema / withJsonObject)
 *   - 可选独立"候选模型"(与运行模型不同),避免同源偏差
 */

import { chatCompletion } from '../../chatApi.js'
import { withJsonObject, asRouterCall } from '../../chatApiEnhancers.js'
import { buildAnchorConstraintPrompt, getAnchor } from './anchorPrompt.js'

const DEFAULT_TEMPERATURES = [0.2, 0.5, 0.8]

function safeString(value, fallback = '') {
  const s = String(value ?? '').trim()
  return s || fallback
}

function safeNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function parseJsonCandidate(raw) {
  const text = String(raw || '').trim()
  if (!text) return null
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = block?.[1] ? block[1].trim() : text
  try { return JSON.parse(candidate) } catch (_) {}
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try { return JSON.parse(candidate.slice(start, end + 1)) } catch (_) {}
  }
  return null
}

/**
 * 构建给 LLM 的修复 prompt(失败证据 + anchor 约束 + 当前 prompt)。
 */
export function buildCandidatePrompt(currentAssistant, evidencePackage, anchor) {
  const lines = [
    '你是一名「助手修复工程师」,任务是基于真实失败证据修复一个已有助手的 prompt。',
    '严格要求:',
    '1. 只能修改 systemPrompt / userPromptTemplate / outputFormat / temperature / 个别模型参数',
    '2. 不允许扩张能力边界 — 助手该做什么不变',
    '3. 不允许改 documentAction / inputSource / modelType(用户已经选好了)',
    '4. 修改要最小化,每个改动都要在 diffSummary 中说明对应的失败 cluster',
    '5. 必须只输出合法 JSON,不要 Markdown,不要解释'
  ]

  if (anchor) {
    lines.push('')
    lines.push(buildAnchorConstraintPrompt(anchor))
  }

  lines.push('')
  lines.push('【当前助手】')
  lines.push(JSON.stringify({
    name: currentAssistant?.name,
    description: currentAssistant?.description,
    persona: currentAssistant?.persona,
    systemPrompt: currentAssistant?.systemPrompt,
    userPromptTemplate: currentAssistant?.userPromptTemplate,
    outputFormat: currentAssistant?.outputFormat,
    documentAction: currentAssistant?.documentAction,
    inputSource: currentAssistant?.inputSource,
    targetLanguage: currentAssistant?.targetLanguage
  }, null, 2))

  if (evidencePackage) {
    lines.push('')
    lines.push('【失败证据】')
    lines.push(`聚类: ${evidencePackage.failureCluster}`)
    lines.push(`时间窗: ${evidencePackage.windowDays} 天`)
    lines.push(`样本数: ${evidencePackage.metrics?.count || 0}`)
    if (evidencePackage.metrics?.rejectionRate != null) {
      lines.push(`拒绝率: ${(evidencePackage.metrics.rejectionRate * 100).toFixed(1)}%`)
    }
    if (evidencePackage.metrics?.raceBefore) {
      const r = evidencePackage.metrics.raceBefore
      lines.push(`当前 RACE: R=${r.R} A=${r.A} C=${r.C} E=${r.E}`)
    }
    lines.push('')
    lines.push('代表样本(已脱敏):')
    const samples = (evidencePackage.samples || []).slice(0, 8)
    for (const s of samples) {
      lines.push(`  - [${s.type}] ${s.failureCode || ''} ${s.userNote ? `「${s.userNote}」` : ''}`)
    }
  }

  lines.push('')
  lines.push('【输出 JSON 结构】')
  lines.push(JSON.stringify({
    rootCause: '一句话根因',
    repairReason: '一句话修复策略',
    diffSummary: ['改动 1: 对应聚类 X,把 Y 改为 Z', '改动 2: ...'],
    candidate: {
      name: '保持不变(允许加版本号)',
      description: '保持或微调',
      persona: '...',
      systemPrompt: '修复后的完整 system prompt',
      userPromptTemplate: '修复后的完整模板,必须包含 {{input}}',
      outputFormat: '保持',
      temperature: 0.3
    }
  }, null, 2))

  return lines.join('\n')
}

/**
 * 生成 N 个候选(温度梯度并行)。
 *
 *   options:
 *     model:         { providerId, modelId } — 候选生成专用模型(可与运行模型不同)
 *     n:             生成数量,默认 3
 *     temperatures:  覆盖默认梯度,默认 [0.2, 0.5, 0.8]
 *     timeoutMs:     单次超时,默认 45s
 *     evidence:      失败证据包(buildEvidencePackages 输出的单条)
 *
 *   返回: candidates[] = [
 *     { temperature, parsed: { rootCause, repairReason, diffSummary, candidate }, raw, error?, durationMs }
 *   ]
 */
export async function generateCandidates(currentAssistant, options = {}) {
  const model = options.model
  if (!model?.providerId || !model?.modelId) {
    throw new Error('candidateGenerator: 缺少模型配置')
  }
  const n = Math.max(1, safeNumber(options.n, 3))
  const temps = Array.isArray(options.temperatures) && options.temperatures.length > 0
    ? options.temperatures.slice(0, n)
    : DEFAULT_TEMPERATURES.slice(0, n)
  while (temps.length < n) {
    temps.push(0.5)
  }

  const anchor = options.anchor || getAnchor(currentAssistant?.id)
  const userPrompt = buildCandidatePrompt(currentAssistant, options.evidence, anchor)

  const baseMessages = [
    {
      role: 'system',
      content: '你是助手修复工程师。只输出合法 JSON,不要 Markdown / 解释 / 额外说明。'
    },
    { role: 'user', content: userPrompt }
  ]

  const tasks = temps.map(async temperature => {
    const startedAt = Date.now()
    try {
      const extra = withJsonObject({ temperature, max_tokens: 2400 })
      const raw = await chatCompletion({
        providerId: model.providerId,
        modelId: model.modelId,
        messages: baseMessages,
        ...extra
      })
      const parsed = parseJsonCandidate(raw)
      if (!parsed || !parsed.candidate) {
        return { temperature, raw, parsed: null, error: '候选 JSON 解析失败', durationMs: Date.now() - startedAt }
      }
      return { temperature, raw, parsed, durationMs: Date.now() - startedAt }
    } catch (e) {
      return { temperature, raw: '', parsed: null, error: e?.message || String(e), durationMs: Date.now() - startedAt }
    }
  })

  return await Promise.all(tasks)
}

/**
 * 把候选 + 当前助手合并成一个完整的"草案助手对象"(供 evaluator / shadowRunner 消费)。
 *
 *   保留所有用户配置(displayLocations / icon / sortOrder 等),只覆盖 LLM 生成的字段。
 */
export function buildCandidateAssistant(currentAssistant, candidatePayload) {
  if (!currentAssistant || !candidatePayload?.candidate) return null
  const cand = candidatePayload.candidate
  return {
    ...currentAssistant,
    description: safeString(cand.description, currentAssistant.description),
    persona: safeString(cand.persona, currentAssistant.persona),
    systemPrompt: safeString(cand.systemPrompt, currentAssistant.systemPrompt),
    userPromptTemplate: safeString(cand.userPromptTemplate, currentAssistant.userPromptTemplate),
    outputFormat: safeString(cand.outputFormat, currentAssistant.outputFormat),
    temperature: safeNumber(cand.temperature, currentAssistant.temperature || 0.3),
    _evolution: {
      rootCause: candidatePayload.rootCause,
      repairReason: candidatePayload.repairReason,
      diffSummary: Array.isArray(candidatePayload.diffSummary) ? candidatePayload.diffSummary : [],
      sourceCluster: candidatePayload.sourceCluster,
      generatedAt: new Date().toISOString()
    }
  }
}

export default {
  buildCandidatePrompt,
  generateCandidates,
  buildCandidateAssistant
}
