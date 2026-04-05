import { chatCompletion } from './chatApi.js'
import { addTask, updateTask } from './taskListStore.js'
import { createCustomAssistantDraft } from './assistantSettings.js'
import {
  INPUT_SOURCE_OPTIONS,
  OUTPUT_FORMAT_OPTIONS,
  DOCUMENT_ACTION_OPTIONS,
  ASSISTANT_DISPLAY_LOCATION_OPTIONS
} from './assistantRegistry.js'
import {
  createDefaultReportSettings,
  DEFAULT_REPORT_TEMPLATE,
  REPORT_TYPE_OPTIONS,
  normalizeReportSettings
} from './reportSettings.js'

export const ASSISTANT_PROMPT_RECOMMENDATION_ASSISTANT_ID = 'settings.custom-assistant-recommendation'
export const ASSISTANT_PROMPT_RECOMMENDATION_TASK_TYPE = 'assistant-prompt-recommendation'

const activeRecommendationRuns = new Map()
const VALID_INPUT_SOURCES = new Set(INPUT_SOURCE_OPTIONS.map(item => item.value))
const VALID_OUTPUT_FORMATS = new Set(OUTPUT_FORMAT_OPTIONS.map(item => item.value))
const VALID_DOCUMENT_ACTIONS = new Set(DOCUMENT_ACTION_OPTIONS.map(item => item.value))
const VALID_DISPLAY_LOCATIONS = new Set(ASSISTANT_DISPLAY_LOCATION_OPTIONS.map(item => item.value))
const VALID_REPORT_TYPES = new Set(REPORT_TYPE_OPTIONS.map(item => item.value))

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value))
}

function createCancelError() {
  const error = new Error('任务已停止')
  error.name = 'TaskCancelledError'
  return error
}

function isTaskCancelledError(error) {
  return error?.name === 'TaskCancelledError'
}

function throwIfCancelled(runState) {
  if (runState?.cancelled) {
    throw createCancelError()
  }
}

function getPreview(text, limit = 160) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized
}

function normalizeDisplayLocations(locations, fallback) {
  const source = Array.isArray(locations) ? locations : fallback
  const unique = []
  source.forEach(item => {
    const value = String(item || '').trim()
    if (!VALID_DISPLAY_LOCATIONS.has(value)) return
    if (!unique.includes(value)) unique.push(value)
  })
  if (unique.includes('ribbon-main') && unique.includes('ribbon-more')) {
    return unique.filter(item => item !== 'ribbon-more')
  }
  return unique
}

function normalizeMediaOptions(value, fallback) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    aspectRatio: String(source.aspectRatio || fallback.aspectRatio || '16:9').trim() || '16:9',
    duration: String(source.duration || fallback.duration || '30s').trim() || '30s',
    voiceStyle: String(source.voiceStyle || fallback.voiceStyle || '专业自然').trim() || '专业自然'
  }
}

function normalizeTemperature(value, fallback = 0.3) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.min(1.2, Math.max(0, Number(next.toFixed(1))))
}

function normalizeRecommendedReportSettings(value, fallback) {
  const base = normalizeReportSettings(fallback, createDefaultReportSettings())
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const normalizedType = String(source.type || '').trim()
  return normalizeReportSettings({
    enabled: source.enabled === true,
    type: VALID_REPORT_TYPES.has(normalizedType) || normalizedType === 'custom'
      ? normalizedType
      : base.type,
    customType: String(source.customType || '').trim(),
    template: String(source.template || '').trim() || base.template || DEFAULT_REPORT_TEMPLATE,
    prompt: String(source.prompt || '').trim()
  }, base)
}

function ensureInputVariable(template) {
  const text = String(template || '').trim()
  if (!text) return '{{input}}'
  if (/\{\{\s*input\s*\}\}/.test(text)) return text
  return `${text}\n\n待处理内容：\n{{input}}`
}

function extractJsonCandidate(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim()
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1).trim()
  }
  return text
}

function parseRecommendationResponse(raw) {
  const candidate = extractJsonCandidate(raw)
  if (!candidate) {
    throw new Error('模型未返回可解析的推荐结果')
  }
  try {
    return JSON.parse(candidate)
  } catch (error) {
    throw new Error(`推荐结果解析失败：${error?.message || error}`)
  }
}

function normalizeRecommendedConfig(parsed, draftSnapshot) {
  const draft = draftSnapshot && typeof draftSnapshot === 'object'
    ? cloneValue(draftSnapshot)
    : createCustomAssistantDraft()
  const source = parsed && typeof parsed === 'object' ? parsed : {}
  const recommended = source.recommendedConfig && typeof source.recommendedConfig === 'object'
    ? source.recommendedConfig
    : source
  const base = {
    ...createCustomAssistantDraft(),
    ...draft,
    icon: draft.icon || '🧠',
    modelType: draft.modelType || 'chat',
    modelId: draft.modelId || null,
    visibleInRibbon: draft.visibleInRibbon !== false,
    sortOrder: draft.sortOrder || 0
  }
  const merged = {
    ...base,
    name: String(recommended.name || base.name || '').trim(),
    description: String(recommended.description || base.description || '').trim(),
    persona: String(recommended.persona || base.persona || '').trim(),
    systemPrompt: String(recommended.systemPrompt || base.systemPrompt || '').trim(),
    userPromptTemplate: ensureInputVariable(recommended.userPromptTemplate || base.userPromptTemplate || '{{input}}'),
    inputSource: VALID_INPUT_SOURCES.has(String(recommended.inputSource || ''))
      ? String(recommended.inputSource)
      : base.inputSource,
    outputFormat: VALID_OUTPUT_FORMATS.has(String(recommended.outputFormat || ''))
      ? String(recommended.outputFormat)
      : base.outputFormat,
    documentAction: VALID_DOCUMENT_ACTIONS.has(String(recommended.documentAction || ''))
      ? String(recommended.documentAction)
      : base.documentAction,
    temperature: normalizeTemperature(recommended.temperature, base.temperature ?? 0.3),
    displayLocations: normalizeDisplayLocations(recommended.displayLocations, base.displayLocations || ['ribbon-more']),
    targetLanguage: String(recommended.targetLanguage || base.targetLanguage || '中文').trim() || '中文',
    mediaOptions: normalizeMediaOptions(recommended.mediaOptions, base.mediaOptions || createCustomAssistantDraft().mediaOptions),
    reportSettings: normalizeRecommendedReportSettings(recommended.reportSettings, base.reportSettings)
  }
  if (!merged.displayLocations.length) {
    merged.displayLocations = ['ribbon-more']
  }
  if (merged.reportSettings?.enabled) {
    merged.inputSource = 'document'
    if (!merged.outputFormat || merged.outputFormat === 'plain' || merged.outputFormat === 'json') {
      merged.outputFormat = 'markdown'
    }
  }
  return {
    appliedConfig: merged,
    summary: String(source.summary || source.recommendationSummary || '').trim(),
    usageNotes: String(source.usageNotes || source.notes || '').trim()
  }
}

function buildSystemPrompt() {
  return [
    '你是一位资深 AI 助手设计师与提示词工程专家，擅长把自然语言需求转成可直接落地的“自定义智能助手设置”。',
    '你的目标不是泛泛给建议，而是输出一套可直接写入产品设置的结果。',
    '请严格遵守以下原则：',
    '1. 必须优先保证可执行性和稳定性，避免空泛、冗长、重复的提示词。',
    '2. systemPrompt 负责角色、边界、目标、输出原则；userPromptTemplate 负责具体任务指令，并优先保留 {{input}} 变量。',
    '3. 当需求偏审查、检查、解释、抽取时，优先选择更稳健的低温度和更保守的文档动作。',
    '4. 当需求偏改写、生成、创作时，可适度提高温度，但仍以可控为先。',
    '5. displayLocations 默认建议 ribbon-more；只有需求明显强调高频入口时，才建议 ribbon-main 或 context-menu。',
    '6. 除非任务天然需要机器可解析结构，否则 outputFormat 不要使用 json。',
    '7. 若用户需求明显是“生成报告/审计/调研/周报/月报/评估/审查/分析报告”，应优先启用 reportSettings，并推荐合适的报告类型、报告格式和报告附加提示词。',
    '8. reportSettings.enabled 为 true 时，inputSource 应优先为 document，outputFormat 应优先为 markdown。',
    '9. 返回必须是 JSON 对象，不要输出 Markdown、不要解释过程、不要附加代码块标记。',
    '允许的枚举值如下：',
    `- inputSource: ${INPUT_SOURCE_OPTIONS.map(item => item.value).join(' | ')}`,
    `- outputFormat: ${OUTPUT_FORMAT_OPTIONS.map(item => item.value).join(' | ')}`,
    `- documentAction: ${DOCUMENT_ACTION_OPTIONS.map(item => item.value).join(' | ')}`,
    `- displayLocations: ${ASSISTANT_DISPLAY_LOCATION_OPTIONS.map(item => item.value).join(' | ')}`,
    `- reportSettings.type: ${REPORT_TYPE_OPTIONS.map(item => item.value).join(' | ')}`,
    '请输出如下 JSON 结构：',
    JSON.stringify({
      summary: '一句话说明推荐结果与适用场景',
      usageNotes: '可选；补充说明为什么这样设置，或提醒用户关注的地方',
      recommendedConfig: {
        name: '助手名称',
        description: '功能说明',
        persona: '角色设定',
        systemPrompt: '系统提示词',
        userPromptTemplate: '用户提示词模板，通常应包含 {{input}}',
        inputSource: 'selection-preferred',
        outputFormat: 'markdown',
        documentAction: 'insert',
        temperature: 0.3,
        displayLocations: ['ribbon-more'],
        targetLanguage: '中文',
        reportSettings: {
          enabled: false,
          type: 'general-analysis-report',
          customType: '',
          template: '# {{reportType}}',
          prompt: '可选的报告附加要求'
        },
        mediaOptions: {
          aspectRatio: '16:9',
          duration: '30s',
          voiceStyle: '专业自然'
        }
      }
    }, null, 2)
  ].join('\n')
}

function buildUserPrompt({ requirementText, draftSnapshot, resolvedModelState, targetLabel }) {
  return [
    `请根据下面要求，为“${String(targetLabel || '当前智能助手').trim() || '当前智能助手'}”生成一套推荐配置。`,
    '',
    '【用户要求】',
    String(requirementText || '').trim(),
    '',
    '【当前草稿（可作为上下文，若已有内容请尽量在此基础上优化）】',
    JSON.stringify({
      name: draftSnapshot?.name || '',
      description: draftSnapshot?.description || '',
      persona: draftSnapshot?.persona || '',
      systemPrompt: draftSnapshot?.systemPrompt || '',
      userPromptTemplate: draftSnapshot?.userPromptTemplate || '',
      inputSource: draftSnapshot?.inputSource || '',
      outputFormat: draftSnapshot?.outputFormat || '',
      documentAction: draftSnapshot?.documentAction || '',
      temperature: draftSnapshot?.temperature,
      displayLocations: draftSnapshot?.displayLocations || [],
      targetLanguage: draftSnapshot?.targetLanguage || '',
      reportSettings: draftSnapshot?.reportSettings || {},
      mediaOptions: draftSnapshot?.mediaOptions || {}
    }, null, 2),
    '',
    '【当前推荐所使用的模型来源】',
    JSON.stringify({
      modelDisplayName: resolvedModelState?.model?.name || resolvedModelState?.model?.modelId || '',
      providerId: resolvedModelState?.model?.providerId || '',
      source: resolvedModelState?.source || ''
    }, null, 2),
    '',
    '请直接返回 JSON 对象。'
  ].join('\n')
}

async function executeRecommendationTask(options = {}) {
  const requirementText = String(options.requirementText || '').trim()
  if (!requirementText) {
    throw new Error('请先输入你的助手需求，再进行智能推荐')
  }
  const resolvedModelState = options.resolvedModelState || {}
  const model = resolvedModelState.model
  if (!model?.providerId || !model?.modelId) {
    throw new Error('未找到可用的对话模型，请先在默认设置或当前助手中指定模型')
  }
  const draftSnapshot = cloneValue(options.draftSnapshot || createCustomAssistantDraft())
  const taskTitle = String(options.taskTitle || '智能推荐提示词').trim() || '智能推荐提示词'
  const recommendationTargetKey = String(options.targetKey || 'create-custom-assistant')
  const recommendationTargetLabel = String(options.targetLabel || '当前助手').trim() || '当前助手'
  const recommendationModelSelectionMode = options.modelSelectionMode === 'manual' ? 'manual' : 'inherit'
  const recommendationModelResolvedSource = String(resolvedModelState.source || 'explicit')
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt({
    requirementText,
    draftSnapshot,
    resolvedModelState,
    targetLabel: recommendationTargetLabel
  })
  const onTaskCreated = typeof options.onTaskCreated === 'function' ? options.onTaskCreated : null

  const taskId = addTask({
    type: ASSISTANT_PROMPT_RECOMMENDATION_TASK_TYPE,
    title: taskTitle,
    status: 'running',
    progress: 8,
    data: {
      assistantId: ASSISTANT_PROMPT_RECOMMENDATION_ASSISTANT_ID,
      inputPreview: getPreview(requirementText, 220),
      renderedSystemPrompt: systemPrompt,
      renderedUserPrompt: userPrompt,
      modelId: model.id,
      modelDisplayName: model.name || model.modelId,
      modelProviderId: model.providerId,
      modelSource: resolvedModelState.source || 'explicit',
      recommendationModelSelectionMode,
      recommendationModelResolvedSource,
      progressStage: 'preparing',
      recommendationRequirement: requirementText,
      recommendationTargetKey,
      recommendationTargetLabel
    }
  })
  onTaskCreated?.(taskId)

  const runState = {
    taskId,
    cancelled: false,
    abortController: typeof AbortController !== 'undefined' ? new AbortController() : null
  }
  activeRecommendationRuns.set(taskId, runState)

  try {
    updateTask(taskId, {
      progress: 28,
      data: {
        assistantId: ASSISTANT_PROMPT_RECOMMENDATION_ASSISTANT_ID,
        inputPreview: getPreview(requirementText, 220),
        renderedSystemPrompt: systemPrompt,
        renderedUserPrompt: userPrompt,
        modelId: model.id,
        modelDisplayName: model.name || model.modelId,
        modelProviderId: model.providerId,
        modelSource: resolvedModelState.source || 'explicit',
        recommendationModelSelectionMode,
        recommendationModelResolvedSource,
        progressStage: 'calling_model',
        recommendationRequirement: requirementText,
        recommendationTargetKey,
        recommendationTargetLabel
      }
    })
    throwIfCancelled(runState)

    const rawOutput = await chatCompletion({
      providerId: model.providerId,
      modelId: model.modelId,
      temperature: 0.2,
      signal: runState.abortController?.signal,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })

    throwIfCancelled(runState)
    updateTask(taskId, {
      progress: 66,
      data: {
        assistantId: ASSISTANT_PROMPT_RECOMMENDATION_ASSISTANT_ID,
        inputPreview: getPreview(requirementText, 220),
        renderedSystemPrompt: systemPrompt,
        renderedUserPrompt: userPrompt,
        outputPreview: getPreview(rawOutput, 220),
        modelId: model.id,
        modelDisplayName: model.name || model.modelId,
        modelProviderId: model.providerId,
        modelSource: resolvedModelState.source || 'explicit',
        recommendationModelSelectionMode,
        recommendationModelResolvedSource,
        progressStage: 'parsing_result',
        recommendationRequirement: requirementText,
        recommendationTargetKey,
        recommendationTargetLabel,
        fullOutput: String(rawOutput || '')
      }
    })

    const parsed = parseRecommendationResponse(rawOutput)
    const normalized = normalizeRecommendedConfig(parsed, draftSnapshot)

    throwIfCancelled(runState)
    updateTask(taskId, {
      progress: 88,
      data: {
        assistantId: ASSISTANT_PROMPT_RECOMMENDATION_ASSISTANT_ID,
        inputPreview: getPreview(requirementText, 220),
        renderedSystemPrompt: systemPrompt,
        renderedUserPrompt: userPrompt,
        outputPreview: getPreview(rawOutput, 220),
        modelId: model.id,
        modelDisplayName: model.name || model.modelId,
        modelProviderId: model.providerId,
        modelSource: resolvedModelState.source || 'explicit',
        recommendationModelSelectionMode,
        recommendationModelResolvedSource,
        progressStage: 'applying_result',
        recommendationRequirement: requirementText,
        recommendationTargetKey,
        recommendationTargetLabel,
        fullOutput: String(rawOutput || ''),
        recommendationSummary: normalized.summary,
        recommendationNotes: normalized.usageNotes,
        recommendedConfig: normalized.appliedConfig
      }
    })

    updateTask(taskId, {
      status: 'completed',
      progress: 100,
      data: {
        assistantId: ASSISTANT_PROMPT_RECOMMENDATION_ASSISTANT_ID,
        inputPreview: getPreview(requirementText, 220),
        renderedSystemPrompt: systemPrompt,
        renderedUserPrompt: userPrompt,
        outputPreview: getPreview(rawOutput, 220),
        modelId: model.id,
        modelDisplayName: model.name || model.modelId,
        modelProviderId: model.providerId,
        modelSource: resolvedModelState.source || 'explicit',
        recommendationModelSelectionMode,
        recommendationModelResolvedSource,
        progressStage: 'completed',
        recommendationRequirement: requirementText,
        recommendationTargetKey,
        recommendationTargetLabel,
        fullOutput: String(rawOutput || ''),
        recommendationSummary: normalized.summary,
        recommendationNotes: normalized.usageNotes,
        recommendedConfig: normalized.appliedConfig,
        commentPreview: `已根据输入要求生成推荐提示词、助手设置及报告配置，可重新应用到“${recommendationTargetLabel}”，记得点击保存。`,
        applyResult: {
          mode: 'settings-apply',
          message: `已生成可应用到“${recommendationTargetLabel}”的推荐设置和报告配置，应用后仍需手动保存。`
        }
      }
    })

    return {
      taskId,
      requirementText,
      rawOutput: String(rawOutput || ''),
      appliedConfig: normalized.appliedConfig,
      recommendationTargetKey,
      recommendationTargetLabel,
      recommendationModelSelectionMode,
      recommendationModelResolvedSource,
      recommendationSummary: normalized.summary,
      recommendationNotes: normalized.usageNotes
    }
  } catch (error) {
    if (isTaskCancelledError(error) || runState.cancelled) {
      updateTask(taskId, {
        status: 'cancelled',
        error: '任务已停止',
        progress: 100,
        data: {
          assistantId: ASSISTANT_PROMPT_RECOMMENDATION_ASSISTANT_ID,
          inputPreview: getPreview(requirementText, 220),
          renderedSystemPrompt: systemPrompt,
          renderedUserPrompt: userPrompt,
          modelId: model.id,
          modelDisplayName: model.name || model.modelId,
          modelProviderId: model.providerId,
          modelSource: resolvedModelState.source || 'explicit',
          recommendationModelSelectionMode,
          recommendationModelResolvedSource,
          progressStage: 'cancelled',
          recommendationRequirement: requirementText,
          recommendationTargetKey,
          recommendationTargetLabel
        }
      })
      throw createCancelError()
    }
    updateTask(taskId, {
      status: 'failed',
      error: error?.message || String(error),
      progress: 100,
      data: {
        assistantId: ASSISTANT_PROMPT_RECOMMENDATION_ASSISTANT_ID,
        inputPreview: getPreview(requirementText, 220),
        renderedSystemPrompt: systemPrompt,
        renderedUserPrompt: userPrompt,
        modelId: model.id,
        modelDisplayName: model.name || model.modelId,
        modelProviderId: model.providerId,
        modelSource: resolvedModelState.source || 'explicit',
        recommendationModelSelectionMode,
        recommendationModelResolvedSource,
        progressStage: 'failed',
        recommendationRequirement: requirementText,
        recommendationTargetKey,
        recommendationTargetLabel
      }
    })
    throw error
  } finally {
    activeRecommendationRuns.delete(taskId)
  }
}

export function startAssistantPromptRecommendationTask(options = {}) {
  let taskId = ''
  const promise = executeRecommendationTask({
    ...options,
    onTaskCreated: (id) => {
      taskId = id
      options.onTaskCreated?.(id)
    }
  })
  return { taskId, promise }
}

export function stopAssistantPromptRecommendationTask(taskId) {
  const runState = activeRecommendationRuns.get(String(taskId || ''))
  if (!runState) return false
  runState.cancelled = true
  runState.abortController?.abort?.()
  return true
}
