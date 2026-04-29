/**
 * showAdaptiveDialog - 自适应尺寸的对话框工厂
 *
 * 替代散落在 ribbon.js / AIAssistantDialog.vue 等处 30+ 处的:
 *     window.Application.ShowDialog(url, title, w * dpr, h * dpr, false)
 *
 * 核心改进:
 *   1. 尺寸 clamp 到屏幕的合理比例,避免高 DPI 缩放下题注框过小
 *   2. 自动选区快照 + tokenId 透传(可选)
 *   3. 失败时回退 window.open(避免 alert)
 *   4. 统一的标题前缀 '· 察元'(可选)
 */

import { getApp } from './hostBridge.js'
import { snapshotAndPersist } from './selectionToken.js'

function clamp(min, value, max) {
  return Math.max(min, Math.min(value, max))
}

function safeNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * 计算自适应尺寸。
 *  options:
 *    minWidth/maxWidth/minHeight/maxHeight: 边界,默认 480/1600/360/1200
 *    widthRatio/heightRatio: 屏幕占比,默认 .5 / .6
 *    width/height: 显式像素,设了就跳过比例
 */
export function computeAdaptiveSize(options = {}) {
  const screenW = safeNumber(
    typeof screen !== 'undefined' ? screen.availWidth || screen.width : 0,
    1600
  )
  const screenH = safeNumber(
    typeof screen !== 'undefined' ? screen.availHeight || screen.height : 0,
    980
  )

  const minW = safeNumber(options.minWidth, 480)
  const maxW = safeNumber(options.maxWidth, 1600)
  const minH = safeNumber(options.minHeight, 360)
  const maxH = safeNumber(options.maxHeight, 1200)

  let width = safeNumber(options.width, 0)
  let height = safeNumber(options.height, 0)

  if (!width) {
    const ratio = safeNumber(options.widthRatio, 0.5)
    width = Math.floor(screenW * ratio)
  }
  if (!height) {
    const ratio = safeNumber(options.heightRatio, 0.6)
    height = Math.floor(screenH * ratio)
  }

  return {
    width: clamp(minW, width, maxW),
    height: clamp(minH, height, maxH),
    screenW,
    screenH
  }
}

function buildHashUrl(routePath, query = {}) {
  // 与 ribbon.js 中既有 buildDialogUrl 行为对齐:
  //   优先使用 PluginStorage('AddinBaseUrl');否则用 window.location
  let base = ''
  try {
    const ps = getApp()?.PluginStorage
    const stored = ps?.getItem?.('AddinBaseUrl')
    if (stored && typeof stored === 'string') base = stored
  } catch (_) {}

  if (!base) {
    try {
      base = String((typeof window !== 'undefined' && window.location?.href) || '').split('#')[0] || ''
    } catch (_) {}
  }

  const cleanBase = String(base || '').replace(/#.*$/, '').replace(/\/+$/, '')
  const isFile = cleanBase.startsWith('file:')

  const qsEntries = Object.entries(query || {})
    .filter(([_, v]) => v != null && String(v) !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  const qs = qsEntries.length ? `?${qsEntries.join('&')}` : ''

  if (isFile) {
    return `${cleanBase}/index.html#${routePath}${qs}`
  }
  return `${cleanBase}/#${routePath}${qs}`
}

/**
 * 主入口。
 *
 *   options:
 *     title:       对话框标题(必传)
 *     query:       附加 query 参数对象
 *     captureSelection: 是否同时快照选区,默认 false
 *                  打开后 tokenId 会自动加到 query.selToken
 *     minWidth/maxWidth/minHeight/maxHeight/width/height/widthRatio/heightRatio
 *     fallbackToOpen: 主入口失败时是否回退 window.open,默认 true
 *
 *   return: { ok, url, tokenId, width, height }
 */
export function showAdaptiveDialog(routePath, options = {}) {
  const title = String(options.title || '察元')

  const finalQuery = { ...(options.query || {}) }

  let tokenId = ''
  if (options.captureSelection === true) {
    tokenId = snapshotAndPersist({ id: options.tokenId })
    if (tokenId) finalQuery.selToken = tokenId
  }

  const url = buildHashUrl(routePath, finalQuery)
  const { width, height } = computeAdaptiveSize(options)

  const app = getApp()
  if (app && typeof app.ShowDialog === 'function') {
    try {
      app.ShowDialog(url, title, width, height, false)
      return { ok: true, url, tokenId, width, height }
    } catch (e) {
      if (options.fallbackToOpen === false) {
        throw e
      }
    }
  }

  if (options.fallbackToOpen !== false && typeof window !== 'undefined') {
    try {
      window.open(url, '_blank', 'noopener')
      return { ok: true, url, tokenId, width, height, fallback: 'window.open' }
    } catch (_) {}
  }

  return { ok: false, url, tokenId, width, height }
}

export default {
  showAdaptiveDialog,
  computeAdaptiveSize
}
