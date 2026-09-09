# AI 助手停靠功能 · 完整实施计划（已达成共识，未写产品代码）

> 状态：**共识已达成，探针已验证，产品代码零改动**。新对话可直接按本计划第 7 节顺序开工。
> 探针原始数据与工具：`scripts/probe-dock/`（含 README 复测步骤、macOS 两轮实测数据 jsonl）。
> 本文档由 2026-09-09 会话产出；所有能力均已在 WPS Mac 12.1.28492 实测，Windows/Linux 未实测（有运行时探测兜底设计）。

## 1. 背景与目标

AI 助手目前是 `window.Application.ShowDialog()` 打开的原生悬浮窗（900×700 逻辑 px × DPR，加载 Vue 路由 `/ai-assistant` → `src/components/AIAssistantDialog.vue`，约 2.2 万行）。目标：在对话框右上角提供**单个"停靠"按钮 + 下拉菜单**：

- 停靠左侧 / 停靠右侧 / 停靠下方 / 悬浮 / 关闭（五项全做，菜单内画方向示意图）
- 真实拖拽吸附由 **WPS 原生手势**承担（探针与用户实测：分隔条拖出成浮动窗、浮动窗拖到边缘自动吸附），产品不做自定义吸附提示图层
- 停靠实现方式：关闭 ShowDialog 浮窗 → `Application.CreateTaskPane` 加载同一个 `/ai-assistant` 路由 → 设 `DockPosition`（复用 `src/components/ribbon.js:949-998` 的 `showTaskPane` 已验证模式）

## 2. 实测能力矩阵（WPS Mac 12.1.28492，探针验证）

| 能力 | 结论 |
|---|---|
| TaskPane 左/右/上/下停靠 | ✅ **四向全部真实可用**（上/下横跨全宽；按钮组只做 左/右/下，上不做入口） |
| 尺寸设置时序坑 | ⚠️ 切 `DockPosition` 后必须**延迟 ≥~400ms** 再设 `Width/Height`；立即设会得到 14px 高的坏死面板，且同步读回值是假的（读到旧值）。产品代码必须用"面板页 resize 回报真实尺寸 + 有界重试"（见第 6 节） |
| 浮动（`msoCTPDockPositionFloating=4`） | ✅ 可用；平时无可见 chrome；分隔条拖过阈值 → 拖出成浮动窗（`outerWidth` 出现独立窗框为信号）；浮动窗拖到边缘 **WPS 原生自动吸附**（用户实测） |
| ShowDialog 窗口 | `screenX/Y` 可读、`window.moveTo` 生效、`resizeTo` 无效（本期不依赖） |
| localStorage 共享 | ✅ ribbon 页 / TaskPane / ShowDialog 三方**双向共享** → 聊天记录、收藏、草稿跨形态无缝延续，无需迁移 |
| webview | Chromium 104，`file://` 加载 jsaddons 目录 |
| 注册约定 | Mac jsaddons 目录名必须 `{name}_{version}`，否则不加载（探针踩过） |

注意：`ribbon.js:954` 注释"WPS的TaskPane只支持左右停靠，上下位置使用ShowDialog实现"**已过时**（上下停靠可用，旧结论源于第 2 行的时序竞态误判）。

## 3. 已达成共识的决定（逐条确认过）

1. **点按钮停靠**替代自定义拖拽吸附（原生窗口 OS 层拖动页面收不到事件）；WPS 原生拖拽吸附作为体验赠品，不写承诺、不定制样式
2. **停靠下方先探针再定** → 探针结论：可用（延迟设高），按钮组五项全保留；仍保留运行时探测兜底防 Windows/Linux 差异
3. 停靠 UI **同路由响应式适配**：`/ai-assistant?mode=taskpane`，≤500px 折叠历史侧栏、消息/输入紧凑化、欢迎页简化；不碰对话逻辑，浮窗态不受影响
4. ribbon"AI助手"按钮**按上次形态打开**（PluginStorage 记忆 float/left/right/bottom）；已开着则聚焦不重复开；**不做 WPS 启动自动弹面板**
5. **生成中切换弹自定义确认框**（用 `src/utils/inAppDialog.js`，WPS 劫持原生 confirm）：生成/流式进行中切换先确认"将中断当前生成"；**输入框草稿持久化**到 localStorage，切回来不丢字
6. **运行时能力探测 + 静默回退**：切换中途失败自动回退浮窗；某方向不支持则菜单隐藏该项（探测配方见第 6 节）
7. 右上角**单按钮下拉菜单**（窄面板放不下五个图标按钮），菜单项：停靠左侧/右侧/下方、悬浮、关闭，配方向示意图
8. 关闭 = 退出助手（浮窗态关窗 / 停靠态销毁面板）；悬浮 = 切回浮窗；浮窗与停靠**严格互斥**，切换原子交接（先建后关，锁同事务交接）
9. TaskPane 宽/高：可设则记忆上次尺寸（PluginStorage），不可设用 WPS 默认
10. 本期只做 AI 助手，设置等其他 ShowDialog 不跟进

## 4. 现状关键代码位置

- `openAIAssistantDialog()` — `src/components/ribbon.js:117-127`（ShowDialog 创建，900×700×DPR）
- `showAIAssistantDialog()` — `ribbon.js:129-138`（单实例聚焦/重开，`reopenExistingAIAssistantWindow`）
- `showTaskPane(position, route)` — `ribbon.js:949-998`（CreateTaskPane + DockPosition 模式，storage key `taskpane_${position}_${routeKey}_id`）
- 单实例锁 — `src/utils/aiAssistantWindowManager.js`（localStorage 心跳 + storage 事件：`nd_ai_assistant_window_lock` / `_request`）；对话框侧 `AIAssistantDialog.vue:6058-6075`（closeWindow/reopen）
- 侧栏宽度持久化参考 — `AIAssistantDialog.vue:2525-2526, 6100-6115`（PluginStorage：`ai_assistant_sidebar_width/collapsed`）
- 聊天历史 key — `AIAssistantDialog.vue:2515-2520`（`ai_assistant_chat_history*`，localStorage 同源共享即跨形态延续）
- 自定义确认框 — `src/utils/inAppDialog.js`
- 路由 — `src/router/index.js:174-178`（`/ai-assistant`）
- 关窗后回焦宿主 — `src/main.js:24-30` + `src/utils/windowActivation.js`
- 菜单触发点 — `ribbon.js:3226-3227`（btnAIAssistant）与 `3605/3613/3621`（右键菜单）

## 5. 架构设计

### 5.1 新增 `src/utils/host/aiAssistantDockManager.js`（核心，纯 JS 可单测）

职责：形态状态机 + WPS 调用封装。API（建议）：

```
getMode() / setMode(mode)                 // 'float' | 'left' | 'right' | 'bottom'
openAs(mode, query)                        // 按形态打开（float=ShowDialog，其余=CreateTaskPane）
dockTo(mode)                               // 浮窗↔停靠切换：建新→验尺寸→关旧（原子交接）
undockToFloat()                            // 停靠→浮窗
closeAll()                                 // 全形态关闭
isDockSupported(mode)                      // 运行时探测缓存
```

要点：
- PluginStorage keys：`ai_assistant_dock_mode`（记忆）、`ai_assistant_taskpane_id`（当前面板 id）、`ai_assistant_dock_probe`（探测结果缓存）、`ai_assistant_dock_width/height`（尺寸记忆）
- 面板 URL：`Util.GetUrlPath() + Util.GetRouterHash() + '/ai-assistant?mode=taskpane&dock=' + mode`
- **尺寸设置规范**：`DockPosition` 切换后，面板页监听 `resize` 把真实 `innerWidth/innerHeight` 写 PluginStorage（`ai_assistant_pane_size`）；ribbon 侧轮询比对目标，不匹配有界重试（5 次 × 200ms，首次延迟 400ms）；超时仍 <50px 判该方向不支持 → 隐藏菜单项 / 回退浮窗。**禁止相信 Width/Height 同步读回值**
- 单实例锁交接：dockTo 流程 = 锁标记"交接中" → CreateTaskPane → 面板页 ready（PluginStorage 握手）→ 关 ShowDialog → 释放交接标记；锁 key 复用 `aiAssistantWindowManager`，新增形态字段
- 探测结果按 WPS 版本号缓存（`Application.Version`），避免每次启动重复探测

### 5.2 `AIAssistantDialog.vue` 改动（集中布局层）

- 头部新增 `DockMenuButton` 子组件：下拉菜单五项 + 方向示意图（内联 SVG）；浮窗态显示 左/右/下/关闭，停靠态显示 悬浮/关闭（对侧向置灰）
- 响应式：`?mode=taskpane` 或 `innerWidth ≤ 500` → 折叠历史侧栏（复用现有 `ai_assistant_sidebar_collapsed`）、紧凑气泡/输入区、简化欢迎页；现有 rAF 拖拽分隔条逻辑（`6139-6170`）在窄态禁用
- 生成中状态对接：现有流式请求状态 → 切换前调 `inAppDialog` 确认
- 草稿持久化：输入框 v-model → debounce 写 localStorage `ai_assistant_draft`（挂载时恢复），所有形态共享
- 探针遗留约定：`closeWindow()`（`window.close()`）仅浮窗态用；停靠态走 dockManager 销毁面板

### 5.3 ribbon 侧

- `showAIAssistantDialog()` 改为 `openAIAssistant()`：读 `ai_assistant_dock_mode` → 无实例则按该形态打开 / 有实例则聚焦
- `ribbon.js:954` 过时注释更新，`showTaskPane` 保持不动（其他调用方不受影响）

## 6. 运行时探测与降级（跨端兜底）

- 探测某方向（含 bottom）是否支持：临时设 `DockPosition` → 按第 5.1 规范等面板页回报尺寸 → `<50px` 或超时 = 不支持 → PluginStorage 缓存 + 菜单隐藏该项；探测在首次打开停靠菜单时惰性执行
- 任何切换中途异常 → 静默回退浮窗 + inAppDialog 提示一句
- Windows/Linux 未实测：发布前用 `scripts/probe-dock/README.md` 的三步探针包跑一遍（10 分钟），结果附到本文件末尾

## 7. 实施顺序（建议 4 个提交）

1. **提交 A**：`aiAssistantDockManager.js`（状态机 + 探测 + 重试设尺寸 + 锁交接）+ 单测（node 环境跑纯逻辑部分）；ribbon `openAIAssistant()` 语义改造
2. **提交 B**：对话框头部 DockMenuButton + 菜单 UI + 示意图；dockTo/undockToFloat/closeAll 接线
3. **提交 C**：taskpane 响应式适配（≤500px 断点、侧栏折叠、紧凑布局）+ 草稿持久化 + 生成中确认弹窗
4. **提交 D**：形态记忆 + 聚焦语义打磨 + `ribbon.js` 注释修正 + 三端自测清单执行

## 8. 验收清单（每端过一遍）

- [ ] 浮窗 ↔ 左/右/下 停靠互切，聊天记录与滚动位置延续、输入草稿不丢
- [ ] 生成中切换弹确认框；空闲切换无感（除窗口闪断）
- [ ] 重启 WPS 后点按钮按上次形态打开；已开着点按钮仅聚焦
- [ ] 停靠态宽度/高度记忆恢复（Mac 实测规范：延迟+重试）
- [ ] 原生手势：分隔条拖出浮动、浮动拖边缘吸附（作为赠品验证，不做保证）
- [ ] 探测失败的端：菜单无该项 / 回退浮窗，无报错暴露
- [ ] 设置窗口等其他 ShowDialog 行为不变

## 9. 开放风险

- Windows/Linux TaskPane 行为未实测（探测兜底 + 发布前探针）
- 2.2 万行 Vue 组件窄适配可能牵出隐藏的固定宽度样式（预留一个提交的缓冲）
- WPS 版本碎片化：探测结果按版本缓存，新版本首次使用会重新探测
