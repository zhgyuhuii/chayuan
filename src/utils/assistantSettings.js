import { loadGlobalSettings, saveGlobalSettings, getGlobalSettingsVersion } from './globalSettings.js'
import { DEFAULT_ASSISTANT_ICON, buildAssistantRibbonIconValue, normalizeAssistantIcon } from './assistantIcons.js'
import { createDefaultReportSettings, normalizeReportSettings } from './reportSettings.js'
import {
  getAssistantResolvedIcon,
  getBuiltinAssistants,
  getBuiltinAssistantDefinition,
  getAssistantDefaultConfig,
  ASSISTANT_DISPLAY_LOCATION_OPTIONS
} from './assistantRegistry.js'

const ASSISTANT_SETTINGS_KEY = 'assistantSettings'
const CUSTOM_ASSISTANTS_KEY = 'customAssistants'
const CUSTOM_ASSISTANT_GROUPS_KEY = 'customAssistantGroups'
const VALID_DISPLAY_LOCATIONS = new Set(
  ASSISTANT_DISPLAY_LOCATION_OPTIONS.map(item => item.value)
)

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeRibbonIconValue(value) {
  const icon = String(value || '').trim()
  return icon || ''
}

function normalizeDisplayLocations(locations, fallback = []) {
  const source = Array.isArray(locations) ? locations : fallback
  const unique = []
  source.forEach(item => {
    const value = String(item || '').trim()
    if (!VALID_DISPLAY_LOCATIONS.has(value)) return
    if (!unique.includes(value)) unique.push(value)
  })
  const hasRibbonMain = unique.includes('ribbon-main')
  const hasRibbonMore = unique.includes('ribbon-more')
  if (hasRibbonMain && hasRibbonMore) {
    return unique.filter(item => item !== 'ribbon-more')
  }
  return unique
}

function normalizeDisplayOrder(value, fallback = null) {
  if (value === '' || value === undefined || value === null) return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export function normalizeAssistantGroupName(value) {
  return String(value || '').trim() || 'custom'
}

export function normalizeAssistantGroupList(groups = []) {
  const result = []
  const seen = new Set()
  const sourceGroups = Array.isArray(groups) ? groups : []
  sourceGroups.forEach(item => {
    const value = normalizeAssistantGroupName(item)
    const key = value.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    result.push(value)
  })
  return result
}

function inferAssistantNameFromPrompt(item = {}) {
  const directName = String(item.name || item.title || item.label || '').trim()
  if (directName && directName !== '未命名助手') return directName
  const text = [
    item.description,
    item.persona,
    item.systemPrompt,
    item.userPromptTemplate
  ].map(value => String(value || '')).join('\n')
  const rules = [
    [/语气|tone|正式 \/ 友好|客户致歉/i, '语气调整'],
    [/术语.*通俗|行业黑话|大白话解释/i, '术语通俗化'],
    [/列表.*段落|项目符号列表.*连贯文字/i, '列表转段落'],
    [/段落.*列表|项目符号列表|关键要点/i, '段落转列表'],
    [/会议纪要|决议|待办事项|责任人|截止日/i, '会议纪要'],
    [/引文|引用|出处|来源|quote|reference/i, '引文核查'],
    [/Markdown 表格|ASCII|CSV|制表符|伪表格/i, '表格转 Markdown'],
    [/时间线|时间锚点|事件.*正序/i, '时间线提取'],
    [/法务|合同|条款|违约金|管辖|知识产权/i, '法务条款审核'],
    [/学术|论文|摘要|背景、方法、结果、结论/i, '学术摘要'],
    [/讲义|出题|单项选择|参考答案|考点/i, '讲义出题'],
    [/公文|GB\/T 9704|发文字号|主送机关/i, '公文规范化'],
    [/医学|ICD-10|药品通用名|中医病证/i, '医学术语标准化'],
    [/财务|金额|币种|数字.*一致|大写金额/i, '财务数字一致性'],
    [/中英|术语对照|英文译法|双语/i, '中英术语对照'],
    [/代码块|curl|SQL|shell|技术文档/i, '代码块抽取'],
    [/表格描述统计|缺失率|平均|中位数|唯一值/i, '表格描述统计'],
    [/日记|笔记|事实 \/ 决策 \/ 待办 \/ 反思|个人写作/i, '日记笔记整理'],
    [/正式|规范|书面文档|公文与正式书面/i, '正式化改写'],
    [/润色|专业、流畅、自然/i, '润色优化'],
    [/翻译|目标语言|本地化/i, '翻译'],
    [/摘要|提炼结论|关键信息/i, '生成摘要']
  ]
  const matched = rules.find(([pattern]) => pattern.test(text))
  return matched ? matched[1] : '智能文档助手'
}

export function loadDefaultModelsByCategory() {
  try {
    const app = window.Application || window.opener?.Application || window.parent?.Application
    const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('defaultModelsByCategory')) ||
      app?.PluginStorage?.getItem('defaultModelsByCategory')
    if (!stored) {
      return {
        chat: null,
        image: null,
        video: null,
        voice: null
      }
    }
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored
    return {
      chat: parsed?.chat || null,
      image: parsed?.image || null,
      video: parsed?.video || null,
      voice: parsed?.voice || null
    }
  } catch (e) {
    console.warn('loadDefaultModelsByCategory:', e)
    return {
      chat: null,
      image: null,
      video: null,
      voice: null
    }
  }
}

export function getBuiltinAssistantSettingsDefaults() {
  const defaults = {}
  getBuiltinAssistants().forEach(item => {
    defaults[item.id] = getAssistantDefaultConfig(item)
  })
  return defaults
}

/*
 * 缓存按 globalSettings 的 version 失效。ribbon 动态菜单展开时这条函数会被反复调用,
 * 缓存后 deepClone+defaults merge 只在 settings 变更后做一次。
 */
let _assistantSettingsCache = null
let _assistantSettingsCacheVersion = -1

export function loadAssistantSettings() {
  const version = getGlobalSettingsVersion()
  if (_assistantSettingsCache && _assistantSettingsCacheVersion === version) {
    return _assistantSettingsCache
  }
  const settings = loadGlobalSettings()
  const stored = ensureObject(settings[ASSISTANT_SETTINGS_KEY])
  const defaults = getBuiltinAssistantSettingsDefaults()
  const merged = {}
  Object.keys(defaults).forEach(id => {
    const base = defaults[id]
    const raw = ensureObject(stored[id])
    merged[id] = {
      ...deepClone(base),
      ...raw,
      displayOrder: normalizeDisplayOrder(raw.displayOrder, base.displayOrder ?? null),
      displayLocations: normalizeDisplayLocations(raw.displayLocations, base.displayLocations),
      reportSettings: normalizeReportSettings(raw.reportSettings, base.reportSettings),
      mediaOptions: {
        ...base.mediaOptions,
        ...ensureObject(raw.mediaOptions)
      }
    }
  })
  _assistantSettingsCache = merged
  _assistantSettingsCacheVersion = version
  return _assistantSettingsCache
}

// 只保留与默认值不同的顶层字段。loadAssistantSettings 读取时会把存储值合并到默认值上,
// 所以未自定义的字段不需要落盘。
function diffFromDefault(full, base) {
  const diff = {}
  Object.keys(full).forEach(key => {
    if (JSON.stringify(full[key]) !== JSON.stringify(base[key])) {
      diff[key] = full[key]
    }
  })
  return diff
}

export function saveAssistantSettings(settingsMap) {
  const defaults = getBuiltinAssistantSettingsDefaults()
  // 旧实现:把全部 46 个内置助手的完整配置(~111KB)整块写进 settings,即使用户一个字段
  // 都没改。这是 settings 体系里最大的单次写入,localStorage 接近配额时会因此 QuotaExceeded,
  // 报“助手设置保存失败”。改为只持久化与默认值的差异 —— 典型用户(改 0~2 个助手)体积可降约 95%。
  // loadAssistantSettings 已按 defaults 合并存储值,读取侧无需改动。
  const stored = {}
  Object.keys(defaults).forEach(id => {
    const full = {
      ...deepClone(defaults[id]),
      ...ensureObject(settingsMap?.[id]),
      displayOrder: normalizeDisplayOrder(settingsMap?.[id]?.displayOrder, defaults[id].displayOrder ?? null),
      displayLocations: normalizeDisplayLocations(
        settingsMap?.[id]?.displayLocations,
        defaults[id].displayLocations
      ),
      reportSettings: normalizeReportSettings(
        settingsMap?.[id]?.reportSettings,
        defaults[id].reportSettings
      ),
      mediaOptions: {
        ...defaults[id].mediaOptions,
        ...ensureObject(settingsMap?.[id]?.mediaOptions)
      }
    }
    const diff = diffFromDefault(full, defaults[id])
    if (Object.keys(diff).length > 0) {
      stored[id] = diff
    }
  })
  return saveGlobalSettings({ [ASSISTANT_SETTINGS_KEY]: stored })
}

export function getAssistantSetting(id) {
  const definition = getBuiltinAssistantDefinition(id)
  if (!definition) return null
  const settings = loadAssistantSettings()
  return settings[id] ? deepClone(settings[id]) : getAssistantDefaultConfig(definition)
}

export function updateAssistantSetting(id, partial) {
  const current = loadAssistantSettings()
  const base = current[id] || getAssistantDefaultConfig(id)
  // 不原地修改 current — loadAssistantSettings 现在返回缓存引用,mutate 会污染缓存
  const next = {
    ...current,
    [id]: {
      ...base,
      ...ensureObject(partial),
      reportSettings: normalizeReportSettings(partial?.reportSettings, base?.reportSettings),
      mediaOptions: {
        ...ensureObject(base?.mediaOptions),
        ...ensureObject(partial?.mediaOptions)
      }
    }
  }
  return saveAssistantSettings(next)
}

export function getCustomAssistants() {
  const settings = loadGlobalSettings()
  const list = settings[CUSTOM_ASSISTANTS_KEY]
  if (!Array.isArray(list)) return []
  return list
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      id: item.id || `custom_${Date.now()}`,
      name: inferAssistantNameFromPrompt(item),
      description: item.description || '',
      icon: normalizeAssistantIcon(item.icon),
      ribbonIcon: normalizeRibbonIconValue(item.ribbonIcon),
      modelType: item.modelType || 'chat',
      modelId: item.modelId || null,
      persona: item.persona || '',
      systemPrompt: item.systemPrompt || '',
      userPromptTemplate: item.userPromptTemplate || '{{input}}',
      temperature: Number.isFinite(Number(item.temperature)) ? Number(item.temperature) : 0.3,
      outputFormat: item.outputFormat || 'markdown',
      documentAction: item.documentAction || 'insert',
      inputSource: item.inputSource || 'selection-preferred',
      group: String(item.group || item.category || 'custom').trim() || 'custom',
      visibleInRibbon: item.visibleInRibbon !== false,
      displayOrder: normalizeDisplayOrder(item.displayOrder, null),
      displayLocations: normalizeDisplayLocations(
        item.displayLocations,
        item.visibleInRibbon === false ? [] : ['ribbon-more']
      ),
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0,
      createdAt: String(item.createdAt || ''),
      updatedAt: String(item.updatedAt || item.createdAt || ''),
      targetLanguage: item.targetLanguage || '中文',
      recommendationRequirement: item.recommendationRequirement || '',
      version: item.version || '1.0.0',
      parentAssistantIds: Array.isArray(item.parentAssistantIds) ? item.parentAssistantIds.filter(Boolean) : [],
      repairReason: item.repairReason || '',
      benchmarkScore: Number.isFinite(Number(item.benchmarkScore)) ? Number(item.benchmarkScore) : null,
      isPromoted: item.isPromoted !== false,
      reportSettings: normalizeReportSettings(item.reportSettings, createDefaultReportSettings()),
      mediaOptions: {
        aspectRatio: item.mediaOptions?.aspectRatio || '16:9',
        duration: item.mediaOptions?.duration || '30s',
        voiceStyle: item.mediaOptions?.voiceStyle || '专业自然'
      }
    }))
    .sort((a, b) => {
      const diff = Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
      if (diff !== 0) return diff
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
}

export function saveCustomAssistants(list) {
  const now = new Date().toISOString()
  const normalized = (list || []).map((item, index) => ({
    id: item.id || `custom_${Date.now()}_${index}`,
    name: inferAssistantNameFromPrompt(item),
    description: item.description || '',
    icon: normalizeAssistantIcon(item.icon),
    ribbonIcon: normalizeRibbonIconValue(item.ribbonIcon),
    modelType: item.modelType || 'chat',
    modelId: item.modelId || null,
    persona: item.persona || '',
    systemPrompt: item.systemPrompt || '',
    userPromptTemplate: item.userPromptTemplate || '{{input}}',
    temperature: Number.isFinite(Number(item.temperature)) ? Number(item.temperature) : 0.3,
    outputFormat: item.outputFormat || 'markdown',
    documentAction: item.documentAction || 'insert',
    inputSource: item.inputSource || 'selection-preferred',
    group: String(item.group || item.category || 'custom').trim() || 'custom',
    displayOrder: normalizeDisplayOrder(item.displayOrder, null),
    displayLocations: normalizeDisplayLocations(
      item.displayLocations,
      item.visibleInRibbon === false ? [] : ['ribbon-more']
    ),
    visibleInRibbon: normalizeDisplayLocations(
      item.displayLocations,
      item.visibleInRibbon === false ? [] : ['ribbon-more']
    ).some(location => location === 'ribbon-main' || location === 'ribbon-more'),
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
    createdAt: String(item.createdAt || now),
    updatedAt: String(item.updatedAt || now),
    targetLanguage: item.targetLanguage || '中文',
    recommendationRequirement: item.recommendationRequirement || '',
    version: item.version || '1.0.0',
    parentAssistantIds: Array.isArray(item.parentAssistantIds) ? item.parentAssistantIds.filter(Boolean) : [],
    repairReason: item.repairReason || '',
    benchmarkScore: Number.isFinite(Number(item.benchmarkScore)) ? Number(item.benchmarkScore) : null,
    isPromoted: item.isPromoted !== false,
    reportSettings: normalizeReportSettings(item.reportSettings, createDefaultReportSettings()),
    mediaOptions: {
      aspectRatio: item.mediaOptions?.aspectRatio || '16:9',
      duration: item.mediaOptions?.duration || '30s',
      voiceStyle: item.mediaOptions?.voiceStyle || '专业自然'
    }
  }))
  return saveGlobalSettings({ [CUSTOM_ASSISTANTS_KEY]: normalized })
}

export function getCustomAssistantGroups(customAssistants = null) {
  const settings = loadGlobalSettings()
  const storedGroups = normalizeAssistantGroupList(settings[CUSTOM_ASSISTANT_GROUPS_KEY])
  const sourceAssistants = Array.isArray(customAssistants) ? customAssistants : getCustomAssistants()
  const assistantGroups = normalizeAssistantGroupList(
    sourceAssistants
      .map(item => item?.group || item?.category)
      .filter(Boolean)
  )
  return normalizeAssistantGroupList([...storedGroups, ...assistantGroups, 'custom'])
}

export function saveCustomAssistantGroups(groups = []) {
  return saveGlobalSettings({
    [CUSTOM_ASSISTANT_GROUPS_KEY]: normalizeAssistantGroupList(groups)
  })
}

export async function ensureCustomAssistantRibbonIcons() {
  const current = getCustomAssistants()
  let changed = false
  const next = await Promise.all(current.map(async (item) => {
    const resolvedRibbonIcon = await buildAssistantRibbonIconValue(item.ribbonIcon || item.icon)
    const normalizedRibbonIcon = normalizeRibbonIconValue(resolvedRibbonIcon)
    if (normalizedRibbonIcon === normalizeRibbonIconValue(item.ribbonIcon)) {
      return item
    }
    changed = true
    return {
      ...item,
      ribbonIcon: normalizedRibbonIcon
    }
  }))
  if (!changed) return false
  saveCustomAssistants(next)
  return true
}

export function getCustomAssistantById(id) {
  return getCustomAssistants().find(item => item.id === id) || null
}

export function createCustomAssistantDraft() {
  return {
    id: '',
    name: '',
    description: '',
    icon: DEFAULT_ASSISTANT_ICON,
    modelType: 'chat',
    modelId: null,
    persona: '',
    systemPrompt: '你是一位专业智能助手，请根据用户输入完成任务。',
    userPromptTemplate: '{{input}}',
    temperature: 0.3,
    outputFormat: 'markdown',
    documentAction: 'insert',
    inputSource: 'selection-preferred',
    group: 'custom',
    visibleInRibbon: true,
    displayOrder: null,
    displayLocations: ['ribbon-more'],
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    targetLanguage: '中文',
    recommendationRequirement: '',
    version: '1.0.0',
    parentAssistantIds: [],
    repairReason: '',
    benchmarkScore: null,
    isPromoted: true,
    reportSettings: createDefaultReportSettings(),
    mediaOptions: {
      aspectRatio: '16:9',
      duration: '30s',
      voiceStyle: '专业自然'
    }
  }
}

export function buildCustomAssistantId(name) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `custom_${slug || Date.now()}_${Date.now()}`
}

export function getConfiguredAssistantModelId(assistantId) {
  const builtin = getAssistantSetting(assistantId)
  if (builtin?.modelId) return builtin.modelId
  const definition = getBuiltinAssistantDefinition(assistantId)
  return getDefaultModelIdForCategory(definition?.defaultModelCategory)
}

/** 获取某分类的默认模型 ID，供助手继承使用 */
export function getDefaultModelIdForCategory(category) {
  if (!category) return null
  const defaults = loadDefaultModelsByCategory()
  if (category === 'chat') {
    return defaults.chat || null
  }
  return defaults[category] || null
}

export function getRibbonVisibleCustomAssistants() {
  return getCustomAssistants().filter(item => item.displayLocations.includes('ribbon-more'))
}

function buildDisplayEntry(definition, config, source) {
  if (!definition || !config) return null
  return {
    id: definition.id,
    title: config.title || config.name || definition.shortLabel || definition.label || '智能助手',
    shortLabel: definition.shortLabel || definition.label || config.title || config.name || '智能助手',
    icon: getAssistantResolvedIcon(definition.id, config.icon || definition.icon),
    source,
    displayOrder: normalizeDisplayOrder(config.displayOrder, null),
    sortOrder: normalizeDisplayOrder(config.sortOrder, 0),
    definition: deepClone(definition),
    config: deepClone(config),
    displayLocations: normalizeDisplayLocations(config.displayLocations, definition.defaultDisplayLocations || [])
  }
}

// 按 (assistantId, settings version) 缓存。ribbon GetImage/GetLabel 每个 item 都会触发
// 同一个 assistantId 的查询,缓存后避免每个 item 都重做 buildDisplayEntry + deepClone。
const _displayEntryCache = new Map()  // key: `${version}::${assistantId}` → entry|null
let _displayEntryCacheVersion = -1

function _ensureDisplayEntryCacheVersion() {
  const v = getGlobalSettingsVersion()
  if (v !== _displayEntryCacheVersion) {
    _displayEntryCache.clear()
    _displayEntryCacheVersion = v
  }
  return v
}

export function getAssistantDisplayEntry(assistantId) {
  if (!assistantId) return null
  _ensureDisplayEntryCacheVersion()
  if (_displayEntryCache.has(assistantId)) return _displayEntryCache.get(assistantId)

  let entry = null
  const builtinDefinition = getBuiltinAssistantDefinition(assistantId)
  if (builtinDefinition) {
    const config = getAssistantSetting(assistantId)
    if (config && config.enabled !== false) {
      entry = buildDisplayEntry(builtinDefinition, config, 'builtin')
    }
  } else {
    const custom = getCustomAssistantById(assistantId)
    if (custom) {
      entry = buildDisplayEntry({
        id: custom.id,
        label: inferAssistantNameFromPrompt(custom),
        shortLabel: inferAssistantNameFromPrompt(custom),
        icon: normalizeAssistantIcon(custom.icon),
        defaultDisplayLocations: ['ribbon-more']
      }, custom, 'custom')
    }
  }
  _displayEntryCache.set(assistantId, entry)
  return entry
}

export function isAssistantDisplayedInLocation(assistantId, location) {
  const entry = getAssistantDisplayEntry(assistantId)
  if (!entry) return false
  return entry.displayLocations.includes(location)
}

// 按 (location, settings version) 缓存。ribbon 动态菜单展开一次会对同一 location 重复
// 查询 3+ 次(getRibbonOverflowAssistants / getRibbonExclusiveMoreAssistants / getRibbonMoreAssistants
// 都走这条路径),缓存后只在 settings 改变后重新排序。
const _displayLocationCache = new Map()  // key: location → list
let _displayLocationCacheVersion = -1

export function getAssistantsForDisplayLocation(location) {
  const v = getGlobalSettingsVersion()
  if (v !== _displayLocationCacheVersion) {
    _displayLocationCache.clear()
    _displayLocationCacheVersion = v
  }
  if (_displayLocationCache.has(location)) return _displayLocationCache.get(location)

  const builtinItems = getBuiltinAssistants()
    .map((item, index) => {
      const entry = getAssistantDisplayEntry(item.id)
      return entry ? { ...entry, _sourceIndex: index } : null
    })
    .filter(Boolean)
    .filter(item => item.displayLocations.includes(location))

  const customItems = getCustomAssistants()
    .map((item, index) => {
      const entry = getAssistantDisplayEntry(item.id)
      return entry ? { ...entry, _sourceIndex: index } : null
    })
    .filter(Boolean)
    .filter(item => item.displayLocations.includes(location))

  const result = [...builtinItems, ...customItems].sort((a, b) => {
    const aPriority = a.displayOrder == null ? Number.POSITIVE_INFINITY : Number(a.displayOrder)
    const bPriority = b.displayOrder == null ? Number.POSITIVE_INFINITY : Number(b.displayOrder)
    if (aPriority !== bPriority) return aPriority - bPriority
    const aSource = a.source === 'builtin' ? 0 : 1
    const bSource = b.source === 'builtin' ? 0 : 1
    if (aSource !== bSource) return aSource - bSource
    const aSort = Number.isFinite(a.sortOrder) ? a.sortOrder : a._sourceIndex
    const bSort = Number.isFinite(b.sortOrder) ? b.sortOrder : b._sourceIndex
    if (aSort !== bSort) return aSort - bSort
    return Number(a._sourceIndex || 0) - Number(b._sourceIndex || 0)
  })
  _displayLocationCache.set(location, result)
  return result
}
