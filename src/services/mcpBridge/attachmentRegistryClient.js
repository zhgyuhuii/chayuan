/**
 * 附件注册表客户端（file_parse 的「附件N」别名源）。
 *
 * 面板把非纯文本附件 materialize 到 数据目录/_temp 后，fire-and-forget 登记
 * 到 sidecar PUT /attachments/register（X-Chayuan-Token 鉴权，与 session-store
 * 同级）；失败静默——注册缺失只影响「30 分钟内按别名 file_parse」，不影响
 * 面板自身任何能力（降级路径）。LRU/TTL 清理由 sidecar 侧 attachments.json 承担。
 */

import { readSidecarToken } from './webviewFsProbe.js'
import { syncTokenFromSidecar } from './agentClient.js'
import { MCP_BASE_URL } from './config.js'

const SIDECAR_BASE = MCP_BASE_URL
let _cachedToken = null

function token() {
  if (_cachedToken) return _cachedToken
  try {
    _cachedToken = String(window.Application?.PluginStorage?.getItem('mcp_sidecar_token') || '').trim() || ''
  } catch (_) {
    _cachedToken = ''
  }
  if (!_cachedToken) {
    try {
      _cachedToken = readSidecarToken() || ''
    } catch (_) {
      _cachedToken = ''
    }
  }
  return _cachedToken
}

async function ensureToken() {
  const direct = token()
  if (direct) return direct
  try {
    const bootstrapped = await syncTokenFromSidecar()
    if (bootstrapped) {
      _cachedToken = String(bootstrapped).trim()
      return _cachedToken
    }
  } catch (_) { /* sidecar 未起：静默降级 */ }
  return token()
}

/**
 * 登记一条附件落盘记录。fire-and-forget，任何失败静默。
 * @param {{ alias: string, name: string, path: string, bytes?: number, scopeKey?: string }} entry
 */
export function registerAttachmentPath(entry) {
  ;(async () => {
    try {
      const tk = await ensureToken()
      if (!tk || !entry?.path) return
      const res = await fetch(`${SIDECAR_BASE}/attachments/register`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Chayuan-Token': tk },
        body: JSON.stringify({
          alias: String(entry.alias || '').slice(0, 60),
          name: String(entry.name || '').slice(0, 200),
          path: String(entry.path || ''),
          bytes: Number(entry.bytes) || 0,
          scopeKey: String(entry.scopeKey || '').slice(0, 120)
        })
      })
      if (!res?.ok) throw new Error(`register http ${res?.status}`)
    } catch (_) { /* 注册失败不影响发送主流程 */ }
  })()
}

export default { registerAttachmentPath }
