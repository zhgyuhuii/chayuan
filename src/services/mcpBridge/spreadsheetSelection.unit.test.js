/**
 * spreadsheetSelection 回归锁定（2026-11-25 selection_read 新增）：选区读取
 * 规划是纯函数——整列地址（"C:C" 无行号）、UsedRange 交集治理、限行截断、
 * 跨区域预算都在这里。本文件在无 window 的纯 node 环境跑，任何规划回归
 * （如交集算错把整列灌进响应）都在这里现形，不再漏到真机。
 */
import { describe, it, expect } from 'vitest'
import {
  parseA1Loose,
  intersectA1Rects,
  rectCells,
  planSelectionRead,
  MAX_ET_ROW,
  SELECTION_DIRECT_READ_CELLS,
  SELECTION_EMPTY_CAP_ROWS
} from './spreadsheetSelection.js'

describe('parseA1Loose', () => {
  it('普通 A1/区域地址与 parseA1 一致', () => {
    expect(parseA1Loose('A1')).toEqual({ r1: 1, c1: 1, r2: 1, c2: 1 })
    expect(parseA1Loose('$A$1:$C$5')).toEqual({ r1: 1, c1: 1, r2: 5, c2: 3 })
    expect(parseA1Loose('C5:A1')).toEqual({ r1: 1, c1: 1, r2: 5, c2: 3 })
  })

  it('整列地址（Selection 对整列返回 C:C 不带行号）→ 全行矩形', () => {
    expect(parseA1Loose('$C:$C')).toEqual({ r1: 1, c1: 3, r2: MAX_ET_ROW, c2: 3 })
    expect(parseA1Loose('A:C')).toEqual({ r1: 1, c1: 1, r2: MAX_ET_ROW, c2: 3 })
  })

  it('整行地址 → 全列矩形', () => {
    expect(parseA1Loose('$3:$5')).toEqual({ r1: 3, c1: 1, r2: 5, c2: 16384 })
  })

  it('多区域逗号地址/垃圾串 → null（调用方逐 area 处理，不在这层拆）', () => {
    expect(parseA1Loose('$A$1:$B$2,$D$1')).toBe(null)
    expect(parseA1Loose('Sheet1!$A$1:$B$2')).toBe(null)
    expect(parseA1Loose('')).toBe(null)
  })
})

describe('intersectA1Rects', () => {
  it('部分重叠取公共矩形', () => {
    expect(intersectA1Rects({ r1: 1, c1: 1, r2: 10, c2: 3 }, { r1: 5, c1: 2, r2: 20, c2: 5 }))
      .toEqual({ r1: 5, c1: 2, r2: 10, c2: 3 })
  })

  it('包含与相等', () => {
    expect(intersectA1Rects({ r1: 1, c1: 1, r2: 9, c2: 9 }, { r1: 3, c1: 3, r2: 4, c2: 4 }))
      .toEqual({ r1: 3, c1: 3, r2: 4, c2: 4 })
  })

  it('不相交返回 null（行不相交/列不相交两个方向）', () => {
    expect(intersectA1Rects({ r1: 1, c1: 1, r2: 5, c2: 3 }, { r1: 6, c1: 1, r2: 9, c2: 3 })).toBe(null)
    expect(intersectA1Rects({ r1: 1, c1: 1, r2: 5, c2: 3 }, { r1: 1, c1: 4, r2: 5, c2: 6 })).toBe(null)
  })

  it('支持字符串地址入参（内部 parseA1Loose，整列可用）', () => {
    expect(intersectA1Rects('$C:$C', { r1: 2, c1: 2, r2: 4, c2: 4 })).toEqual({ r1: 2, c1: 3, r2: 4, c2: 3 })
  })

  it('非法入参返回 null', () => {
    expect(intersectA1Rects(null, { r1: 1, c1: 1, r2: 2, c2: 2 })).toBe(null)
    expect(intersectA1Rects('垃圾', { r1: 1, c1: 1, r2: 2, c2: 2 })).toBe(null)
  })
})

describe('rectCells', () => {
  it('矩形格数', () => {
    expect(rectCells({ r1: 1, c1: 1, r2: 3, c2: 4 })).toBe(12)
    expect(rectCells(null)).toBe(0)
  })
})

describe('planSelectionRead', () => {
  const used = { r1: 1, c1: 1, r2: 100, c2: 8 }

  it('小选区原样读取', () => {
    const plan = planSelectionRead({ r1: 2, c1: 2, r2: 10, c2: 4 }, used)
    expect(plan.readRect).toEqual({ r1: 2, c1: 2, r2: 10, c2: 4 })
    expect(plan.truncated).toBe(false)
    expect(plan.clippedToUsed).toBe(false)
  })

  it('整列选择与 UsedRange 交集 → 只读有数据的行段（不算截断）', () => {
    const plan = planSelectionRead({ r1: 1, c1: 3, r2: MAX_ET_ROW, c2: 3 }, used)
    expect(plan.readRect).toEqual({ r1: 1, c1: 3, r2: 100, c2: 3 })
    expect(plan.clippedToUsed).toBe(true)
    expect(plan.truncated).toBe(false)
  })

  it('选区大于 UsedRange 的包含关系同样裁到交集', () => {
    const plan = planSelectionRead({ r1: 1, c1: 1, r2: 5000, c2: 100 }, used)
    expect(plan.readRect).toEqual(used)
    expect(plan.clippedToUsed).toBe(true)
  })

  it('选区完全在 UsedRange 内 → 不裁剪', () => {
    const plan = planSelectionRead({ r1: 5, c1: 2, r2: 9, c2: 4 }, used)
    expect(plan.clippedToUsed).toBe(false)
    expect(plan.readRect).toEqual({ r1: 5, c1: 2, r2: 9, c2: 4 })
  })

  it('超大且无交集（UsedRange 未知）→ 顶部限行 + truncated', () => {
    const plan = planSelectionRead({ r1: 1, c1: 1, r2: MAX_ET_ROW, c2: 1 }, null)
    expect(plan.readRect.r2).toBe(SELECTION_EMPTY_CAP_ROWS)
    expect(plan.readRect.c2).toBe(1)
    expect(plan.truncated).toBe(true)
    expect(plan.clippedToUsed).toBe(false)
  })

  it('directCap 小于 emptyCapRows 可承载时按 directCap/cols 收窄', () => {
    const plan = planSelectionRead({ r1: 1, c1: 1, r2: MAX_ET_ROW, c2: 1000 }, null, { directCap: 5000 })
    expect(plan.readRect.r2).toBe(5)
    expect(plan.truncated).toBe(true)
  })

  it('budgetRows 跨区域预算截断', () => {
    const plan = planSelectionRead({ r1: 1, c1: 1, r2: 200, c2: 2 }, null, { budgetRows: 50 })
    expect(plan.readRect.r2).toBe(50)
    expect(plan.truncated).toBe(true)
  })

  it('budgetRows 与 UsedRange 交集叠加时取更小者', () => {
    const bigUsed = { r1: 1, c1: 1, r2: 1000, c2: 10 }
    const plan = planSelectionRead({ r1: 1, c1: 1, r2: MAX_ET_ROW, c2: 2 }, bigUsed, { budgetRows: 100 })
    // 先裁到 UsedRange 交集（1000 行），再被 budgetRows 压到 100 行
    expect(plan.readRect.r2).toBe(100)
    expect(plan.truncated).toBe(true)
  })

  it('非法矩形返回 null', () => {
    expect(planSelectionRead(null, used)).toBe(null)
    expect(planSelectionRead({ r1: 5, c1: 1, r2: 2, c2: 3 }, used)).toBe(null)
  })

  it('directCap 默认阈值语义：20 万格以内不触发限行', () => {
    const ok = { r1: 1, c1: 1, r2: 2000, c2: 100 } // 20 万格
    expect(rectCells(ok)).toBe(SELECTION_DIRECT_READ_CELLS)
    const plan = planSelectionRead(ok, null)
    expect(plan.readRect).toEqual(ok)
    expect(plan.truncated).toBe(false)
  })
})
