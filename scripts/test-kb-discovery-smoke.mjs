#!/usr/bin/env node
/* eslint-env node, browser, es2021 */
/**
 * KB 自动发现(chayuan-harness / chatop-kb)smoke test。
 *
 * 在不启动真实 harness 的前提下,用 mock fetch 验证:
 *   1. kbDiscovery 并行端口梯探测 + chatop-kb /status 指纹校验
 *   2. 发现缓存:上次命中地址优先复用;force 跳过缓存
 *   3. ensureHarnessConnection 动态接入:added → ok → 端口漂移 updated → 失联 missing
 *   4. healthProbe chatop 分支三步聚合(/health /status /kbs)
 *   5. kbCatalog chatop 分支:列表归一 + 单组树
 *   6. searchOrchestrator chatop 分支:query×kbId 检索 → merged chunk 归一
 *
 * 跑法:
 *   node scripts/test-kb-discovery-smoke.mjs
 */

// ---- 与 test-kb-integration-smoke.mjs 同款浏览器全局 mock ----
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
// services/index.js 会拉起更宽的模块图(spellCheckService 等),补齐常用 window API
globalThis.window.addEventListener = globalThis.window.addEventListener || (() => {})
globalThis.window.removeEventListener = globalThis.window.removeEventListener || (() => {})
globalThis.window.matchMedia = globalThis.window.matchMedia || (() => ({
  matches: false, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {},
}))
globalThis.window.requestAnimationFrame = globalThis.window.requestAnimationFrame || ((fn) => setTimeout(fn, 0))
globalThis.window.dispatchEvent = globalThis.window.dispatchEvent || (() => true)
try {
  if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node-smoke' }
} catch (e) { /* node 22 navigator 只读,跳过 */ }

let _fetchHandler = async () => new Response(JSON.stringify({ ok: false }), { status: 404 })
let _fetchLog = []
globalThis.fetch = (url, init) => {
  _fetchLog.push(String(url))
  return _fetchHandler(url, init)
}
const setFetchHandler = (fn) => { _fetchHandler = fn; _fetchLog = [] }
const resetFetch = () => setFetchHandler(async () => new Response(JSON.stringify({ ok: false }), { status: 404 }))

const repoRoot = new URL('..', import.meta.url).href
let failures = 0
let passes = 0

function assert(name, cond, detail = '') {
  if (cond) { console.log(`✓ ${name}`); passes += 1 }
  else { console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); failures += 1 }
}

// 模拟一个 chatop-kb /status 指纹响应
const STATUS_BODY = {
  ok: true,
  kbs: [{ kbId: 'default', docs: [], vecBackend: 'local' }],
  chain: { cloudEmbedding: false },
  service: { port: 52582, url: 'http://127.0.0.1:52582' }
}
const KBS_BODY = {
  ok: true,
  kbs: [
    { kbId: 'default', docs: 3, ready: 2, pending: 1, vecBackend: 'local' },
    { kbId: '产品手册', docs: 1, ready: 1, pending: 0, vecBackend: 'local' }
  ]
}
const SEARCH_BODY = {
  ok: true,
  hits: [
    { chunkId: 11, docId: 'docA', docName: '入职工册.docx', seq: 0, headingPath: '第一章', text: '察元入职流程' },
    { chunkId: 12, docId: 'docB', docName: 'FAQ.pdf', seq: 2, headingPath: '', text: '常见问题' }
  ],
  mismatch: null
}

/** mock 一个 chatop 实例:命中 on(可多个)的 /health /status /kbs /search;其余 404 */
function serveChatop(...ons) {
  setFetchHandler(async (url) => {
    const u = new URL(url)
    const hit = ons.includes(u.origin)
    if (u.pathname.endsWith('/health')) {
      return hit
        ? new Response(JSON.stringify({ ok: true, service: 'chatop-kb', port: Number(u.port) }), { status: 200 })
        : new Response(JSON.stringify({ ok: false }), { status: 404 })
    }
    if (u.pathname.endsWith('/status')) {
      return hit
        ? new Response(JSON.stringify(STATUS_BODY), { status: 200 })
        : new Response(JSON.stringify({ ok: false }), { status: 404 })
    }
    if (u.pathname.endsWith('/kbs') && hit) {
      return new Response(JSON.stringify(KBS_BODY), { status: 200 })
    }
    if (u.pathname.endsWith('/search') && hit) {
      return new Response(JSON.stringify(SEARCH_BODY), { status: 200 })
    }
    return new Response(JSON.stringify({ ok: false }), { status: 404 })
  })
}

async function main() {
  console.log('KB 自动发现(chayuan-harness)smoke tests\n')

  const featureFlags = await import(repoRoot + 'src/utils/featureFlags.js')
  const discovery = await import(repoRoot + 'src/services/kb/kbDiscovery.js')
  const connStore = await import(repoRoot + 'src/services/kb/connectionStore.js')
  connStore._resetForTest && connStore._resetForTest()
  featureFlags.setFlag('kbRemoteIntegration', true)

  // 组件实际消费面:services.kb.kbDiscovery(经 services/index.js named-export 展开)。
  // 回归护栏:组件调 kbDiscovery.ensureHarnessConnection / discoverHarnessKb,
  // 门面键名错位在此即断(2026-10-03 实测:面板静默发现因此静默失效)
  const services = await import(repoRoot + 'src/services/index.js')
  const facade = services.kb?.kbDiscovery
  assert('services.kb.kbDiscovery 门面暴露发现函数',
    typeof facade?.ensureHarnessConnection === 'function'
    && typeof facade?.discoverHarnessKb === 'function'
    && typeof facade?.isChatop === 'function')
  assert('services.kb.healthProbe/kbCatalog 可达',
    typeof services.kb?.healthProbe?.run === 'function'
    && typeof services.kb?.kbCatalog?.fetchList === 'function')

  // 指纹判定
  assert('isChatopStatus 接受 ok+kbs', discovery.isChatopStatus({ ok: true, kbs: [] }))
  assert('isChatopStatus 拒绝非 chatop 形状',
    !discovery.isChatopStatus({ ok: true }) && !discovery.isChatopStatus({ ok: true, kbs: 'x' })
    && !discovery.isChatopStatus(null))

  // -------- 1. 并行端口梯探测 + 指纹 --------
  resetFetch()
  serveChatop('http://127.0.0.1:52599')
  const found = await discovery.discoverHarnessKb({
    force: true,
    candidates: [
      { url: 'http://127.0.0.1:52598', apiPrefix: '' },   // 噪声:404
      { url: 'http://127.0.0.1:52599', apiPrefix: '' },   // 命中
      { url: 'http://127.0.0.1:52600', apiPrefix: '' }    // 噪声
    ],
    timeoutMs: 800
  })
  assert('discover 端口梯命中并带指纹', !!found && found.baseUrl === 'http://127.0.0.1:52599' && found.source === 'probe',
    JSON.stringify(found && { baseUrl: found.baseUrl, source: found.source }))
  assert('discover kbCount 来自 /status', found?.kbCount === 1, String(found?.kbCount))

  // -------- 2. 缓存优先 + force 跳缓存 --------
  serveChatop('http://127.0.0.1:52601')   // 只服务新地址:旧缓存地址 52599 不再响应
  const cached = await discovery.discoverHarnessKb({ timeoutMs: 800 })
  assert('缓存地址失配 → 回落端口梯', !!cached && cached.baseUrl === 'http://127.0.0.1:52601' && cached.source === 'probe',
    JSON.stringify(cached && { baseUrl: cached.baseUrl, source: cached.source }))

  serveChatop('http://127.0.0.1:52601')
  const cached2 = await discovery.discoverHarnessKb({ timeoutMs: 800 })
  assert('缓存命中 source=cached', !!cached2 && cached2.source === 'cached' && cached2.baseUrl === 'http://127.0.0.1:52601',
    JSON.stringify(cached2 && { source: cached2.source }))
  assert('缓存命中不再全梯扫描', _fetchLog.every(u => u.startsWith('http://127.0.0.1:52601')),
    JSON.stringify(_fetchLog.slice(0, 3)))

  // 手动指定优先
  serveChatop('http://127.0.0.1:52602')
  const manual = await discovery.discoverHarnessKb({ explicitBaseUrl: 'http://127.0.0.1:52602', timeoutMs: 800 })
  assert('explicitBaseUrl 手动优先', !!manual && manual.source === 'manual' && manual.baseUrl === 'http://127.0.0.1:52602')

  // -------- 3. ensureHarnessConnection 动态接入 --------
  connStore._resetForTest && connStore._resetForTest()
  serveChatop('http://127.0.0.1:52599')
  const r1 = await discovery.ensureHarnessConnection({
    candidates: [{ url: 'http://127.0.0.1:52599', apiPrefix: '' }], timeoutMs: 800
  })
  assert('首次发现 → added', r1.ok && r1.action === 'added', r1.action)
  assert('稳定连接 id + serviceType=chatop + authMode=none',
    r1.connection?.id === discovery.HARNESS_CONNECTION_ID
    && r1.connection?.serviceType === 'chatop'
    && r1.connection?.authMode === 'none')
  assert('健康快照带 kbCount', r1.connection?.healthSnapshot?.ok === true && r1.connection?.healthSnapshot?.kbCount >= 1)

  const r2 = await discovery.ensureHarnessConnection({
    candidates: [{ url: 'http://127.0.0.1:52599', apiPrefix: '' }], timeoutMs: 800
  })
  assert('重复发现 → ok(不重建)', r2.ok && r2.action === 'ok', r2.action)

  // harness 重启端口顺延:52599 → 52601
  serveChatop('http://127.0.0.1:52601')
  const r3 = await discovery.ensureHarnessConnection({
    candidates: [{ url: 'http://127.0.0.1:52601', apiPrefix: '' }], timeoutMs: 800
  })
  assert('端口漂移 → updated 且 baseUrl 跟随', r3.ok && r3.action === 'updated'
    && r3.connection?.baseUrl === 'http://127.0.0.1:52601', `${r3.action} ${r3.connection?.baseUrl}`)

  // 服务失联:连接保留,健康快照标记
  resetFetch()
  const r4 = await discovery.ensureHarnessConnection({
    candidates: [{ url: 'http://127.0.0.1:52599', apiPrefix: '' }], timeoutMs: 600
  })
  const kept = connStore.getConnection(discovery.HARNESS_CONNECTION_ID)
  assert('失联 → missing 且连接保留', !r4.ok && r4.action === 'missing' && !!kept)
  assert('失联健康快照 ok=false', kept?.healthSnapshot?.ok === false, JSON.stringify(kept?.healthSnapshot))

  // -------- 4. healthProbe chatop 分支 --------
  const healthProbe = await import(repoRoot + 'src/services/kb/healthProbe.js')
  serveChatop('http://127.0.0.1:52599')
  const chatopConn = {
    id: 't1', name: 't', baseUrl: 'http://127.0.0.1:52599', authMode: 'none', serviceType: 'chatop'
  }
  const hp = await healthProbe.run(chatopConn)
  assert('healthProbe chatop 三步全通', hp.ok && hp.steps.length === 3
    && hp.steps[0].name === 'service' && hp.steps[1].name === 'cred' && hp.steps[2].name === 'kb',
    JSON.stringify(hp.steps.map(s => [s.name, s.ok])))
  assert('healthProbe chatop summary 库数/身份', hp.summary?.kbCount === 2 && hp.summary?.subjectKind === 'local'
    && Array.isArray(hp.summary?.kbNames) && hp.summary.kbNames.includes('产品手册'),
    JSON.stringify(hp.summary))

  const hpDown = await healthProbe.run({ ...chatopConn, baseUrl: 'http://127.0.0.1:59999' })
  assert('服务不在 → 失败带提示', !hpDown.ok && !!hpDown.hint && String(hpDown.hint).includes('52582'))

  // dsh 管理面形态(带 apiPrefix)
  serveChatop('http://127.0.0.1:52599', 'http://127.0.0.1:52584')
  const hpPrefix = await healthProbe.run({ ...chatopConn, baseUrl: 'http://127.0.0.1:52584', apiPrefix: '/api/chatop-kb' })
  assert('dsh 管理面 apiPrefix 拼接生效', hpPrefix.ok, JSON.stringify(hpPrefix.steps.map(s => [s.name, s.ok, s.error || ''])))

  // -------- 5. kbCatalog chatop 分支 --------
  const kbCatalog = await import(repoRoot + 'src/services/kb/kbCatalog.js')
  serveChatop('http://127.0.0.1:52599')
  const list = await kbCatalog.fetchList(chatopConn, { force: true })
  assert('chatop 列表归一 id/fileCount/role',
    list.length === 2 && list[0].id === 'default' && list[0].fileCount === 3
    && list[0].role === 'owner' && list[1].name === '产品手册',
    JSON.stringify(list.map(x => [x.id, x.fileCount])))
  const tree = await kbCatalog.fetchTree(chatopConn, { force: true })
  assert('chatop 树单组「察元 Harness(本机)」',
    tree.length === 1 && tree[0].name === '察元 Harness(本机)' && tree[0].children?.length === 2,
    JSON.stringify(tree.map(g => [g.name, g.children?.length])))

  // -------- 6. searchOrchestrator chatop 分支 --------
  const orchestrator = await import(repoRoot + 'src/services/kb/searchOrchestrator.js')
  const out = await orchestrator.run({
    connection: chatopConn,
    query: '入职流程是什么',
    kbBindings: { kuIds: ['doc:default', 'doc:产品手册'], topK: 6 },
    mode: 'qa'
  })
  assert('chatop 检索返回命中', Array.isArray(out.chunks) && out.chunks.length > 0, String(out.chunks?.length))
  const c0 = out.chunks[0]
  assert('命中归一:chunk_id/file_name/kb_name',
    String(c0.chunk_id).startsWith('default::') && c0.file_name === '入职工册.docx' && c0.kb_name === 'default',
    JSON.stringify([c0.chunk_id, c0.file_name]))
  assert('多库检索覆盖 doc: 前缀剥离',
    out.chunks.some(c => c.kb_name === '产品手册') && _fetchLog.some(u => u.includes('kbId=' + encodeURIComponent('产品手册'))),
    JSON.stringify(_fetchLog.filter(u => u.includes('/search')).map(u => decodeURIComponent(u.split('kbId=')[1] || '').split('&')[0])))
  assert('命中带名次折算分', typeof c0.score === 'number' && c0.score > 0 && c0.score <= 1, String(c0.score))

  // ---- 总结 ----
  console.log()
  console.log(`通过 ${passes} 项 / 失败 ${failures} 项`)
  if (failures > 0) process.exit(1)
}

main().catch((e) => {
  console.error('测试脚本异常:', e)
  process.exit(2)
})
