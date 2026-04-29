const auditRecords = []

export function createToolAuditRecord(input = {}) {
  return {
    id: String(input.id || `tool_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    toolKey: String(input.toolKey || '').trim(),
    riskLevel: String(input.riskLevel || '').trim(),
    confirmed: input.confirmed === true,
    allowed: input.allowed === true,
    ok: input.ok === true,
    reason: String(input.reason || '').trim(),
    error: String(input.error || '').trim(),
    createdAt: input.createdAt || new Date().toISOString(),
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {}
  }
}

export function appendToolAuditRecord(record = {}) {
  const normalized = createToolAuditRecord(record)
  auditRecords.push(normalized)
  while (auditRecords.length > 200) auditRecords.shift()
  return normalized
}

export function listToolAuditRecords(options = {}) {
  const toolKey = String(options.toolKey || '').trim()
  const records = toolKey ? auditRecords.filter(item => item.toolKey === toolKey) : auditRecords
  return records.slice(-Number(options.limit || records.length || 1))
}

export function clearToolAuditRecords() {
  auditRecords.length = 0
}

export default {
  createToolAuditRecord,
  appendToolAuditRecord,
  listToolAuditRecords,
  clearToolAuditRecords
}
