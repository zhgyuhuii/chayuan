/**
 * searchOrchestrator — 编排 plan → batch → dedup → score → 输出
 *
 * 详见 plan-knowledge-base-integration.md §3.2.6
 *
 * 入口:
 *   run({
 *     connection,                        // services.kb.connection.current() 拿
 *     query,                             // 原文/选段
 *     kbBindings: { kbNames, topK?, hybrid?, rerank? },
 *     mode: 'qa'|'verify'|'summarize',
 *     budget?, signal?, onPhase?, chatCompletion?
 *   })
 *
 * 输出:
 *   {
 *     chunks: ScoredChunk[],
 *     bySection?: Record<sectionId, ScoredChunk[]>,   // verify 模式才有
 *     plan: { queries, viaT3?, viaT4? },
 *     timings: { planMs, fetchMs, totalMs }
 *   }
 */

import { plan as planQueries } from './queryPlanner.js'
import * as searchClient from './searchClient.js'
import * as deduper from './deduper.js'
import * as scorer from './credibilityScorer.js'
// p3-8:可用时优先把 T1+T2+T3 推到 worker;不可用时透明回落到主线程 plan
let _planViaWorker = null
try {
  // 同步 import 在 ESM 里要用顶层 await,这里改成动态 import + 缓存(首次用时挂上)
  _planViaWorker = null
} catch (e) { _planViaWorker = null }
async function _ensureWorkerPlanner() {
  if (_planViaWorker !== null) return _planViaWorker
  try {
    const mod = await import('../../workers/kbPlannerClient.js')
    _planViaWorker = typeof mod?.planKbQueriesViaWorker === 'function'
      ? mod.planKbQueriesViaWorker
      : null
  } catch (e) {
    _planViaWorker = null
  }
  return _planViaWorker
}

const FINAL_TOP_K_DEFAULT = 12
const TOTAL_TIMEOUT_MS = 60_000

const _batchLru = new Map()  // signature → { value, expireAt }
const LRU_TTL_MS = 5 * 60_000
const LRU_MAX = 32

function _sha1Hex(s) {
  // 轻量 hash:不需要密码学强度,只要稳定;用 djb2
  let h = 5381
  const str = String(s || '')
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i)
    h = h | 0
  }
  return (h >>> 0).toString(16)
}

function _lruGet(key) {
  const hit = _batchLru.get(key)
  if (!hit) return null
  if (hit.expireAt < Date.now()) {
    _batchLru.delete(key)
    return null
  }
  return hit.value
}

function _lruSet(key, value) {
  _batchLru.delete(key)
  _batchLru.set(key, { value, expireAt: Date.now() + LRU_TTL_MS })
  while (_batchLru.size > LRU_MAX) {
    const k = _batchLru.keys().next().value
    if (k === undefined) break
    _batchLru.delete(k)
  }
}

async function _fallbackLoopSearchDocs(connection, queries, kbNames, body, signal) {
  // 旧版服务端没有 /search_batch 时的兜底:并发受限循环
  const concurrency = 4
  let cursor = 0
  const all = []
  async function worker() {
    while (cursor < queries.length) {
      const i = cursor++
      const q = queries[i]
      for (const kb of kbNames) {
        try {
          const data = await searchClient.searchDocs(connection, {
            query: q.text,
            knowledge_base_name: kb,
            top_k: body.top_k_per_query,
            score_threshold: body.score_threshold,
            use_hybrid: body.use_hybrid,
            use_rerank: body.use_rerank
          }, { signal })
          // 旧端点返回是 chunks list
          const list = Array.isArray(data) ? data : (data?.data || [])
          for (const c of list) {
            all.push({
              chunk_id: c.chunk_id || c.id || `${kb}::${c.metadata?.source}::${c.metadata?.chunk_index}`,
              text: c.page_content || c.text || '',
              metadata: c.metadata || {},
              kb_name: kb,
              file_name: c.metadata?.source || c.file_name || '',
              score: c.score || c.metadata?.score || 0,
              from_query_tags: [q.tag],
              from_section_ids: q.sectionIds || []
            })
          }
        } catch (e) {
          // 单查询失败不致命,跳过
        }
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return { merged: all }
}

export async function run(options = {}) {
  const {
    connection,
    query,
    kbBindings,
    mode = 'qa',
    budget,
    signal,
    onPhase,
    chatCompletion
  } = options

  if (!connection) throw new Error('connection is required')
  if (!kbBindings?.kbNames?.length) throw new Error('kbBindings.kbNames is required')

  const totalStart = Date.now()
  const ctrl = new AbortController()
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true })
  const totalT = setTimeout(() => ctrl.abort(), TOTAL_TIMEOUT_MS)

  try {
    const planStart = Date.now()
    let queries
    const workerPlanner = await _ensureWorkerPlanner()
    // worker 路径只覆盖"无 distill"档(text ≤ 20k);> 20k 字仍走主线程 distill
    if (workerPlanner && String(query || '').length <= 20_000) {
      try {
        queries = await workerPlanner({
          text: query, mode,
          options: { budget },
          chatCompletion,
          signal: ctrl.signal,
        })
      } catch (e) {
        queries = await planQueries(query, mode, {
          budget, signal: ctrl.signal, onPhase, chatCompletion,
        })
      }
    } else {
      queries = await planQueries(query, mode, {
        budget, signal: ctrl.signal, onPhase, chatCompletion,
      })
    }
    queries = Array.isArray(queries) ? queries : []
    const planMs = Date.now() - planStart
    if (queries.length === 0) {
      return { chunks: [], plan: { queries: 0 }, timings: { planMs, fetchMs: 0, totalMs: Date.now() - totalStart } }
    }

    const body = {
      queries: queries.map(q => ({
        tag: q.tag,
        text: q.text,
        weight: q.weight,
        section_ids: q.sectionIds
      })),
      knowledge_base_names: kbBindings.kbNames,
      top_k_per_query: kbBindings.topK || 6,
      score_threshold: kbBindings.scoreThreshold ?? 0.3,
      use_hybrid: kbBindings.hybrid !== false,
      use_rerank: kbBindings.rerank !== false,
      merge_strategy: kbBindings.mergeStrategy || 'rrf',
      dedup_by: 'chunk_id',
      final_top_k: kbBindings.finalTopK || FINAL_TOP_K_DEFAULT
    }

    const sig = _sha1Hex(JSON.stringify({
      q: queries.map(q => q.text), kbs: [...kbBindings.kbNames].sort(),
      k: body.top_k_per_query, hybrid: body.use_hybrid, rerank: body.use_rerank,
      merge: body.merge_strategy
    }))
    const cached = _lruGet(sig)

    let merged
    let fetchMs = 0
    if (cached) {
      merged = cached
      if (typeof onPhase === 'function') await onPhase('cache_hit', {})
    } else {
      const fetchStart = Date.now()
      let resp
      try {
        const out = await searchClient.searchBatch(connection, body, { signal: ctrl.signal })
        resp = out?.data || out
      } catch (e) {
        if (e?.code === 'ENDPOINT_NOT_FOUND') {
          // 兜底:循环 /search_docs
          if (typeof onPhase === 'function') await onPhase('fallback_search_docs', {})
          resp = await _fallbackLoopSearchDocs(connection, queries, kbBindings.kbNames, body, ctrl.signal)
        } else {
          throw e
        }
      }
      const rawMerged = Array.isArray(resp?.merged) ? resp.merged : []
      merged = deduper.merge(rawMerged, queries)
      _lruSet(sig, merged)
      fetchMs = Date.now() - fetchStart
    }

    const ranked = scorer.score(merged, { query, mode, queries })
    const finalK = body.final_top_k
    const final = ranked.slice(0, finalK)

    let bySection
    if (mode === 'verify') {
      bySection = {}
      for (const c of final) {
        for (const sid of (c.from_section_ids || [])) {
          if (!bySection[sid]) bySection[sid] = []
          bySection[sid].push(c)
        }
      }
    }

    if (typeof onPhase === 'function') {
      await onPhase('done', { kept: final.length, dropped: merged.length - final.length })
    }
    return {
      chunks: final,
      bySection,
      plan: { queries: queries.length },
      timings: { planMs, fetchMs, totalMs: Date.now() - totalStart }
    }
  } finally {
    clearTimeout(totalT)
  }
}

export default { run }
