const OUTPUT_KIND_RULES = [
  { kind: 'report', pattern: /(报告|审查报告|分析报告|评估报告|复核报告|生成.*报告)/ },
  { kind: 'image', pattern: /(图片|配图|海报|插图|图像|画图|生成.*图)/ },
  { kind: 'audio', pattern: /(音频|语音|朗读|播报|配音)/ },
  { kind: 'video', pattern: /(视频|短片|分镜|旁白视频|生成.*视频)/ },
  { kind: 'file', pattern: /(文件|导出|下载|另存|生成.*(?:docx|pdf|xlsx|ppt|markdown|md))/i }
]

function normalizeText(text = '') {
  return String(text || '').trim()
}

export function detectGeneratedOutputKind(text = '') {
  const normalized = normalizeText(text)
  if (!normalized) return null
  const matched = OUTPUT_KIND_RULES.find(rule => rule.pattern.test(normalized))
  return matched?.kind || null
}

export function buildGeneratedArtifact(input = {}, options = {}) {
  const kind = String(input.kind || detectGeneratedOutputKind(input.prompt) || options.kind || 'file').trim()
  const title = normalizeText(input.title || options.title || '生成结果')
  const content = String(input.content || '')
  const createdAt = options.createdAt || new Date().toISOString()
  return {
    id: String(input.id || `artifact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    kind,
    title,
    content,
    mimeType: input.mimeType || inferArtifactMimeType(kind, input.format || options.format),
    format: String(input.format || options.format || inferArtifactFormat(kind)).trim(),
    createdAt,
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {}
  }
}

export function inferArtifactFormat(kind = '') {
  if (kind === 'report') return 'markdown'
  if (kind === 'image') return 'png'
  if (kind === 'audio') return 'mp3'
  if (kind === 'video') return 'mp4'
  return 'txt'
}

export function inferArtifactMimeType(kind = '', format = '') {
  const normalizedFormat = String(format || inferArtifactFormat(kind)).toLowerCase()
  if (normalizedFormat === 'markdown' || normalizedFormat === 'md') return 'text/markdown'
  if (normalizedFormat === 'json') return 'application/json'
  if (normalizedFormat === 'pdf') return 'application/pdf'
  if (normalizedFormat === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (normalizedFormat === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (normalizedFormat === 'png') return 'image/png'
  if (normalizedFormat === 'mp3') return 'audio/mpeg'
  if (normalizedFormat === 'mp4') return 'video/mp4'
  return 'text/plain'
}

export function planGeneratedOutputFlow(text = '', options = {}) {
  const kind = detectGeneratedOutputKind(text)
  return {
    isGeneratedOutput: !!kind || options.force === true,
    kind: kind || options.kind || 'file',
    shouldCreateArtifact: !!kind || options.force === true,
    requiresDocumentMaterial: /(基于|根据|依据|结合|当前文档|全文|选区|这段|本段)/.test(normalizeText(text)),
    reason: kind ? `已识别为生成型输出：${kind}` : '未命中生成型输出规则'
  }
}

export default {
  detectGeneratedOutputKind,
  buildGeneratedArtifact,
  inferArtifactFormat,
  inferArtifactMimeType,
  planGeneratedOutputFlow
}
