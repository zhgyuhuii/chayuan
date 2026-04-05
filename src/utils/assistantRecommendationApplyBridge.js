const STORAGE_KEY = 'NdAssistantRecommendationApplyRequest'

function readStorageJson(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

function writeStorageJson(key, value) {
  try {
    const serialized = JSON.stringify(value)
    window.localStorage.setItem(key, serialized)
    try {
      window.Application?.PluginStorage?.setItem(key, serialized)
    } catch (_) {}
    return true
  } catch (_) {
    return false
  }
}

function removeStorageKey(key) {
  try {
    window.localStorage.removeItem(key)
  } catch (_) {}
  try {
    window.Application?.PluginStorage?.removeItem?.(key)
  } catch (_) {}
}

export function dispatchAssistantRecommendationApplyRequest(payload = {}) {
  const request = {
    requestId: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    ...payload
  }
  if (!writeStorageJson(STORAGE_KEY, request)) {
    throw new Error('无法写入推荐应用请求')
  }
  return request
}

export function readAssistantRecommendationApplyRequest() {
  return readStorageJson(STORAGE_KEY)
}

export function clearAssistantRecommendationApplyRequest(requestId = '') {
  const current = readAssistantRecommendationApplyRequest()
  if (!current) return
  if (requestId && String(current.requestId || '') !== String(requestId || '')) return
  removeStorageKey(STORAGE_KEY)
}

export function getAssistantRecommendationApplyStorageKey() {
  return STORAGE_KEY
}
