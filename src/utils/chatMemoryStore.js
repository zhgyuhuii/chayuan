const STORAGE_KEY = 'NdChatMemoryStore'
const ARCHIVE_LIMIT = 80

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

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function truncateText(text = '', maxLength = 280) {
  const normalized = normalizeString(text)
  if (!normalized) return ''
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
}

function getStorageBucket() {
  const app = getApplication()
  const localRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : ''
  const pluginRaw = app?.PluginStorage?.getItem(STORAGE_KEY)
  return safeParse(localRaw || pluginRaw, { records: [] }) || { records: [] }
}

function saveStorageBucket(bucket = {}) {
  const payload = JSON.stringify(bucket || { records: [] })
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, payload)
  }
  try {
    getApplication()?.PluginStorage?.setItem(STORAGE_KEY, payload)
  } catch (_) {}
  return true
}

export function createChatMemoryRecord(record = {}) {
  const now = new Date().toISOString()
  return {
    id: normalizeString(record.id, `chat_memory_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    chatId: normalizeString(record.chatId),
    scopeKey: normalizeString(record.scopeKey),
    memoryType: normalizeString(record.memoryType, 'summary'),
    title: normalizeString(record.title, '聊天记忆'),
    summary: truncateText(record.summary, 320),
    content: truncateText(record.content, 680),
    hitCount: Math.max(0, Number(record.hitCount || 0)),
    sourceMessageCount: Math.max(0, Number(record.sourceMessageCount || 0)),
    qualityScore: Math.max(0, Math.min(100, Number(record.qualityScore || 0))),
    budgetLevel: normalizeString(record.budgetLevel),
    auditRequired: record.auditRequired === true,
    createdAt: normalizeString(record.createdAt, now),
    updatedAt: normalizeString(record.updatedAt, now)
  }
}

export function appendChatMemoryRecord(record = {}) {
  const bucket = getStorageBucket()
  const normalized = createChatMemoryRecord(record)
  const records = [normalized, ...(Array.isArray(bucket.records) ? bucket.records : [])]
    .filter(Boolean)
    .slice(0, ARCHIVE_LIMIT)
  saveStorageBucket({ records })
  return normalized
}

export function listChatMemoryRecords(filters = {}) {
  const chatId = normalizeString(filters.chatId)
  const scopeKey = normalizeString(filters.scopeKey)
  const memoryType = normalizeString(filters.memoryType)
  return (getStorageBucket().records || []).filter((item) => {
    if (chatId && item.chatId !== chatId) return false
    if (scopeKey && item.scopeKey !== scopeKey) return false
    if (memoryType && item.memoryType !== memoryType) return false
    return true
  })
}

export function markChatMemoryRecordsUsed(memoryIds = []) {
  const ids = Array.isArray(memoryIds) ? memoryIds.map(item => normalizeString(item)).filter(Boolean) : []
  if (!ids.length) return false
  const bucket = getStorageBucket()
  let changed = false
  const records = (Array.isArray(bucket.records) ? bucket.records : []).map((item) => {
    if (!ids.includes(normalizeString(item?.id))) return item
    changed = true
    return {
      ...item,
      hitCount: Math.max(0, Number(item?.hitCount || 0)) + 1,
      updatedAt: new Date().toISOString()
    }
  })
  if (!changed) return false
  saveStorageBucket({ records })
  return true
}

export function buildChatMemoryContext(records = [], options = {}) {
  const list = Array.isArray(records) ? records : []
  const maxEntries = Math.max(1, Number(options.maxEntries || 3))
  const picked = list
    .filter(item => normalizeString(item?.summary))
    .sort((a, b) => String(b?.updatedAt || b?.createdAt || '').localeCompare(String(a?.updatedAt || a?.createdAt || '')))
    .slice(0, maxEntries)
  if (!picked.length) {
    return {
      message: null,
      meta: {
        memoryCount: 0,
        usedLongTermMemory: false
      }
    }
  }
  return {
    message: {
      role: 'system',
      content: [
        '以下是当前会话的长期记忆摘要，请在回答时优先保持这些长期上下文一致：',
        ...picked.map(item => `- ${item.title || '记忆'}：${item.summary}`)
      ].join('\n')
    },
    meta: {
      memoryCount: picked.length,
      usedLongTermMemory: true,
      memoryIds: picked.map(item => item.id),
      averageQualityScore: picked.length
        ? Math.round(picked.reduce((sum, item) => sum + Math.max(0, Number(item?.qualityScore || 0)), 0) / picked.length)
        : 0
    }
  }
}
