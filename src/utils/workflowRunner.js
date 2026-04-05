import { addTask, getTaskById, getTasks, updateTask } from './taskListStore.js'
import { startAssistantTask, stopAssistantTask } from './assistantTaskRunner.js'
import { END_NODE_ID, START_NODE_ID, getWorkflowEligibleAssistants, normalizeWorkflow } from './workflowStore.js'
import {
  executeWorkflowTool,
  getWorkflowToolByType,
  getWorkflowToolOutputText,
  resolveWorkflowNodeInput
} from './workflowTools.js'

const activeWorkflowRuns = new Map()

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createCancelError() {
  const error = new Error('工作流已停止')
  error.name = 'WorkflowCancelledError'
  error.code = 'WORKFLOW_CANCELLED'
  return error
}

function isCancelledError(error) {
  return error?.code === 'WORKFLOW_CANCELLED' || error?.name === 'WorkflowCancelledError'
}

function buildWorkflowMaps(workflow) {
  const nodeMap = new Map(workflow.nodes.map(node => [node.id, node]))
  const incoming = new Map()
  const outgoing = new Map()

  workflow.nodes.forEach(node => {
    incoming.set(node.id, [])
    outgoing.set(node.id, [])
  })

  workflow.edges.forEach(edge => {
    if (!incoming.has(edge.target) || !outgoing.has(edge.source)) return
    incoming.get(edge.target).push(edge)
    outgoing.get(edge.source).push(edge)
  })

  outgoing.forEach(list => {
    list.sort((a, b) => Number(a.data?.order ?? 0) - Number(b.data?.order ?? 0))
  })

  return { nodeMap, incoming, outgoing }
}

export function validateWorkflow(workflowInput) {
  const workflow = normalizeWorkflow(workflowInput)
  const { nodeMap, incoming, outgoing } = buildWorkflowMaps(workflow)
  const startNode = nodeMap.get(START_NODE_ID)
  if (!startNode) {
    throw new Error('工作流缺少开始节点')
  }
  const endNode = nodeMap.get(END_NODE_ID)
  if (!endNode) {
    throw new Error('工作流缺少结束节点')
  }

  const eligibleIds = new Set(getWorkflowEligibleAssistants().map(item => item.id))
  workflow.nodes.forEach(node => {
    if (node.id === START_NODE_ID || node.id === END_NODE_ID) return
    const nodeKind = String(node.data?.kind || '').trim() || 'assistant'
    if (nodeKind === 'tool') {
      const toolType = String(node.data?.toolType || '').trim()
      if (!toolType) {
        throw new Error(`节点“${node.label || node.id}”未绑定工具类型`)
      }
      if (!getWorkflowToolByType(toolType)) {
        throw new Error(`节点“${node.label || node.id}”绑定了未注册的工具类型：${toolType}`)
      }
      return
    }
    const assistantId = String(node.data?.assistantId || '').trim()
    if (!assistantId) {
      throw new Error(`节点“${node.label || node.id}”未绑定助手`)
    }
    if (!eligibleIds.has(assistantId)) {
      throw new Error(`节点“${node.label || node.id}”绑定的助手不是全文处理助手，无法加入工作流`)
    }
  })

  workflow.edges.forEach(edge => {
    const condition = getEdgeCondition(edge)
    if (condition === 'always') return
    const sourceNode = nodeMap.get(edge.source)
    if (sourceNode?.data?.kind !== 'tool' || sourceNode?.data?.toolType !== 'condition-check') {
      throw new Error('仅“条件判断”节点允许使用命中/未命中分支连线')
    }
  })

  const visited = new Set()
  const visiting = new Set()

  function dfs(nodeId) {
    if (visiting.has(nodeId)) {
      throw new Error('工作流存在循环，请删除回路后再保存或启动')
    }
    if (visited.has(nodeId)) return
    visiting.add(nodeId)
    const edges = outgoing.get(nodeId) || []
    edges.forEach(edge => dfs(edge.target))
    visiting.delete(nodeId)
    visited.add(nodeId)
  }

  dfs(START_NODE_ID)

  workflow.nodes.forEach(node => {
    if (!visited.has(node.id)) {
      throw new Error(`节点“${node.label || node.id}”未连接到开始节点`)
    }
    if (node.id !== START_NODE_ID && (incoming.get(node.id) || []).length === 0) {
      throw new Error(`节点“${node.label || node.id}”缺少入边`)
    }
    if (node.id === END_NODE_ID && (incoming.get(node.id) || []).length === 0) {
      throw new Error('结束节点缺少入边')
    }
    if (node.id === END_NODE_ID && (outgoing.get(node.id) || []).length > 0) {
      throw new Error('结束节点不能再连出后续节点')
    }
  })

  return workflow
}

/**
 * 模拟分析工作流路径：枚举从开始到结束的所有可能执行路径，判断是否能走通
 * @param {object} workflowInput - 工作流定义
 * @returns {{ valid: boolean, validationError?: string, paths: Array, summary: object }}
 */
export function analyzeWorkflowPaths(workflowInput) {
  try {
    const workflow = validateWorkflow(workflowInput)
    const { nodeMap, incoming, outgoing } = buildWorkflowMaps(workflow)
    const END_NODE = END_NODE_ID
    const paths = []
    let pathId = 0

    function getNodeTitle(nodeId) {
      const node = nodeMap.get(nodeId)
      return String(node?.data?.title || node?.label || nodeId).trim()
    }

    function dfs(nodeId, visited, pathNodes, branchDecisions) {
      if (nodeId === END_NODE) {
        paths.push({
          id: `path_${pathId++}`,
          nodeIds: [...pathNodes],
          nodeTitles: pathNodes.map(getNodeTitle),
          reachesEnd: true,
          branchDecisions: [...branchDecisions]
        })
        return
      }
      const node = nodeMap.get(nodeId)
      const outEdges = outgoing.get(nodeId) || []
      if (outEdges.length === 0) {
        if (nodeId !== END_NODE) {
          paths.push({
            id: `path_${pathId++}`,
            nodeIds: [...pathNodes],
            nodeTitles: pathNodes.map(getNodeTitle),
            reachesEnd: false,
            branchDecisions: [...branchDecisions],
            deadEndAt: nodeId,
            deadEndReason: '无出边'
          })
        }
        return
      }

      const isConditionCheck = node?.data?.kind === 'tool' && node?.data?.toolType === 'condition-check'
      const edgesByCondition = new Map()
      outEdges.forEach(edge => {
        const cond = getEdgeCondition(edge)
        if (!edgesByCondition.has(cond)) edgesByCondition.set(cond, [])
        edgesByCondition.get(cond).push(edge)
      })

      if (isConditionCheck) {
        const trueEdges = edgesByCondition.get('true') || []
        const falseEdges = edgesByCondition.get('false') || []
        const alwaysEdges = edgesByCondition.get('always') || []
        const followEdges = []
        if (trueEdges.length) followEdges.push(...trueEdges.map(e => ({ edge: e, decision: '命中' })))
        if (falseEdges.length) followEdges.push(...falseEdges.map(e => ({ edge: e, decision: '未命中' })))
        if (alwaysEdges.length) followEdges.push(...alwaysEdges.map(e => ({ edge: e, decision: '默认' })))
        if (followEdges.length === 0) {
          paths.push({
            id: `path_${pathId++}`,
            nodeIds: [...pathNodes],
            nodeTitles: pathNodes.map(getNodeTitle),
            reachesEnd: false,
            branchDecisions: [...branchDecisions],
            deadEndAt: nodeId,
            deadEndReason: '条件判断节点无有效出边'
          })
          return
        }
        for (const { edge, decision } of followEdges) {
          const nextId = edge.target
          if (visited.has(nextId)) continue
          const nextVisited = new Set(visited)
          nextVisited.add(nextId)
          const nextPath = [...pathNodes, nextId]
          const nextDecisions = [...branchDecisions, { nodeId, nodeTitle: getNodeTitle(nodeId), condition: decision }]
          dfs(nextId, nextVisited, nextPath, nextDecisions)
        }
      } else {
        for (const edge of outEdges) {
          const nextId = edge.target
          if (visited.has(nextId)) continue
          const nextVisited = new Set(visited)
          nextVisited.add(nextId)
          const nextPath = [...pathNodes, nextId]
          dfs(nextId, nextVisited, nextPath, branchDecisions)
        }
      }
    }

    const startEdges = outgoing.get(START_NODE_ID) || []
    startEdges.forEach(edge => {
      const targetId = edge.target
      dfs(targetId, new Set([START_NODE_ID, targetId]), [targetId], [])
    })

    if (startEdges.length === 0) {
      paths.push({
        id: `path_${pathId++}`,
        nodeIds: [],
        nodeTitles: [],
        reachesEnd: false,
        branchDecisions: [],
        deadEndAt: START_NODE_ID,
        deadEndReason: '开始节点无出边'
      })
    }

    const pathsToEnd = paths.filter(p => p.reachesEnd).length
    const hasDeadEnd = paths.some(p => !p.reachesEnd)

    return {
      valid: true,
      paths,
      summary: {
        totalPaths: paths.length,
        pathsToEnd,
        allPathsReachEnd: paths.length > 0 && pathsToEnd === paths.length,
        hasDeadEnd
      }
    }
  } catch (error) {
    return {
      valid: false,
      validationError: error?.message || '验证失败',
      paths: [],
      summary: { totalPaths: 0, pathsToEnd: 0, allPathsReachEnd: false, hasDeadEnd: true }
    }
  }
}

function updateWorkflowTask(taskId, updater) {
  const task = getTaskById(taskId)
  if (!task) return
  const nextData = typeof updater === 'function'
    ? updater(deepClone(task.data || {}))
    : { ...(task.data || {}), ...(updater || {}) }
  updateTask(taskId, { data: nextData })
}

function patchNodeRun(taskId, nodeRunPatch) {
  updateWorkflowTask(taskId, (data) => {
    const nodeRuns = Array.isArray(data.nodeRuns) ? data.nodeRuns.slice() : []
    const index = nodeRuns.findIndex(item => item.nodeId === nodeRunPatch.nodeId)
    if (index >= 0) {
      nodeRuns[index] = {
        ...nodeRuns[index],
        ...nodeRunPatch
      }
    } else {
      nodeRuns.push(nodeRunPatch)
    }
    return {
      ...data,
      nodeRuns
    }
  })
}

function cancelWorkflowNodeRuns(taskId, reason = '工作流已停止') {
  updateWorkflowTask(taskId, (data) => {
    const now = new Date().toISOString()
    const nodeRuns = Array.isArray(data.nodeRuns) ? data.nodeRuns.map((item) => {
      const status = String(item?.status || '').trim()
      if (!['running', 'paused'].includes(status)) return item
      return {
        ...item,
        status: 'cancelled',
        endedAt: item.endedAt || now,
        outputSummary: item.outputSummary || reason,
        error: ''
      }
    }) : []
    return {
      ...data,
      nodeRuns
    }
  })
}

function stopWorkflowChildTasks(workflowTaskId, runState) {
  const childTaskIds = new Set([...(runState?.childTaskIds || [])].filter(Boolean))
  getTasks().forEach((task) => {
    if (task?.data?.parentWorkflowTaskId !== workflowTaskId) return
    if (!['pending', 'running'].includes(String(task?.status || ''))) return
    childTaskIds.add(task.id)
  })
  childTaskIds.forEach((childTaskId) => {
    if (stopAssistantTask(childTaskId)) return
    const task = getTaskById(childTaskId)
    if (!task) return
    updateTask(childTaskId, {
      status: 'cancelled',
      error: '任务已停止',
      progress: 100,
      data: {
        ...(task.data || {}),
        progressStage: 'cancelled'
      }
    })
  })
}

function getNodeRunSummary(childTask) {
  const outputPreview = String(childTask?.data?.outputPreview || childTask?.data?.fullOutput || '').trim()
  return outputPreview.length > 160 ? `${outputPreview.slice(0, 160)}...` : outputPreview
}

function getFinishedNodeCount(completedSet, skippedSet = new Set()) {
  const finished = new Set([
    ...[...completedSet].filter(nodeId => nodeId !== START_NODE_ID && nodeId !== END_NODE_ID),
    ...[...skippedSet].filter(nodeId => nodeId !== START_NODE_ID && nodeId !== END_NODE_ID)
  ])
  return finished.size
}

function getParentNodeIds(incoming, nodeId) {
  return (incoming.get(nodeId) || []).map(edge => edge.source).filter(sourceId => sourceId !== START_NODE_ID)
}

function buildParentOutputs(parentNodeIds, nodeOutputs, nodeMap) {
  return parentNodeIds
    .map(parentId => {
      const payload = nodeOutputs.get(parentId)
      if (!payload) return null
      const parentNode = nodeMap.get(parentId)
      return {
        nodeId: parentId,
        nodeTitle: String(parentNode?.data?.title || parentNode?.label || parentId).trim(),
        nodeKind: String(parentNode?.data?.kind || '').trim(),
        text: String(payload.text || '').trim(),
        value: payload.value
      }
    })
    .filter(Boolean)
}

function mergeParentOutputText(parentOutputs) {
  return parentOutputs
    .map(item => String(item.text || '').trim())
    .filter(Boolean)
    .join('\n\n')
}

function getEdgeCondition(edge) {
  return String(edge?.data?.condition || 'always').trim() || 'always'
}

function buildNodeResultsLookup(nodeOutputs, nodeMap) {
  const entries = {}
  nodeOutputs.forEach((payload, nodeId) => {
    const node = nodeMap.get(nodeId)
    entries[nodeId] = {
      nodeId,
      title: String(node?.data?.title || node?.label || nodeId).trim(),
      kind: String(node?.data?.kind || '').trim(),
      text: String(payload?.text || '').trim(),
      value: payload?.value
    }
  })
  return entries
}

function buildBranchDecision(edge, sourceOutput, nodeMap) {
  const condition = getEdgeCondition(edge)
  const matched = sourceOutput?.value?.matched
  const taken = shouldTakeEdge(edge, sourceOutput)
  const targetNode = nodeMap.get(edge.target)
  let reason = '默认连线'
  if (condition === 'true') {
    reason = matched === true ? '条件判断命中，进入该分支' : '条件判断未命中，跳过该分支'
  } else if (condition === 'false') {
    reason = matched === false ? '条件判断未命中，进入该分支' : '条件判断命中，跳过该分支'
  }
  return {
    edgeId: edge.id,
    targetNodeId: edge.target,
    targetNodeTitle: String(targetNode?.data?.title || targetNode?.label || edge.target).trim(),
    condition,
    taken,
    reason
  }
}

function safeParseJson(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch (_) {
    const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim())
      } catch (_) {
        return null
      }
    }
    return null
  }
}

function shouldTakeEdge(edge, sourceOutput) {
  const condition = getEdgeCondition(edge)
  if (condition === 'always') return true
  const matched = sourceOutput?.value?.matched
  if (condition === 'true') return matched === true
  if (condition === 'false') return matched === false
  return true
}

function getDebugValueType(value) {
  if (Array.isArray(value)) return 'array'
  if (value == null || value === '') return 'empty'
  if (typeof value === 'object') return 'object'
  return typeof value
}

function collectReachableNodeIds(startNodeId, outgoing) {
  const visited = new Set()
  function dfs(nodeId) {
    if (!nodeId || visited.has(nodeId)) return
    visited.add(nodeId)
    ;(outgoing.get(nodeId) || []).forEach(edge => dfs(edge.target))
  }
  dfs(startNodeId)
  return visited
}

function getWorkflowBreakpointNodeIds(workflow, fallbackNodeIds = []) {
  const fallbackSet = new Set((Array.isArray(fallbackNodeIds) ? fallbackNodeIds : []).filter(Boolean))
  return workflow.nodes
    .filter(node => node.id !== START_NODE_ID && node.id !== END_NODE_ID)
    .filter(node => fallbackSet.size > 0 ? fallbackSet.has(node.id) : node?.data?.breakpoint === true)
    .map(node => node.id)
}

function buildDebugParentOutputs(parentOutputs) {
  return (Array.isArray(parentOutputs) ? parentOutputs : []).map(item => ({
    nodeId: item.nodeId,
    nodeTitle: item.nodeTitle,
    nodeKind: item.nodeKind,
    text: String(item.text || '').trim(),
    value: item.value
  }))
}

function patchWorkflowDebugState(taskId, runState, patch = {}) {
  if (!runState?.debug?.enabled) return
  const task = getTaskById(taskId)
  if (!task) return
  const current = task?.data?.debugState && typeof task.data.debugState === 'object'
    ? task.data.debugState
    : {}
  updateTask(taskId, {
    data: {
      ...(task.data || {}),
      debugState: {
        ...current,
        enabled: true,
        paused: Boolean(runState.debug.isPaused),
        pauseNext: Boolean(runState.debug.pauseNext),
        breakpointNodeIds: [...runState.debug.breakpointNodeIds],
        ...patch
      }
    }
  })
}

function getDebugPauseReason(runState, nodeId) {
  if (!runState?.debug?.enabled) return ''
  if (runState.debug.breakpointNodeIds.has(nodeId)) return '命中断点'
  if (runState.debug.pauseNext) return runState.debug.pauseReason || '单步执行后暂停'
  return ''
}

async function pauseForDebug(runState, payload) {
  const {
    workflowTaskId,
    nodeId,
    title,
    nodeKind,
    assistantId,
    toolType,
    resolvedInput,
    parentOutputs,
    pauseReason
  } = payload
  if (!runState?.debug?.enabled || !pauseReason) return
  runState.debug.isPaused = true
  runState.debug.pauseNext = false
  const editedInput = runState.debug.inputOverride || null
  patchWorkflowDebugState(workflowTaskId, runState, {
    paused: true,
    waitingNodeId: nodeId,
    waitingNodeTitle: title,
    waitingNodeKind: nodeKind,
    waitingAssistantId: assistantId,
    waitingToolType: toolType,
    waitingReason: pauseReason,
    inputMode: resolvedInput.mode,
    inputSummary: resolvedInput.summary,
    inputPreview: resolvedInput.text,
    inputValue: resolvedInput.value,
    inputValueType: getDebugValueType(resolvedInput.value),
    parentOutputs: buildDebugParentOutputs(parentOutputs),
    editedInputPreview: editedInput?.text ?? resolvedInput.text,
    editedInputValue: editedInput?.value ?? resolvedInput.value,
    editedInputValueType: getDebugValueType(editedInput?.value ?? resolvedInput.value),
    inputEdited: Boolean(editedInput)
  })

  const command = await new Promise(resolve => {
    runState.debug.resumeResolver = resolve
  })
  runState.debug.resumeResolver = null
  runState.debug.isPaused = false
  if (command === 'cancel') {
    runState.cancelled = true
    throw createCancelError()
  }
  if (command === 'step') {
    runState.debug.pauseNext = true
    runState.debug.pauseReason = '单步执行后暂停'
  } else {
    runState.debug.pauseReason = ''
  }
  patchWorkflowDebugState(workflowTaskId, runState, {
    paused: false,
    waitingReason: '',
    lastCommand: command || 'continue'
  })
  return {
    command: command || 'continue',
    inputOverride: runState.debug.inputOverride || null
  }
}

export async function startWorkflowRun(workflowInput, options = {}) {
  const workflow = validateWorkflow(workflowInput)
  const { nodeMap, incoming, outgoing } = buildWorkflowMaps(workflow)
  const manualStartNodeId = String(options?.startNodeId || '').trim()
  const hasManualStart = Boolean(manualStartNodeId && manualStartNodeId !== START_NODE_ID && manualStartNodeId !== END_NODE_ID && nodeMap.has(manualStartNodeId))
  const manualStartScope = hasManualStart ? collectReachableNodeIds(manualStartNodeId, outgoing) : null
  const runnableNodes = workflow.nodes.filter(node => node.id !== START_NODE_ID && node.id !== END_NODE_ID)
    .filter(node => !manualStartScope || manualStartScope.has(node.id))
  const nodeOutputs = new Map()
  const now = new Date().toISOString()
  const debugEnabled = options?.debug === true
  const breakpointNodeIds = getWorkflowBreakpointNodeIds(workflow, options?.breakpointNodeIds)
  const manualStartInputText = String(options?.startInputText || '')
  const manualStartInputValue = options?.startInputValue !== undefined
    ? options.startInputValue
    : (safeParseJson(manualStartInputText) ?? manualStartInputText)
  const workflowTaskId = addTask({
    type: 'workflow',
    title: workflow.name || '未命名工作流',
    status: 'running',
    progress: 0,
    total: runnableNodes.length,
    current: 0,
    data: {
      kind: 'workflow',
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      workflowName: workflow.name,
      snapshot: workflow,
      nodeRuns: [],
      startedAt: now,
      progressStage: 'running',
      currentNodeId: '',
      currentNodeTitle: '',
      nodeOutputs: [],
      debugState: debugEnabled
        ? {
          enabled: true,
          paused: false,
          pauseNext: true,
          breakpointNodeIds,
          waitingNodeId: '',
          waitingNodeTitle: '',
          waitingNodeKind: '',
          waitingAssistantId: '',
          waitingToolType: '',
          waitingReason: '',
          inputMode: '',
          inputSummary: '',
          inputPreview: '',
          inputValue: null,
          inputValueType: 'empty',
          parentOutputs: [],
          lastOutputNodeId: '',
          lastOutputNodeTitle: '',
          lastOutputText: '',
          lastOutputValue: null,
          lastOutputValueType: 'empty',
          lastCommand: 'pause',
          editedInputPreview: '',
          editedInputValue: null,
          editedInputValueType: 'empty',
          inputEdited: false
        }
        : null
    }
  })

  const runState = {
    taskId: workflowTaskId,
    workflow,
    cancelled: false,
    currentChildTaskId: '',
    completed: new Set([START_NODE_ID]),
    skipped: new Set(),
    queued: new Set(),
    running: new Set(),
    childTaskIds: new Set(),
    failedNodeId: '',
    skippedEdges: new Set(),
    debug: {
      enabled: debugEnabled,
      breakpointNodeIds: new Set(breakpointNodeIds),
      pauseNext: debugEnabled,
      pauseReason: debugEnabled ? '调试启动，停在首个节点' : '',
      isPaused: false,
      resumeResolver: null,
      inputOverride: null
    }
  }
  activeWorkflowRuns.set(workflowTaskId, runState)

  if (manualStartScope) {
    workflow.edges.forEach(edge => {
      if (manualStartScope.has(edge.target) && !manualStartScope.has(edge.source)) {
        runState.skippedEdges.add(edge.id)
      }
    })
  }

  function patchWorkflowProgress(lastNodeId = '', lastNodeTitle = '') {
    const finishedCount = getFinishedNodeCount(runState.completed, runState.skipped)
    updateTask(workflowTaskId, {
      current: finishedCount,
      progress: runnableNodes.length > 0 ? Math.round((finishedCount / runnableNodes.length) * 100) : 100,
      data: {
        ...(getTaskById(workflowTaskId)?.data || {}),
        currentNodeId: '',
        currentNodeTitle: '',
        lastCompletedNodeId: lastNodeId,
        lastCompletedNodeTitle: lastNodeTitle,
        progressStage: finishedCount >= runnableNodes.length ? 'completed' : 'running',
        nodeOutputs: [...nodeOutputs.entries()].map(([outputNodeId, payload]) => ({
          nodeId: outputNodeId,
          text: String(payload?.text || '').trim()
        }))
      }
    })
    if (runState.debug.enabled) {
      patchWorkflowDebugState(workflowTaskId, runState, {
        waitingNodeId: '',
        waitingNodeTitle: '',
        waitingNodeKind: '',
        waitingAssistantId: '',
        waitingToolType: '',
        waitingReason: ''
      })
    }
  }

  function markNodeSkipped(nodeId, reason = '分支未命中') {
    if (!nodeId || nodeId === START_NODE_ID || nodeId === END_NODE_ID) return
    if (runState.completed.has(nodeId) || runState.skipped.has(nodeId) || runState.queued.has(nodeId) || runState.running.has(nodeId)) return
    runState.skipped.add(nodeId)
    patchNodeRun(workflowTaskId, {
      nodeId,
      nodeKind: nodeMap.get(nodeId)?.data?.kind || '',
      title: String(nodeMap.get(nodeId)?.data?.title || nodeMap.get(nodeId)?.label || nodeId).trim(),
      status: 'skipped',
      endedAt: new Date().toISOString(),
      outputSummary: reason,
      error: ''
    })
    ;(outgoing.get(nodeId) || []).forEach(edge => {
      runState.skippedEdges.add(edge.id)
      const targetIncoming = incoming.get(edge.target) || []
      const activeIncoming = targetIncoming.filter(item => !runState.skippedEdges.has(item.id))
      if (activeIncoming.length === 0) {
        markNodeSkipped(edge.target, '上游分支全部未命中')
      }
    })
    patchWorkflowProgress()
  }

  function resolveTargetAfterEdgeUpdate(targetNodeId) {
    if (!targetNodeId || runState.completed.has(targetNodeId) || runState.skipped.has(targetNodeId) || runState.queued.has(targetNodeId)) return
    if (targetNodeId === END_NODE_ID) {
      const activeIncoming = (incoming.get(targetNodeId) || []).filter(item => !runState.skippedEdges.has(item.id))
      if (activeIncoming.length === 0) return
    }
    const targetIncoming = incoming.get(targetNodeId) || []
    const activeIncoming = targetIncoming.filter(item => !runState.skippedEdges.has(item.id))
    if (activeIncoming.length === 0) {
      markNodeSkipped(targetNodeId, '没有可执行的入边')
      return
    }
    const ready = activeIncoming.every(item => runState.completed.has(item.source))
    if (ready && !runState.running.has(targetNodeId)) {
      queue.push(targetNodeId)
      runState.queued.add(targetNodeId)
    }
  }

  const queue = []
  if (hasManualStart) {
    queue.push(manualStartNodeId)
    runState.queued.add(manualStartNodeId)
  } else {
    ;(outgoing.get(START_NODE_ID) || []).forEach(edge => {
      queue.push(edge.target)
      runState.queued.add(edge.target)
    })
  }

  try {
    while (queue.length > 0) {
      if (runState.cancelled) throw createCancelError()
      const nodeId = queue.shift()
      runState.queued.delete(nodeId)
      if (runState.completed.has(nodeId)) continue
      const node = nodeMap.get(nodeId)
      if (!node) continue
      if (nodeId === END_NODE_ID) {
        runState.completed.add(nodeId)
        continue
      }
      const nodeKind = String(node.data?.kind || '').trim() || 'assistant'
      const assistantId = String(node.data?.assistantId || '').trim()
      const toolType = String(node.data?.toolType || '').trim()
      const title = String(node.data?.title || node.label || assistantId || toolType).trim() || assistantId || toolType
      const parentNodeIds = getParentNodeIds(incoming, nodeId)
      const parentOutputs = buildParentOutputs(parentNodeIds, nodeOutputs, nodeMap)
      const mergedInputText = mergeParentOutputText(parentOutputs)
      let resolvedInput = resolveWorkflowNodeInput(node, {
        workflow,
        node,
        parentOutputs,
        defaultInputText: mergedInputText,
        nodeResults: buildNodeResultsLookup(nodeOutputs, nodeMap)
      })
      if (hasManualStart && nodeId === manualStartNodeId) {
        resolvedInput = {
          mode: 'manual',
          text: manualStartInputText,
          value: manualStartInputValue,
          sourceNodeId: '',
          sourceNodeTitle: '',
          valuePath: '',
          template: '',
          summary: '从该节点开始调试（手动输入）'
        }
      }
      const pauseReason = getDebugPauseReason(runState, nodeId)

      patchNodeRun(workflowTaskId, {
        nodeId,
        assistantId,
        toolType,
        nodeKind,
        title,
        parentNodeIds,
        inputMode: resolvedInput.mode,
        inputSourceNodeId: resolvedInput.sourceNodeId,
        inputSourceNodeTitle: resolvedInput.sourceNodeTitle,
        inputValuePath: resolvedInput.valuePath,
        inputTemplate: resolvedInput.template,
        inputSummary: resolvedInput.summary,
        inputPreview: resolvedInput.text,
        status: pauseReason ? 'paused' : 'running',
        startedAt: pauseReason ? '' : new Date().toISOString(),
        pauseReason
      })

      updateTask(workflowTaskId, {
        current: getFinishedNodeCount(runState.completed, runState.skipped),
        progress: runnableNodes.length > 0
          ? Math.round((getFinishedNodeCount(runState.completed, runState.skipped) / runnableNodes.length) * 100)
          : 0,
        data: {
          ...(getTaskById(workflowTaskId)?.data || {}),
          currentNodeId: nodeId,
          currentNodeTitle: title,
          progressStage: pauseReason ? 'paused' : 'running'
        }
      })

      if (pauseReason) {
        const debugResult = await pauseForDebug(runState, {
          workflowTaskId,
          nodeId,
          title,
          nodeKind,
          assistantId,
          toolType,
          resolvedInput,
          parentOutputs,
          pauseReason
        })
        const debugCommand = debugResult?.command || 'continue'
        if (debugResult?.inputOverride) {
          resolvedInput = {
            ...resolvedInput,
            text: debugResult.inputOverride.text,
            value: debugResult.inputOverride.value,
            summary: `${resolvedInput.summary || '当前输入'}（已手动编辑）`
          }
        }
        runState.debug.inputOverride = null
        if (debugCommand === 'skip') {
          patchNodeRun(workflowTaskId, {
            nodeId,
            status: 'skipped',
            endedAt: new Date().toISOString(),
            outputSummary: '调试时手动跳过',
            pauseReason: '',
            error: ''
          })
          markNodeSkipped(nodeId, '调试时手动跳过当前节点')
          continue
        }
        patchNodeRun(workflowTaskId, {
          nodeId,
          status: 'running',
          startedAt: new Date().toISOString(),
          pauseReason: '',
          inputSummary: resolvedInput.summary,
          inputPreview: resolvedInput.text
        })
        updateTask(workflowTaskId, {
          data: {
            ...(getTaskById(workflowTaskId)?.data || {}),
            currentNodeId: nodeId,
            currentNodeTitle: title,
            progressStage: 'running'
          }
        })
      }

      runState.running.add(nodeId)
      if (nodeKind === 'tool') {
        try {
          const toolResult = await executeWorkflowTool(node, {
            workflow,
            node,
            parentNodeIds,
            parentOutputs,
            inputText: resolvedInput.text,
            inputValue: resolvedInput.value,
            nodeResults: buildNodeResultsLookup(nodeOutputs, nodeMap)
          })
          const outputText = getWorkflowToolOutputText(toolResult)
          nodeOutputs.set(nodeId, {
            text: outputText,
            value: toolResult?.output
          })
          patchNodeRun(workflowTaskId, {
            nodeId,
            status: 'completed',
            endedAt: new Date().toISOString(),
            outputSummary: toolResult?.preview || (outputText.length > 160 ? `${outputText.slice(0, 160)}...` : outputText),
            outputText,
            outputValue: toolResult?.output,
            error: ''
          })
          patchWorkflowDebugState(workflowTaskId, runState, {
            lastOutputNodeId: nodeId,
            lastOutputNodeTitle: title,
            lastOutputText: outputText,
            lastOutputValue: toolResult?.output,
            lastOutputValueType: getDebugValueType(toolResult?.output)
          })
        } finally {
          runState.running.delete(nodeId)
        }
      } else {
        const { promise } = startAssistantTask(assistantId, {
          ...deepClone(node.data?.configOverrides || {}),
          taskTitle: title,
          inputSource: 'document',
          ...(resolvedInput.text ? { inputText: resolvedInput.text } : {}),
          taskData: {
            parentWorkflowTaskId: workflowTaskId,
            workflowTaskId,
            workflowId: workflow.id,
            workflowName: workflow.name,
            workflowNodeId: nodeId,
            workflowNodeTitle: title,
            workflowParentNodeIds: parentNodeIds,
            workflowInputMode: resolvedInput.mode,
            workflowInputSummary: resolvedInput.summary,
            workflowInputPreview: resolvedInput.text
          },
          onTaskCreated: (childTaskId) => {
            runState.currentChildTaskId = childTaskId
            runState.childTaskIds.add(childTaskId)
            patchNodeRun(workflowTaskId, {
              nodeId,
              childTaskId,
              progress: 10,
              progressStage: 'preparing'
            })
          }
        })

        let result = null
        try {
          result = await promise
        } finally {
          runState.currentChildTaskId = ''
          runState.running.delete(nodeId)
        }

        const childTask = result?.taskId ? getTaskById(result.taskId) : null
        const outputText = String(childTask?.data?.fullOutput || childTask?.data?.outputPreview || '').trim()
        const outputFormat = String(childTask?.data?.outputFormat || '').trim().toLowerCase()
        const parsedOutput = outputFormat === 'json' ? safeParseJson(outputText) : null
        nodeOutputs.set(nodeId, {
          text: outputText,
          value: parsedOutput ?? outputText
        })
        patchNodeRun(workflowTaskId, {
          nodeId,
          childTaskId: result?.taskId || '',
          status: childTask?.status || 'completed',
          endedAt: new Date().toISOString(),
          progress: Number(childTask?.progress ?? 100),
          progressStage: String(childTask?.data?.progressStage || childTask?.status || 'completed'),
          outputSummary: getNodeRunSummary(childTask),
          outputText,
          outputValue: parsedOutput ?? outputText,
          error: childTask?.error || ''
        })
        patchWorkflowDebugState(workflowTaskId, runState, {
          lastOutputNodeId: nodeId,
          lastOutputNodeTitle: title,
          lastOutputText: outputText,
          lastOutputValue: parsedOutput ?? outputText,
          lastOutputValueType: getDebugValueType(parsedOutput ?? outputText)
        })
      }

      runState.completed.add(nodeId)
      const branchDecisions = []
      ;(outgoing.get(nodeId) || []).forEach(edge => {
        const sourceOutput = nodeOutputs.get(nodeId)
        branchDecisions.push(buildBranchDecision(edge, sourceOutput, nodeMap))
        if (!shouldTakeEdge(edge, sourceOutput)) {
          runState.skippedEdges.add(edge.id)
          resolveTargetAfterEdgeUpdate(edge.target)
          return
        }
        resolveTargetAfterEdgeUpdate(edge.target)
      })
      patchNodeRun(workflowTaskId, {
        nodeId,
        branchDecisions
      })
      patchWorkflowProgress(nodeId, title)
    }

    updateTask(workflowTaskId, {
      status: 'completed',
      progress: 100,
      current: runnableNodes.length,
      data: {
        ...(getTaskById(workflowTaskId)?.data || {}),
        finishedAt: new Date().toISOString(),
        progressStage: 'completed',
        currentNodeId: '',
        currentNodeTitle: ''
      }
    })
    return workflowTaskId
  } catch (error) {
    const status = isCancelledError(error) || runState.cancelled ? 'cancelled' : 'failed'
    updateTask(workflowTaskId, {
      status,
      progress: 100,
      error: status === 'cancelled' ? '工作流已停止' : (error?.message || String(error)),
      data: {
        ...(getTaskById(workflowTaskId)?.data || {}),
        finishedAt: new Date().toISOString(),
        progressStage: status,
        currentNodeId: '',
        currentNodeTitle: ''
      }
    })
    throw error
  } finally {
    activeWorkflowRuns.delete(workflowTaskId)
  }
}

export function resumeWorkflowDebug(taskId, mode = 'continue') {
  const runState = activeWorkflowRuns.get(taskId)
  if (!runState?.debug?.enabled || typeof runState.debug.resumeResolver !== 'function') return false
  const command = mode === 'step' ? 'step' : mode === 'skip' ? 'skip' : 'continue'
  runState.debug.resumeResolver(command)
  return true
}

export function setWorkflowDebugInputOverride(taskId, inputText = '') {
  const runState = activeWorkflowRuns.get(taskId)
  if (!runState?.debug?.enabled) return false
  const task = getTaskById(taskId)
  if (!task) return false
  const text = String(inputText || '')
  const parsed = safeParseJson(text)
  runState.debug.inputOverride = {
    text,
    value: parsed ?? text
  }
  patchWorkflowDebugState(taskId, runState, {
    editedInputPreview: text,
    editedInputValue: parsed ?? text,
    editedInputValueType: getDebugValueType(parsed ?? text),
    inputEdited: true
  })
  return true
}

export function setWorkflowRunBreakpoints(taskId, nodeIds = []) {
  const runState = activeWorkflowRuns.get(taskId)
  if (!runState?.debug?.enabled) return false
  runState.debug.breakpointNodeIds = new Set((Array.isArray(nodeIds) ? nodeIds : []).filter(Boolean))
  patchWorkflowDebugState(taskId, runState, {})
  return true
}

export function stopWorkflowRun(taskId) {
  const runState = activeWorkflowRuns.get(taskId)
  if (!runState) return false
  runState.cancelled = true
  stopWorkflowChildTasks(taskId, runState)
  cancelWorkflowNodeRuns(taskId)
  if (typeof runState.debug?.resumeResolver === 'function') {
    runState.debug.resumeResolver('cancel')
  } else {
    updateTask(taskId, {
      status: 'cancelled',
      progress: 100,
      error: '工作流已停止',
      data: {
        ...(getTaskById(taskId)?.data || {}),
        finishedAt: new Date().toISOString(),
        currentNodeId: '',
        currentNodeTitle: '',
        progressStage: 'cancelled'
      }
    })
  }
  return true
}
