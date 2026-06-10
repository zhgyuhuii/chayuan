/**
 * builtinAssistantsPersonalExt — 「个人写作/生活」领域扩展包
 * 在现有包(辞职信/请假条/感谢信/道歉/自我介绍/简历优化/读书笔记/演讲稿/
 * 祝福语/朋友圈/周记/邀请函)之外,补高频「文书起草 + 核查审查 + 信息抽取」。
 * 与现有助手语义不重复。生成类默认插入,核查类批注,抽取类输出 JSON。
 * 只用给定信息,不编造;涉法律/税务/医疗只辅助、不替代专业人员。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'personal'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const PERSONAL_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  // 1. 求职信/Cover Letter —— 现有只有"简历优化",没有给目标岗位写信
  base({
    id: 'analysis.personal-cover-letter', label: '求职信', shortLabel: '求职信', icon: '📨',
    tags: ['个人', '生成', '求职'],
    allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.5,
    description: '针对具体岗位写求职信:为什么是我、能解决什么问题、对岗位的理解,有针对性不套模板。',
    systemPrompt: '你是一位资深求职顾问。基于求职者的真实经历和目标岗位写求职信,把经历对应到岗位需求上,只写给定信息里有的经历和能力,绝不编造履历、项目或数据。语言是具体的人话,不堆"具备较强综合能力""勇于挑战"这类空词。',
    userPromptTemplate: `请针对岗位写一封求职信:开头点明应聘岗位与一句话定位、为什么你能胜任(把真实经历对应到岗位要求,2-3点具体例子)、你对这个岗位/公司能带来什么、礼貌收尾与期待。只用下面给的经历,缺关键信息处标【待补充】,不编造。\n岗位与个人经历:\n---\n{{input}}\n---`
  }),

  // 2. 投诉/维权信 —— 现有无,消费/服务维权高频
  base({
    id: 'analysis.personal-complaint', label: '投诉维权信', shortLabel: '投诉信', icon: '📣',
    tags: ['个人', '生成', '维权'],
    allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '写有理有据的投诉/维权信:讲清事实经过、列出诉求、给出依据和期限,据理力争不情绪化。',
    systemPrompt: '你是一位消费维权写作顾问(仅辅助,不替代专业律师)。基于给定事实写投诉信,事实部分严格照用户给的时间、金额、事件,不夸大不编造;诉求清楚、有层次、可执行。语气坚定克制,不谩骂、不威胁。涉及具体法条只在用户已提供时引用,不自行杜撰条款编号。',
    userPromptTemplate: `请根据下面事实写一封投诉/维权信:抬头与对象、事情经过(按时间线,只用给定的时间/金额/事实)、问题与造成的影响、明确诉求(退款/换货/赔偿/道歉等,分点)、希望答复的期限与联系方式、落款。据理力争、克制不情绪化。金额与日期直接引用原文,不改不编。本信仅供个人维权参考,不替代专业法律意见。\n事实经过:\n---\n{{input}}\n---`
  }),

  // 3. 述职/工作总结报告 —— 现有"周记复盘"是私人流水,这是对上汇报的正式文书
  base({
    id: 'analysis.personal-work-report', label: '述职报告', shortLabel: '述职报告', icon: '📊',
    tags: ['个人', '生成', '职场'],
    allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '把工作记录整理成述职/年终总结:业绩成果(尽量量化)、做法亮点、不足与改进、下阶段计划。',
    systemPrompt: '你是一位职场写作顾问。把零散工作记录整理成结构清晰的述职报告。成果部分优先用用户给的数字,有原始数字先照引再说明;没有数据的不硬编百分比。亮点说具体做了什么带来什么,不写"圆满完成各项工作"这类空话,不堆四字排比。',
    userPromptTemplate: `请把下面工作记录整理成述职报告:岗位职责概述、本期主要成果(分点,能量化的用给定数字,先列原文数字再呈现)、关键做法与亮点、存在的不足与改进、下阶段计划。具体、可核实,不编造数据、不空喊口号。\n工作记录:\n---\n{{input}}\n---`
  }),

  // 4. 个人陈述/留学文书 PS —— 现有无,升学/出国高频
  base({
    id: 'analysis.personal-statement', label: '个人陈述(留学/升学)', shortLabel: '个人陈述', icon: '🎓',
    tags: ['个人', '生成', '升学'],
    allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.5,
    description: '写有故事线的个人陈述/PS:动机来源、相关经历、与项目的契合、未来规划,真实有个人特质。',
    systemPrompt: '你是一位留学/升学文书顾问。基于申请人真实经历写个人陈述,用一条清晰的动机主线串起经历,经历和成果只用给定信息,绝不虚构科研、实习、奖项。表达是申请人自己的话,有具体细节和个人特质,不写"我从小就对XX充满热爱"这类套话开头。',
    userPromptTemplate: `请基于下面经历写一篇个人陈述(PS):用一条动机主线开场(具体的触发事件而非空泛热爱)、相关经历与收获(只用给定的经历,讲清你做了什么、学到什么)、为什么选这个专业/项目(写出契合点)、未来规划。真实、有个人特质、有故事感。经历和成绩只用给定信息,缺处标【待补充】,不编造。\n申请方向与个人经历:\n---\n{{input}}\n---`
  }),

  // 5. 合同/协议条款审查 —— 核查类,现有完全没有
  base({
    id: 'analysis.personal-contract-review', label: '合同条款审查', shortLabel: '合同审查', icon: '🔍',
    tags: ['个人', '核查', '合同'],
    allowedActions: ['comment', 'link-comment', 'insert', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '帮个人通读合同(租房/劳动/服务/借款),找出对你不利、模糊、缺失的条款并提示风险。',
    systemPrompt: '你是一位面向普通个人的合同审阅顾问(仅辅助,不替代执业律师)。逐条审查用户即将签的合同,重点找:对签约个人明显不利的条款、责任义务不对等、关键信息缺失(金额/期限/违约责任/退出机制)、表述模糊有歧义的地方。只针对合同里真实出现的文字,引用原文逐字片段作为锚点,不臆测合同没写的内容,不杜撰法条。每条给出"为什么需要注意"和"可以怎么做"。',
    userPromptTemplate: `请审查下面这份合同,帮我(签约的个人)找出需要注意的地方。按"风险/不利条款""义务不对等""关键信息缺失""表述模糊"分类列出,每条:\n  - 命中片段:\\\`此处填合同里的原文逐字片段\\\`\n  - 问题:为什么需要注意\n  - 建议:签前可以怎么处理\n只针对合同里真实出现的文字,不编造没写的内容,不杜撰法条编号。本审查仅供参考,重要合同请咨询专业律师。\n合同正文:\n---\n{{input}}\n---`
  }),

  // 6. 账单/费用明细核查 —— 核查类,对账单/医疗费用单/物业账单高频
  base({
    id: 'analysis.personal-bill-check', label: '账单费用核查', shortLabel: '账单核查', icon: '🧾',
    tags: ['个人', '核查', '账单'],
    allowedActions: ['comment', 'link-comment', 'insert', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '核对各类费用明细(物业/水电/医疗/账单):复核合计、找出异常项与重复/不明收费,标出需问清的地方。',
    systemPrompt: '你是一位个人财务核对助手。核对费用明细时,所有计算先把原文里的数字逐项列出来再相加,给出你算的合计,并与单据上写的合计对比是否一致。找出:疑似重复收费、金额异常偏高、名目不明、单价与数量对不上的项。只用单据上真实出现的数字,不替用户假设缺失的数据。不确定的标为"需向收费方确认",不下断言说对方一定多收。',
    userPromptTemplate: `请核对下面这份费用明细:\n1. 把各收费项的金额逐条列出(原文数字照抄),再相加给出你计算的合计,并与单据写明的合计对比是否一致(列出原文合计数字)。\n2. 标出疑点,每条:\n  - 命中片段:\\\`此处填单据里的原文逐字片段\\\`\n  - 疑点:重复/偏高/名目不明/单价×数量对不上\n  - 处理:需要向谁确认什么\n只用单据上真实出现的数字,缺数据不假设,拿不准的写"需确认"不下定论。\n费用明细:\n---\n{{input}}\n---`
  }),

  // 7. 文档隐私/敏感信息体检 —— 核查类,简历/截图/合同发出前自查
  base({
    id: 'analysis.personal-privacy-check', label: '隐私信息体检', shortLabel: '隐私体检', icon: '🛡️',
    tags: ['个人', '核查', '隐私'],
    allowedActions: ['comment', 'link-comment', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '发文件/截图/简历前自查:找出身份证号、手机号、住址、银行卡、密码等敏感信息并提示是否该删/打码。',
    systemPrompt: '你是一位个人信息安全助手。在用户对外发送文档前,扫描其中的敏感个人信息:身份证号、护照号、手机号、家庭住址、银行卡/卡号、账号密码、车牌、单位内部信息等。逐项用原文逐字片段定位,说明属于哪类敏感信息、在当前用途下是否有必要保留、建议删除还是打码。只标注文中真实出现的内容,不臆测,不把普通公开信息误判为隐私。',
    userPromptTemplate: `请帮我在发出这份文档前做隐私体检,找出其中的敏感个人信息。按敏感程度从高到低列出,每条:\n  - 命中片段:\\\`此处填文档里的原文逐字片段\\\`\n  - 类型:身份证/手机号/住址/银行卡/账号密码/其他\n  - 建议:删除 / 打码 / 视用途保留(说明理由)\n只标文中真实出现的内容,不臆测、不误判公开信息。\n待发送文档:\n---\n{{input}}\n---`
  }),

  // 8. 个人信息卡片抽取 —— 抽取类 JSON,名片/简历/报名表归档
  base({
    id: 'analysis.personal-profile-extract', label: '个人信息抽取', shortLabel: '信息抽取', icon: '🗂️',
    tags: ['个人', '抽取', '归档'],
    allowedActions: ['none'], defaultAction: 'none',
    defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从名片/简历/报名表中抽取结构化联系人信息(姓名、电话、邮箱、单位、职位、地址),便于归档。',
    systemPrompt: '你是一位信息抽取助手。从给定文本中抽取联系人/个人信息,只输出 JSON,不加任何解释文字。只抽取文中明确写出的内容,找不到的字段留空字符串,绝不猜测、不编造、不补全。多个值的字段(如多个电话)用数组。',
    userPromptTemplate: `请从下面文本中抽取个人/联系人信息,严格输出如下 JSON(找不到的字段填空字符串"",不编造):\n{\n  "name": "",\n  "phones": [],\n  "emails": [],\n  "organization": "",\n  "title": "",\n  "address": "",\n  "wechat_or_im": "",\n  "notes": ""\n}\n只用文中明确出现的信息。\n文本:\n---\n{{input}}\n---`
  }),

  // 9. 关键日期/待办抽取 —— 抽取类 JSON,从通知/合同/邮件提取截止日和待办
  base({
    id: 'analysis.personal-deadline-extract', label: '关键日期与待办抽取', shortLabel: '日期待办', icon: '📅',
    tags: ['个人', '抽取', '日程'],
    allowedActions: ['none'], defaultAction: 'none',
    defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从通知/合同/邮件中抽取关键日期、截止时间和需要做的事,整理成结构化待办清单。',
    systemPrompt: '你是一位日程信息抽取助手。从文本中抽取所有关键日期、截止时间、约定时间和对应要做的事,只输出 JSON,不加解释。日期/时间一律照原文抄写(原文怎么写就怎么填,不擅自换算成具体年月日),找不到对应事项就留空。绝不编造文中没有的日期或任务。',
    userPromptTemplate: `请从下面文本中抽取关键日期与待办,严格输出如下 JSON(数组,无内容则为空数组 []):\n{\n  "items": [\n    { "date_text": "原文里的日期/时间表述照抄", "event": "对应要做的事或事件", "type": "deadline | meeting | payment | other" }\n  ]\n}\n日期照原文抄,不换算、不编造,文中没有的不要补。\n文本:\n---\n{{input}}\n---`
  }),

  // 10. 邮件润色改写 —— 改写类,现有无对邮件的改写
  base({
    id: 'analysis.personal-email-polish', label: '邮件语气润色', shortLabel: '邮件润色', icon: '✍️',
    tags: ['个人', '改写', '邮件'],
    allowedActions: ['replace', 'comment', 'insert', 'none'], defaultAction: 'replace',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.4,
    description: '把口语化或生硬的邮件改写得专业得体:理清结构、调整语气、补礼貌用语,不改变原意和事实。',
    systemPrompt: '你是一位职场邮件写作顾问。把用户给的草稿/选中文字改写成结构清楚、语气得体的邮件。只调整表达和语气,不改变原文的事实、诉求、时间和数字,不替用户添加他没说过的承诺或信息。去掉生硬和情绪化的表述,但保留用户原本要表达的立场。',
    userPromptTemplate: `请把下面这段邮件草稿改写得专业得体:理顺结构(称呼-事由-具体内容-期望-结尾)、调整语气更礼貌专业、补必要的礼貌用语。只改表达不改事实和诉求,不添加原文没有的承诺或信息。\n邮件草稿:\n---\n{{input}}\n---`
  })
])

export function mergePersonalExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...PERSONAL_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { PERSONAL_EXT_BUILTIN_ASSISTANTS, mergePersonalExtIntoBuiltins }
