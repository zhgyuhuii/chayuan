// 静态 JSON import：编译为单文件二进制（esbuild bundle → pkg）时不再依赖脚本旁的
// 文件路径（无 import.meta.url / __dirname）。Node 22+ 原生支持 import attributes；
// esbuild 会把 JSON 内联进 bundle；pkg 拿到的是已内联产物。开发态 node server.mjs
// 同样可用（JSON 文件在磁盘上）。
import domainIndexRaw from '../data/domain-index.json' with { type: 'json' }

const FALLBACK = { domainCount: 0, assistantTotal: 0, domains: [] }

export function loadDomainIndex() {
  const idx = (domainIndexRaw && typeof domainIndexRaw === 'object') ? domainIndexRaw : FALLBACK
  return idx
}

export function listDomains() {
  const idx = loadDomainIndex()
  return {
    domainCount: idx.domainCount,
    assistantTotal: idx.assistantTotal,
    domains: idx.domains || []
  }
}

/**
 * Offline L1 search over domain id/label + per-domain assistant keywords.
 * 2026-09-09：索引带 keywords（4526 个助手中文 label/key，gen-mcp-domain-index
 * 生成）。此前只有域壳（"餐饮/食品"），agent 离线时模型搜功能词（"改写/摘要"）
 * 永远空结果而放弃助手链路；现在关键词命中会直接给出域 + 命中词，模型可以
 * 用 domain 参数二次搜索取具体助手。
 */
export function searchDomainsOffline(query = '', { limit = 20 } = {}) {
  const q = String(query || '').trim().toLowerCase()
  const all = listDomains().domains
  if (!q) {
    return {
      mode: 'offline-domains',
      query: q,
      total: all.length,
      items: all.slice(0, limit).map(d => ({
        kind: 'domain',
        id: d.id,
        label: d.label,
        count: d.count
      }))
    }
  }
  const hits = []
  for (const d of all) {
    const idLabel = `${d.id} ${String(d.label || '')}`.toLowerCase()
    const kwHits = (d.keywords || []).filter(k => String(k || '').toLowerCase().includes(q))
    if (idLabel.includes(q) || kwHits.length) {
      hits.push({
        kind: 'domain',
        id: d.id,
        label: d.label,
        count: d.count,
        ...(kwHits.length ? { matchedAssistants: kwHits.slice(0, 8) } : {})
      })
    }
  }
  // 关键词命中的域排前（比仅域名子串命中更相关）
  hits.sort((a, b) => (b.matchedAssistants?.length || 0) - (a.matchedAssistants?.length || 0))
  return {
    mode: 'offline-domains',
    query: q,
    total: hits.length,
    hint: hits.length
      ? '命中领域及其部分助手名。用 assistants_search(domain=领域id) 或 assistants_get 获取具体助手配方。'
      : '',
    items: hits.slice(0, limit)
  }
}
