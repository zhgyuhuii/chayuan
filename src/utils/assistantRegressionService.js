import { getFlatModelsFromSettings } from './modelSettings.js'
import {
  buildAssistantEvaluationSamples,
  buildAssistantRealComparison,
  evaluateAssistantCandidate
} from './assistantEvaluationService.js'
import { appendEvaluationRecord, createEvaluationRecord } from './evaluationStore.js'
import { getAssistantVersionById, listAssistantVersions } from './assistantVersionStore.js'
import { listRegressionSamples } from './assistantRegressionSampleStore.js'

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function pickRegressionModel() {
  return getFlatModelsFromSettings('chat')[0] || null
}

function getVersionSnapshot(record = {}) {
  return record?.snapshot && typeof record.snapshot === 'object' ? record.snapshot : {}
}

function getVersionFamilyList(assistantId = '') {
  return listAssistantVersions(assistantId)
    .slice()
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')))
}

export function findAssistantRegressionBaseline(candidateVersionId = '') {
  const candidate = getAssistantVersionById(candidateVersionId)
  if (!candidate?.assistantId) return null
  const family = getVersionFamilyList(candidate.assistantId)
  const index = family.findIndex(item => item.versionId === candidate.versionId)
  if (index <= 0) return null
  return family[index - 1] || null
}

function buildGoldenRegressionSamples(candidate = {}, baseline = {}, options = {}) {
  const assistantId = normalizeString(options.assistantId)
  const allStoredSamples = listRegressionSamples({})
  const assistantScopedSamples = assistantId
    ? allStoredSamples.filter(item => normalizeString(item.assistantId) === assistantId)
    : []
  const globalSamples = listRegressionSamples({ assistantId: '' }).filter(item => !item.assistantId)
  const seedSamples = buildAssistantEvaluationSamples({
    baseline,
    requirementText: options.requirementText,
    recentTranscript: options.recentTranscript,
    sourceAssistants: options.sourceAssistants || []
  })
  const genericSamples = [
    {
      label: '通用稳定性检查',
      source: 'golden',
      critical: true,
      inputText: normalizeString(options.requirementText, '请按既定角色与输出格式完成本次任务，并保留关键事实。'),
      expectedDocumentAction: normalizeString(candidate?.documentAction || baseline?.documentAction),
      expectedInputSource: normalizeString(candidate?.inputSource || baseline?.inputSource),
      expectedTargetLanguage: normalizeString(candidate?.targetLanguage || baseline?.targetLanguage),
      expectedOutputFormat: normalizeString(candidate?.outputFormat || baseline?.outputFormat)
    }
  ]
  const curatedSamples = [...assistantScopedSamples, ...globalSamples].map(item => ({
    label: normalizeString(item.label, '黄金样本'),
    groupKey: normalizeString(item.groupKey),
    riskLevel: normalizeString(item.riskLevel, 'medium'),
    source: normalizeString(item.source, 'golden'),
    critical: item.critical === true || normalizeString(item.riskLevel) === 'high',
    inputText: normalizeString(item.inputText),
    expectedDocumentAction: normalizeString(item.expectedDocumentAction),
    expectedInputSource: normalizeString(item.expectedInputSource),
    expectedTargetLanguage: normalizeString(item.expectedTargetLanguage),
    expectedOutputFormat: normalizeString(item.expectedOutputFormat),
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 8) : [],
    notes: normalizeString(item.notes)
  })).filter(item => item.inputText)
  return [...curatedSamples, ...genericSamples, ...seedSamples].slice(0, Math.max(3, Number(options.maxSamples || 6)))
}

export async function runAssistantVersionRegression(options = {}) {
  const candidate = getAssistantVersionById(options.candidateVersionId)
  if (!candidate?.versionId) {
    throw new Error('未找到待回归的候选版本')
  }
  const baseline = options.baselineVersionId
    ? getAssistantVersionById(options.baselineVersionId)
    : findAssistantRegressionBaseline(candidate.versionId)
  if (!baseline?.versionId) {
    throw new Error('未找到可用于对比的基线版本')
  }
  const candidateSnapshot = getVersionSnapshot(candidate)
  const baselineSnapshot = getVersionSnapshot(baseline)
  const model = options.model || pickRegressionModel()
  const samples = buildGoldenRegressionSamples(candidateSnapshot, baselineSnapshot, {
    assistantId: candidate?.assistantId,
    requirementText: options.requirementText || candidate?.repairReason || candidate?.changeSummary,
    recentTranscript: options.recentTranscript,
    sourceAssistants: options.sourceAssistants,
    maxSamples: options.maxSamples
  })
  const comparison = await buildAssistantRealComparison({
    baseline: baselineSnapshot,
    candidate: candidateSnapshot,
    model,
    samples,
    maxSamples: options.maxSamples || samples.length
  })
  const evaluation = evaluateAssistantCandidate(candidateSnapshot, {
    baseline: baselineSnapshot,
    samples,
    realComparisonResults: comparison.results
  })
  const failedSamples = evaluation.sampleResults.filter(item => item.ok !== true)
  const record = appendEvaluationRecord(createEvaluationRecord({
    scenarioType: 'assistant',
    ownerType: 'assistant-regression',
    ownerId: candidate.versionId,
    title: `版本双跑回归：${normalizeString(candidate.assistantId, '助手')} ${normalizeString(baseline.version, 'baseline')} -> ${normalizeString(candidate.version, 'candidate')}`,
    status: evaluation.releaseGate?.allowed === true ? 'completed' : 'review',
    score: evaluation.totalScore,
    sampleType: 'regression-suite',
    summary: evaluation.releaseGate?.allowed === true
      ? `候选版本已通过 ${samples.length} 个样本的双跑回归，可继续执行发布或晋升。`
      : `候选版本在双跑回归中存在 ${failedSamples.length} 个未通过样本，建议继续修正后再发布。`,
    inputText: normalizeString(candidate.repairReason || candidate.changeSummary),
    outputText: normalizeString(evaluation.summary),
    metrics: {
      sampleCount: evaluation.sampleCount,
      samplePassRate: evaluation.samplePassRate,
      criticalFailureCount: evaluation.criticalFailureCount,
      realComparisonCount: evaluation.realComparisonCount,
      healthScore: evaluation.healthScore,
      benchmarkScore: evaluation.totalScore,
      baselineAverageScore: comparison.averageBaselineScore,
      candidateAverageScore: comparison.averageCandidateScore,
      regressionDetected: evaluation.regressionDetected,
      releaseGateAllowed: evaluation.releaseGate?.allowed === true,
      releaseGateReason: normalizeString(evaluation.releaseGate?.reason),
      version: normalizeString(candidate.version)
    },
    metadata: {
      assistantId: normalizeString(candidate.assistantId),
      candidateVersionId: candidate.versionId,
      baselineVersionId: baseline.versionId,
      baselineVersion: normalizeString(baseline.version),
      candidateVersion: normalizeString(candidate.version),
      sampleResults: evaluation.sampleResults,
      regressionResults: comparison.results,
      releaseGate: evaluation.releaseGate,
      model: model
        ? {
          providerId: normalizeString(model.providerId),
          modelId: normalizeString(model.modelId),
          name: normalizeString(model.name || model.modelId || model.id)
        }
        : null
    }
  }))
  return {
    record,
    evaluation,
    comparison,
    baseline,
    candidate,
    samples
  }
}

export async function runAssistantFamilyRegression(options = {}) {
  const assistantId = normalizeString(options.assistantId)
  const candidateVersionId = normalizeString(options.candidateVersionId)
  const seedCandidate = candidateVersionId ? getAssistantVersionById(candidateVersionId) : null
  const familyAssistantId = assistantId || normalizeString(seedCandidate?.assistantId)
  if (!familyAssistantId) {
    throw new Error('未找到可批量回归的助手家族')
  }
  const family = listAssistantVersions(familyAssistantId)
    .slice()
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')))
  if (family.length < 2) {
    throw new Error('该助手家族版本数不足，无法执行批量回归')
  }
  const maxVersions = Math.max(1, Number(options.maxVersions || 3))
  const targets = family.slice(-Math.min(maxVersions, family.length)).filter((item, index, list) => index > 0 || family.length <= 1)
  const results = []
  for (const item of targets) {
    const baseline = findAssistantRegressionBaseline(item.versionId)
    if (!baseline?.versionId) continue
    const result = await runAssistantVersionRegression({
      candidateVersionId: item.versionId,
      baselineVersionId: baseline.versionId,
      maxSamples: options.maxSamples || 6
    })
    results.push(result)
  }
  return {
    assistantId: familyAssistantId,
    executedCount: results.length,
    results
  }
}
