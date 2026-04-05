import { getWpsCapabilityCatalog, getWpsCapabilityByKey } from './wpsCapabilityCatalog.js'
import { executeWpsCapabilityDirect } from './wpsCapabilityExecutor.js'
import {
  executeUtilityCapabilityDirect,
  getUtilityCapabilityByKey,
  getUtilityCapabilityCatalog
} from './utilityCapabilityNamespace.js'
import { appendCapabilityAuditRecord } from './capabilityAuditStore.js'
import { evaluateCapabilityPolicy, inferCapabilityRiskLevel } from './capabilityPolicyStore.js'
import { appendCapabilityQuotaUsage, evaluateCapabilityQuota } from './capabilityQuotaStore.js'

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function parseParamsCandidate(raw) {
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(String(raw))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch (_) {
    return {}
  }
}

function normalizeParamDefinition(definition, requiredByCollection = false) {
  if (!definition) return null
  if (typeof definition === 'string') {
    const key = normalizeString(definition)
    if (!key) return null
    return {
      key,
      label: key,
      type: 'text',
      required: requiredByCollection === true
    }
  }
  if (typeof definition === 'object' && !Array.isArray(definition)) {
    const key = normalizeString(definition.key || definition.name)
    if (!key) return null
    return {
      ...definition,
      key,
      label: normalizeString(definition.label, key),
      type: normalizeString(definition.type, 'text'),
      required: definition.required !== false && (requiredByCollection === true || definition.required === true)
    }
  }
  return null
}

function normalizeCapabilityParamSchema(capability = {}) {
  const required = (Array.isArray(capability?.requiredParams) ? capability.requiredParams : [])
    .map(item => normalizeParamDefinition(item, true))
    .filter(Boolean)
  const optional = (Array.isArray(capability?.optionalParams) ? capability.optionalParams : [])
    .map(item => normalizeParamDefinition(item, false))
    .filter(Boolean)
  return [...required, ...optional]
}

function validateCapabilityParams(capability = {}, params = {}) {
  const normalizedParams = params && typeof params === 'object' && !Array.isArray(params) ? params : {}
  const schema = normalizeCapabilityParamSchema(capability)
  schema.forEach((field) => {
    const key = normalizeString(field?.key)
    if (!key) return
    const value = normalizedParams[key]
    const isMissing = value == null || (typeof value === 'string' && !value.trim())
    if (field.required === true && isMissing) {
      throw new Error(`能力参数缺失：${field.label || key}`)
    }
    if (isMissing) return
    const type = normalizeString(field?.type, 'text')
    if ((type === 'number' || type === 'page-selector') && !Number.isFinite(Number(value))) {
      throw new Error(`能力参数格式错误：${field.label || key} 需要数字`)
    }
    if (type === 'boolean' && typeof value !== 'boolean') {
      throw new Error(`能力参数格式错误：${field.label || key} 需要布尔值`)
    }
    if (type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
      throw new Error(`能力参数格式错误：${field.label || key} 需要 JSON 对象`)
    }
    if (type === 'text' || type === 'path' || type === 'password' || type === 'color') {
      if (typeof value !== 'string') {
        throw new Error(`能力参数格式错误：${field.label || key} 需要文本`)
      }
    }
    const options = Array.isArray(field?.options) ? field.options : []
    if (options.length > 0) {
      const allowed = options.map(item => normalizeString(item?.value ?? item))
      if (!allowed.includes(normalizeString(value))) {
        throw new Error(`能力参数取值超出允许范围：${field.label || key}`)
      }
    }
  })
  return normalizedParams
}

const CAPABILITY_NAMESPACES = {}
const CAPABILITY_NAMESPACE_META = {}

function buildNamespaceMeta(namespace, meta = {}) {
  return {
    namespace,
    label: normalizeString(meta.label, namespace === 'wps' ? 'WPS 原生能力' : namespace),
    description: normalizeString(meta.description),
    manifestVersion: normalizeString(meta.manifestVersion, '1.0.0'),
    pluginType: normalizeString(meta.pluginType, 'internal'),
    author: normalizeString(meta.author, 'system')
  }
}

function createWpsNamespaceHandler() {
  return {
    getCatalog: () => getWpsCapabilityCatalog().map(item => ({
      namespace: 'wps',
      key: item.capabilityKey,
      label: item.label,
      category: item.category,
      description: item.description,
      requiredParams: item.requiredParams || [],
      optionalParams: item.optionalParams || []
    })),
    getItem: (key) => getWpsCapabilityByKey(key),
    execute: (key, params) => executeWpsCapabilityDirect(key, params)
  }
}

function createUtilityNamespaceHandler() {
  return {
    getCatalog: () => getUtilityCapabilityCatalog().map(item => ({
      namespace: 'utility',
      key: item.capabilityKey,
      label: item.label,
      category: item.category,
      description: item.description,
      requiredParams: item.requiredParams || [],
      optionalParams: item.optionalParams || []
    })),
    getItem: (key) => getUtilityCapabilityByKey(key),
    execute: (key, params) => executeUtilityCapabilityDirect(key, params)
  }
}

function ensureDefaultCapabilityNamespaces() {
  if (!CAPABILITY_NAMESPACES.wps) {
    CAPABILITY_NAMESPACES.wps = createWpsNamespaceHandler()
    CAPABILITY_NAMESPACE_META.wps = buildNamespaceMeta('wps', {
      label: 'WPS 原生能力',
      description: 'WPS 文档原生能力集合，支持写回、插入、格式与文件级操作。'
    })
  }
  if (!CAPABILITY_NAMESPACES.utility) {
    CAPABILITY_NAMESPACES.utility = createUtilityNamespaceHandler()
    CAPABILITY_NAMESPACE_META.utility = buildNamespaceMeta('utility', {
      label: 'Utility 扩展能力',
      description: '文本、JSON 与模板类通用扩展能力，可被 workflow 和 capability bus 复用。'
    })
  }
}

export function registerCapabilityNamespace(namespace, handler = {}, meta = {}) {
  const normalized = normalizeString(namespace)
  if (!normalized) {
    throw new Error('注册能力命名空间时缺少 namespace')
  }
  if (
    typeof handler?.getCatalog !== 'function' ||
    typeof handler?.getItem !== 'function' ||
    typeof handler?.execute !== 'function'
  ) {
    throw new Error(`能力命名空间 ${normalized} 缺少 getCatalog/getItem/execute 处理器`)
  }
  CAPABILITY_NAMESPACES[normalized] = handler
  CAPABILITY_NAMESPACE_META[normalized] = buildNamespaceMeta(normalized, meta)
  return normalized
}

export function unregisterCapabilityNamespace(namespace) {
  const normalized = normalizeString(namespace)
  if (!normalized || normalized === 'wps') return false
  if (!CAPABILITY_NAMESPACES[normalized]) return false
  delete CAPABILITY_NAMESPACES[normalized]
  delete CAPABILITY_NAMESPACE_META[normalized]
  return true
}

export function listCapabilityNamespaces() {
  ensureDefaultCapabilityNamespaces()
  return Object.keys(CAPABILITY_NAMESPACES)
}

export function getCapabilityBusCatalog() {
  ensureDefaultCapabilityNamespaces()
  return Object.values(CAPABILITY_NAMESPACES).flatMap(namespace => namespace.getCatalog())
}

export function getCapabilityBusManifest() {
  ensureDefaultCapabilityNamespaces()
  return listCapabilityNamespaces().map((namespace) => {
    const meta = CAPABILITY_NAMESPACE_META[namespace] || buildNamespaceMeta(namespace)
    const catalog = CAPABILITY_NAMESPACES[namespace]?.getCatalog?.() || []
    return {
      ...meta,
      capabilities: catalog.map((item) => ({
        namespace,
        key: normalizeString(item.key || item.capabilityKey),
        label: normalizeString(item.label),
        category: normalizeString(item.category),
        description: normalizeString(item.description),
        riskLevel: inferCapabilityRiskLevel(item, namespace),
        paramsSchema: normalizeCapabilityParamSchema(item)
      }))
    }
  })
}

export function exportCapabilityBusManifest() {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    namespaces: getCapabilityBusManifest()
  }, null, 2)
}

export function getCapabilityBusItem(key) {
  ensureDefaultCapabilityNamespaces()
  const normalized = normalizeString(key)
  if (!normalized) return null
  const [maybeNamespace, ...rest] = normalized.split('.')
  if (rest.length > 0 && CAPABILITY_NAMESPACES[maybeNamespace]) {
    return CAPABILITY_NAMESPACES[maybeNamespace].getItem(rest.join('.'))
  }
  return CAPABILITY_NAMESPACES.wps.getItem(normalized)
}

export function getCapabilityParamSchema(key) {
  const capability = getCapabilityBusItem(key)
  if (!capability) return []
  return normalizeCapabilityParamSchema(capability)
}

export function getCapabilityRiskLevel(key) {
  const capability = getCapabilityBusItem(key)
  if (!capability) return 'low'
  const namespace = normalizeCapabilityBusRequest({ capabilityKey: key }).namespace
  return inferCapabilityRiskLevel(capability, namespace)
}

export function normalizeCapabilityBusRequest(request = {}) {
  ensureDefaultCapabilityNamespaces()
  const rawKey = normalizeString(request.capabilityKey || request.key)
  const explicitNamespace = normalizeString(request.namespace)
  const [maybeNamespace, ...rest] = rawKey.split('.')
  const namespace = explicitNamespace || (rest.length > 0 && CAPABILITY_NAMESPACES[maybeNamespace] ? maybeNamespace : 'wps')
  const normalizedKey = namespace !== 'wps' && rawKey.startsWith(`${namespace}.`)
    ? rawKey.slice(namespace.length + 1)
    : (namespace === 'wps' && rawKey.startsWith('wps.') ? rawKey.slice(4) : (rest.length > 0 && namespace === maybeNamespace ? rest.join('.') : rawKey))
  return {
    namespace,
    capabilityKey: normalizedKey,
    params: parseParamsCandidate(request.params || request.paramValues || {}),
    requirementText: normalizeString(request.requirementText || request.inputText)
  }
}

export function executeCapabilityBusRequest(request = {}) {
  ensureDefaultCapabilityNamespaces()
  const normalized = normalizeCapabilityBusRequest(request)
  const namespaceHandler = CAPABILITY_NAMESPACES[normalized.namespace]
  const startedAt = Date.now()
  if (!namespaceHandler) {
    throw new Error(`未找到能力命名空间：${normalized.namespace || 'unknown'}`)
  }
  const capability = namespaceHandler.getItem(normalized.capabilityKey)
  if (!capability) {
    throw new Error(`未找到可执行能力：${normalized.namespace}.${normalized.capabilityKey || 'unknown'}`)
  }
  const riskLevel = inferCapabilityRiskLevel(capability, normalized.namespace)
  const policyDecision = evaluateCapabilityPolicy({
    ...request,
    namespace: normalized.namespace,
    capabilityKey: normalized.capabilityKey
  }, capability)
  const groupKey = `${normalizeString(request.taskId) || normalizeString(request.workflowId) || normalizeString(request.entry, 'adhoc')}:${normalized.namespace}.${normalized.capabilityKey}`
  if (!policyDecision.allowed) {
    appendCapabilityAuditRecord({
      namespace: normalized.namespace,
      capabilityKey: normalized.capabilityKey,
      capabilityLabel: capability.label,
      status: policyDecision.decision === 'deny' ? 'denied' : 'failed',
      decision: policyDecision.decision,
      decisionReason: policyDecision.reason,
      confirmed: policyDecision.confirmed,
      riskLevel,
      groupKey,
      entry: normalizeString(request.entry),
      launchSource: normalizeString(request.launchSource),
      taskId: normalizeString(request.taskId),
      workflowId: normalizeString(request.workflowId),
      workflowName: normalizeString(request.workflowName),
      requirementText: normalized.requirementText,
      params: normalized.params,
      durationMs: Date.now() - startedAt
    })
    const error = new Error(policyDecision.reason || '能力策略拒绝执行')
    error.code = policyDecision.decision === 'confirm'
      ? 'CAPABILITY_CONFIRM_REQUIRED'
      : policyDecision.decision === 'throttled'
        ? 'CAPABILITY_THROTTLED'
        : 'CAPABILITY_DENIED'
    throw error
  }
  const quotaDecision = evaluateCapabilityQuota({
    namespace: normalized.namespace,
    capabilityKey: normalized.capabilityKey,
    policySnapshot: policyDecision.policySnapshot
  })
  if (!quotaDecision.allowed) {
    appendCapabilityAuditRecord({
      namespace: normalized.namespace,
      capabilityKey: normalized.capabilityKey,
      capabilityLabel: capability.label,
      status: 'failed',
      decision: quotaDecision.decision,
      decisionReason: quotaDecision.reason,
      confirmed: policyDecision.confirmed,
      riskLevel,
      groupKey,
      entry: normalizeString(request.entry),
      launchSource: normalizeString(request.launchSource),
      taskId: normalizeString(request.taskId),
      workflowId: normalizeString(request.workflowId),
      workflowName: normalizeString(request.workflowName),
      requirementText: normalized.requirementText,
      params: normalized.params,
      durationMs: Date.now() - startedAt
    })
    const error = new Error(quotaDecision.reason || '能力调用超出配额限制')
    error.code = 'CAPABILITY_THROTTLED'
    throw error
  }
  const validatedParams = validateCapabilityParams(capability, normalized.params)
  try {
    const result = namespaceHandler.execute(normalized.capabilityKey, validatedParams)
    appendCapabilityQuotaUsage({
      namespace: normalized.namespace,
      capabilityKey: normalized.capabilityKey
    })
    const auditRecord = appendCapabilityAuditRecord({
      namespace: normalized.namespace,
      capabilityKey: normalized.capabilityKey,
      capabilityLabel: capability.label,
      status: 'completed',
      riskLevel,
      decision: policyDecision.decision,
      decisionReason: policyDecision.reason,
      confirmed: policyDecision.confirmed,
      groupKey,
      entry: normalizeString(request.entry),
      launchSource: normalizeString(request.launchSource),
      taskId: normalizeString(request.taskId),
      workflowId: normalizeString(request.workflowId),
      workflowName: normalizeString(request.workflowName),
      requirementText: normalized.requirementText,
      params: validatedParams,
      result,
      durationMs: Date.now() - startedAt
    })
    return {
      namespace: normalized.namespace,
      capabilityKey: normalized.capabilityKey,
      capabilityLabel: capability.label,
      params: validatedParams,
      result,
      auditId: auditRecord.id
    }
  } catch (error) {
    appendCapabilityAuditRecord({
      namespace: normalized.namespace,
      capabilityKey: normalized.capabilityKey,
      capabilityLabel: capability.label,
      status: error?.code === 'TASK_CANCELLED' ? 'cancelled' : 'failed',
      riskLevel,
      decision: policyDecision.decision,
      decisionReason: error?.message || policyDecision.reason,
      confirmed: policyDecision.confirmed,
      groupKey,
      entry: normalizeString(request.entry),
      launchSource: normalizeString(request.launchSource),
      taskId: normalizeString(request.taskId),
      workflowId: normalizeString(request.workflowId),
      workflowName: normalizeString(request.workflowName),
      requirementText: normalized.requirementText,
      params: validatedParams,
      errorMessage: error?.message || String(error),
      durationMs: Date.now() - startedAt
    })
    throw error
  }
}

ensureDefaultCapabilityNamespaces()
