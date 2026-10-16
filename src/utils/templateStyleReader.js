/**
 * 模板样式剖析器（纯文件解析，零 jsapi 调用、零崩溃面）。
 *
 * 技术路线（方案 §六「开源收割」）：不引入重型运行时依赖，复用仓库已有的
 * jszip + DOMParser，按 OOXML schema 直接读取——schema 映射知识收割自
 * docx-preview（styles.xml → 字体/字号/行距换算：w:sz 半点→pt、w:spacing
 * line/240→倍数行距）、mammoth（语义结构骨架）、PPTXjs（slide XML shape 树）
 * 与 ExcelJS（xlsx styles 布局）。
 *
 * 用途：生成前的「模板画像」（确认卡/访谈卡的数据源），与打开副本后的
 * jsapi 纯读探测互补——文件级剖析无需打开文档即可给出页数/主题色/结构骨架。
 */

import { normalizeTemplateKind } from './documentTemplates.js'

const MAX_SAMPLE_TEXT_CHARS = 1600
const MAX_SLIDES_ANALYZED = 30

// ── 基础工具 ──

/** 读模板文件字节（路径 → ArrayBuffer；复用 copyFile 的三级回退经验） */
export function readTemplateBytes(path) {
  const fs = window.Application?.FileSystem
  if (!fs) throw new Error('FileSystem 不可用')
  const native = (p) => (typeof ActiveXObject !== 'undefined' ? String(p).replace(/\//g, '\\') : String(p).replace(/\\/g, '/'))
  const p = native(path)

  if (typeof fs.ReadFileAsArrayBuffer === 'function') {
    const arr = fs.ReadFileAsArrayBuffer(p)
    if (arr) return arr instanceof ArrayBuffer ? arr : new Uint8Array(arr).buffer
  }
  if (typeof fs.readAsBinaryString === 'function') {
    const bin = fs.readAsBinaryString(p)
    if (bin) {
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff
      return bytes.buffer
    }
  }
  throw new Error('无法读取模板文件字节：' + path)
}

async function unzip(bytes) {
  const JSZip = (await import('jszip')).default
  return JSZip.loadAsync(bytes)
}

function parseXml(text) {
  return new DOMParser().parseFromString(text, 'application/xml')
}

/** 命名空间容错的子元素查找：先按限定名，再按 localName 兜底 */
function tags(parent, qualifiedName) {
  if (!parent) return []
  let list = parent.getElementsByTagName(qualifiedName)
  if (list && list.length) return Array.from(list)
  const local = qualifiedName.split(':').pop()
  const all = parent.getElementsByTagName('*')
  const out = []
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === local) out.push(all[i])
  }
  return out
}

function attr(node, name) {
  return node?.getAttribute?.(name) ?? node?.getAttributeNS?.('*', name) ?? ''
}

function textOf(node) {
  return String(node?.textContent || '').trim()
}

function firstTag(parent, name) {
  return tags(parent, name)[0] || null
}

// ── OOXML 值换算（docx-preview 的映射知识） ──

/** w:sz 半点 → pt */
function halfPointsToPt(val) {
  const n = Number(val)
  return Number.isFinite(n) && n > 0 ? Math.round(n / 2 * 10) / 10 : null
}

/** w:spacing/@w:line + @w:lineRule → 行距描述 */
function lineSpacingOf(spacingNode) {
  if (!spacingNode) return null
  const line = Number(attr(spacingNode, 'w:line'))
  if (!Number.isFinite(line) || line <= 0) return null
  const rule = attr(spacingNode, 'w:lineRule') || 'auto'
  if (rule === 'auto') return { type: 'multiple', value: Math.round(line / 240 * 100) / 100 }
  return { type: rule === 'exact' ? 'exact' : 'atLeast', value: Math.round(line / 20 * 10) / 10, unit: 'pt' }
}

function rFontsOf(rPr) {
  const fonts = firstTag(rPr, 'w:rFonts')
  if (!fonts) return null
  return {
    ascii: attr(fonts, 'w:ascii') || null,
    eastAsia: attr(fonts, 'w:eastAsia') || attr(fonts, 'w:ascii') || null
  }
}

function runPropsOf(rPr) {
  if (!rPr) return null
  const fonts = rFontsOf(rPr)
  const sz = halfPointsToPt(attr(firstTag(rPr, 'w:sz'), 'w:val'))
  const color = attr(firstTag(rPr, 'w:color'), 'w:val') || null
  const bold = !!firstTag(rPr, 'w:b')
  if (!fonts && !sz && !color && !bold) return null
  return { fonts, sizePt: sz, color: color && color !== 'auto' ? color : null, bold }
}

function paraPropsOf(pPr) {
  if (!pPr) return null
  const spacing = lineSpacingOf(firstTag(pPr, 'w:spacing'))
  const jc = attr(firstTag(pPr, 'w:jc'), 'w:val') || null
  const ind = firstTag(pPr, 'w:ind')
  const out = { lineSpacing: spacing, align: jc }
  if (ind) {
    out.indent = {
      firstLineChars: attr(ind, 'w:firstLineChars') || null,
      leftChars: attr(ind, 'w:leftChars') || null
    }
  }
  return out
}

// ── docx 剖析 ──

function parseDocxProfile(zip) {
  return (async () => {
    const profile = { kind: 'doc', defaults: null, namedStyles: [], structure: {} }

    const stylesXml = await zip.file('word/styles.xml')?.async('string').catch(() => null)
    if (stylesXml) {
      const doc = parseXml(stylesXml)
      const docDefaults = firstTag(doc, 'w:docDefaults')
      if (docDefaults) {
        profile.defaults = {
          run: runPropsOf(firstTag(firstTag(docDefaults, 'w:rPrDefault'), 'w:rPr')),
          para: paraPropsOf(firstTag(firstTag(docDefaults, 'w:pPrDefault'), 'w:pPr'))
        }
      }
      for (const style of tags(doc, 'w:style')) {
        const styleId = attr(style, 'w:styleId')
        const name = textOf(firstTag(style, 'w:name')) || styleId
        const named = {
          styleId,
          name,
          type: attr(style, 'w:type') || 'paragraph',
          run: runPropsOf(firstTag(style, 'w:rPr')),
          para: paraPropsOf(firstTag(style, 'w:pPr'))
        }
        if (named.run || named.para) profile.namedStyles.push(named)
      }
    }

    const docXml = await zip.file('word/document.xml')?.async('string').catch(() => null)
    if (docXml) {
      const doc = parseXml(docXml)
      const body = firstTag(doc, 'w:body')
      const paragraphs = tags(body, 'w:p')
      const headings = []
      const textParts = []
      for (const p of paragraphs) {
        const pPr = firstTag(p, 'w:pPr')
        const pStyle = attr(firstTag(pPr, 'w:pStyle'), 'w:val')
        const text = tags(p, 'w:t').map(t => t.textContent || '').join('')
        if (pStyle && /^(heading|标题)/i.test(pStyle) && text.trim()) {
          headings.push({ style: pStyle, text: text.trim().slice(0, 80) })
        }
        if (text.trim()) textParts.push(text.trim())
      }
      profile.structure = {
        paragraphCount: paragraphs.length,
        tableCount: tags(body, 'w:tbl').length,
        headings: headings.slice(0, 30),
        sampleText: textParts.join('\n').slice(0, MAX_SAMPLE_TEXT_CHARS)
      }
    }
    return profile
  })()
}

// ── pptx 剖析 ──

/** 装饰性短文案：LOGO/章节序号/页码/年份/CONTENTS/百分比等——角色 decor，改写时保持原样 */
const DECOR_TEXT_RE = /^(logo|contents?|agenda|catalog(ue)?|目录|章节|thanks?(\s*you)?|thank\s*you|谢谢(观看|聆听)?|q\s*&\s*a|the\s*end|end|part\s*(one|two|three|four|five|six|seven|eight|nine|ten|[ivx]+|\d+)|chapter\s*\d*|section\s*\d*|0?\d{1,2}\s*[.．、:：]?|\d{4}([./年-]\d{1,2}){0,2}[月日]?|第?\s*[一二三四五六七八九十\d]+\s*[章节部分页]|[a-z]{1,6}|\d+(\.\d+)?%|[#*·•\-—_]+)$/i
const PH_TITLE = new Set(['title', 'ctrTitle'])
const PH_DECOR = new Set(['sldNum', 'dt', 'ftr', 'hdr', 'pic', 'chart', 'tbl', 'media', 'clipArt', 'dgm'])

/** 形状最大字号（pt）：扫全部 a:rPr/a:defRPr/a:endParaRPr 的 sz（百分之一 pt），取最大 */
function maxFontSizeOf(sp) {
  let max = 0
  for (const name of ['a:rPr', 'a:defRPr', 'a:endParaRPr']) {
    for (const n of tags(sp, name)) {
      const sz = Number(attr(n, 'sz'))
      if (Number.isFinite(sz) && sz > max) max = sz
    }
  }
  return max > 0 ? Math.round(max / 100) : null
}

/**
 * 形状级角色剖析（2026-10-16 真机根因：texts 按 a:t 平铺，第 1 条是「LOGO」，底稿把它当标题）。
 * 枚举顺序与 templateFileGenerator.parseSlideShapes 一致（文档序全部 p:sp），shapeIndex 可直接用于精确替换。
 * 角色：title（占位 title/ctrTitle 或页内最大字号）/ subtitle / body / decor（LOGO、页码、PART ONE 等）。
 */
function classifySlideShapes(doc) {
  const spElements = tags(doc, 'p:sp')
  const shapes = []
  for (let i = 0; i < spElements.length; i++) {
    const sp = spElements[i]
    const ph = firstTag(sp, 'p:ph')
    const phType = ph ? (attr(ph, 'type') || 'body') : null
    const texts = tags(sp, 'a:t').map(t => (t.textContent || '').trim()).filter(Boolean)
    const combined = texts.join('').trim()
    // 位置（EMU）：供内容映射按阅读顺序/就近序号排布；组合形状内为相对坐标，同页排序足够
    const off = firstTag(firstTag(sp, 'a:xfrm') || sp, 'a:off')
    const x = Number(attr(off, 'x')) || 0
    const y = Number(attr(off, 'y')) || 0
    const entry = { shapeIndex: i, phType, combined: combined.slice(0, 120), fontSize: maxFontSizeOf(sp), role: null, x, y }
    if (!combined) { shapes.push(entry); continue }
    if (phType && PH_TITLE.has(phType)) entry.role = 'title'
    else if (phType === 'subTitle') entry.role = 'subtitle'
    else if (phType && PH_DECOR.has(phType)) entry.role = 'decor'
    else if (DECOR_TEXT_RE.test(combined)) entry.role = 'decor'
    else if ((entry.fontSize && entry.fontSize <= 4) || /https?:\/\/|www\./i.test(combined)) entry.role = 'decor' // 隐形水印/网址
    else if (phType) entry.role = 'body'
    shapes.push(entry)
  }
  // 非占位文本框按字号定级：页内最大字号（≥20pt 且不超过 40 字）= 标题；≥16pt 且 ≤60 字 = 副标题；其余正文
  const free = shapes.filter(s => s.combined && !s.role)
  const maxFont = Math.max(0, ...free.map(s => s.fontSize || 0))
  let hasTitle = shapes.some(s => s.role === 'title')
  for (const s of free) {
    const len = s.combined.length
    if (!hasTitle && s.fontSize && s.fontSize === maxFont && maxFont >= 20 && len <= 40) { s.role = 'title'; hasTitle = true; continue }
    if (s.fontSize && s.fontSize >= 16 && len <= 60) { s.role = 'subtitle'; continue }
    s.role = 'body'
  }
  // 页内无标题但有非装饰文本 → 提升字号最大（同字号取最短）的一个为标题，保证每页有标题位
  if (!hasTitle) {
    const cands = shapes.filter(s => s.combined && s.role !== 'decor')
      .sort((a, b) => (b.fontSize || 0) - (a.fontSize || 0) || a.combined.length - b.combined.length)
    if (cands.length) cands[0].role = 'title'
  }
  return shapes
}

const ROLE_LABEL = { title: '标题', subtitle: '副标题', body: '正文', decor: '装饰' }

function parsePptxProfile(zip) {
  return (async () => {
    const profile = { kind: 'slide', theme: null, slideSize: null, slides: [] }

    const themeFile = zip.file('ppt/theme/theme1.xml')
    if (themeFile) {
      const doc = parseXml(await themeFile.async('string').catch(() => ''))
      const scheme = firstTag(doc, 'a:clrScheme')
      if (scheme) {
        const colors = {}
        for (const slot of ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink']) {
          const node = firstTag(scheme, 'a:' + slot)
          if (!node) continue
          const srgb = firstTag(node, 'a:srgbClr')
          if (srgb) colors[slot] = '#' + (attr(srgb, 'val') || '').toUpperCase()
          else {
            const sys = firstTag(node, 'a:sysClr')
            if (sys) colors[slot] = '#' + (attr(sys, 'lastClr') || '000000').toUpperCase()
          }
        }
        profile.theme = { colors }
      }
      const fontScheme = firstTag(doc, 'a:fontScheme')
      if (fontScheme) {
        const latinOf = (parent) => attr(firstTag(parent, 'a:latin'), 'typeface') || null
        const eaOf = (parent) => attr(firstTag(parent, 'a:ea'), 'typeface') || null
        profile.theme = profile.theme || {}
        profile.theme.fonts = {
          major: { latin: latinOf(firstTag(fontScheme, 'a:majorFont')), eastAsia: eaOf(firstTag(fontScheme, 'a:majorFont')) },
          minor: { latin: latinOf(firstTag(fontScheme, 'a:minorFont')), eastAsia: eaOf(firstTag(fontScheme, 'a:minorFont')) }
        }
      }
    }

    const presXml = zip.file('ppt/presentation.xml')
    if (presXml) {
      const doc = parseXml(await presXml.async('string').catch(() => ''))
      const sldSz = firstTag(doc, 'p:sldSz')
      if (sldSz) {
        const cx = Number(attr(sldSz, 'cx'))
        const cy = Number(attr(sldSz, 'cy'))
        if (cx > 0 && cy > 0) {
          profile.slideSize = { cx, cy, ratio: Math.round(cx / cy * 100) / 100 }
        }
      }
    }

    const slideFiles = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const na = Number(a.match(/(\d+)\.xml$/)?.[1] || 0)
        const nb = Number(b.match(/(\d+)\.xml$/)?.[1] || 0)
        return na - nb
      })
      .slice(0, MAX_SLIDES_ANALYZED)

    for (const [idx, file] of slideFiles.entries()) {
      const doc = parseXml(await zip.file(file).async('string').catch(() => ''))
      const spTree = firstTag(doc, 'p:spTree')
      const texts = tags(spTree, 'a:t').map(t => (t.textContent || '').trim()).filter(Boolean)
      const shapes = classifySlideShapes(doc).filter(s => s.combined)
      profile.slides.push({
        index: idx + 1,
        shapeCount: tags(spTree, 'p:sp').length,
        pictureCount: tags(spTree, 'p:pic').length,
        tableCount: tags(spTree, 'a:tbl').length,
        texts: texts.slice(0, 12).map(t => t.slice(0, 60)),
        shapes
      })
    }
    profile.slideCount = slideFiles.length
    return profile
  })()
}

// ── xlsx 剖析 ──

function parseXlsxProfile(zip) {
  return (async () => {
    const profile = { kind: 'sheet', sheets: [], headerPreview: [], columnWidths: [], mergeCount: 0, dimension: null }

    // 共享字符串表
    let sharedStrings = []
    const ssFile = zip.file('xl/sharedStrings.xml')
    if (ssFile) {
      const doc = parseXml(await ssFile.async('string').catch(() => ''))
      sharedStrings = tags(doc, 'si').map(si => tags(si, 't').map(t => t.textContent || '').join(''))
    }

    const wbFile = zip.file('xl/workbook.xml')
    if (wbFile) {
      const doc = parseXml(await wbFile.async('string').catch(() => ''))
      profile.sheets = tags(doc, 'sheet').map(s => attr(s, 'name')).filter(Boolean)
    }

    const sheetFile = zip.file('xl/worksheets/sheet1.xml')
    if (sheetFile) {
      const doc = parseXml(await sheetFile.async('string').catch(() => ''))
      const dim = attr(firstTag(doc, 'dimension'), 'ref')
      if (dim) profile.dimension = dim
      const row1 = tags(doc, 'row')[0]
      if (row1) {
        profile.headerPreview = tags(row1, 'c').slice(0, 24).map(c => {
          const t = attr(c, 't')
          const v = textOf(firstTag(c, 'v'))
          if (t === 's') return sharedStrings[Number(v)] ?? ''
          return v
        })
      }
      profile.columnWidths = tags(doc, 'col').slice(0, 30).map(col => ({
        min: Number(attr(col, 'min') || 0),
        width: Number(attr(col, 'width') || 0)
      })).filter(c => c.min > 0 && c.width > 0)
      profile.mergeCount = tags(doc, 'mergeCell').length
    }
    return profile
  })()
}

// ── 对外入口 ──

/**
 * 剖析模板文件 → 模板画像（按 kind 分派；任何一步失败降级为部分画像）
 * @param {{path?:string, arrayBuffer?:ArrayBuffer, kind?:string}} source
 * @returns {Promise<{ok:boolean, kind?:string, profile?:object, error?:string}>}
 */
export async function analyzeTemplateFile(source = {}) {
  try {
    let bytes = source.arrayBuffer || null
    const kind = normalizeTemplateKind(source.kind, source.path)
    if (!bytes) {
      if (!source.path) return { ok: false, error: '缺少模板路径' }
      bytes = readTemplateBytes(source.path)
    }
    const zip = await unzip(bytes)
    let profile
    if (kind === 'sheet') profile = await parseXlsxProfile(zip)
    else if (kind === 'slide') profile = await parsePptxProfile(zip)
    else profile = await parseDocxProfile(zip)
    return { ok: true, kind: profile.kind || kind, profile }
  } catch (e) {
    console.warn('analyzeTemplateFile 失败:', e)
    return { ok: false, error: e?.message || '模板剖析失败' }
  }
}

/** 画像 → 精简文本（喂给 LLM 做计划/展示在确认卡） */
export function summarizeProfile(analyzeResult) {
  if (!analyzeResult?.ok) return '（模板剖析不可用）'
  const p = analyzeResult.profile || {}
  if (analyzeResult.kind === 'slide') {
    const theme = p.theme || {}
    const colors = Object.entries(theme.colors || {}).map(([k, v]) => `${k}:${v}`).join(' ')
    const fonts = theme.fonts ? `主标题字体:${theme.fonts.major?.eastAsia || theme.fonts.major?.latin || '默认'} 正文字体:${theme.fonts.minor?.eastAsia || theme.fonts.minor?.latin || '默认'}` : ''
    // 形状级画像（带 #shapeIndex 与角色），LLM 计划据此给出 shapeIndex 精确替换；无 shapes 时退回 texts 平铺
    const pages = (p.slides || []).map(s => {
      const shapes = Array.isArray(s.shapes) ? s.shapes.filter(x => x.combined) : []
      const body = shapes.length
        ? shapes.slice(0, 10).map(x => `#${x.shapeIndex}${ROLE_LABEL[x.role] || '正文'}${x.fontSize ? x.fontSize + 'pt' : ''}「${x.combined.slice(0, 48)}」`).join(' ')
        : ((s.texts || []).join(' | ').slice(0, 90) || '无文案')
      return `第${s.index}页(形状${s.shapeCount}/图片${s.pictureCount}/表格${s.tableCount}): ${body}`
    })
    return [`共${p.slideCount}页，页面宽高比${p.slideSize?.ratio || '?'}`, colors, fonts, ...pages].filter(Boolean).join('\n')
  }
  if (analyzeResult.kind === 'sheet') {
    return [
      `工作表：${(p.sheets || []).join(', ')}`,
      p.dimension ? `数据范围：${p.dimension}` : '',
      `表头预览：${(p.headerPreview || []).join(' | ') || '空表'}`,
      p.mergeCount ? `合并单元格：${p.mergeCount} 处` : ''
    ].filter(Boolean).join('\n')
  }
  const styles = (p.namedStyles || []).slice(0, 8).map(s => {
    const run = s.run || {}
    return `${s.name}(字体:${run.fonts?.eastAsia || run.fonts?.ascii || '默认'} 字号:${run.sizePt || '默认'}pt${run.para?.lineSpacing ? ` 行距:${run.para.lineSpacing.type === 'multiple' ? run.para.lineSpacing.value + '倍' : run.para.lineSpacing.value + 'pt'}` : ''})`
  })
  return [
    p.structure?.sampleText ? `正文预览：\n${p.structure.sampleText.slice(0, 900)}` : '（无可读取正文）',
    (p.structure?.headings || []).length ? `标题结构：${p.structure.headings.map(h => h.text).join(' / ')}` : '',
    styles.length ? `样式档案：\n${styles.join('\n')}` : '',
    p.structure?.paragraphCount ? `段落数：${p.structure.paragraphCount}，表格数：${p.structure.tableCount}` : ''
  ].filter(Boolean).join('\n')
}
