#!/usr/bin/env node
/* eslint-env node, browser, es2021 */
/**
 * 网络资源搜索 + 三级生图 Tier2 搜图链 smoke test。
 *
 * 覆盖：
 *   1. 资源清单目录（10 项、分组、搜图可用性标记）
 *   2. 用户配置持久化（globalSettings webResources namespace）+ 合并视图
 *   3. collectEnabledResources 过滤（enabled + 凭据）
 *   4. syncWebResourcesToSidecar（mock sidecar /web-resources/config）
 *   5. testWebResource（mock sidecar /web-resources/test → tested 落库）
 *   6. sidecar 适配器：probeResource 真实请求形态（mock fetch）+ 配置落盘回读
 *   7. 搜图执行链：keyed 优先 → 免 Key 兜底；imageSearchTool 下载落盘
 *   8. agentImageTier Tier1 边界（bad-input / no-model）
 *
 * 跑法：node scripts/test-web-resources-smoke.mjs
 */

// ---- 浏览器全局 mock（同 test-kb-discovery-smoke 约定）----
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
globalThis.document = globalThis.document || {
  addEventListener: () => {}, removeEventListener: () => {}, visibilityState: 'visible',
}
globalThis.window.addEventListener = globalThis.window.addEventListener || (() => {})
globalThis.window.removeEventListener = globalThis.window.removeEventListener || (() => {})
globalThis.window.matchMedia = globalThis.window.matchMedia || (() => ({
  matches: false, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {},
}))
try { if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node-smoke' } } catch { /* node22 只读 */ }

// fetch mock：按 URL 规则应答；测试里用 setFetchRules 覆盖
let _rules = []
let _log = []
globalThis.fetch = async (url, opts = {}) => {
  _log.push({ url: String(url), method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body || '' })
  for (const rule of _rules) {
    if (rule.match.test(String(url))) return rule.respond(String(url), opts)
  }
  return new Response(JSON.stringify({ ok: false }), { status: 404 })
}
const setFetchRules = (rules) => { _rules = rules; _log = [] }
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' }
})

const repoRoot = new URL('..', import.meta.url).href
let failures = 0
let passes = 0
function assert(name, cond, detail = '') {
  if (cond) { console.log(`✓ ${name}`); passes += 1 }
  else { console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); failures += 1 }
}

async function main() {
  console.log('网络资源搜索 + 三级生图 smoke tests\n')

  const webResources = await import(repoRoot + 'src/services/webResources/index.js')

  // -------- 1. 清单目录 --------
  const catalog = webResources.WEB_RESOURCE_CATALOG
  assert('清单 10 项资源', catalog.length === 10, String(catalog.length))
  assert('分组齐全（web/stock/keyless）',
    ['serper', 'tavily', 'linkup', 'searxng'].every(id => catalog.find(r => r.id === id)?.kind === 'web')
    && ['pexels', 'pixabay', 'unsplash'].every(id => catalog.find(r => r.id === id)?.kind === 'stock')
    && ['bing', 'openverse', 'duckduckgo'].every(id => catalog.find(r => r.id === id)?.kind === 'keyless'))
  assert('搜图可用性标记（serper/bing 可搜图，linkup/duckduckgo 不可）',
    catalog.find(r => r.id === 'serper')?.imageSearch === true
    && catalog.find(r => r.id === 'bing')?.imageSearch === true
    && catalog.find(r => r.id === 'linkup')?.imageSearch === false
    && catalog.find(r => r.id === 'duckduckgo')?.imageSearch === false)
  assert('每项都有默认地址与说明',
    catalog.every(r => typeof r.defaultBaseUrl === 'string' && !!r.docsZh))

  // -------- 2. 配置持久化 + 合并视图 --------
  let list = webResources.listWebResources()
  assert('默认全未启用、无 Key', list.length === 10 && list.every(r => !r.enabled && !r.apiKey))
  list = webResources.saveWebResource('serper', { enabled: true, apiKey: 'sk-serper-test' })
  list = webResources.saveWebResource('pexels', { enabled: true, apiKey: 'pexels-key' })
  list = webResources.saveWebResource('searxng', { enabled: true, baseUrl: 'https://searx.example.com' })
  const serper = list.find(r => r.id === 'serper')
  assert('保存后合并视图带 enabled/apiKey',
    serper.enabled === true && serper.apiKey === 'sk-serper-test' && serper.defaultBaseUrl === 'https://google.serper.dev')

  // -------- 3. 启用清单过滤 --------
  const enabled = webResources.collectEnabledResources()
  assert('启用清单按目录顺序输出且带凭据',
    enabled.length === 3
    && enabled[0].id === 'serper' && enabled[0].apiKey === 'sk-serper-test'
    && enabled[1].id === 'searxng' && enabled[1].baseUrl === 'https://searx.example.com'
    && enabled[2].id === 'pexels', JSON.stringify(enabled.map(x => x.id)))

  // -------- 4. 同步到 sidecar --------
  setFetchRules([
    {
      match: /\/token(\?|$)/,
      respond: () => jsonResponse({ token: 'smoke-token' })
    },
    {
      match: /\/web-resources\/config$/,
      respond: (url, opts) => {
        const body = JSON.parse(opts.body || '{}')
        return jsonResponse({ ok: true, count: body.providers?.length ?? 0 })
      }
    }
  ])
  const sync = await webResources.syncWebResourcesToSidecar()
  assert('同步 sidecar 成功且带 3 项启用清单', sync.synced === true, JSON.stringify(sync))
  const cfgCall = _log.find(l => l.url.endsWith('/web-resources/config'))
  assert('同步请求带 token 头与清单体',
    !!cfgCall && !!cfgCall.headers['X-Chayuan-Token'] && JSON.parse(cfgCall.body).providers.length === 3,
    JSON.stringify(cfgCall))

  // -------- 5. 测活 --------
  setFetchRules([
    {
      match: /\/web-resources\/test$/,
      respond: () => jsonResponse({ ok: true, latencyMs: 233, sample: 'https://img.example.com/x.jpg' })
    }
  ])
  const testRes = await webResources.testWebResource('serper')
  assert('测活返回时延并落库 tested',
    testRes.ok === true && testRes.latencyMs >= 0
    && webResources.listWebResources().find(r => r.id === 'serper')?.tested?.ok === true)

  // -------- 6. sidecar 适配器（真实 fetch 形态）--------
  const wr = await import(repoRoot + 'mcp-sidecar/lib/webResources.mjs')
  setFetchRules([
    {
      match: /google\.serper\.dev\/images/,
      respond: () => jsonResponse({ images: [{ imageUrl: 'https://img.cdn/1.jpg', title: 'a' }] })
    },
    { match: /api\.pexels\.com/, respond: () => jsonResponse({ photos: [{ src: { large: 'https://img.cdn/p.jpg' }, alt: 'p' }] }) }
  ])
  const probe1 = await wr.probeResource('serper', { apiKey: 'k', baseUrl: 'https://google.serper.dev' })
  assert('probe serper 连通（POST + X-API-KEY）',
    probe1.ok === true && /X-API-KEY/.test(JSON.stringify(_log[0].headers)), JSON.stringify(probe1))
  const probe2 = await wr.probeResource('pexels', { apiKey: 'pk', baseUrl: 'https://api.pexels.com' })
  assert('probe pexels 连通（Authorization 头）',
    probe2.ok === true && /pexels-key|pk/.test(JSON.stringify(_log.find(l => /pexels/.test(l.url))?.headers || {})))

  // 配置落盘回读
  const os = await import('node:os')
  const fs = await import('node:fs')
  const path = await import('node:path')
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-smoke-'))
  wr.saveWebResourcesConfig(tmpDataDir, {
    providers: [
      { id: 'serper', apiKey: 'sk-1', baseUrl: 'https://google.serper.dev' },
      { id: 'bogus', apiKey: 'x', baseUrl: '' }
    ]
  })
  const loaded = wr.loadWebResourcesConfig(tmpDataDir)
  assert('web-resources.json 落盘并剔除未知资源',
    loaded.providers.length === 1 && loaded.providers[0].id === 'serper')

  // -------- 7. 搜图执行链 --------
  const IMG_JPG = new Uint8Array(4096).fill(0xaa); IMG_JPG[0] = 0xff; IMG_JPG[1] = 0xd8
  const IMG_PNG = new Uint8Array(4096).fill(0xbb); IMG_PNG[0] = 0x89; IMG_PNG[1] = 0x50
  // serper 命中 → 链首即返回
  setFetchRules([
    { match: /google\.serper\.dev\/images/, respond: () => jsonResponse({ images: [{ imageUrl: 'https://img.cdn/hit.jpg' }] }) },
    { match: /img\.cdn\/hit\.jpg/, respond: () => new Response(IMG_JPG, { status: 200 }) }
  ])
  const chain1 = await wr.searchWebImages(tmpDataDir, '测试图', 3)
  assert('搜图链 keyed 优先（serper 命中）',
    chain1.ok === true && chain1.origin === 'serper' && chain1.candidates[0].url === 'https://img.cdn/hit.jpg',
    JSON.stringify(chain1))

  // keyed 全败 → searchWebImages 如实 ok:false（免 Key 兜底在 imageTools 层）
  setFetchRules([
    { match: /google\.serper\.dev\/images/, respond: () => jsonResponse({}, 500) },
    { match: /searx\.example\.com/, respond: () => jsonResponse({}, 500) },
    { match: /api\.pexels\.com/, respond: () => jsonResponse({}, 500) }
  ])
  const chain2 = await wr.searchWebImages(tmpDataDir, '测试图', 3)
  assert('keyed 全败 → ok:false 且错误逐项记录',
    chain2.ok === false && chain2.candidates.length === 0 && chain2.errors.some(x => x.includes('serper')),
    JSON.stringify(chain2))

  // imageTools.imageSearchTool：资源链命中 → 下载 → 本地路径
  const imageTools = await import(repoRoot + 'mcp-sidecar/lib/imageTools.mjs')
  setFetchRules([
    { match: /google\.serper\.dev\/images/, respond: () => jsonResponse({ images: [{ imageUrl: 'https://img.cdn/tool.jpg' }] }) },
    { match: /img\.cdn\/tool\.jpg/, respond: () => new Response(IMG_JPG, { status: 200 }) }
  ])
  const tool = await imageTools.imageSearchTool(tmpDataDir, { query: '山景', count: 2 })
  assert('image_search 工具经资源链命中并落盘',
    tool.ok === true && tool.origin === 'serper' && fs.existsSync(tool.path),
    JSON.stringify({ ok: tool.ok, origin: tool.origin, errors: tool.errors }))

  // 资源链全败 → image_search 免 Key 必应兜底（三级生图 Tier2 不断链）
  setFetchRules([
    { match: /google\.serper\.dev\/images/, respond: () => jsonResponse({}, 500) },
    { match: /cn\.bing\.com\/images\/search/, respond: () => new Response('murl&quot;:&quot;https://img.bing/f.jpg&quot;', { status: 200 }) },
    { match: /img\.bing\/f\.jpg/, respond: () => new Response(IMG_PNG, { status: 200 }) }
  ])
  const tool2 = await imageTools.imageSearchTool(tmpDataDir, { query: '海景', count: 2 })
  assert('资源链全败 → 必应免 Key 兜底命中',
    tool2.ok === true && tool2.origin === 'bing' && fs.existsSync(tool2.path),
    JSON.stringify({ ok: tool2.ok, origin: tool2.origin, errors: tool2.errors }))

  // -------- 8. Tier1 边界 --------
  const tier = await import(repoRoot + 'src/services/imagery/agentImageTier.js')
  const bad = await tier.generateImageViaModelChain({ prompt: '' })
  assert('Tier1 空 prompt 拒绝', bad.ok === false && bad.reason === 'bad-input')
  const noModel = await tier.generateImageViaModelChain({ prompt: '一只猫' })
  assert('Tier1 未配置模型 → ok:false（交由 sidecar 原生通道/降级链）',
    noModel.ok === false && noModel.reason === 'no-model', JSON.stringify(noModel))

  // ---- 总结 ----
  console.log()
  console.log(`通过 ${passes} 项 / 失败 ${failures} 项`)
  fs.rmSync(tmpDataDir, { recursive: true, force: true })
  if (failures > 0) process.exit(1)
}

main().catch((e) => {
  console.error('测试脚本异常:', e)
  process.exit(2)
})
