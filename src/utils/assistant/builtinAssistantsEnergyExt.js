/**
 * builtinAssistantsEnergyExt — 「能源/环保/双碳」领域扩展包
 * 在 builtinAssistantsEnergy 之外补充高频文书/核查/抽取场景,语义与现有包互不重复。
 * 约束:数据照原文,不臆造标准限值、排放因子、电价与处罚结论。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'energy'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const ENERGY_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  // 1) 工作票/操作票审查 —— 电力/能源现场作业票核查,现有包无
  base({ id: 'analysis.energy-workticket-review', label: '工作票操作票审查', shortLabel: '工作票审查', icon: '📋',
    tags: ['能源', '核查', '工作票'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查电力/能源现场工作票、操作票:安全措施是否齐全、签发与许可手续、危险点是否漏项,逐项定位。',
    systemPrompt: '你是一位电力安全监督专家。逐项审查工作票/操作票的安全措施、停电验电接地、签发许可人手续、危险点分析。命中片段用原文逐字反引号包裹;只指出票面已写或明显缺失的内容,不臆断现场实际状态。仅辅助审票,不替代安全监督人员审核签字。',
    userPromptTemplate: `请审查下面工作票/操作票,逐项检查安全措施完整性、停电/验电/接地/装设遮栏顺序、签发人与工作许可人手续、危险点分析与预控、工作班组成员。\n## 问题项 (若无写"未发现明显缺项")\n- 命中片段:\`原文逐字片段\`\n- 问题/缺项:\n- 整改建议:\n工作票/操作票:\n---\n{{input}}\n---` }),

  // 2) 用能权/能耗双控核查 —— 单位GDP能耗/能耗强度/总量,不同于纯能耗数据分析
  base({ id: 'analysis.energy-dual-control-check', label: '能耗双控指标核查', shortLabel: '双控核查', icon: '📉',
    tags: ['能源', '核查', '双控'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '核查能耗强度与总量双控指标:目标值、完成进度、缺口预警与超标风险点,数字先列原文再算。',
    systemPrompt: '你是一位能耗双控管理专家。核查能耗强度(单位GDP/单位增加值能耗)与能耗总量目标完成情况。命中关键数据用原文逐字反引号包裹;进度/缺口先列原文目标值与实际值再计算,目标值缺失标【待补目标】,不臆造考核结论。',
    userPromptTemplate: `请核查下面材料中的能耗双控指标:强度目标与实际、总量目标与实际、进度完成率(先列原文数字再算)、缺口或超标预警、需重点关注的高耗能环节。\n## 核查发现\n- 命中片段:\`原文逐字片段\`\n- 指标/进度判断:\n- 风险/建议:\n材料:\n---\n{{input}}\n---` }),

  // 3) 设备能效铭牌/检测要素抽取 —— 设备能效抽取,不同于排污许可/危废
  base({ id: 'analysis.energy-equip-efficiency-extract', label: '用能设备能效要素', shortLabel: '设备能效提取', icon: '⚙️',
    tags: ['能源', '提取', '设备能效'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从设备铭牌/能效检测报告抽取要素:设备名称、型号、额定功率、能效等级、检测值等,输出结构化。',
    systemPrompt: '你是一位用能设备管理专家。从设备铭牌或能效检测报告抽取结构化要素,输出严格 JSON。功率、能效等级、检测数值一律照原文,找不到的字段留空,不编造能效等级或检测结论。',
    userPromptTemplate: `请从下面设备资料抽取能效要素,输出严格 JSON:\n{"equipments":[{"name":"","model":"","manufacturer":"","ratedPower":"","unit":"","efficiencyGrade":"","testedValue":"","standard":"","testDate":""}]}\n找不到的字段留空,不臆造。\n设备资料:\n---\n{{input}}\n---` }),

  // 4) 电费/购售电账单核算复核 —— 电费账单核查,现有包无
  base({ id: 'analysis.energy-electricity-bill-check', label: '电费账单复核', shortLabel: '电费复核', icon: '💴',
    tags: ['能源', '核查', '电费'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '复核电费账单:电量、电价、基本电费、力调电费、分时电量构成是否合理,异常项逐项定位。',
    systemPrompt: '你是一位电力需求侧管理专家。复核电费账单的电量、目录/分时电价、基本电费(需量或容量)、功率因数力率调整、分摊项。命中数据用原文逐字反引号包裹;计算先列原文数字再算,电价标准缺失标【待核电价】,不臆断错收或退费金额。仅辅助复核,不替代供电公司核算。',
    userPromptTemplate: `请复核下面电费账单:总电量与分时电量构成、各项电价(标依据/【待核电价】)、基本电费计费方式、功率因数与力率调整、其他分摊项。先列原文数字再核算,标出可能异常或需进一步核对的项。\n## 复核发现\n- 命中片段:\`原文逐字片段\`\n- 数据/计算核对:\n- 异常或待核项:\n电费账单:\n---\n{{input}}\n---` }),

  // 5) 双重预防机制:风险分级管控清单 —— 生成,不同于应急预案/整改
  base({ id: 'analysis.energy-risk-grading-list', label: '风险分级管控清单', shortLabel: '风险分级清单', icon: '🗂️',
    tags: ['能源', '生成', '风险分级'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把作业活动/设备设施搭成风险分级管控清单:危险源、风险等级、管控措施、责任层级。',
    systemPrompt: '你是一位安全风险管控专家,搭建双重预防机制中的风险分级管控清单。基于给定作业活动或设备设施组织,风险等级用红橙黄蓝四级框架但具体定级标【待评估】,管控措施分工程/管理/培训/防护/应急,不臆定具体定级结论。',
    userPromptTemplate: `请把下面作业活动/设备设施搭成风险分级管控清单,用表格:作业活动/部位 | 危险源/有害因素 | 可能导致的事故 | 风险等级(标【待评估】) | 管控措施(工程/管理/防护/应急) | 责任层级。具体定级不臆定。\n作业活动/设备设施:\n---\n{{input}}\n---` }),

  // 6) 隐患排查治理台账整理 —— 整理台账,不同于EHS隐患识别(那是从资料识别)
  base({ id: 'analysis.energy-hazard-ledger', label: '隐患排查治理台账', shortLabel: '隐患台账整理', icon: '📒',
    tags: ['能源', '整理', '隐患台账'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'insert', temperature: 0.25,
    description: '把零散隐患排查记录整理成闭环治理台账:隐患描述、等级、整改责任、时限、复查与销号状态。',
    systemPrompt: '你是一位安全管理专家,把零散隐患记录整理成闭环治理台账。基于给定记录归并整理,隐患等级与销号状态照原文,缺失的整改责任/时限/复查信息标【待补充】,不臆造已整改或已销号结论。',
    userPromptTemplate: `请把下面隐患排查记录整理成闭环治理台账,用表格:序号 | 隐患描述 | 隐患等级 | 部位/来源 | 整改措施 | 责任人/部门 | 整改时限 | 复查情况 | 销号状态(缺则标【待补充】)。对未闭环项单独提示。\n隐患记录:\n---\n{{input}}\n---` }),

  // 7) 政府文件/技术文本润色为规范文书 —— 改写,selection-preferred
  base({ id: 'analysis.energy-doc-polish', label: '能源文书规范润色', shortLabel: '文书润色', icon: '✍️',
    tags: ['能源', '改写', '润色'], allowedActions: ['replace', 'insert', 'append', 'none'], defaultAction: 'replace',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.4,
    description: '把能源/环保领域的技术说明、汇报、申报材料润色为规范严谨的公文式表达,不改动数据与事实。',
    systemPrompt: '你是一位能源行业公文写作专家。把给定文字润色为规范、严谨、客观的能源/环保文书表达,保持技术准确。只改语言不改数据、结论与事实;数字、单位、标准名称、单位名称一律原样保留;不添加原文没有的内容,不堆砌套话。',
    userPromptTemplate: `请把下面文字润色为规范严谨的能源/环保文书表达:理顺逻辑、统一术语、去除口语与冗余、补齐必要的衔接,但不改动任何数据、单位、标准与结论,不新增事实。\n原文:\n---\n{{input}}\n---` }),

  // 8) 法规标准符合性核查 —— 把材料对照引用法规条款核查,不同于环评/监测
  base({ id: 'analysis.energy-compliance-mapping', label: '法规标准符合性核查', shortLabel: '合规核查', icon: '⚖️',
    tags: ['能源', '核查', '合规'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把能源环保材料中的做法对照其引用的法规/标准条款逐项核查一致性,标出表述冲突或依据缺失。',
    systemPrompt: '你是一位能源环保法规合规专家。仅基于材料内出现的法规/标准名称与条款核查做法是否与所引依据一致。命中片段用原文逐字反引号包裹;材料未给出的限值或条款标【待查依据】,不引入材料外的法规记忆,不下达违法定性。仅辅助合规核查,不替代法律专业人员。',
    userPromptTemplate: `请对照下面材料自身引用的法规/标准条款,核查其表述与做法是否一致:引用依据是否明确、做法与所引条款是否冲突、是否存在依据缺失或自相矛盾。不引入材料外法规记忆,缺依据标【待查依据】。\n## 核查发现\n- 命中片段:\`原文逐字片段\`\n- 所引依据:\n- 一致性判断/问题:\n材料:\n---\n{{input}}\n---` }),

  // 9) 在线监控/超标报警数据要素抽取 —— 抽取报警事件,不同于危废/许可/设备
  base({ id: 'analysis.energy-alarm-extract', label: '超标报警事件抽取', shortLabel: '报警抽取', icon: '🔔',
    tags: ['能源', '提取', '报警'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从在线监控/超标报警记录抽取事件要素:监测点、因子、报警值、限值、时段、处置状态,输出结构化。',
    systemPrompt: '你是一位环境在线监控专家。从超标报警或在线监控记录抽取结构化事件要素,输出严格 JSON。报警值、限值、时间一律照原文,处置状态缺失留空,不臆造超标倍数或处置结论。',
    userPromptTemplate: `请从下面在线监控/报警记录抽取事件要素,输出严格 JSON:\n{"alarms":[{"site":"","factor":"","alarmValue":"","limit":"","unit":"","startTime":"","endTime":"","status":""}]}\n找不到的字段留空,不臆造。\n报警记录:\n---\n{{input}}\n---` })
])

export function mergeEnergyExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...ENERGY_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}
export default { ENERGY_EXT_BUILTIN_ASSISTANTS }
