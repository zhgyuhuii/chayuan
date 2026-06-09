/**
 * builtinAssistantsCrossborder — 「跨境电商」领域助手包(批14·手写补)
 * 生成英文文案为主。约束:只用给定产品信息,不编造认证/功效;合规避免平台违禁与夸大。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'crossborder'
const GEN = '通用约束:只用给定产品信息,不编造认证/获奖/功效/销量;符合平台规则、避免违禁词与夸大;英文地道、面向海外买家;直接输出成稿。'
const base = (extra) => ({
  group:'analysis', domain:DOMAIN, modelType:'chat', defaultModelCategory:'chat',
  supportsRibbon:false, defaultDisplayLocations:['ribbon-more'],
  defaultInputSource:INPUT_SOURCE_DOCUMENT, defaultOutputFormat:'markdown', temperature:0.5, ...extra
})
export const CROSSBORDER_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id:'analysis.cb-amazon-listing', label:'亚马逊Listing文案', shortLabel:'Listing文案', icon:'🛒',
    tags:['跨境','生成','listing'], allowedActions:['insert','append','replace','none'], defaultAction:'insert',
    description:'把产品信息写成亚马逊 Listing(英文):标题、五点、描述,含关键词、合规不夸大。',
    systemPrompt:`你是一位资深亚马逊运营,写转化高、合规的英文 Listing。${GEN}`,
    userPromptTemplate:'请把下面产品写成亚马逊 Listing(英文):Title(含核心关键词、符合字数)、5 Bullet Points(利益导向)、Description。地道、合规、不夸大。\n产品信息:\n---\n{{input}}\n---' }),
  base({ id:'analysis.cb-bullet-points', label:'五点描述', shortLabel:'五点描述', icon:'•',
    tags:['跨境','生成','bullet'], allowedActions:['insert','append','replace','none'], defaultAction:'insert',
    description:'为产品写 5 条英文五点描述(bullet points),每条利益导向、突出卖点、合规。',
    systemPrompt:`你是一位亚马逊文案,写利益导向的英文 bullet points。${GEN}`,
    userPromptTemplate:'请为下面产品写 5 条英文 bullet points:每条以利益/卖点开头(可大写短语引导)、具体、合规不夸大。\n产品信息:\n---\n{{input}}\n---' }),
  base({ id:'analysis.cb-aplus', label:'A+内容文案', shortLabel:'A+内容', icon:'🖼️',
    tags:['跨境','生成','A+'], allowedActions:['insert','append','none'], defaultAction:'insert', temperature:0.5,
    description:'规划 A+ 页面内容(英文):模块标题、卖点文案、对比表、使用场景,提升品牌感与转化。',
    systemPrompt:`你是一位品牌内容设计,规划有品牌感的英文 A+ 内容。${GEN}`,
    userPromptTemplate:'请为下面产品规划 A+ 内容(英文):品牌故事模块、核心卖点模块(标题+文案+配图建议)、对比/参数表、使用场景、信任背书(仅真实)。\n产品信息:\n---\n{{input}}\n---' }),
  base({ id:'analysis.cb-cs-email', label:'海外客服邮件', shortLabel:'海外客服邮件', icon:'📧',
    tags:['跨境','生成','客服'], allowedActions:['insert','append','replace','none'], defaultAction:'insert', temperature:0.4,
    description:'写专业得体的英文客服邮件:售前答疑、物流、退换、安抚等场景,礼貌专业促满意。',
    systemPrompt:'你是一位跨境客服,写礼貌、专业、解决问题的英文邮件。只承诺能兑现的,不卑不亢,符合平台政策。',
    userPromptTemplate:'请针对下面场景写英文客服邮件(2个版本):礼貌开头→针对问题的清晰回应→具体解决方案/下一步→友好结尾。\n场景:\n---\n{{input}}\n---' }),
  base({ id:'analysis.cb-review-appeal', label:'差评申诉沟通', shortLabel:'差评申诉', icon:'⚖️',
    tags:['跨境','生成','申诉'], allowedActions:['insert','append','none'], defaultAction:'insert', temperature:0.3,
    description:'针对差评/纠纷写英文沟通:共情、说明、解决方案,或合规的移除申诉理由,不违反平台规则。',
    systemPrompt:'你是一位跨境运营,写合规、真诚的差评沟通。基于给定情况共情解决,不诱导改评/返现等违规操作。',
    userPromptTemplate:'请针对下面差评/纠纷写英文沟通:共情致歉→说明与解决方案→后续保障。(若属违反评论政策可附合规移除申诉理由)不诱导改评返现。\n情况:\n---\n{{input}}\n---' }),
  base({ id:'analysis.cb-keywords', label:'关键词调研', shortLabel:'关键词调研', icon:'🔍',
    tags:['跨境','分析','关键词'], allowedActions:['comment','append','none'], defaultAction:'comment', temperature:0.3,
    description:'基于产品给英文关键词建议:核心词、长尾词、相关词与场景词,指导 Listing 与广告布词。',
    systemPrompt:'你是一位亚马逊广告运营,基于产品给分层英文关键词。关键词与产品真实相关,不堆砌不相关热词。',
    userPromptTemplate:'请基于下面产品给英文关键词建议:\n## Core keywords(3-5)\n## Long-tail(8-15)\n## Related/场景词\n## 布词建议(标题/五点/后台)\n产品信息:\n---\n{{input}}\n---' }),
  base({ id:'analysis.cb-label-compliance', label:'产品合规标签检查', shortLabel:'合规标签检查', icon:'🚧',
    tags:['跨境','核查','合规'], allowedActions:['comment','link-comment','append','none'], defaultAction:'comment', temperature:0.15,
    description:'检查文案/标签是否含平台违禁词、医疗功效暗示、绝对化、侵权词或缺必要合规标识。',
    systemPrompt:'你是一位跨境合规审核,识别违禁与风险表述。命中片段原文逐字、反引号包裹;关注平台违禁词、功效暗示、绝对化、品牌侵权;只标确有问题处。',
    userPromptTemplate:'请检查下面文案/标签,关注:平台违禁词、医疗/治疗功效暗示、绝对化用语(best/#1/100%)、他人品牌或商标侵权、缺必要合规标识(如认证/警示)。\n## 风险项 (若无写"未发现明显问题")\n- 命中片段:`原文逐字片段`\n- 问题:\n- 建议:\n文案/标签:\n---\n{{input}}\n---' }),
  base({ id:'analysis.cb-return-policy', label:'海外退货政策', shortLabel:'退货政策', icon:'↩️',
    tags:['跨境','生成','政策'], allowedActions:['insert','append','replace','none'], defaultAction:'insert', temperature:0.2,
    description:'写清晰合规的英文退换货政策:条件、时限、流程、费用承担,符合平台规则、减少纠纷。',
    systemPrompt:'你是一位跨境运营,写清晰、合规、无歧义的英文退换货政策。基于给定规则,主动写明条件减少纠纷,符合平台政策。',
    userPromptTemplate:'请把下面规则写成英文退换货政策:适用条件、时限、退/换流程、运费与退款承担、不适用情形、联系方式。清晰合规无歧义。\n规则:\n---\n{{input}}\n---' }),
  base({ id:'analysis.cb-brand-story', label:'品牌故事(英文)', shortLabel:'品牌故事', icon:'📖',
    tags:['跨境','生成','品牌'], allowedActions:['insert','append','replace','none'], defaultAction:'insert', temperature:0.6,
    description:'把品牌素材写成有共鸣的英文品牌故事,用于 A+/店铺/独立站,真实不虚构。',
    systemPrompt:`你是一位品牌叙事文案,写有共鸣、真实的英文品牌故事。只用给定素材,不虚构创始经历。${GEN}`,
    userPromptTemplate:'请把下面素材写成英文品牌故事:起源与初心、为用户解决什么、品牌价值与承诺。有共鸣、真实、适合海外读者。\n品牌素材:\n---\n{{input}}\n---' }),
  base({ id:'analysis.cb-social-post', label:'海外社媒帖文', shortLabel:'社媒帖文', icon:'📱',
    tags:['跨境','生成','社媒'], allowedActions:['insert','append','none'], defaultAction:'insert', defaultInputSource:INPUT_SOURCE_SELECTION_PREFERRED, temperature:0.7,
    description:'为产品写英文社媒帖文(IG/FB/TikTok),含钩子、卖点、CTA 与话题标签,本地化口吻。',
    systemPrompt:`你是一位海外社媒运营,写地道、有钩子的英文帖文。${GEN}`,
    userPromptTemplate:'请为下面产品写英文社媒帖文(给 IG/FB 与 TikTok 各一版):强钩子开头、卖点、行动号召、5-8 个 hashtag。本地化口吻、不夸大。\n产品信息:\n---\n{{input}}\n---' }),
  base({ id:'analysis.cb-customs-name', label:'报关品名英文', shortLabel:'报关品名', icon:'🌐',
    tags:['跨境','生成','报关'], allowedActions:['comment','append','none'], defaultAction:'comment', temperature:0.2,
    description:'根据产品给规范的英文报关品名/材质/用途描述,便于清关,提示以海关要求为准。',
    systemPrompt:'你是一位跨境物流单证,给规范的英文报关描述。基于产品给品名/材质/用途,客观准确,提示具体以海关与 HS 归类为准。',
    userPromptTemplate:'请根据下面产品给英文报关信息:品名(规范英文)、材质 material、用途 use、可能的 HS 归类方向(仅参考)。客观准确,注明以海关要求为准。\n产品信息:\n---\n{{input}}\n---' }),
  base({ id:'analysis.cb-policy-points', label:'平台政策要点整理', shortLabel:'平台政策要点', icon:'📑',
    tags:['跨境','整理','政策'], allowedActions:['comment','append','insert','none'], defaultAction:'comment', temperature:0.2,
    description:'把平台政策/通知整理成易懂要点:要求、影响、需做的动作与截止,便于合规落地。',
    systemPrompt:'你是一位跨境合规运营,把平台政策整理成可执行要点。只摘原文,要求与时限照原文,不臆测处罚。',
    userPromptTemplate:'请把下面平台政策/通知整理成要点:核心要求、对卖家的影响、需要采取的动作(分条)、截止时间、不合规后果(照原文)。\n政策/通知:\n---\n{{input}}\n---' })
])
export function mergeCrossborderIntoBuiltins(base=[]){const ids=new Set(base.map(x=>x&&x.id));return [...base,...CROSSBORDER_BUILTIN_ASSISTANTS.filter(x=>x&&!ids.has(x.id))]}
export default { CROSSBORDER_BUILTIN_ASSISTANTS, mergeCrossborderIntoBuiltins }
