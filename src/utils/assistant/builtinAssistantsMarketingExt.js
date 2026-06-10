/**
 * builtinAssistantsMarketingExt — 「市场营销/文案」扩展包
 * 在 builtinAssistantsMarketing 之外补充新的高频文书/核查/抽取助手,语义不与现有包重复。
 * 生成/起草→insert+markdown;改写/润色→replace+selection-preferred;
 * 核查/审查→comment/link-comment+逐字反引号锚点;抽取→json+none。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'marketing'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4,
  ...extra
})

export const MARKETING_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.mkt-edm-email', label: 'EDM营销邮件', shortLabel: 'EDM邮件', icon: '✉️',
    tags: ['营销', '邮件', 'EDM'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    temperature: 0.6,
    description: '把素材写成 EDM 营销邮件:主题行+预览文本+正文+单一CTA,适合收件箱阅读、不进垃圾箱。',
    systemPrompt: '你是一位邮件营销专家,写打开率高、单一目标、像真人发的 EDM。只用给定信息中的事实和优惠,不编造折扣额度、库存、截止日期;主题行避免「!!!」「免费」「最后机会」这类易触发垃圾邮件过滤的写法。说人话,不堆四字词。',
    userPromptTemplate: `请把下面素材写成一封 EDM 营销邮件:
1. 3 个可选主题行(每个不超过 24 字)
2. 1 句预览文本(补充主题行,不重复)
3. 正文(开头点出对收件人的价值,中间 2-3 个利益点,结尾一个明确 CTA)
只放一个行动按钮文案。所有优惠/数字只用素材里出现的,缺失处写【待补充】。
素材:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-product-detail', label: '电商详情页文案', shortLabel: '详情页文案', icon: '🛒',
    tags: ['营销', '电商', '详情页'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    temperature: 0.5,
    description: '把产品资料写成电商详情页文案:首屏卖点+使用场景+规格参数+常见疑虑解答,适合手机端逐屏阅读。',
    systemPrompt: '你是一位电商详情页文案专家,写适合手机逐屏滑动、卖点前置、能打消下单疑虑的文案。只用资料里的真实参数和卖点,不编造材质、产地、销量、好评数;涉及功效不用绝对化用语,避免违反广告法。',
    userPromptTemplate: `请把下面产品资料写成电商详情页文案,分屏组织:
## 首屏(一句话核心价值 + 3 个最强卖点)
## 适用场景/人群
## 规格参数(只列资料中明确给出的)
## 常见疑虑解答(站在买家角度回答 3-4 个犹豫点)
## 售后/保障(只写资料中真实存在的)
缺失参数处写【待补充】,不要自己填数字。
产品资料:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-adlaw-check', label: '广告法合规核查', shortLabel: '广告法核查', icon: '⚖️',
    tags: ['营销', '核查', '广告法'], allowedActions: ['link-comment', 'comment', 'none'], defaultAction: 'link-comment',
    temperature: 0.2,
    description: '逐句核查文案是否含广告法违禁词与绝对化用语(最/第一/国家级/100%等),定位原文并给合规替换建议。',
    systemPrompt: '你是一位广告合规审查专家,逐句排查文案中违反《广告法》的表述:绝对化用语(最/第一/顶级/极致/100%/唯一)、未经证实的功效与承诺、虚构权威背书、医疗化用语、诱导性比较。只标记文中真实出现的表述,不臆测。本助手仅辅助审查,不替代法务/专业人员把关。',
    userPromptTemplate: `请逐句核查下面文案的广告法合规风险,每条用如下格式:
- 命中片段:\`原文逐字片段\`
- 风险类型:(绝对化用语/虚假承诺/功效夸大/权威背书/其他)
- 合规替换建议:(给出可直接替换的安全表述)
未发现风险请明确说明「未发现明显广告法风险,仍建议法务复核」。
仅辅助审查,不替代专业人员。
文案:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-feed-rewrite', label: '信息流投放改写', shortLabel: '信息流改写', icon: '📈',
    tags: ['营销', '改写', '信息流'], allowedActions: ['replace', 'insert', 'append', 'none'], defaultAction: 'replace',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.6,
    description: '把选中文案改写成信息流广告投放版:前 7 个字抓人、口语原生、弱广告感、带明确转化钩子。',
    systemPrompt: '你是一位信息流投放优化师,把文案改写成在抖音/朋友圈/今日头条信息流里原生、不像广告、点击率高的版本。保留原文的核心卖点和事实,不新增未给出的卖点或数字。前 7 个字必须抓人,整体口语化,弱化硬广腔。',
    userPromptTemplate: `请把下面文案改写成信息流投放版:
- 前 7 个字是钩子(痛点/反差/利益其一)
- 整体口语原生,像用户自述或测评,不像官方广告
- 保留原有事实卖点,不新增数字或承诺
- 结尾一句轻转化引导
只输出改写后的文案,给 2 个不同钩子的版本。
原文:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-competitor-compare', label: '竞品对比表', shortLabel: '竞品对比', icon: '🆚',
    tags: ['营销', '分析', '竞品'], allowedActions: ['comment', 'insert', 'append', 'none'], defaultAction: 'comment',
    temperature: 0.3,
    description: '从资料中整理本品与竞品的对比表(维度/我方/竞品/差异),只用资料中的事实,给差异化沟通建议。',
    systemPrompt: '你是一位竞品分析师,把资料整理成客观的本品 vs 竞品对比。只用资料里真实出现的参数与表述,资料没提到的维度标「资料未提及」,不臆造竞品弱点或数据。最后给出可对外沟通的差异化点,但不编造贬低竞品的不实表述。',
    userPromptTemplate: `请基于下面资料整理本品与竞品对比表:
| 对比维度 | 本品 | 竞品 | 差异说明 | 原文依据 |
依据列请引用资料中的逐字片段,形如 \`原文片段\`;资料未覆盖的维度填「资料未提及」。
表格后给 2-3 条可对外的差异化沟通点(只基于上表事实)。
资料:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-press-release', label: '媒体通稿', shortLabel: '媒体通稿', icon: '🗞️',
    tags: ['营销', '公关', '通稿'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    temperature: 0.5,
    description: '把发布信息写成新闻通稿:标题+导语(5W)+正文倒金字塔+引语+公司简介,可直接投媒体。',
    systemPrompt: '你是一位公关传播专家,写客观克制、符合新闻体的媒体通稿。采用倒金字塔结构,导语交代 5W,正文按重要性递减。只用给定信息,不编造高管引语原话、合作方、数据;需要引语而资料没有时写【建议补充高管引语】。少用形容词堆砌,说事实。',
    userPromptTemplate: `请把下面发布信息写成一篇媒体通稿:
1. 标题(客观、含核心事件)
2. 导语(一段,交代何时何地谁做了什么、有何意义)
3. 正文(倒金字塔,3-4 段,重要信息在前)
4. 引语(高管/合作方原话,资料缺失处写【建议补充高管引语】)
5. 关于公司(一段简介,只用给定信息)
发布信息:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-livescript-check', label: '直播口播话术核查', shortLabel: '口播核查', icon: '🎙️',
    tags: ['营销', '核查', '直播'], allowedActions: ['comment', 'link-comment', 'none'], defaultAction: 'comment',
    temperature: 0.2,
    description: '核查直播/口播话术中的违规承诺、绝对化用语、夸大功效和易引发纠纷的表述,定位原文给替换。',
    systemPrompt: '你是一位直播合规与话术审查专家,排查口播话术里的违规风险:虚假/绝对化承诺、夸大功效、诱导下单的不实表述(全网最低/仅此一场/库存告急未必属实)、医疗化用语、贬低同行。只标记文中真实出现的话术,不臆测。本助手仅辅助审查,不替代法务把关。',
    userPromptTemplate: `请逐条核查下面直播口播话术的合规与纠纷风险:
- 命中片段:\`原文逐字片段\`
- 风险类型:(绝对化用语/虚假承诺/功效夸大/诱导话术/贬低同行/其他)
- 建议替换:(给出能照说的安全话术)
未发现风险请说明「未发现明显风险,仍建议合规复核」。
仅辅助审查,不替代专业人员。
口播话术:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-event-extract', label: '活动信息抽取', shortLabel: '活动抽取', icon: '🗓️',
    tags: ['营销', '抽取', '活动'], allowedActions: ['none'], defaultAction: 'none',
    defaultOutputFormat: 'json', temperature: 0.1,
    description: '从活动文案/通知中抽取结构化要素(名称、时间、地点、优惠、参与方式、限制等)为 JSON,找不到留空。',
    systemPrompt: '你是一位营销运营,从活动文案中抽取结构化要素。只抽取文中明确出现的信息,找不到的字段留空字符串或空数组,绝不编造时间、优惠额度、名额。只输出 JSON,不加解释。',
    userPromptTemplate: `请从下面活动文案中抽取要素,严格按此 JSON 结构输出(找不到的字段留空,不要编造):
{
  "activity_name": "",
  "start_time": "",
  "end_time": "",
  "location": "",
  "audience": "",
  "offers": [],
  "join_method": "",
  "restrictions": [],
  "contact": ""
}
活动文案:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-kol-outreach', label: 'KOL合作邀约', shortLabel: 'KOL邀约', icon: '🤝',
    tags: ['营销', '邮件', '达人'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    temperature: 0.5,
    description: '把合作需求写成发给达人/KOL 的邀约私信:个性化开场+合作内容+对方收益+下一步,简短不群发感。',
    systemPrompt: '你是一位达人合作 BD,写让博主愿意回复的邀约私信。开场要个性化(引用对方内容定位),说清合作形式、报酬/置换、对方能得到什么、下一步怎么做。只用给定信息中的合作条件,不编造报价或赠品;缺失处写【待确认】。简短真诚,不群发腔。',
    userPromptTemplate: `请把下面合作需求写成发给达人的邀约私信:
1. 个性化开场(基于给定的达人定位,一句)
2. 我们是谁 + 想合作什么形式
3. 对方能得到什么(报酬/置换/曝光,只用给定条件,缺失写【待确认】)
4. 明确的下一步(如何回复/约时间)
全文控制在 150 字内,给 1 个版本。
合作需求:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-testimonial-rewrite', label: '客户证言提炼', shortLabel: '客户证言', icon: '🗣️',
    tags: ['营销', '改写', '证言'], allowedActions: ['replace', 'insert', 'append', 'none'], defaultAction: 'replace',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.4,
    description: '把原始客户反馈/聊天记录提炼成可用于宣传的证言金句,保留真实语气,不夸大不虚构事实。',
    systemPrompt: '你是一位口碑营销专家,把原始客户反馈提炼成简洁有信服力的证言。保留客户真实表达的事实和情绪,不添加客户没说过的效果、数字、身份。可删冗余、顺语序,但不能改变原意或拔高。如原文未提具体成效,不要替客户编造。',
    userPromptTemplate: `请把下面原始客户反馈提炼成可对外展示的证言:
1. 一句话金句版(可放在物料/落地页,保留客户真实意思)
2. 完整版(3-4 句,保留具体细节和真实语气)
不得添加客户原话中没有的效果、数字或身份。如成效模糊,如实保留。
原始反馈:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-campaign-recap', label: '营销复盘报告', shortLabel: '营销复盘', icon: '📊',
    tags: ['营销', '复盘', '报告'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'insert',
    temperature: 0.3,
    description: '把活动数据/记录整理成复盘报告:目标达成、关键数据、亮点、问题、归因、下一步,数字先列原文再算。',
    systemPrompt: '你是一位市场运营,把活动记录整理成结构化复盘。所有结论必须基于给定数据;涉及计算(如转化率、ROI)时先列出引用的原始数字再给算式和结果,不臆造未提供的指标。客观说问题,不替团队美化。',
    userPromptTemplate: `请把下面活动数据/记录整理成复盘报告:
## 目标与达成情况
## 关键数据(引用原文数字;需计算的指标先列原始数再写算式)
## 亮点(基于数据)
## 问题与不足
## 归因分析
## 下一步建议
凡是给定数据没有的指标,标「数据缺失」,不要编造。
活动数据/记录:
---
{{input}}
---`
  }),
  base({
    id: 'analysis.mkt-utm-extract', label: '投放链接UTM抽取', shortLabel: 'UTM抽取', icon: '🔗',
    tags: ['营销', '抽取', '投放'], allowedActions: ['none'], defaultAction: 'none',
    defaultOutputFormat: 'json', temperature: 0.1,
    description: '从文本中抽取所有带 UTM 参数的投放链接,解析 source/medium/campaign 等参数为 JSON,找不到留空。',
    systemPrompt: '你是一位投放数据分析,从文本中找出所有 URL 并解析其 UTM 等查询参数。只解析文本中真实出现的链接和参数,不补全、不猜测缺失参数。没有链接时返回空数组。只输出 JSON,不加解释。',
    userPromptTemplate: `请从下面文本中抽取所有链接及其 UTM 参数,严格按此 JSON 结构输出(找不到的参数留空,无链接则 links 为空数组):
{
  "links": [
    {
      "url": "",
      "utm_source": "",
      "utm_medium": "",
      "utm_campaign": "",
      "utm_content": "",
      "utm_term": ""
    }
  ]
}
文本:
---
{{input}}
---`
  })
])

export function mergeMarketingExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...MARKETING_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}
export default { MARKETING_EXT_BUILTIN_ASSISTANTS, mergeMarketingExtIntoBuiltins }
