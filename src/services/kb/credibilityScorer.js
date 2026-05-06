/**
 * credibilityScorer — 多信号信任度评分(详见 plan §3.2.7)
 *
 * trust = w1·norm(score) + w2·titleHit + w3·sectionHit
 *       + w4·queryRecall + w5·sourceQuality + w6·crossBatchAgreement
 *       − p1·staleness
 *
 * 默认权重(可在设置里露"高级配置"覆盖):
 *   w1=0.40 w2=0.10 w3=0.10 w4=0.20 w5=0.10 w6=0.10  p1=0.05
 *
 * 输出:
 *   { ...chunk, trust, stars }      stars ∈ [1,5]
 */

const DEFAULTS = {
  w1: 0.40, w2: 0.10, w3: 0.10, w4: 0.20, w5: 0.10, w6: 0.10, p1: 0.05
}

function _norm01(v) {
  const x = Number(v || 0)
  if (x <= 0) return 0
  if (x >= 1) return 1
  return x
}

function _ngrams(text, n = 3) {
  const t = String(text || '').replace(/\s+/g, '').toLowerCase()
  const set = new Set()
  for (let i = 0; i <= t.length - n; i++) set.add(t.slice(i, i + n))
  return set
}

function _ngramRecall(query, doc) {
  const q = _ngrams(query)
  if (q.size === 0) return 0
  const d = _ngrams(doc)
  let hit = 0
  for (const g of q) if (d.has(g)) hit++
  return hit / q.size
}

function _stalenessDays(metadata) {
  const u = metadata?.updated_at || metadata?.modified_at || metadata?.indexed_at
  if (!u) return 0
  const t = Date.parse(u)
  if (Number.isNaN(t)) return 0
  const days = (Date.now() - t) / (1000 * 60 * 60 * 24)
  // 0 → 0;1 年内线性升到 1;之后封顶 1
  return Math.min(1, Math.max(0, days / 365))
}

function _bucket(trust) {
  if (trust >= 0.85) return 5
  if (trust >= 0.70) return 4
  if (trust >= 0.55) return 3
  if (trust >= 0.40) return 2
  return 1
}

export function score(chunks, options = {}) {
  // mode 暂未参与权重计算(Phase 4.1 预留 verify/summarize 不同权重表),
  // 这里只解构 query/queries/weights;mode 通过 options 透传给上层 promptBuilder
  const { query = '', queries = [], weights = {} } = options
  const w = { ...DEFAULTS, ...weights }

  const queryTextAll = [query, ...queries.map(q => q?.text || '')].join(' ')
  const totalQueries = Math.max(1, queries.length || 1)

  const out = chunks.map(c => {
    const baseScore = _norm01(c.rerank_score ?? c.score)
    const titleHit = _titleHit(c, queryTextAll)
    const sectionHit = _sectionHit(c, queryTextAll)
    const queryRecall = _ngramRecall(queryTextAll.slice(0, 1000), c.text || '')
    const sourceQuality = _norm01(c.metadata?.confidence ?? c.metadata?.source_quality ?? 0.5)
    const crossBatch = Math.min(1, ((c.from_query_tags?.length || 1) - 1) / Math.max(1, totalQueries - 1))
    const staleness = _stalenessDays(c.metadata)

    const trust = (
      w.w1 * baseScore +
      w.w2 * titleHit +
      w.w3 * sectionHit +
      w.w4 * queryRecall +
      w.w5 * sourceQuality +
      w.w6 * crossBatch -
      w.p1 * staleness
    )
    const trustClamped = Math.max(0, Math.min(1, trust))

    return {
      ...c,
      trust: trustClamped,
      stars: _bucket(trustClamped),
      _signals: { baseScore, titleHit, sectionHit, queryRecall, sourceQuality, crossBatch, staleness }
    }
  })

  out.sort((a, b) => (b.trust - a.trust) || ((b.rerank_score || 0) - (a.rerank_score || 0)))
  return out
}

function _titleHit(c, queryText) {
  const title = String(c.file_name || c.metadata?.title || '').toLowerCase()
  if (!title) return 0
  const tokens = queryText.toLowerCase().split(/[\s,，。;；:：()（）[\]"“”]/).filter(t => t.length >= 2)
  if (tokens.length === 0) return 0
  let hit = 0
  for (const tok of tokens) if (title.includes(tok)) hit++
  return Math.min(1, hit / tokens.length)
}

function _sectionHit(c, queryText) {
  const path = c.metadata?.section_path
  const sec = Array.isArray(path) ? path.join(' / ') : String(path || c.metadata?.section || '')
  if (!sec) return 0
  return _ngramRecall(queryText.slice(0, 500), sec)
}

export default { score }
