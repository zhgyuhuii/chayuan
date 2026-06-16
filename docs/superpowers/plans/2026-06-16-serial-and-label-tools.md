# 流水号 + 资产标签 工具助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已落地的「工具助手分组」骨架上，新增两个面向工业生产的确定性工具——流水号/批号生成（模板占位符 → 多列文本表格）和资产/物料标签批量（粘贴多字段 → 码+文字合成标签 → 图网格）。

**Architecture:** 复用现有 `ToolAssistantPanel`（schema 表单+预览）、`writeGrid`（图网格写回）、`saveGeneratedAssetToFile`（落临时文件）。新增纯逻辑模块（`serialTemplate.js` 模板展开、`labelData.js` 行解析，node 可 TDD），浏览器模块（`qr.js` 二维码、`labelComposer.js` canvas 合成、`label.js` 编排），并给 `gridWriter.js` 抽 `createGridTable` + 加 `writeTextGrid`。每个工具只是一条 `toolDefinitions` 配置 + 一条 `assistantRegistry` 注册。

**Tech Stack:** Vue3 Options API + Vite；`qrcode ^1.5.4`（已装）；`jsbarcode`（已装，标签选 Code128 时复用）；浏览器 canvas；WPS Tables/InlineShapes API。测试沿用 `scripts/*.mjs` 冒烟脚本（assert/failures，node 直跑，无 jest）。

**提交约定：** 本仓库 commit/push 需 `sudo git`（admin 无 .git/objects 写权限）。分支固定 `main`，不新建分支、不 push（除非另行要求）。

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/utils/tools/serialTemplate.js` | 纯逻辑：模板 `{seq:N}`/`{date:FMT}`/`{rand:N}` 展开。node 可测 | Create |
| `src/utils/tools/labelData.js` | 纯逻辑：粘贴列表按分隔符拆字段。node 可测 | Create |
| `src/utils/tools/qr.js` | 浏览器：qrcode 库出二维码 dataURL | Create |
| `src/utils/tools/labelComposer.js` | 浏览器 canvas：码+文字合成「码上文下」标签 PNG | Create |
| `src/utils/tools/label.js` | 浏览器：编排 解析→出码→合成 的 generate(params) | Create |
| `src/utils/tools/gridWriter.js` | 抽 `createGridTable` + 加 `writeTextGrid`（文本网格） | Modify |
| `src/components/ToolAssistantPanel.vue` | 加 `date` 输入类型 + 文本项预览渲染 | Modify |
| `src/utils/tools/toolDefinitions.js` | 加 `SERIAL_TOOL` / `LABEL_TOOL` | Modify |
| `src/utils/assistantRegistry.js` | 注册 `tools.serial` / `tools.label` | Modify |
| `scripts/test-serial-label-smoke.mjs` | 冒烟测试两个纯逻辑模块 + 注册 | Create |

---

## Task 1: 流水号模板纯逻辑 `serialTemplate.js`

**Files:**
- Create: `src/utils/tools/serialTemplate.js`
- Create: `scripts/test-serial-label-smoke.mjs`

- [ ] **Step 1: 写失败的冒烟测试**

Create `scripts/test-serial-label-smoke.mjs`:

```js
#!/usr/bin/env node
const repoRoot = new URL('..', import.meta.url).href
let failures = 0
function assert(name, condition, detail = '') {
  if (condition) { console.log(`✓ ${name}`) }
  else { console.log(`✗ ${name}${detail ? ` - ${detail}` : ''}`); failures += 1 }
}

async function main() {
  console.log('Serial + Label tools smoke tests\n')
  const { expandTemplate } = await import(repoRoot + 'src/utils/tools/serialTemplate.js')

  // seq 补零 + 个数
  const a = expandTemplate('WP-{seq:4}', { start: 1, count: 3, step: 1 })
  assert('seq 个数', a.items.length === 3, `got ${a.items.length}`)
  assert('seq 首项补零', a.items[0].value === 'WP-0001', `got ${a.items[0].value}`)
  assert('seq 末项', a.items[2].value === 'WP-0003', `got ${a.items[2].value}`)

  // step 步长
  const b = expandTemplate('{seq:2}', { start: 10, count: 2, step: 5 })
  assert('step 首项', b.items[0].value === '10', `got ${b.items[0].value}`)
  assert('step 次项', b.items[1].value === '15', `got ${b.items[1].value}`)

  // date 各格式（用本地构造的固定日期 2026-06-16 避免时区）
  const d = new Date(2026, 5, 16)
  assert('date YYYYMMDD', expandTemplate('{date:YYYYMMDD}', { count: 1, date: d }).items[0].value === '20260616')
  assert('date YYYY-MM-DD', expandTemplate('{date:YYYY-MM-DD}', { count: 1, date: d }).items[0].value === '2026-06-16')
  assert('date YYMMDD', expandTemplate('{date:YYMMDD}', { count: 1, date: d }).items[0].value === '260616')

  // rand 长度与字符集（注入固定 rng）
  const r0 = expandTemplate('{rand:4}', { count: 1, rng: () => 0 })
  assert('rand 固定rng=0 全A', r0.items[0].value === 'AAAA', `got ${r0.items[0].value}`)
  const rr = expandTemplate('{rand:6}', { count: 1, rng: () => 0.5 })
  assert('rand 长度', rr.items[0].value.length === 6)
  assert('rand 字符集', /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/.test(rr.items[0].value))

  // 字面前后缀 + 组合
  assert('字面前后缀', expandTemplate('AB{seq:2}CD', { start: 1, count: 1 }).items[0].value === 'AB01CD')

  // 未知 token 标红不阻断
  const u = expandTemplate('{foo}', { count: 1 })
  assert('未知token ok=false', u.items[0].ok === false)
  assert('未知token 计入invalid', u.invalidCount === 1)

  console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/test-serial-label-smoke.mjs`
Expected: FAIL（`Cannot find module .../serialTemplate.js`）

- [ ] **Step 3: 写实现**

Create `src/utils/tools/serialTemplate.js`:

```js
// 流水号模板纯逻辑：展开 {seq:N} / {date:FMT} / {rand:N}。无浏览器依赖，可 node 测试。

const RAND_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混 0/O/1/I

function zeroPad(num, width) {
  const s = String(num)
  const w = Math.max(0, Number(width) || 0)
  return s.length >= w ? s : '0'.repeat(w - s.length) + s
}

function formatDate(dateVal, fmt) {
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal)
  if (Number.isNaN(d.getTime())) throw new Error('日期无效')
  const YYYY = String(d.getFullYear())
  const YY = YYYY.slice(-2)
  const MM = zeroPad(d.getMonth() + 1, 2)
  const DD = zeroPad(d.getDate(), 2)
  return String(fmt || 'YYYYMMDD')
    .replace(/YYYY/g, YYYY)
    .replace(/YY/g, YY)
    .replace(/MM/g, MM)
    .replace(/DD/g, DD)
}

function randStr(n, rng) {
  let s = ''
  for (let i = 0; i < n; i += 1) {
    s += RAND_CHARSET[Math.floor(rng() * RAND_CHARSET.length)]
  }
  return s
}

function renderOne(tpl, seqVal, dateVal, rng) {
  return tpl.replace(/\{([^}]*)\}/g, (m, body) => {
    const seqMatch = /^seq(?::(\d+))?$/.exec(body)
    if (seqMatch) return zeroPad(seqVal, seqMatch[1] ? Number(seqMatch[1]) : 0)
    const dateMatch = /^date(?::([YMD-]+))?$/.exec(body)
    if (dateMatch) return formatDate(dateVal, dateMatch[1] || 'YYYYMMDD')
    const randMatch = /^rand:(\d+)$/.exec(body)
    if (randMatch) return randStr(Number(randMatch[1]), rng)
    throw new Error(`未知占位符 {${body}}`)
  })
}

// options: { start, step, count, date, rng }
// 返回 { items:[{ value, ok, error }], invalidCount }
export function expandTemplate(template, options = {}) {
  const tpl = String(template == null ? '' : template)
  const rawStart = Number(options.start)
  const start = Number.isFinite(rawStart) ? Math.max(0, Math.trunc(rawStart)) : 1
  const rawStep = Number(options.step)
  const step = Number.isFinite(rawStep) ? Math.trunc(rawStep) : 1
  const count = Math.max(0, Number(options.count) || 0)
  const rng = typeof options.rng === 'function' ? options.rng : Math.random
  const dateVal = options.date ? options.date : new Date()
  const items = []
  let invalidCount = 0
  for (let i = 0; i < count; i += 1) {
    try {
      items.push({ value: renderOne(tpl, start + i * step, dateVal, rng), ok: true })
    } catch (e) {
      invalidCount += 1
      items.push({ value: '', ok: false, error: e?.message || '模板错误' })
    }
  }
  return { items, invalidCount }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node scripts/test-serial-label-smoke.mjs`
Expected: PASS（`ALL PASS`，exit 0）

- [ ] **Step 5: 提交**

```bash
git -C /work/chayuan-wps add src/utils/tools/serialTemplate.js scripts/test-serial-label-smoke.mjs
sudo git -C /work/chayuan-wps commit -m "feat(tools): add serial number template expander (seq/date/rand) with smoke test"
```

---

## Task 2: gridWriter 抽 createGridTable + 加 writeTextGrid

WPS API，node 不可测；给完整实现 + 验证既有条码冒烟与 build 不破。

**Files:**
- Modify: `src/utils/tools/gridWriter.js`

- [ ] **Step 1: 重构建表逻辑为 createGridTable 并加 writeTextGrid**

打开 `src/utils/tools/gridWriter.js`。当前 `writeGrid` 内部有「算 rows → insertTableAtPosition → 取 table 句柄 + 兜底」这段。改为：在文件中（`writeGrid` 之前）新增 `createGridTable`，并把 `writeGrid` 里那段建表代码替换为调用它；末尾新增 `writeTextGrid`。

在 `materializeImageFile` 函数之后、`export function writeGrid` 之前，插入：

```js
// 建一张 ceil(count/columns) 行 × columns 列的表,返回表句柄。两种网格写回共用。
function createGridTable(count, columns) {
  const cols = Math.max(1, Number(columns) || 1)
  const rows = Math.ceil(count / cols)
  const created = insertTableAtPosition({ rows, columns: cols })
  const doc = getActiveDocument()
  let table = created && created.table
  if (!table) {
    // 兜底：旧版 WPS 若 Tables.Add 不返回句柄，退回取末表
    const tables = doc?.Tables
    const tableCount = tables?.Count || 0
    if (!tableCount) throw new Error('未能创建表格')
    table = tables.Item(tableCount)
  }
  if (!table) throw new Error('未能创建表格')
  return { table, rows, columns: cols, doc }
}
```

把 `writeGrid` 里原来这段：

```js
  const rows = Math.ceil(valid.length / columns)
  const created = insertTableAtPosition({ rows, columns })

  const doc = getActiveDocument()
  let table = created && created.table
  if (!table) {
    // 兜底：旧版 WPS 若 Tables.Add 不返回句柄，退回取末表（已知在光标后有旧表时不准，仅兜底）
    const tables = doc?.Tables
    const tableCount = tables?.Count || 0
    if (!tableCount) throw new Error('未能创建表格')
    table = tables.Item(tableCount)
  }
  if (!table) throw new Error('未能创建表格')
```

替换为：

```js
  const { table, rows, doc } = createGridTable(valid.length, columns)
```

（`writeGrid` 后续用到 `doc`（readUsableWidthPt）、`table`、`rows`、`columns`、`imageWidthPt`，均保持不变。）

在文件**末尾**新增文本网格写回：

```js
// 把字符串铺进 N 列表格,每格写文本并居中。供流水号等文本类工具复用。
// values: string[]（已是要写入的最终编号）;options: { columns:number }
// 返回 { written:number, rows:number, columns:number }
export function writeTextGrid(values, options = {}) {
  const list = (values || []).filter((v) => v != null && String(v).length > 0).map(String)
  const columns = Math.max(1, Number(options.columns) || 1)
  if (list.length === 0) return { written: 0, rows: 0, columns }

  const { table, rows } = createGridTable(list.length, columns)
  for (let i = 0; i < list.length; i += 1) {
    const rowIndex = Math.floor(i / columns) + 1
    const colIndex = (i % columns) + 1
    const cell = table.Rows.Item(rowIndex).Cells.Item(colIndex)
    try {
      cell.Range.Text = list[i]
    } catch (_) { /* 单格写入失败则跳过 */ }
    try {
      cell.Range.ParagraphFormat.Alignment = 1 // wdAlignParagraphCenter
    } catch (_) { /* 不支持段落对齐则跳过 */ }
  }
  return { written: list.length, rows, columns }
}
```

- [ ] **Step 2: 校验语法 + import + 既有条码冒烟不破**

Run: `cd /work/chayuan-wps && npx eslint src/utils/tools/gridWriter.js --no-ignore`
Expected: 无 error。

Run: `cd /work/chayuan-wps && node -e "import('./src/utils/tools/gridWriter.js').then(m=>console.log(typeof m.writeGrid, typeof m.writeTextGrid)).catch(e=>{console.error('FAIL',e.message);process.exit(1)})"`
Expected: `function function`（stderr 的 window 噪声忽略）。

Run: `cd /work/chayuan-wps && node scripts/test-barcode-tool-smoke.mjs 2>/dev/null | tail -2`
Expected: `ALL PASS`（条码 writeGrid 重构后纯逻辑断言不受影响）。

- [ ] **Step 3: 提交**

```bash
git -C /work/chayuan-wps add src/utils/tools/gridWriter.js
sudo git -C /work/chayuan-wps commit -m "refactor(tools): extract createGridTable + add writeTextGrid for text grids"
```

---

## Task 3: ToolAssistantPanel 支持 date 输入 + 文本项预览

**Files:**
- Modify: `src/components/ToolAssistantPanel.vue`

- [ ] **Step 1: 加 date 输入类型**

在模板表单字段渲染区，`number` 那个 `<input>` 之后、`textarea` 之前（或紧邻 number），新增 date 分支：

```vue
          <input v-else-if="field.type === 'date'" type="date" v-model="params[field.key]" />
```

- [ ] **Step 2: 预览支持文本项（无 dataUrl 的 ok 项显示编号文本）**

把预览单元格里：

```vue
          <img v-if="it.ok" :src="it.dataUrl" alt="" />
          <span v-else class="tool-preview-cell__err">{{ it.value }}：{{ it.error }}</span>
```

改为：

```vue
          <img v-if="it.ok && it.dataUrl" :src="it.dataUrl" alt="" />
          <span v-else-if="it.ok" class="tool-preview-cell__text">{{ it.value }}</span>
          <span v-else class="tool-preview-cell__err">{{ it.value }}：{{ it.error }}</span>
```

在 `<style scoped>` 里 `.tool-preview-cell__err` 附近加：

```css
.tool-preview-cell__text { font-size: 13px; color: #333; word-break: break-all; }
```

- [ ] **Step 3: 校验 + build**

Run: `cd /work/chayuan-wps && npx eslint src/components/ToolAssistantPanel.vue --no-ignore`
Expected: 0 error。

Run: `cd /work/chayuan-wps && npx vite build --mode development 2>&1 | tail -3`
Expected: `✓ built`。

- [ ] **Step 4: 提交**

```bash
git -C /work/chayuan-wps add src/components/ToolAssistantPanel.vue
sudo git -C /work/chayuan-wps commit -m "feat(tools): ToolAssistantPanel supports date input + text-item preview"
```

---

## Task 4: 流水号工具 toolDefinitions + 注册

**Files:**
- Modify: `src/utils/tools/toolDefinitions.js`
- Modify: `src/utils/assistantRegistry.js`
- Modify: `scripts/test-serial-label-smoke.mjs`

- [ ] **Step 1: 加 SERIAL_TOOL 到 toolDefinitions**

打开 `src/utils/tools/toolDefinitions.js`。在文件顶部 import 区加：

```js
import { expandTemplate } from './serialTemplate.js'
import { writeTextGrid } from './gridWriter.js'
```

（`writeGrid` 已 import；把 `writeTextGrid` 加进同一行或新加一行 import。先 Read 现有 import 行确认。）

在 `BARCODE_TOOL` 定义之后、`const TOOL_DEFINITIONS = ...` 之前，加：

```js
const SERIAL_TOOL = {
  id: 'tools.serial',
  label: '流水号批量生成',
  formSchema: [
    { key: 'template', type: 'text', label: '编号模板', default: 'WP-{date:YYYYMMDD}-{seq:4}' },
    { key: 'date', type: 'date', label: '日期（空=今天）', default: '' },
    { key: 'start', type: 'number', label: '起始号', default: 1, min: 0 },
    { key: 'step', type: 'number', label: '步长', default: 1, min: 1 },
    { key: 'count', type: 'number', label: '个数', default: 10, min: 1, max: 500 },
    { key: 'columns', type: 'number', label: '每行列数', default: 4, min: 1, max: 10 }
  ],
  generate: (params) => expandTemplate(params.template, {
    start: params.start, step: params.step, count: params.count,
    date: params.date || undefined
  }),
  writeBack: (genResult, params) =>
    writeTextGrid(genResult.items.filter((it) => it.ok).map((it) => it.value), { columns: params.columns })
}
```

把 `TOOL_DEFINITIONS` 这行改为同时收录 SERIAL_TOOL：

```js
const TOOL_DEFINITIONS = {
  [BARCODE_TOOL.id]: BARCODE_TOOL,
  [SERIAL_TOOL.id]: SERIAL_TOOL
}
```

- [ ] **Step 2: 注册 tools.serial 助手**

打开 `src/utils/assistantRegistry.js`，找到 `tools.barcode` 注册对象（在 `CORE_BUILTIN_ASSISTANTS` 数组里，约 line 1496）。在它之后追加一条同构对象：

```js
  {
    id: 'tools.serial',
    label: '流水号批量生成',
    shortLabel: '流水号',
    icon: '🔢',
    group: 'tools',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: [],
    allowedActions: ['none'],
    defaultAction: 'none',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    runtimeCapabilities: { isToolAssistant: true, toolId: 'tools.serial' },
    description: '按模板（{seq}/{date}/{rand}）批量生成流水号/批号，多列表格写入文档'
  },
```

> 字段对齐 `tools.barcode`。`INPUT_SOURCE_SELECTION_PREFERRED` 与 barcode 用的同一常量，确认它在文件作用域内可用（barcode 注册已用它）。

- [ ] **Step 3: 冒烟断言（注册 + 默认参数 + 生成链路）**

在 `scripts/test-serial-label-smoke.mjs` 的 `main()` 末尾（总结 `console.log` 之前）加：

```js
  const td = await import(repoRoot + 'src/utils/tools/toolDefinitions.js')
  const serial = td.getToolDefinition('tools.serial')
  assert('流水号工具已注册', !!serial && serial.id === 'tools.serial')
  const sp = td.buildDefaultParams(serial)
  assert('流水号默认模板', sp.template === 'WP-{date:YYYYMMDD}-{seq:4}')
  assert('流水号默认个数10', sp.count === 10)
  // generate 走通(纯逻辑,不碰 WPS)
  const sg = serial.generate({ template: 'X-{seq:3}', start: 1, step: 1, count: 2, date: '' })
  assert('流水号 generate 出2项', sg.items.length === 2 && sg.items[0].value === 'X-001')

  const reg2 = await import(repoRoot + 'src/utils/assistantRegistry.js')
  assert('getAssistantToolInfo 命中流水号', reg2.getAssistantToolInfo('tools.serial')?.toolId === 'tools.serial')
```

Run: `cd /work/chayuan-wps && node scripts/test-serial-label-smoke.mjs 2>/dev/null | tail -6`
Expected: `ALL PASS`。

> 注：generate 里 `date:''` → expandTemplate 用 `new Date()`（今天），模板 `X-{seq:3}` 不含 date，结果与今天无关，断言稳定。

- [ ] **Step 4: 校验 + 提交**

Run: `cd /work/chayuan-wps && npx eslint src/utils/tools/toolDefinitions.js src/utils/assistantRegistry.js --no-ignore`
Expected: toolDefinitions 0 error；assistantRegistry error 数与改前一致（用 git stash 对比，0 新增）。

```bash
git -C /work/chayuan-wps add src/utils/tools/toolDefinitions.js src/utils/assistantRegistry.js scripts/test-serial-label-smoke.mjs
sudo git -C /work/chayuan-wps commit -m "feat(tools): add serial-number tool assistant (tools.serial)"
```

---

## Task 5: 标签行解析纯逻辑 `labelData.js`

**Files:**
- Create: `src/utils/tools/labelData.js`
- Modify: `scripts/test-serial-label-smoke.mjs`

- [ ] **Step 1: 写失败的冒烟断言**

在 `scripts/test-serial-label-smoke.mjs` 顶部 `expandTemplate` import 之后加一行 import，并在 `main()` 里 serial 断言之后加 label 解析断言：

import 行（与现有 import 并列）：
```js
  const { parseLabelRows } = await import(repoRoot + 'src/utils/tools/labelData.js')
```

断言（放在 serial 断言之后、总结之前）：
```js
  const rows = parseLabelRows('WP-001 | 电机 | 220V\nWP-002|减速器\n\n  ', '|')
  assert('label 行数(空行跳过)', rows.length === 2, `got ${rows.length}`)
  assert('label 字段拆分+trim', rows[0].length === 3 && rows[0][0] === 'WP-001' && rows[0][1] === '电机')
  assert('label 第二行2字段', rows[1].length === 2 && rows[1][1] === '减速器')
  const rowsTab = parseLabelRows('A\tB\tC', 'tab')
  assert('label tab 分隔', rowsTab[0].length === 3 && rowsTab[0][2] === 'C')
  const rowsComma = parseLabelRows('A,B', 'comma')
  assert('label 逗号分隔', rowsComma[0].length === 2 && rowsComma[0][1] === 'B')
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/test-serial-label-smoke.mjs`
Expected: FAIL（`Cannot find module .../labelData.js`）

- [ ] **Step 3: 写实现**

Create `src/utils/tools/labelData.js`:

```js
// 标签数据纯逻辑：把粘贴的多行多字段文本按分隔符拆成 string[][]。无浏览器依赖,可 node 测试。

// separator: '|' | 'tab' | 'comma'
function resolveSep(separator) {
  if (separator === 'tab') return '\t'
  if (separator === 'comma') return ','
  return '|'
}

// 返回 string[][]：每行一个字段数组；空行跳过；字段已 trim。
export function parseLabelRows(listText, separator) {
  const sep = resolveSep(separator)
  return String(listText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(sep).map((f) => f.trim()))
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node scripts/test-serial-label-smoke.mjs`
Expected: `ALL PASS`。

- [ ] **Step 5: 提交**

```bash
git -C /work/chayuan-wps add src/utils/tools/labelData.js scripts/test-serial-label-smoke.mjs
sudo git -C /work/chayuan-wps commit -m "feat(tools): add label row parser (separator split) with smoke test"
```

---

## Task 6: 二维码 + 标签合成 + 编排（浏览器模块）

canvas/Image/qrcode，node 不可实跑渲染；给完整实现 + import 不抛错 + build。

**Files:**
- Create: `src/utils/tools/qr.js`
- Create: `src/utils/tools/labelComposer.js`
- Create: `src/utils/tools/label.js`

- [ ] **Step 1: 写 qr.js**

Create `src/utils/tools/qr.js`:

```js
// 二维码渲染：用 qrcode 库出 PNG dataURL。依赖浏览器(toDataURL 内部用 canvas),仅在 WPS/浏览器运行。
import QRCode from 'qrcode'

// 返回 Promise<dataURL>
export function renderQr(value, sizePx) {
  return QRCode.toDataURL(String(value), { width: Math.max(40, Number(sizePx) || 160), margin: 1 })
}
```

- [ ] **Step 2: 写 labelComposer.js**

Create `src/utils/tools/labelComposer.js`:

```js
// 标签合成：码图在上、文字逐行居中在下,合成一张 PNG dataURL。浏览器 canvas,仅在 WPS/浏览器运行。

const SIZE_PRESET = {
  small: { code: 80, font: 11, pad: 6, line: 15, width: 120 },
  medium: { code: 120, font: 14, pad: 8, line: 19, width: 170 },
  large: { code: 170, font: 18, pad: 10, line: 24, width: 230 }
}

// { codeDataUrl, textLines:string[], size } -> Promise<dataURL>
export function composeLabel({ codeDataUrl, textLines, size }) {
  return new Promise((resolve, reject) => {
    const p = SIZE_PRESET[size] || SIZE_PRESET.medium
    const lines = (textLines || []).filter((t) => t != null && String(t).length > 0).map(String)
    const img = new Image()
    img.onload = () => {
      try {
        const w = p.width
        const codeH = p.code
        const h = p.pad * 2 + codeH + (lines.length ? p.pad + lines.length * p.line : 0)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, (w - codeH) / 2, p.pad, codeH, codeH)
        ctx.fillStyle = '#000000'
        ctx.font = `${p.font}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        let y = p.pad + codeH + p.pad
        lines.forEach((t) => { ctx.fillText(t, w / 2, y); y += p.line })
        resolve(canvas.toDataURL('image/png'))
      } catch (e) {
        reject(e instanceof Error ? e : new Error('标签合成失败'))
      }
    }
    img.onerror = () => reject(new Error('码图加载失败'))
    img.src = codeDataUrl
  })
}
```

- [ ] **Step 3: 写 label.js（编排 generate）**

Create `src/utils/tools/label.js`:

```js
// 标签工具编排:解析行 -> 出码(二维码/条码) -> 合成标签图。浏览器,仅在 WPS/浏览器运行。
import { parseLabelRows } from './labelData.js'
import { renderQr } from './qr.js'
import { renderBarcode } from './barcode.js'
import { composeLabel } from './labelComposer.js'

const QR_PX = { small: 120, medium: 180, large: 260 }

// params: { listText, separator, codeType:'QR'|'CODE128', size }
// 返回 { items:[{ value, dataUrl, ok, error }], invalidCount }
export async function generate(params = {}) {
  const rows = parseLabelRows(params.listText, params.separator)
  const size = params.size || 'medium'
  const items = []
  let invalidCount = 0
  for (let i = 0; i < rows.length; i += 1) {
    const fields = rows[i]
    const codeValue = fields[0] || ''
    const textLines = fields.slice(1)
    if (!codeValue) {
      invalidCount += 1
      items.push({ value: '(空)', dataUrl: '', ok: false, error: '缺少码内容' })
      continue
    }
    try {
      const codeDataUrl = params.codeType === 'CODE128'
        ? renderBarcode(codeValue, 'CODE128', size, false)
        : await renderQr(codeValue, QR_PX[size] || QR_PX.medium)
      const dataUrl = await composeLabel({ codeDataUrl, textLines, size })
      items.push({ value: codeValue, dataUrl, ok: true })
    } catch (e) {
      invalidCount += 1
      items.push({ value: codeValue, dataUrl: '', ok: false, error: e?.message || '标签生成失败' })
    }
  }
  return { items, invalidCount }
}
```

- [ ] **Step 4: 校验 + import 不抛错**

Run: `cd /work/chayuan-wps && npx eslint src/utils/tools/qr.js src/utils/tools/labelComposer.js src/utils/tools/label.js --no-ignore`
Expected: 0 error。

Run: `cd /work/chayuan-wps && node -e "Promise.all([import('./src/utils/tools/qr.js'),import('./src/utils/tools/labelComposer.js'),import('./src/utils/tools/label.js')]).then(([q,c,l])=>console.log(typeof q.renderQr,typeof c.composeLabel,typeof l.generate)).catch(e=>{console.error('FAIL',e.message);process.exit(1)})"`
Expected: `function function function`（qrcode 库在 node 端可 import；canvas/Image 仅在调用时触达，import 不抛错）。

> 若某模块 node import 抛错（例如 qrcode 顶层访问 DOM），把该模块的 `import QRCode from 'qrcode'` 改为在 `renderQr` 内 `const QRCode = (await import('qrcode')).default`（renderQr 已是 async），重跑本步。如实报告最终写法。

- [ ] **Step 5: 提交**

```bash
git -C /work/chayuan-wps add src/utils/tools/qr.js src/utils/tools/labelComposer.js src/utils/tools/label.js
sudo git -C /work/chayuan-wps commit -m "feat(tools): add qr renderer + label composer + label generate orchestration"
```

---

## Task 7: 标签工具 toolDefinitions + 注册

**Files:**
- Modify: `src/utils/tools/toolDefinitions.js`
- Modify: `src/utils/assistantRegistry.js`
- Modify: `scripts/test-serial-label-smoke.mjs`

- [ ] **Step 1: 加 LABEL_TOOL**

打开 `src/utils/tools/toolDefinitions.js`。顶部 import 区加：

```js
import { generate as generateLabel } from './label.js'
```

（`writeGrid` 已 import。）在 `SERIAL_TOOL` 之后、`TOOL_DEFINITIONS` 之前加：

```js
const LABEL_TOOL = {
  id: 'tools.label',
  label: '资产物料标签批量',
  formSchema: [
    { key: 'listText', type: 'textarea', label: '标签列表（每行一张，字段用分隔符；首字段入码）', default: '' },
    {
      key: 'separator', type: 'select', label: '字段分隔符', default: '|',
      options: [{ value: '|', label: '竖线 |' }, { value: 'tab', label: 'Tab' }, { value: 'comma', label: '逗号' }]
    },
    {
      key: 'codeType', type: 'select', label: '码制', default: 'QR',
      options: [{ value: 'QR', label: '二维码' }, { value: 'CODE128', label: 'Code128' }]
    },
    { key: 'columns', type: 'number', label: '每行列数', default: 3, min: 1, max: 8 },
    {
      key: 'size', type: 'select', label: '标签尺寸', default: 'medium',
      options: [{ value: 'small', label: '小' }, { value: 'medium', label: '中' }, { value: 'large', label: '大' }]
    }
  ],
  generate: (params) => generateLabel(params),
  writeBack: (genResult, params) =>
    writeGrid(genResult.items, { columns: params.columns, caption: false })
}
```

把 `TOOL_DEFINITIONS` 改为收录三个：

```js
const TOOL_DEFINITIONS = {
  [BARCODE_TOOL.id]: BARCODE_TOOL,
  [SERIAL_TOOL.id]: SERIAL_TOOL,
  [LABEL_TOOL.id]: LABEL_TOOL
}
```

- [ ] **Step 2: 注册 tools.label 助手**

`src/utils/assistantRegistry.js`，在 `tools.serial` 注册对象之后追加：

```js
  {
    id: 'tools.label',
    label: '资产物料标签批量',
    shortLabel: '资产标签',
    icon: '🏷️',
    group: 'tools',
    modelType: 'chat',
    defaultModelCategory: 'chat',
    supportsRibbon: false,
    defaultDisplayLocations: [],
    allowedActions: ['none'],
    defaultAction: 'none',
    defaultOutputFormat: 'plain',
    defaultInputSource: INPUT_SOURCE_SELECTION_PREFERRED,
    runtimeCapabilities: { isToolAssistant: true, toolId: 'tools.label' },
    description: '粘贴多字段列表，每行合成「码+文字」标签图，网格排版插入文档'
  },
```

- [ ] **Step 3: 冒烟断言（注册 + 默认参数）**

在 `scripts/test-serial-label-smoke.mjs` 总结之前加：

```js
  const label = td.getToolDefinition('tools.label')
  assert('标签工具已注册', !!label && label.id === 'tools.label')
  const lp = td.buildDefaultParams(label)
  assert('标签默认分隔符|', lp.separator === '|')
  assert('标签默认码制QR', lp.codeType === 'QR')
  assert('标签默认列数3', lp.columns === 3)
  assert('getAssistantToolInfo 命中标签', reg2.getAssistantToolInfo('tools.label')?.toolId === 'tools.label')
```

> `td` 与 `reg2` 已在 Task 4 的断言里 import；本段直接复用同名常量（确认在同一 `main()` 作用域内、在它们声明之后）。

Run: `cd /work/chayuan-wps && node scripts/test-serial-label-smoke.mjs 2>/dev/null | tail -8`
Expected: `ALL PASS`。

- [ ] **Step 4: 校验 + 提交**

Run: `cd /work/chayuan-wps && npx eslint src/utils/tools/toolDefinitions.js src/utils/assistantRegistry.js --no-ignore`
Expected: toolDefinitions 0 error；assistantRegistry 0 新增 error。

```bash
git -C /work/chayuan-wps add src/utils/tools/toolDefinitions.js src/utils/assistantRegistry.js scripts/test-serial-label-smoke.mjs
sudo git -C /work/chayuan-wps commit -m "feat(tools): add asset-label tool assistant (tools.label)"
```

---

## Task 8: 构建 + WPS 内手测验收

**Files:** 无（验收）

- [ ] **Step 1: 全量冒烟（两个脚本）**

Run: `cd /work/chayuan-wps && node scripts/test-serial-label-smoke.mjs 2>/dev/null | tail -3 && node scripts/test-barcode-tool-smoke.mjs 2>/dev/null | tail -3`
Expected: 两个都 `ALL PASS`。

- [ ] **Step 2: targeted lint**

Run: `cd /work/chayuan-wps && npx eslint "src/utils/tools/*.js" "src/components/ToolAssistantPanel.vue" --no-ignore`
Expected: 0 error。

- [ ] **Step 3: 构建**

Run: `cd /work/chayuan-wps && npx vite build --mode development 2>&1 | tail -3`
Expected: `✓ built`。

- [ ] **Step 4: WPS 内手测（人工）**

起加载项后，在 AI 助手面板「工具助手」分组：

流水号：
1. 点「流水号」→ 右侧参数表单（模板/日期/起始/步长/个数/列数）。
2. 默认模板 + 个数 12 + 列数 4 → 「生成预览」→ 列出 12 个 `WP-<今天>-0001…0012` 文本。
3. 「插入到文档」→ 文档出 3×4 文本表格，每格一个编号、居中。
4. 模板改 `{rand:4}-{seq:3}`、个数 3 → 预览编号含 4 位随机段。
5. 模板打错（如 `{xxx}`）→ 预览标红「未知占位符」，不阻断其它。

标签：
1. 点「资产标签」→ 表单（粘贴列表/分隔符/码制/列数/尺寸）。
2. 粘贴 3 行（如 `WP-001 | 电机 | 220V 1.5kW`），分隔符 `|`，码制二维码，列数 3 → 「生成预览」→ 3 张「二维码在上、文字居中在下」的标签图。
3. 「插入到文档」→ 文档出 1×3 网格，每格一张标签图。
4. 码制切 Code128 → 标签上方变条码。
5. 某行首字段留空（如 ` | 仅文字`）→ 该项标红「缺少码内容」跳过。

记录结果；中文文字若在标签里溢出/缺字，回 `labelComposer.js` 调 `SIZE_PRESET`（字号/宽度/换行）。

- [ ] **Step 5: 提交（仅当手测有微调代码时）**

```bash
git -C /work/chayuan-wps add -A
sudo git -C /work/chayuan-wps commit -m "fix(tools): adjust serial/label rendering per WPS manual test"
```

---

## 自查（Self-Review 结果）

- **Spec 覆盖：** 第1节共享模块(serialTemplate T1 / labelData T5 / qr+composer+label T6 / gridWriter writeTextGrid T2 / 面板 date+文本预览 T3)、第2节流水号工具(T4)、第3节标签工具(T7)、第4节文件结构+测试+顺序(全任务+T8) —— 全覆盖。
- **占位符扫描：** 无 TBD/TODO；纯逻辑给完整代码与测试，浏览器/WPS 部分给完整实现 + import 校验 + 手测。
- **类型/命名一致：** `expandTemplate({start,step,count,date,rng})→{items:[{value,ok,error}],invalidCount}`；`parseLabelRows(listText,separator)→string[][]`；`writeTextGrid(values,{columns})`；`renderQr(value,sizePx)→Promise`；`composeLabel({codeDataUrl,textLines,size})→Promise`；`label.generate(params)→{items,invalidCount}`；`getToolDefinition/buildDefaultParams/getAssistantToolInfo` 全程一致。`generate` 全部返回 `{items,invalidCount}`，面板 onPreview/onInsert 已 await，兼容 async（label）与 sync（serial）。
- **风险已标：** qrcode node import 兜底(T6)、中文绘制溢出(T8)、writeTextGrid/writeGrid 单元格定位复用已修复成果。
