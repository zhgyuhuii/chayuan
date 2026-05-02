/**
 * connectionStore — 知识库连接的多连接 CRUD + 当前选中 + 监听器
 *
 * 数据形态(对齐 plan-knowledge-base-integration.md §3.2.1):
 *   {
 *     version: 1,
 *     current: 'conn-uuid-xxx',
 *     list: [{ id, name, baseUrl, authMode: 'jwt'|'hmac',
 *              jwt:  { username, ciphertext_password, accessToken?, refreshToken?, expAt? },
 *              hmac: { appId, ciphertext_appSecret },
 *              healthSnapshot, createdAt, updatedAt }]
 *   }
 *
 * 落地点:globalSettings 的 'kbConnections' namespace。
 *
 * v1 范围:接口完整,实现写"内存 + globalSettings"即可,凭据加解密走 connectionCipher。
 */

import { loadGlobalSettings, saveGlobalSettings } from '../../utils/globalSettings.js'

const NAMESPACE = 'kbConnections'
const SCHEMA_VERSION = 1

const listeners = new Set()

function _read() {
  const all = loadGlobalSettings() || {}
  const raw = all[NAMESPACE]
  if (!raw || raw.version !== SCHEMA_VERSION) {
    return { version: SCHEMA_VERSION, current: null, list: [] }
  }
  return raw
}

function _write(state) {
  const all = loadGlobalSettings() || {}
  all[NAMESPACE] = state
  saveGlobalSettings(all)
  for (const fn of listeners) {
    try { fn(state) } catch (e) { /* ignore listener errors */ }
  }
}

export function listConnections() {
  return _read().list.map(c => ({ ...c }))
}

export function getConnection(id) {
  return _read().list.find(c => c.id === id) || null
}

export function getCurrentConnection() {
  const s = _read()
  if (!s.current) return null
  return s.list.find(c => c.id === s.current) || null
}

export function setCurrentConnection(id) {
  const s = _read()
  if (id && !s.list.find(c => c.id === id)) {
    throw new Error(`unknown connection id: ${id}`)
  }
  _write({ ...s, current: id || null })
}

export function upsertConnection(conn) {
  if (!conn || !conn.id) throw new Error('connection.id is required')
  const s = _read()
  const idx = s.list.findIndex(c => c.id === conn.id)
  const now = new Date().toISOString()
  const next = {
    ...conn,
    updatedAt: now,
    createdAt: idx >= 0 ? s.list[idx].createdAt : now
  }
  if (idx >= 0) s.list[idx] = next
  else s.list.push(next)
  if (!s.current) s.current = next.id
  _write(s)
  return next
}

export function removeConnection(id) {
  const s = _read()
  const next = s.list.filter(c => c.id !== id)
  const current = s.current === id ? (next[0]?.id || null) : s.current
  _write({ ...s, list: next, current })
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function _resetForTest() {
  _write({ version: SCHEMA_VERSION, current: null, list: [] })
}
