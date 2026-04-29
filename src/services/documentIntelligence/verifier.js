import { getCoverageSummary } from './coverageLedger.js'

export function verifyCoverageLedger(ledger, options = {}) {
  const summary = getCoverageSummary(ledger)
  const minCoverageRate = Number.isFinite(Number(options.minCoverageRate))
    ? Number(options.minCoverageRate)
    : 1
  const issues = []
  if (summary.total === 0) {
    issues.push({ code: 'empty-ledger', message: '没有可校验的分块记录' })
  }
  if (summary.coverageRate < minCoverageRate) {
    issues.push({
      code: 'coverage-below-threshold',
      message: `分块覆盖率不足：${Math.round(summary.coverageRate * 100)}%`,
      expected: minCoverageRate,
      actual: summary.coverageRate
    })
  }
  if (summary.failed > 0) {
    issues.push({
      code: 'chunk-failed',
      message: `存在 ${summary.failed} 个处理失败的分块`,
      failed: summary.failed
    })
  }
  return {
    ok: issues.length === 0,
    summary,
    issues
  }
}

export function verifyExactStatsResult(result = {}) {
  const stats = result?.stats || result
  const total = Number(stats?.total || 0)
  const unique = Number(stats?.unique || 0)
  const duplicateTotal = Array.isArray(stats?.duplicates)
    ? stats.duplicates.reduce((sum, item) => sum + Math.max(0, Number(item?.count || 0) - 1), 0)
    : 0
  const issues = []
  if (total < 0 || unique < 0) {
    issues.push({ code: 'negative-count', message: '统计数量不能为负数' })
  }
  if (unique > total) {
    issues.push({ code: 'unique-exceeds-total', message: '去重数量不能大于总数' })
  }
  if (duplicateTotal > Math.max(0, total - unique)) {
    issues.push({ code: 'duplicate-inconsistent', message: '重复项计数与总数/去重数不一致' })
  }
  return {
    ok: issues.length === 0,
    issues,
    summary: {
      total,
      unique,
      duplicateKinds: Array.isArray(stats?.duplicates) ? stats.duplicates.length : 0,
      duplicateTotal
    }
  }
}

function normalizeChunkId(chunk, index) {
  return String(chunk?.id || chunk?.chunkId || (chunk?.index ?? index))
}

export function verifyExtractionCitations(results = [], chunks = []) {
  const chunkMap = new Map((Array.isArray(chunks) ? chunks : []).map((chunk, index) => [
    normalizeChunkId(chunk, index),
    String(chunk?.text || chunk?.normalizedText || '')
  ]))
  const issues = []
  const items = (Array.isArray(results) ? results : []).flatMap((result) => {
    const resultItems = Array.isArray(result?.items) ? result.items : []
    return resultItems.map((item, itemIndex) => ({
      ...item,
      chunkId: String(item?.chunkId || result?.chunkId || (result?.chunkIndex ?? '')),
      itemIndex
    }))
  })

  items.forEach((item) => {
    const sourceText = chunkMap.get(String(item.chunkId || ''))
    if (!sourceText) {
      issues.push({ code: 'missing-citation-source', message: `引用分块不存在：${item.chunkId}`, item })
      return
    }
    const evidence = String(item.evidence || '').trim()
    if (evidence && !sourceText.includes(evidence)) {
      issues.push({ code: 'evidence-not-found', message: '引用依据未在来源分块中找到', item })
    }
  })

  return {
    ok: issues.length === 0,
    issues,
    summary: {
      itemCount: items.length,
      chunkCount: chunkMap.size,
      issueCount: issues.length
    }
  }
}

export default {
  verifyCoverageLedger,
  verifyExactStatsResult,
  verifyExtractionCitations
}
