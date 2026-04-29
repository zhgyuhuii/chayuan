import {
  deleteDocumentIntelligenceEntry,
  listDocumentIntelligenceEntries,
  loadDocumentIntelligenceEntry,
  saveDocumentIntelligenceEntry
} from '../documentIntelligence/storage.js'

const AUDIT_NAMESPACE = 'assistant-evolution-audit'
const SUITE_NAMESPACE = 'assistant-evolution-suite'

export async function saveEvolutionAuditRecord(record = {}) {
  const key = String(record.id || `audit_${Date.now()}`).trim()
  return saveDocumentIntelligenceEntry(AUDIT_NAMESPACE, key, record)
}

export async function loadEvolutionAuditRecord(id = '') {
  return loadDocumentIntelligenceEntry(AUDIT_NAMESPACE, id)
}

export async function listEvolutionAuditRecords() {
  return listDocumentIntelligenceEntries(AUDIT_NAMESPACE)
}

export async function deleteEvolutionAuditRecord(id = '') {
  return deleteDocumentIntelligenceEntry(AUDIT_NAMESPACE, id)
}

export async function saveEvaluationSuite(suite = {}) {
  const key = String(suite.id || `suite_${Date.now()}`).trim()
  return saveDocumentIntelligenceEntry(SUITE_NAMESPACE, key, suite)
}

export async function loadEvaluationSuite(id = '') {
  return loadDocumentIntelligenceEntry(SUITE_NAMESPACE, id)
}

export async function listEvaluationSuites() {
  return listDocumentIntelligenceEntries(SUITE_NAMESPACE)
}

export async function deleteEvaluationSuite(id = '') {
  return deleteDocumentIntelligenceEntry(SUITE_NAMESPACE, id)
}

export default {
  saveEvolutionAuditRecord,
  loadEvolutionAuditRecord,
  listEvolutionAuditRecords,
  deleteEvolutionAuditRecord,
  saveEvaluationSuite,
  loadEvaluationSuite,
  listEvaluationSuites,
  deleteEvaluationSuite
}
