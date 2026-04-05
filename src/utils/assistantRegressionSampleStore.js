import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'

const STORAGE_KEY = 'assistantRegressionSampleStore'
const ARCHIVE_LIMIT = 120
const TEMPLATE_VERSION = '1.0.0'

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function safeClone(value, fallback = null) {
  if (value == null) return fallback
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (_) {
    return fallback
  }
}

export function createRegressionSampleRecord(record = {}) {
  const now = new Date().toISOString()
  return {
    id: normalizeString(record.id, `regression_sample_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    assistantId: normalizeString(record.assistantId),
    label: normalizeString(record.label, '黄金样本'),
    groupKey: normalizeString(record.groupKey, 'default'),
    riskLevel: ['low', 'medium', 'high'].includes(normalizeString(record.riskLevel))
      ? normalizeString(record.riskLevel)
      : 'medium',
    inputText: normalizeString(record.inputText),
    expectedDocumentAction: normalizeString(record.expectedDocumentAction),
    expectedInputSource: normalizeString(record.expectedInputSource),
    expectedTargetLanguage: normalizeString(record.expectedTargetLanguage),
    expectedOutputFormat: normalizeString(record.expectedOutputFormat),
    critical: record.critical === true,
    source: normalizeString(record.source, 'golden'),
    tags: Array.isArray(record.tags)
      ? Array.from(new Set(record.tags.map(item => normalizeString(item)).filter(Boolean))).slice(0, 12)
      : [],
    notes: normalizeString(record.notes),
    createdAt: normalizeString(record.createdAt, now),
    updatedAt: normalizeString(record.updatedAt, now)
  }
}

export function listRegressionSamples(filters = {}) {
  const assistantId = normalizeString(filters.assistantId)
  const groupKey = normalizeString(filters.groupKey)
  const riskLevel = normalizeString(filters.riskLevel)
  const settings = loadGlobalSettings()
  const records = Array.isArray(settings?.[STORAGE_KEY]) ? settings[STORAGE_KEY] : []
  return records
    .filter(item => item && typeof item === 'object')
    .map(item => createRegressionSampleRecord(item))
    .filter((item) => {
      if (assistantId && item.assistantId && item.assistantId !== assistantId) return false
      if (groupKey && item.groupKey !== groupKey) return false
      if (riskLevel && item.riskLevel !== riskLevel) return false
      return true
    })
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
}

export function upsertRegressionSample(record = {}) {
  const normalized = createRegressionSampleRecord(record)
  const current = listRegressionSamples({})
  const index = current.findIndex(item => item.id === normalized.id)
  if (index >= 0) {
    current.splice(index, 1, {
      ...current[index],
      ...safeClone(normalized, {}),
      updatedAt: new Date().toISOString()
    })
  } else {
    current.unshift(normalized)
  }
  saveGlobalSettings({
    [STORAGE_KEY]: current.slice(0, ARCHIVE_LIMIT)
  })
  return normalized
}

export function removeRegressionSample(sampleId = '') {
  const normalizedId = normalizeString(sampleId)
  if (!normalizedId) return false
  const current = listRegressionSamples({})
  const next = current.filter(item => item.id !== normalizedId)
  if (next.length === current.length) return false
  saveGlobalSettings({
    [STORAGE_KEY]: next
  })
  return true
}

export function exportRegressionSamples(filters = {}) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    templateVersion: TEMPLATE_VERSION,
    filters,
    records: listRegressionSamples(filters)
  }, null, 2)
}

export function buildRegressionSampleTemplate() {
  return JSON.stringify({
    templateVersion: TEMPLATE_VERSION,
    description: '黄金样本导入模板，可按 assistantId / groupKey / riskLevel 组织样本。',
    records: [
      {
        assistantId: '',
        label: '合同摘要稳定性',
        groupKey: 'contract-review',
        riskLevel: 'high',
        inputText: '请对这份合同生成摘要，并指出甲乙双方、金额、期限和主要风险。',
        expectedDocumentAction: 'comment',
        expectedInputSource: 'selection-preferred',
        expectedTargetLanguage: '中文',
        expectedOutputFormat: 'markdown',
        critical: true,
        source: 'golden',
        tags: ['合同', '摘要', '高风险'],
        notes: '用于检测高风险合同类助手的关键信息是否完整。'
      }
    ]
  }, null, 2)
}

export function importRegressionSamples(payload, options = {}) {
  let parsed = null
  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload)
    } catch (_) {
      throw new Error('黄金样本模板不是有效的 JSON')
    }
  } else {
    parsed = safeClone(payload, null)
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('黄金样本模板格式无效')
  }
  const records = Array.isArray(parsed.records)
    ? parsed.records
    : (Array.isArray(parsed.samples) ? parsed.samples : [])
  if (!records.length) {
    throw new Error('模板中没有可导入的黄金样本')
  }
  const replaceAll = options.replaceAll === true
  const existing = replaceAll ? [] : listRegressionSamples({})
  const incoming = records.map(item => createRegressionSampleRecord(item))
  const merged = [...existing]
  incoming.forEach((item) => {
    const index = merged.findIndex((current) => current.id === item.id)
    if (index >= 0) {
      merged.splice(index, 1, {
        ...merged[index],
        ...safeClone(item, {}),
        updatedAt: new Date().toISOString()
      })
      return
    }
    merged.unshift(item)
  })
  saveGlobalSettings({
    [STORAGE_KEY]: merged.slice(0, ARCHIVE_LIMIT)
  })
  return {
    importedCount: incoming.length,
    totalCount: merged.length
  }
}
