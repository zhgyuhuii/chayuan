# 察元 WPS MCP 连接说明（MVP）

任意支持 **Streamable HTTP MCP** 的客户端均可连接，不绑定特定 IDE。

## 1. 启动 sidecar

在仓库根目录：

```bash
npm run mcp:sidecar
```

或：

```bash
node mcp-sidecar/server.mjs
```

Windows 也可双击 `mcp-sidecar/start-mcp.cmd`（需 PATH 中有 Node 18+）。

默认监听：`http://127.0.0.1:62588`

- Health：`GET http://127.0.0.1:62588/healthz`
- MCP：`http://127.0.0.1:62588/mcp`
- 发现文件：`%LOCALAPPDATA%\chayuan-wps\mcp\mcp-server.json`（url / port / wpsExecutable）
- 鉴权：关闭；仅监听 `127.0.0.1`（旧版 token 文件可忽略）

## 2. 打开 WPS + 察元加载项

`OnAddinLoad` 会启动 Agent 长轮询（`/agent/register` + `/agent/poll`）。  
若 sidecar 未运行，Agent 会重试；请先起 sidecar。

设置页：**常规设置 → MCP 服务** → 刷新状态 / 复制连接信息。

## 3. MCP 客户端配置

只需链接，**无需 Token**：

```
http://127.0.0.1:62588/mcp
```

### Claude Code

用 CLI 一键注册（`--transport http`，`streamable-http` 为同义别名）：

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

或在项目 / 用户级 `.mcp.json` 写入：

```json
{
  "mcpServers": {
    "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" }
  }
}
```

### OpenAI Codex（codex CLI）

编辑 `~/.codex/config.toml`，加入一个 Streamable HTTP MCP server：

```toml
[mcp_servers.chayuan-wps-mcp]
url = "http://127.0.0.1:62588/mcp"
```

### Cursor

项目级 `.cursor/mcp.json`（或 设置 → MCP → Add）：

```json
{
  "mcpServers": {
    "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" }
  }
}
```

### Hermes / OpenClaw

新建 MCP 服务，类型选 **HTTP / Streamable HTTP**，URL 填 `http://127.0.0.1:62588/mcp`（无需 Token / 命令 / stdio）。

### Claude Desktop / 其它 JSON 配置型客户端

```json
{
  "mcpServers": {
    "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" }
  }
}
```

### 口语使用示例

- 帮我检查这份答辩状的保密风险  
- 帮我翻译成英文，并插到每一段后面  
- 帮我找出错别字，用批注标出来  

用 [MCP Inspector](https://github.com/modelcontextprotocol/inspector) 验收（推荐，不依赖 IDE）：

```bash
npx @modelcontextprotocol/inspector
```

连接上述 URL 即可（鉴权已关闭；服务仅监听 `127.0.0.1`）。

## 4. 工具（v0.5.0：26 个工具 · 外部 LLM 推理 + 长文分块）

推理在客户端 LLM；WPS 只做读/定位/写/Export。不把 ~4500 助手注册成 MCP tools（改用 `assistants_search/get` 检索导出）。

| Tool | 说明 |
|------|------|
| `wps_status` | 分层健康：sidecar / Agent / 活动文档 / 可见窗口 |
| `wps_launch` | OS 冷启动 WPS 文字并等待 Agent 连接 |
| `document_open` | 打开本地 .docx 为活动文档（可见窗口） |
| `document_ensure_open` | 与活动文档一致则 no-op，否则打开 |
| `document_meta` | 轻量元信息：名称 / 字数 / 段数 / 是否建议分块 |
| `document_list_paragraphs` | 分页段落文本（含 start/end 锚点，逐段工作流） |
| `document_chunks` | **长文分页分块**（`cursor`/`limit`，含 `start`/`end`） |
| `document_get_text` | 文档/选区纯文本；超约 80k 需 `force:true` 或改用 chunks |
| `document_locate` | 定位字词/句，返回多命中用于锚点 |
| `document_replace` | 替换锚点文本段（未 confirm=preview） |
| `document_insert` | 相对锚点/文末插入（after/before/append/prepend/insert） |
| `document_add_comment` | 加 WPS 批注；**必须** `confirmed: true` |
| `document_apply_ops` | 批量写回（replace/comment/comment-replace/insert-after，≤200 ops） |
| `document_new` | 新建空白文档或以模板路径开副本 |
| `document_save` | 保存活动文档（可选另存为路径） |
| `declassify_status` | 查询是否处于脱密/遮蔽态 |
| `declassify_preview` | 由关键词构建遮蔽预览（不写盘） |
| `declassify_apply` | 应用脱密（需 confirm+password+keywords） |
| `declassify_restore` | 用密码复原脱密文档 |
| `kb_retrieve` | 检索知识库片段供 LLM 推理 |
| `proofread_run` | 跑错别字/语法校对（dryRun 默认仅返回 issues） |
| `proofread_apply_comments` | 把 issues 转成 WPS 批注（需 confirm） |
| `proofread_job_poll` | 轮询异步校对任务进度 |
| `assistants_list_domains` | 列出助手领域目录（Agent 离线也可用） |
| `assistants_search` | 按查询/领域检索约数千个察元助手 |
| `assistants_get` | 导出单个助手完整定义/提示词 |

### 写操作 confirmed 策略

| 工具 | 未传 `confirmed: true` | 传了 |
|------|------------------------|------|
| `document_replace` / `insert` / `apply_ops` | 返回 `preview: true`，不写 | 落盘 + 审计 |
| `document_add_comment` | `CONFIRMATION_REQUIRED` | 写批注 |
| `proofread_apply_comments` / `declassify_apply|restore` | `CONFIRMATION_REQUIRED` | 落盘 |

### 长文剧本（百万字）

1. `document_meta` → 若 `recommendChunks` 或 `charCount` 很大  
2. loop：`document_chunks({ cursor, limit: 1..3 })` → 外部 LLM 处理该段  
3. 产出带 `originalText` + `start/end` 的 ops  
4. `document_apply_ops`（无 confirm）预览 → 确认后 `confirmed: true`  

**禁止**对百万字默认 `document_get_text`（会返回 `DOCUMENT_TOO_LARGE`）。

### 场景剧本

**错别字（外部 LLM）**  
`meta` → `chunks` → 模型找 issues → `locate` / `add_comment` 或 `replace`（confirm）  
（或快捷：`proofread_run` dryRun → `proofread_apply_comments`）

**翻译**  
`chunks` → 外部译 → `document_replace`（按 chunk 锚点，confirm）

**知识库核对**  
`assistants_search/get`（可选 Export Prompt）→ `kb_retrieve({ query })` → 外部对照 → `add_comment`

**调用助手**  
`assistants_search` → `assistants_get`×N → 客户端填 `{{input}}` → 写回用 replace/comment

### Resources

| URI | 说明 |
|-----|------|
| `chayuan://wps/health` | 分层健康状态 |
| `chayuan://assistants/manifest` | 领域清单 |
| `chayuan://assistants/domain/{domain}` | 领域助手摘要 |
| `chayuan://assistants/{id}` | 助手完整定义 |

发现文件：`%LOCALAPPDATA%\chayuan-wps\mcp\mcp-server.json`（含 url / wpsExecutable）。

## 5. 错误码

| code | 含义 |
|------|------|
| `WPS_AGENT_OFFLINE` | WPS/加载项未连接 sidecar |
| `DOCUMENT_TOO_LARGE` | 请用 `document_chunks`（或 `force:true`） |
| `LOCATE_MISMATCH` / `LOCATE_NOT_FOUND` | 锚点校验失败 / 未找到 |
| `LICENSE_REQUIRED` | 免费额度用尽或需授权（不弹购买窗） |
| `MODEL_NOT_CONFIGURED` | 未配置拼写检查模型 |
| `CONFIRMATION_REQUIRED` | 写操作未传 `confirmed: true` |

## 6. 安装器与自启（已实现）

- **三平台安装器**（可在一台机器上交叉构建）：
  - `npm run build:wps-exe` → Windows 自解压 SFX（`release/chayuan-<ver>-windows-x64.exe`）
  - `npm run build:wps-pkg-macos` → macOS 安装包（`release/chayuan-<ver>-macos-<arch>.pkg`）
  - `npm run build:wps-deb` → Linux deb（`release/chayuan-<ver>-linux-<arch>.deb`）
- **随安装注册 OS 级自启**（开机即常驻，不经插件 JS、零弹窗）：
  - Windows：自解压 `copy.bat` 写 `HKCU\…\Run\ChayuanWpsMcp`，释放 sidecar 二进制到 `%LOCALAPPDATA%\chayuan-wps\mcp\runtime\` 并立即启动。
  - macOS：LaunchAgent `com.chayuan.mcp`（`RunAtLoad` + `KeepAlive`）。
  - Linux：systemd --user 单元 `chayuan-mcp.service`（`Restart=on-failure`）。
- **无需 Node.js**：sidecar 已交叉编译为单文件二进制（`chayuan-mcp-<plat>-<arch>`，5 平台）；二进制缺失时 autostart 脚本回落 `node server.mjs`。

### 明确不做 / 后置

- WebView `ShellExecute` 拉起 sidecar / WPS → 不做主路径（Spike=`NO_EFFECT`）；`wps_launch` 用 sidecar OS spawn。
- Agent 传输：WebSocket 在 WPS `file://` 下已验证 OPEN_OK，首期仍用长轮询。
- 4000+ 助手各注册为 MCP tool → 不做（改用 `assistants_search/get` 导出）。
- 依赖 chayuan-desktop（62581）→ 不做。
- `WpsInvoke` 门面 → 二期。

## 7. 自启动 / 自发现 / 自测试

```bash
# sidecar 可先开；脚本也会自动拉起
npm run mcp:sidecar

# 全量：vite build → 同步 jsaddons → wpsjs debug → 等 Agent → MCP 验收 → 判定 Phase2
npm run mcp:selftest

# 已 build 过可跳过编译
npm run mcp:selftest:quick
```

加载项在 Agent 首次注册后约 2.5s **自动跑 Spike** 并 `POST /selftest/report`。  
报告：`%LOCALAPPDATA%\chayuan-wps\mcp\selftest-run.json`、`mcp-sidecar/last-selftest.json`。

**Phase 2 门禁（脚本自动判定）**

| 结果 | 条件 |
|------|------|
| `GO` / `GO_WITH_CAUTION` | sidecar + MCP tools + Agent 上线 + document 桥有响应 |
| `NO_GO` | Agent 未上线（常见：本机无 WPS / `KWPS.Document.12` 注册表缺失） |

`wpsjs debug` 依赖注册表：`HKCR\KWPS.Document.12\shell\open\command`。

## 8. 助手页文档智能体（多 MCP Client）

助手页输入区 **文档智能体**（默认开）会把本轮对话走 MCP 编排，与 Cursor 等外部客户端共用本机 sidecar：

- 内置 `chayuan`：`http://127.0.0.1:62588/mcp`
- 可在 **设置 → MCP 服务** 添加其它 **Streamable HTTP** MCP（不支持 stdio/npx）
- 外服经 sidecar `POST /upstream/*` 代理（须先同步 allowlist），规避 WebView CORS
- 工具名合并为 `{serverId}__{toolName}`
- 与旧「对话触发助手/文档修订」**互斥**：开且可用时整轮只走 MCP；不可用则轻横幅后整轮回落旧链路
- 校对结果提供「写成批注 / 直接改正正文」双出口

## 9. Spike（设置页一键跑）

路径：**常规设置 → MCP 服务 → 运行 Spike**（需 sidecar 已启动）。

| # | 验证 | 失败则 |
|---|------|--------|
| 1 | `file://` / WebView → `ws://127.0.0.1:62588/agent-ws` | 坚持长轮询 |
| 2 | `OAAssist.ShellExecute` 跑 `spike-shell-marker.cmd` | 放弃 WPS 内 spawn 为主路径 |
| 3 | Agent 心跳存活累计（目标 30 分钟） | 加强心跳 / 考虑 taskpane 保活 |

结果写入 PluginStorage，并显示在设置页。Phase 3（launch / WS）以前两项 `ok` 为准。
