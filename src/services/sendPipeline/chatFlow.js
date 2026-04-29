import { buildChatContextMessages } from '../../utils/chatContextBuilder.js'

export function buildChatFlowContextMessages(rawMessages = [], options = {}) {
  return buildChatContextMessages(rawMessages, {
    maxContextChars: Number(options.maxContextChars || 12000),
    recentMessageLimit: Number(options.recentMessageLimit || 10),
    summaryCharLimit: Number(options.summaryCharLimit || 2200),
    chatId: options.chatId,
    scopeKey: options.scopeKey
  })
}

export function buildRawChatMessagesForApi(messages = [], options = {}) {
  const userMessageId = String(options.userMessageId || '').trim()
  const apiUserContent = String(options.apiUserContent || '')
  return (Array.isArray(messages) ? messages : [])
    .slice(0, -1)
    .filter(m => m?.content)
    .map(m => ({
      role: m.role,
      content: userMessageId && m.id === userMessageId ? apiUserContent : m.content
    }))
}

export function buildChatFlowRequestContext(chatObj = {}, options = {}) {
  const rawMessagesForApi = buildRawChatMessagesForApi(chatObj?.messages || [], options)
  const context = buildChatFlowContextMessages(rawMessagesForApi, {
    chatId: chatObj?.id || options.chatId,
    scopeKey: options.scopeKey,
    maxContextChars: options.maxContextChars,
    recentMessageLimit: options.recentMessageLimit,
    summaryCharLimit: options.summaryCharLimit
  })
  return {
    rawMessagesForApi,
    messagesForApi: context.messages,
    contextBuildMeta: context.meta
  }
}

export function createChatStreamState(options = {}) {
  return {
    content: String(options.initialContent || ''),
    chunkCount: 0,
    firstChunkAt: 0,
    startedAt: Number(options.startedAt || Date.now()),
    completedAt: 0,
    error: null
  }
}

export function appendChatStreamChunk(state = {}, chunk = '', now = Date.now()) {
  const next = {
    ...state,
    content: `${String(state.content || '')}${String(chunk || '')}`,
    chunkCount: Number(state.chunkCount || 0) + 1
  }
  if (!next.firstChunkAt) next.firstChunkAt = now
  return next
}

export function completeChatStreamState(state = {}, now = Date.now()) {
  return {
    ...state,
    completedAt: now,
    durationMs: Math.max(0, now - Number(state.startedAt || now)),
    ok: !state.error
  }
}

export function formatChatFlowError(error = '') {
  const message = String(error?.message || error || '请求失败').trim()
  if (!message) return '[错误] 请求失败'
  if (message.startsWith('[错误]')) return message
  return `[错误] ${message}`
}

export function failChatStreamState(state = {}, error = '', now = Date.now()) {
  return completeChatStreamState({
    ...state,
    error: formatChatFlowError(error)
  }, now)
}

export default {
  buildChatFlowContextMessages,
  buildRawChatMessagesForApi,
  buildChatFlowRequestContext,
  createChatStreamState,
  appendChatStreamChunk,
  completeChatStreamState,
  formatChatFlowError,
  failChatStreamState
}
