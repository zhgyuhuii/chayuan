/**
 * builtinAssistantsAcademic — 「高校/学术科研」领域助手包(批7)
 * 改写/生成类默认插入或替换、核查/提取类批注。约束:不编造数据/文献/引用,润色不改变研究结论与事实。
 */
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'academic'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, defaultOutputFormat: 'markdown', temperature: 0.3, ...extra
})

export const ACADEMIC_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.acad-paper-polish', label: '论文润色', shortLabel: '论文润色', icon: '📄',
    tags: ['学术', '改写', '论文'], allowedActions: ['replace', 'comment', 'insert', 'none'], defaultAction: 'comment',
    description: '提升论文语言的学术性、准确性与流畅度,保留研究事实、数据、结论不变,不堆砌空话。',
    systemPrompt: '你是一位学术编辑,润色论文语言。保持研究事实、数据、术语、结论完全不变,只改表达的准确与流畅,符合学术规范,不添加新主张。',
    userPromptTemplate: `请润色下面论文段落:提升学术性与流畅度、消除歧义与冗余、规范术语,但不改变事实数据和结论、不增加未给出的内容。给出润色后版本。\n{{input}}` }),
  base({ id: 'analysis.acad-litreview', label: '文献综述框架', shortLabel: '文献综述框架', icon: '📚',
    tags: ['学术', '生成', '综述'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '根据主题和已有材料搭文献综述框架:研究脉络、流派对比、争议点、空白与本研究定位。',
    systemPrompt: '你是一位研究者,搭建文献综述框架。只基于给定材料组织脉络,不编造文献或引用,需引文处标【待补文献】。',
    userPromptTemplate: `请根据下面主题与材料搭文献综述框架:研究背景与脉络、主要观点/流派及对比、存在的争议、研究空白、本研究的定位。需引用处标【待补文献】,不编造参考文献。\n主题与材料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.acad-abstract-improve', label: '摘要优化', shortLabel: '摘要优化', icon: '🔖',
    tags: ['学术', '改写', '摘要'], allowedActions: ['replace', 'comment', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '把论文摘要改写成结构清晰(背景-方法-结果-结论)、信息密度高的规范学术摘要。',
    systemPrompt: '你是一位学术编辑,优化论文摘要。保持研究事实数据不变,按背景-目的-方法-结果-结论组织,精炼、信息密度高、无空话。',
    userPromptTemplate: `请把下面摘要优化成规范学术摘要:结构清晰(背景/目的→方法→主要结果含关键数据→结论)、精炼、无冗余套话。数据照原文。给出优化版。\n{{input}}` }),
  base({ id: 'analysis.acad-references-format', label: '参考文献格式化', shortLabel: '参考文献格式化', icon: '📑',
    tags: ['学术', '改写', '文献'], allowedActions: ['replace', 'comment', 'append', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '把参考文献条目统一成指定格式(GB/T 7714、APA 等),只调格式不改文献内容。',
    systemPrompt: '你是一位学术编辑,把参考文献统一格式。只调整格式与标点顺序,不改作者、标题、年份等内容;信息不全的条目标出缺项,不臆补。',
    userPromptTemplate: `请把下面参考文献统一为指定格式(未指定则默认 GB/T 7714):逐条规范作者、题名、来源、年份、页码的格式与标点。只改格式不改内容,缺项标【缺:…】。\n参考文献(及目标格式):\n---\n{{input}}\n---` }),
  base({ id: 'analysis.acad-methodology', label: '研究方法描述', shortLabel: '研究方法描述', icon: '🔬',
    tags: ['学术', '生成', '方法'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '把研究设计要点写成规范的方法部分:对象、材料、流程、变量、分析方法,可复现表述。',
    systemPrompt: '你是一位研究者,撰写规范、可复现的研究方法部分。只依据给定设计,不编造样本量或统计方法。',
    userPromptTemplate: `请把下面研究设计写成方法部分:研究对象与抽样、材料/工具、实验或调查流程、变量定义、数据分析方法。表述规范、可复现,缺信息标【待补充】。\n研究设计:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.acad-reviewer-response', label: '回复审稿人', shortLabel: '回复审稿人', icon: '✉️',
    tags: ['学术', '生成', '审稿'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '把审稿意见逐条整理成礼貌、有理有据的回复信(point-by-point),标注对应修改。',
    systemPrompt: '你是一位通讯作者,写礼貌、专业、point-by-point 的审稿回复。基于给定修改情况回应,不承诺未做的修改,有分歧时礼貌说明理由。',
    userPromptTemplate: `请根据下面审稿意见与修改情况,写 point-by-point 回复信:逐条引用意见→感谢→说明如何修改(或礼貌解释为何保留)→指出修改位置。礼貌专业。\n审稿意见与修改情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.acad-hypothesis', label: '研究假设提炼', shortLabel: '研究假设提炼', icon: '💡',
    tags: ['学术', '生成', '假设'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '从研究背景中提炼清晰、可检验的研究问题与假设,标明变量关系。',
    systemPrompt: '你是一位研究者,提炼可检验的研究问题与假设。基于给定背景,假设要明确变量关系、可操作化,不脱离材料空想。',
    userPromptTemplate: `请从下面研究背景提炼:\n## 研究问题(1-3个)\n## 研究假设(明确自变量、因变量、预期关系,可检验)\n## 变量操作化建议\n背景:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.acad-results-description', label: '数据结果描述', shortLabel: '数据结果描述', icon: '📊',
    tags: ['学术', '生成', '结果'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '把统计结果/图表数据写成规范的结果段落,客观陈述,不过度解读,数字照原文。',
    systemPrompt: '你是一位研究者,撰写规范的结果描述。只客观陈述给定数据(数字照原文),不做讨论与因果解读,显著性按原文报告。',
    userPromptTemplate: `请把下面数据/统计结果写成规范结果段落:客观描述主要发现、关键统计量(照原文)、图表指向。只陈述不讨论、不过度解读。\n数据/结果:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.acad-grant-proposal', label: '基金申请书框架', shortLabel: '基金申请框架', icon: '🗂️',
    tags: ['学术', '生成', '基金'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '把研究构想搭成基金申请书框架:立项依据、研究目标内容、方案、特色创新、基础与可行性。',
    systemPrompt: '你是一位科研管理顾问,搭建基金申请书框架。基于给定构想组织,不编造前期成果或数据,缺处标【待补充】。',
    userPromptTemplate: `请把下面研究构想搭成基金申请书框架:立项依据(背景+意义+国内外现状)、研究目标与内容、研究方案与技术路线、特色与创新、研究基础与可行性、预期成果。缺处【待补充】。\n构想:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.acad-translate', label: '学术翻译', shortLabel: '学术翻译', icon: '🌐',
    tags: ['学术', '翻译', '论文'], allowedActions: ['comment', 'replace', 'insert', 'append', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '中英学术互译,保持术语准确、句式规范、学术语气,专有名词与数据不改。',
    systemPrompt: '你是一位学术翻译,做中英学术互译。术语用学科通行译法、保持学术语气与句式规范,专有名词、数据、公式不变,不增删内容。',
    userPromptTemplate: `请对下面学术文本做翻译(中英按原文方向互译):术语准确、句式学术规范、保持原意,专有名词/数据/公式不变。\n文本:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.acad-plagiarism-risk', label: '查重风险提示', shortLabel: '查重风险提示', icon: '🔍',
    tags: ['学术', '核查', '查重'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '提示文中可能被判重的高风险表述(套话、常见定义、连续直引),建议改写降重方向。',
    systemPrompt: '你是一位学术写作助手,提示可能的查重风险段落并给改写方向。只提示风险与方法,不替代正规查重系统,不保证检测结果。',
    userPromptTemplate: `请提示下面文本中可能的查重高风险处(模板套话、通用定义、疑似连续直引、缺引用的转述),并给降重改写方向。命中片段:\`原文逐字片段\`。\n（提示仅供参考,以正规查重系统为准）\n文本:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.acad-keywords', label: '投稿关键词推荐', shortLabel: '关键词推荐', icon: '🏷️',
    tags: ['学术', '提取', '关键词'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '根据论文内容推荐投稿关键词:核心主题词、方法词、领域词,兼顾检索性与准确性。',
    systemPrompt: '你是一位学术编辑,推荐投稿关键词。基于论文真实内容,兼顾检索覆盖与准确,不堆砌不相关热词。',
    userPromptTemplate: `请根据下面论文内容推荐关键词:\n## 核心主题词(3-5)\n## 方法/技术词\n## 领域/应用词\n## 推荐组合(5-8个,适合投稿)\n论文内容:\n---\n{{input}}\n---` })
])

export function mergeAcademicIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...ACADEMIC_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { ACADEMIC_BUILTIN_ASSISTANTS, mergeAcademicIntoBuiltins }
