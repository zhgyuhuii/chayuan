/**
 * builtinAssistantsBiddingExt — 「招投标」领域扩展包
 * 在现有 builtinAssistantsBidding 之外补充新的高频文书/核查/抽取助手,绝不与现有语义重复。
 * 现有已覆盖:招标要素提取、响应点对照、废标风险、资格核对、评分标准提取、技术标框架、
 * 商务标核对、标书一致性、澄清函、中标合同对照、偏离表生成、标书完整性。
 * 本扩展补:评分自评、投标函起草、保证金/担保核查、联合体分包核查、业绩证明清单提取、
 * 质疑函起草、踏勘答疑纪要、盲标/格式核查、报价构成提取、人员到岗承诺核查。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'bidding'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

const CHK = '约束:命中片段须用原文逐字、反引号包裹、可定位;只依据给定内容判断,拿不准标「待人工核实」,不臆造资质、业绩、金额;涉及金额先列原文数字再算。'

export const BIDDING_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.bid-self-scoring', label: '技术标自评打分', shortLabel: '技术标自评', icon: '🎯',
    tags: ['招投标', '核查', '自评'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '对照评分细则给自家投标内容逐项预估得分,指出失分点与可提分的薄弱章节,投标前自查。',
    systemPrompt: `你是一位投标评估专家,模拟评委按评分细则给自家标书预估得分。${CHK}评分要保守,不替自家拔高;每项给区间不给虚高单值。此为模拟自评,仅供投标前自查参考,不代表实际评标结果。`,
    userPromptTemplate: `请对照下面文本中的评分细则,对投标内容逐项预估得分(文本同时含评分细则与投标响应)。\n## 逐项自评\n- 评分项:\`细则原文逐字片段\`(满分X)\n- 投标对应内容:\`投标原文逐字片段\`\n- 预估得分区间与理由:\n- 可提分建议:\n## 薄弱章节(最该补强的几项)\n## 预估总分区间\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bid-bidletter-draft', label: '投标函起草', shortLabel: '投标函', icon: '📝',
    tags: ['招投标', '生成', '投标函'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.35,
    description: '依据项目与报价信息起草规范投标函:总报价、工期、质保、有效期、承诺事项,占位处标待补充。',
    systemPrompt: '你是一位投标专员,起草规范投标函正文。只依据给定信息填写,缺失项写【待补充】不编造;金额、工期照给定原文,措辞为正式商务体,不堆华丽辞藻。投标函为正式法律文书且含报价等实质性承诺,本助手仅辅助起草,定稿前须由投标负责人逐项核对金额、工期与承诺,本助手不替代专业审定。',
    userPromptTemplate: `请根据下面项目与报价信息起草投标函:致招标人抬头、项目名称与编号、投标总报价(大小写)、工期/交货期、质量标准、投标有效期、对招标文件的承诺、对中标后履约的承诺、落款与日期。缺失信息处标【待补充】。\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bid-bond-check', label: '保证金担保核查', shortLabel: '保证金核查', icon: '🛡️',
    tags: ['招投标', '核查', '保证金'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.15,
    description: '核查投标保证金/履约保函的金额、形式、出具方、有效期、收款账户是否满足招标要求。',
    systemPrompt: `你是一位投标审核员,核查保证金与保函合规性。${CHK}涉及金额、有效期等数字必须先引原文再判断。本助手仅辅助,不替代专业人员审定。`,
    userPromptTemplate: `请核查下面文本中投标保证金/履约担保是否满足招标要求(文本含招标要求与投标提交的保证金/保函信息),关注:金额是否达标、形式是否被允许(现金/保函/保险)、出具机构是否合格、有效期是否覆盖、收款账户是否一致、是否在截止前到账。\n## 问题项(若无写"未发现明显问题")\n- 招标要求:\`原文逐字片段\`\n- 投标提交情况:\`原文逐字片段\`\n- 问题与风险:\n- 建议:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bid-jv-subcontract-check', label: '联合体分包核查', shortLabel: '联合体分包', icon: '🤝',
    tags: ['招投标', '核查', '联合体'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.15,
    description: '核查联合体协议与分包安排是否合规:是否允许、牵头方资格、分工与连带责任、分包比例与禁止分包范围。',
    systemPrompt: `你是一位投标审核员,核查联合体与分包安排的合规性。${CHK}本助手仅辅助,不替代专业人员审定。`,
    userPromptTemplate: `请核查下面文本中联合体/分包安排是否满足招标要求(文本含招标相关条款与投标方的联合体协议或分包说明),关注:招标是否允许联合体/分包、牵头人资格、各方分工与连带责任、是否重复用同一资质、分包比例是否超限、是否分包了禁止分包的主体工程或关键工序。\n## 问题项(若无写"未发现明显问题")\n- 招标条款:\`原文逐字片段\`\n- 投标安排:\`原文逐字片段\`\n- 问题与风险:\n- 建议:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bid-track-record-extract', label: '业绩证明清单提取', shortLabel: '业绩清单提取', icon: '📦',
    tags: ['招投标', '提取', '业绩'], allowedActions: ['comment', 'none'], defaultAction: 'none',
    defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从投标文件提取类似业绩条目:项目名称、合同金额、时间、发包人、合同/验收证明编号,生成结构化清单。',
    systemPrompt: '你是一位投标专员,从投标文件抽取类似业绩证明,输出严格 JSON。项目名称、金额、时间、证明编号一律照原文,找不到的字段留空字符串,不编造、不推断。',
    userPromptTemplate: `请从下面投标文件提取类似业绩条目,输出严格 JSON(找不到留空,不编造):\n{"records":[{"projectName":"","contractAmount":"","signDate":"","completeDate":"","employer":"","scope":"","proofType":"","proofNo":""}]}\n投标文件:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bid-challenge-letter', label: '质疑函起草', shortLabel: '质疑函', icon: '⚖️',
    tags: ['招投标', '生成', '质疑'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '针对招标或评标结果中的疑点,起草规范质疑函:事实、依据、请求,事实清楚、依据具体。',
    systemPrompt: '你是一位招投标合规专员,起草规范质疑函。只就给定事实质疑,引用具体条款/事实,不夸大、不情绪化;法律依据不确定处写【请核实适用条款】。本助手仅辅助,不替代专业律师意见。',
    userPromptTemplate: `请根据下面事实起草质疑函:致招标人/代理机构抬头、质疑人信息、质疑事项与对应的招标文件条款或评标结果、事实与理由(逐条、引用具体依据)、具体请求(如重新评审/纠正)、落款与日期。依据不确定处写【请核实适用条款】。\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bid-site-qa-minutes', label: '踏勘答疑纪要', shortLabel: '答疑纪要', icon: '🗒️',
    tags: ['招投标', '生成', '答疑'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '把现场踏勘或答疑会的问答记录整理成规范纪要:问题、招标方答复、对投标的影响与待办。',
    systemPrompt: '你是一位投标专员,整理踏勘/答疑纪要。只依据给定问答内容,不补充未提及的答复;每条标明是否构成对招标文件的实质性修改;待办给到责任栏。',
    userPromptTemplate: `请把下面踏勘/答疑记录整理成纪要,Markdown 表格:序号 | 提问事项 | 招标方答复 | 是否构成招标文件修改 | 对我方投标的影响 | 待办事项。表后附"需重点跟进的几条"。\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bid-blind-format-check', label: '盲标格式核查', shortLabel: '盲标核查', icon: '🕵️',
    tags: ['招投标', '核查', '格式'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.15,
    description: '核查需匿名评审的技术标是否泄露投标人身份信息,以及格式/页码/签章是否符合电子标要求。',
    systemPrompt: `你是一位标书校核员,核查盲标匿名性与电子标格式合规。${CHK}泄露身份信息事关废标,宁可多提示。`,
    userPromptTemplate: `请核查下面技术标是否符合盲标与格式要求,关注:技术标内是否出现公司名称/品牌/人名/电话/网址等可识别身份的信息、页眉页脚水印是否泄露、是否按要求加盖电子签章、目录页码是否齐全、文件命名是否符合要求。\n## 问题项(若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题类型(身份泄露/签章缺失/格式不符):\n- 风险与建议:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bid-price-breakdown-extract', label: '报价构成提取', shortLabel: '报价构成提取', icon: '🧮',
    tags: ['招投标', '提取', '报价'], allowedActions: ['comment', 'none'], defaultAction: 'none',
    defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从投标报价表提取分项报价与构成:总价、分部分项、税率、暂列金、措施费等,生成结构化清单。',
    systemPrompt: '你是一位商务标专员,从报价文件抽取报价构成,输出严格 JSON。所有金额、税率照原文逐字,找不到的字段留空,不替投标人重新计算、不编造。本助手仅辅助,不替代造价专业人员核定。',
    userPromptTemplate: `请从下面报价文件提取报价构成,输出严格 JSON(找不到留空,不编造):\n{"totalPrice":"","totalPriceInWords":"","taxRate":"","items":[{"name":"","qty":"","unitPrice":"","amount":""}],"provisionalSum":"","measureFee":"","currency":"","notes":""}\n报价文件:\n---\n{{input}}\n---`
  }),
  base({
    id: 'analysis.bid-staffing-commitment-check', label: '人员到岗承诺核查', shortLabel: '人员到岗核查', icon: '👷',
    tags: ['招投标', '核查', '人员'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.15,
    description: '核查拟派项目人员的资格证书、社保、职称与到岗承诺是否满足招标要求且与业绩/履约能力对应。',
    systemPrompt: `你是一位投标审核员,核查拟派人员配置与到岗承诺。${CHK}注意同一人是否在多个项目重复投入。人员资格、社保、注册证书等是否合规可能直接影响废标,本助手仅辅助初筛,最终须由专业人员核定。`,
    userPromptTemplate: `请核查下面文本中拟派项目人员是否满足招标要求(文本含招标对人员的要求与投标的人员配置),关注:项目负责人/技术负责人资格与职称、注册证书与专业匹配、社保单位是否为投标人、关键岗位是否齐全、到岗承诺是否明确、是否存在一人多标重复投入。\n## 问题项(若无写"未发现明显问题")\n- 招标要求:\`原文逐字片段\`\n- 投标人员情况:\`原文逐字片段\`\n- 问题与风险:\n- 建议:\n---\n{{input}}\n---`
  })
])

export function mergeBiddingExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...BIDDING_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { BIDDING_EXT_BUILTIN_ASSISTANTS, mergeBiddingExtIntoBuiltins }
