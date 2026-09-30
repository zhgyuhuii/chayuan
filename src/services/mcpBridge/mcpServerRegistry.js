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
    name: '察元AI',
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

// 页内智能体不能改变宿主窗口或活动文档，否则可能销毁承载对话的 WebView。
const DOCUMENT_LIFECYCLE_TOOLS = new Set([
  'document_new',
  'document_open',
  'document_ensure_open',
  'document_activate',
  'wps_launch'
])

// 各宿主在页内智能体可见的聚合域工具：本宿主工具 + 宿主无关工具。
// 其它宿主的工具必须屏蔽——它们的调用会被 sidecar 路由到对应宿主的 webview，
// 页内智能体在 ET 宿主里调 document.replace 会去改文字宿主里的另一篇文档。
const HOST_DOMAIN_TOOLS = {
  wps: new Set([
    'comment', 'revision', 'layout', 'nav', 'toc', 'bookmark', 'table', 'caption',
    'field', 'image', 'hyperlink', 'headerfooter', 'watermark', 'style', 'export'
  ]),
  et: new Set(['spreadsheet']),
  wpp: new Set(['presentation'])
}

// 宿主无关、任何宿主的页内智能体都可用
const HOST_AGNOSTIC_TOOLS = new Set(['wps_status', 'kb_retrieve', 'assistants_list_domains', 'assistants_search', 'assistants_get'])

/**
 * 页内工具白名单（按当前宿主过滤）。
 * @param {string} toolName
 * @param {string} [host] 'wps'|'et'|'wpp'，缺省按 wps（旧调用方语义不变）
 */
export function isChayuanToolAllowed(toolName, host = 'wps') {
  const n = String(toolName || '')
  if (!n) return false
  if (n.startsWith('declassify')) return false
  if (DOCUMENT_LIFECYCLE_TOOLS.has(n)) return false
  if (HOST_AGNOSTIC_TOOLS.has(n)) return true
  // proofread 系列为 Writer 专用（内部走文档分块/批注）
  if (n.startsWith('proofread')) return host === 'wps'
  if (n.startsWith('spreadsheet')) return host === 'et'
  if (n.startsWith('presentation')) return host === 'wpp'
  const domains = HOST_DOMAIN_TOOLS[host === 'et' || host === 'wpp' ? host : 'wps']
  return domains.has(n)
}

/**
 * 跨宿主回合的工具放行（追问 5 定案）：放开宿主边界——其他宿主的工具可用于
 * 读源（文档转 PPT 读 Writer、表格数据转战报页读 ET），写目标宿主由 skill 层
 * 的回合 pin 表自动校验活动对象身份（expectDocId），不依赖模型自觉。
 * 仍禁：declassify 全系、文档生命周期工具（新建/打开/激活/启动应用）——
 * 跨宿主读写不包含"换文件"。
 */
export function isToolAllowedCrossHost(toolName) {
  const n = String(toolName || '')
  if (!n) return false
  if (n.startsWith('declassify')) return false
  if (DOCUMENT_LIFECYCLE_TOOLS.has(n)) return false
  return true
}

/** chayuan 工具的目标宿主（回合 pin 表的键；宿主无关工具返回 null） */
export function chayuanToolTargetHost(toolName) {
  const n = String(toolName || '')
  if (n.startsWith('spreadsheet')) return 'et'
  if (n.startsWith('presentation')) return 'wpp'
  if (n === 'wps_status' || n.startsWith('assistants') || n.startsWith('kb_')) return null
  if (n.startsWith('wps_')) return null
  return 'wps'
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
