/**
 * skillPackStore — 技能包存取统一入口（面板侧）。
 *
 * 权威存储 = sidecar 文件系统（62588 /skillpack/*，token 门禁，跨 webview 一致）；
 * PluginStorage 里的 customSkills 是历史遗留（迁移源 + sidecar 不可达时的兜底）。
 *
 * 迁移纪律：loadSkillPacks() 每次调用都会把本地残留的自定义技能推送到 sidecar
 * （幂等——推送成功即清本地；sidecar 不可达时保留本地，下次再试）。
 * 失败优先级：sidecar 数据与本地同名时 sidecar 赢（本地条目不再单独返回）。
 */

import { MCP_BASE_URL } from '../services/mcpBridge/config.js'
import { listCustomSkills, removeCustomSkill } from './skillSettings.js'

/**
 * /skillpack/* 为无 token 开放路由（sidecar 仅绑 127.0.0.1，与 /mcp、
 * /app-settings 同款安全模型）。此处直接裸 fetch：面板 webview 的
 * /token bootstrap 响应读取被 CORS 挡住时，token 门禁路由会永远 401。
 */
async function sidecarGet(path) {
  const res = await fetch(`${MCP_BASE_URL}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function sidecarPostPlain(path, body) {
  const res = await fetch(`${MCP_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function reachable() {
  try {
    await sidecarGet('/skillpack/list')
    return true
  } catch {
    return false
  }
}

/**
 * 拉取全部技能包（sidecar 权威 + 本地兜底合并，sidecar 同名赢）。
 * 顺带把本地残留的自定义技能迁移到 sidecar（幂等）。
 * 返回 [{name, description, category, version, body, entries?, local?}]
 */
export async function loadSkillPacks() {
  const locals = listCustomSkills().map(s => ({ ...s, local: true }))
  let remote = []
  let remoteOk = false
  try {
    const r = await sidecarGet('/skillpack/list')
    remoteOk = true
    remote = (r?.packs || []).map(p => ({
      name: String(p.name || ''),
      description: String(p.description || ''),
      category: String(p.category || 'other'),
      version: String(p.version || ''),
      body: String(p.body || ''),
      local: false
    })).filter(p => p.name)
  } catch { /* sidecar 不可达：本地兜底 */ }

  if (remoteOk && locals.length) {
    // 迁移：本地残留逐包推 sidecar，成功即清本地
    for (const p of locals) {
      try {
        await sidecarPostPlain('/skillpack/save', { pack: {
          name: p.name,
          description: p.description,
          category: p.category,
          version: p.version,
          body: p.body,
          entries: p.entries
        } })
        removeCustomSkill(p.name)
      } catch { /* 单包失败保留本地，下次再试 */ }
    }
  }

  const remoteNames = new Set(remote.map(p => p.name))
  const localsKept = locals.filter(p => !remoteNames.has(p.name) || !remoteOk)
  return [...remote, ...localsKept]
}

/** 保存（sidecar 权威；不可达时本地兜底——绝不静默丢数据）。返回 {ok, local} */
export async function saveSkillPackAnywhere(pack) {
  try {
    const r = await sidecarPostPlain('/skillpack/save', { pack })
    if (r?.ok) return { ok: true, local: false }
    return { ok: false, message: String(r?.message || '保存失败') }
  } catch (e) {
    // sidecar 不可达：本地兜底（entries 体积可能超 PluginStorage 配额，
    // upsertCustomSkill 会回读校验并如实报错）
    const { upsertCustomSkill } = await import('./skillSettings.js')
    const r = upsertCustomSkill(pack)
    if (!r.ok) return { ok: false, message: r.reason === 'persist'
      ? '写入存储失败：技能包超出面板存储配额（sidecar 也未运行），未保存。'
      : '导入内容无效。' }
    return { ok: true, local: true }
  }
}

/** 删除（sidecar 与本地两侧都尽力清）。返回 {ok} */
export async function removeSkillPackAnywhere(name) {
  let ok = true
  try {
    const r = await sidecarPostPlain('/skillpack/remove', { name })
    if (!r?.ok) ok = false
  } catch { ok = false }
  try { removeCustomSkill(name) } catch { /* 本地无此条也正常 */ }
  return { ok }
}
