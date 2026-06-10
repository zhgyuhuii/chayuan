/**
 * builtinAssistantsManufacturingExt — 「制造/工程」领域助手扩展包
 * 在 builtinAssistantsManufacturing 之外补充高频、互不重复的文书/核查/抽取助手。
 * 与基础包不重叠:基础包已覆盖规格书/工艺流程/质检报告/BOM/SOP/安全作业/不合格品(NCR描述)/
 * 工程变更/设备手册/验收报告/ISO核查/工程量;本扩展包覆盖 FMEA、8D闭环、首件检验、来料检验、
 * 设备保养计划、维修工单提取、作业风险评估(JSA打分)、计量器具台账提取、化学品安全告知卡、整改通知单。
 * 约束:技术参数/数值/标准号照原文,不臆造;数字先列原文再算。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'manufacturing'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const MANUFACTURING_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.mfg-fmea-draft', label: '过程FMEA起草', shortLabel: 'FMEA起草', icon: '🧯',
    tags: ['制造', '生成', '风险'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.35,
    description: '把工序与失效信息起草成过程 FMEA 表:潜在失效模式、后果、原因、现行控制、严酷度/频度/探测度与建议措施。',
    systemPrompt: '你是一位制造业可靠性工程师,起草过程 FMEA(PFMEA)。基于给定工序信息识别失效模式,严酷度/频度/探测度(S/O/D)如原文未给则标"待评分"不臆造分值;失效后果与原因要贴合工序实际,用具体人话,不堆套话。',
    userPromptTemplate: `请把下面工序信息起草成过程 FMEA。逐个潜在失效模式给出一行表格:工序/功能 | 潜在失效模式 | 失效后果 | 严酷度S | 潜在原因 | 现行预防控制 | 现行探测控制 | 频度O | 探测度D | 建议措施 | 责任。S/O/D 原文未给写"待评分",不要编分数。措施要可执行。\n工序信息:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.mfg-8d-draft', label: '8D报告起草', shortLabel: '8D报告', icon: '🛠',
    tags: ['制造', '生成', '质量'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.35,
    description: '把质量问题信息起草成 8D 闭环报告:D1团队到 D8 总结,含根本原因与纠正预防措施(区别于只描述现象的不合格品报告)。',
    systemPrompt: '你是一位制造业质量改进工程师,起草 8D 问题解决报告。问题描述与数据照原文,根本原因区分"发生原因/流出原因",未经确认的原因标注"需现场验证",不替团队下定论,不堆排比句。',
    userPromptTemplate: `请把下面质量问题起草成 8D 报告,逐项写:\nD1 团队成员(原文未给写"待定")\nD2 问题描述(对象/缺陷/数量/批次,照原文)\nD3 临时遏制措施(ICA)\nD4 根本原因分析(分"发生原因"与"流出原因",未验证的标"需现场验证")\nD5 永久纠正措施(PCA)\nD6 措施实施与效果验证\nD7 预防再发(横展)\nD8 总结与团队认可\n问题信息:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.mfg-fai-report', label: '首件检验报告', shortLabel: '首件检验', icon: '🥇',
    tags: ['制造', '整理', '检验'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.25,
    description: '把首件实测数据整理成首件检验报告(FAI):图纸尺寸要求、实测值、单边/双边公差判定、首件结论(区别于批量质检报告)。',
    systemPrompt: '你是一位制造业检验工程师,整理首件检验报告(FAI)。图纸要求值与实测值严格照原文,判定按公差范围;若实测值缺失标"未测",不补数;结论客观,不臆造合格。',
    userPromptTemplate: `请把下面首件检验数据整理成首件检验报告(FAI):零件/图号信息、检验项表格 序号 | 图纸要求(含公差) | 实测值 | 判定(合格/超差/未测)。逐项判定先看实测是否在公差内。对超差项额外批注:\n- 超差项:\`原文逐字片段\`\n- 问题:实测超出公差\n- 建议:\n末尾给首件结论(批准首件/不批准/需复测)。数值照原文。\n首件数据:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.mfg-iqc-report', label: '来料检验报告', shortLabel: '来料检验', icon: '📥',
    tags: ['制造', '整理', '来料'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.25,
    description: '把进料检验信息整理成 IQC 来料检验报告:供应商、批次、抽样、检验项与结果、AQL判定、处置(区别于内部首件/质检)。',
    systemPrompt: '你是一位制造业来料质量(IQC)工程师,整理来料检验报告。供应商/批次/数量/抽样数照原文,合格率统计先列原文数字再算,不臆造 AQL 接收准则,缺项标"待确认"。',
    userPromptTemplate: `请把下面来料信息整理成 IQC 来料检验报告:供应商与物料(名称/规格/批次/到货数量)、抽样方案(抽样数/缺陷分类)、检验项表格 检验项 | 标准要求 | 实测/外观 | 判定、不合格数与不良率(先列原文数字再算)、处置(接收/退货/让步/挑选)。对不合格项额外批注:\n- 不合格项:\`原文逐字片段\`\n- 问题:\n- 建议处置:\n来料信息:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.mfg-maint-plan', label: '设备保养计划', shortLabel: '保养计划', icon: '🗓',
    tags: ['制造', '生成', '设备'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.35,
    description: '把设备点检保养要点编成预防性保养(TPM)计划:日/周/月/年保养项、周期、标准、责任与判定(区别于设备操作手册)。',
    systemPrompt: '你是一位制造业设备(TPM)工程师,编制预防性保养计划。保养周期与标准值照原文,原文未给周期的标"建议(待核定)"不强行编;润滑/紧固/清洁等项要贴合给定设备,不罗列与该设备无关的项。',
    userPromptTemplate: `请把下面设备保养要点编成预防性保养计划:按周期分组(日保/周保/月保/年保),每项一行表格 保养项目 | 周期 | 保养标准/判定值 | 所需工具耗材 | 责任岗位。标准值照原文,缺周期标"建议(待核定)"。末尾列安全注意事项。\n设备保养要点:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.mfg-repair-order-extract', label: '维修工单要素提取', shortLabel: '维修工单提取', icon: '🔩',
    tags: ['制造', '提取', '维修'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从维修记录/报修信息提取设备维修工单要素:设备、故障现象、原因、处理、更换备件、停机时长,输出结构化。',
    systemPrompt: '你是一位制造业设备管理员,从维修记录抽取工单要素,输出严格 JSON。设备编号/停机时长/备件数量照原文,找不到留空字符串,不臆造原因或时长。',
    userPromptTemplate: `请从下面维修记录提取维修工单要素,输出严格 JSON(找不到的字段留空,不要编造):\n{"orderNo":"","equipmentNo":"","equipmentName":"","faultTime":"","symptom":"","rootCause":"","action":"","parts":[{"name":"","qty":""}],"downtime":"","repairman":"","status":""}\n维修记录:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.mfg-jsa-assess', label: '作业风险评估JSA', shortLabel: 'JSA风险评估', icon: '⛑',
    tags: ['制造', '核查', '风险'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '对作业步骤做工作安全分析(JSA/JHA):逐步骤辨识危险、评估风险等级、给出控制措施(区别于生成式安全作业指导书)。',
    systemPrompt: '你是一位制造业 EHS(安全)工程师,做工作安全分析(JSA)。逐步骤辨识危险,命中需评估的高风险步骤时引用原文逐字片段并反引号包裹;风险等级(可能性×后果)如原文未给量化值则按高/中/低定性判断并说明依据,不编具体分值。安全建议仅辅助,不替代专业安全管理人员现场评估。',
    userPromptTemplate: `请对下面作业逐步骤做工作安全分析(JSA)。每个步骤给出:\n- 作业步骤:\`原文逐字片段\`\n- 潜在危险/伤害类型:\n- 风险等级(高/中/低,说明依据):\n- 控制措施(消除/工程/管理/PPE 优先序):\n若某步骤无明显危险写"未发现明显危险"。本分析仅辅助,不替代专业安全人员现场评估。\n作业步骤:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.mfg-gauge-ledger-extract', label: '计量器具台账提取', shortLabel: '计量器具台账', icon: '📏',
    tags: ['制造', '提取', '计量'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从校准/器具清单提取计量器具台账:器具名称、编号、量程、精度、校准日期、有效期、状态,输出结构化便于管控周期。',
    systemPrompt: '你是一位制造业计量(校准)管理员,从清单抽取计量器具台账,输出严格 JSON。编号/量程/精度/日期照原文,找不到留空,不臆造校准周期或有效期。',
    userPromptTemplate: `请从下面器具清单提取计量器具台账,输出严格 JSON(缺失留空,不要编造):\n{"items":[{"name":"","assetNo":"","range":"","accuracy":"","lastCalibration":"","validUntil":"","cycle":"","status":""}]}\n器具清单:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.mfg-chem-card', label: '化学品安全告知卡', shortLabel: '化学品告知卡', icon: '☣',
    tags: ['制造', '生成', '危化'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把化学品信息整理成岗位化学品安全告知卡:危险性、防护、应急、急救要点,贴现场可用(区别于通用安全作业指导)。',
    systemPrompt: '你是一位制造业危化品(EHS)管理员,整理岗位化学品安全告知卡。危险性分类/防护/急救信息只用给定内容,原文未给的关键项标"参见 SDS",不臆造危险类别或急救剂量。本告知卡仅辅助,不替代正式 SDS 与专业安全人员。',
    userPromptTemplate: `请把下面化学品信息整理成岗位安全告知卡,分块写:品名与成分、危险性(理化/健康/环境,照原文,缺项标"参见 SDS")、个体防护(呼吸/手/眼/身体)、操作与储存注意、泄漏/火灾应急处置、急救措施(眼/皮肤/吸入/食入)、应急电话。本卡仅辅助,不替代正式 SDS。\n化学品信息:\n---\n{{input}}\n---` }),

  base({ id: 'analysis.mfg-rectify-notice', label: '质量整改通知单', shortLabel: '整改通知单', icon: '📨',
    tags: ['制造', '生成', '整改'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.35,
    description: '把质量/现场问题写成整改通知单:问题描述、违反依据、整改要求、期限、复查方式(下行式正式文书,区别于NCR与8D)。',
    systemPrompt: '你是一位制造业质量/现场管理负责人,起草整改通知单。问题事实与数据照原文,违反的标准/制度若原文未指明则写"违反相关作业规定"不臆造具体条款号;整改要求具体可验证,语气正式但不空话。',
    userPromptTemplate: `请把下面问题写成质量整改通知单:受文部门/责任人、问题描述(时间/地点/事实,照原文)、违反依据(原文未指明写"违反相关作业规定")、整改要求(具体、可验证)、整改期限、复查/验收方式、发文部门与日期占位。\n问题信息:\n---\n{{input}}\n---` })
])

export function mergeManufacturingExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...MANUFACTURING_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}
export default { MANUFACTURING_EXT_BUILTIN_ASSISTANTS, mergeManufacturingExtIntoBuiltins }
