/* eslint-env node */
/**
 * 图像工具（三级生图，参考 chayuan-office image-source 体系）：
 *   image_search — 网络搜图：设置页「网络资源搜索」里启用的 keyed 资源
 *     （Serper/Pexels/Pixabay/…）按清单顺序优先 → 免 Key 兜底（必应 → Openverse），
 *     下载到本地返回路径
 *   generate_image — OpenAI 兼容 images/generations 生图（配置：dataDir/image-gen.json）
 *
 * 资金安全铁律（照抄 chayuan-office 共识 #3）：工具只做自己份内的事；来源失败返回
 * ok:false 让模型走 svg_add 矢量兜底，绝不静默切换到另一个可能花钱的来源。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { searchWebImages } from './webResources.mjs'

const OPENVERSE = 'https://api.openverse.org/v1/images/'
const UA = 'Mozilla/5.0 (compatible; chayuan-wps-imagebot/1.0)'
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** 必应图片搜索（免 key、国内可达；解析 iusc 卡片里的 murl 原图直链） */
async function bingImageSearch(query, maxResults = 8) {
  const url = `https://cn.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2`
  const resp = await fetchWithTimeout(url, { headers: { Accept: 'text/html', 'User-Agent': CHROME_UA } }, 15000)
  if (!resp.ok) throw new Error(`bing HTTP ${resp.status}`)
  const html = await resp.text()
  const urls = []
  const re = /murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g
  let m
  while ((m = re.exec(html)) && urls.length < maxResults) urls.push({ url: m[1], source: 'bing' })
  if (!urls.length) throw new Error('bing 无结果')
  return urls
}

/**
 * tmp-images 候选目录（按优先序）。WPS 是沙盒应用：webview 里 Shapes.AddPicture
 * 只能读自己容器内的文件——~/.config/chayuan-wps/mcp/tmp-images（dataDir）在容器外，
 * 真机实证「插入图片失败：…tmp-images/web-*.jpg（请确认是本地可读路径）」，
 * 所以 Mac 上优先 WPS 容器内的 Application Support（sidecar 与 WPS 同用户）。
 */
function tmpImageDirCandidates(dataDir) {
  const dirs = []
  if (process.platform === 'darwin') {
    const home = process.env.HOME || ''
    if (home) {
      dirs.push(path.join(
        home, 'Library', 'Containers', 'com.kingsoft.wpsoffice.mac', 'Data',
        'Library', 'Application Support', 'chayuan-wps', 'tmp-images'
      ))
    }
  }
  dirs.push(path.join(dataDir, 'tmp-images'))
  return dirs
}

/** 全部候选目录都写失败时的统一失败信封：attempts 明细 + 修复指引（EPERM 取证） */
function persistFailureEnvelope(attempts) {
  const detail = attempts.map(a => `${a.dir}: ${a.error}`).join('；')
  return {
    ok: false,
    error: `图片落盘失败（已尝试 ${attempts.length} 个目录）：${detail.slice(0, 400)}`,
    attempts,
    hint: 'EPERM/权限错误多为 macOS 完全磁盘访问限制：系统设置 → 隐私与安全性 → 完全磁盘访问权限，给 chayuan-mcp sidecar（或运行它的终端/LaunchAgent）授权后重启 WPS 重试。'
  }
}

/**
 * 把 buffer 写进 tmp-images：候选目录逐档 mkdir(recursive)+writeFileSync，
 * 首个成功即返回 {ok, path}；全败返回 {ok:false, error, attempts, hint}，
 * 绝不 throw（2026-11-25 真机：容器与 dataDir 双 EPERM 时异常裸冒，模型只看到
 * 一句"没有写入权限"，无从排查也无从降级）。
 */
function writeTmpFile(dataDir, filename, buffer) {
  const attempts = []
  for (const dir of tmpImageDirCandidates(dataDir)) {
    try {
      fs.mkdirSync(dir, { recursive: true })
      const file = path.join(dir, filename)
      fs.writeFileSync(file, buffer)
      return { ok: true, path: file }
    } catch (e) {
      attempts.push({ dir, error: `${e?.code || ''} ${String(e?.message || e).slice(0, 120)}`.trim() })
    }
  }
  return persistFailureEnvelope(attempts)
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
  const resp = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } }, 30000)
  if (!resp.ok) throw new Error(`下载 HTTP ${resp.status}`)
  const buf = Buffer.from(await resp.arrayBuffer())
  if (buf.length < 2048) throw new Error('图片过小，疑似失效直链')
  const head = buf.subarray(0, 4)
  let ext = '.jpg'
  if (head[0] === 0x89 && head[1] === 0x50) ext = '.png'
  else if (head[0] === 0x47 && head[1] === 0x49) ext = '.gif'
  else if (!(head[0] === 0xff && head[1] === 0xd8)) throw new Error('非图片内容')
  const saved = writeTmpFile(dataDir, `web-${crypto.randomBytes(5).toString('hex')}${ext}`, buf)
  if (!saved.ok) throw new Error([saved.error, saved.hint].filter(Boolean).join('。'))
  return { path: saved.path, bytes: buf.length }
}

/** image_search 工具入口：搜索 → 依次尝试下载 → 返回首个成功路径 */
export async function imageSearchTool(dataDir, { query, count = 3 } = {}) {
  const q = String(query || '').trim()
  if (!q) return { ok: false, error: '缺少搜索词 query' }
  const want = Number(count) || 3
  const errors = []
  // ① 设置页「网络资源搜索」启用的 keyed 资源按清单顺序优先（三级生图 Tier2 主力）
  try {
    const chain = await searchWebImages(dataDir, q, want * 2)
    if (chain.ok) {
      for (const r of chain.candidates.slice(0, want * 2)) {
        try {
          const dl = await downloadImage(r.url, dataDir)
          return {
            ok: true, source: 'web', query: q, path: dl.path, bytes: dl.bytes,
            origin: r.source, license: r.license || ''
          }
        } catch (e) {
          errors.push(`${chain.origin}/${String(e.message || e).slice(0, 60)}`)
        }
      }
      errors.push(`${chain.origin}: 搜到 ${chain.candidates.length} 张但下载全败`)
    }
    errors.push(...(chain.errors || []))
  } catch (e) {
    errors.push(`资源链: ${String(e.message || e).slice(0, 80)}`)
  }
  // ② 免 Key 兜底：必应优先（国内可达），Openverse 次之（海外网络）
  for (const search of [bingImageSearch, openverseSearch]) {
    let results = []
    try {
      results = await search(q, want * 3)
    } catch (e) {
      errors.push(`${search.name}: ${String(e.message || e).slice(0, 80)}`)
      continue
    }
    for (const r of results.slice(0, want * 2)) {
      try {
        const dl = await downloadImage(r.url, dataDir)
        return { ok: true, source: 'web', query: q, path: dl.path, bytes: dl.bytes, origin: r.source, license: r.license || '' }
      } catch (e) {
        errors.push(String(e.message || e))
      }
    }
    errors.push(`${search.name}: 搜到 ${results.length} 张但下载全败`)
  }
  return { ok: false, error: `搜图失败（全部来源）：${errors[0] || ''}`, errors: errors.slice(0, 6) }
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
export async function generateImageTool(dataDir, { prompt, size = '512x512', aspectRatio = '' } = {}) {
  const p = String(prompt || '').trim()
  if (!p) return { ok: false, error: '缺少生图描述 prompt' }
  // aspectRatio 优先于 size：按宽高比映射到生图端点的具体尺寸（与 webview 侧
  // mediaApi.mapAspectRatioToImageSize 同一映射，两条生图通道行为一致）
  let effSize = size
  const ar = String(aspectRatio || '').trim()
  if (ar === '16:9') effSize = '1792x1024'
  else if (ar === '9:16') effSize = '1024x1792'
  else if (ar === '1:1') effSize = '1024x1024'
  const cfg = loadImageGenConfig(dataDir)
  if (!cfg) {
    return { ok: false, error: '未配置生图模型（dataDir/image-gen.json），请改用 svg_add 矢量图形兜底', unavailable: true }
  }
  const base = String(cfg.apiUrl).replace(/\/+$/, '')
  // 阿里百炼（DashScope）qwen-image 系走原生多模态生成端点（同步、chat 风格、
  // 输出 content[].image URL），与 OpenAI images/generations 不兼容——按 host 分流
  const isDashScope = /dashscope\.aliyuncs\.com/i.test(base)
  let data
  try {
    if (isDashScope) {
      const root = base.replace(/\/compatible-mode\/v1.*$/i, '')
      const mmResp = await fetchWithTimeout(`${root}/api/v1/services/aigc/multimodal-generation/generation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({
          model: cfg.model,
          input: { messages: [{ role: 'user', content: [{ type: 'text', text: p }] }] },
          parameters: effSize ? { size: String(effSize).replace('x', '*') } : {}
        })
      }, 180000)
      const mm = await mmResp.json()
      if (mm?.code) throw new Error(`${mm.code}: ${String(mm.message || '').slice(0, 140)}`)
      const content = mm?.output?.choices?.[0]?.message?.content || []
      const imageUrl = (Array.isArray(content) ? content : []).find(c => c?.image)?.image
      if (!imageUrl) throw new Error('生图响应无 image URL')
      data = { data: [{ url: imageUrl }] }
    } else {
      const body = { model: cfg.model, prompt: p, n: 1 }
      if (effSize) body.size = effSize
      const resp = await fetchWithTimeout(`${base}/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify(body)
      }, 120000)
      data = await resp.json()
      if (data?.error) throw new Error(data.error.message || JSON.stringify(data.error).slice(0, 120))
    }
  } catch (e) {
    return { ok: false, error: `生图失败：${String(e.message || e).slice(0, 160)}` }
  }
  const item = (data.data || [])[0] || {}
  try {
    let buf
    if (item.b64_json) {
      buf = Buffer.from(item.b64_json, 'base64')
    } else if (item.url) {
      const resp = await fetchWithTimeout(item.url, { headers: { 'User-Agent': UA } }, 60000)
      if (!resp.ok) throw new Error(`生图结果下载 HTTP ${resp.status}`)
      buf = Buffer.from(await resp.arrayBuffer())
    } else {
      throw new Error('生图响应无 url/b64_json')
    }
    const saved = writeTmpFile(dataDir, `gen-${crypto.randomBytes(5).toString('hex')}.png`, buf)
    if (!saved.ok) return saved
    return { ok: true, source: 'model', path: saved.path, model: cfg.model, prompt: p }
  } catch (e) {
    return { ok: false, error: `生图结果落盘失败：${e.message || e}` }
  }
}

/** /tmp-image 端点处理：{base64, ext} → 落盘 → {path}（svg_add 光栅化产物落盘用） */
export function saveTmpImage(dataDir, { base64, ext = 'png' }) {
  if (!base64) return { ok: false, error: '缺少 base64' }
  const safeExt = ['png', 'jpg', 'jpeg', 'svg'].includes(String(ext)) ? String(ext) : 'png'
  const saved = writeTmpFile(
    dataDir,
    `tmp-${crypto.randomBytes(5).toString('hex')}.${safeExt}`,
    Buffer.from(String(base64), 'base64')
  )
  if (!saved.ok) return saved
  return { ok: true, path: saved.path, bytes: fs.statSync(saved.path).size }
}

/**
 * 按文件名（仅 basename）在 tmp-images 候选目录里查找已落盘图片。
 * 供 GET /tmp-image/file 端点向面板 webview 提供容器外路径（dataDir 回落）的
 * HTTP 直显通道——面板读不到容器外文件，但 img/fetch 走 127.0.0.1 没问题。
 * @returns {string|null} 绝对路径或 null
 */
export function findTmpImageFile(dataDir, name) {
  const safe = String(name || '').replace(/\\/g, '/').split('/').pop()
  if (!safe || !/^[A-Za-z0-9._-]+\.(png|jpe?g|gif|webp|svg)$/i.test(safe)) return null
  for (const dir of tmpImageDirCandidates(dataDir)) {
    try {
      const file = path.join(dir, safe)
      const st = fs.statSync(file)
      if (st.isFile()) return file
    } catch { /* 下一候选 */ }
  }
  return null
}
