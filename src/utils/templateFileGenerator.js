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

/** 解析单页所有形状（含占位符类型/字号/文本/位置）——形状级剖析核心 */
function parseSlideShapes(doc) {
  const shapes = []
  const spElements = tags(doc, 'p:sp')
  for (let i = 0; i < spElements.length; i++) {
    const sp = spElements[i]
    const entry = { shapeIndex: i, phType: null, phIdx: null, isPlaceholder: false, texts: [], combined: '', fontSize: null, fontName: null }
    // 占位符类型
    const phNodes = tags(sp, 'p:ph')
    if (phNodes.length) {
      entry.phType = phNodes[0].getAttribute('type') || 'body'
      entry.phIdx = phNodes[0].getAttribute('idx') || null
      entry.isPlaceholder = true
    }
    // 文本内容
    const tNodes = tags(sp, 'a:t')
    entry.texts = tNodes.map(n => n.textContent || '')
    entry.combined = entry.texts.join('').trim()
    // 字号/字体（首个 rPr 的属性）
    const rPrs = tags(sp, 'a:rPr')
    if (rPrs.length) {
      const sz = rPrs[0].getAttribute('sz')
      if (sz) entry.fontSize = Number(sz) / 100
    }
    const defRPr = tags(sp, 'a:defRPr')
    if (defRPr.length) {
      const sz = defRPr[0].getAttribute('sz')
      if (sz && !entry.fontSize) entry.fontSize = Number(sz) / 100
    }
    const latin = tags(sp, 'a:latin')
    if (latin.length) entry.fontName = latin[0].getAttribute('typeface') || null
    const ea = tags(sp, 'a:ea')
    if (ea.length) entry.fontName = ea[0].getAttribute('typeface') || entry.fontName
    shapes.push(entry)
  }
  return shapes
}

/** 按形状索引替换文本：将该 shape 的全部 <a:t> 合并为新文本（放入首节点，清空其余） */
function replaceShapeText(doc, shapeIndex, newText) {
  const spElements = tags(doc, 'p:sp')
  if (shapeIndex >= spElements.length) return false
  const tNodes = tags(spElements[shapeIndex], 'a:t')
  if (!tNodes.length) return false
  tNodes[0].textContent = newText
  for (let i = 1; i < tNodes.length; i++) tNodes[i].textContent = ''
  return true
}

/** 按占位符类型查找形状索引（title/ctrTitle/body/subTitle 等） */
function findShapeByPlaceholder(shapes, phType) {
  return shapes.findIndex(s => s.phType === phType)
}


/**
 * 在单页 XML 上执行文本替换；find 需逐字命中单个 <a:t> 节点。
 * @returns {{applied:number, missed:string[]}}
 */
const NORM_RE = /[\s\u3000，。、；：""''（）()【】\[\],.:;?!'"!！？—-]/g
function normText(t) {
  return String(t || '').toLowerCase().replace(NORM_RE, '')
}

const PLACEHOLDER_WORDS = /(输入标题|请在此处|单击此处|点击输入|点击此处|Lorem\s+ipsum|添加合适的文字|文字内容或复制粘贴|用简明扼要)/i

/** 替换文案净化（2026-10-15 渲染实证根因）：GLM 叠加层曾产出
 * 「旧占位+新标题+旧正文」拼接体与通用占位词 find，扩散污染多页。
 * 规则：replace 含占位词/含 │ 拼接 → 拒绝；过短（≤2 个汉字且总长 <6，如「标题」「内容」）→ 拒绝；
 * 「工作概述」「项目成果」等 3~5 字章节标题是合法替换，不得误杀（2026-10-16 形状级底稿依赖）。 */
function isBadReplace(replaceTo) {
  const t = String(replaceTo || '')
  if (!t.trim()) return true
  if (PLACEHOLDER_WORDS.test(t)) return true
  if ((t.match(/\|/g) || []).length >= 2) return true
  const cjk = (t.match(/[\u4e00-\u9fa5]/g) || []).length
  if (cjk > 0 && cjk <= 2 && t.length < 6) return true
  if (/^(标题|内容|正文|文本|副标题|小标题|文字)$/.test(t.trim())) return true
  return false
}

/** 命中节点所属形状（向上找 p:sp）；找不到返回 null */
function ownerShape(node) {
  let cur = node?.parentNode
  while (cur && cur.nodeType === 1) {
    if (cur.localName === 'sp') return cur
    cur = cur.parentNode
  }
  return null
}

/** 整形状替换：首 a:t 写入新文、其余清空——杜绝同形状多 run 旧新混杂 */
function replaceWholeShapeText(sp, hitNode, newText) {
  const tNodes = sp ? tags(sp, 'a:t') : []
  if (!tNodes.length) { hitNode.textContent = newText; return }
  tNodes[0].textContent = newText
  for (let i = 1; i < tNodes.length; i++) tNodes[i].textContent = ''
}

function replaceTextsInSlideDoc(doc, replaces, shapeCensus) {
  const pageSpElements = tags(doc, 'p:sp')
  const applied = []
  const missed = []
  const rejected = []
  for (const rep of replaces) {
    const find = String(rep?.find || '')
    let replaceTo = String(rep?.replace ?? rep?.replaceWith ?? '')
    if (!find && rep?.shapeIndex === undefined) continue
    if (isBadReplace(replaceTo)) { rejected.push(find.slice(0, 12)); continue }
    // 优先按 shapeIndex 精确替换（census 校验：该形状原文需与 find 相符，防 LLM 报错索引误伤）
    if (rep?.shapeIndex !== undefined && rep?.shapeIndex !== null) {
      const idx = Number(rep.shapeIndex)
      const sp = pageSpElements[idx]
      const target = shapeCensus ? shapeCensus[idx] : null
      const sameText = !find || !target || normText(target.combined).includes(normText(find).slice(0, 12)) || normText(find).includes(normText(target.combined).slice(0, 12))
      if (sp && sameText) {
        const tNodes = tags(sp, 'a:t')
        if (tNodes.length) {
          tNodes[0].textContent = replaceTo
          for (let i = 1; i < tNodes.length; i++) tNodes[i].textContent = ''
          applied.push(find || `#${idx}`)
          continue
        }
      }
      if (!find) { missed.push(`#${idx}`); continue }
    }
    // 文本子串匹配（兜底）——命中后整形状替换
    const hit = tags(doc, 'a:t').find(n => (n.textContent || '').includes(find))
    if (hit) {
      replaceWholeShapeText(ownerShape(hit), hit, replaceTo)
      applied.push(find)
      continue
    }
    // 模糊匹配
    const nFind = normText(find)
    if (nFind.length >= 4 && !PLACEHOLDER_WORDS.test(find)) {
      const allT = tags(doc, 'a:t')
      const fuzzy = allT.find(n => {
        const nn = normText(n.textContent)
        return nn && nn.includes(nFind)
      })
      if (fuzzy) {
        replaceWholeShapeText(ownerShape(fuzzy), fuzzy, replaceTo)
        applied.push(find + '(fuzzy)')
        continue
      }
      // 形状级模糊：find 可能跨多个 run（LLM 复制了形状合并文本），按形状合并文本匹配
      let shapeHit = false
      for (const sp of pageSpElements) {
        const tNodes = tags(sp, 'a:t')
        if (!tNodes.length) continue
        const combined = normText(tNodes.map(n => n.textContent || '').join(''))
        if (combined && (combined.includes(nFind) || (nFind.length >= 8 && combined.length >= 6 && nFind.includes(combined)))) {
          tNodes[0].textContent = replaceTo
          for (let i = 1; i < tNodes.length; i++) tNodes[i].textContent = ''
          applied.push(find + '(shape)')
          shapeHit = true
          break
        }
      }
      if (shapeHit) continue
    }
    missed.push(find)
  }
  return { applied: applied.length, missed, rejected: rejected.length }
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

// ── 单次装载 API（2026-10-15 内存优化：执行链复用同一 ZIP，避免多次全量装载打爆 CEF）──

export async function loadTemplateZip(templateBytes) {
  const JSZip = await loadZipLib()
  try {
    return { ok: true, zip: await JSZip.loadAsync(templateBytes) }
  } catch (e) {
    return { ok: false, error: '模板不是有效的 pptx：' + (e?.message || e) }
  }
}

export async function applySlidePlanToZip(zip, plan) {
  // 与 applySlidePlanToPptx 相同逻辑，但作用在已装载的 zip 上且不导出字节
  const stats = { edits: 0, duplicates: 0, adds: 0, missedTexts: [], rejected: 0, pages: 0 }
  let ctText = await zip.file('[Content_Types].xml').async('string')
  let presText = await zip.file('ppt/presentation.xml').async('string')
  let nextSlide = 1
  for (const name of Object.keys(zip.files)) {
    const n = slideNum(name)
    if (n >= nextSlide) nextSlide = n + 1
  }
  for (const page of Array.isArray(plan?.pages) ? plan.pages : []) {
    const action = String(page?.action || 'edit').toLowerCase()
    if (action === 'edit') {
      const num = Number(page?.page) || 1
      const file = zip.file(`ppt/slides/slide${num}.xml`)
      if (!file) { stats.missedTexts.push(`第${num}页不存在`); continue }
      const doc = xmlOf(await file.async('string'))
      const census = parseSlideShapes(doc)
      const r = replaceTextsInSlideDoc(doc, page?.replaces || [], census)
      stats.edits += r.applied; stats.rejected += r.rejected || 0; stats.missedTexts.push(...r.missed)
      zip.file(`ppt/slides/slide${num}.xml`, textOf(doc))
    } else if (action === 'duplicate' || action === 'add') {
      const srcNum = action === 'duplicate' ? (Number(page?.page) || 1) : pickContentSlideNum(zip)
      const srcFile = zip.file(`ppt/slides/slide${srcNum}.xml`)
      if (!srcFile) { stats.missedTexts.push(`克隆源页不存在：slide${srcNum}`); continue }
      let xml = await srcFile.async('string')
      const srcRelsFile = zip.file(`ppt/slides/_rels/slide${srcNum}.xml.rels`)
      let relsText = srcRelsFile ? await srcRelsFile.async('string') : '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
      relsText = relsText.replace(/<Relationship [^>]*notesSlide[^>]*\/>/g, '')
      zip.file(`ppt/slides/_rels/slide${nextSlide}.xml.rels`, relsText)
      const replaces = action === 'add'
        ? [
            page?.title ? { find: pickNthText(xml, 0), replace: page.title } : null,
            page?.body ? { find: pickNthText(xml, 1), replace: page.body } : null
          ].filter(r => r && r.find)
        : (page?.replaces || [])
      if (replaces.length) {
        const doc = xmlOf(xml)
        const r = replaceTextsInSlideDoc(doc, replaces)
        stats.edits += r.applied; stats.missedTexts.push(...r.missed)
        xml = textOf(doc)
      }
      zip.file(`ppt/slides/slide${nextSlide}.xml`, xml)
      ctText = ctText.replace('</Types>',
        `<Override PartName="/ppt/slides/slide${nextSlide}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`)
      const rid = `rIdSld${nextSlide}_${Date.now().toString(36)}`
      presText = presText.replace('</p:sldIdLst>', `<p:sldId id="${256 + nextSlide}" r:id="${rid}"/></p:sldIdLst>`)
      const presRelsPath = 'ppt/_rels/presentation.xml.rels'
      let presRels = await zip.file(presRelsPath).async('string')
      presRels = presRels.replace('</Relationships>',
        `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${nextSlide}.xml"/></Relationships>`)
      zip.file(presRelsPath, presRels)
      if (action === 'add') stats.adds++; else stats.duplicates++
      nextSlide++
    }
  }
  zip.file('[Content_Types].xml', ctText)
  zip.file('ppt/presentation.xml', presText)
  stats.pages = nextSlide - 1
  return { ok: true, stats }
}

/** 从 zip 直取全部页文案（QC 读回，零二次装载） */
export async function collectSlideTextsFromZip(zip) {
  const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => slideNum(a) - slideNum(b))
  const parts = []
  for (const name of names) {
    const doc = xmlOf(await zip.file(name).async('string'))
    const texts = tags(doc, 'a:t').map(n => String(n.textContent || '').trim()).filter(Boolean)
    parts.push(texts.join(' | '))
  }
  return parts.join('\n')
}

/** QC 修正直接作用于同一 zip */
export async function fixSlideTextsInZip(zip, fixes) {
  let applied = 0
  const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => slideNum(a) - slideNum(b))
  for (const fix of Array.isArray(fixes) ? fixes : []) {
    const find = String(fix?.fixFind || fix?.find || '').trim()
    const replaceTo = String(fix?.fixReplace ?? fix?.replace ?? '')
    if (!find || !replaceTo.trim()) continue
    for (const name of names) {
      const doc = xmlOf(await zip.file(name).async('string'))
      const hit = tags(doc, 'a:t').find(n => (n.textContent || '').includes(find))
      if (hit) {
        // find 覆盖该形状绝大部分文本 → 整形状替换（清掉其余 run 的旧文）；否则节点内片段替换
        const sp = ownerShape(hit)
        const combined = sp ? tags(sp, 'a:t').map(n => n.textContent || '').join('').trim() : String(hit.textContent).trim()
        if (combined === find || find.length >= combined.length * 0.7) replaceWholeShapeText(sp, hit, replaceTo)
        else hit.textContent = String(hit.textContent).replace(find, replaceTo)
        zip.file(name, textOf(doc))
        applied++
        break
      }
      // 逐字未命中 → 复用计划替换引擎的模糊/形状级匹配（QC 的 fixFind 常带标点差异）
      const r = replaceTextsInSlideDoc(doc, [{ find, replace: replaceTo }], parseSlideShapes(doc))
      if (r.applied > 0) {
        zip.file(name, textOf(doc))
        applied++
        break
      }
    }
  }
  return { applied }
}

export async function exportZipBytes(zip) {
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}

/** 取第 n 个非空 <a:t> 文本（add 页 title/body 定位用，直接吃 xml 字符串避免二次 parse） */
function pickNthText(xmlString, index) {
  const doc = xmlOf(xmlString)
  const filtered = tags(doc, 'a:t').filter(n => String(n.textContent || '').trim())
  return filtered[index] ? String(filtered[index].textContent).trim() : ''
}

/**
 * 占位清扫器（2026-10-16 真机：确定性底稿遗漏的占位文本导致"乱糟糟"）：
 * 计划执行完后扫描全部幻灯片，把剩余的 Lorem/输入标题/点击输入 等占位
 * 全部替换为参考素材内容（轮转分配）。确保零占位残留。
 * 形状级：一个形状内任一 a:t 命中占位 → 整形状合并替换（首节点写入、其余清空），
 * 杜绝「Lorem ipsum」「consectetuer…」两段各拿一行参考文拼成乱文。
 * PART ONE / 01 等章节装饰不清扫（由剖析角色 decor 保留原样）。
 */
export async function sweepPlaceholders(zip, referenceContext) {
  const PLACEHOLDER_RE = /^(?:Lorem\s+ipsum.*|LOREM\s+IPSUM.*|输入标题.*|点击输入.*|请在此处.*|单击此处.*|添加合适的文字.*|用简明扼要.*|文字内容或复制.*|\s*consectetuer.*|adipiscing.*|dolor\s+sit.*|amet.*|sed\s+diam.*|nonummy.*|euismod.*|\.*\s*$)/i
  const SHORT_MEANINGFUL_MIN = 4 // 少于4字的非占位文本跳过（如 "01."）

  // 参考素材行（剥 md 前缀/表格竖线/加粗标记）
  const refLines = String(referenceContext || '')
    .split(/\n+/)
    .map(l => l.trim().replace(/^#{1,6}\s*/, '').replace(/^[-*+]\s*/, '').replace(/^\||\|$/g, '').replace(/\s*\|\s*/g, '，').replace(/\*\*/g, ''))
    .filter(l => l.length > 4 && !/^[-:：，\s]+$/.test(l))
  if (!refLines.length) return { swept: 0 }

  const names = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNum(a) - slideNum(b))

  let swept = 0
  let refIdx = 0
  for (const name of names) {
    const doc = xmlOf(await zip.file(name).async('string'))
    let slideChanged = false
    for (const sp of tags(doc, 'p:sp')) {
      const tNodes = tags(sp, 'a:t')
      if (!tNodes.length) continue
      const hit = tNodes.some(n => {
        const txt = String(n.textContent || '').trim()
        return txt.length >= SHORT_MEANINGFUL_MIN && PLACEHOLDER_RE.test(txt)
      })
      if (!hit) continue
      tNodes[0].textContent = refLines[refIdx % refLines.length].slice(0, 80)
      for (let i = 1; i < tNodes.length; i++) tNodes[i].textContent = ''
      refIdx++
      swept++
      slideChanged = true
    }
    if (slideChanged) zip.file(name, textOf(doc))
  }
  return { swept }
}
