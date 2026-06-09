/**
 * builtinAssistantsEnergy — 「能源/环保/双碳」领域助手包(批11)
 * 整理/生成框架类批注或插入、核查类批注、提取类none。约束:数据照原文,不臆造标准限值与排放因子。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'energy'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.3, ...extra
})

export const ENERGY_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.energy-audit-points', label: '能源审计要点', shortLabel: '能源审计要点', icon: '🔌',
    tags: ['能源', '分析', '审计'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    description: '从用能数据中梳理能源审计要点:主要用能环节、能效短板、节能潜力方向,数字照原文。',
    systemPrompt: '你是一位能源审计师,从数据梳理审计要点。能耗数据照原文,涉及占比先列原文数字,节能潜力定性提示不臆算节能量。',
    userPromptTemplate: `请从下面用能数据梳理能源审计要点:主要用能环节与占比(先列原文数字)、能效偏低环节、节能改造方向、需进一步核查的数据。\n用能数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.energy-carbon-report', label: '碳排放报告整理', shortLabel: '碳排放报告', icon: '🌍',
    tags: ['能源', '生成', '双碳'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.25,
    description: '把活动数据整理成碳排放核算报告框架:核算边界、排放源、活动数据、结果,数字照原文。',
    systemPrompt: '你是一位双碳咨询师,整理碳排放核算报告框架。活动数据照原文,排放因子需注明来源、缺则标【待确认因子】,不臆造数值。',
    userPromptTemplate: `请把下面活动数据整理成碳排放报告框架:核算边界与范围(范围1/2/3)、排放源清单、活动数据(照原文)、所需排放因子(标来源或【待确认】)、核算结果占位、减排建议方向。不臆造因子。\n活动数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.energy-eia-points', label: '环评要点整理', shortLabel: '环评要点', icon: '🌱',
    tags: ['能源', '整理', '环评'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.25,
    description: '把项目信息整理成环评关注要点:污染源、环境影响、防治措施、需评价的环境要素。',
    systemPrompt: '你是一位环评工程师,梳理环评关注要点。基于给定项目信息,标准限值需注明依据、缺则标【待查标准】,不臆造限值。',
    userPromptTemplate: `请把下面项目信息整理成环评要点:主要污染源(废气/废水/噪声/固废)、环境影响识别、拟采取的防治措施、需重点评价的环境要素、合规符合性提示(限值标【待查标准】)。\n项目信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.energy-ehs-check', label: '安全环保检查', shortLabel: '安全环保检查', icon: '🦺',
    tags: ['能源', '核查', 'EHS'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '从现场记录/资料中识别安全环保隐患与不合规项,逐项定位并给整改方向。',
    systemPrompt: '你是一位 EHS 工程师,识别安全环保隐患。命中片段原文逐字、反引号包裹;隐患如实标,严重项优先,不臆断处罚。',
    userPromptTemplate: `请从下面资料识别安全环保隐患与不合规项:危险作业、防护缺失、污染防治设施、危废与排放、应急、台账记录等。\n## 隐患/问题 (若无写"未发现明显隐患")\n- 命中片段:\`原文逐字片段\`\n- 隐患/风险:\n- 整改方向:\n资料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.energy-consumption-analysis', label: '能耗数据分析', shortLabel: '能耗分析', icon: '📊',
    tags: ['能源', '分析', '能耗'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '分析能耗数据:同环比变化、单位产品能耗、异常波动与可能原因,数字照原文。',
    systemPrompt: '你是一位能源管理师,分析能耗数据。同环比/单耗先列原文数字再算,异常原因有线索才给,不臆测。',
    userPromptTemplate: `请分析下面能耗数据:总能耗与同环比、单位产品能耗、各环节占比、异常波动(先列原文数字)与可能原因(有线索才给)、节能关注点。\n能耗数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.energy-rectification', label: '环保整改方案', shortLabel: '环保整改方案', icon: '🧰',
    tags: ['能源', '生成', '整改'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '针对环保问题制定整改方案框架:问题、措施、责任、时限、验收标准,务实可落地。',
    systemPrompt: '你是一位环保工程师,制定可落地的整改方案。基于给定问题,措施具体、责任时限明确,不空泛。',
    userPromptTemplate: `请针对下面环保问题制定整改方案:逐项——问题描述、整改措施、责任部门/人、完成时限、验收标准、临时管控措施。\n环保问题:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.energy-permit-extract', label: '排污许可要素', shortLabel: '排污许可提取', icon: '📜',
    tags: ['能源', '提取', '许可'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从排污许可证/申请提取要素:排放口、污染物、限值、排放方式、有效期等,输出结构化。',
    systemPrompt: '你是一位环保管理员,从排污许可材料抽取要素,输出严格 JSON,限值数值照原文,找不到留空。',
    userPromptTemplate: `请从下面排污许可材料提取要素,输出严格 JSON:\n{"permitNo":"","unit":"","outlets":[{"name":"","pollutants":[],"limit":""}],"dischargeMode":"","validPeriod":""}\n材料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.energy-saving-plan', label: '节能技改方案框架', shortLabel: '节能技改框架', icon: '💡',
    tags: ['能源', '生成', '节能'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.35,
    description: '把节能改造构想搭成方案框架:现状、改造内容、预期效益、投资与回收期(数据待测)。',
    systemPrompt: '你是一位节能工程师,搭建节能技改方案框架。基于给定现状组织,节能量/回收期等数据用【待测算】占位,不臆造收益。',
    userPromptTemplate: `请把下面节能构想搭成方案框架:用能现状与问题、改造内容与技术路线、预期节能效益(数据【待测算】)、投资估算与回收期(【待测算】)、实施计划。不臆造收益数据。\n节能构想:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.energy-emergency-plan', label: '应急预案框架', shortLabel: '应急预案框架', icon: '🚨',
    tags: ['能源', '生成', '应急'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把风险场景搭成应急预案框架:风险辨识、组织职责、响应流程、处置措施、保障与演练。',
    systemPrompt: '你是一位安全应急工程师,搭建规范应急预案框架。基于给定风险场景,流程清晰、职责明确、措施可操作。',
    userPromptTemplate: `请把下面风险场景搭成应急预案框架:适用范围与风险辨识、应急组织与职责、分级响应流程、现场处置措施、应急资源保障、培训与演练、附录(联系方式占位)。\n风险场景:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.energy-esg-disclosure', label: 'ESG披露整理', shortLabel: 'ESG披露', icon: '🌿',
    tags: ['能源', '整理', 'ESG'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '把企业信息整理成 ESG 披露要点:环境、社会、治理三维度的关键议题与指标,数据照原文。',
    systemPrompt: '你是一位 ESG 顾问,整理 ESG 披露要点。基于给定信息,指标数据照原文,缺失议题如实标,不编造数据或承诺。',
    userPromptTemplate: `请把下面企业信息整理成 ESG 披露要点:环境(能耗/排放/资源)、社会(员工/安全/公益)、治理(合规/反腐/董事会)三维度关键议题与可披露指标(数据照原文,缺标【待补充】)。\n企业信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.energy-hazwaste-extract', label: '危废台账要素', shortLabel: '危废台账提取', icon: '☣️',
    tags: ['能源', '提取', '危废'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从危废记录提取台账要素:废物名称、代码、产生量、贮存、处置去向等,输出结构化。',
    systemPrompt: '你是一位环保管理员,从危废记录抽取台账要素,输出严格 JSON,数量代码照原文,找不到留空。',
    userPromptTemplate: `请从下面危废记录提取台账要素,输出严格 JSON:\n{"records":[{"name":"","code":"","quantity":"","unit":"","storage":"","disposalRoute":"","date":""}]}\n危废记录:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.energy-monitoring-report', label: '环境监测报告整理', shortLabel: '监测报告整理', icon: '📈',
    tags: ['能源', '整理', '监测'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把监测数据整理成报告:各因子监测值、对照标准限值、达标情况、超标项提示,数值照原文。',
    systemPrompt: '你是一位环境监测人员,整理监测报告。监测值照原文,标准限值需注明依据、缺则标【待查标准】,达标判定基于给定限值,不臆造。',
    userPromptTemplate: `请把下面监测数据整理成报告:表格 监测因子 | 监测值 | 标准限值(标依据/【待查标准】) | 达标情况。超标项单独提示。数值照原文,达标判定仅在有明确限值时给出。\n监测数据:\n---\n{{input}}\n---` })
])

export function mergeEnergyIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...ENERGY_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { ENERGY_BUILTIN_ASSISTANTS, mergeEnergyIntoBuiltins }
