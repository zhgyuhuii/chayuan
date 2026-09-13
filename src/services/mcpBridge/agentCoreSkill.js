/**
 * AgentSkill 适配层：把本项目的 MCP 工具目录（察元本机 + 上游 allowlist）
 * 包成 chayuan-office agent-core 的 AgentSkill。
 *
 * 旧 mcpChatOrchestrator 的领域语义原样保留：
 * - 写操作确认闸门（confirmed/dryRun 直通；否则 CONFIRM_REQUIRED/USER_REJECTED 回灌模型）
 * - proofread_run 长任务的实时进度透传（读 spell-check 活动任务）
 * - proofread_run 结果抽取为校对卡片（dryRun 预览 → 用户在卡片上落笔）
 */
import {
  CHAYUAN_SERVER_ID,
  isChayuanToolAllowed,
  parseNamespacedTool
} from './mcpServerRegistry.js'
import { callLocalTool, callUpstreamTool } from './mcpHttpClient.js'
import { getActiveTask } from '../../utils/taskListStore.js'

const WRITE_TOOL_RE = /^(document_replace|document_insert|document_apply_ops|document_save|document_new|proofread_apply_comments|format_run|format_para|format_apply_ops|comment|revision|layout|toc|table|image|hyperlink|headerfooter|watermark|style|export)$/

function isWriteTool(serverId, toolName) {
  if (serverId === CHAYUAN_SERVER_ID) {
    if (toolName === 'proofread_run') return false
    return WRITE_TOOL_RE.test(toolName) || toolName.endsWith('_apply')
  }
  return false
}

/** 客户端 todo 工具：不落 sidecar，只经 onTodoWrite 回调透出给消息卡渲染 */
const TODO_WRITE_TOOL = {
  name: 'todo_write',
  description: '维护本轮任务清单（整表替换式更新）。当请求包含 ≥2 个可独立交付的子任务或明确多步流程时，先调用它写入全部计划；开始某项前将其置 in_progress，完成后立即置 completed；同一时刻至多一项 in_progress。单一简单请求不要使用。',
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

// 上游工具只读启发式：绝大多数 MCP 服务器不设置 annotations.readOnlyHint，
// 若只认注解则常规上游的读工具也一律 CONFIRM_REQUIRED（永远走不通）。
// 注解优先；缺注解时按名字前缀判定读类工具。
const UPSTREAM_READONLY_NAME_RE = /^(read|get|list|search|query|find|fetch|describe|health|status|ping)/i

function isUpstreamToolReadOnly(toolName, toolMeta) {
  const hint = toolMeta?.annotations?.readOnlyHint
  if (hint === true) return true
  if (hint === false) return false
  return UPSTREAM_READONLY_NAME_RE.test(String(toolName || ''))
}

/**
 * 写/敏感操作确认闸门。铁律：args.confirmed 在 executeTool 入口已被剥除，
 * 模型入参携带的 confirmed 不参与本判定——是否 confirmed 完全由前端权限层
 * （confirmHandler 批准后注入）决定，模型永远绕不过。
 */
function toolNeedsConfirm(serverId, toolName, toolMeta, args) {
  if (serverId === CHAYUAN_SERVER_ID) {
    if (toolName === 'proofread_apply_comments') return true
    // dryRun 预览直通；写操作一律需确认
    return isWriteTool(serverId, toolName) && args?.dryRun !== true
  }
  return !isUpstreamToolReadOnly(toolName, toolMeta)
}

function summarizeToolResult(result) {
  try {
    const sc = result?.structuredContent || result?.content || result
    const text = typeof sc === 'string' ? sc : JSON.stringify(sc)
    return text.length > 6000 ? `${text.slice(0, 6000)}…(truncated)` : text
  } catch {
    return String(result)
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

/** 无 function-calling 模型的 JSON 文本协议（loop 会解析该格式的伪工具调用） */
const DEGRADED_SYSTEM_SUFFIX = [
  '若需调用工具，仅输出一个 JSON 对象（需连续调用多个工具时输出 JSON 数组）：',
  '{"tool":"serverId__toolName","arguments":{…}}',
  '不要输出 JSON 以外的任何文字；工具执行结果会以 [Tool result: …] 消息返回给你。',
  '任务完成或需要向用户说明时，直接用普通文字回答，不要输出 JSON。',
  '写操作需 confirmed:true 的，交给用户确认，不要自行编造 confirmed=true。'
].join('\n')

/**
 * @param {object} opts
 * @param {string} opts.systemPrompt - 编排器拼好的领域系统提示词
 * @param {Array} opts.mergedTools - 已合并（namespaced）的工具目录条目
 * @param {(info: object) => void} [opts.pushProgress] - 长任务实时进度
 * @param {(card: object) => void} [opts.onProofreadCard] - proofread_run 结果卡片
 * @param {(todos: Array) => void} [opts.onTodoWrite] - todo_write 客户端工具的清单透出
 * @param {Function} [opts.confirmHandler] - 写操作确认回调；不传则回灌 CONFIRM_REQUIRED
 * @param {Array} [opts.pendingConfirms] - 收集待确认项的数组（编排器透出）
 * @param {string} [opts.writeBaselineToken] - 回合 OCC 基线 token；随写工具参数
 *   透传到加载项 dispatch 层，供写锁按回合隔离校验（__baselineToken 为保留字段）
 */
export function createMcpDocumentSkill({
  systemPrompt,
  mergedTools,
  pushProgress,
  onProofreadCard,
  onTodoWrite,
  confirmHandler,
  pendingConfirms = [],
  writeBaselineToken = ''
} = {}) {
  const toolMetaByName = new Map()
  for (const t of mergedTools || []) toolMetaByName.set(t.name, t)
  // 本回合成功落笔的写操作数（按 ops 条目计），供 verifyResponse 与末轮声称核对
  let executedWriteOps = 0
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
      ...(mergedTools || []).map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema || { type: 'object', properties: {} }
      }))
    ],
    buildContext: () => '',
    degradedFallback: () => ({ systemSuffix: DEGRADED_SYSTEM_SUFFIX }),
    /**
     * 声称核对（loop 预留钩子，PR7 接通）：末轮文本声明「已替换/改正/删除 N 处」
     * 而实际成功写操作数不足时，强制追加一轮纠偏——谎报被拦，模型要么补齐操作
     * 要么修正总结。只对明确数量声明生效（正则限界），避免误伤泛泛表述。
     */
    verifyResponse(finalText, executed) {
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
      if (call?.name === TODO_WRITE_TOOL.name) {
        const todos = normalizeTodoList(call?.input?.todos)
        onTodoWrite?.(todos)
        const done = todos.filter(t => t.status === 'completed').length
        return {
          output: JSON.stringify({ ok: true, total: todos.length, done }),
          summary: `任务清单已更新（${done}/${todos.length} 完成）`
        }
      }
      const nsName = call.name
      const { serverId, toolName } = parseNamespacedTool(nsName)
      const meta = toolMetaByName.get(nsName)
      const args = call.input && typeof call.input === 'object' && !Array.isArray(call.input)
        ? { ...call.input }
        : {}
      // 铁律：confirmed 只能由前端权限层注入。模型入参里的 confirmed 一律剥除——
      // sidecar 工具示例会教模型带 confirmed:true（外部智能体的 preview→commit
      // 协议），不剥除则确认闸门可被入参直接绕过（H1）。
      delete args.confirmed

      if (toolNeedsConfirm(serverId, toolName, meta, args)) {
        if (typeof confirmHandler === 'function') {
          const approved = await confirmHandler({
            serverId,
            toolName,
            namespacedName: nsName,
            args,
            meta,
            signal
          })
          if (!approved) {
            return {
              output: JSON.stringify({ ok: false, error: 'USER_REJECTED', message: '用户拒绝执行该写操作' }),
              isError: true,
              summary: `${nsName} 已被用户拒绝`
            }
          }
          args.confirmed = true
        } else {
          pendingConfirms.push({ serverId, toolName, namespacedName: nsName, args })
          return {
            output: JSON.stringify({
              ok: false,
              error: 'CONFIRM_REQUIRED',
              message: '需要用户确认后才能执行写操作；请先汇总结果并等待确认。'
            }),
            isError: true,
            summary: `${nsName} 等待用户确认`
          }
        }
      }

      try {
        let result
        if (serverId === CHAYUAN_SERVER_ID) {
          if (!isChayuanToolAllowed(toolName)) {
            throw Object.assign(new Error('TOOL_NOT_ALLOWED'), { code: 'TOOL_NOT_ALLOWED' })
          }
          // 写工具带上回合 OCC 基线 token（__baselineToken 为保留字段，dispatch 层
          // 弹出后用于 withDocumentWriteLock 校验，不会进入真实 WPS 调用参数）
          if (writeBaselineToken && isWriteTool(serverId, toolName)) {
            args.__baselineToken = writeBaselineToken
          }
          if (toolName === 'proofread_run') {
            result = await callLocalToolWithProofreadProgress(toolName, args, { signal, pushProgress })
          } else {
            result = await callLocalTool(toolName, args, { signal })
          }
        } else {
          result = await callUpstreamTool(serverId, toolName, args, { signal })
        }
        const card = extractProofreadCard(toolName, args, result)
        if (card) onProofreadCard?.(card)
        const output = summarizeToolResult(result)
        const mutated = !result?.isError && isWriteTool(serverId, toolName)
        if (mutated) executedWriteOps += countWriteOps(toolName, args, result)
        return {
          output,
          summary: output.slice(0, 120) || nsName,
          // 写工具成功落笔才视为变更：退避守卫据此豁免「重复相同写操作」的熔断
          mutated
        }
      } catch (e) {
        return {
          output: JSON.stringify({ ok: false, error: e?.code || 'TOOL_ERROR', message: e?.message || String(e) }),
          isError: true,
          summary: `${nsName} 失败`
        }
      }
    }
  }
}

// 供编排器/冒烟测试复用的领域谓词与抽取器
export { isWriteTool, toolNeedsConfirm, isUpstreamToolReadOnly, extractProofreadCard, summarizeToolResult, normalizeTodoList }
