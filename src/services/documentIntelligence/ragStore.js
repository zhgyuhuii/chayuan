import ragIndex from '../../utils/assistant/ragIndex.js'
import {
  deleteDocumentIntelligenceEntry,
  listDocumentIntelligenceEntries,
  loadDocumentIntelligenceEntry,
  saveDocumentIntelligenceEntry
} from './storage.js'

const RAG_NAMESPACE = 'rag-index'

export async function indexDocumentForRetrieval(docId, text, options = {}) {
  const result = await ragIndex.indexDocument(docId, text, {
    maxChars: options.maxChars
  })
  if (result?.ok && options.persist !== false) {
    await saveDocumentIntelligenceEntry(RAG_NAMESPACE, docId, {
      docId,
      text: String(text || ''),
      maxChars: options.maxChars || null,
      chunkCount: result.chunkCount,
      indexedAt: new Date().toISOString()
    })
  }
  return result
}

export async function queryDocumentRetrieval(queryText, options = {}) {
  return ragIndex.query(queryText, {
    topK: options.topK || 5,
    ...options
  })
}

export function removeDocumentRetrievalIndex(docId) {
  return ragIndex.removeDocument(docId)
}

export async function deleteDocumentRetrievalIndex(docId) {
  const removed = ragIndex.removeDocument(docId)
  await deleteDocumentIntelligenceEntry(RAG_NAMESPACE, docId)
  return removed
}

export function listRetrievalIndexes() {
  return ragIndex.listIndexedDocuments()
}

export async function listPersistentRetrievalIndexes() {
  return listDocumentIntelligenceEntries(RAG_NAMESPACE)
}

export async function loadRetrievalIndex(docId, options = {}) {
  const cached = await loadDocumentIntelligenceEntry(RAG_NAMESPACE, docId)
  if (!cached?.text) return { ok: false, error: '索引缓存不存在' }
  return indexDocumentForRetrieval(docId, cached.text, {
    maxChars: options.maxChars || cached.maxChars,
    persist: options.persist
  })
}

export function setRetrievalBackend(backend) {
  return ragIndex.setBackend(backend)
}

export default {
  indexDocumentForRetrieval,
  queryDocumentRetrieval,
  removeDocumentRetrievalIndex,
  deleteDocumentRetrievalIndex,
  listRetrievalIndexes,
  listPersistentRetrievalIndexes,
  loadRetrievalIndex,
  setRetrievalBackend
}
