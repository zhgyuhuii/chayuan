import opfsStorage from '../../utils/host/opfsStorage.js'

const memoryStore = new Map()
const ROOT_PREFIX = 'document-intelligence'

function safeKey(value = '') {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'default'
}

function buildPath(namespace = 'cache', key = '') {
  return `${ROOT_PREFIX}__${safeKey(namespace)}__${safeKey(key)}.json`
}

export async function saveDocumentIntelligenceEntry(namespace, key, value = {}) {
  const path = buildPath(namespace, key)
  const payload = JSON.stringify({
    namespace: String(namespace || 'cache'),
    key: String(key || ''),
    savedAt: new Date().toISOString(),
    value
  })
  const result = await opfsStorage.writeFile(path, payload)
  if (!result?.ok) {
    memoryStore.set(path, payload)
    return { ok: true, backend: 'memory', path, size: payload.length }
  }
  return { ...result, path }
}

export async function loadDocumentIntelligenceEntry(namespace, key) {
  const path = buildPath(namespace, key)
  const raw = memoryStore.get(path) || await opfsStorage.readFile(path)
  if (!raw) return null
  try {
    return JSON.parse(raw).value ?? null
  } catch {
    return null
  }
}

export async function deleteDocumentIntelligenceEntry(namespace, key) {
  const path = buildPath(namespace, key)
  memoryStore.delete(path)
  const result = await opfsStorage.deleteFile(path)
  return result?.ok ? { ...result, path } : { ok: true, backend: 'memory', path }
}

export async function listDocumentIntelligenceEntries(namespace = '') {
  const prefix = namespace ? `${ROOT_PREFIX}__${safeKey(namespace)}__` : `${ROOT_PREFIX}__`
  const opfsFiles = await opfsStorage.listFiles().catch(() => [])
  const storedFiles = Array.isArray(opfsFiles) ? opfsFiles : []
  return Array.from(new Set([
    ...storedFiles,
    ...memoryStore.keys()
  ]))
    .filter(name => String(name).startsWith(prefix))
    .sort()
}

export async function getDocumentIntelligenceStorageEstimate() {
  return opfsStorage.getStorageEstimate()
}

export default {
  saveDocumentIntelligenceEntry,
  loadDocumentIntelligenceEntry,
  deleteDocumentIntelligenceEntry,
  listDocumentIntelligenceEntries,
  getDocumentIntelligenceStorageEstimate
}
