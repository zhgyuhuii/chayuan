const AUDIT_FIELDS = [
  'name',
  'description',
  'persona',
  'systemPrompt',
  'userPromptTemplate',
  'inputSource',
  'outputFormat',
  'documentAction',
  'temperature'
]

function normalizeValue(value) {
  if (value === undefined) return null
  if (value && typeof value === 'object') return JSON.parse(JSON.stringify(value))
  return value
}

export function diffAssistantConfig(before = {}, after = {}, fields = AUDIT_FIELDS) {
  const changes = []
  for (const field of fields) {
    const from = normalizeValue(before?.[field])
    const to = normalizeValue(after?.[field])
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes.push({ field, from, to })
    }
  }
  return {
    changed: changes.length > 0,
    changes,
    summary: {
      changedCount: changes.length,
      changedFields: changes.map(item => item.field)
    }
  }
}

export function createAssistantEvolutionAuditRecord(input = {}) {
  const diff = input.diff || diffAssistantConfig(input.before || {}, input.after || {})
  return {
    id: String(input.id || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    assistantId: String(input.assistantId || input.after?.id || input.before?.id || '').trim(),
    actor: String(input.actor || 'auto-evolution').trim(),
    reason: String(input.reason || '').trim(),
    createdAt: input.createdAt || new Date().toISOString(),
    baselineVersionId: String(input.baselineVersionId || '').trim(),
    candidateVersionId: String(input.candidateVersionId || '').trim(),
    decision: String(input.decision || 'proposed').trim(),
    diff
  }
}

export function summarizeAuditRecord(record = {}) {
  const fields = Array.isArray(record?.diff?.summary?.changedFields)
    ? record.diff.summary.changedFields
    : []
  return {
    id: record.id,
    assistantId: record.assistantId,
    decision: record.decision,
    changedCount: fields.length,
    changedFields: fields,
    reason: record.reason
  }
}

export default {
  diffAssistantConfig,
  createAssistantEvolutionAuditRecord,
  summarizeAuditRecord
}
