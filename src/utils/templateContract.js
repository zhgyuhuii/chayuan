/**
 * 模板生成契约（方案 v1.4 §二/§八/§九）——纯函数模块，零 window/jsapi 依赖，可离线单测。
 *
 * 职责：
 * 1. ASPECT_DEFS：分类型的「要素勾选项」定义（每个勾选项都映射到执行器行为或
 *    质检规则——v1.3 映射表的代码化；无执行行为的项不进卡片）。
 * 2. smartDefaults(analysis)：按剖析画像预填智能默认（v1.3 #3）。
 * 3. 扁平序列化：卡片表单扁平键 asp_<kind>_<aspect> ↔ 嵌套契约对象（v1.4 #4，
 *    buildWpsCapabilityParams 不动，executor 组装）。
 * 4. contractToPromptLines：契约 → 计划/QC prompt 注入行。
 */

export const CONTRACT_SCHEMA_VERSION = '2026-10-template-contract-v1'

/**
 * 勾选项定义。leaf: 'copy.toneFollow' → 契约 aspects.copy.toneFollow。
 * p2Gated 项在执行器就位前不出现在卡片（v1.4 #7）。
 */
export const ASPECT_DEFS = {
  doc: [
    { group: '结构', leaf: 'structure.skeleton', label: '沿用模板章节骨架', hint: '新内容按模板标题树映射成章' },
    { group: '样式', leaf: 'style.fonts', label: '沿用字体字号', hint: '新增段落套用模板字体' },
    { group: '样式', leaf: 'style.spacing', label: '沿用行距与缩进', hint: '新增段落保持模板段落格式' },
    { group: '文案', leaf: 'copy.toneFollow', label: '文风跟随模板', hint: '新文案模仿模板原文语体' },
    { group: '文案', leaf: 'copy.keepFixedCopy', label: '保留固定文案', hint: '页眉页脚/落款等默认不动' },
    { group: '内容', leaf: 'content.sampleAsReference', label: '模板正文作范文参照', hint: '生成时参考模板示例段落的写法', default: false }
  ],
  sheet: [
    { group: '表头', leaf: 'header.text', label: '沿用表头文字与结构', hint: '不改表头行' },
    { group: '数据区', leaf: 'data.colWidths', label: '沿用列宽行高' },
    { group: '数据区', leaf: 'data.merges', label: '沿用合并单元格' },
    { group: '数据区', leaf: 'data.numFormats', label: '沿用数字格式', hint: '日期/货币/百分比等' }
  ],
  slide: [
    { group: '主题', leaf: 'theme.colors', label: '沿用配色方案', hint: '新建页按模板主题色约束' },
    { group: '主题', leaf: 'theme.fonts', label: '沿用字体方案' },
    { group: '版面', leaf: 'layout.backgrounds', label: '沿用背景图元', hint: '复制页继承背景；新建页不带背景并在报告标注' },
    { group: '版面', leaf: 'layout.decorations', label: '装饰元素保持不动', hint: '装饰槽永不改写' },
    { group: '版面', leaf: 'layout.pageRoles', label: '按页型复用版式', hint: '封面/目录/章节/内容页各归其位' },
    { group: '文案', leaf: 'copy.toneFollow', label: '文案风格跟随模板' },
    { group: '文案', leaf: 'copy.keepFixedCopy', label: '保留型文案不动', hint: '口号/页脚等' }
  ]
}

/** P2 门控项（执行器就位前不出现在卡片） */
export const P2_GATED_LEAVES = new Set([
  'doc.structure.tables',
  'sheet.logic.formulaExtend',
  'sheet.header.style'
])

function setLeaf(obj, leaf, value) {
  const parts = String(leaf || '').split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}
    cur = cur[parts[i]]
  }
  cur[parts[parts.length - 1]] = value
}

function getLeaf(obj, leaf) {
  const parts = String(leaf || '').split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}

/** 卡片可展示的勾选项（kind 归一化 + P2 门控过滤） */
export function cardAspectsForKind(kind) {
  const normalized = String(kind || 'doc').toLowerCase()
  const defs = ASPECT_DEFS[normalized] || ASPECT_DEFS.doc
  return defs.filter(d => !P2_GATED_LEAVES.has(`${normalized}.${d.leaf}`))
}

/**
 * 智能默认（v1.3 #3 / v1.4 #8）：基于剖析画像预填。
 * 规则（剖析器置信度就位前的简化版——「有画像即预勾」）：
 * - 模板有正文样例 → toneFollow=true；无样例文本 → false
 * - slide 有背景/图片 → backgrounds=true
 * - doc 无标题树 → skeleton=false
 * - 其余默认 true；sampleAsReference 默认 false
 */
export function smartDefaults(kind, analysis) {
  const profile = analysis?.profile || {}
  const fields = {}
  for (const def of cardAspectsForKind(kind)) {
    let value = def.default !== undefined ? def.default : true
    const leaf = def.leaf
    if (leaf === 'copy.toneFollow' || leaf === 'style.fonts' || leaf === 'style.spacing') {
      const hasSample = kind === 'slide'
        ? (profile.slides || []).some(s => (s.texts || []).length > 0)
        : kind === 'sheet'
          ? (profile.headerPreview || []).length > 0
          : !!String(profile.structure?.sampleText || '').trim()
      value = leaf === 'copy.toneFollow' ? hasSample : value
    }
    if (leaf === 'structure.skeleton') {
      value = kind === 'doc' ? (profile.structure?.headings || []).length > 0 : true
    }
    if (leaf === 'layout.backgrounds' || leaf === 'layout.decorations') {
      value = kind === 'slide' ? (profile.slides || []).some(s => Number(s.pictureCount || 0) > 0) : true
    }
    fields[flatKeyFor(kind, leaf)] = value
  }
  return fields
}

/** 嵌套契约的空骨架（按 kind 只含可勾选叶子） */
export function emptyContractAspects(kind) {
  const aspects = {}
  for (const def of cardAspectsForKind(kind)) setLeaf(aspects, def.leaf, true)
  return aspects
}

export function flatKeyFor(kind, leaf) {
  return `asp_${String(kind || 'doc')}_${String(leaf || '').replace(/\./g, '_')}`
}

/**
 * 扁平表单键 → 嵌套契约（v1.4 #4：executor 组装；未知键忽略，缺省回退智能默认）
 * @param {object} flatParams - 含 asp_* 布尔键 + 可能的其他参数
 * @param {string} kind
 * @param {object} [fallbackDefaults] - 智能默认（缓存里的契约默认）
 */
export function assembleContract(flatParams, kind, fallbackDefaults = {}) {
  const aspects = emptyContractAspects(kind)
  for (const def of cardAspectsForKind(kind)) {
    const key = flatKeyFor(kind, def.leaf)
    let value = flatParams?.[key]
    if (value === undefined || value === null || value === '') {
      value = fallbackDefaults[key] !== undefined ? fallbackDefaults[key] : true
    }
    setLeaf(aspects, def.leaf, value === true || value === 'true')
  }
  return { schemaVersion: CONTRACT_SCHEMA_VERSION, kind, aspects }
}

/**
 * 契约 → prompt 注入行（计划与 QC 共用；v1.3 #2：每个勾选项映射到模型行为指令）
 */
export function contractToPromptLines(contract) {
  const kind = String(contract?.kind || 'doc')
  const lines = ['【模板要素契约（须遵守）】']
  for (const def of cardAspectsForKind(kind)) {
    const on = getLeaf(contract?.aspects, def.leaf) !== false
    if (def.leaf === 'copy.toneFollow') {
      lines.push(on ? '- 文案风格：模仿模板原文语体' : '- 文案风格：按用户需求自由撰写，不必模仿模板语体')
      continue
    }
    if (def.leaf === 'copy.keepFixedCopy') {
      lines.push(on ? '- 固定文案：页眉页脚/落款/口号类原文一律不动' : '- 固定文案：允许按需求改写')
      continue
    }
    if (def.leaf === 'content.sampleAsReference') {
      if (on) lines.push('- 模板示例段落可作为写作参照（仅参照写法，不复制内容）')
      continue
    }
    if (!on) {
      const skipMap = {
        'structure.skeleton': '不要求按模板章节骨架组织内容',
        'style.fonts': '不必模仿模板字体（格式由既有样式承担）',
        'style.spacing': '不必模仿模板行距缩进',
        'header.text': '允许调整表头文字',
        'data.colWidths': '允许调整列宽',
        'data.merges': '允许调整合并单元格',
        'data.numFormats': '允许调整数字格式',
        'theme.colors': '新建页不必受限模板配色',
        'theme.fonts': '新建页不必受限模板字体',
        'layout.backgrounds': '不要求沿用背景图元',
        'layout.decorations': '允许调整装饰元素',
        'layout.pageRoles': '不要求按模板页型组织页面'
      }
      const text = skipMap[def.leaf]
      if (text) lines.push(`- ${text}`)
    }
  }
  if (lines.length <= 1) return ''
  return lines.join('\n')
}

/** 大纲是否被用户改动（去空白比对） */
export function outlineChanged(a, b) {
  const norm = (s) => String(s || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).join('\n')
  return norm(a) !== norm(b)
}
