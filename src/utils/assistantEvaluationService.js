import { chatCompletion } from './chatApi.js'

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
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

function computeCoverageScore(candidate = {}, baseline = {}) {
  const keys = ['modelType', 'outputFormat', 'documentAction', 'inputSource', 'targetLanguage']
  let matched = 0
  keys.forEach((key) => {
    if (normalizeString(candidate?.[key]) && normalizeString(candidate?.[key]) === normalizeString(baseline?.[key])) {
      matched += 1
    }
  })
  return matched / keys.length
}

function computePromptCompleteness(candidate = {}) {
  const pieces = [
    candidate?.description,
    candidate?.persona,
    candidate?.systemPrompt,
    candidate?.userPromptTemplate
  ].map(value => normalizeString(value)).filter(Boolean)
  return Math.min(1, pieces.join('\n').length / 600)
}

function interpolatePromptTemplate(template = '', variables = {}) {
  return String(template || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => normalizeString(variables?.[key]))
}

function truncatePreviewText(text = '', maxLength = 220) {
  const normalized = normalizeString(text)
  if (!normalized) return ''
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
}

export function buildAssistantHealthScore(evaluation = {}) {
  const totalScore = Math.max(0, Number(evaluation?.totalScore || 0))
  const realComparisonScore = Math.max(0, Number(evaluation?.realComparisonScore || 0))
  const sampleScore = Math.max(0, Number(evaluation?.sampleScore || 0))
  const healthScore = Math.round((totalScore * 0.55) + (realComparisonScore * 0.25) + (sampleScore * 0.2))
  return Math.max(0, Math.min(100, healthScore))
}

export function buildAssistantReleaseGate(evaluation = {}) {
  const totalScore = Math.max(0, Number(evaluation?.totalScore || 0))
  const realComparisonCount = Math.max(0, Number(evaluation?.realComparisonCount || 0))
  const healthScore = buildAssistantHealthScore(evaluation)
  const rawSamplePassRate = Math.max(0, Number(evaluation?.samplePassRate || 0))
  const samplePassRate = rawSamplePassRate > 1 ? Math.min(1, rawSamplePassRate / 100) : rawSamplePassRate
  const criticalFailureCount = Math.max(0, Number(evaluation?.criticalFailureCount || 0))
  const regressionDetected = evaluation?.regressionDetected === true
  const hasSampleGate = Math.max(0, Number(evaluation?.sampleCount || 0)) > 0
  const allowed = totalScore >= 72
    && healthScore >= 70
    && (!hasSampleGate || samplePassRate >= 0.66)
    && criticalFailureCount === 0
    && regressionDetected !== true
  return {
    allowed,
    healthScore,
    reason: allowed
      ? '评测与健康分达到发布阈值'
      : (
        criticalFailureCount > 0
          ? '关键样本未通过门禁，请继续修复后再发布'
          : regressionDetected
            ? '候选版本相对基线出现回归，暂不能发布'
            : (realComparisonCount > 0
                ? '真实样本对比、样本通过率或健康分未达门禁阈值'
                : '基础评测未达发布阈值')
      ),
    threshold: {
      minScore: 72,
      minHealthScore: 70,
      minSamplePassRate: 0.66,
      maxCriticalFailureCount: 0
    }
  }
}

function buildAssistantPromptPreview(assistant = {}, sample = {}) {
  const targetLanguage = normalizeString(
    sample?.expectedTargetLanguage,
    normalizeString(assistant?.targetLanguage, '中文')
  )
  const assistantName = normalizeString(assistant?.name, '智能助手')
  const inputText = normalizeString(sample?.inputText)
  const baseUserPrompt = normalizeString(assistant?.userPromptTemplate, '{{input}}')
  return {
    systemPrompt: normalizeString(assistant?.systemPrompt),
    userPrompt: interpolatePromptTemplate(baseUserPrompt, {
      input: inputText,
      targetLanguage,
      assistantName,
      reportType: normalizeString(sample?.expectedOutputFormat, '文本')
    }) || inputText,
    inputText
  }
}

async function requestAssistantPreviewOutput(assistant = {}, sample = {}, model = null) {
  const prompt = buildAssistantPromptPreview(assistant, sample)
  if (!model?.providerId || !model?.modelId) {
    return {
      output: '',
      prompt
    }
  }
  const messages = [
    prompt.systemPrompt ? { role: 'system', content: prompt.systemPrompt } : null,
    { role: 'user', content: prompt.userPrompt || prompt.inputText }
  ].filter(Boolean)
  const raw = await chatCompletion({
    providerId: model.providerId,
    modelId: model.modelId,
    temperature: 0.2,
    messages
  })
  return {
    output: normalizeString(raw),
    prompt
  }
}

export function buildAssistantCapabilityFingerprint(assistant = {}) {
  return {
    modelType: normalizeString(assistant.modelType),
    outputFormat: normalizeString(assistant.outputFormat),
    documentAction: normalizeString(assistant.documentAction),
    inputSource: normalizeString(assistant.inputSource),
    targetLanguage: normalizeString(assistant.targetLanguage),
    reportSettings: assistant.reportSettings && typeof assistant.reportSettings === 'object'
      ? JSON.parse(JSON.stringify(assistant.reportSettings))
      : null,
    mediaOptions: assistant.mediaOptions && typeof assistant.mediaOptions === 'object'
      ? JSON.parse(JSON.stringify(assistant.mediaOptions))
      : null
  }
}

export function buildAssistantEvaluationSamples(options = {}) {
  const samples = []
  const baseline = options.baseline || {}
  const sourceAssistants = Array.isArray(options.sourceAssistants) ? options.sourceAssistants : []
  const requirementText = normalizeString(options.requirementText)
  const recentTranscript = normalizeString(options.recentTranscript)
  if (requirementText) {
    samples.push({
      label: '当前用户需求',
      source: 'requirement',
      critical: true,
      inputText: requirementText,
      expectedDocumentAction: normalizeString(options.documentAction || baseline.documentAction),
      expectedInputSource: normalizeString(options.inputSource || baseline.inputSource),
      expectedTargetLanguage: normalizeString(options.targetLanguage || baseline.targetLanguage),
      expectedOutputFormat: normalizeString(options.outputFormat || baseline.outputFormat)
    })
  }
  if (recentTranscript) {
    samples.push({
      label: '最近会话上下文',
      source: 'transcript',
      critical: false,
      inputText: recentTranscript,
      expectedDocumentAction: normalizeString(baseline.documentAction),
      expectedInputSource: normalizeString(baseline.inputSource)
    })
  }
  sourceAssistants.forEach((assistant, index) => {
    const summaryText = [
      normalizeString(assistant?.name),
      normalizeString(assistant?.description),
      normalizeString(assistant?.persona),
      normalizeString(assistant?.systemPrompt),
      normalizeString(assistant?.userPromptTemplate)
    ].filter(Boolean).join('\n')
    if (!summaryText) return
    samples.push({
      label: `来源助手样本 ${index + 1}`,
      source: 'assistant',
      critical: index === 0,
      inputText: summaryText,
      expectedDocumentAction: normalizeString(assistant?.documentAction),
      expectedInputSource: normalizeString(assistant?.inputSource),
      expectedTargetLanguage: normalizeString(assistant?.targetLanguage),
      expectedOutputFormat: normalizeString(assistant?.outputFormat)
    })
  })
  return samples.slice(0, 6)
}

export async function buildAssistantRealComparison(options = {}) {
  const baseline = options.baseline || {}
  const candidate = options.candidate || {}
  const model = options.model || null
  const samples = Array.isArray(options.samples) && options.samples.length > 0
    ? options.samples
    : buildAssistantEvaluationSamples(options)
  const limitedSamples = samples.slice(0, Math.max(1, Number(options.maxSamples || 3)))
  if (!model?.providerId || !model?.modelId || limitedSamples.length === 0) {
    return {
      mode: 'heuristic',
      sampleCount: 0,
      averageBaselineScore: 0,
      averageCandidateScore: 0,
      results: []
    }
  }
  const results = []
  for (const sample of limitedSamples) {
    const [baselineResult, candidateResult] = await Promise.all([
      requestAssistantPreviewOutput(baseline, sample, model),
      requestAssistantPreviewOutput(candidate, sample, model)
    ])
    const baselineScore = computeTokenOverlap(sample?.inputText, baselineResult.output)
    const candidateScore = computeTokenOverlap(sample?.inputText, candidateResult.output)
    results.push({
      label: normalizeString(sample?.label, '对比样本'),
      source: normalizeString(sample?.source, 'sample'),
      inputText: normalizeString(sample?.inputText),
      baselinePromptPreview: truncatePreviewText(baselineResult.prompt?.userPrompt || baselineResult.prompt?.inputText),
      candidatePromptPreview: truncatePreviewText(candidateResult.prompt?.userPrompt || candidateResult.prompt?.inputText),
      baselineOutput: truncatePreviewText(baselineResult.output, 320),
      candidateOutput: truncatePreviewText(candidateResult.output, 320),
      baselineScore: Math.round(baselineScore * 100),
      candidateScore: Math.round(candidateScore * 100),
      winner: candidateScore >= baselineScore ? 'candidate' : 'baseline',
      summary: candidateScore >= baselineScore
        ? '新版本在同一输入下更贴近当前样本语义。'
        : '旧版本在该样本上仍更贴近当前样本语义。'
    })
  }
  const averageBaselineScore = results.length > 0
    ? results.reduce((sum, item) => sum + Number(item.baselineScore || 0), 0) / (results.length * 100)
    : 0
  const averageCandidateScore = results.length > 0
    ? results.reduce((sum, item) => sum + Number(item.candidateScore || 0), 0) / (results.length * 100)
    : 0
  return {
    mode: 'real-comparison',
    sampleCount: results.length,
    averageBaselineScore: Math.round(averageBaselineScore * 100),
    averageCandidateScore: Math.round(averageCandidateScore * 100),
    results
  }
}

function evaluateDryRunSample(sample = {}, candidate = {}, baseline = {}) {
  const promptText = [
    normalizeString(candidate?.description),
    normalizeString(candidate?.persona),
    normalizeString(candidate?.systemPrompt),
    normalizeString(candidate?.userPromptTemplate)
  ].filter(Boolean).join('\n')
  let score = 0
  if (sample.expectedDocumentAction && normalizeString(candidate?.documentAction) === sample.expectedDocumentAction) score += 0.22
  else if (sample.expectedDocumentAction && normalizeString(baseline?.documentAction) === sample.expectedDocumentAction) score += 0.08
  if (sample.expectedInputSource && normalizeString(candidate?.inputSource) === sample.expectedInputSource) score += 0.18
  else if (sample.expectedInputSource && normalizeString(baseline?.inputSource) === sample.expectedInputSource) score += 0.06
  if (sample.expectedTargetLanguage && normalizeString(candidate?.targetLanguage) === sample.expectedTargetLanguage) score += 0.16
  if (sample.expectedOutputFormat && normalizeString(candidate?.outputFormat) === sample.expectedOutputFormat) score += 0.14
  score += computeTokenOverlap(sample.inputText, promptText) * 0.3
  const normalizedScore = Math.max(0, Math.min(1, score))
  return {
    label: normalizeString(sample.label, 'dry-run sample'),
    source: normalizeString(sample.source, 'sample'),
    groupKey: normalizeString(sample.groupKey),
    riskLevel: normalizeString(sample.riskLevel, 'medium'),
    critical: sample?.critical === true,
    score: Math.round(normalizedScore * 100),
    ok: normalizedScore >= 0.55
  }
}

export function evaluateAssistantCandidate(candidate = {}, options = {}) {
  const baseline = options.baseline || {}
  const dryRunSamples = Array.isArray(options.samples) && options.samples.length > 0
    ? options.samples
    : buildAssistantEvaluationSamples(options)
  const coverageScore = computeCoverageScore(candidate, baseline)
  const promptScore = computePromptCompleteness(candidate)
  const sampleResults = dryRunSamples.map(sample => evaluateDryRunSample(sample, candidate, baseline))
  const sampleScore = sampleResults.length > 0
    ? sampleResults.reduce((sum, item) => sum + Number(item.score || 0), 0) / (sampleResults.length * 100)
    : 0.8
  const realComparisonResults = Array.isArray(options.realComparisonResults) ? options.realComparisonResults : []
  const realComparisonScore = realComparisonResults.length > 0
    ? realComparisonResults.reduce((sum, item) => sum + Number(item.candidateScore || 0), 0) / (realComparisonResults.length * 100)
    : 0
  const passedSampleCount = sampleResults.filter(item => item.ok).length
  const samplePassRate = sampleResults.length > 0 ? passedSampleCount / sampleResults.length : 1
  const criticalFailureCount = sampleResults.filter(item => item.critical === true && item.ok !== true).length
  const regressionDetected = realComparisonResults.length > 0
    ? realComparisonResults.filter(item => item.winner === 'baseline').length > Math.floor(realComparisonResults.length / 2)
    : false
  const totalScore = Number((realComparisonResults.length > 0
    ? ((coverageScore * 0.22) + (promptScore * 0.22) + (sampleScore * 0.18) + (realComparisonScore * 0.38))
    : ((coverageScore * 0.35) + (promptScore * 0.35) + (sampleScore * 0.3))) * 100)
  const releaseGate = buildAssistantReleaseGate({
    totalScore,
    realComparisonScore: Math.round(realComparisonScore * 100),
    sampleScore: Math.round(sampleScore * 100),
    realComparisonCount: realComparisonResults.length,
    sampleCount: sampleResults.length,
    samplePassRate,
    criticalFailureCount,
    regressionDetected
  })
  return {
    totalScore: Math.round(totalScore),
    coverageScore: Math.round(coverageScore * 100),
    promptScore: Math.round(promptScore * 100),
    sampleScore: Math.round(sampleScore * 100),
    realComparisonScore: Math.round(realComparisonScore * 100),
    realComparisonCount: realComparisonResults.length,
    sampleCount: sampleResults.length,
    samplePassRate: Math.round(samplePassRate * 100),
    criticalFailureCount,
    regressionDetected,
    healthScore: releaseGate.healthScore,
    releaseGate,
    sampleResults,
    realComparisonResults,
    fingerprint: buildAssistantCapabilityFingerprint(candidate),
    evaluationMode: realComparisonResults.length > 0 ? 'real-comparison' : 'heuristic',
    recommendedAction: releaseGate.allowed ? 'publish' : totalScore >= 65 ? 'review' : 'revise',
    summary: releaseGate.allowed
      ? (realComparisonResults.length > 0
          ? '候选版本已通过真实对比评测，可进入发布或提升默认版本流程。'
          : '候选版本通过基础评估，可进入发布或提升默认版本流程。')
      : (realComparisonResults.length > 0
          ? '候选版本在真实对比样本中仍有波动，建议继续修正后再发布。'
          : '候选版本需要继续补齐提示词、能力覆盖或 dry-run 样本后再发布。')
  }
}
