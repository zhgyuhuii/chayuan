/**
 * 模板内容映射器（纯函数，零 window/jsapi 依赖，可离线单测）。
 *
 * 职责：把参考素材（md/文本）章节化，并按模板剖析出的形状角色（title/subtitle/body/decor）
 * 生成确定性改写计划——每条 replace 带 shapeIndex 精确落位，新文长度按原文容量约束。
 *
 * 2026-10-16 真机根因：旧版把每页 texts[0]（a:t 平铺首条，封面上是「LOGO」）当标题替换，
 * 真正的大字号标题「大模型 24×7 全生命周期开发白皮书」原样残留。现按角色对位：
 *   title 形状 ← 封面放文档主标题，内容页放当前章节标题
 *   subtitle / body 形状 ← 该章段落顺序流入（页多于内容时回绕）
 *   decor 形状（LOGO / 页码 / PART ONE / 01）原样保留
 * LLM 计划在其上叠加精修——模型再弱也保证标题/正文落在正确图元中。
 */

/** 参考素材章节化：md 标题（#/一、/1.）起新章，其后段落归该章；首个 H1 作文档标题 */
export function sectionizeReference(referenceContext, requirement) {
  const lines = String(referenceContext || '')
    .split(/\n+/)
    .map(l => l.trim())
    .filter(l => l.length > 1 && !/^[-=*_]{3,}$/.test(l) && !/^\|?[\s:：|-]+\|?$/.test(l))
  const sections = []
  let docTitle = ''
  let cur = null
  for (const raw of lines) {
    const h = raw.match(/^(#{1,6})\s*(.+)$/)
    const text = (h ? h[2] : raw)
      .replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '')
      .replace(/^\||\|$/g, '').replace(/\s*\|\s*/g, '，')
      .replace(/\*\*|__|`/g, '').trim()
    if (!text) continue
    const cnHead = text.length <= 30 && (/^[一二三四五六七八九十]+[、.．]\s*\S/.test(text) || /^\d+[、.．]\s*[^\d\s]{2,}$/.test(text))
    if (h || cnHead) {
      if (h && h[1].length === 1 && !docTitle && !sections.length) { docTitle = text.slice(0, 40); continue }
      cur = { title: text.slice(0, 32), paras: [] }
      sections.push(cur)
    } else {
      if (!cur) { cur = { title: '', paras: [] }; sections.push(cur) }
      cur.paras.push(text)
    }
  }
  if (!docTitle) docTitle = sections.find(s => s.title)?.title || String(requirement || '').slice(0, 30) || '年度工作总结'
  return { docTitle, sections }
}

/** 按容量截断：超长时尽量在句读处截断，补省略号 */
export function fitText(text, cap) {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  if (t.length <= cap) return t
  const cut = t.slice(0, cap)
  const m = cut.match(/^[\s\S]*[。；;！!？?]/)
  const base = (m && m[0].length >= cap * 0.5) ? m[0] : cut.replace(/[，,、\s]+$/, '')
  return /[。！？!?]$/.test(base) ? base : base + '…'
}

/** 新文长度上限：按原文长度放大；占位原文普遍很短（「输入标题」4 字），下限保证数据句完整（副标题 20、正文 30），上限防撑爆版式 */
export function capFor(role, origLen) {
  if (role === 'title') return Math.min(40, Math.max(12, Math.round(origLen * 1.5)))
  if (role === 'subtitle') return Math.min(80, Math.max(20, Math.round(origLen * 1.6)))
  return Math.min(200, Math.max(30, Math.round(origLen * 1.6)))
}

const ROW_TOLERANCE_EMU = 300000 // ≈0.33 英寸：y 差在此内视为同一行，按 x 排

/** 阅读顺序（上→下、左→右，同行容差）；无坐标的形状保持原序 */
export function readingOrder(shapes) {
  if (!shapes.some(s => s.x || s.y)) return shapes.slice()
  return shapes.slice().sort((a, b) => {
    const dy = (a.y || 0) - (b.y || 0)
    if (Math.abs(dy) > ROW_TOLERANCE_EMU) return dy
    return (a.x || 0) - (b.x || 0)
  })
}

/**
 * 目录条目排序：每个条目就近配对一个序号装饰（01. / 02 / 一）并按序号排；
 * 配不到序号时退回阅读顺序。解决 XML 顺序 ≠ 视觉顺序（真机：01=一、02=四、03=二）。
 */
export function orderTocEntries(entries, decors) {
  const numbered = decors
    .map(d => ({ d, n: Number((d.combined.match(/^0?(\d{1,2})/) || [])[1]) || '一二三四五六七八九十'.indexOf(d.combined.replace(/[^一二三四五六七八九十]/g, '')[0]) + 1 || 0 }))
    .filter(x => x.n > 0 && (x.d.x || x.d.y))
  if (numbered.length < 2 || !entries.some(e => e.x || e.y)) return readingOrder(entries)
  const dist2 = (a, b) => ((a.x || 0) - (b.x || 0)) ** 2 + ((a.y || 0) - (b.y || 0)) ** 2
  const keyed = entries.map(e => {
    let best = null
    for (const nd of numbered) {
      const d2 = dist2(e, nd.d)
      if (!best || d2 < best.d2) best = { n: nd.n, d2 }
    }
    return { e, n: best ? best.n : 999 }
  })
  return keyed.sort((a, b) => a.n - b.n || (a.e.y || 0) - (b.e.y || 0)).map(k => k.e)
}

/**
 * 确定性改写计划。
 * @param {{slides:Array<{index:number,texts?:string[],shapes?:Array<{shapeIndex:number,role:string,combined:string}>}>}} analysisProfile
 * @param {string} referenceContext 参考素材（附件 md/文本）
 * @param {string} requirement 用户需求（素材为空时的兜底内容）
 * @returns {{pages:Array<{action:'edit',page:number,replaces:Array<{shapeIndex?:number,find:string,replace:string}>}>}}
 */
export function buildDeterministicSlidePlan(analysisProfile, referenceContext, requirement) {
  const slides = (analysisProfile?.slides || [])
  const { docTitle, sections } = sectionizeReference(referenceContext, requirement)
  // 内容队列：章标题 + 该章每段，顺序流（页多于内容时回绕）
  const queue = []
  for (const sec of sections) {
    const paras = sec.paras.length ? sec.paras : [sec.title]
    for (const p of paras) queue.push({ title: sec.title || docTitle, body: p })
  }
  if (!queue.length) queue.push({ title: docTitle, body: String(requirement || docTitle) })
  let qi = 0
  const peek = () => queue[qi % queue.length]
  const take = () => queue[qi++ % queue.length]

  const pages = []
  for (const sl of slides) {
    const shapes = (sl.shapes || []).filter(s => s.combined)
    const replaces = []
    if (!shapes.length) {
      // 旧版兜底（无形状剖析时）：首条文本 ← 标题，其余 ← 正文
      const texts = (sl.texts || []).filter(Boolean)
      if (!texts.length) continue
      const item = peek()
      replaces.push({ find: texts[0], replace: fitText(item.title, 40) })
      for (let k = 1; k < Math.min(texts.length, 6); k++) replaces.push({ find: texts[k], replace: fitText(take().body, 120) })
      pages.push({ action: 'edit', page: sl.index, replaces })
      continue
    }
    const title = shapes.find(s => s.role === 'title')
    const fillers = readingOrder(shapes.filter(s => s.role === 'subtitle' || s.role === 'body'))
    const decors = shapes.filter(s => s.role === 'decor')
    const isCover = sl.index === 1
    // 目录页：标题含 目录/CONTENTS/AGENDA——条目位按序号就近配对后依次放章节标题，01./02. 序号由剖析 decor 保留
    const shortSubs = fillers.filter(s => s.role === 'subtitle' && s.combined.length <= 14)
    const isToc = /目录|contents|agenda|大纲/i.test(title?.combined || '')
    if (isToc && shortSubs.length >= 1) {
      // 无标题首章（封面/引言散段）不算章，不进目录
      const tocSections = sections.filter(s => s.title)
      orderTocEntries(shortSubs, decors).forEach((s, k) => {
        replaces.push({ shapeIndex: s.shapeIndex, find: s.combined, replace: fitText(tocSections[k % tocSections.length]?.title || docTitle, capFor('subtitle', s.combined.length)) })
      })
      // 条目下的正文说明（Lorem）← 对应章节首段（同样按序号就近配对）
      orderTocEntries(fillers.filter(s => s.role === 'body'), decors).forEach((s, k) => {
        replaces.push({ shapeIndex: s.shapeIndex, find: s.combined, replace: fitText(tocSections[k % tocSections.length]?.paras[0] || docTitle, capFor('body', s.combined.length)) })
      })
      if (replaces.length) pages.push({ action: 'edit', page: sl.index, replaces })
      continue
    }
    if (title) {
      const t = isCover ? docTitle : peek().title
      replaces.push({ shapeIndex: title.shapeIndex, find: title.combined, replace: fitText(t, capFor('title', title.combined.length)) })
    }
    for (const s of fillers.slice(0, 10)) {
      const body = isCover && s.role === 'subtitle' ? (peek().body || requirement) : take().body
      replaces.push({ shapeIndex: s.shapeIndex, find: s.combined, replace: fitText(body, capFor(s.role, s.combined.length)) })
    }
    if (!fillers.length && !isCover) qi++ // 纯标题页也推进内容游标
    if (replaces.length) pages.push({ action: 'edit', page: sl.index, replaces })
  }
  return { pages }
}
