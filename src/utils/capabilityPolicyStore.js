import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'

const STORAGE_KEY = 'capabilityPolicyStore'

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function safeClone(value, fallback) {
  if (value == null) return fallback
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (_) {
    return fallback
  }
}

const HIGH_RISK_CATEGORIES = new Set([
  'document-file',
  'document-security'
])

const MEDIUM_RISK_CATEGORIES = new Set([
  'document-structure',
  'document-format',
  'document-edit'
])

const HIGH_RISK_CAPABILITIES = new Set([
  'save-document-as',
  'save-document-with-dialog',
  'encrypt-document',
  'encrypt-document-with-dialog',
  'decrypt-document'
])

function createDefaultPolicyBucket() {
  return {
    version: 1,
    namespacePolicies: {
      wps: {
        enabled: true,
        defaultDecision: 'allow',
        requireConfirmationForHighRisk: true,
        perMinuteLimit: 0,
        perDayLimit: 0
      },
      utility: {
        enabled: true,
        defaultDecision: 'allow',
        requireConfirmationForHighRisk: false,
        perMinuteLimit: 0,
        perDayLimit: 0
      }
    },
    capabilityPolicies: {}
  }
}

function normalizeDecision(value, fallback = 'allow') {
  const normalized = normalizeString(value, fallback)
  return ['allow', 'confirm', 'deny', 'throttled'].includes(normalized) ? normalized : fallback
}

function normalizeEntryList(entries = []) {
  return Array.isArray(entries)
    ? Array.from(new Set(entries.map(item => normalizeString(item)).filter(Boolean)))
    : []
}

function normalizeLimit(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0
}

function normalizePolicyRecord(policy = {}, base = {}) {
  return {
    ...base,
    ...safeClone(policy, {}),
    enabled: policy.enabled !== false,
    defaultDecision: normalizeDecision(policy.defaultDecision, normalizeDecision(base.defaultDecision, 'allow')),
    requireConfirmationForHighRisk: policy.requireConfirmationForHighRisk === true,
    allowedEntries: normalizeEntryList(policy.allowedEntries || base.allowedEntries),
    blockedEntries: normalizeEntryList(policy.blockedEntries || base.blockedEntries),
    perMinuteLimit: normalizeLimit(policy.perMinuteLimit ?? base.perMinuteLimit),
    perDayLimit: normalizeLimit(policy.perDayLimit ?? base.perDayLimit)
  }
}

export function loadCapabilityPolicyStore() {
  const settings = loadGlobalSettings()
  const raw = settings?.[STORAGE_KEY]
  if (!raw || typeof raw !== 'object') {
    return createDefaultPolicyBucket()
  }
  return {
    ...createDefaultPolicyBucket(),
    ...safeClone(raw, createDefaultPolicyBucket())
  }
}

export function saveCapabilityPolicyStore(bucket = {}) {
  return saveGlobalSettings({
    [STORAGE_KEY]: {
      ...createDefaultPolicyBucket(),
      ...safeClone(bucket, createDefaultPolicyBucket())
    }
  })
}

export function inferCapabilityRiskLevel(capability = {}, namespace = 'wps') {
  const category = normalizeString(capability?.category)
  const key = normalizeString(capability?.capabilityKey || capability?.key)
  const explicit = normalizeString(capability?.riskLevel)
  if (['low', 'medium', 'high'].includes(explicit)) return explicit
  if (HIGH_RISK_CAPABILITIES.has(key)) return 'high'
  if (HIGH_RISK_CATEGORIES.has(category)) return 'high'
  if (MEDIUM_RISK_CATEGORIES.has(category)) return 'medium'
  if (namespace !== 'wps') return 'low'
  return 'medium'
}

export function listCapabilityPolicies() {
  const store = loadCapabilityPolicyStore()
  const capabilityPolicies = store?.capabilityPolicies && typeof store.capabilityPolicies === 'object'
    ? store.capabilityPolicies
    : {}
  return Object.keys(capabilityPolicies).map((key) => ({
    key,
    ...safeClone(capabilityPolicies[key], {})
  }))
}

export function listNamespacePolicies() {
  const store = loadCapabilityPolicyStore()
  const policies = store?.namespacePolicies && typeof store.namespacePolicies === 'object'
    ? store.namespacePolicies
    : {}
  return Object.keys(policies).map((namespace) => ({
    namespace,
    ...normalizePolicyRecord(policies[namespace], createDefaultPolicyBucket().namespacePolicies[namespace] || {})
  }))
}

export function upsertNamespacePolicy(namespace, policy = {}) {
  const normalizedNamespace = normalizeString(namespace)
  if (!normalizedNamespace) return null
  const store = loadCapabilityPolicyStore()
  store.namespacePolicies = store.namespacePolicies && typeof store.namespacePolicies === 'object'
    ? store.namespacePolicies
    : {}
  const basePolicy = store.namespacePolicies[normalizedNamespace]
    || createDefaultPolicyBucket().namespacePolicies[normalizedNamespace]
    || {
      enabled: true,
      defaultDecision: 'allow',
      requireConfirmationForHighRisk: false,
      perMinuteLimit: 0,
      perDayLimit: 0
    }
  store.namespacePolicies[normalizedNamespace] = normalizePolicyRecord(policy, basePolicy)
  saveCapabilityPolicyStore(store)
  return {
    namespace: normalizedNamespace,
    ...store.namespacePolicies[normalizedNamespace]
  }
}

export function upsertCapabilityPolicy(key, policy = {}) {
  const normalizedKey = normalizeString(key)
  if (!normalizedKey) return null
  const store = loadCapabilityPolicyStore()
  store.capabilityPolicies = store.capabilityPolicies && typeof store.capabilityPolicies === 'object'
    ? store.capabilityPolicies
    : {}
  store.capabilityPolicies[normalizedKey] = normalizePolicyRecord(
    policy,
    store.capabilityPolicies[normalizedKey] || {}
  )
  saveCapabilityPolicyStore(store)
  return {
    key: normalizedKey,
    ...store.capabilityPolicies[normalizedKey]
  }
}

export function removeCapabilityPolicy(key) {
  const normalizedKey = normalizeString(key)
  if (!normalizedKey) return false
  const store = loadCapabilityPolicyStore()
  if (!store?.capabilityPolicies?.[normalizedKey]) return false
  delete store.capabilityPolicies[normalizedKey]
  saveCapabilityPolicyStore(store)
  return true
}

export function getCapabilityPolicySnapshot(namespace, capabilityKey) {
  const store = loadCapabilityPolicyStore()
  const normalizedNamespace = normalizeString(namespace, 'wps')
  const normalizedKey = normalizeString(capabilityKey)
  const namespacePolicy = normalizePolicyRecord(
    store?.namespacePolicies?.[normalizedNamespace] || {},
    createDefaultPolicyBucket().namespacePolicies[normalizedNamespace] || {}
  )
  const capabilityPolicy = normalizedKey
    ? safeClone(
      store?.capabilityPolicies?.[`${normalizedNamespace}.${normalizedKey}`]
        || store?.capabilityPolicies?.[normalizedKey]
        || {},
      {}
    )
    : {}
  return {
    namespacePolicy: safeClone(namespacePolicy, {}),
    capabilityPolicy: safeClone(capabilityPolicy, {})
  }
}

export function evaluateCapabilityPolicy(request = {}, capability = {}) {
  const namespace = normalizeString(request?.namespace, 'wps')
  const capabilityKey = normalizeString(request?.capabilityKey || capability?.capabilityKey || capability?.key)
  const entry = normalizeString(request?.entry)
  const confirmed = request?.confirmed === true
  const riskLevel = inferCapabilityRiskLevel(capability, namespace)
  const snapshot = getCapabilityPolicySnapshot(namespace, capabilityKey)
  const namespacePolicy = snapshot.namespacePolicy || {}
  const capabilityPolicy = snapshot.capabilityPolicy || {}
  const merged = {
    enabled: capabilityPolicy.enabled !== false && namespacePolicy.enabled !== false,
    defaultDecision: normalizeDecision(capabilityPolicy.defaultDecision, normalizeDecision(namespacePolicy.defaultDecision, 'allow')),
    requireConfirmationForHighRisk: capabilityPolicy.requireConfirmationForHighRisk != null
      ? capabilityPolicy.requireConfirmationForHighRisk === true
      : namespacePolicy.requireConfirmationForHighRisk === true,
    allowedEntries: normalizeEntryList(capabilityPolicy.allowedEntries),
    blockedEntries: normalizeEntryList(capabilityPolicy.blockedEntries),
    perMinuteLimit: normalizeLimit(capabilityPolicy.perMinuteLimit || namespacePolicy.perMinuteLimit),
    perDayLimit: normalizeLimit(capabilityPolicy.perDayLimit || namespacePolicy.perDayLimit)
  }
  if (merged.enabled !== true) {
    return {
      allowed: false,
      decision: 'deny',
      riskLevel,
      confirmed,
      reason: '能力策略已禁用',
      policySnapshot: merged
    }
  }
  if (entry && merged.blockedEntries.includes(entry)) {
    return {
      allowed: false,
      decision: 'deny',
      riskLevel,
      confirmed,
      reason: `入口 ${entry} 已被策略阻止`,
      policySnapshot: merged
    }
  }
  if (entry && merged.allowedEntries.length > 0 && !merged.allowedEntries.includes(entry)) {
    return {
      allowed: false,
      decision: 'deny',
      riskLevel,
      confirmed,
      reason: `入口 ${entry} 不在允许列表中`,
      policySnapshot: merged
    }
  }
  if (merged.defaultDecision === 'deny') {
    return {
      allowed: false,
      decision: 'deny',
      riskLevel,
      confirmed,
      reason: '能力策略默认拒绝',
      policySnapshot: merged
    }
  }
  if (merged.defaultDecision === 'throttled') {
    return {
      allowed: false,
      decision: 'throttled',
      riskLevel,
      confirmed,
      reason: '能力策略要求稍后重试',
      policySnapshot: merged
    }
  }
  if ((merged.defaultDecision === 'confirm' || (merged.requireConfirmationForHighRisk && riskLevel === 'high')) && confirmed !== true) {
    return {
      allowed: false,
      decision: 'confirm',
      riskLevel,
      confirmed,
      reason: '高风险能力需要明确确认后执行',
      policySnapshot: merged
    }
  }
  return {
    allowed: true,
    decision: confirmed ? 'confirmed' : 'allow',
    riskLevel,
    confirmed,
    reason: confirmed ? '已确认执行' : '策略允许执行',
    policySnapshot: merged
  }
}

export function exportCapabilityPolicySnapshot() {
  return JSON.stringify(loadCapabilityPolicyStore(), null, 2)
}
