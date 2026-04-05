/**
 * 拼写与语法检查服务
 * - 根据段落截取设置分块
 * - 使用设置中的拼写与语法检查模型
 * - 分批调用大模型，解析结果并添加批注
 * - 支持并发控制与大文档性能优化
 */

import { chatCompletion } from './chatApi.js'
import { getFlatModelsFromSettings } from './modelSettings.js'
import { getChunkSettings } from './chunkSettings.js'
import { getAssistantSetting, getConfiguredAssistantModelId } from './assistantSettings.js'
import { loadGlobalSettings } from './globalSettings.js'
import {
  collectMatchPositions,
  mapNormalizedRangeToRaw,
  normalizeTextWithIndexMap
} from './documentPositionUtils.js'

/** WPS ShowDialog 内可能无 Application，从 opener/parent 获取（不赋值 window.Application，避免只读属性报错） */
function getApplication() {
  return window.Application || window.opener?.Application || window.parent?.Application
}
import { getDocumentChunksWithPositions, getSelectionChunksWithPositions } from './documentChunker.js'
import { addTask, updateTask, getTaskById } from './taskListStore.js'

const activeSpellCheckRuns = new Map()
const STOP_REQUEST_KEY_PREFIX = 'NdSpellCheckStop:'

function getStopRequestKey(taskId) {
  return `${STOP_REQUEST_KEY_PREFIX}${taskId}`
}

function setStopRequested(taskId, value) {
  try {
    if (value) {
      localStorage?.setItem(getStopRequestKey(taskId), '1')
    } else {
      localStorage?.removeItem(getStopRequestKey(taskId))
    }
  } catch (_) {
    // Ignore storage write failures and keep in-memory stop handling available.
  }
}

function isStopRequested(taskId) {
  try {
    return localStorage?.getItem(getStopRequestKey(taskId)) === '1'
  } catch (_) {
    return false
  }
}

if (typeof window !== 'undefined' && !window.__ndSpellCheckStopListenerBound) {
  window.addEventListener('storage', (event) => {
    if (!event?.key || !event.key.startsWith(STOP_REQUEST_KEY_PREFIX) || event.newValue !== '1') return
    const taskId = event.key.slice(STOP_REQUEST_KEY_PREFIX.length)
    const runState = activeSpellCheckRuns.get(taskId)
    if (!runState) return
    runState.cancelled = true
    try {
      runState.abortController?.abort()
    } catch (_) {
      // Ignore abort errors triggered by host-specific implementations.
    }
  })
  window.__ndSpellCheckStopListenerBound = true
}

// WPS/Office 宿主中的文档批注写入属于重操作，串行更稳定，也能避免长时间占用 UI 线程。
const CONCURRENCY = 1
const UI_YIELD_EVERY = 5
const SPELL_CHECK_PROMPT = `你是一位专业的文字校对专家。请对以下文本进行拼写与语法检查。

要求：
1. 找出所有错别字、语法错误、标点误用、用词不当等问题
2. 必须返回合法 JSON 对象，格式如下：
   {
     "issues": [
       {
         "text": "",
         "suggestion": "",
         "reason": "",
         "sentence": "",
         "prefix": "",
         "suffix": ""
       }
     ]
   }
3. "text" 必须是原文中的连续片段；如果问题是标点，也必须返回原文中的那个标点
4. "sentence" 表示包含该问题的完整原句或最小完整分句，必须来自原文，不要改写
5. "prefix" 表示原文中该问题前面紧邻的最多 12 个字符，"suffix" 表示后面紧邻的最多 12 个字符；不要添加省略号，不要改写原文，没有则返回空字符串
6. 若无问题，返回 {"issues":[]}
7. 只返回 JSON，不要 markdown，不要解释，不要额外文字

示例输出：
{"issues":[{"text":"，","suggestion":"。","reason":"句末标点误用","sentence":"工作已经完成，请尽快确认。","prefix":"工作已经完成","suffix":"请尽快确认。"},{"text":"做业","suggestion":"作业","reason":"错别字","sentence":"正在写做业，请检查。","prefix":"正在写","suffix":"，请检查。"}]}

待检查文本：
---
{{TEXT}}
---`

const SPELL_CHECK_RESPONSE_FORMAT = { type: 'json_object' }

function getSpellCheckAssistantConfig() {
  return getAssistantSetting('spell-check') || {}
}

function getSpellCheckDocumentAction() {
  const config = getSpellCheckAssistantConfig()
  const raw = String(config.documentAction || '').trim()
  const allowed = new Set([
    'replace',
    'insert',
    'comment',
    'link-comment',
    'comment-replace',
    'append',
    'prepend',
    'none'
  ])
  if (allowed.has(raw)) return raw
  return 'comment'
}

/**
 * 「建议复核」类问题是否写批注：全局显式 false 时关闭；未配置时与文档动作一致（批注类默认写入，避免任务完成却 0 条批注）。
 */
function getSpellCheckReviewCommentPolicy() {
  const settings = loadGlobalSettings()
  const raw = settings?.spellCheckCommentPolicy
  if (raw?.writeReviewComments === false) {
    return { writeReviewComments: false }
  }
  if (raw?.writeReviewComments === true) {
    return { writeReviewComments: true }
  }
  const docAction = getSpellCheckDocumentAction()
  if (docAction === 'none' || docAction === 'replace') {
    return { writeReviewComments: false }
  }
  return { writeReviewComments: true }
}

function buildSpellCheckPrompt(text) {
  const config = getSpellCheckAssistantConfig()
  const template = config.userPromptTemplate || SPELL_CHECK_PROMPT
  return String(template)
    .replace(/\{\{\s*input\s*\}\}/g, text || '(空)')
    .replace(/\{\{\s*TEXT\s*\}\}/g, text || '(空)')
}

function getSpellCheckSystemPrompt() {
  const config = getSpellCheckAssistantConfig()
  const parts = []
  if (config.persona) {
    parts.push(`角色设定：${config.persona}`)
  }
  parts.push(config.systemPrompt || '你是专业的文字校对专家，只返回合法 JSON 对象格式的检查结果。')
  return parts.filter(Boolean).join('\n\n')
}

/**
 * 解析模型返回的 JSON 错误列表
 * @param {string} raw
 * @returns {Array<{text: string, suggestion: string, reason: string}>}
 */
function normalizeSpellCheckItems(arr) {
  if (!Array.isArray(arr)) return []
  return arr
    .filter(item => item && typeof item === 'object' && item.text)
    .map(item => ({
      text: String(item.text || '').trim(),
      suggestion: String(item.suggestion || '').trim(),
      reason: String(item.reason || '').trim(),
      sentence: String(item.sentence ?? item.fullSentence ?? item.contextSentence ?? ''),
      prefix: String(item.prefix ?? item.leftContext ?? item.contextBefore ?? ''),
      suffix: String(item.suffix ?? item.rightContext ?? item.contextAfter ?? '')
    }))
    .filter(item => item.text)
}

function isPunctuationOnlyText(text) {
  const s = String(text || '').trim()
  return !!s && /^[\p{P}\p{S}]+$/u.test(s)
}

function countOccurrences(text, chunkText) {
  const target = normalizeTextWithIndexMap(text).normalized
  const chunk = normalizeTextWithIndexMap(chunkText).normalized
  if (!target || !chunk) return 0
  return collectMatchPositions(chunk, target).length
}

function assessSpellCheckIssueQuality(issue, chunkText) {
  const text = String(issue?.text || '')
  const suggestion = String(issue?.suggestion || '')
  const reason = String(issue?.reason || '')
  const sentence = String(issue?.sentence || '')
  const prefix = String(issue?.prefix || '')
  const suffix = String(issue?.suffix || '')
  const punctuationOnly = isPunctuationOnlyText(text)
  const contextLength = prefix.length + suffix.length + sentence.length
  const occurrenceCount = countOccurrences(text, chunkText)

  if (!text) {
    return { keep: false, level: 'filtered', label: '已过滤', reason: '缺少原片段' }
  }
  if (!suggestion && !reason) {
    return { keep: false, level: 'filtered', label: '已过滤', reason: '缺少修改建议与原因' }
  }
  if (suggestion && suggestion === text) {
    return { keep: false, level: 'filtered', label: '已过滤', reason: '建议内容与原片段一致' }
  }
  if (punctuationOnly) {
    if (!sentence && !prefix && !suffix) {
      return { keep: false, level: 'filtered', label: '已过滤', reason: '孤立标点缺少上下文' }
    }
    if (occurrenceCount > 3 && contextLength < 8) {
      return { keep: false, level: 'filtered', label: '已过滤', reason: '重复标点过多且上下文不足' }
    }
    if (sentence || (prefix && suffix)) {
      return { keep: true, level: 'review', label: '建议复核', reason: '标点类问题，建议人工复核' }
    }
    return { keep: true, level: 'medium', label: '中', reason: '标点问题上下文有限' }
  }
  if (text.length === 1 && contextLength < 6) {
    return { keep: true, level: 'review', label: '建议复核', reason: '单字问题上下文较少' }
  }
  if (sentence || contextLength >= 8) {
    return { keep: true, level: 'high', label: '高', reason: '上下文充分' }
  }
  return { keep: true, level: 'medium', label: '中', reason: '可用，但建议结合上下文确认' }
}

function postProcessParsedItems(items, chunkText) {
  const list = Array.isArray(items) ? items : []
  const seen = new Set()
  const output = []
  let filteredCount = 0
  for (const rawItem of list) {
    const item = { ...rawItem }
    const dedupeKey = [
      item.text,
      item.suggestion,
      item.reason,
      item.sentence,
      item.prefix,
      item.suffix
    ].join('||')
    if (seen.has(dedupeKey)) {
      filteredCount++
      continue
    }
    seen.add(dedupeKey)
    const quality = assessSpellCheckIssueQuality(item, chunkText)
    item.qualityLevel = quality.level
    item.qualityLabel = quality.label
    item.qualityReason = quality.reason
    if (!quality.keep) {
      filteredCount++
      continue
    }
    output.push(item)
  }
  return { items: output, filteredCount }
}

export function parseSpellCheckResponse(raw) {
  return parseSpellCheckResponseDetailed(raw).items
}

function extractJsonCandidate(text) {
  if (!text) return ''
  const s = String(text).trim()
  const codeBlock = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (codeBlock?.[1]) return codeBlock[1].trim()
  const objMatch = s.match(/\{[\s\S]*\}/)
  if (objMatch) return objMatch[0]
  const arrMatch = s.match(/\[[\s\S]*\]/)
  if (arrMatch) return arrMatch[0]
  return s
}

function parseSpellCheckResponseDetailed(raw) {
  if (!raw || !raw.trim()) {
    return { items: [], valid: false, parsed: null }
  }
  const candidate = extractJsonCandidate(raw)
  try {
    const parsed = JSON.parse(candidate)
    const arr = Array.isArray(parsed)
      ? parsed
      : (parsed?.issues || parsed?.errors || parsed?.items || parsed?.data)
    if (Array.isArray(arr)) {
      return { items: normalizeSpellCheckItems(arr), valid: true, parsed }
    }
    return { items: [], valid: false, parsed }
  } catch (e) {
    console.warn('parseSpellCheckResponse JSON parse error:', e)
    return { items: [], valid: false, parsed: null }
  }
}

function buildSpellCheckRequest(model, text, overrides = {}) {
  const prompt = buildSpellCheckPrompt(text)
  const messages = overrides.messages || [
    { role: 'system', content: getSpellCheckSystemPrompt() },
    { role: 'user', content: prompt }
  ]
  return {
    providerId: overrides.providerId || model.providerId,
    modelId: overrides.modelId || model.modelId,
    messages,
    stream: overrides.stream === true,
    temperature: overrides.temperature ?? 0,
    response_format: overrides.response_format || SPELL_CHECK_RESPONSE_FORMAT
  }
}

function buildRepairRequest(request, rawOutput) {
  return {
    providerId: request.providerId,
    modelId: request.modelId,
    stream: false,
    temperature: 0,
    response_format: SPELL_CHECK_RESPONSE_FORMAT,
    messages: [
      {
        role: 'system',
        content: '你是 JSON 修复器。你的任务是把输入内容修复为合法 JSON。只输出 JSON 对象，不要解释。'
      },
      {
        role: 'user',
        content: `请将下面内容修复为合法 JSON 对象，格式必须为 {"issues":[{"text":"","suggestion":"","reason":"","sentence":"","prefix":"","suffix":""}]}。

要求：
1. 不要新增原文中不存在的问题
2. 对每个问题尽量补全 sentence、prefix 和 suffix，内容必须来自原文相邻上下文
3. 若原文表达为“无问题/空数组”，输出 {"issues":[]}
4. 只输出 JSON 对象

待修复内容：
---
${rawOutput || ''}
---`
      }
    ]
  }
}

function buildConstrainedRetryRequest(request, chunkText, previousRawOutput) {
  return {
    ...request,
    stream: false,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: '你是严格的 JSON 输出器。你只能输出一个合法 JSON 对象，不能输出解释、markdown 或多余文字。'
      },
      {
        role: 'user',
        content: `请重新执行拼写与语法检查，并严格输出 JSON 对象：
{"issues":[{"text":"","suggestion":"","reason":"","sentence":"","prefix":"","suffix":""}]}

要求：
1. "text" 必须是原文中的连续片段
2. "sentence" 必须是包含该问题的完整原句或最小完整分句
3. "prefix" 和 "suffix" 必须是原文中紧邻该片段的上下文，用于精确定位
4. 对单个标点、单个字等短片段，必须提供足够区分的上下文
5. 若无问题，输出 {"issues":[]}
6. 不要输出任何 JSON 之外的内容

原始文本：
---
${chunkText || ''}
---

上一次错误输出（仅供参考，不一定正确）：
---
${previousRawOutput || ''}
---`
      }
    ]
  }
}

function buildDiagnosticInfo({
  stage,
  request,
  rawOutput,
  parsedOutput,
  parsedItems,
  filteredItemCount,
  parseError,
  repairRequest,
  error,
  chunkText,
  strategyTrace
}) {
  const diagnostic = {
    stage: stage || 'unknown',
    request: request || null,
    rawOutput: rawOutput ?? '',
    parsedOutput: parsedOutput ?? '',
    parsedItemCount: Array.isArray(parsedItems) ? parsedItems.length : 0,
    filteredItemCount: Number(filteredItemCount || 0),
    parseError: parseError || null,
    repairRequest: repairRequest || null,
    error: error || null,
    chunkText: chunkText ?? '',
    strategyTrace: Array.isArray(strategyTrace) ? strategyTrace : []
  }
  const root = classifyRootCause(diagnostic)
  diagnostic.rootCause = root.code
  diagnostic.rootCauseLabel = root.label
  diagnostic.rootCauseSummary = root.summary
  diagnostic.severity = root.severity
  return diagnostic
}

function classifyRootCause(diagnostic) {
  const error = String(diagnostic?.error || '')
  const parseError = String(diagnostic?.parseError || '')
  const rawOutput = String(diagnostic?.rawOutput || '').trim()
  const parsedCount = Number(diagnostic?.parsedItemCount || 0)
  const filteredItemCount = Number(diagnostic?.filteredItemCount || 0)
  const stage = String(diagnostic?.stage || '')
  const commentAddedCount = Number(diagnostic?.commentAddedCount || 0)
  const skippedCommentCount = Number(diagnostic?.skippedCommentCount || 0)
  const strategyTrace = Array.isArray(diagnostic?.strategyTrace) ? diagnostic.strategyTrace : []

  if (strategyTrace.includes('drop_response_format') || /response_format|unsupported|Unrecognized request argument|unknown parameter/i.test(error)) {
    return {
      code: 'unsupported_response_format',
      label: '结构化输出不支持',
      summary: '当前模型或网关不支持 response_format，已回退为普通 JSON 请求。',
      severity: 'warning'
    }
  }
  if (/空内容/.test(error) || (!rawOutput && !parsedCount)) {
    return {
      code: 'empty_output',
      label: '模型空响应',
      summary: '请求成功后模型未返回可用文本内容。',
      severity: 'error'
    }
  }
  if (parseError && stage === 'repair-failed') {
    return {
      code: 'repair_failed',
      label: '修复阶段失败',
      summary: '原始响应和修复后的响应都无法解析成结构化 JSON。',
      severity: 'error'
    }
  }
  if (parseError && rawOutput) {
    return {
      code: 'non_structured_output',
      label: '返回非结构化文本',
      summary: '模型返回了自然语言或混合格式内容，未直接遵守 JSON 约束。',
      severity: 'warning'
    }
  }
  if (parsedCount > 0 && skippedCommentCount === parsedCount) {
    return {
      code: 'review_comments_skipped',
      label: '建议复核，未自动写入',
      summary: '这些问题被标记为建议复核，当前策略默认不自动写入批注。',
      severity: 'info'
    }
  }
  if (parsedCount > 0 && commentAddedCount === 0) {
    return {
      code: 'comment_anchor_not_found',
      label: '批注定位失败',
      summary: '模型已识别出问题，但错误片段未能在原文中成功定位。',
      severity: 'warning'
    }
  }
  if (parsedCount > 0 && commentAddedCount > 0) {
    return {
      code: 'ok_with_issues',
      label: '检查成功',
      summary: '模型返回了结构化问题列表，并成功写入部分或全部批注。',
      severity: 'info'
    }
  }
  if (parsedCount === 0 && filteredItemCount > 0) {
    return {
      code: 'issues_filtered',
      label: '低价值问题已过滤',
      summary: `系统过滤了 ${filteredItemCount} 条低价值或重复问题，避免产生噪音批注。`,
      severity: 'info'
    }
  }
  if (parsedCount === 0 && rawOutput) {
    return {
      code: 'clean_document',
      label: '检查通过',
      summary: '模型返回了合法结构化结果，未发现问题。',
      severity: 'info'
    }
  }
  return {
    code: 'unknown',
    label: '待人工判断',
    summary: '未能自动归类，请结合原始输出与诊断信息排查。',
    severity: 'warning'
  }
}

function attachCommentResult(diagnostic, parsedItems, commentAddedCount) {
  const base = { ...(diagnostic || {}) }
  base.parsedItemCount = Array.isArray(parsedItems) ? parsedItems.length : Number(base.parsedItemCount || 0)
  base.commentAddedCount = commentAddedCount
  base.skippedCommentCount = Array.isArray(parsedItems)
    ? parsedItems.filter(item => item?.anchorStatus === 'skipped').length
    : Number(base.skippedCommentCount || 0)
  const root = classifyRootCause(base)
  base.rootCause = root.code
  base.rootCauseLabel = root.label
  base.rootCauseSummary = root.summary
  base.severity = root.severity
  return base
}

function buildSpellCheckCommentText(issue) {
  return issue?.suggestion
    ? `${issue.reason || '建议'}: 建议改为「${issue.suggestion}」`
    : (issue?.reason || '请检查')
}

function applyIssueCommentToParsedItems(doc, item, parsedItems, issueIndex) {
  const issue = parsedItems[issueIndex]
  if (!issue) {
    return { ok: false, reasonLabel: '问题项不存在' }
  }
  const chunkText = item?.chunkText ?? item?.input ?? ''
  const commentText = buildSpellCheckCommentText(issue)
  const commentResult = addCommentAtText(doc, item.chunkStart, issue, chunkText, commentText)
  issue.anchorStatus = commentResult?.ok ? 'success' : 'failed'
  issue.anchorReasonCode = commentResult?.reasonCode || (commentResult?.ok ? 'matched' : 'unknown')
  issue.anchorReasonLabel = commentResult?.reasonLabel || (commentResult?.ok ? '定位成功' : '定位失败')
  if (commentResult?.range) {
    issue.anchorRange = commentResult.range
  }
  return commentResult
}

function buildCompactIndexMap(text) {
  const chars = []
  const indexMap = []
  const skipRE = /\s/
  for (let i = 0; i < String(text || '').length; i++) {
    const ch = text[i]
    if (skipRE.test(ch)) continue
    chars.push(ch)
    indexMap.push(i)
  }
  return { compact: chars.join(''), indexMap }
}

function isAmbiguousShortAnchor(text) {
  const s = String(text || '')
  if (!s) return false
  if (s.length <= 1) return true
  return /^[\p{P}\p{S}]+$/u.test(s)
}

function scoreContext(windowText, context, preferStart) {
  if (!context) return 0
  if (preferStart && windowText.startsWith(context)) return 2000 + context.length
  if (!preferStart && windowText.endsWith(context)) return 2000 + context.length
  if (windowText.includes(context)) return 800 + context.length
  return 0
}

export function findIssueRangeDetailed(chunkText, issue) {
  const rawChunk = String(chunkText || '')
  const target = String(issue?.text || '')
  const sentence = String(issue?.sentence || '')
  const prefix = String(issue?.prefix || '')
  const suffix = String(issue?.suffix || '')
  if (!rawChunk || !target) {
    return { ok: false, reasonCode: 'missing_anchor', reasonLabel: '缺少定位片段' }
  }

  const normalizedChunk = normalizeTextWithIndexMap(rawChunk)
  const normalizedTarget = normalizeTextWithIndexMap(target).normalized
  const normalizedSentence = normalizeTextWithIndexMap(sentence).normalized
  const normalizedPrefix = normalizeTextWithIndexMap(prefix).normalized
  const normalizedSuffix = normalizeTextWithIndexMap(suffix).normalized
  const sentenceRanges = normalizedSentence
    ? collectMatchPositions(normalizedChunk.normalized, normalizedSentence).map(start => ({
      start,
      end: start + normalizedSentence.length
    }))
    : []
  const sentenceFallback = sentenceRanges.length === 1
    ? mapNormalizedRangeToRaw(sentenceRanges[0], normalizedChunk)
    : null
  const positions = collectMatchPositions(normalizedChunk.normalized, normalizedTarget)
  if (positions.length === 0) {
    if (sentenceFallback) {
      return {
        ok: true,
        range: sentenceFallback,
        reasonCode: 'sentence_fallback_text_missing',
        reasonLabel: '原片段未命中，已回退到整句批注'
      }
    }
    const chunkCompact = buildCompactIndexMap(rawChunk)
    const targetCompact = buildCompactIndexMap(target)
    if (!chunkCompact.compact || !targetCompact.compact) {
      return { ok: false, reasonCode: 'text_not_found', reasonLabel: '原片段未命中' }
    }
    const idx = chunkCompact.compact.indexOf(targetCompact.compact)
    if (idx < 0) {
      return { ok: false, reasonCode: 'text_not_found', reasonLabel: '原片段未命中' }
    }
    const start = chunkCompact.indexMap[idx]
    const endIndex = chunkCompact.indexMap[idx + targetCompact.compact.length - 1]
    if (endIndex < start) {
      return { ok: false, reasonCode: 'text_not_found', reasonLabel: '原片段未命中' }
    }
    return {
      ok: true,
      range: { start, end: endIndex + 1 },
      reasonCode: 'compact_match',
      reasonLabel: '通过压缩匹配定位'
    }
  }
  if (positions.length === 1 && !normalizedPrefix && !normalizedSuffix && !isAmbiguousShortAnchor(target)) {
    return {
      ok: true,
      range: mapNormalizedRangeToRaw({ start: positions[0], end: positions[0] + normalizedTarget.length }, normalizedChunk),
      reasonCode: 'direct_match',
      reasonLabel: '直接命中'
    }
  }

  const candidates = positions.map(start => {
    const end = start + normalizedTarget.length
    const beforeWindow = normalizedChunk.normalized.slice(Math.max(0, start - 24), start)
    const afterWindow = normalizedChunk.normalized.slice(end, Math.min(normalizedChunk.normalized.length, end + 24))
    let score = 0
    if (normalizedSentence) {
      if (sentenceRanges.some(range => start >= range.start && end <= range.end)) {
        score += 3200 + normalizedSentence.length
      } else if (sentence.includes(target)) {
        score -= 400
      }
    }
    score += scoreContext(beforeWindow, normalizedPrefix, false)
    score += scoreContext(afterWindow, normalizedSuffix, true)
    if (normalizedPrefix && beforeWindow.endsWith(normalizedPrefix)) score += 200
    if (normalizedSuffix && afterWindow.startsWith(normalizedSuffix)) score += 200
    return { start, end, score }
  }).sort((a, b) => b.score - a.score)

  const best = candidates[0]
  const second = candidates[1]
  const hasStrongContext = best && best.score >= 1600
  const clearlyBetter = best && (!second || best.score - second.score >= 400)
  if (!best) {
    return { ok: false, reasonCode: 'text_not_found', reasonLabel: '原片段未命中' }
  }
  if ((normalizedPrefix || normalizedSuffix) && (hasStrongContext || clearlyBetter)) {
    return {
      ok: true,
      range: mapNormalizedRangeToRaw(best, normalizedChunk),
      reasonCode: normalizedSentence ? 'sentence_context_match' : 'context_match',
      reasonLabel: normalizedSentence ? '整句与上下文命中' : '上下文命中'
    }
  }
  if (candidates.length === 1 && !isAmbiguousShortAnchor(target)) {
    return {
      ok: true,
      range: mapNormalizedRangeToRaw(best, normalizedChunk),
      reasonCode: 'single_candidate',
      reasonLabel: '唯一候选命中'
    }
  }
  if (!normalizedPrefix && !normalizedSuffix && isAmbiguousShortAnchor(target)) {
    if (sentenceFallback) {
      return {
        ok: true,
        range: sentenceFallback,
        reasonCode: 'sentence_fallback_ambiguous_short_anchor',
        reasonLabel: '短标点歧义过高，已回退到整句批注'
      }
    }
    return { ok: false, reasonCode: 'ambiguous_short_anchor', reasonLabel: '短标点歧义过高' }
  }
  if (!normalizedSentence && (normalizedPrefix || normalizedSuffix) && !clearlyBetter) {
    if (sentenceFallback) {
      return {
        ok: true,
        range: sentenceFallback,
        reasonCode: 'sentence_fallback_context_conflict',
        reasonLabel: '上下文冲突，已回退到整句批注'
      }
    }
    return { ok: false, reasonCode: 'context_conflict', reasonLabel: '上下文冲突' }
  }
  if (normalizedSentence && sentenceRanges.length === 0) {
    return { ok: false, reasonCode: 'sentence_not_found', reasonLabel: '整句未命中' }
  }
  if (sentenceFallback && !clearlyBetter) {
    return {
      ok: true,
      range: sentenceFallback,
      reasonCode: 'sentence_fallback_ambiguous_candidates',
      reasonLabel: '候选位置冲突，已回退到整句批注'
    }
  }
  return clearlyBetter
    ? {
        ok: true,
        range: mapNormalizedRangeToRaw(best, normalizedChunk),
        reasonCode: 'best_candidate',
        reasonLabel: '最佳候选命中'
      }
    : { ok: false, reasonCode: 'ambiguous_candidates', reasonLabel: '候选位置冲突' }
}

async function executeSpellCheckRequest(request, runState = null) {
  throwIfCancelled(runState)
  try {
    const raw = await chatCompletion({
      ribbonModelId: request.providerId && request.modelId ? `${request.providerId}|${request.modelId}` : undefined,
      signal: runState?.abortController?.signal,
      ...request
    })
    throwIfCancelled(runState)
    if (String(raw || '').trim()) {
      return { raw: String(raw), effectiveRequest: request, strategyTrace: [] }
    }
    if (request.stream === true) {
      const fallbackRequest = { ...request, stream: false }
      const fallbackRaw = await chatCompletion({
        ribbonModelId: fallbackRequest.providerId && fallbackRequest.modelId ? `${fallbackRequest.providerId}|${fallbackRequest.modelId}` : undefined,
        signal: runState?.abortController?.signal,
        ...fallbackRequest
      })
      throwIfCancelled(runState)
      return { raw: String(fallbackRaw || ''), effectiveRequest: fallbackRequest, strategyTrace: ['drop_stream'] }
    }
    return { raw: String(raw || ''), effectiveRequest: request, strategyTrace: [] }
  } catch (error) {
    if (error?.name === 'AbortError' || /请求已终止/.test(String(error?.message || ''))) {
      throw createCancelError()
    }
    const msg = String(error?.message || error || '')
    const unsupportedStructured = /response_format|unsupported|Unrecognized request argument|unknown parameter/i.test(msg)
    if (unsupportedStructured && request.response_format) {
      const fallbackRequest = { ...request }
      delete fallbackRequest.response_format
      const fallbackRaw = await chatCompletion({
        ribbonModelId: fallbackRequest.providerId && fallbackRequest.modelId ? `${fallbackRequest.providerId}|${fallbackRequest.modelId}` : undefined,
        signal: runState?.abortController?.signal,
        ...fallbackRequest
      })
      throwIfCancelled(runState)
      return { raw: String(fallbackRaw || ''), effectiveRequest: fallbackRequest, strategyTrace: ['drop_response_format'] }
    }
    throw error
  }
}

async function runStructuredSpellCheck(model, chunkText, requestOverride = null, runState = null) {
  const initialRequest = requestOverride?.messages
    ? { ...requestOverride, stream: requestOverride.stream === true, temperature: requestOverride.temperature ?? 0 }
    : buildSpellCheckRequest(model, chunkText)
  const first = await executeSpellCheckRequest(initialRequest, runState)
  const strategyTrace = [...(first.strategyTrace || [])]
  const firstParsed = parseSpellCheckResponseDetailed(first.raw)
  const firstProcessed = postProcessParsedItems(firstParsed.items, chunkText)
  if (firstParsed.valid) {
    return {
      request: first.effectiveRequest,
      output: first.raw,
      parsedOutput: JSON.stringify({ issues: firstProcessed.items }, null, 2),
      parsedItems: firstProcessed.items,
      diagnostic: buildDiagnosticInfo({
        stage: 'first-pass',
        request: first.effectiveRequest,
        rawOutput: first.raw,
        parsedOutput: JSON.stringify({ issues: firstProcessed.items }, null, 2),
        parsedItems: firstProcessed.items,
        filteredItemCount: firstProcessed.filteredCount,
        chunkText,
        strategyTrace
      })
    }
  }

  const constrainedRequest = buildConstrainedRetryRequest(first.effectiveRequest, chunkText, first.raw)
  const constrained = await executeSpellCheckRequest(constrainedRequest, runState)
  strategyTrace.push('constrained_retry', ...(constrained.strategyTrace || []))
  const constrainedParsed = parseSpellCheckResponseDetailed(constrained.raw)
  const constrainedProcessed = postProcessParsedItems(constrainedParsed.items, chunkText)
  if (constrainedParsed.valid) {
    return {
      request: constrained.effectiveRequest,
      output: constrained.raw,
      parsedOutput: JSON.stringify({ issues: constrainedProcessed.items }, null, 2),
      parsedItems: constrainedProcessed.items,
      diagnostic: buildDiagnosticInfo({
        stage: 'constrained-retry',
        request: constrained.effectiveRequest,
        rawOutput: constrained.raw,
        parsedOutput: JSON.stringify({ issues: constrainedProcessed.items }, null, 2),
        parsedItems: constrainedProcessed.items,
        filteredItemCount: constrainedProcessed.filteredCount,
        chunkText,
        strategyTrace
      })
    }
  }

  const repairRequest = buildRepairRequest(constrained.effectiveRequest, constrained.raw || first.raw)
  const repaired = await executeSpellCheckRequest(repairRequest, runState)
  strategyTrace.push('json_repair', ...(repaired.strategyTrace || []))
  const repairedParsed = parseSpellCheckResponseDetailed(repaired.raw)
  const repairedProcessed = postProcessParsedItems(repairedParsed.items, chunkText)
  if (repairedParsed.valid) {
    return {
      request: constrained.effectiveRequest,
      output: constrained.raw || first.raw,
      parsedOutput: repaired.raw,
      parsedItems: repairedProcessed.items,
      repairRequest,
      diagnostic: buildDiagnosticInfo({
        stage: 'repaired',
        request: constrained.effectiveRequest,
        rawOutput: constrained.raw || first.raw,
        parsedOutput: repaired.raw,
        parsedItems: repairedProcessed.items,
        filteredItemCount: repairedProcessed.filteredCount,
        repairRequest,
        chunkText,
        strategyTrace
      })
    }
  }

  return {
    request: constrained.effectiveRequest,
    output: constrained.raw || first.raw,
    parsedOutput: repaired.raw,
    parsedItems: [],
    repairRequest,
    parseError: '模型返回内容无法解析为结构化 JSON',
    diagnostic: buildDiagnosticInfo({
      stage: 'repair-failed',
      request: constrained.effectiveRequest,
      rawOutput: constrained.raw || first.raw,
      parsedOutput: repaired.raw,
      parsedItems: [],
      filteredItemCount: repairedProcessed.filteredCount,
      parseError: '模型返回内容无法解析为结构化 JSON',
      repairRequest,
      chunkText,
      strategyTrace
    })
  }
}

/**
 * 在文档指定范围添加批注
 * @param {object} doc
 * @param {number} chunkStart - 该块在文档中的起始位置
 * @param {{ text: string, prefix?: string, suffix?: string }} issue - 要定位的问题
 * @param {string} chunkText - 该块的完整文本
 * @param {string} commentText - 批注内容
 * @returns {boolean}
 */
export function addCommentAtText(doc, chunkStart, issue, chunkText, commentText) {
  if (!doc?.Comments || !issue?.text) {
    return { ok: false, reasonCode: 'missing_anchor', reasonLabel: '缺少定位片段' }
  }
  const match = findIssueRangeDetailed(chunkText, issue)
  if (!match?.ok || !match.range) {
    return match || { ok: false, reasonCode: 'anchor_not_found', reasonLabel: '未找到定位点' }
  }
  const start = chunkStart + match.range.start
  const end = chunkStart + match.range.end
  try {
    const range = doc.Range(start, end)
    doc.Comments.Add(range, commentText)
    return {
      ok: true,
      reasonCode: match.reasonCode,
      reasonLabel: match.reasonLabel,
      range: { start, end }
    }
  } catch (e) {
    console.warn('addCommentAtText failed:', e)
    return { ok: false, reasonCode: 'wps_comment_failed', reasonLabel: 'WPS 批注写入失败' }
  }
}

/**
 * 在定位到的原文范围内替换为建议文本（用于文档动作为「替换」等）
 */
function replaceIssueTextInDocument(doc, chunkStart, issue, chunkText) {
  if (!doc?.Content || !issue?.text) {
    return { ok: false, reasonCode: 'missing_anchor', reasonLabel: '缺少定位片段' }
  }
  const suggestion = String(issue.suggestion || '').trim()
  if (!suggestion) {
    return { ok: false, reasonCode: 'no_suggestion', reasonLabel: '缺少替换文本' }
  }
  const match = findIssueRangeDetailed(chunkText, issue)
  if (!match?.ok || !match.range) {
    return match || { ok: false, reasonCode: 'anchor_not_found', reasonLabel: '未找到定位点' }
  }
  const start = chunkStart + match.range.start
  const end = chunkStart + match.range.end
  try {
    const range = doc.Range(start, end)
    range.Text = suggestion
    return {
      ok: true,
      reasonCode: match.reasonCode,
      reasonLabel: match.reasonLabel || '已替换',
      range: { start, end }
    }
  } catch (e) {
    console.warn('replaceIssueTextInDocument failed:', e)
    return { ok: false, reasonCode: 'wps_replace_failed', reasonLabel: 'WPS 替换失败' }
  }
}

function buildSpellCheckCommentBody(issue, documentAction) {
  const base = buildSpellCheckCommentText(issue)
  if (documentAction === 'link-comment') {
    return `${base}\n\n参考：可在任务清单中查看完整结果。`
  }
  return base
}

/**
 * 按助手设置的文档动作写回单条问题（批注 / 替换 / 仅生成等）
 */
function applySpellCheckIssueWrite(doc, chunkStart, rawChunkText, err, documentAction, reviewCommentPolicy) {
  const action = String(documentAction || 'comment').trim()
  if (action === 'none') {
    err.anchorStatus = 'skipped'
    err.anchorReasonCode = 'document_action_none'
    err.anchorReasonLabel = '当前设置为仅生成结果，未写回文档'
    return { ok: false, skipped: true }
  }

  const commentLike = ['comment', 'link-comment', 'insert', 'prepend', 'append'].includes(action)
  if (commentLike) {
    if (err.qualityLevel === 'review' && !reviewCommentPolicy.writeReviewComments) {
      err.anchorStatus = 'skipped'
      err.anchorReasonCode = 'review_comment_skipped'
      err.anchorReasonLabel = '建议复核问题默认不写批注'
      return { ok: false }
    }
    const commentText = buildSpellCheckCommentBody(err, action)
    return addCommentAtText(doc, chunkStart, err, rawChunkText, commentText)
  }

  if (action === 'replace') {
    return replaceIssueTextInDocument(doc, chunkStart, err, rawChunkText)
  }

  if (action === 'comment-replace') {
    if (err.qualityLevel === 'review' && !reviewCommentPolicy.writeReviewComments) {
      err.anchorStatus = 'skipped'
      err.anchorReasonCode = 'review_comment_skipped'
      err.anchorReasonLabel = '建议复核问题默认不写批注'
      return { ok: false }
    }
    const ctext = buildSpellCheckCommentText(err)
    const c1 = addCommentAtText(doc, chunkStart, err, rawChunkText, ctext)
    err.anchorStatus = c1?.ok ? 'success' : 'failed'
    err.anchorReasonCode = c1?.reasonCode || 'unknown'
    err.anchorReasonLabel = c1?.reasonLabel || ''
    if (c1?.range) err.anchorRange = c1.range
    if (!c1?.ok) return c1
    const r2 = replaceIssueTextInDocument(doc, chunkStart, err, rawChunkText)
    if (r2?.ok) {
      err.writebackMode = 'comment-replace'
      return { ok: true, ...r2 }
    }
    err.anchorReasonLabel = `${err.anchorReasonLabel || '已添加批注'}；替换未执行：${r2?.reasonLabel || '失败'}`
    return { ok: true, partialReplace: false, commentOk: true }
  }

  return addCommentAtText(doc, chunkStart, err, rawChunkText, buildSpellCheckCommentText(err))
}

/**
 * 获取拼写检查模型配置（与 AI 助手使用相同的模型清单与解析逻辑）
 * @returns {{ providerId: string, modelId: string, id: string } | null}
 */
function getSpellCheckModel() {
  try {
    const app = getApplication()
    const configuredModelId = getConfiguredAssistantModelId('spell-check')
    if (configuredModelId) {
      const flatModels = getFlatModelsFromSettings('chat')
      const configured = flatModels.find(m => m.id === configuredModelId)
      if (configured) {
        return { providerId: configured.providerId, modelId: configured.modelId, id: configured.id }
      }
      const configuredParts = String(configuredModelId).split('|')
      if (configuredParts.length >= 2) {
        return { providerId: configuredParts[0], modelId: configuredParts[1], id: configuredModelId }
      }
    }
    const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('defaultModelsByCategory')) ||
      app?.PluginStorage?.getItem('defaultModelsByCategory')
    if (!stored) {
      console.warn('spellCheck: defaultModelsByCategory 未找到')
      return null
    }
    const parsed = JSON.parse(stored)
    const spellId = parsed?.chat || parsed?.spell
    if (!spellId) {
      console.warn('spellCheck: 未配置拼写与语法检查模型')
      return null
    }
    // 与 AI 助手相同：从 getFlatModelsFromSettings 获取模型清单，确保使用相同配置
    const flatModels = getFlatModelsFromSettings('chat')
    const model = flatModels.find(m => m.id === spellId)
    if (model) {
      return { providerId: model.providerId, modelId: model.modelId, id: model.id }
    }
    // 兼容旧格式：providerId|modelId（模型可能不在当前清单中，但仍尝试使用）
    const parts = String(spellId).split('|')
    if (parts.length >= 2) {
      return { providerId: parts[0], modelId: parts[1], id: spellId }
    }
    console.warn('spellCheck: 模型格式无效，应为 providerId|modelId 或与设置中模型 id 一致', spellId)
    return null
  } catch (e) {
    console.error('spellCheck getSpellCheckModel:', e)
    return null
  }
}

/**
 * 限制并发执行
 */
function pLimit(fns, limit) {
  return new Promise((resolve) => {
    const results = []
    let index = 0
    let active = 0

    function runNext() {
      if (index >= fns.length && active === 0) {
        resolve(results)
        return
      }
      while (active < limit && index < fns.length) {
        const i = index++
        const fn = fns[i]
        active++
        Promise.resolve(fn())
          .then(val => {
            results[i] = { ok: true, value: val }
          })
          .catch(err => {
            results[i] = { ok: false, error: err }
          })
          .finally(() => {
            active--
            runNext()
          })
      }
    }
    runNext()
  })
}

function yieldToUI(delay = 0) {
  return new Promise(resolve => setTimeout(resolve, delay))
}

function createCancelError() {
  const err = new Error('任务已停止')
  err.name = 'TaskCancelledError'
  err.code = 'TASK_CANCELLED'
  return err
}

function isTaskCancelledError(error) {
  return error?.code === 'TASK_CANCELLED' || error?.name === 'TaskCancelledError'
}

function throwIfCancelled(runState) {
  if (runState?.taskId && isStopRequested(runState.taskId)) {
    runState.cancelled = true
    try {
      runState.abortController?.abort()
    } catch (_) {
      // Ignore abort errors so task cancellation can proceed.
    }
  }
  if (runState?.cancelled) throw createCancelError()
}

export function stopSpellCheckTask(taskId) {
  setStopRequested(taskId, true)
  const runState = activeSpellCheckRuns.get(taskId)
  if (runState) {
    runState.cancelled = true
    try {
      runState.abortController?.abort()
    } catch (_) {
      // Ignore abort errors so task cancellation can proceed.
    }
  }
  updateTask(taskId, {
    status: 'cancelled',
    error: '任务已停止'
  })
  return true
}

async function processSpellCheckChunks({
  doc,
  model,
  chunks,
  taskTitle,
  chunkSource,
  chunkSettings,
  onProgress,
  onChunkContent,
  onError,
  onTaskCreated,
  taskId: existingTaskId = ''
}) {
  const filteredChunks = (chunks || []).filter(c => (c.text || '').trim().length > 0)
  if (filteredChunks.length === 0) {
    const msg = taskTitle.includes('选中') ? '请先选中要检查的文本，选区内容不能为空' : '文档内容为空或无法读取'
    onError?.(msg)
    throw new Error(msg)
  }

  const initialItems = filteredChunks.map(chunk => {
    const input = String(chunk.normalizedText ?? chunk.text ?? '')
    return {
      request: buildSpellCheckRequest(model, input),
      output: '',
      parsedOutput: '',
      parsedItems: [],
      chunkStart: chunk.start,
      chunkText: chunk.text,
      chunkNormalizedText: input,
      commentCount: 0
    }
  })

  const taskId = String(existingTaskId || '').trim() || addTask({
    type: 'spell-check',
    title: taskTitle,
    status: 'running',
    total: filteredChunks.length,
    current: 0,
    progress: 0,
    data: {
      chunkCount: filteredChunks.length,
      chunkSource: chunkSource || 'document',
      chunkSettings: chunkSettings || getChunkSettings(),
      documentAction: getSpellCheckDocumentAction(),
      items: initialItems,
      commentCount: 0
    }
  })
  if (existingTaskId) {
    updateTask(taskId, {
      title: taskTitle,
      status: 'running',
      total: filteredChunks.length,
      current: 0,
      progress: 0,
      data: {
        chunkCount: filteredChunks.length,
        chunkSource: chunkSource || 'document',
        chunkSettings: chunkSettings || getChunkSettings(),
        documentAction: getSpellCheckDocumentAction(),
        items: initialItems,
        commentCount: 0,
        progressStage: 'preparing',
        progressEvents: ['检查界面已打开，正在准备分段与模型请求...']
      }
    })
  }
  onTaskCreated?.(taskId)
  setStopRequested(taskId, false)
  const runState = {
    taskId,
    cancelled: false,
    abortController: typeof AbortController !== 'undefined' ? new AbortController() : null
  }
  const documentAction = getSpellCheckDocumentAction()
  const reviewCommentPolicy = getSpellCheckReviewCommentPolicy()
  activeSpellCheckRuns.set(taskId, runState)
  const liveItems = [...initialItems]
  let liveCommentCount = 0

  function updateLiveTaskItem(itemIndex, itemData) {
    liveItems[itemIndex] = itemData
    const task = getTaskById(taskId)
    if (!task) return
    updateTask(taskId, {
      data: {
        ...(task.data || {}),
        commentCount: liveCommentCount,
        chunkCount: filteredChunks.length,
        chunkSource: chunkSource || 'document',
        chunkSettings: chunkSettings || getChunkSettings(),
        items: [...liveItems]
      }
    })
  }

  try {
    onProgress?.(0, filteredChunks.length)
    await yieldToUI()

    const chunkFns = filteredChunks.map((chunk, i) => async () => {
      const rawChunkText = String(chunk.text || '')
      const input = String(chunk.normalizedText ?? chunk.text ?? '')
      const request = buildSpellCheckRequest(model, input)
      try {
        throwIfCancelled(runState)

        if (!input.trim()) {
          const emptyItem = {
            request,
            output: '{"issues":[]}',
            parsedOutput: '{"issues":[]}',
            parsedItems: [],
            chunkStart: chunk.start,
            chunkText: rawChunkText,
            chunkNormalizedText: input,
            commentCount: 0
          }
          updateLiveTaskItem(i, emptyItem)
          return { added: 0, ...emptyItem }
        }
        onChunkContent?.(input.trim().slice(0, 200) + (input.trim().length > 200 ? '...' : ''))
        const prevTaskData = getTaskById(taskId)?.data || {}
        updateTask(taskId, {
          current: i + 1,
          progress: Math.round(((i + 1) / filteredChunks.length) * 100),
          data: {
            ...prevTaskData,
            documentAction,
            chunkCount: filteredChunks.length,
            chunkSource: chunkSource || 'document',
            chunkSettings: chunkSettings || getChunkSettings(),
            currentChunk: input.trim().slice(0, 150),
            items: [...liveItems],
            commentCount: liveCommentCount
          }
        })
        onProgress?.(i + 1, filteredChunks.length)
        await yieldToUI()
        throwIfCancelled(runState)

        let result
        try {
          result = await runStructuredSpellCheck(model, input, request, runState)
        } catch (apiErr) {
          if (isTaskCancelledError(apiErr)) throw apiErr
          console.error('spellCheck API 调用失败:', apiErr)
          onError?.(apiErr.message || '模型调用失败')
          throw apiErr
        }
        if (!String(result?.output || '').trim()) {
          throw new Error('模型返回空内容')
        }

        const errors = (result.parsedItems || []).map(err => ({ ...err }))
        let added = 0
        for (let errIndex = 0; errIndex < errors.length; errIndex++) {
          throwIfCancelled(runState)
          const err = errors[errIndex]
          const writeResult = applySpellCheckIssueWrite(doc, chunk.start, rawChunkText, err, documentAction, reviewCommentPolicy)
          if (err.anchorStatus !== 'skipped') {
            err.anchorStatus = writeResult?.ok ? 'success' : 'failed'
            err.anchorReasonCode = writeResult?.reasonCode || (writeResult?.ok ? 'matched' : 'unknown')
            err.anchorReasonLabel = writeResult?.reasonLabel || (writeResult?.ok ? '定位成功' : '定位失败')
            if (writeResult?.range) {
              err.anchorRange = writeResult.range
            }
          }
          if (writeResult?.ok) {
            added++
          }
          if ((errIndex + 1) % UI_YIELD_EVERY === 0) {
            await yieldToUI()
          }
        }
        await yieldToUI()
        throwIfCancelled(runState)
        const diagnostic = attachCommentResult(result.diagnostic, errors, added)
        const successItem = {
          added,
          request: result.request,
          output: result.output,
          parsedOutput: result.parsedOutput,
          parsedItems: errors,
          repairRequest: result.repairRequest,
          parseError: result.parseError,
          diagnostic,
          chunkStart: chunk.start,
          chunkText: rawChunkText,
          chunkNormalizedText: input
        }
        liveCommentCount += added
        updateLiveTaskItem(i, {
          request: successItem.request,
          output: successItem.output,
          parsedOutput: successItem.parsedOutput,
          parsedItems: successItem.parsedItems,
          repairRequest: successItem.repairRequest,
          parseError: successItem.parseError,
          diagnostic: successItem.diagnostic,
          chunkStart: successItem.chunkStart,
          chunkText: successItem.chunkText,
          chunkNormalizedText: successItem.chunkNormalizedText,
          commentCount: successItem.added
        })
        return successItem
      } catch (error) {
        if (!isTaskCancelledError(error)) {
          updateLiveTaskItem(i, {
            request,
            output: null,
            chunkStart: chunk.start,
            chunkText: rawChunkText,
            chunkNormalizedText: input,
            error: error?.message || String(error || ''),
            diagnostic: buildDiagnosticInfo({
              stage: 'request-error',
              request,
              error: error?.message || String(error || ''),
              chunkText: rawChunkText
            }),
            commentCount: 0
          })
        }
        throw error
      }
    })

    const results = await pLimit(chunkFns, CONCURRENCY)
    const totalComments = results.reduce((sum, r) => sum + (r.ok ? r.value?.added ?? 0 : 0), 0)
    const completedCount = results.filter(r => r.ok).length
    const finalItems = results.map((r, i) => {
      const c = filteredChunks[i]
      const defaultRequest = buildSpellCheckRequest(model, String(c?.normalizedText ?? c?.text ?? ''))
      if (r.ok && r.value) {
        return {
          request: r.value.request,
          output: r.value.output,
          parsedOutput: r.value.parsedOutput,
          parsedItems: r.value.parsedItems,
          repairRequest: r.value.repairRequest,
          parseError: r.value.parseError,
          diagnostic: r.value.diagnostic,
          chunkStart: r.value.chunkStart,
          chunkText: r.value.chunkText,
          chunkNormalizedText: r.value.chunkNormalizedText,
          commentCount: r.value.added
        }
      }
      const cancelledError = isTaskCancelledError(r.error)
      return {
        request: defaultRequest,
        output: null,
        chunkStart: c?.start ?? 0,
        chunkText: c?.text ?? '',
        chunkNormalizedText: c?.normalizedText ?? c?.text ?? '',
        error: cancelledError ? '任务已停止' : r.error?.message,
        diagnostic: buildDiagnosticInfo({
          stage: cancelledError ? 'cancelled' : 'request-error',
          request: defaultRequest,
          error: cancelledError ? '任务已停止' : r.error?.message,
          chunkText: c?.text ?? ''
        }),
        commentCount: 0
      }
    })

    const cancelled = runState.cancelled || results.some(r => isTaskCancelledError(r.error))
    updateTask(taskId, {
      status: cancelled ? 'cancelled' : 'completed',
      current: completedCount,
      progress: cancelled ? Math.round((completedCount / filteredChunks.length) * 100) : 100,
      error: cancelled ? '任务已停止' : undefined,
      data: {
        commentCount: totalComments,
        chunkCount: filteredChunks.length,
        chunkSource: chunkSource || 'document',
        chunkSettings: chunkSettings || getChunkSettings(),
        documentAction,
        items: finalItems
      }
    })
    await yieldToUI()

    if (cancelled) {
      throw createCancelError()
    }
    return { commentCount: totalComments, chunkCount: filteredChunks.length, taskId }
  } finally {
    setStopRequested(taskId, false)
    activeSpellCheckRuns.delete(taskId)
  }
}

function createSpellCheckPlaceholderTask(taskTitle, chunkSource = 'document') {
  return addTask({
    type: 'spell-check',
    title: String(taskTitle || '拼写与语法检查').trim() || '拼写与语法检查',
    status: 'running',
    total: 0,
    current: 0,
    progress: 1,
    data: {
      chunkCount: 0,
      chunkSource,
      chunkSettings: getChunkSettings(),
      documentAction: getSpellCheckDocumentAction(),
      items: [],
      commentCount: 0,
      progressStage: 'preparing',
      progressEvents: ['任务已创建，正在准备检查内容...']
    }
  })
}

function prepareSpellCheckAllArgs({ onProgress, onChunkContent, onError, onTaskCreated } = {}) {
  const app = getApplication()
  const doc = app?.ActiveDocument
  if (!doc) {
    const msg = !app ? '无法获取 WPS 应用对象，请确保在 WPS 中运行' : '当前没有打开任何文档'
    console.error('spellCheck:', msg)
    onError?.(msg)
    throw new Error(msg)
  }

  const model = getSpellCheckModel()
  if (!model) {
    onError?.('请先在设置中配置「拼写与语法检查模型」')
    throw new Error('请先在设置中配置拼写与语法检查模型')
  }

  const chunks = getDocumentChunksWithPositions(doc)
  const chunkSettings = getChunkSettings()
  if (chunks.filter(c => (c.text || '').trim().length > 0).length === 0) {
    console.warn('spellCheck: 文档分块为空或全部为空白')
    onError?.('文档内容为空或无法读取，请确保文档有正文内容')
    throw new Error('文档内容为空或无法读取')
  }

  return {
    doc,
    model,
    chunks,
    taskTitle: '拼写与语法检查',
    chunkSource: 'document',
    chunkSettings,
    onProgress,
    onChunkContent,
    onError,
    onTaskCreated
  }
}

function prepareSpellCheckSelectionArgs({ onProgress, onChunkContent, onError, onTaskCreated } = {}) {
  const app = getApplication()
  const doc = app?.ActiveDocument
  const selection = app?.Selection
  if (!doc || !selection) {
    const msg = !app ? '无法获取 WPS 应用对象' : '无法获取文档或选区，请先选中要检查的文本'
    console.error('spellCheck:', msg)
    onError?.(msg)
    throw new Error(msg)
  }

  const chunks = getSelectionChunksWithPositions(doc, selection)
  const chunkSettings = getChunkSettings()
  if (chunks.filter(c => (c.text || '').trim().length > 0).length === 0) {
    onError?.('请先选中要检查的文本，选区内容不能为空')
    throw new Error('请先选中要检查的文本')
  }

  const model = getSpellCheckModel()
  if (!model) {
    onError?.('请先在设置中配置「拼写与语法检查模型」')
    throw new Error('请先在设置中配置拼写与语法检查模型')
  }

  return {
    doc,
    model,
    chunks,
    taskTitle: '拼写与语法检查（选中）',
    chunkSource: 'selection',
    chunkSettings,
    onProgress,
    onChunkContent,
    onError,
    onTaskCreated
  }
}

export function startSpellCheckAllTask(options = {}) {
  const taskId = createSpellCheckPlaceholderTask('拼写与语法检查', 'document')
  options.onTaskCreated?.(taskId)
  const promise = (async () => {
    await yieldToUI()
    try {
      const args = prepareSpellCheckAllArgs(options)
      return await processSpellCheckChunks({
        ...args,
        taskId
      })
    } catch (error) {
      updateTask(taskId, {
        status: isTaskCancelledError(error) ? 'cancelled' : 'failed',
        error: error?.message || String(error || ''),
        progress: 100,
        data: {
          ...(getTaskById(taskId)?.data || {}),
          progressStage: isTaskCancelledError(error) ? 'cancelled' : 'failed',
          progressEvents: [error?.message || String(error || '拼写检查启动失败')],
          estimatedRemainingMs: 0
        }
      })
      throw error
    }
  })()
  return { taskId, promise }
}

export function startSpellCheckSelectionTask(options = {}) {
  const taskId = createSpellCheckPlaceholderTask('拼写与语法检查（选中）', 'selection')
  options.onTaskCreated?.(taskId)
  const promise = (async () => {
    await yieldToUI()
    try {
      const args = prepareSpellCheckSelectionArgs(options)
      return await processSpellCheckChunks({
        ...args,
        taskId
      })
    } catch (error) {
      updateTask(taskId, {
        status: isTaskCancelledError(error) ? 'cancelled' : 'failed',
        error: error?.message || String(error || ''),
        progress: 100,
        data: {
          ...(getTaskById(taskId)?.data || {}),
          progressStage: isTaskCancelledError(error) ? 'cancelled' : 'failed',
          progressEvents: [error?.message || String(error || '拼写检查启动失败')],
          estimatedRemainingMs: 0
        }
      })
      throw error
    }
  })()
  return { taskId, promise }
}

/**
 * 执行拼写检查（检查全部）
 * @param {object} options
 * @param {function(number, number)} [options.onProgress] - (current, total) => void
 * @param {function(string)} [options.onChunkContent] - 当前处理的内容预览
 * @param {function(string)} [options.onError]
 * @returns {Promise<{ commentCount: number, chunkCount: number }>}
 */
export async function runSpellCheckAll({ onProgress, onChunkContent, onError }) {
  return startSpellCheckAllTask({ onProgress, onChunkContent, onError }).promise
}

/**
 * 执行拼写检查（检查当前选中）
 */
export async function runSpellCheckSelection({ onProgress, onChunkContent, onError }) {
  return startSpellCheckSelectionTask({ onProgress, onChunkContent, onError }).promise
}

/**
 * 重试拼写检查的单个块（用于任务详情中的重试）
 * @param {string} taskId
 * @param {number} itemIndex - items 中的索引
 * @param {{ providerId: string, modelId: string, messages: Array, stream?: boolean }|null} [requestOverride] - 可选的编辑后请求参数，优先使用
 * @returns {Promise<{ output: string, commentCount: number }>}
 */
export async function retrySpellCheckChunk(taskId, itemIndex, requestOverride = null) {
  const task = getTaskById(taskId)
  if (!task || task.type !== 'spell-check') {
    throw new Error('任务不存在或类型不支持重试')
  }
  const items = task.data?.items || []
  const item = items[itemIndex]
  const documentAction = getSpellCheckDocumentAction()
  const reviewCommentPolicy = getSpellCheckReviewCommentPolicy()
  let req = requestOverride || item?.request
  const chunkText = item?.chunkText ?? item?.input ?? ''
  const chunkNormalizedText = item?.chunkNormalizedText ?? chunkText
  if (!req?.messages) {
    const model = getSpellCheckModel()
    if (!model) throw new Error('请先在设置中配置拼写与语法检查模型')
    req = buildSpellCheckRequest(model, chunkNormalizedText)
  }

  const app = getApplication()
  const doc = app?.ActiveDocument
  if (!doc) throw new Error('当前没有打开文档')
  await yieldToUI()

  const result = await runStructuredSpellCheck(null, chunkNormalizedText, req)
  const raw = result.output
  req = result.request
  if (!String(raw || '').trim()) {
    const newItems = [...items]
    newItems[itemIndex] = {
      ...item,
      request: req,
      output: '',
      chunkText,
      chunkNormalizedText,
      commentCount: 0,
      error: '模型返回空内容',
      diagnostic: buildDiagnosticInfo({
        stage: 'empty-output',
        request: req,
        rawOutput: '',
        error: '模型返回空内容',
        chunkText
      })
    }
    updateTask(taskId, {
      data: { ...task.data, items: newItems }
    })
    throw new Error('模型返回空内容')
  }

  const errors = (result.parsedItems || []).map(err => ({ ...err }))
  let added = 0
  for (let errIndex = 0; errIndex < errors.length; errIndex++) {
    const err = errors[errIndex]
    const writeResult = applySpellCheckIssueWrite(doc, item.chunkStart, chunkText, err, documentAction, reviewCommentPolicy)
    if (err.anchorStatus !== 'skipped') {
      err.anchorStatus = writeResult?.ok ? 'success' : 'failed'
      err.anchorReasonCode = writeResult?.reasonCode || (writeResult?.ok ? 'matched' : 'unknown')
      err.anchorReasonLabel = writeResult?.reasonLabel || (writeResult?.ok ? '定位成功' : '定位失败')
      if (writeResult?.range) {
        err.anchorRange = writeResult.range
      }
    }
    if (writeResult?.ok) {
      added++
    }
    if ((errIndex + 1) % UI_YIELD_EVERY === 0) {
      await yieldToUI()
    }
  }
  await yieldToUI()
  const diagnostic = attachCommentResult(result.diagnostic, errors, added)

  const newItems = [...items]
  newItems[itemIndex] = {
    ...item,
    request: req,
    output: raw,
    parsedOutput: result.parsedOutput,
    parsedItems: errors,
    repairRequest: result.repairRequest,
    parseError: result.parseError,
    diagnostic,
    chunkText,
    chunkNormalizedText,
    commentCount: added,
    error: null
  }
  const totalComments = (task.data?.commentCount ?? 0) - (item.commentCount ?? 0) + added
  updateTask(taskId, {
    data: { ...task.data, items: newItems, commentCount: totalComments, documentAction }
  })

  return { output: raw, commentCount: added }
}

export async function applySpellCheckIssueComment(taskId, itemIndex, issueIndex) {
  const task = getTaskById(taskId)
  if (!task || task.type !== 'spell-check') {
    throw new Error('任务不存在或类型不支持补写批注')
  }
  const items = task.data?.items || []
  const item = items[itemIndex]
  if (!item) throw new Error('任务项不存在')
  const parsedItems = Array.isArray(item.parsedItems) ? item.parsedItems.map(err => ({ ...err })) : []
  const issue = parsedItems[issueIndex]
  if (!issue) throw new Error('问题项不存在')

  const app = getApplication()
  const doc = app?.ActiveDocument
  if (!doc) throw new Error('当前没有打开文档')

  await yieldToUI()
  const commentResult = applyIssueCommentToParsedItems(doc, item, parsedItems, issueIndex)

  const previousCommentCount = Number(item.commentCount || 0)
  const nextCommentCount = previousCommentCount + (commentResult?.ok ? 1 : 0)
  const diagnostic = attachCommentResult(item.diagnostic, parsedItems, nextCommentCount)
  const newItems = [...items]
  newItems[itemIndex] = {
    ...item,
    parsedItems,
    diagnostic,
    commentCount: nextCommentCount
  }
  const totalComments = Number(task.data?.commentCount || 0) - previousCommentCount + nextCommentCount
  updateTask(taskId, {
    data: { ...task.data, items: newItems, commentCount: totalComments }
  })

  if (!commentResult?.ok) {
    throw new Error(issue.anchorReasonLabel || '补写批注失败')
  }
  return {
    commentCount: nextCommentCount,
    issue
  }
}

export async function applySkippedSpellCheckComments(taskId, targets = null) {
  const task = getTaskById(taskId)
  if (!task || task.type !== 'spell-check') {
    throw new Error('任务不存在或类型不支持批量补写批注')
  }
  const app = getApplication()
  const doc = app?.ActiveDocument
  if (!doc) throw new Error('当前没有打开文档')

  const items = Array.isArray(task.data?.items) ? task.data.items : []
  const newItems = items.map(item => ({
    ...item,
    parsedItems: Array.isArray(item?.parsedItems) ? item.parsedItems.map(issue => ({ ...issue })) : []
  }))
  const targetSet = Array.isArray(targets) && targets.length > 0
    ? new Set(
      targets
        .map(target => {
          const itemIndex = Number(target?.itemIndex)
          const issueIndex = Number(target?.issueIndex)
          return Number.isInteger(itemIndex) && Number.isInteger(issueIndex)
            ? `${itemIndex}-${issueIndex}`
            : ''
        })
        .filter(Boolean)
    )
    : null
  if (targetSet && targetSet.size === 0) {
    throw new Error('未选择要写入的跳过项')
  }

  let appliedCount = 0
  const failedIssues = []

  for (let itemIndex = 0; itemIndex < newItems.length; itemIndex++) {
    const item = newItems[itemIndex]
    const parsedItems = item.parsedItems || []
    const previousCommentCount = Number(item.commentCount || 0)
    let nextCommentCount = previousCommentCount

    for (let issueIndex = 0; issueIndex < parsedItems.length; issueIndex++) {
      const issue = parsedItems[issueIndex]
      if (issue?.anchorStatus !== 'skipped') continue
      if (targetSet && !targetSet.has(`${itemIndex}-${issueIndex}`)) continue
      await yieldToUI()
      const commentResult = applyIssueCommentToParsedItems(doc, item, parsedItems, issueIndex)
      if (commentResult?.ok) {
        nextCommentCount += 1
        appliedCount += 1
      } else {
        failedIssues.push({
          itemIndex,
          issueIndex,
          text: issue?.text || '',
          reasonLabel: issue?.anchorReasonLabel || '补写批注失败'
        })
      }
      if ((appliedCount + failedIssues.length) % UI_YIELD_EVERY === 0) {
        await yieldToUI()
      }
    }

    item.commentCount = nextCommentCount
    item.diagnostic = attachCommentResult(item.diagnostic, parsedItems, nextCommentCount)
  }

  const totalCommentCount = newItems.reduce((sum, item) => sum + Number(item?.commentCount || 0), 0)
  updateTask(taskId, {
    data: { ...task.data, items: newItems, commentCount: totalCommentCount }
  })

  return {
    appliedCount,
    failedCount: failedIssues.length,
    failedIssues,
    commentCount: totalCommentCount
  }
}
