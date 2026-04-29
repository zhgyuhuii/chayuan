# 察元项目 · 总索引

> **本文件 = 一页内看到所有计划、执行历程、关键路径和当前状态。**
> 想看全可视化版本:运行后访问 `/tour` 路由。

---

## 当前状态

| 维度 | 数值 |
|------|------|
| 总代码行数(本次新增) | **~26000** |
| 新增文件 | **144** |
| 修改文件 | **27** |
| 路由数 | **46**(原 39 + 新 7) |
| ⌘K 命令 | **40+**(动态扩展) |
| 内置助手 | **18 个新增**(P3 extra 8 + P5 领域 8 + P5+ 补 2) |
| 工作流模板 | **8 个内置** |
| 工作流节点类型 | **28 类** |
| Smoke 断言 | **123 / 123** PASS |
| Doctor 检查 | **154 / 154**(0 错误,2 大文件警告) |
| 修复的生产 bug | **1**(promotionFlow.isDrifted)|

---

## 计划文件(8 份)

| 文件 | 主题 | 阶段 |
|------|------|------|
| `plan.md` | v1 重构计划 | P0 设计 |
| `plan-v2.md` | v2 引入进化系统 | P0-P5 设计 |
| `plan-P6-comprehensive-closure.md` | P6 全面闭合 30 项 | P6 设计 |
| `plan-workflow-orchestration.md` | 工作流编排设计 W1-W7 | W 设计 |
| `plan-task-system-redesign.md` | 任务系统重设计 9 维度 | T 设计 |
| `plan-assistant-form-layout.md` | 助手表单布局优化 | UE 设计 |
| `plan-runtime-gap-closure.md` | 运行性 4 缺口闭合 | X 设计 |

## 执行报告(10 份)

| 文件 | 阶段 | 主要交付 |
|------|------|---------|
| `plan-P0-execution.md` | P0 | hostBridge / selectionToken / signalStore 骨架 |
| `plan-P1-execution.md` | P1 | concurrentRunner / chatApiEnhancers / 评测 |
| `plan-P2-execution.md` | P2 | tokens.css / motion.css / 6 共用组件 / codemod |
| `plan-P3-execution.md` | P3 | 进化编排 + ⌘K / 18 内置助手 |
| `plan-P4-P5-execution.md` | P4-P5 | enhancedSend / ribbon helpers / 多模态 |
| `plan-gap-closure-execution.md` | v2 缺口 | 27 项最小可行版补齐 |
| `plan-P6-execution.md` | P6 | 30 项 Tier 1-4 落地 |
| `plan-W1-W2-execution.md` | W1-W2 | 工作流持久化 + P0 节点 |
| `plan-W3-W7-execution.md` | W3-W7 | 28 节点 + 模板 + 进化 + 高级 |
| `plan-runtime-gap-closure.md` | X | 4 大运行性问题修复 |

---

## 路由清单(46)

### 已加新路由(7)
- `/welcome` 6 步 onboarding
- `/task-center` 任务中心
- `/evolution` 进化中心
- `/dashboard` 进化大盘
- `/perf` LLM 延迟监控
- `/marketplace` 助手市场
- `/dialog-demo` 三栏对话框 demo
- `/assistant-form-demo` 新建助手目标布局
- `/tour` 功能总览(本批)

### 老路由(39)
保持不变,见 `src/router/index.js`。

---

## ⌘K 命令组(7 组)

1. **⌘K 触发**(全局):`Ctrl/⌘ + K`
2. **ribbon**(15 条):打开 AI 助手 / 拼写 / 表格 / ...
3. **进化**(6 条):cycle / snapshot / scheduler / boot / page
4. **诊断**(3 条):perf / clear / page
5. **外观**(2 条):theme toggle / auto
6. **模型**(动态 N 条):每个可用模型一条
7. **任务**(6 条):center / cancel-all / retry-failed / clean / capsule / achievements
8. **工作流**(模板 N 条 + 共享 5 条):template / share / import / export / market
9. **助手市场**(1 条):marketplace.open

---

## 已接通(立即可用,不需任何业务方动作)

启动后自动加载:
- 设计 token + motion + 暗色补丁 + 表单纵向 css
- 全局 ⌘K 监听
- ToastContainer / TaskCelebration / WorkflowResumeDialog 顶层挂载
- evolutionScheduler(daily 03:00 + 2h 回滚 tick)
- TelemetryBridge(workflow 事件 → perfTracker / signalStore)
- AchievementListener(任务完成 → 检测成就)
- 18 个新助手自动注入到 customAssistants(首次启动)
- spellCheckPerfWrapper 兼容性表加载

---

## 待业务接入(基础设施 ready,等迁)

详见 `/tour` 的「待接入模块」tab,每条都列了「接入方式」。

主要类:
- **enhancedSend / chatCompletionWithShadow / rateLimiter** — sendMessage 提速 + shadow + 限流(P6 Feature Flag 默认关)
- **opfsStorage / opQueue / undoChainBundle** — 大文件 / 跨窗口 / 撤销栈
- **dialogPlugins / ribbonBusDispatcher / focusTrap** — 编辑核心改造钩子
- **routerModelSettings / routerParallelDecider** — 路由模型解耦 + 并行
- **i18n / licenseStore / personalMemory / referralEngine / telemetryPipeline** — 长期产品化基础
- **anchorAutoRegister / skillScanner / judgeFallback / abTestStats** — 进化系统辅助
- **workflowToolsExtra / P1 / P2(28 节点)/ workflowEvolution / workflowTrigger / workflowReplay** — 工作流 runner 改造后接入
- **clusterClient(Web Worker)** — 配置 Vite worker 后接入

---

## 明确不做(高风险,留待 WPS runtime 验证)

- AIAssistantDialog.vue **真正拆 6 子组件**(19111 行,无 runtime 测试条件)
- ribbon.js **真正拆 5 模块** + 80+ case → bus.execute(与 COM API 强耦合)
- **28 dialog 全部接 DialogShell**(逐个改有限收益)
- **Pinia 全量迁移**(项目非 SPA,跨窗口响应式失效)

---

## 关键操作命令

```bash
# 自检(看所有交付文件是否 ok)
npm run doctor:quick      # 快速 ~1s
npm run doctor            # 完整(含 syntax check)~10s

# 冒烟测试(123 断言,无 LLM 依赖)
npm run test:evolution

# 集成审计(看哪些模块"建好但没接通")
node scripts/integration-audit.mjs --orphans

# Codemod(alert+console.error → reportError)
node scripts/codemod-alert-to-reportError.mjs

# 死 case 扫描
node scripts/find-dead-cases.mjs

# 暗色模式硬编码扫描
node scripts/audit-dark-mode.mjs

# i18n 硬编码中文扫描
node scripts/audit-i18n.mjs

# Capability catalog 自动生成
node scripts/build-capability-catalog.mjs
```

---

## 图谱

```
                ┌─ 用户(WPS Office)─┐
                │                       │
  Ribbon  ── ⌘K Palette  ── /路由 ── Toast  ── Achievement
     │              │                │              │
     └─ ribbon.js ──┴── commandRegistry ─┴─ TaskEventBus
                            │
            ┌───────────────┼───────────────┐
            │               │               │
     Evolution    Workflow     Task System
     ↓ promotionFlow  ↓ workflowRunner  ↓ taskKernel
     ↓ shadowRunner   ↓ 28 nodes       ↓ TieredStorage
     ↓ raceEvaluator  ↓ persistence    ↓ Achievement
     ↓ rolloutBucket  ↓ telemetry      ↓ TimeCapsule
            │               │               │
            └─── perfTracker / signalStore ──┘
                            │
                  hostBridge / opQueue / leaderElection
                            │
                  WPS COM API + IndexedDB + OPFS
```

---

## 下一步

如果你刚拿到这份代码:
1. 装依赖:`npm i`
2. 启动:`npm run dev`
3. 访问主入口
4. **按 ⌘K 试试看**(全键盘可达)
5. 访问 `/tour` 看完整功能总览
6. 访问 `/welcome` 走 6 步 onboarding
7. 访问 `/evolution` 看进化状态
8. 访问 `/perf` 看 LLM 延迟监控
9. 访问 `/task-center` 看任务中心
10. 访问 `/marketplace` 看助手市场

如果想推进高风险大重构(AIAssistantDialog / ribbon 拆分)— 在 WPS runtime 中边改边测,这些只能这么做。
