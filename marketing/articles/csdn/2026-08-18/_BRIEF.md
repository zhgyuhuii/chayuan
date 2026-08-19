# 察元AI文档助手 · CSDN 网文共享素材库（2026-08-18 批次专用）

所有批次 agent 必须先通读本文件再动笔。本文件是唯一事实来源，文中数据、命令、端口、工具名一律以本文件为准，禁止编造不存在的功能、版本号或命令。

## 一、产品一句话

**察元 AI 文档助手**（英文名 Chayuan AI Document Assistant）是运行在 **WPS 文字**里的智能加载项 + **本机 MCP 文档智能体服务**：让 AI 直接在 WPS 文档里干活——读正文、圈错别字、写批注、批量替换、插表格行列、多文档交叉校对；支持 Claude Code、OpenAI Codex、Cursor 等外部 AI 智能体通过 MCP 直连；**离线/内网优先**（Ollama、LM Studio、Xinference、OneAPI 等 OpenAI 兼容端点）。当前版本 **4.1.2**，Apache-2.0 开源，Vue 3 + Vite 构建，官网 aidooo.com，出品方北京智灵鸟科技中心，微信公众号「智灵鸟科技」。

## 二、核心事实速查（写文必背）

### 2.1 一行命令安装（终端用户，无需克隆仓库）

Windows（PowerShell，自动处理 PS 5.1 的 GBK/BOM 乱码问题）：

```powershell
& {[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$w=New-Object Net.WebClient;$w.Encoding=[Text.Encoding]::UTF8;$s=$w.DownloadString('https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.ps1');if($s.Length -and $s[0]-eq[char]0xFEFF){$s=$s.Substring(1)};& ([scriptblock]::Create($s)) -Fetch}
```

macOS / Linux：

```bash
curl -fsSL https://gitee.com/cloudshd/chayuan-wps-releases/raw/master/scripts/install-wps-skill-chayuan.sh | bash -s -- --fetch
```

- 下载源：Gitee → aidooo → GitHub 多源回退，**sha256 强校验**
- 参数：`-SkillOnly` 只投放技能文件不动加载项/服务；`-Version 4.1.2` 指定版本
- 脚本四步闭环：①装加载项（jsaddons 目录 + publish.xml，WPS 打开即加载）→ ②MCP 自启（chayuan-mcp 单文件二进制 + 注册开机自启：Win `HKCU\Run` / macOS LaunchAgent / Linux systemd --user，**无需 Node.js**）→ ③四级体检（jsaddons → /healthz → initialize 握手 → 桥接工具）→ ④投放技能到 Claude/Cursor/Codex
- **双向自启**：装技能=装加载项，装加载项=带技能，一个脚本三件事全到位
- v4.1.1 修复：`-Fetch` 临时解压目录退出即清理（此前每次残留约 290MB）
- v4.1.2 修复：sidecar 全面隐藏启动（黑窗不再出现、关窗不断服务），「运行 Spike」掉线自愈

### 2.2 MCP 连接（所有 MCP 智能体通用）

- 服务地址：`http://127.0.0.1:62588/mcp`（Streamable HTTP）
- 健康检查：`GET http://127.0.0.1:62588/healthz` 返回 `online`
- 仅监听 127.0.0.1，本机即信任边界，**无需 Token/命令/stdio**；远程需代理或设 `CHAYUAN_MCP_PORT`

Claude Code（CLI 一键注册）：

```bash
claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
```

或在 `.mcp.json`：`{"mcpServers":{"chayuan-wps-mcp":{"url":"http://127.0.0.1:62588/mcp"}}}`

OpenAI Codex CLI（编辑 `~/.codex/config.toml`）：

```toml
[mcp_servers.chayuan-wps-mcp]
url = "http://127.0.0.1:62588/mcp"
```

Cursor（项目级 `.cursor/mcp.json` 或 设置 → MCP → Add）：同 `.mcp.json` 写法。Hermes / OpenClaw：新建 MCP 服务选 HTTP / Streamable HTTP 类型填 URL。MCP Inspector 验证：`npx @modelcontextprotocol/inspector`，选 Streamable HTTP 填地址点 Connect。

### 2.3 46 个 MCP 文档工具（MCP 目录版本 0.10.0）

- 文档与读取：`wps_status`（分层健康）、`wps_launch`（冷启动 WPS）、`document_open`、`document_ensure_open`、`document_meta`（名称/字数/段数/是否建议分块）、`document_list_paragraphs`（含锚点）、`document_chunks`（长文分页分块，cursor/limit）、`document_get_text`（超约 80k 需 force:true 或改用 chunks）、`document_locate`（定位返回多命中锚点）
- 写回：`document_replace`（未 confirm=preview）、`document_insert`（after/before/append/prepend/insert）、`document_add_comment`（必须 confirmed:true）、`document_apply_ops`（批量写回 replace/comment/comment-replace/insert-after，≤200 ops）、`document_new`、`document_save`（可另存为）
- 脱密：`declassify_status` / `declassify_preview`（不写盘）/ `declassify_apply`（需 confirm+password+keywords）/ `declassify_restore`
- 知识库与校对：`kb_retrieve`（RAG 检索）、`proofread_run`（dryRun 默认仅返回 issues）、`proofread_apply_comments`（issues 转批注，需 confirm）、`proofread_job_poll`（轮询异步任务）
- 助手目录：`assistants_list_domains`（离线可用）、`assistants_search`（检索数千个察元助手）、`assistants_get`（导出助手定义/提示词）
- 表格 12 action：切片读（header_read/column_read 等）+ **row_insert / column_insert（按口语"在哪插"定位锚点行列）+ cell_merge（同行=合并列、同列=合并行）** + 列宽/重复表头 + 导出
- 题注与域：`caption`（caption.list 题注枚举）、`field`（field.list + 构造 SEQ/TOC 域）
- 图片：`image.list` 增补 alt/wrap/前后文
- Resources（只读）：`chayuan://wps/health`、`chayuan://assistants/manifest`、`chayuan://assistants/domain/{domain}`、`chayuan://assistants/{id}`

### 2.4 confirmed 确认策略与错误码

写操作未传 `confirmed: true` → `document_replace/insert/apply_ops` 返回 preview 不写盘；`document_add_comment`、`proofread_apply_comments`、`declassify_apply/restore` 返回 `CONFIRMATION_REQUIRED`。

错误码：`WPS_AGENT_OFFLINE`（WPS/加载项未连上 sidecar）、`DOCUMENT_TOO_LARGE`（改用 chunks 或 force:true）、`LOCATE_MISMATCH` / `LOCATE_NOT_FOUND`（锚点校验失败/未找到）、`LICENSE_REQUIRED`（免费额度用尽，不弹购买窗）、`MODEL_NOT_CONFIGURED`（未配置校对模型）、`CONFIRMATION_REQUIRED`。

### 2.5 加载项内置 29 个助手（无需外部 Agent，WPS 里直接用）

核心类：拼写与语法检查（结构化 JSON 问题列表）、生成摘要、翻译（目标语言可配置）、文本转图像、文本转语音、文本转视频。
文本分析类：换种方式重写、扩写、缩写、批注解释、超链接解释、纠正拼写和语法、提炼关键词、检查段落序号格式、AI 痕迹检查（保守评估）、保密检查（密级标识/涉军涉装/单位身份/联系方式/项目编号/商业秘密分级风险提示）。
更多/编审类：涉密关键词提取、表单智能提取（合同/公文抽字段输出 JSON）、文档审计助手（书签级审计）、润色优化、正式化改写、通俗化改写、提取行动项、提取结论与风险、术语统一、生成标题、段落结构优化、生成会议纪要、政策/公文风格改写。
自定义智能助手：系统提示+用户模板+模型类型+输入来源（优先选区/仅选区/全文）+输出格式+写回动作+显示位置（Ribbon 主菜单/更多菜单/右键菜单/右键更多）。
写回八式：插入到光标处、插入到每段后面、插入到文档最前面、替换、添加批注、链接形式批注、批注加替换、追加到文末、仅生成结果。
批量能力：表格批量（导出/删除全部表格、自动行宽、刷新样式、按文字删行列、追加替换、序号与样式、表格题注）、图像批量（导出/删除图像、统一/清除格式、图像题注）、文档批量（清理未使用样式、统计样式、删除空白行）。
察元 AI 编审：表单辅助填报、表单内容预览、文档审计、模板与规则（aidooo 扩展名文件导入导出、规则制作与交换）。

### 2.6 模型与生态

- 离线/内网优先：Ollama、LM Studio、Xinference、OneAPI、New API 等任意 OpenAI 兼容端点；亦可并行配置云端供应商（OpenAI、DeepSeek、阿里百炼、千帆、Gemini 等）
- 知识库 RAG（v3.0）：对接察元桌面版/网络版（chayuan-desktop）；单机版 `http://127.0.0.1:62581` 免登录，网络版带 JWT 登录；HMAC 应用态对接
- 一套引擎四档 SKU：①文档助手（本项目 WPS 加载项）②桌面版（单机安装包）③服务版（Docker 网络版，全科室共用）④至臻版（数百到上万人浏览器工作空间）
- 开源仓库：github.com/zhgyuhuii/chayuan-wps-releases（桌面版/网络版：zhgyuhuii/chayuan-desktop-releases）；Gitee 同步发布；百度网盘安装包
- 与 WPS AI 关系：察元是独立第三方加载项，WPS AI 是金山办公内置能力，二者相互独立可共存

### 2.7 高频可复制提示词（文中引用时可直接用/改写）

- 全文错别字：`帮我检查文档中的错别字，用批注标出原文和建议改法`
- 先预览后写回：`先跑一遍校对（dryRun），汇总问题列表，不要先改正文；我确认后再写成批注`
- 表格批注钉错字：`重点检查表格单元格里的错别字，批注必须钉在具体错字上`
- 多文档交叉：`打开目录下这几份文档，交叉检查错别字与术语是否一致`
- 发布前终检：`帮我做发布前终检：错别字、标点、数字前后一致性、表格与正文是否一致；全部用批注输出；最后给我一份问题分级摘要（严重/一般/建议）`
- 序号体例：`检查标题/条款序号（一、（一）、1.）是否层级混乱，批注指出`
- 数字勾稽：`核对数表与正文数字是否一致（合计、百分比）`
- 敏感信息：`查找疑似身份证号、手机号、银行卡号并批注`
- 表格插行：`在"合计"行上面插入一行，列结构和上一行一致`（AI 会先 header_read/column_read 找锚点，工具只按显式坐标执行）

## 三、写作规范（硬性要求）

1. **每篇正文汉字数 ≥1000**（不含代码块、不含英文命令），目标 1100–1600 字。写完必须自检。
2. 文件为 Markdown，首行 `# 标题`；标题即爆文标题，带产品名或痛点关键词，总长 15–32 字。
3. **风格**：CSDN 技术博客 + 一线实战口吻。口语化、有场景、有干货、敢说痛点；像同事分享踩坑经验，不像官方新闻稿。禁浮夸形容词堆砌（"赋能""颠覆""极致"少用或不用）。
4. **结构多样化**（防止同质化被平台判定营销号）：可在「故事开场式 / 教程步骤式（下载-配置-验证-测试-使用）/ 清单盘点式 / 对比评测式 / 问答式 / 踩坑复盘式」中按篇指定风格轮换；每篇至少含：痛点场景、用法步骤或操作细节、1–3 条可直接复制的提示词或命令、适用人群/场景、克制的产品边界说明（如"辅助参考不替代人工定密/法务"）。
5. **热点钩子**（2026年8月语境，按篇自然融入一个）：MCP 协议生态爆发、Claude Code / Codex CLI / Cursor Agent 热潮、AI Agent 办公落地元年、DeepSeek/Qwen/GLM 等国产模型本地部署、信创国产化替代（WPS 替代 Office）、数据安全不出域、AI 幻觉治理、AIGC 痕迹检测、政务大模型落地、Token 成本优化、RAG 知识库、AI 就业焦虑。热点是引子，落点必须回到察元的具体功能。
6. **事实纪律**：端口 62588、healthz 返回 online、46 工具、版本 4.1.2、Apache-2.0、29 内置助手（表述可用"29 个内置助手"或"二十多个内置助手"）、表格 12 action、≤200 ops 批量写回、约 80k 文本阈值——这些数字不得改动；不确定的细节宁可不写，禁止编造截图、价格、用户量、融资信息。不得承诺"100% 准确""替代人工定密/法务签字"。
7. 提及竞品（WPS AI、Copilot、Notion AI、飞书、豆包、Kimi 等）时语气克制客观，只对比形态差异，不贬低。
8. 每篇结尾自然收束（一句心得/行动建议），不要"综上所述"式总结腔。全文不写"本文来自AI生成"之类字样。
9. 品牌名写法：**察元AI文档助手**（标题中）或 察元（正文简称），不用其他变形。

## 四、字数自检命令（写完每篇跑一次，不达标就扩写）

```bash
node -e "const fs=require('fs');const t=fs.readFileSync(process.argv[1],'utf8').replace(/\`\`\`[\\s\\S]*?\\\`\`\`/g,'');const h=(t.match(/[\\u4e00-\\u9fff]/g)||[]).length;console.log(process.argv[1].split(/[\\\\/]/).pop(), '汉字数:', h, h>=1000?'OK':'TOO SHORT')" FILE.md
```
