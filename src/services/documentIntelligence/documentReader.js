import { getDocumentText } from '../../utils/documentActions.js'

function normalizeDocumentText(text = '') {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

export function readCurrentDocumentPayload(options = {}) {
  const documentText = normalizeDocumentText(
    typeof options.getDocumentText === 'function'
      ? options.getDocumentText()
      : getDocumentText()
  )
  const snapshot = typeof options.getSnapshot === 'function'
    ? options.getSnapshot()
    : null
  return {
    documentText,
    snapshot,
    documentCharCount: documentText.length
  }
}

export default {
  readCurrentDocumentPayload
}
