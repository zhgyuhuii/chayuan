import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
import { getCustomAssistants, saveCustomAssistants } from './assistantSettings.js'
import { appendEvaluationRecord, buildAssistantVersionEvaluationRecord } from './evaluationStore.js'

const STORAGE_KEY = 'assistantVersionStore'

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function safeParseList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function safeNumber(value, fallback = null) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function getAssistantVersionStore() {
  const settings = loadGlobalSettings()
  const raw = settings[STORAGE_KEY]
  return Array.isArray(raw) ? raw.filter(item => item && typeof item === 'object') : []
}

export function saveAssistantVersionStore(list = []) {
  return saveGlobalSettings({ [STORAGE_KEY]: Array.isArray(list) ? list.filter(Boolean) : [] })
}

export function createAssistantVersionRecord(record = {}) {
  const now = new Date().toISOString()
  return {
    versionId: normalizeString(record.versionId, `assistant_version_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    assistantId: normalizeString(record.assistantId),
    version: normalizeString(record.version, '1.0.0'),
    sourceAssistantIds: safeParseList(record.sourceAssistantIds || record.parentAssistantIds),
    repairReason: normalizeString(record.repairReason),
    benchmarkScore: safeNumber(record.benchmarkScore),
    isPromoted: record.isPromoted === true,
    createdAt: normalizeString(record.createdAt, now),
    createdBy: normalizeString(record.createdBy, 'system'),
    changeSummary: normalizeString(record.changeSummary),
    evaluation: record.evaluation && typeof record.evaluation === 'object' ? { ...record.evaluation } : null,
    releaseGate: record.releaseGate && typeof record.releaseGate === 'object' ? { ...record.releaseGate } : null,
    snapshot: record.snapshot && typeof record.snapshot === 'object' ? JSON.parse(JSON.stringify(record.snapshot)) : null
  }
}

export function appendAssistantVersion(record = {}) {
  const store = getAssistantVersionStore()
  const normalized = createAssistantVersionRecord(record)
  store.push(normalized)
  saveAssistantVersionStore(store)
  if (normalized.evaluation || normalized.benchmarkScore != null) {
    try {
      appendEvaluationRecord(buildAssistantVersionEvaluationRecord(normalized))
    } catch (_) {
      // Ignore evaluation persistence failures so version publishing is not blocked.
    }
  }
  return normalized
}

export function listAssistantVersions(assistantId) {
  const normalized = normalizeString(assistantId)
  return getAssistantVersionStore().filter(item => item.assistantId === normalized)
}

export function getLatestAssistantVersion(assistantId) {
  return listAssistantVersions(assistantId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null
}

export function getAssistantVersionById(versionId) {
  const normalized = normalizeString(versionId)
  if (!normalized) return null
  return getAssistantVersionStore().find(item => item.versionId === normalized) || null
}

export function listAssistantVersionFamily(assistantId) {
  const normalized = normalizeString(assistantId)
  if (!normalized) return []
  return getAssistantVersionStore().filter((item) => {
    const sourceIds = safeParseList(item?.sourceAssistantIds)
    return item.assistantId === normalized || sourceIds.includes(normalized)
  })
}

export function promoteAssistantVersion(versionId) {
  const record = getAssistantVersionById(versionId)
  if (!record?.assistantId) {
    throw new Error('未找到可晋升的助手版本')
  }
  if (record?.evaluation?.releaseGate?.allowed === false || record?.releaseGate?.allowed === false) {
    throw new Error(
      record?.evaluation?.releaseGate?.reason ||
      record?.releaseGate?.reason ||
      '当前版本未通过发布门禁，暂不能晋升'
    )
  }
  const familyIds = new Set([
    record.assistantId,
    ...safeParseList(record.sourceAssistantIds)
  ])
  const assistants = getCustomAssistants()
  const nextAssistants = assistants.map((item) => {
    if (!familyIds.has(String(item?.id || '').trim())) return item
    return {
      ...item,
      isPromoted: String(item?.id || '').trim() === record.assistantId,
      updatedAt: new Date().toISOString()
    }
  })
  saveCustomAssistants(nextAssistants)
  const store = getAssistantVersionStore().map((item) => {
    const itemFamilyIds = new Set([item.assistantId, ...safeParseList(item.sourceAssistantIds)])
    if (![...itemFamilyIds].some(id => familyIds.has(id))) return item
    return {
      ...item,
      isPromoted: item.versionId === record.versionId
    }
  })
  saveAssistantVersionStore(store)
  return getAssistantVersionById(versionId)
}

export function restoreAssistantVersion(versionId) {
  const record = getAssistantVersionById(versionId)
  if (!record?.assistantId || !record?.snapshot || typeof record.snapshot !== 'object') {
    throw new Error('未找到可回滚的助手版本快照')
  }
  const assistants = getCustomAssistants()
  const now = new Date().toISOString()
  const targetId = record.assistantId
  const snapshot = {
    ...record.snapshot,
    id: targetId,
    updatedAt: now
  }
  const index = assistants.findIndex(item => String(item?.id || '').trim() === targetId)
  const nextAssistants = [...assistants]
  if (index >= 0) {
    nextAssistants.splice(index, 1, {
      ...nextAssistants[index],
      ...snapshot
    })
  } else {
    nextAssistants.push(snapshot)
  }
  saveCustomAssistants(nextAssistants)
  const rollbackRecord = appendAssistantVersion({
    assistantId: targetId,
    version: record.version,
    sourceAssistantIds: record.sourceAssistantIds,
    repairReason: record.repairReason,
    benchmarkScore: record.benchmarkScore,
    isPromoted: record.isPromoted === true,
    changeSummary: `回滚到版本 ${record.version}`,
    evaluation: record.evaluation,
    snapshot
  })
  return {
    ...rollbackRecord,
    restoredAssistant: snapshot
  }
}
