/**
 * skillPackStore — 技能包磁盘存储（sidecar 侧，dataDir/skills/<name>/）。
 *
 * 背景：技能导入上限放宽到 10GB 后，webview 侧 PluginStorage/localStorage 的
 * 配额装不下真实技能包 → 存储层落到 sidecar 文件系统，面板经 /skillpack/*
 * HTTP 端点（token 门禁）读写。PluginStorage 只留索引与迁移残留。
 *
 * 布局：
 *   <dataDir>/skills/<name>/SKILL.md      对话注入取的正文
 *   <dataDir>/skills/<name>/pack.json     { description, category, version }
 *   <dataDir>/skills/<name>/<entry...>    随包附属文件（模板/表格/脚本）
 *
 * 规则（与 chayuan-office skills-store 同语义）：
 *   - 技能名 = 目录名，合法性 /^[^/\\:*?"<>|]+$/ 且不以 . 开头
 *   - 保存走 scratch-then-rename：先写 skills/.import-<rand>/ 全量校验后
 *     rename 落位，半途失败 rm 干净零残留
 *   - 覆盖语义（与面板 upsert 一致）：同名已存在 → 校验通过后整目录替换
 *
 * 零 npm 依赖（Bun 编译约束）：frontmatter 解析用轻量 YAML 行解析
 * （只取 name/description/category/version 四键，覆盖本项目的写法）。
 */

import fs from 'node:fs'
import path from 'node:path'

const NAME_RE = /^[^/\\:*?"<>|]+$/
const MAX_PACK_BYTES = 10240 * 1024 * 1024 // 与面板导入上限同口径（10GB，磁盘语义）

export function skillPackNameOk(name) {
  return typeof name === 'string' && name.length > 0 &&
    !name.startsWith('.') && NAME_RE.test(name)
}

function skillsRoot(dataDir) {
  return path.join(dataDir, 'skills')
}

function packMeta(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, 'pack.json'), 'utf8'))
    return j && typeof j === 'object' ? j : {}
  } catch { return {} }
}

function readSkillBody(dir) {
  try {
    const raw = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8')
    // 去掉 frontmatter 块（--- ... ---），只留正文——与面板 readSkillBody 同语义
    const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(raw)
    return m ? raw.slice(m[0].length) : raw
  } catch { return '' }
}

function entryPaths(dir) {
  const out = []
  const walk = (cur, rel) => {
    let list
    try { list = fs.readdirSync(cur, { withFileTypes: true }) } catch { return }
    for (const e of list) {
      const full = path.join(cur, e.name)
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) walk(full, r)
      else if (e.name !== 'pack.json') out.push(r)
    }
  }
  walk(dir, '')
  return out
}

/** 目录里必须恰有 SKILL.md；返回错误消息或 '' */
function requireSkillMd(dir) {
  try {
    if (!fs.existsSync(path.join(dir, 'SKILL.md'))) {
      return '技能包内缺少 SKILL.md（需在包根）。'
    }
    if (fs.statSync(path.join(dir, 'SKILL.md')).size > MAX_PACK_BYTES) {
      return 'SKILL.md 超过单包上限。'
    }
    return ''
  } catch {
    return '技能包无法读取。'
  }
}

/** 全量列出（面板「我的技能」与对话附加共用）：metadata 来自 pack.json */
export function listSkillPacks(dataDir) {
  const root = skillsRoot(dataDir)
  let names = []
  try { names = fs.readdirSync(root, { withFileTypes: true }) } catch { return [] }
  const packs = []
  for (const ent of names) {
    if (!ent.isDirectory() || ent.name.startsWith('.')) continue
    const dir = path.join(root, ent.name)
    if (!fs.existsSync(path.join(dir, 'SKILL.md'))) continue
    const meta = packMeta(dir)
    packs.push({
      name: ent.name,
      description: String(meta.description || ''),
      category: String(meta.category || 'other'),
      version: String(meta.version || ''),
      body: readSkillBody(dir),
      entryCount: entryPaths(dir).length
    })
  }
  packs.sort((a, b) => a.name.localeCompare(b.name))
  return packs
}

/**
 * 保存（覆盖语义）。pack: { name, description, category, version, body,
 * entries:[{path, bytesB64}] }。entries 缺省视为单 SKILL.md 包。
 */
export function saveSkillPack(dataDir, pack) {
  const name = String(pack?.name || '')
  if (!skillPackNameOk(name)) return { ok: false, message: '技能名不合法。' }
  const body = String(pack?.body || '')
  if (!body.trim()) return { ok: false, message: 'SKILL.md 正文为空。' }
  const entries = Array.isArray(pack?.entries) && pack.entries.length
    ? pack.entries.map(e => ({
        path: String(e?.path || ''),
        bytes: Buffer.from(String(e?.bytesB64 || ''), 'base64')
      }))
    : [{ path: 'SKILL.md', bytes: Buffer.from(body, 'utf8') }]
  for (const e of entries) {
    if (!e.path || e.path.includes('..') || e.path.includes('\\') || path.isAbsolute(e.path) ||
        e.path.split('/').some(seg => seg.startsWith('.'))) {
      return { ok: false, message: `技能包含不安全的条目名：${e.path.slice(0, 80)}` }
    }
  }
  const total = entries.reduce((n, e) => n + e.bytes.length, 0)
  if (total > MAX_PACK_BYTES) return { ok: false, message: '技能包超过磁盘存储上限。' }
  if (!entries.some(e => e.path === 'SKILL.md')) {
    return { ok: false, message: '技能包含缺少 SKILL.md（需在包根）。' }
  }

  const root = skillsRoot(dataDir)
  const dest = path.join(root, name)
  fs.mkdirSync(root, { recursive: true })
  const scratch = path.join(root, `.import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
  try {
    fs.mkdirSync(scratch, { recursive: true })
    for (const e of entries) {
      const target = path.join(scratch, e.path)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, e.bytes)
    }
    const bad = requireSkillMd(scratch)
    if (bad) throw new Error(bad)
    fs.writeFileSync(path.join(scratch, 'pack.json'), JSON.stringify({
      description: String(pack?.description || ''),
      category: String(pack?.category || 'other'),
      version: String(pack?.version || '')
    }, null, 2))
    fs.rmSync(dest, { recursive: true, force: true })
    fs.renameSync(scratch, dest)
  } catch (e) {
    try { fs.rmSync(scratch, { recursive: true, force: true }) } catch { /* ignore */ }
    return { ok: false, message: String(e?.message || e) }
  }
  return { ok: true, name }
}

export function removeSkillPack(dataDir, name) {
  if (!skillPackNameOk(name)) return { ok: false, message: '技能名不合法。' }
  const dir = path.join(skillsRoot(dataDir), name)
  if (!fs.existsSync(dir)) return { ok: false, message: '技能不存在。' }
  fs.rmSync(dir, { recursive: true, force: true })
  return { ok: true }
}
