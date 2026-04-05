import { getModelConfig } from './modelSettings.js'

const OLLAMA_LIKE = ['ollama', 'OLLAMA', 'xinference', 'XINFERENCE', 'oneapi', 'ONEAPI', 'fastchat', 'FASTCHAT', 'lm-studio', 'new-api']

function isOllamaLike(providerId) {
  return OLLAMA_LIKE.some(id => String(providerId || '').toLowerCase() === id.toLowerCase())
}

function trimApiUrl(apiUrl) {
  return String(apiUrl || '').trim().replace(/\/+$/, '')
}

function buildEndpoint(apiUrl, suffix) {
  const base = trimApiUrl(apiUrl)
  if (!base) return ''
  if (base.endsWith(`/${suffix}`)) return base
  if (/\/v\d+$/.test(base) || base.includes('qianfan.baidubce.com')) {
    return `${base}/${suffix}`
  }
  return `${base}/v1/${suffix}`
}

function isProvider(providerId, expected) {
  return String(providerId || '').toLowerCase() === String(expected || '').toLowerCase()
}

function getDashscopeServiceRoot(apiUrl) {
  const base = trimApiUrl(apiUrl)
  return base.replace(/\/compatible-mode\/v1$/i, '').replace(/\/api\/v1$/i, '')
}

function shouldUseDevProxy(providerId, url) {
  if (!import.meta.env.DEV) return false
  if (!isProvider(providerId, 'aliyun-bailian')) return false
  if (typeof window === 'undefined') return false
  if (!/^https?:\/\//i.test(String(url || ''))) return false
  const host = String(window.location?.hostname || '')
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
}

function wrapProxyUrl(url) {
  return `/__dev_proxy__/remote?url=${encodeURIComponent(String(url || ''))}`
}

function isDashscopeSyncImageModel(modelId) {
  const id = String(modelId || '').toLowerCase()
  return id.startsWith('qwen-image') || id.startsWith('wan2.6')
}

function getApiConfig(providerId, modelId, suffix) {
  if (!providerId || !modelId) return null
  const config = getModelConfig(providerId)
  if (!config?.apiUrl?.trim()) return null
  return {
    apiKey: String(config.apiKey || '').trim(),
    apiUrl: buildEndpoint(config.apiUrl, suffix),
    model: modelId
  }
}

async function parseJsonResponse(res) {
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`请求失败: ${res.status} ${text || res.statusText}`)
  }
  try {
    return JSON.parse(text)
  } catch (_) {
    throw new Error(`响应非 JSON: ${String(text || '').slice(0, 300)}`)
  }
}

function buildHeaders(apiKey) {
  const headers = {
    'Content-Type': 'application/json'
  }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey.split(',')[0].trim()}`
  }
  return headers
}

function formatFetchFailure(error, url, label) {
  const raw = String(error?.message || error || '').trim()
  if (error?.name === 'AbortError') {
    return '请求已终止'
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) {
    return `${label}请求失败，浏览器未拿到响应。请重点检查：1) 接口地址是否可访问 2) 服务是否已启动 3) 是否被 CORS 拦截 4) HTTPS 证书是否无效 5) 是否发生了 HTTP/HTTPS 混用。当前地址：${url}`
  }
  return `${label}请求失败: ${raw}${url ? `。当前地址：${url}` : ''}`
}

async function fetchJsonWithDiagnostics(url, options, label) {
  try {
    const res = await fetch(options?.proxyUrl || url, options)
    return await parseJsonResponse(res)
  } catch (error) {
    throw new Error(formatFetchFailure(error, url, label))
  }
}

async function fetchJsonOrTextWithDiagnostics(url, options, label) {
  try {
    const res = await fetch(options?.proxyUrl || url, options)
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`请求失败: ${res.status} ${text || res.statusText}`)
    }
    try {
      return JSON.parse(text)
    } catch (_) {
      return text
    }
  } catch (error) {
    throw new Error(formatFetchFailure(error, url, label))
  }
}

async function fetchBinaryWithDiagnostics(url, options, label) {
  try {
    const res = await fetch(options?.proxyUrl || url, options)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`请求失败: ${res.status} ${text || res.statusText}`)
    }
    return {
      bytes: await res.arrayBuffer(),
      mimeType: res.headers.get('content-type') || 'application/octet-stream'
    }
  } catch (error) {
    throw new Error(formatFetchFailure(error, url, label))
  }
}

function ensureApiKey(providerId, apiKey) {
  if (!isOllamaLike(providerId) && !apiKey) {
    throw new Error('未配置 API 密钥，请先在模型设置中完善')
  }
}

function mapAspectRatioToImageSize(aspectRatio) {
  switch (String(aspectRatio || '').trim()) {
    case '9:16':
      return '1024x1792'
    case '16:9':
      return '1792x1024'
    case '1:1':
    default:
      return '1024x1024'
  }
}

function mapAspectRatioToDashscopeImageSize(aspectRatio) {
  switch (String(aspectRatio || '').trim()) {
    case '9:16':
      return '1024*1792'
    case '16:9':
      return '1792*1024'
    case '1:1':
    default:
      return '1024*1024'
  }
}

function mapAspectRatioToVideoSize(aspectRatio) {
  switch (String(aspectRatio || '').trim()) {
    case '9:16':
      return '720x1280'
    case '1:1':
      return '1024x1024'
    case '16:9':
    default:
      return '1280x720'
  }
}

function normalizeDurationSeconds(duration) {
  const raw = String(duration || '').trim()
  const match = raw.match(/^(\d+)\s*s?$/i)
  if (!match) return 8
  const value = Number(match[1])
  if (!Number.isFinite(value)) return 8
  return Math.min(Math.max(value, 4), 30)
}

function mapVoiceStyleToVoice(voiceStyle) {
  const value = String(voiceStyle || '').toLowerCase()
  if (value.includes('温柔') || value.includes('柔和')) return 'nova'
  if (value.includes('男') || value.includes('沉稳')) return 'onyx'
  if (value.includes('活泼') || value.includes('轻快')) return 'shimmer'
  if (value.includes('专业') || value.includes('自然')) return 'alloy'
  return 'alloy'
}

function mimeToExtension(mimeType, fallback = 'bin') {
  const mime = String(mimeType || '').toLowerCase()
  if (mime.includes('png')) return 'png'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mp4')) return 'mp4'
  return fallback
}

async function fetchBinaryFromUrl(url, signal, providerId = '') {
  return fetchBinaryWithDiagnostics(url, {
    signal,
    proxyUrl: shouldUseDevProxy(providerId, url) ? wrapProxyUrl(url) : ''
  }, '下载媒体')
}

function extractImagePayload(data) {
  const item = data?.data?.[0] || data?.output?.[0] || data?.image || null
  if (!item) {
    throw new Error('图像接口未返回可用结果')
  }
  if (item.b64_json) {
    return {
      base64: item.b64_json,
      mimeType: 'image/png',
      revisedPrompt: item.revised_prompt || data?.revised_prompt || ''
    }
  }
  if (item.url) {
    return {
      url: item.url,
      mimeType: 'image/png',
      revisedPrompt: item.revised_prompt || data?.revised_prompt || ''
    }
  }
  throw new Error('图像接口返回格式不受支持')
}

function extractDashscopeImagePayload(data) {
  const content = data?.output?.choices?.[0]?.message?.content
  if (Array.isArray(content) && content[0]?.image) {
    return {
      url: content[0].image,
      revisedPrompt: content[0]?.text || ''
    }
  }
  const results = data?.output?.results || data?.output?.output_results || data?.output_results
  if (Array.isArray(results) && results[0]?.url) {
    return {
      url: results[0].url,
      revisedPrompt: data?.output?.prompt || ''
    }
  }
  const image = data?.output?.image || data?.image
  if (image) {
    return {
      url: image,
      revisedPrompt: data?.output?.prompt || ''
    }
  }
  return null
}

async function pollDashscopeTaskResult(baseUrl, apiKey, taskId, signal) {
  for (let i = 0; i < 40; i++) {
    await sleep(3000, signal)
    const taskUrl = `${baseUrl}/api/v1/tasks/${taskId}`
    const detail = await fetchJsonWithDiagnostics(taskUrl, {
      headers: buildHeaders(apiKey),
      signal,
      proxyUrl: shouldUseDevProxy('aliyun-bailian', taskUrl) ? wrapProxyUrl(taskUrl) : ''
    }, '百炼图像任务查询')
    const payload = extractDashscopeImagePayload(detail)
    if (payload?.url) return payload
    const status = String(detail?.output?.task_status || detail?.task_status || detail?.status || '').toUpperCase()
    if (['FAILED', 'CANCELLED', 'CANCELED'].includes(status)) {
      throw new Error(detail?.output?.message || detail?.message || '百炼图像任务失败')
    }
  }
  throw new Error('百炼图像生成超时，请稍后重试')
}

export async function generateImageAsset({ providerId, modelId, prompt, aspectRatio, signal }) {
  if (isProvider(providerId, 'aliyun-bailian')) {
    const cfg = getApiConfig(providerId, modelId, 'images/generations')
    if (!cfg) throw new Error('未配置图像模型的 API 地址，请先在设置中配置')
    ensureApiKey(providerId, cfg.apiKey)
    const baseUrl = getDashscopeServiceRoot(getModelConfig(providerId)?.apiUrl || '')
    const normalizedPrompt = String(prompt || '').trim()
    let payload = null
    if (isDashscopeSyncImageModel(cfg.model)) {
      const syncUrl = `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`
      const data = await fetchJsonWithDiagnostics(syncUrl, {
        method: 'POST',
        headers: buildHeaders(cfg.apiKey),
        proxyUrl: shouldUseDevProxy(providerId, syncUrl) ? wrapProxyUrl(syncUrl) : '',
        body: JSON.stringify({
          model: cfg.model,
          input: {
            messages: [
              {
                role: 'user',
                content: [
                  { text: normalizedPrompt }
                ]
              }
            ]
          },
          parameters: {
            size: mapAspectRatioToDashscopeImageSize(aspectRatio),
            n: 1,
            watermark: false,
            prompt_extend: true
          }
        }),
        signal
      }, '百炼图像生成')
      payload = extractDashscopeImagePayload(data)
    } else {
      const asyncUrl = `${baseUrl}/api/v1/services/aigc/text2image/image-synthesis`
      const data = await fetchJsonWithDiagnostics(asyncUrl, {
        method: 'POST',
        headers: {
          ...buildHeaders(cfg.apiKey),
          'X-DashScope-Async': 'enable'
        },
        proxyUrl: shouldUseDevProxy(providerId, asyncUrl) ? wrapProxyUrl(asyncUrl) : '',
        body: JSON.stringify({
          model: cfg.model,
          input: {
            prompt: normalizedPrompt
          },
          parameters: {
            size: mapAspectRatioToDashscopeImageSize(aspectRatio),
            n: 1,
            watermark: false,
            prompt_extend: true
          }
        }),
        signal
      }, '百炼图像生成')
      payload = extractDashscopeImagePayload(data)
      const taskId = data?.output?.task_id || data?.task_id || data?.output?.id
      if (!payload?.url && taskId) {
        payload = await pollDashscopeTaskResult(baseUrl, cfg.apiKey, taskId, signal)
      }
    }
    if (!payload?.url) {
      throw new Error('百炼图像接口未返回图片地址，请检查模型与地域是否匹配')
    }
    const remote = await fetchBinaryFromUrl(payload.url, signal, providerId)
    const bytes = new Uint8Array(remote.bytes)
    let binary = ''
    const chunk = 8192
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)))
    }
    const base64 = btoa(binary)
    const mimeType = remote.mimeType || 'image/png'
    return {
      kind: 'image',
      prompt: String(prompt || '').trim(),
      revisedPrompt: payload.revisedPrompt || '',
      base64,
      mimeType,
      extension: mimeToExtension(mimeType, 'png'),
      dataUrl: `data:${mimeType};base64,${base64}`
    }
  }

  const cfg = getApiConfig(providerId, modelId, 'images/generations')
  if (!cfg) throw new Error('未配置图像模型的 API 地址，请先在设置中配置')
  ensureApiKey(providerId, cfg.apiKey)
  const body = {
    model: cfg.model,
    prompt: String(prompt || '').trim(),
    size: mapAspectRatioToImageSize(aspectRatio),
    n: 1,
    response_format: 'b64_json'
  }
  const data = await fetchJsonWithDiagnostics(cfg.apiUrl, {
    method: 'POST',
    headers: buildHeaders(cfg.apiKey),
    body: JSON.stringify(body),
    signal
  }, '图像生成')
  const payload = extractImagePayload(data)
  let base64 = payload.base64
  let mimeType = payload.mimeType || 'image/png'
  if (!base64 && payload.url) {
    const remote = await fetchBinaryFromUrl(payload.url, signal)
    mimeType = remote.mimeType || mimeType
    const bytes = new Uint8Array(remote.bytes)
    let binary = ''
    const chunk = 8192
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)))
    }
    base64 = btoa(binary)
  }
  return {
    kind: 'image',
    prompt: String(prompt || '').trim(),
    revisedPrompt: payload.revisedPrompt || '',
    base64,
    mimeType,
    extension: mimeToExtension(mimeType, 'png'),
    dataUrl: `data:${mimeType};base64,${base64}`
  }
}

export async function generateSpeechAsset({ providerId, modelId, input, voiceStyle, signal }) {
  const cfg = getApiConfig(providerId, modelId, 'audio/speech')
  if (!cfg) throw new Error('未配置语音模型的 API 地址，请先在设置中配置')
  ensureApiKey(providerId, cfg.apiKey)
  const audio = await fetchBinaryWithDiagnostics(cfg.apiUrl, {
    method: 'POST',
    headers: buildHeaders(cfg.apiKey),
    body: JSON.stringify({
      model: cfg.model,
      input: String(input || '').trim(),
      voice: mapVoiceStyleToVoice(voiceStyle),
      response_format: 'mp3'
    }),
    signal
  }, '语音生成')
  const bytes = audio.bytes
  const mimeType = audio.mimeType || 'audio/mpeg'
  return {
    kind: 'audio',
    prompt: String(input || '').trim(),
    bytes,
    mimeType,
    extension: mimeToExtension(mimeType, 'mp3')
  }
}

export async function transcribeAudioAsset({ providerId, modelId, file, signal, prompt = '' }) {
  const cfg = getApiConfig(providerId, modelId, 'audio/transcriptions')
  if (!cfg) throw new Error('未配置语音识别模型的 API 地址，请先在设置中配置')
  ensureApiKey(providerId, cfg.apiKey)
  if (!file) throw new Error('缺少待识别音频文件')
  const body = new FormData()
  body.append('model', cfg.model)
  body.append('file', file, String(file?.name || 'audio'))
  if (prompt) {
    body.append('prompt', String(prompt || '').trim())
  }
  const headers = {}
  if (cfg.apiKey) {
    headers.Authorization = `Bearer ${cfg.apiKey.split(',')[0].trim()}`
  }
  const data = await fetchJsonOrTextWithDiagnostics(cfg.apiUrl, {
    method: 'POST',
    headers,
    body,
    signal
  }, '语音识别')
  const text = typeof data === 'string'
    ? data
    : (data?.text || data?.result || data?.transcript || data?.content || '')
  return {
    kind: 'audio-transcript',
    text: String(text || '').trim(),
    raw: data
  }
}

function extractVideoJobId(data) {
  return data?.output?.task_id || data?.task_id || data?.id || data?.video?.id || data?.data?.id || null
}

function isVideoCompleted(data) {
  const status = String(data?.output?.task_status || data?.status || data?.state || '').toLowerCase()
  return ['completed', 'succeeded', 'success', 'ready'].includes(status)
}

function isVideoFailed(data) {
  const status = String(data?.output?.task_status || data?.status || data?.state || '').toLowerCase()
  return ['failed', 'error', 'cancelled', 'canceled'].includes(status)
}

function extractDashscopeVideoPayload(data) {
  const output = data?.output || {}
  const choices = output?.choices
  if (Array.isArray(choices) && choices[0]?.message?.content?.[0]?.video) {
    return {
      url: choices[0].message.content[0].video
    }
  }
  const results = output?.results
  if (Array.isArray(results) && results[0]?.url) {
    return {
      url: results[0].url
    }
  }
  const videoUrl = output?.video_url || data?.video_url || data?.url
  if (videoUrl) {
    return {
      url: videoUrl
    }
  }
  return null
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    if (!signal) return
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('请求已终止'))
    }, { once: true })
  })
}

export async function generateVideoAsset({ providerId, modelId, prompt, aspectRatio, duration, signal }) {
  if (isProvider(providerId, 'aliyun-bailian')) {
    const cfg = getApiConfig(providerId, modelId, 'videos')
    if (!cfg) throw new Error('未配置视频模型的 API 地址，请先在设置中配置')
    ensureApiKey(providerId, cfg.apiKey)
    const baseUrl = getDashscopeServiceRoot(getModelConfig(providerId)?.apiUrl || '')
    const createData = await fetchJsonWithDiagnostics(`${baseUrl}/api/v1/services/aigc/video-generation/video-synthesis`, {
      method: 'POST',
      headers: {
        ...buildHeaders(cfg.apiKey),
        'X-DashScope-Async': 'enable'
      },
      proxyUrl: shouldUseDevProxy(providerId, `${baseUrl}/api/v1/services/aigc/video-generation/video-synthesis`)
        ? wrapProxyUrl(`${baseUrl}/api/v1/services/aigc/video-generation/video-synthesis`)
        : '',
      body: JSON.stringify({
        model: cfg.model,
        input: {
          prompt: String(prompt || '').trim()
        },
        parameters: {
          size: String(mapAspectRatioToVideoSize(aspectRatio)).replace('x', '*'),
          duration: normalizeDurationSeconds(duration),
          prompt_extend: true,
          watermark: false
        }
      }),
      signal
    }, '百炼视频生成')
    const taskId = extractVideoJobId(createData)
    if (!taskId) {
      throw new Error('百炼视频接口未返回任务 ID')
    }
    let detail = createData
    for (let i = 0; i < 60; i++) {
      const payload = extractDashscopeVideoPayload(detail)
      if (payload?.url) {
        const media = await fetchBinaryFromUrl(payload.url, signal, providerId)
        return {
          kind: 'video',
          prompt: String(prompt || '').trim(),
          bytes: media.bytes,
          mimeType: media.mimeType || 'video/mp4',
          extension: mimeToExtension(media.mimeType, 'mp4'),
          remoteId: taskId
        }
      }
      if (isVideoFailed(detail)) {
        throw new Error(detail?.output?.message || detail?.message || '百炼视频生成失败')
      }
      await sleep(5000, signal)
      detail = await fetchJsonWithDiagnostics(`${baseUrl}/api/v1/tasks/${taskId}`, {
        headers: buildHeaders(cfg.apiKey),
        signal,
        proxyUrl: shouldUseDevProxy(providerId, `${baseUrl}/api/v1/tasks/${taskId}`)
          ? wrapProxyUrl(`${baseUrl}/api/v1/tasks/${taskId}`)
          : ''
      }, '百炼视频状态查询')
    }
    throw new Error('百炼视频生成超时，请稍后在任务列表中查看结果')
  }

  const cfg = getApiConfig(providerId, modelId, 'videos')
  if (!cfg) throw new Error('未配置视频模型的 API 地址，请先在设置中配置')
  ensureApiKey(providerId, cfg.apiKey)
  const createData = await fetchJsonWithDiagnostics(cfg.apiUrl, {
    method: 'POST',
    headers: buildHeaders(cfg.apiKey),
    body: JSON.stringify({
      model: cfg.model,
      prompt: String(prompt || '').trim(),
      size: mapAspectRatioToVideoSize(aspectRatio),
      duration: normalizeDurationSeconds(duration)
    }),
    signal
  }, '视频生成')
  const videoId = extractVideoJobId(createData)
  if (!videoId) {
    throw new Error('视频接口未返回任务 ID，当前提供商可能不兼容该通用视频接口')
  }
  const baseUrl = trimApiUrl(cfg.apiUrl).replace(/\/videos$/, '')
  let detail = createData
  for (let i = 0; i < 40; i++) {
    if (isVideoCompleted(detail)) break
    if (isVideoFailed(detail)) {
      throw new Error(detail?.error?.message || detail?.message || '视频生成失败')
    }
    await sleep(3000, signal)
    detail = await fetchJsonWithDiagnostics(`${baseUrl}/videos/${videoId}`, {
      headers: buildHeaders(cfg.apiKey),
      signal
    }, '视频状态查询')
  }
  if (!isVideoCompleted(detail)) {
    throw new Error('视频生成超时，请稍后在任务列表中重试')
  }
  const outputUrl = detail?.output_url || detail?.url || `${baseUrl}/videos/${videoId}/content`
  const media = await fetchBinaryFromUrl(outputUrl, signal)
  return {
    kind: 'video',
    prompt: String(prompt || '').trim(),
    bytes: media.bytes,
    mimeType: media.mimeType || 'video/mp4',
    extension: mimeToExtension(media.mimeType, 'mp4'),
    remoteId: videoId
  }
}
