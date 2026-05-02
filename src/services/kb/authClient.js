/**
 * authClient — 双模 fetch 包装(JWT / HMAC)
 *
 * 设计参考:
 *   - plan-knowledge-base-integration.md §3.2.2
 *   - chayuan-server openapi 现约定: x-app-id / x-timestamp / x-sign
 *     sign = base64(HMAC-SHA256(secret, ts + body_bytes))
 *
 * 用法:
 *   const auth = createAuthClient(connection, { onTokenRefresh })
 *   const resp = await auth.fetch('/knowledge_base/list_knowledge_bases', { method: 'GET' })
 *
 * 关键约定:
 *   - body 必须是 stringified JSON;空 body 用 "{}"(HMAC 签名一致性)
 *   - JWT 模式 401 → 自动 refresh 一次,再失败抛出
 *   - HMAC 时间戳取秒级 unix ts;服务端容忍 ±300s 漂移
 *
 * v1 实现策略:
 *   - 把 connection 中的 ciphertext_password / ciphertext_appSecret 在调用时
 *     即时解密,**不在内存中长期持有明文**(降低被 dump 风险)
 *   - access/refresh token 短期持有于 closure,断开时清空
 */

import { decrypt } from './connectionCipher.js'

const DEFAULT_TIMEOUT_MS = 15_000

function _normalizeBaseUrl(url) {
  return String(url || '').replace(/\/+$/, '')
}

function _nowSec() {
  return Math.floor(Date.now() / 1000)
}

async function _hmacSign(secret, ts, bodyBytes) {
  const enc = new TextEncoder()
  const keyData = enc.encode(secret)
  const key = await globalThis.crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  // 服务端约定:消息 = ts + body_bytes(字节级拼接,见 chayuan-server/shared/app_signing.py)
  const msg = new Uint8Array(enc.encode(String(ts)).length + bodyBytes.length)
  msg.set(enc.encode(String(ts)), 0)
  msg.set(bodyBytes, enc.encode(String(ts)).length)
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, msg)
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

export function createAuthClient(connection, options = {}) {
  if (!connection) throw new Error('connection is required')
  const baseUrl = _normalizeBaseUrl(connection.baseUrl)
  const onTokenRefresh = typeof options.onTokenRefresh === 'function' ? options.onTokenRefresh : null
  let accessToken = connection.jwt?.accessToken || null
  let refreshToken = connection.jwt?.refreshToken || null

  async function _login() {
    if (connection.authMode !== 'jwt') return
    const username = connection.jwt?.username
    if (!username) throw new Error('username missing')
    const password = await decrypt(connection.jwt?.ciphertext_password)
    const resp = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    if (!resp.ok) throw new Error(`login failed: HTTP ${resp.status}`)
    const data = await resp.json()
    accessToken = data?.access_token || data?.access || null
    refreshToken = data?.refresh_token || data?.refresh || refreshToken
    if (onTokenRefresh) onTokenRefresh({ accessToken, refreshToken })
  }

  async function _refresh() {
    if (!refreshToken) return _login()
    const resp = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    })
    if (!resp.ok) {
      // refresh 失败 → 重新 login
      return _login()
    }
    const data = await resp.json()
    accessToken = data?.access_token || data?.access || accessToken
    refreshToken = data?.refresh_token || data?.refresh || refreshToken
    if (onTokenRefresh) onTokenRefresh({ accessToken, refreshToken })
  }

  async function _doFetch(path, init, retried) {
    const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const method = (init.method || 'GET').toUpperCase()
    const headers = new Headers(init.headers || {})
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')
    let bodyStr = ''
    if (init.body !== undefined && init.body !== null) {
      if (typeof init.body === 'string') bodyStr = init.body
      else {
        bodyStr = JSON.stringify(init.body)
        headers.set('Content-Type', 'application/json')
      }
    } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      bodyStr = '{}'
      headers.set('Content-Type', 'application/json')
    }

    if (connection.authMode === 'jwt') {
      if (!accessToken) await _login()
      headers.set('Authorization', `Bearer ${accessToken}`)
    } else if (connection.authMode === 'hmac') {
      const appId = connection.hmac?.appId
      if (!appId) throw new Error('appId missing')
      const secret = await decrypt(connection.hmac?.ciphertext_appSecret)
      const ts = String(_nowSec())
      const bodyBytes = new TextEncoder().encode(bodyStr || '{}')
      const sig = await _hmacSign(secret, ts, bodyBytes)
      headers.set('x-app-id', appId)
      headers.set('x-timestamp', ts)
      headers.set('x-sign', sig)
    }

    const ctrl = new AbortController()
    const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    if (init.signal) {
      init.signal.addEventListener('abort', () => ctrl.abort(), { once: true })
    }
    let resp
    try {
      resp = await fetch(url, {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : bodyStr,
        signal: ctrl.signal,
        credentials: 'omit'
      })
    } finally {
      clearTimeout(t)
    }

    if (resp.status === 401 && connection.authMode === 'jwt' && !retried) {
      await _refresh()
      return _doFetch(path, init, true)
    }
    return resp
  }

  return {
    fetch: (path, init = {}) => _doFetch(path, init, false),
    login: _login,
    refresh: _refresh,
    get accessToken() { return accessToken },
    get refreshToken() { return refreshToken }
  }
}

export default { createAuthClient }
