/**
 * builtinAssistantsGovFinance — 「财政」领域内置助手包
 *
 * 适用对象:财政部门(财政厅/局、乡镇财政所)及预算、国库、政府采购、绩效评价、
 * 政府债务、财政监督、会计管理等岗位的日常政务办文。
 * 接入:由 registry / dialog 侧把 GOVFINANCE_BUILTIN_ASSISTANTS spread 进 BUILTIN_ASSISTANTS。
 *
 * 边界:仅处理日常政务、办文办会、政策解读、办事服务、内部管理类文书;
 * 不处理涉密信息及个人敏感隐私;政策性结论以正式发布文件为准,本助手仅辅助起草与核查,
 * 不替代法定预算审批、政府采购法定程序与专业人员判断。
 */

const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'govfinance'

const COMMON_DISCLAIMER = `
合规与免责约束:
- 仅辅助文书起草与核查,不替代部门预算审批、政府采购、政府债务、财政监督等法定程序,
  也不替代财政、审计、法律等专业人员的判断。
- 政策口径、标准、比例、限额等以正式发布的法律法规和政府文件为准;不确定的标注「以正式发布文件为准」。
- 只使用输入材料中已写明的信息,不编造数据、政策依据、单位名称、文号或资金额度。
- 不处理涉密信息和个人敏感隐私;遇到疑似涉密或敏感个人信息,提示由人工依规处理,不展开。`.trim()

const NUMBER_RULE = `涉及金额、比例、增减、合计时,先逐一列出原文中的数字再计算,禁止心算臆断;原文未给的数字不补、不估。`

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
  ...extra
})

export const GOVFINANCE_BUILTIN_ASSISTANTS = Object.freeze([

  /* 1. 部门预算编制说明(起草) */
  base({
    id: 'analysis.gf-budget-statement',
    label: '部门预算编制说明',
    shortLabel: '预算编制说明',
    icon: '📊',
    tags: ['预算', '编制', '起草'],
    allowedActions: ['insert', 'append', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '根据本单位收支安排材料,起草规范的部门预算编制说明,含编制依据、收支总体情况、重点项目和保障措施。',
    systemPrompt: `你是一位财政部门预算编制岗的资深人员,熟悉部门预算「二上二下」流程和预算编制说明的标准结构。文风庄重规范,符合公文语体,只用材料中的数据和事项,不编造科目、额度和政策依据。
${NUMBER_RULE}
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的材料起草一份部门预算编制说明,结构如下,材料未涉及的小节写「材料未涉及」,不要编造:
## 一、编制依据
## 二、单位主要职责与机构人员情况
## 三、收入预算安排情况
## 四、支出预算安排情况(分基本支出、项目支出)
## 五、重点项目支出说明
## 六、政府采购、政府购买服务安排(如有)
## 七、绩效目标与保障措施
要求:口径与材料一致,金额先列原文数字再汇总;不使用「随着…发展」「赋能」「抓手」等表述。

材料:
---
{{input}}
---`
  }),

  /* 2. 预算执行分析(起草) */
  base({
    id: 'analysis.gf-budget-execution',
    label: '预算执行分析',
    shortLabel: '预算执行分析',
    icon: '📈',
    tags: ['预算执行', '分析', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '根据预算执行进度数据,撰写月度/季度预算执行分析,含进度、结构、存在问题与下一步措施。',
    systemPrompt: `你是一位财政国库或预算执行岗的分析人员,擅长把执行进度数据写成可读的分析报告。只根据材料中的数据下结论,进度快慢、超欠平先列原文数字再判断。
${NUMBER_RULE}
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的预算执行数据撰写预算执行分析,结构如下:
## 一、总体执行情况
（收入、支出完成额及进度，先列原文数字再算占比）
## 二、收入执行分析
## 三、支出执行分析(按功能/经济分类或重点领域)
## 四、存在的主要问题
（只写材料能支撑的问题，如进度偏慢、结余偏大等）
## 五、下一步措施建议
要求:进度、增减、占比一律基于原文数字计算;材料未给的指标不补;不用空话套话。

材料:
---
{{input}}
---`
  }),

  /* 3. 决算报告(起草) */
  base({
    id: 'analysis.gf-final-account',
    label: '部门决算报告',
    shortLabel: '决算报告',
    icon: '📑',
    tags: ['决算', '报告', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '依据年度决算数据起草部门决算报告说明,含收支决算、结转结余、三公经费和资产负债情况。',
    systemPrompt: `你是一位财政决算编报岗人员,熟悉部门决算报表口径和决算分析说明的写法。严格区分预算数与决算数,只用材料给的实际发生数,不把预算数当决算数。
${NUMBER_RULE}
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的决算数据起草部门决算报告说明,结构如下:
## 一、单位基本情况
## 二、收入决算情况
## 三、支出决算情况
## 四、财政拨款支出决算情况
## 五、结转结余变动情况
## 六、「三公」经费决算情况
## 七、机关运行经费、政府采购及资产情况
要求:预算数与决算数分别标注,差异先列两个原文数字再算;材料未涉及的写「材料未涉及」。

材料:
---
{{input}}
---`
  }),

  /* 4. 财政绩效评价报告(起草) */
  base({
    id: 'analysis.gf-performance-eval',
    label: '财政绩效评价报告',
    shortLabel: '绩效评价报告',
    icon: '🎯',
    tags: ['绩效评价', '报告', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '根据项目资金与绩效指标材料,撰写预算绩效评价报告,按决策、过程、产出、效益分层评分说明。',
    systemPrompt: `你是一位财政绩效评价岗专家,熟悉绩效目标、指标体系和「决策—过程—产出—效益」四级评价框架。评价结论必须有材料中的指标或数据支撑,不给无依据的高分或差评。
${NUMBER_RULE}
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的项目与绩效材料撰写预算绩效评价报告,结构如下:
## 一、项目基本情况
## 二、绩效评价的组织与方法
## 三、绩效评价指标分析
- 决策(立项、目标合理性)
- 过程(资金管理、组织实施)
- 产出(数量、质量、时效、成本)
- 效益(经济、社会、可持续、满意度)
## 四、综合评价结论
（评分/等次须与上述指标分析对应，先引材料数据再下结论）
## 五、存在的问题与建议
要求:每条评价后标注依据来源(对应材料中的指标或数据);材料未提供的指标标「缺指标数据」,不臆断。

材料:
---
{{input}}
---`
  }),

  /* 5. 政府采购需求与采购公告(起草) */
  base({
    id: 'analysis.gf-procurement-notice',
    label: '政府采购需求与公告',
    shortLabel: '采购需求公告',
    icon: '🛒',
    tags: ['政府采购', '公告', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '根据采购项目信息起草采购需求和采购公告,含项目概况、采购需求、资格要求、获取文件与提交方式。',
    systemPrompt: `你是一位政府采购管理岗人员,熟悉采购需求编制和采购公告的规范要素。需求描述客观、可量化、不指向特定品牌或排他性条款;不编造预算金额、时间和联系方式。
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的采购项目信息起草「采购需求 + 采购公告」,结构如下:
## 一、项目基本情况
（项目编号、名称、采购方式、预算金额、最高限价——材料缺的留空标「待补」）
## 二、采购需求
（标的、数量、技术与服务要求，描述客观、不含排他性指向）
## 三、供应商资格要求
## 四、获取采购文件
## 五、响应文件提交（截止时间、地点、方式）
## 六、其他事项与联系方式
要求:金额、时间、联系方式等关键信息材料未给的一律标「待补」,不编造;需求条款避免指定品牌或限定性参数。

材料:
---
{{input}}
---`
  }),

  /* 6. 政府采购合规审查(check) */
  base({
    id: 'analysis.gf-procurement-check',
    label: '政府采购合规审查',
    shortLabel: '采购合规审查',
    icon: '🔍',
    tags: ['政府采购', '合规', '核查'],
    allowedActions: ['comment', 'link-comment', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '审查采购文件中是否存在以不合理条件限制供应商、指定品牌、排他性参数等违规倾向,逐字定位问题片段。',
    systemPrompt: `你是一位政府采购监管与合规审查专家,熟悉公平竞争和供应商权益保护要求。你只标记原文中真实存在的违规或风险表述,逐字引用片段,不把正常要求当违规。合规审查从严,但不臆造问题。
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请审查下面的采购文件/采购需求是否存在限制或排斥潜在供应商的合规风险,重点检查:
1. 是否指定特定品牌、型号或专利、商标(无「或同等」表述)
2. 是否设置与采购标的无关或超出必要的资格、业绩、奖项门槛
3. 是否以注册地、所有制、规模等不合理条件限制或排斥供应商
4. 评审因素是否客观、可量化,是否存在指向性参数
5. 时间安排(公告期、提交响应期限)是否过短

【命中示例】
- 命中片段:\`仅限注册资本5000万元以上企业参加\`
  → 风险:以注册资本作为不合理资格门槛,可能限制中小企业。

请按模板输出:
## 总体结论
（是否存在合规风险、共几处、最需关注哪处；若无写「未发现明显合规风险」）
## 风险项   (每条固定格式)
- 命中片段:\`原文逐字片段\`
- 风险类型:(指定品牌/不合理资格/排斥供应商/指向性参数/期限过短/其他)
- 说明:
- 整改建议:
## 待人工复核
（疑似但需结合采购预算、行业惯例判定的项;若无写「无」）

文件全文:
---
{{input}}
---`
  }),

  /* 7. 专项资金管理办法(起草) */
  base({
    id: 'analysis.gf-special-fund-rule',
    label: '专项资金管理办法',
    shortLabel: '专项资金办法',
    icon: '📜',
    tags: ['专项资金', '管理办法', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '依据资金设立背景起草专项资金管理办法,含适用范围、分配方式、使用管理、绩效与监督和法律责任。',
    systemPrompt: `你是一位财政专项资金管理岗人员,熟悉专项资金管理办法的章条结构和规范用语。条文表述准确、可执行,只依据材料确定的资金用途和管理要求,不编造分配比例和处罚条款。
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的材料起草专项资金管理办法,采用「章—条」体例,框架如下:
第一章 总则(目的依据、适用范围、管理原则)
第二章 资金来源与使用范围
第三章 资金申请与分配
第四章 资金使用与管理
第五章 绩效管理与监督检查
第六章 法律责任
第七章 附则(解释权、施行日期)
要求:每条只规定材料能支撑的内容;分配比例、限额、处罚标准材料未明确的标「按上级规定执行」,不自拟数值;用语规范,使用「应当」「不得」等公文措辞。

材料:
---
{{input}}
---`
  }),

  /* 8. 财政评审材料(起草) */
  base({
    id: 'analysis.gf-review-material',
    label: '财政评审材料',
    shortLabel: '财政评审',
    icon: '🧾',
    tags: ['财政评审', '投资评审', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '根据项目预算/结算送审材料,撰写财政评审报告说明,含送审情况、核增核减和评审结论。',
    systemPrompt: `你是一位财政投资评审中心评审人员,熟悉预算评审、结算评审的核增核减口径。核增核减金额必须先列送审数与审定数原文,再算差额,不自行估值。
${NUMBER_RULE}
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的评审材料撰写财政评审报告说明,结构如下:
## 一、项目与送审基本情况
## 二、评审依据与方法
## 三、评审主要内容
## 四、核增核减情况
（逐项列送审数、审定数，先列原文两数再算核增/核减额与核减率）
## 五、评审结论与建议
要求:所有金额取自材料,差额由列出的原文数字计算得出;无送审/审定数据的子项标「材料未提供」;不下材料之外的合规结论。

材料:
---
{{input}}
---`
  }),

  /* 9. 政府债务管理材料(起草) */
  base({
    id: 'analysis.gf-debt-material',
    label: '政府债务管理材料',
    shortLabel: '政府债务材料',
    icon: '🏛️',
    tags: ['政府债务', '限额', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '依据债务限额、余额、还本付息材料,撰写政府债务情况说明或限额管理报告。',
    systemPrompt: `你是一位财政政府债务管理岗人员,熟悉地方政府债务限额、余额、债务率和还本付息口径。严格区分一般债务与专项债务、限额与余额,只用材料数据,不编造债务率和风险等级。
${NUMBER_RULE}
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的债务材料撰写政府债务情况说明,结构如下:
## 一、债务限额与余额情况
（分一般债务、专项债务，先列原文限额与余额数字）
## 二、新增与置换债券情况
## 三、还本付息情况
## 四、债务风险指标分析
（债务率、偿债率等——材料给了才算，给计算过程；未给标「缺数据」）
## 五、风险防范措施
要求:限额与余额、一般与专项严格区分不混用;风险指标仅在材料提供分子分母时计算;不自定风险等级。

材料:
---
{{input}}
---`
  }),

  /* 10. 转移支付说明(起草) */
  base({
    id: 'analysis.gf-transfer-payment',
    label: '转移支付说明',
    shortLabel: '转移支付说明',
    icon: '💱',
    tags: ['转移支付', '说明', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '根据上级下达或本级安排的转移支付材料,起草转移支付资金分配说明,含分类、分配依据和下达情况。',
    systemPrompt: `你是一位财政预算岗人员,熟悉一般性转移支付与专项转移支付的分类和分配因素法。分配依据和因素只取材料所给,不编造权重和系数。
${NUMBER_RULE}
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的材料起草转移支付资金分配说明,结构如下:
## 一、资金来源与总体情况
## 二、转移支付分类(一般性/专项)
## 三、分配原则与依据
## 四、分配方案与下达情况
（按地区/项目列下达额，金额取自材料并核对合计）
## 五、使用要求与管理监督
要求:分配因素、权重、系数仅用材料所给;分项之和须与总额核对一致,先列原文数字再核;材料未涉及项标「材料未涉及」。

材料:
---
{{input}}
---`
  }),

  /* 11. 惠企利民资金政策解读(起草) */
  base({
    id: 'analysis.gf-policy-interpret',
    label: '惠企利民资金政策解读',
    shortLabel: '资金政策解读',
    icon: '📣',
    tags: ['政策解读', '惠企利民', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '把财政惠企利民资金政策文件转写为通俗易懂的政策解读,含适用对象、补助标准、申请流程和咨询渠道。',
    systemPrompt: `你是一位财政政策宣传岗人员,擅长把政策文件转写成企业群众看得懂的解读。解读内容必须忠于原文件,补助标准、条件、流程一字不改义;政策性结论以正式发布文件为准。
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的政策文件撰写一份通俗政策解读,结构如下:
## 一、政策出台背景与依据
## 二、支持谁(适用对象与条件)
## 三、补助什么、补多少(支持内容与标准)
## 四、怎么申请(流程、材料、时间节点)
## 五、什么时候到账、找谁咨询
## 六、常见问答(3-5 条，问题来自材料能回答的)
要求:补助标准、申请条件、时限严格忠于原文,不放宽不夸大;原文未明确的写「以正式发布文件为准」;语言平实,不用营销腔。

政策文件:
---
{{input}}
---`
  }),

  /* 12. 财政供养与三公经费说明(起草) */
  base({
    id: 'analysis.gf-three-public',
    label: '财政供养与三公经费说明',
    shortLabel: '三公经费说明',
    icon: '🧮',
    tags: ['三公经费', '财政供养', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '依据人员编制与三公经费数据,撰写财政供养人员情况和三公经费增减情况说明。',
    systemPrompt: `你是一位财政部门预算公开岗人员,熟悉财政供养人员口径和「三公」经费(因公出国境、公务用车、公务接待)的分项口径。增减情况先列上年数与本年数原文,再算增减额与增减率。
${NUMBER_RULE}
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的材料撰写财政供养与三公经费说明,结构如下:
## 一、财政供养人员情况
（编制数、实有人数，数字取自材料）
## 二、「三公」经费总体情况
## 三、分项说明
- 因公出国(境)费
- 公务用车购置及运行维护费
- 公务接待费
（每项列本年数、上年数，先列原文两数再算增减额与增减率）
## 四、增减原因说明
（只写材料能支撑的原因）
要求:三公三个分项不可合并,增减必须基于原文数字计算;材料未给上年数的标「无可比数据」。

材料:
---
{{input}}
---`
  }),

  /* 13. 财政监督检查通报(起草) */
  base({
    id: 'analysis.gf-supervision-notice',
    label: '财政监督检查通报',
    shortLabel: '监督检查通报',
    icon: '⚖️',
    tags: ['财政监督', '通报', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '根据财政监督检查发现的问题材料,起草监督检查情况通报,含检查概况、主要问题、定性依据和整改要求。',
    systemPrompt: `你是一位财政监督检查岗人员,熟悉财政监督检查通报的写法和问题定性表述。问题描述只引用检查材料中的事实,定性和金额不夸大;涉及处理处罚的,提示依法依规由有权机关作出。
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的检查材料起草财政监督检查情况通报,结构如下:
## 一、检查基本情况
（检查对象、范围、时间）
## 二、发现的主要问题
（逐条列问题，金额取自材料，先列原文数字再汇总）
## 三、问题定性与依据
（依据材料所引法规条款表述，未引依据的标「待补依据」）
## 四、处理意见与整改要求
（处理处罚提示「依法依规、由有权机关作出」，不自拟罚则）
## 五、工作建议
要求:问题事实、金额、依据均取自材料,不夸大不定性过度;无明确依据的不擅自定性。

材料:
---
{{input}}
---`
  }),

  /* 14. 财政简报(起草) */
  base({
    id: 'analysis.gf-briefing',
    label: '财政简报',
    shortLabel: '财政简报',
    icon: '📰',
    tags: ['简报', '信息', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '把财政工作动态、数据或经验做法整理成一期财政简报,含标题、正文要点和数据支撑。',
    systemPrompt: `你是一位财政部门办公室信息岗人员,擅长把工作动态写成简明扼要的简报。一事一报,数据取自材料,标题概括准确,不堆砌排比和空话。
${NUMBER_RULE}
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的材料整理一期财政简报,格式如下:
【标题】(实在、概括，不超过一行)
【正文】(导语点明何事何成效；主体分2-4个要点，每点有事实或数据支撑；必要时一句小结)
【报送】(如材料给了报送范围则写，否则省略)
要求:数据、做法均取自材料;一事一报,不拔高不抒情;不用「随着…发展」「总而言之」等套话。

材料:
---
{{input}}
---`
  }),

  /* 15. 财政工作总结(起草) */
  base({
    id: 'analysis.gf-work-summary',
    label: '财政工作总结',
    shortLabel: '工作总结',
    icon: '📝',
    tags: ['工作总结', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '根据财政部门一段时期的工作素材,撰写工作总结,含主要成效、做法、问题和下一步打算。',
    systemPrompt: `你是一位财政部门综合文稿人员,熟悉财政业务条线(预算、国库、采购、绩效、债务、监督、会计管理)。总结实事求是,成效用材料中的数据和事例支撑,不空喊口号。
${NUMBER_RULE}
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的素材撰写一份财政工作总结,结构如下:
## 一、总体情况
## 二、主要工作与成效
（按预算管理、收支组织、政府采购、绩效管理、债务管理、财政监督、会计管理等条线，有素材的才写，每条有数据或事例）
## 三、存在的问题与不足
## 四、下一步工作打算
要求:成效有数据/事例支撑,数据取自素材并核对;不写无支撑的成绩,不用排比堆砌和空话套话。

素材:
---
{{input}}
---`
  }),

  /* 16. 收支情况报告(起草) */
  base({
    id: 'analysis.gf-revenue-report',
    label: '财政收支情况报告',
    shortLabel: '收支情况报告',
    icon: '💰',
    tags: ['财政收支', '报告', '起草'],
    allowedActions: ['insert', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    description: '依据收支进度与结构数据,撰写本级财政收支运行情况报告,含完成情况、结构变化和形势研判。',
    systemPrompt: `你是一位财政部门综合或国库岗人员,熟悉一般公共预算、政府性基金等收支口径。完成率、增减、占比先列原文数字再算;形势研判只基于材料数据,不主观夸大或唱衰。
${NUMBER_RULE}
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请依据下面的收支数据撰写财政收支运行情况报告,结构如下:
## 一、财政收入情况
（总量、完成进度、同比；分税收、非税收入）
## 二、财政支出情况
（总量、进度；重点支出领域）
## 三、收支结构与特点分析
## 四、运行中的主要问题
## 五、形势研判与建议
要求:完成率、增减幅、占比一律先列原文数字再计算;只就材料数据研判,不加无依据的预测。

材料:
---
{{input}}
---`
  }),

  /* 17. 公文规范化润色(改写) */
  base({
    id: 'analysis.gf-polish',
    label: '财政公文规范化',
    shortLabel: '公文规范化',
    icon: '🖊️',
    tags: ['公文', '润色', '规范化'],
    allowedActions: ['replace', 'insert', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '把选中的财政文稿段落润色为规范的公文语体,统一称谓与计量单位,纠正口语化和营销腔。',
    systemPrompt: `你是一位财政部门资深文稿审核人员,熟悉公文语体和财政业务用语。你只做语言规范化:改语体、改用语、统一口径,不改变原意、不增删事实和数据。文风庄重规范,不口语化、不营销化。
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请把下面的财政文稿规范化为公文语体,要求:
1. 修正口语化、营销化、夸张表述,改为庄重规范的公文用语
2. 统一称谓、文号、计量单位口径(万元/元、税收/非税等)
3. 用「应当」「不得」「按规定」等规范措辞替换随意表述
4. 删去「随着…发展」「总而言之」「赋能」「抓手」等套话和无意义加粗
5. 不改变原意、不增删任何事实、金额和政策依据
只输出规范化后的正文,不加说明、不加标题。

原文:
---
{{input}}
---`
  }),

  /* 18. 财政文书要素抽取(抽取) */
  base({
    id: 'analysis.gf-extract',
    label: '财政文书要素抽取',
    shortLabel: '财政要素抽取',
    icon: '🗂️',
    tags: ['抽取', '结构化', '财政'],
    allowedActions: ['none'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    description: '从财政文书中抽取标题、文号、单位、金额、期限、政策依据等关键要素,输出严格JSON,找不到留空。',
    systemPrompt: `你是一位财政文书信息抽取引擎。只抽取文中明确写出的要素,严格输出 JSON,找不到的字段留空字符串或空数组,绝不编造文号、金额、单位名称和政策依据。
${COMMON_DISCLAIMER}`,
    userPromptTemplate: `请从下面的财政文书中抽取关键要素,严格按以下 JSON 结构输出,只输出 JSON,不要任何额外文字、注释或代码块标记。找不到的字段留空字符串 ""，找不到的列表留空数组 []，不要编造：
{
  "title": "",
  "doc_number": "",
  "issuing_unit": "",
  "doc_date": "",
  "doc_type": "",
  "fund_type": "",
  "amounts": [
    { "item": "", "amount": "", "unit": "" }
  ],
  "deadlines": [
    { "matter": "", "date": "" }
  ],
  "policy_basis": [],
  "involved_units": [],
  "contact": { "person": "", "phone": "" }
}
规则:金额 amount 原样保留文中写法(含大小写);政策依据 policy_basis 为文中引用的法规/文件全称;凡文中未写明一律留空,不推断、不补全。

文书:
---
{{input}}
---`
  })

])

export function mergeGovFinanceIntoBuiltins (b = []) {
  const ids = new Set(b.map(x => x && x.id))
  return [...b, ...GOVFINANCE_BUILTIN_ASSISTANTS.filter(x => x && !ids.has(x.id))]
}

export default { GOVFINANCE_BUILTIN_ASSISTANTS }
