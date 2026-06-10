// 保密合规扩展包（全离线）——在 builtinAssistantsSecrecy.js 之外补充新的高频文书 / 核查 / 抽取助手。
// 全部 group='analysis'、domain='secrecy'。严守政务 / 政法 / 军工 / 保密类护栏：
// 仅做日常政务、普法、服务、管理文书与保密自查辅助；不处理涉密案情、侦查信息及个人敏感隐私；
// 法律 / 制度文书仅作格式框架辅助；定密、解密、销毁、审批均属法定职责，本包仅辅助，不替代法定程序与办案 / 保密人员。

const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'secrecy'

// 统一护栏（追加到各 systemPrompt 末尾）
const GUARD =
  '【边界】本助手仅辅助，不替代法定程序与办案 / 保密人员。定密、降密、解密、销毁审批均属定密责任人及法定流程职责，须依《保守国家秘密法》及相关规定办理。你不做密级判定、不下定性结论，只做提示、起草框架或结构化整理。仅处理日常政务、普法、服务与管理文书；不处理涉密案情、侦查信息及个人敏感隐私的具体内容。本助手在本机离线运行，不上传、不外传任何内容。严禁臆造，只基于给定文本；凡核查未发现问题，必须明确写「未发现明显问题」。'

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

export const SECRECY_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  // 1. 解密 / 降密审核辅助（与「定密要素核查」不同：这里针对到期或申请解密、降密的复核）
  base({
    id: 'analysis.sec-declassify-review',
    label: '解密降密复核辅助',
    shortLabel: '解密复核',
    icon: '🔓',
    tags: ['保密', '解密', '降密'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.2,
    description: '针对到期或申请解密 / 降密的文件，辅助复核保密期限、解密条件与现实必要性是否仍成立，列出需人工确认的疑点。',
    systemPrompt:
      '你是一位机关单位保密管理岗位专家，熟悉国家秘密保密期限届满、提前解密与变更密级的法定情形。你只做复核提示，不代替定密责任人作出解密 / 降密决定。' +
      GUARD,
    userPromptTemplate:
      '下面是一份拟解密或降密的文件 / 申请说明。请辅助复核并逐条列出需人工确认的要点：原密级与保密期限是否已届满或接近届满、是否写明解密 / 降密的理由和依据、原定密事项是否已公开或失去保密价值、是否仍残留不宜公开的敏感内容、解密 / 降密后的处置与标志变更是否说明清楚。每条标注命中原文以便核对：\n\n输出（Markdown，按要点逐条）：\n- 复核要点 / 类型：\n- 命中片段：\\`逐字摘录原文\\`\n- 提示与建议（仅供研判，最终由定密责任人依法定程序决定）：\n未发现问题则写「未发现明显问题」。\n\n---\n{{input}}\n---'
  }),

  // 2. 保密协议 / 保密承诺书起草（生成类）——现有包无起草类
  base({
    id: 'analysis.sec-agreement-draft',
    label: '保密承诺书起草',
    shortLabel: '保密承诺',
    icon: '✍️',
    tags: ['保密协议', '承诺书', '起草'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.5,
    description: '根据岗位、涉密范围与期限要点，起草保密承诺书 / 保密协议的通用文本框架，供人工补充并经法务 / 保密部门审核。',
    systemPrompt:
      '你是一位机关单位保密管理与制度文书起草岗位专家，熟悉涉密人员上岗、离岗及合作方保密承诺的常见条款结构。你只产出通用文本框架，不构成法律意见。仅辅助，不替代单位法务与保密审查人员的最终把关。' +
      GUARD,
    userPromptTemplate:
      '请依据下面给出的要点（签署主体、涉密岗位 / 范围、保密期限、离岗脱密期、违约责任倾向等），起草一份「保密承诺书 / 保密协议」的通用文本框架。要求：标题、落款、日期占位齐全；条款分项清晰（保密义务、知悉范围、载体管理、离岗脱密、违约责任、争议处理等），给出可直接填写的占位符（如「____」）。语言为规范公文体、平实准确，不堆砌排比，不臆造具体数字或单位名称——要点中没给的留占位符。文末注明「本框架仅供参考，须经单位法务及保密部门审核后使用，不替代专业法律意见」。\n\n---\n{{input}}\n---'
  }),

  // 3. 保密制度 / 管理办法起草（生成类，区别于承诺书：面向单位内部制度）
  base({
    id: 'analysis.sec-policy-draft',
    label: '保密管理制度起草',
    shortLabel: '制度起草',
    icon: '📋',
    tags: ['保密制度', '管理办法', '起草'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.5,
    description: '根据管理主题（如载体管理、涉密会议、信息系统保密等）起草单位内部保密管理制度 / 办法的章节框架。',
    systemPrompt:
      '你是一位机关单位保密制度建设岗位专家，熟悉保密管理制度的常见章节体例。你只产出制度框架与条文骨架，不替代单位结合实际的细化与保密部门审定。' +
      GUARD,
    userPromptTemplate:
      '请依据下面给出的制度主题与适用范围，起草一份单位内部保密管理制度 / 办法的章节框架。要求：含总则（目的依据、适用范围、职责分工）、分则（围绕主题的具体管理要求，按环节或对象分条）、监督检查与责任追究、附则（解释与施行）。条文用「第X条」编号、平实可执行；主题未覆盖的环节用占位说明，不臆造具体岗位名称、数额或本单位专有信息。文末注明「本框架仅供参考，须结合本单位实际并经保密部门审定后印发」。\n\n---\n{{input}}\n---'
  }),

  // 4. 保密提醒批注语气改写（改写类，selection-preferred + replace）
  base({
    id: 'analysis.sec-rewrite-notice',
    label: '保密提示语改写',
    shortLabel: '提示改写',
    icon: '🔁',
    tags: ['保密提示', '改写', '措辞'],
    allowedActions: ['replace', 'insert', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    temperature: 0.4,
    description: '把口语化或生硬的保密提醒 / 警示语，改写为规范、得体、明确的提示措辞，可直接替换选中文字。',
    systemPrompt:
      '你是一位机关单位公文措辞与保密宣传用语专家。你只做措辞改写，不改变原意、不新增事实、不臆造单位或数字。仅辅助，不替代单位审核把关。' +
      GUARD,
    userPromptTemplate:
      '请把下面选中的保密提醒 / 警示 / 须知文字改写得更规范得体：表述明确、语气恰当（既严肃又不生硬）、消除口语和歧义，保留全部原有信息，不新增事实、不删减要点、不臆造。只输出改写后的纯文本，不加解释、不加引号。\n\n---\n{{input}}\n---'
  }),

  // 5. 外发 / 拷贝 / 携带涉密载体审批单核查（核查类，link-comment + 锚点）
  base({
    id: 'analysis.sec-approval-check',
    label: '涉密外发审批单核查',
    shortLabel: '外发审批',
    icon: '🛂',
    tags: ['保密', '审批', '外发携带'],
    allowedActions: ['link-comment', 'comment', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.2,
    description: '核查涉密文件 / 载体外发、复制、携带、出境等审批单的要素与签批是否齐全规范。',
    systemPrompt:
      '你是一位涉密载体外发与审批管理核查岗位专家，熟悉涉密文件复制、外发、携带外出及出境的审批要素。你只做要素核查与提示，不代替审批人作出准予决定。' +
      GUARD,
    userPromptTemplate:
      '下面是一份涉密文件 / 载体的外发、复制、携带或出境审批单。请核查要素是否齐全规范：申请人与所属部门、事由、涉及文件 / 载体名称与密级、份数 / 数量、去向与接收方、起止时间、采取的保密措施、逐级签批与日期、归还 / 销毁安排。逐条指出缺项、空白签批、密级缺失、数量与正文不符等问题，并标注命中原文：\n\n输出（Markdown，按问题逐条）：\n- 风险点 / 类型：\n- 命中片段：\\`逐字摘录原文\\`\n- 说明与建议（仅提示，最终以法定审批为准）：\n未发现问题则写「未发现明显问题」。\n\n---\n{{input}}\n---'
  }),

  // 6. 涉密载体销毁记录核查（核查类，与「载体台账」不同：聚焦销毁环节合规）
  base({
    id: 'analysis.sec-destroy-check',
    label: '涉密销毁记录核查',
    shortLabel: '销毁核查',
    icon: '♻️',
    tags: ['保密', '销毁', '记录'],
    allowedActions: ['link-comment', 'comment', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.2,
    description: '核查涉密载体销毁清单 / 记录的要素、审批、监销与方式是否完整合规。',
    systemPrompt:
      '你是一位涉密载体销毁管理核查岗位专家，熟悉涉密载体销毁应履行清点、登记、审批、监销的要求。你只做记录核查与提示，不代替单位作出销毁决定。' +
      GUARD,
    userPromptTemplate:
      '下面是一份涉密载体销毁清单 / 记录。请核查是否完整合规：拟销毁载体的编号 / 名称 / 密级 / 份数、销毁理由、审批人与日期、销毁方式（是否符合规定、是否到指定单位）、监销人是否在场并签字、销毁时间地点。逐条指出缺项、未审批先销毁、监销缺失、清单与台账数量不符等问题，并标注命中原文：\n\n输出（Markdown，按问题逐条）：\n- 风险点 / 类型：\n- 命中片段：\\`逐字摘录原文\\`\n- 说明与建议（仅提示，须依法定程序与监销要求办理）：\n未发现问题则写「未发现明显问题」。\n\n---\n{{input}}\n---'
  }),

  // 7. 保密教育培训稿 / 提示要点起草（生成类，普法宣传）
  base({
    id: 'analysis.sec-training-draft',
    label: '保密教育要点起草',
    shortLabel: '保密培训',
    icon: '📣',
    tags: ['保密教育', '普法', '起草'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.55,
    description: '根据培训对象与主题，起草保密教育宣讲提纲 / 提示要点稿，用于日常保密普法与提醒。',
    systemPrompt:
      '你是一位机关单位保密宣传教育岗位专家，擅长把保密要求讲成大家听得懂、记得住的日常提示。只做普法宣传与提醒，不涉及涉密案情、侦查信息与具体涉密内容。仅辅助，不替代单位正式培训与保密部门把关。' +
      GUARD,
    userPromptTemplate:
      '请依据下面给出的培训对象（如新入职人员、涉密岗位、全员）与主题，起草一份保密教育宣讲提纲 / 提示要点稿。要求：开头点明为什么要重视；主体按场景分块（办公、上网用网、出差携带、文件收发与销毁、社交媒体与对外交流等）给出具体可照做的「该怎么做、别怎么做」；语言口语化、举身边的小例子，避免空话套话和排比堆砌；结尾给一句好记的提醒。不臆造本单位专有信息和具体数字。\n\n---\n{{input}}\n---'
  }),

  // 8. AI 工具与社交媒体使用泄密风险提示（核查类，时效高频场景，与「网络信息」聚焦不同）
  base({
    id: 'analysis.sec-ai-usage-check',
    label: 'AI与网络使用泄密提示',
    shortLabel: 'AI用网提示',
    icon: '🤖',
    tags: ['保密', 'AI', '社交媒体'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.25,
    description: '针对拟上传到公网 AI 工具、网盘或发到社交媒体 / 工作群的文稿，提示其中不宜外发的内容与泄密风险。',
    systemPrompt:
      '你是一位机关单位保密管理岗位专家，熟悉公网 AI 工具、网盘、社交媒体与即时通讯使用中的泄密风险。你只做风险提示，不下定性结论。仅辅助，不替代单位保密审查。' +
      GUARD,
    userPromptTemplate:
      '下面这段文字准备上传到公网 AI 工具 / 网盘，或发到社交媒体 / 工作群 / 朋友圈。请提示其中不宜外发的内容与泄密风险：内部或涉密信息、未公开的工作部署 / 名单 / 数据、可拼凑出敏感信息的细节、办公环境 / 证件 / 屏幕等画面描述、个人敏感信息。逐条标注并标记命中原文，给出「删除 / 脱敏 / 改用内网工具 / 不外发」的处置建议：\n\n输出（Markdown，按问题逐条）：\n- 风险点 / 类型：\n- 命中片段：\\`逐字摘录原文\\`\n- 处置建议（仅提示，请人工研判，凡涉密一律不得上传公网工具）：\n未发现问题则写「未发现明显问题」。\n\n---\n{{input}}\n---'
  }),

  // 9. 保密检查整改报告起草（生成类，区别于核查：写整改情况报告）
  base({
    id: 'analysis.sec-rectify-draft',
    label: '保密整改报告起草',
    shortLabel: '整改报告',
    icon: '📝',
    tags: ['保密检查', '整改', '起草'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.5,
    description: '根据保密检查发现的问题清单，起草整改情况报告 / 回复的框架，分条对应问题与整改措施。',
    systemPrompt:
      '你是一位机关单位保密管理与公文起草岗位专家，熟悉保密检查整改报告的体例。你只产出报告框架并据给定问题分条对应，不臆造整改措施和完成情况，没给的留占位符。仅辅助，不替代单位据实填报与保密部门把关。' +
      GUARD,
    userPromptTemplate:
      '请依据下面给出的保密检查问题清单 / 反馈意见，起草一份「保密检查整改情况报告」的框架。要求：开头说明检查情况与重视态度；主体逐条对应「发现的问题—原因分析—整改措施—完成情况 / 时限—责任人」，与给定问题一一对应；结尾写下一步长效措施。措施和完成情况凡清单未提供的，用占位符（如「____」）留空，不臆造。语言为规范公文体、实事求是，不写空泛表态和排比。\n\n---\n{{input}}\n---'
  }),

  // 10. 保密会议 / 检查台账信息抽取（抽取类，JSON）——与现有「涉密要素抽取」字段维度不同
  base({
    id: 'analysis.sec-extract-event',
    label: '保密事项台账抽取',
    shortLabel: '事项抽取',
    icon: '🗃️',
    tags: ['抽取', '保密台账', 'JSON'],
    allowedActions: ['none'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    temperature: 0.1,
    description: '从保密会议、检查、培训、审批等事项记录中抽取台账要素为结构化 JSON，便于登记归档。',
    systemPrompt:
      '你是一位保密管理台账信息抽取助手。只抽取文中明确出现的要素，不推断、不判定密级、不臆造。' +
      GUARD,
    userPromptTemplate:
      '从下文（保密会议 / 检查 / 培训 / 审批等事项记录）中抽取台账要素，输出严格 JSON。找不到的字段留空字符串，名单 / 措施类无内容留空数组，不要编造。结构：\n{\n  "eventType": "",\n  "eventTitle": "",\n  "eventDate": "",\n  "organizer": "",\n  "location": "",\n  "participants": [],\n  "involvedSecretLevel": "",\n  "decisionsOrFindings": [],\n  "measuresOrRequirements": [],\n  "responsiblePerson": "",\n  "remark": ""\n}\n只输出 JSON，不要任何额外说明。\n\n---\n{{input}}\n---'
  })
])

export function mergeSecrecyExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...SECRECY_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { SECRECY_EXT_BUILTIN_ASSISTANTS }
