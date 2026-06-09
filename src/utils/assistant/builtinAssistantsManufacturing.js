/**
 * builtinAssistantsManufacturing — 「制造/工程」领域助手包(批8)
 * 整理/生成类默认插入或批注、提取类none、核查类批注。约束:技术参数照原文不改,不臆造标准号/数值。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'manufacturing'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.25, ...extra
})

export const MANUFACTURING_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.mfg-spec-organize', label: '技术规格书整理', shortLabel: '规格书整理', icon: '📐',
    tags: ['制造', '整理', '规格'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    description: '把零散技术参数整理成规范规格书:参数项、数值、单位、公差、依据标准,参数照原文。',
    systemPrompt: '你是一位工艺/技术文档工程师,把技术参数整理成规范规格书。数值/单位/公差严格照原文,不臆造标准号。',
    userPromptTemplate: `请把下面技术信息整理成规格书:表格列出 参数项 | 规格值 | 单位 | 公差 | 依据标准。数值照原文,缺项标"待确认"。\n技术信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.mfg-process-desc', label: '工艺流程描述', shortLabel: '工艺流程描述', icon: '⚙️',
    tags: ['制造', '生成', '工艺'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把工序要点写成规范工艺流程描述:工序步骤、关键参数、设备、质量控制点。',
    systemPrompt: '你是一位工艺工程师,撰写清晰、规范的工艺流程描述。参数照原文,关键控制点写明,不编造工艺数据。',
    userPromptTemplate: `请把下面工序要点写成工艺流程描述:逐工序(操作内容→关键参数→所用设备/工装→质量控制点)。参数照原文。\n工序要点:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.mfg-qc-report', label: '质检报告整理', shortLabel: '质检报告整理', icon: '🔬',
    tags: ['制造', '整理', '质检'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    description: '把检验数据整理成质检报告:检验项、标准值、实测值、判定,合格率统计照原文数。',
    systemPrompt: '你是一位质检员,把检验数据整理成规范质检报告。实测值照原文,判定依据标准值,统计先列原文数字。',
    userPromptTemplate: `请把下面检验数据整理成质检报告:表格 检验项 | 标准要求 | 实测值 | 判定(合格/不合格)。末尾给合格情况小结(统计先列原文数字)。\n检验数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.mfg-bom-extract', label: 'BOM清单提取', shortLabel: 'BOM提取', icon: '📦',
    tags: ['制造', '提取', 'BOM'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从图纸/物料说明提取 BOM 清单:物料号、名称、规格、数量、单位,输出结构化。',
    systemPrompt: '你是一位工艺员,从物料说明抽取 BOM,输出严格 JSON,规格数量照原文,找不到留空。',
    userPromptTemplate: `请从下面物料说明提取 BOM,输出严格 JSON:\n{"items":[{"partNo":"","name":"","spec":"","qty":"","unit":""}]}\n物料说明:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.mfg-sop', label: 'SOP作业规范', shortLabel: 'SOP规范', icon: '📋',
    tags: ['制造', '生成', 'SOP'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把操作要点写成标准作业指导书(SOP):目的、范围、步骤、要点、注意事项、记录。',
    systemPrompt: '你是一位精益工程师,撰写规范、可执行的 SOP。步骤清晰、关键点突出,不编造参数。',
    userPromptTemplate: `请把下面操作要点写成 SOP:目的、适用范围、所需工具材料、操作步骤(编号、含关键参数与图示位置)、质量与安全注意事项、记录表单。\n操作要点:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.mfg-safety-instruction', label: '安全作业指导书', shortLabel: '安全作业指导', icon: '🦺',
    tags: ['制造', '生成', '安全'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '针对作业场景生成安全作业指导书:危险源、防护措施、操作规程、应急处置。',
    systemPrompt: '你是一位 EHS 工程师,撰写实用的安全作业指导书。基于给定作业,危险源辨识全面,措施具体可执行。',
    userPromptTemplate: `请针对下面作业生成安全作业指导书:作业前准备与确认、危险源辨识、个人防护、操作安全规程、禁止事项、应急处置。\n作业:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.mfg-ncr', label: '不合格品报告', shortLabel: '不合格品报告', icon: '⚠️',
    tags: ['制造', '生成', '质量'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.25,
    description: '把不合格情况整理成 NCR 报告要素:不合格描述、判定依据、原因初判、处置与纠正建议。',
    systemPrompt: '你是一位质量工程师,把不合格情况整理成规范 NCR。客观描述,数据照原文,原因分析提示需现场确认。',
    userPromptTemplate: `请把下面不合格情况整理成 NCR 报告:不合格品信息(批次/数量)、不合格描述、判定依据(标准/图纸要求 vs 实际)、原因初步分析、处置方式(返工/让步/报废)、纠正预防建议。\n情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.mfg-eco-extract', label: '工程变更单要素', shortLabel: '工程变更要素', icon: '🔧',
    tags: ['制造', '提取', '变更'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从工程变更说明提取 ECO/ECN 要素:变更对象、变更前后、原因、影响范围、生效。',
    systemPrompt: '你是一位工程变更管理员,从变更说明抽取要素,输出严格 JSON,找不到留空,不臆造。',
    userPromptTemplate: `请从下面变更说明提取要素,输出严格 JSON:\n{"changeNo":"","object":"","before":"","after":"","reason":"","impact":"","effectiveDate":"","approver":""}\n变更说明:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.mfg-equipment-manual', label: '设备操作手册', shortLabel: '设备操作手册', icon: '🛠️',
    tags: ['制造', '生成', '设备'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把设备资料整理成操作手册:功能、操作步骤、参数设置、日常保养、常见故障处理。',
    systemPrompt: '你是一位设备工程师,把资料整理成实用操作手册。参数照原文,步骤清晰,不编造未给出的功能。',
    userPromptTemplate: `请把下面设备资料整理成操作手册:设备概述与功能、开机/操作/关机步骤、关键参数设置、日常点检保养、常见故障与处理。参数照原文。\n设备资料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.mfg-acceptance-report', label: '验收报告整理', shortLabel: '验收报告整理', icon: '✅',
    tags: ['制造', '整理', '验收'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.25,
    description: '把验收信息整理成验收报告:验收项、标准、结果、遗留问题、验收结论。',
    systemPrompt: '你是一位项目/质量工程师,整理规范验收报告。结果照原文,遗留问题如实列,结论客观。',
    userPromptTemplate: `请把下面验收信息整理成验收报告:项目概况、验收依据、验收项目与结果(表格)、遗留问题及处理计划、验收结论。结果照原文。\n验收信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.mfg-iso-check', label: 'ISO体系文件检查', shortLabel: 'ISO文件检查', icon: '📑',
    tags: ['制造', '核查', '体系'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '检查体系文件是否含必要要素(目的、范围、职责、流程、记录)、与上层文件是否冲突。',
    systemPrompt: '你是一位体系工程师,检查管理体系文件的规范性与一致性。命中片段原文逐字、反引号包裹;只标真问题。',
    userPromptTemplate: `请检查下面体系文件,关注:是否含必要要素(目的/范围/职责/流程/记录/引用文件)、职责是否明确、流程是否闭环、与上层方针程序是否矛盾、记录表单是否齐。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n文件:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.mfg-boq-extract', label: '工程量清单提取', shortLabel: '工程量提取', icon: '🧮',
    tags: ['制造', '提取', '工程量'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从工程说明/图纸提取工程量清单:项目、特征、单位、工程量,输出结构化便于组价。',
    systemPrompt: '你是一位造价员,从工程说明抽取工程量清单,输出严格 JSON,数量单位照原文,找不到留空。',
    userPromptTemplate: `请从下面工程说明提取工程量清单,输出严格 JSON:\n{"items":[{"code":"","name":"","feature":"","unit":"","quantity":""}]}\n工程说明:\n---\n{{input}}\n---` })
])

export function mergeManufacturingIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...MANUFACTURING_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { MANUFACTURING_BUILTIN_ASSISTANTS, mergeManufacturingIntoBuiltins }
