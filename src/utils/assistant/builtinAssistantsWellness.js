/**
 * builtinAssistantsWellness — 「健康养生」领域助手包(批14·手写补)
 * 全部带免责:养生/科普性质,不替代医疗诊断与治疗,不推荐具体药品。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'wellness'
const DIS = '重要:本助手为养生/健康科普辅助,不替代执业医师的诊断与治疗、不推荐具体药品;有疾病或症状请及时就医,涉及个体调理一律提示咨询专业人士。'
const base = (extra) => ({
  group:'analysis', domain:DOMAIN, modelType:'chat', defaultModelCategory:'chat',
  supportsRibbon:false, defaultDisplayLocations:['ribbon-more'],
  defaultInputSource:INPUT_SOURCE_DOCUMENT, defaultOutputFormat:'markdown', temperature:0.4, ...extra
})
export const WELLNESS_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id:'analysis.well-science', label:'养生科普', shortLabel:'养生科普', icon:'🌿',
    tags:['养生','生成','科普'], allowedActions:['insert','append','replace','none'], defaultAction:'insert', temperature:0.5,
    description:'把养生主题写成准确、通俗、不夸大的科普,讲清原理与可行做法,不贩卖焦虑不带货。',
    systemPrompt:`你是一位健康科普作者,写准确、通俗、循证的养生科普。不夸大功效、不贩卖焦虑、不推荐具体保健品/药品。${DIS}`,
    userPromptTemplate:'请把下面养生主题写成科普:通俗讲清是怎么回事、有据可循的做法、常见误区、何时需就医。不夸大不带货。\n主题:\n---\n{{input}}\n---' }),
  base({ id:'analysis.well-seasonal-diet', label:'节气食养建议', shortLabel:'节气食养', icon:'🍵',
    tags:['养生','生成','食养'], allowedActions:['insert','append','none'], defaultAction:'insert', temperature:0.5,
    description:'按节气/季节给食养建议:当季食材、简单食谱、起居要点,温和通用不针对个体病情。',
    systemPrompt:`你是一位食养顾问,给温和、通用的节气食养建议。基于常识,不针对个体开方、不夸大食疗功效。${DIS}`,
    userPromptTemplate:'请按下面节气/季节给食养建议:当季宜吃食材、2-3个简单食谱、起居与作息要点、需注意人群提示(孕妇/慢病者咨询医生)。温和通用。\n节气/季节:\n---\n{{input}}\n---' }),
  base({ id:'analysis.well-health-edu', label:'健康宣教', shortLabel:'健康宣教', icon:'📋',
    tags:['养生','生成','宣教'], allowedActions:['insert','append','replace','none'], defaultAction:'insert', temperature:0.4,
    description:'把健康主题写成通俗宣教材料:是什么、怎么防、怎么管、何时就医,科学严谨。',
    systemPrompt:`你是一位健康教育工作者,写科学、通俗的宣教材料。基于可靠常识,不夸大不制造焦虑,明确就医指征。${DIS}`,
    userPromptTemplate:'请把下面主题写成健康宣教:通俗讲清是什么、如何预防、日常如何管理、出现哪些情况要及时就医。科学严谨。\n主题:\n---\n{{input}}\n---' }),
  base({ id:'analysis.well-constitution', label:'体质调理建议', shortLabel:'体质调理', icon:'🧘',
    tags:['养生','生成','调理'], allowedActions:['comment','append','insert','none'], defaultAction:'comment', temperature:0.4,
    description:'根据描述给通用的体质调理方向(饮食/作息/运动/情志),作生活建议非诊疗,提示就医。',
    systemPrompt:`你是一位养生顾问,给生活方式层面的通用调理建议。不做中医辨证诊断、不开方,涉及不适提示就医。${DIS}`,
    userPromptTemplate:'请根据下面描述给通用调理建议(生活方式层面):饮食、作息、运动、情志各方向的温和建议,以及需注意/就医的情况。不辨证开方。\n描述:\n---\n{{input}}\n---' }),
  base({ id:'analysis.well-exercise', label:'运动养生计划', shortLabel:'运动养生', icon:'🏃',
    tags:['养生','生成','运动'], allowedActions:['insert','append','none'], defaultAction:'insert', temperature:0.4,
    description:'根据目标和身体状况给温和的运动养生计划:项目、强度、频率、注意,循序渐进不冒进。',
    systemPrompt:`你是一位运动养生顾问,给温和、循序渐进的运动计划。基于给定情况,强度保守,提示有基础病者先咨询医生。${DIS}`,
    userPromptTemplate:'请根据下面目标与身体状况给运动养生计划:适合的项目、强度与频率、热身与拉伸、循序渐进安排、注意事项(不适即停、慢病者先咨询医生)。\n目标与状况:\n---\n{{input}}\n---' }),
  base({ id:'analysis.well-tcm-science', label:'中医养生科普', shortLabel:'中医科普', icon:'🌱',
    tags:['养生','生成','中医'], allowedActions:['insert','append','replace','none'], defaultAction:'insert', temperature:0.5,
    description:'把中医养生概念用通俗、审慎的方式科普,讲文化与一般调养,不替代辨证施治不荐药。',
    systemPrompt:`你是一位中医养生科普作者,通俗审慎地介绍中医养生概念。讲一般调养与文化,不替代专业辨证、不推荐方药,提示就医。${DIS}`,
    userPromptTemplate:'请把下面中医养生主题做科普:概念通俗解释、一般调养方法(食饮起居)、适用与注意、需就医辨证的提示。不开方不荐药。\n主题:\n---\n{{input}}\n---' }),
  base({ id:'analysis.well-supplement-check', label:'保健品宣传合规检查', shortLabel:'保健品合规检查', icon:'🚧',
    tags:['养生','核查','合规'], allowedActions:['comment','link-comment','append','none'], defaultAction:'comment', temperature:0.15,
    description:'检查保健食品宣传是否有疾病治疗暗示、夸大功效、绝对化等违规,逐字定位提示。',
    systemPrompt:`你是一位食品健康合规审核,识别保健品宣传违规。命中片段原文逐字、反引号包裹;保健食品不得宣称治疗作用;只标确有问题处。${DIS}`,
    userPromptTemplate:'请检查下面保健品宣传,关注:暗示或宣称疾病预防/治疗作用、夸大功效、绝对化用语、与药品混淆、虚构案例。\n## 违规风险 (若无写"未发现明显违规")\n- 命中片段:`原文逐字片段`\n- 问题:\n- 建议改为:\n宣传内容:\n---\n{{input}}\n---' }),
  base({ id:'analysis.well-lecture', label:'健康讲座大纲', shortLabel:'讲座大纲', icon:'🎓',
    tags:['养生','生成','讲座'], allowedActions:['insert','append','none'], defaultAction:'insert', temperature:0.4,
    description:'把主题搭成健康讲座大纲:导入、核心知识点、互动、实操演示、答疑与要点回顾。',
    systemPrompt:`你是一位健康讲师,搭通俗、有互动的讲座大纲。内容科学,不夸大不带货,适配听众。${DIS}`,
    userPromptTemplate:'请把下面主题搭成健康讲座大纲:开场导入、核心知识点(分节)、互动/案例、实操演示、常见误区、答疑与要点回顾。控制时长。\n主题:\n---\n{{input}}\n---' }),
  base({ id:'analysis.well-followup', label:'养生随访计划', shortLabel:'养生随访', icon:'📅',
    tags:['养生','生成','随访'], allowedActions:['comment','append','insert','none'], defaultAction:'comment', temperature:0.3,
    description:'把养生调理安排整理成随访计划:回访节点、观察指标、坚持事项与提醒,生活管理视角。',
    systemPrompt:`你是一位健康管理师,整理生活方式随访计划。基于给定方案,只做生活管理层面的跟进,涉及指标异常提示就医。${DIS}`,
    userPromptTemplate:'请把下面养生方案整理成随访计划:回访时间节点、需自我观察的指标/感受、需坚持的事项、出现哪些情况要就医、鼓励与提醒。\n养生方案:\n---\n{{input}}\n---' }),
  base({ id:'analysis.well-routine', label:'作息调整建议', shortLabel:'作息建议', icon:'🌙',
    tags:['养生','生成','作息'], allowedActions:['comment','append','insert','none'], defaultAction:'comment', temperature:0.4,
    description:'根据现状给改善作息/睡眠的可执行建议:节律、睡前习惯、环境与饮食,温和可坚持。',
    systemPrompt:`你是一位睡眠健康顾问,给可执行的作息改善建议。基于给定现状,温和循证,长期失眠或异常提示就医。${DIS}`,
    userPromptTemplate:'请根据下面作息现状给改善建议:规律节律、睡前习惯、卧室环境、饮食与咖啡因、放松方法。具体可执行、温和。长期失眠提示就医。\n作息现状:\n---\n{{input}}\n---' }),
  base({ id:'analysis.well-store-copy', label:'养生馆文案', shortLabel:'养生馆文案', icon:'🏵️',
    tags:['养生','生成','文案'], allowedActions:['insert','append','replace','none'], defaultAction:'insert', temperature:0.5,
    description:'为养生馆/项目写文案:氛围、项目体验、适合人群,合规不宣称疗效不夸大。',
    systemPrompt:`你是一位养生馆文案,写有质感、合规的文案。只描述放松/调理体验,不宣称疾病疗效、不夸大,不暗示替代治疗。${DIS}`,
    userPromptTemplate:'请为下面养生馆/项目写文案:营造氛围的开头、项目体验描述、适合人群与场景、温馨提示。合规不宣称疗效、不夸大。\n项目信息:\n---\n{{input}}\n---' }),
  base({ id:'analysis.well-safety', label:'养生安全提示', shortLabel:'养生安全提示', icon:'⚠️',
    tags:['养生','核查','安全'], allowedActions:['comment','append','none'], defaultAction:'comment', temperature:0.2,
    description:'针对养生方法整理安全提示:适用禁忌、过量风险、特殊人群、与就医的边界,提醒理性养生。',
    systemPrompt:`你是一位健康安全顾问,整理养生安全提示。基于常识提示禁忌与风险,涉及个体一律建议咨询专业人士,不替代医疗。${DIS}`,
    userPromptTemplate:'请针对下面养生方法整理安全提示:适用与禁忌人群、过量或不当的风险、特殊人群(孕妇/慢病/老人)注意、不能替代治疗的边界、何时就医。\n养生方法:\n---\n{{input}}\n---' })
])
export function mergeWellnessIntoBuiltins(base=[]){const ids=new Set(base.map(x=>x&&x.id));return [...base,...WELLNESS_BUILTIN_ASSISTANTS.filter(x=>x&&!ids.has(x.id))]}
export default { WELLNESS_BUILTIN_ASSISTANTS, mergeWellnessIntoBuiltins }
