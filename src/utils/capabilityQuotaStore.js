import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'

const STORAGE_KEY = 'capabilityQuotaUsageStore'
const MAX_EVENTS_PER_KEY = 240

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function normalizeLimit(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0
}

function getNowIso() {
  return new Date().toISOString()
}

function buildQuotaKey(namespace = 'wps', capabilityKey = '') {
  const normalizedNamespace = normalizeString(namespace, 'wps')
  const normalizedCapabilityKey = normalizeString(capabilityKey)
  return `${normalizedNamespace}.${normalizedCapabilityKey || '*'}`
}

function loadQuotaUsageStore() {
  const settings = loadGlobalSettings()
  const raw = settings?.[STORAGE_KEY]
  return raw && typeof raw === 'object'
    ? {
      events: raw.events && typeof raw.events === 'object' ? raw.events : {}
    }
    : { events: {} }
}

function saveQuotaUsageStore(store = {}) {
  return saveGlobalSettings({
    [STORAGE_KEY]: {
      events: store?.events && typeof store.events === 'object' ? store.events : {}
    }
  })
}

function pruneEvents(events = [], nowMs = Date.now()) {
  const oneDayAgo = nowMs - (24 * 60 * 60 * 1000)
  return (Array.isArray(events) ? events : [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => {
      const ts = new Date(item).getTime()
      return Number.isFinite(ts) && ts >= oneDayAgo
    })
    .slice(-MAX_EVENTS_PER_KEY)
}

function countEventsWithin(events = [], windowMs = 0, nowMs = Date.now()) {
  if (!windowMs) return 0
  const threshold = nowMs - windowMs
  return (Array.isArray(events) ? events : []).filter((item) => {
    const ts = new Date(item).getTime()
    return Number.isFinite(ts) && ts >= threshold
  }).length
}

export function evaluateCapabilityQuota(options = {}) {
  const namespace = normalizeString(options.namespace, 'wps')
  const capabilityKey = normalizeString(options.capabilityKey)
  const policySnapshot = options.policySnapshot && typeof options.policySnapshot === 'object'
    ? options.policySnapshot
    : {}
  const perMinuteLimit = normalizeLimit(policySnapshot.perMinuteLimit)
  const perDayLimit = normalizeLimit(policySnapshot.perDayLimit)
  if (!capabilityKey || (!perMinuteLimit && !perDayLimit)) {
    return {
      allowed: true,
      decision: 'allow',
      reason: '未设置能力配额限制',
      usage: {
        minuteCount: 0,
        dayCount: 0,
        perMinuteLimit,
        perDayLimit
      }
    }
  }
  const store = loadQuotaUsageStore()
  const key = buildQuotaKey(namespace, capabilityKey)
  const nowMs = Date.now()
  const events = pruneEvents(store?.events?.[key], nowMs)
  if (!store.events) store.events = {}
  store.events[key] = events
  saveQuotaUsageStore(store)
  const minuteCount = countEventsWithin(events, 60 * 1000, nowMs)
  const dayCount = countEventsWithin(events, 24 * 60 * 60 * 1000, nowMs)
  const usage = {
    minuteCount,
    dayCount,
    perMinuteLimit,
    perDayLimit
  }
  if (perMinuteLimit > 0 && minuteCount >= perMinuteLimit) {
    return {
      allowed: false,
      decision: 'throttled',
      reason: `能力调用已达到每分钟 ${perMinuteLimit} 次限制，请稍后重试`,
      usage
    }
  }
  if (perDayLimit > 0 && dayCount >= perDayLimit) {
    return {
      allowed: false,
      decision: 'throttled',
      reason: `能力调用已达到每日 ${perDayLimit} 次限制，请明日再试`,
      usage
    }
  }
  return {
    allowed: true,
    decision: 'allow',
    reason: '能力调用未触发配额限制',
    usage
  }
}

export function appendCapabilityQuotaUsage(options = {}) {
  const namespace = normalizeString(options.namespace, 'wps')
  const capabilityKey = normalizeString(options.capabilityKey)
  if (!capabilityKey) return false
  const store = loadQuotaUsageStore()
  const key = buildQuotaKey(namespace, capabilityKey)
  const nowIso = normalizeString(options.createdAt, getNowIso())
  const nextEvents = [...pruneEvents(store?.events?.[key]), nowIso].slice(-MAX_EVENTS_PER_KEY)
  store.events = store.events && typeof store.events === 'object' ? store.events : {}
  store.events[key] = nextEvents
  saveQuotaUsageStore(store)
  return true
}

export function getCapabilityQuotaSnapshot(namespace = 'wps', capabilityKey = '') {
  const key = buildQuotaKey(namespace, capabilityKey)
  const events = pruneEvents(loadQuotaUsageStore()?.events?.[key])
  return {
    key,
    events
  }
}
