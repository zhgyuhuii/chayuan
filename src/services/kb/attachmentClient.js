/**
 * attachmentClient — 附件下载链接拼装 + 短 token 续签
 *
 * 详见 plan §2.4 / §4.5 / §4.3.7
 *
 * buildDownloadUrl(connection, chunk, { preview }) → 完整 URL
 *   - chunk.download_token 存在 → 直接拼 ?token=...(走 _QUERY_TOKEN_ALLOWED_PATHS)
 *   - JWT/HMAC 都使用 server 在 /search_batch 响应里下发的 download_token
 *   - download_token 是短期 JWT(默认 30min),携带 aud=user:{id} 或 app:{id};
 *     跨账号使用、过期、KB 已 revoke 都会得到 401,UI 应弹 humanizeDownloadError 文案
 *
 * humanizeDownloadError(status, body) → 中文文案;与 healthProbe 同源错误码
 *
 * refreshToken(...) — v1 不实现独立刷新;依赖每次搜索新发的 token
 */

import { resolve as _resolvePath } from './pathRouter.js'

function _normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '')
}

export function buildDownloadUrl(connection, chunk, options = {}) {
  if (!connection?.baseUrl || !chunk?.kb_name || !chunk?.file_name) return ''
  // 逻辑路径 → 实际路径(JWT 走 /knowledge_base/download_doc;HMAC 走 /openapi/v1/kb/download_doc)
  const logical = options.preview ? '/knowledge_base/preview_doc' : '/knowledge_base/download_doc'
  const path = _resolvePath(connection, logical) || logical
  const params = new URLSearchParams()
  params.set('knowledge_base_name', chunk.kb_name)
  params.set('file_name', chunk.file_name)
  // openapi /kb/download_doc 也接 ?preview= 参数(我们 preview/download 共享 endpoint)
  if (options.preview && path.includes('/openapi/v1/kb/download_doc')) {
    params.set('preview', 'true')
  }
  if (chunk.download_token) {
    // 服务端 _QUERY_TOKEN_ALLOWED_PATHS 接受 ?token=;openapi 路径在 endpoint 内显式校验
    params.set('token', chunk.download_token)
  }
  return `${_normalizeBaseUrl(connection.baseUrl)}${path}?${params.toString()}`
}

// eslint-disable-next-line no-unused-vars
export async function refreshToken(_connection, _kbName, _fileName) {
  // v1:依赖搜索批次返回的 token;单独续签接口暂不实现
  // 签名预留 (connection, kbName, fileName) 给 v2 单独调 /search_batch 抓 token 使用
  return null
}

// 与 healthProbe._humanize 共享语义,但下载场景文案略不同
export function humanizeDownloadError(status, body) {
  let detail = null
  try { detail = JSON.parse(body)?.detail } catch (e) { /* not json */ }
  const code = detail?.code
  if (status === 401) {
    if (code === 4014 || code === 4011) return '下载链接已失效,请重新发起搜索以获取新的链接'
    if (code === 4012)                   return '本地时钟与服务端偏差过大,请校准系统时间'
    if (code === 4013)                   return 'APP 已被禁用,无法下载'
    return '下载凭据无效,请重新发起搜索'
  }
  if (status === 403) {
    if (code === 4032) return '当前 APP 对该知识库的授权已被撤销,无法下载'
    if (code === 4033) return '该文件所属知识库为公开类型,但当前 APP 未启用 allow_public_kbs'
    return '你没有该文件的下载权限'
  }
  if (status === 404) return '文件不存在或已被移除'
  if (status === 429) return '下载请求过于频繁,请稍后再试'
  if (status >= 500)  return `服务端异常(HTTP ${status})`
  return `下载失败(HTTP ${status})`
}

export default { buildDownloadUrl, refreshToken, humanizeDownloadError }
