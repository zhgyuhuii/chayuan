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

const HEARTBEAT_MS = 2000
const FLUSH_INTERVAL_MS = 300
// 状态体上限：streamText/loopMessages 之外的字段都很小；loopMessages 编排器侧
// 已按 24KB 裁剪（trimLoopHistoryForStorage），这里只防 streamText 与 steps 失控
const STREAM_TEXT_MAX_CHARS = 16_000
const STEPS_MAX_ITEMS = 40

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

  // 进度节流写穿：回调只标脏，300ms flusher 统一落盘（PluginStorage 高频写保护）
  const flusher = setInterval(() => {
    if (!entry.dirty) return
    entry.dirty = false
    state.updatedAt = Date.now()
    writeTurnState(turnId, state)
  }, FLUSH_INTERVAL_MS)
  // 心跳 + 取消消费：面板以 updatedAt 判活（>10s 视为执行侧死亡 → 显示中断）
  const heartbeat = setInterval(() => {
    try {
      if (storage()?.getItem(CANCEL_KEY_PREFIX + turnId) === '1') {
        storage()?.removeItem(CANCEL_KEY_PREFIX + turnId)
        ctrl?.abort?.()
      }
    } catch (_) { /* ignore */ }
    state.updatedAt = Date.now()
    writeTurnState(turnId, state)
  }, HEARTBEAT_MS)
  entry.timers.push(flusher, heartbeat)

  const finish = (phase, extra = {}) => {
    for (const t of entry.timers) clearInterval(t)
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
          state.steps = (steps || []).slice(-STEPS_MAX_ITEMS)
          entry.dirty = true
        },
        onTurnText: (text) => {
          const t = String(text || '')
          if (!t) return
          const now = Date.now()
          if (now - mcpStreamAt < 100) return
          mcpStreamAt = now
          state.streamText = t.length > STREAM_TEXT_MAX_CHARS ? t.slice(-STREAM_TEXT_MAX_CHARS) : t
          entry.dirty = true
        },
        onTodos: (todos) => {
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
