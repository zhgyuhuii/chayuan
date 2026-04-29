function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function computeVirtualListRange(options = {}) {
  const total = Math.max(0, Number(options.total || 0))
  const itemHeight = Math.max(1, Number(options.itemHeight || 1))
  const viewportHeight = Math.max(0, Number(options.viewportHeight || 0))
  const scrollTop = Math.max(0, Number(options.scrollTop || 0))
  const overscan = Math.max(0, Number(options.overscan || 3))
  if (total === 0) {
    return {
      start: 0,
      end: 0,
      offsetTop: 0,
      offsetBottom: 0,
      totalHeight: 0,
      visibleCount: 0
    }
  }
  const firstVisible = Math.floor(scrollTop / itemHeight)
  const visibleCount = Math.ceil(viewportHeight / itemHeight)
  const start = clamp(firstVisible - overscan, 0, total)
  const end = clamp(firstVisible + visibleCount + overscan, start, total)
  const totalHeight = total * itemHeight
  return {
    start,
    end,
    offsetTop: start * itemHeight,
    offsetBottom: Math.max(0, totalHeight - end * itemHeight),
    totalHeight,
    visibleCount: Math.max(0, end - start)
  }
}

export function sliceVirtualItems(items = [], range = {}) {
  const start = Math.max(0, Number(range.start || 0))
  const end = Math.max(start, Number(range.end || start))
  return (Array.isArray(items) ? items : []).slice(start, end).map((item, index) => ({
    item,
    index: start + index
  }))
}

export default {
  computeVirtualListRange,
  sliceVirtualItems
}
