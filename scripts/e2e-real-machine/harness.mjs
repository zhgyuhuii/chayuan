/**
 * 真机 180 场景 E2E harness —— MCP 客户端与场景执行器。
 *
 * 每个场景 = 提示词（经 chat_turn 走生产管线，跑完整 agent 循环）+ 确定性验证（直接 MCP 读工具）。
 * 三个宿主车道（wps/et/wpp）可并行各跑各的场景序列；车道内严格顺序执行。
 * 结果写 artifacts/e2e-180/results-<lane>.jsonl。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const FILES_DIR = path.resolve(HERE, '../../artifacts/e2e-180/files')
export const RESULTS_DIR = path.resolve(HERE, '../../artifacts/e2e-180')

const BASE = process.env.CHAYUAN_MCP_BASE || 'http://127.0.0.1:62588'
// 远程跑批（如 VM）时用 CHAYUAN_MCP_TOKEN 直接传 token；本地默认读 Mac token 文件
const TOKEN = process.env.CHAYUAN_MCP_TOKEN
  ?? fs.readFileSync(path.join(process.env.HOME, '.config/chayuan-wps/mcp/token'), 'utf8')
    .trim().split('\n')[0]

// 模型可由 env 覆盖（真机实证：VM 的 KCEF webview 连不上 api.deepseek.com 而静默
// 零写入，agnes 通道正常；Mac 上两者均可）。JSON：{providerId,modelId,name,apiKey,apiUrl}
export const MODEL = process.env.CHAYUAN_MODEL_JSON
  ? JSON.parse(process.env.CHAYUAN_MODEL_JSON)
  : {
      providerId: 'AGNES',
      modelId: 'agnes-3.0-flash',
      name: 'Agnes 3.0 Flash',
      apiKey: 'sk-DthGTnKAgso5CcxOC8ySfug1xuNrxP0007he9Ut0rqDDFuMh',
      apiUrl: 'https://api.agnes-ai.cn/v1'
    }

export async function rpc(method, params, timeoutMs = 150000) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const req = await fetch(BASE + '/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Chayuan-Token': TOKEN },
      body, signal: ctrl.signal
    })
    const text = await req.text()
    try { return JSON.parse(text) } catch { return { raw: text.slice(0, 300) } }
  } finally { clearTimeout(timer) }
}

export async function tool(name, args, timeoutMs = 90000) {
  try {
    const r = await rpc('tools/call', { name, arguments: args }, timeoutMs)
    if (r.error) return { ok: false, error: `${r.error.code || 'ERR'}: ${r.error.message}` }
    return r.result?.structuredContent ?? r.result?.content ?? r.result ?? { ok: false, error: 'empty' }
  } catch (e) {
    return { ok: false, error: String(e.message || e) }
  }
}

export async function wpsStatus() {
  return tool('wps_status', {}, 20000)
}

/** 等待某宿主 ribbon 基座在线（wpp 需要打开演示稿后才注册） */
export async function waitHost(host, timeoutMs = 120000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const st = await wpsStatus()
    const agents = st?.agent?.agents || []
    if (agents.some(a => a.online && a.addonType === host && String(a.windowId || '').startsWith('ribbon@'))) return true
    await sleep(3000)
  }
  return false
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms))

/** 激活标题含关键字的文档（跨宿主场景写前定位目标文档），失败返回空串 */
export async function activateDoc(query) {
  for (let i = 0; i < 6; i++) {
    await tool('document_activate', { query }, 20000).catch(() => {})
    await sleep(2000)
    const m = await tool('document_meta', {}).catch(() => null)
    const name = String(m?.name || m?.document?.name || m?.title || '')
    if (name.includes(query)) return name
  }
  return ''
}

/**
 * 把目标文档置为活动文档。Mac 模式走 open CLI（document_activate 受 OCC 基线限制）；
 * 远程模式（CHAYUAN_REMOTE=1）走 document_open（无 force，已打开则激活），路径按
 * CHAYUAN_FILES_DIR_LOCAL → CHAYUAN_FILES_DIR_REMOTE 前缀映射。
 */
export async function osOpenDoc(query, fullPath) {
  const { execSync } = await import('node:child_process')
  for (let i = 0; i < 6; i++) {
    if (process.env.CHAYUAN_REMOTE === '1') {
      const localDir = process.env.CHAYUAN_FILES_DIR_LOCAL
      const remoteDir = process.env.CHAYUAN_FILES_DIR_REMOTE
      const vmPath = localDir && remoteDir && fullPath.startsWith(localDir)
        ? remoteDir + fullPath.slice(localDir.length)
        : fullPath
      await tool('document_open', { path: vmPath, viaOs: true, activate: true }, 60000).catch(() => {})
    } else {
      try { execSync(`open -a wpsoffice "${fullPath}"`, { timeout: 15000, stdio: 'ignore' }) } catch { /* ignore */ }
    }
    await sleep(4000)
    const m = await tool('document_meta', {}).catch(() => null)
    const name = String(m?.name || m?.document?.name || m?.title || '')
    if (name.includes(query)) return name
  }
  return ''
}

/** 打开文档（走 OS 打开路径，等同双击），并等宿主在线；WPS 无窗口时用 AppleScript reopen 兜底 */
export async function openDocument(filePath, host, { wait = true } = {}) {
  const r = await tool('document_open', { path: filePath, viaOs: true, force: true, activate: true }, 60000)
  if (wait) {
    let online = await waitHost(host, 60000)
    if (!online) {
      // WPS 进程在但无窗口（真机实证：pkill 后首启不开窗）→ reopen 事件兜底
      try { await import('node:child_process').then(cp => cp.exec('osascript -e \'tell application "wpsoffice" to reopen\'')) } catch { /* ignore */ }
      await sleep(8000)
      online = await waitHost(host, 90000)
    }
    if (!online) return { ok: false, error: `宿主 ${host} 未在线: ${JSON.stringify(r).slice(0, 200)}` }
  }
  await sleep(2000)
  return { ok: true, openResult: r }
}

/** chat_turn 派发（ack 模式）：accepted=false 时重试；宿主瞬态掉线（webview 重载，
 *  真机实证约 1-2 分钟自愈）时等待宿主恢复再重试，避免 24s 重试窗口内全灭 */
async function dispatchTurn(turnId, scopeKey, host, userText, timeoutMs = 60000) {
  for (let i = 0; i < 4; i++) {
    const r = await tool('chat_turn', { turnId, scopeKey, host, userText, model: MODEL }, timeoutMs)
    if (r?.accepted) return { ok: true, r }
    const reason = JSON.stringify(r).slice(0, 220)
    if (/AGENT_OFFLINE/i.test(reason)) {
      console.log(`    ⏳ ${host} 宿主离线，等待自愈（最多 180s）…`)
      const back = await waitHost(host, 180000)
      console.log(`    ${back ? '↩ 宿主恢复，重试' : '⚠ 等待超时，仍重试一次'}`)
    }
    if (i === 3) return { ok: false, error: `chat_turn 未接单: ${reason}` }
    await sleep(6000)
  }
  return { ok: false, error: 'unreachable' }
}

/**
 * LLM 全局串行锁：三车道并行时跨进程互斥，任一时刻只放行一个 LLM 回合。
 * 真机实证：agnes 免费档速率限制下，3 路并发流式请求互踢（"您已达到免费用户的
 * API 速率限制"），表现为回合静默零写入；串行后单发即过。锁文件 300s 无更新视为
 * 死锁残留，自动抢夺。
 */
const LOCK_FILE = path.join(RESULTS_DIR, '.llm.lock')

export async function acquireTurnLock(turnId) {
  const t0 = Date.now()
  while (Date.now() - t0 < 1_800_000) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx')
      fs.writeSync(fd, JSON.stringify({ turnId, at: new Date().toISOString(), pid: process.pid }))
      fs.closeSync(fd)
      return
    } catch (e) {
      if (e.code === 'EEXIST') {
        try {
          const st = fs.statSync(LOCK_FILE)
          if (Date.now() - st.mtimeMs > 300_000) { fs.rmSync(LOCK_FILE, { force: true }); continue }
        } catch { /* 已被别人删除 */ }
        await sleep(3000)
      } else throw e
    }
  }
  throw new Error('获取 LLM 全局锁超时（1800s）')
}

function releaseTurnLock() {
  try { fs.rmSync(LOCK_FILE, { force: true }) } catch { /* ignore */ }
}
export { releaseTurnLock }

/**
 * 跑一个车道：顺序执行 scenarios。
 * 每项：{ id, prompt, verify(ctx), timeout, pre?(ctx), desc }
 * ctx = { tool, host, lane }
 * 每个场景最多尝试 attempts 次（真机实证：三车道并发下偶发回合停摆零写入，
 * 单发重跑即过——默认重试 1 次 recover 瞬时故障）。
 */
export async function runLane(lane, scenarios, { jsonlName = `results-${lane}.jsonl`, verbose = true, attempts = 2, onDone = null } = {}) {
  const jsonlPath = path.join(RESULTS_DIR, jsonlName)
  const log = fs.createWriteStream(jsonlPath, { flags: 'a' })
  const results = []
  console.log(`\n===== 车道 ${lane}：${scenarios.length} 个场景 =====`)
  for (const sc of scenarios) {
    let rec = null
    for (let attempt = 1; attempt <= attempts; attempt++) {
      rec = await runScenario(sc, lane, { attempt, verbose })
      if (rec.pass) break
      if (attempt < attempts) {
        console.log(`    ↻ ${sc.id} 第 ${attempt} 次未过（${rec.evidence.slice(0, 80)}），重试…`)
        await sleep(5000)
      }
    }
    results.push(rec)
    log.write(JSON.stringify(rec) + '\n')
    if (onDone) { try { await onDone(rec, sc) } catch (e) { console.log(`    onDone 异常（忽略）: ${String(e.message || e).slice(0, 100)}`) } }
    await sleep(3000)
  }
  log.end()
  const passed = results.filter(r => r.pass).length
  console.log(`===== 车道 ${lane} 完成：${passed}/${results.length} PASS =====`)
  return results
}

async function runScenario(sc, lane, { attempt = 1, verbose = true } = {}) {
  const rec = { id: sc.id, lane, desc: sc.desc || '', attempt, start: new Date().toISOString() }
  const t0 = Date.now()
  try {
    if (sc.pre) {
      const pre = await sc.pre({ tool, host: lane, lane })
      if (pre && pre.ok === false) throw new Error(`pre 失败: ${JSON.stringify(pre).slice(0, 200)}`)
    }
    const turnId = `e2e-${lane}-${sc.id}${attempt > 1 ? `-r${attempt}` : ''}-${Date.now()}`
    await acquireTurnLock(turnId)
    try {
      const ack = await dispatchTurn(turnId, `e2e-${lane}-${sc.group || 'x'}`, lane, sc.prompt)
      if (!ack.ok) throw new Error(ack.error)
      rec.ack = true
      const timeout = (sc.timeout || 240) * 1000
      const t1 = Date.now()
      let ok = false
      let evidence = ''
      await sleep(8000)
      while (Date.now() - t1 < timeout) {
        try {
          const [o, ev] = await sc.verify({ tool, host: lane, lane })
          ok = !!o
          evidence = String(ev).slice(0, 300)
        } catch (e) {
          evidence = `verify-error: ${String(e.message || e).slice(0, 200)}`
        }
        if (ok) break
        await sleep(4000)
      }
      rec.pass = ok
      rec.evidence = evidence
    } finally {
      releaseTurnLock()
    }
    rec.secs = Math.round((Date.now() - t0) / 1000)
  } catch (e) {
    rec.pass = false
    rec.evidence = String(e.message || e).slice(0, 300)
    rec.secs = Math.round((Date.now() - t0) / 1000)
  }
  if (verbose) console.log(`${rec.pass ? 'PASS' : 'FAIL'}  ${sc.id}${attempt > 1 ? `(r${attempt})` : ''}  ${rec.secs}s  ${rec.evidence.slice(0, 120)}`)
  return rec
}
