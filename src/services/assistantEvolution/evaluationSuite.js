export const DEFAULT_EVALUATION_CASES = [
  {
    id: 'chat-basic-helpful',
    category: 'chat',
    input: '请用三句话解释 Cursor 是什么。',
    expectedSignals: ['准确', '简洁', '不改写文档']
  },
  {
    id: 'document-empty-creation',
    category: 'document-write',
    input: '请帮我写一份 Cursor 使用教程。',
    expectedSignals: ['空文档可生成', '消息中展示', '写回需确认']
  },
  {
    id: 'long-document-count',
    category: 'exact-tool',
    input: '统计下面成语有多少个：画蛇添足、亡羊补牢、画蛇添足',
    expectedSignals: ['使用本地确定性统计', '总数为3', '去重为2']
  },
  {
    id: 'tool-call-confirm',
    category: 'tool-call',
    input: '把这段内容插入到文档中：测试',
    expectedSignals: ['识别写回工具', '高风险动作要求确认']
  }
]

function normalizeCase(testCase = {}) {
  return {
    id: String(testCase.id || `case_${Math.random().toString(36).slice(2, 8)}`).trim(),
    category: String(testCase.category || 'chat').trim(),
    input: String(testCase.input || '').trim(),
    expectedSignals: Array.isArray(testCase.expectedSignals)
      ? testCase.expectedSignals.map(item => String(item || '').trim()).filter(Boolean)
      : [],
    metadata: testCase.metadata && typeof testCase.metadata === 'object' ? { ...testCase.metadata } : {}
  }
}

export function buildEvaluationSuite(cases = DEFAULT_EVALUATION_CASES, options = {}) {
  const normalizedCases = (Array.isArray(cases) ? cases : DEFAULT_EVALUATION_CASES)
    .map(normalizeCase)
    .filter(item => item.id && item.input)
  return {
    id: String(options.id || `suite_${Date.now()}`).trim(),
    name: String(options.name || '助手进化固定评测集').trim(),
    createdAt: options.createdAt || new Date().toISOString(),
    cases: normalizedCases,
    summary: {
      total: normalizedCases.length,
      categories: Array.from(new Set(normalizedCases.map(item => item.category)))
    }
  }
}

export function selectEvaluationCases(suite = buildEvaluationSuite(), options = {}) {
  const categories = Array.isArray(options.categories) ? new Set(options.categories) : null
  const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 0
  let cases = Array.isArray(suite.cases) ? suite.cases : []
  if (categories?.size) {
    cases = cases.filter(item => categories.has(item.category))
  }
  if (limit > 0) {
    cases = cases.slice(0, limit)
  }
  return cases
}

export function scoreEvaluationOutput(output = '', testCase = {}) {
  const text = String(output || '')
  const signals = Array.isArray(testCase.expectedSignals) ? testCase.expectedSignals : []
  const matchedSignals = signals.filter(signal => text.includes(signal))
  return {
    caseId: testCase.id,
    score: signals.length > 0 ? matchedSignals.length / signals.length : 0,
    matchedSignals,
    missingSignals: signals.filter(signal => !matchedSignals.includes(signal))
  }
}

export default {
  DEFAULT_EVALUATION_CASES,
  buildEvaluationSuite,
  selectEvaluationCases,
  scoreEvaluationOutput
}
