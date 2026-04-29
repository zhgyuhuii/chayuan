/**
 * AI 对话 API - OpenAI 兼容的 /chat/completions 接口
 * 支持两种调用方式：
 * 1. providerId + modelId：从模型设置中的分组与模型清单
 * 2. ribbonModelId（兼容旧逻辑）
 */

import { getModelConfig, RIBBON_MODEL_TO_PROVIDER, parseModelCompositeId } from './modelSettings.js'

const OLLAMA_LIKE = ['ollama', 'OLLAMA', 'xinference', 'XINFERENCE', 'oneapi', 'ONEAPI', 'fastchat', 'FASTCHAT', 'lm-studio', 'new-api']
const DEFAULT_CHAT_REQUEST_TIMEOUT_MS = 180000

function isOllamaLike(providerId) {
  return OLLAMA_LIKE.some(id => String(providerId || '').toLowerCase() === id.toLowerCase())
}

function createRequestAbortSignal(signal, timeoutMs = DEFAULT_CHAT_REQUEST_TIMEOUT_MS) {
  const ms = Math.max(0, Number(timeoutMs) || DEFAULT_CHAT_REQUEST_TIMEOUT_MS)
  if (typeof AbortController === 'undefined') {
    return {
      signal,
      cleanup() {},
      isTimeout() { return false }
    }
  }

  const ctrl = new AbortController()
  let timedOut = false
  let timer = null

  const abortFromParent = () => {
    if (!ctrl.signal.aborted) ctrl.abort(signal?.reason || 'parent-abort')
  }
  if (signal) {
    if (signal.aborted) {
      abortFromParent()
    } else {
      signal.addEventListener('abort', abortFromParent, { once: true })
    }
  }
  if (ms > 0) {
    timer = setTimeout(() => {
      timedOut = true
      if (!ctrl.signal.aborted) ctrl.abort('request-timeout')
    }, ms)
  }

  return {
    signal: ctrl.signal,
    cleanup() {
      if (timer) clearTimeout(timer)
      if (signal) signal.removeEventListener?.('abort', abortFromParent)
    },
    isTimeout() {
      return timedOut
    }
  }
}

function formatRequestTimeoutMessage(timeoutMs = DEFAULT_CHAT_REQUEST_TIMEOUT_MS) {
  const seconds = Math.max(1, Math.round((Number(timeoutMs) || DEFAULT_CHAT_REQUEST_TIMEOUT_MS) / 1000))
  return `模型请求超时（${seconds} 秒未返回），请稍后重试或调小分段长度。`
}

function parseErrorPayload(rawText) {
  const text = String(rawText || '').trim()
  if (!text) return { text: '', payload: null }
  try {
    return {
      text,
      payload: JSON.parse(text)
    }
  } catch (_) {
    return {
      text,
      payload: null
    }
  }
}

function getErrorDetailMessage(rawText) {
  const { text, payload } = parseErrorPayload(rawText)
  const detail = String(
    payload?.error?.message ||
    payload?.message ||
    payload?.error_description ||
    payload?.detail ||
    text
  ).trim()
  const code = String(payload?.error?.code || payload?.code || '').trim()
  const type = String(payload?.error?.type || payload?.type || '').trim()
  return {
    detail,
    code,
    type
  }
}

function normalizeChatApiErrorMessage(status, rawText, fallbackText = '') {
  const statusCode = Number(status || 0)
  const { detail, code, type } = getErrorDetailMessage(rawText)
  const normalized = `${detail} ${code} ${type}`.toLowerCase()
  const fallback = String(fallbackText || '').trim() || '请求失败'

  if (
    statusCode === 402 ||
    /insufficient[_\s-]*balance|余额不足|欠费|quota exceeded|credit balance/i.test(normalized)
  ) {
    return '模型服务余额不足，请充值后重试。'
  }
  if (
    statusCode === 401 ||
    /invalid api key|api key|unauthorized|authentication|auth|鉴权|密钥|令牌/.test(normalized)
  ) {
    return 'API 密钥无效或已过期，请检查模型配置。'
  }
  if (
    statusCode === 403 ||
    /forbidden|permission|无权|权限|not allowed|access denied/.test(normalized)
  ) {
    return '当前账号无权访问该模型或服务，请检查权限配置。'
  }
  if (
    statusCode === 429 ||
    /rate limit|too many requests|频率|限流|请求过多|quota|额度/.test(normalized)
  ) {
    return '请求过于频繁或当前额度已用尽，请稍后重试。'
  }
  if (
    statusCode === 404 ||
    /model not found|not found|模型不存在|模型未找到/.test(normalized)
  ) {
    return '请求的模型不存在，请检查模型名称和接口地址。'
  }
  if (statusCode >= 500) {
    return '模型服务暂时不可用，请稍后重试。'
  }
  if (/failed to fetch|networkerror|network request failed|网络请求失败|fetch failed/.test(normalized)) {
    return '网络请求失败，请检查 API 地址和网络连接。'
  }
  if (detail) {
    return `${fallback}：${detail}`
  }
  return fallback
}

/**
 * 根据 providerId + modelId 获取 API 配置（模型清单中的实际模型）
 * @param {string} providerId - 设置中的 provider id（如 DEEPSEEK）
 * @param {string} modelId - 模型清单中的模型 id（如 deepseek-chat）
 * @returns {{ apiKey: string, apiUrl: string, model: string } | null}
 */
export function getChatApiConfigByProvider(providerId, modelId) {
  if (!providerId || !modelId) return null
  const config = getModelConfig(providerId)
  if (!config || !config.apiUrl?.trim()) return null
  const apiUrl = config.apiUrl.trim().replace(/\/+$/, '')
  // 百度千帆 qianfan.baidubce.com/v2 等已含版本路径，直接追加 /chat/completions
  const chatUrl = /\/v\d+$/.test(apiUrl) || apiUrl.includes('qianfan.baidubce.com')
    ? `${apiUrl}/chat/completions`
    : apiUrl.endsWith('/v1')
      ? `${apiUrl}/chat/completions`
      : `${apiUrl}/v1/chat/completions`
  return {
    apiKey: (config.apiKey || '').trim(),
    apiUrl: chatUrl,
    model: modelId
  }
}

/**
 * 获取指定 ribbon 模型 id 的 API 配置（兼容旧逻辑）
 * @param {string} ribbonModelId - ribbon 中的模型 id（如 gpt-4o, deepseek-v3）
 * @returns {{ apiKey: string, apiUrl: string, model: string } | null}
 */
export function getChatApiConfig(ribbonModelId) {
  if (!ribbonModelId) return null
  const parsed = parseModelCompositeId(ribbonModelId)
  if (parsed) {
    return getChatApiConfigByProvider(parsed.providerId, parsed.modelId)
  }
  const provider = RIBBON_MODEL_TO_PROVIDER[ribbonModelId] ||
    RIBBON_MODEL_TO_PROVIDER[String(ribbonModelId).toLowerCase()] ||
    ribbonModelId
  const config = getModelConfig(provider)
  if (!config || !config.apiUrl?.trim()) return null
  const apiUrl = config.apiUrl.trim().replace(/\/+$/, '')
  const chatUrl = /\/v\d+$/.test(apiUrl) || apiUrl.includes('qianfan.baidubce.com')
    ? `${apiUrl}/chat/completions`
    : apiUrl.endsWith('/v1')
      ? `${apiUrl}/chat/completions`
      : `${apiUrl}/v1/chat/completions`
  return {
    apiKey: (config.apiKey || '').trim(),
    apiUrl: chatUrl,
    model: ribbonModelId
  }
}

/**
 * 流式调用 chat completions API
 * @param {object} options
 * @param {string} options.ribbonModelId - 模型 id，支持 "providerId|modelId" 或旧版 ribbon 模型 id
 * @param {string} [options.providerId] - 可选，与 modelId 一起使用
 * @param {string} [options.modelId] - 可选，与 providerId 一起使用
 * @param {Array<{role: string, content: string}>} options.messages - 消息列表
 * @param {function(string)} options.onChunk - 收到每个 chunk 时回调
 * @param {function()} options.onDone - 完成时回调
 * @param {function(string)} options.onError - 错误时回调
 */
export async function streamChatCompletion({ ribbonModelId, providerId, modelId, messages, onChunk, onDone, onError, signal, timeoutMs, requestTimeoutMs, ...extraBody }) {
  let cfg = null
  if (providerId && modelId) {
    cfg = getChatApiConfigByProvider(providerId, modelId)
  } else {
    cfg = getChatApiConfig(ribbonModelId)
  }
  if (!cfg) {
    onError?.('未配置该模型的 API 地址，请在设置中配置')
    return
  }
  const pid = providerId || parseModelCompositeId(ribbonModelId)?.providerId
  if (isOllamaLike(pid) && !cfg.apiKey) {
    // Ollama 类通常不需要 apiKey
  } else if (!cfg.apiKey) {
    onError?.('未配置 API 密钥，请在设置中配置')
    return
  }

  const body = {
    ...extraBody,
    model: cfg.model,
    messages,
    stream: true
  }

  const headers = {
    'Content-Type': 'application/json'
  }
  if (cfg.apiKey) {
    headers['Authorization'] = `Bearer ${cfg.apiKey.split(',')[0].trim()}`
  }

  const timeout = requestTimeoutMs ?? timeoutMs ?? DEFAULT_CHAT_REQUEST_TIMEOUT_MS
  const abort = createRequestAbortSignal(signal, timeout)
  try {
    const res = await fetch(cfg.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: abort.signal
    })
    if (!res.ok) {
      const text = await res.text()
      onError?.(normalizeChatApiErrorMessage(res.status, text, '请求失败'))
      return
    }
    const reader = res.body?.getReader()
    if (!reader) {
      onError?.('不支持流式响应')
      return
    }
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const obj = JSON.parse(data)
            const delta = obj?.choices?.[0]?.delta?.content ?? obj?.choices?.[0]?.delta?.reasoning_content
            if (delta) onChunk?.(delta)
          } catch (_) {
            // Ignore malformed SSE fragments and continue reading the stream.
          }
        }
      }
    }
    if (buffer) {
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6)
        if (data !== '[DONE]') {
          try {
            const obj = JSON.parse(data)
            const delta = obj?.choices?.[0]?.delta?.content ?? obj?.choices?.[0]?.delta?.reasoning_content
            if (delta) onChunk?.(delta)
          } catch (_) {
            // Ignore malformed trailing SSE fragments.
          }
        }
      }
    }
    onDone?.()
  } catch (e) {
    if (abort.isTimeout()) {
      onError?.(formatRequestTimeoutMessage(timeout))
      return
    }
    if (e?.name === 'AbortError') {
      onError?.('请求已终止')
      return
    }
    console.error('streamChatCompletion error:', e)
    onError?.(normalizeChatApiErrorMessage(0, e?.message || '', '网络请求失败'))
  } finally {
    abort.cleanup()
  }
}

/**
 * 从 API 响应中提取文本内容（兼容多种响应格式）
 * @param {object} data - API 返回的 JSON
 * @returns {string}
 */
function extractContentFromResponse(data) {
  if (!data || typeof data !== 'object') return ''
  // OpenAI 格式: choices[0].message.content
  const c = data?.choices?.[0]?.message?.content
  if (Array.isArray(c)) {
    return c.map(part => {
      if (typeof part === 'string') return part
      if (part?.text != null) return String(part.text)
      return ''
    }).join('')
  }
  if (c != null) return String(c)
  // 部分 API: choices[0].text 或 result
  const t = data?.choices?.[0]?.text ?? data?.choices?.[0]?.delta?.content ?? data?.result ?? data?.content
  if (t != null) return String(t)
  return ''
}

/**
 * 与 chatCompletion 实际 POST 的 JSON body 对齐的可序列化快照（不含 Authorization、apiKey）。
 * 用于任务详情「发给大模型的完整 JSON」展示与重试编辑。
 */
export function buildChatCompletionsRequestSnapshot({
  ribbonModelId,
  providerId,
  modelId,
  messages,
  stream = false,
  ...extraBody
}) {
  let cfg = null
  if (providerId && modelId) {
    cfg = getChatApiConfigByProvider(providerId, modelId)
  } else if (ribbonModelId) {
    cfg = getChatApiConfig(ribbonModelId)
  }
  const parsedRibbon = ribbonModelId ? parseModelCompositeId(ribbonModelId) : null
  const body = {
    ...extraBody,
    model: cfg?.model || modelId || '',
    messages: Array.isArray(messages) ? messages : [],
    stream: stream === true
  }
  return {
    providerId: providerId || parsedRibbon?.providerId || '',
    modelId: modelId || parsedRibbon?.modelId || '',
    ribbonModelId: ribbonModelId || '',
    endpoint: cfg?.apiUrl || '',
    ...body
  }
}

/**
 * 非流式调用 chat completions API（用于拼写检查等需要完整响应的场景）
 * @param {object} options
 * @param {string} [options.ribbonModelId]
 * @param {string} [options.providerId]
 * @param {string} [options.modelId]
 * @param {Array<{role: string, content: string}>} options.messages
 * @param {boolean} [options.stream=false] - 是否使用流式请求（流式会聚合为完整字符串返回）
 * @returns {Promise<string>} 完整回复内容
 */
export async function chatCompletion({ ribbonModelId, providerId, modelId, messages, stream: useStream = false, signal, timeoutMs, requestTimeoutMs, ...extraBody }) {
  if (useStream) {
    return new Promise((resolve, reject) => {
      let full = ''
      streamChatCompletion({
        providerId,
        modelId,
        ribbonModelId,
        messages,
        signal,
        timeoutMs,
        requestTimeoutMs,
        ...extraBody,
        onChunk: (chunk) => { full += chunk },
        onDone: () => resolve(full),
        onError: (err) => reject(new Error(err || '流式请求失败'))
      })
    })
  }

  let cfg = null
  if (providerId && modelId) {
    cfg = getChatApiConfigByProvider(providerId, modelId)
  } else {
    cfg = getChatApiConfig(ribbonModelId)
  }
  if (!cfg) {
    throw new Error('未配置该模型的 API 地址，请在设置中配置')
  }
  const pid = providerId || parseModelCompositeId(ribbonModelId)?.providerId
  if (!isOllamaLike(pid) && !cfg.apiKey) {
    throw new Error('未配置 API 密钥，请在设置中配置')
  }

  const body = {
    ...extraBody,
    model: cfg.model,
    messages,
    stream: false
  }

  const headers = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) {
    headers['Authorization'] = `Bearer ${cfg.apiKey.split(',')[0].trim()}`
  }

  const timeout = requestTimeoutMs ?? timeoutMs ?? DEFAULT_CHAT_REQUEST_TIMEOUT_MS
  const abort = createRequestAbortSignal(signal, timeout)
  let res
  let text
  try {
    res = await fetch(cfg.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: abort.signal
    })
    text = await res.text()
  } catch (e) {
    if (abort.isTimeout()) {
      throw new Error(formatRequestTimeoutMessage(timeout))
    }
    throw e
  } finally {
    abort.cleanup()
  }
  if (!res.ok) {
    throw new Error(normalizeChatApiErrorMessage(res.status, text, '请求失败'))
  }
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    throw new Error(`响应非 JSON: ${text.slice(0, 200)}`)
  }
  return extractContentFromResponse(data)
}
