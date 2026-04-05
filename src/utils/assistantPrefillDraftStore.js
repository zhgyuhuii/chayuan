const ASSISTANT_PREFILL_DRAFT_STORAGE_KEY = 'assistant_create_prefill_draft'

function getStorage() {
  const app = window.Application || window.opener?.Application || window.parent?.Application
  if (app?.PluginStorage) {
    return {
      getItem(key) {
        return app.PluginStorage.getItem(key)
      },
      setItem(key, value) {
        app.PluginStorage.setItem(key, value)
      },
      removeItem(key) {
        app.PluginStorage.removeItem(key)
      }
    }
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage
  }
  return null
}

function normalizePrefillDraft(draft = {}) {
  if (!draft || typeof draft !== 'object') return null
  const normalized = {
    source: String(draft.source || 'local-capability-faq').trim() || 'local-capability-faq',
    title: String(draft.title || '').trim(),
    note: String(draft.note || '').trim(),
    createdAt: String(draft.createdAt || new Date().toISOString()),
    draft: draft.draft && typeof draft.draft === 'object' ? draft.draft : {}
  }
  return normalized
}

export function saveAssistantPrefillDraft(payload = {}) {
  try {
    const storage = getStorage()
    if (!storage) return false
    const normalized = normalizePrefillDraft(payload)
    if (!normalized) return false
    storage.setItem(ASSISTANT_PREFILL_DRAFT_STORAGE_KEY, JSON.stringify(normalized))
    return true
  } catch (_) {
    return false
  }
}

export function readAssistantPrefillDraft() {
  try {
    const storage = getStorage()
    if (!storage) return null
    const raw = storage.getItem(ASSISTANT_PREFILL_DRAFT_STORAGE_KEY)
    if (!raw) return null
    return normalizePrefillDraft(JSON.parse(raw))
  } catch (_) {
    return null
  }
}

export function consumeAssistantPrefillDraft() {
  try {
    const storage = getStorage()
    if (!storage) return null
    const parsed = readAssistantPrefillDraft()
    storage.removeItem(ASSISTANT_PREFILL_DRAFT_STORAGE_KEY)
    return parsed
  } catch (_) {
    return null
  }
}

export function clearAssistantPrefillDraft() {
  try {
    const storage = getStorage()
    if (!storage) return false
    storage.removeItem(ASSISTANT_PREFILL_DRAFT_STORAGE_KEY)
    return true
  } catch (_) {
    return false
  }
}
