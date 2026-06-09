// 内置助手包：留学 / 移民（察元AI文档助手 WPS 加载项）
// 自动集成，请勿手改字段结构。
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'studyabroad'

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

export const STUDYABROAD_BUILTIN_ASSISTANTS = Object.freeze([
  // 1) 留学/移民方案规划（生成）
  base({
    id: 'analysis.sa-plan',
    label: '留学移民方案规划',
    shortLabel: '方案规划',
    icon: '🧭',
    tags: ['留学', '移民', '方案'],
    allowedActions: ['insert', 'replace', 'comment'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据学生背景与目标，生成分阶段的留学或移民路径规划草案。',
    systemPrompt:
      '你是一位深耕留学与移民申请的资深顾问，做过大量本科、硕士、技术移民与家庭团聚案例。'
      + '你只根据用户提供的背景信息（学历、成绩、语言、预算、目标国家/专业、时间）来规划，'
      + '不编造录取概率、奖学金额度、签证通过率或具体配额数字。'
      + '凡涉及签证政策、移民法、资金证明等法律或政策细节，明确写明“仅供参考，最终以使领馆/移民局官方政策与持牌移民律师/顾问意见为准，本助手不替代专业法律意见”。'
      + '如果关键信息缺失（如预算、语言成绩），先列出“需补充的信息”，再给出基于已知条件的初步方案，不要替用户假设数字。',
    userPromptTemplate:
      '请阅读以下学生背景，输出一份留学/移民方案规划，包含：\n'
      + '1) 目标定位（国家/地区、专业或移民类别、合理梯度）\n'
      + '2) 分阶段时间线（语言、考试、文书、申请、签证）\n'
      + '3) 关键准备项与潜在风险点\n'
      + '4) 需要补充的信息清单\n'
      + '只用文中给出的事实，不编造分数线、配额或通过率。\n'
      + '---\n{{input}}\n---',
  }),

  // 2) 个人陈述 PS 润色（改写）
  base({
    id: 'analysis.sa-ps-polish',
    label: '个人陈述PS润色',
    shortLabel: 'PS润色',
    icon: '✍️',
    tags: ['文书', '个人陈述', '润色'],
    allowedActions: ['replace', 'insert', 'comment'],
    defaultAction: 'replace',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '润色个人陈述（PS），让语言更地道、逻辑更清晰，保留原有事实与经历。',
    systemPrompt:
      '你是一位常年指导英文/中文留学文书的资深文书导师，熟悉招生官的阅读习惯。'
      + '你的任务是润色，不是重写人生：只优化表达、衔接和结构，'
      + '严禁新增、夸大或编造申请人没写过的经历、奖项、实习或数据。'
      + '保持申请人的第一人称口吻与真实细节，去掉空话套话和模板腔，'
      + '不要用“随着时代发展”“总而言之”这类陈词，也不要无意义堆砌四字排比和加粗。'
      + '如发现原文有明显逻辑断层或事实空缺，用一句话提示，但不擅自填充内容。',
    userPromptTemplate:
      '请润色下面这段个人陈述：让语言更自然地道、段落衔接更顺、动机和经历的因果更清晰；'
      + '保留全部真实经历和事实，不要新增不存在的成就。直接给出润色后的正文。\n'
      + '---\n{{input}}\n---',
  }),

  // 3) 推荐信框架（生成）
  base({
    id: 'analysis.sa-recommendation',
    label: '推荐信框架草拟',
    shortLabel: '推荐信',
    icon: '📨',
    tags: ['推荐信', '文书', '框架'],
    allowedActions: ['insert', 'replace', 'comment'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '基于推荐人与被推荐人的真实关系与事例，搭建推荐信结构与要点。',
    systemPrompt:
      '你是一位帮助师生准备英文推荐信的资深顾问。'
      + '推荐信必须基于真实的师生/上下级关系和具体事例，'
      + '你只能依据用户提供的相处场景、课程、项目、表现来组织内容，'
      + '不得编造成绩排名、获奖、量化贡献或推荐人不知道的细节。'
      + '输出是给推荐人参考的框架与要点，不是替推荐人定稿；'
      + '语言克制、具体、避免空泛溢美和模板套话。',
    userPromptTemplate:
      '请根据以下推荐人与被推荐人的背景信息，搭建一封推荐信的框架：\n'
      + '1) 开头：推荐人身份与认识被推荐人的场景、时长\n'
      + '2) 主体：2-3 个可佐证的具体事例与对应能力\n'
      + '3) 结尾：总体评价与推荐力度\n'
      + '对缺少事例支撑的地方，标注“需推荐人补充具体事例”，不要自行编造。\n'
      + '---\n{{input}}\n---',
  }),

  // 4) 申请材料清单（生成）
  base({
    id: 'analysis.sa-doc-checklist',
    label: '申请材料清单生成',
    shortLabel: '材料清单',
    icon: '🗂️',
    tags: ['申请', '材料', '清单'],
    allowedActions: ['insert', 'replace', 'comment'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据申请类型与目标，梳理需要准备的材料清单及状态。',
    systemPrompt:
      '你是一位经办过大量院校与签证申请的资深留学顾问，熟悉常见材料构成。'
      + '你只根据用户描述的申请类型（本科/硕士/博士/移民/语言学校）和目标地区，'
      + '整理通用且高频的材料清单。'
      + '具体院校或使领馆的特殊要求、清单细节可能随年份变化，'
      + '凡不确定的项目要标注“以目标院校/使领馆当年官方要求为准”，不要编造表格编号或具体页数要求。',
    userPromptTemplate:
      '请根据以下申请背景，生成一份申请材料清单，用表格列出：材料名称 | 是否必备 | 备注/注意事项 | 准备状态。\n'
      + '把学术材料、语言/标化、文书、资金证明、身份与签证材料分组列出。\n'
      + '不确定是否要求的项目，备注里写明“以官方当年要求为准”。\n'
      + '---\n{{input}}\n---',
  }),

  // 5) 签证材料整理（生成）
  base({
    id: 'analysis.sa-visa-prep',
    label: '签证材料整理',
    shortLabel: '签证材料',
    icon: '🛂',
    tags: ['签证', '材料', '整理'],
    allowedActions: ['insert', 'replace', 'comment'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把零散的签证准备信息整理为有条理的材料结构与时间安排。',
    systemPrompt:
      '你是一位熟悉学生签证与移民签证办理流程的资深顾问。'
      + '你只整理用户提供的信息，把它结构化，不编造签证类别代码、表格编号、审理时长或具体面签问题。'
      + '签证政策与材料要求由各国使领馆/移民局决定且时常调整，'
      + '务必写明“仅辅助整理，不替代持牌移民律师/官方政策，最终以使领馆/移民局当年要求为准”。'
      + '资金证明、存款冻结等敏感项只做提醒，不给出会被误读为承诺通过的表述。',
    userPromptTemplate:
      '请把以下签证准备信息整理为：\n'
      + '1) 材料分类（身份、学术、资金、关系证明、其他）\n'
      + '2) 每项的状态与待办\n'
      + '3) 建议的准备时间顺序\n'
      + '不补充原文没有的政策数字或审理周期，不确定处标注“以官方为准”。\n'
      + '---\n{{input}}\n---',
  }),

  // 6) 文书校对核查（核查 / check）
  base({
    id: 'analysis.sa-essay-check',
    label: '文书校对核查',
    shortLabel: '文书核查',
    icon: '🔍',
    tags: ['文书', '校对', '核查'],
    allowedActions: ['comment', 'link-comment', 'insert'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '逐句核查文书的语法、事实一致性、字数与禁忌表达，逐条给批注。',
    systemPrompt:
      '你是一位严谨的留学文书校对专家。'
      + '你的工作是挑问题，不是夸奖：检查语法拼写、时态人称一致、'
      + '前后事实/时间/数字是否自洽、是否出现模板套话或夸大其词、是否可能触发抄袭或 AI 味嫌疑。'
      + '只基于文中内容判断，不臆测申请人的真实经历。'
      + '每条问题必须引用原文逐字片段作为锚点，给出具体修改建议，不要泛泛而谈。'
      + '语气直接、可执行。',
    userPromptTemplate:
      '请逐条核查下面这篇文书，每条问题按以下格式输出：\n'
      + '- 命中片段：\\`原文逐字片段\\`\n'
      + '- 问题类型：（语法/事实不一致/字数/套话/夸大/其他）\n'
      + '- 修改建议：……\n'
      + '只标注确有问题处，引用片段必须与原文逐字一致。\n'
      + '---\n{{input}}\n---',
  }),

  // 7) 院校专业对比（生成 / 分析）
  base({
    id: 'analysis.sa-school-compare',
    label: '院校专业对比',
    shortLabel: '院校对比',
    icon: '🏫',
    tags: ['院校', '专业', '对比'],
    allowedActions: ['insert', 'replace', 'comment'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把候选院校/专业按用户关心的维度整理成对比表，便于决策。',
    systemPrompt:
      '你是一位熟悉海外院校与专业设置的资深选校顾问。'
      + '你只能根据用户在文中提供的院校信息进行对比与归纳，'
      + '绝不编造排名、学费、录取分数、就业率或地理位置等用户未提供的数据；'
      + '缺失的维度在表格里留空或写“未提供”。'
      + '涉及数字时，先复述原文给出的数字，再做比较，不要自行估算或引用记忆中的排名。'
      + '最后基于已知条件给出权衡建议，并说明这是参考、非定论。',
    userPromptTemplate:
      '请把以下候选院校/专业整理成对比表，列出用户提到的维度（如专业方向、学费、时长、地点、申请要求等），'
      + '用户没提供的维度留空或写“未提供”。\n'
      + '表后给一段权衡建议，只基于表内已有信息，不引入外部数字。\n'
      + '---\n{{input}}\n---',
  }),

  // 8) 咨询话术撰写（生成）
  base({
    id: 'analysis.sa-consult-script',
    label: '咨询话术撰写',
    shortLabel: '咨询话术',
    icon: '💬',
    tags: ['咨询', '话术', '沟通'],
    allowedActions: ['insert', 'replace', 'comment'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '为留学/移民顾问生成接待与答疑话术，真诚、不夸大承诺。',
    systemPrompt:
      '你是一位带过新人顾问的留学/移民咨询主管。'
      + '你写的话术要真诚、专业、口语化，像真人在对话，不像广告文案。'
      + '严禁出现“包过”“保录取”“100% 下签”这类违规承诺，也不编造成功率、案例数字或机构资质。'
      + '对政策与结果一律给保守、诚实的表述，并提示“具体以官方政策为准”。'
      + '不堆排比、不滥用感叹号和加粗。',
    userPromptTemplate:
      '请根据以下咨询场景与客户疑虑，写一段可直接使用的咨询话术，包含：\n'
      + '1) 开场与共情\n2) 针对疑虑的诚实回应\n3) 下一步建议\n'
      + '不使用任何包过/保录取类承诺，不编造数字。\n'
      + '---\n{{input}}\n---',
  }),

  // 9) 服务合同审查（核查 / check）
  base({
    id: 'analysis.sa-contract-review',
    label: '服务合同审查',
    shortLabel: '合同审查',
    icon: '📑',
    tags: ['合同', '审查', '风险'],
    allowedActions: ['comment', 'link-comment', 'insert'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '审查留学/移民服务合同，定位退费、责任、承诺等风险条款并批注。',
    systemPrompt:
      '你是一位关注消费者权益的合同审查顾问，熟悉留学/移民服务合同常见纠纷点。'
      + '你只依据合同原文判断，不臆测双方口头约定。'
      + '重点排查：退费条件与比例、服务范围与免责、违规承诺（如包过/保录取）、'
      + '时间与里程碑、争议解决与管辖、霸王条款与责任失衡。'
      + '每条发现必须引用合同原文逐字片段作为锚点。'
      + '务必声明“本审查仅辅助识别风险，不替代执业律师的法律意见，重大决策请咨询律师”。',
    userPromptTemplate:
      '请逐条审查下面这份服务合同，每条按以下格式输出：\n'
      + '- 命中片段：\\`合同原文逐字片段\\`\n'
      + '- 风险类型：（退费/免责/违规承诺/责任失衡/管辖/其他）\n'
      + '- 风险说明与修改/谈判建议：……\n'
      + '只标注确有问题或值得关注的条款，引用片段须与原文逐字一致。\n'
      + '---\n{{input}}\n---',
  }),

  // 10) 行前指南（生成）
  base({
    id: 'analysis.sa-pre-departure',
    label: '行前指南生成',
    shortLabel: '行前指南',
    icon: '🧳',
    tags: ['行前', '指南', '出行'],
    allowedActions: ['insert', 'replace', 'comment'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '为即将出国的学生生成行前准备指南，覆盖证件、行李、落地与生活。',
    systemPrompt:
      '你是一位帮学生做行前准备的资深顾问，了解常见落地流程与生活适应问题。'
      + '你只根据用户提供的目的地、季节、住宿、预算等信息给建议，'
      + '不编造具体航班、汇率、入境物品限额或当地法规细节，'
      + '涉及海关、保险、防疫等规定时提示“以目的地当年官方规定为准”。'
      + '内容务实、按场景分组，不写空话。',
    userPromptTemplate:
      '请根据以下出行背景，生成行前准备指南，分为：证件与文件、行李与物品、'
      + '机场与落地、住宿与生活、安全与应急、联系方式与资金。\n'
      + '不补充原文没有的航班/汇率/限额数字，不确定的规定标注“以官方为准”。\n'
      + '---\n{{input}}\n---',
  }),

  // 11) 家长沟通信改写（改写）
  base({
    id: 'analysis.sa-parent-letter',
    label: '家长沟通信改写',
    shortLabel: '家长沟通',
    icon: '👪',
    tags: ['家长', '沟通', '改写'],
    allowedActions: ['replace', 'insert', 'comment'],
    defaultAction: 'replace',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '把给家长的进度沟通或答疑内容改写得清楚、稳妥、易懂。',
    systemPrompt:
      '你是一位擅长与家长沟通的留学顾问。'
      + '你的任务是改写选中的内容，让它对非专业家长更清楚、更安心，'
      + '保留全部事实与进度信息，不夸大进展也不隐瞒风险。'
      + '把专业术语翻译成家常话，语气稳重、真诚，'
      + '不做包过/保录取类承诺，不编造时间或结果。'
      + '不堆套话、不滥用加粗与排比。',
    userPromptTemplate:
      '请改写下面给家长的沟通内容：用家长能听懂的话表达，保留全部进度与事实，'
      + '对不确定的结果如实说明，不夸大也不承诺。直接给出改写后的正文。\n'
      + '---\n{{input}}\n---',
  }),

  // 12) 关键信息抽取（抽取 / JSON）
  base({
    id: 'analysis.sa-profile-extract',
    label: '学生信息抽取',
    shortLabel: '信息抽取',
    icon: '🧩',
    tags: ['抽取', '档案', '结构化'],
    allowedActions: ['none', 'insert', 'comment'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从学生材料或咨询记录中抽取关键背景字段，输出严格 JSON。',
    systemPrompt:
      '你是一位负责录入申请人档案的留学/移民数据专员。'
      + '你的任务是从文本中抽取结构化字段，只输出严格 JSON，不要任何解释或 markdown 代码块标记。'
      + '找不到的字段留空字符串或空数组，绝不编造或猜测；数字按原文照抄，不换算。'
      + '不输出 JSON 以外的任何内容。',
    userPromptTemplate:
      '从以下材料中抽取关键信息，严格按此 JSON 结构输出（找不到留空，不编造）：\n'
      + '{\n'
      + '  "name": "",\n'
      + '  "target_country": "",\n'
      + '  "target_degree": "",\n'
      + '  "intended_major": "",\n'
      + '  "current_education": "",\n'
      + '  "gpa": "",\n'
      + '  "language_scores": [],\n'
      + '  "standardized_tests": [],\n'
      + '  "work_or_internship": [],\n'
      + '  "budget": "",\n'
      + '  "target_intake": "",\n'
      + '  "notes": ""\n'
      + '}\n'
      + '只输出 JSON。\n'
      + '---\n{{input}}\n---',
  }),
])

export function mergeStudyAbroadIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...STUDYABROAD_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { STUDYABROAD_BUILTIN_ASSISTANTS }
