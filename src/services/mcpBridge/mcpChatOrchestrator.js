/**
 * In-page MCP chat orchestrator: merge multi-server tools, run tool loop.
 *
 * 2026-09-08 起内核切换为 chayuan-office 的 agent-core AgentLoop（vendor 于
 * src/agent-core/）：自研循环的退避重试、退化熔断（同回合重复/全错误/坏入参）、
 * no-FC 模型 JSON 协议等稳定性工事全部继承；本文件保留原有对外契约
 * （入参/结果对象/steps 进度流/AbortError 取消语义），UI 无感。
 * 领域语义（写确认闸门、proofread 进度与卡片）在 agentCoreSkill.js。
 */
import { AgentLoop } from '../../agent-core/index'
import {
  CHAYUAN_SERVER_ID,
  getEnabledMcpServers,
  isChayuanToolAllowed,
  namespaceToolName
} from './mcpServerRegistry.js'
import {
  callLocalTool,
  healthz,
  initializeLocal,
  listLocalTools,
  listUpstreamTools,
  syncUpstreamAllowlist
} from './mcpHttpClient.js'
import { createAgentCoreTransport } from './agentCoreTransport.js'
import { createMcpDocumentSkill, normalizeTodoList } from './agentCoreSkill.js'

// 大文档（数千字 / 百行表格）一轮「校对 + 改写」常需多次工具调用；旧值 8 会让模型
// 撞上轮次上限而中断（见「已达到工具调用轮次上限」）。提到 16 留出余量，正常流程
// 走 proofread_run 单次调用，根本用不到这么多轮。
const MAX_ROUNDS = 16

// 模型对 tools 参数报错的特征（与旧编排器同一正则；命中后整轮重跑 JSON 兼容协议）
const TOOLS_UNSUPPORTED_RE = /tool|tools|function call|不支持/i

function buildSystemPrompt({ selectionCtx, kbBound, proofreadIntent }) {
  const sel = selectionCtx || {}
  const hasSel = !!sel.hasSelection
  const lines = [
    '你是察元助手页内的文档智能体。通过 MCP 工具操作当前 WPS 文档与其它已配置的 HTTP MCP 服务。',
    '工具名带服务器前缀，格式 serverId__toolName（例如 chayuan__proofread_run）。调用时必须使用完整前缀名。',
    '优先使用 chayuan__ 文档/校对工具完成文档任务；可用 assistants_search / assistants_get 获取助手配方后再用 document_* 落文档。',
    '禁止调用 declassify_*。写文档前先 dryRun/预览；需要 confirmed=true 的写回交给用户确认，不要自行编造 confirmed=true。',
    '【错别字 / 校对 / 语法检查】必须一次调用 chayuan__proofread_run(dryRun:true, scope=document 或 selection) 完成：它内部已自动分块、逐段调校对模型并返回 issues。严禁改用 document_chunks 自己逐段读再找错字——那样既慢，又会把整轮对话的轮次耗光、撞上轮次上限。',
    '【改正错别字·多处】一次改多处必须用 document_apply_ops(action:"replace", operations:[{originalText,outputText},…]) 单次批量替换——每条 originalText 自动定位、最多 200 条；同一处的正文/拼音等都作为不同 operation 一起提交。严禁「逐条 document_locate 再 document_replace」：N 处错字 = N×2 次调用，必然撞上轮次上限。仅改单处且原文已知时才用 document_replace。',
    '【改样子≠改字】加粗/变色/字号/字体/删除线/拼音 → format_run 或 format_apply_ops；对齐/行距 → format_para；标题样式 → style(action=apply)。严禁用 document_replace 做加粗变色。',
    '【批注/修订】comment(action=list|add|delete) / revision(action=mode|list|apply)；写操作 confirmed:true。',
    '【任务清单】请求包含 ≥2 个可独立交付的子任务或明确多步流程时，先调用 todo_write 写入完整清单（每项一个动词开头的短句）；开始某项前先把它置 in_progress，完成后立即置 completed；同一时刻至多一项 in_progress；过程中发现新任务就整表重写追加。单一简单请求（一问一答、单次工具能完成的）不要用 todo_write。',
    '【版式对象】layout / nav / toc / bookmark / table / image / hyperlink / headerfooter / watermark / export — 一律带 action。',
    '【改正正文·流程】proofread_run 返回后汇总问题；按用户选择走「写成批注」(proofread_apply_comments) 或「改正正文」出口，不要只用批注交差。',
    '【需要通读全文（翻译 / 改写 / 摘要）才用 document_chunks】每次 limit:8 尽量多读，cursor 只前进、不回退、不重读已读段落；读够立即停，把轮次留给写作工具，而不是反复分页。',
    hasSel
      ? `当前有选区（约 ${sel.charCount || '?'} 字）。用户提到「这段/选中」时，scope 用 selection。选区摘要：${String(sel.preview || '').slice(0, 240)}`
      : '当前无选区，默认 scope=document。',
    sel.fileName ? `当前文档：${sel.fileName}` : '',
    kbBound ? '用户已绑定知识库：需要事实依据时先 chayuan__kb_retrieve。' : '',
    proofreadIntent === 'fix' ? '本轮用户意图偏「改正正文」。' : '',
    proofreadIntent === 'check' ? '本轮用户意图偏「检查/批注」。' : ''
  ]
  return lines.filter(Boolean).join('\n')
}

function inferProofreadIntent(userText) {
  const t = String(userText || '')
  if (/(修改|改正|改掉|纠正|修正).{0,8}(错别字|别字|错字|拼写)|把.{0,6}(错别字|别字).{0,6}(改|修)/.test(t)) {
    return 'fix'
  }
  if (/(检查|核对|查找|找出|看看|标出|批注).{0,8}(错别字|别字|错字|拼写|语法)/.test(t) || /错别字|校对/.test(t)) {
    return 'check'
  }
  return 'unknown'
}

/** agent-core 退避守卫的英文终态信息 → 中文（前缀匹配，未命中原样透出） */
function localizeLoopError(message) {
  const s = String(message || '')
  if (s.startsWith('Tool input was unusable')) {
    return '连续多次工具入参无法解析（截断或非法 JSON），已中止本次执行；请重试或把操作拆小。'
  }
  if (s.startsWith('Every tool call failed')) {
    return '连续多轮工具调用全部失败，已停止；请检查文档状态后重试。'
  }
  if (s.startsWith('The model kept repeating')) {
    return '模型连续重复相同操作且无进展，已停止；请换个说法或更换模型重试。'
  }
  return s
}

function abortError() {
  const err = new Error('已停止')
  err.name = 'AbortError'
  err.code = 'ABORTED'
  return err
}

/** 失败工具结果的 output 是 JSON 信封，进度步骤里只展示 message 字段 */
function toolErrorDetail(output) {
  try {
    const parsed = JSON.parse(output)
    return String(parsed?.message || output)
  } catch {
    return String(output || '')
  }
}

function seedHistoryFrom(historyMessages) {
  return (historyMessages || [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-8)
    .map(m => (m.role === 'user'
      ? { role: 'user', text: String(m.content) }
      : { role: 'assistant', text: String(m.content) }))
}

/**
 * @returns {Promise<{
 *   ok: boolean,
 *   fallback?: boolean,
 *   reason?: string,
 *   content?: string,
 *   steps?: Array,
 *   proofreadCard?: object|null,
 *   pendingConfirms?: Array,
 *   usedServers?: string[],
 *   todos?: Array
 * }>}
 */
export async function runMcpChatOrchestrator({
  userText,
  model,
  selectionCtx = null,
  kbBound = false,
  historyMessages = [],
  signal,
  onProgress,
  onTodos,
  confirmHandler
} = {}) {
  const steps = []
  let todos = []
  const pushStep = (label, detail = '') => {
    const step = { at: Date.now(), label, detail }
    steps.push(step)
    onProgress?.(step, steps.slice())
  }
  // 长任务（proofread）实时进度：原地更新同一条进度步骤，避免在步骤列表里堆积重复行。
  const pushProgress = (info) => {
    const last = steps[steps.length - 1]
    if (last && last.__progress) {
      last.label = info.label
      last.detail = info.detail
      last.progress = info.progress
      last.at = Date.now()
      onProgress?.(last, steps.slice())
    } else {
      const step = { at: Date.now(), label: info.label, detail: info.detail, progress: info.progress, __progress: true }
      steps.push(step)
      onProgress?.(step, steps.slice())
    }
  }

  const hz = await healthz({ signal })
  if (!hz.online) {
    return { ok: false, fallback: true, reason: 'sidecar_offline', steps }
  }
  // sidecar 在线但 WPS 加载项未注册（长轮询断开）：所有文档工具都会返回
  // WPS_AGENT_OFFLINE。提前失败，避免模型连续多轮撞同一错误、烧完轮次上限
  // 才放弃（实测 DeepSeek 会反复重试 wps_launch/proofread_run 6 轮）。
  if (hz.ok && hz.agentOnline === false) {
    pushStep('WPS Agent 未连接', 'sidecar 在线，但 WPS 加载项未注册，文档工具不可用')
    return {
      ok: false,
      fallback: true,
      reason: 'agent_offline',
      content: '察元与 WPS 的桥接未连接（Agent 离线）：sidecar 正常，但 WPS 里的察元加载项没有注册。请重启 WPS（或重开文档窗口）让加载项重新连接后重试。',
      steps,
      usedServers: []
    }
  }

  const enabled = getEnabledMcpServers()
  if (!enabled.length) {
    return { ok: false, fallback: true, reason: 'no_servers', steps }
  }

  const mergedTools = []
  const usedServers = []

  for (const server of enabled) {
    try {
      if (server.id === CHAYUAN_SERVER_ID) {
        await initializeLocal({ signal })
        const tools = await listLocalTools({ signal })
        for (const t of tools) {
          if (!isChayuanToolAllowed(t.name)) continue
          mergedTools.push({
            name: namespaceToolName(CHAYUAN_SERVER_ID, t.name),
            description: `[${server.name}] ${t.description || t.name}`,
            inputSchema: t.inputSchema || { type: 'object', properties: {} }
          })
        }
        usedServers.push(CHAYUAN_SERVER_ID)
        pushStep('已连接察元 MCP', `${tools.length} 个工具（白名单后 ${mergedTools.filter(x => x.name.startsWith(`${CHAYUAN_SERVER_ID}__`)).length}）`)
      } else {
        await syncUpstreamAllowlist({ signal })
        const tools = await listUpstreamTools(server.id, { signal })
        for (const t of tools) {
          mergedTools.push({
            name: namespaceToolName(server.id, t.name),
            description: `[${server.name}] ${t.description || t.name}`,
            inputSchema: t.inputSchema || { type: 'object', properties: {} }
          })
        }
        usedServers.push(server.id)
        pushStep(`已连接 ${server.name}`, `${tools.length} 个工具`)
      }
    } catch (e) {
      pushStep(`跳过 ${server.name || server.id}`, e.message || String(e))
    }
  }

  if (!mergedTools.length) {
    return { ok: false, fallback: true, reason: 'no_tools', steps }
  }

  // 空/已取消请求直接按旧契约短路（loop.run 对空指令是 no-op，会悬挂）
  if (!String(userText || '').trim()) {
    return { ok: false, fallback: true, reason: 'model_error', content: '空请求', steps, usedServers }
  }
  if (signal?.aborted) throw abortError()

  const proofreadIntent = inferProofreadIntent(userText)
  const system = buildSystemPrompt({ selectionCtx, kbBound, proofreadIntent })
  const seed = seedHistoryFrom(historyMessages)
  const pendingConfirms = []
  let proofreadCard = null

  // 跑一轮完整的 agent 循环。settle 为 { result }（onDone）或 { error: string }（onError）。
  const runLoop = (forceDegraded) => new Promise((resolve) => {
    let onAbort = null
    const settle = (value) => {
      if (onAbort) signal?.removeEventListener?.('abort', onAbort)
      resolve(value)
    }
    const skill = createMcpDocumentSkill({
      systemPrompt: system,
      mergedTools,
      pushProgress,
      confirmHandler,
      pendingConfirms,
      onTodoWrite: (list) => {
        todos = normalizeTodoList(list)
        onTodos?.(todos)
      },
      onProofreadCard: (card) => {
        proofreadCard = {
          ...card,
          intent: proofreadIntent === 'unknown' ? 'check' : proofreadIntent
        }
      }
    })
    const loop = new AgentLoop({
      transport: createAgentCoreTransport({
        model,
        signal,
        onTurnStart: (turnNo) => pushStep(`模型思考（第 ${turnNo} 轮）`, model?.name || model?.modelId || '')
      }),
      skill,
      events: {
        onToolStart: (call) => pushStep(`调用 ${call.name}`, JSON.stringify(call.input ?? {}).slice(0, 200)),
        onToolExecuted: ({ call, execution }) => {
          const detail = execution.isError ? toolErrorDetail(execution.output) : String(execution.output || '')
          pushStep(`${execution.isError ? '失败' : '完成'} ${call.name}`, detail.slice(0, 160))
        },
        onDone: (result) => settle({ result }),
        onError: (error) => settle({ error })
      },
      maxTurns: MAX_ROUNDS,
      maxHistory: Infinity, // 单轮编排内不裁历史（与旧编排器一致；跨轮由调用方的 8 条滚动窗口控制）
      compaction: false
    })
    if (forceDegraded) loop.degrade()
    if (seed.length) loop.restore(seed)
    onAbort = () => loop.cancel()
    if (signal && !signal.aborted) signal.addEventListener('abort', onAbort, { once: true })
    loop.run(String(userText))
  })

  let out = await runLoop(false)
  // 模型不支持 tools 协议：与旧编排器一样，识别报错特征后立即切 JSON 兼容层整轮重跑
  if (out.error && !signal?.aborted && TOOLS_UNSUPPORTED_RE.test(String(out.error))) {
    pushStep('模型可能不支持 tools，改用 JSON 兼容层')
    out = await runLoop(true)
  }

  if (typeof out.error === 'string' && out.error) {
    if (signal?.aborted) throw abortError()
    return { ok: false, fallback: true, reason: 'model_error', content: localizeLoopError(out.error), steps, usedServers, todos }
  }
  const r = out.result || {}
  if (r.cancelled || signal?.aborted) throw abortError()
  const fallbackText = r.turnLimit
    ? '已达到工具调用轮次上限，请根据上方步骤继续或重试。'
    : '已完成。'
  return {
    ok: true,
    content: String(r.text || '').trim() || fallbackText,
    steps,
    proofreadCard,
    pendingConfirms,
    usedServers,
    proofreadIntent,
    todos
  }
}

export async function applyProofreadComments(taskId, { maxComments = 30, signal } = {}) {
  return callLocalTool('proofread_apply_comments', {
    taskId,
    confirmed: true,
    maxComments
  }, { signal })
}

function collectReplacementsFromProofreadRaw(raw, scope = 'document') {
  const issues = []
  if (Array.isArray(raw?.issues)) {
    for (const item of raw.issues) {
      if (Array.isArray(item?.issues)) {
        for (const issue of item.issues) issues.push(issue)
      } else if (item && (item.text || item.original || item.suggestion)) {
        issues.push(item)
      }
    }
  }
  const replacements = []
  for (const issue of issues) {
    const find = String(issue?.text || issue?.original || '').trim()
    const replace = String(issue?.suggestion || '').trim()
    if (!find || !replace || find === replace) continue
    replacements.push({ find, replace, scope })
  }
  return replacements
}

export async function applyProofreadTextFixes(issuesPayload, { signal } = {}) {
  const ops = Array.isArray(issuesPayload?.ops) ? issuesPayload.ops : null
  if (ops?.length) {
    return callLocalTool('document_apply_ops', {
      ops,
      confirmed: true
    }, { signal })
  }
  let replacements = Array.isArray(issuesPayload?.replacements) ? issuesPayload.replacements : []
  if (!replacements.length && issuesPayload?.raw) {
    replacements = collectReplacementsFromProofreadRaw(issuesPayload.raw, issuesPayload.scope || 'document')
  }
  const results = []
  for (const r of replacements.slice(0, 40)) {
    const originalText = String(r.find || r.originalText || '').trim()
    const newText = String(r.replace ?? r.newText ?? '')
    if (!originalText || newText === originalText) continue
    // eslint-disable-next-line no-await-in-loop
    const out = await callLocalTool('document_replace', {
      originalText,
      newText,
      confirmed: true
    }, { signal })
    results.push(out)
  }
  return { ok: true, count: results.length, results }
}

export { inferProofreadIntent }
