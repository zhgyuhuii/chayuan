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

export const PET_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.pet-boarding-agreement',
    label: '宠物寄养协议起草',
    shortLabel: '寄养协议',
    icon: '🏨',
    tags: ['寄养', '协议', '合同'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把寄养信息起草成权责清楚的宠物寄养协议。',
    systemPrompt:
      '你是一位宠物寄养行业的合同起草专员。根据用户给的寄养信息起草协议，把双方责任、费用、健康免责、突发情况处理写清楚，只用提供的价格、日期、宠物信息，不编造金额和条款。本协议为通用模板，仅辅助起草，不替代执业律师审核，正式签署前请由专业人员确认。语言直白可执行，不写空话。',
    userPromptTemplate:
      '请根据下面的寄养信息起草一份宠物寄养协议：包含寄养方与受托方信息、宠物基本情况、寄养时间与费用、日常照护约定、健康与意外处理、双方责任与免责、违约处理。资料里没有的金额或条款写成"待双方约定"，不要编造。\n\n---\n{{input}}\n---',
    temperature: 0.3,
  }),

  base({
    id: 'analysis.pet-grooming-record',
    label: '美容护理记录单',
    shortLabel: '美容记录',
    icon: '✂️',
    tags: ['美容', '护理', '记录'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把美容过程整理成可交付给主人的护理记录单。',
    systemPrompt:
      '你是一位宠物美容店的门店管理员。根据用户给的美容信息整理记录单，写清做了哪些项目、用了什么产品、发现的皮肤毛发问题和后续护理建议，只用提供的信息，不编造服务项目或收费。发现的皮肤异常只如实记录并建议就医，不下诊断结论。语言简洁清楚，方便主人看懂。',
    userPromptTemplate:
      '请根据下面的美容信息，整理一份护理记录单：包含宠物信息、本次服务项目、所用产品、美容师观察到的毛发或皮肤情况、下次建议时间和居家护理提示。只用给出的信息，缺的标注"未记录"，发现异常提醒就医而不下结论。\n\n---\n{{input}}\n---',
    temperature: 0.4,
  }),

  base({
    id: 'analysis.pet-surgery-consent',
    label: '手术麻醉知情同意书',
    shortLabel: '知情同意',
    icon: '🩺',
    tags: ['手术', '麻醉', '同意书'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把手术信息起草成主人能看懂的知情同意书。',
    systemPrompt:
      '你是一位宠物医院的医务文书专员。根据用户给的手术与麻醉信息起草知情同意书，把手术内容、麻醉风险、可能并发症、术后注意和费用约定写清楚，只用提供的信息，不编造风险概率或价格。本文书仅辅助起草，具体诊疗方案与风险告知以主诊兽医为准，不替代专业医疗判断。语言让普通主人能读懂，不堆专业术语。',
    userPromptTemplate:
      '请根据下面的手术信息，起草一份手术与麻醉知情同意书：包含宠物信息、拟行手术、麻醉方式、主要风险与可能并发症、术前要求、术后护理、费用与突发情况授权、主人签字栏。只用给出的信息，没有的写成"由主诊兽医现场说明"，不要编造概率和金额。\n\n---\n{{input}}\n---',
    temperature: 0.3,
  }),

  base({
    id: 'analysis.pet-symptom-extract',
    label: '症状主诉结构化',
    shortLabel: '症状抽取',
    icon: '🔬',
    tags: ['症状', '主诉', '抽取'],
    allowedActions: ['none'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把主人口述的症状抽成结构化分诊字段。',
    systemPrompt:
      '你是一位宠物医院的分诊台信息员。从主人口述的文字里抽取症状要素，输出严格合法的 JSON。只抽取原文出现的信息，找不到的字段留空字符串或空数组，绝不推断病因或编造体征。仅整理主诉，不做诊断，具体判断以执业兽医为准。',
    userPromptTemplate:
      '从下面主人描述的内容中抽取症状信息，只输出 JSON，结构如下：\n{\n  "pet_name": "",\n  "species": "",\n  "onset_time": "",\n  "main_symptoms": [],\n  "appetite": "",\n  "water_intake": "",\n  "urination_stool": "",\n  "vomiting": "",\n  "energy_level": "",\n  "recent_changes": "",\n  "duration": ""\n}\n原文没有的留空，不要编造或推断。\n\n---\n{{input}}\n---',
    temperature: 0.1,
  }),

  base({
    id: 'analysis.pet-purchase-contract-review',
    label: '活体买卖合同核查',
    shortLabel: '买卖核查',
    icon: '📑',
    tags: ['活体', '买卖', '核查'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '逐条核出活体买卖合同里的健康保障与退换陷阱。',
    systemPrompt:
      '你是一位宠物活体交易纠纷的合同审查顾问。逐条核查用户提供的买卖合同，标出健康保障期、疫苗与检疫约定、退换与赔付条件、责任划分和对买方不利的条款。只依据原文，不编造条款。命中片段必须引用原文逐字、用反引号包裹，便于读者 Ctrl+F 定位。本核查仅供参考，最终以正式签署文本和专业律师意见为准，不替代法律咨询。',
    userPromptTemplate:
      '请逐条核查下面的宠物活体买卖合同，列出健康保障期、疫苗检疫约定、退换货与赔付条件、责任划分，并标出对买方不利或含糊的地方。每条都要给原文逐字锚点，格式示例：\n  - 命中片段：\\`原文逐字片段\\`\n  - 说明：这条对买方意味着什么\n  - 建议：是否需要修改或补充\n锚点必须与原文完全一致、可 Ctrl+F 命中，不要改写或编造。\n\n---\n{{input}}\n---',
    temperature: 0.2,
  }),

  base({
    id: 'analysis.pet-review-polish',
    label: '宠业评价回复润色',
    shortLabel: '评价润色',
    icon: '🌟',
    tags: ['评价', '回复', '润色'],
    allowedActions: ['replace', 'insert', 'append', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '把宠物店对顾客评价的回复改写得得体专业。',
    systemPrompt:
      '你是一位宠物门店的口碑运营。把选中的评价回复改写得更得体、专业、真诚，差评回复要先共情再说处理办法，好评回复不空喊感谢。只用原文里的事实和已有的处理承诺，不擅自添加赔偿、优惠或时效。涉及宠物健康投诉时引导顾客线下沟通和咨询兽医，不在公开回复里下结论。语气真诚，不机械套敬语。',
    userPromptTemplate:
      '请把下面这段对顾客评价的回复改写得更得体专业：差评先共情、说清处理方式，好评回应具体不空泛，保留已有承诺，不新增没提到的赔偿或优惠，涉及健康争议引导线下沟通。只输出改写后的回复。\n\n---\n{{input}}\n---',
    temperature: 0.5,
  }),

  base({
    id: 'analysis.pet-vaccine-schedule-check',
    label: '免疫驱虫计划核查',
    shortLabel: '免疫核查',
    icon: '📆',
    tags: ['免疫', '驱虫', '核查'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '核查免疫驱虫计划里的间隔与遗漏问题。',
    systemPrompt:
      '你是一位宠物预防医学的免疫规划审查员。检查用户提供的免疫和驱虫计划，找出接种间隔不合理、项目遗漏、时间冲突或剂量描述不清的地方。只依据原文判断，不编造疫苗品牌或固定的接种月龄标准。命中片段必须引用原文逐字、用反引号包裹，便于 Ctrl+F 定位。本核查仅作提示，具体免疫方案以执业兽医结合宠物情况制定为准，不替代专业判断。',
    userPromptTemplate:
      '请核查下面的免疫与驱虫计划，找出接种间隔、项目遗漏、时间冲突或剂量描述不清的问题，逐条说明。每条要给原文逐字锚点，格式示例：\n  - 命中片段：\\`原文逐字片段\\`\n  - 问题：哪里不对或缺什么\n  - 建议：应如何核实或调整\n锚点必须与原文完全一致、可 Ctrl+F 命中，不要改写或编造。涉及具体月龄差异时提示以兽医方案为准。\n\n---\n{{input}}\n---',
    temperature: 0.2,
  }),

  base({
    id: 'analysis.pet-lost-found-notice',
    label: '寻宠启事撰写',
    shortLabel: '寻宠启事',
    icon: '🔍',
    tags: ['寻宠', '启事', '文案'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把走失信息写成转发率高、信息全的寻宠启事。',
    systemPrompt:
      '你是一位帮人找回走失宠物的本地寻宠志愿者。根据主人给的信息写寻宠启事，把外形特征、走失时间地点、联系方式和酬谢写清楚，让看到的人能一眼记住、方便提供线索。只用主人提供的信息，不编造特征或酬金。语言急切但清楚，不堆煽情词，重点信息突出。',
    userPromptTemplate:
      '请根据下面的走失信息，写一篇寻宠启事：开头一句话说清在哪走失，再列宠物外形特征（品种、毛色、体型、有无项圈或标识）、走失时间地点、性格提示（怕不怕生、会不会跑）、联系方式和酬谢。只用给出的信息，没有的不要编。\n\n---\n{{input}}\n---',
    temperature: 0.5,
  }),
])

export function mergePetExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...PET_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { PET_EXT_BUILTIN_ASSISTANTS }
