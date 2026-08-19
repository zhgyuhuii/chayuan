# 察元AI文档助手：一行命令把 Claude Code 接进 WPS，行政岗十分钟搞定

以前想在 WPS 里用 AI 智能体，门槛是真的高。装加载项、懂 MCP、配端口，错一步就是一堆报错。办公室里最需要这能力的是写材料的人，偏偏他们最没时间折腾。

现在这套东西被察元AI文档助手压成了一条命令，我把完整路径写下来。

下载安装。Windows 打开 PowerShell，把官网文档里这行命令粘进去回车：

& {[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$w=New-Object Net.WebClient;$w.Encoding=[Text.Encoding]::UTF8;$s=$w.DownloadString('https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.ps1');if($s.Length -and $s[0]-eq[char]0xFEFF){$s=$s.Substring(1)};& ([scriptblock]::Create($s)) -Fetch}

脚本自己下载安装包，装加载项、注册开机自启，最后跑一遍四级检查才收工。不愿用命令的，官网 aidooo.com 直接下安装器双击装，效果一样。

配置。装完在终端执行 claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp。回车之后智能体多了四十多个文档工具。

验证。浏览器访问 http://127.0.0.1:62588/healthz，有返回就是通了。安装脚本的自检也会自动跑这一步。

测试。对智能体说：读一下当前文档的标题和总段落数。答对了就开干。

使用。WPS 打开材料，直接说人话，比如帮我把这份材料的错别字列出来挂成批注。它会自己读文档、自己定位、意见挂边上，正文一个字不会被偷偷改。

常用提示词给三条。
一、把当前文档校对一遍，错别字和序号问题都列出来，先预览清单。
二、把文中术语的不同写法统一，替换前先给我确认。
三、读当前文档第三段，告诉我它在讲什么。

全程本机回环地址，正文不出电脑，这一点机关单位可以放心。今天刚发的 4.1.2 版本连服务启动都不弹窗了，装完安安静静在后台待命，更没理由不试。
