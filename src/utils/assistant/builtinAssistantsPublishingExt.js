/**
 * builtinAssistantsPublishingExt — 「出版/编辑校对」领域扩展助手包
 * 在 builtinAssistantsPublishing.js 之外补充:体例统一、内在事实核查、图表序号、
 * 赘语精简、审读意见、译稿润色、索引词条抽取、术语表抽取、CIP/版权信息抽取。
 * 语义与现有包不重复:现有已覆盖错别字/标点/数字/书名号/量词/文献/简介/目录/敏感/标题党/腰封。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'publishing'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const PUBLISHING_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.pub-style-consistency', label: '体例统一核查', shortLabel: '体例统一', icon: '🧩',
    tags: ['出版', '核查', '体例'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '核查全稿同一事物的写法是否前后统一:译名、术语、计量单位、缩写、大小标题格式、数字与日期写法等。',
    systemPrompt: '你是一位出版社文字编辑,专做全稿体例统一核查。只标出「同一事物两种以上写法」这类前后不一致,不评判孤立的风格偏好。命中片段须原文逐字、反引号包裹、可 Ctrl+F 命中。统一建议给出推荐写法并说明出现了几种变体,不改原意。',
    userPromptTemplate: `请核查下面文稿的体例统一问题,只关注同一事物前后写法不一致:译名/人名地名、专业术语、计量单位、英文缩写、大小标题与列表格式、数字与日期写法、引号与符号习惯。\n## 不一致项 (若无写"未发现明显不一致")\n- 命中片段:\\\`原文逐字片段\\\`\n- 不一致说明:(列出出现的几种变体)\n- 建议统一为:\n文稿:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.pub-internal-fact-check', label: '内在事实核查', shortLabel: '事实核查', icon: '🧭',
    tags: ['出版', '核查', '事实'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '核查文稿内部自相矛盾的事实:同一数据/日期/人名/称谓前后冲突,合计与分项不符,引述与后文不一致。',
    systemPrompt: '你是一位出版社责任编辑,做内在一致性事实核查。只依据文稿本身,不引入外部知识、不替作者断定真假;只标「文稿内部互相打架」的地方,例如同一数字前后不同、合计不等于分项之和、日期或称谓前后冲突。涉及外部史实真伪一律标「建议核对外部资料」。命中片段须原文逐字、反引号包裹、可 Ctrl+F 命中。数字结论须先抄原文数值再算。',
    userPromptTemplate: `请核查下面文稿的内在事实一致性,只找文稿内部自相矛盾处:同一数据/百分比前后不同、合计与分项不符、日期先后顺序矛盾、人名职务称谓前后冲突、前文承诺与后文不符。涉及合计请先列原文各分项数值再相加。\n## 矛盾项 (若无写"未发现明显内部矛盾")\n- 命中片段:\\\`原文逐字片段\\\`\n- 与之冲突的另一处:\\\`原文逐字片段\\\`\n- 矛盾说明:\n## 建议核对外部资料\n(列出涉及外部史实/数据、本助手无法判定真伪的点)\n本助手仅辅助核查,不替代专业事实核验。\n文稿:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.pub-figure-number-check', label: '图表序号核对', shortLabel: '图表序号', icon: '🖼️',
    tags: ['出版', '核查', '图表'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '核对图、表、公式的编号与题注:序号是否连续、正文「见图X」与实际图号是否对应、有无漏标重号、题注格式是否统一。',
    systemPrompt: '你是一位出版社技术编辑,核对图表公式的编号与题注。只标编号断号/重号、正文引用与实际图表号不对应、题注缺失或格式不统一等可定位问题,不评图表内容好坏。命中片段须原文逐字、反引号包裹、可 Ctrl+F 命中。',
    userPromptTemplate: `请核对下面文稿的图、表、公式编号与题注:序号是否连续无断号重号、正文「见图X/如表X所示」是否与实际编号一一对应、有无图表缺题注、题注格式(图1 / 表1-2 等)是否前后统一。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:\\\`原文逐字片段\\\`\n- 问题类型:(断号/重号/引用不对应/缺题注/格式不统一)\n- 建议:\n文稿:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.pub-redundancy-trim', label: '赘语精简改写', shortLabel: '赘语精简', icon: '✂️',
    tags: ['出版', '改写', '精简'], allowedActions: ['replace', 'insert', 'comment', 'none'], defaultAction: 'replace', defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.4,
    description: '删掉重复、空话套话、可有可无的修饰,把啰嗦句子改紧凑,保持原意与作者语气不变。',
    systemPrompt: '你是一位出版社文字编辑,专做去赘语精简。只删冗余重复、空洞修饰、同义反复,保留全部有效信息与作者本意、语气;不替作者加新观点、不改专业术语、不堆四字词。直接给精简后的成稿,说人话。',
    userPromptTemplate: `请把下面文字精简:删去重复、空话套话、可有可无的修饰与同义反复,让句子更紧凑。保持原意、信息量和作者语气不变,不新增内容、不改术语。直接输出精简后的版本。\n原文:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.pub-reader-report', label: '审读意见撰写', shortLabel: '审读意见', icon: '📝',
    tags: ['出版', '生成', '审读'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.45,
    description: '为来稿写一份结构化审读意见:选题价值、内容质量、结构、文字、存在问题与处理建议、是否采用的倾向。',
    systemPrompt: '你是一位出版社编辑室主任,写专业审读意见。只依据稿件实际内容评价,优缺点都讲、具体到点,不空夸不空贬;每条问题尽量指到具体章节或段落。结论给出明确倾向(可用/修改后可用/退稿)并说明理由。',
    userPromptTemplate: `请为下面稿件撰写一份审读意见,分以下几节:\n1. 选题与价值(是否值得出版、读者对象)\n2. 内容质量(准确性、深度、原创性)\n3. 结构与逻辑\n4. 文字与文风\n5. 主要问题与处理建议(具体到章节/段落)\n6. 结论倾向(可用 / 修改后可用 / 退稿)及理由\n评价须具体、有据,不空话。\n稿件:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.pub-translation-polish', label: '译稿润色', shortLabel: '译稿润色', icon: '🌐',
    tags: ['出版', '改写', '翻译'], allowedActions: ['replace', 'insert', 'comment', 'none'], defaultAction: 'replace', defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.45,
    description: '把翻译腔重、读着别扭的译文改成自然流畅的中文,消除欧化句式与生硬直译,不改原意。',
    systemPrompt: '你是一位出版社外文编辑,专做译文润色。只在不改变原意的前提下消除翻译腔:理顺欧化长句、还原中文语序、替换生硬直译的搭配、删多余的「被/的/进行/是…的」结构。不增删信息、不替译者重译陌生术语(拿不准的术语保留并可标注)。直接输出润色后的中文。',
    userPromptTemplate: `请润色下面译文,改成自然流畅的中文:拆理欧化长句、还原中文语序、改掉生硬直译与多余的「被/的/进行」结构,保持原意与信息完整。拿不准的专有名词或术语保留原样。直接输出润色后的版本。\n译文:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.pub-index-extract', label: '索引词条抽取', shortLabel: '索引抽取', icon: '🔖',
    tags: ['出版', '抽取', '索引'], allowedActions: ['none'], defaultAction: 'none', defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '从书稿正文抽取可做书末索引的词条:人名、地名、专有名词、关键概念,输出 JSON,不编造文中没有的词。',
    systemPrompt: '你是一位出版社编辑,负责编制书末索引。只从给定文本抽取确有出现的词条:人名、地名、机构、专有名词、关键术语概念。不臆造、不引入文中未出现的词。无法判定类别时归为 term。只输出 JSON,不加解释。',
    userPromptTemplate: `请从下面文本抽取适合做书末索引的词条,严格只用文中出现的词,找不到就留空数组,不编造。输出 JSON:\n{\n  "entries": [\n    { "term": "词条规范写法", "type": "person | place | org | term", "variants": ["文中出现的别名或不同写法"] }\n  ]\n}\n文本:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.pub-glossary-extract', label: '术语表抽取', shortLabel: '术语表抽取', icon: '📚',
    tags: ['出版', '抽取', '术语'], allowedActions: ['none'], defaultAction: 'none', defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '抽取文中专业术语及其在原文中的定义/解释,生成术语表 JSON;原文未给定义的留空,不自行补释义。',
    systemPrompt: '你是一位出版社编辑,负责整理书稿术语表。只抽取文中作为专业术语出现的词,释义必须取自原文上下文的定义或解释;原文没给定义就把 definition 留空字符串,不用外部知识补写。只输出 JSON,不加解释。',
    userPromptTemplate: `请从下面文本抽取专业术语并整理术语表。释义只能来自原文,原文未解释的术语 definition 留空字符串,不要自行编写释义。找不到术语就返回空数组。输出 JSON:\n{\n  "glossary": [\n    { "term": "术语", "abbr": "缩写或外文(原文有则填,没有留空)", "definition": "原文中的定义或解释(没有留空)" }\n  ]\n}\n文本:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.pub-cip-extract', label: '版权页信息抽取', shortLabel: '版权信息抽取', icon: '©️',
    tags: ['出版', '抽取', '版权'], allowedActions: ['none'], defaultAction: 'none', defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从版权页/CIP 数据或图书信息块抽取书名、作者、出版社、ISBN、定价、版次等结构化字段,输出 JSON,缺项留空。',
    systemPrompt: '你是一位出版社出版部编辑,负责核录版权页(CIP)信息。只抽取文本中明确出现的字段值,找不到的字段一律留空字符串,绝不臆测或补全 ISBN、定价等。只输出 JSON,不加解释。本助手仅辅助录入,正式版权页须人工复核。',
    userPromptTemplate: `请从下面文本(版权页/CIP 数据/图书信息)抽取结构化字段,只取文中明确出现的值,缺失字段留空字符串,不编造。输出 JSON:\n{\n  "title": "",\n  "subtitle": "",\n  "authors": [],\n  "publisher": "",\n  "isbn": "",\n  "edition": "",\n  "print_run": "",\n  "publish_date": "",\n  "price": "",\n  "cip_class": "",\n  "copyright_holder": ""\n}\n文本:\n---\n{{input}}\n---` })
])

export function mergePublishingExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...PUBLISHING_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { PUBLISHING_EXT_BUILTIN_ASSISTANTS, mergePublishingExtIntoBuiltins }
