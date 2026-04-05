const STORAGE_KEY = 'NdCapabilityAuditStore'
const ARCHIVE_LIMIT = 400

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

function truncateText(text = '', maxLength = 240) {
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

function summarizeValue(value) {
  if (value == null) return ''
  if (typeof value === 'string') return truncateText(value, 260)
  try {
    return truncateText(JSON.stringify(value), 260)
  } catch (_) {
    return truncateText(String(value), 260)
  }
}

export function createCapabilityAuditRecord(record = {}) {
  const now = new Date().toISOString()
  return {
    id: normalizeString(record.id, `cap_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    namespace: normalizeString(record.namespace, 'wps'),
    capabilityKey: normalizeString(record.capabilityKey),
    capabilityLabel: normalizeString(record.capabilityLabel),
    status: normalizeString(record.status, 'completed'),
    riskLevel: normalizeString(record.riskLevel, 'low'),
    decision: normalizeString(record.decision, 'allow'),
    decisionReason: truncateText(record.decisionReason, 260),
    confirmed: record.confirmed === true,
    entry: normalizeString(record.entry),
    launchSource: normalizeString(record.launchSource),
    taskId: normalizeString(record.taskId),
    workflowId: normalizeString(record.workflowId),
    workflowName: normalizeString(record.workflowName),
    groupKey: normalizeString(record.groupKey, `${normalizeString(record.taskId) || normalizeString(record.workflowId) || 'adhoc'}:${normalizeString(record.capabilityKey)}`),
    requirementText: truncateText(record.requirementText, 260),
    paramsPreview: summarizeValue(record.params),
    resultPreview: summarizeValue(record.resultPreview || record.result),
    errorMessage: truncateText(record.errorMessage, 260),
    durationMs: Number.isFinite(Number(record.durationMs)) ? Math.max(0, Number(record.durationMs)) : 0,
    createdAt: normalizeString(record.createdAt, now)
  }
}

export function appendCapabilityAuditRecord(record = {}) {
  const bucket = getStorageBucket()
  const normalized = createCapabilityAuditRecord(record)
  const records = [normalized, ...(Array.isArray(bucket.records) ? bucket.records : [])]
    .filter(Boolean)
    .slice(0, ARCHIVE_LIMIT)
  saveStorageBucket({ records })
  return normalized
}

export function listCapabilityAuditRecords(filters = {}) {
  const namespace = normalizeString(filters.namespace)
  const entry = normalizeString(filters.entry)
  const status = normalizeString(filters.status)
  const riskLevel = normalizeString(filters.riskLevel)
  const taskId = normalizeString(filters.taskId)
  const workflowId = normalizeString(filters.workflowId)
  return (getStorageBucket().records || []).filter((item) => {
    if (namespace && item.namespace !== namespace) return false
    if (entry && item.entry !== entry) return false
    if (status && item.status !== status) return false
    if (riskLevel && item.riskLevel !== riskLevel) return false
    if (taskId && item.taskId !== taskId) return false
    if (workflowId && item.workflowId !== workflowId) return false
    return true
  })
}

export function aggregateCapabilityAuditRecords(filters = {}) {
  const records = listCapabilityAuditRecords(filters)
  const summary = {
    totalCount: records.length,
    completedCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    deniedCount: 0,
    confirmCount: 0,
    highRiskCount: 0,
    taskGroupCount: 0,
    workflowGroupCount: 0,
    averageDurationMs: 0
  }
  const taskGroups = new Set()
  const workflowGroups = new Set()
  let durationSum = 0
  records.forEach((item) => {
    if (item.status === 'completed') summary.completedCount += 1
    if (item.status === 'failed') summary.failedCount += 1
    if (item.status === 'cancelled') summary.cancelledCount += 1
    if (item.status === 'denied') summary.deniedCount += 1
    if (item.decision === 'confirm') summary.confirmCount += 1
    if (item.riskLevel === 'high') summary.highRiskCount += 1
    if (item.taskId) taskGroups.add(item.taskId)
    if (item.workflowId) workflowGroups.add(item.workflowId)
    durationSum += Number(item.durationMs || 0)
  })
  summary.taskGroupCount = taskGroups.size
  summary.workflowGroupCount = workflowGroups.size
  summary.averageDurationMs = records.length > 0 ? Math.round(durationSum / records.length) : 0
  return summary
}

export function exportCapabilityAuditRecords(filters = {}) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    filters,
    summary: aggregateCapabilityAuditRecords(filters),
    records: listCapabilityAuditRecords(filters)
  }, null, 2)
}

