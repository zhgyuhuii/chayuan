import { resolveExactTextStats } from '../../utils/exactTextStats.js'

function normalizeText(value = '') {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

function extractMaterial(text = '', options = {}) {
  const normalized = normalizeText(text)
  const materialText = normalizeText(options.materialText)
  if (materialText) return materialText
  const colonIndex = normalized.search(/[：:]/)
  if (colonIndex >= 0 && colonIndex < normalized.length - 1) {
    return normalized.slice(colonIndex + 1).trim()
  }
  const lines = normalized.split('\n')
  return lines.length > 1 ? lines.slice(1).join('\n').trim() : ''
}

function splitItems(material = '') {
  return normalizeText(material)
    .split(/[\n\t,，、;；|/\\]+|\s+/)
    .map(item => item.trim())
    .filter(Boolean)
}

function renderDuplicateAnswer(items = []) {
  const counts = new Map()
  items.forEach(item => counts.set(item, (counts.get(item) || 0) + 1))
  const unique = Array.from(counts.keys())
  const duplicates = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([text, count]) => ({ text, count }))
  const lines = [
    '已按本地确定性规则完成去重。',
    '',
    `- 原始数量：${items.length}`,
    `- 去重后数量：${unique.length}`,
    `- 重复项种类：${duplicates.length}`,
    '',
    '去重结果：',
    unique.join('、')
  ]
  if (duplicates.length > 0) {
    lines.push('', '重复项：')
    duplicates.slice(0, 20).forEach(item => lines.push(`- ${item.text}：${item.count} 次`))
  }
  return { unique, duplicates, answer: lines.join('\n') }
}

export function resolveDuplicateRemoval(text = '', options = {}) {
  const normalized = normalizeText(text)
  if (!/(去重|删除重复|移除重复|合并重复)/.test(normalized)) return null
  const material = extractMaterial(normalized, options)
  const items = splitItems(material)
  if (items.length === 0) return null
  const result = renderDuplicateAnswer(items)
  return {
    kind: 'exact-deduplicate',
    materialCharCount: material.length,
    total: items.length,
    ...result
  }
}

export function resolveTextFind(text = '', options = {}) {
  const normalized = normalizeText(text)
  if (!/(查找|寻找|搜索|出现位置|出现次数)/.test(normalized)) return null
  const keyword = (String(options.keyword || '').trim() ||
    normalized.match(/(?:查找|寻找|搜索|统计)\s*[“"']?([^“"'\n，。；;：:]+)[”"']?/)?.[1]?.trim() ||
    '').replace(/[：:，。；;,.!?！？]+$/g, '').trim()
  const material = extractMaterial(normalized, options)
  if (!keyword || !material) return null
  const positions = []
  let offset = material.indexOf(keyword)
  while (offset >= 0) {
    positions.push(offset)
    offset = material.indexOf(keyword, offset + keyword.length)
  }
  return {
    kind: 'exact-find',
    keyword,
    count: positions.length,
    positions,
    answer: [
      '已按本地确定性规则完成查找。',
      '',
      `- 关键词：${keyword}`,
      `- 出现次数：${positions.length}`,
      `- 位置：${positions.slice(0, 20).join('、') || '无'}`
    ].join('\n')
  }
}

export function resolveRegexExtract(text = '', options = {}) {
  const normalized = normalizeText(text)
  if (!/(正则|regex|提取)/i.test(normalized)) return null
  const patternText = String(options.pattern || '').trim() ||
    normalized.match(/\/(.+?)\/([gimsuy]*)/)?.[1] ||
    normalized.match(/正则[：:]\s*(.+)/)?.[1]?.trim()
  const material = extractMaterial(normalized, options)
  if (!patternText || !material) return null
  let regex
  try {
    regex = new RegExp(patternText, 'g')
  } catch (error) {
    return {
      kind: 'exact-regex-extract',
      error: String(error?.message || error || '正则表达式无效'),
      answer: `正则表达式无效：${String(error?.message || error)}`
    }
  }
  const matches = Array.from(material.matchAll(regex)).map(match => match[0])
  return {
    kind: 'exact-regex-extract',
    pattern: patternText,
    matches,
    count: matches.length,
    answer: [
      '已按本地确定性规则完成正则抽取。',
      '',
      `- 正则：${patternText}`,
      `- 命中数量：${matches.length}`,
      '',
      matches.slice(0, 50).join('\n') || '无命中'
    ].join('\n')
  }
}

export function resolveExactToolRequest(text = '', options = {}) {
  const stats = resolveExactTextStats(text, {
    materialText: options.materialText
  })
  if (stats) {
    return {
      tool: 'text.stats',
      result: stats,
      answer: stats.answer,
      handled: true
    }
  }
  const duplicateRemoval = resolveDuplicateRemoval(text, options)
  if (duplicateRemoval) {
    return {
      tool: 'text.deduplicate',
      result: duplicateRemoval,
      answer: duplicateRemoval.answer,
      handled: true
    }
  }
  const find = resolveTextFind(text, options)
  if (find) {
    return {
      tool: 'text.find',
      result: find,
      answer: find.answer,
      handled: true
    }
  }
  const regexExtract = resolveRegexExtract(text, options)
  if (regexExtract) {
    return {
      tool: 'text.regexExtract',
      result: regexExtract,
      answer: regexExtract.answer,
      handled: !regexExtract.error
    }
  }
  return null
}

export default {
  resolveDuplicateRemoval,
  resolveTextFind,
  resolveRegexExtract,
  resolveExactToolRequest
}
