import { getChunkSettings, splitTextIntoChunks } from '../../utils/chunkSettings.js'

export function buildChunkOptions(strategy = 'synthesize', baseSettings = null) {
  const chunkSettings = baseSettings || getChunkSettings()
  if (strategy === 'transform') {
    return { ...chunkSettings, overlapLength: 0 }
  }
  return chunkSettings
}

function buildParagraphRefs(text = '') {
  const refs = []
  let cursor = 0
  String(text || '').split(/\n{2,}/).forEach((paragraph, index) => {
    const start = String(text || '').indexOf(paragraph, cursor)
    const end = start + paragraph.length
    refs.push({ index, start, end, text: paragraph })
    cursor = end
  })
  return refs
}

function attachChunkMetadata(text = '', chunks = []) {
  const source = String(text || '')
  const paragraphs = buildParagraphRefs(source)
  let cursor = 0
  return (Array.isArray(chunks) ? chunks : []).map((chunk, index) => {
    const chunkText = String(chunk?.text || chunk?.normalizedText || chunk || '')
    const start = source.indexOf(chunkText, cursor)
    const safeStart = start >= 0 ? start : cursor
    const end = safeStart + chunkText.length
    cursor = end
    const paragraphIndexes = paragraphs
      .filter(paragraph => paragraph.end > safeStart && paragraph.start < end)
      .map(paragraph => paragraph.index)
    return {
      ...(chunk && typeof chunk === 'object' ? chunk : { text: chunkText }),
      id: String(chunk?.id || chunk?.chunkId || `chunk_${index}`),
      index,
      text: chunkText,
      startOffset: safeStart,
      endOffset: end,
      paragraphIndexes
    }
  })
}

export function planTextChunks(text = '', options = {}) {
  const strategy = String(options.strategy || 'synthesize').trim() || 'synthesize'
  const chunkOptions = buildChunkOptions(strategy, options.chunkSettings)
  const rawChunks = splitTextIntoChunks(String(text || ''), chunkOptions)
  return {
    strategy,
    chunkOptions,
    chunks: options.includeMetadata === false ? rawChunks : attachChunkMetadata(text, rawChunks)
  }
}

export default {
  buildChunkOptions,
  attachChunkMetadata,
  planTextChunks
}
