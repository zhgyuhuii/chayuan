/**
 * Agent-side assistants catalog for MCP (search / get / list domains).
 */
import {
  DOMAIN_MANIFEST,
  DOMAIN_ORDER,
  ASSISTANT_TOTAL,
  DOMAIN_COUNT
} from '../../utils/assistant/assistantDomainManifest.js'
import {
  ensureDomainLoaded,
  getBuiltinAssistants,
  getBuiltinAssistantDefinition
} from '../../utils/assistantRegistry.js'

function summarizeAssistant(a) {
  if (!a) return null
  return {
    id: a.id,
    key: a.key || a.id,
    label: a.shortLabel || a.label || a.id,
    description: String(a.description || '').slice(0, 240),
    group: a.group || '',
    domain: a.domain || a.group || ''
  }
}

export async function handleAssistantsListDomains() {
  const domains = (DOMAIN_ORDER || Object.keys(DOMAIN_MANIFEST)).map(id => ({
    id,
    label: DOMAIN_MANIFEST[id]?.label || id,
    count: Number(DOMAIN_MANIFEST[id]?.count || 0)
  }))
  return {
    domainCount: DOMAIN_COUNT || domains.length,
    assistantTotal: ASSISTANT_TOTAL,
    domains
  }
}

export async function handleAssistantsSearch(params = {}) {
  const query = String(params.query || params.q || '').trim()
  const domain = String(params.domain || '').trim()
  const limit = Math.min(Math.max(Number(params.limit) || 30, 1), 100)

  if (domain) {
    await ensureDomainLoaded(domain)
  }

  const all = getBuiltinAssistants()
  let pool = all
  if (domain) {
    pool = all.filter(a =>
      a.domain === domain ||
      a.group === domain ||
      String(a.group || '').includes(domain)
    )
  }

  if (!query) {
    return {
      mode: 'agent',
      query,
      domain: domain || null,
      total: pool.length,
      items: pool.slice(0, limit).map(summarizeAssistant)
    }
  }

  // 分词逐词匹配：模型习惯发复合查询（"季度总结 工作报告 专业化改写"），
  // 旧实现整串 hay.includes(query) 对复合查询永远 0 命中，模型会误判"目录为空"
  // 而放弃助手链路（2026-09-09 实测）。现按词切分、命中词数计分排序，单词命中
  // 即入选。
  // 词形归一：目录助手名是"换种方式重写/润色优化"式口语短语，模型查询是
  // "总结/校对/写作"式标准词——直接子串常落空。同义词组任一词命中即计分。
  const SYNONYM_GROUPS = [
    ['总结', '纪要', '会议纪要', '摘要', '概括', '精简'],
    ['改写', '重写', '润色', '优化', '专业化', '正式化', '规范化', '文风', '语气'],
    ['校对', '错别字', '错字', '拼写', '语法', '标点'],
    ['翻译', '译'],
    ['扩写', '缩写', '扩充', '精简', '缩短'],
    ['写作', '文案', '创作', '起草', '撰写'],
    ['报告', '汇报', '总结', '纪要'],
    ['批注', '注释', '评论'],
    ['表格', '表', '单元格'],
    ['格式', '排版', '样式', '序号', '编号'],
    ['审查', '审计', '检查', '核查', '审核'],
    ['提取', '抽取', '关键词', '行动项', '结论'],
    ['安全', '保密', '脱密', '涉密']
  ]
  const terms = query.toLowerCase().split(/[\s,，、;；/|]+/).map(t => t.trim()).filter(t => t.length >= 2)
  const expandTerm = (term) => {
    const group = SYNONYM_GROUPS.find(g => g.some(w => term.includes(w) || w.includes(term)))
    return group ? [...new Set([term, ...group])] : [term]
  }
  const scored = []
  for (const a of pool) {
    const hay = [
      a.id,
      a.key,
      a.label,
      a.shortLabel,
      a.description,
      a.group,
      a.domain
    ].map(x => String(x || '').toLowerCase())
    let score = 0
    for (const term of terms) {
      const variants = expandTerm(term)
      if (hay.some(field => variants.some(v => field.includes(v)))) score += 1
    }
    if (score > 0) scored.push({ a, score })
  }
  scored.sort((x, y) => y.score - x.score)
  const hit = scored.map(s => s.a)

  // 空结果时给模型可执行建议（换核心词再搜），而不是让它面对空列表瞎猜
  const suggestion = hit.length === 0
    ? '未命中。建议改用核心动词/名词再搜（如：改写、总结、摘要、润色、校对、翻译、扩写、批注、报告、格式、审查、提取），或先用 assistants_list_domains 浏览领域后按 domain 过滤。'
    : ''
  return {
    mode: 'agent',
    query,
    domain: domain || null,
    total: hit.length,
    ...(suggestion ? { suggestion } : {}),
    items: hit.slice(0, limit).map(summarizeAssistant)
  }
}

export async function handleAssistantsGet(params = {}) {
  const id = String(params.id || params.assistantId || '').trim()
  if (!id) {
    const err = new Error('id required')
    err.code = 'INVALID_PARAMS'
    throw err
  }

  let def = getBuiltinAssistantDefinition(id)
  if (!def && params.domain) {
    await ensureDomainLoaded(String(params.domain))
    def = getBuiltinAssistantDefinition(id)
  }
  if (!def) {
    // Lazy: load all domain packs once (shared promise). Heavy first call, then cached.
    const { ensureDomainPacksLoaded } = await import('../../utils/assistantRegistry.js')
    await ensureDomainPacksLoaded()
    def = getBuiltinAssistantDefinition(id)
  }

  if (!def) {
    const err = new Error(`Assistant not found: ${id}`)
    err.code = 'ASSISTANT_NOT_FOUND'
    throw err
  }

  // Export-oriented payload for external LLM
  return {
    id: def.id,
    key: def.key || def.id,
    label: def.shortLabel || def.label,
    description: def.description || '',
    group: def.group || '',
    systemPrompt: def.systemPrompt || def.system || '',
    userPromptTemplate: def.userPromptTemplate || def.userPrompt || def.prompt || '',
    modelType: def.modelType || 'chat',
    documentAction: def.documentAction || def.defaultAction || '',
    runtimeCapabilities: def.runtimeCapabilities || null,
    export: true
  }
}

export default {
  handleAssistantsListDomains,
  handleAssistantsSearch,
  handleAssistantsGet
}
