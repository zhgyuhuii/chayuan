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
  setWriteBaseline,
  getWriteBaseline
} from '../documentWriteLock.js'
import { setChatApiConfigOverride } from '../../utils/chatApi.js'
import { logEvent } from '../../utils/globalErrorLogger.js'

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

function runDetachedTurn(params = {}) {
  const turnId = String(params.turnId || '').trim()
  const scopeKey = String(params.scopeKey || '')
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null

  // OCC 基线必须在执行侧（本 webview）建立：写锁校验读的是本进程模块内的
  // baselines Map，面板侧的基线跨不过 webview 边界
  const writeBaselineToken = `mcp-remote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  setWriteBaseline(undefined, undefined, writeBaselineToken)
  const targetDocumentId = getWriteBaseline(writeBaselineToken).docId

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
    todos: [],
    content: '',
    loopMessages: [],
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
      const result = await runMcpChatOrchestrator({
        userText: String(params.userText || ''),
        model,
        selectionCtx: params.selectionCtx || null,
        kbBound: !!params.kbBound,
        historyMessages: Array.isArray(params.historyMessages) ? params.historyMessages : [],
        previousTodos: Array.isArray(params.previousTodos) ? params.previousTodos : [],
        writeBaselineToken,
        targetDocumentId,
        loopHistory: Array.isArray(params.loopHistory) ? params.loopHistory : [],
        signal: ctrl?.signal,
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
        onTodos: (todos) => {
          entry.lastProgressAt = Date.now()
          state.todos = Array.isArray(todos) ? todos.slice() : []
          entry.dirty = true
        }
        // onSnapshot 有意不透传：写前快照可达 200KB，进 PluginStorage 会挤爆配额；
        // 撤销卡在远程回合降级为不可用（面板本地回合仍保留完整快照）
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
        usedServers: result?.usedServers || []
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
