# MCP 工具扩展方案 — table 切片 + caption/field 枚举

> 状态：**已实现并通过真机端到端逐项自测（v0.10.0 · 46 工具 · table 域 12 action）** · 遵守 `mcp-tool-architecture.zh-CN.md` §P7 工具三层纪律
> 扩展（用户反馈）：table 域追加 3 个结构写 action —— `row_insert` / `column_insert` / `cell_merge`（定位由 LLM 用 header_read/column_read 解析「在哪插」，工具只接收显式坐标；cell_merge 用 row1/col1/row2/col2 矩形角，同行=合并列、同列=合并行）。table action 9→12（超 ≤10 软上限，因用户明确要求）。已对 `爱唠叨的妈妈.docx` 真机验证：插入行 3→4、插入列 3→4、纵向合并 dir=rows、横向合并 dir=columns，17/17 通过。
> 范围：把表格/题注/域三类能力补齐，作为 `table`/`caption`/`field` 聚合域的 action 注入，**工具总数 44 → 46**（新增 2 个只读聚合域；table 仍算 1 个）。
> 非目标（明确不做）：任何 `*_check` / 判定型 `*_audit` / `*.renumber` / `alt_check` / 表头样式专属 action —— 见文末「明确剔除」。
>
> **落地结果（P1+P2+P3 全部完成）**：`scripts/mcp-table-caption-field-selftest.mjs` 真机 E2E 18 项全过、1 项软过（image.list 字段增强需图片夹具）。table 9 action / caption.list / field.list+add / image 增强 均经真机 Agent 验证（field.add SEQ 自动编号 result="1"；column_set_width 平均列宽 60.0pt；header_repeat=true）。

---

## 0. 纪律自检（每条 action 过 §P7 三关）

| action | 判断？ | 过度取数？ | 能 compose？ | 裁决 |
|---|---|---|---|---|
| table.list / row_read / column_read / cell_read / header_read | 否·事实 | 切片✅ | — | **做（read）** |
| table.header_repeat / column_set_width | 否 | — | range 改不了列宽/重复标题 | **做（几何写）** |
| table.export | 否 | — | 无法用通用原语导出 | **做** |
| caption.list | 否·事实 | 稀疏集合 list✅ | 解析非平凡 | **做（read）** |
| field.list | 否·事实 | 稀疏集合 list✅ | 域类型识别非平凡 | **做（read）** |
| field.add (SEQ/TOC) | 否 | — | 域代码构造非平凡 | **做（写）** |
| image.list 字段增强 | 否·事实 | — | — | **做（改返回）** |
| ~~table.header.style~~ | — | — | header.read→style.apply | **不做·compose** |
| ~~caption.check / renumber~~ | 是·判断 | — | — | **不做·交 LLM** |

---

## 1. `table` 域 action 集（扩展现有 aggregate）

现有 `table` 只有 `insert`。按下表扩展，**read 不需 confirmed；几何写需 confirmed**。

| action | 入参（关键） | 返回事实 | 说明 |
|---|---|---|---|
| `list` | limit? | [{tableIndex, rows, cols, range{start,end}, headerSnippet, captionSnippet, hasMerged}] | 轻量发现，**不返回全部单元格文本** |
| `header_read` | tableIndex | {cells[], range, repeatHeader} | 表头行事实（含是否重复标题） |
| `row_read` | tableIndex, row | {row, cells[], range} | 单行 |
| `column_read` | tableIndex, col | {col, cells[], merged?} | 单列（处理合并格） |
| `cell_read` | tableIndex, row, col | {text, range, mergedInto?} | 单元格 |
| `header_repeat` | tableIndex, repeat=true, **confirmed** | {repeatHeader} | 几何写：`Row.HeadingFormat=true` |
| `column_set_width` | tableIndex, col\|all, widthPt, **confirmed** | {applied} | 几何写：`Columns(i).Width` |
| `export` | format=csv\|md\|html, folder, **confirmed** | {exported[], count} | 逐表导出 |
| `insert` | rows, columns, confirmed | （现有） | 保留 |

**action enum**（inputSchema）：`insert | list | header_read | row_read | column_read | cell_read | header_repeat | column_set_width | export | row_insert | column_insert | cell_merge`（12 个；原 9 个 + 用户反馈新增 3 个结构写，超 ≤10 软上限）。

**compose 指引（写进 description）**：
- 改单元格文字 → `cell_read` 拿 range → `document_replace(start,end)`
- 表头加粗/标红 → `header_read` 拿 range → `format_run(start,end)`
- 表头套样式 → `header_read` 拿 range → `style(action=apply)`
- 统一列宽 → `list` 看 cols → LLM 算宽 → `column_set_width(all)`

`resolveAggregateCall` 新增映射（method 命名沿用 `table.<verb>`）：

```js
table: {
  insert:       { method: 'table.insert',        args: rest, requireConfirmed: true },
  list:         { method: 'table.list',           args: rest },
  header_read:  { method: 'table.header_read',    args: rest },
  row_read:     { method: 'table.row_read',       args: rest },
  column_read:  { method: 'table.column_read',    args: rest },
  cell_read:    { method: 'table.cell_read',      args: rest },
  header_repeat:{ method: 'table.header_repeat',  args: rest, requireConfirmed: true },
  column_set_width:{ method: 'table.column_set_width', args: rest, requireConfirmed: true },
  export:       { method: 'table.export',         args: rest, requireConfirmed: true }
}
```

---

## 2. `caption` 域（新增只读聚合，list only）

只枚举事实，**不做连续性判断**（交 LLM）。识别 `图N / 表N / 式N / 图N-M`、SEQ 域、纯文本。

| action | 入参 | 返回事实 |
|---|---|---|
| `list` | kind?=图\|表\|式\|all, limit? | [{index, kind, label, numberText, fullText, isSeqField, range{start,end}, precedingText, followingText}] |

`numberText` 只做"尽力解析"（正则取数字串），解析失败返回 null —— **是否连续/合规由 LLM 判**。

```js
caption: {
  list: { method: 'caption.list', args: rest }
}
```

工具定义 description 要点：「只读枚举题注事实；连续性/缺漏/标签统一性判断由你（LLM）完成，不要期望本工具给结论」。

---

## 3. `field` 域（新增聚合：list 只读 + add 构造）

| action | 入参 | 返回 / 作用 |
|---|---|---|
| `list` | type?=SEQ\|TOC\|PAGEREF\|DATE\|all, limit? | [{index, type, code, resultText, range, stale?}] 只读 |
| `add` | kind=seq\|toc, label?, upperLevel?/lowerLevel?(toc), **confirmed** | 插入 SEQ/TOC 域；失败降级纯文本，返回 `how:'seq'\|'toc'\|'plain'` |

`field.add` 是「写题注用 SEQ 域」的唯一入口（§P7 第 3 条：域构造非平凡，值得专属 action）。其余题注文本写入仍走 `document_insert`+`format_para`。

---

## 4. `image.list` 字段增强（无新 action，只改返回）

`handleImageList` 每个 item 增补：`altText`、`title`、`wrap`、`width`、`height`、`precedingText`、`followingText`。
→ 解锁 LLM 判断：alt 缺失、尺寸不一、无题注（**判断不做进工具**）。

---

## 5. 文件改动清单（端到端 5 处）

| 文件 | 改动 |
|---|---|
| `mcp-sidecar/lib/aggregateTools.mjs` | ① `table` 的 `resolveAggregateCall` 表 + inputSchema(action enum + 新参数 tableIndex/row/col/widthPt/repeat/format/folder) ② 新增 `caption`、`field` 两条 aggregate（`AGGREGATE_TOOLS` + `AGGREGATE_TOOL_NAMES` + resolve 表） |
| `mcp-sidecar/lib/toolCatalog.mjs` | `SERVER_INSTRUCTIONS` 层路由顺序补 `caption`/`field`；`toolRoutingGuide()` 的 L8-objects 层补这两个域 |
| `src/services/mcpBridge/objectStructureDispatch.js` | 新增 handler：`handleTableList/HeaderRead/RowRead/ColumnRead/CellRead/HeaderRepeat/ColumnSetWidth/Export`、`handleCaptionList`、`handleFieldList`、`handleFieldAdd`；增强 `handleImageList` 返回字段 |
| `src/services/mcpBridge/dispatch.js` | 新增 case 路由：`table.list/header_read/row_read/column_read/cell_read/header_repeat/column_set_width/export`、`caption.list`、`field.list`、`field.add` |
| `scripts/mcp-tools-callable.mjs` | 为新 action 加安全 probe（read 类直探；写类用 confirmed=true 探，目标用 __missing__ 触发预期错误） |

> 不动 `mcpHandler.mjs` 的 switch：新 action 全走聚合分支（`AGGREGATE_TOOL_NAMES.includes → resolveAggregateCall`），无需新增 case。**顺带建议另开 PR 清理那一批不可达的细粒度 case（见架构文档审查遗留①）。**

---

## 6. 自测与门禁

1. `node scripts/mcp-tools-callable.mjs` 重跑，确认 `last-tools-callable.json` 更新为 **44 tools / version 0.10.0**（P1 不新增工具数；P2 落地 caption/field 后变 46。修掉当前 0.6.0/41 旧名产物）。
2. `toolCatalog.mjs` `SERVER_INFO.version` → `0.10.0`（已落）。
3. read 类 action 用离线探针（Agent offline 时应回 `WPS_AGENT_OFFLINE` 而非 `TOOL_NOT_FOUND`，验证路由通）。
4. 在线 E2E（`mcp-wps-selftest.mjs`）覆盖：建表 → `list` → `header_read` → `cell_read` → `column_set_width` → `caption.list` 能看到该表题注。
5. 规划 §Phase D 评测集补 5 条中文说法（「读表头」「看第一列」「把表头加粗」「表重复标题行」「列出所有图题注」）。

---

## 7. 分期（每期可独立合并）

- **P1（最高价值，解锁一切）**：`table.list` + 四个切片 read（header/row/column/cell）。纯只读，零写风险。
- **P2（只读审计）**：`caption.list` + `field.list` + `image.list` 字段增强。
- **P3（几何写 + 域构造）**：`table.header_repeat`、`table.column_set_width`、`field.add`、`table.export`。

---

## 8. 明确剔除（防止回退到「判断工具 / 重复造轮子」）

- ❌ `caption.check` / `caption.renumber` —— 判断 + 策略，交 LLM 用 `caption.list` + `document_apply_ops`。
- ❌ `image.alt_check` —— alt 是 `image.list` 的一个事实字段。
- ❌ `table.header.style` —— compose `header_read` + `style(action=apply)`。
- ❌ 独立 `numbering audit` 工具 —— 编号是 list/outline 的事实，跳号判断交 LLM。
- ❌ `table.uniform`（策略名）—— 改名 `column_set_width`，宽度由 LLM 显式传。

---

## 待确认

1. `caption` / `field` 独立成域（工具数 +2 → 46）是否接受？还是要把 `caption.list` 挂到 `table`/`image` 下避免新增工具？（独立更干净，推荐）
2. P1 先行是否 OK？
3. `SERVER_INFO` 版本号定 `0.9.0`？
