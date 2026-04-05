import { findIssueRangeDetailed } from './spellCheckService.js'
import {
  collectMatchPositions,
  mapChunkRelativeRangeToAbsolute,
  mapNormalizedRangeToRaw,
  normalizeTextWithIndexMap
} from './documentPositionUtils.js'
import {
  ANALYSIS_AI_TRACE_CHECK_ID,
  ANALYSIS_SECRET_KEYWORD_EXTRACT_ID,
  ANALYSIS_SECURITY_CHECK_ID,
  extractHitFragmentsFromSecurityCheckMarkdown,
  getStructuredJsonAnchorExtraRules
} from './structuredCommentPolicy.js'

export const STRUCTURED_PIPELINE_SCHEMA_VERSION = '2026-03-structured-batch-v1'

/** 仅内置「拼写与语法检查」需结构化 JSON 精确定位；「纠正拼写和语法」走与普通助手相同的单次/分段 plain 链路 */
const REVISION_ASSISTANTS = new Set([
  'spell-check'
])

const TRANSFORM_ASSISTANTS = new Set([
  'translate',
  'analysis.rewrite',
  'analysis.polish',
  'analysis.formalize',
  'analysis.simplify',
  'analysis.term-unify',
  'analysis.policy-style'
])

function safeJsonParse(text) {
  try {
    return JSON.parse(text)
  } catch (_) {
    return null
  }
}

export function extractJsonCandidate(text) {
  const raw = String(text || '').trim()
  if (!raw) return ''
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const objectMatch = raw.match(/\{[\s\S]*\}/)
  if (objectMatch) return objectMatch[0]
  const arrayMatch = raw.match(/\[[\s\S]*\]/)
  if (arrayMatch) return arrayMatch[0]
  return raw
}

export function getStructuredAssistantMode(assistantId) {
  const normalized = String(assistantId || '').trim()
  if (REVISION_ASSISTANTS.has(normalized)) return 'revision-edits'
  if (TRANSFORM_ASSISTANTS.has(normalized)) return 'transform-content'
  return 'analysis-content'
}

function getModeSpecificInstruction(mode, options = {}) {
  const targetLanguage = String(options.targetLanguage || '').trim()
  const documentAction = String(options.documentAction || '').trim()
  if (mode === 'revision-edits') {
    return [
      '当前任务以“识别问题并输出可执行编辑项”为主。',
      '若发现语言错误，请优先在 operations 中输出 replace 操作。',
      '每条 replace 操作都要尽量提供 originalText、replacementText、reason、prefix、suffix、sentence。',
      'start/end 为可选字段；如果你无法稳定给出坐标，可以留空，但 originalText 必须来自原文。',
      'content 字段仅用于给出一段简短汇总，不要把整段改写后的全文塞进 content。',
      '如果 originalText 含有换行、斜杠、编号、括号、全半角标点，必须逐字符照抄 chunkText 中的原文，不得自行规范化。',
      '若无法确认精确命中位置，请输出 comment 或把 confidence 设为 low，不要用整句兜底替换。'
    ].join('\n')
  }
  if (mode === 'transform-content') {
    return [
      '当前任务以“返回当前分段处理后的正文结果”为主。',
      targetLanguage ? `本批内容需要转换为 ${targetLanguage}。` : '请返回当前分段处理后的正文结果。',
      '请把主要结果放入 content 字段，并尽量保持原段落含义、结构、编号与事实准确。',
      'operations 可以为空数组；只有当你能稳定指出局部替换项时才填写。'
    ].join('\n')
  }
  return [
    '当前任务以“返回当前分段的结构化分析结果和可写回内容”为主。',
    '若适合直接写回文档，请将正文结果写入 content。',
    '若主要是分析、解释、总结、提取，请在 summary 中说明，在 content 中给出适合写回文档的结果。',
    'operations 通常可为空数组。'
  ].join('\n')
}

export function buildStructuredBatchInstruction(assistantId, options = {}) {
  const mode = getStructuredAssistantMode(assistantId)
  return [
    `你必须只输出一个合法 JSON 对象，schemaVersion 固定为 "${STRUCTURED_PIPELINE_SCHEMA_VERSION}"。`,
    '不要输出 Markdown，不要输出 JSON 之外的解释。',
    getModeSpecificInstruction(mode, options),
    getStructuredJsonAnchorExtraRules(assistantId, options.documentAction),
    '你将收到一个带 ChunkMeta / LineMap / ChunkText 的结构化原文块，所有定位都必须以 ChunkText 为唯一依据。',
    String(options.documentAction || '').trim() === 'replace'
      ? '当文档动作是 replace 时，只有在 originalText 可以从 ChunkText 中精确截取时才输出 replace；否则改为 comment。'
      : '',
    '统一 JSON 结构如下：',
    '{"schemaVersion":"","mode":"","summary":"","content":"","operations":[{"type":"replace|comment|insert-after|prepend|append|none","target":"absolute-range|chunk-relative-range|text-anchor|paragraph-range","start":0,"end":0,"originalText":"","replacementText":"","commentText":"","reason":"","suggestion":"","confidence":"high|medium|low","paragraphIndex":0,"prefix":"","suffix":"","sentence":""}]}',
    '若没有可执行操作，operations 返回 []；若没有正文结果，content 返回空字符串。'
  ].filter(Boolean).join('\n')
}

function normalizeConfidence(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (['high', 'medium', 'low'].includes(normalized)) return normalized
  return 'medium'
}

function normalizeOperationType(value, fallback = 'replace') {
  const normalized = String(value || '').trim().toLowerCase()
  if (['replace', 'comment', 'insert-after', 'prepend', 'append', 'none'].includes(normalized)) {
    return normalized
  }
  return fallback
}

function normalizeTarget(value, fallback = 'text-anchor') {
  const normalized = String(value || '').trim().toLowerCase()
  if (['absolute-range', 'chunk-relative-range', 'text-anchor', 'paragraph-range'].includes(normalized)) {
    return normalized
  }
  return fallback
}

function normalizeComparableAnchorText(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function getChunkParagraphSpan(chunk, paragraphIndex) {
  const normalizedParagraphIndex = Number(paragraphIndex)
  if (!Number.isFinite(normalizedParagraphIndex)) return null
  const entries = (Array.isArray(chunk?.relativeRangeMap) ? chunk.relativeRangeMap : [])
    .filter(item => Number(item?.paragraphIndex) === normalizedParagraphIndex)
  if (entries.length === 0) return null
  return {
    paragraphIndex: normalizedParagraphIndex,
    paragraphOrder: Number(entries[0]?.paragraphOrder || 0),
    chunkRelativeStart: Math.min(...entries.map(item => Number(item?.chunkRelativeStart || 0))),
    chunkRelativeEnd: Math.max(...entries.map(item => Number(item?.chunkRelativeEnd || 0))),
    absoluteStart: Math.min(...entries.map(item => Number(item?.absoluteStart || 0))),
    absoluteEnd: Math.max(...entries.map(item => Number(item?.absoluteEnd || 0))),
    paragraphPreview: String(entries[0]?.paragraphPreview || '').trim()
  }
}

function resolveParagraphScopedOperationRange(item, chunk, originalText) {
  const paragraphSpan = getChunkParagraphSpan(chunk, Number(item?.paragraphIndex))
  if (!paragraphSpan) return null
  if (!originalText) {
    return {
      start: paragraphSpan.absoluteStart,
      end: paragraphSpan.absoluteEnd,
      target: 'paragraph-range',
      paragraphSpan,
      matchedBy: 'paragraph-range-scope',
      validationHint: 'range_only'
    }
  }
  const paragraphChunkText = String(chunk?.normalizedText || chunk?.text || '').slice(
    paragraphSpan.chunkRelativeStart,
    paragraphSpan.chunkRelativeEnd
  )
  const anchorMatch = findIssueRangeDetailed(paragraphChunkText, {
    text: originalText,
    prefix: String(item?.prefix ?? ''),
    suffix: String(item?.suffix ?? ''),
    sentence: String(item?.sentence ?? '')
  })
  if (!anchorMatch?.ok || !anchorMatch.range) {
    return {
      start: paragraphSpan.absoluteStart,
      end: paragraphSpan.absoluteEnd,
      target: 'paragraph-range',
      paragraphSpan,
      matchedBy: 'paragraph-range-fallback',
      validationHint: 'paragraph_scope_only'
    }
  }
  const absoluteRange = mapChunkRelativeRangeToAbsolute(
    chunk,
    paragraphSpan.chunkRelativeStart + Number(anchorMatch.range.start || 0),
    paragraphSpan.chunkRelativeStart + Number(anchorMatch.range.end || 0)
  )
  if (!absoluteRange) return null
  return {
    start: Number(absoluteRange.start || 0),
    end: Number(absoluteRange.end || 0),
    target: 'paragraph-range',
    paragraphSpan,
    matchedBy: 'paragraph-range-anchor',
    validationHint: 'exact'
  }
}

function validateOperationResolution(chunk, originalText, resolvedStart, resolvedEnd) {
  if (!Number.isFinite(resolvedStart) || !Number.isFinite(resolvedEnd) || resolvedEnd <= resolvedStart) {
    return {
      status: 'unresolved',
      ok: false,
      exactTextMatch: false,
      message: '未解析出可用坐标'
    }
  }
  const chunkStart = Number(chunk?.start || 0)
  const chunkEnd = Number(chunk?.end || 0)
  if (resolvedStart < chunkStart || resolvedEnd > chunkEnd) {
    return {
      status: 'out_of_chunk',
      ok: false,
      exactTextMatch: false,
      message: '定位结果超出当前分块范围'
    }
  }
  if (!String(originalText || '').length) {
    return {
      status: 'range_only',
      ok: true,
      exactTextMatch: false,
      message: '仅验证坐标范围'
    }
  }
  const rawChunkText = String(chunk?.text || chunk?.rawText || '')
  const slice = rawChunkText.slice(resolvedStart - chunkStart, resolvedEnd - chunkStart)
  if (slice === String(originalText || '')) {
    return {
      status: 'exact',
      ok: true,
      exactTextMatch: true,
      matchedText: slice,
      message: '原文锚点与分块文本完全一致'
    }
  }
  if (normalizeComparableAnchorText(slice) === normalizeComparableAnchorText(originalText)) {
    return {
      status: 'normalized',
      ok: true,
      exactTextMatch: false,
      matchedText: slice,
      message: '原文锚点经换行归一化后匹配'
    }
  }
  return {
    status: 'mismatch',
    ok: false,
    exactTextMatch: false,
    matchedText: slice,
    message: '模型返回的原文锚点与当前分块不一致'
  }
}

function normalizeOperation(raw, chunk, index = 0) {
  const item = raw && typeof raw === 'object' ? raw : {}
  const originalText = String(
    item.originalText ?? item.text ?? item.sourceText ?? ''
  )
  const replacementText = String(
    item.replacementText ?? item.suggestion ?? item.outputText ?? item.content ?? ''
  )
  const absoluteRange = normalizeTarget(item.target, '') === 'absolute-range'
    ? {
        start: Number(item.start),
        end: Number(item.end)
      }
    : null
  const relativeRange = normalizeTarget(item.target, '') === 'chunk-relative-range'
    ? mapChunkRelativeRangeToAbsolute(chunk, Number(item.start), Number(item.end))
    : null
  const paragraphRange = normalizeTarget(item.target, '') === 'paragraph-range'
    ? resolveParagraphScopedOperationRange(item, chunk, originalText)
    : null
  let resolvedStart = Number.NaN
  let resolvedEnd = Number.NaN
  let target = normalizeTarget(item.target, originalText ? 'text-anchor' : 'paragraph-range')
  if (absoluteRange && Number.isFinite(absoluteRange.start) && Number.isFinite(absoluteRange.end)) {
    resolvedStart = absoluteRange.start
    resolvedEnd = absoluteRange.end
  } else if (relativeRange) {
    resolvedStart = relativeRange.start
    resolvedEnd = relativeRange.end
  } else if (paragraphRange) {
    resolvedStart = paragraphRange.start
    resolvedEnd = paragraphRange.end
    target = paragraphRange.target
  } else if (originalText) {
    const anchorMatch = findIssueRangeDetailed(String(chunk?.normalizedText || chunk?.text || ''), {
      text: originalText,
      prefix: String(item.prefix ?? ''),
      suffix: String(item.suffix ?? ''),
      sentence: String(item.sentence ?? '')
    })
    if (anchorMatch?.ok && anchorMatch.range) {
      resolvedStart = Number(chunk?.start || 0) + Number(anchorMatch.range.start || 0)
      resolvedEnd = Number(chunk?.start || 0) + Number(anchorMatch.range.end || 0)
    }
    target = 'text-anchor'
  }
  const validation = validateOperationResolution(chunk, originalText, resolvedStart, resolvedEnd)
  return {
    operationId: String(item.operationId || '').trim() || `op_${Number(chunk?.index || 0)}_${index + 1}`,
    type: normalizeOperationType(item.type, originalText ? 'replace' : 'none'),
    target,
    start: Number.isFinite(resolvedStart) ? resolvedStart : null,
    end: Number.isFinite(resolvedEnd) ? resolvedEnd : null,
    originalText: originalText.trim(),
    replacementText: replacementText.trim(),
    commentText: String(item.commentText ?? item.comment ?? '').trim(),
    reason: String(item.reason ?? '').trim(),
    suggestion: String(item.suggestion ?? '').trim(),
    confidence: normalizeConfidence(item.confidence),
    paragraphIndex: Number.isFinite(Number(item.paragraphIndex)) ? Number(item.paragraphIndex) : Number(chunk?.index || 0),
    prefix: String(item.prefix ?? '').trim(),
    suffix: String(item.suffix ?? '').trim(),
    sentence: String(item.sentence ?? '').trim(),
    chunkIndex: Number(chunk?.index || 0),
    chunkStart: Number(chunk?.start || 0),
    chunkEnd: Number(chunk?.end || 0),
    chunkText: String(chunk?.text || ''),
    paragraphSpan: paragraphRange?.paragraphSpan || null,
    matchedBy: String(paragraphRange?.matchedBy || item?.matchedBy || ''),
    chunkParagraphRefs: Array.isArray(chunk?.paragraphRefs) ? chunk.paragraphRefs : [],
    validationStatus: validation.status,
    validationMessage: validation.message,
    exactTextMatch: validation.exactTextMatch === true,
    matchedText: String(validation?.matchedText || ''),
    resolved: validation.ok === true
  }
}

function normalizeRevisionBatch(parsed, chunk) {
  const issues = Array.isArray(parsed?.issues) ? parsed.issues : []
  const operations = Array.isArray(parsed?.operations) && parsed.operations.length > 0
    ? parsed.operations.map((item, index) => normalizeOperation(item, chunk, index))
    : issues.map((issue, index) => normalizeOperation({
      type: 'replace',
      target: 'text-anchor',
      originalText: issue?.text,
      replacementText: issue?.suggestion,
      reason: issue?.reason,
      suggestion: issue?.suggestion,
      prefix: issue?.prefix,
      suffix: issue?.suffix,
      sentence: issue?.sentence,
      confidence: issue?.qualityLevel || 'high'
    }, chunk, index))
  return {
    schemaVersion: parsed?.schemaVersion || STRUCTURED_PIPELINE_SCHEMA_VERSION,
    mode: 'revision-edits',
    summary: String(parsed?.summary || '').trim(),
    content: String(parsed?.content || '').trim(),
    operations,
    issues
  }
}

function isTooShortKeywordTermForMultiMatch(term) {
  const t = String(term || '').trim()
  if (t.length <= 2) return true
  return /^[\p{P}\p{S}]+$/u.test(t)
}

/**
 * 与涉密关键词相同：在分块内为同一 originalText 的每一处出现各生成一条 absolute-range 批注（短/歧义项单次 text-anchor）。
 */
function expandCommentAnchorRawAllMatches(raw, chunk, opIndexStart) {
  const term = String(raw.originalText || '').trim()
  const chunkText = String(chunk?.text || chunk?.rawText || chunk?.normalizedText || '')
  const chunkStart = Number(chunk?.start || 0)
  const operations = []
  let opIndex = opIndexStart
  let expanded = false
  if (chunkText && term && !isTooShortKeywordTermForMultiMatch(term)) {
    try {
      const normalizedChunk = normalizeTextWithIndexMap(chunkText)
      const nt = normalizeTextWithIndexMap(term).normalized
      if (nt) {
        const positions = collectMatchPositions(normalizedChunk.normalized, nt)
        if (positions.length > 0) {
          positions.forEach((pos) => {
            const rawRange = mapNormalizedRangeToRaw(
              { start: pos, end: pos + nt.length },
              normalizedChunk
            )
            if (!rawRange || Number(rawRange.end || 0) <= Number(rawRange.start || 0)) return
            operations.push(
              normalizeOperation(
                {
                  ...raw,
                  target: 'absolute-range',
                  start: chunkStart + Number(rawRange.start || 0),
                  end: chunkStart + Number(rawRange.end || 0)
                },
                chunk,
                opIndex
              )
            )
            opIndex += 1
          })
          expanded = true
        }
      }
    } catch (_) {}
  }
  if (!expanded) {
    operations.push(normalizeOperation(raw, chunk, opIndex))
    opIndex += 1
  }
  return { operations, nextIndex: opIndex }
}

function buildSecurityCheckOperationsFromSummaryMarkdown(parsed, chunk) {
  const md = [parsed?.summary, parsed?.content, parsed?.analysis]
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .join('\n')
  const frags = extractHitFragmentsFromSecurityCheckMarkdown(md)
  if (frags.length === 0) return []
  let opIndex = 0
  const acc = []
  for (const originalText of frags) {
    const raw = {
      type: 'comment',
      target: 'text-anchor',
      originalText,
      commentText: '【保密检查】此处为审查命中片段。风险级别、依据与处理建议请查看任务清单中的完整报告。',
      confidence: 'high'
    }
    const { operations, nextIndex } = expandCommentAnchorRawAllMatches(raw, chunk, opIndex)
    acc.push(...operations)
    opIndex = nextIndex
  }
  return acc
}

function buildAiTraceCheckOperationsFromSummaryMarkdown(parsed, chunk) {
  const md = [parsed?.summary, parsed?.content, parsed?.analysis]
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .join('\n')
  const frags = extractHitFragmentsFromSecurityCheckMarkdown(md)
  if (frags.length === 0) return []
  let opIndex = 0
  const acc = []
  for (const originalText of frags) {
    const raw = {
      type: 'comment',
      target: 'text-anchor',
      originalText,
      commentText:
        '【AI 痕迹检查】此处为模型标出的疑似 AI 生成痕迹片段。具体类型、依据与改写建议请查看任务清单中的完整报告。',
      confidence: 'medium'
    }
    const { operations, nextIndex } = expandCommentAnchorRawAllMatches(raw, chunk, opIndex)
    acc.push(...operations)
    opIndex = nextIndex
  }
  return acc
}

function mapSecretKeywordRiskToConfidence(riskLevel) {
  const r = String(riskLevel || '').trim().toLowerCase()
  if (r === 'high') return 'high'
  if (r === 'medium') return 'medium'
  if (r === 'low') return 'low'
  return 'medium'
}

/**
 * 涉密关键词助手返回的是 keywords[] 而非 operations[]；为每条关键词合成 text-anchor 批注操作，
 * 以便 applyStructuredEditOperations 按词定位并添加批注，避免整篇兜底批注里出现 plan.summary 的 JSON。
 */
function buildSecretKeywordOperationRaw(keywordEntry) {
  const kw = keywordEntry && typeof keywordEntry === 'object' ? keywordEntry : {}
  const term = String(kw.term ?? kw.text ?? '').trim()
  if (!term) return null
  const category = String(kw.category || '').trim()
  const riskLevel = String(kw.riskLevel || '').trim()
  const reason = String(kw.reason || '').trim()
  const replacementToken = String(kw.replacementToken || '').trim()
  const metaParts = ['【涉密关键词】']
  if (category) metaParts.push(`类别：${category}`)
  if (riskLevel) metaParts.push(`风险：${riskLevel}`)
  const commentText = metaParts.join(' ')
  const raw = {
    type: 'comment',
    target: 'text-anchor',
    originalText: term,
    commentText,
    reason,
    confidence: mapSecretKeywordRiskToConfidence(riskLevel)
  }
  if (replacementToken) {
    raw.replacementText = replacementToken
    raw.suggestion = replacementToken
  }
  return raw
}

/**
 * 每个关键词在分块内所有出现位置各生成一条 absolute-range 批注操作（与归一化文本一致）；
 * 过短/歧义项仍走单次 text-anchor 的 normalizeOperation。
 */
function buildSecretKeywordOperationsFromKeywords(parsed, chunk) {
  const keywords = Array.isArray(parsed?.keywords) ? parsed.keywords : []
  if (keywords.length === 0) return []
  const operations = []
  let opIndex = 0
  for (const kw of keywords) {
    const raw = buildSecretKeywordOperationRaw(kw)
    if (!raw) continue
    const { operations: batch, nextIndex } = expandCommentAnchorRawAllMatches(raw, chunk, opIndex)
    operations.push(...batch)
    opIndex = nextIndex
  }
  return operations
}

function normalizeGenericBatch(parsed, chunk, assistantId) {
  let operations = Array.isArray(parsed?.operations)
    ? parsed.operations.map((item, index) => normalizeOperation(item, chunk, index))
    : []
  if (assistantId === ANALYSIS_SECURITY_CHECK_ID && operations.length === 0) {
    const synth = buildSecurityCheckOperationsFromSummaryMarkdown(parsed, chunk)
    if (synth.length > 0) operations = synth
  }
  if (assistantId === ANALYSIS_AI_TRACE_CHECK_ID && operations.length === 0) {
    const synth = buildAiTraceCheckOperationsFromSummaryMarkdown(parsed, chunk)
    if (synth.length > 0) operations = synth
  }
  if (
    assistantId === ANALYSIS_SECRET_KEYWORD_EXTRACT_ID &&
    operations.length === 0 &&
    Array.isArray(parsed?.keywords) &&
    parsed.keywords.length > 0
  ) {
    operations = buildSecretKeywordOperationsFromKeywords(parsed, chunk)
  }
  const fallbackContent = parsed?.content ?? parsed?.outputText ?? parsed?.rewrittenText ?? parsed?.translation ?? parsed?.result ?? ''
  return {
    schemaVersion: parsed?.schemaVersion || STRUCTURED_PIPELINE_SCHEMA_VERSION,
    mode: parsed?.mode || getStructuredAssistantMode(assistantId),
    summary: String(parsed?.summary || parsed?.analysis || '').trim(),
    content: String(fallbackContent || '').trim(),
    operations,
    parsed
  }
}

export function parseStructuredBatchResponse(raw, assistantId, chunk) {
  const candidate = extractJsonCandidate(raw)
  const parsed = safeJsonParse(candidate)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      raw: String(raw || ''),
      candidate,
      parsed: null,
      error: '模型未返回合法 JSON 对象'
    }
  }
  const normalized = getStructuredAssistantMode(assistantId) === 'revision-edits'
    ? normalizeRevisionBatch(parsed, chunk)
    : normalizeGenericBatch(parsed, chunk, assistantId)
  normalized.riskProfile = chunk?.riskProfile || null
  return {
    valid: true,
    raw: String(raw || ''),
    candidate,
    parsed: normalized,
    error: ''
  }
}

export function assessStructuredBatchQuality(parsedResponse, assistantId) {
  const qualityReasonLabelMap = {
    invalid_json: '结构化 JSON 解析失败',
    anchor_mismatch: '原文锚点与分块不一致',
    all_operations_unresolved: '操作都未能稳定定位',
    empty_output: '模型未返回可用结果',
    partial_unresolved_operations: '部分操作未稳定定位',
    normalized_only_anchor_match: '仅依赖归一化匹配，缺少精确命中',
    summary_without_content: '只有摘要，没有可写回内容',
    high_risk_chunk_without_exact_match: '高风险文本缺少精确命中',
    high_risk_chunk_requires_exact_match: '高风险文本必须精确命中后才能写回',
    table_like_chunk_review_required: '疑似表格内容需要人工复核',
    medium_risk_chunk_with_unresolved_ops: '中风险文本存在未稳定定位项',
    anchor_only_comment_unresolved: '批注类任务：命中片段/关键词未能在本分块正文中定位，请核对是否与原文逐字一致'
  }
  const fallback = {
    level: 'review',
    shouldRetry: true,
    reasonCodes: ['invalid_json'],
    reasonLabels: ['结构化 JSON 解析失败'],
    message: '结构化 JSON 无法解析',
    resolvedOperationCount: 0,
    mismatchedOperationCount: 0
  }
  if (!parsedResponse?.valid || !parsedResponse?.parsed) return fallback
  const mode = getStructuredAssistantMode(assistantId)
  const operations = Array.isArray(parsedResponse?.parsed?.operations) ? parsedResponse.parsed.operations : []
  const riskProfile = parsedResponse?.parsed?.riskProfile || null
  const content = String(parsedResponse?.parsed?.content || '').trim()
  const summary = String(parsedResponse?.parsed?.summary || '').trim()
  const apiRoot = parsedResponse?.parsed?.parsed && typeof parsedResponse.parsed.parsed === 'object'
    ? parsedResponse.parsed.parsed
    : null
  const keywordListLen = apiRoot && Array.isArray(apiRoot.keywords) ? apiRoot.keywords.length : 0
  const resolvedOperationCount = operations.filter(item => item?.resolved === true).length
  const mismatchedOperationCount = operations.filter(item => String(item?.validationStatus || '') === 'mismatch').length
  const unresolvedOperationCount = operations.length - resolvedOperationCount
  const exactOperationCount = operations.filter(item => String(item?.validationStatus || '') === 'exact').length
  const normalizedOperationCount = operations.filter(item => String(item?.validationStatus || '') === 'normalized').length
  const reasonCodes = []
  let level = 'high'
  let shouldRetry = false

  if (mismatchedOperationCount > 0) {
    level = 'review'
    shouldRetry = true
    reasonCodes.push('anchor_mismatch')
  }
  if (operations.length > 0 && resolvedOperationCount === 0) {
    if (mode !== 'revision-edits') {
      level = 'medium'
      shouldRetry = false
      reasonCodes.push('anchor_only_comment_unresolved')
    } else {
      level = 'review'
      shouldRetry = true
      reasonCodes.push('all_operations_unresolved')
    }
  }
  if (!content && !summary && operations.length === 0) {
    level = 'review'
    shouldRetry = true
    reasonCodes.push('empty_output')
  }
  if (level !== 'review' && unresolvedOperationCount > 0) {
    level = 'medium'
    reasonCodes.push('partial_unresolved_operations')
  }
  if (level !== 'review' && normalizedOperationCount > 0 && exactOperationCount === 0 && mode === 'revision-edits') {
    level = 'medium'
    reasonCodes.push('normalized_only_anchor_match')
  }
  if (mode !== 'revision-edits' && !content && summary) {
    const skipSummaryOnlyFlag =
      operations.length > 0 ||
      (assistantId === ANALYSIS_SECRET_KEYWORD_EXTRACT_ID && keywordListLen > 0)
    if (!skipSummaryOnlyFlag) {
      level = 'medium'
      reasonCodes.push('summary_without_content')
    }
  }
  if (riskProfile?.level === 'high') {
    if (level === 'high' && operations.length > 0 && exactOperationCount === 0) {
      level = 'medium'
      reasonCodes.push('high_risk_chunk_without_exact_match')
    }
    if (mode === 'revision-edits' && normalizedOperationCount > 0 && exactOperationCount === 0) {
      level = 'review'
      shouldRetry = true
      reasonCodes.push('high_risk_chunk_requires_exact_match')
    }
    if (Array.isArray(riskProfile?.reasonCodes) && riskProfile.reasonCodes.includes('table_like_text') && operations.length > 0) {
      level = 'review'
      shouldRetry = true
      reasonCodes.push('table_like_chunk_review_required')
    }
  } else if (riskProfile?.level === 'medium' && level === 'high' && unresolvedOperationCount > 0) {
    level = 'medium'
    reasonCodes.push('medium_risk_chunk_with_unresolved_ops')
  }

  const message = reasonCodes.length > 0
    ? reasonCodes.map(code => qualityReasonLabelMap[code] || code).join('；')
    : level === 'high'
      ? '结构化结果质量高'
      : level === 'medium'
        ? '结构化结果可用但建议关注'
        : '结构化结果质量不足'

  return {
    level,
    shouldRetry,
    reasonCodes,
    reasonLabels: reasonCodes.map(code => qualityReasonLabelMap[code] || code),
    message,
    resolvedOperationCount,
    mismatchedOperationCount,
    unresolvedOperationCount,
    exactOperationCount,
    normalizedOperationCount,
    riskProfile
  }
}

function buildOperationKey(operation) {
  return [
    String(operation?.type || ''),
    Number(operation?.start || 0),
    Number(operation?.end || 0),
    String(operation?.originalText || ''),
    String(operation?.replacementText || ''),
    String(operation?.commentText || '')
  ].join('::')
}

function getOperationValidationRank(operation) {
  const map = {
    exact: 6,
    normalized: 5,
    range_only: 4,
    paragraph_scope_only: 2,
    unresolved: 1,
    out_of_chunk: 0,
    mismatch: -1
  }
  return map[String(operation?.validationStatus || '').trim()] ?? 0
}

function getOperationConfidenceRank(operation) {
  const map = { high: 3, medium: 2, low: 1 }
  return map[String(operation?.confidence || '').trim()] ?? 0
}

function getOperationTargetRank(operation) {
  const map = {
    'absolute-range': 4,
    'chunk-relative-range': 3,
    'text-anchor': 3,
    'paragraph-range': 1
  }
  return map[String(operation?.target || '').trim()] ?? 0
}

function getOperationTypeRank(operation) {
  const map = {
    replace: 4,
    'comment-replace': 3,
    comment: 2,
    'insert-after': 1,
    prepend: 1,
    append: 1,
    none: 0
  }
  return map[String(operation?.type || '').trim()] ?? 0
}

function getOperationPriorityScore(operation) {
  const start = Number(operation?.start || 0)
  const end = Number(operation?.end || 0)
  const rangeLength = Math.max(0, end - start)
  const precisionScore = Math.max(0, 60 - Math.min(rangeLength, 240) / 4)
  const matchedBy = String(operation?.matchedBy || '').trim()
  const matchedByBonus = matchedBy === 'paragraph-range-anchor'
    ? 20
    : matchedBy === 'paragraph-range-fallback'
      ? -20
      : matchedBy === 'paragraph-range-scope'
        ? -10
        : 10
  return (
    getOperationValidationRank(operation) * 100 +
    getOperationConfidenceRank(operation) * 20 +
    getOperationTargetRank(operation) * 12 +
    getOperationTypeRank(operation) * 8 +
    (operation?.exactTextMatch === true ? 18 : 0) +
    matchedByBonus +
    precisionScore
  )
}

function rangesOverlap(left, right) {
  const leftStart = Number(left?.start || 0)
  const leftEnd = Number(left?.end || 0)
  const rightStart = Number(right?.start || 0)
  const rightEnd = Number(right?.end || 0)
  return leftEnd > rightStart && rightEnd > leftStart
}

function arbitrateStructuredOperations(operations) {
  const candidates = (Array.isArray(operations) ? operations : []).map((operation) => ({
    ...operation,
    arbitrationScore: getOperationPriorityScore(operation),
    arbitrationStatus: 'pending',
    arbitrationReason: '',
    conflictWithOperationId: ''
  }))
  const sorted = candidates
    .slice()
    .sort((left, right) => {
      const scoreDiff = Number(right?.arbitrationScore || 0) - Number(left?.arbitrationScore || 0)
      if (scoreDiff !== 0) return scoreDiff
      const startDiff = Number(left?.start || 0) - Number(right?.start || 0)
      if (startDiff !== 0) return startDiff
      return Number(left?.end || 0) - Number(right?.end || 0)
    })
  const selected = []
  const rejected = []
  sorted.forEach((operation) => {
    if (operation?.resolved !== true) {
      rejected.push({
        ...operation,
        arbitrationStatus: 'rejected',
        arbitrationReason: 'unresolved_operation'
      })
      return
    }
    const conflict = selected.find(item => rangesOverlap(item, operation))
    if (conflict) {
      rejected.push({
        ...operation,
        arbitrationStatus: 'rejected',
        arbitrationReason: 'range_conflict',
        conflictWithOperationId: String(conflict?.operationId || '').trim()
      })
      return
    }
    selected.push({
      ...operation,
      arbitrationStatus: 'selected',
      arbitrationReason: 'selected_best_candidate'
    })
  })
  const selectedById = new Map(selected.map(item => [String(item.operationId || ''), item]))
  return {
    selectedOperations: candidates.map(item => selectedById.get(String(item.operationId || ''))).filter(Boolean),
    rejectedOperations: rejected,
    summary: {
      selectedOperationCount: selected.length,
      rejectedOperationCount: rejected.length,
      unresolvedRejectedCount: rejected.filter(item => item.arbitrationReason === 'unresolved_operation').length,
      conflictRejectedCount: rejected.filter(item => item.arbitrationReason === 'range_conflict').length
    }
  }
}

export function buildBatchRecord({
  taskId,
  assistantId,
  batchIndex,
  chunk,
  request,
  llmChatRequest = null,
  rawResponse,
  parsedResponse,
  retryCount = 0,
  error = '',
  quality = null,
  strategyTrace = []
}) {
  return {
    taskId,
    assistantId,
    batchIndex: Number(batchIndex || 0),
    llmChatRequest: llmChatRequest && typeof llmChatRequest === 'object' ? llmChatRequest : null,
    inputSource: String(request?.inputSource || '').trim(),
    chunk: {
      index: Number(chunk?.index || 0),
      start: Number(chunk?.start || 0),
      end: Number(chunk?.end || 0),
      rawText: String(chunk?.text || ''),
      normalizedText: String(chunk?.normalizedText || chunk?.text || ''),
      riskProfile: chunk?.riskProfile || null,
      paragraphRefs: Array.isArray(chunk?.paragraphRefs) ? chunk.paragraphRefs : [],
      relativeRangeMap: Array.isArray(chunk?.relativeRangeMap) ? chunk.relativeRangeMap : []
    },
    request: {
      schemaVersion: STRUCTURED_PIPELINE_SCHEMA_VERSION,
      assistantMode: getStructuredAssistantMode(assistantId),
      documentAction: String(request?.documentAction || '').trim(),
      targetLanguage: String(request?.targetLanguage || '').trim(),
      requirementText: String(request?.requirementText || '').trim(),
      modelId: String(request?.modelId || '').trim(),
      inputSource: String(request?.inputSource || '').trim(),
      chunkLength: Number(request?.chunkLength || 0),
      overlapLength: Number(request?.overlapLength || 0),
      splitStrategy: String(request?.splitStrategy || '').trim()
    },
    response: {
      raw: String(rawResponse || ''),
      parsed: parsedResponse?.parsed || null,
      valid: parsedResponse?.valid === true,
      error: String(error || parsedResponse?.error || '').trim(),
      retryCount: Number(retryCount || 0),
      quality: quality && typeof quality === 'object' ? quality : null,
      strategyTrace: Array.isArray(strategyTrace) ? strategyTrace : []
    },
    operations: Array.isArray(parsedResponse?.parsed?.operations) ? parsedResponse.parsed.operations : []
  }
}

export function buildStructuredExecutionPlan({
  taskId,
  assistantId,
  taskTitle,
  documentAction,
  inputInfo,
  chunks,
  batchRecords,
  requirementText,
  targetLanguage,
  configuredInputSource,
  chunkSettings,
  chunkWriteMode = 'paragraph-body'
}) {
  const records = Array.isArray(batchRecords) ? batchRecords : []
  const allOperations = []
  const seenKeys = new Set()
  let deduplicatedOperationCount = 0
  records.forEach((record) => {
    ;(record.operations || []).forEach((operation) => {
      const key = buildOperationKey(operation)
      if (seenKeys.has(key)) {
        deduplicatedOperationCount += 1
        return
      }
      seenKeys.add(key)
      allOperations.push(operation)
    })
  })
  const arbitration = arbitrateStructuredOperations(allOperations)
  const orderedOperations = arbitration.selectedOperations
    .slice()
    .sort((left, right) => {
      const startDiff = Number(right?.start || 0) - Number(left?.start || 0)
      if (startDiff !== 0) return startDiff
      return Number(right?.end || 0) - Number(left?.end || 0)
    })
  const contentBlocks = records.map((record) => ({
    chunkIndex: Number(record?.chunk?.index || 0),
    start: Number(record?.chunk?.start || 0),
    end: Number(record?.chunk?.end || 0),
    inputText: String(record?.chunk?.normalizedText || record?.chunk?.rawText || '').trim(),
    outputText: String(record?.response?.parsed?.content || '').trim(),
    summary: String(record?.response?.parsed?.summary || '').trim(),
    quality: record?.response?.quality || null,
    riskProfile: record?.chunk?.riskProfile || null,
    paragraphRefs: Array.isArray(record?.chunk?.paragraphRefs) ? record.chunk.paragraphRefs : [],
    relativeRangeMap: Array.isArray(record?.chunk?.relativeRangeMap) ? record.chunk.relativeRangeMap : []
  }))
  const aggregatedContent = contentBlocks.map(item => item.outputText).filter(Boolean).join('\n')
  const invalidBatchCount = records.filter(item => item?.response?.valid !== true).length
  const resolvedOperationCount = orderedOperations.filter(item => item?.resolved === true).length
  const unresolvedOperationCount = orderedOperations.length - resolvedOperationCount
  const exactValidatedOperationCount = orderedOperations.filter(item => item?.validationStatus === 'exact').length
  const normalizedValidatedOperationCount = orderedOperations.filter(item => item?.validationStatus === 'normalized').length
  const mismatchedOperationCount = orderedOperations.filter(item => item?.validationStatus === 'mismatch').length
  const reviewBatchCount = records.filter(item => String(item?.response?.quality?.level || '') === 'review').length
  const mediumBatchCount = records.filter(item => String(item?.response?.quality?.level || '') === 'medium').length
  const highBatchCount = records.filter(item => String(item?.response?.quality?.level || '') === 'high').length
  const highRiskBatchCount = records.filter(item => String(item?.chunk?.riskProfile?.level || '') === 'high').length
  const mediumRiskBatchCount = records.filter(item => String(item?.chunk?.riskProfile?.level || '') === 'medium').length
  return {
    schemaVersion: STRUCTURED_PIPELINE_SCHEMA_VERSION,
    taskId,
    assistantId,
    taskTitle: String(taskTitle || '').trim(),
    documentContext: {
      inputSource: String(inputInfo?.source || '').trim(),
      configuredInputSource: String(configuredInputSource || '').trim(),
      hasSelection: inputInfo?.hasSelection === true,
      totalTextLength: String(inputInfo?.text || '').length,
      rangeStart: Number(chunks?.[0]?.start || 0),
      rangeEnd: Number(chunks?.[chunks.length - 1]?.end || 0)
    },
    requestContext: {
      requirementText: String(requirementText || '').trim(),
      targetLanguage: String(targetLanguage || '').trim(),
      documentAction: String(documentAction || '').trim(),
      chunkLength: Number(chunkSettings?.chunkLength || 0),
      overlapLength: Number(chunkSettings?.overlapLength || 0),
      splitStrategy: String(chunkSettings?.splitStrategy || '').trim(),
      chunkWriteMode: String(chunkWriteMode || '').trim() || 'paragraph-body',
      assistantMode: getStructuredAssistantMode(assistantId)
    },
    batches: records,
    contentBlocks,
    aggregatedContent,
    operations: orderedOperations,
    operationArbitration: {
      deduplicatedOperationCount,
      rejectedOperations: arbitration.rejectedOperations,
      summary: arbitration.summary
    },
    summary: {
      batchCount: records.length,
      contentBlockCount: contentBlocks.filter(item => item.outputText).length,
      operationCount: orderedOperations.length,
      candidateOperationCount: allOperations.length,
      deduplicatedOperationCount,
      resolvedOperationCount,
      unresolvedOperationCount,
      invalidBatchCount,
      exactValidatedOperationCount,
      normalizedValidatedOperationCount,
      mismatchedOperationCount,
      highQualityBatchCount: highBatchCount,
      mediumQualityBatchCount: mediumBatchCount,
      reviewQualityBatchCount: reviewBatchCount,
      highRiskBatchCount,
      mediumRiskBatchCount,
      arbitrationSelectedOperationCount: Number(arbitration.summary.selectedOperationCount || 0),
      arbitrationRejectedOperationCount: Number(arbitration.summary.rejectedOperationCount || 0),
      arbitrationConflictRejectedCount: Number(arbitration.summary.conflictRejectedCount || 0),
      arbitrationUnresolvedRejectedCount: Number(arbitration.summary.unresolvedRejectedCount || 0)
    }
  }
}

export function getStructuredPlanOutputText(plan) {
  return String(plan?.aggregatedContent || '').trim()
}

export function getStructuredPlanPreview(plan, maxLength = 220) {
  const text = getStructuredPlanOutputText(plan)
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}
