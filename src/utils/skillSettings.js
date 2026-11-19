/**
 * skillSettings — 技能库用户状态（启停 + 自定义技能），PluginStorage 持久化
 *
 * 存储协议：PluginStorage 加载项级共享键（跨 webview：设置页写入 ↔ 面板发送时
 * 读取），与 chatTurnRunner / assistantPrefillDraftStore 同通道：
 *   ai_skill_settings:v1 = JSON {
 *     disabledSkills: string[]      停用的内置技能 name
 *     customSkills: [{              用户导入的 SKILL.md（设置页解析 frontmatter 后入库）
 *       name, description, category, version, body, addedAt
 *     }]
 *   }
 *
 * 每次读取现取现用（无进程内缓存）——设置页与面板是不同 webview，读旧值会造成
 * 「设置页停用了、面板还在附加」的幻影状态。
 */

const SETTINGS_KEY = 'ai_skill_settings:v1'
const MAX_CUSTOM_SKILLS = 32

function storage() {
  try {
    const app = window.Application
    if (app?.PluginStorage) return app.PluginStorage
  } catch (_) { /* 非 WPS 环境（纯浏览器 dev）走 localStorage */ }
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  } catch (_) { /* 无存储环境 */ }
  return null
}

function safeParse(raw) {
  try {
    const v = JSON.parse(String(raw || ''))
    if (v && typeof v === 'object' && !Array.isArray(v)) return v
  } catch (_) { /* 损坏值回落默认 */ }
  return null
}

/** 读全量设置（缺省/损坏时回落空结构，绝不抛错——技能是增强能力，不能阻塞对话） */
export function readSkillSettings() {
  const s = storage()
  const v = s ? safeParse(s.getItem(SETTINGS_KEY)) : null
  return {
    disabledSkills: Array.isArray(v?.disabledSkills) ? v.disabledSkills.filter(x => typeof x === 'string') : [],
    customSkills: Array.isArray(v?.customSkills) ? v.customSkills.filter(x => x && x.name && x.body) : []
  }
}

function writeSkillSettings(next) {
  const s = storage()
  if (!s) return false
  try {
    s.setItem(SETTINGS_KEY, JSON.stringify(next))
    return true
  } catch (_) {
    return false
  }
}

/** 内置技能是否启用（未登记 = 启用，默认全量开放） */
export function isSkillEnabled(name) {
  return !readSkillSettings().disabledSkills.includes(name)
}

export function setSkillEnabled(name, enabled) {
  const cur = readSkillSettings()
  const set = new Set(cur.disabledSkills)
  if (enabled) set.delete(name)
  else set.add(name)
  return writeSkillSettings({ ...cur, disabledSkills: [...set] })
}

/** 我的技能（用户导入），新导入的同名技能覆盖旧版 */
export function listCustomSkills() {
  return readSkillSettings().customSkills
}

export function upsertCustomSkill({ name, description, category, version, body }) {
  const cur = readSkillSettings()
  const cleanName = String(name || '').trim()
  const cleanBody = String(body || '')
  if (!cleanName || !cleanBody) return { ok: false, reason: 'invalid' }
  const rest = cur.customSkills.filter(s => s.name !== cleanName)
  if (rest.length >= MAX_CUSTOM_SKILLS) return { ok: false, reason: 'limit' }
  const next = [
    ...rest,
    {
      name: cleanName,
      description: String(description || '').trim(),
      category: String(category || '').trim() || 'other',
      version: String(version || '').trim(),
      body: cleanBody,
      addedAt: Date.now()
    }
  ]
  writeSkillSettings({ ...cur, customSkills: next })
  return { ok: true }
}

export function removeCustomSkill(name) {
  const cur = readSkillSettings()
  return writeSkillSettings({ ...cur, customSkills: cur.customSkills.filter(s => s.name !== name) })
}
