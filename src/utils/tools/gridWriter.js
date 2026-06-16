// 通用网格写回：建一张 N 列表格，每格插一张图 + 可选编号文字。
// 条码 / 二维码 / 未来标签工具共用。仅在 WPS 运行（依赖 WPS Tables / InlineShapes API）。
import { insertTableAtPosition } from '../documentInsertActions.js'
import { getActiveDocument, saveGeneratedAssetToFile } from '../documentActions.js'

// 从 dataURL（如 data:image/png;base64,XXXX）取出纯 base64 串；非 base64 dataURL 返回空。
export function dataUrlToBase64(dataUrl) {
  const s = String(dataUrl || '')
  const marker = ';base64,'
  const idx = s.indexOf(marker)
  return idx >= 0 ? s.slice(idx + marker.length) : ''
}

// 单格图片目标宽度（pt）：按页面可用宽度均分到每列，留 10% 内边距，并夹在合理区间。
// 纯函数,便于单测;usableWidthPt<=0 时用 A4 竖排默认可用宽度兜底。
export function cellImageWidthPt(usableWidthPt, columns) {
  const cols = Math.max(1, Number(columns) || 1)
  const usable = Number(usableWidthPt) > 0 ? Number(usableWidthPt) : 440
  const per = (usable / cols) * 0.9
  return Math.max(40, Math.min(per, 240))
}

// 读当前文档页面可用宽度（pt）：PageWidth - 左右页边距;读不到返回 0 交给兜底。
function readUsableWidthPt(doc) {
  try {
    const ps = doc?.PageSetup
    if (!ps) return 0
    const pw = Number(ps.PageWidth) || 0
    const lm = Number(ps.LeftMargin) || 0
    const rm = Number(ps.RightMargin) || 0
    const usable = pw - lm - rm
    return usable > 0 ? usable : 0
  } catch (_) {
    return 0
  }
}

// 把 dataURL 落成临时 png 文件并返回文件路径。
// WPS InlineShapes.AddPicture 只认本地文件路径，不认 base64 dataURL，故必须先落文件。
function materializeImageFile(dataUrl) {
  const base64 = dataUrlToBase64(dataUrl)
  if (!base64) throw new Error('图片数据为空')
  return saveGeneratedAssetToFile({ base64, extension: 'png' }, { prefix: 'chayuan_barcode' })
}

// 把图片插入指定单元格,返回 InlineShape。
// 关键:必须用真实的 cell.Range COM 对象定位。早先的 AddPicture({ Range:{start,end} })
// 传的是普通 JS 对象,WPS 认不了 → 退回当前光标处插入,导致所有图堆进一列且倒序。
function addPictureToCell(doc, cell, filePath) {
  // 主:文档级 InlineShapes.AddPicture 的第 4 个定位参数传真实 cell.Range
  const docInline = doc?.InlineShapes
  if (docInline?.AddPicture) {
    try {
      return docInline.AddPicture(filePath, false, true, cell.Range)
    } catch (_) { /* 落到选区兜底 */ }
  }
  // 兜底:选中单元格,在选区里插入(选区天然定位到该单元格)
  cell.Select?.()
  const sel = doc?.Application?.Selection
  const selInline = sel?.InlineShapes
  if (selInline?.AddPicture) {
    return selInline.AddPicture(filePath, false, true)
  }
  throw new Error('无法向单元格插入图片')
}

// 建一张 ceil(count/columns) 行 × columns 列的表,返回表句柄。两种网格写回共用。
function createGridTable(count, columns) {
  const cols = Math.max(1, Number(columns) || 1)
  const rows = Math.ceil(count / cols)
  const created = insertTableAtPosition({ rows, columns: cols })
  const doc = getActiveDocument()
  let table = created && created.table
  if (!table) {
    // 兜底：旧版 WPS 若 Tables.Add 不返回句柄，退回取末表
    const tables = doc?.Tables
    const tableCount = tables?.Count || 0
    if (!tableCount) throw new Error('未能创建表格')
    table = tables.Item(tableCount)
  }
  if (!table) throw new Error('未能创建表格')
  return { table, rows, columns: cols, doc }
}

// items: [{ value, dataUrl, ok }]，只写 ok 的项
// options: { columns:number, caption:boolean }
// 返回 { written:number, rows:number, columns:number, imageFailures:number }
export function writeGrid(items, options = {}) {
  const valid = (items || []).filter((it) => it && it.ok && it.dataUrl)
  const columns = Math.max(1, Number(options.columns) || 1)
  if (valid.length === 0) return { written: 0, rows: 0, columns, imageFailures: 0 }

  const { table, rows, doc } = createGridTable(valid.length, columns)

  const imageWidthPt = cellImageWidthPt(readUsableWidthPt(doc), columns)

  let imageFailures = 0
  for (let i = 0; i < valid.length; i += 1) {
    const rowIndex = Math.floor(i / columns) + 1
    const colIndex = (i % columns) + 1
    const cell = table.Rows.Item(rowIndex).Cells.Item(colIndex)
    // 先插图到单元格：dataURL 需先落临时文件再按路径插（WPS 不认 base64），并用真实 cell.Range 定位
    try {
      const filePath = materializeImageFile(valid[i].dataUrl)
      const shape = addPictureToCell(doc, cell, filePath)
      // 约束图片宽度,避免条码原始像素过宽撑乱窄格表格;锁纵横比让高度自适应
      try {
        if (shape) {
          shape.LockAspectRatio = true
          shape.Width = imageWidthPt
        }
      } catch (_) { /* 该 WPS 版本不支持设图片尺寸则跳过,保留原始大小 */ }
    } catch (_) {
      // 单格插图失败不拖垮整批：跳过该图，仍写编号文字
      imageFailures += 1
    }
    // 再在图后追加编号文字（caption 开启时）
    if (options.caption !== false) {
      const after = cell.Range
      after.Collapse(0) // wdCollapseEnd
      after.InsertAfter('\n' + String(valid[i].value))
    }
    // 单元格内容居中,图与编号对齐
    try {
      cell.Range.ParagraphFormat.Alignment = 1 // wdAlignParagraphCenter
    } catch (_) { /* 不支持段落对齐则跳过 */ }
  }
  return { written: valid.length, rows, columns, imageFailures }
}

// 把字符串铺进 N 列表格,每格写文本并居中。供流水号等文本类工具复用。
// values: string[]（已是要写入的最终编号）;options: { columns:number }
// 返回 { written:number, rows:number, columns:number }
export function writeTextGrid(values, options = {}) {
  const list = (values || []).filter((v) => v != null && String(v).length > 0).map(String)
  const columns = Math.max(1, Number(options.columns) || 1)
  if (list.length === 0) return { written: 0, rows: 0, columns }

  const { table, rows } = createGridTable(list.length, columns)
  for (let i = 0; i < list.length; i += 1) {
    const rowIndex = Math.floor(i / columns) + 1
    const colIndex = (i % columns) + 1
    const cell = table.Rows.Item(rowIndex).Cells.Item(colIndex)
    try {
      cell.Range.Text = list[i]
    } catch (_) { /* 单格写入失败则跳过 */ }
    try {
      cell.Range.ParagraphFormat.Alignment = 1 // wdAlignParagraphCenter
    } catch (_) { /* 不支持段落对齐则跳过 */ }
  }
  return { written: list.length, rows, columns }
}
