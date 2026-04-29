#!/usr/bin/env node
/**
 * find-dead-cases.mjs — 扫描 ribbon.js OnAction 中的潜在"死 case"
 *
 *  - case 'btnXxx': break;            空 case
 *  - case 'btnXxx': /* TODO ... break; 仅注释
 *  - case 'btnXxx': console.log(...) break;  仅 log
 *
 * 用法:node scripts/find-dead-cases.mjs
 * 退出码:0 无死 case · 1 有死 case
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TARGET = join(__dirname, '..', 'src', 'components', 'ribbon.js')

const src = await readFile(TARGET, 'utf-8')
const lines = src.split('\n')

// 简单状态机:进入一个 case 后,记录其 body,直到遇到下一个 case/break/}/return
const findings = []
let i = 0
let inSwitch = false
while (i < lines.length) {
  const line = lines[i]
  if (/switch\s*\(/.test(line)) inSwitch = true
  if (!inSwitch) { i += 1; continue }

  const caseMatch = line.match(/^\s*case\s+'([^']+)':/)
  if (!caseMatch) { i += 1; continue }

  const caseId = caseMatch[1]
  const startLine = i + 1
  const body = []
  let j = i + 1
  // 收集直到下一个 case / break / return / }
  while (j < lines.length) {
    const t = lines[j]
    if (/^\s*case\s+'[^']+':/.test(t)) break
    if (/^\s*break\b/.test(t)) break
    if (/^\s*return\b/.test(t)) break
    if (/^\s*default\s*:/.test(t)) break
    if (/^\s*\}/.test(t) && body.length > 0) break
    body.push(t)
    j += 1
  }
  // 判定是否"死 case":body 全部是空行/注释/console.log
  const dead = body.every(l => {
    const stripped = l.trim()
    if (!stripped) return true
    if (stripped.startsWith('//')) return true
    if (stripped.startsWith('/*')) return true
    if (stripped.startsWith('*')) return true
    if (/^console\.(log|debug|info)\(/.test(stripped)) return true
    return false
  })
  if (dead && body.some(l => l.trim())) {
    findings.push({ caseId, line: startLine, bodyLines: body.length })
  }
  i = j
}

if (findings.length === 0) {
  console.log(`✓ 没有发现死 case(${lines.length} 行扫描完毕)`)
  process.exit(0)
}
console.log(`发现 ${findings.length} 个潜在死 case:\n`)
for (const f of findings) {
  console.log(`  L${f.line.toString().padStart(5, ' ')}  case '${f.caseId}'  (${f.bodyLines} 行 body)`)
}
console.log()
console.log('建议人工 review 后清理。完全空的 case 已在 P0 阶段处理过 4 个,这里是后续巡检。')
process.exit(1)
