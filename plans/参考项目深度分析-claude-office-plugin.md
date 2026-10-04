# 参考项目深度分析：Claude for WPS（claude-office-skills 系列）

> 分析对象：`claude-office-skills/claude-office-plugin`（Excel 版，9★）与 `claude-wps-word-plugin`（Word 版，5★）
> 分析目的：对照察元 AI 的三宿主架构，提炼「多文档会话隔离」与本轮粘贴/上下文问题的可借鉴模式
> 结论先行：**该项目与察元同源同构**（WPS 单进程 + JS 加载项 + 本地代理 + webview 面板），但采用了与察元 v2 方案完全一致的「会话与文档绑定」设计；其最有价值的两个发明——**Host→Proxy 上下文推送**和**代码执行桥**——恰好补上察元 v2 方案尚未覆盖的两块（实时上下文注入与 AI 代码安全执行）。

## 一、四层架构（与察元逐层对照）

```
参考项目                                察元 AI 对应
─────────────────────────────────────  ─────────────────────────────────────
① WPS Plugin Host (main.js, 884行)  ⇔  察元无独立 Host 层（ribbon.js + dispatch 分散）
   周期推送工作簿上下文 / 轮询执行AI代码      工具调用由基座 webview 的 agent 循环驱动
② React TaskPane (Vite, TS)         ⇔  AIAssistantDialog.vue（Vue 3）
   用户对话 / Markdown / 模式切换            对话渲染 / 助手列表 / 工具面板
③ Express Proxy (:3001, 4322行)     ⇔  mcp-sidecar (:62588, server.mjs + aggregateTools)
   SSE 流式 / 会话持久化 / 代码桥            MCP JSON-RPC / 工具注册 / 剪贴板 / tmp-image
④ Claude CLI (spawn 子进程)          ⇔  chat_turn → DashScope/Agnes HTTP API
   环境变量白名单 / effort 分级 / 超时        模型参数直传（无 CLI 层）
```

## 二、最有价值的三个发明（察元可直接借鉴）

### 2.1 Host→Proxy 上下文推送（解决「文档1/文档2 对话输出一样」的完整方案）

```
Host(main.js): setInterval(pushWpsContext, CTX_INTERVAL)
  → collectWpsContext(): ActiveWorkbook.Name / Sheets / Selection / UsedRange + 样本值
  → httpPost(PROXY_URL + "/wps-context", ctx)     ← 同步 XHR POST
Proxy: app.post("/wps-context") → 存 _wpsContext 全局单例
TaskPane: sendMessage 时拉 GET /wps-context → buildContextString() 注入 prompt
```

注入格式（值得逐字抄）：
```
工作簿: <name>
所有工作表: <sheet1>, <sheet2>
⚠️ 当前活动工作表: 「<sheet>」— 请务必基于此表进行操作，忽略历史对话中提到的其他工作表。
[当前表已用范围] <addr>，N行 × M列 + 前50行样本值（JSON 每格）
[当前选区] <sheet>!<addr> ⚠️ 用户选定的操作范围是…不要操作其他工作表
```

**察元对照**：察元 v2 方案（scope 路由）解决了「对话归属」，但没有解决「上下文注入」——
每个回合的 prompt 里没有自动注入活动文档的名称/工作表/选区摘要。这意味着即使会话
隔离正确，模型也不知道当前文档的内容。**建议察元补上同款机制**：ribbon.js 或面板
webview 周期采集 ActiveWorkbook.Name/ActiveSheet/UsedRange 样本 → 随 chat_turn
的 system 上下文注入。这一项是「文档1/文档2 对话输出一样」的最直接解药。

### 2.2 代码执行桥（AI 生成代码 → Host 同步执行 → 结果回传）

```
TaskPane: AI 回复含代码块 → POST /execute-code {code} → 入 _codeQueue
Host: setInterval(pollAndExecuteCode) → GET /pending-code → shift 取走
Host: ET API 执行代码 → POST /code-result {id, result, error, diff}
Proxy: _codeResults[id] = 结果 → SSE 流推给 TaskPane 渲染
```

安全层（v3.2）：
- PreCodeExecute Hook：危险操作拦截（用户确认后 force=true 跳过）
- Agent tools 白名单：`_action` 前缀不在该 Agent 的 tools 列表 → BLOCKED
- 代码分块：`id_chunk_N` → `_codeChunkMap` 合并结果

**察元对照**：察元的模式是「AI 生成 JS → 基座 eval（spreadsheetDispatch）」，安全性靠
写锁 + expectDocId + 工具白名单——**比参考项目强**（参考项目无写锁无身份校验）。但参考
项目的「代码分块执行 + diff 回传」值得察元借鉴（大表格操作分块 + 变更 diff 展示给用户确认）。

### 2.3 会话持久化（Proxy 文件系统 + TaskPane sessionStore）

```
sessionStore.ts: saveSession(activeAgentId, messages) → POST /sessions
Proxy: 文件系统持久化 /sessions/:id → GET 回读
```

**关键发现**：参考项目的会话隔离是 **per-Agent**（`saveSession(activeAgentId, ...)`），
不是 per-Document——**它也没有解决多文档会话隔离**。两个 PPT 文件共享同一 Agent 的
会话。它靠的是「上下文注入」让模型知道当前在哪个文档，而非隔离会话。

**对察元 v2 方案的启示**：
- 察元的 scope 路由方案**超越参考项目**（参考项目连 scope 都没有）
- 但参考项目的「上下文注入」是察元缺的——两者**互补而非替代**：
  察元 scope 路由管「对话归属」，上下文注入管「模型知道文档内容」——缺一不可

## 三、其他可借鉴模式（按察元适配度排序）

| 模式 | 参考实现 | 察元适配建议 |
|---|---|---|
| **模型路由**（selectModel：按 mode/复杂度/代码检测自动选模型档） | `hasCode→sonnet`、`plan→opus` | 察元已有助手级 modelHint；可加「含代码块→高阶模型」自动路由 |
| **环境变量白名单**（spawn Claude CLI 时只传白名单 env + thinking tokens 分级） | ENV_WHITELIST 15 项 + MAX_THINKING 500/16k/32k | 察元 chat_turn 直传 HTTP 无需此层（CLI 独有）；不影响 |
| **PreCodeExecute Hook**（代码执行前钩子拦截） | runHooks("PreCodeExecute", {code}) | 察元写锁+expectDocId 已覆盖；Hook 模式可抄作「用户确认中间件」 |
| **多 Agent 并行**（AgentManager + MAX_CONCURRENT=3 + 冲突解决） | useAgentManager.ts | 察元多宿主场景（et+wpp 同时回合）可借鉴并发上限+冲突策略 |
| **主题系统**（dark/light/auto matchMedia） | v1.6.0 | 察元面板可加 |
| **连接器层**（connectors/ + data-bridge + 凭据管理） | /data-bridge/* 12 端点 | 察元 image-gen.json 模式可扩展为 connector 注册表 |

## 四、与察元的关键差异（架构权衡对照）

| 维度 | 参考项目 | 察元 | 评 |
|---|---|---|---|
| 模型调用 | spawn Claude CLI 子进程（本地 CLI 权限，无 API key） | HTTP API（DashScope/Agnes，需 key） | 各有利弊；CLI 无 key 门槛但依赖本地安装 |
| 上下文注入 | **✓ Host 周期推送+prompt 注入** | ✗ 无（v2 方案 F2 补胶囊，但内容注入仍缺） | **察元最大缺口** |
| 代码执行 | AI 生成 JS → Host 桥执行（分块+diff） | AI 生成 JS → 基座 eval | 参考项目的分块+diff 更安全 |
| 会话隔离 | ✗ 全局单会话（per-Agent 但不 per-Document） | **✓ scope 路由（v2）** | **察元领先** |
| 写保护 | ✗ 无（Host 直接执行） | **✓ 写锁+expectDocId+DOC_SWITCHED** | **察元领先** |
| 面板形态 | React SPA（Vite dev + hot-reload） | Vue 3 SPA | 同级 |
| 多宿主 | wps + excel 两个独立 repo | 单 repo 三插件目录 | 察元部署更统一 |

## 五、行动项（写入察元 backlog）

1. **P0 上下文注入**：Host 周期采集 ActiveWorkbook/Presentation 名称+工作表+选区摘要 → 随 chat_turn system 注入（参考 §2.1 格式逐字抄，含「忽略历史对话中提到的其他工作表」防串台指令）
2. **P1 代码分块+diff**：大表格操作分块执行 + 变更 diff 展示（参考 §2.2）
3. **P2 主题系统 + 连接器注册表**：远期
4. **排查**：wpsjs debug 的 vite 为什么不渲染新组件（headless 3889 DOM 有 btn-paste 但用户看 WPS 窗口没有——可能是 WPS 内嵌 CEF 的 file:// 缓存 vs vite dev 的 http:// 缓存分裂，需在 VM 实机上用 WPS 内置 DevTools 确认）

## 六、参考仓库

- [claude-office-skills/claude-office-plugin](https://github.com/claude-office-skills/claude-office-plugin)（Excel 版主仓库，9★，4322 行 proxy-server + 884 行 Host + React TaskPane + skills/modes/connectors 体系）
- [claude-office-skills/claude-wps-word-plugin](https://github.com/claude-office-skills/claude-wps-word-plugin)（Word 版，同构）
- [claude-office-skills/claude-wps-ppt-plugin](https://github.com/claude-office-skills/claude-wps-ppt-plugin)（PPT 版）
- [herman-hang/wps](https://github.com/herman-hang/wps)（jsaddons 部署机制参考）
- [WPS 加载项开发说明（官方）](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/wps-integration-mode/wps-addin-development/wps-addin-development-instructions)
- [任务窗格概述（官方 JSAPI）](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/jsapi/addin-api/TaskPane/task-pane-overview)
