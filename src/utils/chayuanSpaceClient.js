/**
 * 智能空间(chayuan-server)拉取"文档助手"应用并合入本地自定义助手。
 *
 * 数据流:
 *   chayuan-server.persona.doc_assistant  ←→  WPS customAssistant
 *
 * 配置:
 *   loadGlobalSettings()[CHAYUAN_SPACE_KEY] = {
 *     baseUrl: 'http://localhost:7861',   // 必填,chayuan-server 根 URL(不含 /api/...)
 *     token:   '<jwt>',                   // 必填,用户登录 chayuan-client 后的 access token
 *     scope:   'mine' | 'shared' | 'public' | 'all',   // 默认 'all'
 *     lastSyncAt: 1715000000000,
 *   }
 *
 * 同步规则:
 *   - 已存在(按 id 匹配 ``custom_cy_<appId>``)→ 覆盖更新
 *   - 不存在 → 追加
 *   - 本地的非智能空间助手(custom_xxx 不带 cy_)不动
 */

import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
import { getCustomAssistants, saveCustomAssistants } from './assistantSettings.js'

export const CHAYUAN_SPACE_KEY = 'chayuanSpaceConfig'

export function getChayuanSpaceConfig() {
  const settings = loadGlobalSettings()
  const raw = settings[CHAYUAN_SPACE_KEY] || {}
  return {
    baseUrl: String(raw.baseUrl || '').trim().replace(/\/+$/, ''),
    token: String(raw.token || '').trim(),
    scope: raw.scope || 'all',
    lastSyncAt: Number(raw.lastSyncAt || 0),
  }
}

export function saveChayuanSpaceConfig(patch = {}) {
  const current = getChayuanSpaceConfig()
  const next = { ...current, ...patch }
  if (typeof next.baseUrl === 'string') next.baseUrl = next.baseUrl.trim().replace(/\/+$/, '')
  if (typeof next.token === 'string') next.token = next.token.trim()
  return saveGlobalSettings({ [CHAYUAN_SPACE_KEY]: next })
}

/**
 * 拉取该用户有权访问的文档助手列表(metadata)。
 *
 * @returns {Promise<Array<{id:string, name:string, icon:string, description:string,
 *   current_version_id:string|null, lifecycle:string, update_time:string|null}>>}
 */
export async function listSpaceDocAssistants(config = null) {
  const cfg = config || getChayuanSpaceConfig()
  if (!cfg.baseUrl) throw new Error('未配置智能空间地址(baseUrl)')
  if (!cfg.token) throw new Error('未配置访问 token')
  const url = `${cfg.baseUrl}/api/ai/space/apps`
    + `?type=document_assistant&scope=${encodeURIComponent(cfg.scope || 'all')}`
    + `&limit=200`
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${cfg.token}`,
    },
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`列出应用失败: ${resp.status} ${text}`)
  }
  const data = await resp.json()
  return Array.isArray(data?.items) ? data.items : []
}

/**
 * 拉取一个应用对应的版本对象。
 *
 * 后端只有 ``GET /apps/{id}/versions``(列表)和 ``GET /apps/{id}/draft``(owner-only)。
 * 这里:
 *  - 若 app.current_version_id 存在 → 从 versions 列表里找匹配项;
 *  - 否则(自己的草稿应用)→ 退回 /draft;
 *  - 都没拿到 → null,跳过该应用。
 */
export async function fetchSpaceAppVersion(app, config = null) {
  const cfg = config || getChayuanSpaceConfig()
  const headers = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${cfg.token}`,
  }
  const appId = app.id
  if (app.current_version_id) {
    const listResp = await fetch(
      `${cfg.baseUrl}/api/ai/space/apps/${encodeURIComponent(appId)}/versions`,
      { method: 'GET', headers },
    ).catch(() => null)
    if (listResp && listResp.ok) {
      const data = await listResp.json()
      const items = Array.isArray(data?.items) ? data.items : []
      const hit = items.find((v) => v.id === app.current_version_id) || items[0]
      if (hit) return hit
    }
  }
  // 自己未发布的 draft
  const draftResp = await fetch(
    `${cfg.baseUrl}/api/ai/space/apps/${encodeURIComponent(appId)}/draft`,
    { method: 'GET', headers },
  ).catch(() => null)
  if (draftResp && draftResp.ok) {
    const data = await draftResp.json()
    return data?.data || data
  }
  return null
}

/**
 * 把一个 AIApp(meta) + AIAppVersion(persona) 转成 WPS customAssistant 形态。
 *
 * persona.doc_assistant 里就是 chayuan-client 这边写下的全字段,直接复用。
 */
export function appToCustomAssistant(app, version) {
  const persona = (version && version.persona) || {}
  const spec = persona.doc_assistant || {}
  const now = new Date().toISOString()
  return {
    id: `custom_cy_${app.id}`,
    name: app.name,
    description: app.description || '',
    icon: app.icon || '📄',
    ribbonIcon: spec.ribbonIcon || '',
    modelType: spec.modelType || 'chat',
    modelId: spec.modelId || persona.model || null,
    persona: spec.persona || '',
    systemPrompt: spec.systemPrompt || persona.system_prompt || '',
    userPromptTemplate: spec.userPromptTemplate || '{{input}}',
    temperature: typeof spec.temperature === 'number' ? spec.temperature
      : (typeof persona?.params?.temperature === 'number' ? persona.params.temperature : 0.3),
    outputFormat: spec.outputFormat || 'markdown',
    documentAction: spec.documentAction || 'insert',
    inputSource: spec.inputSource || 'selection-preferred',
    group: spec.group || 'custom',
    displayOrder: spec.displayOrder == null ? null : Number(spec.displayOrder),
    displayLocations: Array.isArray(spec.displayLocations) && spec.displayLocations.length > 0
      ? [...spec.displayLocations]
      : ['ribbon-more'],
    targetLanguage: spec.targetLanguage || '中文',
    recommendationRequirement: spec.recommendationRequirement || '',
    version: spec.version || '1.0.0',
    parentAssistantIds: Array.isArray(spec.parentAssistantIds) ? [...spec.parentAssistantIds] : [],
    repairReason: spec.repairReason || '',
    benchmarkScore: spec.benchmarkScore == null ? null : Number(spec.benchmarkScore),
    isPromoted: spec.isPromoted !== false,
    visibleInRibbon: spec.visibleInRibbon !== false,
    createdAt: app.create_time || now,
    updatedAt: app.update_time || now,
    sortOrder: 0,
    reportSettings: spec.reportSettings || {
      enabled: false, type: 'summary', customType: '', template: '',
    },
    mediaOptions: spec.mediaOptions || {
      aspectRatio: '16:9', duration: '30s', voiceStyle: '专业自然',
    },
    // 记录来源,方便后续 UI 区分本地自建 vs 智能空间
    sourceType: 'chayuan-space',
    sourceAppId: app.id,
    sourceVersionId: app.current_version_id || (version && version.id) || null,
  }
}

/**
 * 完整同步流程:列表 → 逐应用拉版本 → 合并 → 保存。
 *
 * @param {{onProgress?:(done:number,total:number,name:string)=>void}} [opts]
 * @returns {Promise<{ added:number, updated:number, total:number }>}
 */
export async function syncDocAssistantsFromSpace(opts = {}) {
  const cfg = getChayuanSpaceConfig()
  const apps = await listSpaceDocAssistants(cfg)
  const existing = getCustomAssistants() || []
  const byId = new Map(existing.map((a) => [a.id, a]))
  let added = 0
  let updated = 0
  for (let i = 0; i < apps.length; i += 1) {
    const app = apps[i]
    if (opts.onProgress) opts.onProgress(i, apps.length, app.name || '')
    let version = null
    try {
      version = await fetchSpaceAppVersion(app, cfg)
    } catch {
      // 跳过单个失败的;不阻断整体
      continue
    }
    if (!version) continue
    const next = appToCustomAssistant(app, version)
    if (byId.has(next.id)) {
      updated += 1
      byId.set(next.id, { ...byId.get(next.id), ...next })
    } else {
      added += 1
      byId.set(next.id, next)
    }
  }
  const merged = Array.from(byId.values())
  saveCustomAssistants(merged)
  saveChayuanSpaceConfig({ lastSyncAt: Date.now() })
  return { added, updated, total: apps.length }
}
