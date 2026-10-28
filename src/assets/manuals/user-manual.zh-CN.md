# wps-skill-chayuan 全方位指南：一条命令，让 AI 编程智能体直接读写你的 WPS 文档

> 适用版本：技能包 **v4.1.1** ｜ MCP 目录 **v0.10.0** ｜ **46 个文档工具 · 15 个域**
> 官网：<https://aidooo.com/skill> ｜ 开源：<https://github.com/zhgyuhuii/chayuan-wps-releases> ｜ 国内镜像：<https://gitee.com/cloudshd/chayuan-wps-releases>

---

## TL;DR（太长不看）

如果你正在用 **Claude Code / Cursor / Codex** 这类 AI 编程智能体，又常用 **WPS 文字** 写文档，那你大概率遇到过这个割裂感：AI 在终端里很聪明，可它**碰不到你正打开的那篇 .docx**——要先把文档内容复制粘贴出去，改完再粘回来，表格、批注、排版全丢。

`wps-skill-chayuan` 就是来消除这个割裂感的。**一条命令**，三样东西同时就绪：

1. **WPS 加载项**（察元 AI 文档助手）装进 WPS；
2. **本机 MCP 服务**开机自启（`127.0.0.1:62588`，无需 Token、数据不出域）；
3. **技能文件**投放进你本机的 Claude / Cursor / Codex。

装完，你在智能体里说一句「**帮我把当前 WPS 文档里的错别字用批注标出来**」，它就真的去改你屏幕上那篇文档了。

**一条命令（任选一条，粘贴到终端即可）：**

```powershell
# Windows（PowerShell）—— 不能直接 iwr | iex：PS 5.1 会按 GBK 解码导致乱码，必须显式 UTF-8 下载
& {[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$w=New-Object Net.WebClient;$w.Encoding=[Text.Encoding]::UTF8;$s=$w.DownloadString('https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.ps1');if($s.Length -and $s[0]-eq[char]0xFEFF){$s=$s.Substring(1)};& ([scriptblock]::Create($s)) -Fetch}
```

```bash
# macOS / Linux
curl -fsSL https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.sh | bash -s -- --fetch
```

> 脚本会自动多源回退下载便携包（Gitee→官网→GitHub，**SHA-256 强校验**），再完成全部安装。海外或 GitHub 直连好的，把 URL 换成 `https://raw.githubusercontent.com/zhgyuhuii/chayuan/main/scripts/install-wps-skill-chayuan.{ps1,sh}` 即可。

下面从「这是什么」一路讲到「怎么用、能干什么」。

---

## 一、这到底是什么？解决什么痛点？

### 1.1 三合一交付

`wps-skill-chayuan` 是一个**便携技能包**。一份技能定义（`SKILL.md`）+ 一个 4 步闭环安装脚本，把三样本来要分别配置的东西打成一个整体：

| 组件 | 作用 | 没有它会怎样 |
|------|------|--------------|
| **WPS 加载项**（察元 AI 文档助手） | 在 WPS 文字里提供任务窗格、Ribbon、右键菜单，能读写正文、加批注、改格式 | AI 没有手，碰不到文档 |
| **本机 MCP 服务**（sidecar） | 把「读/定位/改/批注/校对/表格/导出」等 **46 个工具**暴露成标准 MCP 接口 | 外部智能体无法标准化调用 WPS |
| **技能文件** | 告诉 Claude/Cursor/Codex「你有这些能力、该这么用」 | 智能体不知道 WPS 这套工具的存在 |

痛点就一句话：**AI 编程智能体很强，但它们和 WPS 文档之间缺一根标准化的管子。** MCP（Model Context Protocol）就是这根管子，而本技能包把这根管子**预先接好、开机自启、一条命令部署到各智能体**。

### 1.2 为什么是「技能」而不是「插件」？

- 对 **WPS 用户**：它表现为一个加载项（在编辑器内直接用）。
- 对 **开发者**：它表现为一个本机 MCP 服务（一个 URL 就能接）。
- 对 **AI 智能体**：它表现为一份技能/规则文件（告诉模型有哪些工具可用）。

同一个东西，三个视角，**装一次全齐**。这就是「双向自启」：你从「装技能」进去，加载项也装好了；你从「装加载项」进去，技能也带上了。

### 1.3 和「在浏览器里用大模型」的本质区别

| 维度 | 浏览器/独立 App 里的大模型 | wps-skill-chayuan |
|------|---------------------------|-------------------|
| 文档写回 | 复制粘贴，丢格式丢批注 | 插入/替换/**批注**/链接批注/追加，**可定位到具体字、具体单元格** |
| 表格 | 多数只能整段处理 | **12 个表格 action**：读切片、插行/列、合并单元格、统一列宽、导出 |
| 数据去向 | 正文上传到云端 | **仅本机回环 127.0.0.1，无 Token，可全离线** |
| 模型 | 锁定厂商 | **自选**：Ollama / LM Studio / Xinference / OneAPI 或任意云端 |

---

## 二、安装：一条命令，四个步骤

### 2.1 一行命令（推荐，终端用户）

把开头的两条命令之一粘贴到终端。脚本参数：

- `--fetch`（mac/linux）/ `-Fetch`（Windows）：只拿到脚本、需要联网补下载载荷时**必加**。一行命令场景下**已默认带上**。
- `--with-all` / `-WithAll`：强制部署到 Claude + Cursor + Codex（默认只装检测到的）。
- `--skill-only` / `-SkillOnly`：只投放技能文件，不动加载项 / 服务。
- `-Version 4.1.1`：指定版本。

> 已经克隆了本仓库？等价的本地写法：
> ```powershell
> powershell -ExecutionPolicy Bypass -File scripts\install-wps-skill-chayuan.ps1 -Fetch
> ```
> ```bash
> bash scripts/install-wps-skill-chayuan.sh --fetch
> ```

### 2.2 离线整包（内网 / 无外网机器）

从 [Gitee Releases](https://gitee.com/cloudshd/chayuan-wps-releases/releases) 或 [官网](https://aidooo.com/skill) 下载 `wps-skill-chayuan-4.1.1-portable.zip`，解压后进目录跑本地脚本（不带 `--fetch`，因为整包已在手）：

```bash
bash scripts/install-wps-skill-chayuan.sh          # mac/linux
powershell -ExecutionPolicy Bypass -File scripts\install-wps-skill-chayuan.ps1   # Windows
```

每个压缩包都带 `.sha256` 旁车文件，安装器下载后会**逐源强校验**，任一源被篡改都不会通过。

### 2.3 安装器到底干了什么（四步闭环）

同一条脚本，按顺序做四件事，**全程无需 Node.js**（sidecar 已预编译为单文件二进制）：

1. **装加载项** —— 把加载项释放到 WPS 的 jsaddons 目录并写好 `publish.xml`；**重启 WPS** 后功能区出现「察元」。
2. **MCP 自启** —— 释放 `chayuan-mcp-<平台>` 二进制，注册 **OS 级开机自启**：
   - Windows：注册表 `HKCU\…\Run\ChayuanWpsMcp`
   - macOS：LaunchAgent `com.chayuan.mcp`（`RunAtLoad` + `KeepAlive`）
   - Linux：systemd `--user` 单元 `chayuan-mcp.service`（`Restart=on-failure`）
3. **四级体检** —— `jsaddons` → `/healthz` → `initialize` 握手 → 桥接工具，**装完即验证可用**，不是「装完走人」。
4. **投放技能** —— 自动探测本机已装的 Claude / Cursor / Codex，按各自格式投放技能文件。

### 2.4 卸载

手动清理（暂未提供一键卸载）：

- **技能文件**：删 `~/.claude/skills/wps-skill-chayuan/`、`~/.cursor/rules/wps-skill-chayuan.mdc`、`~/.codex/prompts/wps-skill-chayuan.md`（及 `config.toml` 里的 `[mcp_servers.chayuan-wps-mcp]` 段）。
- **WPS 加载项**：删 jsaddons 目录里的 `chayuan_<版本>` 与对应 `publish.xml` 条目。
- **MCP 自启**：macOS `launchctl bootout gui/<uid>/com.chayuan.mcp`；Windows 删 `HKCU\…\Run\ChayuanWpsMcp` 后结束 62588 端口进程；Linux 停 `chayuan-mcp.service`。最后结束占用 62588 的进程即可。

---

## 三、配置：把 MCP 接到你的智能体（只需一个 URL）

技能装好后，**MCP 服务地址只有一个**，所有智能体通用：

```
http://127.0.0.1:62588/mcp
```

> 如果你是用「一条命令」装的，技能文件里已经写好这个地址，**多数情况无需再手动配置**。下面是「想手工接 / 想理解原理 / 换机器」时各智能体的配置位置。

### 3.1 Claude Code

CLI 一键注册（`--transport http`，`streamable-http` 是同义别名）：

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

或写项目级 / 用户级 `.mcp.json`：

```json
{
  "mcpServers": {
    "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" }
  }
}
```

技能文件落地：`~/.claude/skills/wps-skill-chayuan/SKILL.md`。装完在 Claude Code 里输入 `/skills` 可见 `wps-skill-chayuan`。

### 3.2 Cursor

项目级 `.cursor/mcp.json`（或 设置 → MCP → Add）：

```json
{
  "mcpServers": {
    "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" }
  }
}
```

规则文件落地：`~/.cursor/rules/wps-skill-chayuan.mdc`（frontmatter 含 description / globs / alwaysApply）。

### 3.3 OpenAI Codex（codex CLI）

编辑 `~/.codex/config.toml`，加一段 Streamable HTTP MCP server：

```toml
[mcp_servers.chayuan-wps-mcp]
url = "http://127.0.0.1:62588/mcp"
```

提示词落地：`~/.codex/prompts/wps-skill-chayuan.md`。

### 3.4 Hermes / OpenClaw / 其它 GUI 智能体

两者都支持 HTTP 类型 MCP server：**新建一个 MCP 服务，类型选 HTTP / Streamable HTTP，URL 填 `http://127.0.0.1:62588/mcp`**。无需 Token、无需命令行、无需 stdio。

### 3.5 Claude Desktop / 其它 JSON 配置型客户端

```json
{
  "mcpServers": {
    "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" }
  }
}
```

> **远程机器**注意：服务固定监听 `127.0.0.1:62588`（本机回环）。要让**另一台机器**调用，需经本机代理转发，或在该机设置 `CHAYUAN_MCP_PORT` 等环境变量调整。这是出于「涉密不出域」的安全设计，不是 bug。

---

## 四、验证：怎么确认装好了？

由易到难四种验证方式，任选其一：

### 4.1 健康检查（最快）

浏览器或 curl 访问：

```
GET http://127.0.0.1:62588/healthz
```

应返回 `online`。返回这个就说明 sidecar 已在跑。

### 4.2 分层状态（最全）

在智能体里让它调 `wps_status`（不给参数），或用 Inspector（见 4.4）调。它会返回分层健康：

- `agent.agentOnline` —— WPS 加载项是否连上 sidecar
- `document.*` —— 当前活动文档名 / 路径
- `ui.visibleWpsWindows` —— 是否有可见的 WPS 窗口（防止文档在后台 Preview 态被误判为「已打开」）

### 4.3 一句话冒烟测试

打开任意一篇 WPS 文档，在智能体里说：

> 用察元读一下当前文档的前三段，告诉我大致在讲什么。

如果它真的读到了你屏幕上的内容——成了。

### 4.4 MCP Inspector（不依赖 IDE，最直观）

```bash
npx @modelcontextprotocol/inspector
```

选 **Streamable HTTP**，填 `http://127.0.0.1:62588/mcp`，点 Connect。能看到 46 个工具的完整列表、参数、并能手动调用——这是验收「到底接没接上」的金标准。

### 4.5 关于「四级体检」

安装脚本结尾自动跑的四级体检（jsaddons → /healthz → initialize → 桥接工具）结果会写进：

- Windows：`%LOCALAPPDATA%\chayuan-wps\mcp\selftest-run.json`
- 仓库侧：`mcp-sidecar/last-selftest.json`

判据：`GO` / `GO_WITH_CAUTION` = 全链路可用；`NO_GO` 多半是本机没装 WPS（`KWPS.Document.12` 注册表缺失）。

---

## 五、使用：从一句话到文档被改（端到端走查）

下面四个例子覆盖最典型的工作流。**核心心法：你（的人）提需求，AI（模型）负责推理判断，工具只负责读/定位/写——写之前默认先预览，你确认了再落盘。**

### 5.1 错别字校对：先预览、再批注

打开一篇文档，对智能体说：

> 帮我检查这篇文档的错别字，先用 dryRun 汇总问题，不要改正文。

模型会走 `proofread_run({dryRun:true})`，返回一张问题清单。你扫一眼，回一句「**确认写成批注**」，它再调 `proofread_apply_comments` 把批注**钉到具体错字上**（包括表格单元格里的字）。

想要它直接改正文？说「找出错别字并直接改正，先给我预览清单，确认后再执行」。

### 5.2 逐段翻译并插到段后

> 把全文译成英文，每一段中文后面插入对应英文译文；插入前先预览第一段，我确认风格后再全部执行。

模型的标准剧本：

1. `document_list_paragraphs` —— 取出每段文本 + start/end 锚点；
2. **模型自己翻译**（工具不翻译，只搬运）；
3. `document_apply_ops({action:"insert-after", confirmed:false})` —— 先预览；
4. 你确认 → `confirmed:true` 一次性批量写回（≤200 段一次调用），**从最后一段往前插**避免锚点漂移。

### 5.3 表格：插行、合并单元格（v4.1 新能力）

表格在 v4.1 从 9 个 action 扩到 **12 个**，能按口语「在哪插」操作结构：

> 在「销售额」这一列后面插一列「环比」；再把表头第一行的前两个单元格合并。

模型剧本：

1. `table(action:list)` → `table(action:header_read)` / `column_read` 找到「销售额」列的索引；
2. `table(action:column_insert,{col:<找到的列>, where:"after", confirmed:true})`；
3. `table(action:cell_merge,{row1:1,col1:1,row2:1,col2:2, confirmed:true})` —— 同行 = 跨列合并，同列 = 跨行合并。

工具**只按显式坐标执行**，不替你猜「在哪」——这是「工具只执行事实，模型负责判断」纪律的体现，避免幻觉式改表。

### 5.4 保密检查（涉密场景，辅助非定密）

> 帮我检查这份材料的保密风险和敏感信息，用批注标出疑似身份证号、手机号、内部路径。

模型用保密类能力扫描，把命中项**用批注钉在原文上**。需要真正脱密（替换成占位符）时走 `declassify_preview`（不写盘）→ 你确认 → `declassify_apply`（需密码 + confirmed）→ 日后 `declassify_restore` 用密码复原。

> **重要免责**：保密检查 / AI 痕迹检查仅作**辅助参考**，不替代人工定密，不构成司法结论。

---

## 六、技能功能清单：46 个工具 · 15 个域

架构上分两层：**31 个核心工具**（按职责命名）+ **15 个域聚合工具**（带 `action=` 判别，把同类细操作收拢）。合计 **46**。

> 设计纪律：工具只返回**事实**（读到了什么、定位到哪、写没写成功），**判断永远在模型这一侧**。没有「评判类」工具，也不会过度抓取——模型按需取用、组合调用，而不是一个工具干完所有事。

### 6.1 核心工具（31 个）

**WPS 连接与文档生命周期**

| 工具 | 作用 |
|------|------|
| `wps_status` | 分层健康：sidecar / Agent 在线 / 活动文档 / 可见窗口 |
| `wps_launch` | OS 冷启动 WPS 文字并等 Agent 连接 |
| `document_open` | 打开本地 .docx 为活动文档（可见窗口） |
| `document_ensure_open` | 与活动文档一致则 no-op，否则打开 |
| `document_list_open` | 列出当前打开的文档 |
| `document_activate` | 在已开文档间切换（name/path/query/index） |
| `document_new` | 新建空白文档或从模板开副本 |
| `document_save` | 保存 / 另存为 |

**读取与定位**

| 工具 | 作用 |
|------|------|
| `document_meta` | 元信息：名称 / 字数 / 段数 / 是否建议分块 |
| `document_list_paragraphs` | 分页段落文本（含 start/end 锚点，**逐段工作流入口**） |
| `document_chunks` | 长文分页分块（cursor/limit，百万字友好） |
| `document_get_text` | 文档/选区纯文本（超 ~80k 需 force 或改用 chunks） |
| `document_locate` | 定位字词/句，返回多命中用于锚点 |

**写回（改正文）**

| 工具 | 作用 |
|------|------|
| `document_replace` | 替换锚点文本段（先 preview 再 confirmed） |
| `document_insert` | 相对锚点/文末插入（after/before/append/prepend） |
| `document_apply_ops` | **批量写回**（replace/comment/comment-replace/insert-after，≤200 ops） |

**字符与段落格式**

| 工具 | 作用 |
|------|------|
| `format_run` | 字符外观：加粗/斜体/下划线/删除线、字体/字号/颜色/高亮/拼音 |
| `format_para` | 段落外观：对齐 / 行距 / 段前段后 / 首行缩进 |
| `format_apply_ops` | 批量套格式（run/para，≤100 ops） |
| `system_fonts_list` | 列出本机可用字体名 |

**校对 · 知识库 · 助手 · 脱密**

| 工具 | 作用 |
|------|------|
| `proofread_run` | 跑错别字/语法校对（dryRun 默认仅返回 issues） |
| `proofread_apply_comments` | 把 issues 转成 WPS 批注（需 confirm） |
| `proofread_job_poll` | 轮询异步校对任务进度 |
| `kb_retrieve` | 检索知识库片段供模型推理（只读） |
| `assistants_list_domains` | 列出察元助手领域目录（Agent 离线也可用） |
| `assistants_search` | 按查询/领域检索数千个察元助手 |
| `assistants_get` | 导出单个助手完整定义/提示词 |
| `declassify_status` | 查询是否处于脱密/遮蔽态 |
| `declassify_preview` | 由关键词构建遮蔽预览（不写盘） |
| `declassify_apply` | 应用脱密（需 confirm + 密码 + 关键词） |
| `declassify_restore` | 用密码复原脱密文档 |

### 6.2 域聚合工具（15 个域，带 `action=`）

| 域 | action 清单 | 典型用途 |
|----|-------------|----------|
| **`table`**（12 action） | `insert` `list` `header_read` `row_read` `column_read` `cell_read` `header_repeat` `column_set_width` `export` `row_insert` `column_insert` `cell_merge` | 表格切片读 + 插行/列 + 合并 + 列宽/重复表头 + 导出 md/csv/json |
| **`comment`** | `list` `add` `delete` | 批注增删查 |
| **`revision`** | `mode` `list` `apply` | 修订模式开关 / 列修订 / 接受·拒绝 |
| **`layout`** | `page` `columns` `break` `blank_page` | 纸张方向页边距 / 分栏 / 分页分节符 / 空白页 |
| **`nav`** | `location` `outline` `pane_set` | 页码行号 / 标题大纲 / 导航窗格 |
| **`toc`** | `insert` `update` | 插入自动目录 / 更新目录 |
| **`bookmark`** | `list` `goto` | 书签列表 / 跳转 |
| **`caption`** | `list` | 图/表/式题注枚举（连续性由模型判断） |
| **`field`** | `list` `add` | 域枚举（SEQ/TOC/PAGEREF/DATE）+ 构造 SEQ/TOC 域 |
| **`image`** | `list` `insert` `delete` `export` | 图片增删查导出 |
| **`hyperlink`** | `list` `add` `delete` | 超链接增删查 |
| **`headerfooter`** | `get` `set` | 页眉页脚读写 |
| **`watermark`** | `set` `clear` | 文字水印加 / 清 |
| **`style`** | `list` `apply` `audit` | 样式列表 / 应用（如标题1）/ 统计·清理未用 |
| **`export`** | `file` | 导出 docx / pdf |

### 6.3 写操作的「先预览再确认」纪律

凡是会改文档的工具，都遵循同一套确认策略：

| 未传 `confirmed:true` | 传了 |
|------------------------|------|
| 返回 `preview:true`（或 `CONFIRMATION_REQUIRED`），**不写盘** | 落盘 + 审计 |

适用：`document_replace` / `document_insert` / `document_apply_ops` / `format_*` / 各域写 action / `declassify_apply|restore` / `proofread_apply_comments`。**这意味着模型不会偷偷改你的稿**——除非你明确说「确认」。

---

## 七、使用场景大全（带可直接复制的提示词）

下面按场景给出提示词。原则：**先预览 / dryRun，再确认写批注或改正文；涉密、定稿类务必人工复核。**

### 7.1 校对类

| 场景 | 提示词 |
|------|--------|
| 全文错别字 | 帮我检查文档中的错别字，用批注标出原文和建议改法 |
| 选区错别字 | 只检查当前选区的错别字，写成批注 |
| 表格内错别字 | 重点检查表格单元格里的错别字，批注必须钉在具体错字上 |
| 同音/形近字 | 排查同音别字（的/地/得、象/像）和形近字（己/已/巳） |
| 标点符号 | 检查标点（中英文混用、引号书名号配对、顿号逗号），用批注标出 |
| 病句语法 | 检查病句、搭配不当、成分残缺，用批注给出改法 |
| 序号体例 | 检查标题/条款序号（一、（一）、1.）是否层级混乱 |
| 先预览后写回 | 先 dryRun 汇总问题，不要改正文；我确认后再写成批注 |

### 7.2 正确性与逻辑

| 场景 | 提示词 |
|------|--------|
| 正确性总检 | 核对这篇文章：错别字、标点、语法、前后矛盾一并查，结果用批注 |
| 数字勾稽 | 核对数表与正文数字是否一致（合计、百分比） |
| 时间线 | 检查日期、工期、里程碑时间线是否合理 |
| 图表一致 | 核对正文描述与表格内容是否一致 |
| 版本对比 | 对照上一版/附件，打开两份文档标出口径变化处 |

### 7.3 公文 / 合同 / 规范

| 场景 | 提示词 |
|------|--------|
| 公文格式 | 按党政机关公文习惯检查标题、主送、落款、附件说明是否缺项 |
| 合同条款 | 检查合同是否缺主体、金额、期限、违约责任，列风险清单批注 |
| 敏感措辞 | 标出绝对化用语（务必、从未、100%）并建议弱化 |
| 落款日期 | 检查成文日期、签发人是否齐全 |

### 7.4 翻译 / 润色 / 摘要

| 场景 | 提示词 |
|------|--------|
| 逐段翻译插段后 | 帮我翻译成英文，并把译文插到每一段后面 |
| 仅译文批注 | 给出译文建议，用批注写在原段，不要改正文 |
| 润色 | 在不改变原意的前提下润色全文，改动处用批注说明 |
| 摘要 | 生成 300 字以内摘要，插入文档开头（先预览） |
| 去 AI 腔 | 弱化「首先其次总之」等模板腔，给修改建议批注 |

### 7.5 表格 / 名单

| 场景 | 提示词 |
|------|--------|
| 表内校对 | 检查表格内文字的错别字与标点，批注钉在单元格文字上 |
| 插行/列 | 在「XX」列后面插一列「YY」 |
| 合并表头 | 把表头第一行的前两个单元格合并 |
| 统一列宽 | 把所有列宽统一为相同宽度 |
| 导出表格 | 把第一张表导出成 Markdown |
| 名单去重 | 检查人员名单是否重名、漏项 |

### 7.6 定位 / 替换 / 批量写回

| 场景 | 提示词 |
|------|--------|
| 批量替换 | 把「永鹅」全部替换为「咏鹅」，先预览再确认 |
| 条件替换 | 仅在表格第二列把 A 替换为 B |
| 批注解释 | 给所有「待确认」字样加批注「请业务确认」 |

### 7.7 保密 / 脱密（辅助，非定密）

| 场景 | 提示词 |
|------|--------|
| 保密风险 | 帮我检查保密风险与敏感信息，用批注标出 |
| 找敏感号 | 查找疑似身份证号、手机号、银行卡号并批注 |
| 脱密预览 | 按关键词做脱密预览，先不要落盘 |
| 外发前检查 | 外发前再扫一遍是否残留内部路径、账号、未脱敏字段 |

### 7.8 排版 / 结构

| 场景 | 提示词 |
|------|--------|
| 自动目录 | 帮我基于标题样式插入一个自动目录 |
| 设标题样式 | 把「第一章 总则」设为一级标题 |
| 分页/分栏 | 在这里插一个分页符 / 把正文分成两栏 |
| 页眉页脚 | 设置页眉为「内部资料」 |
| 加水印 | 给文档加一个「机密」水印 |
| 导出 PDF | 把当前文档导出为 PDF 到桌面 |

### 7.9 组合工作流（可整段粘贴）

```text
你是 WPS 文档校对助手，通过 chayuan-wps-mcp 操作当前文档：
1）先 proofread dryRun，检查错别字、标点、明显病句；
2）汇总问题列表给我确认；
3）我回复「确认写批注」后，再写成 WPS 批注（钉在具体文字上，尤其是表格）；
4）不要擅自改正文，除非我明确说「确认替换」。
```

```text
帮我做发布前终检：错别字、标点、数字前后一致性、表格与正文是否一致；
全部用批注输出；最后给我一份问题分级摘要（严重/一般/建议）。
```

---

## 八、进阶用法

### 8.1 百万字长文：分块剧本

千万别对百万字文档默认 `document_get_text`（会返回 `DOCUMENT_TOO_LARGE`）。正确剧本：

1. `document_meta` → 看 `recommendChunks` / `charCount`；
2. 循环 `document_chunks({cursor, limit:1..3})` → 模型处理这一段；
3. 产出带 `originalText` + `start/end` 的 ops；
4. `document_apply_ops`（不 confirm）预览 → 确认后 `confirmed:true`。

### 8.2 自定义助手（约数千个，按需检索导出）

不把几千个察元助手都注册成工具（那样模型选择面爆炸）。而是：

- `assistants_search({query:"合同审查", domain:"法务"})` 找到助手；
- `assistants_get({id})` 导出它的完整提示词；
- 模型按这个提示词 + 文档工具执行流程。

### 8.3 多文档串行

「依次处理这两份文件：先错别字批注，再统一术语」——模型用 `document_open` / `document_activate` 在文档间切换，逐份处理。

### 8.4 知识库对照（需已配置 KB）

「对照知识库里的制度，检查本文是否违规表述，引用条文批注」——`kb_retrieve({query})` 取片段 → 模型对照 → `comment` 加批注。

### 8.5 资源（Resources）

| URI | 作用 |
|-----|------|
| `chayuan://wps/health` | 分层健康状态 |
| `chayuan://assistants/manifest` | 助手领域清单 |
| `chayuan://assistants/domain/{domain}` | 某领域助手摘要 |
| `chayuan://assistants/{id}` | 助手完整定义 |
| `chayuan://guide/tool-routing` | 工具分层路由指引 |

---

## 九、安全与合规

| 维度 | 说明 |
|------|------|
| **网络边界** | MCP 仅监听 `127.0.0.1:62588`，本机即信任边界，不对外 |
| **鉴权** | 无需 Token、无需命令行、无需 stdio |
| **数据出域** | sidecar 与 WPS 同机；模型可配**离线 / 内网端点**（Ollama、LM Studio、Xinference、OneAPI 等 OpenAI 兼容服务），正文不出本机 |
| **完整性** | 每个发布包带 `.sha256` 旁车文件，安装器逐源强校验，防供应链篡改 |
| **可还原** | 脱密用密码可复原；批量/脱密/替换类操作前务必备份原件 |
| **免责** | 保密检查、AI 痕迹检查仅作**辅助参考**，不替代人工定密与法务审查，不构成司法结论 |

**涉密 / 内网部署建议**：优先离线模型 + 隔离终端；密钥按岗最小授权；外发审计报告注意渠道。MCP 发现文件 `%LOCALAPPDATA%\chayuan-wps\mcp\mcp-server.json` 记录 url / port / wpsExecutable，便于运维定位。

---

## 十、常见问题（FAQ）

**Q：需要装 Node.js 吗？**
不需要。安装器是纯 POSIX bash（mac/linux）与 PowerShell（Windows），技能包里已预编译各平台 MCP 二进制，开箱即用。二进制缺失时 autostart 脚本才回落 `node server.mjs`。

**Q：技能和加载项是什么关系？**
技能包 = WPS 加载项 + 本机 MCP + 各智能体技能文件的「三合一」交付。装一次，三样齐备。

**Q：连不上 MCP 怎么办？**
① 确认 WPS 已打开、察元加载项已加载（`GET /healthz` 返回 `online`）；② 服务固定在 `127.0.0.1:62588`，被占用时会启动失败，结束占用进程后重启；③ 看 `%LOCALAPPDATA%\chayuan-wps\mcp\selftest-run.json` 的体检结论。

**Q：模型会不会偷偷改我的稿？**
不会。所有写操作默认返回预览，必须你明确「确认」（`confirmed:true`）才落盘。

**Q：表格工具会自己猜「在哪插」吗？**
不会。`row_insert` / `column_insert` / `cell_merge` 都要**显式坐标**，模型先用 `header_read` / `column_read` 找到锚点再调用——工具只执行事实，判断在模型侧。

**Q：支持哪些 AI 智能体？**
任何支持 **Streamable HTTP MCP** 的客户端：Claude Code、Cursor、OpenAI Codex、Hermes、OpenClaw、Claude Desktop、Cline 等。填同一个 URL 即可。

**Q：适合涉密环境吗？**
适合。MCP 仅本机回环、无 Token；模型可指向离线/内网端点，正文不出域。但自动检查不替代定密程序。

**Q：怎么换模型？**
WPS 加载项里：设置 → 模型与供应商，填 OpenAI 兼容端点（本机 Ollama/LM Studio 或云端）。外部智能体则用它自己的模型配置，MCP 只管「接 WPS」，不绑模型。

**Q：GitHub 被墙怎么办？**
一行命令默认走 Gitee（国内首选）；安装器 `--fetch` 会按 Gitee→官网→GitHub 顺序回退。

---

## 十一、获取与版本

| 渠道 | 地址 |
|------|------|
| 官网（技能页 + 下载） | <https://aidooo.com/skill> |
| GitHub（源码 + Release） | <https://github.com/zhgyuhuii/chayuan-wps-releases> |
| Gitee（国内镜像 + Release） | <https://gitee.com/cloudshd/chayuan-wps-releases> |
| 一条命令安装 | 见本文 §2.1 |

**版本信息**：技能包 v4.1.1 ｜ MCP 目录 v0.10.0 ｜ 46 工具 / 15 域 ｜ Apache-2.0。
出品：北京智灵鸟科技中心。

---

## 十二、结语

`wps-skill-chayuan` 想做的事很简单：**把 AI 编程智能体的聪明，接到你正写的那篇 WPS 文档上**——不用复制粘贴、不用在浏览器和编辑器之间反复横跳、不用把涉密正文传到云端。

一条命令装好，一个 URL 接通，然后你只管用自然语言提需求：校对、翻译、改表格、查保密、做摘要、排目录……模型负责想，工具负责读写，你掌握每一处改动的最终裁量权。

把 AI 当作「加速审阅与起草的副驾驶」，而不是「替代签字的驾驶员」——这是在严肃办公场景里用好它的最稳妥心态。祝用得安心、审得清楚、写得高效。

> 更多工具参数与连接细节见 [`docs/mcp-connection.md`](./mcp-connection.md)；v4.1 变更见 [`RELEASE_NOTES_v4.1.md`](../RELEASE_NOTES_v4.1.md)。
