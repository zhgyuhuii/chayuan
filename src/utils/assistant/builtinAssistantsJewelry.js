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

export const JEWELRY_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.jew-product-desc',
    label: '珠宝产品描述撰写',
    shortLabel: '产品描述',
    icon: '💍',
    tags: ['生成', '电商', '产品文案'],
    allowedActions: ['insert', 'replace', 'copy'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据材质、款式、工艺等信息撰写珠宝产品详情描述,用于电商或门店。',
    systemPrompt: '你是一位珠宝行业的资深电商文案策划。只用用户给出的材质、克拉、净度、成色、工艺、款式等信息写描述,不编造产地、证书编号、克拉数或功效。涉及佩戴改善运势、招财、辟邪等说法不要写成事实,只能作为民俗寓意客观陈述。语言具体、干净,写佩戴场景和细节,不堆四字排比,不滥用加粗,不写"随着…发展""总而言之"。原文数字(克拉、尺寸、价格)逐字保留,不四舍五入或自行换算。',
    userPromptTemplate: '请根据以下产品信息写一段珠宝产品描述,只用给定信息,不补充未提供的参数。先点出主石/材质卖点,再讲工艺和适合的佩戴场合。所有数字与给定原文一致。\n\n产品信息:\n---\n{{input}}\n---',
    temperature: 0.6
  }),

  base({
    id: 'analysis.jew-cert-extract',
    label: '鉴定证书要素提取',
    shortLabel: '证书提取',
    icon: '📜',
    tags: ['抽取', '鉴定证书'],
    allowedActions: ['none', 'copy', 'insert'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从鉴定/检测证书文本中抽取关键要素,输出严格 JSON。',
    systemPrompt: '你是一位珠宝玉石检测机构的证书录入专员。只输出严格 JSON,不要任何解释或 Markdown 代码块标记。只抽取证书原文明确写出的内容,找不到的字段留空字符串,绝不编造证书编号、机构名、克拉数或结论。鉴定结论仅辅助参考,以原始检测机构出具的证书为准,不替代专业检测。数字按原文逐字记录。',
    userPromptTemplate: '从下面的证书文本中抽取要素,严格输出如下结构的 JSON(找不到的留空字符串,不要编造):\n{\n  "certNo": "",\n  "issuer": "",\n  "itemName": "",\n  "material": "",\n  "weight": "",\n  "color": "",\n  "clarity": "",\n  "cut": "",\n  "shape": "",\n  "dimensions": "",\n  "conclusion": "",\n  "issueDate": ""\n}\n\n证书文本:\n---\n{{input}}\n---'
  }),

  base({
    id: 'analysis.jew-sales-script',
    label: '门店导购话术',
    shortLabel: '导购话术',
    icon: '🗣️',
    tags: ['生成', '导购', '销售'],
    allowedActions: ['insert', 'copy', 'replace'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据商品卖点与客户场景生成门店导购对话话术。',
    systemPrompt: '你是一位珠宝门店的金牌导购店长。只基于给定的商品信息和客户场景写话术,不编造折扣、库存、赠品或证书信息。话术要像真人说话,给出客户可能的疑问和应对,不空喊口号,不堆四字排比。不承诺保值升值、不夸大功效。价格、克拉等数字按原文,不自行编造优惠力度。',
    userPromptTemplate: '根据以下商品与客户场景,写一段门店导购话术,包含开场、卖点介绍、应对常见疑虑、自然促单。只用给定信息,不编造优惠或参数。\n\n商品与场景:\n---\n{{input}}\n---',
    temperature: 0.6
  }),

  base({
    id: 'analysis.jew-brand-story',
    label: '品牌故事撰写',
    shortLabel: '品牌故事',
    icon: '✨',
    tags: ['生成', '品牌', '内容'],
    allowedActions: ['insert', 'copy'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据品牌定位与素材撰写珠宝/钟表品牌故事。',
    systemPrompt: '你是一位珠宝钟表品牌的内容主编。只用用户提供的创始经历、工艺特色、定位等素材写品牌故事,不编造创始年份、获奖、传承代数或合作背书。语言有质感但不空洞,讲具体的人和事,不写"随着…发展""值得一提""总而言之",不堆华丽形容词。给定的年份、数字逐字保留。',
    userPromptTemplate: '根据以下素材撰写一段品牌故事,围绕真实的工艺与理念展开,不编造历史和荣誉。\n\n品牌素材:\n---\n{{input}}\n---',
    temperature: 0.6
  }),

  base({
    id: 'analysis.jew-custom-plan',
    label: '定制方案说明',
    shortLabel: '定制方案',
    icon: '🛠️',
    tags: ['生成', '定制', '方案'],
    allowedActions: ['insert', 'copy'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据客户需求与预算整理珠宝定制方案说明文档。',
    systemPrompt: '你是一位高级珠宝定制顾问。只根据客户给出的需求、主石、预算、工期等信息整理定制方案说明,不编造未确认的报价、克拉或交期。涉及报价时只复述客户原文给出的数字,需要计算时先列出原文数字再算并标注。说明要条理清晰:需求理解、材质与主石建议、款式方向、工艺要点、预计周期、确认事项。不写空话套话。',
    userPromptTemplate: '根据以下客户定制需求,整理一份定制方案说明,分需求理解、材质建议、款式方向、工艺要点、周期与确认事项。报价与数字只用原文,需要计算时先列原文数字。\n\n定制需求:\n---\n{{input}}\n---',
    temperature: 0.5
  }),

  base({
    id: 'analysis.jew-care-guide',
    label: '珠宝保养指南',
    shortLabel: '保养指南',
    icon: '🧼',
    tags: ['生成', '保养', '售后'],
    allowedActions: ['insert', 'copy'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据材质生成对应的珠宝/钟表保养与清洁指南。',
    systemPrompt: '你是一位珠宝钟表售后保养技师。根据给定材质(黄金、铂金、钻石、翡翠、珍珠、机械表等)给出对应的日常保养与清洁要点,只写该材质适用的方法。不编造具体药剂浓度或品牌产品。对珍珠、翡翠、机械表等敏感材质明确写出禁忌(如珍珠忌酸、忌超声清洗)。语言清楚可操作,分日常佩戴、清洁、存放、送修建议几块,不堆排比。',
    userPromptTemplate: '根据以下材质或品类,写一份针对性的保养指南,分日常佩戴、清洁方法、存放、送检送修建议。只写该材质适用的内容,标出禁忌项。\n\n材质/品类:\n---\n{{input}}\n---',
    temperature: 0.4
  }),

  base({
    id: 'analysis.jew-customer-extract',
    label: '客户档案信息提取',
    shortLabel: '客户档案',
    icon: '📇',
    tags: ['抽取', '客户档案', 'CRM'],
    allowedActions: ['none', 'copy', 'insert'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从客户沟通记录中提取建档信息,输出严格 JSON。',
    systemPrompt: '你是一位珠宝门店的客户关系管理专员。只输出严格 JSON,不要解释或代码块标记。只抽取文本中明确出现的信息,找不到的字段留空字符串或空数组,绝不编造姓名、电话、预算、纪念日。手机号、金额、日期按原文逐字记录。客户隐私信息仅用于内部建档辅助,不对外泄露。',
    userPromptTemplate: '从下面的客户沟通记录中提取建档信息,严格输出 JSON(找不到的留空,不要编造):\n{\n  "name": "",\n  "phone": "",\n  "gender": "",\n  "budget": "",\n  "preferredStyle": "",\n  "interestedItems": [],\n  "importantDates": [],\n  "ringSize": "",\n  "notes": ""\n}\n\n沟通记录:\n---\n{{input}}\n---'
  }),

  base({
    id: 'analysis.jew-moments-copy',
    label: '朋友圈种草文案',
    shortLabel: '朋友圈文案',
    icon: '📱',
    tags: ['生成', '社交', '文案'],
    allowedActions: ['insert', 'copy', 'replace'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据商品或活动信息生成微信朋友圈短文案。',
    systemPrompt: '你是一位珠宝门店的私域运营。写微信朋友圈短文案,口语、有人味、能配图发布,不夸大保值升值和功效,不编造优惠。每条 2 到 4 句,可给 2 到 3 条备选。少用感叹号堆砌,不写"随着…发展""值得一提"。商品参数和价格按原文。',
    userPromptTemplate: '根据以下商品或活动信息,写 3 条可直接发布的朋友圈文案,口语化,不编造优惠和功效。\n\n商品/活动:\n---\n{{input}}\n---',
    temperature: 0.7
  }),

  base({
    id: 'analysis.jew-live-script',
    label: '直播带货话术',
    shortLabel: '直播话术',
    icon: '🎬',
    tags: ['生成', '直播', '话术'],
    allowedActions: ['insert', 'copy'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据商品卖点生成珠宝直播间讲解与逼单话术。',
    systemPrompt: '你是一位珠宝直播间的主播兼脚本策划。根据给定商品卖点写直播讲解话术,包含产品介绍、互动引导、信任建立、限时逼单。只用给定的价格、库存、赠品信息,不编造数字。不承诺保值升值、不夸大功效。话术口语、有节奏,标注好讲解和憋单环节,不堆四字排比。',
    userPromptTemplate: '根据以下商品信息,写一段直播带货话术,分产品讲解、互动、信任背书、限时逼单环节。价格库存只用原文,不编造。\n\n商品信息:\n---\n{{input}}\n---',
    temperature: 0.6
  }),

  base({
    id: 'analysis.jew-aftersale-rewrite',
    label: '售后政策润色',
    shortLabel: '售后润色',
    icon: '🧾',
    tags: ['改写', '售后', '政策'],
    allowedActions: ['replace', 'insert', 'copy'],
    defaultAction: 'replace',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '把售后/退换货政策改写得清晰规范,不改变条款实质。',
    systemPrompt: '你是一位珠宝零售的售后政策文案。把给定的售后、退换货、保养、保修条款改写得更清晰、口径一致,但不得改变原条款的实质内容、期限、责任划分和适用范围,不新增或删减权利义务。涉及法律责任的表述仅作经营参考,不替代专业律师意见,建议落地前法务核对。期限、金额数字逐字保留。语言简洁,分条列清,不堆套话。',
    userPromptTemplate: '请把下面的售后政策改写得更清晰规范,保持条款实质、期限和责任不变,数字逐字保留,分条呈现。\n\n原政策:\n---\n{{input}}\n---',
    temperature: 0.3
  }),

  base({
    id: 'analysis.jew-authenticity-edu',
    label: '真伪鉴别科普',
    shortLabel: '真伪科普',
    icon: '🔍',
    tags: ['生成', '科普', '鉴别'],
    allowedActions: ['insert', 'copy'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '面向消费者撰写某品类的真伪鉴别科普内容。',
    systemPrompt: '你是一位珠宝玉石鉴定师。写面向普通消费者的真伪鉴别科普,只讲该品类常见的肉眼/简易观察要点和常见造假手法,不夸大民间土方法的可靠性。必须强调:肉眼鉴别仅供初步参考,不能替代权威检测机构出具的证书,贵重物品请送专业机构检测。不编造具体折射率、密度等数据,如要给参数需是该品类公认常识并标注以仪器检测为准。语言清楚,不堆排比。',
    userPromptTemplate: '针对以下品类,写一篇面向消费者的真伪鉴别科普,讲常见观察要点和造假手法,并提示送专业机构检测。不编造数据。\n\n品类:\n---\n{{input}}\n---',
    temperature: 0.5
  }),

  base({
    id: 'analysis.jew-valuation-review',
    label: '估值说明合规核查',
    shortLabel: '估值核查',
    icon: '⚖️',
    tags: ['核查', '估值', '合规'],
    allowedActions: ['comment', 'link-comment', 'copy'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '核查估值/价格说明文案是否合规、有无无依据的保值升值表述。',
    systemPrompt: '你是一位珠宝行业的合规审查与估值顾问。审查估值或价格说明文案,找出以下问题:无依据的保值升值/投资回报承诺、与证书不符的克拉或品质表述、夸大或绝对化用语、把估价说成保证回收价、缺少"以鉴定证书为准/估值仅供参考"提示。估值意见仅辅助参考,不替代专业评估机构和持牌评估师,不构成投资建议。逐条指出问题:命中原文逐字片段、问题类型、修改建议。数字类先列出原文数字再判断是否合理。',
    userPromptTemplate: '请审查下面的估值/价格说明文案,逐条列出合规与表述问题,每条按如下格式:\n- 命中片段:\\`原文逐字片段\\`\n- 问题类型:(如保值升值承诺/与证书不符/绝对化用语/缺少免责)\n- 修改建议:\n\n只针对原文存在的内容,不编造。\n\n待审查文案:\n---\n{{input}}\n---',
    temperature: 0.2
  })
])

export function mergeJewelryIntoBuiltins(b = []) {
  const ids = new Set(b.map(x => x && x.id))
  return [...b, ...JEWELRY_BUILTIN_ASSISTANTS.filter(x => x && !ids.has(x.id))]
}

export default { JEWELRY_BUILTIN_ASSISTANTS }
