import { DEFAULT_ASSISTANT_ICON, normalizeAssistantIcon } from './assistantIcons.js'
import { createDefaultReportSettings } from './reportSettings.js'
import { EXTRA_BUILTIN_ASSISTANTS } from './assistant/builtinAssistantsExtra.js'
import { P5_BUILTIN_ASSISTANTS } from './assistant/builtinAssistantsP5.js'
import { P5_PLUS_BUILTIN_ASSISTANTS } from './assistant/builtinAssistantsP5Plus.js'
import { DOMAIN_MANIFEST } from './assistant/assistantDomainManifest.js'

const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const INPUT_SOURCE_SELECTION_ONLY = 'selection-only'
const INPUT_SOURCE_DOCUMENT = 'document'

export const INPUT_SOURCE_OPTIONS = [
  { value: INPUT_SOURCE_SELECTION_PREFERRED, label: '优先使用当前选中，无选中时回退全文' },
  { value: INPUT_SOURCE_SELECTION_ONLY, label: '仅处理当前选中内容' },
  { value: INPUT_SOURCE_DOCUMENT, label: '始终处理全文' }
]

export const DOCUMENT_ACTION_OPTIONS = [
  { value: 'replace', label: '替换文档内容' },
  { value: 'insert', label: '插入到光标处' },
  { value: 'insert-after', label: '插入到每段后面' },
  { value: 'prepend', label: '插入到文档最前面' },
  { value: 'comment', label: '添加批注' },
  { value: 'link-comment', label: '链接形式批注' },
  { value: 'comment-replace', label: '批注 + 替换' },
  { value: 'append', label: '追加到文末' },
  { value: 'none', label: '仅生成结果，不写回文档' }
]

export const OUTPUT_FORMAT_OPTIONS = [
  { value: 'plain', label: '纯文本' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'bullet-list', label: '项目符号列表' },
  { value: 'json', label: 'JSON' }
]

export const ASSISTANT_DISPLAY_LOCATION_OPTIONS = [
  { value: 'ribbon-main', label: '顶部主菜单' },
  { value: 'ribbon-more', label: '顶部“更多”菜单' },
  { value: 'context-menu', label: '右键菜单' },
  { value: 'context-more', label: '右键菜单的“更多”菜单' }
]

export const ASSISTANT_GROUPS = [
  { key: 'core', label: '系统助手功能' },
  { key: 'analysis', label: '文本分析分组' },
  { key: 'tools', label: '工具助手' },
  { key: 'custom', label: '自定义智能助手' }
]

// 分组显示标签(domain / group -> 中文名)。对话框与助手设置共用,避免重复维护。
export const ASSISTANT_GROUP_LABELS = {
        legal: '合同 / 法务',
        verify: '文档核对',
        'kb-verify': '知识库对比',
        secrecy: '保密合规自查（离线）',
        govreview: '政务公文审查',
        govfinance: '财政',
        govtax: '税务',
        govhrss: '人力资源社会保障',
        govcivil: '民政',
        govnatres: '自然资源 / 规划',
        govhousing: '住建',
        govenviron: '生态环境',
        govagrirural: '农业农村',
        govcommerce: '商务',
        govcultour: '文旅',
        govhealth: '卫生健康',
        govmedicare: '医保',
        govmarketreg: '市场监管',
        govstats: '统计',
        govdevreform: '发展改革',
        govindustryit: '工业和信息化',
        govtransport: '交通运输',
        govwater: '水利 / 水务',
        govforestry: '林业草原',
        govunitedfront: '统战 / 民宗',
        govarchive: '档案',
        govservicehall: '政务服务大厅',
        govhotline: '12345 热线',
        govorg: '组织部',
        govpublicity: '宣传部',
        govdiscipline: '纪检监察',
        govstaffing: '机构编制',
        govurbanmgmt: '城管执法',
        govaudit: '审计机关',
        prison: '监狱 / 戒毒',
        arbitration: '仲裁',
        forensic: '司法鉴定',
        notary: '公证',
        university: '高校行政',
        library: '图书馆',
        preschool: '学前教育',
        specialedu: '特殊教育',
        voccollege: '职业院校',
        examboard: '招生考试',
        property: '物业管理',
        construction: '建筑施工',
        securities: '证券 / 基金',
        accounting: '会计事务所',
        consulting: '管理咨询',
        exhibition: '会展',
        aviation: '民航',
        railway: '铁路',
        steel: '钢铁冶金',
        textile: '纺织服装',
        foodprocess: '食品生产加工',
        fresh: '生鲜零售',
        furniture: '家具',
        buildmaterial: '建材',
        meddevice: '医疗器械',
        medbeauty: '医疗美容',
        rehabilitation: '康复医疗',
        fitness: '健身',
        arttraining: '美术培训',
        hotel: '酒店',
        livestock: '畜牧养殖',
        cdc: '疾控',
        museum: '博物馆',
        costengineer: '工程造价',
        safetyprod: '安全生产',
        industrialpark: '园区运营',
        tradeassoc: '行业协会 / 商会',
        assetappraisal: '资产评估',
        taxagent: '代理记账',
        hrservice: '人力资源服务',
        auction: '拍卖',
        union: '工会',
        cyleague: '共青团',
        womensfed: '妇联',
        disabledfed: '残联',
        partyschool: '党校',
        finance: '财务 / 会计',
        marketing: '市场营销',
        gov: '政务 / 公文',
        hr: '人力资源',
        ecommerce: '电商 / 零售',
        tech: 'IT / 技术',
        trade: '外贸 / 跨境',
        banking: '金融 / 投融资',
        medical: '医疗 / 医学',
        education: '教育 / 教学',
        academic: '高校 / 科研',
        bidding: '招投标',
        manufacturing: '制造 / 工程',
        docutil: '通用文档工具',
        judicial: '法律 / 司法',
        defmob: '国防动员 / 人防',
        veteran: '退役军人事务',
        police: '公安 / 治安',
        court: '法院 / 审判',
        procurator: '检察',
        justice: '司法行政',
        eduadmin: '教育行政',
        school: '学校管理',
        foreign: '外事 / 外交',
        customs: '海关 / 口岸',
        publishing: '出版 / 校对',
        media: '媒体 / 新闻',
        logistics: '物流 / 供应链',
        service: '客服 / 沟通',
        data: '数据 / 报表',
        personal: '个人 / 生活',
        travel: '旅游 / 酒店',
        realestate: '房产 / 物业',
        insurance: '保险',
        energy: '能源 / 环保',
        catering: '餐饮 / 食品',
        automotive: '汽车 / 交通',
        advertising: '广告 / 公关会展',
        agriculture: '农林牧渔',
        film: '影视 / 编剧',
        gaming: '游戏',
        chemical: '化工 / 材料',
        telecom: '电信 / 通信',
        beauty: '美妆 / 日化',
        maternal: '母婴 / 育儿',
        sports: '体育 / 健身',
        nonprofit: '公益 / 社工',
        fashion: '服装 / 时尚',
        pet: '宠物',
        homeservice: '家政 / 生活服务',
        printing: '印刷 / 包装',
        psychology: '心理咨询',
        wedding: '婚庆 / 活动',
        wellness: '健康养生',
        aesthetic: '美业 / 医美',
        crossborder: '跨境电商',
        ip: '知识产权',
        translation: '翻译 / 本地化',
        survey: '测绘 / 地理',
        water: '水利 / 水电',
        landscape: '园林 / 景观',
        recruit: '招聘 / 猎头',
        elearning: '在线教育',
        mcn: 'MCN / 直播',
        community: '社区 / 社工',
        funeral: '殡葬服务',
        security: '安防 / 安保',
        jewelry: '珠宝 / 钟表',
        homedecor: '家居 / 建材',
        beverage: '茶饮 / 咖啡',
        salon: '美容美发',
        veterinary: '宠物医疗',
        cbexpress: '跨境物流',
        cultural: '文创 / 非遗',
        matchmaking: '婚恋 / 相亲',
        confinement: '月子 / 母婴护理',
        bakery: '烘焙 / 甜品',
        floral: '花艺 / 鲜花',
        photography: '摄影 / 写真',
        drivingschool: '驾校 / 驾培',
        studyabroad: '留学 / 移民',
        examprep: '考公考研培训',
        franchise: '招商加盟',
        ticketing: '票务 / 演出',
        webnovel: '网文 / 小说',
        podcast: '播客 / 音频',
        shortdrama: '短剧 / 微短剧',
        illustration: '插画 / 设计',
        music: '音乐 / 词曲',
        eldercare: '养老 / 老年服务',
        parenting: '家庭教育',
        antique: '古玩 / 收藏',
        pharmacy: '药店 / 药房',
        optical: '眼镜 / 视光',
        appliancerepair: '家电维修',
        greenplant: '绿植 / 园艺',
        moving: '搬家 / 货运',
        recycling: '二手回收',
        tea: '茶叶',
        liquor: '酒水',
        figurine: '手办 / 潮玩',
        hanfu: '汉服 / 古风',
        scriptmurder: '剧本杀',
        escaperoom: '密室逃脱',
        pottery: '陶艺 / 手作',
        calligraphy: '书法 / 国画',
        instrumentedu: '乐器教育',
        aquatic: '游泳 / 水上',
        ballsport: '球类运动馆',
        carwash: '洗车 / 美容',
        dentistry: '口腔/牙科',
        tcmclinic: '中医理疗',
        companion: '陪诊/陪护',
        organizing: '收纳整理',
        teaart: '茶艺',
        bonsai: '盆景/根雕',
        jade: '玉石/翡翠',
        coin: '钱币/邮票',
        redwood: '红木家具',
        incense: '香道/沉香',
        tutoring: '家教/一对一',
        seal: '篆刻/印章',
        koi: '观赏鱼/锦鲤',
        mounting: '字画装裱',
        funeralpet: '宠物殡葬',
        localfood: '土特产/食品礼盒',
        carrental: '租车',
        climbing: '攀岩/极限运动',
        govdoc: '法定公文',
        govparty: '党建/党务',
        govpolicy: '政策法规',
        govservice: '政务服务',
        govpetition: '信访/民生',
        govsupervise: '督查/考核',
        govemergency: '应急/舆情',
        govpersonnel: '干部/人事',
        govmeeting: '会务/综合',
        goveconomy: '经济/营商',
        govgrassroots: '基层治理',
        govpeople: '政协人大/统战',
        mildoc: '军事公文文电',
        milpolitical: '政治工作',
        miltraining: '训练管理',
        millogistics: '后勤保障',
        milequip: '装备管理',
        milsafety: '安全保密',
        milparty: '党务纪检',
        milpersonnel: '人事兵员'
}

/** 助手运行时能力默认值；具体助手可在定义上挂 runtimeCapabilities 覆盖 */
export const DEFAULT_RUNTIME_CAPABILITIES = Object.freeze({
  /** 非空时强制使用该文档写回动作（如拼写检查固定批注） */
  forceDocumentAction: null,
  /** image | audio | video：走多模态生成与错误分类 */
  mediaKind: null,
  /** true 时执行前检索绑定知识库,把命中注入 {{kbContext}} 变量(KB 对比/核查类助手) */
  useKnowledgeBase: false
})

export function mergeDefinitionRuntimeCapabilities(definition) {
  const patch = definition?.runtimeCapabilities
  return {
    ...DEFAULT_RUNTIME_CAPABILITIES,
    ...(patch && typeof patch === 'object' ? patch : {})
  }
}

/** 助手图标路径映射，与顶部更多菜单、右键菜单保持一致，每个助手使用不同图标 */
export const ASSISTANT_ICON_MAP = {
  'spell-check': 'images/check.svg',
  summary: 'images/report.svg',
  translate: 'images/ai-websites.svg',
  'text-to-image': 'images/select-images.svg',
  'text-to-audio': 'images/ai-assistant.svg',
  'text-to-video': 'images/task-orchestration.svg',
  'analysis.rewrite': 'images/replace-text.svg',
  'analysis.expand': 'images/refresh.svg',
  'analysis.abbreviate': 'images/clean.svg',
  'analysis.paragraph-numbering-check': 'images/number.svg',
  'analysis.ai-trace-check': 'images/ai-trace-check.svg',
  'analysis.comment-explain': 'images/add-caption.svg',
  'analysis.hyperlink-explain': 'images/requirement.svg',
  'analysis.correct-spell': 'images/clear-format.svg',
  'analysis.extract-keywords': 'images/select-all.svg',
  'analysis.security-check': 'images/declassify-check.svg',
  'analysis.secret-keyword-extract': 'images/declassify.svg',
  'analysis.form-field-extract': 'images/select-all-type.svg',
  'analysis.form-field-audit': 'images/review.svg',
  'analysis.polish': 'images/restore.svg',
  'analysis.formalize': 'images/template-create.svg',
  'analysis.simplify': 'images/discussion-group.svg',
  'analysis.action-items': 'images/fill.svg',
  'analysis.risks': 'images/review-report.svg',
  'analysis.term-unify': 'images/style-statistics.svg',
  'analysis.title': 'images/caption.svg',
  'analysis.structure': 'images/column-style.svg',
  'analysis.minutes': 'images/review-settings.svg',
  'analysis.policy-style': 'images/download-template.svg'
}

export function getAssistantResolvedIcon(assistantId, icon) {
  const mapped = assistantId ? ASSISTANT_ICON_MAP[assistantId] : ''
  if (mapped) return mapped
  return normalizeAssistantIcon(icon || DEFAULT_ASSISTANT_ICON)
}

export const RIBBON_DYNAMIC_SLOT_COUNT = 4
export const CONTEXT_MENU_DYNAMIC_SLOT_COUNT = 4

export const FIXED_MAIN_ASSISTANT_LABELS = {
  'spell-check': '顶部主菜单 · 拼写与语法检查',
  summary: '顶部主菜单 · 生成摘要',
  translate: '顶部主菜单 · 翻译',
  'text-to-image': '顶部主菜单 · 文本转图像',
  'text-to-audio': '顶部主菜单 · 文本转语音',
  'text-to-video': '顶部主菜单 · 文本转视频',
  'analysis.security-check': '顶部主菜单 · 保密检查',
  'analysis.rewrite': '顶部主菜单 · 文本分析 / 换种方式重写',
  'analysis.expand': '顶部主菜单 · 文本分析 / 扩写',
  'analysis.abbreviate': '顶部主菜单 · 文本分析 / 缩写',
  'analysis.paragraph-numbering-check': '顶部主菜单 · 文本分析 / 检查段落序号格式',
  'analysis.ai-trace-check': '顶部主菜单 · 文本分析 / AI 痕迹检查',
  'analysis.comment-explain': '顶部主菜单 · 文本分析 / 批注解释',
  'analysis.hyperlink-explain': '顶部主菜单 · 文本分析 / 超链接解释',
  'analysis.correct-spell': '顶部主菜单 · 文本分析 / 纠正拼写和语法',
  'analysis.extract-keywords': '顶部主菜单 · 文本分析 / 提炼关键词'
}

export const FIXED_MAIN_ASSISTANT_IDS = new Set(Object.keys(FIXED_MAIN_ASSISTANT_LABELS))

export const MAIN_CONTROL_ASSISTANT_MAP = {
  btnSpellGrammar: ['spell-check'],
  btnGenerateSummary: ['summary'],
  menuTranslate: ['translate'],
  btnTextToImage: ['text-to-image'],
  btnTextToAudio: ['text-to-audio'],
  btnTextToVideo: ['text-to-video'],
  btnDocumentDeclassifyCheck: ['analysis.security-check'],
  btnRewrite: ['analysis.rewrite'],
  btnExpand: ['analysis.expand'],
  btnAbbreviate: ['analysis.abbreviate'],
  btnParagraphNumberingCheck: ['analysis.paragraph-numbering-check'],
  btnAiTraceCheck: ['analysis.ai-trace-check'],
  btnCommentExplain: ['analysis.comment-explain'],
  btnHyperlinkExplain: ['analysis.hyperlink-explain'],
  btnCorrectSpellGrammar: ['analysis.correct-spell'],
  btnExtractKeywords: ['analysis.extract-keywords']
}

export const GROUP_CONTROL_ASSISTANT_MAP = {
  menuTextAnalysis: [
    'analysis.rewrite',
    'analysis.expand',
    'analysis.abbreviate',
    'analysis.paragraph-numbering-check',
    'analysis.ai-trace-check',
    'analysis.comment-explain',
    'analysis.hyperlink-explain',
    'analysis.correct-spell',
    'analysis.extract-keywords'
  ]
}

function getResolvedDefaultDisplayLocations(definition) {
  if (Array.isArray(definition?.defaultDisplayLocations) && definition.defaultDisplayLocations.length > 0) {
    return definition.defaultDisplayLocations.slice()
  }
  return ['ribbon-more']
}

const CORE_BUILTIN_ASSISTANTS = [
  {
    id: 'spell-check',
    label: '拼写与语法检查设置',
    shortLabel: '拼写与语法检查',
    icon: '✓',
    group: 'core',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['replace', 'insert', 'comment', 'link-comment', 'comment-replace', 'append', 'prepend', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description:
      '用于配置拼写与语法检查任务的提示词、角色和输出约束。检查完成后按此处文档动作写回（默认批注）；可与其它文本助手一样选择替换、仅生成等。',
    systemPrompt: '你是一位资深中文校对与审校专家。你的目标是稳定识别可证实的拼写、语法、标点、词语搭配错误，并返回可被程序消费的结构化 JSON。请逐字核对，不要漏掉明显错别字、同音误字、近形误字和固定词误写。严禁输出 JSON 以外文本。',
    userPromptTemplate: `你是一位专业的文字校对专家。请对以下文本进行拼写与语法检查。

要求：
1. 找出明确可证实的错别字、语法错误、标点误用、固定词误写、搭配错误
2. 必须返回合法 JSON 对象，格式严格如下：
{"issues":[{"text":"","suggestion":"","reason":"","sentence":"","prefix":"","suffix":""}]}
3. "text" 必须是原文中的连续片段；如果问题是标点，也必须返回原文中的那个标点本身
4. "suggestion" 给出最小必要改正，不要扩写整句
5. "sentence" 必须是包含该问题的原文完整句或最小完整分句，不得改写
6. "prefix"/"suffix" 分别给出问题前后紧邻的最多 12 个原文字符，不得改写
7. 不要报告风格偏好、口语化风格、语气优化等主观润色项；只报语言错误
8. 同一问题不要重复上报；同一句多个独立错误可分别上报
9. 输出前再次自检，确认“简解/再接再励/的地得/标点配对”这类明显问题没有漏报
10. 若无问题，返回 {"issues":[]}
11. 只返回 JSON，不要 markdown、不要解释、不要额外文字

待检查文本：
---
{{input}}
---`
  },
  {
    id: 'summary',
    label: '生成摘要设置',
    shortLabel: '生成摘要',
    icon: '📋',
    group: 'core',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['replace', 'insert', 'comment', 'comment-replace', 'append', 'none'],
    defaultAction: 'none',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description:
      '将选中内容或全文压缩成结构清晰的摘要。未开报告时与其它文本助手相同：模型生成后按文档动作写回；开启「报告模式」时走分段结构化计划。',
    systemPrompt: '你是一位擅长中文信息压缩、结构化表达和管理层汇报写作的摘要助手。',
    userPromptTemplate: `请为以下内容生成一份高质量摘要。

要求：
1. 先给出一句话结论
2. 再给出 3-6 条要点，按“背景 / 核心信息 / 风险或影响 / 建议动作”组织
3. 保留关键时间、数字、结论、责任主体和风险
4. 不要编造原文没有的信息
5. 如果原文信息不足，请明确标注“原文未说明”
6. 输出应适合直接写入正式文档

原文：
---
{{input}}
---`
  },
  {
    id: 'translate',
    label: '翻译',
    shortLabel: '翻译',
    icon: '🌐',
    group: 'core',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['replace', 'insert', 'comment', 'comment-replace', 'append', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '将文本翻译为目标语言，并尽可能保留原文语气和格式。',
    systemPrompt: '你是一位专业翻译与本地化助手，擅长在忠实原文的前提下输出自然、准确、符合目标语言习惯的结果。',
    userPromptTemplate: `请将下面内容翻译为 {{targetLanguage}}。

要求：
1. 忠实原文含义，不遗漏要点
2. 保持原有结构、层次、编号、项目符号和段落关系
3. 若原文包含标题、术语、专有名词、政策名称、机构名称、时间和数字，请优先使用标准译法并保持准确
4. 若原文存在歧义，优先结合上下文选择最稳妥译法，不要擅自扩写
5. 只输出翻译结果，不要解释，不要附加前言或注释
6. 如果原文已经是 {{targetLanguage}}，请进行忠实润色后输出

原文：
---
{{input}}
---`
  },
  {
    id: 'text-to-image',
    label: '文本转图像',
    shortLabel: '文本转图像',
    icon: '🖼️',
    group: 'core',
    modelType: 'image',
    defaultModelCategory: 'image',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['insert', 'comment', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    runtimeCapabilities: { mediaKind: 'image' },
    description: '根据文本直接生成图像，并将结果插入文档。',
    systemPrompt: '你是一位图像生成助手，擅长把文本需求转换为可直接用于图像模型的高质量提示词。',
    userPromptTemplate: `请生成一张图像，要求如下：
- 主题与内容：{{input}}
- 构图比例：{{aspectRatio}}
- 输出目标：适合正式文档插图，画面完整、主体明确、细节自然
- 生成要求：不要输出解释文字，只需按图像生成理解上述需求`
  },
  {
    id: 'text-to-audio',
    label: '文本转语音',
    shortLabel: '文本转语音',
    icon: '🔊',
    group: 'core',
    modelType: 'voice',
    defaultModelCategory: 'voice',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['comment', 'none'],
    defaultAction: 'none',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    runtimeCapabilities: { mediaKind: 'audio' },
    description: '根据文本直接生成语音文件。',
    systemPrompt: '你是一位语音生成助手。',
    userPromptTemplate: `请将以下内容转换为自然播报语音。
- 播报文本：{{input}}
- 语音风格：{{voiceStyle}}
- 时长参考：{{duration}}
- 要求：发音清晰、停顿自然、适合直接播放`
  },
  {
    id: 'text-to-video',
    label: '文本转视频',
    shortLabel: '文本转视频',
    icon: '🎬',
    group: 'core',
    modelType: 'video',
    defaultModelCategory: 'video',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['comment', 'none'],
    defaultAction: 'none',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    runtimeCapabilities: { mediaKind: 'video' },
    description: '根据文本直接生成视频文件。',
    systemPrompt: '你是一位视频生成助手。',
    userPromptTemplate: `请生成一段视频，要求如下：
- 视频主题：{{input}}
- 构图比例：{{aspectRatio}}
- 时长：{{duration}}
- 目标：画面完整、叙事连贯、适合直接预览或导出`
  },
  {
    id: 'analysis.rewrite',
    label: '换种方式重写',
    shortLabel: '换种方式重写',
    icon: '✍️',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['replace', 'insert', 'comment', 'comment-replace', 'append', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '保留原意的同时，换一种表达方式重新组织文本。',
    systemPrompt: '你是一位中文写作改写助手，擅长在不改变原意的前提下优化表达。',
    userPromptTemplate: `请将下面内容换一种表达方式重写。

要求：
1. 保持原意不变
2. 语言自然流畅
3. 结构更清晰
4. 不要添加原文没有的新事实

原文：
---
{{input}}
---`
  },
  {
    id: 'analysis.expand',
    label: '扩写',
    shortLabel: '扩写',
    icon: '📝',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['replace', 'insert', 'comment', 'comment-replace', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '在不偏题的前提下扩充细节、论据或背景信息。',
    systemPrompt: '你是一位擅长扩展文本细节与论证层次的写作助手。',
    userPromptTemplate: `请对下面内容进行扩写。

要求：
1. 保持主题不变
2. 补充必要背景、细节、例子或论据
3. 不夸张，不编造与主题无关的内容
4. 输出结构完整、可直接使用的文本

原文：
---
{{input}}
---`
  },
  {
    id: 'analysis.abbreviate',
    label: '缩写',
    shortLabel: '缩写',
    icon: '📎',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['replace', 'insert', 'comment', 'comment-replace', 'append', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '保留重点，压缩冗余表达，形成更短版本。',
    systemPrompt: '你是一位精炼表达助手，擅长压缩冗余但不丢失关键信息。',
    userPromptTemplate: `请将下面内容缩写为更精炼的版本。

要求：
1. 保留关键信息
2. 删除重复和冗余表达
3. 输出应简洁但可直接使用

原文：
---
{{input}}
---`
  },
  {
    id: 'analysis.comment-explain',
    label: '批注解释',
    shortLabel: '批注解释',
    icon: '💬',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['comment', 'link-comment', 'insert', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '对选中文本给出批注式解释，适合审校和培训场景。',
    systemPrompt: '你是一位文档审读助手，擅长用批注语气解释文本含义和注意事项。',
    userPromptTemplate: `请对下面内容做批注式解释。

要求：
1. 解释核心含义
2. 如有歧义或风险，指出原因
3. 输出简洁、可直接写入批注

文本：
---
{{input}}
---`
  },
  {
    id: 'analysis.hyperlink-explain',
    label: '超链接解释',
    shortLabel: '超链接解释',
    icon: '🔗',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['link-comment', 'comment', 'insert', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '对链接文本、引用文本或资料指向关系进行解释。',
    systemPrompt: '你是一位信息检索与文档引用解释助手。',
    userPromptTemplate: `请解释下面文本可能指向的链接、引用或参考含义。

要求：
1. 说明文本中的概念或引用对象
2. 如果适合，给出“建议查阅方向”
3. 输出适合写入批注的简洁说明

文本：
---
{{input}}
---`
  },
  {
    id: 'analysis.correct-spell',
    label: '纠正拼写和语法',
    shortLabel: '纠正拼写和语法',
    icon: '🧹',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['replace', 'insert', 'comment', 'comment-replace', 'append', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '模型生成修正说明或全文后，按助手设置的文档动作写回；默认以批注形式提示，可在设置中改为替换等。',
    systemPrompt: '你是一位中文校对与润色助手。请优先修正错别字、别字、同音误字、近形误字、语法和标点问题，不要漏掉明显的单字错误或常见固定词误写。',
    userPromptTemplate: `请纠正下面内容中的拼写、语法和标点问题，并直接输出修正后的完整文本。

要求：
1. 重点修正明显错别字、同音误字、近形误字和固定词误写
2. 不要遗漏单字级别的明显错误，例如“简解”这类应改为正确词语
3. 尽量保持原意、结构、编号、标题样式和段落关系
4. 不要添加原文没有的新事实，不要额外解释说明
5. 输出前请再次自检，确认修正后的文本里不再残留明显错别字

原文：
---
{{input}}
---`
  },
  {
    id: 'analysis.extract-keywords',
    label: '提炼关键词',
    shortLabel: '提炼关键词',
    icon: '🏷️',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['insert', 'comment', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'bullet-list',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '提取关键词、主题词和核心概念。',
    systemPrompt: '你是一位信息提炼助手，擅长抽取关键词和核心概念。',
    userPromptTemplate: `请从下面内容中提炼关键词。

要求：
1. 输出 5-12 个关键词
2. 优先包含主题、主体、动作、风险、时间、数字等核心信息
3. 使用项目符号或短语形式

文本：
---
{{input}}
---`
  },
  {
    id: 'analysis.paragraph-numbering-check',
    label: '检查段落序号格式',
    shortLabel: '检查段落序号格式',
    icon: '🔢',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['comment', 'link-comment', 'insert', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '检查段落序号、层级编号和编号标点是否统一规范。',
    systemPrompt: '你是一位公文排版与结构审校助手，擅长识别段落序号、层级编号、编号标点和条款结构中的不一致问题。',
    userPromptTemplate: `请检查下面文本中的段落序号格式是否规范、连续、统一。

检查重点：
1. 序号体系是否统一，如“一、（一）1.（1）”“1. 1.1 1.1.1”等是否前后一致
2. 同一层级的编号样式、括号形式、标点形式、全角半角是否混用
3. 是否存在跳号、重号、漏号、层级错位、上级下级不匹配
4. 标题或条款前的编号与正文关系是否自然，是否出现只有序号没有对应内容的情况
5. 若原文本身并未形成完整编号体系，不要强行套用模板；仅指出明显不一致或高概率错误

输出要求：
1. 只做检查，不改写原文正文
2. 每个问题都必须引用原文中的实际片段，不要编造不存在的序号
3. 对每个问题给出：原文片段、问题类型、判断依据、修改建议
4. 最后给出一套建议采用的统一编号规则
5. 如果未发现明显问题，明确写“未发现明显的段落序号格式问题”

请按以下结构输出：
## 总体结论
## 发现的问题
## 建议采用的统一规则

待检查文本：
---
{{input}}
---`
  },
  {
    id: 'analysis.ai-trace-check',
    label: 'AI 痕迹检查',
    shortLabel: 'AI 痕迹检查',
    icon: '🤖',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['comment', 'link-comment', 'insert', 'append', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description:
      '结合常见「AI 生成文本」语言与结构特征，对文档做保守、可复核的疑似度评估；在可定位的原文片段上自动添加批注，便于人工改写或留痕说明。',
    systemPrompt:
      '你是一位文档鉴伪与文风分析助手，熟悉大语言模型常见输出模式与公文/技术写作的差异。你的任务是：在**不武断断言「一定由 AI 撰写」**的前提下，标出**可指向具体原文**的疑似 AI 痕迹，并给出可执行的改写或复核建议。严禁编造原文不存在的片段；所有「命中片段」必须来自用户提供的文本且逐字一致。',
    userPromptTemplate: `请对下面文本进行 **AI 生成痕迹** 检查，用于协助人工复核（非司法鉴定）。

## 检查维度（综合判断，勿机械套模板）
1. **套话与过渡堆砌**：如「值得注意的是」「综上所述」「总体而言」「在一定程度上」「需要指出的是」「不难发现」等高频衔接是否异常密集。
2. **结构过度工整**：条目编号、对称小标题、「首先/其次/再次/最后」链式展开是否与上下文体裁不匹配。
3. **空洞概括**：缺少具体主体、时间、数据却语气斩钉截铁；泛泛的「提升」「优化」「促进」「赋能」堆叠。
4. **解释性元话语**：过多自我说明式句子（如「本文旨在…」「以下将从三方面…」）而正文信息密度低。
5. **英译腔或机翻痕迹**：语序别扭、搭配不自然、标点与中文习惯不符。
6. **免责声明式收尾**：如「以上仅供参考」「具体以实际情况为准」等与文档类型不匹配的模板化结语。
7. **与前后文不一致**：某段突然变为「百科定义体」或「教程步骤体」，与全篇风格断裂。

## 研判原则（必须遵守）
- **保守**：疑似 ≠ 定论；人类作者也可能使用套话。须写清「为何像 AI」与「也可能的人工解释」。
- **可定位**：每条疑似项必须包含可在原文中**逐字搜索**的短片段（建议 8～40 字），放在「命中片段」中。
- **不误伤**：纯法规引用、标准公文固定表述、用户明确粘贴的模板，应标为「低疑似」或「待人工复核」并说明理由。
- **无则直说**：若未发现值得标出的模式，明确写「未发现明显 AI 痕迹」。

## 输出要求
1. 不改写正文；不输出与检查无关的空泛建议。
2. 优先列出最值得人工复核的项；同类问题可合并，但每条仍须有自己的「命中片段」。
3. 每条须包含：命中片段、痕迹类型、疑似程度（高/中/低）、判断依据、改写或复核建议。
4. 疑似程度说明：
   - **高疑似**：多种独立特征同时出现，且与具体业务语境脱节。
   - **中疑似**：具备典型特征但上下文可能有合理解释。
   - **低疑似或待人工复核**：仅有轻微线索或样本过短。

请**严格按以下 Markdown 模板**输出（便于系统在原文上自动锚定批注），不要增删一级标题名称：
## 总体结论
用 1～3 句话概括整体疑似程度、主要可疑模式，以及是否建议全文人工通读。

## 高疑似项
若无则写「无」。
每条使用以下固定格式（「命中片段」反引号内必须是原文连续子串）：
- **命中片段：** \`原文片段\`
- **痕迹类型：**
- **判断依据：**
- **改写建议：**

## 中疑似项
若无则写「无」。
每条格式同「高疑似项」。

## 低疑似或待人工复核
若无则写「无」。
每条格式同「高疑似项」。

## 总体建议
给出 3～6 条可执行建议（如：压缩套话、补充具体主语与数据、统一全文语气、删除元话语等）。

## 特征词或句式汇总
列出文中反复出现的可疑套话或句式；若无则写「无」。

待检查文本：
---
{{input}}
---`
  },
  {
    id: 'analysis.security-check',
    label: '保密检查',
    shortLabel: '保密检查',
    icon: '🔐',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: true,
    defaultDisplayLocations: ['ribbon-main'],
    allowedActions: ['comment', 'link-comment', 'insert', 'append', 'none'],
    defaultAction: 'link-comment',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '基于关键词和上下文检查文档中的涉密、涉军、单位名称、密级标识和敏感业务信息风险。',
    temperature: 0.15,
    systemPrompt: '你是一位安全保密与合规审查专家。判据是语义、实体与上下文，关键词只是线索而非结论——是否涉密取决于其在具体语境中的真实含义。你做平衡判断：高/中风险依证据分级，拿不准的归入「待人工复核」而非直接放过；同时对公开、泛指、教材或新闻语境适度降噪，避免机械误报。每条命中必须是原文中逐字存在、可复核可定位的片段。',
    userPromptTemplate: `请对下面文本进行保密检查，重点识别可能涉及国家秘密、工作秘密、军工军队敏感信息、单位身份信息、商业秘密和未公开内部信息的内容。

重点关注的风险类别：
1. 密级与保密标识
如：绝密、机密、秘密、密级、内部、内部资料、内部使用、不得外传、涉密、保密、商密、商业秘密、秘密级、机密级等

2. 涉军涉装涉训信息
如：部队、战区、军区、空军、海军、陆军、火箭军、武警、联勤、装备、型号、弹药、演训、演练、值班、战备、部署、指挥、任务计划、保障方案等

3. 组织身份与单位名称
如：机关名称、部队番号、院所名称、公司全称、子公司、分支机构、供应商、合作方、客户名称、内部部门、项目组、专班名称等

4. 人员与联络信息
如：联系人姓名、职务、手机号、座机、邮箱、即时通信账号、证件号、内部通讯录、岗位身份等

5. 时间、地点、部署和流转安排
如：具体时间节点、地点位置、出发到达安排、路线、会议安排、值班安排、部署地点、库房位置、交付计划、尚未公开的项目进度等

6. 内部编号与项目标识
如：项目代号、型号代号、合同编号、文号、图号、批次号、内部编号、资产编号、账号标识、审批单号、未公开系统名称等

7. 经营与商业敏感信息
如：报价、成本、利润、投标方案、采购清单、供应链安排、客户名单、内部预算、未发布经营数据、战略合作安排等

8. 军工/政企文档中高频敏感线索
如：旅、团、营、连、舰、艇、机场、阵地、库房、仓库、试验场、雷达站、指挥所、保障基地、研究所、研究院、某型号、某系统、某工程、专项任务、联合保障、技术指标、测试数据、验收安排、采购金额、承制单位、配套单位等

优先命中的关键词线索：
- 密级类：绝密、机密、秘密、内部、内部掌握、内部使用、不得扩散、不得转载、仅限传阅
- 涉军类：部队、空军、海军、陆军、火箭军、武警、战区、装备、演训、战备、部署、型号
- 单位类：某某公司、某某研究所、某某研究院、某某中心、某某基地、项目办公室、专班
- 标识类：编号、代号、文号、合同号、图号、批次、方案号、版本号
- 联系类：联系人、电话、手机、邮箱、地址、位置、坐标
- 商业类：报价、预算、成本、利润、招标、投标、采购、供应商、客户名单

研判原则：
1. 关键词命中不等于泄密，必须结合上下文判断，不要机械命中即报高风险
2. 对常见公开词、泛化称谓、新闻公开语境、教材示例语境，要谨慎降噪，避免误报
3. 仅依据原文内容作出审慎判断，不要臆测背景、来源、真实单位或法律结论
4. 对每项风险必须说明：命中片段、风险类别、风险级别、判断依据、建议处理方式
5. 风险级别统一使用：
   - 高风险：直接出现密级标识、具体部队/单位身份、具体部署计划、未公开内部编号、明确敏感联系人信息等
   - 中风险：出现敏感关键词且上下文指向内部事项，但是否涉密仍需人工确认
   - 低风险或待人工复核：存在可疑词或敏感线索，但公开性、敏感性、上下文不足，暂不能直接判定
6. 如果文本未发现明显保密风险，明确写“未发现明显保密风险”

输出要求：
1. 不改写原文正文，不输出与审查无关的空泛表述
2. 优先列出最值得人工复核的命中项
3. 每个命中项尽量保留原文短片段，便于人工定位
4. 建议处理应尽量具体，例如：
   - 建议删除或模糊密级标识
   - 建议将具体单位全称泛化为“有关单位”
   - 建议将“空军/海军/部队”等敏感主体替换为泛称
   - 建议隐藏具体时间、地点、联系人、编号、项目代号
   - 建议移交人工保密专员复核

请严格按以下模板输出，不要新增无关章节：
## 总体结论
用 1-3 句话概括整体风险水平、最主要风险来源，以及是否建议人工复核。

## 高风险项
若无则写“无”。
每条使用以下固定格式：
- 命中片段：
- 命中关键词：
- 风险类别：
- 判断依据：
- 建议处理：

## 中风险项
若无则写“无”。
每条使用以下固定格式：
- 命中片段：
- 命中关键词：
- 风险类别：
- 判断依据：
- 建议处理：

## 低风险或待人工复核
若无则写“无”。
每条使用以下固定格式：
- 命中片段：
- 命中关键词：
- 风险类别：
- 判断依据：
- 建议处理：

## 建议处理
给出 3-6 条总体建议，优先写可执行动作。

## 可疑关键词汇总
汇总命中的关键词；若无则写“无”。

待检查文本：
---
{{input}}
---`
  },
  {
    id: 'analysis.secret-keyword-extract',
    label: '涉密关键词提取',
    shortLabel: '涉密关键词提取',
    icon: '🕵️',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从全文中提取可用于自动脱密的涉密关键词，并为每个关键词生成对应占位符。',
    systemPrompt: '你是一位安全保密文本识别助手。你的任务是从文档全文中谨慎提取可用于自动脱密的涉密关键词，并返回严格、稳定、可被程序直接消费的 JSON 结果。',
    userPromptTemplate: `请从下面全文中提取需要脱密的涉密关键词。

任务目标：
1. 识别需要在文档脱密时被替换的敏感词、敏感短语或敏感实体
2. 为每个关键词生成一个唯一的 replacementToken，作为脱密后的占位符
3. 输出必须是严格合法 JSON，不能包含 markdown、解释、注释或额外文字

识别范围：
1. 国家秘密、工作秘密、军工军队敏感信息
2. 具体单位名称、部门名称、项目代号、编号、未公开内部标识
3. 人员身份、联系人、电话、邮箱、地址、时间地点部署等敏感信息
4. 商业秘密、内部预算、客户名单、供应商信息、未公开经营数据

提取原则：
1. term 必须是原文中的连续原句片段或连续词语，不能改写
2. 仅保留真正需要脱密的词，不要输出泛化、公开、无关或过短的普通词
3. 相同关键词只保留一次
4. 优先输出更具体的词，避免同时输出被其完全包含的泛词，除非两者都确有独立脱密价值
5. replacementToken 必须短、唯一、便于替换，建议使用特殊字符包裹，例如 "§xXXx§"、"§xX2x§"
6. 若未发现明显需要脱密的关键词，返回 {"keywords":[]}

输出格式：
{
  "keywords": [
    {
      "term": "解放军",
      "category": "涉军",
      "riskLevel": "high",
      "reason": "明确涉军主体，属于高敏感实体",
      "replacementToken": "§xXXx§"
    }
  ]
}

字段要求：
- term: 原文中的涉密关键词
- category: 如 密级标识 / 涉军 / 单位信息 / 人员信息 / 时间地点 / 项目标识 / 商业敏感 / 其他
- riskLevel: high / medium / low
- reason: 一句话说明为什么需要脱密
- replacementToken: 对应的脱密占位符

全文：
---
{{input}}
---`
  },
  {
    id: 'analysis.form-field-extract',
    label: '表单智能提取助手',
    shortLabel: '表单智能提取助手',
    icon: '🧾',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['none'],
    defaultAction: 'none',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '从合同、公文、协议等文档中提取可用于表单化的结构化字段定义和字段实例。',
    systemPrompt: '你是一位表单建模与合同信息抽取助手。你的任务不是简单摘取关键词，而是从文档中识别适合沉淀为书签规则的结构化字段定义，并输出严格 JSON。',
    userPromptTemplate: `请从下面文档中提取适合做成表单字段的结构化信息。

任务目标：
1. 识别常见字段，如甲方、乙方、金额、地址、日期、联系人、电话、合同编号、项目名称、签署地点等
2. 将重复出现但语义相同的字段合并为一个字段定义
3. 同时返回该字段在文档中的实例，便于后续生成书签
4. 结果必须是严格合法 JSON，不要输出 markdown、解释、注释或其他文字

建模原则：
1. 同类字段按语义合并，如多个“甲方”统一归为一个字段定义
2. semanticKey 使用稳定英文键名，例如 partyA、partyB、contractAmount、contractAddress、signDate
3. fillHint 需能直接用于表单填写提示
4. tag 使用简短中文标签，多个标签用英文逗号分隔
5. required 基于常见合同/表单场景做稳妥判断
6. dataType 仅能使用以下值：
   string / select / integer / decimal / date / time / datetime / boolean / email / phone / idcard / url
7. constraints 仅返回有意义的字段，不要臆造复杂约束
8. reviewType 仅能使用以下值：
   none / regex / format / range / enum / llm / sensitive / consistency / logic / crossref
9. 对明显金额、日期、电话、邮箱、网址等字段，应尽量给出合适的数据类型与基础约束
10. detectedInstances 中的 value 必须来自原文连续片段，prefix 和 suffix 用于辅助定位

输出格式：
{
  "fields": [
    {
      "name": "甲方",
      "semanticKey": "partyA",
      "fillHint": "请输入合同甲方全称",
      "tag": "合同,主体",
      "required": true,
      "dataType": "string",
      "constraints": {
        "minLength": 2,
        "maxLength": 100,
        "mustContain": "",
        "mustNotContain": "",
        "pattern": ""
      },
      "reviewType": "llm",
      "reviewRule": "判断该值是否为合同中的甲方主体名称，且与上下文一致",
      "reviewHint": "请填写合同甲方正式名称",
      "remark": "由表单智能提取助手生成",
      "sampleValue": "某某科技有限公司",
      "sampleContentMode": "keep",
      "auditEnabled": true,
      "auditPriority": 80,
      "instanceStrategy": "semantic-group",
      "extractionHints": "",
      "detectedInstances": [
        {
          "value": "某某科技有限公司",
          "prefix": "甲方：",
          "suffix": "住所地：",
          "groupKey": "",
          "groupLabel": ""
        }
      ]
    }
  ]
}

字段要求：
- name: 中文字段名
- semanticKey: 稳定英文语义键
- fillHint: 表单填写提示
- tag: 中文标签，多个标签英文逗号分隔
- required: true/false
- dataType: 只能使用指定枚举值
- constraints: 只填有意义的约束
- reviewType/reviewRule/reviewHint: 用于后续审计
- sampleValue: 样例值
- sampleContentMode: keep / clear / example
- auditEnabled: 是否建议纳入审计
- auditPriority: 1-100，数字越大越重要
- instanceStrategy: 默认写 semantic-group
- extractionHints: 识别说明，可为空
- detectedInstances: 识别到的实例列表，可为空数组

如果未识别到合适字段，返回 {"fields":[]}

原文：
---
{{input}}
---`
  },
  {
    id: 'analysis.form-field-audit',
    label: '文档审计助手',
    shortLabel: '文档审计助手',
    icon: '📋',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    allowedActions: ['comment', 'none'],
    defaultAction: 'comment',
    defaultOutputFormat: 'json',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '基于书签规则、字段实例、全文上下文和助手配置，对文档进行逐书签审计、全文风险提示、批注归因和报告生成。',
    systemPrompt: '你是一位严谨的文档审计助手。你的任务不仅要围绕书签字段、字段规则、上下文线索和本地校验结果做逐书签审计，还要识别规则之外但对文档合规性、准确性、一致性、完整性有影响的风险点。你必须覆盖输入中的每个书签，不得漏项；不得编造文档外事实；结论要保守、可复核、可定位；输出既要适合写入书签批注，也要适合汇总成正式审计报告。',
    userPromptTemplate: `请根据下面提供的书签字段、字段规则、本地校验结果和文档上下文，输出逐书签的结构化审计结果。

要求：
1. 只依据给定内容进行判断，不要臆造文档外事实
2. 必须覆盖输入中的每个书签，每个书签都要返回一条 bookmarkAudits 记录，即使未发现问题也要返回
3. 审计结论要优先面向“书签批注”场景，comment 必须简洁、明确、可直接写入批注
4. 每个问题都要指出字段名、实例值、问题类型、风险级别、判断依据、改进建议
5. 风险级别仅能使用 high / medium / low
6. passed 表示该书签当前是否可初步判定为“通过审计”
7. 如果一个问题关联多个书签，请分别写到各自书签的 issues 中，不要只写全局结论
8. 如果没有问题，也要给出“未发现明显问题/建议人工复核上下文”之类的审慎 comment
9. 除了规则内审计，还要识别规则外但能从上下文中明确支持的风险或疑点，例如前后不一致、表述缺失、主体/日期/金额/附件引用异常、事实与上下文矛盾等；若能定位到书签，请写入对应书签 issues
10. 无法定位到具体书签、但确实影响全文审计结论的风险，可写入 issues，并在 reason 中明确“全文风险”
11. 输出必须是严格合法 JSON，不要输出 markdown 或解释
12. summary.conclusion 需要同时概括规则型问题和规则外全文问题；recommendations 需要同时覆盖整改建议与人工复核建议

输出格式：
{
  "summary": {
    "overallRisk": "medium",
    "conclusion": "共发现 2 项需重点复核的问题"
  },
  "bookmarkAudits": [
    {
      "bookmarkName": "甲方_f123_1",
      "fieldName": "甲方",
      "semanticKey": "partyA",
      "instanceValue": "某某科技",
      "riskLevel": "medium",
      "passed": false,
      "conclusion": "主体名称疑似不完整",
      "comment": "该书签内容疑似为简称，缺少合同主体完整法定名称，建议补全后再使用。",
      "issues": [
        {
          "issueType": "llm",
          "riskLevel": "medium",
          "reason": "名称疑似不完整，缺少正式主体后缀",
          "suggestion": "建议填写合同甲方完整法定名称"
        }
      ]
    }
  ],
  "issues": [
    {
      "bookmarkName": "甲方_f123_1",
      "fieldName": "甲方",
      "semanticKey": "partyA",
      "instanceValue": "某某科技",
      "issueType": "llm",
      "riskLevel": "medium",
      "reason": "名称疑似不完整，缺少正式主体后缀",
      "suggestion": "建议填写合同甲方完整法定名称"
    }
  ],
  "recommendations": [
    "优先补全主体名称、金额和日期等关键字段",
    "对跨项逻辑关系异常的字段进行人工复核"
  ]
}

补充说明：
- bookmarkAudits 用于逐书签展示和写入批注
- issues 用于汇总全部问题清单，通常可由 bookmarkAudits 中的问题展开得到，但请显式返回，便于程序消费
- 若未发现明显问题，summary.overallRisk 设为 low，并让对应书签的 passed=true、issues=[]
- 若某书签值为空但规则要求必填，应优先判为 high 或 medium，具体以影响程度判断
- 若本地校验已发现问题，你应结合该线索做复核，不要忽略

待审计内容：
---
{{input}}
---`
  },
  {
    id: 'analysis.polish',
    label: '润色优化',
    shortLabel: '润色优化',
    icon: '✨',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    allowedActions: ['replace', 'insert', 'comment', 'comment-replace', 'append', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '在保持原意的基础上提升专业性与可读性。',
    systemPrompt: '你是一位中文润色助手，擅长提升表达质量和专业感。',
    userPromptTemplate: `请对下面内容进行润色优化，使其更专业、流畅、自然。

原文：
---
{{input}}
---`
  },
  {
    id: 'analysis.formalize',
    label: '正式化改写',
    shortLabel: '正式化改写',
    icon: '🏛️',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    allowedActions: ['replace', 'insert', 'comment', 'comment-replace', 'append', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '将口语或松散表述改为正式书面表达。',
    systemPrompt: '你是一位公文与正式书面表达助手。',
    userPromptTemplate: `请将下面内容改写为正式、规范、适合书面文档的表达。

原文：
---
{{input}}
---`
  },
  {
    id: 'analysis.simplify',
    label: '通俗化改写',
    shortLabel: '通俗化改写',
    icon: '🪶',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    allowedActions: ['replace', 'insert', 'comment', 'comment-replace', 'append', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '把复杂专业内容改写成更容易理解的说明。',
    systemPrompt: '你是一位通俗表达助手，擅长把复杂内容讲清楚。',
    userPromptTemplate: `请将下面内容改写得更通俗易懂，适合非专业读者理解。

原文：
---
{{input}}
---`
  },
  {
    id: 'analysis.action-items',
    label: '提取行动项',
    shortLabel: '提取行动项',
    icon: '✅',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    allowedActions: ['insert', 'comment', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'bullet-list',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '从文本中提取待办、责任人和下一步动作。',
    systemPrompt: '你是一位项目协作助手，擅长提取行动项。',
    userPromptTemplate: `请从下面内容中提取行动项。

要求：
1. 尽量列出事项、责任对象、时间要求
2. 若原文没有明确责任人或时间，请标记“待明确”

文本：
---
{{input}}
---`
  },
  {
    id: 'analysis.risks',
    label: '提取结论与风险',
    shortLabel: '提取结论与风险',
    icon: '⚠️',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    allowedActions: ['insert', 'comment', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '提取结论、风险点和建议。',
    systemPrompt: '你是一位风险分析助手。',
    userPromptTemplate: `请从下面内容中提取结论与风险。

输出格式：
1. 核心结论
2. 主要风险
3. 建议动作

文本：
---
{{input}}
---`
  },
  {
    id: 'analysis.term-unify',
    label: '术语统一',
    shortLabel: '术语统一',
    icon: '📚',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    allowedActions: ['replace', 'insert', 'comment', 'comment-replace', 'append', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '统一人名、机构名、简称和术语表述。',
    systemPrompt: '你是一位术语规范化助手。',
    userPromptTemplate: `请统一下面文本中的术语、简称、称谓和表述方式。

原文：
---
{{input}}
---`
  },
  {
    id: 'analysis.title',
    label: '生成标题',
    shortLabel: '生成标题',
    icon: '📰',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    allowedActions: ['insert', 'comment', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'bullet-list',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '生成多个风格不同的候选标题。',
    systemPrompt: '你是一位标题策划助手。',
    userPromptTemplate: `请为下面内容生成 5 个候选标题，兼顾准确性与可读性。

内容：
---
{{input}}
---`
  },
  {
    id: 'analysis.structure',
    label: '段落结构优化',
    shortLabel: '段落结构优化',
    icon: '🧱',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    allowedActions: ['replace', 'insert', 'comment', 'comment-replace', 'append', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '优化段落顺序、层次关系和衔接逻辑。',
    systemPrompt: '你是一位结构化表达助手。',
    userPromptTemplate: `请优化下面内容的段落结构和逻辑层次，并输出重组后的版本。

原文：
---
{{input}}
---`
  },
  {
    id: 'analysis.minutes',
    label: '生成会议纪要',
    shortLabel: '生成会议纪要',
    icon: '🗒️',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    allowedActions: ['insert', 'append', 'comment', 'none'],
    defaultAction: 'insert',
    defaultOutputFormat: 'markdown',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '按会议纪要格式整理讨论内容。',
    systemPrompt: '你是一位会议纪要助手。',
    userPromptTemplate: `请将下面内容整理为会议纪要。

输出至少包括：
1. 会议主题
2. 主要结论
3. 待办事项
4. 风险与待确认事项

原文：
---
{{input}}
---`
  },
  {
    id: 'analysis.policy-style',
    label: '政策/公文风格改写',
    shortLabel: '政策/公文风格改写',
    icon: '📘',
    group: 'analysis',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    allowedActions: ['replace', 'insert', 'comment', 'comment-replace', 'append', 'none'],
    defaultAction: 'replace',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '改写为更符合政策、公文、正式汇报场景的语言风格。',
    systemPrompt: '你是一位政策文本与公文写作助手。',
    userPromptTemplate: `请将下面内容改写为更符合政策、公文或正式汇报场景的表达。

原文：
---
{{input}}
---`
  },
  {
    id: 'tools.barcode',
    label: '条形码批量生成',
    shortLabel: '条形码',
    icon: '🏷️',
    group: 'tools',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: [],
    allowedActions: ['none'],
    defaultAction: 'none',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    runtimeCapabilities: { isToolAssistant: true, toolId: 'tools.barcode' },
    description: '按流水号或粘贴列表批量生成条形码，网格排版插入文档'
  },
  {
    id: 'tools.serial',
    label: '流水号批量生成',
    shortLabel: '流水号',
    icon: '🔢',
    group: 'tools',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: [],
    allowedActions: ['none'],
    defaultAction: 'none',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    runtimeCapabilities: { isToolAssistant: true, toolId: 'tools.serial' },
    description: '按模板（{seq}/{date}/{rand}）批量生成流水号/批号，多列表格写入文档'
  },
  {
    id: 'tools.label',
    label: '资产物料标签批量',
    shortLabel: '资产标签',
    icon: '🏷️',
    group: 'tools',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: [],
    allowedActions: ['none'],
    defaultAction: 'none',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    runtimeCapabilities: { isToolAssistant: true, toolId: 'tools.label' },
    description: '粘贴多字段列表，每行合成「码+文字」标签图，网格排版插入文档'
  }
]

const BUILTIN_ASSISTANTS = [
  ...CORE_BUILTIN_ASSISTANTS,
  ...EXTRA_BUILTIN_ASSISTANTS,
  ...P5_BUILTIN_ASSISTANTS,
  ...P5_PLUS_BUILTIN_ASSISTANTS
].filter(item => item.id !== 'analysis.correct-spell')

// ── 领域助手包:懒加载(动态 import → Vite 拆独立 chunk,不打进主包) ──
// 基础包(CORE/EXTRA/P5/P5PLUS)保持静态、随主包加载;领域包(legal/audit/未来几百个)
// 走动态 import,在 App 启动空闲期 / 助手面板打开 / ribbon 直达执行前按需加载。
const _builtinAssistantIds = new Set(BUILTIN_ASSISTANTS.map(a => a && a.id))
/** 把懒加载到的领域包助手登记进 BUILTIN_ASSISTANTS(按 id 去重)。返回新增数。 */
export function registerLazyBuiltinAssistants(list) {
  let added = 0
  for (const a of (Array.isArray(list) ? list : [])) {
    if (a && a.id && !_builtinAssistantIds.has(a.id)) {
      BUILTIN_ASSISTANTS.push(a)
      _builtinAssistantIds.add(a.id)
      added += 1
    }
  }
  return added
}
// 领域包加载器:pack 短键 -> 动态 import。新增领域包在此加一行,并运行
// scripts/gen-assistant-domain-manifest.mjs 重生成 assistant/assistantDomainManifest.js。
export const PACK_LOADERS = {
  Legal: () => import('./assistant/builtinAssistantsLegal.js').then(m => m.LEGAL_BUILTIN_ASSISTANTS),
  Audit: () => import('./assistant/builtinAssistantsAudit.js').then(m => m.AUDIT_BUILTIN_ASSISTANTS),
  KbVerify: () => import('./assistant/builtinAssistantsKbVerify.js').then(m => m.KB_VERIFY_BUILTIN_ASSISTANTS),
  Finance: () => import('./assistant/builtinAssistantsFinance.js').then(m => m.FINANCE_BUILTIN_ASSISTANTS),
  Marketing: () => import('./assistant/builtinAssistantsMarketing.js').then(m => m.MARKETING_BUILTIN_ASSISTANTS),
  Gov: () => import('./assistant/builtinAssistantsGov.js').then(m => m.GOV_BUILTIN_ASSISTANTS),
  Hr: () => import('./assistant/builtinAssistantsHr.js').then(m => m.HR_BUILTIN_ASSISTANTS),
  Ecommerce: () => import('./assistant/builtinAssistantsEcommerce.js').then(m => m.ECOMMERCE_BUILTIN_ASSISTANTS),
  Tech: () => import('./assistant/builtinAssistantsTech.js').then(m => m.TECH_BUILTIN_ASSISTANTS),
  Trade: () => import('./assistant/builtinAssistantsTrade.js').then(m => m.TRADE_BUILTIN_ASSISTANTS),
  Banking: () => import('./assistant/builtinAssistantsBanking.js').then(m => m.BANKING_BUILTIN_ASSISTANTS),
  Medical: () => import('./assistant/builtinAssistantsMedical.js').then(m => m.MEDICAL_BUILTIN_ASSISTANTS),
  Education: () => import('./assistant/builtinAssistantsEducation.js').then(m => m.EDUCATION_BUILTIN_ASSISTANTS),
  Academic: () => import('./assistant/builtinAssistantsAcademic.js').then(m => m.ACADEMIC_BUILTIN_ASSISTANTS),
  Bidding: () => import('./assistant/builtinAssistantsBidding.js').then(m => m.BIDDING_BUILTIN_ASSISTANTS),
  Manufacturing: () => import('./assistant/builtinAssistantsManufacturing.js').then(m => m.MANUFACTURING_BUILTIN_ASSISTANTS),
  Judicial: () => import('./assistant/builtinAssistantsJudicial.js').then(m => m.JUDICIAL_BUILTIN_ASSISTANTS),
  Publishing: () => import('./assistant/builtinAssistantsPublishing.js').then(m => m.PUBLISHING_BUILTIN_ASSISTANTS),
  Media: () => import('./assistant/builtinAssistantsMedia.js').then(m => m.MEDIA_BUILTIN_ASSISTANTS),
  Logistics: () => import('./assistant/builtinAssistantsLogistics.js').then(m => m.LOGISTICS_BUILTIN_ASSISTANTS),
  Service: () => import('./assistant/builtinAssistantsService.js').then(m => m.SERVICE_BUILTIN_ASSISTANTS),
  Data: () => import('./assistant/builtinAssistantsData.js').then(m => m.DATA_BUILTIN_ASSISTANTS),
  Personal: () => import('./assistant/builtinAssistantsPersonal.js').then(m => m.PERSONAL_BUILTIN_ASSISTANTS),
  Travel: () => import('./assistant/builtinAssistantsTravel.js').then(m => m.TRAVEL_BUILTIN_ASSISTANTS),
  RealEstate: () => import('./assistant/builtinAssistantsRealEstate.js').then(m => m.REALESTATE_BUILTIN_ASSISTANTS),
  Insurance: () => import('./assistant/builtinAssistantsInsurance.js').then(m => m.INSURANCE_BUILTIN_ASSISTANTS),
  Energy: () => import('./assistant/builtinAssistantsEnergy.js').then(m => m.ENERGY_BUILTIN_ASSISTANTS),
  Catering: () => import('./assistant/builtinAssistantsCatering.js').then(m => m.CATERING_BUILTIN_ASSISTANTS),
  Automotive: () => import('./assistant/builtinAssistantsAutomotive.js').then(m => m.AUTOMOTIVE_BUILTIN_ASSISTANTS),
  Advertising: () => import('./assistant/builtinAssistantsAdvertising.js').then(m => m.ADVERTISING_BUILTIN_ASSISTANTS),
  Agriculture: () => import('./assistant/builtinAssistantsAgriculture.js').then(m => m.AGRICULTURE_BUILTIN_ASSISTANTS),
  Film: () => import('./assistant/builtinAssistantsFilm.js').then(m => m.FILM_BUILTIN_ASSISTANTS),
  Gaming: () => import('./assistant/builtinAssistantsGaming.js').then(m => m.GAMING_BUILTIN_ASSISTANTS),
  Chemical: () => import('./assistant/builtinAssistantsChemical.js').then(m => m.CHEMICAL_BUILTIN_ASSISTANTS),
  Telecom: () => import('./assistant/builtinAssistantsTelecom.js').then(m => m.TELECOM_BUILTIN_ASSISTANTS),
  Beauty: () => import('./assistant/builtinAssistantsBeauty.js').then(m => m.BEAUTY_BUILTIN_ASSISTANTS),
  Maternal: () => import('./assistant/builtinAssistantsMaternal.js').then(m => m.MATERNAL_BUILTIN_ASSISTANTS),
  Sports: () => import('./assistant/builtinAssistantsSports.js').then(m => m.SPORTS_BUILTIN_ASSISTANTS),
  Nonprofit: () => import('./assistant/builtinAssistantsNonprofit.js').then(m => m.NONPROFIT_BUILTIN_ASSISTANTS),
  Fashion: () => import('./assistant/builtinAssistantsFashion.js').then(m => m.FASHION_BUILTIN_ASSISTANTS),
  Pet: () => import('./assistant/builtinAssistantsPet.js').then(m => m.PET_BUILTIN_ASSISTANTS),
  HomeService: () => import('./assistant/builtinAssistantsHomeService.js').then(m => m.HOMESERVICE_BUILTIN_ASSISTANTS),
  Printing: () => import('./assistant/builtinAssistantsPrinting.js').then(m => m.PRINTING_BUILTIN_ASSISTANTS),
  Psychology: () => import('./assistant/builtinAssistantsPsychology.js').then(m => m.PSYCHOLOGY_BUILTIN_ASSISTANTS),
  Wedding: () => import('./assistant/builtinAssistantsWedding.js').then(m => m.WEDDING_BUILTIN_ASSISTANTS),
  Wellness: () => import('./assistant/builtinAssistantsWellness.js').then(m => m.WELLNESS_BUILTIN_ASSISTANTS),
  Aesthetic: () => import('./assistant/builtinAssistantsAesthetic.js').then(m => m.AESTHETIC_BUILTIN_ASSISTANTS),
  Crossborder: () => import('./assistant/builtinAssistantsCrossborder.js').then(m => m.CROSSBORDER_BUILTIN_ASSISTANTS),
  Ip: () => import('./assistant/builtinAssistantsIp.js').then(m => m.IP_BUILTIN_ASSISTANTS),
  Translation: () => import('./assistant/builtinAssistantsTranslation.js').then(m => m.TRANSLATION_BUILTIN_ASSISTANTS),
  Survey: () => import('./assistant/builtinAssistantsSurvey.js').then(m => m.SURVEY_BUILTIN_ASSISTANTS),
  Water: () => import('./assistant/builtinAssistantsWater.js').then(m => m.WATER_BUILTIN_ASSISTANTS),
  Landscape: () => import('./assistant/builtinAssistantsLandscape.js').then(m => m.LANDSCAPE_BUILTIN_ASSISTANTS),
  Recruit: () => import('./assistant/builtinAssistantsRecruit.js').then(m => m.RECRUIT_BUILTIN_ASSISTANTS),
  Elearning: () => import('./assistant/builtinAssistantsElearning.js').then(m => m.ELEARNING_BUILTIN_ASSISTANTS),
  Mcn: () => import('./assistant/builtinAssistantsMcn.js').then(m => m.MCN_BUILTIN_ASSISTANTS),
  Community: () => import('./assistant/builtinAssistantsCommunity.js').then(m => m.COMMUNITY_BUILTIN_ASSISTANTS),
  Funeral: () => import('./assistant/builtinAssistantsFuneral.js').then(m => m.FUNERAL_BUILTIN_ASSISTANTS),
  Security: () => import('./assistant/builtinAssistantsSecurity.js').then(m => m.SECURITY_BUILTIN_ASSISTANTS),
  Jewelry: () => import('./assistant/builtinAssistantsJewelry.js').then(m => m.JEWELRY_BUILTIN_ASSISTANTS),
  HomeDecor: () => import('./assistant/builtinAssistantsHomeDecor.js').then(m => m.HOMEDECOR_BUILTIN_ASSISTANTS),
  Beverage: () => import('./assistant/builtinAssistantsBeverage.js').then(m => m.BEVERAGE_BUILTIN_ASSISTANTS),
  Salon: () => import('./assistant/builtinAssistantsSalon.js').then(m => m.SALON_BUILTIN_ASSISTANTS),
  Veterinary: () => import('./assistant/builtinAssistantsVeterinary.js').then(m => m.VETERINARY_BUILTIN_ASSISTANTS),
  CbExpress: () => import('./assistant/builtinAssistantsCbExpress.js').then(m => m.CBEXPRESS_BUILTIN_ASSISTANTS),
  Cultural: () => import('./assistant/builtinAssistantsCultural.js').then(m => m.CULTURAL_BUILTIN_ASSISTANTS),
  Matchmaking: () => import('./assistant/builtinAssistantsMatchmaking.js').then(m => m.MATCHMAKING_BUILTIN_ASSISTANTS),
  Confinement: () => import('./assistant/builtinAssistantsConfinement.js').then(m => m.CONFINEMENT_BUILTIN_ASSISTANTS),
  Bakery: () => import('./assistant/builtinAssistantsBakery.js').then(m => m.BAKERY_BUILTIN_ASSISTANTS),
  Floral: () => import('./assistant/builtinAssistantsFloral.js').then(m => m.FLORAL_BUILTIN_ASSISTANTS),
  Photography: () => import('./assistant/builtinAssistantsPhotography.js').then(m => m.PHOTOGRAPHY_BUILTIN_ASSISTANTS),
  DrivingSchool: () => import('./assistant/builtinAssistantsDrivingSchool.js').then(m => m.DRIVINGSCHOOL_BUILTIN_ASSISTANTS),
  StudyAbroad: () => import('./assistant/builtinAssistantsStudyAbroad.js').then(m => m.STUDYABROAD_BUILTIN_ASSISTANTS),
  ExamPrep: () => import('./assistant/builtinAssistantsExamPrep.js').then(m => m.EXAMPREP_BUILTIN_ASSISTANTS),
  Franchise: () => import('./assistant/builtinAssistantsFranchise.js').then(m => m.FRANCHISE_BUILTIN_ASSISTANTS),
  Ticketing: () => import('./assistant/builtinAssistantsTicketing.js').then(m => m.TICKETING_BUILTIN_ASSISTANTS),
  Webnovel: () => import('./assistant/builtinAssistantsWebnovel.js').then(m => m.WEBNOVEL_BUILTIN_ASSISTANTS),
  Podcast: () => import('./assistant/builtinAssistantsPodcast.js').then(m => m.PODCAST_BUILTIN_ASSISTANTS),
  ShortDrama: () => import('./assistant/builtinAssistantsShortDrama.js').then(m => m.SHORTDRAMA_BUILTIN_ASSISTANTS),
  Illustration: () => import('./assistant/builtinAssistantsIllustration.js').then(m => m.ILLUSTRATION_BUILTIN_ASSISTANTS),
  Music: () => import('./assistant/builtinAssistantsMusic.js').then(m => m.MUSIC_BUILTIN_ASSISTANTS),
  Eldercare: () => import('./assistant/builtinAssistantsEldercare.js').then(m => m.ELDERCARE_BUILTIN_ASSISTANTS),
  Parenting: () => import('./assistant/builtinAssistantsParenting.js').then(m => m.PARENTING_BUILTIN_ASSISTANTS),
  Antique: () => import('./assistant/builtinAssistantsAntique.js').then(m => m.ANTIQUE_BUILTIN_ASSISTANTS),
  Pharmacy: () => import('./assistant/builtinAssistantsPharmacy.js').then(m => m.PHARMACY_BUILTIN_ASSISTANTS),
  Optical: () => import('./assistant/builtinAssistantsOptical.js').then(m => m.OPTICAL_BUILTIN_ASSISTANTS),
  ApplianceRepair: () => import('./assistant/builtinAssistantsApplianceRepair.js').then(m => m.APPLIANCEREPAIR_BUILTIN_ASSISTANTS),
  GreenPlant: () => import('./assistant/builtinAssistantsGreenPlant.js').then(m => m.GREENPLANT_BUILTIN_ASSISTANTS),
  Moving: () => import('./assistant/builtinAssistantsMoving.js').then(m => m.MOVING_BUILTIN_ASSISTANTS),
  Recycling: () => import('./assistant/builtinAssistantsRecycling.js').then(m => m.RECYCLING_BUILTIN_ASSISTANTS),
  Tea: () => import('./assistant/builtinAssistantsTea.js').then(m => m.TEA_BUILTIN_ASSISTANTS),
  Liquor: () => import('./assistant/builtinAssistantsLiquor.js').then(m => m.LIQUOR_BUILTIN_ASSISTANTS),
  Figurine: () => import('./assistant/builtinAssistantsFigurine.js').then(m => m.FIGURINE_BUILTIN_ASSISTANTS),
  Hanfu: () => import('./assistant/builtinAssistantsHanfu.js').then(m => m.HANFU_BUILTIN_ASSISTANTS),
  ScriptMurder: () => import('./assistant/builtinAssistantsScriptMurder.js').then(m => m.SCRIPTMURDER_BUILTIN_ASSISTANTS),
  EscapeRoom: () => import('./assistant/builtinAssistantsEscapeRoom.js').then(m => m.ESCAPEROOM_BUILTIN_ASSISTANTS),
  Pottery: () => import('./assistant/builtinAssistantsPottery.js').then(m => m.POTTERY_BUILTIN_ASSISTANTS),
  Calligraphy: () => import('./assistant/builtinAssistantsCalligraphy.js').then(m => m.CALLIGRAPHY_BUILTIN_ASSISTANTS),
  InstrumentEdu: () => import('./assistant/builtinAssistantsInstrumentEdu.js').then(m => m.INSTRUMENTEDU_BUILTIN_ASSISTANTS),
  Aquatic: () => import('./assistant/builtinAssistantsAquatic.js').then(m => m.AQUATIC_BUILTIN_ASSISTANTS),
  BallSport: () => import('./assistant/builtinAssistantsBallSport.js').then(m => m.BALLSPORT_BUILTIN_ASSISTANTS),
  CarWash: () => import('./assistant/builtinAssistantsCarWash.js').then(m => m.CARWASH_BUILTIN_ASSISTANTS),
  Dentistry: () => import('./assistant/builtinAssistantsDentistry.js').then(m => m.DENTISTRY_BUILTIN_ASSISTANTS),
  TcmClinic: () => import('./assistant/builtinAssistantsTcmClinic.js').then(m => m.TCMCLINIC_BUILTIN_ASSISTANTS),
  Companion: () => import('./assistant/builtinAssistantsCompanion.js').then(m => m.COMPANION_BUILTIN_ASSISTANTS),
  Organizing: () => import('./assistant/builtinAssistantsOrganizing.js').then(m => m.ORGANIZING_BUILTIN_ASSISTANTS),
  TeaArt: () => import('./assistant/builtinAssistantsTeaArt.js').then(m => m.TEAART_BUILTIN_ASSISTANTS),
  Bonsai: () => import('./assistant/builtinAssistantsBonsai.js').then(m => m.BONSAI_BUILTIN_ASSISTANTS),
  Jade: () => import('./assistant/builtinAssistantsJade.js').then(m => m.JADE_BUILTIN_ASSISTANTS),
  Coin: () => import('./assistant/builtinAssistantsCoin.js').then(m => m.COIN_BUILTIN_ASSISTANTS),
  Redwood: () => import('./assistant/builtinAssistantsRedwood.js').then(m => m.REDWOOD_BUILTIN_ASSISTANTS),
  Incense: () => import('./assistant/builtinAssistantsIncense.js').then(m => m.INCENSE_BUILTIN_ASSISTANTS),
  Tutoring: () => import('./assistant/builtinAssistantsTutoring.js').then(m => m.TUTORING_BUILTIN_ASSISTANTS),
  Seal: () => import('./assistant/builtinAssistantsSeal.js').then(m => m.SEAL_BUILTIN_ASSISTANTS),
  Koi: () => import('./assistant/builtinAssistantsKoi.js').then(m => m.KOI_BUILTIN_ASSISTANTS),
  Mounting: () => import('./assistant/builtinAssistantsMounting.js').then(m => m.MOUNTING_BUILTIN_ASSISTANTS),
  FuneralPet: () => import('./assistant/builtinAssistantsFuneralPet.js').then(m => m.FUNERALPET_BUILTIN_ASSISTANTS),
  LocalFood: () => import('./assistant/builtinAssistantsLocalFood.js').then(m => m.LOCALFOOD_BUILTIN_ASSISTANTS),
  CarRental: () => import('./assistant/builtinAssistantsCarRental.js').then(m => m.CARRENTAL_BUILTIN_ASSISTANTS),
  Climbing: () => import('./assistant/builtinAssistantsClimbing.js').then(m => m.CLIMBING_BUILTIN_ASSISTANTS),
  GovDoc: () => import('./assistant/builtinAssistantsGovDoc.js').then(m => m.GOVDOC_BUILTIN_ASSISTANTS),
  GovParty: () => import('./assistant/builtinAssistantsGovParty.js').then(m => m.GOVPARTY_BUILTIN_ASSISTANTS),
  GovPolicy: () => import('./assistant/builtinAssistantsGovPolicy.js').then(m => m.GOVPOLICY_BUILTIN_ASSISTANTS),
  GovService: () => import('./assistant/builtinAssistantsGovService.js').then(m => m.GOVSERVICE_BUILTIN_ASSISTANTS),
  GovPetition: () => import('./assistant/builtinAssistantsGovPetition.js').then(m => m.GOVPETITION_BUILTIN_ASSISTANTS),
  GovSupervise: () => import('./assistant/builtinAssistantsGovSupervise.js').then(m => m.GOVSUPERVISE_BUILTIN_ASSISTANTS),
  GovEmergency: () => import('./assistant/builtinAssistantsGovEmergency.js').then(m => m.GOVEMERGENCY_BUILTIN_ASSISTANTS),
  GovPersonnel: () => import('./assistant/builtinAssistantsGovPersonnel.js').then(m => m.GOVPERSONNEL_BUILTIN_ASSISTANTS),
  GovMeeting: () => import('./assistant/builtinAssistantsGovMeeting.js').then(m => m.GOVMEETING_BUILTIN_ASSISTANTS),
  GovEconomy: () => import('./assistant/builtinAssistantsGovEconomy.js').then(m => m.GOVECONOMY_BUILTIN_ASSISTANTS),
  GovGrassroots: () => import('./assistant/builtinAssistantsGovGrassroots.js').then(m => m.GOVGRASSROOTS_BUILTIN_ASSISTANTS),
  GovPeople: () => import('./assistant/builtinAssistantsGovPeople.js').then(m => m.GOVPEOPLE_BUILTIN_ASSISTANTS),
  MilDoc: () => import('./assistant/builtinAssistantsMilDoc.js').then(m => m.MILDOC_BUILTIN_ASSISTANTS),
  MilPolitical: () => import('./assistant/builtinAssistantsMilPolitical.js').then(m => m.MILPOLITICAL_BUILTIN_ASSISTANTS),
  MilTraining: () => import('./assistant/builtinAssistantsMilTraining.js').then(m => m.MILTRAINING_BUILTIN_ASSISTANTS),
  MilLogistics: () => import('./assistant/builtinAssistantsMilLogistics.js').then(m => m.MILLOGISTICS_BUILTIN_ASSISTANTS),
  MilEquip: () => import('./assistant/builtinAssistantsMilEquip.js').then(m => m.MILEQUIP_BUILTIN_ASSISTANTS),
  MilSafety: () => import('./assistant/builtinAssistantsMilSafety.js').then(m => m.MILSAFETY_BUILTIN_ASSISTANTS),
  MilParty: () => import('./assistant/builtinAssistantsMilParty.js').then(m => m.MILPARTY_BUILTIN_ASSISTANTS),
  MilPersonnel: () => import('./assistant/builtinAssistantsMilPersonnel.js').then(m => m.MILPERSONNEL_BUILTIN_ASSISTANTS),
  DefMob: () => import('./assistant/builtinAssistantsDefMob.js').then(m => m.DEFMOB_BUILTIN_ASSISTANTS),
  Veteran: () => import('./assistant/builtinAssistantsVeteran.js').then(m => m.VETERAN_BUILTIN_ASSISTANTS),
  Police: () => import('./assistant/builtinAssistantsPolice.js').then(m => m.POLICE_BUILTIN_ASSISTANTS),
  Court: () => import('./assistant/builtinAssistantsCourt.js').then(m => m.COURT_BUILTIN_ASSISTANTS),
  Procurator: () => import('./assistant/builtinAssistantsProcurator.js').then(m => m.PROCURATOR_BUILTIN_ASSISTANTS),
  Justice: () => import('./assistant/builtinAssistantsJustice.js').then(m => m.JUSTICE_BUILTIN_ASSISTANTS),
  EduAdmin: () => import('./assistant/builtinAssistantsEduAdmin.js').then(m => m.EDUADMIN_BUILTIN_ASSISTANTS),
  School: () => import('./assistant/builtinAssistantsSchool.js').then(m => m.SCHOOL_BUILTIN_ASSISTANTS),
  Foreign: () => import('./assistant/builtinAssistantsForeign.js').then(m => m.FOREIGN_BUILTIN_ASSISTANTS),
  Customs: () => import('./assistant/builtinAssistantsCustoms.js').then(m => m.CUSTOMS_BUILTIN_ASSISTANTS),
  DocUtil: () => import('./assistant/builtinAssistantsDocUtil.js').then(m => m.DOCUTIL_BUILTIN_ASSISTANTS),
  AuditExt: () => import('./assistant/builtinAssistantsAuditExt.js').then(m => m.AUDIT_EXT_BUILTIN_ASSISTANTS),
  KbVerifyExt: () => import('./assistant/builtinAssistantsKbVerifyExt.js').then(m => m.KBVERIFY_EXT_BUILTIN_ASSISTANTS),
  Secrecy: () => import('./assistant/builtinAssistantsSecrecy.js').then(m => m.SECRECY_BUILTIN_ASSISTANTS),
  GovReview: () => import('./assistant/builtinAssistantsGovReview.js').then(m => m.GOVREVIEW_BUILTIN_ASSISTANTS),
  GovFinance: () => import('./assistant/builtinAssistantsGovFinance.js').then(m => m.GOVFINANCE_BUILTIN_ASSISTANTS),
  GovTax: () => import('./assistant/builtinAssistantsGovTax.js').then(m => m.GOVTAX_BUILTIN_ASSISTANTS),
  GovHrss: () => import('./assistant/builtinAssistantsGovHrss.js').then(m => m.GOVHRSS_BUILTIN_ASSISTANTS),
  GovCivil: () => import('./assistant/builtinAssistantsGovCivil.js').then(m => m.GOVCIVIL_BUILTIN_ASSISTANTS),
  GovNatRes: () => import('./assistant/builtinAssistantsGovNatRes.js').then(m => m.GOVNATRES_BUILTIN_ASSISTANTS),
  GovHousing: () => import('./assistant/builtinAssistantsGovHousing.js').then(m => m.GOVHOUSING_BUILTIN_ASSISTANTS),
  GovEnviron: () => import('./assistant/builtinAssistantsGovEnviron.js').then(m => m.GOVENVIRON_BUILTIN_ASSISTANTS),
  GovAgriRural: () => import('./assistant/builtinAssistantsGovAgriRural.js').then(m => m.GOVAGRIRURAL_BUILTIN_ASSISTANTS),
  GovCommerce: () => import('./assistant/builtinAssistantsGovCommerce.js').then(m => m.GOVCOMMERCE_BUILTIN_ASSISTANTS),
  GovCulTour: () => import('./assistant/builtinAssistantsGovCulTour.js').then(m => m.GOVCULTOUR_BUILTIN_ASSISTANTS),
  GovHealth: () => import('./assistant/builtinAssistantsGovHealth.js').then(m => m.GOVHEALTH_BUILTIN_ASSISTANTS),
  GovMedicare: () => import('./assistant/builtinAssistantsGovMedicare.js').then(m => m.GOVMEDICARE_BUILTIN_ASSISTANTS),
  GovMarketReg: () => import('./assistant/builtinAssistantsGovMarketReg.js').then(m => m.GOVMARKETREG_BUILTIN_ASSISTANTS),
  GovStats: () => import('./assistant/builtinAssistantsGovStats.js').then(m => m.GOVSTATS_BUILTIN_ASSISTANTS),
  GovDevReform: () => import('./assistant/builtinAssistantsGovDevReform.js').then(m => m.GOVDEVREFORM_BUILTIN_ASSISTANTS),
  GovIndustryIt: () => import('./assistant/builtinAssistantsGovIndustryIt.js').then(m => m.GOVINDUSTRYIT_BUILTIN_ASSISTANTS),
  GovTransport: () => import('./assistant/builtinAssistantsGovTransport.js').then(m => m.GOVTRANSPORT_BUILTIN_ASSISTANTS),
  GovWater: () => import('./assistant/builtinAssistantsGovWater.js').then(m => m.GOVWATER_BUILTIN_ASSISTANTS),
  GovForestry: () => import('./assistant/builtinAssistantsGovForestry.js').then(m => m.GOVFORESTRY_BUILTIN_ASSISTANTS),
  GovUnitedFront: () => import('./assistant/builtinAssistantsGovUnitedFront.js').then(m => m.GOVUNITEDFRONT_BUILTIN_ASSISTANTS),
  GovArchive: () => import('./assistant/builtinAssistantsGovArchive.js').then(m => m.GOVARCHIVE_BUILTIN_ASSISTANTS),
  GovServiceHall: () => import('./assistant/builtinAssistantsGovServiceHall.js').then(m => m.GOVSERVICEHALL_BUILTIN_ASSISTANTS),
  GovHotline: () => import('./assistant/builtinAssistantsGovHotline.js').then(m => m.GOVHOTLINE_BUILTIN_ASSISTANTS),
  GovOrg: () => import('./assistant/builtinAssistantsGovOrg.js').then(m => m.GOVORG_BUILTIN_ASSISTANTS),
  GovPublicity: () => import('./assistant/builtinAssistantsGovPublicity.js').then(m => m.GOVPUBLICITY_BUILTIN_ASSISTANTS),
  GovDiscipline: () => import('./assistant/builtinAssistantsGovDiscipline.js').then(m => m.GOVDISCIPLINE_BUILTIN_ASSISTANTS),
  GovStaffing: () => import('./assistant/builtinAssistantsGovStaffing.js').then(m => m.GOVSTAFFING_BUILTIN_ASSISTANTS),
  GovUrbanMgmt: () => import('./assistant/builtinAssistantsGovUrbanMgmt.js').then(m => m.GOVURBANMGMT_BUILTIN_ASSISTANTS),
  GovAudit: () => import('./assistant/builtinAssistantsGovAudit.js').then(m => m.GOVAUDIT_BUILTIN_ASSISTANTS),
  Prison: () => import('./assistant/builtinAssistantsPrison.js').then(m => m.PRISON_BUILTIN_ASSISTANTS),
  Arbitration: () => import('./assistant/builtinAssistantsArbitration.js').then(m => m.ARBITRATION_BUILTIN_ASSISTANTS),
  Forensic: () => import('./assistant/builtinAssistantsForensic.js').then(m => m.FORENSIC_BUILTIN_ASSISTANTS),
  Notary: () => import('./assistant/builtinAssistantsNotary.js').then(m => m.NOTARY_BUILTIN_ASSISTANTS),
  University: () => import('./assistant/builtinAssistantsUniversity.js').then(m => m.UNIVERSITY_BUILTIN_ASSISTANTS),
  Library: () => import('./assistant/builtinAssistantsLibrary.js').then(m => m.LIBRARY_BUILTIN_ASSISTANTS),
  Preschool: () => import('./assistant/builtinAssistantsPreschool.js').then(m => m.PRESCHOOL_BUILTIN_ASSISTANTS),
  SpecialEdu: () => import('./assistant/builtinAssistantsSpecialEdu.js').then(m => m.SPECIALEDU_BUILTIN_ASSISTANTS),
  VocCollege: () => import('./assistant/builtinAssistantsVocCollege.js').then(m => m.VOCCOLLEGE_BUILTIN_ASSISTANTS),
  ExamBoard: () => import('./assistant/builtinAssistantsExamBoard.js').then(m => m.EXAMBOARD_BUILTIN_ASSISTANTS),
  Property: () => import('./assistant/builtinAssistantsProperty.js').then(m => m.PROPERTY_BUILTIN_ASSISTANTS),
  Construction: () => import('./assistant/builtinAssistantsConstruction.js').then(m => m.CONSTRUCTION_BUILTIN_ASSISTANTS),
  Securities: () => import('./assistant/builtinAssistantsSecurities.js').then(m => m.SECURITIES_BUILTIN_ASSISTANTS),
  Accounting: () => import('./assistant/builtinAssistantsAccounting.js').then(m => m.ACCOUNTING_BUILTIN_ASSISTANTS),
  Consulting: () => import('./assistant/builtinAssistantsConsulting.js').then(m => m.CONSULTING_BUILTIN_ASSISTANTS),
  Exhibition: () => import('./assistant/builtinAssistantsExhibition.js').then(m => m.EXHIBITION_BUILTIN_ASSISTANTS),
  Aviation: () => import('./assistant/builtinAssistantsAviation.js').then(m => m.AVIATION_BUILTIN_ASSISTANTS),
  Railway: () => import('./assistant/builtinAssistantsRailway.js').then(m => m.RAILWAY_BUILTIN_ASSISTANTS),
  Steel: () => import('./assistant/builtinAssistantsSteel.js').then(m => m.STEEL_BUILTIN_ASSISTANTS),
  Textile: () => import('./assistant/builtinAssistantsTextile.js').then(m => m.TEXTILE_BUILTIN_ASSISTANTS),
  FoodProcess: () => import('./assistant/builtinAssistantsFoodProcess.js').then(m => m.FOODPROCESS_BUILTIN_ASSISTANTS),
  Fresh: () => import('./assistant/builtinAssistantsFresh.js').then(m => m.FRESH_BUILTIN_ASSISTANTS),
  Furniture: () => import('./assistant/builtinAssistantsFurniture.js').then(m => m.FURNITURE_BUILTIN_ASSISTANTS),
  BuildMaterial: () => import('./assistant/builtinAssistantsBuildMaterial.js').then(m => m.BUILDMATERIAL_BUILTIN_ASSISTANTS),
  MedDevice: () => import('./assistant/builtinAssistantsMedDevice.js').then(m => m.MEDDEVICE_BUILTIN_ASSISTANTS),
  MedBeauty: () => import('./assistant/builtinAssistantsMedBeauty.js').then(m => m.MEDBEAUTY_BUILTIN_ASSISTANTS),
  Rehabilitation: () => import('./assistant/builtinAssistantsRehabilitation.js').then(m => m.REHABILITATION_BUILTIN_ASSISTANTS),
  Fitness: () => import('./assistant/builtinAssistantsFitness.js').then(m => m.FITNESS_BUILTIN_ASSISTANTS),
  ArtTraining: () => import('./assistant/builtinAssistantsArtTraining.js').then(m => m.ARTTRAINING_BUILTIN_ASSISTANTS),
  Hotel: () => import('./assistant/builtinAssistantsHotel.js').then(m => m.HOTEL_BUILTIN_ASSISTANTS),
  Livestock: () => import('./assistant/builtinAssistantsLivestock.js').then(m => m.LIVESTOCK_BUILTIN_ASSISTANTS),
  Cdc: () => import('./assistant/builtinAssistantsCdc.js').then(m => m.CDC_BUILTIN_ASSISTANTS),
  Museum: () => import('./assistant/builtinAssistantsMuseum.js').then(m => m.MUSEUM_BUILTIN_ASSISTANTS),
  CostEngineer: () => import('./assistant/builtinAssistantsCostEngineer.js').then(m => m.COSTENGINEER_BUILTIN_ASSISTANTS),
  SafetyProd: () => import('./assistant/builtinAssistantsSafetyProd.js').then(m => m.SAFETYPROD_BUILTIN_ASSISTANTS),
  IndustrialPark: () => import('./assistant/builtinAssistantsIndustrialPark.js').then(m => m.INDUSTRIALPARK_BUILTIN_ASSISTANTS),
  TradeAssoc: () => import('./assistant/builtinAssistantsTradeAssoc.js').then(m => m.TRADEASSOC_BUILTIN_ASSISTANTS),
  AssetAppraisal: () => import('./assistant/builtinAssistantsAssetAppraisal.js').then(m => m.ASSETAPPRAISAL_BUILTIN_ASSISTANTS),
  TaxAgent: () => import('./assistant/builtinAssistantsTaxAgent.js').then(m => m.TAXAGENT_BUILTIN_ASSISTANTS),
  HrService: () => import('./assistant/builtinAssistantsHrService.js').then(m => m.HRSERVICE_BUILTIN_ASSISTANTS),
  Auction: () => import('./assistant/builtinAssistantsAuction.js').then(m => m.AUCTION_BUILTIN_ASSISTANTS),
  Union: () => import('./assistant/builtinAssistantsUnion.js').then(m => m.UNION_BUILTIN_ASSISTANTS),
  CyLeague: () => import('./assistant/builtinAssistantsCyLeague.js').then(m => m.CYLEAGUE_BUILTIN_ASSISTANTS),
  WomensFed: () => import('./assistant/builtinAssistantsWomensFed.js').then(m => m.WOMENSFED_BUILTIN_ASSISTANTS),
  DisabledFed: () => import('./assistant/builtinAssistantsDisabledFed.js').then(m => m.DISABLEDFED_BUILTIN_ASSISTANTS),
  PartySchool: () => import('./assistant/builtinAssistantsPartySchool.js').then(m => m.PARTYSCHOOL_BUILTIN_ASSISTANTS),
  AcademicExt: () => import('./assistant/builtinAssistantsAcademicExt.js').then(m => m.ACADEMIC_EXT_BUILTIN_ASSISTANTS),
  AdvertisingExt: () => import('./assistant/builtinAssistantsAdvertisingExt.js').then(m => m.ADVERTISING_EXT_BUILTIN_ASSISTANTS),
  AgricultureExt: () => import('./assistant/builtinAssistantsAgricultureExt.js').then(m => m.AGRICULTURE_EXT_BUILTIN_ASSISTANTS),
  ApplianceRepairExt: () => import('./assistant/builtinAssistantsApplianceRepairExt.js').then(m => m.APPLIANCEREPAIR_EXT_BUILTIN_ASSISTANTS),
  AquaticExt: () => import('./assistant/builtinAssistantsAquaticExt.js').then(m => m.AQUATIC_EXT_BUILTIN_ASSISTANTS),
  AutomotiveExt: () => import('./assistant/builtinAssistantsAutomotiveExt.js').then(m => m.AUTOMOTIVE_EXT_BUILTIN_ASSISTANTS),
  BakeryExt: () => import('./assistant/builtinAssistantsBakeryExt.js').then(m => m.BAKERY_EXT_BUILTIN_ASSISTANTS),
  BankingExt: () => import('./assistant/builtinAssistantsBankingExt.js').then(m => m.BANKING_EXT_BUILTIN_ASSISTANTS),
  BeautyExt: () => import('./assistant/builtinAssistantsBeautyExt.js').then(m => m.BEAUTY_EXT_BUILTIN_ASSISTANTS),
  BeverageExt: () => import('./assistant/builtinAssistantsBeverageExt.js').then(m => m.BEVERAGE_EXT_BUILTIN_ASSISTANTS),
  BiddingExt: () => import('./assistant/builtinAssistantsBiddingExt.js').then(m => m.BIDDING_EXT_BUILTIN_ASSISTANTS),
  CarRentalExt: () => import('./assistant/builtinAssistantsCarRentalExt.js').then(m => m.CARRENTAL_EXT_BUILTIN_ASSISTANTS),
  CarWashExt: () => import('./assistant/builtinAssistantsCarWashExt.js').then(m => m.CARWASH_EXT_BUILTIN_ASSISTANTS),
  CateringExt: () => import('./assistant/builtinAssistantsCateringExt.js').then(m => m.CATERING_EXT_BUILTIN_ASSISTANTS),
  CbExpressExt: () => import('./assistant/builtinAssistantsCbExpressExt.js').then(m => m.CBEXPRESS_EXT_BUILTIN_ASSISTANTS),
  ChemicalExt: () => import('./assistant/builtinAssistantsChemicalExt.js').then(m => m.CHEMICAL_EXT_BUILTIN_ASSISTANTS),
  CommunityExt: () => import('./assistant/builtinAssistantsCommunityExt.js').then(m => m.COMMUNITY_EXT_BUILTIN_ASSISTANTS),
  CourtExt: () => import('./assistant/builtinAssistantsCourtExt.js').then(m => m.COURT_EXT_BUILTIN_ASSISTANTS),
  CrossborderExt: () => import('./assistant/builtinAssistantsCrossborderExt.js').then(m => m.CROSSBORDER_EXT_BUILTIN_ASSISTANTS),
  CulturalExt: () => import('./assistant/builtinAssistantsCulturalExt.js').then(m => m.CULTURAL_EXT_BUILTIN_ASSISTANTS),
  DataExt: () => import('./assistant/builtinAssistantsDataExt.js').then(m => m.DATA_EXT_BUILTIN_ASSISTANTS),
  DefMobExt: () => import('./assistant/builtinAssistantsDefMobExt.js').then(m => m.DEFMOB_EXT_BUILTIN_ASSISTANTS),
  DentistryExt: () => import('./assistant/builtinAssistantsDentistryExt.js').then(m => m.DENTISTRY_EXT_BUILTIN_ASSISTANTS),
  DrivingSchoolExt: () => import('./assistant/builtinAssistantsDrivingSchoolExt.js').then(m => m.DRIVINGSCHOOL_EXT_BUILTIN_ASSISTANTS),
  EcommerceExt: () => import('./assistant/builtinAssistantsEcommerceExt.js').then(m => m.ECOMMERCE_EXT_BUILTIN_ASSISTANTS),
  EducationExt: () => import('./assistant/builtinAssistantsEducationExt.js').then(m => m.EDUCATION_EXT_BUILTIN_ASSISTANTS),
  EldercareExt: () => import('./assistant/builtinAssistantsEldercareExt.js').then(m => m.ELDERCARE_EXT_BUILTIN_ASSISTANTS),
  ElearningExt: () => import('./assistant/builtinAssistantsElearningExt.js').then(m => m.ELEARNING_EXT_BUILTIN_ASSISTANTS),
  EnergyExt: () => import('./assistant/builtinAssistantsEnergyExt.js').then(m => m.ENERGY_EXT_BUILTIN_ASSISTANTS),
  ExamPrepExt: () => import('./assistant/builtinAssistantsExamPrepExt.js').then(m => m.EXAMPREP_EXT_BUILTIN_ASSISTANTS),
  FashionExt: () => import('./assistant/builtinAssistantsFashionExt.js').then(m => m.FASHION_EXT_BUILTIN_ASSISTANTS),
  FilmExt: () => import('./assistant/builtinAssistantsFilmExt.js').then(m => m.FILM_EXT_BUILTIN_ASSISTANTS),
  FinanceExt: () => import('./assistant/builtinAssistantsFinanceExt.js').then(m => m.FINANCE_EXT_BUILTIN_ASSISTANTS),
  FloralExt: () => import('./assistant/builtinAssistantsFloralExt.js').then(m => m.FLORAL_EXT_BUILTIN_ASSISTANTS),
  FranchiseExt: () => import('./assistant/builtinAssistantsFranchiseExt.js').then(m => m.FRANCHISE_EXT_BUILTIN_ASSISTANTS),
  FuneralExt: () => import('./assistant/builtinAssistantsFuneralExt.js').then(m => m.FUNERAL_EXT_BUILTIN_ASSISTANTS),
  GovExt: () => import('./assistant/builtinAssistantsGovExt.js').then(m => m.GOV_EXT_BUILTIN_ASSISTANTS),
  GovDocExt: () => import('./assistant/builtinAssistantsGovDocExt.js').then(m => m.GOVDOC_EXT_BUILTIN_ASSISTANTS),
  GovEconomyExt: () => import('./assistant/builtinAssistantsGovEconomyExt.js').then(m => m.GOVECONOMY_EXT_BUILTIN_ASSISTANTS),
  GovEmergencyExt: () => import('./assistant/builtinAssistantsGovEmergencyExt.js').then(m => m.GOVEMERGENCY_EXT_BUILTIN_ASSISTANTS),
  GovGrassrootsExt: () => import('./assistant/builtinAssistantsGovGrassrootsExt.js').then(m => m.GOVGRASSROOTS_EXT_BUILTIN_ASSISTANTS),
  GovMeetingExt: () => import('./assistant/builtinAssistantsGovMeetingExt.js').then(m => m.GOVMEETING_EXT_BUILTIN_ASSISTANTS),
  GovPartyExt: () => import('./assistant/builtinAssistantsGovPartyExt.js').then(m => m.GOVPARTY_EXT_BUILTIN_ASSISTANTS),
  GovPeopleExt: () => import('./assistant/builtinAssistantsGovPeopleExt.js').then(m => m.GOVPEOPLE_EXT_BUILTIN_ASSISTANTS),
  GovPersonnelExt: () => import('./assistant/builtinAssistantsGovPersonnelExt.js').then(m => m.GOVPERSONNEL_EXT_BUILTIN_ASSISTANTS),
  GovPetitionExt: () => import('./assistant/builtinAssistantsGovPetitionExt.js').then(m => m.GOVPETITION_EXT_BUILTIN_ASSISTANTS),
  GovPolicyExt: () => import('./assistant/builtinAssistantsGovPolicyExt.js').then(m => m.GOVPOLICY_EXT_BUILTIN_ASSISTANTS),
  GovServiceExt: () => import('./assistant/builtinAssistantsGovServiceExt.js').then(m => m.GOVSERVICE_EXT_BUILTIN_ASSISTANTS),
  GovSuperviseExt: () => import('./assistant/builtinAssistantsGovSuperviseExt.js').then(m => m.GOVSUPERVISE_EXT_BUILTIN_ASSISTANTS),
  GreenPlantExt: () => import('./assistant/builtinAssistantsGreenPlantExt.js').then(m => m.GREENPLANT_EXT_BUILTIN_ASSISTANTS),
  HomeDecorExt: () => import('./assistant/builtinAssistantsHomeDecorExt.js').then(m => m.HOMEDECOR_EXT_BUILTIN_ASSISTANTS),
  HomeServiceExt: () => import('./assistant/builtinAssistantsHomeServiceExt.js').then(m => m.HOMESERVICE_EXT_BUILTIN_ASSISTANTS),
  HrExt: () => import('./assistant/builtinAssistantsHrExt.js').then(m => m.HR_EXT_BUILTIN_ASSISTANTS),
  IllustrationExt: () => import('./assistant/builtinAssistantsIllustrationExt.js').then(m => m.ILLUSTRATION_EXT_BUILTIN_ASSISTANTS),
  InstrumentEduExt: () => import('./assistant/builtinAssistantsInstrumentEduExt.js').then(m => m.INSTRUMENTEDU_EXT_BUILTIN_ASSISTANTS),
  InsuranceExt: () => import('./assistant/builtinAssistantsInsuranceExt.js').then(m => m.INSURANCE_EXT_BUILTIN_ASSISTANTS),
  IpExt: () => import('./assistant/builtinAssistantsIpExt.js').then(m => m.IP_EXT_BUILTIN_ASSISTANTS),
  JewelryExt: () => import('./assistant/builtinAssistantsJewelryExt.js').then(m => m.JEWELRY_EXT_BUILTIN_ASSISTANTS),
  JudicialExt: () => import('./assistant/builtinAssistantsJudicialExt.js').then(m => m.JUDICIAL_EXT_BUILTIN_ASSISTANTS),
  LandscapeExt: () => import('./assistant/builtinAssistantsLandscapeExt.js').then(m => m.LANDSCAPE_EXT_BUILTIN_ASSISTANTS),
  LegalExt: () => import('./assistant/builtinAssistantsLegalExt.js').then(m => m.LEGAL_EXT_BUILTIN_ASSISTANTS),
  LiquorExt: () => import('./assistant/builtinAssistantsLiquorExt.js').then(m => m.LIQUOR_EXT_BUILTIN_ASSISTANTS),
  LocalFoodExt: () => import('./assistant/builtinAssistantsLocalFoodExt.js').then(m => m.LOCALFOOD_EXT_BUILTIN_ASSISTANTS),
  LogisticsExt: () => import('./assistant/builtinAssistantsLogisticsExt.js').then(m => m.LOGISTICS_EXT_BUILTIN_ASSISTANTS),
  ManufacturingExt: () => import('./assistant/builtinAssistantsManufacturingExt.js').then(m => m.MANUFACTURING_EXT_BUILTIN_ASSISTANTS),
  MarketingExt: () => import('./assistant/builtinAssistantsMarketingExt.js').then(m => m.MARKETING_EXT_BUILTIN_ASSISTANTS),
  MaternalExt: () => import('./assistant/builtinAssistantsMaternalExt.js').then(m => m.MATERNAL_EXT_BUILTIN_ASSISTANTS),
  McnExt: () => import('./assistant/builtinAssistantsMcnExt.js').then(m => m.MCN_EXT_BUILTIN_ASSISTANTS),
  MediaExt: () => import('./assistant/builtinAssistantsMediaExt.js').then(m => m.MEDIA_EXT_BUILTIN_ASSISTANTS),
  MedicalExt: () => import('./assistant/builtinAssistantsMedicalExt.js').then(m => m.MEDICAL_EXT_BUILTIN_ASSISTANTS),
  MilDocExt: () => import('./assistant/builtinAssistantsMilDocExt.js').then(m => m.MILDOC_EXT_BUILTIN_ASSISTANTS),
  MilEquipExt: () => import('./assistant/builtinAssistantsMilEquipExt.js').then(m => m.MILEQUIP_EXT_BUILTIN_ASSISTANTS),
  MilLogisticsExt: () => import('./assistant/builtinAssistantsMilLogisticsExt.js').then(m => m.MILLOGISTICS_EXT_BUILTIN_ASSISTANTS),
  MilPartyExt: () => import('./assistant/builtinAssistantsMilPartyExt.js').then(m => m.MILPARTY_EXT_BUILTIN_ASSISTANTS),
  MilPersonnelExt: () => import('./assistant/builtinAssistantsMilPersonnelExt.js').then(m => m.MILPERSONNEL_EXT_BUILTIN_ASSISTANTS),
  MilPoliticalExt: () => import('./assistant/builtinAssistantsMilPoliticalExt.js').then(m => m.MILPOLITICAL_EXT_BUILTIN_ASSISTANTS),
  MilSafetyExt: () => import('./assistant/builtinAssistantsMilSafetyExt.js').then(m => m.MILSAFETY_EXT_BUILTIN_ASSISTANTS),
  MilTrainingExt: () => import('./assistant/builtinAssistantsMilTrainingExt.js').then(m => m.MILTRAINING_EXT_BUILTIN_ASSISTANTS),
  MovingExt: () => import('./assistant/builtinAssistantsMovingExt.js').then(m => m.MOVING_EXT_BUILTIN_ASSISTANTS),
  MusicExt: () => import('./assistant/builtinAssistantsMusicExt.js').then(m => m.MUSIC_EXT_BUILTIN_ASSISTANTS),
  NonprofitExt: () => import('./assistant/builtinAssistantsNonprofitExt.js').then(m => m.NONPROFIT_EXT_BUILTIN_ASSISTANTS),
  OpticalExt: () => import('./assistant/builtinAssistantsOpticalExt.js').then(m => m.OPTICAL_EXT_BUILTIN_ASSISTANTS),
  OrganizingExt: () => import('./assistant/builtinAssistantsOrganizingExt.js').then(m => m.ORGANIZING_EXT_BUILTIN_ASSISTANTS),
  ParentingExt: () => import('./assistant/builtinAssistantsParentingExt.js').then(m => m.PARENTING_EXT_BUILTIN_ASSISTANTS),
  PersonalExt: () => import('./assistant/builtinAssistantsPersonalExt.js').then(m => m.PERSONAL_EXT_BUILTIN_ASSISTANTS),
  PetExt: () => import('./assistant/builtinAssistantsPetExt.js').then(m => m.PET_EXT_BUILTIN_ASSISTANTS),
  PharmacyExt: () => import('./assistant/builtinAssistantsPharmacyExt.js').then(m => m.PHARMACY_EXT_BUILTIN_ASSISTANTS),
  PhotographyExt: () => import('./assistant/builtinAssistantsPhotographyExt.js').then(m => m.PHOTOGRAPHY_EXT_BUILTIN_ASSISTANTS),
  PodcastExt: () => import('./assistant/builtinAssistantsPodcastExt.js').then(m => m.PODCAST_EXT_BUILTIN_ASSISTANTS),
  PoliceExt: () => import('./assistant/builtinAssistantsPoliceExt.js').then(m => m.POLICE_EXT_BUILTIN_ASSISTANTS),
  PrintingExt: () => import('./assistant/builtinAssistantsPrintingExt.js').then(m => m.PRINTING_EXT_BUILTIN_ASSISTANTS),
  PsychologyExt: () => import('./assistant/builtinAssistantsPsychologyExt.js').then(m => m.PSYCHOLOGY_EXT_BUILTIN_ASSISTANTS),
  PublishingExt: () => import('./assistant/builtinAssistantsPublishingExt.js').then(m => m.PUBLISHING_EXT_BUILTIN_ASSISTANTS),
  RealEstateExt: () => import('./assistant/builtinAssistantsRealEstateExt.js').then(m => m.REALESTATE_EXT_BUILTIN_ASSISTANTS),
  RecruitExt: () => import('./assistant/builtinAssistantsRecruitExt.js').then(m => m.RECRUIT_EXT_BUILTIN_ASSISTANTS),
  RecyclingExt: () => import('./assistant/builtinAssistantsRecyclingExt.js').then(m => m.RECYCLING_EXT_BUILTIN_ASSISTANTS),
  SalonExt: () => import('./assistant/builtinAssistantsSalonExt.js').then(m => m.SALON_EXT_BUILTIN_ASSISTANTS),
  SecrecyExt: () => import('./assistant/builtinAssistantsSecrecyExt.js').then(m => m.SECRECY_EXT_BUILTIN_ASSISTANTS),
  SecurityExt: () => import('./assistant/builtinAssistantsSecurityExt.js').then(m => m.SECURITY_EXT_BUILTIN_ASSISTANTS),
  ServiceExt: () => import('./assistant/builtinAssistantsServiceExt.js').then(m => m.SERVICE_EXT_BUILTIN_ASSISTANTS),
  ShortDramaExt: () => import('./assistant/builtinAssistantsShortDramaExt.js').then(m => m.SHORTDRAMA_EXT_BUILTIN_ASSISTANTS),
  SportsExt: () => import('./assistant/builtinAssistantsSportsExt.js').then(m => m.SPORTS_EXT_BUILTIN_ASSISTANTS),
  StudyAbroadExt: () => import('./assistant/builtinAssistantsStudyAbroadExt.js').then(m => m.STUDYABROAD_EXT_BUILTIN_ASSISTANTS),
  SurveyExt: () => import('./assistant/builtinAssistantsSurveyExt.js').then(m => m.SURVEY_EXT_BUILTIN_ASSISTANTS),
  TcmClinicExt: () => import('./assistant/builtinAssistantsTcmClinicExt.js').then(m => m.TCMCLINIC_EXT_BUILTIN_ASSISTANTS),
  TeaExt: () => import('./assistant/builtinAssistantsTeaExt.js').then(m => m.TEA_EXT_BUILTIN_ASSISTANTS),
  TeaArtExt: () => import('./assistant/builtinAssistantsTeaArtExt.js').then(m => m.TEAART_EXT_BUILTIN_ASSISTANTS),
  TechExt: () => import('./assistant/builtinAssistantsTechExt.js').then(m => m.TECH_EXT_BUILTIN_ASSISTANTS),
  TelecomExt: () => import('./assistant/builtinAssistantsTelecomExt.js').then(m => m.TELECOM_EXT_BUILTIN_ASSISTANTS),
  TicketingExt: () => import('./assistant/builtinAssistantsTicketingExt.js').then(m => m.TICKETING_EXT_BUILTIN_ASSISTANTS),
  TradeExt: () => import('./assistant/builtinAssistantsTradeExt.js').then(m => m.TRADE_EXT_BUILTIN_ASSISTANTS),
  TranslationExt: () => import('./assistant/builtinAssistantsTranslationExt.js').then(m => m.TRANSLATION_EXT_BUILTIN_ASSISTANTS),
  TravelExt: () => import('./assistant/builtinAssistantsTravelExt.js').then(m => m.TRAVEL_EXT_BUILTIN_ASSISTANTS),
  TutoringExt: () => import('./assistant/builtinAssistantsTutoringExt.js').then(m => m.TUTORING_EXT_BUILTIN_ASSISTANTS),
  VeteranExt: () => import('./assistant/builtinAssistantsVeteranExt.js').then(m => m.VETERAN_EXT_BUILTIN_ASSISTANTS),
  VeterinaryExt: () => import('./assistant/builtinAssistantsVeterinaryExt.js').then(m => m.VETERINARY_EXT_BUILTIN_ASSISTANTS),
  WaterExt: () => import('./assistant/builtinAssistantsWaterExt.js').then(m => m.WATER_EXT_BUILTIN_ASSISTANTS),
  WebnovelExt: () => import('./assistant/builtinAssistantsWebnovelExt.js').then(m => m.WEBNOVEL_EXT_BUILTIN_ASSISTANTS),
  WeddingExt: () => import('./assistant/builtinAssistantsWeddingExt.js').then(m => m.WEDDING_EXT_BUILTIN_ASSISTANTS),
  WellnessExt: () => import('./assistant/builtinAssistantsWellnessExt.js').then(m => m.WELLNESS_EXT_BUILTIN_ASSISTANTS),
}

// 单个领域包加载封顶时间(ms):WPS 独立子窗口里某些 chunk 的 import() 可能既不 resolve
// 也不 reject(永久 pending),会让 Promise.all 卡死。给每个 loader 套超时:超时按 0 计、不阻塞。
const DOMAIN_PACK_LOAD_TIMEOUT_MS = 8000
function loadDomainPackWithTimeout(load) {
  return new Promise((resolve) => {
    let settled = false
    const done = (n) => { if (!settled) { settled = true; resolve(Number(n) || 0) } }
    const timer = setTimeout(() => done(0), DOMAIN_PACK_LOAD_TIMEOUT_MS)
    load()
      .then(registerLazyBuiltinAssistants)
      .then((n) => { clearTimeout(timer); done(n) })
      .catch((e) => { clearTimeout(timer); try { console.warn('[assistant] 领域包加载失败', e) } catch (_) { /* noop */ } done(0) })
  })
}

// 按 pack 短键去重加载:每个 pack 只加载一次,ensureDomainLoaded 与 ensureDomainPacksLoaded 共享同一 Promise。
const _packPromises = {}
const _loadedPacks = new Set()
function loadPack(key) {
  if (_packPromises[key]) return _packPromises[key]
  const loader = PACK_LOADERS[key]
  if (!loader) return Promise.resolve(0)
  _packPromises[key] = loadDomainPackWithTimeout(loader).then((n) => { _loadedPacks.add(key); return n })
  return _packPromises[key]
}

/** 加载某领域的全部 pack(base+Ext);幂等、跨调用去重。返回 Promise<boolean> 是否就绪。 */
export function ensureDomainLoaded(domain) {
  const entry = DOMAIN_MANIFEST[domain]
  if (!entry) return Promise.resolve(false)
  return Promise.all(entry.packs.map(loadPack)).then(() => true)
}
/** 同步查询某领域是否已加载完毕(渲染时判断用)。 */
export function isDomainLoaded(domain) {
  const entry = DOMAIN_MANIFEST[domain]
  if (!entry) return false
  return entry.packs.every((k) => _loadedPacks.has(k))
}

let _domainPacksPromise = null
/** 幂等加载全部领域包(并发共享、按 pack 去重);单包失败/超时跳过不阻断。返回累计新增数。 */
export function ensureDomainPacksLoaded() {
  if (!_domainPacksPromise) {
    _domainPacksPromise = Promise.all(
      Object.keys(PACK_LOADERS).map(loadPack)
    ).then((counts) => counts.reduce((a, b) => a + b, 0))
  }
  return _domainPacksPromise
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function getBuiltinAssistants() {
  return BUILTIN_ASSISTANTS.map(item => deepClone(item))
}

export function getBuiltinAssistantMap() {
  const map = {}
  BUILTIN_ASSISTANTS.forEach(item => {
    map[item.id] = deepClone(item)
  })
  return map
}

export function getBuiltinAssistantDefinition(id) {
  const found = BUILTIN_ASSISTANTS.find(item => item.id === id)
  return found ? deepClone(found) : null
}

// 给定助手 key/id，返回其工具能力 { isToolAssistant, toolId } 或 null
export function getAssistantToolInfo(assistantId) {
  const def = BUILTIN_ASSISTANTS.find(a => a.id === assistantId || a.key === assistantId)
  const caps = def?.runtimeCapabilities
  if (caps?.isToolAssistant) {
    return { isToolAssistant: true, toolId: caps.toolId || def.id }
  }
  return null
}

export function getAssistantDefaultConfig(definitionOrId) {
  const definition = typeof definitionOrId === 'string'
    ? getBuiltinAssistantDefinition(definitionOrId)
    : definitionOrId
  if (!definition) return null
  const defaultReportSettings = definition.id === 'analysis.form-field-audit'
    ? createDefaultReportSettings({
      enabled: true,
      type: 'compliance-audit-report',
      prompt: '优先输出总体结论、书签级问题、规则依据、规则外全文风险、整改建议和需人工复核事项；既要覆盖基于规则的审计结论，也要覆盖从上下文识别出的非规则型风险；结论要克制、可复核，避免脱离证据做武断判断。'
    })
    : createDefaultReportSettings()
  return {
    enabled: true,
    title: definition.shortLabel || definition.label,
    description: definition.description || '',
    category: definition.group,
    modelType: definition.modelType || 'chat',
    modelId: null,
    persona: '',
    systemPrompt: definition.systemPrompt || '',
    userPromptTemplate: definition.userPromptTemplate || '{{input}}',
    temperature: 0.3,
    outputFormat: definition.defaultOutputFormat || 'plain',
    documentAction: definition.defaultAction || 'insert',
    inputSource: definition.defaultInputSource || INPUT_SOURCE_SELECTION_PREFERRED,
    displayOrder: null,
    displayLocations: getResolvedDefaultDisplayLocations(definition),
    targetLanguage: '中文',
    commentStyle: 'standard',
    linkStyle: 'reference',
    reportSettings: defaultReportSettings,
    mediaOptions: {
      aspectRatio: '16:9',
      duration: '30s',
      voiceStyle: '专业自然'
    }
  }
}

export function getAssistantSettingItems(customAssistants = [], assistantSettingsMap = {}) {
  const builtinItems = BUILTIN_ASSISTANTS.map(item => ({
    key: item.id,
    label: item.label,
    shortLabel: item.shortLabel || item.label,
    icon: getAssistantResolvedIcon(item.id, assistantSettingsMap?.[item.id]?.icon || item.icon),
    group: item.group,
    type: 'system-assistant',
    modelType: item.modelType,
    description: item.description,
    domain: item.domain || '',
    tags: Array.isArray(item.tags) ? item.tags : []
  }))
  const customItems = (customAssistants || []).map(item => ({
    key: item.id,
    label: item.name || '智能文档助手',
    shortLabel: item.name || '智能文档助手',
    icon: getAssistantResolvedIcon(item.id, item.icon),
    group: String(item.group || item.category || 'custom').trim() || 'custom',
    type: 'custom-assistant',
    modelType: item.modelType || 'chat',
    description: item.description || '',
    createdAt: item.createdAt || '',
    domain: String(item.domain || '').trim(),
    tags: Array.isArray(item.tags) ? item.tags : []
  }))
  return [
    ...builtinItems,
    {
      key: 'create-custom-assistant',
      label: '创建智能助手',
      shortLabel: '创建智能助手',
      icon: 'images/add-to-assistant.svg',
      group: 'custom',
      type: 'create-custom-assistant',
      modelType: 'chat',
      description: '创建可显示在顶部或右键菜单中的自定义助手。'
    },
    ...customItems
  ]
}

export function getDocumentActionOptions(assistantId) {
  const definition = getBuiltinAssistantDefinition(assistantId)
  const allowed = definition?.allowedActions
  if (!allowed || allowed.length === 0) return DOCUMENT_ACTION_OPTIONS.slice()
  return DOCUMENT_ACTION_OPTIONS.filter((item) => {
    if (allowed.includes(item.value)) return true
    if (item.value === 'insert-after') return allowed.includes('insert')
    if (item.value === 'prepend') return allowed.includes('insert') || allowed.includes('append')
    return false
  })
}

export function getBuiltinRibbonAssistantIds() {
  return BUILTIN_ASSISTANTS.filter(item => item.supportsRibbon).map(item => item.id)
}

export function getAssistantGroupLabel(groupKey) {
  const found = ASSISTANT_GROUPS.find(item => item.key === groupKey)
  return found ? found.label : (String(groupKey || '').trim() || '未分组')
}
