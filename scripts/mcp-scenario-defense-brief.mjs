/**
 * MCP scenario: open 民事答辩状.docx
 * → chunked analysis → annotate PII including person names
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.env.CHAYUAN_MCP_URL || 'http://127.0.0.1:62588/mcp'
const DOC_PATH =
  process.env.CHAYUAN_TEST_DOC ||
  path.join(os.homedir(), 'Desktop', '起诉', '民事答辩状.docx')

/** Force chunked analysis even for medium docs (user expectation). */
const FORCE_CHUNK_ANALYSIS = process.env.CHAYUAN_FORCE_CHUNKS !== '0'
const CHUNK_LENGTH = Number(process.env.CHAYUAN_CHUNK_LENGTH) || 1200
const CHUNK_LIMIT = 2

let rpcId = 1

async function mcp(method, params) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params })
  })
  const data = await res.json()
  if (data.error) {
    const err = new Error(data.error.message || 'RPC error')
    err.code = data.error.code
    throw err
  }
  return data.result
}

async function tool(name, args = {}) {
  const result = await mcp('tools/call', { name, arguments: args })
  const sc = result?.structuredContent
  if (result?.isError) {
    const err = new Error(sc?.message || `tool ${name} failed`)
    err.code = sc?.code || 'TOOL_ERROR'
    err.details = sc
    throw err
  }
  return sc ?? result
}

function step(t) {
  console.log(`\n=== ${t} ===`)
}
function pass(m, d = '') {
  console.log(`PASS  ${m}${d ? ' — ' + d : ''}`)
}

const NAME_STOP =
  /^(原告|被告|答辩人|被答辩人|申请人|被申请人|代理人|委托人|公司|有限|法院|诉讼|证据|事实|理由|请求|本案|上述|依法|期间|以上|以下|第一|第二|第三|其一|其二|其三|合同|物业|服务|河南|周口|建业|周城|消防|电梯|火灾)$/
const ORG_AFTER_NAME =
  /^(?:有限|公司|集团|分公司|物业|银行|医院|学校|事务所|中心|委员会)/
const COMMON_SURNAME_CHARS =
  '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛范彭郎鲁韦马苗花方俞任袁柳史唐费薛雷贺倪汤罗毕郝安常乐于时傅齐康伍余顾孟黄穆萧尹姚邵汪毛狄米贝明戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵季贾路江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯管卢莫房解应宗丁邓郁杭洪包诸左石崔龚程裴陆荣翁荀羊於惠甄家封储靳松井段富巫乌焦巴弓牧山谷车侯蓬全班仰秋仲伊宫宁仇栾暴甘厉祖武符刘景詹束龙叶幸司韶黎薄印宿白怀蒲从鄂索咸籍赖卓蔺屠蒙池乔阴胥能双闻莘党翟谭贡劳姬冉宰郦雍桑桂牛寿通边扈燕冀浦尚农温庄晏柴瞿阎慕连习艾鱼容向古易慎戈廖庾终居衡步都耿满弘匡国文寇广禄阙东欧利蔚越隆师巩聂晁勾敖融冷辛简饶空曾沙养鞠须丰巢关相查后荆红游竺权逯盖益桓公闫'

function looksLikePersonName(name, { requireSurname = true } = {}) {
  const n = String(name || '').replace(/[·•]/g, '').trim()
  if (n.length < 2 || n.length > 4) return false
  if (NAME_STOP.test(n)) return false
  if (/[公司司厂店部处局院所队组室厅署委办省市县区]/.test(n)) return false
  if (!/^[\u4e00-\u9fff·]{2,4}$/.test(name)) return false
  if (requireSurname && !COMMON_SURNAME_CHARS.includes(n[0])) return false
  return true
}

/** True if capture looks like a natural person in context (not org / narrative). */
function isPersonNameInContext(text, start, term) {
  const after = text.slice(start + term.length, start + term.length + 12)
  if (ORG_AFTER_NAME.test(after.replace(/^[\s\u00a0\u3000]+/, ''))) return false
  // Strong person cues right after name
  if (/^[，,]\s*[男女]/.test(after) || /^[男女]/.test(after.replace(/^[\s\u00a0\u3000]+/, ''))) {
    return true
  }
  // Signature / short clause: 答辩人：张辉\r  or 张辉。
  if (/^[，,。；;\r\n\u000b]/.test(after) || after.length === 0) {
    return COMMON_SURNAME_CHARS.includes(term[0])
  }
  return false
}

function findSensitiveInChunk(text, chunkMeta = {}) {
  const patterns = [
    { name: '身份证号', re: /[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]/g, risk: 'high' },
    { name: '统一社会信用代码', re: /\b[0-9A-HJ-NP-RTUWXY]{2}\d{6}[0-9A-HJ-NP-RTUWXY]{10}\b/g, risk: 'high' },
    { name: '手机号', re: /(?<!\d)1[3-9]\d{9}(?!\d)/g, risk: 'high' },
    { name: '邮箱', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, risk: 'high' },
    { name: '银行卡号', re: /(?<!\d)(?:\d{16}|\d{19})(?!\d)/g, risk: 'high' }
  ]
  const hits = []
  const claimed = []
  const overlaps = (start, end) => claimed.some((r) => start < r.end && end > r.start)

  for (const p of patterns) {
    p.re.lastIndex = 0
    let m
    while ((m = p.re.exec(text)) !== null) {
      const term = m[0]
      const start = m.index
      const end = start + term.length
      if (overlaps(start, end)) continue
      if (p.name === '统一社会信用代码' && /^\d{17}[\dXx]$/.test(term)) continue
      claimed.push({ start, end })
      hits.push({
        category: p.name,
        riskLevel: p.risk,
        term,
        index: start,
        chunkIndex: chunkMeta.chunkIndex,
        chunkStart: chunkMeta.start,
        comment: `【涉密信息】疑似${p.name}「${term}」，风险等级：${p.risk}。建议脱敏或限制对外披露。`
      })
    }
  }

  // Role-anchored: 答辩人（被告）：张辉 — longer roles first; no mid-word match.
  // Do NOT allow [^：:]{0,24} drift to a later colon (that caused「本案存在」FPs).
  const roleNameRe =
    /(?<![\u4e00-\u9fff])(?:被答辩人|答辩人|被申请人|申请人|法定代表人|负责人|委托人|代理人|原告|被告)(?:[（(][^）\n]{0,16}[）)])?[：:]\s*([\u4e00-\u9fff·]{2,4})/g
  let rm
  while ((rm = roleNameRe.exec(text)) !== null) {
    const term = rm[1]
    if (!looksLikePersonName(term, { requireSurname: true })) continue
    const start = rm.index + rm[0].lastIndexOf(term)
    const end = start + term.length
    if (overlaps(start, end)) continue
    if (!isPersonNameInContext(text, start, term)) continue
    claimed.push({ start, end })
    hits.push({
      category: '人名',
      riskLevel: 'high',
      term,
      index: start,
      chunkIndex: chunkMeta.chunkIndex,
      chunkStart: chunkMeta.start,
      comment: `【涉密信息】疑似自然人姓名「${term}」，属于个人身份信息。建议脱敏或限制对外披露。`
    })
  }

  // Pattern: 张辉，男/女
  const genderNameRe = /([\u4e00-\u9fff·]{2,4})[，,]\s*[男女]/g
  while ((rm = genderNameRe.exec(text)) !== null) {
    const term = rm[1]
    if (!looksLikePersonName(term, { requireSurname: true })) continue
    const start = rm.index
    const end = start + term.length
    if (overlaps(start, end)) continue
    if (!isPersonNameInContext(text, start, term)) continue
    claimed.push({ start, end })
    hits.push({
      category: '人名',
      riskLevel: 'high',
      term,
      index: start,
      chunkIndex: chunkMeta.chunkIndex,
      chunkStart: chunkMeta.start,
      comment: `【涉密信息】疑似自然人姓名「${term}」，属于个人身份信息。建议脱敏或限制对外披露。`
    })
  }

  // Closing signature: 答辩人：张辉
  const signNameRe =
    /(?<![\u4e00-\u9fff])(?:答辩人|被答辩人|原告|被告)[：:]\s*([\u4e00-\u9fff·]{2,4})(?=[\s\r\n\u000b。]|$)/g
  while ((rm = signNameRe.exec(text)) !== null) {
    const term = rm[1]
    if (!looksLikePersonName(term, { requireSurname: true })) continue
    const start = rm.index + rm[0].lastIndexOf(term)
    const end = start + term.length
    if (overlaps(start, end)) continue
    claimed.push({ start, end })
    hits.push({
      category: '人名',
      riskLevel: 'high',
      term,
      index: start,
      chunkIndex: chunkMeta.chunkIndex,
      chunkStart: chunkMeta.start,
      comment: `【涉密信息】疑似自然人姓名「${term}」，属于个人身份信息。建议脱敏或限制对外披露。`
    })
  }

  return hits
}

function extractKeyInfo(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const pick = (re) => lines.find((l) => re.test(l)) || ''
  return {
    title: lines.find((l) => /答辩|民事|起诉/.test(l)) || lines[0] || '',
    caseNo: pick(/案号|（\d{4}）/),
    parties: lines.filter((l) => /答辩人|被答辩人|原告|被告/.test(l)).slice(0, 6),
    charCount: text.length,
    lineCount: lines.length
  }
}

async function loadChunksPaged() {
  const chunks = []
  let cursor = 0
  for (let page = 0; page < 80; page++) {
    const res = await tool('document_chunks', {
      cursor,
      limit: CHUNK_LIMIT,
      chunkLength: CHUNK_LENGTH,
      overlapLength: 80
    })
    for (const c of res.chunks || []) {
      chunks.push({
        chunkIndex: c.chunkIndex,
        start: c.start,
        end: c.end,
        text: c.text || '',
        charCount: c.charCount
      })
    }
    pass(
      `chunks page ${page}`,
      `got=${(res.chunks || []).length} total=${res.totalChunks} hasMore=${res.hasMore} next=${res.nextCursor}`
    )
    if (!res.hasMore) break
    cursor = res.nextCursor
    if (cursor == null) break
  }
  return chunks
}

async function main() {
  if (!fs.existsSync(DOC_PATH)) throw new Error(`File not found: ${DOC_PATH}`)
  console.log('DOC =', DOC_PATH)
  console.log('FORCE_CHUNK_ANALYSIS =', FORCE_CHUNK_ANALYSIS, 'CHUNK_LENGTH =', CHUNK_LENGTH)

  step('0. Agent')
  const st = await tool('wps_status')
  if (!st?.agent?.agentOnline) throw new Error('WPS Agent offline')
  pass('agent online')

  step('1. Open document')
  let opened = null
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      opened = await tool('document_open', { path: DOC_PATH })
      pass('document_open', opened?.document?.name || 'ok')
      break
    } catch (e) {
      console.warn(`open ${attempt}:`, e.code || e.message)
      await new Promise((r) => setTimeout(r, 800))
    }
  }
  if (!opened) throw new Error('document_open failed')

  let meta = null
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      await tool('document_ensure_open', { path: DOC_PATH })
      meta = await tool('document_meta', {})
      if (meta?.charCount > 0 || meta?.name) break
    } catch (e) {
      console.warn(`meta ${attempt}:`, e.code || e.message)
    }
    await new Promise((r) => setTimeout(r, 700))
  }
  if (!meta) throw new Error('document_meta unavailable')
  pass('document_meta', `chars=${meta.charCount} name=${meta.name}`)

  step('2. Chunked fetch + per-chunk analysis')
  let chunks = []
  let fullText = ''
  if (FORCE_CHUNK_ANALYSIS || meta.recommendChunks || meta.charCount > 80000) {
    chunks = await loadChunksPaged()
    fullText = chunks.map((c) => c.text).join('')
    pass('chunk assembly', `chunks=${chunks.length} chars≈${fullText.length}`)
  } else {
    const t = await tool('document_get_text', {})
    fullText = t.text || ''
    chunks = [{ chunkIndex: 0, start: 0, end: fullText.length, text: fullText, charCount: fullText.length }]
    pass('document_get_text', `chars=${t.charCount}`)
  }

  const keyInfo = extractKeyInfo(fullText)
  console.log('\n--- 关键信息 ---')
  console.log(JSON.stringify(keyInfo, null, 2))

  step('3. Per-chunk sensitive detection (incl. names)')
  const allHits = []
  for (const c of chunks) {
    const hits = findSensitiveInChunk(c.text, c)
    allHits.push(...hits)
    const names = hits.filter((h) => h.category === '人名').map((h) => h.term)
    console.log(
      `  chunk#${c.chunkIndex} chars=${c.charCount} hits=${hits.length}` +
        (names.length ? ` names=[${names.join(',')}]` : '')
    )
  }
  pass('total hits', `count=${allHits.length} names=${allHits.filter((h) => h.category === '人名').length}`)

  step('4. Annotate (dedupe by category|term)')
  const byTerm = new Map()
  for (const h of allHits) {
    const k = `${h.category}|${h.term}`
    if (!byTerm.has(k)) byTerm.set(k, h)
  }
  // Prefer annotating names first
  const toAnnotate = [...byTerm.values()].sort((a, b) => {
    const rank = (x) => (x.category === '人名' ? 0 : x.category === '身份证号' ? 1 : 2)
    return rank(a) - rank(b)
  }).slice(0, 40)

  let applied = 0
  let failed = 0
  const errors = []
  for (const h of toAnnotate) {
    try {
      await tool('document_add_comment', {
        text: h.comment,
        originalText: h.term,
        hintStart: Number.isFinite(h.chunkStart) ? h.chunkStart : undefined,
        confirmed: true
      })
      applied++
      console.log(`  + ${h.category}: ${h.term}` + (h.chunkIndex != null ? ` (chunk#${h.chunkIndex})` : ''))
    } catch (e) {
      failed++
      errors.push({ term: h.term, category: h.category, code: e.code, message: e.message })
      console.warn(`  ! fail ${h.category} ${h.term}: ${e.code || ''} ${e.message}`)
    }
  }
  pass('comments', `applied=${applied} failed=${failed}`)

  step('5. declassify_preview')
  let preview = null
  if (toAnnotate.length) {
    try {
      preview = await tool('declassify_preview', {
        keywords: toAnnotate.map((h) => ({
          term: h.term,
          category: h.category,
          riskLevel: h.riskLevel
        }))
      })
      pass('declassify_preview', `replacements=${preview?.replacementMap?.length ?? '?'}`)
    } catch (e) {
      pass('declassify_preview.soft', e.message)
    }
  }

  const report = {
    docPath: DOC_PATH,
    chunked: FORCE_CHUNK_ANALYSIS,
    chunkLength: CHUNK_LENGTH,
    chunkCount: chunks.length,
    meta,
    keyInfo,
    hitsByCategory: allHits.reduce((acc, h) => {
      acc[h.category] = (acc[h.category] || 0) + 1
      return acc
    }, {}),
    personNames: [...new Set(allHits.filter((h) => h.category === '人名').map((h) => h.term))],
    annotateTargets: toAnnotate,
    commentsApplied: applied,
    commentsFailed: failed,
    errors
  }
  const outDir = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
    'chayuan-wps-mcp',
    'mcp'
  )
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'scenario-defense-brief.json')
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8')
  console.log('\n========== SCENARIO GO ==========')
  console.log('person names →', report.personNames.join(', ') || '(none)')
  console.log('report →', outFile)
}

main().catch((e) => {
  console.error('\n========== SCENARIO FAIL ==========')
  console.error(e.code || '', e.message)
  if (e.details) console.error(JSON.stringify(e.details).slice(0, 600))
  process.exit(1)
})
