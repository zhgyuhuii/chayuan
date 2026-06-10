// 保密合规自查（全离线）——政府 / 涉密部门文档保密自查辅助助手包
// 全部 group='analysis'、domain='secrecy'。严格定位：只提示与标注，不做密级判定。
// 定密属定密责任人法定职责（《保密法》），本包仅供保密自查参考，本机离线运行、内容不出网。

const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'secrecy'

// 统一护栏（所有助手 systemPrompt 末尾追加）
const GUARD =
  '【边界】你只做提示与标注，不做密级判定。国家秘密的确定、变更、解除属定密责任人的法定职责，须依《保密法》及法定程序办理；本助手输出仅供保密自查参考，不替代法定定密程序与保密审查人员。本助手在本机离线运行，不上传、不外传任何内容。严禁臆造，只基于给定文本逐字核查；凡未发现问题，必须明确写「未发现明显问题」。'

// 核查类统一输出格式（含逐字反引号锚点）
const ANCHOR =
  '\n\n输出（Markdown，按问题逐条）：\n- 风险点 / 类型：\n- 命中片段：`逐字摘录原文`\n- 说明与建议（仅提示，请人工研判，不下定性结论）\n未发现问题则写「未发现明显问题」。\n\n---\n{{input}}\n---'

const base = (extra) => ({
  group: 'analysis',
  domain: DOMAIN,
  modelType: 'chat',
  defaultModelCategory: 'chat',
  supportsRibbon: false,
  defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT,
  defaultOutputFormat: 'markdown',
  temperature: 0.2,
  ...extra
})

// 核查类：markdown + 链接批注 + 逐字锚点
const chk = (o) =>
  base({ allowedActions: ['link-comment', 'comment', 'none'], defaultAction: 'link-comment', defaultOutputFormat: 'markdown', temperature: 0.15, ...o })

// 抽取类：严格 JSON + 不写回
const ext = (o) =>
  base({ allowedActions: ['none'], defaultAction: 'none', defaultOutputFormat: 'json', temperature: 0.1, ...o })

export const SECRECY_BUILTIN_ASSISTANTS = Object.freeze([
  chk({
    id: 'analysis.sec-classify-elements',
    label: '定密要素完整性核查',
    shortLabel: '定密要素',
    icon: '🔐',
    tags: ['保密', '定密', '公文'],
    description: '核查涉密文件是否标全密级、保密期限、定密依据与定密责任人等要素，缺失即提示。',
    systemPrompt: '你是一位机关单位保密管理与定密辅助核查专家，熟悉《保守国家秘密法》及定密管理规定。' + GUARD,
    userPromptTemplate:
      '请核查这份拟定密 / 涉密文件的「定密要素」是否齐全、规范：密级（绝密/机密/秘密）、保密期限或解密条件、定密依据（所适用的保密事项范围条款）、定密责任人、定密日期。逐项指出缺失、空缺或明显不规范之处。' + ANCHOR
  }),
  chk({
    id: 'analysis.sec-marking-format',
    label: '密级标志规范核查',
    shortLabel: '密级标志',
    icon: '🏷️',
    tags: ['保密', '密级标志', '格式'],
    description: '核查密级标志的标注位置与格式是否规范（如「机密★3年」写法、标注于首页等）。',
    systemPrompt: '你是一位机关保密载体标志规范核查专家，熟悉国家秘密标志的标注规则。' + GUARD,
    userPromptTemplate:
      '请核查文中密级标志的标注是否规范：是否采用「密级★保密期限」的规范写法（如「机密★3年」）、密级与期限之间是否规范、是否存在密级名称错误（错写成"内部""绝秘"等非法定称谓）、同一文件是否出现多个不一致密级。只就文本可见信息提示，标志位置等版式问题如文本无法判断则说明「需在版式上人工核对」。' + ANCHOR
  }),
  chk({
    id: 'analysis.sec-sensitive-scan',
    label: '涉密敏感要素扫描提示',
    shortLabel: '敏感扫描',
    icon: '🔍',
    tags: ['保密', '敏感信息', '提示'],
    description: '扫描文中可能涉及国家秘密或敏感的要素（项目代号、型号、坐标、编制、部署等），标注提示人工研判。',
    systemPrompt: '你是一位保密自查辅助专家。你的职责是把文中"可能涉敏"的要素挑出来供人工研判，不判断其是否构成国家秘密。' + GUARD,
    userPromptTemplate:
      '请扫描并标注文中可能需要保密研判的敏感要素，仅作提示、不下定性结论。重点关注：项目 / 工程代号，装备 / 产品型号，具体地理坐标 / 部署位置，人员编制 / 数量 / 名册，关键时间节点，预算 / 经费具体数额，技术参数指标，内部机构与职责细节。逐条列出并提示「建议由定密责任人研判是否涉密」。' + ANCHOR
  }),
  chk({
    id: 'analysis.sec-declassify-precheck',
    label: '公开发布前脱密自查',
    shortLabel: '发布前自查',
    icon: '📤',
    tags: ['保密审查', '政务公开', '发布'],
    description: '面向拟上网/对外发布的文稿，扫描是否残留涉密、内部或不宜公开信息（保密审查环节辅助）。',
    systemPrompt: '你是一位政务公开保密审查辅助专家，熟悉"先审查、后公开"和"一事一审"要求。' + GUARD,
    userPromptTemplate:
      '这是一份拟对外公开 / 上网发布的文稿。请做发布前保密自查，找出不宜公开的内容：残留的密级或"内部资料"字样、涉密或敏感要素、未脱敏的个人信息、内部流程 / 联系方式 / 系统信息、可能引发负面解读的不当表述。逐条提示并给出"删除 / 脱敏 / 送保密审查"的处置建议（仅建议）。' + ANCHOR
  }),
  chk({
    id: 'analysis.sec-privacy-scan',
    label: '个人隐私与敏感数据核查',
    shortLabel: '隐私核查',
    icon: '🪪',
    tags: ['个人信息', '隐私', '数据安全'],
    description: '检测身份证号、手机号、银行卡、住址、健康等个人敏感信息，政务公开/数据共享前必查。',
    systemPrompt: '你是一位数据安全与个人信息保护核查专家，熟悉《个人信息保护法》《数据安全法》对敏感个人信息的要求。' + GUARD,
    userPromptTemplate:
      '请逐字检测文中的个人信息与敏感个人信息：姓名+其它可定位信息的组合、身份证号、手机号 / 固话、银行卡 / 账号、家庭住址、车牌、健康 / 生物识别、宗教 / 民族等。逐条标注，区分"一般个人信息"与"敏感个人信息"，提示在公开 / 共享前做脱敏或去标识化处理。' + ANCHOR
  }),
  chk({
    id: 'analysis.sec-carrier-label',
    label: '涉密载体标志与台账核查',
    shortLabel: '载体台账',
    icon: '📦',
    tags: ['涉密载体', '台账', '保密'],
    description: '核查涉密载体清单/台账的标志、编号、密级、数量、去向等要素是否完整规范。',
    systemPrompt: '你是一位涉密载体管理核查专家，熟悉涉密载体制作、收发、传递、保管、销毁的台账要求。' + GUARD,
    userPromptTemplate:
      '这是一份涉密载体清单 / 台账 / 交接记录。请核查要素是否完整：载体编号、名称、密级、份数 / 数量、制作或接收日期、经手 / 责任人、去向（保管 / 传递 / 销毁）、签字。指出缺项、编号不连续、数量与正文不符、密级缺失等问题。' + ANCHOR
  }),
  chk({
    id: 'analysis.sec-distribution-scope',
    label: '分发与知悉范围核查',
    shortLabel: '知悉范围',
    icon: '👥',
    tags: ['保密', '知悉范围', '分发'],
    description: '核查涉密文件的发送/抄送/分发范围是否限定在最小必要的知悉范围内。',
    systemPrompt: '你是一位保密分发管理核查专家，熟悉国家秘密"限定知悉范围、按职责确定到人"的要求。' + GUARD,
    userPromptTemplate:
      '请核查这份涉密 / 敏感文件的分发与知悉范围：主送 / 抄送 / 分发对象是否与文件密级和内容匹配、是否存在范围过大或与事项无关的单位 / 人员、是否标注了知悉范围或分发数量。逐条提示可能超范围之处，建议按"最小必要"收窄（仅建议）。' + ANCHOR
  }),
  chk({
    id: 'analysis.sec-meeting-secrecy',
    label: '会议材料涉密提示',
    shortLabel: '会议保密',
    icon: '🗂️',
    tags: ['会议', '保密', '提示'],
    description: '针对会议方案/纪要/材料，提示其中涉密敏感内容与对应的保密、分发注意事项。',
    systemPrompt: '你是一位涉密会议保密管理辅助专家，熟悉涉密会议的场所、设备、人员、材料管理要求。' + GUARD,
    userPromptTemplate:
      '这是一份会议方案 / 纪要 / 材料。请提示其中可能涉密或敏感的内容（议题、决策、数据、名单等），并就保密管理给出提示：是否需要确定密级、是否限定参会与知悉人员、材料是否需回收登记、是否涉及录音录像与设备管控。仅作提示。' + ANCHOR
  }),
  chk({
    id: 'analysis.sec-internal-mark',
    label: '内部资料 / 工作秘密标注核查',
    shortLabel: '内部标注',
    icon: '🛡️',
    tags: ['内部资料', '工作秘密', '标注'],
    description: '核查不构成国家秘密但属内部/工作秘密的材料是否做了恰当的「内部」标注与管理提示。',
    systemPrompt: '你是一位内部信息与工作秘密管理辅助专家，区分国家秘密与一般内部 / 工作秘密。' + GUARD,
    userPromptTemplate:
      '请判断这份材料是否属于不宜公开的"内部资料 / 工作秘密"（非国家秘密），核查是否做了恰当标注与管理提示：是否标"内部资料 / 仅供内部使用"、是否注明使用范围、是否存在应标未标。若内容可能达到国家秘密程度，提示「建议送定密责任人研判」。' + ANCHOR
  }),
  chk({
    id: 'analysis.sec-network-info',
    label: '网络与系统信息泄露核查',
    shortLabel: '网络信息',
    icon: '🌐',
    tags: ['网络安全', '系统信息', '保密'],
    description: '检测文中暴露的内网IP、网络拓扑、账号口令、系统路径、设备序列等技术敏感信息。',
    systemPrompt: '你是一位网络与信息系统安全核查辅助专家，熟悉技术信息泄露风险。' + GUARD,
    userPromptTemplate:
      '请逐字检测文中暴露的技术敏感信息：内网 IP / 网段、网络拓扑与设备部署、服务器 / 系统主机名与路径、账号 / 口令 / 密钥 / token、数据库连接串、设备序列号 / MAC、安全策略细节等。逐条标注并提示在对外文档中删除或打码。' + ANCHOR
  }),
  chk({
    id: 'analysis.sec-attachment-hint',
    label: '附件与图表涉密提示',
    shortLabel: '附件提示',
    icon: '📎',
    tags: ['附件', '图表', '保密'],
    description: '根据正文对附件/图表的描述，提示其中可能涉密的项，提醒对附件本体单独做人工核查。',
    systemPrompt: '你是一位保密自查辅助专家。你只能依据正文对附件 / 图表的文字描述做提示，无法看到附件本体。' + GUARD,
    userPromptTemplate:
      '请根据正文中对附件、图、表的文字描述，提示哪些附件 / 图表可能涉密或敏感（如示意图、坐标图、名单表、数据表、合同附件等），并提醒「附件本体需单独人工保密核查」。逐条列出对应的描述片段。' + ANCHOR
  }),
  ext({
    id: 'analysis.sec-extract-fields',
    label: '涉密要素抽取（台账录入）',
    shortLabel: '要素抽取',
    icon: '📑',
    tags: ['抽取', '保密台账', 'JSON'],
    description: '从涉密文件中抽取密级、期限、定密依据、责任人等要素为结构化 JSON，便于保密台账录入。',
    systemPrompt: '你是一位保密台账信息抽取助手。只抽取文中明确出现的要素，不推断、不判定密级。' + GUARD,
    userPromptTemplate:
      '从下文中抽取保密台账要素，输出严格 JSON，找不到的字段留空字符串，不要编造。结构：\n{\n  "title": "",\n  "docNumber": "",\n  "secretLevel": "",\n  "secretPeriod": "",\n  "classifyBasis": "",\n  "classifyResponsible": "",\n  "classifyDate": "",\n  "scope": "",\n  "copies": "",\n  "issuer": ""\n}\n只输出 JSON。\n\n---\n{{input}}\n---'
  })
])

export function mergeSecrecyIntoBuiltins(b = []) {
  const ids = new Set(b.map((x) => x && x.id))
  return [...b, ...SECRECY_BUILTIN_ASSISTANTS.filter((x) => x && !ids.has(x.id))]
}

export default { SECRECY_BUILTIN_ASSISTANTS }
