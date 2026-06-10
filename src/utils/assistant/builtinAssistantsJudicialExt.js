/**
 * builtinAssistantsJudicialExt — 「法律/司法/律所」领域扩展包
 * 在现有包基础上补充新的高频文书/核查/抽取助手,语义与现有包不重复。
 * 现有已覆盖:起诉状要素提取、证据清单、法律意见书框架、案情摘要、答辩状、判例要旨、
 * 法律文书校核、庭审提纲、合规整改、法律检索要点、代理词框架、风险告知书。
 * 本扩展补充:合同条款审查、合同要素抽取、法律函起草、时效核查、当事人信息脱敏抽取、
 * 文书送达回执、律师函起草、争议焦点归纳、上诉状框架、卷宗目录、文书事实/证据矛盾核查。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'judicial'
const DIS = `重要:本助手仅辅助整理/起草,不替代法定程序与办案人员,也不替代执业律师的正式法律意见;只用给定信息,不臆断、不杜撰条文原文与案例,需确证处标【待核实】;不处理涉密案情、侦查信息与个人敏感隐私。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const JUDICIAL_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.jud-contract-review', label: '合同条款审查', shortLabel: '合同审查', icon: '📑',
    tags: ['法律', '核查', '合同'], allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'comment', defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '审查合同里对己方不利或缺失的条款:权利义务失衡、违约责任空缺、付款与交付、争议解决等。',
    systemPrompt: `你是一位资深合同律师。审查合同条款的潜在风险与缺漏。命中片段须用原文逐字、反引号包裹;只看给定文本,不替合同补造未写明的内容,不杜撰条文。${DIS}`,
    userPromptTemplate: `请审查下面合同,逐项列出风险条款与缺失条款,关注:权利义务是否对等、违约责任与赔偿、付款与交付节点、质量与验收、保密与知识产权、解除与终止、争议解决与管辖、不明确或一边倒的措辞。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 风险:\n- 修改建议:\n合同:\n---\n{{input}}\n---` }),
  base({
    id: 'analysis.jud-contract-extract', label: '合同关键信息抽取', shortLabel: '合同抽取', icon: '🗃️',
    tags: ['法律', '抽取', '合同'], allowedActions: ['none'],
    defaultAction: 'none', defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从合同文本抽取关键要素:双方主体、标的、金额、期限、付款方式、违约责任、管辖等,输出 JSON。',
    systemPrompt: `你是一位合同管理律师助理。从合同抽取关键要素,输出严格 JSON,只摘原文,找不到留空字符串或空数组,绝不编造。${DIS}`,
    userPromptTemplate: `请从下面合同抽取关键信息,只输出严格 JSON,不要额外文字。找不到的字段留空:\n{"party_a":"","party_b":"","subject":"","amount":"","currency":"","sign_date":"","effective_period":"","payment_terms":"","delivery_terms":"","liability":"","dispute_resolution":"","jurisdiction":"","notes":[]}\n合同:\n---\n{{input}}\n---` }),
  base({
    id: 'analysis.jud-lawyer-letter', label: '律师函起草', shortLabel: '律师函起草', icon: '✉️',
    tags: ['法律', '生成', '函件'], allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert', defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '根据委托事由起草律师函框架:致函对象、事实陈述、法律依据(原则性)、明确诉求与期限。',
    systemPrompt: `你是一位执业律师。起草措辞专业、克制有力的律师函框架。基于给定事实陈述,法律依据作原则性表述,不杜撰条文,不夸大也不威胁,诉求与期限明确。${DIS}`,
    userPromptTemplate: `请根据下面事由起草律师函:抬头与致函对象、受托说明、事实陈述、法律分析(原则性,不杜撰条号)、明确要求与履行期限、不履行的后果提示、落款。事实缺口标【待补充】。\n事由:\n---\n{{input}}\n---` }),
  base({
    id: 'analysis.jud-limitation-check', label: '诉讼时效核查', shortLabel: '时效核查', icon: '⏳',
    tags: ['法律', '核查', '时效'], allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'comment', defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '梳理案件时间线,核查诉讼时效起算、可能中止/中断节点与超期风险,提示需确证之处。',
    systemPrompt: `你是一位诉讼律师。核查诉讼时效相关时间节点。命中片段须用原文逐字、反引号包裹;时间先列原文日期再推算,推算过程写清楚;具体时效期间不杜撰,需以法律规定确证处标【待核实】。${DIS}`,
    userPromptTemplate: `请核查下面材料的诉讼时效问题:先按原文列出关键日期(权利受损、知道或应当知道、最后一次主张/还款等),再分析时效起算点、可能的中止或中断事由、是否存在超期风险。所有推算先引原文日期再算。\n## 时效核查\n- 命中片段:\`原文逐字片段\`\n- 节点说明:\n- 风险/结论(确证处标【待核实】):\n材料:\n---\n{{input}}\n---` }),
  base({
    id: 'analysis.jud-party-extract', label: '当事人信息抽取', shortLabel: '当事人抽取', icon: '👤',
    tags: ['法律', '抽取', '当事人'], allowedActions: ['none'],
    defaultAction: 'none', defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从案件材料抽取各方当事人及其诉讼地位、联系与代理信息,输出 JSON,便于立案登记。',
    systemPrompt: `你是一位立案律师助理。从材料抽取当事人信息,输出严格 JSON,只摘原文,找不到留空,绝不编造;涉及身份证号等敏感信息只原样摘录、不推断不补全。${DIS}`,
    userPromptTemplate: `请从下面材料抽取当事人信息,只输出严格 JSON,不要额外文字。找不到的字段留空:\n{"parties":[{"name":"","role":"","entity_type":"","contact":"","address":"","agent":""}],"case_no":"","court":"","cause_of_action":""}\nrole 取值如:原告/被告/第三人/申请人/被申请人/上诉人/被上诉人。\n材料:\n---\n{{input}}\n---` }),
  base({
    id: 'analysis.jud-dispute-focus', label: '争议焦点归纳', shortLabel: '争议焦点', icon: '🎯',
    tags: ['法律', '分析', '争议焦点'], allowedActions: ['comment', 'append', 'insert', 'none'],
    defaultAction: 'comment', defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '对照双方主张归纳争议焦点:无争议事实、有争议事实与法律适用分歧,供归纳整理参考。',
    systemPrompt: `你是一位审判辅助/诉讼律师。从双方主张中归纳争议焦点。命中片段须用原文逐字、反引号包裹;只依据给定主张,不预设裁判结论,不替任一方补造立场。${DIS}`,
    userPromptTemplate: `请对照下面材料中双方的主张,归纳争议焦点:先列双方无争议的事实,再列有争议的事实焦点,最后列法律适用上的分歧点。每个焦点尽量标明双方各自主张的出处。\n## 争议焦点\n- 命中片段:\`原文逐字片段\`\n- 焦点归纳:\n材料:\n---\n{{input}}\n---` }),
  base({
    id: 'analysis.jud-appeal-draft', label: '上诉状框架', shortLabel: '上诉状框架', icon: '🧷',
    tags: ['法律', '生成', '上诉'], allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert', defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.35,
    description: '依据一审判决与不服理由,搭上诉状框架:上诉请求、一审认定问题、上诉理由、依据。',
    systemPrompt: `你是一位二审代理律师。依据给定一审判决与不服理由搭上诉状框架。基于给定事实组织,法律依据作原则性表述,不杜撰条文,不编造一审未涉及的事实。${DIS}`,
    userPromptTemplate: `请根据下面一审判决要点与不服理由搭上诉状框架:上诉人与被上诉人信息、原审案号与判决、上诉请求、上诉理由(逐项指出一审认定事实/适用法律/程序的问题)、原则性法律依据、结尾。事实缺口标【待补充】。\n一审情况与不服理由:\n---\n{{input}}\n---` }),
  base({
    id: 'analysis.jud-case-index', label: '卷宗目录整理', shortLabel: '卷宗目录', icon: '📂',
    tags: ['法律', '整理', '卷宗'], allowedActions: ['comment', 'append', 'insert', 'none'],
    defaultAction: 'comment', defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '把零散卷宗材料整理成规范卷宗目录:序号、材料名称、形成时间、份数、页码,便于归档。',
    systemPrompt: `你是一位律所档案/法务人员。把材料整理成规范卷宗目录。只依据给定材料,不补造不存在的材料,时间与名称忠于原文。${DIS}`,
    userPromptTemplate: `请把下面卷宗材料整理成规范目录,用表格:序号 | 材料名称 | 形成/落款时间 | 份数 | 起止页码 | 备注。按诉讼阶段或时间顺序排列,缺失信息留空不编造。\n表格下方对名称或时间存疑的材料补一条说明,形如:\n- 命中片段:\`原文逐字片段\`\n- 说明:\n卷宗材料:\n---\n{{input}}\n---` }),
  base({
    id: 'analysis.jud-fact-consistency', label: '事实与证据矛盾核查', shortLabel: '矛盾核查', icon: '🧩',
    tags: ['法律', '核查', '矛盾'], allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'comment', defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.15,
    description: '核查材料内部事实陈述与证据之间的矛盾:时间冲突、金额不符、前后表述不一致等。',
    systemPrompt: `你是一位诉讼律师。核查材料内部的事实与证据矛盾。命中片段须用原文逐字、反引号包裹;涉及金额或日期的矛盾先并列原文两处再说明差异;只依据给定文本,不外部推断。${DIS}`,
    userPromptTemplate: `请核查下面材料内部的矛盾之处,关注:同一事实在不同处表述不一致、时间/金额/数量前后冲突、证据所证内容与事实陈述不符、当事人称谓或身份前后不一。\n## 矛盾项 (若无写"未发现明显矛盾")\n- 命中片段:\`原文逐字片段\`\n- 与之冲突:\`另一处原文逐字片段\`\n- 矛盾说明:\n材料:\n---\n{{input}}\n---` }),
  base({
    id: 'analysis.jud-service-receipt', label: '送达回证起草', shortLabel: '送达回证', icon: '🧾',
    tags: ['法律', '生成', '送达'], allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert', defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '根据送达情况起草送达回证/送达说明框架:受送达人、文书名称、送达方式、时间地点、签收。',
    systemPrompt: `你是一位诉讼事务人员。起草规范的送达回证框架。只依据给定送达情况填写,信息缺口留空标【待填写】,不编造签收事实。${DIS}`,
    userPromptTemplate: `请根据下面送达情况起草送达回证框架,用表格列项:案号、文书名称、受送达人、送达方式(直接/邮寄/留置/电子/公告)、送达时间、送达地点、送达人、签收人/见证人、备注。缺失信息标【待填写】,不虚构签收。\n送达情况:\n---\n{{input}}\n---` }),
  base({
    id: 'analysis.jud-clause-rewrite', label: '合同条款改写', shortLabel: '条款改写', icon: '✏️',
    tags: ['法律', '改写', '合同'], allowedActions: ['replace', 'insert', 'none'],
    defaultAction: 'replace', defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.35,
    description: '把选中的合同条款改写得更严谨、表意更清晰、双方权利义务更明确,不改变原本意图。',
    systemPrompt: `你是一位合同律师。把选中条款改写得更严谨清晰,消除歧义、补齐权利义务表述,但不改变当事人原本的交易意图,不擅自加入未约定的实质内容;若原意不明,在末尾用【待确认】列出需当事人确认的点。${DIS}`,
    userPromptTemplate: `请改写下面合同条款,使表述更严谨、无歧义、权利义务更明确,保持原意不变,不新增实质性约定。直接给出改写后的条款文本;若有需当事人确认之处,在条款后另起一行以【待确认】列出。\n原条款:\n---\n{{input}}\n---` })
])

export function mergeJudicialExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...JUDICIAL_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}
export default { JUDICIAL_EXT_BUILTIN_ASSISTANTS, mergeJudicialExtIntoBuiltins }
