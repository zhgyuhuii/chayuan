#!/usr/bin/env node
/**
 * audit-dark-mode.mjs — 扫描硬编码白色 / 黑色 / hex 颜色
 *
 * 在 .vue / .css 文件中找:
 *   background: #fff / #ffffff / white
 *   background: #000 / #000000 / black
 *   color: #fff / #000
 *
 * 报告这些位置 — 它们在暗色模式下表现异常,应改用 var(--color-bg-elevated) 等 token。
 */

import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src')

const BAD = [
  /background:\s*#fff(?:\b|f)/gi,
  /background:\s*#ffffff/gi,
  /background:\s*white\b/gi,
  /background-color:\s*#fff(?:\b|f)/gi,
  /color:\s*#fff(?:\b|f)/gi,
  /color:\s*#000(?:\b|0)/gi
]
const SKIP_DIR = /\/(node_modules|dist|public|release|artifacts|\.git|common\/MessageList|common\/ToastContainer)\//

async function* walk(dir) {
  let entries = []
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (SKIP_DIR.test(full + '/')) continue
    if (e.isDirectory()) yield* walk(full)
    else if (e.isFile() && /\.(vue|css|scss)$/.test(e.name)) yield full
  }
}

const findings = []
for await (const file of walk(SRC)) {
  const src = await readFile(file, 'utf-8')
  for (const re of BAD) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(src)) !== null) {
      const lineNum = src.slice(0, m.index).split('\n').length
      findings.push({ file: file.replace(__dirname + '/..', '.'), line: lineNum, match: m[0] })
    }
  }
}

if (!findings.length) {
  console.log('✓ 未发现硬编码白/黑色')
  process.exit(0)
}
console.log(`发现 ${findings.length} 处硬编码颜色,可能在暗色模式下表现异常:\n`)
const byFile = new Map()
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, [])
  byFile.get(f.file).push(f)
}
for (const [file, list] of byFile) {
  console.log(`  ${file}  (${list.length})`)
  for (const f of list.slice(0, 3)) {
    console.log(`    L${String(f.line).padStart(5)}  ${f.match}`)
  }
  if (list.length > 3) console.log(`    ... 还有 ${list.length - 3} 处`)
}
console.log()
console.log('建议替换为:')
console.log('  background: #fff      → background: var(--color-bg-elevated, #fff)')
console.log('  color: #000           → color: var(--color-text-primary, #000)')
process.exit(1)
