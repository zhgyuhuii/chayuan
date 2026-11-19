/**
 * skillLibrary — 内置技能库 loader（收割自上游 genoffice skills/recommended，2026-11-19）
 *
 * 目录约定：
 *   src/skill-library/<name>/SKILL.md         英文原版（上游同步 diff 参照，不进运行时）
 *   src/skill-library/<name>/SKILL.zh-CN.md   中文交付版（frontmatter name/description/
 *                                             category + 中文本文；运行时唯一消费源）
 *
 * 加载方式：Vite 编译期 import.meta.glob 收齐（先例 src/utils/assistant/skillScanner.js）；
 * frontmatter 解析复用 vendored agent-core 的 parseSkillFrontmatter（imported-skill.ts，
 * 手写扁平 YAML，嵌套键按缩进续行拼进上一键——metadata.version 会变成字符串，忽略即可）。
 *
 * 注入协议：agent-core withAttachedSkills（attached-skills.ts）——技能永不自动进
 * system prompt，唯一入口是用户显式附加，包成 <skill name="…"> 块进当条 user
 * message；技能与通用指导冲突时技能赢。上游语义：仅该条消息携带，追问不带。
 */

import { parseSkillFrontmatter } from '../agent-core/index'

// 上游 category（frontmatter，未知值归 other）→ 中文标签
export const CATEGORY_LABELS = {
  office: '办公',
  business: '商务',
  data: '数据',
  finance: '财务',
  hr: '人力',
  legal: '法律',
  marketing: '营销',
  education: '教育',
  other: '其他'
}

export const CATEGORY_ORDER = ['office', 'business', 'data', 'finance', 'hr', 'legal', 'marketing', 'education', 'other']

// 附加上限：与上游 AiPanel 行为对齐的保守护栏（agentHub 长轮询 payload 体积有限）
export const MAX_ATTACHED_SKILLS = 4
export const MAX_SKILL_BODY_CHARS = 16 * 1024

// ---- 编译期收齐中文交付版 --------------------------------------------------

let zhModules = {}
try {
  // eslint-disable-next-line no-undef
  zhModules = import.meta.glob('/src/skill-library/**/SKILL.zh-CN.md', {
    eager: true,
    query: '?raw',
    import: 'default'
  }) || {}
} catch (_) {
  // 非 Vite 环境（node 校验脚本/单测）→ 空字典，走 verify-skill-library 兜底。
  // 注意：不能用 `typeof import.meta?.glob === 'function'` 做守卫——import.meta.glob
  // 是编译期宏，vite 只替换调用点本身，运行时的 import.meta 上没有 glob，
  // 守卫恒为 false 会让字典永远为空（skillScanner 曾中招的同一个坑）。
}

/** 单篇 SKILL.zh-CN.md → 技能卡（frontmatter 缺 name/description 的篇目跳过） */
function parseSkillCard(raw, filePath) {
  const parsed = parseSkillFrontmatter(String(raw || ''))
  if (!parsed) return null
  const dirName = String(filePath || '').split('/').slice(-2, -1)[0] || parsed.name
  // 上游 version 嵌套在 metadata: 下，扁平解析后是 'version: 1.0.0' 形态的字符串
  const metaVersion = /version:\s*(\S+)/.exec(String(parsed.extra?.metadata || ''))
  return {
    name: parsed.name,
    dirName,
    description: parsed.description,
    category: parsed.extra?.category?.trim() || 'other',
    version: parsed.extra?.version?.trim() || (metaVersion ? metaVersion[1] : ''),
    scenarios: parsed.extra?.scenarios || '',
    quickPrompts: parsed.extra?.quickPrompts || '',
    body: parsed.body,
    source: 'builtin'
  }
}

let builtinCache = null

/** 内置技能清单（按 name 排序；模块级缓存，编译期收齐后不可变） */
export function listBuiltinSkills() {
  if (builtinCache) return builtinCache
  const cards = []
  for (const [filePath, raw] of Object.entries(zhModules)) {
    const card = parseSkillCard(raw, filePath)
    if (card) cards.push(card)
  }
  cards.sort((a, b) => a.name.localeCompare(b.name))
  builtinCache = cards
  return cards
}

/** 按 name 取内置技能（未命中返回 null） */
export function getBuiltinSkill(name) {
  return listBuiltinSkills().find(s => s.name === name) || null
}

/** 轻量搜索：name/description/category 的包含匹配（大小写不敏感） */
export function searchSkills(skills, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return skills
  return skills.filter(s =>
    s.name.toLowerCase().includes(q)
    || String(s.description || '').toLowerCase().includes(q)
    || String(s.category || '').toLowerCase().includes(q)
  )
}

/** 按 category 分组（返回按 CATEGORY_ORDER 排序的 [key, skills[]] 数组） */
export function groupByCategory(skills) {
  const map = new Map()
  for (const s of skills) {
    const key = CATEGORY_LABELS[s.category] ? s.category : 'other'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(s)
  }
  return CATEGORY_ORDER.filter(k => map.has(k)).map(k => [k, map.get(k)])
}

/**
 * 用户导入的 SKILL.md 文本 → 技能卡（「我的技能」导入通道，设置页消费）。
 * 校验失败返回 { ok:false, reason }；成功返回 { ok:true, card }（source:'custom'）。
 */
export function parseImportedSkill(text) {
  const parsed = parseSkillFrontmatter(String(text || ''))
  if (!parsed) return { ok: false, reason: 'frontmatter' }
  const metaVersion = /version:\s*(\S+)/.exec(String(parsed.extra?.metadata || ''))
  return {
    ok: true,
    card: {
      name: parsed.name,
      description: parsed.description,
      category: parsed.extra?.category?.trim() || 'other',
      version: parsed.extra?.version?.trim() || (metaVersion ? metaVersion[1] : ''),
      body: parsed.body,
      source: 'custom'
    }
  }
}

/**
 * 附件整形：取正文、限个数、超长截断（截断处标注，模型可自知上下文不完整）。
 * 返回 [{ name, body }]，供 orchestrator 传给 withAttachedSkills。
 */
export function buildAttachments(selected) {
  const list = Array.isArray(selected) ? selected : []
  const out = []
  for (const item of list.slice(0, MAX_ATTACHED_SKILLS)) {
    const name = String(item?.name || '').trim()
    const body = String(item?.body || '')
    if (!name || !body) continue
    const trimmed = body.length > MAX_SKILL_BODY_CHARS
      ? `${body.slice(0, MAX_SKILL_BODY_CHARS)}\n\n[技能正文过长已截断，仅保留前 ${MAX_SKILL_BODY_CHARS} 字符]`
      : body
    out.push({ name, body: trimmed })
  }
  return out
}
