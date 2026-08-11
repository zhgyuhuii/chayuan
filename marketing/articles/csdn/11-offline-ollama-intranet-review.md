# 内网离线用 Ollama 审 WPS：本机 MCP 与察元 v4.0 全链路

单位内网、隔离网或不能把稿件送到公有云的办公场景里，自动审查仍然可以跑通。路径不是「把文档上传到某个在线 AI」，而是三件事落在同一台电脑上：WPS 打开稿件、察元 AI 文档助手 v4.0 提供本机 MCP、Ollama（或同类本地推理）提供校对模型。外部客户端（Claude Code、Codex、OpenClaw、Hermes）只连本机 HTTP 端点，文档正文默认不离开这台机器。

本文按可复现步骤写：安装与验收、配 Ollama、接通 chayuan-wps-mcp、跑一遍预览与确认写批注，以及内网常见故障。更完整的客户端对比见 [./12-claude-codex-openclaw-hermes.md](./12-claude-codex-openclaw-hermes.md)；写回确认与端口暴露边界见 [./14-confirm-security-localhost.md](./14-confirm-security-localhost.md)；错误码对照见 [./15-errors-troubleshooting-handbook.md](./15-errors-troubleshooting-handbook.md)。

![内网离线审查总览：WPS、察元 MCP、Ollama 三块同机](images/csdn-11-overview.png)

## 先固定架构，再动手

### 三条进程各自干什么

察元加载项跑在 WPS 文字里，负责读段落、定位原文、写批注、在确认后替换。本机 MCP sidecar 固定监听：

```
http://127.0.0.1:62588/mcp
```

健康检查：

```
GET http://127.0.0.1:62588/healthz
```

期望返回在线或 `online`。服务名在各客户端里写成 `chayuan-wps-mcp`。默认只绑 `127.0.0.1`，不要求 Token。

Ollama 负责推理。察元设置里把对话/校对模型指到 Ollama 的 OpenAI 兼容接口（常见本机端口 `11434`）。MCP 通了只说明智能体能调文档工具；校对能否出问题列表，取决于模型是否配置成功。否则你会直接撞上 `MODEL_NOT_CONFIGURED`。

### 内网与「完全离线」的差别

内网通常允许访问单位自建的模型网关或某台 GPU 机器上的 Ollama/Xinference/OneAPI。完全离线则要求模型权重已在本机拉取完毕，DNS 与外网都不可用时仍能 `ollama list` 看到模型。两种环境对察元侧的配置方式相同：填基础 URL、可选密钥、选定对话模型；差别只在 URL 指向本机还是内网 IP。

官方 MCP 说明可参考 [Model Context Protocol](https://modelcontextprotocol.io/) 与 Claude 的 [MCP 文档](https://code.claude.com/docs/en/mcp)。察元侧连接细则以仓库 [docs/mcp-connection.md](https://github.com/zhgyuhuii/chayuan/blob/main/docs/mcp-connection.md) 为准。

![架构示意：客户端只访问 127.0.0.1:62588，模型走本机或内网 Ollama](images/csdn-11-architecture.png)

## 安装察元 v4.0 并确认加载项在线

### 下载与安装

发行渠道以项目说明为准，常见有官网 [https://aidooo.com](https://aidooo.com) 与 GitHub Releases。v4.0 起安装包内嵌 sidecar 二进制，并注册开机自启，一般不必再单独装 Node.js。按操作系统下载对应包，装完必须真正打开一次 WPS 文字；只装包不启动，Agent 往往未注册，后面客户端会报 `WPS_AGENT_OFFLINE`。

Windows 走 exe 安装向导；macOS 走 pkg；Linux 常见 deb。装完在功能区或任务窗格确认察元入口可见。若没有，到 WPS 加载项管理里启用。

![安装完成后 WPS 中察元入口可见](images/csdn-11-addin-visible.png)

### 五分钟本机验收

1. 打开 WPS，新建测试稿，故意写两处错别字。  
2. 浏览器访问 `http://127.0.0.1:62588/healthz`，确认在线。  
3. 打开察元设置 → MCP 服务，刷新状态；未启动则按界面启动。  
4. 暂不接外部 Agent，先在加载项内跑一次「拼写与语法检查」，确认能出问题列表或批注。  
5. 再配 Ollama 与外部客户端。顺序反了，排错会把「模型没配」和「MCP 没起」搅在一起。

![浏览器访问 healthz 返回 online](images/csdn-11-healthz-online.png)

## 在内网部署并配置 Ollama

### 本机 Ollama 最小步骤

1. 按 [Ollama 官网](https://ollama.com/) 安装客户端（内网环境改用离线安装包或内网镜像）。  
2. 拉取适合中文校对的对话模型，例如单位已批准的量化模型；命令形态为 `ollama pull <model>`。  
3. 确认服务监听：本机访问 OpenAI 兼容根路径（常见 `http://127.0.0.1:11434/v1`）。  
4. 用一段短文本调用 chat completions，确认非空回复。这一步失败时，不要进入察元设置。

完全离线时，提前在可联网机器导出模型文件，再按 Ollama 文档导入；本文不展开镜像搬运细节，只要求最终 `ollama list` 能看到目标模型且推理可用。

![Ollama list 显示已拉取的中文对话模型](images/csdn-11-ollama-list.png)

### 内网共用一台推理机

若 GPU 在另一台内网主机：

- 在推理机上启动 Ollama，并按单位网络规范决定是否监听非本机网卡。  
- 办公机上的察元「基础 URL」填 `http://<内网IP>:11434/v1`（以实际兼容路径为准）。  
- 办公机到推理机的连通性用 curl 或浏览器测通，再写入察元。  
- 不要把推理机端口对公网暴露；内网 ACL 按最小授权。

文档仍只在办公机的 WPS 里；MCP 仍是 `127.0.0.1:62588`。跨机器的是模型推理，不是把 MCP 直接挂到局域网，除非你清楚代理与风险（见第 14 篇）。

### 写入察元模型设置

1. 打开察元设置 → 模型与供应商。  
2. 新增或启用一家 OpenAI 兼容供应商。  
3. 基础 URL 指向 Ollama 或内网网关；密钥按网关要求填写，纯本地 Ollama 常可留空或填任意占位（以当前版本界面校验为准）。  
4. 拉取或手填模型名，选定默认对话模型，类型必须是对话，不要误选纯嵌入模型。  
5. 保存后，用加载项内检查再跑一次测试稿。能出问题列表，才说明 `MODEL_NOT_CONFIGURED` 这条链路已打通。

![察元模型设置页指向本机 Ollama（密钥打码）](images/csdn-11-model-settings.png)

## 接通本机 MCP：同一 URL，多种客户端

### 固定端点

所有支持 Streamable HTTP MCP 的客户端共用：

```
http://127.0.0.1:62588/mcp
```

服务名：`chayuan-wps-mcp`。不要选 stdio，不要编造 Token。Claude Code 示例：

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

Codex 在 `~/.codex/config.toml` 写 URL；OpenClaw/Hermes 在界面选 HTTP / Streamable HTTP 填同一地址。细节对比见 [./12-claude-codex-openclaw-hermes.md](./12-claude-codex-openclaw-hermes.md)。

可用 [MCP Inspector](https://github.com/modelcontextprotocol/inspector) 做不依赖 IDE 的验收：

```bash
npx @modelcontextprotocol/inspector
```

连接上述 URL，能列出文档与校对相关工具即成功。

![MCP Inspector 连接到 62588 并列出工具](images/csdn-11-mcp-inspector.png)

### 冒烟指令（先读后审）

在客户端里先下只读任务：

```text
通过 chayuan-wps-mcp 读取当前 WPS 文档标题和前两段，不要修改，不要写批注。
```

成功后再上审查。若此时报 `WPS_AGENT_OFFLINE`：回到 WPS，确认加载项已加载，刷新 healthz，再重试。不要先怀疑 Ollama——离线错误发生在 Agent 通道，与模型无关。

## 离线审查操作顺序：预览 → 确认 → 写批注

### 推荐开场白

把下面整段贴进客户端系统说明或首条消息：

```text
你通过 chayuan-wps-mcp 操作当前 WPS 文档。
1）先校对预览（dryRun），检查错别字、标点、明显病句；
2）汇总问题列表给我，不要改正文；
3）我回复「确认写批注」后，再写成 WPS 批注，钉在具体文字上；
4）没有「确认替换」，禁止改正文；
5）脱密相关工具禁止擅自调用；需要脱密时必须由我提供密码并明确确认。
```

写操作在协议层要求 `confirmed=true`。未确认会返回 `CONFIRMATION_REQUIRED`。这是设计，不是故障。人机分工写清楚，比指望某个客户端「自动安全」更稳。

### 一趟完整演练

1. 测试稿保持打开且为活动文档。  
2. 下达：对当前文档做错别字与标点审查，先给问题列表，不要写批注。  
3. 核对列表：原文片段是否找得到、建议是否合理。  
4. 回复：确认写批注。  
5. 在 WPS 批注窗格点开几条，看锚点是否落在错字上，而不是段落末尾糊一条。  
6. 需要改字时，按条说「确认替换第 2、5 条」，其余保持批注。

![预览问题列表后用户确认，WPS 出现批注](images/csdn-11-preview-then-comment.png)

### 长文与表格

长文一次拉全文可能触发 `DOCUMENT_TOO_LARGE`（量级约超过数万字符且未强制时）。正确做法是让智能体按块或按段落读：`document_chunks` / 分段列表一类工具，而不是 `force=true` 硬拉。表格多的稿件，明确要求「批注钉在单元格具体错字上」，避免批注飘到表格外。

公文、合同场景的提示词模板见 [./13-official-doc-contract-scenarios.md](./13-official-doc-contract-scenarios.md)。

## 内网落地检查清单

### 网络与权限

- MCP 保持 `127.0.0.1`；不要为了「方便同事连你的 WPS」而把 62588 映射到 0.0.0.0 或做无鉴权端口转发。  
- 模型流量可以走内网推理机；文档写回仍在本机 WPS。  
- 公共办公机慎用个人云密钥；离线链路用 Ollama 可减少密钥扩散。  
- 涉密定稿以单位制度为准；自动审查只做初筛，终审仍是人。

### 版本与升级

v4.0 端口仍为 `62588`，外部客户端配置一般不用改。从 v3.x 升级通常是全量替换安装包。升级后重复 healthz + 加载项内检查 + 一条只读 MCP 冒烟，三步都过再交给业务用户。

![察元设置中 MCP 服务状态为在线](images/csdn-11-mcp-settings-online.png)

## 常见故障快查

### WPS_AGENT_OFFLINE

现象：客户端列不出工具，或任何文档工具失败并带该错误码。  
处理：打开 WPS → 确认察元已加载 → 访问 healthz → 在 MCP 服务页刷新/启动 → 重试只读冒烟。仍失败再查端口占用与是否误连了别的机器的 IP。

### MODEL_NOT_CONFIGURED

现象：能读文档，一跑校对就失败。  
处理：回到察元模型设置，确认 Ollama URL、模型名、默认对话模型；用加载项内检查验证；再让 Agent 调校对。

### CONFIRMATION_REQUIRED

现象：预览成功，写批注或替换被拒。  
处理：用户明确回复确认；确保工具参数带 `confirmed=true`。不要让模型「自己发明确认」。

### DOCUMENT_TOO_LARGE

现象：读全文失败。  
处理：改分块读取；拆任务（先审前 20 段，再审后续）；不要默认 force。

### LOCATE_NOT_FOUND / LOCATE_MISMATCH

现象：替换或批注定位失败。  
处理：重新读取原文片段，保证 `originalText` 与当前文档一致；文档若已被人工改过，先刷新再定位。详见 [./15-errors-troubleshooting-handbook.md](./15-errors-troubleshooting-handbook.md)。

## 内网试点一周怎么排

### 第 1 天：单机打通

只在一台办公机安装察元 v4.0 与 Ollama，不接业务稿。完成 healthz、加载项内检查、Inspector 列工具、只读冒烟、一次预览加确认写批注。全程用故意造错的测试稿。把每一步截图存到内部文档，后面培训直接复用。

### 第 2 到 3 天：模型与提示词稳态

换两到三个单位批准的本地模型，用同一份测试稿对比：问题召回是否稳定、批注锚点是否仍准确、耗时是否可接受。选定默认模型后冻结配置，禁止每人私自改基础 URL。把通用开场白和公文/合同提示词（见第 13 篇）放进客户端模板。

### 第 4 到 5 天：小范围业务试跑

选两名文秘或法务助理，各带一份已脱敏的真实结构样例（非涉密）。只允许预览和写批注，不允许批量替换。收集三类反馈：锚点是否靠谱、缺项提示是否吵、哪些条目必须人工否决。据此改提示词，而不是先改端口或暴露 MCP。

### 第 6 到 7 天：制度与回滚

写出内部一页纸：端点是什么、什么时候能 confirmed、脱密要密码、62588 不许映射公网、终审仍是人。演练一次故障：关掉 WPS 看到 `WPS_AGENT_OFFLINE`，清掉模型配置看到 `MODEL_NOT_CONFIGURED`，未确认写回看到 `CONFIRMATION_REQUIRED`。试点结束时保留配置导出说明与联系人，避免只有一个人会修。

![内网试点七天看板：打通、稳态、试跑、制度](images/csdn-11-pilot-week.png)

## 与加载项内检查如何分工

外部客户端适合多步推理、按你的话拆任务、跨段落归纳。加载项内「拼写与语法检查」适合不打开 Claude Code / OpenClaw 时的快速初筛。内网环境建议：

- 日常短稿：加载项内检查。  
- 长稿、合同要素、要留下对话痕迹的审查：走 MCP 客户端，并强制预览确认。  
- 两者都依赖同一套模型配置；模型坏了两条路一起坏，不要只重装客户端。

若单位暂时禁止安装任何外部 Agent，仍然可以把 Ollama 配进察元，只使用加载项能力；等政策允许再挂上 `chayuan-wps-mcp`。端点与工具集已经在 v4.0 里，不会因为晚接客户端而作废。切换到外部客户端那天，只要 healthz 仍 online、模型仍可用，通常不必重装加载项，按第 12 篇补上 URL 即可开审。

## 小结：离线链路上你真正要守住的点

同机三件套：WPS 活动文档、察元 MCP（`chayuan-wps-mcp` @ `62588`）、Ollama 对话模型。验收顺序：healthz → 加载项内检查 → MCP 只读冒烟 → 预览 → 确认写批注。模型可以在内网另一台机器，MCP 默认不要离开本机回环地址。把确认策略写进开场白，内网审查才能既可用又可控。试点按周推进，先稳态再扩人，比一天铺开五十台更少返工。
