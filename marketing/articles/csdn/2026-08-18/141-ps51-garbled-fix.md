# PowerShell 5.1 乱码坑：iwr 管道 iex 为什么不行

## 事故现场：一行流在老机器上炸了

上周帮隔壁科室装察元AI文档助手。对方机器是单位统一镜像的 Windows 10，只带 Windows PowerShell 5.1。我图省事，把在自己机器上跑熟的下载方式换成了网上流传的一行流：

```powershell
iwr -useb https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.ps1 | iex
```

我自己的机器装了 PowerShell 7，这条命令毫无问题。可在 5.1 上，回车之后满屏乱码加一片红色 ParseError，中文注释全成了"锟斤拷"，脚本第一行就解析失败，加载项和 MCP 服务一样都没装上。这篇就把这次排错拆开讲清楚，顺便说说为什么官方安装命令要长成那副"啰嗦"的样子。

## 根因一：iwr 在 5.1 里默认按 GBK 解码

Invoke-WebRequest 在 PowerShell 5.1 里，遇到响应头没有显式声明 charset 的文本，会按系统本地代码页解码字节流。简体中文系统的本地代码页是 GBK，而安装脚本是 UTF-8 编码保存的，两套编码对不上，中文注释和提示立刻变乱码。PowerShell 7 修正了这个行为，默认按 UTF-8 处理，所以我机器上没事，科室机器上炸了。同一个命令，两个版本，两种命运，这是第一层坑。

## 根因二：UTF-8 的 BOM 被硬解成一个非法字符

更隐蔽的是 BOM。脚本文件开头带 UTF-8 BOM，也就是三个字节 EF BB BF。正确的解码器会把它识别为编码标记然后剥掉；但按 GBK 硬解时，这三个字节被拼成一个乱码字符，留在脚本第一个位置。解析器在第一行行首遇到这个非法字符，直接抛解析错误，后面内容再正确也轮不到执行。这也是"我看着脚本没几个中文，怎么还是乱码"的答案：只要带 BOM，5.1 加 iwr 这条路基本走不通。

## 根因三：iex 执行的 scriptblock 里没有 $PSScriptRoot

第三层坑跟编码无关。iex 拿到的是一段脱离了文件上下文的 scriptblock，脚本内部引用的 $PSScriptRoot 是空的。安装脚本要在自身所在目录解包资源、写日志，路径逻辑依赖 $PSScriptRoot 展开，一旦为空，相对路径整体失效。就算侥幸绕过编码问题，脚本也会在半路以一个莫名其妙的原因挂掉。

## 正确姿势：显式 UTF-8、去 BOM、手工建 scriptblock

察元官方给的 Windows 安装命令，把三层坑一次性处理掉了：

```powershell
& {[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$w=New-Object Net.WebClient;$w.Encoding=[Text.Encoding]::UTF8;$s=$w.DownloadString('https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.ps1');if($s.Length -and $s[0]-eq[char]0xFEFF){$s=$s.Substring(1)};& ([scriptblock]::Create($s)) -Fetch}
```

拆开看四步：第一句强制 TLS 1.2，因为 5.1 默认不开，老系统访问 HTTPS 会先死在握手；然后用 WebClient 下载并把 Encoding 显式设为 UTF-8，绕开 iwr 的本地代码页默认；接着判断首字符是不是 U+FEFF，是就 Substring 去掉 BOM；最后用 [scriptblock]::Create 包一层再调用，带上 -Fetch 参数。脚本本身走四步闭环：装加载项到 jsaddons 目录并写 publish.xml、部署 chayuan-mcp 单文件二进制并注册开机自启（写入 HKCU\Run）、做四级体检、把技能文件投放给 Claude、Cursor、Codex，全程无需 Node.js。

## 怎么确认自己踩的是哪个坑

排查只要两步：先跑 $PSVersionTable，PSVersion 一栏低于 6 就是 5.1 血统；再把脚本下载下来看文件头，前三个字节是 EF BB BF 的就带 BOM。两个条件凑齐，iwr 管道 iex 必炸。顺带一提，macOS 和 Linux 用户没有这个烦恼，curl 管道 bash 不经过 PowerShell 的解码环节，字节流原样进 shell：

```bash
curl -fsSL https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.sh | bash -s -- --fetch
```

## 装完怎么验证

装完别急着用，先打健康检查：

```
curl http://127.0.0.1:62588/healthz
```

返回 online 说明本机 MCP 服务就绪，而且它只监听 127.0.0.1，不对外暴露。再记两笔版本账：4.1.1 修掉了 -Fetch 临时解压目录退出不清理的问题，此前每次安装会残留约 290MB；4.1.2 让 sidecar 全面隐藏启动，安装运行不再弹黑窗，"运行 Spike"掉线也能自愈。给同事装机前把这些讲清楚，能省掉不少"这不会是病毒吧"的灵魂拷问。不确定自己 PowerShell 版本的，先跑 $PSVersionTable 看 PSVersion：7 以上随意，5.1 请老老实实用上面那条长命令。一行流不是不能写，是得知道它在哪一层会断。

## 谁需要关心这个坑

三类人重点记：单位信息科批量装机的同事，镜像越老越容易撞上 5.1；给自己那台常年不重装的旧笔记本装机的个人；以及跨平台团队里负责 Windows 侧的成员。参数上再备忘两条：-SkillOnly 只投放技能文件、不动加载项和服务，适合给 Claude、Cursor、Codex 单独补技能；-Version 4.1.2 指定版本安装，回滚也靠它。官方把编码坑包在命令里处理好了，普通用户不必懂原理；但负责排错的你，知道这口锅在哪，比陪着反复重装省出一个小时。
