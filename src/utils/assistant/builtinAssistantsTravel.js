/**
 * builtinAssistantsTravel — 「旅游/酒店」领域助手包(批10)
 * 生成类默认插入、核查类批注。约束:行程时间/价格照原文,不编造景点信息与安全承诺。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'travel'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.5, ...extra
})

export const TRAVEL_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.travel-itinerary', label: '行程单生成', shortLabel: '行程单生成', icon: '🗺️',
    tags: ['旅游', '生成', '行程'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '把目的地和天数整理成清晰行程单:每日安排、交通、餐饮住宿、贴士,节奏合理。',
    systemPrompt: '你是一位旅行规划师,排合理、可落地的行程。基于给定信息组织,时间/价格照原文,不编造门票价或营业时间(标"以现场为准")。',
    userPromptTemplate: `请把下面信息排成行程单:逐日安排(上午/下午/晚上、景点、交通、用餐、住宿)、每日贴士、预算提示。节奏合理不赶。具体票价/时间标"以官方为准"。\n信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.travel-attraction-intro', label: '景点介绍', shortLabel: '景点介绍', icon: '🏛️',
    tags: ['旅游', '生成', '景点'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '把景点资料写成生动介绍:看点、历史人文、最佳游览方式、拍照点,吸引人不浮夸。',
    systemPrompt: '你是一位旅游内容作者,写生动准确的景点介绍。只用给定资料,不编造历史或数据,有画面感不浮夸。',
    userPromptTemplate: `请把下面景点资料写成介绍:一句话亮点、核心看点、历史人文背景(只用给定的)、游览建议与最佳拍照点、实用贴士。\n景点资料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.travel-hotel-desc', label: '酒店描述', shortLabel: '酒店描述', icon: '🏨',
    tags: ['旅游', '生成', '酒店'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '把酒店信息写成吸引人的描述:位置交通、房型设施、特色服务、周边,真实不夸大。',
    systemPrompt: '你是一位酒店文案,写吸引人又真实的酒店描述。只用给定设施信息,不编造星级或未提供的服务。',
    userPromptTemplate: `请把下面酒店信息写成描述:位置与交通便利、房型与设施亮点、特色服务、周边吃喝玩、适合人群。真实不夸大。\n酒店信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.travel-guide', label: '旅游攻略', shortLabel: '旅游攻略', icon: '🧭',
    tags: ['旅游', '生成', '攻略'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '把目的地信息整理成实用攻略:怎么去、玩几天、必去、避坑、花费、注意,接地气。',
    systemPrompt: '你是一位资深旅行者,写实用接地气的攻略。基于给定信息,价格/时间标"参考、以实际为准",避坑提示具体,不编造。',
    userPromptTemplate: `请把下面目的地信息整理成攻略:交通到达、建议天数、必去与可选、避坑提示、大致花费(标参考)、实用注意(季节/证件/网络)。接地气。\n目的地信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.travel-complaint-reply', label: '酒店客诉回复', shortLabel: '酒店客诉', icon: '💬',
    tags: ['旅游', '生成', '客诉'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '针对住宿/服务投诉写得体回复:共情致歉、说明改进、给补偿或解决,挽回口碑。',
    systemPrompt: '你是一位酒店客户关系,写共情、专业、能挽回的客诉回复。依据给定情况,只承诺能兑现的补偿。',
    userPromptTemplate: `请针对下面酒店投诉写回复:共情致歉→说明核实与改进→具体解决或补偿(照政策)→欢迎再次光临。\n投诉:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.travel-visa-checklist', label: '签证材料清单', shortLabel: '签证清单', icon: '🛂',
    tags: ['旅游', '生成', '签证'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '根据目的地和签证类型整理材料清单,提示常见要求与注意,具体以使领馆为准。',
    systemPrompt: '你是一位签证顾问,整理材料清单。基于常见要求组织,明确提示"具体以使领馆最新要求为准",不臆造特定政策。',
    userPromptTemplate: `请根据下面目的地与签证类型整理材料清单:基础材料(护照/照片/表格)、财力证明、行程住宿、在职/在校证明、其他常见项。每项注意点。结尾提示以使领馆最新要求为准。\n目的地与类型:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.travel-study-tour', label: '研学方案', shortLabel: '研学方案', icon: '🎒',
    tags: ['旅游', '生成', '研学'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '把研学主题写成方案:目标、行程、课程活动、安全保障、收获评估,寓教于游。',
    systemPrompt: '你是一位研学课程设计师,写寓教于游、安全可行的研学方案。基于给定主题,活动与教育目标对应,安全措施具体。',
    userPromptTemplate: `请把下面研学主题写成方案:研学目标、适用学段、行程与课程活动安排(每站学什么)、安全与后勤保障、收获评估方式。\n研学主题:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.travel-bnb-copy', label: '民宿文案', shortLabel: '民宿文案', icon: '🏡',
    tags: ['旅游', '生成', '民宿'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.6,
    description: '把民宿信息写成有调性的文案:氛围、空间、周边体验、适合谁,种草不浮夸。',
    systemPrompt: '你是一位民宿主理人文案,写有调性、有画面感的民宿文案。只用真实设施信息,不编造,种草不夸大。',
    userPromptTemplate: `请把下面民宿信息写成文案:营造氛围的开头、空间与设施亮点、周边可体验、适合人群与场景。有调性、真实不浮夸。\n民宿信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.travel-tour-quote', label: '团队行程报价说明', shortLabel: '团队报价说明', icon: '💴',
    tags: ['旅游', '生成', '报价'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把团队/定制旅游报价整理成清晰说明:含/不含项、费用构成、变更政策,透明不藏坑。',
    systemPrompt: '你是一位旅游定制顾问,把报价整理透明清晰。金额照原文,明确含与不含,不藏附加费,变更/退改政策写清。',
    userPromptTemplate: `请把下面团队/定制旅游报价整理成说明:总价与人数、费用包含项、不包含项(自费/小费等)、费用构成、变更与退改政策。金额照原文,透明不藏坑。\n报价:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.travel-contract-review', label: '旅游合同审查', shortLabel: '旅游合同审查', icon: '📄',
    tags: ['旅游', '核查', '合同'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查旅游合同对游客不利的条款:行程变更、退改费、自费购物、安全责任、违约赔偿。',
    systemPrompt: '你是一位旅游法务,审查旅游合同对游客的风险。命中片段原文逐字、反引号包裹;不确定标「待人工核实」;不替代律师。',
    userPromptTemplate: `请审查下面旅游合同,关注:行程变更与缩水的处理、退改与违约金、强制自费/购物、安全保障与责任、保险、争议解决。\n## 风险/不利条款 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n合同:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.travel-guide-script', label: '导游词', shortLabel: '导游词', icon: '📣',
    tags: ['旅游', '生成', '导游'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.6,
    description: '把景点资料写成口语化导游词:讲解生动、有故事、有互动,适合现场带团讲。',
    systemPrompt: '你是一位金牌导游,写生动、口语化、有互动的导游词。只用给定资料的史实,不编造典故,有节奏适合现场讲。',
    userPromptTemplate: `请把下面景点资料写成导游词:热场开场→边走边讲(看点+故事/典故,只用给定的)→互动提问→温馨提示与集合安排。口语生动。\n景点资料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.travel-safety-tips', label: '旅行安全提示', shortLabel: '安全提示', icon: '⚠️',
    tags: ['旅游', '生成', '安全'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '根据目的地和活动整理旅行安全提示:健康、财物、交通、自然与应急,实用具体。',
    systemPrompt: '你是一位领队,整理实用的旅行安全提示。基于目的地与活动常识给提示,涉及具体救援电话等标"以当地为准",不编造。',
    userPromptTemplate: `请根据下面目的地与活动整理安全提示:健康与饮食、财物防盗、交通与出行、自然/天气风险、应急联系与处置。实用具体,具体电话标"以当地为准"。\n目的地与活动:\n---\n{{input}}\n---` })
])

export function mergeTravelIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...TRAVEL_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { TRAVEL_BUILTIN_ASSISTANTS, mergeTravelIntoBuiltins }
