/**
 * judgeFallback — 单家族判官降级方案
 *
 * 问题:judge.pickJudges 要求 ≥2 个不同家族模型。用户只配 OpenAI key 时,
 * pickJudges 返回 [],arbitrate 静默 fail,所有候选都不通过预审。
 *
 * 降级策略(按优先级):
 *   1. 双家族可用 → 走原 arbitrate(交叉家族,理想情况)
 *   2. 仅 1 家族 + ≥2 模型 → 用同家族不同模型(如 gpt-4o-mini + gpt-4o)
 *      ↳ 偏置存在,但比单模型自评好
 *   3. 仅 1 模型可用 → 走"自洽性"评估(同 prompt 跑 N 次,看输出方差)
 *      ↳ 不是真"判官",但能筛掉极端不稳定的候选
 *
 * 用户开启 featureFlags.singleModelJudgeFallback 后,arbitrate 自动应用此策略。
 */

import { inferModelFamily, judgeOnce } from './judge.js'
import { getFlatModelsFromSettings } from '../../modelSettings.js'

const SELF_CONSISTENCY_RUNS = 3

/**
 * 评估当前可用判官资源,选择最优策略。
 * 返回 { strategy: 'cross-family' | 'same-family' | 'self-consistency' | 'none', judges: [] }
 */
export function chooseJudgeStrategy(candidateModel) {
  const candFamily = inferModelFamily(candidateModel)
  const allModels = (getFlatModelsFromSettings('chat') || []).filter(m => m && m.providerId && m.modelId)

  if (allModels.length === 0) {
    return { strategy: 'none', judges: [], reason: '无可用 chat 模型' }
  }

  // 过滤跟候选不同的模型
  const others = allModels.filter(m => `${m.providerId}|${m.modelId}` !== `${candidateModel?.providerId}|${candidateModel?.modelId}`)

  // 尝试跨家族
  const crossFamily = others.filter(m => inferModelFamily(m) !== candFamily)
  if (crossFamily.length >= 1) {
    return {
      strategy: 'cross-family',
      judges: crossFamily.slice(0, 2),
      reason: `${crossFamily.length} 个跨家族模型可用`
    }
  }

  // 退而求其次:同家族其他模型
  if (others.length >= 1) {
    return {
      strategy: 'same-family',
      judges: others.slice(0, 2),
      reason: '仅同家族不同模型,有偏置但比单模型好'
    }
  }

  // 最后:自洽性
  return {
    strategy: 'self-consistency',
    judges: [allModels[0]],   // 用候选自身
    reason: '只有 1 个模型,降级到自洽性评估(同 prompt 跑 N 次)'
  }
}

/**
 * 自洽性评估:用同一个模型跑 N 次,统计 candidateOutput 的方差。
 * 方差小 → 输出稳定 → 高分;方差大 → 不稳定 → 低分。
 *
 * 返回 0..100 分。
 */
export async function evaluateSelfConsistency(options = {}) {
  const judge = options.judge
  const runs = Math.max(2, Math.min(options.runs || SELF_CONSISTENCY_RUNS, 5))
  if (!judge) return 0

  const outputs = []
  for (let i = 0; i < runs; i++) {
    try {
      const r = await judgeOnce({
        judgeModel: judge,
        input: options.input,
        baseline: options.baseline,
        candidate: options.candidate,
        expected: options.expected
      })
      if (r?.ok) outputs.push(r)
    } catch (_) { /* ignore single run failure */ }
  }
  if (outputs.length < 2) return 0

  // 计算 candidateScore 的方差
  const scores = outputs.map(o => o.candidateScore).filter(s => typeof s === 'number')
  if (scores.length < 2) return 0
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length
  const stddev = Math.sqrt(variance)

  // stddev=0 → 完全一致 → 100;stddev=20 → 0
  return Math.max(0, Math.min(100, Math.round(100 - stddev * 5)))
}

export const STRATEGIES = Object.freeze(['cross-family', 'same-family', 'self-consistency', 'none'])

export default {
  chooseJudgeStrategy,
  evaluateSelfConsistency,
  STRATEGIES
}
