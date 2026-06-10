/**
 * builtinAssistantsRealEstateExt — 「房地产/物业」领域扩展助手包
 * 在现有 builtinAssistantsRealEstate.js 之外补充新的高频文书/核查/抽取助手,语义不与现有重复。
 * 现有已覆盖:房源描述/购房合同审查/租赁合同审查/物业通知/楼盘卖点/装修预算/带看话术/
 *   物业制度/交接清单/业主回复/登记要素提取/投资分析。
 * 本扩展补:居间合同审查、网签合同抽取、商业物业服务合同审查、业主大会公告、税费测算、
 *   尽调清单、催缴函、查验整改回执、土地证抽取、定金/认购书审查。
 * 约束:面积/价格/税率/证号照原文,不编造产权与证件信息,审查类逐字反引号锚点,涉法律/税务标「仅辅助」。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'realestate'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const REALESTATE_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.re-brokerage-review', label: '中介居间合同审查', shortLabel: '居间合同审查', icon: '🤝',
    tags: ['房产', '核查', '居间'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查房产中介居间/服务合同对委托方不利之处:佣金比例与支付节点、独家委托、跳单条款、服务范围与违约金。',
    systemPrompt: '你是一位房产交易法务专家,审查中介居间服务合同对委托方的风险。命中片段必须原文逐字、反引号包裹;佣金比例/金额照原文;不确定标「待人工核实」;仅辅助,不替代律师。',
    userPromptTemplate: `请审查下面中介居间/服务合同,逐项检查:佣金比例与计算基数(照原文)、佣金支付时点(签约付还是过户付)、独家委托与期限、跳单/绕开中介的违约条款、服务范围与未尽事项、定金代收与资金安全、解除与退费条件。\n## 风险/不利条款 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n说明:仅辅助审查,签约前请咨询专业律师。\n合同:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.re-deposit-review', label: '认购书定金审查', shortLabel: '认购定金审查', icon: '✍️',
    tags: ['房产', '核查', '定金'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查认购书/定金协议:定金与订金区分、退定条件、签约期限、价格锁定、转为正式合同的衔接,防止定金被没收。',
    systemPrompt: '你是一位房产交易法务专家,审查认购书与定金协议对买方的风险。命中片段必须原文逐字、反引号包裹;定金金额照原文;辨明「定金」与「订金」法律后果差异;不确定标「待人工核实」;仅辅助,不替代律师。',
    userPromptTemplate: `请审查下面认购书/定金协议,逐项检查:用的是"定金"还是"订金"及其退还后果、定金金额(照原文)、签订正式合同的期限与地点、退定与没定的具体情形、价格与房号是否锁定、贷款办不下来如何处理、未尽条款以谁的版本为准。\n## 风险/不利条款 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n说明:仅辅助审查,不替代专业法律意见。\n协议:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.re-pm-service-review', label: '物业服务合同审查', shortLabel: '物业服务审查', icon: '🏢',
    tags: ['物业', '核查', '合同'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查物业服务合同(业主/业委会视角):服务标准与考核、物业费构成与调价、公共收益归属、退出交接、违约责任。',
    systemPrompt: '你是一位物业管理与社区治理法务专家,从业主/业委会视角审查物业服务合同。命中片段必须原文逐字、反引号包裹;费率金额照原文;不确定标「待人工核实」;仅辅助,不替代律师。',
    userPromptTemplate: `请从业主方视角审查下面物业服务合同,逐项检查:服务内容与质量标准是否可量化考核、物业费单价与计费面积(照原文)、调价机制与触发条件、公共收益(广告位/停车/场地)归属与公示、合同期限与自动续约、退出与档案设施移交、违约金与解除权是否对等。\n## 风险/不利条款 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n合同:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.re-tax-estimate', label: '房产交易税费测算', shortLabel: '交易税费测算', icon: '🧮',
    tags: ['房产', '测算', '税费'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '基于给定成交价/面积/年限等测算二手房交易税费:契税、增值税、个税、中介费等,先列原文数字再算。',
    systemPrompt: '你是一位房产交易顾问,基于给定信息测算交易税费。所有税率与金额先列原文数字再做计算,过程可追溯;政策按当地为准、税率不明时标注假设;仅辅助测算,以税务机关与当地政策为准。',
    userPromptTemplate: `请基于下面信息测算二手房交易税费。先把原文给出的关键数字逐字摘出(如 - 成交价:\`原文逐字片段\`、- 建筑面积:\`原文逐字片段\`),再逐项列出:契税(说明首套/二套与面积档位)、增值税及附加(满两年/满五唯一情形)、个人所得税(差额或核定)、中介与权证代办费。每项先抄原文数字再算,缺税率时标"按当地政策,此处假设X%"。最后给税费合计与买卖双方各自承担明细。\n说明:本测算仅辅助参考,实际以税务机关核定与当地最新政策为准,不替代专业税务人员。\n交易信息:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.re-owners-meeting-notice', label: '业主大会议事公告', shortLabel: '业主大会公告', icon: '🗳️',
    tags: ['物业', '生成', '业主大会'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把议题写成规范的业主大会/业委会会议公告或表决通知:议程、表决事项、参与与投票方式、有效门槛。',
    systemPrompt: '你是一位社区治理与业委会事务专家,撰写规范、合规、便于业主参与的业主大会公告。时间地点议题照给定信息,表述中立不诱导,表决门槛按相关规定提示。',
    userPromptTemplate: `请把下面议题写成业主大会/业委会会议公告:标题、致全体业主、会议时间与地点(或线上方式)、议程与待表决事项逐条列明、参会与委托投票方式、表决与计票规则及有效门槛、材料查阅与联系方式、落款日期。表述中立不诱导。\n议题:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.re-fee-demand-letter', label: '物业费催缴函', shortLabel: '催缴函', icon: '📨',
    tags: ['物业', '生成', '催缴'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把欠费信息写成得体而有约束力的物业费催缴函/缴费提醒:欠费明细、缴费方式、期限、逾期后果。',
    systemPrompt: '你是一位物业管理专家,撰写既有礼貌又有约束力的物业费催缴函。欠费金额与期数照给定信息,语气先服务后告知,不威胁、不超越合法手段,逾期后果如实表述。',
    userPromptTemplate: `请把下面欠费信息写成物业费催缴函:抬头与称呼、说明欠费项目/期数/金额(照原文)、本次服务内容回顾、缴费方式与渠道、缴清期限、逾期处理(违约金/公示/诉讼等如实说明)、沟通联系方式、落款。语气得体、依据充分。\n欠费信息:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.re-due-diligence-checklist', label: '二手房尽调清单', shortLabel: '尽调清单', icon: '🔍',
    tags: ['房产', '生成', '尽调'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '生成二手房购买前尽职调查清单:产权与查封、抵押与户口、欠费与维修金、规划与瑕疵等核查项,每项留确认位。',
    systemPrompt: '你是一位房产交易尽职调查顾问,生成系统、可勾选的二手房尽调清单。基于给定房源情况列核查项,提示需查验的原件与官方渠道,不臆断结论;仅辅助核查,涉权属争议请咨询律师。',
    userPromptTemplate: `请根据下面房源情况生成二手房尽调清单,分组列出可勾选核查项并留"是否核实/备注"位:① 产权(权属人、是否共有、是否查封/诉讼)② 抵押与债务(银行抵押、是否需先解押)③ 户口与占用(原户口迁出、是否有租约/买卖不破租赁)④ 费用(物业/水电/取暖欠费、专项维修金余额)⑤ 房屋本身(实测面积、装修与瑕疵、违建/加建、是否凶宅敏感)⑥ 规划与配套(学区学位占用、动迁规划)⑦ 资金与流程(资金监管、过户与放款顺序)。每组提示需查的原件与官方查询渠道。若原文已提及具体瑕疵或限制,请逐字标出锚点(如 - 原文提及:\`原文逐字片段\`)并列为优先核查项。\n说明:仅辅助尽调,涉权属争议以官方登记与专业法律意见为准。\n房源情况:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.re-inspection-record', label: '验房整改回执', shortLabel: '验房回执', icon: '🪛',
    tags: ['房产', '生成', '验房'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把验房发现的问题整理成整改通知/回执:问题部位、现象、整改要求、期限、复验确认,便于开发商与业主对接。',
    systemPrompt: '你是一位房屋查验工程师,把验房问题整理成清晰可追踪的整改回执。问题描述照给定信息客观陈述,分部位与严重程度,不夸大也不漏项,每项留整改与复验状态。',
    userPromptTemplate: `请把下面验房发现整理成整改通知/回执表,逐条列:序号 | 部位(如客厅/卫生间) | 问题现象 | 严重程度(影响使用/观感) | 整改要求 | 期限 | 复验结论(待复验)。表后附:涉及主体结构/防水/电气安全的优先项提醒、复验与签字确认栏。问题照原文客观陈述,涉及安全的关键描述请逐字标出锚点(如 - 原文:\`原文逐字片段\`)。\n验房发现:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.re-presale-permit-extract', label: '预售证照信息抽取', shortLabel: '证照抽取', icon: '📜',
    tags: ['房产', '提取', '证照'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从商品房预售许可证/五证材料抽取项目名称、证号、批准机关、预售范围、楼栋等关键要素,输出结构化。',
    systemPrompt: '你是一位房地产开发报建专员,从预售许可与五证材料抽取要素,输出严格 JSON。证号、面积、栋号照原文逐字;找不到的字段留空字符串,不编造、不推断。',
    userPromptTemplate: `请从下面预售/证照材料抽取要素,只输出严格 JSON(找不到留空,不编造):\n{"projectName":"","permitNo":"","permitType":"","issuingAuthority":"","issueDate":"","developer":"","saleScope":"","buildings":"","totalArea":"","landUseRight":"","planPermitNo":""}\n材料:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.re-netsign-extract', label: '网签合同信息抽取', shortLabel: '网签抽取', icon: '🧾',
    tags: ['房产', '提取', '网签'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从网签购房合同抽取买卖双方、房屋坐落、面积、成交价、付款方式、交付与违约约定等关键字段,输出结构化。',
    systemPrompt: '你是一位房产交易过户代办,从网签购房合同抽取关键字段,输出严格 JSON。坐落、面积、成交价、日期照原文逐字;找不到的字段留空字符串,不编造、不换算。',
    userPromptTemplate: `请从下面网签购房合同抽取要素,只输出严格 JSON(找不到留空,不编造):\n{"contractNo":"","seller":"","buyer":"","location":"","buildingArea":"","insideArea":"","totalPrice":"","unitPrice":"","paymentMethod":"","loanAmount":"","handoverDate":"","areaDiffClause":"","liquidatedDamages":""}\n合同:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.re-clause-polish', label: '合同条款润色', shortLabel: '条款润色', icon: '🖋️',
    tags: ['房产', '改写', '条款'], allowedActions: ['replace', 'comment', 'append', 'none'], defaultAction: 'replace', defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.25,
    description: '把口语化或含糊的房产/物业条款改写成严谨、权责清晰、可执行的正式合同语言,不改变原意与原始金额。',
    systemPrompt: '你是一位房地产合同起草专家,把选中的条款改写得严谨、权责明确、无歧义。不改变原意、不新增义务、金额与期限照原文;仅作文字打磨,实质条款仍需律师确认。',
    userPromptTemplate: `请把下面房产/物业合同条款改写成严谨规范的正式表述:明确主体与权责、消除"等""及时""适当"等模糊词、统一金额与期限表述(照原文)、补齐违约与争议解决的指向但不擅自加重一方义务。只输出改写后的条款。\n说明:仅作文字润色,实质法律效力请由专业律师确认。\n原条款:\n---\n{{input}}\n---` })
])

export function mergeRealEstateExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...REALESTATE_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { REALESTATE_EXT_BUILTIN_ASSISTANTS, mergeRealEstateExtIntoBuiltins }
