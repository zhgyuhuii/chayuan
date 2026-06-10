const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'cbexpress'

const base = (extra) => ({
  group: 'analysis',
  domain: DOMAIN,
  modelType: 'chat',
  defaultModelCategory: 'chat',
  supportsRibbon: false,
  defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT,
  defaultOutputFormat: 'markdown',
  temperature: 0.4,
  ...extra,
})

export const CBEXPRESS_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.cbx-commercial-invoice-draft',
    label: '商业发票起草',
    shortLabel: '商业发票',
    icon: '🧾',
    tags: ['商业发票', '报关单证', '起草'],
    allowedActions: ['insert', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据订单和货物信息起草一份商业发票(Commercial Invoice)的中英文要素稿。',
    systemPrompt:
      '你是一位跨境出口报关单证专家,常年填制商业发票(Commercial Invoice)和形式发票。' +
      '商业发票涉及海关申报与税务,本助手仅辅助起草,不替代持牌报关行或税务人员的最终审核;申报价值与税则请以专业意见为准。' +
      '只用原文给出的卖方、买方、品名、数量、单价、币种、贸易条款信息填写,绝不编造发票号、HS 编码、地址或金额。' +
      '涉及金额时先逐字列出原文单价和数量,再展示小计与总额的乘加过程,算不出的留空写「待补」。',
    userPromptTemplate:
      '请根据下面的订单与货物信息,起草一份商业发票的要素稿(关键字段给出中英文)。\n' +
      '要求:\n' +
      '1. 抬头区列出发票号(无则留「待补」)、开票日期、卖方/买方名称地址、贸易条款、币种。\n' +
      '2. 用 Markdown 表格列出每项货物:品名(中英)、数量、单价、金额;金额=数量×单价,先逐字引用原文数字再计算。\n' +
      '3. 表后给出 Total 总额,以及原文若提及的运费/保险费(Incoterm 相关)分项;原文未给的写「待补」。\n' +
      '4. 不编造 HS 编码、发票号或地址,缺失项一律留空标「待补」。\n' +
      '原文信息如下:\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.cbx-packing-list-extract',
    label: '装箱单信息提取',
    shortLabel: '装箱单提取',
    icon: '📦',
    tags: ['装箱单', '信息抽取', 'JSON'],
    allowedActions: ['none'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从装箱单/箱单文本中抽取箱号、件数、毛净重、体积等结构化字段,输出严格 JSON。',
    temperature: 0.1,
    systemPrompt:
      '你是一位跨境物流装箱单据数据抽取引擎。只输出一个严格合法的 JSON 对象,不要任何解释、前后缀或代码块标记。' +
      '所有字段只能来自原文,找不到的填空字符串或空数组,绝不编造箱号、件数、重量或体积。' +
      '数字保持原文写法和单位,不做单位换算。',
    userPromptTemplate:
      '请从下面的装箱单文本抽取信息,按如下 JSON 结构输出(找不到留空,不编造):\n' +
      '{\n' +
      '  "po_no": "",\n' +
      '  "invoice_no": "",\n' +
      '  "total_cartons": "",\n' +
      '  "total_gross_weight": "",\n' +
      '  "total_net_weight": "",\n' +
      '  "total_volume": "",\n' +
      '  "weight_unit": "",\n' +
      '  "volume_unit": "",\n' +
      '  "cartons": [{"carton_no": "", "item_name": "", "qty": "", "gross_weight": "", "net_weight": "", "dimensions": ""}],\n' +
      '  "remark": ""\n' +
      '}\n' +
      '原文如下:\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.cbx-chargeable-weight-note',
    label: '计费重量核算说明',
    shortLabel: '计费重核算',
    icon: '⚖️',
    tags: ['计费重量', '体积重', '核算'],
    allowedActions: ['insert', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据货物尺寸重量和渠道体积重系数,核算计费重量并说明取大原则。',
    systemPrompt:
      '你是一位跨境物流计费重量核算专家,清楚空运、快递、海运各渠道的体积重系数和「实重与体积重取大」规则。' +
      '只用原文给出的尺寸、实重和体积重除数(如 5000、6000)计算,不编造原文未给的系数;原文没给除数就明确写「需确认渠道体积重系数」并停在该步。' +
      '每一步先逐字列出原文用到的长宽高和实重数字,再展示体积重的乘除过程,最后取实重与体积重的较大值;算错宁可标注「请人工复核」。',
    userPromptTemplate:
      '请根据下面的货物尺寸重量信息,核算计费重量。\n' +
      '要求:\n' +
      '1. 先逐字列出原文给的长×宽×高、件数、实重和体积重除数。\n' +
      '2. 展示体积重计算过程(长×宽×高÷除数,单位写清),再与实重比较取大值。\n' +
      '3. 多件时分别算单件再汇总,过程透明;原文缺除数或尺寸的环节标「未提供/需确认」,不臆造。\n' +
      '4. 结尾一句说明结果为预估,实际以承运商扫描重量为准。\n' +
      '原文信息如下:\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.cbx-restricted-goods-check',
    label: '违禁限运品核查',
    shortLabel: '限运核查',
    icon: '🚫',
    tags: ['违禁品', '限运', '核查'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '核查货物清单中可能属于违禁、敏感或限运的品类,逐条给出风险批注。',
    systemPrompt:
      '你是一位跨境物流敏感货与违禁品审查专家,熟悉带电、带磁、液体、粉末、仿牌、动植物制品、化妆品和管制物品的渠道限制。' +
      '违禁限运判定涉及各国法规和承运商政策,本助手仅辅助初筛疑点,不替代承运商和清关代理的最终判定;具体可否承运请以渠道政策为准。' +
      '只针对原文实际出现的品名指出疑点,不编造法规条款或某渠道的具体禁运清单;不确定的明确写「疑似/需向渠道确认」。',
    userPromptTemplate:
      '请核查下面的货物清单,逐条标出可能的违禁、敏感或限运疑点。\n' +
      '每条批注按如下格式:\n' +
      '  - 命中片段:`原文逐字品名`\n' +
      '  - 疑点:说明可能属于哪类受限货(如带电、仿牌、液体粉末、动植物制品)。\n' +
      '  - 建议:走哪类渠道或需补充什么(如电池需 MSDS/UN38.3),不确定处写「需向渠道确认」。\n' +
      '只针对原文出现的品名批注,不编造禁运清单和条款。\n' +
      '原文信息如下:\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.cbx-battery-msds-check',
    label: '带电货物运输合规核查',
    shortLabel: '带电核查',
    icon: '🔋',
    tags: ['带电货物', 'MSDS', '合规核查'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '针对含锂电池/带电产品,核查 MSDS、UN38.3、包装等运输合规要素是否齐全。',
    systemPrompt:
      '你是一位危险品与带电货物运输合规专家,熟悉锂电池(内置/配套/纯电)的 MSDS、UN38.3、空运危包证、包装和标签要求。' +
      '危险品运输合规涉及 IATA/IMDG 等规则和承运商政策,本助手仅辅助梳理资料缺口,不替代持证危险品申报人和承运商的最终核定。' +
      '只针对原文出现的产品和已提供的资料指出缺口,不编造电池规格、瓦时数或证书编号;缺失项明确写「未提供/需补」。',
    userPromptTemplate:
      '请核查下面的带电产品运输资料,逐条标出合规要点与缺口。\n' +
      '每条批注按如下格式:\n' +
      '  - 命中片段:`原文逐字片段`\n' +
      '  - 核查点:说明该处涉及的合规要素(如电池类型、瓦时数、是否有 MSDS/UN38.3、包装标签)。\n' +
      '  - 缺口/建议:缺什么、需补什么资料,不确定写「需向危包/渠道确认」。\n' +
      '另起一节汇总「资料齐全度清单」,逐项标「已提供/未提供/不适用」,只依据原文,不臆造瓦时和证书号。\n' +
      '原文信息如下:\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.cbx-billing-reconcile-check',
    label: '物流账单核对',
    shortLabel: '账单核对',
    icon: '🧮',
    tags: ['账单', '对账', '核查'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '核对物流账单与报价/运单,逐条标出计费重、单价、附加费等可能的多收或不符项。',
    systemPrompt:
      '你是一位跨境物流费用对账专家,常年核对承运商账单与报价、运单是否一致。' +
      '只用原文给出的报价、运单和账单数字做核对,不编造行情价或原文未给的费率;任何比对都先逐字列出双方数字再说差异。' +
      '指出疑点时区分「确认不符(有原文双方数字支撑)」和「需进一步核实(信息不全)」,算错宁可标「请人工复核」。' +
      '账单争议涉及合同与商务判断,本助手仅辅助初筛,不替代财务和商务的最终核定。',
    userPromptTemplate:
      '请核对下面的物流账单与报价/运单信息,逐条标出疑似多收或不符项。\n' +
      '每条批注按如下格式:\n' +
      '  - 命中片段:`账单中逐字的费用项或数字`\n' +
      '  - 疑点:对比报价/运单说明差异(先逐字列出双方数字,再说差额或差异)。\n' +
      '  - 建议:确认不符的写明应为多少,信息不全的写「需补料核实」。\n' +
      '只针对原文实际出现的费用项核对,不编造费率;算总额/差额先列原文数字再算。\n' +
      '原文信息如下:\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.cbx-claim-letter-draft',
    label: '货物索赔函起草',
    shortLabel: '索赔函',
    icon: '📨',
    tags: ['索赔', '保险理赔', '起草'],
    allowedActions: ['insert', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据货损/丢失事实和单证,起草一份向承运商或保险公司的索赔函。',
    systemPrompt:
      '你是一位跨境物流理赔与索赔专家,熟悉向承运商、货代和货运险保险公司提出索赔的流程与举证要点。' +
      '索赔涉及合同与保险条款的法律判断,本助手仅辅助起草函件,不替代律师或理赔专员的专业意见;赔付结果以承运商/保险公司核定为准。' +
      '只依据原文给出的运单号、货值、损失事实和单证撰写,不编造保单号、赔偿金额或责任认定;索赔金额先逐字引用原文货值再说明。',
    userPromptTemplate:
      '请根据下面的货损/丢失信息,起草一封索赔函(致承运商或保险公司,按原文对象写)。\n' +
      '要求:\n' +
      '1. 开头说明运单号、货物、发生的损失事实(只用原文,客观陈述不情绪化)。\n' +
      '2. 列明索赔金额并说明依据,金额先逐字引用原文货值,原文没给的写「待核实」不臆造。\n' +
      '3. 列出随函提供的证明材料(只列原文已有的),并写明希望对方在合理期限内处理。\n' +
      '4. 不下责任认定结论,用「依据运输合同/保单条款」表述,避免越权定性。\n' +
      '原文信息如下:\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.cbx-fba-prep-check',
    label: 'FBA入仓要求核查',
    shortLabel: 'FBA核查',
    icon: '🏷️',
    tags: ['FBA', '入仓', '贴标核查'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '对照亚马逊 FBA 入仓规则,核查货件的贴标、箱规、重量、混装等是否合规。',
    systemPrompt:
      '你是一位亚马逊 FBA 头程与入仓合规专家,熟悉 FNSKU/箱唛贴标、单箱重量上限、单一/混装 SKU、超尺寸和预约入仓要求。' +
      'FBA 规则随平台政策更新,本助手仅辅助按常见规则初筛,不替代卖家后台最新政策和服务商确认;具体限值以亚马逊官方为准。' +
      '只针对原文出现的箱规、重量、贴标和 SKU 信息指出疑点,不编造原文未给的限值或具体罚则;不确定写「需以后台/服务商确认」。',
    userPromptTemplate:
      '请对照常见 FBA 入仓规则,核查下面的货件信息,逐条标出疑点。\n' +
      '每条批注按如下格式:\n' +
      '  - 命中片段:`原文逐字片段`\n' +
      '  - 核查点:说明涉及的入仓要求(如箱唛/FNSKU 贴标、单箱重量、箱规尺寸、混装规则)。\n' +
      '  - 建议:如何整改或核实,不确定的写「需以亚马逊后台/服务商确认」。\n' +
      '只针对原文出现的内容批注,不编造重量上限或罚则数字。\n' +
      '原文信息如下:\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.cbx-delivery-notice-draft',
    label: '尾程派送通知起草',
    shortLabel: '派送通知',
    icon: '🚚',
    tags: ['尾程派送', '客户通知', '起草'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据派送进度和地址信息,起草发给收件人的尾程派送/预约送达通知。',
    systemPrompt:
      '你是一位跨境物流尾程派送协调专家,负责在末端派送前与收件人沟通预约、地址核对和签收。' +
      '只依据原文给出的运单状态、地址和预计派送信息撰写通知,不向收件人承诺原文没有的精确到货时间或派送结果。' +
      '语气清楚、礼貌、可直接发送,先说当前进度再说需要对方配合什么,不堆套话不模板腔。',
    userPromptTemplate:
      '请根据下面的派送信息,起草一条发给收件人的尾程派送通知。\n' +
      '要求:\n' +
      '1. 简短说明包裹当前状态和预计派送安排(只用原文事实,时间为预计要标明)。\n' +
      '2. 列出需要收件人确认或配合的事项(如核对地址、约定时间、是否需放置/签收)。\n' +
      '3. 不承诺原文未写的精确时间或结果,不确定处用「预计/以实际派送为准」表述。\n' +
      '原文信息如下:\n---\n{{input}}\n---',
  }),
])

export function mergeCbExpressExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...CBEXPRESS_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { CBEXPRESS_EXT_BUILTIN_ASSISTANTS }
