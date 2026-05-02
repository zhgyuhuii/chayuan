/**
 * healthProbe — 知识库连接的连通性三步聚合
 *
 * 设计参考: plan-knowledge-base-integration.md §3.2.3
 *
 * 三步:
 *   1. GET /healthz                    服务在线 + 网络 RTT
 *   2. JWT: GET /auth/me  | HMAC: POST /openapi/ping   凭据有效
 *   3. GET /knowledge_base/list_knowledge_bases?limit=1  KB 通路 + ACL 链路
 *
 * 任一步失败立即短路;返回结构便于 UI 三段式展示 + 中文文案。
 */

import { createAuthClient } from './authClient.js'
import { resolve as _resolvePath } from './pathRouter.js'

function _ms() { return Date.now() }

async function _rawHealthz(baseUrl, signal) {
  const start = _ms()
  try {
    const url = `${String(baseUrl).replace(/\/+$/, '')}/healthz`
    const resp = await fetch(url, { signal, credentials: 'omit' })
    return {
      ok: resp.ok,
      status: resp.status,
      latencyMs: _ms() - start,
      requestId: resp.headers.get('x-request-id') || ''
    }
  } catch (e) {
    return { ok: false, status: 0, latencyMs: _ms() - start, error: e.message || String(e) }
  }
}

async function _credCheck(connection, auth, signal) {
  const start = _ms()
  try {
    // HMAC: /openapi/v1/ping (GET);JWT: /auth/me (GET)
    const path = connection.authMode === 'hmac' ? '/openapi/v1/ping' : '/auth/me'
    const init = { method: 'GET', signal }
    const resp = await auth.fetch(path, init)
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      return {
        ok: false,
        status: resp.status,
        latencyMs: _ms() - start,
        requestId: resp.headers.get('x-request-id') || '',
        error: _humanize(resp.status, body)
      }
    }
    const data = await resp.json().catch(() => ({}))
    // 从响应头/数据推断主体类型;服务端 §4.3 会写 X-Subject-Kind
    const subjectKind = (resp.headers.get('x-subject-kind') || '').toLowerCase()
      || (connection.authMode === 'hmac' ? 'app' : 'user')
    return {
      ok: true,
      status: resp.status,
      latencyMs: _ms() - start,
      requestId: resp.headers.get('x-request-id') || '',
      subjectKind,
      // 用户态:data.username/role;应用态:data.app_id/name/allow_public_kbs
      identity: connection.authMode === 'hmac'
        ? {
            appId: data?.app_id || data?.app_id_str || connection.hmac?.appId,
            name: data?.name || '',
            allowPublicKbs: !!data?.allow_public_kbs,
            rateLimitPerMin: data?.rate_limit_per_min,
            dailyQuota: data?.daily_quota
          }
        : {
            username: data?.username || data?.name || '',
            role: data?.role || 'user'
          },
      data
    }
  } catch (e) {
    return { ok: false, status: 0, latencyMs: _ms() - start, error: e.message || String(e) }
  }
}

async function _kbProbe(connection, auth, signal) {
  const start = _ms()
  try {
    // 不再 limit=1:健康探测要拿全量列表给 UI 显示"已授权 N 个 KB"
    // 服务端已按 ACL 过滤,真正的 KB 总数不会泄露
    const path = _resolvePath(connection, '/knowledge_base/list_knowledge_bases')
    if (!path) {
      return { ok: false, status: 0, latencyMs: 0, error: '当前鉴权模式不支持知识库通路探测' }
    }
    const resp = await auth.fetch(path, { method: 'GET', signal })
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      return {
        ok: false,
        status: resp.status,
        latencyMs: _ms() - start,
        requestId: resp.headers.get('x-request-id') || '',
        error: _humanize(resp.status, body)
      }
    }
    const data = await resp.json().catch(() => ({}))
    const list = Array.isArray(data?.data) ? data.data : []
    return {
      ok: true,
      status: resp.status,
      latencyMs: _ms() - start,
      requestId: resp.headers.get('x-request-id') || '',
      kbCount: list.length,
      kbNames: list.slice(0, 100).map(x => typeof x === 'string' ? x : (x.kb_name || x.id || ''))
    }
  } catch (e) {
    return { ok: false, status: 0, latencyMs: _ms() - start, error: e.message || String(e) }
  }
}

// 与 contract §4 错误码对应(plan §4.3.8);body 可能是 {detail:{code,msg}} 或纯文本
function _humanize(status, body) {
  let detail = null
  try { detail = JSON.parse(body)?.detail } catch (e) { /* not json */ }
  const code = detail?.code
  if (status === 401) {
    switch (code) {
      case 4011: return '凭据校验失败,请检查 APPID/AppKey'
      case 4012: return '本地时钟与服务端偏差过大,请校准系统时间'
      case 4013: return 'APPID 不存在或已被禁用,请联系管理员'
      case 4014: return 'AppKey 已被轮换,请重新输入新的 AppKey'
      case 4015: return '登录已过期,请重新登录'
      default:   return '凭据无效或已过期'
    }
  }
  if (status === 403) {
    switch (code) {
      case 4031: return '当前账号没有该知识库的访问权限'
      case 4032: return `APP 未被授权访问该知识库${detail?.msg ? `(${detail.msg})` : ''},请联系管理员调用 grants 接口`
      case 4033: return '该知识库为公开类型,但当前 APP 未启用公开访问,请联系管理员开启 allow_public_kbs'
      default:   return '凭据有效,但没有访问知识库的权限'
    }
  }
  if (status === 404) return '服务地址正确,但接口不存在(请确认服务端版本 ≥ v0.3.6)'
  if (status === 429) {
    switch (code) {
      case 4292: return 'APP 今日额度已用完'
      case 4293: return '你今日的搜索额度已用完'
      default:   return '请求过于频繁,请稍后再试'
    }
  }
  if (status >= 500) return `服务端异常(HTTP ${status})`
  return `HTTP ${status}: ${String(body).slice(0, 200)}`
}

export async function run(connection, options = {}) {
  if (!connection || !connection.baseUrl) {
    return {
      ok: false,
      steps: [{ name: 'baseUrl', ok: false, error: '未填写服务地址' }]
    }
  }
  const signal = options.signal
  const steps = []

  const s1 = await _rawHealthz(connection.baseUrl, signal)
  steps.push({ name: 'service', label: '服务地址', ...s1 })
  if (!s1.ok) {
    return { ok: false, steps, hint: '请检查服务地址、防火墙、HTTPS 证书' }
  }

  let auth
  try {
    auth = createAuthClient(connection)
  } catch (e) {
    steps.push({ name: 'cred', label: '凭据', ok: false, error: e.message })
    return { ok: false, steps }
  }

  const s2 = await _credCheck(connection, auth, signal)
  steps.push({ name: 'cred', label: '凭据', ...s2 })
  if (!s2.ok) {
    return { ok: false, steps, hint: '请检查用户名/密码 或 APPID/AppKey' }
  }

  const s3 = await _kbProbe(connection, auth, signal)
  steps.push({ name: 'kb', label: '知识库通路', ...s3 })
  if (!s3.ok) {
    return { ok: false, steps, hint: '凭据可用但无法访问知识库,请联系管理员授权' }
  }

  // ACL 引导:HMAC 模式连通但 0 grant,UI 必须醒目提示
  let aclHint = ''
  if (s2.subjectKind === 'app' && s3.kbCount === 0) {
    aclHint = `APP「${s2.identity?.name || s2.identity?.appId || ''}」已连通,但未被授权任何知识库。请联系管理员调用 POST /openapi/apps/{id}/kb_grants`
  } else if (s2.subjectKind === 'app' && !s2.identity?.allowPublicKbs && s3.kbCount > 0) {
    aclHint = '当前 APP 仅可见显式授权的知识库;如需访问公开 KB,请联系管理员开启 allow_public_kbs'
  }

  return {
    ok: true,
    steps,
    summary: {
      latencyMs: s1.latencyMs + s2.latencyMs + s3.latencyMs,
      kbCount: s3.kbCount,
      kbNames: s3.kbNames || [],
      subjectKind: s2.subjectKind,
      identity: s2.identity || null,
      aclHint
    }
  }
}

export default { run }
