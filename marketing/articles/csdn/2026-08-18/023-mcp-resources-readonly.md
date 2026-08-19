# chayuan:// 三个只读资源：MCP Resources 的正确打开方式

MCP 协议生态爆发之后，各家的接入教程清一色在讲 tools——46 个工具怎么调、confirm 怎么传。很少有人提 Resources。察元AI文档助手的本机服务除了工具，还挂了一组 `chayuan://` 只读资源，用顺手之后会发现：agent 的冷启动成本能砍掉一大截。这篇按清单盘点一遍。

## 资源一：chayuan://wps/health，状态探针

健康类资源。等价的命令行检查是：

```bash
curl http://127.0.0.1:62588/healthz
```

返回 `online` 即服务在线。区别在于：agent 在对话里读资源不产生副作用，也不占一次工具调用的决策位。我的习惯是让 agent 每次开工前先读这个资源，在线就继续，不在线直接报告，省得跑到一半才发现文档工具链没起来。要深查 WPS 侧状态，再上 `wps_status` 分层健康检查。两者的分工可以这样理解：health 资源回答"活着吗"，wps_status 回答"哪一层出了问题"。让 agent 养成先问便宜的、再问贵的的习惯，每次冷启动能省不少来回。

## 资源二：chayuan://assistants/manifest，助手目录总清单

察元的助手库里有数千个助手，`assistants_search` 负责检索，`assistants_list_domains` 离线可用。manifest 资源的价值在于冷启动：agent 先把目录清单读一遍，知道有哪些领域、哪些助手存在，再决定要不要发起检索。相当于新同事入职先领一本组织架构手册，而不是逮谁问谁。比如想找处理公文格式的助手，直接 `assistants_search` 检索是一种走法；先读 manifest 看领域划分、再按领域精准检索，是另一种走法。后者多花一次资源读取，换来的是检索词不再靠猜。对察元助手库不熟的新 agent，这本手册能少走很多弯路，`assistants_list_domains` 还能离线确认领域名，全程不依赖网络。

## 资源三：chayuan://assistants/{id} 与 domain/{domain}，助手详情与领域分组

单个助手的定义、提示词可以通过 `chayuan://assistants/{id}` 直接读，领域分组视图走 `chayuan://assistants/domain/{domain}`，和 `assistants_get` 导出助手定义是同一套底料。典型用法：检索命中一个助手后，先读它的详情确认是不是想要的，再决定拉不拉进工作流——省 token，也省来回试错。还有个隐藏用法：把成熟助手的提示词读出来，当自己团队 agent 的提示词底稿。数千个助手沉淀下来的写法，比从零闭门造车快得多——当然改完要自己验证效果，别指望抄来的提示词开箱即用。

## 怎么验证资源真的挂上了

用 MCP Inspector 一分钟搞定：

```bash
npx @modelcontextprotocol/inspector
```

启动后传输类型选 Streamable HTTP，地址填 `http://127.0.0.1:62588/mcp`，点 Connect，在 Resources 面板就能看到 `chayuan://` 开头的条目，点开能直接预览内容。接入 Claude Code 的话一行命令注册：

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

用 OpenAI Codex CLI 的同学，编辑 `~/.codex/config.toml` 加两行：

```toml
[mcp_servers.chayuan-wps-mcp]
url = "http://127.0.0.1:62588/mcp"
```

Cursor 则是项目级 `.cursor/mcp.json`，写法与 `.mcp.json` 一致。各家客户端对 Resources 面板的支持程度不一样，拿 Inspector 当参照最稳。

## 两条常见误用

一是把资源当工具使——资源读出来的是状态和目录，不会触发任何动作，指望读一下 health 就把 WPS 拉起来是不可能的，那是 `wps_launch` 的活。二是忘了只读属性，试图让 agent 去"更新"资源——Resources 在协议层面就不支持写，别在提示词里让它白费劲。分清"看地图"和"开车"，agent 的动作序列会干净很多。

## 只读这两个字为什么重要

写操作有 confirmed 闸门管着，资源则是天生只读——读一万遍也不会改文档一个字。这意味着你可以放心把整个资源树暴露给外部智能体：agent 瞎读顶多浪费几轮上下文，绝不会读出事故。给团队写内部 agent 时，我会把"先读 manifest 再干活"写进系统提示词，这比让每个 agent 自己摸索友好太多。

适用人群：给团队搭 MCP 工作流的开发者、Claude Code 和 Cursor 的重度用户。边界也要说清：资源层管的是状态和目录，真正改文档、跑校对还得靠工具调用，resources 是地图，不是车。把地图当地图用，行程自然顺。
