import { addTask, updateTask } from './taskListStore.js'
import { getWpsCapabilityByKey } from './wpsCapabilityCatalog.js'
import { openDocumentSaveAsDialog, saveActiveDocument, saveActiveDocumentAs } from './documentFileActions.js'
import { decryptActiveDocument, encryptActiveDocument } from './documentSecurityActions.js'
import { insertBlankPageAtPosition, insertPageBreakAtPosition, insertTableAtPosition } from './documentInsertActions.js'
import { applyDocumentAction, getSelectedText } from './documentActions.js'
import { executeDocumentFormatAction } from './documentFormatActions.js'
import { executeDocumentRelocationAction } from './documentRelocationActions.js'
import { buildGeneratedArtifactDescriptor, mergeTaskOrchestrationData } from './taskOrchestrationMeta.js'
import { appendCapabilityAuditRecord } from './capabilityAuditStore.js'
import { evaluateCapabilityPolicy, inferCapabilityRiskLevel } from './capabilityPolicyStore.js'
import { appendCapabilityQuotaUsage, evaluateCapabilityQuota } from './capabilityQuotaStore.js'

const activeCapabilityRuns = new Map()

function createCancelError() {
  const err = new Error('任务已停止')
  err.code = 'TASK_CANCELLED'
  return err
}

function throwIfCancelled(runState) {
  if (runState?.cancelled) throw createCancelError()
}

function getPreview(text, limit = 200) {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (!value) return ''
  return value.length > limit ? `${value.slice(0, limit)}...` : value
}

function appendEvent(events = [], text = '') {
  const value = String(text || '').trim()
  if (!value) return Array.isArray(events) ? [...events] : []
  return [...(Array.isArray(events) ? events : []), value].slice(-50)
}

function createItem(index, title, content, status = 'done', extra = {}) {
  return {
    index,
    title,
    chunkIndex: index,
    chunkText: String(content || '').trim(),
    status,
    output: String(extra.output || '').trim(),
    issues: Array.isArray(extra.issues) ? extra.issues : []
  }
}

function buildCapabilityWriteTargets(capabilityKey, params, result) {
  const safeResult = result && typeof result === 'object' ? result : {}
  if (['save-document', 'save-document-as', 'save-document-with-dialog', 'encrypt-document', 'encrypt-document-with-dialog', 'decrypt-document'].includes(capabilityKey)) {
    return []
  }
  if (capabilityKey === 'insert-table') {
    return [{
      action: 'insert-table',
      start: null,
      end: null,
      paragraphIndex: Number.isFinite(Number(params?.pageNumber)) ? Number(params.pageNumber) : null,
      originalText: '',
      outputText: `${Number(safeResult.rows || params?.rows || 0)}x${Number(safeResult.columns || params?.columns || 0)} 表格`,
      downgraded: false,
      locateKey: `wps_insert_table_${Number(params?.pageNumber || 0)}`
    }]
  }
  if (capabilityKey === 'insert-page-break' || capabilityKey === 'insert-blank-page') {
    return [{
      action: capabilityKey,
      start: null,
      end: null,
      paragraphIndex: Number.isFinite(Number(params?.pageNumber)) ? Number(params.pageNumber) : null,
      originalText: '',
      outputText: capabilityKey === 'insert-page-break' ? '分页符' : '空白页',
      downgraded: false,
      locateKey: `wps_${capabilityKey}_${Number(params?.pageNumber || 0)}`
    }]
  }
  if (['replace-selection-text', 'paste-text', 'append-text-to-document', 'duplicate-selection-text'].includes(capabilityKey)) {
    return [{
      action: capabilityKey,
      start: null,
      end: null,
      paragraphIndex: null,
      originalText: '',
      outputText: capabilityKey === 'duplicate-selection-text'
        ? String(getSelectedText() || '').trim()
        : String(params?.text || '').trim(),
      downgraded: false,
      locateKey: `wps_${capabilityKey}`
    }]
  }
  if ([
    'set-font-name',
    'set-font-size',
    'set-font-color',
    'set-background-color',
    'toggle-bold',
    'toggle-italic',
    'toggle-underline',
    'set-alignment',
    'set-line-spacing'
  ].includes(capabilityKey)) {
    const replayPayload = {
      scope: 'selection',
      fontName: params.fontName,
      fontSize: params.fontSize,
      fontColor: params.fontColor || params.color,
      backgroundColor: params.backgroundColor || params.color,
      bold: capabilityKey === 'toggle-bold' ? params.enabled !== false : undefined,
      italic: capabilityKey === 'toggle-italic' ? params.enabled !== false : undefined,
      underline: capabilityKey === 'toggle-underline' ? params.enabled !== false : undefined,
      alignment: capabilityKey === 'set-alignment' ? params.alignment || 'left' : undefined,
      lineSpacing: capabilityKey === 'set-line-spacing' ? params.lineSpacing || 1.5 : undefined
    }
    return [{
      action: 'format-selection',
      start: null,
      end: null,
      paragraphIndex: null,
      originalText: '',
      outputText: safeResult?.message || capabilityKey,
      downgraded: false,
      locateKey: `wps_${capabilityKey}`,
      replayPayload
    }]
  }
  return []
}

export function executeWpsCapabilityDirect(capabilityKey, params = {}) {
  if (capabilityKey === 'save-document') return saveActiveDocument(params)
  if (capabilityKey === 'save-document-as') return saveActiveDocumentAs(params.savePath)
  if (capabilityKey === 'save-document-with-dialog') {
    const savePath = openDocumentSaveAsDialog({ title: '另存文档' })
    if (!savePath) throw new Error('用户取消了另存为')
    return saveActiveDocumentAs(savePath)
  }
  if (capabilityKey === 'encrypt-document') return encryptActiveDocument(params)
  if (capabilityKey === 'encrypt-document-with-dialog') {
    const savePath = openDocumentSaveAsDialog({ title: '加密保存文档' })
    if (!savePath) throw new Error('用户取消了加密保存')
    return encryptActiveDocument({ ...params, savePath })
  }
  if (capabilityKey === 'decrypt-document') return decryptActiveDocument(params)
  if (capabilityKey === 'insert-table') return insertTableAtPosition(params)
  if (capabilityKey === 'insert-page-break') return insertPageBreakAtPosition(params)
  if (capabilityKey === 'insert-blank-page') return insertBlankPageAtPosition(params)
  if (capabilityKey === 'replace-selection-text') {
    return applyDocumentAction('replace', String(params.text || '').trim(), params)
  }
  if (capabilityKey === 'paste-text') {
    return applyDocumentAction('insert', String(params.text || '').trim(), params)
  }
  if (capabilityKey === 'append-text-to-document') {
    return applyDocumentAction('append', String(params.text || '').trim(), params)
  }
  if (capabilityKey === 'copy-current-paragraph') {
    return executeDocumentRelocationAction({
      intent: 'copy',
      operation: 'copy',
      sourceType: 'current-paragraph',
      destinationType: 'paragraph-index',
      destinationIndex: Number(params.destinationIndex || 1),
      placement: String(params.placement || 'after').trim() || 'after',
      preserveFormatting: params.preserveFormatting !== false
    })
  }
  if (capabilityKey === 'duplicate-selection-text') {
    const selectedText = String(getSelectedText() || '').trim()
    if (!selectedText) {
      throw new Error('当前没有可复制的选中文本')
    }
    return applyDocumentAction('insert', selectedText, params)
  }
  if (capabilityKey === 'set-font-name') {
    return executeDocumentFormatAction({ scope: 'selection', fontName: params.fontName })
  }
  if (capabilityKey === 'set-font-size') {
    return executeDocumentFormatAction({ scope: 'selection', fontSize: Number(params.fontSize || 12) })
  }
  if (capabilityKey === 'set-font-color') {
    return executeDocumentFormatAction({ scope: 'selection', fontColor: params.fontColor || params.color })
  }
  if (capabilityKey === 'set-background-color') {
    return executeDocumentFormatAction({ scope: 'selection', backgroundColor: params.backgroundColor || params.color })
  }
  if (capabilityKey === 'toggle-bold') {
    return executeDocumentFormatAction({ scope: 'selection', bold: params.enabled !== false })
  }
  if (capabilityKey === 'toggle-italic') {
    return executeDocumentFormatAction({ scope: 'selection', italic: params.enabled !== false })
  }
  if (capabilityKey === 'toggle-underline') {
    return executeDocumentFormatAction({ scope: 'selection', underline: params.enabled !== false })
  }
  if (capabilityKey === 'set-alignment') {
    return executeDocumentFormatAction({ scope: 'selection', alignment: params.alignment || 'left' })
  }
  if (capabilityKey === 'set-line-spacing') {
    return executeDocumentFormatAction({ scope: 'selection', lineSpacing: params.lineSpacing || 1.5 })
  }
  throw new Error(`暂未实现能力：${capabilityKey}`)
}

function buildSuccessMessage(capabilityKey, result) {
  if (capabilityKey === 'save-document') {
    return `已保存文档：${result.fileName || result.path || '当前文档'}`
  }
  if (capabilityKey === 'save-document-as') {
    return `已将文档另存为：${result.fileName || result.path || '新文档'}`
  }
  if (capabilityKey === 'save-document-with-dialog') {
    return `已选择路径并另存文档：${result.fileName || result.path || '新文档'}`
  }
  if (capabilityKey === 'encrypt-document') {
    return `已加密并保存文档：${result.fileName || result.path || '当前文档'}`
  }
  if (capabilityKey === 'encrypt-document-with-dialog') {
    return `已选择路径并加密保存文档：${result.fileName || result.path || '当前文档'}`
  }
  if (capabilityKey === 'decrypt-document') {
    return `已移除文档密码并保存：${result.fileName || result.path || '当前文档'}`
  }
  if (capabilityKey === 'insert-table') {
    return `已插入 ${Number(result.rows || 0)} 行 ${Number(result.columns || 0)} 列表格`
  }
  if (capabilityKey === 'insert-page-break') {
    return `已插入分页符${Number(result.pageNumber || 0) > 0 ? `（第 ${Number(result.pageNumber)} 页）` : ''}`
  }
  if (capabilityKey === 'insert-blank-page') {
    return `已插入空白页${Number(result.pageNumber || 0) > 0 ? `（第 ${Number(result.pageNumber)} 页）` : ''}`
  }
  return result?.message || '操作已完成'
}

export function startWpsCapabilityTask(options = {}) {
  let taskId = ''
  const promise = executeWpsCapabilityTask({
    ...options,
    onTaskCreated: (id) => {
      taskId = id
      options.onTaskCreated?.(id)
    }
  })
  return { taskId, promise }
}

export async function executeWpsCapabilityTask(options = {}) {
  const capabilityKey = String(options.capabilityKey || '').trim()
  const capability = getWpsCapabilityByKey(capabilityKey)
  if (!capability) throw new Error('未找到对应的 WPS 能力')
  const requirementText = String(options.requirementText || '').trim()
  const params = options.params && typeof options.params === 'object' ? options.params : {}
  const riskLevel = inferCapabilityRiskLevel(capability, 'wps')
  const policyDecision = evaluateCapabilityPolicy({
    namespace: 'wps',
    capabilityKey,
    entry: 'wps-capability',
    launchSource: options.launchSource || 'dialog',
    confirmed: options.confirmed !== false
  }, capability)
  if (!policyDecision.allowed) {
    appendCapabilityAuditRecord({
      namespace: 'wps',
      capabilityKey,
      capabilityLabel: capability.label,
      status: policyDecision.decision === 'deny' ? 'denied' : 'failed',
      riskLevel,
      decision: policyDecision.decision,
      decisionReason: policyDecision.reason,
      confirmed: policyDecision.confirmed,
      entry: 'wps-capability',
      launchSource: options.launchSource || 'dialog',
      requirementText,
      params
    })
    throw new Error(policyDecision.reason || '能力策略拒绝执行')
  }
  const quotaDecision = evaluateCapabilityQuota({
    namespace: 'wps',
    capabilityKey,
    policySnapshot: policyDecision.policySnapshot
  })
  if (!quotaDecision.allowed) {
    appendCapabilityAuditRecord({
      namespace: 'wps',
      capabilityKey,
      capabilityLabel: capability.label,
      status: 'failed',
      riskLevel,
      decision: quotaDecision.decision,
      decisionReason: quotaDecision.reason,
      confirmed: policyDecision.confirmed,
      entry: 'wps-capability',
      launchSource: options.launchSource || 'dialog',
      requirementText,
      params
    })
    throw new Error(quotaDecision.reason || '能力调用已达到配额限制')
  }
  const taskTitle = String(options.taskTitle || capability.label || 'WPS 任务').trim() || 'WPS 任务'
  const initialEvents = ['已创建 WPS 直接操作任务。', '正在校验参数并准备执行。']
  const taskId = addTask({
    type: 'wps-capability',
    title: taskTitle,
    status: 'running',
    total: 3,
    current: 0,
    progress: 8,
    data: {
      capabilityKey,
      capabilityLabel: capability.label,
      inputPreview: getPreview(requirementText, 220),
      ...mergeTaskOrchestrationData({}, {
        entry: 'wps-capability',
        primaryIntent: 'wps-capability',
        executionMode: 'wps-task',
        launchSource: 'dialog'
      }, {
        progressStage: 'preparing'
      }),
      progressEvents: initialEvents,
      items: [],
      params,
      resultSummary: ''
    }
  })
  options.onTaskCreated?.(taskId)
  const runState = {
    taskId,
    cancelled: false,
    startedAtMs: Date.now()
  }
  activeCapabilityRuns.set(taskId, runState)
  try {
    const step1Events = appendEvent(initialEvents, '参数校验完成，开始调用 WPS API。')
    updateTask(taskId, {
      current: 1,
      progress: 30,
      data: mergeTaskOrchestrationData({}, {
        entry: 'wps-capability',
        primaryIntent: 'wps-capability',
        executionMode: 'wps-task',
        launchSource: 'dialog'
      }, {
        capabilityKey,
        capabilityLabel: capability.label,
        inputPreview: getPreview(requirementText, 220),
        progressStage: 'executing',
        progressEvents: step1Events,
        items: [createItem(1, '参数校验', JSON.stringify(params), 'done')],
        params
      })
    })
    throwIfCancelled(runState)

    const result = executeWpsCapabilityDirect(capabilityKey, params)
    appendCapabilityQuotaUsage({
      namespace: 'wps',
      capabilityKey
    })
    const elapsedMs = Date.now() - runState.startedAtMs
    appendCapabilityAuditRecord({
      namespace: 'wps',
      capabilityKey,
      capabilityLabel: capability.label,
      status: 'completed',
      riskLevel,
      decision: policyDecision.decision,
      decisionReason: policyDecision.reason,
      confirmed: policyDecision.confirmed,
      entry: 'wps-capability',
      launchSource: 'dialog',
      taskId,
      requirementText,
      params,
      result,
      durationMs: elapsedMs
    })
    const successMessage = buildSuccessMessage(capabilityKey, result)
    const finalEvents = appendEvent(step1Events, successMessage)
    const generatedArtifacts = ['save-document', 'save-document-as', 'save-document-with-dialog', 'encrypt-document', 'encrypt-document-with-dialog'].includes(capabilityKey)
      ? [buildGeneratedArtifactDescriptor({
        kind: capabilityKey === 'encrypt-document' || capabilityKey === 'encrypt-document-with-dialog' ? 'encrypted-document' : 'document',
        name: result?.fileName || '',
        path: result?.path || params?.savePath || '',
        status: 'ready'
      })].filter(item => item.path || item.name)
      : []
    const writeTargets = buildCapabilityWriteTargets(capabilityKey, params, result)
    updateTask(taskId, {
      status: 'completed',
      current: 3,
      progress: 100,
      data: mergeTaskOrchestrationData({}, {
        entry: 'wps-capability',
        primaryIntent: 'wps-capability',
        executionMode: 'wps-task',
        launchSource: 'dialog'
      }, {
        capabilityKey,
        capabilityLabel: capability.label,
        inputPreview: getPreview(requirementText, 220),
        outputPreview: successMessage,
        fullOutput: successMessage,
        resultSummary: successMessage,
        progressStage: 'completed',
        progressEvents: finalEvents,
        generatedArtifacts,
        writeTargets,
        estimatedRemainingMs: 0,
        elapsedMs,
        avgStepMs: Math.round(elapsedMs / 3),
        stepCount: 3,
        currentStepIndex: 3,
        items: [
          createItem(1, '参数校验', JSON.stringify(params), 'done'),
          createItem(2, '执行能力', capability.label, 'done', { output: JSON.stringify(result) }),
          createItem(3, '执行结果', successMessage, 'done')
        ],
        params,
        applyResult: {
          ok: true,
          action: capabilityKey,
          message: successMessage,
          result,
          writeTargets
        }
      })
    })
    return {
      taskId,
      result,
      message: successMessage
    }
  } catch (error) {
    const failedText = error?.message || String(error)
    appendCapabilityAuditRecord({
      namespace: 'wps',
      capabilityKey,
      capabilityLabel: capability.label,
      status: error?.code === 'TASK_CANCELLED' ? 'cancelled' : 'failed',
      riskLevel,
      decision: policyDecision.decision,
      decisionReason: failedText || policyDecision.reason,
      confirmed: policyDecision.confirmed,
      entry: 'wps-capability',
      launchSource: 'dialog',
      taskId,
      requirementText,
      params,
      errorMessage: failedText,
      durationMs: Date.now() - runState.startedAtMs
    })
    updateTask(taskId, {
      status: error?.code === 'TASK_CANCELLED' ? 'cancelled' : 'failed',
      current: 3,
      progress: 100,
      error: failedText,
      data: mergeTaskOrchestrationData({}, {
        entry: 'wps-capability',
        primaryIntent: 'wps-capability',
        executionMode: 'wps-task',
        launchSource: 'dialog'
      }, {
        capabilityKey,
        capabilityLabel: capability.label,
        inputPreview: getPreview(requirementText, 220),
        outputPreview: failedText,
        fullOutput: failedText,
        resultSummary: failedText,
        progressStage: error?.code === 'TASK_CANCELLED' ? 'cancelled' : 'failed',
        progressEvents: appendEvent(['已创建 WPS 直接操作任务。'], failedText),
        estimatedRemainingMs: 0,
        elapsedMs: Date.now() - runState.startedAtMs,
        avgStepMs: 0,
        stepCount: 3,
        currentStepIndex: 3,
        items: [createItem(1, '执行失败', failedText, 'failed', { output: failedText })],
        params
      })
    })
    throw error
  } finally {
    activeCapabilityRuns.delete(taskId)
  }
}

export function stopWpsCapabilityTask(taskId) {
  const runState = activeCapabilityRuns.get(String(taskId || ''))
  if (!runState) return false
  runState.cancelled = true
  updateTask(taskId, {
    status: 'cancelled',
    error: '任务已停止'
  })
  return true
}
