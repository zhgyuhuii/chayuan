/**
 * builtinAssistantsExtra — 8 个高价值内置助手种子定义
 *
 * 这些定义**不动 assistantRegistry.js 主文件**(1375 行,改动风险大),
 * 而是独立文件 + 提供 register helper,调用方在 app 初始化时可选合并。
 *
 * 字段保持与 assistantRegistry.js 中 BUILTIN_ASSISTANTS 完全一致:
 *   id / label / shortLabel / icon / group / modelType / defaultModelCategory /
 *   supportsRibbon / defaultDisplayLocations / allowedActions / defaultAction /
 *   defaultOutputFormat / defaultInputSource / description /
 *   systemPrompt / userPromptTemplate
 *
 * 使用:
 *   import { mergeExtraIntoBuiltins } from '@/utils/assistant/builtinAssistantsExtra.js'
 *
 *   // 在 app 启动早期(在拿到 getBuiltinAssistants 调用方之前):
 *   const merged = mergeExtraIntoBuiltins(getBuiltinAssistants())
 *   // 把 merged 当成新的 builtin 列表来用
 *
 * 选择标准:
 *   1. **真实高频** — 用户真正常做(不是为了凑数)
 *   2. **结构化稳定** — prompt 给得够细,LLM 输出可预测
 *   3. **写回路径明确** — 默认动作在 documentActions.js 里已经支持
 *   4. **不与现有重叠** — 已经有 analysis.expand / analysis.abbreviate / analysis.polish 等
 */

const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const INPUT_SOURCE_SELECTION_ONLY      = 'selection-only'
const INPUT_SOURCE_DOCUMENT            = 'document'

/* ─── 通用片段(避免重复) ─────────────────────────────────── */
const COMMON_RULES = `
通用约束:
- 严禁解释、寒暄或元描述,直接输出结果
- 保持原文专有名词、数字、引号、链接不变
- 中英文混排时,使用中文标点;但程序代码、URL、引文内部保留原标点
- 不要"建议性"输出 — 直接给可写回的成稿`.trim()

/* ─── 8 个高价值内置助手 ───────────────────────────────── */

export const EXTRA_BUILTIN_ASSISTANTS = Object.freeze([

  /* 1. 语气调整 */
  {
    id: 'analysis.tone-shift',
    label: '语气调整',
    shortLabel: '语气调整',
    icon: '🎭',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['replace', 'comment', 'insert-after'],
    defaultAction: 'replace',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_ONLY,
    description: '把选中文本调整为指定语气(正式 / 友好 / 学术 / 客户致歉等),保持事实与结构不变。',
    systemPrompt: `你是一位中文写作风格专家。任务是把用户文本调整为指定的语气,但不得增减事实信息、不得改变段落数量、不得新增主张。

${COMMON_RULES}`,
    userPromptTemplate: `请把下面文本调整为更适合当前文档场景的得体语气。

要求:
1. 保持原文事实、人名、数字、链接完全不变
2. 段落数与原文一致;不合并、不拆分段落
3. 仅调整词汇选择、句式起承、敬称礼貌度
4. 不输出说明、不加标题、不加引号
5. 输出长度与原文相近(±15%)

原文:
{{input}}`
  },

  /* 2. 术语通俗化 */
  {
    id: 'analysis.simplify-jargon',
    label: '术语通俗化',
    shortLabel: '通俗化',
    icon: '💡',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['replace', 'comment', 'link-comment', 'insert-after'],
    defaultAction: 'comment',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '识别选中文本中的专业术语,生成"专业术语 → 一句话大白话解释"清单(默认作为批注挂回原文)。',
    systemPrompt: `你是一位面向大众读者的科普编辑。识别文本里的专业术语、行业黑话、缩写、产品名,给每个一句话(≤40 汉字)的通俗解释。

${COMMON_RULES}

特别注意:
- 同一术语只解释一次,即使在原文中多次出现
- 不要解释常识性词(如"互联网""电脑""会议");只解释普通读者可能卡壳的
- 解释里禁止再出现新的术语`,
    userPromptTemplate: `从下面文本中提取专业术语,以严格 JSON 输出:
{"items":[{"term":"","plain":"","sentence":""}]}

字段约束:
- term:原文中术语的精确字面(不要复数化、不要变形)
- plain:≤ 40 汉字的通俗解释
- sentence:term 在原文中第一次出现时的所在句

原文:
{{input}}`
  },

  /* 3. 列表 → 段落 */
  {
    id: 'analysis.bullet-to-paragraph',
    label: '列表转段落',
    shortLabel: '列表→段落',
    icon: '¶',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['replace', 'insert-after'],
    defaultAction: 'replace',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_ONLY,
    description: '把选中的项目符号列表整合为流畅段落(报告/邮件正文常用)。',
    systemPrompt: `你是一位中文公文与商务写作编辑。把项目符号列表合成为一段连贯文字,使用恰当的承接连词("首先""其次""此外""最后"等),但不要新增任何信息。

${COMMON_RULES}`,
    userPromptTemplate: `把下面列表合成为一段连贯文字。

要求:
1. 不增减信息;每条都要保留
2. 不要直接堆砌"首先...其次...再次..."机械连接;按内容轻重排序后选用合适过渡
3. 输出 1 段,长度 ≈ 原文总字数 + 5-10 个连接词
4. 不输出列表符号、编号、标题

列表:
{{input}}`
  },

  /* 4. 段落 → 列表 */
  {
    id: 'analysis.paragraph-to-bullet',
    label: '段落转列表',
    shortLabel: '段落→列表',
    icon: '•',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['replace', 'insert-after'],
    defaultAction: 'replace',
    defaultOutputFormat: 'bullet-list',
    defaultInputSource: INPUT_SOURCE_SELECTION_ONLY,
    description: '把段落拆解为关键要点列表,每条 ≤ 30 字。',
    systemPrompt: `你是一位会议纪要专家。把段落拆解为可扫读的关键要点。每条独立、自足、不重复。

${COMMON_RULES}`,
    userPromptTemplate: `把下面段落转成项目符号列表。

要求:
1. 每条 ≤ 30 汉字
2. 提取的是事实/动作/数字,不是修辞
3. 同一信息不重复
4. 列表条数控制在 3-8 条;若原文信息密度高,允许最多 12 条
5. 每条以"-"开头(不要别的符号)
6. 不输出标题、不输出"要点:"等前缀

段落:
{{input}}`
  },

  /* 5. 会议纪要 */
  {
    id: 'analysis.meeting-minutes',
    label: '会议纪要',
    shortLabel: '纪要',
    icon: '📋',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['replace', 'append', 'insert-after'],
    defaultAction: 'append',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从会议记录或讨论文本中提炼标准纪要(主题/决议/待办/责任人/截止日)。',
    systemPrompt: `你是一位资深秘书。从会议记录中提炼"决议-待办-责任人-截止日"四要素纪要。事实归纪要,推断归"待确认"区,严禁臆造。

${COMMON_RULES}

特别约束:
- 只用原文出现的人名(全名或职位皆可)
- 没明确截止日 → 写"未明确"
- 没明确责任人 → 写"待指派"
- 不输出会议无关的情绪化描述`,
    userPromptTemplate: `从下面会议记录中提炼纪要,严格按以下 Markdown 模板:

# 会议纪要

## 主题
(一句话)

## 决议
- (一条一行,事实陈述)

## 待办事项
| 待办 | 责任人 | 截止日 |
|------|--------|--------|
| ... | ... | ... |

## 待确认事项
- (原文中模糊或互相冲突的点)

会议记录:
{{input}}`
  },

  /* 6. 引文核查 */
  {
    id: 'analysis.cite-pull',
    label: '引文核查',
    shortLabel: '引文核查',
    icon: '❝',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment'],
    defaultAction: 'comment',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '识别全文中的疑似未标注引文(直接引用、文献引用、数字断言),作为批注挂回原文。',
    systemPrompt: `你是一位学术编辑。识别文中可能需要标注来源但未标注的语句:
- 引号内的他人原话
- 直接引用文献内容(如"《XX 报告》指出...")但缺出处
- 强断言数字(如"占 87%""增长 3.2 倍")无支持
不要 flag 常识性陈述、作者本人观点、概念性定义。

${COMMON_RULES}`,
    userPromptTemplate: `严格输出 JSON:
{"flags":[{"text":"","kind":"quote|stat|reference","reason":"","sentence":"","prefix":"","suffix":""}]}

字段约束:
- text:原文连续片段
- kind:三选一
- reason:≤ 30 字说明为什么需要标注
- sentence:含该 flag 的原文完整句
- prefix/suffix:前后各 12 个原文字符,不得改写

原文:
{{input}}`
  },

  /* 7. ASCII 表格 → Markdown 表格 */
  {
    id: 'analysis.ascii-to-md-table',
    label: '表格转 Markdown',
    shortLabel: '表格→MD',
    icon: '⊞',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['replace', 'insert-after'],
    defaultAction: 'replace',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_ONLY,
    description: '把粘贴的 ASCII / 制表符 / 空格对齐表格规整为标准 Markdown 表格。',
    systemPrompt: `你是一位文档格式工程师。把任何形式的伪表格(ASCII 边框、Tab/空格对齐、CSV 等)规整为标准 GitHub-flavored Markdown 表格。

${COMMON_RULES}

特别约束:
- 不修改单元格内容(除去前后空格)
- 表头检测:第一行通常是表头;若不确定,把第一行视为表头
- 数字列右对齐(:---:),其余左对齐(---)
- 不要输出 |---| 之外的额外分隔线`,
    userPromptTemplate: `把下面文本中的表格转成 Markdown 表格。如果有多个表格,顺序输出,中间空一行。

输入:
{{input}}`
  },

  /* 8. 时间线提取 */
  {
    id: 'analysis.timeline-extract',
    label: '时间线提取',
    shortLabel: '时间线',
    icon: '🕒',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'append', 'insert-after'],
    defaultAction: 'append',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把叙述性文本中的事件按时间顺序抽出为清单(年份/月份/日期 + 事件)。',
    systemPrompt: `你是一位历史/事件梳理专家。从文本中识别带时间锚点的事件,按时间正序排列。

${COMMON_RULES}

特别约束:
- 时间锚点必须是原文出现的(年/月/日/季度/朝代/具体年月日)
- 模糊时间("不久之后""稍后")→ 不收入
- 同一时间多个事件 → 按原文出现顺序`,
    userPromptTemplate: `从下面文本提取事件时间线,严格按 Markdown 输出:

| 时间 | 事件 |
|------|------|
| ... | ... |

要求:
1. 按时间正序(由早到晚)
2. "时间"必须是原文中的字面表述
3. "事件"≤ 30 汉字,只描述发生了什么
4. 一行一事件;同一时间多事件就分多行
5. 没明确时间锚点的内容,不要凑数

原文:
{{input}}`
  }
])

/* ─── helper: 合并到现有 builtins ──────────────────────── */

/**
 * 把 EXTRA_BUILTIN_ASSISTANTS 合并到 base 列表(通常来自 getBuiltinAssistants())。
 * - 同 id 已存在 → 跳过(尊重原项目优先)
 * - 新 id → 追加到末尾
 *
 * 不会修改 base 数组本身,返回新数组。
 */
export function mergeExtraIntoBuiltins(base = []) {
  const baseList = Array.isArray(base) ? base : []
  const existingIds = new Set(baseList.map(item => String(item?.id || '').trim()))
  const additions = EXTRA_BUILTIN_ASSISTANTS
    .filter(item => !existingIds.has(item.id))
    .map(item => JSON.parse(JSON.stringify(item)))   // deep clone,避免外部 mutation
  return [...baseList, ...additions]
}

/**
 * 仅返回新增的部分(通常用于 Settings 中显示「新可用助手」)。
 */
export function listExtraOnly(base = []) {
  const baseList = Array.isArray(base) ? base : []
  const existingIds = new Set(baseList.map(item => String(item?.id || '').trim()))
  return EXTRA_BUILTIN_ASSISTANTS
    .filter(item => !existingIds.has(item.id))
    .map(item => JSON.parse(JSON.stringify(item)))
}

export default {
  EXTRA_BUILTIN_ASSISTANTS,
  mergeExtraIntoBuiltins,
  listExtraOnly
}
