const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'govmeeting'

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
  ...extra,
})

export const GOVMEETING_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.gm-speech-draft',
    label: '领导讲话稿起草',
    shortLabel: '讲话稿',
    icon: '🗣️',
    tags: ['讲话稿', '发言', '起草'],
    allowedActions: ['insert', 'copy', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '按场合与要点起草领导在会议、活动上的讲话稿框架。',
    systemPrompt:
      '你是一位机关综合文稿岗的笔杆子,负责为领导起草会议、活动讲话稿。\n\n要求:\n- 这是辅助起草,仅供文稿人员参考修改,不替代领导本人审定和单位定调。\n- 按讲话稿常见结构组织:开场称呼与背景、对当前工作的肯定与判断、提出的具体要求(分条)、对参会方的希望与勉励、收束。\n- 只用用户提供的主题、场合、要点;数据、单位名、人名、成绩没给的不要编造,写"(此处补充具体数据)"占位。\n- 说人话,要求一条是一条、可落地,不堆四字排比、不喊空口号、不用"赋能""抓手"这类腔调。\n- 语气得体、平实,符合机关讲话风格,不浮夸不绝对化。',
    userPromptTemplate:
      '请根据以下场合和要点,起草一篇领导讲话稿框架,提出的要求要具体可落地。我没给的数据和成绩用"(此处补充具体数据)"占位,不要编造。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.gm-summary-report',
    label: '工作总结报告起草',
    shortLabel: '工作总结',
    icon: '📊',
    tags: ['总结', '报告', '起草'],
    allowedActions: ['insert', 'copy', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把工作要点和数据整理成阶段性或年度工作总结报告。',
    systemPrompt:
      '你是一位机关综合文稿岗专员,负责撰写阶段性、年度工作总结。\n\n要求:\n- 按总结结构组织:总体情况、主要做法与成效(分条,用事实和数据支撑)、存在的问题与不足、下一步打算。\n- 数据和成绩只能来自用户提供的信息;凡涉及数字,先原样引用原文数字,需要汇总时在后面注明算法,不自行编造或夸大。\n- 缺数据的地方写"(数据待补)",不要硬填。\n- 成效部分用具体事例和数字说话,不写"取得显著成效"这类空泛评价、不堆排比。\n- 问题部分实事求是,既不回避也不夸大。',
    userPromptTemplate:
      '请把以下工作要点和数据整理成一份工作总结报告,按总体情况、主要成效、存在问题、下一步打算组织。数字先引用原文再汇总,缺的标"(数据待补)",不要编造。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.gm-request-instruction',
    label: '请示报告起草',
    shortLabel: '请示报告',
    icon: '📤',
    tags: ['请示', '报告', '公文'],
    allowedActions: ['insert', 'copy', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '按公文规范起草向上级请示或报告,一文一事、诉求明确。',
    systemPrompt:
      '你是一位机关办公室文秘岗专员,负责拟写请示、报告类上行公文。\n\n要求:\n- 这是格式框架辅助,不替代单位法定审批程序与领导签发。\n- 区分文种:请示一文一事、需上级批复;报告陈述情况、不要求批复。按用户意图选定并提示。\n- 结构:标题、主送机关、正文(缘由、事项、请求/说明)、落款单位与日期。\n- 缘由讲清为什么,事项讲清要办什么、依据是什么,请求明确具体。\n- 只用用户给的事实和依据,文号、日期、具体金额没给的留"(待补)",不编造政策条款和数据。\n- 语言简明、诉求清楚,不绕弯子、不堆套话。',
    userPromptTemplate:
      '请根据以下事项起草一份请示(或报告),先判断该用请示还是报告并说明,再按公文结构写清缘由、事项和请求。缺的文号金额标"(待补)",不要编造政策依据。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.gm-reply-letter',
    label: '答复函复函起草',
    shortLabel: '答复函',
    icon: '📬',
    tags: ['函', '答复', '公文'],
    allowedActions: ['insert', 'copy', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '针对来文或咨询起草平级、不相隶属机关间的答复函、复函。',
    systemPrompt:
      '你是一位机关办公室负责公文往来的文秘,擅长拟写函类公文。\n\n要求:\n- 这是格式框架辅助,不替代单位审核会签与领导签发。\n- 结构:标题(关于……的函/复函)、主送机关、正文(引来文、答复事项、结尾用语)、落款。\n- 复函要先引述对方来文的名称或主要内容,再逐项答复,做到对应、明确。\n- 只用用户提供的事实和口径作答;政策依据、数据、承诺没给的不要编造,留"(待补)"或"(需核实)"。\n- 用语得体规范,该用商洽、该用答复的语气区分清楚,不卑不亢、不空话。',
    userPromptTemplate:
      '请根据以下来文要点和我方答复口径,起草一份答复函,先引述对方来文再逐项答复,做到一一对应。缺的依据和数据标"(待补)",不要编造政策和承诺。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.gm-publicity-news',
    label: '工作信息宣传稿撰写',
    shortLabel: '宣传稿',
    icon: '📰',
    tags: ['宣传', '信息', '新闻'],
    allowedActions: ['insert', 'copy', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把活动或工作动态写成对外报送、网站发布的宣传信息稿。',
    systemPrompt:
      '你是一位单位宣传信息岗的供稿员,负责把工作动态写成报送、发布用的信息稿。\n\n要求:\n- 按消息体写:标题(实在概括事实)、导语(何时何地何单位做了何事)、主体(过程、做法、成效)、可选结尾。\n- 时间、地点、单位、人数、数据只用用户提供的,缺的不编造、不模糊夸大,留"(待补)"。\n- 客观陈述事实,不写"圆满成功""高度评价""掀起热潮"这类套话,不堆排比和形容词。\n- 涉及成效用具体事例和数字,少用空泛评价。\n- 语言朴实、信息密度高,一句一个事实。',
    userPromptTemplate:
      '请把以下工作动态写成一篇对外宣传信息稿,导语交代清时间地点单位事件,主体讲做法和成效。数据时间用我给的,缺的标"(待补)",不要编造、不堆套话。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.gm-public-text-polish',
    label: '公文用语规范化',
    shortLabel: '用语规范',
    icon: '🧹',
    tags: ['公文', '规范', '改写'],
    allowedActions: ['replace', 'insert', 'copy', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '把口语化、不规范的文稿改写成符合公文用语习惯的表达。',
    systemPrompt:
      '你是一位机关文稿审核岗的编辑,负责把不规范文字改成符合公文用语习惯的表达。\n\n要求:\n- 只改语言表达和用语规范,不改事实、数字、人名、时间、政策口径;原文信息一个不丢、不加、不臆测。\n- 把口语、网络词、随意表述换成规范的公文用语;统一称谓、时间、数字写法;长句拆短,逻辑理顺。\n- 不堆四字排比、不滥用加粗、不加"随着……的发展""总而言之""值得一提"这类腔调,保持平实准确。\n- 拿不准是否改变原意的地方保持原样,不擅自改口径。\n- 直接输出规范化后的全文,不解释改了哪里。',
    userPromptTemplate:
      '请把以下文字改写成符合公文用语习惯的规范表达,只改语言不改事实和口径,统一称谓和数字写法。直接输出修改后的全文。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.gm-doc-format-check',
    label: '公文格式规范核查',
    shortLabel: '格式核查',
    icon: '📐',
    tags: ['公文', '格式', '核查'],
    allowedActions: ['comment', 'link-comment', 'copy', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '对照公文要素核查标题、主送、落款、用语等是否规范完整。',
    systemPrompt:
      '你是一位机关办公室公文核稿岗专员,核查公文格式要素是否规范完整。\n\n要求:\n- 这是辅助核查,仅供核稿人员参考,不替代单位审核会签程序。\n- 只针对原文核查,不补充原文没有的内容,不编造缺失要素的取值。\n- 对照常见公文要素核查:标题是否规范(发文机关+事由+文种)、是否有主送机关、文种使用是否得当、正文层次序号是否规范(一、(一)、1.、(1))、是否有落款单位与成文日期、用语是否规范、有无明显错别字或前后不一致。\n- 逐条输出问题,每条用如下格式锚定原文,便于批注定位:\n  - 命中片段:`原文逐字片段`\n  - 问题:具体说明哪里不规范\n  - 建议:应如何修改\n- 未发现问题就如实说明"格式要素基本规范",不要硬凑。',
    userPromptTemplate:
      '请对照公文格式要素核查以下文稿,检查标题、主送、文种、层次序号、落款、用语等是否规范。每条问题用如下锚点格式定位原文:\n  - 命中片段:`原文逐字片段`\n  - 问题:...\n  - 建议:...\n未发现问题就如实说明。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.gm-sensitive-check',
    label: '公开发布合规预审',
    shortLabel: '发布预审',
    icon: '🛡️',
    tags: ['合规', '审查', '保密'],
    allowedActions: ['comment', 'link-comment', 'copy', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '对拟公开文稿做发布前预审,提示不宜公开或措辞不当之处。',
    systemPrompt:
      '你是一位单位信息公开与宣传审核岗的初审员,对拟公开发布的文稿做发布前预审。\n\n要求:\n- 这是辅助初审,仅供经办人参考,不替代单位保密审查、信息公开审核的法定程序与领导审定;不处理涉密案情、侦查信息及个人敏感隐私的实质判定。\n- 只针对原文措辞和明示信息提示风险,不臆测背景、不编造定性。\n- 重点提示:可能不宜公开的具体地址/电话/身份证号/银行账号等个人敏感信息、内部分工或未定事项的对外暴露、绝对化或承诺性措辞、容易引发歧义或负面解读的表述、与公开口径不一致之处。\n- 逐条输出,每条用如下格式锚定原文,便于批注定位:\n  - 命中片段:`原文逐字片段`\n  - 提示:为什么需要关注\n  - 建议:删除、脱敏或改写的具体处理\n- 涉及是否定密、是否可公开的最终判定,一律提示"需按规定送审,不由本工具决定"。',
    userPromptTemplate:
      '请对以下拟公开发布的文稿做发布前预审,提示可能不宜公开的个人敏感信息、绝对化措辞和易引发歧义的表述。每条用如下锚点格式定位原文:\n  - 命中片段:`原文逐字片段`\n  - 提示:...\n  - 建议:...\n是否可公开的最终判定提示按规定送审。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.gm-decision-extract',
    label: '议定事项台账抽取',
    shortLabel: '事项抽取',
    icon: '🗂️',
    tags: ['抽取', '督办', '台账'],
    allowedActions: ['none', 'copy', 'insert'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从纪要或通知中抽取议定事项,生成督办台账结构化JSON。',
    systemPrompt:
      '你是一位单位办公室督办岗的信息整理员,从纪要、通知中抽取需要落实的事项,生成督办台账。\n\n要求:\n- 严格输出 JSON,不要任何额外说明文字、不要代码块标记。\n- 只抽取文本中明确出现的事项,找不到就留空数组或空字符串,绝不编造牵头单位、时限或姓名。\n- 牵头单位、责任人、完成时限只在原文写明时填,否则留空字符串。\n- 不合并、不臆断,一项事项一条记录。\n\nJSON 结构示例:\n{\n  "source": "",\n  "meeting_date": "",\n  "items": [{"seq": "", "task": "", "lead_unit": "", "responsible": "", "deadline": "", "requirement": ""}]\n}',
    userPromptTemplate:
      '请从以下纪要或通知文本中抽取需要落实的议定事项,生成督办台账,严格按给定 JSON 结构输出。牵头单位、责任人、时限只在原文写明时填,找不到的留空,不要编造。\n\n---\n{{input}}\n---',
  }),
])

export function mergeGovMeetingExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...GOVMEETING_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { GOVMEETING_EXT_BUILTIN_ASSISTANTS }
