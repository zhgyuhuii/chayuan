# P6 — 全面闭合计划

> **基于 v2 + 缺口闭合后的**「全面分析」**结果**(参见上一轮回复)。
> 本计划针对 **未真正接通 / 体验脆弱 / 架构盲区 / 市场盲区** 的所有问题逐项落地。

**总目标**:把当前「基础设施完成度 90% / 实际接通率 30% / 真实体验 50%」推到「**接通率 ≥ 80% + 体验 ≥ 75%**」。

---

## Tier 1 · 必须立即做(影响产品成败)

| # | 任务 | 难度 | 文件 |
|---|---|---|---|
| T1.1 | enhancedSend 真正接入 sendMessage 路径 | 🔴 | `enhancedSendIntegration.js` + dialogPlugins 钩子接入 |
| T1.2 | shadowRunner 包装层 `chatCompletionWithShadow` | 🟠 | `host/chatCompletionWithShadow.js` |
| T1.3 | Toast 通知系统 + 全局错误友好化 | 🟠 | `common/Toast.vue` + `toastService.js` |
| T1.4 | AIAssistantDialog 第一刀切出 MessageList | 🔴 | `common/MessageList.vue`(独立 stub,不动主文件) |
| T1.5 | main.js 启动 scheduler + 高频回滚检查 | 🟠 | `main.js` 修改 + `evolution/installScheduler.js` |

## Tier 2 · 短期改进(2 周内)

| # | 任务 | 难度 | 文件 |
|---|---|---|---|
| T2.1 | 暗色模式审计 + 修复 | 🟡 | `darkModeAudit.mjs` 扫描 + `assets/dark-mode-fixes.css` |
| T2.2 | 单家族判官降级 | 🟠 | `judge.js` 修改 + 自洽性 fallback |
| T2.3 | signalStore IndexedDB 后端 | 🟠 | `evolution/signalStoreIDB.js` |
| T2.4 | Vue ErrorBoundary 全局 | 🟡 | `common/ErrorBoundary.vue` |
| T2.5 | 助手创建/导入自动 registerAnchor | 🟡 | `assistantSettings.js` 钩子 |
| T2.6 | LLM token-bucket rate limiter | 🟠 | `host/rateLimiter.js` |
| T2.7 | 助手页 progressive disclosure | 🟡 | `EvolutionStatusPanel.vue` 折叠优化 |
| T2.8 | 全键盘 tab order audit | 🟡 | `common/focusTrap.js` |

## Tier 3 · 中期(平台演进)

| # | 任务 | 难度 | 文件 |
|---|---|---|---|
| T3.1 | JSDoc 类型注解 (router/host 优先) | 🟡 | `types/*.d.ts` |
| T3.2 | opQueue 自动 leader 选举 | 🟠 | `host/opQueue.js` 增强 |
| T3.3 | Web Worker for failureCluster | 🟠 | `workers/clusterWorker.js` |
| T3.4 | streamChatCompletion abort 完整化 | 🟡 | `chatApi.js` 改进版 `chatApiAbortAware.js` |
| T3.5 | OPFS 大文件存储 | 🟠 | `host/opfsStorage.js` |
| T3.6 | feature flags 运行时切换 | 🟡 | `featureFlags.js` |
| T3.7 | router guards | 🟡 | `router/guards.js` |
| T3.8 | service-layer 抽象 | 🟠 | `services/*` 索引 |

## Tier 4 · 长期 / 产品化

| # | 任务 | 难度 | 文件 |
|---|---|---|---|
| T4.1 | License / activation 骨架 | 🟠 | `licenseStore.js` |
| T4.2 | RAG 骨架(向量索引接口) | 🟠 | `assistant/ragIndex.js` |
| T4.3 | 多模态 image 输入接口 | 🟠 | `chatApiMultimodal.js` |
| T4.4 | telemetry pipeline 骨架 | 🟡 | `telemetryPipeline.js` |
| T4.5 | 真密码学签名(Web Crypto) | 🟠 | `marketplaceCryptoSigner.js` |
| T4.6 | A/B test 统计显著性 | 🟡 | `evolution/abTestStats.js` |
| T4.7 | 全局 i18n audit | 🟡 | `audit-i18n.mjs` |
| T4.8 | 分享 / 引荐机制 | 🟡 | `referralEngine.js` |

---

## 实施约束

1. **不动 19111 行 AIAssistantDialog.vue 主文件** — 通过 `dialogPlugins` 钩子或独立 stub 完成接入
2. **不动 4280 行 ribbon.js OnAction 主体** — 通过 `ribbonBusDispatcher` 双轨提供 bus 路径
3. **每个 Tier 4 项目以「骨架 + 占位」交付** — 真正落地依赖产品化进入实质阶段
4. **行为零退化** — 所有现有功能保持可工作,新功能默认 off / 通过 feature flag 启用
5. **每项交付后** `npm run doctor:quick` + `npm run test:evolution` 全绿

---

## 累计后预期

- **新增文件**:~30 个(Tier 1 × 5 + Tier 2 × 8 + Tier 3 × 8 + Tier 4 × 8)
- **新增行数**:~3000-4000
- **总文件数**:~106(之前 76 + 新 30)
- **总行数**:~18000-19000
