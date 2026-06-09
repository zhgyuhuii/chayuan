/**
 * builtinAssistantsAdvertising — 「广告/公关/会展」领域助手包(批12)
 * 创意/框架生成类默认插入。约束:只用给定事实,不编造数据/案例;危机公关诚恳负责。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'advertising'
const GEN = `通用约束:只用给定信息,不编造销量/奖项/案例数据;创意服务于真实卖点;避免违反广告法的绝对化用语。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.6, ...extra
})

export const ADVERTISING_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.ad-creative-script', label: '广告创意脚本', shortLabel: '广告创意', icon: '🎬',
    tags: ['广告', '生成', '创意'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert',
    description: '根据产品和诉求产出广告创意脚本:核心创意、分镜、台词、记忆点,有张力服务卖点。',
    systemPrompt: `你是一位广告创意,产出有张力又落地的创意脚本。创意服务于真实卖点,不编造功效。${GEN}`,
    userPromptTemplate: `请根据下面产品与诉求产出广告创意:1-2个核心创意概念、推荐方案的分镜脚本(画面+台词+音效)、记忆点与slogan。\n产品与诉求:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ad-pr-release', label: '公关稿', shortLabel: '公关稿', icon: '📰',
    tags: ['公关', '生成', '稿件'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '把事件写成可发布的公关稿:新闻角度、标题、主体、引语、企业信息,客观有传播点。',
    systemPrompt: `你是一位公关,写专业、可发布的公关稿。新闻角度真实,引语只用给定的,不编造数据奖项。${GEN}`,
    userPromptTemplate: `请把下面事件写成公关稿:有传播点的标题、导语、主体(倒金字塔)、关键引语(给定的)、企业简介(boilerplate占位)、联系方式。\n事件:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ad-crisis-statement', label: '危机公关声明', shortLabel: '危机声明', icon: '🆘',
    tags: ['公关', '生成', '危机'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.25,
    description: '针对舆情/危机起草声明:正视问题、说明事实、表态与措施、致歉,诚恳不甩锅不回避。',
    systemPrompt: '你是一位危机公关专家,起草诚恳、负责任的声明。基于给定事实,不回避不甩锅、不轻率承诺,态度真诚措施具体。',
    userPromptTemplate: `请针对下面危机起草声明:正视并简述事实→已查明/正在核实的情况→已采取与将采取的措施→对相关方的致歉与承诺→联系/反馈渠道。诚恳负责,不甩锅不空话。\n危机情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ad-event-plan', label: '活动策划案', shortLabel: '活动策划', icon: '🎪',
    tags: ['会展', '生成', '策划'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '把活动目标搭成策划案:主题创意、流程、嘉宾物料、传播、预算、应急,落地可执行。',
    systemPrompt: '你是一位活动策划,产出落地的策划案。基于给定目标,创意有亮点、流程可执行,预算项目化(数字【待报价】)。',
    userPromptTemplate: `请把下面活动目标搭成策划案:活动主题与创意、目标与受众、流程脚本(时间轴)、场地物料嘉宾、传播规划、预算(项目化,数字【待报价】)、风险与应急。\n活动目标:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ad-brand-story', label: '品牌故事', shortLabel: '品牌故事', icon: '📖',
    tags: ['品牌', '生成', '故事'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.6,
    description: '把品牌素材写成有共鸣的品牌故事:起源、理念、价值主张、与用户的连接,真实不煽情。',
    systemPrompt: `你是一位品牌叙事专家,写有共鸣、真实的品牌故事。只用给定素材,不虚构创始经历,情感真实不煽情。${GEN}`,
    userPromptTemplate: `请把下面素材写成品牌故事:起源与初心、坚持的理念、为用户解决什么、品牌价值主张。有共鸣、真实,不虚构不煽情。\n品牌素材:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ad-kol-brief', label: 'KOL合作brief', shortLabel: 'KOL brief', icon: '🤳',
    tags: ['营销', '生成', 'KOL'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '把投放需求写成给达人的合作brief:背景、核心信息、内容方向、必传点、注意事项。',
    systemPrompt: '你是一位达人营销,写清晰的合作brief。基于给定需求,核心信息明确、给创作空间、合规要求写清,不编造产品功效。',
    userPromptTemplate: `请把下面需求写成 KOL 合作brief:品牌/产品背景、本次目标、核心传播信息、内容方向与形式建议、必传点(卖点/活动/链接)、必避点(合规/竞品)、交付与排期。\n需求:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ad-proposal', label: '提案框架', shortLabel: '提案框架', icon: '🗂️',
    tags: ['广告', '生成', '提案'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.45,
    description: '把比稿/提案需求搭成框架:洞察、策略、创意、执行、排期预算,逻辑清晰有说服力。',
    systemPrompt: '你是一位广告策略,搭建有说服力的提案框架。基于给定需求,从洞察到执行逻辑闭环,数据缺失【待补充】。',
    userPromptTemplate: `请把下面提案需求搭成框架:市场与用户洞察、传播策略与核心主张、创意概念、执行计划(渠道/内容/节奏)、排期与预算(【待补充】)、预期效果。\n提案需求:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ad-tagline', label: '广告语多版', shortLabel: '广告语', icon: '💬',
    tags: ['广告', '生成', '文案'], allowedActions: ['insert', 'comment', 'append', 'none'], defaultAction: 'insert', temperature: 0.75,
    description: '为品牌/活动产出多版广告语(tagline),覆盖不同调性,短促有记忆点,合规。',
    systemPrompt: `你是一位广告文案,写短促、有记忆点的广告语。服务真实卖点,避免绝对化违规用语。${GEN}`,
    userPromptTemplate: `请为下面品牌/活动产出广告语:按调性分组(情感/功能/态度),每组3条,短促押韵有记忆点,各附一句创意说明。\n品牌/活动:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ad-media-plan', label: '媒介投放计划', shortLabel: '媒介计划', icon: '📡',
    tags: ['营销', '生成', '投放'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '根据目标和预算搭媒介投放计划框架:渠道组合、节奏、预算分配、KPI,数据待落实。',
    systemPrompt: '你是一位媒介策划,搭投放计划框架。基于给定目标与预算组织渠道与节奏,具体单价/量【待询价】,不编造数据。',
    userPromptTemplate: `请根据下面目标与预算搭媒介投放计划:渠道组合与理由、投放节奏(预热/爆发/长尾)、预算分配建议、KPI与监测。具体价格量级标【待询价】。\n目标与预算:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ad-expo-recruit', label: '会展招商文案', shortLabel: '招商文案', icon: '🏢',
    tags: ['会展', '生成', '招商'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '为展会写招商/招展文案:展会价值、参展收益、展位与权益、报名引导,有说服力真实。',
    systemPrompt: `你是一位会展招商,写有说服力的招商文案。数据(往届规模等)只用给定的,不夸大,权益写清。${GEN}`,
    userPromptTemplate: `请为下面展会写招商文案:展会概况与价值、参展能获得什么(客户/曝光/资源)、展位类型与权益、往届亮点(给定数据)、报名方式与优惠。\n展会信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ad-collateral-copy', label: '宣传物料文案', shortLabel: '物料文案', icon: '🖼️',
    tags: ['广告', '生成', '物料'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.6,
    description: '为海报/折页/易拉宝等物料写文案:主标、副标、卖点短句、行动号召,适配版面。',
    systemPrompt: `你是一位平面文案,为物料写适配版面的文案。层级清晰、短句有力,服务真实卖点。${GEN}`,
    userPromptTemplate: `请为下面物料写文案(注明物料类型):主标题、副标题、3-5条卖点短句、行动号召(CTA)、必要的说明小字。适配版面、层级清晰。\n物料需求:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.ad-campaign-review', label: '营销复盘报告', shortLabel: '营销复盘', icon: '📊',
    tags: ['营销', '生成', '复盘'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '把活动数据整理成复盘报告:目标达成、数据表现、亮点、问题、经验沉淀,数字照原文。',
    systemPrompt: '你是一位市场负责人,写客观的营销复盘。数据照原文(达成率先列原文数字),亮点问题如实,经验可复用。',
    userPromptTemplate: `请把下面活动数据整理成复盘报告:目标与达成(先列原文数字)、关键数据表现、做得好的亮点、问题与不足、原因分析、可沉淀的经验。\n活动数据:\n---\n{{input}}\n---` })
])

export function mergeAdvertisingIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...ADVERTISING_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { ADVERTISING_BUILTIN_ASSISTANTS, mergeAdvertisingIntoBuiltins }
