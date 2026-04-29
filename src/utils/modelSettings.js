/**
 * 模型配置管理 - 存储和读取每个模型的配置信息
 * 包括 API 密钥、API 地址、模型列表等
 */

import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
import { getModelLogoPath } from './modelLogos.js'
import { inferModelType, matchesModelType } from './modelTypeUtils.js'

const STORAGE_KEY = 'modelConfigs'
const CUSTOM_PROVIDERS_KEY = 'customModelProviders'
const MODEL_ORDER_KEY = 'modelOrder'

// 默认在察元AI助理中开启的模型（ChatGPT、Ollama、阿里百炼、DeepSeek、百度云千帆）
const DEFAULT_ENABLED_PROVIDERS = ['OPENAI', 'OLLAMA', 'DEEPSEEK', 'baidu-qianfan', 'aliyun-bailian']

/**
 * 获取所有模型配置
 */
export function getAllModelConfigs() {
  const settings = loadGlobalSettings()
  return settings[STORAGE_KEY] || {}
}

/**
 * 获取指定模型的配置
 * @param {string} modelId - 模型ID
 * @returns {object} 模型配置对象
 */
export function getModelConfig(modelId) {
  const configs = getAllModelConfigs()
  const raw = configs[modelId]
  const defaultEnabled = DEFAULT_ENABLED_PROVIDERS.includes(
    String(modelId || '').trim()
  ) || DEFAULT_ENABLED_PROVIDERS.includes(
    String(modelId || '').trim().toLowerCase()
  )
  if (raw) {
    const modelSeries = raw.modelSeries || raw.models || []
    return {
      apiKey: raw.apiKey || '',
      apiUrl: raw.apiUrl || '',
      enabled: raw.enabled !== undefined ? !!raw.enabled : defaultEnabled,
      modelSeries,
      models: modelSeries
    }
  }
  return {
    apiKey: '',
    apiUrl: '',
    enabled: defaultEnabled,
    modelSeries: [],
    models: []
  }
}

/**
 * 获取已开启的模型 provider id 集合（用于察元AI助理下拉过滤）
 * @returns {Set<string>}
 */
export function getEnabledProviderIds() {
  const configs = getAllModelConfigs()
  const enabled = new Set()
  const configKeys = new Set(Object.keys(configs).map(k => String(k).toLowerCase()))
  for (const [id, cfg] of Object.entries(configs)) {
    if (cfg && cfg.enabled) {
      enabled.add(String(id).toLowerCase())
    }
  }
  // 无配置的 provider 使用默认开启状态
  DEFAULT_ENABLED_PROVIDERS.forEach(p => {
    const key = String(p).toLowerCase()
    if (!configKeys.has(key)) {
      enabled.add(key)
    }
  })
  return enabled
}

/**
 * ribbon 模型 id -> 设置中的 provider id 映射
 * 用于根据模型设置中的 enabled 状态过滤察元AI助理下拉选项
 */
export const RIBBON_MODEL_TO_PROVIDER = {
  // ChatGPT
  'gpt-4o': 'OPENAI', 'gpt-4': 'OPENAI', 'gpt-4-turbo': 'OPENAI',
  'o3': 'OPENAI', 'gpt_o1': 'OPENAI', 'gpt-5': 'OPENAI', 'gpt-3.5': 'OPENAI', 'openai': 'OPENAI',
  // Claude
  'claude-3.5': 'anthropic', 'claude-3': 'anthropic', 'claude': 'anthropic',
  // Gemini
  'gemini-pro': 'GEMINI', 'gemini': 'GEMINI',
  // DeepSeek
  'deepseek-v3': 'DEEPSEEK', 'deepseek-r1': 'DEEPSEEK', 'deepseek-coder': 'DEEPSEEK',
  // 豆包
  'doubao': 'volcengine', 'doubao-pro': 'volcengine',
  // 阿里百炼
  'qwen-max': 'aliyun-bailian', 'qwen-plus': 'aliyun-bailian', 'qwen': 'aliyun-bailian',
  // 百度云千帆（文心大模型）
  'wenxin-4': 'baidu-qianfan', 'wenxin': 'baidu-qianfan',
  'ernie-3.5-8k': 'baidu-qianfan', 'ernie-4.0-8k': 'baidu-qianfan', 'ernie-speed-128k': 'baidu-qianfan',
  // ChatGLM
  'chatglm-4': 'ZHIPU', 'glm-4': 'ZHIPU',
  // Kimi
  'kimi': 'moonshot', 'moonshot': 'moonshot',
  // 零一万物
  'yi-large': 'lingyi-wanwu', 'yi-medium': 'lingyi-wanwu', 'yi': 'lingyi-wanwu',
  // Ollama
  'ollama': 'OLLAMA',
  // 其他
  'baichuan': 'baichuan', 'mistral-large': 'mistral', 'mixtral': 'mistral',
  'llama-3': 'lm-studio', 'hunyuan': 'tencent-hunyuan', 'xinghuo': 'volcengine',
  'minimax': 'minimax', 'step': 'step-ai', 'grok': 'grok', 'perplexity': 'perplexity',
  'coze': 'volcengine', 'internlm': 'modelscope', 'openrouter': 'openrouter',
  'groq': 'groq', 'together': 'together', 'fireworks': 'fireworks', 'cohere': 'cohere',
  'netease-youdao': 'netease-youdao', 'pangu': 'pangu', 'sensetime': 'sensetime',
  'hailuo': 'hailuo', '360': '360', 'xinference': 'XINFERENCE', 'oneapi': 'ONEAPI',
  'vllm': 'FASTCHAT', 'new-api': 'new-api', 'lm-studio': 'lm-studio',
  'api-compatible': 'OPENAI_COMPATIBLE'
}

/**
 * 判断 ribbon 中的模型是否在模型设置中已开启
 * @param {string} ribbonModelId - ribbon 中的模型 id
 * @returns {boolean}
 */
export function isRibbonModelEnabled(ribbonModelId) {
  if (!ribbonModelId) return false
  const provider = RIBBON_MODEL_TO_PROVIDER[ribbonModelId] ||
    RIBBON_MODEL_TO_PROVIDER[String(ribbonModelId).toLowerCase()] ||
    ribbonModelId
  const enabled = getEnabledProviderIds()
  return enabled.has(String(provider).toLowerCase())
}

/**
 * 保存指定模型的配置
 * @param {string} modelId - 模型ID
 * @param {object} config - 配置对象 { apiKey, apiUrl, enabled, modelSeries, models }
 */
export function saveModelConfig(modelId, config) {
  const configs = getAllModelConfigs()
  const existingConfig = getModelConfig(modelId)
  const modelSeries = config.modelSeries || config.models || existingConfig.models || []
  // 合并配置，确保 modelSeries 和 models 都被保存（兼容性）
  configs[modelId] = {
    ...existingConfig,
    ...config,
    // 如果提供了 modelSeries，同时更新 models（兼容旧版本）
    models: modelSeries,
    modelSeries,
    updatedAt: new Date().toISOString()
  }
  return saveGlobalSettings({ [STORAGE_KEY]: configs })
}

/**
 * 获取用户自定义添加的模型供应商列表（显示在模型清单第一位）
 * @returns {Array<{ id: string, name: string, type: string }>}
 */
export function getCustomModelProviders() {
  const settings = loadGlobalSettings()
  const list = settings[CUSTOM_PROVIDERS_KEY]
  return Array.isArray(list) ? list : []
}

/**
 * 保存用户自定义添加的模型供应商列表
 * @param {Array<{ id: string, name: string, type: string }>} list
 */
export function saveCustomModelProviders(list) {
  return saveGlobalSettings({ [CUSTOM_PROVIDERS_KEY]: list || [] })
}

/**
 * 获取模型清单显示顺序（id 数组）
 * @returns {string[]}
 */
export function getModelOrder() {
  const settings = loadGlobalSettings()
  const order = settings[MODEL_ORDER_KEY]
  return Array.isArray(order) ? order : []
}

/**
 * 保存模型清单显示顺序
 * @param {string[]} order - 模型 id 数组
 */
export function saveModelOrder(order) {
  return saveGlobalSettings({ [MODEL_ORDER_KEY]: order || [] })
}

/**
 * 删除指定模型的配置
 * @param {string} modelId - 模型ID
 */
export function deleteModelConfig(modelId) {
  const configs = getAllModelConfigs()
  delete configs[modelId]
  return saveGlobalSettings({ [STORAGE_KEY]: configs })
}

/**
 * 获取默认模型ID
 */
export function getDefaultModelId() {
  const settings = loadGlobalSettings()
  return settings.defaultModelId || null
}

/**
 * 设置默认模型ID
 * @param {string} modelId - 模型ID
 */
export function setDefaultModelId(modelId) {
  return saveGlobalSettings({ defaultModelId: modelId })
}

// 模型设置中的提供商清单（与 SettingsDialog MODEL_INVENTORY + getDefaultModels 一致）
const MODEL_INVENTORY = [
  { id: 'OPENAI', name: 'OpenAI' },
  { id: 'OLLAMA', name: 'Ollama' },
  { id: 'aliyun-bailian', name: '阿里百炼' },
  { id: 'DEEPSEEK', name: 'DeepSeek' },
  { id: 'baidu-qianfan', name: '百度云千帆' },
  { id: 'XINFERENCE', name: 'Xinference' },
  { id: 'ONEAPI', name: 'One API' },
  { id: 'FASTCHAT', name: 'FastChat' },
  { id: 'OPENAI_COMPATIBLE', name: 'Custom OpenAI' },
  { id: 'GEMINI', name: 'Google Gemini' },
  { id: 'ZHIPU', name: '智谱 GLM' },
  { id: 'REPLICATE_FAL_AI', name: 'Replicate' }
]

const EXTRA_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic' }, { id: 'openai', name: 'OpenAI' }, { id: 'deepseek', name: '深度求索' },
  { id: 'ollama', name: 'Ollama' }, { id: 'moonshot', name: '月之暗面' }, { id: 'aliyun-bailian', name: '阿里百炼' },
  { id: 'zhipu', name: '智谱开放平台' }, { id: 'volcengine', name: '火山引擎' }, { id: 'lingyi-wanwu', name: '零一万物' },
  { id: 'minimax', name: 'MiniMax' }, { id: 'step-ai', name: '阶跃星辰' }, { id: 'baichuan', name: '百川' },
  { id: 'groq', name: 'Groq' }, { id: 'together', name: 'Together' }, { id: 'fireworks', name: 'Fireworks' },
  { id: 'openrouter', name: 'OpenRouter' }, { id: 'new-api', name: 'New API' }, { id: 'lm-studio', name: 'LM Studio' }
]

function getProviderList() {
  const seen = new Set()
  const list = []
  for (const p of MODEL_INVENTORY) {
    const k = p.id.toLowerCase()
    if (!seen.has(k)) {
      seen.add(k)
      list.push(p)
    }
  }
  for (const p of EXTRA_PROVIDERS) {
    const k = p.id.toLowerCase()
    if (!seen.has(k)) {
      seen.add(k)
      list.push(p)
    }
  }
  // 合并已配置的 provider（用户可能配置了清单外的）
  const configs = getAllModelConfigs()
  for (const id of Object.keys(configs)) {
    const k = id.toLowerCase()
    if (!seen.has(k)) {
      seen.add(k)
      list.push({ id, name: id })
    }
  }
  return list
}

/** Ollama 类提供商（可不填 apiKey） */
const OLLAMA_LIKE_IDS = ['ollama', 'OLLAMA', 'xinference', 'XINFERENCE', 'oneapi', 'ONEAPI', 'fastchat', 'FASTCHAT', 'lm-studio', 'new-api']

function isOllamaLikeProvider(providerId) {
  return OLLAMA_LIKE_IDS.some(id => String(providerId || '').toLowerCase() === id.toLowerCase())
}

/**
 * 获取 provider 显示名（与 Settings 模型清单一致）
 */
function getProviderDisplayName(providerId) {
  const list = [...MODEL_INVENTORY, ...EXTRA_PROVIDERS]
  const found = list.find(p => String(p.id).toLowerCase() === String(providerId).toLowerCase())
  return found ? found.name : providerId
}

/**
 * 从模型设置构建下拉分组
 * @param {string} [modelType] - 可选，过滤模型类型：chat|embedding|image|video，不传则不过滤
 * @returns {Array<{ label: string, icon: string, providerId: string, models: Array<{ id: string, providerId: string, modelId: string, name: string, type?: string }> }>}
 */
export function getModelGroupsFromSettings(modelType) {
  const configs = getAllModelConfigs()
  const groups = []
  const seenProvider = new Set()

  for (const [configKey, raw] of Object.entries(configs)) {
    if (!raw || typeof raw !== 'object') continue
    const config = getModelConfig(configKey)
    if (!config.enabled) continue
    const apiUrl = (config.apiUrl || '').trim()
    if (!apiUrl) continue
    if (!isOllamaLikeProvider(configKey) && !(config.apiKey || '').trim()) continue
    const modelSeries = config.modelSeries || config.models || []
    if (!Array.isArray(modelSeries) || modelSeries.length === 0) continue

    const keyLower = String(configKey).toLowerCase()
    if (seenProvider.has(keyLower)) continue
    seenProvider.add(keyLower)

    const models = modelSeries.map(m => {
      const modelId = typeof m === 'string' ? m : (m.id || m.name || '')
      const name = typeof m === 'string' ? m : (m.name || m.id || '')
      const type = (typeof m === 'object' && m.type) ? m.type : inferModelType(modelId)
      const compositeId = `${configKey}|${modelId}`
      return { id: compositeId, providerId: configKey, modelId, name, type }
    }).filter(m => m.modelId && (!modelType || matchesModelType(m.type, modelType)))

    if (models.length === 0) continue

    groups.push({
      label: getProviderDisplayName(configKey),
      icon: getModelLogoPath(configKey) || 'images/ai-assistant.svg',
      providerId: configKey,
      models
    })
  }
  return groups
}

/** 获取扁平化的模型列表（用于默认模型下拉），按类型过滤 */
export function getFlatModelsFromSettings(modelType) {
  const groups = getModelGroupsFromSettings(modelType)
  return groups.flatMap(g => g.models)
}

/**
 * 各模型提供商 API 密钥获取页面 URL
 * providerId（不区分大小写）-> 开放平台 API Key 管理页
 */
export const PROVIDER_API_KEY_URLS = {
  OPENAI: 'https://platform.openai.com/api-keys',
  openai: 'https://platform.openai.com/api-keys',
  DEEPSEEK: 'https://platform.deepseek.com/api_keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  'aliyun-bailian': 'https://dashscope.console.aliyun.com/api-key_management',
  'baidu-qianfan': 'https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application',
  GEMINI: 'https://aistudio.google.com/app/apikey',
  gemini: 'https://aistudio.google.com/app/apikey',
  ZHIPU: 'https://open.bigmodel.cn/usercenter/apikeys',
  zhipu: 'https://open.bigmodel.cn/usercenter/apikeys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  moonshot: 'https://platform.moonshot.cn/console/api-keys',
  'lingyi-wanwu': 'https://platform.lingyiwanwu.com/apikeys',
  volcengine: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
  REPLICATE_FAL_AI: 'https://replicate.com/account/api-tokens',
  groq: 'https://console.groq.com/keys',
  together: 'https://api.together.xyz/settings/api-keys',
  openrouter: 'https://openrouter.ai/keys',
  fireworks: 'https://fireworks.ai/api-keys',
  minimax: 'https://platform.minimax.io/user-center/basic-information/interface-key',
  'step-ai': 'https://platform.stepfun.com/interface-key',
  baichuan: 'https://platform.baichuan-ai.com/homePage',
  'tencent-hunyuan': 'https://console.cloud.tencent.com/hunyuan/start',
  'azure-openai': 'https://portal.azure.com/#view/Microsoft_Azure_OpenAI/AzureOpenAIChat',
  'vertex-ai': 'https://console.cloud.google.com/apis/credentials',
  nvidia: 'https://build.nvidia.com/settings/api-keys',
  perplexity: 'https://www.perplexity.ai/settings/api',
  grok: 'https://console.x.ai/',
  huggingface: 'https://huggingface.co/settings/tokens',
  'aws-bedrock': 'https://console.aws.amazon.com/bedrock/',
  jina: 'https://jina.ai/zh-CN/api-dashboard/',
  voyage: 'https://dash.voyageai.com/',
  'voyage-ai': 'https://dash.voyageai.com/',
  poe: 'https://poe.com/api_key',
  cerebras: 'https://cloud.cerebras.ai/',
  'github-models': 'https://github.com/settings/tokens',
  'github-copilot': 'https://github.com/settings/copilot',
  hyperbolic: 'https://hyperbolic.xyz/',
  modelscope: 'https://modelscope.cn/my/myaccesstoken',
  'tianyi-xirang': 'https://ctxirang.ctyun.cn/home',
  'tencent-cloud-ti': 'https://console.cloud.tencent.com/cam/capi',
  'xiaomi-mimo': 'https://platform.xiaomimimo.com/#/console/api-keys',
  'wuwen-xinqiong': 'https://platform.wuwen.com/',
  dmxapi: 'https://dmxapi.com/',
  aionly: 'https://aionly.com/',
  burncloud: 'https://burncloud.com/',
  tokenflux: 'https://tokenflux.com/',
  '302-ai': 'https://302.ai/',
  cephalon: 'https://cephalon.ai/',
  lanyun: 'https://lanyun.com/',
  ph8: 'https://ph8.com/',
  sophnet: 'https://sophnet.com/',
  ppio: 'https://ppio.cloud/',
  qiniu: 'https://portal.qiniu.com/ai-inference/api-key',
  ocoolai: 'https://ocoolai.com/',
  aihubmix: 'https://aihubmix.com/',
  gpustack: 'https://gpustack.com/',
  vercel: 'https://vercel.com/',
  'vercel-ai': 'https://gateway.ai.cloudflare.com/',
  totoro: 'https://longcat.chat/platform/api_keys',
  longcat: 'https://longcat.chat/platform/api_keys'
}

/**
 * 无 API Key 云平台的提供商（自托管/本地）文档与模型获取页
 * 如 Ollama、Xinference、One API 等，需在模型列表上方提示用户查看文档
 */
export const PROVIDER_DOCS_URLS = {
  OLLAMA: 'https://ollama.com/',
  ollama: 'https://ollama.com/',
  XINFERENCE: 'https://inference.readthedocs.io/',
  xinference: 'https://inference.readthedocs.io/',
  ONEAPI: 'https://github.com/songquanpeng/one-api',
  oneapi: 'https://github.com/songquanpeng/one-api',
  FASTCHAT: 'https://github.com/lm-sys/FastChat',
  fastchat: 'https://github.com/lm-sys/FastChat',
  'lm-studio': 'https://lmstudio.ai/',
  'new-api': 'https://github.com/Calcium-Ion/new-api'
}

/**
 * 根据 providerId 获取 API 密钥获取页面 URL
 * @param {string} providerId - 模型提供商 ID
 * @returns {string|null} 获取秘钥的 URL，无则返回 null
 */
export function getProviderApiKeyUrl(providerId) {
  if (!providerId || typeof providerId !== 'string') return null
  const key = providerId.trim()
  return PROVIDER_API_KEY_URLS[key] || PROVIDER_API_KEY_URLS[key.toLowerCase()] || null
}

/**
 * 根据 providerId 获取文档/模型获取页 URL（用于无 API Key 云平台的提供商）
 * @param {string} providerId - 模型提供商 ID
 * @returns {string|null} 文档 URL，无则返回 null
 */
export function getProviderDocsUrl(providerId) {
  if (!providerId || typeof providerId !== 'string') return null
  const key = providerId.trim()
  return PROVIDER_DOCS_URLS[key] || PROVIDER_DOCS_URLS[key.toLowerCase()] || null
}

/** 解析 compositeId 为 { providerId, modelId } */
export function parseModelCompositeId(compositeId) {
  if (!compositeId || typeof compositeId !== 'string') return null
  const idx = compositeId.indexOf('|')
  if (idx < 0) return null
  return {
    providerId: compositeId.slice(0, idx),
    modelId: compositeId.slice(idx + 1)
  }
}
