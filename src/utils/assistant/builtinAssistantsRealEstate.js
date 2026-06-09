/**
 * builtinAssistantsRealEstate — 「房地产/物业」领域助手包(批11)
 * 生成类插入、核查类批注、提取类none。约束:面积价格照原文,不编造证件/产权信息,审查类逐字锚点。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'realestate'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const REALESTATE_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.re-listing-desc', label: '房源描述', shortLabel: '房源描述', icon: '🏠',
    tags: ['房产', '生成', '房源'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '把房源信息写成吸引人的描述:户型采光、配套交通、亮点卖点,真实不夸大。',
    systemPrompt: '你是一位房产经纪文案,写吸引人又真实的房源描述。面积价格照原文,不编造学区/产权,不夸大。',
    userPromptTemplate: `请把下面房源信息写成描述:一句话亮点、户型与采光、装修与配套、交通与周边、适合人群。真实不夸大,面积价格照原文。\n房源信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.re-purchase-contract', label: '购房合同审查', shortLabel: '购房合同审查', icon: '📑',
    tags: ['房产', '核查', '合同'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查购房合同对买方不利之处:交付标准、面积误差、违约责任、产权办理、退房条件。',
    systemPrompt: '你是一位房产法务,审查购房合同对买方的风险。命中片段原文逐字、反引号包裹;不确定标「待人工核实」;不替代律师。',
    userPromptTemplate: `请审查下面购房合同,关注:交付标准与时间、面积误差处理、违约责任是否对等、产权办理与时限、退房与解除条件、补充协议陷阱。\n## 风险/不利条款 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n合同:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.re-lease-review', label: '租赁合同审查', shortLabel: '租赁合同审查', icon: '🔑',
    tags: ['房产', '核查', '租赁'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查租赁合同:租金涨幅、押金退还、维修责任、提前解约、转租等对承租/出租方的风险。',
    systemPrompt: '你是一位房产法务,审查租赁合同风险。命中片段原文逐字、反引号包裹;不确定标「待人工核实」;不替代律师。',
    userPromptTemplate: `请审查下面租赁合同,关注:租期与租金涨幅、押金数额与退还条件、维修与费用承担、提前解约与违约金、转租与续租、房屋瑕疵责任。\n## 风险/不利条款 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n合同:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.re-property-notice', label: '物业通知', shortLabel: '物业通知', icon: '📢',
    tags: ['物业', '生成', '通知'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把事项写成规范物业通知:停水停电、维修、缴费、活动等,清楚得体便于业主理解。',
    systemPrompt: '你是一位物业管理员,写清楚、得体的物业通知。时间地点照给定信息,语气服务性,不含歧义。',
    userPromptTemplate: `请把下面事项写成物业通知:标题、致业主、事项说明(原因/时间/影响范围)、需业主配合的事项、致歉与联系方式、落款。\n事项:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.re-project-selling-points', label: '楼盘卖点提炼', shortLabel: '楼盘卖点', icon: '🏙️',
    tags: ['房产', '提炼', '卖点'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.4,
    description: '从楼盘资料提炼核心卖点,转成购房者关心的价值点,合规不违反房产广告规定。',
    systemPrompt: '你是一位房产营销,提炼楼盘卖点为购房者价值。只用资料事实,不编造配套/学区,避免违规承诺(升值/学位保证)。',
    userPromptTemplate: `请从下面楼盘资料提炼卖点:地段交通、产品户型、配套环境、品牌物业等,转成购房者价值点(附依据)。规避升值/学位等违规承诺。\n楼盘资料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.re-renovation-budget', label: '装修预算整理', shortLabel: '装修预算', icon: '🛠️',
    tags: ['房产', '整理', '装修'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把装修项目整理成预算清单:分项、单价、数量、金额、占比,合计先列原文数字。',
    systemPrompt: '你是一位装修顾问,整理清晰的装修预算。金额照原文,合计与占比先列原文数字再算,提示易漏项。',
    userPromptTemplate: `请把下面装修信息整理成预算清单,表格:项目 | 单价 | 数量 | 金额 | 占比。末尾给合计(先列原文数字)与常见易漏项提醒。\n装修信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.re-viewing-script', label: '带看话术', shortLabel: '带看话术', icon: '🗣️',
    tags: ['房产', '生成', '销售'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '为带看场景准备话术:讲解动线、亮点呈现、化解疑虑、促成意向,专业不忽悠。',
    systemPrompt: '你是一位金牌经纪,准备专业、真诚的带看话术。基于房源真实情况,亮点实说、疑虑正面回应,不忽悠不夸大。',
    userPromptTemplate: `请为下面房源准备带看话术:带看动线与亮点呈现顺序、针对常见疑虑(朝向/楼层/价格)的回应、促成下一步意向。专业真诚。\n房源情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.re-property-rules', label: '物业管理制度', shortLabel: '物业制度', icon: '📋',
    tags: ['物业', '生成', '制度'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把管理要点写成规范物业管理制度/公约:适用范围、行为规范、责任、违约处理。',
    systemPrompt: '你是一位物业管理专家,撰写规范、可执行的管理制度。基于给定要点,条款清晰合理,不超越合法范围。',
    userPromptTemplate: `请把下面要点写成物业管理制度:目的与适用范围、各方权责、具体行为规范(分类)、违规处理、附则。条款清晰可执行。\n要点:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.re-handover-checklist', label: '房屋交接清单', shortLabel: '交接清单', icon: '✅',
    tags: ['房产', '生成', '交接'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '生成收房/退租房屋交接清单:水电气表数、设施状态、钥匙、费用结清等,便于双方确认。',
    systemPrompt: '你是一位房产服务专员,生成完整的房屋交接清单。基于场景列检查项,提示记录表读数与拍照留证。',
    userPromptTemplate: `请根据下面情况生成房屋交接清单:水电气表底数、房屋与设施状态、家具家电清点、钥匙/门禁、费用结清、双方签字。每项留记录位。\n情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.re-owner-reply', label: '业主沟通回复', shortLabel: '业主回复', icon: '💬',
    tags: ['物业', '生成', '沟通'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '针对业主投诉/咨询写得体回复:共情、说明、解决方案,维护物业与业主关系。',
    systemPrompt: '你是一位物业客服,写共情、专业的业主回复。依据给定情况,实事求是,只承诺能做到的。',
    userPromptTemplate: `请针对下面业主投诉/咨询写回复:共情→说明情况与处理→具体方案与时间→后续跟进。得体专业。\n业主诉求:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.re-registration-extract', label: '不动产登记要素', shortLabel: '登记要素提取', icon: '🗂️',
    tags: ['房产', '提取', '登记'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从不动产权证/登记材料提取权利人、坐落、面积、用途、权利性质等,输出结构化。',
    systemPrompt: '你是一位不动产登记代办,从材料抽取要素,输出严格 JSON,面积证号照原文,找不到留空。',
    userPromptTemplate: `请从下面登记材料提取要素,输出严格 JSON:\n{"owner":"","certNo":"","location":"","area":"","usage":"","rightType":"","term":"","mortgage":""}\n登记材料:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.re-investment-analysis', label: '房产投资分析', shortLabel: '房产投资分析', icon: '📈',
    tags: ['房产', '分析', '投资'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '基于给定数据分析房产投资:租金回报率、持有成本、流动性与风险,数字照原文不预测涨跌。',
    systemPrompt: '你是一位房产投资分析师,基于给定数据客观分析。回报率等先列原文数字再算,不预测房价涨跌、不做收益承诺。',
    userPromptTemplate: `请基于下面数据分析房产投资:租金回报率(先列原文数字)、持有成本、流动性、主要风险、适合的投资策略。不预测涨跌、不承诺收益。\n数据:\n---\n{{input}}\n---` })
])

export function mergeRealEstateIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...REALESTATE_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { REALESTATE_BUILTIN_ASSISTANTS, mergeRealEstateIntoBuiltins }
