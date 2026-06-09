/**
 * builtinAssistantsBidding — 「招投标」领域助手包(批7)
 * 核查/提取类批注或none、生成框架类插入。约束:逐字对照招标文件,不臆造资质/业绩;废标项严谨。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'bidding'
const CHK = `通用约束(核查):命中片段原文逐字、反引号包裹、可定位;严格对照招标文件要求,拿不准标「待人工核实」;废标风险事关重大,宁可多提示。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.2, ...extra
})

export const BIDDING_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.bid-tender-extract', label: '招标文件要素提取', shortLabel: '招标要素提取', icon: '📋',
    tags: ['招投标', '提取', '招标'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从招标文件提取关键要素:项目、预算、资格要求、关键时间、保证金、评标办法等。',
    systemPrompt: '你是一位投标专员,从招标文件抽取关键要素,输出严格 JSON,时间金额照原文,找不到留空。',
    userPromptTemplate: `请从下面招标文件提取要素,输出严格 JSON:\n{"projectName":"","tenderNo":"","budget":"","qualification":"","bidDeadline":"","openTime":"","bidBond":"","evaluationMethod":"","contact":"","keyDates":[]}\n招标文件:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bid-response-check', label: '投标响应点对照', shortLabel: '响应点对照', icon: '✅',
    tags: ['招投标', '核查', '响应'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '对照招标要求逐条核查投标文件是否实质性响应,标出未响应、负偏离、漏项。',
    systemPrompt: `你是一位投标审核员,逐条核对投标文件对招标要求的响应。${CHK}`,
    userPromptTemplate: `请对照招标要求,逐条核查投标内容是否实质性响应(文本里请同时给出招标要求与投标响应):\n## 未响应/负偏离/漏项 (若无写"均已响应")\n- 招标要求:\`原文逐字片段\`\n- 投标响应情况:(未响应/负偏离/已响应)\n- 风险与建议:\n内容:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bid-disqualify-check', label: '废标风险检查', shortLabel: '废标风险检查', icon: '🚫',
    tags: ['招投标', '核查', '废标'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '检查投标文件是否触碰废标/否决项:资格不符、关键签章缺失、实质性条款负偏离、格式致命错误。',
    systemPrompt: `你是一位资深投标审核,专查可能导致废标的致命问题。${CHK}`,
    userPromptTemplate: `请检查下面投标文件的废标风险,对照招标文件的否决条款,关注:资格条件不满足、关键证明/签字盖章缺失、实质性条款负偏离、报价超预算/算术错误、未按格式响应、有效期不足。\n## 废标风险 (若无写"未发现明显废标风险")\n- 命中片段:\`原文逐字片段\`\n- 触碰的否决项:\n- 后果与补救建议:\n内容:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bid-qualification-check', label: '资格要求核对', shortLabel: '资格核对', icon: '🎫',
    tags: ['招投标', '核查', '资格'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '逐项核对投标人资格(资质等级、业绩、人员、财务等)是否满足招标资格要求。',
    systemPrompt: `你是一位投标审核员,逐项核对资格条件。${CHK}`,
    userPromptTemplate: `请逐项核对投标人资格是否满足招标要求(文本含资格要求与投标人情况):资质等级、类似业绩、注册资本/财务、项目人员、信誉等。\n## 核对结果\n- 要求项:\`原文逐字片段\`\n- 是否满足:(满足/不满足/待核实)\n- 缺口与建议:\n内容:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bid-scoring-extract', label: '评分标准提取', shortLabel: '评分标准提取', icon: '📊',
    tags: ['招投标', '提取', '评分'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.1,
    description: '从招标文件提取评标办法和评分细则,整理成评分项-分值-评分要点表,指导编标。',
    systemPrompt: '你是一位投标专员,从招标文件梳理评分细则。只摘原文,分值与要点照原文,便于按分编标。',
    userPromptTemplate: `请从下面评标办法提取评分细则,Markdown 表格:评分项 | 分值 | 评分要点/得分条件。并指出分值最高、最该重点准备的几项。\n评标办法:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bid-tech-proposal', label: '技术标框架', shortLabel: '技术标框架', icon: '🏗️',
    tags: ['招投标', '生成', '技术标'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '根据项目和评分点搭技术标框架:理解、方案、组织、进度、质量、安全等章节,对应得分点。',
    systemPrompt: '你是一位标书编制专家,按评分点搭技术标框架。基于给定项目与评分要求组织章节,不编造业绩数据,缺处标【待补充】。',
    userPromptTemplate: `请根据下面项目与评分点搭技术标框架:项目理解与需求分析、总体技术方案、组织机构与人员、施工/实施进度、质量保证、安全与文明、应急预案、售后服务。各章对应评分点。缺处【待补充】。\n项目与评分点:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bid-commercial-extract', label: '商务标要素核对', shortLabel: '商务标核对', icon: '💼',
    tags: ['招投标', '核查', '商务标'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '核对商务标关键要素:报价是否完整、是否超预算、工期、付款、质保、与招标商务要求的偏离。',
    systemPrompt: `你是一位商务标审核员,核对报价与商务条款。涉及金额先列原文数字。${CHK}`,
    userPromptTemplate: `请核对下面商务标:报价是否完整无漏项、是否超控制价、算术是否正确(先列原文数字)、工期/付款/质保是否满足招标商务要求、有无负偏离。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n内容:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bid-consistency-check', label: '投标书一致性检查', shortLabel: '标书一致性', icon: '🔗',
    tags: ['招投标', '核查', '一致性'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.1,
    description: '检查标书内部前后是否一致:报价、工期、人员、业绩在不同章节/表格中是否对得上。',
    systemPrompt: '你是一位标书校核员,查标书内部一致性。矛盾两处都引原文逐字、反引号包裹。只报真矛盾。',
    userPromptTemplate: `请检查下面标书内部一致性:同一报价/工期/人员/业绩/设备参数在不同章节或表格中是否一致。\n## 不一致项 (若无写"未发现明显矛盾")\n- 处一:\`原文逐字片段\`\n- 处二:\`原文逐字片段\`\n- 说明与建议:\n标书:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bid-clarification-letter', label: '澄清函起草', shortLabel: '澄清函', icon: '✉️',
    tags: ['招投标', '生成', '澄清'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '针对招标方质询或自身需澄清事项,起草规范澄清/答疑函,事实清楚、不超原标范围。',
    systemPrompt: '你是一位投标专员,起草规范澄清函。只就给定事项澄清,不修改实质性内容、不超出原投标范围,措辞专业。',
    userPromptTemplate: `请针对下面事项起草澄清函:致招标方、引用质询/澄清事项、逐条澄清说明(事实清楚、不构成实质性修改)、落款。\n事项:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bid-award-check', label: '中标合同对照', shortLabel: '中标合同对照', icon: '📜',
    tags: ['招投标', '核查', '合同'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '核对签约合同与招标文件、投标承诺是否一致,有无擅自增减实质性内容。',
    systemPrompt: `你是一位合约审核员,核对中标合同与招标/投标的一致性。${CHK}`,
    userPromptTemplate: `请核对下面合同与招标文件/投标承诺是否一致(文本含合同与对照依据):价格、工期、范围、质保、付款等实质性内容有无擅自变更。\n## 不一致/变更项 (若无写"与招投标一致")\n- 合同条款:\`原文逐字片段\`\n- 对照依据:\`原文逐字片段\`\n- 问题与建议:\n内容:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bid-deviation-table', label: '偏离表生成', shortLabel: '偏离表生成', icon: '📐',
    tags: ['招投标', '生成', '偏离表'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.2,
    description: '对照招标要求生成技术/商务偏离表:逐条列要求、投标响应、偏离情况(正/负/无)。',
    systemPrompt: '你是一位标书编制员,生成规范偏离表。逐条对照,只依据给定内容,偏离判断客观,不掩盖负偏离。',
    userPromptTemplate: `请根据下面招标要求与投标响应生成偏离表,Markdown:序号 | 招标要求 | 投标响应 | 偏离情况(正偏离/无偏离/负偏离) | 说明。\n要求与响应:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.bid-completeness-check', label: '标书完整性核对', shortLabel: '标书完整性', icon: '🧩',
    tags: ['招投标', '核查', '完整性'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '对照招标文件要求的投标文件组成清单,核对标书是否齐全,列出缺失的章节/表格/证明。',
    systemPrompt: `你是一位标书审核员,对照招标要求的投标文件组成,核对标书完整性。${CHK}`,
    userPromptTemplate: `请对照招标文件要求的投标文件组成清单(文本含清单与标书目录),核对是否齐全:\n## 核对依据(组成清单)\n## 缺失项 (声明要、标书缺)\n- 应有:\`清单原文\`\n## 结论\n内容:\n---\n{{input}}\n---` })
])

export function mergeBiddingIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...BIDDING_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { BIDDING_BUILTIN_ASSISTANTS, mergeBiddingIntoBuiltins }
