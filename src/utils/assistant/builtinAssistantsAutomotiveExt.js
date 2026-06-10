/**
 * builtinAssistantsAutomotiveExt — 「汽车/交通」领域扩展包
 * 在现有包之外补充高频且互不重复的文书/核查/抽取助手。
 * 约束:参数/里程/金额照原文,核查类逐字反引号锚点,抽取类找不到留空不编造,涉法律/金融加免责提示。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'automotive'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const AUTOMOTIVE_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  // 1) 交付检查清单(PDI)生成 —— 现有无「交车/验车」环节
  base({ id: 'analysis.auto-pdi-checklist', label: '新车交付验车清单', shortLabel: '交付验车', icon: '✅',
    tags: ['汽车', '生成', '交付'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '根据车型与交付信息生成提车验车清单:外观漆面、铭牌生产日期、随车物件、功能试操作、单据核对。',
    systemPrompt: '你是一位汽车交付专员(PDI),生成提车验车清单。车型/VIN/日期照原文,逐项给「查什么、合格标准、不合格怎么办」,不夸大也不漏关键项。',
    userPromptTemplate: `请根据下面交付信息,生成一份提车验车清单,分组列出:外观与漆面、玻璃灯光、铭牌与生产日期(对照是否库存车)、内饰与里程、功能试操作(空调/多媒体/电动件)、随车物件与单据(合格证/发票/保养手册/三包卡)、签字交付前确认项。每项写明查什么、合格标准、发现问题如何处理。信息照原文,缺失处标【待补充】。\n交付信息:\n---\n{{input}}\n---` }),

  // 2) 车辆使用/交接管理制度 起草 —— 公务车/车队场景,现有无制度类
  base({ id: 'analysis.auto-fleet-policy', label: '车辆使用管理制度', shortLabel: '用车制度', icon: '📜',
    tags: ['交通', '生成', '制度'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.35,
    description: '把用车管理要点起草成公务/公司车辆使用管理制度:申请审批、派车交接、油费保养、事故处理、违章责任。',
    systemPrompt: '你是一位车辆行政管理专家,起草公司车辆使用管理制度。条款编号清晰、责任到岗、可执行;金额/期限照原文,空缺留【待定】,不堆套话。',
    userPromptTemplate: `请把下面要点起草成《车辆使用管理制度》,分条款:适用范围、用车申请与审批、派车与钥匙交接登记、加油与费用报销、保养维修流程、违章与事故责任划分、私用与考核、附则。条款编号清晰、责任到岗。金额期限照原文,缺则【待定】。\n管理要点:\n---\n{{input}}\n---` }),

  // 3) 试驾协议/免责声明 审查 —— 现有合同审查只针对购车合同
  base({ id: 'analysis.auto-testdrive-agreement-review', label: '试驾协议审查', shortLabel: '试驾协议审查', icon: '🔍',
    tags: ['汽车', '核查', '协议'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查试驾协议/借车试驾免责条款对试驾人不公或无效之处:责任划分、押金、保险范围、事故赔偿。',
    systemPrompt: '你是一位汽车消费法务,审查试驾/借车协议。命中片段原文逐字、反引号包裹;不确定标「待人工核实」。仅辅助,不替代专业律师。',
    userPromptTemplate: `请审查下面试驾协议,关注:事故责任与赔偿是否全推给试驾人、保险是否覆盖试驾期间、押金/资料扣押是否合理、免责条款是否排除经营者法定责任(可能无效)、试驾路线与限速约束。\n## 风险/不利条款 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n(仅辅助,不替代专业律师)\n协议:\n---\n{{input}}\n---` }),

  // 4) 维修报价/账单 核查(过度维修/重复收费) —— 现有维修工单是整理,这里是核查
  base({ id: 'analysis.auto-repair-quote-audit', label: '维修报价核查', shortLabel: '报价核查', icon: '💰',
    tags: ['汽车', '核查', '维修'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '核查维修报价单是否存在过度维修、重复收费、工时虚高、配件名实不符、合计算错等问题。',
    systemPrompt: '你是一位汽车维修审价专家,核查报价单。命中片段原文逐字、反引号包裹;金额先列原文数字再核算;无法判断标「待人工核实」,不臆断猫腻。',
    userPromptTemplate: `请核查下面维修报价单,关注:与故障不相符的维修项、重复或拆分收费、工时费明显偏高、配件原厂/副厂未注明、合计是否等于各项之和(先列原文数字再算)、不必要的更换建议。\n## 疑点 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议核实/砍项:\n(仅辅助判断,以实车与专业评估为准)\n报价单:\n---\n{{input}}\n---` }),

  // 5) 道路交通事故 责任/赔偿要点(基于事故认定书等) —— 现有只有车险理赔,这里偏事故责任
  base({ id: 'analysis.auto-accident-handling', label: '交通事故处理要点', shortLabel: '事故处理', icon: '🚧',
    tags: ['交通', '生成', '事故'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '根据事故经过/认定书整理处理要点:现场处置、责任划分理解、协商赔偿、走司法的边界与材料。',
    systemPrompt: '你是一位交通事故处理顾问,整理处理要点。责任与金额以事故认定书/原文为准,不替当事人定责;涉赔偿协商提示保留证据。仅辅助,不替代专业律师与交警认定。',
    userPromptTemplate: `请根据下面事故信息整理处理要点:现场应做与已做的处置、对责任划分(以认定书为准)的理解、赔偿项目与协商建议、和解书要点、何时需走诉讼及所需材料、时效提醒。责任与金额照原文。\n## 关键依据(逐字引用原文)\n- 依据片段:\`原文逐字片段\`\n- 据此判断:\n(仅辅助,以交警认定与专业律师意见为准)\n事故信息:\n---\n{{input}}\n---` }),

  // 6) 车型卖点/参数 改写成短视频口播脚本 —— 改写类,现有无短视频脚本
  base({ id: 'analysis.auto-video-script', label: '车型短视频脚本', shortLabel: '车型脚本', icon: '🎬',
    tags: ['汽车', '改写', '短视频'], allowedActions: ['replace', 'insert', 'append', 'none'], defaultAction: 'replace',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.6,
    description: '把车型卖点/参数改写成口语化短视频口播脚本:钩子开场、3-4个记忆点、口播节奏、结尾引导。',
    systemPrompt: '你是一位汽车内容编导,把素材改写成短视频口播脚本。卖点参数照原文,说人话、有节奏,不堆形容词不喊口号,留口播停顿提示。',
    userPromptTemplate: `请把下面车型素材改写成 60 秒短视频口播脚本:开场 3 秒钩子、3-4 个让人记住的卖点(配口播)、一句对比/化解顾虑、结尾引导(到店/留资)。口语化、有停顿节奏,参数照原文不夸大。\n车型素材:\n---\n{{input}}\n---` }),

  // 7) 客户投诉/差评 回复起草 —— 改写/起草,现有无客诉
  base({ id: 'analysis.auto-complaint-reply', label: '客诉回复起草', shortLabel: '客诉回复', icon: '🤝',
    tags: ['汽车', '生成', '客诉'], allowedActions: ['insert', 'replace', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '根据客户投诉/差评内容起草得体回复:共情、说清事实、给出处理方案与时限,不甩锅不空话。',
    systemPrompt: '你是一位汽车售后客户关系专员,起草客诉回复。基于原文事实,先共情再给方案;事实/承诺照原文,不夸大补偿不甩锅,语气真诚具体。',
    userPromptTemplate: `请根据下面投诉内容起草回复:先共情致歉、复述并确认问题、说明原因(已知则讲不臆断)、给出具体处理方案与时限、留联系人跟进。语气真诚,不空话不甩锅,承诺以原文为准。\n投诉内容:\n---\n{{input}}\n---` }),

  // 8) 二手车检测/车况报告 关键信息抽取 —— 抽取类 JSON,现有全是 markdown
  base({ id: 'analysis.auto-vehicle-extract', label: '车况信息抽取', shortLabel: '车况抽取', icon: '🧾',
    tags: ['汽车', '抽取', '车况'], allowedActions: ['none'], defaultAction: 'none',
    defaultOutputFormat: 'json', temperature: 0.1,
    description: '从车况/检测报告或行驶证信息中抽取结构化字段:车型、VIN、里程、出险/维修事项等,找不到留空。',
    systemPrompt: '你是一位汽车数据整理专家,从文本抽取结构化车况信息。只取原文明确出现的值,找不到留空字符串或空数组,绝不编造 VIN、里程或事故信息。',
    userPromptTemplate: `请从下面文本抽取车况信息,严格按 JSON 输出,找不到的字段留空字符串、列表留空数组,不要编造:\n{\n  "brand_model": "",\n  "year": "",\n  "vin": "",\n  "plate": "",\n  "mileage_km": "",\n  "color": "",\n  "transmission": "",\n  "fuel_type": "",\n  "registration_date": "",\n  "issues": [{"system": "", "description": "", "severity": ""}],\n  "accident_records": [""],\n  "maintenance_items": [""]\n}\n文本:\n---\n{{input}}\n---` }),

  // 9) 车贷/分期方案 信息抽取与逐月核算辅助 —— 抽取类 JSON,涉金融加免责
  base({ id: 'analysis.auto-loan-extract', label: '车贷方案抽取', shortLabel: '车贷抽取', icon: '🏦',
    tags: ['汽车', '抽取', '金融'], allowedActions: ['none'], defaultAction: 'none',
    defaultOutputFormat: 'json', temperature: 0.1,
    description: '从车贷/分期方案文本抽取关键字段:贷款金额、期数、利率、月供、首付、各类费用,找不到留空不编造。',
    systemPrompt: '你是一位汽车金融数据整理专家,从分期方案抽取结构化字段。只取原文明确数值,找不到留空,绝不自行套公式倒算或编造利率月供。仅辅助整理,不替代专业金融与合同审阅。',
    userPromptTemplate: `请从下面车贷/分期方案抽取信息,严格按 JSON 输出,找不到的字段留空字符串、列表留空数组,数值照原文不要换算或编造:\n{\n  "vehicle_price": "",\n  "down_payment": "",\n  "loan_amount": "",\n  "terms_months": "",\n  "interest_rate": "",\n  "monthly_payment": "",\n  "total_interest": "",\n  "extra_fees": [{"name": "", "amount": ""}],\n  "bank_or_finance": "",\n  "gps_or_mortgage": ""\n}\n方案文本:\n---\n{{input}}\n---` })
])

export function mergeAutomotiveExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...AUTOMOTIVE_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}
export default { AUTOMOTIVE_EXT_BUILTIN_ASSISTANTS, mergeAutomotiveExtIntoBuiltins }
