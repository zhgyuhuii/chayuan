const DEFAULT_STATUS = 'ready'

function randomId(prefix = 'artifact') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function normalizeNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizeStringList(list = []) {
  return (Array.isArray(list) ? list : [])
    .map(item => normalizeString(item))
    .filter(Boolean)
}

export const ARTIFACT_KIND_LABELS = {
  file: '文件',
  plan: '计划',
  report: '报告',
  markdown: 'Markdown',
  json: 'JSON',
  csv: 'CSV',
  xlsx: 'Excel',
  image: '图片',
  audio: '音频',
  video: '视频',
  transcript: '转写结果',
  recognition: '识别结果',
  document: '文档',
  'encrypted-document': '加密文档'
}

export function inferArtifactKind(item = {}) {
  const explicitKind = normalizeString(item.kind)
  if (explicitKind) return explicitKind
  const extension = normalizeString(item.extension).toLowerCase()
  const mimeType = normalizeString(item.mimeType).toLowerCase()
  if (['md', 'markdown'].includes(extension) || mimeType.includes('markdown')) return 'markdown'
  if (extension === 'json' || mimeType.includes('json')) return 'json'
  if (extension === 'csv' || mimeType.includes('csv')) return 'csv'
  if (extension === 'xlsx' || mimeType.includes('spreadsheetml')) return 'xlsx'
  if (extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'webp' || mimeType.startsWith('image/')) return 'image'
  if (extension === 'mp3' || extension === 'wav' || extension === 'm4a' || mimeType.startsWith('audio/')) return 'audio'
  if (extension === 'mp4' || extension === 'mov' || extension === 'webm' || mimeType.startsWith('video/')) return 'video'
  if (extension === 'docx' || extension === 'pdf' || extension === 'doc' || mimeType.includes('word') || mimeType.includes('pdf')) return 'document'
  return 'file'
}

export function getArtifactKindLabel(kind) {
  const normalized = normalizeString(kind)
  return ARTIFACT_KIND_LABELS[normalized] || normalized || '文件'
}

export function createArtifactRecord(item = {}, options = {}) {
  const extension = normalizeString(item.extension || options.extension).replace(/^\.+/, '').toLowerCase()
  const artifactKind = inferArtifactKind({
    ...item,
    kind: item.kind || options.kind,
    extension
  })
  const createdAt = normalizeString(item.createdAt || options.createdAt, new Date().toISOString())
  const metadata = item.metadata && typeof item.metadata === 'object'
    ? { ...item.metadata }
    : (options.metadata && typeof options.metadata === 'object' ? { ...options.metadata } : {})
  const artifactId = normalizeString(item.id || options.id, randomId('artifact'))
  const parentArtifactIds = normalizeStringList(
    item.parentArtifactIds || options.parentArtifactIds || metadata.parentArtifactIds
  )
  const rootArtifactId = normalizeString(
    item.rootArtifactId || options.rootArtifactId || metadata.rootArtifactId,
    parentArtifactIds[0] || artifactId
  )
  return {
    id: artifactId,
    ownerType: normalizeString(item.ownerType || options.ownerType),
    ownerId: normalizeString(item.ownerId || options.ownerId),
    route: normalizeString(item.route || options.route),
    kind: artifactKind,
    label: getArtifactKindLabel(artifactKind),
    name: normalizeString(item.name || item.fileName || options.name || options.baseName, '未命名产物'),
    extension,
    mimeType: normalizeString(item.mimeType || options.mimeType),
    status: normalizeString(item.status || options.status, DEFAULT_STATUS),
    size: normalizeNumber(item.size || options.size),
    path: normalizeString(item.path || item.filePath || options.path),
    downloadUrl: normalizeString(item.downloadUrl || options.downloadUrl),
    textContent: typeof item.textContent === 'string'
      ? item.textContent
      : (typeof options.textContent === 'string' ? options.textContent : ''),
    previewText: normalizeString(item.previewText || options.previewText),
    sourceType: normalizeString(item.sourceType || options.sourceType),
    sourceName: normalizeString(item.sourceName || options.sourceName),
    parentArtifactIds,
    rootArtifactId,
    retentionTier: normalizeString(item.retentionTier || options.retentionTier, 'standard'),
    createdAt,
    updatedAt: normalizeString(item.updatedAt || options.updatedAt, createdAt),
    recognition: item.recognition && typeof item.recognition === 'object'
      ? { ...item.recognition }
      : (options.recognition && typeof options.recognition === 'object' ? { ...options.recognition } : null),
    metadata
  }
}

export function normalizeArtifactRecord(item = {}) {
  return createArtifactRecord(item, item)
}

export function normalizeArtifactList(list = [], options = {}) {
  return (Array.isArray(list) ? list : [])
    .filter(Boolean)
    .map(item => normalizeArtifactRecord({
      ...item,
      ownerType: item?.ownerType || options.ownerType,
      ownerId: item?.ownerId || options.ownerId,
      route: item?.route || options.route
    }))
}

export function artifactToLegacyGeneratedFile(artifact = {}) {
  const normalized = normalizeArtifactRecord(artifact)
  return {
    id: normalized.id,
    kind: normalized.kind,
    status: normalized.status,
    name: normalized.name,
    extension: normalized.extension,
    mimeType: normalized.mimeType,
    size: normalized.size,
    sizeLabel: normalized.size > 0 ? `${Math.max(1, Math.round(normalized.size / 1024))} KB` : '',
    downloadUrl: normalized.downloadUrl || '',
    textContent: normalized.textContent || '',
    filePath: normalized.path || '',
    previewText: normalized.previewText || ''
  }
}

export function buildArtifactSummaryLines(list = []) {
  return normalizeArtifactList(list).map((item) => {
    const parts = [
      item.name,
      item.label,
      item.path || '',
      item.recognition?.summary || ''
    ].filter(Boolean)
    return parts.join(' · ')
  })
}
