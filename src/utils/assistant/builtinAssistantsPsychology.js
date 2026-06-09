/**
 * builtinAssistantsPsychology — 「心理咨询」领域助手包(批14·手写补)
 * 全部带免责:仅辅助,不替代专业心理诊疗与危机处置。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'psychology'
const DIS = '重要:本助手仅作信息整理/科普/沟通辅助,不替代执业心理咨询师/精神科医生的评估、诊断与治疗;不下临床诊断,涉及危机一律提示寻求专业与紧急帮助。'
const base = (extra) => ({
  group:'analysis', domain:DOMAIN, modelType:'chat', defaultModelCategory:'chat',
  supportsRibbon:false, defaultDisplayLocations:['ribbon-more'],
  defaultInputSource:INPUT_SOURCE_DOCUMENT, defaultOutputFormat:'markdown', temperature:0.4, ...extra
})
export const PSYCHOLOGY_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id:'analysis.psy-session-note', label:'咨询记录整理', shortLabel:'咨询记录整理', icon:'🗒️',
    tags:['心理','整理','记录'], allowedActions:['comment','append','insert','none'], defaultAction:'comment', temperature:0.2,
    description:'把咨询过程整理成规范记录:主诉、过程、观察、议题与下一步,客观不臆断诊断。',
    systemPrompt:`你是一位心理咨询师,把咨询过程整理成客观记录。只记实际内容,不下诊断、不臆测来访动机。${DIS}`,
    userPromptTemplate:'请把下面咨询过程整理成记录:来访主诉、本次过程要点、观察到的情绪/状态、讨论的议题、达成的共识、下一步计划。客观、不下诊断。\n咨询过程:\n---\n{{input}}\n---' }),
  base({ id:'analysis.psy-science-article', label:'心理科普文章', shortLabel:'心理科普', icon:'📖',
    tags:['心理','生成','科普'], allowedActions:['insert','append','replace','none'], defaultAction:'insert', temperature:0.5,
    description:'把心理学主题写成准确、温和、不贴标签的科普文章,帮助理解不制造焦虑。',
    systemPrompt:`你是一位心理科普作者,写准确、温和、去病耻化的科普。基于可靠常识,不夸大不贴标签、不制造焦虑、不替代就医建议。${DIS}`,
    userPromptTemplate:'请把下面主题写成心理科普文章:用通俗话讲清是什么、常见表现、可以怎么自我调节、何时建议寻求专业帮助。温和不贴标签、不制造焦虑。\n主题:\n---\n{{input}}\n---' }),
  base({ id:'analysis.psy-soothe-script', label:'情绪疏导话术', shortLabel:'情绪疏导', icon:'🤝',
    tags:['心理','生成','疏导'], allowedActions:['insert','append','none'], defaultAction:'insert', temperature:0.4,
    description:'针对情绪困扰场景,生成共情、不评判、引导表达的疏导话术,先接住情绪再陪伴。',
    systemPrompt:`你是一位助人工作者,写共情、不评判、以来访为中心的疏导话术。不说教、不急于解决、不替来访做决定,必要时引导寻求专业帮助。${DIS}`,
    userPromptTemplate:'请针对下面情绪困扰场景,生成疏导话术:先共情接住情绪→不评判地回应→开放式引导表达→陪伴与可选的下一步(必要时建议专业帮助)。\n场景:\n---\n{{input}}\n---' }),
  base({ id:'analysis.psy-case-conceptualization', label:'个案概念化框架', shortLabel:'个案概念化', icon:'🧩',
    tags:['心理','生成','个案'], allowedActions:['comment','append','insert','none'], defaultAction:'comment', temperature:0.3,
    description:'把个案信息整理成概念化框架:呈现问题、可能成因假设、维持因素、资源与目标,作假设非定论。',
    systemPrompt:`你是一位心理咨询师,做个案概念化的整理。基于给定信息提出"假设"而非诊断结论,标明哪些是推测,需在咨询中验证。${DIS}`,
    userPromptTemplate:'请把下面个案信息整理成概念化框架(均为待验证假设,非诊断):呈现问题、发展与成因假设、维持因素、来访资源与优势、可能的咨询目标与方向。\n个案信息:\n---\n{{input}}\n---' }),
  base({ id:'analysis.psy-consent', label:'知情同意要点', shortLabel:'知情同意要点', icon:'📝',
    tags:['心理','提取','知情同意'], allowedActions:['comment','append','insert','none'], defaultAction:'comment', temperature:0.2,
    description:'把咨询知情同意整理成易懂要点:保密与例外、设置与费用、权利、风险与转介,便于沟通。',
    systemPrompt:`你是一位心理咨询伦理顾问,把知情同意整理成易懂要点。忠于给定内容,保密例外与转介如实说明,不增减。${DIS}`,
    userPromptTemplate:'请把下面知情同意整理成要点:咨询性质与方式、保密原则与例外(危及安全/法律要求)、设置(频率/时长/费用/请假)、来访权利、风险与局限、转介与紧急处理。\n知情同意内容:\n---\n{{input}}\n---' }),
  base({ id:'analysis.psy-assessment-explain', label:'测评结果说明', shortLabel:'测评说明', icon:'📊',
    tags:['心理','生成','测评'], allowedActions:['comment','append','insert','none'], defaultAction:'comment', temperature:0.3,
    description:'把心理测评结果用通俗、审慎的方式说明含义与局限,强调非诊断、需结合专业解读。',
    systemPrompt:`你是一位心理测评解读助手,通俗审慎地说明结果。数值照原文,强调量表非诊断、有局限,需结合专业面谈解读,不贴标签。${DIS}`,
    userPromptTemplate:'请把下面测评结果通俗说明:各维度大致反映什么、分数的一般含义(照原文)、需注意的局限(量表非诊断、受状态影响)、建议结合专业解读。不贴标签不下诊断。\n测评结果:\n---\n{{input}}\n---' }),
  base({ id:'analysis.psy-group-activity', label:'团体活动方案', shortLabel:'团体活动', icon:'👥',
    tags:['心理','生成','团体'], allowedActions:['insert','append','none'], defaultAction:'insert', temperature:0.4,
    description:'设计心理团体/工作坊活动方案:目标、暖场、主体活动、分享、收束与注意事项。',
    systemPrompt:`你是一位团体带领者,设计安全、有结构的团体活动。基于给定主题,活动循序渐进、关注安全与知情,不强迫暴露。${DIS}`,
    userPromptTemplate:'请根据下面主题设计团体活动方案:活动目标、适用对象与人数、暖场、主体活动(步骤与时长)、分享与整合、收束、带领注意事项(安全与边界)。\n主题:\n---\n{{input}}\n---' }),
  base({ id:'analysis.psy-referral', label:'转介绍说明', shortLabel:'转介绍说明', icon:'🔁',
    tags:['心理','生成','转介'], allowedActions:['insert','append','comment','none'], defaultAction:'comment', temperature:0.3,
    description:'把转介情况整理成说明:转介原因、来访情况摘要(经同意)、建议的资源方向与衔接。',
    systemPrompt:`你是一位心理咨询师,整理得体的转介说明。只在来访知情同意范围内陈述,客观、保护隐私,不下诊断结论。${DIS}`,
    userPromptTemplate:'请把下面情况整理成转介说明:转介原因、来访基本情况摘要(限知情同意范围)、已做的工作、建议的资源/方向、衔接与注意事项。保护隐私、不下诊断。\n情况:\n---\n{{input}}\n---' }),
  base({ id:'analysis.psy-crisis', label:'危机干预提示', shortLabel:'危机干预提示', icon:'🆘',
    tags:['心理','核查','危机'], allowedActions:['comment','append','none'], defaultAction:'comment', temperature:0.2,
    description:'从描述中识别需警惕的危机信号并提示应对方向与求助资源,务必导向专业与紧急帮助。',
    systemPrompt:`你是一位危机干预辅助,识别危机信号并提示求助方向。绝不替代专业危机处置;只要涉及自伤/伤人/危及安全,一律强烈建议立即联系专业机构/紧急热线/急诊。${DIS}`,
    userPromptTemplate:'请从下面描述识别需警惕的危机信号(自伤/自杀意念、伤人、严重失控等),并给应对方向:\n## 需警惕的信号\n## 即时应对建议(保持陪伴/移除危险物/不独处)\n## 求助资源(强烈建议立即联系专业机构、心理援助热线、急诊;具体号码以当地为准)\n（本助手不替代专业危机处置）\n描述:\n---\n{{input}}\n---' }),
  base({ id:'analysis.psy-selfhelp', label:'自助练习指引', shortLabel:'自助练习', icon:'🧘',
    tags:['心理','生成','自助'], allowedActions:['insert','append','none'], defaultAction:'insert', temperature:0.4,
    description:'把调节方法整理成可操作的自助练习指引(呼吸/正念/情绪记录等),温和、循序渐进。',
    systemPrompt:`你是一位心理自助内容作者,写安全、可操作的自助练习。基于通用循证方法,温和不承诺疗效,提示不适时停止并求助。${DIS}`,
    userPromptTemplate:'请把下面调节主题整理成自助练习指引:适用情境、练习步骤(具体可做)、每日/每次建议、注意事项(不适即停)、何时建议寻求专业帮助。\n调节主题:\n---\n{{input}}\n---' }),
  base({ id:'analysis.psy-followup', label:'随访整理', shortLabel:'随访整理', icon:'📅',
    tags:['心理','整理','随访'], allowedActions:['comment','append','insert','none'], defaultAction:'comment', temperature:0.2,
    description:'把随访情况整理成记录:近况、变化、坚持的练习、新议题与下一步,客观陪伴视角。',
    systemPrompt:`你是一位心理咨询师,整理随访记录。只记给定内容,客观陪伴、不下诊断、不臆测。${DIS}`,
    userPromptTemplate:'请把下面随访情况整理成记录:来访近况、相比上次的变化、坚持的练习/作业、新出现的议题、下一步计划与提醒。客观不下诊断。\n随访情况:\n---\n{{input}}\n---' }),
  base({ id:'analysis.psy-ethics', label:'伦理合规提示', shortLabel:'伦理提示', icon:'⚖️',
    tags:['心理','核查','伦理'], allowedActions:['comment','link-comment','append','none'], defaultAction:'comment', temperature:0.2,
    description:'从咨询情境中提示可能的伦理风险点(双重关系、保密、边界、胜任力等)与处理方向。',
    systemPrompt:`你是一位心理咨询伦理顾问,提示伦理风险点。命中片段原文逐字、反引号包裹;只提示风险与原则方向,具体处置建议咨询督导/伦理委员会。${DIS}`,
    userPromptTemplate:'请从下面咨询情境提示伦理风险点,关注:保密与例外、双重/多重关系、专业边界、胜任力范围、知情同意、利益冲突。\n## 伦理关注 (若无写"未见明显伦理风险")\n- 命中片段:`原文逐字片段`\n- 风险点与原则:\n- 建议(可咨询督导/伦理委员会):\n咨询情境:\n---\n{{input}}\n---' })
])
export function mergePsychologyIntoBuiltins(base=[]){const ids=new Set(base.map(x=>x&&x.id));return [...base,...PSYCHOLOGY_BUILTIN_ASSISTANTS.filter(x=>x&&!ids.has(x.id))]}
export default { PSYCHOLOGY_BUILTIN_ASSISTANTS, mergePsychologyIntoBuiltins }
