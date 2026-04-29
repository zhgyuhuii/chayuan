import { getCoverageSummary } from './coverageLedger.js'

function normalizeResults(results = []) {
  return (Array.isArray(results) ? results : []).filter(Boolean)
}

export function flattenExtractionItems(results = []) {
  return normalizeResults(results).flatMap((result) => {
    const items = Array.isArray(result?.items) ? result.items : []
    return items.map((item, itemIndex) => ({
      ...item,
      chunkId: result.chunkId,
      chunkIndex: result.chunkIndex,
      itemIndex
    }))
  })
}

export function mergeExtractionItems(results = [], options = {}) {
  const keyFields = Array.isArray(options.keyFields) && options.keyFields.length > 0
    ? options.keyFields
    : ['title', 'evidence', 'summary']
  const items = flattenExtractionItems(results)
  const seen = new Map()

  for (const item of items) {
    const key = keyFields
      .map(field => String(item?.[field] || '').trim())
      .filter(Boolean)
      .join('|') || JSON.stringify(item)
    if (!seen.has(key)) {
      seen.set(key, {
        ...item,
        sources: [{ chunkId: item.chunkId, chunkIndex: item.chunkIndex, itemIndex: item.itemIndex }]
      })
      continue
    }
    const existing = seen.get(key)
    existing.sources.push({ chunkId: item.chunkId, chunkIndex: item.chunkIndex, itemIndex: item.itemIndex })
  }

  return Array.from(seen.values())
}

export function renderSynthesisMarkdown(items = [], options = {}) {
  const title = String(options.title || '文档分块处理结果').trim()
  const emptyText = String(options.emptyText || '未从文档中抽取到匹配内容。')
  if (!items.length) return `${title}\n\n${emptyText}`
  const lines = [title, '']
  items.forEach((item, index) => {
    const heading = String(item.title || item.summary || item.evidence || `结果 ${index + 1}`).trim()
    lines.push(`${index + 1}. ${heading}`)
    if (item.summary && item.summary !== heading) lines.push(`   - 摘要：${item.summary}`)
    if (item.evidence) lines.push(`   - 依据：${item.evidence}`)
    if (Array.isArray(item.sources) && item.sources.length > 0) {
      const refs = item.sources
        .map(source => `#${Number(source.chunkIndex ?? source.chunkId) + 1}`)
        .join('、')
      lines.push(`   - 来源分块：${refs}`)
    }
  })
  return lines.join('\n')
}

export function synthesizeExtractionResults(results = [], options = {}) {
  const items = mergeExtractionItems(results, options)
  const coverage = options.ledger ? getCoverageSummary(options.ledger) : null
  return {
    kind: 'extraction-synthesis',
    items,
    coverage,
    content: renderSynthesisMarkdown(items, options)
  }
}

export default {
  flattenExtractionItems,
  mergeExtractionItems,
  renderSynthesisMarkdown,
  synthesizeExtractionResults
}
