/**
 * kbCatalogCache — TTL LRU 缓存(知识库列表/树)
 *
 * v1 内存级即可;后续可选接入 ETag/If-None-Match 减少带宽。
 */

const _store = new Map()  // key → { value, expireAt }
const MAX_ENTRIES = 64

function _evict() {
  if (_store.size <= MAX_ENTRIES) return
  const firstKey = _store.keys().next().value
  if (firstKey !== undefined) _store.delete(firstKey)
}

export function get(key) {
  const hit = _store.get(key)
  if (!hit) return null
  if (hit.expireAt < Date.now()) {
    _store.delete(key)
    return null
  }
  // touch for LRU
  _store.delete(key)
  _store.set(key, hit)
  return hit.value
}

export function set(key, value, ttlMs = 60_000) {
  _store.delete(key)
  _store.set(key, { value, expireAt: Date.now() + ttlMs })
  _evict()
}

export function invalidate(prefix) {
  if (!prefix) {
    _store.clear()
    return
  }
  for (const k of [..._store.keys()]) {
    if (k.startsWith(prefix)) _store.delete(k)
  }
}

export function size() {
  return _store.size
}
