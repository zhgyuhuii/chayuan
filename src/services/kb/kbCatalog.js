/**
 * kbCatalog — 远程知识库列表与树形结构
 *
 * 接口:
 *   - fetchList(connection, { signal, force }) → 平铺列表
 *   - fetchTree(connection, { signal, force }) → 按 universe 分组的树
 *
 * 数据归一:
 *   服务端 list_knowledge_bases 返回的可能是 string[] 或 KnowledgeBaseSchema[];
 *   两种形态都归一为:
 *   {
 *     id,            // = kb_name
 *     name,          // = kb_info?.title || kb_name
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

function _normalizeKb(raw) {
  if (typeof raw === 'string') {
    return {
      id: raw, name: raw, vectorStore: '', fileCount: 0,
      visibility: 'unknown', ownerId: null, role: null, grantSource: null,
      grantExpiresAt: null, raw
    }
  }
  // role 来源(plan §4.3.4 get_kb_role_for_subject):
  //   服务端在响应里 inline 'role' / 'grant_source' / 'grant_expires_at'
  //   字段名向后兼容:role | acl_role | my_role
  const role = raw.role || raw.acl_role || raw.my_role || null
  // grant_source: 'owner' | 'admin' | 'public' | 'grant'
  const grantSource = raw.grant_source || (role === 'owner' ? 'owner' : (role === 'admin' ? 'admin' : null))
  return {
    id: raw.kb_name || raw.id || '',
    name: raw.kb_info?.title || raw.kb_name || raw.id || '',
    vectorStore: raw.vs_type || raw.vector_store_type || '',
    fileCount: Number(raw.file_count || raw.kb_info?.file_count || 0),
    visibility: raw.visibility || 'private',
    ownerId: raw.owner_id || null,
    universe: raw.universe || null,
    role,                                       // 'owner' | 'editor' | 'reader' | 'admin'
    grantSource,                                // owner / admin / public / grant
    grantExpiresAt: raw.grant_expires_at || null,
    raw
  }
}

export async function fetchList(connection, options = {}) {
  if (!connection) throw new Error('connection is required')
  const cacheKey = `list:${connection.id}`
  if (!options.force) {
    const hit = cache.get(cacheKey)
    if (hit) return hit
  }
  const auth = createAuthClient(connection)
  const path = _resolvePath(connection, '/knowledge_base/list_knowledge_bases')
  if (!path) throw new Error('list_knowledge_bases not available in current auth mode')
  const resp = await auth.fetch(path, {
    method: 'GET',
    signal: options.signal
  })
  if (!resp.ok) {
    throw new Error(`list_knowledge_bases HTTP ${resp.status}`)
  }
  const data = await resp.json()
  const list = Array.isArray(data?.data) ? data.data.map(_normalizeKb) : []
  cache.set(cacheKey, list, 5 * 60_000)
  return list
}

export async function fetchTree(connection, options = {}) {
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

function _buildFlatTree(list) {
  return [{
    id: '__all__',
    name: '全部知识库',
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
