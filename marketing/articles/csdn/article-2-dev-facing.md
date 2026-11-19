# 拆解察元AI文档助手：53 个 MCP 工具背后，把 WPS 变成智能体可编程接口的工程实现

> 面向开发者与智能体工具链玩家，约 3500 字。不聊界面，聊四件事：MCP 工具面怎么设计、"写文档"这种危险副作用怎么做成协议、并发写回怎么不互相覆盖、以及一个 WPS 加载项的安装器为什么要做四级体检。

## 一、从三个工程坑说起

给"文档 AI"做过工程的人都见过这几类事故：

- **结果进不了文档**。AI 的输出停在聊天记录里，"写回"靠复制粘贴——整条链路不可编程、不可审计、不可回滚；
- **两个自动化进程同写一个文档**。一个任务在替换错别字，另一个在插批注，后写的把先写的覆盖掉，谁也不知道丢的是什么；
- **工具一多，模型上下文先爆炸**。文档操作天然是长尾需求——表格、页眉、水印、书签、目录……每个都做成独立 MCP 工具，`tools/list` 很快上百个，模型还没干活先被工具定义撑满。

[察元 AI 文档助手](https://github.com/zhgyuhuii/chayuan)（下称察元，Apache-2.0 开源，当前版本 6.1.2）是运行在 WPS 三组件（文字 / 表格 / 演示）内部的 Vue 3 加载项，外加一个**本机 MCP 服务**（sidecar）。上面三个坑它都正面做了工程回答。先看全景。

## 二、全景：一个加载项 + 一个 sidecar

```
WPS 三宿主（文字 Writer / 表格 ET / 演示 WPP）
  └─ 察元AI助理加载项（Vue 3 + Vite，src/ 46 条路由）
       ├─ Ribbon 三端配置（public/ribbon*.xml，118 个按钮全部语义化图标）
       ├─ agent-core 内嵌智能体循环（规划 / 工具调用 / 跨回合记忆）
       └─ HTTP ↕
mcp-sidecar/（server.mjs + lib/toolCatalog.mjs）
  ├─ Streamable HTTP，仅监听 127.0.0.1:62588
  ├─ Bun 交叉编译 5 平台单文件二进制（免 Node.js 运行时）
  └─ 开机自启：Win HKCU\Run / macOS LaunchAgent / Linux systemd --user
```

架构上值得注意的一点：**编辑器里的 AI 和外部智能体跑的是同一个引擎**。加载项内的智能体循环和 MCP 工具最终落在同一套文档读写原语上——智能体在编辑器里看到的行为，和 Claude Code 经 MCP 看到的一致，不存在"两条通路两种语义"。

## 三、设计决策一：工具面的"聚合 + 别名"

`tools/list` 对外实见 **53 个工具**，但内部定义是 **69 个**：17 个细粒度工具被聚合为域工具，33 个旧名保留为别名兼容，可调用名合计 86 个。

聚合的逻辑可以直接看 `table` 这个域工具——一个工具带 **12 个 action 子操作**（切片读、插行列、合并单元格、列宽、导出）。类似地，`spreadsheet`（表格宿主）23 个动作、`presentation`（演示宿主）23 个动作。这是典型的"工具数量 vs 上下文预算"权衡：模型发现 53 个工具的成本可控，每个域内部再按 action 路由；旧名别名则保住了升级期兼容——老客户端的调用不炸。

配套的还有 Resources（`chayuan://wps/health`、`chayuan://guide/*`、`chayuan://assistants/*`）和 Prompts（逐段翻译插段后、打开本地文档）两个 MCP 原语面，把"说明书"从工具定义里挪出去。

## 四、设计决策二：把"写文档"做成协议

文档写操作是这类系统里最危险的副作用，察元把它做成三段协议：

```
预览（dryRun / preview，只读）
  → 确认（客户端带 confirmed:true）
    → 落盘（写记 audit.jsonl 审计）
```

不带确认直接调写工具，得到的是结构化错误 `CONFIRMATION_REQUIRED`，而不是静默成功。错误码是一套稳定的机器可读语义：`WPS_AGENT_OFFLINE`（WPS 没连上）、`DOCUMENT_TOO_LARGE`、`LOCATE_MISMATCH`（定位失配）、`MODEL_NOT_CONFIGURED`、`LICENSE_REQUIRED`——每个错误码都能对应到智能体的一个明确重试 / 上报策略，而不是一坨自由文本。

校对链路把这个协议用得最完整：`proofread_run`（dryRun 出问题清单）→ `proofread_apply_comments`（确认后写成 WPS 批注，钉在具体错字上）→ `proofread_job_poll`（异步任务轮询）。批量写回走 `document_apply_ops`，单次最多 **200 ops**（replace / comment / comment-replace / insert-after 四类），默认原子提交。

## 五、设计决策三：并发写回的四重保险

"两个智能体同写一个文档"在察元里是显式建模的场景：

1. **文档写锁**：以文档为单位加锁串行，v6.1.2 之后按 lockId 精确放锁；
2. **FIFO 排队**：写请求先进先出，不抢跑；
3. **OCC 写前校验**：落盘前核对文档状态，冲突显式提示而不是静默覆盖；
4. **写前快照**：首次写回自动快照，改坏随时一键撤销。

内嵌智能体循环同样有护栏：单回合工具调用上限 **100 步**；任务清单先列后做、N/M 进度实时透出；token 预算按模型窗口自适应——`min(窗口×25%, 32k)`，外部 MCP 客户端也可以用 `budgetTokens` 自报预算。这些限制的共同目的是同一个：**让模型的输出永远冲不垮文档状态机**。

## 六、设计决策四：降级要有铁律

两处降级设计值得单独看：

**三级生图**（演示端配图链）：模型生图 → 网络搜图 → SVG 矢量兜底。降级规则写成了铁律——"**上级失败才降级，绝不静默换花钱来源**"。图源四模式（auto / model / web / svg）用户可指定。这条规则的意义在于成本可预期：不会因为某家生图 API 超时，就静默切换到另一家付费服务。

**file_parse 的 token 预算三档**：预算内全文直出 → 超预算给结构目录 + 采样 → chunk 游标翻页（幂等重切 + 文件变更校验），返回体全程带 token 估算。让"读一个大文件"变成模型可分页、可恢复的操作，而不是一次性把上下文塞爆。旧版 .doc / .ppt / .et 格式则自动经 WPS 宿主转新格式再解析——副本操作，不碰原文件。

## 七、安装器工程：四级体检与装前停旧

WPS 加载项的分发是个脏活：jsaddons 多注册源、容器路径、旧版本残留，每一处都能造成"装完了但没生效"。察元的安装器做了两件值得抄的事：

- **装前停旧**：先 `launchctl bootout` → 四种进程模式 `pkill` → `lsof` 强杀 62588 端口占用并等待释放——根治"装完还是旧版"；
- **装后四级体检**：jsaddons 落位 → `/healthz` → MCP `initialize` 握手 → 桥接工具，任何一级失败都能定位到环节。macOS 沙盒版 WPS 的容器写入失败不再无声——日志响亮警告并给出修复脚本（status / 修复 / 回滚三模式）。

短板也直说：MCP 服务**无需鉴权，本机即信任边界**——它不适合被直接暴露到远程；跨机器调用需经本机代理或改 `CHAYUAN_MCP_PORT` 配合防火墙策略。另外定位类操作在频繁编辑的文档上可能出现 `LOCATE_MISMATCH`，智能体侧要有重定位重试的纪律。这些边界写进了错误码语义里，但使用者得知道。

## 八、跑起来

```bash
git clone https://github.com/zhgyuhuii/chayuan
cd chayuan && npm install
npm run dev              # 开发服务 http://localhost:3890
npm run dev:debug        # 三宿主联调（vite + 写三宿主调试注册 + 拉起 WPS）
npm run dev:debug -- --restore   # 结束调试，还原正式 publish.xml
npm run build:wps        # WPS 加载项打包
npm run mcp:sidecar      # 开发态 MCP 服务（127.0.0.1:62588）
npm run mcp:build-binary # 交叉编译 5 平台单文件二进制（需 Bun）
npm run doctor           # 项目自检
```

注意一个坑：三宿主（文字 / 表格 / 演示）联调**不要用 `wpsjs debug`**——它只注册单宿主，仓库提供了 `dev:debug` 全宿主替代。另有 `npm run test:agent-loop`（智能体循环 smoke）与 `npm run test:write-lock`（写锁 smoke）两个冒烟入口。

## 结语：把 WPS 变成智能体的 API 表面

看完成度之后，更值得记住的是它对"副作用"的态度：**文档写操作不是一次 API 调用，而是一段带确认、审计、并发控制和回滚的协议**。53 个工具只是表面，底下是"预览 → 确认 → 落盘 → 审计"的链路、稳定的错误码族、四重写回保险。

这让它和"给 AI 套个壳操作 Office"的项目拉开了差距：当写操作变成协议，智能体才敢被授予真实生产文档的权限——先 dryRun、人确认、可审计、可撤销。"可控、可审、可离线"这条路线，对要碰真实文档的团队来说，比多几个花哨功能重要得多。

- 仓库：https://github.com/zhgyuhuii/chayuan
- 官网：https://aidooo.com
- MCP 连接文档：仓库 `docs/mcp-connection.md`
