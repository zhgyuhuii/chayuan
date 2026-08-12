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
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const _7z = require('node-7z')
const _7zBin = require('7zip-bin')

// Windows 上 URL.pathname 会带前导 /（/D:/...），path.resolve 会变成 D:\D:\...；必须用 fileURLToPath。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
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
const requestedBins = platforms.length
  ? ALL_BINS.filter(b => platforms.some(p => b.includes(p)))
  : ALL_BINS
if (!requestedBins.length) { console.error('未选中任何二进制，检查 --platform'); process.exit(1) }

// ── 校验前置 ──
const installStaging = path.join(RELEASE, 'install-staging')
const installJson = path.join(installStaging, 'install.json')
if (!fs.existsSync(installJson)) {
  console.error('缺少 release/install-staging/install.json，请先 npm run build:wps-all')
  console.error(`(resolved ROOT=${ROOT})`)
  process.exit(1)
}
const meta = JSON.parse(fs.readFileSync(installJson, 'utf8'))
const sidecarDir = path.join(ROOT, 'mcp-sidecar')
const missingBins = requestedBins.filter(b => !fs.existsSync(path.join(sidecarDir, 'bin', b)))
let selectedBins = requestedBins
if (missingBins.length) {
  if (platforms.length) {
    // 显式 --platform 时缺文件仍硬失败，避免误发残包
    for (const b of missingBins) console.error(`缺少 mcp-sidecar/bin/${b}（跑 scripts/build-mcp-binary.mjs）`)
    process.exit(1)
  }
  // 未指定平台：只打本机已有二进制（常见于 Windows 只编了 windows-x64）
  selectedBins = requestedBins.filter(b => !missingBins.includes(b))
  if (!selectedBins.length) {
    console.error('mcp-sidecar/bin/ 下没有任何目标二进制（跑 scripts/build-mcp-binary.mjs）')
    process.exit(1)
  }
  console.warn(`[pack] 警告：缺 ${missingBins.length} 个平台二进制，仅打包已有：${selectedBins.join(', ')}`)
  console.warn(`[pack] 需要全平台时先：npm run mcp:build-binary，或加 --platform windows-x64 等显式选择`)
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
  if (fs.statSync(s).isDirectory()) {
    // Windows：部分杀软会把 autostart/*.ps1 误报为 TrojanDownloader/PS.* 并隔离；
    // 自启改用 .cmd，打包时显式跳过该目录下任何 .ps1，避免用户解压即中招。
    if (entry === 'autostart') {
      const destAuto = path.join(pkgSidecar, 'autostart')
      fs.mkdirSync(destAuto, { recursive: true })
      for (const f of fs.readdirSync(s)) {
        if (/\.ps1$/i.test(f)) {
          console.warn(`[pack] 跳过易误报文件 mcp-sidecar/autostart/${f}`)
          continue
        }
        await fsp.copyFile(path.join(s, f), path.join(destAuto, f))
      }
    } else {
      await copy(s, path.join(pkgSidecar, entry))
    }
  } else {
    await fsp.copyFile(s, path.join(pkgSidecar, entry))
  }
}
// install-staging 内嵌的 mcp-sidecar/autostart/*.ps1 同样剔除
const nestedAuto = path.join(PKG, 'install-staging', meta.addonFolder, 'mcp-sidecar', 'autostart')
if (fs.existsSync(nestedAuto)) {
  for (const f of fs.readdirSync(nestedAuto)) {
    if (/\.ps1$/i.test(f)) {
      fs.rmSync(path.join(nestedAuto, f), { force: true })
      console.warn(`[pack] 已从 install-staging 剔除 mcp-sidecar/autostart/${f}`)
    }
  }
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
    { name: 'gitee',  url: 'https://gitee.com/cloudshd/chayuan-wps-releases/releases/download/v${version}/wps-skill-chayuan-${version}-portable.zip' },
    { name: 'aidooo', url: 'https://aidooo.com/downloads/skill/wps-skill-chayuan-${version}-portable.zip' },
    { name: 'github', url: 'https://github.com/zhgyuhuii/chayuan/releases/download/v${version}/wps-skill-chayuan-${version}-portable.zip' },
  ],
}
fs.writeFileSync(path.join(PKG, 'mirrors.json'), JSON.stringify(mirrors, null, 2) + '\n')
fs.writeFileSync(path.join(RELEASE, 'mirrors.json'), JSON.stringify(mirrors, null, 2) + '\n')

// 5c) 安装说明.txt —— 解压后用户第一眼看到的离线说明。
//     Windows 记事本(尤其 Win7/8/旧 Win10)对无 BOM 的 UTF-8 会按 GBK 解码导致中文乱码，
//     所以这里强制写 UTF-8 BOM(EF BB BF) + CRLF 行尾，保证双击即正确显示中文。
const readmeBody = `
═══════════════════════════════════════════════════════════
  察元 · wps-skill-chayuan  技能包   v${meta.version}
  让 AI 编程智能体直接操作 WPS 文档 · 离线一键安装
═══════════════════════════════════════════════════════════

【这是什么】
本包让 Claude Code / Cursor / Codex 等 AI 编程智能体直接读写 WPS 文档。
一条命令同时装好三样东西：
  1. WPS 加载项（察元AI文档助手）
  2. MCP sidecar（本地常驻 127.0.0.1:62588，无需 Token）
  3. 各智能体的技能文件（自动检测已装的 Claude / Cursor / Codex 并按各自格式投放）

【一分钟安装】
解压后进入 wps-skill-chayuan 目录，按你的系统运行一条命令：

  · macOS / Linux（终端里执行）：
      bash scripts/install-wps-skill-chayuan.sh

  · Windows（PowerShell 里执行）：
      powershell -ExecutionPolicy Bypass -File scripts\\install-wps-skill-chayuan.ps1

安装器会自动完成：
  ✓ 检测并部署技能到 Claude Code / Cursor / Codex
  ✓ 把加载项装进 WPS jsaddons（装完需重启 WPS）
  ✓ 启动 MCP 并设置开机自启
  ✓ 跑四级自检：加载项 / sidecar / MCP / agent 投放

装完后，在智能体里对当前 WPS 文档说一句即可验证：
    用察元打开当前文档，检查保密风险

【只拿到脚本、需要补下载载荷？】
本包是离线整包，正常安装不联网。若只拿到安装脚本，加 --fetch / -Fetch
会从多源（官网 / Gitee / GitHub）回退下载，并用 sha256 强校验整包：
    bash scripts/install-wps-skill-chayuan.sh --fetch
    powershell -ExecutionPolicy Bypass -File scripts\\install-wps-skill-chayuan.ps1 -Fetch

【按智能体的精确位置（手工兜底；正常一键安装无需看）】
  · Claude Code    ~/.claude/skills/wps-skill-chayuan/SKILL.md
  · Cursor         ~/.cursor/rules/wps-skill-chayuan.mdc
  · Codex CLI      ~/.codex/prompts/wps-skill-chayuan.md
                   + ~/.codex/config.toml 里的 [mcp_servers.chayuan-wps-mcp]
  · 其它 GUI 智能体（OpenClaw / Hermes 等）
                   走 MCP HTTP：http://127.0.0.1:62588/mcp

【安全说明】
  · MCP 仅监听本机 127.0.0.1:62588，不对外、无需 Token。
  · 涉密文档建议使用离线模型，正文不出本机。
  · 保密检查 / AI 痕迹检查结果仅作辅助参考，不替代人工定密，不构成司法结论。
  · 离线整包发布带 sha256 强校验，防供应链篡改。

【本包目录】
  install-staging/         WPS 加载项
  mcp-sidecar/             MCP 服务（含各平台二进制）
  skill-chayuan/           各智能体技能模板
  scripts/                 安装脚本 install-wps-skill-chayuan.{sh,ps1}
  portable.manifest.json   版本 / 端口 / 启动命令
  checksums.sha256         逐文件校验值
  mirrors.json             多源下载地址（--fetch 用）

【常用选项】
  --with-all / -WithAll      强制部署到 Claude + Cursor + Codex
  --no-agent / -NoAgent      跳过 agent 投放，只装加载项 + MCP
  --skill-only / -SkillOnly  只装运行时技能，不动加载项
  -h / -Help                 查看完整帮助

【卸载（手动）】
本包暂未提供一键卸载。手动清理：
  · 技能文件：~/.claude/skills/wps-skill-chayuan、~/.cursor/rules/wps-skill-chayuan.mdc、
              ~/.codex/prompts/wps-skill-chayuan.md（删对应条目即可）
  · WPS 加载项：
      Windows  %APPDATA%\\kingsoft\\wps\\jsaddons\\chayuan_<版本> 与同目录 publish.xml
      macOS    ~/Library/Application Support/Kingsoft/wps/jsaddons/chayuan_<版本>
  · MCP 自启：
      macOS    launchctl bootout gui/<uid>/com.chayuan.mcp（或删除 ~/Library/LaunchAgents/com.chayuan.mcp.plist 后 kill 62588 进程）
      Windows  删除注册表 HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run 下的 ChayuanWpsMcp 值后结束 62588 进程

完整介绍与按智能体的图文安装指南：
    https://aidooo.com/skill

—— 察元 · 使文档智能且安全
`.replace(/^\r?\n/, '').replace(/\r?\n/g, '\r\n')   // 去掉首行空行 + 统一 CRLF，Windows 记事本友好
fs.writeFileSync(path.join(PKG, '安装说明.txt'), '﻿' + readmeBody, 'utf8')   // ﻿ = UTF-8 BOM
fs.writeFileSync(path.join(RELEASE, '安装说明.txt'), '﻿' + readmeBody, 'utf8')   // 同步一份到 release/ 便于单独取用

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
