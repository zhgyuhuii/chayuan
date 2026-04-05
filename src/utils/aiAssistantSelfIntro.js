import { resolveAssistantCapabilityFaq } from './assistantCapabilityFaq.js'

const DIRECT_IDENTITY_PATTERNS = [
  /\bwho\s+are\s+you\b/i,
  /\bwhat\s+are\s+you\b/i,
  /\bintroduce\s+yourself\b/i,
  /\btell\s+me\s+about\s+yourself\b/i,
  /\bwhat\s+can\s+you\s+do\b/i,
  /\bwho\s+(built|made|developed)\s+you\b/i,
  /\bwho\s+(built|made|developed)\s+this\s+(app|tool|program|assistant|plugin)\b/i,
  /\bwhat\s+is\s+this\s+(app|tool|program|assistant|plugin)\b/i,
  /\bare\s+you\s+(chatgpt|gpt|claude|deepseek|gemini|kimi|qwen)\b/i,
  /你是谁/,
  /你是(谁|什么)/,
  /你(是|是不是).{0,8}(chatgpt|gpt|claude|deepseek|kimi|gemini|豆包|通义千问|文心一言|元宝|混元|智谱)/i,
  /介绍一下你自己/,
  /介绍下你自己/,
  /介绍你自己/,
  /介绍一下你/,
  /介绍下你/,
  /说说你自己/,
  /讲讲你自己/,
  /聊聊你自己/,
  /你能做什么/,
  /你会做什么/,
  /你有什么功能/,
  /你有什么能力/,
  /你擅长什么/,
  /你是干嘛的/,
  /你是做什么的/,
  /(这个|这款|该)(软件|程序|工具|插件|助手).{0,8}(是什么|是做什么的|有什么功能|能做什么|谁开发的|哪家开发的|开源吗|免费吗|怎么介绍)/,
  /(察元ai|察元ai文档助手).{0,8}(是什么|是做什么的|能做什么|有什么功能|谁开发的|哪家开发的|开源吗|免费吗)/i
]

const NEGATIVE_PATTERNS = [
  /(帮我|请帮我|麻烦你|给我|替我).{0,12}(写|生成|起草|整理|润色|优化|改写|编写|做一个|做个|准备).{0,12}(自我介绍|个人介绍|个人简介|个人说明)/,
  /(写|生成|起草|整理).{0,12}(一篇|一段|一份|一个).{0,12}(自我介绍|个人介绍|个人简介|个人说明)/,
  /(自我介绍|个人介绍|个人简介).{0,12}(模板|范文|示例|稿子|文案|演讲稿|PPT|作文|材料)/,
  /(帮我|请帮我|给我).{0,8}(介绍一下我自己|写一下我自己|写个自我介绍)/,
  /(面试|竞选|入职|演讲|主持|汇报|答辩).{0,12}(自我介绍|个人介绍)/
]

const CN_PREFIXES = [
  '',
  '请问',
  '我想问下',
  '想问下',
  '麻烦问下',
  '方便问下',
  '请你',
  '麻烦你',
  '能不能',
  '可以',
  '简单',
  '详细'
]

const CN_SUFFIXES = [
  '',
  '吗',
  '呢',
  '呀',
  '啊',
  '吧',
  '可以吗',
  '行吗',
  '谢谢',
  '呗'
]

const CN_ASSISTANT_SUBJECTS = [
  '你',
  '你自己',
  '你这个助手',
  '你这个AI',
  '你这个AI助手',
  '你这个文档助手',
  '这个助手',
  '这个AI',
  '这个AI助手',
  '这个文档助手',
  '这个软件',
  '这个程序',
  '这个工具',
  '这个插件',
  '该软件',
  '该程序',
  '察元AI',
  '察元AI文档助手',
  '察元文档助手'
]

const CN_IDENTITY_PREDICATES = [
  '是谁',
  '是什么',
  '是干嘛的',
  '是做什么的',
  '到底是什么',
  '到底是干嘛的',
  '属于什么工具',
  '是什么助手',
  '是什么软件',
  '是什么程序',
  '是哪个公司做的',
  '是哪个团队做的',
  '是谁做的',
  '谁开发的',
  '哪家开发的',
  '来自哪里'
]

const CN_CAPABILITY_PREDICATES = [
  '能做什么',
  '会做什么',
  '能帮我做什么',
  '可以帮我做什么',
  '有什么功能',
  '有哪些功能',
  '有什么能力',
  '有哪些能力',
  '擅长什么',
  '主要用途是什么',
  '主要作用是什么',
  '有什么本事'
]

const CN_INTRO_VERBS = [
  '介绍一下',
  '介绍下',
  '简单介绍一下',
  '详细介绍一下',
  '展开介绍一下',
  '说说',
  '讲讲',
  '聊聊',
  '具体说说',
  '简单说说',
  '详细说说',
  '自我介绍一下'
]

const CN_ORIGIN_PREDICATES = [
  '谁开发的',
  '哪家开发的',
  '哪个公司开发的',
  '哪个团队开发的',
  '背后是谁',
  '背后是哪家公司',
  '开源吗',
  '免费吗',
  '收费吗',
  '有什么来历'
]

const CN_MODEL_NAMES = [
  'chatgpt',
  'gpt',
  'claude',
  'deepseek',
  'kimi',
  'gemini',
  'qwen',
  '豆包',
  '通义千问',
  '文心一言',
  '元宝',
  '混元',
  '智谱',
  'chatglm',
  '讯飞星火'
]

const EN_PREFIXES = ['', 'please ', 'hey ', 'hi ', 'can you ', 'could you ', 'would you ', 'kindly ']
const EN_SUFFIXES = ['', '?', ' please', ' for me']
const EN_QUESTIONS = [
  'who are you',
  'what are you',
  'introduce yourself',
  'tell me about yourself',
  'what can you do',
  'what are your features',
  'what is this assistant',
  'what is this tool',
  'what is this app',
  'what is this program',
  'who built you',
  'who made you',
  'who developed you',
  'who built this assistant',
  'who developed this tool',
  'are you chatgpt',
  'are you gpt',
  'are you claude',
  'are you deepseek',
  'are you gemini',
  'are you kimi',
  'what company built you',
  'what company made this app',
  'is this open source',
  'is this free'
]

const ASSISTANT_SUBJECT_HINTS = [
  '你',
  '你自己',
  '这个助手',
  '这个ai',
  '这个ai助手',
  '这个文档助手',
  '这个软件',
  '这个程序',
  '这个工具',
  '这个插件',
  '该软件',
  '该程序',
  '察元ai',
  '察元ai文档助手',
  '察元文档助手',
  'this assistant',
  'this app',
  'this tool',
  'this program',
  'this plugin'
]

const INTRO_HINTS = [
  '介绍',
  '自我介绍',
  '说说',
  '讲讲',
  '聊聊',
  '简单介绍',
  '详细介绍',
  'introduce',
  'tell me about'
]

const IDENTITY_HINTS = [
  '是谁',
  '是什么',
  '是干嘛的',
  '是做什么的',
  '谁开发',
  '哪家开发',
  '哪个公司',
  '哪个团队',
  '开源',
  '免费',
  '收费',
  '作用',
  '用途',
  '定位',
  'who are you',
  'what are you',
  'who built',
  'who made',
  'who developed'
]

const CAPABILITY_HINTS = [
  '能做什么',
  '会做什么',
  '能帮我做什么',
  '有什么功能',
  '有哪些功能',
  '有什么能力',
  '擅长什么',
  'what can you do',
  'features'
]

const USAGE_HINTS = [
  '怎么用',
  '如何用',
  '如何使用',
  '怎么使用',
  '怎么介绍',
  'how to use'
]

const INTRO_OPENINGS = [
  '你好，我是察元AI文档助手。',
  '我是察元AI文档助手，很高兴在这里为你服务。',
  '欢迎认识我，我叫察元AI文档助手。',
  '这里为你服务的是察元AI文档助手。',
  '当前对话中的我，是察元AI文档助手。'
]

const INTRO_IDENTITIES = [
  '我由北京智灵鸟科技中心开发，定位是面向文档处理与办公写作场景的智能助手。',
  '我是由北京智灵鸟科技中心开发的文档智能助手，专门服务写作、审阅和处理类工作。',
  '我来自北京智灵鸟科技中心，核心目标是把复杂的文档处理工作变得更直接、更高效。',
  '本助手由北京智灵鸟科技中心打造，重点服务日常办公写作、审阅和文档分析场景。',
  '你现在看到的并不是某个大模型在单独自我介绍，而是察元AI文档助手在介绍自己。'
]

const INTRO_VALUES = [
  '项目坚持开源免费，希望让更多用户低门槛用上实用的AI文档能力。',
  '整个项目主打开源免费，让用户可以更轻松地把AI能力接入日常文档工作。',
  '它是一款开源免费的产品，重点不是堆概念，而是解决真实文档场景里的效率问题。',
  '我们强调开源免费和长期可用，更看重功能是否真的能落到文档处理现场。',
  '它不是只做聊天展示，而是围绕开源免费、实用优先和文档效率来设计的。'
]

const INTRO_FEATURE_GROUPS = [
  '功能覆盖文档编写、润色优化、摘要提炼、翻译改写、错别字与语法修正、批注解释，以及结合最佳实践的 AI 痕迹抽查等常见写作与审阅任务。',
  '目前已经支持写作辅助、内容总结、智能翻译、术语统一、结构优化、批注说明、AI 痕迹检查和文本审校等能力。',
  '你可以把它用于起草材料、优化表达、提炼重点、生成标题、统一术语、整理纪要、解释文本，以及在正文中锚点标注可疑的 AI 生成痕迹供复核。',
  '日常像写通知、写汇报、改方案、做摘要、查错字、统一表述、解释批注这类事情，我都能参与处理。',
  '如果你要处理写作、改写、翻译、审阅、归纳、提炼这类文档工作，我都属于高频适用场景。'
]

const INTRO_PROJECT_FEATURES = [
  '同时还结合项目本身能力，支持保密检查、AI 痕迹检查、表单字段提取、文档审计、报告生成，以及图片、语音、视频等扩展生成。',
  '结合当前项目能力，我还可以处理保密审查、AI 痕迹抽查（在原文锚点批注疑似片段）、表单智能提取、文档审计、报告生成，并衔接图片、语音、视频等多模态任务。',
  '除了基础问答，我也融合了项目里的保密检查、AI 痕迹检查、表单抽取、审计分析、报告生成和多模态生成等功能模块。',
  '在项目能力层面，我还覆盖表单建模、审计辅助、报告草拟、多模态生成，以及保密与文稿质量（AI 痕迹）相关处理等扩展能力。',
  '如果你的需求不只是聊天，而是想把结果落到文档任务里，这套项目能力会更有价值。'
]

const INTRO_WPS_FEATURES = [
  '在WPS场景里，还能进一步配合选区、全文、批注和格式操作，帮助你更自然地处理当前文档。',
  '如果你正在编辑文档，我还可以结合当前选区、全文上下文和常见WPS操作链路给出更贴近现场的帮助。',
  '放到当前插件环境中，我不仅能回答问题，还能围绕选中内容、全文分析和文档操作流程协同工作。',
  '在当前插件里，我会尽量结合文档上下文、选中内容和实际操作链路，而不是只返回一段泛泛而谈的回答。',
  '所以你问“你是谁”时，我会优先按本程序的真实能力介绍自己，而不是让底层模型随便发挥。'
]

const INTRO_CLOSINGS = [
  '如果你愿意，现在就可以直接告诉我一段文字、一个写作目标，或者当前文档里想处理的问题。',
  '你可以把我当成一个长期在线的文档搭子，随时交给我写、改、查、审、提炼这类任务。',
  '无论你是想写材料、改文档，还是做审阅和分析，我都可以马上开始配合你。',
  '如果你接下来想试一试，可以直接发来一段文本，或者说清楚你要修改、总结、翻译还是审查什么。',
  '后面你也可以继续问更具体的功能场景，我会按察元AI文档助手的能力范围继续配合你。'
]

const FAQ_USAGE_PATTERNS = [
  /(这个|这款|该|察元ai|察元ai文档助手).{0,12}(怎么用|如何用|如何使用|怎么使用|怎么上手|怎么开始|怎么操作)/i,
  /(使用|上手|开始).{0,12}(这个|这款|该|察元ai|察元ai文档助手).{0,12}(软件|程序|工具|插件|助手)/i,
  /\bhow\s+to\s+use\s+(this\s+)?(assistant|tool|app|program|plugin)\b/i,
  /\bhow\s+do\s+i\s+use\s+(this\s+)?(assistant|tool|app|program|plugin)\b/i
]

const FAQ_BUTTON_PATTERNS = [
  /(这个|这款|该|察元ai|察元ai文档助手).{0,12}(有哪些按钮|有什么按钮|有哪些菜单|有什么菜单|有哪些入口|有什么入口)/i,
  /(顶部菜单|右键菜单|按钮|菜单|入口).{0,12}(有哪些|有什么|都有什么|分别是什么)/,
  /^(有哪些按钮|有什么按钮|有哪些菜单|有什么菜单|有哪些入口|有什么入口)$/,
  /\bwhat\s+(buttons|menus|entries|actions)\s+(does\s+it\s+have|are\s+there)\b/i
]

const FAQ_CAPABILITY_PATTERNS = [
  /(这个|这款|该|察元ai|察元ai文档助手).{0,12}(支持哪些能力|支持什么能力|支持哪些功能|支持什么功能|能干什么|能做哪些事)/i,
  /(都能做什么|都支持什么|有哪些能力|有哪些功能|主要能力是什么|核心能力是什么)/,
  /^(支持哪些能力|支持什么能力|支持哪些功能|支持什么功能|有哪些能力|有哪些功能|都能做什么|都支持什么)$/,
  /\bwhat\s+(features|capabilities|functions)\s+(does\s+it\s+have|are\s+supported)\b/i,
  /\bwhat\s+can\s+(this\s+)?(assistant|tool|app|program|plugin)\s+do\b/i
]

const FAQ_MODEL_RELATION_PATTERNS = [
  /(和|跟).{0,6}(模型|chatgpt|gpt|claude|deepseek|kimi|gemini|豆包|通义千问|文心一言).{0,12}(什么关系|啥关系|有啥关系)/i,
  /(你|这个助手|这个软件|察元ai).{0,12}(和|跟).{0,6}(大模型|模型).{0,12}(什么关系|怎么配合|关系是什么)/i,
  /(是不是|是否|属于|算不算).{0,8}(chatgpt|gpt|claude|deepseek|kimi|gemini|豆包|通义千问|文心一言|大模型)/i,
  /(底层|背后|后面).{0,8}(是不是|是否|用的|接的).{0,8}(模型|大模型|chatgpt|gpt|claude|deepseek|kimi|gemini)/i,
  /\bhow\s+is\s+this\s+(assistant|tool|app)\s+related\s+to\s+(chatgpt|gpt|claude|deepseek|kimi|gemini|llms?)\b/i,
  /\bis\s+this\s+(assistant|tool|app)\s+(chatgpt|gpt|claude|deepseek|kimi|gemini)\b/i
]

const FAQ_MODEL_SUPPORT_PATTERNS = [
  /(支持|可以接|能接|能用).{0,10}(哪些模型|什么模型|哪些大模型|什么大模型|哪些提供商|什么提供商)/i,
  /(能不能接|可不可以接).{0,10}(chatgpt|gpt|claude|deepseek|kimi|gemini|ollama|豆包|通义千问|文心一言)/i,
  /^(支持哪些模型|支持什么模型|支持哪些大模型|支持什么大模型|支持哪些提供商|支持什么提供商)$/,
  /\bwhat\s+(models|llms|providers)\s+are\s+supported\b/i
]

const FAQ_MODEL_SETUP_PATTERNS = [
  /(怎么|如何).{0,8}(配置模型|连接模型|设置模型|配置api|配置接口|填写api key|填密钥)/i,
  /(模型|api key|密钥|接口地址|提供商).{0,12}(怎么配|怎么设置|如何配置|如何设置)/i,
  /(没有模型|没配置模型|未配置模型).{0,12}(怎么办|怎么弄|怎么用)/i,
  /^(怎么配置模型|如何配置模型|怎么连接模型|如何连接模型|怎么设置api key|如何设置api key)$/,
  /\bhow\s+to\s+(configure|set\s+up|connect)\s+(the\s+)?(model|api|api key|provider)\b/i
]

const FAQ_DOCUMENT_OPERATION_PATTERNS = [
  /(能不能|可不可以|是否支持|支不支持).{0,10}(直接改文档|修改文档|写回文档|插入文档|替换文档|批注文档|处理当前文档)/i,
  /(可以|能).{0,8}(写回文档|直接写入文档|改正文档|改当前文档|插入到文档|给文档加批注)/i,
  /^(能不能直接改文档|是否支持写回文档|可以修改当前文档吗|能写回文档吗)$/,
  /\bcan\s+it\s+(edit|modify|write\s+back\s+to|insert\s+into|comment\s+on)\s+(the\s+)?document\b/i
]

const FAQ_SCENE_PATTERNS = [
  /(适合|适用于|主要用于|用来).{0,10}(什么场景|哪些场景|哪些工作|什么工作|哪些人用|什么人用)/i,
  /(哪些场景适合|适合哪些场景|主要应用场景|主要使用场景)/,
  /^(适合什么场景|适用于哪些场景|主要用于什么场景|适合哪些人用)$/,
  /\bwhat\s+(scenarios|use cases|workflows)\s+is\s+it\s+(for|best\s+for)\b/i
]

const FAQ_FILE_TYPE_PATTERNS = [
  /(支持|能处理|可以处理).{0,12}(哪些文件类型|什么文件类型|哪些附件|什么附件|哪些格式|什么格式)/i,
  /(pdf|docx|word|excel|xlsx|csv|json|markdown|md|txt).{0,12}(支持吗|能读吗|能处理吗|能识别吗)/i,
  /^(支持哪些文件类型|支持什么文件类型|支持哪些附件|支持什么附件|支持哪些格式|支持什么格式)$/,
  /\bwhat\s+(file types|formats|attachments)\s+are\s+supported\b/i
]

const FAQ_DOCUMENT_OBJECT_PATTERNS = [
  /(支持|能处理|可以处理).{0,12}(哪些文档对象|什么文档对象|哪些文档元素|什么文档元素|哪些对象|什么对象)/i,
  /(段落|表格|单元格|图片|图像|批注|注释|链接|超链接|嵌入对象|对象附件|OLE).{0,12}(支持吗|能处理吗|能操作吗|能识别吗)/i,
  /^(支持哪些文档对象|支持什么文档对象|支持哪些文档元素|支持什么文档元素|能处理哪些文档对象|能处理哪些元素)$/,
  /\bwhat\s+(document\s+objects|elements)\s+are\s+supported\b/i
]

const FAQ_NETWORK_PATTERNS = [
  /(需不需要|是否需要|会不会|要不要).{0,12}(联网|网络|互联网|在线|访问外网)/i,
  /(会不会|是否会|是不是会).{0,12}(上传|传到云端|传到服务器|发到外面|发给模型服务)/i,
  /(上传数据|上传内容|上传文档|上传附件|把数据上传|把内容上传|把文档上传)/i,
  /(离线|本地模型|ollama).{0,12}(能用吗|可以用吗|支持吗)/i,
  /^(需要联网吗|会联网吗|会上传吗|离线能用吗|本地模型能用吗)$/,
  /\bdoes\s+it\s+need\s+(internet|network)\b/i,
  /\bdoes\s+it\s+upload\s+data\b/i
]

const FAQ_SECURITY_PATTERNS = [
  /(安全性|安全吗|隐私|数据安全|本地存储|本地处理|保密性|敏感数据|数据会不会泄露)/i,
  /(数据|内容|文档|附件).{0,12}(存在哪里|怎么存|是否本地|会不会被上传|会不会泄露)/i,
  /^(数据安全吗|隐私安全吗|数据存在哪里|内容会被上传吗|文档会被上传吗)$/,
  /\bhow\s+is\s+(data|privacy|security)\s+handled\b/i
]

const FAQ_PROJECT_INFO_PATTERNS = [
  /(开源吗|免费吗|收费吗|谁开发的|哪家开发的|哪个公司开发的|哪个团队开发的|背后是谁|是谁做的|是谁开发的)/i,
  /^(开源吗|免费吗|收费吗|谁开发的|哪家开发的|是谁做的)$/,
  /\b(is\s+this\s+open\s+source|is\s+this\s+free|who\s+developed\s+this|who\s+built\s+this)\b/i
]

const FAQ_EXPORT_PATTERNS = [
  /(支持|能不能|可不可以|是否支持).{0,12}(导出附件|导出图片|导出文档对象|导出嵌入对象|提取附件|提取图片|提取对象|下载附件|下载图片|下载对象)/i,
  /(附件|图片|对象|嵌入对象|OLE|文档对象).{0,12}(能导出吗|能提取吗|能下载吗|支持吗)/i,
  /^(支持导出附件吗|支持导出图片吗|支持导出对象吗|能提取文档附件吗|能导出文档对象吗)$/,
  /\b(can\s+it\s+export|does\s+it\s+support\s+exporting)\s+(attachments|images|objects|embedded\s+objects)\b/i
]

const FAQ_USAGE_OPENINGS = [
  '如果从“怎么用”来讲，察元AI文档助手的上手方式很直接。',
  '这个软件的使用门槛并不高，通常按几步就能开始。',
  '察元AI文档助手更像一个面向文档场景的工作台，使用方式比较顺手。'
]

const FAQ_USAGE_STEPS = [
  '一般先配置可用模型，然后打开对话框，直接输入你的目标，比如写材料、润色、总结、翻译或审查当前文档。',
  '常见流程是先完成模型连接，再在对话框里描述需求，必要时结合当前选区、全文或附件信息一起处理。',
  '你可以先选中文本或打开当前文档，再在聊天框里说清楚要写什么、改什么、查什么，系统会自动选择合适链路。'
]

const FAQ_USAGE_SCENES = [
  '如果只是普通问答或写作辅助，直接对话即可；如果涉及整篇处理、批注、翻译或格式修改，助手会根据请求走对应流程。',
  '很多场景都不需要记命令，直接自然语言描述即可，比如“帮我总结全文”“把这段翻译成英文”“检查错别字”。',
  '它的设计重点就是少记按钮、多用自然语言，所以你可以把需求尽量说得像在跟同事沟通。'
]

const FAQ_USAGE_CLOSINGS = [
  '对第一次使用的人来说，最简单的开始方式就是先发一段文字，或者直接说一个明确任务。',
  '如果你现在想试用，最推荐先从摘要、润色、翻译、纠错这类高频功能开始。',
  '所以可以把它理解成“先描述任务，再由系统配合文档上下文完成处理”的使用方式。'
]

const FAQ_BUTTON_OPENINGS = [
  '如果你问这个软件有哪些按钮，可以从对话入口和文档入口两部分理解。',
  '这个插件里的按钮和入口并不是单一聊天框，而是围绕文档处理场景分布的。',
  '从界面上看，察元AI文档助手既有对话区，也有和文档操作联动的功能入口。'
]

const FAQ_BUTTON_GROUPS = [
  '常见会包括顶部菜单入口、更多菜单入口、右键菜单入口，以及对话框里的发送、重试、结果写回等交互。',
  '按钮层面通常会覆盖摘要、翻译、文本分析、拼写与语法检查，以及部分图片、语音、视频等扩展能力入口。',
  '除了聊天发送本身，系统里还有助手列表、模型选择、设置、任务进度、参数确认和文档写回等相关操作。'
]

const FAQ_BUTTON_DETAILS = [
  '在具体项目能力里，还能看到保密检查、AI 痕迹检查、表单提取、文档审计、批注解释、结构优化、术语统一等不同功能入口。',
  '如果某类请求需要进一步确认，界面还会动态弹出参数表单、候选操作选择或执行确认，而不是只返回一段文字。',
  '也就是说，这里不是只有固定几个按钮，很多入口会根据请求类型动态出现，更贴近实际文档任务。'
]

const FAQ_BUTTON_CLOSINGS = [
  '最实用的理解方式不是死记按钮名称，而是知道它覆盖了聊天、助手、模型、设置和文档操作几个层面。',
  '如果你需要，我后面也可以继续按“顶部菜单 / 右键菜单 / 对话框内部”这种方式给你分组介绍。',
  '所以它既有显式按钮，也有根据上下文动态出现的操作入口。'
]

const FAQ_CAPABILITY_OPENINGS = [
  '如果从能力范围来说，察元AI文档助手不是只会聊天。',
  '说到支持哪些能力，它更偏向“文档处理工作台”而不是单纯问答机器人。',
  '它的核心能力覆盖的是写作、审阅、分析和文档操作协同。'
]

const FAQ_CAPABILITY_GROUPS = [
  '基础能力包括文档编写、润色优化、改写、总结、翻译、错别字与语法修正、标题生成、术语统一、结构整理等。',
  '分析类能力可以覆盖摘要提炼、批注解释、链接解释、行动项提取、风险分析、会议纪要生成，以及面向文稿质量的 AI 痕迹检查（保守标注、供人工复核）等场景。',
  '如果结合当前项目，还支持保密检查、涉密关键词提取、AI 痕迹检查、表单字段提取、文档审计、报告生成和多模态任务。'
]

const FAQ_CAPABILITY_WPS = [
  '在插件环境里，它还能配合当前选区、全文、批注、插入、替换、追加和部分文档操作流程一起工作。',
  '和普通网页聊天不同，这里更强调与WPS文档上下文联动，所以很多结果可以继续落到文档里；例如 AI 痕迹检查会把疑似片段以批注形式锚在原文上，便于对照修改。',
  '因此它的能力既包括“生成内容”，也包括“结合文档现场继续处理内容”。'
]

const FAQ_CAPABILITY_CLOSINGS = [
  '简单说，它擅长的是把大模型能力整理成一套更适合办公文档的实际功能。',
  '如果你关心的是“能不能直接用于文档工作”，答案是这正是它的重点方向。',
  '所以你可以把它理解成面向文档全流程的AI助手，而不是只负责闲聊。'
]

const FAQ_CAPABILITY_ACTION_HINTS = [
  '如果以上功能还不能完全满足你的要求，你可以直接告诉我你的需要，我可以帮你新建一个更贴合场景的助手。',
  '如果现有这些能力还不够用，你可以继续把需求说清楚，我可以帮你新建助手，把你的流程固定下来。',
  '如果你想要更细、更专门的处理方式，也可以直接告诉我，我可以帮你新建一个专用助手来满足你的需要。'
]

const FAQ_MODEL_OPENINGS = [
  '如果问它和别的模型是什么关系，可以把两者理解成“应用层”和“底层模型层”的关系。',
  '察元AI文档助手和 ChatGPT、Claude、DeepSeek 这类模型，并不是同一个概念。',
  '这个软件本身不是某个单一大模型，而是一层面向文档场景的应用能力封装。'
]

const FAQ_MODEL_RELATIONS = [
  '大模型负责底层理解和生成，察元AI文档助手负责把这些能力组织成适合文档工作的交互、流程和功能入口。',
  '底层模型更像发动机，而察元AI文档助手更像把发动机接入文档场景后的操作台和工作流。',
  '也就是说，模型解决“生成什么”，而本程序更多解决“在什么文档场景下、以什么方式、配合哪些功能去生成和处理”。'
]

const FAQ_MODEL_FLEX = [
  '从设计上看，它可以对接不同模型提供商，而不是把自己等同于 ChatGPT 或某一家模型服务。',
  '因此你问“你是不是某个模型”时，更准确的答案是：我会调用底层模型，但我本身是察元AI文档助手这个应用。',
  '它和别的模型是协作关系，不是替代关系，也不是简单换个壳直接复述模型自我介绍。'
]

const FAQ_MODEL_CLOSINGS = [
  '这也是为什么现在碰到这类问题时，我会优先介绍本程序自己，而不是让底层模型代替我回答身份问题。',
  '所以你可以把它理解成“多模型可接入的文档助手”，而不是某个模型名字本身。',
  '换句话说，模型是能力来源之一，但最终呈现给你的，是察元AI文档助手这套产品能力。'
]

const FAQ_MODEL_SUPPORT_OPENINGS = [
  '如果你问支持哪些模型，察元AI文档助手本身更像一个可接入多模型的文档应用层。',
  '在模型接入上，它不是绑定某一家，而是尽量按提供商配置方式来兼容。',
  '关于模型支持范围，可以把它理解成“程序负责接入，模型负责生成”。'
]

const FAQ_MODEL_SUPPORT_DETAILS = [
  '从当前设计看，它可以对接不同模型提供商和模型清单，而不是只能固定使用某一个大模型。',
  '像 ChatGPT、Claude、DeepSeek、Kimi、Gemini，以及部分兼容 OpenAI 接口或 Ollama 类服务，原则上都属于可接入思路。',
  '具体能否使用，取决于你是否在设置里正确配置了提供商、接口地址、密钥和对应模型。'
]

const FAQ_MODEL_SUPPORT_CLOSINGS = [
  '所以重点不是“它只支持哪一个模型”，而是“它可以把不同模型能力接到文档工作流里”。',
  '更准确地说，这是多模型可接入，而不是把自己等同于某个单模型产品。',
  '如果模型配置正确，它就会按当前接入结果调用对应能力。'
]

const FAQ_MODEL_SETUP_OPENINGS = [
  '如果你问怎么配置模型，通常先去设置页面完成提供商连接。',
  '模型配置这件事，核心不是聊天框里输入命令，而是在设置里把连接信息补全。',
  '关于模型设置，可以理解成先把底层能力接通，再回来使用文档助手。'
]

const FAQ_MODEL_SETUP_STEPS = [
  '一般步骤是先开启对应提供商，再填写 API 地址和 API Key，然后刷新模型清单，最后回到对话框选择可用模型。',
  '如果当前没有可用模型，先进入设置页面，启用提供商、补充接口地址和密钥，再同步或刷新模型列表。',
  '配置完成后，只要列表里出现可用模型，你就可以继续在对话框里发起写作、总结、翻译、审查等请求。'
]

const FAQ_MODEL_SETUP_CLOSINGS = [
  '换句话说，模型配置解决的是“底层能力能不能调用”，而不是产品功能本身是否存在。',
  '一旦模型连通成功，后面的使用方式就会自然很多。',
  '所以先配置模型，再开始正式使用，是最稳的路径。'
]

const FAQ_DOCUMENT_OPENINGS = [
  '如果你关心能不能直接改文档，答案是这正是它和普通聊天页的重要区别之一。',
  '察元AI文档助手并不只会返回一段文本，很多场景下还能继续和当前文档联动。',
  '关于文档写回能力，这个程序本来就是往“对话 + 文档操作”结合的方向设计的。'
]

const FAQ_DOCUMENT_DETAILS = [
  '在不同任务里，它可以支持插入、替换、追加、批注、链接批注，以及围绕选区或全文的处理流程。',
  '像摘要、翻译、纠错、润色、结构优化、批注解释这类结果，都可以进一步选择写回到当前文档。',
  '当然，不是所有请求都会直接改文档，系统会根据任务类型和确认流程决定是仅返回结果，还是继续执行写回。'
]

const FAQ_DOCUMENT_CLOSINGS = [
  '所以它既能聊天，也能把部分结果真正落到文档现场。',
  '这也是它区别于普通网页大模型对话的重要地方。',
  '简单说，支持，而且是围绕文档上下文来支持。'
]

const FAQ_SCENE_OPENINGS = [
  '如果问适合什么场景，察元AI文档助手最适合文档密集型办公场景。',
  '从应用场景看，它更偏向正式文档处理，而不是纯娱乐聊天。',
  '这套产品最适配的是“要围绕文档持续工作”的使用场景。'
]

const FAQ_SCENE_DETAILS = [
  '典型场景包括写通知、写汇报、改方案、做摘要、做翻译、纠错润色、统一术语、生成纪要、做审阅和风险分析。',
  '如果你经常需要处理正文、选区、批注、全文分析、保密检查、AI 痕迹复核、表单抽取或审计类任务，这类场景会比较匹配。',
  '它尤其适合把自然语言需求直接转成文档处理动作，而不是只看一段回答就结束。'
]

const FAQ_SCENE_CLOSINGS = [
  '所以最合适的人群，通常是长期写材料、改材料、审材料的人。',
  '如果你的工作重心就在文档生产和审阅，这类场景会非常贴合。',
  '换句话说，它更适合真实办公文档流，而不是泛化闲聊场景。'
]

const FAQ_FILE_TYPE_OPENINGS = [
  '如果你问支持哪些文件类型，当前项目已经覆盖一批常见文档和附件处理场景。',
  '在文件和附件这块，它并不是只看纯文本输入。',
  '关于支持的格式，可以理解成“文档上下文 + 常见附件解析 + 结构化输出”三部分。'
]

const FAQ_FILE_TYPE_DETAILS = [
  '从现有代码能力看，已经涉及 PDF、DOCX、XLSX、CSV、JSON、Markdown、TXT 等常见文本或结构化格式处理能力。',
  '另外它也支持围绕当前文档正文、选中内容、附件引用、导出图片和导出文档对象等相关流程。',
  '不过不同格式的处理深度并不完全一样，文本类和结构化类通常更稳定，复杂版式或特殊嵌入对象则要结合具体场景判断。'
]

const FAQ_FILE_TYPE_CLOSINGS = [
  '所以保守地说，常见办公文档和文本附件是当前重点支持方向。',
  '如果你有特定文件格式要长期处理，也可以进一步做成专用助手。',
  '最稳的说法是：支持不少常见格式，但具体效果仍取决于该格式在当前链路中的解析深度。'
]

const FAQ_DOCUMENT_OBJECT_OPENINGS = [
  '如果你问支持哪些文档对象，这个项目的能力范围比单纯文本要更广一些。',
  '关于文档对象和元素支持范围，当前项目已经覆盖了多类常见办公对象。',
  '这类问题更适合按“文档现场里能感知和能处理什么”来回答。'
]

const FAQ_DOCUMENT_OBJECT_DETAILS = [
  '从现有实现看，已经明确覆盖了选区、段落、全文、表格、单元格、图片、批注、超链接，以及导出图片和嵌入对象附件这类流程。',
  '也就是说，程序不只是识别纯文字，还能围绕表格内容、批注内容、链接说明、文档图片和对象附件等元素做分析或处理。',
  '如果再往细一点说，当前更成熟的是文本段落、表格单元格、批注、链接、图片导出和对象提取这些链路，复杂版式或特殊控件则要结合具体文档判断。'
]

const FAQ_DOCUMENT_OBJECT_CLOSINGS = [
  '所以你可以把它理解成“支持多类文档对象协同处理”，而不是只接一段文本做聊天。',
  '保守地说，常见文档元素已经覆盖得比较完整，但不同对象的处理深度会有差异。',
  '如果你想长期围绕某一类对象做固定处理，也可以继续做成专用助手。'
]

const FAQ_NETWORK_OPENINGS = [
  '如果你问需不需要联网，答案要分“本地问答”和“模型调用”两部分来看。',
  '关于联网与上传，不能一概而论，要看你当前走的是本地逻辑还是模型能力。',
  '这个问题的关键在于：产品本身有本地逻辑，但模型调用是否联网取决于你的配置。'
]

const FAQ_NETWORK_DETAILS = [
  '像现在这类本地 FAQ、规则判断和部分本地状态存储，本身并不需要把问题发给大模型。',
  '但当你真正发起模型生成、翻译、总结或分析请求时，内容通常会发送给你当前配置的模型服务，无论那是云端提供商还是本地兼容服务。',
  '如果你接的是本地模型或本地兼容服务，例如本地部署链路，那么联网依赖会低很多；如果接的是在线模型服务，则需要网络。'
]

const FAQ_NETWORK_CLOSINGS = [
  '所以并不是所有功能都一定联网，但真正的模型能力调用通常要看你连接的是哪种模型服务。',
  '更准确地说，产品支持本地逻辑和不同模型接入方式，而不是简单固定成“全离线”或“全在线”。',
  '如果你对联网边界特别敏感，建议重点查看当前模型配置和你实际接入的提供商。'
]

const FAQ_SECURITY_OPENINGS = [
  '如果你关心数据安全，答案也要分本地存储、模型调用和功能用途三部分来看。',
  '关于安全和隐私，这个产品本身已经包含本地存储逻辑和保密检查相关能力，但模型调用边界仍要单独看。',
  '这个问题不能只回答一句“安全”或“不安全”，更需要说清楚数据流向。'
]

const FAQ_SECURITY_DETAILS = [
  '从当前代码看，部分配置、草稿、历史记录和预填信息会保存在本地存储或插件存储中，用于维持界面状态和功能体验。',
  '而当你真正提交模型请求时，输入内容可能会发送给你配置的模型服务，所以安全边界与所选提供商、接口地址和部署方式直接相关。',
  '项目里同时也有保密检查、审计分析、涉密关键词提取等能力，说明它在产品方向上已经考虑到敏感文档场景，但最终仍建议按你的部署和合规要求使用。'
]

const FAQ_SECURITY_CLOSINGS = [
  '因此最准确的说法是：本地状态有本地存储，模型请求按你的模型配置走，安全性不能脱离实际接入方式来谈。',
  '如果你在处理敏感内容，建议优先结合本地部署或受控模型服务，并使用现有的保密检查能力做辅助把关。',
  '换句话说，产品本身提供了安全相关能力，但最终数据边界仍取决于你怎么配置和部署。'
]

const FAQ_PROJECT_INFO_OPENINGS = [
  '如果你问这个项目本身的信息，可以直接按产品层来理解。',
  '这类问题属于产品背景信息，不需要交给大模型回答。',
  '关于项目归属、开发方和是否开源免费，这些都应该由程序自己来说明。'
]

const FAQ_PROJECT_INFO_DETAILS = [
  '察元AI文档助手由北京智灵鸟科技中心开发，定位是面向文档处理与办公写作场景的智能助手。',
  '它强调开源免费和实用优先，重点是把大模型能力真正落到文档工作流里。',
  '所以当你问“谁开发的”“是否免费”“是否开源”时，回答的对象应该是本程序，而不是底层模型。'
]

const FAQ_PROJECT_INFO_CLOSINGS = [
  '简单说，它是察元AI文档助手，不是某个大模型自己在介绍自己。',
  '如果你继续追问功能边界、模型关系或怎么使用，我也会优先按产品事实来回答。',
  '这也是为什么现在这些产品背景问题都会直接走本地问答。'
]

const FAQ_EXPORT_OPENINGS = [
  '如果你问能不能导出附件、图片或对象，这类需求在当前项目里是有相关能力覆盖的。',
  '关于附件和对象导出，项目并不只是做文本生成，也支持部分文档资源导出流程。',
  '这类问题属于实际文档对象处理能力，不是泛泛的产品介绍。'
]

const FAQ_EXPORT_DETAILS = [
  '从现有实现看，已经包含导出文档图片、导出嵌入对象、对象附件提取等相关链路。',
  '也就是说，像文档中的图片、附件对象、嵌入对象或 OLE 类内容，当前项目是有能力按对应流程处理的。',
  '不过具体可导出的范围和效果，仍要看当前文档里对象本身的类型以及 WPS 环境对该对象的支持程度。'
]

const FAQ_EXPORT_CLOSINGS = [
  '保守地说，这类能力是支持的，而且已经属于现有项目功能的一部分。',
  '如果你经常做这类提取导出，也可以进一步做成专用助手或固定流程。',
  '所以答案不是简单的“理论上可以”，而是当前代码里已经有实际导出链路。'
]

function pickRandom(items) {
  if (!Array.isArray(items) || items.length === 0) return ''
  return items[Math.floor(Math.random() * items.length)] || ''
}

function includesAny(text, keywords) {
  return keywords.some(keyword => text.includes(keyword))
}

function normalizeLooseText(text) {
  return String(text || '')
    .replace(/[“”"‘’'`~!@#$%^&*()_+\-=[\]{}\\|;:,.<>/?，。！？；：、（）【】《》\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function normalizeCompactText(text) {
  return normalizeLooseText(text).replace(/\s+/g, '')
}

function buildAssistantIdentityQuestionSet() {
  const set = new Set()
  const add = (text) => {
    const normalized = normalizeCompactText(text)
    if (normalized) set.add(normalized)
  }

  CN_PREFIXES.forEach((prefix) => {
    CN_ASSISTANT_SUBJECTS.forEach((subject) => {
      CN_SUFFIXES.forEach((suffix) => {
        CN_IDENTITY_PREDICATES.forEach((predicate) => {
          add(`${prefix}${subject}${predicate}${suffix}`)
        })
        CN_CAPABILITY_PREDICATES.forEach((predicate) => {
          add(`${prefix}${subject}${predicate}${suffix}`)
        })
        CN_ORIGIN_PREDICATES.forEach((predicate) => {
          add(`${prefix}${subject}${predicate}${suffix}`)
        })
        CN_INTRO_VERBS.forEach((verb) => {
          add(`${prefix}${verb}${subject}${suffix}`)
        })
        CN_MODEL_NAMES.forEach((modelName) => {
          add(`${prefix}${subject}是${modelName}吗${suffix}`)
          add(`${prefix}${subject}是不是${modelName}${suffix}`)
        })
      })
    })
  })

  EN_PREFIXES.forEach((prefix) => {
    EN_QUESTIONS.forEach((question) => {
      EN_SUFFIXES.forEach((suffix) => {
        add(`${prefix}${question}${suffix}`)
      })
    })
  })

  return set
}

const ASSISTANT_IDENTITY_QUESTION_SET = buildAssistantIdentityQuestionSet()

function isAssistantIdentityQuestionBySemantic(normalizedLoose, normalizedCompact) {
  const hasAssistantSubject = includesAny(normalizedLoose, ASSISTANT_SUBJECT_HINTS)
  const asksIntro = includesAny(normalizedLoose, INTRO_HINTS)
  const asksIdentity = includesAny(normalizedLoose, IDENTITY_HINTS)
  const asksCapability = includesAny(normalizedLoose, CAPABILITY_HINTS)
  const asksUsage = includesAny(normalizedLoose, USAGE_HINTS)
  const asksModelIdentity = CN_MODEL_NAMES.some((modelName) => normalizedLoose.includes(String(modelName).toLowerCase())) &&
    /(是|是不是|属于|算|are you|is this)/i.test(normalizedLoose)

  if (asksModelIdentity) return true
  if (ASSISTANT_IDENTITY_QUESTION_SET.has(normalizedCompact)) return true
  if (hasAssistantSubject && (asksIntro || asksIdentity || asksCapability || asksUsage)) return true
  if ((asksIntro || asksIdentity || asksCapability) && /(软件|程序|工具|插件|助手|app|tool|program|assistant|plugin)/.test(normalizedLoose)) return true
  return false
}

export const ASSISTANT_IDENTITY_QUESTION_VARIANT_COUNT = ASSISTANT_IDENTITY_QUESTION_SET.size

export function isAssistantIdentityQuestion(text = '') {
  const normalizedLoose = normalizeLooseText(text)
  const normalizedCompact = normalizeCompactText(text)
  if (!normalizedLoose) return false
  if (NEGATIVE_PATTERNS.some(pattern => pattern.test(String(text || '')))) return false
  if (DIRECT_IDENTITY_PATTERNS.some(pattern => pattern.test(String(text || '')))) return true
  return isAssistantIdentityQuestionBySemantic(normalizedLoose, normalizedCompact)
}

export function buildRandomAssistantSelfIntro() {
  const paragraphs = [
    [
      pickRandom(INTRO_OPENINGS),
      pickRandom(INTRO_IDENTITIES),
      pickRandom(INTRO_VALUES)
    ].filter(Boolean).join(''),
    [
      pickRandom(INTRO_FEATURE_GROUPS),
      pickRandom(INTRO_PROJECT_FEATURES),
      pickRandom(INTRO_WPS_FEATURES)
    ].filter(Boolean).join(''),
    pickRandom(INTRO_CLOSINGS)
  ].filter(Boolean)
  return paragraphs.join('\n\n')
}

function buildRandomUsageFaqAnswer() {
  return [
    pickRandom(FAQ_USAGE_OPENINGS),
    pickRandom(INTRO_IDENTITIES),
    pickRandom(FAQ_USAGE_STEPS),
    pickRandom(FAQ_USAGE_SCENES),
    pickRandom(FAQ_USAGE_CLOSINGS)
  ].filter(Boolean).join('')
}

function buildRandomButtonFaqAnswer() {
  return [
    pickRandom(FAQ_BUTTON_OPENINGS),
    pickRandom(FAQ_BUTTON_GROUPS),
    pickRandom(FAQ_BUTTON_DETAILS),
    pickRandom(FAQ_BUTTON_CLOSINGS)
  ].filter(Boolean).join('')
}

function buildRandomCapabilityFaqAnswer() {
  return [
    pickRandom(FAQ_CAPABILITY_OPENINGS),
    pickRandom(INTRO_VALUES),
    pickRandom(FAQ_CAPABILITY_GROUPS),
    pickRandom(FAQ_CAPABILITY_WPS),
    pickRandom(FAQ_CAPABILITY_CLOSINGS),
    pickRandom(FAQ_CAPABILITY_ACTION_HINTS)
  ].filter(Boolean).join('')
}

function buildRandomModelRelationFaqAnswer() {
  return [
    pickRandom(FAQ_MODEL_OPENINGS),
    pickRandom(FAQ_MODEL_RELATIONS),
    pickRandom(FAQ_MODEL_FLEX),
    pickRandom(FAQ_MODEL_CLOSINGS)
  ].filter(Boolean).join('')
}

function buildRandomModelSupportFaqAnswer() {
  return [
    pickRandom(FAQ_MODEL_SUPPORT_OPENINGS),
    pickRandom(FAQ_MODEL_SUPPORT_DETAILS),
    pickRandom(FAQ_MODEL_SUPPORT_CLOSINGS)
  ].filter(Boolean).join('')
}

function buildRandomModelSetupFaqAnswer() {
  return [
    pickRandom(FAQ_MODEL_SETUP_OPENINGS),
    pickRandom(FAQ_MODEL_SETUP_STEPS),
    pickRandom(FAQ_MODEL_SETUP_CLOSINGS)
  ].filter(Boolean).join('')
}

function buildRandomDocumentOperationFaqAnswer() {
  return [
    pickRandom(FAQ_DOCUMENT_OPENINGS),
    pickRandom(FAQ_DOCUMENT_DETAILS),
    pickRandom(FAQ_DOCUMENT_CLOSINGS)
  ].filter(Boolean).join('')
}

function buildRandomSceneFaqAnswer() {
  return [
    pickRandom(FAQ_SCENE_OPENINGS),
    pickRandom(FAQ_SCENE_DETAILS),
    pickRandom(FAQ_SCENE_CLOSINGS)
  ].filter(Boolean).join('')
}

function buildRandomFileTypeFaqAnswer() {
  return [
    pickRandom(FAQ_FILE_TYPE_OPENINGS),
    pickRandom(FAQ_FILE_TYPE_DETAILS),
    pickRandom(FAQ_FILE_TYPE_CLOSINGS)
  ].filter(Boolean).join('')
}

function buildRandomDocumentObjectFaqAnswer() {
  return [
    pickRandom(FAQ_DOCUMENT_OBJECT_OPENINGS),
    pickRandom(FAQ_DOCUMENT_OBJECT_DETAILS),
    pickRandom(FAQ_DOCUMENT_OBJECT_CLOSINGS)
  ].filter(Boolean).join('')
}

function buildRandomNetworkFaqAnswer() {
  return [
    pickRandom(FAQ_NETWORK_OPENINGS),
    pickRandom(FAQ_NETWORK_DETAILS),
    pickRandom(FAQ_NETWORK_CLOSINGS)
  ].filter(Boolean).join('')
}

function buildRandomSecurityFaqAnswer() {
  return [
    pickRandom(FAQ_SECURITY_OPENINGS),
    pickRandom(FAQ_SECURITY_DETAILS),
    pickRandom(FAQ_SECURITY_CLOSINGS)
  ].filter(Boolean).join('')
}

function buildRandomProjectInfoFaqAnswer() {
  return [
    pickRandom(FAQ_PROJECT_INFO_OPENINGS),
    pickRandom(FAQ_PROJECT_INFO_DETAILS),
    pickRandom(FAQ_PROJECT_INFO_CLOSINGS)
  ].filter(Boolean).join('')
}

function buildRandomExportFaqAnswer() {
  return [
    pickRandom(FAQ_EXPORT_OPENINGS),
    pickRandom(FAQ_EXPORT_DETAILS),
    pickRandom(FAQ_EXPORT_CLOSINGS)
  ].filter(Boolean).join('')
}

function createLocalFaqSuggestedAction(type, overrides = {}) {
  return {
    type,
    label: '查看相关功能入口',
    viewLabel: '查看助手列表',
    dismissLabel: '暂不需要',
    ...overrides
  }
}

export function resolveAssistantLocalFaq(text = '') {
  const raw = String(text || '')
  const normalizedLoose = normalizeLooseText(raw)
  if (!normalizedLoose) return null
  if (NEGATIVE_PATTERNS.some(pattern => pattern.test(raw))) return null

  if (FAQ_USAGE_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'usage',
      title: '使用说明',
      detail: '本次将直接返回本程序的本地使用说明，不再请求大模型。',
      reason: '已识别为产品使用方式问答，直接返回本地FAQ。',
      text: buildRandomUsageFaqAnswer(),
      suggestedAction: createLocalFaqSuggestedAction('open-assistants-sidebar', {
        label: '查看使用入口'
      })
    }
  }

  if (FAQ_BUTTON_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'buttons',
      title: '功能入口说明',
      detail: '本次将直接返回本程序的功能入口介绍，不再请求大模型。',
      reason: '已识别为产品按钮/菜单问答，直接返回本地FAQ。',
      text: buildRandomButtonFaqAnswer(),
      suggestedAction: createLocalFaqSuggestedAction('open-assistants-sidebar', {
        label: '查看常用入口'
      })
    }
  }

  if (FAQ_CAPABILITY_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'capabilities',
      title: '能力说明',
      detail: '本次将直接返回本程序的能力介绍，不再请求大模型。',
      reason: '已识别为产品能力问答，直接返回本地FAQ。',
      text: buildRandomCapabilityFaqAnswer(),
      existingAssistantHints: ['summary', 'translate', 'analysis.rewrite', 'analysis.security-check', 'analysis.ai-trace-check'],
      suggestedAction: createLocalFaqSuggestedAction('open-assistants-sidebar', {
        label: '查看能力入口'
      })
    }
  }

  if (FAQ_MODEL_RELATION_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'model-relation',
      title: '模型关系说明',
      detail: '本次将直接返回本程序与底层模型的关系说明，不再请求大模型。',
      reason: '已识别为产品与模型关系问答，直接返回本地FAQ。',
      text: buildRandomModelRelationFaqAnswer(),
      suggestedAction: createLocalFaqSuggestedAction('open-model-settings', {
        label: '去看模型设置',
        viewLabel: '查看助手列表'
      })
    }
  }

  if (FAQ_MODEL_SUPPORT_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'model-support',
      title: '模型支持说明',
      detail: '本次将直接返回本程序的模型支持说明，不再请求大模型。',
      reason: '已识别为产品模型支持问答，直接返回本地FAQ。',
      text: buildRandomModelSupportFaqAnswer(),
      suggestedAction: createLocalFaqSuggestedAction('open-model-settings', {
        label: '去模型设置',
        viewLabel: '查看助手列表'
      })
    }
  }

  if (FAQ_MODEL_SETUP_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'model-setup',
      title: '模型配置说明',
      detail: '本次将直接返回本程序的模型配置说明，不再请求大模型。',
      reason: '已识别为产品模型配置问答，直接返回本地FAQ。',
      text: buildRandomModelSetupFaqAnswer(),
      suggestedAction: createLocalFaqSuggestedAction('open-model-settings', {
        label: '去模型设置',
        viewLabel: '查看助手列表'
      })
    }
  }

  if (FAQ_DOCUMENT_OPERATION_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'document-operation',
      title: '文档写回说明',
      detail: '本次将直接返回本程序的文档写回能力说明，不再请求大模型。',
      reason: '已识别为产品文档操作问答，直接返回本地FAQ。',
      text: buildRandomDocumentOperationFaqAnswer(),
      capabilityCategory: 'document-operation',
      existingAssistantHints: ['analysis.rewrite', 'analysis.correct-spell', 'analysis.polish'],
      suggestedAction: createLocalFaqSuggestedAction('open-assistants-sidebar', {
        label: '查看文档处理入口'
      })
    }
  }

  if (FAQ_SCENE_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'scenes',
      title: '适用场景说明',
      detail: '本次将直接返回本程序的适用场景说明，不再请求大模型。',
      reason: '已识别为产品适用场景问答，直接返回本地FAQ。',
      text: buildRandomSceneFaqAnswer(),
      suggestedAction: createLocalFaqSuggestedAction('open-assistants-sidebar', {
        label: '查看适用助手'
      })
    }
  }

  if (FAQ_FILE_TYPE_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'file-types',
      title: '文件类型说明',
      detail: '本次将直接返回本程序的文件与附件支持说明，不再请求大模型。',
      reason: '已识别为产品文件类型问答，直接返回本地FAQ。',
      text: buildRandomFileTypeFaqAnswer(),
      suggestedAction: createLocalFaqSuggestedAction('open-assistants-sidebar', {
        label: '查看附件处理入口'
      })
    }
  }

  if (FAQ_DOCUMENT_OBJECT_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'document-objects',
      title: '文档对象说明',
      detail: '本次将直接返回本程序的文档对象与元素支持说明，不再请求大模型。',
      reason: '已识别为产品文档对象问答，直接返回本地FAQ。',
      text: buildRandomDocumentObjectFaqAnswer(),
      suggestedAction: createLocalFaqSuggestedAction('open-assistants-sidebar', {
        label: '查看对象处理入口'
      })
    }
  }

  if (FAQ_NETWORK_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'network',
      title: '联网与上传说明',
      detail: '本次将直接返回本程序的联网与上传边界说明，不再请求大模型。',
      reason: '已识别为产品联网/上传问答，直接返回本地FAQ。',
      text: buildRandomNetworkFaqAnswer(),
      suggestedAction: createLocalFaqSuggestedAction('open-model-settings', {
        label: '查看模型与联网设置',
        viewLabel: '查看助手列表'
      })
    }
  }

  if (FAQ_SECURITY_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'security',
      title: '数据与安全说明',
      detail: '本次将直接返回本程序的数据与安全说明，不再请求大模型。',
      reason: '已识别为产品安全与隐私问答，直接返回本地FAQ。',
      text: buildRandomSecurityFaqAnswer(),
      capabilityCategory: 'security-audit',
      existingAssistantHints: ['analysis.security-check'],
      suggestedAction: createLocalFaqSuggestedAction('open-assistant-settings', {
        label: '查看保密检查入口',
        targetItemKey: 'analysis.security-check',
        viewLabel: '查看助手列表'
      })
    }
  }

  if (FAQ_PROJECT_INFO_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'project-info',
      title: '项目背景说明',
      detail: '本次将直接返回本程序的背景信息，不再请求大模型。',
      reason: '已识别为产品背景问答，直接返回本地FAQ。',
      text: buildRandomProjectInfoFaqAnswer(),
      suggestedAction: createLocalFaqSuggestedAction('open-assistants-sidebar', {
        label: '查看产品能力入口'
      })
    }
  }

  if (FAQ_EXPORT_PATTERNS.some(pattern => pattern.test(raw))) {
    return {
      type: 'export-support',
      title: '导出能力说明',
      detail: '本次将直接返回本程序的附件与对象导出能力说明，不再请求大模型。',
      reason: '已识别为产品导出能力问答，直接返回本地FAQ。',
      text: buildRandomExportFaqAnswer(),
      suggestedAction: createLocalFaqSuggestedAction('open-assistants-sidebar', {
        label: '查看导出能力入口'
      })
    }
  }

  const capabilityFaq = resolveAssistantCapabilityFaq(raw)
  if (capabilityFaq) {
    return capabilityFaq
  }

  if (isAssistantIdentityQuestion(raw)) {
    return {
      type: 'identity',
      title: '助手介绍',
      detail: '本次将直接介绍察元AI文档助手，不再请求大模型自我介绍。',
      reason: '已识别为助手身份介绍请求，直接返回本程序介绍。',
      text: buildRandomAssistantSelfIntro()
    }
  }

  return null
}
