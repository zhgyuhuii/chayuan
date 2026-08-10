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
  const candidates = [process.env.BUN, process.env.BUN_INSTALL && path.join(process.env.BUN_INSTALL, 'bin', 'bun'), 'bun']
    .filter(Boolean)
  for (const c of candidates) {
    try {
      execFileSync(c, ['--version'], { stdio: 'ignore' })
      return c
    } catch { /* try next */ }
  }
  console.error('未找到 bun。请先安装：curl -fsSL https://bun.sh/install | bash')
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
  execFileSync(bunBin, [
    'build', '--compile',
    '--target', target.bun,
    '--outfile', outfile,
    ENTRY
  ], { stdio: 'inherit', cwd: ROOT })
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
