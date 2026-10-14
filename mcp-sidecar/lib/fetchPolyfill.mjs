/**
 * Node <18 回落运行时（Win7/8 部署机装 Node 14/16）的最小 fetch polyfill。
 *
 * 覆盖面 = sidecar 实际用到的子集（imageTools/webResources 两处调用点）：
 *   fetch(url, { method, headers, body, signal }) → { ok, status, statusText, headers, text(), json(), arrayBuffer() }
 *   + 5 跳内重定向跟随（图片直链常见 301/302）
 *   + AbortController/AbortSignal 兜底（Node 14 全局没有，15+ 才内置）
 *
 * Node 18+ 有原生 fetch，本模块零副作用直接跳过。
 */
import http from 'node:http'
import https from 'node:https'

const ABORT_MSG = 'The operation was aborted'

function createSignalShim() {
  const listeners = []
  return {
    aborted: false,
    addEventListener(_type, fn) {
      // abort 至多触发一次；once 语义天然满足，无需区分
      if (this.aborted) fn()
      else listeners.push(fn)
    },
    abort() {
      if (this.aborted) return
      this.aborted = true
      listeners.splice(0).forEach(fn => {
        try { fn() } catch { /* 监听器异常不影响中止 */ }
      })
    }
  }
}

// Node 15+ 已有全局 AbortController；仅缺失时兜底（signal 只被 sidecar 自己的
// fetchWithTimeout 消费，不用对齐 WHATWG 全量语义）。
if (typeof globalThis.AbortController !== 'function') {
  globalThis.AbortController = class {
    constructor() { this.signal = createSignalShim() }
    abort() { this.signal.abort() }
  }
}

function requestOnce(url, { method, headers, body, signal }) {
  return new Promise((resolve, reject) => {
    const target = typeof url === 'string' ? new URL(url) : url
    const mod = target.protocol === 'https:' ? https : http
    const req = mod.request(target, { method, headers }, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({ res, body: Buffer.concat(chunks) }))
      res.on('error', reject)
    })
    req.on('error', reject)
    if (signal) {
      if (signal.aborted) {
        req.destroy(new Error(ABORT_MSG))
      } else {
        signal.addEventListener('abort', () => req.destroy(new Error(ABORT_MSG)))
      }
    }
    if (body != null) req.write(body)
    req.end()
  })
}

function toResponse(res, body) {
  const status = Number(res.statusCode || 0)
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(res.statusMessage || ''),
    headers: new Map(Object.entries(res.headers || {})),
    text: async () => body.toString('utf8'),
    json: async () => JSON.parse(body.toString('utf8')),
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
  }
}

export async function polyfillFetch(url, opts = {}) {
  let target = String(url)
  let method = String(opts.method || 'GET').toUpperCase()
  let body = opts.body
  const headers = { ...(opts.headers || {}) }
  for (let hop = 0; hop < 6; hop++) {
    const { res, body: buf } = await requestOnce(target, { method, headers, body, signal: opts.signal })
    const location = res.headers.location
    if (location && [301, 302, 303, 307, 308].includes(res.statusCode)) {
      target = new URL(location, target).href
      // 303 一律转 GET；301/302 的 POST 按业界惯例转 GET
      if (res.statusCode === 303 || ((res.statusCode === 301 || res.statusCode === 302) && method === 'POST')) {
        method = 'GET'
        body = undefined
        delete headers['content-length']
      }
      continue
    }
    return toResponse(res, buf)
  }
  throw new Error('fetch: too many redirects')
}

if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = polyfillFetch
}

export default polyfillFetch
