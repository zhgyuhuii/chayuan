# 六个错误码一张表：察元 MCP 排错速查

MCP 生态这一年爆发式增长，身边把 Claude Code、Cursor、Codex CLI 接到本机 MCP 服务上干活的人越来越多。察元的 MCP 目录一共 46 个文档工具，工具一多，报错种类看着就吓人，但我维护部门这半年的经验是：真正高频的错误码只有六个。把它们整理成一张表贴在工位上，日常九成的求助都能自己消化。

## 先上表

| 错误码 | 一句话含义 | 第一反应动作 |
| --- | --- | --- |
| WPS_AGENT_OFFLINE | WPS 或加载项没连上 sidecar | 先打开 WPS，随便开份文档 |
| DOCUMENT_TOO_LARGE | 文本超过约 80k 阈值 | 改用 document_chunks 分块读 |
| LOCATE_MISMATCH / LOCATE_NOT_FOUND | 锚点校验失败或未找到 | 重新 document_locate 拿新锚点 |
| LICENSE_REQUIRED | 免费额度用尽 | 不弹购买窗，可配自有模型 |
| MODEL_NOT_CONFIGURED | 校对模型未配置 | 配好 OpenAI 兼容端点再跑 |
| CONFIRMATION_REQUIRED | 写操作缺 confirmed:true | 补参数重发，这不是故障 |

## 六个码按三类记

背六个码有窍门，按性质分三类。环境类两个：WPS_AGENT_OFFLINE 和 MODEL_NOT_CONFIGURED，都是"上下文没就绪"，把 WPS 打开、把模型配好就消失。行为类两个：CONFIRMATION_REQUIRED 和 LOCATE 系兄弟，前者是确认机制拦你，后者是锚点校验拦你，同属"设计如此"的防御。额度与体量类两个：LICENSE_REQUIRED 和 DOCUMENT_TOO_LARGE，一个管配额，一个管上下文长度。分类记住，报错一眼就知道该动配置、补参数，还是换读法。

## 逐个展开

WPS_AGENT_OFFLINE 出现频率最高。察元的架构是 MCP 服务常驻本机，但真正操作文档的桥接要靠 WPS 加载项：WPS 没开、或者加载项没被加载，46 个文档工具就集体失联。处置顺序是先把 WPS 打开；不行就检查加载项是否落在 jsaddons 目录、publish.xml 注册是否正常；再不行让外部 Agent 调 wps_launch 冷启动。4.1.2 之后 sidecar 全面隐藏启动且 Spike 掉线自愈，这类报错肉眼可见地少了。

DOCUMENT_TOO_LARGE 是长文档必经之路。document_get_text 对超过约 80k 字符的文档会拒绝整篇返回，这是对模型上下文的保护。正确做法是换 document_chunks 带 cursor 和 limit 分页读；必要时也可以 force:true 强制整篇，但一般不建议，Token 花得肉疼，还容易把关键内容稀释在长上下文里。

LOCATE_MISMATCH 和 LOCATE_NOT_FOUND 是写回环节的守门员。文档是有生命的，你在读和写之间正文可能已经变了，锚点对不上时工具宁可报错也不乱写。遇到就重新 document_locate 定位拿最新锚点，再执行写回。这个"较真"的设计救过我好几回，尤其是批注钉错字这种要求位置精确的场景。

LICENSE_REQUIRED 最容易引起误会：免费额度用尽时报它，而且不弹购买窗，进程安静地失败，日志里才看得到。处置要么等额度恢复，要么在配置里接自己的模型，Ollama、LM Studio、Xinference、OneAPI 这些 OpenAI 兼容端点都行，内网部署也顺。

MODEL_NOT_CONFIGURED 顾名思义：校对类工具依赖校对模型，模型没配就先去配，配完再跑 proofread_run。这个码友好在它把"你还没配模型"和"模型配错了"区分开了，照着提示走就行。

CONFIRMATION_REQUIRED 严格说不算错误，是确认策略。document_add_comment、proofread_apply_comments、declassify_apply 这些写操作必须显式传 confirmed:true 才落盘；第一次调用返回这个码是设计使然，补参数重发即可。document_replace、document_insert、document_apply_ops 未带确认时则返回 preview 不写盘，一个道理。

## 排错三板斧

第一斧，打健康检查：浏览器或终端访问 `http://127.0.0.1:62588/healthz`，返回 online 说明服务活着，问题在下游。第二斧，让 Agent 调 wps_status，它是分层健康检查，服务、加载项、桥接逐层看，比瞎猜快得多。第三斧，用 MCP Inspector 直连验证：`npx @modelcontextprotocol/inspector`，选 Streamable HTTP 填地址点 Connect，工具列表能枚举出来就说明链路通，问题在提示词或参数。校对这类长任务还有异步路线：proofread_run 发出去之后用 proofread_job_poll 轮询结果，批量处理成套文档时不用干等一个会话，编排起来顺手得多。

## 顺手一条好习惯

排错之外，日常用建议养成"先预览后写回"的习惯，直接把这句丢给 Agent：

```
先跑一遍校对（dryRun），汇总问题列表，不要先改正文；我确认后再写成批注
```

dryRun 默认只返回问题清单，你过目之后才让 proofread_apply_comments 落成批注，既避开误写，也少踩 CONFIRMATION_REQUIRED 的来回。这张速查适合三类人：刚把 Claude Code 或 Cursor 接上察元的新手、替同事装机后负责答疑的"接口人"、以及想在内网挂一页排错 FAQ 的信息科同事。最后照例说边界：校对结果是辅助参考，最终改不改、怎么改，仍以人工定稿为准。这张表建议收藏，下次报错先对表，再决定要不要喊人。
