/**
 * AgentSkill 适配层：把本项目的 MCP 工具目录（察元本机 + 上游 allowlist）
 * 包成 chayuan-office agent-core 的 AgentSkill。
 *
 * 旧 mcpChatOrchestrator 的领域语义原样保留：
 * - 写操作直接执行（2026-09-17 起移除人工确认闸门：智能体按用户指令直接落笔；
 *   confirmed 由本层对 chayuan 写工具无条件注入——sidecar 协议要求，且保持
 *   「confirmed 只能由客户端注入」的单一来源，模型入参携带的一律先剥除）
 * - proofread_run 长任务的实时进度透传（读 spell-check 活动任务）
 * - proofread_run 结果抽取为校对卡片（dryRun 预览 → 用户在卡片上落笔）
 */
import {
  CHAYUAN_SERVER_ID,
  chayuanToolTargetHost,
  isToolAllowedCrossHost,
  parseNamespacedTool
} from './mcpServerRegistry.js'
import { callLocalTool, callUpstreamTool } from './mcpHttpClient.js'
import { generateImageViaModelChain } from '../imagery/agentImageTier.js'
import { getActiveTask } from '../../utils/taskListStore.js'
import { logEvent } from '../../utils/globalErrorLogger.js'
import { detectAddonType, hostLabel } from '../../utils/host/hostType.js'
import { getFlatModelsFromSettings } from '../../utils/modelSettings.js'
import { getToolResultBudgetTokens } from '../../utils/modelContextCatalog.js'
// 上游 vendored 能力件收割（2026-11-25）：MIND_MAP_TOOL 定义+tidy-tree 布局+Mermaid
// 导出原本在 src/agent-core/mind-map.ts 躺着零消费，这里注册成 client tool 接进循环
import { MIND_MAP_TOOL, MIND_MAP_LIMITS, countMindMapNodes, mindMapToMermaid } from '../../agent-core/mind-map'

/**
 * 当前对话模型（面板选中项）——file_parse 内部调用时按模型上下文注入结果预算：
 * 显式字段 contextWindow > 内置推断表 > 保守 8192（见 modelContextCatalog）。
 * 解析失败返回 null（file_parse 侧落回默认 6000 tokens）。
 */
function currentChatModelEntry() {
  try {
    let compositeId = ''
    try {
      compositeId = String(window.Application?.PluginStorage?.getItem('ai_assistant_selected_model_id') || '').trim()
    } catch (_) { /* PluginStorage 不可用 */ }
    if (!compositeId) {
      compositeId = String(window.localStorage?.getItem('ai_assistant_selected_model_id') || '').trim()
    }
    if (!compositeId) return null
    const modelId = compositeId.includes('|') ? compositeId.split('|').slice(1).join('|') : compositeId
    return { modelId, contextWindow: undefined }
  } catch (_) {
    return null
  }
}

function fileParseBudgetTokens() {
  const entry = currentChatModelEntry()
  if (!entry?.modelId) return undefined
  try {
    // 设置里显式登记的 contextWindow 优先于推断表
    const flat = getFlatModelsFromSettings('chat')
    const matched = flat.find(m => m.modelId === entry.modelId)
    return getToolResultBudgetTokens(matched || entry) || undefined
  } catch (_) {
    return undefined
  }
}

/**
 * 跨宿主首写前的目标身份探针：读目标宿主 status 取活动对象 FullName。
 * et/wpp 走各自域 status；wps 走 wps_status（document.fullName 宿主感知）。
 */
async function probeHostDocumentId(host, signal) {
  // 返回 { pin, error, confirmedNoDoc }：
  //  - pin=活动对象 FullName；confirmedNoDoc=true=status 明确报告没有打开对象（真没文档）
  //  - 其余失败（路由错位/读取异常/字段为空）一律 error 透出，不与「真没文档」混判
  //    ——（真机 2026-11-21 两轮误报：探针把「读不到」吞成 null 硬失败阻塞写回）
  try {
    let sc = null
    if (host === 'et') sc = await callLocalTool('spreadsheet', { action: 'status' }, { signal })
    else if (host === 'wpp') sc = await callLocalTool('presentation', { action: 'status' }, { signal })
    // 宿主定向：wps_status 支持 U3（args.host → ribbon:wps 基座），必须带上
    else sc = await callLocalTool('wps_status', host === 'wps' ? { host: 'wps' } : {}, { signal })
    const data = sc?.structuredContent || sc || {}
    // wps_status 返回体双层嵌套（真机三连误报真凶）：structuredContent.document
    // 是 agent 状态壳，真正的活动文档在其内层 document 字段——探针原样取外层的
    // fullName（不存在）→ null → 误报 NO_ACTIVE_DOCUMENT。et/wpp 分支同构兜底。
    let docInfo = host === 'et' ? data?.workbook : host === 'wpp' ? data?.presentation : data?.document
    if (docInfo && docInfo.document && typeof docInfo.document === 'object') {
      docInfo = docInfo.document
    }
    if (docInfo && docInfo.open === false) {
      return { pin: '', confirmedNoDoc: true, error: String(docInfo?.error || '该宿主未打开文档') }
    }
    const pin = String(docInfo?.fullName || docInfo?.name || '')
    if (pin) return { pin, confirmedNoDoc: false, error: '' }
    // status 成功但字段为空——透出原始返回供诊断（addonType/agentOnline 等线索）
    return {
      pin: '',
      confirmedNoDoc: false,
      error: `status 无身份字段（addonType=${data?.addonType || '?'} agentOnline=${data?.agentOnline ?? '?'} keys=${Object.keys(data).slice(0, 6).join(',')}）`
    }
  } catch (e) {
    return { pin: '', confirmedNoDoc: false, error: String(e?.code || '') + ' ' + String(e?.message || e) }
  }
}

const WRITE_TOOL_RE = /^(document_replace|document_insert|document_apply_ops|document_save|proofread_apply_comments|format_run|format_para|format_apply_ops|comment|comment_delete|revision|revision_mode|layout|layout_columns|toc|toc_insert|toc_update|table|table_insert|image|image_insert|image_delete|hyperlink|hyperlink_add|hyperlink_delete|headerfooter|headerfooter_set|watermark|watermark_set|watermark_clear|style|export|spreadsheet|presentation|slide_add|slide_delete|slide_duplicate|slide_move|textbox_add|shape_add|shape_update|notes_set|picture_add|chart_add|break_insert|page_blank_insert|bookmark_goto|nav_pane_set|nav_outline)$/

// 聚合域工具（名字=工具，action 区分读写）的只读 action：不注入 confirmed、
// 不带 OCC 基线 token、不算 mutated（否则 style list / comment list 会被当写操作）
const AGGREGATE_READ_ACTIONS = {
  comment: ['list'],
  revision: ['list'],
  style: ['list', 'audit'],
  nav: ['location', 'outline'],
  toc: [],
  bookmark: ['list', 'goto'],
  layout: [],
  table: ['list', 'header_read', 'row_read', 'column_read', 'cell_read', 'export'],
  image: ['list', 'export'],
  hyperlink: ['list'],
  headerfooter: ['get'],
  watermark: [],
  export: [],
  footnote: ['list'],
  spreadsheet: ['status', 'sheet_list', 'used_range', 'range_read', 'selection_read', 'find', 'chart_list'],
  presentation: ['status', 'slide_list', 'slide_read', 'shape_list']
}

function isAggregateReadAction(toolName, args) {
  const actions = AGGREGATE_READ_ACTIONS[toolName]
  if (!actions) return false
  return actions.includes(String(args?.action || '').trim())
}

function isWriteTool(serverId, toolName, args) {
  if (serverId === CHAYUAN_SERVER_ID) {
    if (toolName === 'proofread_run') return false
    if (isAggregateReadAction(toolName, args)) return false
    return WRITE_TOOL_RE.test(toolName) || toolName.endsWith('_apply')
  }
  return false
}

/**
 * chayuan 写工具是否需要本层注入 confirmed:true。
 * proofread_apply_comments 的 sidecar 确认闸门不认 dryRun（它本身就是落笔动作）；
 * 其余写工具 dryRun 预览路径不注入（预览不是落笔）。
 */
function needsAutoConfirm(serverId, toolName, args) {
  if (serverId !== CHAYUAN_SERVER_ID) return false
  if (isAggregateReadAction(toolName, args)) return false
  if (toolName === 'proofread_apply_comments') return true
  return isWriteTool(serverId, toolName, args) && args?.dryRun !== true
}

/** 客户端 todo 工具：不落 sidecar，只经 onTodoWrite 回调透出给消息卡渲染 */
const TODO_WRITE_TOOL = {
  name: 'todo_write',
  description: '维护本轮任务清单（整表替换式更新）。预计要调用 ≥2 次工具的回合（含「生成+插入+排版」类组合，如生成图片再插入再叠文字）必须使用：与首个真实工具调用放在同一条消息里并行提交（列出完整计划、首项置 in_progress），之后每次状态更新都随下一批真实工具调用搭车提交，不要单独占用一轮。开始某项前将其置 in_progress，完成后立即置 completed；同一时刻至多一项 in_progress。真正单一的请求（一问一答、单次工具能完成）不要使用。',
  inputSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: '完整清单，每次整表替换',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '任务短句，动词开头' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] }
          },
          required: ['content', 'status']
        }
      }
    },
    required: ['todos']
  }
}

const TODO_STATUSES = new Set(['pending', 'in_progress', 'completed'])

/**
 * 客户端思维导图工具（上游 mind-map.ts 收割对接，2026-11-25）：模型一次性提交
 * 整棵树，本地校验/裁剪（深度/标签上限防失控）后返回 Mermaid 源码（可直接贴出
 * 或写入文档）；display 侧信道带完整树供 UI 渲染（types.ts 契约：永不进 LLM 上下文）。
 */
const MIND_MAP_CLIENT_TOOL = {
  name: MIND_MAP_TOOL.name,
  description: '生成思维导图：用户要「思维导图/脑图/知识结构/结构梳理」时调用。把整棵树一次性提交（root=主题，children=分支），标签用文档原语言的短语、不得编造文档没有的内容；本工具不修改文档，返回 Mermaid 源码后用一句话回复即可。',
  inputSchema: MIND_MAP_TOOL.inputSchema
}

function normalizeMindMapNode(raw, depth = 0) {
  if (!raw || typeof raw !== 'object') return null
  const label = String(raw.label || '').trim().slice(0, MIND_MAP_LIMITS.maxLabelChars)
  if (!label) return null
  const node = { label }
  if (depth < MIND_MAP_LIMITS.maxDepth - 1 && Array.isArray(raw.children) && raw.children.length) {
    const children = raw.children.slice(0, 20).map(c => normalizeMindMapNode(c, depth + 1)).filter(Boolean)
    if (children.length) node.children = children
  }
  return node
}

function handleGenerateMindMap(args) {
  const root = normalizeMindMapNode(args?.root, 0)
  if (!root) {
    return {
      output: JSON.stringify({ ok: false, error: 'root 必填：思维导图树对象（{label, children:[…]}），label 必填且不能全空' }),
      isError: true,
      summary: '思维导图参数无效'
    }
  }
  const nodeCount = countMindMapNodes(root)
  const mermaid = mindMapToMermaid(root)
  return {
    output: JSON.stringify({
      ok: true,
      nodeCount,
      mermaid,
      hint: '上面是 Mermaid mindmap 源码，可直接贴给用户或按需写入文档/插入代码块；结构化树已随 display 提供界面渲染，无需在回复里复述整棵树。'
    }),
    isError: false,
    summary: `思维导图已生成（${nodeCount} 节点）`,
    display: { kind: 'mindmap', tree: root }
  }
}

function normalizeTodoList(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const item of raw.slice(0, 50)) {
    const content = String(item?.content || '').trim().slice(0, 200)
    if (!content) continue
    const status = TODO_STATUSES.has(item?.status) ? item.status : 'pending'
    out.push({ content, status })
  }
  return out
}

// 上游工具只读启发式已随写确认闸门一并移除（2026-09-17）：上游工具同样直通执行。

// file_parse 结果进历史放宽：默认 6000 字符会把 chunk 块（默认 2000 token ≈ 3k+
// 字符）连元数据一起截掉；file_parse 自带 token 预算（auto 档已按预算产出，
// chunk 档每块远小于该值），这里给到 12000 防误伤。
const TOOL_RESULT_LIMITS = { default: 6000, file_parse: 12000 }

function summarizeToolResult(result, toolName) {
  try {
    const sc = result?.structuredContent || result?.content || result
    const text = typeof sc === 'string' ? sc : JSON.stringify(sc)
    const limit = TOOL_RESULT_LIMITS[toolName] || TOOL_RESULT_LIMITS.default
    return text.length > limit ? `${text.slice(0, limit)}…(truncated)` : text
  } catch {
    return String(result)
  }
}

/**
 * ToolDisplay.images 采集（上游 types.ts 侧信道，2026-11-25 收割对接）：生图/搜图
 * 成功时带产物路径 → 面板渲染缩略图网格；display 永不进 LLM 上下文。
 */
const IMAGE_RESULT_TOOL_RE = /^(generate_image|image_search)$/
function extractToolDisplay(toolName, result) {
  if (!IMAGE_RESULT_TOOL_RE.test(String(toolName || '')) || result?.isError) return null
  const sc = result?.structuredContent || {}
  const path = String(sc?.path || '')
  if (!path || !/\.(png|jpe?g|gif|webp)$/i.test(path)) return null
  return {
    kind: 'images',
    items: [{ url: path, title: String(sc?.prompt || sc?.query || '').slice(0, 80) }]
  }
}

function extractProofreadCard(toolName, args, result) {
  if (toolName !== 'proofread_run') return null
  // An error/timeout envelope (e.g. AGENT_HANDLER_TIMEOUT) is structuredContent
  // too — building a card from it yields taskId='' + no issues, which then renders
  // dead 批注/改正正文 buttons ("缺少校对 taskId" / "0 处替换"). Skip it so the
  // model's own failure text is shown instead.
  if (result?.isError) return null
  const sc = result?.structuredContent || result
  if (!sc || typeof sc !== 'object') return null
  const taskId = sc.taskId || sc.task_id || ''
  const issues = sc.issues || sc.items || sc.results || []
  const issueCount = Array.isArray(issues)
    ? issues.reduce((n, it) => n + (Array.isArray(it?.issues) ? it.issues.length : 1), 0)
    : Number(sc.issueCount || sc.count || 0)
  // Don't surface a card we can't act on (no taskId for comments AND no issues to fix)
  if (!taskId && issueCount === 0) return null
  return {
    taskId: String(taskId || ''),
    issueCount,
    dryRun: args?.dryRun !== false,
    scope: args?.scope || 'document',
    summary: String(sc.summary || sc.message || `发现 ${issueCount || 0} 处问题`).slice(0, 500),
    raw: sc
  }
}

/**
 * proofread_run 是长任务（大文档逐块调模型，常需数十秒）。期间本页 dispatchMcpJob
 * 在同一 JS 上下文里跑，会写一条 type:'spell-check' 的实时任务（含 current/total/
 * progress）。这里在调用期间每 ~700ms 读一次 getActiveTask()，原地更新一条
 * 「校对中 X/Y 段 (Z%)」进度步骤，经 onProgress 透传给加载条，避免一直死卡 93%。
 */
async function callLocalToolWithProofreadProgress(name, args, { signal, pushProgress } = {}) {
  let timer = null
  if (typeof pushProgress === 'function') {
    let lastSignature = ''
    timer = setInterval(() => {
      if (signal?.aborted) return
      let task = null
      try { task = getActiveTask() } catch { task = null }
      if (!task || task.type !== 'spell-check') return
      const cur = Number(task.current || 0)
      const total = Number(task.total || 0)
      const pct = Math.max(0, Math.min(100, Math.round(Number(task.progress || 0))))
      const signature = `${cur}/${total}/${pct}`
      if (signature === lastSignature) return
      lastSignature = signature
      pushProgress({
        label: total > 0 ? `校对中 ${cur}/${total} 段` : '校对中…',
        detail: `${pct}%`,
        progress: pct
      })
    }, 700)
  }
  try {
    return await callLocalTool(name, args, { signal })
  } finally {
    if (timer) clearInterval(timer)
  }
}

/**
 * @param {object} opts
 * @param {string} opts.systemPrompt - 编排器拼好的领域系统提示词
 * @param {Array} opts.mergedTools - 已合并（namespaced）的工具目录条目
 * @param {(info: object) => void} [opts.pushProgress] - 长任务实时进度
 * @param {(card: object) => void} [opts.onProofreadCard] - proofread_run 结果卡片
 * @param {(todos: Array) => void} [opts.onTodoWrite] - todo_write 客户端工具的清单透出
 * @param {string} [opts.writeBaselineToken] - 回合 OCC 基线 token；随写工具参数
 *   透传到加载项 dispatch 层，供写锁按回合隔离校验（__baselineToken 为保留字段）
 * @param {string} [opts.writeDocLinkId] - 回合绑定文档身份（Model S 对话驻留）；随写
 *   工具参数透传（__docLinkId 为保留字段），dispatch 按 docLinkId 优先解析目标，
 *   非活动文档照常静默写入（S2 路径）
 */
export function createMcpDocumentSkill({
  systemPrompt,
  mergedTools,
  pushProgress,
  onProofreadCard,
  onTodoWrite,
  writeBaselineToken = '',
  writeDocLinkId = '',
  targetDocumentId,
  initialHostPins,
  kbBinding = null
} = {}) {
  // 回合 pin 表（追问 5 定案）：{ 宿主 → 活动对象 FullName }。发起宿主由调用方
  // 种子（targetDocumentId 兼容旧签名）；跨宿主首写时经 status 探针自动补齐。
  const hostPins = { ...(initialHostPins || {}) }
  if (targetDocumentId) {
    const initHost = detectAddonType()
    if (!hostPins[initHost]) hostPins[initHost] = String(targetDocumentId)
  }
  // 本回合成功落笔的写操作数（按 ops 条目计），供 verifyResponse 与末轮声称核对
  let executedWriteOps = 0
  // 任务清单催单：回合里真实工具已开跑但模型还没 todo_write 过（快档模型常见），
  // 在首个工具结果里注入一次提醒——工具结果对模型的约束力远强于系统提示词
  let todosWritten = false
  let todoNudgeGiven = false
  const countWriteOps = (toolName, args, result) => {
    if (result?.isError) return 0
    if (toolName === 'document_apply_ops') {
      return Math.max(1, Number(args?.ops?.length || 1))
    }
    if (toolName === 'proofread_apply_comments') {
      const sc = result?.structuredContent || result
      const applied = Number(sc?.applied ?? sc?.count ?? 0)
      return applied > 0 ? applied : 1
    }
    return 1
  }
  return {
    id: 'chayuan-mcp-doc',
    systemPrompt,
    tools: [
      TODO_WRITE_TOOL,
      MIND_MAP_CLIENT_TOOL,
      ...(mergedTools || []).filter(t => {
        const { serverId, toolName } = parseNamespacedTool(t.name)
        return serverId !== CHAYUAN_SERVER_ID || isToolAllowedCrossHost(toolName)
      }).map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema || { type: 'object', properties: {} }
      }))
    ],
    buildContext: () => '',
    /**
     * 声称核对（loop 预留钩子，PR7 接通）：末轮文本声明「已替换/改正/删除 N 处」
     * 而实际成功写操作数不足时，强制追加一轮纠偏——谎报被拦，模型要么补齐操作
     * 要么修正总结。只对明确数量声明生效（正则限界），避免误伤泛泛表述。
     */
    verifyResponse(finalText) {
      const text = String(finalText || '')
      const claimed = []
      const RE = /已[^。；;\n]{0,10}?(\d+)\s*(?:处|条|个|段|次|项)/g
      let m
      while ((m = RE.exec(text)) !== null) {
        const n = Number(m[1])
        if (Number.isFinite(n) && n > 0) claimed.push(n)
      }
      if (!claimed.length) return null
      const claimedMax = Math.max(...claimed)
      if (claimedMax <= executedWriteOps) return null
      return [
        `你的总结声称完成了约 ${claimedMax} 处修改，但本轮工具实际成功落笔的写操作数为 ${executedWriteOps}。`,
        '请核对实际执行结果：若有操作未执行或失败，请重新调用相应工具补齐；若确实无需修改，请修正总结中的数量表述，不要虚报。'
      ].join('')
    },
    async executeTool(call, signal) {
      const toolT0 = Date.now()
      const toolLogEnd = (ok, extra = {}) => {
        try {
          logEvent('tool_end', {
            tool: call?.name || '',
            ok,
            ms: Date.now() - toolT0,
            ...extra
          })
        } catch { /* 日志失败不影响工具执行 */ }
      }
      if (call?.name === MIND_MAP_CLIENT_TOOL.name) {
        return handleGenerateMindMap(args)
      }
      if (call?.name === TODO_WRITE_TOOL.name) {
        const todos = normalizeTodoList(call?.input?.todos)
        todosWritten = true
        onTodoWrite?.(todos)
        const done = todos.filter(t => t.status === 'completed').length
        return {
          // hint 常驻回灌：模型单独发 todo_write 时提醒下轮搭车，避免清单更新
          // 独占模型轮次（每多一轮 = 一次全上下文模型往返）
          output: JSON.stringify({
            ok: true,
            total: todos.length,
            done,
            hint: '清单已更新。后续 todo_write 状态更新请与下一批真实工具调用放在同一条消息里并行提交，不要单独占用一轮。'
          }),
          summary: `任务清单已更新（${done}/${todos.length} 完成）`
        }
      }
      const nsName = call.name
      const { serverId, toolName } = parseNamespacedTool(nsName)
      const args = call.input && typeof call.input === 'object' && !Array.isArray(call.input)
        ? { ...call.input }
        : {}
      // confirmed 单一来源：模型入参里的 confirmed 一律剥除（sidecar 工具示例会教
      // 模型带 confirmed:true），写工具是否带 confirmed 由本层统一决定后注入。
      delete args.confirmed
      delete args.__expectedDocId
      // KB 绑定随调用直传：绑定真源在发起回合的 webview（PluginStorage 按宿主进程
      // 隔离，而 sidecar 把 kb.retrieve 按 any 路由——多宿主同开时会落到别的宿主
      // 基座执行）。注入进工具参数后无论路由到哪个 webview 都能拿到真实绑定。
      if (toolName === 'kb_retrieve' && kbBinding && Array.isArray(kbBinding.kbNames) && kbBinding.kbNames.length) {
        args.binding = kbBinding
      }
      // file_parse 预算注入：内部 agent 调用未显式给 budgetTokens 时，按当前对话
      // 模型的上下文窗口自动定预算（min(窗口×0.25, 32000)），小模型自动少拿、
      // 大模型自动多拿——外部 MCP 客户端不经过这里，仍用工具缺省 6000 或自带值
      if (toolName === 'file_parse' && !Number(args.budgetTokens)) {
        const budget = fileParseBudgetTokens()
        if (budget) args.budgetTokens = budget
      }
      if (needsAutoConfirm(serverId, toolName, args)) {
        args.confirmed = true
      }

      try {
        let result
        if (serverId === CHAYUAN_SERVER_ID) {
          if (!isToolAllowedCrossHost(toolName)) {
            throw Object.assign(new Error(`工具 ${toolName} 已禁用（文档生命周期工具不可用：跨宿主读写不包含新建/打开/切换文件）。`), { code: 'TOOL_NOT_ALLOWED' })
          }
          if (isWriteTool(serverId, toolName, args)) {
            // 回合 pin 表（追问 5 定案）：写工具按目标宿主自动校验活动对象身份。
            // 发起宿主的 pin 在回合起点由调用方种子；跨宿主首写时这里自动向目标
            // 宿主发 status 探针取 FullName 钉住整回合——不依赖模型自觉。
            const targetHost = chayuanToolTargetHost(toolName)
            if (targetHost) {
              let pin = hostPins[targetHost]
              if (!pin) {
                pushProgress?.({ label: `校验 ${hostLabel(targetHost)} 写入目标`, detail: '跨宿主写入前自动探测活动对象身份' })
                const probe = await probeHostDocumentId(targetHost, signal)
                if (probe?.confirmedNoDoc) {
                  // status 明确报告该宿主没打开文档：真实失败，如实阻塞
                  throw Object.assign(new Error(`目标${hostLabel(targetHost)}没有打开的文件，无法跨宿主写入。请先在${hostLabel(targetHost)}中打开目标文件后重试。`), { code: 'NO_ACTIVE_DOCUMENT' })
                }
                pin = probe?.pin || ''
                // 探针读不到（路由错位/status 字段缺失等）≠ 确认没文档：降级为无 pin
                // 继续执行——dispatch 写锁 + requireDoc 写当前活动文档兜底，身份校验由
                // 发起侧种子（targetDocumentId→__expectedDocId）承担。阻塞会把「探测
                // 不到」错当成「文档没开」，功能完全不可用（真机两轮误报教训）。
                if (!pin) {
                  pushProgress?.({ label: `写入目标探测失败，按当前活动${hostLabel(targetHost)}写入`, detail: String(probe?.error || '探针无返回').slice(0, 160) })
                } else {
                  hostPins[targetHost] = pin
                }
              }
              if (pin) args.__expectedDocId = pin
            }
            if (writeDocLinkId) {
              // Model S：绑定身份随写工具走（dispatch 按 docLinkId 优先解析目标）
              args.__docLinkId = writeDocLinkId
            }
            if (writeBaselineToken) {
              args.__baselineToken = writeBaselineToken
            }
          }
          if (toolName === 'proofread_run') {
            result = await callLocalToolWithProofreadProgress(toolName, args, { signal, pushProgress })
          } else if (toolName === 'generate_image') {
            // 三级生图 Tier1：先用设置页启用的图像生成模型（webview 侧直连，
            // 落盘双通道：sidecar 容器路径 → webview 临时目录兜底）。模型阶段
            // 失败/未配置 → 回落 sidecar 原生 generate_image（image-gen.json
            // 配置面）；落盘失败（persist-failed）不回落——换模型只会重复付费
            // 且必然同点失败，直接把带指引的错误交给模型；两级都失败返回
            // ok:false，模型按配图策略降级 image_search / svg_add（铁律：不静默替位）。
            // 宿主感知尺寸：WPP 宿主且模型未显式指定比例 → 按当前演示稿页面
            // 宽高比自动选 16:9/9:16（否则生图模型默认 1:1，铺不满 PPT 页）
            let genAspectRatio = args?.aspectRatio || args?.size || ''
            if (!genAspectRatio && detectAddonType() === 'wpp') {
              try {
                const st = await callLocalTool('presentation', { action: 'status' }, { signal })
                const info = st?.structuredContent?.presentation || st?.presentation || {}
                const sw = Number(info.slideWidth || 0)
                const sh = Number(info.slideHeight || 0)
                if (sw > 0 && sh > 0) {
                  const ratio = sw / sh
                  genAspectRatio = ratio > 1.2 ? '16:9' : ratio < 0.83 ? '9:16' : '1:1'
                }
              } catch (_) { /* 探测失败按缺省 1:1 */ }
            }
            const tier1 = await generateImageViaModelChain({
              prompt: args?.prompt,
              aspectRatio: genAspectRatio,
              signal
            })
            if (tier1.ok) {
              toolLogEnd(true, { tier: 'model', model: tier1.modelId })
              const output = JSON.stringify({
                ok: true,
                source: 'model',
                path: tier1.path,
                model: tier1.modelId,
                prompt: String(args?.prompt || '')
              })
              // thumb = canvas 512px dataURL（agentImageTier 产出，小而稳——对话直显/
              // lightbox/下载兜底）；full = 原图 dataURL（≤6MB 才带，放大锐利+下载原图）
              return {
                output,
                isError: false,
                summary: `生图完成（模型 ${tier1.modelId}）`,
                display: {
                  kind: 'images',
                  items: [{
                    url: tier1.path,
                    title: String(args?.prompt || '').slice(0, 80),
                    ...(tier1.thumb ? { thumb: tier1.thumb } : {}),
                    ...(tier1.full && tier1.full.length <= 6_000_000 ? { full: tier1.full } : {})
                  }]
                }
              }
            }
            if (tier1.reason === 'persist-failed') {
              // 图片已生成成功但落盘两通道全败（sidecar+webview）——回落 Tier2
              // 只会再付一次生成费并在同一点失败；直接把带修复指引的错误当工具
              // 结果交给模型（isError 语义，走通用 summarize/log 出口）
              result = {
                isError: true,
                content: [{ type: 'text', text: JSON.stringify({ ok: false, error: tier1.error, hint: tier1.hint || '' }) }]
              }
            } else {
              if (tier1.reason === 'model-failed' || tier1.reason === 'no-model') {
                pushProgress?.({
                  label: '模型生图未走通，尝试本机生图服务',
                  detail: tier1.errors?.join('；') || tier1.error || ''
                })
              }
              result = await callLocalTool(toolName, args, { signal })
            }
          } else {
            result = await callLocalTool(toolName, args, { signal })
          }
        } else {
          result = await callUpstreamTool(serverId, toolName, args, { signal })
        }
        const card = extractProofreadCard(toolName, args, result)
        if (card) onProofreadCard?.(card)
        let output = summarizeToolResult(result, toolName)
        const summaryBase = output.slice(0, 120)
        const toolDisplay = extractToolDisplay(toolName, result)
        // 催单（仅一次）：真实工具已在跑但清单还没立——提醒模型下一条消息立即补
        // todo_write（已完成项标 completed），与下一个工具调用并行提交
        if (!todosWritten && !todoNudgeGiven && serverId === CHAYUAN_SERVER_ID && result?.isError !== true) {
          todoNudgeGiven = true
          output += '\n【清单提醒】本回合将调用多个工具：请立即用 todo_write 建立任务清单（已完成的步骤标 completed、当前步骤 in_progress、余下步骤 pending），与你的下一个工具调用放在同一条消息里并行提交，不要单独占用一轮。'
        }
        const mutated = !result?.isError && isWriteTool(serverId, toolName, args)
        if (mutated) executedWriteOps += countWriteOps(toolName, args, result)
        toolLogEnd(!result?.isError)
        return {
          output,
          isError: result?.isError === true,
          summary: summaryBase || nsName,
          // 写工具成功落笔才视为变更：退避守卫据此豁免「重复相同写操作」的熔断
          mutated,
          ...(toolDisplay ? { display: toolDisplay } : {})
        }
      } catch (e) {
        toolLogEnd(false, { code: e?.code || '', message: String(e?.message || '').slice(0, 160) })
        return {
          output: JSON.stringify({ ok: false, error: e?.code || 'TOOL_ERROR', message: e?.message || String(e) }),
          isError: true,
          summary: `${nsName} 失败`
        }
      }
    }
  }
}

// 供编排器/冒烟测试复用的领域谓词与抽取器（AGGREGATE_READ_ACTIONS 导出供
// toolFace.unit.test.js 快照校验「只读 action 必须可路由且不要求 confirmed」）
export { isWriteTool, needsAutoConfirm, extractProofreadCard, summarizeToolResult, normalizeTodoList, AGGREGATE_READ_ACTIONS }
