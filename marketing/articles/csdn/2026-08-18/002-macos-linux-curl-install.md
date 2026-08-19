# 不止 Windows：macOS 和 Linux 一行 curl 把察元AI文档助手装进 WPS

上周组里一位用 MacBook 的同事看我演示「察元AI文档助手」在 WPS 里自动圈错别字，第一反应是：这玩意是不是只有 Windows 版？我理解这个误会——WPS 加载项的教程十篇有九篇教 PowerShell。但实际上 macOS 和 Linux 各有一行 curl，装起来反而更省事。

背景交代一句：察元AI文档助手是开源的 WPS 加载项加本机 MCP 服务（Apache-2.0，当前 4.1.2），让 AI 直接在 WPS 文档里读写、批注、改表格。现在 Cursor、Claude Code 这波 Agent 工具在 Mac 开发者里铺得很快，而 Mac 上跑 WPS 的人也不少，这篇就用清单的方式把安装、验证、接入 AI 工具三件事一次说清。

## 清单一：装之前确认三件事

1. WPS 是不是官方新版：加载项依赖 jsaddons 目录机制，太老的 WPS 版本没有这条路；
2. 网络能到 Gitee：安装脚本主源在 Gitee，下载包走 Gitee → aidooo → GitHub 三源回退，正常网络不用操心；
3. 不需要预装 Node.js、Python 或别的运行时：MCP 服务是 chayuan-mcp 单文件二进制，脚本下载完直接跑。

## 清单二：一行命令安装

macOS 和 Linux 通用，打开终端粘贴回车：

```bash
curl -fsSL https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.sh | bash -s -- --fetch
```

脚本四步闭环和 Windows 版一致：装加载项（jsaddons 目录加 publish.xml 注册，WPS 打开即加载）、装 MCP 服务并注册开机自启（macOS 走 LaunchAgent，Linux 走 systemd --user，都是用户级，不动系统全局配置）、跑四级体检、最后往 Claude Code、Cursor、Codex 里投放技能文件。

装完重启 WPS，看到加载项出现在功能区就算就位。想装指定版本，加 `-Version 4.1.2` 参数即可，排障时回退版本很有用。

## 清单三：两条验证

第一条，确认本机服务活着。浏览器或 curl 访问健康检查地址：

```bash
curl http://127.0.0.1:62588/healthz
```

返回 online 即正常。服务只监听 127.0.0.1，本机即信任边界，不需要 Token，也不需要 stdio 拉起子进程。

第二条，确认 AI 工具能连上。以 Claude Code 为例，一条命令注册：

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

Cursor 用户则在项目里建 `.cursor/mcp.json`，或设置界面 MCP → Add 手动加，写法相同：

```json
{"mcpServers":{"chayuan-wps-mcp":{"url":"http://127.0.0.1:62588/mcp"}}}
```

OpenAI Codex CLI 用户编辑 `~/.codex/config.toml`，加三行：

```toml
[mcp_servers.chayuan-wps-mcp]
url = "http://127.0.0.1:62588/mcp"
```

三个客户端填的都是同一个地址，这就是常驻 HTTP 服务的好处：一处安装，处处可用。连上之后 `wps_status` 一调，就能看到 WPS 侧的分层健康状态；想更直观，跑官方 Inspector（`npx @modelcontextprotocol/inspector`），传输类型选 Streamable HTTP 填地址，46 个工具的清单会直接列出来，逐个试调用都行。

## 清单四：Mac/Linux 特有的两个注意点

1. 自启方式差异：Windows 写注册表 HKCU\Run，macOS 是 LaunchAgent，Linux 是 systemd --user，脚本各走各的路。意味着你注销重登、重启电脑，服务都会自己回来，AI 工具随时能连，不用手动起服务；
2. 升级路径完全一样：重跑那行 curl 就是覆盖升级，旧配置保留。4.1.2 版修了 sidecar 弹黑窗和「运行 Spike」掉线自愈的问题，建议老用户都刷一遍；另外 4.1.1 起安装脚本的临时解压目录退出即清理，老版本每次安装会残留约 290MB，频繁升级的机器留意下磁盘占用。

## 接上之后干什么

连接打通只是管道，真正值钱的是那 46 个 MCP 文档工具：`document_chunks` 把长文分块读、`document_apply_ops` 一次批量写回不超过 200 条操作、12 个表格 action 里连口语化插行都支持。给个可直接复制的提示词感受一下：

```text
打开目录下这几份文档，交叉检查错别字与术语是否一致
```

多文档交叉校对这种事，人干一下午，Agent 几分钟跑完再让你复核批注。

表格活是另一个亮点，而且不需要记任何工具名，口语下指令就行：

```text
在"合计"行上面插入一行，列结构和上一行一致
```

Agent 会自己先用 header_read、column_read 读表头找锚点，再按显式坐标执行插行。十二个表格 action 覆盖切片读、行列插入、单元格合并、列宽调整、重复表头和导出，报季表、汇总表这种反复改结构的活基本一句话一轮。写回类操作默认只出预览，你确认之后才真正写盘，想反悔随时有退路。

最后说边界：它开源的是加载项和本机服务这条线（仓库在 GitHub 和 Gitee 同步发布，Apache-2.0 协议，也有网盘安装包渠道），校对和脱密预览的结果都是辅助参考，正式发文、定密还是人来定。Mac 和 Linux 用户没必要再看 Windows 专属教程了，一行 curl，三分钟装完，剩下的时间留给正事。
