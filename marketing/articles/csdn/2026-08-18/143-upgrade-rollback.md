# 覆盖升级与回滚：旧配置不动的升级姿势

单位信创改造后全员换 WPS，察元AI文档助手在我部门跑了两个季度，从 4.1.0 一路升到 4.1.2。这篇把升级和回滚的姿势完整写一遍：核心结论就一句——升级就是重跑一遍一行安装命令，覆盖升级，旧配置不动。但围绕这句话，有几个细节值得展开。

## 第一步：升级前看清楚两件事

第一件，确认当前版本。版本号在加载项里能看，不确定就让 Agent 调 wps_status，分层健康信息里带出来。第二件，想明白"旧配置不动"的范围：覆盖升级动的是加载项文件和 chayuan-mcp 服务二进制，你已经配好的模型端点、自定义助手这些用户配置不在覆盖范围里，所以不用担心升级把 Ollama 地址或者精心调过的助手冲掉。这一点对内网环境特别重要，配置一次不容易，没人想每次升级都重配一遍。

下载链路也省心：Gitee、aidooo、GitHub 多源自动回退，国内网络环境优先走 Gitee，全程 sha256 强校验，下载完整性不用你自己操心。

## 先弄懂双向自启：为什么装一次就够

安装脚本三件事一次办完：装技能等于装加载项，装加载项等于带技能。也就是说，给 Claude Code 投放技能文件的同时，WPS 侧加载项和本机 MCP 服务一并就位；反过来重装加载项，技能文件也会补齐。这个双向自启设计是升级姿势能如此简单的根子——你不需要分别维护 WPS 侧和 Agent 侧两套安装逻辑，一条命令永远是全量闭环。

## 第二步：重跑安装命令

Windows 上还是那条长命令（它顺带处理了 PowerShell 5.1 的 GBK 与 BOM 乱码问题）：

```powershell
& {[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$w=New-Object Net.WebClient;$w.Encoding=[Text.Encoding]::UTF8;$s=$w.DownloadString('https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.ps1');if($s.Length -and $s[0]-eq[char]0xFEFF){$s=$s.Substring(1)};& ([scriptblock]::Create($s)) -Fetch}
```

macOS 和 Linux 用 curl：

```bash
curl -fsSL https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.sh | bash -s -- --fetch
```

两个参数值得记住：`-Version 4.1.2` 指定版本安装，`-SkillOnly` 只投放技能文件、不动加载项和服务，适合只给 Claude、Cursor、Codex 补技能文件的场景。默认不带参数就是完整覆盖升级。

## 第三步：等四级体检跑完

脚本自带四步闭环：装加载项（jsaddons 目录加 publish.xml，WPS 打开即加载）、MCP 自启（单文件二进制，Win 写 HKCU\Run，macOS 走 LaunchAgent，Linux 走 systemd --user，无需 Node.js）、四级体检（jsaddons 检查、healthz、initialize 握手、桥接工具验证）、最后把技能投放给各外部 Agent。升级时盯着体检输出，四级全绿基本就稳了。

## 第四步：验证 MCP 链路

老规矩，健康检查先打一发，返回 online 即可：

```
curl http://127.0.0.1:62588/healthz
```

外部 Agent 这边一般不用动配置，因为服务地址没变：Claude Code 当初用 `claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp` 注册过，升级后照用。如果工具列表有异常，再用 MCP Inspector 连一次验证。

## 回滚：同一把钥匙反着拧

回滚不是卸载重装，而是用 -Version 指定旧版本号，把同一条安装命令再跑一遍。比如新版用着不放心，装回上一个版本即可，同样只覆盖程序文件，配置照旧不动。实操建议：回滚前先记下当前版本号，回滚后照例跑一遍四级体检和 healthz，看到 online、工具能枚举，再继续干活。"配置不动"给了你反复横跳的底气，但每次变更后都值得花三十秒做一次回归。这套"升级即重跑、回滚即换版本号"的设计，本质上是把版本管理压缩成了一行命令，运维心智负担很低。

## 两个版本的小账，升级理由清单

4.1.1 修复了 -Fetch 临时解压目录退出不清理的问题，此前每次安装残留约 290MB，频繁升级的机器能省出不少磁盘；4.1.2 让 sidecar 全面隐藏启动，黑窗不再出现、关窗不断服务，"运行 Spike"掉线自愈。就冲"同事不再被黑窗吓到"这一条，4.1.2 也值得升。建议节奏：稳定优先的部门跟在最新版后一个版本，激进尝鲜的除外；升级前后各跑一次真实文档的校对任务做回归，确认无误再全员推。适用场景对号入座：个人机器随手升，跟最新版走；部门批量装机由信息科统一开版本窗口，把 -Version 参数钉进装机文档，避免各机器版本漂移；内网环境优先走 Gitee 源，sha256 校验失败就停下来查网络，不要绕过校验重试。升级不可怕，怕的是没有回滚路径——现在你有了，还是一行的。
