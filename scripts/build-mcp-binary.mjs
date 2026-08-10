#!/usr/bin/env node
/**
 * 编译察元 MCP sidecar 为单文件二进制（无需目标机安装 Node.js）。
 *
 * 用 Bun 的 `build --compile` 交叉编译：内嵌 Bun 运行时，从一台机器即可产出
 * Windows / macOS / Linux 多架构二进制。sidecar 仅用 node 内置模块（http/fs/crypto/
 * child_process 等）+ 本地模块，零 npm 依赖，Bun 兼容性已验证（healthz + 域目录工具通过）。
 *
 * 为什么不用 pkg：pkg v6 在拿不到 GitHub 预编译时会回退到本地编译 Node/V8 源码，
 * 既慢又占满磁盘，且无法在 macOS 上交叉编译 Windows/Linux。Bun 直接交叉编译、无需下载。
 *
 * 用法（需先装 bun，见 https://bun.sh）：
 *   npm run mcp:build-binary                  # 编译全部目标
 *   node scripts/build-mcp-binary.mjs macos-arm64 linux-x64   # 只编译指定目标
 *
 * 产物：mcp-sidecar/bin/chayuan-mcp-<platform>-<arch>[.exe]
 * 命名与 build-wps-addon 暂存逻辑 / autostart 脚本共享同一套 platform/arch token
 * （windows / macos / linux，x64 / arm64）。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SIDECAR_DIR = path.join(ROOT, 'mcp-sidecar')
const ENTRY = path.join(SIDECAR_DIR, 'server.mjs')
const BIN_DIR = path.join(SIDECAR_DIR, 'bin')

// Bun target → 产物文件名。platform/arch token 与 release triple 对齐。
const TARGETS = [
  { bun: 'bun-windows-x64', file: 'chayuan-mcp-windows-x64.exe' },
  { bun: 'bun-darwin-arm64', file: 'chayuan-mcp-macos-arm64' },
  { bun: 'bun-darwin-x64', file: 'chayuan-mcp-macos-x64' },
  { bun: 'bun-linux-x64', file: 'chayuan-mcp-linux-x64' },
  { bun: 'bun-linux-arm64', file: 'chayuan-mcp-linux-arm64' }
]

function findBun() {
  // Windows 上 npm 全局装的 bun 常是 bun.cmd/bun.ps1 包装器，execFileSync('bun') 会失败；
  // 需直接定位 bun.exe（BUN 环境变量、BUN_INSTALL、npm 全局 node_modules、where）。
  const candidates = []
  if (process.env.BUN) candidates.push(process.env.BUN)
  if (process.env.BUN_INSTALL) {
    candidates.push(path.join(process.env.BUN_INSTALL, 'bin', 'bun.exe'))
    candidates.push(path.join(process.env.BUN_INSTALL, 'bin', 'bun'))
  }
  try {
    const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
    candidates.push(path.join(npmRoot, 'bun', 'bin', 'bun.exe'))
    candidates.push(path.join(npmRoot, 'bun', 'bin', 'bun'))
  } catch { /* ignore */ }
  if (process.platform === 'win32') {
    try {
      const whereOut = execFileSync('where.exe', ['bun'], { encoding: 'utf8' })
      for (const line of whereOut.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
        if (/\.exe$/i.test(line)) candidates.push(line)
        // bun.cmd 旁通常有 node_modules\bun\bin\bun.exe（见 npm 全局布局）
        const npmStyle = path.join(path.dirname(line), 'node_modules', 'bun', 'bin', 'bun.exe')
        candidates.push(npmStyle)
      }
    } catch { /* ignore */ }
    candidates.push('bun.exe')
  }
  candidates.push('bun')

  for (const c of candidates.filter(Boolean)) {
    try {
      if (c.includes(path.sep) || c.includes('/') || /\.exe$/i.test(c)) {
        if (!fs.existsSync(c)) continue
      }
      execFileSync(c, ['--version'], { stdio: 'ignore' })
      return c
    } catch { /* try next */ }
  }
  console.error('未找到 bun。请先安装：npm install -g bun  或  https://bun.sh')
  process.exit(1)
}

function pickTargets() {
  const argv = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  if (!argv.length) return TARGETS
  return TARGETS.filter((t) => {
    const short = t.file.replace(/^chayuan-mcp-/, '').replace(/\.exe$/, '') // windows-x64 / macos-arm64 …
    return argv.includes(short) || argv.includes(t.bun)
  })
}

function packOne(bunBin, target) {
  // windows 目标 Bun 会自动补 .exe，故 outfile 给不带扩展名的主干
  const stem = target.file.replace(/\.exe$/, '')
  const outfile = path.join(BIN_DIR, stem)
  const args = [
    'build', '--compile',
    '--target', target.bun,
    '--outfile', outfile,
  ]
  // Windows 控制台子系统默认会弹黑窗；安装器/开机自启需要无窗口后台常驻。
  if (target.bun.startsWith('bun-windows-')) {
    args.push('--windows-hide-console')
  }
  args.push(ENTRY)
  execFileSync(bunBin, args, { stdio: 'inherit', cwd: ROOT })
  const produced = path.join(BIN_DIR, target.file)
  if (!fs.existsSync(produced)) {
    throw new Error(`预期产物未生成：${produced}`)
  }
  if (!target.file.endsWith('.exe')) {
    try { fs.chmodSync(produced, 0o755) } catch { /* ignore */ }
  }
  console.log(`[ok] ${target.bun} → ${path.relative(ROOT, produced)} (${fs.statSync(produced).size} bytes)`)
}

function main() {
  const bunBin = findBun()
  const targets = pickTargets()
  if (!targets.length) {
    console.error('No matching targets. Known:', TARGETS.map((t) => t.file.replace(/^chayuan-mcp-/, '').replace(/\.exe$/, '')).join(', '))
    process.exit(1)
  }
  fs.mkdirSync(BIN_DIR, { recursive: true })
  console.log(`Building ${targets.length} target(s) with Bun: ${targets.map((t) => t.bun).join(', ')}`)
  let failed = 0
  for (const t of targets) {
    try {
      packOne(bunBin, t)
    } catch (e) {
      failed++
      console.error(`[FAIL] ${t.bun}: ${e?.message || e}`)
    }
  }
  if (failed) process.exitCode = 1
  console.log(`Done. ${targets.length - failed}/${targets.length} ok. Artifacts in ${path.relative(ROOT, BIN_DIR)}/`)
}

main()
