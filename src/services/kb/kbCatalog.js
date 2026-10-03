/**
 * kbCatalog — 远程知识库列表与树形结构
 *
 * 接口:
 *   - fetchList(connection, { signal, force }) → 平铺列表
 *   - fetchTree(connection, { signal, force }) → 按 universe 分组的树
 *
 * 数据归一:
 *   服务端可能返回 Knowledge Universe(KuItem)、KnowledgeBaseSchema 或 string[];
 *   两种形态都归一为:
 *   {
 *     id,            // = ku_id || kb_name
 *     name,          // = display_name || kb_info?.title || kb_name
 *     vectorStore,
 *     fileCount,
 *     visibility,
 *     ownerId,
 *     universe?: { id, name }
 *   }
 *
 * 缓存策略:走 kbCatalogCache(TTL 5min);force=true 跳过缓存。
 */

import { createAuthClient } from './authClient.js'
import * as cache from './kbCatalogCache.js'
import { resolve as _resolvePath } from './pathRouter.js'
import { isChatop, apiUrl } from './kbDiscovery.js'

function _normalizeKb(raw) {
  if (typeof raw === 'string') {
    return {
      id: raw, name: raw, vectorStore: '', fileCount: 0,
      visibility: 'unknown', ownerId: null, role: null, grantSource: null,
      grantExpiresAt: null, raw
    }
  }
  const id = raw.ku_id || raw.kb_name || raw.id || ''
  const name = raw.display_name
    || raw.kb_info?.title
    || (typeof raw.kb_info === 'string' && raw.kb_info ? raw.kb_info : '')
    || raw.name
    || raw.kb_name
    || raw.id
    || raw.ku_id
    || ''
  const count = raw.count ?? raw.file_count ?? raw.kb_info?.file_count ?? 0
  // role 来源(plan §4.3.4 get_kb_role_for_subject):
  //   服务端在响应里 inline 'role' / 'grant_source' / 'grant_expires_at'
  //   字段名向后兼容:role | acl_role | my_role
  const role = raw.role || raw.access_role || raw.acl_role || raw.my_role || null
  // grant_source: 'owner' | 'admin' | 'public' | 'grant'
  const grantSource = raw.grant_source || (role === 'owner' ? 'owner' : (role === 'admin' ? 'admin' : null))
  return {
    id,
    name,
    vectorStore: raw.vs_type || raw.vector_store_type || raw.kind || '',
    fileCount: Number(count || 0),
    visibility: raw.visibility || 'private',
    ownerId: raw.owner_id || null,
    kind: raw.kind || raw.vs_type || '',
    kuId: raw.ku_id || id,
    universe: raw.universe || null,
    role,                                       // 'owner' | 'editor' | 'reader' | 'admin'
    grantSource,                                // owner / admin / public / grant
    grantExpiresAt: raw.grant_expires_at || null,
    raw
  }
}

/**
 * chatop(察元 Harness 本机)分支:GET /kbs 返回
 * { ok, kbs: [{ kbId, docs, ready, pending, vecBackend }] }。
 * 归一成通用 KB item:kbId 即 id/kuId(绑定时由 _normalizeKuId 统一补 doc: 前缀,
 * 检索分支再剥掉),本机回环信任 → role 恒为 owner。
 */
async function _fetchChatopList(connection, options = {}) {
  const cacheKey = `list:${connection.id}`
  if (!options.force) {
    const hit = cache.get(cacheKey)
    if (hit) return hit
  }
  const auth = createAuthClient(connection)
  const resp = await auth.fetch(apiUrl(connection, '/kbs'), {
    method: 'GET',
    signal: options.signal,
    timeoutMs: options.timeoutMs || 10_000
  })
  if (!resp.ok) throw new Error(`/kbs HTTP ${resp.status}`)
  const data = await resp.json().catch(() => ({}))
  const list = (Array.isArray(data?.kbs) ? data.kbs : []).map(k => ({
    id: k.kbId,
    name: k.kbId,
    vectorStore: k.vecBackend || '',
    fileCount: Number(k.docs || 0),
    readyCount: Number(k.ready || 0),
    pendingCount: Number(k.pending || 0),
    visibility: 'private',
    ownerId: null,
    kind: k.vecBackend || '',
    kuId: k.kbId,
    universe: null,
    role: 'owner',
    grantSource: 'owner',
    grantExpiresAt: null,
    serviceType: 'chatop',
    raw: k
  }))
  cache.set(cacheKey, list, 30_000)
  return list
}

export async function fetchList(connection, options = {}) {
  if (!connection) throw new Error('connection is required')
  if (isChatop(connection)) return _fetchChatopList(connection, options)
  const cacheKey = `list:${connection.id}`
  if (!options.force) {
    const hit = cache.get(cacheKey)
    if (hit) return hit
  }
  const auth = createAuthClient(connection)
  let resp = null
  let source = ''

  // JWT 用户登录场景优先使用与 chayuan-client 一致的智库全集接口。
  const universePath = _resolvePath(connection, '/knowledge_universe/list')
  if (universePath) {
    const sep = universePath.includes('?') ? '&' : '?'
    resp = await auth.fetch(`${universePath}${sep}include_vector=true`, {
      method: 'GET',
      signal: options.signal
    })
    source = 'knowledge_universe/list'
  }

  // HMAC App 接入或老服务端降级到兼容 KB 列表。
  if (!resp || !resp.ok) {
    const path = _resolvePath(connection, '/knowledge_base/list_knowledge_bases')
    if (!path) throw new Error('list_knowledge_bases not available in current auth mode')
    resp = await auth.fetch(path, {
      method: 'GET',
      signal: options.signal
    })
    source = 'list_knowledge_bases'
  }

  if (!resp.ok) {
    throw new Error(`${source} HTTP ${resp.status}`)
  }
  const data = await resp.json()
  const list = Array.isArray(data?.data) ? data.data.map(_normalizeKb) : []
  cache.set(cacheKey, list, 5 * 60_000)
  return list
}

export async function fetchTree(connection, options = {}) {
  // chatop 本机库没有 universe 分层:单组平铺,组名标明来源
  if (isChatop(connection)) {
    const cacheKey = `tree:${connection.id}`
    if (!options.force) {
      const hit = cache.get(cacheKey)
      if (hit) return hit
    }
    const flat = await fetchList(connection, options)
    const tree = _buildFlatTree(flat, '察元 Harness(本机)')
    cache.set(cacheKey, tree, 30_000)
    return tree
  }

  // 优先尝试 universe 接口;失败回退到 list 单层
  const cacheKey = `tree:${connection.id}`
  if (!options.force) {
    const hit = cache.get(cacheKey)
    if (hit) return hit
  }

  // /knowledge_universe/tree 仅 JWT 通道开放;HMAC 模式直接退到 flat
  let universeTree = null
  try {
    const auth = createAuthClient(connection)
    const path = _resolvePath(connection, '/knowledge_universe/tree')
    if (path) {
      const resp = await auth.fetch(path, { method: 'GET', signal: options.signal })
      if (resp.ok) {
        const data = await resp.json()
        universeTree = data?.data || null
      }
    }
  } catch (e) {
    // ignore — fall back to flat
  }

  const flat = await fetchList(connection, options)
  const tree = universeTree
    ? _buildTreeFromUniverse(universeTree, flat)
    : _buildFlatTree(flat)
  cache.set(cacheKey, tree, 5 * 60_000)
  return tree
}

function _buildFlatTree(list, groupName = '全部知识库') {
  return [{
    id: '__all__',
    name: groupName,
    type: 'group',
    children: list.map(kb => ({
      id: kb.id, name: kb.name, type: 'kb', kb,
      role: kb.role, grantSource: kb.grantSource
    }))
  }]
}

function _buildTreeFromUniverse(universeTree, flat) {
  const byId = new Map(flat.map(kb => [kb.id, kb]))
  const used = new Set()
  function walk(node) {
    const out = { id: node.id, name: node.name, type: 'group', children: [] }
    for (const childKbName of (node.kb_names || [])) {
      const kb = byId.get(childKbName)
      if (kb) {
        out.children.push({
          id: kb.id, name: kb.name, type: 'kb', kb,
          role: kb.role, grantSource: kb.grantSource
        })
        used.add(kb.id)
      }
    }
    for (const child of (node.children || [])) {
      out.children.push(walk(child))
    }
    return out
  }
  const tree = (Array.isArray(universeTree) ? universeTree : [universeTree]).map(walk)
  // 把 universe 没覆盖的 KB 放到"未分组"
  const orphans = flat.filter(kb => !used.has(kb.id))
  if (orphans.length) {
    tree.push({
      id: '__orphans__',
      name: '未分组',
      type: 'group',
      children: orphans.map(kb => ({
        id: kb.id, name: kb.name, type: 'kb', kb,
        role: kb.role, grantSource: kb.grantSource
      }))
    })
  }
  return tree
}

export default { fetchList, fetchTree }
