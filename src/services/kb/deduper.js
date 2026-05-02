/**
 * deduper — 跨批次 chunk 去重 + from_query_tags / from_section_ids 集合并集
 *
 * 服务端 /search_batch 已做 dedup_by=chunk_id;本模块作为客户端兜底,
 * 用于 v1 早期 + 旧版服务端循环 /search_docs 的回退路径。
 */

export function merge(chunks, queries) {
  if (!Array.isArray(chunks)) return []
  const byId = new Map()
  for (const c of chunks) {
    const id = c.chunk_id || `${c.kb_name}::${c.file_name}::${c.metadata?.chunk_index ?? c.text?.slice(0, 32)}`
    const prev = byId.get(id)
    if (!prev) {
      byId.set(id, {
        ...c,
        from_query_tags: _toSet(c.from_query_tags),
        from_section_ids: _toSet(c.from_section_ids)
      })
    } else {
      _addAll(prev.from_query_tags, c.from_query_tags || [])
      _addAll(prev.from_section_ids, c.from_section_ids || [])
      // 评分取较高
      if ((c.rerank_score || 0) > (prev.rerank_score || 0)) prev.rerank_score = c.rerank_score
      if ((c.score || 0) > (prev.score || 0)) prev.score = c.score
    }
  }
  return [...byId.values()].map(c => ({
    ...c,
    from_query_tags: [...c.from_query_tags],
    from_section_ids: [...c.from_section_ids]
  }))
}

function _toSet(maybe) {
  const s = new Set()
  if (Array.isArray(maybe)) for (const v of maybe) s.add(v)
  return s
}

function _addAll(set, arr) {
  for (const v of arr || []) set.add(v)
}

export default { merge }
