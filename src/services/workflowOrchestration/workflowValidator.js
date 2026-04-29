function normalizeNodes(workflow = {}) {
  return Array.isArray(workflow.nodes) ? workflow.nodes : []
}

function normalizeEdges(workflow = {}) {
  return Array.isArray(workflow.edges) ? workflow.edges : []
}

function getNodeType(node = {}) {
  return String(node?.type || node?.data?.type || '').trim()
}

function getToolKey(node = {}) {
  return String(node?.toolKey || node?.data?.toolKey || node?.config?.toolKey || node?.payload?.toolKey || '').trim()
}

function detectCycles(nodes = [], edges = []) {
  const graph = new Map(nodes.map(node => [String(node?.id || '').trim(), []]))
  edges.forEach(edge => {
    const source = String(edge?.source || '').trim()
    const target = String(edge?.target || '').trim()
    if (graph.has(source) && graph.has(target)) graph.get(source).push(target)
  })
  const visiting = new Set()
  const visited = new Set()
  const cycles = []

  function visit(id, stack = []) {
    if (visiting.has(id)) {
      cycles.push([...stack.slice(stack.indexOf(id)), id])
      return
    }
    if (visited.has(id)) return
    visiting.add(id)
    for (const next of graph.get(id) || []) {
      visit(next, [...stack, id])
    }
    visiting.delete(id)
    visited.add(id)
  }

  for (const id of graph.keys()) visit(id)
  return cycles
}

export function validateWorkflowDefinition(workflow = {}, options = {}) {
  const nodes = normalizeNodes(workflow)
  const edges = normalizeEdges(workflow)
  const issues = []
  const nodeIds = new Set()
  const registeredTools = Array.isArray(options.registeredTools)
    ? new Set(options.registeredTools)
    : null

  nodes.forEach((node, index) => {
    const id = String(node?.id || '').trim()
    if (!id) {
      issues.push({ code: 'missing-node-id', message: `第 ${index + 1} 个节点缺少 id`, index })
      return
    }
    if (nodeIds.has(id)) {
      issues.push({ code: 'duplicate-node-id', message: `节点 id 重复：${id}`, nodeId: id })
    }
    nodeIds.add(id)
    if (!String(node?.type || node?.data?.type || '').trim()) {
      issues.push({ code: 'missing-node-type', message: `节点缺少类型：${id}`, nodeId: id })
    }
    const nodeType = getNodeType(node)
    const toolKey = getToolKey(node)
    if (/tool/i.test(nodeType)) {
      if (!toolKey) {
        issues.push({ code: 'missing-tool-key', message: `工具节点缺少 toolKey：${id}`, nodeId: id })
      } else if (registeredTools && !registeredTools.has(toolKey)) {
        issues.push({ code: 'unknown-tool-key', message: `工具未注册：${toolKey}`, nodeId: id, toolKey })
      }
    }
  })

  edges.forEach((edge, index) => {
    const source = String(edge?.source || '').trim()
    const target = String(edge?.target || '').trim()
    if (!source || !target) {
      issues.push({ code: 'missing-edge-endpoint', message: `第 ${index + 1} 条边缺少起点或终点`, index })
      return
    }
    if (!nodeIds.has(source)) {
      issues.push({ code: 'unknown-edge-source', message: `边引用了不存在的起点：${source}`, edgeIndex: index })
    }
    if (!nodeIds.has(target)) {
      issues.push({ code: 'unknown-edge-target', message: `边引用了不存在的终点：${target}`, edgeIndex: index })
    }
    if (source === target) {
      issues.push({ code: 'self-loop', message: `节点不能连接自身：${source}`, edgeIndex: index })
    }
  })

  const incoming = new Map(nodes.map(node => [String(node?.id || '').trim(), 0]))
  edges.forEach(edge => {
    const target = String(edge?.target || '').trim()
    if (incoming.has(target)) incoming.set(target, incoming.get(target) + 1)
  })
  const startNodes = Array.from(incoming.entries()).filter(([, count]) => count === 0).map(([id]) => id)
  if (nodes.length > 0 && startNodes.length === 0) {
    issues.push({ code: 'missing-start-node', message: '工作流缺少入口节点，可能存在循环' })
  }
  const cycles = detectCycles(nodes, edges)
  cycles.forEach(cycle => {
    issues.push({ code: 'cycle-detected', message: `工作流存在循环：${cycle.join(' -> ')}`, cycle })
  })

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      startNodeIds: startNodes,
      cycleCount: cycles.length
    }
  }
}

export default {
  detectCycles,
  validateWorkflowDefinition
}
