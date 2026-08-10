# 察元 AI 文档助手 v4.0.0 — 本机 MCP 文档智能体正式版

> 发布日期：2026-08-10  
> 兼容性：WPS 文字 12.x / WPS 365（WebView2）；Windows / macOS / Linux  
> 升级路径：v3.x → v4.0.0 全量替换安装包；本机 MCP 端口仍为 `62588`，外部客户端配置一般无需修改

本次大版本把**本机 MCP（Model Context Protocol）文档智能体**作为主线能力打磨上线：安装察元并打开 WPS 后，即可被 **Claude Code、OpenAI Codex、Cursor、Hermes、OpenClaw** 等外部 AI Agent 通过标准 Streamable HTTP MCP **直接读写当前 WPS 文档**——打开/读取、定位替换、批注、多文档校对、知识库检索，文档与密钥不离开本机。

---

## 一、最大亮点 — MCP 对接外部 AI Agent

### 1.1 一行连接（所有客户端通用）

安装察元 → 打开 WPS（加载项在线）→ 本机服务就绪：

```
http://127.0.0.1:62588/mcp
```

健康检查：`GET http://127.0.0.1:62588/healthz`（期望返回在线 / `online`）。

- **无需 Token / API Key**：仅监听 `127.0.0.1`，本机即信任边界  
- **无需 Node.js**：安装包内嵌 `chayuan-mcp` 单文件二进制，并注册开机自启  
- **完全离线可用**：sidecar 与 WPS 同机；适合内网 / 隔离环境  

完整参数与工具列表见：[docs/mcp-connection.md](docs/mcp-connection.md)。

### 1.2 Claude Code

```bash
claude mcp add --transport http chayuan-wps http://127.0.0.1:62588/mcp
```

或在项目 / 用户级 `.mcp.json`：

```json
{ "mcpServers": { "chayuan-wps": { "url": "http://127.0.0.1:62588/mcp" } } }
```

对接后可在 Claude Code 中自然语言指挥：打开文档、分段翻译并插到段后、错别字批注、批量改正正文等。

### 1.3 OpenAI Codex（codex CLI）

编辑 `~/.codex/config.toml`：

```toml
[mcp_servers.chayuan-wps]
url = "http://127.0.0.1:62588/mcp"
```

Codex 即可调用察元文档工具，在 WPS 正文上完成校对与改写闭环。

### 1.4 Cursor

项目级 `.cursor/mcp.json`（或 Settings → MCP → Add）：

```json
{ "mcpServers": { "chayuan-wps": { "url": "http://127.0.0.1:62588/mcp" } } }
```

### 1.5 Hermes / OpenClaw

新建 MCP 服务，类型选择 **HTTP / Streamable HTTP**，URL 填写：

```
http://127.0.0.1:62588/mcp
```

无需 Token、无需 command、无需 stdio——与 Claude Code / Codex 同一端点。

### 1.6 其它 JSON 配置型客户端（含 Claude Desktop 等）

```json
{ "mcpServers": { "chayuan-wps": { "url": "http://127.0.0.1:62588/mcp" } } }
```

验证可用 MCP Inspector：

```bash
npx @modelcontextprotocol/inspector
```

选择 Streamable HTTP，粘贴上述 URL 后 Connect。

### 1.7 典型能力（对外暴露的文档工具）

安装并连接后，外部 Agent 可调用包括但不限于：

| 类别 | 能力 |
| --- | --- |
| 文档生命周期 | 状态 / 启动 WPS / 打开 / 新建 / 保存 / 元信息 |
| 读取与定位 | 段落列表、分块读取、全文（有上限）、按原文 Find 定位 |
| 写回 | 替换、插入、批注、批量 ops（最多约 200 条） |
| 校对 | `proofread_run`（可 dryRun）→ `proofread_apply_comments` 或改正正文 |
| 其它 | 脱密预览与写回、知识库检索、助手域检索与导出 |

口语示例：「帮我找出错别字并用批注标出来」「把每一段译成英文插到段后」「检查这份材料的保密风险」。

---

## 二、安装与本机 sidecar（v4 打包体验）

| 平台 | 安装包 |
| --- | --- |
| Windows x64 | `chayuan-4.0.0-windows-x64.exe`（自解压：插件 + MCP 二进制 + 开机自启） |
| macOS Apple Silicon | `chayuan-4.0.0-macos-arm64.pkg` |
| Linux x64 | `chayuan-4.0.0-linux-x64.deb` |

- 安装后 sidecar 释放到用户目录并尽量立即拉起（Windows Run 键 / macOS LaunchAgent / Linux user unit）  
- 设置页提供「启动本机服务」「测试连接 / 拉取工具」；优先启动原生 `chayuan-mcp` 二进制，不再强依赖本机 Node  
- macOS 安装脚本加固：复制到 WPS 沙盒时重试，避免 `Interrupted system call` 导致安装器 112 失败  

---

## 三、校对与表格批注（文档智能体写回质量）

- 大文档校对：动态进度、可调分块长度、dryRun 并发、批量改正避免逐条定位超时  
- **表格内错别字批注**：不再盲信 `chunkStart + 文本下标`  
  - 使用 `relativeRangeMap` + live 文本复核  
  - 权威路径：**Find 锁定原文 → 裁掉单元格/段尾标记 → Select → Comments.Add → 回读 Scope**  
  - Scope 被扩到整格时自动 Selection 重绑，尽量钉到具体错字  

---

## 四、升级与排障提示

1. 升级后请**完全退出并重启 WPS**，确认加载项版本为 4.0.0。  
2. 外部客户端连不上时：先打开 WPS + 察元，再访问 `http://127.0.0.1:62588/healthz`。  
3. 设置 → MCP 服务管理 →「启动本机服务」；仍失败则手动运行安装目录中的 `chayuan-mcp` 或 `start-mcp` 脚本。  
4. 远端机器无法直连 `127.0.0.1`；需本机代理或自定义 `CHAYUAN_MCP_PORT`（见连接文档）。

---

## 五、相对 v3.0 的定位

| | v3.0 | v4.0.0 |
| --- | --- | --- |
| 主线 | 远程知识库 RAG | **本机 MCP 文档智能体 + 多 Agent 对接** |
| 外部调用 | 以加载项内对话为主 | Claude Code / Codex / Cursor / Hermes / OpenClaw 标准 MCP |
| 安装 | 加载项为主 | 加载项 + 无 Node 依赖的 sidecar 自启 |
| 校对写回 | 基础批注 | 大文档性能 + 表格精确锚点 |

知识库 RAG、离线大模型、内置助手等 v3 能力继续保留，与 MCP 文档智能体并行可用。
