const STORAGE_KEY = 'NdEvaluationStore'
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

function normalizeNumber(value, fallback = null) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function clampScore(value) {
  if (!Number.isFinite(Number(value))) return null
  return Math.max(0, Math.min(100, Math.round(Number(value))))
}

function getStorageBucket() {
  const app = getApplication()
  const localRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : ''
  const pluginRaw = app?.PluginStorage?.getItem(STORAGE_KEY)
  return safeParse(localRaw || pluginRaw, { records: [] }) || { records: [] }
}

function saveStorageBucket(bucket) {
  const payload = JSON.stringify(bucket || { records: [] })
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, payload)
  }
  try {
    getApplication()?.PluginStorage?.setItem(STORAGE_KEY, payload)
  } catch (_) {}
  return true
}

function tokenizeText(value = '') {
  return Array.from(new Set(
    String(value || '')
      .toLowerCase()
      .match(/[\u4e00-\u9fa5a-z0-9]{2,}/g) || []
  ))
}

function computeTokenOverlap(left = '', right = '') {
  const leftTokens = tokenizeText(left)
  const rightTokens = tokenizeText(right)
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0
  const rightSet = new Set(rightTokens)
  const matched = leftTokens.filter(token => rightSet.has(token)).length
  return matched / Math.max(1, Math.min(leftTokens.length, rightTokens.length))
}

function truncateText(text = '', maxLength = 240) {
  const normalized = normalizeString(text)
  if (!normalized) return ''
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
}

function sortRecords(records = []) {
  return (Array.isArray(records) ? records : [])
    .filter(Boolean)
    .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))
}

export function createEvaluationRecord(record = {}) {
  const now = new Date().toISOString()
  return {
    id: normalizeString(record.id, `evaluation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    scenarioType: normalizeString(record.scenarioType, 'general'),
    ownerType: normalizeString(record.ownerType),
    ownerId: normalizeString(record.ownerId),
    title: normalizeString(record.title, '评测记录'),
    status: normalizeString(record.status, 'completed'),
    score: clampScore(record.score),
    summary: normalizeString(record.summary),
    inputPreview: truncateText(record.inputPreview || record.inputText),
    outputPreview: truncateText(record.outputPreview || record.outputText),
    createdAt: normalizeString(record.createdAt, now),
    updatedAt: normalizeString(record.updatedAt, now),
    metrics: record.metrics && typeof record.metrics === 'object' ? { ...record.metrics } : {},
    metadata: record.metadata && typeof record.metadata === 'object' ? { ...record.metadata } : {},
    sampleType: normalizeString(record.sampleType || record?.metadata?.sampleType)
  }
}

export function loadEvaluationStore() {
  const bucket = getStorageBucket()
  return {
    records: sortRecords(bucket?.records || []).slice(0, ARCHIVE_LIMIT)
  }
}

export function appendEvaluationRecord(record = {}) {
  const bucket = loadEvaluationStore()
  const normalized = createEvaluationRecord(record)
  bucket.records = sortRecords([normalized, ...(bucket.records || [])]).slice(0, ARCHIVE_LIMIT)
  saveStorageBucket(bucket)
  return normalized
}

export function listEvaluationRecords(filters = {}) {
  const scenarioType = normalizeString(filters.scenarioType)
  const ownerType = normalizeString(filters.ownerType)
  const ownerId = normalizeString(filters.ownerId)
  const sampleType = normalizeString(filters.sampleType)
  return loadEvaluationStore().records.filter((item) => {
    if (scenarioType && item.scenarioType !== scenarioType) return false
    if (ownerType && item.ownerType !== ownerType) return false
    if (ownerId && item.ownerId !== ownerId) return false
    if (sampleType && item.sampleType !== sampleType) return false
    return true
  })
}

export function buildEvaluationDashboard(filters = {}) {
  const records = listEvaluationRecords(filters)
  const scenarioBuckets = {}
  const sampleBuckets = {}
  const ownerBuckets = {}
  let reviewCount = 0
  let blockedCount = 0
  let regressionCount = 0
  records.forEach((item) => {
    const scenarioType = normalizeString(item.scenarioType, 'general')
    const sampleType = normalizeString(item.sampleType, 'standard')
    const ownerKey = normalizeString(item.ownerId || item.ownerType, 'unknown')
    scenarioBuckets[scenarioType] = scenarioBuckets[scenarioType] || { count: 0, scoreSum: 0 }
    scenarioBuckets[scenarioType].count += 1
    scenarioBuckets[scenarioType].scoreSum += Number(item.score || 0)
    sampleBuckets[sampleType] = (sampleBuckets[sampleType] || 0) + 1
    ownerBuckets[ownerKey] = ownerBuckets[ownerKey] || { count: 0, scoreSum: 0, ownerType: item.ownerType || '' }
    ownerBuckets[ownerKey].count += 1
    ownerBuckets[ownerKey].scoreSum += Number(item.score || 0)
    if (item.status === 'review') reviewCount += 1
    if (item.sampleType === 'release-blocked') blockedCount += 1
    if (item.sampleType === 'regression-suite' || item.ownerType === 'assistant-regression') regressionCount += 1
  })
  const sorted = [...records].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
  const trend = sorted.slice(-12).map((item) => ({
    id: item.id,
    label: item.title,
    scenarioType: item.scenarioType,
    score: Number(item.score || 0),
    createdAt: item.createdAt
  }))
  return {
    totalCount: records.length,
    averageScore: records.length > 0
      ? Math.round(records.reduce((sum, item) => sum + Number(item.score || 0), 0) / records.length)
      : 0,
    reviewCount,
    blockedCount,
    regressionCount,
    scenarioSummary: Object.keys(scenarioBuckets).map((key) => ({
      key,
      count: scenarioBuckets[key].count,
      averageScore: scenarioBuckets[key].count > 0
        ? Math.round(scenarioBuckets[key].scoreSum / scenarioBuckets[key].count)
        : 0
    })),
    sampleSummary: Object.keys(sampleBuckets).map((key) => ({
      key,
      count: sampleBuckets[key]
    })),
    ownerSummary: Object.keys(ownerBuckets)
      .map((key) => ({
        key,
        ownerType: ownerBuckets[key].ownerType,
        count: ownerBuckets[key].count,
        averageScore: ownerBuckets[key].count > 0
          ? Math.round(ownerBuckets[key].scoreSum / ownerBuckets[key].count)
          : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    trend
  }
}

export function buildChatEvaluationRecord(options = {}) {
  const inputText = normalizeString(options.inputText)
  const outputText = normalizeString(options.outputText)
  const overlap = computeTokenOverlap(inputText, outputText)
  const lengthScore = Math.min(1, outputText.length / 220)
  const nonEmptyScore = outputText ? 1 : 0
  const score = ((overlap * 0.45) + (lengthScore * 0.25) + (nonEmptyScore * 0.3)) * 100
  const attachmentCount = Math.max(0, Number(options.attachmentCount || 0))
  const trimmedMessageCount = Math.max(
    0,
    Number(options.contextMeta?.trimmedMessageCount || options.contextMeta?.trimmedEarlierCount || 0)
  )
  return createEvaluationRecord({
    scenarioType: 'chat',
    ownerType: 'message',
    ownerId: normalizeString(options.messageId),
    title: normalizeString(options.title, '普通聊天评测'),
    status: outputText ? 'completed' : 'empty',
    score,
    sampleType: options.contextMeta?.summaryAuditRequired
      ? 'summary-audit'
      : normalizeString(options.contextMeta?.budgetLevel, 'standard'),
    summary: outputText
      ? `聊天回复已生成，词元重合 ${Math.round(overlap * 100)}%，附件 ${attachmentCount} 个，裁剪历史 ${trimmedMessageCount} 条。`
      : '聊天回复为空，建议人工复核本轮请求。',
    inputText,
    outputText,
    metrics: {
      overlapScore: Math.round(overlap * 100),
      outputLength: outputText.length,
      attachmentCount,
      trimmedMessageCount,
      memoryCount: Math.max(0, Number(options.contextMeta?.memoryCount || 0)),
      summaryQualityScore: Number(options.contextMeta?.summaryQualityScore || 0),
      budgetLevel: normalizeString(options.contextMeta?.budgetLevel),
      summaryAuditRequired: options.contextMeta?.summaryAuditRequired === true,
      averageMemoryQualityScore: normalizeNumber(options.contextMeta?.averageMemoryQualityScore, 0)
    },
    metadata: {
      chatId: normalizeString(options.chatId),
      providerId: normalizeString(options.providerId),
      modelId: normalizeString(options.modelId),
      contextMeta: options.contextMeta && typeof options.contextMeta === 'object'
        ? { ...options.contextMeta }
        : {}
    }
  })
}

export function buildDocumentTaskEvaluationRecord(options = {}) {
  const batchRecords = Array.isArray(options.batchRecords) ? options.batchRecords : []
  const validBatchCount = batchRecords.filter(item => item?.response?.valid === true).length
  const batchCount = batchRecords.length
  const operationCount = batchRecords.reduce((sum, item) => sum + (Array.isArray(item?.operations) ? item.operations.length : 0), 0)
  const writeTargetCount = Array.isArray(options.writeTargets) ? options.writeTargets.length : 0
  const pendingApply = options.pendingApply === true
  const batchScore = batchCount > 0 ? (validBatchCount / batchCount) : 0
  const executionScore = pendingApply
    ? 0.72
    : Math.min(1, (writeTargetCount > 0 ? 0.55 : 0.2) + (operationCount > 0 ? 0.25 : 0))
  const downgradePenalty = normalizeString(options.downgradeReason) ? 0.12 : 0
  const score = (((batchScore * 0.55) + (executionScore * 0.45)) - downgradePenalty) * 100
  const status = pendingApply ? 'preview-ready' : normalizeString(options.status, 'completed')
  const qualityGate = options.qualityGate && typeof options.qualityGate === 'object' ? options.qualityGate : {}
  const summary = pendingApply
    ? `文档任务已完成结构化预览，批次 ${validBatchCount}/${batchCount} 通过，待用户确认后写回。`
    : `文档任务已完成，批次 ${validBatchCount}/${batchCount} 通过，生成 ${writeTargetCount} 个写回目标。`
  return createEvaluationRecord({
    scenarioType: 'document',
    ownerType: 'task',
    ownerId: normalizeString(options.taskId),
    title: normalizeString(options.title, '文档任务评测'),
    status,
    score,
    summary,
    inputText: normalizeString(options.inputText),
    outputText: normalizeString(options.outputText || options.resultSummary),
    metrics: {
      batchCount,
      validBatchCount,
      operationCount,
      writeTargetCount,
      pendingApply,
      backupCreated: !!options.backupRef,
      downgradeReason: normalizeString(options.downgradeReason),
      qualityGateRiskLevel: normalizeString(qualityGate.riskLevel),
      estimatedCostUnits: Number(qualityGate.estimatedCostUnits || 0)
    },
    metadata: {
      assistantId: normalizeString(options.assistantId),
      documentAction: normalizeString(options.documentAction),
      launchSource: normalizeString(options.launchSource),
      qualityGate
    }
  })
}

export function buildAssistantVersionEvaluationRecord(record = {}) {
  const evaluation = record?.evaluation && typeof record.evaluation === 'object' ? record.evaluation : {}
  const score = evaluation?.totalScore ?? record?.benchmarkScore
  const releaseGate = evaluation?.releaseGate && typeof evaluation.releaseGate === 'object'
    ? evaluation.releaseGate
    : (record?.releaseGate && typeof record.releaseGate === 'object' ? record.releaseGate : {})
  return createEvaluationRecord({
    scenarioType: 'assistant',
    ownerType: 'assistant-version',
    ownerId: normalizeString(record?.versionId),
    title: normalizeString(record?.changeSummary, `助手版本 ${normalizeString(record?.version, '1.0.0')} 评测`),
    status: normalizeString(
      releaseGate?.allowed === false
        ? 'review'
        : evaluation?.recommendedAction,
      record?.isPromoted === true ? 'promoted' : 'published'
    ),
    score,
    sampleType: normalizeString(
      record?.sampleType
      || evaluation?.sampleType
      || (releaseGate?.allowed === false ? 'release-blocked' : 'release-ready')
    ),
    summary: normalizeString(
      evaluation?.summary,
      `${normalizeString(record?.assistantId, '助手')} 已记录版本 ${normalizeString(record?.version, '1.0.0')} 的评测结果。${releaseGate?.reason ? ` ${releaseGate.reason}` : ''}`
    ),
    inputPreview: normalizeString(record?.repairReason || record?.changeSummary),
    outputPreview: normalizeString(record?.snapshot?.description || record?.snapshot?.systemPrompt),
    metrics: {
      benchmarkScore: normalizeNumber(record?.benchmarkScore),
      realComparisonCount: normalizeNumber(evaluation?.realComparisonCount, 0),
      sampleCount: normalizeNumber(evaluation?.sampleCount, 0),
      samplePassRate: normalizeNumber(evaluation?.samplePassRate, 0),
      criticalFailureCount: normalizeNumber(evaluation?.criticalFailureCount, 0),
      regressionDetected: evaluation?.regressionDetected === true,
      healthScore: normalizeNumber(evaluation?.healthScore),
      releaseGateAllowed: releaseGate?.allowed === true,
      releaseGateReason: normalizeString(releaseGate?.reason),
      version: normalizeString(record?.version),
      isPromoted: record?.isPromoted === true
    },
    metadata: {
      assistantId: normalizeString(record?.assistantId),
      sourceAssistantIds: Array.isArray(record?.sourceAssistantIds) ? record.sourceAssistantIds.filter(Boolean) : [],
      releaseGate
    }
  })
}

