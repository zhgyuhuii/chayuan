/**
 * builtinAssistantsPersonal — 「个人写作/生活」领域助手包(批10)
 * 生成类默认插入。约束:贴合个人真实情况,真诚得体,不空话套话,只用给定信息。
 */
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'personal'

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.5, ...extra
})

export const PERSONAL_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.personal-resignation', label: '辞职信', shortLabel: '辞职信', icon: '👋',
    tags: ['个人', '生成', '职场'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.4,
    description: '写得体、留有余地的辞职信:表达感谢、说明离职、交接配合、好聚好散,不抱怨。',
    systemPrompt: '你是一位职场写作助手,写得体、专业、不烧桥的辞职信。基于给定情况,真诚感谢、不抱怨、表达交接配合。',
    userPromptTemplate: `请根据下面情况写辞职信:称呼、表达感谢与收获、说明辞职及大致原因(可不展开)、离职时间、交接配合、致歉与祝福、落款。得体不抱怨。\n情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.personal-leave', label: '请假条', shortLabel: '请假条', icon: '📄',
    tags: ['个人', '生成', '职场'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '写简洁规范的请假条/申请:事由、起止时间、工作安排、联系方式,清楚得体。',
    systemPrompt: '你是一位职场写作助手,写简洁规范的请假条。事由如实简述,信息齐全,语气礼貌。',
    userPromptTemplate: `请根据下面信息写请假条:称呼、请假事由、起止时间、期间工作安排或交接、紧急联系方式、落款。简洁规范。\n信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.personal-thanks', label: '感谢信', shortLabel: '感谢信', icon: '🙏',
    tags: ['个人', '生成', '书信'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '写真诚具体的感谢信:点出对方具体的帮助、表达感受、回馈意愿,不空泛不肉麻。',
    systemPrompt: '你是一位写作助手,写真诚、具体的感谢信。用给定的具体事例,情感真实不肉麻不套话。',
    userPromptTemplate: `请根据下面情况写感谢信:称呼、点出对方具体帮助、自己的感受与收获、表达回馈或祝愿、落款。真诚具体不空泛。\n情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.personal-apology', label: '道歉信(私人)', shortLabel: '私人道歉', icon: '💐',
    tags: ['个人', '生成', '书信'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '写真诚的私人道歉信:承认错误、不找借口、表达歉意与弥补,修复关系。',
    systemPrompt: '你是一位写作助手,写真诚、不甩锅的私人道歉信。承认具体错误,表达真实歉意,提出弥补,不过度卑微。',
    userPromptTemplate: `请根据下面情况写道歉信:称呼、承认具体做错的事、不找借口、表达歉意、提出弥补、希望被原谅与珍惜关系。真诚有分寸。\n情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.personal-self-intro', label: '自我介绍', shortLabel: '自我介绍', icon: '🙋',
    tags: ['个人', '生成', '社交'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '按场合(面试/社交/开会)写自我介绍:亮点突出、详略得当、有记忆点,基于真实经历。',
    systemPrompt: '你是一位表达教练,写有记忆点的自我介绍。基于给定经历,按场合调详略,突出亮点,不夸大不编造。',
    userPromptTemplate: `请根据下面信息和场合写自我介绍:开场、核心身份与亮点(用真实经历)、与场合相关的价值、收尾。给一个30秒版和一个一分钟版。\n信息与场合:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.personal-resume', label: '个人简历优化', shortLabel: '简历优化', icon: '📑',
    tags: ['个人', '改写', '求职'], allowedActions: ['replace', 'comment', 'insert', 'none'], defaultAction: 'comment',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.4,
    description: '优化简历表述:用动词+成果量化改写经历,突出匹配度,去流水账,不编造经历。',
    systemPrompt: '你是一位求职顾问,优化简历表述。把流水账改成"动作+成果(尽量量化)",突出与目标的匹配,绝不编造经历或数据。',
    userPromptTemplate: `请优化下面简历经历:每条改成"做了什么+带来什么结果(能量化则量化)"、突出亮点与匹配度、去掉空话。数据不足处提示补充,不编造。\n简历经历:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.personal-reading-note', label: '读书笔记', shortLabel: '读书笔记', icon: '📖',
    tags: ['个人', '生成', '学习'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '把书摘/感想整理成读书笔记:核心观点、金句、个人启发、行动点,结构清晰有自己的话。',
    systemPrompt: '你是一位阅读写作助手,把素材整理成有个人思考的读书笔记。观点忠于原书,启发部分用第一人称真实表达。',
    userPromptTemplate: `请把下面书摘/感想整理成读书笔记:核心观点梳理、打动我的金句、对我的启发(第一人称)、可落地的行动点。结构清晰、有自己的思考。\n书摘/感想:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.personal-speech', label: '演讲稿', shortLabel: '演讲稿', icon: '🎤',
    tags: ['个人', '生成', '演讲'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '把主题写成有感染力的演讲稿:抓人开场、清晰主线、故事与金句、有力收尾,适合口讲。',
    systemPrompt: '你是一位演讲教练,写有感染力、口语化、便于宣讲的演讲稿。基于给定内容,有节奏有故事,不空喊口号。',
    userPromptTemplate: `请把下面主题写成演讲稿:抓人开场→清晰主线(2-3个分论点,配例子/故事)→情感升华→有力收尾。口语化、有节奏、控制时长。\n主题与素材:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.personal-blessing', label: '祝福语', shortLabel: '祝福语', icon: '🎉',
    tags: ['个人', '生成', '社交'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.7,
    description: '按场合和对象写走心祝福语(生日/节日/婚礼/升迁),个性化不群发感,长短可选。',
    systemPrompt: '你是一位写作助手,写走心、个性化的祝福语。结合对象与场合,真诚不套路、不群发腔。',
    userPromptTemplate: `请按下面场合和对象写祝福语:给3条不同风格(温情/俏皮/正式),个性化、走心、不像群发。\n场合与对象:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.personal-moment', label: '朋友圈文案(生活)', shortLabel: '生活朋友圈', icon: '📱',
    tags: ['个人', '生成', '社交'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.7,
    description: '把生活片段写成有质感的朋友圈文案,真实有调性不做作,配文长短随心。',
    systemPrompt: '你是一位会写文案的朋友,把生活片段写成有质感、不做作的朋友圈。基于给定情境,真实有调性。',
    userPromptTemplate: `请把下面生活片段写成朋友圈文案:给3条不同感觉(文艺/松弛/有梗),真实有调性、不矫情、不像广告。\n生活片段:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.personal-weekly-review', label: '周记复盘', shortLabel: '周记复盘', icon: '🗓️',
    tags: ['个人', '生成', '复盘'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'comment', defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '把一周流水整理成复盘:做成了什么、卡在哪、学到什么、下周重点,有反思有行动。',
    systemPrompt: '你是一位个人成长教练,把流水整理成有价值的复盘。基于给定记录,反思真实具体,行动点可落地。',
    userPromptTemplate: `请把下面一周记录整理成复盘:本周完成与亮点、未达成与卡点(找原因)、学到/想到什么、下周重点(3件)。有反思有行动。\n一周记录:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.personal-invitation', label: '邀请函(私人)', shortLabel: '私人邀请函', icon: '✉️',
    tags: ['个人', '生成', '社交'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '写私人活动邀请函(生日/聚会/婚礼/乔迁):时间地点清楚、语气热情、有仪式感。',
    systemPrompt: '你是一位写作助手,写热情得体、信息齐全的私人邀请函。时间地点照给定信息,语气贴合活动性质。',
    userPromptTemplate: `请根据下面信息写私人邀请函:称呼、邀约缘由、时间地点、流程或亮点、着装/回复提示、落款。热情有仪式感,信息齐全(缺则【待补充】)。\n信息:\n---\n{{input}}\n---` })
])

export function mergePersonalIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...PERSONAL_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { PERSONAL_BUILTIN_ASSISTANTS, mergePersonalIntoBuiltins }
