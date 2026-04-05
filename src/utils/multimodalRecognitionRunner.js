import { chatCompletion } from './chatApi.js'
import { getFlatModelsFromSettings } from './modelSettings.js'
import { transcribeAudioAsset } from './mediaApi.js'
import {
  MODEL_TYPE_ASR,
  MODEL_TYPE_AUDIO_UNDERSTANDING,
  MODEL_TYPE_CHAT,
  MODEL_TYPE_VIDEO_UNDERSTANDING,
  MODEL_TYPE_VISION
} from './modelTypeUtils.js'
import { createArtifactRecord } from './artifactTypes.js'
import { requestServerSideVideoAnalysis } from './multimodalServerBridge.js'

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function detectAttachmentKind(file = {}) {
  const type = String(file?.type || '').toLowerCase()
  const name = String(file?.name || '').toLowerCase()
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return 'image'
  if (type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(name)) return 'audio'
  if (type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(name)) return 'video'
  return ''
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取附件失败'))
    reader.readAsDataURL(file)
  })
}

function waitForMediaEvent(target, successEvent, errorEvent = 'error') {
  return new Promise((resolve, reject) => {
    const handleSuccess = () => {
      cleanup()
      resolve(true)
    }
    const handleError = () => {
      cleanup()
      reject(new Error('读取视频媒体失败'))
    }
    const cleanup = () => {
      target.removeEventListener(successEvent, handleSuccess)
      target.removeEventListener(errorEvent, handleError)
    }
    target.addEventListener(successEvent, handleSuccess, { once: true })
    target.addEventListener(errorEvent, handleError, { once: true })
  })
}

function formatVideoTimestamp(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

async function extractVideoFrames(file, options = {}) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return { frames: [], duration: 0, width: 0, height: 0 }
  }
  const frameCount = Math.max(1, Number(options.frameCount || 3))
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.src = objectUrl
  try {
    await waitForMediaEvent(video, 'loadedmetadata')
    const duration = Number.isFinite(video.duration) ? Math.max(video.duration, 0) : 0
    const width = Number(video.videoWidth || 0)
    const height = Number(video.videoHeight || 0)
    if (!width || !height) {
      return { frames: [], duration, width, height }
    }
    const canvas = document.createElement('canvas')
    const scale = width > 960 ? (960 / width) : 1
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) {
      return { frames: [], duration, width, height }
    }
    const frames = []
    const safeDuration = duration > 0 ? duration : 1
    const timestamps = Array.from({ length: frameCount }, (_, index) => {
      if (frameCount === 1) return Math.min(0.5, Math.max(safeDuration * 0.5, 0))
      const ratio = (index + 1) / (frameCount + 1)
      return Math.max(0, Math.min(safeDuration - 0.05, safeDuration * ratio))
    })
    for (const timestamp of timestamps) {
      await new Promise((resolve, reject) => {
        const handleSeeked = () => {
          cleanup()
          resolve(true)
        }
        const handleError = () => {
          cleanup()
          reject(new Error('视频抽帧失败'))
        }
        const cleanup = () => {
          video.removeEventListener('seeked', handleSeeked)
          video.removeEventListener('error', handleError)
        }
        video.addEventListener('seeked', handleSeeked, { once: true })
        video.addEventListener('error', handleError, { once: true })
        video.currentTime = timestamp
      })
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      frames.push({
        timestamp,
        dataUrl: canvas.toDataURL('image/jpeg', 0.82)
      })
    }
    return {
      frames,
      duration,
      width,
      height,
      sampleStrategy: options.sampleStrategy || 'uniform'
    }
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}

function buildVideoSamplingPlan(file) {
  const sizeMb = Math.max(0, Number(file?.size || 0) / (1024 * 1024))
  if (sizeMb >= 180) {
    return { frameCount: 8, sampleStrategy: 'long-video-segmented', useServerFallback: true }
  }
  if (sizeMb >= 80) {
    return { frameCount: 6, sampleStrategy: 'wide-uniform', useServerFallback: true }
  }
  return { frameCount: 3, sampleStrategy: 'uniform', useServerFallback: false }
}

function buildVideoSegments(extracted = {}) {
  const duration = Math.max(0, Number(extracted?.duration || 0))
  const frames = Array.isArray(extracted?.frames) ? extracted.frames : []
  if (duration <= 0 || frames.length === 0) return []
  return frames.map((frame, index) => {
    const previous = index === 0 ? 0 : Number(frames[index - 1]?.timestamp || 0)
    const next = index === frames.length - 1 ? duration : Number(frames[index + 1]?.timestamp || duration)
    return {
      index: index + 1,
      startAt: Math.max(0, Math.round(previous)),
      endAt: Math.max(Math.round(frame.timestamp || 0), Math.round(next)),
      focusAt: Math.round(Number(frame.timestamp || 0))
    }
  })
}

function buildVideoSceneSegments(segments = [], extracted = {}) {
  const frames = Array.isArray(extracted?.frames) ? extracted.frames : []
  return (Array.isArray(segments) ? segments : []).map((segment, index) => ({
    ...segment,
    sceneId: `scene_${index + 1}`,
    sceneLabel: `场景 ${index + 1}`,
    keyFrameTimestamp: Number(frames[index]?.timestamp || segment?.focusAt || 0)
  }))
}

function getFirstConfiguredModel(modelType) {
  return getFlatModelsFromSettings(modelType)[0] || null
}

function resolveRecognitionModels(kind = '') {
  if (kind === 'audio') {
    return {
      transcriptModel: getFirstConfiguredModel(MODEL_TYPE_ASR),
      understandingModel: getFirstConfiguredModel(MODEL_TYPE_AUDIO_UNDERSTANDING) || getFirstConfiguredModel(MODEL_TYPE_CHAT)
    }
  }
  if (kind === 'video') {
    return {
      visualModel: getFirstConfiguredModel(MODEL_TYPE_VIDEO_UNDERSTANDING) || getFirstConfiguredModel(MODEL_TYPE_VISION),
      transcriptModel: getFirstConfiguredModel(MODEL_TYPE_ASR),
      fallbackModel: getFirstConfiguredModel(MODEL_TYPE_CHAT)
    }
  }
  return {
    visualModel: getFirstConfiguredModel(MODEL_TYPE_VISION),
    fallbackModel: getFirstConfiguredModel(MODEL_TYPE_CHAT)
  }
}

function buildFallbackSummary(file, kind, reason = '') {
  const name = normalizeString(file?.name, '未命名附件')
  const size = Number(file?.size || 0)
  const sizeLabel = size > 0 ? `${Math.max(1, Math.round(size / 1024))} KB` : ''
  const type = normalizeString(file?.type)
  const parts = [
    `已接收${kind === 'image' ? '图片' : kind === 'audio' ? '音频' : kind === 'video' ? '视频' : '多媒体'}附件：${name}`,
    sizeLabel ? `大小 ${sizeLabel}` : '',
    type ? `类型 ${type}` : '',
    reason
  ].filter(Boolean)
  return parts.join('；')
}

async function recognizeImage(file) {
  const model = getFirstConfiguredModel(MODEL_TYPE_VISION)
  if (!model) {
    return {
      ok: false,
      kind: 'image',
      summary: buildFallbackSummary(file, 'image', '当前未配置图像理解模型，已保留附件元信息。'),
      text: '',
      modelDisplayName: ''
    }
  }
  const dataUrl = await readFileAsDataUrl(file)
  const [text, ocrText] = await Promise.all([
    chatCompletion({
      providerId: model.providerId,
      modelId: model.modelId,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: '你是一名图像理解助手。请用中文输出简洁结果，结构包括：主题、画面关键信息、图片中可见文字（如有）、可用于当前会话的结论。不要输出 Markdown 代码块。'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请识别这张图片，并给出可供后续问答直接使用的摘要。' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ]
    }),
    chatCompletion({
      providerId: model.providerId,
      modelId: model.modelId,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: '你是一名 OCR 提取助手。请仅提取图片中肉眼可见的文字内容，按自然阅读顺序输出纯文本；如果没有可见文字，输出“未识别到明确文字”。不要额外解释。'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请提取图片中的文字。' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ]
    }).catch(() => '')
  ])
  return {
    ok: true,
    kind: 'image',
    summary: `已完成图片识别：${normalizeString(file?.name, '未命名图片')}`,
    text: normalizeString(text),
    modelDisplayName: model.name || model.modelId || model.id,
    recognitionMode: 'vision-ocr-summary',
    metadata: {
      ocrText: normalizeString(ocrText)
    }
  }
}

async function recognizeAudio(file) {
  const { transcriptModel, understandingModel } = resolveRecognitionModels('audio')
  if (!transcriptModel && !understandingModel) {
    return {
      ok: false,
      kind: 'audio',
      summary: buildFallbackSummary(file, 'audio', '当前未配置音频识别/理解模型，已保留附件元信息。'),
      text: '',
      modelDisplayName: '',
      metadata: {
        transcriptModelType: '',
        understandingModelType: ''
      }
    }
  }
  let transcriptText = ''
  if (transcriptModel) {
    const result = await transcribeAudioAsset({
      providerId: transcriptModel.providerId,
      modelId: transcriptModel.modelId,
      file
    })
    transcriptText = normalizeString(result?.text)
  }
  if (!transcriptText) {
    return {
      ok: !!understandingModel,
      kind: 'audio',
      summary: buildFallbackSummary(file, 'audio', '当前仅检测到音频理解模型，但缺少可用转写结果，建议补充 ASR 模型后再做深度理解。'),
      text: '',
      modelDisplayName: understandingModel?.name || understandingModel?.modelId || understandingModel?.id || '',
      recognitionMode: 'audio-metadata-fallback',
      metadata: {
        transcriptModelType: transcriptModel?.type || '',
        transcriptModelName: transcriptModel?.name || transcriptModel?.modelId || transcriptModel?.id || '',
        understandingModelType: understandingModel?.type || (understandingModel ? MODEL_TYPE_AUDIO_UNDERSTANDING : ''),
        understandingModelName: understandingModel?.name || understandingModel?.modelId || understandingModel?.id || '',
        transcriptLength: 0
      }
    }
  }
  let understandingText = ''
  if (understandingModel && transcriptText) {
    understandingText = normalizeString(await chatCompletion({
      providerId: understandingModel.providerId,
      modelId: understandingModel.modelId,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: '你是一名音频理解助手。请基于给定转写内容，用中文输出简洁结果，结构包括：主题、关键信息、情绪/语气、可用于当前会话的结论。不要输出 Markdown 代码块。'
        },
        {
          role: 'user',
          content: [
            `文件名：${normalizeString(file?.name, '未命名音频')}`,
            normalizeString(file?.type) ? `类型：${normalizeString(file.type)}` : '',
            Number(file?.size || 0) > 0 ? `大小：${Math.max(1, Math.round(Number(file.size) / 1024))} KB` : '',
            `音频转写：${transcriptText.slice(0, 4000)}`
          ].filter(Boolean).join('\n')
        }
      ]
    }))
  }
  return {
    ok: true,
    kind: 'audio',
    summary: understandingText
      ? `已完成音频转写与理解：${normalizeString(file?.name, '未命名音频')}`
      : `已完成音频转写：${normalizeString(file?.name, '未命名音频')}`,
    text: [understandingText, transcriptText ? `\n\n转写全文：\n${transcriptText}` : ''].filter(Boolean).join(''),
    modelDisplayName: understandingModel?.name || understandingModel?.modelId || understandingModel?.id || transcriptModel?.name || transcriptModel?.modelId || transcriptModel?.id || '',
    recognitionMode: understandingText ? 'audio-understanding-with-transcript' : 'asr-transcript',
    metadata: {
      transcriptModelType: transcriptModel?.type || (transcriptModel ? MODEL_TYPE_ASR : ''),
      transcriptModelName: transcriptModel?.name || transcriptModel?.modelId || transcriptModel?.id || '',
      understandingModelType: understandingModel?.type || (understandingModel ? MODEL_TYPE_AUDIO_UNDERSTANDING : ''),
      understandingModelName: understandingModel?.name || understandingModel?.modelId || understandingModel?.id || '',
      transcriptLength: transcriptText.length
    }
  }
}

async function recognizeVideo(file) {
  const { visualModel: frameModel, fallbackModel, transcriptModel: asrModel } = resolveRecognitionModels('video')
  const samplingPlan = buildVideoSamplingPlan(file)
  const extracted = await extractVideoFrames(file, samplingPlan)
  const segments = buildVideoSegments(extracted)
  const sceneSegments = buildVideoSceneSegments(segments, extracted)
  let transcriptText = ''
  if (asrModel) {
    try {
      const transcript = await transcribeAudioAsset({
        providerId: asrModel.providerId,
        modelId: asrModel.modelId,
        file
      })
      transcriptText = normalizeString(transcript?.text)
    } catch (_) {
      transcriptText = ''
    }
  }
  const serverFallbackResult = samplingPlan.useServerFallback
    ? await requestServerSideVideoAnalysis(file, {
      samplingPlan,
      segments: sceneSegments,
      transcriptText
    })
    : null
  if (serverFallbackResult?.ok && normalizeString(serverFallbackResult?.text || serverFallbackResult?.summary)) {
    return {
      ok: true,
      kind: 'video',
      summary: normalizeString(serverFallbackResult.summary, `已完成服务端视频分析：${normalizeString(file?.name, '未命名视频')}`),
      text: normalizeString(serverFallbackResult.text || serverFallbackResult.summary),
      modelDisplayName: 'server-fallback',
      recognitionMode: 'server-fallback-analysis',
      metadata: {
        transcriptModelType: asrModel?.type || (asrModel ? MODEL_TYPE_ASR : ''),
        transcriptModelName: asrModel?.name || asrModel?.modelId || asrModel?.id || '',
        duration: extracted.duration || 0,
        width: extracted.width || 0,
        height: extracted.height || 0,
        sampleStrategy: samplingPlan.sampleStrategy,
        useServerFallback: true,
        serverFallbackUsed: true,
        transcriptLength: transcriptText.length,
        ocrText: normalizeString(serverFallbackResult.ocrText),
        segments: Array.isArray(serverFallbackResult.segments) && serverFallbackResult.segments.length > 0
          ? serverFallbackResult.segments
          : sceneSegments,
        ...((serverFallbackResult.metadata && typeof serverFallbackResult.metadata === 'object') ? serverFallbackResult.metadata : {})
      }
    }
  }
  if (!frameModel && !fallbackModel) {
    return {
      ok: false,
      kind: 'video',
      summary: buildFallbackSummary(file, 'video', '当前未配置视频理解模型，已保留附件元信息。'),
      text: transcriptText,
      modelDisplayName: '',
      recognitionMode: 'unavailable'
    }
  }
  const activeModel = frameModel || fallbackModel
  const hasFrames = Array.isArray(extracted.frames) && extracted.frames.length > 0
  const canUseFrameUnderstanding = hasFrames && !!frameModel
  const usesMetadataFallback = !canUseFrameUnderstanding
  const userContent = [
    {
      type: 'text',
      text: [
        `文件名：${normalizeString(file?.name, '未命名视频')}`,
        normalizeString(file?.type) ? `类型：${normalizeString(file.type)}` : '',
        Number(file?.size || 0) > 0 ? `大小：${Math.max(1, Math.round(Number(file.size) / 1024))} KB` : '',
        extracted.duration > 0 ? `时长：${formatVideoTimestamp(extracted.duration)}` : '',
        extracted.width > 0 && extracted.height > 0 ? `分辨率：${extracted.width}x${extracted.height}` : '',
        samplingPlan.sampleStrategy ? `抽帧策略：${samplingPlan.sampleStrategy}` : '',
        transcriptText ? `音频转写摘录：${transcriptText.slice(0, 1200)}` : '音频转写摘录：未获取到可用转写。',
        segments.length > 0 ? `分段信息：${segments.map(item => `${item.index}:${formatVideoTimestamp(item.startAt)}-${formatVideoTimestamp(item.endAt)}`).join('；')}` : '',
        sceneSegments.length > 0 ? `场景信息：${sceneSegments.map(item => `${item.sceneLabel}:${formatVideoTimestamp(item.startAt)}-${formatVideoTimestamp(item.endAt)}`).join('；')}` : '',
        canUseFrameUnderstanding
          ? `以下附带 ${extracted.frames.length} 张关键帧，请结合时间点分析视频主题、关键画面、字幕/可见文字（如有）、主要事件和可供当前会话直接使用的结论。`
          : (samplingPlan.useServerFallback
              ? '当前本地关键帧抽取不足，请退化为基于元信息、音频转写和长视频分段策略的服务端友好摘要，并明确仍需人工复核的画面部分。'
              : '当前无法抽取关键帧，请基于元信息和音频转写给出可确认的信息，并明确仍需人工复核的视频画面部分。')
      ].filter(Boolean).join('\n')
    }
  ]
  if (canUseFrameUnderstanding) {
    extracted.frames.forEach((frame, index) => {
      userContent.push({
        type: 'text',
        text: `关键帧 ${index + 1}（${formatVideoTimestamp(frame.timestamp)}）`
      })
      userContent.push({
        type: 'image_url',
        image_url: { url: frame.dataUrl }
      })
    })
  }
  const text = await chatCompletion({
    providerId: activeModel.providerId,
    modelId: activeModel.modelId,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: '你是一名视频理解助手。请用中文输出简洁结果，结构包括：主题、关键画面、字幕/可见文字、音频要点、可用于当前会话的结论。不要输出 Markdown 代码块。'
      },
      { role: 'user', content: userContent }
    ]
  })
  return {
    ok: true,
    kind: 'video',
    summary: usesMetadataFallback
      ? `已生成视频元信息理解摘要：${normalizeString(file?.name, '未命名视频')}`
      : `已完成关键帧视频理解：${normalizeString(file?.name, '未命名视频')}`,
    text: normalizeString(text),
    modelDisplayName: activeModel.name || activeModel.modelId || activeModel.id,
    recognitionMode: usesMetadataFallback
      ? (samplingPlan.useServerFallback ? 'long-video-fallback' : 'metadata-fallback')
      : 'video-frames-understanding',
    metadata: {
      understandingModelType: frameModel?.type || (frameModel ? MODEL_TYPE_VIDEO_UNDERSTANDING : ''),
      understandingModelName: frameModel?.name || frameModel?.modelId || frameModel?.id || '',
      transcriptModelType: asrModel?.type || (asrModel ? MODEL_TYPE_ASR : ''),
      transcriptModelName: asrModel?.name || asrModel?.modelId || asrModel?.id || '',
      fallbackModelType: fallbackModel?.type || (fallbackModel ? MODEL_TYPE_CHAT : ''),
      fallbackModelName: fallbackModel?.name || fallbackModel?.modelId || fallbackModel?.id || '',
      duration: extracted.duration || 0,
      width: extracted.width || 0,
      height: extracted.height || 0,
      sampleStrategy: samplingPlan.sampleStrategy,
      segmentCount: segments.length,
      frameCount: Array.isArray(extracted.frames) ? extracted.frames.length : 0,
      useServerFallback: samplingPlan.useServerFallback === true,
      serverFallbackUsed: false,
      sceneSegmentCount: sceneSegments.length,
      segments: sceneSegments
    }
  }
}

export async function recognizeMultimodalAttachment(file, options = {}) {
  const kind = detectAttachmentKind(file)
  if (!kind) return null
  const result = kind === 'image'
    ? await recognizeImage(file)
    : kind === 'audio'
      ? await recognizeAudio(file)
      : await recognizeVideo(file)
  return {
    ...result,
    artifact: createArtifactRecord({
      kind: result.ok ? 'recognition' : 'file',
      ownerType: options.ownerType || 'attachment',
      ownerId: options.ownerId || normalizeString(file?.name),
      route: 'multimodal-recognition',
      name: `${normalizeString(file?.name, '附件')}_${kind === 'audio' ? '转写' : '识别结果'}.md`,
      extension: 'md',
      mimeType: 'text/markdown;charset=utf-8',
      textContent: result.text,
      previewText: result.text.slice(0, 240),
      recognition: {
        kind,
        ok: result.ok === true,
        summary: result.summary,
        modelDisplayName: result.modelDisplayName || '',
        mode: result.recognitionMode || '',
        metadata: result.metadata || null
      }
    })
  }
}

export function isRecognizableMultimodalAttachment(file) {
  return !!detectAttachmentKind(file)
}
