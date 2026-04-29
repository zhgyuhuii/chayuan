#!/usr/bin/env node
/**
 * audit-i18n.mjs — 扫描 .vue / .js 中的硬编码中文,定位需要 i18n 的地方
 *
 * 启发式:
 *   - .vue template 里 `>...< / "..." / '...'` 含 ≥2 个汉字
 *   - .js 字符串字面量 / template literal 含 ≥2 个汉字
 *   - 排除注释、reportError 调用、console 日志(开发者目标)
 *
 * 输出:
 *   - 总数 + by-file 分布
 *   - --json 模式输出结构化 JSON
 */

import { readFile, readdir } from 'node:fs/promises'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const SRC = join(REPO_ROOT, 'src')

const SKIP_DIR = /\/(node_modules|dist|public|release|artifacts|\.git|skills)\//

async function* walk(dir) {
  let entries = []
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (SKIP_DIR.test(full + '/')) continue
    if (e.isDirectory()) yield* walk(full)
    else if (e.isFile() && /\.(vue|js)$/.test(e.name)) yield full
  }
}

const RE_CHINESE_STR = /(["'`])([^"'`\n]*[一-龥]{2,}[^"'`\n]*?)\1/g

const args = process.argv.slice(2)
const JSON_OUT = args.includes('--json')

const findings = []
let totalChars = 0

for await (const file of walk(SRC)) {
  const src = await readFile(file, 'utf-8')
  let count = 0
  RE_CHINESE_STR.lastIndex = 0
  let m
  while ((m = RE_CHINESE_STR.exec(src)) !== null) {
    const text = m[2]
    if (text.length > 60) continue   // 太长可能是 systemPrompt,跳过
    // 简单排除 console / reportError 调用上下文
    const before = src.slice(Math.max(0, m.index - 40), m.index)
    if (/console\.(log|debug|info|warn|error)\s*\(\s*$/.test(before)) continue
    if (/reportError\s*\(\s*$/.test(before)) continue
    if (/^\s*\*/.test(before.split('\n').pop() || '')) continue   // 多行注释
    count += 1
    totalChars += text.length
  }
  if (count > 0) {
    findings.push({ file: relative(REPO_ROOT, file), count })
  }
}

findings.sort((a, b) => b.count - a.count)

if (JSON_OUT) {
  console.log(JSON.stringify({ totalFiles: findings.length, totalStrings: findings.reduce((s, f) => s + f.count, 0), totalChars, findings }, null, 2))
  process.exit(0)
}

const total = findings.reduce((s, f) => s + f.count, 0)
console.log(`扫描 ${findings.length} 个文件,共 ${total} 处硬编码中文(~${totalChars} 字符)\n`)
console.log('Top 20 文件(国际化迁移建议从这些开始):')
for (const f of findings.slice(0, 20)) {
  console.log(`  ${f.file.padEnd(60)} ${String(f.count).padStart(4)} 处`)
}
if (findings.length > 20) {
  console.log(`  ... 还有 ${findings.length - 20} 个文件`)
}
console.log()
console.log('迁移建议:用 t(\'cmd.evo.run\') 替换硬编码,在 src/utils/i18n.js MESSAGES 定义对应 key')
process.exit(0)
