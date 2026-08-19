# wps_launch 冷启动：Agent 先开机再干活的链路

周一早上我在终端里让 Claude Code 处理三份会议纪要，第一个工具调用就吃了 WPS_AGENT_OFFLINE。盯着报错愣了两秒才反应过来：WPS 还没开。服务活着而 WPS 不在，是最典型的伪故障：报错码吓人，原因却轻得很。这件小事值得复盘，因为它把察元整条执行链路摊开了——AI Agent 办公落地喊了一年，真正干活时，Agent 得先学会"开机"。

## 链路一共有五层

第一层是 chayuan-mcp 服务，也就是 sidecar。安装时被注册成开机自启：Windows 写进 HKCU\Run，macOS 用 LaunchAgent，Linux 走 systemd --user。它是单文件二进制，不需要 Node.js，平时安静地监听在 127.0.0.1:62588，只接受本机连接。4.1.2 之后它还全面隐藏启动，没有黑窗，关窗也不会把服务带崩。

第二层是 WPS 本体。服务常驻不代表 WPS 常驻，我的报错就出在这层：sidecar 活着，但 WPS 进程根本不存在。第三层是加载项：安装脚本把加载项放进 jsaddons 目录并写好 publish.xml，WPS 启动时自动加载，它才是真正能摸到文档的那个角色。第四层是桥接：46 个 MCP 文档工具的调用，最终都要经过加载项落到 WPS 文档上，前四层缺一环，工具就集体失联。第五层是健康检查：healthz 只看服务本身，wps_status 则是分层健康，服务、加载项、桥接逐层报告，排错时用它定位断在哪一层，比瞎猜快得多。链路通了之后，真正干活的是工具层的积木：document_meta 先拿字数、段数和分块建议，document_list_paragraphs 带锚点读段落，长文走 document_chunks 分页；写回侧 document_replace、document_add_comment、document_apply_ops 各司其职，批量写回单次上限 200 条操作。wps_launch 只负责把门打开，进门之后的路，是这四十六个工具铺出来的。

## wps_launch 就是补第二层的

冷启动场景下，Agent 的正确姿势是先 wps_status 探测，发现 WPS_AGENT_OFFLINE 就调 wps_launch 把 WPS 拉起来，加载项随 WPS 自动就位，然后才轮到 document_open 或 document_ensure_open 打开具体文档。这套顺序不需要你手工编排，把意图说清楚就行：

```
打开目录下这几份文档，交叉检查错别字与术语是否一致
```

Agent 会自己走完启动、打开、逐篇校对、汇总的链路。我周一那条任务最后就是这么跑通的：wps_launch 拉起 WPS，三份纪要交叉校对，术语不一致的地方全部钉了批注。

## 外部 Agent 怎么接上这条链

以 Claude Code 为例，一条命令注册：

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

Cursor 和 Codex CLI 同理，前者在项目级 .cursor/mcp.json 里按 mcpServers 写法填 URL，后者在 ~/.codex/config.toml 里加一段 mcp_servers 配置。都是 HTTP 型连接，无需 stdio、无需 Token，因为服务只听本机回环，信任边界就是这台机器本身。团队共享配置的话，把同样一段写进项目根的 .mcp.json，仓库一拉配置即生效，新同事不用手工注册。端口固定在 62588，固定有个好处：内部文档和培训材料永远写得一致，不会各机器各一套。这也意味着内网机器可以放心接：数据不出域，模型端点还可以指向内网的 Ollama 或 Xinference。

## 两个实战细节

第一个细节：自愈能力。以前 Spike 那类运行时组件掉线会连累整条链，4.1.2 修复了掉线自愈，偶发的桥接中断不用重启 WPS，等一下再调 wps_status 确认即可。另一个细节：远程场景需要代理转发或自定义端口时，设 CHAYUAN_MCP_PORT 环境变量即可，改完记得同步外部 Agent 里的服务地址。第二个细节：启动后别急着大活。冷启动后第一次调用建议先来个轻量的 document_meta，拿文档名、字数、段数和是否建议分块的判断，既验证链路通了，又为后续读法（整篇还是 document_chunks 分页）做好规划，超约 80k 的长文直接分块，省 Token 也省上下文。冷启动后的第一发校对建议用 dryRun 跑问题清单，链路、模型、文档一次验完，真出问题也能立刻知道断在哪一层。

## 边界与适用人群

这套链路适合每天要跟 WPS 文档打交道的行政、文书、编辑岗，也适合把 Claude Code、Cursor 当主力工具的开发者。要说明的是，wps_launch 解决的是"开机"这一环，干活质量仍取决于你配的模型和提示词；校对结果是辅助参考，定稿永远是人说了算。Agent 时代的新常识：让 AI 干活之前，先确认它会开你的"机"。
