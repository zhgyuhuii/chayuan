import {
  normalizeAssistantConfig,
  validateAssistantConfig
} from '../assistantStudio/assistantConfigSchema.js'
import {
  createAssistantEvolutionAuditRecord,
  diffAssistantConfig
} from '../assistantEvolution/auditLedger.js'

function buildAssistantId(name = '') {
  const base = String(name || 'assistant')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '')
  return `custom_${base || 'assistant'}_${Date.now().toString(36)}`
}

export function prepareAssistantConfigDraft(input = {}, options = {}) {
  const normalized = normalizeAssistantConfig(input, {
    fallbackName: options.fallbackName || '智能助手'
  })
  const validation = validateAssistantConfig(normalized)
  const id = String(input.id || options.id || '').trim() || buildAssistantId(normalized.name)
  return {
    ok: validation.ok,
    issues: validation.issues,
    config: {
      ...validation.normalized,
      id
    }
  }
}

export function prepareAssistantRepair(before = {}, patch = {}, options = {}) {
  const draft = prepareAssistantConfigDraft({
    ...before,
    ...patch,
    id: before.id || patch.id
  }, options)
  const diff = diffAssistantConfig(before, draft.config)
  return {
    ...draft,
    changed: diff.changed,
    diff,
    auditRecord: createAssistantEvolutionAuditRecord({
      assistantId: draft.config.id,
      before,
      after: draft.config,
      diff,
      actor: options.actor || 'assistant-flow',
      reason: options.reason || '配置修复/优化'
    })
  }
}

export function buildAssistantRecommendationActions(context = {}) {
  const hasCurrentAssistant = !!context.currentAssistant
  const hasConversation = Array.isArray(context.messages) && context.messages.length > 0
  return [
    {
      key: 'generate-assistant',
      label: '用 AI 生成助手',
      enabled: true,
      priority: 10
    },
    {
      key: 'optimize-current-assistant',
      label: '优化当前助手',
      enabled: hasCurrentAssistant,
      priority: hasCurrentAssistant ? 20 : 80
    },
    {
      key: 'generate-from-conversation',
      label: '从当前对话生成助手',
      enabled: hasConversation,
      priority: hasConversation ? 30 : 90
    }
  ].sort((a, b) => a.priority - b.priority)
}

export default {
  prepareAssistantConfigDraft,
  prepareAssistantRepair,
  buildAssistantRecommendationActions
}
