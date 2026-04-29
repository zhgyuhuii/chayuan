#!/usr/bin/env node
/**
 * build-capability-catalog.mjs — 扫描 src/ 中的 JSDoc 注释,生成 capability catalog
 *
 * v2 计划 P4 项「能力 catalog 自动生成」。
 * 约定:在 capability handler 上方加 JSDoc 块,使用 @capability 标签声明 ns.action,
 * 配合 @description / @param / @returns / @since 提供元数据。
 *
 * 输出:
 *   - capability-catalog.json     完整 catalog
 *   - capability-catalog.md       人类可读 markdown 索引
 *
 * 用法:node scripts/build-capability-catalog.mjs
 */

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const SRC_DIR = join(REPO_ROOT, 'src')

const SKIP_DIR = /\/(node_modules|dist|public|release|artifacts|\.git)\//

async function* walk(dir) {
  let entries = []
  try { entries = await readdir(dir, { withFileTypes: true }) }
  catch { return }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (SKIP_DIR.test(full + '/')) continue
    if (e.isDirectory()) yield* walk(full)
    else if (e.isFile() && /\.(js|vue|mjs|ts)$/.test(e.name)) yield full
  }
}

const RE_CAPABILITY_BLOCK = /\/\*\*([\s\S]*?@capability[\s\S]*?)\*\//g

function parseJsdoc(blockText) {
  // 移除每行前缀 *
  const lines = blockText
    .split('\n')
    .map(l => l.replace(/^\s*\*\s?/, '').trim())
    .filter(l => l !== '*' && l !== '')
  const tags = []
  let cur = null
  for (const line of lines) {
    const m = line.match(/^@(\w+)\s*(.*)$/)
    if (m) {
      if (cur) tags.push(cur)
      cur = { tag: m[1], text: m[2] }
    } else if (cur) {
      cur.text = (cur.text + ' ' + line).trim()
    }
  }
  if (cur) tags.push(cur)
  return tags
}

async function main() {
  const catalog = []
  for await (const file of walk(SRC_DIR)) {
    let src
    try { src = await readFile(file, 'utf-8') } catch { continue }
    const matches = [...src.matchAll(RE_CAPABILITY_BLOCK)]
    for (const m of matches) {
      const tags = parseJsdoc(m[1])
      const cap = tags.find(t => t.tag === 'capability')
      if (!cap?.text) continue
      const description = tags.find(t => t.tag === 'description')?.text || ''
      const params = tags.filter(t => t.tag === 'param').map(t => t.text)
      const returns = tags.find(t => t.tag === 'returns' || t.tag === 'return')?.text || ''
      const since = tags.find(t => t.tag === 'since')?.text || ''
      catalog.push({
        target: cap.text,
        description,
        params,
        returns,
        since,
        file: relative(REPO_ROOT, file)
      })
    }
  }

  catalog.sort((a, b) => a.target.localeCompare(b.target))

  const outJson = join(REPO_ROOT, 'capability-catalog.json')
  await writeFile(outJson, JSON.stringify(catalog, null, 2), 'utf-8')

  // markdown
  let md = `# Capability Catalog\n\n`
  md += `自动生成 · 共 **${catalog.length}** 条能力\n\n`
  md += `_生成方式: \`node scripts/build-capability-catalog.mjs\`_\n\n`
  if (catalog.length === 0) {
    md += `> 当前没有找到任何 \`@capability\` 注解的能力。\n>\n> 在 capability handler 上方加 JSDoc 块即可被收录。\n`
  } else {
    md += `| 能力 | 描述 | 文件 |\n|------|------|------|\n`
    for (const c of catalog) {
      md += `| \`${c.target}\` | ${c.description.replace(/\|/g, '\\|') || '—'} | \`${c.file}\` |\n`
    }
    md += `\n## 详情\n\n`
    for (const c of catalog) {
      md += `### \`${c.target}\`\n`
      if (c.description) md += `${c.description}\n\n`
      if (c.params.length) {
        md += `**参数**:\n`
        for (const p of c.params) md += `- ${p}\n`
        md += `\n`
      }
      if (c.returns) md += `**返回**:${c.returns}\n\n`
      if (c.since) md += `**起始版本**:${c.since}\n\n`
      md += `**位置**:\`${c.file}\`\n\n`
    }
  }
  const outMd = join(REPO_ROOT, 'capability-catalog.md')
  await writeFile(outMd, md, 'utf-8')

  console.log(`✓ 生成 ${catalog.length} 条能力 →`)
  console.log(`  ${relative(process.cwd(), outJson)}`)
  console.log(`  ${relative(process.cwd(), outMd)}`)
}

main().catch(err => {
  console.error('catalog 失败:', err)
  process.exit(1)
})
