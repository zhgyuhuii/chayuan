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

function toolNeedsConfirm(serverId, toolName, toolMeta, args) {
  if (serverId === CHAYUAN_SERVER_ID) {
    if (toolName === 'proofread_apply_comments') return true
    if (isWriteTool(serverId, toolName) && args?.confirmed !== true && args?.dryRun !== true) {
      // allow dryRun / preview paths through; confirmed writes blocked for UI confirm
      if (args && Object.prototype.hasOwnProperty.call(args, 'confirmed') && args.confirmed !== true) {
        return true
      }
      if (WRITE_TOOL_RE.test(toolName)) return true
    }
    return false
  }
  if (toolMeta?.annotations?.readOnlyHint === true) return false
  return true
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
 */
export function createMcpDocumentSkill({
  systemPrompt,
  mergedTools,
  pushProgress,
  onProofreadCard,
  onTodoWrite,
  confirmHandler,
  pendingConfirms = []
} = {}) {
  const toolMetaByName = new Map()
  for (const t of mergedTools || []) toolMetaByName.set(t.name, t)
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

      if (toolNeedsConfirm(serverId, toolName, meta, args)) {
        if (typeof confirmHandler === 'function') {
          const approved = await confirmHandler({
            serverId,
            toolName,
            namespacedName: nsName,
            args,
            meta
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
        return {
          output,
          summary: output.slice(0, 120) || nsName,
          // 写工具成功落笔才视为变更：退避守卫据此豁免「重复相同写操作」的熔断
          mutated: !result?.isError && isWriteTool(serverId, toolName)
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
export { isWriteTool, toolNeedsConfirm, extractProofreadCard, summarizeToolResult, normalizeTodoList }
