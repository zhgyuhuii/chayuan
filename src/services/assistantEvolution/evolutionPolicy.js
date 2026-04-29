export const DEFAULT_EVOLUTION_POLICY = Object.freeze({
  shadowRequired: true,
  minShadowComparisons: 30,
  minCandidateWinRate: 0.58,
  maxFailureRate: 0.05,
  minEvalScore: 0.75,
  writeBackMinShadowComparisons: 60,
  writeBackMinCandidateWinRate: 0.68,
  writeBackMaxFailureRate: 0.02,
  rollbackFailureRate: 0.12,
  rollbackUserComplaintRate: 0.03
})

function safeNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function classifyAssistantRisk(assistant = {}) {
  const action = String(assistant.documentAction || '').trim()
  const inputSource = String(assistant.inputSource || '').trim()
  const writesDocument = ['replace', 'insert', 'insert-after', 'prepend', 'append', 'comment-replace'].includes(action)
  if (writesDocument || inputSource === 'document') return 'document-write'
  return 'standard'
}

export function buildEvolutionPolicy(assistant = {}, overrides = {}) {
  const risk = classifyAssistantRisk(assistant)
  const base = { ...DEFAULT_EVOLUTION_POLICY, ...overrides }
  if (risk !== 'document-write') {
    return { ...base, risk }
  }
  return {
    ...base,
    risk,
    minShadowComparisons: Math.max(base.minShadowComparisons, base.writeBackMinShadowComparisons),
    minCandidateWinRate: Math.max(base.minCandidateWinRate, base.writeBackMinCandidateWinRate),
    maxFailureRate: Math.min(base.maxFailureRate, base.writeBackMaxFailureRate)
  }
}

export function assessPromotionCandidate(metrics = {}, policy = DEFAULT_EVOLUTION_POLICY) {
  const comparisons = safeNumber(metrics.shadowComparisons, 0)
  const winRate = safeNumber(metrics.candidateWinRate, 0)
  const failureRate = safeNumber(metrics.failureRate, 0)
  const evalScore = safeNumber(metrics.evalScore, 0)
  const blockers = []
  if (policy.shadowRequired && comparisons < policy.minShadowComparisons) {
    blockers.push({ code: 'shadow-comparisons-low', message: '影子运行样本不足' })
  }
  if (winRate < policy.minCandidateWinRate) {
    blockers.push({ code: 'win-rate-low', message: '候选版本胜率不足' })
  }
  if (failureRate > policy.maxFailureRate) {
    blockers.push({ code: 'failure-rate-high', message: '候选版本失败率过高' })
  }
  if (evalScore < policy.minEvalScore) {
    blockers.push({ code: 'eval-score-low', message: '固定评测集得分不足' })
  }
  return {
    approved: blockers.length === 0,
    blockers,
    policy,
    metrics: { comparisons, winRate, failureRate, evalScore }
  }
}

export function assessRollbackNeed(metrics = {}, policy = DEFAULT_EVOLUTION_POLICY) {
  const failureRate = safeNumber(metrics.failureRate, 0)
  const complaintRate = safeNumber(metrics.userComplaintRate, 0)
  const reasons = []
  if (failureRate >= policy.rollbackFailureRate) {
    reasons.push({ code: 'failure-rate-rollback', message: '观察期失败率达到回滚阈值' })
  }
  if (complaintRate >= policy.rollbackUserComplaintRate) {
    reasons.push({ code: 'complaint-rate-rollback', message: '用户负反馈达到回滚阈值' })
  }
  return {
    rollback: reasons.length > 0,
    reasons,
    metrics: { failureRate, complaintRate },
    policy
  }
}

export default {
  DEFAULT_EVOLUTION_POLICY,
  classifyAssistantRisk,
  buildEvolutionPolicy,
  assessPromotionCandidate,
  assessRollbackNeed
}
