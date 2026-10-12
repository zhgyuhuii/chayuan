/**
 * webResources — 网络资源搜索注册表（设置：默认设置 → 网络资源搜索）
 *
 * 清单参考 chayuan-office capability-tree SEARCH_PLATFORMS（生图、媒体与搜索），
 * 按察元 WPS 的三级生图链定位：
 *   Tier 1 模型生图（设置→模型设置·图像生成）
 *   Tier 2 网络搜图 ← 本清单（keyed 资源优先，免 Key 兜底）
 *   Tier 3 大模型 SVG 矢量兜底（svg_add）
 *
 * 数据面：
 *   - 清单 = 内置 catalog + 用户配置（globalSettings `webResources` namespace：
 *     {enabled, apiKey, baseUrl, tested}）
 *   - 测活/搜图在 mcp-sidecar（Node 侧执行，无 CORS、密钥不出本机）：
 *     POST /web-resources/test、/web-resources/config（配置落盘 dataDir/
 *     web-resources.json 供 image_search 工具消费）
 */

import { loadGlobalSettings, saveGlobalSettings } from '../../utils/globalSettings.js'
import { sidecarPost } from '../mcpBridge/mcpHttpClient.js'

const NAMESPACE = 'webResources'
const SCHEMA_VERSION = 1

/**
 * 内置网络资源清单。
 * kind: 'web' 网页搜索 | 'stock' 图片图库 | 'keyless' 免 Key 兜底
 * imageSearch: 可供三级生图 Tier2 搜图使用
 * needsKey: 需要 API Key（searxng 的 key 位填实例地址）
 * defaultBaseUrl: API 根地址（可在设置中覆盖，searxng 必填实例地址）
 * free: 免 Key 恒可用
 */
export const WEB_RESOURCE_CATALOG = [
  {
    id: 'serper',
    label: 'Serper',
    kind: 'web',
    imageSearch: true,
    needsKey: true,
    keyUrl: 'https://serper.dev/api-key',
    defaultBaseUrl: 'https://google.serper.dev',
    docsZh: 'Google 搜索结果 API（网页+图片），速度快，免费额度 2500 次/月。',
    color: '#4285f4'
  },
  {
    id: 'tavily',
    label: 'Tavily',
    kind: 'web',
    imageSearch: true,
    needsKey: true,
    keyUrl: 'https://app.tavily.com/home',
    defaultBaseUrl: 'https://api.tavily.com',
    docsZh: '为 AI 优化的网页搜索 API，可携带图片结果，返回直接答案与摘要。',
    color: '#3b82f6'
  },
  {
    id: 'linkup',
    label: 'Linkup',
    kind: 'web',
    imageSearch: false,
    needsKey: true,
    keyUrl: 'https://linkup.so/profile-api',
    defaultBaseUrl: 'https://api.linkup.so',
    docsZh: '欧洲网页搜索 API，提供来源标注的搜索结果。',
    color: '#8b5cf6'
  },
  {
    id: 'searxng',
    label: 'SearXNG',
    kind: 'web',
    imageSearch: true,
    needsKey: true,
    keyUrl: 'https://docs.searxng.org/',
    defaultBaseUrl: '',
    docsZh: '自建元搜索引擎：服务地址填实例根地址（如 https://searx.example.com），无需 Key。',
    color: '#0ea5e9'
  },
  {
    id: 'pexels',
    label: 'Pexels',
    kind: 'stock',
    imageSearch: true,
    needsKey: true,
    keyUrl: 'https://www.pexels.com/api/',
    defaultBaseUrl: 'https://api.pexels.com',
    docsZh: '高质量免费图库（照片/视频），免费 Key 即可用。',
    color: '#05a081'
  },
  {
    id: 'pixabay',
    label: 'Pixabay',
    kind: 'stock',
    imageSearch: true,
    needsKey: true,
    keyUrl: 'https://pixabay.com/api/docs/',
    defaultBaseUrl: 'https://pixabay.com',
    docsZh: '免费图片/插画/矢量图库，内容安全可商用。',
    color: '#2ec66d'
  },
  {
    id: 'unsplash',
    label: 'Unsplash',
    kind: 'stock',
    imageSearch: true,
    needsKey: true,
    keyUrl: 'https://unsplash.com/developers',
    defaultBaseUrl: 'https://api.unsplash.com',
    docsZh: '高清摄影图库，需 Access Key（免费档 50 次/小时）。',
    color: '#d96c47'
  },
  {
    id: 'bing',
    label: '必应图片',
    kind: 'keyless',
    imageSearch: true,
    needsKey: false,
    defaultBaseUrl: 'https://cn.bing.com',
    docsZh: '免 Key 图片搜索（解析必应图片原图直链），国内可达，三级生图默认兜底。',
    color: '#0f766e'
  },
  {
    id: 'openverse',
    label: 'Openverse',
    kind: 'keyless',
    imageSearch: true,
    needsKey: false,
    defaultBaseUrl: 'https://api.openverse.org',
    docsZh: 'WordPress 开源 CC 授权图库，免 Key，海外网络可达。',
    color: '#7c3aed'
  },
  {
    id: 'duckduckgo',
    label: 'DuckDuckGo',
    kind: 'keyless',
    imageSearch: false,
    needsKey: false,
    defaultBaseUrl: 'https://duckduckgo.com',
    docsZh: '免 Key 网页搜索（内置兜底，隐私优先）。',
    color: '#de5833'
  }
]

function _read() {
  const all = loadGlobalSettings() || {}
  const raw = all[NAMESPACE]
  if (!raw || raw.version !== SCHEMA_VERSION) {
    return { version: SCHEMA_VERSION, providers: {}, updatedAt: null }
  }
  return raw
}

function _write(state) {
  const all = loadGlobalSettings() || {}
  all[NAMESPACE] = { ...state, updatedAt: new Date().toISOString() }
  saveGlobalSettings(all)
  return all[NAMESPACE]
}

/** 清单 + 用户配置合并后的完整视图（组件直接渲染这个） */
export function listWebResources() {
  const cfg = _read()
  return WEB_RESOURCE_CATALOG.map(meta => {
    const saved = cfg.providers?.[meta.id] || {}
    return {
      ...meta,
      enabled: saved.enabled === true,
      apiKey: String(saved.apiKey || ''),
      baseUrl: String(saved.baseUrl || ''),
      tested: saved.tested || null
    }
  })
}

export function getWebResourceConfig(id) {
  return _read().providers?.[id] || {}
}

/** 保存单个资源配置（enabled/apiKey/baseUrl/tested 任意子集），返回合并视图 */
export function saveWebResource(id, patch) {
  if (!WEB_RESOURCE_CATALOG.some(r => r.id === id)) throw new Error(`未知网络资源: ${id}`)
  const state = _read()
  const prev = state.providers?.[id] || {}
  const next = { ...prev }
  for (const key of ['enabled', 'apiKey', 'baseUrl']) {
    if (patch[key] !== undefined) next[key] = patch[key]
  }
  if (patch.tested !== undefined) next.tested = patch.tested
  state.providers = { ...(state.providers || {}), [id]: next }
  _write(state)
  return listWebResources()
}

/** 供搜图链消费的有序配置（仅 enabled 且凭据齐备的），sidecar 落盘用 */
export function collectEnabledResources() {
  return listWebResources()
    .filter(r => r.enabled)
    .map(r => ({
      id: r.id,
      apiKey: r.apiKey,
      baseUrl: r.baseUrl || r.defaultBaseUrl
    }))
}

/**
 * 把启用清单同步到 sidecar（落盘 dataDir/web-resources.json，image_search 工具消费）。
 * sidecar 离线不阻塞保存——下次联动时再同步。
 * @returns {Promise<{synced:boolean, error?:string}>}
 */
export async function syncWebResourcesToSidecar({ signal } = {}) {
  try {
    const res = await sidecarPost('/web-resources/config', {
      providers: collectEnabledResources()
    }, { signal, timeoutMs: 8000 })
    if (!res.ok) return { synced: false, error: res.json?.error || `HTTP ${res.status}` }
    return { synced: res.json?.ok === true }
  } catch (e) {
    return { synced: false, error: e?.message || String(e) }
  }
}

/**
 * 测活：sidecar 侧按资源协议发一次最小真实请求。
 * @returns {Promise<{ok:boolean, latencyMs:number, error?:string, sample?:string}>}
 */
export async function testWebResource(id, { signal } = {}) {
  const r = listWebResources().find(x => x.id === id)
  if (!r) throw new Error(`未知网络资源: ${id}`)
  const started = Date.now()
  try {
    const res = await sidecarPost('/web-resources/test', {
      id,
      apiKey: r.apiKey,
      baseUrl: r.baseUrl || r.defaultBaseUrl
    }, { signal, timeoutMs: 30000 })
    const data = res.json || {}
    const result = {
      ok: data.ok === true,
      latencyMs: Number(data.latencyMs ?? (Date.now() - started)),
      error: data.error || '',
      sample: data.sample || ''
    }
    saveWebResource(id, { tested: { ...result, at: new Date().toISOString() } })
    return result
  } catch (e) {
    const result = { ok: false, latencyMs: Date.now() - started, error: e?.message || String(e) }
    try { saveWebResource(id, { tested: { ...result, at: new Date().toISOString() } }) } catch { /* noop */ }
    return result
  }
}

export default {
  WEB_RESOURCE_CATALOG, listWebResources, getWebResourceConfig,
  saveWebResource, collectEnabledResources, syncWebResourcesToSidecar, testWebResource
}
