/**
 * personalMemory — 个性化记忆系统(轻骨架)
 *
 * v2 计划 P5+「个性化记忆系统」。落地 3 类记忆,持久到 localStorage:
 *   - preference   用户偏好(语气、长度、表达风格)
 *   - recentTask   最近任务的简要回顾(taskId/kind/result snippet)
 *   - glossary     用户常用术语 / 自定义词典
 *
 * 后续扩展:
 *   - 把这些记忆通过 cache_control 注入 chat 系统提示词
 *   - 跨设备同步(目前仅本地)
 *   - 自动学习(从用户接受/拒绝的写回中提取)
 */

import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'

const KEY = 'personalMemory'

const SCHEMA = {
  preference: {
    tone: '',          // 'casual' | 'formal' | 'academic'
    lengthBias: 0,     // -1..1,负数倾向更短
    avoidJargon: false,
    customNotes: ''    // 用户自由输入
  },
  recentTask: [],      // 数组:{ taskId, assistantId, kind, snippet, ts }
  glossary: {}         // term → definition
}

const MAX_RECENT = 30

/* ────────── 内部 ────────── */

function load() {
  const s = loadGlobalSettings()
  const m = s[KEY]
  if (!m || typeof m !== 'object') {
    return JSON.parse(JSON.stringify(SCHEMA))
  }
  // 浅 merge,保证字段存在
  return {
    preference: { ...SCHEMA.preference, ...(m.preference || {}) },
    recentTask: Array.isArray(m.recentTask) ? m.recentTask : [],
    glossary: m.glossary && typeof m.glossary === 'object' ? m.glossary : {}
  }
}

function save(memory) {
  return saveGlobalSettings({ [KEY]: memory })
}

/* ────────── preference ────────── */

export function getPreference() {
  return load().preference
}

export function setPreference(partial = {}) {
  const m = load()
  m.preference = { ...m.preference, ...partial }
  save(m)
  return m.preference
}

/* ────────── recentTask ────────── */

export function recordTask(record = {}) {
  if (!record.taskId) return null
  const m = load()
  const entry = {
    taskId: String(record.taskId),
    assistantId: String(record.assistantId || ''),
    kind: String(record.kind || ''),
    snippet: String(record.snippet || '').slice(0, 200),
    ts: record.ts || Date.now()
  }
  // 去重:同 taskId 替换
  const filtered = m.recentTask.filter(r => r.taskId !== entry.taskId)
  filtered.unshift(entry)
  if (filtered.length > MAX_RECENT) filtered.length = MAX_RECENT
  m.recentTask = filtered
  save(m)
  return entry
}

export function listRecentTasks(limit = 10) {
  return load().recentTask.slice(0, limit)
}

export function clearRecentTasks() {
  const m = load()
  m.recentTask = []
  save(m)
}

/* ────────── glossary ────────── */

export function setGlossaryTerm(term, definition) {
  const t = String(term || '').trim()
  if (!t) return false
  const m = load()
  m.glossary[t] = String(definition || '').slice(0, 200)
  save(m)
  return true
}

export function removeGlossaryTerm(term) {
  const t = String(term || '').trim()
  const m = load()
  if (!m.glossary[t]) return false
  delete m.glossary[t]
  save(m)
  return true
}

export function listGlossary() {
  return load().glossary
}

/* ────────── 注入 system prompt ────────── */

/**
 * 把当前记忆中的偏好和术语拼接成一段可加到 system prompt 后的"用户上下文"。
 *   返回字符串(可能为空)。
 */
export function buildPersonalContextPrompt() {
  const m = load()
  const lines = []
  if (m.preference.tone) {
    const map = { casual: '口语化', formal: '正式书面', academic: '学术严谨' }
    lines.push(`- 用户偏好语气:${map[m.preference.tone] || m.preference.tone}`)
  }
  if (m.preference.lengthBias < -0.3) lines.push('- 倾向更简短的表达')
  else if (m.preference.lengthBias > 0.3) lines.push('- 倾向更详细的表达')
  if (m.preference.avoidJargon) lines.push('- 避免行业黑话,使用通俗用语')
  if (m.preference.customNotes) lines.push(`- 用户备注:${m.preference.customNotes}`)

  const terms = Object.entries(m.glossary).slice(0, 12)
  if (terms.length) {
    lines.push(`- 用户常用术语对照:`)
    for (const [term, def] of terms) lines.push(`  · ${term} = ${def}`)
  }

  if (!lines.length) return ''
  return ['', '【用户偏好上下文(请在不违背任务约束的前提下尊重)】', ...lines].join('\n')
}

/* ────────── 全清 ────────── */

export function clearAll() {
  saveGlobalSettings({ [KEY]: JSON.parse(JSON.stringify(SCHEMA)) })
}

export default {
  getPreference,
  setPreference,
  recordTask,
  listRecentTasks,
  clearRecentTasks,
  setGlossaryTerm,
  removeGlossaryTerm,
  listGlossary,
  buildPersonalContextPrompt,
  clearAll
}
