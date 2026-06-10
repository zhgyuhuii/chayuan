/**
 * builtinAssistantsBankingExt — 「金融/银行/投融资」领域扩展包
 * 在 builtinAssistantsBanking 之外补高频文书/核查/抽取场景:贷后管理、押品核查、
 * 流水分析、贸易融资单证、借款合同条款、对公准入KYC、客诉回复、不良处置、对账核对、营销话术。
 * 约束:不臆造金额/比率/评级;数字先列原文再算;核查命中片段逐字反引号锚定;抽取找不到留空不编造;
 * 涉法律/金融/税务事项仅辅助,不替代风控/合规/律师/客户经理的专业判断。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'banking'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const BANKING_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.bank-postloan-report',
    label: '贷后检查报告框架',
    shortLabel: '贷后检查报告',
    icon: '🧾',
    tags: ['金融', '生成', '贷后'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.3,
    description: '把贷后检查信息搭成报告框架:经营与还款情况、资金用途核实、担保状态、风险预警、处置建议。',
    systemPrompt: '你是一位银行贷后管理岗专家。把给定信息组织成贷后检查报告框架,只用材料里的事实,缺数据写【待补充】,不编造经营数字或还款记录。结论仅辅助,不替代风控审批。',
    userPromptTemplate: `把下面信息搭成贷后检查报告框架,分这几块:借款人近期经营与财务概况、本笔贷款本息偿还情况、贷款资金用途是否与约定一致、担保/抵质押现状、发现的风险预警信号、下一步管理与处置建议。每块只写材料支持的内容,缺数据写【待补充】。\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bank-collateral-check',
    label: '押品资料核查',
    shortLabel: '押品核查',
    icon: '🏠',
    tags: ['金融', '核查', '押品'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '核查抵质押物资料:权属是否清晰、估值与抵押率、是否存在查封/在先抵押、他项权证等瑕疵。',
    systemPrompt: '你是一位银行押品管理岗专家。核查抵质押物资料的合规与风险点,只依据材料,涉及金额或抵押率时先列原文数字再判断,不确定写「待人工核实」。仅辅助,不替代风控与法务判断。',
    userPromptTemplate: `核查下面押品资料,重点:权属是否清晰且属于借款人/担保人、估值依据是否充分、抵押率是否合理、是否存在查封冻结或在先抵押、他项权证/登记是否办妥、是否有租赁等在先权利影响处置。涉及金额比率时先抄原文数字再判断。\n## 核查发现 (若无写"未发现明显瑕疵")\n- 命中片段:\`原文逐字片段\`\n- 问题/风险:\n- 建议核实:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bank-statement-analyze',
    label: '银行流水分析',
    shortLabel: '流水分析',
    icon: '💳',
    tags: ['金融', '分析', '流水'],
    allowedActions: ['comment', 'append', 'insert', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.2,
    description: '分析企业/个人银行流水:进出账规模与稳定性、与申报经营是否匹配、过桥垫资及异常往来迹象。',
    systemPrompt: '你是一位银行授信审查中的流水分析专家。基于给定流水做事实分析,任何汇总金额都先列原文逐笔再相加,不臆造未出现的交易,异常只提示不下定论,标「待核实」。仅辅助,不替代审查人员判断。',
    userPromptTemplate: `分析下面银行流水:整体进出账规模与月度稳定性、回款与申报经营/销售是否匹配、是否有疑似过桥垫资(短进短出、整进整出)、与关联方/法人个人账户的大额往来、临近申请时点的异常冲量。涉及合计先抄原文逐笔数字再相加。\n## 分析发现 \n- 命中片段:\`原文逐字片段\`\n- 解读:\n- 建议核实:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bank-trade-finance-doc',
    label: '贸易融资单证审核',
    shortLabel: '单证审核',
    icon: '📦',
    tags: ['金融', '核查', '单证'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '审核信用证/保函/贸易融资项下单据:单证一致、单单一致、金额币种期限、不符点,提示交单风险。',
    systemPrompt: '你是一位银行国际业务单证审核专家。比对信用证条款与提交单据,只依据材料指出不符点与风险,涉及金额币种日期先抄原文再比对,不确定写「待人工核实」。仅辅助,不替代单证复核与合规审查。',
    userPromptTemplate: `审核下面信用证/保函及项下单据,重点:单据种类与份数是否齐全、单证一致(单据与证内条款)、单单一致(各单据之间)、金额/币种/数量/装运期/交单期是否相符、是否存在不符点、是否触及制裁或可疑贸易背景。涉及金额日期先抄原文再比对。\n## 审核发现 (若无写"单证相符,未见明显不符点")\n- 命中片段:\`原文逐字片段\`\n- 不符点/风险:\n- 处理建议:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bank-loan-contract-review',
    label: '借款合同条款核查',
    shortLabel: '借款合同核查',
    icon: '✍️',
    tags: ['金融', '核查', '合同'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '核查借款/担保合同关键条款:金额利率期限、还款与提前还款、违约与加速到期、担保范围、费用披露。',
    systemPrompt: '你是一位银行法律合规岗专家,审查借款及担保合同条款。只依据合同文本指出关键点与风险,涉及利率金额期限先抄原文再判断,不确定写「待人工核实」。法律事项仅辅助,不替代律师意见。',
    userPromptTemplate: `核查下面借款/担保合同条款,重点:借款金额利率期限计息方式、还款安排与提前还款约定、违约情形与加速到期/罚息、担保范围与保证方式(连带/一般)、抵质押与登记义务、费用与利率披露是否充分、争议解决与送达条款。涉及数字先抄原文再判断。\n## 条款发现 \n- 命中片段:\`原文逐字片段\`\n- 含义/风险:\n- 修改或核实建议:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bank-corp-kyc-extract',
    label: '对公客户准入信息提取',
    shortLabel: '对公准入提取',
    icon: '🏢',
    tags: ['金融', '提取', '准入'],
    allowedActions: ['none'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '从开户/尽调资料提取对公客户准入要素:主体信息、股权与实控人、经营范围、关联方、风险标签。',
    systemPrompt: '你是一位银行对公客户准入(KYC)岗专家。从资料中提取结构化准入要素,只填材料里明确出现的内容,找不到的字段留空字符串或空数组,绝不编造。仅辅助,不替代准入审查。',
    userPromptTemplate: `从下面资料提取对公客户准入信息,按此 JSON 结构输出,找不到的留空("" 或 []),不要编造:\n{\n  "客户名称": "",\n  "统一社会信用代码": "",\n  "成立日期": "",\n  "注册资本": "",\n  "法定代表人": "",\n  "实际控制人": "",\n  "主要股东": [{"名称":"","持股比例":""}],\n  "经营范围": "",\n  "所属行业": "",\n  "注册地址": "",\n  "关联企业": [],\n  "风险或负面信息": []\n}\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bank-complaint-reply',
    label: '客诉回复函起草',
    shortLabel: '客诉回复',
    icon: '📨',
    tags: ['金融', '生成', '客诉'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.4,
    description: '根据投诉事实起草银行客户投诉回复函:核实情况、合规依据、处理方案、致歉与改进措施。',
    systemPrompt: '你是一位银行消费者权益保护岗专家。基于投诉事实起草正式、克制、合规的回复函,只依据材料陈述事实与处理方案,不承诺材料外的赔偿,涉及收费/利率说明先引材料数字。仅辅助,正式发出前需合规与法务复核。',
    userPromptTemplate: `根据下面投诉信息起草一封客户投诉回复函,包含:开头致意、对投诉事项的核实与事实说明、相关业务规则或合同依据、本行处理方案与时限、必要的致歉与改进承诺、后续联系方式。语气诚恳克制,不承诺材料外内容,涉及金额费率先引材料原文。\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bank-npl-disposal',
    label: '不良资产处置方案框架',
    shortLabel: '不良处置框架',
    icon: '⚖️',
    tags: ['金融', '生成', '不良'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.3,
    description: '把不良贷款信息搭成处置方案框架:债权与担保现状、债务人偿债能力、可选处置路径、回收测算、时间表。',
    systemPrompt: '你是一位银行资产保全/不良清收岗专家。把给定信息组织成处置方案框架,只用材料事实,回收金额按原文数字测算并标明假设,缺数据写【待补充】,不编造抵押物价值或回收率。法律手段仅辅助,不替代律师意见。',
    userPromptTemplate: `把下面不良贷款信息搭成处置方案框架,分:债权本息与逾期现状、担保与抵质押物现状、债务人及保证人偿债能力、可选处置路径(催收/重组展期/诉讼执行/转让核销)对比、各路径预计回收与成本(按原文数字测算并标假设)、时间表与责任分工。缺数据写【待补充】。\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bank-reconcile-check',
    label: '对账差异核对',
    shortLabel: '对账核对',
    icon: '🔢',
    tags: ['金融', '核查', '对账'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '核对账务/对账单与台账之间的金额、笔数、余额差异,定位未达账项与疑似错记。',
    systemPrompt: '你是一位银行运营/财务核算岗专家。核对两侧账务差异,任何合计与差额都先抄原文逐项数字再相减,定位差异不臆断原因,不确定写「待人工核实」。仅辅助,不替代复核岗。',
    userPromptTemplate: `核对下面对账资料,找出两侧(对账单/台账或借贷双方)的差异:逐项比对金额与笔数、计算余额差额、定位未达账项与疑似重复或错记。所有合计与差额先抄原文逐项数字再相减,写出算式。\n## 差异发现 (若无写"账实相符,未发现差异")\n- 命中片段:\`原文逐字片段\`\n- 差异与算式:\n- 建议核实:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bank-marketing-pitch',
    label: '客户经理营销话术',
    shortLabel: '营销话术',
    icon: '🤝',
    tags: ['金融', '改写', '营销'],
    allowedActions: ['replace', 'insert', 'append', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    temperature: 0.6,
    description: '把产品要点改写成客户经理可直接用的营销话术:开场、需求挖掘、卖点对应、异议应对、促成。',
    systemPrompt: '你是一位银行零售/对公客户经理培训专家。把产品要点改写成口语化、可直接说出口的营销话术,只用材料里的产品事实,不承诺保本保收益、不夸大收益弱化风险,涉及利率费率引材料原文。仅辅助,合规话术以本行口径为准。',
    userPromptTemplate: `把下面产品/客户信息改写成客户经理面谈营销话术,分:自然开场、需求挖掘提问、对应卖点讲解、常见异议应对、促成与下一步。口语自然、不书面套话,不承诺保本保收益、不夸大,涉及利率费率引材料原文。\n---\n{{input}}\n---`
  })
])

export function mergeBankingExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...BANKING_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { BANKING_EXT_BUILTIN_ASSISTANTS, mergeBankingExtIntoBuiltins }
