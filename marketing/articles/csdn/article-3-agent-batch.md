# 让 Claude Code 一口气校完一个目录的公文：察元 WPS 批量校对流水线实操

> 智能体玩家向实操文，约 2800 字。前置条件：一台装了 WPS 的电脑（Windows / macOS / Linux 都行）。全程本机完成，文档不出机器。

## 一、单文档演示骗了你

刷到过的演示视频大概都长这样：打开一份文档，让 AI 查错别字，批注落下来，掌声。但真实的工作量从来不是"一份文档"——是年终归档的一个目录：15 份总结、8 份合同、一摞部门上报材料。错别字要查，术语要统一，数字要交叉核对，而且最好明天早上就要。

这篇走一条完整的批量流水线：一条命令装好环境 → 一行接入 Claude Code → 一个目录的文档批量校对与批量替换 → 任务编排收尾。所有写操作都有预览和撤销，不用拿生产文档赌运气。

## 二、第一步：一条命令，装齐三件事

察元的技能包 `wps-skill-chayuan` 把安装收敛成一条命令，跑完同时就位三件事：**WPS 加载项 + MCP 开机自启服务 + AI 客户端技能文件**。

Windows（PowerShell）：

```powershell
& {[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$w=New-Object Net.WebClient;$w.Encoding=[Text.Encoding]::UTF8;$s=$w.DownloadString('https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.ps1');if($s.Length -and $s[0]-eq[char]0xFEFF){$s=$s.Substring(1)};& ([scriptblock]::Create($s)) -Fetch}
```

（为什么不直接 `iwr | iex`：Windows PowerShell 5.1 默认按 GBK 解码返回体，UTF-8 脚本会因 BOM 首字节乱码报错。这条命令显式按 UTF-8 解码再执行，顺便绕过执行策略。）

macOS / Linux：

```bash
curl -fsSL https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.sh | bash -s -- --fetch
```

脚本自动多源回退下载（Gitee → aidooo → GitHub，sha256 强校验），然后干四件事：释放加载项到 jsaddons 目录、注册 MCP 开机自启（免 Node.js，单文件二进制）、跑四级体检（jsaddons 落位 → `/healthz` → MCP 握手 → 桥接工具）、把技能文件投放到本机探测到的 Claude / Cursor / Codex。

有个设计值得一提：**双向自启**。从"装技能"这端开始跑，脚本顺带把加载项和服务装好；从"装加载项"那端开始，也能一键把技能反向投放到 AI 客户端。殊途同归，不用关心先后顺序。

## 三、第二步：一行接入 Claude Code

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

或写入项目级 `.mcp.json`：

```json
{
  "mcpServers": {
    "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" }
  }
}
```

服务只监听 `127.0.0.1`（本机即信任边界），无需 Token。健康检查：浏览器开 `http://127.0.0.1:62588/healthz`，返回 `online` 即就绪。Cursor / Codex / Cline 等其他客户端的接法见仓库 `docs/mcp-connection.md`，格式大同小异。

## 四、第三步：流水线跑起来

场景：某个目录下有 15 份 .docx，要求：查错别字写成批注、统一术语、另存加后缀。你对 Claude Code 说的话和它实际做的事，按顺序是这样的：

**① 冷启动确认。** 先说"确认 WPS 和察元已就绪"——智能体调 `wps_status` 看分层健康（sidecar / Agent / 三宿主 / 活动文档），没开会调 `wps_launch` 冷启动 WPS 并等待加载项连上。

**② 打开整目录文档。** "打开这个目录下的全部 docx"——`document_open` 逐份打开，`document_list_open` 确认都在场。15 份文档同进程待命，切换用 `document_activate`。

**③ 校对先预览。** "逐份跑校对 dryRun，汇总问题清单，先别改"——`proofread_run` 出结构化问题清单（错别字、语法、标点、固定搭配），智能体汇总一份分级摘要给你。这一步只读不写。

**④ 你确认，它写批注。** 回复"确认，写成批注"——`proofread_apply_comments` 带 `confirmed:true` 落批注，批注钉在具体错字上（表格单元格也钉得住）；量大走异步任务，`proofread_job_poll` 轮询进度。每次确认写都记入 `audit.jsonl` 审计。

**⑤ 术语批量替换。** "把『信息化建设』统一为『数字化转型』，先预览"——`document_apply_ops` 单次最多 **200 ops**，超过自动分批；四类动作（replace / comment / comment-replace / insert-after）够覆盖这类整编任务。

**⑥ 另存收尾。** "全部另存为原名加『-已校对』后缀"——`document_save` 逐份另存，原件不动。

实际体感：批注落完后在 WPS 里逐条过，比从头到尾人工通读快得多。AI 的价值在"把可疑点全部标出来"，判断权还在你手里。

## 五、批量场景的三道保险

批量写回最容易出事故，察元的护栏在这个场景里不是摆设：

- **权限三档**（变更前确认 / 自动执行 / 完全访问）：批量任务建议保持默认的"变更前确认"；
- **写前快照**：首次写回自动快照，整批不满意一键撤销；
- **写锁 + FIFO + OCC 写前校验**：你自己在编辑器里改、智能体在外面写，两边不会互相覆盖——冲突会显式提示，而不是静默覆盖。

## 六、想常跑？上任务编排

如果这类流水线每周都要来一遍，不必每次靠对话即兴发挥：

- **任务清单**（功能区入口）：后台任务统一筛选，带保密风险概览；
- **任务中心**（⌘K 呼出）：全部后台任务的状态管理；
- **任务编排**：可视化画布，把多助手、多检查点串成有向流程，失败可回滚——批量校对这类固定流程，编排一次，以后一键跑。

## 七、组合拳提示词（可整段复制）

```text
你是 WPS 文档校对助手，通过 chayuan-wps-mcp 操作当前目录的文档：
1）先逐份 proofread dryRun，检查错别字、标点、明显病句；
2）汇总问题清单给我确认；
3）我回复「确认写批注」后，再写成 WPS 批注（钉在具体文字上，尤其是表格）；
4）术语替换类操作先预览，我确认后再执行；
5）全部完成后逐份另存，文件名加「-已校对」后缀。
```

## 八、还能让它干什么

同一套 MCP 工具面（对外 53 个工具），还能支撑这些玩法：

- **版本对比**：打开两份文档，标出口径与数字变化；
- **老格式进对话**：.doc / .ppt / .et 经 `file_parse` 自动转新格式解析（副本操作，不碰原文件）；
- **模板批量出稿**：`template_generate` 按公司模板后台生成整套汇报文档；
- **制度对照**：`kb_retrieve` 检索知识库，引用条文写批注；
- **敏感信息筛查**：身份证号、手机号、银行卡号批注定位。

最后说清边界：**校对不等于定稿**。涉密材料、对外合同、发文稿，AI 标完之后必须人工通读——这套产品自己也在文档里反复强调"辅助参考、人工复核"。让机器筛一遍，把人的精力留给判断，这才是批量校对的正确姿势。

- 仓库：https://github.com/zhgyuhuii/chayuan
- 官网与下载：https://aidooo.com
