/**
 * builtinAssistantsKbVerify — 「与知识库对比查验」助手包(批3)
 *
 * 这类助手执行时会先检索绑定的知识库,把命中片段注入 {{kbContext}},再让模型把
 * 【当前文档】与【知识库参考】逐条对比。靠 runtimeCapabilities.useKnowledgeBase=true
 * 触发(执行器 assistantTaskRunner 见该位即检索注入;未绑定/未命中时 {{kbContext}} 为提示文案)。
 *
 * 接入:registry.js 的 PACK_LOADERS 已登记本包(懒加载,独立 chunk)。
 *
 * 质量基线:
 *   - 只依据【知识库参考】判断,KB 未覆盖的标「KB未覆盖」,绝不臆造知识库内容;
 *   - 文档与 KB 冲突时,文档侧与 KB 侧都给逐字片段,便于复核;
 *   - {{kbContext}} 若为空/为"未绑定/未命中"提示,直接如实告知,不硬编结论;
 *   - 分析/核查类默认动作=加批注(comment/link-comment)。
 */

const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'kb-verify'
const KB_CAP = { useKnowledgeBase: true }

const KB_RULES = `
通用约束(知识库对比类):
- 判断只能基于下方【知识库参考】;参考里没有的,标「KB未覆盖」,不得用常识或臆测补足。
- 若【知识库参考】为空,或显示"未绑定知识库/未命中/检索失败"等提示,则不要编造结论,
  直接告知用户:需先在对话侧栏绑定知识库,或知识库中无相关内容。
- 文档与知识库冲突时,必须同时给出「文档原文逐字片段」与「知识库依据逐字片段」,均用反引号包裹、可定位。
- 本助手为辅助核查,知识库本身的权威性/时效性需人工确认。`.trim()

const base = (extra) => ({
  group: 'analysis',
  domain: DOMAIN,
  modelType: 'chat',
  defaultModelCategory: 'chat',
  supportsRibbon: false,
  defaultDisplayLocations: ['ribbon-more'],
  defaultOutputFormat: 'markdown',
  defaultInputSource: INPUT_SOURCE_DOCUMENT,
  runtimeCapabilities: KB_CAP,
  temperature: 0.15,
  ...extra
})

export const KB_VERIFY_BUILTIN_ASSISTANTS = Object.freeze([

  /* 1. 与知识库事实一致性核查 */
  base({
    id: 'analysis.kb-fact-consistency',
    label: '知识库事实核查',
    shortLabel: '知识库事实核查',
    icon: '📗',
    tags: ['知识库', '核查', '事实一致性'],
    allowedActions: ['link-comment', 'comment', 'append', 'none'],
    defaultAction: 'link-comment',
    description: '把文档中的事实性陈述与绑定知识库逐条比对,标出与知识库冲突或知识库未覆盖之处。',
    systemPrompt: `你是一位以知识库为准绳的事实核查员。你把文档中的事实性陈述与【知识库参考】逐条比对,判定「一致 / 冲突 / KB未覆盖」。

${KB_RULES}`,
    userPromptTemplate: `请把【当前文档】中的关键事实性陈述,与下方【知识库参考】逐条核对。

【知识库参考】
{{kbContext}}

【核查要求】
1. 抽取文档中的事实性陈述(数据、定义、结论、流程、规定等)。
2. 对每条:在知识库参考中找依据 → 判定「一致 / 冲突 / KB未覆盖」。
3. 冲突项:同时给文档原文与知识库依据的逐字片段。

请按模板输出:
## 总体结论
一句话:核对了几条,几处冲突、几处KB未覆盖。
## 冲突项   (若无写"无")
- 文档原文:\`逐字片段\`
- 知识库依据:\`逐字片段\`
- 冲突说明:
- 建议:
## KB未覆盖(无法核实)
- 文档原文:\`逐字片段\`
## 一致项(汇总一句)

【当前文档】
---
{{input}}
---`
  }),

  /* 2. 与制度/规范对照核查 */
  base({
    id: 'analysis.kb-policy-compliance',
    label: '制度合规对照',
    shortLabel: '制度合规对照',
    icon: '📕',
    tags: ['知识库', '核查', '合规'],
    allowedActions: ['link-comment', 'comment', 'append', 'none'],
    defaultAction: 'link-comment',
    description: '以知识库中的制度/规范为基准,检查文档内容是否符合,标出违反或缺失项。',
    systemPrompt: `你是一位合规审查员,以【知识库参考】中的制度/规范条款为基准,检查当前文档是否符合。

${KB_RULES}`,
    userPromptTemplate: `请以下方【知识库参考】中的制度/规范为基准,审查【当前文档】是否合规。

【知识库参考(制度/规范)】
{{kbContext}}

【核查要求】
1. 找出文档中与知识库制度相关的做法/表述。
2. 判定「符合 / 违反 / 知识库未规定」。
3. 违反项:给文档原文 + 对应制度条款的逐字片段。

请按模板输出:
## 总体结论
## 违反项   (若无写"无")
- 文档原文:\`逐字片段\`
- 制度依据:\`逐字片段\`
- 问题:
- 整改建议:
## 知识库未规定(暂无法判定)
## 符合项(汇总一句)

【当前文档】
---
{{input}}
---`
  }),

  /* 3. 与标准/模板符合性核查 */
  base({
    id: 'analysis.kb-standard-conformance',
    label: '标准模板符合性',
    shortLabel: '标准模板符合性',
    icon: '📐',
    tags: ['知识库', '核查', '标准'],
    allowedActions: ['link-comment', 'comment', 'append', 'none'],
    defaultAction: 'link-comment',
    description: '对照知识库中的标准/范本/模板,检查文档在结构、要素、表述上的符合性与缺漏。',
    systemPrompt: `你是一位文档规范审核员,对照【知识库参考】中的标准/范本/模板,检查当前文档的符合性与缺漏。

${KB_RULES}`,
    userPromptTemplate: `请对照下方【知识库参考】中的标准/范本/模板,检查【当前文档】。

【知识库参考(标准/范本)】
{{kbContext}}

【核查要求】
1. 结构/要素:标准要求的章节、要素文档是否齐备。
2. 表述/格式:关键表述是否符合标准写法。
3. 缺漏:标准有、文档缺的项。

请按模板输出:
## 总体结论
## 不符合 / 缺漏   (若无写"无")
- 文档原文(或"缺失"):\`逐字片段\`
- 标准依据:\`逐字片段\`
- 建议:
## 符合项(汇总一句)

【当前文档】
---
{{input}}
---`
  }),

  /* 4. 与知识库矛盾点扫描 */
  base({
    id: 'analysis.kb-contradiction-scan',
    label: '知识库矛盾扫描',
    shortLabel: '知识库矛盾扫描',
    icon: '⚡',
    tags: ['知识库', '核查', '矛盾'],
    allowedActions: ['link-comment', 'comment', 'append', 'none'],
    defaultAction: 'link-comment',
    description: '扫描文档中与知识库直接矛盾的表述(结论相反、数据不符、定义冲突),逐条给双方依据。',
    systemPrompt: `你是一位矛盾检测员,专找文档与【知识库参考】之间的直接冲突(结论相反、数据不符、定义/口径冲突)。

${KB_RULES}`,
    userPromptTemplate: `请扫描【当前文档】中与下方【知识库参考】直接矛盾的表述。

【知识库参考】
{{kbContext}}

只报「直接矛盾」(结论相反/数据不符/定义冲突),不报"措辞不同但意思一致"。

请按模板输出:
## 总体结论
## 矛盾项   (若无写"未发现与知识库的直接矛盾")
- 文档原文:\`逐字片段\`
- 知识库依据:\`逐字片段\`
- 矛盾说明:
- 建议(以哪方为准需人工确认):

【当前文档】
---
{{input}}
---`
  }),

  /* 5. 数据/数字与知识库对照核查 */
  base({
    id: 'analysis.kb-data-crosscheck',
    label: '数据知识库对照',
    shortLabel: '数据知识库对照',
    icon: '🔢',
    tags: ['知识库', '核查', '数据'],
    allowedActions: ['link-comment', 'comment', 'append', 'none'],
    defaultAction: 'link-comment',
    description: '把文档中的关键数字/指标与知识库中的口径数据对照,标出不一致或口径差异。',
    systemPrompt: `你是一位数据核对员,把文档中的关键数字/指标与【知识库参考】中的数据对照,识别不一致与口径差异。

${KB_RULES}`,
    userPromptTemplate: `请把【当前文档】中的关键数字/指标,与下方【知识库参考】中的数据对照。

【知识库参考】
{{kbContext}}

【核查要求】
1. 抽取文档中可与知识库对照的数字/指标。
2. 判定「一致 / 不一致 / 口径不同 / KB未覆盖」。
3. 不一致:给文档与知识库双方逐字片段;口径不同要点明口径差异(同比/环比、含税/不含税等)。

请按模板输出:
## 总体结论
## 不一致 / 口径差异   (若无写"无")
- 文档原文:\`逐字片段\`
- 知识库依据:\`逐字片段\`
- 说明:
## KB未覆盖
## 一致项(汇总一句)

【当前文档】
---
{{input}}
---`
  }),

  /* 6. 术语/口径与知识库对齐 */
  base({
    id: 'analysis.kb-term-alignment',
    label: '术语口径对齐',
    shortLabel: '术语口径对齐',
    icon: '🏷️',
    tags: ['知识库', '核查', '术语'],
    allowedActions: ['link-comment', 'comment', 'append', 'none'],
    defaultAction: 'link-comment',
    description: '以知识库为准,检查文档术语/称谓/定义是否与知识库一致,标出偏离并给出标准用法。',
    systemPrompt: `你是一位术语规范核对员,以【知识库参考】为准,检查文档术语/称谓/定义是否对齐。

${KB_RULES}`,
    userPromptTemplate: `请以下方【知识库参考】为准,检查【当前文档】的术语/称谓/定义是否一致。

【知识库参考】
{{kbContext}}

请按模板输出:
## 总体结论
## 术语偏离   (若无写"无")
- 文档用法:\`逐字片段\`
- 知识库标准用法:\`逐字片段\`
- 建议统一为:
## KB未覆盖的术语

【当前文档】
---
{{input}}
---`
  }),

  /* 7. 引文/出处对知识库核验 */
  base({
    id: 'analysis.kb-citation-verify',
    label: '引文知识库核验',
    shortLabel: '引文知识库核验',
    icon: '🔎',
    tags: ['知识库', '核查', '引文'],
    allowedActions: ['link-comment', 'comment', 'append', 'none'],
    defaultAction: 'link-comment',
    description: '核验文档中的引用/引文是否能在知识库中找到对应来源,标出"知识库无此出处"的存疑引用。',
    systemPrompt: `你是一位引文溯源核验员,核对文档中的引用是否能在【知识库参考】中找到对应来源。不能找到的标「KB无此出处」,不臆断真伪。

${KB_RULES}`,
    userPromptTemplate: `请核验【当前文档】中的引用/引文/数据出处,是否能在下方【知识库参考】中找到对应来源。

【知识库参考】
{{kbContext}}

请按模板输出:
## 引用核验
每条:
- 文档引用:\`逐字片段\`
- 核验结果:(可对应:给知识库依据\`逐字片段\` / KB无此出处:存疑,建议人工核实)
## 总体提示

【当前文档】
---
{{input}}
---`
  }),

  /* 8. 知识库覆盖度核查 */
  base({
    id: 'analysis.kb-coverage',
    label: '知识库覆盖度核查',
    shortLabel: '知识库覆盖核查',
    icon: '🗺️',
    tags: ['知识库', '核查', '覆盖度'],
    allowedActions: ['comment', 'append', 'none'],
    defaultAction: 'comment',
    description: '标出文档中哪些要点能被知识库支撑、哪些是知识库未覆盖(可能需补充依据或核实)。',
    systemPrompt: `你是一位依据充分性评估员,标注文档各要点被【知识库参考】支撑的程度。

${KB_RULES}`,
    userPromptTemplate: `请评估【当前文档】各关键要点被下方【知识库参考】支撑的程度。

【知识库参考】
{{kbContext}}

请按模板输出:
## 有知识库支撑的要点
- 文档要点:\`逐字片段\`
- 知识库依据:\`逐字片段\`
## 知识库未覆盖的要点(需补充依据或人工核实)
- 文档要点:\`逐字片段\`
## 结论
一句话:整体被知识库支撑的比例与主要缺口。

【当前文档】
---
{{input}}
---`
  }),

  /* 9. 知识库补全建议 */
  base({
    id: 'analysis.kb-gap-fill',
    label: '知识库补全建议',
    shortLabel: '知识库补全建议',
    icon: '➕',
    tags: ['知识库', '建议', '补全'],
    allowedActions: ['comment', 'append', 'insert', 'none'],
    defaultAction: 'comment',
    description: '找出知识库里有、但当前文档缺失或可强化的要点,给出补充建议(标注知识库出处)。',
    systemPrompt: `你是一位文档完善顾问,对比【知识库参考】与当前文档,找出"知识库有、文档缺"的要点并建议补充。只基于知识库,不编造。

${KB_RULES}`,
    userPromptTemplate: `请对比下方【知识库参考】与【当前文档】,找出知识库里有、但文档缺失或可强化的要点。

【知识库参考】
{{kbContext}}

请按模板输出:
## 建议补充的要点   (若无写"无")
- 缺失/可强化点:
- 知识库依据:\`逐字片段\`
- 建议补充内容(供参考):
## 结论

【当前文档】
---
{{input}}
---`
  }),

  /* 10. 与知识库版本/口径差异核查 */
  base({
    id: 'analysis.kb-version-diff',
    label: '知识库版本差异核查',
    shortLabel: '知识库版本差异',
    icon: '🆚',
    tags: ['知识库', '核查', '版本差异'],
    allowedActions: ['comment', 'append', 'none'],
    defaultAction: 'comment',
    description: '当文档疑似基于旧版内容时,对照知识库最新口径,标出已变化/已过时的表述。',
    systemPrompt: `你是一位版本一致性核对员,对照【知识库参考】(视为较新口径),找出文档中疑似已过时/已变化的表述。

${KB_RULES}`,
    userPromptTemplate: `请把【当前文档】与下方【知识库参考】(视为较新口径)对照,找出疑似已过时或已变化的表述。

【知识库参考】
{{kbContext}}

请按模板输出:
## 疑似过时/已变化   (若无写"无")
- 文档原文:\`逐字片段\`
- 知识库较新口径:\`逐字片段\`
- 说明与建议:
## KB未覆盖(无法判断新旧)

【当前文档】
---
{{input}}
---`
  }),

  /* 11. 引用知识库作答(带出处) */
  base({
    id: 'analysis.kb-grounded-answer',
    label: '引用知识库作答',
    shortLabel: '引用知识库作答',
    icon: '💬',
    tags: ['知识库', '问答', '出处'],
    allowedActions: ['comment', 'insert', 'append', 'none'],
    defaultAction: 'comment',
    description: '基于绑定知识库回答文档中(或选中)的问题,答案必须附知识库出处,无依据则明示。',
    systemPrompt: `你是一位严格基于知识库作答的助手。答案只能来自【知识库参考】,每个要点附出处;知识库没有的,明确说"知识库未覆盖",不编造。

${KB_RULES}`,
    userPromptTemplate: `请基于下方【知识库参考】,回答【当前文档/问题】中提出的问题。

【知识库参考】
{{kbContext}}

要求:
1. 答案要点只能来自知识库参考,每个要点后标注出处(片段编号或文件名)。
2. 知识库未覆盖的部分,明确写"知识库未覆盖",不要用常识补足。

请按模板输出:
## 回答
(分点,每点附【出处:…】)
## 知识库未覆盖的部分
## 引用片段
列出用到的知识库片段逐字关键句。

【当前文档/问题】
---
{{input}}
---`
  }),

  /* 12. 合规对标(对照知识库法规/制度逐条) */
  base({
    id: 'analysis.kb-regulation-benchmark',
    label: '法规制度对标',
    shortLabel: '法规制度对标',
    icon: '⚖️',
    tags: ['知识库', '核查', '法规对标'],
    allowedActions: ['link-comment', 'comment', 'append', 'none'],
    defaultAction: 'link-comment',
    description: '逐条对照知识库中的法规/制度条款,对文档做合规对标,输出符合/不符/未覆盖与整改点。',
    systemPrompt: `你是一位合规对标审查员,逐条对照【知识库参考】中的法规/制度条款,对当前文档做对标。只依据知识库条款,不引入未提供的法条。

${KB_RULES}`,
    userPromptTemplate: `请逐条对照下方【知识库参考】中的法规/制度条款,对【当前文档】做合规对标。

【知识库参考(法规/制度条款)】
{{kbContext}}

请按模板输出:
## 对标结论
一句话:对标了几条,几处不符、几处未覆盖。
## 不符合项   (若无写"无")
- 文档原文:\`逐字片段\`
- 条款依据:\`逐字片段\`
- 不符说明:
- 整改建议:
## 知识库未覆盖
## 符合项(汇总一句)

【当前文档】
---
{{input}}
---`
  })
])

/** 合并进 base builtin 列表(去重:同 id 以 base 为准)。 */
export function mergeKbVerifyIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  const add = KB_VERIFY_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))
  return [...base, ...add]
}

export default { KB_VERIFY_BUILTIN_ASSISTANTS, mergeKbVerifyIntoBuiltins }
