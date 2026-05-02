/**
 * searchClient — /search_batch (+ stream) HTTP 客户端
 *
 * 详见 docs/kb-search-batch-contract.md
 *
 * 三个函数:
 *   - searchBatch(connection, body, { signal })          同步批量
 *   - searchBatchStream(connection, body, onFrame, ...)  SSE 版
 *   - searchDocs(connection, body, { signal })           兼容旧端点;404 回退用
 */

import { createAuthClient } from './authClient.js'
import { resolve as _resolvePath } from './pathRouter.js'

export async function searchBatch(connection, body, options = {}) {
  const auth = createAuthClient(connection)
  const path = _resolvePath(connection, '/knowledge_base/search_batch')
  if (!path) {
    const err = new Error('search_batch not available in current auth mode')
    err.code = 'PATH_UNSUPPORTED'
    throw err
  }
  const resp = await auth.fetch(path, {
    method: 'POST',
    body,
    signal: options.signal,
    timeoutMs: options.timeoutMs || 20_000
  })
  if (resp.status === 404) {
    const err = new Error('search_batch endpoint not found')
    err.code = 'ENDPOINT_NOT_FOUND'
    throw err
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    const err = new Error(`search_batch HTTP ${resp.status}: ${text.slice(0, 200)}`)
    err.status = resp.status
    throw err
  }
  return resp.json()
}

export async function searchBatchStream(connection, body, onFrame, options = {}) {
  const auth = createAuthClient(connection)
  const path = _resolvePath(connection, '/knowledge_base/search_batch_stream')
  if (!path) {
    const err = new Error('search_batch_stream not available in current auth mode')
    err.code = 'PATH_UNSUPPORTED'
    throw err
  }
  const resp = await auth.fetch(path, {
    method: 'POST',
    body,
    signal: options.signal,
    headers: { Accept: 'text/event-stream' },
    timeoutMs: options.timeoutMs || 60_000
  })
  if (resp.status === 404) {
    const err = new Error('search_batch_stream endpoint not found')
    err.code = 'ENDPOINT_NOT_FOUND'
    throw err
  }
  if (!resp.ok || !resp.body) {
    const err = new Error(`search_batch_stream HTTP ${resp.status}`)
    err.status = resp.status
    throw err
  }
  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const frame = _parseSseFrame(raw)
      if (frame) {
        try { onFrame(frame) } catch (e) { /* ignore handler errors */ }
        if (frame.event === 'done' || frame.event === 'error') {
          // continue; server may still send more,但 done 后通常关流
        }
      }
    }
  }
}

function _parseSseFrame(raw) {
  if (!raw) return null
  let event = 'message'
  let data = ''
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  if (!data) return { event, data: null }
  try {
    return { event, data: JSON.parse(data) }
  } catch (e) {
    return { event, data }
  }
}

export async function searchDocs(connection, body, options = {}) {
  const auth = createAuthClient(connection)
  const path = _resolvePath(connection, '/knowledge_base/search_docs')
  if (!path) {
    // HMAC 模式不开放 /search_docs;调用方应该改走 search_batch
    const err = new Error('search_docs not available for HMAC mode (use search_batch)')
    err.code = 'PATH_UNSUPPORTED'
    throw err
  }
  const resp = await auth.fetch(path, {
    method: 'POST',
    body,
    signal: options.signal,
    timeoutMs: options.timeoutMs || 10_000
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`search_docs HTTP ${resp.status}: ${text.slice(0, 200)}`)
  }
  return resp.json()
}

export default { searchBatch, searchBatchStream, searchDocs }
