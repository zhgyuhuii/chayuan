/**
 * teamShare — 团队级助手共享 + 组织模板
 *
 * v2 计划 P4 项「团队级共享与组织模板(管理员审批)」。本地实现版本(无后端):
 *   - exportAssistant(id) → JSON 字符串(含 schema + version)
 *   - importAssistant(json, options) → 验证 + 注册到 external 命名空间
 *   - 组织模板:registerOrgTemplate(template)、listOrgTemplates()
 *   - 模板包含:推荐助手清单 + 推荐 prompt cache 设置 + RACE 阈值 override
 *
 * 后端审批/同步留给后续实现。
 */

import {
  registerExternalAssistant,
  unregisterExternalAssistant,
  hasExternalAssistant
} from './externalAssistants.js'
import { loadGlobalSettings, saveGlobalSettings } from '../globalSettings.js'

const EXPORT_FORMAT_VERSION = 1
const ORG_TEMPLATES_KEY = 'orgTemplates'

/* ────────── 单助手 export / import ────────── */

/**
 * 把一个助手对象导出为可分享的 JSON 字符串。
 *   不导出运行时状态(_evolution / 持久版本号),只导出可重现的配置。
 */
export function exportAssistantJSON(assistant) {
  if (!assistant || typeof assistant !== 'object') {
    throw new Error('exportAssistantJSON: assistant 必填')
  }
  const safe = {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    assistant: {
      id: String(assistant.id || ''),
      label: String(assistant.label || ''),
      shortLabel: assistant.shortLabel || '',
      icon: assistant.icon || '',
      group: assistant.group || 'analysis',
      modelType: assistant.modelType || 'chat',
      defaultAction: assistant.defaultAction || 'comment',
      defaultOutputFormat: assistant.defaultOutputFormat || 'plain',
      defaultInputSource: assistant.defaultInputSource || 'selection-preferred',
      description: assistant.description || '',
      systemPrompt: String(assistant.systemPrompt || ''),
      userPromptTemplate: String(assistant.userPromptTemplate || ''),
      temperature: typeof assistant.temperature === 'number' ? assistant.temperature : 0.3,
      gateProfile: assistant.gateProfile || ''
    }
  }
  return JSON.stringify(safe, null, 2)
}

/**
 * 从 JSON 字符串导入助手。
 *   options.namespace  默认 'ext.team.';最终 id 为 `${namespace}${assistant.id}`(避免冲突)
 *   options.force      true → 同 id 已存在直接覆盖
 *   返回 { ok, error, assistantId }
 */
export function importAssistantJSON(jsonStr, options = {}) {
  let parsed
  try { parsed = JSON.parse(jsonStr) }
  catch (e) { return { ok: false, error: `JSON 解析失败: ${e.message}` } }

  if (parsed?.formatVersion !== EXPORT_FORMAT_VERSION) {
    return { ok: false, error: `不支持的 formatVersion: ${parsed?.formatVersion}(支持 ${EXPORT_FORMAT_VERSION})` }
  }
  const a = parsed.assistant
  if (!a?.systemPrompt) return { ok: false, error: 'assistant.systemPrompt 缺失' }

  const namespace = options.namespace || 'ext.team.'
  const finalId = `${namespace}${a.id}`

  if (hasExternalAssistant(finalId) && options.force !== true) {
    return { ok: false, error: `id "${finalId}" 已存在(用 options.force=true 覆盖)`, assistantId: finalId }
  }
  if (options.force === true && hasExternalAssistant(finalId)) {
    unregisterExternalAssistant(finalId)
  }

  return registerExternalAssistant({ ...a, id: finalId })
}

/* ────────── 组织模板 ────────── */

function loadTemplates() {
  const s = loadGlobalSettings()
  return Array.isArray(s[ORG_TEMPLATES_KEY]) ? s[ORG_TEMPLATES_KEY] : []
}

function saveTemplates(list) {
  return saveGlobalSettings({ [ORG_TEMPLATES_KEY]: list })
}

/**
 * 注册一个组织模板。模板结构:
 *   { id, name, description, recommendedAssistantIds, raceThresholdOverrides, addedAt }
 */
export function registerOrgTemplate(template) {
  if (!template?.id || !template?.name) {
    return { ok: false, error: 'template.id 和 template.name 必填' }
  }
  const list = loadTemplates()
  const idx = list.findIndex(t => t.id === template.id)
  const record = {
    id: String(template.id),
    name: String(template.name),
    description: String(template.description || ''),
    recommendedAssistantIds: Array.isArray(template.recommendedAssistantIds)
      ? template.recommendedAssistantIds.filter(Boolean).map(String)
      : [],
    raceThresholdOverrides: template.raceThresholdOverrides || null,
    addedAt: idx >= 0 ? list[idx].addedAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: template.owner || 'local'
  }
  if (idx >= 0) list[idx] = record
  else list.push(record)
  saveTemplates(list)
  return { ok: true, template: record }
}

export function listOrgTemplates() {
  return loadTemplates()
}

export function getOrgTemplate(id) {
  return loadTemplates().find(t => t.id === id) || null
}

export function removeOrgTemplate(id) {
  const list = loadTemplates()
  const next = list.filter(t => t.id !== id)
  if (next.length === list.length) return false
  saveTemplates(next)
  return true
}

/**
 * 把整组组织模板导出为 JSON(便于跨组织迁移)。
 */
export function exportAllTemplatesJSON() {
  return JSON.stringify({
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    templates: loadTemplates()
  }, null, 2)
}

export default {
  exportAssistantJSON,
  importAssistantJSON,
  registerOrgTemplate,
  listOrgTemplates,
  getOrgTemplate,
  removeOrgTemplate,
  exportAllTemplatesJSON
}
