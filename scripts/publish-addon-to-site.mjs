#!/usr/bin/env node
/**
 * publish-addon-to-site.mjs —— 把安装器(.exe/.pkg/.deb)上传到官网产品的 addon 通道并发布。
 *
 * 与 publish-skill-to-site.mjs 互补:skill 包走 universal/file 通道(单文件替换);
 * 安装器走 addon/installer 通道 —— 必须具体 OS 平台 + variant(如「默认版」)。
 *
 * 用法:
 *   WEBSITE_ADMIN_COOKIE="cy_admin=..." node scripts/publish-addon-to-site.mjs \
 *     --file release/chayuan-4.1.1-windows-x64.exe --platform windows-amd64
 *   ... --file release/chayuan-4.1.1-windows-arm64.exe --platform windows-arm64
 *
 * 参数:
 *   --file <path>        必填:安装器文件(release/ 下,相对仓库根或绝对)
 *   --platform <plat>    必填:windows-amd64 | windows-arm64 | mac-arm64 | mac-x64 | linux-amd64 | linux-arm64
 *   --variant <名>       可选,默认「默认版」(VARIANT_DEFAULT_LABEL)
 *   --channel <通道>     可选,默认 addon
 *   --product <slug>     可选,默认 chayuan
 *   --version <ver>      可选,默认读 release/install-staging/install.json
 *   --note "..."         可选,release notes
 *   --base <url>         可选,默认 https://aidooo.com
 *
 * 环境:WEBSITE_ADMIN_COOKIE(后台登录 cookie)、WEBSITE_BASE。
 *
 * 流程:init(分块) → chunk* → finalize(variant) → publish(无 variant 段,取 primary) → push-mirrors(best-effort)。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE = path.join(ROOT, 'release')

const args = process.argv.slice(2)
let file = ''
let platform = ''
let variant = '默认版'
let channel = 'addon'
let product = 'chayuan'
let version = ''
let note = ''
let websiteBase = (process.env.WEBSITE_BASE || 'https://aidooo.com').replace(/\/$/, '')
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--file') file = args[++i]
  else if (a === '--platform') platform = args[++i]
  else if (a === '--variant') variant = args[++i]
  else if (a === '--channel') channel = args[++i]
  else if (a === '--product') product = args[++i]
  else if (a === '--version') version = args[++i]
  else if (a === '--note') note = args[++i]
  else if (a === '--base') websiteBase = (args[++i] || '').replace(/\/$/, '')
  else if (a === '-h' || a === '--help') {
    console.log(`用法: node scripts/publish-addon-to-site.mjs --file <path> --platform <plat> [--variant 默认版] [--channel addon] [--product chayuan] [--version <ver>] [--note "..."] [--base <url>]
环境: WEBSITE_ADMIN_COOKIE, WEBSITE_BASE`)
    process.exit(0)
  }
}

const adminCookie = process.env.WEBSITE_ADMIN_COOKIE || ''
const CHUNK = 4 * 1024 * 1024 // 4 MB,与 server uploads.js 一致

// ── 校验入参 ──
if (!file) { console.error('缺少 --file'); process.exit(1) }
const filePath = path.isAbsolute(file) ? file : path.resolve(ROOT, file)
if (!fs.existsSync(filePath)) { console.error(`文件不存在: ${filePath}`); process.exit(1) }

const VALID_PLATFORMS = ['windows-amd64', 'windows-arm64', 'mac-arm64', 'mac-x64', 'linux-amd64', 'linux-arm64']
if (!VALID_PLATFORMS.includes(platform)) {
  console.error(`--platform 必须是其一: ${VALID_PLATFORMS.join(' | ')}`)
  process.exit(1)
}

if (!adminCookie) { console.error('缺少 WEBSITE_ADMIN_COOKIE(后台 cy_admin=<jwt>)'); process.exit(1) }

// ── 版本 ──
if (!version) {
  const ij = path.join(RELEASE, 'install-staging', 'install.json')
  if (!fs.existsSync(ij)) { console.error(`缺少 ${ij}(先 npm run build:wps-all)`); process.exit(1) }
  version = String(JSON.parse(fs.readFileSync(ij, 'utf8')).version || '').trim()
}
if (!version) { console.error('无法确定版本(用 --version 指定)'); process.exit(1) }

const filename = path.basename(filePath)
const size = fs.statSync(filePath).size

function sha256File(p) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256')
    const rs = fs.createReadStream(p)
    rs.on('error', reject)
    rs.on('data', (d) => h.update(d))
    rs.on('end', () => resolve(h.digest('hex')))
  })
}
const sha256 = await sha256File(filePath)
const mb = (n) => (n / 1048576).toFixed(1)
console.log(`[publish:addon] ${product}@${version} ${channel}/${platform} variant=${variant}`)
console.log(`[publish:addon] ✓ ${filename} (${mb(size)} MB)  sha256=${sha256.slice(0, 12)}…`)

const base = websiteBase
const headers = { cookie: adminCookie }

// /me 探活
const me = await fetch(`${base}/api/admin/me`, { headers }).catch((e) => {
  console.error(`[publish:addon] 连不上 ${base}: ${e.message}`); process.exit(1)
})
if (me.status !== 200) {
  console.error(`[publish:addon] WEBSITE_ADMIN_COOKIE 无效或过期(/me=${me.status})`); process.exit(1)
}
console.log(`[publish:addon] 已连 ${base},cookie 有效`)

// init
const init = await fetch(`${base}/api/admin/uploads/init`, {
  method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
  body: JSON.stringify({ product, version, channel, platform, filename, size, sha256 })
})
if (!init.ok) { console.error(`[publish:addon] init 失败 ${init.status}: ${await init.text()}`); process.exit(1) }
const { uploadId, totalChunks } = await init.json()
console.log(`[publish:addon] · 上传(uploadId=${uploadId.slice(0, 8)}…, ${totalChunks} 块)`)

// chunk*
const buf = fs.readFileSync(filePath)
for (let idx = 0; idx < totalChunks; idx++) {
  const start = idx * CHUNK
  const chunk = Buffer.from(buf.buffer, buf.byteOffset + start, Math.min(CHUNK, size - start))
  const cr = await fetch(`${base}/api/admin/uploads/${uploadId}/chunk`, {
    method: 'PATCH', headers: { ...headers, 'content-type': 'application/octet-stream', 'x-chunk-index': String(idx) },
    body: chunk
  })
  if (!cr.ok) { console.error(`[publish:addon] chunk ${idx} 失败 ${cr.status}: ${await cr.text()}`); process.exit(1) }
  process.stdout.write(`\r[publish:addon] · 已传 ${idx + 1}/${totalChunks} 块`)
}
process.stdout.write('\n')

// finalize(variant 必填)
const fin = await fetch(`${base}/api/admin/uploads/${uploadId}/finalize`, {
  method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
  body: JSON.stringify({ variant, notes: note || '', primary: false })
})
if (!fin.ok) { console.error(`[publish:addon] finalize 失败 ${fin.status}: ${await fin.text()}`); process.exit(1) }
console.log(`[publish:addon] ✓ finalize(channel=${channel}/${platform}, variant=${variant})`)

// publish(无 variant 段 → 取 primary;新上传首个 variant 自动 primary)
const pub = await fetch(`${base}/api/admin/releases/${product}/${version}/${platform}/publish`, {
  method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}'
})
if (!pub.ok) { console.error(`[publish:addon] publish 失败 ${pub.status}: ${await pub.text()}`); process.exit(1) }
console.log(`[publish:addon] ✓ 已发布 ${product}@${version}/${platform}`)

// push-mirrors(best-effort;server 无 token 会 502,不阻塞)
const push = await fetch(`${base}/api/admin/releases/${product}/${version}/${platform}/push-mirrors`, {
  method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}'
}).catch(() => null)
if (push && push.ok) {
  const pb = await push.json().catch(() => ({}))
  console.log(`[publish:addon] ✓ 推镜像: ${pb.mirrors ? Object.keys(pb.mirrors).join(',') : '(无)'}`)
} else {
  console.log('[publish:addon] · 推镜像跳过(server 无 GITHUB_TOKEN/GITEE_TOKEN,不影响站内下载)')
}

console.log('\n[publish:addon] 完成。')
