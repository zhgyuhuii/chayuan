// 通用网格写回：建一张 N 列表格，每格插一张图 + 可选编号文字。
// 条码 / 二维码 / 未来标签工具共用。仅在 WPS 运行（依赖 WPS Tables / InlineShapes API）。
import { insertTableAtPosition } from '../documentInsertActions.js'
import { getActiveDocument, tryAddInlinePicture } from '../documentActions.js'

// items: [{ value, dataUrl, ok }]，只写 ok 的项
// options: { columns:number, caption:boolean }
// 返回 { written:number, rows:number, columns:number }
export function writeGrid(items, options = {}) {
  const valid = (items || []).filter((it) => it && it.ok && it.dataUrl)
  const columns = Math.max(1, Number(options.columns) || 1)
  if (valid.length === 0) return { written: 0, rows: 0, columns }

  const rows = Math.ceil(valid.length / columns)
  insertTableAtPosition({ rows, columns })

  const doc = getActiveDocument()
  const tables = doc?.Tables
  const tableCount = tables?.Count || 0
  if (!tableCount) throw new Error('未能创建表格')
  const table = tables.Item(tableCount) // 最新插入的表

  for (let i = 0; i < valid.length; i += 1) {
    const rowIndex = Math.floor(i / columns) + 1
    const colIndex = (i % columns) + 1
    const cell = table.Rows.Item(rowIndex).Cells.Item(colIndex)
    const cellRange = cell.Range
    // 先插图到单元格起始
    tryAddInlinePicture(valid[i].dataUrl, cellRange)
    // 再在图后追加编号文字（caption 开启时）
    if (options.caption !== false) {
      const after = cell.Range
      after.Collapse(0) // wdCollapseEnd
      after.InsertAfter('\n' + String(valid[i].value))
    }
  }
  return { written: valid.length, rows, columns }
}
