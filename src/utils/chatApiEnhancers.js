/**
 * chatApiEnhancers - chatApi 请求体增强器(opt-in)
 *
 * 不改 chatApi.js 默认行为,新代码主动调用这些增强器,把:
 *   - prompt caching(Anthropic cache_control / OpenAI 自动)
 *   - structured outputs(response_format json_schema)
 *   - reasoning_effort(o3/o1 系列)
 *   - max_tokens / temperature / top_p 默认下沉
 * 拼到 extraBody,然后传给 chatCompletion / streamChatCompletion。
 *
 * 用法:
 *   import { chatCompletion } from './chatApi.js'
 *   import { withPromptCache, withJsonSchema } from './chatApiEnhancers.js'
 *
 *   const messages = withPromptCache([
 *     { role: 'system', content: longSystemPrompt },  // 自动加 cache_control
 *     { role: 'user', content: chunkText }
 *   ], { providerId })
 *
 *   const extra = withJsonSchema({}, { schema: spellCheckSchema, name: 'IssueList' })
 *   const raw = await chatCompletion({ providerId, modelId, messages, ...extra })
 */

const ANTHROPIC_LIKE = ['anthropic', 'claude', 'CLAUDE']
const OPENAI_LIKE = ['openai', 'OPENAI', 'azure-openai', 'azure', 'AZURE']
const OPENAI_COMPATIBLE = ['deepseek', 'qwen', 'moonshot', 'doubao', 'zhipu', 'glm', 'minimax', 'kimi']

function isAnthropicLike(providerId) {
  const p = String(providerId || '').toLowerCase()
  return ANTHROPIC_LIKE.some(id => p === id.toLowerCase() || p.includes(id.toLowerCase()))
}

function isOpenAILike(providerId) {
  const p = String(providerId || '').toLowerCase()
  if (OPENAI_LIKE.some(id => p === id.toLowerCase())) return true
  if (OPENAI_COMPATIBLE.some(id => p === id.toLowerCase() || p.startsWith(id.toLowerCase()))) return true
  return false
}

/**
 * 给 messages 标记 prompt caching(主要给 Anthropic,OpenAI 自动)。
 *
 *   messages: 原始 messages 数组
 *   options:
 *     providerId:        必填,用于判定是否 Anthropic
 *     cacheTargets:      数组 ['system'](默认) | ['system','firstUser'] | ['allSystem']
 *
 *   返回新数组,不修改原数组
 */
export function withPromptCache(messages, options = {}) {
  if (!Array.isArray(messages) || messages.length === 0) return messages
  const providerId = String(options.providerId || '').trim()

  // OpenAI 系不需要手动标记,服务端 ≥ 1024 token 自动命中
  if (isOpenAILike(providerId)) return messages

  if (!isAnthropicLike(providerId)) return messages

  const targets = new Set(Array.isArray(options.cacheTargets) ? options.cacheTargets : ['system'])
  let firstUserMarked = false

  return messages.map((msg, i) => {
    if (!msg || typeof msg !== 'object') return msg
    const role = String(msg.role || '').toLowerCase()

    let shouldCache = false
    if (role === 'system' && (targets.has('system') || targets.has('allSystem'))) shouldCache = true
    if (role === 'user' && targets.has('firstUser') && !firstUserMarked) {
      shouldCache = true
      firstUserMarked = true
    }

    if (!shouldCache) return msg

    // 把 string content 转成 [{type:'text', text, cache_control}],兼容 Anthropic Messages API
    if (typeof msg.content === 'string') {
      return {
        ...msg,
        content: [{
          type: 'text',
          text: msg.content,
          cache_control: { type: 'ephemeral' }
        }]
      }
    }
    if (Array.isArray(msg.content)) {
      const parts = msg.content.slice()
      const last = parts[parts.length - 1]
      if (last && typeof last === 'object') {
        parts[parts.length - 1] = { ...last, cache_control: { type: 'ephemeral' } }
      }
      return { ...msg, content: parts }
    }
    return msg
  })
}

/**
 * 给请求加 response_format = json_schema(OpenAI ≥ gpt-4o / DeepSeek / 部分国产)。
 *
 *   extraBody: 现有 extraBody(可空)
 *   options:
 *     schema:  JSON Schema 对象
 *     name:    schema 名称,默认 'StructuredOutput'
 *     strict:  默认 true
 *     fallback:'json_object' | 'none' — 不支持 json_schema 时的退路,默认 'json_object'
 *
 *   返回带 response_format 的新 extraBody 对象
 */
export function withJsonSchema(extraBody = {}, options = {}) {
  const schema = options.schema
  if (!schema || typeof schema !== 'object') return { ...extraBody }

  const name = String(options.name || 'StructuredOutput').trim() || 'StructuredOutput'
  const strict = options.strict !== false

  return {
    ...extraBody,
    response_format: {
      type: 'json_schema',
      json_schema: { name, strict, schema }
    }
  }
}

/**
 * 简单的 json_object 模式(老一些的模型不支持 json_schema 但支持 json_object)。
 */
export function withJsonObject(extraBody = {}) {
  return {
    ...extraBody,
    response_format: { type: 'json_object' }
  }
}

/**
 * o1/o3/o4 reasoning 系列的 reasoning_effort:
 *   'low' | 'medium' | 'high'
 */
export function withReasoningEffort(extraBody = {}, level = 'medium') {
  const lvl = String(level || 'medium').toLowerCase()
  if (!['low', 'medium', 'high'].includes(lvl)) return { ...extraBody }
  return { ...extraBody, reasoning_effort: lvl }
}

/**
 * 一站式封装 — 给路由器/快路径专用:固定 0 温度 + 限制 max_tokens + 强制 json_object
 * 减少 LLM 路由的延迟与抖动。
 */
export function asRouterCall(extraBody = {}) {
  return {
    temperature: 0,
    max_tokens: 200,
    top_p: 1,
    ...extraBody,
    response_format: { type: 'json_object' }
  }
}

/**
 * 一站式封装 — 给评测裁判专用:中低温度 + json_schema(rubric 评分专用)。
 */
export function asJudgeCall(extraBody = {}, options = {}) {
  const next = {
    temperature: 0.1,
    max_tokens: 600,
    ...extraBody
  }
  if (options.schema) {
    return withJsonSchema(next, options)
  }
  return withJsonObject(next)
}

export default {
  withPromptCache,
  withJsonSchema,
  withJsonObject,
  withReasoningEffort,
  asRouterCall,
  asJudgeCall
}
