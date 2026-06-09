/**
 * builtinAssistantsTech — 「IT/技术文档」领域助手包(批5)
 * 生成类默认插入、核查类批注。约束:保持代码/标识符/版本号原样,不臆造 API/参数。
 */
const INPUT_SOURCE_SELECTION_PREFERRED = 'selection-preferred'
const INPUT_SOURCE_DOCUMENT = 'document'
const DOMAIN = 'tech'
const GEN_RULES = `通用约束:保持代码、标识符、路径、版本号、命令原样不改;不臆造不存在的 API/参数/字段;术语用业界通用写法;直接输出结果。`

const base = (extra) => ({
  group: 'analysis', domain: DOMAIN, modelType: 'chat', defaultModelCategory: 'chat',
  supportsRibbon: false, defaultDisplayLocations: ['ribbon-more'],
  defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED, defaultOutputFormat: 'markdown', temperature: 0.3, ...extra
})

export const TECH_BUILTIN_ASSISTANTS = Object.freeze([
  base({ id: 'analysis.tech-code-comment', label: '代码注释生成', shortLabel: '代码注释', icon: '💻',
    tags: ['技术', '生成', '代码'], allowedActions: ['replace', 'insert', 'comment', 'none'], defaultAction: 'insert',
    description: '为选中代码生成清晰注释:函数说明、参数、返回、关键逻辑,不改动代码本身。',
    systemPrompt: `你是一位资深工程师,为代码写准确、必要、不啰嗦的注释。只加注释,不改代码逻辑。${GEN_RULES}`,
    userPromptTemplate: `请为下面代码生成注释:函数/类用途、参数与返回说明、关键或易错逻辑处的行内注释。保持代码原样,只补注释。\n代码:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.tech-api-doc', label: 'API文档生成', shortLabel: 'API文档', icon: '🔌',
    tags: ['技术', '生成', 'API'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把接口定义/代码整理成规范 API 文档:路径、方法、参数、返回、示例、错误码。',
    systemPrompt: `你是一位技术文档工程师,产出规范、可读的 API 文档。只依据给定信息,字段/参数不臆造,缺失标【待补充】。${GEN_RULES}`,
    userPromptTemplate: `请把下面接口信息整理成 API 文档:接口说明、请求方法与路径、请求参数(名/类型/必填/说明)、返回结构、请求/响应示例、错误码。缺失处用【待补充】。\n接口信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.tech-readme', label: 'README生成', shortLabel: 'README生成', icon: '📘',
    tags: ['技术', '生成', '文档'], allowedActions: ['insert', 'append', 'replace', 'none'], defaultAction: 'insert',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据项目信息生成规范 README:简介、特性、安装、使用、配置、目录结构。',
    systemPrompt: `你是一位开源维护者,写清晰、实用的 README。只依据给定信息,命令/依赖不臆造,缺失标【待补充】。${GEN_RULES}`,
    userPromptTemplate: `请根据下面项目信息生成 README:项目简介、核心特性、安装步骤、快速开始(代码示例)、配置说明、目录结构。缺失处用【待补充】。\n项目信息:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.tech-prd', label: 'PRD框架生成', shortLabel: 'PRD框架', icon: '📐',
    tags: ['技术', '生成', '产品'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert',
    defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '把需求要点搭成 PRD 框架:背景、目标、用户故事、功能需求、流程、边界、指标。',
    systemPrompt: '你是一位产品经理,搭建结构完整的 PRD 框架。基于给定需求,缺信息用【待补充】占位,不编造数据指标。',
    userPromptTemplate: `请把下面需求搭成 PRD 框架:背景与目标、目标用户、用户故事、功能需求(分条,含优先级)、主流程、边界与非目标、成功指标。缺失处用【待补充】。\n需求:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.tech-testcase', label: '测试用例生成', shortLabel: '测试用例', icon: '🧪',
    tags: ['技术', '生成', '测试'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '根据需求/接口生成测试用例:正常、边界、异常场景,含前置条件、步骤、预期。',
    systemPrompt: `你是一位测试工程师,设计覆盖正常/边界/异常的测试用例。只依据给定需求,不臆造接口行为。${GEN_RULES}`,
    userPromptTemplate: `请根据下面需求/接口生成测试用例,表格:用例编号 | 场景类型(正常/边界/异常) | 前置条件 | 步骤 | 预期结果。覆盖边界和异常。\n需求/接口:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.tech-bug-report', label: 'Bug报告规范', shortLabel: 'Bug报告', icon: '🐞',
    tags: ['技术', '改写', '缺陷'], allowedActions: ['replace', 'insert', 'append', 'none'], defaultAction: 'insert',
    description: '把零散的问题描述整理成规范 Bug 报告:复现步骤、预期、实际、环境、严重级别。',
    systemPrompt: '你是一位 QA,把问题描述整理成可复现、要素齐全的 Bug 报告。只依据给定信息,缺失项标【待补充】。',
    userPromptTemplate: `请把下面问题整理成规范 Bug 报告:标题、复现步骤(编号)、预期结果、实际结果、环境(版本/系统/设备)、严重级别、附加信息。缺失处【待补充】。\n问题描述:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.tech-changelog', label: '变更日志生成', shortLabel: '变更日志', icon: '📜',
    tags: ['技术', '生成', '发布'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert',
    defaultInputSource: INPUT_SOURCE_DOCUMENT,
    description: '把提交记录/改动要点整理成规范 changelog,按新增/修复/优化/破坏性变更分类。',
    systemPrompt: '你是一位发布负责人,整理面向用户的 changelog。只依据给定改动,不夸大、不编造未做的功能。',
    userPromptTemplate: `请把下面改动整理成 changelog,按类别分组:✨ 新增 / 🐛 修复 / ⚡ 优化 / ⚠️ 破坏性变更。每条简洁、面向用户。\n改动:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.tech-design-doc', label: '技术方案框架', shortLabel: '技术方案', icon: '🏗️',
    tags: ['技术', '生成', '设计'], allowedActions: ['insert', 'append', 'none'], defaultAction: 'insert',
    defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.4,
    description: '把技术问题搭成方案设计框架:背景、目标、方案对比、选型、风险、里程碑。',
    systemPrompt: '你是一位架构师,搭建技术方案设计框架。基于给定问题,方案对比要点客观,缺信息用【待补充】。',
    userPromptTemplate: `请把下面问题搭成技术方案框架:背景与目标、约束、候选方案(2-3个,各列优缺点)、推荐选型及理由、风险与应对、里程碑。缺失处【待补充】。\n问题:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.tech-commit-msg', label: 'commit信息规范', shortLabel: 'commit信息', icon: '🔧',
    tags: ['技术', '改写', 'git'], allowedActions: ['replace', 'insert', 'append', 'none'], defaultAction: 'replace',
    description: '把改动描述写成规范 commit message(Conventional Commits:type(scope): subject + body)。',
    systemPrompt: '你是一位工程师,写符合 Conventional Commits 规范的提交信息。只依据给定改动,简洁准确。',
    userPromptTemplate: `请把下面改动写成规范 commit message:首行 type(scope): 简述(祈使句、不超50字),空行后 body 说明动机与影响。type 用 feat/fix/docs/refactor/perf/test/chore。\n改动:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.tech-error-explain', label: '错误信息解释', shortLabel: '错误解释', icon: '🚨',
    tags: ['技术', '分析', '排错'], allowedActions: ['comment', 'append', 'insert', 'none'], defaultAction: 'comment',
    description: '解释报错/堆栈含义、可能原因和排查方向,帮助快速定位,不臆断具体修复。',
    systemPrompt: '你是一位经验丰富的工程师,解释错误信息并给排查方向。基于给定报错分析,不确定的列为"可能原因",不编造具体行号事实。',
    userPromptTemplate: `请解释下面错误/堆栈:\n## 这个错误在说什么\n## 可能的原因(按可能性排序)\n## 排查方向/建议动作\n报错:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.tech-api-fields', label: '接口字段说明', shortLabel: '接口字段', icon: '🗃️',
    tags: ['技术', '生成', '数据'], allowedActions: ['insert', 'append', 'comment', 'none'], defaultAction: 'insert',
    defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.2,
    description: '为 JSON/数据结构逐字段生成说明表:字段名、类型、含义、是否必填、示例。',
    systemPrompt: `你是一位接口文档工程师,为数据结构逐字段写说明。字段名/类型保持原样,含义基于给定信息,不臆造。${GEN_RULES}`,
    userPromptTemplate: `请为下面 JSON/数据结构生成字段说明表:字段名 | 类型 | 含义 | 必填 | 示例值。含义不明确的标"待确认"。\n数据结构:\n---\n{{input}}\n---` }),
  base({ id: 'analysis.tech-term-unify', label: '技术术语统一检查', shortLabel: '技术术语检查', icon: '🔤',
    tags: ['技术', '核查', '术语'], allowedActions: ['comment', 'link-comment', 'append', 'none'], defaultAction: 'comment',
    defaultInputSource: INPUT_SOURCE_DOCUMENT, temperature: 0.1,
    description: '检查技术文档中术语/大小写/命名是否统一(如 JavaScript vs javascript、API vs api)。',
    systemPrompt: '你是一位技术文档校核员,检查术语拼写、大小写、命名是否统一。命中片段原文逐字、反引号包裹;只标真不一致。',
    userPromptTemplate: `请检查下面技术文档中术语/命名是否统一,关注:专有名词大小写(JavaScript/GitHub/iOS)、同一概念多种叫法、缩写与全称混用。\n## 不一致项 (若无写"未发现明显问题")\n- 不同写法:\`写法1\` / \`写法2\`\n- 建议统一为:\n文档:\n---\n{{input}}\n---` })
])

export function mergeTechIntoBuiltins(base = []) {
  const ids = new Set(base.map((it) => it && it.id))
  return [...base, ...TECH_BUILTIN_ASSISTANTS.filter((it) => it && !ids.has(it.id))]
}
export default { TECH_BUILTIN_ASSISTANTS, mergeTechIntoBuiltins }
