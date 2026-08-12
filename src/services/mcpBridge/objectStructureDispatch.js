/**
 * MCP P1/P2 structure & object handlers (Agent side).
 * Columns, outline, bookmarks, table/image/hyperlink, header/footer, watermark, export, style audit.
 */
import { getActiveDocument, getApplication, tryAddInlinePicture } from '../../utils/documentActions.js'
import { insertTableAtPosition } from '../../utils/documentInsertActions.js'
import { saveActiveDocumentAs } from '../../utils/documentFileActions.js'

function requireDoc() {
  const doc = getActiveDocument()
  if (!doc) {
    const err = new Error('当前没有打开文档')
    err.code = 'NO_ACTIVE_DOCUMENT'
    throw err
  }
  return doc
}

function docInfo(doc = getActiveDocument()) {
  if (!doc) return { open: false }
  try {
    return {
      open: true,
      name: String(doc.Name || ''),
      fullName: String(doc.FullName || ''),
      saved: !!doc.Saved,
      addonType: 'wps'
    }
  } catch (e) {
    return { open: false, error: e?.message || String(e) }
  }
}

function requireConfirmed(params) {
  if (params?.confirmed !== true) {
    const err = new Error('confirmed: true required')
    err.code = 'CONFIRMATION_REQUIRED'
    throw err
  }
}

function locateFirst(doc, text, hintStart = 0) {
  const needle = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!needle) return null
  const docEnd = Number(doc?.Content?.End || 0)
  let cursor = Math.max(0, Number(hintStart) || 0)
  let guard = 0
  while (cursor < docEnd && guard < 80) {
    guard += 1
    let r
    try {
      r = doc.Range(cursor, docEnd)
    } catch {
      break
    }
    const find = r?.Find
    if (!find) break
    try {
      find.ClearFormatting?.()
      find.Text = needle
      find.Forward = true
      find.MatchWildcards = false
    } catch { /* ignore */ }
    let ok = false
    try {
      ok = !!find.Execute()
    } catch {
      break
    }
    if (!ok) break
    return { start: Number(r.Start), end: Number(r.End), text: needle }
  }
  return null
}

function resolveInsertRange(doc, params = {}) {
  const start = Number(params.start)
  const end = Number(params.end)
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    return doc.Range(start, end)
  }
  if (params.originalText) {
    const hit = locateFirst(doc, params.originalText, Number(params.hintStart) || 0)
    if (!hit) {
      const err = new Error(`未找到锚点文本：${String(params.originalText).slice(0, 40)}`)
      err.code = 'ANCHOR_NOT_FOUND'
      throw err
    }
    const at = params.position === 'before' ? hit.start : hit.end
    return doc.Range(at, at)
  }
  const app = getApplication()
  return app?.Selection?.Range || doc.Content
}

function outlineLevelOf(para) {
  try {
    const ol = Number(para?.OutlineLevel)
    if (Number.isFinite(ol) && ol >= 1 && ol <= 9) return ol
  } catch { /* ignore */ }
  try {
    const name = String(para?.Style?.NameLocal || para?.Style?.Name || '')
    const m = name.match(/(?:标题|Heading)\s*(\d)/i)
    if (m) return Number(m[1])
  } catch { /* ignore */ }
  return null
}

/* ───────── P1 ───────── */

export async function handleLayoutColumns(params = {}) {
  const doc = requireDoc()
  const count = Math.min(10, Math.max(1, Number(params.count) || 1))
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: [`columns=${count}`],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const ps = doc.PageSetup
  const cols = ps?.TextColumns
  if (!cols) {
    const err = new Error('PageSetup.TextColumns unavailable')
    err.code = 'UNSUPPORTED'
    throw err
  }
  try {
    if (typeof cols.SetCount === 'function') cols.SetCount(count)
    else cols.Count = count
  } catch (e) {
    const err = new Error(e?.message || '设置分栏失败')
    err.code = 'LAYOUT_COLUMNS_FAILED'
    throw err
  }
  if (params.lineBetween === true) {
    try {
      cols.LineBetween = true
    } catch { /* optional */ }
  }
  if (params.spacing != null) {
    try {
      cols.Spacing = Number(params.spacing)
    } catch { /* optional */ }
  }
  return { ok: true, preview: false, count, document: docInfo(doc) }
}

export async function handleNavOutline(params = {}) {
  const doc = requireDoc()
  const maxLevel = Math.min(9, Math.max(1, Number(params.maxLevel) || 9))
  const limit = Math.min(Math.max(Number(params.limit) || 200, 1), 500)
  const paras = doc.Paragraphs
  const total = Number(paras?.Count || 0)
  const items = []
  for (let i = 1; i <= total && items.length < limit; i++) {
    try {
      const para = paras.Item(i)
      const level = outlineLevelOf(para)
      if (level == null || level > maxLevel) continue
      const range = para.Range
      const text = String(range?.Text || '')
        .replace(/\r|\n|\u0007/g, '')
        .trim()
      if (!text) continue
      items.push({
        index: i,
        level,
        text: text.slice(0, 200),
        start: Number(range?.Start),
        end: Number(range?.End),
        style: String(para?.Style?.NameLocal || para?.Style?.Name || '')
      })
    } catch { /* skip */ }
  }
  return {
    ok: true,
    total: items.length,
    returned: items.length,
    items,
    document: docInfo(doc)
  }
}

export async function handleBookmarkList(params = {}) {
  const doc = requireDoc()
  const bookmarks = doc.Bookmarks
  const total = Number(bookmarks?.Count || 0)
  const limit = Math.min(Math.max(Number(params.limit) || 200, 1), 500)
  const query = String(params.query || '').trim().toLowerCase()
  const items = []
  for (let i = 1; i <= total && items.length < limit; i++) {
    try {
      const bm = bookmarks.Item(i)
      const name = String(bm?.Name || '')
      if (query && !name.toLowerCase().includes(query)) continue
      const range = bm?.Range
      items.push({
        index: i,
        name,
        start: Number(range?.Start),
        end: Number(range?.End),
        anchorText: String(range?.Text || '')
          .replace(/\r/g, '')
          .slice(0, 80)
      })
    } catch { /* skip */ }
  }
  return { ok: true, total, returned: items.length, items, document: docInfo(doc) }
}

export async function handleBookmarkGoto(params = {}) {
  const doc = requireDoc()
  const name = String(params.name || '').trim()
  const index = Number(params.index)
  if (!name && !Number.isFinite(index)) {
    const err = new Error('name or index required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const bookmarks = doc.Bookmarks
  if (!bookmarks) {
    const err = new Error('Bookmarks unavailable')
    err.code = 'UNSUPPORTED'
    throw err
  }
  let bm = null
  try {
    bm = name ? bookmarks.Item(name) : bookmarks.Item(index)
  } catch (e) {
    const err = new Error(e?.message || `书签不存在：${name || index}`)
    err.code = 'BOOKMARK_NOT_FOUND'
    throw err
  }
  try {
    bm.Select?.()
    bm.Range?.Select?.()
  } catch { /* ignore */ }
  const range = bm.Range
  return {
    ok: true,
    name: String(bm.Name || name || ''),
    start: Number(range?.Start),
    end: Number(range?.End),
    document: docInfo(doc)
  }
}

/* ───────── P2 objects ───────── */

export async function handleTableInsert(params = {}) {
  const doc = requireDoc()
  const rows = Math.max(1, Number(params.rows) || 2)
  const columns = Math.max(1, Number(params.columns) || 2)
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: [`table ${rows}x${columns}`],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  if (params.originalText) {
    const hit = locateFirst(doc, params.originalText, Number(params.hintStart) || 0)
    if (hit) {
      try {
        doc.Range(hit.end, hit.end).Select?.()
      } catch { /* ignore */ }
    }
  }
  const result = insertTableAtPosition({
    rows,
    columns,
    pageNumber: params.pageNumber
  })
  return {
    ok: true,
    preview: false,
    rows: result.rows,
    columns: result.columns,
    document: docInfo(doc)
  }
}

/* ───────── P1 table slice reads (fact-only, §P7) ───────── */

const CELL_NOISE_RE = /[\r\n\f\v]/g

function cleanCellText(s) {
  return String(s || '').replace(CELL_NOISE_RE, ' ').replace(/\s+/g, ' ').trim()
}

function pickTable(doc, tableIndex) {
  const tables = doc.Tables
  const total = Number(tables?.Count || 0)
  if (!total) {
    const err = new Error('文档中没有表格')
    err.code = 'NO_TABLE'
    throw err
  }
  const idx = Number(tableIndex)
  if (!Number.isFinite(idx) || idx < 1) {
    const err = new Error('tableIndex required (1-based, from table.list)')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  if (idx > total) {
    const err = new Error(`tableIndex 超出范围：共 ${total} 张表`)
    err.code = 'TABLE_NOT_FOUND'
    throw err
  }
  return { table: tables.Item(idx), index: idx, total }
}

// Read one row by its visual Cell collection (robust to merged cells; col is cell-ordinal).
function readRowCells(row) {
  const out = []
  const cells = row?.Cells
  const n = Number(cells?.Count || 0)
  for (let c = 1; c <= n; c++) {
    try {
      const cell = cells.Item(c)
      out.push({ col: c, text: cleanCellText(String(cell.Range?.Text || '')) })
    } catch { /* skip merged/broken cell */ }
  }
  return out
}

export async function handleTableList(params = {}) {
  const doc = requireDoc()
  const tables = doc.Tables
  const total = Number(tables?.Count || 0)
  const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 300)
  const items = []
  for (let i = 1; i <= total && items.length < limit; i++) {
    try {
      const t = tables.Item(i)
      const rows = Number(t.Rows?.Count || 0)
      const cols = Number(t.Columns?.Count || 0)
      const range = t.Range
      const start = Number(range?.Start)
      const end = Number(range?.End)
      // header snippet — first row text, trimmed, capped (NOT full table)
      let headerSnippet = ''
      try {
        headerSnippet = cleanCellText(String(t.Rows?.Item(1)?.Range?.Text || '')).slice(0, 80)
      } catch { /* ignore */ }
      // caption snippet — paragraph immediately before the table, if it looks like 图N/表N/式N
      let captionSnippet = ''
      try {
        if (Number.isFinite(start) && start > 0) {
          const r = doc.Range(Math.max(0, start - 1), Math.max(0, start - 1))
          try { r.MoveStart(4, -1) } catch { /* wdParagraph = 4 */ }
          const prev = cleanCellText(String(r?.Text || ''))
          if (prev && /(图|表|式|附图|附表)\s*[\d一二三四五六七八九十]/.test(prev)) {
            captionSnippet = prev.slice(0, 80)
          }
        }
      } catch { /* ignore */ }
      // merged? — cells-after-merge count < rows×cols
      let hasMerged = false
      try {
        const cellCount = Number(t.Range?.Cells?.Count || 0)
        if (cellCount > 0 && rows > 0 && cols > 0 && cellCount < rows * cols) hasMerged = true
      } catch { /* ignore */ }
      items.push({ tableIndex: i, rows, cols, range: { start, end }, headerSnippet, captionSnippet, hasMerged })
    } catch { /* skip broken table */ }
  }
  return { ok: true, total, returned: items.length, items, document: docInfo(doc) }
}

export async function handleTableHeaderRead(params = {}) {
  const doc = requireDoc()
  const { table: t, index } = pickTable(doc, params.tableIndex)
  const headerRow = t.Rows?.Item(1)
  const range = headerRow?.Range
  let repeatHeader = null
  try { repeatHeader = !!headerRow?.HeadingFormat } catch { /* ignore */ }
  return {
    ok: true,
    tableIndex: index,
    row: 1,
    cells: readRowCells(headerRow),
    range: { start: Number(range?.Start), end: Number(range?.End) },
    repeatHeader,
    document: docInfo(doc)
  }
}

export async function handleTableRowRead(params = {}) {
  const doc = requireDoc()
  const { table: t, index } = pickTable(doc, params.tableIndex)
  const rowCount = Number(t.Rows?.Count || 0)
  const row = Number(params.row)
  if (!Number.isFinite(row) || row < 1) {
    const err = new Error('row required (1-based)')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  if (row > rowCount) {
    const err = new Error(`row 超出范围：该表共 ${rowCount} 行`)
    err.code = 'ROW_OUT_OF_RANGE'
    throw err
  }
  const rowObj = t.Rows.Item(row)
  const range = rowObj?.Range
  return {
    ok: true,
    tableIndex: index,
    row,
    cells: readRowCells(rowObj),
    range: { start: Number(range?.Start), end: Number(range?.End) },
    document: docInfo(doc)
  }
}

export async function handleTableColumnRead(params = {}) {
  const doc = requireDoc()
  const { table: t, index } = pickTable(doc, params.tableIndex)
  const rows = Number(t.Rows?.Count || 0)
  const col = Number(params.col)
  if (!Number.isFinite(col) || col < 1) {
    const err = new Error('col required (1-based)')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const cells = []
  for (let r = 1; r <= rows; r++) {
    try {
      const cell = t.Cell(r, col)
      cells.push({ row: r, text: cleanCellText(String(cell.Range?.Text || '')) })
    } catch {
      // merged / spanned / out-of-grid cell
      cells.push({ row: r, text: '', merged: true })
    }
  }
  return { ok: true, tableIndex: index, col, rows, cells, document: docInfo(doc) }
}

export async function handleTableCellRead(params = {}) {
  const doc = requireDoc()
  const { table: t, index } = pickTable(doc, params.tableIndex)
  const row = Number(params.row)
  const col = Number(params.col)
  if (!Number.isFinite(row) || row < 1 || !Number.isFinite(col) || col < 1) {
    const err = new Error('row and col required (1-based)')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  try {
    const cell = t.Cell(row, col)
    const range = cell.Range
    return {
      ok: true,
      tableIndex: index,
      row,
      col,
      text: cleanCellText(String(range?.Text || '')),
      range: { start: Number(range?.Start), end: Number(range?.End) },
      document: docInfo(doc)
    }
  } catch {
    const err = new Error(`单元格 (${row},${col}) 不可读（可能被合并或越界）`)
    err.code = 'CELL_UNREADABLE'
    throw err
  }
}

/* ───────── P3 table geometry writes (need confirmed) ───────── */

export async function handleTableHeaderRepeat(params = {}) {
  const doc = requireDoc()
  const { table: t, index } = pickTable(doc, params.tableIndex)
  const repeat = params.repeat !== false // default true
  if (params.confirmed !== true) {
    return {
      ok: true, preview: true,
      willChange: [`table ${index} repeat header = ${repeat}`],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  try {
    t.Rows.Item(1).HeadingFormat = repeat
  } catch (e) {
    const err = new Error(e?.message || '设置重复标题行失败')
    err.code = 'HEADER_REPEAT_FAILED'
    throw err
  }
  let nowRepeat = null
  try { nowRepeat = !!t.Rows.Item(1).HeadingFormat } catch { /* ignore */ }
  return { ok: true, preview: false, tableIndex: index, repeatHeader: nowRepeat, document: docInfo(doc) }
}

export async function handleTableColumnSetWidth(params = {}) {
  const doc = requireDoc()
  const { table: t, index } = pickTable(doc, params.tableIndex)
  const widthPt = Number(params.widthPt)
  if (!Number.isFinite(widthPt) || widthPt <= 0) {
    const err = new Error('widthPt required (points, >0)')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const allCols = params.allCols === true
  const col = Number(params.col)
  if (!allCols && (!Number.isFinite(col) || col < 1)) {
    const err = new Error('col required (1-based) or allCols=true')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  if (params.confirmed !== true) {
    return {
      ok: true, preview: true,
      willChange: [`table ${index} ${allCols ? 'all columns' : 'column ' + col} width = ${widthPt}pt`],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  try {
    try { t.AllowAutoFit = false } catch { /* ignore */ }
    if (allCols) {
      const n = Number(t.Columns?.Count || 0)
      for (let c = 1; c <= n; c++) {
        try { t.Columns.Item(c).Width = widthPt } catch { /* skip */ }
      }
    } else {
      t.Columns.Item(col).Width = widthPt
    }
  } catch (e) {
    const err = new Error(e?.message || '设置列宽失败')
    err.code = 'COLUMN_WIDTH_FAILED'
    throw err
  }
  const widths = []
  try {
    const n = Number(t.Columns?.Count || 0)
    for (let c = 1; c <= n; c++) {
      try { widths.push({ col: c, width: Number(t.Columns.Item(c).Width) }) } catch { /* skip */ }
    }
  } catch { /* ignore */ }
  return { ok: true, preview: false, tableIndex: index, applied: { allCols, col, widthPt }, widths, document: docInfo(doc) }
}

/* ───────── P3+ table structure writes: insert row/col, merge cells ───────── */
/* §P7: tools take explicit coordinates; the LLM locates "where" (via header_read/
   row_read/cell_read) and passes the index. No natural-language position parsing here. */

export async function handleTableRowInsert(params = {}) {
  const doc = requireDoc()
  const { table: t, index } = pickTable(doc, params.tableIndex)
  const row = Number(params.row)
  if (!Number.isFinite(row) || row < 1) {
    const err = new Error('row required (1-based anchor row)')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const count = Math.max(1, Math.min(Number(params.count) || 1, 50))
  const where = params.where === 'before' ? 'before' : 'after'
  if (params.confirmed !== true) {
    return {
      ok: true, preview: true,
      willChange: [`table ${index} insert ${count} row(s) ${where} row ${row}`],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  try {
    const total = Number(t.Rows?.Count || 0)
    // Rows.Add(BeforeRow) inserts immediately before the given row object.
    // For 'after row n' insert before row n+1; if n is the last row, append at end.
    let beforeRow = null
    if (where === 'before') beforeRow = row <= total ? t.Rows.Item(row) : null
    else beforeRow = row + 1 <= total ? t.Rows.Item(row + 1) : null
    if (!t.Rows?.Add) throw new Error('Rows.Add unavailable')
    for (let i = 0; i < count; i++) {
      try { beforeRow ? t.Rows.Add(beforeRow) : t.Rows.Add() }
      catch { t.Rows.Add() }
    }
  } catch (e) {
    const err = new Error(e?.message || '插入行失败')
    err.code = 'ROW_INSERT_FAILED'
    throw err
  }
  let nowRows = null
  try { nowRows = Number(t.Rows?.Count || 0) } catch { /* ignore */ }
  return { ok: true, preview: false, tableIndex: index, insertedRows: count, where, atRow: row, rows: nowRows, document: docInfo(doc) }
}

export async function handleTableColumnInsert(params = {}) {
  const doc = requireDoc()
  const { table: t, index } = pickTable(doc, params.tableIndex)
  const col = Number(params.col)
  if (!Number.isFinite(col) || col < 1) {
    const err = new Error('col required (1-based anchor column)')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const count = Math.max(1, Math.min(Number(params.count) || 1, 50))
  const where = params.where === 'before' ? 'before' : 'after'
  if (params.confirmed !== true) {
    return {
      ok: true, preview: true,
      willChange: [`table ${index} insert ${count} column(s) ${where} col ${col}`],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  try {
    const total = Number(t.Columns?.Count || 0)
    let beforeCol = null
    if (where === 'before') beforeCol = col <= total ? t.Columns.Item(col) : null
    else beforeCol = col + 1 <= total ? t.Columns.Item(col + 1) : null
    if (!t.Columns?.Add) throw new Error('Columns.Add unavailable')
    for (let i = 0; i < count; i++) {
      try { beforeCol ? t.Columns.Add(beforeCol) : t.Columns.Add() }
      catch { t.Columns.Add() }
    }
  } catch (e) {
    const err = new Error(e?.message || '插入列失败')
    err.code = 'COLUMN_INSERT_FAILED'
    throw err
  }
  let nowCols = null
  try { nowCols = Number(t.Columns?.Count || 0) } catch { /* ignore */ }
  return { ok: true, preview: false, tableIndex: index, insertedColumns: count, where, atCol: col, cols: nowCols, document: docInfo(doc) }
}

// Merge a rectangular cell range. (r,c)-(r,c) across columns = "merge columns";
// across rows = "merge rows". Corners are normalized to top-left / bottom-right.
export async function handleTableCellMerge(params = {}) {
  const doc = requireDoc()
  const { table: t, index } = pickTable(doc, params.tableIndex)
  const r1 = Number(params.row1 ?? params.startRow)
  const c1 = Number(params.col1 ?? params.startCol)
  const r2 = Number(params.row2 ?? params.endRow)
  const c2 = Number(params.col2 ?? params.endCol)
  if (![r1, c1, r2, c2].every(Number.isFinite) || r1 < 1 || c1 < 1 || r2 < 1 || c2 < 1) {
    const err = new Error('row1,col1,row2,col2 required (merge rectangle corners, 1-based)')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const top = Math.min(r1, r2), left = Math.min(c1, c2)
  const bottom = Math.max(r1, r2), right = Math.max(c1, c2)
  if (top === bottom && left === right) {
    const err = new Error('合并范围是单个单元格，无需合并')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  const direction = top === bottom ? 'columns' : (left === right ? 'rows' : 'block')
  if (params.confirmed !== true) {
    return {
      ok: true, preview: true,
      willChange: [`table ${index} merge cells (${top},${left})-(${bottom},${right}) [${direction}]`],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  try {
    const tl = t.Cell(top, left)
    const br = t.Cell(bottom, right)
    if (!tl?.Merge) throw new Error('Cell.Merge unavailable')
    tl.Merge(br)
  } catch (e) {
    const err = new Error(e?.message || '合并单元格失败')
    err.code = 'CELL_MERGE_FAILED'
    throw err
  }
  return { ok: true, preview: false, tableIndex: index, merged: { top, left, bottom, right }, direction, document: docInfo(doc) }
}

function csvQuote(s) {
  const v = String(s ?? '')
  if (/[",\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'
  return v
}

// Serialize tables to md/csv/json as DATA (read-only). The addin has no general disk-write,
// so we return structured content for the host/LLM to persist — aligns with §P7 (Agent = facts).
export async function handleTableExport(params = {}) {
  const doc = requireDoc()
  const format = String(params.format || 'md').toLowerCase()
  const tables = doc.Tables
  const total = Number(tables?.Count || 0)
  const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 300)
  const out = []
  for (let i = 1; i <= total && out.length < limit; i++) {
    try {
      const t = tables.Item(i)
      const rows = Number(t.Rows?.Count || 0)
      const cols = Number(t.Columns?.Count || 0)
      // best-effort grid; merged cells collapse to '' (use cell_read for precision)
      const grid = []
      for (let r = 1; r <= rows; r++) {
        const row = []
        let cells = null
        try { cells = t.Rows.Item(r).Cells } catch { /* ignore */ }
        for (let c = 1; c <= cols; c++) {
          let txt = ''
          try { txt = cleanCellText(String(cells.Item(c).Range?.Text || '')) } catch { txt = '' }
          row.push(txt)
        }
        grid.push(row)
      }
      let content = ''
      if (format === 'csv') {
        content = grid.map((row) => row.map(csvQuote).join(',')).join('\n')
      } else if (format === 'json') {
        content = JSON.stringify(grid)
      } else { // md
        const header = grid[0] || []
        const lines = []
        lines.push('| ' + header.join(' | ') + ' |')
        lines.push('| ' + header.map(() => '---').join(' | ') + ' |')
        for (let r = 1; r < grid.length; r++) lines.push('| ' + grid[r].join(' | ') + ' |')
        content = lines.join('\n')
      }
      out.push({ tableIndex: i, rows, cols, format, content })
    } catch { /* skip broken table */ }
  }
  return { ok: true, total, returned: out.length, format, tables: out, document: docInfo(doc) }
}

/* ───────── P2 caption + field (facts / field-construction; §P7) ───────── */

// Enumerate 图/表/式 caption facts. numberText is best-effort — continuity/gaps judged by the LLM.
export async function handleCaptionList(params = {}) {
  const doc = requireDoc()
  const kind = String(params.kind || 'all')
  const limit = Math.min(Math.max(Number(params.limit) || 500, 1), 1000)
  const paras = doc.Paragraphs
  const total = Number(paras?.Count || 0)
  const items = []
  const CAP_RE = /(附图|附表|图|表|式)\s*([\d一二三四五六七八九十百]+(?:[-–—]\d+)?(?:\.\d+)*)/
  for (let i = 1; i <= total && items.length < limit; i++) {
    try {
      const para = paras.Item(i)
      const range = para.Range
      const text = String(range?.Text || '').replace(/[\r\n\f\v]/g, '').trim()
      const m = text.match(CAP_RE)
      if (!m) continue
      const k = m[1]
      if (kind !== 'all' && k !== kind) continue
      let isSeqField = false
      try {
        const fields = range.Fields
        const fc = Number(fields?.Count || 0)
        for (let f = 1; f <= fc; f++) {
          if (/SEQ/i.test(String(fields.Item(f)?.Code?.Text || ''))) { isSeqField = true; break }
        }
      } catch { /* ignore */ }
      items.push({
        paragraphIndex: i,
        kind: k,
        numberText: m[2],
        fullText: text.slice(0, 200),
        isSeqField,
        range: { start: Number(range?.Start), end: Number(range?.End) }
      })
    } catch { /* skip */ }
  }
  return { ok: true, total, returned: items.length, items, document: docInfo(doc) }
}

export async function handleFieldList(params = {}) {
  const doc = requireDoc()
  const typeFilter = String(params.type || 'all').toUpperCase()
  const limit = Math.min(Math.max(Number(params.limit) || 200, 1), 500)
  const fields = doc.Fields
  const total = Number(fields?.Count || 0)
  const items = []
  for (let i = 1; i <= total && items.length < limit; i++) {
    try {
      const f = fields.Item(i)
      const code = String(f?.Code?.Text || '').trim()
      const tm = code.match(/^\\?\s*([A-Za-z][A-Za-z0-9_]*)/)
      const type = tm ? tm[1].toUpperCase() : ''
      if (typeFilter !== 'ALL' && type !== typeFilter) continue
      let resultText = ''
      try { resultText = String(f?.Result?.Text || '').replace(/[\r\n\f\v]/g, '').trim() } catch { /* ignore */ }
      const range = f?.Result?.Range || f?.Code?.Range
      items.push({
        index: i,
        type,
        code: code.slice(0, 300),
        resultText: resultText.slice(0, 200),
        range: { start: Number(range?.Start), end: Number(range?.End) }
      })
    } catch { /* skip */ }
  }
  return { ok: true, total, returned: items.length, items, document: docInfo(doc) }
}

// Construct SEQ (auto-number caption) or TOC field. Degrades to plain text if host lacks Fields.Add.
export async function handleFieldAdd(params = {}) {
  const doc = requireDoc()
  const kind = String(params.kind || 'seq').toLowerCase()
  if (params.confirmed !== true) {
    return {
      ok: true, preview: true,
      willChange: [`insert ${kind} field`],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const range = resolveInsertRange(doc, params)
  const fields = doc.Fields
  const label = String(params.label || '').trim() || (kind === 'toc' ? '目录' : '图')
  if (!fields?.Add) {
    try { range.Text = label } catch { /* ignore */ }
    return { ok: true, preview: false, how: 'plain', kind, label, document: docInfo(doc) }
  }
  try {
    const wdFieldEmpty = getApplication()?.Enum?.wdFieldEmpty ?? -1
    let field
    if (kind === 'toc') {
      const ul = Number(params.upperLevel) || 1
      const ll = Number(params.lowerLevel) || 3
      field = fields.Add(range, wdFieldEmpty, `TOC \\o "${ul}-${ll}" \\h \\z \\u`, true)
    } else {
      field = fields.Add(range, wdFieldEmpty, `SEQ ${label} \\* ARABIC`, true)
    }
    let resultText = ''
    try { resultText = String(field?.Result?.Text || '').replace(/[\r\n\f\v]/g, '').trim() } catch { /* ignore */ }
    return { ok: true, preview: false, how: kind, kind, label, resultText, document: docInfo(doc) }
  } catch (e) {
    try { range.Text = label } catch { /* ignore */ }
    return { ok: true, preview: false, how: 'plain', kind, label, warning: e?.message || 'field add failed', document: docInfo(doc) }
  }
}

// Image metadata enrichment — alt/title/wrap/neighbouring text. Best-effort, fully defensive.
function readShapeMeta(doc, shape, kind, start, end) {
  const meta = {}
  try {
    const alt = String(shape?.AlternativeText || shape?.AltText || '')
    if (alt) meta.altText = alt
  } catch { /* ignore */ }
  try {
    const ttl = String(shape?.Title || '')
    if (ttl) meta.title = ttl
  } catch { /* ignore */ }
  meta.wrap = kind === 'inline' ? 'inline' : 'floating'
  if (kind !== 'inline') {
    try { meta.wrapType = Number(shape?.WrapFormat?.Type) } catch { /* ignore */ }
  }
  try {
    if (Number.isFinite(start) && start > 0) {
      const r = doc.Range(Math.max(0, start - 30), start)
      const p = String(r?.Text || '').replace(/[\r\n\f\v]/g, ' ').replace(/\s+/g, ' ').trim()
      if (p) meta.precedingText = p.slice(-40)
    }
  } catch { /* ignore */ }
  try {
    if (Number.isFinite(end)) {
      const r = doc.Range(end, end + 30)
      const f = String(r?.Text || '').replace(/[\r\n\f\v]/g, ' ').replace(/\s+/g, ' ').trim()
      if (f) meta.followingText = f.slice(0, 40)
    }
  } catch { /* ignore */ }
  return meta
}

export async function handleImageList(params = {}) {
  const doc = requireDoc()
  const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 300)
  const items = []
  const inlines = doc.InlineShapes
  const ic = Number(inlines?.Count || 0)
  for (let i = 1; i <= ic && items.length < limit; i++) {
    try {
      const shape = inlines.Item(i)
      const type = Number(shape?.Type)
      // 3 = picture in some hosts; 13 floating mapped differently — include most inlines
      const range = shape?.Range
      const start = Number(range?.Start)
      const end = Number(range?.End)
      items.push({
        kind: 'inline',
        index: i,
        type,
        width: Number(shape?.Width),
        height: Number(shape?.Height),
        start,
        end,
        ...readShapeMeta(doc, shape, 'inline', start, end)
      })
    } catch { /* skip */ }
  }
  const shapes = doc.Shapes
  const sc = Number(shapes?.Count || 0)
  for (let i = 1; i <= sc && items.length < limit; i++) {
    try {
      const shape = shapes.Item(i)
      const type = Number(shape?.Type)
      if (type !== 13 && type !== 1) continue
      const anchor = shape?.Anchor
      const fStart = Number(anchor?.Start)
      const fEnd = Number(anchor?.End)
      items.push({
        kind: 'floating',
        index: i,
        type,
        width: Number(shape?.Width),
        height: Number(shape?.Height),
        start: fStart,
        end: fEnd,
        ...readShapeMeta(doc, shape, 'floating', fStart, fEnd)
      })
    } catch { /* skip */ }
  }
  return { ok: true, returned: items.length, items, document: docInfo(doc) }
}

export async function handleImageInsert(params = {}) {
  const doc = requireDoc()
  const path = String(params.path || params.filePath || '').trim()
  if (!path) {
    const err = new Error('path required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: [`insert picture ${path}`],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const range = resolveInsertRange(doc, params)
  tryAddInlinePicture(path, range)
  return { ok: true, preview: false, path, document: docInfo(doc) }
}

export async function handleImageDelete(params = {}) {
  const doc = requireDoc()
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: ['delete image(s)'],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  let deleted = 0
  const kind = String(params.kind || 'inline')
  const index = Number(params.index)
  if (Number.isFinite(index) && index >= 1) {
    try {
      if (kind === 'floating') doc.Shapes.Item(index).Delete()
      else doc.InlineShapes.Item(index).Delete()
      deleted = 1
    } catch (e) {
      const err = new Error(e?.message || '删除图片失败')
      err.code = 'IMAGE_DELETE_FAILED'
      throw err
    }
  } else if (params.all === true) {
    // delete from end to start
    const inlines = doc.InlineShapes
    for (let i = Number(inlines?.Count || 0); i >= 1; i--) {
      try {
        inlines.Item(i).Delete()
        deleted += 1
      } catch { /* skip */ }
    }
    const shapes = doc.Shapes
    for (let i = Number(shapes?.Count || 0); i >= 1; i--) {
      try {
        const s = shapes.Item(i)
        const type = Number(s?.Type)
        if (type === 13 || type === 1) {
          s.Delete()
          deleted += 1
        }
      } catch { /* skip */ }
    }
  } else {
    const err = new Error('Provide index(+kind) or all:true')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  return { ok: true, preview: false, deleted, document: docInfo(doc) }
}

export async function handleImageExport(params = {}) {
  const doc = requireDoc()
  const folder = String(params.folder || params.path || '').trim()
  if (!folder) {
    const err = new Error('folder required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: [`export images → ${folder}`],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const exported = []
  const inlines = doc.InlineShapes
  const count = Number(inlines?.Count || 0)
  for (let i = 1; i <= count; i++) {
    try {
      const shape = inlines.Item(i)
      const out = `${folder.replace(/[/\\]$/, '')}\\image_${i}.png`
      if (typeof shape.SaveAsPicture === 'function') {
        shape.SaveAsPicture(out)
        exported.push(out)
      }
    } catch { /* skip unsupported */ }
  }
  return {
    ok: true,
    preview: false,
    exportedCount: exported.length,
    exported,
    document: docInfo(doc)
  }
}

export async function handleHyperlinkList(params = {}) {
  const doc = requireDoc()
  const links = doc.Hyperlinks
  const total = Number(links?.Count || 0)
  const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 300)
  const items = []
  for (let i = 1; i <= total && items.length < limit; i++) {
    try {
      const h = links.Item(i)
      items.push({
        index: i,
        text: String(h?.TextToDisplay || h?.Range?.Text || '')
          .replace(/\r/g, '')
          .slice(0, 120),
        address: String(h?.Address || ''),
        subAddress: String(h?.SubAddress || ''),
        start: Number(h?.Range?.Start),
        end: Number(h?.Range?.End)
      })
    } catch { /* skip */ }
  }
  return { ok: true, total, returned: items.length, items, document: docInfo(doc) }
}

export async function handleHyperlinkAdd(params = {}) {
  const doc = requireDoc()
  const address = String(params.address || params.url || '').trim()
  if (!address) {
    const err = new Error('address required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: [`hyperlink → ${address}`],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const range = resolveInsertRange(doc, params)
  const text = String(params.text || params.displayText || '').trim()
  if (text && Number(range.End) <= Number(range.Start)) {
    try {
      range.Text = text
    } catch { /* ignore */ }
  }
  const links = doc.Hyperlinks
  if (!links?.Add) {
    const err = new Error('Hyperlinks.Add unavailable')
    err.code = 'UNSUPPORTED'
    throw err
  }
  try {
    links.Add(range, address, String(params.subAddress || ''), '', text || undefined)
  } catch (e) {
    try {
      links.Add(range, address)
    } catch (e2) {
      const err = new Error(e2?.message || e?.message || '添加超链接失败')
      err.code = 'HYPERLINK_ADD_FAILED'
      throw err
    }
  }
  return { ok: true, preview: false, address, document: docInfo(doc) }
}

export async function handleHyperlinkDelete(params = {}) {
  const doc = requireDoc()
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: ['delete hyperlink(s)'],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const links = doc.Hyperlinks
  let deleted = 0
  const index = Number(params.index)
  if (Number.isFinite(index) && index >= 1) {
    try {
      links.Item(index).Delete()
      deleted = 1
    } catch (e) {
      const err = new Error(e?.message || '删除超链接失败')
      err.code = 'HYPERLINK_DELETE_FAILED'
      throw err
    }
  } else if (params.all === true) {
    for (let i = Number(links?.Count || 0); i >= 1; i--) {
      try {
        links.Item(i).Delete()
        deleted += 1
      } catch { /* skip */ }
    }
  } else {
    const err = new Error('Provide index or all:true')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  return { ok: true, preview: false, deleted, document: docInfo(doc) }
}

export async function handleHeaderFooterGet(params = {}) {
  const doc = requireDoc()
  const sectionIndex = Math.max(1, Number(params.section) || 1)
  const which = String(params.which || 'both') // header|footer|both
  const sections = doc.Sections
  const section = sections?.Item?.(sectionIndex)
  if (!section) {
    const err = new Error(`节不存在: ${sectionIndex}`)
    err.code = 'SECTION_NOT_FOUND'
    throw err
  }
  const wdHeaderFooterPrimary = getApplication()?.Enum?.wdHeaderFooterPrimary ?? 1
  const result = { section: sectionIndex }
  if (which === 'header' || which === 'both') {
    try {
      const h = section.Headers.Item(wdHeaderFooterPrimary)
      result.header = String(h?.Range?.Text || '').replace(/\r/g, '\n').trim()
    } catch {
      result.header = null
    }
  }
  if (which === 'footer' || which === 'both') {
    try {
      const f = section.Footers.Item(wdHeaderFooterPrimary)
      result.footer = String(f?.Range?.Text || '').replace(/\r/g, '\n').trim()
    } catch {
      result.footer = null
    }
  }
  return { ok: true, ...result, document: docInfo(doc) }
}

export async function handleHeaderFooterSet(params = {}) {
  const doc = requireDoc()
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: [
        params.header != null ? 'set header' : null,
        params.footer != null ? 'set footer' : null
      ].filter(Boolean),
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const sectionIndex = Math.max(1, Number(params.section) || 1)
  const section = doc.Sections?.Item?.(sectionIndex)
  if (!section) {
    const err = new Error(`节不存在: ${sectionIndex}`)
    err.code = 'SECTION_NOT_FOUND'
    throw err
  }
  const wdHeaderFooterPrimary = getApplication()?.Enum?.wdHeaderFooterPrimary ?? 1
  if (params.header != null) {
    try {
      const h = section.Headers.Item(wdHeaderFooterPrimary)
      h.Range.Text = String(params.header)
    } catch (e) {
      const err = new Error(e?.message || '设置页眉失败')
      err.code = 'HEADER_SET_FAILED'
      throw err
    }
  }
  if (params.footer != null) {
    try {
      const f = section.Footers.Item(wdHeaderFooterPrimary)
      f.Range.Text = String(params.footer)
    } catch (e) {
      const err = new Error(e?.message || '设置页脚失败')
      err.code = 'FOOTER_SET_FAILED'
      throw err
    }
  }
  return { ok: true, preview: false, section: sectionIndex, document: docInfo(doc) }
}

export async function handleWatermarkSet(params = {}) {
  const doc = requireDoc()
  const text = String(params.text || '保密').trim()
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: [`watermark=${text}`],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  const section = doc.Sections?.Item?.(1)
  const wdHeaderFooterPrimary = getApplication()?.Enum?.wdHeaderFooterPrimary ?? 1
  const header = section?.Headers?.Item?.(wdHeaderFooterPrimary)
  if (!header?.Shapes) {
    const err = new Error('无法在页眉插入水印图形')
    err.code = 'UNSUPPORTED'
    throw err
  }
  // Clear previous text watermarks tagged by name when possible
  try {
    const shapes = header.Shapes
    for (let i = Number(shapes.Count || 0); i >= 1; i--) {
      const s = shapes.Item(i)
      if (String(s?.Name || '').startsWith('ChayuanWatermark')) s.Delete()
    }
  } catch { /* ignore */ }

  let shape = null
  try {
    // AddTextEffect(PresetTextEffect, Text, FontName, FontSize, FontBold, FontItalic, Left, Top)
    shape = header.Shapes.AddTextEffect(1, text, '宋体', 36, false, false, 0, 0)
  } catch {
    try {
      shape = header.Shapes.AddTextbox(1, 60, 200, 400, 80)
      shape.TextFrame.TextRange.Text = text
    } catch (e) {
      const err = new Error(e?.message || '插入水印失败')
      err.code = 'WATERMARK_FAILED'
      throw err
    }
  }
  try {
    shape.Name = `ChayuanWatermark_${Date.now()}`
    shape.Rotation = Number(params.rotation != null ? params.rotation : -30)
    if (shape.Fill) {
      try {
        shape.Fill.Visible = false
      } catch { /* ignore */ }
    }
    if (shape.Line) {
      try {
        shape.Line.Visible = false
      } catch { /* ignore */ }
    }
    // wash out
    try {
      if (shape.TextEffect) shape.TextEffect.FontSize = Number(params.fontSize) || 48
    } catch { /* ignore */ }
    try {
      shape.WrapFormat.Type = 3 // behind text when supported
    } catch { /* ignore */ }
  } catch { /* styling best-effort */ }
  return { ok: true, preview: false, text, document: docInfo(doc) }
}

export async function handleWatermarkClear(params = {}) {
  const doc = requireDoc()
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: ['clear Chayuan watermarks'],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  let cleared = 0
  const sectionCount = Number(doc.Sections?.Count || 0)
  const wdHeaderFooterPrimary = getApplication()?.Enum?.wdHeaderFooterPrimary ?? 1
  for (let s = 1; s <= sectionCount; s++) {
    try {
      const header = doc.Sections.Item(s).Headers.Item(wdHeaderFooterPrimary)
      const shapes = header.Shapes
      for (let i = Number(shapes?.Count || 0); i >= 1; i--) {
        const shape = shapes.Item(i)
        const name = String(shape?.Name || '')
        if (name.startsWith('ChayuanWatermark') || params.all === true) {
          shape.Delete()
          cleared += 1
        }
      }
    } catch { /* skip section */ }
  }
  return { ok: true, preview: false, cleared, document: docInfo(doc) }
}

export async function handleDocumentExport(params = {}) {
  const doc = requireDoc()
  const format = String(params.format || 'docx').toLowerCase()
  const outPath = String(params.path || '').trim()
  if (!outPath) {
    const err = new Error('path required')
    err.code = 'INVALID_PARAMS'
    throw err
  }
  if (params.confirmed !== true) {
    return {
      ok: true,
      preview: true,
      willChange: [`export ${format} → ${outPath}`],
      nextHint: 'Call again with confirmed=true to apply',
      document: docInfo(doc)
    }
  }
  requireConfirmed(params)
  if (format === 'docx' || format === 'doc') {
    saveActiveDocumentAs(outPath)
    return { ok: true, preview: false, format: 'docx', path: outPath, document: docInfo(doc) }
  }
  if (format === 'pdf') {
    const wdExportFormatPDF = getApplication()?.Enum?.wdExportFormatPDF ?? 17
    const wdFormatPDF = getApplication()?.Enum?.wdFormatPDF ?? 17
    try {
      if (typeof doc.ExportAsFixedFormat === 'function') {
        doc.ExportAsFixedFormat(outPath, wdExportFormatPDF)
      } else if (typeof doc.SaveAs2 === 'function') {
        doc.SaveAs2(outPath, wdFormatPDF)
      } else if (typeof doc.SaveAs === 'function') {
        doc.SaveAs(outPath, wdFormatPDF)
      } else {
        throw new Error('宿主不支持 PDF 导出')
      }
    } catch (e) {
      const err = new Error(e?.message || 'PDF 导出失败')
      err.code = 'EXPORT_FAILED'
      throw err
    }
    return { ok: true, preview: false, format: 'pdf', path: outPath, document: docInfo(doc) }
  }
  const err = new Error(`不支持的导出格式: ${format}`)
  err.code = 'UNSUPPORTED_FORMAT'
  throw err
}

export async function handleStyleAudit(params = {}) {
  const doc = requireDoc()
  const action = String(params.action || 'stats') // stats | unused | purge_unused
  const paras = doc.Paragraphs
  const pCount = Number(paras?.Count || 0)
  const usage = new Map()
  for (let i = 1; i <= pCount; i++) {
    try {
      const name = String(paras.Item(i)?.Style?.NameLocal || paras.Item(i)?.Style?.Name || '')
      if (!name) continue
      usage.set(name, (usage.get(name) || 0) + 1)
    } catch { /* skip */ }
  }
  if (action === 'stats') {
    const items = [...usage.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, Math.min(Number(params.limit) || 100, 300))
    return {
      ok: true,
      action,
      paragraphCount: pCount,
      styleCount: usage.size,
      items,
      document: docInfo(doc)
    }
  }

  const styles = doc.Styles
  const sCount = Number(styles?.Count || 0)
  const unused = []
  for (let i = 1; i <= sCount; i++) {
    try {
      const st = styles.Item(i)
      const name = String(st?.NameLocal || st?.Name || '')
      if (!name) continue
      // skip builtins roughly
      const builtIn = !!st?.BuiltIn
      if (builtIn) continue
      if (!usage.has(name)) unused.push({ index: i, name })
    } catch { /* skip */ }
  }

  if (action === 'unused') {
    return {
      ok: true,
      action,
      unusedCount: unused.length,
      unused: unused.slice(0, Math.min(Number(params.limit) || 100, 300)),
      document: docInfo(doc)
    }
  }

  if (action === 'purge_unused') {
    if (params.confirmed !== true) {
      return {
        ok: true,
        preview: true,
        action,
        willChange: [`delete ${unused.length} unused styles`],
        unusedCount: unused.length,
        nextHint: 'Call again with confirmed=true to apply',
        document: docInfo(doc)
      }
    }
    requireConfirmed(params)
    let deleted = 0
    // delete by name from end of unused list
    for (let i = unused.length - 1; i >= 0; i--) {
      try {
        styles.Item(unused[i].name).Delete()
        deleted += 1
      } catch { /* skip locked */ }
    }
    return { ok: true, preview: false, action, deleted, document: docInfo(doc) }
  }

  const err = new Error(`unknown action: ${action}`)
  err.code = 'INVALID_PARAMS'
  throw err
}
