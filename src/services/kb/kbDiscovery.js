/**
 * kbDiscovery — 自动发现本机 chayuan-harness(chatop) 知识库服务并动态接入
 *
 * 服务端事实(chayuan-harness docs/port-registry.md + chatop-kb/src/service.js):
 *   - chatop-kb 对外服务:固定基址 52582,被占顺延 +1 最多 20 个,根路径与
 *     /api/chatop-kb/* 前缀等价;端口持久化在 harness storages/chatop-kb/service.json
 *   - dsh 宿主管理面:52584(web 形态),多用户会话段 52601+,KB 挂在
 *     /api/chatop-kb 前缀下;旧装机保留 3080..3090 兼容尾巴
 *   - 全部 loopback-only、无 token(回环信任),/status 返回
 *     { ok:true, kbs:[...], chain?, ... } — 该形状即指纹,随机本机服务不可能误配
 *
 * 发现协议(与 chayuan-office kb-client「四级发现」同构,去掉浏览器拿不到的
 * hint-file 层):
 *   手动指定 → 上次缓存 → 并行端口梯探测,先命中先用
 *
 * 动态接入:
 *   discover 到实例后 ensureHarnessConnection() 把它落成一个稳定连接
 *   (id='chatop-harness-local', serviceType='chatop', authMode='none'),
 *   库列表运行时实时从 /kbs 拉 — harness 侧增删知识库无需在 WPS 侧重配。
 */

import { loadGlobalSettings, saveGlobalSettings } from '../../utils/globalSettings.js'
import { upsertConnection, getConnection } from './connectionStore.js'

/** 端口注册表(chayuan-harness packages/ports) */
export const KB_SERVICE_PORT = 52582
export const KB_SERVICE_SPAN = 20
export const DSH_WEB_PORT = 52584
export const SESSION_PORT_BASE = 52601
export const LEGACY_PORT_BASE = 3080

/** 稳定连接 id:重复发现只更新不重建 */
export const HARNESS_CONNECTION_ID = 'chatop-harness-local'
export const HARNESS_CONNECTION_NAME = '察元 Harness 本机知识库'

const CACHE_NAMESPACE = 'kbDiscovery'
const DEFAULT_TIMEOUT_MS = 1500

function _stripTrail(url) {
  return String(url || '').replace(/\/+$/, '')
}

/** chatop-kb /status 的指纹判定(与 chayuan-office isKbStatus 同一约定) */
export function isChatopStatus(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    value.ok === true &&
    Array.isArray(value.kbs)
  )
}

/** chatop 连接判定:serviceType='chatop'(authMode 恒为 'none',回环免鉴权) */
export function isChatop(connection) {
  return !!connection && connection.serviceType === 'chatop'
}

/** 拼 chatop 服务 URL:baseUrl + apiPrefix(dsh 管理面形态)+ 端点路径 */
export function apiUrl(connection, path) {
  const base = _stripTrail(connection?.baseUrl)
  const prefix = _stripTrail(connection?.apiPrefix)
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${prefix}${p}`
}

/** 默认探测梯:对外服务段(含顺延)→ dsh 管理面 → 会话段 → 旧段兜底 */
export function defaultCandidates() {
  const out = []
  for (let i = 0; i <= KB_SERVICE_SPAN; i++) {
    out.push({ url: `http://127.0.0.1:${KB_SERVICE_PORT + i}`, apiPrefix: '' })
  }
  out.push({ url: `http://127.0.0.1:${DSH_WEB_PORT}`, apiPrefix: '/api/chatop-kb' })
  for (let i = 0; i < 10; i++) {
    out.push({ url: `http://127.0.0.1:${SESSION_PORT_BASE + i}`, apiPrefix: '/api/chatop-kb' })
  }
  for (let i = 0; i < 6; i++) {
    out.push({ url: `http://127.0.0.1:${LEGACY_PORT_BASE + i}`, apiPrefix: '/api/chatop-kb' })
  }
  return out
}

/**
 * 探测单个 origin 的 /status;命中指纹返回 { kbs, chain?... },否则 null。
 * 永不 reject(网络噪声一律归一为 null)。
 */
export async function probeStatus(baseUrl, { apiPrefix = '', timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  if (signal) {
    if (signal.aborted) { clearTimeout(timer); return null }
    signal.addEventListener('abort', () => ctrl.abort(), { once: true })
  }
  try {
    const url = `${_stripTrail(baseUrl)}${_stripTrail(apiPrefix)}/status`
    const resp = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    })
    if (!resp.ok) return null
    const data = await resp.json().catch(() => null)
    return isChatopStatus(data) ? data : null
  } catch (e) {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function _readCache() {
  try {
    const all = loadGlobalSettings() || {}
    return all[CACHE_NAMESPACE] || null
  } catch (e) {
    return null
  }
}

function _writeCache(entry) {
  try {
    const all = loadGlobalSettings() || {}
    all[CACHE_NAMESPACE] = { ...(all[CACHE_NAMESPACE] || {}), ...entry }
    saveGlobalSettings(all)
  } catch (e) { /* 缓存失败不影响发现结果 */ }
}

/** 清掉上次发现缓存(设置页"重新扫描"或测试用) */
export function forget() {
  try {
    const all = loadGlobalSettings() || {}
    delete all[CACHE_NAMESPACE]
    saveGlobalSettings(all)
  } catch (e) { /* noop */ }
}

function _guessPrefix(baseUrl) {
  // 手动填 dsh 管理面地址时通常带 /api/chatop-kb 前缀
  return /\/api\/chatop-kb\/?$/.test(_stripTrail(baseUrl)) ? '/api/chatop-kb' : ''
}

/** 完成序竞争:全部并行发出,第一个命中指纹的候选胜出 */
function _firstHit(attempts) {
  return new Promise((resolve) => {
    let pending = attempts.length
    let settled = false
    if (!pending) { resolve(null); return }
    for (const p of attempts) {
      p.then((r) => {
        if (settled) return
        if (r) { settled = true; resolve(r) }
        else if (--pending === 0) { settled = true; resolve(null) }
      }).catch(() => {
        if (settled) return
        if (--pending === 0) { settled = true; resolve(null) }
      })
    }
  })
}

/**
 * 发现本机 chatop-kb 服务。
 * @param {object} options
 *   - explicitBaseUrl  手动指定的服务地址(设置页/表单);命中优先级最高
 *   - explicitApiPrefix 手动地址的前缀(缺省按地址形态猜)
 *   - force            true 跳过缓存直接重扫
 *   - candidates       探测梯覆盖(测试注入用)
 *   - timeoutMs / signal
 * @returns Promise<{ baseUrl, origin, apiPrefix, source: 'manual'|'cached'|'probe',
 *                     status, kbCount } | null>
 */
export async function discoverHarnessKb(options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const signal = options.signal

  const _hit = (url, apiPrefix, source, status) => {
    const origin = _stripTrail(url).replace(/\/api\/chatop-kb\/?$/, '')
    const baseUrl = origin
    const result = {
      baseUrl,
      origin,
      apiPrefix: _stripTrail(apiPrefix),
      source,
      status,
      kbCount: Array.isArray(status?.kbs) ? status.kbs.length : 0
    }
    _writeCache({ baseUrl, origin, apiPrefix: result.apiPrefix, source, lastGoodAt: new Date().toISOString() })
    return result
  }

  // L1 手动指定
  if (options.explicitBaseUrl) {
    const prefix = options.explicitApiPrefix ?? _guessPrefix(options.explicitBaseUrl)
    const status = await probeStatus(options.explicitBaseUrl, { apiPrefix: prefix, timeoutMs, signal })
    if (status) return _hit(options.explicitBaseUrl, prefix, 'manual', status)
    if (options.noFallback) return null
  }

  // L2 上次发现缓存(地址漂移/重启换端口时失配 → 落到探测)
  if (!options.force) {
    const cached = _readCache()
    if (cached?.baseUrl) {
      const status = await probeStatus(cached.baseUrl, { apiPrefix: cached.apiPrefix, timeoutMs, signal })
      if (status) return _hit(cached.baseUrl, cached.apiPrefix, 'cached', status)
    }
  }

  // L3 并行端口梯
  const candidates = options.candidates || defaultCandidates()
  const attempts = candidates.map(c =>
    probeStatus(c.url, { apiPrefix: c.apiPrefix, timeoutMs, signal })
      .then(status => (status ? { ...c, status } : null))
  )
  const winner = await _firstHit(attempts)
  if (!winner) return null
  return _hit(winner.url, winner.apiPrefix, 'probe', winner.status)
}

/**
 * 发现 + 动态接入:把发现的实例落成/更新稳定连接。
 * @returns Promise<{
 *   ok: boolean,
 *   action: 'added'|'updated'|'ok'|'missing',
 *   connection: object|null,
 *   discovery: object|null
 * }>
 */
export async function ensureHarnessConnection(options = {}) {
  const found = await discoverHarnessKb(options)
  const existing = getConnection(HARNESS_CONNECTION_ID)

  if (!found) {
    // 服务失联:保留连接配置只刷新健康快照,服务恢复后可无缝续上
    if (existing && options.markMissing !== false) {
      try {
        upsertConnection({
          ...existing,
          healthSnapshot: {
            ok: false,
            at: new Date().toISOString(),
            error: '本机 Harness 服务未发现(请确认 chatop 已启动)',
            kbCount: 0
          }
        })
      } catch (e) { /* noop */ }
    }
    return { ok: false, action: 'missing', connection: existing || null, discovery: null }
  }

  const now = new Date().toISOString()
  const kbCount = found.kbCount
  const healthSnapshot = { ok: true, at: now, kbCount, source: found.source }
  const discovered = {
    baseUrl: found.baseUrl,
    apiPrefix: found.apiPrefix,
    serviceType: 'chatop',
    autoDiscovered: true,
    discovery: { source: found.source, origin: found.origin, at: now }
  }

  if (!existing) {
    const conn = upsertConnection({
      id: HARNESS_CONNECTION_ID,
      name: HARNESS_CONNECTION_NAME,
      authMode: 'none',
      ...discovered,
      healthSnapshot
    })
    return { ok: true, action: 'added', connection: conn, discovery: found }
  }

  const moved = existing.baseUrl !== found.baseUrl
    || _stripTrail(existing.apiPrefix) !== found.apiPrefix
  const conn = upsertConnection({
    ...existing,
    // 用户改过名字则保留;baseUrl/前缀始终跟随最新发现
    name: existing.name || HARNESS_CONNECTION_NAME,
    ...discovered,
    healthSnapshot
  })
  return { ok: true, action: moved ? 'updated' : 'ok', connection: conn, discovery: found }
}

export default {
  discoverHarnessKb, ensureHarnessConnection, probeStatus, isChatopStatus,
  isChatop, apiUrl, defaultCandidates, forget,
  HARNESS_CONNECTION_ID, HARNESS_CONNECTION_NAME
}
