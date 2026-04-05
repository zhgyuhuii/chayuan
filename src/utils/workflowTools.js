import axios from 'axios'
import { executeCapabilityBusRequest, getCapabilityBusCatalog } from './capabilityBus.js'

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function safeParseJson(raw, fallback = null) {
  if (raw == null || raw === '') return fallback
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch (_) {
    return fallback
  }
}

function stringifyOutput(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch (_) {
    return String(value)
  }
}

export function stringifyWorkflowValue(value) {
  return stringifyOutput(value)
}

function sleep(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function getByPath(source, path) {
  const normalized = String(path || '').trim()
  if (!normalized) return source
  return normalized
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => {
      if (acc == null) return undefined
      return acc[key]
    }, source)
}

function interpolateTemplate(template, variables) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, rawKey) => {
    const value = getByPath(variables, rawKey)
    return value == null ? '' : String(value)
  })
}

export function normalizeWorkflowInputBinding(inputBinding = {}) {
  const mode = String(inputBinding?.mode || 'auto').trim().toLowerCase()
  return {
    mode: ['auto', 'single', 'template'].includes(mode) ? mode : 'auto',
    sourceNodeId: String(inputBinding?.sourceNodeId || '').trim(),
    valuePath: String(inputBinding?.valuePath || '').trim(),
    template: String(inputBinding?.template || '')
  }
}

const BUILTIN_WORKFLOW_TOOLS = [
  {
    type: 'capability-bus',
    title: '能力总线',
    icon: 'BUS',
    group: 'integration',
    groupLabel: '集成连接',
    description: '通过统一 capability bus 调用任意 namespace 能力，适合复用 WPS 与通用 utility 能力。',
    config: {
      capabilityKey: '',
      paramsText: '{}'
    }
  },
  {
    type: 'wps-capability',
    title: 'WPS 能力',
    icon: 'WPS',
    group: 'integration',
    groupLabel: '集成连接',
    description: '调用统一 capability bus 执行 WPS 原生能力，如替换文本、格式设置、插入结构等。',
    config: {
      capabilityKey: '',
      paramsText: '{}'
    }
  },
  {
    type: 'http-request',
    title: '网络请求',
    icon: 'HTTP',
    group: 'integration',
    groupLabel: '集成连接',
    description: '把上游节点输出发送到指定接口，适合 Webhook、业务系统或外部网关。',
    config: {
      url: '',
      method: 'POST',
      contentType: 'json',
      headersText: '{\n  "Content-Type": "application/json"\n}',
      bodyTemplate: '',
      responseMode: 'body'
    }
  },
  {
    type: 'json-extract',
    title: 'JSON 提取',
    icon: 'JSON',
    group: 'transform',
    groupLabel: '数据处理',
    description: '从 JSON 输出中提取指定字段，适合解析模型结构化结果。',
    config: {
      path: 'result',
      fallbackValue: ''
    }
  },
  {
    type: 'text-template',
    title: '文本模板',
    icon: 'TXT',
    group: 'transform',
    groupLabel: '数据处理',
    description: '按模板重新组织上游文本，适合组装提示词、消息体和通知内容。',
    config: {
      template: '处理结果：\n{{input}}'
    }
  },
  {
    type: 'field-mapper',
    title: '数据映射',
    icon: 'MAP',
    group: 'transform',
    groupLabel: '数据处理',
    description: '把上游输出包装为指定字段名，参考 Hop/Kettle 的字段映射思路。',
    config: {
      fieldName: 'payload',
      includeMeta: true
    }
  },
  {
    type: 'content-merge',
    title: '内容合并',
    icon: 'MERGE',
    group: 'transform',
    groupLabel: '数据处理',
    description: '合并多个上游节点输出，适合汇总摘要、拼装报告片段或生成综合通知。',
    config: {
      separator: '\n\n',
      template: ''
    }
  },
  {
    type: 'text-replace',
    title: '文本替换',
    icon: 'REPL',
    group: 'transform',
    groupLabel: '数据处理',
    description: '按普通文本或正则规则替换内容，适合清洗格式、脱敏和统一字段。',
    config: {
      searchValue: '',
      replaceValue: '',
      useRegex: false,
      regexFlags: 'g',
      caseSensitive: true
    }
  },
  {
    type: 'regex-extract',
    title: '正则提取',
    icon: 'REGEX',
    group: 'transform',
    groupLabel: '数据处理',
    description: '从文本中按正则提取关键信息，适合抽取编号、链接、时间或结构化片段。',
    config: {
      pattern: '',
      flags: 'g',
      matchIndex: 0,
      groupIndex: 0,
      joinSeparator: '\n'
    }
  },
  {
    type: 'condition-check',
    title: '条件判断',
    icon: 'IF',
    group: 'control',
    groupLabel: '流程控制',
    description: '对上游输出做包含、等于、正则或为空判断，输出结构化判断结果。',
    config: {
      mode: 'contains',
      expectedValue: '',
      subjectPath: '',
      regexFlags: 'i',
      trimInput: true,
      trueValue: '命中',
      falseValue: '未命中'
    }
  },
  {
    type: 'delay',
    title: '延时等待',
    icon: 'WAIT',
    group: 'control',
    groupLabel: '流程控制',
    description: '在继续执行前等待一段时间，适合限流、轮询和接口节奏控制。',
    config: {
      delayMs: 1000
    }
  },
  {
    type: 'set-variables',
    title: '固定变量',
    icon: 'SET',
    group: 'control',
    groupLabel: '流程控制',
    description: '生成一段固定文本或 JSON，作为后续节点的输入。',
    config: {
      valueType: 'text',
      valueText: ''
    }
  }
]

export function getWorkflowTools() {
  return BUILTIN_WORKFLOW_TOOLS.map(item => ({
    ...item,
    config: deepClone(item.config)
  }))
}

export function getWorkflowToolByType(type) {
  const target = BUILTIN_WORKFLOW_TOOLS.find(item => item.type === String(type || '').trim())
  if (!target) return null
  return {
    ...target,
    config: deepClone(target.config)
  }
}

export function createWorkflowToolPayload(type) {
  const meta = getWorkflowToolByType(type)
  if (!meta) return null
  return {
    kind: 'tool',
    toolType: meta.type,
    title: meta.title,
    icon: meta.icon,
    groupLabel: meta.groupLabel,
    description: meta.description,
    config: deepClone(meta.config),
    inputBinding: normalizeWorkflowInputBinding()
  }
}

export function normalizeWorkflowToolData(data = {}) {
  const toolType = String(data.toolType || '').trim()
  const meta = getWorkflowToolByType(toolType)
  const baseConfig = deepClone(meta?.config || {})
  const mergedConfig = {
    ...baseConfig,
    ...(data.config && typeof data.config === 'object' ? deepClone(data.config) : {})
  }
  return {
    kind: 'tool',
    toolType,
    title: String(data.title || meta?.title || '未命名工具').trim() || '未命名工具',
    icon: String(data.icon || meta?.icon || 'TOOL').trim() || 'TOOL',
    groupLabel: String(data.groupLabel || meta?.groupLabel || '流程工具').trim() || '流程工具',
    description: String(data.description || meta?.description || '').trim(),
    config: mergedConfig,
    inputBinding: normalizeWorkflowInputBinding(data.inputBinding),
    breakpoint: data.breakpoint === true
  }
}

export function buildWorkflowTemplateVariables(context) {
  const inputText = String(context?.inputText || '').trim()
  const inputValue = context?.inputValue
  const parentOutputs = Array.isArray(context?.parentOutputs) ? context.parentOutputs : []
  const firstParent = parentOutputs[0]?.text || ''
  const nodes = context?.nodeResults && typeof context.nodeResults === 'object' ? context.nodeResults : {}
  return {
    input: inputText,
    inputValue,
    workflowName: String(context?.workflow?.name || '').trim(),
    workflow: {
      id: String(context?.workflow?.id || '').trim(),
      name: String(context?.workflow?.name || '').trim()
    },
    node: {
      id: String(context?.node?.id || '').trim(),
      title: String(context?.node?.data?.title || context?.node?.label || '').trim(),
      kind: String(context?.node?.data?.kind || '').trim()
    },
    nodeTitle: String(context?.node?.data?.title || context?.node?.label || '').trim(),
    parentCount: parentOutputs.length,
    parent_1: firstParent,
    parents: parentOutputs.map((item, index) => ({
      index,
      nodeId: item.nodeId,
      title: item.nodeTitle,
      text: item.text,
      value: item.value
    })),
    nodes
  }
}

function buildToolVariables(context) {
  return buildWorkflowTemplateVariables(context)
}

function getCapabilityCatalogSummary() {
  return getCapabilityBusCatalog().map(item => ({
    key: item.namespace ? `${item.namespace}.${item.key}` : item.key,
    label: item.label,
    category: item.category,
    description: item.description
  }))
}

export function getValueFromPayload(payload, path) {
  const normalizedPath = String(path || '').trim()
  if (!normalizedPath) {
    if (payload?.value !== undefined) return payload.value
    return payload?.text ?? ''
  }
  if (payload?.value != null && typeof payload.value === 'object') {
    const direct = getByPath(payload.value, normalizedPath)
    if (direct !== undefined) return direct
  }
  const parsedText = safeParseJson(payload?.text, null)
  if (parsedText != null && typeof parsedText === 'object') {
    const extracted = getByPath(parsedText, normalizedPath)
    if (extracted !== undefined) return extracted
  }
  if (typeof payload?.value === 'string') {
    const parsedValue = safeParseJson(payload.value, null)
    if (parsedValue != null && typeof parsedValue === 'object') {
      const extracted = getByPath(parsedValue, normalizedPath)
      if (extracted !== undefined) return extracted
    }
  }
  return undefined
}

export function resolveWorkflowNodeInput(node, context = {}) {
  const binding = normalizeWorkflowInputBinding(node?.data?.inputBinding || context?.inputBinding)
  const parentOutputs = Array.isArray(context?.parentOutputs) ? context.parentOutputs : []
  const defaultInputText = String((context?.defaultInputText ?? context?.inputText) || '').trim()
  const nodeResults = context?.nodeResults && typeof context.nodeResults === 'object' ? context.nodeResults : {}

  if (binding.mode === 'template') {
    const rendered = interpolateTemplate(binding.template || '{{input}}', buildWorkflowTemplateVariables({
      ...context,
      inputText: defaultInputText
    }))
    return {
      mode: 'template',
      text: rendered,
      value: rendered,
      sourceNodeId: '',
      sourceNodeTitle: '',
      valuePath: '',
      template: binding.template || '',
      summary: '模板输入'
    }
  }

  if (binding.mode === 'single') {
    const sourcePayload = parentOutputs.find(item => item.nodeId === binding.sourceNodeId) ||
      (binding.sourceNodeId ? nodeResults[binding.sourceNodeId] : null) ||
      parentOutputs[0] ||
      null
    const rawValue = sourcePayload
      ? (binding.valuePath ? getValueFromPayload(sourcePayload, binding.valuePath) : (sourcePayload.value ?? sourcePayload.text ?? ''))
      : ''
    const text = stringifyWorkflowValue(rawValue)
    const sourceTitle = String(sourcePayload?.nodeTitle || sourcePayload?.title || sourcePayload?.nodeId || '').trim()
    const pathLabel = binding.valuePath ? `.${binding.valuePath}` : ''
    return {
      mode: 'single',
      text,
      value: rawValue,
      sourceNodeId: String(sourcePayload?.nodeId || binding.sourceNodeId || '').trim(),
      sourceNodeTitle: sourceTitle,
      valuePath: binding.valuePath,
      template: '',
      summary: sourceTitle ? `来自 ${sourceTitle}${pathLabel}` : '来自指定节点'
    }
  }

  return {
    mode: 'auto',
    text: defaultInputText,
    value: parentOutputs.length <= 1
      ? (parentOutputs[0]?.value ?? parentOutputs[0]?.text ?? '')
      : parentOutputs.map(item => item.value ?? item.text ?? ''),
    sourceNodeId: '',
    sourceNodeTitle: parentOutputs.map(item => item.nodeTitle || item.nodeId).filter(Boolean).join('、'),
    valuePath: '',
    template: '',
    summary: parentOutputs.length > 1 ? `自动汇总 ${parentOutputs.length} 个上游输出` : '自动使用上游输出'
  }
}

async function executeHttpRequest(node, context) {
  const config = node?.data?.config || {}
  const url = String(config.url || '').trim()
  if (!url) {
    throw new Error(`节点“${node?.data?.title || node?.label || '网络请求'}”未配置请求地址`)
  }
  const method = String(config.method || 'POST').trim().toUpperCase()
  const contentType = String(config.contentType || 'json').trim().toLowerCase()
  const variables = buildToolVariables(context)
  const headers = safeParseJson(config.headersText, {}) || {}
  let payload = variables.input
  if (config.bodyTemplate) {
    payload = interpolateTemplate(config.bodyTemplate, variables)
  }

  const requestConfig = {
    url,
    method,
    headers
  }

  if (method === 'GET' || method === 'DELETE') {
    requestConfig.params = contentType === 'json'
      ? { input: payload }
      : { input: String(payload || '') }
  } else if (contentType === 'json') {
    const parsed = safeParseJson(payload, null)
    requestConfig.data = parsed ?? {
      input: String(payload || ''),
      workflowName: variables.workflowName,
      nodeTitle: variables.nodeTitle,
      parentCount: variables.parentCount
    }
    if (!requestConfig.headers['Content-Type']) {
      requestConfig.headers['Content-Type'] = 'application/json'
    }
  } else {
    requestConfig.data = String(payload || '')
    if (!requestConfig.headers['Content-Type']) {
      requestConfig.headers['Content-Type'] = 'text/plain;charset=UTF-8'
    }
  }

  const response = await axios(requestConfig)
  const responseMode = String(config.responseMode || 'body').trim().toLowerCase()
  const output = responseMode === 'status-only'
    ? { status: response.status, statusText: response.statusText || '' }
    : response.data
  return {
    output,
    preview: `已请求 ${method} ${url}，状态 ${response.status}`
  }
}

async function executeJsonExtract(node, context) {
  const config = node?.data?.config || {}
  const rawInputValue = context?.inputValue
  const rawInput = String(context?.inputText || '').trim()
  if (rawInputValue == null && !rawInput) {
    throw new Error('JSON 提取节点没有收到上游数据')
  }
  const parsed = rawInputValue != null && typeof rawInputValue === 'object'
    ? rawInputValue
    : safeParseJson(rawInput, null)
  if (parsed == null) {
    throw new Error('JSON 提取节点收到的内容不是有效 JSON')
  }
  const extracted = getByPath(parsed, config.path)
  const output = extracted == null || extracted === ''
    ? String(config.fallbackValue || '')
    : extracted
  return {
    output,
    preview: String(config.path || 'root').trim()
      ? `已提取字段 ${String(config.path).trim()}`
      : '已输出完整 JSON'
  }
}

async function executeTextTemplate(node, context) {
  const config = node?.data?.config || {}
  const output = interpolateTemplate(config.template || '{{input}}', buildToolVariables(context))
  return {
    output,
    preview: '已按模板生成文本'
  }
}

async function executeFieldMapper(node, context) {
  const config = node?.data?.config || {}
  const fieldName = String(config.fieldName || 'payload').trim() || 'payload'
  const mapped = {
    [fieldName]: context?.inputValue != null ? context.inputValue : String(context?.inputText || '')
  }
  if (config.includeMeta !== false) {
    mapped._meta = {
      workflowName: String(context?.workflow?.name || '').trim(),
      nodeTitle: String(node?.data?.title || node?.label || '').trim(),
      parentCount: Array.isArray(context?.parentOutputs) ? context.parentOutputs.length : 0
    }
  }
  return {
    output: mapped,
    preview: `已映射为字段 ${fieldName}`
  }
}

async function executeContentMerge(node, context) {
  const config = node?.data?.config || {}
  const parentOutputs = Array.isArray(context?.parentOutputs) ? context.parentOutputs : []
  const parts = parentOutputs
    .map(item => String(item?.text || '').trim())
    .filter(Boolean)
  const separator = String(config.separator ?? '\n\n')
  const merged = parts.join(separator)
  if (config.template) {
    return {
      output: interpolateTemplate(config.template, {
        ...buildToolVariables(context),
        merged
      }),
      preview: `已合并 ${parts.length} 段内容`
    }
  }
  return {
    output: merged,
    preview: `已合并 ${parts.length} 段内容`
  }
}

async function executeTextReplace(node, context) {
  const config = node?.data?.config || {}
  const source = String(context?.inputText || '')
  if (!String(config.searchValue || '').trim()) {
    throw new Error('文本替换节点缺少查找内容')
  }
  let output = source
  if (config.useRegex) {
    const regex = new RegExp(String(config.searchValue || ''), String(config.regexFlags || 'g'))
    output = source.replace(regex, String(config.replaceValue || ''))
  } else {
    const searchValue = String(config.searchValue || '')
    const replaceValue = String(config.replaceValue || '')
    if (config.caseSensitive === false) {
      const escaped = searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      output = source.replace(new RegExp(escaped, 'gi'), replaceValue)
    } else {
      output = source.split(searchValue).join(replaceValue)
    }
  }
  return {
    output,
    preview: '已完成文本替换'
  }
}

async function executeRegexExtract(node, context) {
  const config = node?.data?.config || {}
  const source = String(context?.inputText || '')
  const pattern = String(config.pattern || '').trim()
  if (!pattern) {
    throw new Error('正则提取节点缺少表达式')
  }
  const rawFlags = String(config.flags || 'g')
  const regex = new RegExp(pattern, rawFlags.includes('g') ? rawFlags : `${rawFlags}g`)
  const matches = [...source.matchAll(regex)]
  if (matches.length === 0) {
    return {
      output: '',
      preview: '未匹配到内容'
    }
  }
  const groupIndex = Math.max(0, Number(config.groupIndex || 0))
  const values = matches.map(match => match?.[groupIndex] ?? match?.[0] ?? '').filter(Boolean)
  const matchIndex = Number(config.matchIndex ?? 0)
  const output = matchIndex === -1
    ? values.join(String(config.joinSeparator ?? '\n'))
    : (values[matchIndex] ?? '')
  return {
    output,
    preview: matchIndex === -1 ? `已提取 ${values.length} 条匹配` : '已提取目标匹配'
  }
}

async function executeConditionCheck(node, context) {
  const config = node?.data?.config || {}
  const rawInput = String(context?.inputText || '')
  const subjectPath = String(config.subjectPath || '').trim()
  let targetValue = context?.inputValue
  if (subjectPath) {
    const payload = {
      value: context?.inputValue,
      text: rawInput
    }
    const extracted = getValueFromPayload(payload, subjectPath)
    if (extracted !== undefined) targetValue = extracted
  }
  const subjectText = stringifyWorkflowValue(targetValue != null ? targetValue : rawInput)
  const input = config.trimInput === false ? subjectText : subjectText.trim()
  const expectedValue = String(config.expectedValue || '')
  const mode = String(config.mode || 'contains').trim()
  let matched = false
  if (mode === 'contains') {
    matched = expectedValue ? input.includes(expectedValue) : false
  } else if (mode === 'equals') {
    matched = input === expectedValue
  } else if (mode === 'not-empty') {
    matched = input.length > 0
  } else if (mode === 'regex') {
    matched = expectedValue ? new RegExp(expectedValue, String(config.regexFlags || 'i')).test(input) : false
  }
  const output = {
    matched,
    mode,
    input,
    subjectPath,
    expectedValue,
    resultText: matched ? String(config.trueValue || '命中') : String(config.falseValue || '未命中')
  }
  return {
    output,
    preview: matched ? '条件判断结果：命中' : '条件判断结果：未命中'
  }
}

/** 编排时调试：模拟条件判断结果（不执行，仅根据输入和配置计算） */
export function simulateConditionCheck(node, context) {
  const config = node?.data?.config || {}
  const rawInput = String(context?.inputText || '')
  const subjectPath = String(config.subjectPath || '').trim()
  let targetValue = context?.inputValue
  if (subjectPath) {
    const payload = { value: context?.inputValue, text: rawInput }
    const extracted = getValueFromPayload(payload, subjectPath)
    if (extracted !== undefined) targetValue = extracted
  }
  const subjectText = stringifyWorkflowValue(targetValue != null ? targetValue : rawInput)
  const input = config.trimInput === false ? subjectText : subjectText.trim()
  const expectedValue = String(config.expectedValue || '')
  const mode = String(config.mode || 'contains').trim()
  let matched = false
  if (mode === 'contains') {
    matched = expectedValue ? input.includes(expectedValue) : false
  } else if (mode === 'equals') {
    matched = input === expectedValue
  } else if (mode === 'not-empty') {
    matched = input.length > 0
  } else if (mode === 'regex') {
    matched = expectedValue ? new RegExp(expectedValue, String(config.regexFlags || 'i')).test(input) : false
  }
  return {
    matched,
    subjectText: input,
    resultText: matched ? String(config.trueValue || '命中') : String(config.falseValue || '未命中')
  }
}

/** 编排时调试：模拟 JSON 提取结果 */
export function simulateJsonExtract(node, context) {
  const config = node?.data?.config || {}
  const rawInputValue = context?.inputValue
  const rawInput = String(context?.inputText || '').trim()
  if (rawInputValue == null && !rawInput) return null
  const parsed = rawInputValue != null && typeof rawInputValue === 'object'
    ? rawInputValue
    : safeParseJson(rawInput, null)
  if (parsed == null) return null
  const extracted = getByPath(parsed, config.path)
  return extracted == null || extracted === ''
    ? String(config.fallbackValue || '')
    : extracted
}

async function executeDelay(node, context) {
  const config = node?.data?.config || {}
  const delayMs = Math.max(0, Number(config.delayMs || 0))
  await sleep(delayMs)
  return {
    output: String(context?.inputText || ''),
    preview: `已等待 ${delayMs} ms`
  }
}

async function executeSetVariables(node) {
  const config = node?.data?.config || {}
  const valueType = String(config.valueType || 'text').trim().toLowerCase()
  if (valueType === 'json') {
    const parsed = safeParseJson(config.valueText, null)
    if (parsed == null) {
      throw new Error('固定变量节点中的 JSON 配置无效')
    }
    return {
      output: parsed,
      preview: '已输出固定 JSON'
    }
  }
  return {
    output: String(config.valueText || ''),
    preview: '已输出固定文本'
  }
}

async function executeCapabilityBusTool(node, context) {
  const config = node?.data?.config || {}
  const capabilityKey = String(config.capabilityKey || '').trim()
  if (!capabilityKey) {
    throw new Error('能力总线节点缺少 capabilityKey')
  }
  const variables = buildToolVariables(context)
  let params = {}
  if (config.paramsText) {
    const rendered = interpolateTemplate(String(config.paramsText || '{}'), {
      ...variables,
      capabilityCatalog: getCapabilityCatalogSummary()
    })
    params = safeParseJson(rendered, {}) || {}
  }
  const result = executeCapabilityBusRequest({
    capabilityKey,
    params,
    inputText: context?.inputText || '',
    entry: 'workflow',
    launchSource: 'workflow',
    confirmed: true,
    workflowId: context?.workflow?.id || '',
    workflowName: context?.workflow?.name || ''
  })
  return {
    output: result,
    preview: `已执行 ${result.capabilityLabel || capabilityKey}`
  }
}

export async function executeWorkflowTool(node, context = {}) {
  const toolType = String(node?.data?.toolType || '').trim()
  switch (toolType) {
    case 'http-request':
      return executeHttpRequest(node, context)
    case 'json-extract':
      return executeJsonExtract(node, context)
    case 'text-template':
      return executeTextTemplate(node, context)
    case 'field-mapper':
      return executeFieldMapper(node, context)
    case 'content-merge':
      return executeContentMerge(node, context)
    case 'text-replace':
      return executeTextReplace(node, context)
    case 'regex-extract':
      return executeRegexExtract(node, context)
    case 'condition-check':
      return executeConditionCheck(node, context)
    case 'delay':
      return executeDelay(node, context)
    case 'set-variables':
      return executeSetVariables(node, context)
    case 'capability-bus':
    case 'wps-capability':
      return executeCapabilityBusTool(node, context)
    default:
      throw new Error(`暂不支持执行工具类型：${toolType || 'unknown'}`)
  }
}

export function getWorkflowToolOutputText(result) {
  return stringifyOutput(result?.output)
}
