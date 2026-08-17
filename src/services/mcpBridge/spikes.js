/**
 * Pre-MVP spikes (run inside WPS WebView).
 * Results decide Phase 3 gates: WS Agent, ShellExecute spawn, ribbon survival.
 */
import { MCP_BASE_URL, MCP_DEFAULT_PORT } from './config.js'
import { getStoredToken, probeSidecar } from './agentClient.js'
import { getSidecarStartCandidates } from './sidecarLauncher.js'

const STORAGE_SPIKE_KEY = 'chayuan_mcp_spike_results'
const STORAGE_ALIVE_KEY = 'chayuan_mcp_agent_alive'

function storageGet(key) {
  try {
    return window.Application?.PluginStorage?.getItem?.(key)
  } catch {
    return null
  }
}

function storageSet(key, value) {
  try {
    window.Application?.PluginStorage?.setItem?.(key, value)
  } catch { /* ignore */ }
}

function fileUrlToPath(url) {
  let s = String(url || '')
  if (/^https?:\/\//i.test(s)) return ''
  if (/^file:\/\//i.test(s)) {
    s = s.replace(/^file:\/\//i, '')
    // file:///C:/path → C:/path ; file://localhost/C:/path
    s = s.replace(/^\/+/, '')
    if (/^localhost\//i.test(s)) s = s.replace(/^localhost\//i, '')
    try { s = decodeURIComponent(s) } catch { /* ignore */ }
  }
  return s.replace(/\//g, '\\')
}

/**
 * Spike 1: Can file:// (or WPS WebView) open ws://127.0.0.1 ?
 */
export async function spikeWebSocket({ timeoutMs = 4000 } = {}) {
  const startedAt = Date.now()
  const pageProtocol = String(window.location?.protocol || '')
  const pageHref = String(window.location?.href || '').slice(0, 120)
  const wsUrl = `ws://127.0.0.1:${MCP_DEFAULT_PORT}/agent-ws`

  if (typeof WebSocket === 'undefined') {
    return {
      id: 'ws',
      ok: false,
      verdict: 'NO_WEBSOCKET_API',
      pageProtocol,
      pageHref,
      elapsedMs: Date.now() - startedAt,
      note: '环境无 WebSocket 构造器 → 坚持 HTTP 长轮询'
    }
  }

  return new Promise(resolve => {
    let settled = false
    let ws
    const finish = (result) => {
      if (settled) return
      settled = true
      try { ws?.close() } catch { /* ignore */ }
      resolve({
        id: 'ws',
        pageProtocol,
        pageHref,
        wsUrl,
        elapsedMs: Date.now() - startedAt,
        ...result
      })
    }
    const timer = setTimeout(() => {
      finish({
        ok: false,
        verdict: 'TIMEOUT',
        note: '连接超时；可能被策略拦截或 sidecar 无 WS 端点未就绪 → 坚持长轮询'
      })
    }, timeoutMs)

    try {
      ws = new WebSocket(wsUrl)
      ws.onopen = () => {
        clearTimeout(timer)
        try { ws.send(JSON.stringify({ type: 'ping', t: Date.now() })) } catch { /* ignore */ }
        finish({
          ok: true,
          verdict: 'OPEN_OK',
          note: 'WebSocket 可从当前页面连到 127.0.0.1 → Phase 3 可评估切 WS'
        })
      }
      ws.onerror = () => {
        // onclose usually follows; wait briefly
      }
      ws.onclose = (ev) => {
        clearTimeout(timer)
        if (settled) return
        // code 1006 often = refused/blocked
        const blocked = pageProtocol === 'file:' && (ev.code === 1006 || ev.code === 1008)
        finish({
          ok: false,
          verdict: blocked ? 'LIKELY_BLOCKED_OR_REFUSED' : 'CLOSED',
          closeCode: ev.code,
          closeReason: ev.reason || '',
          note: '未能稳定打开 WS；MVP/首期继续 HTTP 长轮询'
        })
      }
      ws.onmessage = () => {
        clearTimeout(timer)
        finish({
          ok: true,
          verdict: 'OPEN_AND_MESSAGE',
          note: 'WS 握手并收到消息 → Phase 3 可切 WS'
        })
      }
    } catch (e) {
      clearTimeout(timer)
      finish({
        ok: false,
        verdict: 'THROW',
        error: e?.message || String(e),
        note: '构造 WebSocket 抛错 → 坚持长轮询'
      })
    }
  })
}

/**
 * Spike 2: Can OAAssist.ShellExecute launch a local .cmd that hits sidecar marker?
 */
export async function spikeShellExecute({ waitMs = 6000 } = {}) {
  const startedAt = Date.now()
  const hasApi = !!(window.Application?.OAAssist?.ShellExecute)
  const candidates = getSidecarStartCandidates()
    .filter(c => /\.cmd$/i.test(c) && !/^https?:\/\//i.test(c))
    .map(c => ({ raw: c, path: fileUrlToPath(c) }))
    .filter(c => c.path && !/^https?:\/\//i.test(c.path))

  if (!hasApi) {
    return {
      id: 'shell',
      ok: false,
      verdict: 'NO_SHELLEXECUTE_API',
      candidates,
      elapsedMs: Date.now() - startedAt,
      note: '无 OAAssist.ShellExecute → 放弃 WPS 内 spawn，Windows 用自研安装器/手动启动'
    }
  }

  const healthBefore = await probeSidecar()
  const markerId = `spike-${Date.now().toString(36)}`
  let launchedPath = ''
  let launchError = ''

  // sidecar 离线：优先 start-mcp.cmd（能拉起 sidecar，Spike 自愈为 SIDECAR_CAME_ONLINE）；
  // 在线：优先 spike-shell-marker.cmd（只验证 ShellExecute 通路，不重复拉进程）。
  const spikeCmdCandidates = []
  for (const c of candidates) {
    if (/start-mcp\.cmd$/i.test(c.path)) {
      if (!healthBefore.online) {
        spikeCmdCandidates.unshift(c)
        continue
      }
      spikeCmdCandidates.push(c)
      spikeCmdCandidates.unshift({
        raw: c.raw.replace(/start-mcp\.cmd$/i, 'spike-shell-marker.cmd'),
        path: c.path.replace(/start-mcp\.cmd$/i, 'spike-shell-marker.cmd')
      })
      continue
    }
    spikeCmdCandidates.push(c)
  }

  for (const c of spikeCmdCandidates) {
    if (!c.path || /^https?:\/\//i.test(c.path)) continue
    try {
      // Pass marker via env-like arg: ShellExecute may only take path
      window.Application.OAAssist.ShellExecute(c.path)
      launchedPath = c.path
      break
    } catch (e) {
      launchError = e?.message || String(e)
    }
  }

  if (!launchedPath) {
    return {
      id: 'shell',
      ok: false,
      verdict: 'LAUNCH_THROW_OR_EMPTY',
      hasApi: true,
      launchError,
      candidates: spikeCmdCandidates,
      elapsedMs: Date.now() - startedAt,
      note: 'ShellExecute 调用失败 → 勿把 WPS spawn 当主路径'
    }
  }

  // Wait for sidecar health or marker endpoint
  let markerHit = false
  let healthAfter = healthBefore
  const deadline = Date.now() + waitMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 400))
    healthAfter = await probeSidecar()
    try {
      const token = getStoredToken()
      const res = await fetch(`${MCP_BASE_URL}/spike/marker`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        const recentDisk = (data?.diskMarkers || []).some(m => Date.now() - Number(m.mtimeMs || 0) < waitMs + 2000)
        const recentMem = (data?.markers || []).some(m => Date.now() - Number(m.at || 0) < waitMs + 2000)
        if (data?.ok && (recentDisk || recentMem || data?.markers?.length || data?.diskMarkers?.length)) {
          // Prefer freshly written markers during this spike window
          if (recentDisk || recentMem) {
            markerHit = true
            break
          }
        }
      }
    } catch { /* ignore */ }
    // If sidecar came online after start-mcp.cmd, also count as partial success
    if (!healthBefore.online && healthAfter.online) break
  }

  const broughtOnline = !healthBefore.online && healthAfter.online
  const ok = markerHit || broughtOnline

  return {
    id: 'shell',
    ok,
    verdict: markerHit
      ? 'MARKER_OK'
      : broughtOnline
        ? 'SIDECAR_CAME_ONLINE'
        : 'NO_EFFECT',
    hasApi: true,
    launchedPath,
    markerId,
    markerHit,
    broughtOnline,
    healthBefore: !!healthBefore.online,
    healthAfter: !!healthAfter.online,
    elapsedMs: Date.now() - startedAt,
    note: ok
      ? 'ShellExecute 对本地脚本有效 → Phase 3 可尝试 spawn sidecar（仍建议安装器自启为主）'
      : 'ShellExecute 调用无可见效果（新版 WPS 常见）→ 放弃 WPS 内 spawn 为主路径'
  }
}

/**
 * Spike 3: ribbon / agent survival — record heartbeats; call periodically from agentClient.
 */
export function recordAgentAliveTick(source = 'heartbeat') {
  const now = Date.now()
  let state = { firstAt: now, lastAt: now, ticks: 0, source }
  try {
    const raw = storageGet(STORAGE_ALIVE_KEY)
    if (raw) {
      const prev = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (prev && prev.firstAt) {
        state = {
          firstAt: Number(prev.firstAt) || now,
          lastAt: now,
          ticks: Number(prev.ticks || 0) + 1,
          source
        }
      }
    }
  } catch { /* ignore */ }
  storageSet(STORAGE_ALIVE_KEY, JSON.stringify(state))
  return state
}

export function getAgentAliveProbe() {
  try {
    const raw = storageGet(STORAGE_ALIVE_KEY)
    if (!raw) {
      return {
        id: 'alive',
        ok: false,
        verdict: 'NO_DATA',
        note: '尚无心跳记录；打开 WPS 并保持 sidecar 在线后等待'
      }
    }
    const state = typeof raw === 'string' ? JSON.parse(raw) : raw
    const aliveMs = Math.max(0, Number(state.lastAt) - Number(state.firstAt))
    const sinceLastMs = Math.max(0, Date.now() - Number(state.lastAt))
    const aliveMin = Math.round(aliveMs / 60000)
    const ok30 = aliveMs >= 30 * 60 * 1000
    return {
      id: 'alive',
      ok: ok30,
      verdict: ok30 ? 'SURVIVED_30M' : (aliveMs >= 5 * 60 * 1000 ? 'SURVIVING' : 'EARLY'),
      firstAt: state.firstAt,
      lastAt: state.lastAt,
      ticks: state.ticks,
      aliveMs,
      aliveMinutes: aliveMin,
      sinceLastMs,
      stale: sinceLastMs > 90_000,
      note: ok30
        ? '已存活 ≥30 分钟 → 心跳策略可维持当前'
        : `已连续记录约 ${aliveMin} 分钟；请保持 WPS 空闲观察是否被回收`
    }
  } catch (e) {
    return {
      id: 'alive',
      ok: false,
      verdict: 'ERROR',
      error: e?.message || String(e)
    }
  }
}

export function resetAgentAliveProbe() {
  storageSet(STORAGE_ALIVE_KEY, '')
  return { ok: true }
}

/**
 * Run spike 1+2 immediately; spike 3 returns current survival stats.
 */
export async function runMcpSpikes() {
  const ws = await spikeWebSocket()
  const shell = await spikeShellExecute()
  const alive = getAgentAliveProbe()
  const results = {
    at: Date.now(),
    ws,
    shell,
    alive,
    summary: {
      useLongPoll: !ws.ok,
      allowWpsSpawn: !!shell.ok,
      ribbonSurvival: alive.verdict
    }
  }
  try {
    storageSet(STORAGE_SPIKE_KEY, JSON.stringify(results))
  } catch { /* ignore */ }
  return results
}

export function getLastSpikeResults() {
  try {
    const raw = storageGet(STORAGE_SPIKE_KEY)
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}

export default {
  spikeWebSocket,
  spikeShellExecute,
  recordAgentAliveTick,
  getAgentAliveProbe,
  resetAgentAliveProbe,
  runMcpSpikes,
  getLastSpikeResults
}
