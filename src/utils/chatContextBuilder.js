import { buildChatMemoryContext, listChatMemoryRecords, markChatMemoryRecordsUsed } from './chatMemoryStore.js'

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function getMessageTextLength(message = {}) {
  return normalizeString(message?.content).length
}

function truncateText(text = '', maxLength = 240) {
  const normalized = normalizeString(text)
  if (!normalized) return ''
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
}

function buildSummaryMessage(earlierMessages = [], options = {}) {
  const maxEntries = Math.max(1, Number(options.maxEntries || 12))
  const maxLength = Math.max(400, Number(options.maxLength || 2200))
  const lines = earlierMessages
    .filter(item => normalizeString(item?.content))
    .slice(-maxEntries)
    .map((item) => {
      const role = item?.role === 'assistant' ? '助手' : item?.role === 'system' ? '系统' : '用户'
      return `- ${role}：${truncateText(item.content, 180)}`
    })
    .filter(Boolean)
  const content = [
    '以下是为控制上下文长度而保留的更早会话摘要，请在回答时继续参考这些上下文事实：',
    ...lines
  ].join('\n')
  return {
    role: 'system',
    content: content.length > maxLength ? `${content.slice(0, maxLength)}...` : content
  }
}

function getTotalMessageChars(messages = []) {
  return (Array.isArray(messages) ? messages : []).reduce((sum, item) => sum + getMessageTextLength(item), 0)
}

function buildContextBudgetPlan(messages = [], options = {}, longTermMemoryContext = null) {
  const totalChars = getTotalMessageChars(messages)
  const messageCount = Array.isArray(messages) ? messages.length : 0
  const memoryCount = Number(longTermMemoryContext?.meta?.memoryCount || 0)
  const requestedMaxContextChars = Math.max(4000, Number(options.maxContextChars || 12000))
  const requestedRecentMessageLimit = Math.max(4, Number(options.recentMessageLimit || 10))
  const requestedSummaryCharLimit = Math.max(400, Number(options.summaryCharLimit || 2200))

  let level = 'balanced'
  if (totalChars >= 22000 || messageCount >= 28) {
    level = 'tight'
  } else if (totalChars >= 12000 || messageCount >= 16 || memoryCount >= 3) {
    level = 'standard'
  }

  if (level === 'tight') {
    return {
      level,
      reason: 'history-heavy',
      maxContextChars: Math.min(requestedMaxContextChars, 9000),
      recentMessageLimit: Math.min(requestedRecentMessageLimit, 8),
      summaryCharLimit: Math.min(requestedSummaryCharLimit, 1600),
      memoryMaxEntries: memoryCount > 0 ? 2 : 0
    }
  }
  if (level === 'standard') {
    return {
      level,
      reason: 'history-growing',
      maxContextChars: Math.min(requestedMaxContextChars, 11000),
      recentMessageLimit: Math.min(requestedRecentMessageLimit, 9),
      summaryCharLimit: Math.min(requestedSummaryCharLimit, 2000),
      memoryMaxEntries: memoryCount > 0 ? Math.min(3, memoryCount) : 0
    }
  }
  return {
    level,
    reason: 'history-light',
    maxContextChars: requestedMaxContextChars,
    recentMessageLimit: requestedRecentMessageLimit,
    summaryCharLimit: requestedSummaryCharLimit,
    memoryMaxEntries: memoryCount > 0 ? Math.min(4, Math.max(1, memoryCount)) : 0
  }
}

export function buildChatContextMessages(messages = [], options = {}) {
  const list = Array.isArray(messages) ? messages : []
  const initialMemoryContext = options.longTermMemoryContext
    || buildChatMemoryContext(
      listChatMemoryRecords({
        chatId: options.chatId,
        scopeKey: options.scopeKey
      }),
      { maxEntries: 4 }
    )
  const budgetPlan = buildContextBudgetPlan(list, options, initialMemoryContext)
  const maxContextChars = budgetPlan.maxContextChars
  const recentMessageLimit = budgetPlan.recentMessageLimit
  const summaryCharLimit = budgetPlan.summaryCharLimit
  const longTermMemoryContext = options.longTermMemoryContext
    || buildChatMemoryContext(
      listChatMemoryRecords({
        chatId: options.chatId,
        scopeKey: options.scopeKey
      }),
      { maxEntries: budgetPlan.memoryMaxEntries || 1 }
    )
  const normalized = list
    .filter(item => normalizeString(item?.content))
    .map((item) => ({
      role: normalizeString(item?.role, 'user'),
      content: normalizeString(item?.content)
    }))

  const meta = {
    originalMessageCount: normalized.length,
    includedMessageCount: normalized.length,
    summarizedMessageCount: 0,
    droppedMessageCount: 0,
    totalCharsBefore: getTotalMessageChars(normalized),
    totalCharsAfter: 0,
    usedSummary: false,
    wasTrimmed: false,
    usedLongTermMemory: longTermMemoryContext?.meta?.usedLongTermMemory === true,
    memoryCount: Number(longTermMemoryContext?.meta?.memoryCount || 0),
    summaryQualityScore: 100,
    summaryAuditRequired: false,
    budgetLevel: budgetPlan.level,
    budgetReason: budgetPlan.reason,
    budgetSnapshot: {
      maxContextChars,
      recentMessageLimit,
      summaryCharLimit,
      memoryMaxEntries: budgetPlan.memoryMaxEntries
    },
    averageMemoryQualityScore: Number(longTermMemoryContext?.meta?.averageQualityScore || 0),
    scopeKey: normalizeString(options.scopeKey)
  }

  if (normalized.length <= recentMessageLimit && meta.totalCharsBefore <= maxContextChars && !longTermMemoryContext?.message) {
    meta.totalCharsAfter = meta.totalCharsBefore
    return {
      messages: normalized,
      meta
    }
  }

  const recentMessages = normalized.slice(-recentMessageLimit)
  const earlierMessages = normalized.slice(0, Math.max(0, normalized.length - recentMessages.length))
  let resultMessages = [...recentMessages]

  if (earlierMessages.length > 0) {
    resultMessages = [
      buildSummaryMessage(earlierMessages, {
        maxEntries: Math.min(16, earlierMessages.length),
        maxLength: summaryCharLimit
      }),
      ...recentMessages
    ]
    meta.usedSummary = true
    meta.summarizedMessageCount = earlierMessages.length
  }

  while (resultMessages.length > 1 && getTotalMessageChars(resultMessages) > maxContextChars) {
    if (resultMessages[0]?.role === 'system' && resultMessages.length > 2) {
      resultMessages.splice(1, 1)
    } else {
      resultMessages.shift()
    }
    meta.wasTrimmed = true
  }

  if (longTermMemoryContext?.message) {
    resultMessages = [longTermMemoryContext.message, ...resultMessages]
    try {
      markChatMemoryRecordsUsed(longTermMemoryContext?.meta?.memoryIds || [])
    } catch (_) {}
  }

  meta.includedMessageCount = resultMessages.length
  meta.droppedMessageCount = Math.max(0, normalized.length - recentMessages.length)
  meta.totalCharsAfter = getTotalMessageChars(resultMessages)
  const summaryPenalty = meta.usedSummary ? Math.min(30, meta.summarizedMessageCount * 2) : 0
  const trimPenalty = meta.wasTrimmed ? Math.min(25, meta.droppedMessageCount * 3) : 0
  const memoryPenalty = meta.usedLongTermMemory && meta.averageMemoryQualityScore > 0
    ? Math.max(0, Math.round((80 - meta.averageMemoryQualityScore) / 4))
    : 0
  meta.summaryQualityScore = Math.max(45, 100 - summaryPenalty - trimPenalty - memoryPenalty)
  meta.summaryAuditRequired = meta.summaryQualityScore < 70 || (meta.usedSummary && meta.wasTrimmed)
  return {
    messages: resultMessages,
    meta
  }
}
