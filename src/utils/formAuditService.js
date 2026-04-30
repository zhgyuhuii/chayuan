import { chatCompletion } from './chatApi.js'
import { addTask, getTaskById, updateTask } from './taskListStore.js'
import { getBuiltinAssistantDefinition } from './assistantRegistry.js'
import { getAssistantSetting, getConfiguredAssistantModelId } from './assistantSettings.js'
import { getFlatModelsFromSettings, parseModelCompositeId } from './modelSettings.js'
import { inferModelType, matchesModelType } from './modelTypeUtils.js'
import {
  createDefaultReportSettings,
  getReportTypeLabel,
  normalizeReportSettings,
  renderReportTemplate
} from './reportSettings.js'
import { loadRulesFromDoc, normalizeRule, validateRuleValue } from './templateRules.js'

export const FORM_FIELD_AUDIT_ASSISTANT_ID = 'analysis.form-field-audit'

const activeAuditRuns = new Map()

function getApplication() {
  return window.Application || window.opener?.Application || window.parent?.Application || null
}

function getActiveDocument() {
  return getApplication()?.ActiveDocument || null
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
  if (runState?.cancelled) throw createCancelError()
}

function interpolateTemplate(template, variables = {}) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key]
    return value == null ? '' : String(value)
  })
}

function getSelectionPreview(text) {
  const content = String(text || '').trim()
  return content.length > 120 ? `${content.slice(0, 120)}...` : content
}

function getOutputFormatInstruction(outputFormat) {
  switch (outputFormat) {
    case 'json':
      return '请只输出合法 JSON，不要附加 markdown、解释或前言。'
    case 'markdown':
      return '请使用结构清晰的 Markdown 输出。'
    default:
      return '请直接输出结果，不要附加多余说明。'
  }
}

function buildAuditSystemPrompt(config, definition) {
  const sections = []
  if (config?.persona) sections.push(`角色设定：${config.persona}`)
  if (config?.systemPrompt) sections.push(config.systemPrompt)
  sections.push('补充约束：必须覆盖输入中的每个书签；结论要保守、可复核、可定位；不要编造文档外事实。')
  sections.push('每个书签都要输出可直接写入批注的 comment，并给出结构化 issues。')
  sections.push(getOutputFormatInstruction('json'))
  if (definition?.shortLabel) sections.push(`当前任务：${definition.shortLabel}`)
  return sections.filter(Boolean).join('\n\n')
}

function buildAuditUserPrompt(config, definition, inputText) {
  const base = interpolateTemplate(
    config?.userPromptTemplate || definition?.userPromptTemplate || '{{input}}',
    {
      input: inputText,
      assistantName: definition?.shortLabel || definition?.label || '文档审计助手'
    }
  )
  return [
    base,
    '程序补充要求：',
    '1. bookmarkAudits 必须覆盖输入中的全部 bookmarkName，且保持一一对应。',
    '2. 如果某书签未发现明显问题，也必须返回 passed=true、低风险结论和简短 comment。',
    '3. issues 中如能定位到书签，必须带 bookmarkName。'
  ].join('\n\n')
}

function buildReportSystemPrompt(config, reportTypeLabel) {
  const sections = []
  if (config?.persona) sections.push(`角色设定：${config.persona}`)
  if (config?.systemPrompt) sections.push(config.systemPrompt)
  sections.push(`当前任务：根据结构化审计结果撰写${reportTypeLabel}。`)
  sections.push('报告必须严格依据输入的结构化审计结果撰写，不得臆造新的事实、风险或证据。')
  sections.push('输出必须是 Markdown，一级标题要与模板保持一致。')
  return sections.filter(Boolean).join('\n\n')
}

function buildReportUserPrompt(reportSettings, reportTypeLabel, payload) {
  const renderedTemplate = renderReportTemplate(reportSettings?.template, {
    reportType: reportTypeLabel
  }).trim()
  return [
    `请基于以下结构化审计结果，撰写一份${reportTypeLabel}。`,
    '撰写要求：',
    '1. 严格依据输入的审计结果进行归纳，不要编造文档外事实。',
    '2. 结论、问题、风险等级、建议动作必须与结构化结果对应。',
    '3. 若信息不足以支持确定性判断，请明确写“需人工复核”。',
    '4. 严格按下列报告模板输出，不要省略一级标题。',
    reportSettings?.prompt ? `5. 附加要求：${reportSettings.prompt}` : '5. 语言应正式、克制、适合审计汇报场景。',
    '',
    '报告模板：',
    renderedTemplate || `# ${reportTypeLabel}`,
    '',
    '结构化审计结果：',
    '```json',
    JSON.stringify(payload, null, 2),
    '```'
  ].join('\n')
}

function parseBookmarkName(fullName) {
  const value = String(fullName || '').trim()
  const parts = value.split('_')
  return {
    fullName: value,
    displayName: parts[0] || value,
    ruleId: parts.length >= 2 ? parts[1] : ''
  }
}

function getBookmarkText(bookmark) {
  try {
    return String(bookmark?.Range?.Text || '')
      .replace(/\r\n$/g, '')
      .replace(/\r$/g, '')
      .replace(/\n$/g, '')
      .replace(/\x07$/g, '')
      .trim()
  } catch (_) {
    return ''
  }
}

function getBookmarkContext(bookmark, doc) {
  const range = bookmark?.Range
  const start = Number(range?.Start || 0)
  const end = Number(range?.End || 0)
  const normalize = (value) => String(value || '').replace(/[\r\n\x07]+/g, ' ').trim()
  if (!doc || typeof doc.Range !== 'function') {
    return { before: '', after: '' }
  }
  let before = ''
  let after = ''
  try {
    before = normalize(doc.Range(Math.max(0, start - 80), start)?.Text || '')
  } catch (_) {}
  try {
    after = normalize(doc.Range(end, end + 80)?.Text || '')
  } catch (_) {}
  return { before, after }
}

function collectBookmarkInstances(ruleIds = [], bookmarkNames = []) {
  const doc = getActiveDocument()
  const bookmarks = doc?.Bookmarks
  const selectedRuleIds = new Set((ruleIds || []).map(item => String(item || '')).filter(Boolean))
  const selectedBookmarkNames = new Set((bookmarkNames || []).map(item => String(item || '')).filter(Boolean))
  const rules = loadRulesFromDoc().map(item => normalizeRule(item))
  const ruleMap = new Map(rules.map(item => [item.id, item]))
  const instances = []

  if (!doc || !bookmarks) {
    return { rules, instances }
  }

  for (let i = 1; i <= bookmarks.Count; i += 1) {
    try {
      const bookmark = bookmarks.Item(i)
      const meta = parseBookmarkName(bookmark?.Name)
      if (!meta.ruleId) continue
      if (selectedRuleIds.size > 0 && !selectedRuleIds.has(meta.ruleId)) continue
      if (selectedBookmarkNames.size > 0 && !selectedBookmarkNames.has(meta.fullName)) continue
      const rule = ruleMap.get(meta.ruleId)
      if (!rule) continue
      const content = getBookmarkText(bookmark)
      const seqMatch = meta.fullName.match(/_(\d+)$/)
      const context = getBookmarkContext(bookmark, doc)
      instances.push({
        bookmarkName: meta.fullName,
        name: meta.displayName,
        ruleId: meta.ruleId,
        value: content,
        rule,
        position: Number(bookmark?.Range?.Start || 0),
        groupKey: '',
        groupLabel: seqMatch ? `实例${seqMatch[1]}` : '',
        contextBefore: context.before,
        contextAfter: context.after
      })
    } catch (_) {}
  }

  instances.sort((a, b) => a.position - b.position)
  return { rules, instances }
}

function severityByLocalError(rule, message, value) {
  if (!String(value || '').trim() && rule.required) return 'high'
  if (/不能为空|格式不正确|必须/.test(message)) return 'medium'
  return 'low'
}

function normalizeComparableValueByRule(rule, value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (rule.dataType === 'decimal' || rule.dataType === 'integer') {
    return text.replace(/[,\s]/g, '')
  }
  if (rule.dataType === 'date' || rule.dataType === 'datetime') {
    return text.replace(/[年\/.-]/g, '-').replace(/月/g, '-').replace(/日/g, '').replace(/\s+/g, 'T')
  }
  if (rule.dataType === 'phone') {
    return text.replace(/[\s-]/g, '')
  }
  return text
}

function tryParseNumericValue(value) {
  const normalized = String(value || '').replace(/[,\s，]/g, '').trim()
  if (!normalized) return null
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

function tryParseDateValue(value) {
  const normalized = String(value || '').trim()
    .replace(/[年\/.-]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\s+/g, 'T')
  if (!normalized) return null
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

function isContractNumberField(rule) {
  return rule.semanticKey === 'contractNumber' || /编号|合同号|编码/.test(String(rule.name || ''))
}

function buildDerivedIssues(instances) {
  const issues = []
  const groupedBySemantic = new Map()
  instances.forEach((instance) => {
    const key = String(instance.rule.semanticKey || instance.rule.id || instance.bookmarkName || '')
    if (!key) return
    if (!groupedBySemantic.has(key)) groupedBySemantic.set(key, [])
    groupedBySemantic.get(key).push(instance)
  })

  groupedBySemantic.forEach((group) => {
    if (group.length <= 1) return
    const baseRule = group[0].rule
    const normalizedSet = new Set(group.map(item => normalizeComparableValueByRule(baseRule, item.value)).filter(Boolean))
    if (normalizedSet.size > 1 && baseRule.reviewType === 'consistency') {
      group.forEach((instance) => {
        issues.push({
          fieldName: instance.rule.name,
          semanticKey: instance.rule.semanticKey || '',
          instanceValue: instance.value,
          groupLabel: instance.groupLabel || '',
          issueType: 'consistency',
          riskLevel: 'medium',
          reason: '同类字段实例之间存在格式或内容不一致',
          suggestion: instance.rule.reviewHint || '建议统一同类字段的填写口径与格式',
          bookmarkName: instance.bookmarkName
        })
      })
    }
  })

  const semanticMap = {}
  instances.forEach((instance) => {
    const key = String(instance.rule.semanticKey || '')
    if (!key || semanticMap[key]) return
    semanticMap[key] = instance
  })

  const startInstance = semanticMap.startDate
  const endInstance = semanticMap.endDate
  if (startInstance && endInstance) {
    const start = tryParseDateValue(startInstance.value)
    const end = tryParseDateValue(endInstance.value)
    if (start != null && end != null && start > end) {
      issues.push({
        fieldName: `${startInstance.rule.name} / ${endInstance.rule.name}`,
        semanticKey: 'dateRange',
        instanceValue: `${startInstance.value} -> ${endInstance.value}`,
        groupLabel: '',
        issueType: 'logic',
        riskLevel: 'high',
        reason: '开始日期晚于结束日期，存在明显逻辑冲突',
        suggestion: '请校正起止日期顺序',
        bookmarkName: `${startInstance.bookmarkName},${endInstance.bookmarkName}`
      })
    }
  }

  instances.forEach((instance) => {
    const rule = instance.rule
    const value = String(instance.value || '').trim()
    const numeric = tryParseNumericValue(value)
    if (rule.semanticKey === 'contractAmount' || /金额|价款|总价/.test(String(rule.name || ''))) {
      if (numeric != null && numeric <= 0) {
        issues.push({
          fieldName: rule.name,
          semanticKey: rule.semanticKey || '',
          instanceValue: value,
          groupLabel: instance.groupLabel || '',
          issueType: 'range',
          riskLevel: 'high',
          reason: '金额应大于 0，当前值异常',
          suggestion: rule.reviewHint || '请确认金额是否填写正确',
          bookmarkName: instance.bookmarkName
        })
      }
    }
    if (isContractNumberField(rule) && value && !/[A-Za-z]/.test(value) && !/\d/.test(value)) {
      issues.push({
        fieldName: rule.name,
        semanticKey: rule.semanticKey || '',
        instanceValue: value,
        groupLabel: instance.groupLabel || '',
        issueType: 'format',
        riskLevel: 'medium',
        reason: '编号类字段通常至少包含字母或数字，当前值疑似异常',
        suggestion: rule.reviewHint || '建议按合同编号格式补全',
        bookmarkName: instance.bookmarkName
      })
    }
  })

  return issues
}

function buildLocalIssues(instances) {
  const relatedValues = {}
  instances.forEach((instance) => {
    if (instance.rule.semanticKey && !relatedValues[instance.rule.semanticKey]) {
      relatedValues[instance.rule.semanticKey] = instance.value
    }
  })

  const issues = []
  instances.forEach((instance) => {
    const errors = validateRuleValue(instance.rule, instance.value, { relatedValues })
    errors.forEach((message) => {
      issues.push({
        fieldName: instance.rule.name,
        semanticKey: instance.rule.semanticKey || '',
        instanceValue: instance.value,
        groupLabel: instance.groupLabel || '',
        issueType: 'local',
        riskLevel: severityByLocalError(instance.rule, message, instance.value),
        reason: message,
        suggestion: instance.rule.reviewHint || `请按字段规则补充或修正“${instance.rule.name}”`,
        bookmarkName: instance.bookmarkName
      })
    })

    if (instance.rule.reviewType === 'sensitive' && instance.rule.reviewRule) {
      const terms = instance.rule.reviewRule.split(',').map(item => item.trim()).filter(Boolean)
      const hit = terms.find(item => instance.value.includes(item))
      if (hit) {
        issues.push({
          fieldName: instance.rule.name,
          semanticKey: instance.rule.semanticKey || '',
          instanceValue: instance.value,
          groupLabel: instance.groupLabel || '',
          issueType: 'sensitive',
          riskLevel: 'medium',
          reason: `命中敏感词“${hit}”`,
          suggestion: instance.rule.reviewHint || '建议人工复核该字段是否适合保留',
          bookmarkName: instance.bookmarkName
        })
      }
    }
  })

  return [...issues, ...buildDerivedIssues(instances)]
}

function buildAiAuditInput(rules, instances, localIssues) {
  const localIssueMap = groupIssuesByBookmark(localIssues)
  const payload = {
    task: {
      name: '文档书签审计',
      totalRules: rules.length,
      totalBookmarks: instances.length
    },
    rules: rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      semanticKey: rule.semanticKey,
      required: rule.required,
      dataType: rule.dataType,
      reviewType: rule.reviewType,
      reviewRule: rule.reviewRule,
      reviewHint: rule.reviewHint,
      fillHint: rule.fillHint,
      remark: rule.remark,
      auditPriority: rule.auditPriority
    })),
    bookmarks: instances.map(instance => ({
      bookmarkName: instance.bookmarkName,
      displayName: instance.name,
      fieldName: instance.rule.name,
      semanticKey: instance.rule.semanticKey,
      value: instance.value,
      required: instance.rule.required === true,
      dataType: instance.rule.dataType,
      reviewType: instance.rule.reviewType,
      reviewRule: instance.rule.reviewRule,
      reviewHint: instance.rule.reviewHint,
      fillHint: instance.rule.fillHint,
      remark: instance.rule.remark,
      auditPriority: instance.rule.auditPriority,
      groupLabel: instance.groupLabel || '',
      contextBefore: instance.contextBefore || '',
      contextAfter: instance.contextAfter || '',
      localIssues: localIssueMap.get(instance.bookmarkName) || []
    })),
    localIssues
  }
  return JSON.stringify(payload, null, 2)
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
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const firstBrace = source.indexOf('{')
  const lastBrace = source.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return source.slice(firstBrace, lastBrace + 1)
  }
  return source
}

function normalizeRiskLevel(level) {
  const value = String(level || '').trim().toLowerCase()
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'low'
}

function normalizeIssue(item, fallback = {}) {
  return {
    bookmarkName: String(item?.bookmarkName || fallback.bookmarkName || '').trim(),
    fieldName: String(item?.fieldName || fallback.fieldName || '').trim(),
    semanticKey: String(item?.semanticKey || fallback.semanticKey || '').trim(),
    instanceValue: String(item?.instanceValue || fallback.instanceValue || '').trim(),
    groupLabel: String(item?.groupLabel || fallback.groupLabel || '').trim(),
    issueType: String(item?.issueType || fallback.issueType || 'llm').trim(),
    riskLevel: normalizeRiskLevel(item?.riskLevel || fallback.riskLevel),
    reason: String(item?.reason || fallback.reason || '').trim(),
    suggestion: String(item?.suggestion || fallback.suggestion || '').trim()
  }
}

function dedupeIssues(issues = []) {
  const map = new Map()
  issues.forEach((item) => {
    const normalized = normalizeIssue(item)
    if (!normalized.reason && !normalized.fieldName) return
    const key = [
      normalized.bookmarkName,
      normalized.fieldName,
      normalized.issueType,
      normalized.riskLevel,
      normalized.reason,
      normalized.suggestion
    ].join('||')
    if (!map.has(key)) {
      map.set(key, normalized)
    }
  })
  return [...map.values()]
}

function parseAiAuditOutput(output) {
  const parsed = safeJsonParse(extractJsonCandidate(output))
  const summary = parsed?.summary && typeof parsed.summary === 'object'
    ? parsed.summary
    : { overallRisk: 'low', conclusion: '未发现明显问题' }
  const bookmarkAudits = (Array.isArray(parsed?.bookmarkAudits) ? parsed.bookmarkAudits : []).map(item => {
    const issues = dedupeIssues(
      Array.isArray(item?.issues)
        ? item.issues.map(issue => normalizeIssue(issue, {
          bookmarkName: item?.bookmarkName,
          fieldName: item?.fieldName,
          semanticKey: item?.semanticKey,
          instanceValue: item?.instanceValue
        }))
        : []
    )
    return {
      bookmarkName: String(item?.bookmarkName || '').trim(),
      fieldName: String(item?.fieldName || '').trim(),
      semanticKey: String(item?.semanticKey || '').trim(),
      instanceValue: String(item?.instanceValue || '').trim(),
      riskLevel: normalizeRiskLevel(item?.riskLevel),
      passed: item?.passed === true,
      conclusion: String(item?.conclusion || '').trim(),
      comment: String(item?.comment || '').trim(),
      issues
    }
  }).filter(item => item.bookmarkName)
  const issues = dedupeIssues([
    ...bookmarkAudits.flatMap(item => item.issues),
    ...(Array.isArray(parsed?.issues) ? parsed.issues.map(item => normalizeIssue(item)) : [])
  ])
  const recommendations = (Array.isArray(parsed?.recommendations) ? parsed.recommendations : [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
  return {
    summary: {
      overallRisk: normalizeRiskLevel(summary?.overallRisk),
      conclusion: String(summary?.conclusion || '未发现明显问题').trim()
    },
    bookmarkAudits,
    issues,
    recommendations
  }
}

function splitBookmarkNames(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function groupIssuesByBookmark(issues = []) {
  const map = new Map()
  issues.forEach((issue) => {
    splitBookmarkNames(issue.bookmarkName).forEach((bookmarkName) => {
      if (!map.has(bookmarkName)) map.set(bookmarkName, [])
      map.get(bookmarkName).push({
        ...issue,
        bookmarkName
      })
    })
  })
  map.forEach((items, key) => {
    map.set(key, dedupeIssues(items))
  })
  return map
}

function getRiskScore(level) {
  if (level === 'high') return 3
  if (level === 'medium') return 2
  return 1
}

function getHighestRiskLevel(levels = []) {
  const normalized = levels.map(level => normalizeRiskLevel(level))
  if (normalized.includes('high')) return 'high'
  if (normalized.includes('medium')) return 'medium'
  return 'low'
}

function deriveOverallRisk(bookmarkAudits = [], issues = []) {
  return getHighestRiskLevel([
    ...bookmarkAudits.map(item => item.riskLevel),
    ...issues.map(item => item.riskLevel)
  ])
}

function buildDefaultBookmarkComment(instance, issues, riskLevel) {
  if (!issues.length) {
    return '未发现明显问题，建议结合上下文再做人工复核。'
  }
  const lead = riskLevel === 'high'
    ? '发现高风险问题，建议优先处理。'
    : riskLevel === 'medium'
      ? '发现需重点复核的问题。'
      : '发现低风险或待人工复核问题。'
  const detail = issues.slice(0, 2).map(item => item.reason).filter(Boolean).join('；')
  return detail ? `${lead}${detail}` : lead
}

function buildMergedBookmarkAudits(instances, localIssues, aiResult) {
  const localIssueMap = groupIssuesByBookmark(localIssues)
  const aiIssueMap = groupIssuesByBookmark(aiResult?.issues || [])
  const aiBookmarkMap = new Map(
    (aiResult?.bookmarkAudits || []).map(item => [item.bookmarkName, item])
  )
  return instances.map((instance) => {
    const aiBookmark = aiBookmarkMap.get(instance.bookmarkName)
    const mergedIssues = dedupeIssues([
      ...(localIssueMap.get(instance.bookmarkName) || []),
      ...(aiBookmark?.issues || []),
      ...(aiIssueMap.get(instance.bookmarkName) || [])
    ].map(item => normalizeIssue(item, {
      bookmarkName: instance.bookmarkName,
      fieldName: instance.rule.name,
      semanticKey: instance.rule.semanticKey || '',
      instanceValue: instance.value
    })))
    const riskLevel = getHighestRiskLevel([
      aiBookmark?.riskLevel,
      ...mergedIssues.map(item => item.riskLevel)
    ])
    return {
      bookmarkName: instance.bookmarkName,
      fieldName: instance.rule.name,
      semanticKey: instance.rule.semanticKey || '',
      instanceValue: instance.value,
      dataType: instance.rule.dataType || 'string',
      reviewType: instance.rule.reviewType || 'none',
      riskLevel,
      passed: mergedIssues.length === 0 && aiBookmark?.passed !== false,
      conclusion: String(aiBookmark?.conclusion || '').trim() || (mergedIssues.length
        ? `发现 ${mergedIssues.length} 项需关注问题`
        : '未发现明显问题'),
      comment: String(aiBookmark?.comment || '').trim() || buildDefaultBookmarkComment(instance, mergedIssues, riskLevel),
      issues: mergedIssues,
      position: instance.position
    }
  }).sort((a, b) => a.position - b.position)
}

function buildBookmarkCommentText(bookmarkAudit) {
  const lines = [
    `书签：${bookmarkAudit.bookmarkName || '-'}`,
    `字段：${bookmarkAudit.fieldName || '-'}`,
    `风险级别：${bookmarkAudit.riskLevel || 'low'}`,
    `审计意见：${bookmarkAudit.comment || bookmarkAudit.conclusion || '未发现明显问题'}`
  ]
  if (bookmarkAudit.issues?.length) {
    lines.push('主要问题：')
    bookmarkAudit.issues.slice(0, 3).forEach((issue, index) => {
      const suggestion = issue.suggestion ? `；建议：${issue.suggestion}` : ''
      lines.push(`${index + 1}. ${issue.reason || issue.issueType || '需人工复核'}${suggestion}`)
    })
  } else {
    lines.push('主要问题：未发现明显问题，建议结合上下文人工复核。')
  }
  return lines.join('\n')
}

function shouldWriteAuditComments(documentAction) {
  return ['comment', 'link-comment', 'comment-replace'].includes(String(documentAction || '').trim())
}

function applyCommentsToBookmarks(bookmarkAudits = []) {
  const doc = getActiveDocument()
  const bookmarks = doc?.Bookmarks
  if (!doc || !bookmarks || !doc.Comments?.Add) {
    throw new Error('当前环境不支持写入书签批注')
  }
  let successCount = 0
  const failures = []
  bookmarkAudits.forEach((item) => {
    try {
      const bookmark = bookmarks.Item(item.bookmarkName)
      if (!bookmark?.Range) throw new Error('未找到书签范围')
      doc.Comments.Add(bookmark.Range, `【文档审计】\n${buildBookmarkCommentText(item)}`)
      successCount += 1
    } catch (error) {
      failures.push(`${item.bookmarkName}: ${error?.message || '批注写入失败'}`)
    }
  })
  if (successCount === 0) {
    throw new Error(failures[0] || '未能写入任何批注')
  }
  return {
    successCount,
    failedCount: failures.length,
    failures
  }
}

function buildFallbackReportMarkdown(reportTypeLabel, summary, bookmarkAudits, issues, recommendations) {
  const sectionText = (items) => {
    if (!items.length) return '无'
    return items.map(item => [
      `### ${item.fieldName || item.bookmarkName || '未命名书签'}`,
      `- 书签：${item.bookmarkName || '-'}`,
      `- 风险级别：${item.riskLevel || 'low'}`,
      `- 审计意见：${item.comment || item.conclusion || '-'}`,
      item.issues?.length
        ? item.issues.map(issue => `- 问题：${issue.reason || '-'}；建议：${issue.suggestion || '-'}`).join('\n')
        : '- 问题：未发现明显问题'
    ].join('\n')).join('\n\n')
  }
  const highItems = bookmarkAudits.filter(item => item.riskLevel === 'high')
  const mediumItems = bookmarkAudits.filter(item => item.riskLevel === 'medium')
  const lowItems = bookmarkAudits.filter(item => item.riskLevel === 'low')
  return [
    `# ${reportTypeLabel}`,
    '',
    '## 一、执行摘要',
    `- 总体风险：${summary.overallRisk || 'low'}`,
    `- 审计结论：${summary.conclusion || '未发现明显问题'}`,
    `- 审计书签数：${bookmarkAudits.length}`,
    `- 问题总数：${issues.length}`,
    '',
    '## 二、报告对象与范围',
    '- 本报告基于所选书签字段、规则配置、本地校验结果和 AI 审计结果生成。',
    '- 对证据不足或上下文不足的结论，均应结合原文进一步人工复核。',
    '',
    '## 三、关键发现',
    sectionText(highItems),
    '',
    '## 四、问题分析',
    mediumItems.length || lowItems.length ? sectionText([...mediumItems, ...lowItems]) : '无',
    '',
    '## 五、结论',
    summary.conclusion || '未发现明显问题',
    '',
    '## 六、建议与行动项',
    recommendations.length ? recommendations.map(item => `- ${item}`).join('\n') : '无',
    '',
    '## 七、附录',
    bookmarkAudits.map(item => `- ${item.bookmarkName}: ${item.fieldName || '-'} / ${item.riskLevel || 'low'}`).join('\n') || '无'
  ].join('\n')
}

function getIssueCounts(issues) {
  return {
    high: issues.filter(item => item.riskLevel === 'high').length,
    medium: issues.filter(item => item.riskLevel === 'medium').length,
    low: issues.filter(item => item.riskLevel === 'low').length
  }
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

function resolveAssistantModel(config, definition) {
  const modelType = config?.modelType || definition?.modelType || 'chat'
  const flat = getFlatModelsFromSettings(modelType)
  const configuredId = config?.modelId || getConfiguredAssistantModelId(definition?.id)
  if (configuredId) {
    const configured = getModelByCompositeId(modelType, configuredId)
    if (configured) return configured
  }
  return flat[0] || null
}

function getAuditAssistantContext() {
  const definition = getBuiltinAssistantDefinition(FORM_FIELD_AUDIT_ASSISTANT_ID)
  if (!definition) {
    throw new Error('未找到文档审计助手定义')
  }
  const config = getAssistantSetting(FORM_FIELD_AUDIT_ASSISTANT_ID)
  if (!config || config.enabled === false) {
    throw new Error('文档审计助手已被关闭，请先在设置中启用')
  }
  const model = resolveAssistantModel(config, definition)
  if (!model) {
    throw new Error('未找到可用模型，请先在设置中为文档审计助手配置模型')
  }
  const fallbackReportSettings = createDefaultReportSettings({
    enabled: true,
    type: 'compliance-audit-report',
    prompt: '优先输出总体结论、书签级问题、规则依据、整改建议和需人工复核事项；结论要克制、可复核。'
  })
  const reportSettings = {
    ...normalizeReportSettings(config.reportSettings, fallbackReportSettings),
    enabled: true
  }
  const reportTypeLabel = getReportTypeLabel(reportSettings.type, reportSettings.customType)
  return {
    definition,
    config,
    model,
    documentAction: config.documentAction || definition.defaultAction || 'comment',
    reportSettings,
    reportTypeLabel
  }
}

async function runStructuredAuditModel(context, inputText, signal) {
  return chatCompletion({
    providerId: context.model.providerId,
    modelId: context.model.modelId,
    temperature: Number.isFinite(Number(context.config?.temperature)) ? Number(context.config.temperature) : 0.2,
    signal,
    messages: [
      { role: 'system', content: buildAuditSystemPrompt(context.config, context.definition) },
      { role: 'user', content: buildAuditUserPrompt(context.config, context.definition, inputText) }
    ]
  })
}

async function generateAuditReport(context, summary, bookmarkAudits, issues, recommendations, signal) {
  const payload = {
    summary,
    issueCounts: getIssueCounts(issues),
    bookmarkAudits: bookmarkAudits.map(item => ({
      bookmarkName: item.bookmarkName,
      fieldName: item.fieldName,
      semanticKey: item.semanticKey,
      instanceValue: item.instanceValue,
      riskLevel: item.riskLevel,
      conclusion: item.conclusion,
      comment: item.comment,
      issues: item.issues
    })),
    recommendations
  }
  try {
    return await chatCompletion({
      providerId: context.model.providerId,
      modelId: context.model.modelId,
      temperature: 0.2,
      signal,
      messages: [
        { role: 'system', content: buildReportSystemPrompt(context.config, context.reportTypeLabel) },
        { role: 'user', content: buildReportUserPrompt(context.reportSettings, context.reportTypeLabel, payload) }
      ]
    })
  } catch (_) {
    return buildFallbackReportMarkdown(context.reportTypeLabel, summary, bookmarkAudits, issues, recommendations)
  }
}

export function stopFormAuditTask(taskId) {
  const runState = activeAuditRuns.get(taskId)
  if (!runState) return false
  runState.cancelled = true
  try {
    runState.abortController?.abort()
  } catch (_) {}
  updateTask(taskId, {
    status: 'cancelled',
    error: '任务已停止',
    progress: 100,
    data: {
      ...(getTaskById(taskId)?.data || {}),
      progressStage: 'cancelled'
    }
  })
  return true
}

export function startFormAuditTask(options = {}) {
  const title = String(options.title || '文档审计')
  const taskId = addTask({
    type: 'form-audit',
    title,
    status: 'running',
    progress: 10,
    data: {
      assistantId: FORM_FIELD_AUDIT_ASSISTANT_ID,
      operationKind: 'form-audit',
      configuredInputSource: 'document',
      inputSource: 'document',
      chunkSource: 'document',
      documentAction: 'none',
      outputFormat: 'markdown',
      progressStage: 'collecting'
    }
  })

  const runState = {
    cancelled: false,
    abortController: typeof AbortController !== 'undefined' ? new AbortController() : null
  }
  activeAuditRuns.set(taskId, runState)

  const promise = (async () => {
    try {
      const assistantContext = getAuditAssistantContext()
      const { rules, instances } = collectBookmarkInstances(options.ruleIds || [], options.bookmarkNames || [])
      const candidateRules = rules.filter(rule => {
        if (options.ruleIds?.length) {
          return options.ruleIds.includes(rule.id)
        }
        return rule.auditEnabled !== false
      })
      const auditedInstances = instances.filter(instance => candidateRules.some(rule => rule.id === instance.rule.id))
      const auditedRuleIds = new Set(auditedInstances.map(instance => instance.rule.id))
      const auditedRules = options.bookmarkNames?.length
        ? candidateRules.filter(rule => auditedRuleIds.has(rule.id))
        : candidateRules

      if (auditedRules.length === 0) {
        throw new Error('没有可审计的规则，请先创建或启用规则')
      }
      if (auditedInstances.length === 0) {
        throw new Error('当前文档未找到对应书签实例，无法执行审计')
      }

      updateTask(taskId, {
        progress: 35,
        data: {
          assistantId: FORM_FIELD_AUDIT_ASSISTANT_ID,
          operationKind: 'form-audit',
          configuredInputSource: 'document',
          inputSource: 'document',
          chunkSource: 'document',
          documentAction: assistantContext.documentAction,
          outputFormat: 'markdown',
          reportSettings: assistantContext.reportSettings,
          reportTypeLabel: assistantContext.reportTypeLabel,
          modelId: assistantContext.model.id || '',
          modelDisplayName: assistantContext.model.name || assistantContext.model.modelId || '',
          inputPreview: `规则 ${auditedRules.length} 项，书签实例 ${auditedInstances.length} 项`,
          progressStage: 'local_validating'
        }
      })

      const localIssues = buildLocalIssues(auditedInstances)
      throwIfCancelled(runState)

      updateTask(taskId, {
        progress: 60,
        data: {
          assistantId: FORM_FIELD_AUDIT_ASSISTANT_ID,
          operationKind: 'form-audit',
          configuredInputSource: 'document',
          inputSource: 'document',
          chunkSource: 'document',
          documentAction: assistantContext.documentAction,
          outputFormat: 'markdown',
          reportSettings: assistantContext.reportSettings,
          reportTypeLabel: assistantContext.reportTypeLabel,
          modelId: assistantContext.model.id || '',
          modelDisplayName: assistantContext.model.name || assistantContext.model.modelId || '',
          inputPreview: `规则 ${auditedRules.length} 项，书签实例 ${auditedInstances.length} 项`,
          commentPreview: `已完成本地规则校验，发现 ${localIssues.length} 项本地问题`,
          progressStage: 'calling_model'
        }
      })

      const structuredOutput = await runStructuredAuditModel(
        assistantContext,
        buildAiAuditInput(auditedRules, auditedInstances, localIssues),
        runState.abortController?.signal
      )
      throwIfCancelled(runState)

      const parsedAi = parseAiAuditOutput(structuredOutput || '')
      const bookmarkAudits = buildMergedBookmarkAudits(auditedInstances, localIssues, parsedAi)
      const mergedIssues = dedupeIssues(bookmarkAudits.flatMap(item => item.issues))
      const counts = getIssueCounts(mergedIssues)
      const summary = {
        overallRisk: getHighestRiskLevel([parsedAi.summary.overallRisk, deriveOverallRisk(bookmarkAudits, mergedIssues)]),
        conclusion: parsedAi.summary.conclusion || `共发现 ${mergedIssues.length} 项需关注的问题`
      }
      const commentStats = shouldWriteAuditComments(assistantContext.documentAction)
        ? applyCommentsToBookmarks(bookmarkAudits)
        : { successCount: 0, failedCount: 0, failures: [] }
      throwIfCancelled(runState)

      const mergedRecommendations = [
        ...new Set([
          ...parsedAi.recommendations,
          ...(commentStats.failedCount > 0
            ? [`有 ${commentStats.failedCount} 个书签批注写入失败，请人工检查对应书签。`]
            : [])
        ].filter(Boolean))
      ]

      updateTask(taskId, {
        progress: 85,
        data: {
          assistantId: FORM_FIELD_AUDIT_ASSISTANT_ID,
          operationKind: 'form-audit',
          configuredInputSource: 'document',
          inputSource: 'document',
          chunkSource: 'document',
          documentAction: assistantContext.documentAction,
          outputFormat: 'markdown',
          reportSettings: assistantContext.reportSettings,
          reportTypeLabel: assistantContext.reportTypeLabel,
          modelId: assistantContext.model.id || '',
          modelDisplayName: assistantContext.model.name || assistantContext.model.modelId || '',
          inputPreview: `规则 ${auditedRules.length} 项，书签实例 ${auditedInstances.length} 项`,
          outputPreview: summary.conclusion,
          commentPreview: `已写入 ${commentStats.successCount} 条书签批注`,
          progressStage: 'generating_report'
        }
      })

      const reportMarkdown = await generateAuditReport(
        assistantContext,
        summary,
        bookmarkAudits,
        mergedIssues,
        mergedRecommendations,
        runState.abortController?.signal
      )
      throwIfCancelled(runState)

      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        data: {
          assistantId: FORM_FIELD_AUDIT_ASSISTANT_ID,
          operationKind: 'form-audit',
          configuredInputSource: 'document',
          inputSource: 'document',
          chunkSource: 'document',
          documentAction: assistantContext.documentAction,
          outputFormat: 'markdown',
          reportSettings: assistantContext.reportSettings,
          reportTypeLabel: assistantContext.reportTypeLabel,
          modelId: assistantContext.model.id || '',
          modelDisplayName: assistantContext.model.name || assistantContext.model.modelId || '',
          inputPreview: `规则 ${auditedRules.length} 项，书签实例 ${auditedInstances.length} 项`,
          outputPreview: summary.conclusion,
          commentPreview: `已写入 ${commentStats.successCount} 条批注；高风险 ${counts.high} 项，中风险 ${counts.medium} 项，低风险/待复核 ${counts.low} 项`,
          fullOutput: reportMarkdown,
          progressStage: 'completed',
          applyResult: {
            ok: true,
            action: shouldWriteAuditComments(assistantContext.documentAction) ? 'comment' : 'none',
            message: '文档审计已完成'
          },
          auditResults: mergedIssues,
          bookmarkAudits,
          recommendations: mergedRecommendations,
          highRiskCount: counts.high,
          mediumRiskCount: counts.medium,
          lowRiskCount: counts.low,
          commentStats,
          structuredOutput
        }
      })

      return {
        taskId,
        summary,
        issues: mergedIssues,
        bookmarkAudits,
        recommendations: mergedRecommendations,
        reportMarkdown,
        commentStats
      }
    } catch (error) {
      const cancelled = runState.cancelled || error?.message === '任务已停止' || isTaskCancelledError(error)
      updateTask(taskId, {
        status: cancelled ? 'cancelled' : 'failed',
        error: cancelled ? '任务已停止' : (error?.message || String(error)),
        progress: 100,
        data: {
          ...(getTaskById(taskId)?.data || {}),
          assistantId: FORM_FIELD_AUDIT_ASSISTANT_ID,
          operationKind: 'form-audit',
          progressStage: cancelled ? 'cancelled' : 'failed'
        }
      })
      throw error
    } finally {
      activeAuditRuns.delete(taskId)
    }
  })()

  return { taskId, promise }
}
