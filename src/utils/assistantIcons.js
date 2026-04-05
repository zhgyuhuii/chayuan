import { getIconData, iconToSVG, iconToHTML } from '@iconify/utils'
import { ensureDir, getDefaultDataPath, getEffectiveDataDir, pathJoin } from './dataPathSettings.js'

export const DEFAULT_ASSISTANT_ICON = 'images/ai-assistant.svg'

export const ASSISTANT_ICON_LIBRARY = [
  { id: 'assistant', label: '智能助手', category: '通用', path: 'images/ai-assistant.svg' },
  { id: 'summary', label: '摘要报告', category: '写作', path: 'images/report.svg' },
  { id: 'check', label: '检查校对', category: '分析', path: 'images/check.svg' },
  { id: 'rewrite', label: '改写润色', category: '写作', path: 'images/replace-text.svg' },
  { id: 'expand', label: '扩展增强', category: '写作', path: 'images/refresh.svg' },
  { id: 'clean', label: '精简清理', category: '写作', path: 'images/clean.svg' },
  { id: 'translate', label: '翻译语言', category: '语言', path: 'images/ai-websites.svg' },
  { id: 'keyword', label: '重点提炼', category: '分析', path: 'images/select-all.svg' },
  { id: 'number', label: '结构编号', category: '分析', path: 'images/number.svg' },
  { id: 'comment', label: '批注说明', category: '分析', path: 'images/add-caption.svg' },
  { id: 'image', label: '图像创作', category: '多媒体', path: 'images/select-images.svg' },
  { id: 'video', label: '视频生成', category: '多媒体', path: 'images/task-orchestration.svg' },
  { id: 'security', label: '安全审查', category: '安全', path: 'images/declassify-check.svg' },
  { id: 'discussion', label: '协作讨论', category: '协作', path: 'images/discussion-group.svg' },
  { id: 'requirement', label: '需求整理', category: '协作', path: 'images/requirement.svg' },
  { id: 'settings', label: '设置工具', category: '通用', path: 'images/settings.svg' }
]

export const ASSISTANT_ICON_PICKER_LIBRARIES = [
  { id: 'vue-unicons', label: 'Vue Unicons', note: '', sourceType: 'iconify' },
  { id: 'vue-awesome', label: 'Vue-awesome', note: '', sourceType: 'iconify' },
  { id: 'vue-material-design', label: 'Vue Material Design', note: '', sourceType: 'iconify' },
  { id: 'vuetify', label: 'Vuetify', note: '使用 MDI 兼容集', sourceType: 'iconify' },
  { id: 'at-ui', label: 'AT UI', note: '使用 Ionicons 兼容集', sourceType: 'iconify' },
  { id: 'iview', label: 'iView', note: '使用 Ionicons 兼容集', sourceType: 'iconify' },
  { id: 'icomoon', label: 'Icomoon', note: '', sourceType: 'iconify' },
  { id: 'iconmonstr', label: 'IconMonstr', note: '使用精选内置 SVG 图标', sourceType: 'preset' }
]

export const DEFAULT_ASSISTANT_ICON_LIBRARY_ID = ASSISTANT_ICON_PICKER_LIBRARIES[0]?.id || 'vue-unicons'

const ASSISTANT_ICON_PATH_SET = new Set(ASSISTANT_ICON_LIBRARY.map(item => item.path))
const DATA_URL_RE = /^data:image\/svg\+xml/i
const PNG_DATA_URL_RE = /^data:image\/png;base64,/i
const pickerLibraryMap = new Map(ASSISTANT_ICON_PICKER_LIBRARIES.map(item => [item.id, item]))
const libraryOptionCache = new Map()
const libraryDataCache = new Map()
const iconValueCache = new Map()
const ribbonIconPathCache = new Map()
const RIBBON_ICON_DEBUG_FILE = 'ribbon_icon_debug.json'

const ICONIFY_LIBRARY_LOADERS = {
  'vue-unicons': () => import('@iconify-json/uil/icons.json'),
  'vue-awesome': () => import('@iconify-json/fa6-solid/icons.json'),
  'vue-material-design': () => import('@iconify-json/mdi/icons.json'),
  vuetify: () => import('@iconify-json/mdi/icons.json'),
  'at-ui': () => import('@iconify-json/ion/icons.json'),
  iview: () => import('@iconify-json/ion/icons.json'),
  icomoon: () => import('@iconify-json/icomoon-free/icons.json')
}

function toTitle(text) {
  return String(text || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())
}

function svgToDataUrl(svg) {
  const content = String(svg || '')
  try {
    if (typeof btoa === 'function') {
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(content)))}`
    }
  } catch (_) {}
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`
}

function normalizeGeneratedSvgMarkup(svg) {
  return String(svg || '')
    .replace(/\s(width|height)="1em"/g, '')
    .replace(/\sstyle="[^"]*"/g, '')
    .trim()
}

function decodeSvgDataUrl(dataUrl) {
  const value = String(dataUrl || '').trim()
  const commaIndex = value.indexOf(',')
  if (commaIndex < 0) return ''
  const meta = value.slice(0, commaIndex)
  const payload = value.slice(commaIndex + 1)
  try {
    if (/;base64/i.test(meta) && typeof atob === 'function') {
      return decodeURIComponent(escape(atob(payload)))
    }
    return decodeURIComponent(payload)
  } catch (_) {
    return ''
  }
}

function normalizeSvgDataUrl(dataUrl) {
  const svg = decodeSvgDataUrl(dataUrl)
  return svg ? svgToDataUrl(svg) : String(dataUrl || '').trim()
}

function hashText(text) {
  const source = String(text || '')
  let hash = 0
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

function sanitizeFileName(text) {
  return String(text || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'assistant'
}

function toFileUrl(path) {
  const normalized = String(path || '').trim().replace(/\\/g, '/')
  if (!normalized) return ''
  const withLeadingSlash = /^[a-zA-Z]:\//.test(normalized) ? `/${normalized}` : normalized
  return `file://${encodeURI(withLeadingSlash)}`
}

function writeRibbonIconDebug(payload) {
  try {
    const fs = window.Application?.FileSystem
    const writeFile = fs?.writeFileString || fs?.WriteFile
    if (!fs || typeof writeFile !== 'function') return
    const baseDir = getEffectiveDataDir() || getDefaultDataPath()
    if (!baseDir) return
    const iconDir = pathJoin(baseDir, 'assistant_icon_cache')
    ensureDir(fs, baseDir)
    ensureDir(fs, iconDir)
    writeFile.call(fs, pathJoin(iconDir, RIBBON_ICON_DEBUG_FILE), JSON.stringify({
      ...payload,
      updatedAt: new Date().toISOString()
    }, null, 2))
  } catch (_) {}
}

function pngDataUrlToBase64(dataUrl) {
  const value = String(dataUrl || '').trim()
  return PNG_DATA_URL_RE.test(value)
    ? value.replace(/^data:image\/png;base64,/i, '')
    : ''
}

function base64ToBinaryString(base64) {
  try {
    return typeof atob === 'function' ? atob(String(base64 || '')) : ''
  } catch (_) {
    return ''
  }
}

async function loadIconifyLibraryData(libraryId) {
  if (libraryDataCache.has(libraryId)) return libraryDataCache.get(libraryId)
  const loader = ICONIFY_LIBRARY_LOADERS[libraryId]
  if (!loader) return null
  const mod = await loader()
  const data = mod?.default || mod
  libraryDataCache.set(libraryId, data)
  return data
}

function buildPresetOptions(libraryId) {
  return ASSISTANT_ICON_LIBRARY.map(item => ({
    id: `${libraryId}:${item.id}`,
    label: item.label,
    keywords: `${item.label} ${item.category} ${item.id}`.toLowerCase(),
    value: item.path,
    libraryId
  }))
}

function buildIconifyOptionMeta(libraryId, data) {
  const iconNames = Object.keys(data?.icons || {}).sort((a, b) => a.localeCompare(b))
  return iconNames.map((iconName) => ({
    id: `${libraryId}:${iconName}`,
    iconKey: iconName,
    label: toTitle(iconName),
    keywords: `${iconName} ${toTitle(iconName)}`.toLowerCase(),
    libraryId
  }))
}

function buildIconifyIconValue(libraryId, iconKey, data) {
  const cacheKey = `${libraryId}:${iconKey}`
  if (iconValueCache.has(cacheKey)) return iconValueCache.get(cacheKey)
  const iconData = getIconData(data, iconKey)
  if (!iconData) return DEFAULT_ASSISTANT_ICON
  const rendered = iconToSVG(iconData)
  const svg = normalizeGeneratedSvgMarkup(iconToHTML(
    String(rendered.body || ''),
    rendered.attributes || {}
  ))
  const value = svgToDataUrl(svg)
  iconValueCache.set(cacheKey, value)
  return value
}

export function normalizeAssistantIcon(icon) {
  const value = String(icon || '').trim()
  if (ASSISTANT_ICON_PATH_SET.has(value)) return value
  if (/^images\//.test(value)) return value
  if (DATA_URL_RE.test(value)) return normalizeSvgDataUrl(value)
  return DEFAULT_ASSISTANT_ICON
}

export function isAssistantImageIcon(icon) {
  const value = String(icon || '').trim()
  return /^images\//.test(value) || DATA_URL_RE.test(value)
}

export async function buildAssistantRibbonIconValue(icon) {
  const raw = String(icon || '').trim()
  if (PNG_DATA_URL_RE.test(raw)) return raw

  const normalized = normalizeAssistantIcon(raw)
  if (!DATA_URL_RE.test(normalized)) return normalized

  if (typeof document === 'undefined') return normalized

  try {
    const pngDataUrl = await new Promise((resolve) => {
      const image = new Image()
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) {
            resolve('')
            return
          }
          const size = 64
          canvas.width = size
          canvas.height = size
          context.clearRect(0, 0, size, size)

          const imageWidth = Number(image.naturalWidth || image.width || size)
          const imageHeight = Number(image.naturalHeight || image.height || size)
          const scale = Math.min(size / imageWidth, size / imageHeight)
          const drawWidth = Math.max(1, Math.round(imageWidth * scale))
          const drawHeight = Math.max(1, Math.round(imageHeight * scale))
          const offsetX = Math.round((size - drawWidth) / 2)
          const offsetY = Math.round((size - drawHeight) / 2)

          context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
          resolve(canvas.toDataURL('image/png'))
        } catch (_) {
          resolve('')
        }
      }
      image.onerror = () => resolve('')
      image.src = normalized
    })
    return PNG_DATA_URL_RE.test(pngDataUrl) ? pngDataUrl : normalized
  } catch (_) {
    return normalized
  }
}

export function getRibbonCompatibleAssistantIcon(icon, assistantId = 'assistant') {
  const raw = String(icon || '').trim()
  const normalized = normalizeAssistantIcon(raw)
  // 静态路径（images/xxx.svg）直接返回
  if (!DATA_URL_RE.test(normalized) && !PNG_DATA_URL_RE.test(raw)) {
    return normalized || DEFAULT_ASSISTANT_ICON
  }
  // data URL：尝试返回以支持自定义图标；若 WPS 不渲染则可能显示空白
  if (DATA_URL_RE.test(normalized) || PNG_DATA_URL_RE.test(raw)) {
    return normalized || raw || DEFAULT_ASSISTANT_ICON
  }
  return DEFAULT_ASSISTANT_ICON
}

export function getAssistantIconPickerLibraries() {
  return ASSISTANT_ICON_PICKER_LIBRARIES.map(item => ({ ...item }))
}

export async function loadAssistantIconLibraryOptions(libraryId) {
  const normalizedLibraryId = String(libraryId || '').trim()
  if (!normalizedLibraryId || !pickerLibraryMap.has(normalizedLibraryId)) return []
  if (libraryOptionCache.has(normalizedLibraryId)) {
    return libraryOptionCache.get(normalizedLibraryId)
  }
  let options = []
  if (normalizedLibraryId === 'iconmonstr') {
    options = buildPresetOptions(normalizedLibraryId)
  } else {
    const data = await loadIconifyLibraryData(normalizedLibraryId)
    options = buildIconifyOptionMeta(normalizedLibraryId, data)
  }
  libraryOptionCache.set(normalizedLibraryId, options)
  return options
}

export function getAssistantIconOptionValueSync(option) {
  if (!option) return DEFAULT_ASSISTANT_ICON
  if (option.value) return normalizeAssistantIcon(option.value)
  const libraryId = String(option.libraryId || '').trim()
  const iconKey = String(option.iconKey || '').trim()
  if (!libraryId || !iconKey) return DEFAULT_ASSISTANT_ICON
  const data = libraryDataCache.get(libraryId)
  if (!data) return DEFAULT_ASSISTANT_ICON
  return buildIconifyIconValue(libraryId, iconKey, data)
}
