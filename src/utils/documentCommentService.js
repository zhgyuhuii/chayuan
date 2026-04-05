import { chatCompletion } from './chatApi.js'
import { getApplication } from './documentActions.js'
import { getDocumentChunksWithPositions, getSelectionChunksWithPositions } from './documentChunker.js'
import { addTask, getTaskById, updateTask } from './taskListStore.js'
import { addCommentAtText } from './spellCheckService.js'

const DOCUMENT_COMMENT_TASK_TYPE = 'document-comment'
const activeDocumentCommentRuns = new Map()

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

function yieldToUI() {
  return new Promise(resolve => window.setTimeout(resolve, 0))
}

function createDocumentCommentPlaceholderTask(taskTitle, requestText, scope = 'document') {
  return addTask({
    type: DOCUMENT_COMMENT_TASK_TYPE,
    title: String(taskTitle || '智能批注').trim() || '智能批注',
    status: 'running',
    total: 0,
    current: 0,
    progress: 1,
    data: {
      progressStage: 'preparing',
      inputPreview: getInputPreview(requestText, 220),
      chunkSource: scope === 'selection' ? 'selection' : 'document',
      chunkCount: 0,
      commentCount: 0,
      currentChunk: '',
      progressEvents: ['任务已创建，正在准备批注内容...'],
      items: []
    }
  })
}

function getInputPreview(text, limit = 180) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (!value) return ''
  return value.length > limit ? `${value.slice(0, limit)}...` : value
}

function normalizeInlineText(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

function appendProgressEvent(events, text, limit = 40) {
  const content = String(text || '').trim()
  if (!content) return Array.isArray(events) ? [...events] : []
  const next = [...(Array.isArray(events) ? events : []), content]
  return next.slice(-limit)
}

function buildCommentOutputPreview(message, matchedChunkCount, commentSamples = []) {
  const lines = [String(message || '').trim()]
  if (matchedChunkCount > 0) {
    lines.push(`共命中 ${matchedChunkCount} 个文档片段。`)
  }
  if (Array.isArray(commentSamples) && commentSamples.length > 0) {
    lines.push('批注示例：')
    commentSamples.slice(0, 3).forEach((item, index) => {
      lines.push(`${index + 1}. ${getInputPreview(item.anchorText, 28)} -> ${getInputPreview(item.commentText, 42)}`)
    })
  }
  return lines.filter(Boolean).join('\n')
}

function getCommentScopeRange(comment) {
  try {
    return comment?.Scope || comment?.Reference || comment?.Range || null
  } catch (_) {
    return null
  }
}

function getCommentBodyText(comment) {
  try {
    return normalizeInlineText(comment?.Range?.Text || comment?.Text || '')
  } catch (_) {
    return ''
  }
}

function matchCommentDescriptor(comment, descriptor) {
  const range = getCommentScopeRange(comment)
  if (!range) return false
  if (Number(range.Start || 0) !== Number(descriptor?.start || 0)) return false
  if (Number(range.End || 0) !== Number(descriptor?.end || 0)) return false
  const expectedBody = normalizeInlineText(descriptor?.commentText || '')
  if (!expectedBody) return true
  const actualBody = getCommentBodyText(comment)
  return !actualBody || actualBody === expectedBody
}

function extractJsonCandidate(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1).trim()
  return text
}

function normalizeIssues(items) {
  if (!Array.isArray(items)) return []
  const unique = []
  const seen = new Set()
  items.forEach((item) => {
    if (!item || typeof item !== 'object') return
    const normalized = {
      text: String(item.text || item.anchorText || '').trim(),
      prefix: String(item.prefix || item.leftContext || '').trim(),
      suffix: String(item.suffix || item.rightContext || '').trim(),
      comment: String(item.comment || item.note || item.reason || '').trim(),
      reason: String(item.reason || '').trim()
    }
    if (!normalized.text || !normalized.comment) return
    const dedupeKey = [
      normalized.text,
      normalized.prefix,
      normalized.suffix,
      normalized.comment
    ].join('||')
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)
    unique.push(normalized)
  })
  return unique
}

function parseAnnotationResponse(raw) {
  const candidate = extractJsonCandidate(raw)
  if (!candidate) return []
  try {
    const parsed = JSON.parse(candidate)
    const issues = Array.isArray(parsed)
      ? parsed
      : (parsed?.issues || parsed?.items || parsed?.matches || [])
    return normalizeIssues(issues)
  } catch (_) {
    return []
  }
}

function buildSystemPrompt() {
  return [
    '你是一位文档批注定位助手，负责根据用户的批注要求，从给定文本片段中找出需要添加批注的原文位置，并生成适合直接写入 WPS 批注的简短说明。',
    '请严格遵守以下要求：',
    '1. 只依据“用户要求”和“当前文本片段”判断，不要臆造文档外信息。',
    '2. 只返回命中的内容；若当前片段没有任何命中，返回 {"issues":[]}。',
    '3. 每个 issue 的 text 必须是当前文本片段中的连续原文，不能改写、不能拼接。',
    '4. prefix 和 suffix 分别返回 text 前后紧邻的最多 12 个原文字符；没有则返回空字符串。',
    '5. comment 必须简洁、克制、适合直接写入批注，优先说明“为什么命中用户要求”或“建议人工复核什么”。',
    '6. 除非确有必要，不要为同一处内容拆出多个重复 issue。',
    '7. 返回必须是合法 JSON，不要输出 Markdown，不要解释过程。',
    '返回格式：{"issues":[{"text":"","prefix":"","suffix":"","comment":"","reason":""}]}'
  ].join('\n')
}

function buildUserPrompt(requestText, chunkText) {
  return [
    '【用户要求】',
    String(requestText || '').trim() || '(空)',
    '',
    '【当前文本片段】',
    '---',
    String(chunkText || ''),
    '---',
    '',
    '请找出当前片段中需要添加批注的位置，并按指定 JSON 返回。'
  ].join('\n')
}

function resolveChunks(scope) {
  const app = getApplication()
  const doc = app?.ActiveDocument
  const selection = app?.Selection
  if (!doc) {
    throw new Error('当前没有打开文档')
  }
  if (scope === 'selection') {
    const chunks = getSelectionChunksWithPositions(doc, selection)
    if (chunks.length === 0) {
      throw new Error('请先选中要处理的文本')
    }
    return {
      doc,
      chunks,
      inputSource: 'selection'
    }
  }
  const chunks = getDocumentChunksWithPositions(doc, {
    splitStrategy: 'paragraph',
    overlapLength: 0,
    chunkLength: 1200
  })
  if (chunks.length === 0) {
    throw new Error('当前文档没有可处理的文本内容')
  }
  return {
    doc,
    chunks,
    inputSource: 'document'
  }
}

async function executeDocumentCommentTask(options = {}) {
  const requestText = String(options.requestText || '').trim()
  if (!requestText) {
    throw new Error('缺少批注要求')
  }
  const model = options.model && typeof options.model === 'object' ? options.model : null
  if (!model?.providerId || !model?.modelId) {
    throw new Error('未找到可用模型，请先在聊天面板中选择模型')
  }
  const scope = options.scope === 'selection' ? 'selection' : 'document'
  const { doc, chunks, inputSource } = resolveChunks(scope)
  const taskTitle = String(options.taskTitle || '智能批注').trim() || '智能批注'
  const systemPrompt = buildSystemPrompt()
  const taskId = String(options.placeholderTaskId || '').trim() || addTask({
    type: DOCUMENT_COMMENT_TASK_TYPE,
    title: taskTitle,
    status: 'running',
    total: chunks.length,
    current: 0,
    progress: 4,
    data: {
      progressStage: 'preparing',
      inputPreview: getInputPreview(requestText, 220),
      chunkSource: inputSource,
      chunkCount: chunks.length,
      commentCount: 0,
      currentChunk: '',
      progressEvents: ['已创建批注任务，正在准备文档内容。'],
      modelId: `${model.providerId}|${model.modelId}`,
      modelDisplayName: model.name || model.modelId
    }
  })
  if (String(options.placeholderTaskId || '').trim()) {
    updateTask(taskId, {
      title: taskTitle,
      status: 'running',
      total: chunks.length,
      current: 0,
      progress: 4,
      data: {
        progressStage: 'preparing',
        inputPreview: getInputPreview(requestText, 220),
        chunkSource: inputSource,
        chunkCount: chunks.length,
        commentCount: 0,
        currentChunk: '',
        progressEvents: ['批注界面已渲染，正在准备文档分段与模型请求...'],
        modelId: `${model.providerId}|${model.modelId}`,
        modelDisplayName: model.name || model.modelId
      }
    })
  }
  options.onTaskCreated?.(taskId)
  const runState = {
    taskId,
    cancelled: false,
    abortController: typeof AbortController !== 'undefined' ? new AbortController() : null
  }
  activeDocumentCommentRuns.set(taskId, runState)

  try {
    let totalComments = 0
    let matchedChunkCount = 0
    let progressEvents = ['已开始扫描文档片段。']
    const addedComments = []
    const items = []
    const runStartedAtMs = Date.now()

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunkText = String(chunk?.text || '')
      const chunkPreview = getInputPreview(chunkText, 140)
      const chunkStartedAtMs = Date.now()
      progressEvents = appendProgressEvent(progressEvents, `开始分析第 ${i + 1}/${chunks.length} 段内容。`)
      items.push({
        chunkIndex: i + 1,
        title: `第 ${i + 1}/${chunks.length} 段`,
        chunkText: chunkPreview,
        status: 'running',
        issues: [],
        output: '',
        startedAt: new Date(chunkStartedAtMs).toISOString()
      })
      const elapsedMs = Date.now() - runStartedAtMs
      const avgChunkMs = (i + 1) > 0 ? Math.round(elapsedMs / (i + 1)) : 0
      const estimatedRemainingMs = Math.max(0, avgChunkMs * Math.max(0, chunks.length - (i + 1)))
      updateTask(taskId, {
        current: i + 1,
        progress: Math.min(92, Math.max(8, Math.round(((i + 1) / chunks.length) * 92))),
        data: {
          progressStage: 'calling_model',
          inputPreview: getInputPreview(requestText, 220),
          chunkSource: inputSource,
          chunkCount: chunks.length,
          commentCount: totalComments,
          currentChunk: chunkPreview,
          matchedChunkCount,
          currentChunkIndex: i + 1,
          elapsedMs,
          avgStepMs: avgChunkMs,
          estimatedRemainingMs,
          items: [...items],
          progressEvents,
          modelId: `${model.providerId}|${model.modelId}`,
          modelDisplayName: model.name || model.modelId
        }
      })
      throwIfCancelled(runState)

      const raw = await chatCompletion({
        providerId: model.providerId,
        modelId: model.modelId,
        temperature: 0,
        signal: runState.abortController?.signal,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildUserPrompt(requestText, chunkText) }
        ]
      })

      throwIfCancelled(runState)
      const issues = parseAnnotationResponse(raw)
      if (issues.length > 0) {
        matchedChunkCount += 1
        progressEvents = appendProgressEvent(progressEvents, `第 ${i + 1}/${chunks.length} 段命中 ${issues.length} 处待批注内容。`)
      } else {
        progressEvents = appendProgressEvent(progressEvents, `第 ${i + 1}/${chunks.length} 段未命中需要批注的内容。`)
      }
      items[i] = {
        ...items[i],
        issues: issues.map(issue => ({
          text: String(issue.text || ''),
          comment: String(issue.comment || ''),
          reason: String(issue.reason || issue.comment || '')
        }))
      }
      for (let issueIndex = 0; issueIndex < issues.length; issueIndex++) {
        const issue = issues[issueIndex]
        const result = addCommentAtText(doc, chunk.start, issue, chunkText, issue.comment)
        if (result?.ok) {
          totalComments += 1
          addedComments.push({
            start: Number(result.range?.start || 0),
            end: Number(result.range?.end || 0),
            anchorText: String(issue.text || ''),
            commentText: String(issue.comment || '')
          })
        }
        if ((issueIndex + 1) % 4 === 0) {
          await yieldToUI()
        }
      }
      items[i] = {
        ...items[i],
        status: 'completed',
        output: issues.length > 0
          ? `本段已添加 ${issues.length} 处批注`
          : '本段未命中需要批注的内容',
        commentCount: issues.length,
        endedAt: new Date().toISOString()
      }
      await yieldToUI()
    }

    const applyMessage = totalComments > 0
      ? `已添加 ${totalComments} 处批注`
      : '未命中需要添加批注的内容'
    progressEvents = appendProgressEvent(progressEvents, applyMessage)
    const elapsedMs = Date.now() - runStartedAtMs
    updateTask(taskId, {
      status: 'completed',
      current: chunks.length,
      progress: 100,
      data: {
        progressStage: 'completed',
        inputPreview: getInputPreview(requestText, 220),
        outputPreview: buildCommentOutputPreview(applyMessage, matchedChunkCount, addedComments),
        chunkSource: inputSource,
        chunkCount: chunks.length,
        matchedChunkCount,
        commentCount: totalComments,
        currentChunk: '',
        currentChunkIndex: chunks.length,
        elapsedMs,
        avgStepMs: chunks.length > 0 ? Math.round(elapsedMs / chunks.length) : 0,
        estimatedRemainingMs: 0,
        items,
        progressEvents,
        appliedComments: addedComments,
        undo: {
          status: totalComments > 0 ? 'available' : 'unavailable',
          commentCount: totalComments
        },
        modelId: `${model.providerId}|${model.modelId}`,
        modelDisplayName: model.name || model.modelId,
        applyResult: {
          ok: true,
          action: 'comment',
          message: applyMessage
        }
      }
    })
    return {
      taskId,
      commentCount: totalComments,
      chunkCount: chunks.length,
      matchedChunkCount
    }
  } catch (error) {
    if (isTaskCancelledError(error) || runState.cancelled) {
      const progressEvents = appendProgressEvent(
        getTaskById(taskId)?.data?.progressEvents,
        '任务已停止，未继续后续批注处理。'
      )
      updateTask(taskId, {
        status: 'cancelled',
        error: '任务已停止',
        progress: 100,
        data: {
          progressStage: 'cancelled',
          inputPreview: getInputPreview(requestText, 220),
          chunkSource: inputSource,
          chunkCount: chunks.length,
          estimatedRemainingMs: 0,
          progressEvents
        }
      })
      throw createCancelError()
    }
    const progressEvents = appendProgressEvent(
      getTaskById(taskId)?.data?.progressEvents,
      `任务执行失败：${error?.message || String(error)}`
    )
    updateTask(taskId, {
      status: 'failed',
      error: error?.message || String(error),
      progress: 100,
      data: {
        progressStage: 'failed',
        inputPreview: getInputPreview(requestText, 220),
        estimatedRemainingMs: 0,
        progressEvents
      }
    })
    throw error
  } finally {
    activeDocumentCommentRuns.delete(taskId)
  }
}

export function startDocumentCommentTask(options = {}) {
  const taskId = createDocumentCommentPlaceholderTask(options.taskTitle, options.requestText, options.scope)
  options.onTaskCreated?.(taskId)
  const promise = (async () => {
    await yieldToUI()
    try {
      return await executeDocumentCommentTask({
        ...options,
        placeholderTaskId: taskId,
        onTaskCreated: (id) => {
          if (String(id || '').trim() && String(id || '').trim() !== taskId) {
            options.onTaskCreated?.(id)
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
          progressEvents: [error?.message || String(error || '智能批注启动失败')],
          estimatedRemainingMs: 0
        }
      })
      throw error
    }
  })()
  return {
    taskId,
    promise
  }
}

export function stopDocumentCommentTask(taskId) {
  const runState = activeDocumentCommentRuns.get(String(taskId || ''))
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

export function undoDocumentCommentTask(taskId) {
  const normalizedTaskId = String(taskId || '')
  const task = getTaskById(normalizedTaskId)
  if (!task) {
    throw new Error('未找到对应的批注任务')
  }
  if (task.type !== DOCUMENT_COMMENT_TASK_TYPE) {
    throw new Error('当前任务不支持撤销')
  }
  const undoState = task.data?.undo || {}
  if (undoState.status === 'undone') {
    return {
      ok: true,
      taskId: normalizedTaskId,
      undoneCount: Number(undoState.commentCount || 0),
      message: task.data?.applyResult?.message || '本次批注已撤销'
    }
  }
  const appliedComments = Array.isArray(task.data?.appliedComments) ? task.data.appliedComments : []
  if (appliedComments.length === 0) {
    throw new Error('当前任务没有可撤销的批注')
  }
  const doc = getApplication()?.ActiveDocument
  const comments = doc?.Comments
  const count = Number(comments?.Count || 0)
  if (!doc || !comments || count <= 0) {
    throw new Error('当前文档中没有可撤销的批注')
  }

  const remaining = [...appliedComments]
  let undoneCount = 0
  for (let i = count; i >= 1 && remaining.length > 0; i--) {
    try {
      const comment = comments.Item(i)
      const matchedIndex = remaining.findIndex(item => matchCommentDescriptor(comment, item))
      if (matchedIndex < 0) continue
      if (typeof comment?.Delete !== 'function') {
        throw new Error('当前环境不支持删除批注')
      }
      comment.Delete()
      remaining.splice(matchedIndex, 1)
      undoneCount += 1
    } catch (error) {
      if (error?.message === '当前环境不支持删除批注') throw error
    }
  }

  if (undoneCount <= 0) {
    throw new Error('未定位到本次新增的批注，文档内容可能已发生变化')
  }

  const message = undoneCount === appliedComments.length
    ? `已撤销本次新增的 ${undoneCount} 处批注`
    : `已撤销 ${undoneCount} 处批注，其余批注未能自动定位`
  updateTask(normalizedTaskId, {
    data: {
      ...task.data,
      outputPreview: message,
      progressEvents: appendProgressEvent(task.data?.progressEvents, message),
      undo: {
        status: 'undone',
        commentCount: undoneCount,
        totalCount: appliedComments.length
      },
      applyResult: {
        ...(task.data?.applyResult || {}),
        ok: true,
        action: 'comment-undo',
        message
      }
    }
  })

  return {
    ok: true,
    taskId: normalizedTaskId,
    undoneCount,
    totalCount: appliedComments.length,
    message
  }
}

export { DOCUMENT_COMMENT_TASK_TYPE }
