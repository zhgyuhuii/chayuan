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
      profile.slides.push({
        index: idx + 1,
        shapeCount: tags(spTree, 'p:sp').length,
        pictureCount: tags(spTree, 'p:pic').length,
        tableCount: tags(spTree, 'a:tbl').length,
        texts: texts.slice(0, 12).map(t => t.slice(0, 60))
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
    const pages = (p.slides || []).map(s => `第${s.index}页(形状${s.shapeCount}/图片${s.pictureCount}/表格${s.tableCount}): ${(s.texts || []).join(' | ').slice(0, 90) || '无文案'}`)
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
