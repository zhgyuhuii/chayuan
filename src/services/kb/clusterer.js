/**
 * clusterer — T3 本地小 embedding + 层次聚类
 *
 * v1 stub:
 *   - localEmbed 是占位接口,真实实现走 ollama / web-llm / wasm 小模型
 *   - 当前用 char-n-gram TF 的近似向量(无依赖,质量弱但能跑通)
 *   - hierarchicalCluster 用平均连接(average linkage)
 *
 * Phase 3 完成版会切到真正 384 维 embedding,并把 clusterer 移进 worker。
 */

const NGRAM = 3

function _ngramVector(text, n = NGRAM) {
  const t = String(text || '').replace(/\s+/g, '').slice(0, 2000)
  const map = new Map()
  for (let i = 0; i <= t.length - n; i++) {
    const g = t.slice(i, i + n)
    map.set(g, (map.get(g) || 0) + 1)
  }
  // L2 normalize
  let norm = 0
  for (const v of map.values()) norm += v * v
  norm = Math.sqrt(norm) || 1
  for (const [k, v] of map) map.set(k, v / norm)
  return map
}

function _cosine(a, b) {
  let dot = 0
  const small = a.size <= b.size ? a : b
  const big = small === a ? b : a
  for (const [k, v] of small) {
    const v2 = big.get(k)
    if (v2) dot += v * v2
  }
  return dot
}

export async function localEmbed(texts, _options = {}) {
  // v1:用 ngram 向量替代真实 embedding,接口契约保持一致(返回向量数组)
  return texts.map(_ngramVector)
}

export function hierarchicalCluster(embs, { simThreshold = 0.85, maxK = 16 } = {}) {
  const n = embs.length
  if (n === 0) return []
  // 初始:每个点一簇
  let clusters = embs.map((e, i) => ({ ids: [i], centroid: e }))
  // 计算距离矩阵(用 1 - sim)
  function pairwise(a, b) {
    return _cosine(a.centroid, b.centroid)
  }

  while (clusters.length > 1) {
    let bestI = -1, bestJ = -1, bestSim = -Infinity
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const s = pairwise(clusters[i], clusters[j])
        if (s > bestSim) { bestSim = s; bestI = i; bestJ = j }
      }
    }
    if (bestI < 0) break
    // 终止条件:相似度低于阈值 且 簇数 ≤ maxK
    if (bestSim < simThreshold && clusters.length <= maxK) break
    if (clusters.length <= 1) break
    // 合并 i, j
    const merged = {
      ids: [...clusters[bestI].ids, ...clusters[bestJ].ids],
      centroid: _mergeCentroid(clusters[bestI], clusters[bestJ])
    }
    clusters = clusters.filter((_, k) => k !== bestI && k !== bestJ)
    clusters.push(merged)
    // 强制不超过 maxK 才停
    if (clusters.length <= maxK && bestSim < simThreshold) break
  }

  return clusters.map((c, idx) => ({
    id: idx,
    unitIds: c.ids,
    size: c.ids.length
  }))
}

function _mergeCentroid(a, b) {
  // 加权平均:这里就用 sum 后再归一(简化)
  const out = new Map()
  const wa = a.ids.length, wb = b.ids.length
  for (const [k, v] of a.centroid) out.set(k, (out.get(k) || 0) + v * wa)
  for (const [k, v] of b.centroid) out.set(k, (out.get(k) || 0) + v * wb)
  let norm = 0
  for (const v of out.values()) norm += v * v
  norm = Math.sqrt(norm) || 1
  for (const [k, v] of out) out.set(k, v / norm)
  return out
}

export function pickRepresentative(cluster, units) {
  // 取簇内最长 unit 作代表(简单实用)
  let best = units[cluster.unitIds[0]]
  for (const id of cluster.unitIds) {
    const u = units[id]
    if (u && (u.text?.length || 0) > (best?.text?.length || 0)) best = u
  }
  return best
}

export function pickRepresentatives(cluster, units, k = 2) {
  const sorted = [...cluster.unitIds]
    .map(id => units[id])
    .filter(Boolean)
    .sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0))
  return sorted.slice(0, k)
}

export default {
  localEmbed, hierarchicalCluster, pickRepresentative, pickRepresentatives
}
