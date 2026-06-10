/**
 * builtinAssistantsInsuranceExt — 「保险」领域扩展助手包
 * 在现有 builtinAssistantsInsurance 之外补充高频且互不重复的文书起草/核查/抽取助手。
 * 约束:只依据给定信息,不臆断赔付,不夸大保障,涉法律金融加免责提示。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'insurance'

const DIS = `重要:本助手仅辅助理解与文书整理,不替代保险公司核保理赔结论与律师、税务等专业人员意见;只依据给定信息,不臆断能否赔付,不夸大保障。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const INSURANCE_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  // 1. 起草:批改/批单背书申请 —— 现有包没有保全变更类文书
  base({ id: 'analysis.ins-endorsement-draft', label: '保单批改申请起草', shortLabel: '批改申请', icon: '✏️',
    tags: ['保险', '起草', '保全'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.35,
    description: '把投保人的变更需求(改地址、改受益人、加减保额、补充被保险人等)写成规范的保单批改申请。',
    systemPrompt: `你是一位保险保全岗位专家,把客户的变更需求写成清楚规范的保单批改申请。只依据给定信息,变更前后内容如实写,涉及金额或资格的地方提示以保险公司审核为准。${DIS}`,
    userPromptTemplate: `请把下面变更需求写成保单批改申请,包含:保单号与投保人/被保险人、申请变更事项(逐项写明变更前→变更后)、变更原因、生效时间请求、申请人签字与日期占位。语言朴实,不要套话堆砌。\n变更需求:\n---\n{{input}}\n---` }),

  // 2. 起草:出险通知书 —— 区别于已有"报案要点(提示)"与"理赔报告(经过整理)",这是正式书面通知
  base({ id: 'analysis.ins-loss-notice-draft', label: '出险通知书起草', shortLabel: '出险通知书', icon: '📮',
    tags: ['保险', '起草', '出险'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.35,
    description: '根据出险事实起草正式的书面出险通知书,用于向保险公司提交报案存档。',
    systemPrompt: `你是一位保险理赔文书岗位专家,把出险事实写成正式的书面出险通知书。只陈述给定事实,时间地点经过照原文,不夸大损失、不预判责任与赔付。${DIS}`,
    userPromptTemplate: `请把下面出险情况写成书面出险通知书,包含:致××保险公司、保单号与被保险人、出险时间地点、事故经过(客观陈述)、初步损失/伤情情况、已采取措施、随附材料、通知人与日期占位。客观如实,不预判赔付。\n出险情况:\n---\n{{input}}\n---` }),

  // 3. 起草:理赔异议/申诉函 —— 区别于"拒赔分析(分析)",这是对外正式申诉文书
  base({ id: 'analysis.ins-appeal-letter-draft', label: '理赔申诉函起草', shortLabel: '申诉函起草', icon: '📨',
    tags: ['保险', '起草', '申诉'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '基于拒赔或少赔情况,起草有理有据的书面申诉/异议函,语气坚定但不情绪化。',
    systemPrompt: `你是一位保险消费维权文书岗位专家,基于给定材料起草申诉/异议函。只引用给定的条款与事实,讲理不撒泼,不编造证据,不下"一定能赔"的结论。涉及争议建议必要时通过监管投诉或法律途径。${DIS}`,
    userPromptTemplate: `请基于下面材料起草理赔申诉函,包含:致××保险公司、保单号与申请人、对拒赔/少赔结论的异议、逐条对照事实与条款说明理由、明确诉求、保留进一步投诉或法律途径的表述、申请人与日期占位。讲事实摆条款,不情绪化、不空话。\n材料:\n---\n{{input}}\n---` }),

  // 4. 起草:保险建议书/计划书说明 —— 偏销售前的需求分析建议,区别于"方案说明(已配好方案)"
  base({ id: 'analysis.ins-needs-proposal-draft', label: '投保需求建议书起草', shortLabel: '需求建议书', icon: '🧭',
    tags: ['保险', '起草', '建议'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.45,
    description: '根据客户的家庭、收入、负债与已有保障,起草客观的保障需求分析建议书,理清优先级而非推销产品。',
    systemPrompt: `你是一位保险规划师专家,根据给定家庭与财务情况写保障需求分析建议书。只依据给定信息分析,客观指出风险敞口与优先级,不指定具体产品、不夸大不施压。涉及财务规划提示仅辅助,不替代专业理财师。${DIS}`,
    userPromptTemplate: `请根据下面情况起草保障需求分析建议书,包含:家庭与财务概况摘要、主要风险敞口(身故/重疾/医疗/意外/养老等)、已有保障与缺口、配置优先级建议(先后顺序与理由)、预算分配思路。客观中立,不点名具体产品。\n客户情况:\n---\n{{input}}\n---` }),

  // 5. 润色:保险文书改写 —— 把生硬/口语化的保险文字改成专业又易懂的表达
  base({ id: 'analysis.ins-text-polish', label: '保险文书润色', shortLabel: '文书润色', icon: '🪄',
    tags: ['保险', '润色'], allowedActions: ['replace', 'append', 'none'], defaultAction: 'replace',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.45,
    description: '把口语化或生硬的保险说明、客户沟通文字改写得专业、准确又通俗,保持原意不增减事实。',
    systemPrompt: `你是一位保险文案编辑专家,把给定保险文字改写得专业、准确、通俗。保持原意,不增减事实、不夸大保障、不承诺收益。改写后仍是大白话,不要堆砌套话。${DIS}`,
    userPromptTemplate: `请把下面保险文字润色得更专业、准确、易懂:消除歧义与口语赘述、用语规范、该提示的限制不要被删掉。保持原意,不新增任何未给出的承诺或数字。只输出改写后的正文。\n原文:\n---\n{{input}}\n---` }),

  // 6. 核查:保额/缴费数字一致性核对 —— 区别于"合同审查(条款利弊)",专盯数字与前后一致
  base({ id: 'analysis.ins-figure-consistency-check', label: '保单金额核对', shortLabel: '金额核对', icon: '🧮',
    tags: ['保险', '核查', '金额'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '核对保单/投保单中保额、保费、缴费期、累计金额等数字前后是否一致、合计是否对得上。',
    systemPrompt: `你是一位保险核保复核岗位专家,核对文档中金额与数字的前后一致性与合计是否正确。命中片段用原文逐字、反引号包裹;计算时先列原文数字再算,数字不自行编造。只标确有矛盾或算不平之处。${DIS}`,
    userPromptTemplate: `请核对下面保单/投保单中的数字:各项保额、保费、缴费期与缴费频次、合计与累计金额前后是否一致、合计是否算得平。涉及计算先列原文数字再算。\n## 数字疑点 (若无写"未发现数字矛盾")\n- 命中片段:\`原文逐字片段\`\n- 问题(矛盾/算不平/缺失):\n- 核对说明:\n文档:\n---\n{{input}}\n---` }),

  // 7. 核查:如实告知/承保信息冲突核查 —— 比对告知内容与投保资料是否前后打架
  base({ id: 'analysis.ins-disclosure-conflict-check', label: '告知信息冲突核查', shortLabel: '告知核查', icon: '⚖️',
    tags: ['保险', '核查', '告知'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '核查健康告知/财务告知与投保资料、既往记录之间是否存在前后矛盾或遗漏,提示如实告知风险点。',
    systemPrompt: `你是一位保险核保岗位专家,核查告知信息与其他投保资料间的矛盾或遗漏。命中片段用原文逐字、反引号包裹;只标确有冲突或可疑遗漏之处,客观提示,不替投保人判断是否构成违约。${DIS}`,
    userPromptTemplate: `请核查下面材料中告知信息(健康/财务等)与投保资料、既往记录之间是否存在矛盾或遗漏:同一事实前后不一致、应告知未提及、年龄/职业/收入与申报不符等。\n## 冲突与遗漏 (若无写"未发现明显冲突")\n- 命中片段:\`原文逐字片段\`\n- 冲突/遗漏说明:\n- 提示:\n材料:\n---\n{{input}}\n---` }),

  // 8. 抽取:理赔结案/赔款明细要素提取 —— 区别于"投保单要素提取",抽的是理赔端结构化字段
  base({ id: 'analysis.ins-settlement-extract', label: '理赔结案要素提取', shortLabel: '结案提取', icon: '🧾',
    tags: ['保险', '提取', '理赔'], allowedActions: ['none', 'comment'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从理赔结案/赔款通知/赔付明细中提取赔案号、出险信息、核定与实赔金额、扣减、给付对象等结构化字段。',
    systemPrompt: `你是一位保险理赔内勤专家,从理赔结案或赔款明细中抽取要素,输出严格 JSON。金额与日期照原文,找不到的字段留空字符串,不编造、不推算未给出的数值。${DIS}`,
    userPromptTemplate: `请从下面理赔结案/赔款明细中提取要素,只输出严格 JSON,找不到的字段留空字符串:\n{"claimNo":"","policyNo":"","insured":"","lossDate":"","lossType":"","claimedAmount":"","approvedAmount":"","deductionAmount":"","paidAmount":"","payee":"","settleDate":"","conclusion":""}\n理赔材料:\n---\n{{input}}\n---` }),

  // 9. 抽取:保险条款关键限制要素提取 —— 把条款中的等待期/免赔额/赔付比例等关键数值抽成结构化
  base({ id: 'analysis.ins-terms-keyfields-extract', label: '条款关键限制提取', shortLabel: '限制提取', icon: '🔖',
    tags: ['保险', '提取', '条款'], allowedActions: ['none', 'comment'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从保单条款中提取等待期、犹豫期、免赔额、赔付比例、保额上限、续保规则等关键限制为结构化字段。',
    systemPrompt: `你是一位保险产品分析岗位专家,从条款中抽取关键限制要素,输出严格 JSON。数值与期限照原文,找不到留空字符串,不臆断、不把"未提及"写成具体数字。${DIS}`,
    userPromptTemplate: `请从下面保单条款中提取关键限制要素,只输出严格 JSON,找不到的字段留空字符串:\n{"waitingPeriod":"","coolingOffPeriod":"","deductible":"","reimburseRatio":"","coverageLimit":"","renewalRule":"","ageLimit":"","mainExclusions":""}\n其中 mainExclusions 用一句话概括主要除外,无则留空。\n条款:\n---\n{{input}}\n---` })
])

export function mergeInsuranceExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...INSURANCE_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { INSURANCE_EXT_BUILTIN_ASSISTANTS, mergeInsuranceExtIntoBuiltins }
