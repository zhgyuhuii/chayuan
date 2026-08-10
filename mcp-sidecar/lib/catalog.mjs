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
 * Offline L1 search over domain id/label (not full 4500 names).
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
  const hit = all.filter(d =>
    d.id.toLowerCase().includes(q) ||
    String(d.label || '').toLowerCase().includes(q)
  )
  return {
    mode: 'offline-domains',
    query: q,
    total: hit.length,
    items: hit.slice(0, limit).map(d => ({
      kind: 'domain',
      id: d.id,
      label: d.label,
      count: d.count
    }))
  }
}
