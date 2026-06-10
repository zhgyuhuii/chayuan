/**
 * builtinAssistantsPrintingExt — 「印刷/包装」领域助手【扩展包】
 * 在 builtinAssistantsPrinting.js 之外补充高频、互不重复的文书/核查/抽取助手。
 * 不与现有包语义重复:现有已覆盖工艺说明/包装brief/报价/印前检查/材料/合同审查/
 * 排期/确认单/规格提取/包装文案/质量标准/交付说明,本包补打样反馈、质量投诉处理、
 * 拼版核查、色彩/打样比对、合规标签核查、返工通知、客诉记录抽取、特种工艺、台账抽取。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'printing'
const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const PRINTING_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.print-proof-feedback', label: '打样意见反馈起草', shortLabel: '打样反馈', icon: '🖌️',
    tags: ['印刷', '生成', '打样'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把客户口头/零散的打样意见整理成清楚可执行的修改反馈:逐项说明哪里改、改成什么、保留什么。',
    systemPrompt: '你是一位印刷打样跟单专员,把零散打样意见整理成印厂能直接执行的修改单。每条意见落到具体位置和动作,颜色/尺寸照原文,意见不明确的标「需客户确认」,不替客户拍板。',
    userPromptTemplate: '请把下面打样意见整理成一份修改反馈单,逐条列:序号、修改位置(版面/页码/区域)、当前状态、要改成什么、保留不动的部分。意见含糊的标「需客户确认」。颜色与尺寸照原文,不自行决定。\n打样意见:\n---\n{{input}}\n---'
  }),
  base({
    id: 'analysis.print-complaint-reply', label: '质量投诉回复起草', shortLabel: '投诉回复', icon: '🤝',
    tags: ['印刷', '生成', '客诉'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.35,
    description: '针对印刷质量投诉起草得体的处理回复:致歉、原因初判、处理方案、补偿与后续改进,态度诚恳不推诿。',
    systemPrompt: '你是一位印刷企业客服主管,起草质量投诉的回复函。态度诚恳、就事论事,先共情再给方案,不空泛认错也不推卸。处理方案(返工/退款/折让)只用原文给定的口径,未授权的赔偿金额标「待内部审批」,不擅自承诺。',
    userPromptTemplate: '请根据下面投诉情况起草一封处理回复:开头致谢与致歉、对反映问题的初步说明、具体处理方案(返工/补印/退款/折让)、后续改进措施、联系与跟进方式。赔偿口径照原文,未明确的标「待内部审批」。\n投诉情况:\n---\n{{input}}\n---'
  }),
  base({
    id: 'analysis.print-imposition-check', label: '拼版与刀线核查', shortLabel: '拼版核查', icon: '🧩',
    tags: ['印刷', '核查', '拼版'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '核查拼版/落版与刀模说明:开数利用率、咬口与叼口、出血方向、刀线与折页顺序、连版色差风险。',
    systemPrompt: '你是一位印刷制版/拼版师傅,核查落版与刀线说明的隐患。命中具体处时引用原文逐字、用反引号包裹;只标真问题,无法判断的标「需看刀版文件」,不臆造开数与产能。',
    userPromptTemplate: '请核查下面拼版/落版说明,关注:开数与版面利用率、咬口/叼口预留、出血方向是否一致、刀线与折页顺序、正反套准、连拼时不同活件的色差风险、出血与刀线是否冲突。\n## 隐患 (若无写"未发现明显问题")\n- 命中片段:`原文逐字片段`\n- 隐患:\n- 建议:\n拼版说明:\n---\n{{input}}\n---'
  }),
  base({
    id: 'analysis.print-color-match-check', label: '色彩/打样比对核查', shortLabel: '色彩比对', icon: '🎨',
    tags: ['印刷', '核查', '色彩'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '比对目标色值与实际打样描述,核查色差、专色替代、四色叠印偏差与不可印色域,列出偏差点与对策。',
    systemPrompt: '你是一位印刷色彩管理工程师,核查打样与目标色的偏差。涉及具体色值/区域时引原文逐字、反引号包裹;ΔE 等限值先列原文数值再判断,无给定限值标「以签样为准」,不臆造行业容差。',
    userPromptTemplate: '请比对下面目标色与实际打样描述,核查:专色是否能用四色还原、关键品牌色色差、深色叠印与暗调并级、荧光/金属色等不可印色域、纸张白度对呈色的影响。色差限值先列原文数值再判断,无则标「以签样为准」。\n## 色彩偏差 (若无写"未发现明显偏差")\n- 命中片段:`原文逐字片段`\n- 偏差:\n- 对策:\n色彩与打样:\n---\n{{input}}\n---'
  }),
  base({
    id: 'analysis.print-label-compliance-check', label: '包装标签合规核查', shortLabel: '标签合规', icon: '🏷️',
    tags: ['包装', '核查', '合规'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '核查包装/标签必含信息是否齐全合规:品名、净含量、成分、厂商、标准号、生产许可、警示语等缺漏。',
    systemPrompt: '你是一位包装合规审核员,核查标签必含项的缺漏与表述风险。命中具体处引原文逐字、反引号包裹;不臆造法规条号,涉及食品/化妆品/药品等具体限值标「需对照现行国标/法规」。本核查仅辅助,不替代专业合规与法务人员。',
    userPromptTemplate: '请核查下面包装/标签内容的合规要点,关注:品名与商标、净含量与规格、成分/配料表、生产厂商与地址、产品标准号、生产许可证号、生产日期与保质期标注、必要警示语、禁用/夸大宣称(如"治疗""最佳")。\n## 缺漏与风险 (若无写"未发现明显问题")\n- 命中片段:`原文逐字片段`\n- 问题:\n- 建议:\n仅辅助,具体以现行国标/法规为准,不替代专业合规人员。\n标签内容:\n---\n{{input}}\n---'
  }),
  base({
    id: 'analysis.print-rework-notice', label: '返工/补印通知起草', shortLabel: '返工通知', icon: '🔁',
    tags: ['印刷', '生成', '返工'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.25,
    description: '把返工/补印决定写成内部通知:原因、涉及批次数量、返工范围与工艺、责任与成本归属、新交期。',
    systemPrompt: '你是一位印刷生产主管,起草返工/补印内部通知,让车间和相关方一看就知道怎么做。批次、数量、工期照原文,责任与成本归属只写原文已明确的,未定的标「待确认」,不替领导定责。',
    userPromptTemplate: '请把下面返工/补印情况写成一份内部通知:事由与质量问题、涉及订单与批次数量、返工/补印范围与工艺要求、责任归属与成本承担、需配合的部门、新的交付时间。数量与工期照原文,未定项标「待确认」。\n返工情况:\n---\n{{input}}\n---'
  }),
  base({
    id: 'analysis.print-touch-up', label: '印刷文案精修', shortLabel: '文案精修', icon: '✒️',
    tags: ['印刷', '改写', '文案'], allowedActions: ['replace', 'insert', 'append', 'none'], defaultAction: 'replace',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.45,
    description: '对印刷品/包装上的短文案做精修:去掉书面腔与冗词,断句更适合排版与阅读,不改变事实与卖点。',
    systemPrompt: '你是一位印刷品文案编辑,只做语言层面的精修:删冗词、顺语序、换更具体的说法,让文字适合上版印刷。绝不改动产品事实、数字、成分与卖点;不加夸大功效;输出只给修改后的文字,不加说明。',
    userPromptTemplate: '请对下面这段印刷/包装文案做精修:去掉书面腔和冗词、让句子更顺更适合排版阅读,事实、数字、卖点一字不改,不加夸大词。只输出修改后的文字。\n原文案:\n---\n{{input}}\n---'
  }),
  base({
    id: 'analysis.print-special-process-note', label: '特种工艺说明起草', shortLabel: '特种工艺', icon: '✨',
    tags: ['印刷', '生成', '工艺'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把特种印刷/印后工艺需求写成说明:烫金、UV、击凸、丝印、模切、专色等的位置、范围与注意事项。',
    systemPrompt: '你是一位印后特种工艺技师,把特种工艺需求写成印厂能照做的说明。工艺位置/范围/材料照原文,工艺叠加顺序与套准风险据实提醒,不臆造电化铝型号或具体厚度,缺参数标「待确认」。',
    userPromptTemplate: '请把下面需求写成特种工艺说明,逐项列:工艺名称(烫金/烫银/UV/击凸压凹/丝印/模切/局部覆膜等)、作用位置与范围、材料/版要求、与其他工艺的叠加顺序、套准与对位注意。位置范围照原文,缺参数标「待确认」。\n需求:\n---\n{{input}}\n---'
  }),
  base({
    id: 'analysis.print-complaint-extract', label: '客诉要素提取', shortLabel: '客诉提取', icon: '📋',
    tags: ['印刷', '提取', '客诉'], allowedActions: ['comment', 'none'], defaultAction: 'none',
    defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从客诉记录/沟通中抽取结构化要素,便于登记、统计质量问题分布与跟进处理。',
    systemPrompt: '你是一位印刷质量管理员,从客诉记录抽取结构化字段,输出严格 JSON。订单号、数量、日期照原文逐字,找不到的字段留空字符串或空数组,绝不编造。',
    userPromptTemplate: '请从下面客诉记录抽取要素,只输出严格 JSON,找不到的留空、不要编造:\n{"customer":"","orderNo":"","product":"","complaintDate":"","problemType":"","problemDesc":"","quantityAffected":"","customerRequest":"","urgency":"","contact":""}\n客诉记录:\n---\n{{input}}\n---'
  }),
  base({
    id: 'analysis.print-job-ledger-extract', label: '生产台账提取', shortLabel: '台账提取', icon: '🗒️',
    tags: ['印刷', '提取', '台账'], allowedActions: ['comment', 'none'], defaultAction: 'none',
    defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从生产单/工单中抽取台账字段,便于登记排产、追溯批次与统计产量。',
    systemPrompt: '你是一位印刷生产文员,从工单抽取台账字段,输出严格 JSON。数量、日期、机台照原文逐字,工序状态按原文,找不到的字段留空,绝不编造产能或进度。',
    userPromptTemplate: '请从下面生产单抽取台账,只输出严格 JSON,找不到的留空、不要编造:\n{"jobNo":"","customer":"","product":"","quantity":"","paper":"","press":"","operator":"","startDate":"","dueDate":"","currentProcess":"","status":""}\n生产单:\n---\n{{input}}\n---'
  })
])

export function mergePrintingExtIntoBuiltins(b = []) {
  const ids = new Set(b.map(x => x && x.id))
  return [...b, ...PRINTING_EXT_BUILTIN_ASSISTANTS.filter(x => x && !ids.has(x.id))]
}

export default { PRINTING_EXT_BUILTIN_ASSISTANTS, mergePrintingExtIntoBuiltins }
