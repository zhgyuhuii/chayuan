/**
 * builtinAssistantsSchool — 「学校管理」领域助手包(sector,domain=school)
 * 面向中小学/幼儿园/中职的管理与文书:校长/教务/德育/年级组/班主任/教研组/总务/团队少先队。
 * 与 education 域(教学内容/批改)互补:本包聚焦管理材料、活动方案、计划总结、评价、记录整理与合规核查。
 * 生成/起草类默认插入;规范化/润色类默认替换;核查类批注+逐字锚点;抽取类严格 JSON。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'school'

// 知识库对比类助手能力位:执行器见此即先检索绑定知识库,把命中片段注入 {{kbContext}}。
const KB_CAP = Object.freeze({ useKnowledgeBase: true })

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const SCHOOL_BUILTIN_ASSISTANTS = Object.freeze([
  // —— 教务 / 教学组织 ——
  base({ id: 'analysis.sc-academic-material', label: '教务管理材料起草', shortLabel: '教务材料', icon: '🏫',
    tags: ['学校', '教务', '生成'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '起草教务管理材料:教学常规检查通知、排课/调代课说明、考务安排、教学质量分析会方案等。',
    systemPrompt: '你是一位中小学教务主任,起草规范、可执行的教务管理材料。依据给定信息写,时间地点流程具体,不编造数据与人名。',
    userPromptTemplate: `请根据下面要点起草教务管理材料:背景与目的、具体安排(时间/地点/对象/流程)、责任分工、要求与注意事项。措辞规范、条目清晰。\n要点:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.sc-teaching-plan', label: '教学计划/总结', shortLabel: '教学计划', icon: '📚',
    tags: ['学校', '教研组', '生成'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '起草学科/年级/学校层面的教学工作计划或学期教学工作总结,目标—措施—进度成体系。',
    systemPrompt: '你是一位学校教学管理者,撰写有目标、有措施、可落地的教学工作计划或总结。基于给定情况,数据如实引用,不空喊口号。',
    userPromptTemplate: `请根据下面情况撰写教学计划或总结(按提示选其一):\n## 指导思想与目标\n## 工作分析(现状/问题,引用给定数据)\n## 主要措施(分项可执行)\n## 进度与责任安排\n## 预期成效/工作小结\n情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.sc-schedule-note', label: '课程表/作息说明', shortLabel: '课程作息', icon: '🕘',
    tags: ['学校', '教务', '生成'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把课程表/作息时间安排整理成图文说明:作息时间表、调整说明、家长告知,清晰好读。',
    systemPrompt: '你是一位教务排课老师,把作息与课程安排整理成清晰说明。时间节点严格依据给定信息,不臆造节次时刻。',
    userPromptTemplate: `请把下面安排整理成作息/课程说明:作息时间表(逐节次时刻)、特殊调整说明、需家长配合的事项。表格或清单呈现,时间准确。\n安排:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.sc-research-material', label: '校本研修材料', shortLabel: '校本研修', icon: '🧪',
    tags: ['学校', '教研组', '生成'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '起草校本研修/教研活动材料:主题教研方案、听评课记录模板、研修活动总结。',
    systemPrompt: '你是一位教研组长,起草务实的校本研修材料。主题聚焦、流程可操作,基于给定主题展开,不堆砌教育术语。',
    userPromptTemplate: `请根据下面主题起草校本研修材料:研修主题与目标、活动流程(时间/环节/主讲)、参与对象与分工、预期成果与记录方式。务实可操作。\n主题:\n---\n{{input}}\n---` }),

  // —— 德育 / 班级 / 团队少先队 ——
  base({ id: 'analysis.sc-moral-activity', label: '德育主题活动方案', shortLabel: '德育活动', icon: '🎯',
    tags: ['学校', '德育', '生成'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '起草德育主题活动方案:主题立意、活动目标、流程环节、分工保障、评价与延伸,适配学段。',
    systemPrompt: '你是一位学校德育主任,策划贴近学生、可落地的德育主题活动。立意正向、环节具体、适配学段,不空泛说教。',
    userPromptTemplate: `请根据下面主题起草德育活动方案:活动主题与目标、面向学段、活动流程(分环节,含时间与组织方式)、人员分工与安全保障、活动评价与延伸。\n主题:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.sc-class-teacher-plan', label: '班主任工作计划', shortLabel: '班主任计划', icon: '📋',
    tags: ['学校', '班主任', '生成'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '起草班主任学期工作计划:班情分析、工作目标、班级管理/班风/家校等措施、月度安排。',
    systemPrompt: '你是一位经验丰富的班主任,撰写具体可执行的班主任工作计划。基于给定班情,措施落地,不照搬通用模板套话。',
    userPromptTemplate: `请根据下面班情起草班主任工作计划:\n## 班情分析(人数/特点/问题,据实)\n## 本学期工作目标\n## 主要措施(常规/班风/学风/家校/个别帮扶)\n## 月度工作安排\n班情:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.sc-class-meeting', label: '主题班会设计', shortLabel: '主题班会', icon: '🗣️',
    tags: ['学校', '班主任', '生成'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '设计主题班会:导入、活动环节、学生互动、讨论引导、总结升华,有互动不灌输。',
    systemPrompt: '你是一位班主任,设计有参与感的主题班会。环节具体、学生为主体,基于给定主题与学段,不一味讲道理。',
    userPromptTemplate: `请根据下面主题设计班会:班会目标、面向学段、流程(导入→活动/互动环节→讨论引导→总结升华,每环节写组织方式与时长)、所需准备。学生为主体。\n主题:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.sc-club-activity', label: '社团活动方案', shortLabel: '社团活动', icon: '🎨',
    tags: ['学校', '德育', '生成'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '起草社团/兴趣小组活动方案:宗旨、招募、活动计划、指导安排、成果展示与安全保障。',
    systemPrompt: '你是一位学校社团指导老师,策划可持续的社团活动方案。计划具体、兼顾兴趣与安全,基于给定社团类型展开。',
    userPromptTemplate: `请根据下面社团信息起草活动方案:社团宗旨与目标、招募与人数、学期活动计划(分次安排)、指导教师分工、成果展示形式、安全保障措施。\n社团信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.sc-student-comment', label: '学生评语撰写', shortLabel: '学生评语', icon: '🌟',
    tags: ['学校', '班主任', '生成'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '根据学生表现写个性化期末/综合素质评语:具体优点、委婉不足、真诚期望,避免千篇一律。',
    systemPrompt: '你是一位班主任,写有温度、个性化的学生评语。用具体事例肯定优点、委婉指出可改进处、给真诚期望,基于给定表现,不套模板、不夸大。',
    userPromptTemplate: `请根据下面学生表现写评语:用具体事例肯定优点、委婉点出可改进处、给真诚期望。一段连贯文字,有温度不套话,不编造未提及的事例。\n学生表现:\n---\n{{input}}\n---` }),

  // —— 家校 / 记录整理 ——
  base({ id: 'analysis.sc-parent-meeting', label: '家长会方案', shortLabel: '家长会', icon: '👪',
    tags: ['学校', '家校', '生成'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '起草家长会方案:目的、流程(签到/通报/交流/答疑)、发言提纲要点、注意事项与会场安排。',
    systemPrompt: '你是一位班主任/年级组长,策划高效、家长易接受的家长会。流程紧凑、内容客观,基于给定情况,不渲染负面、不对立。',
    userPromptTemplate: `请根据下面情况起草家长会方案:会议目的、时间地点对象、流程(签到→年级/班级情况通报→重点交流→答疑→结束)、发言要点提纲、会场与签到安排、注意事项。客观得体。\n情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.sc-home-visit', label: '家访记录整理', shortLabel: '家访记录', icon: '🏠',
    tags: ['学校', '班主任', '整理'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把零散家访情况整理成规范家访记录:时间对象、家庭情况、沟通内容、达成共识与后续跟进。',
    systemPrompt: '你是一位班主任,把家访情况整理成规范记录。只依据给定信息,客观如实,不补充未提及的家庭细节,保护学生隐私。',
    userPromptTemplate: `请把下面家访情况整理成规范家访记录:\n## 基本信息(时间/学生/家访人/在场人)\n## 家庭基本情况\n## 沟通内容(学习/行为/家庭配合)\n## 达成共识\n## 后续跟进措施\n仅依据所给信息,不编造。\n家访情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.sc-attendance-record', label: '值周/考勤记录整理', shortLabel: '值周考勤', icon: '🗂️',
    tags: ['学校', '总务', '整理'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.2,
    description: '把零散值周/考勤情况整理成规范记录与小结:日期、检查项、问题、表扬批评、整改建议。',
    systemPrompt: '你是一位负责值周/考勤管理的教师,把零散信息整理成清晰记录。数字与事实严格据实,不臆造缺勤人数或事件。',
    userPromptTemplate: `请把下面值周/考勤情况整理成记录与小结:\n## 值周/考勤记录表(日期·班级·检查项·情况)\n## 突出问题\n## 表扬与提醒\n## 整改建议\n涉及人数/天数等数字,先照抄原文数字再统计,不编造。\n情况:\n---\n{{input}}\n---` }),

  // —— 安全 / 学情 / 评价 / 文化 ——
  base({ id: 'analysis.sc-safety-lesson', label: '安全教育教案', shortLabel: '安全教案', icon: '🛟',
    tags: ['学校', '德育', '生成'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '起草安全教育主题教案/班会:安全知识点、典型案例、互动演练、应急要点,适配学段。',
    systemPrompt: '你是一位学校安全教育负责人,设计实用的安全教育教案。知识准确、贴近学生生活,适配学段。安全教育仅为引导,具体应急须遵守学校预案与有关部门规定。',
    userPromptTemplate: `请根据下面安全主题起草教育教案:教学目标、面向学段、安全知识要点、典型案例(贴近校园生活)、互动/演练环节、应急处置要点提示、课堂小结。\n安全主题:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.sc-learning-analysis', label: '学情分析', shortLabel: '学情分析', icon: '📈',
    tags: ['学校', '教务', '分析'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '根据成绩/表现数据做学情分析:整体水平、分层分布、薄弱点、典型问题与改进方向。',
    systemPrompt: '你是一位教务/年级管理者,做客观的学情分析。涉及成绩数据先列出原文数字再计算,结论有据,不编造均分/及格率,不给无依据的归因。',
    userPromptTemplate: `请根据下面数据做学情分析:\n## 整体情况(均分/及格率等,先列原文数字再算)\n## 分层/分布分析\n## 薄弱环节与典型问题\n## 改进方向与教学建议\n所有数字以原文为准,不编造。\n数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.sc-teacher-eval', label: '教师评价材料', shortLabel: '教师评价', icon: '🧑‍🏫',
    tags: ['学校', '校长', '生成'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '起草教师评价/考核材料:师德、教学、教研、班级管理等维度的客观评价与发展建议。',
    systemPrompt: '你是一位学校管理者,撰写客观、有据的教师评价材料。基于给定事实分维度评价,优点具体、不足建设性,不编造业绩与荣誉。评价仅供学校内部参考,不替代正式考核程序。',
    userPromptTemplate: `请根据下面情况起草教师评价材料:\n## 师德师风\n## 教育教学(含可量化成绩,据实引用)\n## 教研与专业成长\n## 班级/学生管理\n## 综合评价与发展建议\n基于所给事实,不编造荣誉与数据。\n情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.sc-campus-culture', label: '校园文化材料', shortLabel: '校园文化', icon: '🏛️',
    tags: ['学校', '校长', '生成'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '起草校园文化材料:办学理念阐释、校训释义、文化主题活动方案、宣传栏/展板文案。',
    systemPrompt: '你是一位学校文化建设负责人,撰写有内涵、不空洞的校园文化材料。立意正向、表达朴实有感染力,基于给定理念展开,不堆华丽空话。',
    userPromptTemplate: `请根据下面要点起草校园文化材料(按提示选类型):理念/校训释义、文化主题与内涵、落地载体(活动/环境/制度)、宣传文案。表达朴实有力,不空喊口号。\n要点:\n---\n{{input}}\n---` }),

  // —— 规范化 / 核查 / 抽取 ——
  base({ id: 'analysis.sc-doc-polish', label: '公文规范化润色', shortLabel: '公文润色', icon: '🖋️',
    tags: ['学校', '行政', '改写'], allowedActions: ['replace', 'comment', 'insert', 'none'], defaultAction: 'replace',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.3,
    description: '把口语化/松散的学校通知、报告、总结改写为规范行政文风,结构清楚、措辞得体,不改变原意。',
    systemPrompt: '你是一位学校办公室文秘,把材料规范化润色。保留原意与事实数据,只改措辞与结构,使其符合学校行政文风,不添加未提及内容、不夸大。',
    userPromptTemplate: `请把下面材料规范化润色:统一为得体的学校行政文风,理顺结构与逻辑,修正口语化与病句,保留全部事实与数字不变,不新增信息。给出修改后版本。\n{{input}}` }),
  base({ id: 'analysis.sc-doc-check', label: '通知/方案合规核查', shortLabel: '合规核查', icon: '🔎',
    tags: ['学校', '行政', 'check'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.2,
    runtimeCapabilities: { check: true },
    description: '核查学校通知/活动方案的要素与合规风险:时间地点对象是否齐全、安全责任、表述是否妥当。',
    systemPrompt: '你是一位学校办公室审核人员,核查文稿要素与表述风险。逐项指出问题并引用原文片段,只标实际缺失或不妥之处,不臆测。核查仅供内部参考,不替代主管部门审批。',
    userPromptTemplate: `请逐项核查下面学校文稿,每条按格式给出:\n- 命中片段:\`原文逐字片段\`\n- 问题:要素缺失/表述不妥/安全责任不清/数据前后矛盾等\n- 建议:具体修改\n核查维度:时间地点对象是否齐全、流程与分工是否清楚、安全与责任表述、用语是否得体、数字是否一致。仅标实际问题。\n文稿:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.sc-info-extract', label: '通知信息抽取', shortLabel: '信息抽取', icon: '🧾',
    tags: ['学校', '教务', '提取'], allowedActions: ['none', 'append', 'comment'], defaultAction: 'none',
    defaultOutputFormat: 'json', temperature: 0.1,
    description: '从学校通知/方案中抽取结构化要素(标题、时间、地点、对象、负责人、待办)为严格 JSON。',
    systemPrompt: '你是一位信息抽取助手,从学校文稿抽取结构化要素。只输出严格 JSON,字段找不到留空字符串或空数组,绝不编造时间地点人名。',
    userPromptTemplate: `请从下面学校文稿抽取要素,只输出严格 JSON,不要解释。找不到的字段留空("")或空数组([]),不编造。\n结构示例:\n{\n  "title": "",\n  "type": "",\n  "datetime": "",\n  "location": "",\n  "audience": "",\n  "organizer": "",\n  "contact": "",\n  "todo": [],\n  "notes": ""\n}\n文稿:\n---\n{{input}}\n---` }),

  // —— 知识库对照核查(靠 runtimeCapabilities.useKnowledgeBase=true 触发检索,命中片段注入 {{kbContext}}) ——
  base({ id: 'analysis.sc-kb-policy-check', label: '对照校规制度核查', shortLabel: '制度对照', icon: '📚',
    tags: ['学校', '知识库', 'check'], allowedActions: ['comment', 'link-comment', 'none'], defaultAction: 'comment',
    defaultInputSource: INPUT_SOURCE_DOCUMENT, runtimeCapabilities: KB_CAP, temperature: 0.15,
    description: '以绑定知识库中的校规校纪、管理制度、上级文件要求为基准,核查当前文稿是否符合,标出违反或缺失项。',
    systemPrompt: '你是一位学校办公室负责制度合规审查的人员,只以【知识库参考】中的校规制度、管理规定、上级文件要求为唯一基准核查当前文稿。逐条比对,只标实际违反或缺失,知识库未覆盖处明确标注,不臆造制度内容。核查仅供内部参考,不替代主管部门审批。',
    userPromptTemplate: `请以下方【知识库参考】中的校规制度/管理规定为基准,逐条核查文稿是否符合。每条按格式:\n- 文稿原文:\`原文逐字片段\`\n  - 知识库依据:\`参考逐字片段\`\n  - 判定:(符合/违反/KB未覆盖)\n  - 整改建议:……\n只依据知识库参考判断,参考未覆盖处标「KB未覆盖」,不编造制度内容。\n\n【知识库参考】\n{{kbContext}}\n\n【当前文稿】\n---\n{{input}}\n---` })
])

export function mergeSchoolIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...SCHOOL_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { SCHOOL_BUILTIN_ASSISTANTS, mergeSchoolIntoBuiltins }
