import { PROTOCOL_VERSION } from './config.mjs'

/**
 * 宿主类型归一：wps=文字 / et=表格 / wpp=演示。未知值一律回落 wps
 * （与 publish.xml 主宿主一致，旧版 webview 不带 addonType 也按 wps 处理）。
 */
function normalizeHostType(raw) {
  const s = String(raw || '').toLowerCase().trim()
  return s === 'et' || s === 'wpp' ? s : 'wps'
}

/** job 目标解析：'any' 匹配任意宿主执行者 */
function normalizeTarget(raw) {
  const s = String(raw || '').toLowerCase().trim()
  return s === 'et' || s === 'wpp' ? s : s === 'any' ? 'any' : 'wps'
}

/**
 * 按 method 前缀推断目标宿主——三宿主共用一个 sidecar 时唯一的路由真源：
 * spreadsheet.* 只能在表格宿主执行、presentation.* 只能在演示宿主执行；
 * 宿主无关工具（状态/助手配方/知识库）投给任意在线执行者；其余（document.*、
 * format.*、table.* 等全部 Writer 工具）只能回文字宿主。
 */
function targetForMethod(method) {
  const m = String(method || '')
  if (m.startsWith('spreadsheet.')) return 'et'
  if (m.startsWith('presentation.')) return 'wpp'
  if (m === 'wps.status' || m.startsWith('assistants.') || m.startsWith('kb.')) return 'any'
  return 'wps'
}

function matchesTarget(agent, target) {
  if (!target || target === 'any') return true
  return normalizeHostType(agent.addonType) === target
}

/**
 * Agent long-poll hub: register / poll / result + MCP job bridging.
 */
export function createAgentHub({ logger } = {}) {
  /** @type {Map<string, { agentId: string, protocolVersion: number, addonVersion: string, addonType: string, windowId: string, lastSeen: number, waiters: Array<{ resolve: Function, timer: any }> }>} */
  const agents = new Map()
  /** @type {Array<{ jobId: string, method: string, params: any, createdAt: number, resolve: Function, reject: Function, timer: any, assignedAgentId?: string }>} */
  const pendingJobs = []
  /** @type {Map<string, { jobId: string, method: string, params: any, createdAt: number, resolve: Function, reject: Function, timer: any, assignedAgentId?: string }>} */
  const inflight = new Map()

  function now() {
    return Date.now()
  }

  function pruneStale(maxAgeMs = 90_000) {
    const t = now()
    for (const [id, a] of agents) {
      if (t - a.lastSeen > maxAgeMs) {
        for (const w of a.waiters) {
          clearTimeout(w.timer)
          w.resolve(null)
        }
        agents.delete(id)
      }
    }
  }

  function listAgents() {
    pruneStale()
    return [...agents.values()].map(a => ({
      agentId: a.agentId,
      protocolVersion: a.protocolVersion,
      addonVersion: a.addonVersion,
      addonType: normalizeHostType(a.addonType),
      windowId: a.windowId,
      lastSeen: a.lastSeen,
      online: now() - a.lastSeen < 60_000
    }))
  }

  function pickAgent(target) {
    pruneStale()
    const online = [...agents.values()].filter(
      a => now() - a.lastSeen < 60_000 && matchesTarget(a, target)
    )
    if (!online.length) return null
    online.sort((a, b) => b.lastSeen - a.lastSeen)
    return online[0]
  }

  const droppedAt = new Map() // agentId → 被踢时间：惩罚期内拒绝重注册（防坏 webview 立即回锅洗白 strike）
  const REREGISTER_BAN_MS = 60_000

  function register(body = {}) {
    const agentId = String(body.agentId || '').trim() || `agent-${cryptoRandom()}`
    const bannedAt = droppedAt.get(agentId)
    if (bannedAt && now() - bannedAt < REREGISTER_BAN_MS) {
      return {
        ok: false,
        code: 'AGENT_BANNED',
        retryAfterMs: REREGISTER_BAN_MS - (now() - bannedAt)
      }
    }
    droppedAt.delete(agentId)
    const protocolVersion = Number(body.protocolVersion || PROTOCOL_VERSION)
    const addonVersion = String(body.addonVersion || '')
    const addonType = normalizeHostType(body.addonType)
    const windowId = String(body.windowId || '')
    let agent = agents.get(agentId)
    if (!agent) {
      agent = { agentId, protocolVersion, addonVersion, addonType, windowId, lastSeen: now(), waiters: [], timeoutStrikes: 0 }
      agents.set(agentId, agent)
    } else {
      agent.protocolVersion = protocolVersion
      agent.addonVersion = addonVersion
      agent.addonType = addonType
      agent.windowId = windowId || agent.windowId
      agent.lastSeen = now()
      // 保留 timeoutStrikes：重注册不再洗白前科——双 webview 曾共用 agentId 轮流
      // re-register 把 strike 清零，坏执行者永远踢不掉（2026-09-17 实证 agent_dropped
      // 一次未触发）。webview 刷新自愈后首个成功结果（submitResult）自然清零。
    }
    return {
      ok: true,
      agentId,
      protocolVersion: PROTOCOL_VERSION,
      serverProtocolVersion: PROTOCOL_VERSION,
      compatible: protocolVersion === PROTOCOL_VERSION
    }
  }

  function heartbeat(agentId) {
    const a = agents.get(String(agentId || ''))
    if (!a) return { ok: false, code: 'AGENT_NOT_REGISTERED' }
    a.lastSeen = now()
    a.timeoutStrikes = 0
    return { ok: true }
  }

  function wakeWaiter(agent, job) {
    const w = agent.waiters.shift()
    if (!w) return false
    clearTimeout(w.timer)
    job.assignedAgentId = agent.agentId
    inflight.set(job.jobId, job)
    agent.lastSeen = now()
    // 派发归属留痕：排查「哪个 webview 接的 job / 坏 agent 抢任务」的关键字段
    try {
      logger?.({ ev: 'job_assign', jobId: job.jobId, method: job.method, agentId: agent.agentId, windowId: agent.windowId })
    } catch { /* ignore */ }
    w.resolve(job)
    return true
  }

  function tryDispatch() {
    // 按宿主目标匹配：job 找自己宿主的执行者，互不抢占。某宿主离线时它的 job
    // 留在队列（不阻塞其它宿主的 job 被派发）。
    for (let i = 0; i < pendingJobs.length;) {
      const job = pendingJobs[i]
      const fresh = [...agents.values()].filter(
        a => matchesTarget(a, job.target) && a.waiters.length && now() - a.lastSeen < 60_000
      )
      if (!fresh.length) { i++; continue }
      // Prefer agent with idle waiter；有超时前科的（strike>0，疑似半死 webview）排最后
      const withWaiter = fresh.find(a => !a.timeoutStrikes) || fresh[0]
      const assigned = pendingJobs.splice(i, 1)[0]
      if (!wakeWaiter(withWaiter, assigned)) {
        pendingJobs.splice(i, 0, assigned)
        i++
      }
    }
  }

  /**
   * Long-poll: resolve with job or null on timeout.
   */
  function poll(agentId, timeoutMs = 25_000) {
    const a = agents.get(String(agentId || ''))
    if (!a) return Promise.resolve({ error: { code: 'AGENT_NOT_REGISTERED' } })
    a.lastSeen = now()
    // 注意：poll 不清 timeoutStrikes——半死 webview（长轮询活着但执行 WPS 调用
    // 永久挂起）会持续吃超时又持续 poll，若 poll 清零则永远凑不齐 3 连击踢不出；
    // strike 只能由成功结果（submitResult）洗清。2026-09-17 实证：坏 agent 吃了
    // 6 次超时未被踢，最后在坏桥上执行 document.new → Documents.Add → WPS 崩溃。

    // Immediate job?（只领目标宿主匹配自己的 job）
    if (pendingJobs.length) {
      const idx = pendingJobs.findIndex(j => matchesTarget(a, j.target))
      if (idx >= 0) {
        const job = pendingJobs.splice(idx, 1)[0]
        job.assignedAgentId = a.agentId
        inflight.set(job.jobId, job)
        return Promise.resolve({
          job: { jobId: job.jobId, method: job.method, params: job.params }
        })
      }
    }

    const waitMs = Math.min(Math.max(Number(timeoutMs) || 25_000, 1000), 55_000)
    return new Promise(resolve => {
      const entry = {
        resolve: (job) => {
          if (!job) {
            resolve({ job: null })
            return
          }
          resolve({ job: { jobId: job.jobId, method: job.method, params: job.params } })
        },
        timer: null
      }
      entry.timer = setTimeout(() => {
        const idx = a.waiters.indexOf(entry)
        if (idx >= 0) a.waiters.splice(idx, 1)
        resolve({ job: null })
      }, waitMs)
      a.waiters.push(entry)
      tryDispatch()
    })
  }

  function submitResult(body = {}) {
    const jobId = String(body.jobId || '')
    const agentId = String(body.agentId || '')
    const job = inflight.get(jobId)
    if (!job) return { ok: false, code: 'JOB_NOT_FOUND' }
    if (job.assignedAgentId && agentId && job.assignedAgentId !== agentId) {
      return { ok: false, code: 'AGENT_MISMATCH' }
    }
    clearTimeout(job.timer)
    inflight.delete(jobId)
    const a = agents.get(agentId)
    if (a) {
      a.lastSeen = now()
      a.timeoutStrikes = 0
    }
    try {
      logger?.({
        ev: 'job_result',
        jobId,
        method: job.method,
        ok: body.ok !== false,
        ms: Date.now() - Number(job.createdAt || 0),
        ...(body.ok === false ? { errorCode: body.error?.code || '', message: String(body.error?.message || '').slice(0, 200) } : {})
      })
    } catch { /* ignore */ }
    if (body.ok === false) {
      job.reject(Object.assign(new Error(body.error?.message || 'AGENT_JOB_FAILED'), {
        code: body.error?.code || 'AGENT_JOB_FAILED',
        details: body.error
      }))
    } else {
      job.resolve(body.result)
    }
    return { ok: true }
  }

  /**
   * Enqueue job for agent; returns Promise of result.
   */
  function dropAgent(agentId, reason = 'stale') {
    const id = String(agentId || '')
    const a = agents.get(id)
    if (!a) return
    for (const w of a.waiters) {
      clearTimeout(w.timer)
      try { w.resolve(null) } catch { /* ignore */ }
    }
    a.waiters = []
    agents.delete(id)
    droppedAt.set(id, now())
    try { logger?.({ ev: 'agent_dropped', agentId: id, reason, windowId: a.windowId }) } catch { /* ignore */ }
    console.warn(`[agentHub] dropped agent ${id} (${reason})`)
  }

  /**
   * Enqueue job for agent; returns Promise of result.
   * 目标宿主按 method 前缀推断（targetForMethod），可用 options.target 显式覆盖。
   */
  function callAgent(method, params = {}, { timeoutMs = 120_000, target } = {}) {
    pruneStale()
    const resolvedTarget = target !== undefined ? normalizeTarget(target) : targetForMethod(method)
    if (![...agents.values()].some(a => now() - a.lastSeen < 60_000 && matchesTarget(a, resolvedTarget))) {
      try { logger?.({ ev: 'job_reject_offline', method, target: resolvedTarget }) } catch { /* ignore */ }
      const hostLabel = { wps: 'WPS 文字', et: 'WPS 表格', wpp: 'WPS 演示', any: 'WPS' }[resolvedTarget] || 'WPS'
      return Promise.reject(Object.assign(new Error(`${hostLabel} Agent offline`), { code: 'WPS_AGENT_OFFLINE' }))
    }
    const jobId = `job-${Date.now().toString(36)}-${cryptoRandom()}`
    const dispatchedAt = Date.now()
    try { logger?.({ ev: 'job_dispatch', jobId, method, target: resolvedTarget }) } catch { /* ignore */ }
    return new Promise((resolve, reject) => {
      const job = {
        jobId,
        method,
        params,
        target: resolvedTarget,
        createdAt: now(),
        resolve,
        reject,
        timer: setTimeout(() => {
          const assigned = job.assignedAgentId || inflight.get(jobId)?.assignedAgentId
          inflight.delete(jobId)
          const idx = pendingJobs.indexOf(job)
          if (idx >= 0) pendingJobs.splice(idx, 1)
          // PR8：单个任务硬超时（如大文档校对 >120s）不再立即注销 agent——那会让
          // 加载项进入「假离线」窗口（底层 webview 其实还活着，长轮询会立刻回来）。
          // 连续 3 次超时且期间无任何活跃信号（心跳/轮询/结果都会清零 strike）才判死。
          if (assigned) {
            const a = agents.get(assigned)
            if (a) {
              a.timeoutStrikes = (a.timeoutStrikes || 0) + 1
              if (a.timeoutStrikes >= 3) dropAgent(assigned, 'job-timeout x3')
              else console.warn(`[agentHub] job timeout (strike ${a.timeoutStrikes}/3) agent=${assigned}`)
            }
          }
          try { logger?.({ ev: 'job_timeout', jobId, method, timeoutMs, agentId: assigned || '' }) } catch { /* ignore */ }
          reject(Object.assign(new Error(`Agent job timeout ${timeoutMs}ms`), { code: 'AGENT_JOB_TIMEOUT' }))
        }, timeoutMs)
      }
      pendingJobs.push(job)
      tryDispatch()
    })
  }

  function status() {
    const list = listAgents()
    const onlineAgents = list.filter(a => a.online)
    return {
      agentOnline: onlineAgents.length > 0,
      agentCount: onlineAgents.length,
      agents: list,
      hosts: {
        wps: onlineAgents.some(a => a.addonType === 'wps'),
        et: onlineAgents.some(a => a.addonType === 'et'),
        wpp: onlineAgents.some(a => a.addonType === 'wpp')
      },
      pendingJobs: pendingJobs.length,
      inflightJobs: inflight.size,
      protocolVersion: PROTOCOL_VERSION
    }
  }

  return { register, heartbeat, poll, submitResult, callAgent, status, listAgents }
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 10)
}
