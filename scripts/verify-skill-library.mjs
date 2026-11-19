/**
 * verify-skill-library — 技能库完整性校验（纯 node，无运行时依赖）
 *
 * 校验 src/skill-library/ 的收割落地质量：
 *   1. 目录一一对应：每个 <name>/SKILL.md（上游英文原版）都有 <name>/SKILL.zh-CN.md（中文交付版），
 *      且 zh 版不是对英文版的未翻译残留
 *   2. frontmatter 契约（与 agent-core parseSkillFrontmatter 同规）：name/description 非空、
 *      --- 闭合、category 为上游 8 类之一
 *   3. 大小护栏：单篇正文 ≤16KB（MAX_SKILL_BODY_CHARS，与 src/utils/skillLibrary.js 一致）
 *   4. 无上游主技能混入（genoffice CLI 技能强绑定其 CLI，本项目不落地）
 *
 * 用法：npm run test:skill-library
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIB = path.join(root, 'src', 'skill-library')
const MAX_BODY_CHARS = 16 * 1024
const VALID_CATEGORIES = new Set(['office', 'business', 'data', 'finance', 'hr', 'legal', 'marketing', 'education'])

const problems = []
const warnOnly = []

function readFrontmatter(text) {
  const open = /^---[ \t]*\r?\n/.exec(text)
  if (!open) return null
  const afterOpen = text.slice(open[0].length)
  const close = /^---[ \t]*(\r?\n|$)/m.exec(afterOpen)
  if (!close) return null
  const flat = {}
  let lastKey = null
  for (const raw of afterOpen.slice(0, close.index).split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const kv = /^([A-Za-z0-9_.-]+):[ \t]*(.*)$/.exec(line)
    if (kv) {
      lastKey = kv[1]
      flat[lastKey] = kv[2].trim().replace(/^["']|["']$/g, '')
    } else if (lastKey && /^[ \t]/.test(raw)) {
      flat[lastKey] = `${flat[lastKey]} ${line.trim()}`.trim()
    }
  }
  return { fm: flat, body: afterOpen.slice(close.index + close[0].length) }
}

if (!fs.existsSync(LIB)) {
  console.error('[verify-skill-library] 目录不存在:', LIB)
  process.exit(1)
}

const entries = fs.readdirSync(LIB, { withFileTypes: true }).filter(e => e.isDirectory())
if (!entries.length) {
  console.error('[verify-skill-library] 目录为空——技能源尚未拷贝')
  process.exit(1)
}

let enCount = 0
let zhCount = 0
for (const ent of entries) {
  const name = ent.name
  const enPath = path.join(LIB, name, 'SKILL.md')
  const zhPath = path.join(LIB, name, 'SKILL.zh-CN.md')

  if (!fs.existsSync(enPath)) {
    // 中文交付版独立存在（自定义技能手工放入）也允许，但要有 frontmatter
    if (fs.existsSync(zhPath)) {
      const parsed = readFrontmatter(fs.readFileSync(zhPath, 'utf8'))
      if (!parsed?.fm?.name || !parsed?.fm?.description) {
        problems.push(`${name}: zh 版 frontmatter 缺 name/description`)
      } else {
        zhCount++
      }
    } else {
      problems.push(`${name}: 目录里既无 SKILL.md 也无 SKILL.zh-CN.md`)
    }
    continue
  }
  enCount++

  // 英文原版自身完整性（同步参照物）
  const en = readFrontmatter(fs.readFileSync(enPath, 'utf8'))
  if (!en?.fm?.name || !en?.fm?.description) {
    problems.push(`${name}: SKILL.md frontmatter 缺 name/description（同步源受损）`)
  } else if (en.fm.name !== name) {
    problems.push(`${name}: SKILL.md frontmatter name=${en.fm.name} 与目录名不一致`)
  }

  if (!fs.existsSync(zhPath)) {
    problems.push(`${name}: 缺 SKILL.zh-CN.md（中文交付版未落盘）`)
    continue
  }
  const zhText = fs.readFileSync(zhPath, 'utf8')
  const zh = readFrontmatter(zhText)
  if (!zh?.fm?.name || !zh?.fm?.description) {
    problems.push(`${name}: SKILL.zh-CN.md frontmatter 缺 name/description`)
    continue
  }
  if (zh.fm.name !== name) {
    problems.push(`${name}: zh frontmatter name=${zh.fm.name} 与目录名不一致`)
  }
  if (zh.fm.category && !VALID_CATEGORIES.has(zh.fm.category)) {
    problems.push(`${name}: category=${zh.fm.category} 不在上游 8 类之内`)
  }
  const bodyChars = zh.body.replace(/\s/g, '').length
  if (!bodyChars) {
    problems.push(`${name}: zh 正文为空`)
  } else if (bodyChars > MAX_BODY_CHARS) {
    problems.push(`${name}: zh 正文 ${bodyChars} 字符超过 ${MAX_BODY_CHARS} 上限`)
  }
  // 未翻译残留启发式：正文里连续 3 个以上英文实词的行（专名白名单外）——只告警不强拦
  const suspicious = zh.body
    .split('\n')
    .filter(l => /[A-Za-z]{3,}\s+[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(l)
      && !/Word|Excel|PPT|docx|xlsx|pdf|PDF|CSV|JSON|SWOT|OKR|KPI|NDA|JD|FAQ|SOP|ROI|GMV|UGC|SaaS|API|SKU|URL|HR|PR|A\/B/.test(l))
    .length
  if (suspicious > 3) {
    warnOnly.push(`${name}: zh 正文有 ${suspicious} 行疑似英文残留（启发式，人工复核）`)
  }
  zhCount++
}

// 主 CLI 技能不得混入
if (fs.existsSync(path.join(LIB, 'genoffice'))) {
  problems.push('genoffice: 上游主 CLI 技能不应落地（强绑定 genoffice CLI，本项目无此二进制）')
}

console.log(`[verify-skill-library] 目录 ${entries.length} 个｜英文原版 ${enCount}｜中文交付版 ${zhCount}`)
for (const w of warnOnly) console.log(`  WARN ${w}`)
if (problems.length) {
  for (const p of problems) console.error(`  FAIL ${p}`)
  console.error(`[verify-skill-library] ${problems.length} 个问题，校验不通过`)
  process.exit(1)
}
console.log('[verify-skill-library] 全部通过')
