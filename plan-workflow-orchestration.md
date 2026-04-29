# 流程编排 / 工作流执行 — 全面设计与开发计划

> 基于本项目特性(WPS 加载项 / LLM 重 / 多窗口 / 文档全局可变状态)的工作流编排系统设计。

---

## 0. 背景与范围

「流程编排」在本项目的含义:**用 DAG 描述「LLM 调用 + 文档操作 + 用户介入 + 控制流」混合任务**,让用户/管理员通过可视化或 JSON 把多步动作编织成可重用、可观测、可中断、可恢复的执行单元。

典型场景:
- **合同审查流水线**:抽条款 → 4 助手并行打分 → 合并报告 → 写回批注 → 推送邮件
- **会议纪要 + 待办派发**:转写 → 提炼要点 → 出待办 → 生成日历事件
- **学术论文整理**:摘要 → 关键术语 → 引文核查 → 中英对照术语表 → 合成定稿
- **批量结构化抽取**:遍历文档段落 → 每段抽出 JSON → 合并入表

这些都不是"一次 LLM 调用"能完成的,需要状态、分支、并行、人工确认、断点续跑。

---

## 1. 现有基础设施盘点

| 模块 | 角色 | 完成度 |
|------|------|--------|
| `src/utils/workflowStore.js` | 工作流定义 CRUD + 正则化 | ✅ 已成熟 |
| `src/utils/workflowRunner.js` | 执行引擎 + 调试 + breakpoint | ✅ 已成熟,但需增强(见 §10) |
| `src/utils/workflowTools.js` | 12 个内置工具:`capability-bus / wps-capability / http-request / json-extract / text-template / field-mapper / content-merge / text-replace / regex-extract / condition-check / delay / set-variables` | ✅ 覆盖基础 |
| `src/utils/taskOrchestrationMeta.js` | 任务元数据归一化 | ✅ |
| `src/components/TaskOrchestrationDialog.vue`(6635 行) | 可视化编辑器 + 调试 | 🟡 可用但臃肿 |
| `src/utils/taskListStore.js` | 任务列表持久化 | ✅ |
| `src/utils/taskOrchestrationWindowManager.js` | 编辑器窗口生命周期 | ✅ |

**已有但需完善** ⚠️:
- workflowRunner 是 in-memory(`activeWorkflowRuns = new Map()`),页面刷新即丢
- 没有显式的 fan-out / fan-in 节点,并行靠 condition-check + 多边
- 没有 sub-workflow(工作流作为节点)
- 没有 loop / forEach
- 没有 human-in-loop pause(只有 breakpoint 调试用)
- 没有定时触发器
- 没有版本化(workflow.version 字段空设)
- 没有跨窗口进度同步(BroadcastChannel 在 P6 已 ready 但未接入)
- 没有 LLM 成本预估
- 没有"工作流作为进化单元"——只对单助手做 RACE / shadow,不对工作流整体

---

## 2. 设计哲学

| 原则 | 含义 |
|------|------|
| **可观测优于可控** | 流程跑起来了人不能盯着,UI 必须实时反馈每一步 |
| **可恢复优于可重启** | 长流程(>5 分钟)中途崩了,默认续跑而非从零 |
| **失败局部隔离** | 单节点失败不应吞掉已写入的部分,bundle undo 一键回退 |
| **节点纯函数化** | 每个节点 (input, ctx) → output,无跨节点副作用(except doc-op) |
| **DAG 不是 BPMN** | 拒绝过度抽象;不引入子流程之外的复杂控制结构(如 saga/compensation 直接用 try/catch) |
| **JSON 即源代码** | 工作流定义就是文档,可手编、diff、版本化、共享 |
| **单一执行平面** | 不区分"测试运行" vs "正式运行";所有 run 走同一引擎,只是 metadata 不同 |
| **节点不感知 UI** | 引擎 emit 事件,UI 订阅;反向不允许 |

---

## 3. 概念模型

### 3.1 三层对象

```
┌──────────────────────────────────────────────────────────┐
│ WorkflowDefinition  — 静态 JSON,可序列化、版本化、分享   │
│   { id, name, description, version, nodes[], edges[],   │
│     inputs[], outputs[], variables{}, tags[] }          │
└──────────────────────────────────────────────────────────┘
              ↓ instantiate
┌──────────────────────────────────────────────────────────┐
│ WorkflowInstance    — 一次具体运行,持久化               │
│   { id, definitionId, definitionVersion, taskId,        │
│     startedAt, status, cursor, vars{},                   │
│     stepHistory[], snapshot[],                           │
│     undoBundleId, ownerWindow,  parentInstanceId }       │
└──────────────────────────────────────────────────────────┘
              ↓ executes
┌──────────────────────────────────────────────────────────┐
│ ExecutionContext    — 内存中的活动状态                   │
│   { abortCtrl, stepFn, varBag, telemetry,                │
│     hooks:{onStep, onError, onPause}, host }             │
└──────────────────────────────────────────────────────────┘
```

### 3.2 节点状态机

```
       ┌─→ pending ─→ ready ─→ running ─┬→ done
       │                                  ├→ failed (retryable)
       │                                  ├→ cancelled
       │                                  └→ skipped (条件分支)
       └────────── waiting (human-in-loop / sleep) ──┘
```

注意 `failed` 不是终态:有重试策略时回到 `ready`;超过重试次数才转 `permanent-failed`。

### 3.3 变量作用域

```
workflow scope (全局)              ← workflow.variables 初始化
  └── instance scope (每次运行)    ← startedAt / runId / userInput
        └── step scope (单节点)    ← node.input / node.output
              └── loop iter scope  ← __index, __item(loop 节点专用)
```

变量绑定语法:`{{vars.foo}}` / `{{nodes.n2.output.text}}` / `{{instance.userInput}}`。

---

## 4. 节点类型分类与扩展

### 4.1 现有 12 类(保留)

| 组 | 类型 | 用途 |
|----|------|------|
| integration | `capability-bus` / `wps-capability` / `http-request` | 调外部能力 |
| transform | `json-extract` / `text-template` / `field-mapper` / `content-merge` / `text-replace` / `regex-extract` | 数据加工 |
| control | `condition-check` / `delay` / `set-variables` | 简单控制流 |

### 4.2 缺失项(本次设计补齐)

| 优先级 | 新类型 | 用途 |
|--------|--------|------|
| 🔴 P0 | `assistant-invoke` | 调用一个内置/自定义助手(当前是 runner 直接接 assistantTaskRunner,缺独立节点抽象) |
| 🔴 P0 | `parallel` | 显式并行 fan-out + 等待 join |
| 🔴 P0 | `loop` | 遍历数组或 N 次,每轮跑子图 |
| 🔴 P0 | `human-confirm` | 暂停等用户点"批准/驳回"再继续 |
| 🟠 P1 | `sub-workflow` | 把另一个工作流当节点调用,可递归 |
| 🟠 P1 | `chat-once` | 直接发一条 LLM 调用(免去配助手) |
| 🟠 P1 | `chat-stream` | 流式 LLM 调用,逐 token 触发下游 |
| 🟠 P1 | `try-catch` | 抓住下游节点失败,走兜底分支 |
| 🟡 P2 | `aggregate-list` | 把上游多个节点的输出聚合成数组 |
| 🟡 P2 | `map-reduce` | 数组 → map 函数 → reduce 函数 |
| 🟡 P2 | `code-snippet` | 跑一段安全沙箱化的 JS(限定 API + AST 审查) |
| 🟡 P2 | `prompt-cache-bench` | 用同一 prompt 跑 N 次评 cache 命中率 |
| 🟢 P3 | `image-gen` / `audio-gen` / `video-gen` | 多模态生成节点(需 chatApiMultimodal) |
| 🟢 P3 | `rag-retrieve` | 从已索引的文档检索 top-k 片段 |
| 🟢 P3 | `embedding` | 文本 → 向量 |

### 4.3 节点接口契约

每个节点都实现这个最小接口:

```js
{
  type: 'parallel',
  title: '并行执行',
  group: 'control',
  icon: 'PAR',
  // 输入端口声明
  inputPorts: [{ name: 'in', type: 'any' }],
  // 输出端口声明
  outputPorts: [{ name: 'out', type: 'array<any>' }],
  // 配置 schema(让编辑器渲染表单)
  configSchema: {
    branches: { type: 'array', minItems: 2 },
    waitMode: { type: 'enum', values: ['all', 'any', 'first-success'] }
  },
  // 默认 payload
  defaultPayload: () => ({ branches: [[], []], waitMode: 'all' }),
  // 执行函数(由 runner 调)
  async execute(node, context) { ... },
  // 估算成本(供 dry-run 预览)
  estimateCost: (node, context) => ({ llmCalls: 0, ms: 50, bytes: 0 }),
  // dry-run 验证
  validate: (node, workflow) => ({ ok: true, errors: [] })
}
```

新增的 `estimateCost` / `validate` 是当前 `workflowTools.js` 没有但应该补上的。

---

## 5. 执行引擎

### 5.1 调度策略

**当前**:`workflowRunner.startWorkflowRun` 是单线程顺序的(一个一个跑)。
**目标**:**Topological + bounded parallel + back-pressure**。

```js
// 伪代码
async function execute(instance) {
  const ready = topologicalSort(instance.workflow)
  const concurrency = instance.workflow.concurrency || 4
  const inflight = new Map()  // nodeId → Promise

  while (notDone(instance)) {
    // 1. 选 ready + 未运行的节点(上游全 done)
    const candidates = ready.filter(n => allDepsResolved(n) && !inflight.has(n.id))

    // 2. 并发限制
    while (inflight.size < concurrency && candidates.length > 0) {
      const node = candidates.shift()
      inflight.set(node.id, runNode(node, instance).finally(() => inflight.delete(node.id)))
    }

    // 3. 等任意一个完成,继续循环
    if (inflight.size === 0) break
    await Promise.race(inflight.values())
  }
}
```

**关键点**:
- `runNode` 内部包了 try/catch + retry + perfTracker
- `runConcurrently`(P1 已有)可直接复用,加个"按拓扑序排"的外层
- 节点是 LLM 调用 → 走 `rateLimiter.withRateLimit`(P6 已有)
- 节点是文档操作 → 走 `opQueue.enqueueOp`(P6 已有,需 leader 决策)

### 5.2 错误处理

```
节点抛错 → engine 捕获:
  1. 检查 retry policy:retries=N, backoff=exponential
  2. 重试用尽 → 检查上游是否有 try-catch 节点包装
     - 有 → 流入 catch 分支
     - 无 → 工作流失败,触发 onError + 写 audit signal + 如果开启则 undo bundle
  3. 任何一步失败,默认不影响已完成节点的 output(写入 instance.snapshot)
  4. 用户可以从 stepHistory 选某步重跑(开发时调试用)
```

### 5.3 取消语义

```
user 点"停止":
  1. abortCtrl.abort('user-cancelled')
  2. 所有 inflight 节点收到 abort signal
  3. 已经跑完的节点保留输出(instance.snapshot)
  4. instance.status = 'cancelled'
  5. 如果开了 autoUndoOnCancel → 触发 undoChainBundle.undoAll
```

### 5.4 事件流(observability)

引擎只 emit 事件,**不直接更新 UI**。订阅方包括:
- TaskOrchestrationDialog(实时 UI)
- BroadcastChannel(跨窗口同步,via taskProgressBroadcast)
- perfTracker(每节点延迟)
- signalStore(audit log)
- toast(关键节点失败/完成)

```js
emit('workflow:start', { instanceId, workflowId })
emit('node:ready',   { instanceId, nodeId })
emit('node:run',     { instanceId, nodeId, startedAt })
emit('node:progress', { instanceId, nodeId, partial }) // 流式节点
emit('node:done',    { instanceId, nodeId, output, durationMs })
emit('node:error',   { instanceId, nodeId, error, attempt })
emit('node:retry',   { instanceId, nodeId, nextAttempt })
emit('workflow:pause', { instanceId, reason })
emit('workflow:resume', { instanceId })
emit('workflow:done', { instanceId, summary })
emit('workflow:fail', { instanceId, error })
emit('workflow:cancel', { instanceId, reason })
```

---

## 6. 持久化与可恢复

### 6.1 当前问题

`workflowRunner.js` 的 `activeWorkflowRuns` 是 `new Map()`,页面刷新就丢。流程跑到一半 WPS 重启 → **零线索**。

### 6.2 解决方案 — Snapshot-based resumability

**每个节点完成后** 同步一次 `instance` 到 IndexedDB(via `signalStoreIDB.js` / `opfsStorage.js` 同款基础设施):

```js
{
  id: 'inst_xxx',
  definitionId: 'wf_audit',
  definitionVersion: '1.2.0',
  status: 'running',
  startedAt: 1735660000000,
  cursor: { ready: ['n3', 'n4'], inflight: ['n2'] },
  vars: { ... },
  snapshot: {
    'n0': { status: 'done', output: '...', duration: 1200 },
    'n1': { status: 'done', output: '...', duration: 800 },
    'n2': { status: 'running', startedAt: ... },
    ...
  },
  undoBundleId: 'bundle_xxx',
  ownerWindow: 'win_abc',  // 哪个窗口在跑
  metadata: { docPath, selectionToken, userIntent }
}
```

**重启恢复流程**:
1. App 启动期扫 IndexedDB,找 `status=running` 的 instance
2. 检查 `ownerWindow` 是否还活着(via leaderElection)
3. 死了 → 触发恢复对话框:"3 个流程上次未完成,是否继续?"
4. 用户点继续 → engine 从 `cursor` 读出 inflight + ready,重新调度
5. inflight 节点的处理选项:
   - "假设它没跑过"(retry)
   - "假设它跑完了"(skip,需 output 已存)
   - "由用户在 UI 上指定"

### 6.3 幂等性要求

工作流恢复要求节点是**幂等的**或者**有效结果存放过**。约束:
- LLM 节点:幂等性差(同 prompt 不同 output)→ 用结果缓存(prompt hash → output)
- 文档操作:**不幂等**(写两次会重复) → 必须靠 snapshot.output 判断已写过
- HTTP:取决于 API → 节点 config 加 `idempotent: true|false` 让 caller 决定

---

## 7. 编辑器

### 7.1 现状

`TaskOrchestrationDialog.vue` 6635 行,功能齐全但臃肿。包含:
- DAG canvas + 拖拽
- 节点配置面板
- 调试控制(run / step / breakpoint)
- 任务列表

### 7.2 增强方向(不重写,渐进改善)

| 缺失项 | 实现 |
|--------|------|
| **运行时小地图** | 大流程(>20 节点)时缩略图 + 当前 cursor 高亮 |
| **变量面板** | 实时显示 `instance.vars` 当前值,可手动改(暂停时) |
| **节点 dry-run 预览** | 编辑时按"预估" → 看 estimateCost 累计:"约 12 次 LLM,~45 秒,$0.08" |
| **JSON / 表单切换** | 高级用户直接编 JSON,普通用户用拖拽 |
| **节点搜索(命令面板风格)** | / 触发节点搜索,键盘选择 |
| **断点 + 步进调试** | 已有,加 watch 表达式("当 vars.x > 3 时停") |
| **历史运行 timeline** | 看某次 instance 各节点的 start/end + 用时分布 |

### 7.3 编辑器分离(中长期)

把 6635 行的 dialog 拆出 4 个 Vue 组件:
- `WorkflowCanvas.vue`(渲染 + 拖拽)
- `WorkflowNodeInspector.vue`(右侧节点配置)
- `WorkflowDebugger.vue`(调试控制 + 状态)
- `WorkflowVariablesPanel.vue`(变量面板)

主 dialog 当 layout container。这是 P3 已有的 dialog 拆分模式,套用即可。

---

## 8. 与现有系统整合

| 现有系统 | 整合点 |
|----------|--------|
| **assistantTaskRunner** | `assistant-invoke` 节点直接调用,共享 perfTracker / parallelChunks 设置 |
| **capabilityBus** | `bus-call` 节点 = `bus.execute(target, params)`,自动拿到 catalog |
| **shadowRunner** | 工作流 instance 也走 shadow:对比 baseline workflow vs candidate workflow 的整体 RACE 分 |
| **rateLimiter** | engine 在调度 LLM 节点前 acquire token,确保不打爆 quota |
| **opQueue** | 文档操作节点走 leader 序列化 |
| **undoChainBundle** | 工作流开始时 startBundle,每个 doc-op 后 markStep,失败/取消时 undoAll |
| **selectionToken** | 工作流元数据带 selectionToken,跨窗口/重启时还原选区 |
| **toastService** | 关键事件触发 toast(完成/失败/暂停) |
| **broadcast** | 跨窗口 progress 同步 |
| **i18n** | 节点 title / hint / error message 走 `t(...)` |
| **featureFlags** | `parallelExecution` / `autoResume` / `costPreview` 等开关 |
| **promotionFlow** | 工作流可以是被进化的对象 — 每步 prompt / 配置都可有候选版本 |
| **rolloutBucketing** | 新版工作流 5%→100% 灰度上线 |

---

## 9. 阶段路线图

### W1 · 基础修复(1 周)

| 任务 | 输出 |
|------|------|
| W1.1 instance 持久化到 IndexedDB | `workflowInstanceStore.js`(基于 P6 signalStoreIDB 模式) |
| W1.2 重启自动恢复对话框 | `WorkflowResumeDialog.vue` |
| W1.3 emit 事件接入 BroadcastChannel | `workflowRunner` 改造 + `workflowProgressChannel.js` |
| W1.4 emit 事件接入 perfTracker / signalStore | engine 内 startTimer 包装节点 |

### W2 · P0 节点类型(1.5 周)

| 任务 | 输出 |
|------|------|
| W2.1 `assistant-invoke` 节点 | 取代 runner 直接调 runner |
| W2.2 `parallel` 节点(显式 fan-out + join) | join 模式 all/any/first-success |
| W2.3 `loop` 节点(forEach over array / N 次) | 子图迭代,iter scope 暴露 __index/__item |
| W2.4 `human-confirm` 节点 | 暂停 + UI 弹"确认/驳回"按钮 + 自动超时 |

### W3 · P1 节点 + 错误处理增强(1.5 周)

| 任务 | 输出 |
|------|------|
| W3.1 `sub-workflow` 节点(递归调用) | 检测循环引用 + 深度限制(默认 5) |
| W3.2 `chat-once` / `chat-stream` 节点 | 单 LLM 调用,免去"先建助手"步骤 |
| W3.3 `try-catch` 节点 | catch 分支 + 错误上下文暴露给下游 |
| W3.4 重试策略统一 | retries / backoff(exp/linear) / circuit breaker |
| W3.5 节点 estimateCost / validate 接口 | 编辑器 dry-run 预览 |

### W4 · 编辑器增强(1.5 周)

| 任务 | 输出 |
|------|------|
| W4.1 编辑期成本预览 panel | 节点改动后实时累计 |
| W4.2 变量面板(real-time + watch) | 暂停时可手改 vars |
| W4.3 历史运行 timeline 面板 | gantt 风格,每节点起止 |
| W4.4 JSON ↔ 表单切换 | Monaco editor 集成 |
| W4.5 拆分 TaskOrchestrationDialog 为 4 子组件 | Canvas / Inspector / Debugger / Variables |

### W5 · 模板与共享(1 周)

| 任务 | 输出 |
|------|------|
| W5.1 内置 8 个工作流模板 | 合同审查 / 会议纪要 / 论文摘要 / 批量结构化 / 多模型对比 / 翻译质检 / 报告生成 / 数据清洗 |
| W5.2 工作流 export / import JSON | 同 teamShare 格式,签名校验 |
| W5.3 工作流市场(集成 marketplace) | `chayuan://install?wf=...` |
| W5.4 工作流版本化 | semver + diff 视图 |

### W6 · 进化系统集成(1 周)

| 任务 | 输出 |
|------|------|
| W6.1 工作流作为进化单元 | candidate 是「修改后的工作流 JSON」 |
| W6.2 RACE 评测扩展到工作流级 | reliability=完成率 / accuracy=输出 vs 期望 / compliance=未越界 / efficiency=p95 |
| W6.3 shadow run 工作流(并行跑 baseline + candidate) | recordComparison 比对总输出 |
| W6.4 rolloutBucketing 用于工作流 | 5%→100% 渐进 |

### W7 · 高级特性(1.5 周)

| 任务 | 输出 |
|------|------|
| W7.1 `code-snippet` 安全沙箱(AST 审查 + API allowlist) | iframe + postMessage |
| W7.2 `aggregate-list` / `map-reduce` 节点 | 函数式风格 |
| W7.3 RAG 节点(`rag-retrieve` / `embedding`) | 接 P6 ragIndex |
| W7.4 多模态节点(image / audio / video) | 接 P6 chatApiMultimodal |
| W7.5 触发器(scheduled / event-based) | cron 表达式 + 文档打开/保存事件 |
| W7.6 timeline replay(历史 run 重放调试) | 慢速重放 + 看每节点 stack |

---

## 10. 风险与开放问题

### 10.1 已识别风险

| 风险 | 缓解 |
|------|------|
| **DAG 循环检测** | 编辑期就拒绝;运行期再次 assert |
| **sub-workflow 死循环** | 深度限制 5 + 定时心跳超时 |
| **LLM 成本失控** | rateLimiter + 编辑期 estimateCost + 单工作流配额 |
| **文档并发写冲突** | leader + opQueue;两个 instance 同时写同 doc → 后者 enqueue |
| **变量类型错配** | 节点 inputPorts type 标注 + 编辑期 lint |
| **暂停 24 小时**(human-confirm 没人理) | 自动超时 → 跳到 timeout 分支或 fail |
| **页面刷新中途状态丢** | snapshot 持久化 + 重启恢复对话框 |
| **多窗口同时编辑同工作流** | leader 才能编辑保存,其他窗口 readonly |
| **第三方 sub-workflow 注入恶意逻辑** | install 时签名校验(marketplaceCryptoSigner) |

### 10.2 开放问题

1. **变量绑定语法**:用 `{{vars.x}}`(Mustache 风格)还是 `${vars.x}`(template literal)?当前 workflowTools 用前者,保持一致。
2. **节点 ID 生成**:UUID v4 还是 `n_${seq}`?后者可读性好但跨设备分享时可能冲突。
3. **如何表达"等用户改完文档再继续"**:是 `human-confirm` 的 timeout 模式,还是新增 `wait-for-event` 节点?
4. **支持 GraphQL / OpenAPI 自动导入吗**:`http-request` 节点扩展为读 spec 自动生成。
5. **能否把现有 `assistantTaskRunner` 内部逻辑改写为一个工作流?** — 长期目标,即"所有任务都是工作流",assistantTask 是预制流的实例化。

### 10.3 不做的事

| 不做 | 理由 |
|------|------|
| BPMN 2.0 / Camunda 兼容 | 用户群不需要企业级流程 |
| 编译为代码 | 维护两套不值 |
| 服务端调度 | 项目纯客户端 |
| GraphQL 风格 schema 演进 | 工作流不变频高,JSON 直接改即可 |

---

## 11. 模板与示例

### 11.1 模板 1:合同审查(W5 内置)

```json
{
  "id": "tmpl.contract-audit",
  "name": "合同审查流水线",
  "description": "抽条款 → 4 维并行审 → 合并报告 → 写回批注",
  "version": "1.0.0",
  "nodes": [
    { "id": "n0", "type": "__start__" },
    { "id": "n1", "type": "assistant-invoke",
      "config": { "assistantId": "analysis.legal-clause-audit" } },
    { "id": "n2", "type": "parallel",
      "config": { "waitMode": "all", "branches": [
        { "type": "assistant-invoke", "assistantId": "analysis.cite-pull" },
        { "type": "assistant-invoke", "assistantId": "analysis.medical-term-normalize" },
        { "type": "assistant-invoke", "assistantId": "analysis.financial-consistency" }
      ] }
    },
    { "id": "n3", "type": "content-merge",
      "config": { "strategy": "structured-report" } },
    { "id": "n4", "type": "human-confirm",
      "config": { "title": "审查报告确认", "timeoutMs": 600000 } },
    { "id": "n5", "type": "wps-capability",
      "config": { "capability": "document.appendComment" } },
    { "id": "n6", "type": "__end__" }
  ],
  "edges": [
    { "source": "n0", "target": "n1" },
    { "source": "n1", "target": "n2" },
    { "source": "n2", "target": "n3" },
    { "source": "n3", "target": "n4" },
    { "source": "n4", "target": "n5", "label": "approve" },
    { "source": "n4", "target": "n6", "label": "reject" },
    { "source": "n5", "target": "n6" }
  ]
}
```

### 11.2 模板 2:批量结构化抽取

```
[start] → [doc.getParagraphs] → [loop forEach paragraph]
                                   └─ [chat-once: extract JSON]
                                   └─ [json-extract: validate schema]
                                   └─ [aggregate-list]
         → [content-merge] → [doc.appendTable] → [end]
```

### 11.3 模板 3:多模型 A/B(进化系统专用)

```
[start] → [parallel any]
   ├─ [chat-once: model A]
   ├─ [chat-once: model B]
   └─ [chat-once: model C]
→ [llm-judge: rank outputs] → [content-merge: best] → [end]
```

---

## 12. 验收指标

| 指标 | 目标值 | 现状 |
|------|--------|------|
| 工作流定义可序列化往返(JSON ↔ 内存) | 100% | ✅ |
| 节点状态机 6 状态全覆盖 | 100% | 🟡 部分(无 waiting / paused) |
| 长流程(>5 分钟)中途刷新可恢复 | 100% | ❌ 待 W1.1 |
| 跨窗口进度同步延迟 | < 200ms | ❌ 待 W1.3 |
| 编辑器 dry-run 成本预览准确率 | ±20% | ❌ 待 W3.5 |
| sub-workflow 深度上限 | 5 | ❌ 待 W3.1 |
| LLM 调用受 rateLimiter 控制 | 100% | ❌ 待 W2.x 节点改造 |
| 失败时 undoChainBundle 自动回退 | 100%(开 flag) | ❌ 待 W2.x |
| 工作流模板数量 | ≥ 8 | ❌ 待 W5.1 |
| 工作流可参与 RACE 进化评测 | 1 个示例 | ❌ 待 W6.x |

---

## 总览

```
当前能力           ──────────  60% ━━━━━━━━━━━━
W1 持久化恢复     ──────────  +10% ━━━━━━
W2 P0 节点         ──────────  +10% ━━━━━━
W3 P1 节点 + 错误  ──────────  +5%
W4 编辑器          ──────────  +5%
W5 模板共享       ──────────  +3%
W6 进化集成       ──────────  +5%
W7 高级特性       ──────────  +2%
                              ━━━━━━━━━━━━
                              100%
```

P0 ~ P5 的进化系统 / ⌘K / ribbon 增强等基础设施都已 ready,工作流系统是**最后一块大拼图** — 把这些散件织成"用户可编排的执行单元"。

阶段交付节奏:每周一个里程碑,**8 周完成** P0/P1 部分(W1-W4),进入第 9 周 demo 评审,W5-W7 看市场反馈逐步加。
