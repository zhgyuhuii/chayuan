# 长文档怎么审：meta、chunks，而不是一次读完全文

几十页到上百页的汇报、合同附件、会议纪要汇编，一旦让智能体「把全文读进来再改」，常见结局是超时、截断、锚点错位，或者直接收到 `DOCUMENT_TOO_LARGE`。察元本机 MCP（服务名 `chayuan-wps-mcp`，地址 `http://127.0.0.1:62588/mcp`）为长文准备了轻量元信息工具 `document_meta` 和分页分块工具 `document_chunks`。正确剧本是：先看 meta，再按块读，块内找问题，带着原文与锚点预览，确认后写批注。本文按这个剧本写操作说明，并给出和 Claude Code 的配合方式。

健康检查：`http://127.0.0.1:62588/healthz`，期望 online。总览安装见 [全生命周期安装与审查](./01-lifecycle-install-to-claude.md)；表格块内锚点见 [表格批注锚点](./06-table-comment-anchor.md)。

![长文档分块审查流程示意](images/csdn-07-1.png)

## 为什么禁止默认全文 get_text

### 体积与超时

`document_get_text` 适合短稿或选区。文档超约 80k 字符时，需要显式 `force:true` 或改用 chunks。对百万字级材料默认全文拉取，既拖垮上下文窗口，也让后续定位失去稳定边界。MCP 侧会用 `DOCUMENT_TOO_LARGE` 挡一次；客户端若绕过提示强行塞全文，模型照样会丢尾部章节。

### 锚点需要块边界

分块返回里带有 `start` / `end`（以及 cursor 翻页信息）。外部模型在块内标记的 `originalText`，写回时才能和 `document_locate` / `document_apply_ops` 对齐。没有块边界，只剩一段巨大字符串上的下标，表格与空段会放大漂移，批注出现「原文对、位置错」。

### 人在回路需要可中断

长文审查经常审到一半要换口径、跳过附录、先出目录级问题。分块天然支持「先审前 20 块，再决定要不要附录」。全文一次读完再出 300 条列表，人工确认成本会爆。

## 工具分工：meta、chunks、list_paragraphs

### document_meta

返回名称、字数、段数、是否建议分块等轻量字段。开场第一刀永远是 meta，不要先 chunks 盲翻。判断逻辑可以很朴素：

1. `recommendChunks` 为真，或 `charCount` 明显偏大 → 走分块。
2. 短稿 → 可直接校对 dryRun 或小范围 get_text。
3. 只要 meta 失败，先查 `WPS_AGENT_OFFLINE` 与 healthz，不要继续读正文。

### document_chunks

长文分页分块，参数关注 `cursor` 与 `limit`。实务建议：

1. `limit` 先取 1 到 3，观察单块体积与模型耗时。
2. 记下游标 `cursor`，循环直到没有更多块。
3. 每一块单独产出问题列表，带上块内原文子串。
4. 不要把多块原文拼成超级提示再让模型「一次性想完」。

### document_list_paragraphs

按段落分页、带 start/end，适合「逐段工作流」：改语气、插译文、段后标记。错别字总检仍优先 chunks 或 `proofread_run`，按段落硬扫在超长材料上偏慢。

![document_meta 与 chunks 翻页示意](images/csdn-07-2.png)

## 标准剧本（给 Claude 可整段粘贴）

先确认 Claude Code 已注册：

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

协议细节见 [Claude MCP 文档](https://code.claude.com/docs/en/mcp)。安装包见 [GitHub Releases](https://github.com/zhgyuhuii/chayuan-wps-releases)，产品说明见 [aidooo.com](https://aidooo.com)。

### 开场白

```text
你通过 chayuan-wps-mcp 审查当前 WPS 长文档。
1）先调用 document_meta；若建议分块或字数很大，禁止 document_get_text 全文。
2）用 document_chunks 按 cursor 分页，limit 先取 1..3。
3）每块只做校对预览，汇总错别字、标点、明显病句；不要写批注、不要改正文。
4）全部块（或我指定的块范围）完成后，给我去重后的问题总表。
5）我回复「确认写批注」后再写批注，钉在具体文字上；表格钉在单元格错字上。
6）没有「确认替换」禁止改正文。
```

### 限定范围

附录、附件目录、历史修订对照页常常不值得第一轮就审。可以追加：

```text
只审 cursor 从 0 到 30 的块；附录与附件清单跳过。
每块结束用一句话汇报进度。
```

### 写回

```text
确认写批注。
```

或：

```text
仅对严重级别条目确认写批注，建议级保留在列表里不写回。
```

![Claude 长文分块预览总表](images/csdn-07-3.png)

## 两种校对引擎怎么选

### proofread_run（加载项侧校对能力）

走察元已配置的拼写与语法模型，dryRun 默认只返回 issues。大文档上产品侧有动态进度与可调分块长度。适合「就是要错别字和标点」。未配模型会 `MODEL_NOT_CONFIGURED`。

适用顺序：

1. meta 确认文档在线。
2. `proofread_run` dryRun。
3. 人工剔除误报。
4. `proofread_apply_comments` 确认写批注。

### 外部 LLM + chunks（Claude 推理）

推理在 Claude，WPS 只负责读、定位、写。适合要顺带查前后矛盾、术语口径、章节遗漏的场合。注意：外部模型的「记忆」不会自动跨块对齐，你必须要求它维护一张运行中的术语表或问题总表，并在最后做去重。

混合用法很常见：先 `proofread_run` 出硬伤，再对目录与结论章用 chunks 做逻辑审阅。不要指望单次 dryRun 覆盖「正确性」的全部含义。

## 块大小、并发与稳定性

### limit 怎么取

1. 网络与模型都快：`limit=2` 或 `3` 减少往返。
2. 表多、锚点敏感：`limit=1`，降低块内噪声。
3. 出现定位失败增多：减小 limit，并缩短 originalText。

### 不要并行乱写

可以并行「读块 + 推理」，但写回必须串行且经确认。`document_apply_ops` 有批量上限（版本文档中为不超过 200 ops 量级），先无 confirm 预览，再 `confirmed: true`。长文一次甩上百条未确认替换，是事故写法。

### 保存点

每完成一大段章节的批注写回，执行一次 `document_save` 或让用户另存。崩溃后可以从下一 cursor 继续，而不是从头再来。多文档场景还要配合 `document_open` 固定活动文档，见 [多文档交叉校对](./08-multi-document-cross-proofread.md)。

## 失败码与现象

| 代码或现象 | 含义 | 处理 |
| --- | --- | --- |
| DOCUMENT_TOO_LARGE | 全文读取被拒 | 改 chunks 或显式 force（仍不推荐百万字 force） |
| WPS_AGENT_OFFLINE | 加载项未连上 sidecar | 打开 WPS，刷新 healthz |
| LOCATE_NOT_FOUND / LOCATE_MISMATCH | 原文与文档不一致 | 回到对应 chunk 复核，缩短子串 |
| CONFIRMATION_REQUIRED | 写操作未确认 | 用户明确确认后再写 |
| 列表重复 | 跨块边界同一句被审两次 | 总表按原文+位置去重 |
| 尾部章节漏审 | cursor 未翻完 | 检查循环终止条件 |

连通性四级验收见 [healthz 与四级验证](./09-healthz-four-level-verify.md)。预览与替换总原则见 [预览批注与替换写回](./04-preview-comment-replace.md)。

![定位失败时缩短原文子串示意](images/csdn-07-4.png)

## 实操示例：80 页汇报

假设活动文档是「2026年度工作汇报.docx」，约 8 万字，含 12 张表。

1. 浏览器打开 healthz，确认 online。
2. 对 Claude 粘贴长文开场白。
3. 观察它先打 meta；若直接 get_text，立刻打断并重申禁止全文。
4. 让它先输出目录级风险：缺章节、表号跳号、明显口径冲突（可先扫前若干块）。
5. 再跑错别字预览总表。
6. 你标记：表 3、表 7 必须钉准；附录 B 跳过写回。
7. 回复确认写批注。
8. 在 WPS 抽查表内高亮与两处正文批注。
9. 另存「汇报-已校-日期.docx」。

时间上，人工确认往往比模型推理更长。把确认动作设计进流程，而不是事后补救。

## 和加载项内校对的关系

加载项「拼写与语法检查」对长文也会分块与显示进度，适合坐在 WPS 前点选的同事。Claude 路径适合已经在终端/编排里干活、需要跨文件、需要把审查嵌进更大任务图的人。两条路径共用本机 sidecar 与当前文档，不是两套互相打架的引擎。对比选型见 [加载项内置检查对比 Claude MCP](./10-addon-vs-claude-mcp.md)。

若加载项内长文能出结果、Claude 侧一碰就 `DOCUMENT_TOO_LARGE`，说明客户端还在走全文读取习惯，改开场白即可，不必重装。

## 提示词补充：只要结构不要错字

有时第一轮只想知道「能不能报」：

```text
不要做错别字检查。用 document_chunks 浏览，只输出：
1）标题层级疑似混乱处；
2）表号/附件号提及但缺失；
3）前后日期冲突。
每条附原文短句。不要写批注。
```

结构问题同样要带原文短句，方便第二轮回到块内精确定位。

## 性能与上下文的经验值

1. 单块输入尽量给模型留出输出预算；块太大时模型会压缩思考，漏检率上升。
2. 总表超过一屏，按「严重 / 一般 / 建议」三级让 Claude 重排，人工先看严重。
3. 同一原文多次命中时，批注写一条并在说明里写「全文共 N 处」，避免气泡刷屏。
4. 扫描件式纯图片 PDF 转档的 docx，分块读到的可能是空段或乱码，先确认文本层存在。

## 科室落地时的三份材料

1. 开场白文本（本文模板微调科室用语）。
2. 验收单：meta 是否先做、是否出现全文 get_text、表内抽查是否通过、是否未经确认写回。
3. 失败码速查（本文表 + [错误码与排错](./15-error-codes-troubleshooting.md)）。

发行与版本以 [aidooo.com](https://aidooo.com) 和 [chayuan-wps-releases](https://github.com/zhgyuhuii/chayuan-wps-releases) 为准。MCP 配置方式以 [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp) 与仓库连接说明为准。

## 去重规则要写进指令

跨块边界时，同一句话可能被审两次。总表去重建议按「规范化原文 + 近似位置」合并：

1. 原文去掉首尾空白后相同，且位置间距小于一个短句长度 → 合并为一条，注明「跨块重复」。
2. 原文相同但位置相距很远 → 保留两条，或合并为一条并写「全文共 N 处」。
3. 原文是子串关系（「永鹅」与「永鹅公园」）→ 人工决定保留更短或更长，避免两条批注叠在同一处。

把去重规则写进开场白，比事后在表格软件里手工删行更稳。去重后的序号才用于「按第 2、5 条确认写批注」，否则序号会漂。

## 进度汇报格式

长文会话很长，中途断线常见。要求 Claude 每处理完若干块输出固定进度行：

```text
进度：cursor=12/估计40；本批新增问题 3；累计去重后 28；下一块继续。
```

你可以把进度行贴进工作日志。恢复会话时说：「从 cursor=12 继续，前面的总表以我粘贴的为准」，避免模型假装已经审完后半本。

## 附录与附件的默认策略

不少汇报后半是附件扫描说明、历史文件清单、大段法规摘录。第一轮全量 chunks 会把时间耗在低价值区域。默认策略：

1. 正文与图表章节全量预览。
2. 附录仅做「是否缺附件标题 / 是否有明显错别字样例」抽样。
3. 法规原文摘录不改字，只标摘录是否截断。

把策略写进指令，模型才不会在附录里产出上百条「建议润色」。润色本就不是长文第一轮目标。

## 内存与上下文爆掉时怎么办

症状：模型开始忘记开场白，突然对某一块调用 `document_get_text` 全文，或重复询问文件名。处理：

1. 新开对话，只粘贴冻结后的问题总表与剩余 cursor。
2. 重申禁止全文 get_text 与禁止未确认写回。
3. 降低 limit，减少单轮块数。
4. 若客户端本身上下文不够，把「推理」与「写回」拆成两次会话：第一次只产列表到文件，第二次只按列表 locate + 确认写批注。

拆会话时，列表必须带 originalText 与大致章节名，否则第二次会话无法定位。

## 和表格专项的衔接

长文中的表不要留到全部正文结束后再「顺便看看」。更稳的是：

1. 正文 chunks 预览时，凡碰到表，单独标记「表 N 待专项」。
2. 正文总表确认后，再对表 N 跑表格锚点指令。
3. 表内批注抽查通过后，才进入正文替换。

这样表内挂整格不会被淹没在两百条正文建议里。表格细则见表格锚点篇。

## 验收时抽哪些块

不可能逐字看完。抽查样本建议：

1. 第 1 块（标题与开头，常有单位名称错误）。
2. 含第一张数据表的块。
3. 结论或「下一步工作」块。
4. 随机一块中段。
5. 最后一块（看 cursor 是否真的走完）。

五块里锚点与结论都合理，再扩大写回范围。若最后一块从未出现在进度里，说明循环终止条件有 bug，先补审再签字。

## 小结（给会写脚本的同事）

把长文审查写成伪代码就是：

```text
assert healthz == online
meta = document_meta()
if meta.recommendChunks or meta.charCount >> threshold:
    cursor = 0
    issues = []
    while True:
        page = document_chunks(cursor=cursor, limit=1..3)
        if empty: break
        issues += llm_proofread(page.text)  # dry only
        cursor = page.next_cursor
    present(dedupe(issues))
    wait("确认写批注")
    apply_comments(confirmed=True)
else:
    proofread_run(dryRun=True) → confirm → apply
```

谁先破坏这个顺序——通常是「图快全文读入」——谁先收到超时或错锚。分块不是性能彩蛋，是长文审查的主路径。把去重、进度行、附录策略写进开场白，长文审查才能从一次偶发成功变成可恢复、可交接的日常操作。
