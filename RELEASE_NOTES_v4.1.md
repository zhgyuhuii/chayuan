# 察元 AI 文档助手 v4.1.0 — 表格结构写入 · 技能与加载项双向自启

> 发布日期：2026-08-13
> 兼容性：WPS 文字 12.x / WPS 365（WebView2）；Windows / macOS / Linux
> 升级路径：v4.0.x → v4.1.0 全量替换安装包；本机 MCP 端口仍为 `62588`，外部客户端配置无需修改
> MCP 目录版本（SERVER_INFO）：`0.10.0` · 共 **46 个工具** · `table` 域 **12 个 action**

本次版本主线有两条：**(一) 表格结构写回** —— 文档智能体不仅能读表格、改表格里的字，还能按用户口语「在哪插」**插入行 / 插入列**、**合并单元格**；**(二) 一条命令双向打通** —— 新增 `wps-skill-chayuan` 技能，跑一次安装脚本即同时装好 **WPS 加载项 + MCP 自启服务 + AI 客户端技能文件**，装技能等于装加载项，装加载项也带上技能。

---

## 一、最大亮点 — 表格结构写回（table 域 12 action）

`table` 域从原先仅有的 `insert`（建空表）扩展为 **12 个 action**，覆盖**发现 / 切片读取 / 几何写 / 结构写 / 序列化导出**。遵守架构纪律：**工具只接收显式坐标与返回事实，"在哪插 / 合并谁"的判断由 AI 完成**。

### 1.1 新增：插入行 / 插入列 / 合并单元格（用户反馈驱动）

| action | 入参 | 行为 |
| --- | --- | --- |
| `row_insert` | `tableIndex`、`row`（锚点行）、`where`=`before`\|`after`、`count`、`confirmed` | 在指定行**前 / 后**插入 N 行 |
| `column_insert` | `tableIndex`、`col`（锚点列）、`where`=`before`\|`after`、`count`、`confirmed` | 在指定列**前 / 后**插入 N 列 |
| `cell_merge` | `tableIndex`、`row1/col1/row2/col2`（矩形两角）、`confirmed` | 合并区域；同行→**合并列**，同列→**合并行** |

**口语即定位**：用户说「在名称列后面插入一列」「把最后两行合并」「标题行下面插一行」—— AI 先用 `header_read` / `column_read` 找到锚点列/行的编号，再调用 `column_insert(col, where)` / `row_insert(row, where)` / `cell_merge(...)`。工具不猜位置，只按显式坐标执行。

真机验证（`爱唠叨的妈妈.docx`）：插入行 3→4、插入列 3→4、纵向合并 `direction=rows`（合并行）、横向合并 `direction=columns`（合并列），17/17 全过。

### 1.2 table 域完整 action 一览

```
读取（无需 confirmed）      写回（需 confirmed）
 list        发现全部表       insert         建空表
 header_read 读表头           header_repeat  表头跨页重复
 row_read    读一行           column_set_width  统一列宽
 column_read 读一列           row_insert     ★ 插入行
 cell_read   读一格           column_insert  ★ 插入列
 export      序列化(md/csv)   cell_merge     ★ 合并单元格
```

- `export` 只返回序列化**数据**，不落盘。
- `cell_read` 返回的 `range` 可直接交给 `document_replace(start,end)` 精确改字；表头 `header_read` 的 `range` 可交给 `format_run` 加粗标红、或交给 `style(action=apply)` 套标题样式。

---

## 二、文档智能体工具大扩展（26 → 46）

MCP 目录版本升至 `0.10.0`，对外工具数从 26 增至 **46**（聚合域 16 + 细粒度 30）。

| 新增 / 增强 | 说明 |
| --- | --- |
| `table` 域 | 上节 12 个 action |
| `caption` 域（新增） | 只读 `list`，枚举图/表/式题注事实（SEQ 域 / 纯文本）；**连续性、缺漏、标签统一性判断交 AI** |
| `field` 域（新增） | `list`（枚举 SEQ/TOC/PAGEREF/DATE 等域）+ `add`（构造 SEQ 题注域、TOC 目录域；失败降级纯文本） |
| `image.list` 增强 | 每张图补 `altText` / `title` / `wrap` / `width` / `height` / 前后文，供 AI 判断 alt 缺失、尺寸不一、无题注 |

设计纪律（`mcp-tool-architecture.zh-CN.md` §P7）保持不变：**工具不内置判断、不过度取数、能用组合就不新建工具**。题注连续性、跳号、alt 合规等"判断"一律由 AI 在读取事实后完成。

---

## 三、wps-skill-chayuan 技能 — 一条命令，双向自启

新增**便携技能包** `wps-skill-chayuan`：一份技能定义（`SKILL.md`）+ 4 步闭环安装脚本，让 **Claude Code / Cursor / OpenAI Codex** 开箱即用察元的 46 个文档工具。

### 3.1 一次安装，四处就绪（双向自启）

`install-wps-skill-chayuan.ps1`（Windows）/ `.sh`（macOS/Linux）**同一个脚本干完四步**：

| 步骤 | 动作 | 结果 |
| --- | --- | --- |
| **STEP 1** 装加载项 | 释放到 `%APPDATA%\Kingsoft\wps\jsaddons\chayuan_4.1.0\` + 写 `publish.xml` | **WPS 打开即加载察元** |
| **STEP 2** MCP 自启 | 释放 `chayuan-mcp` 二进制 + 注册开机自启（Win `HKCU\Run` / macOS LaunchAgent / Linux systemd --user） | **开机即常驻，无需 Node.js** |
| **STEP 3** 四级体检 | L1 jsaddons → L2 `/healthz` → L3 `initialize` 握手 → L4 桥接工具 | **装完即验证可用** |
| **STEP 4** 投放技能 | 自动探测 Claude / Cursor / Codex，投放技能文件 | **AI 客户端立刻拥有察元技能** |

**双向打通的含义**：
- **装技能 = 装加载项** —— 跑安装脚本本意是给 AI 客户端装技能（STEP 4），但它**顺带把 WPS 加载项和 MCP 服务也装好了**（STEP 1+2）。即：拿到技能包的机器，WPS 侧也自动就绪。
- **装加载项 = 带技能** —— 反之，从 WPS 加载项侧安装察元后，设置页可一键把技能文件投放到本机已装的 AI 客户端，无需再手动配 MCP。

无论从哪一端开始，**跑完一次脚本，WPS 加载项 + MCP 自启服务 + AI 客户端技能**三者全部到位。

### 3.2 安装命令

**Windows（PowerShell）：**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-wps-skill-chayuan.ps1 -Fetch -Version 4.1.0
```

**macOS / Linux（bash）：**

```bash
bash scripts/install-wps-skill-chayuan.sh --fetch --version 4.1.0
```

- `-Fetch` / `--fetch`：本地无载荷时从镜像源（Gitee / aidooo / GitHub，带 sha256 校验）自动下载便携包。
- `-SkillOnly`：只投放技能文件，不动加载项 / 服务（适合加载项已就位、只想接 AI 客户端的场景）。
- 脚本详情见 `plans/wps-skill-chayuan-design.md` §16。

### 3.3 连接地址（不变）

技能安装并打开 WPS 后，MCP 端点仍是：

```
http://127.0.0.1:62588/mcp        # 健康检查 GET /healthz 期望 online
```

无需 Token、无需命令行、无需 stdio。

---

## 四、安装与发布产物

| 产物 | 说明 |
| --- | --- |
| `chayuan-4.1.0-windows-x64.exe` | Windows 自解压安装包（插件 + MCP 二进制 + 开机自启） |
| `chayuan-4.1.0-macos-arm64.pkg` | macOS Apple Silicon |
| `chayuan-4.1.0-linux-x64.deb` | Linux x64 |
| `wps-skill-chayuan-4.1.0-portable.zip` / `.7z` | 便携技能包（含加载项载荷 + MCP 二进制 + 安装脚本） |

---

## 五、相对 v4.0 的定位

| | v4.0.0 | v4.1.0 |
| --- | --- | --- |
| 主线 | 本机 MCP 文档智能体正式版 | **表格结构写回 + 技能双向自启** |
| 工具数 | 26 | **46**（catalog 0.10.0） |
| 表格能力 | 仅 `insert` + 批注锚点 | **12 action**：切片读 + 插入行/列 + 合并单元格 + 列宽/重复表头 + 导出 |
| 安装 | 加载项 + sidecar 自启 | **+ 一条命令双向装技能 / 加载项 / MCP** |
| 题注 / 域 | — | `caption.list` / `field.list`+`add` |

v4.0 的 MCP 对接、多 Agent 连接、离线 / 内网部署、知识库 RAG、多文档校对等能力**全部保留并兼容**，外部客户端配置无需改动。

---

## 六、升级与排障提示

1. 升级后**完全退出并重启 WPS**，确认加载项版本为 4.1.0、`jsaddons` 目录为 `chayuan_4.1.0`。
2. 外部客户端连不上：先打开 WPS + 察元，再访问 `http://127.0.0.1:62588/healthz`（期望 `online`）。
3. 用技能安装脚本时若 MCP 未拉起，重跑脚本（STEP 2 会注册自启），或手动启动安装目录中的 `chayuan-mcp`。
4. 远端机器无法直连 `127.0.0.1`；需本机代理或自定义 `CHAYUAN_MCP_PORT`。
5. 表格结构写回为**破坏性写**，AI 默认先 `confirmed=false` 预览，再 `confirmed=true` 落盘；涉密 / 定稿文档务必人工复核。

---

## 七、v4.1.1 补丁（2026-08-14）

v4.1.1 在 v4.1.0 基础上集中修复**一行命令安装脚本**与**加载项 ↔ sidecar 重连**的稳定性问题（功能与工具集不变，仍为 46 工具 / catalog `0.10.0`）。已修复：

- **PS 5.1 一行命令乱码 / 崩溃**：`iwr | iex` 在 Windows 自带 PowerShell 5.1 下按 GBK 解码返回体、且 scriptblock 无 `$PSScriptRoot` → 首字节乱码 + `Join-Path` 空串报错。改用 `WebClient` + 显式 UTF-8 解码（去 BOM）+ `$PWD` 回落，既绕过执行策略又不乱码。
- **`-Fetch` 下载路径崩溃**：`install-staging` 定位三处空串 / 包根错位，导致解压后找不到 `install.json`。修正包根解析（取 `install.json` 两层父目录 = 包根）。
- **`-Fetch` 走 aidooo 通道路径 + manifest 强校验**：首选源改为官网 `releases.json` 的 `chayuan.skill.universal` 条目（publish API 实时写入、国内可达），sha256 从 manifest 校验；Gitee / GitHub 为同级 `.sha256` 回退源。任一源被篡改都不会通过。
- **sidecar 重启后加载项约 8s 自愈**：MCP sidecar 重启 / 升级时，WPS 加载项自动在约 8 秒内重连，无需重开 WPS。
- **`-Fetch` 临时目录退出即清理**：安装脚本下载解压的 `%TEMP%\<GUID>` 整包（zip + 解压 ≈ 290 MB）此前每次残留、逐次累积；现 `.ps1` 主流程 `try/finally` 末尾 `Clear-FetchedTemp`、`.sh` 注册 `trap … EXIT`，成功 / 抛错 / 退出均清理，不再占用临时盘。

> **升级**：已装 v4.0 / v4.1.0 / v4.1.1 的用户重跑一行命令（`-Fetch`）即可拿到最新脚本与整包；一行命令拉取的是 Gitee / GitHub raw 上的最新脚本，整包走 aidooo manifest 强校验。本机 MCP 端口仍为 `62588`，外部客户端配置无需改动。
