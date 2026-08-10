# 察元 AI · 100 条爆款短视频脚本包

> 一套面向政企/专业办公用户的产品宣传短视频脚本库。**爆款场景驱动**，每条 15–40s、竖屏 9:16，
> 适配抖音 / 视频号 / 小红书。脚本、封面、截图三者用**统一编号**强绑定，拿到即可录屏 / 剪辑。

- 产品：察元 AI（Chayuan AI）· WPS 加载项 v3.0.13 + 桌面 / 服务 / 至臻版
- 官网：https://aidooo.com ｜ 开源：Apache 2.0 ｜ 出品：北京智灵鸟科技中心
- 设计文档：`../docs/superpowers/specs/2026-06-20-chayuan-100-video-scripts-design.md`

## 目录结构与对应关系

| 资产 | 路径 | 说明 |
|---|---|---|
| **配音稿** | `voiceover/<编号>.md` | **纯主持人口播文稿**，无任何标注，拿来直接配音 / 喂 TTS 生成音频 |
| 分镜脚本 | `scripts/<编号>.md` | 100 条分镜脚本（钩子 / 痛点 / 分镜表 / CTA / 素材 / 可拍清单），拍摄 / 剪辑用 |
| 封面 | `covers/<编号>.svg` | 9:16 竖版标题封面，可直接做视频首帧 / 缩略图 |
| 截图 | `assets/screenshots/<代码>.png` | 仓库现有真实界面截图的语义软链（见下方图例） |
| 清单 | `manifest.csv` | 编号→系列→场景→截图→需录屏 的机器可读映射 |

**编号即对应**：`voiceover/072.md`（配音）↔ `scripts/072.md`（分镜）↔ `covers/072.svg`（封面）↔ `manifest.csv` 第 072 行指定截图。

> 制作流程：① 念 `voiceover/<编号>.md` 配音生成音频 → ② 按 `scripts/<编号>.md` 分镜表录屏 / 套用 `covers/<编号>.svg` 首帧 → ③ 音画合成成片。

## 重要说明

- 本包**不含 MP4 成片**：当前环境无 ffmpeg / TTS / 渲染工具。交付的是「脚本 + 分镜 + 可拍清单 + 封面 + 截图」，供拍摄 / 录屏 / 剪辑直接使用。
- 截图为仓库现有 ~15 张真实界面图（去重后）。**37 条**脚本涉及现有截图覆盖不到的画面（弹窗内步骤、右键菜单、引用条、写回动作、SQL 诊断等），已在各脚本「需新录屏/截图」中逐条标清。

## 截图图例（assets/screenshots/）

| 代码 | 界面 |
|---|---|
| W-ABOUT | WPS 加载项「关于察元 AI 助手」页（欢迎+二维码） |
| W-TEXT | WPS「文本分析」下拉（重写/扩写/缩写/段落序号/AI痕迹/批注解释/超链接解释/纠错/提炼关键词） |
| W-MORE | WPS「更多」下拉（涉密词提取/表单提取/润色/正式化/通俗化/行动项/结论风险/术语统一/生成标题/段落结构/会议纪要/公文风格/自定义助手） |
| W-AUDIT | WPS「察元AI编审」（表单/文档审计/模板/规则/任务清单） |
| W-MODEL | 设置-模型供应商（OpenAI/Ollama/通义/DeepSeek/千帆…） |
| W-DEFAULT | 设置-默认模型（对话/图像/视频/语音） |
| W-ASSIST | 设置-助手设置（系统助手列表+助手配置） |
| W-KB | WPS 知识库连接（测试连通/编辑/可访问知识库） |
| C-HOME | 客户端工作主页（AI操控/翻译/写作/妙记/同传字幕/修图） |
| C-CHAT | 客户端新对话 |
| C-ARENA | 客户端多模型并排对比 |
| C-KBLIST | 客户端知识中心 |
| C-KBNEW | 客户端新建知识库（文档/图像/结构化/外部向量） |
| C-MARKET | 客户端模型广场 |
| C-FLOW | 客户端智能空间工作流编辑器 |

## 100 条索引


### A 政务公文合规（18 条）

| 编号 | 场景 | 受众 | 时长 | 配音稿 | 分镜 | 封面 | 主截图 | 需录屏 |
|---|---|---|---|---|---|---|---|---|
| 001 | 连夜核对公文段落序号一致性 | 政务文秘 | 30s | [配音](voiceover/001.md) | [分镜](scripts/001.md) | [封面](covers/001.svg) | W-TEXT | 否 |
| 002 | 红头文件密级一键自检 | 政务保密 | 32s | [配音](voiceover/002.md) | [分镜](scripts/002.md) | [封面](covers/002.svg) | W-TEXT | 是 |
| 003 | 涉密文档一键脱密 | 政务保密 | 33s | [配音](voiceover/003.md) | [分镜](scripts/003.md) | [封面](covers/003.svg) | W-TEXT | 是 |
| 004 | 脱密复原一键还原原文 | 政务保密 | 30s | [配音](voiceover/004.md) | [分镜](scripts/004.md) | [封面](covers/004.svg) | W-TEXT | 是 |
| 005 | 涉密关键词一键提取 | 政务保密 | 28s | [配音](voiceover/005.md) | [分镜](scripts/005.md) | [封面](covers/005.svg) | W-MORE | 否 |
| 006 | 政策公文风格一键改写 | 政务文秘 | 30s | [配音](voiceover/006.md) | [分镜](scripts/006.md) | [封面](covers/006.svg) | W-MORE | 否 |
| 007 | 内网离线也能用AI不出域 | 政企IT | 34s | [配音](voiceover/007.md) | [分镜](scripts/007.md) | [封面](covers/007.svg) | W-MODEL | 否 |
| 008 | 口语稿正式化改写成公文 | 政务文秘 | 28s | [配音](voiceover/008.md) | [分镜](scripts/008.md) | [封面](covers/008.svg) | W-MORE | 否 |
| 009 | 通知公告秒生成标题 | 政务文秘 | 22s | [配音](voiceover/009.md) | [分镜](scripts/009.md) | [封面](covers/009.svg) | W-MORE | 否 |
| 010 | 政策原文带引用问答 | 政务研究 | 33s | [配音](voiceover/010.md) | [分镜](scripts/010.md) | [封面](covers/010.svg) | W-KB | 是 |
| 011 | 会议纪要一键成稿 | 政务文秘 | 30s | [配音](voiceover/011.md) | [分镜](scripts/011.md) | [封面](covers/011.svg) | W-MORE | 否 |
| 012 | 提取领导讲话行动项 | 政务文秘 | 28s | [配音](voiceover/012.md) | [分镜](scripts/012.md) | [封面](covers/012.svg) | W-MORE | 否 |
| 013 | 长文档段落结构优化 | 政务文秘 | 28s | [配音](voiceover/013.md) | [分镜](scripts/013.md) | [封面](covers/013.svg) | W-MORE | 否 |
| 014 | 公文术语全文统一 | 政务文秘 | 28s | [配音](voiceover/014.md) | [分镜](scripts/014.md) | [封面](covers/014.svg) | W-MORE | 否 |
| 015 | 本地云端混用安全用AI | 政企IT | 34s | [配音](voiceover/015.md) | [分镜](scripts/015.md) | [封面](covers/015.svg) | W-MODEL | 否 |
| 016 | 文档审计逐条合规检查 | 政务审核 | 33s | [配音](voiceover/016.md) | [分镜](scripts/016.md) | [封面](covers/016.svg) | W-AUDIT | 是 |
| 017 | 涉密词占位替换加复原闭环 | 政务保密 | 35s | [配音](voiceover/017.md) | [分镜](scripts/017.md) | [封面](covers/017.svg) | W-TEXT | 是 |
| 018 | 政务知识库连接配置 | 政企IT | 32s | [配音](voiceover/018.md) | [分镜](scripts/018.md) | [封面](covers/018.svg) | W-KB | 否 |

### B 合同法务（12 条）

| 编号 | 场景 | 受众 | 时长 | 配音稿 | 分镜 | 封面 | 主截图 | 需录屏 |
|---|---|---|---|---|---|---|---|---|
| 019 | 合同关键条款秒提取 | 法务 | 30s | [配音](voiceover/019.md) | [分镜](scripts/019.md) | [封面](covers/019.svg) | W-MORE | 是 |
| 020 | 合同字段结构化抽取入表 | 法务 | 33s | [配音](voiceover/020.md) | [分镜](scripts/020.md) | [封面](covers/020.svg) | W-MORE | 是 |
| 021 | 逐条款风险审计 | 法务 | 34s | [配音](voiceover/021.md) | [分镜](scripts/021.md) | [封面](covers/021.svg) | W-AUDIT | 是 |
| 022 | 合同模板规则校验 | 法务 | 32s | [配音](voiceover/022.md) | [分镜](scripts/022.md) | [封面](covers/022.svg) | W-AUDIT | 是 |
| 023 | 批量合同字段提取 | 法务 | 32s | [配音](voiceover/023.md) | [分镜](scripts/023.md) | [封面](covers/023.svg) | W-AUDIT | 是 |
| 024 | 提取合同结论与风险 | 法务 | 30s | [配音](voiceover/024.md) | [分镜](scripts/024.md) | [封面](covers/024.svg) | W-MORE | 否 |
| 025 | 法规知识库问答带引用 | 法务 | 33s | [配音](voiceover/025.md) | [分镜](scripts/025.md) | [封面](covers/025.svg) | W-KB | 是 |
| 026 | 合同条款通俗化解读 | 法务 | 28s | [配音](voiceover/026.md) | [分镜](scripts/026.md) | [封面](covers/026.svg) | W-MORE | 否 |
| 027 | 表单模式辅助填报 | 法务 | 30s | [配音](voiceover/027.md) | [分镜](scripts/027.md) | [封面](covers/027.svg) | W-AUDIT | 是 |
| 028 | 合同模板导入导出复用 | 法务 | 28s | [配音](voiceover/028.md) | [分镜](scripts/028.md) | [封面](covers/028.svg) | W-AUDIT | 否 |
| 029 | 法务知识库一键下载原文 | 法务 | 30s | [配音](voiceover/029.md) | [分镜](scripts/029.md) | [封面](covers/029.svg) | W-KB | 是 |
| 030 | 合同翻译保留法律术语 | 涉外法务 | 30s | [配音](voiceover/030.md) | [分镜](scripts/030.md) | [封面](covers/030.svg) | W-TEXT | 是 |

### C 标书投标（10 条）

| 编号 | 场景 | 受众 | 时长 | 配音稿 | 分镜 | 封面 | 主截图 | 需录屏 |
|---|---|---|---|---|---|---|---|---|
| 031 | 标书赶工连夜扩写 | 投标 | 30s | [配音](voiceover/031.md) | [分镜](scripts/031.md) | [封面](covers/031.svg) | W-TEXT | 否 |
| 032 | 技术方案控篇幅缩写 | 投标 | 28s | [配音](voiceover/032.md) | [分镜](scripts/032.md) | [封面](covers/032.svg) | W-TEXT | 否 |
| 033 | 标书政策公文风格统一 | 投标 | 30s | [配音](voiceover/033.md) | [分镜](scripts/033.md) | [封面](covers/033.svg) | W-MORE | 否 |
| 034 | 提取评标结论与风险点 | 投标 | 30s | [配音](voiceover/034.md) | [分镜](scripts/034.md) | [封面](covers/034.svg) | W-MORE | 否 |
| 035 | 标书术语全文统一 | 投标 | 28s | [配音](voiceover/035.md) | [分镜](scripts/035.md) | [封面](covers/035.svg) | W-MORE | 否 |
| 036 | 招标文件知识库问答 | 投标 | 33s | [配音](voiceover/036.md) | [分镜](scripts/036.md) | [封面](covers/036.svg) | W-KB | 是 |
| 037 | 投标方案换种方式重写 | 投标 | 28s | [配音](voiceover/037.md) | [分镜](scripts/037.md) | [封面](covers/037.svg) | W-TEXT | 否 |
| 038 | 标书AI痕迹检查 | 投标 | 30s | [配音](voiceover/038.md) | [分镜](scripts/038.md) | [封面](covers/038.svg) | W-TEXT | 是 |
| 039 | 标书提炼关键词 | 投标 | 24s | [配音](voiceover/039.md) | [分镜](scripts/039.md) | [封面](covers/039.svg) | W-TEXT | 否 |
| 040 | 标书生成章节标题 | 投标 | 24s | [配音](voiceover/040.md) | [分镜](scripts/040.md) | [封面](covers/040.svg) | W-MORE | 否 |

### D 通用写作提效（14 条）

| 编号 | 场景 | 受众 | 时长 | 配音稿 | 分镜 | 封面 | 主截图 | 需录屏 |
|---|---|---|---|---|---|---|---|---|
| 041 | 一句话换种方式重写 | 通用办公 | 24s | [配音](voiceover/041.md) | [分镜](scripts/041.md) | [封面](covers/041.svg) | W-TEXT | 否 |
| 042 | 内容不够一键扩写 | 通用办公 | 24s | [配音](voiceover/042.md) | [分镜](scripts/042.md) | [封面](covers/042.svg) | W-TEXT | 否 |
| 043 | 篇幅超了一键缩写 | 通用办公 | 24s | [配音](voiceover/043.md) | [分镜](scripts/043.md) | [封面](covers/043.svg) | W-TEXT | 否 |
| 044 | 全文润色优化 | 通用办公 | 26s | [配音](voiceover/044.md) | [分镜](scripts/044.md) | [封面](covers/044.svg) | W-MORE | 否 |
| 045 | 口语正式化改写 | 通用办公 | 26s | [配音](voiceover/045.md) | [分镜](scripts/045.md) | [封面](covers/045.svg) | W-MORE | 否 |
| 046 | 术语通俗化改写 | 通用办公 | 26s | [配音](voiceover/046.md) | [分镜](scripts/046.md) | [封面](covers/046.svg) | W-MORE | 否 |
| 047 | 一键纠正拼写和语法 | 通用办公 | 28s | [配音](voiceover/047.md) | [分镜](scripts/047.md) | [封面](covers/047.svg) | W-TEXT | 是 |
| 048 | AI痕迹检查降AI味 | 通用办公 | 30s | [配音](voiceover/048.md) | [分镜](scripts/048.md) | [封面](covers/048.svg) | W-TEXT | 是 |
| 049 | 一键提炼关键词 | 通用办公 | 22s | [配音](voiceover/049.md) | [分镜](scripts/049.md) | [封面](covers/049.svg) | W-TEXT | 否 |
| 050 | 看不懂的批注一键解释 | 通用办公 | 26s | [配音](voiceover/050.md) | [分镜](scripts/050.md) | [封面](covers/050.svg) | W-TEXT | 否 |
| 051 | 超链接内容一键解释 | 通用办公 | 24s | [配音](voiceover/051.md) | [分镜](scripts/051.md) | [封面](covers/051.svg) | W-TEXT | 否 |
| 052 | 长文一键生成标题 | 通用办公 | 22s | [配音](voiceover/052.md) | [分镜](scripts/052.md) | [封面](covers/052.svg) | W-MORE | 否 |
| 053 | 段落结构一键优化 | 通用办公 | 26s | [配音](voiceover/053.md) | [分镜](scripts/053.md) | [封面](covers/053.svg) | W-MORE | 否 |
| 054 | 选中即问右键加入AI助手 | 通用办公 | 26s | [配音](voiceover/054.md) | [分镜](scripts/054.md) | [封面](covers/054.svg) | W-ABOUT | 是 |

### E 摘要会议纪要（8 条）

| 编号 | 场景 | 受众 | 时长 | 配音稿 | 分镜 | 封面 | 主截图 | 需录屏 |
|---|---|---|---|---|---|---|---|---|
| 055 | 长文档一键生成摘要 | 职场通用 | 28s | [配音](voiceover/055.md) | [分镜](scripts/055.md) | [封面](covers/055.svg) | W-TEXT | 否 |
| 056 | 管理层版摘要报告模式 | 管理层 | 30s | [配音](voiceover/056.md) | [分镜](scripts/056.md) | [封面](covers/056.svg) | W-ASSIST | 是 |
| 057 | 会议纪要一键成稿 | 职场通用 | 30s | [配音](voiceover/057.md) | [分镜](scripts/057.md) | [封面](covers/057.svg) | W-MORE | 否 |
| 058 | 提取会议行动项 | 职场通用 | 28s | [配音](voiceover/058.md) | [分镜](scripts/058.md) | [封面](covers/058.svg) | W-MORE | 否 |
| 059 | 提取结论与风险 | 管理层 | 30s | [配音](voiceover/059.md) | [分镜](scripts/059.md) | [封面](covers/059.svg) | W-MORE | 否 |
| 060 | 摘要写回到文档最前 | 职场通用 | 28s | [配音](voiceover/060.md) | [分镜](scripts/060.md) | [封面](covers/060.svg) | W-ABOUT | 是 |
| 061 | 多文档摘要汇总 | 职场通用 | 30s | [配音](voiceover/061.md) | [分镜](scripts/061.md) | [封面](covers/061.svg) | W-TEXT | 否 |
| 062 | 摘要加批注留痕 | 职场通用 | 28s | [配音](voiceover/062.md) | [分镜](scripts/062.md) | [封面](covers/062.svg) | W-TEXT | 是 |

### F 翻译多语言（5 条）

| 编号 | 场景 | 受众 | 时长 | 配音稿 | 分镜 | 封面 | 主截图 | 需录屏 |
|---|---|---|---|---|---|---|---|---|
| 063 | 选中段落一键翻译 | 涉外办公 | 24s | [配音](voiceover/063.md) | [分镜](scripts/063.md) | [封面](covers/063.svg) | W-TEXT | 否 |
| 064 | 多语言目标语言切换 | 涉外办公 | 26s | [配音](voiceover/064.md) | [分镜](scripts/064.md) | [封面](covers/064.svg) | W-TEXT | 是 |
| 065 | 中英对照翻译 | 涉外办公 | 26s | [配音](voiceover/065.md) | [分镜](scripts/065.md) | [封面](covers/065.svg) | W-TEXT | 否 |
| 066 | 翻译保留术语与排版 | 涉外办公 | 28s | [配音](voiceover/066.md) | [分镜](scripts/066.md) | [封面](covers/066.svg) | W-TEXT | 否 |
| 067 | 整篇外文文档快速读懂 | 涉外办公 | 30s | [配音](voiceover/067.md) | [分镜](scripts/067.md) | [封面](covers/067.svg) | W-TEXT | 否 |

### G 知识库RAG（12 条）

| 编号 | 场景 | 受众 | 时长 | 配音稿 | 分镜 | 封面 | 主截图 | 需录屏 |
|---|---|---|---|---|---|---|---|---|
| 068 | 绑定企业知识库 | 政企IT | 30s | [配音](voiceover/068.md) | [分镜](scripts/068.md) | [封面](covers/068.svg) | W-KB | 否 |
| 069 | 三步连接自检测试连通 | 政企IT | 32s | [配音](voiceover/069.md) | [分镜](scripts/069.md) | [封面](covers/069.svg) | W-KB | 否 |
| 070 | 回答自动带引用 | 知识管理 | 32s | [配音](voiceover/070.md) | [分镜](scripts/070.md) | [封面](covers/070.svg) | W-KB | 是 |
| 071 | 一键下载引用原文 | 知识管理 | 30s | [配音](voiceover/071.md) | [分镜](scripts/071.md) | [封面](covers/071.svg) | W-KB | 是 |
| 072 | 结构化问答有几个用户 | 数据分析 | 32s | [配音](voiceover/072.md) | [分镜](scripts/072.md) | [封面](covers/072.svg) | C-KBNEW | 是 |
| 073 | 结构化问答订单总额是多少 | 数据分析 | 32s | [配音](voiceover/073.md) | [分镜](scripts/073.md) | [封面](covers/073.svg) | C-KBNEW | 是 |
| 074 | 外部向量库语义检索 | 研发 | 32s | [配音](voiceover/074.md) | [分镜](scripts/074.md) | [封面](covers/074.svg) | C-KBNEW | 是 |
| 075 | 五类知识源一站接入 | 知识管理 | 33s | [配音](voiceover/075.md) | [分镜](scripts/075.md) | [封面](covers/075.svg) | C-KBNEW | 否 |
| 076 | 客户端知识中心统一管理 | 知识管理 | 30s | [配音](voiceover/076.md) | [分镜](scripts/076.md) | [封面](covers/076.svg) | C-KBLIST | 否 |
| 077 | JWT个人账号连知识库 | 政企IT | 30s | [配音](voiceover/077.md) | [分镜](scripts/077.md) | [封面](covers/077.svg) | W-KB | 是 |
| 078 | HMAC部门共享账号连知识库 | 政企IT | 32s | [配音](voiceover/078.md) | [分镜](scripts/078.md) | [封面](covers/078.svg) | W-KB | 是 |
| 079 | 知识库失效自动自愈不报错 | 政企IT | 30s | [配音](voiceover/079.md) | [分镜](scripts/079.md) | [封面](covers/079.svg) | W-KB | 否 |

### H 批量处理（7 条）

| 编号 | 场景 | 受众 | 时长 | 配音稿 | 分镜 | 封面 | 主截图 | 需录屏 |
|---|---|---|---|---|---|---|---|---|
| 080 | 清理未使用的样式 | 通用办公 | 24s | [配音](voiceover/080.md) | [分镜](scripts/080.md) | [封面](covers/080.svg) | W-TEXT | 否 |
| 081 | 统计已使用样式 | 通用办公 | 22s | [配音](voiceover/081.md) | [分镜](scripts/081.md) | [封面](covers/081.svg) | W-TEXT | 否 |
| 082 | 一键删除空白行 | 通用办公 | 22s | [配音](voiceover/082.md) | [分镜](scripts/082.md) | [封面](covers/082.svg) | W-TEXT | 否 |
| 083 | 表格批量自动行宽 | 通用办公 | 26s | [配音](voiceover/083.md) | [分镜](scripts/083.md) | [封面](covers/083.svg) | W-TEXT | 是 |
| 084 | 按文字删表格行列 | 通用办公 | 26s | [配音](voiceover/084.md) | [分镜](scripts/084.md) | [封面](covers/084.svg) | W-TEXT | 是 |
| 085 | 图像批量加题注 | 通用办公 | 26s | [配音](voiceover/085.md) | [分镜](scripts/085.md) | [封面](covers/085.svg) | W-TEXT | 是 |
| 086 | 批量导出删除全部图像 | 通用办公 | 26s | [配音](voiceover/086.md) | [分镜](scripts/086.md) | [封面](covers/086.svg) | W-TEXT | 是 |

### I 多模态（5 条）

| 编号 | 场景 | 受众 | 时长 | 配音稿 | 分镜 | 封面 | 主截图 | 需录屏 |
|---|---|---|---|---|---|---|---|---|
| 087 | 文本转图像一键配图 | 创意办公 | 28s | [配音](voiceover/087.md) | [分镜](scripts/087.md) | [封面](covers/087.svg) | W-TEXT | 否 |
| 088 | 文本转语音生成音频 | 创意办公 | 28s | [配音](voiceover/088.md) | [分镜](scripts/088.md) | [封面](covers/088.svg) | W-ASSIST | 是 |
| 089 | 文本转视频生成短片 | 创意办公 | 30s | [配音](voiceover/089.md) | [分镜](scripts/089.md) | [封面](covers/089.svg) | W-TEXT | 否 |
| 090 | 多模态模型一处配置 | 政企IT | 28s | [配音](voiceover/090.md) | [分镜](scripts/090.md) | [封面](covers/090.svg) | W-DEFAULT | 否 |
| 091 | 图文一体生成 | 创意办公 | 28s | [配音](voiceover/091.md) | [分镜](scripts/091.md) | [封面](covers/091.svg) | W-DEFAULT | 是 |

### J 部署·信任·开源（9 条）

| 编号 | 场景 | 受众 | 时长 | 配音稿 | 分镜 | 封面 | 主截图 | 需录屏 |
|---|---|---|---|---|---|---|---|---|
| 092 | 完全离线本地模型运行 | 政企IT | 32s | [配音](voiceover/092.md) | [分镜](scripts/092.md) | [封面](covers/092.svg) | W-MODEL | 否 |
| 093 | 密钥与文档不出域 | 政企IT | 32s | [配音](voiceover/093.md) | [分镜](scripts/093.md) | [封面](covers/093.svg) | W-MODEL | 否 |
| 094 | 本地加云端模型混用 | 政企IT | 32s | [配音](voiceover/094.md) | [分镜](scripts/094.md) | [封面](covers/094.svg) | W-MODEL | 否 |
| 095 | 170多个模型自由选 | 职场通用 | 30s | [配音](voiceover/095.md) | [分镜](scripts/095.md) | [封面](covers/095.svg) | C-MARKET | 否 |
| 096 | 开源可审计Apache2.0 | 技术决策 | 30s | [配音](voiceover/096.md) | [分镜](scripts/096.md) | [封面](covers/096.svg) | W-ABOUT | 否 |
| 097 | 一套引擎四档形态 | 采购决策 | 33s | [配音](voiceover/097.md) | [分镜](scripts/097.md) | [封面](covers/097.svg) | C-HOME | 否 |
| 098 | 桌面版单机安装即用 | 个人用户 | 30s | [配音](voiceover/098.md) | [分镜](scripts/098.md) | [封面](covers/098.svg) | C-HOME | 否 |
| 099 | 服务版全科室共用 | 政企采购 | 33s | [配音](voiceover/099.md) | [分镜](scripts/099.md) | [封面](covers/099.svg) | C-KBLIST | 否 |
| 100 | 至臻版万人网络版 | 大型企业 | 34s | [配音](voiceover/100.md) | [分镜](scripts/100.md) | [封面](covers/100.svg) | C-HOME | 否 |

## 重新生成

```bash
node generate_covers.cjs   # 重出 100 张封面
node build_readme.cjs      # 重出本 README
```
