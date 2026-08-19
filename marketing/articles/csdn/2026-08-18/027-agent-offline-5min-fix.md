# WPS_AGENT_OFFLINE 五分钟自救：AI 连不上文档排查清单

晚上十点赶一份明早要报的材料，agent 第一句话就甩来一个 `WPS_AGENT_OFFLINE`，文档连不上，活干不了。这种时刻最忌讳病急乱投医——卸载重装、换模型、改提示词，一圈折腾半小时问题还在。这篇把我的排查顺序写成一页清单，照着走，五分钟内基本能定位。

## 先搞清这个错误码在说什么

`WPS_AGENT_OFFLINE` 的含义是：WPS 或者 WPS 里的察元加载项没连上本机的 sidecar 服务。注意，它和模型配置无关、和 API key 无关、和你用哪个智能体客户端也无关——断的是"WPS 到本机服务"这一段链路。搞清方向，才不会去改八竿子打不着的配置。顺便把几个容易混淆的错误码摆一起：`WPS_AGENT_OFFLINE` 是 WPS 没连上本机服务；`MODEL_NOT_CONFIGURED` 是校对模型没配；`DOCUMENT_TOO_LARGE` 是文档超了约 80k 阈值该分块；`LICENSE_REQUIRED` 是免费额度用尽，它不弹购买窗，看到别当成故障。四个码四个方向，认清再动手能省一半时间。

## 第一步：探 sidecar 活没活

一条命令的事：

```bash
curl http://127.0.0.1:62588/healthz
```

返回 `online`，说明 sidecar 活得好好的，问题在 WPS 侧，直接跳第三步。连接被拒或者超时，说明 sidecar 压根没起来，走第二步。Windows 上 PowerShell 里的 curl 有时是 Invoke-WebRequest 的别名，行为不一样，嫌麻烦就敲 curl.exe 全称，或者干脆把地址粘到浏览器地址栏，看到 online 字样就是通的。

## 第二步：sidecar 没起来的处理

先看自启项还在不在：Windows 查注册表 `HKCU\Run`，macOS 看 LaunchAgent，Linux 看 `systemd --user`。安装脚本装的时候会注册开机自启，正常情况下它应该一直在。

懒得逐项查就重跑一遍安装脚本，它自带四步体检：jsaddons 目录检查 → `/healthz` 探活 → initialize 握手 → 桥接工具验证，哪一步断的直接在输出里指出来，比人肉排查快得多。macOS 和 Linux 用户注意，服务分别由 LaunchAgent 和 systemd --user 托管，用对应机制看状态即可，思路一致。

## 第三步：sidecar 活着，查 WPS 侧

三件事按序确认：

1. WPS 开着没有？没开就先开，或者干脆让 agent 调 `wps_launch` 冷启动；
2. 加载项加载了没有？看 jsaddons 目录和 publish.xml 是否就位，WPS 里能不能看到察元的菜单；
3. 用 `wps_status` 做分层健康检查，链路断在哪一层它会直接告诉你，这比猜快十倍。另外回想一下最近有没有更新过版本：加载项文件落在 jsaddons 目录、靠 publish.xml 注册，更新后偶尔遇旧文件残留，WPS 重启一次通常就好。

顺带一提：4.1.2 版本之后 sidecar 是隐藏启动的，没有黑窗，关窗也不会杀服务。别再用"那个黑色命令行窗口还开着吗"判断服务死活，那个窗口已经不存在了。

## 第四步：查 MCP 客户端这一段

如果 WPS 侧都正常，个别智能体客户端还是连不上，重连一次：

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

配置文件党也可以直接在项目根放一份 `.mcp.json`，内容就是 `{"mcpServers":{"chayuan-wps-mcp":{"url":"http://127.0.0.1:62588/mcp"}}}`，提交进团队仓库，新人克隆下来开箱即用，省去逐台注册的口舌。

要可视化验证就用 MCP Inspector：`npx @modelcontextprotocol/inspector`，传输选 Streamable HTTP，地址填 `http://127.0.0.1:62588/mcp`，点 Connect 看握手。Inspector 里还能直接调 wps_status，WPS 侧断在哪一层，工具返回写得明明白白，比隔着客户端猜靠谱。

## 第五步：还不行，查环境

按命中率排序：杀毒软件拦了 sidecar（加白名单）；62588 端口被别的进程占了；机器刚从休眠唤醒，网络栈还没就绪（等半分钟重试）。这三样占了剩余案例的大头。还有一个偏门但真实的原因：同机装过多个版本的加载项目录，WPS 加载了旧版。重跑安装脚本会顺带把目录归位，比手动翻文件夹稳。

排查时记住一个原则：每改一处就验证一次，别攒了三处改动再测——变量一多，好不容易缩小到的范围又会被搅浑。

## 一句收尾

信创替换推进这两年，WPS 上的 AI 工具链也越来越长，链路长了一节，排查就多一层——但只要按"服务探活 → WPS 侧 → 客户端侧 → 环境"的顺序走，基本不会绕远路。把这篇存个书签，下次半夜报错时照单点菜，比深呼吸管用。
