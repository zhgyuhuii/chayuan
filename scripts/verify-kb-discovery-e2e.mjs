#!/usr/bin/env node
/* eslint-env node, browser, es2021 */
/**
 * e2e 验证:真实 socket 上跑通「自动发现 → 动态接入 → 目录 → 检索」全链路。
 *
 * 1. 起一个带 CORS 头的 mock chatop-kb(随机临时端口,响应形状与 chatop-kb
 *    routes.js 同款,含 OPTIONS 预检)
 * 2. 加载 chayuan-wps src 模块(带浏览器全局 mock),discoverHarnessKb 走真实
 *    默认端口梯(38 个候选并行探测)
 * 3. ensureHarnessConnection 落连接 → kbCatalog.fetchTree → healthProbe.run →
 *    searchOrchestrator.run 全部打到真实 HTTP
 */

import { createServer } from 'node:http'

// mock 实例挑一个不在注册表梯里的临时端口,避免和本机真实 harness 抢发现
const PORT = 0

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-private-network': 'true',
}

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      ...CORS,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, accept',
      'access-control-max-age': '600',
    })
    res.end()
    return
  }
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const json = (code, body) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...CORS })
    res.end(JSON.stringify(body))
  }
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(200, { ok: true, service: 'chatop-kb', port: server.address()?.port ?? null })
  }
  if (req.method === 'GET' && url.pathname === '/status') {
    return json(200, {
      ok: true,
      kbs: [{ kbId: 'default', docs: [], vecBackend: 'local' }],
      chain: { cloudEmbedding: false },
      service: { port: server.address()?.port ?? null, url: `http://127.0.0.1:${server.address()?.port}` },
    })
  }
  if (req.method === 'GET' && url.pathname === '/kbs') {
    return json(200, { ok: true, kbs: [{ kbId: 'default', docs: 2, ready: 2, pending: 0, vecBackend: 'local' }] })
  }
  if (req.method === 'GET' && url.pathname === '/search') {
    return json(200, {
      ok: true,
      hits: [{
        chunkId: 1, docId: 'd1', docName: '操作手册.docx', seq: 0,
        headingPath: '快速上手', text: `关于「${url.searchParams.get('q')}」的本机知识库片段`,
      }],
      mismatch: null,
    })
  }
  json(404, { ok: false })
})

await new Promise((r) => server.listen(PORT, '127.0.0.1', r))
const MOCK_PORT = server.address().port
const MOCK_ORIGIN = `http://127.0.0.1:${MOCK_PORT}`
console.log(`mock chatop-kb 就绪 ${MOCK_ORIGIN}`)

// ---- 浏览器全局 mock(同 smoke 约定) ----
class MockStorage {
  constructor() { this.map = new Map() }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { this.map.set(k, String(v)) }
  removeItem(k) { this.map.delete(k) }
  clear() { this.map.clear() }
  get length() { return this.map.size }
  key(i) { return Array.from(this.map.keys())[i] || null }
}
const store = new MockStorage()
globalThis.window = globalThis.window || {}
globalThis.window.localStorage = store
globalThis.localStorage = store
globalThis.window.sessionStorage = store
globalThis.sessionStorage = store
globalThis.document = { addEventListener: () => {}, removeEventListener: () => {}, visibilityState: 'visible' }

const repoRoot = new URL('..', import.meta.url).href
let failures = 0
const assert = (name, cond, detail = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : ' — ' + detail}`)
  if (!cond) failures += 1
}

const discovery = await import(repoRoot + 'src/services/kb/kbDiscovery.js')
const connStore = await import(repoRoot + 'src/services/kb/connectionStore.js')
connStore._resetForTest()
discovery.forget()

// 1a. 真实环境全默认端口梯发现(38 候选并行):本机若跑着真实 harness 会被扫到,
//     所以只断言「指纹命中」,不断言具体端口
const t0 = Date.now()
const found = await discovery.discoverHarnessKb({ force: true })
assert(`默认端口梯发现(耗时 ${Date.now() - t0}ms,命中 ${found?.baseUrl || '无'})`,
  !!found && found.source === 'probe' && discovery.isChatopStatus(found.status),
  JSON.stringify(found && { baseUrl: found.baseUrl, source: found.source }))

// 1b. mock 实例确定性发现(explicitBaseUrl 直指)
const foundMock = await discovery.discoverHarnessKb({ explicitBaseUrl: MOCK_ORIGIN, force: true })
assert('mock 实例发现(source=manual)',
  !!foundMock && foundMock.baseUrl === MOCK_ORIGIN && foundMock.kbCount === 1,
  JSON.stringify(foundMock && { baseUrl: foundMock.baseUrl, kbCount: foundMock.kbCount }))

// 2. 动态接入
const ens = await discovery.ensureHarnessConnection({ explicitBaseUrl: MOCK_ORIGIN, force: true })
assert('动态接入 updated/added + 落库',
  ens.ok && (ens.action === 'added' || ens.action === 'updated')
  && ens.connection?.baseUrl === MOCK_ORIGIN
  && connStore.getConnection(discovery.HARNESS_CONNECTION_ID)?.serviceType === 'chatop',
  JSON.stringify({ action: ens.action, baseUrl: ens.connection?.baseUrl }))

// 3. 健康探测(真实三步)
const healthProbe = await import(repoRoot + 'src/services/kb/healthProbe.js')
const hp = await healthProbe.run(ens.connection)
assert('healthProbe 三步全通', hp.ok && hp.summary?.kbCount === 1,
  JSON.stringify(hp.steps.map(s => [s.name, s.ok, s.error || ''])))

// 4. 目录树
const kbCatalog = await import(repoRoot + 'src/services/kb/kbCatalog.js')
const tree = await kbCatalog.fetchTree(ens.connection, { force: true })
assert('目录树 1 组 1 库',
  tree.length === 1 && tree[0].children?.length === 1 && tree[0].children[0].id === 'default')

// 5. CORS 预检(模拟浏览器跨端口 fetch 的 OPTIONS)
const opt = await fetch(`${MOCK_ORIGIN}/ask`, { method: 'OPTIONS' })
assert('OPTIONS 预检 204 + CORS 头',
  opt.status === 204 && opt.headers.get('access-control-allow-origin') === '*')

// 6. 检索
const orchestrator = await import(repoRoot + 'src/services/kb/searchOrchestrator.js')
const out = await orchestrator.run({
  connection: ens.connection,
  query: '怎么快速上手',
  kbBindings: { kuIds: ['doc:default'], topK: 5 },
  mode: 'qa',
})
assert('检索命中且出处归一',
  out.chunks.length === 1 && out.chunks[0].file_name === '操作手册.docx'
  && out.chunks[0].metadata.serviceType === 'chatop',
  JSON.stringify(out.chunks.map(c => c.file_name)))

server.close()
discovery.forget()
console.log(failures === 0 ? '\ne2e 全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)
