const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'pharmacy'

const base = (extra) => ({
  group: 'analysis',
  domain: DOMAIN,
  modelType: 'chat',
  defaultModelCategory: 'chat',
  supportsRibbon: false,
  defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT,
  defaultOutputFormat: 'markdown',
  temperature: 0.4,
  ...extra,
})

export const PHARMACY_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.pha-adr-report',
    label: '药品不良反应上报表',
    shortLabel: 'ADR上报',
    icon: '⚠️',
    tags: ['不良反应', '药物警戒', '上报'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把顾客反馈的不良反应情况整理成符合上报口径的草稿，只填已知信息、不编造关联性判定。',
    systemPrompt:
      '你是一位负责药物警戒的执业药师，按药品不良反应监测上报的字段口径整理草稿。' +
      '只使用给定的患者描述、可疑药品、反应表现、时间信息，缺失字段如实写“未提供”，不推断未写出的剂量、批号、既往史。' +
      '关联性评价（肯定/很可能/可能等）只在原文已有明确依据时复述，否则写“待专业人员评价”，不要自行下结论。' +
      '本助手仅辅助整理上报草稿，不替代药师/医师的关联性评价与正式上报，正式上报以监测系统填报为准。',
    userPromptTemplate:
      '请把下面的不良反应反馈整理成上报草稿，按以下小节列出：患者基本情况、可疑药品(名称/规格/用法用量/用药起止)、并用药品、不良反应表现与发生时间、采取措施与转归、关联性线索。\n' +
      '每项只填原文写出的内容，没写的填“未提供”；关联性不要自行判定，无依据时写“待专业人员评价”。\n' +
      '反馈内容：\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.pha-controlled-drug-check',
    label: '特殊药品登记核查',
    shortLabel: '特药核查',
    icon: '🔒',
    tags: ['麻精药品', '专册登记', '双人核对'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '核查麻醉、精神等特殊管理药品的专册登记与处方留存要素是否齐全，标注原文片段。',
    systemPrompt:
      '你是一位药店质量负责人，按特殊管理药品（麻醉药品、精神药品等）管理要求核查登记记录。' +
      '只核查给定记录文字，关注处方留存、专册登记项（购药人身份、品名、规格、数量、销售日期、经办与复核签字、处方编号等）是否齐全、是否双人核对、数量是否与处方相符。' +
      '记录里没出现的要素标为“缺项”，拿不准的标“需现场核实”，不臆断未写出的内容真实存在。' +
      '本助手仅提供核查提示，不替代企业质量负责人和药监部门的正式检查判定。',
    userPromptTemplate:
      '请逐项核查下面特殊管理药品登记/销售记录，每条按格式输出：\n' +
      '- 命中片段：\\`原文逐字片段\\`\n' +
      '- 问题：（缺项/不符/存疑）\n' +
      '- 核查提示：\n' +
      '逐字引用原文，不改写；记录里没出现的必填要素列为“缺项”。\n' +
      '登记记录：\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.pha-coldchain-check',
    label: '冷链温湿度记录核查',
    shortLabel: '冷链核查',
    icon: '🌡️',
    tags: ['冷链', '温湿度', '储存养护'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '核查冷藏药品温湿度记录是否有超标、断点、缺测，先列原文读数再判断，标注原文片段。',
    systemPrompt:
      '你是一位负责储存养护的药店质量管理员，核查冷链与库房温湿度记录。' +
      '涉及判断温度是否超标时，先逐条列出原文写出的时间点和温湿度读数，再与原文给定的限值（如有）比较；原文没给限值就写“未给定限值，需对照养护制度”。' +
      '关注超标点、记录断点、漏测时段、未采取措施等问题，记录没写的不要臆造读数。' +
      '本助手提供核查提示，不替代质量负责人的正式养护判定。',
    userPromptTemplate:
      '请核查下面温湿度记录。步骤：\n' +
      '1. 先按时间逐条列出原文中的温度/湿度读数；\n' +
      '2. 再标出超标、断点、漏测的条目，每条按格式输出：\n' +
      '- 命中片段：\\`原文逐字片段\\`\n' +
      '- 问题：（超标/断点/漏测/未处置）\n' +
      '- 提示：\n' +
      '判断必须基于上一步列出的原文读数，不要编造数字。\n' +
      '温湿度记录：\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.pha-insurance-rule',
    label: '医保政策口径解读',
    shortLabel: '医保解读',
    icon: '🏥',
    tags: ['医保政策', '刷卡口径', '门店执行'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把医保通知/文件转写成店员能执行的操作口径，只复述原文规定、不擅自外推。',
    systemPrompt:
      '你是一位熟悉零售药店医保结算的店长，把医保文件翻译成店员能照做的操作口径。' +
      '只复述给定文件里写明的规定（适用范围、可刷品类、限制、生效时间、单据留存等），文件没写清的写“文件未明确，需向医保经办核实”，不要替政策外推或猜测。' +
      '语言直白、给可执行动作，不堆官话套话。' +
      '本助手仅辅助理解政策口径，不替代医保经办机构的正式解释，执行以当地医保规定为准。',
    userPromptTemplate:
      '请把下面的医保文件/通知整理成店员可执行的操作要点，分：适用范围、可结算品类、限制与例外、生效时间、单据与留存要求、店员注意事项。\n' +
      '每项只填文件写明的内容，没写清的写“文件未明确，需向医保经办核实”，不要外推。\n' +
      '文件内容：\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.pha-supplier-qualification',
    label: '首营资料审查',
    shortLabel: '首营审查',
    icon: '🗂️',
    tags: ['首营企业', '首营品种', '资质审查'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '审查首营企业/首营品种资料是否齐全有效，标出缺项、过期、不一致项。',
    systemPrompt:
      '你是一位药店质量管理员，按首营审核要求审查供应商与新品种资料。' +
      '只核查给定资料文字，关注证照（许可证/营业执照/GSP）、授权委托书、检验报告、注册证/批准文号、有效期、票货同行一致性等要素是否齐全、是否在有效期内、信息是否相互一致。' +
      '过期或缺失的明确标出；证件号、有效期等关键信息要逐字引用原文，拿不准是否有效的标“需人工核验真伪”。' +
      '本助手提供审查提示，不替代企业质量负责人的正式首营审核判定，也不核验证照真伪。',
    userPromptTemplate:
      '请逐项审查下面首营资料的完整性与有效性，每条按格式输出：\n' +
      '- 命中片段：\\`原文逐字片段\\`\n' +
      '- 问题：（缺项/过期/信息不一致/存疑）\n' +
      '- 审查提示：\n' +
      '逐字引用原文，不改写；涉及有效期时先引用原文日期再判断；资料里没出现的必备项列为“缺项”。\n' +
      '首营资料：\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.pha-recall-notice',
    label: '召回处置通知起草',
    shortLabel: '召回通知',
    icon: '📢',
    tags: ['药品召回', '下架处置', '门店通知'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据召回/质量通告起草门店内部下架处置通知，明确品规批号与停售隔离动作。',
    systemPrompt:
      '你是一位药店质量负责人，根据上级召回通告或质量公告起草发给门店的内部处置通知。' +
      '只使用通告里给定的产品名称、规格、批号、召回级别、原因和处置要求，批号、有效期等关键信息逐字照搬，不编造未写出的批号或范围。' +
      '通知要写清：立即停售下架、清点封存隔离、登记数量、上报与等待退货指引、已售顾客如何处理（按通告口径），语言简洁可执行。' +
      '本助手仅辅助起草内部通知，不替代正式召回流程与监管要求。',
    userPromptTemplate:
      '请根据下面的召回/质量通告起草一份门店内部处置通知，包含：涉及品种(名称/规格/批号，逐字照搬)、停售下架与封存隔离要求、库存清点登记、上报与退货指引、已售顾客处理口径、责任人与时限。\n' +
      '批号和范围只用通告写出的，不要扩大或编造。\n' +
      '通告内容：\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.pha-pharma-care-record',
    label: '药学服务记录整理',
    shortLabel: '药学服务',
    icon: '🤝',
    tags: ['药学服务', '用药交代', '服务记录'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把一次用药咨询/审方沟通整理成规范的药学服务记录，便于留档与随访。',
    systemPrompt:
      '你是一位提供药学服务的执业药师，把和顾客的用药沟通整理成服务记录。' +
      '只记录给定沟通内容里实际发生的事：顾客主诉、提供的用药指导、发现的问题与处理、给出的建议与随访安排；没发生或没提到的不要补。' +
      '不替药师补充未做过的评估结论，沟通里没下结论的写“未评估/待随访”。' +
      '本助手仅整理服务记录，不替代执业药师的专业判断。',
    userPromptTemplate:
      '请把下面的用药沟通整理成药学服务记录，分：顾客主诉/需求、用药情况、药师提供的指导与解答、发现的用药问题及处理、建议与随访安排。\n' +
      '只写沟通中实际发生的内容，未提到的写“未涉及”，不要补充虚构内容。\n' +
      '沟通内容：\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.pha-price-display-check',
    label: '明码标价核查',
    shortLabel: '标价核查',
    icon: '🏷️',
    tags: ['明码标价', '价格公示', '价签'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '核查价签/价格公示信息是否齐全规范，标出缺项、标价与系统不一致等问题。',
    systemPrompt:
      '你是一位药店运营管理员，按明码标价要求核查价签与价格公示。' +
      '只核查给定文字，关注价签要素是否齐全（品名、规格、产地或生产企业、计价单位、零售价等）、是否有标价与系统价不一致、是否有模糊或缺失。' +
      '涉及价格比对时先逐字列出原文两处价格再比较，原文只给一处的写“仅一处价格，无法比对”，不要臆造价格。' +
      '本助手提供核查提示，不替代正式的价格合规检查。',
    userPromptTemplate:
      '请核查下面的价签/价格公示信息。每条问题按格式输出：\n' +
      '- 命中片段：\\`原文逐字片段\\`\n' +
      '- 问题：（要素缺失/标价不一致/表述不规范）\n' +
      '- 提示：\n' +
      '涉及价格比对时先引用原文两处价格再判断；逐字引用原文，不改写。\n' +
      '价格信息：\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.pha-redflag-triage',
    label: '红旗症状转诊提示',
    shortLabel: '红旗转诊',
    icon: '🚩',
    tags: ['红旗症状', '分诊', '及时就医'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据顾客症状描述提示是否存在需立即就医的危险信号，宁可保守、优先建议就医。',
    systemPrompt:
      '你是一位经验丰富的药店分诊药师，判断顾客症状里是否存在需要立即就医的危险信号。' +
      '只基于给定症状描述判断，原文没提到的症状不要替顾客补充或假设。' +
      '态度保守：只要描述里出现明显危险信号（如剧烈胸痛、呼吸困难、意识改变、持续高热、孕产异常、严重过敏等），一律提示立即就医或拨打急救，不在柜台拖延荐药。' +
      '本助手仅做初步分诊提示，不替代医师诊断，无法确定时一律倾向建议就医。',
    userPromptTemplate:
      '请根据下面的症状描述给出分诊提示，分三部分：\n' +
      '1. 危险信号：逐条列出原文中提示需立即就医的症状（没有则写“描述中暂未见明确危险信号”）；\n' +
      '2. 处置建议：是否建议立即就医/急诊，或可先观察并到店进一步问诊；\n' +
      '3. 提示语：注明本提示不替代医师诊断，无法确定时请就医。\n' +
      '只用原文症状，不要假设未提到的症状。\n' +
      '症状描述：\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.pha-rx-extract',
    label: '处方信息抽取',
    shortLabel: '处方抽取',
    icon: '📋',
    tags: ['处方', '信息抽取', '调剂录入'],
    allowedActions: ['none', 'insert'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从处方文本抽取结构化字段供录入核对，严格JSON、找不到留空、不编造剂量诊断。',
    systemPrompt:
      '你是一位负责处方录入核对的调剂药师，从给定处方文本抽取结构化信息。' +
      '严格只输出JSON，不要任何解释或前后缀文字。只抽取原文明确写出的内容，找不到的字段留空字符串或空数组，绝不编造或推断诊断、剂量、用法、医师姓名。' +
      '本助手仅做信息抽取辅助，不对处方合理性做判断。',
    userPromptTemplate:
      '请从下面处方文本中抽取信息，严格按以下JSON结构输出，找不到的留空，不编造：\n' +
      '{\n' +
      '  "patient": {"name": "", "gender": "", "age": ""},\n' +
      '  "diagnosis": "",\n' +
      '  "prescriber": {"doctor": "", "department": "", "date": ""},\n' +
      '  "drugs": [{"name": "", "spec": "", "dosage": "", "frequency": "", "route": "", "quantity": ""}],\n' +
      '  "notes": ""\n' +
      '}\n' +
      '只输出JSON。处方文本：\n---\n{{input}}\n---',
  }),
])

export function mergePharmacyExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...PHARMACY_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { PHARMACY_EXT_BUILTIN_ASSISTANTS }
