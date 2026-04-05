export function normalizeTextWithIndexMap(text) {
  const raw = String(text || '')
  let normalized = ''
  const indexMap = []
  const spanMap = []
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    if (ch === '\r') {
      if (raw[i + 1] === '\n') {
        normalized += '\n'
        indexMap.push(i)
        spanMap.push(2)
        i += 1
      } else {
        normalized += '\n'
        indexMap.push(i)
        spanMap.push(1)
      }
      continue
    }
    normalized += ch
    indexMap.push(i)
    spanMap.push(1)
  }
  return { raw, normalized, indexMap, spanMap }
}

export function mapNormalizedRangeToRawRange(info, start, end) {
  if (!info?.indexMap?.length || end <= start) return null
  const rawStart = info.indexMap[start]
  const rawEnd = info.indexMap[end - 1] + info.spanMap[end - 1]
  if (rawStart == null || rawEnd == null || rawEnd <= rawStart) return null
  return {
    rawText: info.raw.slice(rawStart, rawEnd),
    text: info.normalized.slice(start, end),
    rawStart,
    rawEnd,
    start: rawStart,
    end: rawEnd
  }
}

export function mapNormalizedRangeToRaw(range, info) {
  if (!range || !info) return null
  const mapped = mapNormalizedRangeToRawRange(info, Number(range.start || 0), Number(range.end || 0))
  if (!mapped) return null
  return {
    start: mapped.rawStart,
    end: mapped.rawEnd
  }
}

export function collectMatchPositions(text, needle) {
  const positions = []
  if (!text || !needle) return positions
  let fromIndex = 0
  while (fromIndex < text.length) {
    const idx = text.indexOf(needle, fromIndex)
    if (idx < 0) break
    positions.push(idx)
    fromIndex = idx + 1
  }
  return positions
}

export function mapChunkRelativeRangeToAbsolute(chunk, start, end) {
  const relativeStart = Number(start)
  const relativeEnd = Number(end)
  if (!Number.isFinite(relativeStart) || !Number.isFinite(relativeEnd) || relativeEnd <= relativeStart) {
    return null
  }
  const chunkStart = Number(chunk?.start || 0)
  const rawChunkText = String(chunk?.text ?? chunk?.rawText ?? '')
  if (rawChunkText) {
    const info = normalizeTextWithIndexMap(rawChunkText)
    const mapped = mapNormalizedRangeToRawRange(info, relativeStart, relativeEnd)
    if (mapped) {
      return {
        start: chunkStart + Number(mapped.rawStart || 0),
        end: chunkStart + Number(mapped.rawEnd || 0)
      }
    }
  }
  return {
    start: chunkStart + relativeStart,
    end: chunkStart + relativeEnd
  }
}
