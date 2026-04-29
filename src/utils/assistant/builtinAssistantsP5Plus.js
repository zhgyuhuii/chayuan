/**
 * builtinAssistantsP5Plus — 第三批 2 个补充助手,凑齐 v2 计划「18 个内置助手」
 *
 * P3 extra 8 + P5 领域 8 + 这里 2 = 18,符合 v2 计划 14.7 节目标。
 *
 * 主题:数据科学 / 个人写作。
 */

const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_ONLY = 'selection-only'

const COMMON_RULES = `
通用约束:
- 严禁解释、寒暄或元描述,直接输出结果
- 保持原文专有名词、数字、引号、链接不变
- 不臆造原文不存在的事实`.trim()

export const P5_PLUS_BUILTIN_ASSISTANTS = Object.freeze([

  /* 1. 数据科学 — 表格描述统计 */
  {
    id: 'analysis.table-describe',
    label: '表格描述统计',
    shortLabel: '表格统计',
    icon: '📈',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['append', 'comment'],
    defaultAction: 'append',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从 Markdown / TSV / 制表符表格生成 N 列描述统计:计数、缺失率、最值、平均、中位数、唯一值数。',
    systemPrompt: `你是数据分析助手。从表格中识别每一列的类型并给出描述统计。

${COMMON_RULES}

特别约束:
- 只输出原表格能算出的指标,不补全缺失值,不假设分布
- 数值列:count / missing% / min / max / mean / median
- 文本列:count / missing% / unique / 最常出现的 3 个值
- 日期列:count / missing% / earliest / latest
- 计算前先识别列类型,不能确定就当文本处理`,
    userPromptTemplate: `从下表生成 Markdown 描述统计表:

| 列名 | 类型 | 计数 | 缺失率 | 关键统计 |
|------|------|------|--------|----------|

数据:
{{input}}`
  },

  /* 2. 个人写作 — 日记/笔记结构化整理 */
  {
    id: 'analysis.personal-journal-tidy',
    label: '日记笔记整理',
    shortLabel: '笔记整理',
    icon: '✨',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['replace', 'append'],
    defaultAction: 'replace',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_ONLY,
    description: '把零散的日记/会议草稿/学习笔记整理成 4 个分组(事实 / 决策 / 待办 / 反思),保留个人语气。',
    systemPrompt: `你是个人写作助手。整理用户散乱的笔记,但保持其本人口吻 — 不要改成正式公文。

${COMMON_RULES}

特别约束:
- 4 组小标题:## 事实 / ## 决策 / ## 待办 / ## 反思
- 每组列出原文中实际存在的内容,不要凑数;某组没东西就写"(本次无)"
- 保留原文的"我""觉得""今天"等个人化用词
- 不删减用户写的细节,只重新分组`,
    userPromptTemplate: `把下面笔记整理成 4 组结构,保持我的口吻:

笔记:
{{input}}`
  }
])

export function mergeP5PlusIntoBuiltins(base = []) {
  const baseList = Array.isArray(base) ? base : []
  const existingIds = new Set(baseList.map(item => String(item?.id || '').trim()))
  const additions = P5_PLUS_BUILTIN_ASSISTANTS
    .filter(item => !existingIds.has(item.id))
    .map(item => JSON.parse(JSON.stringify(item)))
  return [...baseList, ...additions]
}

export default {
  P5_PLUS_BUILTIN_ASSISTANTS,
  mergeP5PlusIntoBuiltins
}
