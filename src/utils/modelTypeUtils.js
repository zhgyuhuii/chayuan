/**
 * 模型类型推断 - 根据模型 id 判断用途类型
 * 用于默认模型设置分类、AI 助手仅显示对话模型等
 */

export const MODEL_TYPE_CHAT = 'chat'
export const MODEL_TYPE_EMBEDDING = 'embedding'
export const MODEL_TYPE_IMAGE = 'image'
export const MODEL_TYPE_VIDEO = 'video'
export const MODEL_TYPE_VOICE = 'voice'
export const MODEL_TYPE_TTS = 'tts'
export const MODEL_TYPE_ASR = 'asr'
export const MODEL_TYPE_AUDIO_UNDERSTANDING = 'audio-understanding'
export const MODEL_TYPE_VISION = 'vision'
export const MODEL_TYPE_IMAGE_GENERATION = 'image-generation'
export const MODEL_TYPE_VIDEO_GENERATION = 'video-generation'
export const MODEL_TYPE_VIDEO_UNDERSTANDING = 'video-understanding'

const EMBEDDING_PATTERNS = [
  /^text-embedding-/i,
  /embedding/i,
  /^embed-/i,
  /-embed$/i,
  /bge-|e5-|multilingual-e5/i,
  /jina-embeddings|voyage-|gte-|m3e-/i
]

const IMAGE_GENERATION_PATTERNS = [
  /^gpt-image/i,
  /dall-e/i,
  /stable-diffusion/i,
  /sdxl|flux|midjourney/i,
  /(^|[-_])(image|img)([-_]|$)/i,
  /image-generation|text-to-image|txt2img|t2i/i,
  /imagen|kandinsky|qwen-image|wanx.*t2i|ideogram|recraft/i
]

const VIDEO_GENERATION_PATTERNS = [
  /video-generation|text-to-video|txt2video|t2v/i,
  /(^|[-_])video([-_]|$)/i,
  /runway|sora|veo|kling|hailuo|pika|luma|vidu/i,
  /wanx.*t2v|-gen-2/i
]

const TTS_PATTERNS = [
  /(^|[-_])tts($|[-_])/i,
  /text-to-speech/i,
  /voice|vits|cosyvoice|bark|coqui/i,
  /speech(-|_)?synthesis/i
]

const ASR_PATTERNS = [
  /(^|[-_])asr($|[-_])/i,
  /whisper/i,
  /speech-to-text/i,
  /transcri/i
]

const AUDIO_UNDERSTANDING_PATTERNS = [
  /audio-understanding/i,
  /audio-analysis/i,
  /audio-qa/i,
  /listen/i,
  /speech-understanding/i
]

const VISION_PATTERNS = [
  /vision/i,
  /gemini.*vision/i,
  /qwen-vl|internvl|minicpm-v/i
]

const VIDEO_UNDERSTANDING_PATTERNS = [
  /video-understanding/i,
  /video-analysis/i,
  /video-qa/i
]

export function normalizeModelType(type) {
  const raw = String(type || '').trim().toLowerCase()
  if (!raw) return MODEL_TYPE_CHAT
  if (raw === MODEL_TYPE_VOICE) return MODEL_TYPE_TTS
  if (raw === MODEL_TYPE_IMAGE) return MODEL_TYPE_IMAGE_GENERATION
  if (raw === MODEL_TYPE_VIDEO) return MODEL_TYPE_VIDEO_GENERATION
  return raw
}

export function getModelTypeAliases(type) {
  const normalized = normalizeModelType(type)
  switch (normalized) {
    case MODEL_TYPE_IMAGE_GENERATION:
      return [MODEL_TYPE_IMAGE_GENERATION, MODEL_TYPE_IMAGE]
    case MODEL_TYPE_VIDEO_GENERATION:
      return [MODEL_TYPE_VIDEO_GENERATION, MODEL_TYPE_VIDEO]
    case MODEL_TYPE_TTS:
      return [MODEL_TYPE_TTS, MODEL_TYPE_VOICE]
    case MODEL_TYPE_ASR:
      return [MODEL_TYPE_ASR]
    case MODEL_TYPE_AUDIO_UNDERSTANDING:
      return [MODEL_TYPE_AUDIO_UNDERSTANDING]
    case MODEL_TYPE_VISION:
      return [MODEL_TYPE_VISION]
    case MODEL_TYPE_VIDEO_UNDERSTANDING:
      return [MODEL_TYPE_VIDEO_UNDERSTANDING]
    default:
      return [normalized]
  }
}

export function matchesModelType(actualType, expectedType) {
  const actualAliases = getModelTypeAliases(actualType)
  const expectedAliases = getModelTypeAliases(expectedType)
  return actualAliases.some(item => expectedAliases.includes(item))
}

/**
 * 根据模型 id 推断类型
 * @param {string} modelId - 模型 id
 * @returns {string} chat | embedding | image-generation | video-generation | tts | asr | vision | video-understanding
 */
export function inferModelType(modelId) {
  if (!modelId || typeof modelId !== 'string') return MODEL_TYPE_CHAT
  const id = modelId.toLowerCase()
  if (EMBEDDING_PATTERNS.some(p => p.test(id))) return MODEL_TYPE_EMBEDDING
  if (VIDEO_UNDERSTANDING_PATTERNS.some(p => p.test(id))) return MODEL_TYPE_VIDEO_UNDERSTANDING
  if (ASR_PATTERNS.some(p => p.test(id))) return MODEL_TYPE_ASR
  if (AUDIO_UNDERSTANDING_PATTERNS.some(p => p.test(id))) return MODEL_TYPE_AUDIO_UNDERSTANDING
  if (VISION_PATTERNS.some(p => p.test(id))) return MODEL_TYPE_VISION
  if (IMAGE_GENERATION_PATTERNS.some(p => p.test(id))) return MODEL_TYPE_IMAGE_GENERATION
  if (VIDEO_GENERATION_PATTERNS.some(p => p.test(id))) return MODEL_TYPE_VIDEO_GENERATION
  if (TTS_PATTERNS.some(p => p.test(id))) return MODEL_TYPE_TTS
  return MODEL_TYPE_CHAT
}

export function inferModelRecordType(model) {
  if (!model || typeof model !== 'object') return inferModelType(String(model || ''))
  const id = model.id || model.name || model.model || ''
  const rawType = String(model.type || model.modelType || model.category || '').trim().toLowerCase()
  if (rawType && rawType !== 'model') {
    if (/embed/.test(rawType)) return MODEL_TYPE_EMBEDDING
    if (/video.*understand|video.*analysis|video.*qa/.test(rawType)) return MODEL_TYPE_VIDEO_UNDERSTANDING
    if (/audio.*understand|audio.*analysis|audio.*qa/.test(rawType)) return MODEL_TYPE_AUDIO_UNDERSTANDING
    if (/vision|vl/.test(rawType)) return MODEL_TYPE_VISION
    if (/image|img|text-to-image|t2i/.test(rawType)) return MODEL_TYPE_IMAGE_GENERATION
    if (/video|text-to-video|t2v/.test(rawType)) return MODEL_TYPE_VIDEO_GENERATION
    if (/asr|transcri|speech-to-text/.test(rawType)) return MODEL_TYPE_ASR
    if (/tts|voice|speech/.test(rawType)) return MODEL_TYPE_TTS
    if (/chat|text|llm|completion/.test(rawType)) return MODEL_TYPE_CHAT
    return normalizeModelType(rawType)
  }
  return inferModelType(id)
}

/** 模型类型对应的显示标签 */
const MODEL_TYPE_LABELS = {
  [MODEL_TYPE_CHAT]: '对话模型',
  [MODEL_TYPE_EMBEDDING]: '嵌入式模型',
  [MODEL_TYPE_IMAGE]: '图像生成',
  [MODEL_TYPE_VIDEO]: '视频生成',
  [MODEL_TYPE_VOICE]: '语音生成',
  [MODEL_TYPE_TTS]: '语音生成',
  [MODEL_TYPE_ASR]: '语音识别',
  [MODEL_TYPE_AUDIO_UNDERSTANDING]: '音频理解',
  [MODEL_TYPE_VISION]: '图像理解',
  [MODEL_TYPE_IMAGE_GENERATION]: '图像生成',
  [MODEL_TYPE_VIDEO_GENERATION]: '视频生成',
  [MODEL_TYPE_VIDEO_UNDERSTANDING]: '视频理解'
}

/**
 * 获取模型类型的显示标签
 * @param {string} type - chat | embedding | image | video
 * @returns {string}
 */
export function getModelTypeLabel(type) {
  const normalized = normalizeModelType(type)
  return MODEL_TYPE_LABELS[normalized] || MODEL_TYPE_LABELS[type] || type || '对话'
}
