/**
 * 段落截取设置 - 大文档分批处理（翻译、检查等）时的分块参数
 * 用于文档超过模型上下文限制时，按段落/字符分块并带重叠，保证上下文连贯
 */

import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'

const DEFAULT_CHUNK_LENGTH = 4000
const DEFAULT_OVERLAP_LENGTH = 200
const MIN_CHUNK_LENGTH = 500
const MAX_CHUNK_LENGTH = 16000
const MIN_OVERLAP = 0
const MAX_OVERLAP_RATIO = 0.5

/**
 * 获取段落截取配置
 * @returns {{ chunkLength: number, overlapLength: number, splitStrategy: string }}
 */
export function getChunkSettings() {
  const settings = loadGlobalSettings()
  const raw = settings.chunkSettings
  if (!raw || typeof raw !== 'object') {
    return {
      chunkLength: DEFAULT_CHUNK_LENGTH,
      overlapLength: DEFAULT_OVERLAP_LENGTH,
      splitStrategy: 'paragraph'
    }
  }
  const chunkLength = clamp(
    parseInt(raw.chunkLength, 10) || DEFAULT_CHUNK_LENGTH,
    MIN_CHUNK_LENGTH,
    MAX_CHUNK_LENGTH
  )
  const maxOverlap = Math.floor(chunkLength * MAX_OVERLAP_RATIO)
  const overlapLength = clamp(
    parseInt(raw.overlapLength, 10) || DEFAULT_OVERLAP_LENGTH,
    MIN_OVERLAP,
    maxOverlap
  )
  const splitStrategy = ['paragraph', 'sentence', 'char'].includes(raw.splitStrategy)
    ? raw.splitStrategy
    : 'paragraph'
  return { chunkLength, overlapLength, splitStrategy }
}

/**
 * 保存段落截取配置
 * @param {{ chunkLength?: number, overlapLength?: number, splitStrategy?: string }} partial
 */
export function saveChunkSettings(partial) {
  const current = getChunkSettings()
  const merged = { ...current, ...(partial && typeof partial === 'object' ? partial : {}) }
  merged.chunkLength = clamp(merged.chunkLength, MIN_CHUNK_LENGTH, MAX_CHUNK_LENGTH)
  const maxOverlap = Math.floor(merged.chunkLength * MAX_OVERLAP_RATIO)
  merged.overlapLength = clamp(merged.overlapLength, MIN_OVERLAP, maxOverlap)
  saveGlobalSettings({ chunkSettings: merged })
}

function clamp(val, min, max) {
  const n = Number(val)
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

/**
 * 将文本按配置分块（供文档翻译、检查等调用）
 * @param {string} text - 原始文本
 * @param {{ chunkLength?: number, overlapLength?: number, splitStrategy?: string }} overrides - 可选覆盖
 * @returns {string[]} 分块后的文本数组
 */
export function splitTextIntoChunks(text, overrides = {}) {
  if (!text || typeof text !== 'string') return []
  const merged = { ...getChunkSettings(), ...(overrides && typeof overrides === 'object' ? overrides : {}) }
  const chunkLength = clamp(
    parseInt(merged.chunkLength, 10) || DEFAULT_CHUNK_LENGTH,
    MIN_CHUNK_LENGTH,
    MAX_CHUNK_LENGTH
  )
  const maxOverlap = Math.floor(chunkLength * MAX_OVERLAP_RATIO)
  const overlapLength = clamp(
    parseInt(merged.overlapLength, 10) || DEFAULT_OVERLAP_LENGTH,
    MIN_OVERLAP,
    maxOverlap
  )
  const splitStrategy = ['paragraph', 'sentence', 'char'].includes(merged.splitStrategy)
    ? merged.splitStrategy
    : 'paragraph'
  if (text.length <= chunkLength) return [text]

  const chunks = []
  let start = 0
  let guard = 0

  while (start < text.length) {
    const iterationStart = start
    let end = Math.min(start + chunkLength, text.length)
    let chunk = text.slice(start, end)

    if (splitStrategy === 'paragraph' && end < text.length) {
      const lastPara = chunk.lastIndexOf('\n\n')
      if (lastPara > chunkLength * 0.5) {
        end = start + lastPara + 1
        chunk = text.slice(start, end)
      }
    } else if (splitStrategy === 'sentence' && end < text.length) {
      const lastSent = Math.max(
        chunk.lastIndexOf('。'),
        chunk.lastIndexOf('！'),
        chunk.lastIndexOf('？'),
        chunk.lastIndexOf('.'),
        chunk.lastIndexOf('!'),
        chunk.lastIndexOf('?')
      )
      if (lastSent > chunkLength * 0.5) {
        end = start + lastSent + 1
        chunk = text.slice(start, end)
      }
    }

    chunks.push(chunk)
    // 重叠若大于等于本段推进长度，start 会停滞在 0 或重复，导致死循环拖死宿主；强制至少推进到本段末尾。
    let nextStart = end - overlapLength
    if (nextStart <= iterationStart) {
      nextStart = end
    }
    start = Math.min(nextStart, text.length)
    guard += 1
    if (guard > text.length + 32) break
  }

  return chunks.length > 0 ? chunks : [text]
}
