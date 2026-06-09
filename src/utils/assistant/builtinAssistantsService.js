/**
 * builtinAssistantsService — 「客服/沟通」领域助手包(批9,跨行业通用)
 * 生成类默认插入、核查类批注、摘要类批注。约束:只承诺能兑现的,不编造政策;共情而专业。
 */
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'service'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const SERVICE_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.svc-complaint-reply', label: '投诉回复', shortLabel: '投诉回复', icon: '💬',
    tags: ['客服', '生成', '投诉'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '针对客户投诉写专业回复:共情致歉、还原核实、给解决方案、防止升级,真诚不模板。',
    systemPrompt: '你是一位金牌客服,写共情、负责、能化解情绪的投诉回复。只承诺能兑现的,不推诿不打官腔。',
    userPromptTemplate: `请针对下面投诉写回复(2个版本):共情致歉→说明核实情况→具体解决方案与时间→防止再次发生的措施→安抚。\n投诉:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.svc-payment-reminder', label: '催款话术', shortLabel: '催款话术', icon: '💰',
    tags: ['客服', '生成', '催款'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '按欠款阶段(温和提醒/正式催告/最后通牒)写得体催款话术,既要钱又不撕破脸。',
    systemPrompt: '你是一位应收/客户经理,写分阶段、有分寸的催款话术。事实金额照原文,措辞随阶段升级但保持专业。',
    userPromptTemplate: `请按催收阶段写催款话术:① 温和提醒 ② 正式催告 ③ 最后通牒(各一版)。基于给定欠款情况,金额日期照原文,既推进回款又维护关系。\n欠款情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.svc-apology', label: '道歉信', shortLabel: '道歉信', icon: '🙇',
    tags: ['客服', '生成', '道歉'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '就失误写真诚道歉信:承认问题、表达歉意、说明改进、给补救,真诚不甩锅不过度。',
    systemPrompt: '你是一位企业沟通负责人,写真诚、得体、负责任的道歉信。承认问题不狡辩,只承诺能做到的补救。',
    userPromptTemplate: `请就下面情况写道歉信:真诚承认问题→表达歉意→说明原因(不甩锅)→已采取/将采取的改进与补救→重申承诺。\n情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.svc-faq-generate', label: 'FAQ生成', shortLabel: 'FAQ生成', icon: '❓',
    tags: ['客服', '生成', 'FAQ'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '根据产品/政策资料生成常见问题与标准答案,问题贴近真实疑问,答案准确简洁。',
    systemPrompt: '你是一位客服知识库管理员,生成贴近真实疑问的 FAQ。答案只依据给定资料,不编造政策,简洁准确。',
    userPromptTemplate: `请根据下面资料生成 FAQ:列出客户最可能问的问题,每条配标准答案(依据资料、简洁、口径统一)。分类组织。\n资料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.svc-ticket-summary', label: '工单摘要', shortLabel: '工单摘要', icon: '🎫',
    tags: ['客服', '摘要', '工单'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '把冗长的工单对话整理成摘要:问题、已沟通要点、当前状态、待办与责任人。',
    systemPrompt: '你是一位客服主管,把工单对话整理成结构化摘要。只摘实际内容,不臆断未沟通事项。',
    userPromptTemplate: `请把下面工单对话整理成摘要:客户问题、关键沟通节点、当前状态、待办事项与负责人、下一步。\n工单对话:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.svc-soothe-reply', label: '情绪安抚回复', shortLabel: '情绪安抚', icon: '🤝',
    tags: ['客服', '生成', '安抚'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '针对情绪激动的客户写先安抚情绪、再处理问题的回复,降温不激化、不空头承诺。',
    systemPrompt: '你是一位高情商客服,写先接住情绪、再解决问题的回复。共情真实,不敷衍、不空头承诺、不被带节奏。',
    userPromptTemplate: `请针对下面情绪激动的客户写回复:先真诚接住情绪、表达理解→明确会负责处理→给出下一步→稳住关系。不空头承诺。\n客户情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.svc-refund-reply', label: '退款回复', shortLabel: '退款回复', icon: '↩️',
    tags: ['客服', '生成', '退款'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '针对退款诉求写回复:依据政策说明可否退、流程与到账时间、不能退时给替代方案。',
    systemPrompt: '你是一位客服,写清晰、依政策的退款回复。依据给定政策判断,不随意承诺,能退/不能退都说清理由与替代。',
    userPromptTemplate: `请针对下面退款诉求写回复:依政策说明能否退款及理由→退款流程与到账时间→若不能退给替代方案→安抚。\n诉求(及政策):\n---\n{{input}}\n---` }),
  base({ id: 'analysis.svc-email-formalize', label: '邮件正式化', shortLabel: '邮件正式化', icon: '📧',
    tags: ['客服', '改写', '邮件'], allowedActions: ['replace', 'comment', 'insert', 'none'], defaultAction: 'replace',
    description: '把口语化或随意的内容改写成专业得体的商务邮件,结构清晰、措辞恰当、保留原意。',
    systemPrompt: '你是一位商务沟通顾问,把内容改写成专业得体的商务邮件。保留原意与事实,补全称呼问候落款,措辞恰当不啰嗦。',
    userPromptTemplate: `请把下面内容改写成专业商务邮件:补主题、称呼、问候、正文(结构清晰)、结尾、落款。保留原意,措辞得体。\n{{input}}` }),
  base({ id: 'analysis.svc-cross-dept-email', label: '跨部门协调邮件', shortLabel: '跨部门协调', icon: '🔗',
    tags: ['客服', '生成', '协调'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把协调事项写成跨部门邮件:背景、需要对方配合的事项、时限、影响,推动不甩锅。',
    systemPrompt: '你是一位项目协调人,写清晰、推动力强、不甩锅的跨部门协调邮件。事项具体、责任清楚、措辞合作。',
    userPromptTemplate: `请把下面协调事项写成跨部门邮件:背景与目标、需对方配合的具体事项、所需时限、不配合的影响、表达协作态度。\n协调事项:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.svc-followup-call', label: '客户回访话术', shortLabel: '客户回访', icon: '📞',
    tags: ['客服', '生成', '回访'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '生成客户回访话术:开场、了解使用/满意度、收集反馈、引导复购或转介,自然不推销。',
    systemPrompt: '你是一位客户成功,写自然、不让人反感的回访话术。以关心和收集反馈为主,引导转化要克制。',
    userPromptTemplate: `请生成客户回访话术:开场(自然)、了解使用情况与满意度、收集问题与建议、(适度)引导复购/转介绍、礼貌收尾。\n回访场景:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.svc-script-compliance', label: '服务话术合规检查', shortLabel: '话术合规检查', icon: '🚧',
    tags: ['客服', '核查', '合规'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.15,
    description: '检查客服话术是否有违规承诺、夸大、误导、不当措辞或服务禁语,逐字定位给替代。',
    systemPrompt: '你是一位客服质检,检查话术合规与服务规范。命中片段原文逐字、反引号包裹;只标确有问题处。',
    userPromptTemplate: `请检查下面客服话术,关注:违规承诺(保证/一定)、夸大或误导、服务禁语、不当措辞、未尽告知。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议改为:\n话术:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.svc-survey-generate', label: '满意度问卷生成', shortLabel: '满意度问卷', icon: '📝',
    tags: ['客服', '生成', '问卷'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '根据调研目的生成满意度问卷:量表题、选择题、开放题,题目中立不诱导。',
    systemPrompt: '你是一位用户研究员,设计中立、有效的满意度问卷。题目不诱导、覆盖关键触点、便于统计。',
    userPromptTemplate: `请根据下面调研目的生成满意度问卷:整体满意度量表、分项体验(选择/量表)、NPS推荐意愿、开放建议题。题目中立不诱导,标注题型。\n调研目的:\n---\n{{input}}\n---` })
])

export function mergeServiceIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...SERVICE_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { SERVICE_BUILTIN_ASSISTANTS, mergeServiceIntoBuiltins }
