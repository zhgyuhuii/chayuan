import { applyDocumentAction, getDocumentText } from '../../utils/documentActions.js'
import { becomeLeader, enqueueOp } from '../../utils/host/opQueue.js'
import { registerTool } from './toolRegistry.js'

const DOCUMENT_APPLY_ACTION_KIND = 'document.applyAction'

function applyDocumentActionLocal(action, text, options = {}) {
  applyDocumentAction(action, text, {
    title: options.title || '察元工具调用'
  })
  return { ok: true, action, charCount: String(text || '').length, queued: false }
}

export function handleWpsDocumentToolOp(op = {}) {
  if (op.kind !== DOCUMENT_APPLY_ACTION_KIND) return null
  const payload = op.payload || {}
  return applyDocumentActionLocal(payload.action, payload.text, payload.options)
}

export function registerWpsDocumentToolLeader() {
  return becomeLeader(handleWpsDocumentToolOp)
}

function enqueueDocumentAction(action, text, options = {}) {
  const payload = {
    action,
    text,
    options: {
      title: options.title || '察元工具调用'
    }
  }
  return enqueueOp(DOCUMENT_APPLY_ACTION_KIND, payload, {
    localFallback: handleWpsDocumentToolOp,
    timeoutMs: options.timeoutMs
  }).then(result => ({
    ...(result || {}),
    queued: result?.queued !== false
  }))
}

export function registerWpsDocumentTools() {
  registerTool({
    key: 'document.getText',
    title: '读取当前文档正文',
    description: '读取当前 WPS 文档的纯文本正文。',
    riskLevel: 'low',
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        charCount: { type: 'number' }
      }
    },
    handler: () => {
      const text = String(getDocumentText() || '')
      return { text, charCount: text.length }
    }
  })

  registerTool({
    key: 'document.insertText',
    title: '插入文本到文档',
    description: '将文本插入到当前光标位置。',
    riskLevel: 'high',
    requiresConfirmation: true,
    inputSchema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string' }
      }
    },
    handler: async (input = {}) => {
      const text = String(input.text || '')
      return enqueueDocumentAction('insert', text, { title: '察元工具调用' })
    }
  })

  registerTool({
    key: 'document.appendText',
    title: '追加文本到文末',
    description: '将文本追加到当前文档末尾。',
    riskLevel: 'high',
    requiresConfirmation: true,
    inputSchema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string' }
      }
    },
    handler: async (input = {}) => {
      const text = String(input.text || '')
      return enqueueDocumentAction('append', text, { title: '察元工具调用' })
    }
  })

  registerTool({
    key: 'document.replaceSelection',
    title: '替换当前选区',
    description: '用给定文本替换当前选区或当前可操作范围。',
    riskLevel: 'high',
    requiresConfirmation: true,
    inputSchema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string' }
      }
    },
    handler: async (input = {}) => {
      const text = String(input.text || '')
      return enqueueDocumentAction('replace', text, { title: '察元工具调用' })
    }
  })

  registerTool({
    key: 'document.addComment',
    title: '添加批注',
    description: '在当前选区或光标位置添加批注文本。',
    riskLevel: 'high',
    requiresConfirmation: true,
    inputSchema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string' }
      }
    },
    handler: async (input = {}) => {
      const text = String(input.text || '')
      return enqueueDocumentAction('comment', text, { title: '察元工具调用' })
    }
  })
}

export default {
  handleWpsDocumentToolOp,
  registerWpsDocumentToolLeader,
  registerWpsDocumentTools
}
