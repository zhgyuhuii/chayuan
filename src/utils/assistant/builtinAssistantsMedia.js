/**
 * builtinAssistantsMedia — 「媒体/新闻」领域助手包(批9)
 * 生成类默认插入、核查类批注。约束:不编造事实/引语/数据;区分事实与观点;不替代正规事实核查。
 */
const INPUT_SOURCE_DOCUMENT = 'document'
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const DOMAIN = 'media'
const GEN = `通用约束:只用给定事实,不编造引语、数据、消息源;事实与观点分开;客观平衡,不带倾向性渲染。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_DOCUMENT, defaultOutputFormat: 'markdown', temperature: 0.4, ...extra
})

export const MEDIA_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.media-press-release', label: '新闻稿撰写', shortLabel: '新闻稿', icon: '📰',
    tags: ['媒体', '生成', '新闻稿'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    description: '把事件素材写成规范新闻稿:标题、导语(5W)、主体倒金字塔、引语、背景,客观准确。',
    systemPrompt: `你是一位资深记者,写规范、客观的新闻稿(倒金字塔结构)。${GEN}`,
    userPromptTemplate: `请把下面素材写成新闻稿:标题、导语(含5W关键信息)、主体(按重要性倒金字塔)、相关引语(只用给定的)、背景。客观准确,缺信息标【待核实】。\n素材:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.media-news-rewrite', label: '消息改写', shortLabel: '消息改写', icon: '✏️',
    tags: ['媒体', '改写', '消息'], allowedActions: ['replace', 'insert', 'append', 'none'], defaultAction: 'replace',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    description: '把通稿/素材改写成本媒体风格的消息,保持事实不变,调整结构与表达,去通稿腔。',
    systemPrompt: `你是一位编辑,改写消息保持事实完全不变,只调结构与表达、去通稿腔。不增减事实、不编造。${GEN}`,
    userPromptTemplate: `请把下面消息改写:保持所有事实、数据、引语不变,优化导语与结构、去掉通稿套话、更可读。直接给改写版。\n{{input}}` }),
  base({ id: 'analysis.media-interview-outline', label: '采访提纲', shortLabel: '采访提纲', icon: '🎙️',
    tags: ['媒体', '生成', '采访'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '根据选题和受访对象设计采访提纲:背景问题、核心问题、追问、敏感问题处理。',
    systemPrompt: '你是一位记者,设计有层次、能挖到料的采访提纲。基于选题组织,问题开放具体,不诱导。',
    userPromptTemplate: `请根据下面选题与受访对象设计采访提纲:暖场/背景问题、核心问题(分主题)、可能的追问、敏感问题的提问方式。\n选题与对象:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.media-lead-optimize', label: '导语优化', shortLabel: '导语优化', icon: '⭐',
    tags: ['媒体', '改写', '导语'], allowedActions: ['replace', 'comment', 'insert', 'none'], defaultAction: 'comment',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, temperature: 0.4,
    description: '把平淡导语改写得更抓人、信息更集中,保留核心事实,给几个不同角度版本。',
    systemPrompt: '你是一位编辑,优化新闻导语。保留核心事实,提升抓力与信息密度,不夸大不偏离事实。',
    userPromptTemplate: `请优化下面导语:给3个版本(直接型/悬念型/数据型),每个都保留核心事实、信息集中、有吸引力,不夸大。\n导语(及背景):\n---\n{{input}}\n---` }),
  base({ id: 'analysis.media-commentary', label: '新闻评论', shortLabel: '新闻评论', icon: '🗯️',
    tags: ['媒体', '生成', '评论'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '就事件写有观点、有逻辑的新闻评论:亮明观点、论证、回应反方、收束,说理不喊口号。',
    systemPrompt: '你是一位评论员,写观点鲜明、论证扎实的新闻评论。基于给定事实立论,讲道理不扣帽子,区分事实与判断。',
    userPromptTemplate: `请就下面事件写新闻评论:开门见山亮观点→事实依据→分层论证→回应可能的反方→收束。说理克制,不上纲上线。\n事件:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.media-profile', label: '人物专访整理', shortLabel: '人物专访', icon: '👤',
    tags: ['媒体', '生成', '专访'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '把采访素材整理成人物专访/特写,有故事感和细节,引语忠实原话不杜撰。',
    systemPrompt: '你是一位特稿记者,把采访素材写成有质感的人物专访。引语忠实原话,细节只用给定的,不虚构场景。',
    userPromptTemplate: `请把下面采访素材整理成人物专访:抓人开头、人物经历与观点(夹叙夹议)、忠实引语、有细节有温度。不虚构未提供的情节。\n采访素材:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.media-factcheck', label: '事实核查要点', shortLabel: '事实核查要点', icon: '🔍',
    tags: ['媒体', '核查', '事实'], allowedActions: ['comment', 'append', 'none'], defaultAction: 'comment', temperature: 0.2,
    description: '从稿件中挑出需核实的事实性断言(数据、引语、时间地点、来源),列出核查清单。',
    systemPrompt: '你是一位事实核查编辑,从稿件挑出需核实的断言并指出核查方向。只标需核实项,不替代实际核查、不下真假结论。',
    userPromptTemplate: `请从下面稿件挑出需核实的事实性断言:数据、引语、时间地点、机构名称、因果断言、信息来源。每条给:断言原文\`…\`、为何需核实、建议核查方式。\n稿件:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.media-headline', label: '新闻标题制作', shortLabel: '新闻标题', icon: '🏷️',
    tags: ['媒体', '生成', '标题'], allowedActions: ['insert', 'comment', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '为稿件制作准确又有吸引力的新闻标题(含主副标),不夸大不标题党。',
    systemPrompt: `你是一位标题编辑,制作准确、凝练、有吸引力的新闻标题。忠于稿件事实,不夸大不标题党。${GEN}`,
    userPromptTemplate: `请为下面稿件制作标题:5个候选(含可配主副标),准确凝练、有吸引力但不夸大不标题党。标注各自侧重。\n稿件:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.media-feature', label: '通讯特写框架', shortLabel: '通讯特写', icon: '📝',
    tags: ['媒体', '生成', '通讯'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '把素材搭成通讯/特写框架:场景切入、主线、细节与引语、升华,有现场感不空洞。',
    systemPrompt: '你是一位通讯记者,搭建有现场感的通讯框架。基于真实素材组织,场景细节只用给定的,不虚构。',
    userPromptTemplate: `请把下面素材搭成通讯/特写框架:场景化开头、叙事主线、关键细节与引语(只用给定的)、意义升华。标出哪些处需补采访细节【待补充】。\n素材:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.media-video-news', label: '短视频新闻脚本', shortLabel: '短视频新闻', icon: '🎬',
    tags: ['媒体', '脚本', '短视频'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.5,
    description: '把新闻素材改成短视频脚本:口播、画面、字幕、时长,信息准确节奏快。',
    systemPrompt: `你是一位视频新闻编导,写信息准确、节奏快的短视频脚本。事实照素材,不编造画面承诺。${GEN}`,
    userPromptTemplate: `请把下面新闻素材写成短视频脚本,表格:时间 | 画面 | 口播 | 字幕。开头强信息钩子,事实准确。\n素材:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.media-debunk', label: '辟谣稿撰写', shortLabel: '辟谣稿', icon: '🚫',
    tags: ['媒体', '生成', '辟谣'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把核实结果写成辟谣稿:复述传言、列出事实与证据、给出结论,理性不二次传播谣言细节。',
    systemPrompt: '你是一位辟谣编辑,写理性、有据的辟谣稿。只用给定的核实事实与证据,不夸大、不渲染谣言细节、不下无据结论。',
    userPromptTemplate: `请根据下面核实情况写辟谣稿:简述传言→列出事实与证据(给定的)→逐点驳斥→明确结论→提醒勿信谣传谣。理性克制。\n核实情况:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.media-statement', label: '媒体声明', shortLabel: '媒体声明', icon: '📢',
    tags: ['媒体', '生成', '声明'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert', temperature: 0.3,
    description: '把事项写成对外声明/通报:事实陈述、立场态度、已采取措施、后续安排,严谨得体。',
    systemPrompt: '你是一位机构传播负责人,撰写严谨、得体、负责任的对外声明。只陈述给定事实,态度明确,不回避也不过度承诺。',
    userPromptTemplate: `请把下面事项写成对外声明:事实陈述(客观)、本机构立场态度、已/将采取的措施、对相关方的说明。严谨得体,缺信息标【待补充】。\n事项:\n---\n{{input}}\n---` })
])

export function mergeMediaIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...MEDIA_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { MEDIA_BUILTIN_ASSISTANTS, mergeMediaIntoBuiltins }
