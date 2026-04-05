import { getActiveDocument, getApplication, getSelectionRange } from './documentActions.js'

const WD_COLLAPSE_START = 1

function collapseRangeToStart(range) {
  if (!range) return range
  try {
    if (typeof range.Duplicate === 'function') {
      const duplicated = range.Duplicate()
      duplicated?.Collapse?.(WD_COLLAPSE_START)
      return duplicated
    }
    range.Collapse?.(WD_COLLAPSE_START)
  } catch (_) {}
  return range
}

function getPageInsertRange(pageNumber) {
  const app = getApplication()
  const doc = getActiveDocument()
  if (!doc) throw new Error('当前没有打开文档')
  const normalizedPage = Number(pageNumber || 0)
  if (!Number.isFinite(normalizedPage) || normalizedPage <= 0) {
    return collapseRangeToStart(getSelectionRange() || doc.Content)
  }
  const wdGoToPage = app?.Enum?.wdGoToPage ?? 1
  const wdGoToAbsolute = app?.Enum?.wdGoToAbsolute ?? 1
  try {
    const range = typeof doc.GoTo === 'function'
      ? doc.GoTo(wdGoToPage, wdGoToAbsolute, normalizedPage)
      : app?.Selection?.GoTo?.(wdGoToPage, wdGoToAbsolute, normalizedPage)
    if (range) return collapseRangeToStart(range)
  } catch (_) {
    // fallback below
  }
  return collapseRangeToStart(getSelectionRange() || doc.Content)
}

export function insertTableAtPosition(options = {}) {
  const doc = getActiveDocument()
  if (!doc?.Tables || typeof doc.Tables.Add !== 'function') {
    throw new Error('当前环境不支持插入表格')
  }
  const rows = Math.max(1, Number(options.rows || 0))
  const columns = Math.max(1, Number(options.columns || 0))
  const range = getPageInsertRange(options.pageNumber)
  doc.Tables.Add(range, rows, columns)
  return {
    rows,
    columns,
    pageNumber: Number(options.pageNumber || 0)
  }
}

export function insertPageBreakAtPosition(options = {}) {
  const app = getApplication()
  const range = getPageInsertRange(options.pageNumber)
  const wdPageBreak = app?.Enum?.wdPageBreak ?? 7
  if (typeof range?.InsertBreak !== 'function') {
    throw new Error('当前环境不支持插入分页符')
  }
  range.InsertBreak(wdPageBreak)
  return {
    pageNumber: Number(options.pageNumber || 0)
  }
}

export function insertBlankPageAtPosition(options = {}) {
  const result = insertPageBreakAtPosition(options)
  return {
    ...result,
    mode: 'blank-page'
  }
}
