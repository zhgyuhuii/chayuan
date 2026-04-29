const COUNT_INTENT_PATTERN = /(统计|数一数|数一下|计算|计数|有多少|多少个|数量|总数)/
const LIST_TARGET_PATTERN = /(成语|词语|短语|条目|列表|清单|项目)/
const CJK_ONLY_PATTERN = /^[\u4e00-\u9fa5]+$/

function normalizeText(value = '') {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

function extractMaterial(text = '', options = {}) {
  const normalized = normalizeText(text)
  if (!normalized) return ''
  const colonIndex = normalized.search(/[：:]/)
  if (colonIndex >= 0 && colonIndex < normalized.length - 1) {
    return normalized.slice(colonIndex + 1).trim()
  }
  const lines = normalized.split('\n')
  if (lines.length > 1) {
    return lines.slice(1).join('\n').trim()
  }
  return normalizeText(options.materialText)
}

function splitDelimitedItems(material = '') {
  const normalized = normalizeText(material)
  if (!normalized) return []
  return normalized
    .split(/[\n\t,，、;；|/\\]+|\s+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function splitContinuousIdioms(material = '') {
  const compact = normalizeText(material).replace(/\s+/g, '')
  if (!compact || !CJK_ONLY_PATTERN.test(compact) || compact.length < 8 || compact.length % 4 !== 0) {
    return []
  }
  const items = []
  for (let i = 0; i < compact.length; i += 4) {
    items.push(compact.slice(i, i + 4))
  }
  return items
}

function countItems(items = []) {
  const counts = new Map()
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1)
  }
  const duplicates = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
  return {
    total: items.length,
    unique: counts.size,
    duplicates
  }
}

function renderStatsAnswer(stats, options = {}) {
  const targetLabel = options.targetLabel || '条目'
  const method = options.method || 'delimiter'
  const duplicatePreview = stats.duplicates.slice(0, 10)
  const lines = [
    `已按本地确定性规则完成统计，没有交给大模型估算。`,
    '',
    `- ${targetLabel}总数：${stats.total}`,
    `- 去重后数量：${stats.unique}`,
    `- 重复${targetLabel}种类：${stats.duplicates.length}`,
    `- 统计方式：${method === 'fixed-4-cjk' ? '连续中文按四字成语切分' : '按换行、空格、逗号、顿号、分号等分隔符切分'}`
  ]
  if (duplicatePreview.length > 0) {
    lines.push('', '重复项示例：')
    duplicatePreview.forEach(item => {
      lines.push(`- ${item.text}：${item.count} 次`)
    })
  }
  return lines.join('\n')
}

export function resolveExactTextStats(text = '', options = {}) {
  const normalized = normalizeText(text)
  if (!normalized || !COUNT_INTENT_PATTERN.test(normalized) || !LIST_TARGET_PATTERN.test(normalized)) {
    return null
  }
  const material = extractMaterial(normalized, options)
  if (!material) return null
  const targetLabel = /成语/.test(normalized) ? '成语' : /词语/.test(normalized) ? '词语' : '条目'
  let method = 'delimiter'
  let items = splitDelimitedItems(material)
  if (targetLabel === '成语' && items.length <= 1) {
    const idioms = splitContinuousIdioms(material)
    if (idioms.length > 0) {
      items = idioms
      method = 'fixed-4-cjk'
    }
  }
  if (items.length === 0) return null
  const stats = countItems(items)
  return {
    kind: 'exact-text-stats',
    targetLabel,
    method,
    materialCharCount: material.length,
    stats,
    answer: renderStatsAnswer(stats, { targetLabel, method })
  }
}

export default {
  resolveExactTextStats
}
