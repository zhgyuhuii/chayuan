/**
 * ragIndex — RAG(Retrieval-Augmented Generation)骨架
 *
 * 解决 P6 问题:长文档对话仍是塞整文 context,效率低。
 * 真正的 RAG 需要:
 *   1. 把文档切片(chunk)+ 向量化 + 索引
 *   2. 查询时检索 top-k 相关 chunk + 拼到 prompt
 *
 * 本骨架:
 *   - 接口已 ready(splitChunks, indexDocument, query)
 *   - 默认 backend 是 keyword search(BM25-ish)+ 内存索引
 *   - vector backend 占位:用户实现 IRagBackend 接入即可
 *
 * 用法:
 *   import rag from '@/utils/assistant/ragIndex.js'
 *
 *   await rag.indexDocument('doc-id-1', longText)
 *   const hits = await rag.query('我提的问题', { topK: 3 })
 *   //  → [{ docId, chunkIndex, text, score }]
 */

const _index = new Map()  // docId → { chunks: [{ id, text, terms }] }
let _backend = null

const STOP_WORDS = new Set(['的', '了', '是', '我', '你', '他', '她', '在', '和', '与', '或', 'a', 'the', 'is', 'of', 'to', 'in', 'and', 'or'])

/* ────────── 切片 ────────── */

/**
 * 按段落切;太长的段落再按句切,最多 N 个字符。
 */
export function splitChunks(text, maxChars = 800) {
  const s = String(text || '')
  if (!s) return []
  const paragraphs = s.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  const chunks = []
  for (const p of paragraphs) {
    if (p.length <= maxChars) {
      chunks.push(p)
      continue
    }
    // 按句号 / 问号 / 感叹号切
    const sentences = p.split(/(?<=[。!?!?])/).map(x => x.trim()).filter(Boolean)
    let buf = ''
    for (const sent of sentences) {
      if (buf.length + sent.length > maxChars) {
        if (buf) chunks.push(buf)
        buf = sent
      } else {
        buf += sent
      }
    }
    if (buf) chunks.push(buf)
  }
  return chunks
}

/* ────────── 索引 ────────── */

function tokenize(text) {
  // 中文按字 + 英文按词
  const out = []
  const matches = String(text || '').toLowerCase().match(/[一-龥]|[a-z0-9]+/g) || []
  for (const m of matches) {
    if (m.length === 1 && !/[一-龥]/.test(m)) continue
    if (STOP_WORDS.has(m)) continue
    out.push(m)
  }
  return out
}

export async function indexDocument(docId, text, options = {}) {
  if (!docId || !text) return { ok: false, error: '参数必填' }
  const chunks = splitChunks(text, options.maxChars).map((chunkText, i) => ({
    id: `${docId}::${i}`,
    text: chunkText,
    terms: new Set(tokenize(chunkText))
  }))
  _index.set(docId, { chunks })
  // 若有 vector backend → 同步喂
  if (_backend?.indexChunks) {
    try { await _backend.indexChunks(docId, chunks.map(c => ({ id: c.id, text: c.text }))) }
    catch (_) { /* fallback to keyword only */ }
  }
  return { ok: true, chunkCount: chunks.length }
}

export function removeDocument(docId) {
  if (!_index.has(docId)) return false
  _index.delete(docId)
  if (_backend?.removeDocument) {
    try { _backend.removeDocument(docId) } catch (_) {}
  }
  return true
}

export function listIndexedDocuments() {
  return Array.from(_index.keys())
}

/* ────────── 查询(BM25-ish) ────────── */

function scoreBm25(queryTerms, chunkTerms) {
  let s = 0
  for (const q of queryTerms) {
    if (chunkTerms.has(q)) s += 1
  }
  return s
}

export async function query(text, options = {}) {
  const topK = Number(options.topK) || 3
  const queryTerms = new Set(tokenize(text))
  if (queryTerms.size === 0) return []

  // 优先 vector backend(若用户接了)
  if (_backend?.query) {
    try {
      const hits = await _backend.query(text, { topK, ...options })
      if (Array.isArray(hits) && hits.length > 0) return hits
    } catch (_) { /* fallback */ }
  }

  // BM25-ish keyword
  const candidates = []
  for (const [docId, doc] of _index) {
    for (let i = 0; i < doc.chunks.length; i++) {
      const score = scoreBm25(queryTerms, doc.chunks[i].terms)
      if (score > 0) candidates.push({ docId, chunkIndex: i, text: doc.chunks[i].text, score })
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, topK)
}

/* ────────── Vector backend 接入点 ────────── */

/**
 * 用户实现一个 IRagBackend:
 *   { indexChunks(docId, chunks), removeDocument(docId), query(text, { topK }) → [{...}] }
 * 然后 setBackend(myBackend) 即可。
 */
export function setBackend(backend) {
  _backend = backend && typeof backend === 'object' ? backend : null
}
export function getBackend() { return _backend }

export default {
  splitChunks,
  indexDocument,
  removeDocument,
  listIndexedDocuments,
  query,
  setBackend,
  getBackend
}
