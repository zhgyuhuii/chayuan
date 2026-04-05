import { canCreateDocumentBackup, createDocumentBackupRecord } from './documentBackupStore.js'
import { applyDocumentExecutionPlan } from './documentActions.js'
import { appendDocumentOperationBatch } from './documentOperationLedger.js'

function getPreviewText(text, maxLength = 220) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
}

function getPlanRange(plan) {
  const ranges = []
  ;(Array.isArray(plan?.operations) ? plan.operations : []).forEach((item) => {
    const start = Number(item?.start)
    const end = Number(item?.end)
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      ranges.push({ start, end })
    }
  })
  ;(Array.isArray(plan?.contentBlocks) ? plan.contentBlocks : []).forEach((item) => {
    const start = Number(item?.start)
    const end = Number(item?.end)
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      ranges.push({ start, end })
    }
  })
  if (ranges.length === 0) {
    const start = Number(plan?.documentContext?.rangeStart)
    const end = Number(plan?.documentContext?.rangeEnd)
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      ranges.push({ start, end })
    }
  }
  if (ranges.length === 0) return null
  return {
    start: Math.min(...ranges.map(item => item.start)),
    end: Math.max(...ranges.map(item => item.end))
  }
}

function buildExecutionPlanSummary(plan) {
  const summary = plan?.summary || {}
  const action = String(plan?.requestContext?.documentAction || '').trim()
  const previewBefore = getPreviewText(
    (Array.isArray(plan?.contentBlocks) ? plan.contentBlocks : [])
      .map(item => String(item?.inputText || '').trim())
      .filter(Boolean)
      .join('\n')
  )
  const previewAfter = getPreviewText(
    String(plan?.aggregatedContent || '').trim() ||
    (Array.isArray(plan?.contentBlocks) ? plan.contentBlocks : [])
      .map(item => String(item?.outputText || '').trim())
      .filter(Boolean)
      .join('\n')
  )
  return {
    action,
    batchCount: Number(summary.batchCount || 0),
    operationCount: Number(summary.operationCount || 0),
    resolvedOperationCount: Number(summary.resolvedOperationCount || 0),
    unresolvedOperationCount: Number(summary.unresolvedOperationCount || 0),
    invalidBatchCount: Number(summary.invalidBatchCount || 0),
    highQualityBatchCount: Number(summary.highQualityBatchCount || 0),
    mediumQualityBatchCount: Number(summary.mediumQualityBatchCount || 0),
    reviewQualityBatchCount: Number(summary.reviewQualityBatchCount || 0),
    highRiskBatchCount: Number(summary.highRiskBatchCount || 0),
    mediumRiskBatchCount: Number(summary.mediumRiskBatchCount || 0),
    previewBefore,
    previewAfter
  }
}

function buildApplyPolicy(plan) {
  const action = String(plan?.requestContext?.documentAction || '').trim()
  const summary = plan?.summary || {}
  const isWriteAction = ['replace', 'comment', 'comment-replace', 'insert-after', 'prepend', 'append', 'insert'].includes(action)
  const highRiskBatchCount = Number(summary.highRiskBatchCount || 0)
  const unresolvedOperationCount = Number(summary.unresolvedOperationCount || 0)
  const reviewQualityBatchCount = Number(summary.reviewQualityBatchCount || 0)
  return {
    canApply: isWriteAction,
    requiresConfirmation: isWriteAction,
    suggestedAction: action || 'none',
    shouldSuggestBackup: ['replace', 'comment-replace', 'insert-after', 'prepend', 'append', 'insert'].includes(action),
    shouldDegradeToComment: ['replace', 'comment-replace'].includes(action) &&
      highRiskBatchCount > 0 &&
      unresolvedOperationCount > 0 &&
      reviewQualityBatchCount > 0
  }
}

function buildBackupPolicy(plan, options = {}) {
  const applyPolicy = buildApplyPolicy(plan)
  const supported = canCreateDocumentBackup()
  const requested = options.backupRequested != null
    ? options.backupRequested === true
    : (supported && applyPolicy.shouldSuggestBackup)
  return {
    supported,
    allowUserToggle: supported && applyPolicy.requiresConfirmation,
    requested,
    reason: requested ? 'write-before-apply' : '',
    unavailableReason: supported ? '' : '当前文档尚未保存或宿主不支持文件系统复制，暂不支持源文件备份'
  }
}

function buildQualityGate(plan) {
  const summary = plan?.summary || {}
  const action = String(plan?.requestContext?.documentAction || '').trim()
  const batchCount = Number(summary.batchCount || 0)
  const highRiskBatchCount = Number(summary.highRiskBatchCount || 0)
  const unresolvedOperationCount = Number(summary.unresolvedOperationCount || 0)
  const reviewQualityBatchCount = Number(summary.reviewQualityBatchCount || 0)
  const estimatedCostUnits = Math.max(
    1,
    Number(summary.operationCount || 0) +
    Number(summary.batchCount || 0) * 2 +
    Number(summary.highRiskBatchCount || 0) * 4
  )
  const requiresGate = ['replace', 'comment-replace', 'insert-after', 'prepend', 'append', 'insert'].includes(action) &&
    (highRiskBatchCount > 0 || unresolvedOperationCount > 0 || batchCount >= 6)
  return {
    riskLevel: highRiskBatchCount > 0 ? 'high' : (reviewQualityBatchCount > 0 || batchCount >= 4 ? 'medium' : 'low'),
    estimatedCostUnits,
    batchCount,
    unresolvedOperationCount,
    reviewQualityBatchCount,
    requiresGate,
    recommendedPreviewOnly: requiresGate,
    recommendedRetry: reviewQualityBatchCount > 0 || unresolvedOperationCount > 0
  }
}

export function buildDocumentProcessingExecutionPlan(executionPlan, options = {}) {
  const basePlan = executionPlan && typeof executionPlan === 'object'
    ? JSON.parse(JSON.stringify(executionPlan))
    : {}
  const executionPlanSummary = buildExecutionPlanSummary(basePlan)
  const applyPolicy = buildApplyPolicy(basePlan)
  const backupPolicy = buildBackupPolicy(basePlan, options)
  const qualityGate = buildQualityGate(basePlan)
  const targetRange = getPlanRange(basePlan)
  return {
    ...basePlan,
    pipelineKind: 'document-processing',
    pipelineVersion: '2026-03-document-processing-v1',
    targetRange,
    preview: {
      beforeText: executionPlanSummary.previewBefore,
      afterText: executionPlanSummary.previewAfter
    },
    applyPolicy,
    backupPolicy,
    qualityGate,
    executionPlanSummary,
    artifacts: Array.isArray(basePlan?.artifacts) ? basePlan.artifacts : []
  }
}

export function applyDocumentProcessingPlan(plan, options = {}) {
  const normalizedPlan = plan && typeof plan === 'object' ? plan : {}
  const requestedAction = String(options.action || normalizedPlan?.requestContext?.documentAction || '').trim()
  const effectiveAction = normalizedPlan?.applyPolicy?.shouldDegradeToComment === true &&
    ['replace', 'comment-replace'].includes(requestedAction)
    ? 'comment'
    : requestedAction
  const backupRequested = options.backupRequested != null
    ? options.backupRequested === true
    : normalizedPlan?.backupPolicy?.requested === true
  let backupRef = null
  let backupError = ''
  if (backupRequested && normalizedPlan?.backupPolicy?.supported === true) {
    try {
      backupRef = createDocumentBackupRecord({
        taskId: options.taskId || normalizedPlan?.taskId || '',
        assistantId: options.assistantId || normalizedPlan?.assistantId || '',
        reason: options.backupReason || 'document-processing-apply',
        launchSource: options.launchSource || '',
        metadata: {
          action: String(options.action || normalizedPlan?.requestContext?.documentAction || '').trim(),
          summary: normalizedPlan?.executionPlanSummary || normalizedPlan?.summary || null
        }
      })
    } catch (error) {
      backupError = error?.message || String(error)
    }
  }

  const applyResult = applyDocumentExecutionPlan(normalizedPlan, {
    ...options,
    action: effectiveAction
  })
  const operationLedgerBatch = appendDocumentOperationBatch({
    taskId: options.taskId || normalizedPlan?.taskId || '',
    assistantId: options.assistantId || normalizedPlan?.assistantId || '',
    backupId: backupRef?.id || '',
    title: options.title || '文档操作账本',
    summary: applyResult?.message || '',
    action: effectiveAction,
    launchSource: options.launchSource || '',
    writeTargets: applyResult?.writeTargets,
    styleValidation: applyResult?.styleValidation,
    qualityGate: normalizedPlan?.qualityGate || {},
    planPreview: normalizedPlan?.preview || {},
    metadata: {
      downgradedFrom: effectiveAction !== requestedAction ? requestedAction : '',
      requestContext: normalizedPlan?.requestContext || null
    }
  })
  return {
    ...applyResult,
    downgradedFrom: effectiveAction !== requestedAction ? requestedAction : (applyResult?.downgradedFrom || ''),
    downgradeReason: effectiveAction !== requestedAction
      ? 'high_risk_batches_degraded_to_comment'
      : (applyResult?.downgradeReason || ''),
    backupRef,
    backupError,
    rollbackCandidate: backupRef
      ? {
          type: 'document-backup',
          backupId: backupRef.id,
          path: backupRef.backupPath
        }
      : null,
    operationLedgerBatch
  }
}
