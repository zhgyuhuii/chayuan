import { normalizeKnowledgeBinding } from './schemas.js'

function toText(value = '') {
  return String(value || '').trim()
}

function safeLength(value = '') {
  return toText(value).length
}

export function collectIntentContext(options = {}) {
  const selectedText = toText(options.selectedText || options.selectionText)
  const documentText = toText(options.documentText)
  const hasSelection = options.hasSelection === true || selectedText.length > 0
  const hasDocument = options.hasDocument === true || documentText.length > 0 || Number(options.documentCharCount || 0) > 0
  const kbBinding = normalizeKnowledgeBinding(options.kbBindings || options.knowledge || {
    kuIds: options.kuIds,
    ku_ids: options.ku_ids,
    sourceRefs: options.sourceRefs,
    kbNames: options.kbNames
  })

  return {
    hasSelection,
    hasDocument,
    selectedText,
    documentText,
    selectionCharCount: selectedText.length,
    documentCharCount: Math.max(safeLength(documentText), Number(options.documentCharCount || 0)),
    chunkCount: Math.max(0, Number(options.chunkCount || 0)),
    attachments: Array.isArray(options.attachments) ? options.attachments : [],
    assistantId: toText(options.assistantId),
    assistantName: toText(options.assistantName),
    routeKind: toText(options.routeKind),
    kbBinding,
    raw: { ...options }
  }
}

export default {
  collectIntentContext
}
