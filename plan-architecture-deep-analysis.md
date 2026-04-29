# 察元 WPS 加载项架构深度分析与重构计划

日期：2026-04-29

## 1. 结论摘要

本项目已经不是一个简单的 WPS 加载项，而是一个运行在 WPS WebView/加载项环境里的「AI 文档操作平台」。当前代码中已经具备模型配置、AI 对话、文档处理、助手系统、任务中心、工作流编排、自动进化、市场/推荐、性能监控等能力雏形，但核心问题是：能力增长主要靠在 `AIAssistantDialog.vue`、`SettingsDialog.vue` 和若干 runner 里继续叠加分支，导致发送链路、长文档处理、助手配置、推荐和 WPS 操作之间耦合过高。

最优方向不是简单替换技术栈，而是把现有项目重构为「WPS Host Adapter + AI Gateway + Router + Task Engine + Document Intelligence + Assistant Studio + UI Shell」七个清晰子系统。前端仍可继续使用 Vue 3 + Vite，但需要把巨型组件中的业务决策、模型调用、文档上下文、任务编排和 UI 展示拆开。

点击发送后“寻找链路慢”的直接原因是：普通聊天在真正流式回复前会串行执行主意图模型路由；命中文档、生成文件、助手任务后还可能再执行文档操作路由、生成输出路由、助手推荐路由；同时还会读取全文、构造上下文、保存历史、多次刷新 UI。项目里已经有 `localIntentClassifier`、`enhancedSend`、`perfTracker`、`enhancedChatApi` 等优化工具，但目前更多是 opt-in 骨架，没有真正成为主发送链路的默认路径。

超长文档和“10000 字成语统计不准”不应只靠大模型上下文解决。大模型不能保证精确计数、不能保证对超长输入逐字无遗漏。正确架构是把精确任务交给本地确定性工具，语义任务交给 LLM，长文档任务走分块、覆盖率账本、结构化输出、二次校验和最终汇总。

## 2. 当前技术栈

### 前端与运行时

- Vue 3 + Vue Router 4 + Vite 5，Hash 路由，适配 WPS 加载项环境。
- WPS JSAPI / `wpsjs`，通过 `window.Application`、`window.opener.Application`、`window.parent.Application` 访问 WPS 宿主。
- 主要页面为组件路由：AI 助手、设置、任务中心、工作流、进化中心、市场、性能监控、规则库、模板与文档处理对话框。
- 样式主要是普通 CSS 与多份全局增强样式，没有引入组件库。

### AI 与文档处理

- LLM 接口采用 OpenAI 兼容 `/chat/completions`，支持流式与非流式。
- 模型配置支持 provider + modelId，也兼容旧 ribbonModelId。
- 文档操作通过 WPS COM/JSAPI 对 `ActiveDocument`、`Selection`、`Range`、`Comments`、`Content.Text` 操作。
- 长文档已有 `documentChunker`、`chunkSettings`、结构化分批、文档修订、报告生成等能力，但普通对话和文档任务之间尚未形成统一的 Document Intelligence 层。

### 数据与任务

- 设置使用 `settings.json` 文件、`localStorage`、`PluginStorage` 多级持久化。
- 任务系统已有 `taskKernel`、任务列表、任务中心、进度广播、成就和时间胶囊等模块。
- 工作流使用 `@vue-flow/core` 生态，已有节点、子工作流、LLM 节点、try-catch 等基础。
- 自动进化已有 SignalStore、评估、回滚、shadow runner、promotion flow 等模块雏形。

## 3. 七大链路重新定义

建议将项目稳定成以下七大链路，每条链路有独立边界、独立数据契约和独立性能指标。

1. WPS 操作链路：保存、插入、替换、批注、格式、表格、导出、加密、脱密等确定性宿主操作。
2. AI 对话链路：普通问答、写作、解释、文档问答、附件问答、流式回复。
3. 助手执行链路：内置助手、自定义助手、输入范围、输出格式、文档写回动作、任务进度。
4. 工具与工作流链路：工具调用、节点编排、子工作流、重试、暂停、人工确认、结果回放。
5. 文档智能链路：文档读取、分块、索引、RAG、摘要、抽取、精确统计、长文档汇总、覆盖率校验。
6. 自动进化链路：信号采集、评估集、shadow run、A/B、版本晋升、回滚、审计。
7. 助手设置与推荐链路：模型配置、助手表单、AI 生成表单、智能推荐、市场、UI 展示和默认命名。

这七条链路当前都已经有代码痕迹，但入口混在 AI 助手组件、设置组件和 runner 中。重构目标是让 UI 只负责呈现，链路编排由 service 层负责。

## 4. 发送链路慢的根因

当前 `sendMessage` 的主流程大致是：

1. 读取 `userInput`，创建用户消息和助手占位消息。
2. 保存历史，等待 UI commit。
3. 调用 `resolvePrimaryConversationIntent`，内部一定会走一次模型路由，即使规则已经高置信。
4. 如果是 WPS 能力，再调用 WPS capability route。
5. 如果是文档操作，再调用 document operation route，并继续进入多个文档意图检测分支。
6. 如果是助手任务，再调用助手推荐模型或创建/修复助手逻辑。
7. 如果是生成文件，再调用 generated output route。
8. 普通聊天才开始构建上下文、推荐助手、调用 `streamChatCompletion`。

瓶颈包括：

- 主路由模型调用阻塞首字，普通聊天也要先等路由。
- 多个路由是串行执行，不是并行竞速，也缺少短路缓存。
- 助手推荐在发送链路中触发模型调用，容易和主回复争抢时间。
- `getCurrentDocumentPayload()` 会读取 `getDocumentText()`，对大文档可能是重操作；普通聊天中也可能被过早读取。
- 空文档场景没有区分“读取已有文档材料”和“以空白文档为目标创作内容”。例如用户输入“请帮我写出 Cursor 的使用教程”时，系统应先在消息列表生成内容，再允许用户点击按钮插入文档；不应因为当前文档为空而弹窗中断。
- `buildChatContextMessages` 固定预算 12000 字，早期上下文会被摘要或截断，且摘要是本地截断式摘要，不是可靠语义记忆。
- 每次关键步骤多次 `saveHistory()`，大历史会造成 JSON 序列化和存储写入开销。
- `AIAssistantDialog.vue` 过大，状态变更和业务决策耦合，性能问题难以定位。

## 5. 发送链路优化方案

### P0：立刻可做

- 把 `localIntentClassifier` 接入 `sendMessage` 的最前面。高置信 chat 直接进入流式回复，高置信 document/WPS/generated/assistant 直接进入对应链路，低置信再调用模型路由。
- 普通聊天不要读取全文，只读取选区快照和附件；只有用户明确提到全文、文档、当前文档、统计、总结、审查时才读取 `Content.Text`。
- 增加“材料范围”和“输出目标”判定：空文档不等于不能工作。写教程、起草文档、生成方案、创作文章等从零创作请求应走普通生成链路，并在消息框中展示结果；只有总结、分析、翻译、校对、提取、统计当前文档等明确依赖已有材料的请求才需要提示文档为空。
- 助手推荐改成首字返回后后台执行。推荐结果可晚于回复出现，不应阻塞首字。
- 将 `saveHistory()` 改成节流保存，复用现有 `makeThrottledHistorySaver` 思路。
- 在 `chatApi.js` 或统一 AI Gateway 层接入 `perfTracker`，记录 router、recommend、stream、document-read、history-save 的耗时。

### P1：低风险重构

- 建立 `src/services/sendPipeline/`：
  - `sendController.js`：统一发送入口。
  - `intentRouter.js`：规则路由、模型路由、路由缓存。
  - `chatFlow.js`：普通聊天流式。
  - `documentFlow.js`：文档处理。
  - `assistantFlow.js`：助手任务。
  - `generatedOutputFlow.js`：报告/文件/多模态。
  - `recommendationFlow.js`：异步推荐。
- `AIAssistantDialog.vue` 只保留 UI 状态和事件绑定，发送流程搬到 service。
- 使用 `AbortController` 管理同一会话并发请求，避免路由和流式互相污染。

### P2：体验提速

- 启用“乐观流式”：对明显普通聊天直接先发起流式，同时低置信路由并行跑；若路由判为非 chat，再 abort 并切换到工具链路。
- 路由模型和会话模型解耦：路由默认使用小模型、低温度、短输出、JSON schema；正式回答使用用户选择模型。
- 给相同输入 + 文档状态 + 附件摘要建立短期路由缓存，避免重试时重复路由。

目标指标：

- 普通聊天首字：从多秒降低到 500ms-1500ms，取决于模型服务。
- 高置信工具链路识别：本地 1ms 内完成。
- 低置信复杂链路：路由耗时可观测，必要时显示“正在识别任务类型”。

## 6. 长文档与超长上下文方案

### 核心原则

不能承诺“大模型一定全部理解”。应承诺“系统会完整读取、分块处理、记录覆盖率、可校验地汇总”。长文档处理应区分三类任务：

- 从零创作型：写教程、起草制度、生成方案、写文章、写报告框架。这类不依赖当前文档正文，即使 WPS 文档为空，也应直接让 LLM 生成内容并展示在消息列表中，用户再通过“插入 / 替换 / 追加 / 批注”等按钮写回文档。
- 精确型：计数、查找、去重、格式检查、关键词出现次数、成语数量。这类必须本地程序完成，LLM 只解释结果。
- 抽取型：条款、风险、行动项、字段、敏感词。这类走分块抽取 + 结构化 JSON + 合并去重 + 二次校验。
- 生成型：摘要、报告、润色、改写。这类走分块理解 + 汇总 + 最终生成；必要时提供覆盖率说明。

从产品交互上，“当前文档为空”不应默认作为弹窗错误。更合理的处理是：

- 用户要“基于当前文档总结/分析/统计/翻译/校对”时，在消息中说明当前没有可读取的正文，并引导用户输入内容、选择文本或继续从零创作。
- 用户要“写一份/生成一篇/起草一个”时，直接生成内容；生成结果不自动写入文档，继续使用消息卡片里的插入按钮完成写回。
- 用户明确要求“写入当前文档/插入到文档”时，先生成结果，再展示确认写回动作，避免模型输出未经确认直接改文档。

### “10000 字成语统计”建议实现

不要把 10000 字直接丢给 LLM 问“有多少个成语”。应新增 `TextStatsTool`：

1. 本地预处理：规范换行、标点、空格、分隔符。
2. 如果用户输入是成语列表：按标点、空白、换行、顿号、逗号、分号切分，过滤空项。
3. 如果用户输入是连续文本：用成语词典/自定义词库做最大匹配，记录起止 offset。
4. 输出结构化结果：总数、唯一数、重复项、疑似非成语项、样例、覆盖率。
5. LLM 只负责说明统计口径，不能修改程序计数。

更稳的结果示例：

```json
{
  "taskType": "idiom-count",
  "totalItems": 10000,
  "uniqueItems": 8750,
  "duplicates": [{"text": "画蛇添足", "count": 3}],
  "uncertainItems": [],
  "method": "local-parser",
  "coverage": "100%"
}
```

### 长文档能力架构

建议新增 `src/services/documentIntelligence/`：

- `documentReader.js`：统一读取全文、选区、段落、表格、批注、图片对象，支持懒加载。
- `chunkPlanner.js`：根据任务类型选择分块策略，保留 offset、段落号、页码、表格坐标。
- `coverageLedger.js`：记录每个 chunk 是否处理、是否失败、输出 hash、重试次数。
- `exactTools.js`：计数、查找、去重、正则提取、字段统计等确定性工具。
- `semanticExtractor.js`：分块 LLM 抽取，强制 JSON schema。
- `synthesizer.js`：合并分块结果，生成最终摘要/报告。
- `verifier.js`：覆盖率校验、计数复核、引用回查、低置信提示。
- `ragStore.js`：索引文档 chunk，支持 keyword + vector 双后端。

现有 `ragIndex.js` 只是内存关键词骨架，建议升级为可持久化索引：IndexedDB/OPFS 存 chunk 文本和元数据，向量可选接入本地 embedding 或远程 embedding。

## 7. 模块化重构目标架构

### 目标分层

```text
UI Shell(Vue)
  ├─ AIAssistantDialog / Settings / TaskCenter / Workflow / Evolution
Application Services
  ├─ SendPipeline
  ├─ AssistantStudio
  ├─ DocumentIntelligence
  ├─ TaskEngine
  ├─ WorkflowEngine
  ├─ EvolutionEngine
Infrastructure
  ├─ WpsHostAdapter
  ├─ AiGateway
  ├─ StorageRepository
  ├─ Telemetry
  ├─ ErrorReporter
Domain
  ├─ AssistantDefinition
  ├─ Task
  ├─ DocumentChunk
  ├─ ToolCall
  ├─ Workflow
  ├─ EvaluationSignal
```

### 建议目录

```text
src/
  app/
    bootstrap.js
    routes.js
  domains/
    assistant/
    document/
    task/
    workflow/
    evolution/
    model/
  services/
    sendPipeline/
    documentIntelligence/
    aiGateway/
    wpsHost/
    assistantStudio/
  components/
    ai/
    settings/
    task/
    workflow/
    common/
  repositories/
    settingsRepository.js
    chatRepository.js
    taskRepository.js
    memoryRepository.js
  workers/
    documentWorker.js
    statisticsWorker.js
    embeddingWorker.js
```

### 可复用设计

- 所有 LLM 调用统一走 `AiGateway`，禁止组件直接调用 `chatCompletion`。
- 所有 WPS 操作统一走 `WpsHostAdapter` 和 `opQueue`，禁止业务代码到处访问 `window.Application`。
- 所有长任务统一走 `TaskEngine`，UI 根据 taskId 订阅状态。
- 所有助手统一使用 `AssistantDefinition` schema，内置助手、自定义助手、市场助手、进化版本使用同一结构。
- 所有文档材料统一使用 `DocumentSource`：`selection`、`document`、`paragraph`、`attachment`、`prompt`。

## 8. 助手设置、智能推荐与表单生成

### 当前问题

- 自定义助手默认名是“未命名助手”，如果用户直接保存或 AI 生成没回填名称，会造成列表混乱。
- 设置界面承载模型、助手、报告、媒体、推荐、表单等大量配置，视觉层级偏重。
- 智能推荐按钮更像隐藏功能，和“新建助手”的主路径关系不清晰。
- AI 生成助手配置已有任务化能力，但需要更强的 schema、预览、保存校验和命名策略。

### 建议改造

- 新增 Assistant Studio 三步式体验：
  1. 描述需求：用户输入“我想要一个能审查合同风险的助手”。
  2. AI 生成表单：生成名称、描述、系统提示词、用户模板、输入范围、输出格式、写回动作、推荐关键词、显示位置。
  3. 预览与测试：用示例输入试跑，用户确认后保存。
- 默认名称策略：
  - AI 生成时必须生成 `name`。
  - 手动创建时用需求自动派生名称，例如“合同风险审查助手”。
  - 保存前禁止空名和“未命名助手”，提示用户确认。
- 推荐按钮位置：
  - 在“新建助手”空态中放主按钮：“用 AI 生成助手”。
  - 在表单顶部放次按钮：“根据当前表单优化提示词”。
  - 在助手列表中放入口：“从当前对话生成助手”。
- 表单 schema 化：
  - 使用 JSON Schema 描述助手配置。
  - AI 输出必须符合 schema。
  - UI 根据 schema 渲染字段，避免手写大表单越来越复杂。

## 9. WPS 操作与工具调用

WPS 操作必须作为确定性工具，而不是让 LLM 直接“猜怎么操作”。建议定义 Tool Registry：

```text
ToolDefinition {
  key,
  title,
  description,
  inputSchema,
  outputSchema,
  riskLevel,
  requiresConfirmation,
  handler
}
```

典型工具：

- `document.getText`
- `document.getSelection`
- `document.insertText`
- `document.replaceRange`
- `document.addComment`
- `document.applyStyle`
- `document.exportImages`
- `document.countItems`
- `document.findOccurrences`
- `assistant.run`
- `workflow.run`

LLM 的职责是选择工具和生成参数；真正执行必须由本地工具验证、确认、执行、回滚。高风险写回动作必须进入确认卡片或 undo chain。

## 10. 自动进化系统建议

现有自动进化模块较多，但应避免一开始就让系统自动改提示词并上线。建议采用四层治理：

- Signal：采集用户接受、撤销、重试、 thumbs、耗时、失败原因。
- Evaluation：固定评测集 + 真实匿名样本 + 长文档样本 + 工具调用样本。
- Shadow：候选助手只在后台跑，不影响用户结果。
- Promotion：达到质量阈值后灰度，失败自动回滚。

需要补齐：

- 每个助手版本的变更 diff。
- 每次进化的输入样本、输出、评分、上线决策记录。
- 对文档写回类助手设置更高门槛，禁止只凭单次用户反馈自动晋升。

## 11. 性能与可靠性指标

建议建立可观测指标：

- `send.click_to_route_ms`
- `send.click_to_first_token_ms`
- `send.total_ms`
- `router.primary_ms`
- `router.document_ms`
- `recommendation.ms`
- `document.read_full_ms`
- `document.chunk_count`
- `llm.prompt_chars`
- `llm.output_chars`
- `history.save_ms`
- `task.cancel_success_rate`
- `document.coverage_rate`
- `exact_tool_usage_rate`

UI 上建议在性能页展示：

- 最近 20 次发送链路瀑布图。
- 按模型统计 P50/P95 首字时间。
- 路由命中率：本地高置信、模型路由、回退。
- 长文档任务覆盖率和失败 chunk。

## 12. 技术栈是否需要更换

### 可以继续保留

- Vue 3 + Vite：对 WPS 加载项足够轻，构建简单。
- OpenAI 兼容 API：兼容多数模型服务。
- Vue Router + 独立对话框路由：符合 WPS 加载项多窗口形态。
- `@vue-flow/core`：适合工作流编排。

### 建议补充

- TypeScript：先从 service/domain 层开始，巨型 Vue 文件后迁移。
- Pinia 或轻量 store：替代组件内大量 data/method 状态。
- Zod/Valibot/JSON Schema：统一助手配置、工具参数、模型输出校验。
- IndexedDB/OPFS：用于长文档索引、任务记录、评估样本、RAG chunk。
- Web Worker：用于长文本解析、统计、分块、文件解析，避免 UI 卡顿。
- 虚拟列表：消息、任务、助手、日志统一虚拟化。

### 不建议立刻替换

- 不建议全面换 React/Svelte，迁移收益不如拆分架构。
- 不建议一开始上复杂后端，除非需要团队账号、云端同步、共享市场和统一审计。
- 不建议把所有文档理解都交给向量库，精确任务和结构化分块仍是基础。

## 13. 分阶段执行计划

### 阶段 0：观测与止血，1-2 周

- 接入发送链路性能埋点。
- 本地高置信路由短路。
- 普通聊天延迟读取全文。
- 助手推荐后台化。
- 历史保存节流。
- 禁止保存“未命名助手”。

验收：

- 普通聊天点击到首字明显下降。
- 性能页能看到每次发送的路由、上下文、流式耗时。
- 新建助手不会再出现默认“未命名助手”污染列表。

### 阶段 1：发送链路拆分，2-4 周

- 新建 `sendPipeline` service。
- 从 `AIAssistantDialog.vue` 抽出路由、普通聊天、文档、生成文件、助手任务、推荐。
- 所有 LLM 请求先经过 `AiGateway`。
- 为路由器增加 JSON schema 和小模型配置。

验收：

- `AIAssistantDialog.vue` 主要负责 UI，核心发送逻辑可单元测试。
- 五类发送链路都有独立测试样例。

### 阶段 2：长文档与精确工具，3-6 周

- 建立 `documentIntelligence`。
- 实现 `TextStatsTool`、成语/列表统计、查找计数、去重工具。
- 长文档任务引入 coverage ledger。
- 报告/摘要/抽取统一走 map-reduce + verifier。
- RAG 从内存骨架升级到持久化 keyword index，预留 vector backend。

验收：

- 10000 字成语统计类任务由本地工具返回准确结果。
- 5 万字文档摘要能展示分块进度和覆盖率。
- 任一 chunk 失败可重试，不影响已完成结果。

### 阶段 3：Assistant Studio，3-5 周

- 重构助手设置为 Studio 模式。
- AI 生成表单改为 schema 输出 + 校验 + 预览。
- 增加测试运行和保存前校验。
- 智能推荐入口重新布局。

验收：

- 用户可用一句话生成完整助手配置。
- 生成结果有可解释预览，可一键试跑。
- 空名、重复名、低质量 prompt 会被拦截。

### 阶段 4：WPS 工具注册与工作流统一，4-8 周

- 建立 Tool Registry。
- WPS 操作全部通过工具 schema 执行。
- 工作流节点复用同一工具注册表。
- 加入权限、确认、撤销和审计。

验收：

- 对话、助手、工作流都能调用同一套工具。
- 高风险写回动作有确认和回滚。

### 阶段 5：自动进化治理，持续

- 评估集、shadow run、灰度、回滚形成闭环。
- 每个助手版本可追溯。
- 长文档和工具调用加入专门评测集。

验收：

- 候选助手不会直接影响用户主结果。
- 晋升有数据依据，失败可回滚。

## 14. 优先级清单

最高优先级：

- 修复发送慢：本地路由短路、推荐后台化、延迟全文读取。
- 修复精确统计：新增本地统计工具，不再依赖 LLM 数数。
- 修复未命名助手：保存校验和自动命名。
- 接入性能瀑布图：先知道慢在哪里。

第二优先级：

- 拆分 `AIAssistantDialog.vue`。
- 统一 `AiGateway` 和 `WpsHostAdapter`。
- Assistant Studio 表单生成 schema 化。
- 长文档 coverage ledger。

第三优先级：

- RAG 持久化和向量后端。
- 工作流工具注册表统一。
- 自动进化灰度和回滚治理。

## 15. 风险与注意事项

- WPS 宿主对象可能是 STA/单线程敏感，文档写操作必须串行化，不能随意并发。
- 长文档全文读取可能阻塞 UI，应尽量懒加载、分段读取、worker 处理。
- LLM JSON 输出必须校验，不能直接信任。
- 自动进化不能跳过人工或评测门槛，尤其是会写回文档的助手。
- 多窗口对话框下 `window.Application` 来源复杂，应统一收口到 Host Adapter。
- 文件、设置、任务持久化需要版本迁移策略，避免升级后旧配置失效。

## 16. 建议的下一步

建议先做一个最小重构切片：只改发送链路，不碰 UI 大改。

具体任务：

1. 新建 `sendPipeline`，接入本地高置信路由。
2. 普通聊天直接流式，助手推荐后台执行。
3. 给发送链路加性能埋点。
4. 新增 `TextStatsTool`，覆盖成语统计、列表计数、去重。
5. 新建助手保存前自动命名和校验。

## 17. 当前执行进展

已开始按 P0 顺序执行：

- 已修复空文档从零创作误拦截：写教程、起草文档、生成方案等请求不再因为当前文档为空弹窗中断，而是继续在消息列表中生成内容，再由用户通过消息按钮插入文档。
- 已调整文档范围判定：新增“读取已有文档材料”和“以空白文档为输出目标”的区分，避免把“生成一份教程文档”误当作必须读取当前全文。
- 已启用高置信本地规则短路：主会话路由在规则高置信时直接返回，不再等待一次额外模型路由。
- 已排除从零创作请求的纯段落限制，教程、方案、文档草稿可以继续使用更适合阅读的结构化输出。
- 已延迟全文读取：普通聊天、从零创作和仅输入处理不再默认调用全文读取，只有材料范围实际解析为全文时才读取当前文档正文。
- 已接入历史保存节流：高频 `saveHistory()` 合并为空闲时写入，作用域切换和组件卸载时立即落盘。
- 已补充发送链路性能埋点：记录主路由、上下文构建、首个 chunk、总耗时，便于后续在性能页观察瓶颈。
- 已新增本地精确统计工具并接入发送链路：识别“统计成语/词语/条目数量”类请求后，按分隔符或连续四字成语规则由程序计数，直接在消息列表返回结果，不再让大模型估算数量。
- 已将助手推荐延后为后台任务：普通回复发起前不再立即启动推荐模型请求，减少与正式回复争抢首字延迟。
- 已治理“未命名助手”：新建助手会从需求、描述或提示词自动派生名称；保存设置前会统一修复空名或“未命名助手”，并保证名称唯一。
- 已完善本地路由短路：从零创作请求直接判为高置信普通生成；现有 `localIntentClassifier` 已接入主路由，高置信时跳过模型路由。

这一组改动能最快解决用户可感知问题，也为后续架构拆分打基础。

## 18. 全量执行清单

### P0 体验止血与可观测

- [x] 空文档从零创作不再弹“当前文档为空”。
- [x] 区分“读取已有文档材料”和“以空白文档为输出目标”。
- [x] 高置信本地规则跳过模型路由。
- [x] 接入 `localIntentClassifier` 作为主路由短路补充。
- [x] 从零创作不强制纯段落输出。
- [x] 普通聊天、从零创作、仅输入处理延迟全文读取。
- [x] 助手推荐延后到后台执行。
- [x] `saveHistory()` 节流保存，并在作用域切换/卸载时落盘。
- [x] 发送链路性能埋点：主路由、上下文构建、首个 chunk、总耗时。
- [x] 本地精确统计工具：成语/词语/条目计数。
- [x] 自定义助手自动命名，治理“未命名助手”。
- [x] 性能页展示发送链路瀑布图。
- [x] 本地统计工具扩展到文档选区/全文。
- [x] 路由缓存：相同输入、附件摘要、文档状态短期复用。

### P1 模块化发送链路

- [x] 新建 `src/services/sendPipeline/`。
- [~] 抽出 `intentRouter`：规则路由、本地分类器、模型路由、缓存。（已抽出本地高置信短路决策与短期模型路由缓存；模型路由提示词待迁移）
- [~] 抽出 `chatFlow`：普通聊天上下文构建、流式回复、错误处理。（已抽出上下文构建、流式状态归一化与错误格式化；组件流式回调迁移待补）
- [~] 抽出 `documentFlow`：文档处理、空文档策略、长文档分支。（已抽出空文档创作、材料范围、直传/分块策略；组件内分支迁移待补）
- [~] 抽出 `assistantFlow`：助手执行、推荐、创建/修复助手。（已抽出助手配置草稿、修复审计、推荐动作入口；真实执行与 UI 接入待补）
- [~] 抽出 `generatedOutputFlow`：报告、文件、多模态。（已抽出生成型输出识别、产物元数据与 MIME/格式推断；真实生成与保存待接入）
- [ ] `AIAssistantDialog.vue` 逐步变薄，只保留 UI 状态和事件绑定。

### P2 长文档与确定性工具

- [x] 新建 `src/services/documentIntelligence/`。
- [~] `documentReader` 统一读取全文、选区、段落、表格、批注。（已接管当前全文 payload；段落、表格、批注待读取统一）
- [~] `chunkPlanner` 根据任务类型规划 chunk、offset、段落引用。（已抽出分块策略并附加 offset/段落引用；写回定位接入待补）
- [x] `coverageLedger` 记录 chunk 覆盖率、失败、重试。
- [~] `exactTools` 支持计数、查找、去重、正则抽取、字段统计。（已接入成语/词语/条目统计、查找、去重、正则抽取；字段统计待补）
- [~] `semanticExtractor` 强制 JSON schema 分块抽取。（已提供 schema、提示词、JSON 解析、schema 校验和分块抽取编排；真实模型调用接入待补）
- [~] `synthesizer` 合并分块结果并生成最终内容。（已提供去重合并、来源保留和 Markdown 渲染；模型增强合成待补）
- [~] `verifier` 做覆盖率校验、引用回查、计数复核。（已提供覆盖率校验、引用回查与精确统计复核；更多任务类型复核待补）
- [~] `ragStore` 持久化 keyword index，预留 vector backend。（已封装统一检索入口并复用现有内存 ragIndex；已接入文档智能缓存元数据持久化，完整索引恢复待增强）

### P3 Assistant Studio

- [ ] 助手设置重构为三步式 Studio：描述需求、AI 生成表单、预览试跑。
- [~] 助手配置 JSON Schema 化。（已新增 schema/normalize/validate 服务；完整 JSON Schema 渲染待接入）
- [~] AI 生成配置强制 schema 校验。（已在创建/保存前复用 schema 校验；AI 推荐输出源头强校验待接入）
- [x] 保存前校验名称、提示词、输入范围、输出动作。
- [~] 智能推荐按钮重新布局为“用 AI 生成助手 / 优化当前助手 / 从当前对话生成助手”。（已在 assistantFlow 定义三类动作与排序；设置页布局接入待补）
- [ ] 增加试跑样例与结果预览。

### P4 WPS 工具注册与工作流统一

- [x] 建立 Tool Registry。
- [~] WPS 操作 schema 化：读取、插入、替换、批注、格式、导出。（已注册读取、插入、追加、替换、批注工具；格式、导出待补）
- [~] 高风险写回动作统一确认、撤销、审计。（已抽出执行前确认策略与工具审计记录；撤销待补）
- [ ] 对话、助手、工作流共用同一工具注册表。
- [~] 工作流运行前结构校验。（已新增节点、边、入口、循环检测与工具权限校验；运行器接入待补）
- [~] `opQueue` 成为跨窗口文档写操作默认入口。（WPS 文档写入工具已优先走 opQueue，并提供 leader handler；现有散落写入调用待迁移）

### P5 自动进化治理

- [~] 建立助手版本 diff 与审计记录。（已新增配置 diff、审计记录、摘要与存储服务；UI 展示待补）
- [~] 固定评测集覆盖普通聊天、长文档、工具调用、写回动作。（已提供基础评测集、选择/评分与存储服务；真实 runner 接入待补）
- [~] Shadow run 不影响用户主结果。（已有 shadowRunner；已补策略层要求 shadow 样本达标后才晋升，调用链路治理待接入）
- [~] 灰度晋升、失败回滚、质量阈值可配置。（已新增晋升/回滚阈值策略服务；配置 UI 待补）
- [x] 文档写回类助手设置更高晋升门槛。

### P6 工程质量与迁移

- [~] Service/domain 层逐步 TypeScript 化。（已将新增 documentIntelligence、toolRegistry、workflowOrchestration、assistantEvolution、schema 服务挂到统一 service 边界；TS 化待补）
- [~] 引入 schema 校验库或统一 JSON Schema validator。（已新增轻量 validator；后续可替换为标准库）
- [~] IndexedDB/OPFS 存任务、索引、评估样本和长文档缓存。（已新增文档智能命名空间存储，复用 OPFS/IndexedDB fallback 并提供内存兜底；任务与评估样本待接入）
- [~] Web Worker 承担长文本统计、分块、文件解析。（已新增长文本统计、分块 worker 与主线程 fallback；文件解析待迁移）
- [~] 消息、任务、助手、日志列表虚拟化。（已新增通用虚拟列表 range/slice 服务；具体 UI 接入待补）
- [~] 建立单元测试、smoke 测试、WPS 集成测试分层。（已新增 `npm run test:services` 覆盖核心 service 层；单元测试与 WPS 集成测试待补）
