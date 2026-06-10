/**
 * builtinAssistantsEcommerceExt — 「电商/零售」领域助手扩展包
 * 在现有 builtinAssistantsEcommerce 之外补充高频且互不重复的文书/核查/抽取助手。
 * 约束:只用给定信息,不编造功效/销量/资质;规避广告法绝对化用语;中文标点。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'ecommerce'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const ECOMMERCE_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.ec-bad-review-reply', label: '差评公开回复', shortLabel: '差评回复', icon: '🗯️',
    tags: ['电商', '客服', '差评'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.4,
    description: '针对买家差评写公开回复:先认问题、说处理、给后续,语气克制不甩锅,让后来人看了放心。',
    systemPrompt: '你是一位电商售后主管,写公开可见的差评回复。回复是给后来浏览的潜在买家看的,所以要克制、就事论事、把已做或将做的处理讲清楚。不甩锅给买家、不贴标签、不暴露买家隐私、不空喊口号。只用给定信息,不编造补偿承诺。',
    userPromptTemplate: `请针对下面这条差评写 2 个版本的公开回复(各 2-4 句):先回应买家具体不满→说明原因或已做的处理→给一个明确的后续动作(如联系客服、补寄、改进)。语气真诚克制,不辩解过头。\n差评内容(及可用信息):\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.ec-dispute-appeal', label: '平台申诉举证', shortLabel: '申诉举证', icon: '⚖️',
    tags: ['电商', '申诉', '举证'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把纠纷经过整理成给平台小二的申诉陈述:时间线清楚、举证对应诉点、诉求明确,提高判定胜率。',
    systemPrompt: '你是一位电商客诉申诉专员,擅长把零散的纠纷经过整理成条理清楚、有证据支撑的平台申诉材料。按时间线陈述,每个争议点对应可提交的凭证(聊天记录/物流单号/质检报告),诉求写明确。只用给定事实,不编造证据;无凭证的点标注「需补充凭证」。本助手仅辅助整理,不替代平台规则判定与专业人员。',
    userPromptTemplate: `请把下面的纠纷经过整理成平台申诉陈述,结构:\n## 事情经过(按时间先后)\n## 争议焦点与我方举证(逐条:对方主张 / 我方事实 / 可提交凭证)\n## 申诉诉求\n缺少凭证的点标「需补充凭证」,不要编造。\n纠纷经过与现有材料:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.ec-listing-compare', label: '竞品卖点对比', shortLabel: '竞品对比', icon: '📊',
    tags: ['电商', '分析', '竞品'], allowedActions: ['comment', 'link-comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    temperature: 0.3,
    description: '对比本品与竞品的卖点/参数/价格,指出差异化机会与劣势项,并锚定原文依据。',
    systemPrompt: '你是一位电商商品企划,对比本品与竞品并找出差异化空间。只用给定资料里的事实做对比,缺失项标「资料未提及」,不臆测竞品参数。命中的原文片段逐字、用反引号包裹,便于核对。',
    userPromptTemplate: `请对比下面给出的本品与竞品资料,输出:\n## 对比表(维度 | 本品 | 竞品 | 优劣判断)\n## 我方差异化机会\n## 我方劣势与应对建议\n关键判断要锚定原文,例如:\n  - 依据片段:\`原文逐字片段\`\n资料未提及的维度标「资料未提及」,不要编造竞品数据。\n本品与竞品资料:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.ec-review-mining', label: '买家评价洞察', shortLabel: '评价洞察', icon: '🔎',
    tags: ['电商', '分析', '评价'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    temperature: 0.3,
    description: '从一批买家评价里归纳好评点、差评点、被反复提到的问题与改进优先级,锚定原文。',
    systemPrompt: '你是一位电商用户研究,从真实买家评价中归纳产品与服务的问题。只统计给定评价里出现的内容,提到次数据实写,不夸大不脑补使用场景。引用具体评价时逐字、用反引号包裹。',
    userPromptTemplate: `请从下面的买家评价里归纳:\n## 高频好评点(按提及多少排序)\n## 高频差评/问题点(按提及多少排序,各附一句原话)\n  - 原话:\`买家逐字片段\`\n## 改进优先级建议(先动哪个)\n只统计文本里实际出现的内容,次数据实,不要编造。\n买家评价:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.ec-supplier-contract-review', label: '供货合同审查', shortLabel: '供货合同审查', icon: '📑',
    tags: ['电商', '审查', '合同'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    temperature: 0.2,
    description: '审查供货/采购合同里对采购方不利或易起争议的条款:账期、退换、质保、违约、独家、价格调整。',
    systemPrompt: '你是一位电商供应链法务,审查供货采购合同中对采购方不利或表述模糊的条款,关注账期与回款、退换货与残次处理、质量保证与责任划分、违约金、价格调整机制、独家与排他、发票与税务。命中条款逐字、用反引号包裹;给出风险与修改方向。本助手仅辅助审阅,不替代执业律师意见。',
    userPromptTemplate: `请审查下面合同条款,逐条列出对采购方的风险:\n## 风险条款(若无写"未发现明显不利条款")\n  - 命中片段:\`原文逐字片段\`\n  - 风险:\n  - 建议修改方向:\n## 缺失但建议补充的条款\n只基于给定文本,不臆测未写明的约定。\n合同内容:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.ec-aftersale-sop', label: '售后流程SOP', shortLabel: '售后SOP', icon: '🧭',
    tags: ['电商', '生成', '流程'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把售后场景写成可落地的客服 SOP:触发条件、处理步骤、话术要点、升级与赔付边界。',
    systemPrompt: '你是一位电商客服管理,把售后场景沉淀成新人能直接照做的 SOP。步骤可执行、判断条件清楚、写明何时升级主管、赔付与让步的边界在哪。只用给定政策与场景,不自行扩大赔付权限。',
    userPromptTemplate: `请把下面售后场景写成客服 SOP,结构:\n## 适用场景与触发条件\n## 处理步骤(编号,每步含动作与判断)\n## 关键话术要点\n## 升级条件与赔付边界\n只依据给定政策,超出范围的标「需主管确认」。\n场景与政策:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.ec-shipping-notice', label: '发货物流通知', shortLabel: '物流通知', icon: '🚚',
    tags: ['电商', '生成', '物流'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '生成发货延迟、缺货改期、节假日停发、地区限发等物流通知,信息齐全、安抚到位、减少投诉。',
    systemPrompt: '你是一位电商运营,写面向买家的物流类通知。把关键信息(原因、影响范围、新时间、可选方案)讲齐,语气安抚但不空泛承诺。只用给定信息,时间和范围据实写,不夸大补偿。',
    userPromptTemplate: `请根据下面情况写一条买家物流通知:说明情况与原因→影响的订单/地区与时间→可选方案(等待/退款/改地址)→致歉与安抚。简洁、信息齐全。\n情况说明:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.ec-ad-variant', label: '推广短文案多版本', shortLabel: '推广多版本', icon: '🎯',
    tags: ['电商', '文案', '投放'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.6,
    description: '为信息流/搜索推广生成多版本短文案,覆盖不同卖点钩子与受众,可直接拿去做 A/B 测试。',
    systemPrompt: '你是一位电商投放优化师,写用于信息流和搜索推广的短文案。每条一个清晰钩子(痛点/优惠/人群/场景),长度适配投放位,口语化不堆词。不喊违反广告法的绝对化用语,不编造优惠和功效。',
    userPromptTemplate: `请为下面商品/活动生成 8 条推广短文案,要求:每条标注钩子类型(痛点/优惠/人群/场景/好奇)、长度适合投放、彼此差异明显、便于做 A/B。\n商品/活动信息:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.ec-param-extract', label: '商品参数抽取', shortLabel: '参数抽取', icon: '🧩',
    tags: ['电商', '抽取', '参数'], allowedActions: ['none'], defaultAction: 'none',
    defaultOutputFormat: 'json', temperature: 0.1,
    description: '从商品资料里抽取结构化参数(品牌/型号/规格/材质/产地/保修等),找不到留空,不编造。',
    systemPrompt: '你是一位电商商品数据专员,从商品文本中抽取结构化参数。只抽原文明确写出的值,找不到的字段留空字符串,绝不编造或推断。原文有多个规格时放进 specs 数组。只输出 JSON,不加任何解释。',
    userPromptTemplate: `请从下面商品资料抽取参数,严格按此 JSON 结构输出(找不到的字段留空字符串,不要编造):\n{\n  "brand": "",\n  "model": "",\n  "category": "",\n  "material": "",\n  "origin": "",\n  "warranty": "",\n  "weight": "",\n  "specs": [{ "name": "", "value": "" }],\n  "keywords": [""]\n}\n只输出 JSON。\n商品资料:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.ec-order-extract', label: '订单要素抽取', shortLabel: '订单抽取', icon: '📦',
    tags: ['电商', '抽取', '订单'], allowedActions: ['none'], defaultAction: 'none',
    defaultOutputFormat: 'json', temperature: 0.1,
    description: '从订单/咨询/退款文本里抽取订单号、商品、金额、收货信息、诉求等,找不到留空,不编造。',
    systemPrompt: '你是一位电商订单处理专员,从聊天或工单文本中抽取订单关键要素,用于建单和分流。只抽原文出现的信息,找不到的留空字符串。金额和数量按原文照抄不换算。只输出 JSON,不加解释。',
    userPromptTemplate: `请从下面文本抽取订单要素,严格按此 JSON 结构输出(找不到的留空字符串,不要编造):\n{\n  "orderNo": "",\n  "buyer": "",\n  "items": [{ "name": "", "spec": "", "qty": "" }],\n  "amount": "",\n  "address": "",\n  "phone": "",\n  "requestType": "",\n  "requestDetail": ""\n}\nrequestType 从 ["售前咨询","催发货","退货","换货","退款","投诉","其他"] 里选最贴切的一个。只输出 JSON。\n文本:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.ec-store-policy', label: '店铺政策页', shortLabel: '店铺政策', icon: '📋',
    tags: ['电商', '生成', '政策'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把零散规则整理成店铺政策页:发货时效、退换货、运费、质保、隐私等,清晰无歧义可公示。',
    systemPrompt: '你是一位电商运营,把店铺的零散规则整理成可公示的政策页面。表述清晰、分条无歧义、主动写明边界条件减少纠纷。只用给定规则,不自行添加未约定的条款,不写「最终解释权」类无效表述。涉及消费者权益的表述以「仅供参考,以平台规则与法律规定为准」收尾。',
    userPromptTemplate: `请把下面店铺规则整理成政策页,按模块分:发货时效、退换货政策、运费说明、质保售后、隐私与信息使用。每模块分条、无歧义。\n店铺规则:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.ec-return-reason-analyze', label: '退货原因归因', shortLabel: '退货归因', icon: '📉',
    tags: ['电商', '分析', '退货'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    temperature: 0.3,
    description: '从退货记录归纳主要退货原因、可控与不可控占比、对应改进动作,锚定原文片段。',
    systemPrompt: '你是一位电商运营分析,从退货记录里归因并给改进方向。把原因归类(质量/描述不符/尺码/物流/不喜欢/错拍等),区分商家可控与不可控。只统计文本里实际出现的内容,次数据实,不编造比例。引用具体记录时逐字、用反引号包裹。',
    userPromptTemplate: `请从下面退货记录做归因:\n## 退货原因分类(按提及多少排序,各附一条原话)\n  - 原话:\`记录逐字片段\`\n## 商家可控 vs 不可控\n## 针对可控原因的改进动作(按性价比排序)\n只统计实际出现的内容,不要编造数据。\n退货记录:\n---\n{{input}}\n---`
  })
])

export function mergeEcommerceExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...ECOMMERCE_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { ECOMMERCE_EXT_BUILTIN_ASSISTANTS, mergeEcommerceExtIntoBuiltins }
