/**
 * builtinAssistantsTrade — 「外贸/跨境」领域助手包(批6)
 * 生成类默认插入、抽取类none、核查类批注。约束:术语用国际贸易通用写法,不臆造价格/船期/编码。
 */
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'trade'
const GEN = `通用约束:只用给定信息,不编造价格、船期、HS编码、认证;外贸术语用国际通用写法;直接输出成稿。`
const CHK = `通用约束(核查):命中片段原文逐字、反引号包裹、可定位;不确定标「待人工核实」;不替代专业律师/报关行意见。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, defaultOutputFormat: 'markdown', temperature: 0.5, ...extra
})

export const TRADE_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.trade-dev-letter', label: '外贸开发信', shortLabel: '外贸开发信', icon: '✉️',
    tags: ['外贸', '生成', '开发信'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '根据产品和目标客户写简洁、有针对性、不像群发的英文开发信(附中文要点)。',
    systemPrompt: `你是一位资深外贸业务员,写简洁、个性化、能引起回复的英文开发信。${GEN}`,
    userPromptTemplate: `请根据下面信息写英文开发信:开头点出针对性(非群发感)、一句话价值主张、核心卖点1-2点、明确的下一步(询样/报价)。控制在120词内,附中文要点。\n信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.trade-pi-extract', label: 'PI/报价单提取', shortLabel: 'PI提取', icon: '🧾',
    tags: ['外贸', '提取', 'PI'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从形式发票/报价单提取买卖方、品名、数量、单价、总价、贸易术语、付款方式等字段。',
    systemPrompt: '你是一位外贸单证员,从 PI/报价单精确抽取字段,输出严格 JSON,金额数量保持原文,找不到留空。',
    userPromptTemplate: `请从下面 PI/报价单提取字段,输出严格 JSON:\n{"seller":"","buyer":"","items":[{"name":"","qty":"","unitPrice":"","amount":""}],"totalAmount":"","currency":"","incoterms":"","payment":"","port":"","leadTime":""}\nPI/报价单:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.trade-inquiry-reply', label: '询盘回复', shortLabel: '询盘回复', icon: '💬',
    tags: ['外贸', '生成', '询盘'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '针对客户询盘写专业英文回复:确认需求、给关键信息、引导报价或样品,推进成交。',
    systemPrompt: `你是一位外贸业务员,写专业、推进式的英文询盘回复。只承诺能做到的,不乱报价。${GEN}`,
    userPromptTemplate: `请针对下面询盘写英文回复:感谢并确认需求要点→提供能给的关键信息→需客户补充的信息→明确下一步。附中文要点。\n询盘:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.trade-lc-check', label: '信用证条款检查', shortLabel: '信用证检查', icon: '🏦',
    tags: ['外贸', '核查', 'LC'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '检查信用证条款是否有软条款、单据要求是否能做到、交单期与有效期等不利点。',
    systemPrompt: `你是一位外贸单证与结算专家,检查信用证(L/C)条款风险。${CHK}`,
    userPromptTemplate: `请检查下面信用证条款,关注:软条款(客检证/船公司指定等买方可控条件)、单据要求能否做到、交单期与有效期是否够、金额与货描是否一致、是否可转让/保兑。\n## 风险条款 (若无写"未发现明显风险")\n- 命中片段:\`原文逐字片段\`\n- 风险:\n- 建议:\nL/C:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.trade-product-en', label: '产品英文描述', shortLabel: '产品英文描述', icon: '🌐',
    tags: ['外贸', '生成', '英文'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '把中文产品资料写成地道的英文产品描述,适合放网站/平台,卖点清晰术语准确。',
    systemPrompt: `你是一位外贸文案,写地道、专业的英文产品描述。只用资料事实,规格术语准确。${GEN}`,
    userPromptTemplate: `请把下面产品资料写成英文产品描述:一句话定位、核心卖点(bullet)、规格参数、适用场景。地道、专业、不夸大。\n资料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.trade-hs-code', label: 'HS编码建议', shortLabel: 'HS编码建议', icon: '🔢',
    tags: ['外贸', '建议', '报关'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '根据商品描述建议可能的 HS 编码方向和归类要点,提示需以海关裁定为准。',
    systemPrompt: '你是一位报关归类员,根据商品描述给出 HS 编码归类思路与可能章节。明确提示具体编码需以海关预归类/裁定为准,不替你下定论。',
    userPromptTemplate: `请根据下面商品描述,给出 HS 编码归类思路:\n## 商品属性理解\n## 可能涉及的章/类及理由\n## 归类关键点(影响编码的因素)\n(具体编码以海关预归类裁定为准)\n商品描述:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.trade-contract-review', label: '外贸合同审查', shortLabel: '外贸合同审查', icon: '📑',
    tags: ['外贸', '核查', '合同'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.15,
    description: '审查外贸合同的贸易术语、付款、交货、品质、争议解决、适用法律等对本方不利之处。',
    systemPrompt: `你是一位涉外法务,审查外贸合同对本方的风险。${CHK}`,
    userPromptTemplate: `请审查下面外贸合同,关注:贸易术语与风险转移、付款方式与收汇安全、交货期与不可抗力、品质与索赔条款、争议解决与适用法律、知识产权。\n## 风险/不利条款 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n合同:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.trade-followup', label: '客户跟进话术', shortLabel: '客户跟进', icon: '🔁',
    tags: ['外贸', '生成', '跟进'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '针对沉默/犹豫客户写不催不烦的英文跟进邮件,给新理由重启对话。',
    systemPrompt: `你是一位外贸业务员,写不让人反感、能重启对话的英文跟进邮件。${GEN}`,
    userPromptTemplate: `请针对下面客户情况写英文跟进邮件:给一个新的跟进理由(新报价/新款/展会/政策)、简短、不催不卑、留个钩子。附中文要点。\n客户情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.trade-claim-letter', label: '外贸索赔函', shortLabel: '索赔函', icon: '⚠️',
    tags: ['外贸', '生成', '索赔'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '根据质量/数量/船期问题写专业英文索赔函:陈述事实、引证据、提出诉求,留谈判空间。',
    systemPrompt: '你是一位外贸业务员,写有理有据、专业克制的英文索赔函。只用给定事实,不编造金额证据,缺失用【待补充】。',
    userPromptTemplate: `请根据下面情况写英文索赔函:陈述事实经过→引用证据(单据/检验)→明确索赔诉求(换货/退款/折让)→期限。专业克制留余地。附中文要点。\n情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.trade-customs-extract', label: '报关装箱要素提取', shortLabel: '报关要素提取', icon: '📦',
    tags: ['外贸', '提取', '报关'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从装箱单/发票提取报关所需要素:品名、数量、净毛重、件数、唛头、金额等,输出结构化。',
    systemPrompt: '你是一位外贸单证员,从装箱单/发票抽取报关要素,输出严格 JSON,数字保持原文,找不到留空。',
    userPromptTemplate: `请从下面单据提取要素,输出严格 JSON:\n{"items":[{"name":"","qty":"","netWeight":"","grossWeight":"","packages":""}],"totalPackages":"","totalNetWeight":"","totalGrossWeight":"","marks":"","totalAmount":"","currency":""}\n单据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.trade-fair-invite', label: '展会邀请函', shortLabel: '展会邀请函', icon: '🎪',
    tags: ['外贸', '生成', '展会'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '写邀请老客户/潜在客户来展位的英文邀请函:展会信息、展位号、亮点、预约引导。',
    systemPrompt: `你是一位外贸业务员,写热情、专业的英文展会邀请函。${GEN}`,
    userPromptTemplate: `请根据下面信息写英文展会邀请函:展会名称/时间/地点/展位号、本次亮点(新品等)、邀约预约时间。简短热情。缺失用【待补充】。附中文要点。\n信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.trade-incoterms', label: 'Incoterms条款说明', shortLabel: 'Incoterms说明', icon: '🚢',
    tags: ['外贸', '分析', '术语'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '解释合同中所用贸易术语(FOB/CIF/DDP等)下双方的责任、费用、风险划分边界。',
    systemPrompt: '你是一位外贸结算专家,解释 Incoterms 贸易术语下的责任费用风险划分。基于通用规则说明,涉及具体年份版本差异时提示以合同约定版本为准。',
    userPromptTemplate: `请说明下面文本所用贸易术语下的责任划分:\n## 术语识别\n## 卖方责任与费用承担到哪\n## 买方责任与费用承担\n## 风险转移点\n## 实务注意(保险/清关等)\n文本:\n---\n{{input}}\n---` })
])

export function mergeTradeIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...TRADE_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { TRADE_BUILTIN_ASSISTANTS, mergeTradeIntoBuiltins }
