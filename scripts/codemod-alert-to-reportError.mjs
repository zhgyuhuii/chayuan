#!/usr/bin/env node
/**
 * codemod: 把项目里 100+ 处 `console.error('xx失败:', e); alert('xx失败: ' + (e?.message || e))`
 * 模式批量替换为 `reportError('xx失败', e)`。
 *
 * 用法:
 *   node scripts/codemod-alert-to-reportError.mjs            # 预览(dry-run)
 *   node scripts/codemod-alert-to-reportError.mjs --apply    # 真正写入
 *   node scripts/codemod-alert-to-reportError.mjs --files src/components/ribbon.js --apply
 *
 * 默认扫描:
 *   src/components/**\/*.{js,vue}
 *   src/utils/**\/*.js
 *
 * 排除:reportError.js 自身、node_modules、dist、public、release。
 *
 * 处理三种模式(只匹配"失败/错误/无法/出错"类,不动"成功/已处理"提示):
 *
 *   A.  console.error('X失败:', e)
 *       alert('X失败: ' + (e?.message || e))
 *   B.  alert('X失败: ' + (e?.message || e))
 *   C.  alert('X失败：' + e.message)
 *
 *   全部替换为:reportError('X失败', e)
 *
 * 替换后自动 import { reportError } from '...'(若文件还没 import)。
 *
 * .vue 文件只动 <script> 块。
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const REPO_ROOT  = path.resolve(__dirname, '..')

const args  = process.argv.slice(2)
const APPLY = args.includes('--apply')
const FILES_FROM_CLI = args.includes('--files')
  ? args.slice(args.indexOf('--files') + 1).filter(s => !s.startsWith('--'))
  : null

const SCAN_DIRS = [
  path.join(REPO_ROOT, 'src/components'),
  path.join(REPO_ROOT, 'src/utils')
]
const EXCLUDE_RE = /\/(node_modules|dist|public|release|artifacts|\.git)\//

// 三种引号:'  "  `  统一用 \1 反向引用配对
// 失败关键词
const FAIL_RE = /失败|错误|无法|出错/

// pattern A:console.error('X失败:', e) <newline> alert('X失败: ' + (e?.message || e))
// 引号用 ('|") 选择,反斜杠转义后:
const RE_PATTERN_A = /console\.error\((['"])([^'"]*?)\1\s*,\s*(\w+)\s*\)\s*;?\s*\n[ \t]*alert\((['"])([^'"]*?)\4\s*\+\s*\(?\s*\3\??\.message\s*(?:\|\|\s*\3\s*)?\)?\s*\)/g

// pattern B(单行):alert('X失败: ' + (e?.message || e))
const RE_PATTERN_B = /alert\((['"])([^'"]*?)\1\s*\+\s*\(\s*(\w+)\??\.message\s*\|\|\s*\3\s*\)\s*\)/g

// pattern C(单行):alert('X失败：' + e.message)
const RE_PATTERN_C = /alert\((['"])([^'"]*?)\1\s*\+\s*(\w+)\.message\s*\)/g

function matchesFailureKeyword(text) {
  return FAIL_RE.test(String(text || ''))
}

function trimTrailingColon(text) {
  return String(text || '').replace(/[:：]\s*$/, '').trim()
}

function importPathFor(file) {
  const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
  if (rel.startsWith('src/components/common/'))             return '../../utils/reportError.js'
  if (rel.startsWith('src/components/'))                    return '../utils/reportError.js'
  if (rel.startsWith('src/utils/host/'))                    return '../reportError.js'
  if (rel.startsWith('src/utils/router/'))                  return '../reportError.js'
  if (rel.startsWith('src/utils/assistant/evolution/'))     return '../../reportError.js'
  if (rel.startsWith('src/utils/assistant/'))               return '../reportError.js'
  if (rel.startsWith('src/utils/'))                         return './reportError.js'
  return '@/utils/reportError.js'
}

async function* walk(dir) {
  let entries = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (EXCLUDE_RE.test(full + '/')) continue
    if (e.isDirectory()) yield* walk(full)
    else if (e.isFile() && /\.(js|vue|mjs|cjs)$/.test(e.name)) yield full
  }
}

async function listTargetFiles() {
  if (FILES_FROM_CLI?.length) {
    return FILES_FROM_CLI.map(f => path.resolve(REPO_ROOT, f))
  }
  const files = []
  for (const dir of SCAN_DIRS) {
    for await (const f of walk(dir)) files.push(f)
  }
  return Array.from(new Set(files))
}

function transformVue(source, transformer) {
  const re = /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g
  return source.replace(re, (full, open, body, close) => open + transformer(body) + close)
}

function transformJs(source, fileLabel) {
  const changes = []

  if (/reportError\.js$/.test(fileLabel)) return { result: source, changes }
  if (/safeErrorDialog\.js$/.test(fileLabel)) return { result: source, changes }

  let out = source

  // pattern A 优先(避免 B 抢匹配)
  out = out.replace(RE_PATTERN_A, (m, q1, title, errVar) => {
    if (!matchesFailureKeyword(title)) return m
    const cleaned = trimTrailingColon(title)
    changes.push({ pattern: 'A', title: cleaned })
    return `reportError(${q1}${cleaned}${q1}, ${errVar})`
  })

  out = out.replace(RE_PATTERN_B, (m, q1, title, errVar) => {
    if (!matchesFailureKeyword(title)) return m
    const cleaned = trimTrailingColon(title)
    changes.push({ pattern: 'B', title: cleaned })
    return `reportError(${q1}${cleaned}${q1}, ${errVar})`
  })

  out = out.replace(RE_PATTERN_C, (m, q1, title, errVar) => {
    if (!matchesFailureKeyword(title)) return m
    const cleaned = trimTrailingColon(title)
    changes.push({ pattern: 'C', title: cleaned })
    return `reportError(${q1}${cleaned}${q1}, ${errVar})`
  })

  if (changes.length > 0 && !/from\s+['"][^'"]*reportError(?:\.js)?['"]/.test(out)) {
    const importPath = importPathFor(path.resolve(REPO_ROOT, fileLabel))
    const importLine = `import { reportError } from '${importPath}'\n`
    // 找到所有 import 块(支持多行 import { ... } from '...'),
    // 把新 import 插到最后一个 import 块之后,而不是塞进多行 import 内部。
    const importBlockRe = /^[ \t]*import\b[\s\S]*?from\s+['"][^'"]+['"];?[ \t]*\n|^[ \t]*import\s+['"][^'"]+['"];?[ \t]*\n/gm
    let lastEnd = -1
    let m
    while ((m = importBlockRe.exec(out)) !== null) {
      lastEnd = m.index + m[0].length
    }
    if (lastEnd >= 0) {
      out = out.slice(0, lastEnd) + importLine + out.slice(lastEnd)
    } else {
      out = importLine + out
    }
    changes.push({ pattern: 'IMPORT', title: importPath })
  }

  return { result: out, changes }
}

async function processFile(file) {
  const rel = path.relative(REPO_ROOT, file)
  let source
  try {
    source = await fs.readFile(file, 'utf-8')
  } catch (e) {
    return { rel, error: e.message }
  }

  let next, changes
  if (file.endsWith('.vue')) {
    let allChanges = []
    next = transformVue(source, (body) => {
      const r = transformJs(body, rel)
      allChanges = allChanges.concat(r.changes)
      return r.result
    })
    changes = allChanges
  } else {
    const r = transformJs(source, rel)
    next = r.result
    changes = r.changes
  }

  if (changes.length === 0 || next === source) return { rel, changes: [] }
  if (APPLY) await fs.writeFile(file, next, 'utf-8')
  return { rel, changes }
}

async function main() {
  const files = await listTargetFiles()
  console.log(`扫描 ${files.length} 个文件 · 模式: ${APPLY ? 'APPLY(写入)' : 'DRY-RUN(预览)'}\n`)

  let totalFiles = 0
  let totalChanges = 0
  const byPattern = { A: 0, B: 0, C: 0, IMPORT: 0 }

  for (const f of files) {
    const r = await processFile(f)
    if (r.error) { console.warn(`! ${r.rel}: ${r.error}`); continue }
    if (!r.changes.length) continue
    totalFiles += 1
    totalChanges += r.changes.length
    for (const c of r.changes) byPattern[c.pattern] = (byPattern[c.pattern] || 0) + 1
    console.log(`✎ ${r.rel}  (+${r.changes.length})`)
    for (const c of r.changes.slice(0, 5)) {
      console.log(`    [${c.pattern}] ${c.title}`)
    }
    if (r.changes.length > 5) console.log(`    ... 还有 ${r.changes.length - 5} 处`)
  }

  console.log(`\n汇总:${totalFiles} 个文件,${totalChanges} 处替换`)
  console.log(`  pattern A(console.error+alert): ${byPattern.A || 0}`)
  console.log(`  pattern B(alert+message||e):    ${byPattern.B || 0}`)
  console.log(`  pattern C(alert+message):       ${byPattern.C || 0}`)
  console.log(`  自动 import 注入:                ${byPattern.IMPORT || 0}`)
  if (!APPLY) {
    console.log('\n这是预览。要真正写入,请加 --apply:\n  node scripts/codemod-alert-to-reportError.mjs --apply')
  }
}

main().catch(err => { console.error('codemod 失败:', err); process.exit(1) })
