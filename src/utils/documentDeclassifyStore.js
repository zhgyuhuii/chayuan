import { getActiveDocument, getApplication } from './documentActions.js'

export const DECLASSIFY_STATE_VAR_NAME = 'NdDeclassifyState'
export const DECLASSIFY_PAYLOAD_VAR_NAME = 'NdDeclassifyPayloadV1'
export const DECLASSIFY_STATE_VERSION = 1

function readVariable(doc, name) {
  if (!doc?.Variables || !name) return ''
  try {
    const variable = doc.Variables.Item(name)
    return String(variable?.Value || '')
  } catch (_) {
    return ''
  }
}

function writeVariable(doc, name, value) {
  if (!doc?.Variables || !name) {
    throw new Error('当前文档不支持保存脱密元数据')
  }
  const serialized = String(value ?? '')
  try {
    const variable = doc.Variables.Item(name)
    if (variable) {
      variable.Value = serialized
      return
    }
  } catch (_) {}
  doc.Variables.Add(name, serialized)
}

function removeVariable(doc, name) {
  if (!doc?.Variables || !name) return
  try {
    const variable = doc.Variables.Item(name)
    variable?.Delete?.()
  } catch (_) {}
}

function parseJsonSafe(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (_) {
    return null
  }
}

function normalizeState(source) {
  if (!source || typeof source !== 'object') return null
  return {
    version: Number(source.version) || DECLASSIFY_STATE_VERSION,
    status: String(source.status || 'declassified'),
    payloadVarName: String(source.payloadVarName || DECLASSIFY_PAYLOAD_VAR_NAME),
    placeholderPrefix: String(source.placeholderPrefix || 'xND'),
    keywordCount: Number(source.keywordCount || 0),
    replacementCount: Number(source.replacementCount || 0),
    originalTextHash: String(source.originalTextHash || ''),
    declassifiedTextHash: String(source.declassifiedTextHash || ''),
    createdAt: String(source.createdAt || ''),
    updatedAt: String(source.updatedAt || source.createdAt || ''),
    algorithm: String(source.algorithm || 'AES-GCM-256'),
    kdf: String(source.kdf || 'PBKDF2-SHA-256')
  }
}

export function getDeclassifyState(doc = getActiveDocument()) {
  return normalizeState(parseJsonSafe(readVariable(doc, DECLASSIFY_STATE_VAR_NAME)))
}

export function getDeclassifyEnvelope(doc = getActiveDocument()) {
  const state = getDeclassifyState(doc)
  const payloadVarName = state?.payloadVarName || DECLASSIFY_PAYLOAD_VAR_NAME
  return parseJsonSafe(readVariable(doc, payloadVarName))
}

export function isDocumentDeclassified(doc = getActiveDocument()) {
  const state = getDeclassifyState(doc)
  return Boolean(state && state.status === 'declassified')
}

export function saveDeclassifyState(doc = getActiveDocument(), state, envelope) {
  if (!doc) {
    throw new Error('当前没有打开文档')
  }
  const normalized = normalizeState({
    ...state,
    version: DECLASSIFY_STATE_VERSION,
    status: 'declassified',
    payloadVarName: state?.payloadVarName || DECLASSIFY_PAYLOAD_VAR_NAME,
    updatedAt: new Date().toISOString()
  })
  if (!normalized) {
    throw new Error('脱密状态无效，无法保存')
  }
  writeVariable(doc, normalized.payloadVarName, JSON.stringify(envelope ?? {}))
  writeVariable(doc, DECLASSIFY_STATE_VAR_NAME, JSON.stringify(normalized))
  return normalized
}

export function clearDeclassifyState(doc = getActiveDocument()) {
  if (!doc) return
  const state = getDeclassifyState(doc)
  const payloadVarName = state?.payloadVarName || DECLASSIFY_PAYLOAD_VAR_NAME
  removeVariable(doc, payloadVarName)
  removeVariable(doc, DECLASSIFY_STATE_VAR_NAME)
}

export function invalidateDeclassifyRibbonControls() {
  try {
    const ribbonUI = getApplication()?.ribbonUI
    ribbonUI?.InvalidateControl?.('btnDocumentDeclassify')
    ribbonUI?.InvalidateControl?.('btnDocumentDeclassifyRestore')
  } catch (_) {}
}
