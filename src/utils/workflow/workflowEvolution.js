/**
 * workflowEvolution — 工作流作为进化单元(W6.1-6.4)
 *
 * 复用 P3 进化系统 的核心思路,但被进化的对象不再是助手,而是工作流。
 *
 * 对象映射:
 *   助手        ←→  工作流
 *   systemPrompt ←→  workflow.nodes + workflow.edges(整体 JSON)
 *   driftScore  ←→  workflowDiff(只拒绝结构性大改)
 *   judge       ←→  整工作流的输出 vs baseline 输出 比对
 *   shadow run  ←→  baseline workflow + candidate workflow 同输入并行跑
 *   RACE        ←→  R=完成率 / A=输出 vs 期望 / C=未触发回滚条件 / E=p95 延迟
 *
 * 这层只是骨架 — 真正接通 promotionFlow 需要 caller 提供 deps 注入。
 */

import { appendSignal } from '../assistant/evolution/signalStore.js'
import { compareCandidate } from '../assistant/evolution/raceEvaluator.js'
import { setShadowCandidate, getShadowCandidate, clearShadowCandidate, runWithShadow } from '../assistant/evolution/shadowRunner.js'
import { evaluateRollout, getRolloutStatus, isUserInRollout } from '../assistant/evolution/rolloutBucketing.js'
import { startObservation } from '../assistant/evolution/rollbackMonitor.js'
import { diffWorkflows, recommendBump, bumpVersion } from './workflowDiff.js'

/* ────────────────────────────────────────────────────────────
 * W6.1 — 工作流作为进化候选
 * ──────────────────────────────────────────────────────────── */

/**
 * 把 baseline workflow + candidate workflow 包成「候选包」,
 * 喂给 promotionFlow.proposeAndPrejudge 兼容的格式。
 */
export function buildWorkflowCandidate(baseline, candidate, options = {}) {
  if (!baseline?.id || !candidate?.id) {
    throw new Error('buildWorkflowCandidate: 双方都需 id')
  }
  const diff = diffWorkflows(baseline, candidate)
  const recommendedLevel = recommendBump(diff)
  const newVersion = candidate.version || bumpVersion(baseline.version || '0.0.1', recommendedLevel)

  return {
    candidate: {
      systemPrompt: JSON.stringify(candidate.nodes), // 让现有 anchorPrompt drift 逻辑可工作
      userPromptTemplate: '', // 工作流无独立 user prompt
      _isWorkflow: true,
      _workflow: candidate,
      _version: newVersion
    },
    rootCause: options.rootCause || '',
    repairReason: options.repairReason || '',
    diffSummary: [
      ...diff.nodesAdded.map(n => `+ 节点 ${n.id}(${n.type})`),
      ...diff.nodesRemoved.map(n => `- 节点 ${n.id}`),
      ...diff.nodesChanged.map(n => `~ 节点 ${n.id} 改配置`)
    ].slice(0, 20),
    sourceCluster: options.sourceCluster || '',
    workflowDiff: diff
  }
}

/* ────────────────────────────────────────────────────────────
 * W6.2 — 工作流级 RACE
 * ──────────────────────────────────────────────────────────── */

/**
 * 工作流的 RACE 计算:
 *   R(可靠性) — 完成率(成功完成 instance / 启动 instance)
 *   A(准确性) — judge 平均分(若有)、单元测试通过率(若提供 testCases)
 *   C(合规性) — 未触发任何回滚条件(undoBundle 未触发 + 无审计违规)
 *   E(效率) — 1 - (p95 延迟 / 阈值)
 */
export function computeWorkflowHealth(workflowId, options = {}) {
  const days = options.days || 7
  const since = Date.now() - days * 86400000
  const signals = (options.allSignals || [])
    .filter(s => s.assistantId === `workflow.${workflowId.slice(-8)}` && s.timestamp >= since)

  if (signals.length === 0) {
    return null  // 无样本
  }

  // R:完成率
  const taskSignals = signals.filter(s => s.type === 'task')
  const successCount = taskSignals.filter(s => s.success).length
  const R = taskSignals.length === 0 ? 0 : Math.round((successCount / taskSignals.length) * 100)

  // A:judge 平均分 + testCase 通过率
  let A = R   // fallback
  if (options.judgeScore != null) {
    A = Math.round((R * 0.5) + (options.judgeScore * 0.5))
  }

  // C:合规 — 无 audit failure
  const auditFails = signals.filter(s => s.type === 'audit' && !s.success).length
  const C = auditFails === 0 ? 100 : Math.max(0, 100 - auditFails * 20)

  // E:效率
  const durations = taskSignals.map(s => s.duration).filter(d => d > 0).sort((a, b) => a - b)
  const p95 = durations.length === 0
    ? 0
    : durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1]
  const threshold = options.efficiencyThresholdMs || 60000  // 1 分钟 = 60 分
  const E = p95 === 0 ? 100 : Math.max(0, Math.min(100, Math.round(100 - (p95 / threshold) * 50)))

  // 总分(等权)
  const total = Math.round((R + A + C + E) / 4)
  return {
    R, A, C, E, total,
    sampleCount: signals.length,
    durations: { p95, count: durations.length }
  }
}

/* ────────────────────────────────────────────────────────────
 * W6.3 — 工作流 shadow run
 * ──────────────────────────────────────────────────────────── */

/**
 * 让一个 workflow 调用走 shadow:
 *   baseline + candidate 同输入并行跑,记录 comparison。
 *
 * 由 workflowRunner 在调度顶级 instance 时调,而非节点级。
 */
export async function runWorkflowWithShadow(workflowId, options = {}) {
  if (typeof options.runBaseline !== 'function') {
    throw new Error('runWorkflowWithShadow: runBaseline 必填')
  }
  // 复用 P3 shadowRunner.runWithShadow
  return runWithShadow({
    assistantId: `workflow.${workflowId.slice(-8)}`,
    kind: options.kind || 'workflow',
    isLocalModel: false,
    baselineRun: options.runBaseline,
    shadowRun: options.runCandidate || (async () => null)
  })
}

export function setWorkflowShadowCandidate(workflowId, candidateVersionId, options = {}) {
  return setShadowCandidate(`workflow.${workflowId.slice(-8)}`, candidateVersionId, options)
}

export function getWorkflowShadowCandidate(workflowId) {
  return getShadowCandidate(`workflow.${workflowId.slice(-8)}`)
}

export function clearWorkflowShadowCandidate(workflowId) {
  return clearShadowCandidate(`workflow.${workflowId.slice(-8)}`)
}

/* ────────────────────────────────────────────────────────────
 * W6.4 — 工作流 rollout(灰度分桶)
 * ──────────────────────────────────────────────────────────── */

/**
 * 用户(userKey)是否在该工作流候选的灰度范围内。
 *   - true:执行 candidate 版
 *   - false:执行 baseline 版
 */
export function isUserInWorkflowRollout(workflowId, candidateVersionId, userKey = 'default') {
  return isUserInRollout(`workflow.${workflowId}`, candidateVersionId, userKey)
}

/**
 * 评估某工作流候选的灰度阶段是否应该晋级。
 */
export function evaluateWorkflowRollout(workflowId, candidateVersionId, options = {}) {
  return evaluateRollout(`workflow.${workflowId}`, candidateVersionId, options)
}

/**
 * 基于工作流的 RACE 跌破检测,触发自动回滚。
 *   options.compareTo 历史基线 RACE
 */
export async function checkWorkflowAutoRollback(workflowId, options = {}) {
  const health = computeWorkflowHealth(workflowId, options)
  if (!health) return { shouldRollback: false, reason: 'no-data' }
  const baseline = options.compareTo || { R: 80, A: 80, C: 80, E: 70, total: 78 }

  const breach = []
  if (health.R < baseline.R - 10) breach.push(`R 跌 ${baseline.R - health.R} 分`)
  if (health.A < baseline.A - 10) breach.push(`A 跌 ${baseline.A - health.A} 分`)
  if (health.C < baseline.C - 5)  breach.push(`C 跌 ${baseline.C - health.C} 分`)
  if (health.E < baseline.E - 15) breach.push(`E 跌 ${baseline.E - health.E} 分`)

  if (breach.length === 0) return { shouldRollback: false, health }

  appendSignal({
    type: 'audit',
    assistantId: `workflow.${workflowId.slice(-8)}`,
    success: false,
    userNote: `工作流 RACE 跌破基线:${breach.join('、')}`,
    metadata: { breach, current: health, baseline }
  })

  return {
    shouldRollback: true,
    reason: breach.join('、'),
    health,
    baseline
  }
}

/* ────────────────────────────────────────────────────────────
 * 一站式 deps builder(给 promotionFlow 用)
 * ──────────────────────────────────────────────────────────── */

/**
 * 把以上所有功能 helper 包成一个 deps,可以注入 promotionFlow:
 *   const wfDeps = buildWorkflowEvolutionDeps({
 *     listWorkflows, getWorkflow, addCandidateVersion, setActiveVersion, getActiveVersionId,
 *     model, runOnSamples
 *   })
 *
 * 与 P3 buildEvolutionDeps 完全同型,但调用对象是工作流。
 */
export function buildWorkflowEvolutionDeps(options = {}) {
  const required = ['listWorkflows', 'getWorkflow', 'addCandidateVersion', 'setActiveVersion', 'getActiveVersionId', 'runOnSamples']
  for (const f of required) {
    if (typeof options[f] !== 'function') {
      throw new Error(`buildWorkflowEvolutionDeps: ${f} 必填`)
    }
  }
  return {
    listAssistants: options.listWorkflows,
    getAssistant: options.getWorkflow,
    addCandidateVersion: options.addCandidateVersion,
    setActiveVersion: options.setActiveVersion,
    getActiveVersionId: options.getActiveVersionId,
    runOnSamples: options.runOnSamples,
    model: options.model || { providerId: 'openai', modelId: 'gpt-4o-mini' }
  }
}

export default {
  buildWorkflowCandidate,
  computeWorkflowHealth,
  runWorkflowWithShadow,
  setWorkflowShadowCandidate,
  getWorkflowShadowCandidate,
  clearWorkflowShadowCandidate,
  isUserInWorkflowRollout,
  evaluateWorkflowRollout,
  checkWorkflowAutoRollback,
  buildWorkflowEvolutionDeps
}
