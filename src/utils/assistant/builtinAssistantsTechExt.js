/**
 * builtinAssistantsTechExt — 「IT/技术文档」领域扩展助手包
 * 在 builtinAssistantsTech.js 之外补充高频、互不重复的文书/核查/抽取助手。
 * 生成类默认插入、改写类替换、核查类批注、抽取类 JSON。
 * 约束:保持代码/标识符/版本号/路径原样,不臆造 API/参数/字段,数字先列原文再算。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'tech'
const GEN_RULES = `保持代码、标识符、路径、版本号、命令、配置键原样不改;不臆造不存在的 API/参数/字段/命令;只用给定信息,缺失处标【待补充】,不编造数据;术语用业界通用写法;中文标点;直接输出结果,不写开场白和总结套话。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const TECH_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.tech-runbook', label: '运维操作手册(Runbook)生成', shortLabel: '运维手册', icon: '🛠️',
    tags: ['技术', '生成', '运维'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert',
    description: '把运维/部署/故障处理流程整理成可照着执行的 Runbook:触发条件、前置检查、分步命令、回滚、验证。',
    systemPrompt: `你是一位 SRE/运维工程师,写值班同事能照着一步步执行的操作手册。每一步要可执行、可验证。命令/路径/服务名原样,缺失环节标【待补充】。${GEN_RULES}`,
    userPromptTemplate: `请把下面运维流程整理成 Runbook,包含:适用场景与触发条件、前置检查(环境/权限/备份)、操作步骤(编号,每步含命令和该步的验证方法)、出错时的回滚步骤、完成后的整体验证。命令逐字保留。\n流程:\n---\n{{input}}\n---` }),

  base({
    id: 'analysis.tech-postmortem', label: '故障复盘报告(Postmortem)', shortLabel: '故障复盘', icon: '🔥',
    tags: ['技术', '生成', '复盘'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把事故经过整理成无指责复盘:影响范围、时间线、根因、止血与恢复、改进项,只陈述事实不归咎个人。',
    systemPrompt: `你是一位负责事故复盘的技术负责人,写无指责(blameless)复盘报告,对事不对人。时间点、影响数据只用给定信息,不臆测根因则写"待进一步分析"。${GEN_RULES}`,
    userPromptTemplate: `请把下面事故信息整理成无指责复盘报告:一句话摘要、影响范围(受影响服务/用户/时长)、时间线(按时间编号:发生→发现→定位→止血→恢复)、直接原因、根本原因、做得好的地方、改进项(每条含负责方向与优先级)。数字先引用原文再说明。\n事故信息:\n---\n{{input}}\n---` }),

  base({
    id: 'analysis.tech-user-guide', label: '功能使用指南生成', shortLabel: '使用指南', icon: '📖',
    tags: ['技术', '生成', '文档'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert',
    description: '把功能说明改写成面向终端用户的操作指南:能做什么、怎么用、分步操作、常见问题,不用开发黑话。',
    systemPrompt: `你是一位面向终端用户的技术写作者,把功能讲成普通用户看得懂的操作步骤。少用术语,必须用时先解释一句。只依据给定功能,不臆造按钮和入口。${GEN_RULES}`,
    userPromptTemplate: `请把下面功能信息写成用户使用指南:这个功能能帮你做什么、开始前需要准备什么、操作步骤(编号,写清在哪点什么)、常见问题与解决。语言面向不懂技术的用户,入口和按钮名只用给定信息。\n功能信息:\n---\n{{input}}\n---` }),

  base({
    id: 'analysis.tech-cn-polish', label: '技术写作中文润色', shortLabel: '中文润色', icon: '✍️',
    tags: ['技术', '改写', '润色'], allowedActions: ['replace', 'insert', 'none'], defaultAction: 'replace',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.3,
    description: '把生硬或机翻味的技术文字改顺,保留技术含义和代码/标识符,去掉翻译腔和冗余,不改事实。',
    systemPrompt: `你是一位中文技术编辑,把技术文字改得自然、准确、好读。只改表达不改技术含义;代码、标识符、命令、版本号、专有名词原样保留;不增删事实,不加营销词。${GEN_RULES}`,
    userPromptTemplate: `请润色下面技术文字:去掉翻译腔和啰嗦,长句拆短,被动改主动,统一中英文之间空格;技术含义、代码、标识符、数字一字不改。只输出润色后的文字。\n原文:\n---\n{{input}}\n---` }),

  base({
    id: 'analysis.tech-security-review', label: '代码安全隐患核查', shortLabel: '安全核查', icon: '🔐',
    tags: ['技术', '核查', '安全'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    temperature: 0.2,
    description: '审查代码/配置中常见安全隐患:硬编码密钥、SQL 拼接、命令注入、未校验输入、越权,逐处定位原文。',
    systemPrompt: `你是一位应用安全(AppSec)工程师,审查代码与配置中的安全隐患。命中片段必须是原文逐字、反引号包裹;只标真有依据的问题,拿不准的写"疑似"并说明判断条件。本助手仅辅助排查,不替代专业安全评估。${GEN_RULES}`,
    userPromptTemplate: `请审查下面代码/配置的安全隐患,关注:硬编码密钥/口令/Token、SQL 字符串拼接、命令/路径拼接执行、用户输入未校验、敏感信息打日志、明显越权或缺鉴权。\n## 隐患项(若无写"未发现明显隐患")\n- 命中片段:\`原文逐字片段\`\n- 隐患类型与说明:\n- 修复方向:\n仅辅助排查,不替代专业安全人员。\n代码/配置:\n---\n{{input}}\n---` }),

  base({
    id: 'analysis.tech-config-review', label: '配置文件核查', shortLabel: '配置核查', icon: '⚙️',
    tags: ['技术', '核查', '配置'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    temperature: 0.2,
    description: '核查 yaml/json/env 等配置:疑似笔误的键、危险默认值、生产不该开的开关、明文密钥,逐项定位原文。',
    systemPrompt: `你是一位平台/运维工程师,核查配置文件的问题。命中片段原文逐字、反引号包裹;只标确有问题或明显高风险项,不臆断业务期望值,拿不准写"建议确认"。${GEN_RULES}`,
    userPromptTemplate: `请核查下面配置文件,关注:疑似拼错的配置键、明文密钥/口令、调试/不安全开关在生产开启(如 debug=true、关闭 TLS 校验)、超时/连接数等明显不合理的值、缺失的必填项。\n## 问题项(若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题与风险:\n- 建议:\n配置:\n---\n{{input}}\n---` }),

  base({
    id: 'analysis.tech-doc-code-consistency', label: '文档与代码一致性核查', shortLabel: '文档对照', icon: '🔍',
    tags: ['技术', '核查', '一致性'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    temperature: 0.1,
    description: '核查同一文档内说明文字与示例代码/接口签名是否对得上:参数名、默认值、返回字段、命令是否打架。',
    systemPrompt: `你是一位技术文档审校员,只核查给定文本内部说明与示例是否自相矛盾。命中片段原文逐字、反引号包裹;只标文内能对照出的矛盾,不引入外部知识判断对错。${GEN_RULES}`,
    userPromptTemplate: `请核查下面文档内"说明文字"与"示例代码/接口签名"是否一致,关注:正文写的参数名/默认值与代码示例不符、说明的返回字段示例里没有、命令参数文字与示例命令不符、版本号前后不一致。\n## 不一致项(若无写"未发现明显矛盾")\n- 正文处:\`原文逐字片段\`\n- 示例处:\`原文逐字片段\`\n- 矛盾点:\n文档:\n---\n{{input}}\n---` }),

  base({
    id: 'analysis.tech-extract-deps', label: '依赖与版本抽取', shortLabel: '依赖抽取', icon: '📦',
    tags: ['技术', '抽取', '依赖'], allowedActions: ['none'], defaultAction: 'none',
    defaultOutputFormat: 'json', temperature: 0.1,
    description: '从依赖清单/安装文档抽取每个依赖的名称、版本约束、用途、来源,结构化为 JSON,找不到留空不编造。',
    systemPrompt: `你是一位构建/依赖管理工程师,从文本中抽取依赖信息并输出 JSON。包名、版本号逐字照抄,找不到的字段留空字符串,绝不编造版本或用途。只输出 JSON,不加说明文字。`,
    userPromptTemplate: `请从下面内容抽取依赖信息,输出 JSON(找不到的字段留空字符串,不编造):\n{\n  "dependencies": [\n    { "name": "包名", "version": "版本约束如 ^1.2.0", "scope": "运行时/开发/可选", "purpose": "用途说明", "source": "来源如 npm/pypi/maven" }\n  ]\n}\n内容:\n---\n{{input}}\n---` }),

  base({
    id: 'analysis.tech-extract-endpoints', label: '接口清单抽取', shortLabel: '接口抽取', icon: '🧩',
    tags: ['技术', '抽取', 'API'], allowedActions: ['none'], defaultAction: 'none',
    defaultOutputFormat: 'json', temperature: 0.1,
    description: '从代码/文档中抽取已声明的 HTTP 接口:方法、路径、用途、鉴权、关键参数,结构化为 JSON,不臆造接口。',
    systemPrompt: `你是一位接口梳理工程师,从文本中抽取确实声明的 HTTP 接口并输出 JSON。方法、路径逐字照抄,只抽文中真实出现的接口,推断不出的字段留空字符串,绝不臆造路径或参数。只输出 JSON。`,
    userPromptTemplate: `请从下面内容抽取 HTTP 接口清单,输出 JSON(只抽真实出现的接口,找不到的字段留空字符串,不编造):\n{\n  "endpoints": [\n    { "method": "GET/POST等", "path": "/api/...", "summary": "用途", "auth": "是否需鉴权/留空", "params": "关键参数,逗号分隔/留空" }\n  ]\n}\n内容:\n---\n{{input}}\n---` }),

  base({
    id: 'analysis.tech-extract-action-items', label: '技术评审待办抽取', shortLabel: '待办抽取', icon: '✅',
    tags: ['技术', '抽取', '协作'], allowedActions: ['none'], defaultAction: 'none',
    defaultOutputFormat: 'json', temperature: 0.1,
    description: '从评审纪要/讨论记录中抽取待办、决议、遗留问题,带负责人与优先级,结构化为 JSON,不编造责任人。',
    systemPrompt: `你是一位技术项目协调人,从会议/评审记录中抽取行动项并输出 JSON。负责人、截止时间只在文中明确出现时填写,否则留空字符串,绝不替人指派。只输出 JSON。`,
    userPromptTemplate: `请从下面评审/讨论记录抽取信息,输出 JSON(文中没明说的字段留空字符串,不编造负责人和时间):\n{\n  "action_items": [\n    { "task": "待办内容", "owner": "负责人/留空", "due": "截止/留空", "priority": "高/中/低/留空" }\n  ],\n  "decisions": ["已达成的决议"],\n  "open_questions": ["尚未解决的遗留问题"]\n}\n记录:\n---\n{{input}}\n---` })
])

export function mergeTechExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...TECH_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { TECH_EXT_BUILTIN_ASSISTANTS, mergeTechExtIntoBuiltins }
