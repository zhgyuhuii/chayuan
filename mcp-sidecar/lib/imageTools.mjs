/**
 * 图像工具（三级生图，参考 chayuan-office image-source 体系）：
 *   image_search — 网络搜图（免 key 源：Openverse → DuckDuckGo 兜底），下载到本地返回路径
 *   generate_image — OpenAI 兼容 images/generations 生图（配置：dataDir/image-gen.json）
 *
 * 资金安全铁律（照抄 chayuan-office 共识 #3）：工具只做自己份内的事；来源失败返回
 * ok:false 让模型走 svg_add 矢量兜底，绝不静默切换到另一个可能花钱的来源。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const OPENVERSE = 'https://api.openverse.org/v1/images/'
const UA = 'Mozilla/5.0 (compatible; chayuan-wps-imagebot/1.0)'

function tmpImageDir(dataDir) {
  const dir = path.join(dataDir, 'tmp-images')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function fetchWithTimeout(url, opts = {}, ms = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer))
}

/** Openverse 免 key 搜图（CC 授权图库，返回可直接下载的直链） */
async function openverseSearch(query, maxResults = 5) {
  const url = `${OPENVERSE}?q=${encodeURIComponent(query)}&page_size=${Math.min(maxResults * 3, 20)}&mature=false`
  const resp = await fetchWithTimeout(url, { headers: { Accept: 'application/json', 'User-Agent': UA } }, 15000)
  if (!resp.ok) throw new Error(`openverse HTTP ${resp.status}`)
  const data = await resp.json()
  return (data.results || [])
    .map(r => ({ url: r.url || r.thumbnail, source: r.source || 'openverse', license: r.license || '' }))
    .filter(r => /^https?:\/\//.test(r.url))
}

/** 下载图片到 tmp-images，返回 {path, bytes} */
async function downloadImage(url, dataDir) {
  const dir = tmpImageDir(dataDir)
  const resp = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } }, 30000)
  if (!resp.ok) throw new Error(`下载 HTTP ${resp.status}`)
  const buf = Buffer.from(await resp.arrayBuffer())
  if (buf.length < 2048) throw new Error('图片过小，疑似失效直链')
  const head = buf.subarray(0, 4)
  let ext = '.jpg'
  if (head[0] === 0x89 && head[1] === 0x50) ext = '.png'
  else if (head[0] === 0x47 && head[1] === 0x49) ext = '.gif'
  else if (!(head[0] === 0xff && head[1] === 0xd8)) throw new Error('非图片内容')
  const file = path.join(dir, `web-${crypto.randomBytes(5).toString('hex')}${ext}`)
  fs.writeFileSync(file, buf)
  return { path: file, bytes: buf.length }
}

/** image_search 工具入口：搜索 → 依次尝试下载 → 返回首个成功路径 */
export async function imageSearchTool(dataDir, { query, count = 3 } = {}) {
  const q = String(query || '').trim()
  if (!q) return { ok: false, error: '缺少搜索词 query' }
  let results = []
  try {
    results = await openverseSearch(q, Number(count) || 3)
  } catch (e) {
    return { ok: false, error: `搜图失败：${e.message || e}` }
  }
  const errors = []
  for (const r of results.slice(0, 5)) {
    try {
      const dl = await downloadImage(r.url, dataDir)
      return { ok: true, source: 'web', query: q, path: dl.path, bytes: dl.bytes, origin: r.source, license: r.license }
    } catch (e) {
      errors.push(String(e.message || e))
    }
  }
  return { ok: false, error: `搜到 ${results.length} 张但下载全部失败：${errors[0] || ''}` }
}

/** 生图配置：dataDir/image-gen.json {apiUrl, apiKey, model, size} */
function loadImageGenConfig(dataDir) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dataDir, 'image-gen.json'), 'utf8'))
    if (cfg?.apiUrl && cfg?.apiKey && cfg?.model) return cfg
  } catch { /* ignore */ }
  return null
}

/** generate_image 工具入口：OpenAI 兼容 images/generations → 下载 URL → 本地路径 */
export async function generateImageTool(dataDir, { prompt, size = '512x512' } = {}) {
  const p = String(prompt || '').trim()
  if (!p) return { ok: false, error: '缺少生图描述 prompt' }
  const cfg = loadImageGenConfig(dataDir)
  if (!cfg) {
    return { ok: false, error: '未配置生图模型（dataDir/image-gen.json），请改用 svg_add 矢量图形兜底', unavailable: true }
  }
  const base = String(cfg.apiUrl).replace(/\/+$/, '')
  const body = { model: cfg.model, prompt: p, n: 1 }
  if (size) body.size = size
  let data
  try {
    const resp = await fetchWithTimeout(`${base}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body)
    }, 120000)
    data = await resp.json()
    if (data?.error) throw new Error(data.error.message || JSON.stringify(data.error).slice(0, 120))
  } catch (e) {
    return { ok: false, error: `生图失败：${String(e.message || e).slice(0, 160)}` }
  }
  const item = (data.data || [])[0] || {}
  const dir = tmpImageDir(dataDir)
  const file = path.join(dir, `gen-${crypto.randomBytes(5).toString('hex')}.png`)
  try {
    if (item.b64_json) {
      fs.writeFileSync(file, Buffer.from(item.b64_json, 'base64'))
    } else if (item.url) {
      const resp = await fetchWithTimeout(item.url, { headers: { 'User-Agent': UA } }, 60000)
      if (!resp.ok) throw new Error(`生图结果下载 HTTP ${resp.status}`)
      fs.writeFileSync(file, Buffer.from(await resp.arrayBuffer()))
    } else {
      throw new Error('生图响应无 url/b64_json')
    }
  } catch (e) {
    return { ok: false, error: `生图结果落盘失败：${e.message || e}` }
  }
  return { ok: true, source: 'model', path: file, model: cfg.model, prompt: p }
}

/** /tmp-image 端点处理：{base64, ext} → 落盘 → {path}（svg_add 光栅化产物落盘用） */
export function saveTmpImage(dataDir, { base64, ext = 'png' }) {
  if (!base64) return { ok: false, error: '缺少 base64' }
  const safeExt = ['png', 'jpg', 'jpeg', 'svg'].includes(String(ext)) ? String(ext) : 'png'
  const dir = tmpImageDir(dataDir)
  const file = path.join(dir, `tmp-${crypto.randomBytes(5).toString('hex')}.${safeExt}`)
  fs.writeFileSync(file, Buffer.from(String(base64), 'base64'))
  return { ok: true, path: file, bytes: fs.statSync(file).size }
}
