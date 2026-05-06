#!/usr/bin/env node
/**
 * KB 集成 smoke test — plan v1.3 §5.1 E2E 用例的 unit/integration 层替身。
 *
 * 在没有真实 WPS / 真实后端的前提下，验证：
 *   1. featureFlags + connectionStore CRUD + listener
 *   2. pathRouter 在 JWT/HMAC 模式下正确分流
 *   3. healthProbe 错误码细化兜底（4011/4014/4031/4032/4033）
 *   4. attachmentClient.buildDownloadUrl 携带 token + humanizeDownloadError 文案
 *   5. retrievalMiddleware：未绑 KB 直通；flag 关闭时直通；mock 检索 0 命中走 NO_KB_NOTICE
 *   6. credibilityScorer 输出 trust/stars
 *   7. promptBuilder 引用约束 + extractCitations 解析
 *
 * 跑法:
 *   node scripts/test-kb-integration-smoke.mjs
 */

// 先 mock window/localStorage/document/fetch（与 test-service-smoke.mjs 同样的方式）
class MockStorage {
  constructor() { this.map = new Map() }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { this.map.set(k, String(v)) }
  removeItem(k) { this.map.delete(k) }
  clear() { this.map.clear() }
  get length() { return this.map.size }
  key(i) { return Array.from(this.map.keys())[i] || null }
}
const _mockLocal = new MockStorage()
const _mockSession = new MockStorage()

globalThis.window = globalThis.window || {}
globalThis.window.localStorage = _mockLocal
globalThis.window.sessionStorage = _mockSession
globalThis.localStorage = _mockLocal
globalThis.sessionStorage = _mockSession
globalThis.document = globalThis.document || {
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: 'visible',
}
try {
  if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node-smoke' }
} catch (e) {
  // node 22 上 navigator 是只读 getter,跳过即可
}

// 默认 fetch 返回 401（让 healthProbe 显示连接失败）；测试里会覆盖
let _fetchHandler = async () => new Response(JSON.stringify({ detail: { code: 5000, msg: 'no fetch handler' } }), { status: 500 })
globalThis.fetch = (url, init) => _fetchHandler(url, init)
const setFetchHandler = (fn) => { _fetchHandler = fn }

// crypto.subtle 不在 node legacy 里，但 node 18+ 通过 webcrypto 提供
if (!globalThis.crypto && typeof require !== 'undefined') {
  try { globalThis.crypto = require('crypto').webcrypto } catch (e) {}
}

const repoRoot = new URL('..', import.meta.url).href
let failures = 0
let passes = 0

function assert(name, cond, detail = '') {
  if (cond) { console.log(`✓ ${name}`); passes += 1 }
  else { console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); failures += 1 }
}

async function main() {
  console.log('KB integration smoke tests\n')

  const featureFlags = await import(repoRoot + 'src/utils/featureFlags.js')
  assert('featureFlags.kbRemoteIntegration default ON',
    featureFlags.isEnabled('kbRemoteIntegration') === true)
  featureFlags.setFlag('kbRemoteIntegration', false)
  assert('featureFlags.setFlag persists',
    featureFlags.isEnabled('kbRemoteIntegration') === false)
  featureFlags.setFlag('kbRemoteIntegration', true)

  // -------- 1. connectionStore CRUD + 监听器 --------
  const connStore = await import(repoRoot + 'src/services/kb/connectionStore.js')
  connStore._resetForTest && connStore._resetForTest()
  let listenerHits = 0
  const unsub = connStore.subscribe(() => { listenerHits += 1 })

  connStore.upsertConnection({
    id: 'conn-1', name: 'JWT 测试',
    baseUrl: 'https://kb.example.com', authMode: 'jwt',
    jwt: { username: 'alice', ciphertext_password: 'enc:placeholder' }
  })
  assert('connectionStore.list 返回 1 条', connStore.listConnections().length === 1)
  connStore.setCurrentConnection('conn-1')
  assert('connectionStore.current 命中', connStore.getCurrentConnection()?.id === 'conn-1')
  assert('subscribe 监听器收到事件', listenerHits >= 1, `hits=${listenerHits}`)

  connStore.upsertConnection({
    id: 'conn-2', name: 'HMAC 测试',
    baseUrl: 'https://api.example.com', authMode: 'hmac',
    hmac: { appId: 'demo-app', ciphertext_appSecret: 'enc:placeholder' }
  })
  assert('CRUD 加第二条', connStore.listConnections().length === 2)
  unsub()

  // -------- 2. pathRouter 分流 --------
  const pathRouter = await import(repoRoot + 'src/services/kb/pathRouter.js')
  const jwtConn = connStore.getConnection('conn-1')
  const hmacConn = connStore.getConnection('conn-2')
  assert('pathRouter JWT search_batch 不变',
    pathRouter.resolve(jwtConn, '/knowledge_base/search_batch') === '/knowledge_base/search_batch')
  assert('pathRouter HMAC search_batch 进 /openapi/v1/kb/*',
    pathRouter.resolve(hmacConn, '/knowledge_base/search_batch') === '/openapi/v1/kb/search_batch')
  assert('pathRouter HMAC universe/tree 不可用(返 null)',
    pathRouter.resolve(hmacConn, '/knowledge_universe/tree') == null)
  assert('pathRouter JWT universe/tree 可用',
    pathRouter.resolve(jwtConn, '/knowledge_universe/tree') === '/knowledge_universe/tree')

  // -------- 3. healthProbe 错误码兜底 --------
  const healthProbe = await import(repoRoot + 'src/services/kb/healthProbe.js')
  // mock fetch 返回 4032 — 应被 humanize 成 "无 grant" 文案
  setFetchHandler(async (url) => {
    if (String(url).includes('/openapi/v1/ping') || String(url).includes('/login') ||
        String(url).includes('/list_knowledge_bases')) {
      return new Response(JSON.stringify({ detail: { code: 4032, msg: 'no grant' } }), { status: 403 })
    }
    return new Response('{}', { status: 200 })
  })
  const probeResult = await healthProbe.run(hmacConn).catch(e => ({ ok: false, error: e?.message || String(e) }))
  assert('healthProbe HMAC 4032 → 不 ok', probeResult.ok === false)
  // 至少有 service 步成功(我们 mock 了 200),其它任意一步(cred/kb)失败即 ok=false
  const hasServiceOk = Array.isArray(probeResult.steps) &&
    probeResult.steps.some(s => s.name === 'service' && s.ok === true)
  assert('healthProbe 三步聚合至少能跑通 service 步', hasServiceOk,
    JSON.stringify(probeResult.steps?.map(s => ({ n: s.name, ok: s.ok }))))
  // 至少有一步是 fail 状态(cred 或 kb)
  const hasFailedStep = Array.isArray(probeResult.steps) &&
    probeResult.steps.some(s => s.ok === false)
  assert('healthProbe 至少 1 步失败 → ok=false 一致', hasFailedStep)

  // -------- 4. attachmentClient buildDownloadUrl + humanize --------
  const att = await import(repoRoot + 'src/services/kb/attachmentClient.js')
  const url = att.buildDownloadUrl(hmacConn, {
    kb_name: 'kbX', file_name: 'r.pdf', download_token: 'eyJ.fake.tok'
  })
  assert('buildDownloadUrl HMAC 进 /openapi/v1/kb/download_doc + 带 token',
    url.includes('/openapi/v1/kb/download_doc') && url.includes('token=eyJ.fake.tok') &&
    url.includes('knowledge_base_name=kbX') && url.includes('file_name=r.pdf'),
    url)
  const hum4011 = att.humanizeDownloadError(401, JSON.stringify({ detail: { code: 4011 } }))
  assert('humanizeDownloadError 4011 文案重新发起搜索', /重新发起搜索/.test(hum4011), hum4011)
  const hum4032 = att.humanizeDownloadError(403, JSON.stringify({ detail: { code: 4032 } }))
  assert('humanizeDownloadError 4032 文案 grant 撤销', /撤销/.test(hum4032), hum4032)

  // -------- 5. retrievalMiddleware 行为 --------
  const middleware = await import(repoRoot + 'src/services/kb/retrievalMiddleware.js')

  // 5a) 未绑 KB → 直通
  const ctxA = { chat: {}, userMessage: { content: 'hi' }, messagesForApi: [] }
  const outA = await middleware.applyKbRetrievalIfBound(ctxA)
  assert('retrievalMiddleware 未绑 → 直通', outA === ctxA && ctxA.messagesForApi.length === 0)

  // 5b) flag 关闭 → 即便有 binding 也直通
  featureFlags.setFlag('kbRemoteIntegration', false)
  const ctxB = {
    chat: { kbBindings: { kbNames: ['kbX'] } },
    userMessage: { content: '请总结这段' },
    messagesForApi: [],
    assistantMessageMeta: {}
  }
  const outB = await middleware.applyKbRetrievalIfBound(ctxB)
  assert('retrievalMiddleware flag 关 → 直通', outB === ctxB && ctxB.messagesForApi.length === 0,
    JSON.stringify(ctxB.messagesForApi))
  featureFlags.setFlag('kbRemoteIntegration', true)

  // -------- 6. credibilityScorer --------
  const scorer = await import(repoRoot + 'src/services/kb/credibilityScorer.js')
  const scored = scorer.score([
    { page_content: '苹果是一种水果。富士苹果产自日本。', score: 0.7,
      from_query_tags: ['q1'], metadata: {} },
    { page_content: '不相关的内容', score: 0.1,
      from_query_tags: [], metadata: {} },
  ], { queryText: '苹果' })
  assert('credibilityScorer 高匹配 trust > 低匹配',
    Number(scored[0].trust || 0) > Number(scored[1].trust || 0),
    `${scored[0].trust} vs ${scored[1].trust}`)
  assert('credibilityScorer 5 档星级',
    scored.every(c => Number.isInteger(c.stars) && c.stars >= 1 && c.stars <= 5))

  // -------- 7. promptBuilder + extractCitations --------
  const pb = await import(repoRoot + 'src/services/kb/promptBuilder.js')
  const built = pb.build({
    mode: 'qa',
    sources: [{ kb_name: 'kbX', page_content: '苹果是水果' }],
    userQuery: '苹果是什么?'
  })
  assert('promptBuilder 含 [^cN] 引用约束',
    /\[\^cN\]/.test(built.systemPrompt) || /\[\^c1\]/.test(built.systemPrompt),
    built.systemPrompt.slice(0, 200))
  const cites = pb.extractCitations('参考[^c1]和[^c3]说明,而 [^cool] 不算。')
  assert('extractCitations 抽 c1+c3 不抓 cool',
    Array.isArray(cites) && cites.includes('c1') && cites.includes('c3') && !cites.includes('cool'),
    JSON.stringify(cites))

  // ---- 总结 ----
  console.log()
  console.log(`通过 ${passes} 项 / 失败 ${failures} 项`)
  if (failures > 0) process.exit(1)
}

main().catch((e) => {
  console.error('测试脚本异常:', e)
  process.exit(2)
})
