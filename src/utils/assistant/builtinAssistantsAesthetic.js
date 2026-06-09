/**
 * builtinAssistantsAesthetic — 「美业/医美」领域助手包(批14·手写补)
 * 全部带免责:不替代执业医师面诊与诊疗;医美广告合规从严,不夸大不承诺效果。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'aesthetic'
const DIS = '重要:本助手仅作信息整理/沟通辅助,不替代执业医师的面诊、评估与诊疗方案;医美宣传须合规,不得夸大效果、承诺疗效、贬低他人或制造容貌焦虑。'
const base = (extra) => ({
  group:'analysis', domain:DOMAIN, modelType:'chat', defaultModelCategory:'chat',
  supportsRibbon:false, defaultDisplayLocations:['ribbon-more'],
  defaultInputSource:INPUT_SOURCE_DOCUMENT, defaultOutputFormat:'markdown', temperature:0.4, ...extra
})
export const AESTHETIC_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id:'analysis.aes-project-intro', label:'项目介绍文案', shortLabel:'项目介绍', icon:'💆',
    tags:['医美','生成','文案'], allowedActions:['insert','append','replace','none'], defaultAction:'insert', temperature:0.4,
    description:'把医美/美业项目写成客观介绍:适合需求、过程、感受、恢复期,合规不夸大不承诺效果。',
    systemPrompt:`你是一位医美内容编辑,写客观、合规的项目介绍。只用给定信息,不夸大效果、不承诺、不制造焦虑、不贬低其他项目。${DIS}`,
    userPromptTemplate:'请把下面项目写成介绍文案:适合的需求人群、大致过程、术中术后感受、恢复期与维持、注意与禁忌提示。客观合规、不承诺效果。\n项目信息:\n---\n{{input}}\n---' }),
  base({ id:'analysis.aes-pre-post-care', label:'术前术后须知', shortLabel:'术前术后须知', icon:'📋',
    tags:['医美','生成','护理'], allowedActions:['insert','append','comment','none'], defaultAction:'comment', temperature:0.2,
    description:'把项目整理成术前术后须知:术前准备与禁忌、术后护理与注意、异常处理与复诊提示。',
    systemPrompt:`你是一位医美护理助手,整理清晰的术前术后须知。基于给定项目,关键医疗判断提示"遵医嘱",异常情况建议及时联系机构/就医。${DIS}`,
    userPromptTemplate:'请把下面项目整理成术前术后须知:术前准备与禁忌(用药/经期/过敏等)、术后即时与日常护理、饮食与活动注意、可能反应与异常处理、复诊时间。关键处提示遵医嘱。\n项目信息:\n---\n{{input}}\n---' }),
  base({ id:'analysis.aes-consent', label:'知情同意要点', shortLabel:'知情同意要点', icon:'📝',
    tags:['医美','提取','知情同意'], allowedActions:['comment','append','insert','none'], defaultAction:'comment', temperature:0.2,
    description:'把医美知情同意整理成易懂要点:项目原理、风险与并发症、替代方案、费用与权利,不增减风险。',
    systemPrompt:`你是一位医美合规助手,把知情同意整理成易懂要点。忠于原文,风险与并发症如实列、不淡化,便于充分告知。${DIS}`,
    userPromptTemplate:'请把下面知情同意整理成要点:项目原理与预期、主要风险与并发症、个体差异与效果不确定性、替代方案、费用、术后责任与权利。忠于原文、不淡化风险。\n知情同意:\n---\n{{input}}\n---' }),
  base({ id:'analysis.aes-consult-script', label:'医美咨询话术', shortLabel:'咨询话术', icon:'💬',
    tags:['医美','生成','咨询'], allowedActions:['insert','append','none'], defaultAction:'insert', temperature:0.4,
    description:'生成专业、合规的医美咨询话术:了解需求、客观说明、风险告知、引导面诊,不施压不焦虑营销。',
    systemPrompt:`你是一位医美咨询师,写专业、真诚、合规的咨询话术。如实告知风险与不确定性,不承诺效果、不制造容貌焦虑、不施压逼单,引导专业面诊。${DIS}`,
    userPromptTemplate:'请生成医美咨询话术:了解需求与期望、客观介绍可选方案、如实告知风险与效果不确定性、费用透明、引导预约专业面诊。真诚不施压、不制造焦虑。\n咨询场景:\n---\n{{input}}\n---' }),
  base({ id:'analysis.aes-client-record', label:'客户档案整理', shortLabel:'客户档案', icon:'🗂️',
    tags:['医美','整理','档案'], allowedActions:['comment','append','insert','none'], defaultAction:'comment', temperature:0.2,
    description:'把客户信息整理成档案要点:需求、既往与禁忌、已做项目、护理记录与回访,客观保护隐私。',
    systemPrompt:`你是一位医美顾问,整理规范客户档案。只记给定信息,客观、保护隐私,不下医疗结论。${DIS}`,
    userPromptTemplate:'请把下面客户信息整理成档案:基本情况与需求、既往史与过敏/禁忌、已做项目与时间、护理与反应记录、回访与下一步。客观、保护隐私。\n客户信息:\n---\n{{input}}\n---' }),
  base({ id:'analysis.aes-ad-compliance', label:'医美广告合规检查', shortLabel:'医美广告合规', icon:'🚧',
    tags:['医美','核查','合规'], allowedActions:['comment','link-comment','append','none'], defaultAction:'comment', temperature:0.15,
    description:'严格检查医美宣传违规:夸大/承诺效果、前后对比、治愈率、制造容貌焦虑、贬低、违禁词,逐字定位。',
    systemPrompt:`你是一位医美广告合规审核(从严),识别违规表述。命中片段原文逐字、反引号包裹;医美广告禁止保证效果、利用案例做证明、制造焦虑、违背公序良俗;只标确有问题处。${DIS}`,
    userPromptTemplate:'请从严检查下面医美宣传,关注:夸大或承诺效果("一次见效/永久")、效果前后对比/案例证明、治愈率成功率、制造容貌焦虑、贬低自然条件或他人、绝对化用语、未标明医疗风险。\n## 违规风险 (若无写"未发现明显违规")\n- 命中片段:`原文逐字片段`\n- 问题:\n- 建议改为:\n宣传内容:\n---\n{{input}}\n---' }),
  base({ id:'analysis.aes-plan', label:'项目方案说明', shortLabel:'项目方案说明', icon:'📐',
    tags:['医美','生成','方案'], allowedActions:['insert','append','comment','none'], defaultAction:'comment', temperature:0.3,
    description:'把面诊建议整理成项目方案说明:针对需求的方案、阶段、周期与维持、费用与风险,客观待面诊确认。',
    systemPrompt:`你是一位医美顾问,把方案整理成客观说明。基于给定面诊建议,效果不确定性如实说明,最终以医师面诊为准,不承诺。${DIS}`,
    userPromptTemplate:'请把下面面诊建议整理成项目方案说明:针对的需求、建议项目与阶段、周期与维持、预期与不确定性、费用、风险与禁忌。注明以医师面诊为准、效果因人而异。\n面诊建议:\n---\n{{input}}\n---' }),
  base({ id:'analysis.aes-followup', label:'术后随访关怀', shortLabel:'术后随访', icon:'📅',
    tags:['医美','生成','随访'], allowedActions:['insert','append','comment','none'], defaultAction:'comment', temperature:0.3,
    description:'生成术后随访关怀话术/提醒:恢复观察、护理提醒、异常处理与复诊,专业有温度。',
    systemPrompt:`你是一位医美客户关系,写专业有温度的术后随访。基于给定项目提醒护理与观察,异常情况建议及时联系机构/就医。${DIS}`,
    userPromptTemplate:'请根据下面项目生成术后随访关怀(分时间节点):恢复情况询问、护理与注意提醒、可能反应与异常处理、复诊预约。专业有温度。\n项目与节点:\n---\n{{input}}\n---' }),
  base({ id:'analysis.aes-pricelist', label:'价目表说明', shortLabel:'价目表说明', icon:'💴',
    tags:['医美','整理','价目'], allowedActions:['comment','append','insert','none'], defaultAction:'comment', temperature:0.15,
    description:'把价目整理成透明说明:项目、价格、含/不含项、套餐与有效期,金额照原文不藏坑。',
    systemPrompt:`你是一位医美顾问,把价目整理透明清楚。金额照原文,明确含与不含、套餐规则与有效期,不藏附加费、不诱导。${DIS}`,
    userPromptTemplate:'请把下面价目整理成说明:项目 | 价格 | 包含内容 | 不含项 | 套餐与有效期 | 备注。金额照原文,透明不藏坑。\n价目信息:\n---\n{{input}}\n---' }),
  base({ id:'analysis.aes-risk-notice', label:'风险告知书', shortLabel:'风险告知', icon:'⚠️',
    tags:['医美','生成','风险'], allowedActions:['insert','append','comment','none'], defaultAction:'comment', temperature:0.2,
    description:'把项目风险整理成告知书:常见风险与并发症、个体差异、注意事项与应急,如实充分不淡化。',
    systemPrompt:`你是一位医美合规助手,撰写如实、充分的风险告知。基于给定项目客观列风险,不淡化、不承诺,强调因人而异与遵医嘱。${DIS}`,
    userPromptTemplate:'请把下面项目整理成风险告知书:常见风险与并发症、效果的个体差异与不确定性、术后注意与禁忌、异常情况的应急与就医、需如实告知机构的情况。如实充分不淡化。\n项目信息:\n---\n{{input}}\n---' }),
  base({ id:'analysis.aes-complaint-reply', label:'医美客诉回复', shortLabel:'医美客诉', icon:'🤝',
    tags:['医美','生成','客诉'], allowedActions:['insert','append','replace','none'], defaultAction:'insert', temperature:0.35,
    description:'针对效果/服务/恢复投诉写专业回复:共情、说明、安排面诊复查与方案,负责不推诿不承诺。',
    systemPrompt:`你是一位医美客户关系,写共情、专业、负责的客诉回复。依据给定情况,涉及医疗效果引导面诊复查由医师评估,不推诿、不空头承诺。${DIS}`,
    userPromptTemplate:'请针对下面医美投诉写回复:共情致歉→说明与重视→安排专业面诊/复查由医师评估→后续方案与跟进→安抚。负责不推诿、不承诺结果。\n投诉:\n---\n{{input}}\n---' }),
  base({ id:'analysis.aes-effect-compliance', label:'效果描述合规检查', shortLabel:'效果描述合规', icon:'🔍',
    tags:['医美','核查','合规'], allowedActions:['comment','link-comment','append','none'], defaultAction:'comment', temperature:0.15,
    description:'专项检查效果描述是否合规:有无保证/夸大/绝对化、是否标明因人而异与风险,逐字定位给替代。',
    systemPrompt:`你是一位医美合规审核,专查效果描述。命中片段原文逐字、反引号包裹;效果描述须客观、标明因人而异、不保证不夸大;给合规替代表述。${DIS}`,
    userPromptTemplate:'请专项检查下面文案的效果描述是否合规:有无"保证/永久/一定/最"等保证或绝对化、是否夸大、是否标明效果因人而异与存在风险。\n## 问题项 (若无写"未发现明显问题")\n- 命中片段:`原文逐字片段`\n- 问题:\n- 合规改法:\n文案:\n---\n{{input}}\n---' })
])
export function mergeAestheticIntoBuiltins(base=[]){const ids=new Set(base.map(x=>x&&x.id));return [...base,...AESTHETIC_BUILTIN_ASSISTANTS.filter(x=>x&&!ids.has(x.id))]}
export default { AESTHETIC_BUILTIN_ASSISTANTS, mergeAestheticIntoBuiltins }
