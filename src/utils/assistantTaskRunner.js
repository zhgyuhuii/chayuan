import { buildChatCompletionsRequestSnapshot, chatCompletion } from './chatApi.js'
import { runConcurrently } from './concurrentRunner.js'
import { startTimer as startPerfTimer } from './perfTracker.js'
import { getFlatModelsFromSettings, parseModelCompositeId } from './modelSettings.js'
import { addTask, updateTask, getTaskById } from './taskListStore.js'
import {
  applyDocumentAction,
  applyMediaDocumentAction,
  getActiveDocument,
  getSelection,
  resolveDocumentInput,
  textLooksLikePlanStatsJson
} from './documentActions.js'
import { inferModelType } from './modelTypeUtils.js'
import { getDocumentChunksWithPositions, getSelectionChunksWithPositions } from './documentChunker.js'
import { getChunkSettings } from './chunkSettings.js'
import {
  getBuiltinAssistantDefinition,
  getBuiltinRibbonAssistantIds,
  mergeDefinitionRuntimeCapabilities
} from './assistantRegistry.js'
import {
  ANALYSIS_AI_TRACE_CHECK_ID,
  ANALYSIS_SECRET_KEYWORD_EXTRACT_ID,
  ANALYSIS_SECURITY_CHECK_ID,
  collectAiTraceHitFragmentsFromPlan,
  collectSecretKeywordTermsFromPlan,
  collectSecurityCheckHitFragmentsFromPlan,
  isAnchoredCommentDocumentAction
} from './structuredCommentPolicy.js'
import {
  getAssistantSetting,
  getConfiguredAssistantModelId,
  getCustomAssistantById
} from './assistantSettings.js'
import { classifyMultimodalError, generateMultimodalAsset } from './multimodalTaskRunner.js'
import {
  getReportTypeLabel,
  normalizeReportSettings,
  renderReportTemplate
} from './reportSettings.js'
import {
  assessStructuredBatchQuality,
  buildBatchRecord,
  buildStructuredBatchInstruction,
  buildStructuredExecutionPlan,
  getStructuredAssistantMode,
  getStructuredPlanOutputText,
  getStructuredPlanPreview,
  parseStructuredBatchResponse
} from './assistantStructuredPipeline.js'
import {
  buildGeneratedArtifactDescriptor,
  mergeTaskOrchestrationData
} from './taskOrchestrationMeta.js'
import { createRenderedArtifact } from './artifactRenderer.js'
import { bindArtifactsToOwner } from './artifactStore.js'
import {
  applyDocumentProcessingPlan,
  buildDocumentProcessingExecutionPlan
} from './documentProcessingPipeline.js'
import { appendEvaluationRecord, buildDocumentTaskEvaluationRecord } from './evaluationStore.js'
import { showSafeErrorDetail } from './safeErrorDialog.js'
// P1 接入:把 task 完成事件转写成 SignalStore 的 'task' 信号,供 RACE 评估器消费。
import { appendSignal } from './assistant/evolution/signalStore.js'

const BUILTIN_RIBBON_ASSISTANT_SET = new Set(getBuiltinRibbonAssistantIds())
const activeAssistantRuns = new Map()

function probeWritableAnchor() {
  const doc = getActiveDocument()
  if (!doc?.Content) {
    return { ok: false, reason: '当前没有可写入的文档内容范围' }
  }
  const selection = getSelection()
  const range = selection?.Range || doc.Content
  if (!range) {
    return { ok: false, reason: '当前无法定位可写入位置（选区与文档范围均不可用）' }
  }
  try {
    const start = Number(range.Start)
    const end = Number(range.End)
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return { ok: false, reason: '当前可写入位置无效（坐标不可用）' }
    }
  } catch (_) {
    return { ok: false, reason: '当前无法读取写入位置坐标' }
  }
  return { ok: true, reason: '' }
}

function yieldToUI(delay = 0) {
  return new Promise(resolve => setTimeout(resolve, delay))
}

function persistDocumentEvaluation(options = {}) {
  try {
    appendEvaluationRecord(buildDocumentTaskEvaluationRecord(options))
  } catch (_) {
    // Ignore evaluation persistence failures so task execution is not interrupted.
  }
  // P1 接入:把 task 完成同步到 SignalStore,作为 RACE 评估的真实数据源。
  // 失败容忍 — SignalStore 内部 try/catch,不会反向阻塞任务。
  try {
    const status = String(options?.status || '').trim()
    const isFailure = status === 'failed' || status === 'cancelled' || options?.success === false
    const downgraded = !!options?.downgradeReason
    const writeTargets = Array.isArray(options?.writeTargets) ? options.writeTargets : []
    const anchorHit = writeTargets.length > 0 && !writeTargets.some(t => t?.downgraded)

    appendSignal({
      type: 'task',
      assistantId: options?.assistantId,
      version: options?.assistantVersion,
      taskId: options?.taskId,
      input: options?.inputText,
      output: options?.outputText,
      duration: Number(options?.elapsedMs) || 0,
      tokens: Number(options?.tokens) || 0,
      success: !isFailure,
      failureCode: status === 'failed'
        ? (options?.failureCode || 'task_failed')
        : (status === 'cancelled' ? 'task_cancelled' : ''),
      documentAction: options?.documentAction,
      userNote: options?.downgradeReason || '',
      metadata: {
        downgraded,
        anchor_hit: anchorHit,
        writeTargetCount: writeTargets.length,
        launchSource: options?.launchSource,
        pendingApply: options?.pendingApply === true
      }
    })
  } catch (_) {
    // 信号采集失败不阻塞任务
  }
}

function createAssistantPlaceholderTask(assistantId, overrides = {}) {
  const fallbackTitle = String(overrides.taskTitle || '').trim() || '智能助手'
  return addTask({
    type: getTaskType(String(assistantId || '').trim() || 'assistant'),
    title: fallbackTitle,
    status: 'running',
    progress: 1,
    data: {
      assistantId: String(assistantId || '').trim(),
      ...mergeTaskOrchestrationData({}, {
        entry: overrides.launchSource === 'ribbon-direct' ? 'ribbon-direct' : 'dialog',
        primaryIntent: 'assistant-task',
        executionMode: 'runner-task',
        launchSource: overrides.launchSource,
        strictAssistantDefaults: overrides.strictAssistantDefaults === true,
        originMessageId: overrides.taskData?.originMessageId,
        originRequirementText: overrides.taskData?.originRequirementText
      }, {
        progressStage: 'preparing'
      }),
      progressEvents: ['任务已创建，正在准备助手执行环境...'],
      items: []
    }
  })
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

function formatAssistantErrorFull(err, depth = 0) {
  if (err == null) return '未知错误'
  if (depth > 6) return '[cause 嵌套过深，已省略]'
  if (typeof err === 'string') return err
  const name = err.name || 'Error'
  const msg = err.message != null ? String(err.message) : String(err)
  const stack = err.stack ? String(err.stack) : ''
  let out = `${name}: ${msg}`
  if (stack) out += `\n\n${stack}`
  try {
    if (err.cause != null) {
      out += `\n\n[cause]\n${formatAssistantErrorFull(err.cause, depth + 1)}`
    }
  } catch (_) {}
  // 勿对整颗 err 做 JSON.stringify：可能含循环引用或超大对象，诱发宿主在桥接层不稳定。
  if (typeof err === 'object' && err !== null) {
    try {
      const lines = []
      for (const k of Object.keys(err)) {
        if (k === 'stack' || k === 'message' || k === 'cause' || k === 'name') continue
        const v = err[k]
        if (v == null) {
          lines.push(`${k}: ${v}`)
          continue
        }
        const t = typeof v
        if (t === 'string') {
          lines.push(`${k}: ${v.length > 500 ? `${v.slice(0, 500)}…` : v}`)
        } else if (t === 'number' || t === 'boolean') {
          lines.push(`${k}: ${v}`)
        } else if (t === 'object') {
          lines.push(`${k}: [object]`)
        } else {
          lines.push(`${k}: ${String(v).slice(0, 200)}`)
        }
      }
      if (lines.length > 0) {
        let block = lines.join('\n')
        if (block.length > 2048) block = `${block.slice(0, 2048)}\n…[details 已截断]`
        out += `\n\n[details]\n${block}`
      }
    } catch (_) {}
  }
  return out
}

/**
 * 必须走「结构化 JSON 分批 + executionPlan」的助手：精确定位修订或程序依赖的 JSON 输出。
 * 脱密/表单等对话框链路仍走助手设置；占位脱密与密码复原由专用对话框与 documentDeclassifyService 处理。
 */
/** 输出必须为可解析 JSON 且由结构化管线消费的助手（修订类见 revision-edits） */
const STRUCTURED_PIPELINE_REQUIRED_IDS = new Set([
  ANALYSIS_SECRET_KEYWORD_EXTRACT_ID,
  'analysis.form-field-extract',
  'analysis.form-field-audit'
])

/**
 * 默认聊天类助手：先模型生成正文，再按助手设置的文档动作一次性写回（applyDocumentAction），
 * 避免结构化 executionPlan 二次遍历文档诱发 WPS 宿主不稳定。
 * 报告模式开启时仍走下方结构化分批；修订类与上表助手除外。
 * 凡「添加批注 / 链接批注」且非修订类助手，必须走结构化分批，否则易变成整篇一条批注。
 */
function shouldUsePlainDocumentPipeline(assistantId, reportSettings, documentAction = '') {
  if (reportSettings?.enabled === true) return false
  const id = String(assistantId || '').trim()
  if (STRUCTURED_PIPELINE_REQUIRED_IDS.has(id)) return false
  if (getStructuredAssistantMode(assistantId) === 'revision-edits') return false
  const act = String(documentAction || '').trim()
  if (isAnchoredCommentDocumentAction(act)) {
    return false
  }
  return true
}

function getAssistantLabelForError(assistantId) {
  try {
    const resolved = getAssistantDefinition(assistantId)
    const d = resolved?.definition
    return String(d?.shortLabel || d?.label || d?.name || '').trim() || '助手'
  } catch (_) {
    return '助手'
  }
}

/** 任意助手任务失败时弹出可复制详情（延迟展示，避开 WPS 桥回调栈顶） */
function showAssistantTaskErrorDialog(assistantId, err) {
  let detail = ''
  try {
    detail = formatAssistantErrorFull(err)
  } catch (e) {
    detail = String(err ?? '')
  }
  const label = getAssistantLabelForError(assistantId)
  setTimeout(() => {
    try {
      showSafeErrorDetail({
        title: `${label}执行出错`,
        detail,
        merge: false
      })
    } catch (e) {
      try {
        console.error('[助手任务] 无法显示错误浮层', e, detail)
      } catch (_) {}
    }
  }, 300)
}

function throwIfCancelled(runState) {
  if (runState?.cancelled) throw createCancelError()
}

function interpolateTemplate(template, variables) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key]
    return value == null ? '' : String(value)
  })
}

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function mergeAssistantRuntimeConfig(config = {}, overrides = {}) {
  const merged = {
    ...deepClone(config || {}),
    ...deepClone(overrides || {})
  }
  if (overrides?.reportSettings && typeof overrides.reportSettings === 'object') {
    merged.reportSettings = {
      ...(config?.reportSettings && typeof config.reportSettings === 'object' ? deepClone(config.reportSettings) : {}),
      ...deepClone(overrides.reportSettings)
    }
  }
  return merged
}

function getOutputFormatInstruction(outputFormat) {
  switch (outputFormat) {
    case 'markdown':
      return '请使用清晰、规范的 Markdown 输出。'
    case 'bullet-list':
      return '请使用项目符号列表输出。'
    case 'json':
      return '请只输出合法 JSON，不要附加说明。'
    case 'plain':
    default:
      return '请直接输出结果，不要附加多余解释。'
  }
}

function buildStructuredJsonInstruction(schemaText) {
  const normalized = String(schemaText || '').trim()
  if (!normalized) return ''
  return [
    '你必须输出合法 JSON，并严格遵守以下字段结构约束。',
    '不要输出 Markdown 代码块，不要输出 JSON 之外的解释。',
    '字段结构约束：',
    normalized
  ].join('\n')
}

function getTaskBestPracticeInstruction(assistantId) {
  if (assistantId === 'translate') {
    return '翻译时必须保持事实、数字、日期、机构名称和专有名词准确；优先保留原文结构与格式。'
  }
  if (assistantId === 'summary') {
    return '摘要时优先提炼结论、关键事实、风险与建议动作；不要遗漏影响判断的重要条件。'
  }
  if (assistantId === 'analysis.paragraph-numbering-check') {
    return '检查段落序号时，优先识别层级一致性、编号连续性和标点统一性；不要把风格差异误判为错误。'
  }
  if (assistantId === 'analysis.security-check') {
    return '保密检查时，关键词命中必须结合上下文分级判断；避免武断下结论，并明确哪些内容需要人工复核。'
  }
  if (assistantId === ANALYSIS_AI_TRACE_CHECK_ID) {
    return 'AI 痕迹检查须保守、可复核：只标出可指向具体原文的句式或结构特征，避免把正当公文套话或个人写作习惯一律判为 AI；每条必须能在 ChunkText 中逐字命中。'
  }
  if (assistantId === 'analysis.secret-keyword-extract') {
    return '提取涉密关键词时，term 必须是原文中的连续片段，输出必须是合法 JSON，且 replacementToken 需要短、唯一、便于程序替换。'
  }
  if (assistantId === 'analysis.form-field-extract') {
    return '提取表单字段时，应优先输出结构化字段定义和实例列表；相同语义字段要合并，输出必须是合法 JSON。'
  }
  if (assistantId === 'analysis.form-field-audit') {
    return '执行文档审计时，应基于给定规则和字段实例做可复核判断；每条问题都要给出原因、风险级别和改进建议，并只输出合法 JSON。'
  }
  if (assistantId === 'spell-check') {
    return '仅输出明确语言错误，不要把风格偏好或主观润色建议误判为错误。'
  }
  if (assistantId === 'text-to-image') {
    return '输出应尽量可直接用于图像模型推理，包含主体、场景、构图、风格、材质、镜头、光线和负向约束。'
  }
  if (assistantId === 'text-to-audio') {
    return '输出应优先适配语音播报和 TTS，保证断句自然、节奏清晰、难词可读。'
  }
  if (assistantId === 'text-to-video') {
    return '输出应包含视频创意、镜头语言、旁白和转场节奏，适合直接进入视频生成或制作流程。'
  }
  if (assistantId.startsWith('analysis.')) {
    return '在改写或分析时，必须保持原文事实、数字、主体和逻辑关系不失真，不编造新信息。'
  }
  return '回答应准确、克制、可执行，并尽量直接适配文档落地场景。'
}

function getModelByCompositeId(modelType, compositeId) {
  if (!compositeId) return null
  const flat = getFlatModelsFromSettings(modelType)
  const found = flat.find(item => item.id === compositeId)
  if (found) return found
  const parsed = parseModelCompositeId(compositeId)
  if (!parsed) return null
  const inferredType = inferModelType(parsed.modelId)
  if (modelType && inferredType !== modelType) return null
  return {
    id: compositeId,
    providerId: parsed.providerId,
    modelId: parsed.modelId,
    name: parsed.modelId,
    type: modelType || 'chat'
  }
}

function resolveModel(config, definition, options = {}) {
  const modelType = config.modelType || definition?.modelType || 'chat'
  const flat = getFlatModelsFromSettings(modelType)
  const explicitModelId = String(config.modelId || '').trim()
  if (explicitModelId) {
    const configured = getModelByCompositeId(modelType, explicitModelId)
    if (configured) {
      return { model: configured, source: 'explicit' }
    }
  }
  const conversationModelId = String(options.conversationModelId || options.fallbackModelId || '').trim()
  if (conversationModelId) {
    const conversationModel = getModelByCompositeId(modelType, conversationModelId)
    if (conversationModel) {
      return { model: conversationModel, source: 'conversation-selected' }
    }
  }
  const categoryDefaultId = getConfiguredAssistantModelId(definition?.id)
  if (categoryDefaultId) {
    const configured = getModelByCompositeId(modelType, categoryDefaultId)
    if (configured) {
      return { model: configured, source: 'category-default' }
    }
  }
  if (flat[0]) {
    return { model: flat[0], source: 'fallback-first-available' }
  }
  return null
}

function buildAssistantSystemPrompt(config, definition) {
  const sections = []
  if (config.persona) {
    sections.push(`角色设定：${config.persona}`)
  }
  if (config.systemPrompt) {
    sections.push(config.systemPrompt)
  }
  sections.push(getTaskBestPracticeInstruction(definition?.id || ''))
  sections.push(getOutputFormatInstruction(config.outputFormat))
  sections.push(buildStructuredJsonInstruction(config.workflowJsonSchemaText))
  if (definition?.shortLabel) {
    sections.push(`当前任务：${definition.shortLabel}`)
  }
  return sections.filter(Boolean).join('\n\n')
}

function getSelectionPreview(text) {
  const content = String(text || '').trim()
  return content.length > 120 ? `${content.slice(0, 120)}...` : content
}

function mediaKindToLabel(mediaKind) {
  if (mediaKind === 'image') return '图片'
  if (mediaKind === 'audio') return '音频'
  return '视频'
}

function getMediaCompletionComment(mediaKind, title) {
  const mediaLabel = mediaKindToLabel(mediaKind)
  return `${title || '智能助手'}已完成，已生成${mediaLabel}文件。`
}

function buildAssistantCommentSummary(assistantId, output, taskTitle, documentAction = '') {
  const text = String(output || '').trim()
  const title = String(taskTitle || '').trim() || '智能助手'
  const anchoredComment =
    isAnchoredCommentDocumentAction(documentAction) && getStructuredAssistantMode(assistantId) !== 'revision-edits'
  if (anchoredComment) {
    if (!text || textLooksLikePlanStatsJson(text)) {
      return '未在原文上生成可定位的批注锚点，未添加批注。详见任务清单。'
    }
    if (assistantId === ANALYSIS_SECRET_KEYWORD_EXTRACT_ID) {
      const j = safeParseAssistantJson(text)
      if (j && Array.isArray(j.keywords) && j.keywords.length === 0) {
        return '未发现需脱密的涉密关键词，未添加批注。详见任务清单。'
      }
    }
  }
  if (!text) {
    return `${title}已完成，请在任务清单中查看详细结果。`
  }
  if (assistantId === ANALYSIS_AI_TRACE_CHECK_ID) {
    if (/未发现明显\s*AI\s*痕迹|未发现明显的\s*AI\s*生成痕迹|未见明显\s*AI\s*痕迹/u.test(text)) {
      return '未发现明显 AI 生成痕迹。详细分析可在任务清单中查看。'
    }
    if (/##\s*高疑似项\s*\n(?:-|\S)/.test(text) && !/##\s*高疑似项\s*\n\s*无/.test(text)) {
      return '发现高疑似 AI 生成痕迹，建议优先人工复核。详细依据与修改建议可在任务清单中查看。'
    }
    if (/##\s*中疑似项\s*\n(?:-|\S)/.test(text) && !/##\s*中疑似项\s*\n\s*无/.test(text)) {
      return '发现中疑似 AI 生成痕迹。详细分析可在任务清单中查看。'
    }
    return '已完成 AI 痕迹检查，请在任务清单中查看疑似项与改写建议。'
  }
  if (assistantId === ANALYSIS_SECURITY_CHECK_ID) {
    if (/未发现明显保密风险/.test(text)) {
      return '未发现明显保密风险。详细审查结果可在任务清单中查看。'
    }
    if (/##\s*高风险项\s*\n(?:-|\S)/.test(text) && !/##\s*高风险项\s*\n\s*无/.test(text)) {
      return '发现高风险保密项，请优先人工复核。详细命中片段与处理建议可在任务清单中查看。'
    }
    if (/##\s*中风险项\s*\n(?:-|\S)/.test(text) && !/##\s*中风险项\s*\n\s*无/.test(text)) {
      return '发现中风险或需复核的保密项。详细审查结果可在任务清单中查看。'
    }
    return '已完成保密检查，请在任务清单中查看详细命中项与处理建议。'
  }
  if (assistantId === 'analysis.paragraph-numbering-check') {
    if (/未发现明显的段落序号格式问题/.test(text)) {
      return '未发现明显的段落序号格式问题。详细检查结果可在任务清单中查看。'
    }
    return '已完成段落序号格式检查，请在任务清单中查看详细问题与统一建议。'
  }
  if (assistantId === 'analysis.comment-explain') {
    return '已生成批注解释，详细说明可在任务清单中查看。'
  }
  if (assistantId === 'analysis.hyperlink-explain') {
    return '已生成超链接解释，详细说明可在任务清单中查看。'
  }
  return `${title}已完成，请在任务清单中查看详细结果。`
}

function getEffectiveReportSettings(config) {
  return normalizeReportSettings(config?.reportSettings)
}

function buildReportSystemPrompt(reportSettings, reportTypeLabel) {
  if (!reportSettings?.enabled) return ''
  const sections = [
    `当前输出模式：生成${reportTypeLabel}。`,
    '请站在专业报告撰写者视角输出，结论必须有事实依据，缺失信息需明确标注“原文未说明”或“需人工复核”。',
    '报告应优先保留关键事实、时间、数字、责任主体、风险判断和建议动作，不得编造原文不存在的信息。'
  ]
  if (reportSettings.prompt) {
    sections.push(`报告附加要求：${reportSettings.prompt}`)
  }
  return sections.join('\n')
}

function buildReportUserPrompt(basePrompt, inputText, reportSettings, variables = {}) {
  if (!reportSettings?.enabled) return basePrompt
  const reportTypeLabel = getReportTypeLabel(reportSettings.type, reportSettings.customType)
  const renderedTemplate = renderReportTemplate(reportSettings.template, {
    ...variables,
    reportType: reportTypeLabel
  }).trim()
  const sections = [
    `请基于全文材料生成一份${reportTypeLabel}。`,
    '生成要求：',
    '1. 先完整理解全文，再做结构化归纳和专业判断。',
    '2. 结论、问题、风险、建议必须与原文证据对应，不得虚构。',
    '3. 若材料不足以支持明确结论，请在对应位置写明“需人工复核”或“原文未说明”。',
    `4. 严格按以下报告格式输出，不要省略一级标题。`,
    '',
    '报告格式：',
    renderedTemplate || `# ${reportTypeLabel}`,
    '',
    '原始任务要求：',
    String(basePrompt || '').trim() || '请根据全文材料输出专业报告。',
    '',
    '材料全文：',
    '---',
    String(inputText || '').trim(),
    '---'
  ]
  return sections.join('\n')
}

function buildRequirementAwareUserPrompt(basePrompt, requirementText, reportSettings) {
  const normalizedRequirement = String(requirementText || '').trim()
  if (reportSettings?.enabled) return basePrompt
  if (!normalizedRequirement) return basePrompt
  return [
    `本次用户要求：${normalizedRequirement}`,
    '',
    '请严格根据这次要求处理下面内容；不要忽略用户要求，也不要只做泛化回复。',
    '',
    basePrompt
  ].join('\n')
}

function buildAssistantApplyCommentText({ output, summaryText, action }) {
  let normalizedOutput = String(output || '').trim()
  if (textLooksLikePlanStatsJson(normalizedOutput)) {
    normalizedOutput = ''
  }
  const normalizedSummary = String(summaryText || '').trim()
  if (action === 'comment' || action === 'link-comment') {
    return `${normalizedOutput || normalizedSummary}`.trim()
  }
  if (action === 'comment-replace') {
    return `${normalizedSummary || '已根据要求处理原文，以下为本次结果：'}\n${normalizedOutput}`.trim()
  }
  return `${normalizedSummary || normalizedOutput}`.trim()
}

function getEffectiveStructuredTaskOutput(executionPlan, assistantId, documentAction) {
  const raw = String(getStructuredPlanOutputText(executionPlan) || '').trim()
  const act = String(documentAction || '').trim()
  if (textLooksLikePlanStatsJson(raw)) {
    return ''
  }
  if (raw) return raw
  const anchoredComment =
    isAnchoredCommentDocumentAction(act) && getStructuredAssistantMode(assistantId) !== 'revision-edits'
  if (anchoredComment) {
    if (assistantId === ANALYSIS_SECRET_KEYWORD_EXTRACT_ID) {
      const terms = collectSecretKeywordTermsFromPlan(executionPlan)
      if (terms.length > 0) return terms.map(t => `· ${t}`).join('\n')
    }
    if (assistantId === ANALYSIS_SECURITY_CHECK_ID) {
      const hits = collectSecurityCheckHitFragmentsFromPlan(executionPlan)
      if (hits.length > 0) return hits.map(t => `· ${t}`).join('\n')
    }
    if (assistantId === ANALYSIS_AI_TRACE_CHECK_ID) {
      const hits = collectAiTraceHitFragmentsFromPlan(executionPlan)
      if (hits.length > 0) return hits.map(t => `· ${t}`).join('\n')
    }
    return ''
  }
  if (act === 'comment' || act === 'link-comment') return ''
  return JSON.stringify(executionPlan.summary || {}, null, 2)
}

function safeParseAssistantJson(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (_) {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim())
      } catch (_) {
        // Keep falling through to null when fenced JSON is still invalid.
      }
    }
  }
  return null
}

function getNonEmptyParagraphs(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(item => String(item || '').trim())
    .filter(Boolean)
}

function countChangedParagraphs(inputText, outputText) {
  const inputParagraphs = getNonEmptyParagraphs(inputText)
  const outputParagraphs = getNonEmptyParagraphs(outputText)
  if (inputParagraphs.length === 0 || outputParagraphs.length === 0) return 0
  const total = Math.max(inputParagraphs.length, outputParagraphs.length)
  let changed = 0
  for (let i = 0; i < total; i += 1) {
    if (String(inputParagraphs[i] || '').trim() !== String(outputParagraphs[i] || '').trim()) {
      changed += 1
    }
  }
  return changed
}

function buildAssistantResultSummaryData(assistantId, inputText, outputText, applyResult, executionPlan = null) {
  const parsed = safeParseAssistantJson(outputText)
  const planSummary = executionPlan?.summary || {}
  const action = String(applyResult?.action || '').trim()
  const writeTargetCount = Array.isArray(applyResult?.writeTargets) ? applyResult.writeTargets.length : 0
  const issueCount = Math.max(
    Array.isArray(parsed?.issues) ? parsed.issues.length : 0,
    Number(planSummary.operationCount || 0)
  )
  const keywordCount = Array.isArray(parsed?.keywords) ? parsed.keywords.length : 0
  const bookmarkAuditCount = Array.isArray(parsed?.bookmarkAudits) ? parsed.bookmarkAudits.length : 0
  const paragraphCount = getNonEmptyParagraphs(inputText).length
  const outputParagraphCount = getNonEmptyParagraphs(outputText).length
  const changedParagraphCount = countChangedParagraphs(inputText, outputText)
  const commentCount = Math.max(
    Number(applyResult?.commentCount || 0),
    ['comment', 'link-comment', 'comment-replace'].includes(action) ? 1 : 0
  )
  return {
    issueCount,
    keywordCount,
    bookmarkAuditCount,
    paragraphCount,
    outputParagraphCount,
    changedParagraphCount,
    commentCount,
    action,
    replacedCount: Number(applyResult?.replacedCount || 0),
    skippedCount: Number(applyResult?.skippedCount || 0),
    protectedParagraphCount: Number(applyResult?.protectedParagraphCount || 0),
    insertedParagraphCount: Number(applyResult?.insertedParagraphCount || 0),
    structuredBatchCount: Number(planSummary.batchCount || 0),
    structuredOperationCount: Number(planSummary.operationCount || 0),
    structuredResolvedOperationCount: Number(planSummary.resolvedOperationCount || 0),
    structuredUnresolvedOperationCount: Number(planSummary.unresolvedOperationCount || 0),
    structuredInvalidBatchCount: Number(planSummary.invalidBatchCount || 0),
    structuredCandidateOperationCount: Number(planSummary.candidateOperationCount || 0),
    structuredDeduplicatedOperationCount: Number(planSummary.deduplicatedOperationCount || 0),
    structuredArbitrationRejectedOperationCount: Number(planSummary.arbitrationRejectedOperationCount || 0),
    structuredArbitrationConflictRejectedCount: Number(planSummary.arbitrationConflictRejectedCount || 0),
    structuredHighQualityBatchCount: Number(planSummary.highQualityBatchCount || 0),
    structuredMediumQualityBatchCount: Number(planSummary.mediumQualityBatchCount || 0),
    structuredReviewQualityBatchCount: Number(planSummary.reviewQualityBatchCount || 0),
    structuredHighRiskBatchCount: Number(planSummary.highRiskBatchCount || 0),
    structuredMediumRiskBatchCount: Number(planSummary.mediumRiskBatchCount || 0),
    protectionApplied: applyResult?.protectionApplied === true,
    protectionMode: String(applyResult?.protectionMode || '').trim(),
    downgradedFrom: String(applyResult?.downgradedFrom || '').trim(),
    downgradeReason: String(applyResult?.downgradeReason || '').trim(),
    writeTargetCount,
    isTranslation: assistantId === 'translate',
    isRevisionLike: assistantId === 'analysis.correct-spell' || assistantId === 'spell-check' || /analysis\.(rewrite|formalize|polish|simplify|term-unify)/.test(String(assistantId || ''))
  }
}

function buildStructuredTaskSnapshot(executionPlan, applyResult, resultSummary, outputText) {
  if (!executionPlan) return null
  const operations = Array.isArray(executionPlan?.operations) ? executionPlan.operations : []
  const contentBlocks = Array.isArray(executionPlan?.contentBlocks) ? executionPlan.contentBlocks : []
  return {
    exportedAt: new Date().toISOString(),
    documentContext: executionPlan.documentContext || {},
    requestContext: executionPlan.requestContext || {},
    summary: executionPlan.summary || {},
    operationArbitration: executionPlan.operationArbitration || {},
    applyResult: applyResult || null,
    resultSummary: resultSummary || null,
    finalOutputPreview: getSelectionPreview(outputText || ''),
    operations: operations.slice(0, 80).map((operation) => ({
      operationId: String(operation?.operationId || '').trim(),
      type: String(operation?.type || '').trim(),
      target: String(operation?.target || '').trim(),
      paragraphIndex: Number.isFinite(Number(operation?.paragraphIndex)) ? Number(operation.paragraphIndex) : null,
      start: Number.isFinite(Number(operation?.start)) ? Number(operation.start) : null,
      end: Number.isFinite(Number(operation?.end)) ? Number(operation.end) : null,
      matchedBy: String(operation?.matchedBy || '').trim(),
      validationStatus: String(operation?.validationStatus || '').trim(),
      validationMessage: String(operation?.validationMessage || '').trim(),
      exactTextMatch: operation?.exactTextMatch === true,
      originalText: String(operation?.originalText || '').trim(),
      matchedText: String(operation?.matchedText || '').trim(),
      replacementText: String(operation?.replacementText || '').trim()
    })),
    rejectedOperations: Array.isArray(executionPlan?.operationArbitration?.rejectedOperations)
      ? executionPlan.operationArbitration.rejectedOperations.slice(0, 80).map((operation) => ({
        operationId: String(operation?.operationId || '').trim(),
        type: String(operation?.type || '').trim(),
        target: String(operation?.target || '').trim(),
        start: Number.isFinite(Number(operation?.start)) ? Number(operation.start) : null,
        end: Number.isFinite(Number(operation?.end)) ? Number(operation.end) : null,
        arbitrationStatus: String(operation?.arbitrationStatus || '').trim(),
        arbitrationReason: String(operation?.arbitrationReason || '').trim(),
        conflictWithOperationId: String(operation?.conflictWithOperationId || '').trim(),
        validationStatus: String(operation?.validationStatus || '').trim(),
        originalText: String(operation?.originalText || '').trim(),
        replacementText: String(operation?.replacementText || '').trim()
      }))
      : [],
    contentBlocks: contentBlocks.slice(0, 40).map((block) => ({
      chunkIndex: Number(block?.chunkIndex || 0),
      start: Number(block?.start || 0),
      end: Number(block?.end || 0),
      quality: block?.quality || null,
      riskProfile: block?.riskProfile || null,
      paragraphRefs: Array.isArray(block?.paragraphRefs) ? block.paragraphRefs : [],
      inputPreview: getSelectionPreview(String(block?.inputText || '').trim()),
      outputPreview: getSelectionPreview(String(block?.outputText || '').trim()),
      summary: String(block?.summary || '').trim()
    }))
  }
}

function buildExecutionPreviewBlocks(executionPlan) {
  const contentBlocks = Array.isArray(executionPlan?.contentBlocks) ? executionPlan.contentBlocks : []
  return contentBlocks.slice(0, 12).map((block, index) => ({
    id: String(block?.blockId || `block_${index + 1}`),
    title: `第 ${index + 1} 段`,
    kind: 'text-preview',
    inputText: String(block?.inputText || '').trim(),
    outputText: String(block?.outputText || '').trim(),
    paragraphIndex: Number.isFinite(Number(block?.paragraphIndex)) ? Number(block.paragraphIndex) : null,
    start: Number.isFinite(Number(block?.start)) ? Number(block.start) : null,
    end: Number.isFinite(Number(block?.end)) ? Number(block.end) : null,
    qualityLevel: String(block?.quality?.level || '').trim(),
    qualityMessage: String(block?.quality?.message || '').trim()
  })).filter(block => block.inputText || block.outputText)
}

function normalizeCustomAssistant(definition) {
  if (!definition) return null
  return {
    id: definition.id,
    label: definition.name || '智能文档助手',
    shortLabel: definition.name || '智能文档助手',
    icon: definition.icon || '🧠',
    group: 'custom',
    modelType: definition.modelType || 'chat',
    defaultModelCategory: null,
    supportsRibbon: true,
    description: definition.description || '',
    systemPrompt: definition.systemPrompt || '',
    userPromptTemplate: definition.userPromptTemplate || '{{input}}',
    ...(definition.runtimeCapabilities && typeof definition.runtimeCapabilities === 'object'
      ? { runtimeCapabilities: definition.runtimeCapabilities }
      : {})
  }
}

function getAssistantDefinition(assistantId) {
  const builtin = getBuiltinAssistantDefinition(assistantId)
  if (builtin) return { definition: builtin, config: getAssistantSetting(assistantId), source: 'builtin' }
  const custom = getCustomAssistantById(assistantId)
  if (custom) return { definition: normalizeCustomAssistant(custom), config: custom, source: 'custom' }
  return null
}

function getTaskType(assistantId) {
  // 通用文本助手统一归为 assistant，避免摘要/翻译走历史分流类型导致链路不一致。
  if (assistantId === 'summary' || assistantId === 'translate') return 'assistant'
  if (assistantId.startsWith('analysis.')) return 'analysis'
  if (assistantId.startsWith('text-to-')) return assistantId
  if (assistantId.startsWith('custom_')) return 'custom-assistant'
  return 'assistant'
}

function getStructuredChunks(inputInfo, assistantId, action) {
  const doc = getActiveDocument()
  if (!doc) return []
  const mode = getStructuredAssistantMode(assistantId)
  const chunkSettings = getChunkSettings()
  const splitStrategy = mode === 'revision-edits' && String(action || '').trim() === 'replace'
    ? (chunkSettings.splitStrategy || 'paragraph')
    : (chunkSettings.splitStrategy || 'paragraph')
  const overrides = {
    ...chunkSettings,
    splitStrategy
  }
  if (String(inputInfo?.source || '').trim() === 'selection') {
    return getSelectionChunksWithPositions(doc, getSelection(), overrides)
  }
  return getDocumentChunksWithPositions(doc, overrides)
}

function buildStructuredChunkLineMap(text) {
  const lines = []
  const raw = String(text || '')
  let cursor = 0
  const parts = raw.split('\n')
  parts.forEach((line, index) => {
    const start = cursor
    const end = cursor + line.length
    lines.push({
      lineIndex: index + 1,
      start,
      end,
      text: line
    })
    cursor = end + 1
  })
  return lines.slice(0, 24)
}

function buildStructuredChunkContext(chunk) {
  const normalizedText = String(chunk?.normalizedText || chunk?.text || '')
  const rawText = String(chunk?.text || '')
  const lineMap = buildStructuredChunkLineMap(normalizedText)
  const paragraphRefs = Array.isArray(chunk?.paragraphRefs) ? chunk.paragraphRefs.slice(0, 12) : []
  const relativeRangeMap = Array.isArray(chunk?.relativeRangeMap) ? chunk.relativeRangeMap.slice(0, 24) : []
  return [
    '以下是当前待处理文档块的结构化原文，请严格基于其中的 ChunkText 做定位。',
    '不要自行合并或忽略换行、斜杠、编号、括号、全半角标点。',
    `【ChunkMeta】${JSON.stringify({
      chunkIndex: Number(chunk?.index || 0) + 1,
      absoluteStart: Number(chunk?.start || 0),
      absoluteEnd: Number(chunk?.end || 0),
      normalizedLength: normalizedText.length,
      rawLength: rawText.length,
      paragraphCount: paragraphRefs.length
    })}`,
    `【ParagraphRefs】${JSON.stringify(paragraphRefs)}`,
    `【LineMap】${JSON.stringify(lineMap)}`,
    `【RelativeRangeMap】${JSON.stringify(relativeRangeMap)}`,
    `【RawTextEscaped】${JSON.stringify(rawText)}`,
    `【ChunkText】\n${normalizedText}`
  ].join('\n')
}

function buildStructuredBatchUserPrompt(basePrompt, chunk, requirementText, reportSettings, variables = {}) {
  const chunkText = String(chunk?.normalizedText || chunk?.text || '').trim()
  const promptWithRequirement = buildRequirementAwareUserPrompt(basePrompt, requirementText, reportSettings)
  const primaryPrompt = buildReportUserPrompt(promptWithRequirement, chunkText, reportSettings, variables)
  return [
    primaryPrompt,
    '',
    buildStructuredChunkContext(chunk),
    '',
    '输出中的 originalText 必须是 ChunkText 中可以直接截取的原文子串；如果做不到，请不要输出 replace。'
  ].join('\n')
}

/** 分段单次对话（非 JSON）：每段只输出可写回正文，最后合并后一次 applyDocumentAction */
function buildPlainChunkUserPrompt(basePrompt, chunk, requirementText, reportSettings, variables = {}) {
  const chunkText = String(chunk?.normalizedText || chunk?.text || '').trim()
  const promptWithRequirement = buildRequirementAwareUserPrompt(basePrompt, requirementText, reportSettings)
  const primaryPrompt = buildReportUserPrompt(promptWithRequirement, chunkText, reportSettings, variables)
  return [
    primaryPrompt,
    '',
    `【第 ${Number(chunk?.index || 0) + 1} 段 / 分段处理】`,
    '请仅针对下列文本块输出结果；不要输出 JSON、不要附加与任务无关的说明。',
    '---',
    chunkText,
    '---'
  ].join('\n')
}

function buildStructuredProgressItem(title, chunk, status = 'pending', extra = {}) {
  const req = extra.request != null ? extra.request : extra.llmChatRequest
  return {
    title,
    chunkIndex: Number(extra.chunkIndex || Number(chunk?.index || 0) + 1),
    chunkText: getSelectionPreview(chunk?.normalizedText || chunk?.text || ''),
    status,
    output: String(extra.output || '').trim(),
    issues: Array.isArray(extra.issues) ? extra.issues : [],
    outputSummary: String(extra.outputSummary || '').trim(),
    parsedOutput: String(extra.parsedOutput || '').trim(),
    ...(req && typeof req === 'object' ? { request: req } : {}),
    diagnostic: extra.diagnostic && typeof extra.diagnostic === 'object'
      ? extra.diagnostic
      : (String(extra.diagnostics || '').trim()
          ? { message: String(extra.diagnostics || '').trim() }
          : null)
  }
}

/**
 * 单次全文对话 + {@link applyDocumentAction}，与结构化 JSON / executionPlan 解耦，降低 WPS 宿主崩溃风险。
 * 多段长文见 {@link runChunkedPlainDocumentExecution}。
 */
async function runPlainDocumentAssistantExecution(ctx) {
  const {
    taskId,
    runState,
    runStartedAtMs,
    assistantId,
    definition,
    config,
    model,
    inputText,
    inputInfo,
    displayTitle,
    taskTitle,
    runtimeDocumentAction,
    launchGuardReason,
    userPrompt,
    systemPrompt,
    strictAssistantDefaults,
    launchSource,
    buildTaskData,
    buildProgressItem,
    overrides
  } = ctx

  const shortLabel = String(definition?.shortLabel || definition?.label || '助手').trim()

  await yieldToUI(0)
  throwIfCancelled(runState)

  const temperature = config.temperature ?? 0.3
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
  const llmChatRequest = buildChatCompletionsRequestSnapshot({
    providerId: model.providerId,
    modelId: model.modelId,
    ribbonModelId: model.id,
    messages,
    temperature,
    stream: false
  })

  updateTask(taskId, {
    progress: 42,
    data: buildTaskData({
      progressStage: 'calling_model',
      renderedSystemPrompt: systemPrompt,
      renderedUserPrompt: userPrompt,
      progressEvents: [
        `任务已启动，正在调用模型（${shortLabel} · 单次）。`,
        launchGuardReason ? `${launchGuardReason}，本次仅生成结果，不写回文档。` : ''
      ].filter(Boolean),
      items: [buildProgressItem('模型处理', inputText, 'running', { request: llmChatRequest })]
    })
  })

  const _stopPerf = startPerfTimer({ kind: 'task.single', providerId: model.providerId, modelId: model.modelId })
  let raw
  try {
    raw = await chatCompletion({
      providerId: model.providerId,
      modelId: model.modelId,
      temperature,
      signal: runState.abortController?.signal,
      messages
    })
    _stopPerf({ ok: true, bytes: String(raw || '').length })
  } catch (e) {
    _stopPerf({ ok: false, note: String(e?.message || e).slice(0, 80) })
    throw e
  }
  throwIfCancelled(runState)
  const output = String(raw || '').trim()
  if (!output) {
    throw new Error('模型未返回可用内容')
  }

  const outputPreview = getSelectionPreview(output)
  const completionSummary = buildAssistantCommentSummary(assistantId, output, displayTitle, runtimeDocumentAction)
  const commentText = buildAssistantApplyCommentText({
    output,
    summaryText: completionSummary,
    action: runtimeDocumentAction
  })

  const shouldDeferApply = overrides.previewOnly === true &&
    ['replace', 'comment', 'comment-replace', 'insert-after', 'insert', 'prepend', 'append'].includes(String(runtimeDocumentAction || '').trim())

  if (shouldDeferApply) {
    const resultSummary = buildAssistantResultSummaryData(assistantId, inputText, output, { action: 'none' }, null)
    updateTask(taskId, {
      status: 'completed',
      progress: 100,
      current: 1,
      total: 1,
      data: buildTaskData({
        outputPreview,
        documentAction: runtimeDocumentAction,
        progressStage: 'awaiting_confirmation',
        pendingApply: true,
        plainAssistantApply: true,
        plainAssistantExecution: true,
        resultSummary,
        commentPreview: commentText,
        fullOutput: output,
        fullInput: inputText,
        renderedUserPrompt: userPrompt,
        renderedSystemPrompt: systemPrompt,
        progressEvents: ['生成结果已就绪，等待确认后写回文档。'],
        items: [
          buildProgressItem('模型处理', inputText, 'done', { output, request: llmChatRequest }),
          buildProgressItem('文档写回', output, 'pending')
        ],
        elapsedMs: Date.now() - runStartedAtMs,
        estimatedRemainingMs: 0
      })
    })
    persistDocumentEvaluation({
      taskId,
      title: taskTitle,
      assistantId,
      inputText,
      outputText: output,
      resultSummary: completionSummary,
      pendingApply: true,
      documentAction: runtimeDocumentAction,
      launchSource,
      status: 'preview-ready',
      qualityGate: null
    })
    return {
      taskId,
      output,
      assistantId,
      definition,
      pendingApply: true,
      plainAssistantApply: true
    }
  }

  throwIfCancelled(runState)
  await yieldToUI(0)
  const applyResult = applyDocumentAction(runtimeDocumentAction, output, {
    title: displayTitle,
    commentText,
    strictTargetAction: strictAssistantDefaults === true,
    inputSource: inputInfo.source
  })
  const resultSummary = buildAssistantResultSummaryData(assistantId, inputText, output, applyResult, null)
  updateTask(taskId, {
    status: 'completed',
    progress: 100,
    current: 1,
    total: 1,
    data: buildTaskData({
      outputPreview,
      documentAction: runtimeDocumentAction,
      progressStage: 'completed',
      applyResult,
      resultSummary,
      plainAssistantExecution: true,
      commentPreview: commentText,
      fullOutput: output,
      renderedUserPrompt: userPrompt,
      renderedSystemPrompt: systemPrompt,
      progressEvents: [
        '任务已启动，正在调用模型。',
        launchGuardReason ? `${launchGuardReason}，本次仅生成结果，不写回文档。` : '生成结果已就绪，正在写回文档。',
        applyResult?.message || '任务已完成。'
      ],
      items: [
        buildProgressItem('模型处理', inputText, 'done', { output, request: llmChatRequest }),
        buildProgressItem('文档写回', output, 'done', { output: applyResult?.message || '' }),
        buildProgressItem('结果摘要', applyResult?.message || '', 'done')
      ],
      writeTargets: Array.isArray(applyResult?.writeTargets) ? applyResult.writeTargets : [],
      elapsedMs: Date.now() - runStartedAtMs,
      estimatedRemainingMs: 0
    })
  })
  persistDocumentEvaluation({
    taskId,
    title: taskTitle,
    assistantId,
    inputText,
    outputText: output,
    resultSummary: completionSummary,
    writeTargets: Array.isArray(applyResult?.writeTargets) ? applyResult.writeTargets : [],
    backupRef: applyResult?.backupRef || null,
    downgradeReason: applyResult?.downgradeReason || '',
    documentAction: runtimeDocumentAction,
    launchSource,
    status: 'completed',
    qualityGate: null,
    operationLedgerBatch: applyResult?.operationLedgerBatch || null
  })
  return {
    taskId,
    output,
    applyResult,
    assistantId,
    definition
  }
}

/** 多段全文：每段一次 chatCompletion（自然语言输出），合并后一次 {@link applyDocumentAction}，无 executionPlan */
async function runChunkedPlainDocumentExecution(ctx) {
  const {
    taskId,
    runState,
    runStartedAtMs,
    assistantId,
    definition,
    config,
    model,
    inputText,
    inputInfo,
    displayTitle,
    taskTitle,
    runtimeDocumentAction,
    launchGuardReason,
    systemPrompt,
    strictAssistantDefaults,
    launchSource,
    buildTaskData,
    buildProgressItem,
    overrides,
    variables,
    requirementText,
    reportSettings,
    structuredChunks
  } = ctx

  const shortLabel = String(definition?.shortLabel || definition?.label || '助手').trim()
  await yieldToUI(0)
  throwIfCancelled(runState)
  const temperature = config.temperature ?? 0.3
  // 预先把每段的 prompt 与 request 算好,parallel/serial 路径共享。
  const chunkUserPrompts = structuredChunks.map((chunk) => {
    const chunkText = String(chunk.normalizedText || chunk.text || '').trim()
    const chunkVariables = { ...variables, input: chunkText }
    const chunkBasePrompt = interpolateTemplate(
      config.userPromptTemplate || definition.userPromptTemplate || '{{input}}',
      chunkVariables
    )
    return buildPlainChunkUserPrompt(
      chunkBasePrompt,
      chunk,
      requirementText,
      reportSettings,
      chunkVariables
    )
  })
  const chunkRequests = chunkUserPrompts.map((userPrompt) => buildChatCompletionsRequestSnapshot({
    providerId: model.providerId,
    modelId: model.modelId,
    ribbonModelId: model.id,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature,
    stream: false
  }))
  const chunkDone = new Array(structuredChunks.length).fill(false)
  const chunkOutputs = new Array(structuredChunks.length).fill('')
  // 默认串行(并发=1,行为零变更);用户可通过 config.parallelChunks=N 启用并发。
  const concurrency = Math.max(1, Math.min(Number(config.parallelChunks) || 1, 8))

  const chunkResults = await runConcurrently(structuredChunks, async (chunk, i) => {
    throwIfCancelled(runState)
    await yieldToUI(0)
    const userPrompt = chunkUserPrompts[i]
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
    const stopPerf = startPerfTimer({ kind: 'task.chunk', providerId: model.providerId, modelId: model.modelId })
    let raw
    try {
      raw = await chatCompletion({
        providerId: model.providerId,
        modelId: model.modelId,
        temperature,
        signal: runState.abortController?.signal,
        messages
      })
      stopPerf({ ok: true, bytes: String(raw || '').length })
    } catch (e) {
      stopPerf({ ok: false, note: String(e?.message || e).slice(0, 80) })
      throw e
    }
    chunkOutputs[i] = String(raw || '').trim()
    return chunkOutputs[i]
  }, {
    concurrency,
    stopOnError: true,
    signal: runState.abortController?.signal,
    onProgress: (completed, total, i) => {
      if (i == null) return
      chunkDone[i] = true
      const progress = Math.min(78, 24 + Math.round((completed / Math.max(1, total)) * 50))
      try {
        updateTask(taskId, {
          current: completed,
          total,
          progress,
          data: buildTaskData({
            progressStage: 'calling_model',
            renderedSystemPrompt: systemPrompt,
            renderedUserPrompt: chunkUserPrompts[i],
            progressEvents: [
              `任务已启动，${concurrency > 1 ? `并发 ${concurrency} 路` : '分段'}调用模型（${shortLabel}）。`,
              `第 ${completed}/${total} 段已完成。`,
              launchGuardReason ? `${launchGuardReason}，本次仅生成结果，不写回文档。` : ''
            ].filter(Boolean),
            items: structuredChunks.map((c, idx) => buildProgressItem(
              `第 ${idx + 1} 段`,
              c.normalizedText || c.text,
              chunkDone[idx] ? 'done' : 'pending',
              {
                chunkIndex: idx + 1,
                output: chunkDone[idx] ? String(chunkOutputs[idx] || '').trim() : '',
                request: idx === i ? chunkRequests[i] : undefined
              }
            ))
          })
        })
      } catch (_) { /* 进度更新失败不致命 */ }
    }
  })

  // 与原串行循环保持等价:任何 chunk 失败 → 立即抛出第一个错误
  for (const r of chunkResults) {
    if (r && typeof r === 'object' && r.error) throw r.error
  }
  throwIfCancelled(runState)
  const lastChunkUserPrompt = chunkUserPrompts[chunkUserPrompts.length - 1] || ''
  const lastLlmChatRequest = chunkRequests[chunkRequests.length - 1] || null

  const output = chunkOutputs.filter(Boolean).join('\n\n').trim()
  if (!output) {
    throw new Error('模型未返回可用内容')
  }

  const outputPreview = getSelectionPreview(output)
  const completionSummary = buildAssistantCommentSummary(assistantId, output, displayTitle, runtimeDocumentAction)
  const commentText = buildAssistantApplyCommentText({
    output,
    summaryText: completionSummary,
    action: runtimeDocumentAction
  })

  const shouldDeferApply = overrides.previewOnly === true &&
    ['replace', 'comment', 'comment-replace', 'insert-after', 'insert', 'prepend', 'append'].includes(String(runtimeDocumentAction || '').trim())

  if (shouldDeferApply) {
    const resultSummary = buildAssistantResultSummaryData(assistantId, inputText, output, { action: 'none' }, null)
    updateTask(taskId, {
      status: 'completed',
      progress: 100,
      current: structuredChunks.length,
      total: structuredChunks.length,
      data: buildTaskData({
        outputPreview,
        documentAction: runtimeDocumentAction,
        progressStage: 'awaiting_confirmation',
        pendingApply: true,
        plainAssistantApply: true,
        plainAssistantExecution: true,
        resultSummary,
        commentPreview: commentText,
        fullOutput: output,
        fullInput: inputText,
        renderedUserPrompt: lastChunkUserPrompt,
        renderedSystemPrompt: systemPrompt,
        progressEvents: ['生成结果已就绪，等待确认后写回文档。'],
        items: [
          ...structuredChunks.map((c, idx) => buildProgressItem(
            `第 ${idx + 1} 段`,
            c.normalizedText || c.text,
            'done',
            { chunkIndex: idx + 1, output: String(chunkOutputs[idx] || '').trim() }
          )),
          buildProgressItem('文档写回', output, 'pending')
        ],
        elapsedMs: Date.now() - runStartedAtMs,
        estimatedRemainingMs: 0
      })
    })
    persistDocumentEvaluation({
      taskId,
      title: taskTitle,
      assistantId,
      inputText,
      outputText: output,
      resultSummary: completionSummary,
      pendingApply: true,
      documentAction: runtimeDocumentAction,
      launchSource,
      status: 'preview-ready',
      qualityGate: null
    })
    return {
      taskId,
      output,
      assistantId,
      definition,
      pendingApply: true,
      plainAssistantApply: true
    }
  }

  throwIfCancelled(runState)
  await yieldToUI(0)
  const applyResult = applyDocumentAction(runtimeDocumentAction, output, {
    title: displayTitle,
    commentText,
    strictTargetAction: strictAssistantDefaults === true,
    inputSource: inputInfo.source
  })
  const resultSummary = buildAssistantResultSummaryData(assistantId, inputText, output, applyResult, null)
  updateTask(taskId, {
    status: 'completed',
    progress: 100,
    current: structuredChunks.length,
    total: structuredChunks.length,
    data: buildTaskData({
      outputPreview,
      documentAction: runtimeDocumentAction,
      progressStage: 'completed',
      applyResult,
      resultSummary,
      plainAssistantExecution: true,
      commentPreview: commentText,
      fullOutput: output,
      renderedUserPrompt: lastChunkUserPrompt,
      renderedSystemPrompt: systemPrompt,
      progressEvents: [
        '任务已启动，正在分段调用模型。',
        launchGuardReason ? `${launchGuardReason}，本次仅生成结果，不写回文档。` : '生成结果已就绪，正在写回文档。',
        applyResult?.message || '任务已完成。'
      ],
      items: [
        ...structuredChunks.map((c, idx) => buildProgressItem(
          `第 ${idx + 1} 段`,
          c.normalizedText || c.text,
          'done',
          { chunkIndex: idx + 1, output: String(chunkOutputs[idx] || '').trim() }
        )),
        buildProgressItem('文档写回', output, 'done', { output: applyResult?.message || '' }),
        buildProgressItem('结果摘要', applyResult?.message || '', 'done')
      ],
      writeTargets: Array.isArray(applyResult?.writeTargets) ? applyResult.writeTargets : [],
      elapsedMs: Date.now() - runStartedAtMs,
      estimatedRemainingMs: 0
    })
  })
  persistDocumentEvaluation({
    taskId,
    title: taskTitle,
    assistantId,
    inputText,
    outputText: output,
    resultSummary: completionSummary,
    writeTargets: Array.isArray(applyResult?.writeTargets) ? applyResult.writeTargets : [],
    backupRef: applyResult?.backupRef || null,
    downgradeReason: applyResult?.downgradeReason || '',
    documentAction: runtimeDocumentAction,
    launchSource,
    status: 'completed',
    qualityGate: null,
    operationLedgerBatch: applyResult?.operationLedgerBatch || null
  })
  return {
    taskId,
    output,
    applyResult,
    assistantId,
    definition
  }
}

async function runStructuredBatchChat({
  assistantId,
  chunk,
  model,
  systemPrompt,
  userPrompt,
  signal
}) {
  let lastRaw = ''
  let lastParsed = null
  let lastError = ''
  let lastQuality = null
  let lastLlmChatRequest = null
  const strategyTrace = []
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: attempt === 0
          ? userPrompt
          : !lastParsed?.valid
            ? `${userPrompt}\n\n上一次输出无法被解析为合法 JSON。请严格只返回一个合法 JSON 对象，不要附加任何解释。`
            : `${userPrompt}\n\n上一次输出质量不足：${String(lastQuality?.message || '结构化结果不稳定')}。请重新输出，只保留可以稳定写回的内容；若定位不稳，请降级为 comment 或空 operations。`
      }
    ]
    lastLlmChatRequest = buildChatCompletionsRequestSnapshot({
      providerId: model.providerId,
      modelId: model.modelId,
      ribbonModelId: model.id,
      messages,
      temperature: 0.1,
      stream: false
    })
    const stopPerfRetry = startPerfTimer({
      kind: `task.structured.attempt${attempt}`,
      providerId: model.providerId,
      modelId: model.modelId
    })
    try {
      lastRaw = await chatCompletion({
        providerId: model.providerId,
        modelId: model.modelId,
        temperature: 0.1,
        signal,
        messages
      })
      stopPerfRetry({ ok: true, bytes: String(lastRaw || '').length })
    } catch (e) {
      stopPerfRetry({ ok: false, note: String(e?.message || e).slice(0, 80) })
      throw e
    }
    lastParsed = parseStructuredBatchResponse(lastRaw, assistantId, chunk)
    if (lastParsed.valid) {
      lastQuality = assessStructuredBatchQuality(lastParsed, assistantId)
      if (!lastQuality.shouldRetry || attempt >= 2) {
        return {
          raw: lastRaw,
          parsed: lastParsed,
          retryCount: attempt,
          quality: lastQuality,
          strategyTrace,
          llmChatRequest: lastLlmChatRequest
        }
      }
      strategyTrace.push('retry_low_quality_batch')
      lastError = lastQuality.message || '结构化结果质量不足'
      continue
    }
    strategyTrace.push('retry_invalid_json')
    lastError = lastParsed.error || '模型未返回合法 JSON'
  }
  return {
    raw: lastRaw,
    parsed: lastParsed,
    retryCount: 2,
    error: lastError || '模型未返回合法 JSON',
    quality: lastQuality,
    strategyTrace,
    llmChatRequest: lastLlmChatRequest
  }
}

function getAssistantLaunchInfoInternal(assistantId, overrides = {}) {
  const resolved = getAssistantDefinition(assistantId)
  if (!resolved) {
    throw new Error('未找到对应的助手配置')
  }

  const strictAssistantDefaults = overrides.strictAssistantDefaults === true
  const launchSource = String(overrides.launchSource || '').trim()
  const runtimeConfig = mergeAssistantRuntimeConfig(resolved.config, overrides)
  if (strictAssistantDefaults) {
    runtimeConfig.documentAction = resolved.config?.documentAction || runtimeConfig.documentAction
    runtimeConfig.inputSource = resolved.config?.inputSource || runtimeConfig.inputSource
  }
  const { definition, source } = resolved
  if (source === 'builtin' && runtimeConfig.enabled === false) {
    throw new Error('该助手功能已在设置中关闭，请先启用')
  }

  const reportSettings = getEffectiveReportSettings(runtimeConfig)
  const effectiveInputSource = strictAssistantDefaults
    ? (reportSettings.enabled ? 'document' : runtimeConfig.inputSource || 'selection-preferred')
    : (overrides.inputSource || (reportSettings.enabled ? 'document' : runtimeConfig.inputSource || 'selection-preferred'))
  const effectiveDocumentAction = strictAssistantDefaults
    ? (runtimeConfig.documentAction || 'insert')
    : (overrides.documentAction || runtimeConfig.documentAction)
  const inputInfo = resolveDocumentInput(effectiveInputSource)
  const inputText = String(overrides.inputText || inputInfo.text || '').trim()
  if (!inputText) {
    throw new Error(inputInfo.source === 'selection'
      ? '请先选中文本再执行该助手'
      : '当前文档没有可处理的文本内容')
  }

  const displayTitle = runtimeConfig.title || runtimeConfig.name || definition.shortLabel || definition.label || '智能助手'
  const taskTitle = overrides.taskTitle || displayTitle

  return {
    definition,
    config: runtimeConfig,
    source,
    inputInfo,
    inputText,
    displayTitle,
    taskTitle,
    effectiveInputSource,
    effectiveDocumentAction,
    strictAssistantDefaults,
    launchSource
  }
}

export function getRibbonAssistantIdByControlId(controlId) {
  const map = {
    btnSpellGrammar: 'spell-check',
    btnGenerateSummary: 'summary',
    btnRewrite: 'analysis.rewrite',
    btnExpand: 'analysis.expand',
    btnAbbreviate: 'analysis.abbreviate',
    btnParagraphNumberingCheck: 'analysis.paragraph-numbering-check',
    btnCommentExplain: 'analysis.comment-explain',
    btnHyperlinkExplain: 'analysis.hyperlink-explain',
    btnCorrectSpellGrammar: 'analysis.correct-spell',
    btnExtractKeywords: 'analysis.extract-keywords',
    btnAiTraceCheck: 'analysis.ai-trace-check',
    btnDocumentDeclassifyCheck: 'analysis.security-check',
    btnTextToImage: 'text-to-image',
    btnTextToAudio: 'text-to-audio',
    btnTextToVideo: 'text-to-video'
  }
  if (map[controlId]) return map[controlId]
  if (controlId && controlId.startsWith('btnTranslate_')) return 'translate'
  if (controlId && controlId.startsWith('btnCustomAssistant_')) return controlId.replace('btnCustomAssistant_', '')
  return null
}

export function getTranslateLanguageByControlId(controlId) {
  if (!controlId || !controlId.startsWith('btnTranslate_')) return null
  return controlId.replace('btnTranslate_', '')
}

async function executeAssistantTask(assistantId, overrides = {}) {
  const launchInfo = getAssistantLaunchInfoInternal(assistantId, overrides)
  const {
    definition,
    config,
    source,
    inputInfo,
    inputText,
    displayTitle,
    taskTitle,
    effectiveInputSource,
    effectiveDocumentAction,
    strictAssistantDefaults,
    launchSource
  } = launchInfo

  const runCaps = mergeDefinitionRuntimeCapabilities(definition)
  const resolvedModel = resolveModel(config, definition, {
    conversationModelId: overrides.conversationModelId
  })
  if (!resolvedModel?.model) {
    throw new Error('未找到可用模型，请先在设置中配置并启用对应模型')
  }
  const model = resolvedModel.model

  const reportSettings = getEffectiveReportSettings(config)
  const reportTypeLabel = getReportTypeLabel(reportSettings.type, reportSettings.customType)
  const targetLanguage = overrides.targetLanguage || config.targetLanguage || '中文'
  const requirementText = String(overrides.requirementText || '').trim()
  const forcedAction = String(runCaps.forceDocumentAction || '').trim()
  let runtimeDocumentAction = forcedAction ? forcedAction : effectiveDocumentAction
  const isRibbonDirectLaunch = launchSource === 'ribbon-direct'
  const writeBackActions = new Set(['replace', 'insert', 'comment', 'link-comment', 'comment-replace', 'append', 'prepend', 'insert-after'])
  let launchGuardReason = ''
  if (isRibbonDirectLaunch && writeBackActions.has(String(runtimeDocumentAction || '').trim())) {
    const probe = probeWritableAnchor()
    if (!probe.ok) {
      launchGuardReason = String(probe.reason || '当前无法定位文档写回位置，已自动降级为仅生成结果').trim()
      runtimeDocumentAction = 'none'
    }
  }
  const variables = {
    input: inputText,
    targetLanguage,
    assistantName: definition.shortLabel || definition.label || '',
    source: inputInfo.source,
    aspectRatio: config.mediaOptions?.aspectRatio || '16:9',
    duration: config.mediaOptions?.duration || '8s',
    voiceStyle: config.mediaOptions?.voiceStyle || '专业自然',
    reportType: reportTypeLabel
  }
  const baseUserPromptVariables = reportSettings.enabled
    ? { ...variables, input: '【材料全文见下方，不要在本节重复转述原文】' }
    : variables
  const baseUserPrompt = interpolateTemplate(
    config.userPromptTemplate || definition.userPromptTemplate || '{{input}}',
    baseUserPromptVariables
  )
  const promptWithRequirement = buildRequirementAwareUserPrompt(baseUserPrompt, requirementText, reportSettings)
  const userPrompt = buildReportUserPrompt(promptWithRequirement, inputText, reportSettings, variables)
  const systemPrompt = [
    buildAssistantSystemPrompt(config, definition),
    buildReportSystemPrompt(reportSettings, reportTypeLabel)
  ].filter(Boolean).join('\n\n')
  const structuredSystemPrompt = [
    systemPrompt,
    buildStructuredBatchInstruction(assistantId, {
      targetLanguage,
      documentAction: runtimeDocumentAction
    })
  ].filter(Boolean).join('\n\n')
  const onTaskCreated = typeof overrides.onTaskCreated === 'function' ? overrides.onTaskCreated : null
  const injectedTaskData = overrides.taskData && typeof overrides.taskData === 'object'
    ? overrides.taskData
    : {}
  const runStartedAtMs = Date.now()
  const buildProgressItem = (title, content, status = 'done', extra = {}) => ({
    title,
    chunkIndex: Number(extra.chunkIndex || 1),
    chunkText: getSelectionPreview(content),
    status,
    output: String(extra.output || '').trim(),
    issues: Array.isArray(extra.issues) ? extra.issues : []
  })
  const retryPayload = {
    assistantId,
    taskTitle,
    inputText,
    requirementText,
    inputSource: effectiveInputSource,
    documentAction: effectiveDocumentAction,
    targetLanguage,
    reportSettings: reportSettings && typeof reportSettings === 'object'
      ? JSON.parse(JSON.stringify(reportSettings))
      : null,
    previewOnly: overrides.previewOnly === true,
    launchSource,
    strictAssistantDefaults,
    taskData: {
      originMessageId: injectedTaskData.originMessageId,
      originRequirementText: injectedTaskData.originRequirementText
    }
  }
  const buildTaskData = (extra = {}) => mergeTaskOrchestrationData({
    assistantId,
    source,
    launchSource,
    strictAssistantDefaults,
    launchGuardReason,
    inputSource: inputInfo.source,
    chunkSource: inputInfo.source,
    fullInput: inputText,
    inputPreview: getSelectionPreview(inputText),
    requirementText,
    renderedSystemPrompt: structuredSystemPrompt,
    renderedUserPrompt: userPrompt,
    documentAction: effectiveDocumentAction,
    outputFormat: config.outputFormat,
    modelId: model.id,
    modelDisplayName: model.name || model.modelId,
    modelProviderId: model.providerId,
    modelSource: resolvedModel.source,
    configuredInputSource: effectiveInputSource,
    temperature: config.temperature ?? 0.3,
    targetLanguage,
    promptVariables: variables,
    reportSettings,
    reportTypeLabel,
    previewBlocks: Array.isArray(extra.previewBlocks) ? extra.previewBlocks : [],
    generatedArtifacts: Array.isArray(extra.generatedArtifacts) ? extra.generatedArtifacts : [],
    writeTargets: Array.isArray(extra.writeTargets) ? extra.writeTargets : [],
    executionPlanSummary: extra.executionPlanSummary || extra.executionPlan?.executionPlanSummary || null,
    applyPolicy: extra.applyPolicy || extra.executionPlan?.applyPolicy || null,
    backupPolicy: extra.backupPolicy || extra.executionPlan?.backupPolicy || null,
    documentScope: String(
      extra.documentScope ||
      extra.executionPlan?.documentContext?.inputSource ||
      inputInfo.source ||
      ''
    ).trim(),
    documentBackupRequested: extra.documentBackupRequested != null
      ? extra.documentBackupRequested === true
      : extra.executionPlan?.backupPolicy?.requested === true,
    backupRef: extra.backupRef || null,
    rollbackCandidate: extra.rollbackCandidate || null,
    retryPayload: extra.retryPayload || retryPayload,
    progressEvents: Array.isArray(extra.progressEvents) ? extra.progressEvents : [],
    items: Array.isArray(extra.items) ? extra.items : [],
    elapsedMs: Number(extra.elapsedMs || 0),
    estimatedRemainingMs: Number(extra.estimatedRemainingMs || 0),
    ...injectedTaskData
  }, {
    entry: launchSource === 'ribbon-direct' ? 'ribbon-direct' : 'dialog',
    primaryIntent: reportSettings.enabled ? 'generated-output' : 'assistant-task',
    executionMode: reportSettings.enabled ? 'generated-file-task' : 'runner-task',
    launchSource,
    strictAssistantDefaults,
    originMessageId: injectedTaskData.originMessageId,
    originRequirementText: injectedTaskData.originRequirementText
  }, extra)
  const taskId = String(overrides.placeholderTaskId || '').trim() || addTask({
    type: getTaskType(assistantId),
    title: taskTitle,
    status: 'running',
    progress: 10,
    data: buildTaskData({ progressStage: 'preparing' })
  })
  if (String(overrides.placeholderTaskId || '').trim()) {
    updateTask(taskId, {
      type: getTaskType(assistantId),
      title: taskTitle,
      status: 'running',
      progress: 10,
      data: buildTaskData({
        progressStage: 'preparing',
        progressEvents: ['任务界面已渲染，正在准备模型与文档内容...']
      })
    })
  }
  onTaskCreated?.(taskId)
  const runState = {
    taskId,
    cancelled: false,
    abortController: typeof AbortController !== 'undefined' ? new AbortController() : null
  }
  activeAssistantRuns.set(taskId, runState)

  try {
    updateTask(taskId, {
      progress: 30,
      data: buildTaskData({
        progressStage: 'calling_model',
        progressEvents: [
          '任务已启动，正在调用模型。',
          launchGuardReason ? `${launchGuardReason}，本次仅生成结果，不写回文档。` : ''
        ].filter(Boolean),
        items: [buildProgressItem('模型处理', inputText, 'running')]
      })
    })
    throwIfCancelled(runState)
    if (runCaps.mediaKind) {
      const mediaKind = runCaps.mediaKind
      const asset = await generateMultimodalAsset({
        kind: mediaKind,
        providerId: model.providerId,
        modelId: model.modelId,
        prompt: userPrompt,
        input: inputText,
        aspectRatio: config.mediaOptions?.aspectRatio,
        duration: config.mediaOptions?.duration,
        voiceStyle: config.mediaOptions?.voiceStyle,
        signal: runState.abortController?.signal
      })
      throwIfCancelled(runState)
      updateTask(taskId, {
        progress: 75,
        data: buildTaskData({
          outputPreview: getSelectionPreview(asset?.revisedPrompt || asset?.prompt || ''),
          progressStage: 'applying_result',
          generatedMediaKind: mediaKind,
          progressEvents: ['任务已启动，正在调用模型。', '模型结果已生成，正在写回文档。'],
          items: [
            buildProgressItem('模型处理', inputText, 'done', { output: asset?.revisedPrompt || asset?.prompt || '' }),
            buildProgressItem('文档写回', asset?.revisedPrompt || asset?.prompt || '', 'running')
          ]
        })
      })
      const commentText = getMediaCompletionComment(mediaKind, displayTitle)
      throwIfCancelled(runState)
      const applyResult = applyMediaDocumentAction(mediaKind, effectiveDocumentAction, asset, {
        title: displayTitle,
        commentText,
        strictTargetAction: strictAssistantDefaults === true
      })
      const planArtifact = createRenderedArtifact(JSON.stringify(asset?.generationPlan || {}, null, 2), {
        format: 'json',
        kind: 'plan',
        ownerType: 'task',
        ownerId: taskId,
        route: 'multimodal-plan',
        baseName: `${displayTitle || taskTitle || mediaKind}生成计划`,
        sourceType: 'multimodal-plan',
        sourceName: displayTitle || taskTitle || mediaKind,
        retentionTier: 'standard'
      })
      const generatedArtifacts = [
        planArtifact,
        buildGeneratedArtifactDescriptor({
          kind: mediaKind,
          name: `${displayTitle || taskTitle || mediaKind}.${String(asset?.extension || '').trim() || (mediaKind === 'image' ? 'png' : mediaKind === 'audio' ? 'mp3' : 'mp4')}`,
          path: applyResult?.filePath || asset?.filePath,
          mimeType: asset?.mimeType,
          extension: asset?.extension,
          parentArtifactIds: [planArtifact.id],
          rootArtifactId: planArtifact.id,
          retentionTier: 'standard'
        })
      ].filter(item => item.path || item.name)
      bindArtifactsToOwner('task', taskId, generatedArtifacts)
      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        data: buildTaskData({
          outputPreview: getSelectionPreview(asset?.revisedPrompt || asset?.prompt || ''),
          progressStage: 'completed',
          applyResult,
          commentPreview: commentText,
          fullOutput: asset?.revisedPrompt || asset?.prompt || '',
          generatedMediaKind: mediaKind,
          generatedMediaPath: applyResult?.filePath || '',
          generatedMediaMimeType: asset?.mimeType || '',
          generatedArtifacts,
          writeTargets: Array.isArray(applyResult?.writeTargets) ? applyResult.writeTargets : [],
          progressEvents: [
            '任务已启动，正在调用模型。',
            launchGuardReason ? `${launchGuardReason}，本次仅生成结果，不写回文档。` : '模型结果已生成，正在写回文档。',
            applyResult?.message || '任务已完成。'
          ],
          items: [
            buildProgressItem('模型处理', inputText, 'done', { output: asset?.revisedPrompt || asset?.prompt || '' }),
            buildProgressItem('文档写回', asset?.revisedPrompt || asset?.prompt || '', 'done', { output: applyResult?.message || '' }),
            buildProgressItem('结果摘要', applyResult?.message || '', 'done')
          ],
          elapsedMs: Date.now() - runStartedAtMs,
          estimatedRemainingMs: 0
        })
      })
      return {
        taskId,
        output: asset?.revisedPrompt || asset?.prompt || '',
        applyResult,
        assistantId,
        definition
      }
    }

    const chunkSettings = getChunkSettings()
    const structuredChunks = getStructuredChunks(inputInfo, assistantId, runtimeDocumentAction)
      .filter(chunk => String(chunk?.normalizedText || chunk?.text || '').trim())
    if (structuredChunks.length === 0) {
      throw new Error('未找到可分析的文档分段')
    }

    if (shouldUsePlainDocumentPipeline(assistantId, reportSettings, runtimeDocumentAction)) {
      const plainCtx = {
        taskId,
        runState,
        runStartedAtMs,
        assistantId,
        definition,
        config,
        model,
        inputText,
        inputInfo,
        displayTitle,
        taskTitle,
        runtimeDocumentAction,
        launchGuardReason,
        userPrompt,
        systemPrompt,
        strictAssistantDefaults,
        launchSource,
        buildTaskData,
        buildProgressItem,
        overrides,
        variables,
        requirementText,
        reportSettings,
        structuredChunks
      }
      if (structuredChunks.length === 1) {
        return await runPlainDocumentAssistantExecution(plainCtx)
      }
      return await runChunkedPlainDocumentExecution(plainCtx)
    }

    updateTask(taskId, {
      progress: 24,
      total: structuredChunks.length,
      current: 0,
      data: buildTaskData({
        progressStage: 'calling_model',
        progressEvents: ['任务已启动，正在按设置分段批量调用模型。'],
        items: structuredChunks.map((chunk, index) => buildStructuredProgressItem(`第 ${index + 1} 批`, chunk, 'pending', { chunkIndex: index + 1 }))
      })
    })
    const batchRecords = []
    const chunkWriteMode = chunkSettings.splitStrategy === 'sentence' ? 'sentence-range' : 'paragraph-body'
    for (let i = 0; i < structuredChunks.length; i += 1) {
      throwIfCancelled(runState)
      const chunk = structuredChunks[i]
      const chunkText = String(chunk.normalizedText || chunk.text || '').trim()
      const chunkVariables = {
        ...variables,
        input: chunkText
      }
      const chunkBasePrompt = interpolateTemplate(
        config.userPromptTemplate || definition.userPromptTemplate || '{{input}}',
        chunkVariables
      )
      const chunkUserPrompt = buildStructuredBatchUserPrompt(
        chunkBasePrompt,
        chunk,
        requirementText,
        reportSettings,
        chunkVariables
      )
      const structuredResult = await runStructuredBatchChat({
        assistantId,
        chunk,
        model,
        systemPrompt: structuredSystemPrompt,
        userPrompt: chunkUserPrompt,
        signal: runState.abortController?.signal
      })
      const batchRecord = buildBatchRecord({
        taskId,
        assistantId,
        batchIndex: i + 1,
        chunk,
        request: {
          inputSource: inputInfo.source,
          documentAction: runtimeDocumentAction,
          targetLanguage,
          requirementText,
          modelId: model.id,
          ...chunkSettings
        },
        llmChatRequest: structuredResult.llmChatRequest,
        rawResponse: structuredResult.raw,
        parsedResponse: structuredResult.parsed,
        retryCount: structuredResult.retryCount,
        error: structuredResult.error,
        quality: structuredResult.quality,
        strategyTrace: structuredResult.strategyTrace
      })
      batchRecords.push(batchRecord)
      const progress = Math.min(78, 24 + Math.round(((i + 1) / Math.max(1, structuredChunks.length)) * 50))
      const batchOutputPreview = getSelectionPreview(
        batchRecord?.response?.parsed?.content ||
        batchRecord?.response?.parsed?.summary ||
        batchRecord?.response?.raw ||
        ''
      )
      updateTask(taskId, {
        current: i + 1,
        total: structuredChunks.length,
        progress,
        data: buildTaskData({
          progressStage: 'calling_model',
          currentChunk: chunkText,
          outputPreview: batchOutputPreview,
          batchRecords,
          progressEvents: [
            `第 ${i + 1}/${structuredChunks.length} 批结构化分析完成。`,
            batchRecord.response.valid
              ? `本批已生成 ${batchRecord.operations.length} 条结构化操作，质量等级：${batchRecord.response.quality?.level || 'unknown'}。`
              : `本批 JSON 解析失败：${batchRecord.response.error || '模型未返回合法 JSON'}`
          ],
          items: structuredChunks.map((structuredChunk, index) => {
            const record = batchRecords[index]
            return buildStructuredProgressItem(
              `第 ${index + 1} 批`,
              structuredChunk,
              index <= i ? 'done' : 'pending',
              {
                chunkIndex: index + 1,
                request: record?.llmChatRequest,
                output: index <= i
                  ? String(
                    record?.response?.parsed?.content ||
                    record?.response?.parsed?.summary ||
                    ''
                  ).trim()
                  : '',
                outputSummary: record?.response?.valid
                  ? `已解析 ${Array.isArray(record?.operations) ? record.operations.length : 0} 条结构化操作，质量 ${record?.response?.quality?.level || 'unknown'}`
                  : '结构化 JSON 解析失败',
                issues: Array.isArray(record?.response?.parsed?.issues) ? record.response.parsed.issues : [],
                parsedOutput: record?.response?.raw || '',
                diagnostic: {
                  valid: record?.response?.valid === true,
                  retryCount: Number(record?.response?.retryCount || 0),
                  error: record?.response?.error || '',
                  operationCount: Array.isArray(record?.operations) ? record.operations.length : 0,
                  quality: record?.response?.quality || null,
                  strategyTrace: Array.isArray(record?.response?.strategyTrace) ? record.response.strategyTrace : []
                }
              }
            )
          })
        })
      })
    }
    throwIfCancelled(runState)
    const structuredExecutionPlan = buildStructuredExecutionPlan({
      taskId,
      assistantId,
      taskTitle,
      documentAction: runtimeDocumentAction,
      inputInfo,
      chunks: structuredChunks,
      batchRecords,
      requirementText,
      targetLanguage,
      configuredInputSource: effectiveInputSource,
      chunkSettings,
      chunkWriteMode
    })
    const executionPlan = buildDocumentProcessingExecutionPlan(structuredExecutionPlan, {
      backupRequested: overrides.backupRequested
    })
    const output = getEffectiveStructuredTaskOutput(executionPlan, assistantId, runtimeDocumentAction)
    const completionSummary = reportSettings.enabled
      ? `${reportTypeLabel}已生成，请在任务清单中查看完整内容。`
      : buildAssistantCommentSummary(assistantId, output, displayTitle, runtimeDocumentAction)
    const outputPreview =
      getStructuredPlanPreview(executionPlan) ||
      getSelectionPreview(output || completionSummary || '已完成')
    const previewBlocks = buildExecutionPreviewBlocks(executionPlan)
    updateTask(taskId, {
      progress: 82,
      current: structuredChunks.length,
      total: structuredChunks.length,
      data: buildTaskData({
        progressStage: 'applying_result',
        outputPreview,
        batchRecords,
        executionPlan,
          executionPlanSummary: executionPlan.executionPlanSummary || null,
          applyPolicy: executionPlan.applyPolicy || null,
          backupPolicy: executionPlan.backupPolicy || null,
          qualityGate: executionPlan.qualityGate || null,
          documentBackupRequested: executionPlan.backupPolicy?.requested === true,
        previewBlocks,
        progressEvents: [
          launchGuardReason
            ? `${launchGuardReason}，本次仅生成结果，不写回文档。`
            : '所有批次结构化 JSON 已完成，正在按聚合计划写回文档。'
        ],
        items: structuredChunks.map((chunk, index) => {
          const record = batchRecords[index]
          return buildStructuredProgressItem(
            `第 ${index + 1} 批`,
            chunk,
            'done',
            {
              chunkIndex: index + 1,
              request: record?.llmChatRequest,
              output: String(record?.response?.parsed?.content || record?.response?.parsed?.summary || '').trim(),
              outputSummary: record?.response?.valid
                ? `已解析 ${Array.isArray(record?.operations) ? record.operations.length : 0} 条结构化操作，质量 ${record?.response?.quality?.level || 'unknown'}`
                : '结构化 JSON 解析失败',
              issues: Array.isArray(record?.response?.parsed?.issues) ? record.response.parsed.issues : [],
              parsedOutput: record?.response?.raw || '',
              diagnostic: {
                valid: record?.response?.valid === true,
                retryCount: Number(record?.response?.retryCount || 0),
                error: record?.response?.error || '',
                operationCount: Array.isArray(record?.operations) ? record.operations.length : 0,
                quality: record?.response?.quality || null,
                strategyTrace: Array.isArray(record?.response?.strategyTrace) ? record.response.strategyTrace : []
              }
            }
          )
        })
      })
    })
    const commentText = buildAssistantApplyCommentText({
      output,
      summaryText: completionSummary,
      action: runtimeDocumentAction
    })
    const shouldDeferApply = overrides.previewOnly === true &&
      ['replace', 'comment', 'comment-replace', 'insert-after', 'insert', 'prepend', 'append'].includes(String(runtimeDocumentAction || '').trim()) &&
      reportSettings.enabled !== true
    if (shouldDeferApply) {
      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        current: structuredChunks.length,
        total: structuredChunks.length,
        data: buildTaskData({
          outputPreview,
          documentAction: runtimeDocumentAction,
          progressStage: 'awaiting_confirmation',
          pendingApply: true,
          executionPlanSummary: executionPlan.executionPlanSummary || null,
          applyPolicy: executionPlan.applyPolicy || null,
          backupPolicy: executionPlan.backupPolicy || null,
          qualityGate: executionPlan.qualityGate || null,
          documentBackupRequested: executionPlan.backupPolicy?.requested === true,
          resultSummary: buildAssistantResultSummaryData(assistantId, inputText, output, { action: 'none' }, executionPlan),
          commentPreview: commentText,
          fullOutput: output,
          batchRecords,
          executionPlan,
          previewBlocks,
          chunkWriteMode,
          progressEvents: [
            '任务已启动，正在按设置分段批量调用模型。',
            '所有批次结构化 JSON 已完成，已生成写回预览。',
            '等待用户确认后再安全写回文档。'
          ],
          items: structuredChunks.map((chunk, index) => {
            const record = batchRecords[index]
            return buildStructuredProgressItem(
              `第 ${index + 1} 批`,
              chunk,
              'done',
              {
                chunkIndex: index + 1,
                request: record?.llmChatRequest,
                output: String(record?.response?.parsed?.content || record?.response?.parsed?.summary || '').trim(),
                outputSummary: record?.response?.valid
                  ? `已解析 ${Array.isArray(record?.operations) ? record.operations.length : 0} 条结构化操作，质量 ${record?.response?.quality?.level || 'unknown'}`
                  : '结构化 JSON 解析失败',
                issues: Array.isArray(record?.response?.parsed?.issues) ? record.response.parsed.issues : [],
                parsedOutput: record?.response?.raw || ''
              }
            )
          }),
          elapsedMs: Date.now() - runStartedAtMs,
          estimatedRemainingMs: 0
        })
      })
      persistDocumentEvaluation({
        taskId,
        title: taskTitle,
        assistantId,
        inputText,
        outputText: output,
        resultSummary: completionSummary,
        batchRecords,
        pendingApply: true,
        documentAction: runtimeDocumentAction,
        launchSource,
        status: 'preview-ready',
        qualityGate: executionPlan.qualityGate || null
      })
      return {
        taskId,
        output,
        executionPlan,
        assistantId,
        definition,
        pendingApply: true
      }
    }
    throwIfCancelled(runState)
    const applyResult = applyDocumentProcessingPlan(executionPlan, {
      title: displayTitle,
      commentText,
      inputSource: inputInfo.source,
      action: runtimeDocumentAction,
      chunkMode: chunkWriteMode,
      strictTargetAction: strictAssistantDefaults === true,
      backupRequested: executionPlan?.backupPolicy?.requested === true,
      taskId,
      assistantId,
      launchSource
    })
    const resultSummary = buildAssistantResultSummaryData(assistantId, inputText, output, applyResult, executionPlan)
    const structuredTaskSnapshot = buildStructuredTaskSnapshot(executionPlan, applyResult, resultSummary, output)

    updateTask(taskId, {
      status: 'completed',
      progress: 100,
      current: structuredChunks.length,
      total: structuredChunks.length,
      data: buildTaskData({
        outputPreview,
        documentAction: runtimeDocumentAction,
        progressStage: 'completed',
        applyResult,
        resultSummary,
        structuredTaskSnapshot,
        commentPreview: commentText,
        fullOutput: output,
        batchRecords,
        executionPlan,
        executionPlanSummary: executionPlan.executionPlanSummary || null,
        applyPolicy: executionPlan.applyPolicy || null,
        backupPolicy: executionPlan.backupPolicy || null,
        qualityGate: executionPlan.qualityGate || null,
        documentBackupRequested: executionPlan.backupPolicy?.requested === true,
        previewBlocks,
        chunkWriteMode,
        generatedArtifacts: [],
        writeTargets: Array.isArray(applyResult?.writeTargets) ? applyResult.writeTargets : [],
        backupRef: applyResult?.backupRef || null,
        operationLedgerBatch: applyResult?.operationLedgerBatch || null,
        rollbackCandidate: applyResult?.rollbackCandidate || null,
        progressEvents: [
          '任务已启动，正在按设置分段批量调用模型。',
            launchGuardReason
              ? `${launchGuardReason}，本次仅生成结果，不写回文档。`
              : '所有批次结构化 JSON 已完成，正在按聚合计划写回文档。',
          applyResult?.message || '任务已完成。'
        ],
        items: structuredChunks.map((chunk, index) => {
          const record = batchRecords[index]
          return buildStructuredProgressItem(
            `第 ${index + 1} 批`,
            chunk,
            'done',
            {
              chunkIndex: index + 1,
              request: record?.llmChatRequest,
              output: String(record?.response?.parsed?.content || record?.response?.parsed?.summary || '').trim(),
              outputSummary: record?.response?.valid
                ? `已解析 ${Array.isArray(record?.operations) ? record.operations.length : 0} 条结构化操作，质量 ${record?.response?.quality?.level || 'unknown'}`
                : '结构化 JSON 解析失败',
              issues: Array.isArray(record?.response?.parsed?.issues) ? record.response.parsed.issues : [],
              parsedOutput: record?.response?.raw || '',
              diagnostic: {
                valid: record?.response?.valid === true,
                retryCount: Number(record?.response?.retryCount || 0),
                error: record?.response?.error || '',
                operationCount: Array.isArray(record?.operations) ? record.operations.length : 0,
                quality: record?.response?.quality || null,
                strategyTrace: Array.isArray(record?.response?.strategyTrace) ? record.response.strategyTrace : []
              }
            }
          )
        }),
        elapsedMs: Date.now() - runStartedAtMs,
        estimatedRemainingMs: 0
      })
    })
    persistDocumentEvaluation({
      taskId,
      title: taskTitle,
      assistantId,
      inputText,
      outputText: output,
      resultSummary: resultSummary?.summaryText || resultSummary?.summary || '',
      batchRecords,
      writeTargets: Array.isArray(applyResult?.writeTargets) ? applyResult.writeTargets : [],
      backupRef: applyResult?.backupRef || null,
      downgradeReason: applyResult?.downgradeReason || '',
      documentAction: runtimeDocumentAction,
      launchSource,
      status: 'completed',
      qualityGate: executionPlan.qualityGate || null,
      operationLedgerBatch: applyResult?.operationLedgerBatch || null
    })

    return {
      taskId,
      output,
      applyResult,
      executionPlan,
      assistantId,
      definition
    }
  } catch (error) {
    if (isTaskCancelledError(error) || runState.cancelled) {
      updateTask(taskId, {
        status: 'cancelled',
        error: '任务已停止',
        progress: 100,
        data: buildTaskData({
          progressStage: 'cancelled',
          progressEvents: ['任务已停止。'],
          elapsedMs: Date.now() - runStartedAtMs,
          estimatedRemainingMs: 0
        })
      })
      throw createCancelError()
    }
    updateTask(taskId, {
      status: 'failed',
      error: error?.message || String(error),
      progress: 100,
      data: buildTaskData({
        progressStage: 'failed',
        progressEvents: [error?.message || String(error)],
        errorDetail: runCaps.mediaKind
          ? classifyMultimodalError(error, {
            kind: runCaps.mediaKind,
            providerId: model?.providerId,
            modelId: model?.modelId,
            taskTitle,
            requestSummary: inputText
          })
          : null,
        outputPreview: error?.message || String(error),
        fullOutput: error?.message || String(error),
        elapsedMs: Date.now() - runStartedAtMs,
        estimatedRemainingMs: 0
      })
    })
    throw error
  } finally {
    activeAssistantRuns.delete(taskId)
  }
}

export async function applyAssistantTaskPlan(taskId) {
  const normalizedTaskId = String(taskId || '').trim()
  if (!normalizedTaskId) {
    throw new Error('缺少任务 ID，无法应用预览计划')
  }
  const task = getTaskById(normalizedTaskId)
  if (!task) {
    throw new Error('未找到对应任务')
  }
  const assistantIdForError = String(task?.data?.assistantId || '').trim()

  try {
    if (task?.data?.pendingApply !== true && String(task?.data?.progressStage || '').trim() !== 'awaiting_confirmation') {
      return {
        taskId: normalizedTaskId,
        applyResult: task?.data?.applyResult || null,
        resultSummary: task?.data?.resultSummary || null
      }
    }

    // 单次对话类助手（如默认「生成摘要」）预览确认后走 applyDocumentAction，无 executionPlan
    if (task?.data?.plainAssistantApply === true) {
      const outputText = String(task?.data?.fullOutput || '').trim()
      if (!outputText) {
        throw new Error('当前任务没有可写回的生成内容')
      }
      const assistantId = assistantIdForError
      updateTask(normalizedTaskId, {
        status: 'running',
        progress: 86,
        data: mergeTaskOrchestrationData(task.data || {}, {
          entry: task?.data?.entry,
          primaryIntent: task?.data?.primaryIntent,
          executionMode: task?.data?.executionMode,
          launchSource: task?.data?.launchSource,
          strictAssistantDefaults: task?.data?.strictAssistantDefaults === true,
          originMessageId: task?.data?.originMessageId,
          originRequirementText: task?.data?.originRequirementText
        }, {
          pendingApply: false,
          progressStage: 'applying_result',
          progressEvents: [
            ...(Array.isArray(task?.data?.progressEvents) ? task.data.progressEvents : []),
            '已确认预览，正在安全写回文档。'
          ].slice(-60)
        })
      })
      await yieldToUI(0)
      const docAct = String(task?.data?.documentAction || '').trim()
      const applyResult = applyDocumentAction(task?.data?.documentAction, outputText, {
        title: task?.title || '',
        commentText: String(task?.data?.commentPreview || '').trim(),
        strictTargetAction: task?.data?.strictAssistantDefaults === true,
        inputSource: task?.data?.inputSource,
        preventWholeDocumentComment: docAct === 'comment' || docAct === 'link-comment'
      })
      const inputText = String(task?.data?.fullInput || '').trim()
      const resultSummary = buildAssistantResultSummaryData(assistantId, inputText, outputText, applyResult, null)
      const structuredTaskSnapshot = buildStructuredTaskSnapshot(null, applyResult, resultSummary, outputText)
      updateTask(normalizedTaskId, {
        status: 'completed',
        progress: 100,
        current: Number(task?.total || task?.current || 0),
        total: Number(task?.total || task?.current || 0),
        data: mergeTaskOrchestrationData(task.data || {}, {
          entry: task?.data?.entry,
          primaryIntent: task?.data?.primaryIntent,
          executionMode: task?.data?.executionMode,
          launchSource: task?.data?.launchSource,
          strictAssistantDefaults: task?.data?.strictAssistantDefaults === true,
          originMessageId: task?.data?.originMessageId,
          originRequirementText: task?.data?.originRequirementText
        }, {
          pendingApply: false,
          progressStage: 'completed',
          applyResult,
          resultSummary,
          structuredTaskSnapshot,
          fullOutput: outputText,
          writeTargets: Array.isArray(applyResult?.writeTargets) ? applyResult.writeTargets : [],
          backupRef: applyResult?.backupRef || null,
          operationLedgerBatch: applyResult?.operationLedgerBatch || null,
          rollbackCandidate: applyResult?.rollbackCandidate || null,
          progressEvents: [
            ...(Array.isArray(task?.data?.progressEvents) ? task.data.progressEvents : []),
            applyResult?.message || '文档写回已完成。'
          ].slice(-60)
        })
      })
      const completionSummary = buildAssistantCommentSummary(assistantId, outputText, task?.title || '', docAct)
      persistDocumentEvaluation({
        taskId: normalizedTaskId,
        title: task?.title || '文档任务',
        assistantId,
        inputText,
        outputText,
        resultSummary: completionSummary,
        batchRecords: [],
        writeTargets: Array.isArray(applyResult?.writeTargets) ? applyResult.writeTargets : [],
        backupRef: applyResult?.backupRef || null,
        downgradeReason: applyResult?.downgradeReason || '',
        documentAction: task?.data?.documentAction || '',
        launchSource: task?.data?.launchSource || '',
        status: 'completed',
        qualityGate: task?.data?.qualityGate || null,
        operationLedgerBatch: applyResult?.operationLedgerBatch || task?.data?.operationLedgerBatch || null
      })
      return {
        taskId: normalizedTaskId,
        applyResult,
        resultSummary
      }
    }

    const executionPlan = task?.data?.executionPlan
    if (!executionPlan) {
      throw new Error('当前任务不存在可应用的结构化计划')
    }
    updateTask(normalizedTaskId, {
      status: 'running',
      progress: 86,
      data: mergeTaskOrchestrationData(task.data || {}, {
        entry: task?.data?.entry,
        primaryIntent: task?.data?.primaryIntent,
        executionMode: task?.data?.executionMode,
        launchSource: task?.data?.launchSource,
        strictAssistantDefaults: task?.data?.strictAssistantDefaults === true,
        originMessageId: task?.data?.originMessageId,
        originRequirementText: task?.data?.originRequirementText
      }, {
        pendingApply: false,
        progressStage: 'applying_result',
        progressEvents: [
          ...(Array.isArray(task?.data?.progressEvents) ? task.data.progressEvents : []),
          '已确认预览，正在安全写回文档。'
        ].slice(-60)
      })
    })
    await yieldToUI(0)
    const applyResult = applyDocumentProcessingPlan(executionPlan, {
      title: task?.title || '',
      commentText: String(task?.data?.commentPreview || '').trim(),
      inputSource: task?.data?.inputSource,
      action: task?.data?.documentAction,
      chunkMode: task?.data?.chunkWriteMode,
      strictTargetAction: task?.data?.strictAssistantDefaults === true,
      backupRequested: task?.data?.documentBackupRequested === true,
      taskId: normalizedTaskId,
      assistantId: task?.data?.assistantId || '',
      launchSource: task?.data?.launchSource || ''
    })
    const assistantId = String(task?.data?.assistantId || '').trim()
    const inputText = String(task?.data?.fullInput || '').trim()
    const outputText = String(task?.data?.fullOutput || task?.data?.outputPreview || '').trim()
    const resultSummary = buildAssistantResultSummaryData(assistantId, inputText, outputText, applyResult, executionPlan)
    const structuredTaskSnapshot = buildStructuredTaskSnapshot(executionPlan, applyResult, resultSummary, outputText)
    updateTask(normalizedTaskId, {
      status: 'completed',
      progress: 100,
      current: Number(task?.total || task?.current || 0),
      total: Number(task?.total || task?.current || 0),
      data: mergeTaskOrchestrationData(task.data || {}, {
        entry: task?.data?.entry,
        primaryIntent: task?.data?.primaryIntent,
        executionMode: task?.data?.executionMode,
        launchSource: task?.data?.launchSource,
        strictAssistantDefaults: task?.data?.strictAssistantDefaults === true,
        originMessageId: task?.data?.originMessageId,
        originRequirementText: task?.data?.originRequirementText
      }, {
        pendingApply: false,
        progressStage: 'completed',
        applyResult,
        resultSummary,
        structuredTaskSnapshot,
        writeTargets: Array.isArray(applyResult?.writeTargets) ? applyResult.writeTargets : [],
        backupRef: applyResult?.backupRef || null,
        operationLedgerBatch: applyResult?.operationLedgerBatch || null,
        rollbackCandidate: applyResult?.rollbackCandidate || null,
        progressEvents: [
          ...(Array.isArray(task?.data?.progressEvents) ? task.data.progressEvents : []),
          applyResult?.message || '文档写回已完成。'
        ].slice(-60)
      })
    })
    persistDocumentEvaluation({
      taskId: normalizedTaskId,
      title: task?.title || '文档任务',
      assistantId,
      inputText,
      outputText,
      resultSummary: resultSummary?.summaryText || resultSummary?.summary || '',
      batchRecords: Array.isArray(task?.data?.batchRecords) ? task.data.batchRecords : [],
      writeTargets: Array.isArray(applyResult?.writeTargets) ? applyResult.writeTargets : [],
      backupRef: applyResult?.backupRef || null,
      downgradeReason: applyResult?.downgradeReason || '',
      documentAction: task?.data?.documentAction || '',
      launchSource: task?.data?.launchSource || '',
      status: 'completed',
      qualityGate: task?.data?.qualityGate || null,
      operationLedgerBatch: applyResult?.operationLedgerBatch || task?.data?.operationLedgerBatch || null
    })
    return {
      taskId: normalizedTaskId,
      applyResult,
      resultSummary
    }
  } catch (error) {
    if (!isTaskCancelledError(error)) {
      try {
        showAssistantTaskErrorDialog(assistantIdForError, error)
      } catch (_) {}
    }
    throw error
  }
}

export function startAssistantTask(assistantId, overrides = {}) {
  const taskId = createAssistantPlaceholderTask(assistantId, overrides)
  overrides.onTaskCreated?.(taskId)
  const promise = (async () => {
    await yieldToUI()
    try {
      return await executeAssistantTask(assistantId, {
        ...overrides,
        placeholderTaskId: taskId,
        onTaskCreated: (id) => {
          if (String(id || '').trim() && String(id || '').trim() !== taskId) {
            overrides.onTaskCreated?.(id)
          }
        }
      })
    } catch (error) {
      updateTask(taskId, {
        status: isTaskCancelledError(error) ? 'cancelled' : 'failed',
        error: error?.message || String(error),
        progress: 100,
        data: {
          ...(getTaskById(taskId)?.data || {}),
          progressStage: isTaskCancelledError(error) ? 'cancelled' : 'failed',
          progressEvents: [error?.message || String(error || '助手任务启动失败')],
          estimatedRemainingMs: 0
        }
      })
      if (!isTaskCancelledError(error)) {
        try {
          showAssistantTaskErrorDialog(assistantId, error)
        } catch (e) {
          void e
        }
      }
      throw error
    }
  })()
  return { taskId, promise }
}

export function getAssistantLaunchInfo(assistantId, overrides = {}) {
  const info = getAssistantLaunchInfoInternal(assistantId, overrides)
  return {
    assistantId,
    title: info.taskTitle,
    displayTitle: info.displayTitle,
    inputSource: info.inputInfo.source,
    configuredInputSource: info.effectiveInputSource,
    configuredDocumentAction: info.effectiveDocumentAction,
    launchSource: info.launchSource,
    strictAssistantDefaults: info.strictAssistantDefaults === true,
    hasSelection: info.inputInfo.hasSelection === true,
    usesDocument: info.inputInfo.source === 'document',
    inputLength: info.inputText.length,
    requiresFullDocumentConfirm: info.inputInfo.source === 'document' && info.inputInfo.hasSelection !== true
  }
}

export async function runAssistantTask(assistantId, overrides = {}) {
  return startAssistantTask(assistantId, overrides).promise
}

export function stopAssistantTask(taskId) {
  const runState = activeAssistantRuns.get(taskId)
  if (!runState) return false
  runState.cancelled = true
  try {
    runState.abortController?.abort()
  } catch (_) {
    // Ignore abort errors so task state can still transition to cancelled.
  }
  updateTask(taskId, {
    status: 'cancelled',
    error: '任务已停止'
  })
  return true
}

export function isBuiltinRibbonAssistant(assistantId) {
  return BUILTIN_RIBBON_ASSISTANT_SET.has(assistantId)
}
