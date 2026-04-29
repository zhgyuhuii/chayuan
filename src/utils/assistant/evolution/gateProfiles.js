/**
 * gateProfiles - 助手类别与 RACE 权重 / 阈值表
 *
 * 同一个 totalScore=72 对改写助手和保密助手意义完全不同 —
 * 前者尚可、后者灾难。本文件按助手类别给出差异化权重和阈值。
 *
 * 用法:
 *   const profile = inferProfile(assistant)
 *   const weights = RACE_WEIGHTS[profile]
 *   const thresholds = RACE_THRESHOLDS[profile]
 *   const total = R*w.R + A*w.A + C*w.C + E*w.E
 *   const allowed = total >= thresholds.total
 *                && R >= thresholds.R && A >= thresholds.A
 *                && C >= thresholds.C && E >= thresholds.E
 */

/**
 * 维度:
 *   R Reliability  可靠性(不崩、不空、不超时、JSON 不坏)
 *   A Accuracy     准确性(解决用户问题)
 *   C Compliance   合规性(不越界、不编造、不输出禁用)
 *   E Efficiency   效率(快、省、降级少)
 */
export const RACE_WEIGHTS = Object.freeze({
  rewriter:    { R: 0.25, A: 0.35, C: 0.15, E: 0.25 },
  summarizer:  { R: 0.25, A: 0.45, C: 0.10, E: 0.20 },
  json:        { R: 0.50, A: 0.25, C: 0.15, E: 0.10 },
  security:    { R: 0.20, A: 0.25, C: 0.50, E: 0.05 },
  translator:  { R: 0.25, A: 0.40, C: 0.20, E: 0.15 },
  legal:       { R: 0.40, A: 0.25, C: 0.30, E: 0.05 },
  academic:    { R: 0.20, A: 0.45, C: 0.30, E: 0.05 },
  multimodal:  { R: 0.45, A: 0.30, C: 0.10, E: 0.15 },
  analysis:    { R: 0.30, A: 0.40, C: 0.20, E: 0.10 },
  generic:     { R: 0.30, A: 0.35, C: 0.20, E: 0.15 }
})

/**
 * 单维度最低线 + 总分线。任一未达线即不允许晋升。
 */
export const RACE_THRESHOLDS = Object.freeze({
  rewriter:    { R: 80, A: 75, C: 75, E: 70, total: 75 },
  summarizer:  { R: 80, A: 78, C: 75, E: 70, total: 76 },
  json:        { R: 90, A: 75, C: 80, E: 65, total: 80 },
  security:    { R: 88, A: 82, C: 92, E: 55, total: 85 },
  translator:  { R: 80, A: 78, C: 78, E: 65, total: 76 },
  legal:       { R: 88, A: 80, C: 88, E: 55, total: 82 },
  academic:    { R: 80, A: 80, C: 80, E: 60, total: 78 },
  multimodal:  { R: 80, A: 70, C: 70, E: 60, total: 72 },
  analysis:    { R: 80, A: 75, C: 75, E: 65, total: 75 },
  generic:     { R: 78, A: 75, C: 75, E: 65, total: 74 }
})

/**
 * 助手类别判定。
 *   1. 若助手 definition 显式声明 gateProfile,直接用
 *   2. 否则按 ID / outputFormat / category 启发式推断
 *   3. 兜底 'generic'
 */
export function inferProfile(assistant = {}) {
  const explicit = String(assistant.gateProfile || '').trim()
  if (explicit && RACE_WEIGHTS[explicit]) return explicit

  const id = String(assistant.id || '').toLowerCase()
  const cat = String(assistant.category || '').toLowerCase()
  const fmt = String(assistant.outputFormat || assistant.defaultOutputFormat || '').toLowerCase()
  const modelType = String(assistant.modelType || '').toLowerCase()

  if (modelType === 'image' || modelType === 'audio' || modelType === 'video') return 'multimodal'

  if (fmt === 'json') return 'json'

  if (id.includes('security') || id.includes('declassify') || id.includes('secret') || cat === 'security') return 'security'
  if (id.startsWith('legal.') || cat === 'legal') return 'legal'
  if (id.startsWith('academic.') || cat === 'academic') return 'academic'

  if (
    id === 'translate' ||
    id.includes('translate')
  ) return 'translator'

  if (
    id === 'summary' ||
    id.includes('summary') ||
    id.includes('minutes')
  ) return 'summarizer'

  if (
    id.includes('rewrite') ||
    id.includes('expand') ||
    id.includes('abbreviate') ||
    id.includes('polish') ||
    id.includes('formalize') ||
    id.includes('simplify') ||
    id.includes('term-unify') ||
    id.includes('policy-style')
  ) return 'rewriter'

  if (id.startsWith('analysis.')) return 'analysis'

  return 'generic'
}

export function getWeights(assistant) {
  const profile = inferProfile(assistant)
  return { profile, weights: RACE_WEIGHTS[profile] }
}

export function getThresholds(assistant) {
  const profile = inferProfile(assistant)
  return { profile, thresholds: RACE_THRESHOLDS[profile] }
}

export default {
  RACE_WEIGHTS,
  RACE_THRESHOLDS,
  inferProfile,
  getWeights,
  getThresholds
}
