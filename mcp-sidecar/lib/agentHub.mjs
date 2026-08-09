import { PROTOCOL_VERSION } from './config.mjs'

/**
 * Agent long-poll hub: register / poll / result + MCP job bridging.
 */
export function createAgentHub() {
  /** @type {Map<string, { agentId: string, protocolVersion: number, addonVersion: string, windowId: string, lastSeen: number, waiters: Array<{ resolve: Function, timer: any }> }>} */
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
      windowId: a.windowId,
      lastSeen: a.lastSeen,
      online: now() - a.lastSeen < 60_000
    }))
  }

  function pickAgent() {
    pruneStale()
    const online = [...agents.values()].filter(a => now() - a.lastSeen < 60_000)
    if (!online.length) return null
    online.sort((a, b) => b.lastSeen - a.lastSeen)
    return online[0]
  }

  function register(body = {}) {
    const agentId = String(body.agentId || '').trim() || `agent-${cryptoRandom()}`
    const protocolVersion = Number(body.protocolVersion || PROTOCOL_VERSION)
    const addonVersion = String(body.addonVersion || '')
    const windowId = String(body.windowId || '')
    let agent = agents.get(agentId)
    if (!agent) {
      agent = { agentId, protocolVersion, addonVersion, windowId, lastSeen: now(), waiters: [] }
      agents.set(agentId, agent)
    } else {
      agent.protocolVersion = protocolVersion
      agent.addonVersion = addonVersion
      agent.windowId = windowId || agent.windowId
      agent.lastSeen = now()
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
    return { ok: true }
  }

  function wakeWaiter(agent, job) {
    const w = agent.waiters.shift()
    if (!w) return false
    clearTimeout(w.timer)
    job.assignedAgentId = agent.agentId
    inflight.set(job.jobId, job)
    agent.lastSeen = now()
    w.resolve(job)
    return true
  }

  function tryDispatch() {
    while (pendingJobs.length) {
      const agent = pickAgent()
      if (!agent) break
      // Prefer agent with idle waiter
      const withWaiter = [...agents.values()].find(a => a.waiters.length && now() - a.lastSeen < 60_000)
      const target = withWaiter || agent
      if (!target.waiters.length) break
      const job = pendingJobs.shift()
      if (!wakeWaiter(target, job)) {
        pendingJobs.unshift(job)
        break
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

    // Immediate job?
    if (pendingJobs.length) {
      const job = pendingJobs.shift()
      job.assignedAgentId = a.agentId
      inflight.set(job.jobId, job)
      return Promise.resolve({
        job: { jobId: job.jobId, method: job.method, params: job.params }
      })
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
    if (a) a.lastSeen = now()
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
    console.warn(`[agentHub] dropped agent ${id} (${reason})`)
  }

  function callAgent(method, params = {}, { timeoutMs = 120_000 } = {}) {
    pruneStale()
    if (![...agents.values()].some(a => now() - a.lastSeen < 60_000)) {
      return Promise.reject(Object.assign(new Error('WPS Agent offline'), { code: 'WPS_AGENT_OFFLINE' }))
    }
    const jobId = `job-${Date.now().toString(36)}-${cryptoRandom()}`
    return new Promise((resolve, reject) => {
      const job = {
        jobId,
        method,
        params,
        createdAt: now(),
        resolve,
        reject,
        timer: setTimeout(() => {
          const assigned = job.assignedAgentId || inflight.get(jobId)?.assignedAgentId
          inflight.delete(jobId)
          const idx = pendingJobs.indexOf(job)
          if (idx >= 0) pendingJobs.splice(idx, 1)
          // Timed-out inflight jobs usually mean the WebView died mid-handler.
          if (assigned) dropAgent(assigned, 'job-timeout')
          reject(Object.assign(new Error(`Agent job timeout ${timeoutMs}ms`), { code: 'AGENT_JOB_TIMEOUT' }))
        }, timeoutMs)
      }
      pendingJobs.push(job)
      tryDispatch()
    })
  }

  function status() {
    const list = listAgents()
    return {
      agentOnline: list.some(a => a.online),
      agentCount: list.filter(a => a.online).length,
      agents: list,
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
