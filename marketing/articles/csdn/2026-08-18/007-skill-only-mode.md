# 只想给 Claude Code 投技能、不动 WPS：察元AI文档助手 -SkillOnly 用法

后台被问得最多的一个问题是：我机器上已经跑着「察元AI文档助手」的服务了，现在换了台新机器做实验，只想给 Claude Code 投一套 WPS 技能，不想再往 WPS 里装加载项、不想多一个常驻服务，行不行？行，`-SkillOnly` 参数就是为这个场景准备的。这篇用问答的形式把常见疑问一次答完。

## 问一：SkillOnly 具体做什么、不做什么？

安装脚本默认是"三合一"：装 WPS 加载项、装 MCP 服务并自启、投放技能文件。加 `-SkillOnly` 之后，脚本只做第三件事——把技能文件投放到 Claude Code、Cursor、Codex 这些工具的技能目录里，加载项目录和常驻服务一概不碰。适合的机器形态很明确：服务端已经就位（比如团队里共用一台已经装好的机器做验证），或者你只是想先看看这套技能长什么样。

有一点要想清楚：技能文件是给 Agent 的说明书，真正干活的还是本机 62588 端口上的 MCP 服务和 WPS 里的加载项。`-SkillOnly` 装出来的机器如果服务端不在，Agent 调工具那一步自然连不上，这不算故障，属于设计内的边界。

## 问二：命令怎么写？

Windows PowerShell：

```powershell
& {[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$w=New-Object Net.WebClient;$w.Encoding=[Text.Encoding]::UTF8;$s=$w.DownloadString('https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.ps1');if($s.Length -and $s[0]-eq[char]0xFEFF){$s=$s.Substring(1)};& ([scriptblock]::Create($s)) -SkillOnly}
```

macOS 和 Linux 把 curl 那行的参数换成 `--skill-only` 对应即可，逻辑相同。想锁版本再叠加 `-Version 4.1.2`。

## 问三：装完怎么确认技能生效？

打开 Claude Code 看技能列表里有没有察元的相关条目，然后先验证服务链路。如果这台机器本来就有服务（比如你就是给已有环境补技能），一条命令确认服务活着：

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
curl http://127.0.0.1:62588/healthz
```

第一条把 MCP 端点注册给 Claude Code，第二条确认服务返回 online。两步都过，就可以直接下任务了，比如这句拿去就能用：

```text
帮我检查文档中的错别字，用批注标出原文和建议改法
```

Agent 会按技能里的流程走：先 dryRun 出问题清单，你确认后再用 `proofread_apply_comments` 把批注钉到原文，表格里的错字也能定位到具体单元格。表格场景同样口语化，比如"在'合计'行上面插入一行，列结构和上一行一致"，Agent 会先用 header_read、column_read 读表头找锚点，工具只按显式坐标执行，不自由发挥。

## 问四：装完 SkillOnly 后悔了，想要完整版怎么办？

不用卸载，直接把完整安装那行命令原样重跑一遍（就是带 `-Fetch` 的那行），脚本会把缺的加载项和服务补齐，已投放的技能文件会更新，原有配置不动。这也是察元安装设计比较省心的地方：各种参数形态之间可以随意切换，重跑即收敛，没有迁移心智负担。

## 问五：什么人适合长期停留在 SkillOnly 状态？

主要是两类：一类是重度 Claude Code / Cursor 用户，自己的主力工作流在终端和编辑器里，WPS 只是偶发被 Agent 操作的对象；另一类是做测试和评测的人，需要快速在干净环境里验证这套 46 个 MCP 文档工具的能力边界，不想每次都装全套。其他人我建议还是跑完整安装——二十九个内置助手在 WPS 里不依赖外部 Agent 就能用，摘要、翻译、术语统一、公文风格改写这些日常活，打开 WPS 就是现成的。

## 问六：有边界要注意吗？

有，而且一直有：技能让 Agent 会用工具，不保证产出直接可发布。错别字和术语建议仍要人工复核，涉密内容走脱密预览也只在确认后才落盘，定稿责任始终在人。把 Agent 当成一个不知疲倦的一审，人是终审，这个分工用起来最顺。

## 追问：和手动拷贝技能文件比，差在哪？

三条。第一，版本一致性：脚本投放的技能文件与当前服务版本配套，手动拷来的旧文件碰上新版工具行为可能指挥失灵；第二，覆盖面：脚本会一次性处理 Claude Code、Cursor、Codex 多个目标，手动拷贝最容易漏掉某一个；第三，可重复：重跑一遍就是更新，写进团队装机文档就是一条命令的事，不用维护一堆路径说明。把容易出错的分发交给脚本，人只负责做决定，这个分工才是工具该有的样子。

`-SkillOnly` 是个小参数，但它代表的态度是分层的：想要全家桶还是单点能力，用户自己说了算。
