/* eslint-env node */
/**
 * web_search — 网页文本搜索（2026-11-25 收割对接：上游 genspark-ai/genoffice
 * packages/ai-search 10 级后端链的 chayuan-wps 版）。
 *
 * 复用 image_search 同一配置面（dataDir/web-resources.json 启用清单）：启用且凭据
 * 齐备的 keyed 资源按清单顺序优先（serper/tavily/linkup/searxng 等页面型源），
 * 免 Key 兜底（必应网页 → DuckDuckGo）。只返回检索结果清单（标题/链接/摘要），
 * 不抓取正文——正文由模型按需决定是否用 file_parse/让用户打开链接。
 *
 * 资金安全铁律（同 imageTools）：来源失败返回 ok:false 让模型如实降级（告知用户
 * 无搜索可用或凭据缺失），绝不静默切换到另一个可能花钱的来源。
 */
import { loadWebResourcesConfig } from './webResources.mjs'

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.1 Safari/537.36'

function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer))
}

function trimBase(baseUrl) {
  return String(baseUrl || '').replace(/\/+$/, '')
}

function clip(s, n) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, n)
}

function pageResults(items, source, max) {
  return (items || [])
    .filter(r => /^https?:\/\//.test(r.url))
    .slice(0, max)
    .map(r => ({ url: r.url, title: clip(r.title, 120), snippet: clip(r.snippet, 300), source }))
}

// ── keyed 资源页面搜索适配器（与 webResources.mjs 同配置面）──────────────────

async function serperPages(base, apiKey, query, max) {
  const resp = await fetchWithTimeout(`${trimBase(base) || 'https://google.serper.dev'}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({ q: query, num: Math.min(max, 10) })
  })
  if (!resp.ok) throw new Error(`serper HTTP ${resp.status}`)
  const data = await resp.json()
  return pageResults((data.organic || []).map(r => ({ url: r.link, title: r.title, snippet: r.snippet })), 'serper', max)
}

async function tavilyPages(base, apiKey, query, max) {
  const resp = await fetchWithTimeout(`${trimBase(base) || 'https://api.tavily.com'}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ api_key: apiKey, query, max_results: Math.min(max, 10), search_depth: 'basic' })
  })
  if (!resp.ok) throw new Error(`tavily HTTP ${resp.status}`)
  const data = await resp.json()
  return pageResults((data.results || []).map(r => ({ url: r.url, title: r.title, snippet: r.content })), 'tavily', max)
}

async function linkupPages(base, apiKey, query, max) {
  const resp = await fetchWithTimeout(`${trimBase(base)}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, depth: 'standard', outputType: 'searchResults' })
  })
  if (!resp.ok) throw new Error(`linkup HTTP ${resp.status}`)
  const data = await resp.json()
  return pageResults((data.results || []).map(r => ({ url: r.url, title: r.name, snippet: r.content })), 'linkup', max)
}

async function searxngPages(base, _apiKey, query, max) {
  const root = trimBase(base)
  if (!root) throw new Error('searxng 需要实例地址（服务地址）')
  const resp = await fetchWithTimeout(`${root}/search?q=${encodeURIComponent(query)}&format=json`, {
    headers: { Accept: 'application/json', 'User-Agent': CHROME_UA }
  })
  if (!resp.ok) throw new Error(`searxng HTTP ${resp.status}`)
  const data = await resp.json()
  return pageResults((data.results || []).map(r => ({ url: r.url, title: r.title, snippet: r.content })), 'searxng', max)
}

// ── 免 Key 兜底 ────────────────────────────────────────────────────────────

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)) } catch { return ' ' } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(Number(d)) } catch { return ' ' } })
    .replace(/&ensp;|&emsp;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function stripTags(s) {
  return clip(decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ')), 300)
}

async function bingWebPages(_base, _apiKey, query, max) {
  const resp = await fetchWithTimeout(`https://cn.bing.com/search?q=${encodeURIComponent(query)}&mkt=zh-CN`, {
    headers: { Accept: 'text/html', 'User-Agent': CHROME_UA }
  })
  if (!resp.ok) throw new Error(`bing HTTP ${resp.status}`)
  const html = await resp.text()
  const out = []
  const re = /<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>([\s\S]*?)<\/li>/g
  let m
  while ((m = re.exec(html)) && out.length < max) {
    const snippetM = /<p[^>]*>([\s\S]*?)<\/p>/.exec(m[3] || '')
    out.push({ url: m[1], title: stripTags(m[2]), snippet: snippetM ? stripTags(snippetM[1]) : '' })
  }
  if (!out.length) throw new Error('bing 无结果')
  return pageResults(out, 'bing', max)
}

async function duckduckgoPages(_base, _apiKey, query, max) {
  const resp = await fetchWithTimeout(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { Accept: 'text/html', 'User-Agent': CHROME_UA }
  })
  if (!resp.ok) throw new Error(`duckduckgo HTTP ${resp.status}`)
  const html = await resp.text()
  const out = []
  // 每条结果块：result__a 链接（uddg 重定向参数）+ 同块内的 result__snippet
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+uddg=[^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]+class="result__a"|<div class="result--|$)/g
  let m
  while ((m = re.exec(html)) && out.length < max) {
    let url = ''
    try {
      const u = new URL('http://x' + m[1].replace(/&amp;/g, '&'))
      url = u.searchParams.get('uddg') || ''
    } catch { /* 跳过畸形项 */ }
    if (!/^https?:\/\//.test(url)) continue
    const snippetM = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(m[3] || '')
    out.push({ url, title: stripTags(m[2]), snippet: snippetM ? stripTags(snippetM[1]) : '' })
  }
  if (!out.length) throw new Error('duckduckgo 无结果')
  return pageResults(out, 'duckduckgo', max)
}

/** 页面型资源执行面：按 image_search 同款启用清单消费 */
const PAGE_RESOURCE_ADAPTERS = {
  serper: serperPages,
  tavily: tavilyPages,
  linkup: linkupPages,
  searxng: searxngPages
}

/**
 * 网页搜索执行链：keyed 资源按启用清单顺序优先 → 免 Key 兜底。
 * @returns {Promise<{ok:boolean, origin?:string, results:Array<{url,title,snippet,source}>, errors:string[]}>}
 */
export async function searchWebPages(dataDir, query, max = 6) {
  const cfg = loadWebResourcesConfig(dataDir)
  const errors = []
  for (const p of cfg.providers) {
    const adapter = PAGE_RESOURCE_ADAPTERS[p.id]
    if (!adapter) continue
    if (p.id === 'searxng' && !p.baseUrl) continue
    if (p.id === 'linkup' && (!p.apiKey || !p.baseUrl)) continue
    if (p.id !== 'searxng' && p.id !== 'linkup' && !p.apiKey) continue
    try {
      const results = await adapter(p.baseUrl, p.apiKey, query, max * 2)
      if (results.length) {
        return { ok: true, origin: p.id, results, errors }
      }
      errors.push(`${p.id}: 无结果`)
    } catch (e) {
      errors.push(`${p.id}: ${String(e.message || e).slice(0, 80)}`)
    }
  }
  // 免 Key 兜底：必应优先（国内可达），DuckDuckGo 次之
  for (const [name, search] of [['bing', bingWebPages], ['duckduckgo', duckduckgoPages]]) {
    try {
      const results = await search('', '', query, max * 2)
      if (results.length) return { ok: true, origin: name, results, errors }
      errors.push(`${name}: 无结果`)
    } catch (e) {
      errors.push(`${name}: ${String(e.message || e).slice(0, 80)}`)
    }
  }
  return { ok: false, results: [], errors }
}

/** web_search 工具入口：搜索 → 返回首个成功来源的结果清单 */
export async function webSearchTool(dataDir, { query, count = 6 } = {}) {
  const q = String(query || '').trim()
  if (!q) return { ok: false, error: '缺少搜索词 query' }
  const want = Math.max(1, Math.min(Number(count) || 6, 10))
  const chain = await searchWebPages(dataDir, q, want)
  if (!chain.ok) {
    return {
      ok: false,
      error: `网页搜索失败（全部来源）：${(chain.errors[0] || '未配置任何可用搜索资源').slice(0, 120)}`,
      hint: '可在 设置 → 网络资源搜索 中启用 Serper/Tavily 等搜索资源提升成功率；或向用户索取资料。',
      errors: chain.errors.slice(0, 6)
    }
  }
  return {
    ok: true,
    source: 'web',
    query: q,
    origin: chain.origin,
    count: chain.results.length,
    results: chain.results,
    errors: chain.errors.slice(0, 6)
  }
}
