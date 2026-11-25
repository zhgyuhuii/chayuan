/**
 * 聊天回合托管 runner（AI助手对话跟随文档）。
 *
 * 面板页（/ai-assistant 任务窗格）在文档切换时会被 WPS 强制重挂载（2026-09-30
 * 真机实验证实，全仓无自发起 reload），生成循环跟着面板死。本模块把「运行一个
 * MCP 聊天回合」搬进 ribbon 基座 webview（windowId=ribbon@#/，跨切换存活的唯一
 * JS 上下文）：面板经 sidecar chat_turn 工具派发（ack 模式），这里 detached 执行
 * 完整编排循环，进度/结果写穿 PluginStorage 共享键（加载项级，ribbon 与面板共享），
 * 面板任意次重挂载后按 turnId 恢复观察——切走十分钟，切回来生成已完成。
 *
 * 共享键协议（PluginStorage，值均为 JSON 字符串）：
 *   ai_chat_turn:<turnId>          回合状态 {phase, steps, streamText, todos, content...}
 *   ai_chat_turn_cancel:<turnId>   '1' = 请求取消（面板写，心跳循环消费）
 *   ai_chat_pending:<scopeKey>     进行中回合指针（面板/runner 写，面板终态合并后清除）
 *
 * ack 契约：handleChatTurn 立即返回 {ok, accepted, turnId}；accepted=false 表示
 * 基座忙（并发上限），面板回落本地循环。循环内工具调用经 sidecar→agentHub 回到
 * 本 webview 的 dispatch 队列（与本地回合同一条通道），写锁/OCC 语义零改动。
 */

import { runMcpChatOrchestrator } from './mcpChatOrchestrator.js'
import {
  setWriteBaseline
} from '../documentWriteLock.js'
import { setChatApiConfigOverride } from '../../utils/chatApi.js'
import { shouldDisableThinking } from '../../utils/assistantAgentDispatch.js'
import { callLocalTool } from './mcpHttpClient.js'
import { resolveBoundDocument } from '../../utils/chat/docTarget.js'
import { setAssistantKbBindingGetter, readAssistantKbBinding } from '../../utils/assistant/kbAssistantBinding.js'
import { logEvent } from '../../utils/globalErrorLogger.js'
import * as directGeneration from './directGeneration.js'

const TURN_KEY_PREFIX = 'ai_chat_turn:'
const CANCEL_KEY_PREFIX = 'ai_chat_turn_cancel:'
const PENDING_KEY_PREFIX = 'ai_chat_pending:'

const TICK_MS = 1000
// 进展看门狗：超过该时长没有任何回调进展（流块/步骤/清单）→ abort 回合。
// 覆盖 LLM 流挂起与任何卡死——面板会按终态显示中断+重试。
const STALL_TIMEOUT_MS = 180_000
// 状态体上限：streamText/loopMessages 之外的字段都很小；loopMessages 编排器侧
// 已按 24KB 裁剪（trimLoopHistoryForStorage），这里只防 streamText 与 steps 失控
const STREAM_TEXT_MAX_CHARS = 16_000
const STEPS_MAX_ITEMS = 40

/**
 * 节流免疫 ticker：Web Worker 的定时器不受页面隐藏节流影响（面板打开后基座
 * webview 被 CEF 判为后台，页面 setInterval/setTimeout 会被钳到 ≥1s 甚至冻结，
 * 实测导致心跳停摆、LLM 空闲超时定时器永不触发、回合永久挂起）。Worker 创建
 * 失败（极端环境）回退页面 setInterval——聊胜于无。
 */
function createTicker(ms, onTick) {
  try {
    const src = `let t=null;onmessage=(e)=>{if(e.data==='start'&&!t){t=setInterval(()=>postMessage(0),${Math.max(200, ms)})}if(e.data==='stop'&&t){clearInterval(t);t=null}}`
    const worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })))
    worker.onmessage = onTick
    worker.postMessage('start')
    return { stop: () => { try { worker.postMessage('stop'); worker.terminate() } catch (_) { /* 已终止 */ } } }
  } catch (_) {
    const timer = setInterval(onTick, ms)
    return { stop: () => clearInterval(timer) }
  }
}

// 并发上限：ribbon 基座同时托管的回合数（多文档并行生成的保护阀；超限面板回落本地）
const MAX_CONCURRENT_TURNS = 2

/** turnId → { ctrl, timers:[], state } */
const activeTurns = new Map()


function storage() {
  try {
    return window.Application?.PluginStorage || null
  } catch (_) {
    return null
  }
}

function writeTurnState(turnId, state) {
  try {
    storage()?.setItem(TURN_KEY_PREFIX + String(turnId), JSON.stringify(state))
  } catch (_) { /* 配额满/存储不可用时进度丢失，终态由 finally 兜底再试 */ }
}

function scopeHostType() {
  try {
    const app = window.Application
    if (app?.Workbooks) return 'et'
    if (app?.Presentations) return 'wpp'
  } catch (_) { /* probe 失败按 wps */ }
  return 'wps'
}

/**
 * 接单入口（dispatch.js 的 'chat.turn' handler）。
 * 立即返回，循环 detached——绝不 await 编排器。
 */
export function handleChatTurn(params = {}) {
  const turnId = String(params.turnId || '').trim()
  if (!turnId) return { ok: true, accepted: false, code: 'INVALID_PARAMS' }
  if (activeTurns.has(turnId)) {
    return { ok: true, accepted: true, turnId, alreadyRunning: true }
  }
  if (activeTurns.size >= MAX_CONCURRENT_TURNS) {
    return { ok: true, accepted: false, code: 'CHAT_TURN_BUSY', turnId }
  }
  try {
    runDetachedTurn(params)
    return { ok: true, accepted: true, turnId }
  } catch (e) {
    logEvent('chat_turn_spawn_error', { turnId, message: String(e?.message || e).slice(0, 200) })
    return { ok: true, accepted: false, code: 'CHAT_TURN_SPAWN_FAILED' }
  }
}

/** 取消入口（dispatch.js 的 'chat.turn_cancel' handler） */
export function cancelChatTurn(params = {}) {
  const turnId = String(params.turnId || '').trim()
  const entry = activeTurns.get(turnId)
  if (!entry) return { ok: true, cancelled: false, reason: 'not_running' }
  try {
    entry.ctrl?.abort?.()
  } catch (_) { /* ignore */ }
  return { ok: true, cancelled: true, turnId }
}

/**
 * 生成意图直出轨（genoffice doc-writer 同款架构，2026-11-21 提速）：
 * 「写一篇…」类任务不走 agent 循环——一次【无工具流式请求】产出全文，流完一次
 * 写入落盘。生成核心抽在 directGeneration.js（2026-11-25 起：面板本地回合与
 * 远程 chat_turn 共用同一条直出实现，行为一致）。
 */
const isGenerationIntent = directGeneration.isGenerationIntent

/**
 * 直出生成回合。返回 true = 已接管本回合（finish 已调用）；false = 不适配，落回 agent 轨。
 */
async function tryRunDirectGenerationTurn({ params, state, entry, finish, model, userText, signal, scopeKey, targetDocumentId, thinkingEnabled = false }) {
  // targetDocumentId = 会话绑定文档身份（runDetachedTurn 绑定解析产物）——直出写入
  // 的 __expectedDocId pin（Model S：绑定≠活动也写对文档）。缺失时退活动文档语义。
  try {
    const step = (label, detail = '') => {
      state.steps.push({ at: Date.now(), label, detail })
      entry.dirty = true
    }
    step('生成直出（单次调用，边写边出）', String(userText || '').slice(0, 120))

    let reasoningAcc = ''
    const { content } = await generateDirectContent({
      userText,
      historyMessages: params.historyMessages,
      model,
      signal,
      thinkingEnabled,
      // 流文本只改内存：ticker 的 %2 稳态路径每 2s 落盘一次——逐 delta 置脏会
      // 把 PluginStorage 写穿频率翻倍（COM 写主进程争用）
      onText: (acc) => {
        state.streamText = acc
        entry.lastProgressAt = Date.now()
      },
      // 思考增量：累计进 state.thinkingText（内存，随 ticker 稳态落盘），面板实时显示
      onReasoning: (delta) => {
        reasoningAcc += delta
        state.thinkingText = reasoningAcc.length > 60000 ? reasoningAcc.slice(-40000) : reasoningAcc
        entry.lastProgressAt = Date.now()
      }
    })
    step('写入文档（一次落盘）', `${content.length} 字`)
    // 撤销快照（写前采集，只读 COM 安全——文件级 Save+copy 曾三崩 WPS 已废除）：
    // 读绑定文档全文（≤80K，超大文档快照失败→撤销卡不可用但写入照常），
    // 经 finish 只随终态写一次（不进逐拍轮询，避免大载荷写穿）
    let preText = ''
    try {
      const snapRes = await callLocalTool('document.get_text', targetDocumentId ? { __expectedDocId: targetDocumentId } : {}, { signal, timeoutMs: 60000 })
      preText = String(snapRes?.structuredContent?.text || '')
    } catch (_) { preText = '' }
    let writeNote = '已直出写入文档（单次生成，可用下方撤销卡回滚）。'
    try {
      await callLocalTool('document_insert', {
        text: content,
        position: 'append',
        confirmed: true,
        title: '察元AI 写作',
        ...(targetDocumentId ? { __expectedDocId: targetDocumentId } : {})
      }, { signal, timeoutMs: 180000 })
    } catch (e) {
      const reason = String(e?.code || '') + ' ' + String(e?.message || '')
      finish('done', { content: `${content}\n\n— 写入未完成（${reason.slice(0, 120)}）：正文保留在上方，可直接复制到文档。` })
      return true
    }
    // 确定性后处理（零模型轮次，2026-11-21「整体思路」裁决）：指令点名的能力直接
    // 映射工具调用——正文归大模型直出，目录域/样式归工具。这是「直接输出」与
    // 「文档对象操作」的分工边界：模型决定「写什么」，代码决定「怎么落」。
    if (/目录/.test(String(userText || ''))) {
      let boundActive = false
      try {
        const bound = resolveBoundDocument({
          docLinkId: String(params.docLinkId || ''),
          docId: String(params.docId || '')
        })
        boundActive = !!(bound.ok && bound.isActive)
      } catch (_) { boundActive = false }
      if (boundActive) {
        step('插入自动目录域（确定性后处理，无模型轮次）', '')
        try {
          await callLocalTool('toc_insert', {
            confirmed: true,
            upperLevel: 1,
            lowerLevel: 2,
            title: '目录'
          }, { signal, timeoutMs: 60000 })
          writeNote = '已直出写入文档 + 插入自动目录域（可随页码刷新）。'
        } catch (e2) {
          state.steps.push({ at: Date.now(), label: '目录域插入失败（正文已写入，正文中含目录列表）', detail: String(e2?.message || e2).slice(0, 120) })
        }
      } else {
        writeNote = '已直出写入文档。目录域需要文档在前台——切到该文档后对模型说「刷新目录」即可补插。'
      }
    }
    finish('done', {
      content: `${content}\n\n— ${writeNote}`,
      ...(preText && targetDocumentId ? { snapshot: { docId: targetDocumentId, text: preText } } : {})
    })
    return true
  } catch (e) {
    if (e?.name === 'AbortError') {
      finish('cancelled', {})
      return true
    }
    // 直出失败（模型/网络）：落回 agent 轨重跑一次
    logEvent('chat_turn_direct_gen_fallback', { turnId: state.turnId, message: String(e?.message || e).slice(0, 200) })
    return false
  }
}

function runDetachedTurn(params = {}) {
  const turnId = String(params.turnId || '').trim()
  const scopeKey = String(params.scopeKey || '')
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null

  // KB 绑定双保险：回合参数直传的绑定优先，共享存储兜底（面板发布）。基座托管
  // 回合里的 kb 检索工具经本 getter 取绑定，任一通道可用即不再误报「未绑定」
  const turnKbBinding = params.kbBinding && Array.isArray(params.kbBinding.kbNames) && params.kbBinding.kbNames.length
    ? params.kbBinding
    : null
  setAssistantKbBindingGetter(() => turnKbBinding || readAssistantKbBinding())

  // OCC 基线必须在执行侧（本 webview）建立：写锁校验读的是本进程模块内的
  // baselines Map，面板侧的基线跨不过 webview 边界
  const writeBaselineToken = `mcp-remote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  setWriteBaseline(undefined, undefined, writeBaselineToken)

  // Model S 绑定解析（plans/Model S 共识定稿 Q4/Q7）：绑定文档「在打开集合里可解析」
  // 即执行——非活动允许（写工具走 S2 对象模型静默路径，焦点零打扰）；解析不到 =
  // 孤儿会话 → DOC_NOT_OPEN 终态，面板据此给「重开/改绑」出路。旧 checkDocBinding
  // 的「活动文档比对拒执行」废弃——切走文档不再误杀回合（2026-11-21 写回失败根因链）。
  const bound = resolveBoundDocument({
    docLinkId: String(params.docLinkId || ''),
    docId: String(params.docId || '')
  })
  const targetDocumentId = bound.ok ? String(bound.fullName || bound.name || '') : ''
  if (!bound.ok) {
    // Q7 裁决：孤儿会话不硬失败整个回合——纯问答放行（模型只用对话历史），
    // 写/读类工具由 dispatch 门逐个 DOC_NOT_OPEN，模型据此如实向用户说明。
    // 面板侧胶囊「已关闭」态常驻「重开/改绑」出路（发前可见）。
    logEvent('chat_turn_doc_not_open', {
      turnId,
      requested: params.docId,
      docLinkId: params.docLinkId || '',
      note: 'orphan-chat: proceed without doc pin; write tools will DOC_NOT_OPEN'
    })
  }

  // 远程回合的模型 API 配置由面板随参数带来（面板已按用户选择解析好）——
  // ribbon webview 的 localStorage 不保证与面板一致，不能在本侧再解析一次
  const model = params.model && typeof params.model === 'object' ? params.model : null
  if (model?.providerId && model?.apiUrl) {
    setChatApiConfigOverride(model.providerId, { apiKey: model.apiKey, apiUrl: model.apiUrl })
  }

  const state = {
    turnId,
    scopeKey,
    phase: 'running',
    steps: [],
    streamText: '',
    // 思考流（🧠 开启时 reasoning_content 增量累计）：面板 watch 循环实时渲染到思考卡
    thinkingText: '',
    todos: [],
    content: '',
    loopMessages: [],
    toolDisplays: [],
    proofreadCard: null,
    usedServers: [],
    startedAt: Date.now(),
    updatedAt: Date.now(),
    finishedAt: 0
  }
  const entry = { ctrl, state, timers: [], dirty: true }
  activeTurns.set(turnId, entry)

  // 声明本 scope 的进行中指针：面板在派发后重挂载也能找回回合
  try {
    if (scopeKey) storage()?.setItem(PENDING_KEY_PREFIX + scopeKey, turnId)
  } catch (_) { /* ignore */ }
  writeTurnState(turnId, state)

  // 节流免疫 ticker：心跳（2s/跳）+ 取消消费 + 看门狗，页面被 CEF 节流也照跳。
  // 每 tick 都写心跳（state.updatedAt），每 2 tick 落一次脏状态（≈节流写穿）。
  entry.lastProgressAt = Date.now()
  const tickers = createTicker(TICK_MS, () => {
    try {
      entry.tickCount = (entry.tickCount || 0) + 1
      if (storage()?.getItem(CANCEL_KEY_PREFIX + turnId) === '1') {
        storage()?.removeItem(CANCEL_KEY_PREFIX + turnId)
        ctrl?.abort?.()
      }
      // 进展看门狗：orchestrator 任一回调（onProgress/onTurnText/onTodos）都会刷
      // lastProgressAt；超时说明 LLM 流挂起或循环卡死——abort 让 AgentLoop 收尾，
      // catch 分支写终态，面板立即显示中断而不是永远 40%。
      if (state.phase === 'running' && Date.now() - entry.lastProgressAt > STALL_TIMEOUT_MS) {
        ctrl?.abort?.()
      }
      state.updatedAt = Date.now()
      if (entry.dirty || entry.tickCount % 2 === 0) {
        entry.dirty = false
        writeTurnState(turnId, state)
      }
    } catch (_) { /* ticker 异常不连累回合 */ }
  })
  entry.timers.push(tickers)

  const finish = (phase, extra = {}) => {
    for (const t of entry.timers) { try { t.stop?.() } catch (_) { /* ignore */ } }
    state.phase = phase
    state.finishedAt = Date.now()
    state.updatedAt = Date.now()
    Object.assign(state, extra)
    writeTurnState(turnId, state)
    activeTurns.delete(turnId)
    logEvent('chat_turn_done', {
      turnId,
      phase,
      ms: state.finishedAt - state.startedAt,
      host: scopeHostType()
    })
  }

  // detached 执行（async IIFE）：ack 已先行返回，这里的生命周期与 dispatch 无关
  ;(async () => {
    let mcpStreamAt = 0
    try {
      // 生成意图直出轨（genoffice 同款：一次无工具流式调用产出全文）——失败落回 agent 轨。
      // 宿主守卫（2026-11-25）：直出的写回是 document_insert（Writer 语义，agentHub 按
      // document.* 前缀固定路由 wps 宿主）——ET/WPP 宿主直出会把内容写进文字宿主的
      // 另一篇文档或报无文档，必须只在 wps 宿主启用。
      if (
        String(params.host || 'wps') === 'wps' &&
        isGenerationIntent(String(params.userText || '')) &&
        !(params.selectionCtx && params.selectionCtx.hasSelection) &&
        !params.kbBound &&
        !String(params.attachmentCtx || '') &&
        // 附加了技能必须走 agent 轨——直出分支不消费技能块，静默丢弃等于技能
        // 完全不生效（2026-11-25 审计 F7）。有技能时落 agent 轨由系统提示词兑现技能
        !(Array.isArray(params.attachedSkills) && params.attachedSkills.length)
      ) {
        const handled = await tryRunDirectGenerationTurn({
          params, state, entry, finish,
          model,
          userText: String(params.userText || ''),
          signal: ctrl?.signal,
          scopeKey,
          targetDocumentId,
          thinkingEnabled: params.thinkingEnabled === true
        })
        if (handled) return
      }
      let turnSnapshot = null
      let agentReasoningAcc = ''
      const result = await runMcpChatOrchestrator({
        userText: String(params.userText || ''),
        model,
        // 视觉输入（面板附件图片，≤2 张，面板侧把关大小）——直连内存参数不进状态体
        images: Array.isArray(params.images) ? params.images : [],
        // ToolDisplay 增量（生图完成即上屏）：写入共享状态供面板轮询拾取。
        // state 不带 full（原图 dataURL 动辄数 MB，逐拍写穿会压垮 PluginStorage）——
        // 面板轮询期用 thumb 显示；full 随【终态一次】载荷透传（同样有体积闸）
        onToolDisplay: (d) => {
          try {
            if (!d || d.kind !== 'images' || !Array.isArray(d.items)) return
            const items = d.items.map(({ url, title, thumb }) => ({ url, title, ...(thumb ? { thumb } : {}) }))
            state.toolDisplays = [...(Array.isArray(state.toolDisplays) ? state.toolDisplays : []), { tool: '', kind: 'images', items }]
            entry.dirty = true
          } catch (_) { /* ignore */ }
        },
        selectionCtx: params.selectionCtx || null,
        attachmentCtx: String(params.attachmentCtx || ''),
        kbBound: !!params.kbBound,
        kbBinding: turnKbBinding,
        historyMessages: Array.isArray(params.historyMessages) ? params.historyMessages : [],
        previousTodos: Array.isArray(params.previousTodos) ? params.previousTodos : [],
        // 附加技能：面板已按上限整形（≤4 个、单条 ≤16KB），这里防御式再滤一遍空条目
        attachedSkills: Array.isArray(params.attachedSkills)
          ? params.attachedSkills.filter(s => s && s.name && s.body)
          : [],
        writeBaselineToken,
        targetDocLinkId: String(params.docLinkId || bound.docLinkId || ''),
        targetDocumentId,
        loopHistory: Array.isArray(params.loopHistory) ? params.loopHistory : [],
        signal: ctrl?.signal,
        // 思考模式开关（2026-11-24）：🧠 开启 → 保持模型思考并把推理流透传到思考卡；
        // 关闭 → 智谱系快答。此前 runner 不接开关也不接 onTurnReasoning，
        // 远程回合的思考卡永远空（「开了思考模式卡片不显示」根因）
        thinkingDisabled: shouldDisableThinking(model?.providerId, model?.apiUrl, params.thinkingEnabled === true),
        onProgress: (step, steps) => {
          entry.lastProgressAt = Date.now()
          state.steps = (steps || []).slice(-STEPS_MAX_ITEMS)
          entry.dirty = true
        },
        onTurnText: (text) => {
          const t = String(text || '')
          if (!t) return
          entry.lastProgressAt = Date.now()
          const now = Date.now()
          if (now - mcpStreamAt < 100) return
          mcpStreamAt = now
          state.streamText = t.length > STREAM_TEXT_MAX_CHARS ? t.slice(-STREAM_TEXT_MAX_CHARS) : t
          entry.dirty = true
        },
        onTurnReasoning: (text) => {
          const r = String(text || '')
          if (!r) return
          entry.lastProgressAt = Date.now()
          agentReasoningAcc = agentReasoningAcc.length > 60000 ? agentReasoningAcc.slice(-40000) + r : agentReasoningAcc + r
          state.thinkingText = agentReasoningAcc
          entry.dirty = true
        },
        onTodos: (todos) => {
          entry.lastProgressAt = Date.now()
          state.todos = Array.isArray(todos) ? todos.slice() : []
          entry.dirty = true
        },
        // onSnapshot：仅内存捕获，随【终态一次】透传（不进逐拍写穿——快照可达 200KB，
        // 逐拍写会挤爆 PluginStorage 配额；终态单次写无此问题）。撤销卡在远程回合
        // 从「降级不可用」升级为可用（2026-11-21）
        onSnapshot: (snap) => {
          if (snap && String(snap.text || '')) turnSnapshot = snap
        }
      })

      if (result?.fallback) {
        finish('error', {
          content: String(result.content || '模型调用失败'),
          reason: String(result.reason || 'model_error'),
          steps: result.steps || state.steps,
          todos: result.todos || state.todos,
          usedServers: result.usedServers || []
        })
        return
      }
      finish('done', {
        content: String(result?.content || ''),
        steps: result?.steps || state.steps,
        todos: result?.todos || state.todos,
        loopMessages: Array.isArray(result?.loopMessages) ? result.loopMessages : [],
        proofreadCard: result?.proofreadCard || null,
        usedServers: result?.usedServers || [],
        // ToolDisplay 侧信道（生图/搜图缩略图等）：终态一次透传给面板消息卡。
        // full（原图 dataURL）单条 ≤3MB 才透传（终态一次性写，防状态体被大图撑爆）
        ...(Array.isArray(result?.toolDisplays) && result.toolDisplays.length
          ? {
              toolDisplays: result.toolDisplays.map((d) => ({
                ...d,
                items: Array.isArray(d?.items)
                  ? d.items.map(({ url, title, thumb, full }) => ({ url, title, ...(thumb ? { thumb } : {}), ...(full && full.length <= 3_000_000 ? { full } : {}) }))
                  : d.items
              }))
            }
          : {}),
        // 撤销快照：终态一次透传（写前文本，撤销 v3 收敛依据）
        ...(turnSnapshot && String(turnSnapshot.text || '') ? { snapshot: turnSnapshot } : {})
      })
    } catch (e) {
      const aborted = ctrl?.signal?.aborted || e?.name === 'AbortError'
      finish(aborted ? 'cancelled' : 'error', {
        content: aborted ? '已停止生成' : String(e?.message || e),
        reason: aborted ? 'cancelled' : 'exception'
      })
    }
  })()
}
