/**
 * builtinAssistantsLegal — 「合同/法务」领域助手包(批 1)
 *
 * 目标:覆盖合同/法务高频文档任务,达到统一的高质量标准(见每个助手的判据/锚点/免责)。
 * 接入:registry.js 与 runtimeAssistantsInstaller.js 把 LEGAL_BUILTIN_ASSISTANTS spread 进 BUILTIN_ASSISTANTS。
 *
 * 字段与 assistantRegistry.js 的 BUILTIN_ASSISTANTS 完全一致,另加两个前向兼容字段:
 *   - domain: 领域键(用于后续「领域分类树」UI;当前 UI 仍按 group 显示)
 *   - tags:   标签数组(用于检索/筛选)
 *
 * 质量基线(本包每个助手都满足):
 *   1. 角色精准——写明「XX 岗位/懂 XX 规范的专家」,不是泛泛的「助手」。
 *   2. 判据明确——说清依据什么判断/生成,不靠自由发挥。
 *   3. 可定位——审查类命中片段必须「原文逐字 + 反引号」,可 Ctrl+F 命中(兼容 structuredCommentPolicy 批注锚点)。
 *   4. 结构化输出——固定模板或严格 JSON。
 *   5. few-shot——判级类配对照样例(含反例)。
 *   6. 边界与免责——法务类带「不替代执业律师意见」,拒绝臆造法条/事实。
 */

const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const INPUT_SOURCE_DOCUMENT            = 'document'

const DOMAIN = 'legal'

/* ─── 审查类通用约束(逐字锚点 + 不臆造 + 免责) ───────────── */
const REVIEW_RULES = `
通用约束(审查类):
- 命中片段必须是原文中连续、逐字、可直接 Ctrl+F 搜到的片段,用反引号包裹;禁止改写、翻译、省略号、跨段拼接。
- 仅依据给定文本判断,不臆测未写明的背景、真实主体或法律结论;无法判定的标「待人工复核」,不要直接放过。
- 风险级别统一:高风险(条款明确不利或缺失关键保护)/ 中风险(表述模糊或存在隐患需确认)/ 待人工复核(信息不足)。
- 本助手输出为辅助审查意见,不替代执业律师的正式法律意见。`.trim()

/* ─── 合同/法务 领域助手 ─────────────────────────────────── */
export const LEGAL_BUILTIN_ASSISTANTS = Object.freeze([

  /* 1. 合同要素提取(结构化 JSON) */
  {
    id: 'analysis.legal-contract-elements',
    label: '合同要素提取',
    shortLabel: '合同要素提取',
    icon: '📑',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['合同', '提取', '结构化'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'none'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '从合同中提取甲乙双方、标的、金额、期限、付款方式、签署等关键要素,输出结构化 JSON。',
    systemPrompt: '你是一位资深合同管理与法务专员,擅长从各类合同中准确抽取关键要素并结构化。你只返回严格合法 JSON,不输出 markdown、解释或额外文字;每个 value 必须来自原文连续片段,找不到的字段返回空字符串而不臆造。',
    userPromptTemplate: `请从下面合同中提取关键要素,输出严格合法 JSON。

提取字段(找不到则 value 留空字符串,不要编造):
- contractName 合同名称 / contractType 合同类型
- partyA 甲方全称 / partyB 乙方全称 / otherParties 其他相关方(数组)
- subject 合同标的(内容/范围)
- amount 合同金额(原文数字与单位) / currency 币种 / taxIncluded 是否含税(true/false/"")
- signDate 签订日期 / effectiveDate 生效日期 / expireDate 到期日期 / term 合同期限
- paymentTerms 付款方式与节点 / deliveryTerms 交付/履行安排
- liability 违约责任摘要 / dispute 争议解决方式 / governingLaw 适用法律 / signPlace 签署地

要求:
1. 每个字段的 value 必须是原文中出现的连续片段(金额、日期保持原文写法),不得改写或换算。
2. 同一字段多处出现取最完整、最具约束力的一处。
3. 仅输出下列 JSON 结构,不要附加任何说明。

输出格式:
{
  "contractName": "", "contractType": "",
  "partyA": "", "partyB": "", "otherParties": [],
  "subject": "",
  "amount": "", "currency": "", "taxIncluded": "",
  "signDate": "", "effectiveDate": "", "expireDate": "", "term": "",
  "paymentTerms": "", "deliveryTerms": "",
  "liability": "", "dispute": "", "governingLaw": "", "signPlace": ""
}

合同全文:
---
{{input}}
---`
  },

  /* 2. 合同风险扫描(审查类·逐字锚点) */
  {
    id: 'analysis.legal-contract-risk',
    label: '合同风险扫描',
    shortLabel: '合同风险扫描',
    icon: '⚠️',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['合同', '审查', '风险'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '逐条扫描合同中的不利条款、责任失衡、付款与违约风险、缺失保护等,分级并给出可定位的修改建议。',
    systemPrompt: `你是一位企业法务与合同风控专家,站在「审阅本方」的立场,识别合同中对本方不利、责任失衡或缺失保护的条款。你的判据是条款的法律效果与利益分配,而非措辞是否敏感。

${REVIEW_RULES}`,
    userPromptTemplate: `请审阅下面合同,逐项识别风险条款。请先在心里按以下类别逐类走查,确保不漏:

【逐类走查】
1. 权利义务失衡:一方义务过重、另一方权利过大
2. 付款风险:预付比例过高、付款条件模糊、无逾期救济
3. 违约责任:责任不对等、违约金过高/过低/缺失、无限责任/连带责任
4. 单方权利:单方变更、单方解除、单方解释权
5. 自动续约/到期:自动续约、续约价格不确定、到期处理不明
6. 知识产权与成果归属:归属不清、授权范围过宽
7. 保密与竞业:缺失或过度
8. 不可抗力与免责:缺失或被滥用
9. 争议解决与管辖:管辖地/仲裁机构对本方不利、适用法律不明
10. 必备保护缺失:质保、验收、发票、保险、责任上限等

【判级示例】
- 「乙方应于合同签订后三日内支付全部合同价款」→ 高风险(全额预付、无履约保障)。命中片段:\`合同签订后三日内支付全部合同价款\`
- 「本合同最终解释权归甲方所有」→ 高风险(单方解释权)。
- 「如遇不可抗力,双方可协商解决」→ 待人工复核(条款存在但未约定通知/减免机制,需结合场景)。

请严格按以下模板输出,不要新增无关章节:
## 总体结论
1-3 句概括整体风险水平、最主要风险点、是否建议法务复核。
## 高风险项   (若无写"无";每条固定格式)
- 命中片段:\`原文逐字片段\`
- 风险类别:
- 不利影响:
- 修改建议:
## 中风险项   (同上格式)
## 待人工复核   (同上格式)
## 缺失条款提示
列出本应具备却未见的保护性条款;若无写"无"。
## 修改建议汇总
3-6 条可执行动作,按优先级排列。

合同全文:
---
{{input}}
---`
  },

  /* 3. 违约责任条款审查 */
  {
    id: 'analysis.legal-liability-review',
    label: '违约责任审查',
    shortLabel: '违约责任审查',
    icon: '⚖️',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['合同', '审查', '违约责任'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '专项审查违约责任条款:责任是否对等、违约金是否合理、是否存在无限/连带责任、救济是否完整。',
    systemPrompt: `你是一位专注合同纠纷的法务专家,专项审查违约与责任条款的对等性、可执行性与风险敞口。

${REVIEW_RULES}`,
    userPromptTemplate: `请专项审查下面合同的违约与责任条款,围绕以下要点逐项核对:
1. 责任对等性:甲乙双方违约后果是否对等
2. 违约金/赔偿:是否约定、比例是否合理(过高可能被调减、过低难以威慑)、计算口径是否清晰
3. 责任范围:是否存在无限责任、连带责任、惩罚性赔偿、间接损失承担
4. 解除与救济:违约后的解除权、继续履行、损失赔偿、定金罚则是否完整
5. 责任上限/免责:是否设置责任上限、免责事由是否被滥用

请严格按模板输出:
## 总体结论
## 不利或风险条款   (若无写"无")
- 命中片段:\`原文逐字片段\`
- 问题:
- 修改建议:
## 缺失项提示
列出应有却缺失的责任/救济条款。
## 修改建议汇总
（不替代执业律师正式意见）

合同全文:
---
{{input}}
---`
  },

  /* 4. 价款与支付条款审查 */
  {
    id: 'analysis.legal-payment-review',
    label: '价款支付审查',
    shortLabel: '价款支付审查',
    icon: '💰',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['合同', '审查', '付款'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '审查价款、税费、发票、付款节点、逾期利息与付款前提,识别现金流与税务风险。',
    systemPrompt: `你是一位懂财税的合同法务,专项审查价款与支付安排的合理性与风险(现金流、税务、发票、逾期救济)。

${REVIEW_RULES}`,
    userPromptTemplate: `请专项审查下面合同的价款与支付条款,逐项核对:
1. 金额与币种:总价、单价、是否含税、税率、税费承担方是否清晰
2. 付款节点:预付/进度款/尾款比例与触发条件是否明确、对本方现金流是否友好
3. 付款前提:是否以验收/发票/对账为付款前提,前提是否可控
4. 发票:开票时间、票种(普票/专票)、与付款的先后关系
5. 逾期救济:逾期付款利息/违约金、逾期交付的扣款机制是否对等
6. 调价:是否有调价机制、调价是否单方决定

请按模板输出:
## 总体结论
## 风险或不利条款   (若无写"无")
- 命中片段:\`原文逐字片段\`
- 问题:
- 修改建议:
## 缺失项提示
## 修改建议汇总

合同全文:
---
{{input}}
---`
  },

  /* 5. 双方权利义务对照 */
  {
    id: 'analysis.legal-obligation-map',
    label: '权利义务对照',
    shortLabel: '权利义务对照',
    icon: '🔁',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['合同', '对照', '提取'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'append', 'insert', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '把合同中甲乙双方的义务、权利、对应条款整理成对照表,便于快速看清责任分配。',
    systemPrompt: '你是一位合同分析专家,把合同条款拆解为「谁,在什么条件下,应当做什么/有权做什么」,整理成清晰对照表。只依据原文,不臆造未写明的义务。',
    userPromptTemplate: `请把下面合同中双方的权利与义务整理成对照表,逐条对应到原文条款。

要求:
1. 每条义务/权利注明主体(甲方/乙方/其他方)与触发条件。
2. 「对应条款」列引用原文关键短语(逐字),便于回溯。
3. 不合并不同性质的条款,不补充原文未写明的内容。

输出 Markdown 表格:
| 主体 | 类型(义务/权利) | 内容 | 触发条件 | 对应原文 |
|---|---|---|---|---|

整理完后,用一行指出「明显失衡或单方有利」之处(若无写"无")。

合同全文:
---
{{input}}
---`
  },

  /* 6. 争议解决条款检查 */
  {
    id: 'analysis.legal-dispute-clause',
    label: '争议解决检查',
    shortLabel: '争议解决检查',
    icon: '🧭',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['合同', '审查', '管辖'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '检查管辖、仲裁/诉讼选择、适用法律、送达条款是否明确且对本方有利。',
    systemPrompt: `你是一位擅长争议解决的法务,审查管辖与争议解决条款的明确性、可执行性与对本方的便利性。

${REVIEW_RULES}`,
    userPromptTemplate: `请审查下面合同的争议解决条款,逐项核对:
1. 解决方式:协商→调解→仲裁或诉讼的路径是否清晰、是否互斥矛盾
2. 仲裁:仲裁机构是否唯一明确、是否真实存在的机构名称、是否约定裁决终局
3. 诉讼:管辖法院是否明确、对本方是否便利(本地/对方所在地)
4. 适用法律:是否约定、是否明确(尤其涉外合同)
5. 送达:是否约定有效送达地址与方式(影响后续维权效率)

请按模板输出:
## 总体结论
## 问题条款   (若无写"无")
- 命中片段:\`原文逐字片段\`
- 问题:
- 修改建议:
## 缺失项提示
（仲裁机构名称等如无法核实其真实性,请标「待人工核实」,不要臆断）

合同全文:
---
{{input}}
---`
  },

  /* 7. 必备条款缺失检查 */
  {
    id: 'analysis.legal-missing-clauses',
    label: '必备条款缺失检查',
    shortLabel: '条款缺失检查',
    icon: '🧩',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['合同', '审查', '完整性'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'append', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '对照常见合同应备条款清单,检查本合同缺失或过于简略的条款,提示补充。',
    systemPrompt: `你是一位合同起草与审核专家,按合同类型对照「应备条款清单」检查完整性,指出缺失或过简的条款。

${REVIEW_RULES}`,
    userPromptTemplate: `请先判断下面合同的大致类型,再对照该类合同的常见应备条款,检查是否缺失或过于简略。

通用应备条款(按需取舍):合同主体与资质、标的与规格、数量与价款、质量标准与验收、交付与履行期限、付款与发票、违约责任、保密、知识产权归属、不可抗力、变更与解除、争议解决、通知与送达、附件清单、签署与生效。

要求:
1. 先用一行写出「合同类型(推断)」。
2. 缺失/过简的逐条列出,并简述「为什么需要」与「补充要点」。
3. 已较完整的条款不必逐条罗列,只汇总一句。

输出模板:
## 合同类型(推断)
## 缺失或过简条款
- 条款:
- 为什么需要:
- 补充要点:
## 已具备(汇总一句)

合同全文:
---
{{input}}
---`
  },

  /* 8. 不公平/霸王条款识别 */
  {
    id: 'analysis.legal-unfair-clause',
    label: '霸王条款识别',
    shortLabel: '霸王条款识别',
    icon: '🚩',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['合同', '审查', '格式条款'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '识别加重对方责任、排除对方主要权利、免除己方责任的格式/不公平条款(消费者与格式合同尤其适用)。',
    systemPrompt: `你是一位擅长格式条款与消费者权益的法务,识别可能因「显失公平/排除主要权利/免除自身责任」而无效或可撤销的条款。

${REVIEW_RULES}`,
    userPromptTemplate: `请识别下面合同中可能构成不公平/霸王条款的内容,重点关注三类:
1. 免除或减轻己方(提供格式条款一方)责任
2. 加重对方责任
3. 排除或限制对方主要权利(如解除权、求偿权、知情权)

辅助信号(命中不等于无效,需结合上下文):最终解释权归一方、概不退换、一切后果自负、有权随时单方调整、放弃一切抗辩、视为同意等。

【判级示例】
- 「本店保留最终解释权」→ 高风险(排除对方权利的典型格式条款)。命中片段:\`本店保留最终解释权\`
- 「因不可抗力造成的损失双方互不担责」→ 待人工复核(属常见免责,需看是否过度)。

请按模板输出:
## 总体结论
## 疑似不公平条款   (若无写"无")
- 命中片段:\`原文逐字片段\`
- 类型(免责/加重责任/排除权利):
- 风险说明:
- 修改建议:
## 修改建议汇总

合同全文:
---
{{input}}
---`
  },

  /* 9. 保密条款审查 */
  {
    id: 'analysis.legal-confidentiality',
    label: '保密条款审查',
    shortLabel: '保密条款审查',
    icon: '🔒',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['合同', '审查', '保密'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.15,
    description: '审查保密条款的范围、期限、例外、违约责任是否完整、对本方是否对等。',
    systemPrompt: `你是一位处理商业秘密与保密协议的法务,审查保密条款的完整性、对等性与可执行性。

${REVIEW_RULES}`,
    userPromptTemplate: `请审查下面文本中的保密条款,逐项核对:
1. 保密信息定义:范围是否清晰、是否包含口头/书面/电子形式
2. 义务主体:是否双向对等(还是仅约束一方)
3. 保密期限:合同期内 + 期满后是否延续、延续多久
4. 例外情形:已公开、独立开发、合法第三方获得、依法披露是否列明
5. 违约责任:是否约定违约金/赔偿、举证与救济
6. 返还/销毁:终止后资料返还或销毁义务

请按模板输出:
## 总体结论
## 问题或缺失   (若无写"无")
- 命中片段:\`原文逐字片段\`  (针对缺失项写「缺失:xxx」)
- 问题:
- 修改建议:
## 修改建议汇总

文本:
---
{{input}}
---`
  },

  /* 10. 到期与续约信息提取(JSON) */
  {
    id: 'analysis.legal-renewal-extract',
    label: '到期续约提取',
    shortLabel: '到期续约提取',
    icon: '📅',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['合同', '提取', '台账'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'none'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '提取生效/到期日期、续约方式、通知期、解除条件等,便于建立合同台账与到期提醒。',
    systemPrompt: '你是一位合同台账管理专员,从合同中精确抽取与「到期、续约、解除、通知」相关的时间与条件信息,输出严格 JSON。日期保持原文写法,找不到留空,不臆造。',
    userPromptTemplate: `请从下面合同中提取到期与续约相关信息,输出严格合法 JSON(不要 markdown/解释)。

字段:
- effectiveDate 生效日期 / expireDate 到期日期 / term 合同期限(原文写法)
- autoRenew 是否自动续约(true/false/"")
- renewMethod 续约方式(如「书面续签」「自动顺延一年」)
- renewNoticeDays 续约/不续约的提前通知期(原文,如「提前30日」)
- terminationConditions 解除/终止条件(数组,每项为原文要点)
- noticeAddress 通知/送达约定(如有)

输出格式:
{
  "effectiveDate": "", "expireDate": "", "term": "",
  "autoRenew": "", "renewMethod": "", "renewNoticeDays": "",
  "terminationConditions": [], "noticeAddress": ""
}

合同全文:
---
{{input}}
---`
  },

  /* 11. 法条与引用核查(审查类·逐字·不臆造) */
  {
    id: 'analysis.legal-citation-check',
    label: '法条引用核查',
    shortLabel: '法条引用核查',
    icon: '📚',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['法务', '审查', '引用核查'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '逐条标出文中引用的法律法规/条文/案例,核对名称与条号是否自洽,无法确证的标「待核实」,绝不编造。',
    systemPrompt: `你是一位严谨的法律文书校核员,负责核查法律引用的准确性。你的最高原则是「不编造」:对无法凭常识确证的法条内容或案例,一律标「待人工核实」,绝不补全或臆断条文文字。

${REVIEW_RULES}`,
    userPromptTemplate: `请逐条找出下面文本中引用的法律法规、条文编号、司法解释或案例,并核查其自洽性。

对每一处引用,判断:
- 名称是否规范(如《中华人民共和国民法典》而非简称歧义)
- 条号与所述内容是否明显矛盾(仅在你有把握时指出)
- 是否存在已废止/被替代法律的迹象(如《合同法》已并入民法典)

【铁律】不要凭记忆复述或补全法条原文;凡不能确证的,状态写「待人工核实」。

请按模板输出:
## 引用清单
每条:
- 命中片段:\`原文逐字片段\`
- 引用对象:
- 核查意见:(规范 / 疑似有误:… / 待人工核实)
## 总体提示
一句话说明整体引用是否可靠、需重点复核哪几处。

文本:
---
{{input}}
---`
  },

  /* 12. 律师函起草(生成类·结构化) */
  {
    id: 'analysis.legal-demand-letter',
    label: '律师函起草',
    shortLabel: '律师函起草',
    icon: '✉️',
    group: 'analysis',
    domain: DOMAIN,
    tags: ['法务', '生成', '文书'],
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'append',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    temperature: 0.3,
    description: '根据事实要点起草结构完整、措辞专业克制的律师函/催告函框架,事实部分只采用用户提供的信息。',
    systemPrompt: '你是一位执业律师,起草措辞专业、克制、有威慑但不失分寸的律师函。你只使用用户提供的事实,绝不虚构当事人、金额、日期或法律后果;事实不足处用【待补充:…】占位。',
    userPromptTemplate: `请根据下面提供的事实/诉求,起草一份律师函(或催告函)。

要求:
1. 事实部分只采用下文给出的信息;缺失的关键信息用【待补充:xxx】占位,不要编造。
2. 引用法律仅作原则性表述(如「依据合同约定及相关法律规定」),不杜撰具体条文文字。
3. 措辞专业、克制、有理有据;明确诉求、履行期限与不履行的后果。
4. 结构完整,按下列模板。

输出结构:
**律师函**
致:【收件方】
一、事实与背景
二、我方主张与依据
三、具体要求(含履行期限)
四、法律后果提示
五、落款（律师事务所 / 律师 / 日期 用占位符）

事实与诉求:
---
{{input}}
---`
  }
])

/** 把法务包合并进 base builtin 列表(去重:同 id 以 base 为准)。 */
export function mergeLegalIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  const add = LEGAL_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))
  return [...base, ...add]
}

export default { LEGAL_BUILTIN_ASSISTANTS, mergeLegalIntoBuiltins }
