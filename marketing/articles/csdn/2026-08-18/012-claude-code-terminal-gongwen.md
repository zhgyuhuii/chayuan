# Claude Code 不只写代码：一条命令把它接进 WPS 改公文

身边不少写代码的朋友，终端里 Claude Code 几乎常驻；但一转头处理标书、总结、通知这些 WPS 里的文档活，又得复制到聊天窗口，改完再贴回来。终端 AI 的这股热潮把代码生产力拉上去之后，文档场景反而成了最割裂的一块：AI 在终端里是干活利器，一到 WPS 就退化成了来回传话的工具。

问题的根子不在模型，在于 AI 摸不到你的文档。Claude Code 支持 MCP（Model Context Protocol），只要有一个能操作 WPS 的本机 MCP 服务，它就能直接读正文、写批注、改文字。察元AI文档助手（开源加载项，当前 4.1.2 版）就是这个角色：装在 WPS 文字里的智能加载项，附带一个本机 MCP 文档智能体服务。下面是完整接入步骤，亲测顺利的话十分钟以内。

## 第一步：安装加载项和本机服务

Windows PowerShell 一行命令（脚本自动处理了 PS 5.1 的 GBK/BOM 乱码问题）：

```powershell
& {[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$w=New-Object Net.WebClient;$w.Encoding=[Text.Encoding]::UTF8;$s=$w.DownloadString('https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.ps1');if($s.Length -and $s[0]-eq[char]0xFEFF){$s=$s.Substring(1)};& ([scriptblock]::Create($s)) -Fetch}
```

macOS / Linux 用 curl 那条，官网文档里有。脚本会做四件事：把加载项放进 jsaddons 目录（WPS 打开即加载）、装上 MCP 服务并注册开机自启（Windows 写 HKCU\Run，单文件二进制，不需要 Node.js）、跑一遍四级体检确认链路通、最后把技能文件投放到 Claude/Cursor/Codex 的配置目录。装加载项等于装技能，一个脚本三件事全到位。下载源是 Gitee、aidooo、GitHub 多源回退，全程 sha256 强校验，装的东西和发布的东西对得上。

## 第二步：把 MCP 注册进 Claude Code

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

服务地址固定在本机回环 127.0.0.1:62588，Streamable HTTP 传输，不需要 Token，不需要 stdio。不想敲命令的话，项目里放一份 .mcp.json 写同一个 URL 也行，团队共用更省事。

## 第三步：验证链路

浏览器打开 `http://127.0.0.1:62588/healthz`，返回 online 说明服务在，这个地址建议存成书签，排查时随手一点。然后打开 WPS、随便开一份文档，在 Claude Code 里问一句：当前打开的文档叫什么、多少字。它会调 document_meta 返回文档名、字数、段数。想验得更细，再让它列出前三个段落的锚点（document_list_paragraphs），锚点能正常返回，后面写批注、定位替换才有地基。

## 第四步：实战三条提示词

三条按流程阶段排：初稿校对、定稿复核、发布前扫描，基本覆盖一份公文的一生。

第一条，全文校对写成批注，适合初稿：

```
帮我检查文档中的错别字，用批注标出原文和建议改法
```

第二条，更稳妥的"先看后动"流程，适合定稿前的正式文档：

```
先跑一遍校对（dryRun），汇总问题列表，不要先改正文；我确认后再写成批注
```

第三条，对外发布前的敏感信息扫描：

```
查找疑似身份证号、手机号、银行卡号并批注
```

这里有个设计值得单独说一句：察元的写操作默认带保险。像 document_replace 这类直接改正文的工具，调用时没明确确认，它只返回 preview 预览而不写盘；写批注的 document_add_comment 则必须传 confirmed:true 才执行，否则返回 CONFIRMATION_REQUIRED。AI 建议归 AI，落不落盘由你拍板——终端里的自动化跑得再快，最后一脚刹车还在人脚下。

## 常见问题速查

WPS_AGENT_OFFLINE：Claude Code 连上了服务，但 WPS 或加载项那一段掉线，九成是 WPS 没开，重启 WPS 一般就好。DOCUMENT_TOO_LARGE：文档太大，别硬拉全文，让 AI 改用 document_chunks 分块读。MODEL_NOT_CONFIGURED：想跑内置校对引擎但没配模型，去加载项设置里把 Ollama 或云端端点配好再试。LICENSE_REQUIRED：免费额度用尽时会出现，不会弹购买窗打断你，按需处理即可。

## 适合谁用

已经把 Claude Code 用熟的开发者、技术写作、经常处理公文和标书的人。终端不换、习惯不变，多出一只能直接操纵 WPS 文档的手。举个完整的工作流：上午改完接口代码，中午让 Claude Code 打开 WPS 里的接口说明文档，跑一遍错别字加序号体例检查，下午评审前把批注过一遍——代码和文档的终检在同一个终端里完成，这个体验用上就回不去了。不碰终端的同事也不吃亏，WPS 界面里还有 29 个内置助手开箱即用。边界也要讲清楚：AI 校对是辅助参考，错别字、标点、体例这类机械问题它擅长；涉密定稿、法务把关这类要担责的事项，最终还得人来签字。

终端 AI 的能力边界正在从"写代码"往外扩，文档恰好是最值得先拿下的一块。一条命令的成本，换 AI 在 WPS 里直接干活，这笔账怎么算都划算。
