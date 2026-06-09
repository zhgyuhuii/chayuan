/**
 * builtinAssistantsBanking — 「金融/银行/投融资」领域助手包(批6)
 * 核查类批注、生成框架类插入、提取类none。约束:不臆造财务数据/评级/收益;风险揭示充分;不替代专业意见。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'banking'
const CHK = `通用约束(核查):命中片段原文逐字、反引号包裹;数字核对先列原文再判;不确定标「待人工核实」;不替代风控/投行/律师专业判断。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.3, ...extra
})

export const BANKING_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.bank-credit-review', label: '信贷材料审核要点', shortLabel: '信贷审核要点', icon: '🏦',
    tags: ['金融', '核查', '信贷'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '从授信申请材料中梳理审核要点:还款来源、负债、担保、用途、风险信号,供风控判断。',
    systemPrompt: `你是一位银行信贷审核员,从材料中梳理审核要点与风险信号。只依据材料,不臆断评级。${CHK}`,
    userPromptTemplate: `请梳理下面信贷材料的审核要点:还款来源是否清晰可持续、负债与杠杆、担保/抵押是否足值、借款用途是否合规真实、潜在风险信号(关联、流水异常等)。\n## 关注点 (若无写"未发现明显异常")\n- 涉及原文:\`原文逐字片段\`\n- 关注/风险:\n- 建议核实:\n材料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bank-dd-checklist', label: '尽职调查清单', shortLabel: '尽调清单', icon: '📋',
    tags: ['金融', '生成', '尽调'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '根据标的类型生成结构化尽职调查清单:业务、财务、法律、合规、人员等待核查项。',
    systemPrompt: '你是一位投资/风控人员,产出结构化尽调清单。基于标的类型给常规核查项,缺信息处保留通用项。',
    userPromptTemplate: `请根据下面标的生成尽职调查清单,分模块(业务/财务/法律合规/资产/人员/风险),每项列具体待核查内容与需索取的材料。\n标的:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bank-risk-disclosure', label: '风险揭示提取', shortLabel: '风险揭示提取', icon: '⚠️',
    tags: ['金融', '提取', '风险'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '从产品文件/报告中提取并归类风险揭示:市场、信用、流动性、操作、政策等,便于阅读。',
    systemPrompt: '你是一位风险合规人员,从文件中提取并归类风险揭示。只摘原文已述风险,不增不减。',
    userPromptTemplate: `请从下面文件提取风险揭示,按类归并(市场/信用/流动性/操作/政策/其他),每类列要点并引原文关键句。\n文件:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bank-wealth-compliance', label: '理财说明合规检查', shortLabel: '理财合规检查', icon: '🚧',
    tags: ['金融', '核查', '合规'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '检查理财/资管产品说明是否有保本保收益等违规承诺、风险揭示是否充分、适当性提示。',
    systemPrompt: `你是一位金融合规审核,检查产品宣传/说明的合规性。${CHK}`,
    userPromptTemplate: `请检查下面理财/资管产品文案,关注:是否暗示或承诺保本保收益、是否夸大收益弱化风险、风险等级与适当性提示是否充分、是否有"业绩比较基准"误导。\n## 违规风险 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n文案:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bank-credit-report', label: '授信报告框架', shortLabel: '授信报告框架', icon: '🗂️',
    tags: ['金融', '生成', '信贷'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把客户与业务信息搭成授信报告框架:客户概况、经营财务、授信方案、风险与缓释、结论。',
    systemPrompt: '你是一位信贷客户经理,搭建授信报告框架。基于给定信息,数据缺失用【待补充】,不编造财务数字。',
    userPromptTemplate: `请把下面信息搭成授信报告框架:客户概况、经营与财务分析、授信方案(额度/期限/利率/担保)、风险点与缓释措施、审批建议。缺数据用【待补充】。\n信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bank-aml-check', label: '反洗钱要点核查', shortLabel: '反洗钱核查', icon: '🔍',
    tags: ['金融', '核查', '反洗钱'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '从交易/客户资料中提示可疑特征(异常资金、复杂结构、高风险地区等),供反洗钱排查。',
    systemPrompt: `你是一位反洗钱合规人员,从资料中提示可疑特征。只基于资料,可疑标"待核实",不武断认定。${CHK}`,
    userPromptTemplate: `请从下面资料提示反洗钱可疑特征,关注:资金来源去向异常、与业务不符的大额/频繁交易、复杂股权或代持结构、高风险国家地区、规避申报迹象。\n## 可疑特征 (若无写"未发现明显可疑")\n- 涉及原文:\`原文逐字片段\`\n- 可疑点:\n- 建议核实:\n资料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bank-ts-review', label: '投资协议条款审查', shortLabel: '投资协议审查', icon: '📜',
    tags: ['金融', '核查', '投资'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查 TS/SPA/股东协议关键条款:估值、对赌、优先权、反稀释、回购、退出等对各方的影响。',
    systemPrompt: `你是一位投融资法务,审查投资协议关键条款。${CHK}`,
    userPromptTemplate: `请审查下面投资协议条款,关注:估值与对赌(业绩承诺/补偿)、优先清算权、反稀释、优先认购/跟售拖售、回购、董事会与一票否决、退出安排。逐条说明对融资方/投资方的影响与风险。\n## 关键条款 \n- 命中片段:\`原文逐字片段\`\n- 含义与风险:\n- 提示:\n协议:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bank-financial-comment', label: '财报快评', shortLabel: '财报快评', icon: '📊',
    tags: ['金融', '分析', '财报'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '基于财报数据快速点评经营质量、盈利与现金流、负债与风险,数字均取自原文。',
    systemPrompt: '你是一位财务分析师,基于财报快速点评。涉及计算先列原文数字,不臆算,不预测未给出的数据。',
    userPromptTemplate: `请基于下面财报数据做快评:盈利能力、成长性、现金流质量、负债与偿债、值得关注的异常项。数字必须来自原文,计算先列原文数字。\n财报:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bank-prospectus-extract', label: '招股书要点提取', shortLabel: '招股书提取', icon: '📕',
    tags: ['金融', '提取', '招股'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '从招股书/募集说明书提取关键要点:主营、募资用途、财务、风险因素、股权结构。',
    systemPrompt: '你是一位投行分析师,从招股书提取关键要点。只摘原文信息,数据保持原文,不臆测。',
    userPromptTemplate: `请从下面招股书提取要点:主营业务与模式、募集资金用途、关键财务数据、主要风险因素、股权结构与实控人。每项引原文关键信息。\n招股书:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bank-roadshow', label: '路演稿框架', shortLabel: '路演稿框架', icon: '🎤',
    tags: ['金融', '生成', '路演'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '把项目信息搭成路演稿框架:痛点、解决方案、市场、商业模式、团队、财务、融资计划。',
    systemPrompt: '你是一位 FA/创始人路演教练,搭建有说服力的路演框架。基于给定信息,数据缺失用【待补充】,不编造市场规模或财务预测。',
    userPromptTemplate: `请把下面项目搭成路演稿框架:痛点→解决方案→市场空间→商业模式→竞争壁垒→团队→财务与里程碑→融资计划与用途。缺数据用【待补充】。\n项目:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bank-im', label: '投资备忘录框架', shortLabel: '投资备忘录', icon: '🗃️',
    tags: ['金融', '生成', '投资'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把标的信息搭成投资备忘录(IM)框架:交易概要、行业、标的、财务、估值、风险、建议。',
    systemPrompt: '你是一位投资经理,搭建投资备忘录框架。基于给定信息客观组织,数据缺失用【待补充】,不编造结论。',
    userPromptTemplate: `请把下面标的搭成投资备忘录框架:交易概要、行业与市场、标的业务、财务表现、估值逻辑、主要风险、投资建议。缺数据用【待补充】。\n标的:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bank-valuation', label: '估值逻辑说明', shortLabel: '估值逻辑', icon: '📈',
    tags: ['金融', '分析', '估值'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '基于给定数据梳理可用的估值方法(可比、DCF、市销/市盈率)与关键假设,提示敏感性。',
    systemPrompt: '你是一位估值分析师,梳理估值方法与关键假设。计算先列原文数字与公式,假设要标明,数据不足标「数据不足」,不臆算结果。',
    userPromptTemplate: `请基于下面信息梳理估值思路:适用的估值方法、各方法关键假设与所需数据、可算的代入计算(先列原文数字)、对结果影响最大的敏感变量。数据不足标「数据不足」。\n信息:\n---\n{{input}}\n---` })
])

export function mergeBankingIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...BANKING_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { BANKING_BUILTIN_ASSISTANTS, mergeBankingIntoBuiltins }
