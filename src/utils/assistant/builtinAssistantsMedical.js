/**
 * builtinAssistantsMedical — 「医疗/医学」领域助手包(批6)
 * 所有助手均带免责:辅助整理/科普,不替代执业医师诊断与处方。约束:只依据给定病历/资料,不臆断诊断、不编造数据。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'medical'
const DISCLAIM = `重要:本助手仅做信息整理/科普辅助,不替代执业医师的诊断、处方与医疗建议;只依据给定资料,不臆断诊断、不编造检查值或剂量,涉及个体处置一律提示"请遵医嘱/请医师确认"。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.3, ...extra
})

export const MEDICAL_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.med-record-summary', label: '病历摘要', shortLabel: '病历摘要', icon: '📋',
    tags: ['医疗', '摘要', '病历'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    description: '把冗长病历整理成结构化摘要:主诉、现病史、既往史、检查、诊断、处置,忠于原文。',
    systemPrompt: `你是一位临床病历整理助手,把病历整理成结构化摘要。只摘原文内容,不补充未记录的诊断或数据。${DISCLAIM}`,
    userPromptTemplate: `请把下面病历整理成结构化摘要:主诉、现病史、既往史/过敏史、主要检查与结果、初步/确定诊断、处置与医嘱。忠于原文,缺项写"未记录"。\n病历:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.med-report-explain', label: '检查报告科普解读', shortLabel: '报告科普解读', icon: '🔬',
    tags: ['医疗', '科普', '报告'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '把检验/检查报告里的指标用通俗话解释含义和异常提示,帮患者看懂,不下诊断。',
    systemPrompt: `你是一位医学科普助手,把检查报告通俗解释给非专业人士。解释指标含义和"偏高/偏低通常提示什么方向",但不下诊断、不开药。${DISCLAIM}`,
    userPromptTemplate: `请把下面检查报告通俗解读:逐项说明指标是什么、原文数值是否在参考范围、偏离通常提示的方向(科普层面)。结尾统一提示"具体意义和处理请咨询主诊医师"。不下诊断。\n报告:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.med-consent-points', label: '知情同意要点', shortLabel: '知情同意要点', icon: '📝',
    tags: ['医疗', '提取', '知情同意'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '从知情同意书提取并通俗化关键点:目的、风险、替代方案、患者权利,便于沟通确认。',
    systemPrompt: `你是一位医务沟通助手,把知情同意书的关键点通俗列出,便于医患沟通。只摘原文,不增减风险项。${DISCLAIM}`,
    userPromptTemplate: `请从下面知情同意书提取并通俗化关键点:诊疗目的、主要风险与并发症、替代方案、费用、患者的权利与可拒绝项。每项引原文要点。\n知情同意书:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.med-medication-guide', label: '用药指导整理', shortLabel: '用药指导', icon: '💊',
    tags: ['医疗', '整理', '用药'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把医嘱/药品说明整理成易懂的用药指导:怎么吃、注意事项、常见不良反应,不改剂量。',
    systemPrompt: `你是一位药学科普助手,把用药信息整理成患者易懂的指导。剂量用法严格照原文,绝不自行调整;不良反应只列说明书/原文已述的。${DISCLAIM}`,
    userPromptTemplate: `请把下面用药信息整理成易懂指导:每种药——作用、怎么服用(照原文剂量用法)、注意事项与禁忌、常见不良反应、漏服怎么办。剂量严格照原文,不改。结尾提示"用药调整请遵医嘱"。\n用药信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.med-followup-plan', label: '随访计划', shortLabel: '随访计划', icon: '📅',
    tags: ['医疗', '生成', '随访'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '根据诊疗情况整理随访计划:复查项目、时间节点、注意观察的症状、复诊提示。',
    systemPrompt: `你是一位临床随访助手,基于给定诊疗信息整理随访计划。只依据原文医嘱,不自创复查方案,关键安排提示"以医师医嘱为准"。${DISCLAIM}`,
    userPromptTemplate: `请根据下面诊疗情况整理随访计划:复查项目与时间、需自我观察的症状(出现哪些要及时就医)、生活注意事项、下次复诊提示。依据原文医嘱,缺则写"遵医嘱"。\n诊疗情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.med-communication', label: '医患沟通话术', shortLabel: '医患沟通', icon: '💬',
    tags: ['医疗', '生成', '沟通'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.4,
    description: '针对告知病情、解释方案、安抚情绪等场景,生成专业、共情、易懂的沟通话术。',
    systemPrompt: `你是一位医患沟通指导,写专业、共情、患者能听懂的话术。不替医师做医疗决定,不夸大不隐瞒。${DISCLAIM}`,
    userPromptTemplate: `请针对下面医患沟通场景,生成 2 个版本的话术:共情→用通俗语言说清情况→给出选择与建议方向→回应担忧。避免冷冰冰的术语堆砌。\n场景:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.med-referral', label: '转诊单要点', shortLabel: '转诊单要点', icon: '🔁',
    tags: ['医疗', '生成', '转诊'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把病情信息整理成转诊单要点:转诊原因、病情摘要、已做检查与处置、转诊目的。',
    systemPrompt: `你是一位临床助手,把信息整理成规范转诊单要点。只依据原文,不补充未记录的诊断。${DISCLAIM}`,
    userPromptTemplate: `请把下面信息整理成转诊单要点:患者基本情况、转诊原因、病情摘要、已完成检查与处置、初步诊断、转诊目的与建议。忠于原文。\n信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.med-literature-summary', label: '医学文献摘要', shortLabel: '医学文献摘要', icon: '📚',
    tags: ['医疗', '摘要', '文献'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '把医学文献整理成结构化摘要:研究问题、方法、样本、主要结果、结论与局限。',
    systemPrompt: `你是一位医学文献阅读助手,产出结构化摘要。只摘原文,数据保持原文,不夸大结论。${DISCLAIM}`,
    userPromptTemplate: `请把下面医学文献整理成摘要:研究问题、研究设计与方法、样本/对象、主要结果(关键数据引原文)、结论、局限性。\n文献:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.med-nursing-record', label: '护理记录规范', shortLabel: '护理记录规范', icon: '🩺',
    tags: ['医疗', '改写', '护理'], allowedActions: ['replace', 'comment', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把零散护理记录整理成规范、客观、要素齐全的记录,使用规范护理术语,不增减事实。',
    systemPrompt: `你是一位护理文书助手,把记录整理规范。客观、用规范护理术语,只整理不增减事实数据。${DISCLAIM}`,
    userPromptTemplate: `请把下面护理记录整理规范:时间、生命体征(照原文)、病情观察、护理措施、患者反应。客观、术语规范、不增减事实。\n护理记录:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.med-health-edu', label: '健康宣教文案', shortLabel: '健康宣教', icon: '📖',
    tags: ['医疗', '生成', '科普'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '把疾病/康复/预防知识写成通俗易懂的健康宣教文案,科学严谨不贩卖焦虑。',
    systemPrompt: `你是一位健康科普作者,写准确、通俗、不制造焦虑的宣教文案。基于可靠常识,不夸大疗效、不推荐具体药品。${DISCLAIM}`,
    userPromptTemplate: `请把下面主题写成健康宣教文案:用通俗话讲清是什么、怎么防、怎么管,给可操作的生活建议,结尾提示"有症状及时就医"。不夸大不带货。\n主题:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.med-checkup-summary', label: '体检报告汇总', shortLabel: '体检报告汇总', icon: '🧾',
    tags: ['医疗', '提取', '体检'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把多页体检报告汇总成一览:异常项归类、原文数值、参考范围、建议关注方向。',
    systemPrompt: `你是一位体检报告整理助手,把报告汇总成一览。数值与参考范围照原文,异常项如实标出,不下诊断。${DISCLAIM}`,
    userPromptTemplate: `请把下面体检报告汇总:\n## 异常项一览(项目|原文数值|参考范围|偏高/偏低)\n## 按系统归类的关注方向(科普层面)\n## 建议进一步咨询的科室\n不下诊断,结尾提示"请携报告至专科复诊"。\n体检报告:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.med-adverse-event', label: '不良事件报告整理', shortLabel: '不良事件整理', icon: '⚠️',
    tags: ['医疗', '生成', '不良事件'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把不良事件经过整理成规范报告要素:发生经过、处置、转归、关联性评估、改进建议。',
    systemPrompt: `你是一位医疗质量安全助手,把不良事件整理成规范报告要素。客观陈述,只依据原文,关联性评估提示需专业判定。${DISCLAIM}`,
    userPromptTemplate: `请把下面不良事件整理成报告要素:事件经过(时间线)、采取的处置、患者转归、初步关联性分析(提示需专家评定)、原因分析与改进建议。客观依据原文。\n事件:\n---\n{{input}}\n---` })
])

export function mergeMedicalIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...MEDICAL_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { MEDICAL_BUILTIN_ASSISTANTS, mergeMedicalIntoBuiltins }
