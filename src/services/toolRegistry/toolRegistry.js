const registry = new Map()

export function registerTool(definition = {}) {
  const key = String(definition.key || '').trim()
  if (!key) throw new Error('Tool key is required')
  const normalized = {
    key,
    title: String(definition.title || key).trim(),
    description: String(definition.description || '').trim(),
    riskLevel: ['low', 'medium', 'high'].includes(definition.riskLevel) ? definition.riskLevel : 'low',
    requiresConfirmation: definition.requiresConfirmation === true,
    inputSchema: definition.inputSchema || { type: 'object', properties: {} },
    outputSchema: definition.outputSchema || { type: 'object', properties: {} },
    handler: typeof definition.handler === 'function' ? definition.handler : null
  }
  registry.set(key, normalized)
  return normalized
}

export function getTool(key) {
  return registry.get(String(key || '').trim()) || null
}

export function listTools() {
  return Array.from(registry.values())
}

export function clearTools() {
  registry.clear()
}

export async function executeTool(key, input = {}, context = {}) {
  const tool = getTool(key)
  if (!tool) throw new Error(`工具不存在：${key}`)
  if (tool.requiresConfirmation && context.confirmed !== true) {
    const error = new Error(`工具需要确认：${key}`)
    error.code = 'TOOL_CONFIRM_REQUIRED'
    error.tool = tool
    throw error
  }
  if (!tool.handler) throw new Error(`工具未实现：${key}`)
  return tool.handler(input, context)
}

export default {
  registerTool,
  getTool,
  listTools,
  clearTools,
  executeTool
}
