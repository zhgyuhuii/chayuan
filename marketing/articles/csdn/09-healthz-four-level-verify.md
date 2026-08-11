# healthz 与四级验证：怎样确认 Claude MCP 真的装成功

把 `claude mcp add` 跑完，不等于审查可用。常见假阳性是：配置文件里有服务名，但 healthz 不通；或 healthz 通了，Agent 仍离线；或工具列表有了，一读文档就报 `WPS_AGENT_OFFLINE`。本文把验收收成固定四级，并说明每一级通过/失败时查什么。对象是察元本机 MCP：服务名 `chayuan-wps-mcp`，MCP 地址 `http://127.0.0.1:62588/mcp`，健康检查 `http://127.0.0.1:62588/healthz`。

安装包与发行说明见 [aidooo.com](https://aidooo.com) 与 [GitHub Releases](https://github.com/zhgyuhuii/chayuan-wps-releases)。Claude 侧 MCP 配置通识见 [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp)。总流程见 [全生命周期安装与审查](./01-lifecycle-install-to-claude.md)。

![四级验证总览图](images/csdn-09-1.png)

## 零级：本机服务先活（healthz）

在谈 Claude 之前，浏览器或 curl 访问：

```text
http://127.0.0.1:62588/healthz
```

期望返回在线或 `online`。这一步不经过 Claude，成本最低。

### 不通时怎么查

1. 是否安装了察元，sidecar 是否自启（Windows Run 键 / macOS LaunchAgent / Linux user unit，以发行说明为准）。
2. 察元设置 → MCP 服务，刷新状态，必要时「启动本机服务」。
3. 端口是否被占用，或是否误用自定义 `CHAYUAN_MCP_PORT` 却仍访问 62588。
4. 是否把地址写成了局域网 IP。默认只监听 `127.0.0.1`，远端机器不能直连，需要本机代理。

healthz 通，只说明 sidecar HTTP 服务在听。它不保证 WPS 加载项已注册 Agent，也不保证有活动文档。

![浏览器 healthz 返回 online](images/csdn-09-2.png)

## 安装 Claude 侧服务

WPS 已打开、healthz 为 online 后：

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

或在 `.mcp.json` 写入：

```json
{
  "mcpServers": {
    "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" }
  }
}
```

要求：

1. 服务名用 `chayuan-wps-mcp`。
2. transport 用 http（streamable-http 为同义别名）。
3. 不要配成 stdio 去启动某条本地命令。
4. 不需要 Token。

保存后重启或刷新 MCP 列表。然后进入四级验收，不要直接扔生产文稿。

## 第一级：列表可见

### 通过标准

在 Claude Code 的 MCP 列表中能看到 `chayuan-wps-mcp`，状态为已连接或可用。

### 失败常见原因

1. 配置写在了错误层级（项目级/用户级搞反）。
2. JSON 语法错误，客户端忽略了该文件。
3. 服务名拼错，列表里是别的名字。
4. 客户端未刷新。

### 处理

核对配置片段与官方 MCP 说明；把服务名改回 `chayuan-wps-mcp`；重载 MCP。仍不可见时，用 Inspector 旁路验证（见下文），判断是 Claude 配置问题还是本机服务问题。

## 第二级：工具可见

### 通过标准

展开服务后能看到文档相关工具，例如（名称以当前版本为准）：`wps_status`、`wps_launch`、`document_open`、`document_meta`、`document_chunks`、`document_get_text`、`document_locate`、`document_replace`、`document_add_comment`、`proofread_run`、`proofread_apply_comments` 等，总量约二十余个文档智能体工具。

### 失败常见原因

1. 连到了旧进程或错误端口。
2. 代理/过滤导致工具列表被截断。
3. 客户端缓存了失败的初始化结果。

### 处理

刷新连接；确认 URL 精确到 `/mcp`；看察元设置页能否「测试连接 / 拉取工具」。工具列表为空不要进入第三级。

![Claude MCP 工具列表局部](images/csdn-09-3.png)

## 第三级：只读冒烟

WPS 中打开一份测试稿（短、可丢）。对 Claude 说：

```text
通过 chayuan-wps-mcp 告诉我当前活动文档的文件名和大概字数，不要改正文，不要写批注。
```

### 通过标准

回报的文件名与 WPS 标题栏一致，字数同一量级。

### 失败形态 A：WPS_AGENT_OFFLINE

含义：sidecar 在，WPS/加载项未连上。处理：

1. 确认 WPS 文字已打开（不是只开了表格或演示）。
2. 确认察元加载项已加载，任务窗格或功能区入口可见。
3. 完全退出 WPS 再开，等 Agent 注册。
4. 再打 healthz 与 `wps_status`。

装了包却从没打开过 WPS，是这一级的高频坑。

### 失败形态 B：有工具但读不到文档

可能没有活动文档，或窗口不可见。先手动打开 docx，或让客户端走 `document_open` / `wps_launch`（按环境权限）。多文档场景更要先 open 再读，见 [多文档交叉校对](./08-multi-document-cross-proofread.md)。

## 第四级：审查预览冒烟

```text
对当前文档做校对预览，列出错别字和标点问题，不要写批注，不要改正文。
```

### 通过标准

返回问题列表（哪怕测试稿只有故意埋的两三个错字）。说明校对链路通了。

### 失败形态：MODEL_NOT_CONFIGURED

MCP 通不等于模型可用。到察元设置配置对话/校对模型，用加载项「拼写与语法检查」先自检。模型篇见 [模型与供应商配置](./03-model-provider-config.md)，加载项对比见 [加载项内置检查对比 Claude MCP](./10-addon-vs-claude-mcp.md)。

### 失败形态：预览有、一写就要求确认

对 `document_add_comment` / `proofread_apply_comments` 而言，这是正常的 `CONFIRMATION_REQUIRED`。回复「确认写批注」后再写。不要把确认提示当成安装失败。

![只读冒烟与校对预览同屏](images/csdn-09-4.png)

## 可选旁路：MCP Inspector

不依赖 IDE 时：

```bash
npx @modelcontextprotocol/inspector
```

选择 Streamable HTTP，填 `http://127.0.0.1:62588/mcp`，连接后看工具列表。Inspector 能过而 Claude 不能过，问题在客户端配置；两者都不能过，回零级与 Agent 状态。

## 四级与 wps_status 分层的关系

`wps_status` 提供 sidecar / Agent / 活动文档 / 可见窗口分层视图。建议对照：

| 验收级 | 主要看什么 |
| --- | --- |
| 零级 healthz | sidecar HTTP |
| 第一级列表 | 客户端配置 |
| 第二级工具 | MCP 初始化 |
| 第三级只读 | Agent + 活动文档 |
| 第四级预览 | 模型 + 校对工具链 |

哪一级失败就停在哪一级，避免「一把梭改配置」。错误码汇总见 [错误码与排错](./15-error-codes-troubleshooting.md)。

## 安装成功后的最小回归集

每次升级察元或 Claude 大版本，用五分钟跑完：

1. healthz online。
2. MCP 列表有 `chayuan-wps-mcp`。
3. 工具数大致正常。
4. 只读文件名。
5. dryRun 预览三条以内问题。
6. （可选）确认写批注一条，看锚点；表格稿再加挂整格抽查，见 [表格批注锚点](./06-table-comment-anchor.md)。

回归不通过不要进入批量文件审查。长文还要额外看 chunks 路径，见 [长文档分块审查](./07-long-doc-chunk-review.md)。

## 配置模板与反模式

### 推荐

```json
{
  "mcpServers": {
    "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" }
  }
}
```

### 反模式

1. 填 Token「显得更安全」——当前本机服务按设计不走 Token，乱填可能导致客户端行为怪异。
2. 用 stdio 指到某个 js 入口——发行版主路径是 HTTP sidecar。
3. 把 URL 写成 `http://127.0.0.1:62588/` 漏掉 `/mcp`。
4. 服务名写成 `chayuan`、`wps-mcp` 等，和文档、同事话术不一致。
5. healthz 都没通就开始改 Claude 提示词。

## 与 Spike / 设置页自检

设置页若提供 Spike 或自检，可在零级与第三级之间跑一次，确认 sidecar、Agent、文档桥。自检报告路径以本机发行说明为准（常见在用户目录 MCP 数据目录下）。Spike 失败时，仍以 healthz 与 `WPS_AGENT_OFFLINE` 为第一线索：多数是 WPS 未开或加载项未加载。

## 验收记录怎么写（给实施单）

建议每人装机留一张表：

| 项 | 结果 | 时间 | 备注 |
| --- | --- | --- | --- |
| healthz | online / 失败 |  |  |
| MCP 列表 | 可见 / 不可见 |  |  |
| 工具可见 | 是 / 否 |  | 约 N 个 |
| 只读冒烟 | 通过 / 离线码 |  | 文件名 |
| 预览冒烟 | 通过 / 模型未配 |  |  |
| 确认写批注 | 可选 |  | 锚点是否准 |

这张表比「已安装」两个字有用。培训场合可以当场投屏跑四级，比只演示聊天更有说服力。

## 现场装机口述稿（可照读）

下面一段可以直接当培训口述，控制在八分钟左右。

第一，打开浏览器访问本机 healthz，看到 online 再往下。看不到就去察元设置启动本机服务，不要先怪 Claude。第二，打开 WPS 文字和一份测试稿，确认察元入口还在。第三，终端执行 `claude mcp add`，服务名必须是 `chayuan-wps-mcp`，地址带 `/mcp`。第四，看 MCP 列表是否出现该服务。第五，展开工具，确认有文档类工具。第六，问当前文件名和字数，对得上才算桥通。第七，要求校对预览且禁止写批注，能出列表才算审查链路通。第八，需要写回时再说确认写批注，并点开批注窗格看一眼。

口述结束后立刻让学员互相对着验收表打勾，而不是只听讲。

## 三级失败的决策树（打印版）

```text
healthz 非 online？
  → 查 sidecar 自启 / 设置页启动 / 端口占用 / 是否误用局域网 IP
healthz online 但 Claude 列表没有服务？
  → 查 .mcp.json 层级与 JSON 语法 / 服务名 / 刷新客户端
列表有但工具空？
  → 查 URL 是否漏 /mcp / 是否连错端口 / Inspector 旁路
工具有但只读报 WPS_AGENT_OFFLINE？
  → 打开 WPS 文字与加载项 / 重启 WPS / 再看 wps_status
只读通但预览报 MODEL_NOT_CONFIGURED？
  → 察元设置配模型 / 加载项内先自检
预览通但写批注被拒绝？
  → 正常，回复确认写批注；不要当成安装失败
```

把决策树贴在机房或发到工作群，减少重复提问。

## Windows / macOS / Linux 差异（验收视角）

### Windows

自解压安装后常见 Run 键自启 sidecar。验收时若 healthz 不通，先看任务管理器是否有 `chayuan-mcp` 一类进程，再回设置页启动。杀毒软件偶发拦截本机监听，需按单位白名单流程处理，本文不展开绕过手法。

### macOS

pkg 安装后注意权限与 LaunchAgent。第一次打开 WPS 与加载项后，再测 healthz。若系统隐私设置拦住自动化，只读冒烟可能失败，表现仍可能是 Agent 离线类错误。

### Linux

deb 安装后桌面环境差异大。以 healthz 与设置页状态为准，不要只看「安装成功」提示。WPS 文字是否被当前版本支持，以发行说明为准。

三平台命令都一样：`claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp`。差异在本机服务是否真的起来、WPS 是否真的加载了察元。

## 与 Spike、selftest 的关系

开发或深度实施同事可能跑 `mcp:selftest` 或设置页 Spike。对业务装机，四级验收已经足够。Spike 更细，能区分 WebSocket 探测与长轮询回落等细节；业务同事不必在第一天接触。若 Spike 失败而四级里第三级也失败，两边结论一致：先修 Agent 连接。若 Spike 警告但四级通过，可以记录「GO_WITH_CAUTION」类状态，不阻断培训。

## 常见假阳性案例

### 案例 1：配置里有服务，实际连的是旧端口

同事改过 `CHAYUAN_MCP_PORT`，Claude 仍指向 62588。列表可能残留缓存或连到空服务。处理：统一环境变量与 URL，清客户端 MCP 缓存后重连。

### 案例 2：healthz online，但打开的是另一台机器的隧道残留

有人用过 SSH 本地转发，隧道关了但浏览器还开着旧页。以当场重新访问 healthz 为准。

### 案例 3：第四级用正式稿，列表太空

测试稿没有错字，预览「通过」却看不出链路。应使用故意埋错的短稿，才能区分「链路通」与「稿子太干净」。

### 案例 4：把确认提示当成失败

学员截图 `CONFIRMATION_REQUIRED` 来报修。培训时应先演示一次「预览 → 确认写批注 → 批注出现」，把门闩当成功能而不是故障。

## 验收通过后的第一周守护

1. 每天第一次使用前扫一眼 healthz（五秒）。
2. 升级察元或 Claude 后重跑四级（五分钟）。
3. 首次表格审查加挂整格抽查（见表格篇）。
4. 首次长文审查确认走了 meta/chunks（见长文档篇）。
5. 首次多文档审查确认写回前回报文件名（见多文档篇）。

守护动作写进岗位交接，比写在聊天记录里可靠。

## 和官方文档的分工

Claude 官方 MCP 文档解释的是通用客户端如何声明服务器与传输方式；察元连接说明解释的是本机 URL、工具清单与错误码。装机时两者都要会打开：[code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp) 与仓库 docs。产品下载仍走 [aidooo.com](https://aidooo.com) 或 [GitHub Releases](https://github.com/zhgyuhuii/chayuan-wps-releases)。不要在群里传播来路不明的「一键整合包」绕过 healthz 验收。

## 小结

判定 Claude MCP 安装成功，用证据链而不是用感觉：healthz online → 列表有 `chayuan-wps-mcp` → 工具可见 → 只读文件名一致 → 校对预览出列表。任何一级失败都有对应排查面；`WPS_AGENT_OFFLINE` 优先开 WPS 与加载项，`MODEL_NOT_CONFIGURED` 优先配模型，`CONFIRMATION_REQUIRED` 则按设计确认。把四级写进科室装机单，后面的表格锚点、长文分块、多文档交叉才有稳定地面。口述稿、决策树、假阳性案例三件套齐了，装机支持量会明显下降。

再补一条实施纪律：任何「帮我看看 Claude 连不上」的报修单，支持人员都先要对方贴出 healthz 原文、MCP 列表截图、只读冒烟对话三样，缺一样不进入猜配置阶段。三样齐全时，四级里卡在哪一级通常一眼能定。养成这个接单习惯，比再写一篇排错长文更能减少反复沟通。装机现场也可以把这三样直接写进验收表的附件栏，作为机器交付物一并归档。交付当天不归档，两周后基本无法复盘当时到底是端口问题还是 Agent 离线。这一点务必写进支持流程。
