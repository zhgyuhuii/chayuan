#!/usr/bin/env node
/**
 * publish-skill-to-site.mjs —— 把 pack-portable-staging.mjs 产出的技能包发布到官网。
 *
 * 两条发布通路(都走,互补;旧通路在 #31 前端读 universal 后退役):
 *
 *  ① 新通路(推荐):走官网后台 API,上传到产品的 universal 形态 + 发布 + 推镜像。
 *     需要 WEBSITE_ADMIN_COOKIE(登录后台后从浏览器拿 cy_admin cookie,12h TTL)
 *     + WEBSITE_BASE(默认 https://aidooo.com)。
 *     镜像推送由官网 server 用它自己配置的 GITHUB_TOKEN/GITEE_TOKEN 完成
 *     (POST /api/admin/releases/:p/:v/universal/push-mirrors),本脚本不重复实现。
 *
 *  ② 旧通路(兼容,--no-legacy 关闭):复制 zip+sha 到 public/downloads/skill/ +
 *     更新 skill-releases.json。在前端 #31 改读产品 manifest 的 universal 条目前,
 *     静态 skill-releases.json 仍是首页/技能页的下载源,不能删。退役后用 --no-legacy。
 *
 * 用法:
 *   node scripts/publish-skill-to-site.mjs                                # 读 install.json 版本
 *   node scripts/publish-skill-to-site.mjs --version 4.0.0 --note "首个发布"
 *   WEBSITE_ADMIN_COOKIE="cy_admin=eyJ..." node scripts/publish-skill-to-site.mjs
 *   node scripts/publish-skill-to-site.mjs --no-legacy                     # 前端 #31 落地后
 *
 * 环境变量:
 *   WEBSITE_REPO        website 仓库本地路径(默认 /Users/zyh/work/website,旧通路用)
 *   WEBSITE_BASE        官网基址(默认 https://aidooo.com,新通路用)
 *   WEBSITE_ADMIN_COOKIE 后台登录 cookie 形如 "cy_admin=<jwt>"(新通路必需)
 *
 * 前置:先 node scripts/pack-portable-staging.mjs 产出 release/wps-skill-chayuan-<ver>-portable.{zip,zip.sha256}。
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Windows 上 URL.pathname 会带前导 /（/D:/...），path.resolve 会变成 D:\D:\...；必须用 fileURLToPath。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE = path.join(ROOT, 'release')

// ── 参数 ──
const args = process.argv.slice(2)
let site = process.env.WEBSITE_REPO || '/Users/zyh/work/website'
let websiteBase = (process.env.WEBSITE_BASE || 'https://aidooo.com').replace(/\/$/, '')
let version = ''
let note = ''
let product = 'chayuan'   // 技能挂在哪个产品的 universal 形态(chayuan.forms[].key==='skill')
let channel = 'skill'     // 交付通道:chayuan 的 skill form(kind=file, universal 平台)。
                          // 不可省略:forms 注入后 resolveUploadChannel 无 channel 会回落到
                          // primary form 'addon'(installer),universal 平台 → channel_platform_mismatch。
let noLegacy = false
let noApi = false
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--site') site = args[++i]
  else if (a === '--base') websiteBase = (args[++i] || '').replace(/\/$/, '')
  else if (a === '--version') version = args[++i]
  else if (a === '--note') note = args[++i]
  else if (a === '--product') product = args[++i]
  else if (a === '--channel') channel = args[++i]
  else if (a === '--no-legacy') noLegacy = true
  else if (a === '--no-api') noApi = true
  else if (a === '-h' || a === '--help') {
    console.log(`用法: node scripts/publish-skill-to-site.mjs [--version <ver>] [--note "..."] [--product chayuan] [--channel skill] [--base <url>] [--site <path>] [--no-legacy] [--no-api]
环境: WEBSITE_ADMIN_COOKIE, WEBSITE_BASE, WEBSITE_REPO`)
    process.exit(0)
  }
}
site = path.resolve(site)

const adminCookie = process.env.WEBSITE_ADMIN_COOKIE || ''
const CHUNK = 4 * 1024 * 1024 // 4 MB,与 server uploads.js 一致

// ── 版本 ──
if (!version) {
  const ij = path.join(RELEASE, 'install-staging', 'install.json')
  if (!fs.existsSync(ij)) { console.error(`缺少 ${ij}(先 npm run build:wps-all)`); process.exit(1) }
  version = String(JSON.parse(fs.readFileSync(ij, 'utf8')).version || '').trim()
}
if (!version) { console.error('无法确定版本号(用 --version 指定)'); process.exit(1) }
console.log(`[publish:skill] 版本 ${version}  product=${product}`)

// ── 校验产物 ──
const zipName = `wps-skill-chayuan-${version}-portable.zip`
const sevenName = `wps-skill-chayuan-${version}-portable.7z`
const zip = path.join(RELEASE, zipName)
const zipSha = path.join(RELEASE, zipName + '.sha256')
if (!fs.existsSync(zip) || !fs.existsSync(zipSha)) {
  console.error(`缺少 ${zipName} / .sha256(先 node scripts/pack-portable-staging.mjs)`)
  process.exit(1)
}

const readSha = (p) => String(fs.readFileSync(p, 'utf8')).split(/\s+/)[0].trim()
const mb = (n) => (n / 1048576).toFixed(1)
const zipHash = readSha(zipSha)
const zipSize = fs.statSync(zip).size
console.log(`[publish:skill] ✓ ${zipName} (${mb(zipSize)} MB)  sha256=${zipHash.slice(0, 12)}…`)

// 收集到的镜像 URL(新通路 push-mirrors 回填;旧通路兜底用 mirrors.json 模板 URL)
let mirrors = null

// ═══════════════════ ① 新通路:官网 API(universal 上传 + 发布 + 推镜像)═════════════════════
async function publishViaApi() {
  if (noApi) { console.log('[publish:skill] --no-api,跳过新通路'); return }
  if (!adminCookie) {
    console.warn('[publish:skill] ⚠ 未设 WEBSITE_ADMIN_COOKIE,跳过新通路(只走旧通路静态分发)。')
    console.warn('               要走 API:登录后台 → 浏览器 devtools 拿 cy_admin cookie → export WEBSITE_ADMIN_COOKIE="cy_admin=..."')
    return
  }
  const base = websiteBase
  const headers = { cookie: adminCookie }

  // /me 探活
  let me
  try {
    me = await fetch(`${base}/api/admin/me`, { headers })
  } catch (e) {
    console.warn(`[publish:skill] ⚠ 连不上 ${base} (${e.message}),跳过新通路`)
    return
  }
  if (me.status !== 200) {
    console.warn(`[publish:skill] ⚠ WEBSITE_ADMIN_COOKIE 无效或过期(/me=${me.status}),跳过新通路。重新登录取 cookie。`)
    return
  }
  console.log(`[publish:skill] 新通路:已连 ${base},cookie 有效`)

  // 分块上传:init → chunk* → finalize(universal,单文件替换)
  const init = await fetch(`${base}/api/admin/uploads/init`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ product, version, channel, platform: 'universal', filename: zipName, size: zipSize, sha256: zipHash })
  })
  if (!init.ok) { console.error(`[publish:skill] init 失败 ${init.status}: ${await init.text()}`); process.exit(1) }
  const { uploadId, totalChunks } = await init.json()
  console.log(`[publish:skill] · 上传 universal(uploadId=${uploadId.slice(0, 8)}…, ${totalChunks} 块)`)

  const buf = fs.readFileSync(zip)
  for (let idx = 0; idx < totalChunks; idx++) {
    const start = idx * CHUNK
    const chunk = Buffer.from(buf.buffer, buf.byteOffset + start, Math.min(CHUNK, zipSize - start))
    const cr = await fetch(`${base}/api/admin/uploads/${uploadId}/chunk`, {
      method: 'PATCH', headers: { ...headers, 'content-type': 'application/octet-stream', 'x-chunk-index': String(idx) },
      body: chunk
    })
    if (!cr.ok) { console.error(`[publish:skill] chunk ${idx} 失败 ${cr.status}: ${await cr.text()}`); process.exit(1) }
    process.stdout.write(`\r[publish:skill] · 已传 ${idx + 1}/${totalChunks} 块`)
  }
  process.stdout.write('\n')

  const fin = await fetch(`${base}/api/admin/uploads/${uploadId}/finalize`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ notes: note || '' })   // universal 不需要 variant
  })
  if (!fin.ok) { console.error(`[publish:skill] finalize 失败 ${fin.status}: ${await fin.text()}`); process.exit(1) }
  console.log('[publish:skill] ✓ finalize(universal 单文件,同版本已自动替换)')

  // 发布
  const pub = await fetch(`${base}/api/admin/releases/${product}/${version}/universal/publish`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}'
  })
  if (!pub.ok) { console.error(`[publish:skill] publish 失败 ${pub.status}: ${await pub.text()}`); process.exit(1) }
  console.log('[publish:skill] ✓ 已发布')

  // 推镜像(官网 server 用其 GITHUB_TOKEN/GITEE_TOKEN 推;best-effort)
  const push = await fetch(`${base}/api/admin/releases/${product}/${version}/universal/push-mirrors`, {
    method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}'
  })
  const pushBody = await push.json().catch(() => ({}))
  if (push.ok && pushBody.mirrors) {
    mirrors = pushBody.mirrors
    console.log(`[publish:skill] ✓ 推镜像: ${Object.entries(mirrors).map(([k, v]) => `${k}=${String(v).slice(0, 48)}…`).join('  ') || '(无)'}`)
    for (const r of (pushBody.results || [])) {
      if (!r.ok) console.warn(`               · ${r.source} 跳过: ${r.error}`)
    }
  } else {
    console.warn(`[publish:skill] ⚠ 推镜像未完成(push ${push.status}): ${pushBody.detail || pushBody.error || ''}`)
    console.warn('               可在后台 manage tab 手动「推送镜像」或手填 mirrors。')
  }
}

// ═══════════════════ ② 旧通路:静态 skill-releases.json(兼容,退役前保留)═════════════════════
async function publishLegacy() {
  if (noLegacy) { console.log('[publish:skill] --no-legacy,跳过旧通路 skill-releases.json'); return }
  if (!fs.existsSync(path.join(site, 'public', 'downloads'))) {
    console.warn(`[publish:skill] ⚠ ${site}/public/downloads 不存在(--site 指定 website 根),跳过旧通路`)
    return
  }
  const destDir = path.join(site, 'public', 'downloads', 'skill')
  await fsp.mkdir(destDir, { recursive: true })

  await fsp.copyFile(zip, path.join(destDir, zipName))
  await fsp.copyFile(zipSha, path.join(destDir, zipName + '.sha256'))
  console.log(`[publish:skill] ✓ 旧通路:复制 ${zipName} → ${path.relative(site, destDir)}/`)

  let alt7z = null
  const seven = path.join(RELEASE, sevenName)
  const sevenSha = path.join(RELEASE, sevenName + '.sha256')
  if (fs.existsSync(seven) && fs.existsSync(sevenSha)) {
    const h7 = readSha(sevenSha)
    await fsp.copyFile(seven, path.join(destDir, sevenName))
    await fsp.copyFile(sevenSha, path.join(destDir, sevenName + '.sha256'))
    alt7z = { url: `/downloads/skill/${sevenName}`, sha256: h7, size: fs.statSync(seven).size }
  }

  // 镜像 URL:新通路回填的优先;否则用与 release/mirrors.json 一致的 tag 模板 URL
  const finalMirrors = mirrors || {
    gitee: `https://gitee.com/cloudshd/chayuan-wps-releases/releases/download/${version}/${zipName}`,
    github: `https://github.com/zhgyuhuii/chayuan/releases/download/${version}/${zipName}`,
  }

  // upsert skill-releases.json(同 version 替换;note 空时保留旧 notes)
  const manifestPath = path.join(site, 'public', 'downloads', 'skill-releases.json')
  let manifest = { package: 'wps-skill-chayuan', latest: '', releases: [] }
  if (fs.existsSync(manifestPath)) {
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) } catch { /* 损坏则重建 */ }
  }
  if (!Array.isArray(manifest.releases)) manifest.releases = []
  manifest.package = 'wps-skill-chayuan'

  const entry = {
    version,
    url: `/downloads/skill/${zipName}`,
    sha256: zipHash,
    size: zipSize,
    ...(alt7z ? { alt7z } : {}),
    mirrors: finalMirrors,
    publishedAt: new Date().toISOString().slice(0, 10),
    notes: note || ''
  }
  const idx = manifest.releases.findIndex((r) => r && r.version === version)
  if (idx >= 0) {
    if (!note && manifest.releases[idx].notes) entry.notes = manifest.releases[idx].notes
    manifest.releases[idx] = entry
    console.log(`[publish:skill] · 更新既有条目 ${version}`)
  } else {
    manifest.releases.unshift(entry)
    console.log(`[publish:skill] · 新增条目 ${version}`)
  }
  manifest.latest = manifest.releases.map((r) => r.version).sort(cmpDesc)[0]
  await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log(`[publish:skill] ✓ skill-releases.json latest=${manifest.latest}(共 ${manifest.releases.length} 条)【兼容;#31 前端读 universal 后退役,届时加 --no-legacy】`)
}

function cmpDesc(a, b) {
  const pa = String(a).split(/[.-]/).map((x) => parseInt(x, 10))
  const pb = String(b).split(/[.-]/).map((x) => parseInt(x, 10))
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = Number.isFinite(pa[i]) ? pa[i] : 0
    const vb = Number.isFinite(pb[i]) ? pb[i] : 0
    if (va !== vb) return vb - va
  }
  return 0
}

// ── 跑 ──
await publishViaApi()
await publishLegacy()

console.log('\n[publish:skill] 完成。')
if (!noLegacy) {
  console.log('  旧通路收尾:')
  console.log(`    cd "${site}"`)
  console.log('    git add public/downloads/skill-releases.json')
  console.log(`    git commit -m "chore(downloads): 发布 wps-skill-chayuan ${version}"`)
  console.log('    (public/downloads/skill/ 下压缩包被 .gitignore 忽略,随生产下载卷上线)')
}
if (adminCookie && !noApi) {
  console.log('  新通路:universal 条目已落 releases-admin.json,前端 #31 落地后首页/技能页改读它。')
}
