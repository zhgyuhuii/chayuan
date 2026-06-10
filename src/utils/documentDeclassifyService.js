import { chatCompletion } from './chatApi.js'
import { getActiveDocument, getDocumentText } from './documentActions.js'
import { addTask, updateTask } from './taskListStore.js'
import { getBuiltinAssistantDefinition } from './assistantRegistry.js'
import { getAssistantSetting, getConfiguredAssistantModelId } from './assistantSettings.js'
import {
  decryptPayload,
  encryptPayload,
  fingerprintText,
  validateDeclassifyPassword
} from './documentDeclassifyCrypto.js'
import { getFlatModelsFromSettings, parseModelCompositeId } from './modelSettings.js'
import { inferModelType, matchesModelType } from './modelTypeUtils.js'
import {
  clearDeclassifyState,
  getDeclassifyEnvelope,
  getDeclassifyState,
  invalidateDeclassifyRibbonControls,
  isDocumentDeclassified,
  saveDeclassifyState
} from './documentDeclassifyStore.js'

export const SECRET_KEYWORD_ASSISTANT_ID = 'analysis.secret-keyword-extract'

const TOKEN_WRAPPER = '§'
const CONTEXT_WINDOW = 12
const RANDOM_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const RANDOM_TOKEN_LENGTH = 8
const SECRET_KEYWORD_RESPONSE_FORMAT = { type: 'json_object' }
const LOCAL_SENSITIVE_PATTERNS = [
  { regex: /\b1[3-9]\d{9}\b/g, category: '联系方式', riskLevel: 'high', reason: '命中手机号模式' },
  { regex: /\b[1-9]\d{16}[0-9Xx]\b/g, category: '证件信息', riskLevel: 'high', reason: '命中身份证号模式' },
  { regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, category: '联系方式', riskLevel: 'high', reason: '命中邮箱模式' },
  { regex: /\b[A-Z]{2,6}-\d{2,}\b/g, category: '编号标识', riskLevel: 'medium', reason: '命中编号模式' },
  { regex: /\b\d{6,}\b/g, category: '编号标识', riskLevel: 'medium', reason: '命中长数字编号模式' },
  // 安全加固B:补充高风险本地兜底(独立格式,不依赖大模型召回;放在长数字之后,重叠时高风险覆盖)
  { regex: /\b(?:\d{16}|\d{19})\b/g, category: '金融账户', riskLevel: 'high', reason: '命中银行卡号模式' },
  { regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, category: '网络信息', riskLevel: 'high', reason: '命中IP地址模式' },
  { regex: /[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]/g, category: '车辆信息', riskLevel: 'high', reason: '命中车牌号模式' },
  { regex: /\b[0-9A-HJ-NP-RTUWXY]{2}\d{6}[0-9A-HJ-NP-RTUWXY]{10}\b/g, category: '单位信息', riskLevel: 'high', reason: '命中统一社会信用代码模式' }
]

function interpolateTemplate(template, variables = {}) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key]
    return value == null ? '' : String(value)
  })
}

function getModelByCompositeId(modelType, compositeId) {
  if (!compositeId) return null
  const flat = getFlatModelsFromSettings(modelType)
  const found = flat.find(item => item.id === compositeId)
  if (found) return found
  const parsed = parseModelCompositeId(compositeId)
  if (!parsed) return null
  const inferredType = inferModelType(parsed.modelId)
  if (modelType && !matchesModelType(inferredType, modelType)) return null
  return {
    id: compositeId,
    providerId: parsed.providerId,
    modelId: parsed.modelId,
    name: parsed.modelId,
    type: modelType || 'chat'
  }
}

function resolveSecretKeywordAssistantModel(config, definition) {
  const modelType = config?.modelType || definition?.modelType || 'chat'
  const flat = getFlatModelsFromSettings(modelType)
  const configuredId = config?.modelId || getConfiguredAssistantModelId(definition?.id)
  if (configuredId) {
    const configured = getModelByCompositeId(modelType, configuredId)
    if (configured) return configured
  }
  return flat[0] || null
}

function buildSecretKeywordAssistantMessages(documentText, definition, config) {
  const systemPrompt = String(config?.systemPrompt || definition?.systemPrompt || '').trim()
  const userPrompt = interpolateTemplate(
    config?.userPromptTemplate || definition?.userPromptTemplate || '{{input}}',
    { input: documentText }
  )
  return [
    systemPrompt ? { role: 'system', content: systemPrompt } : null,
    { role: 'user', content: userPrompt }
  ].filter(Boolean)
}

function isUnsupportedResponseFormatError(error) {
  return /response_format|unsupported|Unrecognized request argument|unknown parameter/i.test(String(error?.message || error || ''))
}

function toDocumentText(text) {
  return String(text || '').replace(/\r\n/g, '\r').replace(/\n/g, '\r')
}

function writeWholeDocumentText(text) {
  const doc = getActiveDocument()
  if (!doc?.Content) {
    throw new Error('当前没有可写入的文档')
  }
  doc.Content.Text = toDocumentText(text)
}

function replaceTextByRanges(doc, replacements, mode) {
  if (!doc?.Range || !Array.isArray(replacements) || replacements.length === 0) {
    return
  }
  const sorted = replacements.slice().sort((a, b) => {
    const aStart = Number(mode === 'restore' ? a.replacementStart : a.originalStart)
    const bStart = Number(mode === 'restore' ? b.replacementStart : b.originalStart)
    return bStart - aStart
  })

  sorted.forEach((item) => {
    const start = Number(mode === 'restore' ? item.replacementStart : item.originalStart)
    const end = Number(mode === 'restore' ? item.replacementEnd : item.originalEnd)
    const text = mode === 'restore' ? item.term : item.replacementToken
    const range = doc.Range(start, end)
    range.Text = toDocumentText(text)
  })
}

// 按占位符 token 就地查找替换的复原:不依赖脱密时记录的字符位置,因此文档在脱密后被
// 增删改也能尽力还原——只要占位符 §...§ 本身还在文档里。用 doc.Range 就地替换,
// 保留原有排版格式;被删除/改坏的占位符找不到,如实计入 missing,不伪造还原。
function restoreDeclassifyByTokens(doc, replacementMap) {
  const result = { restoredOccurrences: 0, totalTokens: 0, missingTokens: [], failed: 0 }
  if (!doc?.Range || !Array.isArray(replacementMap) || replacementMap.length === 0) {
    return result
  }
  const tokenTerm = new Map()
  for (const it of replacementMap) {
    if (it && it.replacementToken) tokenTerm.set(String(it.replacementToken), String(it.term ?? ''))
  }
  result.totalTokens = tokenTerm.size
  const current = getDocumentText()
  const ranges = []
  const found = new Set()
  for (const [token, term] of tokenTerm) {
    if (!token) continue
    let idx = current.indexOf(token)
    while (idx >= 0) {
      ranges.push({ start: idx, end: idx + token.length, term })
      found.add(token)
      idx = current.indexOf(token, idx + token.length)
    }
  }
  // 降序替换,避免前面的替换改变后面区间的偏移
  ranges.sort((a, b) => b.start - a.start)
  for (const r of ranges) {
    try {
      doc.Range(r.start, r.end).Text = toDocumentText(r.term)
      result.restoredOccurrences += 1
    } catch (_) {
      result.failed += 1
    }
  }
  result.missingTokens = [...tokenTerm.keys()].filter(t => !found.has(t))
  return result
}

function normalizeRiskLevel(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw
  if (raw === '高' || raw === '高风险') return 'high'
  if (raw === '中' || raw === '中风险') return 'medium'
  return 'low'
}

function extractJsonCandidate(output) {
  const source = String(output || '').trim()
  if (!source) return ''
  if (source.startsWith('{') || source.startsWith('[')) return source

  const fencedMatch = source.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  const firstBrace = source.indexOf('{')
  const lastBrace = source.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return source.slice(firstBrace, lastBrace + 1)
  }
  return source
}

function parseJsonSafe(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (_) {
    return null
  }
}

function getPreviewText(text, limit = 180) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized
}

function createDeclassifyLifecycleTask(title, initialData = {}) {
  return addTask({
    type: 'analysis',
    title,
    status: 'running',
    progress: 10,
    data: {
      assistantId: SECRET_KEYWORD_ASSISTANT_ID,
      operationKind: initialData.operationKind || '',
      progressStage: 'preparing',
      ...initialData
    }
  })
}

function completeDeclassifyLifecycleTask(taskId, data = {}) {
  updateTask(taskId, {
    status: 'completed',
    progress: 100,
    data: {
      assistantId: SECRET_KEYWORD_ASSISTANT_ID,
      ...data,
      progressStage: 'completed'
    }
  })
}

function failDeclassifyLifecycleTask(taskId, error, data = {}) {
  updateTask(taskId, {
    status: 'failed',
    error: error?.message || String(error),
    progress: 100,
    data: {
      assistantId: SECRET_KEYWORD_ASSISTANT_ID,
      ...data,
      progressStage: 'failed'
    }
  })
}

function sanitizeReplacementToken(token) {
  return String(token || '').replace(/\s+/g, '').trim()
}

function normalizeKeywordComparableKey(term) {
  return String(term || '')
    .normalize('NFKC')
    .replace(/[\s\u3000`~!@#$%^&*()_\-+=|\\[\]{};:'",.<>/?，。！？；：、（）《》【】“”‘’]/g, '')
    .toLowerCase()
    .trim()
}

function mergeKeywordReason(currentReason, nextReason) {
  const left = String(currentReason || '').trim()
  const right = String(nextReason || '').trim()
  if (!left) return right
  if (!right) return left
  return left.length >= right.length ? left : right
}

function appendConservativeSensitiveEntries(entries, documentText = '') {
  const source = Array.isArray(entries) ? entries.slice() : []
  const text = String(documentText || '')
  if (!text) return source
  LOCAL_SENSITIVE_PATTERNS.forEach((rule) => {
    const regex = new RegExp(rule.regex.source, rule.regex.flags)
    let match = regex.exec(text)
    while (match) {
      const term = String(match[0] || '').trim()
      if (term.length >= 2 && term.length <= 64) {
        source.push({
          term,
          category: rule.category,
          riskLevel: rule.riskLevel,
          reason: rule.reason
        })
      }
      match = regex.exec(text)
    }
  })
  return source
}

function getCryptoApi() {
  const cryptoApi = globalThis.crypto || window?.crypto || null
  if (!cryptoApi?.getRandomValues) {
    throw new Error('当前环境不支持安全随机数，无法生成随机占位符')
  }
  return cryptoApi
}

function buildRandomReplacementToken() {
  const cryptoApi = getCryptoApi()
  const randomBytes = cryptoApi.getRandomValues(new Uint8Array(RANDOM_TOKEN_LENGTH))
  let body = ''
  for (let i = 0; i < randomBytes.length; i += 1) {
    body += RANDOM_TOKEN_ALPHABET[randomBytes[i] % RANDOM_TOKEN_ALPHABET.length]
  }
  return `${TOKEN_WRAPPER}${body}${TOKEN_WRAPPER}`
}

function ensureUniqueReplacementToken(token, usedTokens, documentText) {
  let candidate = sanitizeReplacementToken(token)
  if (!candidate) {
    candidate = buildRandomReplacementToken()
  } else if (!/[^A-Za-z0-9]/.test(candidate)) {
    candidate = `${TOKEN_WRAPPER}${candidate}${TOKEN_WRAPPER}`
  }

  while (
    !candidate ||
    usedTokens.has(candidate) ||
    String(documentText || '').includes(candidate)
  ) {
    candidate = buildRandomReplacementToken()
  }
  usedTokens.add(candidate)
  return candidate
}

function normalizeKeywordEntries(entries, documentText = '') {
  const source = appendConservativeSensitiveEntries(entries, documentText)
  const merged = new Map()

  source.forEach((item) => {
    const term = String(
      typeof item === 'string'
        ? item
        : item?.term ?? item?.keyword ?? item?.text ?? ''
    ).trim()
    if (!term) return
    const comparableKey = normalizeKeywordComparableKey(term) || term
    const existing = merged.get(comparableKey) || {}
    const keptTerm = String(existing.term || '').length >= term.length ? String(existing.term || '').trim() : term
    merged.set(comparableKey, {
      term: keptTerm,
      category: String(item?.category || existing.category || '其他').trim() || '其他',
      riskLevel: normalizeRiskLevel(item?.riskLevel || existing.riskLevel),
      reason: mergeKeywordReason(existing.reason, item?.reason),
      replacementToken: sanitizeReplacementToken(item?.replacementToken || existing.replacementToken)
    })
  })

  const usedTokens = new Set()
  const normalized = Array.from(merged.values())
    .filter((item) => {
      // 安全加固B:高风险条目一律保留,避免短的高风险词(代号/编号)因是长词子串被过滤而残留明文
      if (item.riskLevel === 'high') return true
      const comparable = normalizeKeywordComparableKey(item.term)
      if (!comparable || comparable.length > 4) return true
      return !Array.from(merged.values()).some((other) => (
        other !== item &&
        String(other.term || '').length > String(item.term || '').length + 1 &&
        normalizeKeywordComparableKey(other.term).includes(comparable)
      ))
    })
    .sort((a, b) => String(b.term || '').length - String(a.term || '').length)
    .map((item) => ({
      ...item,
      // 安全加固A:文档内占位符一律由系统密码学随机生成,弃用大模型给的 replacementToken,
      // 避免占位符可预测/带语义提示而泄露高风险信息(原词仍存 AES-GCM 信封、凭密码复原)。
      replacementToken: ensureUniqueReplacementToken(
        '',
        usedTokens,
        documentText
      )
    }))

  return normalized
}

function getContextSnippet(text, start, end) {
  return {
    before: text.slice(Math.max(0, start - CONTEXT_WINDOW), start),
    after: text.slice(end, Math.min(text.length, end + CONTEXT_WINDOW))
  }
}

// 字符间可忽略的「不可见/对齐」字符:半/全角空格、制表符、不间断空格、零宽字符、BOM、软连字符。
// 不含换行与单元格分隔符(\n / \x07),避免跨段、跨单元格误匹配。
const MAX_INTERCHAR_GAP = 3

function isIntercharIgnorable(ch) {
  switch (String(ch || '').charCodeAt(0)) {
    case 0x20: case 0x09: case 0xa0: case 0x3000:
    case 0x200b: case 0x200c: case 0x200d: case 0xfeff: case 0xad:
      return true
    default:
      return false
  }
}

function stripIntercharIgnorable(text) {
  const s = String(text || '')
  let out = ''
  for (let i = 0; i < s.length; i += 1) {
    if (!isIntercharIgnorable(s[i])) out += s[i]
  }
  return out
}

// 容忍式匹配:允许关键词各字符之间夹少量对齐用空格/全角空格/零宽字符
// (常见于两字姓名用全角空格对齐成"张 辉")。返回实际匹配结束位置(exclusive),失败返回 -1。
function matchTermWithTolerance(source, index, termCore) {
  let si = index
  for (let ti = 0; ti < termCore.length; ti += 1) {
    if (ti > 0) {
      let gap = 0
      while (si < source.length && gap < MAX_INTERCHAR_GAP && isIntercharIgnorable(source[si])) {
        si += 1
        gap += 1
      }
    }
    if (si >= source.length || source[si] !== termCore[ti]) return -1
    si += 1
  }
  return si
}

function findMatchedEntry(entries, text, index) {
  for (const entry of entries) {
    const termCore = entry.termCore || stripIntercharIgnorable(entry.term)
    if (!termCore) continue
    const end = matchTermWithTolerance(text, index, termCore)
    if (end > index) return { entry, end }
  }
  return null
}

function buildReplacementPlan(text, keywordEntries) {
  const source = String(text || '')
  const normalizedEntries = normalizeKeywordEntries(keywordEntries, source)
  const orderedEntries = normalizedEntries.slice().sort((a, b) => {
    const lengthDiff = String(b.term).length - String(a.term).length
    if (lengthDiff !== 0) return lengthDiff
    return String(a.term).localeCompare(String(b.term), 'zh-Hans-CN')
  })
  // 预算去可忽略字符后的核心串,供容忍式匹配复用
  orderedEntries.forEach((e) => { e.termCore = stripIntercharIgnorable(e.term) })
  const replacementMap = []
  const outputParts = []
  const occurrenceByTerm = new Map()

  let inputIndex = 0
  let outputIndex = 0

  while (inputIndex < source.length) {
    const matched = findMatchedEntry(orderedEntries, source, inputIndex)
    if (!matched) {
      outputParts.push(source[inputIndex])
      inputIndex += 1
      outputIndex += 1
      continue
    }

    const matchedEntry = matched.entry
    const term = matchedEntry.term
    const replacementToken = matchedEntry.replacementToken
    const originalStart = inputIndex
    // 实际跨度可能含对齐空格(如姓名"张 辉"),整体替换;复原以干净关键词回填。
    const originalEnd = matched.end
    const replacementStart = outputIndex
    const replacementEnd = outputIndex + replacementToken.length
    const occurrenceIndex = (occurrenceByTerm.get(term) || 0) + 1
    const context = getContextSnippet(source, originalStart, originalEnd)

    occurrenceByTerm.set(term, occurrenceIndex)
    replacementMap.push({
      term,
      replacementToken,
      category: matchedEntry.category,
      riskLevel: matchedEntry.riskLevel,
      reason: matchedEntry.reason,
      occurrenceIndex,
      originalStart,
      originalEnd,
      replacementStart,
      replacementEnd,
      contextBefore: context.before,
      contextAfter: context.after
    })

    outputParts.push(replacementToken)
    inputIndex = originalEnd
    outputIndex = replacementEnd
  }

  const enrichedKeywordEntries = normalizedEntries.map((entry) => {
    const previews = replacementMap
      .filter(item => item.term === entry.term)
      .slice(0, 3)
      .map(item => ({
        occurrenceIndex: Number(item.occurrenceIndex || 0),
        snippet: getPreviewText(`${item.contextBefore}[${item.term}]${item.contextAfter}`, 80),
        start: Number(item.originalStart || 0),
        end: Number(item.originalEnd || 0)
      }))
    return {
      ...entry,
      occurrenceCount: occurrenceByTerm.get(entry.term) || 0,
      hitPreviews: previews
    }
  })

  return {
    declassifiedText: outputParts.join(''),
    replacementMap,
    keywordEntries: enrichedKeywordEntries,
    matchedKeywordEntries: enrichedKeywordEntries
      .filter(item => item.occurrenceCount > 0)
      .sort((a, b) => Number(b.occurrenceCount || 0) - Number(a.occurrenceCount || 0) || String(b.term || '').length - String(a.term || '').length),
    unmatchedKeywordEntries: enrichedKeywordEntries.filter(item => item.occurrenceCount === 0)
  }
}

export function parseSecretKeywordAssistantOutput(output, documentText = '') {
  const parsed = parseJsonSafe(extractJsonCandidate(output))
  const keywords = Array.isArray(parsed?.keywords) ? parsed.keywords : []
  return normalizeKeywordEntries(keywords, documentText)
}

export function buildDeclassifyPreview(keywordEntries, text = getDocumentText()) {
  return buildReplacementPlan(text, keywordEntries)
}

export async function extractSecretKeywordsFromDocument() {
  const originalText = getDocumentText()
  if (!String(originalText || '').trim()) {
    throw new Error('当前文档没有可处理的文本内容')
  }
  const definition = getBuiltinAssistantDefinition(SECRET_KEYWORD_ASSISTANT_ID)
  const config = getAssistantSetting(SECRET_KEYWORD_ASSISTANT_ID) || {}
  if (!definition) {
    throw new Error('未找到涉密关键词提取助手配置')
  }
  if (config.enabled === false) {
    throw new Error('涉密关键词提取助手已被关闭，请先在设置中启用')
  }
  const model = resolveSecretKeywordAssistantModel(config, definition)
  if (!model?.providerId || !model?.modelId) {
    throw new Error('未找到可用模型，请先在设置中配置涉密关键词提取助手')
  }

  const extractionTaskId = createDeclassifyLifecycleTask('涉密关键词提取', {
    operationKind: 'secret-keyword-extract',
    documentAction: 'none',
    configuredInputSource: 'document',
    inputSource: 'document',
    chunkSource: 'document',
    outputFormat: 'json',
    inputPreview: getPreviewText(originalText),
    modelId: model.id,
    modelDisplayName: model.name || model.modelId,
    modelProviderId: model.providerId,
    launchSource: 'document-declassify-dialog',
    strictAssistantDefaults: true,
    progressStage: 'calling_model'
  })

  let assistantOutput = ''
  let strategyTrace = []
  try {
    const request = {
      providerId: model.providerId,
      modelId: model.modelId,
      temperature: Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 0.1,
      messages: buildSecretKeywordAssistantMessages(originalText, definition, config),
      response_format: SECRET_KEYWORD_RESPONSE_FORMAT
    }
    updateTask(extractionTaskId, {
      progress: 35,
      data: {
        assistantId: SECRET_KEYWORD_ASSISTANT_ID,
        operationKind: 'secret-keyword-extract',
        documentAction: 'none',
        configuredInputSource: 'document',
        inputSource: 'document',
        chunkSource: 'document',
        outputFormat: 'json',
        inputPreview: getPreviewText(originalText),
        modelId: model.id,
        modelDisplayName: model.name || model.modelId,
        modelProviderId: model.providerId,
        launchSource: 'document-declassify-dialog',
        strictAssistantDefaults: true,
        progressEvents: ['正在分析全文并提取涉密关键词...'],
        progressStage: 'calling_model'
      }
    })
    try {
      assistantOutput = String(await chatCompletion(request) || '')
    } catch (error) {
      if (!isUnsupportedResponseFormatError(error)) throw error
      strategyTrace = ['drop_response_format']
      assistantOutput = String(await chatCompletion({
        ...request,
        response_format: undefined
      }) || '')
    }
    const keywordEntries = parseSecretKeywordAssistantOutput(assistantOutput, originalText)
    const preview = buildReplacementPlan(originalText, keywordEntries)
    const normalizedOutput = JSON.stringify({
      keywords: preview.keywordEntries.map(item => ({
        term: item.term,
        replacementToken: item.replacementToken,
        category: item.category,
        riskLevel: item.riskLevel,
        reason: item.reason,
        occurrenceCount: item.occurrenceCount,
        hitPreviews: item.hitPreviews
      })),
      matchedKeywordCount: preview.matchedKeywordEntries.length,
      replacementCount: preview.replacementMap.length,
      strategyTrace
    }, null, 2)
    completeDeclassifyLifecycleTask(extractionTaskId, {
      operationKind: 'secret-keyword-extract',
      documentAction: 'none',
      configuredInputSource: 'document',
      inputSource: 'document',
      chunkSource: 'document',
      outputFormat: 'json',
      inputPreview: getPreviewText(originalText),
      outputPreview: getPreviewText(preview.keywordEntries.map(item => item.term).join('、') || assistantOutput),
      fullOutput: normalizedOutput,
      assistantRawOutput: assistantOutput,
      keywordSummary: preview.keywordEntries.map(item => item.term).join('、'),
      matchedKeywordCount: preview.matchedKeywordEntries.length,
      replacementCount: preview.replacementMap.length,
      modelId: model.id,
      modelDisplayName: model.name || model.modelId,
      modelProviderId: model.providerId,
      launchSource: 'document-declassify-dialog',
      strictAssistantDefaults: true,
      strategyTrace,
      progressEvents: [
        '正在分析全文并提取涉密关键词...',
        `已提取 ${preview.keywordEntries.length} 个候选关键词，命中 ${preview.matchedKeywordEntries.length} 个。`
      ]
    })
    return {
      originalText,
      assistantOutput,
      extractionTaskId,
      keywordEntries,
      preview
    }
  } catch (error) {
    failDeclassifyLifecycleTask(extractionTaskId, error, {
      operationKind: 'secret-keyword-extract',
      documentAction: 'none',
      configuredInputSource: 'document',
      inputSource: 'document',
      chunkSource: 'document',
      outputFormat: 'json',
      inputPreview: getPreviewText(originalText),
      fullOutput: assistantOutput,
      modelId: model.id,
      modelDisplayName: model.name || model.modelId,
      modelProviderId: model.providerId,
      launchSource: 'document-declassify-dialog',
      strictAssistantDefaults: true,
      strategyTrace
    })
    throw error
  }
}

export function getCurrentDeclassifyStatus() {
  const doc = getActiveDocument()
  const state = getDeclassifyState(doc)
  return {
    isDeclassified: Boolean(state && state.status === 'declassified'),
    state
  }
}

export async function applyDocumentDeclassify(options = {}) {
  const doc = getActiveDocument()
  if (!doc) {
    throw new Error('当前没有打开文档')
  }
  if (isDocumentDeclassified(doc)) {
    throw new Error('当前文档已经处于脱密状态，无需重复脱密')
  }

  const originalText = getDocumentText()
  if (!String(originalText || '').trim()) {
    throw new Error('当前文档没有可处理的文本内容')
  }

  const lifecycleTaskId = createDeclassifyLifecycleTask('占位符脱密', {
    operationKind: 'document-declassify',
    documentAction: 'replace',
    configuredInputSource: 'document',
    inputSource: 'document',
    chunkSource: 'document',
    outputFormat: 'json',
    inputPreview: getPreviewText(originalText),
    fullOutput: String(options.assistantOutput || ''),
    relatedTaskId: String(options.extractionTaskId || ''),
    progressStage: 'validating'
  })

  const password = String(options.password || '')
  const validation = validateDeclassifyPassword(password)
  if (!validation.ok) {
    const error = new Error(validation.errors[0] || '密码强度不符合要求')
    failDeclassifyLifecycleTask(lifecycleTaskId, error, {
      operationKind: 'document-declassify',
      documentAction: 'replace',
      configuredInputSource: 'document',
      inputSource: 'document',
      chunkSource: 'document',
      outputFormat: 'json',
      fullOutput: String(options.assistantOutput || '')
    })
    throw error
  }

  const normalizedKeywordEntries = normalizeKeywordEntries(options.keywordEntries, originalText)
  if (normalizedKeywordEntries.length === 0) {
    const error = new Error('请至少保留一个涉密关键词')
    failDeclassifyLifecycleTask(lifecycleTaskId, error, {
      operationKind: 'document-declassify',
      documentAction: 'replace',
      configuredInputSource: 'document',
      inputSource: 'document',
      chunkSource: 'document',
      outputFormat: 'json',
      fullOutput: String(options.assistantOutput || '')
    })
    throw error
  }

  const preview = buildReplacementPlan(originalText, normalizedKeywordEntries)
  if (preview.replacementMap.length === 0) {
    const error = new Error('所选关键词未在当前文档中命中，无法执行占位符脱密')
    failDeclassifyLifecycleTask(lifecycleTaskId, error, {
      operationKind: 'document-declassify',
      documentAction: 'replace',
      configuredInputSource: 'document',
      inputSource: 'document',
      chunkSource: 'document',
      outputFormat: 'json',
      fullOutput: String(options.assistantOutput || '')
    })
    throw error
  }

  updateTask(lifecycleTaskId, {
    progress: 55,
    data: {
      assistantId: SECRET_KEYWORD_ASSISTANT_ID,
      operationKind: 'document-declassify',
      documentAction: 'replace',
      configuredInputSource: 'document',
      inputSource: 'document',
      chunkSource: 'document',
      outputFormat: 'json',
      inputPreview: getPreviewText(originalText),
      outputPreview: getPreviewText(preview.declassifiedText),
      fullOutput: JSON.stringify({
        keywords: preview.keywordEntries.map(item => ({
          term: item.term,
          category: item.category,
          riskLevel: item.riskLevel,
          replacementToken: item.replacementToken,
          occurrenceCount: item.occurrenceCount
        }))
      }, null, 2),
      keywordSummary: preview.keywordEntries.map(item => item.term).join('、'),
      relatedTaskId: String(options.extractionTaskId || ''),
      progressStage: 'applying_result'
    }
  })

  const createdAt = new Date().toISOString()
  const originalTextHash = await fingerprintText(originalText)
  const declassifiedTextHash = await fingerprintText(preview.declassifiedText)
  const payload = {
    version: 1,
    createdAt,
    createdByAssistant: SECRET_KEYWORD_ASSISTANT_ID,
    assistantOutput: String(options.assistantOutput || ''),
    originalText,
    declassifiedText: preview.declassifiedText,
    keywordEntries: preview.keywordEntries,
    replacementMap: preview.replacementMap,
    textHashes: {
      original: originalTextHash,
      declassified: declassifiedTextHash
    }
  }
  const envelope = await encryptPayload(password, payload)

  try {
    replaceTextByRanges(doc, preview.replacementMap, 'declassify')
    // 关键修复:脱密写回后,从【实际文档】重新读取并计算指纹作为复原基线,
    // 而不是用内存中构造的 preview.declassifiedText。WPS 写回会规范化换行/段落标记,
    // 二者哈希必然不同,导致复原时「内容已发生变化」误判、永远无法复原(用户实测)。
    // 以实际文档文本为基线,未改动时与复原处的 getDocumentText() 完全一致,即可正确比对。
    let appliedDeclassifiedTextHash
    try {
      appliedDeclassifiedTextHash = await fingerprintText(getDocumentText())
    } catch (_) {
      // 读取实际文档失败则退回构造文本的哈希,不阻断脱密
      appliedDeclassifiedTextHash = declassifiedTextHash
    }
    saveDeclassifyState(doc, {
      placeholderPrefix: TOKEN_WRAPPER,
      keywordCount: preview.matchedKeywordEntries.length,
      replacementCount: preview.replacementMap.length,
      originalTextHash,
      declassifiedTextHash: appliedDeclassifiedTextHash,
      createdAt,
      algorithm: envelope.algorithm,
      kdf: `${envelope?.keyDerivation?.name || 'PBKDF2'}-${envelope?.keyDerivation?.hash || 'SHA-256'}`
    }, envelope)
  } catch (error) {
    try {
      writeWholeDocumentText(originalText)
    } catch (_) {}
    failDeclassifyLifecycleTask(lifecycleTaskId, error, {
      operationKind: 'document-declassify',
      documentAction: 'replace',
      configuredInputSource: 'document',
      inputSource: 'document',
      chunkSource: 'document',
      outputFormat: 'json',
      inputPreview: getPreviewText(originalText),
      outputPreview: getPreviewText(preview.declassifiedText),
      fullOutput: JSON.stringify({
        keywords: preview.keywordEntries.map(item => ({
          term: item.term,
          category: item.category,
          riskLevel: item.riskLevel,
          replacementToken: item.replacementToken,
          occurrenceCount: item.occurrenceCount
        }))
      }, null, 2),
      keywordSummary: preview.keywordEntries.map(item => item.term).join('、'),
      relatedTaskId: String(options.extractionTaskId || '')
    })
    throw error
  }

  completeDeclassifyLifecycleTask(lifecycleTaskId, {
    operationKind: 'document-declassify',
    documentAction: 'replace',
    configuredInputSource: 'document',
    inputSource: 'document',
    chunkSource: 'document',
    outputFormat: 'json',
    inputPreview: getPreviewText(originalText),
    outputPreview: getPreviewText(preview.declassifiedText),
    commentPreview: `已完成占位符脱密，替换 ${preview.replacementMap.length} 处，涉及 ${preview.matchedKeywordEntries.length} 个关键词。`,
    applyResult: {
      ok: true,
      action: 'replace',
      message: '已完成占位符脱密并写入文档'
    },
    fullOutput: JSON.stringify({
      keywords: preview.keywordEntries.map(item => ({
        term: item.term,
        category: item.category,
        riskLevel: item.riskLevel,
        replacementToken: item.replacementToken,
        occurrenceCount: item.occurrenceCount
      })),
      replacementCount: preview.replacementMap.length
    }, null, 2),
    keywordSummary: preview.keywordEntries.map(item => item.term).join('、'),
    matchedKeywordCount: preview.matchedKeywordEntries.length,
    replacementCount: preview.replacementMap.length,
    relatedTaskId: String(options.extractionTaskId || '')
  })

  invalidateDeclassifyRibbonControls()
  return {
    keywordEntries: preview.keywordEntries,
    replacementCount: preview.replacementMap.length,
    matchedKeywordCount: preview.matchedKeywordEntries.length,
    unmatchedKeywordCount: preview.unmatchedKeywordEntries.length
  }
}

export async function restoreDocumentDeclassify(password) {
  const doc = getActiveDocument()
  if (!doc) {
    throw new Error('当前没有打开文档')
  }

  const lifecycleTaskId = createDeclassifyLifecycleTask('密码复原', {
    operationKind: 'document-declassify-restore',
    documentAction: 'replace',
    configuredInputSource: 'document',
    inputSource: 'document',
    chunkSource: 'document',
    outputFormat: 'plain',
    inputPreview: getPreviewText(getDocumentText()),
    progressStage: 'validating'
  })

  const state = getDeclassifyState(doc)
  if (!state || state.status !== 'declassified') {
    const error = new Error('当前文档不是脱密状态，无法执行复原')
    failDeclassifyLifecycleTask(lifecycleTaskId, error, {
      operationKind: 'document-declassify-restore',
      documentAction: 'replace',
      configuredInputSource: 'document',
      inputSource: 'document',
      chunkSource: 'document',
      outputFormat: 'plain'
    })
    throw error
  }

  const envelope = getDeclassifyEnvelope(doc)
  try {
    const payload = await decryptPayload(String(password || ''), envelope)
    const currentText = getDocumentText()
    const currentTextHash = await fingerprintText(currentText)
    const expectedHash = String(
      state.declassifiedTextHash || payload?.textHashes?.declassified || ''
    )

    if (!payload || typeof payload !== 'object') {
      throw new Error('脱密载荷已损坏，无法复原')
    }
    // 文档在脱密后被编辑(增删改)不再拦截:复原改为按占位符 token 就地查找替换,
    // 可在文档变化后尽力还原。documentEdited 仅用于结果提示。
    const documentEdited = !!(expectedHash && currentTextHash !== expectedHash)

    updateTask(lifecycleTaskId, {
      progress: 70,
      data: {
        assistantId: SECRET_KEYWORD_ASSISTANT_ID,
        operationKind: 'document-declassify-restore',
        documentAction: 'replace',
        configuredInputSource: 'document',
        inputSource: 'document',
        chunkSource: 'document',
        outputFormat: 'plain',
        inputPreview: getPreviewText(currentText),
        keywordSummary: Array.isArray(payload.keywordEntries)
          ? payload.keywordEntries.map(item => item.term).join('、')
          : '',
        progressStage: 'applying_result'
      }
    })

    const originalText = String(payload.originalText || '')
    const savedReplacementMap = Array.isArray(payload.replacementMap) ? payload.replacementMap : []
    let restoreSummary = { restoredOccurrences: 0, totalTokens: 0, missingTokens: [], failed: 0 }
    if (savedReplacementMap.length > 0) {
      // 按占位符 token 就地查找替换:文档脱密后被编辑也能尽力还原,且保留排版
      restoreSummary = restoreDeclassifyByTokens(doc, savedReplacementMap)
      if (restoreSummary.totalTokens > 0 && restoreSummary.restoredOccurrences === 0) {
        throw new Error('未找到任何脱密占位符，无法还原（占位符可能已被全部删除或改动）。文档未改动，可撤销编辑后重试。')
      }
    } else {
      writeWholeDocumentText(originalText)
    }
    const missingCount = restoreSummary.missingTokens.length
    clearDeclassifyState(doc)
    invalidateDeclassifyRibbonControls()

    completeDeclassifyLifecycleTask(lifecycleTaskId, {
      operationKind: 'document-declassify-restore',
      documentAction: 'replace',
      configuredInputSource: 'document',
      inputSource: 'document',
      chunkSource: 'document',
      outputFormat: 'plain',
      inputPreview: getPreviewText(currentText),
      outputPreview: getPreviewText(originalText),
      commentPreview: missingCount > 0
        ? `已尽力复原:还原 ${restoreSummary.restoredOccurrences} 处;另有 ${missingCount} 个占位符未找到(脱密后可能被删除或改动),未还原。`
        : (documentEdited
          ? `已复原 ${restoreSummary.restoredOccurrences} 处(文档脱密后有改动,已按占位符就地还原)。`
          : `已完成密码复原，恢复 ${restoreSummary.restoredOccurrences || Number(state.replacementCount || 0)} 处替换。`),
      applyResult: {
        ok: true,
        action: 'replace',
        message: '已恢复文档原文'
      },
      fullOutput: String(originalText || ''),
      keywordSummary: Array.isArray(payload.keywordEntries)
        ? payload.keywordEntries.map(item => item.term).join('、')
        : '',
      keywordCount: Number(state.keywordCount || 0),
      replacementCount: Number(state.replacementCount || 0)
    })

    return {
      restored: true,
      keywordCount: Number(state.keywordCount || 0),
      replacementCount: Number(state.replacementCount || 0),
      restoredOccurrences: restoreSummary.restoredOccurrences,
      missingTokenCount: missingCount,
      documentEdited
    }
  } catch (error) {
    failDeclassifyLifecycleTask(lifecycleTaskId, error, {
      operationKind: 'document-declassify-restore',
      documentAction: 'replace',
      configuredInputSource: 'document',
      inputSource: 'document',
      chunkSource: 'document',
      outputFormat: 'plain'
    })
    throw error
  }
}
