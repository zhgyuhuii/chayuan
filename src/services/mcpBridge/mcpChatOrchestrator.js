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

// 回合启动提速：工具清单短 TTL 缓存。此前每回合都要 initialize + tools/list（本机
// 两个串行 HTTP 往返，上游 MCP 每个还要白名单同步 + 拉取，动辄数百 ms 起）——连续
// 对话时这些延迟全部叠加在首字之前。缓存 60s 内直接复用；白名单/启用状态变化最迟
// 60s 后生效，对工具目录这种准静态数据是可接受的窗口。
const TOOLS_CACHE_TTL_MS = 60_000
let localToolsCache = { at: 0, tools: null }
const upstreamToolsCache = new Map() // serverId → { at, tools }

async function listLocalToolsCached({ signal } = {}) {
  if (!localToolsCache.tools || Date.now() - localToolsCache.at > TOOLS_CACHE_TTL_MS) {
    const tools = await listLocalTools({ signal })
    localToolsCache = { at: Date.now(), tools }
  }
  return localToolsCache.tools
}

function listUpstreamToolsCached(serverId, { signal } = {}) {
  const hit = upstreamToolsCache.get(serverId)
  if (hit?.tools && Date.now() - hit.at <= TOOLS_CACHE_TTL_MS) return Promise.resolve(hit.tools)
  return listUpstreamTools(serverId, { signal }).then((tools) => {
    upstreamToolsCache.set(serverId, { at: Date.now(), tools })
    return tools
  })
}

// 模型对 tools 参数报错的特征（与旧编排器同一正则；命中后整轮重跑 JSON 兼容协议）
const TOOLS_UNSUPPORTED_RE = /tool|tools|function call|不支持/i

// agent-core 循环守卫的终态错误前缀（localizeLoopError 同一清单）。这些错误文本
// 恰好都含 "tool"，若按正则判定会误认为「模型不支持 tools」而整轮降级重跑——
// 一次 Agent 离线故障会烧掉 2×16 轮模型调用（PR6/H4）。
const LOOP_GUARD_ERROR_PREFIXES = [
  'Tool input was unusable',
  'Every tool call failed',
  'The model kept repeating'
]

/** 是否为「模型不支持 tools 协议」错误：守卫熔断类终态错误不算 */
function isToolsUnsupportedError(message) {
  const s = String(message || '')
  if (LOOP_GUARD_ERROR_PREFIXES.some(p => s.startsWith(p))) return false
  return TOOLS_UNSUPPORTED_RE.test(s)
}

function buildSystemPrompt({ selectionCtx, kbBound, proofreadIntent, previousTodos }) {
  const sel = selectionCtx || {}
  const hasSel = !!sel.hasSelection
  const pendingPrev = (Array.isArray(previousTodos) ? previousTodos : [])
    .filter(t => t && t.status !== 'completed' && String(t?.content || '').trim())
  const lines = [
    '你是察元助手页内的文档智能体。通过 MCP 工具操作当前 WPS 文档与其它已配置的 HTTP MCP 服务。',
    '工具名带服务器前缀，格式 serverId__toolName（例如 chayuan__proofread_run）。调用时必须使用完整前缀名。',
    '优先使用 chayuan__ 文档/校对工具完成文档任务；可用 assistants_search / assistants_get 获取助手配方后再用 document_* 落文档。',
    '禁止调用 declassify_*。写文档前先 dryRun/预览；需要 confirmed=true 的写回交给用户确认，不要自行编造 confirmed=true。',
    '【任务清单·强制顺序】请求包含 ≥2 个可独立交付的子任务或明确多步流程时：第 1 轮必须先调用 todo_write 列出完整计划，在此之前禁止调用任何其他工具（只读工具也不行）；随后严格按清单推进——每开始一项，先 todo_write 把它置 in_progress；每完成一项，立即 todo_write 置 completed 再开始下一项；同一时刻至多一项 in_progress；严禁做完后一次性补写清单。单一简单请求（一问一答、单次工具能完成的）不要用 todo_write。',
    '【错别字 / 校对 / 语法检查】必须一次调用 chayuan__proofread_run(dryRun:true, scope=document 或 selection) 完成：它内部已自动分块、逐段调校对模型并返回 issues。严禁改用 document_chunks 自己逐段读再找错字——那样既慢，又会把整轮对话的轮次耗光、撞上轮次上限。',
    '【改正错别字·多处】一次改多处必须用 document_apply_ops(action:"replace", operations:[{originalText,outputText},…]) 单次批量替换——每条 originalText 自动定位、最多 200 条；同一处的正文/拼音等都作为不同 operation 一起提交。严禁「逐条 document_locate 再 document_replace」：N 处错字 = N×2 次调用，必然撞上轮次上限。仅改单处且原文已知时才用 document_replace。',
    '【改样子≠改字】加粗/变色/字号/字体/删除线/拼音 → format_run 或 format_apply_ops；对齐/行距 → format_para；标题样式 → style(action=apply)。严禁用 document_replace 做加粗变色。',
    '【批注/修订】comment(action=list|add|delete) / revision(action=mode|list|apply)；写操作 confirmed:true。',
    pendingPrev.length
      ? `【沿用清单】上一轮任务清单尚有未完成项：${pendingPrev.map(t => t.content).join('；')}。先调用 todo_write 重建该清单（用户已确认/已完成的部分标 completed，本轮要做的第一项置 in_progress），沿用它继续执行，不要另立新清单。`
      : '',
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
  previousTodos = [],
  writeBaselineToken = '',
  loopHistory = [],
  signal,
  onProgress,
  onTodos,
  onSnapshot,
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

  // 回合启动握手并行化：本机 tools/list、上游白名单同步 + 各上游 tools/list 三路
  // 同时发起（此前严格串行——上游一多，每个都要等前一个完成才开跑）。步骤日志在
  // 全部落定后按 enabled 原顺序补齐，保持 UI 步骤顺序稳定。
  const localServer = enabled.find(s => s.id === CHAYUAN_SERVER_ID)
  const upstreamServers = enabled.filter(s => s.id !== CHAYUAN_SERVER_ID)
  const [localResult, upstreamResults] = await Promise.all([
    localServer
      ? listLocalToolsCached({ signal }).then(tools => ({ tools }), error => ({ error }))
      : Promise.resolve(null),
    upstreamServers.length
      ? syncUpstreamAllowlist({ signal })
        .then(() => Promise.all(upstreamServers.map(s =>
          listUpstreamToolsCached(s.id, { signal }).then(
            tools => ({ server: s, tools }),
            error => ({ server: s, error })
          )
        )))
        .catch(error => upstreamServers.map(s => ({ server: s, error })))
      : Promise.resolve([])
  ])
  const perServerTools = new Map()
  if (localServer) {
    perServerTools.set(CHAYUAN_SERVER_ID, localResult.error ? { error: localResult.error } : { tools: localResult.tools })
  }
  for (const r of upstreamResults) {
    perServerTools.set(r.server.id, r.error ? { error: r.error } : { tools: r.tools })
  }
  for (const server of enabled) {
    const r = perServerTools.get(server.id)
    if (!r) continue
    if (r.error) {
      pushStep(`跳过 ${server.name || server.id}`, r.error.message || String(r.error))
      continue
    }
    for (const t of r.tools) {
      if (server.id === CHAYUAN_SERVER_ID && !isChayuanToolAllowed(t.name)) continue
      mergedTools.push({
        name: namespaceToolName(server.id, t.name),
        description: `[${server.name}] ${t.description || t.name}`,
        inputSchema: t.inputSchema || { type: 'object', properties: {} }
      })
    }
    usedServers.push(server.id)
    if (server.id === CHAYUAN_SERVER_ID) {
      pushStep('已连接察元 MCP', `${r.tools.length} 个工具（白名单后 ${mergedTools.filter(x => x.name.startsWith(`${CHAYUAN_SERVER_ID}__`)).length}）`)
    } else {
      pushStep(`已连接 ${server.name}`, `${r.tools.length} 个工具`)
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
  const system = buildSystemPrompt({ selectionCtx, kbBound, proofreadIntent, previousTodos })
  const seed = seedHistoryFrom(historyMessages)
  const pendingConfirms = []
  let proofreadCard = null

  // 首次变更前快照（PR7）：loop 在第一个 mutating 工具执行前调用；页面直读
  // WPS API 取全文，供消息卡「撤销本次修改」一键回滚。读不到文档返回 undefined。
  const captureDocSnapshot = () => {
    try {
      const doc = window.Application?.ActiveDocument
      if (!doc) return undefined
      return {
        docId: String(doc.FullName || doc.Name || ''),
        text: String(doc.Content?.Text || ''),
        at: Date.now()
      }
    } catch {
      return undefined
    }
  }

  // 跨回合上下文（PR7）：上回合序列化的 loop.messages 原样 restore——上一轮读过的
  // 文档内容、工具结论全部保留，追问「刚才第二段改成什么了」可答；8 条种子窗口
  // 降级为无 loopHistory 时的兜底。compaction 打开（预算收紧），超长自动摘要。
  const restoreHistory = (loop) => {
    if (Array.isArray(loopHistory) && loopHistory.length) {
      try {
        loop.restore(loopHistory)
        return
      } catch { /* 损坏历史回落种子窗口 */ }
    }
    if (seed.length) loop.restore(seed)
  }

  // 跑一轮完整的 agent 循环。settle 为 { result }（onDone）或 { error: string }（onError）。
  let loopRef = null
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
      writeBaselineToken,
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
        onToolExecuted: ({ call, execution, snapshotBefore }) => {
          const detail = execution.isError ? toolErrorDetail(execution.output) : String(execution.output || '')
          pushStep(`${execution.isError ? '失败' : '完成'} ${call.name}`, detail.slice(0, 160))
          // 首个写操作的写前快照透出给 UI（撤销卡数据源）
          if (snapshotBefore) onSnapshot?.(snapshotBefore)
        },
        onDone: (result) => settle({ result }),
        onError: (error) => settle({ error })
      },
      maxTurns: MAX_ROUNDS,
      maxHistory: Infinity, // 单轮编排内不裁历史；跨轮由 loopHistory restore + compaction 承接
      compaction: { maxBytes: 128 * 1024, keepRecentBytes: 48 * 1024 },
      captureSnapshot: captureDocSnapshot
    })
    loopRef = loop
    if (forceDegraded) loop.degrade()
    restoreHistory(loop)
    onAbort = () => loop.cancel()
    if (signal && !signal.aborted) signal.addEventListener('abort', onAbort, { once: true })
    loop.run(String(userText))
  })

  let out = await runLoop(false)
  // 模型不支持 tools 协议：与旧编排器一样，识别报错特征后立即切 JSON 兼容层整轮重跑。
  // 守卫熔断错误（Every tool call failed… 等）被 isToolsUnsupportedError 排除——
  // 那是执行层故障（如 Agent 离线），降级重跑只会再烧一轮轮次，不解决问题。
  if (out.error && !signal?.aborted && isToolsUnsupportedError(out.error)) {
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
    todos,
    // 跨回合上下文：本回合结束后 loop 内的完整历史（含工具结论），调用方按 chat
    // 持久化，下回合经 loopHistory 参数 restore 回来
    loopMessages: trimLoopHistoryForStorage(loopRef?.messages || [])
  }
}

/** 持久化裁剪：从尾部保留到 ~96KB；开头不允许是孤立的 tool 结果（协议配对要求） */
function trimLoopHistoryForStorage(messages, maxBytes = 96 * 1024) {
  if (!Array.isArray(messages) || !messages.length) return []
  let total = 0
  // 默认 0=全部保留；超预算时改为「保留起点」（尾部最近的先满足预算）
  let cut = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    let size = 0
    try { size = JSON.stringify(messages[i]).length } catch { size = 4096 }
    if (total + size > maxBytes) {
      cut = i + 1
      break
    }
    total += size
  }
  let kept = messages.slice(cut)
  while (kept.length && kept[0]?.role === 'tool') kept = kept.slice(1)
  return JSON.parse(JSON.stringify(kept))
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
