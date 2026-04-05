import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
import {
  getBuiltinAssistants,
  getBuiltinAssistantDefinition,
  getAssistantGroupLabel
} from './assistantRegistry.js'
import {
  getAssistantSetting,
  getCustomAssistants,
  getAssistantDisplayEntry
} from './assistantSettings.js'
import { getWorkflowToolByType, normalizeWorkflowInputBinding, normalizeWorkflowToolData } from './workflowTools.js'

const WORKFLOW_STORAGE_KEY = 'workflowDefinitions'
const WORKFLOW_STORAGE_VERSION = 1
const START_NODE_ID = 'workflow_start'
const END_NODE_ID = 'workflow_end'

let listeners = new Set()

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createNodeId(prefix = 'node') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function createEdgeId() {
  return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizePosition(value, fallbackX = 0, fallbackY = 0) {
  const x = Number(value?.x)
  const y = Number(value?.y)
  return {
    x: Number.isFinite(x) ? x : fallbackX,
    y: Number.isFinite(y) ? y : fallbackY
  }
}

function normalizeNodeSize(value) {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? Math.round(num) : null
}

export function createStartNode() {
  return {
    id: START_NODE_ID,
    type: 'input',
    label: '开始',
    position: { x: 80, y: 220 },
    sourcePosition: 'right',
    selectable: true,
    draggable: true,
    deletable: false,
    data: {
      kind: 'start',
      title: '开始'
    }
  }
}

export function createEndNode() {
  return {
    id: END_NODE_ID,
    type: 'output',
    label: '结束',
    position: { x: 860, y: 220 },
    targetPosition: 'left',
    selectable: true,
    draggable: true,
    deletable: false,
    data: {
      kind: 'end',
      title: '结束'
    }
  }
}

function normalizeNode(node, index = 0) {
  if (!node || typeof node !== 'object') return null
  const id = String(node.id || '').trim() || createNodeId(node.type === 'start' ? 'start' : node.type === 'end' ? 'end' : 'node')
  const isStart = id === START_NODE_ID || node.type === 'start' || node.data?.kind === 'start'
  const isEnd = id === END_NODE_ID || node.type === 'end' || node.data?.kind === 'end'
  if (isStart) {
    return {
      ...createStartNode(),
      id: START_NODE_ID,
      position: normalizePosition(node.position, 80, 220),
      width: normalizeNodeSize(node.width ?? node.dimensions?.width),
      height: normalizeNodeSize(node.height ?? node.dimensions?.height)
    }
  }
  if (isEnd) {
    return {
      ...createEndNode(),
      id: END_NODE_ID,
      position: normalizePosition(node.position, 860, 220),
      width: normalizeNodeSize(node.width ?? node.dimensions?.width),
      height: normalizeNodeSize(node.height ?? node.dimensions?.height)
    }
  }

  const nodeKind = String(node.data?.kind || node.kind || '').trim()
  if (nodeKind === 'tool') {
    const toolType = String(node.data?.toolType || node.toolType || '').trim()
    const toolMeta = getWorkflowToolByType(toolType)
    const toolData = normalizeWorkflowToolData({
      ...(node.data || {}),
      toolType
    })
    const title = String(node.data?.title || node.label || node.title || toolMeta?.title || '未命名工具').trim() || '未命名工具'
    return {
      id,
      type: 'default',
      label: title,
      position: normalizePosition(node.position, 280 + (index % 3) * 220, 120 + Math.floor(index / 3) * 140),
      width: normalizeNodeSize(node.width ?? node.dimensions?.width),
      height: normalizeNodeSize(node.height ?? node.dimensions?.height),
      sourcePosition: node.sourcePosition || 'right',
      targetPosition: node.targetPosition || 'left',
      draggable: node.draggable !== false,
      selectable: node.selectable !== false,
      deletable: node.deletable !== false,
      data: {
        ...toolData,
        title,
        inputBinding: normalizeWorkflowInputBinding(node.data?.inputBinding),
        breakpoint: node.data?.breakpoint === true
      }
    }
  }

  const assistantId = String(node.data?.assistantId || node.assistantId || '').trim()
  const title = String(node.data?.title || node.label || node.title || '未命名助手').trim() || '未命名助手'
  return {
    id,
    type: 'default',
    label: title,
    position: normalizePosition(node.position, 280 + (index % 3) * 220, 120 + Math.floor(index / 3) * 140),
    width: normalizeNodeSize(node.width ?? node.dimensions?.width),
    height: normalizeNodeSize(node.height ?? node.dimensions?.height),
    sourcePosition: node.sourcePosition || 'right',
    targetPosition: node.targetPosition || 'left',
    draggable: node.draggable !== false,
    selectable: node.selectable !== false,
    deletable: node.deletable !== false,
    data: {
      kind: 'assistant',
      assistantId,
      title,
      inputBinding: normalizeWorkflowInputBinding(node.data?.inputBinding),
        breakpoint: node.data?.breakpoint === true,
      configOverrides: node.data?.configOverrides && typeof node.data.configOverrides === 'object'
        ? deepClone(node.data.configOverrides)
        : {}
    }
  }
}

function normalizeEdge(edge, index = 0) {
  if (!edge || typeof edge !== 'object') return null
  const source = String(edge.source || '').trim()
  const target = String(edge.target || '').trim()
  if (!source || !target || source === target) return null
  const order = Number(edge.data?.order ?? edge.order ?? index)
  const condition = String(edge.data?.condition ?? edge.condition ?? 'always').trim() || 'always'
  return {
    id: String(edge.id || '').trim() || createEdgeId(),
    source,
    target,
    type: edge.type || 'smoothstep',
    animated: edge.animated === true,
    markerEnd: edge.markerEnd || 'arrowclosed',
    label: String(edge.label || '').trim(),
    data: {
      order: Number.isFinite(order) ? order : index,
      condition
    }
  }
}

export function normalizeWorkflow(workflow, fallbackName = '未命名工作流') {
  const rawNodes = ensureArray(workflow?.nodes).map((item, index) => normalizeNode(item, index)).filter(Boolean)
  const nodes = rawNodes.map(item => {
    if (item.id === START_NODE_ID) {
      return {
        ...createStartNode(),
        position: normalizePosition(item.position, 80, 220),
        width: normalizeNodeSize(item.width ?? item.dimensions?.width),
        height: normalizeNodeSize(item.height ?? item.dimensions?.height)
      }
    }
    if (item.id === END_NODE_ID) {
      return {
        ...createEndNode(),
        position: normalizePosition(item.position, 860, 220),
        width: normalizeNodeSize(item.width ?? item.dimensions?.width),
        height: normalizeNodeSize(item.height ?? item.dimensions?.height)
      }
    }
    return item
  })

  const validNodeIds = new Set(nodes.map(item => item.id))
  const groupedOrders = new Map()
  const edges = ensureArray(workflow?.edges)
    .map((item, index) => normalizeEdge(item, index))
    .filter(Boolean)
    .filter(item => validNodeIds.has(item.source) && validNodeIds.has(item.target))
    .map(item => {
      const key = item.source
      const list = groupedOrders.get(key) || []
      list.push(item)
      groupedOrders.set(key, list)
      return item
    })

  groupedOrders.forEach((list) => {
    list
      .sort((a, b) => Number(a.data?.order ?? 0) - Number(b.data?.order ?? 0))
      .forEach((edge, index) => {
        edge.data = { ...(edge.data || {}), order: index }
      })
  })

  return {
    id: String(workflow?.id || '').trim() || `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: String(workflow?.name || fallbackName).trim() || fallbackName,
    description: String(workflow?.description || '').trim(),
    version: Number.isFinite(Number(workflow?.version)) ? Number(workflow.version) : WORKFLOW_STORAGE_VERSION,
    nodes,
    edges,
    viewport: workflow?.viewport && typeof workflow.viewport === 'object' ? deepClone(workflow.viewport) : { x: 0, y: 0, zoom: 1 },
    createdAt: workflow?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

function notify(workflows) {
  const cloned = workflows.map(item => deepClone(item))
  listeners.forEach(listener => {
    try {
      listener(cloned)
    } catch (error) {
      console.warn('workflowStore listener error:', error)
    }
  })
}

export function getWorkflows() {
  const settings = loadGlobalSettings()
  const stored = ensureArray(settings?.[WORKFLOW_STORAGE_KEY])
  const normalized = stored.map(item => normalizeWorkflow(item)).sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')) * -1)
  if (normalized.length === 0) {
    const initial = createWorkflowDraft('新建工作流')
    saveWorkflows([initial])
    return [initial]
  }
  return normalized
}

export function saveWorkflows(list) {
  const normalized = ensureArray(list).map((item, index) => normalizeWorkflow(item, `未命名工作流 ${index + 1}`))
  const ok = saveGlobalSettings({
    [WORKFLOW_STORAGE_KEY]: normalized
  })
  if (ok) notify(normalized)
  return ok
}

export function subscribeWorkflows(listener) {
  listeners.add(listener)
  listener(getWorkflows())
  return () => listeners.delete(listener)
}

export function getWorkflowById(id) {
  return getWorkflows().find(item => item.id === id) || null
}

export function saveWorkflow(workflow) {
  const list = getWorkflows()
  const normalized = normalizeWorkflow(workflow)
  const index = list.findIndex(item => item.id === normalized.id)
  if (index >= 0) {
    normalized.createdAt = list[index].createdAt || normalized.createdAt
    list.splice(index, 1, normalized)
  } else {
    list.unshift(normalized)
  }
  saveWorkflows(list)
  return normalized
}

export function deleteWorkflow(id) {
  const next = getWorkflows().filter(item => item.id !== id)
  if (next.length === 0) {
    next.push(createWorkflowDraft('新建工作流'))
  }
  return saveWorkflows(next)
}

export function createWorkflowDraft(name = '新建工作流', description = '') {
  return normalizeWorkflow({
    id: `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    description,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  }, name)
}

function isReportDrivenDocumentAssistant(config) {
  return Boolean(config?.reportSettings?.enabled)
}

function isDocumentAssistantConfig(config) {
  return String(config?.inputSource || '').trim() === 'document' || isReportDrivenDocumentAssistant(config)
}

export function getWorkflowEligibleAssistants() {
  const builtin = getBuiltinAssistants()
    .map(item => {
      const config = getAssistantSetting(item.id)
      if (!config || config.enabled === false || !isDocumentAssistantConfig(config)) return null
      const entry = getAssistantDisplayEntry(item.id)
      const definition = getBuiltinAssistantDefinition(item.id)
      if (!definition) return null
      return {
        id: item.id,
        title: entry?.title || config.title || definition.shortLabel || definition.label || item.id,
        shortLabel: definition.shortLabel || definition.label || item.id,
        icon: entry?.icon || definition.icon || '🧠',
        source: 'builtin',
        group: definition.group || 'core',
        groupLabel: getAssistantGroupLabel(definition.group || 'core'),
        description: config.description || definition.description || '',
        assistantType: definition.modelType || 'chat',
        config: deepClone(config),
        definition: deepClone(definition)
      }
    })
    .filter(Boolean)

  const custom = getCustomAssistants()
    .filter(item => isDocumentAssistantConfig(item))
    .map(item => ({
      id: item.id,
      title: item.name || '未命名助手',
      shortLabel: item.name || '未命名助手',
      icon: item.icon || '🧠',
      source: 'custom',
      group: 'custom',
      groupLabel: '自定义智能助手',
      description: item.description || '',
      assistantType: item.modelType || 'chat',
      config: deepClone(item),
      definition: {
        id: item.id,
        shortLabel: item.name || '未命名助手',
        label: item.name || '未命名助手'
      }
    }))

  return [...builtin, ...custom].sort((a, b) => {
    const groupDiff = String(a.groupLabel || '').localeCompare(String(b.groupLabel || ''))
    if (groupDiff !== 0) return groupDiff
    return String(a.title || '').localeCompare(String(b.title || ''))
  })
}

export function rebuildEdgeOrder(edges, sourceId) {
  const nextEdges = ensureArray(edges).map(item => normalizeEdge(item)).filter(Boolean)
  const targetSource = String(sourceId || '').trim()
  const group = nextEdges
    .filter(item => item.source === targetSource)
    .sort((a, b) => Number(a.data?.order ?? 0) - Number(b.data?.order ?? 0))
  group.forEach((edge, index) => {
    edge.data = { ...(edge.data || {}), order: index }
  })
  return nextEdges
}

export { START_NODE_ID, END_NODE_ID }
