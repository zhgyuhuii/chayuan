/**
 * builtinAssistantsCatering — 「餐饮/食品」领域助手包(批12)
 * 文案生成类插入、核查类批注、核算类批注。约束:不编造食材功效/产地,食品标签按法规、不夸大宣传。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'catering'
const GEN = `通用约束:只用给定信息,不编造食材功效、产地、销量;避免"最/治疗/保健功效"等违规宣传;直接输出成稿。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, defaultOutputFormat: 'markdown', temperature: 0.55, ...extra
})

export const CATERING_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.cat-menu-copy', label: '菜单文案', shortLabel: '菜单文案', icon: '🍽️',
    tags: ['餐饮', '文案', '菜单'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '把菜品信息写成有食欲的菜单文案:菜名、卖点描述、分类排版,诱人不浮夸。',
    systemPrompt: `你是一位餐饮文案,写有食欲、真实的菜单文案。只用给定食材信息,不编造功效产地。${GEN}`,
    userPromptTemplate: `请把下面菜品写成菜单文案:每道菜——菜名、一句诱人描述(口感/做法/食材亮点)。按品类分组。真实有食欲。\n菜品信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.cat-dish-desc', label: '招牌菜描述', shortLabel: '招牌菜描述', icon: '⭐',
    tags: ['餐饮', '文案', '菜品'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '为招牌菜写有画面感的详细描述:食材、工艺、口感、推荐吃法,种草不夸大。',
    systemPrompt: `你是一位美食文案,写有画面感的招牌菜描述。只用给定信息,不编造食材与工艺。${GEN}`,
    userPromptTemplate: `请为下面招牌菜写描述:选材、做法亮点、口感层次、推荐吃法或搭配。有画面感、勾食欲,真实。\n菜品:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.cat-review-reply', label: '餐厅点评回复', shortLabel: '点评回复', icon: '💬',
    tags: ['餐饮', '生成', '点评'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '针对好评/差评写得体回复:好评真诚致谢、差评共情改进,维护口碑不机械。',
    systemPrompt: '你是一位餐厅店长,写真诚、有温度的点评回复。好评具体致谢,差评共情致歉+改进,不模板、不狡辩。',
    userPromptTemplate: `请针对下面点评写回复(好评:真诚致谢+邀约再来;差评:共情致歉+说明改进+欢迎再给机会):\n点评:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.cat-takeout-copy', label: '外卖文案', shortLabel: '外卖文案', icon: '🛵',
    tags: ['餐饮', '文案', '外卖'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert',
    description: '为外卖平台写商品标题与描述:突出分量、口味、套餐优惠,适配平台搜索与转化。',
    systemPrompt: `你是一位外卖运营,写利于搜索与转化的外卖文案。只用真实信息,不编造,合规不夸大。${GEN}`,
    userPromptTemplate: `请为下面外卖商品写:利于搜索的标题(含品类关键词)、勾食欲的描述、套餐/优惠点。\n商品信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.cat-label-check', label: '食品标签合规检查', shortLabel: '食品标签检查', icon: '🏷️',
    tags: ['餐饮', '核查', '合规'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.15,
    description: '检查食品标签/宣传是否合规:虚假功效、保健暗示、绝对化用语、必标项缺失等。',
    systemPrompt: '你是一位食品合规审核,检查标签与宣传合规。命中片段原文逐字、反引号包裹;涉及具体标准标"以GB为准";只标确有问题处。',
    userPromptTemplate: `请检查下面食品标签/宣传,关注:虚假或夸大功效、保健/治疗暗示、绝对化用语、必标项(配料/净含量/生产者/保质期/标准号)是否齐全。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n内容:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.cat-store-promo', label: '门店活动方案', shortLabel: '门店活动', icon: '🎉',
    tags: ['餐饮', '生成', '活动'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.5,
    description: '把门店促销目标写成活动方案:主题、玩法、优惠、引流与留存、执行与物料。',
    systemPrompt: '你是一位餐饮运营,设计可落地的门店活动。基于给定目标,玩法清晰、成本可控,优惠合规不亏本。',
    userPromptTemplate: `请把下面目标写成门店活动方案:活动主题、目标人群、核心玩法与优惠、引流与复购设计、执行排期与物料清单、预算与风险。\n目标:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.cat-group-deal', label: '团购套餐设计', shortLabel: '团购套餐', icon: '🧧',
    tags: ['餐饮', '生成', '团购'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '根据菜品和成本设计团购套餐:搭配、定价、卖点文案、使用规则,引流又不亏。',
    systemPrompt: '你是一位餐饮运营,设计有吸引力又保利润的团购套餐。涉及成本/定价先列原文数字,规则清晰防纠纷。',
    userPromptTemplate: `请根据下面菜品与成本设计团购套餐:套餐搭配与份量、建议售价与让利(成本先列原文数字)、卖点文案、使用规则(有效期/堂食外带/不可叠加等)。\n菜品与成本:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.cat-food-safety-check', label: '食品安全自查', shortLabel: '食安自查', icon: '🦺',
    tags: ['餐饮', '核查', '食安'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '从现场记录中梳理食品安全自查项与隐患:加工、储存、留样、证照、人员卫生等。',
    systemPrompt: '你是一位食品安全员,梳理食安自查隐患。基于给定记录,隐患如实标,涉及标准提示以法规为准,不臆断处罚。',
    userPromptTemplate: `请从下面记录梳理食品安全隐患与自查要点:原料采购索证、加工与交叉污染、冷藏冷冻温度、留样、餐具消毒、证照与健康证、虫害防治。\n## 隐患/关注 (若无写"未发现明显隐患")\n- 涉及原文:\`原文片段\`\n- 隐患:\n- 整改:\n记录:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.cat-supplier-spec', label: '供应商验收标准', shortLabel: '验收标准', icon: '📋',
    tags: ['餐饮', '生成', '采购'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '为食材制定收货验收标准:感官、规格、温度、证照、保质期等,便于把控品质。',
    systemPrompt: '你是一位餐饮品控,制定实用的验收标准。基于给定食材,标准具体可操作,不臆造检测指标。',
    userPromptTemplate: `请为下面食材制定收货验收标准:感官要求(色香形)、规格/分量、温度要求、索证索票、保质期与新鲜度、拒收情形。\n食材:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.cat-staff-training', label: '员工培训手册', shortLabel: '员工培训', icon: '🎓',
    tags: ['餐饮', '生成', '培训'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.35,
    description: '把岗位要点写成餐饮员工培训手册:服务流程、话术、卫生规范、应急处理,实操为主。',
    systemPrompt: '你是一位餐饮培训师,写实操、易懂的培训手册。基于给定岗位,流程清晰、话术接地气、规范明确。',
    userPromptTemplate: `请把下面岗位要点写成培训手册:岗位职责、标准服务流程、常用话术、卫生与安全规范、常见情况处理、考核要点。实操为主。\n岗位要点:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.cat-cost-calc', label: '菜品成本核算', shortLabel: '成本核算', icon: '🧮',
    tags: ['餐饮', '核算', '成本'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '根据食材用量与单价核算菜品成本、毛利率,先列原文数字再算,辅助定价。',
    systemPrompt: '你是一位餐饮成本核算员,核算菜品成本与毛利。计算先把原文用量单价逐一列出再算,不臆造价格。',
    userPromptTemplate: `请核算下面菜品成本:逐项食材(用量×单价,照原文)、总成本、按给定售价算毛利率与毛利额(先列原文数字)。给定价/优化建议。\n菜品与食材:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.cat-festival-copy', label: '节日营销文案', shortLabel: '节日文案', icon: '🏮',
    tags: ['餐饮', '文案', '节日'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.6,
    description: '为节日/节气写餐饮营销文案:应景主题、产品结合、促单引导,有氛围不俗套。',
    systemPrompt: `你是一位餐饮营销文案,写应景、有氛围的节日文案。结合给定产品与节日,真实不夸大。${GEN}`,
    userPromptTemplate: `请为下面节日/产品写营销文案:给3条不同渠道版本(朋友圈/海报/群发),应景、有氛围、有促单引导。\n节日与产品:\n---\n{{input}}\n---` })
])

export function mergeCateringIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...CATERING_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { CATERING_BUILTIN_ASSISTANTS, mergeCateringIntoBuiltins }
