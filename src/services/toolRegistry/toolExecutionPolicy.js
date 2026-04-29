import { executeTool, getTool } from './toolRegistry.js'
import { appendToolAuditRecord } from './toolAudit.js'

export function assessToolExecution(key, context = {}) {
  const tool = getTool(key)
  if (!tool) {
    return {
      allowed: false,
      requiresConfirmation: false,
      reason: `工具不存在：${key}`,
      tool: null
    }
  }
  const requiresConfirmation = tool.requiresConfirmation === true || tool.riskLevel === 'high'
  if (requiresConfirmation && context.confirmed !== true) {
    return {
      allowed: false,
      requiresConfirmation: true,
      reason: `高风险工具需要用户确认：${tool.title || tool.key}`,
      tool
    }
  }
  return {
    allowed: true,
    requiresConfirmation,
    reason: '',
    tool
  }
}

export async function executeToolWithPolicy(key, input = {}, context = {}) {
  const decision = assessToolExecution(key, context)
  if (!decision.allowed) {
    if (context.audit !== false) {
      appendToolAuditRecord({
        toolKey: key,
        riskLevel: decision.tool?.riskLevel || '',
        confirmed: context.confirmed === true,
        allowed: false,
        ok: false,
        reason: decision.reason,
        metadata: context.auditMetadata
      })
    }
    const error = new Error(decision.reason)
    error.code = decision.requiresConfirmation ? 'TOOL_CONFIRM_REQUIRED' : 'TOOL_BLOCKED'
    error.decision = decision
    throw error
  }
  try {
    const result = await executeTool(key, input, context)
    if (context.audit !== false) {
      appendToolAuditRecord({
        toolKey: key,
        riskLevel: decision.tool?.riskLevel || '',
        confirmed: context.confirmed === true,
        allowed: true,
        ok: true,
        metadata: context.auditMetadata
      })
    }
    return result
  } catch (error) {
    if (context.audit !== false) {
      appendToolAuditRecord({
        toolKey: key,
        riskLevel: decision.tool?.riskLevel || '',
        confirmed: context.confirmed === true,
        allowed: true,
        ok: false,
        error: String(error?.message || error || '工具执行失败'),
        metadata: context.auditMetadata
      })
    }
    throw error
  }
}

export default {
  assessToolExecution,
  executeToolWithPolicy
}
