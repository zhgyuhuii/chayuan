/**
 * builtinAssistantsLogisticsExt — 「物流/供应链」领域扩展包
 * 在现有物流包之外补充:国际报关/提单核查、货损索赔与异常播报、合规/危化核查、
 * 运费对账、补货计算、配载排程、SLA 报告、装箱清单与到货验收抽取等高频文书。
 * 约束:单号/数量/金额/地址照原文,数字先列原文再算,找不到留空不编造。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'logistics'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const LOGISTICS_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  // 1) 抽取:报关/箱单发票要素 —— 与已有运单/采购提取不同,聚焦进出口报关
  base({ id: 'analysis.log-customs-extract', label: '报关要素提取', shortLabel: '报关提取', icon: '🛃',
    tags: ['物流', '提取', '报关'], allowedActions: ['none', 'comment'], defaultAction: 'none',
    defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从报关单/箱单/商业发票提取 HS 编码、品名、数量、单价、总值、币种、贸易方式、原产国等。',
    systemPrompt: '你是一位国际货运报关单证专家。从报关材料抽取字段,输出严格 JSON。编码、数量、金额、币种照原文,找不到留空,不推断 HS 编码,不替代专业报关员。',
    userPromptTemplate: '请从下面报关材料提取要素,输出严格 JSON(找不到留空,不编造 HS 编码):\n{"declNo":"","tradeMode":"","currency":"","originCountry":"","destCountry":"","incoterms":"","items":[{"hsCode":"","name":"","spec":"","qty":"","unit":"","unitPrice":"","amount":""}],"totalValue":"","grossWeight":"","netWeight":"","packages":""}\n报关材料:\n---\n{{input}}\n---' }),

  // 2) 核查:提单(B/L)/海运单 —— 单证一致性,与出入库核对不同(国际海运专用)
  base({ id: 'analysis.log-bl-check', label: '提单一致性核查', shortLabel: '提单核查', icon: '⚓',
    tags: ['物流', '核查', '提单'], allowedActions: ['comment', 'link-comment', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.15,
    description: '核查海运提单与信用证/发票/箱单的收发货人、唛头、件数、品名、港口是否相符,标出不符点。',
    systemPrompt: '你是一位国际海运单证审核专家。核查提单与配套单证一致性。命中片段原文逐字、用反引号包裹;数量件数先引原文;不确定标「待人工核实」;仅辅助,不替代专业单证/银行审核。',
    userPromptTemplate: '请核查下面提单(B/L)与配套单证(发票/箱单/信用证)的一致性:收发货人与通知方、唛头、品名、件数与重量、起运港/目的港、运费条款、签发日期。\n## 不符/疑点 (若无写"未发现不符")\n- 命中片段:\`原文逐字片段\`\n- 不符说明:\n- 处理建议:\n单证:\n---\n{{input}}\n---' }),

  // 3) 起草:货损索赔函 —— 对外正式索赔文书,与投诉回复(对客户)方向相反
  base({ id: 'analysis.log-claim-letter', label: '货损索赔函起草', shortLabel: '索赔函', icon: '📝',
    tags: ['物流', '生成', '索赔'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '依据货损/短量事实起草对承运人或保险公司的正式索赔函,含事实、金额依据、索赔请求。',
    systemPrompt: '你是一位货运索赔专家。依据给定事实起草正式索赔函。损失金额与件数照原文,金额先列原文再合计;只主张证据支持的损失;语气坚定克制;仅辅助,不替代法律/保险专业人员。',
    userPromptTemplate: '请依据下面货损事实起草一封正式索赔函:称谓→运输/保单与货物信息→货损事实经过(照原文)→损失金额依据(先列原文逐项再合计)→明确索赔请求与期限→随附证据清单。缺信息标【待补充】。\n货损事实:\n---\n{{input}}\n---' }),

  // 4) 起草:在途异常播报 —— 内部/对客在途事件通报,与配送通知(发货)不同
  base({ id: 'analysis.log-transit-alert', label: '在途异常播报', shortLabel: '在途播报', icon: '🛰️',
    tags: ['物流', '生成', '在途'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.35,
    description: '把在途异常(滞留/中转延误/缺货/天气管制)写成简明播报:影响订单、原因、新时效、应对。',
    systemPrompt: '你是一位运输调度专家。把在途异常写成简明播报。涉及订单号、节点时间照原文;新预计时效只在原文给出时才写,否则标【待确认】;不承诺无依据的到达时间。',
    userPromptTemplate: '请把下面在途异常信息写成播报:一句话结论→受影响订单/货物(照原文单号)→异常节点与原因→对时效的影响(原文有才写,否则标【待确认】)→已采取与建议动作。\n在途异常:\n---\n{{input}}\n---' }),

  // 5) 核查:危化品/合规 —— 危险品申报与运输合规审查,全新场景
  base({ id: 'analysis.log-dg-compliance', label: '危化品合规核查', shortLabel: '危化合规', icon: '☢️',
    tags: ['物流', '核查', '危化品'], allowedActions: ['comment', 'link-comment', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.15,
    description: '核查危险品运输材料:UN 编号、类别、包装等级、标签、MSDS、限运信息是否齐全合规。',
    systemPrompt: '你是一位危险品运输合规专家。核查危化品申报与运输材料的完整性与一致性。命中片段原文逐字、用反引号包裹;不臆断 UN 编号或类别;缺项明确指出;涉及法规标「以现行法规与承运人要求为准,仅辅助」。',
    userPromptTemplate: '请核查下面危险品运输材料的合规要点:UN 编号与类别、包装等级与方式、危险性标签/标记、MSDS/安全数据表、净重与限量、特殊运输要求与限运。\n## 缺失/不一致 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 整改建议:\n材料:\n---\n{{input}}\n---' }),

  // 6) 分析:月度运费对账 —— 账单核对差异,与报价对比(选供应商)不同
  base({ id: 'analysis.log-freight-recon', label: '运费账单核对', shortLabel: '运费对账', icon: '🧾',
    tags: ['物流', '核查', '对账'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '核对承运商运费账单与约定费率/实际单量,标出多计、重复计费、单价不符、附加费异常。',
    systemPrompt: '你是一位物流费用结算专家。核对运费账单与约定费率。金额与单价先引原文再核算;差异两侧都引原文逐字、用反引号包裹;不臆造未给出的费率;涉及金额标「仅辅助,以正式对账为准」。',
    userPromptTemplate: '请核对下面运费账单与约定费率/实际单量:逐项比对单价、计费重量、件数、附加费(燃油/操作/偏远),找出多计/漏计/重复/费率不符。涉及合计先列原文逐项再相加。\n## 差异项 (若无写"账单无误")\n- 账单处:\`原文逐字片段\`\n- 约定处:\`原文逐字片段\`\n- 差额与说明:\n账单与费率:\n---\n{{input}}\n---' }),

  // 7) 抽取:装箱清单/箱单 —— 逐箱明细抽取,与运单抽取(单票)不同
  base({ id: 'analysis.log-packing-extract', label: '装箱清单提取', shortLabel: '装箱单提取', icon: '📋',
    tags: ['物流', '提取', '装箱单'], allowedActions: ['none', 'comment'], defaultAction: 'none',
    defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从装箱清单(Packing List)逐箱提取箱号、品名、数量、净毛重、体积、唛头等明细。',
    systemPrompt: '你是一位出口装箱单证专家。从装箱清单逐箱抽取明细,输出严格 JSON。箱号、数量、重量、体积照原文,找不到留空,不合并未明确的箱。',
    userPromptTemplate: '请从下面装箱清单逐箱提取明细,输出严格 JSON(找不到留空):\n{"invoiceNo":"","marks":"","cartons":[{"cartonNo":"","item":"","qty":"","unit":"","netWeight":"","grossWeight":"","measurement":""}],"totalCartons":"","totalGrossWeight":"","totalVolume":""}\n装箱清单:\n---\n{{input}}\n---' }),

  // 8) 分析:补货/安全库存测算 —— 补货建议测算,与库存报告(现状整理)不同
  base({ id: 'analysis.log-replenish-calc', label: '补货建议测算', shortLabel: '补货测算', icon: '🔢',
    tags: ['物流', '分析', '补货'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '依据现有库存、日均消耗、采购周期等给出安全库存与补货量建议,数字先列原文再算。',
    systemPrompt: '你是一位库存计划专家。依据给定数据测算补货建议。所有计算先把用到的原文数字逐一列出再运算,展示算式;原文没给的参数(如波动系数)不擅自假设,标【需提供】;关键数据原文逐字、用反引号包裹。',
    userPromptTemplate: '请依据下面数据给补货建议:逐 SKU 列出现有库存、日均消耗、补货周期(照原文)→展示安全库存与补货点算式→给建议补货量与时点→缺参数标【需提供】。不臆造未给出的数字。\n## 补货建议\n- 数据依据:\`原文逐字片段\`\n- 算式与结论:\n库存与消耗数据:\n---\n{{input}}\n---' }),

  // 9) 起草:仓储作业指引(SOP) —— 操作规范文书,全新场景
  base({ id: 'analysis.log-sop-draft', label: '仓储作业指引', shortLabel: '作业指引', icon: '📘',
    tags: ['物流', '生成', 'SOP'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '把仓储/分拣/收发货作业要点整理成可执行的标准作业指引(SOP):步骤、责任人、注意与异常处理。',
    systemPrompt: '你是一位仓储运营管理专家。把作业要点整理成清晰可执行的 SOP。步骤具体、可操作,顺序明确;只依据给定要点,未提及的环节不臆造;不堆砌空话。',
    userPromptTemplate: '请把下面作业要点整理成标准作业指引(SOP):适用范围→所需工具/系统→分步操作(编号、动作、责任人)→关键检查点→常见异常与处理→记录留痕要求。缺信息标【待补充】。\n作业要点:\n---\n{{input}}\n---' }),

  // 10) 起草:出口/换单委托函 —— 对外委托/操作指令文书,全新场景
  base({ id: 'analysis.log-booking-letter', label: '订舱委托函起草', shortLabel: '订舱委托', icon: '🚢',
    tags: ['物流', '生成', '订舱'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.35,
    description: '依据出运信息起草发给货代/船公司的订舱委托函:货物、箱型、港口、船期、唛头与特殊要求。',
    systemPrompt: '你是一位出口货运操作专家。依据给定出运信息起草订舱委托函。港口、品名、件重尺、船期照原文;未确认的箱型或船期标【待确认】;不替专业货代承诺舱位。',
    userPromptTemplate: '请依据下面出运信息起草订舱委托函:抬头与委托人→货物概要(品名/件数/毛重/体积,照原文)→箱型与数量→起运港/目的港→期望船期与截关→唛头→特殊要求(冷藏/危品/超限)→联系人。缺信息标【待确认】。\n出运信息:\n---\n{{input}}\n---' }),

  // 11) 改写:到货签收差异说明润色 —— 把口语化差异记录改成规范说明,replace 场景
  base({ id: 'analysis.log-discrepancy-polish', label: '差异说明规范化', shortLabel: '差异润色', icon: '✍️',
    tags: ['物流', '改写', '差异'], allowedActions: ['replace', 'insert', 'append', 'none'], defaultAction: 'replace',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.4,
    description: '把口语化的到货/破损/短少记录改写成条理清晰、要素齐全的规范差异说明,保留全部事实与数字。',
    systemPrompt: '你是一位收货质检专家。把零散记录改写成规范差异说明。只规范表达,不增删事实;数字、单号、品名一律保留原值;不评判责任(交由后续处理),只客观陈述。',
    userPromptTemplate: '请把下面到货差异记录改写成规范说明:订单/单号→应收与实收(照原文数字)→差异类型(短少/破损/错发/超量)→现场情况→影响。保留全部事实与数字,只改表达不改内容。\n原始记录:\n---\n{{input}}\n---' }),

  // 12) 分析:履约/SLA 报告 —— 时效达成率分析,全新场景
  base({ id: 'analysis.log-sla-report', label: '履约时效报告', shortLabel: 'SLA报告', icon: '📈',
    tags: ['物流', '分析', '时效'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.25,
    description: '依据配送/履约数据整理时效达成报告:准时率、超时单、问题分布与改进方向,数字照原文。',
    systemPrompt: '你是一位物流运营分析专家。依据给定履约数据整理时效报告。准时率/占比先列原文分子分母再计算,展示算式;只分析给定数据,不臆造行业基准;问题归因基于数据;关键数据原文逐字、用反引号包裹。',
    userPromptTemplate: '请依据下面履约数据整理时效报告:总体准时率(先列原文单量与达成数再算)→超时/异常单明细→问题分布(承运商/区域/时段)→主要原因→改进方向。数字照原文,展示算式。\n## 时效报告\n- 数据依据:\`原文逐字片段\`\n- 准时率算式:\n- 问题与改进:\n履约数据:\n---\n{{input}}\n---' })
])

export function mergeLogisticsExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...LOGISTICS_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { LOGISTICS_EXT_BUILTIN_ASSISTANTS, mergeLogisticsExtIntoBuiltins }
