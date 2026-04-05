import { addTask, getTaskById, updateTask } from './taskListStore.js'
import { generateImageAsset, generateSpeechAsset, generateVideoAsset } from './mediaApi.js'
import { buildGeneratedArtifactDescriptor, mergeTaskOrchestrationData } from './taskOrchestrationMeta.js'
import { bindArtifactsToOwner } from './artifactStore.js'
import { createRenderedArtifact } from './artifactRenderer.js'
import { buildMultimodalGenerationPlan, summarizeMultimodalGenerationPlan } from './multimodalPlanning.js'

const activeMultimodalRuns = new Map()

function yieldToUI(delay = 0) {
  return new Promise(resolve => setTimeout(resolve, delay))
}

function createCancelError() {
  const error = new Error('任务已停止')
  error.name = 'TaskCancelledError'
  error.code = 'TASK_CANCELLED'
  return error
}

function isTaskCancelledError(error) {
  return error?.code === 'TASK_CANCELLED' || error?.name === 'TaskCancelledError'
}

function throwIfCancelled(runState) {
  if (runState?.cancelled) {
    throw createCancelError()
  }
}

function getSelectionPreview(text) {
  const content = String(text || '').trim()
  return content.length > 120 ? `${content.slice(0, 120)}...` : content
}

function getTaskType(kind) {
  return `multimodal-${String(kind || 'unknown').trim() || 'unknown'}`
}

function getKindLabel(kind) {
  if (kind === 'image') return '图片'
  if (kind === 'audio') return '语音'
  if (kind === 'video') return '视频'
  return '多模态'
}

function getErrorSuggestion(kind) {
  if (kind === 'missing-model') return '请先到模型设置中配置并启用对应的图像、语音或视频模型。'
  if (kind === 'auth') return '请检查接口地址、API 密钥和当前账号权限。'
  if (kind === 'quota') return '请检查模型额度、计费状态或稍后重试。'
  if (kind === 'network') return '请检查网络连通性、服务状态、CORS、证书和代理配置。'
  if (kind === 'timeout') return '请稍后重试，或改用更短文本、更简单提示词。'
  if (kind === 'cancelled') return '任务已由用户停止，可重新发起。'
  return '请在任务详情中查看原始报错和请求参数，再决定是否重试。'
}

function buildTaskTitle(kind, fallbackTitle = '') {
  const explicitTitle = String(fallbackTitle || '').trim()
  if (explicitTitle) return explicitTitle
  return `生成${getKindLabel(kind)}`
}

function buildGeneratedFileName(kind, baseName, extension) {
  const fallbackBase = kind === 'image'
    ? '生成图片'
    : kind === 'audio'
      ? '生成语音'
      : '生成视频'
  const ext = String(extension || '').replace(/^\.+/, '').trim() || 'bin'
  return `${String(baseName || fallbackBase).trim() || fallbackBase}.${ext}`
}

function buildRequestSummary(kind, payload = {}) {
  if (kind === 'audio') {
    return String(payload.input || '').trim()
  }
  return String(payload.prompt || '').trim()
}

export function classifyMultimodalError(error, context = {}) {
  const rawMessage = String(error?.message || error || '').trim() || '多模态任务执行失败'
  let kind = 'provider-response'
  if (isTaskCancelledError(error) || error?.name === 'AbortError' || /请求已终止|任务已停止|已停止/.test(rawMessage)) {
    kind = 'cancelled'
  } else if (/未找到可用的.+模型|未配置.+模型|模型不存在|检查模型名称|模型类型/.test(rawMessage)) {
    kind = 'missing-model'
  } else if (/API 密钥|已过期|无权访问|权限|unauthorized|authentication|forbidden|access denied/i.test(rawMessage)) {
    kind = 'auth'
  } else if (/额度|quota|rate limit|429|欠费/i.test(rawMessage)) {
    kind = 'quota'
  } else if (/未拿到响应|NetworkError|Failed to fetch|Load failed|CORS|证书|网络/i.test(rawMessage)) {
    kind = 'network'
  } else if (/超时|timeout/i.test(rawMessage)) {
    kind = 'timeout'
  }
  return {
    kind,
    message: rawMessage,
    rawMessage,
    suggestion: getErrorSuggestion(kind),
    requestKind: String(context.kind || '').trim(),
    providerId: String(context.providerId || '').trim(),
    modelId: String(context.modelId || '').trim(),
    modelDisplayName: String(context.modelDisplayName || '').trim(),
    taskTitle: String(context.taskTitle || '').trim(),
    requestSummary: getSelectionPreview(context.requestSummary || ''),
    requestUrl: String(context.requestUrl || '').trim(),
    scope: String(context.scope || '').trim(),
    timestamp: new Date().toISOString()
  }
}

export async function generateMultimodalAsset(options = {}) {
  const kind = String(options.kind || '').trim()
  if (!['image', 'audio', 'video'].includes(kind)) {
    throw new Error('未识别的多模态任务类型')
  }
  const providerId = String(options.providerId || '').trim()
  const modelId = String(options.modelId || '').trim()
  if (!providerId || !modelId) {
    throw new Error(`未找到可用的${getKindLabel(kind)}模型，请先在设置中配置并启用相应模型`)
  }
  const generationPlan = options.plan && typeof options.plan === 'object'
    ? options.plan
    : buildMultimodalGenerationPlan(options)
  if (kind === 'image') {
    const asset = await generateImageAsset({
      providerId,
      modelId,
      prompt: String(generationPlan.executionPrompt || options.prompt || '').trim(),
      aspectRatio: String(generationPlan.aspectRatio || options.aspectRatio || '').trim() || '16:9',
      signal: options.signal || null
    })
    return {
      ...asset,
      generationPlan
    }
  }
  if (kind === 'audio') {
    const asset = await generateSpeechAsset({
      providerId,
      modelId,
      input: String(generationPlan.executionInput || options.input || '').trim(),
      voiceStyle: String(generationPlan.voiceStyle || options.voiceStyle || '').trim() || '专业自然',
      signal: options.signal || null
    })
    return {
      ...asset,
      generationPlan
    }
  }
  const asset = await generateVideoAsset({
    providerId,
    modelId,
    prompt: String(generationPlan.executionPrompt || options.prompt || '').trim(),
    aspectRatio: String(generationPlan.aspectRatio || options.aspectRatio || '').trim() || '16:9',
    duration: String(generationPlan.duration || options.duration || '').trim() || '8s',
    signal: options.signal || null
  })
  return {
    ...asset,
    generationPlan
  }
}

function createPlaceholderTask(options = {}) {
  const kind = String(options.kind || '').trim() || 'unknown'
  const taskTitle = buildTaskTitle(kind, options.taskTitle)
  return addTask({
    type: getTaskType(kind),
    title: taskTitle,
    status: 'running',
    progress: 1,
    data: {
      requestKind: kind,
      ...mergeTaskOrchestrationData({}, {
        entry: 'dialog',
        primaryIntent: 'generated-output',
        executionMode: 'generated-file-task',
        launchSource: 'dialog'
      }, {
        progressStage: 'preparing'
      }),
      progressEvents: ['任务已创建，正在准备多模态生成环境...'],
      items: []
    }
  })
}

export function startMultimodalTask(options = {}) {
  const kind = String(options.kind || '').trim()
  const taskTitle = buildTaskTitle(kind, options.taskTitle)
  const taskId = createPlaceholderTask({ ...options, kind, taskTitle })
  const generationPlan = buildMultimodalGenerationPlan({ ...options, kind })
  const planSummary = summarizeMultimodalGenerationPlan(generationPlan)
  const planArtifact = createRenderedArtifact(JSON.stringify(generationPlan, null, 2), {
    format: 'json',
    kind: 'plan',
    ownerType: 'task',
    ownerId: taskId,
    route: 'multimodal-plan',
    baseName: `${getKindLabel(kind)}生成计划`,
    sourceType: 'multimodal-plan',
    sourceName: taskTitle,
    retentionTier: 'standard'
  })
  bindArtifactsToOwner('task', taskId, [planArtifact])
  const runState = {
    taskId,
    cancelled: false,
    abortController: typeof AbortController !== 'undefined' ? new AbortController() : null
  }
  activeMultimodalRuns.set(taskId, runState)

  const requestSummary = buildRequestSummary(kind, options)
  const buildTaskData = (extra = {}) => mergeTaskOrchestrationData({
    requestKind: kind,
    requestKindLabel: getKindLabel(kind),
    sourceScope: String(options.scope || '').trim() || 'prompt',
    inputPreview: getSelectionPreview(requestSummary),
    fullInput: requestSummary,
    providerId: String(options.providerId || '').trim(),
    modelId: String(options.modelId || '').trim(),
    modelDisplayName: String(options.modelDisplayName || options.modelId || '').trim(),
    outputPreview: '',
    fullOutput: '',
    generatedMediaKind: kind,
    generatedMediaMimeType: '',
    generatedMediaExtension: '',
    generatedFileName: '',
    generatedArtifacts: Array.isArray(extra.generatedArtifacts) ? extra.generatedArtifacts : [],
    generationPlan,
    generationPlanSummary: planSummary,
    writeTargets: Array.isArray(extra.writeTargets) ? extra.writeTargets : [],
    mediaOptions: {
      aspectRatio: String(options.aspectRatio || '').trim(),
      duration: String(options.duration || '').trim(),
      voiceStyle: String(options.voiceStyle || '').trim()
    },
    progressEvents: Array.isArray(extra.progressEvents) ? extra.progressEvents : [],
    items: Array.isArray(extra.items) ? extra.items : [],
    elapsedMs: Number(extra.elapsedMs || 0),
    estimatedRemainingMs: Number(extra.estimatedRemainingMs || 0),
    errorDetail: extra.errorDetail || null,
    ...extra
  }, {
    entry: 'dialog',
    primaryIntent: 'generated-output',
    executionMode: 'generated-file-task',
    launchSource: 'dialog'
  }, extra)

  const promise = (async () => {
    await yieldToUI()
    try {
      updateTask(taskId, {
        title: taskTitle,
        type: getTaskType(kind),
        status: 'running',
        progress: 12,
        current: 0,
        total: 3,
        data: buildTaskData({
          progressStage: 'preparing',
          generatedArtifacts: [planArtifact],
          progressEvents: [
            `正在准备${getKindLabel(kind)}生成任务...`,
            `已生成结构化计划：${planSummary}`
          ],
          items: [
            {
              title: '生成计划',
              chunkIndex: 1,
              chunkText: planSummary,
              status: 'done',
              output: JSON.stringify(generationPlan),
              issues: []
            }
          ]
        })
      })
      throwIfCancelled(runState)
      updateTask(taskId, {
        progress: 38,
        current: 1,
        total: 3,
        data: buildTaskData({
          progressStage: 'calling_model',
          generatedArtifacts: [planArtifact],
          progressEvents: [
            `正在调用${getKindLabel(kind)}模型...`,
            `计划摘要：${planSummary}`,
            String(options.modelDisplayName || options.modelId || '').trim()
              ? `当前模型：${String(options.modelDisplayName || options.modelId || '').trim()}`
              : ''
          ].filter(Boolean),
          items: [
            {
              title: '生成计划',
              chunkIndex: 1,
              chunkText: planSummary,
              status: 'done',
              output: JSON.stringify(generationPlan),
              issues: []
            },
            {
              title: '输入内容',
              chunkIndex: 2,
              chunkText: getSelectionPreview(requestSummary),
              status: 'running',
              output: '',
              issues: []
            }
          ]
        })
      })
      const asset = await generateMultimodalAsset({
        ...options,
        kind,
        plan: generationPlan,
        signal: runState.abortController?.signal || null
      })
      throwIfCancelled(runState)
      const outputText = String(asset?.revisedPrompt || asset?.prompt || requestSummary).trim()
      const extension = String(asset?.extension || '').replace(/^\.+/, '').trim() || 'bin'
      const mimeType = String(asset?.mimeType || 'application/octet-stream').trim() || 'application/octet-stream'
      const generatedFileName = buildGeneratedFileName(kind, options.fileBaseName, extension)
      const generatedArtifacts = [
        planArtifact,
        buildGeneratedArtifactDescriptor({
          kind,
          ownerType: 'task',
          ownerId: taskId,
          route: 'multimodal-generation',
          name: generatedFileName,
          path: asset?.filePath || '',
          mimeType,
          extension,
          parentArtifactIds: [planArtifact.id],
          rootArtifactId: planArtifact.id,
          retentionTier: 'standard'
        })
      ].filter(item => item.path || item.name)
      bindArtifactsToOwner('task', taskId, generatedArtifacts)
      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        current: 3,
        total: 3,
        data: buildTaskData({
          progressStage: 'completed',
          outputPreview: getSelectionPreview(outputText),
          fullOutput: outputText,
          generatedMediaMimeType: mimeType,
          generatedMediaExtension: extension,
          generatedFileName,
          generatedArtifacts,
          progressEvents: [
            `计划摘要：${planSummary}`,
            `${getKindLabel(kind)}生成完成。`,
            `结果文件：${generatedFileName}`
          ],
          items: [
            {
              title: '生成计划',
              chunkIndex: 1,
              chunkText: planSummary,
              status: 'done',
              output: JSON.stringify(generationPlan),
              issues: []
            },
            {
              title: '输入内容',
              chunkIndex: 2,
              chunkText: getSelectionPreview(requestSummary),
              status: 'done',
              output: getSelectionPreview(outputText),
              issues: []
            },
            {
              title: '结果摘要',
              chunkIndex: 3,
              chunkText: `${getKindLabel(kind)}文件已生成`,
              status: 'done',
              output: generatedFileName,
              issues: []
            }
          ],
          elapsedMs: Date.now() - Number(getTaskById(taskId)?.startedAt ? Date.parse(getTaskById(taskId).startedAt) : Date.now()),
          estimatedRemainingMs: 0
        })
      })
      return {
        taskId,
        asset,
        outputText,
        fileName: generatedFileName,
        kind
      }
    } catch (error) {
      const detail = classifyMultimodalError(error, {
        kind,
        providerId: options.providerId,
        modelId: options.modelId,
        modelDisplayName: options.modelDisplayName,
        taskTitle,
        requestSummary,
        scope: options.scope
      })
      if (detail.kind === 'cancelled') {
        updateTask(taskId, {
          status: 'cancelled',
          error: '任务已停止',
          progress: 100,
          data: buildTaskData({
            progressStage: 'cancelled',
          generatedArtifacts: [planArtifact],
            progressEvents: ['任务已停止。'],
            errorDetail: detail,
            estimatedRemainingMs: 0
          })
        })
        throw createCancelError()
      }
      updateTask(taskId, {
        status: 'failed',
        error: detail.message,
        progress: 100,
        data: buildTaskData({
          progressStage: 'failed',
          generatedArtifacts: [planArtifact],
          outputPreview: detail.message,
          fullOutput: detail.rawMessage,
          progressEvents: [`计划摘要：${planSummary}`, detail.message],
          errorDetail: detail,
          estimatedRemainingMs: 0
        })
      })
      throw error
    } finally {
      activeMultimodalRuns.delete(taskId)
    }
  })()

  return { taskId, promise }
}

export function stopMultimodalTask(taskId) {
  const normalizedTaskId = String(taskId || '').trim()
  if (!normalizedTaskId) return false
  const runState = activeMultimodalRuns.get(normalizedTaskId)
  if (!runState) return false
  runState.cancelled = true
  try {
    runState.abortController?.abort()
  } catch (_) {
    // Ignore abort errors; task state is already marked cancelled.
  }
  return true
}
