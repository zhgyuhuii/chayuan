import { runAssistantTask, startAssistantTask } from './assistantTaskRunner.js'
import {
  genId,
  loadRulesFromDoc,
  normalizeConstraints,
  normalizeRule,
  saveRulesToDoc,
  validateRuleValue
} from './templateRules.js'

export const FORM_FIELD_EXTRACT_ASSISTANT_ID = 'analysis.form-field-extract'

function getActiveDocument() {
  return window.Application?.ActiveDocument || null
}

function getRawDocumentText() {
  return String(getActiveDocument()?.Content?.Text || '')
}

function buildNormalizedTextMap(rawText) {
  let normalized = ''
  const normalizedToRaw = []
  let rawIndex = 0

  while (rawIndex < rawText.length) {
    normalizedToRaw[normalized.length] = rawIndex
    const current = rawText[rawIndex]
    if (current === '\r') {
      normalized += '\n'
      if (rawText[rawIndex + 1] === '\n') rawIndex += 2
      else rawIndex += 1
      continue
    }
    normalized += current
    rawIndex += 1
  }
  normalizedToRaw[normalized.length] = rawText.length
  return {
    rawText,
    normalizedText: normalized,
    normalizedToRaw
  }
}

function normalizedIndexToRawIndex(mapInfo, normalizedIndex) {
  return mapInfo.normalizedToRaw[Math.max(0, Math.min(normalizedIndex, mapInfo.normalizedToRaw.length - 1))]
}

function safeJsonParse(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (_) {
    return null
  }
}

function extractJsonCandidate(output) {
  const source = String(output || '').trim()
  if (!source) return ''
  if (source.startsWith('{') || source.startsWith('[')) return source
  const fencedMatch = source.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) return fencedMatch[1].trim()
  const firstBrace = source.indexOf('{')
  const lastBrace = source.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return source.slice(firstBrace, lastBrace + 1)
  }
  return source
}

function normalizeBoolean(value, fallback = false) {
  if (value === true || value === false) return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function normalizeDetectedInstances(list) {
  const deduped = new Map()
  ;(Array.isArray(list) ? list : [])
    .map(item => ({
      value: String(item?.value || '').trim(),
      prefix: String(item?.prefix || '').trim(),
      suffix: String(item?.suffix || '').trim(),
      groupKey: String(item?.groupKey || '').trim(),
      groupLabel: String(item?.groupLabel || '').trim()
    }))
    .filter(item => item.value)
    .forEach((item) => {
      const key = [item.value, item.groupKey, item.groupLabel, item.prefix, item.suffix].join('||')
      if (!deduped.has(key)) deduped.set(key, item)
    })
  return Array.from(deduped.values())
}

function inferSemanticKey(name, tag = '') {
  const source = `${name} ${tag}`
  if (/甲方/.test(source)) return 'partyA'
  if (/乙方/.test(source)) return 'partyB'
  if (/丙方/.test(source)) return 'partyC'
  if (/金额|价款|总价|合同价/.test(source)) return 'contractAmount'
  if (/地址|住址|所在地/.test(source)) return 'contractAddress'
  if (/签署日期|签订日期|签约日期/.test(source)) return 'signDate'
  if (/开始日期|起始日期|生效日期/.test(source)) return 'startDate'
  if (/结束日期|截止日期|终止日期|到期日期/.test(source)) return 'endDate'
  if (/联系电话|电话|手机/.test(source)) return 'contactPhone'
  if (/联系人/.test(source)) return 'contactPerson'
  if (/邮箱/.test(source)) return 'contactEmail'
  if (/编号|合同号|编码/.test(source)) return 'contractNumber'
  if (/网址|网站/.test(source)) return 'website'
  if (/项目名称|项目/.test(source)) return 'projectName'
  return ''
}

function inferDataType(field) {
  const name = String(field?.name || '')
  const semanticKey = String(field?.semanticKey || '')
  const sample = String(field?.sampleValue || field?.sampleContent || field?.detectedInstances?.[0]?.value || '').trim()
  if (/金额|价款|总价/.test(name) || semanticKey === 'contractAmount') return sample && /^\d+$/.test(sample) ? 'integer' : 'decimal'
  if (/日期/.test(name) || /Date$/.test(semanticKey)) return 'date'
  if (/时间/.test(name) || semanticKey === 'signDateTime') return 'datetime'
  if (/电话|手机/.test(name) || semanticKey === 'contactPhone') return 'phone'
  if (/邮箱/.test(name) || semanticKey === 'contactEmail') return 'email'
  if (/网址|网站/.test(name) || semanticKey === 'website') return 'url'
  if (/编号|合同号|编码/.test(name) || semanticKey === 'contractNumber') return 'string'
  return String(field?.dataType || 'string')
}

function inferReviewType(field) {
  const semanticKey = String(field?.semanticKey || '')
  const name = String(field?.name || '')
  if (semanticKey === 'contractAmount' || /金额|价款|总价/.test(name)) return 'range'
  if (/日期/.test(name) || /Date$/.test(semanticKey)) return 'logic'
  if (semanticKey === 'contractNumber' || /编号|合同号|编码/.test(name)) return 'regex'
  if (/甲方|乙方|丙方|单位|主体/.test(name)) return 'llm'
  return String(field?.reviewType || 'none')
}

function inferReviewRule(field, dataType, reviewType) {
  const semanticKey = String(field?.semanticKey || '')
  const name = String(field?.name || '')
  if (reviewType === 'regex' && (semanticKey === 'contractNumber' || /编号|合同号|编码/.test(name))) {
    return '^[A-Za-z0-9\\-_/]{4,}$'
  }
  if (reviewType === 'range' && dataType === 'decimal') {
    return '0,999999999999'
  }
  if (reviewType === 'llm' && /甲方|乙方|丙方|单位|主体/.test(name)) {
    return `判断该值是否为文档中的${name}正式主体名称，是否完整且与上下文一致`
  }
  if (reviewType === 'logic' && /日期/.test(name)) {
    return `判断该${name}是否与文档上下文中的前后日期关系一致`
  }
  return String(field?.reviewRule || '')
}

function inferFieldPriority(field) {
  const semanticKey = String(field?.semanticKey || '')
  const name = String(field?.name || '')
  if (semanticKey === 'partyA' || /甲方/.test(name)) return 1
  if (semanticKey === 'partyB' || /乙方/.test(name)) return 2
  if (semanticKey === 'contractAmount' || /金额|价款|总价/.test(name)) return 3
  if (semanticKey === 'signDate' || /签署日期|签订日期/.test(name)) return 4
  if (semanticKey === 'contractAddress' || /地址|住址/.test(name)) return 5
  return 50
}

function buildDefaultSampleValue(field) {
  const name = String(field?.name || '')
  const semanticKey = String(field?.semanticKey || '')
  const dataType = String(field?.dataType || 'string')
  const firstDetected = String(field?.detectedInstances?.[0]?.value || '').trim()
  if (firstDetected && (field?.sampleContentMode === 'keep' || !field?.sampleContent)) {
    return firstDetected
  }
  if (semanticKey === 'partyA' || semanticKey === 'partyB' || semanticKey === 'partyC') return '某某科技有限公司'
  if (semanticKey === 'contractAmount') return dataType === 'integer' ? '1000000' : '1000000.00'
  if (semanticKey === 'contractAddress') return '北京市朝阳区示例路 88 号'
  if (semanticKey === 'signDate' || semanticKey === 'startDate' || semanticKey === 'endDate') return '2026-03-08'
  if (semanticKey === 'contactPhone') return '13800138000'
  if (semanticKey === 'contactEmail') return 'example@example.com'
  if (semanticKey === 'contractNumber') return 'HT-2026-001'
  if (/甲方|乙方|丙方|单位|公司|主体/.test(name)) return '某某科技有限公司'
  if (/金额|价款|总价|合同价/.test(name)) return dataType === 'integer' ? '1000000' : '1000000.00'
  if (/地址|住址|所在地/.test(name)) return '北京市朝阳区示例路 88 号'
  if (/日期|时间|签署/.test(name)) {
    if (dataType === 'datetime') return '2026-03-08T10:00'
    if (dataType === 'time') return '10:00'
    return '2026-03-08'
  }
  if (/电话|手机|联系方式/.test(name)) return '13800138000'
  if (/邮箱/.test(name)) return 'example@example.com'
  if (/网址|网站/.test(name)) return 'https://example.com'
  if (/编号|编码|合同号/.test(name)) return 'HT-2026-001'
  return '示例内容'
}

function normalizeExtractedField(field) {
  const source = field && typeof field === 'object' ? field : {}
  const semanticKey = String(source.semanticKey || inferSemanticKey(source.name, source.tag)).trim()
  const rawDataType = inferDataType({ ...source, semanticKey })
  const reviewType = inferReviewType({ ...source, semanticKey, dataType: rawDataType })
  const constraints = normalizeConstraints(source.constraints, rawDataType)
  return normalizeRule({
    id: String(source.id || ''),
    name: String(source.name || '').trim(),
    semanticKey,
    fillHint: String(source.fillHint || '').trim(),
    tag: String(source.tag || '').trim(),
    required: normalizeBoolean(source.required, false),
    dataType: rawDataType,
    constraints,
    reviewType,
    reviewRule: inferReviewRule(source, rawDataType, reviewType).trim(),
    reviewHint: String(source.reviewHint || '').trim(),
    remark: String(source.remark || '由表单智能提取助手生成').trim(),
    sampleContentMode: ['keep', 'clear', 'example'].includes(String(source.sampleContentMode || ''))
      ? String(source.sampleContentMode)
      : 'keep',
    sampleContent: String(source.sampleContent || source.sampleValue || '').trim(),
    auditEnabled: normalizeBoolean(source.auditEnabled, true),
    auditPriority: Number(source.auditPriority) || 50,
    instanceStrategy: ['semantic-group', 'per-instance'].includes(String(source.instanceStrategy || ''))
      ? String(source.instanceStrategy)
      : 'semantic-group',
    extractionHints: String(source.extractionHints || '').trim(),
    detectedInstances: normalizeDetectedInstances(source.detectedInstances),
    sampleValue: String(source.sampleValue || '').trim()
  })
}

function normalizeExtractedFields(fields) {
  const map = new Map()
  ;(Array.isArray(fields) ? fields : []).forEach((field) => {
    const normalized = normalizeExtractedField(field)
    if (!normalized.name) return
    const key = normalized.semanticKey || normalized.name
    const existing = map.get(key)
    if (!existing) {
      map.set(key, normalized)
      return
    }
    map.set(key, {
      ...existing,
      ...normalized,
      id: existing.id || normalized.id,
      detectedInstances: [...(existing.detectedInstances || []), ...(normalized.detectedInstances || [])]
    })
  })
  return Array.from(map.values())
    .map((field) => ({
      ...field,
      sampleContent: field.sampleContent || field.sampleValue || buildDefaultSampleValue(field)
    }))
    .sort((a, b) => {
      const priorityDiff = inferFieldPriority(a) - inferFieldPriority(b)
      if (priorityDiff !== 0) return priorityDiff
      const aCount = Array.isArray(a.detectedInstances) ? a.detectedInstances.length : 0
      const bCount = Array.isArray(b.detectedInstances) ? b.detectedInstances.length : 0
      if (aCount !== bCount) return bCount - aCount
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN')
    })
}

function findRuleMatch(existingRules, field) {
  const semanticKey = String(field.semanticKey || '').trim()
  if (semanticKey) {
    const bySemantic = existingRules.find(item => String(item.semanticKey || '').trim() === semanticKey)
    if (bySemantic) return bySemantic
  }
  return existingRules.find(item => String(item.name || '').trim() === String(field.name || '').trim()) || null
}

function mergeExtractedFieldsIntoRules(existingRules, extractedFields) {
  const merged = [...existingRules]
  const resolved = []

  extractedFields.forEach((field) => {
    const matched = findRuleMatch(merged, field)
    const mergedRule = normalizeRule({
      ...(matched || {}),
      ...field,
      id: matched?.id || field.id || genId(),
      sampleContent: field.sampleContent || matched?.sampleContent || buildDefaultSampleValue(field)
    })
    const index = matched ? merged.findIndex(item => item.id === matched.id) : -1
    if (index >= 0) merged.splice(index, 1, mergedRule)
    else merged.push(mergedRule)
    resolved.push(mergedRule)
  })

  return {
    mergedRules: merged,
    resolvedRules: resolved
  }
}

function findAllOccurrences(text, needle) {
  const positions = []
  if (!needle) return positions
  let startIndex = 0
  while (startIndex <= text.length) {
    const foundIndex = text.indexOf(needle, startIndex)
    if (foundIndex < 0) break
    positions.push(foundIndex)
    startIndex = foundIndex + needle.length
  }
  return positions
}

function locateInstance(normalizedText, usedRanges, instance) {
  const candidates = findAllOccurrences(normalizedText, instance.value)
  for (const start of candidates) {
    const end = start + instance.value.length
    const conflict = usedRanges.some(item => !(end <= item.start || start >= item.end))
    if (conflict) continue
    const prefixOk = !instance.prefix || normalizedText.slice(Math.max(0, start - instance.prefix.length), start) === instance.prefix
    const suffixOk = !instance.suffix || normalizedText.slice(end, end + instance.suffix.length) === instance.suffix
    if (prefixOk && suffixOk) {
      usedRanges.push({ start, end })
      return { start, end }
    }
  }
  for (const start of candidates) {
    const end = start + instance.value.length
    const conflict = usedRanges.some(item => !(end <= item.start || start >= item.end))
    if (conflict) continue
    usedRanges.push({ start, end })
    return { start, end }
  }
  return null
}

function sanitizeBookmarkName(value) {
  return String(value || '').replace(/\s+/g, '_').replace(/[^\w\u4e00-\u9fa5_-]/g, '')
}

function collectExistingBookmarkMetadata(doc) {
  const items = []
  const bookmarks = doc?.Bookmarks
  if (!bookmarks) return items
  for (let i = 1; i <= bookmarks.Count; i += 1) {
    try {
      const bookmark = bookmarks.Item(i)
      items.push({
        name: String(bookmark?.Name || ''),
        start: Number(bookmark?.Range?.Start || 0),
        end: Number(bookmark?.Range?.End || 0)
      })
    } catch (_) {}
  }
  return items
}

function getNextBookmarkSeq(doc, baseName) {
  const prefix = `${baseName}_`
  let maxSeq = 0
  const bookmarks = doc?.Bookmarks
  if (!bookmarks) return 1
  for (let i = 1; i <= bookmarks.Count; i += 1) {
    try {
      const name = String(bookmarks.Item(i)?.Name || '')
      if (name.startsWith(prefix)) {
        const seq = Number(name.slice(prefix.length))
        if (Number.isFinite(seq)) maxSeq = Math.max(maxSeq, seq)
      }
    } catch (_) {}
  }
  return maxSeq + 1
}

function buildBookmarkOperations(doc, resolvedRules, extractedFields, mapInfo) {
  const existingBookmarks = collectExistingBookmarkMetadata(doc)
  const usedRanges = existingBookmarks.map(item => ({
    start: item.start,
    end: item.end
  }))
  const operations = []

  extractedFields.forEach((field) => {
    const rule = resolvedRules.find(item => item.id === field.id || item.semanticKey === field.semanticKey || item.name === field.name)
    if (!rule) return
    const baseName = `${sanitizeBookmarkName(rule.name)}_${rule.id}`
    let seq = getNextBookmarkSeq(doc, baseName)
    ;(field.detectedInstances || []).forEach((instance) => {
      const normalizedRange = locateInstance(mapInfo.normalizedText, usedRanges, instance)
      if (!normalizedRange) return
      const rawStart = normalizedIndexToRawIndex(mapInfo, normalizedRange.start)
      const rawEnd = normalizedIndexToRawIndex(mapInfo, normalizedRange.end)
      const duplicate = existingBookmarks.some(item => item.start === rawStart && item.end === rawEnd && item.name.startsWith(`${baseName}_`))
      if (duplicate) return
      operations.push({
        bookmarkName: `${baseName}_${seq}`,
        rule,
        field,
        rawStart,
        rawEnd,
        mode: field.sampleContentMode || 'keep',
        replacementText: field.sampleContentMode === 'example'
          ? (field.sampleContent || buildDefaultSampleValue(field))
          : ''
      })
      seq += 1
    })
  })

  return operations
}

function applyBookmarkOperations(doc, operations) {
  const sorted = operations.slice().sort((a, b) => b.rawStart - a.rawStart)
  sorted.forEach((operation) => {
    const range = doc.Range(operation.rawStart, operation.rawEnd)
    let bookmarkRange = range
    if (operation.mode === 'clear') {
      range.Text = ''
      bookmarkRange = doc.Range(operation.rawStart, operation.rawStart)
    } else if (operation.mode === 'example') {
      range.Text = String(operation.replacementText || '')
      bookmarkRange = doc.Range(operation.rawStart, operation.rawStart + String(operation.replacementText || '').length)
    }
    doc.Bookmarks.Add(operation.bookmarkName, bookmarkRange)
  })
}

export async function extractFormFieldsFromDocument() {
  const result = await runAssistantTask(FORM_FIELD_EXTRACT_ASSISTANT_ID, {
    inputSource: 'document',
    documentAction: 'none',
    taskTitle: '表单智能提取'
  })
  const output = String(result?.output || '')
  const parsed = safeJsonParse(extractJsonCandidate(output))
  const fields = normalizeExtractedFields(parsed?.fields)
  return {
    extractionTaskId: String(result?.taskId || ''),
    assistantOutput: output,
    fields
  }
}

export function startFormFieldExtractTask(overrides = {}) {
  const { taskId, promise } = startAssistantTask(FORM_FIELD_EXTRACT_ASSISTANT_ID, {
    inputSource: 'document',
    documentAction: 'none',
    taskTitle: '表单智能提取',
    ...overrides
  })

  return {
    taskId: String(taskId || ''),
    promise: promise.then((result) => {
      const output = String(result?.output || '')
      const parsed = safeJsonParse(extractJsonCandidate(output))
      return {
        extractionTaskId: String(result?.taskId || taskId || ''),
        assistantOutput: output,
        fields: normalizeExtractedFields(parsed?.fields)
      }
    })
  }
}

export function saveExtractedFieldsToRulesAndBookmarks(fields) {
  const doc = getActiveDocument()
  if (!doc) {
    throw new Error('当前没有打开文档')
  }
  const normalizedFields = normalizeExtractedFields(fields)
  if (normalizedFields.length === 0) {
    throw new Error('没有可保存的字段规则')
  }

  const existingRules = loadRulesFromDoc()
  const { mergedRules, resolvedRules } = mergeExtractedFieldsIntoRules(existingRules, normalizedFields)
  saveRulesToDoc(mergedRules)

  const mapInfo = buildNormalizedTextMap(getRawDocumentText())
  const bookmarkOperations = buildBookmarkOperations(
    doc,
    resolvedRules,
    normalizedFields.map((field) => {
      const resolvedRule = resolvedRules.find(item => item.semanticKey === field.semanticKey || item.name === field.name)
      return { ...field, id: resolvedRule?.id || field.id }
    }),
    mapInfo
  )
  if (bookmarkOperations.length > 0) {
    applyBookmarkOperations(doc, bookmarkOperations)
  }

  return {
    savedRules: mergedRules,
    resolvedRules,
    bookmarkOperationsCount: bookmarkOperations.length
  }
}

export function buildFieldDraftForDialog(field) {
  const normalized = normalizeExtractedField(field)
  return {
    ...normalized,
    localId: normalized.id || `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sampleContent: normalized.sampleContent || buildDefaultSampleValue(normalized),
    detectedInstances: normalizeDetectedInstances(normalized.detectedInstances)
  }
}

export function buildFieldValidationPreview(field, value) {
  return validateRuleValue(field, value)
}
