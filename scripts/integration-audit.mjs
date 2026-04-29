#!/usr/bin/env node
/**
 * integration-audit.mjs — 模块集成完整度审计
 *
 * 扫描:
 *   1. 项目里 src/ 下的每个 .js / .vue 文件
 *   2. 收集每个文件的 export 名(named + default)
 *   3. 反向找谁 import 了它
 *   4. 标记三种状态:
 *      - ✅ 已接通     : 至少有 1 个 src/ 内的 import
 *      - ⚠ 仅自我引用  : 只有自己 import 自己 / smoke test
 *      - ❌ 孤儿模块    : 0 个 import(可能是"建好但没接通")
 *
 * 用法:
 *   node scripts/integration-audit.mjs           完整审计
 *   node scripts/integration-audit.mjs --orphans 只列孤儿
 *   node scripts/integration-audit.mjs --json    JSON 输出
 */

import { readFile, readdir } from 'node:fs/promises'
import { join, dirname, relative, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const SRC_DIR = join(REPO_ROOT, 'src')

const SKIP_DIR = /\/(node_modules|dist|public|release|artifacts|\.git)\//

const args = process.argv.slice(2)
const ONLY_ORPHANS = args.includes('--orphans')
const JSON_OUT = args.includes('--json')

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m'
}

async function* walk(dir) {
  let entries = []
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (SKIP_DIR.test(full + '/')) continue
    if (e.isDirectory()) yield* walk(full)
    else if (e.isFile() && /\.(js|vue|mjs)$/.test(e.name)) yield full
  }
}

/* ────────── 1. 收集每个文件的 import 关系 ────────── */

// fileAbsPath → Set<被 import 的相对路径(已规范化)>
const importsFromMap = new Map()
// fileAbsPath → Set<谁 import 了我>
const importedByMap = new Map()

// 同时匹配:静态 import / 动态 import('...') / 模板字符串 import(`...`) / require / Vite worker URL
const RE_IMPORT = /(?:import|from|import\s*\()\s*\(?\s*['"`]([^'"`]+)['"`]/g

function resolveImport(fromAbs, importPath) {
  const importStr = String(importPath || '')
  if (!importStr.startsWith('.') && !importStr.startsWith('/')) return null  // node_modules
  const fromDir = dirname(fromAbs)
  const candidates = []
  let base
  if (importStr.startsWith('/')) {
    // 罕见:'/src/...'
    base = join(REPO_ROOT, importStr.replace(/^\/+/, ''))
  } else {
    base = join(fromDir, importStr)
  }
  // 尝试加扩展名
  for (const ext of ['', '.js', '.vue', '.mjs', '/index.js']) {
    candidates.push(base + ext)
  }
  return candidates
}

async function indexFile(absPath) {
  let src
  try { src = await readFile(absPath, 'utf-8') } catch { return }
  importsFromMap.set(absPath, new Set())
  const matches = [...src.matchAll(RE_IMPORT)]
  for (const m of matches) {
    const importPath = m[1]
    const candidates = resolveImport(absPath, importPath)
    if (!candidates) continue
    importsFromMap.get(absPath).add({ importPath, candidates })
  }
}

/* ────────── 2. 解析 ────────── */

async function fileExists(p) {
  try {
    const { stat } = await import('node:fs/promises')
    await stat(p)
    return true
  } catch { return false }
}

async function buildIndex() {
  const allFiles = []
  for await (const f of walk(SRC_DIR)) allFiles.push(f)

  // pass 1:每个文件的 imports
  for (const f of allFiles) await indexFile(f)

  // pass 2:解析每个 import 的目标 → 填 importedByMap
  for (const [from, imps] of importsFromMap) {
    for (const { candidates } of imps) {
      let resolved = null
      for (const c of candidates) {
        if (allFiles.includes(c) || allFiles.includes(c.replace(/\\/g, '/'))) {
          resolved = allFiles.find(f => f === c || f === c.replace(/\\/g, '/'))
          break
        }
        if (await fileExists(c)) { resolved = c; break }
      }
      if (resolved) {
        if (!importedByMap.has(resolved)) importedByMap.set(resolved, new Set())
        importedByMap.get(resolved).add(from)
      }
    }
  }

  return allFiles
}

/* ────────── 3. 分类 ────────── */

const CONNECTED = []
const SELF_ONLY = []
const ORPHANS = []

const ENTRY_POINTS = new Set([
  'main.js', 'App.vue', 'router/index.js'
])

function isEntryPoint(absPath) {
  const rel = relative(SRC_DIR, absPath).replace(/\\/g, '/')
  return ENTRY_POINTS.has(rel)
}

async function classify(allFiles) {
  for (const f of allFiles) {
    const rel = relative(REPO_ROOT, f).replace(/\\/g, '/')
    if (isEntryPoint(f)) {
      CONNECTED.push({ file: rel, importerCount: 0, isEntryPoint: true })
      continue
    }
    const importers = importedByMap.get(f)
    if (!importers || importers.size === 0) {
      ORPHANS.push({ file: rel })
    } else if (importers.size === 1 && importers.has(f)) {
      SELF_ONLY.push({ file: rel })
    } else {
      CONNECTED.push({
        file: rel,
        importerCount: importers.size,
        sampleImporters: [...importers].slice(0, 3).map(p => relative(REPO_ROOT, p).replace(/\\/g, '/'))
      })
    }
  }
}

/* ────────── 4. 输出 ────────── */

async function main() {
  const allFiles = await buildIndex()
  await classify(allFiles)

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify({
      total: allFiles.length,
      connected: CONNECTED.length,
      orphans: ORPHANS.length,
      selfOnly: SELF_ONLY.length,
      orphanList: ORPHANS,
      selfOnlyList: SELF_ONLY
    }, null, 2) + '\n')
    return
  }

  console.log(`${C.bold}${C.cyan}┌─ 项目集成完整度审计${C.reset}`)
  console.log(`${C.cyan}│${C.reset}  扫描了 ${allFiles.length} 个文件`)
  console.log(`${C.cyan}│${C.reset}  ${C.green}✅ 已接通  ${CONNECTED.length}${C.reset}`)
  console.log(`${C.cyan}│${C.reset}  ${C.yellow}⚠ 仅自引用 ${SELF_ONLY.length}${C.reset}`)
  console.log(`${C.cyan}│${C.reset}  ${C.red}❌ 孤儿模块 ${ORPHANS.length}${C.reset}`)
  console.log(`${C.cyan}└─${C.reset}\n`)

  if (ORPHANS.length > 0) {
    console.log(`${C.red}${C.bold}❌ 孤儿模块清单(写好了但无业务方 import):${C.reset}`)
    // 按目录分组
    const byDir = new Map()
    for (const o of ORPHANS) {
      const dir = dirname(o.file)
      if (!byDir.has(dir)) byDir.set(dir, [])
      byDir.get(dir).push(o.file)
    }
    for (const [dir, files] of [...byDir.entries()].sort()) {
      console.log(`\n  ${C.bold}${dir}/${C.reset}`)
      for (const f of files) {
        console.log(`    ${C.dim}-${C.reset} ${basename(f)}`)
      }
    }
    console.log()
    console.log(`${C.dim}提示:孤儿可能是"基础设施待业务接入"(如 Y-1)、"模板/演示"(如 chayuan-doctor 用的脚本)、或者"过期未删除"。${C.reset}`)
    console.log(`${C.dim}解决:让业务文件 import 它们,或者明确标记 _internal-only。${C.reset}`)
  }

  if (!ONLY_ORPHANS && SELF_ONLY.length > 0) {
    console.log(`\n${C.yellow}${C.bold}⚠ 仅自引用清单(只有自己引用自己):${C.reset}`)
    for (const s of SELF_ONLY) console.log(`  - ${s.file}`)
  }

  // 输出退出码
  process.exit(ORPHANS.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(`${C.red}审计失败:${C.reset}`, err)
  process.exit(2)
})
