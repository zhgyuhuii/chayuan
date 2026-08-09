/**
 * In-page MCP server registry (Streamable HTTP only).
 * Built-in chayuan sidecar + user-added HTTP MCP servers.
 */
import { MCP_URL, MCP_BASE_URL, MCP_HEALTHZ_URL } from './config.js'

export const MCP_SERVERS_STORAGE_KEY = 'chayuan_ai_mcp_servers'
export const MCP_ENABLED_STORAGE_KEY = 'chayuan_ai_mcp_enabled'
export const CHAYUAN_SERVER_ID = 'chayuan'
export const MCP_TOOL_NS_SEP = '__'

export function getBuiltinChayuanServer() {
  return {
    id: CHAYUAN_SERVER_ID,
    name: '察元 WPS',
    url: MCP_URL,
    healthzUrl: MCP_HEALTHZ_URL,
    baseUrl: MCP_BASE_URL,
    headers: {},
    enabled: true,
    builtin: true
  }
}

function pluginStorageGet(key) {
  try {
    const app = typeof window !== 'undefined' ? window.Application : null
    if (!app?.PluginStorage?.getItem) return null
    return app.PluginStorage.getItem(key)
  } catch {
    return null
  }
}

function pluginStorageSet(key, value) {
  try {
    const app = typeof window !== 'undefined' ? window.Application : null
    if (!app?.PluginStorage?.setItem) return false
    app.PluginStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function normalizeSlug(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
  return s || `mcp_${Date.now().toString(36)}`
}

function normalizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(headers)) {
    const key = String(k || '').trim()
    if (!key) continue
    out[key] = String(v ?? '')
  }
  return out
}

export function isValidHttpMcpUrl(url) {
  try {
    const u = new URL(String(url || '').trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (!u.hostname) return false
    return true
  } catch {
    return false
  }
}

/**
 * @returns {Array<{ id: string, name: string, url: string, headers: Record<string,string>, enabled: boolean, builtin?: boolean }>}
 */
export function loadMcpServers() {
  const builtin = getBuiltinChayuanServer()
  let extras = []
  try {
    const raw = pluginStorageGet(MCP_SERVERS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) extras = parsed
    }
  } catch { /* ignore */ }

  const seen = new Set([CHAYUAN_SERVER_ID])
  const list = [builtin]
  for (const item of extras) {
    if (!item || typeof item !== 'object') continue
    const id = normalizeSlug(item.id || item.name)
    if (!id || seen.has(id) || id === CHAYUAN_SERVER_ID) continue
    if (!isValidHttpMcpUrl(item.url)) continue
    seen.add(id)
    list.push({
      id,
      name: String(item.name || id).trim() || id,
      url: String(item.url).trim().replace(/\/+$/, ''),
      headers: normalizeHeaders(item.headers),
      enabled: item.enabled !== false,
      builtin: false
    })
  }
  return list
}

/** Persist user servers only (builtin is always derived). */
export function saveMcpServers(servers) {
  const extras = (Array.isArray(servers) ? servers : [])
    .filter(s => s && !s.builtin && s.id !== CHAYUAN_SERVER_ID)
    .map(s => ({
      id: normalizeSlug(s.id),
      name: String(s.name || s.id).trim(),
      url: String(s.url || '').trim().replace(/\/+$/, ''),
      headers: normalizeHeaders(s.headers),
      enabled: s.enabled !== false
    }))
    .filter(s => s.id && isValidHttpMcpUrl(s.url))
  pluginStorageSet(MCP_SERVERS_STORAGE_KEY, JSON.stringify(extras))
  return loadMcpServersWithBuiltinFlag()
}

function allocateUniqueServerId(preferred, excludeId = '') {
  const existing = new Set(
    loadMcpServers()
      .map(s => s.id)
      .filter(id => id && id !== excludeId)
  )
  existing.add(CHAYUAN_SERVER_ID)
  let base = normalizeSlug(preferred || 'mcp')
  if (!base || base === CHAYUAN_SERVER_ID) base = `mcp_${Date.now().toString(36)}`
  if (!existing.has(base)) return base
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}_${i}`
    if (!existing.has(candidate)) return candidate
  }
  return `${base}_${Date.now().toString(36)}`
}

/**
 * Create or update a user MCP server.
 * If `id` is empty on create, generate from name (unique). Existing id is kept on update.
 */
export function upsertMcpServer(input) {
  const name = String(input?.name || '').trim()
  const rawId = String(input?.id || '').trim()
  const extras = loadMcpServers().filter(s => !s.builtin)
  const updating = rawId ? extras.find(s => s.id === normalizeSlug(rawId)) : null
  const id = updating
    ? updating.id
    : allocateUniqueServerId(rawId || name || 'mcp')
  if (!id || id === CHAYUAN_SERVER_ID) {
    throw new Error('不能覆盖内置察元 MCP 服务器')
  }
  if (!isValidHttpMcpUrl(input?.url)) {
    throw new Error('仅支持 http(s) Streamable HTTP URL')
  }
  if (!name && !updating) {
    throw new Error('请填写服务名称')
  }
  const next = {
    id,
    name: name || updating?.name || id,
    url: String(input.url).trim().replace(/\/+$/, ''),
    headers: normalizeHeaders(input.headers),
    enabled: input.enabled !== false,
    builtin: false
  }
  const rest = extras.filter(s => s.id !== id)
  rest.push(next)
  return saveMcpServers(rest)
}

export function removeMcpServer(id) {
  const sid = normalizeSlug(id)
  if (sid === CHAYUAN_SERVER_ID) throw new Error('不能删除内置察元 MCP')
  const extras = loadMcpServers().filter(s => !s.builtin && s.id !== sid)
  return saveMcpServers(extras)
}

export function setMcpServerEnabled(id, enabled) {
  const sid = normalizeSlug(id)
  if (sid === CHAYUAN_SERVER_ID) {
    pluginStorageSet(`${MCP_SERVERS_STORAGE_KEY}:chayuan_enabled`, enabled === false ? '0' : '1')
    return loadMcpServersWithBuiltinFlag()
  }
  const extras = loadMcpServers().filter(s => !s.builtin).map(s => (
    s.id === sid ? { ...s, enabled: enabled !== false } : s
  ))
  return saveMcpServers(extras)
}

export function loadMcpServersWithBuiltinFlag() {
  const list = loadMcpServers()
  const flag = pluginStorageGet(`${MCP_SERVERS_STORAGE_KEY}:chayuan_enabled`)
  if (flag === '0') {
    const builtin = list.find(s => s.id === CHAYUAN_SERVER_ID)
    if (builtin) builtin.enabled = false
  }
  return list
}

export function loadMcpEnabled() {
  const raw = pluginStorageGet(MCP_ENABLED_STORAGE_KEY)
  if (raw == null || raw === '') return true
  return raw !== '0' && raw !== 'false' && raw !== 'False'
}

export function saveMcpEnabled(enabled) {
  pluginStorageSet(MCP_ENABLED_STORAGE_KEY, enabled ? '1' : '0')
  return !!enabled
}

export function namespaceToolName(serverId, toolName) {
  return `${normalizeSlug(serverId)}${MCP_TOOL_NS_SEP}${String(toolName || '').trim()}`
}

export function parseNamespacedTool(namespaced) {
  const raw = String(namespaced || '')
  const idx = raw.indexOf(MCP_TOOL_NS_SEP)
  if (idx <= 0) return { serverId: CHAYUAN_SERVER_ID, toolName: raw }
  return {
    serverId: raw.slice(0, idx),
    toolName: raw.slice(idx + MCP_TOOL_NS_SEP.length)
  }
}

/** Chayuan tools allowed in in-page orchestrator (no declassify*). */
export function isChayuanToolAllowed(toolName) {
  const n = String(toolName || '')
  if (!n || n.startsWith('declassify')) return false
  if (n.startsWith('wps_')) return true
  if (n.startsWith('document_')) return true
  if (n.startsWith('proofread_')) return true
  if (n === 'kb_retrieve') return true
  if (n.startsWith('assistants_')) return true
  return false
}

export function getEnabledMcpServers() {
  return loadMcpServersWithBuiltinFlag().filter(s => s.enabled !== false)
}

/** Snapshot for sidecar allowlist (id + url + headers). */
export function getUpstreamAllowlistPayload() {
  return getEnabledMcpServers()
    .filter(s => s.id !== CHAYUAN_SERVER_ID)
    .map(s => ({
      id: s.id,
      name: s.name,
      url: s.url,
      headers: s.headers || {}
    }))
}
