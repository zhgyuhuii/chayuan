/**
 * builtinAssistantsEcommerce — 「电商/零售」领域助手包(批5)
 * 生成类默认插入、核查类批注。约束:只用给定信息不编造功效/销量/资质,避免违反广告法的绝对化用语。
 */
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'ecommerce'
const GEN_RULES = `通用约束:只用给定信息,不编造功效、销量、好评、资质;避免"最/第一/100%/国家级"等违反广告法的绝对化用语;直接输出成稿。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, defaultOutputFormat: 'markdown', temperature: 0.6, ...extra
})

export const ECOMMERCE_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.ec-title', label: '商品标题优化', shortLabel: '商品标题', icon: '🏷️',
    tags: ['电商', '文案', '标题'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'insert',
    description: '把商品信息写成搜索友好、卖点突出的标题,合理堆叠核心关键词又不像乱码。',
    systemPrompt: `你是一位电商运营,写既利于搜索又突出卖点的商品标题。${GEN_RULES}`,
    userPromptTemplate: `请为下面商品生成 5 个可选标题:含核心关键词、突出卖点、长度适合平台、不堆砌到像乱码。标注每个的侧重(搜索/卖点/促销)。\n商品信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ec-detail', label: '商品详情页', shortLabel: '商品详情页', icon: '📄',
    tags: ['电商', '文案', '详情'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '把商品资料写成详情页文案:卖点模块、使用场景、参数、常见问题,有转化引导。',
    systemPrompt: `你是一位详情页文案,写有说服力、利于转化的商品详情。${GEN_RULES}`,
    userPromptTemplate: `请把下面商品资料写成详情页文案,分模块:核心卖点(3-4个,利益导向)、使用场景、规格参数、常见问题、购买引导。只用资料中的真实信息。\n资料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ec-selling-point', label: '商品卖点提炼', shortLabel: '商品卖点', icon: '💡',
    tags: ['电商', '提炼', '卖点'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '从商品资料提炼差异化卖点,转成用户能感知的利益点,标明对应依据。',
    systemPrompt: '你是一位商品企划,把产品特性提炼成用户能感知的利益点。只用资料事实,不夸大。',
    userPromptTemplate: `请从下面资料提炼卖点,表格输出:特性 | 用户利益 | 对应原文依据。最后给一句"主推卖点"。\n资料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ec-cs-script', label: '客服话术', shortLabel: '客服话术', icon: '💬',
    tags: ['电商', '客服', '话术'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '针对咨询场景生成得体客服话术:售前答疑、催付、催评、安抚,专业有温度不机械。',
    systemPrompt: '你是一位金牌客服,写专业、亲和、能促成交易的话术。只承诺能做到的,不夸大不欺骗。',
    userPromptTemplate: `请针对下面客服场景生成 2-3 个版本的话术(亲和、专业、有引导):\n场景:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ec-return-reply', label: '退换货回复', shortLabel: '退换货回复', icon: '↩️',
    tags: ['电商', '客服', '售后'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '针对退换货诉求写得体回复:先共情、说明政策与流程、给解决方案,减少纠纷升级。',
    systemPrompt: '你是一位售后客服,写共情、清晰、能化解情绪的退换货回复。依据给定政策,不随意承诺超范围条件。',
    userPromptTemplate: `请针对下面退换货诉求写回复:共情→说明适用政策与流程→具体解决方案→安抚。\n诉求(及政策):\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ec-review-guide', label: '好评引导文案', shortLabel: '好评引导', icon: '⭐',
    tags: ['电商', '文案', '评价'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '生成自然、不让人反感的好评引导文案(包裹卡/旺旺消息),真诚不诱导虚假评价。',
    systemPrompt: `你是一位用户运营,写真诚、不反感的好评引导。不诱导虚假评价、不返现违规表述。${GEN_RULES}`,
    userPromptTemplate: `请为下面商品/场景写 3 条好评引导文案(包裹卡或消息,真诚、简短、给真实使用提示,不诱导虚假评价):\n商品/场景:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ec-promo-rules', label: '活动规则撰写', shortLabel: '活动规则', icon: '📜',
    tags: ['电商', '生成', '活动'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '把促销活动写成清晰、无歧义、规避纠纷的活动规则:参与方式、优惠、限制、时间、解释说明。',
    systemPrompt: '你是一位电商运营,写清晰、严谨、不留歧义的活动规则,主动写明限制条件以减少纠纷。不写"最终解释权"类无效条款。',
    userPromptTemplate: `请把下面活动写成活动规则:活动时间、参与方式、优惠内容、使用限制(叠加/退款/数量)、注意事项。表述清晰无歧义。\n活动:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ec-sku-desc', label: 'SKU描述生成', shortLabel: 'SKU描述', icon: '🔖',
    tags: ['电商', '生成', 'SKU'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '为多规格商品生成统一风格的 SKU 描述,区分规格要点,简洁准确。',
    systemPrompt: `你是一位电商运营,为各 SKU 写统一风格、要点清晰的描述。只用给定规格,不编造。${GEN_RULES}`,
    userPromptTemplate: `请为下面商品的各规格生成 SKU 描述(每个简短、突出该规格区别、风格统一):\n商品与规格:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ec-qa-reply', label: '问大家回复', shortLabel: '问大家回复', icon: '🙋',
    tags: ['电商', '客服', '问答'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '以老买家口吻回复"问大家"提问,真实、简短、有帮助,不夸大不贬低。',
    systemPrompt: '你是一位真实买家,简短真诚地回答其他买家的提问。只基于给定商品信息,不夸大不编造体验。',
    userPromptTemplate: `请以老买家口吻,简短真诚地回复下面"问大家"的提问(基于给定商品信息,客观、有帮助):\n提问(及商品信息):\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ec-live-script', label: '直播话术', shortLabel: '直播话术', icon: '📡',
    tags: ['电商', '脚本', '直播'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.6,
    description: '为商品生成直播带货话术:引入、卖点讲解、互动、逼单、答疑,节奏感强不违规。',
    systemPrompt: `你是一位直播运营,写有节奏、能逼单的带货话术。不编造功效、不喊违规绝对化用语。${GEN_RULES}`,
    userPromptTemplate: `请为下面商品写直播话术段落:开场引入→卖点讲解(利益导向)→互动提问→限时逼单→答疑兜底。\n商品:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ec-main-copy', label: '主图卖点文案', shortLabel: '主图文案', icon: '🖼️',
    tags: ['电商', '文案', '主图'], allowedActions: ['insert', 'comment', 'append', 'none'], defaultAction: 'insert', temperature: 0.6,
    description: '为商品主图/海报生成简短有冲击力的卖点短句,适合放图上,几个字打动人。',
    systemPrompt: `你是一位电商视觉文案,写极短、有冲击力、适合放主图的卖点短句。${GEN_RULES}`,
    userPromptTemplate: `请为下面商品生成 6-8 条主图卖点短句(每条不超过10字、有冲击力、可放图上),标注适合的图位(主卖点/促销/赠品等)。\n商品:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ec-compliance-check', label: '商品文案合规检查', shortLabel: '文案合规检查', icon: '🚧',
    tags: ['电商', '核查', '合规'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.15,
    description: '检查商品文案是否含违反广告法的绝对化用语、虚假宣传、医疗功效暗示等违规风险。',
    systemPrompt: '你是一位电商合规审核,识别文案中违反广告法的表述。命中片段原文逐字、反引号包裹;不确定标「建议人工复核」,不武断。',
    userPromptTemplate: `请检查下面商品文案的合规风险,关注:绝对化用语(最/第一/100%/国家级)、虚假或无依据宣传、医疗/保健功效暗示、贬低同行、诱导性表述。\n## 违规风险 (若无写"未发现明显违规")\n- 命中片段:\`原文逐字片段\`\n- 风险:\n- 建议改为:\n文案:\n---\n{{input}}\n---` })
])

export function mergeEcommerceIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...ECOMMERCE_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { ECOMMERCE_BUILTIN_ASSISTANTS, mergeEcommerceIntoBuiltins }
