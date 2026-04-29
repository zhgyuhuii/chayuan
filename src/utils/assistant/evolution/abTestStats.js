/**
 * abTestStats — A/B 测试统计显著性
 *
 * 解决 P6 问题:rolloutBucketing 是手动判断阶段,缺统计显著性。
 * 候选 vs 基线表面上"略好"可能只是噪声,需要 z-test / chi-square 判断。
 *
 * 实现 2 个常用检验:
 *   - twoProportionZTest:比较两组的转化率(accept rate / fail rate)
 *   - tTest:比较两组的连续指标(如 RACE 总分)
 *
 * 用法:
 *   import stats from '@/utils/assistant/evolution/abTestStats.js'
 *
 *   // 基线 100 次任务,80 成功;候选 50 次,46 成功 → 候选显著更好?
 *   const r = stats.twoProportionZTest({
 *     baselineSuccess: 80, baselineTotal: 100,
 *     candidateSuccess: 46, candidateTotal: 50
 *   })
 *   // r = { z, pValue, significant: boolean, lift: 0.12 }
 */

const Z_TABLE = {
  0.001: 3.291,
  0.01: 2.576,
  0.05: 1.96,
  0.10: 1.645
}

/**
 * 双侧 Z 检验近似 p 值(用 erfc-like 近似)。
 * 不需要外部库,精度足够 0.001 级判断。
 */
function pValueFromZ(z) {
  const absZ = Math.abs(z)
  // Abramowitz & Stegun 7.1.26 近似
  const t = 1 / (1 + 0.2316419 * absZ)
  const d = 0.3989422804014327 * Math.exp(-absZ * absZ / 2)
  const p = d * (0.319381530 * t
    - 0.356563782 * t * t
    + 1.781477937 * t * t * t
    - 1.821255978 * t * t * t * t
    + 1.330274429 * t * t * t * t * t)
  return 2 * p   // 双侧
}

/**
 * 两组比例 Z 检验。
 *
 * 入参:{ baselineSuccess, baselineTotal, candidateSuccess, candidateTotal }
 * 返回:{ z, pValue, significant, lift, alpha }
 */
export function twoProportionZTest(options = {}) {
  const a = options.baselineSuccess
  const n1 = options.baselineTotal
  const b = options.candidateSuccess
  const n2 = options.candidateTotal
  const alpha = Number(options.alpha) || 0.05

  if (!Number.isFinite(a) || !Number.isFinite(n1) || !Number.isFinite(b) || !Number.isFinite(n2)) {
    return { z: 0, pValue: 1, significant: false, lift: 0, error: '参数缺失或非数字' }
  }
  if (n1 < 10 || n2 < 10) {
    return { z: 0, pValue: 1, significant: false, lift: 0, error: '样本量过小(<10)' }
  }

  const p1 = a / n1
  const p2 = b / n2
  const pPool = (a + b) / (n1 + n2)
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2))
  if (se === 0) return { z: 0, pValue: 1, significant: false, lift: 0, error: 'SE=0' }
  const z = (p2 - p1) / se
  const pValue = pValueFromZ(z)
  const lift = p1 === 0 ? 0 : (p2 - p1) / p1
  return {
    z: Number(z.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    significant: pValue < alpha && z > 0,    // 候选显著好(单侧解读)
    lift: Number(lift.toFixed(4)),
    alpha,
    baseline: { success: a, total: n1, rate: Number(p1.toFixed(4)) },
    candidate: { success: b, total: n2, rate: Number(p2.toFixed(4)) }
  }
}

/**
 * 简化版独立样本 t-test(等方差假设)。
 *
 * 入参:{ baseline: number[], candidate: number[], alpha? }
 * 返回:{ t, pValue, significant, meanDelta, alpha }
 */
export function tTest(options = {}) {
  const a = options.baseline || []
  const b = options.candidate || []
  const alpha = Number(options.alpha) || 0.05
  if (a.length < 5 || b.length < 5) {
    return { t: 0, pValue: 1, significant: false, meanDelta: 0, error: '样本量过小(<5)' }
  }
  const mean = arr => arr.reduce((s, x) => s + x, 0) / arr.length
  const variance = (arr, m) => arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1)
  const ma = mean(a), mb = mean(b)
  const va = variance(a, ma), vb = variance(b, mb)
  const pooled = ((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2)
  const se = Math.sqrt(pooled * (1 / a.length + 1 / b.length))
  if (se === 0) return { t: 0, pValue: 1, significant: false, meanDelta: mb - ma }
  const t = (mb - ma) / se
  // 用 z-table 近似(t 分布在大样本下趋近正态)
  const pValue = pValueFromZ(t)
  return {
    t: Number(t.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    significant: pValue < alpha && t > 0,
    meanDelta: Number((mb - ma).toFixed(3)),
    alpha,
    baselineMean: Number(ma.toFixed(3)),
    candidateMean: Number(mb.toFixed(3)),
    baselineN: a.length,
    candidateN: b.length
  }
}

/**
 * 给定当前 stage 数据,判断"是否有把握晋升下一 stage"。
 * 集成 rolloutBucketing 的工具:返回 { shouldAdvance, reason, stats }
 */
export function shouldAdvanceStage(rolloutData) {
  const { baselineSuccess, baselineTotal, candidateSuccess, candidateTotal } = rolloutData || {}
  const result = twoProportionZTest({
    baselineSuccess, baselineTotal,
    candidateSuccess, candidateTotal,
    alpha: 0.05
  })
  if (result.error) {
    return { shouldAdvance: false, reason: result.error, stats: result }
  }
  if (result.significant) {
    return { shouldAdvance: true, reason: `候选显著优(p=${result.pValue}, lift=${(result.lift * 100).toFixed(1)}%)`, stats: result }
  }
  if (result.z < -1.96) {
    return { shouldAdvance: false, reason: `候选显著差(z=${result.z}),建议回滚`, stats: result, recommend: 'rollback' }
  }
  return { shouldAdvance: false, reason: `差异不显著(p=${result.pValue}),继续观察`, stats: result }
}

export const Z_THRESHOLDS = Z_TABLE

export default {
  twoProportionZTest,
  tTest,
  shouldAdvanceStage,
  pValueFromZ,
  Z_THRESHOLDS
}
