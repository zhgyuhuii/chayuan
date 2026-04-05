import { createArtifactRecord } from './artifactTypes.js'

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

export function mapProgressStageToTaskPhase(progressStage = '') {
  const normalized = normalizeString(progressStage)
  if (!normalized) return 'planning'
  if (['preparing', 'collecting', 'validating', 'local_validating'].includes(normalized)) return 'planning'
  if (['calling_model', 'parsing_result'].includes(normalized)) return 'planning'
  if (['collecting_params', 'collecting-params'].includes(normalized)) return 'collecting-params'
  if (['awaiting_confirmation', 'awaiting-confirmation', 'previewing'].includes(normalized)) return 'previewing'
  if (normalized === 'applying_result') return 'applying'
  if (normalized === 'completed') return 'completed'
  if (normalized === 'failed') return 'failed'
  if (normalized === 'cancelled') return 'cancelled'
  return normalized
}

export function buildTaskOrchestrationMeta(meta = {}) {
  const progressStage = normalizeString(meta.progressStage)
  return {
    entry: normalizeString(meta.entry, 'dialog'),
    primaryIntent: normalizeString(meta.primaryIntent, 'assistant-task'),
    executionMode: normalizeString(meta.executionMode, 'runner-task'),
    taskPhase: normalizeString(meta.taskPhase, mapProgressStageToTaskPhase(progressStage)),
    launchSource: normalizeString(meta.launchSource),
    strictAssistantDefaults: meta.strictAssistantDefaults === true,
    routeReason: normalizeString(meta.routeReason),
    routeConfidence: normalizeString(meta.routeConfidence),
    originMessageId: normalizeString(meta.originMessageId),
    originRequirementText: normalizeString(meta.originRequirementText)
  }
}

export function mergeTaskOrchestrationData(baseData = {}, meta = {}, extra = {}) {
  const nextProgressStage = normalizeString(extra.progressStage, normalizeString(baseData.progressStage))
  const orchestration = buildTaskOrchestrationMeta({
    ...baseData,
    ...meta,
    ...extra,
    progressStage: nextProgressStage
  })
  return {
    ...baseData,
    ...extra,
    ...orchestration,
    progressStage: nextProgressStage || baseData.progressStage || ''
  }
}

export function buildGeneratedArtifactDescriptor(item = {}) {
  return createArtifactRecord({
    id: normalizeString(item.id),
    kind: normalizeString(item.kind, 'file'),
    name: normalizeString(item.name || item.fileName || item.baseName),
    path: normalizeString(item.path || item.filePath || item.savePath),
    mimeType: normalizeString(item.mimeType),
    extension: normalizeString(item.extension),
    status: normalizeString(item.status, 'ready'),
    size: Number.isFinite(Number(item.size)) ? Number(item.size) : 0,
    ownerType: normalizeString(item.ownerType),
    ownerId: normalizeString(item.ownerId),
    route: normalizeString(item.route),
    downloadUrl: normalizeString(item.downloadUrl),
    textContent: typeof item.textContent === 'string' ? item.textContent : '',
    previewText: normalizeString(item.previewText),
    recognition: item.recognition && typeof item.recognition === 'object' ? item.recognition : null,
    parentArtifactIds: Array.isArray(item.parentArtifactIds) ? item.parentArtifactIds : [],
    rootArtifactId: normalizeString(item.rootArtifactId),
    retentionTier: normalizeString(item.retentionTier, 'standard')
  })
}
