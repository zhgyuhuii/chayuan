export const INTENT_PLAN_SCHEMA_VERSION = '2026-05-intent-plan-v1'

export const INTENT_LANES = Object.freeze({
  CHAT: 'chat',
  KNOWLEDGE_QUERY: 'knowledge_query',
  ASSISTANT_CALL: 'assistant_call',
  DOCUMENT_OPERATION: 'document_operation',
  DOCUMENT_REVIEW: 'document_review',
  WPS_CAPABILITY: 'wps_capability',
  GENERATED_OUTPUT: 'generated_output'
})

export const OUTPUT_MODES = Object.freeze({
  REPLY: 'reply',
  INSERT: 'insert',
  APPEND: 'append',
  PREPEND: 'prepend',
  INSERT_AFTER: 'insert_after',
  REPLACE: 'replace',
  ADD_COMMENT: 'add_comment',
  COMMENT_REPLACE: 'comment_replace',
  FORMAT: 'format',
  REPORT: 'report'
})

export const RISK_LEVELS = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
})

function normalizeString(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

export function normalizeConfidenceScore(value, fallback = 0.5) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  if (n > 1) return Math.max(0, Math.min(1, n / 100))
  return Math.max(0, Math.min(1, n))
}

export function normalizeKnowledgeBinding(raw = {}) {
  const sourceRefs = Array.from(new Map(
    (Array.isArray(raw?.sourceRefs) ? raw.sourceRefs : [])
      .map(ref => ({
        kuId: normalizeString(ref?.kuId || ref?.kb_id || ref?.id),
        kind: normalizeString(ref?.kind),
        name: normalizeString(ref?.name || ref?.title || ref?.kuId || ref?.id)
      }))
      .filter(ref => ref.kuId)
      .map(ref => [ref.kuId, ref])
  ).values())

  const kuIds = Array.from(new Set([
    ...(Array.isArray(raw?.kuIds) ? raw.kuIds : []),
    ...(Array.isArray(raw?.ku_ids) ? raw.ku_ids : []),
    ...sourceRefs.map(ref => ref.kuId)
  ].map(v => normalizeString(v)).filter(Boolean)))

  const kbNames = Array.from(new Set([
    ...(Array.isArray(raw?.kbNames) ? raw.kbNames : []),
    ...(Array.isArray(raw?.knowledgeBaseNames) ? raw.knowledgeBaseNames : []),
    ...kuIds
  ].map(v => normalizeString(v)).filter(Boolean)))

  return {
    enabled: kuIds.length > 0 || kbNames.length > 0,
    kuIds,
    kbNames,
    sourceRefs,
    usage: normalizeString(raw?.usage || raw?.mode, 'optional'),
    config: raw?.config && typeof raw.config === 'object' ? { ...raw.config } : {}
  }
}

export function createIntentPlan(input = {}) {
  const lane = normalizeString(input.lane, INTENT_LANES.CHAT)
  const intent = normalizeString(input.intent, lane)
  const outputMode = normalizeString(input.output?.mode, OUTPUT_MODES.REPLY)
  return {
    schemaVersion: INTENT_PLAN_SCHEMA_VERSION,
    lane,
    intent,
    confidence: normalizeConfidenceScore(input.confidence),
    source: normalizeString(input.source, 'hybrid'),
    scope: {
      kind: normalizeString(input.scope?.kind, 'prompt'),
      requested: normalizeString(input.scope?.requested || input.scope?.requestedScope, 'prompt'),
      available: input.scope?.available !== false,
      required: input.scope?.required === true,
      reason: normalizeString(input.scope?.reason)
    },
    action: {
      type: normalizeString(input.action?.type, lane),
      name: normalizeString(input.action?.name, intent),
      parameters: input.action?.parameters && typeof input.action.parameters === 'object'
        ? { ...input.action.parameters }
        : {}
    },
    output: {
      mode: outputMode,
      anchor: normalizeString(input.output?.anchor, outputMode === OUTPUT_MODES.ADD_COMMENT ? 'current_range' : 'none')
    },
    knowledge: normalizeKnowledgeBinding(input.knowledge),
    risk: normalizeString(input.risk, RISK_LEVELS.LOW),
    needsConfirmation: input.needsConfirmation === true,
    clarifyQuestion: normalizeString(input.clarifyQuestion),
    diagnostics: {
      matchedRules: Array.isArray(input.diagnostics?.matchedRules) ? input.diagnostics.matchedRules : [],
      candidates: Array.isArray(input.diagnostics?.candidates) ? input.diagnostics.candidates : [],
      reason: normalizeString(input.diagnostics?.reason)
    }
  }
}

export function validateIntentPlan(plan = {}) {
  const errors = []
  if (plan.schemaVersion !== INTENT_PLAN_SCHEMA_VERSION) errors.push('schemaVersion mismatch')
  if (!Object.values(INTENT_LANES).includes(plan.lane)) errors.push(`unsupported lane: ${plan.lane}`)
  if (!Object.values(RISK_LEVELS).includes(plan.risk)) errors.push(`unsupported risk: ${plan.risk}`)
  if (!Object.values(OUTPUT_MODES).includes(plan.output?.mode)) errors.push(`unsupported output mode: ${plan.output?.mode}`)
  if (plan.scope?.required && !plan.scope?.available) errors.push('required scope is unavailable')
  return { ok: errors.length === 0, errors }
}

export default {
  INTENT_PLAN_SCHEMA_VERSION,
  INTENT_LANES,
  OUTPUT_MODES,
  RISK_LEVELS,
  normalizeConfidenceScore,
  normalizeKnowledgeBinding,
  createIntentPlan,
  validateIntentPlan
}
