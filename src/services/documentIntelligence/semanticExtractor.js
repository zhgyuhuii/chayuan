import {
  createCoverageLedger,
  markChunkCompleted,
  markChunkFailed,
  markChunkStarted
} from './coverageLedger.js'
import { validateJsonSchema } from '../schema/jsonSchemaValidator.js'

export const DEFAULT_EXTRACTION_SCHEMA = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          evidence: { type: 'string' }
        }
      }
    }
  }
}

function compactJson(value) {
  return JSON.stringify(value || {}, null, 2)
}

function stripJsonFence(text = '') {
  const value = String(text || '').trim()
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced?.[1] || value).trim()
}

export function parseExtractorJson(text = '') {
  const raw = stripJsonFence(text)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (error) {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1))
    }
    throw error
  }
}

export function buildChunkExtractionMessages(chunk = {}, options = {}) {
  const schema = options.schema || DEFAULT_EXTRACTION_SCHEMA
  const task = String(options.task || '请从当前分块中抽取与用户目标相关的信息。').trim()
  const chunkText = String(chunk?.text || chunk?.normalizedText || chunk || '')
  return [
    {
      role: 'system',
      content: [
        '你是文档语义抽取器。',
        '必须只输出 JSON，不要输出 Markdown、解释、寒暄或代码围栏。',
        '输出必须符合给定 JSON Schema。找不到信息时返回空数组或空字段。'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `抽取任务：${task}`,
        '',
        'JSON Schema：',
        compactJson(schema),
        '',
        `分块序号：${chunk?.index ?? ''}`,
        '分块内容：',
        chunkText
      ].join('\n')
    }
  ]
}

export function normalizeExtractionResult(result = {}, chunk = {}) {
  const normalized = result && typeof result === 'object' ? result : {}
  const items = Array.isArray(normalized.items) ? normalized.items : []
  return {
    ...normalized,
    items,
    chunkId: String(chunk?.id || chunk?.chunkId || (chunk?.index ?? '')),
    chunkIndex: Number.isFinite(Number(chunk?.index)) ? Number(chunk.index) : null
  }
}

export async function extractSemanticChunks(chunks = [], options = {}) {
  if (typeof options.extractor !== 'function') {
    throw new Error('semanticExtractor requires options.extractor')
  }
  const normalizedChunks = Array.isArray(chunks) ? chunks : []
  const ledger = createCoverageLedger(normalizedChunks, {
    taskType: options.taskType || 'semantic-extract'
  })
  const results = []

  for (const chunk of normalizedChunks) {
    const chunkId = String(chunk?.id || chunk?.chunkId || (chunk?.index ?? results.length))
    markChunkStarted(ledger, chunkId)
    try {
      const messages = buildChunkExtractionMessages(chunk, options)
      const responseText = await options.extractor({
        chunk,
        messages,
        schema: options.schema || DEFAULT_EXTRACTION_SCHEMA,
        task: options.task || ''
      })
      const parsed = parseExtractorJson(responseText)
      const validation = validateJsonSchema(parsed, options.schema || DEFAULT_EXTRACTION_SCHEMA)
      if (!validation.ok) {
        throw new Error(`抽取结果不符合 schema：${validation.issues[0]?.message || '校验失败'}`)
      }
      const normalized = normalizeExtractionResult(parsed, chunk)
      results.push(normalized)
      markChunkCompleted(ledger, chunkId, JSON.stringify(normalized))
    } catch (error) {
      markChunkFailed(ledger, chunkId, error)
      if (options.failFast === true) throw error
      results.push({
        chunkId,
        chunkIndex: Number.isFinite(Number(chunk?.index)) ? Number(chunk.index) : null,
        items: [],
        error: String(error?.message || error || '抽取失败')
      })
    }
  }

  return {
    results,
    ledger
  }
}

export default {
  DEFAULT_EXTRACTION_SCHEMA,
  parseExtractorJson,
  buildChunkExtractionMessages,
  normalizeExtractionResult,
  extractSemanticChunks
}
