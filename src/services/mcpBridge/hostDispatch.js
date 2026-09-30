/**
 * ET / WPP dispatch 共享工具：活动对象获取、A1 地址换算、颜色换算、批量读写双通道。
 *
 * JSAPI 坑位约定（官方文档 + lc2panda/wps-skills 实战验证）：
 * - Mac JSAPI 不支持 sheet.Cells(row,col)，区域一律用 Range("A1") 记法字符串；
 * - Range.Value2 整块二维数组赋值在部分平台（尤其 mac）可能不支持——所有批量
 *   读写必须双通道：优先整块，失败自动降级分片逐格（ScreenUpdating 关闭）；
 * - 颜色为 BGR 整数（R + G*256 + B*65536），集合索引一律 1-based。
 */
import { detectAddonType, hostLabel } from '../../utils/host/hostType.js'

// 批量读写上限：单次工具调用的单元格数（超过则截断并在结果中标注）
export const MAX_READ_CELLS = 50_000
// 逐格降级通道的硬上限：跨进程同步 IPC，逐格 ~0.2ms/格，5000 格约 1s
export const MAX_FALLBACK_CELLS = 5_000
// find 结果上限
export const MAX_FIND_HITS = 500

export function hostError(code, message) {
  return Object.assign(new Error(message), { code })
}

/** 当前宿主类型守卫：防 job 误路由到错误宿主 webview */
export function requireHost(expected) {
  const actual = detectAddonType()
  if (actual !== expected) {
    throw hostError(
      'HOST_MISMATCH',
      `该方法需要在 WPS ${hostLabel(expected)}宿主中执行，当前宿主为${hostLabel(actual)}。`
    )
  }
}

function getApp() {
  const app = window.Application
  if (!app) throw hostError('HOST_UNAVAILABLE', 'window.Application 不可用（加载项未在 WPS 内运行）')
  return app
}

/** ET 宿主：当前工作簿。 */
export function getActiveWorkbook() {
  const wb = getApp().ActiveWorkbook
  if (!wb) throw hostError('NO_ACTIVE_WORKBOOK', '当前没有打开的工作簿，请在 WPS 表格中打开一个工作簿后重试。')
  return wb
}

/** WPP 宿主：当前演示文稿。 */
export function getActivePresentation() {
  const pres = getApp().ActivePresentation
  if (!pres) throw hostError('NO_ACTIVE_PRESENTATION', '当前没有打开的演示文稿，请在 WPS 演示中打开一个文件后重试。')
  return pres
}

/** 任意宿主：活动对象身份（工作簿/演示文稿/文档 FullName），写前身份校验用 */
export function getHostActiveObjectId() {
  const app = (() => { try { return window.Application } catch { return null } })() || null
  const probe = (get) => {
    try {
      const obj = get()
      if (obj) return String(obj.FullName || obj.Name || '')
    } catch { /* ignore */ }
    return ''
  }
  return probe(() => app?.ActiveDocument) || probe(() => app?.ActiveWorkbook) || probe(() => app?.ActivePresentation)
}

/* ------------------------- A1 地址工具 ------------------------- */

export function colToLetter(col) {
  let n = Math.floor(Number(col) || 1)
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s || 'A'
}

export function letterToCol(str) {
  let n = 0
  const s = String(str || '').toUpperCase()
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch < 'A' || ch > 'Z') return NaN
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n
}

function partToRC(part) {
  const m = String(part || '').replace(/\$/g, '').match(/^([A-Za-z]+)(\d+)$/)
  if (!m) return null
  const c = letterToCol(m[1])
  const r = Number(m[2])
  if (!c || !r) return null
  return { c, r }
}

/** 'A1' | 'A1:C10' | '$A$1:$C$10' → { r1, c1, r2, c2 }；非法返回 null */
export function parseA1(addr) {
  const parts = String(addr || '').split(':')
  const a = partToRC(parts[0])
  if (!a) return null
  if (parts.length === 1) return { r1: a.r, c1: a.c, r2: a.r, c2: a.c }
  if (parts.length !== 2) return null
  const b = partToRC(parts[1])
  if (!b) return null
  return {
    r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c),
    r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c)
  }
}

export function a1(col, row) {
  return `${colToLetter(col)}${row}`
}

export function rangeAddr(c1, r1, c2, r2) {
  return c1 === c2 && r1 === r2 ? a1(c1, r1) : `${a1(c1, r1)}:${a1(c2, r2)}`
}

/* ------------------------- 颜色 / 枚举 ------------------------- */

/** '#RRGGBB' | 'RRGGBB' | BGR 整数 → BGR 整数；无法解析返回 null */
export function colorToBgr(input) {
  const s = String(input ?? '').trim()
  if (/^-?\d+$/.test(s)) return Number(s)
  const m = s.match(/^#?([0-9a-fA-F]{6})$/)
  if (!m) return null
  const r = parseInt(m[1].slice(0, 2), 16)
  const g = parseInt(m[1].slice(2, 4), 16)
  const b = parseInt(m[1].slice(4, 6), 16)
  return r + g * 256 + b * 65536
}

/**
 * 读地址（官方 office_v19：Range.Address 在 JSAPI 是方法不是属性，直接取属性
 * 返回函数对象；为兼容部分版本按方法→属性双通道探测）。
 */
export function readAddress(obj) {
  if (!obj) return ''
  try {
    const a = obj.Address()
    if (typeof a === 'string') return a
  } catch { /* ignore */ }
  try {
    const a = obj.Address
    if (typeof a === 'string') return a
  } catch { /* ignore */ }
  return ''
}

/**
 * 整块 Value2 读取结果归一化：官方未承诺返回形态——可能是纯 JS 二维数组、
 * 一维数组、标量，或带 Item(r,c) 的二维包装对象（社区实测主形态）。统一成
 * 纯二维数组（0-based 外层数组，值原样）。
 */
export function normalizeMatrixFromRead(v, rows, cols) {
  if (Array.isArray(v) && Array.isArray(v[0])) return v
  if (Array.isArray(v)) return [v]
  if (v && typeof v.Item === 'function') {
    const out = []
    for (let r = 1; r <= rows; r++) {
      const rowVals = []
      for (let c = 1; c <= cols; c++) {
        try { rowVals.push(v.Item(r, c)) } catch { rowVals.push(null) }
      }
      out.push(rowVals)
    }
    return out
  }
  return [[v]]
}

/* ------------------------- 工作表 / 区域解析 ------------------------- */

/** 按 1-based 索引或名称解析工作表；缺省回活动表 */
export function resolveSheet(wb, sheet) {
  const sheets = wb.Worksheets
  if (sheet === undefined || sheet === null || sheet === '') {
    const active = wb.ActiveSheet
    if (!active) throw hostError('NO_ACTIVE_SHEET', '没有活动工作表。')
    return active
  }
  const byIndex = typeof sheet === 'number' || /^\d+$/.test(String(sheet).trim())
  const target = byIndex ? sheets.Item(Number(sheet)) : sheets.Item(String(sheet).trim())
  if (!target) throw hostError('SHEET_NOT_FOUND', `找不到工作表：${sheet}`)
  return target
}

/** 在指定表上解析区域：params.range（A1 记法）缺省回 UsedRange */
export function resolveRange(ws, range) {
  if (range === undefined || range === null || String(range).trim() === '') {
    const used = ws.UsedRange
    if (!used) throw hostError('EMPTY_SHEET', '工作表为空（无已用区域）。')
    return used
  }
  const parsed = parseA1(range)
  if (!parsed) throw hostError('INVALID_RANGE', `非法的 A1 区域地址：${range}（示例 A1:C10）`)
  return ws.Range(rangeAddr(parsed.c1, parsed.r1, parsed.c2, parsed.r2))
}

/* ------------------------- 批量读写双通道 ------------------------- */

/**
 * 读区域值（双通道）。返回 { values, bulk, truncated, rows, cols, address }。
 * 超过 MAX_READ_CELLS 时按行截断。
 */
export function readRangeValues(ws, rng) {
  let address = ''
  let rows = 0
  let cols = 0
  address = readAddress(rng)
  try { rows = Number(rng.Rows?.Count || 0) } catch { /* ignore */ }
  try { cols = Number(rng.Columns?.Count || 0) } catch { /* ignore */ }

  const parsed = parseA1(address)
  const r1 = parsed ? parsed.r1 : 1
  const c1 = parsed ? parsed.c1 : 1
  const maxRows = MAX_READ_CELLS > 0 && cols > 0 ? Math.max(1, Math.floor(MAX_READ_CELLS / cols)) : rows
  const truncated = rows > maxRows
  const readRows = Math.min(rows, maxRows)

  // 单格 / 小区域优先整块 Value2（读取结果形态由 normalizeMatrixFromRead 兜底）
  if (readRows >= 1 && cols >= 1) {
    try {
      const target = truncated
        ? ws.Range(rangeAddr(c1, r1, c1 + cols - 1, r1 + readRows - 1))
        : rng
      const v = target.Value2
      return {
        values: normalizeMatrixFromRead(v, readRows, cols),
        bulk: true,
        truncated,
        rows: readRows,
        cols,
        address
      }
    } catch { /* 整块读取不支持 → 逐格降级 */ }
  }

  if (readRows * cols > MAX_FALLBACK_CELLS) {
    throw hostError(
      'RANGE_TOO_LARGE',
      `区域 ${address} 共 ${readRows}×${cols} 格，超出逐格降级上限（${MAX_FALLBACK_CELLS}）且整块读取不可用。请缩小范围分批读取。`
    )
  }
  const out = []
  for (let r = 0; r < readRows; r++) {
    const rowVals = []
    for (let c = 0; c < cols; c++) {
      try {
        rowVals.push(ws.Range(a1(c1 + c, r1 + r)).Value2)
      } catch (e) {
        rowVals.push(null)
      }
    }
    out.push(rowVals)
  }
  return { values: out, bulk: false, truncated, rows: readRows, cols, address }
}

/**
 * 写区域值（双通道）。values 为二维数组；含 "=" 的字符串自动走 Formula 通道
 * （或显式 asFormula=true）。返回 { written, bulk, address }。
 */
export function writeRangeValues(ws, startAddr, values, { asFormula = false } = {}) {
  if (!Array.isArray(values) || !Array.isArray(values[0])) {
    throw hostError('INVALID_PARAMS', 'values 必须是二维数组（例如 [["a","b"],[1,2]]）')
  }
  const start = parseA1(startAddr)
  if (!start) throw hostError('INVALID_RANGE', `非法的起始地址：${startAddr}（示例 A1）`)
  const rows = values.length
  const cols = Math.max(...values.map((r) => (Array.isArray(r) ? r.length : 1)))
  const total = rows * cols
  if (total > MAX_READ_CELLS) {
    throw hostError('RANGE_TOO_LARGE', `单次写入 ${total} 格超出上限（${MAX_READ_CELLS}），请分批写入。`)
  }
  const addr = rangeAddr(start.c1, start.r1, start.c1 + cols - 1, start.r1 + rows - 1)
  const rng = ws.Range(addr)
  // 归一化每行长度
  const matrix = values.map((row) => {
    const r = Array.isArray(row) ? row.slice() : [row]
    while (r.length < cols) r.push(null)
    return r
  })
  const hasFormula = asFormula || matrix.some((row) => row.some((v) => typeof v === 'string' && v.startsWith('=')))

  try {
    if (hasFormula) rng.Formula = matrix
    else rng.Value2 = matrix
    return { written: total, bulk: true, address: addr, rows, cols }
  } catch { /* 整块写入不支持 → 逐格降级 */ }

  if (total > MAX_FALLBACK_CELLS) {
    throw hostError(
      'RANGE_TOO_LARGE',
      `写入 ${total} 格超出逐格降级上限（${MAX_FALLBACK_CELLS}）且整块写入不可用。请分批写入（每批 ≤${MAX_FALLBACK_CELLS} 格）。`
    )
  }
  let written = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      try {
        const cell = ws.Range(a1(start.c1 + c, start.r1 + r))
        const v = matrix[r][c]
        if (hasFormula) cell.Formula = v === null ? '' : v
        else cell.Value2 = v === null ? '' : v
        written++
      } catch { /* 单格失败不中断整批 */ }
    }
  }
  return { written, bulk: false, address: addr, rows, cols }
}

/** 关闭屏幕刷新执行同步 JSAPI 批操作（结束后恢复原值） */
export function withScreenUpdating(app, fn) {
  let prev = null
  try {
    prev = app.ScreenUpdating
    app.ScreenUpdating = false
  } catch { /* ignore */ }
  try {
    return fn()
  } finally {
    try {
      if (prev !== null) app.ScreenUpdating = prev
      else app.ScreenUpdating = true
    } catch { /* ignore */ }
  }
}

/** DisplayAlerts 抑制（删除表等会弹确认框的场景），结束后恢复 */
export function withAlertsOff(app, fn) {
  let prev = null
  try {
    prev = app.DisplayAlerts
    app.DisplayAlerts = false
  } catch { /* ignore */ }
  try {
    return fn()
  } finally {
    try {
      if (prev !== null) app.DisplayAlerts = prev
    } catch { /* ignore */ }
  }
}

/** COM 集合兼容：有的宿主暴露为方法有的为属性 */
export function comCollection(obj) {
  if (!obj) return null
  try {
    return typeof obj === 'function' ? obj() : obj
  } catch {
    return null
  }
}

/** 通用安全读属性 */
export function safeGet(getter, fallback = '') {
  try {
    const v = getter()
    return v === undefined || v === null ? fallback : v
  } catch {
    return fallback
  }
}

/** 宿主文件存在性（FileSystem.existsSync 各版本形态不同：方法/属性、同步返回/包装） */
export function fileExistsSafe(fsApi, path) {
  if (!fsApi || !path) return null
  try {
    if (typeof fsApi.existsSync === 'function') return !!fsApi.existsSync(path)
  } catch { /* ignore */ }
  try {
    if (typeof fsApi.existsSync === 'function') return !!fsApi.existsSync(path)
  } catch { /* ignore */ }
  return null // 无法验证
}
