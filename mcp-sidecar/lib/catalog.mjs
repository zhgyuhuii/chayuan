import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INDEX_PATH = path.join(__dirname, '..', 'data', 'domain-index.json')

let cached = null

export function loadDomainIndex() {
  if (cached) return cached
  try {
    cached = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'))
  } catch {
    cached = { domainCount: 0, assistantTotal: 0, domains: [] }
  }
  return cached
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
