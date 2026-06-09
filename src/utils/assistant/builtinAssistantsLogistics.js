/**
 * builtinAssistantsLogistics — 「物流/供应链」领域助手包(批9)
 * 提取类none、生成类插入、核查类批注。约束:单号/数量/地址照原文,不臆造时效与费用。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'logistics'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.25, ...extra
})

export const LOGISTICS_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.log-waybill-extract', label: '运单信息提取', shortLabel: '运单提取', icon: '🚚',
    tags: ['物流', '提取', '运单'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从运单/面单提取寄收件人、地址、电话、货物、重量、运费、单号等结构化字段。',
    systemPrompt: '你是一位物流单证员,从运单抽取字段,输出严格 JSON,地址电话照原文,找不到留空。',
    userPromptTemplate: `请从下面运单提取字段,输出严格 JSON:\n{"waybillNo":"","sender":"","senderAddr":"","senderPhone":"","receiver":"","receiverAddr":"","receiverPhone":"","goods":"","weight":"","freight":"","carrier":""}\n运单:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.log-po-extract', label: '采购订单要素', shortLabel: '采购订单提取', icon: '📦',
    tags: ['物流', '提取', '采购'], allowedActions: ['comment', 'none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1,
    description: '从采购订单提取供应商、物料、数量、单价、交期、收货地址等,输出结构化。',
    systemPrompt: '你是一位采购单证员,从采购订单抽取要素,输出严格 JSON,数量单价交期照原文,找不到留空。',
    userPromptTemplate: `请从下面采购订单提取要素,输出严格 JSON:\n{"poNo":"","supplier":"","items":[{"name":"","spec":"","qty":"","unitPrice":""}],"deliveryDate":"","deliveryAddr":"","payment":"","totalAmount":""}\n采购订单:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.log-supplier-eval', label: '供应商评估', shortLabel: '供应商评估', icon: '⭐',
    tags: ['物流', '分析', '供应商'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '基于给定供应商表现数据,从质量、交期、价格、服务等维度做评估总结与建议。',
    systemPrompt: '你是一位采购/SQE,基于给定数据客观评估供应商。涉及打分先列原文数据,不臆造未给出的指标。',
    userPromptTemplate: `请基于下面供应商表现数据做评估:分维度(质量/交期/价格/服务/配合度)总结现状、列出问题、给改进或合作建议。数据照原文。\n供应商数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.log-inventory-report', label: '库存报告整理', shortLabel: '库存报告', icon: '🏬',
    tags: ['物流', '整理', '库存'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把库存数据整理成报告:周转、呆滞、缺货、超储情况,数字照原文并给关注建议。',
    systemPrompt: '你是一位仓储管理员,把库存数据整理成报告。数字照原文,涉及周转/占比先列原文数字,关注项客观。',
    userPromptTemplate: `请把下面库存数据整理成报告:总体情况、周转/呆滞/缺货/超储项(列具体物料)、需关注与建议。数字照原文。\n库存数据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.log-delivery-notice', label: '配送通知', shortLabel: '配送通知', icon: '📬',
    tags: ['物流', '生成', '通知'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把发货信息写成清晰的配送/发货通知:货物、单号、预计到达、收货注意、联系方式。',
    systemPrompt: '你是一位物流客服,写清晰、信息完整的配送通知。单号/时间照原文,不承诺未确认的时效。',
    userPromptTemplate: `请把下面发货信息写成配送通知:货物概要、物流单号与承运商、预计到达(照原文)、收货注意事项、客服联系方式。缺信息标【待补充】。\n发货信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.log-complaint-reply', label: '物流投诉回复', shortLabel: '物流投诉回复', icon: '💬',
    tags: ['物流', '生成', '客诉'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '针对延误/破损/丢件等投诉写得体回复:共情、说明、解决方案、补偿提示,化解情绪。',
    systemPrompt: '你是一位物流客服,写共情、负责的投诉回复。依据给定情况,不推诿、只承诺能兑现的处理。',
    userPromptTemplate: `请针对下面物流投诉写回复:共情致歉→说明情况/原因→具体解决方案→补偿或后续(照政策)→安抚。\n投诉:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.log-risk-alert', label: '供应链风险提示', shortLabel: '供应链风险', icon: '⚠️',
    tags: ['物流', '分析', '风险'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '从供应链信息中提示潜在风险:断供、交期、单一来源、库存、价格波动等,给应对方向。',
    systemPrompt: '你是一位供应链风控,从信息中识别潜在风险并给应对方向。只基于给定信息,不夸大,不臆测概率。',
    userPromptTemplate: `请从下面供应链信息提示潜在风险:断供/交期/单一来源依赖/库存高低/价格波动/物流中断等。每条:风险点、可能影响、应对建议。\n供应链信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.log-loading-plan', label: '装箱方案说明', shortLabel: '装箱方案', icon: '📐',
    tags: ['物流', '生成', '装箱'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '根据货物与箱型信息整理装箱方案说明:摆放顺序、注意事项、利用率,数据照原文。',
    systemPrompt: '你是一位物流操作,整理清晰的装箱方案说明。尺寸/数量照原文,涉及利用率计算先列原文数字,不臆算。',
    userPromptTemplate: `请根据下面货物与箱型信息整理装箱方案说明:装载顺序与摆放、重货轻货搭配、防护注意、空间利用率(计算先列原文数字)。\n货物与箱型:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.log-inout-check', label: '出入库单核对', shortLabel: '出入库核对', icon: '🔁',
    tags: ['物流', '核查', '单据'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.1,
    description: '核对出入库单与订单/实物数量是否一致,标出差异、漏记、单据要素缺失。',
    systemPrompt: '你是一位仓管核对员,核对出入库单一致性。涉及数量先列原文,差异两处都引原文逐字、反引号包裹。',
    userPromptTemplate: `请核对下面出入库单(含订单/实物对照):数量是否一致、品名规格是否相符、单据要素是否齐、有无差异或漏记。\n## 差异/问题 (若无写"核对一致")\n- 处一:\`原文逐字片段\`\n- 处二:\`原文逐字片段\`\n- 说明:\n单据:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.log-quote-compare', label: '物流报价对比', shortLabel: '报价对比', icon: '📊',
    tags: ['物流', '分析', '报价'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '把多家物流报价整理成对比表:价格、时效、服务范围、附加费,给选择建议,数据照原文。',
    systemPrompt: '你是一位物流采购,把多家报价整理对比。数据照原文,对比客观,建议基于性价比与需求,不臆造未给出的费用。',
    userPromptTemplate: `请把下面多家物流报价整理成对比表:承运商 | 价格 | 时效 | 服务范围 | 附加费 | 备注。给选择建议(说明权衡)。数据照原文。\n报价:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.log-return-handle', label: '退货处理说明', shortLabel: '退货处理', icon: '↩️',
    tags: ['物流', '生成', '退货'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', temperature: 0.3,
    description: '把退货情况整理成处理说明:退货原因、检验结果、处置方式、责任与费用归属。',
    systemPrompt: '你是一位逆向物流专员,整理清晰的退货处理说明。依据给定情况,责任与费用归属按规则,不臆断。',
    userPromptTemplate: `请把下面退货情况整理成处理说明:退货原因、到货检验结果、处置方式(重新入库/维修/报废)、责任与费用归属、后续动作。\n退货情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.log-transport-contract', label: '运输合同审查', shortLabel: '运输合同审查', icon: '📄',
    tags: ['物流', '核查', '合同'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.15,
    description: '审查运输/仓储合同:责任划分、货损赔偿、时效、保险、费用与结算等对本方不利之处。',
    systemPrompt: '你是一位物流法务,审查运输/仓储合同风险。命中片段原文逐字、反引号包裹;不确定标「待人工核实」;不替代律师。',
    userPromptTemplate: `请审查下面运输/仓储合同,关注:货损货差责任与赔偿限额、时效与延误责任、保险安排、费用与结算、免责条款是否过宽、争议解决。\n## 风险/不利条款 (若无写"未发现明显问题")\n- 命中片段:\`原文逐字片段\`\n- 问题:\n- 建议:\n合同:\n---\n{{input}}\n---` })
])

export function mergeLogisticsIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...LOGISTICS_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { LOGISTICS_BUILTIN_ASSISTANTS, mergeLogisticsIntoBuiltins }
