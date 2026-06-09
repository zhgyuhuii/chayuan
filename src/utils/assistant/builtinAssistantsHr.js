/**
 * builtinAssistantsHr — 「人力资源」领域助手包(批5)
 * 接入:registry.js DOMAIN_PACK_LOADERS 懒加载。生成类默认插入、抽取类none、核查类批注。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'hr'
const GEN_RULES = `通用约束:只用给定信息,不编造薪资/福利/资质;符合劳动法规、不含歧视性表述;直接输出成稿。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const HR_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.hr-jd-generate', label: 'JD生成', shortLabel: 'JD生成', icon: '📋',
    tags: ['HR', '生成', '招聘'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '根据岗位要点生成规范招聘 JD:岗位职责、任职要求、加分项,表述吸引人不夸大。',
    systemPrompt: `你是一位资深 HR,撰写清晰、有吸引力、合规的招聘 JD。${GEN_RULES}`,
    userPromptTemplate: `请根据下面要点生成招聘 JD:岗位名称、岗位职责(分条)、任职要求(硬性/加分分开)、我们能提供什么。缺信息用【待补充】占位,不含性别/年龄等歧视性表述。\n要点:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.hr-jd-optimize', label: 'JD优化', shortLabel: 'JD优化', icon: '✨',
    tags: ['HR', '改写', '招聘'], allowedActions: ['replace', 'comment', 'insert', 'none'], defaultAction: 'replace',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '把平淡或冗长的 JD 改得更清晰、有吸引力、突出亮点,去掉套话和歧视性表述。',
    systemPrompt: `你是一位招聘品牌专家,优化 JD 表达。保留事实,去套话、加亮点、删歧视性表述。${GEN_RULES}`,
    userPromptTemplate: `请优化下面这份 JD:职责更具体、要求更聚焦、亮点更突出、语气更吸引人,去掉"抗压能力强"类空话和歧视性条件。直接输出优化后版本。\n{{input}}` }),
  base({ id: 'analysis.hr-resume-extract', label: '简历结构化提取', shortLabel: '简历提取', icon: '🗂️',
    tags: ['HR', '提取', '简历'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从简历中提取姓名、联系方式、学历、工作经历、技能等结构化字段,便于入库筛选。',
    systemPrompt: '你是一位招聘助理,从简历精确抽取字段,输出严格 JSON,找不到留空,不臆造。',
    userPromptTemplate: `请从下面简历提取字段,输出严格 JSON:\n{"name":"","phone":"","email":"","education":[{"school":"","major":"","degree":"","period":""}],"experience":[{"company":"","title":"","period":"","summary":""}],"skills":[],"years":""}\n简历:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.hr-resume-screen', label: '简历筛选要点', shortLabel: '简历筛选', icon: '🔎',
    tags: ['HR', '分析', '筛选'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '对照岗位要求评估简历匹配度,列出亮点、疑点(空窗期/频繁跳槽)、建议追问的问题。',
    systemPrompt: '你是一位招聘官,客观评估简历与岗位的匹配度。只基于简历内容,不臆测、不带偏见,疑点如实列出。',
    userPromptTemplate: `请评估下面简历(若给了岗位要求则对照):\n## 匹配亮点\n## 需关注的疑点(空窗期/频繁跳槽/经历存疑)\n## 建议面试追问\n只依据简历,不臆断。\n简历(及岗位要求):\n---\n{{input}}\n---` }),
  base({ id: 'analysis.hr-interview-questions', label: '面试题生成', shortLabel: '面试题生成', icon: '❓',
    tags: ['HR', '生成', '面试'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '根据岗位/简历生成分层面试题:专业能力、项目深挖、行为面试(STAR)、考察点说明。',
    systemPrompt: `你是一位面试专家,设计有区分度的面试题并标明考察点。${GEN_RULES}`,
    userPromptTemplate: `请根据下面岗位/简历生成面试题,分三类(每类3-5题),每题标考察点:\n- 专业能力 / 项目深挖 / 行为面试(STAR)\n岗位/简历:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.hr-interview-eval', label: '面试评价整理', shortLabel: '面试评价整理', icon: '📝',
    tags: ['HR', '生成', '面试'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把零散面试记录整理成规范评价:各维度表现、亮点、顾虑、录用建议,客观有据。',
    systemPrompt: '你是一位面试官,把面试记录整理成客观、有依据的评价。只依据记录,不夸大不臆断。',
    userPromptTemplate: `请把下面面试记录整理成规范评价:\n## 各维度表现(专业/沟通/匹配度等)\n## 亮点\n## 顾虑\n## 录用建议(通过/待定/不通过 + 理由)\n面试记录:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.hr-offer-letter', label: 'Offer起草', shortLabel: 'Offer起草', icon: '✉️',
    tags: ['HR', '生成', 'offer'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '根据录用信息起草规范 Offer Letter:职位、薪酬、入职时间、附带条件,措辞专业得体。',
    systemPrompt: `你是一位 HR,起草规范、得体的录用通知。薪资等关键信息缺失用【待补充】占位,不编造。${GEN_RULES}`,
    userPromptTemplate: `请根据下面信息起草 Offer Letter:称呼、祝贺、职位/部门/汇报对象、薪酬待遇、入职时间地点、所需材料、答复期限、落款。缺失信息用【待补充】。\n录用信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.hr-labor-compliance', label: '劳动合同合规检查', shortLabel: '劳动合同检查', icon: '⚖️',
    tags: ['HR', '核查', '合规'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '检查劳动合同是否缺必备条款、是否有违反劳动法的约定(试用期、违约金、解除条件等)。',
    systemPrompt: '你是一位劳动法务,检查劳动合同的合规性。命中片段原文逐字、反引号包裹、可定位;不确定标「待人工核实」;不替代执业律师意见。',
    userPromptTemplate: `请检查下面劳动合同,关注:必备条款是否齐全、试用期长短与约定、违约金/服务期是否合法、解除条件、社保与工时约定、是否有无效或违法条款。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n## 待人工核实\n劳动合同:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.hr-noncompete-review', label: '竞业协议审查', shortLabel: '竞业协议审查', icon: '🚫',
    tags: ['HR', '核查', '竞业'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查竞业限制协议的范围、期限、补偿是否合法合理(无补偿可能无效、期限超两年等)。',
    systemPrompt: '你是一位劳动法务,审查竞业限制协议。命中片段逐字可定位;关注补偿、期限、范围的合法性;不替代律师意见。',
    userPromptTemplate: `请审查下面竞业限制协议,关注:限制范围是否过宽、期限是否超过2年、是否约定经济补偿(无补偿可能无效)、违约责任是否对等。\n## 问题或风险 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n协议:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.hr-performance-comment', label: '绩效评语润色', shortLabel: '绩效评语', icon: '🌟',
    tags: ['HR', '改写', '绩效'], allowedActions: ['replace', 'comment', 'insert', 'none'], defaultAction: 'replace',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.4,
    description: '把口语化的绩效反馈改写成具体、客观、对事不对人的评语,兼顾肯定与改进建议。',
    systemPrompt: '你是一位管理者,撰写具体、客观、建设性的绩效评语。基于给定事实,对事不对人,既肯定也给改进方向。',
    userPromptTemplate: `请把下面绩效反馈改写成规范评语:用具体事例支撑、对事不对人、先肯定成绩再给改进建议、避免空泛标签。\n{{input}}` }),
  base({ id: 'analysis.hr-training-outline', label: '培训大纲生成', shortLabel: '培训大纲', icon: '🎓',
    tags: ['HR', '生成', '培训'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '根据培训主题生成结构化大纲:目标、对象、模块与课时、形式、考核方式。',
    systemPrompt: `你是一位培训设计师,产出结构清晰、可落地的培训大纲。${GEN_RULES}`,
    userPromptTemplate: `请根据下面主题生成培训大纲:培训目标、适用对象、内容模块(含课时)、培训形式、考核/评估方式。\n主题:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.hr-employee-email', label: '员工沟通邮件', shortLabel: '员工沟通邮件', icon: '📧',
    tags: ['HR', '生成', '沟通'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '把通知事项写成得体的员工沟通邮件:政策调整、活动通知、关怀提醒等,语气专业有温度。',
    systemPrompt: `你是一位 HR,撰写清晰、得体、有温度的员工沟通邮件。${GEN_RULES}`,
    userPromptTemplate: `请把下面事项写成员工沟通邮件:主题行、称呼、正文(背景→具体内容→需员工配合的事项)、落款。语气专业且有人情味。\n事项:\n---\n{{input}}\n---` })
])

export function mergeHrIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...HR_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { HR_BUILTIN_ASSISTANTS, mergeHrIntoBuiltins }
