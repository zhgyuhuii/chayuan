/**
 * builtinAssistantsAutomotive — 「汽车/交通」领域助手包(批12)
 * 整理/生成类批注或插入、核查类批注。约束:车况/参数照原文,不编造故障结论,审查类逐字锚点。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'automotive'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.3, ...extra
})

export const AUTOMOTIVE_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.auto-inspection-report', label: '车况检测报告', shortLabel: '车况报告', icon: '🚗',
    tags: ['汽车', '整理', '检测'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把检测数据整理成车况报告:各系统状态、问题项、建议处理,数据照原文不臆断。',
    systemPrompt: '你是一位汽车检测技师,把检测数据整理成报告。读数照原文,问题如实标,处理建议基于检测结果不臆断。',
    userPromptTemplate: `请把下面检测数据整理成车况报告:外观/发动机/底盘/电气/轮胎等各系统状态、发现的问题(及严重程度)、建议处理与优先级。读数照原文。\n检测数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.auto-used-car-desc', label: '二手车描述', shortLabel: '二手车描述', icon: '🔑',
    tags: ['汽车', '文案', '二手车'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '把车辆信息写成可信的二手车描述:车况、配置、亮点、如实瑕疵,诚信不隐瞒。',
    systemPrompt: '你是一位二手车顾问,写可信、如实的车辆描述。配置里程照原文,亮点实说、瑕疵不隐瞒,不编造事故记录信息。',
    userPromptTemplate: `请把下面车辆信息写成二手车描述:车型年份里程、核心配置、车况亮点、如实瑕疵告知、适合人群。诚信不夸大,里程参数照原文。\n车辆信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.auto-repair-order', label: '维修工单整理', shortLabel: '维修工单', icon: '🔧',
    tags: ['汽车', '整理', '维修'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把维修描述整理成规范工单:故障现象、检查、维修项目、更换件、工时与费用,数字照原文。',
    systemPrompt: '你是一位维修接待,把信息整理成规范工单。配件工时费用照原文,合计先列原文数字,客观清楚。',
    userPromptTemplate: `请把下面维修信息整理成工单:故障现象、检查结论、维修项目、更换配件(及数量/单价)、工时费、合计(先列原文数字)、注意事项。\n维修信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.auto-maintenance-advice', label: '保养建议', shortLabel: '保养建议', icon: '🛢️',
    tags: ['汽车', '生成', '保养'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '根据车况和里程给保养建议:该做哪些项目、周期提醒、注意事项,实用不过度推销。',
    systemPrompt: '你是一位汽车保养顾问,给实用、不过度推销的保养建议。基于给定里程车况,按常规周期提示,不夸大必要性。',
    userPromptTemplate: `请根据下面车况与里程给保养建议:当前应做的保养项目、各项周期提醒、需关注的部件、用车注意事项。实用不过度推销。\n车况与里程:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.auto-insurance-claim', label: '车险理赔要点', shortLabel: '车险理赔', icon: '📋',
    tags: ['汽车', '生成', '理赔'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '根据出险情况整理车险理赔要点:报案、定损、材料、流程与注意,具体以保险公司为准。',
    systemPrompt: '你是一位车险理赔协助,整理理赔要点。基于常见流程提示,提醒保留证据,具体以保险公司要求为准,不臆断赔付。',
    userPromptTemplate: `请根据下面出险情况整理车险理赔要点:报案时限与方式、现场证据保留、定损流程、所需材料、注意事项(勿擅自修理等)。具体以保险公司为准。\n出险情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.auto-purchase-contract', label: '购车合同审查', shortLabel: '购车合同审查', icon: '📑',
    tags: ['汽车', '核查', '合同'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查购车合同对买方不利之处:车价与附加费、交车时间、定金、配置承诺、违约责任。',
    systemPrompt: '你是一位汽车消费法务,审查购车合同对买方的风险。命中片段原文逐字、反引号包裹;不确定标「待人工核实」;不替代律师。',
    userPromptTemplate: `请审查下面购车合同,关注:车价构成与隐藏附加费、定金与退订、交车时间与违约、配置与赠品承诺是否写入、贷款捆绑、质保与三包。\n## 风险/不利条款 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n合同:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.auto-sales-script', label: '汽车销售话术', shortLabel: '汽车销售话术', icon: '🗣️',
    tags: ['汽车', '生成', '销售'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '为车型准备销售话术:卖点呈现、对比竞品、化解顾虑、促成,专业真诚不忽悠。',
    systemPrompt: '你是一位金牌汽车销售,写专业真诚的话术。基于车型真实卖点,对比客观,顾虑正面回应,不诋毁竞品不夸大。',
    userPromptTemplate: `请为下面车型准备销售话术:核心卖点呈现、与竞品的客观对比、针对常见顾虑(价格/油耗/保值)的回应、促成下一步。专业真诚。\n车型情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.auto-spec-explain', label: '车辆参数说明', shortLabel: '参数说明', icon: '📊',
    tags: ['汽车', '生成', '参数'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把车辆参数表用大白话解释:这些参数意味着什么、对用车体验的影响,帮客户看懂。',
    systemPrompt: '你是一位汽车顾问,把参数通俗解释。参数照原文,只解释含义与实际影响,不夸大性能。',
    userPromptTemplate: `请把下面车辆参数用大白话解释:逐项参数是什么、数值意味着什么、对日常用车的实际影响。参数照原文,客观。\n车辆参数:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.auto-fault-diagnosis', label: '故障诊断说明', shortLabel: '故障诊断', icon: '🚨',
    tags: ['汽车', '分析', '诊断'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '根据故障现象/故障码梳理可能原因与排查方向,帮助定位,不替代实车检修。',
    systemPrompt: '你是一位汽车诊断技师,梳理可能原因与排查方向。基于给定现象分析,原因按可能性排,提示需实车检测确认,不下定论。',
    userPromptTemplate: `请根据下面故障现象/故障码梳理:\n## 现象理解\n## 可能原因(按可能性排序)\n## 建议排查步骤\n(以实车检测为准,不下绝对结论)\n故障信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.auto-recall-notice', label: '召回通知', shortLabel: '召回通知', icon: '📢',
    tags: ['汽车', '生成', '召回'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把召回信息写成规范召回通知:涉及车型、问题、风险、免费处理方式、预约方式。',
    systemPrompt: '你是一位厂商客户关系,写规范、负责任的召回通知。信息照原文,如实告知风险与处理,不淡化问题。',
    userPromptTemplate: `请把下面召回信息写成召回通知:涉及车型与范围、存在的问题与潜在风险、免费处理措施、预约方式与时间、客服联系方式、致歉。\n召回信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.auto-testdrive-invite', label: '试驾邀约', shortLabel: '试驾邀约', icon: '🏁',
    tags: ['汽车', '生成', '邀约'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '写试驾邀约信息/话术:车型亮点、试驾体验点、优惠钩子、预约引导,不打扰不夸大。',
    systemPrompt: '你是一位汽车销售,写不让人反感的试驾邀约。基于车型与活动,给真实体验点与钩子,不夸大不骚扰。',
    userPromptTemplate: `请根据下面车型与活动写试驾邀约(短信/微信各一版):亮点+试驾能体验到什么+优惠钩子+预约方式。简短不打扰。\n车型与活动:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.auto-dispatch-notice', label: '运输调度通知', shortLabel: '调度通知', icon: '🚛',
    tags: ['交通', '生成', '调度'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.2,
    description: '把调度安排写成清晰的运输/车辆调度通知:任务、车辆人员、时间路线、注意事项。',
    systemPrompt: '你是一位运输调度员,写清楚、无歧义的调度通知。时间车牌人员照原文,任务明确,安全提示到位。',
    userPromptTemplate: `请把下面调度安排写成调度通知:任务内容、车辆与司机、装卸/到发时间、路线、注意与安全提示、联系人。信息照原文,缺则【待补充】。\n调度安排:\n---\n{{input}}\n---` })
])

export function mergeAutomotiveIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...AUTOMOTIVE_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { AUTOMOTIVE_BUILTIN_ASSISTANTS, mergeAutomotiveIntoBuiltins }
