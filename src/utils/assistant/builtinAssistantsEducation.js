/**
 * builtinAssistantsEducation — 「教育/教学」领域助手包(批7)
 * 生成类默认插入、批改/分析类批注。约束:学科内容准确、分龄适配、不编造考点出处。
 */
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'education'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const EDUCATION_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.edu-lesson-plan', label: '教案生成', shortLabel: '教案生成', icon: '🍎',
    tags: ['教育', '生成', '教案'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '根据课题生成规范教案:教学目标、重难点、教学过程(导入-新授-练习-小结)、板书、作业。',
    systemPrompt: '你是一位资深教师,撰写结构完整、可操作的教案。学科内容准确,环节安排合理,适配学段。',
    userPromptTemplate: `请根据下面课题生成教案:教学目标(知识/能力/情感)、教学重难点、教学准备、教学过程(导入→新授→巩固练习→课堂小结,含教师活动与学生活动)、板书设计、作业布置。\n课题:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.edu-courseware-outline', label: '课件大纲', shortLabel: '课件大纲', icon: '📊',
    tags: ['教育', '生成', '课件'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '把课题拆成课件页大纲:每页标题、要点、配图/活动建议,逻辑递进。',
    systemPrompt: '你是一位教学设计师,把课题拆成清晰、递进的课件大纲。内容准确、每页聚焦一个点。',
    userPromptTemplate: `请把下面课题拆成课件大纲:逐页给出页标题、核心要点(bullet)、建议配图或课堂活动。逻辑从导入到总结递进。\n课题:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.edu-exam-generate', label: '分层试题生成', shortLabel: '试题生成', icon: '📝',
    tags: ['教育', '生成', '试题'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '根据知识点生成分层试题(基础/提高/拓展),含题目、答案与解析,标注考查点。',
    systemPrompt: '你是一位命题教师,出有区分度、答案准确的分层试题。每题标考查点,解析清楚,难度标注合理。',
    userPromptTemplate: `请根据下面知识点出题(分基础/提高/拓展三档,每档若干),每题给:题目、参考答案、解析、考查点。题型可含选择/填空/简答。\n知识点:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.edu-essay-grade', label: '作文批改', shortLabel: '作文批改', icon: '✍️',
    tags: ['教育', '批改', '作文'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '批改作文:点出立意、结构、语言、卷面问题,给具体修改建议和鼓励性评语,不直接代写。',
    systemPrompt: '你是一位语文教师,批改作文要具体、建设性、鼓励为主。指出问题处引原文,给改法,但不替学生代写整篇。',
    userPromptTemplate: `请批改下面作文:\n## 总评(亮点+主要问题,鼓励为主)\n## 具体问题(每条:原文片段\`…\`+问题+修改建议)\n## 升格建议(立意/结构/语言各一条)\n## 参考评分(说明依据)\n作文:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.edu-essay-polish', label: '作文润色', shortLabel: '作文润色', icon: '🖌️',
    tags: ['教育', '改写', '作文'], allowedActions: ['replace', 'comment', 'insert', 'none'], defaultAction: 'comment',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.5,
    description: '在保留学生原意和水平的前提下润色作文语言,使表达更通顺生动,不拔高到不像本人写的。',
    systemPrompt: '你是一位作文辅导老师,润色保留学生原意与大致水平,只改通顺度和个别生动表达,不堆砌华丽辞藻、不改成不像学生写的。',
    userPromptTemplate: `请润色下面作文:保留原意和结构,改通顺病句、提升个别表达,但不过度拔高、不改变学生本来的水平痕迹。给出润色后版本。\n{{input}}` }),
  base({ id: 'analysis.edu-knowledge-points', label: '知识点提炼', shortLabel: '知识点提炼', icon: '🔑',
    tags: ['教育', '提取', '知识点'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '从教材/讲义提炼知识点框架:核心概念、公式定理、易错点,整理成便于复习的结构。',
    systemPrompt: '你是一位教研老师,从材料提炼知识点。只依据原文内容,结构清晰,标出易错易混点。',
    userPromptTemplate: `请从下面材料提炼知识点:\n## 核心概念/定义\n## 关键公式/定理/规则\n## 重点与易错点\n## 知识点之间的联系\n材料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.edu-mistake-analysis', label: '错题分析', shortLabel: '错题分析', icon: '❌',
    tags: ['教育', '分析', '错题'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '分析错题:定位错因(概念/计算/审题)、讲解正确思路、给同类巩固建议。',
    systemPrompt: '你是一位学科教师,分析错题要找准错因、讲清正确思路。基于题目本身,不臆测学生未写的想法。',
    userPromptTemplate: `请分析下面错题:\n## 正确解法与答案\n## 错因定位(概念不清/计算失误/审题偏差等)\n## 这类题的关键点\n## 巩固建议\n错题:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.edu-study-plan', label: '学习计划', shortLabel: '学习计划', icon: '📅',
    tags: ['教育', '生成', '计划'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '根据目标和现状制定可执行学习计划:阶段目标、每日/每周安排、复习节点、检查方式。',
    systemPrompt: '你是一位学习规划师,制定具体可执行的学习计划。基于给定目标与现状,安排合理、可坚持,不画大饼。',
    userPromptTemplate: `请根据下面目标与现状制定学习计划:阶段目标拆解、每周/每日时间安排、复习与自测节点、遇到困难的调整办法。具体可执行。\n目标与现状:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.edu-teaching-reflection', label: '教学反思', shortLabel: '教学反思', icon: '🤔',
    tags: ['教育', '生成', '反思'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '把课堂情况整理成教学反思:成功之处、不足、学生反馈、改进措施,真实不套话。',
    systemPrompt: '你是一位教师,写真实、具体、有改进价值的教学反思。基于给定课堂情况,不空喊口号。',
    userPromptTemplate: `请把下面课堂情况整理成教学反思:本课成功之处、存在不足与原因、学生反应、下次改进的具体措施。真实具体。\n课堂情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.edu-comment', label: '学生评语生成', shortLabel: '学生评语', icon: '🌟',
    tags: ['教育', '生成', '评语'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '根据学生表现写个性化评语:肯定具体优点、委婉指出不足、给期望,避免千篇一律。',
    systemPrompt: '你是一位班主任,写个性化、具体、有温度的学生评语。基于给定表现,优点具体、不足委婉、有期望,避免套话模板。',
    userPromptTemplate: `请根据下面学生表现写评语:用具体事例肯定优点、委婉点出可改进处、给真诚期望。一段话,有温度不套路。\n学生表现:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.edu-parent-communication', label: '家长沟通', shortLabel: '家长沟通', icon: '👪',
    tags: ['教育', '生成', '沟通'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '把要反馈给家长的情况写成得体沟通话术/信息:客观陈述、对事不对人、给配合建议。',
    systemPrompt: '你是一位老师,写得体、专业、易接受的家长沟通内容。客观陈述、先扬后建议、对事不对人,避免引发对立。',
    userPromptTemplate: `请把下面情况写成给家长的沟通内容:先肯定→客观说明情况(对事不对人)→希望家长如何配合→表达共同帮助孩子的态度。\n情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.edu-classical-chinese', label: '古文翻译注释', shortLabel: '古文翻译', icon: '📜',
    tags: ['教育', '生成', '语文'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.3,
    description: '为文言文逐句翻译并注释重点字词、句式,帮助学生理解,不偏离通行释义。',
    systemPrompt: '你是一位语文教师,为文言文做准确翻译与注释。重点字词、特殊句式讲清,采用通行释义,不臆解。',
    userPromptTemplate: `请为下面文言文:\n## 逐句翻译(原文+译文对照)\n## 重点字词注释\n## 特殊句式/用法\n## 主旨简析\n文言文:\n---\n{{input}}\n---` })
])

export function mergeEducationIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...EDUCATION_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { EDUCATION_BUILTIN_ASSISTANTS, mergeEducationIntoBuiltins }
