/**
 * promotionFlow — 助手进化"编排器"
 *
 * 把 P0/P1 的 9 个进化模块串成一条端到端流水线:
 *
 *   ┌──────────────────────────────────────────────────────────────────────┐
 *   │  signalStore  →  failureCluster.shouldProposeEvolution               │
 *   │                                              ↓ propose:true          │
 *   │              candidateGenerator.generateCandidates                   │
 *   │                                              ↓                       │
 *   │              anchorPrompt.computeDriftScore (筛掉漂移)               │
 *   │                                              ↓                       │
 *   │              judge.arbitrate (小样本预审)                            │
 *   │                                              ↓                       │
 *   │              deps.addCandidateVersion(id, candidate) → versionId     │
 *   │              shadowRunner.setShadowCandidate(id, versionId)          │
 *   │                                              ↓ 累积 N 次比对         │
 *   │              raceEvaluator.compareCandidate (RACE 4 维)              │
 *   │                                              ↓ winner='candidate'    │
 *   │              deps.setActiveVersion(id, versionId)                    │
 *   │              rollbackMonitor.startObservation (7 天观察)             │
 *   │                                              ↓                       │
 *   │              rollbackMonitor.sampleAndDecide (定时,超阈值回滚)      │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * 设计原则:
 *   1. **依赖注入**:不直接操作 assistants 仓库,所有"读/写助手"通过 deps
 *   2. **幂等**:每个阶段都可重入,中途失败可以从下一次定时任务恢复
 *   3. **可观测**:每一步都记 signal,便于后续审计
 *   4. **保守**:任何一步异常 → 不晋升,不报错,等下一轮
 *
 * 必需的 deps:
 *
 *   {
 *     listAssistants:      () => Assistant[]
 *     getAssistant:        (id) => Assistant            // 当前活跃版
 *     addCandidateVersion: (id, candidateAssistant) => versionId
 *     setActiveVersion:    (id, versionId) => void
 *     getActiveVersionId:  (id) => versionId
 *     runOnSamples:        (candidateAssistant, samples) => string[]
 *                                                       // 用候选 prompt 跑预审样本
 *     model:               { providerId, modelId }     // 给 candidateGenerator 用
 *   }
 *
 * 用法:
 *
 *   import { runDailyEvaluationCycle, triggerEvaluation } from '.../promotionFlow.js'
 *
 *   await triggerEvaluation('assistant-rewriter-001', { deps })   // 单助手手动触发
 *   await runDailyEvaluationCycle({ deps })                       // 全量定时任务
 */

import { shouldProposeEvolution, buildEvidencePackages } from './failureCluster.js'
import { generateCandidates, buildCandidateAssistant } from './candidateGenerator.js'
import { arbitrate } from './judge.js'
import { chooseJudgeStrategy } from './judgeFallback.js'
import { computeDriftScore, isDrifted, DRIFT_THRESHOLD, getAnchor } from './anchorPrompt.js'
import {
  setShadowCandidate, getShadowCandidate, clearShadowCandidate,
  getShadowStats, getQuotaStatus
} from './shadowRunner.js'
import { compareCandidate, computeHealthScore } from './raceEvaluator.js'
import { startObservation, sampleAndDecide, listObservations, userRollback } from './rollbackMonitor.js'
import { appendSignal } from './signalStore.js'

/** 默认参数(可通过 options.config 覆盖) */
export const DEFAULT_FLOW_CONFIG = Object.freeze({
  /** 候选数量 */
  candidateCount: 3,
  /** 候选的预审样本量 */
  prejudgeSampleSize: 5,
  /** 进入灰度的最低 prejudge 平均分(0-100) */
  prejudgeMinScore: 70,
  /** 灰度需要累积多少次比对才允许晋升 */
  shadowMinComparisons: 30,
  /** 灰度超过多少天还没攒够样本 → 放弃 */
  shadowMaxDays: 14,
  /** 观察期天数 */
  observationDays: 7,
  /** RACE 比对置信窗口(天) */
  raceWindowDays: 7
})

/* ────────────────────────────────────────────────────────────
 * 0. dep 校验
 * ──────────────────────────────────────────────────────────── */

function validateDeps(deps, requireFull = true) {
  if (!deps || typeof deps !== 'object') return '缺少 deps'
  if (typeof deps.listAssistants !== 'function') return 'deps.listAssistants 必须是函数'
  if (typeof deps.getAssistant !== 'function') return 'deps.getAssistant 必须是函数'
  if (!requireFull) return ''
  if (typeof deps.addCandidateVersion !== 'function') return 'deps.addCandidateVersion 必须是函数'
  if (typeof deps.setActiveVersion !== 'function') return 'deps.setActiveVersion 必须是函数'
  if (typeof deps.getActiveVersionId !== 'function') return 'deps.getActiveVersionId 必须是函数'
  if (typeof deps.runOnSamples !== 'function') return 'deps.runOnSamples 必须是函数'
  if (!deps.model?.providerId || !deps.model?.modelId) return 'deps.model 必须含 { providerId, modelId }'
  return ''
}

/* ────────────────────────────────────────────────────────────
 * 1. 阶段 A:决定是否需要进化
 * ──────────────────────────────────────────────────────────── */

export async function evaluateNeed(assistantId, options = {}) {
  try {
    const verdict = await shouldProposeEvolution(assistantId, options.failure || {})
    if (!verdict?.propose) {
      return {
        propose: false,
        urgency: verdict?.urgency || 'none',
        reason: verdict?.reason || 'no-cluster',
        evidencePackages: []
      }
    }
    const evidencePackages = buildEvidencePackages(verdict.clusters || [], {
      currentVersion: options.currentVersion
    })
    return {
      propose: evidencePackages.length > 0,
      urgency: verdict.urgency,
      reason: evidencePackages.length ? `clusters=${evidencePackages.length}` : 'cluster-empty',
      evidencePackages
    }
  } catch (e) {
    return { propose: false, urgency: 'none', reason: 'evaluateNeed-failed:' + String(e?.message || e), evidencePackages: [] }
  }
}

/* ────────────────────────────────────────────────────────────
 * 2. 阶段 B:生成候选 + 漂移过滤 + 预审
 * ──────────────────────────────────────────────────────────── */

/**
 * 返回:scored 数组(从高到低),每项为
 *   { candidatePayload, candidateAssistant, driftScore, prejudgeScore, prejudgeN }
 * candidatePayload 是 generateCandidates 返回的原始 payload(含 candidate / rootCause / repairReason 等)
 * candidateAssistant 是用 buildCandidateAssistant 拼出的待写入助手对象
 */
export async function proposeAndPrejudge(assistantId, evidencePackage, options = {}) {
  const cfg = { ...DEFAULT_FLOW_CONFIG, ...(options.config || {}) }
  const deps = options.deps
  const errMsg = validateDeps(deps, true)
  if (errMsg) throw new Error(errMsg)

  const current = await deps.getAssistant(assistantId)
  if (!current) throw new Error('assistant not found: ' + assistantId)

  const raw = await generateCandidates(current, {
    evidence: evidencePackage,
    model: deps.model,
    n: cfg.candidateCount
  })

  // ── 漂移过滤 ──
  const passed = []
  for (const payload of (raw || [])) {
    const cand = payload?.candidate
    if (!cand) continue
    const drift = computeDriftScore(cand, assistantId)
    // isDrifted 返回 { drifted, score };以前误用为 boolean,这里取 .drifted
    const driftCheck = isDrifted(cand, assistantId, DRIFT_THRESHOLD)
    if (driftCheck?.drifted === true) {
      appendSignal({
        type: 'audit',
        assistantId,
        success: false,
        userNote: `候选漂移过大(${drift}>${DRIFT_THRESHOLD}),拒绝`,
        metadata: { stage: 'prejudge-drift', driftScore: drift }
      })
      continue
    }
    passed.push({ payload, driftScore: drift })
  }
  if (!passed.length) return []

  // ── 预审样本 ──
  const samples = (evidencePackage?.samples || []).slice(0, cfg.prejudgeSampleSize)
  if (samples.length === 0) {
    // 没样本可比 → 仅用 drift 排序入灰度
    return passed.map(p => ({
      candidatePayload: p.payload,
      candidateAssistant: buildCandidateAssistant(current, p.payload),
      driftScore: p.driftScore,
      prejudgeScore: 0,
      prejudgeN: 0
    })).sort((a, b) => a.driftScore - b.driftScore)
  }

  const scored = []
  for (const p of passed) {
    const candAssistant = buildCandidateAssistant(current, p.payload)
    let candidateOutputs = []
    try {
      candidateOutputs = await deps.runOnSamples(candAssistant, samples) || []
    } catch (_) {
      candidateOutputs = []
    }

    let total = 0
    let n = 0
    // 评估前先决定判官策略 — 跨家族 / 同家族 / self-consistency
    const judgeStrategy = (() => {
      try { return chooseJudgeStrategy(deps.model) }
      catch { return { strategy: 'cross-family', judges: [] } }
    })()
    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i]
      const baselineOutput = sample.output || sample.baselineOutput || ''
      const candidateOutput = candidateOutputs[i] || ''
      if (!candidateOutput) continue
      try {
        const result = await arbitrate({
          input: sample.input || sample.userInput || '',
          baseline: baselineOutput,
          candidate: candidateOutput,
          expected: sample.expected || '',
          candidateModel: deps.model?.modelId,
          judges: judgeStrategy.judges,        // 显式传入策略选好的判官
          fallbackStrategy: judgeStrategy.strategy
        })
        if (typeof result?.normalizedScore === 'number' && result.normalizedScore >= 0) {
          // arbitrate 内部 normalizedScore 通常 0-100
          total += result.normalizedScore
          n += 1
        }
      } catch (_) { /* 单样本 judge 失败不致命 */ }
    }

    const avg = n > 0 ? Math.round(total / n) : 0
    scored.push({
      candidatePayload: p.payload,
      candidateAssistant: candAssistant,
      driftScore: p.driftScore,
      prejudgeScore: avg,
      prejudgeN: n
    })
  }

  scored.sort((a, b) => b.prejudgeScore - a.prejudgeScore)
  return scored.filter(s => s.prejudgeScore >= cfg.prejudgeMinScore || s.prejudgeN === 0)
}

/* ────────────────────────────────────────────────────────────
 * 3. 阶段 C:写入候选版本 + 进入灰度
 * ──────────────────────────────────────────────────────────── */

export async function enterShadow(assistantId, scored, options = {}) {
  const deps = options.deps
  const errMsg = validateDeps(deps, true)
  if (errMsg) throw new Error(errMsg)

  let versionId
  try {
    versionId = await deps.addCandidateVersion(assistantId, scored.candidateAssistant)
  } catch (e) {
    return { ok: false, reason: 'addCandidateVersion-failed:' + String(e?.message || e) }
  }
  if (!versionId) return { ok: false, reason: 'addCandidateVersion 未返回 versionId' }

  const ok = setShadowCandidate(assistantId, versionId, {
    note: `prejudge=${scored.prejudgeScore}, drift=${scored.driftScore}`
  })
  if (!ok) return { ok: false, reason: 'setShadowCandidate 拒绝' }

  appendSignal({
    type: 'audit',
    assistantId,
    version: versionId,
    success: true,
    userNote: `候选 ${versionId} 进入灰度`,
    metadata: {
      stage: 'enter-shadow',
      prejudgeScore: scored.prejudgeScore,
      driftScore: scored.driftScore,
      rootCause: scored.candidatePayload?.rootCause
    }
  })

  return { ok: true, versionId }
}

/* ────────────────────────────────────────────────────────────
 * 4. 阶段 D:基于灰度数据判断晋升
 * ──────────────────────────────────────────────────────────── */

export async function decidePromotion(assistantId, options = {}) {
  const cfg = { ...DEFAULT_FLOW_CONFIG, ...(options.config || {}) }
  const deps = options.deps
  const errMsg = validateDeps(deps, true)
  if (errMsg) throw new Error(errMsg)

  const shadow = getShadowCandidate(assistantId)
  if (!shadow) return { promote: false, reason: 'no-shadow' }

  const stats = getShadowStats(assistantId) || { comparisons: 0 }
  const ageDays = (Date.now() - (shadow.setAt || Date.now())) / 86400e3

  if (stats.comparisons < cfg.shadowMinComparisons) {
    if (ageDays > cfg.shadowMaxDays) {
      // 过期 → 清灰度
      clearShadowCandidate(assistantId)
      appendSignal({
        type: 'audit', assistantId, version: shadow.versionId, success: false,
        userNote: `灰度过期(${ageDays.toFixed(1)}d, ${stats.comparisons} 样本)`,
        metadata: { stage: 'shadow-expired' }
      })
      return { promote: false, reason: `shadow-expired(${ageDays.toFixed(1)}d)` }
    }
    return { promote: false, reason: `shadow-warming(${stats.comparisons}/${cfg.shadowMinComparisons})` }
  }

  const baselineVersion = await deps.getActiveVersionId(assistantId)
  const cmp = compareCandidate(assistantId, baselineVersion, shadow.versionId, {
    days: cfg.raceWindowDays
  })
  if (!cmp || cmp.winner === 'inconclusive') {
    return { promote: false, reason: 'race-inconclusive' }
  }

  return {
    promote: cmp.winner === 'candidate',
    reason: `winner=${cmp.winner}, deltaTotal=${cmp.deltaTotal}`,
    baseline: cmp.baseline,
    candidate: cmp.candidate,
    delta: cmp.deltaByDim
  }
}

/* ────────────────────────────────────────────────────────────
 * 5. 阶段 E:执行晋升 + 启动观察期
 * ──────────────────────────────────────────────────────────── */

export async function promote(assistantId, options = {}) {
  const cfg = { ...DEFAULT_FLOW_CONFIG, ...(options.config || {}) }
  const deps = options.deps
  const errMsg = validateDeps(deps, true)
  if (errMsg) throw new Error(errMsg)

  const shadow = getShadowCandidate(assistantId)
  if (!shadow) return { ok: false, reason: 'no-shadow' }

  const previousVersionId = await deps.getActiveVersionId(assistantId)

  try {
    await deps.setActiveVersion(assistantId, shadow.versionId)
  } catch (e) {
    return { ok: false, reason: 'setActiveVersion-failed:' + String(e?.message || e) }
  }

  clearShadowCandidate(assistantId)
  startObservation({
    assistantId,
    versionId: shadow.versionId,
    previousVersionId,
    observationDays: cfg.observationDays
  })

  appendSignal({
    type: 'audit', assistantId, version: shadow.versionId, success: true,
    userNote: `晋升为活跃版本,进入 ${cfg.observationDays} 天观察期`,
    metadata: { stage: 'promote', previousVersionId }
  })

  return { ok: true, versionId: shadow.versionId, previousVersionId }
}

/* ────────────────────────────────────────────────────────────
 * 6. 单助手:一次性流水线入口
 * ──────────────────────────────────────────────────────────── */

export async function triggerEvaluation(assistantId, options = {}) {
  const trace = []

  // 已在灰度 → 走 decide / promote
  if (getShadowCandidate(assistantId)) {
    const decision = await decidePromotion(assistantId, options)
    trace.push({ stage: 'decidePromotion', ...decision })
    if (decision.promote) {
      const result = await promote(assistantId, options)
      trace.push({ stage: 'promote', ...result })
      return { assistantId, action: result.ok ? 'promoted' : 'promote-failed', reason: result.reason, trace }
    }
    return { assistantId, action: 'shadow-pending', reason: decision.reason, trace }
  }

  // 未在灰度 → 走 evaluate / propose / enter-shadow
  const need = await evaluateNeed(assistantId, options)
  trace.push({ stage: 'evaluateNeed', propose: need.propose, urgency: need.urgency, reason: need.reason })
  if (!need.propose) return { assistantId, action: 'skip', reason: need.reason, trace }

  const ranked = await proposeAndPrejudge(assistantId, need.evidencePackages[0], options)
  trace.push({ stage: 'proposeAndPrejudge', count: ranked.length, top: ranked[0]?.prejudgeScore })
  if (!ranked.length) return { assistantId, action: 'no-candidate', reason: 'all-rejected-or-empty', trace }

  const enter = await enterShadow(assistantId, ranked[0], options)
  trace.push({ stage: 'enterShadow', ...enter })
  return { assistantId, action: enter.ok ? 'shadow-started' : 'shadow-failed', reason: enter.reason, trace }
}

/* ────────────────────────────────────────────────────────────
 * 7. 全局定时任务
 * ──────────────────────────────────────────────────────────── */

export async function runDailyEvaluationCycle(options = {}) {
  const deps = options.deps
  const errMsg = validateDeps(deps, true)
  if (errMsg) throw new Error(errMsg)

  const startedAt = Date.now()
  const summary = {
    evaluated: 0, promoted: 0, shadowStarted: 0, skipped: 0,
    rolledBack: 0, errors: []
  }
  const list = await deps.listAssistants() || []

  // 1. 进化评估
  for (const a of list) {
    const id = a?.id || a?.assistantId
    if (!id) continue
    summary.evaluated += 1
    try {
      const result = await triggerEvaluation(id, options)
      if (result.action === 'promoted') summary.promoted += 1
      else if (result.action === 'shadow-started') summary.shadowStarted += 1
      else summary.skipped += 1
    } catch (e) {
      summary.errors.push({ id, stage: 'evaluation', error: String(e?.message || e) })
    }
  }

  // 2. 观察期回滚检查(callRollback 通过 deps.setActiveVersion 实现)
  const observations = listObservations() || []
  for (const obs of observations) {
    if (obs.rolledBack) continue
    try {
      const decision = await sampleAndDecide({
        assistantId: obs.assistantId,
        callRollback: async (previousVersionId, _reason) => {
          await deps.setActiveVersion(obs.assistantId, previousVersionId)
        }
      })
      if (decision?.rolledBack) {
        summary.rolledBack += 1
        appendSignal({
          type: 'audit', assistantId: obs.assistantId, version: obs.versionId, success: false,
          userNote: `自动回滚:${decision.reason}`,
          metadata: { stage: 'rollback-auto', breach: decision.breach, sample: decision.sample }
        })
      }
    } catch (e) {
      summary.errors.push({ id: obs.assistantId, stage: 'rollback', error: String(e?.message || e) })
    }
  }

  return {
    durationMs: Date.now() - startedAt,
    quota: getQuotaStatus(),
    ...summary
  }
}

/* ────────────────────────────────────────────────────────────
 * 8. 用户主动操作 + 状态查询
 * ──────────────────────────────────────────────────────────── */

/** 用户在「7 天观察期」内主动一键回滚 */
export async function rollbackByUser(assistantId, options = {}) {
  const deps = options.deps
  const errMsg = validateDeps(deps, true)
  if (errMsg) return { ok: false, reason: errMsg }
  return userRollback(assistantId, async (prevVer, _reason) => {
    await deps.setActiveVersion(assistantId, prevVer)
  })
}

/** 一次性拉到所有助手的健康分 + 灰度 + 观察期 + 锚点状态。 */
export function getFlowSnapshot(options = {}) {
  const deps = options.deps
  if (!deps || typeof deps.listAssistants !== 'function') return []
  const observations = listObservations() || []
  const obsByAssistant = new Map(observations.map(o => [o.assistantId, o]))

  return (deps.listAssistants() || []).map(a => {
    const id = a?.id || a?.assistantId || a
    const health = computeHealthScore(id)
    const shadow = getShadowCandidate(id)
    const obs = obsByAssistant.get(id)
    const anchor = getAnchor(id)
    return {
      id,
      health: health ? { total: health.total, R: health.R, A: health.A, C: health.C, E: health.E } : null,
      shadow: shadow ? { versionId: shadow.versionId, setAt: shadow.setAt, expiresAt: shadow.expiresAt } : null,
      observation: obs ? {
        versionId: obs.versionId,
        previousVersionId: obs.previousVersionId,
        startedAt: obs.startedAt,
        expiresAt: obs.expiresAt,
        rolledBack: obs.rolledBack,
        sampleCount: obs.samples?.length || 0
      } : null,
      anchorRegistered: !!anchor
    }
  })
}

export default {
  evaluateNeed,
  proposeAndPrejudge,
  enterShadow,
  decidePromotion,
  promote,
  triggerEvaluation,
  runDailyEvaluationCycle,
  rollbackByUser,
  getFlowSnapshot,
  DEFAULT_FLOW_CONFIG
}
