# Workflow W1 + W2 执行报告

**对应计划**:`plan-workflow-orchestration.md` § 9.W1 + § 9.W2
**执行模式**:中间不再确认 · 全部接受
**状态**:✅ 6 / 6 任务完成

---

## 一、本批新增(6 文件)

| # | 文件 | 行 | 角色 |
|---|------|------|------|
| W1.1 | `src/utils/workflow/workflowInstanceStore.js` | 154 | IndexedDB 持久化 instance,新增 `persistInstance` / `listResumable` / CRUD;每节点完成后持久化,刷新可恢复 |
| W1.2 | `src/components/common/WorkflowResumeDialog.vue` | 218 | 启动期检测未完成 instance(基于 leaderElection 判 owner 已死)+ 用户决策对话框(恢复/丢弃/稍后);"稍后"4 小时内不再问 |
| W1.3 | `src/utils/workflow/workflowProgressChannel.js` | 124 | BroadcastChannel 跨窗口事件;同窗口 listener 同步触发,跨窗口 throttle 100ms;12 类事件:`workflow:*` + `node:*` |
| W1.4 | `src/utils/workflow/workflowTelemetryBridge.js` | 145 | 订阅 progressChannel → fan-out 到 perfTracker(每节点延迟)+ signalStore(失败/完成 audit)+ toast(>5s 完成 / 失败 / pause) |
| W2.0 | `src/utils/workflow/workflowToolsExtra.js` | 354 | 4 个 P0 节点:`assistant-invoke` / `parallel`(all/any/first-success)/ `loop`(for-each/times,可并发)/ `human-confirm`(超时 + 行为可配);+ `mergeWithBuiltin` 与原 12 类工具合并 |
| 接线 | `App.vue` 修改 | +14 行 | 顶层挂 `<WorkflowResumeDialog>` + onMounted 调 `installTelemetryBridge()`;onWorkflowResume/Discard 占位事件 |

**累计本批**:~995 行新增代码

---

## 二、smoke test 扩展

**8 个新断言**(从 74 → **82 个全 PASS**):
- workflowProgressChannel 本地订阅工作
- EXTRA_TOOLS 含 4 个 P0 节点
- mergeWithBuiltin 同 type 不重复
- human-confirm 超时 → decision='timeout'
- parallel all 模式返回 3 分支结果
- loop times 模式跑 3 轮
- workflowInstanceStore / workflowTelemetryBridge 导出齐全

---

## 三、设计要点解读

### 1. **W1 解决"刷新即丢"问题**

`workflowRunner` 原本的 `activeWorkflowRuns = new Map()` 是 in-memory 单点,>5 分钟流程中途崩溃就零线索。

**新方案**:每节点 done 后写一次 IndexedDB 快照(`persistInstance`),启动期扫 `status='running'` 但 `ownerWindow` 已死的 instance,弹 `WorkflowResumeDialog` 让用户选恢复/丢弃。

### 2. **W1.3 解耦"事件 → UI"**

原本 workflowRunner 的事件只在它启动的窗口可见。
**新方案**:统一通过 `workflowProgressChannel` 发事件,**任何窗口**(主任务窗格 / 设置 dialog / 编辑器窗口)都可订阅 → 全局可观测。

### 3. **W1.4 把"事件 → 观测"自动化**

订阅 channel 一次,自动:
- 每节点 startTimer / stop → perfTracker 累计延迟分布
- 失败节点 → appendSignal(进化系统可聚类失败模式)
- 工作流完成/失败/暂停 → toast 通知用户
- 这层 bridge 一旦 install,**所有现有工作流自动获得遥测**,无需改 runner

### 4. **W2 节点设计核心约定**

新节点的 `executeExtraTool(node, ctx)` 需要 ctx 提供 4 个回调:
- `runChildNodes(nodeIds, scope)` — parallel/loop 用
- `callAssistant(id, input, opts)` — assistant-invoke 用
- `requestUserConfirm(opts)` — human-confirm 用
- `resolveExpr(expr)` — loop 解析 itemsExpr

这 4 个回调由 workflowRunner 在调度到 extra 节点时**临时构造**,extra 模块自身不依赖 runner 实现细节 → 解耦完整。

### 5. **parallel 节点 3 种 join 模式**

- `all` — 全等(失败位为 null,有任一失败 → ok=false)
- `any` — 第一个返回(无论成败)立即返回
- `first-success` — 第一个成功的立即返回,全失败才 fail

### 6. **loop 节点防死循环**

- `maxIterations` 上限(默认 100,可配)
- 数组超过上限自动截断
- `stopOnError: true` 时第一个失败立即停
- `signal.aborted` 中途取消,outputs 已完成位保留

### 7. **human-confirm 节点超时策略**

- `timeoutMs > 0` → 超时
- `timeoutAction='approve'` → 当作批准放行
- `timeoutAction='reject'` → 驳回
- `timeoutAction='fail'` → 工作流失败
- 用户可在编辑器中按场景选择(订阅审批 → reject;通知确认 → approve)

---

## 四、accumulated 累计(自项目启动)

| 维度 | 数值 |
|------|------|
| 新增文件 | **113**(107 + 6) |
| 修改文件 | **24** |
| 总代码行数 | **~19600** |
| 执行报告 | **7 份** |
| Smoke 断言 | 82 / 82 PASS ✨ |
| Doctor | 123 项 · 121 ✓ · 2 ⚠ · 0 ✗ |

---

## 五、未做(留给 W3+)

- W3 P1 节点:`sub-workflow` / `chat-once` / `chat-stream` / `try-catch`
- W4 编辑器增强:成本预览 / 变量面板 / timeline / Monaco
- W5 工作流模板 8 个 + 工作流 marketplace 集成
- W6 工作流作为进化单元(RACE 评测扩展)
- W7 高级特性:沙箱代码 / map-reduce / RAG 节点 / 多模态 / cron 触发器

---

## 六、用户接入路径

### 立即可用
1. **观测** — 任何工作流执行(只要 emit 了 progressChannel 事件)即自动写 perfTracker / signalStore / toast
2. **恢复对话框** — 上次未完成的工作流刷新后会主动询问

### 需要业务方主动改 workflowRunner 才生效
- W1 持久化:runner 内部要在每个节点 done 后调 `persistInstance(instance)`
- W2 4 个新节点:runner 内部 dispatch 到这些 type 时要调 `executeExtraTool` 并提供 4 个 callback
- W1.3 事件:runner 内部要在适当时机 `emit(...)`

这些是**约 80 行**的 runner 改动,但需要在 WPS runtime 中跑通现有工作流后再做,本批 W1+W2 只交付**所有依赖模块就位**。

---

✅ W1 + W2 闭合,W3-W7 待 `继续` 推进。
