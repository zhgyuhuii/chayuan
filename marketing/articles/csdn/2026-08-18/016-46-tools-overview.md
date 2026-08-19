# 46 个文档工具一次看懂：察元AI文档助手 MCP 工具目录速览

把察元AI文档助手接进 Claude Code 之后，我建议的第一件事不是急着下提示词，而是把它的 MCP 工具目录过一遍——46 个工具（MCP 目录版本 0.10.0），乍看吓人，其实按"一份文档的生命周期"分组之后非常好记。Agent 编排热度这么高，很多人拿到一堆工具不知道从哪下手，这篇就当一张导览图。

## 第一组：开门与体检

wps_status 做分层健康检查，出问题时先用它分辨是服务层还是 WPS 层的毛病；wps_launch 负责冷启动 WPS，机器刚开机时的场景用得上；document_open、document_ensure_open 打开文档，后者保证文档处于打开状态，AI 编排里用 ensure 更省心；document_meta 返回文档名、字数、段数，外加一个很实用的字段——是否建议分块。让 AI 干活前先调一次 meta，是性价比最高的一步：文档多大、该整读还是分块读，服务端替你预判了。这组工具解决的是开工前的确定性：服务在不在、WPS 开没开、文档打没打开，三个问题三个工具，别让 AI 猜。

## 第二组：读与找

document_list_paragraphs 拉段落列表，每段带锚点，锚点是后面写批注、做替换的地基；document_get_text 直接拿全文，但超过约 80k 会拒收，返回 DOCUMENT_TOO_LARGE，明知文档很大仍要整读时可以 force:true；document_chunks 是长文分页分块读，配 cursor 和 limit 参数像翻书一样往后翻；document_locate 按内容定位，命中多处时返回多个锚点供你挑，避免"改错那一处"。

## 第三组：写回，全部带保险

document_replace 替换、document_insert 插入（支持 after/before/append/prepend/insert 四种位置）、document_new 新建文档、document_save 保存（可另存为）。这一组的共同点：不传 confirmed:true 就只返回 preview 预览，一个字不写盘。预览返回的是改动方案，人点头之后第二次调用才真正执行。对 AI 编排来说这个设计很关键：模型可以先拿预览给自己核对一遍，再交给人确认，相当于 AI 和人各把一道关。

## 第四组：批注与批量

document_add_comment 写批注，必须 confirmed:true 才执行；document_apply_ops 是批量大招，支持 replace、comment、comment-replace、insert-after 四种操作，一次调用最多 200 条——终检场景的主力，值得单独写一篇实战。

## 第五组：脱密、校对与知识库

脱密四件套：declassify_status 看状态、declassify_preview 不写盘先预览效果、declassify_apply 需要 confirm 加 password 加 keywords 三重条件才执行、declassify_restore 可恢复。校对线：proofread_run 默认 dryRun 只返回问题列表，proofread_apply_comments 把问题转成批注（需确认），proofread_job_poll 轮询异步任务，长文档校对跑起来就不用干等。知识库走 kb_retrieve 做 RAG 检索，对接的是察元桌面版和网络版知识库，单机版在本机 62581 端口免登录。

## 第六组：助手目录与外围能力

assistants_list_domains 离线可用，assistants_search 能检索数千个察元助手，assistants_get 导出助手定义和提示词——写自己的 Agent 提示词没思路时，抄现成的好过从零憋。表格线有 12 个 action：切片读（header_read、column_read 等）、row_insert 和 column_insert 按口语"在哪插"定位锚点行列、cell_merge（同行等于合并列、同列等于合并行）、列宽调整、重复表头、导出。题注与域线有 caption 和 field，能构造 SEQ、TOC 域，长文档自动编号不用手动维护。图片线 image.list 增补了 alt、环绕方式和前后文。另有四个只读 Resources：chayuan://wps/health 和三个助手清单类资源，适合客户端做首屏展示。

## 三个容易踩的点

一，大文档别硬拉全文，DOCUMENT_TOO_LARGE 这个错误码就是在提醒你改用 chunks。二，写操作前想清楚要不要确认，preview 是给人看的，不是给 AI 看的。三，LOCATE_MISMATCH 或 LOCATE_NOT_FOUND 说明锚点校验失败，正确动作是让 AI 重新 document_locate 再动手，别硬来。四，错误码按字面意思处理就好：LICENSE_REQUIRED 是免费额度用尽（不会弹购买窗打断你），MODEL_NOT_CONFIGURED 是还没配校对模型，把端点配好即可。

## 怎么快速记

按生命周期串一遍就顺了：体检（wps_status）→ 开门（document_open）→ 相面（document_meta）→ 读书（chunks/locate）→ 动笔（replace/insert/apply_ops，全带确认）→ 收尾（save）。目录里最密的其实是表格那 12 个 action，但记住"先切片读找锚点、再按坐标执行"这条主线就不会乱。这份目录面向的主要是想自己编排 Agent 流程的开发者。普通用户其实不用背目录——WPS 界面里还有 29 个内置助手开箱即用，不碰终端也有完整体验。工具记不记得住不重要，重要的是知道边界：AI 的输出是辅助参考，脱密、定稿、法务把关，责任始终在人。
