# 察元 AI 文档助手 · 重构与演进计划(plan.md)

> 文档版本:v1.0 · 2026-04-28
> 适用范围:`/work/chayuan` 当前主分支
> 编写视角:架构师 / 设计师 / UE / 用户使用 五合一
> 阅读对象:产品决策者、研发负责人、UI/UE 设计、测试与运维

---

## 0. 执行摘要(Executive Summary)

察元已具备一套**完整可用**的 WPS 文档 AI 加载项基线:Vue 3 + Vite,11 万行级代码量,29 个内置助手,28 个独立对话框,24 项 WPS 原生能力,模型供应商离线/云端两可,具备版本/回归/晋升的助手进化骨架。

**问题不在功能数量,而在三处工程债**:

1. **调度散弹枪**:Ribbon OnAction 大 switch、对话框、助手 runner、capabilityBus 四条平行通道,无统一关卡。
2. **跨窗口脆弱**:`window.opener.Application` 链脆 + Selection 在弹窗瞬间丢失,造成"对话框无法触发文档 API"概率性失败。
3. **首字符延迟过高**:`sendMessage` 链路最坏会串行 4 次 LLM 路由 + 180 处 `saveHistory` 同步落盘 + chunk 严格串行。

**北极星目标**:首字符延迟 ≤ 500ms,长文助手 ≤ 30s,所有能力同入口同关卡,体验上达到"AI 产品级"水平,继续保持公文/政企场景的稳定与合规底色。

> 建议六阶段(P0–P5)分批落地,P0 一周内可见效;详见第 12 节路线图。

---

## 目录

- [1. 现状盘点 · Ribbon 全部按钮](#1-现状盘点--ribbon-全部按钮)
- [2. 现状盘点 · 内置智能助手 29 项](#2-现状盘点--内置智能助手-29-项)
- [3. 现状盘点 · 能力总线 28 项](#3-现状盘点--能力总线-28-项)
- [4. 现状盘点 · 对话框路由 28 项](#4-现状盘点--对话框路由-28-项)
- [5. 现状盘点 · 持久化存储 14+ 处](#5-现状盘点--持久化存储-14-处)
- [6. 架构师视角:模块化与代码复用](#6-架构师视角模块化与代码复用)
- [7. 高性能设计:链路 A / 链路 B 全程提速](#7-高性能设计链路-a--链路-b-全程提速)
- [8. 设计师视角:视觉系统与界面重构](#8-设计师视角视觉系统与界面重构)
- [9. UE 视角:交互、动效、反馈](#9-ue-视角交互动效反馈)
- [10. 用户使用视角:真实场景 14 例](#10-用户使用视角真实场景-14-例)
- [11. 助手新增建议 · 18 个高价值内置](#11-助手新增建议--18-个高价值内置)
- [12. 实施路线图(P0–P5)](#12-实施路线图p0p5)
- [13. 验收指标与监控埋点](#13-验收指标与监控埋点)
- [14. 风险登记与底线](#14-风险登记与底线)

---

## 1. 现状盘点 · Ribbon 全部按钮

> 数据源:`public/ribbon.xml`(227 行)+ `src/components/ribbon.js:OnAction`(80+ case)

### 1.1 「察元AI助理」Tab(主 tab)

#### 1.1.1 关于(`groupAbout`)

| 控件 ID | label | 状态 | OnAction | 说明 |
|---|---|---|---|---|
| `btnAboutChayuan` | 关于察元AI助手 | ✅ 在用 | ShowDialog `/about-chayuan` | 720×640 |
| `btnAIWebsites` | AI网址大全 | ❌ XML 已注释 | ShowDialog `/popup` | 但 OnAction switch case 还在,**死代码** |
| `btnRequirementCollection` | 需求征集 | ❌ XML 已注释 | ShowDialog `/popup` | 同上 |
| `btnChayuanDiscussionGroup` | 察元讨论组 | ❌ XML 已注释 | — | XML 与 case 都没接 |

**🔧 改:** 删除 OnAction 内三个死 case;`Sep1` 分隔符可考虑去掉(只剩一个按钮,分隔无意义)。

#### 1.1.2 AI 助手(`groupAIAssistant`)— 重灾区

| 控件 ID | label | 状态 | 类型 | 说明 |
|---|---|---|---|---|
| `btnAIAssistant` | AI助手 | ✅ | size=large | `showAIAssistantDialog()` |
| `btnSpellGrammar` | 拼写与语法检查 | ✅ | size=large | `launchSpellCheckFromRibbon()` |
| `btnGenerateSummary` | 生成摘要 | ✅ | size=large | `executeAssistantFromRibbon('summary')` |
| `menuTextAnalysis` | 文本分析 | ✅ | menu | 下含 9 项(详见下表) |
| `menuTranslate` | 翻译 | ✅ | dynamicMenu | 语言列表来自配置 |
| `btnTextToImage` | 文本转图像 | ✅ | size=large | 走 `multimodal=image` |
| `btnTextToAudio` | 文本转语音 | ❌ XML 已注释 | size=large | OnAction case 还在 |
| `btnTextToVideo` | 文本转视频 | ✅ | size=large | 走 `multimodal=video` |
| `btnAssistantPrimarySlot1`–`Slot4` | 智能助手 | ⚠ 4 个 | size=large | 未配置时也显示成"智能助手",label 重复 |
| `menuMoreAssistants` | 更多 | ✅ | dynamicMenu | + 创建/管理助手两个固定项 |

`menuTextAnalysis` 下的 9 项:

| 控件 ID | label | 默认动作 |
|---|---|---|
| `btnRewrite` | 换种方式重写 | replace |
| `btnExpand` | 扩写 | insert |
| `btnAbbreviate` | 缩写 | replace |
| `btnParagraphNumberingCheck` | 检查段落序号格式 | link-comment |
| `btnAiTraceCheck` | AI 痕迹检查 | comment(**OnAction 中第 3188 行是空函数**)|
| `btnCommentExplain` | 批注解释 | link-comment |
| `btnHyperlinkExplain` | 超链接解释 | link-comment |
| `btnCorrectSpellGrammar` | 纠正拼写和语法 | comment |
| `btnExtractKeywords` | 提炼关键词 | insert |

**🔧 改:**
- `btnAITraceCheck` OnAction 实际为空(line 3188 注释 `// AI痕迹检查功能`),与 `btnAiTraceCheck` 同名但没走助手任务,需统一到 `executeAssistantFromRibbon('analysis.ai-trace-check')`。
- 4 个 PrimarySlot 在未配置时应**用 `OnGetVisible` 隐藏**而非显示重复 label,否则 Ribbon 视觉混乱。
- `btnTextToAudio` 既然 XML 注释了,OnAction case 也应清理。

#### 1.1.3 安全保密(`groupDocumentDeclassify`)

| 控件 ID | label | 走向 |
|---|---|---|
| `btnDocumentDeclassifyCheck` | 保密检查 | 助手 `analysis.security-check` |
| `btnDocumentDeclassify` | 文档脱密 | ShowDialog `/document-declassify-dialog` |
| `btnDocumentDeclassifyRestore` | 脱密复原 | ShowDialog `/document-declassify-restore-dialog` |

**🔧 改:** 这 3 项与"AI 助手"在同一 tab 平级,层级不当,**建议拆到独立 Tab「察元工具」**(详见 §8)。

#### 1.1.4 文档批量(`groupTextBatch`)

| 控件 ID | label | OnAction | 说明 |
|---|---|---|---|
| `btnSelectAllText` | 选中全部正文 | ❌ XML 已注释 | 死代码 |
| `btnCleanUnusedStyles` | 清理未使用的样式 | ✅ ShowDialog `/unused-styles-cleaner-dialog` | |
| `btnStyleStatistics` | 统计已使用样式 | ✅ ShowDialog `/style-statistics-dialog` | |
| `btnDeleteBlankRows` | 删除空白行 | ✅ 直接函数 | |

#### 1.1.5 批量操作(`groupTableImageBatch`)

##### 表格批量(`menuTableBatch`)14 项

| 控件 ID | label | 直接函数 / 对话框 |
|---|---|---|
| `btnSelectAllTables` | 导出全部表格 | `exportAllTablesToExcel()` |
| `btnDeleteAllTables` | 删除全部表格 | `deleteAllTables()` |
| `btnTableAutoWidth` | 根据内容自动行宽 | `autoFitAllTablesByContent()` |
| `btnWindowAutoWidth` | 根据窗口自动行宽 | `autoFitAllTablesByWindow()` |
| `btnAutoRefreshStyle` | 根据第一表格刷新样式 | `refreshOtherTablesStyleFromFirst()` |
| `btnDeleteTextRow` | 删除文字所在行 | `showDeleteTextDialog('row')` |
| `btnDeleteTextColumn` | 删除文字所在列 | `showDeleteTextDialog('column')` |
| `btnAppendReplaceText` | 追加替换文字 | ShowDialog `/append-replace-text` |
| `btnAddFirstColNumber` | 首列添加序号 | `addFirstColNumber()` |
| `btnManualColWidth` | 手动列宽度 | ShowDialog `/manual-col-width` |
| `btnFirstColStyle` | 第一列指定样式 | `showFirstColStyleDialog()` |
| `btnFirstRowStyle` | 第一行指定样式 | `showFirstRowStyleDialog()` |
| `btnAddTableCaption` | 添加表格题注 | ShowDialog `/table-caption` |
| `btnDeleteTableCaption` | 删除表格题注 | `deleteAllTableCaptions()` |

##### 图像批量(`menuImageBatch`)6 项

| 控件 ID | label | 直接函数 / 对话框 |
|---|---|---|
| `btnSelectAllImages` | 导出全部图像 | `exportAllImagesToFolder()` |
| `btnDeleteAllImages` | 删除全部图像 | `deleteAllImages()` |
| `btnUniformImageFormat` | 统一图像格式 | `showUniformImageFormatDialog()` |
| `btnClearImageFormat` | 清除图像格式 | ❌ OnAction 空函数(line 3333 仅注释) |
| `btnDeleteImageCaption` | 删除图像题注 | `deleteAllImageCaptions()` |
| `btnAddImageCaption` | 添加图像题注 | ShowDialog `/table-caption?mode=image` |

**🔧 改:** `btnClearImageFormat` 必须实现或删除,**否则用户点击毫无反应**——这是用户体感"软件偶尔没反应"的固定坑。

### 1.2 「察元AI编审」Tab

#### 1.2.1 表单辅助(`groupFormAssist`)

| 控件 ID | label | 走向 |
|---|---|---|
| `btnAssistFill` | 表单辅助填报(动态 label) | `getLabel` 走 `OnGetLabel` |
| `btnFormContentPreview` | 表单内容 | ShowDialog `/form-content-preview` |
| `btnDocumentAudit` | 文档审计 | ShowDialog `/form-audit-dialog` |

#### 1.2.2 模板管理(`groupModelEdit`)

| 控件 ID | label | 走向 |
|---|---|---|
| `btnSaveDocument` | 导出模板 | ShowDialog `/template-export-dialog` |
| `btnImportDocument` | 导入模板 | ShowDialog `/document-template-import` |
| `btnDownloadTemplate` | 下载模板 | ShowDialog `/template-download-dialog` |

#### 1.2.3 规则管理(`groupFormTemplate`)

| 控件 ID | label | 走向 |
|---|---|---|
| `btnTemplateCreate` | 规则制作 | ShowDialog `/template-create` |
| `btnTemplateImport` | 规则导入 | ShowDialog `/template-import-dialog` |
| `btnTemplateExport` | 导出规则 | ShowDialog `/template-export-dialog` |

#### 1.2.4 察元设置(`groupSettings`)

| 控件 ID | label | 走向 |
|---|---|---|
| `btnTaskList` | 任务清单 | ShowDialog `/popup` |
| `btnTaskOrchestration` | 任务编排 | ❌ XML 已注释,但 OnAction 有完整代码 |
| `btnSettings` | 设置 | ShowDialog `/settings` |

**🔧 改:** "任务编排"是有完整实现(`TaskOrchestrationDialog.vue` 213 KB)却被 XML 注释,**等于把已实现的高价值功能藏起来**。建议恢复或移到设置二级菜单。

### 1.3 右键菜单(`<contextMenus>`)

两套对称配置:`ContextMenuText`(正文/标题) + `ContextMenuTableCell`(表格单元格)。各 7 项:

| 控件 ID | label | 类型 |
|---|---|---|
| `btnAddToChayuanAssistant[TableCell]` | 添加到察元 / 添加到察元AI助手 | button |
| `menuContextTextAnalysis[TableCell]` | 察元AI文本分析 | dynamicMenu(主+次双层) |
| `menuContextTranslate[TableCell]` | 察元AI翻译 | dynamicMenu(主+次双层) |
| `btnContextAssistantSlot1–4[TableCell]` | 智能助手(动态绑定) | 4 个 button |
| `menuContextAssistantMore[TableCell]` | 更多智能助手 | dynamicMenu |

**🔧 改:** 同一组动作在两种上下文出现 7×2=14 个控件,代码无差。建议改为基于 `getVisible` 的同一套控件、按上下文显示不同 label。

### 1.4 Ribbon 总盘问题归纳

| 问题 | 影响 | 建议 |
|---|---|---|
| 主 tab 6 个 group 视觉拥挤 | 横向滚动条频繁出现 | 拆 3 tab(AI / 工具 / 编审) |
| 4 个 PrimarySlot 未绑定时显示"智能助手"重复 label | 视觉冗余 + 误点 | 用 `OnGetVisible` 隐藏未占用 slot |
| 5 个空函数 / 死 case | 用户点了没反应 | 全部实现或移除 |
| `btnTaskOrchestration` 完整实现却被注释 | 高价值功能不可见 | 恢复或挪入"设置→任务编排" |
| 注释掉的按钮 OnAction case 残留 | 维护负担、误回归 | 一并清理 |

---

## 2. 现状盘点 · 内置智能助手 29 项

> 数据源:`src/utils/assistantRegistry.js:165-1300`

### 2.1 核心系统类(6 项)

| ID | shortLabel | 默认动作 | 输入来源 | 模型类型 |
|---|---|---|---|---|
| `spell-check` | 拼写与语法检查 | `comment` | selection-preferred | chat,JSON 输出 |
| `summary` | 生成摘要 | `none` | selection-preferred | chat |
| `translate` | 翻译 | `replace` | selection-preferred | chat |
| `text-to-image` | 文本转图像 | `insert` | selection-preferred | image |
| `text-to-audio` | 文本转语音 | `none` | selection-preferred | audio |
| `text-to-video` | 文本转视频 | `none` | selection-preferred | video |

### 2.2 文本分析类(9 项 · Ribbon 主菜单常驻)

| ID | shortLabel | 默认动作 | 备注 |
|---|---|---|---|
| `analysis.rewrite` | 换种方式重写 | replace | 同义同长改写 |
| `analysis.expand` | 扩写 | insert | 不偏题补充 |
| `analysis.abbreviate` | 缩写 | replace | 保留关键信息 |
| `analysis.comment-explain` | 批注解释 | link-comment | 审校短评 |
| `analysis.hyperlink-explain` | 超链接解释 | link-comment | 引用解读 |
| `analysis.correct-spell` | 纠正拼写和语法 | comment | 整段修正(与 spell-check 互补) |
| `analysis.extract-keywords` | 提炼关键词 | insert | 主题词列表 |
| `analysis.paragraph-numbering-check` | 检查段落序号格式 | link-comment | 公文编号一致性 |
| `analysis.ai-trace-check` | AI 痕迹检查 | comment | 保守疑似度评估 |

### 2.3 安全 / 编审类(4 项)

| ID | shortLabel | 默认动作 |
|---|---|---|
| `analysis.security-check` | 保密检查 | link-comment |
| `analysis.secret-keyword-extract` | 涉密关键词提取 | comment |
| `analysis.form-field-extract` | 表单智能提取助手 | none(JSON) |
| `analysis.form-field-audit` | 文档审计助手 | comment |

### 2.4 风格 / 整理类(10 项 · 在「更多」菜单)

| ID | shortLabel | 默认动作 |
|---|---|---|
| `analysis.polish` | 润色优化 | replace |
| `analysis.formalize` | 正式化改写 | replace |
| `analysis.simplify` | 通俗化改写 | replace |
| `analysis.action-items` | 提取行动项 | insert |
| `analysis.risks` | 提取结论与风险 | insert |
| `analysis.term-unify` | 术语统一 | replace |
| `analysis.title` | 生成标题 | insert |
| `analysis.structure` | 段落结构优化 | insert |
| `analysis.minutes` | 生成会议纪要 | insert |
| `analysis.policy-style` | 政策/公文风格改写 | replace |

### 2.5 助手层观察

- **共 29 项**,远超同类(WPS 灵犀 8 项、Office Copilot 12 项)。
- 核心助手 6 项在 Ribbon 主区,**其他 23 项在 menu/right-click 内**,曝光不足。
- 默认动作分布:`replace` 9 项、`insert` 8 项、`comment/link-comment` 8 项、`none` 4 项,无 `insert-after`、无 `insert-before`(段前插入未实现)。
- **缺 `prepend-paragraph`(段前)和 `revise-track`(修订模式)** — 公文场景刚需。
- 缺**金融/法律/学术**专业类(详见 §11 助手新增)。

---

## 3. 现状盘点 · 能力总线 28 项

> 数据源:`src/utils/wpsCapabilityCatalog.js`(WPS 命名空间 24 项)+ `src/utils/utilityCapabilityNamespace.js`(utility 命名空间 4 项)

### 3.1 WPS 命名空间(`namespace=wps`)

| 类别 | capabilityKey | label |
|---|---|---|
| document-file | `save-document` | 保存文档 |
| document-file | `save-document-as` | 文档另存为 |
| document-file | `save-document-with-dialog` | 选择路径后另存 |
| document-security | `encrypt-document` | 加密文档 |
| document-security | `encrypt-document-with-dialog` | 选择路径后加密保存 |
| document-security | `decrypt-document` | 解密文档 |
| document-structure | `insert-table` | 插入表格 |
| document-structure | `insert-page-break` | 插入分页符 |
| document-structure | `insert-blank-page` | 插入空白页 |
| document-edit | `replace-selection-text` | 替换当前选中内容 |
| document-edit | `paste-text` | 插入文本 |
| document-edit | `append-text-to-document` | 追加文本到文末 |
| document-edit | `copy-current-paragraph` | 复制当前段落 |
| document-edit | `duplicate-selection-text` | 复制当前选中内容并插入 |
| document-format | `set-font-name` | 设置字体 |
| document-format | `set-font-size` | 设置字号 |
| document-format | `set-font-color` | 设置文字颜色 |
| document-format | `set-background-color` | 设置背景色 |
| document-format | `toggle-bold` | 设置加粗 |
| document-format | `toggle-italic` | 设置斜体 |
| document-format | `toggle-underline` | 设置下划线 |
| document-format | `set-alignment` | 段落对齐 |
| document-format | `set-line-spacing` | 设置行距 |

### 3.2 Utility 命名空间(`namespace=utility`)

| capabilityKey | label | 类别 |
|---|---|---|
| `render-template` | 模板渲染 | text |
| `replace-text` | 文本替换 | text |
| `regex-extract` | 正则提取 | text |
| `json-extract` | JSON 字段提取 | data |

### 3.3 能力总线问题归纳

- **覆盖严重不足**:Ribbon 80+ 个 OnAction 中,真正走 capabilityBus 的不到 1/3。
- **Declassify、form-audit、batch.table、batch.image、template、workflow、media** 等大业务模块**完全没注册成 namespace**。
- **assistantTaskRunner.applyDocumentAction 直接调用,旁路 Bus** — 不进策略 / 不进配额 / 不进审计。
- **缺类别**:`document-comment`(批注 CRUD)、`document-style`(样式 CRUD)、`document-toc`(目录)、`document-numbering`(编号)、`document-revision`(修订模式)。

---

## 4. 现状盘点 · 对话框路由 28 项

> 数据源:`src/router/index.js`

| 路径 | 名称 | 组件文件 | 文件大小 |
|---|---|---|---|
| `/` | 默认页 | `Root.vue` | 1 KB |
| `/dialog` | 对话框 | `Dialog.vue` | 2 KB |
| `/taskpane` | 任务窗格 | `TaskPane.vue` | 2 KB |
| `/taskpane-top` | 顶部任务窗口 | `TaskPaneTop.vue` | 1 KB |
| `/taskpane-bottom` | 底部任务窗口 | `TaskPaneBottom.vue` | 1 KB |
| `/taskpane-left` | 左侧任务窗口 | `TaskPaneLeft.vue` | 1 KB |
| `/taskpane-right` | 规则库 | `TaskPaneRight.vue` | **75 KB** |
| `/popup` | 任务清单 | `Popup.vue` | **237 KB** |
| `/task-orchestration` | 任务编排 | `TaskOrchestrationDialog.vue` | **214 KB** |
| `/spell-check-dialog` | 拼写与语法检查 | `TaskProgressDialog.vue`(共用) | — |
| `/task-progress-dialog` | 任务进度 | `TaskProgressDialog.vue` | 47 KB |
| `/manual-col-width` | 手动列宽 | `ManualColWidth.vue` | 6 KB |
| `/dialog-delete-text` | 删除文字所在行/列 | `DeleteTextDialog.vue` | 10 KB |
| `/append-replace-text` | 追加或替换文字 | `AppendReplaceText.vue` | 7 KB |
| `/dialog-first-col-style` | 第一列指定样式 | `FirstColStyleDialog.vue` | 13 KB |
| `/table-caption` | 添加或修改题注 | `TableCaptionDialog.vue` | 23 KB |
| `/dialog-uniform-image-format` | 统一图像格式 | `UniformImageFormatDialog.vue` | 18 KB |
| `/document-declassify-dialog` | 文档脱密 | `DocumentDeclassifyDialog.vue` | 15 KB |
| `/document-declassify-restore-dialog` | 密码复原 | `DocumentDeclassifyRestoreDialog.vue` | 6 KB |
| `/template-create` | 规则制作 | `TemplateCreate.vue` | 23 KB |
| `/template-form-dialog` | 添加/修改表单项 | `TemplateFormDialog.vue` | 16 KB |
| `/template-field-extract-dialog` | 智能提取 | `TemplateFieldExtractDialog.vue` | 27 KB |
| `/form-content-preview` | 表单内容预览 | `FormContentPreview.vue` | 12 KB |
| `/form-audit-dialog` | 文档审计 | `FormAuditDialog.vue` | 53 KB |
| `/form-edit-dialog` | 表单编辑 | `FormEditDialog.vue` | 26 KB |
| `/template-export-dialog` | 导出规则 | `TemplateExportDialog.vue` | 13 KB |
| `/template-import-dialog` | 规则导入 | `TemplateImportDialog.vue` | 6 KB |
| `/document-template-import` | 导入模板 | `DocumentTemplateImport.vue` | 7 KB |
| `/template-download-dialog` | 下载模板 | `TemplateDownloadDialog.vue` | 8 KB |
| `/settings` | 设置 | `SettingsDialog.vue` | **322 KB** |
| `/style-statistics-dialog` | 样式使用统计 | `StyleStatisticsDialog.vue` | 19 KB |
| `/unused-styles-cleaner-dialog` | 未使用样式清理 | `UnusedStylesCleanerDialog.vue` | 10 KB |
| `/ai-assistant` | AI 助手 | `AIAssistantDialog.vue` | **825 KB** |
| `/about-chayuan` | 关于察元 | `AboutChayuanPage.vue` | 1 KB(壳) |

### 4.1 对话框层观察

- **5 个超大单文件**:`AIAssistantDialog 825 KB / SettingsDialog 322 KB / Popup 237 KB / TaskOrchestrationDialog 214 KB / TaskPaneRight 75 KB`,合计 **1.7 MB 单文件**,占整个 components 的 70%。
- **没有共用 dialog 骨架**(头/尾/关闭/主操作),每个对话框自带一套样式,视觉漂移严重。
- **窗口管理 5 套并存**:`aiAssistantWindowManager`、`settingsWindowManager`、`taskListWindowManager`、`taskOrchestrationWindowManager`、`taskProgressWindowManager`,代码同形复制。

---

## 5. 现状盘点 · 持久化存储 14+ 处

> 全部基于 `localStorage`,key 命名前缀不统一

| key / 模块 | 用途 |
|---|---|
| `taskListStore` | 任务清单 |
| `workflowStore` | 工作流定义 |
| `artifactStore` | 产物(图/音/视频/文件) |
| `capabilityAuditStore` | 能力审计日志 |
| `capabilityQuotaStore` | 配额 |
| `capabilityPolicyStore` | 策略 |
| `assistantSettings` | 助手配置 |
| `assistantVersionStore` | 助手版本 |
| `assistantRegressionSampleStore` | 黄金样本(120 上限) |
| `chatMemoryStore` | 长期记忆 |
| `documentBackupStore` | 文档备份 |
| `documentDeclassifyStore` | 脱密映射 |
| `evaluationStore` | 评估记录 |
| `globalSettings` | 总配置 |
| `nd_ai_assistant_window_lock` | 窗口互斥 |
| `nd_ai_assistant_window_request` | 跨窗口指令 |
| `Application.PluginStorage` | WPS 宿主存储(模型、AddinBaseUrl、selectedModelIndex) |

### 5.1 存储层问题

- 14+ 个 store **各自手写 localStorage 读写、无统一版本号、无迁移机制**。
- 部分 key 用 `nd_` 前缀(早期 NeoDoc 残留),其他没前缀,**搜索/清理困难**。
- localStorage 同步阻塞主线程,会话长后单次 stringify 主线程阻塞 30–80 ms。
- **没有 store schema 校验**,坏数据进来后续解析连锁失败。

---

## 6. 架构师视角:模块化与代码复用

### 6.1 当前架构的三条平行通道(总根源)

```
A) Ribbon OnAction (80+ case) ─► 直接 documentActions/Format/...   ← 不走 Bus、不进策略
B) AIAssistantDialog 内部     ─► chatApi + assistantTaskRunner      ← 旁路 Bus
C) workflowRunner / TaskOrch  ─► capabilityBus.executeWpsCapability ← 唯一进 Bus 的通道
```

**结果**:同一个"插入表格",用户从 ribbon 触发不进策略,从任务编排触发会进。问题、审计、配额都不一致。

### 6.2 目标架构:hostBridge + capabilityBus + 主进程 op 队列

```
┌────────────────────────────────────────────────────────────────┐
│  src/utils/hostBridge.js (单例)                                │
│   getApp() / getDoc() / getSelection()                          │
│   snapshotSelection() → token{start,end,paragraphIndex,docName} │
│   restoreSelection(token) → Range                               │
│   withHostOp(fn, opts)  // 跨窗口 RPC,串行到主进程             │
└──────────────┬─────────────────────────────────────────────────┘
               │ (单一句柄入口)
               ▼
┌────────────────────────────────────────────────────────────────┐
│  src/utils/capabilityBus.js                                     │
│   register namespaces:                                          │
│    wps.*                  (现有 24 项)                          │
│    utility.*              (现有 4 项)                           │
│    declassify.*           ✦ 新增                                │
│    form-audit.*           ✦ 新增                                │
│    batch.table.*          ✦ 新增                                │
│    batch.image.*          ✦ 新增                                │
│    batch.text.*           ✦ 新增                                │
│    template.*             ✦ 新增                                │
│    media.*                ✦ 新增                                │
│    document-comment.*     ✦ 新增                                │
│    document-revision.*    ✦ 新增                                │
│    workflow.*             ✦ 新增                                │
└──────┬─────────────────────────────────────────────────┬────────┘
       │ policy.evaluate / quota.check / audit.append    │
       ▼                                                 ▼
documentActions      assistantTaskRunner             所有 dialog
documentFormatActions                                所有 ribbon OnAction
…                                                    所有 workflow
```

### 6.3 模块化设计建议

#### 6.3.1 目录重组(按业务域)

```
src/
├─ assets/
│  ├─ tokens.css         (设计 token,详见 §8)
│  └─ icons/             (统一 24×24 描边 svg)
├─ components/
│  ├─ ai/                (AI 对话相关)
│  │  ├─ AIAssistantShell.vue
│  │  ├─ ChatStream.vue
│  │  ├─ ChatBubble.vue
│  │  ├─ MessageEntryAnim.vue
│  │  ├─ SelectionContextChip.vue
│  │  ├─ IntentPill.vue
│  │  ├─ WriteBackBar.vue
│  │  └─ MultimodalPanel.vue
│  ├─ task/              (任务清单 / 进度 / 编排)
│  │  ├─ TaskList.vue
│  │  ├─ TaskProgress.vue
│  │  └─ TaskOrchestration.vue
│  ├─ form-audit/        (编审)
│  ├─ template/          (模板/规则)
│  ├─ declassify/        (脱密)
│  ├─ batch/             (文档/表格/图像批量)
│  └─ common/            (DialogShell、Stepper、CommandPalette、Skeleton…)
├─ ribbon/               (从单文件 ribbon.js 拆分)
│  ├─ customUiXml.js     (XML 生成)
│  ├─ onAction.js        (路由 → bus.execute)
│  ├─ icons.js
│  ├─ labels.js
│  └─ menus/
├─ utils/
│  ├─ host/              (hostBridge、windowManager 工厂)
│  ├─ capability/        (capabilityBus、各 namespace handler)
│  ├─ assistant/         (registry、runner、structuredPipeline、evolution)
│  ├─ document/          (actions、format、relocation、insert、delete、…)
│  ├─ workflow/
│  └─ store/             (Pinia 加载器、迁移器)
└─ skills/               ✦ 新建:外部能力插件目录(详见 §6.5)
```

#### 6.3.2 共用 DialogShell

```vue
<!-- src/components/common/DialogShell.vue -->
<template>
  <div class="dialog-shell" :class="{ adaptive: adaptive }">
    <header class="dialog-header">
      <slot name="title">{{ title }}</slot>
      <button class="dialog-close" @click="onClose">×</button>
    </header>
    <main class="dialog-body"><slot /></main>
    <footer class="dialog-footer"><slot name="footer" /></footer>
  </div>
</template>
```

28 个对话框统一改成 `<DialogShell>` 包裹,**视觉立刻一致、维护成本一次性下降**。

#### 6.3.3 统一 dialog 工厂 `showAdaptiveDialog`

替代散布的 `window.Application.ShowDialog(..., w*dpr, h*dpr, false)`:

```js
export function showAdaptiveDialog(routePath, query = {}, options = {}) {
  const w = clamp(options.minWidth || 640,
                  Math.floor((screen.availWidth || 1600) * (options.widthRatio || .5)),
                  options.maxWidth || 1400)
  const h = clamp(options.minHeight || 480,
                  Math.floor((screen.availHeight || 980) * (options.heightRatio || .55)),
                  options.maxHeight || 900)
  const url = buildHashUrl(routePath, query)
  if (window.Application?.ShowDialog) {
    window.Application.ShowDialog(url, options.title || '察元', w, h, false)
  } else {
    window.open(url, '_blank')
  }
}
```

#### 6.3.4 统一窗口 session 工厂

5 套 `*WindowManager` 收敛为:

```js
export function createDialogSession({ key, lockMs = 15000, onMessage }) {
  // 实现 lock + heartbeat + storage 通讯,单一来源
}
```

#### 6.3.5 状态管理迁移到 Pinia

- 安装 Pinia,把 14+ store 改为 Pinia store。
- 每个 store 加 `version` 字段 + `migrate(prev, next)` 钩子。
- 全部使用统一 prefix:`chayuan/v2/{store}/{key}`。
- 大数据(>100 KB)落 IndexedDB,小配置仍 localStorage。

#### 6.3.6 ribbon.js 拆分

- `customUiXml.js`:只生成 XML,根据当前模型/助手列表拼字符串。
- `onAction.js`:80+ case 改写为 `bus.execute(buttonIdToCapability[id], params)`,1 行替代 1 个 case。
- `labels.js`、`icons.js`、`menus/textAnalysis.js`、`menus/translate.js`、`menus/moreAssistants.js`。

### 6.4 代码复用机会清单

| 已重复的代码 | 出现次数 | 应该抽出 |
|---|---|---|
| `getApplication()` fallback | 11+ 处 | `hostBridge.getApp()` |
| `ShowDialog(url, title, w*dpr, h*dpr, false)` | 30+ 处 | `showAdaptiveDialog()` |
| `alert('xxx失败:' + (e?.message \|\| e))` | 30+ 处 | `showSafeErrorDetail()` |
| dialog footer "取消/确定" 按钮组 | 28 处 | `<DialogActions>` slot |
| dialog header "标题/×关闭" | 28 处 | `<DialogShell>` 默认 |
| 跨窗口 lock + heartbeat | 5 套 | `createDialogSession()` |
| `JSON.stringify + localStorage.setItem` | 14+ store | Pinia plugin |
| LLM 路由器(规则 + 模型) | 5+ 处 | `unifiedRouter(text, options)` |
| chunk 循环串行调用 | 3+ 处 | `runChunksConcurrently(chunks, n)` |
| try/catch + showSafeErrorDetail + console.error | 50+ 处 | `withErrorBoundary(fn)` 装饰器 |

### 6.5 能力插件化(P3 远期)

把 namespace 升级为**可第三方扩展的 plugin**:

```
src/skills/
├─ core/                (内置)
├─ user/                (用户自建,可导入导出 .aidooo)
└─ market/              (官方应用市场,P5)
```

每个 skill 是一个目录:
```
my-skill/
├─ skill.json           (manifest:id、name、version、capabilities)
├─ handler.js           (execute(key, params))
├─ ui.vue               (可选,设置面板)
└─ icon.svg
```

`capabilityBus.registerCapabilityNamespace` 已经支持,把这层做成**目录扫描自动注册**即可。这是把"自定义助手"从单点扩展升级为**生态扩展**的关键一步。

---

## 7. 高性能设计:链路 A / 链路 B 全程提速

### 7.1 关键瓶颈实测(基于代码审计)

#### 链路 A:回车 → 首字符(`AIAssistantDialog.sendMessage`)

| 阶段 | 当前耗时 | 来源 |
|---|---|---|
| `prepareOutgoingMessages` 同步抓 selection + 全文 | 50–300 ms | `documentContext.getSelectionContextSnapshot` 抓 `Content.Text` |
| `saveHistory` 同步序列化 | 30–80 ms | 整个 chatHistory `JSON.stringify` |
| LLM 路由 1:`resolvePrimaryConversationIntent` | 600–2500 ms | `chatCompletion stream:false` |
| LLM 路由 2(条件):`resolveWpsCapabilityRoute` | 600–2500 ms | 同上 |
| LLM 路由 3(条件):`inferDocumentOperationRouteWithModel` | 600–2500 ms | 同上 |
| LLM 路由 4(条件):`inferAssistantRecommendationWithModel` | 600–2500 ms | 同上 |
| 真正的 `streamChatCompletion` 首字符 | 200–800 ms | TLS + 模型首 token |
| **首字符总延迟** | **2.5 ~ 11 s** | 严重串行堆叠 |

#### 链路 B:助手执行 → 写回完成(`assistantTaskRunner.runChunks*`)

| 阶段 | 当前耗时 | 来源 |
|---|---|---|
| `getDocumentChunksWithPositions` | 100–500 ms | 全文遍历段落 |
| chunk × 单段 LLM(stream:false) | n × 1–4 s | `for-await` 严格串行 |
| 结构化 pipeline 二次评估 | n × 0.5–2 s | `assessStructuredBatchQuality` |
| `applyParagraphResultsAction` 逐段 `range.Text=` | n × 5–20 ms | COM round-trip |
| 屏幕重排 | 全程 | 没有关闭 ScreenUpdating/Repagination |
| **10 段摘要总耗时** | **35–60 s** | 串行 + COM 重排 |

### 7.2 提速方案矩阵

| 编号 | 方案 | 工作量 | 链路 A 收益 | 链路 B 收益 | 实施位置 |
|---|---|---|---|---|---|
| **A1** | 乐观流式 + abort 中断 | 中 | -2–4 s | — | `AIAssistantDialog.sendMessage` |
| **A2** | 路由模型解耦到本地小模型 / haiku-4.5 | 小 | -1–3 s | — | `chatApi`、设置项 |
| **A3** | 路由判定全部并行(`Promise.all`) | 小 | -1–2 s | — | `resolvePrimaryConversationIntent` |
| **A4** | 本地正则/Bayes 分类器替代 LLM(命中阈值 > .85) | 中 | -1.5 s 平均 | — | 新增 `localIntentClassifier` |
| **A5** | `saveHistory` 节流 + 增量切片 + IndexedDB | 中 | -50 ms 平均 | -50 ms 平均 | 替换全部 180 处 |
| **A6** | selection / document text 惰性化 | 小 | -50–300 ms | — | `documentContext` |
| **A7** | 启动 prefetch(模型探活、chunk 缓存) | 小 | -100–300 ms 首次 | -100 ms 首次 | App.vue / mounted |
| **A8** | localFaq 提到最前 | 极小 | 命中时 -2 s | — | 调整顺序 |
| **B1** | chunk 并发池(默认 4) | 中 | — | -60–80% | `assistantTaskRunner` |
| **B2** | chunk 流式 + 边到边写回(comment/insert-after) | 大 | — | 体感 -90% | `applyParagraphResultsAction` |
| **B3** | 二次评估按需做(规则替代) | 小 | — | -10–20% | `assistantStructuredPipeline` |
| **B4** | prompt caching(Anthropic / OpenAI / DeepSeek) | 小 | -100 ms / req | -30–50% / chunk | `chatApi.buildBody` |
| **B5** | 小模型预筛 + 大模型精修(级联) | 中 | — | -70–85% 全文类 | 新增 `cascadeRouter` |
| **B6** | documentChunker 按文档指纹缓存 | 小 | — | -100 ms / 任务 | `documentChunker` |
| **B7** | 写回时关 ScreenUpdating + Repagination | 极小 | — | -80–90% 写回 | `applyDocumentAction` 包装 |
| **B8** | 撤销栈合并(开始 UndoClear,结束插标记) | 小 | — | 体验 ↑ | 同上 |
| **B9** | structured outputs(`response_format: json_schema`) | 小 | — | -10% + 解析失败率 ↓ | `chatApi` |
| **B10** | 任务进度 update 节流 + BroadcastChannel | 小 | -10 ms / 步 | -10 ms / 步 | `taskListStore` + 进度对话框 |

### 7.3 性能预期

| 场景 | 当前(p50) | 优化后(p50) | 提速 |
|---|---|---|---|
| 普通闲聊(规则 high) | 1.5 – 4 s | 0.2 – 0.5 s | **8x** |
| 改写当前段 | 3 – 8 s | 0.8 – 1.5 s | **5x** |
| WPS 直接操作 | 2 – 6 s | 0.3 – 0.8 s | **7x** |
| 助手任务 | 4 – 10 s | 1.2 – 2.5 s | **4x** |
| 短文(1 段)改写 | 4 s | 1.5 s | **2.7x** |
| 长文(10 段)摘要 | 40 s | 8 – 12 s | **4x** |
| 全文(50 段)拼写检查 | 200 s | 25 – 30 s | **7x** |
| 全文(50 段)结构化批注 | 250 s | 35 – 45 s | **6x** |

### 7.4 关键代码改造点

#### 7.4.1 乐观流式核心代码(A1)

```js
// AIAssistantDialog.vue (sendMessage 重构)
async sendMessage() {
  const text = this.userInput.trim()
  if (!text || this.isStreaming) return
  const prepared = await this.prepareOutgoingMessagesFast(text)  // 仅抓 selection token
  if (!prepared) return
  const { assistantMsg } = prepared
  
  // ① 立刻乐观启动兜底流式
  const optimisticCtrl = new AbortController()
  let optimisticAccepted = false
  const optimisticPromise = streamChatCompletion({
    ...buildChatBody(text, this.selectedModel, this.recentMessages),
    signal: optimisticCtrl.signal,
    onChunk: chunk => {
      if (optimisticAccepted) this.appendToMessage(assistantMsg, chunk)
      else this.bufferOptimisticChunk(assistantMsg, chunk)
    }
  })
  
  // ② 并行跑路由(快路由器,默认 haiku/qwen-3b)
  const intent = await this.resolvePrimaryConversationIntentFast(text, this.routerModel)
  
  if (intent.kind === 'chat' || intent.kind === 'generated-output') {
    optimisticAccepted = true
    this.flushOptimisticBuffer(assistantMsg)
    await optimisticPromise
    return
  }
  
  // ③ 路由非 chat,abort 兜底
  optimisticCtrl.abort()
  this.discardOptimisticDraft(assistantMsg)
  
  // ④ 进入对应专用链路(并行启动子路由)
  switch (intent.kind) {
    case 'wps-capability':    return this.handleWpsCapabilityFast(text, prepared)
    case 'document-operation':return this.handleDocumentOpFast(text, prepared)
    case 'assistant-task':    return this.handleAssistantTaskFast(text, prepared)
  }
}
```

#### 7.4.2 chunk 并发池(B1)

```js
// utils/concurrentRunner.js (新建)
export async function runConcurrently(items, worker, { concurrency = 4, onProgress } = {}) {
  const results = new Array(items.length)
  let cursor = 0, completed = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await worker(items[i], i)
      } catch (e) {
        results[i] = { error: e }
      }
      completed++
      onProgress?.(completed, items.length)
    }
  })
  await Promise.all(workers)
  return results
}
```

#### 7.4.3 写回前 ScreenUpdating off(B7)

```js
// utils/document/withScreenLock.js
export function withScreenLock(fn) {
  const app = getApplication()
  if (!app) return fn()
  const screen = app.ScreenUpdating
  let repagination = null
  try {
    repagination = app.ActiveDocument?.Repagination
    app.ScreenUpdating = false
    if (app.ActiveDocument) app.ActiveDocument.Repagination = false
    return fn()
  } finally {
    try { if (repagination !== null && app.ActiveDocument) app.ActiveDocument.Repagination = repagination } catch (_) {}
    try { app.ScreenUpdating = screen } catch (_) {}
  }
}
```

`applyParagraphResultsAction`、`applyStructuredExecutionPlan`、批量类操作全部包一层。

---

## 8. 设计师视角:视觉系统与界面重构

### 8.1 设计基调

「**砚墨青 + 朱砂提示 + 流光**」 ── 中文公文气质 + 现代 AI 产品高级感。

参考案例:**Apple Intelligence**(流光)、**Linear**(极简呼吸)、**Raycast**(键盘文化)、**Cursor**(上下文芯片)、**Vercel/Stripe**(网格美学)、**Arc Browser**(物理感),拒绝消费级 App 廉价霓虹。

### 8.2 设计 Token

完整 token 见 `src/assets/tokens.css`(新增):

```css
:root {
  /* 砚青主色 */
  --chy-brand-50:#EEF4FF; --chy-brand-500:#4A6CF7; --chy-brand-600:#3A56D4;
  --chy-brand-glow:#6B8AFF;
  /* 辅色:朱砂红 / 青釉绿 / 姜黄 / 远黛紫 */
  --chy-rouge:#E1473C; --chy-celadon:#3FAE82; --chy-amber:#E89B2B; --chy-violet:#8B5CF6;
  /* 暖灰阶 */
  --chy-ink-900:#0F1115; --chy-ink-700:#2B2F38; --chy-ink-500:#5E6470;
  --chy-ink-300:#C8CCD3; --chy-paper-50:#FAFAFA;
  /* 玻璃 */
  --chy-glass-bg:rgba(250,250,252,.72); --chy-glass-stroke:rgba(255,255,255,.55);
  --chy-glass-blur:18px;
  /* 阴影三层 */
  --chy-elev-1:0 1px 2px rgba(15,17,21,.04),0 0 0 1px rgba(15,17,21,.06);
  --chy-elev-2:0 4px 14px rgba(15,17,21,.08),0 0 0 1px rgba(15,17,21,.04);
  --chy-elev-3:0 24px 48px rgba(15,17,21,.18),0 0 0 1px rgba(255,255,255,.08);
  /* AI 流光渐变 */
  --chy-gradient-ai:conic-gradient(from var(--ai-angle,0deg),
    #4A6CF7,#8B5CF6,#E1473C,#E89B2B,#3FAE82,#4A6CF7);
  /* 字体 */
  --font-display:'Noto Serif SC','Source Han Serif SC',serif;
  --font-ui:'HarmonyOS Sans SC','PingFang SC',system-ui,sans-serif;
  --font-mono:'JetBrains Mono','SF Mono',Consolas,monospace;
  /* 圆角 / 间距 8 点制 */
  --r-1:4px; --r-2:6px; --r-3:10px; --r-4:14px; --r-5:20px;
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px; --s-6:32px;
}
@media (prefers-color-scheme:dark){
  :root{ --chy-paper-50:#0E1015; --chy-ink-900:#F2F4F8;
         --chy-glass-bg:rgba(20,22,28,.62); --chy-glass-stroke:rgba(255,255,255,.08); }
}
```

### 8.3 Ribbon 重排:三 Tab 方案

| 旧(2 tab) | 新(3 tab) |
|---|---|
| 察元AI助理(关于+AI助手+保密+批量+表格图像批量,6 group 拥挤) | **察元AI**(关于、AI 主对话、文本分析、翻译、多模态、助手槽位) |
| 察元AI编审(表单+模板+规则+设置) | **察元工具**(安全保密、文档批量、表格批量、图像批量) |
| | **察元编审**(表单填报、文档审计、模板管理、规则管理、任务清单/编排、设置) |

视觉收益:每 tab 4 个 group 内,横向滚动条消失,信息密度回到 Office 推荐。

### 8.4 主对话框三栏

```
┌─ 56px Rail ─┬──────────── 1fr 主流 ────────────┬── 320px 抽屉 ──┐
│  💬 历史    │   ┌─ 助手芯片 + 模型芯片 ─┐       │  📎 选区上下文 │
│  🤖 助手    │   │ ⓘ 已选中:第3段·86字 │       │  ✏ 写回方式   │
│  📋 任务    │   └─────────────────────┘       │  👁 预演 dryRun│
│  ⚙ 设置     │   ...气泡 max-width 680px...   │  📦 引用/产物  │
│  ───        │                                  │                │
│  +          │   ┌────────────────────────┐    │                │
│             │   │ [意图] 你的输入_       │    │                │
│             │   └────────────────────────┘    │                │
│             │   工具条:[模型][📎][🎨][发送]  │                │
└─────────────┴──────────────────────────────────┴────────────────┘
```

### 8.5 关键视觉元素

#### 8.5.1 AI 流光边框(对话框思考态)

```css
.ai-assistant-dialog[data-ai-state="thinking"]::before,
.ai-assistant-dialog[data-ai-state="streaming"]::before {
  content:''; position:absolute; inset:-2px; border-radius:inherit;
  padding:2px; background:var(--chy-gradient-ai);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude;
  animation:ai-rotate 4s linear infinite; filter:blur(.4px);
}
@keyframes ai-rotate{ to{ --ai-angle:360deg; } }
@property --ai-angle{ syntax:'<angle>'; inherits:false; initial-value:0deg; }
```

#### 8.5.2 进度条 shimmer(任务进度)

```css
.progress-bar{
  height:3px; border-radius:3px;
  background:linear-gradient(90deg,
    var(--chy-brand-500) 0%,var(--chy-brand-glow) 50%,var(--chy-brand-500) 100%);
  background-size:200% 100%;
  animation:progress-shimmer 1.6s linear infinite;
}
@keyframes progress-shimmer{ to{ background-position:-200% 0; } }
```

#### 8.5.3 完成扫光(任务结束 1 次)

任务完成瞬间,整个面板从左到右扫过 8% 透明度青釉绿,800ms,然后折叠为 mini-toast`已替换 1 段 · 撤销 ↶ · 跳转 →`。

#### 8.5.4 Selection Chip(Cursor 同款)

```
[📄 第3段·86字 ×]  [🧩 选区扩展±2段 ×]  [📊 全文统计 ×]  [+ 添加]
```

每个 chip 浅青胶囊 + 类型图标 + 字数;空状态显示虚线"📍 拖入文档片段或点击扩展上下文"。

#### 8.5.5 Intent Pill(意图标签)

输入框左内侧:`[💬 对话]`(灰)/`[⚡ 操作]`(青)/`[🤖 助手]`(紫)。按 `Tab` 在三种意图间循环,液体形变切换。

#### 8.5.6 Diff 预演卡

```
┌─────────────────────────────────────────┐
│ 将在 第 3 段 · 第 142–186 字 替换       │
├─────────────────────────────────────────┤
│ - 现將該事項列入議程，請各位審議。      │ 浅红描边
│ + 现将该事项列入议程，请各位审议。      │ 浅绿描边
├─────────────────────────────────────────┤
│ [↶ 关闭]              [✓ 应用到文档]   │
└─────────────────────────────────────────┘
```

入场:标题→旧文→新文→按钮 stagger 80 ms;同步滚到主文档对应位置。

### 8.6 命令面板 ⌘K(P2 必上)

Raycast 同款。把现今分散在 Ribbon、右键菜单、对话框里的 80+ 操作收敛到一个搜索入口:

```
┌────────────────────────────────────────────┐
│ 🔍  扩写第 3 段_                           │ 56px 大输入
├────────────────────────────────────────────┤
│  ⚡ 直接操作                                │
│   加粗当前段                    Ctrl+B     │
│   插入分页符                                │
│  🤖 助手                                    │
│   扩写            (上次用 32 秒前)         │
│   缩写                                      │
│  📂 任务                                    │
│   3 个运行中 → 跳转任务清单                │
└────────────────────────────────────────────┘
```

### 8.7 子对话框统一骨架

`<DialogShell>` + `<DialogActions>`,28 个对话框一处改全局生效,详见 §6.3.2。

### 8.8 暗色模式

跟随系统(若 WPS 暴露 `Application.SystemTheme` 则跟随宿主),覆盖 token,28 个对话框无需逐个改。

---

## 9. UE 视角:交互、动效、反馈

### 9.1 交互三原则

1. **所问即所答**:用户每次输入,意图标签预告;每次执行,先预演再写回。
2. **静默 90%、惊艳 10%**:日常工作流极简;首次相遇、任务完成、错误降级、AI 思考 4 个时刻给情绪反馈。
3. **可关闭的炫酷**:设置中提供"克制 / 标准 / 华丽"三档动效;`prefers-reduced-motion` 自动降级。

### 9.2 微交互清单

| 触发 | 反馈 |
|---|---|
| 用户回车 | 输入框收回 + 用户气泡飞入(180ms 弹簧)+ AI 流光边框启动 |
| 助手开始流式 | 紫色直条光标(2×16px,800ms 呼吸)|
| 助手结束 | 流光边框 1.2s 平滑收回 + 1 道扫光 |
| 拼写检查 0 错误 | 气泡内"✦"轻微闪光(Apple Mail 同款) |
| 拼写检查 ≥ 1 | 数字徽标弹跳入场(scale 1→1.2→1, 240ms) |
| 任务完成 | 进度面板从左到右扫光 + 折叠 mini-toast |
| 错误降级(替换→批注) | 右上角琥珀色小灯笼 toast,3s 自动收纳 |
| 拖段落到 chip 区 | 抽屉边缘流光 + 内部目标圆环 |
| 删除/退出会话 | 卡片 liquify 反向收缩 |
| 首次连接本地 Ollama 成功 | 模型菜单图标后浅绿圆点膨胀消失 |
| 任务取消 | 进度条从右往左液化收缩 |
| 复活节彩蛋 | 输入"水墨"→ 1 秒水墨晕染淡入淡出 |

### 9.3 错误反馈统一化

所有 ribbon 内的 30+ 处 `alert(e?.message)` 替换为 `showSafeErrorDetail({ title, detail })`,并附带:

- 当前 capabilityKey
- selectionToken
- 时间戳
- requestId(用于复盘)
- 一键"复制完整诊断信息"按钮

### 9.4 关键交互改造点

| 现状 | 改造 |
|---|---|
| 4 个 PrimarySlot 未配置时 label 重复 | `OnGetVisible` 隐藏未占用 |
| `btnAITraceCheck`、`btnClearImageFormat` 等空函数 | 实现或删除 |
| `assistantEvolutionSuggestion` banner 常驻 | 收为右上小气泡,只在主动建议时弹出 |
| 助手进化建议 banner 100+ 行 DOM | 改为对决面板(详见 §9.5) |
| 欢迎页放 3 张二维码 | 移到左下"支持我们"折叠按钮 |
| dialog 尺寸写死 `w*dpr h*dpr` | 改 `showAdaptiveDialog` 自适应 |
| TaskProgressDialog 单行进度条 | 改 stepper + shimmer + 扫光(详见 §8.5) |

### 9.5 助手进化对决面板(替代 banner)

```
┌──────────────── 进化对决 · 拼写检查 ────────────────┐
│   1.4.2(当前)        VS         1.5.0(候选)      │
│   ─────────                      ─────────          │
│   R 92 ━━━━━━━━━━              R 95 ━━━━━━━━━━     │
│   A 61 ━━━━━━─────              A 84 ━━━━━━━━── ✦ │
│   C 88 ━━━━━━━━━─              C 89 ━━━━━━━━━─     │
│   E 85 ━━━━━━━━━─              E 80 ━━━━━━━━──     │
│                                                     │
│   30 天:1402 次 / 134 ❌ ──► 影子:12 ❌           │
│                                                     │
│   样本对比                                           │
│   "请将该议题列入议程"                              │
│     1.4.2 ❌ 漏报"该"近形误字                       │
│     1.5.0 ✓ 正确识别                                 │
│                                                     │
│   [回滚 1.4.2] [继续影子 7 天] [立即晋升 1.5.0 ➜] │
└─────────────────────────────────────────────────────┘
```

入场:两边卡片左右对撞 1 次;柱状图 stagger 增长。

### 9.6 键盘快捷键

| 快捷键 | 动作 |
|---|---|
| `⌘ K / Ctrl K` | 打开命令面板(全局) |
| `⌘ Enter / Ctrl Enter` | 发送(对话框) |
| `⌘ / / Ctrl /` | 切换 Intent Pill |
| `⌘ J / Ctrl J` | 切到选区上下文 |
| `⌘ ; / Ctrl ;` | 切到写回方式 |
| `⌘ Z` | 撤销最近 AI 写回(走 WPS Undo) |
| `Esc` | 中断流式 / 关闭命令面板 |
| `↑ ↓` | 命令面板上下选 |

### 9.7 a11y / 国际化

- 所有按钮 `aria-label`(动态助手按钮当前都是 label="智能助手",a11y 等于失明)。
- 焦点环显式(当前 `outline:0` 屏蔽了)。
- 抽出 `i18n/zh-CN.json` 为基础,代码用 `$cdt()` 包一层。

---

## 10. 用户使用视角:真实场景 14 例

> 每个场景给出"现状体验" + "目标体验",作为 PRD 验收用例

### 10.1 政府办公员小张 — 起草通知

- **现状**:打开 AI 助手 → 选段 → 点改写 → 按下回车 → 对话框白屏 5 秒 → 出结果 → 不知道怎么写回 → 复制粘贴。
- **目标**:打开 AI 助手 → 选段(Selection token 已自动快照) → Intent 显示`[🤖 助手:改写]` → 回车 0.4 秒首字符 → 流式输出同时右抽屉显示"将替换第 3 段" → 点"应用"完成,撤销栈合并为 1 步。

### 10.2 法务专员小李 — 合同审核

- **现状**:用文档审计助手,跑全文 50 段,等待 4 分钟,中间不知道进度。
- **目标**:文档审计 4 并发跑 → 1 分钟内完成 → 每段完成立即在文档标红高亮 → 抽屉里逐条显示风险 → 一键跳转。

### 10.3 编审人员小王 — 公文校对

- **现状**:跑拼写与语法检查,模型偶尔 JSON 解析失败,任务报错"原片段未命中"。
- **目标**:`response_format: json_schema` 强约束 + originalText 锚定降级到整句 → 即使个别样本失败也有整句批注 → 健康分实时监控。

### 10.4 高校老师小陈 — 论文润色

- **现状**:用润色助手,选了 8 段一段一段跑,每段都要重新读全文上下文。
- **目标**:8 段并发 + prompt caching → 总耗时 ÷ 4。

### 10.5 出版编辑小赵 — 翻译

- **现状**:翻译需要术语统一,但要跑两次助手(翻译 + 术语统一),来回切换。
- **目标**:任务编排"翻译 → 术语统一"流程化;一键运行;支持分批人工复核闸门。

### 10.6 投标专员小钱 — 标书一致性

- **现状**:50 万字标书,逐章节运行多个助手,任务清单乱成一团。
- **目标**:任务清单按状态/入口/关键字过滤;待写回任务高亮;一键批量"应用全部"。

### 10.7 涉密单位小孙 — 文档脱密

- **现状**:脱密对话框打开慢,提取关键词 30 秒;复原时要找映射文件,容易丢。
- **目标**:脱密对话框骨架化 + 小模型预筛大模型精判 → 提取 5 秒;映射文件加密保存到 PluginStorage,自动备份到 dataDir。

### 10.8 项目经理小周 — 会议纪要

- **现状**:会后录音转文字 5 千字,粘贴到 AI 助手,跑会议纪要助手,不知道哪些是行动项哪些是结论。
- **目标**:会议纪要助手输出 JSON schema(主题/结论/行动项/风险/时间线);在抽屉里以卡片矩阵展示;一键导出到 OA 系统。

### 10.9 设计师小吴 — 文稿配图

- **现状**:文转图按钮在 Ribbon 主区,但不知道生成的图能否插入文档;经常报错。
- **目标**:文转图卡片化输出(Anthropic Artifact 风),预览 → 编辑提示词 → 一键插入到光标处或追加到文末。

### 10.10 IT 管理员小郑 — 内网部署

- **现状**:Ollama 配置成功了,但部分员工用不了,日志也看不到原因。
- **目标**:设置页"环境自检"卡片实时显示 5 项可达性;日志面板;一键导出诊断包(含脱敏后的最近 50 条任务)。

### 10.11 新手用户小韩 — 第一次打开

- **现状**:欢迎页满是赞赏二维码,产品介绍埋在 Ribbon 深处,不知道从哪开始。
- **目标**:欢迎页极简(察元思源宋体大字 + 4 张磁吸卡片快捷入口) + 命令面板浮动提示 + 「按 ⌘K 开始」。

### 10.12 培训讲师小宋 — 教学演示

- **现状**:培训时演示 AI 流式输出,主屏看不出"现在在思考"还是"卡死了"。
- **目标**:流光边框 + Stepper 进度 + 完成扫光,清晰可投影。

### 10.13 自媒体运营小冯 — 头条改写

- **现状**:拿一段文案做"改写 5 个版本",当前只能反复点击。
- **目标**:自定义助手"批量出 N 版改写",并发跑 5 个温度梯度,卡片化展示;一键采用某版替换原文。

### 10.14 高频用户小董 — 用了半年

- **现状**:积累的助手太多,设置页一屏都列不下;不知道哪个还在用、哪个该删。
- **目标**:助手卡片显示心电图(14 天调用频次/健康分);冷门助手自动归档;一键"清理 30 天未用"。

---

## 11. 助手新增建议 · 18 个高价值内置

> 基于:用户场景统计、政企/法律/学术/媒体行业刚需、市场对标(Office Copilot / WPS 灵犀 / 飞书 / Notion AI / Cursor / Claude)

### 11.1 公文政务类(5 项)

| ID | 名称 | 默认动作 | 输入 | 价值 |
|---|---|---|---|---|
| `gov.notice-template` | 公文格式套用 | replace | document | 自动套用红头文件、附件标注、印发机关与日期 |
| `gov.numbering-fix` | 段落编号修复 | replace | document | 比 `paragraph-numbering-check` 进一步——直接改 |
| `gov.honorific-norm` | 敬语与称谓规范 | comment | selection-preferred | 检查"贵单位/贵公司/各位"用法 |
| `gov.sensitive-rephrase` | 敏感表述柔化 | comment | selection | 把"必须立即整改"改为"建议尽快研究处理" |
| `gov.gov-style-grade` | 公文等级评分 | none | document | 输出 0–100 的"公文气质"评分 + 建议 |

### 11.2 法律合规类(3 项)

| ID | 名称 | 默认动作 | 输入 | 价值 |
|---|---|---|---|---|
| `legal.clause-extract` | 合同条款抽取 | none(JSON) | document | 输出 fields(主体/标的/金额/期限/违约/管辖) |
| `legal.clause-risk` | 条款风险分级 | comment | selection | 红/黄/绿三档标注 + 修改建议 |
| `legal.cite-check` | 法条引用核查 | comment | selection | 检查"《XX 法》第 X 条"是否真实存在(本地法典库) |

### 11.3 学术写作类(3 项)

| ID | 名称 | 默认动作 | 输入 | 价值 |
|---|---|---|---|---|
| `academic.citation-format` | 引用格式化 | replace | selection | 在 GB/T 7714、APA、MLA 之间互转 |
| `academic.tone-academic` | 学术化改写 | replace | selection | 从口语/科普 → 学术规范 |
| `academic.figure-caption` | 图表说明生成 | comment | selection | 选中图后自动生成"图 X: ..." |

### 11.4 商业写作类(3 项)

| ID | 名称 | 默认动作 | 输入 | 价值 |
|---|---|---|---|---|
| `biz.bullet-condense` | 要点压缩 | replace | selection | 段落 → 3-5 项符号列表 |
| `biz.persona-rewrite` | 受众改写 | replace | selection | 选目标受众(领导/客户/同事)按风格调 |
| `biz.proposal-skeleton` | 方案骨架生成 | insert | document | 一句话需求 → 完整提案大纲(背景/目标/方案/资源/风险/时间) |

### 11.5 数据与表格类(2 项)

| ID | 名称 | 默认动作 | 输入 | 价值 |
|---|---|---|---|---|
| `data.table-narrate` | 表格读懂为文字 | comment | selection | 选中表格 → 一段自然语言解读 |
| `data.table-summarize` | 表格智能摘要 | insert-after | selection | 选中表格 → 在表格下方自动插一段总结 |

### 11.6 跨场景实用(2 项)

| ID | 名称 | 默认动作 | 输入 | 价值 |
|---|---|---|---|---|
| `util.tone-checker` | 语气一致性检查 | comment | document | 检查全文语气是否统一(正式/口语/混杂) |
| `util.consistency-check` | 一致性核查 | comment | document | 全文术语/数字/日期/人名一致性 |

### 11.7 助手元数据建议

每个助手新增统一字段:

```js
{
  id: 'legal.clause-extract',
  category: 'legal',                    // ✦ 新增,用于设置页分组
  industry: ['government','legal'],     // ✦ 新增,用于推荐
  inputCharRange: [50, 50000],          // ✦ 新增,自动 chunk 阈值参考
  estimatedTokens: 1200,                // ✦ 新增,前端预算预估
  raceProfile: 'legal-compliance',      // ✦ 新增,健康分阈值套用
  modelHint: ['gpt-4o','claude-sonnet'],// ✦ 新增,推荐模型
  outputSchema: { ... },                // ✦ 新增,JSON schema(用于 structured outputs)
  examples: [                           // ✦ 新增,3 条 in/out 示例,用于评估和帮助 UI
    { input: '...', output: '...' }
  ]
}
```

---

## 12. 实施路线图(P0–P5)

### 12.1 P0 · 立即可做(本周内,工作量 1 周)

| 任务 | 收益 | 工作量 |
|---|---|---|
| 创建 `src/utils/host/hostBridge.js` 单例 | 解决"对话框无法触发文档 API" | 1 天 |
| Selection token 快照机制(ribbon 侧打 token,dialog 侧用 `doc.Range(t.start,t.end)`) | 解决"选区丢失"概率失败 | 1 天 |
| 全部 `alert(e?.message)` → `showSafeErrorDetail` | 错误反馈不再沉默 | 0.5 天 |
| 路由模型解耦(设置页加"路由模型"独立选项) | 首字符 -1.5s | 0.5 天 |
| `saveHistory` 节流(250ms debounce + idle callback) | 主线程不再卡顿 | 1 天 |
| 删 5 个空函数 / 死 case;`btnTaskOrchestration` XML 取消注释 | UI 不再"点了无反应" | 0.5 天 |
| Ribbon `OnGetVisible` 过滤未配置 PrimarySlot | Label 不重复 | 0.5 天 |

### 12.2 P1 · 链路提速(2 周)

| 任务 | 收益 | 工作量 |
|---|---|---|
| 乐观流式 + abort 中断(A1) | 首字符 -2-4s | 3 天 |
| 路由判定全部并行(A3) | 首字符 -1-2s | 2 天 |
| chunk 并发池(B1) | 长文助手 -60-80% | 2 天 |
| prompt caching 接入(B4) | 成本/延迟双降 | 1 天 |
| ScreenUpdating off + Repagination off(B7) | 写回 -80-90% | 0.5 天 |
| 撤销栈合并(B8) | 用户可一键撤销整体 | 1 天 |
| structured outputs(B9) | JSON 解析失败率↓ | 1 天 |
| 任务进度 update 节流 + BroadcastChannel(B10) | 跨窗口同步丝滑 | 1 天 |

### 12.3 P2 · UI 升级 + 命令面板(2 周)

| 任务 | 工作量 |
|---|---|
| 设计 token + 字体引入 + 暗色模式(§8.2) | 2 天 |
| 主对话框三栏 + Selection Chip + Intent Pill + Diff 预演(§8.4-8.5) | 5 天 |
| 命令面板 ⌘K(§8.6) | 3 天 |
| 欢迎页重构(§8 末尾) | 2 天 |
| AI 流光边框 + 进度 shimmer + 完成扫光(§8.5) | 1 天 |

### 12.4 P3 · 模块化重构(3 周)

| 任务 | 工作量 |
|---|---|
| `AIAssistantDialog.vue` 拆分为 6 个子组件 | 5 天 |
| `ribbon.js` 拆分为 customUiXml/onAction/icons/labels/menus/* | 3 天 |
| 28 个对话框接入 `<DialogShell>` + `showAdaptiveDialog` | 5 天 |
| 5 套 `*WindowManager` 收敛为 `createDialogSession` | 2 天 |
| 14+ store 迁移到 Pinia + 版本化 + IndexedDB 大数据 | 5 天 |

### 12.5 P4 · 能力总线全覆盖 + 主进程 op 队列(3 周)

| 任务 | 工作量 |
|---|---|
| 注册 declassify / form-audit / batch / template / media / document-comment / document-revision 等 namespace | 7 天 |
| Ribbon OnAction 80+ case 改写为 `bus.execute(...)` 单行 | 3 天 |
| 主进程 op 队列(BroadcastChannel + ribbon 侧监听) | 5 天 |
| 能力 catalog 自动生成(JSDoc tag) | 2 天 |
| 策略/配额/审计 UI 统一面板 | 3 天 |

### 12.6 P5 · 进化系统真闭环 + 助手新增 + 应用市场(持续)

| 任务 | 工作量 |
|---|---|
| RACE 四维健康分(替代 token overlap)| 2 天 |
| LLM-as-judge 双裁判 + rubric 评分 | 3 天 |
| 用户信号回流(👍/👎/接受/丢弃/撤销) | 3 天 |
| 影子双跑机制 | 5 天 |
| 失败聚类 + 自动证据包 | 3 天 |
| 18 个新内置助手开发 + 评测 | 10 天 |
| 应用市场骨架(skill 插件机制) | 持续 |

### 12.7 总览甘特

```
P0  ████                                   1 周
P1     ██████████                          2 周  (与 P0 部分并行)
P2          ██████████                     2 周
P3                ████████████████         3 周
P4                          ████████████   3 周  (与 P3 后期并行)
P5                                ──→      持续
```

---

## 13. 验收指标与监控埋点

### 13.1 性能 SLO(p50)

| 指标 | 当前 | P1 目标 | P2 目标 | P5 目标 |
|---|---|---|---|---|
| 主对话框首字符延迟 | 3 s | 1 s | 0.5 s | 0.3 s |
| 主对话框对话完整响应 | 8 s | 4 s | 3 s | 2 s |
| 短文(1 段)助手 | 4 s | 2 s | 1.5 s | 1 s |
| 长文(10 段)助手 | 40 s | 12 s | 10 s | 8 s |
| 全文(50 段)助手 | 200 s | 30 s | 25 s | 20 s |
| 写回操作完成 | 8 s | 1 s | 0.8 s | 0.6 s |
| 命令面板出现 | — | — | < 100 ms | < 80 ms |
| 对话框打开 | 1.5 s | 0.8 s | 0.5 s | 0.4 s |

### 13.2 质量 SLO

| 指标 | 当前 | 目标 |
|---|---|---|
| `当前没有打开文档`错误率 | ~5% | < 0.5% |
| JSON 解析失败率(spell-check) | ~8% | < 1% |
| 原文锚定失败率(text_not_found) | ~12% | < 3% |
| 助手任务成功率 | ~88% | > 97% |
| 用户撤销率(30s 内) | 未追踪 | < 8% |
| 用户👎率 | 未追踪 | < 5% |

### 13.3 用户体验 SLO

| 指标 | 目标 |
|---|---|
| 首次使用引导完成率 | > 80% |
| 命令面板使用率(高频用户) | > 60% |
| 7 日留存(主对话框) | > 70% |
| 助手发现率(尝试过 ≥ 5 个内置) | > 50% |

### 13.4 监控埋点

新建 `src/utils/telemetry.js`,**默认本地落盘,经用户授权后上报**(政企必须)。事件:

- `dialog.open / dialog.close`(每个 dialogId 独立)
- `assistant.start / assistant.complete / assistant.fail / assistant.cancel`
- `intent.predicted / intent.corrected`(用户 Tab 切换 Intent 时)
- `apply.executed / apply.undone`(写回 vs 30s 内撤销)
- `feedback.thumbs_up / thumbs_down`
- `error.surfaced`(showSafeErrorDetail 触发)
- `command_palette.open / command_palette.execute`
- `host.application_unavailable`(getApp 失败,关键告警)

---

## 14. 风险登记与底线

| 风险 | 等级 | 缓解 |
|---|---|---|
| WPS 不同版本 ShowDialog/COM 行为差异 | 高 | hostBridge 内部分版本判定 + e2e 矩阵测试 + 灰度 |
| modeless dialog 同步 COM 仍可能 abort | 高 | 主进程 op 队列必须 P4 落地 |
| LLM 路由抖动导致 chat ↔ 操作误判 | 中 | 本地分类器命中阈值 > .85,否则才退 LLM;允许用户手动切 Intent |
| 乐观流式产生"被 abort 的部分 token 仍计费" | 中 | 设置页加"激进/保守"开关,默认保守(只在长延迟模型上启用) |
| Pinia 迁移破坏旧 localStorage 数据 | 中 | 每个 store 写明确的 migrate 函数 + 一键导出导出 v1 备份 |
| 暗色模式 CSS 变量改造工程量大 | 低 | 优先 token 化主流程,长尾 dialog 后续 |
| 命令面板冲突 ⌘K | 低 | 提供设置项更换快捷键 |
| 18 个新助手提示词需要时间打磨 | 中 | 内部 dogfood 2 周;按 RACE 健康分逐个上线 |
| WPS 老版本 ribbon `dynamicMenu` 不刷新 | 低 | `InvalidateControl + invalidateContentOnDrop="true"` |
| 影子双跑增加 token 消耗 | 中 | 仅在用户主动开启 + 限频 + 限月度配额;默认关闭 |
| 品牌合规约束(察元固定文案) | 高 | CI 加入字符串完整性检查;UI 内品牌位置只读 |
| 用户隐私(失败样本含敏感) | 高 | 本地脱敏后再入 SignalStore;默认不外传 |

---

## 附录 A:与同类产品对比定位

| 维度 | 察元 | WPS 灵犀 | Office Copilot | 飞书智能伙伴 | Notion AI | Claude / Cursor 文档延伸 |
|---|---|---|---|---|---|---|
| 部署形态 | WPS 加载项 | WPS 内嵌 | 在线 | 飞书内嵌 | 在线 | 桌面/Web |
| 离线 / 内网 | ✅ Ollama / 本地网关 | ❌ | ❌ | ❌ | ❌ | 部分 |
| 助手数量 | 29 内置 + 自定义 | ~ 8 | ~ 12 | ~ 10 | ~ 8 | 自由 |
| 编审/表单/规则 | ✅ 完整 | 部分 | 部分 | ❌ | ❌ | ❌ |
| 安全保密(脱密/复原) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 任务编排 | ✅ Vue Flow | ❌ | 弱 | 部分 | ❌ | ❌ |
| 助手版本/进化 | ✅ 骨架 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 多供应商 | ✅ 任意 OpenAI 兼容 | 内置一家 | 微软 | 内置 | OpenAI | Anthropic |
| 写回方式数量 | 9 种 | 2-3 | 3-4 | 2-3 | 2-3 | 2-3 |

**察元的护城河**:① WPS 原生集成 + 离线优先 ② 编审 + 规则 + 表单一体化 ③ 助手数量与可扩展性 ④ 安全保密链路。**短板**:UI/UE 工业级感不足、链路速度未优化、能力总线未全覆盖。

---

## 附录 B:重构前后核心文件 LOC 预估

| 文件 | 当前 LOC | 重构后 LOC | 收益 |
|---|---|---|---|
| `AIAssistantDialog.vue` | 825 KB / ~16k 行 | 6 个文件 × ~1.5k 行 ≈ 9k 行 | 单文件 -94%,首屏 -50% |
| `SettingsDialog.vue` | 322 KB / ~6k 行 | 5 个 tab 文件 × ~1.2k 行 ≈ 6k 行 | 维护性 ↑ |
| `Popup.vue` | 237 KB / ~4.5k 行 | TaskList.vue + TaskFilters.vue + TaskActions.vue ≈ 3.5k 行 | -22% |
| `ribbon.js` | 4272 行 | customUiXml + onAction + icons + labels + menus/* ≈ 3k 行 | -30%,职责单一 |
| `documentActions.js` | 1906 行 | 拆 5 个 ≈ 1800 行 | 复用度 ↑ |
| 14+ store | ~3k 行手写 | Pinia + plugin ≈ 1.5k 行 | -50% |
| **合计净减少** | — | — | **约 -25% 总 LOC,可读性 ×3** |

---

## 附录 C:关键术语

- **Selection Token**:对话框打开前在主进程快照的选区坐标 `{start,end,paragraphIndex,docName}`,用于跨窗口还原 Range。
- **HostBridge**:WPS Application 单例访问层,统一 fallback、提供主进程 op 队列。
- **Capability Bus**:能力总线,所有可执行能力以 namespace 注册;Ribbon、AI 助手、workflow 共享同一关卡。
- **RACE 四维**:Reliability / Accuracy / Compliance / Efficiency,助手健康分四维度。
- **dryRun 预演**:写回前生成 writeTargets 但不落笔的预览模式。
- **影子双跑**:候选版本在真实流量上后台并行运行,不展示给用户,只记录对比数据。
- **Intent Pill**:输入框内意图预告标签(对话/操作/助手)。
- **Diff 卡**:写回前 旧文/新文 红绿条对比预览。

---

## 附录 D:决策与变更记录(Changelog)

- **2026-04-28 v1.0**:首次发布,基于完整代码审计 13800+ 行 + Ribbon 全部按钮 + 29 助手 + 28 能力 + 28 路由 + 14+ store。

---

> **致研发**:本文是计划而非教条。落地过程中如发现假设错误,应第一时间在本文 §14 风险登记里追加,并修订对应阶段。架构演进的本质是"边走边纠",不是"按图施工"。

> **致产品**:每一个 P0/P1 项做完都建议留 1-2 天做用户走查,把真实反馈写回 §10 场景表。

> **致设计**:Token 与组件库优先,具体页面后行;否则会出现"局部很美、整体漂移"的常见坑。
