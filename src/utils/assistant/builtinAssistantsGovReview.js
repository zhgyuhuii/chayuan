// 政务公文规范审查——党政机关公文格式 / 文种 / 行文 / 用语等规范性核查与要素抽取
// 全部 group='analysis'、domain='govreview'。本机离线运行、内容不出网。
// 对标 GB/T 9704（党政机关公文格式）、《党政机关公文处理工作条例》、GB/T 15835（数字用法）。

const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'govreview'

const GUARD =
  '本助手在本机离线运行，不外传任何内容；规范以现行国家标准与正式发布文本为准，引用的政策法规名称、文号、条款请人工复核；仅辅助核查，不替代正式审核与签批人员。严禁臆造，只基于给定文本逐字核查；凡未发现问题，必须明确写「未发现明显问题」。'

const ANCHOR =
  '\n\n输出（Markdown，按问题逐条）：\n- 问题类型：\n- 命中片段：`逐字摘录原文`\n- 规范依据与修改建议：\n未发现问题则写「未发现明显问题」。\n\n---\n{{input}}\n---'

const base = (extra) => ({
  group: 'analysis',
  domain: DOMAIN,
  modelType: 'chat',
  defaultModelCategory: 'chat',
  supportsRibbon: false,
  defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT,
  defaultOutputFormat: 'markdown',
  temperature: 0.2,
  ...extra
})

const chk = (o) =>
  base({ allowedActions: ['link-comment', 'comment', 'none'], defaultAction: 'link-comment', defaultOutputFormat: 'markdown', temperature: 0.15, ...o })
const ext = (o) =>
  base({ allowedActions: ['none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1, ...o })
const gen = (o) =>
  base({ allowedActions: ['insert', 'none'], defaultAction: 'insert', defaultOutputFormat: 'markdown', temperature: 0.3, ...o })

export const GOVREVIEW_BUILTIN_ASSISTANTS = Object.freeze([
  chk({
    id: 'analysis.pd-format-9704',
    label: '公文格式要素核查（GB/T 9704）',
    shortLabel: '格式要素',
    icon: '📋',
    tags: ['公文', '格式', 'GB/T 9704'],
    description: '逐项核查份号、密级、紧急程度、发文字号、签发人、标题、主送、附件、署名、成文日期、抄送、页码等格式要素。',
    systemPrompt: '你是一位党政机关公文格式核查专家，精通 GB/T 9704《党政机关公文格式》。' + GUARD,
    userPromptTemplate:
      '请对照 GB/T 9704 逐项核查这份公文的格式要素是否齐全、规范：份号、密级与保密期限、紧急程度、发文机关标志、发文字号（机关代字〔年份〕序号）、签发人（上行文）、标题（发文机关+事由+文种）、主送机关、正文、附件说明、发文机关署名、成文日期、印章、附注、抄送机关、印发机关与日期、页码。逐条指出缺失或不规范处。' + ANCHOR
  }),
  chk({
    id: 'analysis.pd-doctype-use',
    label: '文种使用规范核查',
    shortLabel: '文种',
    icon: '🗂️',
    tags: ['公文', '文种', '规范'],
    description: '核查是否正确使用 15 种法定公文文种，识别请示与报告混用、一文多事等问题。',
    systemPrompt: '你是一位公文文种使用规范核查专家，熟悉决议、决定、命令、公报、公告、通告、意见、通知、通报、报告、请示、批复、议案、函、纪要 15 种法定文种的适用情形。' + GUARD,
    userPromptTemplate:
      '请核查本文文种使用是否恰当：标题文种与正文内容是否匹配、是否选用了法定文种、是否存在"请示"与"报告"混用、"通知"与"通报"误用、一份请示夹带多事、该用函却用了通知等问题。逐条指出并给出应使用的文种建议。' + ANCHOR
  }),
  chk({
    id: 'analysis.pd-writing-rule',
    label: '行文规则核查',
    shortLabel: '行文规则',
    icon: '🧭',
    tags: ['公文', '行文规则', '规范'],
    description: '核查是否越级行文、多头主送、请示多抬头、应否联合发文等行文规则问题。',
    systemPrompt: '你是一位公文行文规则核查专家，熟悉《党政机关公文处理工作条例》关于行文关系与规则的规定。' + GUARD,
    userPromptTemplate:
      '请核查本文是否符合行文规则：是否越级行文、是否多头主送（尤其请示应主送一个上级机关）、请示是否同时抬送多个机关或同时抄送下级、是否属于应联合发文却单独发文、是否向下级机关请示等。逐条指出问题与依据。' + ANCHOR
  }),
  chk({
    id: 'analysis.pd-wording',
    label: '公文用语规范核查',
    shortLabel: '公文用语',
    icon: '✍️',
    tags: ['公文', '用语', '规范'],
    description: '核查称谓、开头语、结束语、过渡语等是否规范，纠正口语化、生造与不当表述。',
    systemPrompt: '你是一位公文语言规范核查专家，熟悉公文的庄重语体与惯用结构语。' + GUARD,
    userPromptTemplate:
      '请核查本文用语是否规范庄重：称谓是否得体、开头与结束语是否规范（如"现将……通知如下""特此报告""妥否，请批示"）、过渡语是否恰当、是否存在口语化 / 网络语 / 生造词、是否有"赋能、抓手、闭环"等空泛套话、语气是否与文种相符。逐条标注并给出规范表述。' + ANCHOR
  }),
  chk({
    id: 'analysis.pd-number-15835',
    label: '数字与计量用法核查（GB/T 15835）',
    shortLabel: '数字用法',
    icon: '🔢',
    tags: ['公文', '数字用法', 'GB/T 15835'],
    description: '核查公文中数字、年份、序数、统计量、计量单位的用法是否符合规范。',
    systemPrompt: '你是一位文本数字用法核查专家，熟悉 GB/T 15835《出版物上数字用法》在公文中的应用。' + GUARD,
    userPromptTemplate:
      '请核查文中数字与计量用法：年份是否完整不简写（如"2026年"不写"26年"）、统计数值 / 百分比是否用阿拉伯数字、概数与惯用语是否用汉字、序数词与编号是否规范、计量单位是否统一规范、大小写金额是否一致。逐条标注问题片段。' + ANCHOR
  }),
  chk({
    id: 'analysis.pd-leader-order',
    label: '领导职务与排序核查',
    shortLabel: '领导排序',
    icon: '🧑‍💼',
    tags: ['公文', '领导排序', '称谓'],
    description: '核查领导姓名、职务称谓前后是否一致，排序是否规范，有无错漏字（政务高敏感）。',
    systemPrompt: '你是一位公文中领导信息核查专家，深知姓名、职务、排序差错在政务文件中的高度敏感性。' + GUARD,
    userPromptTemplate:
      '请重点核查文中领导 / 人员信息：姓名是否有错字漏字、职务称谓前后是否一致、同一人前后称谓是否统一、领导排序是否规范一致、职务与单位是否匹配。此类差错高度敏感，逐条精确标注命中片段，宁严勿漏。' + ANCHOR
  }),
  chk({
    id: 'analysis.pd-policy-cite',
    label: '政策法规引用核查',
    shortLabel: '引用核查',
    icon: '📜',
    tags: ['公文', '政策引用', '核查'],
    description: '核查文中引用的法规/文件名称、文号、条款表述是否前后一致、格式规范（准确性需人工复核）。',
    systemPrompt: '你是一位公文政策引用核查专家。你不联网，无法核实法规现行有效性，只做文内一致性与格式规范核查，并提示需人工核实之处。' + GUARD,
    userPromptTemplate:
      '请核查文中对法律法规、文件的引用：名称书写是否规范完整（书名号、全称 / 简称一致）、文号格式是否规范、同一文件前后引用是否一致、条款序号引用是否清楚。对无法离线核实现行有效性与准确性的引用，逐条提示「需人工核实文件现行有效性与条款准确性」。' + ANCHOR
  }),
  chk({
    id: 'analysis.pd-punct-format',
    label: '公文标点与排版规范核查',
    shortLabel: '标点排版',
    icon: '🔤',
    tags: ['公文', '标点', '排版'],
    description: '核查标点用法、层次序号（一、（一）、1.、（1））、结构层次是否符合公文规范。',
    systemPrompt: '你是一位公文标点与层次规范核查专家，熟悉公文结构层次序数的规范用法。' + GUARD,
    userPromptTemplate:
      '请核查文本的标点与层次规范：标点是否使用全角中文标点、有无误用 / 缺失、结构层次序号是否按「一、（一）、1.、（1）」规范且不越级套用、序号与标题层级是否一致、是否中英文标点混用。逐条标注问题片段。' + ANCHOR
  }),
  chk({
    id: 'analysis.pd-title-norm',
    label: '公文标题规范核查',
    shortLabel: '标题规范',
    icon: '🏷️',
    tags: ['公文', '标题', '规范'],
    description: '核查标题是否符合「发文机关＋事由＋文种」结构，有无标题过长、文种缺失、标点不当。',
    systemPrompt: '你是一位公文标题规范核查专家，熟悉公文标题"发文机关+关于+事由+文种"的规范结构。' + GUARD,
    userPromptTemplate:
      '请核查本文标题：是否符合「发文机关+关于+事由+文种」结构、文种是否缺失或错误、事由是否准确简明、标题中除法规书名号与必要标点外是否滥用标点、标题是否过长或有歧义。给出规范化的标题修改建议。' + ANCHOR
  }),
  ext({
    id: 'analysis.pd-element-extract',
    label: '公文要素抽取',
    shortLabel: '要素抽取',
    icon: '📑',
    tags: ['公文', '抽取', 'JSON'],
    description: '把公文抽取为结构化字段（机关、文号、标题、主送、事由、落款、日期等），便于归档/录入 OA。',
    systemPrompt: '你是一位公文要素抽取助手，只抽取文中明确出现的内容，不推断、不补全。' + GUARD,
    userPromptTemplate:
      '从下面公文中抽取要素，输出严格 JSON，找不到的留空字符串，不要编造。结构：\n{\n  "issuingOrg": "",\n  "docNumber": "",\n  "title": "",\n  "docType": "",\n  "mainRecipients": "",\n  "ccRecipients": "",\n  "subject": "",\n  "signOff": "",\n  "issueDate": "",\n  "urgency": "",\n  "secretLevel": ""\n}\n只输出 JSON。\n\n---\n{{input}}\n---'
  }),
  ext({
    id: 'analysis.pd-supervise-extract',
    label: '督办事项抽取',
    shortLabel: '督办抽取',
    icon: '📌',
    tags: ['督办', '抽取', 'JSON'],
    description: '从通知/纪要中抽取「任务—责任单位—完成时限—牵头领导」督办清单。',
    systemPrompt: '你是一位督办事项梳理助手，只抽取文中明确交办的事项，不臆造时限与责任单位。' + GUARD,
    userPromptTemplate:
      '从下文中抽取需督办落实的事项，输出严格 JSON 数组，找不到的字段留空，不要编造。结构：\n[\n  { "task": "", "responsibleUnit": "", "deadline": "", "leadPerson": "", "requirement": "" }\n]\n只输出 JSON。\n\n---\n{{input}}\n---'
  }),
  ext({
    id: 'analysis.pd-minutes-decision',
    label: '会议纪要决议抽取',
    shortLabel: '决议抽取',
    icon: '🗳️',
    tags: ['会议纪要', '抽取', 'JSON'],
    description: '从会议纪要中抽取决定事项、分工与时间节点，形成结构化清单。',
    systemPrompt: '你是一位会议纪要决议抽取助手，只抽取明确达成的决定与分工。' + GUARD,
    userPromptTemplate:
      '从下面会议纪要中抽取决定事项，输出严格 JSON 数组，找不到的字段留空，不要编造。结构：\n[\n  { "decision": "", "owner": "", "deadline": "", "note": "" }\n]\n只输出 JSON。\n\n---\n{{input}}\n---'
  }),
  chk({
    id: 'analysis.pd-table-reconcile',
    label: '公文附表数字勾稽核查',
    shortLabel: '数字勾稽',
    icon: '🧮',
    tags: ['公文', '数字', '勾稽'],
    description: '核查公文及附表中分项之和与合计、文内引用数字与表格数字是否一致。',
    systemPrompt: '你是一位公文数据勾稽核查专家。核算时务必先逐字列出原文数字，再做加总比对，不得心算臆断。' + GUARD,
    userPromptTemplate:
      '请核查文中及附表的数字勾稽关系：分项之和是否等于合计、各表小计与总计是否一致、正文引用的数字与表格中数字是否一致、百分比之和是否合理。先逐字列出涉及的原文数字，再给出计算与结论，标注不一致处。' + ANCHOR
  }),
  chk({
    id: 'analysis.pd-template-compare',
    label: '公文模板符合度比对',
    shortLabel: '模板比对',
    icon: '📐',
    tags: ['公文', '模板', '比对'],
    description: '将公文与所提供的标准模板逐项比对，找出缺项、错位与不符之处。',
    systemPrompt: '你是一位公文模板符合度核查专家。比对以用户提供的模板为基准，不引入模板之外的要求。' + GUARD,
    userPromptTemplate:
      '请将「待审公文」与「标准模板」逐项比对（请在输入中先给模板、再给公文，或注明各自范围），找出：缺少的模板要素、顺序错位、与模板格式 / 用语不一致之处。逐条标注公文中的命中片段并说明与模板的差异。' + ANCHOR
  }),
  chk({
    id: 'analysis.pd-superior-compliance',
    label: '上级文件落实对照',
    shortLabel: '落实对照',
    icon: '🔗',
    tags: ['公文', '落实', '对照'],
    description: '将本单位文件与上级文件要求逐条对照，查找漏落实、打折扣或表述偏差。',
    systemPrompt: '你是一位政策落实对照核查专家。对照以用户提供的上级文件要求为准，只判断"是否覆盖与对应"，不替代实质性履职评价。' + GUARD,
    userPromptTemplate:
      '请将「本单位文件」与「上级文件要求」逐条对照（请在输入中分别给出上级要求与本单位落实内容），找出：上级要求中未被本单位文件覆盖的事项、落实表述明显打折扣或偏离的地方、时限 / 责任主体不对应处。逐条列出对应关系与缺口。' + ANCHOR
  }),
  gen({
    id: 'analysis.pd-revision-note',
    label: '修订稿差异说明生成',
    shortLabel: '修改说明',
    icon: '📝',
    tags: ['公文', '修订', '修改说明'],
    description: '对比同一文件的两个版本，生成条理化的「修改说明」（增/删/改要点）。',
    systemPrompt: '你是一位公文修改说明撰写助手。只依据两版文本的实际差异归纳，不评价、不臆造未发生的改动。' + GUARD,
    userPromptTemplate:
      '下面给出同一份公文的「修改前」与「修改后」两个版本（请在输入中分别标明）。请逐条归纳实际差异，生成条理清晰的《修改说明》：分"新增 / 删除 / 修改"三类，每条写明改动位置、原表述与新表述要点、改动的简要事由（如能从文本判断）。语言简洁、忠于原文。\n\n---\n{{input}}\n---'
  })
])

export function mergeGovReviewIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...GOVREVIEW_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { GOVREVIEW_BUILTIN_ASSISTANTS }
