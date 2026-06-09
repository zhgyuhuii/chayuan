/**
 * builtinAssistantsData — 「数据/报表/BI」领域助手包(批10)
 * 分析/说明类批注、生成类插入、核查类批注。约束:只用给定数据,涉及计算先列原文数字,不臆造结论。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'data'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.25, ...extra
})

export const DATA_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.data-insight', label: '数据洞察提取', shortLabel: '数据洞察', icon: '💡',
    tags: ['数据', '分析', '洞察'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '从数据/表格中提炼关键洞察:主要发现、异常、对比与变化,只基于原文数字,不过度解读。',
    systemPrompt: '你是一位数据分析师,从数据提炼关键洞察。只基于给定数字(计算先列原文),区分"数据显示"与"推测",不臆造因果。',
    userPromptTemplate: `请从下面数据提炼关键洞察:主要发现(3-5条)、显著对比或变化、异常点。每条标明"数据依据";推测性结论单独标注。计算先列原文数字。\n数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.data-chart-desc', label: '图表说明生成', shortLabel: '图表说明', icon: '📊',
    tags: ['数据', '生成', '图表'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '为图表/数据生成规范说明文字:图表反映什么、主要趋势、关键数值,客观不夸大。',
    systemPrompt: '你是一位报告撰写者,为图表写客观说明。数值照原文,只描述图表反映的事实,不外推。',
    userPromptTemplate: `请为下面图表/数据写说明文字:这张图反映什么、主要趋势或结构、关键数值(照原文)。客观、适合放报告正文。\n图表/数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.data-trend', label: '趋势分析描述', shortLabel: '趋势分析', icon: '📈',
    tags: ['数据', '分析', '趋势'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '把时间序列数据描述成趋势分析:整体走向、拐点、增减幅度、周期性,数字照原文。',
    systemPrompt: '你是一位数据分析师,描述时间序列趋势。增减幅度先列原文数字再算,拐点基于数据,不预测未给出的未来值。',
    userPromptTemplate: `请把下面时间序列数据描述成趋势分析:整体走向、明显拐点、增减幅度(先列原文数字)、是否有周期/季节性。不预测未给数据。\n数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.data-sql-explain', label: 'SQL语义解释', shortLabel: 'SQL解释', icon: '🗄️',
    tags: ['数据', '分析', 'SQL'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.2,
    description: '把 SQL 语句翻译成自然语言说明它在查什么、怎么算的,帮非技术同事看懂。',
    systemPrompt: '你是一位数据工程师,把 SQL 翻译成通俗自然语言。准确说明查询逻辑,不改 SQL,涉及性能/风险点可提示。',
    userPromptTemplate: `请把下面 SQL 用自然语言解释:它在查什么、涉及哪些表与条件、如何聚合/排序、结果是什么。再补一句潜在注意点(如全表扫描风险)。\nSQL:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.data-anomaly', label: '异常值提示', shortLabel: '异常值提示', icon: '🚨',
    tags: ['数据', '核查', '异常'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '从数据中标出疑似异常值/离群点/突变,说明异常在哪、偏离程度,提示需核实。',
    systemPrompt: '你是一位数据质量分析师,标出疑似异常并说明。只基于给定数据判断,异常标"疑似、待核实",不武断认定错误。',
    userPromptTemplate: `请从下面数据标出疑似异常:离群值、突增突降、不合常理的值、缺失或0值异常。每条:涉及数据\`原文片段\`、为何疑似异常、建议核实方向。\n数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.data-dictionary', label: '数据字典生成', shortLabel: '数据字典', icon: '📒',
    tags: ['数据', '生成', '字典'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'insert', temperature: 0.2,
    description: '为表/字段生成数据字典:字段名、类型、含义、取值范围、示例,便于团队理解口径。',
    systemPrompt: '你是一位数据治理工程师,生成清晰的数据字典。字段名类型照原文,含义基于给定信息,不臆造取值。',
    userPromptTemplate: `请为下面表/字段生成数据字典,表格:字段名 | 类型 | 含义 | 取值范围/枚举 | 示例 | 备注。含义不明的标"待确认"。\n表/字段:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.data-kpi', label: 'KPI解读', shortLabel: 'KPI解读', icon: '🎯',
    tags: ['数据', '分析', 'KPI'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '解读 KPI 数据:达成情况、与目标/同环比差距、可能动因、需关注的指标,数字照原文。',
    systemPrompt: '你是一位运营分析师,解读 KPI。达成率/差距先列原文数字再算,动因只在数据或上下文有线索时给,不臆测。',
    userPromptTemplate: `请解读下面 KPI 数据:各指标达成情况(对目标)、同比环比变化、表现好/差的指标、可能动因(有线索才给)、需重点关注项。计算先列原文数字。\nKPI数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.data-pivot', label: '透视分析建议', shortLabel: '透视分析', icon: '🔢',
    tags: ['数据', '分析', '透视'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '根据数据结构建议有价值的透视/交叉分析维度与指标,并说明能看出什么。',
    systemPrompt: '你是一位 BI 分析师,基于数据结构建议透视分析角度。基于给定字段,建议合理维度与指标组合,不臆造数据结论。',
    userPromptTemplate: `请根据下面数据结构建议透视分析:推荐的行/列维度、值指标与聚合方式、每个组合能回答什么业务问题、值得优先看的几个。\n数据结构/样例:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.data-report-annotate', label: '报表注释', shortLabel: '报表注释', icon: '🖊️',
    tags: ['数据', '生成', '注释'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '为报表关键数字加注释:口径说明、变化原因占位、需注意的脚注,便于阅读者理解。',
    systemPrompt: '你是一位报表编制者,为关键数字加必要注释。口径基于给定信息,原因处无线索则用【待说明】,不编造。',
    userPromptTemplate: `请为下面报表加注释:对关键指标补口径说明、异常波动加原因注释(无线索用【待说明】)、需提醒读者的脚注。\n报表:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.data-survey-summary', label: '调研数据汇总', shortLabel: '调研汇总', icon: '📋',
    tags: ['数据', '摘要', '调研'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '把问卷/调研数据汇总成结论:各题分布、主要发现、人群差异、开放题归类,数字照原文。',
    systemPrompt: '你是一位用户研究员,汇总调研数据。占比照原文(计算先列数字),开放题客观归类,不夸大样本代表性。',
    userPromptTemplate: `请把下面调研数据汇总:各题主要分布(数字照原文)、关键发现、明显的人群差异、开放题主题归类。提示样本量与代表性。\n调研数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.data-dashboard-metrics', label: '看板指标说明', shortLabel: '看板指标', icon: '📺',
    tags: ['数据', '生成', '看板'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '为数据看板的每个指标写定义说明:口径、计算方式、刷新频率、看什么,统一团队理解。',
    systemPrompt: '你是一位 BI 工程师,为看板指标写定义。计算口径基于给定信息,不臆造公式,不明确处标"待确认"。',
    userPromptTemplate: `请为下面看板指标写说明:指标名、业务含义、计算口径/公式、数据来源与刷新频率、关注阈值。不明确处标"待确认"。\n看板指标:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.data-quality-check', label: '数据质量核查', shortLabel: '数据质量核查', icon: '🔍',
    tags: ['数据', '核查', '质量'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '核查数据质量问题:缺失、重复、格式不一致、超范围、逻辑矛盾,逐处定位提示。',
    systemPrompt: '你是一位数据质量分析师,核查数据质量问题。涉及具体值的引原文逐字、反引号包裹;只标真问题。',
    userPromptTemplate: `请核查下面数据的质量问题:缺失值、重复记录、格式不一致(日期/单位)、超合理范围、字段间逻辑矛盾。\n## 质量问题 (若无写"未发现明显问题")\n- 涉及数据:\`原文逐字片段\`\n- 问题类型:\n- 建议:\n数据:\n---\n{{input}}\n---` })
])

export function mergeDataIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...DATA_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { DATA_BUILTIN_ASSISTANTS, mergeDataIntoBuiltins }
