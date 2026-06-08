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

  const PREFIX = store.DESKTOP_PROVIDER_PREFIX

  // 1) parseDesktopChatModels：取全部对话模型(云端+本地)；本地归入 group='local'，云端用平台名；过滤不可用
  const parsed = probe.parseDesktopChatModels({ data: [
    { id: 'qwen-7b', name: 'Qwen 7B', runtime: 'llamacpp', category: 'llm', available: true },
    { id: 'local-x', display_name: 'Local X', platform_name: 'local-chat', model_type: 'llm' },
    { id: 'deepseek-chat', name: 'DeepSeek', platform_name: 'deepseek', model_type: 'llm', available: true },
    { id: 'broke', name: 'B', runtime: 'llamacpp', category: 'llm', status: 'broken' },
    { id: 'embed', name: 'E', runtime: 'llamacpp', category: 'embed' }
  ] })
  assert('parseDesktopChatModels 取全部可用对话(含云端)', parsed.length === 3, JSON.stringify(parsed))
  assert('本地模型归入 group=local', parsed.filter(m => m.group === 'local').length === 2)
  assert('云端模型 group=平台名', parsed.find(m => m.id === 'deepseek-chat')?.group === 'deepseek')
  assert('parseDesktopChatModels 取 display_name 优先', parsed.find(m => m.id === 'local-x')?.name === 'Local X')
  assert('parseDesktopChatModels 过滤掉云端? 不,云端要保留', parsed.some(m => m.id === 'deepseek-chat'))

  // 2) detect 在线：写 store(全部模型) + 建连接
  connStore._resetForTest()
  store._resetForTest()
  setFetchHandler(async (url) => {
    if (url.endsWith('/healthz')) return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    if (url.endsWith('/v1/models')) return new Response(JSON.stringify({ data: [
      { id: 'qwen-7b', name: 'Qwen 7B', runtime: 'llamacpp', category: 'llm', available: true },
      { id: 'deepseek-chat', name: 'DeepSeek Chat', platform_name: 'deepseek', model_type: 'llm', available: true }
    ] }), { status: 200 })
    return new Response('{}', { status: 404 })
  })
  const st = await probe.detect({ timeoutMs: 1000 })
  assert('detect 在线 online=true', st.online === true)
  assert('detect 解析出 2 个模型(本地+云端)', st.models.length === 2, JSON.stringify(st.models))
  assert('detect 建了桌面版 KB 连接', connStore.listConnections().some(c => c.id === 'kb-conn-desktop-local' && c.authMode === 'none'))
  assert('detect 当前连接=桌面版', connStore.getCurrentConnection()?.id === 'kb-conn-desktop-local')

  // 3) 注入按平台分组：本地一组 + deepseek 一组
  const groups = modelSettings.getModelGroupsFromSettings('chat')
  const localGroup = groups.find(g => g.providerId === `${PREFIX}local`)
  const deepseekGroup = groups.find(g => g.providerId === `${PREFIX}deepseek`)
  assert('对话分组含本地模型组', !!localGroup)
  assert('对话分组含 deepseek 镜像组', !!deepseekGroup)
  assert('本地组标签为 本地模型', localGroup?.label === '察元桌面版 · 本地模型', localGroup?.label)
  assert('本地组 compositeId 形态正确', localGroup?.models?.[0]?.id === `${PREFIX}local|qwen-7b`)
  assert('deepseek 组 compositeId 形态正确', deepseekGroup?.models?.[0]?.id === `${PREFIX}deepseek|deepseek-chat`)
  const modelLogos = await import(repoRoot + 'src/utils/modelLogos.js')
  assert('本地组图标=系统 logo', modelLogos.getModelLogoPath(`${PREFIX}local`) === 'images/logo-avatar.png', modelLogos.getModelLogoPath(`${PREFIX}local`))
  assert('deepseek 组图标=deepseek 平台 logo', modelLogos.getModelLogoPath(`${PREFIX}deepseek`) === modelLogos.getModelLogoPath('deepseek'), modelLogos.getModelLogoPath(`${PREFIX}deepseek`))

  // 4) 任意 desktop 模型聊天都路由到 62581(本地 + 云端镜像)
  const cfgLocal = chatApi.getChatApiConfigByProvider(`${PREFIX}local`, 'qwen-7b')
  assert('本地路由到 62581/v1/chat/completions', cfgLocal?.apiUrl === 'http://127.0.0.1:62581/v1/chat/completions', cfgLocal?.apiUrl)
  assert('本地路由 model 原样', cfgLocal?.model === 'qwen-7b')
  const cfgCloud = chatApi.getChatApiConfigByProvider(`${PREFIX}deepseek`, 'deepseek-chat')
  assert('云端镜像也路由到 62581(免 WPS 端 key)', cfgCloud?.apiUrl === 'http://127.0.0.1:62581/v1/chat/completions' && cfgCloud?.apiKey === '', JSON.stringify(cfgCloud))
  assert('云端镜像 model 原样', cfgCloud?.model === 'deepseek-chat')

  // 5) detect 离线：清空模型，所有 desktop 组消失
  setFetchHandler(async () => { throw new Error('offline') })
  const off = await probe.detect({ timeoutMs: 500 })
  assert('detect 离线 online=false', off.online === false)
  assert('离线时模型清单为空', store.getDesktopModels().length === 0)
  assert('离线时对话分组无任何 desktop 组', !modelSettings.getModelGroupsFromSettings('chat').some(g => store.isDesktopProviderId(g.providerId)))

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
