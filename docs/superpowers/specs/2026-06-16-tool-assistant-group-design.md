# 工具助手分组 — 设计文档（首个工具：条形码批量生成）

- 日期：2026-06-16
- 项目：chayuan-wps（WPS 加载项）
- 状态：设计已通过，待写实施计划

## 背景与目标

现有助手系统里**所有助手都走大模型**（`systemPrompt` + `userPromptTemplate` → LLM → 写回文档），按 228 个领域组织。本需求引入一类**全新的「工具助手」**：

> 参数表单输入 → 确定性本地逻辑（纯前端 JS / 库）→ 结果写回文档，**中途不经过 LLM**。

第一期只落**条形码批量生成**一个工具，核心目的是**把「工具助手」这条新类型的通用骨架立稳**（表单 schema → 确定性生成 → 网格写回 + 预览面板），后续工具（二维码、流水号、变量数据标签等）按同一套只加配置即可，零改 UI、零改写回器。

## 范围

- ✅ 本期做：工具助手分组、条形码批量生成工具、通用 ToolAssistantPanel、通用网格写回器。
- ✅ 条码数据源：**自动流水号** + **手动粘贴列表**（两种）。
- ✅ 条码类型：**Code128 / EAN-13 / Code39**（JsBarcode）。
- ✅ 写回形态：**网格表格**（每格 = 条码图 + 下方编号文字），用于打印贴标。
- ❌ 本期不做：读取选中表格列取数（留给后续「变量数据标签」工具）、导出图片/复制到剪贴板、二维码及其他工具（仅证明骨架可扩展，不实现）。

## 既有可复用事实（已核对源码，非凭印象）

| 能力 | 位置 | 备注 |
|---|---|---|
| 助手执行入口 | `AIAssistantDialog.vue` `runAssistant(item)` | 工具助手在此**早期分叉**，不进对话/原参数收集 |
| LLM 执行核心 | `assistantTaskRunner.js` `executeAssistantTask()` | 工具助手**不经过**此链路 |
| 插入图片（吃 dataURL） | `documentActions.js` `tryAddInlinePicture(source, range)` | `source` 可为 dataURL ✅ |
| 建表格 | `documentInsertActions.js` `insertTableAtPosition({rows,columns})` | `doc.Tables.Add(range, rows, columns)` |
| 单元格写值 | `documentFormatActions.js` 遍历 `doc.Tables.Item(i).Rows.Item(j).Cells.Item(k).Range` | `cell.Range.Text = ...` |
| 取 WPS 应用/文档 | `documentActions.js` `getApplication()` / `getActiveDocument()` | 兼容 window / opener / parent |
| 分组定义 | `assistantRegistry.js` `ASSISTANT_GROUPS` / `ASSISTANT_GROUP_LABELS` | 新增 `tools` |
| 二维码库 | `package.json` `qrcode ^1.5.4` 已装 | 后续二维码工具可直接用 |
| 条码库 | **未装** | 需 `npm i jsbarcode`（纯前端，WPS 可跑） |

## 架构方案（方案 1：独立面板 + 工具注册表，与 LLM 链解耦）

```
用户点工具助手
  -> AIAssistantDialog.runAssistant(item)
       if runtimeCapabilities.isToolAssistant:   <-- 早期分叉
         右侧渲染 <ToolAssistantPanel :toolId="...">   （不进对话/原参数收集）
       else:
         走原有 LLM 链路（不变）

ToolAssistantPanel（通用，schema 驱动）
  -> 读 toolRegistry[toolId]
  -> 渲染 formSchema 表单
  -> 「生成预览」 -> tool.generate(params) -> canvas 网格预览
  -> 「插入到文档」 -> gridWriter.writeGrid({items, columns, caption})
```

工具逻辑完全不碰 `assistantTaskRunner`。条码生成、网格写回都是独立纯模块。

## 第 1 节 · 数据模型与分组

- `assistantRegistry.js`：`ASSISTANT_GROUPS` / `ASSISTANT_GROUP_LABELS` 新增 `tools` → 「工具助手」，排序在 core/analysis 之后、custom 之前。
- 条形码注册为内置助手，但带工具标记，**无 systemPrompt/userPromptTemplate**：

```js
{
  id: 'tools.barcode', label: '条形码批量生成', shortLabel: '条形码',
  icon: '▌▌', group: 'tools',
  runtimeCapabilities: { isToolAssistant: true, toolId: 'tools.barcode' },
  description: '按流水号或粘贴列表批量生成条形码，网格排版插入文档',
}
```

- 在助手列表/搜索里与普通助手一致出现，仅 `group:'tools'` + `isToolAssistant:true` 区分。
- 新建 `src/utils/tools/toolRegistry.js`，每工具一条：

```js
{ id:'tools.barcode', formSchema:[...], generate(params){...}, writeBack:{ columnsField:'columns', captionField:'showText' } }
```

面板由 schema + `generate()` 驱动，是**通用的**。

## 第 2 节 · 表单 Schema

字段类型表（骨架，后续工具复用）：`text / number / select / textarea / radio / checkbox`。

条码工具字段：

- **数据源** radio：`流水号` / `粘贴列表`
- 流水号模式：前缀 text、起始号 number(=1)、个数 number(=10)、补零位数 number(=4)、后缀 text(可空)
- 粘贴列表模式：textarea（每行一个编号）
- **条码类型** select：Code128 / EAN-13 / Code39
- **显示编号文字** checkbox（默认开）
- **每行列数** number（默认 4）
- **条码尺寸** select：小 / 中 / 大

数据源切换时显隐对应字段。

## 第 3 节 · UI：`ToolAssistantPanel.vue`（新组件）

- 分叉点：`runAssistant(item)` 开头判断 `isToolAssistant` → 右侧渲染 `ToolAssistantPanel`（传 toolId），不进对话/原参数收集。
- 三段式：
  1. **参数表单**：按 formSchema 渲染，数据源切换显隐字段。
  2. **生成预览**：点「生成预览」→ `tool.generate(params)` → 面板内 canvas 网格画出这批条码；非法编号标红列出，不阻塞合法项。
  3. **插入文档**：点「插入到文档」→ 见第 5 节。生成中/写回中禁用按钮。
- 本期**不做**导出图片/复制，只做「插入到文档」。

## 第 4 节 · 条码生成模块 `src/utils/tools/barcode.js`

- 依赖 `jsbarcode`（纯前端）。
- `buildCodeList(params)`：
  - 流水号：`前缀 + zeroPad(起始 + i, 位数) + 后缀`，共 N 个。
  - 粘贴列表：按行 split → trim → 去空行。
- `renderBarcode(value, type, size)`：离屏 `<canvas>` → `JsBarcode(canvas, value, { format, displayValue, ... })` → `canvas.toDataURL('image/png')`。
- `generate(params)` → `{ items:[{ value, dataUrl, ok, error }], invalidCount }`。每个 value 单独 try/catch，EAN-13 校验位/位数非法等只标 `ok:false + error`，不拖垮整批。
- 纯函数、无 WPS 依赖，可单测。

## 第 5 节 · 写回文档：通用网格渲染器 `src/utils/tools/gridWriter.js`

- 复用现成 API，不自造：
  1. `insertTableAtPosition({ rows, columns })`，行数 = ⌈合法项数 / 列数⌉。
  2. 遍历最后一张表的 `Rows/Cells`，每格：`tryAddInlinePicture(item.dataUrl, cell.Range)` 插图；若「显示编号」在图下方 `cell.Range` 追加 `value` 文字。多余格留空。
- 通用签名 `writeGrid({ items, columns, caption })`，条码 / 二维码 / 未来标签共用。
- 只写**合法项**（`ok:true`）；写回前若有非法项，面板提示「N 个编号非法已跳过」。

## 第 6 节 · 扩展模式（证明骨架可扩展）

加第二个工具（如二维码批量）只需：

1. `assistantRegistry` 加一条 `tools.qrcode`（group:tools, isToolAssistant）。
2. `toolRegistry` 加一条：formSchema（复用大部分字段）+ `generate()`（用已装的 `qrcode` 画图）。
3. 写回复用 `writeGrid()`，UI 复用 `ToolAssistantPanel`。

→ 零改 UI、零改写回器，纯加配置。

## 改动文件清单

- `src/utils/assistantRegistry.js`：加 `tools` 分组 + 条码助手注册。
- 新增 `src/utils/tools/toolRegistry.js`、`src/utils/tools/barcode.js`、`src/utils/tools/gridWriter.js`。
- 新增 `src/components/ToolAssistantPanel.vue`。
- `src/components/AIAssistantDialog.vue`：`runAssistant` 分叉 + 挂载面板。
- `package.json`：`+ jsbarcode`。

## 验证计划

- 单测：`barcode.js` 的 `buildCodeList`（流水号序列、补零、粘贴列表解析）+ EAN-13 非法值标记。
- targeted lint：`npx eslint` 触达的 `.vue` / `.js`。
- WPS 内手测：
  - 流水号 12 个 / 4 列 → 文档出 3×4 网格、图 + 编号。
  - 粘贴含 1 个非法 EAN-13 → 提示「1 个编号非法已跳过」，仅插合法项。

## 风险

- JsBarcode 在 WPS 内核渲染 canvas/toDataURL 的兼容性需手测确认（qrcode 已验证可行，机制类似，风险低）。
- 往表格单元格 `cell.Range` 插图 + 追加文字的顺序与定位需手测微调（现成 API 支持，但单元格内图文混排细节待验）。
