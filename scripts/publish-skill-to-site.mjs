#!/usr/bin/env node
/**
 * publish-skill-to-site.mjs —— 把 pack-portable-staging.mjs 产出的技能包发布到官网
 * （aidooo.com，仓库 /Users/zyh/work/website）的下载目录与清单：
 *   1. 复制 release/wps-skill-chayuan-<ver>-portable.{zip,zip.sha256}（+ .7z/.7z.sha256）
 *      → <website>/public/downloads/skill/
 *   2. 更新 <website>/public/downloads/skill-releases.json（按 version upsert + 刷新 latest）
 *
 * 用法：
 *   node scripts/publish-skill-to-site.mjs                                # 默认 website + 读 install.json 版本
 *   node scripts/publish-skill-to-site.mjs --site ../website --version 4.0.0 --note "首个官网发布"
 *
 * 环境变量：WEBSITE_REPO 覆盖默认 website 路径。
 * 前置：先 node scripts/pack-portable-staging.mjs 产出 release/wps-skill-chayuan-<ver>-portable.*。
 *
 * 对应设计：plans/wps-skill-chayuan-design.md；官网清单格式见该 plan「skill-releases.json 格式」。
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const RELEASE = path.join(ROOT, 'release')

// ── 参数 ──
const args = process.argv.slice(2)
let site = process.env.WEBSITE_REPO || '/Users/zyh/work/website'
let version = ''
let note = ''
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--site') site = args[++i]
  else if (a === '--version') version = args[++i]
  else if (a === '--note') note = args[++i]
  else if (a === '-h' || a === '--help') {
    console.log('用法: node scripts/publish-skill-to-site.mjs [--site <website-path>] [--version <ver>] [--note "..."]')
    process.exit(0)
  }
}
site = path.resolve(site)

// ── 版本：默认读 install-staging/install.json ──
if (!version) {
  const ij = path.join(RELEASE, 'install-staging', 'install.json')
  if (!fs.existsSync(ij)) { console.error(`缺少 ${ij}（先 npm run build:wps-all）`); process.exit(1) }
  version = String(JSON.parse(fs.readFileSync(ij, 'utf8')).version || '').trim()
}
if (!version) { console.error('无法确定版本号（用 --version 指定）'); process.exit(1) }
console.log(`[publish:skill] 版本 ${version} → 官网 ${site}`)

// ── 校验产物 ──
const zipName = `wps-skill-chayuan-${version}-portable.zip`
const sevenName = `wps-skill-chayuan-${version}-portable.7z`
const zip = path.join(RELEASE, zipName)
const zipSha = path.join(RELEASE, zipName + '.sha256')
if (!fs.existsSync(zip) || !fs.existsSync(zipSha)) {
  console.error(`缺少 ${zipName} / .sha256（先 node scripts/pack-portable-staging.mjs）`)
  process.exit(1)
}
if (!fs.existsSync(path.join(site, 'public', 'downloads'))) {
  console.error(`目标不像官网仓库：${site}/public/downloads 不存在（用 --site 指定 website 根）`)
  process.exit(1)
}

// 官网目录
const destDir = path.join(site, 'public', 'downloads', 'skill')
await fsp.mkdir(destDir, { recursive: true })

const readSha = (p) => String(fs.readFileSync(p, 'utf8')).split(/\s+/)[0].trim()
const mb = (n) => (n / 1048576).toFixed(1)

// ── 复制 zip + sha256 ──
const zipHash = readSha(zipSha)
await fsp.copyFile(zip, path.join(destDir, zipName))
await fsp.copyFile(zipSha, path.join(destDir, zipName + '.sha256'))
console.log(`[publish:skill] ✓ ${zipName} (${mb(fs.statSync(zip).size)} MB)  sha256=${zipHash.slice(0, 12)}…`)

// ── 可选 7z ──
let alt7z = null
const seven = path.join(RELEASE, sevenName)
const sevenSha = path.join(RELEASE, sevenName + '.sha256')
if (fs.existsSync(seven) && fs.existsSync(sevenSha)) {
  const h7 = readSha(sevenSha)
  await fsp.copyFile(seven, path.join(destDir, sevenName))
  await fsp.copyFile(sevenSha, path.join(destDir, sevenName + '.sha256'))
  alt7z = { url: `/downloads/skill/${sevenName}`, sha256: h7, size: fs.statSync(seven).size }
  console.log(`[publish:skill] ✓ ${sevenName} (${mb(fs.statSync(seven).size)} MB)`)
}

// ── 镜像 URL（gitee / github tag 形态，与 release/mirrors.json 一致）──
const mirrors = {
  gitee: `https://gitee.com/cloudshd/chayuan-wps-releases/releases/download/v${version}/${zipName}`,
  github: `https://github.com/zhgyuhuii/chayuan/releases/download/v${version}/${zipName}`,
}

// ── upsert skill-releases.json ──
const manifestPath = path.join(site, 'public', 'downloads', 'skill-releases.json')
let manifest = { package: 'wps-skill-chayuan', latest: '', releases: [] }
if (fs.existsSync(manifestPath)) {
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) } catch { /* 损坏则重建 */ }
}
if (!Array.isArray(manifest.releases)) manifest.releases = []
manifest.package = 'wps-skill-chayuan'

const today = new Date().toISOString().slice(0, 10)
const entry = {
  version,
  url: `/downloads/skill/${zipName}`,
  sha256: zipHash,
  size: fs.statSync(zip).size,
  ...(alt7z ? { alt7z } : {}),
  mirrors,
  publishedAt: today,
  notes: note || '',
}

// upsert：同 version 替换；note 为空时保留旧 notes
const idx = manifest.releases.findIndex((r) => r && r.version === version)
if (idx >= 0) {
  if (!note && manifest.releases[idx].notes) entry.notes = manifest.releases[idx].notes
  manifest.releases[idx] = entry
  console.log(`[publish:skill] · 更新既有条目 ${version}`)
} else {
  manifest.releases.unshift(entry)
  console.log(`[publish:skill] · 新增条目 ${version}`)
}

// latest = 最高版本号（semver 粗比较，DESC）
const cmpDesc = (a, b) => {
  const pa = String(a).split(/[.-]/).map((x) => parseInt(x, 10))
  const pb = String(b).split(/[.-]/).map((x) => parseInt(x, 10))
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = Number.isFinite(pa[i]) ? pa[i] : 0
    const vb = Number.isFinite(pb[i]) ? pb[i] : 0
    if (va !== vb) return vb - va
  }
  return 0
}
manifest.latest = manifest.releases.map((r) => r.version).sort(cmpDesc)[0]

await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
console.log(`[publish:skill] ✓ skill-releases.json 已更新，latest=${manifest.latest}（共 ${manifest.releases.length} 条）`)

console.log('\n[publish:skill] 下一步：')
console.log(`  cd "${site}"`)
console.log('  git add public/downloads/skill/.gitkeep public/downloads/skill-releases.json')
console.log(`  git commit -m "chore(downloads): 发布 wps-skill-chayuan ${version}"`)
console.log('  部署：把 public/downloads/skill/ 下的压缩包随生产下载卷上线（二进制已被 .gitignore 忽略，不进 git）')
console.log(`  （可选）把 ${zipName} + .sha256 上传到 Gitee / GitHub 的 v${version} release`)
