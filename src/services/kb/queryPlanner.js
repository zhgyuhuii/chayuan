/**
 * queryPlanner — 四层漏斗总入口(plan)
 *
 * 详见 plan-knowledge-base-integration.md §3.2.5
 *
 * plan(text, mode, { budget?, onPhase?, signal?, chatCompletion?, simThreshold? })
 *   → Array<{ tag, sectionIds, text, weight }>
 *
 * onPhase(phase, info) 用于驱动 UI 进度条;phase ∈
 *   splitting | clustering | distilling | done
 *
 * 自动选档(详见 §3.2.5.3):
 *   ≤ 200 字  → 单查询,跳 T2/T3/T4
 *   ≤ 800 字  → T1+T2,跳 T3/T4
 *   ≤ 4 000 字→ T1+T2,跳 T3/T4
 *   ≤ 20 000 字→ T1+T2+T3,跳 T4(每簇取代表段)
 *   ≤ 100 000 字→ 全启
 *   > 100 000 字→ 全启 + 多轮(由调用方分轮)
 */

import { planUnits } from './splitters.js'
import { localEmbed, hierarchicalCluster, pickRepresentative, pickRepresentatives } from './clusterer.js'
import { distillBatch } from './localDistiller.js'

function _autoBudget(len) {
  if (len <= 200) return 1
  if (len <= 800) return 4
  if (len <= 4000) return 10
  if (len <= 20_000) return 16
  if (len <= 100_000) return 24
  return 32
}

// eslint-disable-next-line no-unused-vars
function _autoSimThreshold(_len) {
  // _len 预留按文本长度自适应阈值;v1 固定 0.85(详见 §3.2.5.6 #3)
  return 0.85
}

async function _emit(onPhase, phase, info) {
  if (typeof onPhase === 'function') {
    try { await onPhase(phase, info || {}) } catch (e) { /* ignore */ }
  }
}

export async function plan(text, mode = 'qa', options = {}) {
  const t = String(text || '')
  const len = t.length
  const budget = options.budget || _autoBudget(len)
  const simThreshold = options.simThreshold || _autoSimThreshold(len)
  const signal = options.signal

  if (signal?.aborted) throw new Error('aborted')

  // —— T1 + T2 ——
  await _emit(options.onPhase, 'splitting', { len })
  const units = planUnits(t)
  if (units.length <= 4 || len <= 800) {
    // 单查询 or 短文本 → 不走 T3/T4,逐 unit 直接发
    const queries = units.map((u, i) => ({
      tag: `u${i}`,
      sectionIds: [u.id],
      text: u.text.slice(0, 280),
      weight: 1
    })).slice(0, budget)
    if (queries.length === 0 && len > 0) {
      queries.push({ tag: 'u0', sectionIds: ['root'], text: t.slice(0, 280), weight: 1 })
    }
    await _emit(options.onPhase, 'done', { queries: queries.length })
    return queries
  }

  // —— T3 ——
  await _emit(options.onPhase, 'clustering', { units: units.length })
  const embs = await localEmbed(units.map(u => u.text), { signal })
  if (signal?.aborted) throw new Error('aborted')
  const maxK = Math.min(budget, Math.max(1, Math.ceil(units.length / 5)))
  const clusters = hierarchicalCluster(embs, { simThreshold, maxK })

  // —— T4(可选) ——
  const enableDistill = len > 20_000
  if (!enableDistill) {
    const queries = clusters.flatMap(c => {
      const rep = pickRepresentative(c, units)
      const sectionIds = c.unitIds.map(i => units[i]?.id).filter(Boolean)
      return [{
        tag: `c${c.id}`,
        sectionIds,
        text: (rep?.text || '').slice(0, 280),
        weight: c.size / units.length
      }]
    }).slice(0, budget)
    await _emit(options.onPhase, 'done', { queries: queries.length, viaT3: true })
    return queries
  }

  await _emit(options.onPhase, 'distilling', { clusters: clusters.length })
  const repsPerCluster = clusters.map(c => pickRepresentatives(c, units, 2))
  const distilled = await distillBatch(repsPerCluster, mode, {
    chatCompletion: options.chatCompletion,
    signal,
    maxPhrasesPerCluster: 3
  })
  if (signal?.aborted) throw new Error('aborted')

  const queries = []
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i]
    const sectionIds = c.unitIds.map(j => units[j]?.id).filter(Boolean)
    for (const phrase of (distilled[i]?.phrases || [])) {
      queries.push({
        tag: `c${c.id}`,
        sectionIds,
        text: String(phrase).slice(0, 280),
        weight: c.size / units.length
      })
      if (queries.length >= budget) break
    }
    if (queries.length >= budget) break
  }
  await _emit(options.onPhase, 'done', { queries: queries.length, viaT4: true })
  return queries
}

export default { plan }
