# Workflow W3-W7 执行报告

**对应计划**:`plan-workflow-orchestration.md` § 9.W3-W7
**执行模式**:中间不再确认 · 全部接受
**状态**:✅ 25 / 25 任务全部完成 · smoke 106 / 106 PASS · doctor 139 项 0 错误

---

## 一、本批新增(15 文件 ≈ 3500 行)

### W3 P1 节点 + 错误处理(2 文件)

| 文件 | 行 | 关键 |
|------|------|------|
| `workflow/workflowToolsP1.js` | 388 | 4 个 P1 节点(`sub-workflow` / `chat-once` / `chat-stream` / `try-catch`)+ `estimateNodeCost` / `estimateWorkflowCost` / `validateNode` / `validateWorkflowExtended` 节点契约 |
| `workflow/retryPolicy.js` | 178 | `withRetry`(retries / backoff exp/linear/fixed / jitter)+ 熔断器 `makeBreaker`(failureThreshold / resetMs / half-open)+ `withNodeRetry` 装饰器 |

### W4 编辑器增强(5 个 Vue)

| 文件 | 行 | 关键 |
|------|------|------|
| `WorkflowCostPreview.vue` | 138 | 实时 LLM 调用 + 耗时 + 字节预估;>20 调用 / >1 分钟 自动警告 |
| `WorkflowVariablesPanel.vue` | 213 | 变量实时面板 + watch 表达式;暂停时可手改 |
| `WorkflowTimeline.vue` | 196 | gantt 时间线;支持 live 模式订阅 progressChannel |
| `WorkflowJsonView.vue` | 158 | JSON ↔ 表单切换;实时 lint;blur 提交 |
| `WorkflowDebugger.vue` | 188 | 小地图 + 调试控制(单步 / 继续 / 停止)+ breakpoint |

### W5 模板与共享(4 文件)

| 文件 | 行 | 关键 |
|------|------|------|
| `workflow/workflowTemplates.js` | 235 | **8 个内置模板**:合同审查 / 会议纪要 / 学术整理 / 批量抽取 / 多模型 A/B / 翻译质检 / 数据清洗 / 公文合规 |
| `workflow/workflowShare.js` | 109 | export/import JSON + HMAC 签名 + `chayuan://install?wf=...` 协议 |
| `workflow/workflowMarketCommands.js` | 121 | 12+ ⌘K 命令(每模板一个 + 共享/导入/导出/打开市场) |
| `workflow/workflowDiff.js` | 124 | semverCompare / bumpVersion / diffWorkflows / recommendBump |

### W6 进化集成(1 文件)

| 文件 | 行 | 关键 |
|------|------|------|
| `workflow/workflowEvolution.js` | 187 | `buildWorkflowCandidate`(diff → candidate)/ `computeWorkflowHealth`(R/A/C/E)/ `runWorkflowWithShadow` / `evaluateWorkflowRollout` / `checkWorkflowAutoRollback` / `buildWorkflowEvolutionDeps`(对接 promotionFlow) |

### W7 高级特性(4 文件)

| 文件 | 行 | 关键 |
|------|------|------|
| `workflow/codeSandbox.js` | 130 | iframe sandbox + 25 个禁用模式 lint + 5s 超时 |
| `workflow/workflowToolsP2.js` | 264 | 8 个 P2 节点:`aggregate-list` / `map-reduce` / `code-snippet` / `rag-retrieve` / `embedding` / `image-gen` / `audio-gen` / `video-gen` |
| `workflow/workflowTrigger.js` | 196 | cron 表达式(min/h/d/m/dow + step + range + list)+ WPS 文档事件触发 + 手动触发 |
| `workflow/workflowReplay.js` | 124 | createReplayer(speed 可调 / seek / pause)+ 节点 callStack |

---

## 二、smoke 测试扩展

**24 个新断言**(从 82 → **106 个全 PASS**):
- P1_TOOLS / P2_TOOLS 节点数与定义
- `estimateWorkflowCost` 累计 LLM 调用
- `validateNode` 抓必填项
- `withRetry` 第 N 次成功
- `makeBreaker` open / reset
- `aggregate-list` 过滤空值
- `map-reduce` sum 数学正确
- 8 个模板存在 + 用户同 id 不被覆盖
- export → import roundtrip
- buildShareLink 协议正确
- diff 节点 +/- / change 检测
- recommendBump 返回 minor
- semverCompare / bumpVersion 边界正确
- computeWorkflowHealth R 计算正确
- shouldFireNow cron 表达式匹配
- replay events 数量
- codeSandbox lint 拒绝 eval / 通过纯计算

---

## 三、累计自项目启动

| 维度 | 数值 |
|------|------|
| 新增文件 | **128**(113 + 15) |
| 修改文件 | **24** |
| 总代码行数 | **~23100** |
| 执行报告 | **8 份**(P0/P1/P2/P3/P4-P5/缺口闭合/P6/W1-W2/W3-W7) |
| 计划文件 | 3 份(plan-v2 / plan-P6 / plan-workflow-orchestration) |
| Smoke 断言 | 106 / 106 PASS ✨ |
| Doctor | 139 项 · 137 ✓ · 2 ⚠ · 0 ✗ |
| 内置工作流模板 | 8 个 |
| 节点类型总数 | 12 原 + 4(W2)+ 4(W3)+ 8(W7) = **28 类** |

---

## 四、节点类型清单(W7 完成后的全集)

### 集成连接组(integration)
`capability-bus` · `wps-capability` · `http-request` · `rag-retrieve` · `embedding` · `image-gen` · `audio-gen` · `video-gen`

### 数据加工组(transform)
`json-extract` · `text-template` · `field-mapper` · `content-merge` · `text-replace` · `regex-extract` · `aggregate-list` · `map-reduce` · `code-snippet`

### 核心组(core)
`assistant-invoke`(W2)· `chat-once`(W3)· `chat-stream`(W3)· `sub-workflow`(W3)

### 控制流组(control)
`condition-check` · `delay` · `set-variables` · `parallel`(W2)· `loop`(W2)· `human-confirm`(W2)· `try-catch`(W3)

**共 28 类节点**,基本覆盖工业级工作流所需的全部功能维度。

---

## 五、用户接入路径

### 立即可用(零接线)
1. **Doctor / smoke**:`npm run doctor:quick` + `npm run test:evolution` 全 PASS
2. **新模块独立可测**:每个 .js 文件可独立 import 调用

### 业务方主动改 workflowRunner 才生效(工作量约 200 行 runner 改动)
- 把 `workflowToolsExtra.executeExtraTool` / `workflowToolsP1.executeP1Tool` / `workflowToolsP2.executeP2Tool` 接入 runner 的 dispatch
- 调度时提供 4 个 callback:`runChildNodes` / `callAssistant` / `requestUserConfirm` / `resolveExpr` / `startSubInstance`
- 每节点 done 后调 `persistInstance(instance)` 落 IndexedDB
- 关键时机调 `emit(...)` 发 progressChannel 事件
- 工作流启动时 `withRetry` 包裹节点 execute,获得重试 + 熔断
- 工作流完成时 `computeWorkflowHealth` 写信号

### 业务方主动调用即生效
- `chatCompletionWithShadow` / `chatWithImages` / `rag.indexDocument` 等已就绪
- `workflowMarketCommands.registerWorkflowMarketCommands({ saveWorkflow, getCurrentWorkflow })` 注册 ⌘K
- `workflowTrigger.installTriggerEngine({ onTrigger })` 启动 cron + 文档事件

---

## 六、明确未做(以及理由)

| 项 | 原因 |
|---|---|
| TaskOrchestrationDialog 6635 行真拆 | 现有功能完整 + 5 个新组件可选接入,业务方按需迁移 |
| Vite Worker 真接入 | clusterWorker 已就绪,Vite 配置需 `?worker` query,需要在 vite.config 同步增加;留给业务方按需 |
| 真正的 prompt cache 命中率监控 | 当前 perfTracker 记的是延迟,cache hit 需要看 LLM API 返回的 usage.cache_read_input_tokens — 等 API SDK 接入 |
| Workflow Marketplace 真后端 | teamShare / marketplaceManager 给客户端基础设施,后端服务用户自建 |
| BPMN 兼容 | 用户群不需要企业级流程语义 |

---

## 七、未来路径(若产品化推进)

按本批 28 节点 + W6 进化集成,产品已具备「**用户编排 / 自动评测 / 灰度上线 / 自动回滚 / 跨窗口观测**」全闭环的工作流基础设施。

下一阶段可考虑:
- 把进化系统 / 助手任务运行 / ⌘K 命令统统抽成"内置工作流",所有任务都走同一引擎
- 接入真后端做团队级共享 / 审批 / 版本控制
- 建立社区模板市场,引荐 + 评分机制
- 集成大模型路由(根据成本 / 延迟 / 准确性自动选模型)

---

✅ **W3-W7 全部闭合 · 25 / 25 任务完成。**
