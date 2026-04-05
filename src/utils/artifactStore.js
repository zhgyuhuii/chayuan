import { normalizeArtifactList } from './artifactTypes.js'

const STORAGE_KEY = 'assistantArtifactStore'
const ARCHIVE_LIMIT = 300

function getApplication() {
  return window.Application || window.opener?.Application || window.parent?.Application || null
}

function safeParse(raw, fallback = null) {
  if (!raw) return fallback
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch (_) {
    return fallback
  }
}

function getStorageBucket() {
  const app = getApplication()
  const localRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : ''
  const pluginRaw = app?.PluginStorage?.getItem(STORAGE_KEY)
  return safeParse(localRaw || pluginRaw, { records: [], ownerIndex: {} }) || { records: [], ownerIndex: {} }
}

function persistStorageBucket(bucket) {
  const serialized = JSON.stringify(bucket || { records: [], ownerIndex: {} })
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, serialized)
  }
  try {
    getApplication()?.PluginStorage?.setItem(STORAGE_KEY, serialized)
  } catch (_) {}
  return true
}

function buildOwnerKey(ownerType = '', ownerId = '') {
  const type = String(ownerType || '').trim()
  const id = String(ownerId || '').trim()
  if (!type || !id) return ''
  return `${type}:${id}`
}

function rebuildOwnerIndex(records = []) {
  const next = {}
  normalizeArtifactList(records).forEach((item) => {
    const ownerKey = buildOwnerKey(item.ownerType, item.ownerId)
    if (!ownerKey) return
    if (!Array.isArray(next[ownerKey])) {
      next[ownerKey] = []
    }
    if (!next[ownerKey].includes(item.id)) {
      next[ownerKey].push(item.id)
    }
  })
  return next
}

function sortArtifactsByUpdatedAt(records = []) {
  return normalizeArtifactList(records).sort((a, b) => {
    const left = String(b?.updatedAt || b?.createdAt || '')
    const right = String(a?.updatedAt || a?.createdAt || '')
    return left.localeCompare(right)
  })
}

export function loadArtifactStore() {
  const bucket = getStorageBucket()
  return {
    records: normalizeArtifactList(bucket?.records || []),
    ownerIndex: bucket?.ownerIndex && typeof bucket.ownerIndex === 'object' ? { ...bucket.ownerIndex } : {}
  }
}

export function saveArtifactStore(store = {}) {
  const normalizedRecords = sortArtifactsByUpdatedAt(store?.records || []).slice(0, ARCHIVE_LIMIT)
  const normalized = {
    records: normalizedRecords,
    ownerIndex: rebuildOwnerIndex(normalizedRecords)
  }
  return persistStorageBucket(normalized)
}

export function upsertArtifacts(artifacts = [], options = {}) {
  const store = loadArtifactStore()
  const incoming = normalizeArtifactList(artifacts, options)
  const recordMap = new Map(store.records.map(item => [item.id, item]))
  incoming.forEach((item) => {
    recordMap.set(item.id, {
      ...recordMap.get(item.id),
      ...item,
      updatedAt: new Date().toISOString()
    })
  })
  store.records = sortArtifactsByUpdatedAt(Array.from(recordMap.values())).slice(0, ARCHIVE_LIMIT)
  store.ownerIndex = rebuildOwnerIndex(store.records)
  saveArtifactStore(store)
  return incoming
}

export function bindArtifactsToOwner(ownerType, ownerId, artifacts = []) {
  return upsertArtifacts(artifacts, { ownerType, ownerId })
}

export function getArtifactsByOwner(ownerType, ownerId) {
  const store = loadArtifactStore()
  const ownerKey = buildOwnerKey(ownerType, ownerId)
  const ids = ownerKey ? (store.ownerIndex[ownerKey] || []) : []
  const recordMap = new Map(store.records.map(item => [item.id, item]))
  return ids.map(id => recordMap.get(id)).filter(Boolean)
}

export function getArtifactById(id) {
  const normalized = String(id || '').trim()
  if (!normalized) return null
  return loadArtifactStore().records.find(item => item.id === normalized) || null
}

export function getArtifactLineage(id) {
  const normalized = String(id || '').trim()
  if (!normalized) return []
  const store = loadArtifactStore()
  const recordMap = new Map(store.records.map(item => [item.id, item]))
  const lineage = []
  const visited = new Set()
  const queue = [normalized]
  while (queue.length) {
    const currentId = queue.shift()
    if (!currentId || visited.has(currentId)) continue
    visited.add(currentId)
    const current = recordMap.get(currentId)
    if (!current) continue
    lineage.push(current)
    const parents = Array.isArray(current.parentArtifactIds) ? current.parentArtifactIds : []
    parents.forEach(parentId => {
      if (parentId && !visited.has(parentId)) {
        queue.push(parentId)
      }
    })
  }
  return lineage
}
