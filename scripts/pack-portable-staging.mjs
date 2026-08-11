#!/usr/bin/env node
/**
 * pack-portable-staging.mjs —— 把直装所需的全部载荷打成 portable 压缩包（非安装器）
 *
 * 产出：release/wps-skill-chayuan-<ver>-portable.7z（内含 wps-skill-chayuan/ 根）
 *   install-staging/   加载项 + install.json + publish.xml
 *   mcp-sidecar/       bin/(按 --platform 过滤) + server.mjs + lib + autostart + start-mcp.*
 *   skill-chayuan/     L2a agent-driver 模板（SKILL.md + ensure-mcp.sh）
 *   scripts/           install-wps-skill-chayuan.{sh,ps1}
 *   portable.manifest.json
 *   checksums.sha256   （对 manifest + 各 payload 文件的 sha256，供直装脚本第三级回落下载后强校验）
 *
 * 用法：
 *   node scripts/pack-portable-staging.mjs                      # 全平台二进制（包大）
 *   node scripts/pack-portable-staging.mjs --platform macos-arm64 --platform windows-x64
 *
 * 前置：先 npm run build:wps-all 产出 release/install-staging，并 mcp-sidecar/bin/ 有二进制。
 */
import { createRequire } from 'module'
import path from 'node:path'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import crypto from 'node:crypto'

const require = createRequire(import.meta.url)
const _7z = require('node-7z')
const _7zBin = require('7zip-bin')

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const RELEASE = path.join(ROOT, 'release')
const STAGING_ROOT = path.join(RELEASE, '.portable-staging')
const PKG = path.join(STAGING_ROOT, 'wps-skill-chayuan')

// ── 参数 ──
const platforms = []
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a === '--platform') { platforms.push(process.argv[++i]); continue }
  if (a === '-h' || a === '--help') {
    console.log('用法: node scripts/pack-portable-staging.mjs [--platform <plat-arch>] ...'); process.exit(0)
  }
}

const ALL_BINS = [
  'chayuan-mcp-windows-x64.exe',
  'chayuan-mcp-macos-arm64', 'chayuan-mcp-macos-x64',
  'chayuan-mcp-linux-x64', 'chayuan-mcp-linux-arm64',
]
const selectedBins = platforms.length
  ? ALL_BINS.filter(b => platforms.some(p => b.includes(p.replace('-', '-'))))
  : ALL_BINS
if (!selectedBins.length) { console.error('未选中任何二进制，检查 --platform'); process.exit(1) }

// ── 校验前置 ──
const installStaging = path.join(RELEASE, 'install-staging')
const installJson = path.join(installStaging, 'install.json')
if (!fs.existsSync(installJson)) {
  console.error('缺少 release/install-staging/install.json，请先 npm run build:wps-all'); process.exit(1)
}
const meta = JSON.parse(fs.readFileSync(installJson, 'utf8'))
const sidecarDir = path.join(ROOT, 'mcp-sidecar')
for (const b of selectedBins) {
  if (!fs.existsSync(path.join(sidecarDir, 'bin', b))) {
    console.error(`缺少 mcp-sidecar/bin/${b}（跑 scripts/build-mcp-binary.mjs）`); process.exit(1)
  }
}

// ── 准备 staging 目录 ──
console.log('[pack] 清理并重建 staging ...')
fs.rmSync(STAGING_ROOT, { recursive: true, force: true })
fs.mkdirSync(PKG, { recursive: true })

const copy = async (src, dest) => {
  await fsp.cp(src, dest, { recursive: true, force: true })
}

// 1) install-staging（加载项载荷）
await copy(installStaging, path.join(PKG, 'install-staging'))

// 2) mcp-sidecar：bin(过滤) + 运行所需文件
const pkgSidecar = path.join(PKG, 'mcp-sidecar')
fs.mkdirSync(path.join(pkgSidecar, 'bin'), { recursive: true })
for (const b of selectedBins) {
  await fsp.copyFile(path.join(sidecarDir, 'bin', b), path.join(pkgSidecar, 'bin', b))
}
for (const entry of fs.readdirSync(sidecarDir)) {
  const s = path.join(sidecarDir, entry)
  if (entry === 'bin' || entry === 'build' || entry === 'data' || entry === 'node_modules') continue
  if (fs.statSync(s).isDirectory()) await copy(s, path.join(pkgSidecar, entry))
  else await fsp.copyFile(s, path.join(pkgSidecar, entry))
}

// 3) skill-chayuan 模板
const skillTmpl = path.join(ROOT, 'skill-chayuan')
if (fs.existsSync(skillTmpl)) await copy(skillTmpl, path.join(PKG, 'skill-chayuan'))
else console.warn('[pack] 警告：skill-chayuan/ 模板不存在，跳过 L2a')

// 4) 直装脚本
const pkgScripts = path.join(PKG, 'scripts'); fs.mkdirSync(pkgScripts, { recursive: true })
for (const f of ['install-wps-skill-chayuan.sh', 'install-wps-skill-chayuan.ps1']) {
  const src = path.join(ROOT, 'scripts', f)
  if (fs.existsSync(src)) await fsp.copyFile(src, path.join(pkgScripts, f))
}

// 5) portable.manifest.json
const manifest = {
  name: 'wps-skill-chayuan',
  version: meta.version,
  addonFolder: meta.addonFolder,
  mcp: { port: 62588, minVersion: '0.5.0', bins: selectedBins },
  createdAt: new Date().toISOString(),
  install: {
    macos: 'bash scripts/install-wps-skill-chayuan.sh',
    linux: 'bash scripts/install-wps-skill-chayuan.sh',
    windows: 'powershell -ExecutionPolicy Bypass -File scripts\\install-wps-skill-chayuan.ps1',
  },
}
fs.writeFileSync(path.join(PKG, 'portable.manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

// 5b) mirrors.json —— 分发源清单（GitHub 被墙时的备用地址；${version} 在下载时替换）
//     注意：URL 用单引号串，${version} 必须保持字面量（不能被 JS 模板字符串吃掉）。
const mirrors = {
  version: 1,
  package: 'wps-skill-chayuan',
  note: 'URL 中的 ${version} 在下载时替换为实际版本。每个源都应提供同名 .sha256；安装器下载后强校验，任一源被篡改都不会通过。',
  sources: [
    { name: 'gitee',  url: 'https://gitee.com/zhgyuhuii/chayuan/releases/download/v${version}/wps-skill-chayuan-${version}-portable.zip' },
    { name: 'aidooo', url: 'https://aidooo.com/dl/wps-skill-chayuan/${version}/wps-skill-chayuan-${version}-portable.zip' },
    { name: 'github', url: 'https://github.com/zhgyuhuii/chayuan/releases/download/v${version}/wps-skill-chayuan-${version}-portable.zip' },
  ],
}
fs.writeFileSync(path.join(PKG, 'mirrors.json'), JSON.stringify(mirrors, null, 2) + '\n')
fs.writeFileSync(path.join(RELEASE, 'mirrors.json'), JSON.stringify(mirrors, null, 2) + '\n')

// 6) checksums（递归算 staging 内所有文件 sha256）
const hashes = []
const walk = async (dir, base = '') => {
  for (const entry of await fsp.readdir(dir)) {
    const full = path.join(dir, entry)
    const rel = base ? `${base}/${entry}` : entry
    const st = await fsp.stat(full)
    if (st.isDirectory()) await walk(full, rel)
    else {
      const buf = await fsp.readFile(full)
      hashes.push({ file: rel, sha256: crypto.createHash('sha256').update(buf).digest('hex'), bytes: st.size })
    }
  }
}
await walk(PKG)
fs.writeFileSync(path.join(PKG, 'checksums.sha256'),
  hashes.map(h => `${h.sha256}  wps-skill-chayuan/${h.file}`).join('\n') + '\n')

console.log(`[pack] staging 就绪：${selectedBins.length} 个二进制，${hashes.length} 个文件`)

// ── 打包：ZIP 主 + 7z 备（各自带 .sha256）──
if (process.platform !== 'win32' && _7zBin.path7za && fs.existsSync(_7zBin.path7za)) {
  try { fs.chmodSync(_7zBin.path7za, 0o755) } catch { /* ignore */ }
}
const archiveOf = async (ext) => {
  const archive = path.join(RELEASE, `wps-skill-chayuan-${meta.version}-portable.${ext}`)
  fs.rmSync(archive, { force: true })
  console.log(`[pack] 压缩 → ${path.relative(ROOT, archive)} ...`)
  await new Promise((resolve, reject) => {
    // 7za 按扩展名选格式：.zip → ZIP（系统原生可解），.7z → 7z（体积更小）
    const stream = _7z.add(archive, [PKG], { recursive: true, $bin: _7zBin.path7za })
    stream.on('end', resolve)
    stream.on('error', reject)
  })
  const hash = crypto.createHash('sha256').update(await fsp.readFile(archive)).digest('hex')
  fs.writeFileSync(archive + '.sha256', `${hash}  ${path.basename(archive)}\n`)
  const sizeMB = (fs.statSync(archive).size / 1048576).toFixed(1)
  console.log(`[pack] ✓ ${path.relative(ROOT, archive)}  (${sizeMB} MB)  sha256=${hash}`)
}
await archiveOf('zip')   // 主分发：Windows 资源管理器 / macOS Finder 原生解压，国内非技术用户零摩擦
await archiveOf('7z')    // 备选：体积更小，需 7z 解压工具
console.log('[pack] 用户侧：安装器 --fetch 多源回退下载 .zip，用 .zip.sha256 强校验整包；包内 checksums.sha256 逐文件校验 payload')
console.log('[pack] 提示：ZIP 解压会丢 unix 执行位，安装器已对 mcp-sidecar/bin 兜底 chmod +x')
