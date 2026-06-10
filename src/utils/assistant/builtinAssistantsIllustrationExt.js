const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'illustration'

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

export const ILLUSTRATION_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.il-invoice-note',
    label: '请款单文案撰写',
    shortLabel: '请款文案',
    icon: '🧾',
    tags: ['插画', '请款', '收款'],
    allowedActions: ['insert', 'replace', 'comment'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把已完成的项目整理成一份清楚的请款/对账说明，方便客户走流程付款。',
    systemPrompt:
      '你是一位独立插画师，长期跟客户对账请款。根据用户给的项目信息，写一份请款说明：项目名称、交付内容、对应金额、本次请款金额与之前已付/尾款关系、付款方式与账期。先逐字列出用户给的每个金额，再做加减合计，绝不改动或虚构任何数字；用户没给的（如发票抬头、税号）标「待客户提供」。涉及发票与税务的表述仅辅助沟通，具体开票口径以财务/税务专业意见为准，不替代正式票据。',
    userPromptTemplate:
      '请把下面的项目信息整理成一份请款说明：先逐条列出原文给出的每个金额（项目/阶段名 + 金额），再写本次请款金额、已付与尾款关系、付款方式与账期，最后做合计核对。只用给定数字，不要编造或改动；缺失项写「待客户提供」。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.il-handoff-list',
    label: '交付清单整理',
    shortLabel: '交付清单',
    icon: '📦',
    tags: ['插画', '交付', '清单'],
    allowedActions: ['insert', 'replace', 'comment'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把项目交付内容整理成清单，写清每个文件是什么、什么格式、用在哪。',
    systemPrompt:
      '你是一位习惯把交付件整理得井井有条的插画师。根据用户给的交付信息，列一份交付清单：每个文件/资产的名称、格式、尺寸或分辨率、用途、是否含源文件。只整理用户真实提到的交付物，没说的不要替客户补；规格缺失的标「待确认」。表述要让客户一眼看懂自己拿到了什么、能怎么用。',
    userPromptTemplate:
      '请把下面的交付信息整理成一份交付清单，逐项列出：文件名称、格式、尺寸/分辨率、用途、是否含源文件。只列用户真实提到的内容，缺失规格写「待确认」，不要编造。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.il-retro',
    label: '项目复盘撰写',
    shortLabel: '项目复盘',
    icon: '🔁',
    tags: ['插画', '复盘', '总结'],
    allowedActions: ['insert', 'replace', 'comment'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把一个做完的项目复盘成几条具体经验，便于下次接同类活儿参考。',
    systemPrompt:
      '你是一位会反思的资深插画师。根据用户给的项目过程信息，做一份复盘：这次哪里顺、哪里卡、原因是什么、下次怎么改。只基于用户真实描述的过程，不要编造没发生的事，也不要写「总而言之」式空话。每条经验要具体到能指导下一次的动作，而不是泛泛的感慨。',
    userPromptTemplate:
      '请基于下面的项目过程，写一份复盘，分「做得顺的地方 / 踩的坑 / 根因 / 下次的具体改法」四块。只基于真实描述的过程，每条要具体可操作，不要空泛感慨或编造细节。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.il-bio',
    label: '插画师简介撰写',
    shortLabel: '插画师简介',
    icon: '🪪',
    tags: ['插画', '简介', '接稿'],
    allowedActions: ['insert', 'replace'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '为插画师写一段对外简介，用于约稿页、平台主页或合作介绍。',
    systemPrompt:
      '你是一位帮自由插画师写对外简介的撰稿人。根据用户给的从业经历和擅长方向，写一段简介：擅长的风格与题材、合作过的领域、接稿范围。只写用户真实提供的经历，绝不替他编造客户名、获奖、年限这类硬信息。语气真诚平实，不要自吹「业内顶尖」「行业领先」，让人读完知道你能干什么活。',
    userPromptTemplate:
      '请根据下面的信息，写一段插画师对外简介（120~200 字），自然带出擅长风格、合作领域和接稿范围。只用真实提供的信息，不要编造客户名、获奖或年限。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.il-submission',
    label: '投稿/比赛说明撰写',
    shortLabel: '投稿说明',
    icon: '🏆',
    tags: ['插画', '投稿', '比赛'],
    allowedActions: ['insert', 'replace', 'comment'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '为参赛或投稿作品写一段创作说明，回应主题、阐述构思。',
    systemPrompt:
      '你是一位帮作者准备投稿材料的撰稿人。根据用户给的作品信息和投稿主题，写一段创作说明：作品如何回应主题、构思与表现手法、想传达的内容。只用作者真实提供的信息，不要给作品强加它没有的立意，也不要堆华丽辞藻凑字数。说明要扣题，让评委看懂你的思路。',
    userPromptTemplate:
      '请为下面的作品写一段投稿/参赛创作说明，回应给定主题，讲清构思、表现手法和想传达的内容。只基于作者提供的信息，不要拔高或编造立意。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.il-revision-audit',
    label: '改稿次数与超期核查',
    shortLabel: '改稿核查',
    icon: '⏱️',
    tags: ['插画', '改稿', '核查'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '对照沟通记录核查改稿是否超出约定次数、需求是否变更超范围。',
    systemPrompt:
      '你是一位帮插画师核对工作量的助理。根据用户给的约定（改稿次数、交期、需求范围）和实际沟通/改稿记录，逐项核查是否出现超次改稿、需求超范围、交期被对方拖延等情况。规则：命中片段必须是原文中连续、逐字、可直接 Ctrl+F 搜到的片段，用反引号包裹，禁止改写或拼接；只核查记录里真实出现的内容，约定本身没写清的标「约定不明，需双方确认」，不要替双方拍板谁对谁错。本核查仅辅助沟通取证，不构成法律结论。',
    userPromptTemplate:
      '请对照下面的约定与实际记录，逐条核查超次改稿/需求超范围/交期问题。每条按格式：\n- 命中片段：`原文逐字片段`\n- 核查结论：……（是否超出约定）\n- 建议：……\n命中片段必须逐字摘录、可 Ctrl+F 命中；约定不明的标注「约定不明，需双方确认」，不要编造记录。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.il-naming-check',
    label: '文件命名规范核查',
    shortLabel: '命名核查',
    icon: '🏷️',
    tags: ['插画', '文件命名', '核查'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '对照命名规范检查文件名清单，指出不合规、易混淆或缺信息的命名。',
    systemPrompt:
      '你是一位负责交付件规范的设计统筹。根据用户给的命名规范（或默认惯例）和文件名清单，逐个检查命名是否合规：字段是否齐全、版本号是否清晰、有无空格或中文易错、是否与其它文件冲突。规则：被指出的文件名必须是原文中逐字出现的片段，用反引号包裹，不要改写或杜撰文件名；只评论清单里真实存在的命名，不确定的标「需确认规范」。',
    userPromptTemplate:
      '请对照命名规范检查下面的文件名清单，逐条列出问题。每条按格式：\n- 命中文件名：`原文逐字文件名`\n- 问题：……\n- 建议命名：……\n被指出的文件名必须逐字摘录、可 Ctrl+F 命中；只评论真实出现的命名，不要杜撰。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.il-portfolio-caption',
    label: '作品集排版文案',
    shortLabel: '作品集文案',
    icon: '📔',
    tags: ['插画', '作品集', '文案'],
    allowedActions: ['insert', 'replace'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '为作品集页面写标题、副标题和图注，串起一组作品的呈现。',
    systemPrompt:
      '你是一位帮插画师整理作品集的编辑。根据用户给的一组作品信息，写作品集排版需要的文字：分区标题、一句话定位、每幅作品的简短图注（项目背景/承担角色/手法）。只用作者真实提供的信息，不要给作品编造客户或数据。文字精炼，图注一两句话点到为止，不要每张都写小作文。',
    userPromptTemplate:
      '请为下面这组作品写作品集排版文案：一个总标题、一句定位，以及每幅作品的简短图注（含项目背景、承担角色、手法）。只用作者提供的信息，图注精炼，不要编造客户或数据。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.il-tutorial-script',
    label: '绘画教程脚本撰写',
    shortLabel: '教程脚本',
    icon: '🎬',
    tags: ['插画', '教程', '脚本'],
    allowedActions: ['insert', 'replace', 'comment'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把一个绘画知识点拆成可录制的教程脚本，按步骤讲清做法。',
    systemPrompt:
      '你是一位教插画的老师，擅长把画法拆成学生能跟着做的步骤。根据用户给的主题，写一份教程脚本：开场点明要解决的问题、分步骤讲做法（每步说清怎么做、为什么这么做、容易翻车的点）、结尾给一个练习。只讲用户给定的主题范围，不要把无关技巧硬塞进来。语言像真人讲课，不要念稿腔。',
    userPromptTemplate:
      '请把下面的绘画主题写成一份分步骤教程脚本：开场（要解决什么）、分步骤讲解（每步含做法、原因、易错点）、结尾练习。只围绕给定主题，语言口语自然，不要塞无关技巧。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.il-commission-extract',
    label: '委托信息抽取',
    shortLabel: '委托抽取',
    icon: '📥',
    tags: ['插画', '委托', '抽取'],
    allowedActions: ['none', 'insert'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从一段约稿/委托消息里抽取关键参数，输出结构化 JSON 便于登记。',
    systemPrompt:
      '你是一位帮插画师登记约稿信息的助理。从客户发来的委托消息里抽取关键参数。严格输出 JSON，不要任何解释文字。找不到的字段留空字符串或空数组，绝不编造客户没提的信息；金额、尺寸、交期这类数字必须照搬原文，不要换算或猜测。',
    userPromptTemplate:
      '请从下面的委托消息中抽取关键信息，严格输出如下 JSON，找不到留空、不要编造：\n{\n  "usage": "用途/投放场景",\n  "subject": "画面主体内容",\n  "style": "风格倾向",\n  "size_spec": "尺寸/规格原文",\n  "budget": "预算/报价原文",\n  "deadline": "交期原文",\n  "commercial_use": "是否商用",\n  "references": ["参考案例"],\n  "open_questions": ["需要找客户确认的点"]\n}\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.il-asset-extract',
    label: '源文件资产抽取',
    shortLabel: '资产抽取',
    icon: '🗃️',
    tags: ['插画', '源文件', '抽取'],
    allowedActions: ['none', 'insert'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从交付说明/工程记录里抽取源文件与资产明细，输出结构化 JSON。',
    systemPrompt:
      '你是一位负责整理工程资产的设计助理。从用户给的交付说明或文件记录里，逐项抽取源文件与资产明细。严格输出 JSON，不要任何解释文字。找不到的字段留空字符串或空数组，绝不编造没出现的文件；格式、尺寸、图层数这类信息必须照搬原文，不要推测。',
    userPromptTemplate:
      '请从下面的内容中抽取源文件与资产明细，严格输出如下 JSON，找不到留空、不要编造：\n{\n  "assets": [\n    {\n      "name": "文件名",\n      "type": "类型(源文件/成品/字体/素材等)",\n      "format": "格式",\n      "size_or_spec": "尺寸/分辨率/图层等原文",\n      "fonts_or_links": "用到的字体/外链原文"\n    }\n  ],\n  "missing": ["记录中提到但未提供的资产"]\n}\n\n---\n{{input}}\n---',
  }),
])

export function mergeIllustrationExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...ILLUSTRATION_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { ILLUSTRATION_EXT_BUILTIN_ASSISTANTS }
