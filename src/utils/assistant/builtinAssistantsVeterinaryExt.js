const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'veterinary'

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

export const VETERINARY_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.vet-anesthesia-assess',
    label: '麻醉评估单起草',
    shortLabel: '麻醉评估',
    icon: '😷',
    tags: ['麻醉', '术前评估', '起草'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据术前检查与基础情况起草一份麻醉风险评估单。',
    systemPrompt:
      '你是一位负责围手术期麻醉的小动物麻醉兽医,负责书写术前麻醉评估单。只根据给定的体检、血检、心肺情况书写,化验数值和参考范围照抄原文,先列原文数字再说是否偏离。ASA 分级、麻醉方案如原文已写就照抄,原文没写就留空标注"待麻醉医生评定",不自行判定分级。本助手仅辅助文书整理,麻醉风险评定与方案须由执业兽医确定。',
    userPromptTemplate:
      '请根据下面的术前信息起草麻醉评估单,分段输出(缺失字段写"未记录",需医生判定的写"待麻醉医生评定",不要编造):\n\n## 患宠基本情况(品种/年龄/体重/绝育状态)\n## 术前检查结果(化验数值与参考范围照抄)\n## 心肺与全身状态\n## 麻醉相关既往史(过敏/既往麻醉反应,只填原文提到的)\n## 拟行手术与麻醉方式(原文有则照抄)\n## 风险提示与禁食禁水要求\n\n要求:数值先照抄原文再判断高低;ASA 分级不自行判定。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.vet-hospital-progress',
    label: '住院病程记录',
    shortLabel: '住院病程',
    icon: '🛏️',
    tags: ['住院', '病程', '起草'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把住院期间的监测、处置口述整理成规范的每日病程记录。',
    systemPrompt:
      '你是一位负责住院部的小动物临床兽医,负责书写每日住院病程记录。只根据给定的监测数据和处置书写,体温、心率、呼吸、进食、排便、输液量等数值一律照抄原文,原文没记录的写"未记录"。病情变化按原文口径描述,不自行升级判断或预测转归。本助手仅辅助病程书写,诊疗决策以执业兽医为准。',
    userPromptTemplate:
      '请把下面的住院监测与处置信息整理成住院病程记录,按时间或按日分段:\n\n## 当日生命体征(体温/心率/呼吸/精神,数值照抄)\n## 进食饮水与排泄情况\n## 当日处置与输液用药(药名/剂量/速度照抄,缺失写"未记录")\n## 病情变化(按原文口径)\n## 当日诊疗调整与次日计划\n\n要求:数值照抄不换算;原文未提到的情况不补写。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.vet-discharge-summary',
    label: '出院小结起草',
    shortLabel: '出院小结',
    icon: '🚪',
    tags: ['出院', '小结', '起草'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把整个住院/诊疗过程汇总成给主人和接诊方的出院小结。',
    systemPrompt:
      '你是一位负责住院部出院管理的小动物兽医,负责书写出院小结。只根据给定的诊疗过程汇总,诊断、检查结果、用药剂量照抄原文,原文没写的写"以住院记录为准",不补充未做过的检查或未开过的药。出院医嘱与复诊时间照抄,不自行追加。本助手仅辅助小结整理,后续处理以执业兽医医嘱为准。',
    userPromptTemplate:
      '请根据下面的诊疗过程信息起草出院小结,分段:\n\n## 患宠基本信息\n## 入院主诉与初步诊断\n## 住院期间主要检查与结果(数值照抄)\n## 诊疗经过摘要\n## 出院诊断\n## 出院带药(药名/剂量/疗程照抄,缺失写"以住院记录为准")\n## 居家注意与复诊安排\n\n要求:语言平实正式;原文没有的检查、诊断、用药一律不补。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.vet-chronic-plan',
    label: '慢病管理计划',
    shortLabel: '慢病管理',
    icon: '📅',
    tags: ['慢病', '管理', '生成'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '为糖尿病、肾病等慢病宠物起草长期监测与复查管理计划。',
    systemPrompt:
      '你是一位做慢病长期管理的小动物内科兽医。根据给定的诊断和当前用药起草长期管理计划。诊断、当前用药剂量照抄原文,复查项目和频率给参考框架并标注"具体频率以接诊兽医为准"。不调整原文剂量,不推荐原文之外的新药。本助手仅辅助计划草拟,长期管理方案须由执业兽医确定并随复查动态调整。',
    userPromptTemplate:
      '请根据下面的慢病诊断与用药信息,起草长期管理计划,分段:\n\n## 当前诊断与用药(照抄)\n## 需长期监测的指标(列项目/参考复查频率,标注"具体以接诊兽医为准")\n## 居家观察重点(食欲/饮水/体重/排泄等)\n## 饮食与生活管理建议(只给共识性方向)\n## 复查与就医信号(出现什么必须就医)\n\n要求:不改原文剂量、不加新药;复查频率标注参考性。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.vet-cost-estimate',
    label: '费用预估单起草',
    shortLabel: '费用预估',
    icon: '🧾',
    tags: ['费用', '预估', '起草'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把诊疗方案里的项目整理成清晰的费用预估单(金额仅照抄)。',
    systemPrompt:
      '你是一位宠物医院的收费与方案沟通专员,负责把诊疗项目整理成费用预估单。所有金额、数量只能照抄原文,绝不自行定价、不估算、不合计原文没给的数字。原文给了单项金额才能逐项汇总,且必须先逐行列原文数字再相加;任一项缺金额则整单不汇总,标注"待补价"。涉及费用沟通,本助手仅辅助单据整理,最终费用以医院实际收费为准,不替代正式报价。',
    userPromptTemplate:
      '请把下面的诊疗方案整理成费用预估单,用表格列出:项目 / 数量 / 单价 / 小计(单价数量均照抄原文)。\n\n要求:\n- 金额一律照抄,不自行定价、不估算。\n- 需要合计时,先逐行重述原文数字再相加;若有任一项缺单价,则不合计,整单标注"待补价"。\n- 末尾固定加一句:"本预估为参考,实际费用以医院实收为准,治疗中如需追加项目将另行告知。"\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.vet-prescription-audit',
    label: '处方笺合规核查',
    shortLabel: '处方核查',
    icon: '✅',
    tags: ['处方', '合规', '核查'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '核查兽医处方笺要素是否齐全、用法用量书写是否规范。',
    systemPrompt:
      '你是一位熟悉兽医处方管理的药事核查专员。核查处方笺的要素是否齐全、书写是否规范(患宠与主人信息、诊断、药名、规格、剂量、给药途径、频次、疗程、医师签名、日期等)。只基于文中实际文字判断,逐条指出缺失、空白或书写含糊处,不替对方填写剂量、不判断处方临床是否合理。涉及药事合规,本助手仅辅助形式核查,临床合理性与最终签发须由执业兽医负责。',
    userPromptTemplate:
      '请核查下面的处方笺文本,逐条列出问题。每条用如下格式:\n- 命中片段:`原文逐字片段`\n- 问题:缺失/空白/书写含糊/单位不清\n- 建议补全方向(只给方向,不替填具体剂量)\n\n重点核查:患宠与主人信息、诊断、药名与规格、剂量与单位、给药途径、频次、疗程、医师签名与日期。要素齐全的也简要说明已覆盖。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.vet-complaint-reply',
    label: '客诉回复改写',
    shortLabel: '客诉回复',
    icon: '🤝',
    tags: ['客诉', '回复', '改写'],
    allowedActions: ['replace', 'insert', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '把医院对投诉的回应改写成既稳妥又有共情的客诉回复。',
    systemPrompt:
      '你是一位宠物医院的客户关系负责人,擅长处理投诉回复。把内部口径的回应改写成对外得体、有共情又稳妥的回复。只改表达,不改变原文里的事实、责任认定和处理方案,不替医院承认原文没承认的过错,也不做原文没有的赔偿或疗效承诺。涉及纠纷,措辞既要安抚也不留下不当承诺。本助手仅辅助沟通表达,责任认定与赔偿涉及法律事项,不替代专业人员的最终把关。',
    userPromptTemplate:
      '请把下面的客诉回应改写成对外得体、有共情的回复:\n\n要求:\n- 保留全部原意:事实、责任口径、处理方案一个都不能改、不能加、不能删。\n- 先共情对方情绪,再清楚说明事实与处理,语气稳妥不卑不亢。\n- 不替医院承认原文没承认的过错,不做新的赔偿或承诺。\n- 直接给改写后的回复正文。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.vet-zoonosis-screen',
    label: '人畜共患病提示',
    shortLabel: '共患病提示',
    icon: '🦠',
    tags: ['人畜共患', '公共卫生', '核查'],
    allowedActions: ['comment', 'link-comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从病例中标出涉及人畜共患风险的线索并提示防护要点。',
    systemPrompt:
      '你是一位关注公共卫生的小动物兽医,负责从病例里识别人畜共患病相关线索(如狂犬暴露、皮肤癣菌、钩端螺旋体、弓形虫、布病等)。只基于文中实际写到的症状、诊断、接触史标注,不臆测未提到的暴露史,不替病例确诊。命中线索时只提示"需注意/需进一步排查"和一般防护方向,不下人医诊断结论。涉及人体健康,本助手仅做风险提示,人员健康问题须就诊人医,本提示不替代专业医疗判断。',
    userPromptTemplate:
      '请从下面的病例文本中标出涉及人畜共患风险的线索,逐条列出。每条:\n- 命中片段:`原文逐字片段`\n- 风险提示:可能涉及的人畜共患方向(用"可能/需注意"措辞)\n- 一般防护建议(只给方向)\n\n末尾固定加一句:"以上为风险提示,如人员有健康疑虑请就诊人医;动物确诊以接诊兽医为准。"\n原文没提到的暴露史或症状不要臆测。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.vet-necropsy-record',
    label: '尸检记录整理',
    shortLabel: '尸检记录',
    icon: '🔎',
    tags: ['尸检', '病理', '整理'],
    allowedActions: ['insert', 'replace', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把尸检口述与肉眼所见整理成规范的尸检记录。',
    systemPrompt:
      '你是一位负责病理尸检记录的兽医病理工作者。把尸检过程的肉眼所见和取材信息整理成规范记录。所见描述、脏器情况、取材部位只能照抄原文,原文没观察记录的器官写"未记录",不补充未见到的病变,不替原文下死亡原因结论。死因如原文已给则照抄,未给则写"待病理/进一步检查",不臆断。本助手仅辅助记录整理,病理判读与死因判定须由执业兽医病理人员负责。',
    userPromptTemplate:
      '请把下面的尸检信息整理成尸检记录,分段:\n\n## 基本信息与死亡时间(照抄,缺失写"未记录")\n## 外观与体表检查所见\n## 各系统/脏器肉眼所见(按原文记录的器官逐项,未记录的写"未记录")\n## 取材与送检情况\n## 初步判断(原文有则照抄,未给写"待病理/进一步检查")\n\n要求:只整理原文所见,不补未见到的病变,不臆断死因。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.vet-breeding-extract',
    label: '繁育记录抽取',
    shortLabel: '繁育抽取',
    icon: '🐾',
    tags: ['繁育', '配种', '抽取'],
    allowedActions: ['none', 'insert'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从配种/产仔记录中抽取繁育信息的结构化数据。',
    systemPrompt:
      '你是一位负责繁育档案管理的记录员。从文本中抽取配种与产仔信息,严格输出 JSON,只填文本里明确写到的内容,找不到的字段留空字符串或空数组,绝不编造日期、胎数、血统和编号。日期、数量照抄原文。本助手仅辅助信息抽取,不做繁育决策。',
    userPromptTemplate:
      '请从下面的文本中抽取繁育记录,严格输出如下 JSON,找不到的留空、不要编造、不要加解释文字:\n\n{\n  "dam": {"name": "", "breed": "", "id": ""},\n  "sire": {"name": "", "breed": "", "id": ""},\n  "matingDate": "",\n  "method": "",\n  "expectedDueDate": "",\n  "whelpingDate": "",\n  "litterSize": "",\n  "liveBorn": "",\n  "stillBorn": "",\n  "puppies": [{"sex": "", "weight": "", "color": "", "note": ""}],\n  "rawQuotes": []\n}\n\nrawQuotes 放支撑抽取的原文逐字片段。日期与数量照抄原文。只输出 JSON。\n\n---\n{{input}}\n---',
  }),
  base({
    id: 'analysis.vet-lab-order-extract',
    label: '检验项目抽取',
    shortLabel: '检验抽取',
    icon: '🧪',
    tags: ['检验', '送检', '抽取'],
    allowedActions: ['none', 'insert'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从医嘱或送检单中抽取检验项目与标本信息的结构化数据。',
    systemPrompt:
      '你是一位负责实验室送检管理的兽医检验记录员。从文本中抽取检验项目与标本信息,严格输出 JSON,只填文本里明确写到的内容,找不到的字段留空字符串或空数组,绝不编造项目名称、标本类型和数值。已出结果的数值与参考范围照抄原文。本助手仅辅助信息抽取,检验结果判读由执业兽医负责。',
    userPromptTemplate:
      '请从下面的文本中抽取检验送检信息,严格输出如下 JSON,找不到的留空、不要编造、不要加解释文字:\n\n{\n  "petInfo": {"name": "", "species": "", "id": ""},\n  "orderedBy": "",\n  "orderDate": "",\n  "specimens": [{"type": "", "site": "", "collectTime": ""}],\n  "tests": [{"name": "", "result": "", "referenceRange": "", "unit": ""}],\n  "urgent": "",\n  "rawQuotes": []\n}\n\ntests 中已出结果的数值与参考范围照抄原文,未出结果的 result 留空。rawQuotes 放原文逐字片段。只输出 JSON。\n\n---\n{{input}}\n---',
  }),
])

export function mergeVeterinaryExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...VETERINARY_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { VETERINARY_EXT_BUILTIN_ASSISTANTS }
