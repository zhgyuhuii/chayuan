import { loadGlobalSettings } from './globalSettings.js'

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function buildHeaders(apiKey = '') {
  const headers = {}
  const normalized = normalizeString(apiKey)
  if (normalized) {
    headers.Authorization = `Bearer ${normalized}`
  }
  return headers
}

function parseServerResponse(payload = {}) {
  return {
    ok: payload?.ok !== false,
    summary: normalizeString(payload?.summary),
    text: normalizeString(payload?.text || payload?.analysis || payload?.content),
    ocrText: normalizeString(payload?.ocrText),
    transcriptText: normalizeString(payload?.transcriptText || payload?.transcript),
    segments: Array.isArray(payload?.segments) ? payload.segments : [],
    metadata: payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
  }
}

export function getMultimodalServerFallbackConfig() {
  const settings = loadGlobalSettings()
  const fallback = settings?.multimodalServerFallback && typeof settings.multimodalServerFallback === 'object'
    ? settings.multimodalServerFallback
    : {}
  return {
    enabled: fallback.enabled === true,
    endpoint: normalizeString(fallback.endpoint),
    apiKey: normalizeString(fallback.apiKey)
  }
}

export async function requestServerSideVideoAnalysis(file, options = {}) {
  const config = getMultimodalServerFallbackConfig()
  if (!config.enabled || !config.endpoint || typeof FormData === 'undefined') {
    return null
  }
  const formData = new FormData()
  formData.append('file', file)
  formData.append('fileName', normalizeString(file?.name))
  formData.append('contentType', normalizeString(file?.type))
  formData.append('samplingPlan', JSON.stringify(options?.samplingPlan || {}))
  formData.append('segments', JSON.stringify(options?.segments || []))
  formData.append('transcriptText', normalizeString(options?.transcriptText))
  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: buildHeaders(config.apiKey),
      body: formData
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(text || response.statusText || '服务端抽帧分析失败')
    }
    const parsed = text ? JSON.parse(text) : {}
    return parseServerResponse(parsed)
  } catch (error) {
    return {
      ok: false,
      summary: '',
      text: '',
      ocrText: '',
      transcriptText: '',
      segments: [],
      metadata: {
        bridgeError: error?.message || String(error)
      }
    }
  }
}
