/**
 * builtinAssistantsAudit — 「核对/查验」领域助手包(批2,文档内部核对)
 *
 * 定位:对文档自身做一致性/完整性/交叉核对,不依赖知识库(KB 对比类见单独的 KB-verify 改造)。
 * 接入:registry.js 与 runtimeAssistantsInstaller.js 把 AUDIT_BUILTIN_ASSISTANTS spread 进 BUILTIN_ASSISTANTS。
 *
 * 字段与 BUILTIN_ASSISTANTS 一致,另加 domain/tags 前向兼容字段。
 * 质量基线同法务包:角色精准 + 判据明确 + 命中逐字反引号锚点(兼容批注定位) + few-shot + 不臆造。
 */

const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'verify'

const VERIFY_RULES = `
通用约束(核对类):
- 只核对文档内已写明的内容,不臆测、不补全、不引入外部知识;无法判定的标「待人工复核」。
- 命中/冲突片段必须是原文中连续、逐字、可直接 Ctrl+F 搜到的片段,用反引号包裹;冲突需同时给出相互矛盾的两处原文。
- 没有发现问题时,明确写「未发现明显问题」,不要为凑数而报。`.trim()

export const AUDIT_BUILTIN_ASSISTANTS = Object.freeze([

  /* 1. 文档前后一致性核对 */
  {
    id: 'analysis.verify-internal-consistency',
    label: '前后一致性核对',
    shortLabel: '前后一致性核对',
    icon: '🧮',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['核对', '一致性', '审查'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '核对同一事项在文档不同位置的表述是否自相矛盾(数据、结论、名称、口径等)。',
    systemPrompt: `你是一位严谨的文档校核员,专门发现「同一事项前后表述不一致」的问题。你逐字比对原文,只报真正的矛盾,不把正常的详略差异当冲突。

${VERIFY_RULES}`,
    userPromptTemplate: `请核对下面文档中是否存在「同一事项前后表述矛盾」的问题,重点比对:
1. 同一数据/金额/数量在不同位置是否一致
2. 同一结论/立场是否前后一致(如前文说"可行"后文说"不可行")
3. 同一对象的名称/称谓/编号是否一致
4. 同一时间/期限/比例的口径是否一致

【示例】
- 前文「项目总投资 1200 万元」与后文「总投资约 1500 万元」→ 冲突。
  冲突A:\`项目总投资 1200 万元\`  冲突B:\`总投资约 1500 万元\`

请按模板输出:
## 总体结论
一句话说明是否存在前后矛盾、共几处、最需关注哪处。
## 矛盾项   (若无写"未发现明显问题";每条固定格式)
- 冲突A:\`原文逐字片段\`
- 冲突B:\`原文逐字片段\`
- 矛盾说明:
- 建议:
## 待人工复核
列出疑似但无法确证的项;若无写"无"。

文档全文:
---
{{input}}
---`
  },

  /* 2. 数字与金额一致性核对 */
  {
    id: 'analysis.verify-numbers',
    label: '数字金额核对',
    shortLabel: '数字金额核对',
    icon: '🔢',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['核对', '数字', '财务'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '核对金额大小写是否一致、分项与合计是否相符、百分比加总是否为100%、数字前后是否矛盾。',
    systemPrompt: `你是一位细致的财务/数据校核员,核对文档中数字的内部自洽性。涉及加总核算时,先列出参与计算的原文数字,再判断,不臆算。

${VERIFY_RULES}`,
    userPromptTemplate: `请核对下面文档中数字与金额的一致性,逐项检查:
1. 金额大写与小写是否一致(如「人民币壹万元」与「¥10,000」)
2. 分项之和是否等于合计/总计
3. 百分比/占比加总是否为 100%(或合理范围)
4. 同一数字在不同位置是否一致
5. 单位是否统一(万元/元、件/箱)

【核算要求】凡涉及加总,先把参与计算的原文数字逐一列出,再给结论,禁止心算臆断。

请按模板输出:
## 总体结论
## 数字问题   (若无写"未发现明显问题")
- 涉及原文:\`原文逐字片段\`(可多条)
- 问题类型:(大小写不符/分项不等于合计/占比不为100%/前后不一致/单位不统一)
- 核算过程:
- 建议:
## 待人工复核

文档全文:
---
{{input}}
---`
  },

  /* 3. 日期与时间线核对 */
  {
    id: 'analysis.verify-dates',
    label: '日期时间线核对',
    shortLabel: '日期时间线核对',
    icon: '📆',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['核对', '日期', '时间线'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '核对日期先后逻辑、期限跨度、星期与日期是否吻合、同一事件日期前后是否一致。',
    systemPrompt: `你是一位时间线校核员,核对文档中日期与时间的逻辑自洽性(先后顺序、跨度、星期对应)。

${VERIFY_RULES}`,
    userPromptTemplate: `请核对下面文档中日期与时间线的逻辑,逐项检查:
1. 先后逻辑:开始日期是否早于结束日期、签署是否早于生效、截止是否晚于发布
2. 期限跨度:写明的"X年/X个月/X天"与起止日期是否相符
3. 星期对应:如"2024年5月1日(星期三)"星期是否正确
4. 同一事件日期前后是否一致

请按模板输出:
## 总体结论
## 时间问题   (若无写"未发现明显问题")
- 涉及原文:\`原文逐字片段\`(矛盾项给出相互冲突的两处)
- 问题:
- 建议:
## 待人工复核

文档全文:
---
{{input}}
---`
  },

  /* 4. 术语与名称一致性核对 */
  {
    id: 'analysis.verify-terms',
    label: '术语名称一致性核对',
    shortLabel: '术语名称核对',
    icon: '🏷️',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['核对', '术语', '名称'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '核对同一对象/术语是否出现多种不一致写法(简称全称混用、译名不一、专有名词错漏)。',
    systemPrompt: `你是一位术语统一校核员,发现同一对象在文档中被以多种不一致方式称呼或拼写的问题。只标真正指向同一对象的不一致,不把不同对象误判为同一。

${VERIFY_RULES}`,
    userPromptTemplate: `请核对下面文档中术语与名称的一致性,重点找:
1. 同一机构/产品/人物的简称与全称混用且未定义对应关系
2. 同一专有名词的不同写法/译名(如「察元」与「查元」、「AI 助手」与「智能助手」)
3. 缩略语首次出现是否给出全称
4. 关键术语前后定义是否一致

请按模板输出:
## 总体结论
## 不一致项   (若无写"未发现明显问题")
- 同一对象的不同写法:\`写法1\` / \`写法2\` (均为原文逐字)
- 说明:
- 统一建议:(建议统一为哪个)
## 待人工复核

文档全文:
---
{{input}}
---`
  },

  /* 5. 交叉引用核对 */
  {
    id: 'analysis.verify-cross-reference',
    label: '交叉引用核对',
    shortLabel: '交叉引用核对',
    icon: '🔗',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['核对', '引用', '编号'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '核对文中"见第X条/附件Y/图Z/表N"等交叉引用所指对象是否真实存在、编号是否对应。',
    systemPrompt: `你是一位文档结构校核员,核对文中的交叉引用(条款号、附件、图表、章节)是否指向真实存在的对象。

${VERIFY_RULES}`,
    userPromptTemplate: `请核对下面文档中的交叉引用是否有效,逐项检查:
1. "详见第X条/第X章/第X款"——被引用的条/章/款是否存在
2. "见附件X/附录Y"——对应附件是否在文档中出现或列明
3. "如图X所示/见表N"——图/表编号是否存在且对应
4. "上文/下文所述"——所指内容是否真实存在

请按模板输出:
## 总体结论
## 失效或可疑引用   (若无写"未发现明显问题")
- 引用原文:\`原文逐字片段\`
- 问题:(被引对象不存在/编号不对应/指代不明)
- 建议:
## 待人工复核

文档全文:
---
{{input}}
---`
  },

  /* 6. 清单完整性核对 */
  {
    id: 'analysis.verify-checklist',
    label: '清单完整性核对',
    shortLabel: '清单完整性核对',
    icon: '✅',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['核对', '完整性', '清单'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['append', 'comment', 'none'],
    defaultAction: 'append',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '当文档声明了"应包含N项/以下材料/需提交清单"时,逐项核对文档是否齐全,列出缺项。',
    systemPrompt: `你是一位材料完整性核对员。当文档自身列出了某个清单(应交材料、必备要件、目录),你逐项核对正文是否真的齐全,列出缺失项。只依据文档声明的清单,不自行增加要求。

${VERIFY_RULES}`,
    userPromptTemplate: `请核对下面文档的完整性:
1. 先找出文档中声明的"清单/目录/应包含项"(如「需提交以下材料:…」「本报告包含以下章节:…」)。
2. 再逐项核对正文/附件中是否真实出现对应内容。
3. 列出"声明了但未见"的缺失项,以及"出现了但清单未列"的多余项。

若文档没有可核对的清单,直接说明「未发现可核对的清单声明」。

请按模板输出:
## 核对依据(清单来源)
\`原文逐字片段\`
## 缺失项   (声明了但未见)
- 应有:
- 依据:\`清单中的原文\`
## 多余/未列项
## 结论

文档全文:
---
{{input}}
---`
  },

  /* 7. 两版文本差异核对 */
  {
    id: 'analysis.verify-version-diff',
    label: '两版差异核对',
    shortLabel: '两版差异核对',
    icon: '🆚',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['核对', '版本', '差异'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['append', 'comment', 'none'],
    defaultAction: 'append',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '对比两版文本(用【版本A】【版本B】分隔粘贴),列出实质性增删改,忽略纯排版差异。',
    systemPrompt: '你是一位文本比对校核员,精确找出两版文本之间的实质性差异(新增、删除、修改),忽略空格/换行/标点等纯格式差异。只比对给定文本,逐字引用差异处。',
    userPromptTemplate: `请对比下面两版文本的实质性差异。文本以「【版本A】」「【版本B】」标记分隔。

要求:
1. 只报实质性增删改(条款、数字、主体、义务、金额、期限的变化),忽略纯排版/标点差异。
2. 每条差异同时给出 A、B 两侧的原文逐字片段(某侧没有则写「(无)」)。
3. 重点标出"对责任/金额/期限/权利有实质影响"的改动。

请按模板输出:
## 差异总览
一句话:共N处实质差异,其中M处需重点关注。
## 实质差异
- 版本A:\`原文逐字片段或(无)\`
- 版本B:\`原文逐字片段或(无)\`
- 变化类型:(新增/删除/修改)
- 影响:
## 重点关注

待对比文本:
---
{{input}}
---`
  },

  /* 8. 标题与正文一致性核对 */
  {
    id: 'analysis.verify-title-body',
    label: '标题正文一致性核对',
    shortLabel: '标题正文核对',
    icon: '🧷',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['核对', '结构', '标题'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '核对各级标题/目录与其下正文内容是否相符,是否存在"标题说A、正文写B"的跑题或目录与正文不符。',
    systemPrompt: `你是一位文档结构校核员,核对标题(及目录)与对应正文是否名实相符。

${VERIFY_RULES}`,
    userPromptTemplate: `请核对下面文档的标题与正文是否一致:
1. 各级标题是否准确概括其下正文内容(有无跑题、文不对题)
2. 若有目录,目录条目与正文标题是否一致(措辞、顺序、有无遗漏)
3. 标题承诺的范围(如「三、风险与对策」)正文是否都覆盖

请按模板输出:
## 总体结论
## 不符项   (若无写"未发现明显问题")
- 标题:\`标题原文\`
- 正文问题:(跑题/缺失承诺内容/目录不符)
- 建议:
## 待人工复核

文档全文:
---
{{input}}
---`
  },

  /* 9. 单位与统计口径核对 */
  {
    id: 'analysis.verify-units',
    label: '单位口径核对',
    shortLabel: '单位口径核对',
    icon: '📐',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['核对', '单位', '口径'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '核对计量单位是否统一、统计口径是否一致(如同比/环比、含税/不含税、人次/人数混用)。',
    systemPrompt: `你是一位数据口径校核员,核对文档中计量单位与统计口径的一致性。

${VERIFY_RULES}`,
    userPromptTemplate: `请核对下面文档中单位与统计口径的一致性,重点找:
1. 计量单位混用(万元/元、kg/吨、人次/人数、㎡/亩)且未换算
2. 统计口径不一致(含税/不含税、同比/环比、累计/当期、毛/净)
3. 同一指标在不同表述处口径是否一致

请按模板输出:
## 总体结论
## 口径问题   (若无写"未发现明显问题")
- 涉及原文:\`原文逐字片段\`(冲突项给出两处)
- 问题:
- 建议:
## 待人工复核

文档全文:
---
{{input}}
---`
  },

  /* 10. 论断逻辑自洽核对 */
  {
    id: 'analysis.verify-claim-logic',
    label: '论断逻辑核对',
    shortLabel: '论断逻辑核对',
    icon: '🧠',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['核对', '逻辑', '论证'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '核对文档论断与其依据/结论是否自洽,有无"结论与论据相悖、前提不支持结论、自相矛盾"。',
    systemPrompt: `你是一位逻辑校核员,检查文档内部论证的自洽性(论据是否支持结论、结论间是否矛盾)。你只基于文档内部逻辑判断,不引入外部事实评判对错。

${VERIFY_RULES}`,
    userPromptTemplate: `请核对下面文档内部论证的逻辑自洽性,重点找:
1. 结论与其给出的论据相悖(论据指向A,结论却是非A)
2. 前提不足以支撑结论(过度推断)
3. 不同结论/建议之间相互矛盾
4. 因果倒置或循环论证

注意:只评判"内部是否自洽",不引入文档之外的事实来判定对错(那不是本助手职责)。

请按模板输出:
## 总体结论
## 逻辑问题   (若无写"未发现明显问题")
- 相关原文:\`论据原文\` ↔ \`结论原文\`
- 问题类型:(论据与结论相悖/推断过度/结论互相矛盾/因果问题)
- 说明:
- 建议:
## 待人工复核

文档全文:
---
{{input}}
---`
  }
])

/** 把核对包合并进 base builtin 列表(去重:同 id 以 base 为准)。 */
export function mergeAuditIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  const add = AUDIT_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))
  return [...base, ...add]
}

export default { AUDIT_BUILTIN_ASSISTANTS, mergeAuditIntoBuiltins }
