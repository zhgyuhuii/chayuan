/**
 * builtinAssistantsHrExt — 「人力资源」领域扩展助手包
 * 在 builtinAssistantsHr.js 之外补充高频且互不重复的文书/核查/抽取助手。
 * 生成类默认插入、抽取类 none(JSON)、核查类批注(逐字反引号锚点)。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'hr'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const HR_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.hr-onboarding-checklist', label: '入职清单与首日安排', shortLabel: '入职清单', icon: '🧳',
    tags: ['HR', '生成', '入职'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '根据岗位与入职信息,生成入职材料清单、账号权限开通、首日到首周安排,落实到责任人。',
    systemPrompt: '你是一位负责入职管理的 HR 运营专家。基于给定信息生成可执行的入职清单,不编造公司不存在的系统或流程;信息缺失用【待补充】占位。',
    userPromptTemplate: `请根据下面入职信息生成清单,分四部分:\n## 需员工提交的材料(身份证/学历/银行卡/体检/离职证明等)\n## 需公司准备的资源(工位/电脑/账号/权限/门禁)\n## 首日安排(到岗时间→报到→培训→介绍团队)\n## 首周跟进事项(责任人+时间点)\n缺失信息用【待补充】占位,不编造不存在的系统。\n入职信息:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.hr-termination-letter', label: '解除/终止通知起草', shortLabel: '解除通知', icon: '📤',
    tags: ['HR', '生成', '离职'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '根据解除事由起草合规的劳动合同解除/终止通知书,写明依据、日期、工作交接与经济补偿事项。',
    systemPrompt: '你是一位熟悉劳动法的 HR。起草解除/终止通知措辞严谨、事实清楚、依据明确。仅辅助,不替代执业律师;事由与金额缺失用【待补充】占位,绝不编造解除依据。',
    userPromptTemplate: `请根据下面信息起草劳动合同解除/终止通知书:称呼、解除/终止类型与法律依据、事实经过(基于给定事实)、最后工作日、工作交接要求、工资结算与经济补偿/赔偿事项、社保停缴时间、离职证明开具、落款与日期。事由或金额缺失用【待补充】,不自行认定违纪事实。\n仅辅助文书起草,不替代专业法律意见。\n信息:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.hr-handbook-review', label: '员工手册/规章制度核查', shortLabel: '制度核查', icon: '📕',
    tags: ['HR', '核查', '制度'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '核查员工手册或规章制度条款是否有违法、过严或表述模糊之处(罚款、超时加班、解除情形等)。',
    systemPrompt: '你是一位劳动法务,核查员工手册与规章制度的合法性与可执行性。命中片段须原文逐字、反引号包裹、可定位;不确定标「待人工核实」;仅辅助,不替代执业律师意见。',
    userPromptTemplate: `请核查下面规章制度,关注:用人单位无权对员工直接罚款、加班与工时是否违法、解除/开除情形是否合法、奖惩是否明确可执行、是否经过民主程序与公示提示、表述是否模糊易生争议。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:\\\`原文逐字片段\\\`\n- 问题:\n- 建议:\n## 待人工核实\n仅辅助核查,不替代专业法律意见。\n规章制度:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.hr-pip-plan', label: '绩效改进计划(PIP)起草', shortLabel: 'PIP起草', icon: '📈',
    tags: ['HR', '生成', '绩效'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.35,
    description: '把绩效问题整理成可执行、可衡量的改进计划:差距、目标、时间节点、支持资源与评估方式。',
    systemPrompt: '你是一位绩效管理专家。基于给定事实起草客观、对事不对人、可衡量的绩效改进计划,不夸大不臆断;目标须具体可考核,不写空泛标签。',
    userPromptTemplate: `请根据下面信息起草绩效改进计划(PIP):\n## 当前差距(基于具体事例,对事不对人)\n## 改进目标(SMART,可量化)\n## 关键行动与时间节点\n## 公司提供的支持(培训/辅导/资源)\n## 评估方式与节点(中期复盘+期末评估)\n## 未达成的后续安排\n只依据给定事实,不编造业绩数据。\n信息:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.hr-bgcheck-extract', label: '背景调查信息抽取', shortLabel: '背调抽取', icon: '🔍',
    tags: ['HR', '提取', '背调'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从背景调查报告或访谈记录中抽取任职、离职原因、绩效评价、风险点等结构化字段。',
    systemPrompt: '你是一位招聘合规助理,从背景调查材料精确抽取字段,输出严格 JSON。找不到的字段留空,绝不臆造或推断核实结论。',
    userPromptTemplate: `请从下面背景调查材料抽取字段,输出严格 JSON(找不到留空,不编造):\n{"candidate":"","verified_positions":[{"company":"","title":"","period":"","verified":""}],"performance_feedback":"","leave_reason":"","integrity_notes":"","risk_flags":[],"reference_contacts":[{"name":"","relation":""}],"overall_consistency":""}\n材料:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.hr-leave-policy', label: '考勤休假政策说明起草', shortLabel: '考勤休假', icon: '📅',
    tags: ['HR', '生成', '考勤'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '把考勤、请假、加班、调休等管理要点写成清晰易懂的政策说明,含申请流程与常见场景。',
    systemPrompt: '你是一位 HR 制度专家,撰写清晰可执行的考勤与休假政策。只用给定要点,不编造法律未规定的假期天数;涉及法定假期表述需稳妥,不确定处用【待确认】标注。',
    userPromptTemplate: `请根据下面要点撰写考勤与休假政策说明:适用范围、考勤规则(上下班/打卡/迟到早退)、各类假期(年假/事假/病假/婚丧产假等)与申请流程、加班与调休规则、异常处理。流程分步骤、给常见场景示例。法定天数不确定处标【待确认】。\n要点:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.hr-employment-cert', label: '在职/离职证明起草', shortLabel: '用工证明', icon: '📜',
    tags: ['HR', '生成', '证明'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.25,
    description: '根据员工信息起草规范的在职证明、离职证明或收入证明,措辞严谨、要素齐全。',
    systemPrompt: '你是一位 HR,起草规范的用工类证明文书。只填写给定信息,薪资/职位/日期等关键要素缺失用【待补充】占位,绝不虚构;离职证明不写主观评价与解除原因细节(除非要求)。',
    userPromptTemplate: `请根据下面信息起草用工证明(按类型生成在职证明/离职证明/收入证明之一):标题、员工姓名与身份证号、入职/离职日期、所任职位与部门、(如收入证明)税前月收入、用途说明、单位声明、落款单位与盖章/日期处。缺失要素用【待补充】,不虚构数字。\n信息:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.hr-contract-classify-review', label: '用工关系类型核查', shortLabel: '用工类型核查', icon: '🧩',
    tags: ['HR', '核查', '用工'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '核查协议属劳动/劳务/实习/外包/兼职哪类用工,提示名实不符及由此产生的合规风险。',
    systemPrompt: '你是一位用工合规专家,核查协议的用工关系类型与名实是否一致。命中片段须原文逐字、反引号包裹、可定位;不确定标「待人工核实」;仅辅助,不替代执业律师意见。',
    userPromptTemplate: `请核查下面协议:判断其约定的用工关系类型(劳动合同/劳务协议/实习协议/外包/非全日制),并核查名实是否一致、有无"假外包真用工""以劳务规避社保"等风险点、关键条款(管理从属性、报酬性质、社保、工伤)是否与所声明类型匹配。\n## 类型判断与依据\n- 命中片段:\\\`原文逐字片段\\\`\n## 风险或名实不符 (若无写"未发现明显问题")\n- 命中片段:\\\`原文逐字片段\\\`\n- 问题:\n- 建议:\n## 待人工核实\n仅辅助核查,不替代专业法律意见。\n协议:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.hr-recruit-report', label: '招聘进展周报整理', shortLabel: '招聘周报', icon: '📊',
    tags: ['HR', '生成', '招聘'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把零散的招聘数据与进展整理成结构化周报:各岗位漏斗、本周动作、卡点与下周计划。',
    systemPrompt: '你是一位招聘负责人,把零散进展整理成清晰的招聘周报。数字先引用原文再做汇总,不臆测未给出的数据;无数据处如实写【无数据】。',
    userPromptTemplate: `请把下面招聘进展整理成周报:\n## 各岗位进展(职位/在招/本周新增简历/面试/offer/到岗,做成表格)\n## 招聘漏斗与转化(先列原文数字再算转化率,数据不全标【无数据】)\n## 本周关键动作\n## 卡点与需协调事项\n## 下周计划\n只用给定信息,不编造数字。\n进展材料:\n---\n{{input}}\n---`
  })
])

export function mergeHrExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...HR_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}
export default { HR_EXT_BUILTIN_ASSISTANTS, mergeHrExtIntoBuiltins }
