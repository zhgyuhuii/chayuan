import { resolveDocumentTaskInputScope } from '../../utils/documentTaskScope.js'
import { INTENT_LANES } from './schemas.js'

const DOCUMENT_LANES = new Set([
  INTENT_LANES.DOCUMENT_OPERATION,
  INTENT_LANES.DOCUMENT_REVIEW,
  INTENT_LANES.WPS_CAPABILITY
])

export function requiresDocumentScope(lane = '') {
  return DOCUMENT_LANES.has(String(lane || '').trim())
}

export function resolveIntentScope(text = '', lane = INTENT_LANES.CHAT, context = {}) {
  if (lane === INTENT_LANES.KNOWLEDGE_QUERY || lane === INTENT_LANES.CHAT || lane === INTENT_LANES.GENERATED_OUTPUT) {
    return {
      kind: 'prompt',
      requested: 'prompt',
      available: true,
      required: false,
      reason: lane === INTENT_LANES.KNOWLEDGE_QUERY ? '知识库查询默认只使用用户问题。' : '该意图默认不强制读取文档。'
    }
  }

  const routeKind = lane === INTENT_LANES.WPS_CAPABILITY ? 'document-operation' : 'document-operation'
  const resolved = resolveDocumentTaskInputScope(text, {
    routeKind,
    hasSelection: context.hasSelection === true,
    hasDocument: context.hasDocument === true
  })
  const required = requiresDocumentScope(lane)
  return {
    kind: resolved.resolvedScope || 'prompt',
    requested: resolved.requestedScope || 'prompt',
    available: resolved.resolvedScope !== 'prompt' || !required,
    required,
    reason: resolved.reason || ''
  }
}

export default {
  requiresDocumentScope,
  resolveIntentScope
}
