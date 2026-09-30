/**
 * WPS 演示（WPP 宿主）MCP dispatch：presentation.<action> 方法落地层。
 *
 * 对象模型为 PowerPoint VBA 的 JS 镜像（官方 office_v19「演示 API 参考」）：
 * Application → ActivePresentation → Slides → Shapes → TextFrame/TextRange。
 * 集合索引 1-based；颜色为 BGR 整数；AddTextbox/AddPicture/AddTable 单位为磅。
 */
import {
  requireHost,
  getActivePresentation,
  fileExistsSafe,
  colorToBgr,
  withScreenUpdating,
  withAlertsOff,
  safeGet,
  hostError
} from './hostDispatch.js'

/** 写 action 集合（dispatch.js 写锁判定用） */
export const PRESENTATION_WRITE_ACTIONS = new Set([
  'slide_add', 'slide_delete', 'slide_duplicate', 'slide_move', 'slide_layout',
  'text_replace', 'text_set', 'textbox_add', 'picture_add', 'table_add',
  'slideshow_run', 'export', 'slide_export_image',
  'notes_set', 'format_uniform'
])

/** ppLayout 枚举（官方值子集） */
const LAYOUTS = {
  title: 1, text: 2, twoText: 3, table: 4, chart: 8,
  titleOnly: 11, blank: 12
}

function resolveLayout(raw) {
  if (raw === undefined || raw === null || raw === '') return 2 // 默认 ppLayoutText
  const s = String(raw).trim()
  if (/^\d+$/.test(s)) return Number(s)
  return LAYOUTS[s] !== undefined ? LAYOUTS[s] : 2
}

function resolveSlide(pres, index) {
  const slides = pres.Slides
  const n = Number(index)
  const count = Number(safeGet(() => slides.Count, 0))
  const idx = Number.isFinite(n) && n >= 1 ? n : count
  if (idx < 1 || idx > count) {
    throw hostError('SLIDE_NOT_FOUND', `幻灯片序号 ${index} 越界（当前共 ${count} 页，1-based）`)
  }
  const slide = slides.Item(idx)
  if (!slide) throw hostError('SLIDE_NOT_FOUND', `找不到第 ${idx} 页幻灯片`)
  return slide
}

function slideShapeTexts(slide) {
  const shapes = slide.Shapes
  const count = Number(safeGet(() => shapes.Count, 0))
  const out = []
  for (let i = 1; i <= count; i++) {
    const sh = shapes.Item(i)
    const entry = {
      shapeIndex: i,
      name: safeGet(() => sh.Name),
      type: safeGet(() => Number(sh.Type), null)
    }
    try {
      const hasText = Number(sh.HasTextFrame)
      if (hasText !== 0) {
        entry.text = String(sh.TextFrame.TextRange.Text || '')
      }
    } catch { /* ignore */ }
    try {
      if (Number(sh.Type) === 19) { // msoTable
        entry.table = {
          rows: Number(safeGet(() => sh.Table.Rows.Count, 0)),
          cols: Number(safeGet(() => sh.Table.Columns.Count, 0))
        }
      }
    } catch { /* ignore */ }
    out.push(entry)
  }
  return out
}

function slideSummary(pres, i) {
  const slide = pres.Slides.Item(i)
  const shapes = slideShapeTexts(slide)
  const titleShape = shapes.find((s) => s.text && s.shapeIndex === 1) || shapes.find((s) => s.text)
  return {
    index: i,
    layout: safeGet(() => Number(slide.Layout), null),
    shapeCount: shapes.length,
    title: titleShape ? String(titleShape.text).split('\r')[0].slice(0, 80) : '',
    textPreview: shapes
      .map((s) => s.text || '')
      .filter(Boolean)
      .join(' ')
      .slice(0, 200),
    shapes
  }
}

function presentationInfo(pres) {
  return {
    name: safeGet(() => pres.Name),
    fullName: safeGet(() => pres.FullName),
    slideCount: Number(safeGet(() => pres.Slides?.Count, 0)),
    slideWidth: safeGet(() => Number(pres.PageSetup?.SlideWidth), null),
    slideHeight: safeGet(() => Number(pres.PageSetup?.SlideHeight), null)
  }
}

function requirePath(params) {
  const p = String(params.path || '').trim()
  if (!p) throw hostError('INVALID_PARAMS', 'path 必填（本地绝对路径）')
  return p
}

/* --------------------------- handlers --------------------------- */

function handleStatus() {
  const pres = getActivePresentation()
  return { ok: true, host: 'wpp', presentation: presentationInfo(pres) }
}

function handleSlideList() {
  const pres = getActivePresentation()
  const count = Number(safeGet(() => pres.Slides?.Count, 0))
  const slides = []
  for (let i = 1; i <= count; i++) {
    const s = slideSummary(pres, i)
    slides.push({ index: s.index, layout: s.layout, shapeCount: s.shapeCount, title: s.title, textPreview: s.textPreview })
  }
  return { ok: true, count, slides }
}

function handleSlideRead(params) {
  const pres = getActivePresentation()
  const slide = resolveSlide(pres, params.index)
  return { ok: true, slide: slideSummary(pres, Number(safeGet(() => slide.SlideIndex, params.index || 1))) }
}

function handleShapeList(params) {
  const pres = getActivePresentation()
  const slide = resolveSlide(pres, params.index)
  return {
    ok: true,
    index: Number(safeGet(() => slide.SlideIndex, params.index)),
    shapes: slideShapeTexts(slide).map(({ text, ...rest }) => ({ ...rest, text: (text || '').slice(0, 400) }))
  }
}

function handleSlideAdd(params) {
  const pres = getActivePresentation()
  const slides = pres.Slides
  const count = Number(safeGet(() => slides.Count, 0))
  const idx = Math.min(Math.max(Number(params.index) || count + 1, 1), count + 1)
  const layout = resolveLayout(params.layout)
  const slide = withScreenUpdating(window.Application, () => slides.Add(idx, layout))
  if (!slide) throw hostError('SLIDE_ADD_FAILED', 'Slides.Add 未返回新幻灯片')
  const title = String(params.title || '').trim()
  if (title) {
    try {
      const shapes = slide.Shapes
      let done = false
      // 官方占位符判定：先 HasTitle，再按占位符类型兜底（type 14=占位符）
      if (Number(safeGet(() => shapes.HasTitle, 0)) !== 0) {
        shapes.Title.TextFrame.TextRange.Text = title
        done = true
      }
      if (!done) {
        const shapeCount = Number(safeGet(() => shapes.Count, 0))
        for (let i = 1; i <= shapeCount && !done; i++) {
          const sh = shapes.Item(i)
          try {
            if (Number(sh.Type) === 14 && Number(sh.PlaceholderFormat?.Type) !== 0) {
              sh.TextFrame.TextRange.Text = title
              done = true
            }
          } catch { /* ignore */ }
        }
      }
      if (!done) {
        // 无占位符（空白版式）→ 顶部加文本框兜底
        const width = Number(safeGet(() => pres.PageSetup?.SlideWidth, 960))
        const box = shapes.AddTextbox(1, 40, 30, width - 80, 60)
        box.TextFrame.TextRange.Text = title
      }
    } catch { /* 标题写入失败不拖垮建页 */ }
  }
  const content = String(params.content || '').trim()
  if (content) {
    try {
      const shapes = slide.Shapes
      const shapeCount = Number(safeGet(() => shapes.Count, 0))
      let done = false
      for (let i = 1; i <= shapeCount && !done; i++) {
        const sh = shapes.Item(i)
        try {
          if (Number(sh.Type) === 14 && i !== 1) {
            sh.TextFrame.TextRange.Text = content
            done = true
          }
        } catch { /* ignore */ }
      }
      if (!done) {
        const width = Number(safeGet(() => pres.PageSetup?.SlideWidth, 960))
        const height = Number(safeGet(() => pres.PageSetup?.SlideHeight, 540))
        const box = shapes.AddTextbox(1, 60, 110, width - 120, height - 160)
        box.TextFrame.TextRange.Text = content
      }
    } catch { /* ignore */ }
  }
  return { ok: true, index: idx, slideCount: Number(safeGet(() => slides.Count, 0)), layout }
}

function handleSlideDelete(params) {
  const pres = getActivePresentation()
  const slide = resolveSlide(pres, params.index)
  const idx = Number(safeGet(() => slide.SlideIndex, params.index))
  withAlertsOff(window.Application, () => slide.Delete())
  return { ok: true, deletedIndex: idx, slideCount: Number(safeGet(() => pres.Slides?.Count, 0)) }
}

function handleSlideDuplicate(params) {
  const pres = getActivePresentation()
  const slide = resolveSlide(pres, params.index)
  const idx = Number(safeGet(() => slide.SlideIndex, params.index))
  withScreenUpdating(window.Application, () => slide.Duplicate())
  return { ok: true, sourceIndex: idx, newIndex: idx + 1, slideCount: Number(safeGet(() => pres.Slides?.Count, 0)) }
}

function handleSlideMove(params) {
  const from = Number(params.from)
  const to = Number(params.to)
  if (!from || from < 1) throw hostError('INVALID_PARAMS', 'from 必填（1-based）')
  const pres = getActivePresentation()
  const count = Number(safeGet(() => pres.Slides?.Count, 0))
  if (to < 1 || to > count) throw hostError('INVALID_PARAMS', `to 越界（1-${count}）`)
  const slide = resolveSlide(pres, from)
  withScreenUpdating(window.Application, () => slide.MoveTo(to))
  return { ok: true, from, to, slideCount: count }
}

function handleSlideLayout(params) {
  const layout = resolveLayout(params.layout)
  const pres = getActivePresentation()
  const slide = resolveSlide(pres, params.index)
  withScreenUpdating(window.Application, () => { slide.Layout = layout })
  return { ok: true, index: Number(safeGet(() => slide.SlideIndex, params.index)), layout }
}

function handleTextReplace(params) {
  const find = String(params.find ?? '')
  if (!find) throw hostError('INVALID_PARAMS', 'find 必填')
  const replace = String(params.replace ?? '')
  const pres = getActivePresentation()
  const slide = resolveSlide(pres, params.index)
  let replacedCount = 0
  const touched = []
  withScreenUpdating(window.Application, () => {
    for (const entry of slideShapeTexts(slide)) {
      if (!entry.text || !entry.text.includes(find)) continue
      try {
        const tr = slide.Shapes.Item(entry.shapeIndex).TextFrame.TextRange
        tr.Replace(find, replace)
        replacedCount++
        touched.push(entry.shapeIndex)
      } catch { /* 单形状失败继续 */ }
    }
  })
  return { ok: true, index: Number(safeGet(() => slide.SlideIndex, params.index)), replacedShapes: replacedCount, shapeIndexes: touched }
}

function handleTextSet(params) {
  const text = String(params.text ?? '')
  const pres = getActivePresentation()
  const slide = resolveSlide(pres, params.index)
  const shapeIndex = Number(params.shapeIndex)
  if (!shapeIndex || shapeIndex < 1) {
    throw hostError('INVALID_PARAMS', 'shapeIndex 必填（用 shape_list 或 slide_read 查看）')
  }
  const sh = slide.Shapes.Item(shapeIndex)
  if (!sh) throw hostError('SHAPE_NOT_FOUND', `第 ${params.index} 页找不到形状 ${shapeIndex}`)
  withScreenUpdating(window.Application, () => {
    const tr = sh.TextFrame.TextRange
    if (params.append === true) tr.InsertAfter(text)
    else tr.Text = text
  })
  return { ok: true, index: Number(safeGet(() => slide.SlideIndex, params.index)), shapeIndex, appended: params.append === true }
}

function handleTextboxAdd(params) {
  const text = String(params.text ?? '')
  const pres = getActivePresentation()
  const slide = resolveSlide(pres, params.index)
  const width = Number(safeGet(() => pres.PageSetup?.SlideWidth, 960))
  const left = Number(params.left ?? 60)
  const top = Number(params.top ?? 60)
  const w = Number(params.width ?? Math.max(200, width - left * 2))
  const h = Number(params.height ?? 80)
  let shape = null
  withScreenUpdating(window.Application, () => {
    shape = slide.Shapes.AddTextbox(1, left, top, w, h)
    if (!shape) throw hostError('TEXTBOX_ADD_FAILED', 'AddTextbox 未返回形状')
    shape.TextFrame.TextRange.Text = text
    const fontSize = Number(params.fontSize)
    if (fontSize > 0) shape.TextFrame.TextRange.Font.Size = fontSize
    const color = params.color !== undefined ? colorToBgr(params.color) : null
    if (color !== null && color !== undefined) shape.TextFrame.TextRange.Font.Color.RGB = color
  })
  return {
    ok: true,
    index: Number(safeGet(() => slide.SlideIndex, params.index)),
    shapeIndex: Number(safeGet(() => shape && slide.Shapes.Count, 0)) || null,
    left, top, width: w, height: h
  }
}

function handlePictureAdd(params) {
  const path = requirePath(params)
  const pres = getActivePresentation()
  const slide = resolveSlide(pres, params.index)
  const left = Number(params.left ?? 60)
  const top = Number(params.top ?? 60)
  const w = Number(params.width ?? 320)
  const h = Number(params.height ?? 240)
  let shape = null
  withScreenUpdating(window.Application, () => {
    try {
      shape = slide.Shapes.AddPicture(path, false, true, left, top, w, h)
    } catch {
      // 尺寸参数在某些版本下失败 → 不带尺寸重试（按图片原生尺寸插入）
      shape = slide.Shapes.AddPicture(path, false, true, left, top)
    }
  })
  if (!shape) throw hostError('PICTURE_ADD_FAILED', `插入图片失败：${path}（请确认是本地可读路径）`)
  return { ok: true, index: Number(safeGet(() => slide.SlideIndex, params.index)), left, top, width: w, height: h }
}

function handleTableAdd(params) {
  const rows = Number(params.rows)
  const cols = Number(params.cols || params.columns)
  if (!rows || rows < 1 || !cols || cols < 1) throw hostError('INVALID_PARAMS', 'rows/cols 必填（≥1）')
  const pres = getActivePresentation()
  const slide = resolveSlide(pres, params.index)
  const left = Number(params.left ?? 60)
  const top = Number(params.top ?? 120)
  const w = Number(params.width ?? 600)
  const h = Number(params.height ?? Math.min(300, rows * 40))
  let shape = null
  withScreenUpdating(window.Application, () => {
    shape = slide.Shapes.AddTable(rows, cols, left, top, w, h)
    const data = Array.isArray(params.data) ? params.data : []
    const table = shape?.Table
    if (table) {
      const maxCells = rows * cols
      if (data.flat().filter((v) => v !== undefined && v !== null).length > maxCells) {
        // 超量数据直接拒绝，避免半写状态
        throw hostError('INVALID_PARAMS', `data 共 ${data.flat().length} 格超出表格 ${maxCells} 格`)
      }
      for (let r = 1; r <= rows && r <= data.length; r++) {
        const rowData = Array.isArray(data[r - 1]) ? data[r - 1] : []
        for (let c = 1; c <= cols && c <= rowData.length; c++) {
          try {
            table.Cell(r, c).Shape.TextFrame.TextRange.Text = String(rowData[c - 1] ?? '')
          } catch { /* 单格失败继续 */ }
        }
      }
    }
  })
  if (!shape) throw hostError('TABLE_ADD_FAILED', 'AddTable 未返回形状')
  return { ok: true, index: Number(safeGet(() => slide.SlideIndex, params.index)), rows, cols, left, top, width: w, height: h }
}

function handleSlideshowRun() {
  const pres = getActivePresentation()
  const settings = pres.SlideShowSettings
  if (!settings || typeof settings.Run !== 'function') {
    throw hostError('SLIDESHOW_UNSUPPORTED', '当前宿主不支持 SlideShowSettings.Run')
  }
  settings.Run()
  return { ok: true, presentation: safeGet(() => pres.Name) }
}


/** 导出候选路径：请求路径 → ~/Desktop/同名 → ~/(主目录根)。真机实证 WPS 沙盒
 *  禁写 /tmp 等系统目录但允许用户目录；Env.GetHomePath 为官方 Env 方法。 */
function exportPathCandidates(app, path) {
  const list = [path]
  const home = safeGet(() => app?.Env?.GetHomePath?.(), '')
  if (home) {
    const base = String(path).split('/').pop() || `export-${Date.now()}`
    const desktop = `${home}/Desktop/${base}`
    if (desktop !== path) list.push(desktop)
    list.push(`${home}/${base}`)
  }
  return [...new Set(list)]
}

function handleExport(params) {
  const path = requirePath(params)
  const format = String(params.format || 'pdf').toLowerCase()
  const pres = getActivePresentation()
  const app = window.Application
  const fs = app?.FileSystem
  // 与表格侧同一纪律：mac 真机上导出可能静默无效，每条路径必须 existsSync 验证
  const verify = (p) => fileExistsSafe(fs, p) === true

  if (format === 'pdf') {
    // ExportAsFixedFormat(Path, ppFixedFormatTypePDF=2)；不用 SaveAs 回退——
    // 模态保存对话框会阻塞全部 JSAPI（真机实证）。路径失败时回退用户目录。
    const candidates = exportPathCandidates(app, path)
    const errors = []
    for (const p of candidates) {
      try { pres.ExportAsFixedFormat(p, 2) } catch (e) { errors.push(`fixed@${p}: ${e?.message || e}`) }
      if (verify(p)) return { ok: true, format: 'pdf', path: p, requestedPath: path, strategy: 'export_as_fixed_format', presentation: safeGet(() => pres.Name) }
    }
    throw hostError('EXPORT_FAILED', `PDF 导出未生成文件（ExportAsFixedFormat 多路径含桌面回退均已尝试）：${candidates.join('、')}。${errors.slice(0, 2).join('；')}`)
  }
  if (format === 'images') {
    // Presentation.Export(文件夹, 筛选器, 宽, 高)：逐页导出图片
    try { pres.Export(path, 'PNG', Number(params.width) || 1280, Number(params.height) || 720) } catch (e) {
      throw hostError('EXPORT_FAILED', `图片导出失败：${e?.message || e}`)
    }
    if (verify(path)) return { ok: true, format: 'png', folder: path, presentation: safeGet(() => pres.Name) }
    throw hostError('EXPORT_FAILED', `图片导出未生成目录：${path}（沙盒可能禁止写入，请改用用户目录）。`)
  }
  throw hostError('INVALID_PARAMS', `不支持的导出格式：${format}（支持 pdf|images）`)
}

function handleSlideExportImage(params) {
  const path = requirePath(params)
  const pres = getActivePresentation()
  const slide = resolveSlide(pres, params.index)
  slide.Export(path, 'PNG', Number(params.width) || 1280, Number(params.height) || 720)
  return { ok: true, path, index: Number(safeGet(() => slide.SlideIndex, params.index)) }
}

/**
 * 写演讲者备注（口播稿）。params:
 *   notes: [{ slide: 页码, text: 备注文本 }]，或 { slide, text } 单页形式
 * 备注页占位符探测顺序：Placeholders(2)（ppPlaceholderBody）→ 逐 shape 找
 * 带 TextFrame 的 body 占位符（type 2）→ 名称含 "Notes" 的形状。
 */
function setSlideNotes(slide, text) {
  const payload = String(text ?? '')
  const notesPage = slide.NotesPage
  try {
    const ph = notesPage.Placeholders?.Item?.(2)
    if (ph?.TextFrame) {
      ph.TextFrame.TextRange.Text = payload
      return true
    }
  } catch { /* 走逐形状兜底 */ }
  const shapes = notesPage.Shapes
  const count = Number(safeGet(() => shapes.Count, 0))
  for (let i = 1; i <= count; i++) {
    const sh = shapes.Item(i)
    try {
      const type = Number(safeGet(() => sh.PlaceholderFormat?.Type, -1))
      if (type === 2 && sh.TextFrame) {
        sh.TextFrame.TextRange.Text = payload
        return true
      }
    } catch { /* ignore */ }
  }
  for (let i = 1; i <= count; i++) {
    const sh = shapes.Item(i)
    try {
      if (/notes/i.test(String(safeGet(() => sh.Name, ''))) && sh.TextFrame) {
        sh.TextFrame.TextRange.Text = payload
        return true
      }
    } catch { /* ignore */ }
  }
  return false
}

function handleNotesSet(params) {
  const pres = getActivePresentation()
  const app = window.Application
  let items = Array.isArray(params.notes) ? params.notes : null
  if (!items && (params.slide !== undefined || params.text !== undefined)) {
    items = [{ slide: params.slide, text: params.text }]
  }
  if (!items || !items.length) throw hostError('INVALID_PARAMS', 'notes_set 需要 notes 数组（[{slide, text}]）或 slide+text')
  let written = 0
  const failed = []
  withScreenUpdating(app, () => {
    for (const item of items) {
      const idx = Number(item?.slide) || 0
      if (!idx) { failed.push({ slide: item?.slide ?? null, reason: '缺少页码' }); continue }
      let slide
      try { slide = resolveSlide(pres, idx) } catch (e) { failed.push({ slide: idx, reason: String(e?.message || e) }); continue }
      if (setSlideNotes(slide, item?.text ?? '')) written += 1
      else failed.push({ slide: idx, reason: '未找到备注占位符' })
    }
  })
  return { ok: failed.length === 0, written, failed, total: items.length, presentation: safeGet(() => pres.Name) }
}

/**
 * 全套统一排版（美化）。params: { fontName?, titleSize?, bodySize?, color? }
 * 逐页逐形状：有 TextFrame 的形状按占位符角色套标题/正文规格；表格跳过。
 */
function handleFormatUniform(params) {
  const pres = getActivePresentation()
  const app = window.Application
  const fontName = String(params.fontName || '').trim()
  const titleSize = Number(params.titleSize) || 0
  const bodySize = Number(params.bodySize) || 0
  const color = params.color !== undefined && params.color !== null ? colorToBgr(params.color) : null
  if (!fontName && !titleSize && !bodySize && color === null) {
    throw hostError('INVALID_PARAMS', 'format_uniform 至少提供 fontName / titleSize / bodySize / color 之一')
  }
  const slides = pres.Slides
  const slideCount = Number(safeGet(() => slides.Count, 0))
  let touchedShapes = 0
  let touchedSlides = 0
  withScreenUpdating(app, () => {
    for (let s = 1; s <= slideCount; s++) {
      const slide = slides.Item(s)
      const shapes = slide.Shapes
      const shapeCount = Number(safeGet(() => shapes.Count, 0))
      let slideTouched = false
      for (let i = 1; i <= shapeCount; i++) {
        const sh = shapes.Item(i)
        try {
          if (Number(safeGet(() => sh.HasTextFrame, 0)) === 0) continue
          const textFrame = sh.TextFrame
          if (!textFrame) continue
          const isTitle = i === 1 || Number(safeGet(() => sh.PlaceholderFormat?.Type, -1)) === 13 || /title/i.test(String(safeGet(() => sh.Name, '')))
          const range = textFrame.TextRange
          if (fontName) range.Font.Name = fontName
          if (isTitle && titleSize) range.Font.Size = titleSize
          if (!isTitle && bodySize) range.Font.Size = bodySize
          if (color !== null) range.Font.Color = color
          touchedShapes += 1
          slideTouched = true
        } catch { /* 单形状失败不连累整页 */ }
      }
      if (slideTouched) touchedSlides += 1
    }
  })
  return {
    ok: true, slides: slideCount, touchedSlides, touchedShapes,
    applied: { fontName: fontName || null, titleSize: titleSize || null, bodySize: bodySize || null, color: params.color || null },
    presentation: safeGet(() => pres.Name)
  }
}

/* --------------------------- 入口 --------------------------- */

const READ_HANDLERS = {
  status: handleStatus,
  slide_list: handleSlideList,
  slide_read: handleSlideRead,
  shape_list: handleShapeList
}

const WRITE_HANDLERS = {
  slide_add: handleSlideAdd,
  slide_delete: handleSlideDelete,
  slide_duplicate: handleSlideDuplicate,
  slide_move: handleSlideMove,
  slide_layout: handleSlideLayout,
  text_replace: handleTextReplace,
  text_set: handleTextSet,
  textbox_add: handleTextboxAdd,
  picture_add: handlePictureAdd,
  table_add: handleTableAdd,
  slideshow_run: handleSlideshowRun,
  export: handleExport,
  slide_export_image: handleSlideExportImage,
  notes_set: handleNotesSet,
  format_uniform: handleFormatUniform
}

/**
 * @param {string} action 'presentation.' 后缀
 * @param {object} params
 */
export async function handlePresentationAction(action, params = {}) {
  requireHost('wpp')
  const read = READ_HANDLERS[action]
  if (read) return read(params)
  const write = WRITE_HANDLERS[action]
  if (write) {
    if (params.confirmed !== true) {
      return {
        preview: true,
        action,
        params,
        note: '这是写操作预览。确认执行请在调用中带 confirmed: true。'
      }
    }
    return write(params)
  }
  throw hostError('METHOD_NOT_FOUND', `未知 presentation action：${action}（可用：${Object.keys(READ_HANDLERS).concat(Object.keys(WRITE_HANDLERS)).join('|')}）`)
}

export default { handlePresentationAction, PRESENTATION_WRITE_ACTIONS }
