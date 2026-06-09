/**
 * builtinAssistantsJudicial — 「法律/司法/律所」领域助手包(批8)
 * 生成框架类插入、提取/核查类批注或none。约束:不杜撰法条原文与案例,不臆断事实,均提示不替代执业律师。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'judicial'
const DIS = `重要:本助手仅辅助整理/起草,不替代执业律师的正式法律意见;只用给定事实,不臆断;引用法律仅作原则性表述,不杜撰条文原文或案例,需确证处标【待核实】。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.3, ...extra
})

export const JUDICIAL_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.jud-complaint-extract', label: '起诉状要素提取', shortLabel: '起诉状要素', icon: '⚖️',
    tags: ['法律', '提取', '诉讼'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从案情材料提取起诉状要素:当事人、诉讼请求、事实理由要点、证据线索。',
    systemPrompt: `你是一位律师助理,从材料抽取起诉状要素,输出严格 JSON,只摘原文,找不到留空。${DIS}`,
    userPromptTemplate: `请从下面材料提取起诉状要素,输出严格 JSON:\n{"plaintiff":"","defendant":"","claims":[],"facts":"","evidence":[],"court":"","amount":""}\n材料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.jud-evidence-list', label: '证据清单整理', shortLabel: '证据清单', icon: '📎',
    tags: ['法律', '整理', '证据'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把证据材料整理成规范证据清单:序号、名称、证明对象、来源、页码,便于举证。',
    systemPrompt: `你是一位律师助理,整理规范证据清单。只依据给定材料,证明对象表述准确,不夸大证明力。${DIS}`,
    userPromptTemplate: `请把下面证据材料整理成证据清单,表格:序号 | 证据名称 | 证据来源 | 证明对象/待证事实 | 页码。\n证据材料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.jud-legal-opinion', label: '法律意见书框架', shortLabel: '法律意见框架', icon: '📝',
    tags: ['法律', '生成', '意见书'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把咨询事项搭成法律意见书框架:基本事实、法律问题、分析、结论与建议。',
    systemPrompt: `你是一位律师,搭建法律意见书框架。基于给定事实分析,法律依据作原则性表述,不杜撰条文,结论审慎。${DIS}`,
    userPromptTemplate: `请把下面咨询事项搭成法律意见书框架:一、基本事实;二、法律问题归纳;三、法律分析(原则性引用,不杜撰条文);四、结论与建议;五、风险提示。事实缺口标【待补充】。\n咨询事项:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.jud-case-summary', label: '案情摘要', shortLabel: '案情摘要', icon: '📄',
    tags: ['法律', '摘要', '案情'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把冗长案卷整理成案情摘要:当事人、争议焦点、时间线、各方主张、证据概览。',
    systemPrompt: `你是一位律师,把案卷整理成清晰案情摘要。只摘原文事实,客观中立,不预设结论。${DIS}`,
    userPromptTemplate: `请把下面案卷整理成案情摘要:当事人关系、争议焦点、事实时间线、各方主张、证据概览。客观中立,忠于原文。\n案卷:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.jud-defense-draft', label: '答辩状起草', shortLabel: '答辩状起草', icon: '🛡️',
    tags: ['法律', '生成', '答辩'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '根据被诉情况起草答辩状框架:对诉请的态度、事实抗辩、法律抗辩、答辩请求。',
    systemPrompt: `你是一位律师,起草答辩状框架。基于给定事实组织抗辩,法律依据原则性表述,不杜撰,不编造事实。${DIS}`,
    userPromptTemplate: `请根据下面被诉情况起草答辩状:答辩人信息、对诉讼请求的总体意见、事实抗辩(逐项回应)、法律抗辩(原则性)、答辩请求。事实缺口标【待补充】。\n被诉情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.jud-precedent-extract', label: '判例要旨提取', shortLabel: '判例要旨', icon: '📚',
    tags: ['法律', '提取', '判例'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '从裁判文书提取要旨:基本案情、争议焦点、裁判理由、裁判规则,便于检索类案。',
    systemPrompt: `你是一位律师,从裁判文书提取要旨。只摘原文,裁判规则准确概括,不外推。${DIS}`,
    userPromptTemplate: `请从下面裁判文书提取要旨:案号与审级、基本案情、争议焦点、法院裁判理由、可参考的裁判规则。只依据原文。\n裁判文书:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.jud-document-review', label: '法律文书校核', shortLabel: '法律文书校核', icon: '🔍',
    tags: ['法律', '核查', '文书'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '校核法律文书的要素完整、称谓与当事人一致、诉求与事实对应、引用与日期等问题。',
    systemPrompt: `你是一位律师,校核法律文书。命中片段原文逐字、反引号包裹;查要素缺失、前后矛盾、当事人/金额/日期不一致。${DIS}`,
    userPromptTemplate: `请校核下面法律文书,关注:必备要素是否齐全、当事人称谓前后是否一致、诉讼请求与事实理由是否对应、金额/日期/引用是否前后一致、有无错漏。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n文书:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.jud-trial-outline', label: '庭审提纲', shortLabel: '庭审提纲', icon: '🗂️',
    tags: ['法律', '生成', '庭审'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '根据案情整理庭审提纲:举证质证要点、争议焦点应对、发问提纲、辩论意见要点。',
    systemPrompt: `你是一位出庭律师,整理实用庭审提纲。基于给定案情,围绕争议焦点组织,不编造证据。${DIS}`,
    userPromptTemplate: `请根据下面案情整理庭审提纲:争议焦点、举证质证要点、对对方证据的质证思路、发问提纲、辩论意见要点。\n案情:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.jud-compliance-rectify', label: '合规整改建议', shortLabel: '合规整改', icon: '🧰',
    tags: ['法律', '生成', '合规'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '针对发现的合规问题,给出整改建议:问题、风险、整改措施、优先级,务实可落地。',
    systemPrompt: `你是一位合规律师,给务实的整改建议。基于给定问题,措施具体可落地,法律依据原则性表述。${DIS}`,
    userPromptTemplate: `请针对下面合规问题给整改建议:逐项——问题描述、法律/合规风险、具体整改措施、优先级、责任建议。\n合规问题:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.jud-research-points', label: '法律检索要点', shortLabel: '法律检索要点', icon: '🔎',
    tags: ['法律', '分析', '检索'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '把法律问题拆成可检索的要点:法律关系、关键词、待查法条方向、类案检索思路。',
    systemPrompt: `你是一位律师,把问题拆成检索要点。给检索方向与关键词,不杜撰具体法条编号与案例,需查证处标【待检索】。${DIS}`,
    userPromptTemplate: `请把下面法律问题拆成检索要点:涉及的法律关系、争议法律问题、检索关键词、可能涉及的法律领域/方向(原则性,不杜撰条号)、类案检索思路。\n问题:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.jud-agent-statement', label: '代理词框架', shortLabel: '代理词框架', icon: '🎤',
    tags: ['法律', '生成', '代理词'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.35,
    description: '根据案情和己方立场搭代理词框架:事实梳理、争议焦点分析、法律适用、代理意见。',
    systemPrompt: `你是一位代理律师,搭建有说服力的代理词框架。基于给定事实与立场,法律适用原则性表述,不杜撰,不编造证据。${DIS}`,
    userPromptTemplate: `请根据下面案情与己方立场搭代理词框架:事实梳理、争议焦点、围绕焦点的事实与法律分析、代理意见(请求)。法律适用原则性,事实缺口标【待补充】。\n案情与立场:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.jud-risk-notice', label: '法律风险告知书', shortLabel: '风险告知书', icon: '⚠️',
    tags: ['法律', '生成', '风险'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把诉讼/交易风险整理成风险告知书:风险点、可能后果、应对建议,向当事人如实告知。',
    systemPrompt: `你是一位律师,撰写如实、审慎的风险告知书。基于给定情况客观提示风险,不夸大不隐瞒,不做胜诉承诺。${DIS}`,
    userPromptTemplate: `请把下面情况整理成法律风险告知书:逐项——风险点、可能的不利后果、发生可能性提示、应对/防范建议。客观如实,不承诺结果。\n情况:\n---\n{{input}}\n---` })
])

export function mergeJudicialIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...JUDICIAL_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { JUDICIAL_BUILTIN_ASSISTANTS, mergeJudicialIntoBuiltins }
