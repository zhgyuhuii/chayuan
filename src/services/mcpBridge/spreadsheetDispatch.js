/**
 * WPS 表格（ET 宿主）MCP dispatch：spreadsheet.<action> 方法落地层。
 *
 * 对象模型为 Excel VBA 的 JS 镜像（官方 office_v19「表格 API 参考」）：
 * Application → ActiveWorkbook → Worksheets → Range。全部区域定位使用 A1 记法
 * 字符串（Mac JSAPI 无 sheet.Cells()）；批量读写走 hostDispatch 双通道。
 */
import {
  requireHost,
  getActiveWorkbook,
  resolveSheet,
  resolveRange,
  parseA1,
  rangeAddr,
  colToLetter,
  colorToBgr,
  readAddress,
  readRangeValues,
  writeRangeValues,
  withScreenUpdating,
  withAlertsOff,
  safeGet,
  fileExistsSafe,
  hostError,
  MAX_READ_CELLS
} from './hostDispatch.js'

/** 写 action 集合（dispatch.js 写锁判定用；其余为只读） */
export const SPREADSHEET_WRITE_ACTIONS = new Set([
  'sheet_add', 'sheet_rename', 'sheet_delete',
  'range_write', 'find_replace',
  'row_insert', 'row_delete', 'column_insert', 'column_delete',
  'sort', 'autofilter', 'format',
  'chart_add', 'chart_export',
  'export',
  'security_encrypt_save', 'security_decrypt_save'
])

/** XlChartType 常用子集（官方枚举值） */
const CHART_TYPES = {
  column: 51, columnStacked: 52, bar: 57, line: 4, pie: 5,
  doughnut: -4120, scatter: -4169, area: 1, radar: -4151
}

// CSV 内联回退上限：落盘失败且数据不超过该格数时，直接把 CSV 内容内联进响应
const MAX_INLINE_CSV_CELLS = 2000

const ALIGN = { left: -4131, center: -4108, right: -4152 }

function getApp() {
  return window.Application
}

function sheetIndex(wb, ws) {
  const sheets = wb.Worksheets
  const count = Number(safeGet(() => sheets.Count, 0))
  const name = safeGet(() => ws.Name)
  for (let i = 1; i <= count; i++) {
    if (safeGet(() => sheets.Item(i).Name) === name) return i
  }
  return 0
}

function listSheets(wb) {
  const sheets = wb.Worksheets
  const count = Number(safeGet(() => sheets.Count, 0))
  const out = []
  for (let i = 1; i <= count; i++) {
    const ws = sheets.Item(i)
    out.push({
      index: i,
      name: safeGet(() => ws.Name),
      isActive: safeGet(() => wb.ActiveSheet?.Name) === safeGet(() => ws.Name),
      usedRange: readAddress(safeGet(() => ws.UsedRange, null))
    })
  }
  return out
}

function workbookInfo(wb, extra = {}) {
  return {
    name: safeGet(() => wb.Name),
    fullName: safeGet(() => wb.FullName),
    saved: !!safeGet(() => wb.Saved, true),
    ...extra
  }
}

function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function requirePath(params) {
  const p = String(params.path || '').trim()
  if (!p) throw hostError('INVALID_PARAMS', 'path 必填（本地绝对路径）')
  return p
}

/* --------------------------- handlers --------------------------- */

function handleStatus() {
  const wb = getActiveWorkbook()
  const active = wb.ActiveSheet
  return {
    ok: true,
    host: 'et',
    workbook: workbookInfo(wb, {
      sheetCount: Number(safeGet(() => wb.Worksheets?.Count, 0)),
      activeSheet: safeGet(() => active?.Name),
      activeUsedRange: readAddress(safeGet(() => active?.UsedRange, null))
    })
  }
}

function handleSheetList() {
  const wb = getActiveWorkbook()
  return { ok: true, sheets: listSheets(wb) }
}

function handleSheetAdd(params) {
  const app = getApp()
  const wb = getActiveWorkbook()
  const sheets = wb.Worksheets
  const added = withAlertsOff(app, () => sheets.Add())
  if (!added) throw hostError('SHEET_ADD_FAILED', 'Sheets.Add 未返回新工作表')
  const name = String(params.name || '').trim()
  if (name) {
    try { added.Name = name.slice(0, 31) } catch (e) {
      throw hostError('SHEET_RENAME_FAILED', `新表已插入但改名失败（名称重复或非法）：${e?.message || e}`)
    }
  }
  const index = Number(params.index || 0)
  if (index >= 1) {
    try { added.Move(wb.Worksheets.Item(index)) } catch { /* 移动失败保留默认位置 */ }
  }
  const ws = added
  return {
    ok: true,
    sheet: safeGet(() => ws.Name),
    index: sheetIndex(wb, ws),
    sheets: listSheets(wb)
  }
}

function handleSheetRename(params) {
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const name = String(params.name || '').trim()
  if (!name) throw hostError('INVALID_PARAMS', 'name 必填')
  try {
    ws.Name = name.slice(0, 31)
  } catch (e) {
    throw hostError('SHEET_RENAME_FAILED', `改名失败（名称重复/非法或工作表被保护）：${e?.message || e}`)
  }
  return { ok: true, sheet: safeGet(() => ws.Name), index: sheetIndex(wb, ws), sheets: listSheets(wb) }
}

function handleSheetDelete(params) {
  const app = getApp()
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const name = safeGet(() => ws.Name)
  const count = Number(safeGet(() => wb.Worksheets?.Count, 0))
  if (count <= 1) throw hostError('SHEET_DELETE_REFUSED', '工作簿至少要保留一个工作表，拒绝删除。')
  withAlertsOff(app, () => ws.Delete())
  return { ok: true, deleted: name, sheets: listSheets(wb) }
}

function handleUsedRange(params) {
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const used = ws.UsedRange
  if (!used) return { ok: true, empty: true }
  const rows = Number(safeGet(() => used.Rows?.Count, 0))
  const cols = Number(safeGet(() => used.Columns?.Count, 0))
  return {
    ok: true,
    sheet: safeGet(() => ws.Name),
    address: readAddress(used),
    rows,
    cols,
    cells: rows * cols,
    note: rows * cols > MAX_READ_CELLS ? `超过单次读取上限 ${MAX_READ_CELLS} 格，range_read 会按行截断，请分批读取` : ''
  }
}

function handleRangeRead(params) {
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const rng = resolveRange(ws, params.range)
  const result = readRangeValues(ws, rng)
  return {
    ok: true,
    sheet: safeGet(() => ws.Name),
    address: result.address,
    rows: result.rows,
    cols: result.cols,
    values: result.values,
    bulk: result.bulk,
    truncated: result.truncated
  }
}

function handleRangeWrite(params) {
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const values = params.values
  if (!Array.isArray(values) || !Array.isArray(values[0])) {
    throw hostError('INVALID_PARAMS', 'values 必须是二维数组，例如 [["姓名","分数"],["张三",90]]')
  }
  // 起点优先级：startCell > range 的左上角 > A1
  let startCell = String(params.startCell || '').trim()
  if (!startCell && params.range) {
    const parsed = parseA1(String(params.range))
    if (parsed) startCell = rangeAddr(parsed.c1, parsed.r1, parsed.c1, parsed.r1)
  }
  if (!startCell) startCell = 'A1'
  const app = getApp()
  const result = withScreenUpdating(app, () => writeRangeValues(ws, startCell, values, { asFormula: params.asFormula === true }))
  return { ok: true, sheet: safeGet(() => ws.Name), ...result }
}

function handleFind(params) {
  const what = String(params.what ?? '')
  if (!what) throw hostError('INVALID_PARAMS', 'what 必填（要查找的内容）')
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const scope = resolveRange(ws, params.range)
  const hits = []
  let first = null
  let found = null
  try {
    // Find(What, After, LookIn, LookAt)：LookIn xlValues=-4163；LookAt xlWhole=1 / xlPart=2
    found = scope.Find(what, null, -4163, params.whole === true ? 1 : 2)
  } catch {
    try { found = scope.Find(what) } catch { found = null }
  }
  // Find 签名差异兜底后仍无结果 → 明确返回空
  while (found && hits.length < 500) {
    const addr = readAddress(found)
    if (!addr) break
    if (first === null) first = addr
    else if (addr === first) break // 环绕一圈
    hits.push({
      address: addr,
      value: safeGet(() => found.Value2, ''),
      sheet: safeGet(() => ws.Name)
    })
    let next = null
    try { next = scope.FindNext(found) } catch { break }
    if (!next) break
    found = next
  }
  return { ok: true, query: what, count: hits.length, hits, truncated: hits.length >= 500 }
}

function handleFindReplace(params) {
  const what = String(params.what ?? '')
  if (!what) throw hostError('INVALID_PARAMS', 'what 必填')
  const app = getApp()
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const scope = resolveRange(ws, params.range)
  const before = readAddress(scope)
  let ok = false
  withAlertsOff(app, () => {
    try {
      ok = !!scope.Replace(what, String(params.replace ?? ''), params.whole === true ? 1 : 2)
    } catch {
      ok = !!scope.Replace(what, String(params.replace ?? ''))
    }
  })
  return {
    ok: true,
    replaced: ok,
    sheet: safeGet(() => ws.Name),
    scope: before,
    what,
    replace: String(params.replace ?? ''),
    note: 'Replace 返回是否执行了替换；具体命中数请在替换后用 find 复核'
  }
}

// 行/列定位走"单元格区域 + EntireRow/EntireColumn"（官方：Worksheet.Rows/Columns
// 返回 Range 对象、无独立对象页；裸行地址 "5:7" 各版本解析不稳，A1 区域最可靠）
function entireRowRange(ws, index, count) {
  const c = Math.max(1, Number(count) || 1)
  const r = Number(index)
  return ws.Range(rangeAddr(1, r, 2, r + c - 1)).EntireRow
}

function entireColRange(ws, col, count) {
  const c = Math.max(1, Number(count) || 1)
  return ws.Range(rangeAddr(col, 1, Number(col) + c - 1, 1)).EntireColumn
}

function handleRowInsert(params) {
  const row = Number(params.row)
  if (!row || row < 1) throw hostError('INVALID_PARAMS', 'row 必填（1-based 行号，插入到该行之前）')
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const app = getApp()
  withScreenUpdating(app, () => entireRowRange(ws, row, params.count).Insert())
  return { ok: true, sheet: safeGet(() => ws.Name), insertedAtRow: row }
}

function handleRowDelete(params) {
  const row = Number(params.row)
  if (!row || row < 1) throw hostError('INVALID_PARAMS', 'row 必填（1-based 行号）')
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const app = getApp()
  withAlertsOff(app, () => withScreenUpdating(app, () => entireRowRange(ws, row, params.count).Delete()))
  return { ok: true, sheet: safeGet(() => ws.Name), deletedRow: row }
}

function handleColumnInsert(params) {
  const col = Number(params.col)
  if (!col || col < 1) throw hostError('INVALID_PARAMS', 'col 必填（1-based 列号，插入到该列之前）')
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const app = getApp()
  withScreenUpdating(app, () => entireColRange(ws, col, params.count).Insert())
  return { ok: true, sheet: safeGet(() => ws.Name), insertedAtColumn: col }
}

function handleColumnDelete(params) {
  const col = Number(params.col)
  if (!col || col < 1) throw hostError('INVALID_PARAMS', 'col 必填（1-based 列号）')
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const app = getApp()
  withAlertsOff(app, () => withScreenUpdating(app, () => entireColRange(ws, col, params.count).Delete()))
  return { ok: true, sheet: safeGet(() => ws.Name), deletedColumn: col }
}

function handleSort(params) {
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const rng = resolveRange(ws, params.range)
  const order = params.order === 'desc' ? 2 : 1 // 1=xlAscending 2=xlDescending
  const header = params.header === true
  const parsed = parseA1(readAddress(rng))
  if (!parsed) throw hostError('INVALID_RANGE', '无法解析排序区域地址')
  // header=true 时跳过首行（Sort 的 Header 位置参数跨版本不稳，直接缩区域最可靠）
  const dataAddr = header && parsed.r2 > parsed.r1
    ? rangeAddr(parsed.c1, parsed.r1 + 1, parsed.c2, parsed.r2)
    : rangeAddr(parsed.c1, parsed.r1, parsed.c2, parsed.r2)
  const dataRng = ws.Range(dataAddr)
  const dataParsed = parseA1(dataAddr)
  // keyColumn 为工作表绝对列号；缺省取区域首列
  const keyCol = Number(params.keyColumn) || parsed.c1
  if (keyCol < parsed.c1 || keyCol > parsed.c2) {
    throw hostError('INVALID_PARAMS', `keyColumn=${keyCol} 不在排序区域第 ${parsed.c1}-${parsed.c2} 列内（绝对列号，如 D 列传 4）`)
  }
  const key = ws.Range(`${colToLetter(keyCol)}${dataParsed.r1}`)
  const app = getApp()

  // 策略链（真机实证：mac ET 的 Range.Sort 全参数位置传法静默无效）：
  // 1) 原生 Sort 全参数；2) Worksheet.Sort SortFields API；3) JS 侧读回排序写回
  //    （公式会被替换为当前计算值——结果里以 jsFallback 标注）
  let strategy = 'native'
  let jsFallbackNote = ''
  try {
    withScreenUpdating(app, () => dataRng.Sort(key, order, null, null, null, null, null, 2, null, null, 1))
  } catch { /* 落到下一策略 */ }

  // 策略 2：JS 侧排序回退（读值→排序→写回；公式变计算值）。
  // （真机实证：Worksheet.Sort/SortFields API 在 mac ET 上会挂起 ~90s，已弃用）
  if (!sortVerified(ws, dataAddr, keyCol, order)) {
    strategy = 'js'
    const read = readRangeValues(ws, dataRng)
    const rows = read.values
    const keyIdx = keyCol - dataParsed.c1
    const idx = rows.map((_, i) => i)
    idx.sort((a, b) => {
      const va = rows[a][keyIdx]
      const vb = rows[b][keyIdx]
      const na = Number(va)
      const nb = Number(vb)
      const bothNum = Number.isFinite(na) && Number.isFinite(nb) && String(va).trim() !== '' && String(vb).trim() !== ''
      let cmp
      if (bothNum) cmp = na - nb
      else cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'zh-Hans-CN')
      return order === 1 ? cmp : -cmp
    })
    const sorted = idx.map((i) => rows[i])
    writeRangeValues(ws, rangeAddr(dataParsed.c1, dataParsed.r1, dataParsed.c1, dataParsed.r1), sorted)
    jsFallbackNote = '排序经 JS 回退完成：区域内公式已被替换为其当前计算值。'
  }

  return {
    ok: true,
    sheet: safeGet(() => ws.Name),
    range: dataAddr,
    keyColumn: keyCol,
    order: order === 1 ? 'asc' : 'desc',
    header,
    strategy,
    ...(jsFallbackNote ? { note: jsFallbackNote } : {})
  }
}

/** 排序生效校验：取关键列前后若干值判断单调性（抽样，3 行以内视作无需校验） */
function sortVerified(ws, dataAddr, keyCol, order) {
  const parsed = parseA1(dataAddr)
  if (!parsed || parsed.r2 - parsed.r1 < 2) return true
  const sample = Math.min(parsed.r2 - parsed.r1 + 1, 200)
  const keyRng = ws.Range(rangeAddr(keyCol, parsed.r1, keyCol, parsed.r1 + sample - 1))
  const read = readRangeValues(ws, keyRng)
  const flat = read.values.flat()
  const nums = flat.map((v) => {
    const n = Number(v)
    return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null
  })
  const usable = nums.filter((n) => n !== null)
  if (usable.length < 2) return true // 非数值列无法校验，视作成功
  for (let i = 1; i < usable.length; i++) {
    if (order === 1 ? usable[i] < usable[i - 1] : usable[i] > usable[i - 1]) return false
  }
  return true
}

function handleAutoFilter(params) {
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const rng = resolveRange(ws, params.range)
  const field = Number(params.field) || 0
  const criteria = params.criteria !== undefined && params.criteria !== null ? String(params.criteria) : null
  const app = getApp()
  let ok = true
  withAlertsOff(app, () => {
    try {
      if (field >= 1 && criteria !== null) rng.AutoFilter(field, criteria)
      else if (field >= 1) rng.AutoFilter(field)
      else rng.AutoFilter()
    } catch (e) {
      ok = false
      throw e
    }
  })
  return { ok, sheet: safeGet(() => ws.Name), range: readAddress(rng), field: field || null, criteria }
}

function handleFormat(params) {
  const style = params.style && typeof params.style === 'object' ? params.style : params
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const rng = resolveRange(ws, params.range)
  const applied = []
  const app = getApp()
  withScreenUpdating(app, () => {
    if (style.bold !== undefined) { rng.Font.Bold = !!style.bold; applied.push('bold') }
    if (style.italic !== undefined) { rng.Font.Italic = !!style.italic; applied.push('italic') }
    if (style.underline !== undefined) { rng.Font.Underline = style.underline ? 2 : -4142; applied.push('underline') }
    if (style.fontSize !== undefined) { rng.Font.Size = Number(style.fontSize); applied.push('fontSize') }
    if (style.fontName) { rng.Font.Name = String(style.fontName); applied.push('fontName') }
    if (style.fontColor !== undefined) {
      const bgr = colorToBgr(style.fontColor)
      if (bgr === null) throw hostError('INVALID_PARAMS', `fontColor 非法：${style.fontColor}（示例 #FF0000）`)
      rng.Font.Color = bgr
      applied.push('fontColor')
    }
    if (style.bgColor !== undefined) {
      const bgr = colorToBgr(style.bgColor)
      if (bgr === null) throw hostError('INVALID_PARAMS', `bgColor 非法：${style.bgColor}（示例 #FFFF00）`)
      rng.Interior.Color = bgr
      applied.push('bgColor')
    }
    if (style.numberFormat) { rng.NumberFormat = String(style.numberFormat); applied.push('numberFormat') }
    if (style.align) {
      const v = ALIGN[String(style.align).toLowerCase()]
      if (!v) throw hostError('INVALID_PARAMS', `align 非法：${style.align}（left|center|right）`)
      rng.HorizontalAlignment = v
      applied.push('align')
    }
    if (style.wrapText !== undefined) { rng.WrapText = !!style.wrapText; applied.push('wrapText') }
    if (style.border) {
      if (style.border === 'none') {
        rng.Borders.LineStyle = -4142 // xlNone
      } else {
        rng.Borders.LineStyle = 1 // xlContinuous
        rng.Borders.Weight = 2 // xlThin
      }
      applied.push('border')
    }
    if (style.merge) { rng.Merge(); applied.push('merge') }
    if (style.columnWidth !== undefined) { rng.ColumnWidth = Number(style.columnWidth); applied.push('columnWidth') }
    if (style.rowHeight !== undefined) { rng.RowHeight = Number(style.rowHeight); applied.push('rowHeight') }
  })
  return { ok: true, sheet: safeGet(() => ws.Name), range: readAddress(rng), applied }
}

/** ChartObjects 集合多形态访问（真机实证：属性直取无 Add → 需探测方法/调用形态） */
function getChartObjects(ws) {
  const candidates = []
  try { candidates.push(typeof ws.ChartObjects === 'function' ? ws.ChartObjects() : ws.ChartObjects) } catch { /* ignore */ }
  try { candidates.push(ws.ChartObjects()) } catch { /* ignore */ }
  try { candidates.push(ws.ChartObjects) } catch { /* ignore */ }
  for (const c of candidates) {
    if (c && typeof c.Add === 'function') return c
  }
  return null
}

function handleChartAdd(params) {
  const dataRange = String(params.dataRange || '').trim()
  if (!dataRange) throw hostError('INVALID_PARAMS', 'dataRange 必填（A1 记法，如 A1:C10）')
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const source = ws.Range(dataRange)
  if (!source) throw hostError('INVALID_RANGE', `找不到区域：${dataRange}`)
  const typeKey = String(params.type || 'column')
  const chartType = CHART_TYPES[typeKey] !== undefined ? CHART_TYPES[typeKey] : 51
  const app = getApp()
  let created = null
  withScreenUpdating(app, () => {
    const cos = getChartObjects(ws)
    if (cos) {
      const co = cos.Add(Number(params.left) || 320, Number(params.top) || 30, Number(params.width) || 480, Number(params.height) || 300)
      const chart = co.Chart
      chart.SetSourceData(source)
      chart.ChartType = chartType
      const title = String(params.title || '').trim()
      if (title) {
        chart.HasTitle = true
        chart.ChartTitle.Text = title
      }
      created = co
      return
    }
    // 兜底：Shapes.AddChart2（新版宿主形态）
    const shapes = ws.Shapes
    if (shapes && typeof shapes.AddChart2 === 'function') {
      const style = -1
      const shape = shapes.AddChart2(style, chartType, Number(params.left) || 320, Number(params.top) || 30, Number(params.width) || 480, Number(params.height) || 300)
      try { shape.Chart.SetSourceData(source) } catch { /* ignore */ }
      const title = String(params.title || '').trim()
      if (title) {
        try {
          shape.Chart.HasTitle = true
          shape.Chart.ChartTitle.Text = title
        } catch { /* ignore */ }
      }
      created = shape
      return
    }
    throw hostError('CHART_UNSUPPORTED', '当前宿主既不支持 ChartObjects.Add 也不支持 Shapes.AddChart2')
  })
  if (!created) throw hostError('CHART_ADD_FAILED', '图表创建失败')
  const cos2 = getChartObjects(ws)
  return {
    ok: true,
    sheet: safeGet(() => ws.Name),
    chartIndex: Number(safeGet(() => cos2?.Count, 1)) || 1,
    name: safeGet(() => created.Name),
    type: typeKey,
    dataRange
  }
}

function handleChartList(params) {
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const cos = getChartObjects(ws)
  const count = Number(safeGet(() => cos?.Count, 0))
  const charts = []
  for (let i = 1; i <= count; i++) {
    const co = cos.Item(i)
    charts.push({
      index: i,
      name: safeGet(() => co.Name),
      chartType: safeGet(() => co.Chart?.ChartType, null),
      hasTitle: !!safeGet(() => co.Chart?.HasTitle, false),
      topLeftCell: readAddress(safeGet(() => co.TopLeftCell, null))
    })
  }
  return { ok: true, sheet: safeGet(() => ws.Name), count, charts }
}

function handleChartExport(params) {
  const path = requirePath(params)
  const wb = getActiveWorkbook()
  const ws = resolveSheet(wb, params.sheet)
  const cos = getChartObjects(ws)
  const co = cos?.Item(Number(params.index) || 1)
  if (!co) throw hostError('CHART_NOT_FOUND', `找不到图表索引 ${params.index || 1}（先用 chart_list 查看）`)
  co.Chart.Export(path, 'PNG')
  return { ok: true, path, format: 'png' }
}


/** 导出候选路径：请求路径 → ~/Desktop/同名 → ~/(主目录根)。真机实证 WPS 沙盒
 *  禁写 /tmp 等系统目录但允许用户目录；Env.GetHomePath 为官方 Env 方法。 */
function exportPathCandidates(app, path) {
  const list = [path]
  const home = safeGet(() => app?.Env?.GetHomePath?.(), '')
  if (home) {
    const base = String(path).split('/').pop() || `export-${Date.now()}`
    if (!`${home}/Desktop/${base}`.match(new RegExp(`^${escapeRegExp(path)}$`))) list.push(`${home}/Desktop/${base}`)
    list.push(`${home}/${base}`)
  }
  return [...new Set(list)]
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function handleExport(params) {
  const path = requirePath(params)
  const format = String(params.format || 'pdf').toLowerCase()
  const app = getApp()
  const wb = getActiveWorkbook()
  const fs = app.FileSystem
  // 真机实证：mac ET 上 ExportAsFixedFormat / WriteFile 可能静默无效——每条
  // 路径都必须 existsSync 验证，失败如实报错（多策略回退），绝不再假 ok。
  const verify = (p) => fileExistsSafe(fs, p) === true

  if (format === 'pdf') {
    // 真机实证：WPS 沙盒禁写 /tmp 等系统目录、允许用户目录——请求路径失败时
    // 自动回退 ~/Desktop/同名文件，并在返回中标明最终路径
    const candidates = exportPathCandidates(app, path)
    const errors = []
    for (const p of candidates) {
      try { wb.ExportAsFixedFormat(0, p) } catch (e) { errors.push(`fixed@${p}: ${e?.message || e}`) }
      if (verify(p)) return { ok: true, format: 'pdf', path: p, requestedPath: path, strategy: 'export_as_fixed_format', workbook: safeGet(() => wb.Name) }
      // 注意：不用 SaveAs 回退——它会弹模态保存对话框，阻塞后续全部 JSAPI（真机实证）
    }
    throw hostError('EXPORT_FAILED', `PDF 导出未生成文件（ExportAsFixedFormat 多路径含桌面回退均已尝试）：${candidates.join('、')}。${errors.slice(0, 2).join('；')}`)
  }
  if (format === 'csv') {
    // 序列化已用区域 → FileSystem.WriteFile 落盘；失败时返回内联内容（MCP 消费方可自行保存）
    const ws = resolveSheet(wb, params.sheet)
    const read = readRangeValues(ws, ws.UsedRange)
    const csv = read.values.map((row) => row.map(csvEscape).join(',')).join('\r\n')
    let written = false
    let writtenPath = ''
    let writeError = ''
    for (const p of exportPathCandidates(app, path)) {
      try {
        if (fs && typeof fs.WriteFile === 'function') {
          const ret = fs.WriteFile(p, `\ufeff${csv}`)
          const okNow = ret === undefined ? verify(p) : ret === true && verify(p)
          if (okNow) { written = true; writtenPath = p; break }
          if (ret === false) writeError = 'WriteFile 返回 false'
        } else {
          writeError = '宿主未提供 FileSystem.WriteFile'
          break
        }
      } catch (e) {
        writeError = e?.message || String(e)
      }
    }
    if (written) {
      return {
        ok: true,
        format: 'csv',
        path: writtenPath,
        requestedPath: writtenPath === path ? undefined : path,
        sheet: safeGet(() => ws.Name),
        rows: read.rows,
        cols: read.cols,
        truncated: read.truncated
      }
    }
    if (read.rows * read.cols <= MAX_INLINE_CSV_CELLS) {
      return {
        ok: true,
        format: 'csv-inline',
        path,
        written: false,
        writeError,
        sheet: safeGet(() => ws.Name),
        rows: read.rows,
        cols: read.cols,
        content: csv,
        note: `文件未落盘（${writeError || '沙盒限制'}）。以下为完整 CSV 内容（UTF-8，无 BOM），可直接保存为文件。`
      }
    }
    throw hostError('EXPORT_FAILED', `CSV 写盘失败（${writeError || '沙盒限制'}）且数据 ${read.rows}×${read.cols} 超出内联返回上限，请改用用户目录路径重试。`)
  }
  throw hostError('INVALID_PARAMS', `不支持的导出格式：${format}（支持 pdf|csv）`)
}

/* --------------------------- 入口 --------------------------- */

const READ_HANDLERS = {
  status: handleStatus,
  sheet_list: handleSheetList,
  used_range: handleUsedRange,
  range_read: handleRangeRead,
  find: handleFind,
  chart_list: handleChartList
}

const WRITE_HANDLERS = {
  sheet_add: handleSheetAdd,
  sheet_rename: handleSheetRename,
  sheet_delete: handleSheetDelete,
  range_write: handleRangeWrite,
  find_replace: handleFindReplace,
  row_insert: handleRowInsert,
  row_delete: handleRowDelete,
  column_insert: handleColumnInsert,
  column_delete: handleColumnDelete,
  sort: handleSort,
  autofilter: handleAutoFilter,
  format: handleFormat,
  chart_add: handleChartAdd,
  chart_export: handleChartExport,
  export: handleExport
}

/**
 * @param {string} action 'spreadsheet.' 后缀
 * @param {object} params
 */
export async function handleSpreadsheetAction(action, params = {}) {
  requireHost('et')
  const read = READ_HANDLERS[action]
  if (read) return read(params)
  const write = WRITE_HANDLERS[action]
  if (write) {
    if (params.confirmed !== true) {
      // 与 Writer 写工具同协议：未确认先回预览信封
      return {
        preview: true,
        action,
        params,
        note: '这是写操作预览。确认执行请在调用中带 confirmed: true。'
      }
    }
    return write(params)
  }
  throw hostError('METHOD_NOT_FOUND', `未知 spreadsheet action：${action}（可用：${Object.keys(READ_HANDLERS).concat(Object.keys(WRITE_HANDLERS)).join('|')}）`)
}

export default { handleSpreadsheetAction, SPREADSHEET_WRITE_ACTIONS }
