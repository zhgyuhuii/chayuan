/**
 * workflowTemplates — 8 个内置工作流模板(W5.1)
 *
 * 模板使用 normalizeWorkflow 归一化前的精简 JSON 格式;
 * 通过 mergeWorkflowTemplates(base) 与 workflowStore.getWorkflows() 合并。
 *
 * 8 模板覆盖典型场景:
 *   1. 合同审查流水线(法务)
 *   2. 会议纪要 + 待办派发(团队协作)
 *   3. 学术论文整理(学术)
 *   4. 批量结构化抽取(批处理)
 *   5. 多模型 A/B(进化辅助)
 *   6. 翻译质检(双语)
 *   7. 数据清洗 + 报告(数据分析)
 *   8. 合规预审(政府公文)
 */

const TEMPLATES = Object.freeze([
  /* 1. 合同审查 */
  {
    id: 'tmpl.contract-audit',
    name: '合同审查流水线',
    description: '抽条款 → 4 维并行审 → 合并报告 → 写回批注',
    category: '法务',
    version: '1.0.0',
    tags: ['合同', '法务', '风险'],
    estimatedLLMCalls: 5,
    nodes: [
      { id: 'start', type: '__start__' },
      { id: 'extract', type: 'assistant-invoke', config: { assistantId: 'analysis.legal-clause-audit' } },
      { id: 'parallel', type: 'parallel', config: { waitMode: 'all', branches: [['judge1'], ['judge2'], ['judge3']] } },
      { id: 'judge1', type: 'assistant-invoke', config: { assistantId: 'analysis.cite-pull' } },
      { id: 'judge2', type: 'assistant-invoke', config: { assistantId: 'analysis.financial-consistency' } },
      { id: 'judge3', type: 'chat-once', config: { userPrompt: '基于条款提炼 5 个最高风险点,JSON 输出', forceJson: true } },
      { id: 'merge', type: 'content-merge', config: { strategy: 'structured-report' } },
      { id: 'confirm', type: 'human-confirm', config: { title: '审查报告确认', timeoutMs: 600000 } },
      { id: 'writeback', type: 'wps-capability', config: { capability: 'document.appendComment' } },
      { id: 'end', type: '__end__' }
    ],
    edges: [
      { source: 'start', target: 'extract' },
      { source: 'extract', target: 'parallel' },
      { source: 'parallel', target: 'merge' },
      { source: 'merge', target: 'confirm' },
      { source: 'confirm', target: 'writeback', label: 'approve' },
      { source: 'confirm', target: 'end', label: 'reject' },
      { source: 'writeback', target: 'end' }
    ]
  },

  /* 2. 会议纪要 */
  {
    id: 'tmpl.meeting-minutes',
    name: '会议纪要 + 待办派发',
    description: '转写 → 提炼要点 → 出待办 → 写回',
    category: '团队协作',
    version: '1.0.0',
    tags: ['会议', '纪要', '待办'],
    estimatedLLMCalls: 3,
    nodes: [
      { id: 'start', type: '__start__' },
      { id: 'minutes', type: 'assistant-invoke', config: { assistantId: 'analysis.meeting-minutes' } },
      { id: 'extract-todos', type: 'chat-once', config: { userPrompt: '从纪要中抽取待办,JSON 数组,每项 { task, owner, dueDate }', forceJson: true } },
      { id: 'append', type: 'wps-capability', config: { capability: 'document.append' } },
      { id: 'end', type: '__end__' }
    ],
    edges: [
      { source: 'start', target: 'minutes' },
      { source: 'minutes', target: 'extract-todos' },
      { source: 'extract-todos', target: 'append' },
      { source: 'append', target: 'end' }
    ]
  },

  /* 3. 学术论文整理 */
  {
    id: 'tmpl.academic-organize',
    name: '学术论文整理',
    description: '摘要 + 关键术语 + 引文核查 + 中英对照术语表',
    category: '学术',
    version: '1.0.0',
    tags: ['学术', '论文', '术语'],
    estimatedLLMCalls: 4,
    nodes: [
      { id: 'start', type: '__start__' },
      { id: 'parallel', type: 'parallel', config: { waitMode: 'all', branches: [['abstract'], ['terms'], ['cite'], ['bilingual']] } },
      { id: 'abstract', type: 'assistant-invoke', config: { assistantId: 'analysis.academic-abstract' } },
      { id: 'terms', type: 'assistant-invoke', config: { assistantId: 'analysis.simplify-jargon' } },
      { id: 'cite', type: 'assistant-invoke', config: { assistantId: 'analysis.cite-pull' } },
      { id: 'bilingual', type: 'assistant-invoke', config: { assistantId: 'analysis.bilingual-glossary' } },
      { id: 'merge', type: 'content-merge' },
      { id: 'append', type: 'wps-capability', config: { capability: 'document.append' } },
      { id: 'end', type: '__end__' }
    ],
    edges: [
      { source: 'start', target: 'parallel' },
      { source: 'parallel', target: 'merge' },
      { source: 'merge', target: 'append' },
      { source: 'append', target: 'end' }
    ]
  },

  /* 4. 批量结构化抽取 */
  {
    id: 'tmpl.batch-extract',
    name: '批量结构化抽取',
    description: '遍历段落 → 每段抽 JSON → 合并入表',
    category: '数据',
    version: '1.0.0',
    tags: ['批处理', 'JSON', '抽取'],
    estimatedLLMCalls: 10,
    nodes: [
      { id: 'start', type: '__start__' },
      { id: 'paragraphs', type: 'wps-capability', config: { capability: 'document.getParagraphs' } },
      { id: 'loop', type: 'loop', config: {
          mode: 'for-each',
          itemsExpr: '{{nodes.paragraphs.output}}',
          childNodeIds: ['extract', 'validate'],
          maxConcurrent: 4,
          stopOnError: false
        }
      },
      { id: 'extract', type: 'chat-once', config: { userPrompt: '从段落抽出关键字段,JSON', forceJson: true } },
      { id: 'validate', type: 'json-extract' },
      { id: 'aggregate', type: 'content-merge' },
      { id: 'table', type: 'wps-capability', config: { capability: 'document.appendTable' } },
      { id: 'end', type: '__end__' }
    ],
    edges: [
      { source: 'start', target: 'paragraphs' },
      { source: 'paragraphs', target: 'loop' },
      { source: 'loop', target: 'aggregate' },
      { source: 'aggregate', target: 'table' },
      { source: 'table', target: 'end' }
    ]
  },

  /* 5. 多模型 A/B(进化辅助) */
  {
    id: 'tmpl.multi-model-ab',
    name: '多模型 A/B 比对',
    description: '同一 prompt 跑 3 个模型 → judge 排名 → 选最佳',
    category: '进化辅助',
    version: '1.0.0',
    tags: ['模型', '评测', 'A/B'],
    estimatedLLMCalls: 4,
    nodes: [
      { id: 'start', type: '__start__' },
      { id: 'parallel', type: 'parallel', config: { waitMode: 'all', branches: [['m1'], ['m2'], ['m3']] } },
      { id: 'm1', type: 'chat-once', config: { providerId: 'openai', modelId: 'gpt-4o-mini' } },
      { id: 'm2', type: 'chat-once', config: { providerId: 'anthropic', modelId: 'claude-3-5-sonnet' } },
      { id: 'm3', type: 'chat-once', config: { providerId: 'aliyun-bailian', modelId: 'qwen-plus' } },
      { id: 'judge', type: 'chat-once', config: {
          userPrompt: '以下 3 个模型输出哪个最好?给排名+理由,JSON',
          forceJson: true,
          providerId: 'openai', modelId: 'gpt-4o'
        }
      },
      { id: 'pick', type: 'content-merge', config: { strategy: 'best-by-rank' } },
      { id: 'end', type: '__end__' }
    ],
    edges: [
      { source: 'start', target: 'parallel' },
      { source: 'parallel', target: 'judge' },
      { source: 'judge', target: 'pick' },
      { source: 'pick', target: 'end' }
    ]
  },

  /* 6. 翻译质检 */
  {
    id: 'tmpl.translation-qa',
    name: '翻译质检',
    description: '翻译 → 反向翻译 → 比对一致性 → 标注差异',
    category: '双语',
    version: '1.0.0',
    tags: ['翻译', '质检', '回译'],
    estimatedLLMCalls: 3,
    nodes: [
      { id: 'start', type: '__start__' },
      { id: 'forward', type: 'assistant-invoke', config: { assistantId: 'translate' } },
      { id: 'backward', type: 'chat-once', config: { userPrompt: '把以下英文翻译回中文(原文): {{nodes.forward.output}}' } },
      { id: 'compare', type: 'chat-once', config: { userPrompt: '比对原文和回译,JSON 输出每段差异', forceJson: true } },
      { id: 'highlight', type: 'wps-capability', config: { capability: 'document.appendComment' } },
      { id: 'end', type: '__end__' }
    ],
    edges: [
      { source: 'start', target: 'forward' },
      { source: 'forward', target: 'backward' },
      { source: 'backward', target: 'compare' },
      { source: 'compare', target: 'highlight' },
      { source: 'highlight', target: 'end' }
    ]
  },

  /* 7. 数据清洗 + 报告 */
  {
    id: 'tmpl.data-clean-report',
    name: '数据清洗 + 报告',
    description: '表格统计 → 异常检测 → 报告生成',
    category: '数据',
    version: '1.0.0',
    tags: ['数据', '清洗', '报告'],
    estimatedLLMCalls: 2,
    nodes: [
      { id: 'start', type: '__start__' },
      { id: 'stat', type: 'assistant-invoke', config: { assistantId: 'analysis.table-describe' } },
      { id: 'audit', type: 'assistant-invoke', config: { assistantId: 'analysis.financial-consistency' } },
      { id: 'merge', type: 'content-merge' },
      { id: 'append', type: 'wps-capability', config: { capability: 'document.append' } },
      { id: 'end', type: '__end__' }
    ],
    edges: [
      { source: 'start', target: 'stat' },
      { source: 'stat', target: 'audit' },
      { source: 'audit', target: 'merge' },
      { source: 'merge', target: 'append' },
      { source: 'append', target: 'end' }
    ]
  },

  /* 8. 合规预审 */
  {
    id: 'tmpl.compliance-precheck',
    name: '公文合规预审',
    description: '公文格式检查 → 保密关键字检测 → 综合评分',
    category: '政府公文',
    version: '1.0.0',
    tags: ['公文', '合规', '保密'],
    estimatedLLMCalls: 3,
    nodes: [
      { id: 'start', type: '__start__' },
      { id: 'parallel', type: 'parallel', config: { waitMode: 'all', branches: [['format'], ['secret']] } },
      { id: 'format', type: 'assistant-invoke', config: { assistantId: 'analysis.gov-doc-format' } },
      { id: 'secret', type: 'assistant-invoke', config: { assistantId: 'analysis.secret-keyword-extract' } },
      { id: 'score', type: 'chat-once', config: { userPrompt: '综合两项检查给整体合规分(0-100)+ 风险等级,JSON', forceJson: true } },
      { id: 'comment', type: 'wps-capability', config: { capability: 'document.appendComment' } },
      { id: 'end', type: '__end__' }
    ],
    edges: [
      { source: 'start', target: 'parallel' },
      { source: 'parallel', target: 'score' },
      { source: 'score', target: 'comment' },
      { source: 'comment', target: 'end' }
    ]
  }
])

export function listTemplates() {
  return TEMPLATES.map(t => JSON.parse(JSON.stringify(t)))
}

export function getTemplate(id) {
  return TEMPLATES.find(t => t.id === id)
    ? JSON.parse(JSON.stringify(TEMPLATES.find(t => t.id === id)))
    : null
}

export function listTemplateCategories() {
  const set = new Set(TEMPLATES.map(t => t.category))
  return Array.from(set)
}

/**
 * 把模板列表合并入用户工作流列表(避免覆盖用户自己的同 id)。
 */
export function mergeWorkflowTemplates(userWorkflows = []) {
  const userIds = new Set(userWorkflows.map(w => w.id))
  const additions = TEMPLATES
    .filter(t => !userIds.has(t.id))
    .map(t => JSON.parse(JSON.stringify(t)))
  return [...userWorkflows, ...additions]
}

export default {
  listTemplates,
  getTemplate,
  listTemplateCategories,
  mergeWorkflowTemplates
}
