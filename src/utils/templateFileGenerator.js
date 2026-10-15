/**
 * PPT 文件级生成器（2026-10-15 架构修正：后台处理，不在 WPS 中打开模板）。
 *
 * 动机（真机实证链）：
 * - jsapi Presentations.Open 崩 WPS（jswppapi SIGBUS）→ 已禁用
 * - OS 级打开虽不崩，但会把用户拽到新文档窗口（用户明确不接受）
 * - 剖析早已是 ZIP 级（templateStyleReader）——执行同样下沉到文件级即可全程后台
 *
 * 能力（对照计划协议 plan.pages）：
 * - edit：slideN.xml 内 <a:t> 精确文本替换（find 逐字取自剖析 texts，天然同节点）
 * - duplicate：克隆 slide XML + rels + [Content_Types] override + presentation.xml sldIdLst
 * - add：克隆模板内容页为底版，替换其文案（v1 不造新形状）
 *
 * 纯 jszip + DOMParser，可在 node 离线单测。
 */

async function loadZipLib() {
  const JSZip = (await import('jszip')).default
  return JSZip
}

function xmlOf(text) {
  return new DOMParser().parseFromString(text, 'application/xml')
}
function textOf(doc) {
  return new XMLSerializer().serializeToString(doc)
}
/** 命名空间容错查找 */
function tags(parent, name) {
  if (!parent) return []
  const list = parent.getElementsByTagName(name)
  if (list && list.length) return Array.from(list)
  const local = name.split(':').pop()
  const out = []
  for (const n of parent.getElementsByTagName('*')) {
    if (n.localName === local) out.push(n)
  }
  return out
}
function maxRidIn(xmlText) {
  let max = 0
  for (const m of xmlText.matchAll(/rId(\d+)/g)) max = Math.max(max, Number(m[1]))
  return max
}
function slideNum(name) {
  return Number(String(name).match(/slide(\d+)\.xml$/)?.[1] || 0)
}

/**
 * 在单页 XML 上执行文本替换；find 需逐字命中单个 <a:t> 节点。
 * @returns {{applied:number, missed:string[]}}
 */
function replaceTextsInSlideDoc(doc, replaces) {
  const applied = []
  const missed = []
  const nodes = tags(doc, 'a:t')
  for (const rep of replaces) {
    const find = String(rep?.find || '')
    const replaceTo = String(rep?.replace ?? rep?.replaceWith ?? '')
    if (!find) continue
    const hit = nodes.find(n => (n.textContent || '').includes(find))
    if (hit) {
      hit.textContent = String(hit.textContent).replace(find, replaceTo)
      applied.push(find)
    } else {
      missed.push(find)
    }
  }
  return { applied: applied.length, missed }
}

/**
 * 应用计划到 pptx 字节。
 * @param {ArrayBuffer} templateBytes
 * @param {{pages:Array<{action:string,page:number,replaces:Array,find:string,replace:string,title:string,body:string}>}} plan
 * @returns {Promise<{ok:boolean, bytes?:ArrayBuffer, stats?:object, error?:string}>}
 */
export async function applySlidePlanToPptx(templateBytes, plan) {
  const JSZip = await loadZipLib()
  let zip
  try {
    zip = await JSZip.loadAsync(templateBytes)
  } catch (e) {
    return { ok: false, error: '模板不是有效的 pptx（zip 解析失败）：' + (e?.message || e) }
  }

  const stats = { edits: 0, duplicates: 0, adds: 0, missedTexts: [], pages: 0 }
  const contentTypesFile = zip.file('[Content_Types].xml')
  if (!contentTypesFile) return { ok: false, error: '模板缺少 [Content_Types].xml' }
  let ctText = await contentTypesFile.async('string')
  let presText = await zip.file('ppt/presentation.xml').async('string')

  // 现有页清单（按序号）
  let nextSlide = 1
  for (const name of Object.keys(zip.files)) {
    const n = slideNum(name)
    if (n >= nextSlide) nextSlide = n + 1
  }

  for (const page of Array.isArray(plan?.pages) ? plan.pages : []) {
    const action = String(page?.action || 'edit').toLowerCase()
    if (action === 'edit') {
      const file = zip.file(`ppt/slides/slide${Number(page?.page) || 1}.xml`)
      if (!file) { stats.missedTexts.push(`第${page?.page}页不存在`); continue }
      const doc = xmlOf(await file.async('string'))
      const r = replaceTextsInSlideDoc(doc, page?.replaces || [])
      stats.edits += r.applied
      stats.missedTexts.push(...r.missed)
      zip.file(`ppt/slides/slide${Number(page?.page) || 1}.xml`, textOf(doc))
    } else if (action === 'duplicate' || action === 'add') {
      const srcNum = action === 'duplicate' ? (Number(page?.page) || 1) : pickContentSlideNum(zip)
      const srcPath = `ppt/slides/slide${srcNum}.xml`
      const srcFile = zip.file(srcPath)
      if (!srcFile) { stats.missedTexts.push(`克隆源页不存在：${srcPath}`); continue }
      let xml = await srcFile.async('string')
      // rels：克隆引用（媒体/版式共享引用即可；notesSlide 引用移除避免共享备注错乱）
      const srcRelsPath = `ppt/slides/_rels/slide${srcNum}.xml.rels`
      const srcRelsFile = zip.file(srcRelsPath)
      let relsText = srcRelsFile ? await srcRelsFile.async('string') : '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
      relsText = relsText.replace(/<Relationship [^>]*notesSlide[^>]*\/>/g, '')
      // 新 slide 的 rels 指回其版式（引用不变即可）
      zip.file(`ppt/slides/_rels/slide${nextSlide}.xml.rels`, relsText)
      // add：替换文案为 title/body
      if (action === 'add') {
        const doc = xmlOf(xml)
        const replaces = []
        if (page?.title) replaces.push({ find: firstTextOf(doc, 0) || '', replace: page.title })
        if (page?.body && firstTextOf(doc, 1)) replaces.push({ find: firstTextOf(doc, 1), replace: page.body })
        const usable = replaces.filter(r => r.find)
        if (usable.length) {
          const r = replaceTextsInSlideDoc(doc, usable)
          stats.edits += r.applied
          stats.missedTexts.push(...r.missed)
        }
        xml = textOf(doc)
      } else if (Array.isArray(page?.replaces) && page.replaces.length) {
        const doc = xmlOf(xml)
        const r = replaceTextsInSlideDoc(doc, page.replaces)
        stats.edits += r.applied
        stats.missedTexts.push(...r.missed)
        xml = textOf(doc)
      }
      zip.file(`ppt/slides/slide${nextSlide}.xml`, xml)
      // Content_Types override
      ctText = ctText.replace('</Types>',
        `<Override PartName="/ppt/slides/slide${nextSlide}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`)
      // presentation.xml sldIdLst：追加（置于末尾）
      const rid = `rIdSld${nextSlide}_${Date.now().toString(36)}`
      presText = presText.replace('</p:sldIdLst>',
        `<p:sldId id="${256 + nextSlide}" r:id="${rid}"/></p:sldIdLst>`)
      // presentation.xml.rels 增加关系
      const presRelsPath = 'ppt/_rels/presentation.xml.rels'
      let presRels = await zip.file(presRelsPath).async('string')
      presRels = presRels.replace('</Relationships>',
        `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${nextSlide}.xml"/></Relationships>`)
      zip.file(presRelsPath, presRels)
      if (action === 'add') stats.adds++
      else stats.duplicates++
      nextSlide++
    }
  }
  zip.file('[Content_Types].xml', ctText)
  zip.file('ppt/presentation.xml', presText)

  const out = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
  stats.pages = nextSlide - 1
  return { ok: true, bytes: out, stats }
}

function firstTextOf(doc, index) {
  const nodes = tags(doc, 'a:t')
  const filtered = nodes.filter(n => String(n.textContent || '').trim())
  return filtered[index] ? String(filtered[index].textContent || '').trim() : ''
}

/** 选“内容页”底版：跳过第 1 页（封面惯例），取有文案的页，否则回第 1 页 */
function pickContentSlideNum(zip) {
  const nums = Object.keys(zip.files)
    .map(n => slideNum(n))
    .filter(Boolean)
    .sort((a, b) => a - b)
  if (!nums.length) return 1
  return nums.find(n => n > 1) || nums[0]
}

/**
 * 文件级修正（QC fix 应用）：对全部幻灯片逐页尝试 find→replace（首个命中页生效）。
 * @returns {Promise<{ok:boolean,bytes?:ArrayBuffer,applied:number}>}
 */
export async function fixSlideTextsAtFileLevel(templateBytes, fixes) {
  const JSZip = await loadZipLib()
  try {
    const zip = await JSZip.loadAsync(templateBytes)
    let applied = 0
    for (const fix of Array.isArray(fixes) ? fixes : []) {
      const find = String(fix?.fixFind || fix?.find || '')
      const replaceTo = String(fix?.fixReplace ?? fix?.replace ?? '')
      if (!find) continue
      const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => slideNum(a) - slideNum(b))
      for (const name of names) {
        const doc = xmlOf(await zip.file(name).async('string'))
        const nodes = tags(doc, 'a:t')
        const hit = nodes.find(n => (n.textContent || '').includes(find))
        if (hit) {
          hit.textContent = String(hit.textContent).replace(find, replaceTo)
          zip.file(name, textOf(doc))
          applied++
          break
        }
      }
    }
    if (!applied) return { ok: true, bytes: templateBytes, applied: 0 }
    const out = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
    return { ok: true, bytes: out, applied }
  } catch (e) {
    return { ok: false, bytes: templateBytes, applied: 0 }
  }
}
