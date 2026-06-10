/**
 * builtinAssistantsMedicalExt — 「医疗/医学」领域扩展包
 * 在现有 builtinAssistantsMedical 之外补充:起草类(出院小结/入院记录)、核查类(病历质控/
 * 用药禁忌/危急值闭环/手术记录/医保合规)、抽取类(病案首页要素/既往用药史/检验异常趋势)。
 * 与现有包语义不重复。所有助手仅辅助整理与核查,不替代执业医师诊断、处方与决策。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'medical'
const DISCLAIM = `重要:本助手仅辅助文书整理与核查,不替代执业医师的诊断、处方与医疗决策;只依据给定资料,不臆断诊断、不编造检查值或剂量,涉及个体处置一律提示"请遵医嘱/请医师确认"。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const MEDICAL_EXT_BUILTIN_ASSISTANTS = Object.freeze([
  base({
    id: 'analysis.med-discharge-draft', label: '出院小结起草', shortLabel: '出院小结', icon: '🏥',
    tags: ['医疗', '起草', '出院小结'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '把住院全过程信息起草成规范出院小结:入院情况、诊疗经过、出院诊断、出院医嘱与随访。',
    systemPrompt: `你是一位临床住院医师,起草规范出院小结。只依据给定的住院资料书写,缺项写"未记录",不补未发生的诊疗、不编造检查值与用药剂量。出院诊断、用药、复查安排严格照原文医嘱。${DISCLAIM}`,
    userPromptTemplate: `请根据下面住院信息起草出院小结,按段落输出:
1. 入院日期/出院日期/住院天数(照原文,缺则写未记录)
2. 入院诊断
3. 入院时主要情况(主诉、阳性体征、关键检查)
4. 诊疗经过(治疗措施与病情演变,按时间线)
5. 出院诊断
6. 出院时情况(症状、体征、关键复查值,照原文数值)
7. 出院医嘱(用药照原文剂量用法、活动与饮食、复查项目)
8. 随访与复诊提示
忠于原文,数据先引原文再不做推算。结尾提示"以经治医师签发为准"。
住院信息:
---
{{input}}
---` }),
  base({
    id: 'analysis.med-admission-draft', label: '入院记录起草', shortLabel: '入院记录', icon: '📥',
    tags: ['医疗', '起草', '入院记录'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.3,
    description: '把问诊与查体素材起草成规范入院记录:主诉、现病史、既往史、体格检查、初步诊断与诊疗计划。',
    systemPrompt: `你是一位临床住院医师,把问诊与查体素材整理成规范入院记录。只用给定信息,阴性病史与体征不记录则写"未述及/未查",不替患者补充症状、不编造体征数值。${DISCLAIM}`,
    userPromptTemplate: `请把下面问诊查体素材起草成入院记录,按规范段落输出:
1. 主诉(症状+持续时间,一句话)
2. 现病史(起病、演变、伴随症状、诊疗经过、目前情况)
3. 既往史/个人史/过敏史/家族史(缺则写未述及)
4. 体格检查(生命体征照原文,阳性体征如实,未查写未查)
5. 辅助检查(已有结果引原文数值)
6. 初步诊断(依据原文信息,有不确定的标注"待查")
7. 诊疗计划(完善检查、初步治疗方向)
忠于原文,不臆造。结尾提示"诊断与计划以经治医师确认为准"。
素材:
---
{{input}}
---` }),
  base({
    id: 'analysis.med-qc-review', label: '病历质控核查', shortLabel: '病历质控', icon: '🔍',
    tags: ['医疗', '核查', '病历质控'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '按病历书写规范核查缺陷:要素缺失、前后矛盾、诊断与依据不符、时限与签名问题,逐条定位原文。',
    systemPrompt: `你是一位病案质控专家,按病历书写基本规范核查缺陷。只针对给定文本中实际出现或明显缺失的问题给意见,不臆测院内流程,不编造未出现的内容。把每条问题锚定到原文逐字片段。${DISCLAIM}`,
    userPromptTemplate: `请对下面病历做质控核查,按缺陷类别分组,每条包含:问题描述、缺陷级别(提示/一般/严重)、改进建议,并附逐字原文锚点:
- 要素完整性(主诉/现病史/既往史/查体/诊断/签名时限等缺失)
- 前后一致性(同一信息在不同段落是否矛盾)
- 诊断依据(诊断是否有对应症状/检查支撑)
- 数值与单位(异常或缺单位的检查值)
格式示例:
  - 缺陷[严重]:现病史缺少起病诱因
    - 命中片段:\`原文逐字片段\`
    - 建议:补充诱因或注明"无明显诱因"
仅就文本所见判断,不确定的标"需人工复核"。
病历:
---
{{input}}
---` }),
  base({
    id: 'analysis.med-drug-interaction-check', label: '用药禁忌相互作用核查', shortLabel: '用药禁忌核查', icon: '⚗️',
    tags: ['医疗', '核查', '用药安全'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '核查医嘱用药的潜在禁忌、相互作用、重复用药与剂量异常,逐条锚定原文,提示需药师复核。',
    systemPrompt: `你是一位临床药师,核查给定医嘱中潜在的用药安全问题:配伍/相互作用、与已知过敏史或诊断冲突的禁忌、重复用药、剂量或频次明显异常。只针对原文列出的药物与信息提示风险方向,不下最终结论、不替换药物;每条提示"请临床药师/医师核实"。把每条锚定到原文逐字片段。${DISCLAIM}`,
    userPromptTemplate: `请核查下面用药/医嘱的潜在安全问题,逐条输出并附逐字原文锚点:
- 可能的相互作用或配伍禁忌(两药并用方向性风险)
- 与原文所述过敏史/诊断/脏器功能的禁忌冲突
- 重复用药或同类叠加
- 剂量/频次/疗程的明显异常(先引原文数值再说明疑点)
格式示例:
  - 风险[相互作用]:A 药与 B 药联用可能影响…
    - 命中片段:\`原文逐字片段\`
    - 提示:请临床药师核实是否调整
仅依据原文药物与病史,信息不足处写"信息不足,需药师人工核查",不编造药物或剂量。
用药信息:
---
{{input}}
---` }),
  base({
    id: 'analysis.med-critical-value-loop', label: '危急值闭环核查', shortLabel: '危急值闭环', icon: '🚨',
    tags: ['医疗', '核查', '危急值'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '核查危急值记录闭环要素:报告时间、接收人、通知医师、处置与复查是否完整,逐条锚定原文。',
    systemPrompt: `你是一位医疗质量安全核查员,核查危急值处置记录的闭环完整性:危急值结果、报告时间、报告与接收人、通知主管医师时间、医师处置、复查与转归。只依据原文判断各环节是否记录,缺则标"未记录",不臆造时间与人员。把每条锚定到原文逐字片段。${DISCLAIM}`,
    userPromptTemplate: `请核查下面危急值相关记录的闭环要素,逐项给"是否完整/缺失"并附逐字原文锚点:
1. 危急值项目与数值(引原文)
2. 检验/检查报告时间
3. 报告人与接收人
4. 通知主管医师的时间
5. 医师处置措施
6. 复查结果与转归
格式示例:
  - 环节[通知医师]:缺失
    - 命中片段:\`原文逐字片段\`
    - 风险:闭环不完整,建议补记通知时间与处置
凡原文未出现的环节一律标"未记录,需人工补充",不编造。
记录:
---
{{input}}
---` }),
  base({
    id: 'analysis.med-operative-note-check', label: '手术记录要素核查', shortLabel: '手术记录核查', icon: '🔪',
    tags: ['医疗', '核查', '手术记录'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '核查手术记录关键要素是否齐全:手术名称、术者、麻醉、经过、术中所见、出血量、标本、清点核对。',
    systemPrompt: `你是一位外科病案质控专家,核查手术记录要素完整性与内在一致性。只依据原文判断要素是否记录、是否前后一致,不评价术式优劣、不补未记录的步骤。把每条锚定到原文逐字片段。${DISCLAIM}`,
    userPromptTemplate: `请核查下面手术记录的要素完整性,逐项给"已记录/缺失"并附逐字原文锚点:
- 手术日期、术前/术后诊断、手术名称
- 术者/助手/麻醉方式与麻醉医师
- 体位、切口、手术经过(关键步骤)
- 术中所见与处理
- 出血量、输血、标本去向
- 器械敷料清点与核对结果
另核查一致性:术前诊断与手术名称是否对应、术后诊断与术中所见是否相符。
格式示例:
  - 要素[出血量]:缺失
    - 命中片段:\`原文逐字片段\`
    - 建议:补记术中出血量
原文未出现的要素标"未记录,需补充",不臆造数据。
手术记录:
---
{{input}}
---` }),
  base({
    id: 'analysis.med-frontpage-extract', label: '病案首页要素抽取', shortLabel: '首页要素抽取', icon: '🗂️',
    tags: ['医疗', '抽取', '病案首页'], allowedActions: ['none'], defaultAction: 'none',
    defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从病历抽取病案首页核心填报要素为 JSON:入出院时间、主要/其他诊断、手术操作、转归等,找不到留空。',
    systemPrompt: `你是一位病案信息抽取助手,把病历中可填入病案首页的要素抽成结构化 JSON。只抽原文明确出现的信息,找不到的字段留空字符串或空数组,绝不编造诊断、编码或日期。只输出 JSON,不加解释。${DISCLAIM}`,
    userPromptTemplate: `请从下面病历抽取病案首页要素,只输出 JSON,结构如下(找不到的留空,不编造):
{
  "admission_date": "",
  "discharge_date": "",
  "length_of_stay_days": "",
  "admission_diagnosis": "",
  "principal_diagnosis": "",
  "other_diagnoses": [],
  "procedures": [{ "name": "", "date": "" }],
  "anesthesia": "",
  "discharge_status": "",
  "allergy_history": ""
}
仅抽原文明确信息,日期与诊断照原文逐字;无对应内容留空。
病历:
---
{{input}}
---` }),
  base({
    id: 'analysis.med-med-history-extract', label: '既往用药史抽取', shortLabel: '用药史抽取', icon: '🧪',
    tags: ['医疗', '抽取', '用药史'], allowedActions: ['none'], defaultAction: 'none',
    defaultOutputFormat: 'json', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '从病历/问诊抽取既往与当前用药清单为 JSON:药名、剂量、频次、用药原因、起止,找不到留空不编造。',
    systemPrompt: `你是一位临床用药信息抽取助手,把文本中提到的既往及当前用药抽成结构化 JSON。只抽原文明确提到的药物与剂量,剂量/频次照原文,缺失字段留空,绝不补全或推断未写明的剂量。只输出 JSON,不加解释。${DISCLAIM}`,
    userPromptTemplate: `请从下面文本抽取既往与当前用药清单,只输出 JSON,结构如下(找不到留空,不编造剂量):
{
  "current_medications": [
    { "name": "", "dose": "", "frequency": "", "route": "", "indication": "" }
  ],
  "past_medications": [
    { "name": "", "indication": "", "period": "", "stopped_reason": "" }
  ],
  "drug_allergies": [{ "drug": "", "reaction": "" }]
}
剂量与频次照原文逐字;原文未写明的字段留空,不推断。
文本:
---
{{input}}
---` }),
  base({
    id: 'analysis.med-lab-trend-compare', label: '检验异常趋势对比', shortLabel: '检验趋势对比', icon: '📈',
    tags: ['医疗', '核查', '检验趋势'], allowedActions: ['append', 'insert', 'none'], defaultAction: 'append',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '对比多次检验结果的变化趋势:逐项列原文数值、参考范围与升降方向,标注持续异常项,不下诊断。',
    systemPrompt: `你是一位检验结果整理助手,对比同一指标多次检验的数值变化。所有数值与参考范围照原文,先列原文两次数值再说明升/降方向与幅度;不下诊断、不预测病情走向、不开药。把异常项的原文数值原样引出。${DISCLAIM}`,
    userPromptTemplate: `请对比下面检验结果的趋势变化:
## 趋势对比表(项目 | 较早数值(原文) | 较近数值(原文) | 参考范围 | 升/降 | 是否仍异常)
## 持续异常或明显波动的项目(逐项:先引原文两次数值,再客观说明变化方向与幅度)
## 建议关注方向(科普层面,不下诊断)
所有数值照原文,数字先引原文再说升降;时间顺序不明确则标注"时序需确认"。结尾提示"趋势意义请由主诊医师判读"。
检验结果:
---
{{input}}
---` }),
  base({
    id: 'analysis.med-insurance-compliance', label: '医保病历合规核查', shortLabel: '医保合规核查', icon: '🧾',
    tags: ['医疗', '核查', '医保合规'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultOutputFormat: 'markdown', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '核查病历与费用记录的医保合规疑点:诊断与用药/检查的支撑关系、记录依据是否充分,逐条锚定原文。',
    systemPrompt: `你是一位医保病历合规审核助手,核查诊疗记录中可能影响医保结算合规的疑点:诊断是否支撑所开检查/用药、病程是否记录了对应处置依据、是否存在记录与费用不匹配的迹象。只就给定文本提示疑点方向,不做违规定性、不替代医保稽核;每条提示"需合规人员人工复核"。把每条锚定到原文逐字片段。${DISCLAIM}`,
    userPromptTemplate: `请核查下面病历/费用记录的医保合规疑点,逐条输出并附逐字原文锚点:
- 诊断支撑性(检查/用药是否有对应诊断依据)
- 病程记录是否记载了处置理由
- 记录与所列项目是否存在明显不匹配
- 适应症与限制用药提示(如原文可见)
格式示例:
  - 疑点[诊断支撑]:开具该项检查但未见对应诊断依据
    - 命中片段:\`原文逐字片段\`
    - 提示:需合规人员核实诊疗依据
仅依据原文判断,不足处写"信息不足,需人工复核",不做最终违规结论。
记录:
---
{{input}}
---` })
])

export function mergeMedicalExtIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...MEDICAL_EXT_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { MEDICAL_EXT_BUILTIN_ASSISTANTS, mergeMedicalExtIntoBuiltins }
