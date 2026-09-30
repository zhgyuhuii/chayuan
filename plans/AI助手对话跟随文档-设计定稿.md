# AI助手对话跟随文档 · 设计定稿

> 状态：**已实现并部署 v5.1.5（2026-09-30），真机验收由解锁哨兵自动执行中**
> 原始诉求："AI助手对话框能不能跟着文档走 打开时默认放在左侧 这样每个文档就显示一个对话框"
> 实验证据截图：`~/Desktop/chayuan-probe-shots/`（6 张，零代码真机实验）
> 实现提交：`16dd7e6`；验收截图：`/tmp/chayuan-probe/`（A0-D1 序列）

## 0.a 实现相对定稿的两处修正（调研后）

1. **会话作用域不新建 FullName 键**——代码调研发现面板已有完整的三级作用域机制
   （文档变量 docLinkId → 路径 → 名字，`resolveHistoryStorageScope`），文档变量方案
   比 FullName 更好（SaveAs 后会话天然跟随）。本实现复用它，只补"生成连续性、
   容量预算、默认形态"三块缺口。
2. **模型配置注入**——ribbon 基座 webview 与面板的 localStorage 不保证同源共享，
   chat.turn 参数携带面板解析好的 apiKey/apiUrl，runner 侧用
   `setChatApiConfigOverride` 注入（chatApi 单点覆盖，两处解析路径共用）。

## 0.b 部署要点（真机运维知识）

- **WPS mac 沙盒实际读取的加载项目录是容器内路径**
  `~/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/`，
  非 `~/Library/Application Support/Kingsoft/wps/jsaddons/`（后者是 pkg 装的 root
  空壳，两个目录都曾被误认为真身）。
- **两个 jsaddons 目录的父目录都是 root 属主**（pkg 安装器所留）——普通用户无法
  在其中创建目录。解法：jsaddons 的**父目录**（`.kingsoft/wps/`）是 zyh 属主，
  `mv jsaddons jsaddons.root-bak-<日期>` 挪走后重建，一次治愈 root 陷阱。
- 侧车二进制更新：`npm run mcp:build-binary macos-arm64`（bun）→
  覆盖 `~/.config/chayuan-wps/mcp/runtime/bin/` → `launchctl bootout/bootstrap
  com.chayuan.mcp`。
- 模型配置可用**文件**预置：容器数据目录
  `~/Containers/com.kingsoft.wpsoffice.mac/Data/Library/Application Support/chayuan/settings.json`
  写 `{modelConfigs:{DEEPSEEK:{apiKey,apiUrl,enabled,modelSeries}}}`——
  globalSettings 的 loadFromFile 优先级最高，两个 webview 读同一份，免去 UI 操作。

---

## 0. 一句话总纲

**面板属于窗口，会话属于文档。**

不追求"每个文档一个独立面板"——真机实验证明 mac WPS 的面板天然跟随活动文档（每宿主一份、切换时自动重挂载），按文档再建独立面板视觉零差异、内存翻倍。真正缺的是：**切回某个文档时，恢复它自己的对话**。

## 1. 真机实验结论（设计依据，零代码实验）

| # | 事实 | 证据 |
|---|------|------|
| 1 | 面板跟随标签切换，始终停靠左侧可见 | 截图 2-5（ET→PPT→ET→文档B 四次切换） |
| 2 | 切换文档时面板页面被 WPS 强制重挂载（非我们的代码 reload，全仓无 location.reload） | 5 次挂载出现 5 种欢迎语；代码核查 |
| 3 | 面板按宿主各一份（et/wpp 两个面板 webview 同时在线），不是全局一个 | agentHub /agent/status 实时状态 |
| 4 | agent 注册的 windowId=`ribbon@#/`，**无文档维度**；ribbon webview 跨文档切换存活 | 同上 + 实验期间 WPP ribbon 注册始终在线 |
| 5 | 每个面板 webview ≈100–200MB（CEF 子进程实测） | ps RSS |
| 6 | mac 标签互斥，"每文档一个面板"与"一个面板跟随文档"视觉等价 | 截图 2-5 |

## 2. 七项共识决议

| # | 问题 | 决议 |
|---|------|------|
| 1 | A（每文档独立面板）vs B（单面板+会话跟随） | **B**。A 在 mac 上被平台行为架空：API 层无单例限制但 windowId 无文档维度、标签互斥、内存×N |
| 2 | 会话文档键定义 | **完整路径 FullName 优先**；未保存文档用 `untitled:<host>:<名>:<指纹短码>` 临时键，首次保存时指纹匹配迁移为路径键；实现第一步真机探测 WPS 内部文档 ID（`.Id` 类属性），存在且跨重启稳定则替换 FullName |
| 3 | 文档打开时自动弹面板？ | **否，点击 ribbon 按钮才打开**。面板跟随行为本身已满足"每个文档显示一个对话框" |
| 4 | "默认左侧"的定义 | **仅首次**：无形态记忆时默认停靠左侧（getMode 兜底值 `float`→`dock-left`）；用户切过之后尊重记忆，记忆机制原样保留 |
| 5 | 切换文档时正在生成的回复 | **后台继续生成**（用户选定 B 并要求找简单实现）→ 生成循环迁出面板页 |
| 6 | 简单实现路径 | **生成循环迁入 ribbon webview**（唯一跨切换存活的 JS 上下文）：chat 回合经 agentHub 派发 `chat.turn`（只派给 `windowId==='ribbon@#/'` 的 ribbon agent），会话写穿 PluginStorage（docId 键控），面板瘦身为纯视图。不用 sidecar 宿主（跨进程往返重写上下文/指纹逻辑，收益仅"扛 WPS 重启"） |
| 7 | 容量与清理 | **两级预算**：单文档 ≤200KB 且 ≤50 轮（先到为准，裁最旧轮次，列表提示）；全局 ≤30 个文档键 LRU。数值实现第一步按真机实测 PluginStorage 配额校准。sidecar 文件存储留作升级位（键格式介质无关） |

## 3. 详细设计

### 3.1 文档身份（docId）

```
resolveDocId() ->
  host = detectAddonType()                      // wps | et | wpp
  fullName = ActiveDocument/Workbook/Presentation.FullName
  有 fullName（真实路径）→ docId = fullName
  无（未保存）       → docId = `untitled:${host}:${文档名或首sheet名}:${指纹前8位}`
                       指纹复用 documentWriteLock 的 host-aware fingerprint
```

**保存迁移**：每次 turn 开始与面板挂载时 re-resolve docId；当前键为 `untitled:` 且新解析出 FullName 时，比对保存前后指纹（内容一致才迁移，防其他未保存文档误领），迁移 = 复制会话 JSON 到新键 + 删旧键 + 更新索引。

**内部 ID 探测**（开工第一步）：探测 `ActiveDocument.Id / .UniqueId / .DocumentId` 等候选属性，真机验证跨保存/跨重启稳定性；稳定则键改为 `wpsid:<id>`（FullName 降为展示用）。

### 3.2 会话存储（PluginStorage，写穿式）

```
会话键   ai_chat_sess:<fnv1a64(docId)>     值 JSON:
  { docId, host, turns: [{id, role, content, toolCalls摘要, status: ok|interrupted|pending-confirm, createdAt}], updatedAt, bytes }
索引键   ai_chat_sess_index                值 { lru: [key...], totalBytes }
心跳键   ai_chat_turn:<turnId>             值 { ts, docIdKey, phase }  // 循环每 2s 跳
确认键   ai_chat_confirm:<turnId>          面板写入 confirm|deny，循环消费
```

- 写穿时机：用户消息落库 → LLM 流块节流 300ms 合并写 → 工具调用边界写 → 轮次完成写终态。
- 裁剪：消息边界检查（单文档 200KB/50 轮裁最旧；全局 30 键 LRU 驱逐），驱逐时面板对话列表提示"更早的会话已清理"。
- PluginStorage 实际配额开工第一步二分实测，预算按实测定。

### 3.3 生成循环迁移（chat.turn）

```
面板（纯视图）                         ribbon webview（循环宿主）
  │ 发送消息 = 写会话 + 派发 chat.turn        │ ack 后 detached 跑循环：
  │  └─ agentClient → sidecar → agentHub ──→ │  LLM 流式 fetch（与现面板同路径）
  │ ack {accepted, turnId} 立即返回           │  工具调用 → sidecar → agentHub → dispatch
  │ 订阅：400ms 轮询会话键+心跳键             │   （写锁/OCC/expectDocId 全不变）
  │ 渲染流块 / 工具状态 / 确认请求            │  确认等待：写确认键，挂起等面板写入
  │ 确认操作 → 写 ai_chat_confirm 键 ───────→ │  心跳每 2s；完成后写会话终态
```

- **agentHub 改动（唯一侧车改动）**：`chat.` 前缀 → 新 target 规则：host 匹配且 `agent.windowId === 'ribbon@#/'`（排除面板 agent，防止循环跟着面板死）。
- **dispatch.js**：`chat.turn` handler 立即 ack（不等循环完成，绕开 job 超时 90/180s）。
- **orchestrator 拆分**：把"运行一个回合"的循环（LLM 流、工具环、确认等待、写穿）抽为 `chatTurnRunner.js`，ribbon 侧加载；面板不再 import 编排逻辑。
- **面板挂载幂等**（对平台是否重载页面均鲁棒）：resolveDocId → 读会话渲染 → alive turn 则订阅 → pending confirm 则渲染确认框。页面不重载时同函数原地重绑。
- **死亡兜底**：心跳 >10s 未跳且无终态 → 标记 `interrupted`，显示已生成部分 + "生成中断，点击重试"（重试 = 原消息重发新轮次，不续写半截）。

### 3.4 明确不变项（防 scope creep）

- 48 个 MCP 工具、工具路由（spreadsheet./presentation./document. 前缀）、写锁/OCC 语义全部不动。
- dockManager 形态切换/原子交接不动；面板 URL 构造不动。
- 唯一形态改动：getMode() 兜底值一行。

## 4. 触碰文件清单（预估）

| 文件 | 改动 |
|------|------|
| `src/utils/chat/docSession.js` | 新增：docId 解析/迁移、会话存取、写穿、裁剪、LRU、心跳 |
| `src/services/mcpBridge/chatTurnRunner.js` | 新增：从 orchestrator 抽出的回合循环 |
| `src/services/mcpBridge/mcpChatOrchestrator.js` | 瘦身：循环移出，提示词构建随循环走 |
| `src/components/AIAssistantDialog.vue` | 纯视图化：读会话/订阅进度/发消息/确认写回 |
| `src/services/mcpBridge/dispatch.js` | chat.turn 入口（ack 模式） |
| `mcp-sidecar/lib/agentHub.mjs` | chat. 路由规则（windowId 过滤）——唯一侧车改动 |
| `src/utils/host/aiAssistantDockManager.js` | getMode 兜底 'float'→'dock-left' |
| `src/utils/host/hostType.js` | 内部文档 ID 探测 helper |

## 5. 验收场景清单（真机逐项截图）

1. 文档A对话 2 轮 → 切文档B：B 空会话，A 会话保留
2. 切回 A：2 轮对话恢复，可继续
3. **A 生成中切到 B，等 10s 切回：回复已完整生成**（B 的核心承诺）
4. 生成中切走立刻切回：进度续显，不重复不丢失
5. 未保存新工作簿对话 → 保存为 xx.xlsx → 继续对话：会话连续（迁移成功）
6. 写确认流：触发写操作 → 确认框 → 切走切回：确认 UI 仍在，确认后执行成功
7. 生成中关闭该宿主全部文档 → 重开：标记"生成中断"+ 重试可用
8. 清形态记忆首开 = 左侧停靠；切浮窗重启 WPS = 仍浮窗（记忆尊重）
9. 容量：构造 >50 轮会话最旧被裁且提示；>30 文档键 LRU 生效
10. 三宿主各开会话互不串、各自恢复
11. 回归：现有 12 项真机 MCP 测试全绿
12. 内存：面板 webview 数不随文档数增长（仍按宿主 2–3 个）

## 6. 已知限制（明示接受）

- 同一路径多窗口同开（Windows）：会话共享，消息级写穿原子，接受。
- 符号链接/云盘双路径：会话分裂为两份，罕见场景，记为已知限制。
- untitled 迁移有极小误迁移概率（指纹撞车），接受。
- WPS 未来改变面板重载行为：挂载逻辑幂等，两种行为下均正确。

## 7. 实施顺序

1. **开工前置**：先 commit 现有三宿主架构 22 文件（+966/-182，目前仅存工作区）——避免新改动与已验证成果混淆。
2. 真机探测：PluginStorage 配额、内部文档 ID 存在性 → 校准 §3.2 参数与 §2.2 键方案。
3. docSession.js + 单测（键控/裁剪/迁移/心跳，内存 fake host）。
4. chatTurnRunner 抽取 + chat.turn dispatch + agentHub 路由。
5. 面板纯视图化 + 恢复/订阅/确认流。
6. 默认形态一行改。
7. §5 全清单真机验收，逐项截图。
