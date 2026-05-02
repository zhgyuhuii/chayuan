/**
 * pathRouter — 把"逻辑 KB 路径"映射到"实际后端路径"
 *
 * 设计参考: plan v1.3 §4.3 双前缀架构
 *   - JWT 模式 → /knowledge_base/* (chayuan-server kb_routes)
 *   - HMAC 模式 → /openapi/v1/kb/* (chayuan-server openapi_routes,需 kb:read scope)
 *
 * 上层(searchClient/kbCatalog/healthProbe/attachmentClient)统一用"逻辑路径"调用
 * resolve(),返回连接实际应该打的路径。
 *
 * 这层抽象的好处:
 *   - HMAC 接入永远不会"意外"走 /knowledge_base/* (那条路要 JWT,会 401);
 *   - JWT 接入永远不会"意外"走 /openapi/v1/* (那条路要签名,会 401);
 *   - 升级新接口时只在一处加 case。
 *
 * 已支持的逻辑路径:
 *   /knowledge_base/list_knowledge_bases       → openapi: /openapi/v1/kb/list_knowledge_bases
 *   /knowledge_base/search_batch               → openapi: /openapi/v1/kb/search_batch
 *   /knowledge_base/search_batch_stream        → openapi: /openapi/v1/kb/search_batch_stream
 *   /knowledge_base/download_doc               → openapi: /openapi/v1/kb/download_doc
 *   /knowledge_base/preview_doc                → openapi: /openapi/v1/kb/download_doc(preview=true)
 *   /knowledge_base/search_docs (回退)         → 仅 JWT 支持(openapi 不开放,鼓励走 batch)
 *   /knowledge_universe/tree                   → 仅 JWT 支持(openapi 不开放;HMAC 只能拿平铺列表)
 *   /healthz                                   → 两边都不走鉴权,直接平凡映射
 *   /auth/me / /auth/login / /auth/refresh     → 仅 JWT
 *   /openapi/v1/ping                           → 仅 HMAC
 *
 * 不支持的组合(返回 null,调用方应跳过该步):
 *   - HMAC + /auth/me
 *   - HMAC + /knowledge_universe/tree
 *   - JWT + /openapi/v1/ping
 */

const HMAC_KB_MAPPING = {
  '/knowledge_base/list_knowledge_bases':       '/openapi/v1/kb/list_knowledge_bases',
  '/knowledge_base/search_batch':               '/openapi/v1/kb/search_batch',
  '/knowledge_base/search_batch_stream':        '/openapi/v1/kb/search_batch_stream',
  '/knowledge_base/download_doc':               '/openapi/v1/kb/download_doc',
  '/knowledge_base/preview_doc':                '/openapi/v1/kb/download_doc',  // preview=true
}

// 仅 JWT 可用(HMAC 不支持) — 命中即返 null,调用方决定降级
const JWT_ONLY = new Set([
  '/auth/me',
  '/auth/login',
  '/auth/refresh',
  '/knowledge_universe/tree',
  '/knowledge_base/search_docs',  // 鼓励 HMAC 走 search_batch
])

// 仅 HMAC 可用
const HMAC_ONLY = new Set([
  '/openapi/v1/ping',
  '/openapi/v1/whoami',
])

/**
 * 解析逻辑路径到实际路径。
 * @param {object} connection 含 authMode='jwt'|'hmac'
 * @param {string} logicalPath 例 '/knowledge_base/search_batch'
 * @returns {string|null} 实际路径;null 表示该模式下不支持
 */
export function resolve(connection, logicalPath) {
  if (!connection || !logicalPath) return null
  const mode = connection.authMode || 'jwt'

  if (mode === 'jwt') {
    if (HMAC_ONLY.has(logicalPath)) return null
    return logicalPath
  }

  if (mode === 'hmac') {
    if (JWT_ONLY.has(logicalPath)) return null
    if (HMAC_KB_MAPPING[logicalPath]) return HMAC_KB_MAPPING[logicalPath]
    if (logicalPath.startsWith('/openapi/v1/')) return logicalPath  // 已是 openapi 形式
    if (logicalPath === '/healthz') return '/healthz'
    // 兜底:其它 /knowledge_base/* 暂未在 HMAC 通道开放(写入类的 upload/delete/recreate 等)
    if (logicalPath.startsWith('/knowledge_base/')) return null
    return logicalPath
  }

  return logicalPath
}

/**
 * 便捷:给 download_doc 拼带 preview=1 的查询参数
 */
export function withPreviewParam(realPath, paramsObj, preview) {
  // 当 logicalPath=/knowledge_base/preview_doc 在 HMAC 模式下被映射为 download_doc 时
  // 调用方需要补上 preview=true;此函数只负责拼参数
  const params = new URLSearchParams(paramsObj || {})
  if (preview) params.set('preview', 'true')
  return realPath + (realPath.includes('?') ? '&' : '?') + params.toString()
}

export default { resolve, withPreviewParam }
