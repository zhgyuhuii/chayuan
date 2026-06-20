# 察元 AI · 100 条爆款短视频脚本包

> 一套面向政企/专业办公用户的产品宣传短视频脚本库。**爆款场景驱动**，每条 15–40s、竖屏 9:16，
> 适配抖音 / 视频号 / 小红书。脚本、封面、截图三者用**统一编号**强绑定，拿到即可录屏 / 剪辑。

- 产品：察元 AI（Chayuan AI）· WPS 加载项 v3.0.12 + 桌面 / 服务 / 至臻版
- 官网：https://aidooo.com ｜ 开源：Apache 2.0 ｜ 出品：北京智灵鸟科技中心
- 设计文档：`../docs/superpowers/specs/2026-06-20-chayuan-100-video-scripts-design.md`

## 目录结构与对应关系

| 资产 | 路径 | 说明 |
|---|---|---|
| 脚本 | `scripts/<编号>.md` | 100 条分镜脚本（钩子 / 痛点 / 分镜表 / CTA / 素材 / 可拍清单） |
| 封面 | `covers/<编号>.svg` | 9:16 竖版标题封面，可直接做视频首帧 / 缩略图 |
| 截图 | `assets/screenshots/<代码>.png` | 仓库现有真实界面截图的语义软链（见下方图例） |
| 清单 | `manifest.csv` | 编号→系列→场景→截图→需录屏 的机器可读映射 |

**编号即对应**：`scripts/072.md` ↔ `covers/072.svg` ↔ `manifest.csv` 第 072 行指定截图。

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

| 编号 | 场景 | 受众 | 时长 | 主截图 | 封面 | 需录屏 |
|---|---|---|---|---|---|---|
| [001](scripts/001.md) | 连夜核对公文段落序号一致性 | 政务文秘 | 30s | W-TEXT | [svg](covers/001.svg) | 否 |
| [002](scripts/002.md) | 红头文件密级一键自检 | 政务保密 | 32s | W-TEXT | [svg](covers/002.svg) | 是 |
| [003](scripts/003.md) | 涉密文档一键脱密 | 政务保密 | 33s | W-TEXT | [svg](covers/003.svg) | 是 |
| [004](scripts/004.md) | 脱密复原一键还原原文 | 政务保密 | 30s | W-TEXT | [svg](covers/004.svg) | 是 |
| [005](scripts/005.md) | 涉密关键词一键提取 | 政务保密 | 28s | W-MORE | [svg](covers/005.svg) | 否 |
| [006](scripts/006.md) | 政策公文风格一键改写 | 政务文秘 | 30s | W-MORE | [svg](covers/006.svg) | 否 |
| [007](scripts/007.md) | 内网离线也能用AI不出域 | 政企IT | 34s | W-MODEL | [svg](covers/007.svg) | 否 |
| [008](scripts/008.md) | 口语稿正式化改写成公文 | 政务文秘 | 28s | W-MORE | [svg](covers/008.svg) | 否 |
| [009](scripts/009.md) | 通知公告秒生成标题 | 政务文秘 | 22s | W-MORE | [svg](covers/009.svg) | 否 |
| [010](scripts/010.md) | 政策原文带引用问答 | 政务研究 | 33s | W-KB | [svg](covers/010.svg) | 是 |
| [011](scripts/011.md) | 会议纪要一键成稿 | 政务文秘 | 30s | W-MORE | [svg](covers/011.svg) | 否 |
| [012](scripts/012.md) | 提取领导讲话行动项 | 政务文秘 | 28s | W-MORE | [svg](covers/012.svg) | 否 |
| [013](scripts/013.md) | 长文档段落结构优化 | 政务文秘 | 28s | W-MORE | [svg](covers/013.svg) | 否 |
| [014](scripts/014.md) | 公文术语全文统一 | 政务文秘 | 28s | W-MORE | [svg](covers/014.svg) | 否 |
| [015](scripts/015.md) | 本地云端混用安全用AI | 政企IT | 34s | W-MODEL | [svg](covers/015.svg) | 否 |
| [016](scripts/016.md) | 文档审计逐条合规检查 | 政务审核 | 33s | W-AUDIT | [svg](covers/016.svg) | 是 |
| [017](scripts/017.md) | 涉密词占位替换加复原闭环 | 政务保密 | 35s | W-TEXT | [svg](covers/017.svg) | 是 |
| [018](scripts/018.md) | 政务知识库连接配置 | 政企IT | 32s | W-KB | [svg](covers/018.svg) | 否 |

### B 合同法务（12 条）

| 编号 | 场景 | 受众 | 时长 | 主截图 | 封面 | 需录屏 |
|---|---|---|---|---|---|---|
| [019](scripts/019.md) | 合同关键条款秒提取 | 法务 | 30s | W-MORE | [svg](covers/019.svg) | 是 |
| [020](scripts/020.md) | 合同字段结构化抽取入表 | 法务 | 33s | W-MORE | [svg](covers/020.svg) | 是 |
| [021](scripts/021.md) | 逐条款风险审计 | 法务 | 34s | W-AUDIT | [svg](covers/021.svg) | 是 |
| [022](scripts/022.md) | 合同模板规则校验 | 法务 | 32s | W-AUDIT | [svg](covers/022.svg) | 是 |
| [023](scripts/023.md) | 批量合同字段提取 | 法务 | 32s | W-AUDIT | [svg](covers/023.svg) | 是 |
| [024](scripts/024.md) | 提取合同结论与风险 | 法务 | 30s | W-MORE | [svg](covers/024.svg) | 否 |
| [025](scripts/025.md) | 法规知识库问答带引用 | 法务 | 33s | W-KB | [svg](covers/025.svg) | 是 |
| [026](scripts/026.md) | 合同条款通俗化解读 | 法务 | 28s | W-MORE | [svg](covers/026.svg) | 否 |
| [027](scripts/027.md) | 表单模式辅助填报 | 法务 | 30s | W-AUDIT | [svg](covers/027.svg) | 是 |
| [028](scripts/028.md) | 合同模板导入导出复用 | 法务 | 28s | W-AUDIT | [svg](covers/028.svg) | 否 |
| [029](scripts/029.md) | 法务知识库一键下载原文 | 法务 | 30s | W-KB | [svg](covers/029.svg) | 是 |
| [030](scripts/030.md) | 合同翻译保留法律术语 | 涉外法务 | 30s | W-TEXT | [svg](covers/030.svg) | 是 |

### C 标书投标（10 条）

| 编号 | 场景 | 受众 | 时长 | 主截图 | 封面 | 需录屏 |
|---|---|---|---|---|---|---|
| [031](scripts/031.md) | 标书赶工连夜扩写 | 投标 | 30s | W-TEXT | [svg](covers/031.svg) | 否 |
| [032](scripts/032.md) | 技术方案控篇幅缩写 | 投标 | 28s | W-TEXT | [svg](covers/032.svg) | 否 |
| [033](scripts/033.md) | 标书政策公文风格统一 | 投标 | 30s | W-MORE | [svg](covers/033.svg) | 否 |
| [034](scripts/034.md) | 提取评标结论与风险点 | 投标 | 30s | W-MORE | [svg](covers/034.svg) | 否 |
| [035](scripts/035.md) | 标书术语全文统一 | 投标 | 28s | W-MORE | [svg](covers/035.svg) | 否 |
| [036](scripts/036.md) | 招标文件知识库问答 | 投标 | 33s | W-KB | [svg](covers/036.svg) | 是 |
| [037](scripts/037.md) | 投标方案换种方式重写 | 投标 | 28s | W-TEXT | [svg](covers/037.svg) | 否 |
| [038](scripts/038.md) | 标书AI痕迹检查 | 投标 | 30s | W-TEXT | [svg](covers/038.svg) | 是 |
| [039](scripts/039.md) | 标书提炼关键词 | 投标 | 24s | W-TEXT | [svg](covers/039.svg) | 否 |
| [040](scripts/040.md) | 标书生成章节标题 | 投标 | 24s | W-MORE | [svg](covers/040.svg) | 否 |

### D 通用写作提效（14 条）

| 编号 | 场景 | 受众 | 时长 | 主截图 | 封面 | 需录屏 |
|---|---|---|---|---|---|---|
| [041](scripts/041.md) | 一句话换种方式重写 | 通用办公 | 24s | W-TEXT | [svg](covers/041.svg) | 否 |
| [042](scripts/042.md) | 内容不够一键扩写 | 通用办公 | 24s | W-TEXT | [svg](covers/042.svg) | 否 |
| [043](scripts/043.md) | 篇幅超了一键缩写 | 通用办公 | 24s | W-TEXT | [svg](covers/043.svg) | 否 |
| [044](scripts/044.md) | 全文润色优化 | 通用办公 | 26s | W-MORE | [svg](covers/044.svg) | 否 |
| [045](scripts/045.md) | 口语正式化改写 | 通用办公 | 26s | W-MORE | [svg](covers/045.svg) | 否 |
| [046](scripts/046.md) | 术语通俗化改写 | 通用办公 | 26s | W-MORE | [svg](covers/046.svg) | 否 |
| [047](scripts/047.md) | 一键纠正拼写和语法 | 通用办公 | 28s | W-TEXT | [svg](covers/047.svg) | 是 |
| [048](scripts/048.md) | AI痕迹检查降AI味 | 通用办公 | 30s | W-TEXT | [svg](covers/048.svg) | 是 |
| [049](scripts/049.md) | 一键提炼关键词 | 通用办公 | 22s | W-TEXT | [svg](covers/049.svg) | 否 |
| [050](scripts/050.md) | 看不懂的批注一键解释 | 通用办公 | 26s | W-TEXT | [svg](covers/050.svg) | 否 |
| [051](scripts/051.md) | 超链接内容一键解释 | 通用办公 | 24s | W-TEXT | [svg](covers/051.svg) | 否 |
| [052](scripts/052.md) | 长文一键生成标题 | 通用办公 | 22s | W-MORE | [svg](covers/052.svg) | 否 |
| [053](scripts/053.md) | 段落结构一键优化 | 通用办公 | 26s | W-MORE | [svg](covers/053.svg) | 否 |
| [054](scripts/054.md) | 选中即问右键加入AI助手 | 通用办公 | 26s | W-ABOUT | [svg](covers/054.svg) | 是 |

### E 摘要会议纪要（8 条）

| 编号 | 场景 | 受众 | 时长 | 主截图 | 封面 | 需录屏 |
|---|---|---|---|---|---|---|
| [055](scripts/055.md) | 长文档一键生成摘要 | 职场通用 | 28s | W-TEXT | [svg](covers/055.svg) | 否 |
| [056](scripts/056.md) | 管理层版摘要报告模式 | 管理层 | 30s | W-ASSIST | [svg](covers/056.svg) | 是 |
| [057](scripts/057.md) | 会议纪要一键成稿 | 职场通用 | 30s | W-MORE | [svg](covers/057.svg) | 否 |
| [058](scripts/058.md) | 提取会议行动项 | 职场通用 | 28s | W-MORE | [svg](covers/058.svg) | 否 |
| [059](scripts/059.md) | 提取结论与风险 | 管理层 | 30s | W-MORE | [svg](covers/059.svg) | 否 |
| [060](scripts/060.md) | 摘要写回到文档最前 | 职场通用 | 28s | W-ABOUT | [svg](covers/060.svg) | 是 |
| [061](scripts/061.md) | 多文档摘要汇总 | 职场通用 | 30s | W-TEXT | [svg](covers/061.svg) | 否 |
| [062](scripts/062.md) | 摘要加批注留痕 | 职场通用 | 28s | W-TEXT | [svg](covers/062.svg) | 是 |

### F 翻译多语言（5 条）

| 编号 | 场景 | 受众 | 时长 | 主截图 | 封面 | 需录屏 |
|---|---|---|---|---|---|---|
| [063](scripts/063.md) | 选中段落一键翻译 | 涉外办公 | 24s | W-TEXT | [svg](covers/063.svg) | 否 |
| [064](scripts/064.md) | 多语言目标语言切换 | 涉外办公 | 26s | W-TEXT | [svg](covers/064.svg) | 是 |
| [065](scripts/065.md) | 中英对照翻译 | 涉外办公 | 26s | W-TEXT | [svg](covers/065.svg) | 否 |
| [066](scripts/066.md) | 翻译保留术语与排版 | 涉外办公 | 28s | W-TEXT | [svg](covers/066.svg) | 否 |
| [067](scripts/067.md) | 整篇外文文档快速读懂 | 涉外办公 | 30s | W-TEXT | [svg](covers/067.svg) | 否 |

### G 知识库RAG（12 条）

| 编号 | 场景 | 受众 | 时长 | 主截图 | 封面 | 需录屏 |
|---|---|---|---|---|---|---|
| [068](scripts/068.md) | 绑定企业知识库 | 政企IT | 30s | W-KB | [svg](covers/068.svg) | 否 |
| [069](scripts/069.md) | 三步连接自检测试连通 | 政企IT | 32s | W-KB | [svg](covers/069.svg) | 否 |
| [070](scripts/070.md) | 回答自动带引用 | 知识管理 | 32s | W-KB | [svg](covers/070.svg) | 是 |
| [071](scripts/071.md) | 一键下载引用原文 | 知识管理 | 30s | W-KB | [svg](covers/071.svg) | 是 |
| [072](scripts/072.md) | 结构化问答有几个用户 | 数据分析 | 32s | C-KBNEW | [svg](covers/072.svg) | 是 |
| [073](scripts/073.md) | 结构化问答订单总额是多少 | 数据分析 | 32s | C-KBNEW | [svg](covers/073.svg) | 是 |
| [074](scripts/074.md) | 外部向量库语义检索 | 研发 | 32s | C-KBNEW | [svg](covers/074.svg) | 是 |
| [075](scripts/075.md) | 五类知识源一站接入 | 知识管理 | 33s | C-KBNEW | [svg](covers/075.svg) | 否 |
| [076](scripts/076.md) | 客户端知识中心统一管理 | 知识管理 | 30s | C-KBLIST | [svg](covers/076.svg) | 否 |
| [077](scripts/077.md) | JWT个人账号连知识库 | 政企IT | 30s | W-KB | [svg](covers/077.svg) | 是 |
| [078](scripts/078.md) | HMAC部门共享账号连知识库 | 政企IT | 32s | W-KB | [svg](covers/078.svg) | 是 |
| [079](scripts/079.md) | 知识库失效自动自愈不报错 | 政企IT | 30s | W-KB | [svg](covers/079.svg) | 否 |

### H 批量处理（7 条）

| 编号 | 场景 | 受众 | 时长 | 主截图 | 封面 | 需录屏 |
|---|---|---|---|---|---|---|
| [080](scripts/080.md) | 清理未使用的样式 | 通用办公 | 24s | W-TEXT | [svg](covers/080.svg) | 否 |
| [081](scripts/081.md) | 统计已使用样式 | 通用办公 | 22s | W-TEXT | [svg](covers/081.svg) | 否 |
| [082](scripts/082.md) | 一键删除空白行 | 通用办公 | 22s | W-TEXT | [svg](covers/082.svg) | 否 |
| [083](scripts/083.md) | 表格批量自动行宽 | 通用办公 | 26s | W-TEXT | [svg](covers/083.svg) | 是 |
| [084](scripts/084.md) | 按文字删表格行列 | 通用办公 | 26s | W-TEXT | [svg](covers/084.svg) | 是 |
| [085](scripts/085.md) | 图像批量加题注 | 通用办公 | 26s | W-TEXT | [svg](covers/085.svg) | 是 |
| [086](scripts/086.md) | 批量导出删除全部图像 | 通用办公 | 26s | W-TEXT | [svg](covers/086.svg) | 是 |

### I 多模态（5 条）

| 编号 | 场景 | 受众 | 时长 | 主截图 | 封面 | 需录屏 |
|---|---|---|---|---|---|---|
| [087](scripts/087.md) | 文本转图像一键配图 | 创意办公 | 28s | W-TEXT | [svg](covers/087.svg) | 否 |
| [088](scripts/088.md) | 文本转语音生成音频 | 创意办公 | 28s | W-ASSIST | [svg](covers/088.svg) | 是 |
| [089](scripts/089.md) | 文本转视频生成短片 | 创意办公 | 30s | W-TEXT | [svg](covers/089.svg) | 否 |
| [090](scripts/090.md) | 多模态模型一处配置 | 政企IT | 28s | W-DEFAULT | [svg](covers/090.svg) | 否 |
| [091](scripts/091.md) | 图文一体生成 | 创意办公 | 28s | W-DEFAULT | [svg](covers/091.svg) | 是 |

### J 部署·信任·开源（9 条）

| 编号 | 场景 | 受众 | 时长 | 主截图 | 封面 | 需录屏 |
|---|---|---|---|---|---|---|
| [092](scripts/092.md) | 完全离线本地模型运行 | 政企IT | 32s | W-MODEL | [svg](covers/092.svg) | 否 |
| [093](scripts/093.md) | 密钥与文档不出域 | 政企IT | 32s | W-MODEL | [svg](covers/093.svg) | 否 |
| [094](scripts/094.md) | 本地加云端模型混用 | 政企IT | 32s | W-MODEL | [svg](covers/094.svg) | 否 |
| [095](scripts/095.md) | 170多个模型自由选 | 职场通用 | 30s | C-MARKET | [svg](covers/095.svg) | 否 |
| [096](scripts/096.md) | 开源可审计Apache2.0 | 技术决策 | 30s | W-ABOUT | [svg](covers/096.svg) | 否 |
| [097](scripts/097.md) | 一套引擎四档形态 | 采购决策 | 33s | C-HOME | [svg](covers/097.svg) | 否 |
| [098](scripts/098.md) | 桌面版单机安装即用 | 个人用户 | 30s | C-HOME | [svg](covers/098.svg) | 否 |
| [099](scripts/099.md) | 服务版全科室共用 | 政企采购 | 33s | C-KBLIST | [svg](covers/099.svg) | 否 |
| [100](scripts/100.md) | 至臻版万人网络版 | 大型企业 | 34s | C-HOME | [svg](covers/100.svg) | 否 |

## 重新生成

```bash
node generate_covers.cjs   # 重出 100 张封面
node build_readme.cjs      # 重出本 README
```
