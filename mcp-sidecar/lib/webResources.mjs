/* eslint-env node */
/**
 * webResources — 网络资源搜索（Node 侧执行面）。
 *
 * 设置页（默认设置 → 网络资源搜索）把启用清单落盘到 dataDir/web-resources.json
 * （POST /web-resources/config），本模块负责：
 *   1. probeResource  — 按各资源协议发一次最小真实请求（设置页「测试」按钮）
 *   2. searchImages   — 三级生图 Tier2 的搜图执行链：enabled keyed 资源按清单
 *      顺序优先，免 Key（bing → openverse）兜底；返回候选直链列表
 *
 * 资金安全铁律（照抄 chayuan-office 共识 #3）：每个来源只做自己份内的事，
 * 失败归失败（记录 error 继续下一个），绝不静默计费。
 */
import fs from 'node:fs'
import path from 'node:path'

const UA = 'Mozilla/5.0 (compatible; chayuan-wps-imagebot/1.0)'
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function fetchWithTimeout(url, opts = {}, ms = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer))
}

function trimBase(baseUrl) {
  return String(baseUrl || '').replace(/\/+$/, '')
}

// ── keyed 资源适配器（imageSearch: true 的家底）────────────────────────────

async function serperSearch(base, apiKey, query, max) {
  const resp = await fetchWithTimeout(`${trimBase(base)}/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({ q: query, num: Math.min(max, 10) })
  }, 15000)
  if (!resp.ok) throw new Error(`serper HTTP ${resp.status}`)
  const data = await resp.json()
  return (data.images || [])
    .map(im => ({ url: im.imageUrl, source: 'serper', title: im.title || '' }))
    .filter(r => /^https?:\/\//.test(r.url))
}

async function tavilySearch(base, apiKey, query, max) {
  const resp = await fetchWithTimeout(`${trimBase(base)}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, max_results: Math.min(max, 10), include_images: true, search_depth: 'basic' })
  }, 15000)
  if (!resp.ok) throw new Error(`tavily HTTP ${resp.status}`)
  const data = await resp.json()
  return (data.images || [])
    .map(im => ({ url: typeof im === 'string' ? im : im.url, source: 'tavily' }))
    .filter(r => /^https?:\/\//.test(r.url))
}

async function searxngSearch(base, _apiKey, query, max) {
  const root = trimBase(base)
  if (!root) throw new Error('searxng 需要实例地址（服务地址）')
  const resp = await fetchWithTimeout(`${root}/search?q=${encodeURIComponent(query)}&format=json&categories=images`, {
    headers: { Accept: 'application/json', 'User-Agent': CHROME_UA }
  }, 15000)
  if (!resp.ok) throw new Error(`searxng HTTP ${resp.status}`)
  const data = await resp.json()
  return (data.results || [])
    .map(r => ({ url: r.img_src, source: 'searxng' }))
    .filter(r => /^https?:\/\//.test(r.url))
    .slice(0, max)
}

async function pexelsSearch(base, apiKey, query, max) {
  const resp = await fetchWithTimeout(`${trimBase(base)}/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.min(max, 15)}`, {
    headers: { Authorization: apiKey }
  }, 15000)
  if (!resp.ok) throw new Error(`pexels HTTP ${resp.status}`)
  const data = await resp.json()
  return (data.photos || [])
    .map(p => ({ url: p?.src?.large || p?.src?.original, source: 'pexels', title: p?.alt || '' }))
    .filter(r => /^https?:\/\//.test(r.url))
}

async function pixabaySearch(base, apiKey, query, max) {
  const resp = await fetchWithTimeout(`${trimBase(base)}/api/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&image_type=photo&per_page=${Math.min(max, 20)}`, {}, 15000)
  if (!resp.ok) throw new Error(`pixabay HTTP ${resp.status}`)
  const data = await resp.json()
  return (data.hits || [])
    .map(h => ({ url: h.largeImageURL || h.webformatURL, source: 'pixabay', title: h.tags || '' }))
    .filter(r => /^https?:\/\//.test(r.url))
}

async function unsplashSearch(base, apiKey, query, max) {
  const resp = await fetchWithTimeout(`${trimBase(base)}/search/photos?query=${encodeURIComponent(query)}&per_page=${Math.min(max, 15)}`, {
    headers: { Authorization: `Client-ID ${apiKey}` }
  }, 15000)
  if (!resp.ok) throw new Error(`unsplash HTTP ${resp.status}`)
  const data = await resp.json()
  return (data.results || [])
    .map(r => ({ url: r?.urls?.regular, source: 'unsplash', title: r?.alt_description || '' }))
    .filter(r => /^https?:\/\//.test(r.url))
}

// ── 免 Key 兜底 ────────────────────────────────────────────────────────────

async function bingSearch(base, _apiKey, query, max) {
  const root = trimBase(base) || 'https://cn.bing.com'
  const resp = await fetchWithTimeout(`${root}/images/search?q=${encodeURIComponent(query)}&form=HDRSC2`, {
    headers: { Accept: 'text/html', 'User-Agent': CHROME_UA }
  }, 15000)
  if (!resp.ok) throw new Error(`bing HTTP ${resp.status}`)
  const html = await resp.text()
  const urls = []
  const re = /murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g
  let m
  while ((m = re.exec(html)) && urls.length < max) urls.push({ url: m[1], source: 'bing' })
  if (!urls.length) throw new Error('bing 无结果')
  return urls
}

async function openverseSearch(base, _apiKey, query, max) {
  const root = trimBase(base) || 'https://api.openverse.org'
  const resp = await fetchWithTimeout(`${root}/v1/images/?q=${encodeURIComponent(query)}&page_size=${Math.min(max * 3, 20)}&mature=false`, {
    headers: { Accept: 'application/json', 'User-Agent': UA }
  }, 15000)
  if (!resp.ok) throw new Error(`openverse HTTP ${resp.status}`)
  const data = await resp.json()
  return (data.results || [])
    .map(r => ({ url: r.url || r.thumbnail, source: 'openverse', license: r.license || '' }))
    .filter(r => /^https?:\/\//.test(r.url))
}

// linkup 仅网页结果，不参与搜图；duckduckgo 网页搜索留作后续网页检索用
async function linkupSearch(base, apiKey, query, max) {
  const resp = await fetchWithTimeout(`${trimBase(base)}/v1/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, depth: 'standard', outputType: 'searchResults' })
  }, 15000)
  if (!resp.ok) throw new Error(`linkup HTTP ${resp.status}`)
  const data = await resp.json()
  return (data.results || [])
    .map(r => ({ url: r.url, source: 'linkup', title: r.name || '', isPage: true }))
    .slice(0, max)
}

async function duckduckgoSearch(base, _apiKey, query, max) {
  const root = trimBase(base) || 'https://duckduckgo.com'
  const resp = await fetchWithTimeout(`${root}/html/?q=${encodeURIComponent(query)}`, {
    headers: { Accept: 'text/html', 'User-Agent': CHROME_UA }
  }, 15000)
  if (!resp.ok) throw new Error(`duckduckgo HTTP ${resp.status}`)
  const html = await resp.text()
  const urls = []
  const re = /result__a[^>]*href="([^"]+uddg=[^"]+)"/g
  let m
  while ((m = re.exec(html)) && urls.length < max) {
    try {
      const u = new URL('http://x' + m[1])
      const target = u.searchParams.get('uddg')
      if (target) urls.push({ url: target, source: 'duckduckgo', isPage: true })
    } catch { /* 跳过畸形项 */ }
  }
  if (!urls.length) throw new Error('duckduckgo 无结果')
  return urls
}

/** 资源执行面注册表：search(probe=最小验证) + images(搜图可用性) */
export const WEB_RESOURCE_ADAPTERS = {
  serper: { search: serperSearch, images: true, probeQuery: 'test' },
  tavily: { search: tavilySearch, images: true, probeQuery: 'test' },
  linkup: { search: linkupSearch, images: false, probeQuery: 'test' },
  searxng: { search: searxngSearch, images: true, probeQuery: 'test' },
  pexels: { search: pexelsSearch, images: true, probeQuery: 'nature' },
  pixabay: { search: pixabaySearch, images: true, probeQuery: 'nature' },
  unsplash: { search: unsplashSearch, images: true, probeQuery: 'nature' },
  bing: { search: bingSearch, images: true, probeQuery: 'nature' },
  openverse: { search: openverseSearch, images: true, probeQuery: 'nature' },
  duckduckgo: { search: duckduckgoSearch, images: false, probeQuery: 'test' }
}

// ── 配置落盘（image_search 工具消费）────────────────────────────────────────

export function loadWebResourcesConfig(dataDir) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dataDir, 'web-resources.json'), 'utf8'))
    if (Array.isArray(cfg?.providers)) return cfg
  } catch { /* 缺席即未配置 */ }
  return { providers: [] }
}

export function saveWebResourcesConfig(dataDir, cfg) {
  const clean = {
    savedAt: new Date().toISOString(),
    providers: (Array.isArray(cfg?.providers) ? cfg.providers : [])
      .map(p => ({
        id: String(p?.id || '').trim(),
        apiKey: String(p?.apiKey || ''),
        baseUrl: String(p?.baseUrl || '')
      }))
      .filter(p => p.id && WEB_RESOURCE_ADAPTERS[p.id])
  }
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(path.join(dataDir, 'web-resources.json'), JSON.stringify(clean, null, 2))
  return clean
}

// ── 测活 ───────────────────────────────────────────────────────────────────

/**
 * 按资源协议发一次最小真实请求。
 * @returns {Promise<{ok:boolean, latencyMs:number, error?:string, sample?:string}>}
 */
export async function probeResource(id, { apiKey, baseUrl } = {}) {
  const adapter = WEB_RESOURCE_ADAPTERS[id]
  if (!adapter) return { ok: false, latencyMs: 0, error: `未知网络资源: ${id}` }
  const started = Date.now()
  try {
    const results = await adapter.search(baseUrl || '', apiKey || '', adapter.probeQuery, 3)
    const latencyMs = Date.now() - started
    if (!results.length) return { ok: false, latencyMs, error: '连通但无结果，请检查凭据/地址' }
    return { ok: true, latencyMs, sample: String(results[0].url || '').slice(0, 120) }
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - started, error: String(e.message || e).slice(0, 160) }
  }
}

// ── 搜图执行链（三级生图 Tier2）─────────────────────────────────────────────

/**
 * 网络搜图执行链：启用且凭据齐备的 keyed 资源按清单顺序优先，免 Key 兜底。
 * @returns {Promise<{ok:boolean, origin?:string, candidates:Array<{url,source,license?}>, errors:string[]}>}
 */
export async function searchWebImages(dataDir, query, max = 5) {
  const cfg = loadWebResourcesConfig(dataDir)
  const errors = []
  for (const p of cfg.providers) {
    const adapter = WEB_RESOURCE_ADAPTERS[p.id]
    if (!adapter || !adapter.images) continue
    if (idNeedsKey(p.id) && !p.apiKey && p.id !== 'searxng') continue
    if (p.id === 'searxng' && !p.baseUrl) continue
    try {
      const candidates = await adapter.search(p.baseUrl, p.apiKey, query, max * 2)
      if (candidates.length) {
        return { ok: true, origin: p.id, candidates: candidates.slice(0, max), errors }
      }
      errors.push(`${p.id}: 无结果`)
    } catch (e) {
      errors.push(`${p.id}: ${String(e.message || e).slice(0, 80)}`)
    }
  }
  return { ok: false, candidates: [], errors }
}

function idNeedsKey(id) {
  return !['bing', 'openverse', 'duckduckgo'].includes(id)
}
