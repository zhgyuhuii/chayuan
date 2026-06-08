#!/usr/bin/env node
/* eslint-env node, es2021 */
/**
 * 桌面版融合 smoke test：desktopStore / desktopProbe / 本地组注入 / 本地路由 / 空闲超时。
 * 跑法：node scripts/test-desktop-integration-smoke.mjs
 */
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
globalThis.window = globalThis.window || {}
globalThis.window.localStorage = _mockLocal
globalThis.localStorage = _mockLocal
globalThis.document = globalThis.document || { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' }
try { if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node-smoke' } } catch (_) { /* ignore */ }

let _fetchHandler = async () => new Response('{}', { status: 500 })
globalThis.fetch = (url, init) => _fetchHandler(String(url), init)
const setFetchHandler = (fn) => { _fetchHandler = fn }

const repoRoot = new URL('..', import.meta.url).href
let failures = 0, passes = 0
function assert(name, cond, detail = '') {
  if (cond) { console.log(`✓ ${name}`); passes += 1 }
  else { console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); failures += 1 }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  console.log('Desktop integration smoke tests\n')

  const store = await import(repoRoot + 'src/services/desktop/desktopStore.js')
  const probe = await import(repoRoot + 'src/services/desktop/desktopProbe.js')
  const chatApi = await import(repoRoot + 'src/utils/chatApi.js')
  const modelSettings = await import(repoRoot + 'src/utils/modelSettings.js')
  const connStore = await import(repoRoot + 'src/services/kb/connectionStore.js')

  // 1) parseLocalChatModels：runtime 与 platform_name 两种形态 + 过滤云端/不可用
  const parsed = probe.parseLocalChatModels({ data: [
    { id: 'qwen-7b', name: 'Qwen 7B', runtime: 'llamacpp', category: 'llm', available: true },
    { id: 'local-x', display_name: 'Local X', platform_name: 'local-chat', model_type: 'llm' },
    { id: 'gpt-4o', name: 'GPT-4o', runtime: 'openai', category: 'llm', available: true },
    { id: 'broke', name: 'B', runtime: 'llamacpp', category: 'llm', status: 'broken' },
    { id: 'embed', name: 'E', runtime: 'llamacpp', category: 'embed' }
  ] })
  assert('parseLocalChatModels 只取本地对话且可用', parsed.length === 2, JSON.stringify(parsed))
  assert('parseLocalChatModels 取 display_name 优先', parsed.find(m => m.id === 'local-x')?.name === 'Local X')

  // 2) detect 在线：写 store + 建连接
  connStore._resetForTest()
  store._resetForTest()
  setFetchHandler(async (url) => {
    if (url.endsWith('/healthz')) return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    if (url.endsWith('/v1/models')) return new Response(JSON.stringify({ data: [
      { id: 'qwen-7b', name: 'Qwen 7B', runtime: 'llamacpp', category: 'llm', available: true }
    ] }), { status: 200 })
    return new Response('{}', { status: 404 })
  })
  const st = await probe.detect({ timeoutMs: 1000 })
  assert('detect 在线 online=true', st.online === true)
  assert('detect 解析出 1 个本地模型', st.localModels.length === 1, JSON.stringify(st.localModels))
  assert('detect 建了桌面版 KB 连接', connStore.listConnections().some(c => c.id === 'kb-conn-desktop-local' && c.authMode === 'none'))
  assert('detect 当前连接=桌面版', connStore.getCurrentConnection()?.id === 'kb-conn-desktop-local')

  // 3) 本地组注入到对话分组
  const groups = modelSettings.getModelGroupsFromSettings('chat')
  const localGroup = groups.find(g => g.providerId === store.DESKTOP_LOCAL_PROVIDER_ID)
  assert('对话分组含本地模型组', !!localGroup)
  assert('本地组 compositeId 形态正确', localGroup?.models?.[0]?.id === `${store.DESKTOP_LOCAL_PROVIDER_ID}|qwen-7b`)

  // 4) 本地模型聊天路由
  const cfg = chatApi.getChatApiConfigByProvider(store.DESKTOP_LOCAL_PROVIDER_ID, 'qwen-7b')
  assert('本地路由到 62581/v1/chat/completions', cfg?.apiUrl === 'http://127.0.0.1:62581/v1/chat/completions', cfg?.apiUrl)
  assert('本地路由 model 原样', cfg?.model === 'qwen-7b')

  // 5) detect 离线：清空本地模型，组消失
  setFetchHandler(async () => { throw new Error('offline') })
  const off = await probe.detect({ timeoutMs: 500 })
  assert('detect 离线 online=false', off.online === false)
  assert('离线时本地模型为空', store.getLocalModels().length === 0)
  assert('离线时对话分组无本地组', !modelSettings.getModelGroupsFromSettings('chat').some(g => g.providerId === store.DESKTOP_LOCAL_PROVIDER_ID))

  // 6) 空闲超时：持续 notifyActivity 不超时；停止后超时
  const ab = chatApi.createRequestAbortSignal(null, 60, 5000) // idle=60ms, hard=5s
  let kept = true
  for (let i = 0; i < 8; i++) { await sleep(20); ab.notifyActivity(); if (ab.signal.aborted) kept = false }
  assert('持续活动期间不空闲超时', kept && !ab.signal.aborted)
  await sleep(120)
  assert('停止活动后空闲超时触发', ab.signal.aborted && ab.isTimeout())
  ab.cleanup()

  // 7) 空闲超时不设硬上限误杀：hard 远大于 idle
  const ab2 = chatApi.createRequestAbortSignal(null, 40, 100000)
  await sleep(80)
  assert('无活动超过 idle 即中断(与 hard 无关)', ab2.signal.aborted && ab2.isTimeout())
  ab2.cleanup()

  console.log(`\n${passes} passed, ${failures} failed`)
  process.exit(failures ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
