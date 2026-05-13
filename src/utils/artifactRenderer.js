import { createArtifactRecord } from './artifactTypes.js'

// xlsx ≈ 600KB+ minified; eagerly importing它会把整个主 bundle (index-*.js) 拉到 ~1.2MB,
// 而它只有 xlsx 格式才需要。改为按需动态加载,主 bundle 显著瘦身,文档打开/任务窗格首屏更快。
let _xlsxModulePromise = null
function _loadXlsx() {
  if (!_xlsxModulePromise) _xlsxModulePromise = import('xlsx')
  return _xlsxModulePromise
}

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function safeJsonParse(raw, fallback = null) {
  if (raw == null || raw === '') return fallback
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch (_) {
    return fallback
  }
}

function parseDelimitedText(text = '') {
  const normalized = String(text || '').trim()
  if (!normalized) return []
  const lines = normalized.split(/\r?\n/).filter(Boolean)
  return lines.map(line => line.split(',').map(cell => cell.trim()))
}

function normalizeRows(data) {
  if (typeof data === 'string') {
    const parsed = parseDelimitedText(data)
    if (parsed.length > 1 || (parsed.length === 1 && parsed[0].length > 1)) {
      return parsed
    }
  }
  if (Array.isArray(data) && data.every(item => Array.isArray(item))) {
    return data
  }
  if (Array.isArray(data) && data.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
    const headerSet = new Set()
    data.forEach((row) => {
      Object.keys(row).forEach((key) => headerSet.add(key))
    })
    const headers = Array.from(headerSet)
    return [
      headers,
      ...data.map((row) => headers.map((key) => row?.[key] ?? ''))
    ]
  }
  if (data && typeof data === 'object') {
    return [
      ['key', 'value'],
      ...Object.entries(data).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : value])
    ]
  }
  const text = normalizeString(data)
  return text
    ? [['content'], [text]]
    : [['content']]
}

function escapeCsvCell(value) {
  const raw = value == null ? '' : String(value)
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw
}

function rowsToCsv(rows = []) {
  return rows.map(row => (Array.isArray(row) ? row : [row]).map(escapeCsvCell).join(',')).join('\n')
}

function rowsToMarkdown(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return ''
  const normalized = rows.map(row => Array.isArray(row) ? row.map(value => String(value ?? '')) : [String(row ?? '')])
  const header = normalized[0]
  const divider = header.map(() => '---')
  const body = normalized.slice(1)
  return [
    `| ${header.join(' | ')} |`,
    `| ${divider.join(' | ')} |`,
    ...body.map(row => `| ${row.join(' | ')} |`)
  ].join('\n')
}

function objectToMarkdown(data) {
  if (Array.isArray(data)) {
    return rowsToMarkdown(normalizeRows(data))
  }
  if (data && typeof data === 'object') {
    return Object.entries(data)
      .map(([key, value]) => `- **${key}**: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '')}`)
      .join('\n')
  }
  return String(data || '')
}

function buildBlob(content, mimeType) {
  return new Blob([content], { type: mimeType })
}

function buildWorkbookFromStructuredData(XLSX, data, defaultSheetName = 'Sheet1') {
  const workbook = XLSX.utils.book_new()
  const structuredSheets = Array.isArray(data?.sheets) ? data.sheets : null
  if (structuredSheets && structuredSheets.length > 0) {
    structuredSheets.forEach((sheetItem, index) => {
      const sheetName = normalizeString(sheetItem?.name, `${defaultSheetName}${index + 1}`)
      const columns = Array.isArray(sheetItem?.columns) ? sheetItem.columns.map(value => String(value ?? '')) : []
      const rows = Array.isArray(sheetItem?.rows) ? sheetItem.rows : []
      const aoa = columns.length > 0 ? [columns, ...rows] : normalizeRows(rows)
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), sheetName)
    })
    return workbook
  }
  const sheet = XLSX.utils.aoa_to_sheet(normalizeRows(data))
  XLSX.utils.book_append_sheet(workbook, sheet, defaultSheetName)
  return workbook
}

async function buildXlsxBlobAsync(data, sheetName = 'Sheet1') {
  const XLSX = await _loadXlsx()
  const workbook = buildWorkbookFromStructuredData(XLSX, data, sheetName)
  const array = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return new Blob([array], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
}

export function renderArtifactContent(content, options = {}) {
  const format = normalizeString(options.format || options.extension, 'md').toLowerCase()
  const data = safeJsonParse(content, content)
  if (format === 'json') {
    const normalized = typeof data === 'string' ? safeJsonParse(data, data) : data
    const text = typeof normalized === 'string' ? normalized : JSON.stringify(normalized, null, 2)
    return {
      extension: 'json',
      mimeType: 'application/json;charset=utf-8',
      textContent: text,
      blob: buildBlob(text, 'application/json;charset=utf-8'),
      previewText: text.slice(0, 240)
    }
  }
  if (format === 'csv') {
    const text = rowsToCsv(normalizeRows(data))
    return {
      extension: 'csv',
      mimeType: 'text/csv;charset=utf-8',
      textContent: text,
      blob: buildBlob(text, 'text/csv;charset=utf-8'),
      previewText: text.slice(0, 240)
    }
  }
  if (format === 'xlsx') {
    // 同步入口不直接处理 xlsx,避免把 xlsx 拉进主 bundle;调用方应改用 renderArtifactContentAsync。
    throw new Error('xlsx artifact must be rendered via renderArtifactContentAsync()')
  }
  if (format === 'html') {
    const rows = normalizeRows(data)
    const html = [
      '<table>',
      ...rows.map((row, index) => {
        const tag = index === 0 ? 'th' : 'td'
        return `<tr>${row.map(cell => `<${tag}>${String(cell ?? '')}</${tag}>`).join('')}</tr>`
      }),
      '</table>'
    ].join('')
    return {
      extension: 'html',
      mimeType: 'text/html;charset=utf-8',
      textContent: html,
      blob: buildBlob(html, 'text/html;charset=utf-8'),
      previewText: html.slice(0, 240)
    }
  }
  if (format === 'txt') {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    return {
      extension: 'txt',
      mimeType: 'text/plain;charset=utf-8',
      textContent: text,
      blob: buildBlob(text, 'text/plain;charset=utf-8'),
      previewText: text.slice(0, 240)
    }
  }
  const text = typeof data === 'string' ? data : objectToMarkdown(data)
  return {
    extension: 'md',
    mimeType: 'text/markdown;charset=utf-8',
    textContent: text,
    blob: buildBlob(text, 'text/markdown;charset=utf-8'),
    previewText: text.slice(0, 240)
  }
}

function _buildArtifactRecordFromRendered(rendered, options) {
  const downloadUrl = URL.createObjectURL(rendered.blob)
  return createArtifactRecord({
    kind: options.kind || options.route || 'report',
    ownerType: options.ownerType,
    ownerId: options.ownerId,
    route: options.route,
    name: `${normalizeString(options.baseName, '生成结果')}.${rendered.extension}`,
    extension: rendered.extension,
    mimeType: rendered.mimeType,
    size: Number(rendered.blob?.size || 0),
    downloadUrl,
    textContent: rendered.textContent,
    previewText: rendered.previewText,
    sourceType: options.sourceType || 'rendered-content',
    sourceName: options.sourceName || '',
    parentArtifactIds: options.parentArtifactIds || [],
    rootArtifactId: options.rootArtifactId || '',
    retentionTier: options.retentionTier || 'standard'
  })
}

export function createRenderedArtifact(content, options = {}) {
  return _buildArtifactRecordFromRendered(renderArtifactContent(content, options), options)
}

// renderArtifactContent 的 xlsx 异步变体:非 xlsx 直接走同步路径(零额外成本),xlsx 走动态导入。
export async function renderArtifactContentAsync(content, options = {}) {
  const format = normalizeString(options.format || options.extension, 'md').toLowerCase()
  if (format !== 'xlsx') return renderArtifactContent(content, options)
  const data = safeJsonParse(content, content)
  const blob = await buildXlsxBlobAsync(data, normalizeString(options.sheetName, 'Sheet1'))
  return {
    extension: 'xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    textContent: '',
    blob,
    previewText: rowsToCsv(normalizeRows(data)).slice(0, 240)
  }
}

export async function createRenderedArtifactAsync(content, options = {}) {
  const rendered = await renderArtifactContentAsync(content, options)
  return _buildArtifactRecordFromRendered(rendered, options)
}
