/**
 * raceEvaluator - RACE 四维健康分(替代单一 totalScore)
 *
 *   R Reliability  可靠性
 *   A Accuracy     准确性
 *   C Compliance   合规性
 *   E Efficiency   效率
 *
 * 数据源:
 *   - signalStore(用户接受率、撤销率、明示反馈)
 *   - taskListStore(任务结果,通过 signalStore 间接消费)
 *   - structuredCommentPolicy.findIssueRangeDetailed(锚定命中率,P3 接入)
 *   - LLM judge(P3 接入)
 *
 * P0 阶段先实现"基于 signalStore"的版本,LLM judge 留接口给 P3。
 *
 * 输出:
 *   { R, A, C, E, total, profile, weights, thresholds, releaseGate, sampleCount }
 */

import {
  listSignalsByAssistant,
  listSignalsByVersion,
  computeAcceptRate,
  computeFailureRate
} from './signalStore.js'
import {
  inferProfile,
  RACE_WEIGHTS,
  RACE_THRESHOLDS
} from './gateProfiles.js'
import { computeDriftScore, DRIFT_THRESHOLD } from './anchorPrompt.js'

function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clamp(min, value, max) {
  return Math.max(min, Math.min(value, max))
}

/**
 * R 可靠性:不崩、不空、JSON 不坏、不超时。
 * 数据:任务成功率 + JSON parse 成功率 + 超时率
 */
export function computeReliability(signals = []) {
  const taskSignals = signals.filter(s => s.type === 'task')
  if (taskSignals.length === 0) return 80   // 无数据兜底
  const successCount = taskSignals.filter(s => s.success === true).length
  const successRate = successCount / taskSignals.length

  // failureCode 中的 JSON 错误专门加重(低 5 分/比例)
  const jsonFails = taskSignals.filter(s =>
    s.failureCode === 'json_parse_fail' ||
    s.failureCode === 'schema_invalid'
  ).length
  const jsonFailRate = jsonFails / taskSignals.length

  const timeoutFails = taskSignals.filter(s => s.failureCode === 'timeout').length
  const timeoutRate = timeoutFails / taskSignals.length

  return clamp(0, Math.round(successRate * 100 - jsonFailRate * 5 - timeoutRate * 8), 100)
}

/**
 * A 准确性:解决用户的问题。
 * 数据:用户接受率 0.5 × accept_rate + 0.5 × judge_score(P3 接入)
 * P0 退化为 0.7 × accept_rate + 0.3 × (1 - reject_rate)
 */
export function computeAccuracy(signals = [], options = {}) {
  if (signals.length === 0) return 75
  const total = signals.length
  const accepted = signals.filter(s =>
    s.type === 'accept' ||
    (s.type === 'thumbs' && s.metadata?.value === 'up')
  ).length
  const rejected = signals.filter(s =>
    s.type === 'reject' ||
    (s.type === 'thumbs' && s.metadata?.value === 'down')
  ).length

  // 没有明确接受/拒绝信号时,落到中位 70
  const explicit = accepted + rejected
  if (explicit === 0) return 70

  const acceptRate = accepted / Math.max(1, explicit)
  const partial = Math.round(acceptRate * 100)

  // 判定信号样本数太少(< 5)时拉向 70 中位,减少抖动
  if (explicit < 5) {
    const weight = explicit / 5
    return Math.round(70 * (1 - weight) + partial * weight)
  }

  // 若 options.judgeScore 提供(P3 LLM 裁判),按 0.5/0.5 融合
  const judge = safeNumber(options.judgeScore, -1)
  if (judge >= 0 && judge <= 100) {
    return Math.round(partial * 0.5 + judge * 0.5)
  }

  return clamp(0, partial, 100)
}

/**
 * C 合规性:不越界、不编造、不输出禁用。
 * 数据:锚定命中率(原文存在率)、安全词非命中率、不编造校验。
 * P0 退化:基于 metadata 中 anchor_hit / safety_violation 字段累计。
 */
export function computeCompliance(signals = []) {
  if (signals.length === 0) return 85
  const taskSignals = signals.filter(s => s.type === 'task')
  if (taskSignals.length === 0) return 85

  let anchorHits = 0
  let anchorMisses = 0
  let safetyViolations = 0
  for (const s of taskSignals) {
    const meta = s.metadata || {}
    if (meta.anchor_hit === true) anchorHits++
    if (meta.anchor_hit === false) anchorMisses++
    if (meta.safety_violation === true) safetyViolations++
  }

  const anchorTotal = anchorHits + anchorMisses
  const anchorScore = anchorTotal > 0
    ? (anchorHits / anchorTotal) * 100
    : 90

  const safetyPenalty = Math.min(40, safetyViolations * 8)

  return clamp(0, Math.round(anchorScore - safetyPenalty), 100)
}

/**
 * E 效率:用得快、用得少、降级少。
 * 数据:平均耗时(归一化)、平均 token、降级率。
 */
export function computeEfficiency(signals = []) {
  const taskSignals = signals.filter(s => s.type === 'task')
  if (taskSignals.length === 0) return 75

  const durations = taskSignals.map(s => safeNumber(s.duration, 0)).filter(d => d > 0)
  const tokens = taskSignals.map(s => safeNumber(s.tokens, 0)).filter(t => t > 0)
  const downgrades = taskSignals.filter(s => s.metadata?.downgraded === true).length

  // 归一化:< 3s 满分,> 30s 0 分,中间线性
  const avgDur = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 5000
  const durScore = clamp(0, 100 - ((avgDur - 3000) / 27000) * 100, 100)

  // token < 800 满分,> 6000 0 分
  const avgTok = tokens.length ? tokens.reduce((a, b) => a + b, 0) / tokens.length : 1500
  const tokScore = clamp(0, 100 - ((avgTok - 800) / 5200) * 100, 100)

  const downgradeRate = downgrades / taskSignals.length
  const downgradePenalty = Math.min(30, downgradeRate * 80)

  return clamp(0, Math.round(durScore * 0.5 + tokScore * 0.3 - downgradePenalty + 20), 100)
}

/**
 * 主入口:计算助手某版本的健康分。
 *
 *   options:
 *     version: 指定版本,默认取所有版本合并
 *     days: 滚动窗口天数,默认 30
 *     judgeScore: P3 LLM 裁判结果
 *     candidate: 候选定义(用于 driftScore;若没传则跳过 drift 检测)
 */
export function computeHealthScore(assistantOrId, options = {}) {
  const assistant = typeof assistantOrId === 'string'
    ? { id: assistantOrId }
    : (assistantOrId || {})
  const assistantId = String(assistant.id || '').trim()
  if (!assistantId) {
    return null
  }

  const profile = inferProfile(assistant)
  const weights = RACE_WEIGHTS[profile] || RACE_WEIGHTS.generic
  const thresholds = RACE_THRESHOLDS[profile] || RACE_THRESHOLDS.generic

  const days = safeNumber(options.days, 30)
  const signals = options.version
    ? listSignalsByVersion(assistantId, options.version, { days })
    : listSignalsByAssistant(assistantId, { days })

  const R = computeReliability(signals)
  const A = computeAccuracy(signals, { judgeScore: options.judgeScore })
  const C = computeCompliance(signals)
  const E = computeEfficiency(signals)

  const total = Math.round(
    R * weights.R + A * weights.A + C * weights.C + E * weights.E
  )

  const driftScore = options.candidate
    ? computeDriftScore(options.candidate, assistantId)
    : 0
  const drifted = driftScore > DRIFT_THRESHOLD

  const dimensionsOk =
    R >= thresholds.R && A >= thresholds.A &&
    C >= thresholds.C && E >= thresholds.E
  const totalOk = total >= thresholds.total
  const allowed = dimensionsOk && totalOk && !drifted

  let reason = ''
  if (drifted) reason = `候选偏离原始意图(driftScore=${driftScore} > ${DRIFT_THRESHOLD})`
  else if (!totalOk) reason = `总分 ${total} 未达阈值 ${thresholds.total}`
  else if (R < thresholds.R) reason = `R(可靠性)${R} < ${thresholds.R}`
  else if (A < thresholds.A) reason = `A(准确性)${A} < ${thresholds.A}`
  else if (C < thresholds.C) reason = `C(合规性)${C} < ${thresholds.C}`
  else if (E < thresholds.E) reason = `E(效率)${E} < ${thresholds.E}`

  return {
    R, A, C, E,
    total,
    profile,
    weights,
    thresholds,
    sampleCount: signals.length,
    driftScore,
    drifted,
    releaseGate: {
      allowed,
      reason: allowed ? '所有维度均达阈值' : reason
    },
    recommendedAction: allowed
      ? 'publish'
      : (total >= thresholds.total - 8 ? 'review' : 'revise')
  }
}

/**
 * 对比基线 vs 候选健康分。
 * 返回 { baseline, candidate, deltaTotal, deltaByDim, winner }
 */
export function compareCandidate(assistantId, baselineVersion, candidateVersion, options = {}) {
  const baseline = computeHealthScore({ id: assistantId, ...(options.assistant || {}) }, {
    version: baselineVersion,
    days: options.days
  })
  const candidate = computeHealthScore({ id: assistantId, ...(options.candidateAssistant || options.assistant || {}) }, {
    version: candidateVersion,
    days: options.days,
    judgeScore: options.judgeScore,
    candidate: options.candidate
  })

  if (!baseline || !candidate) {
    return { baseline, candidate, winner: 'inconclusive' }
  }

  const deltaTotal = candidate.total - baseline.total
  const deltaByDim = {
    R: candidate.R - baseline.R,
    A: candidate.A - baseline.A,
    C: candidate.C - baseline.C,
    E: candidate.E - baseline.E
  }

  let winner = 'tie'
  if (Math.abs(deltaTotal) >= 3) {
    winner = deltaTotal > 0 ? 'candidate' : 'baseline'
  }

  // 即使 candidate total 高,但 C 显著低于 baseline,以 C 为准(合规优先)
  if (deltaByDim.C <= -5) winner = 'baseline'

  return { baseline, candidate, deltaTotal, deltaByDim, winner }
}

export default {
  computeReliability,
  computeAccuracy,
  computeCompliance,
  computeEfficiency,
  computeHealthScore,
  compareCandidate
}
