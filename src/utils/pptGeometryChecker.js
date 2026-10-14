/**
 * PPT 几何校验器（初版）——纯数学检查，输入全部来自 jsapi 纯读接口
 * （presentationDispatch 的 shape_list/slide_read），自身零 API 调用、零崩溃面。
 *
 * 检测项（方案 §3.3）：
 * 1. 形状越界：left/top/width/height 超出页面边界
 * 2. 文本框重叠：两两形状重叠面积占较小形状面积的比例超阈值
 * 阈值保守取值，报告标注置信度，宁报勿漏由质检报告把关。
 */

const OVERLAP_RATIO_THRESHOLD = 0.55

/** 归一化形状矩形：容错各种字段命名（left/l/x、top/t/y、width/w、height/h） */
function normalizeRect(shape) {
  const s = shape && typeof shape === 'object' ? shape : {}
  const left = Number(s.left ?? s.l ?? s.x ?? NaN)
  const top = Number(s.top ?? s.t ?? s.y ?? NaN)
  const width = Number(s.width ?? s.w ?? NaN)
  const height = Number(s.height ?? s.h ?? NaN)
  if (![left, top, width, height].every(Number.isFinite)) return null
  if (width <= 0 || height <= 0) return null
  return { left, top, width, height, name: s.name || s.shapeName || '', index: s.index ?? s.shapeIndex ?? null }
}

function intersectArea(a, b) {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

/**
 * 校验单页几何
 * @param {{page:number, shapes:object[], slideWidth:number, slideHeight:number}} input
 * @returns {{page:number, issues:object[]}}
 */
export function checkSlideGeometry({ page = 0, shapes = [], slideWidth = 0, slideHeight = 0 }) {
  const issues = []
  const rects = (Array.isArray(shapes) ? shapes : [])
    .map((s, i) => ({ ...normalizeRect(s), index: normalizeRect(s)?.index ?? i + 1 }))
    .filter(Boolean)

  const hasPageSize = slideWidth > 0 && slideHeight > 0

  // 1. 越界（容差 2pt：贴边不算）
  if (hasPageSize) {
    const TOL = 2
    for (const r of rects) {
      if (r.left < -TOL || r.top < -TOL || r.left + r.width > slideWidth + TOL || r.top + r.height > slideHeight + TOL) {
        issues.push({
          type: 'out-of-bounds',
          severity: 'high',
          confidence: 'high',
          shapeIndex: r.index,
          shapeName: r.name,
          message: `形状「${r.name || r.index}」超出页面边界（left:${Math.round(r.left)}, top:${Math.round(r.top)}, w:${Math.round(r.width)}, h:${Math.round(r.height)} vs 页面 ${Math.round(slideWidth)}x${Math.round(slideHeight)}）`
        })
      }
    }
  }

  // 2. 重叠（跳过整页背景形状：面积 ≥ 页面 85% 视为背景/底图，不参与两两比对）
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]
      const b = rects[j]
      if (hasPageSize) {
        const areaA = a.width * a.height
        const areaB = b.width * b.height
        const pageArea = slideWidth * slideHeight
        if (areaA >= pageArea * 0.85 || areaB >= pageArea * 0.85) continue
      }
      const inter = intersectArea(a, b)
      if (inter <= 0) continue
      const smaller = Math.min(a.width * a.height, b.width * b.height)
      const ratio = smaller > 0 ? inter / smaller : 0
      if (ratio >= OVERLAP_RATIO_THRESHOLD) {
        issues.push({
          type: 'overlap',
          severity: 'medium',
          confidence: 'medium',
          shapeIndex: a.index,
          shapeName: a.name,
          message: `形状「${a.name || a.index}」与「${b.name || b.index}」大面积重叠（${Math.round(ratio * 100)}%）`
        })
      }
    }
  }

  return { page, issues }
}

/**
 * 批量校验整套 PPT
 * @param {{slideWidth:number, slideHeight:number, pages:Array<{page:number, shapes:object[]}>}} deck
 * @returns {{issues:object[], checkedPages:number}}
 */
export function checkDeckGeometry({ slideWidth = 0, slideHeight = 0, pages = [] }) {
  const issues = []
  for (const p of Array.isArray(pages) ? pages : []) {
    const r = checkSlideGeometry({ page: p.page, shapes: p.shapes, slideWidth, slideHeight })
    issues.push(...r.issues)
  }
  return { issues, checkedPages: (pages || []).length }
}
