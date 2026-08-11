# 察元 WPS MCP 错误码与排错手册

自动审查链路涉及 WPS 加载项、本机 MCP sidecar、校对模型、外部客户端四层。报错时先看错误码，再决定重启哪一层，比「把四个客户端都重装一遍」快。本文面向察元 AI 文档助手 v4.0，端点仍是：

```
http://127.0.0.1:62588/mcp
```

健康检查：`GET http://127.0.0.1:62588/healthz`（期望 `online`）。服务名：`chayuan-wps-mcp`。Claude Code、Codex、OpenClaw、Hermes 共用该 URL，因而同一错误码的修法也共用。

关联阅读：内网 Ollama 见 [./11-offline-ollama-intranet-review.md](./11-offline-ollama-intranet-review.md)；四客户端配置见 [./12-claude-codex-openclaw-hermes.md](./12-claude-codex-openclaw-hermes.md)；确认与端口安全见 [./14-confirm-security-localhost.md](./14-confirm-security-localhost.md)。连接说明见 [docs/mcp-connection.md](https://github.com/zhgyuhuii/chayuan/blob/main/docs/mcp-connection.md)；可用 [MCP Inspector](https://github.com/modelcontextprotocol/inspector) 做旁路验证。

![错误码到处理层的对照墙](images/csdn-15-error-map.png)

## 排错总流程（先跑这一遍）

### 四级快速验证

1. 浏览器打开 healthz：是否 `online`。  
2. WPS 是否打开、察元入口是否可见、目标稿是否为活动文档。  
3. 察元设置中模型是否已选对话模型；加载项内检查是否能出结果。  
4. 客户端是否指向 `http://127.0.0.1:62588/mcp`，传输为 HTTP / Streamable HTTP。  

任一级失败，先修这一级，再复现业务提示词。不要在 healthz 失败时分析提示词写得是否优雅。

### 复现信息最少集

向同事或工单提交时带上：

- 错误码原文（如 `WPS_AGENT_OFFLINE`）。  
- 客户端名称与版本。  
- healthz 结果。  
- 是否已确认写回、是否长文、是否表格定位。  
- 模型供应商类型（云端 / Ollama）。  

缺错误码只描述「卡住了」，基本无法远程判断。

![四级验证勾选表与 healthz 截图位](images/csdn-15-four-level-check.png)

## WPS_AGENT_OFFLINE

### 含义

本机 MCP 收得到请求，但与 WPS 内 Agent 的通道不可用：常见于未打开 WPS、加载项未加载、Agent 未注册成功。

### 典型现象

- 客户端连接成功或半成功，一调文档工具就失败。  
- Inspector 能连上，调用打开/读取报离线。  
- 刚装完包从未启动过 WPS。  

### 处理步骤

1. 启动 WPS 文字，打开任意文档。  
2. 确认察元加载项已启用且界面可见。  
3. 再访 healthz；到察元 → MCP 服务刷新或启动。  
4. 用只读冒烟：「读取当前文档标题，不要修改。」  
5. 仍失败：查 62588 是否被其他进程占用、是否连错主机 IP、防火墙是否拦截本机回环（少见）。  

### 不应做的事

- 到 Ollama 里重装模型（与 Agent 离线无关）。  
- 把 `confirmed` 改成 true（离线不是确认问题）。  
- 在未开 WPS 时反复重装四个客户端。  

![WPS 已打开且加载项可见时的状态对照](images/csdn-15-agent-online.png)

## MODEL_NOT_CONFIGURED

### 含义

文档通道可用，但校对/需要模型的工具找不到可用的对话模型配置。

### 典型现象

- 能读取段落。  
- 一跑 proofread / 拼写语法检查类能力就失败，带 `MODEL_NOT_CONFIGURED`。  
- 换 Claude Code 为 OpenClaw 后现象不变。  

### 处理步骤

1. 打开察元设置 → 模型与供应商。  
2. 启用至少一家供应商；填好基础 URL 与密钥（若需要）。  
3. 选定默认对话模型；类型为对话，而非纯嵌入。  
4. 在加载项内对测试稿跑「拼写与语法检查」，不经过外部客户端。  
5. 成功后再让 Agent 调校对。内网 Ollama 步骤见第 11 篇。  

### 验证口令

```text
先 dryRun 校对当前文档前几段，只预览问题列表。
```

若加载项内成功、仅 Agent 失败，再查客户端是否指到正确 MCP、是否调用了错误工具名；多数情况两端会一起失败或一起成功。

![模型设置页已选中对话模型（密钥打码）](images/csdn-15-model-configured.png)

## CONFIRMATION_REQUIRED

### 含义

调用了会变更文档的路径，但未传 `confirmed=true`（或非 dryRun 写回缺少确认）。这是门闩，不是随机故障。

### 典型现象

- 预览成功，写批注失败。  
- 用户以为「我说了请修改」等于确认，但客户端未带确认参数。  
- 脱密 apply 缺少 confirmed 或密码（密码问题见下节与第 14 篇）。  

### 处理步骤

1. 取出预览列表给人看。  
2. 用户明确：「确认写批注」或「确认替换第 x 条」。  
3. 客户端重试，参数含 `confirmed=true`。  
4. 将确认规则写入开场白，减少反复踩坑。  

### 与安全策略的关系

不要用「全局自动确认」绕过。无人值守批量改合同条款的风险，高于多打一句确认。详见 [./14-confirm-security-localhost.md](./14-confirm-security-localhost.md)。

![返回 CONFIRMATION_REQUIRED 后用户补充确认的对话](images/csdn-15-confirmation-required.png)

## DOCUMENT_TOO_LARGE

### 含义

一次性读取或处理的文档内容过大；服务拒绝（除非显式 force，且不鼓励）。长文应分块。

### 典型现象

- 全文校对或全文读取失败，错误码 `DOCUMENT_TOO_LARGE`。  
- 短测试稿正常，正式稿失败。  

### 处理步骤

1. 改用分块/按段落读取工具或策略，而不是强行 force。  
2. 提示词写明：「按块检查，合并去重输出，不要一次拉全文。」  
3. 按章节拆任务：先审正文，再审附件。  
4. 写回仍按条确认，避免一大坨替换。  

### 提示词示例

```text
文档较长。请分块读取并检查错别字与标点，每块结束后再读下一块，最后给合并列表。不要一次读取全文。不要写批注，等我确认。
```

![分块读取避免 DOCUMENT_TOO_LARGE 的流程图](images/csdn-15-document-too-large.png)

## LOCATE_NOT_FOUND 与 LOCATE_MISMATCH

### 含义

- `LOCATE_NOT_FOUND`：按给定原文/位置找不到目标。  
- `LOCATE_MISMATCH`：定位结果与提供的 `originalText` 不一致，拒绝替换，防止改错地方。  

### 典型现象

- 预览列表里有某条，写批注或替换时失败。  
- 人工已改过正文，智能体仍拿旧片段定位。  
- 表格单元格文本含不可见字符或换行差异。  

### 处理步骤

1. 重新读取目标段落或单元格的当前文本。  
2. 用新鲜的 `originalText`（必要时加 start/end）再预览。  
3. 预览匹配后再 `confirmed=true` 写回。  
4. 多段落编辑时，按从后往前应用，降低偏移错位。  
5. 仍失败：缩小锚点到更短且唯一的子串，避免整段复制时夹带已变化的句子。  

### 不应做的事

- 关掉确认强行写。  
- 在原文未验证时用空 originalText 赌位置。  
- 同一失败参数连打数十次。  

![定位失败后重新读取单元格再批注成功](images/csdn-15-locate-retry.png)

## 脱密相关失败（确认与密码）

### 现象

脱密 apply/restore 失败，可能伴随 `CONFIRMATION_REQUIRED`，或提示需要密码/参数不完整。

### 处理

1. 先 preview，确认关键词列表。  
2. 用户提供密码，并明示确认。  
3. apply 带 `confirmed=true`、`password`、`keywords`。  
4. restore 带确认与密码。  
5. 密码错误则失败；不要让模型尝试多个密码。  

安全背景见第 14 篇。公文合同若只需标注敏感信息，用批注初筛即可。

## 客户端连不上（尚无业务错误码）

### 检查顺序

1. healthz 是否通。不通：启 WPS/MCP 服务，查端口。  
2. URL 是否精确到 `http://127.0.0.1:62588/mcp`（协议、主机、端口、路径）。  
3. 传输是否误选 stdio。  
4. 是否误加 Token 导致客户端行为异常。  
5. 用 Inspector 验证：`npx @modelcontextprotocol/inspector`。  
6. Claude Code 参考 [官方 MCP 文档](https://code.claude.com/docs/en/mcp) 检查 `--transport http` 注册是否成功。  

四个客户端应得到同一结论：本机通则都应通，本机不通则都不必改提示词。

![Inspector 连接失败与成功两种界面对比](images/csdn-15-inspector-connect.png)

## 综合场景：从报错到恢复的一条时间线

1. 用户在 OpenClaw 下「审合同并写批注」。  
2. 首呼失败 `WPS_AGENT_OFFLINE` → 打开 WPS 与稿件 → healthz online。  
3. 再呼失败 `MODEL_NOT_CONFIGURED` → 察元配置 Ollama 对话模型 → 加载项内检查通过。  
4. dryRun 成功；写批注失败 `CONFIRMATION_REQUIRED` → 用户回复确认写批注。  
5. 其中一条表格替换失败 `LOCATE_MISMATCH` → 重读单元格 → 再确认替换该条。  
6. 附件很长触发 `DOCUMENT_TOO_LARGE` → 改分块提示词 → 合并列表 → 再确认批注。  

把这条时间线贴进内部 Wiki，新人按码对号入座即可。场景提示词见 [./13-official-doc-contract-scenarios.md](./13-official-doc-contract-scenarios.md)。

![从离线到写回成功的完整时间线示意图](images/csdn-15-timeline-recovery.png)

## 错误码速查表

| 错误码 | 先查哪一层 | 立即动作 |
| --- | --- | --- |
| WPS_AGENT_OFFLINE | WPS / 加载项 / Agent | 打开 WPS，刷新 MCP，只读冒烟 |
| MODEL_NOT_CONFIGURED | 察元模型设置 | 配对话模型，加载项内先测 |
| CONFIRMATION_REQUIRED | 人机确认 | 明示确认，带 confirmed=true |
| DOCUMENT_TOO_LARGE | 读取策略 | 分块，避免盲目 force |
| LOCATE_NOT_FOUND | 定位参数 | 重读原文，更新 originalText |
| LOCATE_MISMATCH | 定位校验 | 禁止盲替换，预览匹配后再写 |

## 仍无法解决时

1. 记录错误码、工具名、是否 confirmed、文档大致体量。  
2. 用 Inspector 排除客户端特有 bug。  
3. 确认版本为 v4.0 且端口仍为 62588。  
4. 查阅仓库 README 与 [docs/mcp-connection.md](https://github.com/zhgyuhuii/chayuan/blob/main/docs/mcp-connection.md)。  
5. 通过项目发布渠道或官网 [aidooo.com](https://aidooo.com) 反馈时附带上述最少集。  

## 工单模板（可复制）

```text
【环境】
- 察元版本：v4.0.x
- 系统：Windows / macOS / Linux
- 客户端：Claude Code / Codex / OpenClaw / Hermes / 其他
- MCP URL：http://127.0.0.1:62588/mcp

【验收】
- healthz：online / 失败（附响应）
- 加载项可见：是 / 否
- 加载项内检查：成功 / 失败
- 模型：云端供应商名或 Ollama 模型名

【问题】
- 错误码：
- 工具或操作：只读 / 预览 / 写批注 / 替换 / 脱密
- 是否已确认 confirmed：是 / 否
- 文档大致字数：
- 是否表格定位：是 / 否

【已尝试】
- 
【期望】
- 
```

工单缺错误码时，支持人员有权要求补齐后再查，否则只能猜。

## 分层日志怎么看（实务向）

### 客户端侧

会话里是否打印了工具名与错误码。把原始码留下，不要只截「出错了」对话框。

### MCP / healthz

浏览器访问 healthz 是最快的旁路。Inspector 列出工具失败时，问题多半在 URL 或服务未起，而不是提示词。

### WPS / 加载项

加载项看不见时，先修加载项，不要改模型。Agent 离线时，任何高级提示词都无效。

### 模型侧

只有进入校对、需要补全的路径才查模型。读标题失败却去重装 Ollama，属于层号搞错。

![四层日志对照：客户端、MCP、WPS、模型](images/csdn-15-log-layers.png)

## 回归用例清单（升级后必做）

1. healthz 返回 online。  
2. 只读标题成功。  
3. dryRun 校对成功（模型已配）。  
4. 未确认写批注 → `CONFIRMATION_REQUIRED`。  
5. 确认写批注成功，锚点抽查两条。  
6. 人为制造过短错误 originalText → 出现 `LOCATE_*` 或预览不匹配，且未误改正文。  
7. 长文分块提示下不再出现未处理的 `DOCUMENT_TOO_LARGE`（或按预期提示改策略）。  
8. 脱密 preview 可用；无密码 apply 失败。  

全部打勾再发给业务用户。任一条失败，按本文对应章节修，不要跳级发版。

## 易混现象对照

### 「工具列表为空」对「工具调用报离线」

列表为空：多半是客户端 URL/传输配错，或连到了错误端口。调用报 `WPS_AGENT_OFFLINE`：MCP 往往已通，缺的是 WPS Agent。两者修法不同，不能都用「重装客户端」解决。

### 「预览很慢」对「预览失败」

慢：常见于本地小模型或长文分块多，属于性能与预期管理。失败并带错误码：按码处理。不要把慢当成离线，也不要把离线当成模型太慢。

### 「批注没出现」对「批注钉错位置」

没出现：查是否未确认、是否写错活动文档、是否工具报错被客户端吞掉。钉错位置：属 `LOCATE_*` 或锚点策略问题，重读原文、缩小锚点，而不是再点一次「全部确认」。

### 「这个客户端不行」对「所有客户端不行」

只换客户端做一次只读冒烟，就能区分。四人都失败，先修本机；仅一人失败，查那人的配置漂移。

把上述对照贴在支持群公告，可减少重复截图问询。

支持人员接到语音描述时，先要求对方打出错误码四个字以上的英文片段，再开始远程。没有码就先做四级快速验证并截图 healthz。远程桌面操作顺序建议固定为：看 healthz → 看活动文档标题 → 看模型设置 → 看客户端 URL → 再复现一条只读指令。顺序打乱最容易误判成「模型坏了」或「客户端坏了」。复现成功或失败都留下同一套截图，方便下一班支持人员接着看，而不必让用户再描述一遍。若用户无法提供截图，至少让其手打 healthz 返回原文与错误码字符串，禁止用口语谐音代替英文码。英文码大小写按原文记录，便于在历史工单里全文检索归类。

## 小结

排错顺序永远是：healthz 与 Agent → 模型 → 确认门闩 → 分块与定位。错误码是层号，不是玄学。Claude Code、Codex、OpenClaw、Hermes 共用一个 HTTP MCP URL，因此手册也只需要这一份。把速查表与工单模板放到桌面，比把「重启试试」写进制度更有用。升级后按回归清单走一遍，能消灭大部分「以前好好的现在不行了」类问题。
