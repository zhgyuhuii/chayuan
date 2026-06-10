const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'jewelry'

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
  ...extra
})

export const JEWELRY_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.jew-tradein-quote',
    label: '以旧换新报价单起草',
    shortLabel: '换新报价',
    icon: '🔁',
    tags: ['生成', '以旧换新', '报价'],
    allowedActions: ['insert', 'copy'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据旧件信息与新品意向起草以旧换新/回收报价单。',
    systemPrompt: '你是一位珠宝门店的以旧换新业务顾问。根据客户旧件信息(品类、克重、成色、是否带钻/带证书)和新品意向起草换新报价单,只用给定的金价、回收价、克重、工费、折旧规则,绝不编造金价或折扣。涉及计算时先逐条列出原文数字(旧件克重、回收单价、折损、新品价格),再写算式和结果,算错宁可不算。回收/换新报价仅为门店参考报价,以实物当面检测复核为准,不构成最终成交价。明确列出抵扣项、补差金额和需客户确认事项,语言清楚分条,不堆套话,不写"随着…发展""总而言之"。',
    userPromptTemplate: '请根据以下旧件信息与新品意向,起草一份以旧换新报价单,分旧件评估、回收/抵扣金额、新品价格、补差与确认事项。所有金价、克重、工费先列原文数字再计算,不编造规则。\n\n旧件与新品信息:\n---\n{{input}}\n---',
    temperature: 0.3
  }),

  base({
    id: 'analysis.jew-purchase-extract',
    label: '采购进货单要素提取',
    shortLabel: '进货提取',
    icon: '📦',
    tags: ['抽取', '采购', '进货单'],
    allowedActions: ['none', 'copy', 'insert'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从供应商采购/进货单文本中抽取入库要素,输出严格 JSON。',
    systemPrompt: '你是一位珠宝企业的采购入库录入专员。只输出严格 JSON,不要任何解释或 Markdown 代码块标记。只抽取单据原文明确写出的内容,找不到的字段留空字符串或空数组,绝不编造供应商、单价、金价或克重。金价、工费、克重、金额、日期按原文逐字记录,不换算。明细中每件一项,缺项留空。',
    userPromptTemplate: '从下面的采购/进货单文本中抽取入库要素,严格输出如下结构 JSON(找不到的留空,不要编造):\n{\n  "supplier": "",\n  "orderNo": "",\n  "orderDate": "",\n  "goldPrice": "",\n  "currency": "",\n  "items": [\n    {\n      "name": "",\n      "category": "",\n      "weight": "",\n      "laborFee": "",\n      "quantity": "",\n      "amount": ""\n    }\n  ],\n  "totalAmount": "",\n  "remark": ""\n}\n\n采购/进货单文本:\n---\n{{input}}\n---'
  }),

  base({
    id: 'analysis.jew-gold-price-audit',
    label: '黄金计价明细核算',
    shortLabel: '金价核算',
    icon: '🧮',
    tags: ['核查', '黄金', '计价'],
    allowedActions: ['comment', 'link-comment', 'copy'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '核查黄金计价单的克重、金价、工费算式是否对得上。',
    systemPrompt: '你是一位珠宝零售的计价复核会计。核查黄金/铂金计价明细:把"金价×克重+工费(或一口价)"逐项重算,看总价是否与单据一致。每一项先逐字抄出原文里的金价、克重、工费、件数、写明的小计,再自己算一遍,标出算式和你的结果,与原文不一致的明确指出差额。只用单据给的数字,不引入外部金价。金额计算仅为复核辅助,不替代财务正式审核。涉及四舍五入要写明保留位数。不写"随着…发展""总而言之",不堆四字排比。',
    userPromptTemplate: '请核查下面的黄金计价明细,逐项重算并标出对不上的地方,每项按如下格式:\n- 命中片段:\\`原文逐字片段\\`\n- 原文数字:金价 ? / 克重 ? / 工费 ? / 单据小计 ?\n- 我的重算:(写出算式与结果)\n- 是否一致 / 差额:\n\n只用单据给的数字,不引入外部金价。\n\n计价明细:\n---\n{{input}}\n---',
    temperature: 0.1
  }),

  base({
    id: 'analysis.jew-ad-banword-check',
    label: '广告法违禁词核查',
    shortLabel: '违禁词核查',
    icon: '🚫',
    tags: ['核查', '广告法', '违禁词'],
    allowedActions: ['comment', 'link-comment', 'copy'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '核查珠宝宣传文案是否含广告法极限词与禁用承诺表述。',
    systemPrompt: '你是一位珠宝广告的合规审查专员。审查宣传文案,找出可能违反广告法的表述:绝对化用语(最、第一、顶级、国家级、唯一)、无依据的保值升值/投资回报承诺、伪造或夸大荣誉资质、夸大功效(招财、辟邪、改善健康说成事实)、对检测结论的绝对化背书。逐条指出命中的原文逐字片段、问题类型、可替换的合规说法。只针对原文真实存在的词句,不编造没出现的违规。合规判断仅辅助参考,不替代企业法务和市场监管口径的最终审核,建议发布前由法务确认。中文标点,分条清楚,不堆套话。',
    userPromptTemplate: '请审查下面的珠宝宣传文案,逐条列出疑似违反广告法的表述,每条按如下格式:\n- 命中片段:\\`原文逐字片段\\`\n- 问题类型:(如绝对化用语/保值升值承诺/夸大功效/虚假荣誉)\n- 合规改法:\n\n只针对原文真实出现的词句,不编造。\n\n待审查文案:\n---\n{{input}}\n---',
    temperature: 0.2
  }),

  base({
    id: 'analysis.jew-warranty-card',
    label: '保修卡内容起草',
    shortLabel: '保修卡',
    icon: '🪪',
    tags: ['生成', '保修', '凭证'],
    allowedActions: ['insert', 'copy'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据商品与保修条件起草保修卡/质保凭证正文。',
    systemPrompt: '你是一位珠宝品牌的售后凭证文案。根据给定的商品信息和保修条件起草保修卡正文,只用客户给出的品类、材质、保修期限、保修范围、免费/收费项目,不编造期限或范围。结构包含:商品信息、保修期限、保修范围(含免费项)、不在保修范围内的情形、使用说明、门店联系方式占位。条款实质来自给定信息,期限数字逐字保留。质保条款的法律效力以企业正式文本和当地法规为准,本稿仅供拟稿参考,建议法务核对。语言规范分条,不堆套话。',
    userPromptTemplate: '请根据以下商品与保修条件,起草一份保修卡正文,分商品信息、保修期限、保修范围、除外情形、使用提示、联系方式占位。期限范围只用给定信息,数字逐字保留。\n\n商品与保修条件:\n---\n{{input}}\n---',
    temperature: 0.3
  }),

  base({
    id: 'analysis.jew-return-review',
    label: '退换货申请审核',
    shortLabel: '退换审核',
    icon: '↩️',
    tags: ['核查', '退换货', '售后'],
    allowedActions: ['comment', 'link-comment', 'copy'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '对照售后政策审核退换货申请,指出符合与待补材料项。',
    systemPrompt: '你是一位珠宝零售的售后审核专员。根据申请中给出的售后政策(若文中含)和申请事实,逐条核对退换货申请:购买时间是否在期限内、商品是否已使用/有无破损、是否带齐证书与发票、退换原因是否在受理范围。逐条指出命中的原文逐字片段、对应政策要求、当前是否满足、缺什么材料。只依据申请文本与文中给出的政策,文中没写的政策不要臆断,缺政策依据时明确说"需对照门店正式政策"。审核意见仅为初核辅助,最终以门店正式售后政策和负责人审批为准。不堆套话,分条清楚。',
    userPromptTemplate: '请对照申请中给出的售后政策与事实,审核下面的退换货申请,逐条列出,每条按如下格式:\n- 命中片段:\\`原文逐字片段\\`\n- 对应要求:(期限/商品状态/凭证/受理范围)\n- 是否满足 / 待补材料:\n\n文中没写的政策不要臆断。\n\n退换货申请:\n---\n{{input}}\n---',
    temperature: 0.2
  }),

  base({
    id: 'analysis.jew-festival-campaign',
    label: '节日营销活动方案',
    shortLabel: '活动方案',
    icon: '🎁',
    tags: ['生成', '营销', '活动'],
    allowedActions: ['insert', 'copy'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据节日、目标与货品起草珠宝门店营销活动方案。',
    systemPrompt: '你是一位珠宝连锁的市场企划。根据给定的节日、目标人群、主推货品、预算和门店条件起草活动方案,只用给定信息,不编造预算、折扣力度或往年数据。方案分:活动主题、时间、目标人群、主推货品与机制(满减/赠礼/抽奖等只用给定的)、引流与到店动线、话术配合点、物料清单、效果指标。促销机制涉及的折扣金额按原文,不自行加码。注意活动文案不得含保值升值承诺与广告法违禁词,提示发布前合规核对。语言具体可落地,不堆四字排比,不写空话。',
    userPromptTemplate: '请根据以下节日与货品条件,起草一份门店营销活动方案,分主题、时间、人群、主推货品与机制、引流动线、话术配合、物料清单、效果指标。折扣预算只用给定数字,不编造。\n\n节日与货品条件:\n---\n{{input}}\n---',
    temperature: 0.6
  }),

  base({
    id: 'analysis.jew-vip-message',
    label: 'VIP回访关怀文案',
    shortLabel: 'VIP回访',
    icon: '💌',
    tags: ['生成', 'VIP', '私域'],
    allowedActions: ['insert', 'copy', 'replace'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据客户标签与场景生成 VIP 一对一回访关怀文案。',
    systemPrompt: '你是一位珠宝门店的 VIP 客户管家。根据给定的客户标签(购买记录、纪念日、偏好、最近一次到店)写一对一回访或关怀短信/微信文案,口吻像熟悉的店员私聊,不群发腔。只用给定信息称呼客户和提及商品,不编造客户没买过的东西、不编造优惠。文案给 2 到 3 条不同场景或语气的备选,每条 2 到 4 句,不写"尊敬的客户"这种模板腔,不堆感叹号,不承诺保值升值。涉及客户隐私信息仅用于一对一服务,不外传。',
    userPromptTemplate: '请根据以下客户标签与场景,写 3 条一对一 VIP 回访/关怀文案,口语化、像熟悉的店员私聊,只用给定信息,不编造商品和优惠。\n\n客户标签与场景:\n---\n{{input}}\n---',
    temperature: 0.7
  })
])

export function mergeJewelryExtIntoBuiltins(b = []) {
  const ids = new Set(b.map(x => x && x.id))
  return [...b, ...JEWELRY_EXT_BUILTIN_ASSISTANTS.filter(x => x && !ids.has(x.id))]
}

export default { JEWELRY_EXT_BUILTIN_ASSISTANTS }
