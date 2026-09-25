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
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

/** 定位 bun 可执行文件；找不到返回 null（不退出，供打包脚本按需降级）。 */
export function findBun() {
  // Windows 上 npm 全局装的 bun 常是 bun.cmd/bun.ps1 包装器，execFileSync('bun') 会失败；
  // 需直接定位 bun.exe（BUN 环境变量、BUN_INSTALL、npm 全局 node_modules、where）。
  const candidates = []
  if (process.env.BUN) candidates.push(process.env.BUN)
  if (process.env.BUN_INSTALL) {
    candidates.push(path.join(process.env.BUN_INSTALL, 'bin', 'bun.exe'))
    candidates.push(path.join(process.env.BUN_INSTALL, 'bin', 'bun'))
  }
  // bun 官方安装脚本默认装到 ~/.bun/bin/bun（不在 PATH 时最常见的遗漏位置）
  try {
    candidates.push(path.join(os.homedir(), '.bun', 'bin', 'bun.exe'))
    candidates.push(path.join(os.homedir(), '.bun', 'bin', 'bun'))
  } catch { /* ignore */ }
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
  return null
}

function pickTargets() {
  const argv = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  if (!argv.length) return TARGETS
  return TARGETS.filter((t) => {
    const short = t.file.replace(/^chayuan-mcp-/, '').replace(/\.exe$/, '') // windows-x64 / macos-arm64 …
    return argv.includes(short) || argv.includes(t.bun)
  })
}

/**
 * 把 Bun 产出的 Windows exe 从控制台子系统(CUI=3)改写为 GUI 子系统(2)，
 * 与 bun 在 Windows 主机上编译时 --windows-hide-console 的效果等效：
 * 双击/ShellExecute 直启不再弹常驻黑窗（sidecar 走 HTTP 端口，不依赖控制台 stdio）。
 * 改的是 PE Optional Header 的 Subsystem 字段（e_lfanew+92，PE32/PE32+ 同偏移）；
 * Windows 加载器不校验用户态 exe 的 CheckSum，改后可直接运行。
 * 任何结构校验不过都原样保留（启动路径仍有 start-mcp.cmd 隐藏拉起兜底）。
 */
function patchPeSubsystemToGui(exePath) {
  const buf = fs.readFileSync(exePath)
  if (buf.length < 0x40 + 4 || buf.readUInt16LE(0) !== 0x5a4d) { // 'MZ'
    return 'skip: 不是 PE(MZ) 文件'
  }
  const peOff = buf.readUInt32LE(0x3c)
  if (peOff <= 0 || peOff + 4 + 20 + 70 > buf.length || buf.readUInt32LE(peOff) !== 0x00004550) { // 'PE\0\0'
    return 'skip: PE 头定位失败'
  }
  const subsystemOff = peOff + 4 + 20 + 68
  const subsystem = buf.readUInt16LE(subsystemOff)
  if (subsystem === 2) return 'skip: 已是 GUI 子系统'
  if (subsystem !== 3) return `skip: 未知子系统值 ${subsystem}`
  buf.writeUInt16LE(2, subsystemOff)
  fs.writeFileSync(exePath, buf)
  return 'patched'
}

function packOne(bunBin, target) {
  // windows 目标 Bun 会自动补 .exe，故 outfile 给不带扩展名的主干
  const stem = target.file.replace(/\.exe$/, '')
  const outfile = path.join(BIN_DIR, stem)
  const baseArgs = [
    'build', '--compile',
    '--target', target.bun,
    '--outfile', outfile,
  ]
  // Windows 控制台子系统默认会弹黑窗；安装器/开机自启需要无窗口后台常驻。
  // bun 1.3.x 只允许在 Windows 主机上编译时用 --windows-hide-console，mac/Linux
  // 交叉编译会被拒：先编控制台版，再把 PE Subsystem 改写为 GUI，效果等效。
  // 两者都不成立时仍有 start-mcp.cmd 隐藏拉起兜底（缺 exe 则 Windows 安装直接
  // 失败回落 node server.mjs，两害取其轻）。
  if (target.bun.startsWith('bun-windows-')) {
    if (process.platform === 'win32') {
      execFileSync(bunBin, [...baseArgs, '--windows-hide-console', ENTRY], { stdio: 'inherit', cwd: ROOT })
    } else {
      execFileSync(bunBin, [...baseArgs, ENTRY], { stdio: 'inherit', cwd: ROOT })
      const r = patchPeSubsystemToGui(path.join(BIN_DIR, target.file))
      if (r === 'patched') {
        console.log('[ok] PE 子系统 CUI→GUI（等效 --windows-hide-console，直启/双击不弹黑窗）')
      } else {
        console.warn(`[warn] 未能改写 PE 子系统（${r}），产物为控制台版——请经 start-mcp.cmd 隐藏拉起`)
      }
    }
  } else {
    execFileSync(bunBin, [...baseArgs, ENTRY], { stdio: 'inherit', cwd: ROOT })
  }
  const produced = path.join(BIN_DIR, target.file)
  if (!fs.existsSync(produced)) {
    throw new Error(`预期产物未生成：${produced}`)
  }
  if (!target.file.endsWith('.exe')) {
    try { fs.chmodSync(produced, 0o755) } catch { /* ignore */ }
  }
  console.log(`[ok] ${target.bun} → ${path.relative(ROOT, produced)} (${fs.statSync(produced).size} bytes)`)
}

/**
 * 重编全部（或指定）sidecar 目标。供打包脚本在暂存前自动调用，
 * 保证安装包内永远内置与 mcp-sidecar/ 源码一致的二进制。
 * @returns {{ok: number, failed: number, targets: Array}} 编译结果统计
 */
export function rebuildSidecarBinaries(targetShortNames) {
  const bunBin = findBun()
  if (!bunBin) {
    throw new Error('未找到 bun。请先安装：npm install -g bun  或  https://bun.sh')
  }
  const targets = targetShortNames?.length
    ? TARGETS.filter((t) => targetShortNames.includes(t.file.replace(/^chayuan-mcp-/, '').replace(/\.exe$/, '')))
    : TARGETS
  if (!targets.length) {
    throw new Error(`No matching targets. Known: ${TARGETS.map((t) => t.file.replace(/^chayuan-mcp-/, '').replace(/\.exe$/, '')).join(', ')}`)
  }
  fs.mkdirSync(BIN_DIR, { recursive: true })
  console.log(`[sidecar] rebuilding ${targets.length} target(s): ${targets.map((t) => t.bun).join(', ')}`)
  let failed = 0
  for (const t of targets) {
    try {
      packOne(bunBin, t)
    } catch (e) {
      failed++
      console.error(`[FAIL] ${t.bun}: ${e?.message || e}`)
    }
  }
  console.log(`[sidecar] done. ${targets.length - failed}/${targets.length} ok → ${path.relative(ROOT, BIN_DIR)}/`)
  return { ok: targets.length - failed, failed, targets }
}

function main() {
  const targets = pickTargets()
  if (!targets.length) {
    console.error('No matching targets. Known:', TARGETS.map((t) => t.file.replace(/^chayuan-mcp-/, '').replace(/\.exe$/, '')).join(', '))
    process.exit(1)
  }
  try {
    const r = rebuildSidecarBinaries(
      targets.map((t) => t.file.replace(/^chayuan-mcp-/, '').replace(/\.exe$/, ''))
    )
    if (r.failed) process.exitCode = 1
  } catch (e) {
    console.error(e?.message || e)
    process.exit(1)
  }
}

// 仅作为命令直接执行时跑 main；被 import（build-wps-addon 等）时只暴露函数
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
