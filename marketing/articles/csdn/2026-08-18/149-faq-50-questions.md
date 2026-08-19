# 用了半年察元：被同事问最多的十个问题

察元AI文档助手在我这台机器上跑了半年，从看客变成部门"人肉接口人"，被问的问题重复率极高。挑十个最高频的整理成问答，答案都是我实际踩过验证过的，不是手册复读。排错密度最高的那两周，我几乎每天都要口头重复其中三条，干脆整理成文。AI Agent 办公落地这一年，这些问题大概每个单位都会遇到一遍。

## 一、它和 WPS AI 是什么关系？

察元是独立第三方加载项，WPS AI 是金山办公内置能力，两者相互独立、可以共存。形态差异在于：察元同时提供本机 MCP 服务，Claude Code、Cursor、Codex CLI 这些外部 Agent 能通过 http://127.0.0.1:62588/mcp 直连进来操作 WPS 文档，这条链路是它最有意思的地方。

## 二、数据会不会传到云端？

默认架构是离线与内网优先：模型端点可接 Ollama、LM Studio、Xinference、OneAPI 等任意 OpenAI 兼容端点，MCP 服务只监听 127.0.0.1，本机即信任边界，无需 Token。你也可以并行配置云端供应商，但用不用、用哪家，配置权在你手里。涉密文档该走的流程还是得走，工具不给定密背书。我们内网接的就是本地端点，文档内容不出这台机器，这也是它能进单位内网的原因。

## 三、需要装 Node.js 吗？

不需要。chayuan-mcp 是单文件二进制，安装脚本直接部署并注册开机自启：Windows 写 HKCU\Run，macOS 用 LaunchAgent，Linux 走 systemd --user。整个安装就是一行命令的事。Windows 那条长命令还顺手解决了 PowerShell 5.1 的 GBK 与 BOM 乱码问题，双击党完全无感。

## 四、AI 会不会偷偷改我的稿子？

不会。写操作带确认机制：document_replace、document_insert、document_apply_ops 不带确认只返回 preview 不写盘；document_add_comment、proofread_apply_comments、declassify_apply 这些必须显式传 confirmed:true 才执行，否则返回 CONFIRMATION_REQUIRED。第一次见到这个码别慌，补参数重发就是了。preview 模式还有个好处：先看看它打算怎么改，不合适当场调整提示词，零成本试错。

## 五、几百页的长文档怎么办？

先看 document_meta 的建议，超过约 80k 字符的整篇读取会被拒（DOCUMENT_TOO_LARGE），改用 document_chunks 带 cursor 和 limit 分页读。我的做法是让 Agent 自己决定：先 meta 再分块，摘要和细节分层拿，Token 也省。分块读配合 document_list_paragraphs 的锚点，回来写批注位置才钉得准，这是长文任务最容易忽略的一环。

## 六、报错一串英文看不懂怎么办？

六个错误码覆盖九成场景：WPS_AGENT_OFFLINE 是 WPS 没开或加载项没连上，先开 WPS；LOCATE_MISMATCH 或 LOCATE_NOT_FOUND 是文档变了锚点失效，重新 document_locate；MODEL_NOT_CONFIGURED 是校对模型没配。对表处理，基本不用喊人。完整名单是：WPS_AGENT_OFFLINE、DOCUMENT_TOO_LARGE、LOCATE_MISMATCH、LOCATE_NOT_FOUND、LICENSE_REQUIRED、MODEL_NOT_CONFIGURED，外加一个属于确认策略的 CONFIRMATION_REQUIRED，它不算故障。

## 七、免费额度用完了怎么一点提示都没有？

这正是设计：LICENSE_REQUIRED 不弹购买窗，安静失败。要么等额度，要么接自有模型。我们部门后来统一接了内网端点，这个问题就消失了。

## 八、Mac 能用吗？

能。macOS 和 Linux 一条 curl 搞定：

```bash
curl -fsSL https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.sh | bash -s -- --fetch
```

下载源 Gitee、aidooo、GitHub 多源回退，带 sha256 强校验，装完同样四级体检。体检全绿再关终端，别看命令跑完就走人。

## 九、怎么跟我已经在用的 Claude Code 接上？

一条命令注册：

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

Cursor 在项目级 .cursor/mcp.json 里按 mcpServers 写法填 URL，Codex CLI 编辑 ~/.codex/config.toml 加 mcp_servers 段。装技能文件时脚本也会自动投放，双向自启，装加载项等于带技能。Codex CLI 在 ~/.codex/config.toml 里给 mcp_servers 段填上 url 即可，Hermes、OpenClaw 这类工具选 HTTP 型 MCP 填同一地址。拿 MCP Inspector 验证：npx @modelcontextprotocol/inspector，选 Streamable HTTP 连一下就知道通没通。

## 十、后台会不会一堆黑窗和垃圾文件？

老版本确实有这两个毛病，都修了：4.1.1 起 -Fetch 临时解压目录退出即清理，不再每次残留约 290MB；4.1.2 起 sidecar 全面隐藏启动，黑窗不再出现，关窗不断服务，"运行 Spike"掉线自愈。同事被黑窗吓到的工单，升级后再没出现过。升级姿势也一句话：重跑同一行安装命令就是覆盖升级，旧配置不动；回滚加 -Version 指定旧版本号。

## 最后补一句被问出经验的话

日常最推荐的一条提示词，所有岗位通用：

```
帮我做发布前终检：错别字、标点、数字前后一致性、表格与正文是否一致；全部用批注输出；最后给我一份问题分级摘要（严重/一般/建议）
```

先 AI 一轮、人工复核一轮再送审，是目前最稳的用法。校对是辅助，签字盖章的还是人。这十个问题如果在你单位也高频出现，直接把这篇转给问的人。
