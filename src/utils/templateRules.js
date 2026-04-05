export const DATA_TYPES = [
  { value: 'string', label: '字符串', hint: '任意文本，如姓名、地址、备注' },
  { value: 'select', label: '下拉选项', hint: '从预设选项中选择，可输入多个选项，英文逗号分隔' },
  { value: 'integer', label: '整数', hint: '不含小数点的数字，如数量、序号' },
  { value: 'decimal', label: '小数', hint: '含小数点的数字，如金额、比例' },
  { value: 'date', label: '日期', hint: '日期，格式 YYYY-MM-DD' },
  { value: 'time', label: '时间', hint: '时间，格式 HH:mm 或 HH:mm:ss' },
  { value: 'datetime', label: '日期+时间', hint: '日期+时间，格式 YYYY-MM-DD HH:mm' },
  { value: 'boolean', label: '布尔', hint: '是/否、同意/不同意' },
  { value: 'email', label: '邮箱', hint: '电子邮箱地址' },
  { value: 'phone', label: '电话', hint: '手机号或固定电话' },
  { value: 'idcard', label: '身份证号', hint: '18 位身份证' },
  { value: 'url', label: '网址', hint: '网页链接' }
]

export const REVIEW_TYPES = [
  { value: 'none', label: '无', hint: '不做额外审查' },
  { value: 'regex', label: '正则审查', hint: '用正则表达式校验格式' },
  { value: 'format', label: '格式校验', hint: '按数据类型做格式校验' },
  { value: 'range', label: '范围校验', hint: '数值或长度在指定范围内' },
  { value: 'enum', label: '枚举校验', hint: '只能是指定选项之一' },
  { value: 'llm', label: '大模型审查', hint: '用 AI 判断内容是否符合描述' },
  { value: 'sensitive', label: '敏感词审查', hint: '检查是否包含敏感词' },
  { value: 'consistency', label: '格式一致性', hint: '与文档中其他同类项格式一致' },
  { value: 'logic', label: '逻辑关系', hint: '与关联项满足逻辑关系（如日期先后）' },
  { value: 'crossref', label: '跨项校验', hint: '与指定书签内容一致或关联' }
]

export const SAMPLE_CONTENT_MODE_OPTIONS = [
  { value: 'keep', label: '保留内容' },
  { value: 'clear', label: '清空内容' },
  { value: 'example', label: '样例内容' }
]

export const INSTANCE_STRATEGY_OPTIONS = [
  { value: 'semantic-group', label: '语义合并' },
  { value: 'per-instance', label: '逐实例处理' }
]

export function genId() {
  return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function getDefaultConstraints(dataType) {
  if (dataType === 'string') {
    return { minLength: '', maxLength: '', mustContain: '', mustNotContain: '', pattern: '' }
  }
  if (dataType === 'integer' || dataType === 'decimal') {
    const c = { min: '', max: '', equals: '' }
    if (dataType === 'decimal') c.decimalPlaces = ''
    return c
  }
  if (dataType === 'date' || dataType === 'datetime' || dataType === 'time') {
    return { dateMin: '', dateMax: '', dateEquals: '' }
  }
  if (dataType === 'boolean') {
    return { allowedValues: '是,否' }
  }
  if (dataType === 'select') {
    return { selectOptions: '' }
  }
  return {}
}

export function buildDefaultRule() {
  return {
    id: '',
    name: '',
    tag: '',
    required: false,
    dataType: 'string',
    reviewType: 'none',
    reviewRule: '',
    reviewHint: '',
    fillHint: '',
    remark: '',
    semanticKey: '',
    sampleContentMode: 'keep',
    sampleContent: '',
    auditEnabled: true,
    auditPriority: 50,
    instanceStrategy: 'semantic-group',
    extractionHints: '',
    constraints: getDefaultConstraints('string')
  }
}

import { getEffectiveDataDir, joinDataPath, ensureDir, getDefaultDataPath, pathJoin } from './dataPathSettings.js'

export const RULES_VAR_NAME = 'NdTemplateRules'
export const RULES_STORAGE_KEY = 'NdTemplateRules'
export const RULES_SYNC_KEY = 'NdTemplateRules_sync'
export const RULES_UPDATED_EVENT = 'nd-rules-updated'
/** 规则数据文件名，从设置中获取的路径下统一读写，本质为 JSON */
const RULES_FILE_NAME = 'relus.aidooo'

function getApplication() {
  return window.Application || window.opener?.Application || window.parent?.Application || null
}

function getApplicationSource() {
  if (window.Application) return 'window'
  if (window.opener?.Application) return 'opener'
  if (window.parent?.Application) return 'parent'
  return 'unavailable'
}

function emitRulesUpdated(targetWindow) {
  try {
    targetWindow?.dispatchEvent?.(new CustomEvent(RULES_UPDATED_EVENT, {
      detail: { updatedAt: Date.now() }
    }))
  } catch (_) {}
}

function notifyRulesUpdated() {
  try {
    localStorage.setItem(RULES_SYNC_KEY, Date.now().toString())
  } catch (e) {}
  emitRulesUpdated(window)
  try {
    if (window.opener && window.opener !== window) emitRulesUpdated(window.opener)
  } catch (_) {}
  try {
    if (window.parent && window.parent !== window) emitRulesUpdated(window.parent)
  } catch (_) {}
}

/**
 * 规则文件路径：优先从设置中获取的数据路径，未设置时使用默认数据路径
 */
function getRulesFilePath() {
  try {
    const dataDir = getEffectiveDataDir() || getDefaultDataPath()
    if (!dataDir) return null
    const path = getEffectiveDataDir()
      ? (joinDataPath(RULES_FILE_NAME) || null)
      : pathJoin(dataDir, RULES_FILE_NAME)
    return path || null
  } catch (e) {
    return null
  }
}

export function loadRulesFromDoc() {
  try {
    const storageRules = loadRulesFromStorage()
    const app = getApplication()
    const doc = app?.ActiveDocument
    if (!doc?.Variables) {
      console.log('[templateRules.loadRulesFromDoc] 无文档变量，回退 storageRules', {
        applicationSource: getApplicationSource(),
        storageRuleCount: storageRules.length,
        storageRules
      })
      return storageRules
    }
    let docRules = []
    try {
      const v = doc.Variables.Item(RULES_VAR_NAME)
      if (v?.Value) {
        const arr = JSON.parse(v.Value)
        if (Array.isArray(arr)) docRules = arr.map(item => normalizeRule(item))
      }
    } catch (e) {}
    if (docRules.length === 0) {
      console.log('[templateRules.loadRulesFromDoc] 文档变量无规则，回退 storageRules', {
        applicationSource: getApplicationSource(),
        storageRuleCount: storageRules.length,
        storageRules
      })
      return storageRules
    }
    const existingIds = new Set(storageRules.map(r => r.id))
    const toAdd = docRules.filter(r => r?.id && !existingIds.has(r.id))
    if (toAdd.length === 0) {
      console.log('[templateRules.loadRulesFromDoc] 文档规则已包含于 storageRules，返回 storageRules', {
        applicationSource: getApplicationSource(),
        storageRuleCount: storageRules.length,
        docRuleCount: docRules.length,
        storageRules,
        docRules
      })
      return storageRules
    }
    const merged = [...storageRules, ...toAdd].map(item => normalizeRule(item))
    try {
      app?.PluginStorage?.setItem(RULES_STORAGE_KEY, JSON.stringify(merged))
    } catch (e) {}
    try {
      saveRulesToFile(merged)
    } catch (e) {}
    notifyRulesUpdated()
    console.log('[templateRules.loadRulesFromDoc] 合并文档规则与 storageRules', {
      applicationSource: getApplicationSource(),
      storageRuleCount: storageRules.length,
      docRuleCount: docRules.length,
      mergedRuleCount: merged.length,
      storageRules,
      docRules,
      mergedRules: merged
    })
    return merged
  } catch (e) {
    console.warn('[templateRules.loadRulesFromDoc] 异常，回退 loadRulesFromStorage', e)
    return loadRulesFromStorage()
  }
}

export function loadRulesFromStorage() {
  const app = getApplication()
  try {
    // 优先从设置路径下的 relus.aidooo 加载
    const fromFile = loadRulesFromFile()
    if (fromFile.length > 0) {
      try {
        app?.PluginStorage?.setItem(RULES_STORAGE_KEY, JSON.stringify(fromFile))
      } catch (e) {}
      return fromFile
    }
  } catch (e) {}
  try {
    const raw = app?.PluginStorage?.getItem(RULES_STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
        if (Array.isArray(arr)) return arr.map(item => normalizeRule(item))
    }
  } catch (e) {}
  return []
}

export function loadRulesFromFile() {
  try {
    const app = getApplication()
    const path = getRulesFilePath()
    if (!path) return []
    const fs = app?.FileSystem
    if (!fs || (typeof fs.ReadFile !== 'function' && typeof fs.readFileString !== 'function')) return []
    const raw = typeof fs.readFileString === 'function' ? fs.readFileString(path) : fs.ReadFile(path)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.map(item => normalizeRule(item)) : []
  } catch (e) {
    return []
  }
}

export function saveRulesToFile(rules) {
  let path = null
  try {
    // 弹窗内可能无 Application，尝试从 opener/parent 获取（WPS ShowDialog）
    const app = window.Application || window.opener?.Application || window.parent?.Application
    if (!app) {
      console.warn('保存规则到文件失败：Application 不可用')
      return
    }
    try {
      if (!window.Application) window.Application = app
    } catch (_) { /* Application 可能为只读，忽略 */ }
    path = getRulesFilePath()
    if (!path) {
      console.warn('保存规则到文件失败：未获取到数据路径（请检查设置或 Application 是否可用）')
      return
    }
    const fs = app?.FileSystem
    if (!fs) {
      console.warn('保存规则到文件失败：FileSystem 不可用')
      return
    }
    const writeFile = typeof fs.writeFileString === 'function' ? fs.writeFileString : (typeof fs.WriteFile === 'function' ? fs.WriteFile : null)
    if (!writeFile) {
      console.warn('保存规则到文件失败：无 writeFileString/WriteFile 方法')
      return
    }
    const dataDir = getEffectiveDataDir() || getDefaultDataPath()
    if (dataDir) ensureDir(fs, dataDir)
    const json = JSON.stringify((rules || []).map(item => normalizeRule(item)))
    const ok = writeFile.call(fs, path, json)
    if (!ok) console.warn('保存规则到文件失败：写入返回 false，路径=', path)
    else if (typeof console !== 'undefined' && console.log) console.log('规则已保存到文件:', path)
  } catch (e) {
    console.warn('保存规则到本地文件失败:', e?.message || e, '路径=', path)
  }
}

export function saveRulesToDoc(rules) {
  const normalizedRules = (rules || []).map(item => normalizeRule(item))
  const json = JSON.stringify(normalizedRules)
  try {
    const app = getApplication()
    const doc = app?.ActiveDocument
    if (doc?.Variables) {
      try {
        const v = doc.Variables.Item(RULES_VAR_NAME)
        if (v) v.Value = json
      } catch (e) {
        doc.Variables.Add(RULES_VAR_NAME, json)
      }
    }
  } catch (e) {
    console.warn('保存规则到文档失败:', e)
  }
  try {
    getApplication()?.PluginStorage?.setItem(RULES_STORAGE_KEY, json)
  } catch (e) {
    console.warn('保存规则到PluginStorage失败:', e)
  }
  try {
    saveRulesToFile(rules)
  } catch (e) {}
  notifyRulesUpdated()
}

export function onRulesStorageSync(callback) {
  const handler = (e) => {
    if (e.key === RULES_SYNC_KEY && e.newValue) {
      try {
        callback()
      } catch (err) {}
    }
  }
  const customHandler = () => {
    try {
      callback()
    } catch (err) {}
  }
  window.addEventListener('storage', handler)
  window.addEventListener(RULES_UPDATED_EVENT, customHandler)
  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener(RULES_UPDATED_EVENT, customHandler)
  }
}

export function normalizeConstraints(c, dataType) {
  if (!c) return getDefaultConstraints(dataType || 'string')
  const out = {}
  if (dataType === 'string') {
    out.minLength = c.minLength === '' || c.minLength == null ? null : Number(c.minLength)
    out.maxLength = c.maxLength === '' || c.maxLength == null ? null : Number(c.maxLength)
    out.mustContain = (c.mustContain || '').trim() || ''
    out.mustNotContain = (c.mustNotContain || '').trim() || ''
    out.pattern = (c.pattern || '').trim() || ''
  } else if (dataType === 'integer' || dataType === 'decimal') {
    out.min = c.min === '' || c.min == null ? null : Number(c.min)
    out.max = c.max === '' || c.max == null ? null : Number(c.max)
    out.equals = c.equals === '' || c.equals == null ? null : Number(c.equals)
    if (dataType === 'decimal') out.decimalPlaces = c.decimalPlaces === '' || c.decimalPlaces == null ? null : Number(c.decimalPlaces)
  } else if (dataType === 'date' || dataType === 'datetime' || dataType === 'time') {
    out.dateMin = (c.dateMin || '').trim() || ''
    out.dateMax = (c.dateMax || '').trim() || ''
    out.dateEquals = (c.dateEquals || '').trim() || ''
  } else if (dataType === 'boolean') {
    out.allowedValues = (c.allowedValues || '是,否').trim() || '是,否'
  } else if (dataType === 'select') {
    out.selectOptions = (c.selectOptions || '').trim() || ''
  }
  return out
}

export function normalizeRule(rule) {
  const source = rule && typeof rule === 'object' ? rule : {}
  const defaults = buildDefaultRule()
  const dataType = source.dataType || defaults.dataType
  const auditPriority = Number(source.auditPriority)
  return {
    ...defaults,
    ...source,
    id: String(source.id || defaults.id),
    name: String(source.name || defaults.name),
    tag: String(source.tag || defaults.tag),
    required: source.required === true,
    dataType,
    reviewType: String(source.reviewType || defaults.reviewType),
    reviewRule: String(source.reviewRule || defaults.reviewRule),
    reviewHint: String(source.reviewHint || defaults.reviewHint),
    fillHint: String(source.fillHint || defaults.fillHint),
    remark: String(source.remark || defaults.remark),
    semanticKey: String(source.semanticKey || defaults.semanticKey),
    sampleContentMode: ['keep', 'clear', 'example'].includes(String(source.sampleContentMode || ''))
      ? String(source.sampleContentMode)
      : defaults.sampleContentMode,
    sampleContent: String(source.sampleContent || defaults.sampleContent),
    auditEnabled: source.auditEnabled !== false,
    auditPriority: Number.isFinite(auditPriority) ? auditPriority : defaults.auditPriority,
    instanceStrategy: ['semantic-group', 'per-instance'].includes(String(source.instanceStrategy || ''))
      ? String(source.instanceStrategy)
      : defaults.instanceStrategy,
    extractionHints: String(source.extractionHints || defaults.extractionHints),
    constraints: normalizeConstraints(source.constraints, dataType)
  }
}

function testEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function testPhone(value) {
  return /^(\+?\d{2,4}[-\s]?)?(\d{3,4}[-\s]?)?\d{7,11}$/.test(value)
}

function testIdCard(value) {
  return /^\d{17}[\dXx]$/.test(value)
}

function testUrl(value) {
  return /^(https?:\/\/|www\.)[^\s]+$/i.test(value)
}

function toComparableDateValue(dataType, value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (dataType === 'time') return raw
  const normalized = raw.replace(/[年\/.-]/g, '-').replace(/月/g, '-').replace(/日/g, '').replace(/\s+/g, 'T')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

export function validateRuleValue(rule, value, context = {}) {
  const normalizedRule = normalizeRule(rule)
  const errors = []
  const rawValue = value == null ? '' : String(value).trim()
  const constraints = normalizedRule.constraints || {}

  if (normalizedRule.required && !rawValue) {
    errors.push(normalizedRule.reviewHint || `${normalizedRule.name || '该字段'}不能为空`)
    return errors
  }
  if (!rawValue) return errors

  if (normalizedRule.dataType === 'string') {
    if (constraints.minLength != null && rawValue.length < Number(constraints.minLength)) {
      errors.push(normalizedRule.reviewHint || `长度不能少于 ${constraints.minLength}`)
    }
    if (constraints.maxLength != null && rawValue.length > Number(constraints.maxLength)) {
      errors.push(normalizedRule.reviewHint || `长度不能超过 ${constraints.maxLength}`)
    }
    if (constraints.mustContain && !rawValue.includes(String(constraints.mustContain))) {
      errors.push(normalizedRule.reviewHint || `必须包含“${constraints.mustContain}”`)
    }
    if (constraints.mustNotContain && rawValue.includes(String(constraints.mustNotContain))) {
      errors.push(normalizedRule.reviewHint || `不能包含“${constraints.mustNotContain}”`)
    }
    if (constraints.pattern) {
      try {
        const regex = new RegExp(constraints.pattern)
        if (!regex.test(rawValue)) {
          errors.push(normalizedRule.reviewHint || '格式不符合正则要求')
        }
      } catch (_) {}
    }
  }

  if (normalizedRule.dataType === 'integer') {
    if (!/^-?\d+$/.test(rawValue)) {
      errors.push(normalizedRule.reviewHint || '必须为整数')
    } else {
      const num = Number(rawValue)
      if (constraints.min != null && num < Number(constraints.min)) errors.push(normalizedRule.reviewHint || `不能小于 ${constraints.min}`)
      if (constraints.max != null && num > Number(constraints.max)) errors.push(normalizedRule.reviewHint || `不能大于 ${constraints.max}`)
      if (constraints.equals != null && num !== Number(constraints.equals)) errors.push(normalizedRule.reviewHint || `必须等于 ${constraints.equals}`)
    }
  }

  if (normalizedRule.dataType === 'decimal') {
    if (!/^-?\d+(\.\d+)?$/.test(rawValue)) {
      errors.push(normalizedRule.reviewHint || '必须为数字')
    } else {
      const num = Number(rawValue)
      if (constraints.min != null && num < Number(constraints.min)) errors.push(normalizedRule.reviewHint || `不能小于 ${constraints.min}`)
      if (constraints.max != null && num > Number(constraints.max)) errors.push(normalizedRule.reviewHint || `不能大于 ${constraints.max}`)
      if (constraints.equals != null && num !== Number(constraints.equals)) errors.push(normalizedRule.reviewHint || `必须等于 ${constraints.equals}`)
      if (constraints.decimalPlaces != null) {
        const decimalPart = rawValue.split('.')[1] || ''
        if (decimalPart.length > Number(constraints.decimalPlaces)) {
          errors.push(normalizedRule.reviewHint || `小数位不能超过 ${constraints.decimalPlaces}`)
        }
      }
    }
  }

  if (['date', 'datetime', 'time'].includes(normalizedRule.dataType)) {
    const current = toComparableDateValue(normalizedRule.dataType, rawValue)
    if (current == null) {
      errors.push(normalizedRule.reviewHint || '日期或时间格式不正确')
    } else {
      if (constraints.dateMin) {
        const min = toComparableDateValue(normalizedRule.dataType, constraints.dateMin)
        if (min != null && current < min) errors.push(normalizedRule.reviewHint || `不能早于 ${constraints.dateMin}`)
      }
      if (constraints.dateMax) {
        const max = toComparableDateValue(normalizedRule.dataType, constraints.dateMax)
        if (max != null && current > max) errors.push(normalizedRule.reviewHint || `不能晚于 ${constraints.dateMax}`)
      }
      if (constraints.dateEquals) {
        const exact = toComparableDateValue(normalizedRule.dataType, constraints.dateEquals)
        if (exact != null && current !== exact) errors.push(normalizedRule.reviewHint || `必须等于 ${constraints.dateEquals}`)
      }
    }
  }

  if (normalizedRule.dataType === 'boolean') {
    const allowed = String(constraints.allowedValues || '是,否')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
    if (allowed.length > 0 && !allowed.includes(rawValue)) {
      errors.push(normalizedRule.reviewHint || '布尔值不在允许范围内')
    }
  }

  if (normalizedRule.dataType === 'select') {
    const allowed = String(constraints.selectOptions || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
    if (allowed.length > 0) {
      const selected = rawValue.split(',').map(item => item.trim()).filter(Boolean)
      const invalid = selected.filter(item => !allowed.includes(item))
      if (invalid.length > 0) {
        errors.push(normalizedRule.reviewHint || `存在不允许的选项：${invalid.join('、')}`)
      }
    }
  }

  if (normalizedRule.dataType === 'email' && !testEmail(rawValue)) {
    errors.push(normalizedRule.reviewHint || '邮箱格式不正确')
  }
  if (normalizedRule.dataType === 'phone' && !testPhone(rawValue)) {
    errors.push(normalizedRule.reviewHint || '电话格式不正确')
  }
  if (normalizedRule.dataType === 'idcard' && !testIdCard(rawValue)) {
    errors.push(normalizedRule.reviewHint || '身份证号格式不正确')
  }
  if (normalizedRule.dataType === 'url' && !testUrl(rawValue)) {
    errors.push(normalizedRule.reviewHint || '网址格式不正确')
  }

  if (normalizedRule.reviewType === 'regex' && normalizedRule.reviewRule) {
    try {
      const regex = new RegExp(normalizedRule.reviewRule)
      if (!regex.test(rawValue)) {
        errors.push(normalizedRule.reviewHint || '未通过审查规则')
      }
    } catch (_) {}
  }

  if (normalizedRule.reviewType === 'enum' && normalizedRule.reviewRule) {
    const allowed = normalizedRule.reviewRule.split(',').map(item => item.trim()).filter(Boolean)
    if (allowed.length > 0 && !allowed.includes(rawValue)) {
      errors.push(normalizedRule.reviewHint || '值不在允许枚举范围内')
    }
  }

  if (normalizedRule.reviewType === 'range' && normalizedRule.reviewRule) {
    const [minRaw, maxRaw] = normalizedRule.reviewRule.split(',').map(item => item.trim())
    const num = Number(rawValue)
    if (!Number.isNaN(num)) {
      if (minRaw !== '' && num < Number(minRaw)) errors.push(normalizedRule.reviewHint || `不能小于 ${minRaw}`)
      if (maxRaw !== '' && num > Number(maxRaw)) errors.push(normalizedRule.reviewHint || `不能大于 ${maxRaw}`)
    }
  }

  if (normalizedRule.reviewType === 'crossref' && normalizedRule.reviewRule) {
    const related = String(context.relatedValues?.[normalizedRule.reviewRule] || '').trim()
    if (related && rawValue !== related) {
      errors.push(normalizedRule.reviewHint || `与关联字段 ${normalizedRule.reviewRule} 不一致`)
    }
  }

  return [...new Set(errors.filter(Boolean))]
}
