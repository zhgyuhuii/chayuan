# Model S：对话驻留与文档路由绑定 —— 共识定稿（2026-11-21）

九题拷问逐题裁决，探针实证背书。实施依据文档，P0-P4 分期推进。

## 〇、探针实证（承重墙，2026-11-21 真机）

S2 路由探针（`docRouteProbe.js`，临时仪器）全绿：非活动 Document 对象可**完整静默读写**——
Content.Text/Paragraphs.Count 读、Find.Execute 定位、Content.InsertAfter 插入、命中区替换、
docLinkId 载体（Variables）读+写+读回一致；零 Activate、零 Selection、5-74ms、零崩溃；
写入切回后**渲染可见**。ET/WPP 矪阵与 P6（非活动+真实路径 doc.Save）待补测。

崩溃雷点入账：`document_open` 对**已打开**文档二次 Open = SIGBUS @ CrBrowserMain
（ksojscore→jswpsapi，与既有崩溃族同签）。激活语义必须 `doc.Activate()`，产品缺陷待修。

## 一、九题裁决

| # | 议题 | 裁决 |
|---|------|------|
| 1 | 绑定主凭据 | **docLinkId 优先 + FullName 兜底**复合凭据；FullName 降级为诊断信息 |
| 2 | 并行度 | v1 **执行串行**（LLM 串行锁现状）；「分文档」指绑定与写目标，不是并行跑；多窗口按文档路由为后续优化 |
| 3 | 模式边界 | 被 S2 证降级为非分叉：单 webview + 对象模型已覆盖多窗口/多标签；路由层降为优化项 |
| 4 | 跨文档执行策略 | **S2 纯对象模型静默写**（探针全绿），免 Activate； Activate 仅保留给需要视觉反馈的场景 |
| 5 | 面板归属交互 | **(c) 混合**：会话列表条目标注文档名 + 胶囊常显当前绑定（含未保存/已关状态）+ 切文档时一次性提示条「当前对话绑定 A → [切到 B]」 |
| 6 | 初始绑定与改绑 | **(c) 快照+改绑**：新对话快照绑定发起瞬间活动文档（无文档落 no_active_document 兜底键）；改绑 = 整条对话原子迁移到新 scope 键 + 墓碑防复活；进行中回合按**发起时绑定**执行、落库跟随**对话容器当前键**（写对目标与存储归属解耦） |
| 7 | 孤儿会话 | **(b) 按回合类型分流**：纯问答放行（对话历史降级回答）；读/写类拦截，给「重新打开文档」（Documents.Open，元数据三件套 docLinkId/fullName/name，Open 失败降级手动+绑定）与「改绑当前文档」（复用改绑）两按钮；胶囊显示已关闭灰色态 |
| 8 | 选区一致性 | **(a) 一致性强制**：选区类入口仅「绑定==活动」可用，不一致走提示条改绑；ribbon 直启创建新对话快照绑定活动文档（天然自洽） |
| 9 | 实施切分 | P0 止血 → P1 绑定层 → P2 面板驻留 → P3 改绑与孤儿 → P4 验收回归；分期真机验收 |

## 二、与 v2 终稿（多文档会话绑定方案）的差异

- **废弃**：隐式跟随 + 撕贴条（F3 原义）→ 改为「不跟随 + 提示条可回弹」；
  busy 清屏切 scope 三重防线 → 面板驻留后整体退役；「历史按消息 scope 落库」（F4 原义）
  → 对话可迁移后改为**对话原子**归属（消息跟随容器）。
- **继承**：docLinkId 文件内身份（T1b 三宿主）、scope 分库存储、session-store 三重写穿、
  LRU、发送快照钉回合、写锁 FIFO。
- **新增**：S2 静默执行路径（resolveTargetDoc 替代 requireDoc）、复合凭据 pin
  （docLinkId+fullName）、胶囊/提示条/改绑/孤儿四组 UI 状态。

## 三、P0 止血项（与 Model S 正交，先行合入）

1. `dispatch.js` spread 条件吞 null：`...(baselineToken ? { baselineToken } : {})` 把
   null 展开成缺省 → 写锁 `String(undefined||'')` 退回匿名槽 → 陈旧基线硬校验误报
   「活动文档已切换」（2026-11-21 真机写回失败直接根因）。修复：baselineToken 显式传透
   （null 含），写锁侧 `opts.baselineToken === null ? null : String(...)`。
2. `documentWriteLock` 实现 `occAdvisory` 语义（dispatch 注释引用但锁侧缺失）：
   advisory=true 时 OCC 判败降级为 console.warn 放行，防误写由 __expectedDocId +
   originalText + FIFO 承担；本地直调链路（不带 advisory）OCC 硬校验不变。
3. `AIAssistantDialog.vue` runAssistantAgentFromCard 重复键：`targetDocumentId:
   turnTargetDocId||undefined` 被后置字面量 `targetDocumentId: undefined` 覆盖，
   回合目标凭据静默丢失。修复：删后置字面量。

## 四、验收用例（P4 真机）

1. A 对话生成中 → 切 B → 面板不动（提示条现）→ A 回合完成写 A，切回 A 可见（今日故障反演）
2. B 旁发 A 会话纯问答 → 直接回答，不切不拦
3. 改绑 A→B：列表迁移 + 墓碑防复活
4. 关闭 A：纯问答可发；写类拦截 → 重开按钮恢复
5. ribbon 助手 → 新对话快照绑定活动文档
6. 另存为 A2 → 绑定跟随（docLinkId）不误报
7. 存量会话打开正常（零迁移兼容）

## 五、收尾作业挂账

- 摘探针：`docRouteProbe.js` + dispatch/sidecar 两处 case（实现期真机验证用完后）
- sidecar 还原二进制模式：`runtime/bin/chayuan-mcp-macos-arm64` 与
  `runtime/lib/mcpHandler.mjs` 均有 `.probe-bak`，恢复后 `launchctl kickstart -k
  gui/$(id -u)/com.chayuan.mcp`
- document_open 激活语义修复（doc.Activate 替代二次 Open）列为独立小修
