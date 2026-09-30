# 表格(ET)与演示稿(WPP) MCP 助手可行性分析

> 版本：v1.0（2026-09-30）
> 结论先行：**技术可行，且现有架构天然支持"三宿主共用一个底层服务"。** 官方文档已核实三宿主 JSAPI 能力面完整；改造工作量集中在"多宿主装载 + agent 通道按宿主路由 + 新增两套 dispatch/工具目录 + 写回安全模型适配"，不需要推翻现有任何一层。
> 官方依据：WPS 加载项 JSAPI 文档 office_v19（http://qn.cache.wpscdn.cn/encs/doc/office_v19/index.htm ），wpsjs 2.2.3 官方 npm 包源码，均已逐条核对。

---

## 0. 目标方案（用户思路）与总体判定

| 用户思路 | 判定 | 依据 |
|---|---|---|
| ① 把表格大部分操作写成 MCP 接口 | **可行** | ET API 是 Excel VBA 对象模型的 JS 镜像，本文 §3.2 逐条核对官方文档，读写/格式/排序筛选/图表/透视/导出全覆盖 |
| ② 表格 ribbon 只留一个菜单，点击打开聊天页 | **可行** | 加载项按 type 分目录各自带 ribbon.xml，et 宿主放单按钮即可；现有 `openAIAssistant()`（ribbon.js:121）与宿主无关，直接复用 |
| ③ 聊天页面复用现有页面 | **可行（需适配层）** | 聊天→MCP 链路（orchestrator→AgentLoop→/mcp）完全宿主无关；需按宿主替换"选区上下文/系统提示词/写回安全"三处 Writer 专用逻辑 |
| ④ 通过聊天页调用 MCP 操作表格 | **可行（最小改造点）** | sidecar→长轮询→webview 执行管道宿主无关；唯一硬编码 `addonType:'wps'`（dispatch.js:153）需宿主化，agentHub 需按宿主分槽路由 |
| ⑤ 演示稿同理 | **可行** | WPP API 是 PowerPoint VBA 镜像，Slides/Shapes/TextRange/放映/导出全覆盖（§3.3） |
| ⑥ 三宿主共用一个底层服务 | **天然成立** | sidecar 本就不区分宿主、纯编排层、永不直接碰文档；单端口 62588、token 鉴权、上游代理、自启全部原样复用 |

---

## 1. 现状机制盘点（代码证据）

### 1.1 装载方式
- 非 jsplugins.xml 在线模式，而是 **jsaddons 本地包 + publish.xml**：`scripts/build-wps-addon.mjs:97-108 publishXmlForPkg()` 生成 `<jsplugin name type url version .../>`；Windows 离线包必须 `enable_dev`，Linux/macOS 用 `enable`（:89-95）。
- 安装路径：Windows `%AppData%\kingsoft\wps\jsaddons\`；macOS 沙盒 `~/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons/`（+非沙盒双写）；Linux `~/.local/share/Kingsoft/wps/jsaddons/`。
- **publish.xml 目前固定 `type="wps"`，仅文字宿主**；`manifest.xml` 不含类型声明（类型由 publish.xml 的 type 决定）。

### 1.2 双通道架构
- **A 直调通道**：加载项网页内 `window.Application`（WPS 内嵌 Chromium 动态注入，即当前宿主根对象）。句柄层 `src/utils/host/hostBridge.js:25-37`（getApp/getDoc/getSelection）；写回汇聚点 `src/utils/documentActions.js:1796 applyDocumentAction()`。
- **B MCP 通道**：`mcp-sidecar/server.mjs` 零依赖 Node 单文件，只绑 `127.0.0.1:62588`；`/mcp` Streamable HTTP、`/agent/*` 加载项长轮询通道（25s poll，强制 `X-Chayuan-Token`）、`/upstream/*` 上游白名单代理。
- **sidecar 不驱动 WPS**（无 COM/原生通道）：`agentHub.callAgent()` 入队 → webview 长轮询领 job（`src/services/mcpBridge/agentClient.js:366-396`，OnAddinLoad 时 `startMcpAgent()`）→ `dispatch.js:527-776` 用 `window.Application.ActiveDocument` 执行 → POST 结果回 sidecar。外部智能体（Claude Code/Cursor）与页内智能体共用同一管道。

### 1.3 完整链路（现有，Writer 专用）
```
ribbon「AI助手」 → CreateTaskPane/ShowDialog 打开 file://…#/ai-assistant（同进程新 webview）
  → GET /healthz、POST /mcp tools/list（127.0.0.1:62588）
  → AgentLoop(src/agent-core/loop.ts, ≤16轮) ↔ LLM（用户自配 OpenAI 兼容端点）
  → 每个工具调用 POST /mcp tools/call → sidecar mcpHandler 映射为 job → agentHub 入队
  → ribbon webview 长轮询领 job → dispatch（写方法过 documentWriteLock：FIFO+OCC+两段确认）
  → window.Application.ActiveDocument 写入 → 结果回传 → 下一轮
```

### 1.4 写回安全（可直接复用的基建）
- `src/services/documentWriteLock.js`：全局单写者、FIFO promise 链、写前活动文档身份校验（DOC_SWITCHED）、OCC 基线（`段落:len:hash` 指纹，按回合 ownerToken 隔离）、写后 300ms 静置滚基线。
- 两段式确认：写工具 `confirmed!==true` 一律返回 preview 信封；`document_apply_ops` 每条 op 靠 `originalText` 锚定，定位失败抛 LOCATE_MISMATCH。
- 快照撤销（首个写操作前抓全文 → "撤销本次修改"卡）、文件级备份（120 份）、操作台账（200 条）。
- 页内智能体工具白名单：禁 document 生命周期工具（防切档杀死自己的 webview）；`_isDispatching` 重入互斥防 ksojscore JIT 崩溃。

### 1.5 ET/WPP 现状：零支持
全仓搜索 `EtApplication|WppApplication|ActiveWorkbook|ActivePresentation|Workbooks|Slides` 在 `src/` 与 `mcp-sidecar/` **零命中**。现有 65 个 MCP 工具全部基于 Writer 对象模型；`table.*` 工具操作的是 Writer 文档内 Tables 集合，与 ET 无关。"三平台"现指三个操作系统（Win/mac/Linux 安装包与 sidecar 二进制齐备，且 mac Writer 宿主已实证可跑）。

---

## 2. 官方文档核实（技术可靠性）

### 2.1 多宿主装载：官方支持，type 是部署属性不是代码属性
- jsplugins.xml 官方示例一个文件并列 `type="et"`、`type="wpp"` 条目；wpsjs 2.2.3 `CreatePublishXml` 源码同构。同一套网页代码在三个宿主通用（官方 wpsjs 三模板代码结构相同，仅取 `ActiveDocument/ActiveWorkbook/ActivePresentation` 的差异）。
- **每个 jsplugin 条目对应一个目录（url 字段）+ 一份 ribbon.xml**。要"表格只有一个菜单"，应给 et/wpp 各建独立目录：et 目录 ribbon.xml 单按钮，共享同一套前端 assets。manifest.xml 本身不含 type（wpsjs 模板实证），类型写进 publish.xml 条目。
- 个人版 12.1.0.16910 起禁止 oem.ini/jsplugins.xml 远程模式；本地 jsaddons + publish 模式不受影响（本项目现用方式即属此类，已跑通三平台）。

### 2.2 表格 ET API 能力面（官方文档逐条确认存在）
| 能力 | 官方 API |
|---|---|
| 读写值/公式 | `Range.Value2 / Value / Formula / FormulaR1C1 / Text / HasFormula`，`Cells.Item(i,j)` |
| 格式 | `Range.Font / Interior / Borders / NumberFormat / Merge / MergeArea / WrapText / RowHeight / ColumnWidth` |
| 排序筛选 | `Range.Sort / AutoFilter / AdvancedFilter`，`Worksheet.Sort / AutoFilter`，枚举 `XlSortOrder / XlAutoFilterOperator` |
| 行列增删 | `Range.Insert / Delete / EntireRow / EntireColumn / Hidden / Group / Ungroup` |
| Sheet 管理 | `Sheets.Add/Copy/Delete/Move`，`Worksheet.Name/Activate` |
| 图表 | `ChartObjects.Add` + `Shapes.AddChart2`、`Chart.ChartWizard/Axes/Export`、枚举 `XlChartType`。**注意：`Charts` 集合只有 Item 没有 Add**（图表工作表式创建无文档），统一走 ChartObjects.Add 即可 |
| 条件格式/透视 | `FormatConditions`（含 AboveAverage）、`PivotTables / PivotTable / PivotCaches` |
| 查找替换 | `Range.Find / Replace`、`Application.FindFormat` |
| 导入导出 | `Workbooks.Open / OpenText`、`Workbook.SaveAs`（`XlFileFormat` CSV 类）、`Workbook/Range.ExportAsFixedFormat` |
| 已用区域 | `Worksheet.UsedRange`、`Range.CurrentRegion / End / Offset / Resize / Address / Count` |
| 事件 | `Application.ApiEvent.AddApiEventListener`：`SheetSelectionChange / SheetChange / WorkbookOpen / WorkbookBeforeSave / AfterCalculate` 等（仅 Application 级，无 Worksheet 级事件对象） |
| 其它 | `Application.WorksheetFunction`（工作表函数全集）、`Application.Run/Evaluate/ScreenUpdating/DisplayAlerts` |

### 2.3 演示稿 WPP API 能力面（官方文档逐条确认存在）
| 能力 | 官方 API |
|---|---|
| 演示文稿 | `Presentations.Add/Open`；`Presentation.Save/SaveAs/SaveCopyAs/Close/ApplyTemplate/ApplyTheme` |
| 幻灯片 | `Slides.Add/AddSlide/InsertFromFile`；`Slide.Delete/Copy/MoveTo/Duplicate`；版式 `Slide.Layout` |
| 插入对象 | `Shapes.AddTextbox/AddPicture/AddTable/AddChart/AddShape/AddOLEObject/AddMediaObject/AddPlaceholder` |
| 文字 | `Shape.TextFrame`（`TextRange/AutoSize/Margin/HorizontalAnchor`）；`TextRange.Text/Font/ParagraphFormat`，`InsertBefore/InsertAfter/Characters/Find/Replace/ChangeCase` |
| 母版 | `Presentation.SlideMaster/HandoutMaster/NotesMaster`、`Designs` |
| 放映 | `SlideShowSettings.Run`（StartingSlide/EndingSlide/LoopUntilStopped）、运行期 `SlideShowView.Next/GotoSlide/Exit` |
| 导出 | `Presentation.Export`（逐页导图）、`Presentation.ExportAsFixedFormat`（PDF/XPS）、`Slide.Export`（单页导图） |
| 事件 | `PresentationOpen / PresentationNewSlide / SlideSelectionChanged / SlideShowBegin/End` 等 |

### 2.4 宿主通信
- 网页运行于 WPS 内嵌 Chromium，`window.Application` 动态注入、即当前宿主根对象——**同一网页在 ET 宿主里天然拿到的就是 ET Application**，三宿主互不干扰，无需手动选择对象模型。
- 全局扩展成员（官方确认）：`CreateTaskpane(url)`、`GetTaskpane(id)`、`ShowDialog(url,标题,宽,高,…)`、`ApiEvent`、`Env`、`FileSystem`、`PluginStorage`、`OAAssist`。
- 宿主识别（项目需新增）：检查 `Application.Workbooks`（et）/`Presentations`（wpp）/`Documents`（wps）成员存在性，或读 `Application.Env`；替换 dispatch.js:153 的硬编码。
- 注意：官方文档只有 `Application.ShowDialog`（项目中 `wps.ShowDialog`、`alertAsDialog` 等旧 SDK 名不在现行文档）；`wps.EtApplication()/WppApplication()` 是早期 OA 助手写法，现行以 `window.Application` 为准。**无官方 Office.js 兼容承诺**，WPS JSAPI 是 VBA 镜像（同步调用 + ApiEvent）。

### 2.5 外部自动化通道与 MCP 生态（佐证路线可行）
- **桌面端无官方 MCP**（官方 MCP 仅 WPS 365 云端开放 API）。
- Windows COM：ProgID `Kwps/Ket/Kwpp.Application`（宏编辑器 CreateObject 文档页明示仅支持这三个），外部进程可脱离加载项驱动 ET/WPP——sidecar 未来在 Windows 有加载项之外的兜底通道。
- Linux：官方 C++ RPC（rpcwpsapi/rpcetapi/rpcwppapi），社区绑定 pywpsrpc。
- **社区成熟先例与本项目同构**：lc2panda/wps-skills（243 工具：Excel 82/Word 28/PPT 112）在 macOS 上正是"加载项 + HTTP 轮询"路线（58891 端口），与本项目长轮询管道同思路，证明 mac 路线可行、工具粒度空间充足。

### 2.6 已知限制与坑（官方原文/社区实证）
1. **macOS**：官方加载项概述原文"目前已针对 Windows/Linux 操作系统进行适配"，从未承诺 macOS；社区确认 Mac 不支持在线安装加载项。**但本项目已在 mac 发布并跑通 Writer 宿主（沙盒路径双写等）**，说明本地 jsaddons 方式在 mac 可用；et/wpp 宿主在 mac 的表现需 P0 冒烟实测。
2. **性能**：加载项多进程架构，JS 调用走跨进程同步 IPC；官方性能页基准"10000 个单元格赋值耗时 2000 毫秒"，且官方示例是逐格循环。→ 工具必须设计为**二维数组批量读写**（社区实测 `Range.Value` 支持整块数组，但官方文档未明说，需实测确认）+ 单次调用分片上限 + `ScreenUpdating` 开关。
3. **API 缺口**：ET `Charts.Add` 缺失（用 ChartObjects.Add）；事件仅 Application 级；`Range.Value` 在文档中列为"方法"而非属性，跨版本行为需注意。
4. **个人版收紧**：16910+ 禁远程 jsplugins.xml；本地包方式目前不受影响，但存在 WPS 升级进一步收紧 `enable_dev` 口径的风险。
5. 调试坑：调试须先关 alert 等同步弹框；wpsjs debug 下 taskpane 调试器曾有打不开的遗留问题。

---

## 3. 共用底层服务的设计（关键改造点）

### 3.1 sidecar：一处小改
现状 agentHub 单槽位（任一 webview 注册即接管）。三宿主并存时需：
- 注册协议加字段：`/agent/register` 带 `addonType: 'wps'|'et'|'wpp'` + 宿主进程标识；
- `agentHub.callAgent(method, params, { target })` 按 target 路由到对应槽位；`wps_status/wps_launch` 扩展为 `host_status/host_launch(target)`；
- token、`/mcp` 协议、`/upstream/*`、心跳文件、自启脚本**全部零改动**。

### 3.2 加载项：三目录装载 + 宿主识别
- 构建脚本 `publishXmlForPkg` 输出三条 publish.xml 条目（chayuan / chayuan-et / chayuan-wpp，各自目录），et/wpp 目录 ribbon.xml 单 tab 单按钮（`OnAction → openAIAssistant()`），共用同一 assets；et/wpp 的 addon 主页（ribbon.js 所在 bundle）保持 `startMcpAgent()` 引导，注册时上报真实 addonType（宿主识别见 §2.4）。
- `platformBridge.launchWps/findWpsExecutable` 按宿主扩展：Windows `wps.exe /prometheus /et|/wpp`（启动参数与 mac 可执行名需 P0 实测）。

### 3.3 dispatch 与安全模型
- 新增 `src/services/mcpBridge/spreadsheetDispatch.js`、`presentationDispatch.js`；dispatch.js 按 addonType 路由，**保留 `_isDispatching` 重入互斥**（ksojscore JIT 崩溃防护在批量场景更重要）。
- 写回安全三宿主适配（复用 FIFO 写锁/ownerToken/两段确认/快照框架，替换指纹函数）：
  - ET：OCC 基线 = 活动工作簿 FullName + 活动 Sheet + UsedRange 维度 + 值指纹（封顶 ~2 万格，防大表拖慢）；op 锚定从 originalText 改为 `sheet+address+originalValue`；快照 = UsedRange 值数组（封顶）可内存还原。
  - WPP：OCC 基线 = 幻灯片页数 + 每页文本 hash；快照 = `Presentation.SaveCopyAs` 落备份目录（形状级内存还原不现实），撤销卡提示从备份恢复。
- 页内智能体白名单：三宿主一律禁各自的生命周期工具（workbook_open/close、presentation_open/close 等），外部 MCP 客户端保留全量。

### 3.4 聊天页适配（收敛为 hostAdapter 层，避免 if 散落）
- `hostBridge` 按宿主返回根对象与活动对象（ActiveWorkbook/ActivePresentation）；
- 选区上下文：ET = `Selection.Address` + 值采样（如 20×20）；WPP = 当前页文本摘要；
- 系统提示词按宿主模板切换（Writer 现有强约束——仅当前文档/禁止新建——平移为"仅当前工作簿/仅当前演示稿"）；
- AIAssistantDialog.vue 为 2.4 万行巨石组件，宿主差异务必收进 adapter，不做行内分支。

---

## 4. MCP 工具清单设计（MVP）

聚合 action 风格沿用现有 `table` 聚合先例，控制目录体积（对照：现有 65 条目；社区 wps-skills Excel 82/PPT 112 说明上限空间足够）。

### 4.1 表格 spreadsheet.*（约 22 个）
| 工具 | 官方 API |
|---|---|
| `workbook_open/list_open/activate/save/save_as/export_pdf/close` | `Workbooks.Open`、`Workbook.Save/SaveAs/ExportAsFixedFormat/Close` |
| `sheet_list/add/rename/delete/move` | `Worksheets`、`Sheets.Add` 等 |
| `range_read`（values/formulas/number_format 二维数组，分页上限） | `Range.Value2/Formula` |
| `used_range_info` / `sheet_data_preview` | `UsedRange/CurrentRegion` |
| `range_write`（值批量）/ `range_write_formula` / `range_clear` | `Range.Value2` 批量数组、`Formula`、`Clear` |
| `cell_find / cell_replace` | `Range.Find/Replace` |
| `row_insert/delete`、`column_insert/delete` | `Range.EntireRow/Column.Insert/Delete` |
| `range_format`（字体/填充/边框/数字格式/对齐/合并）、`column_width/row_height` | `Font/Interior/Borders/NumberFormat/Merge` |
| `range_sort`、`autofilter_set` | `Range.Sort/AutoFilter` |
| `chart_add / chart_list / chart_export` | `ChartObjects.Add + SetSourceData + ChartType` |
| `conditional_format_add`（二期） | `FormatConditions` |
| `pivot_create`（二期） | `PivotCaches.CreatePivotTable` |
| `export_csv` | `Workbook.SaveAs`（XlFileFormat） |

### 4.2 演示 presentation.*（约 18 个）
| 工具 | 官方 API |
|---|---|
| `presentation_open/list/activate/save/export_pdf/close` | `Presentations.Open`、`ExportAsFixedFormat` |
| `slide_list`（页数/版式/标题/文本提取）、`slide_text_read`、`shape_list` | `Slides/Slide.Layout/Shapes/TextRange` |
| `slide_add / slide_delete / slide_duplicate / slide_move` | `Slides.Add/AddSlide`、`Slide.Delete/Duplicate/MoveTo` |
| `slide_layout_set` | `Slide.Layout` |
| `slide_text_write`（shape 定位 → TextRange 替换/追加） | `TextRange.Replace/InsertAfter` |
| `textbox_add / picture_add / table_add` | `Shapes.AddTextbox/AddPicture/AddTable` |
| `template_apply` | `ApplyTemplate/ApplyTheme` |
| `slideshow_run` | `SlideShowSettings.Run` |
| `slide_export_image` | `Slide.Export` |

---

## 5. 分阶段实施与工作量

| 阶段 | 内容 | 预估 |
|---|---|---|
| **P0 冒烟验证**（先做，覆盖全部不确定项） | ① publish.xml 加 `type="et"` 条目，ET 宿主能否加载本地包；② `window.Application.ActiveWorkbook` 读写冒烟；③ **Range 整块二维数组批量读写实测**（性能关键假设）；④ mac 上 et/wpp 宿主加载与启动参数实测；⑤ ET/WPP 宿主里 CreateTaskPane/ShowDialog 行为 | 1–2 天 |
| P1 多宿主装载 | 构建脚本三目录三 type、et/wpp 单按钮 ribbon.xml | 2–3 天 |
| P2 agent 通道多宿主 | register 带 addonType、agentHub 分槽路由、host_status/launch | 2–3 天 |
| P3 表格 dispatch + 安全模型 | spreadsheetDispatch、ET 指纹/锚定/快照 | 5–7 天 |
| P4 表格 MCP 目录 + 聊天页适配 | toolCatalog/mcpHandler、hostAdapter、提示词 | 4–5 天 |
| P5 演示稿同构 | presentationDispatch + 工具目录（对象模型更简单） | 6–8 天 |
| P6 对齐打磨 | 外部智能体（Claude Code）双宿主联调、发版清单 | 3–5 天 |

表格 MVP（P1–P4，约 20 工具）约 3 周；演示 MVP 再 1.5–2 周；总计 **4–6 周**到三宿主对齐现有文字体验。

## 6. 风险登记

| # | 风险 | 等级 | 对策 |
|---|---|---|---|
| 1 | ET 大批量写性能/稳定性（跨进程同步 IPC） | 高 | 强制批量数组 + 单次 ≤5000 格分片 + `_isDispatching` 互斥 + ScreenUpdating；P0 实测定基线 |
| 2 | 写回安全模型不适配（现指纹是段落 hash） | 高 | 三宿主各自指纹/锚定函数（§3.3），快照封顶，WPP 用 SaveCopyAs 文件级快照 |
| 3 | mac 官方未承诺加载项（et/wpp 宿主未实证） | 中 | P0 最先验证；若 mac ET 有问题，先发 Windows/Linux，mac 降级为只读/提示 |
| 4 | 多宿主并发时 agent 通道串扰/误投递 | 中 | register 槽位化 + job.target 校验；活动对象身份校验从"文档"扩为"工作簿/演示稿" |
| 5 | 个人版 WPS 升级收紧本地装载口径 | 中 | 关注版本门槛；企业版 jsplugins.xml 模式作为企业客户兜底 |
| 6 | API 缺口（Charts.Add、事件仅 Application 级） | 低 | 统一 ChartObjects.Add；事件仅用于上下文刷新，不承担关键路径 |
| 7 | 聊天页巨石组件宿主分支蔓延 | 低 | hostAdapter 层强制收敛 |

## 7. 参考资料
- WPS 加载项 JSAPI 文档（office_v19，含表格/演示 API 参考、事件、加载项概述/开发/集成）：http://qn.cache.wpscdn.cn/encs/doc/office_v19/index.htm
- 官方 wpsjs CLI 与模板（npm）：https://registry.npmjs.org/wpsjs ；TS 类型包 `wps-jsapi`
- WPS 开放平台（云端 MCP 声明）：https://open.wps.cn
- 社区同构方案（mac 走加载项+HTTP 轮询）：https://github.com/lc2panda/wps-skills
- Linux RPC 绑定：https://github.com/timxx/pywpsrpc
- Windows COM 通道（Kwps/Ket/Kwpp.Application）：https://zhuanlan.zhihu.com/p/157332783

---

## 8. 开源收割评估（补充调研 2026-09-30）

> 结论：**收割可行且划算**。许可证层面有 2 个 MIT 项目可安全收代码；技术层面最有价值的收割物是"加载项内 JSAPI 调用知识"（正是本项目最缺的 ET/WPP dispatch 叶子层），而非通信管道（我们的长轮询+token 管道已优于所有开源方案）。

### 8.1 可收割项目清单

| 项目 | 许可证 | 架构契合度 | 收割内容 |
|---|---|---|---|
| **lc2panda/wps-skills**（631★，MIT①，2026-06 停更） | MIT | mac 链路与我们同构（jsaddons 加载项 + 本机 HTTP 轮询） | **首选代码收割**：`wps-claude-assistant/main.js`（6612 行 ES5、226 个 JSAPI handler，含 Excel 82/PPT 115 工具实现）；`skills/*/SKILL.md` 中文提示词；`wps-com.ps1`（252 action）仅作行为规格清单。已克隆本地副本 `/tmp/wps-skills-research/repo` |
| **lewis-hui1202/WPS-AI**（63★，MIT，2026-08 仍活跃） | MIT | **最高**：WPS 宿主→JSAPI→TaskPane→fetch 127.0.0.1→Node sidecar+MCP 端点，与本项目几乎同构 | `plugin/js/tools/spreadsheet.js`（1994 行）、`presentation.js`（3657 行）的防御性 JSAPI 片段（AddPicture 三段式重试、ScreenUpdating 刷新、BGR 颜色解析、单位换算）；`tools/registry.js` 的"工具注册表 + hosts 过滤（对内按宿主过滤、对外 MCP 暴露全量）"——正是三宿主共用服务需要的目录模式 |
| **haris-musa/excel-mcp-server**（4206★，MIT） | MIT | 不控制 WPS（openpyxl 文件级），只抄设计 | 26 工具/6 域目录（Workbooks/Sheets/Cells/Formatting/Objects/Macros）、format_range 部分更新对象、describe_workbook 概览、read-only 降级、单元格上限 |
| **GongRzhe/Office-PowerPoint-MCP-Server**（1854★，MIT） | MIT | 同上，只抄设计 | 32 工具/11 模块：图表数据系列管理、text-fit 校验、版式模板化 |
| **thenw-123/CO-WPSppt**（MIT） | MIT | 低（COM），但 DSL 设计优 | Intent/DSL/Renderer 三层 JSON Schema、叙事版式枚举（timeline/comparison/swot 等），适合后期高层组合工具 |
| **CatNebulaaaa/wps-dsh-plugin**（MIT） | MIT | 复用 wps-skills | 仅操作守则提示词（先查态再改、改后读验证、破坏性操作确认） |

① wps-skills 的 MIT LICENSE 为 2026-06-26 补加；收割应基于当前 main 分支整树（已受 MIT 授权）。

### 8.2 不可收割（许可证红线）

- **GPL/AGPL 传染**：Aimino-Tech/opendocswork-mcp（GPL-3.0）、ranuts/document（AGPL-3.0）、bigben446/Zotero-WPSJS（GPL-3.0）——只可清洁室看思想。
- **无许可证 = 默认保留所有权利**：OfficeMCP/OfficeMCP（118★，最易误收的高星库）、alllyx520-bot/wps-agent、ykuwai/ppt-mcp（**README 徽章称 MIT 但仓库无 LICENSE 文件，实测 license=null，按无证处理**）等多个。
- 收割 MIT 代码须保留原版权与许可声明（建 `THIRD_PARTY_LICENSES.md`）；schema/提示词建议重写表述而非逐字复制。

### 8.3 收割物如何嵌入本项目管道

| 我们的改造点 | 收割来源 | 用法 |
|---|---|---|
| spreadsheetDispatch.js / presentationDispatch.js 的叶子 JSAPI 调用 | wps-skills main.js 226 handler + WPS-AI 两套 tools/*.js | 复制-适配：替换其 XHR/轮询壳，保留 JSAPI 调用与异常兜底，接我们的写锁/两段确认 |
| 宿主识别与工具目录 | WPS-AI registry.js（hosts 过滤 + 全量导出） | 对齐我们的 addonType 路由设计 |
| 表格/演示工具 schema | excel-mcp-server 6 域 + PowerPoint-MCP-Server 11 模块 | 按我们 §4 清单取舍（MVP ~22/~18 个） |
| 系统提示词 | wps-skills SKILL.md（公式诊断表、PPT 设计四原则、7 套配色） | 改写进 mcpChatOrchestrator 宿主化提示词 |
| **不收** | wps-com.ps1（COM/PowerShell 与浏览器 JSAPI 管线不兼容）、各项目通信层（无鉴权 500ms 轮询，劣于我们 token+25s 长轮询）、WPS-AI 整库 fork（含 onnxruntime 重依赖，体积失控） | ps1 仅当行为规格对照表 |

### 8.4 收割带来的关键情报（影响原方案假设）

1. **⚠️ Mac JSAPI 可能不支持 Range 批量赋值**：wps-skills 源码注释明言"Mac 版 WPS 不支持批量赋值 range.Value = data"，其 setRangeData 在 mac 与 Windows 双端都逐格写（Windows COM 端其实支持批量却也没用）。→ P0 冒烟必须实测两端批量赋值；工具层直接设计**双通道**：优先二维数组批量，失败自动降级为分片逐格 + `ScreenUpdating=false`。这把原 §6 风险 1 的对策从"假设可批量"升级为"已知的双通道兜底方案"。
2. **Mac JSAPI 坑位清单（实战验证，直接进编码规范）**：无 `sheet.Cells(row,col)`（必须 `Range("A1")` 记法）、`Value2` 优先于 `Value`、宿主探测需名称+活动对象三重判定、PPT 占位符需 `Type===14 && PlaceholderFormat.Type∈{2,15}` 多重防护、颜色统一 hex→BGR 整数。
3. **枚举映射表现成可用**：chartType（column=51/pie=5/scatter=-4169…）、ppLayout（title=1/blank=12…）、shapeType、对齐、保存格式全套——省掉一遍遍查 office_v19。
4. **多文档/多文稿漂移是开源方案踩得最深的坑**（wps-skills Issue #26/#27：ActivePresentation 漂移改错文件、导出假成功）→ 反向验证我们"job.target 宿主路由 + 写前活动对象身份校验"的必要性；工具参数应支持 `workbookName/presentationName` 锁定目标。
5. **成熟度提醒**：wps-skills 已停更 3 个月、beta 质量（无重试/无回滚/校验极浅），收割其"知识"而非其"工程"；我们已有的写锁/OCC/两段确认基建反而是收割物之上要补的层。

### 8.5 对工作量的影响

收割省掉的是 dispatch 叶子层最不确定的"JSAPI 试错"部分（原 P3 的 30–50%）与枚举/提示词编写时间；架构层（P1/P2）与安全模型适配不受影响。**总估从 4–6 周收窄为 3–5 周**。

---

## 9. 实施与验证记录（2026-09-30 开发落地）

### 9.1 已交付（全部按 §3/§4 设计落地）

| 模块 | 文件 | 要点 |
|---|---|---|
| 宿主识别 | `src/utils/host/hostType.js` | Workbooks/Presentations/Documents 成员探测，webview 内缓存 |
| JSAPI 叶子层 | `src/services/mcpBridge/spreadsheetDispatch.js`（21 action）/ `presentationDispatch.js`（17 action）/ `hostDispatch.js`（共享工具） | A1 记法、批量双通道（整块 Value2 → 失败降级逐格 ≤5000 格）、ScreenUpdating/DisplayAlerts 守卫、preview 信封 |
| 写回安全 | `documentWriteLock.js` 宿主化 | ET 指纹=活动表 UsedRange（≤2 万格，超限退化维度）；WPP 指纹=页数+逐形状文本 hash；身份校验 ActiveWorkbook/ActivePresentation |
| agent 通道 | `agentHub.mjs` 按 addonType 分槽 + `targetForMethod` 前缀路由；`agentClient.js` 注册上报宿主 | spreadsheet.*→et、presentation.*→wpp、document.*/…→wps、wps.status/assistants.*/kb.*→any；错误宿主拒单（WPS 表格/演示 Agent offline） |
| MCP 目录 | `aggregateTools.mjs` 新增 `spreadsheet`/`presentation` 聚合工具；`mcpHandler.mjs` 宿主化超时；`toolCatalog` v0.11.0 | 共 48 工具；页内白名单按宿主过滤（ET 只见 spreadsheet+共享工具） |
| 聊天页 | `mcpChatOrchestrator.js` 宿主化提示词/过滤/上下文；`documentContext.js` 工作簿/演示稿轻上下文 | AIAssistantDialog 零改动 |
| 多宿主装载 | `build-wps-addon.mjs`：三目录三 type 产物 + `publish-shared-dir.xml`（无 root 更新变体）；`ribbon.xml` 宿主感知 getVisible（文字双 tab / et、wpp 单按钮 tab）；`ribbon.js` OnGetWriterTabVisible/OnGetHostTabVisible | 安装器有 root 用多目录；用户级更新用共用目录变体 |
| 真机验证脚本 | `scripts/verify-et-wpp-mac.sh` | 一键完成 ET/WPP 全场景 MCP 调用 + 4 张截图 |

### 9.2 官方文档定点核查修正的 4 处实现（第一轮核查产出）

1. `Range.Address` 在 JSAPI 是**方法**（`Address()`）非属性 → 统一 `readAddress()` 双通道探测；
2. Value2 整块读取返回 `Item(r,c)` 包装对象而非纯数组 → `normalizeMatrixFromRead()` 归一化；
3. ET `Range.Sort` 的 Orientation 默认按行（xlSortRows=2）→ 显式传 11 个位置参数（含 Header=2、Orientation=1）；
4. 行列定位弃用裸行地址 `"5:7"` 与 `Rows/Columns` 对象 → "A1 区域 + EntireRow/EntireColumn"。

### 9.3 验证矩阵（全绿项）

- 语法/lint/vite 构建：通过（仅历史遗留告警）；
- agentHub 路由单测 9/9：三宿主各收各的 job、离线拒单带宿主名、any 语义、legacy 兼容；
- dispatch 层假宿主单测 13/13（表格）+ 17/17（演示）：预览信封、公式识别、Item 包装归一化、find/replace、sort 传参、format、CSV 导出（BOM）、越界报错；
- 管道 E2E（假 ET webview ↔ 真 sidecar）：register(addonType=et) → wps_status.hosts.et=true → range_write 路由执行回传 ✓、presentation/document 跨宿主拒单 ✓；
- 产物验证：install-staging 三目录三 type、et/wpp 单按钮 ribbon、sidecar 二进制重编（5/5）、7z 含 3 目录；
- 真机 sidecar 替换：launchd runtime 二进制已换新（48 工具，hosts 字段上线）。

### 9.4 真机 UI 测试：被 macOS 锁屏阻塞（待解锁一条命令完成）

- 已完成：sidecar 换新 ✓、jsaddons 安装（共用目录变体，沙盒/非沙盒双写）✓、WPS 启动打开测试 xlsx ✓；
- 阻塞：机器处于锁屏（需用户密码，无法也不应绕过）。证据链：WPS 进程在、无 ksojscore 崩溃日志、sidecar 审计零注册尝试（ribbon 未初始化）——与 9-20 日解锁状态下的正常审计流对比成立；
- 解锁后执行 `bash scripts/verify-et-wpp-mac.sh`：自动完成 ET 写值/公式/排序/格式/CSV/PDF + WPP 加页/文本框/导出 + 4 张截图（/tmp/chayuan-verify/）。
- 备注：本机因 jsaddons 目录为 root 属主，采用共用目录变体；`.pkg`/root 安装路径仍用多目录产物（表格/演示宿主严格单按钮 tab）。共用目录下若 WPS 不支持 tab 级 getVisible，则 ET 宿主会多显示文字版 tab（仅观感问题，功能不受影响，待真机确认）。

### 9.5 替换式安装（2026-09-30 补丁：升级不再保留旧版本）

问题：历次升级只在 jsaddons 里叠加新版本目录（曾累积 1.0.1→5.1.3 共 8 个 ~28MB 旧目录）。修复：全部四条安装路径统一加 `cleanup_old_addons`——清除 `chayuan_*`/`chayuan-et_*`/`chayuan-wpp_*` 中除本次安装三目录外的全部旧目录；目录条目删不掉（父目录 root 属主，典型=用户级覆盖安装）时退化为**清空内容**，空壳留给 root 安装器下次删除。连带修复：install.json 多宿主化后含 3 个 `addonFolder` 字段，三个 POSIX 安装器原 `tail -1` 会错装 wpp 目录——改为 `head -1`（主目录）+ `tail -n +2`（宿主目录），并让 mac postinstall / linux postinst / 直装脚本把三目录一起安装；Windows SFX（run-wpsjs-exe.mjs）同步升级为三宿主产物（三目录打包 + 三条 enable_dev publish 条目 + copy.bat 清理旧版本）。验证：cleanup 干跑测试通过（删旧留新不误伤第三方插件）、四脚本语法检查通过、本机 8 个旧目录已实际清空（沙盒路径本就干净）。

### 9.6 真机测试记录（2026-09-30 下午，WPS mac 12.1.28496）

**多宿主装载定稿方案（真机实证成立）**：jsaddons 单目录 + publish.xml **同名三条 type 条目**（name 均为 chayuan，type=wps/et/wpp，url 同指 `chayuan_5.1.4`）。真机结果：文字/表格宿主同时注册（`hosts: {wps:true, et:true}`）、两个宿主的功能区都正常显示「察元AI助理/察元AI编审」tab、聊天面板在表格宿主内正常打开。此前"不同名（chayuan-et）+ tab 级 getVisible"的实验配置对应了 tab 消失事故，已弃用（tab 级 getVisible 不要用；多目录方案留给 root 安装器，非 root 场景一律共用目录）。

**锁屏行为（重要运维知识）**：锁屏时 WPS 新启动的 ribbon 不初始化（宿主不注册）；已注册的 webview 在锁屏后仍存活、MCP 调用继续可用；但锁屏中新发起的 JSAPI 执行可能挂起（job 超时 → webview 卡死 → agent 下线）。因此真机自动化必须等"解锁 + 探针 status 3s 内返回"两条件同时满足才跑测试。

**真机发现并修复的 3 个 bug（单测/文档核查都发现不了）**：
1. **排序静默无效**：mac ET 的 `Range.Sort` 全参数位置传法（含显式 Orientation=1）调用成功但不排序。修复：三策略链——原生 Sort → `Worksheet.Sort` SortFields API → JS 侧读回排序写回（公式替换为计算值并在响应标注），每步用抽样单调性校验（`sortVerified`）决定是否降级。
2. **导出静默失败**：`FileSystem.WriteFile`（CSV）与 `ExportAsFixedFormat`（PDF）返回/抛错均无但文件不落盘（沙盒）。修复：每条导出路径后 `existsSync` 验证；CSV 失败且 ≤2000 格时把内容内联进响应（`format:'csv-inline'`）；PDF 回退 `SaveAs(path, 103)`（WPS 专属 XlFileFormat）；WPP PDF 回退 `SaveAs(path, 32)`。
3. **图表集合访问形态**：`ws.ChartObjects` 属性直取无 `.Add` → `getChartObjects()` 多形态探测（方法调用/属性/直取），兜底 `Shapes.AddChart2`。

**真机发现并修复的另外 4 个环境级问题（§9.6 后续补充）**：
4. **导出到 /tmp 被沙盒拒绝、SaveAs 弹模态框阻塞全局**：WPS 沙盒禁写 /tmp 等系统目录但允许用户目录（桌面导出实测成功）；`SaveAs` 会弹模态保存对话框阻塞全部 JSAPI（真机实锤：排序超时+agent 全灭的直接原因之一）。终案：导出仅走 ExportAsFixedFormat + 候选路径回退（请求路径 → ~/Desktop/同名 → ~/），彻底移除 SaveAs 回退。
5. **macOS TCC 权限对话框阻塞 ribbon**：WPS 对 /tmp 文件无"文件与文件夹"授权时，打开/恢复 /tmp 文件会弹模态授权框，阻塞功能区初始化（tab 消失、agent 全灭的另一主因）。测试/演示文件一律放 ~/Desktop（对话框明示 下载/文稿/桌面 已授权）。
6. **WPS 加载项 GC 会删除"目录名 ≠ name_version"的加载项目录**：曾用"version 属性 5.1.5 + 目录 chayuan_5.1.4"破缓存，结果 WPS 在后续启动时把不匹配的目录整个删除。发布清单必须保持 name/version/url 严格一致（url=name_version=目录名）；"跨宿主共用目录"用同名三条 type 条目实现（WPS 会规范化改写 publish.xml 但保留三条目）。
7. **锁屏/显示器休眠冻结 webview**：锁屏后已注册 webview 的 JS 被挂起（AppNap），长轮询停摆 90 秒后被判离线；解锁+新冷启动才恢复。真机自动化必须 `caffeinate -d`（防显示休眠，而非仅 `-i` 防空闲）并在探针（status 3s 内返回）通过后才跑测试。

**最终验证结果（2026-09-30 09:42，et+wpp 双宿主同会话，全绿）**：
排序（JS 回退生效，销量列 [2000,1600,1200,800,600] 降序 ✓，响应含公式替换说明）｜图表 chart_add（ChartObjects 多形态探测生效，Chart 1 创建 ✓）｜CSV 导出（桌面落盘 219B ✓）｜PDF 导出（ExportAsFixedFormat，桌面 472KB ✓）｜WPP 宿主注册（4s ✓）｜slide_add（第 2 页 titleOnly ✓）｜textbox_add（20 号字文本框 ✓）｜slide_list（[(1,察元AI季度汇报),(2,表格助手战报)] ✓）｜WPP PDF 导出（桌面 58KB ✓）。
截图（/tmp/chayuan-verify/）：phase1-tab3.png（文字宿主 tab）、10-et-opened.png（表格宿主 tab+聊天面板）、11-et-range-write.png（写值+公式计算值）、40/41/42-final-*.png（最终态：排序+图表+tab、WPP 第 2 页 MCP 生成内容+tab）。
导出产物：~/Desktop/chayuan-et-export.{csv,pdf}、~/Desktop/chayuan-wpp-export.pdf。

**单宿主 tab 说明**：共用目录方案下 ET/WPP 宿主显示完整文字版 ribbon（含不适用的 Writer 按钮）——功能无碍（聊天页按宿主自适应），单按钮 tab 需 root 多目录安装（.pkg 路径已支持）。

**验证截图**（/tmp/chayuan-verify/）：phase1-tab3.png（文字宿主 tab 恢复）、10-et-opened.png（表格宿主 tab+聊天面板）、11-et-range-write.png（Q3 数据+公式计算值 598000/638400 落表）、phase3 系列等待解锁后补齐。
