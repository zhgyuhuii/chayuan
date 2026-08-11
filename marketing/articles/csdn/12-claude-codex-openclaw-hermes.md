# Claude Code、Codex、OpenClaw、Hermes：同一 WPS 审查端点怎么接

四个客户端界面差得很远，接到察元 AI 文档助手 v4.0 时，目标却只有一个：用 Streamable HTTP 访问本机 MCP。端点固定为：

```
http://127.0.0.1:62588/mcp
```

健康检查：`GET http://127.0.0.1:62588/healthz`，期望 `online`。服务名建议统一写成 `chayuan-wps-mcp`。没有 Token，没有 stdio 启动命令，也不要为了「看起来更安全」填一个假密钥——当前本机服务按设计不走 Token，假密钥反而可能让部分客户端配置校验失败。

本文按「共同点 → 各客户端配置 → 同一套审查话术 → 对比表与排错」写。内网 Ollama 链路见 [./11-offline-ollama-intranet-review.md](./11-offline-ollama-intranet-review.md)；确认策略与 localhost 边界见 [./14-confirm-security-localhost.md](./14-confirm-security-localhost.md)；错误码手册见 [./15-errors-troubleshooting-handbook.md](./15-errors-troubleshooting-handbook.md)。

![四客户端箭头指向同一本机 MCP 地址](images/csdn-12-same-endpoint.png)

## 共同点：先把本机服务验收完

### 安装与打开顺序

1. 安装察元 v4.0，打开 WPS 文字，确认加载项可见。  
2. 浏览器打开 healthz，确认在线。  
3. 察元设置 → MCP 服务，状态为已启动。  
4. 在察元里配置好校对用的对话模型（云端或 Ollama 等兼容端点）。  
5. 用加载项自带检查跑通一小段测试稿。  

五步未完成前，不要并行折腾四个客户端。否则你会得到四个「连不上」的工单，根因却是同一个：Agent 离线或模型未配。

### 协议与传输

客户端必须选 HTTP / Streamable HTTP（Claude Code CLI 里 `--transport http`，`streamable-http` 为同义别名）。stdio、SSE 旧形态、自定义 command 启动，都不适用于这条本机 URL。协议背景见 [MCP 官方站点](https://modelcontextprotocol.io/)；Claude 侧说明见 [Claude Code MCP 文档](https://code.claude.com/docs/en/mcp)。

![healthz 在线且察元 MCP 服务页显示已启动](images/csdn-12-healthz-and-settings.png)

## Claude Code：CLI 或 .mcp.json

### CLI 一键注册

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

执行后在 Claude Code 会话里应能看到该 MCP 服务器及文档工具。若列表为空，先 curl healthz，再重启会话。

### 项目或用户级 JSON

```json
{
  "mcpServers": {
    "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" }
  }
}
```

写入项目根或用户级 `.mcp.json`（以当前 Claude Code 文档为准）。适合把「接 WPS」固化进仓库模板，新同事拉代码即可用。

### Claude Code 侧使用注意

- 工作目录与「当前 WPS 活动文档」是两回事：改文件的是 WPS 里打开的那份，不是仓库里的某个 docx 路径（除非你显式让工具打开路径）。  
- 长会话里若 WPS 被关掉，会变为 `WPS_AGENT_OFFLINE`，重开 WPS 并加载察元后再继续。  
- 写回前保持开场白约束：先预览，再等你说确认。

![Claude Code 中已注册 chayuan-wps-mcp 的服务器列表](images/csdn-12-claude-code-mcp.png)

## OpenAI Codex：config.toml

### 配置片段

编辑 `~/.codex/config.toml`：

```toml
[mcp_servers.chayuan-wps-mcp]
url = "http://127.0.0.1:62588/mcp"
```

保存后重启或重载 Codex CLI，使 MCP 服务器生效。字段名以 Codex 当前版本为准；核心是 URL 指向本机 62588，而不是再包一层本地 command。

### Codex 适用场景

Codex 偏「在终端里把活干完」。适合脚本化审查：打开指定稿、dryRun、输出问题清单到终端，再由你决定是否确认写批注。与 Claude Code 相比，桌面可视化少一些，但对同一 MCP 工具集没有能力折损——折损通常来自模型配置或活动文档不对。

![Codex config.toml 中 chayuan-wps-mcp 段落实拍](images/csdn-12-codex-toml.png)

## OpenClaw：桌面里选 HTTP

### 新建服务

1. 打开 OpenClaw 的 MCP / 工具 / 连接器配置（名称随版本可能不同）。  
2. 新建服务，类型选 HTTP 或 Streamable HTTP。  
3. URL 填 `http://127.0.0.1:62588/mcp`。  
4. 名称填 `chayuan-wps-mcp`。  
5. Token、命令、stdio 均留空。  
6. 保存后做连通测试，能列出打开文档、读取、批注、校对等工具即成功。

### 桌面 Agent 的操作习惯

OpenClaw 用户常希望「说一句话就改完」。接到 WPS 后仍然建议拆成：预览列表 → 你点头 → 写批注或替换。可把开场白存成任务模板，避免每次粘贴。第一次任务用只读冒烟，不要一上来「直接改正文」。

![OpenClaw 新建 MCP 表单：类型与 URL 清晰可见](images/csdn-12-openclaw-form.png)

## Hermes：同一表单逻辑

### 配置要点

Hermes 同样走 HTTP MCP。界面可能叫 MCP Server、Tools、连接器：

- URL：`http://127.0.0.1:62588/mcp`  
- 名称：`chayuan-wps-mcp`  
- 无 Token、无 command、无 stdio  

配好后用与 OpenClaw 相同的冒烟句验证。Hermes 与 OpenClaw、Claude Code、Codex 可以同时配置在同一台机器；sidecar 只需一份，共用 62588。不要为每个客户端再拉起一份冲突的 MCP 进程。

![Hermes MCP 配置页与连通成功提示](images/csdn-12-hermes-config.png)

## 用同一套话术验收四个客户端

### 只读冒烟

```text
通过 chayuan-wps-mcp 读取当前文档标题和前两段，只读，不要写批注，不要改正文。
```

四个客户端都应能返回标题与段落文本。失败时先看错误码：`WPS_AGENT_OFFLINE` 回到 WPS；连不上端口则查 healthz；能连但无工具则检查是否误配成 stdio。

### 审查预览

```text
对当前文档做错别字和标点审查，dryRun 预览问题列表，不要写批注，不要改正文。
```

若报 `MODEL_NOT_CONFIGURED`，问题在察元模型设置，与哪个客户端无关——换客户端不会修好。

### 确认写批注

你核对列表后回复：

```text
确认写批注。批注钉在具体错字上，表格内必须钉在单元格文字上。
```

未带确认却写回，会遇到 `CONFIRMATION_REQUIRED`。脱密 apply/restore 另外要求用户提供密码，客户端不得编造密码。安全细节见 [./14-confirm-security-localhost.md](./14-confirm-security-localhost.md)。

![同一提示词在不同客户端得到同类问题列表](images/csdn-12-same-prompt-results.png)

## 对比表：差异在配置，不在端点

### 配置面

| 客户端 | 配置入口 | 传输 | Token | 服务名建议 |
| --- | --- | --- | --- | --- |
| Claude Code | CLI 或 `.mcp.json` | http / streamable-http | 无 | chayuan-wps-mcp |
| Codex | `~/.codex/config.toml` | Streamable HTTP URL | 无 | chayuan-wps-mcp |
| OpenClaw | 桌面新建 MCP | HTTP / Streamable HTTP | 无 | chayuan-wps-mcp |
| Hermes | 桌面新建 MCP | HTTP / Streamable HTTP | 无 | chayuan-wps-mcp |

### 能力面

打开/读取活动文档、分块读取、校对预览、确认后写批注、确认后替换、多文档切换——都走同一工具目录。客户端差异主要在：会话体验、是否方便存模板、是否偏 CLI。不要预期「某个客户端能跳过 confirmed」。

### 何时选哪个

- 已有工程仓库、习惯终端：Claude Code 或 Codex。  
- 给编校同事桌面点选：OpenClaw 或 Hermes。  
- 内网培训：先画一张「都指向 62588」的图，再发各自截图步骤，避免四人四种 URL。  
- 需要不依赖 IDE 的联调：用 [MCP Inspector](https://github.com/modelcontextprotocol/inspector)。

## 跨客户端排错顺序

### 第一步：本机是否 online

任何客户端失败，先访问 healthz。离线则不要改客户端配置。打开 WPS、加载察元、启动 MCP 服务。

### 第二步：是否指错地址

常见误配置：写成局域网 IP、写成 `https`、端口改成别的、路径丢掉 `/mcp`。默认安装只服务本机回环。远程使用必须经本机代理或受控的端口策略，并清楚无 Token 的风险。

### 第三步：模型与确认

能读不能审 → 查 `MODEL_NOT_CONFIGURED`。能预览不能写 → 查是否补了确认（`CONFIRMATION_REQUIRED`）。长文失败 → `DOCUMENT_TOO_LARGE`，改分块。定位失败 → `LOCATE_NOT_FOUND` / `LOCATE_MISMATCH`，重读原文再写。完整步骤见 [./15-errors-troubleshooting-handbook.md](./15-errors-troubleshooting-handbook.md)。

![排错流程图：healthz → URL → 模型 → confirmed](images/csdn-12-troubleshoot-flow.png)

## 推荐共用开场白（四客户端可粘贴）

```text
你是 WPS 文档校对助手，通过 chayuan-wps-mcp 操作当前文档：
1）先 proofread dryRun，检查错别字、标点、明显病句；
2）汇总问题列表给我确认；
3）我回复「确认写批注」后再写成 WPS 批注（钉在具体文字上，尤其是表格）；
4）不要擅自改正文，除非我明确说「确认替换」；
5）禁止擅自调用脱密工具；脱密必须由我提供密码并 confirmed。
```

公文与合同专项提示词见 [./13-official-doc-contract-scenarios.md](./13-official-doc-contract-scenarios.md)。内网仅本地模型时，先按第 11 篇把 Ollama 配进察元，再回来接这四个客户端。

## 同一审查任务在四客户端上的操作脚本

下面用一份「通知类短稿错别字审查」做标准脚本。四个客户端只换启动方式，不换正文指令。

### 准备

WPS 打开测试稿；healthz 为 online；模型已在加载项内验证。确认客户端里能看到 `chayuan-wps-mcp`。

### 步骤 A：只读

发送：

```text
读取当前文档标题与第 1 到第 3 段原文，原样返回，不要总结成摘要，不要修改。
```

通过标准：返回文本与 WPS 所见一致。失败则停，按离线或 URL 错误处理。

### 步骤 B：预览

发送：

```text
对全文做错别字与中英文标点检查，dryRun 列表输出：序号、原文、建议、位置说明。不要写批注，不要改正文。
```

通过标准：至少覆盖你故意埋下的错误；无 `MODEL_NOT_CONFIGURED`。

### 步骤 C：确认写批注

发送：

```text
确认写批注。请处理列表中第 1 到第 N 条（N 为你核对后的上限）。批注钉在具体文字上。
```

通过标准：WPS 批注窗格出现对应条目；抽查两条锚点正确；过程中若曾未确认就写回，应曾出现 `CONFIRMATION_REQUIRED`。

### 步骤 D：按条替换（可选）

仅对无争议错字：

```text
确认替换第 2 条与第 5 条，其他保持批注。
```

通过标准：正文仅两处变化；若定位失败，按 `LOCATE_*` 重读再试，而不是扩大替换范围。

把 A 到 D 录成四段短视频（每客户端各一套），比只发配置 JSON 更利于桌面用户上手。

![标准脚本 A 到 D 在 OpenClaw 与 Claude Code 的对照录屏封面](images/csdn-12-script-ad.png)

## 配置漂移与版本升级

### 常见漂移

- 有人把 URL 改成机器名或局域网 IP，别人复制后在自己电脑失败。  
- Codex 与 Claude Code 各写一份配置，端口被改成实验值，结果一半人连旧端口。  
- 桌面客户端缓存了旧的工具列表，升级察元后未刷新。  

治理方式：文档里只公布一个常量 URL；改端口必须发变更通知并同步所有配置模板；升级 v4.0 后要求每人重做步骤 A。

### 与 Cursor 等其他客户端

Cursor 等同样可用 JSON 指向同一 URL。本文聚焦四客户端，是因为培训场上问得最多。原则不变：Streamable HTTP、无 Token、先本机验收。不要为每个新客户端发明新的「专用网关」。

### 性能与体验差异（不等于能力差异）

本地模型较慢时，桌面客户端更容易让人以为「卡死」。预先说明：预览长稿可能数分钟；可先审前几段。CLI 用户习惯看日志，桌面用户需要状态文案——这是 UX 差异。工具是否支持写批注，不因客户端而减少；真缺能力时看 MCP 工具列表，而不是看营销页。

## 培训现场答疑备忘

问：为什么不给 Token？  
答：默认只绑本机回环；信任边界在本机。若把端口暴露到网络还不加控制，才是危险操作。见第 14 篇。

问：四个客户端要装四份察元吗？  
答：不需要。一份 WPS 加载项与一份 sidecar，多个客户端共用。

问：能否跳过预览直接改？  
答：技术上在确认后可以替换，但公文合同场景默认应批注优先。制度上由你们规定，产品门闩仍要求 `confirmed=true`。

问：内网不能装 Claude Code 怎么办？  
答：用 OpenClaw/Hermes，或仅用加载项内检查；模型用 Ollama。见第 11 篇。

问：报错看哪？  
答：先看错误码，对照第 15 篇，不要先重装系统。

问：能否一台机器装两个 sidecar 分别给不同客户端？  
答：不要。共用一个 `62588` 即可；多实例抢端口只会制造随机失败。

问：审查时能否同时开着两个 WPS 窗口？  
答：可以开，但必须先确认活动文档是目标稿。写回前再读一次标题，避免批注写到另一份草稿。

![培训答疑白板上的五问五答](images/csdn-12-faq-board.png)

## 从「能连」到「能交稿」的验收签字单

技术连通只是起点。业务验收建议增加三栏签字：

1. 技术栏：healthz、四客户端任选其一完成 A 到 C 脚本。  
2. 业务栏：用脱敏真实结构样例跑出可核对列表，抽查批注锚点。  
3. 管理栏：确认开场白含确认规则、确认未暴露 62588、确认终审流程仍在。  

三栏都签完，才算「可以在本科室试用」。只签技术栏就全面铺开，后续争议会回到「谁让改的正文」。签字单可附在第 14 篇安全验收清单之后，两份一起归档。试用满两周后复盘一次：哪些提示词被改写、哪些错误码最常见、是否有人私改 URL，把结论写回配置模板再扩面。复盘纪要里固定附上当时的 healthz 截图与客户端配置片段，避免口口相传又漂回错误地址。

## 小结

Claude Code、Codex、OpenClaw、Hermes 对接察元 v4.0 时，审查能力的上限由本机 MCP 与模型配置决定，不由客户端品牌决定。记住三个常量：URL `http://127.0.0.1:62588/mcp`、服务名 `chayuan-wps-mcp`、写回必须确认。先验收本机，再复制各自配置片段，最后用同一套 A 到 D 脚本签字画押——培训成本会低很多。配置漂移靠「只公布一个 URL」压住，比事后比对四份私改配置更省事。
