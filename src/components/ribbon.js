import Util from './js/util.js'
import SystemDemo from './js/systemdemo.js'
import * as XLSX from 'xlsx'
import { getOpenAIModelIndex } from './ribbon/modelHelpers.js'
import { loadRulesFromDoc, saveRulesToDoc } from '../utils/templateRules.js'
import { setNewFileMarker, isNewFile } from '../utils/documentTemplates.js'
import { getModelLogoPath } from '../utils/modelLogos.js'
import { isRibbonModelEnabled } from '../utils/modelSettings.js'
import {
  getAssistantsForDisplayLocation,
  getAssistantDisplayEntry,
  isAssistantDisplayedInLocation
} from '../utils/assistantSettings.js'
import { getRibbonCompatibleAssistantIcon } from '../utils/assistantIcons.js'
import {
  CONTEXT_MENU_DYNAMIC_SLOT_COUNT,
  FIXED_MAIN_ASSISTANT_IDS,
  GROUP_CONTROL_ASSISTANT_MAP,
  getAssistantResolvedIcon,
  MAIN_CONTROL_ASSISTANT_MAP,
  RIBBON_DYNAMIC_SLOT_COUNT
} from '../utils/assistantRegistry.js'
import {
  startAssistantTask,
  getAssistantLaunchInfo,
  getTranslateLanguageByControlId
} from '../utils/assistantTaskRunner.js'
import { getDocumentText, getSelectedText } from '../utils/documentActions.js'
import { getSelectionContextSnapshot } from '../utils/documentContext.js'
import {
  invalidateDeclassifyRibbonControls,
  isDocumentDeclassified
} from '../utils/documentDeclassifyStore.js'
import { reopenExistingAIAssistantWindow } from '../utils/aiAssistantWindowManager.js'
import { MODEL_GROUPS, getDefaultModelsFlat } from '../utils/defaultModelGroups.js'
import { focusExistingSettingsWindow, openSettingsWindow } from '../utils/settingsWindowManager.js'
import { focusExistingTaskListWindow } from '../utils/taskListWindowManager.js'
import { focusExistingTaskOrchestrationWindow } from '../utils/taskOrchestrationWindowManager.js'
import { showSafeErrorDetail } from '../utils/safeErrorDialog.js'
import { reportError } from '../utils/reportError.js'

/**
 * Ribbon getImage 返回值（见 WPS 自定义功能区示例）：直接返回相对路径如 images/1.svg，
 * 由宿主按加载项根目录解析，无额外网络与 Canvas 开销。
 * 已为 http(s)/data:/file: 的绝对地址时原样返回（自定义助手图标等）。
 */
function resolveRibbonIconUrl(raw) {
	const s = String(raw ?? '').trim()
	if (!s) return s
	if (/^(https?:\/\/|data:|file:)/i.test(s)) return s
	return s.replace(/^\/+/, '')
}

//这个函数在整个wps加载项中是第一个执行的
function OnAddinLoad(ribbonUI) {
  if (typeof window.Application.ribbonUI != 'object') {
    window.Application.ribbonUI = ribbonUI
  }

  if (typeof window.Application.Enum != 'object') {
    // 如果没有内置枚举值
    window.Application.Enum = Util.WPS_Enum
  }

  //这几个导出函数是给外部业务系统调用的
  window.openOfficeFileFromSystemDemo = SystemDemo.openOfficeFileFromSystemDemo
  window.InvokeFromSystemDemo = SystemDemo.InvokeFromSystemDemo

  window.Application.PluginStorage.setItem('EnableFlag', false) //往PluginStorage中设置一个标记，用于控制两个按钮的置灰
  window.Application.PluginStorage.setItem('ApiEventFlag', false) //往PluginStorage中设置一个标记，用于控制ApiEvent的按钮label

  // 文档打开或切换时刷新表单模式按钮状态（从文档变量/保护类型读取）
  try {
    if (window.Application.ApiEvent) {
      window.Application.ApiEvent.AddApiEventListener('DocumentOpen', 'ribbon.OnDocumentOpenForFormMode')
      window.Application.ApiEvent.AddApiEventListener('WindowActivate', 'ribbon.OnWindowActivateForFormMode')
      window.Application.ApiEvent.AddApiEventListener('DocumentBeforeSave', 'ribbon.OnDocumentBeforeSave')
    }
  } catch (e) {
    console.warn('注册文档事件失败:', e)
  }

  // 先设置默认模型列表，确保有数据显示
  setDefaultModels()
  // 从存储恢复选中的模型索引；无有效选中时默认选中 OpenAI
  const storedIndex = window.Application.PluginStorage.getItem('selectedModelIndex')
  if (storedIndex !== undefined && storedIndex !== null) {
    const idx = parseInt(storedIndex, 10)
    if (!isNaN(idx)) selectedModelIndex = idx
  } else {
    selectedModelIndex = getOpenAIModelIndex(getModelList())
  }
  // 然后尝试从接口加载（异步）
  loadModelList()

  return true
}

function openAIAssistantDialog(query = {}) {
  const queryString = new URLSearchParams(query).toString()
  const aiUrl = Util.GetUrlPath() + Util.GetRouterHash() + `/ai-assistant${queryString ? `?${queryString}` : ''}`
  window.Application.ShowDialog(
    aiUrl,
    '察元 AI 助手',
    900 * (window.devicePixelRatio || 1),
    700 * (window.devicePixelRatio || 1),
    false
  )
}

function showAIAssistantDialog(query = {}) {
  if (reopenExistingAIAssistantWindow(query)) {
    openAIAssistantDialog({
      ...query,
      reopen: '1'
    })
    return
  }
  openAIAssistantDialog(query)
}


// 模型列表数据(state 仍留在 ribbon.js 中)
// 纯函数 OPENAI_MODEL_IDS / getOpenAIModelIndex 已抽到顶部 import 的 ribbon/modelHelpers.js
let modelList = []
let selectedModelIndex = 0

// 从接口加载模型列表
async function loadModelList() {
  try {
    // TODO: 替换为实际的API接口地址
    // 暂时注释掉接口调用，直接使用默认模型列表进行测试
    // const apiUrl = 'https://your-api-endpoint.com/api/models' // 请替换为实际的接口地址
    const apiUrl = null // 暂时禁用接口调用，使用默认数据
    
    if (!apiUrl) {
      // 如果接口地址未配置，直接使用默认模型列表
      console.log('使用默认模型列表')
      return
    }
    
    // 如果接口需要认证，可以在这里添加headers
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 'Authorization': 'Bearer your-token' // 如果需要认证
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      // 假设接口返回格式为: { models: [{ id: '1', name: 'GPT-4', icon: '...' }, ...] }
      // 或者直接返回数组: [{ id: '1', name: 'GPT-4', icon: '...' }, ...]
      modelList = Array.isArray(data) ? data : (data.models || data.data || [])
      
      // 保存到本地存储
      window.Application.PluginStorage.setItem('modelList', JSON.stringify(modelList))
      
      // 刷新模型选择菜单
      if (window.Application.ribbonUI) {
        window.Application.ribbonUI.InvalidateControl('menuModelSelect')
      }
    } else {
      console.error('获取模型列表失败:', response.statusText)
      // 使用默认模型列表
      setDefaultModels()
    }
  } catch (error) {
    console.error('加载模型列表出错:', error)
    // 使用默认模型列表
    setDefaultModels()
  }
}

// 设置默认模型列表（使用全球主流模型列表）
function setDefaultModels() {
  modelList = getDefaultModelsFlat()
  window.Application.PluginStorage.setItem('modelList', JSON.stringify(modelList))
  // 刷新模型选择菜单
  if (window.Application.ribbonUI) {
    window.Application.ribbonUI.InvalidateControl('menuModelSelect')
  }
}

// 获取模型列表（从本地存储或默认值）
function getModelList() {
  if (modelList.length > 0) {
    return modelList
  }
  
  const stored = window.Application.PluginStorage.getItem('modelList')
  if (stored) {
    try {
      modelList = JSON.parse(stored)
      return modelList
    } catch (e) {
      console.error('解析模型列表失败:', e)
    }
  }
  
  setDefaultModels()
  return modelList
}

// 获取在模型设置中已开启的模型列表（仅显示在察元AI助理下拉中可选的模型）
function getFilteredModelList() {
  const full = getModelList()
  return full.filter(m => m && m.id && isRibbonModelEnabled(m.id))
}

// 获取当前选中的模型索引（在过滤后的列表中）
function getSelectedModelIndex() {
  const list = getFilteredModelList()
  const storedModel = window.Application?.PluginStorage?.getItem('selectedModel')
  if (storedModel) {
    try {
      const obj = JSON.parse(storedModel)
      const idx = list.findIndex(m => m && m.id === obj?.id)
      if (idx >= 0) return idx
    } catch (e) {}
  }
  const storedIdx = window.Application?.PluginStorage?.getItem('selectedModelIndex')
  if (storedIdx !== undefined && storedIdx !== null) {
    const idx = parseInt(storedIdx, 10)
    if (!isNaN(idx) && idx >= 0 && idx < list.length) return idx
  }
  return getOpenAIModelIndex(list)
}

// 获取当前选中的模型对象（无有效选中时默认第一个已开启的）
function getSelectedModel() {
  const list = getFilteredModelList()
  if (list.length === 0) return null
  const idx = getSelectedModelIndex()
  if (idx >= 0 && idx < list.length) return list[idx]
  const openaiIdx = getOpenAIModelIndex(list)
  return list[openaiIdx] || list[0] || null
}


// 模型选择回显：标签显示当前选中模型名称
function GetModelMenuLabel(control) {
  const id = control?.Id ?? control?.id ?? ''
  if (id !== 'menuModelSelect') return '模型选择'
  const model = getSelectedModel()
  return model ? (model.name || model.label || '模型选择') : '模型选择'
}


// 获取模型菜单动态内容（分组二级菜单，仅显示模型设置中已开启的模型）
function GetModelMenuContent(control) {
  const ns = 'http://schemas.microsoft.com/office/2006/01/customui'
  let flatIndex = 0

  let groupMenus = []
  for (let gi = 0; gi < MODEL_GROUPS.length; gi++) {
    const group = MODEL_GROUPS[gi]
    const enabledModels = group.models.filter(m => m && m.id && isRibbonModelEnabled(m.id))
    if (enabledModels.length === 0) continue
    let buttons = []
    for (const model of enabledModels) {
      const label = escapeXml(model.name || model.label)
      buttons.push(`<button id="model_${flatIndex}" label="${label}" getImage="ribbon.GetModelItemImage" onAction="ribbon.OnModelSelectAction" />`)
      flatIndex++
    }
    const subMenu = `<menu id="grp_${gi}" label="${escapeXml(group.label)}" getImage="ribbon.GetImage">${buttons.join('')}</menu>`
    groupMenus.push(subMenu)
  }

  return `<menu xmlns="${ns}">${groupMenus.join('')}</menu>`
}

// 模型菜单项点击（button onAction）
function OnModelSelectAction(control) {
  const id = control?.Id ?? control?.id ?? ''
  const match = id.match(/^model_(\d+)$/)
  if (!match) return true
  const selectedIndex = parseInt(match[1], 10)
  OnModelSelect(control, null, selectedIndex)
  if (window.Application?.ribbonUI) {
    window.Application.ribbonUI.InvalidateControl('menuModelSelect')
  }
  return true
}

function escapeXml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// 翻译菜单：世界主要语言，选项用对应语言标注
const TRANSLATION_LANGUAGES = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'th', label: 'ไทย' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'pl', label: 'Polski' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'sv', label: 'Svenska' },
  { code: 'da', label: 'Dansk' },
  { code: 'no', label: 'Norsk' },
  { code: 'fi', label: 'Suomi' },
  { code: 'cs', label: 'Čeština' },
  { code: 'hu', label: 'Magyar' },
  { code: 'el', label: 'Ελληνικά' },
  { code: 'he', label: 'עברית' },
  { code: 'uk', label: 'Українська' },
  { code: 'ro', label: 'Română' },
  { code: 'bg', label: 'Български' },
  { code: 'hr', label: 'Hrvatski' },
  { code: 'sk', label: 'Slovenčina' },
  { code: 'sl', label: 'Slovenščina' },
  { code: 'lt', label: 'Lietuvių' },
  { code: 'lv', label: 'Latviešu' },
  { code: 'et', label: 'Eesti' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'tl', label: 'Filipino' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'mr', label: 'मराठी' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'fa', label: 'فارسی' },
  { code: 'ur', label: 'اردو' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'ca', label: 'Català' },
  { code: 'eu', label: 'Euskara' },
  { code: 'gl', label: 'Galego' }
]

const CONTEXT_TEXT_ANALYSIS_PRIMARY = [
  'analysis.rewrite',
  'analysis.polish',
  'analysis.formalize',
  'analysis.simplify',
  'analysis.expand',
  'analysis.abbreviate',
  'analysis.extract-keywords',
  'analysis.action-items'
]

const CONTEXT_TEXT_ANALYSIS_SECONDARY = [
  'analysis.correct-spell',
  'analysis.title',
  'analysis.risks',
  'analysis.term-unify',
  'analysis.structure',
  'analysis.minutes',
  'analysis.policy-style',
  'analysis.paragraph-numbering-check',
  'analysis.ai-trace-check',
  'analysis.comment-explain',
  'analysis.hyperlink-explain'
]

const CONTEXT_TRANSLATION_PRIMARY_LANGS = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru']
const RIBBON_MORE_ASSISTANT_CONTROL_PREFIX = 'btnRibbonMoreAssistant_'
const CONTEXT_MORE_ASSISTANT_CONTROL_PREFIX = 'btnContextMoreAssistant_'
const CONTEXT_TEXT_ANALYSIS_ASSISTANT_CONTROL_PREFIX = 'btnContextTextAnalysisAssistant_'
const CONTEXT_TEXT_ANALYSIS_MORE_ASSISTANT_CONTROL_PREFIX = 'btnContextTextAnalysisMoreAssistant_'

function normalizeContextControlId(controlId) {
  return String(controlId || '').replace(/TableCell$/, '')
}

function buildDynamicAssistantButtonId(prefix, index) {
  return `${prefix}${Math.max(0, Number(index) || 0)}`
}

function getDynamicAssistantByIndex(controlId, prefix, entries) {
  const match = String(controlId || '').match(new RegExp(`^${prefix}(\\d+)$`))
  if (!match) return null
  const index = Math.max(parseInt(match[1], 10), 0)
  return entries[index] || null
}

function dedupeAssistants(entries) {
  const seen = new Set()
  return (entries || []).filter(item => {
    if (!item?.id) return false
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function getRibbonNativeAssistantIds() {
  return new Set(Object.values(MAIN_CONTROL_ASSISTANT_MAP).flat())
}

function getRibbonMainSlotAssistants() {
  const nativeIds = getRibbonNativeAssistantIds()
  return getAssistantsForDisplayLocation('ribbon-main').filter(item => !nativeIds.has(item.id))
}

function getRibbonOverflowAssistants() {
  return getRibbonMainSlotAssistants().slice(RIBBON_DYNAMIC_SLOT_COUNT)
}

function getRibbonExclusiveMoreAssistants() {
  const overflowIds = new Set(getRibbonOverflowAssistants().map(item => item.id))
  return getAssistantsForDisplayLocation('ribbon-more').filter(item => !overflowIds.has(item.id))
}

function getRibbonMoreAssistants() {
  return dedupeAssistants([
    ...getRibbonOverflowAssistants(),
    ...getAssistantsForDisplayLocation('ribbon-more')
  ])
}

function getContextDirectAssistants() {
  return getAssistantsForDisplayLocation('context-menu').slice(0, CONTEXT_MENU_DYNAMIC_SLOT_COUNT)
}

function getContextOverflowAssistants() {
  return getAssistantsForDisplayLocation('context-menu').slice(CONTEXT_MENU_DYNAMIC_SLOT_COUNT)
}

function getContextExclusiveMoreAssistants() {
  const overflowIds = new Set(getContextOverflowAssistants().map(item => item.id))
  return getAssistantsForDisplayLocation('context-more').filter(item => !overflowIds.has(item.id))
}

function getContextMoreAssistants() {
  return dedupeAssistants([
    ...getContextOverflowAssistants(),
    ...getAssistantsForDisplayLocation('context-more')
  ])
}

function getSlotIndex(controlId, prefix) {
  const match = String(controlId || '').match(new RegExp(`^${prefix}(\\d+)$`))
  return match ? Math.max(parseInt(match[1], 10) - 1, -1) : -1
}

function getAssistantForControl(controlId) {
  const directId = normalizeContextControlId(controlId)
  if (directId.startsWith('btnDisplayAssistant_')) {
    return getAssistantDisplayEntry(directId.replace('btnDisplayAssistant_', ''))
  }
  const ribbonMoreAssistant = getDynamicAssistantByIndex(directId, RIBBON_MORE_ASSISTANT_CONTROL_PREFIX, getRibbonMoreAssistants())
  if (ribbonMoreAssistant) return ribbonMoreAssistant
  const contextMoreAssistant = getDynamicAssistantByIndex(directId, CONTEXT_MORE_ASSISTANT_CONTROL_PREFIX, getContextMoreAssistants())
  if (contextMoreAssistant) return contextMoreAssistant
  const contextTextAnalysisAssistant = getDynamicAssistantByIndex(
    directId,
    CONTEXT_TEXT_ANALYSIS_ASSISTANT_CONTROL_PREFIX,
    CONTEXT_TEXT_ANALYSIS_PRIMARY.map((assistantId) => getAssistantDisplayEntry(assistantId)).filter(Boolean)
  )
  if (contextTextAnalysisAssistant) return contextTextAnalysisAssistant
  const contextTextAnalysisMoreAssistant = getDynamicAssistantByIndex(
    directId,
    CONTEXT_TEXT_ANALYSIS_MORE_ASSISTANT_CONTROL_PREFIX,
    CONTEXT_TEXT_ANALYSIS_SECONDARY.map((assistantId) => getAssistantDisplayEntry(assistantId)).filter(Boolean)
  )
  if (contextTextAnalysisMoreAssistant) return contextTextAnalysisMoreAssistant
  const ribbonSlotIndex = getSlotIndex(directId, 'btnAssistantPrimarySlot')
  if (ribbonSlotIndex >= 0) {
    return getRibbonMainSlotAssistants()[ribbonSlotIndex] || null
  }
  const contextSlotIndex = getSlotIndex(directId, 'btnContextAssistantSlot')
  if (contextSlotIndex >= 0) {
    return getContextDirectAssistants()[contextSlotIndex] || null
  }
  const assistantIds = MAIN_CONTROL_ASSISTANT_MAP[directId]
  if (assistantIds?.length === 1) {
    return getAssistantDisplayEntry(assistantIds[0])
  }
  return null
}

function getAssistantIconPath(assistantId, entryOverride) {
  const entry = entryOverride ?? (assistantId ? getAssistantDisplayEntry(assistantId) : null)
  const ribbonIcon = entry?.config?.ribbonIcon ?? entry?.ribbonIcon ?? ''
  const iconSource = ribbonIcon || getAssistantResolvedIcon(assistantId, entry?.icon)
  return getRibbonCompatibleAssistantIcon(iconSource, entry?.id || assistantId || 'assistant')
}

function resolveContextSelectionPayload() {
  try {
    const snapshot = getSelectionContextSnapshot({ documentExcerptLimit: 900 })
    return {
      ...snapshot,
      kind: snapshot.kind || 'unknown',
      text: String(snapshot?.text || '').trim()
    }
  } catch (e) {
    return { text: '', kind: 'unknown' }
  }
}

function hasContextSelectionPayload() {
  const payload = resolveContextSelectionPayload()
  return payload.kind !== 'image' && !!payload.text
}

function getAssistantMenuLabel(assistantId, fallbackLabel) {
  return getAssistantDisplayEntry(assistantId)?.title || fallbackLabel || '智能助手'
}

function hasSelectionText() {
  try {
    return String(getSelectedText() || '').trim().length >= 2
  } catch (e) {
    return false
  }
}

function buildLongDocumentHint(textLength) {
  const length = Number(textLength || 0)
  if (length < 12000) return ''
  if (length < 30000) {
    return '\n\n当前内容较长，处理可能需要更久，请耐心等待。'
  }
  return '\n\n当前内容很长，处理时间可能较久，并可能触发分段或较长响应，请确认后继续。'
}

function confirmFullDocumentSubmit(taskTitle, textLength) {
  const title = String(taskTitle || '当前任务').trim()
  const message = `当前未选中文档内容，将对全文执行“${title}”。\n\n点击“确定”后开始处理全文。${buildLongDocumentHint(textLength)}`
  return confirm(message)
}

function openSpellCheckDialog(preferredMode = 'auto') {
  const mode = preferredMode === 'auto'
    ? (hasSelectionText() ? 'selection' : 'all')
    : preferredMode
  window.Application.ShowDialog(
    Util.GetUrlPath() + Util.GetRouterHash() + `/spell-check-dialog?mode=${mode}`,
    '拼写与语法检查',
    520 * (window.devicePixelRatio || 1),
    260 * (window.devicePixelRatio || 1),
    false
  )
}

function launchSpellCheckFromRibbon() {
  const hasSelection = hasSelectionText()
  if (!hasSelection) {
    const documentText = String(getDocumentText() || '').trim()
    if (!documentText) {
      alert('当前文档没有可检查的正文内容')
      return
    }
    const confirmed = confirmFullDocumentSubmit(
      getAssistantDisplayEntry('spell-check')?.title || '拼写与语法检查',
      documentText.length
    )
    if (!confirmed) return
  }
  openSpellCheckDialog(hasSelection ? 'selection' : 'all')
}

function executeConfiguredAssistant(assistantId, fallbackTitle) {
  if (assistantId === 'spell-check') {
    launchSpellCheckFromRibbon()
    return
  }
  const entry = getAssistantDisplayEntry(assistantId)
  const taskTitle = entry?.title || fallbackTitle
  executeAssistantFromRibbon(assistantId, { taskTitle }).catch((e) => {
    reportError(`${taskTitle || '助手'}执行失败`, e, {
      context: { assistantId, fallbackTitle, source: 'ribbon-direct' }
    })
  })
}

function GetTranslationMenuContent(control) {
  const ns = 'http://schemas.microsoft.com/office/2006/01/customui'
  const buttons = TRANSLATION_LANGUAGES.map(
    (lang) => `<button id="btnTranslate_${lang.code}" label="${escapeXml(lang.label)}" onAction="ribbon.OnAction" getImage="ribbon.GetImage" />`
  )
  return `<menu xmlns="${ns}">${buttons.join('')}</menu>`
}

function GetMoreAssistantsMenuContent(control) {
  const ns = 'http://schemas.microsoft.com/office/2006/01/customui'
  const overflowAssistants = getRibbonOverflowAssistants()
  const moreAssistants = getRibbonExclusiveMoreAssistants()
  const assistants = getRibbonMoreAssistants()
  const buttons = assistants.map(
    (assistant, index) => `<button id="${buildDynamicAssistantButtonId(RIBBON_MORE_ASSISTANT_CONTROL_PREFIX, index)}" label="${escapeXml(assistant.title || '未命名助手')}" onAction="ribbon.OnAction" getImage="ribbon.GetImage" />`
  )
  if (overflowAssistants.length && moreAssistants.length) {
    buttons.splice(overflowAssistants.length, 0, '<menuSeparator id="sepRibbonMoreAssistantGroups" />')
  }
  buttons.push('<menuSeparator id="sepCustomAssistants" />')
  buttons.push('<button id="btnCustomAssistantCreate" label="创建智能助手" onAction="ribbon.OnAction" getImage="ribbon.GetImage" />')
  buttons.push('<button id="btnCustomAssistantManage" label="管理智能助手" onAction="ribbon.OnAction" getImage="ribbon.GetImage" />')
  if (!assistants.length) {
    buttons.unshift('<button id="btnCustomAssistantEmpty" label="暂无可显示的助手" enabled="false" getImage="ribbon.GetImage" />')
  }
  return `<menu xmlns="${ns}">${buttons.join('')}</menu>`
}

function GetContextAssistantMoreMenuContent(control) {
  const ns = 'http://schemas.microsoft.com/office/2006/01/customui'
  const overflowAssistants = getContextOverflowAssistants()
  const moreAssistants = getContextExclusiveMoreAssistants()
  const assistants = getContextMoreAssistants()
  const buttons = assistants.map(
    (assistant, index) => `<button id="${buildDynamicAssistantButtonId(CONTEXT_MORE_ASSISTANT_CONTROL_PREFIX, index)}" label="${escapeXml(assistant.title || '未命名助手')}" onAction="ribbon.OnAction" getImage="ribbon.GetImage" />`
  )
  if (overflowAssistants.length && moreAssistants.length) {
    buttons.splice(overflowAssistants.length, 0, '<menuSeparator id="sepContextMoreAssistantGroups" />')
  }
  if (!assistants.length) {
    buttons.push('<button id="btnContextAssistantEmpty" label="暂无更多智能助手" enabled="false" getImage="ribbon.GetImage" />')
  }
  return `<menu xmlns="${ns}">${buttons.join('')}</menu>`
}

function GetContextTextAnalysisMenuContent(control) {
  const ns = 'http://schemas.microsoft.com/office/2006/01/customui'
  const primaryButtons = CONTEXT_TEXT_ANALYSIS_PRIMARY
    .map((assistantId) => getAssistantDisplayEntry(assistantId))
    .filter(Boolean)
    .map((entry, index) => `<button id="${buildDynamicAssistantButtonId(CONTEXT_TEXT_ANALYSIS_ASSISTANT_CONTROL_PREFIX, index)}" label="${escapeXml(entry.title || '未命名助手')}" onAction="ribbon.OnAction" getImage="ribbon.GetImage" />`)

  const secondaryButtons = CONTEXT_TEXT_ANALYSIS_SECONDARY
    .map((assistantId) => getAssistantDisplayEntry(assistantId))
    .filter(Boolean)
    .map((entry, index) => `<button id="${buildDynamicAssistantButtonId(CONTEXT_TEXT_ANALYSIS_MORE_ASSISTANT_CONTROL_PREFIX, index)}" label="${escapeXml(entry.title || '未命名助手')}" onAction="ribbon.OnAction" getImage="ribbon.GetImage" />`)

  if (secondaryButtons.length) {
    primaryButtons.push(`<menu id="menuContextTextAnalysisMore" label="更多文本分析">${secondaryButtons.join('')}</menu>`)
  }
  if (!primaryButtons.length) {
    primaryButtons.push('<button id="btnContextTextAnalysisEmpty" label="暂无可用文本分析能力" enabled="false" getImage="ribbon.GetImage" />')
  }
  return `<menu xmlns="${ns}">${primaryButtons.join('')}</menu>`
}

function GetContextTranslationMenuContent(control) {
  const ns = 'http://schemas.microsoft.com/office/2006/01/customui'
  const primaryButtons = TRANSLATION_LANGUAGES
    .filter(lang => CONTEXT_TRANSLATION_PRIMARY_LANGS.includes(lang.code))
    .map((lang) => `<button id="btnTranslate_${lang.code}" label="${escapeXml(lang.label)}" onAction="ribbon.OnAction" getImage="ribbon.GetImage" />`)

  const secondaryButtons = TRANSLATION_LANGUAGES
    .filter(lang => !CONTEXT_TRANSLATION_PRIMARY_LANGS.includes(lang.code))
    .map((lang) => `<button id="btnTranslate_${lang.code}" label="${escapeXml(lang.label)}" onAction="ribbon.OnAction" getImage="ribbon.GetImage" />`)

  if (secondaryButtons.length) {
    primaryButtons.push(`<menu id="menuContextTranslateMore" label="更多语言">${secondaryButtons.join('')}</menu>`)
  }
  if (!primaryButtons.length) {
    primaryButtons.push('<button id="btnContextTranslateEmpty" label="暂无可用翻译语言" enabled="false" getImage="ribbon.GetImage" />')
  }
  return `<menu xmlns="${ns}">${primaryButtons.join('')}</menu>`
}

async function executeAssistantFromRibbon(assistantId, options = {}) {
  const ribbonOptions = {
    ...options,
    strictAssistantDefaults: true,
    launchSource: 'ribbon-direct'
  }
  const launchInfo = getAssistantLaunchInfo(assistantId, ribbonOptions)
  if (launchInfo.requiresFullDocumentConfirm) {
    const confirmed = confirmFullDocumentSubmit(launchInfo.title, launchInfo.inputLength)
    if (!confirmed) {
      return { cancelled: true }
    }
  }
  const { taskId, promise } = startAssistantTask(assistantId, ribbonOptions)
  if (!taskId) {
    throw new Error('任务启动失败，未能创建任务')
  }
  window.Application.ShowDialog(
    Util.GetUrlPath() + Util.GetRouterHash() + `/task-progress-dialog?taskId=${encodeURIComponent(taskId)}`,
    options.taskTitle || '任务进度',
    520 * (window.devicePixelRatio || 1),
    260 * (window.devicePixelRatio || 1),
    false
  )
  return promise
}

function openAssistantSettings(itemKey = 'create-custom-assistant') {
  try {
    openSettingsWindow({ menu: 'assistant-settings', item: itemKey }, { title: '助手设置' })
  } catch (e) {
    reportError('无法打开助手设置', e, { context: { itemKey } })
  }
}

// toggleButton 的 getPressed 回调（radio 单选状态）
function GetModelTogglePressed(control) {
  const id = control?.Id || control?.id || ''
  const match = id.match(/^model_(\d+)$/)
  const idx = match ? parseInt(match[1], 10) : -1
  return idx === getSelectedModelIndex()
}

// 处理模型 toggle 选择（toggleButton onAction）
function OnModelToggle(control, pressed) {
  const id = control?.Id || control?.id || ''
  const match = id.match(/^model_(\d+)$/)
  if (!match) return true
  const selectedIndex = parseInt(match[1], 10)
  OnModelSelect(control, null, selectedIndex)
  // 刷新菜单回显
  if (window.Application?.ribbonUI) {
    window.Application.ribbonUI.InvalidateControl('menuModelSelect')
  }
  return true
}

// 保留原 gallery 回调供 getImage 等使用
function GetModelItemCount(control) {
  return getFilteredModelList().length
}

function GetModelItemLabel(control, index) {
  const list = getFilteredModelList()
  if (index >= 0 && index < list.length) {
    return list[index].name || list[index].label || `模型 ${index + 1}`
  }
  return ''
}

function GetModelItemImage(control, index) {
  const list = getFilteredModelList()
  let idx = typeof index === 'number' ? index : -1
  if (idx < 0 && control) {
    const id = control.Id || control.id || ''
    const match = id.match(/^model_(\d+)$/)
    idx = match ? parseInt(match[1], 10) : -1
  }
  if (idx >= 0 && idx < list.length) {
    const model = list[idx]
    // 与察元AI编审设置中一致，使用 getModelLogoPath 解析图标路径
    if (model && model.id) {
      const path = getModelLogoPath(model.id)
      if (path) return resolveRibbonIconUrl(path)
    }
    return resolveRibbonIconUrl(model.icon || model.image || 'images/ai-assistant.svg')
  }
  return resolveRibbonIconUrl('images/ai-assistant.svg')
}

function GetModelItemID(control, index) {
  const list = getFilteredModelList()
  if (index >= 0 && index < list.length) {
    return list[index].id || `model_${index}`
  }
  return `model_${index}`
}

// 处理模型选择
function OnModelSelect(control, selectedId, selectedIndex) {
  const list = getFilteredModelList()
  if (selectedIndex >= 0 && selectedIndex < list.length) {
    selectedModelIndex = selectedIndex
    const selectedModel = list[selectedIndex]
    
    // 保存选中的模型
    window.Application.PluginStorage.setItem('selectedModel', JSON.stringify(selectedModel))
    window.Application.PluginStorage.setItem('selectedModelIndex', selectedIndex)
    
    console.log('已选择模型:', selectedModel.name)
  }
  return true
}

// 表格批量操作下拉项（galleryTableBatch 下拉项）
const TABLE_BATCH_ITEMS = [
  { id: 'btnSelectAllTables', label: '导出全部表格', icon: 'images/export-table.svg' },
  { id: 'btnDeleteAllTables', label: '删除全部表格', icon: 'images/delete-table.svg' },
  { id: 'btnTableAutoWidth', label: '根据内容自动行宽', icon: 'images/table-width.svg' },
  { id: 'btnWindowAutoWidth', label: '根据窗口自动行宽', icon: 'images/window-width.svg' },
  { id: 'btnAutoRefreshStyle', label: '根据第一表格刷新样式', icon: 'images/refresh.svg' },
  { id: 'btnDeleteTextRow', label: '删除文字所在行', icon: 'images/delete-text-row.svg' },
  { id: 'btnDeleteTextColumn', label: '删除文字所在列', icon: 'images/delete-text-column.svg' },
  { id: 'btnAppendReplaceText', label: '追加替换文字', icon: 'images/replace-text.svg' },
  { id: 'btnAddFirstColNumber', label: '首列添加序号', icon: 'images/number.svg' },
  { id: 'btnManualColWidth', label: '手动列宽度', icon: 'images/column-width.svg' },
  { id: 'btnFirstColStyle', label: '第一列指定样式', icon: 'images/column-style.svg' },
  { id: 'btnFirstRowStyle', label: '第一行指定样式', icon: 'images/row-style.svg' },
  { id: 'btnAddTableCaption', label: '添加表格题注', icon: 'images/caption.svg' },
  { id: 'btnDeleteTableCaption', label: '删除表格题注', icon: 'images/delete-caption.svg' }
]

function GetTableBatchItemCount(control) {
  return TABLE_BATCH_ITEMS.length
}

function GetTableBatchItemLabel(control, index) {
  if (index >= 0 && index < TABLE_BATCH_ITEMS.length) {
    return TABLE_BATCH_ITEMS[index].label
  }
  return ''
}

function GetTableBatchItemImage(control, index) {
  if (index >= 0 && index < TABLE_BATCH_ITEMS.length) {
    return resolveRibbonIconUrl(TABLE_BATCH_ITEMS[index].icon)
  }
  return resolveRibbonIconUrl('images/table-width.svg')
}

function GetTableBatchItemID(control, index) {
  if (index >= 0 && index < TABLE_BATCH_ITEMS.length) {
    return TABLE_BATCH_ITEMS[index].id
  }
  return 'tableBatch_' + index
}

function GetTableBatchItemWidth(control, index) {
  return 120
}

function GetTableBatchItemHeight(control, index) {
  return 24
}

function OnTableBatchSelect(control, selectedId, selectedIndex) {
  const btnId = selectedId || TABLE_BATCH_ITEMS[selectedIndex]?.id
  if (btnId) {
    OnAction({ Id: btnId })
  }
  return true
}

// 图像批量操作下拉项（galleryImageBatch 下拉项）
const IMAGE_BATCH_ITEMS = [
  { id: 'btnSelectAllImages', label: '导出全部图像', icon: 'images/export-image.svg' },
  { id: 'btnDeleteAllImages', label: '删除全部图像', icon: 'images/delete-image.svg' },
  { id: 'btnUniformImageFormat', label: '统一图像格式', icon: 'images/uniform-image-format.svg' },
  { id: 'btnClearImageFormat', label: '清除图像格式', icon: 'images/clear-image-format.svg' },
  { id: 'btnDeleteImageCaption', label: '删除图像题注', icon: 'images/delete-image-caption.svg' },
  { id: 'btnAddImageCaption', label: '添加图像题注', icon: 'images/add-image-caption.svg' }
]

function GetImageBatchItemCount(control) {
  return IMAGE_BATCH_ITEMS.length
}

function GetImageBatchItemLabel(control, index) {
  if (index >= 0 && index < IMAGE_BATCH_ITEMS.length) {
    return IMAGE_BATCH_ITEMS[index].label
  }
  return ''
}

function GetImageBatchItemImage(control, index) {
  if (index >= 0 && index < IMAGE_BATCH_ITEMS.length) {
    return resolveRibbonIconUrl(IMAGE_BATCH_ITEMS[index].icon)
  }
  return resolveRibbonIconUrl('images/select-images.svg')
}

function GetImageBatchItemID(control, index) {
  if (index >= 0 && index < IMAGE_BATCH_ITEMS.length) {
    return IMAGE_BATCH_ITEMS[index].id
  }
  return 'imageBatch_' + index
}

function GetImageBatchItemWidth(control, index) {
  return 120
}

function GetImageBatchItemHeight(control, index) {
  return 24
}

function OnImageBatchSelect(control, selectedId, selectedIndex) {
  const btnId = selectedId || IMAGE_BATCH_ITEMS[selectedIndex]?.id
  if (btnId) {
    OnAction({ Id: btnId })
  }
  return true
}

var WebNotifycount = 0

// 任务窗口管理（同一位置不同路由使用独立存储，避免互相覆盖）
function showTaskPane(position, route) {
  const routeKey = (route || '').replace(/^\//, '').replace(/\//g, '_') || 'default'
  const storageKey = `taskpane_${position}_${routeKey}_id`
  let tsId = window.Application.PluginStorage.getItem(storageKey)
  
  // WPS的TaskPane只支持左右停靠，上下位置使用ShowDialog实现
  if (position === 'top' || position === 'bottom') {
    // 使用ShowDialog实现上下窗口效果
    const width = window.screen.width * 0.8
    const height = position === 'top' ? 200 : 200 // 顶部和底部窗口高度
    const top = position === 'top' ? 0 : window.screen.height - height
    const left = (window.screen.width - width) / 2
    
    window.Application.ShowDialog(
      Util.GetUrlPath() + Util.GetRouterHash() + route,
      position === 'top' ? '顶部任务窗口' : '底部任务窗口',
      width * window.devicePixelRatio,
      height * window.devicePixelRatio,
      false
    )
    return
  }

  // 左右停靠使用TaskPane（URL 必须带 hash，否则 Vue 路由会落到默认页导致规则列表不显示）
  const routePath = (route || '').replace(/^\//, '') || ''
  const base = Util.GetUrlPath()
  let taskPaneUrl
  if (window.location.protocol === 'file:') {
    const sep = base.endsWith('/') ? '' : '/'
    taskPaneUrl = base + sep + 'index.html#' + (routePath ? '/' + routePath : '')
  } else {
    const slash = base.endsWith('/') ? '' : '/'
    taskPaneUrl = base + slash + '#/' + routePath
  }
  if (!tsId) {
    let tskpane = window.Application.CreateTaskPane(taskPaneUrl)
    let id = tskpane.ID
    window.Application.PluginStorage.setItem(storageKey, id)
    // 设置停靠位置
    if (position === 'left') {
      tskpane.DockPosition = window.Application.Enum.msoCTPDockPositionLeft
    } else if (position === 'right') {
      tskpane.DockPosition = window.Application.Enum.msoCTPDockPositionRight
    }
    tskpane.Visible = true
  } else {
    let tskpane = window.Application.GetTaskPane(tsId)
    tskpane.Visible = !tskpane.Visible
  }
}

// 弹出“删除文字所在行/列”对话框（mode=row 默认选“删除行”，mode=column 默认选“删除列”）
function showDeleteTextDialog(mode) {
  try {
    const modeParam = mode === 'column' ? 'column' : 'row'
    let url = ''
    try {
      const base = window.Application.PluginStorage.getItem('AddinBaseUrl')
      if (base && typeof base === 'string') {
        url = Util.addonSpaUrlFromStorageBase(base, `dialog-delete-text?mode=${modeParam}`)
      }
    } catch (e) {}
    if (!url) {
      url = Util.GetUrlPath() + Util.GetRouterHash() + '/dialog-delete-text?mode=' + modeParam
    }
    window.Application.ShowDialog(
      url,
      '删除文字所在行/列',
      420 * (window.devicePixelRatio || 1),
      380 * (window.devicePixelRatio || 1),
      false
    )
  } catch (e) {
    console.error('打开删除文字对话框失败:', e)
  }
}

// 弹出“第一列/第一行指定样式”对话框（target=column 第一列，target=row 第一行）
function showTableStyleDialog(target) {
  try {
    const isRow = target === 'row'
    const title = isRow ? '第一行指定样式' : '第一列指定样式'
    const query = '?target=' + (isRow ? 'row' : 'column')
    let url = ''
    try {
      const base = window.Application.PluginStorage.getItem('AddinBaseUrl')
      if (base && typeof base === 'string') {
        const q = String(query || '').replace(/^\?/, '')
        url = Util.addonSpaUrlFromStorageBase(base, `dialog-first-col-style${q ? `?${q}` : ''}`)
      }
    } catch (e) {}
    if (!url) {
      url = Util.GetUrlPath() + Util.GetRouterHash() + '/dialog-first-col-style' + query
    }
    window.Application.ShowDialog(
      url,
      title,
      520 * (window.devicePixelRatio || 1),
      480 * (window.devicePixelRatio || 1),
      false
    )
  } catch (e) {
    console.error('打开指定样式对话框失败:', e)
  }
}

function showFirstColStyleDialog() {
  showTableStyleDialog('column')
}

function showFirstRowStyleDialog() {
  showTableStyleDialog('row')
}

function showUniformImageFormatDialog() {
  try {
    let url = ''
    try {
      const base = window.Application.PluginStorage.getItem('AddinBaseUrl')
      if (base && typeof base === 'string') {
        url = Util.addonSpaUrlFromStorageBase(base, 'dialog-uniform-image-format')
      }
    } catch (e) {}
    if (!url) {
      url = Util.GetUrlPath() + Util.GetRouterHash() + '/dialog-uniform-image-format'
    }
    window.Application.ShowDialog(
      url,
      '统一图像格式',
      440 * (window.devicePixelRatio || 1),
      520 * (window.devicePixelRatio || 1),
      false
    )
  } catch (e) {
    console.error('打开统一图像格式对话框失败:', e)
  }
}

// 导出全部表格到Excel（使用xlsx库）
function exportAllTablesToExcel() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return
    }
    
    // 检查文档中是否有表格
    const tables = doc.Tables
    if (!tables || tables.Count === 0) {
      alert('文档中没有表格')
      return
    }
    
    console.log(`找到 ${tables.Count} 个表格，开始导出...`)
    
    // 获取文档名称（不含扩展名）作为默认文件名
    let docName = doc.Name || '导出表格'
    if (docName.lastIndexOf('.') > 0) {
      docName = docName.substring(0, docName.lastIndexOf('.'))
    }
    const defaultFileName = docName + '_表格导出.xlsx'
    // Mac 无 ActiveXObject，无法直接写文件，只能通过“下载”保存
    const canWriteFile = typeof ActiveXObject !== 'undefined'

    // 弹出文件另存为对话框（Mac 上 FileDialog 可能不可用，会回退到 GetSaveAsFileName 或仅用默认文件名下载）
    let finalFilePath = null

    function normalizePath(path) {
      if (!path || typeof path !== 'string') return path
      return path.replace(/^file:\/\//i, '').replace(/\\/g, '/')
    }
    function pathSep() {
      return canWriteFile ? '\\' : '/'
    }

    console.log('开始选择保存路径...')
    try {
      const fileDialog = window.Application.FileDialog(2)
      fileDialog.Title = '导出表格到Excel'
      const docPath = doc.Path || ''
      if (docPath) {
        fileDialog.InitialFileName = normalizePath(docPath) + pathSep() + defaultFileName
      } else {
        fileDialog.InitialFileName = defaultFileName
      }
      try {
        fileDialog.Filters.Clear()
        fileDialog.Filters.Add('Excel工作簿', '*.xlsx', 1)
        fileDialog.Filters.Add('Excel 97-2003工作簿', '*.xls', 2)
      } catch (filterErr) {
        console.warn('FileDialog.Filters 不可用（如 Mac）:', filterErr)
      }
      fileDialog.FilterIndex = 1

      console.log('显示文件另存为对话框...')
      const result = fileDialog.Show()
      console.log('FileDialog.Show() 返回值:', result)

      if (result === -1) {
        const selectedPath = fileDialog.SelectedItems.Item(1)
        console.log('用户选择的文件路径:', selectedPath)
        let filePath = normalizePath(selectedPath)
        const lowerPath = filePath.toLowerCase()
        const idx = (typeof fileDialog.FilterIndex !== 'undefined') ? fileDialog.FilterIndex : 1
        if (idx === 2) {
          if (!lowerPath.endsWith('.xls')) filePath = filePath + '.xls'
        } else {
          if (!lowerPath.endsWith('.xlsx')) filePath = filePath + '.xlsx'
        }
        finalFilePath = filePath
        console.log('最终文件路径:', finalFilePath)
      } else {
        // Mac 上 FileDialog 可能返回 0 等非 -1，不当作用户取消，用默认路径继续
        if (!canWriteFile) {
          try {
            if (window.Application.Env && typeof window.Application.Env.GetDownloadPath === 'function') {
              const downloadDir = window.Application.Env.GetDownloadPath()
              finalFilePath = normalizePath(downloadDir) + pathSep() + defaultFileName
              console.log('Mac 使用下载目录:', finalFilePath)
            } else {
              finalFilePath = defaultFileName
            }
          } catch (envErr) {
            finalFilePath = defaultFileName
          }
        } else {
          console.log('用户取消了文件保存对话框')
          return
        }
      }
    } catch (e) {
      console.warn('FileDialog 不可用（如 Mac），尝试 GetSaveAsFileName:', e.message || e)
      try {
        const filePath = window.Application.GetSaveAsFileName(
          defaultFileName,
          'Excel工作簿 (*.xlsx), *.xlsx, Excel 97-2003 (*.xls), *.xls',
          1,
          '导出表格到 Excel',
          '保存'
        )
        if (filePath && filePath !== false) {
          finalFilePath = normalizePath(filePath)
          const lower = finalFilePath.toLowerCase()
          if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
            finalFilePath = finalFilePath + '.xlsx'
          }
        }
      } catch (e2) {
        console.warn('GetSaveAsFileName 也失败:', e2.message || e2)
      }
      if (!finalFilePath && !canWriteFile) {
        finalFilePath = defaultFileName
        console.log('将使用浏览器下载，文件名:', finalFilePath)
      }
      if (!finalFilePath) {
        alert('无法打开保存对话框。将尝试生成并下载文件。')
        finalFilePath = defaultFileName
      }
    }

    if (!finalFilePath) {
      alert('未选择保存路径')
      return
    }
    
    // 尝试使用WPS表格应用程序保存文件
    let saved = false
    
    // 方法1: 尝试通过WPS表格应用程序直接保存（优先方法）
    try {
      // 尝试获取或创建WPS表格应用程序
      let ketApp = null
      
      console.log('尝试获取WPS表格应用程序...')
      
      // 尝试通过GetObject获取已运行的WPS表格实例
      if (window.Application && window.Application.GetObject) {
        try {
          ketApp = window.Application.GetObject('', 'Ket.Application')
          console.log('✓ 成功获取已运行的WPS表格实例')
        } catch (e) {
          console.log('获取已运行实例失败:', e.message || e.toString())
        }
      }
      
      // 如果成功获取了WPS表格应用，使用它保存文件
      if (ketApp) {
        try {
          ketApp.Visible = false
          ketApp.DisplayAlerts = false
          
          // 创建新工作簿
          const wb = ketApp.Workbooks.Add()
          console.log('成功创建Excel工作簿')
          
          // 删除默认的sheet（保留第一个）
          while (wb.Worksheets.Count > 1) {
            wb.Worksheets.Item(wb.Worksheets.Count).Delete()
          }
          
          // 直接从Word表格复制数据到Excel
          for (let i = 1; i <= tables.Count; i++) {
            const wordTable = tables.Item(i)
            const rowCount = wordTable.Rows.Count
            const colCount = wordTable.Columns.Count
            
            console.log(`处理表格 ${i}/${tables.Count} (${rowCount}行 x ${colCount}列)`)
            
            // 创建工作表（第一个使用默认sheet）
            let ws = null
            if (i === 1) {
              ws = wb.Worksheets.Item(1)
              ws.Name = `表格${i}`
            } else {
              ws = wb.Worksheets.Add()
              ws.Name = `表格${i}`
            }
            
            // 将Word表格数据复制到Excel工作表
            for (let row = 1; row <= rowCount; row++) {
              for (let col = 1; col <= colCount; col++) {
                try {
                  const cell = wordTable.Cell(row, col)
                  if (cell && cell.Range && cell.Range.Text) {
                    let cellText = cell.Range.Text
                    // 移除Word表格单元格末尾的换行符和段落标记
                    cellText = cellText.replace(/\r\n$/, '').replace(/\r$/, '').replace(/\n$/, '').replace(/\x07$/, '')
                    ws.Cells(row, col).Value = cellText
                  }
                } catch (e) {
                  console.error(`复制表格${i}第${row}行第${col}列失败:`, e)
                }
              }
            }
            
            // 自动调整列宽
            try {
              const usedRange = ws.UsedRange
              if (usedRange && usedRange.Columns) {
                usedRange.Columns.AutoFit()
              }
            } catch (e) {
              console.warn(`自动调整列宽失败 (表格${i}):`, e)
            }
          }
          
          // 保存文件
          console.log('开始保存文件到:', finalFilePath)
          wb.SaveAs(finalFilePath)
          wb.Close()
          ketApp.Quit()
          
          saved = true
          console.log('✓ 成功通过WPS表格保存文件')
          alert(`成功导出${tables.Count}个表格到: ${finalFilePath}`)
          
        } catch (e) {
          console.error('使用WPS表格保存失败:', e)
          console.error('错误详情:', {
            message: e.message,
            name: e.name,
            stack: e.stack
          })
          if (ketApp) {
            try {
              ketApp.Quit()
            } catch (e2) {
              console.error('关闭WPS表格失败:', e2)
            }
          }
        }
      } else {
        console.log('无法获取WPS表格应用程序，将使用xlsx库生成文件')
      }
    } catch (e) {
      console.error('尝试使用WPS表格保存时出错:', e)
    }
    
    // 方法2: 如果WPS表格方法失败，使用xlsx库生成Excel文件
    let excelBuffer = null
    if (!saved) {
      console.log('开始使用xlsx库创建Excel文件...')
      try {
        const workbook = XLSX.utils.book_new()
        
        // 遍历Word文档中的所有表格，将每个表格转换为工作表
        for (let i = 1; i <= tables.Count; i++) {
          try {
            const wordTable = tables.Item(i)
            console.log(`处理表格 ${i}/${tables.Count}`)
            
            // 获取表格的行数和列数
            const rowCount = wordTable.Rows.Count
            const colCount = wordTable.Columns.Count
            console.log(`表格${i} 尺寸: ${rowCount}行 x ${colCount}列`)
            
            // 创建二维数组存储表格数据
            const tableData = []
            
            // 读取表格数据
            for (let row = 1; row <= rowCount; row++) {
              const rowData = []
              for (let col = 1; col <= colCount; col++) {
                try {
                  const cell = wordTable.Cell(row, col)
                  if (cell && cell.Range && cell.Range.Text) {
                    let cellText = cell.Range.Text
                    // 移除Word表格单元格末尾的换行符和段落标记
                    cellText = cellText.replace(/\r\n$/, '').replace(/\r$/, '').replace(/\n$/, '').replace(/\x07$/, '')
                    rowData.push(cellText)
                  } else {
                    rowData.push('')
                  }
                } catch (e) {
                  console.error(`读取表格${i}第${row}行第${col}列失败:`, e)
                  rowData.push('')
                }
              }
              tableData.push(rowData)
            }
            
            // 创建工作表
            const worksheet = XLSX.utils.aoa_to_sheet(tableData)
            
            // 设置工作表名称（Excel工作表名称最多31个字符）
            let sheetName = `表格${i}`
            if (sheetName.length > 31) {
              sheetName = sheetName.substring(0, 31)
            }
            
            // 将工作表添加到工作簿
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
            console.log(`表格${i}数据已添加到工作簿`)
            
          } catch (e) {
            console.error(`处理表格${i}时出错:`, e)
          }
        }
        
        // 将工作簿转换为二进制数据
        console.log('开始生成Excel文件数据...')
        
        // 根据文件扩展名选择文件类型
        let bookType = 'xlsx'
        const lowerPath = finalFilePath.toLowerCase()
        if (lowerPath.endsWith('.xls')) {
          bookType = 'xls'
        }
        
        excelBuffer = XLSX.write(workbook, { 
          type: 'array', 
          bookType: bookType 
        })
        
        console.log('Excel文件数据生成完成，格式:', bookType, '大小:', excelBuffer.length, '字节')
        
        // Windows：使用 ADODB.Stream 写入文件；Mac 无 ActiveXObject，跳过，后面用 Blob 下载
        if (canWriteFile) {
          try {
            const stream = new ActiveXObject('ADODB.Stream')
            stream.Type = 1 // adTypeBinary
            stream.Open()
            stream.Write(excelBuffer)
            const pathForWrite = finalFilePath.replace(/\//g, '\\')
            stream.SaveToFile(pathForWrite, 2) // adSaveCreateOverWrite
            stream.Close()
            saved = true
            console.log('✓ 成功使用ADODB.Stream保存文件')
            alert(`成功导出${tables.Count}个表格到: ${finalFilePath}`)
          } catch (e) {
            console.error('使用ADODB.Stream保存失败:', e)
          }
        } else {
          // Mac：尝试 WPS FileSystem.writeAsBinaryString 写文件
          try {
            const fs = window.Application && window.Application.FileSystem
            if (fs && typeof fs.writeAsBinaryString === 'function') {
              const arr = new Uint8Array(excelBuffer)
              let binaryStr = ''
              const chunk = 8192
              for (let i = 0; i < arr.length; i += chunk) {
                binaryStr += String.fromCharCode.apply(null, arr.subarray(i, i + chunk))
              }
              let fullPath = finalFilePath
              if (fullPath.indexOf('/') === -1 && fullPath.indexOf('\\') === -1) {
                try {
                  if (window.Application.Env && typeof window.Application.Env.GetDownloadPath === 'function') {
                    fullPath = normalizePath(window.Application.Env.GetDownloadPath()) + pathSep() + fullPath
                  }
                } catch (e) {}
              }
              fullPath = fullPath.replace(/\//g, pathSep())
              if (fs.writeAsBinaryString(fullPath, binaryStr)) {
                saved = true
                console.log('✓ 已通过 FileSystem.writeAsBinaryString 保存:', fullPath)
                alert(`成功导出 ${tables.Count} 个表格到:\n${fullPath}`)
              }
            }
          } catch (fsErr) {
            console.warn('FileSystem.writeAsBinaryString 失败:', fsErr.message || fsErr)
          }
          if (!saved) {
            console.log('当前环境无法直接写文件（如 Mac），将使用下载方式')
          }
        }
      } catch (e) {
        console.error('使用xlsx库生成文件时出错:', e)
      }
    }

    // 方法3: 若仍未保存且有数据，尝试 Blob/下载（含 Mac 备用）
    if (!saved && excelBuffer) {
      const fileName = finalFilePath.split(/[\\/]/).pop() || defaultFileName
      let downloadOk = false
      try {
        let mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        if (finalFilePath.toLowerCase().endsWith('.xls')) {
          mimeType = 'application/vnd.ms-excel'
        }
        const blob = new Blob([excelBuffer], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setTimeout(function () {
          try { URL.revokeObjectURL(url) } catch (e) {}
        }, 500)
        downloadOk = true
        console.log('✓ 已触发浏览器下载')
        alert(`Excel文件已生成并触发下载！\n包含 ${tables.Count} 个表格\n文件名: ${fileName}`)
      } catch (e) {
        console.warn('Blob+link 下载失败:', e.message || e)
      }
      if (!downloadOk) {
        try {
          const arr = new Uint8Array(excelBuffer)
          let binaryStr = ''
          const chunk = 8192
          for (let i = 0; i < arr.length; i += chunk) {
            binaryStr += String.fromCharCode.apply(null, arr.subarray(i, i + chunk))
          }
          const dataUrl = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + btoa(binaryStr)
          const w = window.open('', '_blank')
          if (w) {
            w.document.write('<html><head><meta charset="utf-8"/><title>下载</title></head><body><p>正在下载...</p><a href="' + dataUrl + '" download="' + fileName + '">点击保存 ' + fileName + '</a></body></html>')
            w.document.close()
            downloadOk = true
            alert(`Excel 已生成。若未自动下载，请在新窗口中点击“点击保存 ${fileName}”`)
          }
        } catch (e2) {
          console.warn('data URL 备用下载失败:', e2.message || e2)
        }
      }
      if (!downloadOk) {
        alert(`Excel 数据已生成（${(excelBuffer.length / 1024).toFixed(2)} KB），但当前环境无法保存。\n请尝试：\n1) 在 Windows 上使用本功能\n2) 或将控制台中的错误信息反馈给开发者。`)
      }
    } else if (!saved) {
      alert('无法生成Excel文件，请查看控制台获取详细错误信息')
    }
    
  } catch (e) {
    reportError('导出表格失败', e)
  }
}

// 文档内所有表格按内容自动调整列宽
function autoFitAllTablesByContent() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return
    }

    const tables = doc.Tables
    if (!tables || tables.Count === 0) {
      alert('文档中没有表格')
      return
    }

    let successCount = 0
    let failCount = 0

    // Word/WPS 常用枚举：wdAutoFitContent = 1
    const autoFitContentValue =
      (window.Application.Enum && window.Application.Enum.wdAutoFitContent) || 1

    for (let i = 1; i <= tables.Count; i++) {
      try {
        const table = tables.Item(i)
        if (table) {
          try {
            table.AllowAutoFit = true
          } catch (e) {}
          if (typeof table.AutoFitBehavior === 'function') {
            table.AutoFitBehavior(autoFitContentValue)
          } else if (typeof table.AutoFit === 'function') {
            // 兼容可能存在的 AutoFit 方法
            table.AutoFit()
          }
          successCount++
        }
      } catch (e) {
        console.error(`表格${i} 自动行宽失败:`, e)
        failCount++
      }
    }

    if (failCount > 0) {
      alert(`已处理 ${tables.Count} 个表格，成功 ${successCount} 个，失败 ${failCount} 个`)
    } else {
      alert(`已完成：${tables.Count} 个表格已按内容自动调整列宽`)
    }
  } catch (e) {
    reportError('自动调整表格列宽失败', e)
  }
}

// 文档内所有表格按窗口自动调整列宽
function autoFitAllTablesByWindow() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return
    }

    const tables = doc.Tables
    if (!tables || tables.Count === 0) {
      alert('文档中没有表格')
      return
    }

    let successCount = 0
    let failCount = 0

    // Word/WPS 常用枚举：wdAutoFitWindow = 2
    const autoFitWindowValue =
      (window.Application.Enum && window.Application.Enum.wdAutoFitWindow) || 2

    for (let i = 1; i <= tables.Count; i++) {
      try {
        const table = tables.Item(i)
        if (table) {
          try {
            table.AllowAutoFit = true
          } catch (e) {}
          if (typeof table.AutoFitBehavior === 'function') {
            table.AutoFitBehavior(autoFitWindowValue)
          } else if (typeof table.AutoFit === 'function') {
            // 兼容可能存在的 AutoFit 方法
            table.AutoFit()
          }
          successCount++
        }
      } catch (e) {
        console.error(`表格${i} 自动窗口行宽失败:`, e)
        failCount++
      }
    }

    if (failCount > 0) {
      alert(`已处理 ${tables.Count} 个表格，成功 ${successCount} 个，失败 ${failCount} 个`)
    } else {
      alert(`已完成：${tables.Count} 个表格已按窗口自动调整列宽`)
    }
  } catch (e) {
    reportError('自动调整表格列宽失败', e)
  }
}

// 从源 Range 复制格式（边框、底纹、字体、段落）到目标 Range，兼容 WPS/Word
function copyRangeFormat(sourceRange, destRange) {
  if (!sourceRange || !destRange) return
  const borderIndices = [1, 2, 3, 4, 5, 6] // 上左下右、水平线、垂直线
  try {
    if (sourceRange.Borders && destRange.Borders) {
      for (let k = 0; k < borderIndices.length; k++) {
        const idx = borderIndices[k]
        try {
          const srcB = sourceRange.Borders(idx)
          const dstB = destRange.Borders(idx)
          if (srcB && dstB) {
            if (typeof srcB.LineStyle !== 'undefined') dstB.LineStyle = srcB.LineStyle
            if (typeof srcB.LineWidth !== 'undefined') dstB.LineWidth = srcB.LineWidth
            if (typeof srcB.Color !== 'undefined') dstB.Color = srcB.Color
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
  try {
    if (sourceRange.Shading && destRange.Shading) {
      const s = sourceRange.Shading
      const d = destRange.Shading
      if (typeof s.BackgroundPatternColor !== 'undefined') d.BackgroundPatternColor = s.BackgroundPatternColor
      if (typeof s.ForegroundPatternColor !== 'undefined') d.ForegroundPatternColor = s.ForegroundPatternColor
      if (typeof s.Texture !== 'undefined') d.Texture = s.Texture
    }
  } catch (e) {}
  try {
    if (sourceRange.Font && destRange.Font) {
      const s = sourceRange.Font
      const d = destRange.Font
      if (typeof s.Name !== 'undefined') d.Name = s.Name
      if (typeof s.NameFarEast !== 'undefined') d.NameFarEast = s.NameFarEast
      if (typeof s.Size !== 'undefined') d.Size = s.Size
      if (typeof s.Bold !== 'undefined') d.Bold = s.Bold
      if (typeof s.Italic !== 'undefined') d.Italic = s.Italic
      if (typeof s.Color !== 'undefined') d.Color = s.Color
    }
  } catch (e) {}
  try {
    if (sourceRange.ParagraphFormat && destRange.ParagraphFormat) {
      const s = sourceRange.ParagraphFormat
      const d = destRange.ParagraphFormat
      if (typeof s.Alignment !== 'undefined') d.Alignment = s.Alignment
    }
  } catch (e) {}
}

// 根据“角色”（首行/首列/最后一行/最后一列/中间）取首表格中的对应源单元格行列
function getSourceCellRole(firstRows, firstCols, targetRow, targetCol, targetRows, targetCols) {
  const r0 = targetRow === 1 ? 1 : (targetRow === targetRows ? firstRows : 2)
  const c0 = targetCol === 1 ? 1 : (targetCol === targetCols ? firstCols : 2)
  return { row: r0, col: c0 }
}

// 首列添加序号：整个文档的表格首列都加一列序号，每个表格首列自动编号 1、2、3…
function addFirstColNumber() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return
    }
    const tables = doc.Tables
    if (!tables || tables.Count === 0) {
      alert('文档中没有表格')
      return
    }
    let successCount = 0
    let failCount = 0
    for (let t = 1; t <= tables.Count; t++) {
      try {
        const table = tables.Item(t)
        const rowCount = table.Rows.Count
        const columns = table.Columns
        if (!columns || typeof columns.Add !== 'function') {
          failCount++
          console.warn('表格' + t + ' 无法插入列:', columns)
          continue
        }
        // 在首列前插入一列（BeforeColumn 为第 1 列）
        try {
          columns.Add(1)
        } catch (addErr) {
          try {
            const col1 = columns.Item(1)
            if (col1) columns.Add(col1)
            else throw addErr
          } catch (e2) {
            failCount++
            console.error('表格' + t + ' 插入列失败:', addErr.message || addErr, e2.message || e2)
            continue
          }
        }
        // 首列列宽设窄（约 0.6cm，单位：磅），避免过宽
        try {
          const col1 = table.Columns.Item(1)
          if (col1) {
            if (typeof col1.SetWidth === 'function') {
              col1.SetWidth(28, 0) // 28 磅，wdAdjustNone = 0
            } else if (typeof col1.Width !== 'undefined') {
              col1.Width = 28
            }
          }
        } catch (wErr) {
          console.warn('表格' + t + ' 设置首列列宽失败:', wErr.message || wErr)
        }
        // 新首列（第 1 列）每行填入序号并居中（wdAlignParagraphCenter = 1）
        const wdAlignParagraphCenter = (window.Application.Enum && window.Application.Enum.wdAlignParagraphCenter) || 1
        for (let row = 1; row <= rowCount; row++) {
          try {
            const cell = table.Cell(row, 1)
            if (cell && cell.Range) {
              const num = String(row)
              cell.Range.Text = num
              if (cell.Range.ParagraphFormat) {
                cell.Range.ParagraphFormat.Alignment = wdAlignParagraphCenter
              }
            }
          } catch (e) {
            console.warn('表格' + t + ' 第' + row + '行写入序号失败:', e.message || e)
          }
        }
        successCount++
      } catch (e) {
        failCount++
        console.error('表格' + t + ' 首列添加序号失败:', e.message || e)
      }
    }
    if (failCount > 0) {
      alert('已处理 ' + tables.Count + ' 个表格，成功 ' + successCount + ' 个，失败 ' + failCount + ' 个')
    } else {
      alert('已完成：' + tables.Count + ' 个表格均已首列添加序号（1、2、3…）')
    }
  } catch (e) {
    reportError('首列添加序号失败', e)
  }
}

// 将首个表格样式与单元格格式（首行、首列、最后一行、中间行等）完全应用到其他表格
function refreshOtherTablesStyleFromFirst() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return
    }

    const tables = doc.Tables
    if (!tables || tables.Count === 0) {
      alert('文档中没有表格')
      return
    }

    if (tables.Count === 1) {
      alert('文档中仅有一个表格，无需刷新样式')
      return
    }

    const firstTable = tables.Item(1)
    if (!firstTable) {
      alert('无法获取第一个表格')
      return
    }

    const firstRows = firstTable.Rows.Count
    const firstCols = firstTable.Columns.Count

    // 1) 表格样式名称
    let styleName = null
    try {
      const styleObj = firstTable.Style
      if (styleObj != null) {
        styleName = styleObj.NameLocal || styleObj.Name || (typeof styleObj === 'string' ? styleObj : null)
      }
    } catch (e) {
      console.warn('读取首表格样式失败:', e)
    }

    // 2) 表样式选项（标题行、首列、最后一行、最后一列）
    const styleFlags = {}
    try {
      if (typeof firstTable.ApplyStyleHeadingRows !== 'undefined') styleFlags.applyHeadingRows = firstTable.ApplyStyleHeadingRows
      if (typeof firstTable.ApplyStyleLastRow !== 'undefined') styleFlags.applyLastRow = firstTable.ApplyStyleLastRow
      if (typeof firstTable.ApplyStyleFirstColumn !== 'undefined') styleFlags.applyFirstColumn = firstTable.ApplyStyleFirstColumn
      if (typeof firstTable.ApplyStyleLastColumn !== 'undefined') styleFlags.applyLastColumn = firstTable.ApplyStyleLastColumn
    } catch (e) {}

    let successCount = 0
    let failCount = 0

    for (let i = 2; i <= tables.Count; i++) {
      try {
        const table = tables.Item(i)
        if (!table) continue

        // 3) 应用表格样式
        if (styleName) {
          try {
            table.Style = styleName
          } catch (e1) {
            try {
              const docStyle = doc.Styles && doc.Styles.Item(styleName)
              if (docStyle) table.Style = docStyle
            } catch (e2) {
              console.warn(`表格${i} 设置 Style 失败:`, e1.message || e1, e2.message || e2)
            }
          }
        }

        // 4) 应用表样式选项
        try {
          if (styleFlags.applyHeadingRows !== undefined) table.ApplyStyleHeadingRows = styleFlags.applyHeadingRows
          if (styleFlags.applyLastRow !== undefined) table.ApplyStyleLastRow = styleFlags.applyLastRow
          if (styleFlags.applyFirstColumn !== undefined) table.ApplyStyleFirstColumn = styleFlags.applyFirstColumn
          if (styleFlags.applyLastColumn !== undefined) table.ApplyStyleLastColumn = styleFlags.applyLastColumn
        } catch (e) {}

        // 5) 按“角色”逐格复制格式：首行、首列、最后一行、最后一列、中间与首表完全一致
        const targetRows = table.Rows.Count
        const targetCols = table.Columns.Count
        for (let r = 1; r <= targetRows; r++) {
          for (let c = 1; c <= targetCols; c++) {
            try {
              const { row: r0, col: c0 } = getSourceCellRole(firstRows, firstCols, r, c, targetRows, targetCols)
              const srcCell = firstTable.Cell(r0, c0)
              const dstCell = table.Cell(r, c)
              if (srcCell && srcCell.Range && dstCell && dstCell.Range) {
                copyRangeFormat(srcCell.Range, dstCell.Range)
              }
            } catch (e) {}
          }
        }

        successCount++
      } catch (e) {
        console.error(`表格${i} 刷新样式失败:`, e)
        failCount++
      }
    }

    if (failCount > 0) {
      alert(`已处理 ${tables.Count - 1} 个表格，成功 ${successCount} 个，失败 ${failCount} 个`)
    } else {
      alert(`已完成：${tables.Count - 1} 个表格已与首表格样式完全一致（含首行、首列、最后一行、中间行等）`)
    }
  } catch (e) {
    reportError('刷新表格样式失败', e)
  }
}

// 删除文字所在行：弹出输入框 → 在全部表格中查找包含该文字的单元格 → 提示共找到 N 个 → 确认后删除该文字所在的行
function deleteRowsContainingText() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return
    }

    const tables = doc.Tables
    if (!tables || tables.Count === 0) {
      alert('文档中没有表格')
      return
    }

    const searchText = prompt('请输入要查找的文字（将删除包含该文字所在的行）')
    if (searchText == null) return // 用户取消
    const trimmed = (searchText + '').trim()
    if (!trimmed) {
      alert('请输入要查找的文字')
      return
    }

    // 收集“包含该文字的单元格”所在行，同一行只记一次：(tableIndex, rowIndex)
    const rowKeys = new Set()
    for (let ti = 1; ti <= tables.Count; ti++) {
      try {
        const table = tables.Item(ti)
        const rowCount = table.Rows.Count
        const colCount = table.Columns.Count
        for (let r = 1; r <= rowCount; r++) {
          for (let c = 1; c <= colCount; c++) {
            try {
              const cell = table.Cell(r, c)
              if (cell && cell.Range && cell.Range.Text) {
                let cellText = cell.Range.Text
                cellText = cellText.replace(/\r\n$/, '').replace(/\r$/, '').replace(/\n$/, '').replace(/\x07$/, '')
                if (cellText.indexOf(trimmed) !== -1) {
                  rowKeys.add(`${ti},${r}`)
                  break // 该行已命中，不再检查同行其他列
                }
              }
            } catch (e) {}
          }
        }
      } catch (e) {
        console.warn(`遍历表格${ti} 失败:`, e)
      }
    }

    const totalRows = rowKeys.size
    if (totalRows === 0) {
      alert('未找到包含“' + trimmed + '”的文字')
      return
    }

    const confirmed = confirm('共找到 ' + totalRows + ' 个相同的数据，是否删除每个文字所在的行？\n\n点击“确定”将删除这些行。')
    if (!confirmed) return

    // 按表格分组，行号从大到小排序后依次删除，避免删除后行号错位
    const byTable = new Map()
    for (const key of rowKeys) {
      const [ti, r] = key.split(',').map(Number)
      if (!byTable.has(ti)) byTable.set(ti, [])
      byTable.get(ti).push(r)
    }

    let deletedCount = 0
    for (const [ti, rows] of byTable) {
      rows.sort((a, b) => b - a)
      const table = tables.Item(ti)
      for (let idx = 0; idx < rows.length; idx++) {
        try {
          table.Rows.Item(rows[idx]).Delete()
          deletedCount++
        } catch (e) {
          console.error(`删除表格${ti} 第${rows[idx]}行失败:`, e)
        }
      }
    }

    alert('已删除 ' + deletedCount + ' 行')
  } catch (e) {
    reportError('删除文字所在行失败', e)
  }
}

// 删除文字所在列：弹出输入框 → 在全部表格中查找包含该文字的单元格 → 提示共找到 N 个 → 确认后删除该文字所在的列
function deleteColumnsContainingText() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return
    }

    const tables = doc.Tables
    if (!tables || tables.Count === 0) {
      alert('文档中没有表格')
      return
    }

    const searchText = prompt('请输入要查找的文字（将删除包含该文字所在的列）')
    if (searchText == null) return
    const trimmed = (searchText + '').trim()
    if (!trimmed) {
      alert('请输入要查找的文字')
      return
    }

    // 收集“包含该文字的单元格”所在列，同一列只记一次：(tableIndex, colIndex)
    const colKeys = new Set()
    for (let ti = 1; ti <= tables.Count; ti++) {
      try {
        const table = tables.Item(ti)
        const rowCount = table.Rows.Count
        const colCount = table.Columns.Count
        for (let c = 1; c <= colCount; c++) {
          for (let r = 1; r <= rowCount; r++) {
            try {
              const cell = table.Cell(r, c)
              if (cell && cell.Range && cell.Range.Text) {
                let cellText = cell.Range.Text
                cellText = cellText.replace(/\r\n$/, '').replace(/\r$/, '').replace(/\n$/, '').replace(/\x07$/, '')
                if (cellText.indexOf(trimmed) !== -1) {
                  colKeys.add(`${ti},${c}`)
                  break // 该列已命中，不再检查同列其他行
                }
              }
            } catch (e) {}
          }
        }
      } catch (e) {
        console.warn(`遍历表格${ti} 失败:`, e)
      }
    }

    const totalCols = colKeys.size
    if (totalCols === 0) {
      alert('未找到包含“' + trimmed + '”的文字')
      return
    }

    const confirmed = confirm('共找到 ' + totalCols + ' 个相同的数据，是否删除每个文字所在的列？\n\n点击“确定”将删除这些列。')
    if (!confirmed) return

    // 按表格分组，列号从大到小排序后依次删除，避免删除后列号错位
    const byTable = new Map()
    for (const key of colKeys) {
      const [ti, c] = key.split(',').map(Number)
      if (!byTable.has(ti)) byTable.set(ti, [])
      byTable.get(ti).push(c)
    }

    let deletedCount = 0
    for (const [ti, cols] of byTable) {
      cols.sort((a, b) => b - a)
      const table = tables.Item(ti)
      for (let idx = 0; idx < cols.length; idx++) {
        try {
          table.Columns.Item(cols[idx]).Delete()
          deletedCount++
        } catch (e) {
          console.error(`删除表格${ti} 第${cols[idx]}列失败:`, e)
        }
      }
    }

    alert('已删除 ' + deletedCount + ' 列')
  } catch (e) {
    reportError('删除文字所在列失败', e)
  }
}

// 判断段落是否像表格/图题注或标签（表1、Table 1、图1、表、图 等），用于按位置匹配时识别
function isCaptionOrLabelLike(rawText) {
  const t = (rawText || '').replace(/[\r\n\t \u00A0]+/g, ' ').trim()
  if (t.length > 120) return false
  if (!t) return false
  const labelNum = /^(表|图|Table|Figure|附表|附图)(\s*[\d\-\.]+)?(\s+.*)?\s*$/i
  const labelOnly = /^(表|图|Table|Figure|附表|附图)\s*$/i
  return labelNum.test(t) || (t.length <= 20 && labelOnly.test(t))
}

// 仅表格题注/标签（表、Table、附表），用于全文档模式回退，避免误删图题注
function isTableCaptionOrLabelLike(rawText) {
  const t = (rawText || '').replace(/[\r\n\t \u00A0]+/g, ' ').trim()
  if (t.length > 120) return false
  if (!t) return false
  const labelNum = /^(表|Table|附表)\s*[\d\-\.]+(\s+.*|\S.*)?\s*$/i
  const labelOnly = /^(表|Table|附表)\s*$/i
  return labelNum.test(t) || (t.length <= 20 && labelOnly.test(t))
}

// 是否为第 N 个表格的题注（自上而下编号），允许无空格
function isTableCaptionWithIndex(rawText, index) {
  const t = (rawText || '').replace(/[\r\n\t \u00A0]+/g, ' ').trim()
  if (!t) return false
  if (t.length > 120) return false
  const n = String(index)
  const re = new RegExp(`^(表|Table|附表)\\s*${n}(?:[\\-\\.]\\d+)?(?:\\s+.*|\\S.*)?\\s*$`, 'i')
  return re.test(t)
}

// 仅图像题注/标签（图、Figure、附图），用于全文档模式回退，避免误删表题注
function isImageCaptionOrLabelLike(rawText) {
  const t = (rawText || '').replace(/[\r\n\t \u00A0]+/g, ' ').trim()
  if (t.length > 120) return false
  if (!t) return false
  const labelNum = /^(图|Figure|附图)\s*[\d\-\.]+(\s+.*|\S.*)?\s*$/i
  const labelOnly = /^(图|Figure|附图)\s*$/i
  return labelNum.test(t) || (t.length <= 20 && labelOnly.test(t))
}

// 是否为第 N 个图像的题注（自上而下编号），允许无空格
function isImageCaptionWithIndex(rawText, index) {
  const t = (rawText || '').replace(/[\r\n\t \u00A0]+/g, ' ').trim()
  if (!t) return false
  if (t.length > 120) return false
  const n = String(index)
  const re = new RegExp(`^(图|Figure|附图)\\s*${n}(?:[\\-\\.]\\d+)?(?:\\s+.*|\\S.*)?\\s*$`, 'i')
  return re.test(t)
}

// 删除文档中全部表格
function deleteAllTables() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return
    }
    const tables = doc.Tables
    if (!tables || tables.Count === 0) {
      alert('文档中没有表格')
      return
    }
    const totalCount = tables.Count
    // 从后往前删除，避免删除后索引变化
    for (let i = totalCount; i >= 1; i--) {
      try {
        const table = tables.Item(i)
        if (table && typeof table.Delete === 'function') {
          table.Delete()
        }
      } catch (e) {
        console.warn('删除表格 ' + i + ' 失败:', e)
      }
    }
    alert('已删除 ' + totalCount + ' 个表格')
  } catch (e) {
    reportError('删除全部表格失败', e)
  }
}

// 删除文档中全部表格题注（含标签）
// 1）按位置：找紧贴表格上/下的段落（允许 1～80 字符偏移，因插入题注后存在 off-by-one）
// 2）仅删除表格题注/标签样式的段落（表1、Table 1、附表等）
// 3）若按位置未找到任何题注，则按模式全文档扫描匹配表题注/标签的段落并删除
// 4）跳过表格内段落，去重后从后往前删
function deleteAllTableCaptions() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return
    }
    const tables = doc.Tables
    if (!tables || tables.Count === 0) {
      alert('文档中没有表格')
      return
    }
    const paragraphs = doc.Paragraphs
    if (!paragraphs || paragraphs.Count === 0) {
      alert('文档中没有找到表格题注')
      return
    }

    const MAX_GAP = 80
    const wdParagraph = 4
    const toDelete = new Map() // "start,end" -> { range, start }

    function inTable(para) {
      try {
        return !!(para.Range.Tables && para.Range.Tables.Count > 0)
      } catch (e) {
        return false
      }
    }

    function add(para) {
      if (!para || !para.Range) return
      if (inTable(para)) return
      const pStart = para.Range.Start
      const pEnd = para.Range.End
      const key = `${pStart},${pEnd}`
      if (!toDelete.has(key)) toDelete.set(key, { range: para.Range, start: pStart })
    }

    function getPrevPara(tStart) {
      try {
        const pos = Math.max(0, tStart - 1)
        const r = doc.Range(pos, pos)
        r.MoveStart(wdParagraph, -1)
        r.MoveEnd(wdParagraph, 1)
        if (r.Paragraphs && r.Paragraphs.Count > 0) {
          return r.Paragraphs.Item(1)
        }
      } catch (e) {}
      return null
    }

    function getNextPara(tEnd) {
      try {
        const r = doc.Range(tEnd, tEnd)
        r.MoveEnd(wdParagraph, 1)
        if (r.Paragraphs && r.Paragraphs.Count > 0) {
          return r.Paragraphs.Item(1)
        }
      } catch (e) {}
      return null
    }

    function matchCaption(para, gap, index) {
      if (!para || !para.Range) return { ok: false }
      if (inTable(para)) return { ok: false }
      if (gap < 1 || gap > MAX_GAP) return { ok: false }
      const text = para.Range.Text || ''
      const numbered = isTableCaptionWithIndex(text, index)
      const plain = isTableCaptionOrLabelLike(text)
      return { ok: numbered || plain, numbered, para }
    }

    // 按位置：仅检查表格上/下方相邻段落（快速定位）
    // 优先匹配“自上而下编号”的题注（表1、Table 1、附表1...）
    for (let ti = 1; ti <= tables.Count; ti++) {
      try {
        const tblRange = tables.Item(ti).Range
        if (!tblRange) continue
        const tStart = tblRange.Start
        const tEnd = tblRange.End
        const prevPara = getPrevPara(tStart)
        const nextPara = getNextPara(tEnd)
        let prevMatch = { ok: false }
        let nextMatch = { ok: false }
        if (prevPara && prevPara.Range) {
          const gapAbove = tStart - prevPara.Range.End
          prevMatch = matchCaption(prevPara, gapAbove, ti)
        }
        if (nextPara && nextPara.Range) {
          const gapBelow = nextPara.Range.Start - tEnd
          nextMatch = matchCaption(nextPara, gapBelow, ti)
        }
        if (prevMatch.ok) add(prevMatch.para)
        if (nextMatch.ok) add(nextMatch.para)
      } catch (e) {
        console.warn(`遍历表格${ti} 失败:`, e)
      }
    }

    // 若未找到任何按位置的题注，则按模式全文档扫描（仅表题注：表、Table、附表）
    if (toDelete.size === 0) {
      const bodyParas = []
      for (let pi = 1; pi <= paragraphs.Count; pi++) {
        try {
          const para = paragraphs.Item(pi)
          if (!para || !para.Range) continue
          if (inTable(para)) continue
          const text = (para.Range.Text || '').replace(/[\r\n]+/g, '\r')
          bodyParas.push({ para, text })
        } catch (e) {}
      }
      for (const p of bodyParas) {
        if (isTableCaptionOrLabelLike(p.text)) add(p.para)
      }
    }

    const list = [...toDelete.values()].sort((a, b) => b.start - a.start)
    let deletedCount = 0
    for (const { range } of list) {
      try {
        range.Delete()
        deletedCount++
      } catch (e) {
        console.warn('删除题注/标签段落失败:', e)
      }
    }

    if (deletedCount > 0) {
      alert('已删除 ' + deletedCount + ' 个表格题注（含标签）')
    } else {
      alert('文档中没有找到表格题注')
    }
  } catch (e) {
    reportError('删除表格题注失败', e)
  }
}

// 删除文档中全部图像（嵌入式 + 浮动型）
function deleteAllImages() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return
    }
    let deletedCount = 0

    function isPictureInlineShape(inlineShape) {
      if (!inlineShape || !inlineShape.Range) return false
      try {
        const t = inlineShape.Type
        if (t === 3 || t === 4) return true
        if (inlineShape.PictureFormat) return true
        return false
      } catch (e) {
        return false
      }
    }

    // 1. 删除嵌入式图片：收集范围，按起始位置倒序删除
    const inlineShapes = doc.InlineShapes
    if (inlineShapes && inlineShapes.Count > 0) {
      const ranges = []
      for (let i = 1; i <= inlineShapes.Count; i++) {
        try {
          const s = inlineShapes.Item(i)
          if (s && s.Range && isPictureInlineShape(s)) {
            ranges.push({ start: s.Range.Start, end: s.Range.End })
          }
        } catch (e) {
          console.warn('获取内嵌图片失败:', e)
        }
      }
      ranges.sort((a, b) => b.start - a.start)
      for (const { start, end } of ranges) {
        try {
          const r = doc.Range(start, end)
          r.Delete()
          deletedCount++
        } catch (e) {
          console.warn('删除内嵌图片失败:', e)
        }
      }
    }

    // 2. 删除浮动型图片：收集索引，从后往前删除
    const shapes = doc.Shapes
    if (shapes && shapes.Count > 0) {
      const indices = []
      for (let i = 1; i <= shapes.Count; i++) {
        try {
          const shape = shapes.Item(i)
          if (!shape) continue
          const type = shape.Type
          if (type === 13 || type === 1) indices.push(i)
        } catch (e) {
          console.warn('获取浮动图片失败:', e)
        }
      }
      indices.sort((a, b) => b - a)
      for (const idx of indices) {
        try {
          shapes.Item(idx).Delete()
          deletedCount++
        } catch (e) {
          console.warn('删除浮动图片失败:', e)
        }
      }
    }

    if (deletedCount > 0) {
      alert('已删除 ' + deletedCount + ' 个图像')
    } else {
      alert('文档中没有图片')
    }
  } catch (e) {
    reportError('删除全部图像失败', e)
  }
}

// 删除文档中全部图像题注（含标签）
// 1）按位置：找紧贴图像上/下的段落（允许 1～80 字符偏移）
// 2）仅删除图像题注/标签样式的段落（图1、Figure 1、附图等）
// 3）若按位置未找到任何题注，则按模式全文档扫描匹配图题注/标签的段落并删除
// 4）跳过表格内段落，去重后从后往前删
function deleteAllImageCaptions() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return
    }
    const paragraphs = doc.Paragraphs
    if (!paragraphs || paragraphs.Count === 0) {
      alert('文档中没有找到图像题注')
      return
    }

    const MAX_GAP = 80
    const wdParagraph = 4
    const toDelete = new Map() // "start,end" -> { range, start }

    function inTable(para) {
      try {
        return !!(para.Range.Tables && para.Range.Tables.Count > 0)
      } catch (e) {
        return false
      }
    }

    function add(para) {
      if (!para || !para.Range) return
      if (inTable(para)) return
      const pStart = para.Range.Start
      const pEnd = para.Range.End
      const key = `${pStart},${pEnd}`
      if (!toDelete.has(key)) toDelete.set(key, { range: para.Range, start: pStart })
    }

    function getPrevPara(tStart) {
      try {
        const pos = Math.max(0, tStart - 1)
        const r = doc.Range(pos, pos)
        r.MoveStart(wdParagraph, -1)
        r.MoveEnd(wdParagraph, 1)
        if (r.Paragraphs && r.Paragraphs.Count > 0) {
          return r.Paragraphs.Item(1)
        }
      } catch (e) {}
      return null
    }

    function getNextPara(tEnd) {
      try {
        const r = doc.Range(tEnd, tEnd)
        r.MoveEnd(wdParagraph, 1)
        if (r.Paragraphs && r.Paragraphs.Count > 0) {
          return r.Paragraphs.Item(1)
        }
      } catch (e) {}
      return null
    }

    function matchCaption(para, gap, index) {
      if (!para || !para.Range) return { ok: false }
      if (inTable(para)) return { ok: false }
      if (gap < 1 || gap > MAX_GAP) return { ok: false }
      const text = para.Range.Text || ''
      const numbered = isImageCaptionWithIndex(text, index)
      const plain = isImageCaptionOrLabelLike(text)
      return { ok: numbered || plain, numbered, para }
    }

    // 收集所有图像在文档中的位置（按起始位置排序，用于自上而下编号）
    const imageRanges = []
    const inlineShapes = doc.InlineShapes
    if (inlineShapes && inlineShapes.Count > 0) {
      for (let i = 1; i <= inlineShapes.Count; i++) {
        try {
          const s = inlineShapes.Item(i)
          if (s && s.Range) {
            imageRanges.push({ start: s.Range.Start, end: s.Range.End })
          }
        } catch (e) {
          console.warn('获取内嵌图片位置失败:', e)
        }
      }
    }
    const shapes = doc.Shapes
    if (shapes && shapes.Count > 0) {
      for (let i = 1; i <= shapes.Count; i++) {
        try {
          const shape = shapes.Item(i)
          if (!shape) continue
          // 仅处理图片类型（Type = 13 表示 msoPicture）
          const type = shape.Type
          if (type !== 13 && type !== 1) continue
          const anchor = shape.Anchor
          if (anchor) {
            imageRanges.push({ start: anchor.Start, end: anchor.End })
          }
        } catch (e) {
          console.warn('获取浮动图片位置失败:', e)
        }
      }
    }
    imageRanges.sort((a, b) => a.start - b.start)

    if (imageRanges.length === 0) {
      // 文档中无图片时，仅做全文档模式扫描
    } else {
      // 按位置：仅检查图像上/下方相邻段落，优先匹配“自上而下编号”的题注（图1、Figure 1、附图1...）
      for (let ii = 0; ii < imageRanges.length; ii++) {
        const index = ii + 1
        const { start: tStart, end: tEnd } = imageRanges[ii]
        try {
          const prevPara = getPrevPara(tStart)
          const nextPara = getNextPara(tEnd)
          let prevMatch = { ok: false }
          let nextMatch = { ok: false }
          if (prevPara && prevPara.Range) {
            const gapAbove = tStart - prevPara.Range.End
            prevMatch = matchCaption(prevPara, gapAbove, index)
          }
          if (nextPara && nextPara.Range) {
            const gapBelow = nextPara.Range.Start - tEnd
            nextMatch = matchCaption(nextPara, gapBelow, index)
          }
          if (prevMatch.ok) add(prevMatch.para)
          if (nextMatch.ok) add(nextMatch.para)
        } catch (e) {
          console.warn(`遍历图像${index} 失败:`, e)
        }
      }
    }

    // 若未找到任何按位置的题注，则按模式全文档扫描（仅图题注：图、Figure、附图）
    if (toDelete.size === 0) {
      const bodyParas = []
      for (let pi = 1; pi <= paragraphs.Count; pi++) {
        try {
          const para = paragraphs.Item(pi)
          if (!para || !para.Range) continue
          if (inTable(para)) continue
          const text = (para.Range.Text || '').replace(/[\r\n]+/g, '\r')
          bodyParas.push({ para, text })
        } catch (e) {}
      }
      for (const p of bodyParas) {
        if (isImageCaptionOrLabelLike(p.text)) add(p.para)
      }
    }

    const list = [...toDelete.values()].sort((a, b) => b.start - a.start)
    let deletedCount = 0
    for (const { range } of list) {
      try {
        range.Delete()
        deletedCount++
      } catch (e) {
        console.warn('删除题注/标签段落失败:', e)
      }
    }

    if (deletedCount > 0) {
      alert('已删除 ' + deletedCount + ' 个图像题注（含标签）')
    } else {
      alert('文档中没有找到图像题注')
    }
  } catch (e) {
    reportError('删除图像题注失败', e)
  }
}

// 删除文档中全部空白行（空白段落）
// 遍历 doc.Paragraphs，倒序删除仅含段落符或仅含空白字符的段落；跳过表格内段落
function deleteAllBlankRows() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return
    }

    const paragraphs = doc.Paragraphs
    if (!paragraphs || paragraphs.Count === 0) {
      alert('文档中没有段落')
      return
    }

    let deletedCount = 0
    // 倒序遍历，避免删除后索引错位导致遗漏或越界
    for (let i = paragraphs.Count; i >= 1; i--) {
      try {
        const para = paragraphs.Item(i)
        if (!para || !para.Range) continue

        // 跳过表格内的段落，避免影响表格结构
        let inTable = false
        try {
          if (para.Range.Tables && para.Range.Tables.Count > 0) {
            inTable = true
          }
        } catch (e) {}
        if (inTable) continue

        const raw = para.Range.Text || ''
        // 去除段落符、换行、制表符、空格等，判断是否为空
        const trimmed = raw.replace(/[\r\n\t \u00A0]+/g, '')
        if (trimmed.length === 0) {
          para.Range.Delete()
          deletedCount++
        }
      } catch (e) {
        console.warn(`删除第 ${i} 段时出错:`, e)
      }
    }

    if (deletedCount > 0) {
      alert('已删除 ' + deletedCount + ' 个空白行')
    } else {
      alert('文档中没有找到空白行')
    }
  } catch (e) {
    reportError('删除空白行失败', e)
  }
}

// 导出全部图像到文件夹
// 参照标准实现，使用PictureFormat.Export方法
function exportAllImagesToFolder() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return
    }
    
    // 1. 选择保存文件夹
    let savePath = null
    try {
      // 使用FileDialog选择文件夹 (4 = msoFileDialogFolderPicker)
      const fileDialog = window.Application.FileDialog(4)
      fileDialog.Title = '请选择要保存图像的文件夹'
      fileDialog.InitialFileName = doc.Path || ''
      
      if (fileDialog.Show() === -1) { // -1 表示用户点击了确定
        savePath = fileDialog.SelectedItems.Item(1)
      } else {
        // 用户取消了对话框
        return
      }
    } catch (e) {
      console.log('使用FileDialog失败，尝试使用文件保存对话框:', e)
      // 如果FileDialog不可用，使用变通方法
      try {
        let docName = doc.Name || '导出图像'
        if (docName.lastIndexOf('.') > 0) {
          docName = docName.substring(0, docName.lastIndexOf('.'))
        }
        const defaultFileName = docName + '_图像导出_临时.txt'
        
        let filePath = window.Application.GetSaveAsFileName(
          defaultFileName,
          '文本文件 (*.txt), *.txt',
          1,
          '选择保存图像的文件夹（选择任意文件名即可，将使用文件夹路径）',
          '确定'
        )
        
        if (!filePath || filePath === false) {
          return
        }
        
        const fso = new ActiveXObject('Scripting.FileSystemObject')
        savePath = fso.GetParentFolderName(filePath)
      } catch (e2) {
        reportError('获取文件夹路径失败', e2)
        return
      }
    }
    
    if (!savePath) {
      return
    }
    
    // 2. 统一路径格式：将反斜杠转换为正斜杠（WPS推荐使用正斜杠）
    savePath = savePath.replace(/\\/g, '/')
    if (!savePath.endsWith('/')) {
      savePath = savePath + '/'
    }
    
    // 3. 设置导出格式（优先使用可用的导出API）
    let format = 'png'
    format = format.toLowerCase()
    // 注意：如果导出API不可用，会回退到EnhMetaFileBits（导出为EMF格式）
    
    // 4. 创建保存文件夹（如果不存在）
    try {
      // 尝试使用WPS的Files API（如果存在）
      if (typeof Files !== 'undefined' && Files.exists && Files.createDirectory) {
        if (!Files.exists(savePath)) {
          Files.createDirectory(savePath)
          console.log('创建文件夹（使用Files API）：' + savePath)
        }
      } else {
        // 使用FSO作为备选方案
        const fso = new ActiveXObject('Scripting.FileSystemObject')
        // 将正斜杠转回反斜杠用于FSO
        const fsoPath = savePath.replace(/\//g, '\\')
        if (!fso.FolderExists(fsoPath)) {
          fso.CreateFolder(fsoPath)
          console.log('创建文件夹（使用FSO）：' + fsoPath)
        }
      }
    } catch (e) {
      console.warn('创建文件夹失败或文件夹已存在:', e.message)
    }
    
    // 5. 获取文档中的所有图片
    const inlineShapes = doc.InlineShapes // 嵌入式图片
    const shapes = doc.Shapes // 浮动型图片
    let imageCount = 0 // 统计导出图片数量
    let errorCount = 0 // 统计失败数量
    let errorMessages = [] // 收集错误信息
    
    console.log(`开始导出图片，内嵌图片数量: ${inlineShapes ? inlineShapes.Count : 0}, 浮动图片数量: ${shapes ? shapes.Count : 0}`)

    // 6. 统一导出尝试：优先API导出，失败再回退EMF
    function tryExportWithApi(target, fullPath, formatLabel) {
      if (!target) {
        return { ok: false, error: '没有导出目标对象' }
      }

      const errors = []
      const tryCall = (fn, method) => {
        try {
          fn()
          return { ok: true, method }
        } catch (e) {
          errors.push(`${method}: ${e.message || e}`)
          return null
        }
      }

      // 1) SaveAsPicture（WPS/Word常见）
      if (typeof target.SaveAsPicture === 'function') {
        const res = tryCall(() => target.SaveAsPicture(fullPath), 'SaveAsPicture')
        if (res) return res
      }

      // 2) PictureFormat.Export（标准实现）
      if (target.PictureFormat && typeof target.PictureFormat.Export === 'function') {
        const res = tryCall(() => target.PictureFormat.Export(fullPath), 'PictureFormat.Export')
        if (res) return res
        const resWithFormat = tryCall(
          () => target.PictureFormat.Export(fullPath, formatLabel),
          'PictureFormat.Export(format)'
        )
        if (resWithFormat) return resWithFormat
      }

      // 3) Shape.Export（部分WPS/Office支持）
      if (typeof target.Export === 'function') {
        const res = tryCall(() => target.Export(fullPath), 'Shape.Export')
        if (res) return res
      }

      return { ok: false, error: errors.join('; ') }
    }

    function canExportInlineShape(inlineShape) {
      if (!inlineShape) return false
      if (typeof inlineShape.SaveAsPicture === 'function') return true
      if (inlineShape.PictureFormat && typeof inlineShape.PictureFormat.Export === 'function') {
        return true
      }
      return !!(inlineShape.Range && inlineShape.Range.EnhMetaFileBits)
    }
    
    // 7. 导出嵌入式图片（InlineShapes）
    if (inlineShapes && inlineShapes.Count > 0) {
      for (let i = 1; i <= inlineShapes.Count; i++) {
        try {
          const inlineShape = inlineShapes.Item(i)
          console.log(`检查内嵌图片 ${i}, Type: ${inlineShape.Type}`)
          
          // WPS 中内嵌图片的 Type 可能不等于 1，优先判断可导出能力
          if (canExportInlineShape(inlineShape)) {
            imageCount++
            const imgName = `嵌入式图片_${imageCount}.${format}`
            const fullPath = savePath + imgName
            
            console.log(`尝试导出: ${fullPath}`)
            
            // 优先使用API导出
            try {
              const apiResult = tryExportWithApi(inlineShape, fullPath, format)
              if (apiResult.ok) {
                console.log(`✓ 导出成功（${apiResult.method}）：${imgName}`)
                continue
              }
              if (apiResult.error) {
                console.warn(`API导出失败，回退EMF：${apiResult.error}`)
              }

              // 使用Range.EnhMetaFileBits + ADODB.Stream方法保存图片
              // 检查Range是否存在
              if (!inlineShape.Range) {
                throw new Error('没有 Range 属性')
              }
              
              // 获取图像的元文件数据
              const imageData = inlineShape.Range.EnhMetaFileBits
              if (!imageData) {
                throw new Error('无法获取 EnhMetaFileBits 数据')
              }
              
              // 将正斜杠路径转换为反斜杠用于文件操作
              const fullPathForFile = fullPath.replace(/\//g, '\\')
              
              // 使用ADODB.Stream保存图像
              const imageStream = new ActiveXObject('ADODB.Stream')
              imageStream.Type = 1 // 1 = adTypeBinary
              imageStream.Open()
              imageStream.Write(imageData)
              imageStream.SaveToFile(fullPathForFile, 2) // 2 = adSaveCreateOverWrite
              imageStream.Close()
              
              console.log(`✓ 导出成功：${imgName}`)
            } catch (exportError) {
              const errorMsg = `导出嵌入式图片 ${i} 失败: ${exportError.message || exportError}`
              console.error(errorMsg)
              errorMessages.push(errorMsg)
              errorCount++
            }
          } else {
            console.log(`跳过内嵌对象 ${i}，类型 ${inlineShape.Type} 不支持导出`)
          }
        } catch (e) {
          const errorMsg = `处理内嵌图片 ${i} 时出错: ${e.message || e}`
          console.error(errorMsg)
          errorMessages.push(errorMsg)
          errorCount++
        }
      }
    }
    
    // 8. 导出浮动型图片（Shapes）
    if (shapes && shapes.Count > 0) {
      for (let i = 1; i <= shapes.Count; i++) {
        try {
          const shape = shapes.Item(i)
          console.log(`检查浮动图片 ${i}, Type: ${shape.Type}`)
          
          // 仅处理图片类型（Type = 13 表示 msoPicture）
          if (shape.Type === 13) {
            imageCount++
            const imgName = `浮动型图片_${imageCount}.${format}`
            const fullPath = savePath + imgName
            
            console.log(`尝试导出: ${fullPath}`)
            
            // 优先使用API导出
            try {
              const apiResult = tryExportWithApi(shape, fullPath, format)
              if (apiResult.ok) {
                console.log(`✓ 导出成功（${apiResult.method}）：${imgName}`)
                continue
              }
              if (apiResult.error) {
                console.warn(`API导出失败，回退EMF：${apiResult.error}`)
              }

              // 使用Range.EnhMetaFileBits + ADODB.Stream方法保存图片
              // 对于浮动图片，先选中它
              shape.Select()
              const selection = window.Application.Selection
              
              if (!selection || !selection.Range) {
                throw new Error('无法选中图片或获取 Range')
              }
              
              // 获取图像的元文件数据
              const imageData = selection.Range.EnhMetaFileBits
              if (!imageData) {
                throw new Error('无法获取 EnhMetaFileBits 数据')
              }
              
              // 将正斜杠路径转换为反斜杠用于文件操作
              const fullPathForFile = fullPath.replace(/\//g, '\\')
              
              // 使用ADODB.Stream保存图像
              const imageStream = new ActiveXObject('ADODB.Stream')
              imageStream.Type = 1 // 1 = adTypeBinary
              imageStream.Open()
              imageStream.Write(imageData)
              imageStream.SaveToFile(fullPathForFile, 2) // 2 = adSaveCreateOverWrite
              imageStream.Close()
              
              console.log(`✓ 导出成功：${imgName}`)
            } catch (exportError) {
              const errorMsg = `导出浮动型图片 ${i} 失败: ${exportError.message || exportError}`
              console.error(errorMsg)
              errorMessages.push(errorMsg)
              errorCount++
            }
          } else {
            console.log(`跳过浮动图片 ${i}，类型 ${shape.Type} 不是图片类型`)
          }
        } catch (e) {
          const errorMsg = `处理浮动图片 ${i} 时出错: ${e.message || e}`
          console.error(errorMsg)
          errorMessages.push(errorMsg)
          errorCount++
        }
      }
    }
    
    // 8. 导出完成提示
    const successCount = imageCount - errorCount
    if (imageCount === 0) {
      alert('未在文档中找到任何图片！\n\n提示：请确保文档中包含图片，且图片类型为嵌入式（Type=1）或浮动型（Type=13）')
    } else if (errorCount > 0) {
      let errorInfo = `找到 ${imageCount} 张图片，成功导出 ${successCount} 张，失败 ${errorCount} 张\n\n保存路径：${savePath}\n\n错误详情：\n${errorMessages.slice(0, 5).join('\n')}`
      if (errorMessages.length > 5) {
        errorInfo += `\n...还有 ${errorMessages.length - 5} 个错误，请查看控制台`
      }
      alert(errorInfo)
      console.error('所有错误信息:', errorMessages)
    } else {
      alert(`成功导出 ${successCount} 张图片！\n保存路径：${savePath}`)
      // 可选：打开保存文件夹
      try {
        // 将正斜杠转回反斜杠用于FollowHyperlink
        const hyperlinkPath = savePath.replace(/\//g, '\\')
        window.Application.FollowHyperlink(hyperlinkPath)
      } catch (e) {
        console.log('无法打开文件夹:', e.message)
      }
    }
    
  } catch (e) {
    console.error('导出图片失败：', e.message)
    alert(`导出失败！错误信息：${e.message}`)
  }
}

// 固定表单输入：切换编辑模式
// 开启时将书签范围转为内容控件，仅可编辑书签/表单域/内容控件，其余变灰
// 再次点击关闭，全部可编辑，并移除由书签生成的临时内容控件
const FORM_CC_TAG_PREFIX = 'nd_bm_cc_'
const FORM_MODE_VAR_NAME = 'NdFormMode'

function invalidateFormFillButton() {
  try {
    if (window.Application?.ribbonUI) {
      window.Application.ribbonUI.InvalidateControl('btnAssistFill')
    }
  } catch (e) {}
}

/**
 * P0:用户在设置里调整助手显示位置后,主动刷新 4 个 PrimarySlot 与右键 4 个 Slot,
 * 让未配置位立刻 visible=false(Ribbon 不再展示 4 个重复的"智能助手"按钮)。
 *
 * 调用点(后续接入):
 *   - 设置对话框保存助手 displayLocations 后
 *   - 自定义助手新增/删除/重排后
 */
function invalidateAssistantSlotControls() {
  try {
    const ribbonUI = window.Application?.ribbonUI
    if (!ribbonUI) return
    for (let i = 1; i <= RIBBON_DYNAMIC_SLOT_COUNT; i++) {
      ribbonUI.InvalidateControl(`btnAssistantPrimarySlot${i}`)
    }
    for (let i = 1; i <= CONTEXT_MENU_DYNAMIC_SLOT_COUNT; i++) {
      ribbonUI.InvalidateControl(`btnContextAssistantSlot${i}`)
      ribbonUI.InvalidateControl(`btnContextAssistantSlot${i}TableCell`)
    }
    ribbonUI.InvalidateControl('menuMoreAssistants')
    ribbonUI.InvalidateControl('menuContextAssistantMore')
    ribbonUI.InvalidateControl('menuContextAssistantMoreTableCell')
  } catch (e) {}
}

function OnDocumentOpenForFormMode(doc) {
  invalidateFormFillButton()
  invalidateDeclassifyRibbonControls()
}

function OnWindowActivateForFormMode(doc, win) {
  invalidateFormFillButton()
  invalidateDeclassifyRibbonControls()
}

// 文档保存前事件：如果是新文件（从模板创建），强制另存为
function OnDocumentBeforeSave(doc, saveAsUI, cancel) {
  try {
    if (!doc || !isNewFile(doc)) return
    cancel.Value = true
    const app = window.Application
    if (!app) return
    const path = getDocumentSaveAsPath(doc)
    if (!path) return
    const wdFormatXMLDocument = app.Enum?.wdFormatXMLDocument ?? 12
    try {
      doc.SaveAs2(path, wdFormatXMLDocument)
      setNewFileMarker(doc, false)
    } catch (e) {
      console.error('另存文档失败:', e)
      alert('另存文档失败：' + (e?.message || '未知错误'))
    }
  } catch (e) {
    console.error('OnDocumentBeforeSave:', e)
  }
}

// 从文档读取表单模式状态（保护类型优先，文档变量作为持久化存储）
function isFormModeFromDocument(doc) {
  if (!doc) return false
  try {
    const wdAllowOnlyFormFields = window.Application.Enum?.wdAllowOnlyFormFields ?? 2
    const pt = doc.ProtectionType
    if (pt === wdAllowOnlyFormFields || pt === 2) return true
    const vars = doc.Variables
    if (vars) {
      try {
        const v = vars.Item(FORM_MODE_VAR_NAME)
        return v && String(v.Value || '') === '1'
      } catch (e) {}
    }
  } catch (e) {}
  return false
}

// 将表单模式状态存入文档（随文档保存，打开时即可读取）
function setFormModeVariable(doc, isFormMode) {
  if (!doc || !doc.Variables) return
  try {
    if (isFormMode) {
      try {
        const v = doc.Variables.Item(FORM_MODE_VAR_NAME)
        if (v) v.Value = '1'
      } catch (e) {
        doc.Variables.Add(FORM_MODE_VAR_NAME, '1')
      }
    } else {
      try {
        const v = doc.Variables.Item(FORM_MODE_VAR_NAME)
        if (v) v.Delete()
      } catch (e) {}
    }
  } catch (e) {
    console.warn('setFormModeVariable:', e)
  }
}

// 获取文档另存为路径（弹出另存为对话框，支持 .aidocx 和 .docx）
function getDocumentSaveAsPath(doc) {
  const app = window.Application
  if (!app || !doc) return null
  let docName = (doc.Name || '文档').toString()
  const lastDot = docName.lastIndexOf('.')
  if (lastDot > 0) docName = docName.substring(0, lastDot)
  const defaultFileName = docName + '.aidocx'
  function normalizePath(p) {
    if (!p || typeof p !== 'string') return p
    return String(p).replace(/^file:\/\/\/?/i, '').replace(/\\/g, '/')
  }
      const fileFilter = '察元文档 (*.aidocx), *.aidocx, Word文档 (*.docx), *.docx'
  try {
    if (typeof app.GetSaveAsFileName === 'function') {
      const path = app.GetSaveAsFileName(defaultFileName, fileFilter, 1, '另存文档', '保存')
      if (path && path !== false) {
        let p = normalizePath(String(path))
        if (!p.toLowerCase().endsWith('.aidocx') && !p.toLowerCase().endsWith('.docx')) {
          p = p + (p.endsWith('.') ? '' : '.') + 'aidocx'
        }
        return p
      }
      return null
    }
  } catch (e) {
    console.warn('GetSaveAsFileName 不可用，尝试 FileDialog:', e?.message)
  }
  try {
    const fileDialog = app.FileDialog(2)
    fileDialog.Title = '另存文档'
    fileDialog.InitialFileName = defaultFileName
    fileDialog.Filters.Clear()
        fileDialog.Filters.Add('察元文档', '*.aidocx', 1)
    fileDialog.Filters.Add('Word文档', '*.docx', 2)
    fileDialog.FilterIndex = 1
    if (fileDialog.Show() === -1) {
      const item = fileDialog.SelectedItems.Item(1)
      if (!item) return null
      let p = normalizePath(String(item))
      if (!p.toLowerCase().endsWith('.aidocx') && !p.toLowerCase().endsWith('.docx')) {
        p = p + (p.endsWith('.') ? '' : '.') + 'aidocx'
      }
      return p
    }
  } catch (e) {
    console.error('getDocumentSaveAsPath:', e)
  }
  return null
}

function toggleFormInputMode() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('请先打开文档')
      return
    }

    const wdAllowOnlyFormFields = window.Application.Enum?.wdAllowOnlyFormFields ?? 2
    const wdContentControlText = window.Application.Enum?.wdContentControlText ?? 1

    const protectionType = doc.ProtectionType
    const isFormProtected = (protectionType === wdAllowOnlyFormFields || protectionType === 2)

    if (isFormProtected) {
      doc.Unprotect('')
      removeBookmarkContentControls(doc)
      setFormModeVariable(doc, false)
      invalidateFormFillButton()
      alert('已退出表单模式，文档全部内容可编辑')
    } else {
      doc.Unprotect('')
      const ccCount = wrapBookmarksInContentControls(doc, wdContentControlText)
      doc.Protect(wdAllowOnlyFormFields, true, '')
      setFormModeVariable(doc, true)
      invalidateFormFillButton()
      const hint = ccCount > 0
        ? `\n\n已将 ${ccCount} 个书签区域设为可编辑。`
        : '\n\n提示：可先插入书签，或在文档中使用表单域/内容控件作为可编辑区域。'
      alert('已进入表单模式，仅可编辑书签区域、表单域、内容控件，其他内容已锁定。' + hint)
      // 进入表单模式后自动打开右侧表单编辑任务窗格
      try {
        showTaskPane('right', '/taskpane-right')
      } catch (e) {
        console.warn('打开右侧任务窗格失败:', e)
      }
    }
  } catch (e) {
    reportError('固定表单输入切换失败', e)
  }
}

// 将书签范围包裹为内容控件（正常显示，不修改任何格式）
function wrapBookmarksInContentControls(doc, wdContentControlText) {
  let count = 0
  try {
    const bookmarks = doc.Bookmarks
    if (!bookmarks || bookmarks.Count === 0) return 0

    const wdContentControlType = wdContentControlText || 1
    const items = []
    for (let i = 1; i <= bookmarks.Count; i++) {
      try {
        const bm = bookmarks.Item(i)
        if (!bm || bm.Empty) continue
        const name = bm.Name || ''
        if (!name || name.indexOf('_') === 0) continue
        const rng = bm.Range
        if (!rng) continue
        items.push({ name, start: rng.Start, end: rng.End })
      } catch (e) {}
    }
    items.sort((a, b) => b.start - a.start)
    for (const it of items) {
      try {
        const rng = doc.Range(it.start, it.end)
        if (!rng) continue
        const cc = doc.ContentControls.Add(wdContentControlType, rng)
        if (cc) {
          cc.Tag = FORM_CC_TAG_PREFIX + it.name
          cc.Appearance = 2
          count++
        }
      } catch (e) {
        console.warn('书签转内容控件失败:', it.name, e)
      }
    }
  } catch (e) {
    console.error('wrapBookmarksInContentControls:', e)
  }
  return count
}

// 移除由书签生成的临时内容控件
function removeBookmarkContentControls(doc) {
  try {
    const ccs = doc.ContentControls
    if (!ccs || ccs.Count === 0) return
    const toRemove = []
    for (let i = 1; i <= ccs.Count; i++) {
      try {
        const cc = ccs.Item(i)
        if (cc && cc.Tag && String(cc.Tag).indexOf(FORM_CC_TAG_PREFIX) === 0) {
          toRemove.push(cc)
        }
      } catch (e) {}
    }
    for (const cc of toRemove) {
      try {
        cc.Delete(false)
      } catch (e) {}
    }
  } catch (e) {
    console.error('removeBookmarkContentControls:', e)
  }
}

function OnAction(control) {
  const eleId = control.Id
  switch (eleId) {
    // 关于分组
    case 'btnAboutChayuan':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/about-chayuan',
        '关于察元',
        720 * window.devicePixelRatio,
        640 * window.devicePixelRatio,
        false
      )
      break
    case 'btnAIWebsites':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/popup',
        'AI网址大全',
        600 * window.devicePixelRatio,
        500 * window.devicePixelRatio,
        false
      )
      break
    case 'btnRequirementCollection':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/popup',
        '需求征集',
        600 * window.devicePixelRatio,
        500 * window.devicePixelRatio,
        false
      )
      break
    
    // AI助手分组
    // P0 清理:btnAITraceCheck(大写 I)是 XML 中不存在的死分支;XML 中正确的是 btnAiTraceCheck。
    // 历史空 case 已移除,真实痕迹检查走下方 btnAiTraceCheck → executeAssistantFromRibbon('analysis.ai-trace-check')
    case 'btnAIAssistant': {
      showAIAssistantDialog()
      break
    }
    case 'btnTaskOrchestration':
      try {
        if (focusExistingTaskOrchestrationWindow()) {
          break
        }
        let orchestrationUrl = ''
        const screenWidth = Number(window.screen?.availWidth || window.screen?.width || window.innerWidth || 1600)
        const screenHeight = Number(window.screen?.availHeight || window.screen?.height || window.innerHeight || 980)
        // 根据屏幕宽高设置窗口尺寸：取 94% 宽、90% 高，并保证最小可用尺寸
        console.log(screenHeight,screenWidth)
        const dialogWidth = Math.max(1280, Math.min(1800, Math.floor(screenWidth * 1)))
        const dialogHeight = Math.max(820, Math.min(1200, Math.floor(screenHeight * 1)))
        try {
          const base = window.Application.PluginStorage.getItem('AddinBaseUrl')
          if (base && typeof base === 'string') {
            const clean = base.replace(/#.*$/, '').replace(/\/+$/, '')
            if (clean.startsWith('file:')) {
              orchestrationUrl = clean + '/index.html#/task-orchestration'
            } else {
              orchestrationUrl = clean + '/#/task-orchestration'
            }
          }
        } catch (e) {}
        if (!orchestrationUrl) {
          const base = Util.GetUrlPath()
          if (window.location.protocol === 'file:') {
            const sep = base.endsWith('/') ? '' : '/'
            orchestrationUrl = base + sep + 'index.html#/task-orchestration'
          } else {
            orchestrationUrl = base + Util.GetRouterHash() + '/task-orchestration'
          }
        }
        window.Application.ShowDialog(
          orchestrationUrl,
          '任务编排',
          dialogWidth * (window.devicePixelRatio || 1),
          dialogHeight * (window.devicePixelRatio || 1),
          false
        )
      } catch (e) {
        reportError('无法打开任务编排窗口', e, { context: { source: 'btnTaskOrchestration' } })
      }
      break
    case 'btnTaskList':
      try {
        if (focusExistingTaskListWindow()) {
          break
        }
        const href = String(window.location.href || '')
        const base = href.split('#')[0] || href
        const popupUrl = `${base}#/popup`
        window.Application.ShowDialog(
          popupUrl,
          '任务清单',
          980 * (window.devicePixelRatio || 1),
          720 * (window.devicePixelRatio || 1),
          false
        )
      } catch (e) {
        reportError('无法打开任务清单', e, { context: { source: 'btnTaskList' } })
      }
      break

    // 表格批量分组
    case 'btnSelectAllTables':
      // 导出全部表格功能
      exportAllTablesToExcel()
      break
    case 'btnDeleteAllTables':
      deleteAllTables()
      break
    case 'btnTableAutoWidth':
      autoFitAllTablesByContent()
      break
    case 'btnWindowAutoWidth':
      autoFitAllTablesByWindow()
      break
    case 'btnAutoRefreshStyle':
      refreshOtherTablesStyleFromFirst()
      break
    case 'btnDeleteTextRow':
      showDeleteTextDialog('row')
      break
    case 'btnDeleteTextColumn':
      showDeleteTextDialog('column')
      break
    case 'btnAppendReplaceText':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/append-replace-text',
        '追加或替换文字',
        340 * (window.devicePixelRatio || 1),
        320 * (window.devicePixelRatio || 1),
        false
      )
      break
    case 'btnAddFirstColNumber':
      addFirstColNumber()
      break
    case 'btnManualColWidth':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/manual-col-width',
        '手动列宽',
        420 * (window.devicePixelRatio || 1),
        380 * (window.devicePixelRatio || 1),
        false
      )
      break
    case 'btnFirstColStyle':
      showFirstColStyleDialog()
      break
    case 'btnFirstRowStyle':
      showFirstRowStyleDialog()
      break
    case 'btnAddTableCaption':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/table-caption',
        '添加或修改题注',
        320 * (window.devicePixelRatio || 1),
        260 * (window.devicePixelRatio || 1),
        false
      )
      break
    case 'btnDeleteTableCaption':
      deleteAllTableCaptions()
      break
    
    // 图像批量分组
    case 'btnSelectAllImages':
      exportAllImagesToFolder()
      break
    case 'btnDeleteAllImages':
      deleteAllImages()
      break
    case 'btnUniformImageFormat':
      showUniformImageFormatDialog()
      break
    case 'btnClearImageFormat':
      // P0 标注:此功能未实现,先给用户明确提示而不是静默无反应。
      // 真正实现请新建 documentImageActions.clearAllImageFormat(),并在此处调用。
      try {
        showSafeErrorDetail({
          title: '功能暂未上线',
          detail: '「清除图像格式」目前为占位入口,将在后续版本提供。\n\n替代方案:可使用「统一图像格式」对话框设置统一规则。',
          merge: false
        })
      } catch (_) {
        alert('「清除图像格式」目前为占位入口,将在后续版本提供。')
      }
      break
    case 'btnDeleteImageCaption':
      deleteAllImageCaptions()
      break
    case 'btnAddImageCaption':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/table-caption?mode=image',
        '添加或修改题注',
        320 * (window.devicePixelRatio || 1),
        260 * (window.devicePixelRatio || 1),
        false
      )
      break
    
    // 正文批量分组
    case 'btnSelectAllText':
      // 选中全部正文功能
      try {
        const doc = window.Application.ActiveDocument
        if (doc) {
          doc.Content.Select()
        }
      } catch (e) {
        console.error('选中全部正文失败:', e)
      }
      break
    // P0 清理:btnDocumentCheck 是 XML 中不存在的历史残留 case,已移除空函数。
    // 脱密分组
    case 'btnDocumentDeclassifyCheck':
      executeAssistantFromRibbon('analysis.security-check', { taskTitle: '保密检查' }).catch((e) => {
        reportError('保密检查失败', e)
      })
      break
    case 'btnDocumentDeclassify':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/document-declassify-dialog',
        '文档脱密',
        860 * (window.devicePixelRatio || 1),
        720 * (window.devicePixelRatio || 1),
        false
      )
      break
    case 'btnDocumentDeclassifyRestore':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/document-declassify-restore-dialog',
        '密码复原',
        420 * (window.devicePixelRatio || 1),
        320 * (window.devicePixelRatio || 1),
        false
      )
      break
    case 'btnDocumentRestore':
      // 文档还原功能
      break
    case 'btnCleanUnusedStyles':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/unused-styles-cleaner-dialog',
        '未使用样式清理',
        480 * (window.devicePixelRatio || 1),
        620 * (window.devicePixelRatio || 1),
        false
      )
      break
    case 'btnStyleStatistics':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/style-statistics-dialog',
        '样式使用统计',
        600 * (window.devicePixelRatio || 1),
        820 * (window.devicePixelRatio || 1),
        false
      )
      break
    case 'btnDeleteBlankRows':
      deleteAllBlankRows()
      break
    
    // 表单模板分组
    case 'btnTemplateCreate':
      showTaskPane('right', '/template-create')
      break
    case 'btnTemplateImport':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/template-import-dialog',
        '规则导入',
        400 * (window.devicePixelRatio || 1),
        320 * (window.devicePixelRatio || 1),
        false
      )
      break
    case 'btnTemplateExport':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/template-export-dialog',
        '导出规则',
        420 * (window.devicePixelRatio || 1),
        480 * (window.devicePixelRatio || 1),
        false
      )
      break
    case 'btnSettings':
      try {
        openSettingsWindow()
      } catch (e) {
        reportError('打开设置窗口失败', e)
      }
      break

    // 文档编辑分组：下载模板 - 弹出模板清单，选择后弹出文件保存对话框
    case 'btnDownloadTemplate':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/template-download-dialog',
        '下载模板',
        420 * (window.devicePixelRatio || 1),
        500 * (window.devicePixelRatio || 1),
        false
      )
      break
    case 'btnImportDocument':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/document-template-import',
        '导入模板',
        420 * (window.devicePixelRatio || 1),
        420 * (window.devicePixelRatio || 1),
        false
      )
      break
    case 'btnSaveDocument':
      try {
        const doc = window.Application?.ActiveDocument
        if (!doc) {
          alert('请先打开文档')
          break
        }
        const rules = loadRulesFromDoc()
        saveRulesToDoc(rules)
        const path = getDocumentSaveAsPath(doc)
        if (!path) break
        const wdFormatXMLDocument = window.Application.Enum?.wdFormatXMLDocument ?? 12
        doc.SaveAs2(path, wdFormatXMLDocument)
        if (isNewFile(doc)) setNewFileMarker(doc, false)
        alert('文档已另存为：\n' + path)
      } catch (e) {
        console.error('另存文档失败:', e)
        alert('另存文档失败：' + (e?.message || '未知错误'))
      }
      break
    case 'btnAssistFill':
      toggleFormInputMode()
      break
    case 'btnFormContentPreview':
      window.Application.ShowDialog(
        Util.GetUrlPath() + Util.GetRouterHash() + '/form-content-preview',
        '表单内容',
        520 * (window.devicePixelRatio || 1),
        420 * (window.devicePixelRatio || 1),
        false
      )
      break
    case 'btnDocumentAudit':
      {
        const auditUrl = `${Util.GetUrlPath() + Util.GetRouterHash()}/form-audit-dialog?_ts=${Date.now()}`
      window.Application.ShowDialog(
        auditUrl,
        '文档审计',
        880 * (window.devicePixelRatio || 1),
        760 * (window.devicePixelRatio || 1),
        false
      )
      }
      break
    
    // 文档审查分组
    case 'btnSpellGrammar':
      launchSpellCheckFromRibbon()
      break
    case 'btnGenerateSummary':
      executeAssistantFromRibbon('summary', { taskTitle: '生成摘要' }).catch((e) => {
        reportError('生成摘要失败', e)
      })
      break
    case 'btnRewrite':
      executeAssistantFromRibbon('analysis.rewrite', { taskTitle: '换种方式重写' }).catch((e) => {
        reportError('换种方式重写失败', e)
      })
      break
    case 'btnExpand':
      executeAssistantFromRibbon('analysis.expand', { taskTitle: '扩写' }).catch((e) => {
        reportError('扩写失败', e)
      })
      break
    case 'btnAbbreviate':
      executeAssistantFromRibbon('analysis.abbreviate', { taskTitle: '缩写' }).catch((e) => {
        reportError('缩写失败', e)
      })
      break
    case 'btnParagraphNumberingCheck':
      executeAssistantFromRibbon('analysis.paragraph-numbering-check', { taskTitle: '检查段落序号格式' }).catch((e) => {
        reportError('检查段落序号格式失败', e)
      })
      break
    case 'btnAiTraceCheck':
      executeAssistantFromRibbon('analysis.ai-trace-check', { taskTitle: 'AI 痕迹检查' }).catch((e) => {
        reportError('AI 痕迹检查失败', e)
      })
      break
    case 'btnCommentExplain':
      executeAssistantFromRibbon('analysis.comment-explain', { taskTitle: '批注解释' }).catch((e) => {
        reportError('批注解释失败', e)
      })
      break
    case 'btnHyperlinkExplain':
      executeAssistantFromRibbon('analysis.hyperlink-explain', { taskTitle: '超链接解释' }).catch((e) => {
        reportError('超链接解释失败', e)
      })
      break
    case 'btnCorrectSpellGrammar':
      executeAssistantFromRibbon('analysis.correct-spell', { taskTitle: '纠正拼写和语法' }).catch((e) => {
        reportError('纠正拼写和语法失败', e)
      })
      break
    case 'btnExtractKeywords':
      executeAssistantFromRibbon('analysis.extract-keywords', { taskTitle: '提炼关键词' }).catch((e) => {
        reportError('提炼关键词失败', e)
      })
      break
    case 'btnTextToImage':
      showAIAssistantDialog({
        from: 'context',
        multimodal: 'image',
        prompt: '请根据当前内容生成一张图片，如有必要先让我确认画幅比例等参数。',
        autoSend: '1'
      })
      break
    case 'btnTextToAudio':
      showAIAssistantDialog({
        from: 'context',
        multimodal: 'audio',
        prompt: '请根据当前内容生成语音，如有必要先让我确认语音风格等参数。',
        autoSend: '1'
      })
      break
    case 'btnTextToVideo':
      showAIAssistantDialog({
        from: 'context',
        multimodal: 'video',
        prompt: '请根据当前内容生成视频，如有必要先让我确认时长和画幅比例等参数。',
        autoSend: '1'
      })
      break
    default:
      if (eleId === 'btnCustomAssistantCreate') {
        openAssistantSettings('create-custom-assistant')
        break
      }
      if (eleId === 'btnCustomAssistantManage') {
        openAssistantSettings('create-custom-assistant')
        break
      }
      if (
        (eleId && eleId.startsWith('btnDisplayAssistant_')) ||
        (eleId && eleId.startsWith('btnAssistantPrimarySlot')) ||
        (eleId && eleId.startsWith('btnContextAssistantSlot')) ||
        (eleId && eleId.startsWith(RIBBON_MORE_ASSISTANT_CONTROL_PREFIX)) ||
        (eleId && eleId.startsWith(CONTEXT_MORE_ASSISTANT_CONTROL_PREFIX)) ||
        (eleId && eleId.startsWith(CONTEXT_TEXT_ANALYSIS_ASSISTANT_CONTROL_PREFIX)) ||
        (eleId && eleId.startsWith(CONTEXT_TEXT_ANALYSIS_MORE_ASSISTANT_CONTROL_PREFIX))
      ) {
        const entry = getAssistantForControl(eleId)
        if (!entry?.id) {
          alert('未找到该助手的显示配置，请先在设置中检查')
          break
        }
        executeConfiguredAssistant(entry.id, entry.title)
        break
      }
      // 翻译菜单：btnTranslate_xx
      if (eleId && eleId.startsWith('btnTranslate_')) {
        const langCode = getTranslateLanguageByControlId(eleId)
        const lang = TRANSLATION_LANGUAGES.find((l) => l.code === langCode)
        executeAssistantFromRibbon('translate', {
          taskTitle: `翻译${lang ? ` - ${lang.label}` : ''}`,
          targetLanguage: lang ? lang.label : (langCode || '目标语言')
        }).catch((e) => {
          reportError('翻译失败', e)
        })
      }
      break
      // P0 清理:已删除多余的 break(死代码)
  }
  return true
}

function getRibbonImageRelative(control) {
  const eleId = normalizeContextControlId(control.Id ?? control.id ?? '')
  // 模型选择：回显当前选中模型的图标（与察元AI编审设置中一致，使用 getModelLogoPath）
  if (eleId === 'menuModelSelect') {
    const model = getSelectedModel()
    if (model && model.id) {
      const path = getModelLogoPath(model.id)
      return path || 'images/model-select.svg'
    }
    return 'images/model-select.svg'
  }
  // 模型分组菜单图标（grp_0, grp_1, ...）- 使用分组下第一个模型的 logo，与设置中一致
  // 翻译菜单项（btnTranslate_xx）统一使用翻译图标
  if (eleId && eleId.startsWith('btnTranslate_')) {
    return 'images/ai-websites.svg'
  }
  if (eleId === 'btnCustomAssistantCreate' || eleId === 'btnCustomAssistantManage') {
    return 'images/add-to-assistant.svg'
  }
  if (eleId === 'btnCustomAssistantEmpty' || eleId === 'btnContextAssistantEmpty') {
    return 'images/add-to-assistant.svg'
  }
  if (
    (eleId && eleId.startsWith('btnDisplayAssistant_')) ||
    (eleId && eleId.startsWith('btnAssistantPrimarySlot')) ||
    (eleId && eleId.startsWith('btnContextAssistantSlot')) ||
    (eleId && eleId.startsWith(RIBBON_MORE_ASSISTANT_CONTROL_PREFIX)) ||
    (eleId && eleId.startsWith(CONTEXT_MORE_ASSISTANT_CONTROL_PREFIX)) ||
    (eleId && eleId.startsWith(CONTEXT_TEXT_ANALYSIS_ASSISTANT_CONTROL_PREFIX)) ||
    (eleId && eleId.startsWith(CONTEXT_TEXT_ANALYSIS_MORE_ASSISTANT_CONTROL_PREFIX))
  ) {
    const entry = getAssistantForControl(eleId)
    return getAssistantIconPath(entry?.id, entry)
  }
  const grpMatch = eleId.match(/^grp_(\d+)$/)
  if (grpMatch) {
    const gi = parseInt(grpMatch[1], 10)
    if (gi >= 0 && gi < MODEL_GROUPS.length) {
      const group = MODEL_GROUPS[gi]
      const firstModel = group.models && group.models[0]
      if (firstModel && firstModel.id) {
        const path = getModelLogoPath(firstModel.id)
        if (path) return path
      }
      return group.icon || 'images/ai-assistant.svg'
    }
  }
  const iconMap = {
    // 关于分组
    'btnAboutChayuan': 'images/about.svg',
    'btnAIWebsites': 'images/ai-websites.svg',
    'btnRequirementCollection': 'images/requirement.svg',
    'btnChayuanDiscussionGroup': 'images/discussion-group.svg',
    // AI助手分组（menuModelSelect 已在上方单独处理）
    'menuTableBatch': 'images/menu-table-batch.svg',
    'menuImageBatch': 'images/select-images.svg',
    'btnAIAssistant': 'images/ai-assistant.svg',
    'btnAITraceCheck': 'images/ai-trace-check.svg',
    'btnTaskList': 'images/report.svg',
    'btnTaskOrchestration': 'images/task-orchestration.svg',
    'menuMoreAssistants': 'images/add-to-assistant.svg',
    'menuContextAssistantMore': 'images/add-to-assistant.svg',
    // 表格批量分组
    'btnSelectAllTables': 'images/export-table.svg',
    'btnDeleteAllTables': 'images/delete-table.svg',
    'btnTableAutoWidth': 'images/table-width.svg',
    'btnWindowAutoWidth': 'images/window-width.svg',
    'btnAutoRefreshStyle': 'images/refresh.svg',
    'btnDeleteTextRow': 'images/delete-text-row.svg',
    'btnDeleteTextColumn': 'images/delete-text-column.svg',
    'btnAppendReplaceText': 'images/replace-text.svg',
    'btnAddFirstColNumber': 'images/number.svg',
    'btnManualColWidth': 'images/column-width.svg',
    'btnFirstColStyle': 'images/column-style.svg',
    'btnFirstRowStyle': 'images/row-style.svg',
    'btnAddTableCaption': 'images/caption.svg',
    'btnDeleteTableCaption': 'images/delete-caption.svg',
    // 图像批量分组（图标按意义匹配）
    'btnSelectAllImages': 'images/export-image.svg',
    'btnDeleteAllImages': 'images/delete-image.svg',
    'btnUniformImageFormat': 'images/uniform-image-format.svg',
    'btnClearImageFormat': 'images/clear-image-format.svg',
    'btnDeleteImageCaption': 'images/delete-image-caption.svg',
    'btnAddImageCaption': 'images/add-image-caption.svg',
    // 正文批量分组
    'btnSelectAllText': 'images/select-all.svg',
    'btnDocumentCheck': 'images/check.svg',
    // 脱密分组
    'btnDocumentDeclassifyCheck': 'images/declassify-check.svg',
    'btnDocumentDeclassify': 'images/declassify.svg',
    'btnDocumentDeclassifyRestore': 'images/declassify-restore.svg',
    'btnDocumentAudit': 'images/report.svg',
    'btnDocumentRestore': 'images/restore.svg',
    'btnCleanUnusedStyles': 'images/clean.svg',
    'btnStyleStatistics': 'images/style-statistics.svg',
    'btnDeleteBlankRows': 'images/delete-blank.svg',
    // 表单模板分组
    'btnTemplateCreate': 'images/template-create.svg',
    'btnTemplateImport': 'images/import.svg',
    'btnTemplateExport': 'images/export.svg',
    'btnSettings': 'images/settings.svg',
    // 文档编辑分组
    'btnDownloadTemplate': 'images/download-template.svg',
    'btnSaveDocument': 'images/save-document.svg',
    'btnImportDocument': 'images/import-document.svg',
    'btnAssistFill': 'images/fill.svg',
    'btnFormContentPreview': 'images/report.svg',
    // 文档审查分组
    'btnSpellGrammar': 'images/check.svg',
    'btnGenerateSummary': 'images/report.svg',
    'menuTextAnalysis': 'images/replace-text.svg',
    'btnRewrite': 'images/replace-text.svg',
    'btnExpand': 'images/refresh.svg',
    'btnAbbreviate': 'images/clean.svg',
    'btnParagraphNumberingCheck': 'images/number.svg',
    'btnAiTraceCheck': 'images/ai-trace-check.svg',
    'btnCommentExplain': 'images/add-caption.svg',
    'btnHyperlinkExplain': 'images/ai-websites.svg',
    'btnCorrectSpellGrammar': 'images/check.svg',
    'btnExtractKeywords': 'images/select-all.svg',
    'menuTranslate': 'images/ai-websites.svg',
    'btnTextToImage': 'images/select-images.svg',
    'btnTextToAudio': 'images/ai-assistant.svg',
    'btnTextToVideo': 'images/task-orchestration.svg',
    // 右键菜单 - 选中全部类型
    'btnSelectAllByType': 'images/select-all-type.svg',
    'btnSelectAllByTypeTable': 'images/select-all-table.svg',
    'btnSelectAllByTypePicture': 'images/select-all-picture.svg',
    // 右键菜单 - 添加到察元AI助手
    'btnAddToChayuanAssistant': 'images/add-to-assistant.svg',
    'btnAddToChayuanAssistantTable': 'images/add-to-assistant-table.svg',
    'btnAddToChayuanAssistantPicture': 'images/add-to-assistant-picture.svg'
  }
  return iconMap[eleId] || 'images/newFromTemp.svg'
}

function GetImage(control) {
  return resolveRibbonIconUrl(getRibbonImageRelative(control))
}

function OnGetEnabled(control) {
  const eleId = control.Id
  switch (eleId) {
    case 'btnShowMsg':
      return true
    case 'btnShowDialog': {
      let bFlag = window.Application.PluginStorage.getItem('EnableFlag')
      return bFlag
    }
    case 'btnShowTaskPane': {
      let bFlag = window.Application.PluginStorage.getItem('EnableFlag')
      return bFlag
    }
    case 'btnDocumentDeclassify':
      return !isDocumentDeclassified()
    case 'btnDocumentDeclassifyRestore':
      return isDocumentDeclassified()
    default:
      break
  }
  return true
}

function OnGetVisible(control) {
  const eleId = normalizeContextControlId(control.Id)
  if (eleId && eleId.startsWith('btnAssistantPrimarySlot')) {
    return !!getAssistantForControl(eleId)
  }
  if (eleId && eleId.startsWith('btnContextAssistantSlot')) {
    return !!getAssistantForControl(eleId)
  }
  if (eleId === 'menuMoreAssistants') {
    return true
  }
  if (eleId === 'menuContextAssistantMore') {
    return getContextMoreAssistants().length > 0
  }
  if (GROUP_CONTROL_ASSISTANT_MAP[eleId]) {
    return GROUP_CONTROL_ASSISTANT_MAP[eleId].some(id => isAssistantDisplayedInLocation(id, 'ribbon-main'))
  }
  if (MAIN_CONTROL_ASSISTANT_MAP[eleId]) {
    return MAIN_CONTROL_ASSISTANT_MAP[eleId].some(id => isAssistantDisplayedInLocation(id, 'ribbon-main'))
  }
  return true
}

function OnGetLabel(control) {
  const eleId = normalizeContextControlId(control.Id)
  switch (eleId) {
    case 'btnAssistFill': {
      try {
        const doc = window.Application.ActiveDocument
        if (!doc) return '表单模式'
        return isFormModeFromDocument(doc) ? '退出表单模式' : '表单模式'
      } catch (e) {
        return '表单模式'
      }
    }
    case 'btnIsEnbable': {
      let bFlag = window.Application.PluginStorage.getItem('EnableFlag')
      return bFlag ? '按钮Disable' : '按钮Enable'
    }
    case 'btnApiEvent': {
      let bFlag = window.Application.PluginStorage.getItem('ApiEventFlag')
      return bFlag ? '清除新建文件事件' : '注册新建文件事件'
    }
    case 'btnSpellGrammar':
      return getAssistantDisplayEntry('spell-check')?.title || '拼写与语法检查'
    case 'btnGenerateSummary':
      return getAssistantDisplayEntry('summary')?.title || '生成摘要'
    case 'menuTextAnalysis':
      return '文本分析'
    case 'menuTranslate':
      return getAssistantDisplayEntry('translate')?.title || '翻译'
    case 'btnRewrite':
      return getAssistantDisplayEntry('analysis.rewrite')?.title || '换种方式重写'
    case 'btnExpand':
      return getAssistantDisplayEntry('analysis.expand')?.title || '扩写'
    case 'btnAbbreviate':
      return getAssistantDisplayEntry('analysis.abbreviate')?.title || '缩写'
    case 'btnParagraphNumberingCheck':
      return getAssistantDisplayEntry('analysis.paragraph-numbering-check')?.title || '检查段落序号格式'
    case 'btnAiTraceCheck':
      return getAssistantDisplayEntry('analysis.ai-trace-check')?.title || 'AI 痕迹检查'
    case 'btnCommentExplain':
      return getAssistantDisplayEntry('analysis.comment-explain')?.title || '批注解释'
    case 'btnHyperlinkExplain':
      return getAssistantDisplayEntry('analysis.hyperlink-explain')?.title || '超链接解释'
    case 'btnCorrectSpellGrammar':
      return getAssistantDisplayEntry('analysis.correct-spell')?.title || '纠正拼写和语法'
    case 'btnExtractKeywords':
      return getAssistantDisplayEntry('analysis.extract-keywords')?.title || '提炼关键词'
    case 'btnDocumentDeclassifyCheck':
      return getAssistantDisplayEntry('analysis.security-check')?.title || '保密检查'
    case 'btnTextToImage':
      return getAssistantDisplayEntry('text-to-image')?.title || '文本转图像'
    case 'btnTextToAudio':
      return getAssistantDisplayEntry('text-to-audio')?.title || '文本转语音'
    case 'btnTextToVideo':
      return getAssistantDisplayEntry('text-to-video')?.title || '文本转视频'
    case 'menuContextAssistantMore':
      return '更多智能助手'
  }
  if (eleId && eleId.startsWith('btnAssistantPrimarySlot')) {
    return getAssistantForControl(eleId)?.title || '智能助手'
  }
  if (eleId && eleId.startsWith('btnContextAssistantSlot')) {
    return getAssistantForControl(eleId)?.title || '智能助手'
  }
  return ''
}

/**
 * 右键菜单固定入口是否可见：正文、标题、表格单元格都显示，仅排除图片和无文本上下文。
 */
function OnGetContextMenuVisible(control) {
  try {
    return hasContextSelectionPayload()
  } catch (e) {
    console.warn('OnGetContextMenuVisible:', e)
    return false
  }
}

// 获取右键菜单标签（根据选中内容类型动态显示）
function OnGetContextMenuLabel(control) {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      return '添加到察元AI助手'
    }
    
    const selection = window.Application.Selection
    if (!selection) {
      return '添加到察元AI助手'
    }
    
    // 检测选中的内容类型
    try {
      // 检测表格
      if (selection.Tables && selection.Tables.Count > 0) {
        return '选中全部表格'
      }
      
      // 检测图像
      if (selection.InlineShapes && selection.InlineShapes.Count > 0) {
        return '选中全部图像'
      }
      if (selection.ShapeRange && selection.ShapeRange.Count > 0) {
        return '选中全部图像'
      }
      
      // 检测段落
      if (selection.Paragraphs && selection.Paragraphs.Count > 0) {
        // 检查是否在段落中
        const paraCount = selection.Paragraphs.Count
        if (paraCount === 1) {
          // 单个段落，检查是否是段落选择
          const para = selection.Paragraphs.Item(1)
          if (para && para.Range && selection.Range.Start >= para.Range.Start && 
              selection.Range.End <= para.Range.End) {
            return '选中全部相同段落'
          }
        }
      }
      
      // 检测正文（默认情况）
      // 如果选中了文本内容，判断为正文
      if (selection.Text && selection.Text.trim()) {
        return '选中全部正文'
      }
      
    } catch (e) {
      console.error('检测选中内容类型失败:', e)
    }
    
    // 默认返回
    return '添加到牛档AI助手'
  } catch (e) {
    console.error('获取右键菜单标签失败:', e)
    return '添加到牛档AI助手'
  }
}

// 获取分组标签
function OnGetGroupLabel(control) {
  const eleId = control.Id
  console.log('OnGetGroupLabel called for:', eleId)
  const groupLabelMap = {
    'groupAbout': '关于',
    'groupAIAssistant': 'AI助手',
    'groupTableImageBatch': '表格与图像批量',
    'groupTextBatch': '正文批量',
    'groupFormTemplate': '表单模板',
    'groupDocumentEdit': '文档编辑',
    'groupDocumentReview': '文档审查'
  }
  const label = groupLabelMap[eleId] || ''
  console.log('Returning group label:', label)
  return label
}

function OnNewDocumentApiEvent(doc) {
  alert('新建文件事件响应，取文件名: ' + doc.Name)
}

// 检测选中内容的类型
function detectSelectionType() {
  try {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      return 'unknown'
    }
    
    const selection = window.Application.Selection
    if (!selection) {
      return 'unknown'
    }
    
    // 检测表格
    try {
      if (selection.Tables && selection.Tables.Count > 0) {
        return 'table'
      }
    } catch (e) {}
    
    // 检测图像
    try {
      if (selection.InlineShapes && selection.InlineShapes.Count > 0) {
        return 'image'
      }
      if (selection.ShapeRange && selection.ShapeRange.Count > 0) {
        return 'image'
      }
    } catch (e) {}
    
    // 检测段落
    try {
      if (selection.Paragraphs && selection.Paragraphs.Count > 0) {
        const paraCount = selection.Paragraphs.Count
        if (paraCount === 1) {
          const para = selection.Paragraphs.Item(1)
          if (para && para.Range && selection.Range.Start >= para.Range.Start && 
              selection.Range.End <= para.Range.End) {
            return 'paragraph'
          }
        }
      }
    } catch (e) {}
    
    // 检测正文（默认情况）
    try {
      if (selection.Text && selection.Text.trim()) {
        return 'text'
      }
    } catch (e) {}
    
    return 'unknown'
  } catch (e) {
    console.error('检测选中内容类型失败:', e)
    return 'unknown'
  }
}

// 根据类型选中全部的处理函数
function OnSelectAllByTypeAction(control) {
  const doc = window.Application.ActiveDocument
  if (!doc) {
    alert('当前没有打开任何文档')
    return true
  }
  
  const selection = window.Application.Selection
  if (!selection) {
    alert('无法获取选中内容')
    return true
  }
  
  const selectionType = detectSelectionType()
  
  try {
    switch (selectionType) {
      case 'table':
        // 选中全部表格
        try {
          const tables = doc.Tables
          if (tables && tables.Count > 0) {
            // 选中第一个表格，然后扩展到所有表格
            let firstTable = tables.Item(1)
            let lastTable = tables.Item(tables.Count)
            selection.SetRange(firstTable.Range.Start, lastTable.Range.End)
          }
        } catch (e) {
          console.error('选中全部表格失败:', e)
          alert('选中全部表格失败')
        }
        break
        
      case 'image':
        // 选中全部图像
        try {
          const inlineShapes = doc.InlineShapes
          if (inlineShapes && inlineShapes.Count > 0) {
            // 选中第一个图像，然后扩展到所有图像
            let firstShape = inlineShapes.Item(1)
            let lastShape = inlineShapes.Item(inlineShapes.Count)
            selection.SetRange(firstShape.Range.Start, lastShape.Range.End)
          }
        } catch (e) {
          console.error('选中全部图像失败:', e)
          alert('选中全部图像失败')
        }
        break
        
      case 'paragraph':
        // 选中全部相同段落
        try {
          const currentPara = selection.Paragraphs.Item(1)
          if (currentPara && currentPara.Style) {
            const styleName = currentPara.Style.NameLocal || currentPara.Style.Name
            const paragraphs = doc.Paragraphs
            if (paragraphs && paragraphs.Count > 0) {
              let firstMatch = null
              let lastMatch = null
              for (let i = 1; i <= paragraphs.Count; i++) {
                try {
                  const para = paragraphs.Item(i)
                  if (para && para.Style) {
                    const paraStyleName = para.Style.NameLocal || para.Style.Name
                    if (paraStyleName === styleName) {
                      if (!firstMatch) firstMatch = para
                      lastMatch = para
                    }
                  }
                } catch (e) {}
              }
              if (firstMatch && lastMatch) {
                selection.SetRange(firstMatch.Range.Start, lastMatch.Range.End)
              }
            }
          }
        } catch (e) {
          console.error('选中全部相同段落失败:', e)
          alert('选中全部相同段落失败')
        }
        break
        
      case 'text':
        // 选中全部正文
        try {
          doc.Content.Select()
        } catch (e) {
          console.error('选中全部正文失败:', e)
          alert('选中全部正文失败')
        }
        break
        
      default:
        alert('无法识别选中内容的类型')
        break
    }
  } catch (e) {
    reportError('执行选中全部操作失败', e)
  }
  return true
}

// 右键菜单处理函数 - 添加到察元AI助手
function OnContextMenuAction(control) {
  const eleId = normalizeContextControlId(control.Id)
  // 处理所有"添加到察元AI助手"的右键菜单项
  if (eleId === 'btnAddToChayuanAssistant') {
    const doc = window.Application.ActiveDocument
    if (!doc) {
      alert('当前没有打开任何文档')
      return true
    }

    const payload = resolveContextSelectionPayload()
    const selectedContent = String(payload?.text || '').trim()

    if (selectedContent) {
      try {
        window.Application.PluginStorage.setItem('assistant_selected_content', selectedContent)
        window.Application.PluginStorage.setItem('assistant_selected_context', JSON.stringify(payload))
      } catch (e) {}
      showAIAssistantDialog({ from: 'context' })
    } else {
      alert('请先选择要添加的内容')
    }
  }
  return true
}
// 样式数据
const styleItems = [
  // 注意：WPS Ribbon 的 getItemImage 一般需要返回可识别的图片对象/路径。
  // 这里使用 public/images 下的静态资源路径，避免 base64 导致 gallery 渲染为空。
  { id: "style1", label: "标题1", image: "images/1.svg", color: "#FF0000" },
  { id: "style2", label: "标题2", image: "images/2.svg", color: "#00FF00" },
  { id: "style3", label: "正文", image: "images/3.svg", color: "#0000FF" },
  { id: "style4", label: "引用", image: "images/about.svg", color: "#FFFF00" }
];

// 回调函数实现
function GetStyleCount() {
  return styleItems.length;
}

function GetStyleID(control, index) {
  return styleItems[index].id;
}

function GetStyleLabel(control, index) {
  return styleItems[index].label;
}

function GetStyleImage(control, index) {
  const item = styleItems[index]
  return resolveRibbonIconUrl((item && item.image) || 'images/check.svg')
}

function OnStyleSelected(control, selectedId, index) {
  const selectedStyle = styleItems[index];
  if (selectedStyle) {
      // 应用样式到文档
      console.log("应用样式:", selectedStyle.label);
  }
}

// 生成Base64图标（示例）
function getBase64Icon(type) {
  // 实际开发中，这里应该返回真实的Base64图标数据
  // 或者使用预定义的图标
  return "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAZdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuMTM0A1t6AAAAGklEQVQ4T2P8//8/Ay0xw6gBo4FAMzBqAAwDACm8A0ZFR0jZAAAAAElFTkSuQmCC";
}

// 这些函数是给 wps 客户端调用的
// 必须在模块加载时立即挂到 window.ribbon，否则 ribbon.xml 的 ribbon.OnAddinLoad 等
// 在 WPS 早期调用时会找不到 ribbon（Vue onMounted 太晚）
const ribbon = {
  OnAddinLoad,
  showAIAssistantDialog,
  OnAction,
  GetImage,
  OnGetEnabled,
  OnGetVisible,
  OnGetLabel,
  OnGetGroupLabel,
  OnGetContextMenuLabel,
  OnGetContextMenuVisible,
  OnSelectAllByTypeAction,
  OnContextMenuAction,
  OnNewDocumentApiEvent,
  OnDocumentOpenForFormMode,
  OnWindowActivateForFormMode,
  OnDocumentBeforeSave,
  GetModelMenuLabel,
  GetModelMenuContent,
  GetTranslationMenuContent,
  GetMoreAssistantsMenuContent,
  GetContextTextAnalysisMenuContent,
  GetContextTranslationMenuContent,
  OnModelSelectAction,
  GetModelTogglePressed,
  OnModelToggle,
  GetModelItemCount,
  GetModelItemLabel,
  GetModelItemImage,
  GetModelItemID,
  OnModelSelect,
  GetContextAssistantMoreMenuContent,
  GetTableBatchItemCount,
  GetTableBatchItemLabel,
  GetTableBatchItemImage,
  GetTableBatchItemID,
  OnTableBatchSelect,
  GetImageBatchItemCount,
  GetImageBatchItemLabel,
  GetImageBatchItemImage,
  GetImageBatchItemID,
  OnImageBatchSelect,
  GetStyleCount,
  GetStyleID,
  GetStyleLabel,
  GetStyleImage,
  OnStyleSelected
}
if (typeof window !== 'undefined') {
  window.ribbon = ribbon
}
export default ribbon

// P0:供 settings 等模块在助手配置变更后主动刷新 Ribbon slot 可见性
export { invalidateAssistantSlotControls }
