/**
 * builtinAssistantsMarketing — 「市场营销/文案」领域助手包(批4)
 * 生成类默认动作=插入(文案要落地到文档);提炼/核查类=批注。质量基线:角色精准、
 * 只用给定事实不编造卖点/数据、输出可直接使用的成稿。
 */
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'marketing'

const GEN_RULES = `
通用约束(营销文案生成类):
- 只使用给定信息中的事实、卖点、数据;不编造功效、资质、销量、用户评价。
- 涉及功效/承诺,避免绝对化用语(最/第一/100%)与违反广告法的表述。
- 直接输出可用成稿,不要解释或加引导语。`.trim()

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, defaultOutputFormat: 'markdown', temperature: 0.6,
  ...extra
})

export const MARKETING_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.mkt-xiaohongshu', label: '小红书文案', shortLabel: '小红书文案', icon: '📕',
    tags: ['营销', '文案', '小红书'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '把产品/主题写成小红书风格种草文案:标题党+正文+话题标签,真实不浮夸。',
    systemPrompt: `你是一位资深小红书运营,写真实可信、有代入感的种草文案。\n\n${GEN_RULES}`,
    userPromptTemplate: `请把下面内容写成小红书文案:
1. 3 个可选标题(带 emoji、有点击欲、不标题党到虚假)
2. 正文(口语化、分点、有真实使用感、含痛点+利益点)
3. 5-8 个话题标签 #
内容:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-douyin-script', label: '短视频脚本', shortLabel: '短视频脚本', icon: '🎬',
    tags: ['营销', '脚本', '短视频'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '把主题写成抖音/短视频分镜脚本:钩子开场+分镜+口播+字幕+BGM建议。',
    systemPrompt: `你是一位短视频编导,写有钩子、节奏快、可拍摄的分镜脚本。\n\n${GEN_RULES}`,
    userPromptTemplate: `请把下面内容写成 15-30 秒短视频脚本,表格分镜:
| 时间 | 画面/分镜 | 口播 | 字幕 |
开头 3 秒必须是强钩子;结尾给行动指令。再附 1 句 BGM/节奏建议。
内容:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-wechat-article', label: '公众号推文', shortLabel: '公众号推文', icon: '📰',
    tags: ['营销', '文案', '公众号'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '把素材写成公众号推文:吸睛标题+导语+小标题分段+结尾引导关注/转化。',
    systemPrompt: `你是一位公众号主编,写结构清晰、有信息增量、读完想转发的推文。\n\n${GEN_RULES}`,
    userPromptTemplate: `请把下面素材写成公众号推文:
1. 2 个可选标题
2. 导语(一段,点出价值)
3. 正文(分 3-5 个小标题,逻辑清晰)
4. 结尾引导(关注/转化,不硬广)
素材:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-selling-points', label: '卖点提炼', shortLabel: '卖点提炼', icon: '💡',
    tags: ['营销', '提炼', '卖点'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '从产品资料中提炼核心卖点,转化为"用户利益"表达(FAB),只基于资料不夸大。',
    systemPrompt: '你是一位产品营销,把产品特性提炼为打动用户的利益点(FAB:特性→优势→利益)。只用资料中的事实,不夸大。',
    userPromptTemplate: `请从下面产品资料提炼卖点,输出表格:
| 特性(Feature) | 优势(Advantage) | 用户利益(Benefit) | 对应原文依据 |
最后用一句话给出"一句话核心卖点"。
资料:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-ad-headlines', label: '广告标题多版', shortLabel: '广告标题多版', icon: '🏷️',
    tags: ['营销', '文案', '标题'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'insert',
    description: '为产品/活动生成多个角度的广告标题(痛点/利益/好奇/紧迫/数字),供 A/B 选择。',
    systemPrompt: `你是一位广告文案,擅长用不同心理角度写标题。\n\n${GEN_RULES}`,
    userPromptTemplate: `请为下面内容生成广告标题,每个角度 2 条,标注角度:
- 痛点型 / 利益型 / 好奇型 / 紧迫型 / 数字型 / 身份认同型
内容:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-seo-keywords', label: 'SEO关键词建议', shortLabel: 'SEO关键词', icon: '🔍',
    tags: ['营销', '提取', 'SEO'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment',
    defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '基于主题/产品建议 SEO 关键词:核心词、长尾词、相关词,并给布局建议。',
    systemPrompt: '你是一位 SEO 专员,基于主题给出分层关键词与布局建议。关键词需与主题真实相关,不堆砌。',
    userPromptTemplate: `请基于下面主题给出 SEO 关键词建议:
## 核心词(3-5)
## 长尾词(8-15)
## 相关/语义词
## 布局建议(标题/正文/H标签如何安排)
主题:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-landing-copy', label: '落地页文案', shortLabel: '落地页文案', icon: '🛬',
    tags: ['营销', '文案', '落地页'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '把产品信息写成落地页文案:主标题+副标题+痛点+卖点+信任背书+CTA。',
    systemPrompt: `你是一位转化文案专家,写结构完整、引导转化的落地页文案。\n\n${GEN_RULES}`,
    userPromptTemplate: `请把下面产品信息写成落地页文案,分区块:
1. 主标题 + 副标题(一句话价值主张)
2. 用户痛点(3 条)
3. 核心卖点/解决方案(3-4 条,利益导向)
4. 信任背书(只用资料中真实存在的)
5. 行动号召 CTA(2 个版本)
产品信息:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-moments', label: '朋友圈文案', shortLabel: '朋友圈文案', icon: '📱',
    tags: ['营销', '文案', '朋友圈'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '写朋友圈营销文案:简短、有人情味、不刷屏感,含价值点与软引导。',
    systemPrompt: `你是一位私域运营,写有温度、不像硬广的朋友圈文案。\n\n${GEN_RULES}`,
    userPromptTemplate: `请把下面内容写成 3 条不同风格的朋友圈文案(每条 2-4 行,口语、含价值点、软引导):
内容:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-review-reply', label: '差评回复', shortLabel: '差评回复', icon: '💬',
    tags: ['营销', '客服', '差评'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '针对差评写得体回复:先共情致歉、再说明/解决、最后挽回,真诚不敷衍。',
    systemPrompt: '你是一位金牌客服,写真诚、共情、能挽回的差评回复。不狡辩、不甩锅、不模板腔;只承诺能做到的。',
    userPromptTemplate: `请针对下面差评写 2 个版本的得体回复(共情致歉→说明或解决方案→挽回):
差评:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-campaign-plan', label: '营销活动方案', shortLabel: '营销活动方案', icon: '🎉',
    tags: ['营销', '方案', '活动'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert',
    defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.5,
    description: '把活动目标写成结构化营销方案框架:目标、人群、玩法、节奏、预算、风险、复盘指标。',
    systemPrompt: '你是一位市场策划,产出结构完整、可执行的活动方案框架。基于给定目标,缺信息处用【待补充】占位,不编造预算数字。',
    userPromptTemplate: `请把下面目标写成营销活动方案框架:
## 活动目标
## 目标人群
## 核心玩法/机制
## 时间节奏(预热-引爆-收尾)
## 渠道与物料
## 预算(项目化,数字用【待补充】)
## 风险与预案
## 复盘指标
目标:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-persona', label: '用户画像描述', shortLabel: '用户画像描述', icon: '🧑',
    tags: ['营销', '分析', '画像'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '基于产品/场景刻画典型用户画像:基本属性、需求动机、痛点、决策因素、触达渠道。',
    systemPrompt: '你是一位用户研究员,基于给定产品/场景刻画典型用户画像。基于合理推断并标明哪些是假设,不臆造统计数据。',
    userPromptTemplate: `请基于下面产品/场景,刻画 1-2 个典型用户画像:
## 画像名称(一句话标签)
## 基本属性(年龄/职业/场景等)
## 需求与动机
## 主要痛点
## 决策关键因素
## 触达渠道
(以上为基于信息的合理假设,需用真实调研验证)
产品/场景:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-slogan', label: '品牌Slogan', shortLabel: '品牌Slogan', icon: '✨',
    tags: ['营销', '文案', 'slogan'], allowedActions: ['insert', 'comment', 'append', 'none'], defaultAction: 'insert',
    temperature: 0.7,
    description: '为品牌/产品生成多个 Slogan,覆盖不同调性(理性价值/情感共鸣/行动号召),简短有记忆点。',
    systemPrompt: `你是一位品牌文案,写简短、有记忆点、朗朗上口的 Slogan。\n\n${GEN_RULES}`,
    userPromptTemplate: `请为下面品牌/产品生成 Slogan,每类 3 条:
- 理性价值型 / 情感共鸣型 / 行动号召型
每条不超过 12 字,附一句创意说明。
品牌/产品:
---
{{input}}
---`
  })
])

export function mergeMarketingIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...MARKETING_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { MARKETING_BUILTIN_ASSISTANTS, mergeMarketingIntoBuiltins }
