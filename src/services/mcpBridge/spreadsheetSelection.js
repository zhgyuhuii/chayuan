/**
 * 表格选区读取规划（纯函数，无 window 依赖——纯 node 单测直接覆盖）。
 *
 * handleSelectionRead 的落读策略核心：ET 用户常整行/整列选中（如 C:C，
 * Address 甚至不带行号），直接读会把上百万空格灌进响应；与 UsedRange 求交集，
 * 交集外必是空格，既小又不丢数据。
 */
import { parseA1, letterToCol } from './hostDispatch.js'

/** ET 工作表边界（与 Excel VBA 对象模型一致） */
export const MAX_ET_ROW = 1048576
export const MAX_ET_COL = 16384

/** 超过该格数的选区视为「整行/整列级大选区」，必须做交集/限行治理 */
export const SELECTION_DIRECT_READ_CELLS = 200_000
/** 大选区且与 UsedRange 无交集时，只读顶部这么多行（避免灌空值） */
export const SELECTION_EMPTY_CAP_ROWS = 1000
/** 多区域选区（Ctrl 多选）最多读取的区域数 */
export const MAX_SELECTION_AREAS = 10

/**
 * 宽松 A1 解析：parseA1 之外再支持整列/整行形态——
 * '$C:$C' / 'C:C' → 全列矩形；'$3:$5' / '3:5' → 全行矩形。
 * 非法返回 null。
 */
export function parseA1Loose(addr) {
  const direct = parseA1(addr)
  if (direct) return direct
  const parts = String(addr || '').split(':')
  if (parts.length !== 2) return null
  const p0 = parts[0].trim()
  const p1 = parts[1].trim()
  const colA = /^\$?([A-Za-z]{1,3})\$?$/.exec(p0)
  const colB = /^\$?([A-Za-z]{1,3})\$?$/.exec(p1)
  if (colA && colB) {
    const c1 = letterToCol(colA[1])
    const c2 = letterToCol(colB[1])
    if (c1 && c2) return { r1: 1, c1: Math.min(c1, c2), r2: MAX_ET_ROW, c2: Math.max(c1, c2) }
  }
  const rowA = /^\$?(\d+)\$?$/.exec(p0)
  const rowB = /^\$?(\d+)\$?$/.exec(p1)
  if (rowA && rowB) {
    const r1 = Number(rowA[1])
    const r2 = Number(rowB[1])
    if (r1 && r2) return { r1: Math.min(r1, r2), c1: 1, r2: Math.max(r1, r2), c2: MAX_ET_COL }
  }
  return null
}

/**
 * 两个 A1 矩形求交集；不相交或任一非法返回 null。
 * @param {{r1,c1,r2,c2}|string} a
 * @param {{r1,c1,r2,c2}|string} b
 */
export function intersectA1Rects(a, b) {
  const ra = typeof a === 'string' ? parseA1Loose(a) : a
  const rb = typeof b === 'string' ? parseA1Loose(b) : b
  if (!ra || !rb) return null
  const r1 = Math.max(ra.r1, rb.r1)
  const r2 = Math.min(ra.r2, rb.r2)
  const c1 = Math.max(ra.c1, rb.c1)
  const c2 = Math.min(ra.c2, rb.c2)
  if (r1 > r2 || c1 > c2) return null
  return { r1, c1, r2, c2 }
}

export function rectCells(rect) {
  if (!rect) return 0
  return (rect.r2 - rect.r1 + 1) * (rect.c2 - rect.c1 + 1)
}

/**
 * 单个选区矩形的落读规划（纯函数）：
 * - 与 UsedRange 有交集且交集更小 → 读交集（clippedToUsed；交集外必空，不算截断）
 * - 无交集/交集等大 且选区超大 → 只读顶部 emptyCapRows 行（truncated）
 * - budgetRows 为跨区域共享预算下本区域允许的最大行数，对交集/限行结果二次收口
 * @returns {{readRect:{r1,c1,r2,c2}, truncated:boolean, clippedToUsed:boolean}|null}
 *   null=非法矩形或预算耗尽（budgetRows≤0）
 */
export function planSelectionRead(rect, usedRect, { directCap = SELECTION_DIRECT_READ_CELLS, emptyCapRows = SELECTION_EMPTY_CAP_ROWS, budgetRows = Infinity } = {}) {
  if (!rect || !(rect.r2 >= rect.r1) || !(rect.c2 >= rect.c1)) return null
  const cols = rect.c2 - rect.c1 + 1
  if (budgetRows !== Infinity && budgetRows <= 0) return null
  let target = rect
  let truncated = false
  let clippedToUsed = false
  const cells = rectCells(rect)
  const inter = usedRect ? intersectA1Rects(rect, usedRect) : null
  if (inter && rectCells(inter) < cells) {
    target = inter
    clippedToUsed = true
  } else if (cells > directCap) {
    const capRows = Math.max(1, Math.min(emptyCapRows, Math.floor(directCap / cols)))
    target = { r1: rect.r1, c1: rect.c1, r2: Math.min(rect.r2, rect.r1 + capRows - 1), c2: rect.c2 }
    truncated = target.r2 < rect.r2
  }
  if (budgetRows !== Infinity && target.r2 - target.r1 + 1 > budgetRows) {
    target = { r1: target.r1, c1: target.c1, r2: target.r1 + Math.max(1, budgetRows) - 1, c2: target.c2 }
    truncated = true
  }
  return { readRect: target, truncated, clippedToUsed }
}
