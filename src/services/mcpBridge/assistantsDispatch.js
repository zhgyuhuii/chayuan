/**
 * Agent-side assistants catalog for MCP (search / get / list domains).
 */
import {
  DOMAIN_MANIFEST,
  DOMAIN_ORDER,
  ASSISTANT_TOTAL,
  DOMAIN_COUNT
} from '../../utils/assistant/assistantDomainManifest.js'
import {
  ensureDomainLoaded,
  getBuiltinAssistants,
  getBuiltinAssistantDefinition
} from '../../utils/assistantRegistry.js'

function summarizeAssistant(a) {
  if (!a) return null
  return {
    id: a.id,
    key: a.key || a.id,
    label: a.shortLabel || a.label || a.id,
    description: String(a.description || '').slice(0, 240),
    group: a.group || '',
    domain: a.domain || a.group || ''
  }
}

export async function handleAssistantsListDomains() {
  const domains = (DOMAIN_ORDER || Object.keys(DOMAIN_MANIFEST)).map(id => ({
    id,
    label: DOMAIN_MANIFEST[id]?.label || id,
    count: Number(DOMAIN_MANIFEST[id]?.count || 0)
  }))
  return {
    domainCount: DOMAIN_COUNT || domains.length,
    assistantTotal: ASSISTANT_TOTAL,
    domains
  }
}

export async function handleAssistantsSearch(params = {}) {
  const query = String(params.query || params.q || '').trim()
  const domain = String(params.domain || '').trim()
  const limit = Math.min(Math.max(Number(params.limit) || 30, 1), 100)

  if (domain) {
    await ensureDomainLoaded(domain)
  }

  const all = getBuiltinAssistants()
  let pool = all
  if (domain) {
    pool = all.filter(a =>
      a.domain === domain ||
      a.group === domain ||
      String(a.group || '').includes(domain)
    )
  }

  if (!query) {
    return {
      mode: 'agent',
      query,
      domain: domain || null,
      total: pool.length,
      items: pool.slice(0, limit).map(summarizeAssistant)
    }
  }

  const q = query.toLowerCase()
  const hit = pool.filter(a => {
    const hay = [
      a.id,
      a.key,
      a.label,
      a.shortLabel,
      a.description,
      a.group,
      a.domain
    ].map(x => String(x || '').toLowerCase()).join('\n')
    return hay.includes(q)
  })

  return {
    mode: 'agent',
    query,
    domain: domain || null,
    total: hit.length,
    items: hit.slice(0, limit).map(summarizeAssistant)
  }
}

export async function handleAssistantsGet(params = {}) {
  const id = String(params.id || params.assistantId || '').trim()
  if (!id) {
    const err = new Error('id required')
    err.code = 'INVALID_PARAMS'
    throw err
  }

  let def = getBuiltinAssistantDefinition(id)
  if (!def && params.domain) {
    await ensureDomainLoaded(String(params.domain))
    def = getBuiltinAssistantDefinition(id)
  }
  if (!def) {
    // Lazy: load all domain packs once (shared promise). Heavy first call, then cached.
    const { ensureDomainPacksLoaded } = await import('../../utils/assistantRegistry.js')
    await ensureDomainPacksLoaded()
    def = getBuiltinAssistantDefinition(id)
  }

  if (!def) {
    const err = new Error(`Assistant not found: ${id}`)
    err.code = 'ASSISTANT_NOT_FOUND'
    throw err
  }

  // Export-oriented payload for external LLM
  return {
    id: def.id,
    key: def.key || def.id,
    label: def.shortLabel || def.label,
    description: def.description || '',
    group: def.group || '',
    systemPrompt: def.systemPrompt || def.system || '',
    userPromptTemplate: def.userPromptTemplate || def.userPrompt || def.prompt || '',
    modelType: def.modelType || 'chat',
    documentAction: def.documentAction || def.defaultAction || '',
    runtimeCapabilities: def.runtimeCapabilities || null,
    export: true
  }
}

export default {
  handleAssistantsListDomains,
  handleAssistantsSearch,
  handleAssistantsGet
}
