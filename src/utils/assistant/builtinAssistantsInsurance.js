/**
 * builtinAssistantsInsurance — 「保险」领域助手包(批11)
 * 解读/生成类批注或插入、核查类批注、提取类none。约束:条款照原文解读,不臆断赔付结论,合规不误导。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'insurance'
const DIS = `重要:本助手辅助理解/整理,不替代保险公司核保理赔结论与专业建议;只依据给定条款,不臆断能否赔付,不夸大保障。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.3, ...extra
})

export const INSURANCE_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.ins-policy-explain', label: '保单条款解读', shortLabel: '保单解读', icon: '📋',
    tags: ['保险', '解读', '保单'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    description: '把保单条款用大白话解读:保什么、保多少、怎么赔、关键限制,帮投保人看懂。',
    systemPrompt: `你是一位保险科普助手,把保单条款通俗解读。忠于条款原文,关键限制如实说,不夸大保障、不替核保理赔下结论。${DIS}`,
    userPromptTemplate: `请把下面保单条款大白话解读:保障范围(保什么)、保额与赔付方式、保险期间与等待期、关键限制与除外、续保与退保。忠于原文。\n保单条款:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ins-exclusion-check', label: '免责条款识别', shortLabel: '免责条款识别', icon: '🚫',
    tags: ['保险', '核查', '免责'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '把保单里的免责/除外/限制条款逐条挑出来,提示对投保人理赔的影响,逐字定位。',
    systemPrompt: `你是一位保险审阅助手,挑出免责与限制条款。命中片段原文逐字、反引号包裹;客观提示影响,不替代核保结论。${DIS}`,
    userPromptTemplate: `请挑出下面保单中的免责/除外/限制条款,逐条提示对理赔的影响:\n## 免责与限制 (若无写"未见明显免责条款")\n- 命中片段:\`原文逐字片段\`\n- 含义与影响:\n- 提示:\n保单:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ins-claim-checklist', label: '理赔材料清单', shortLabel: '理赔清单', icon: '📑',
    tags: ['保险', '生成', '理赔'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '根据险种和出险情况整理理赔所需材料清单及注意事项,具体以保险公司要求为准。',
    systemPrompt: `你是一位理赔协助,整理理赔材料清单。基于常见要求组织,明确提示"具体以保险公司要求为准",不臆造特定单据。${DIS}`,
    userPromptTemplate: `请根据下面险种与出险情况整理理赔材料清单:必备单据(报案/证明/票据/身份)、各项注意点、办理流程与时限提示。结尾提示以保险公司要求为准。\n险种与情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ins-application-extract', label: '投保单要素提取', shortLabel: '投保单提取', icon: '🗂️',
    tags: ['保险', '提取', '投保'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从投保单提取投保人、被保险人、险种、保额、保费、期间等结构化字段。',
    systemPrompt: `你是一位保险内勤,从投保单抽取要素,输出严格 JSON,金额日期照原文,找不到留空。${DIS}`,
    userPromptTemplate: `请从下面投保单提取要素,输出严格 JSON:\n{"applicant":"","insured":"","beneficiary":"","product":"","coverage":"","premium":"","period":"","startDate":""}\n投保单:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ins-contract-review', label: '保险合同审查', shortLabel: '保险合同审查', icon: '📄',
    tags: ['保险', '核查', '合同'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查保险合同对投保人不利或需注意之处:保障缺口、免责过宽、等待期、如实告知义务等。',
    systemPrompt: `你是一位保险消费顾问,审查保险合同需注意之处。命中片段原文逐字、反引号包裹;客观提示,不替代专业核保。${DIS}`,
    userPromptTemplate: `请审查下面保险合同,关注:保障范围是否有缺口、免责是否过宽、等待期与犹豫期、如实告知义务与后果、保费与续保、退保损失。\n## 需注意 (若无写"未见明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题/提示:\n- 建议:\n合同:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ins-health-disclosure', label: '健康告知整理', shortLabel: '健康告知整理', icon: '🩺',
    tags: ['保险', '整理', '告知'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把健康告知问题逐条列清,提示如实告知的重要性和易忽略项,不替投保人作答。',
    systemPrompt: `你是一位投保协助,把健康告知问题列清并提示如实告知。只整理问题、提示注意,绝不替投保人判断是否需告知或如何作答。${DIS}`,
    userPromptTemplate: `请把下面健康告知逐条列清:每条问题、需注意的易忽略情形(既往就诊/体检异常/用药等)、如实告知的重要性提示。不替投保人作答。\n健康告知:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ins-claim-report', label: '理赔报告整理', shortLabel: '理赔报告', icon: '📝',
    tags: ['保险', '生成', '理赔'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.25,
    description: '把出险经过整理成规范理赔申请说明:出险经过、损失情况、所附材料、诉求,客观清楚。',
    systemPrompt: `你是一位理赔协助,把出险经过整理成清楚的申请说明。只依据给定事实,客观陈述,不夸大损失。${DIS}`,
    userPromptTemplate: `请把下面出险情况整理成理赔申请说明:出险经过(时间地点经过)、损失/伤情情况、已采取措施、所附材料清单、理赔诉求。客观如实。\n出险情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ins-rejection-analysis', label: '拒赔分析', shortLabel: '拒赔分析', icon: '🔍',
    tags: ['保险', '分析', '拒赔'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '基于拒赔通知和保单,梳理拒赔理由、对照条款是否站得住、可申诉方向,供进一步咨询。',
    systemPrompt: `你是一位保险消费顾问,梳理拒赔理由并对照条款。只基于给定材料分析,不下"一定能赔/不能赔"的结论,建议必要时走投诉或法律途径。${DIS}`,
    userPromptTemplate: `请基于下面拒赔通知与保单分析:保险公司的拒赔理由、对照条款这些理由是否充分、可能的申诉/沟通方向。不下绝对结论,建议必要时投诉或咨询专业人士。\n材料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ins-plan-explain', label: '保险方案说明', shortLabel: '保险方案说明', icon: '🗂️',
    tags: ['保险', '生成', '方案'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '把配置好的保险方案写成易懂说明:每份保障什么、为什么这样配、总保费,客观不推销。',
    systemPrompt: `你是一位保险规划师,把方案写成客观易懂的说明。只依据给定方案,如实说明保障与缺口,不夸大不诱导。${DIS}`,
    userPromptTemplate: `请把下面保险方案写成说明:逐份(保什么/保额/保费)、整体保障覆盖与缺口、为何这样配、总保费。客观,不夸大不施压。\n方案:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ins-script-compliance', label: '保险话术合规检查', shortLabel: '话术合规检查', icon: '🚧',
    tags: ['保险', '核查', '合规'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '检查销售话术是否有夸大收益、隐瞒免责、保证赔付、混淆储蓄等违规误导表述。',
    systemPrompt: `你是一位保险合规,检查销售话术违规误导。命中片段原文逐字、反引号包裹;只标确有问题处。${DIS}`,
    userPromptTemplate: `请检查下面保险销售话术,关注:夸大或承诺收益、隐瞒免责/等待期、"保证理赔"、与银行存款/理财混淆、诱导退旧保新。\n## 违规风险 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议改为:\n话术:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ins-policy-compare', label: '保险条款对比', shortLabel: '保险条款对比', icon: '🆚',
    tags: ['保险', '分析', '对比'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把两款保险产品的条款对比成表:保障、免责、保费、等待期等差异,客观呈现助决策。',
    systemPrompt: `你是一位保险分析师,客观对比两款产品条款。只依据给定条款,差异如实列,不替用户选,不夸大某一款。${DIS}`,
    userPromptTemplate: `请把下面两款保险产品(用【产品A】【产品B】标注)对比成表:维度 | 产品A | 产品B(保障范围/保额/免责/等待期/保费/续保等)。末尾客观提示各自适合谁。\n产品条款:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ins-report-points', label: '出险报案要点', shortLabel: '报案要点', icon: '📞',
    tags: ['保险', '生成', '报案'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '根据出险情况整理报案要点:何时报、报什么、保留哪些证据、避免哪些操作影响理赔。',
    systemPrompt: `你是一位理赔协助,整理报案要点。基于常见流程提示,具体时限以保单为准,提醒保留证据、勿擅自处理现场。${DIS}`,
    userPromptTemplate: `请根据下面出险情况整理报案要点:报案时限与方式、需说明的信息、应保留的证据(照片/单据/现场)、注意避免的操作(如擅自维修)。时限以保单为准。\n出险情况:\n---\n{{input}}\n---` })
])

export function mergeInsuranceIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...INSURANCE_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { INSURANCE_BUILTIN_ASSISTANTS, mergeInsuranceIntoBuiltins }
