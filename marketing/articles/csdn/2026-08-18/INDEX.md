# 察元AI文档助手 · CSDN 网文 150 篇（2026-08-18 批次）

> 选题矩阵覆盖：安装部署、MCP/Agent 生态、公文政务、法务合同、投标标书、学术科研、企业职场、功能深讲、模型部署、对比评测、排错运维。每篇正文汉字数 ≥1000（不含代码块），事实以 [_BRIEF.md](./_BRIEF.md) 为准。


## 安装部署与上手（001-010）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 001 | 一行 PowerShell 装好 WPS 加载项、MCP 自启和 AI 技能：行政岗十分钟上手察元AI文档助手 | [001-one-line-install-ten-minutes.md](./001-one-line-install-ten-minutes.md) | 1261 |
| 002 | 不止 Windows：macOS 和 Linux 一行 curl 把察元AI文档助手装进 WPS | [002-macos-linux-curl-install.md](./002-macos-linux-curl-install.md) | 1065 |
| 003 | 装完别急着用：察元AI文档助手四级体检，一条 healthz 定心丸 | [003-four-level-health-check.md](./003-four-level-health-check.md) | 1128 |
| 004 | 无需 Node.js 的 MCP 服务：察元AI文档助手单文件二进制的开机自启方案 | [004-no-nodejs-binary-sidecar.md](./004-no-nodejs-binary-sidecar.md) | 1120 |
| 005 | 装技能等于装加载项：察元AI文档助手双向自启设计拆解 | [005-skill-addon-dual-bootstrap.md](./005-skill-addon-dual-bootstrap.md) | 1156 |
| 006 | 弱网断网也能装：察元AI文档助手三源回退下载与 sha256 强校验 | [006-multi-source-sha256-fetch.md](./006-multi-source-sha256-fetch.md) | 1102 |
| 007 | 只想给 Claude Code 投技能、不动 WPS：察元AI文档助手 -SkillOnly 用法 | [007-skill-only-mode.md](./007-skill-only-mode.md) | 1132 |
| 008 | 注册表、LaunchAgent、systemd：察元AI文档助手三平台 MCP 常驻方案 | [008-autostart-three-platforms.md](./008-autostart-three-platforms.md) | 1144 |
| 009 | 桌面版和加载项怎么选：察元AI 一套引擎四档 SKU 选购指南 | [009-desktop-vs-addon-choose.md](./009-desktop-vs-addon-choose.md) | 1135 |
| 010 | 给领导演示 AI 校对公文：十分钟 PoC 用察元AI文档助手跑通全流程 | [010-ten-minute-poc-demo.md](./010-ten-minute-poc-demo.md) | 1115 |

## MCP 生态与 Agent 客户端（011-020）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 011 | 2026 Agent 元年：MCP 为什么成了 AI 工具界的 USB 口 | [011-agent-era-mcp-usb.md](./011-agent-era-mcp-usb.md) | 1190 |
| 012 | Claude Code 不只写代码：一条命令把它接进 WPS 改公文 | [012-claude-code-terminal-gongwen.md](./012-claude-code-terminal-gongwen.md) | 1111 |
| 013 | OpenAI Codex CLI 接 WPS：config.toml 三行配置实录 | [013-codex-cli-config-toml.md](./013-codex-cli-config-toml.md) | 1122 |
| 014 | Cursor 写代码之余：接上 WPS MCP 摇身变成文档 Agent | [014-cursor-doc-agent.md](./014-cursor-doc-agent.md) | 1108 |
| 015 | Cline、Hermes、OpenClaw 都能连：HTTP 型 MCP 客户端全适配 | [015-http-mcp-clients-all.md](./015-http-mcp-clients-all.md) | 1117 |
| 016 | 46 个文档工具一次看懂：察元AI文档助手 MCP 工具目录速览 | [016-46-tools-overview.md](./016-46-tools-overview.md) | 1138 |
| 017 | 无 Token 无鉴权为什么反而安全：聊聊 62588 端口的信任边界 | [017-localhost-trust-boundary.md](./017-localhost-trust-boundary.md) | 1110 |
| 018 | AI 动你文档前先亮预览：confirmed 确认策略的双重保险 | [018-confirmed-double-insurance.md](./018-confirmed-double-insurance.md) | 1100 |
| 019 | 一次写回两百条批注：document_apply_ops 批量操作实战 | [019-apply-ops-200-batch.md](./019-apply-ops-200-batch.md) | 1106 |
| 020 | 百万字长文怎么交给 AI 审：document_chunks 分块剧本 | [020-million-word-chunks.md](./020-million-word-chunks.md) | 1114 |

## 机制设计与排错（021-030）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 021 | AI 改错位置怎么办：LOCATE_MISMATCH 锚点校验这道防线 | [021-locate-anchor-mismatch.md](./021-locate-anchor-mismatch.md) | 1334 |
| 022 | 先预览、再确认、再写回：proofread_run 三段式校对流 | [022-proofread-dryrun-workflow.md](./022-proofread-dryrun-workflow.md) | 1120 |
| 023 | chayuan:// 三个只读资源：MCP Resources 的正确打开方式 | [023-mcp-resources-readonly.md](./023-mcp-resources-readonly.md) | 1037 |
| 024 | 62581 引擎配 62588 智能体：察元桌面版与 WPS 加载项协作拓扑 | [024-engine-62581-mcp-62588.md](./024-engine-62581-mcp-62588.md) | 1160 |
| 025 | 从浏览器插件到本机 Agent：文档 AI 三年形态演进 | [025-from-plugin-to-local-agent.md](./025-from-plugin-to-local-agent.md) | 1150 |
| 026 | 只钉批注不改正文：AI 审校留痕的工程实现 | [026-comment-not-replace-trace.md](./026-comment-not-replace-trace.md) | 1094 |
| 027 | WPS_AGENT_OFFLINE 五分钟自救：AI 连不上文档排查清单 | [027-agent-offline-5min-fix.md](./027-agent-offline-5min-fix.md) | 1079 |
| 028 | 80k 文本阈值与 force:true：大文档读法的取舍 | [028-document-too-large-80k.md](./028-document-too-large-80k.md) | 1079 |
| 029 | 服务掉线 8 秒自动回连：sidecar 自愈机制记一次实录 | [029-sidecar-self-heal-8s.md](./029-sidecar-self-heal-8s.md) | 1053 |
| 030 | 一台内网 GPU 全科室共用：Ollama 校对引擎部署记 | [030-intranet-gpu-ollama-share.md](./030-intranet-gpu-ollama-share.md) | 1087 |

## 公文与保密场景（031-040）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 031 | 标题、主送、落款缺项：党政机关公文格式 AI 自检清单 | [031-gongwen-format-check.md](./031-gongwen-format-check.md) | 1252 |
| 032 | 成文日期和签发人：公文落款最常丢的三项，机器先筛一遍 | [032-date-signer-missing.md](./032-date-signer-missing.md) | 1106 |
| 033 | 一、（一）、1. 层级乱成一团：段落序号检查一键体例 | [033-heading-number-chaos.md](./033-heading-number-chaos.md) | 1110 |
| 034 | 通知、请示、函：三类常用文种的 AI 审查要点 | [034-notice-request-letter.md](./034-notice-request-letter.md) | 1149 |
| 035 | 口语稿升格公文腔：政策公文风格改写实测 | [035-policy-style-rewrite.md](./035-policy-style-rewrite.md) | 1115 |
| 036 | 材料外发前十分钟：保密检查助手的分级风险提示 | [036-confidential-pre-send.md](./036-confidential-pre-send.md) | 1184 |
| 037 | 密级标识查漏：辅助不定密，但能先替你筛一遍 | [037-classified-mark-hint.md](./037-classified-mark-hint.md) | 1115 |
| 038 | 脱密还能复原：占位符替换的可逆脱敏流程 | [038-declassify-reversible.md](./038-declassify-reversible.md) | 1120 |
| 039 | 身份证、手机号、银行卡：敏感信息批注定位实战 | [039-pii-locate-comment.md](./039-pii-locate-comment.md) | 1160 |
| 040 | 机关信息科视角：内网不上传的 AI 校对部署实录 | [040-info-section-deploy.md](./040-info-section-deploy.md) | 1141 |

## 政务场景落地（041-050）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 041 | 县级政务离线部署：Ollama 全链路跑通记 | [041-county-offline-deploy.md](./041-county-offline-deploy.md) | 1376 |
| 042 | 政务大模型落地难？从文档校对这个刚需切进去 | [042-gov-llm-landing.md](./042-gov-llm-landing.md) | 1245 |
| 043 | 收文、办文、发文：一周五天的 AI 辅助节奏表 | [043-weekly-gongwen-rhythm.md](./043-weekly-gongwen-rhythm.md) | 1137 |
| 044 | 领导讲话稿润色：正式化改写且保留原意 | [044-speech-polish-formal.md](./044-speech-polish-formal.md) | 1254 |
| 045 | 年终总结跑量季：摘要、行动项、风险三件套 | [045-year-end-summary.md](./045-year-end-summary.md) | 1129 |
| 046 | 汇报材料数字打架：勾稽检查替你抓口径 | [046-report-number-consistency.md](./046-report-number-consistency.md) | 1125 |
| 047 | 巡察督查报告：结论与证据链的核对思路 | [047-inspection-report-chain.md](./047-inspection-report-chain.md) | 1145 |
| 048 | 会议纪要十分钟出稿：转写稿整理流水线 | [048-meeting-minutes-10min.md](./048-meeting-minutes-10min.md) | 1185 |
| 049 | 值班信息与简报：关键词提炼加标题生成 | [049-brief-keyword-title.md](./049-brief-keyword-title.md) | 1143 |
| 050 | 基层减负的一个切口：格式交给机器，人只管内容 | [050-grassroots-reduce-burden.md](./050-grassroots-reduce-burden.md) | 1175 |

## 法务合同场景（051-060）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 051 | 合同关键条款缺项扫描：主体、金额、期限、违约责任一个不漏 | [051-contract-clause-scan.md](./051-contract-clause-scan.md) | 1124 |
| 052 | 三份合同交叉核数字：多文档交叉校对，法务第一次没加班 | [052-three-contracts-crosscheck.md](./052-three-contracts-crosscheck.md) | 1113 |
| 053 | 合同金额大小写不一致：数字勾稽查的就是这种坑 | [053-amount-case-mismatch.md](./053-amount-case-mismatch.md) | 1131 |
| 054 | 风险清单批注：法务审一审之前的 AI 预筛怎么做 | [054-risk-list-comment.md](./054-risk-list-comment.md) | 1128 |
| 055 | 表单智能提取：从合同里抽出字段，沉淀成书签规则 | [055-form-field-extract.md](./055-form-field-extract.md) | 1127 |
| 056 | 文档审计助手：书签级逐项复核怎么跑 | [056-bookmark-audit.md](./056-bookmark-audit.md) | 1114 |
| 057 | 团队规则对齐：aidooo 模板规则文件的导入导出 | [057-template-rules-aidooo.md](./057-template-rules-aidooo.md) | 1133 |
| 058 | 务必、从未、100%：绝对化用语扫描与弱化建议 | [058-absolute-terms-scan.md](./058-absolute-terms-scan.md) | 1132 |
| 059 | 合同译英文：术语表先行，每段后面插译文 | [059-contract-translate-en.md](./059-contract-translate-en.md) | 1187 |
| 060 | 法务不加班的正确姿势：AI 预筛加人工拍板的分工线 | [060-legal-no-overtime.md](./060-legal-no-overtime.md) | 1129 |

## 投标标书场景（061-070）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 061 | 差一个序号就废标：标书编号一致性检查实录 | [061-bid-sequence-fatal.md](./061-bid-sequence-fatal.md) | 1168 |
| 062 | 三天写完标书：扩写和政策公文风格改写搭骨架 | [062-bid-skeleton-expand.md](./062-bid-skeleton-expand.md) | 1275 |
| 063 | 投标承诺的边界：AI 只做语言层，事实必须人工核 | [063-bid-promise-boundary.md](./063-bid-promise-boundary.md) | 1115 |
| 064 | 评分办法逐条对照：要求与应答的一致性检查 | [064-bid-scoring-alignment.md](./064-bid-scoring-alignment.md) | 1256 |
| 065 | 开标前夜终检：表格与正文数字一致再睡觉 | [065-bid-final-night.md](./065-bid-final-night.md) | 1172 |
| 066 | 多人合稿术语打架：标书术语统一实战 | [066-bid-terms-unify.md](./066-bid-terms-unify.md) | 1118 |
| 067 | 废标风险自查：格式、签字页、附件引用清单 | [067-bid-reject-risk-list.md](./067-bid-reject-risk-list.md) | 1112 |
| 068 | 中标公告与标书口径：事后勾稽别嫌晚 | [068-win-notice-crosscheck.md](./068-win-notice-crosscheck.md) | 1165 |
| 069 | 投标部的流水线：一周标书的 AI 辅助节奏 | [069-bid-dept-pipeline.md](./069-bid-dept-pipeline.md) | 1109 |
| 070 | 资质、案例、数字：权威版本粘贴，机器只做整理 | [070-bid-company-case-numbers.md](./070-bid-company-case-numbers.md) | 1102 |

## 学术科研场景（071-080）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 071 | 开学前最后一周：论文术语统一交给机器 | [071-thesis-terms-unify.md](./071-thesis-terms-unify.md) | 1153 |
| 072 | 图表编号与题注错位：caption.list 帮你一个个抓出来 | [072-thesis-caption-figures.md](./072-thesis-caption-figures.md) | 1152 |
| 073 | 据说、据悉没出处：引用缺失提醒的正确用法 | [073-reference-missing-hint.md](./073-reference-missing-hint.md) | 1118 |
| 074 | 论文降 AI 腔之前：AI 痕迹检查的保守评估怎么用 | [074-ai-trace-check-thesis.md](./074-ai-trace-check-thesis.md) | 1116 |
| 075 | 导师的红字批注看不懂：批注解释助手当陪练 | [075-advisor-comment-explain.md](./075-advisor-comment-explain.md) | 1144 |
| 076 | 三十万字学位论文：分块审校的节奏与锚点 | [076-thesis-million-chunks.md](./076-thesis-million-chunks.md) | 1123 |
| 077 | 中英摘要对照：翻译先统一术语表 | [077-thesis-en-abstract.md](./077-thesis-en-abstract.md) | 1102 |
| 078 | 文献综述瘦身：缩写助手保留关键信息 | [078-literature-condense.md](./078-literature-condense.md) | 1107 |
| 079 | 实验数据与正文打架：数表勾稽在论文里的用法 | [079-thesis-data-consistency.md](./079-thesis-data-consistency.md) | 1109 |
| 080 | 答辩讲稿写得像论文：通俗化改写救场 | [080-defense-script-plain.md](./080-defense-script-plain.md) | 1124 |

## 企业职场场景（081-090）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 081 | 晚上十点接活：四十分钟交出十五页报告校对 | [081-10pm-report-rescue.md](./081-10pm-report-rescue.md) | 1245 |
| 082 | 周报自动汇编：提取行动项和结论风险两条线 | [082-weekly-report-assemble.md](./082-weekly-report-assemble.md) | 1110 |
| 083 | 审计报告整理：散落的数字先聚拢再人工拍板 | [083-audit-report-figures.md](./083-audit-report-figures.md) | 1150 |
| 084 | 新媒体小编的十个标题：生成标题多轮比选 | [084-newmedia-titles.md](./084-newmedia-titles.md) | 1158 |
| 085 | 教案讲义写得太拗口：通俗化改写加摘要 | [085-lesson-plan-plain.md](./085-lesson-plan-plain.md) | 1119 |
| 086 | 采访记录两万字：提取行动项生成线索清单 | [086-journalist-interview-notes.md](./086-journalist-interview-notes.md) | 1118 |
| 087 | HR 的 JD 与简历整理：表单提取换个用法 | [087-hr-jd-resume.md](./087-hr-jd-resume.md) | 1105 |
| 088 | 制造业技术文档：多作者合稿的风格分裂治理 | [088-manual-terms-unify.md](./088-manual-terms-unify.md) | 1144 |
| 089 | 培训材料配图配音：文生图和文生语音的草稿位 | [089-training-images-tts.md](./089-training-images-tts.md) | 1151 |
| 090 | 对外函件语气：委婉与正式之间怎么切换 | [090-external-letter-tone.md](./090-external-letter-tone.md) | 1154 |

## 制度材料与表格深讲（091-100）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 091 | 邮件草稿先过一遍：敬辞、语气、错别字三查 | [091-email-draft-etiquette.md](./091-email-draft-etiquette.md) | 1101 |
| 092 | 公司制度汇编：序号层级混乱一次治好 | [092-policy-compilation.md](./092-policy-compilation.md) | 1239 |
| 093 | 董事会材料：数据前后矛盾筛查 | [093-board-materials-check.md](./093-board-materials-check.md) | 1116 |
| 094 | 白皮书起草：扩写加段落结构优化组合拳 | [094-whitepaper-drafting.md](./094-whitepaper-drafting.md) | 1123 |
| 095 | 口语说"在哪插"就插行插列：表格结构写回实测 | [095-table-structure-writeback.md](./095-table-structure-writeback.md) | 1107 |
| 096 | 合并单元格不用鼠标拖：cell_merge 的同行同列规则 | [096-cell-merge-usage.md](./096-cell-merge-usage.md) | 1204 |
| 097 | 表格切片读：header_read 先找锚点再动手 | [097-table-slice-read.md](./097-table-slice-read.md) | 1110 |
| 098 | 表格批注钉在错字上：单元格锚点机制解析 | [098-table-comment-anchor.md](./098-table-comment-anchor.md) | 1100 |
| 099 | 自动行宽、重复表头、题注：表格批量工具盘点 | [099-table-batch-tools.md](./099-table-batch-tools.md) | 1165 |
| 100 | SEQ 题注编号与目录域：field 工具的 list 和 add | [100-field-seq-toc.md](./100-field-seq-toc.md) | 1125 |

## 功能点深讲（101-110）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 101 | 图片的 alt、环绕方式、前后文：image.list 增强读法 | [101-image-list-enhanced.md](./101-image-list-enhanced.md) | 1168 |
| 102 | 统一格式、清除格式、题注：图像批量三件套 | [102-image-batch-format.md](./102-image-batch-format.md) | 1114 |
| 103 | 清理未使用样式、删除空白行：文档批量瘦身记 | [103-doc-batch-styles.md](./103-doc-batch-styles.md) | 1238 |
| 104 | 插入、替换、批注、追加：写回八式怎么选 | [104-writeback-eight-ways.md](./104-writeback-eight-ways.md) | 1167 |
| 105 | 修订模式与批注：审稿流程的两条路 | [105-revision-vs-comment.md](./105-revision-vs-comment.md) | 1158 |
| 106 | Ribbon、更多、右键四槽位：自定义助手摆位学 | [106-custom-assistant-slots.md](./106-custom-assistant-slots.md) | 1234 |
| 107 | 一个助手只做一类事：提示词聚焦的心法 | [107-one-assistant-one-job.md](./107-one-assistant-one-job.md) | 1172 |
| 108 | 输出 JSON 的助手：让 OA 和脚本能接住结果 | [108-json-assistant-oa.md](./108-json-assistant-oa.md) | 1245 |
| 109 | 报告模式：长输出分段计划防上下文爆炸 | [109-report-mode-long-output.md](./109-report-mode-long-output.md) | 1217 |
| 110 | 文生图、文生语音、文生视频：参数确认卡片先弹再跑 | [110-multimodal-param-card.md](./110-multimodal-param-card.md) | 1161 |

## 输入策略与模型部署（111-120）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 111 | 选区还是全文：输入来源的选择策略 | [111-selection-vs-fulltext.md](./111-selection-vs-fulltext.md) | 1230 |
| 112 | 固定流程固化：任务清单与任务编排 | [112-task-checklist-orchestration.md](./112-task-checklist-orchestration.md) | 1168 |
| 113 | 助手进化与回滚：版本快照的治理思路 | [113-assistant-evolution-rollback.md](./113-assistant-evolution-rollback.md) | 1237 |
| 114 | 影子双跑：候选助手后台对比不打扰用户 | [114-shadow-run-ab.md](./114-shadow-run-ab.md) | 1174 |
| 115 | Ollama 本地跑校对：显存、上下文、速度的实用建议 | [115-ollama-local-proofread.md](./115-ollama-local-proofread.md) | 1047 |
| 116 | LM Studio、Xinference、OneAPI：一个网关全接住 | [116-openai-compatible-gateway.md](./116-openai-compatible-gateway.md) | 1129 |
| 117 | 校对任务要多大模型：本地选型的务实答案 | [117-local-model-choice.md](./117-local-model-choice.md) | 1207 |
| 118 | MODEL_NOT_CONFIGURED：校对模型配置排错记 | [118-model-not-configured.md](./118-model-not-configured.md) | 1095 |
| 119 | 敏感段本地、公开段云端：分流策略与责任边界 | [119-cloud-local-split.md](./119-cloud-local-split.md) | 1130 |
| 120 | 对照制度查违规：知识库 RAG 的机关用法 | [120-kb-rag-institution.md](./120-kb-rag-institution.md) | 1153 |

## 部署生态与对比评测（121-130）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 121 | JWT 与 HMAC：网络版和单机版的两种对接鉴权 | [121-jwt-hmac-modes.md](./121-jwt-hmac-modes.md) | 1148 |
| 122 | 密钥不出域：API key 管理与轮换清单 | [122-api-key-hygiene.md](./122-api-key-hygiene.md) | 1149 |
| 123 | Token 成本优化：长文分块省的是真金白银 | [123-token-cost-saving.md](./123-token-cost-saving.md) | 1119 |
| 124 | 一套引擎四档 SKU：模型网关的生态位 | [124-170-model-gateway.md](./124-170-model-gateway.md) | 1100 |
| 125 | Docker 服务版：全科室共用一份知识库 | [125-docker-team-kb.md](./125-docker-team-kb.md) | 1113 |
| 126 | WPS 加 Ollama 全栈国产化：信创环境的文档 AI | [126-xinchuang-fullstack.md](./126-xinchuang-fullstack.md) | 1174 |
| 127 | 察元和 WPS AI 是什么关系：第三方加载项与官方 AI 共存指南 | [127-vs-wps-ai.md](./127-vs-wps-ai.md) | 1132 |
| 128 | Copilot 很强但内网用不了：一个务实的补充思路 | [128-vs-copilot-intranet.md](./128-vs-copilot-intranet.md) | 1163 |
| 129 | Notion AI、飞书智能伙伴：宿主决定了写回能力 | [129-vs-notion-feishu.md](./129-vs-notion-feishu.md) | 1101 |
| 130 | 别再把稿子粘贴进聊天框了：数据出境与效率双输 | [130-stop-paste-chatbox.md](./130-stop-paste-chatbox.md) | 1163 |

## 对比思辨与排错入门（131-140）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 131 | 加载项内置检查还是 Claude Code：两条路径怎么选 | [131-builtin-vs-claude-mcp.md](./131-builtin-vs-claude-mcp.md) | 1184 |
| 132 | AI 校对来了，校对员会失业吗：工具升级论 | [132-proofreader-job-anxiety.md](./132-proofreader-job-anxiety.md) | 1168 |
| 133 | AI 幻觉与留痕：批注而不直接改的职业伦理 | [133-hallucination-trace-ethics.md](./133-hallucination-trace-ethics.md) | 1191 |
| 134 | Apache-2.0 开源：源码可审计对政企意味着什么 | [134-open-source-audit-value.md](./134-open-source-audit-value.md) | 1168 |
| 135 | AI 痕迹检查不是司法鉴定：保守评估的边界 | [135-ai-trace-not-forensics.md](./135-ai-trace-not-forensics.md) | 1167 |
| 136 | 开源不等于可以换标：品牌条款与白标的边界 | [136-brand-whitelabel.md](./136-brand-whitelabel.md) | 1201 |
| 137 | 复制粘贴架构的终结：MCP 时代的文档交互 | [137-mcp-vs-clipboard-arch.md](./137-mcp-vs-clipboard-arch.md) | 1249 |
| 138 | Agent 办公这一年：从聊天到干活的分水岭 | [138-agent-office-year-review.md](./138-agent-office-year-review.md) | 1183 |
| 139 | 连不上先打 healthz：一条命令的分诊逻辑 | [139-healthz-first-aid.md](./139-healthz-first-aid.md) | 1221 |
| 140 | 端口 62588 被占了怎么办：CHAYUAN_MCP_PORT 改端口实录 | [140-port-conflict-fix.md](./140-port-conflict-fix.md) | 1165 |

## 排错运维与收官（141-150）

| 序 | 标题 | 文件 | 汉字 |
|---|---|---|---|
| 141 | PowerShell 5.1 乱码坑：iwr 管道 iex 为什么不行 | [141-ps51-garbled-fix.md](./141-ps51-garbled-fix.md) | 1154 |
| 142 | 六个错误码一张表：察元 MCP 排错速查 | [142-error-code-cheatsheet.md](./142-error-code-cheatsheet.md) | 1161 |
| 143 | 覆盖升级与回滚：旧配置不动的升级姿势 | [143-upgrade-rollback.md](./143-upgrade-rollback.md) | 1128 |
| 144 | 排错别把密钥发上网：日志与隐私纪律 | [144-log-privacy-discipline.md](./144-log-privacy-discipline.md) | 1142 |
| 145 | wps_launch 冷启动：Agent 先开机再干活的链路 | [145-wps-launch-cold-start.md](./145-wps-launch-cold-start.md) | 1102 |
| 146 | 打开、确保打开、另存：多文档操作的工具拼图 | [146-multi-doc-open-save.md](./146-multi-doc-open-save.md) | 1107 |
| 147 | 数千个助手的检索与导出：assistants_search 玩法 | [147-assistants-search-export.md](./147-assistants-search-export.md) | 1144 |
| 148 | 给全部门推 AI 校对：推广手记与培训切入点 | [148-team-rollout-guide.md](./148-team-rollout-guide.md) | 1144 |
| 149 | 用了半年察元：被同事问最多的十个问题 | [149-faq-50-questions.md](./149-faq-50-questions.md) | 1114 |
| 150 | 从零到文档 Agent：一个行政岗的三十天上手记 | [150-from-zero-to-agent.md](./150-from-zero-to-agent.md) | 1127 |
