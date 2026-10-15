/**
 * 模板生成专用任务管线（方案 v2.2 §五/§1.2「任务管线」）。
 *
 * 独立于聊天 agent loop（其 MAX_ROUNDS 装不下逐页改+逐页审），五段式：
 * 剖析（文件级，templateStyleReader）→ LLM 计划 → createFromTemplate 开副本
 * → 槽位填充执行（doc/sheet/slide 各自原语）→ 质检循环（语义审必做 + PPT 几何
 * 校验）→ SaveAs2 原子交付（清 NdNewFile 标记）。
 *
 * 全程可中止（__isCancelled 钩子）、可观测（taskListStore 进度事件）；
 * LLM 调用失败在「开副本之前」即失败退出，避免留下半开的临时文件。
 */

import { chatCompletion, getChatApiConfigByProvider } from './chatApi.js'
import { getFlatModelsFromSettings, parseModelCompositeId } from './modelSettings.js'
import { normalizeTemplateKind, resolveTemplateSource } from './documentTemplates.js'
import { createFromTemplate, deliverActiveDocument, assertSameHostKind } from './documentCreateFromTemplate.js'
import { analyzeTemplateFile, summarizeProfile, readTemplateBytes } from './templateStyleReader.js'
import { smartDefaults, assembleContract, contractToPromptLines, outlineChanged, cardAspectsForKind, flatKeyFor } from './templateContract.js'
import { checkDeckGeometry } from './pptGeometryChecker.js'
import { getDocumentText } from './documentActions.js'
import { handleSpreadsheetAction } from '../services/mcpBridge/spreadsheetDispatch.js'
import { handlePresentationAction } from '../services/mcpBridge/presentationDispatch.js'
import { withDocumentWriteLock } from '../services/documentWriteLock.js'
import { updateTask as updateTaskRecord, getTaskById } from './taskListStore.js'

const MAX_QC_ROUNDS = 3
const DEFAULT_QC_ROUNDS = 2
const TEXT_SAMPLE_LIMIT = 3000
const PLAN_CACHE_TTL_MS = 30 * 60 * 1000

// 两段式确认（方案共识 #9）的会话级计划缓存：planOnly 生成计划后暂存，
// 用户回复「确认执行」时由 runTemplatePlanExecution 取用。webview 重载即失效（可重跑）。
let lastPlanCache = null

/** 供 executor 判断是否存在待确认计划 */
export function peekLastTemplatePlan() {
  if (!lastPlanCache) return null
  if (Date.now() - lastPlanCache.createdAt > PLAN_CACHE_TTL_MS) {
    lastPlanCache = null
    return null
  }
  return lastPlanCache
}

function cachePlan(entry) {
  lastPlanCache = { ...entry, createdAt: Date.now() }
}

/** 卡片「取消」：清掉待执行计划（确认按钮走 execute-template-plan） */
export function discardTemplatePlan() {
  lastPlanCache = null
}

// ── hash 偏好记忆（v1.4 P0b：按内容 hash 存勾选偏好，同模板下次预填）──

const PREF_STORE_KEY = 'chayuan_tpl_aspect_prefs'
const PREF_TTL_MS = 30 * 24 * 60 * 60 * 1000

async function fileContentHash(path) {
  try {
    const bytes = readTemplateBytes(path)
    const digest = await crypto?.subtle?.digest?.('SHA-256', bytes).catch(() => null)
    if (digest) return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
  } catch (_) { /* 回退 FNV */ }
  // FNV-1a 32bit 回退（非 secure context 时 crypto.subtle 不可用）
  try {
    const bytes = new Uint8Array(readTemplateBytes(path))
    let h = 0x811c9dc5
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0 }
    return 'fnv_' + h.toString(16)
  } catch (_) {
    return null
  }
}

function loadAspectPrefs() {
  try {
    const raw = (typeof localStorage !== 'undefined' && localStorage.getItem(PREF_STORE_KEY)) ||
      window.Application?.PluginStorage?.getItem(PREF_STORE_KEY)
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (_) {
    return {}
  }
}

function saveAspectPrefsKey(hashKey, fields) {
  try {
    const all = loadAspectPrefs()
    all[hashKey] = { fields, savedAt: Date.now() }
    const json = JSON.stringify(all)
    if (typeof localStorage !== 'undefined') localStorage.setItem(PREF_STORE_KEY, json)
    try { window.Application?.PluginStorage?.setItem(PREF_STORE_KEY, json) } catch (_) { /* 双通道 best-effort */ }
  } catch (e) {
    console.warn('saveAspectPrefs 失败:', e)
  }
}

function prefsForHash(hashKey) {
  if (!hashKey) return null
  const entry = loadAspectPrefs()[hashKey]
  if (!entry?.fields) return null
  if (Date.now() - Number(entry.savedAt || 0) > PREF_TTL_MS) return null
  return entry.fields
}

/** 计划影响勾选项（变更需重规划——影响大纲/组织方式，纯样式项不需） */
const PLAN_AFFECTING_LEAVES = ['structure.skeleton', 'layout.pageRoles', 'copy.toneFollow', 'content.sampleAsReference']

function createCancelledError() {
  const err = new Error('任务已停止')
  err.code = 'TASK_CANCELLED'
  return err
}

function progress(taskId, percent, eventText, extraData = {}) {
  if (!taskId) return
  try {
    // updateTask 是浅合并：必须带出既有 data，否则会冲掉 executor 写入的 params/items
    const existing = getTaskById(taskId)?.data || {}
    updateTaskRecord(taskId, {
      progress: Math.min(99, Math.max(1, Math.round(percent))),
      data: {
        ...existing,
        progressStage: 'generating-from-template',
        progressEvents: [...(Array.isArray(existing.progressEvents) ? existing.progressEvents : []), eventText].slice(-50),
        ...extraData
      }
    })
  } catch (_) { /* 进度非阻塞 */ }
}

/**
 * 解析对话模型：默认模型分类(defaultModelsByCategory.chat) → flat 列表校验
 * （与 assistantTaskRunner.resolveModel 同一判定源：flat 模型必有 apiUrl），
 * 兜底按 composite id 'PROVIDER|model' 解析并校验 provider 可用性。
 */
function resolveChatModel() {
  try {
    const flat = getFlatModelsFromSettings('chat')
    // 候选逐个做「provider 真有 API 地址」校验（2026-10-15 真机：默认模型
    // provider 缺地址 → chatCompletion 抛「未配置该模型的 API 地址」炸管线）
    const usable = (m) => {
      if (!m?.providerId || !m?.modelId) return false
      try { return !!getChatApiConfigByProvider(m.providerId, m.modelId) } catch (_) { return false }
    }
    const defaultId = String(loadDefaultChatId() || '').trim()
    const inFlat = defaultId ? flat.find(m => m.id === defaultId) : null
    if (usable(inFlat)) return { providerId: inFlat.providerId, modelId: inFlat.modelId }
    const parsed = defaultId ? parseModelCompositeId(defaultId) : null
    if (parsed && usable(parsed)) return { providerId: parsed.providerId, modelId: parsed.modelId }
    // 兜底：flat 列表第一个真正可用的对话模型（逐个校验，不再盲取第一个）
    const first = flat.find(usable)
    if (first) return { providerId: first.providerId, modelId: first.modelId }
  } catch (e) {
    console.warn('resolveChatModel 失败:', e)
  }
  return null
}

function loadDefaultChatId() {
  try {
    // 局部引入避免循环依赖（assistantSettings 依赖链较重）
    const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('defaultModelsByCategory')) ||
      window.Application?.PluginStorage?.getItem('defaultModelsByCategory')
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored
    return parsed?.chat || ''
  } catch (_) {
    return ''
  }
}

function parseJsonLoose(raw) {
  const text = String(raw || '').trim()
  if (!text) return null
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = block?.[1]?.trim() || text
  try {
    return JSON.parse(candidate)
  } catch (_) {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try { return JSON.parse(candidate.slice(start, end + 1)) } catch (_) { return null }
    }
    return null
  }
}

async function llmJson(model, systemPrompt, userPrompt) {
  // 慢端点适配（2026-10-15 实测：agnes ping 14s；计划 prompt 长，默认超时会误报
  // 「模型服务暂时不可用」）——放宽到 180s，且瞬时失败自动重试 1 次
  const attempt = async () => chatCompletion({
    providerId: model.providerId,
    modelId: model.modelId,
    temperature: 0.3,
    timeoutMs: 180000,
    requestTimeoutMs: 180000,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  })
  let raw
  try {
    raw = await attempt()
  } catch (first) {
    console.warn('llmJson 首次失败，1 次自动重试:', first?.message || first)
    raw = await attempt()
  }
  return parseJsonLoose(raw)
}

// ── 各类型计划 prompt 与执行器 ──

function buildPlanPrompt(kind, { profileSummary, requirement, pageTarget, toneFollow, docParagraphs, contractLines = '', userOutline = '', referenceContext = '' }) {
  const toneRule = toneFollow === false
    ? '文风：按用户需求自由撰写，不必模仿模板原文案风格。'
    : '文风：跟随模板原文案的语体风格（正式/营销/学术等以原文为准）。'
  const common = [
    '你是文档模板改写规划器。基于给定模板画像与用户需求，输出「就地改写」计划 JSON，不要输出解释。',
    '铁律：只在模板副本上就地改内容，样式由 WPS 原生保留，计划不得涉及字体颜色等格式指令。',
    toneRule,
    referenceContext ? `【参考素材（用户附件内容，生成内容的事实来源）】\n${referenceContext}` : '',
    contractLines || '',
    userOutline ? `【用户改定大纲（以此为准重新映射）】\n${userOutline}` : '',
    '只输出合法 JSON。'
  ].filter(Boolean).join('\n')

  if (kind === 'slide') {
    return {
      system: common,
      user: [
        `【模板画像】\n${profileSummary}`,
        `【用户需求】${requirement}`,
        `【目标页数】${pageTarget > 0 ? pageTarget + ' 页（可按需 duplicate/add 调整）' : '由你按需求决定，优先复用模板已有页'}`,
        '',
        '输出 JSON：{"pages":[{"action":"edit|duplicate|add","page":页码,"replaces":[{"find":"模板原文案片段(≥6字且唯一)","replace":"新文案"}],"title":"新页标题(add/duplicate时)","body":"新页正文(add时)"}]}',
        '规则：edit 的 find 必须逐字取自该页模板原文案；add 仅在模板页型覆盖不了时使用；duplicate 用于模板已有页型可复用但原文案整体要换时。'
      ].join('\n')
    }
  }
  if (kind === 'sheet') {
    return {
      system: common,
      user: [
        `【模板画像】\n${profileSummary}`,
        `【用户需求】${requirement}`,
        '',
        '输出 JSON：{"blocks":[{"startCell":"A2","values":[[ "...", 1 ], ...]}], "cellOps":[{"cell":"D2","value":"=SUM(B2:C2)"}]}',
        '规则：只填数据行，不要改表头；公式以 = 开头；数据行数保持与需求相称，不要超出模板预留区域太远。'
      ].join('\n')
    }
  }
  return {
    system: common,
    user: [
      `【模板画像】\n${profileSummary}`,
      `【段落清单（序号. 文本）】\n${docParagraphs}`,
      `【用户需求】${requirement}`,
      '',
      '输出 JSON：{"ops":[{"paragraphIndex":序号,"newText":"替换后的整段文本"}], "appends":[{"afterParagraphIndex":序号,"text":"新增段落文本","style":"可选,须逐字使用【模板画像】样式档案中列出的样式名"}]}',
      '规则：op 的 newText 是该段完整新文本（标题段替换为完整标题，正文段替换为完整正文）；需要新增内容时用 appends，其 style 优先从样式档案的样式名中选择（如正文/Body Text）；不改模板中的落款、页眉类固定文案。'
    ].join('\n')
  }
}

/** 收集 doc 段落清单（序号从 1 起，仅非空段，截断防御大文档） */
function collectDocParagraphs(doc) {
  const lines = []
  try {
    const count = Math.min(Number(doc.Paragraphs.Count || 0), 400)
    for (let i = 1; i <= count; i++) {
      const text = String(doc.Paragraphs.Item(i)?.Range?.Text || '').split('\r').join(' ').trim()
      if (text) lines.push(`${i}. ${text.slice(0, 120)}`)
    }
  } catch (_) { /* 尽力而为 */ }
  return lines.join('\n').slice(0, 6000)
}


/**
 * 正文基线捕获（2026-10-15 真机反馈：模板黑体/生成楷体）：
 * 新增段落 InsertAfter 继承的是段落标记（Normal）字体，与模板正文实际字体无关。
 * 基线 = 活文档正文段落里出现最多的 (NameFarEast, Size)——即"模板正文长什么样"。
 * 空模板无正文 → 回退分析画像 docDefaults → 再回退 Normal 样式 → 都失败返回 null。
 */
function captureBodyFontBaseline(doc, analysisProfile) {
  const votes = new Map()
  try {
    const total = Math.min(Number(doc.Paragraphs.Count || 0), 200)
    for (let i = 1; i <= total; i++) {
      let para
      try { para = doc.Paragraphs.Item(i) } catch (_) { continue }
      const text = String(para?.Range?.Text || '').split('\r').join(' ').split('\u0007').join('').trim()
      if (text.length < 8) continue // 跳过标题/空段/短行，只要正文段
      let font = null, size = null
      try { font = para.Range.Font?.NameFarEast || para.Range.Font?.Name || null } catch (_) { font = null }
      try { size = para.Range.Font?.Size || null } catch (_) { size = null }
      if (!font) continue
      const key = font + '|' + (size || '')
      votes.set(key, (votes.get(key) || 0) + 1)
    }
  } catch (_) { /* 枚举失败走回退 */ }
  let best = null
  let bestCount = 0
  for (const [key, count] of votes) {
    if (count > bestCount) { bestCount = count; best = key }
  }
  if (best && bestCount >= 1) {
    const [font, size] = best.split('|')
    return { font, size: Number(size) || null }
  }
  // 回退1：文件级剖析 docDefaults（styles.xml）
  const defaults = analysisProfile?.defaults?.run
  if (defaults?.fonts?.eastAsia || defaults?.fonts?.ascii) {
    return { font: defaults.fonts.eastAsia || defaults.fonts.ascii, size: defaults.sizePt || null }
  }
  // 回退2：Normal 样式
  try {
    const normal = doc.Styles.Item(-1) // wdStyleNormal
    return { font: normal?.Font?.NameFarEast || normal?.Font?.Name || null, size: normal?.Font?.Size || null }
  } catch (_) {
    return null
  }
}

function applyBodyBaselineToRange(range, baseline) {
  if (!baseline?.font) return false
  let applied = false
  try { range.Font.NameFarEast = baseline.font; applied = true } catch (_) { /* 西文引擎无此属性 */ }
  try { range.Font.Name = baseline.font; applied = true } catch (_) { /* 尽力而为 */ }
  if (baseline.size) {
    try { range.Font.Size = baseline.size } catch (_) { /* 字号保持 */ }
  }
  return applied
}

/** doc：按段落序号就地替换 / 锚点后追加（保留段落样式，Range.MoveEnd 排除段落标记） */
function executeDocPlan(plan, doc, contract = null, analysisProfile = null) {
  const results = { replaced: 0, appended: 0, failed: 0, fontBaselineApplied: 0 }
  // 契约勾选「沿用字体字号」时：捕获模板正文基线，新增/空段替换后的文字强制对齐
  const fontsOn = !contract || contract.aspects?.style?.fonts !== false
  const baseline = fontsOn ? captureBodyFontBaseline(doc, analysisProfile) : null
  const writePara = (index, newText) => {
    try {
      const para = doc.Paragraphs.Item(Number(index))
      if (!para) return false
      const range = para.Range
      const wasEmpty = !String(range.Text || '').split('\r').join(' ').split('\u0007').join('').replace(/\s/g, '').trim()
      let target = range
      try {
        target = doc.Range(range.Start, range.End)
        target.MoveEnd(1, -1) // wdCharacter，排除段落标记以保留段落样式
      } catch (_) { /* 退化：整段替换 */ }
      target.Text = String(newText)
      // 原段落为空时新文字继承的是段落标记字体（常为 Normal=楷体而非模板正文）→ 套正文基线
      if (wasEmpty && baseline) {
        try {
          const after = doc.Range(range.Start, range.Start + String(newText).length)
          if (applyBodyBaselineToRange(after, baseline)) results.fontBaselineApplied++
        } catch (_) { /* 定位失败保持 */ }
      }
      return true
    } catch (e) {
      console.warn('executeDocPlan 段落替换失败:', index, e)
      return false
    }
  }
  for (const op of Array.isArray(plan?.ops) ? plan.ops : []) {
    if (writePara(op?.paragraphIndex, op?.newText)) results.replaced++
    else results.failed++
  }
  for (const op of (Array.isArray(plan?.appends) ? plan.appends : []).slice().reverse()) {
    try {
      const anchor = doc.Paragraphs.Item(Number(op?.afterParagraphIndex))
      const pos = anchor ? anchor.Range.End : doc.Content.End
      const insertRange = doc.Range(pos, pos)
      insertRange.InsertAfter(String(op?.text || '') + '\r')
      // 命名样式套用（best-effort）：模板带样式档案时新增段优先套样式而非裸文本
      const styleName = String(op?.style || '').trim()
      if (styleName && fontsOn) {
        try { insertRange.Style = styleName } catch (_) { /* 样式名不存在则保持默认 */ }
      } else if (baseline) {
        // 无样式指令：新段落默认继承 Normal（楷体问题根源）→ 强制对齐模板正文基线
        if (applyBodyBaselineToRange(insertRange, baseline)) results.fontBaselineApplied++
      }
      results.appended++
    } catch (_) {
      results.failed++
    }
  }
  return results
}

/** doc：按内容查找替换（质检修正通路） */
function replaceDocByFind(doc, find, replace) {
  let count = 0
  try {
    const total = Math.min(Number(doc.Paragraphs.Count || 0), 1500)
    for (let i = 1; i <= total; i++) {
      const para = doc.Paragraphs.Item(i)
      const text = String(para?.Range?.Text || '')
      if (text.includes(find)) {
        const range = doc.Range(para.Range.Start, para.Range.End)
        try { range.MoveEnd(1, -1) } catch (_) { /* 退化 */ }
        range.Text = String(replace)
        count++
      }
    }
  } catch (_) { /* 尽力而为 */ }
  return count
}

/** sheet：块写 + 单格写（走既有 range_write 通道，只写值不动格式） */
async function executeSheetPlan(plan) {
  const results = { blocks: 0, cells: 0, failed: 0 }
  for (const block of Array.isArray(plan?.blocks) ? plan.blocks : []) {
    try {
      const r = await handleSpreadsheetAction('range_write', {
        startCell: block?.startCell || 'A2',
        values: block?.values || [],
        confirmed: true
      })
      if (r?.ok) results.blocks++
      else results.failed++
    } catch (_) { results.failed++ }
  }
  for (const cell of Array.isArray(plan?.cellOps) ? plan.cellOps : []) {
    try {
      const r = await handleSpreadsheetAction('range_write', {
        startCell: cell?.cell || 'A1',
        values: [[cell?.value ?? '']],
        confirmed: true
      })
      if (r?.ok) results.cells++
      else results.failed++
    } catch (_) { results.failed++ }
  }
  return results
}

/** slide：edit=text_replace 保样式 / duplicate+替换 / add=slide_add */
async function executeSlidePlan(plan) {
  const results = { edits: 0, duplicates: 0, adds: 0, failed: 0 }
  const status = await handlePresentationAction('status', {})
  let slideCount = Number(status?.slideCount || 0)

  for (const page of Array.isArray(plan?.pages) ? plan.pages : []) {
    try {
      const action = String(page?.action || 'edit').toLowerCase()
      if (action === 'add') {
        const r = await handlePresentationAction('slide_add', {
          index: slideCount + 1,
          title: page?.title || '',
          content: page?.body || '',
          confirmed: true
        })
        if (r?.ok) { results.adds++; slideCount++ } else results.failed++
        continue
      }
      if (action === 'duplicate') {
        const r = await handlePresentationAction('slide_duplicate', { index: page?.page, confirmed: true })
        if (r?.ok) {
          results.duplicates++
          slideCount++
          const newPage = Number(page?.page) + 1
          for (const rep of Array.isArray(page?.replaces) ? page.replaces : []) {
            try {
              await handlePresentationAction('text_replace', { index: newPage, find: rep?.find, replace: rep?.replace, confirmed: true })
              results.edits++
            } catch (_) { results.failed++ }
          }
        } else results.failed++
        continue
      }
      for (const rep of Array.isArray(page?.replaces) ? page.replaces : []) {
        try {
          const r = await handlePresentationAction('text_replace', {
            index: Number(page?.page) || 1,
            find: rep?.find,
            replace: rep?.replace,
            confirmed: true
          })
          if (r?.ok) results.edits++
          else results.failed++
        } catch (_) { results.failed++ }
      }
    } catch (_) { results.failed++ }
  }
  return results
}

// ── 质检 ──

async function runQcPass(model, kind, { requirement, profileSummary, contractLines = '' }) {
  const currentText = String(getDocumentText() || '').slice(0, TEXT_SAMPLE_LIMIT)
  const judge = await llmJson(
    '你是文档质检员。对照用户需求审查生成结果，只输出合法 JSON。',
    [
      `【用户需求】${requirement}`,
      `【模板画像摘要】\n${profileSummary.slice(0, 800)}`,
      contractLines || '',
      `【当前文档全文（截断）】\n${currentText}`,
      '',
      '输出：{"pass":布尔,"issues":[{"where":"位置描述","problem":"问题","fixFind":"需被替换的原文片段(文档中逐字存在,≥6字)","fixReplace":"修正后文本"}]}',
      '规则：只报内容问题（缺失/跑题/语体不符/占位残留如「XX公司」「标题」），不报格式问题；fixFind 取不到时留空；pass=true 时 issues 为空数组。'
    ].join('\n')
  )
  return { judge: judge || { pass: true, issues: [] }, currentText }
}

async function applyQcFixes(kind, judge) {
  const issues = Array.isArray(judge?.issues) ? judge.issues.filter(i => i?.fixFind && i?.fixReplace) : []
  if (!issues.length) return { fixed: 0 }
  let fixed = 0
  if (kind === 'slide') {
    const status = await handlePresentationAction('status', {})
    const slideCount = Number(status?.slideCount || 0)
    for (const issue of issues) {
      let hit = false
      for (let p = 1; p <= slideCount && !hit; p++) {
        try {
          const r = await handlePresentationAction('text_replace', { index: p, find: issue.fixFind, replace: issue.fixReplace, confirmed: true })
          if (r?.ok) { fixed++; hit = true }
        } catch (_) { /* 下一页 */ }
      }
    }
    return { fixed }
  }
  if (kind === 'sheet') return { fixed: 0 } // 表格修正 v1 仅报告不自动改
  const app = window.Application
  const doc = app?.ActiveDocument
  if (!doc) return { fixed: 0 }
  for (const issue of issues) {
    if (replaceDocByFind(doc, issue.fixFind, issue.fixReplace) > 0) fixed++
  }
  return { fixed }
}

// ── 执行阶段（③开副本 → ④填充 → ⑤质检 → ⑥交付），计划与续跑共用 ──

async function executePlanStages({ taskId, isCancelled, kind, requirement, profileSummary, plan, sourceParams, templateName = '', contract = null }) {
  const model = resolveChatModel()
  if (!model) throw new Error('未配置对话模型，请先在设置中配置模型')

  // ③ 开临时副本（同宿主闸门在 createFromTemplate 内）
  progress(taskId, 35, '正在从模板创建新文档…')
  const created = await createFromTemplate({ ...sourceParams, kind })
  if (!created.ok) {
    throw new Error(created.error || '从模板创建文档失败')
  }
  if (isCancelled()) throw createCancelledError()

  // ④ 槽位填充执行（写锁内）
  progress(taskId, 50, '正在写入内容…')
  const execResult = await withDocumentWriteLock({ label: 'template-generation.execute' }, async () => {
    if (kind === 'sheet') return executeSheetPlan(plan)
    if (kind === 'slide') return executeSlidePlan(plan)
    const app = window.Application
    const doc = app?.ActiveDocument
    if (!doc) throw new Error('新文档未就绪')
    return executeDocPlan(plan, doc, contract, sourceParams.__analysisProfile || null)
  })
  if (isCancelled()) throw createCancelledError()

  // ⑤ 质检循环（语义审必做；slide 加几何校验；≤ min(qcRounds,3) 轮）
  const maxRounds = Math.min(Math.max(Number(sourceParams.qcRounds) || DEFAULT_QC_ROUNDS, 0), MAX_QC_ROUNDS)
  const qcReport = { rounds: 0, passed: null, issues: [], geometryIssues: [], fixApplied: 0 }
  for (let round = 1; round <= maxRounds; round++) {
    progress(taskId, 50 + Math.round(35 * round / (maxRounds + 1)), `第 ${round}/${maxRounds} 轮质检…`)
    if (isCancelled()) throw createCancelledError()
    const contractLines = contract ? contractToPromptLines(contract) : ''
    const { judge } = await runQcPass(model, kind, { requirement, profileSummary, contractLines })
    qcReport.rounds = round
    if (kind === 'slide') {
      try {
        const status = await handlePresentationAction('status', {})
        const pages = []
        for (let p = 1; p <= Number(status?.slideCount || 0); p++) {
          const shapes = await handlePresentationAction('shape_list', { index: p })
          pages.push({ page: p, shapes: shapes?.shapes || [] })
        }
        const geo = checkDeckGeometry({ slideWidth: Number(status?.slideWidth || 0), slideHeight: Number(status?.slideHeight || 0), pages })
        qcReport.geometryIssues = geo.issues
      } catch (_) { /* 几何校验非阻塞 */ }
    }
    if (judge?.pass !== false) {
      qcReport.passed = true
      break
    }
    qcReport.passed = false
    qcReport.issues.push(...(Array.isArray(judge?.issues) ? judge.issues : []))
    if (round === maxRounds) break
    const fix = await applyQcFixes(kind, judge)
    qcReport.fixApplied += fix.fixed
    if (fix.fixed === 0) break // 无可自动修复项，避免空转
  }

  // ⑥ 交付（SaveAs2 + 清标记）；未给 savePath 则保留 NdNewFile 强制另存语义
  let delivered = null
  const savePath = String(sourceParams.savePath || '').trim()
  if (savePath) {
    progress(taskId, 94, '正在交付到目标路径…')
    delivered = deliverActiveDocument({ savePath })
  }

  const summary = [
    `已基于模板${templateName ? `「${templateName}」` : ''}生成${created.viaOs ? '（系统打开）' : ''}：${delivered?.ok ? delivered.path : created.path}`,
    `执行：${JSON.stringify(execResult)}`,
    `质检：${qcReport.rounds} 轮，${qcReport.passed === true ? '通过' : qcReport.passed === null ? '未执行' : '达轮次上限，仍有未处理项'}`,
    qcReport.geometryIssues?.length ? `几何警示：${qcReport.geometryIssues.map(i => i.message).join('；')}` : '',
    delivered && !delivered.ok ? `交付失败：${delivered.error}` : ''
  ].filter(Boolean).join('\n')

  progress(taskId, 99, '生成完成')
  return {
    ok: true,
    message: summary,
    path: delivered?.ok ? delivered.path : created.path,
    deliveredPath: delivered?.ok ? delivered.path : null,
    deliveryError: delivered && !delivered.ok ? delivered.error : null,
    qcReport,
    execResult
  }
}

/** 把计划渲染为确认卡文本（两段式第一段的产物） */
function formatPlanForConfirm(kind, plan, requirement) {
  const lines = [`【改写计划】需求：${requirement}`]
  if (kind === 'slide') {
    for (const p of Array.isArray(plan?.pages) ? plan.pages : []) {
      lines.push(`- 第${p?.page || '?'}页 ${p?.action || 'edit'}：${p?.title || (p?.replaces || []).map(r => r?.find).join(' → ').slice(0, 60)}`)
    }
  } else if (kind === 'sheet') {
    for (const b of Array.isArray(plan?.blocks) ? plan.blocks : []) {
      lines.push(`- 数据块 ${b?.startCell}：${(b?.values || []).length} 行`)
    }
    for (const c of Array.isArray(plan?.cellOps) ? plan.cellOps : []) {
      lines.push(`- 单元格 ${c?.cell}`)
    }
  } else {
    for (const op of (Array.isArray(plan?.ops) ? plan.ops : []).slice(0, 12)) {
      lines.push(`- 段落 ${op?.paragraphIndex}：${String(op?.newText || '').slice(0, 40)}…`)
    }
    if ((plan?.appends || []).length) lines.push(`- 新增 ${plan.appends.length} 段`)
  }
  lines.push('', '确认无误请回复「确认执行」，将开始写入新文档。')
  return lines.join('\n')
}

/**
 * 运行「从模板生成」管线（由 generate-from-template capability 调起）。
 * @param {{templateRef?:string, templateId?:string, templatePath?:string, requirement:string,
 *          pageTarget?:number, toneFollow?:boolean, savePath?:string, qcRounds?:number, planOnly?:boolean,
 *          __taskId?:string, __isCancelled?:Function}} params
 */
export async function runTemplateGenerationTask(params = {}) {
  const taskId = params.__taskId || ''
  const isCancelled = () => { try { return !!(params.__isCancelled?.()) } catch (_) { return false } }
  const requirement = String(params.requirement || '').trim()
  if (!requirement) throw new Error('缺少生成需求（requirement）')

  const model = resolveChatModel()
  if (!model) throw new Error('未配置对话模型，请先在设置中配置模型')

  // ① 剖析（未开副本，失败即止）
  progress(taskId, 8, '正在剖析模板…')
  // 附件指代但没有附件可用 → 给出可操作引导（区分于"库中未找到"的误导）
  if (!params.templatePath && /^附件\d*$/.test(String(params.templateRef || '').trim())) {
    throw new Error('指令指向模板附件，但当前没有已上传的附件——请先在对话框输入框点 📎 上传模板文件（面板重开后附件不保留，需重新上传），再发送本指令；或改用模板文件名/完整路径。')
  }
  const resolved = resolveTemplateSource(params)
  if (!resolved.ok) throw new Error(resolved.error || '模板来源无效')
  const kind = normalizeTemplateKind(resolved.kind, resolved.path)
  // 同宿主闸门前置：错配时在 LLM 调用与开副本之前即失败
  const gate = assertSameHostKind(kind)
  if (!gate.ok) throw new Error(gate.error)
  const analysis = await analyzeTemplateFile({ path: resolved.path, kind })
  const profileSummary = summarizeProfile(analysis)

  // ② LLM 计划（仍未开副本）
  progress(taskId, 20, '正在规划改写计划…')
  let docParagraphs = ''
  if (kind === 'doc') {
    const app = window.Application
    if (app?.ActiveDocument) docParagraphs = collectDocParagraphs(app.ActiveDocument)
  }
  const prompt = buildPlanPrompt(kind, {
    profileSummary,
    requirement,
    pageTarget: Number(params.pageTarget) || 0,
    toneFollow: params.toneFollow !== false,
    docParagraphs,
    referenceContext: String(params.referenceContext || '').trim()
  })
  const plan = await llmJson(model, prompt.system, prompt.user)
  if (!plan) throw new Error('改写计划生成失败（模型未返回有效 JSON），请重试或更换模型')
  if (isCancelled()) throw createCancelledError()

  // 两段式（v1.4 单卡）：planOnly=true 出计划+契约卡片模型，确认卡直接渲染缓存
  if (params.planOnly === true || String(params.planOnly) === 'true') {
    // 智能默认（v1.3 #3）+ hash 偏好预填（v1.4 P0b）
    const defaults = smartDefaults(kind, analysis)
    const hashKey = await fileContentHash(resolved.path)
    const prefs = prefsForHash(hashKey)
    if (prefs) Object.assign(defaults, prefs)
    let triggerDocId = ''
    try {
      const app = window.Application
      triggerDocId = String(app?.ActiveDocument?.FullName || app?.ActiveWorkbook?.FullName || app?.ActivePresentation?.FullName || '').trim()
    } catch (_) { triggerDocId = '' }
    const outlineText = formatPlanForConfirm(kind, plan, requirement)
    cachePlan({
      sourceParams: {
        __analysisProfile: analysis?.profile || null,
        referenceContext: String(params.referenceContext || '').trim(),
        templateId: params.templateId,
        templateRef: params.templateRef,
        templatePath: params.templatePath,
        requirement,
        pageTarget: Number(params.pageTarget) || 0,
        toneFollow: params.toneFollow !== false,
        savePath: params.savePath,
        qcRounds: params.qcRounds
      },
      kind,
      plan,
      profileSummary,
      requirement,
      templateName: resolved.name,
      templatePath: resolved.path,
      contractDefaults: defaults,
      hashKey,
      triggerDocId,
      outlineText
    })
    progress(taskId, 60, '计划已生成，等待确认')
    // 单卡模型（v1.4 #2：计划先行的确认卡，由 AIAssistantDialog 渲染）
    const grouped = []
    for (const def of cardAspectsForKind(kind)) {
      let g = grouped.find(x => x.label === def.group)
      if (!g) { g = { label: def.group, items: [] }; grouped.push(g) }
      g.items.push({
        key: flatKeyFor(kind, def.leaf),
        label: def.label,
        hint: def.hint || '',
        checked: defaults[flatKeyFor(kind, def.leaf)] !== false
      })
    }
    return {
      ok: true,
      planOnly: true,
      templateName: resolved.name,
      kind,
      cardModel: {
        templateName: resolved.name,
        kind,
        outlineText,
        groupedAspects: grouped,
        toneFollow: defaults[flatKeyFor(kind, 'copy.toneFollow')] !== false,
        savePath: String(params.savePath || ''),
        profileSummary: profileSummary.slice(0, 1200)
      },
      message: `模板「${resolved.name}」剖析与改写计划已生成，请在下方确认要素后执行。`
    }
  }

  return executePlanStages({ taskId, isCancelled, kind, requirement, profileSummary, plan, sourceParams: { ...params, __analysisProfile: analysis?.profile || null }, templateName: resolved.name })
}

/**
 * 两段式第二段（v1.4 单卡确认）：组装契约 → 过期失效检查 →（大纲/契约变更时）重规划
 * → 执行 → 保存勾选偏好。确认卡与「确认执行」语义共用本入口。
 * @param {{savePath?:string, editedOutline?:string, __taskId?:string, __isCancelled?:Function,
 *          [asp_key:string]: boolean}} params - 含 asp_<kind>_<aspect> 扁平勾选键
 */
export async function runTemplatePlanExecution(params = {}) {
  const cached = peekLastTemplatePlan()
  if (!cached) {
    throw new Error('没有待执行的模板生成计划。请先用「从模板生成文档」生成计划。')
  }
  const taskId = params.__taskId || ''
  const isCancelled = () => { try { return !!(params.__isCancelled?.()) } catch (_) { return false } }

  // 过期失效（v1.4 #5）：确认时活动文档 ≠ 触发时 → 计划作废，防开错副本上下文
  if (cached.triggerDocId) {
    let currentDocId = ''
    try {
      const app = window.Application
      currentDocId = String(app?.ActiveDocument?.FullName || app?.ActiveWorkbook?.FullName || app?.ActivePresentation?.FullName || '').trim()
    } catch (_) { currentDocId = '' }
    if (currentDocId && currentDocId !== cached.triggerDocId) {
      lastPlanCache = null
      throw new Error('活动文档已切换，计划已失效。请基于当前文档重新发起模板生成。')
    }
  }

  // 契约组装（v1.4 #4：扁平键 → 嵌套；缺省回退缓存里的智能默认）
  const contract = assembleContract(params, cached.kind, cached.contractDefaults || {})

  // 保存勾选偏好（hash 记忆，下次同模板预填）
  if (cached.hashKey) {
    const fields = {}
    for (const def of cardAspectsForKind(cached.kind)) {
      const key = flatKeyFor(cached.kind, def.leaf)
      fields[key] = params[key] !== undefined ? params[key] === true || params[key] === 'true'
        : (cached.contractDefaults?.[key] !== false)
    }
    saveAspectPrefsKey(cached.hashKey, fields)
  }

  // 重规划判定：用户改了大纲，或计划影响项勾选与默认不一致
  const editedOutline = String(params.editedOutline || '').trim()
  const outlineEdited = editedOutline && outlineChanged(cached.outlineText, editedOutline)
  let contractChanged = false
  for (const leaf of PLAN_AFFECTING_LEAVES) {
    const key = flatKeyFor(cached.kind, leaf)
    const now = params[key] !== undefined ? (params[key] === true || params[key] === 'true') : (cached.contractDefaults?.[key] !== false)
    const before = cached.contractDefaults?.[key] !== false
    if (now !== before) { contractChanged = true; break }
  }

  let plan = cached.plan
  let profileSummary = cached.profileSummary
  let toneFollow = contract.aspects?.copy?.toneFollow !== false
  if (outlineEdited || contractChanged) {
    progress(taskId, 25, outlineEdited ? '大纲已修改，正在按新大纲重新规划…' : '要素已调整，正在重新规划…')
    const model = resolveChatModel()
    if (!model) throw new Error('未配置对话模型，请先在设置中配置模型')
    let docParagraphs = ''
    if (cached.kind === 'doc') {
      const app = window.Application
      if (app?.ActiveDocument) docParagraphs = collectDocParagraphs(app.ActiveDocument)
    }
    const prompt = buildPlanPrompt(cached.kind, {
      profileSummary,
      requirement: cached.requirement,
      referenceContext: String(cached.sourceParams.referenceContext || '').trim(),
      pageTarget: Number(cached.sourceParams.pageTarget) || 0,
      toneFollow,
      docParagraphs,
      contractLines: contractToPromptLines(contract),
      userOutline: outlineEdited ? editedOutline : ''
    })
    plan = await llmJson(model, prompt.system, prompt.user)
    if (!plan) throw new Error('按新大纲重新规划失败（模型未返回有效 JSON），请重试或更换模型')
    if (isCancelled()) throw createCancelledError()
  }

  const sourceParams = {
    ...cached.sourceParams,
    savePath: String(params.savePath || '').trim() || cached.sourceParams.savePath,
    toneFollow
  }
  const result = await executePlanStages({
    taskId,
    isCancelled,
    kind: cached.kind,
    requirement: cached.requirement,
    profileSummary,
    plan,
    sourceParams,
    templateName: cached.templateName,
    contract
  })
  // 执行成功后清除缓存，防重复执行
  lastPlanCache = null
  return result
}
