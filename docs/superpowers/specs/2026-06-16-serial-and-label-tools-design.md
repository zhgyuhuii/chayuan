# 流水号 + 资产标签 两个确定性工具助手 — 设计文档

- 日期：2026-06-16
- 项目：chayuan-wps（WPS 加载项）
- 状态：设计已通过，待写实施计划
- 前置：工具助手分组骨架已落地（`tools.barcode` 已上线，见 `2026-06-16-tool-assistant-group-design.md`）

## 背景与目标

「工具助手分组」骨架已跑通并验证（条形码批量生成）。本期在同一骨架上**只加配置 + 少量生成/写回模块**，新增两个面向工业生产的确定性工具：

1. **流水号/批号生成 `tools.serial`** —— 模板占位符生成一批编号，写成多列文本表格。工单号/批次号刚需。
2. **资产/物料标签批量 `tools.label`** —— 粘贴多字段列表，每行合成一张「码 + 文字」标签图，网格排版。设备铭牌/库位卡/贴标。

两工具复用现有 `ToolAssistantPanel`（schema 驱动表单 + 预览）、落临时文件、图网格写回等能力，不新造 UI。

## 范围

- ✅ 流水号：自定义模板 `{seq:N}` / `{date:FMT}` / `{rand:N}` 三种占位符；输出多列文本表格。
- ✅ 标签：粘贴多字段列表（分隔符可选），首字段入码（二维码/Code128），版式「码在上、文字居中在下」，输出图网格。
- ✅ 顺带把**二维码生成能力**做出来（`qrcode` 库已装），供标签工具用、也为将来独立二维码工具复用。
- ❌ 本期不做：读选中文档表格作为标签数据源（留后续「变量数据打印」）、标签多版式切换、条码工具与本期工具的合并。

## 既有可复用事实（已核对源码）

| 能力 | 位置 | 复用方式 |
|---|---|---|
| 工具面板（schema 表单 + 预览 + 插入） | `ToolAssistantPanel.vue` | 直接复用，两工具各加一条 toolDefinitions 配置 |
| 工具定义表 | `toolDefinitions.js` | 加 `SERIAL_TOOL` / `LABEL_TOOL` 两条 |
| 助手注册 + 分组 | `assistantRegistry.js`（group `tools`） | 加 `tools.serial` / `tools.label` 两条（`isToolAssistant:true`，dialog-only：`defaultDisplayLocations:[]`） |
| 图网格写回（建表+逐格插图+宽度约束+定位修复） | `gridWriter.js` `writeGrid` | 标签工具直接复用 |
| 落临时文件 | `documentActions.js` `saveGeneratedAssetToFile` | 标签合成图落文件复用 |
| 二维码库 | `package.json` `qrcode ^1.5.4` 已装 | 新建 `qr.js` 薄封装 |
| 条码渲染 | `barcode.js` `renderBarcode` | 标签选 Code128 时复用 |

## 第 1 节 · 架构与共享新增

复用骨架，新增/改动模块：

- **`src/utils/tools/serialTemplate.js`**【纯逻辑·node 可测】
  - `expandTemplate(template, { start, step, count, date, rand })` → `{ items:[{ value, ok, error }], invalidCount }`
  - 占位符：
    - `{seq}` / `{seq:N}`：自增序号，从 `start` 起、步长 `step`、补零到 N 位。
    - `{date}` / `{date:FMT}`：日期，FMT 由 `YYYY/YY/MM/DD` 组合（如 `YYYYMMDD`、`YYYY-MM-DD`）；date 入参为 `Date` 或 ISO 串，默认调用方传今天。
    - `{rand:N}`：N 位随机串，字符集 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（去掉易混 0/O/1/I）。为可测，`expandTemplate` 接受可选 `rng`（默认 `Math.random`）。
  - 模板里非占位符文本原样输出（前后缀直接打字面）。未知 token（如 `{foo}`）→ 该项 `ok:false + error`，不阻断其它。
- **`src/utils/tools/qr.js`**【浏览器】
  - `renderQr(value, sizePx)` → 用 `qrcode` 库画 canvas → `toDataURL('image/png')`。
- **`src/utils/tools/labelComposer.js`**【浏览器 canvas】
  - `composeLabel({ codeDataUrl, textLines, size })` → 新建 canvas，居中绘制：上方码图、下方逐行居中文字（canvas `fillText`，支持中文，依赖 CEF 系统字体）→ `toDataURL('image/png')`。
  - 尺寸预设 small/medium/large 决定码边长与字号。
- **`src/utils/tools/gridWriter.js`**【WPS·改】
  - 抽出 `createGridTable(count, columns)`（建表 + 取表句柄 + 兜底，沿用现有逻辑），`writeGrid`(图) 复用它。
  - 新增 `writeTextGrid(values, { columns })`：建 N 列表格，逐格 `cell.Range.Text = value`，居中。复用 `createGridTable` 与单元格定位。

## 第 2 节 · 流水号工具 `tools.serial`

- 表单字段（formSchema）：
  - 模板 `template`（text，默认 `WP-{date:YYYYMMDD}-{seq:4}`）
  - 日期 `date`（date，默认今天）
  - 起始号 `start`（number，默认 1，min 0）
  - 步长 `step`（number，默认 1，min 1）
  - 个数 `count`（number，默认 10，min 1，max 500）
  - 每行列数 `columns`（number，默认 4，min 1，max 10）
- `generate(params)` → `expandTemplate(params.template, { start, step, count, date: params.date, rand })` → `{ items, invalidCount }`。
- `writeBack(genResult, params)` → `writeTextGrid(genResult.items.filter(ok).map(value), { columns: params.columns })`。
- 预览：面板复用现有列表预览渲染编号文本；非法项（模板错）标红。

## 第 3 节 · 资产/物料标签工具 `tools.label`

- 表单字段：
  - 粘贴列表 `listText`（textarea，每行一张标签）
  - 分隔符 `separator`（select：`|` / `Tab` / `逗号`，默认 `|`）
  - 码制 `codeType`（select：二维码 / Code128，默认二维码）
  - 每行列数 `columns`（number，默认 3，min 1，max 8）
  - 标签尺寸 `size`（select：小/中/大，默认中）
- `generate(params)`：
  1. 按行 split，去空行；每行按 `separator` 拆字段，trim。
  2. 第 1 字段 = 码内容，其余字段 = 文字行。
  3. 第 1 字段空 → 该项 `ok:false + error('缺少码内容')`，计入 invalidCount。
  4. 码内容 → `renderQr` 或 `barcode.renderBarcode`（按 codeType）得 codeDataUrl；失败 → `ok:false + error`。
  5. `composeLabel({ codeDataUrl, textLines, size })` → 标签 PNG dataUrl。
  6. 返回 `{ items:[{ value: 首字段, dataUrl, ok, error }], invalidCount }`。
- `writeBack(genResult, params)` → `writeGrid(genResult.items, { columns: params.columns, caption: false })`（文字已合进标签图，不另加 caption）。
- 预览：面板复用现有 canvas 图网格预览。

## 第 4 节 · 文件结构 / 复用 / 测试

**新增：**
- `src/utils/tools/serialTemplate.js`（纯逻辑）
- `src/utils/tools/qr.js`（浏览器）
- `src/utils/tools/labelComposer.js`（浏览器 canvas）

**改动：**
- `src/utils/tools/gridWriter.js`：抽 `createGridTable` + 加 `writeTextGrid`。
- `src/utils/tools/toolDefinitions.js`：加 `SERIAL_TOOL` / `LABEL_TOOL`。
- `src/utils/assistantRegistry.js`：注册 `tools.serial` / `tools.label`（group `tools`，`isToolAssistant:true`，`defaultDisplayLocations:[]`）。
- `scripts/test-barcode-tool-smoke.mjs`：加流水号模板 + 标签行解析断言（或新建 `test-tools-smoke.mjs`，与现有风格一致）。

**复用（不新造）：** `ToolAssistantPanel`、图/文本预览、`writeGrid`、落临时文件、单元格定位修复成果。

**测试：**
- node 冒烟（纯逻辑）：
  - `expandTemplate`：`{seq:4}` 补零、`step` 步长、`{date:FMT}` 各格式、`{rand:N}` 长度与字符集（注入固定 rng）、未知 token 标红、字面前后缀。
  - 标签行解析：按 `|`/Tab/逗号拆字段、空行跳过、首字段空标红。
- WPS 手测：二维码/条码渲染、标签 canvas 合成（中文绘制）、`writeTextGrid` 多列文本表、`writeGrid` 标签图网格定位与排版。

**落地顺序：** 先 `tools.serial`（建 `writeTextGrid` + 模板逻辑，纯逻辑可 TDD），再 `tools.label`（建 `qr.js` + `labelComposer.js` + 配置）。

## 风险

- canvas `fillText` 绘制中文依赖 WPS CEF 系统字体；多行长文字可能溢出标签，`composeLabel` 需按尺寸裁断/缩字号（手测调）。
- `writeTextGrid` 的 `cell.Range.Text=` 写入已有项目先例（ribbon.js:1735），风险低。
- 标签图同样走 `writeGrid` 的单元格定位与宽度约束（已修复并验证），风险低。
