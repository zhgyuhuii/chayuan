/**
 * builtinAssistantsPublishing — 「出版/编辑校对」领域助手包(批8)
 * 校对/核查类批注、生成类插入。约束:按出版规范(标点/数字/量词用法),逐字定位,不改原意。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'publishing'
const CHK = `通用约束(校对):命中片段原文逐字、反引号包裹、可 Ctrl+F 命中;只标确有问题处,风格偏好不算错;改动不改原意。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.1, ...extra
})

export const PUBLISHING_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.pub-proofread', label: '深度校对', shortLabel: '深度校对', icon: '🔍',
    tags: ['出版', '校对', '三审三校'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    description: '出版级深度校对:错别字、语病、标点、数字、专名、前后不一致,逐条定位给修改。',
    systemPrompt: `你是一位资深出版校对,做出版级三审三校式校对。覆盖错别字、语病、标点、数字用法、专名、前后一致。${CHK}`,
    userPromptTemplate: `请对下面文稿做深度校对,逐条列出问题:\n- 命中片段:\`原文逐字片段\`\n- 问题类型:(错别字/语病/标点/数字/专名/前后不一致)\n- 改为:\n若无明显问题写"未发现明显问题"。\n文稿:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.pub-punctuation-check', label: '标点规范检查', shortLabel: '标点检查', icon: '❗',
    tags: ['出版', '核查', '标点'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    description: '按标点符号用法规范检查:中英标点混用、成对符号、省略号破折号、句末标点等。',
    systemPrompt: `你是一位校对,按《标点符号用法》(GB/T 15834)检查标点。${CHK}`,
    userPromptTemplate: `请检查下面文稿的标点,关注:中英文标点混用、成对符号是否配对、省略号(……)破折号(——)是否规范、句末标点、顿号与逗号、引号嵌套。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 改为:\n文稿:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.pub-number-usage-check', label: '数字用法规范', shortLabel: '数字用法检查', icon: '🔢',
    tags: ['出版', '核查', '数字'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    description: '按出版数字用法规范检查:何时用阿拉伯数字/汉字数字、是否一致、范围号、千分撇等。',
    systemPrompt: `你是一位校对,按《出版物上数字用法》(GB/T 15835)检查数字用法。${CHK}`,
    userPromptTemplate: `请检查下面文稿的数字用法,关注:阿拉伯数字与汉字数字的选用是否得当且一致、数值范围号(—)用法、概数与统计数、年月日与时间写法。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 改为:\n文稿:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.pub-typo-check', label: '错别字检查', shortLabel: '错别字检查', icon: '🔤',
    tags: ['出版', '核查', '错别字'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    description: '专项查错别字、形近字、音近字、易错词(的地得、做作、其它/其他等),逐字定位。',
    systemPrompt: `你是一位校对,专项查错别字与易错字词。${CHK}`,
    userPromptTemplate: `请专项检查下面文稿的错别字:形近字、音近字、易错词(的/地/得、做/作、账/帐、其它/其他、已/己)。\n## 错字项 (若无写"未发现明显错别字")\n- 命中片段:\`原文逐字片段\`\n- 错→对:\n文稿:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.pub-reference-check', label: '参考文献核对', shortLabel: '参考文献核对', icon: '📑',
    tags: ['出版', '核查', '文献'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    description: '核对参考文献格式是否统一、著录项是否齐全、正文引用与文末是否一一对应。',
    systemPrompt: `你是一位编辑,核对参考文献的格式统一与引文对应。${CHK}`,
    userPromptTemplate: `请核对下面参考文献:格式是否统一、著录项(作者/题名/来源/年/页)是否齐全、正文标注与文末列表是否一一对应、有无未引用或漏列。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n文稿:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.pub-synopsis', label: '内容简介撰写', shortLabel: '内容简介', icon: '📖',
    tags: ['出版', '生成', '简介'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '把书稿/文章要点写成吸引人的内容简介:核心看点、读者收益,简洁有吸引力不剧透。',
    systemPrompt: '你是一位图书编辑,写吸引人又不夸大的内容简介。基于书稿真实内容,不剧透关键、不编造卖点。',
    userPromptTemplate: `请把下面书稿/文章要点写成内容简介(200字内):点出主题与核心看点、读者能获得什么、风格特色。吸引人但不夸大不剧透。\n要点:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.pub-toc-generate', label: '章节目录生成', shortLabel: '目录生成', icon: '🗂️',
    tags: ['出版', '生成', '目录'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '根据内容梳理出层级清晰的章节目录,标题概括准确、层级合理、措辞统一。',
    systemPrompt: '你是一位编辑,梳理层级清晰的目录。标题忠实概括对应内容,层级合理,措辞风格统一,不增减内容。',
    userPromptTemplate: `请根据下面内容梳理章节目录:层级清晰(篇/章/节)、标题准确概括、措辞统一。只依据已有内容,不臆加章节。\n内容:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.pub-sensitive-review', label: '敏感内容审查', shortLabel: '敏感内容审查', icon: '🚧',
    tags: ['出版', '核查', '敏感'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查文稿中政治、宗教、民族、低俗、侵权等敏感或不当内容,逐字定位提示稳妥处理。',
    systemPrompt: '你是一位出版内容审核,识别敏感或不当内容。命中片段原文逐字、反引号包裹;不确定标「建议人工把关」,不武断。',
    userPromptTemplate: `请审查下面文稿的敏感/不当内容:政治性表述、宗教民族、低俗暴恐、可能侵权(肖像/版权/名誉)、广告法绝对化等。\n## 需关注 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 稳妥建议:\n## 建议人工把关\n文稿:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.pub-measure-word-check', label: '量词搭配检查', shortLabel: '量词检查', icon: '📏',
    tags: ['出版', '核查', '量词'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    description: '检查量词与名词搭配是否得当、是否规范(如"一只船"宜作"一艘船"),逐字定位。',
    systemPrompt: `你是一位校对,检查量词与名词搭配的规范性。${CHK}`,
    userPromptTemplate: `请检查下面文稿的量词搭配是否得当规范。\n## 不当搭配 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 建议改为:\n文稿:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.pub-quote-check', label: '书名号引号检查', shortLabel: '书名号检查', icon: '《',
    tags: ['出版', '核查', '标号'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    description: '检查书名号、引号使用是否规范:该用未用、误用、嵌套层级、配对等问题。',
    systemPrompt: `你是一位校对,检查书名号《》与引号""''的规范使用。${CHK}`,
    userPromptTemplate: `请检查下面文稿的书名号与引号:书名/篇名/报刊是否该用书名号、引号是否配对、嵌套层级(""里用'')、该用未用或误用。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 改为:\n文稿:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.pub-clickbait-check', label: '标题党检测', shortLabel: '标题党检测', icon: '🎣',
    tags: ['出版', '核查', '标题'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.3,
    description: '检测标题是否与正文不符、是否夸大耸动(标题党),给更贴切的替代标题建议。',
    systemPrompt: '你是一位编辑,检测标题党(标题与正文不符或夸大耸动)。基于正文判断,给贴切的替代标题,不矫枉过正。',
    userPromptTemplate: `请检测下面标题是否标题党(与正文不符/夸大耸动/制造焦虑),并给 3 个既准确又有吸引力的替代标题。\n标题与正文:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.pub-blurb', label: '腰封推荐语', shortLabel: '腰封推荐语', icon: '🎀',
    tags: ['出版', '生成', '文案'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.6,
    description: '为书籍生成腰封/推荐语:精炼、有冲击力、点出核心价值,真诚不浮夸。',
    systemPrompt: '你是一位图书营销编辑,写精炼有力的腰封推荐语。基于书稿真实内容,有冲击力但不夸大不虚假承诺。',
    userPromptTemplate: `请为下面书籍写腰封推荐语:3-5 条候选,每条精炼有冲击力、点出核心价值或读者收益。真诚不浮夸。\n书籍信息:\n---\n{{input}}\n---` })
])

export function mergePublishingIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...PUBLISHING_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { PUBLISHING_BUILTIN_ASSISTANTS, mergePublishingIntoBuiltins }
