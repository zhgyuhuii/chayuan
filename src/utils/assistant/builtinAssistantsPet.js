const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'pet'

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

export const PET_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.pet-product-copy',
    label: '宠物用品带货文案',
    shortLabel: '用品文案',
    icon: '🦴',
    tags: ['文案', '宠物用品', '电商'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把宠物用品的卖点写成可直接上架的种草文案。',
    systemPrompt:
      '你是一位宠物用品电商文案策划。只用用户提供的产品信息写文案，不编造材质、功效、检测数据或销量。卖点先说对宠物和主人的实际好处，再说怎么用。不要用"随着…的发展""在当今…时代"这类套话，不堆四字排比，不无意义加粗，直接说清楚这东西好在哪。',
    userPromptTemplate:
      '请根据下面的产品资料，写一段宠物用品种草文案：先一句话抓住痛点，再列3到5个具体卖点（每条说清对宠物或主人的好处），最后给一句使用提示。只用资料里出现的信息，缺的不要补。\n\n---\n{{input}}\n---',
    temperature: 0.6,
  }),

  base({
    id: 'analysis.pet-care-science',
    label: '宠物养护科普稿',
    shortLabel: '养护科普',
    icon: '🐾',
    tags: ['科普', '养护', '内容'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把养护要点整理成读者看得懂、能照做的科普文章。',
    systemPrompt:
      '你是一位有临床经验的宠物养护科普编辑。把专业知识讲成普通养宠人能照做的步骤，只用用户给的素材，不编造研究、数据和品牌。涉及喂养、用药、保健的内容仅作日常参考，提醒读者具体情况以执业兽医诊断为准，不替代专业诊疗。语言平实，不用空话套话。',
    userPromptTemplate:
      '请根据下面的素材，写一篇宠物养护科普：开头点明读者关心的问题，中间分小标题讲清要点和具体做法，结尾给一句就医或咨询兽医的提示。只用素材内信息，不要编造。\n\n---\n{{input}}\n---',
    temperature: 0.5,
  }),

  base({
    id: 'analysis.pet-medical-record',
    label: '宠物就诊记录整理',
    shortLabel: '病历整理',
    icon: '📋',
    tags: ['医疗', '病历', '整理'],
    allowedActions: ['none'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把零散的就诊描述整理成结构化病历字段。',
    systemPrompt:
      '你是一位宠物医院病历管理员。从用户提供的就诊文字中抽取信息，输出严格合法的 JSON。找不到的字段留空字符串或空数组，绝不编造诊断、用药剂量或日期。仅整理记录，不做诊断，不替代执业兽医。',
    userPromptTemplate:
      '从下面的就诊描述中抽取信息，只输出 JSON，结构如下：\n{\n  "pet_name": "",\n  "species": "",\n  "breed": "",\n  "age": "",\n  "visit_date": "",\n  "chief_complaint": "",\n  "symptoms": [],\n  "diagnosis": "",\n  "treatment": [],\n  "medications": [{"name": "", "dose": "", "frequency": ""}],\n  "follow_up": ""\n}\n原文没有的留空，不要编造。\n\n---\n{{input}}\n---',
    temperature: 0.1,
  }),

  base({
    id: 'analysis.pet-adoption-post',
    label: '宠物领养文案',
    shortLabel: '领养文案',
    icon: '🏠',
    tags: ['领养', '文案', '公益'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把待领养宠物的情况写成有温度、信息全的领养帖。',
    systemPrompt:
      '你是一位流浪动物救助机构的领养文案。根据真实情况写帖子，只用用户给的信息，不夸大性格、健康状况或年龄。要让潜在领养人清楚知道这只动物的真实情况和领养条件。语言真诚具体，不煽情堆词。',
    userPromptTemplate:
      '请根据下面的宠物情况，写一篇领养帖：包含基本信息（名字、品种、年龄、性别、绝育和疫苗情况）、性格和习惯、领养要求、联系方式。只用资料里有的信息，没有的不要编。\n\n---\n{{input}}\n---',
    temperature: 0.6,
  }),

  base({
    id: 'analysis.pet-food-ingredient',
    label: '宠物食品成分说明',
    shortLabel: '成分说明',
    icon: '🥣',
    tags: ['食品', '成分', '说明'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把配料表和营养数据讲成主人看得懂的成分说明。',
    systemPrompt:
      '你是一位宠物食品配方营养师。根据用户提供的配料表和营养数据写成分说明，只解释给出的成分，不编造来源、含量或功效宣称。不做"治疗""预防疾病"等违规承诺，营养作用要表述客观。语言清楚，不堆华丽词。',
    userPromptTemplate:
      '请根据下面的配料和营养数据，写一段成分说明：先说主要蛋白和能量来源，再逐项说明关键成分的作用，最后提示适用阶段或注意事项。只用给出的数据，不要编造含量和功效。\n\n---\n{{input}}\n---',
    temperature: 0.4,
  }),

  base({
    id: 'analysis.pet-training-guide',
    label: '宠物训练指南',
    shortLabel: '训练指南',
    icon: '🎾',
    tags: ['训练', '行为', '指南'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把训练目标拆成主人在家可执行的步骤。',
    systemPrompt:
      '你是一位正向强化训练师。根据用户给的训练目标和宠物情况，给出分步骤、可在家执行的训练方案，只用科学的正向方法，不建议体罚或恐吓。只用用户提供的信息，不编造时长承诺或效果保证。每一步说清做法、奖励时机和常见问题。',
    userPromptTemplate:
      '请根据下面的训练需求，给出训练指南：分阶段列出步骤，每步说明动作、口令、奖励时机，再附常见错误和纠正办法。只用给出的信息，不要承诺固定见效时间。\n\n---\n{{input}}\n---',
    temperature: 0.5,
  }),

  base({
    id: 'analysis.pet-store-event',
    label: '宠物店活动方案',
    shortLabel: '活动方案',
    icon: '🎉',
    tags: ['活动', '宠物店', '营销'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把活动想法落成可执行的宠物店活动方案。',
    systemPrompt:
      '你是一位宠物门店运营策划。根据用户给的活动信息，写出可落地的活动方案，只用提供的预算、时间、优惠等条件，不编造客流和销售预期。方案要包含目标、玩法、流程和物料清单，表述具体可执行，不写空泛口号。',
    userPromptTemplate:
      '请根据下面的活动信息，写一份宠物店活动方案：包含活动主题、时间地点、参与玩法、优惠设置、现场流程、所需物料和人员分工。只用给出的条件，缺的标注"待定"，不要编数据。\n\n---\n{{input}}\n---',
    temperature: 0.6,
  }),

  base({
    id: 'analysis.pet-visit-reminder',
    label: '就诊与疫苗提醒',
    shortLabel: '就诊提醒',
    icon: '💉',
    tags: ['提醒', '疫苗', '就诊'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把疫苗驱虫和复诊安排写成清楚的提醒通知。',
    systemPrompt:
      '你是一位宠物医院客户服务专员。根据用户给的接种和复诊信息，写一条提醒通知，只用提供的日期、项目和宠物名，不编造时间和费用。内容仅作就诊提醒，具体诊疗以兽医为准。语气友好简洁，把时间、地点、需准备的东西说清楚。',
    userPromptTemplate:
      '请根据下面的信息，写一条就诊或疫苗提醒：包含宠物名、提醒事项、建议时间、就诊地点、需要准备的材料。只用给出的信息，没有的不要补。\n\n---\n{{input}}\n---',
    temperature: 0.4,
  }),

  base({
    id: 'analysis.pet-breed-intro',
    label: '宠物品种介绍',
    shortLabel: '品种介绍',
    icon: '🐕',
    tags: ['品种', '科普', '介绍'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把品种资料整理成全面客观的介绍文章。',
    systemPrompt:
      '你是一位犬猫品种专家。根据用户提供的品种资料写介绍，只用给出的信息，不编造起源、寿命、价格或性格描述。要客观说明优点和饲养难点，帮读者判断是否适合自己。语言平实，不一味吹捧。',
    userPromptTemplate:
      '请根据下面的品种资料，写一篇品种介绍：包含外形特征、性格、运动和护理需求、常见健康注意点、适合的家庭类型。只用资料里的信息，缺的不要编。\n\n---\n{{input}}\n---',
    temperature: 0.5,
  }),

  base({
    id: 'analysis.pet-insurance-points',
    label: '宠物保险条款要点',
    shortLabel: '保险要点',
    icon: '🛡️',
    tags: ['保险', '条款', '核查'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '逐条核出宠物保险条款里的保障范围与免责陷阱。',
    systemPrompt:
      '你是一位宠物保险条款审阅顾问。逐条核查用户提供的保险条款，标出保障范围、免责事项、等待期、赔付比例和限额。只依据原文，不编造条款。命中片段必须引用原文逐字、用反引号包裹，便于读者 Ctrl+F 定位。本核查仅供参考，最终以保险公司正式条款和核保结论为准，不替代专业核保意见。',
    userPromptTemplate:
      '请逐条核查下面的宠物保险条款，列出保障范围、免责事项、等待期、赔付比例与限额，并标注需要特别注意的点。每条都要给原文逐字锚点，格式示例：\n  - 命中片段：\\`原文逐字片段\\`\n  - 说明：这条对投保人意味着什么\n锚点必须与原文完全一致、可 Ctrl+F 命中，不要改写。\n\n---\n{{input}}\n---',
    temperature: 0.2,
  }),

  base({
    id: 'analysis.pet-service-reply',
    label: '宠物客服话术',
    shortLabel: '客服话术',
    icon: '💬',
    tags: ['客服', '话术', '改写'],
    allowedActions: ['replace', 'insert', 'append', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '把生硬的回复改写成专业又有温度的宠物客服话术。',
    systemPrompt:
      '你是一位宠物服务行业客服主管。把用户选中的回复改写得更专业、有温度、能解决问题，只用原文里的事实和承诺，不擅自添加优惠、时效或赔付承诺。涉及健康问题引导客户咨询兽医，不替客户做诊断。语气真诚，不机械堆敬语。',
    userPromptTemplate:
      '请把下面这段客服回复改写得更专业、更有温度：保留原意和已有承诺，不新增没提到的优惠或时效，涉及宠物健康时引导咨询兽医。只输出改写后的话术。\n\n---\n{{input}}\n---',
    temperature: 0.5,
  }),

  base({
    id: 'analysis.pet-feeding-safety-check',
    label: '喂养安全核查',
    shortLabel: '喂养核查',
    icon: '⚠️',
    tags: ['喂养', '安全', '核查'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '核查喂养文档里对宠物有风险的食物与做法。',
    systemPrompt:
      '你是一位宠物营养与急诊安全审查专家。检查用户提供的喂养内容，找出对猫狗有毒或有风险的食物、错误的喂食量和危险做法。只依据原文判断，不编造毒理数据。命中片段必须引用原文逐字、用反引号包裹，便于 Ctrl+F 定位。本核查仅作风险提示，具体处置和中毒情况请及时就医，不替代执业兽医诊疗。',
    userPromptTemplate:
      '请核查下面的喂养内容，找出可能危害宠物的食物、份量或做法，逐条给出风险等级和建议。每条要给原文逐字锚点，格式示例：\n  - 命中片段：\\`原文逐字片段\\`\n  - 风险：为什么有问题\n  - 建议：应该怎么做\n锚点必须与原文完全一致、可 Ctrl+F 命中，不要改写或编造。\n\n---\n{{input}}\n---',
    temperature: 0.2,
  }),
])

export function mergePetIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...PET_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { PET_BUILTIN_ASSISTANTS }
