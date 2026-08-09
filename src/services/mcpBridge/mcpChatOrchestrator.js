/**
 * In-page MCP chat orchestrator: merge multi-server tools, run tool loop.
 */
import { chatCompletionMessage } from '../../utils/chatApi.js'
import {
  CHAYUAN_SERVER_ID,
  getEnabledMcpServers,
  isChayuanToolAllowed,
  namespaceToolName,
  parseNamespacedTool
} from './mcpServerRegistry.js'
import {
  callLocalTool,
  callUpstreamTool,
  healthz,
  initializeLocal,
  listLocalTools,
  listUpstreamTools,
  syncUpstreamAllowlist
} from './mcpHttpClient.js'

const MAX_ROUNDS = 8

const WRITE_TOOL_RE = /^(document_replace|document_insert|document_apply_ops|document_add_comment|document_save|document_new|proofread_apply_comments)$/

function isWriteTool(serverId, toolName) {
  if (serverId === CHAYUAN_SERVER_ID) {
    if (toolName === 'proofread_run') return false
    return WRITE_TOOL_RE.test(toolName) || toolName.endsWith('_apply')
  }
  return false
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

function buildSystemPrompt({ selectionCtx, kbBound, proofreadIntent }) {
  const sel = selectionCtx || {}
  const hasSel = !!sel.hasSelection
  const lines = [
    '你是察元助手页内的文档智能体。通过 MCP 工具操作当前 WPS 文档与其它已配置的 HTTP MCP 服务。',
    '工具名带服务器前缀，格式 serverId__toolName（例如 chayuan__proofread_run）。调用时必须使用完整前缀名。',
    '优先使用 chayuan__ 文档/校对工具完成文档任务；可用 assistants_search / assistants_get 获取助手配方后再用 document_* 落文档。',
    '禁止调用 declassify_*。写文档前先 dryRun/预览；需要 confirmed=true 的写回交给用户确认，不要自行编造 confirmed=true。',
    '检查错别字：chayuan__proofread_run(dryRun:true) → 汇总 issues，等待用户选择「写成批注」或「直接改正正文」。',
    '修改/改正错别字：同样先 proofread_run(dryRun)，完成后说明将改正正文，不要只用批注交差。',
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

function toOpenAiTools(mergedTools) {
  return mergedTools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: String(t.description || '').slice(0, 1200),
      parameters: t.inputSchema || { type: 'object', properties: {} }
    }
  }))
}

function parseJsonToolCallFallback(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  const tryParse = (s) => {
    try {
      const obj = JSON.parse(s)
      if (obj && (obj.tool || obj.name) && (obj.arguments || obj.args || obj.params)) {
        return {
          id: `fallback_${Date.now()}`,
          type: 'function',
          function: {
            name: String(obj.tool || obj.name),
            arguments: JSON.stringify(obj.arguments || obj.args || obj.params || {})
          }
        }
      }
    } catch { /* ignore */ }
    return null
  }
  const direct = tryParse(raw)
  if (direct) return [direct]
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) {
    const one = tryParse(fence[1].trim())
    if (one) return [one]
  }
  const m = raw.match(/\{[\s\S]*"tool"\s*:[\s\S]*\}/)
  if (m) {
    const one = tryParse(m[0])
    if (one) return [one]
  }
  return null
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
  const sc = result?.structuredContent || result
  if (!sc || typeof sc !== 'object') return null
  const taskId = sc.taskId || sc.task_id || ''
  const issues = sc.issues || sc.items || sc.results || []
  const issueCount = Array.isArray(issues)
    ? issues.reduce((n, it) => n + (Array.isArray(it?.issues) ? it.issues.length : 1), 0)
    : Number(sc.issueCount || sc.count || 0)
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
 * @returns {Promise<{
 *   ok: boolean,
 *   fallback?: boolean,
 *   reason?: string,
 *   content?: string,
 *   steps?: Array,
 *   proofreadCard?: object|null,
 *   pendingConfirms?: Array,
 *   usedServers?: string[]
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
  confirmHandler
} = {}) {
  const steps = []
  const pushStep = (label, detail = '') => {
    const step = { at: Date.now(), label, detail }
    steps.push(step)
    onProgress?.(step, steps.slice())
  }

  const hz = await healthz({ signal })
  if (!hz.online) {
    return { ok: false, fallback: true, reason: 'sidecar_offline', steps }
  }

  const enabled = getEnabledMcpServers()
  if (!enabled.length) {
    return { ok: false, fallback: true, reason: 'no_servers', steps }
  }

  const mergedTools = []
  const toolMetaByName = new Map()
  const usedServers = []

  for (const server of enabled) {
    try {
      if (server.id === CHAYUAN_SERVER_ID) {
        await initializeLocal({ signal })
        const tools = await listLocalTools({ signal })
        for (const t of tools) {
          if (!isChayuanToolAllowed(t.name)) continue
          const name = namespaceToolName(CHAYUAN_SERVER_ID, t.name)
          const entry = {
            name,
            description: `[${server.name}] ${t.description || t.name}`,
            inputSchema: t.inputSchema || { type: 'object', properties: {} },
            annotations: t.annotations || {},
            serverId: CHAYUAN_SERVER_ID,
            toolName: t.name
          }
          mergedTools.push(entry)
          toolMetaByName.set(name, entry)
        }
        usedServers.push(CHAYUAN_SERVER_ID)
        pushStep('已连接察元 MCP', `${tools.length} 个工具（白名单后 ${mergedTools.filter(x => x.serverId === CHAYUAN_SERVER_ID).length}）`)
      } else {
        await syncUpstreamAllowlist({ signal })
        const tools = await listUpstreamTools(server.id, { signal })
        for (const t of tools) {
          const name = namespaceToolName(server.id, t.name)
          const entry = {
            name,
            description: `[${server.name}] ${t.description || t.name}`,
            inputSchema: t.inputSchema || { type: 'object', properties: {} },
            annotations: t.annotations || {},
            serverId: server.id,
            toolName: t.name
          }
          mergedTools.push(entry)
          toolMetaByName.set(name, entry)
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

  const proofreadIntent = inferProofreadIntent(userText)
  const system = buildSystemPrompt({ selectionCtx, kbBound, proofreadIntent })
  const messages = [
    { role: 'system', content: system },
    ...historyMessages.filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content).slice(-8),
    { role: 'user', content: String(userText || '') }
  ]

  const openaiTools = toOpenAiTools(mergedTools)
  let proofreadCard = null
  const pendingConfirms = []
  let toolsUnsupported = false

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    abortIf(signal)
    pushStep(`模型思考（第 ${round + 1} 轮）`, model?.name || model?.modelId || '')

    let assistantMsg
    try {
      const body = toolsUnsupported
        ? {
            providerId: model.providerId,
            modelId: model.modelId,
            ribbonModelId: model.id,
            messages: [
              ...messages,
              {
                role: 'system',
                content: '若需调用工具，请仅输出 JSON：{"tool":"serverId__toolName","arguments":{...}}，不要其它文字。'
              }
            ],
            signal
          }
        : {
            providerId: model.providerId,
            modelId: model.modelId,
            ribbonModelId: model.id,
            messages,
            tools: openaiTools,
            tool_choice: 'auto',
            signal
          }
      assistantMsg = await chatCompletionMessage(body)
    } catch (e) {
      const msg = e?.message || String(e)
      if (!toolsUnsupported && /tool|tools|function call|不支持/i.test(msg)) {
        toolsUnsupported = true
        pushStep('模型可能不支持 tools，改用 JSON 兼容层')
        round -= 1
        continue
      }
      return { ok: false, fallback: true, reason: 'model_error', content: msg, steps, usedServers }
    }

    let toolCalls = Array.isArray(assistantMsg.tool_calls) ? assistantMsg.tool_calls : []
    if (!toolCalls.length && toolsUnsupported) {
      const fb = parseJsonToolCallFallback(assistantMsg.content)
      if (fb) toolCalls = fb
    }

    if (!toolCalls.length) {
      return {
        ok: true,
        content: String(assistantMsg.content || '已完成。'),
        steps,
        proofreadCard,
        pendingConfirms,
        usedServers,
        proofreadIntent
      }
    }

    messages.push({
      role: 'assistant',
      content: assistantMsg.content || null,
      tool_calls: toolCalls
    })

    for (const call of toolCalls) {
      abortIf(signal)
      const nsName = call?.function?.name || call?.name || ''
      let args = {}
      try {
        args = JSON.parse(call?.function?.arguments || call?.arguments || '{}')
      } catch {
        args = {}
      }
      const { serverId, toolName } = parseNamespacedTool(nsName)
      const meta = toolMetaByName.get(nsName)
      pushStep(`调用 ${nsName}`, JSON.stringify(args).slice(0, 200))

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
            messages.push({
              role: 'tool',
              tool_call_id: call.id || nsName,
              content: JSON.stringify({ ok: false, error: 'USER_REJECTED', message: '用户拒绝执行该写操作' })
            })
            continue
          }
          args = { ...args, confirmed: true }
        } else {
          pendingConfirms.push({ serverId, toolName, namespacedName: nsName, args })
          messages.push({
            role: 'tool',
            tool_call_id: call.id || nsName,
            content: JSON.stringify({
              ok: false,
              error: 'CONFIRM_REQUIRED',
              message: '需要用户确认后才能执行写操作；请先汇总结果并等待确认。'
            })
          })
          continue
        }
      }

      try {
        let result
        if (serverId === CHAYUAN_SERVER_ID) {
          if (!isChayuanToolAllowed(toolName)) {
            throw Object.assign(new Error('TOOL_NOT_ALLOWED'), { code: 'TOOL_NOT_ALLOWED' })
          }
          result = await callLocalTool(toolName, args, { signal })
        } else {
          result = await callUpstreamTool(serverId, toolName, args, { signal })
        }
        const card = extractProofreadCard(toolName, args, result)
        if (card) {
          proofreadCard = {
            ...card,
            intent: proofreadIntent === 'unknown' ? 'check' : proofreadIntent
          }
        }
        const summary = summarizeToolResult(result)
        pushStep(`完成 ${nsName}`, summary.slice(0, 160))
        messages.push({
          role: 'tool',
          tool_call_id: call.id || nsName,
          content: summary
        })
      } catch (e) {
        pushStep(`失败 ${nsName}`, e.message || String(e))
        messages.push({
          role: 'tool',
          tool_call_id: call.id || nsName,
          content: JSON.stringify({ ok: false, error: e.code || 'TOOL_ERROR', message: e.message })
        })
      }
    }
  }

  return {
    ok: true,
    content: '已达到工具调用轮次上限，请根据上方步骤继续或重试。',
    steps,
    proofreadCard,
    pendingConfirms,
    usedServers,
    proofreadIntent
  }
}

function abortIf(signal) {
  if (signal?.aborted) {
    const err = new Error('已停止')
    err.name = 'AbortError'
    err.code = 'ABORTED'
    throw err
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
