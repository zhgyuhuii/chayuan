# 工具助手分组（条形码批量生成）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 WPS 加载项里新增「工具助手」分组，落地首个不走大模型的工具——条形码批量生成（流水号/粘贴列表 → 本地生成条码图 → 网格表格写回文档），并把「表单 schema → 确定性生成 → 网格写回 + 预览面板」做成可复用骨架。

**Architecture:** 方案 1（独立面板 + 工具定义表，与 LLM 任务链解耦）。点工具助手时在 `runAssistant()` 早期分叉，右侧渲染通用 `ToolAssistantPanel`（schema 驱动表单 + canvas 预览 + 插入文档），工具逻辑（条码生成、网格写回）是独立纯模块，完全不碰 `assistantTaskRunner`。

**Tech Stack:** Vue 3 + Vite；`jsbarcode`（新增，纯前端条码渲染）；浏览器 canvas；WPS API（`Tables.Add` / `InlineShapes.AddPicture` / `cell.Range`，经现有 `documentActions.js`、`documentInsertActions.js` 封装）。测试用项目既有冒烟脚本习惯（`scripts/test-*.mjs`，`node` 直跑，`assert/failures` 模式；无 jest/vitest）。

**命名约定（避坑）：** 项目已存在 `src/services/toolRegistry/toolRegistry.js`（LLM 工具执行策略，与本功能无关）。本功能的工具定义表命名为 `src/utils/tools/toolDefinitions.js`，**不要**叫 toolRegistry，避免混淆。

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/utils/tools/barcodeCodes.js` | 纯逻辑：编号列表构造、补零、条码值校验。无浏览器依赖，可 node 单测 | Create |
| `src/utils/tools/barcode.js` | 浏览器渲染：jsbarcode 画 canvas → dataURL；`generate(params)` 编排 | Create |
| `src/utils/tools/gridWriter.js` | 通用网格写回：建表 + 每格插图 + 编号文字。条码/二维码/未来标签共用 | Create |
| `src/utils/tools/toolDefinitions.js` | 工具定义表：每工具 `{ id, formSchema, generate, writeBack }` | Create |
| `src/components/ToolAssistantPanel.vue` | 通用工具面板：schema 渲染表单 + 预览 + 插入文档 | Create |
| `src/utils/assistantRegistry.js` | 加 `tools` 分组 + 条码助手注册 + `isToolAssistant` 查询辅助 | Modify |
| `src/components/AIAssistantDialog.vue` | `runAssistant` 分叉 + 挂载 `ToolAssistantPanel` | Modify |
| `scripts/test-barcode-tool-smoke.mjs` | 冒烟测试 barcodeCodes 纯逻辑 | Create |
| `package.json` | `+ jsbarcode` 依赖 | Modify |

---

## Task 1: 条码纯逻辑模块（编号构造 + 校验）

先做纯逻辑、可 node 测试的部分，TDD。

**Files:**
- Create: `src/utils/tools/barcodeCodes.js`
- Test: `scripts/test-barcode-tool-smoke.mjs`

- [ ] **Step 1: 写失败的冒烟测试**

Create `scripts/test-barcode-tool-smoke.mjs`:

```js
#!/usr/bin/env node
const repoRoot = new URL('..', import.meta.url).href
let failures = 0
function assert(name, condition, detail = '') {
  if (condition) { console.log(`✓ ${name}`) }
  else { console.log(`✗ ${name}${detail ? ` - ${detail}` : ''}`); failures += 1 }
}

async function main() {
  console.log('Barcode tool smoke tests\n')
  const { buildCodeList, validateBarcodeValue, zeroPad } =
    await import(repoRoot + 'src/utils/tools/barcodeCodes.js')

  // zeroPad
  assert('zeroPad 补零', zeroPad(7, 4) === '0007', `got ${zeroPad(7, 4)}`)
  assert('zeroPad 超长不截断', zeroPad(12345, 4) === '12345')

  // 流水号序列
  const seq = buildCodeList({ dataSource: 'sequence', prefix: 'WP-', start: 1, count: 3, padding: 4, suffix: '' })
  assert('流水号个数', seq.length === 3, `got ${seq.length}`)
  assert('流水号首项', seq[0] === 'WP-0001', `got ${seq[0]}`)
  assert('流水号末项', seq[2] === 'WP-0003', `got ${seq[2]}`)
  assert('流水号起始号生效', buildCodeList({ dataSource: 'sequence', prefix: '', start: 10, count: 1, padding: 2, suffix: 'X' })[0] === '10X')

  // 粘贴列表
  const list = buildCodeList({ dataSource: 'list', listText: ' A1 \n\nB2\nC3 \n' })
  assert('粘贴列表去空行去空格', JSON.stringify(list) === JSON.stringify(['A1', 'B2', 'C3']), `got ${JSON.stringify(list)}`)

  // 校验：Code128 任意非空 ok
  assert('Code128 非空 ok', validateBarcodeValue('ABC-123', 'CODE128').ok === true)
  assert('Code128 空值报错', validateBarcodeValue('', 'CODE128').ok === false)

  // 校验：Code39 字符集
  assert('Code39 合法字符 ok', validateBarcodeValue('AB 12.-', 'CODE39').ok === true)
  assert('Code39 非法小写报错', validateBarcodeValue('ab', 'CODE39').ok === false)

  // 校验：EAN-13 位数与校验位
  assert('EAN13 12 位数字 ok', validateBarcodeValue('400638133393', 'EAN13').ok === true)
  assert('EAN13 13 位正确校验位 ok', validateBarcodeValue('4006381333931', 'EAN13').ok === true)
  assert('EAN13 13 位错误校验位报错', validateBarcodeValue('4006381333930', 'EAN13').ok === false)
  assert('EAN13 含字母报错', validateBarcodeValue('40063813339A', 'EAN13').ok === false)
  assert('EAN13 位数不对报错', validateBarcodeValue('123', 'EAN13').ok === false)

  console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: 运行确认失败**

Run: `node scripts/test-barcode-tool-smoke.mjs`
Expected: FAIL（`Cannot find module .../barcodeCodes.js`）

- [ ] **Step 3: 写最小实现**

Create `src/utils/tools/barcodeCodes.js`:

```js
// 条码纯逻辑：编号列表构造 + 校验。无浏览器/jsbarcode 依赖，可 node 直接测试。

export function zeroPad(num, width) {
  const s = String(num)
  const w = Math.max(0, Number(width) || 0)
  return s.length >= w ? s : '0'.repeat(w - s.length) + s
}

// params: { dataSource:'sequence'|'list', prefix, start, count, padding, suffix, listText }
export function buildCodeList(params = {}) {
  if (params.dataSource === 'list') {
    return String(params.listText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }
  const prefix = String(params.prefix || '')
  const suffix = String(params.suffix || '')
  const start = Number.isFinite(Number(params.start)) ? Number(params.start) : 1
  const count = Math.max(0, Number(params.count) || 0)
  const padding = Math.max(0, Number(params.padding) || 0)
  const out = []
  for (let i = 0; i < count; i += 1) {
    out.push(prefix + zeroPad(start + i, padding) + suffix)
  }
  return out
}

function ean13CheckDigit(d12) {
  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    sum += Number(d12[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10
}

// 返回 { ok:boolean, error?:string }
export function validateBarcodeValue(value, type) {
  const v = String(value == null ? '' : value)
  if (!v) return { ok: false, error: '编号为空' }
  const t = String(type || '').toUpperCase()
  if (t === 'EAN13') {
    if (!/^\d{12,13}$/.test(v)) return { ok: false, error: 'EAN-13 需 12 或 13 位数字' }
    if (v.length === 13 && Number(v[12]) !== ean13CheckDigit(v.slice(0, 12))) {
      return { ok: false, error: 'EAN-13 校验位不正确' }
    }
    return { ok: true }
  }
  if (t === 'CODE39') {
    if (!/^[A-Z0-9 \-.$/+%]+$/.test(v)) {
      return { ok: false, error: 'Code39 仅支持大写字母、数字与 - . $ / + % 空格' }
    }
    return { ok: true }
  }
  // CODE128 与其它：任意非空字符串
  return { ok: true }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node scripts/test-barcode-tool-smoke.mjs`
Expected: PASS（`ALL PASS`，exit 0）

- [ ] **Step 5: 提交**

```bash
git -C /work/chayuan-wps add src/utils/tools/barcodeCodes.js scripts/test-barcode-tool-smoke.mjs
git -C /work/chayuan-wps commit -m "feat(tools): add barcode pure logic (code list + validation) with smoke test"
```

---

## Task 2: 安装 jsbarcode + 条码渲染模块

canvas 渲染是浏览器能力，node 无法单测；本任务给完整实现 + 在 WPS 内手测（Task 8 统一验收）。

**Files:**
- Modify: `package.json`（+ jsbarcode）
- Create: `src/utils/tools/barcode.js`

- [ ] **Step 1: 安装依赖**

Run: `cd /work/chayuan-wps && npm i jsbarcode`
Expected: `package.json` dependencies 出现 `jsbarcode`，`npm` 退出码 0。

- [ ] **Step 2: 写渲染模块**

Create `src/utils/tools/barcode.js`:

```js
// 条码浏览器渲染：jsbarcode 画 canvas -> dataURL。依赖 DOM/canvas，仅在 WPS/浏览器运行。
import JsBarcode from 'jsbarcode'
import { buildCodeList, validateBarcodeValue } from './barcodeCodes.js'

const SIZE_PRESET = {
  small: { width: 1, height: 40, fontSize: 12 },
  medium: { width: 2, height: 60, fontSize: 16 },
  large: { width: 3, height: 90, fontSize: 20 }
}

// 单个条码 -> PNG dataURL；失败抛错由调用方捕获
export function renderBarcode(value, type, size, displayValue) {
  const preset = SIZE_PRESET[size] || SIZE_PRESET.medium
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, String(value), {
    format: String(type || 'CODE128').toUpperCase(),
    width: preset.width,
    height: preset.height,
    fontSize: preset.fontSize,
    displayValue: displayValue !== false,
    margin: 6,
    background: '#ffffff'
  })
  return canvas.toDataURL('image/png')
}

// params: { dataSource, prefix, start, count, padding, suffix, listText, type, size, showText }
// 返回 { items:[{ value, dataUrl, ok, error }], invalidCount }
export function generate(params = {}) {
  const values = buildCodeList(params)
  const type = params.type || 'CODE128'
  let invalidCount = 0
  const items = values.map((value) => {
    const check = validateBarcodeValue(value, type)
    if (!check.ok) {
      invalidCount += 1
      return { value, dataUrl: '', ok: false, error: check.error }
    }
    try {
      const dataUrl = renderBarcode(value, type, params.size, params.showText)
      return { value, dataUrl, ok: true }
    } catch (e) {
      invalidCount += 1
      return { value, dataUrl: '', ok: false, error: e?.message || '渲染失败' }
    }
  })
  return { items, invalidCount }
}
```

- [ ] **Step 3: 校验语法**

Run: `cd /work/chayuan-wps && npx eslint src/utils/tools/barcode.js --no-ignore`
Expected: 无 error（warning 可接受）。

- [ ] **Step 4: 提交**

```bash
git -C /work/chayuan-wps add package.json package-lock.json src/utils/tools/barcode.js
git -C /work/chayuan-wps commit -m "feat(tools): add jsbarcode renderer + generate() for barcode tool"
```

---

## Task 3: 通用网格写回器

WPS 文档写回，node 无法测；给完整实现 + WPS 手测（Task 8）。复用现成 API：`insertTableAtPosition`（建表）、`tryAddInlinePicture`（插图）、`getActiveDocument`（取文档）。

**Files:**
- Create: `src/utils/tools/gridWriter.js`
- 参考（只读，不改）：`src/utils/documentInsertActions.js`（`insertTableAtPosition`）、`src/utils/documentActions.js`（`tryAddInlinePicture`、`getActiveDocument`）

- [ ] **Step 1: 确认依赖函数签名**

Run: `cd /work/chayuan-wps && grep -nE "export function insertTableAtPosition|function tryAddInlinePicture|export function getActiveDocument" src/utils/documentInsertActions.js src/utils/documentActions.js`
Expected: 三个函数都能定位到。若 `tryAddInlinePicture` 不是 export，在 `documentActions.js` 末尾追加 `export { tryAddInlinePicture }`（仅当未导出时）。

- [ ] **Step 2: 写网格写回器**

Create `src/utils/tools/gridWriter.js`:

```js
// 通用网格写回：建一张 N 列表格，每格插一张图 + 可选编号文字。
// 条码 / 二维码 / 未来标签工具共用。仅在 WPS 运行（依赖 WPS Tables / InlineShapes API）。
import { insertTableAtPosition } from '../documentInsertActions.js'
import { getActiveDocument, tryAddInlinePicture } from '../documentActions.js'

// items: [{ value, dataUrl, ok }]，只写 ok 的项
// options: { columns:number, caption:boolean }
// 返回 { written:number, rows:number, columns:number }
export function writeGrid(items, options = {}) {
  const valid = (items || []).filter((it) => it && it.ok && it.dataUrl)
  const columns = Math.max(1, Number(options.columns) || 1)
  if (valid.length === 0) return { written: 0, rows: 0, columns }

  const rows = Math.ceil(valid.length / columns)
  insertTableAtPosition({ rows, columns })

  const doc = getActiveDocument()
  const tables = doc?.Tables
  const tableCount = tables?.Count || 0
  if (!tableCount) throw new Error('未能创建表格')
  const table = tables.Item(tableCount) // 最新插入的表

  for (let i = 0; i < valid.length; i += 1) {
    const rowIndex = Math.floor(i / columns) + 1
    const colIndex = (i % columns) + 1
    const cell = table.Rows.Item(rowIndex).Cells.Item(colIndex)
    const cellRange = cell.Range
    // 先插图到单元格起始
    tryAddInlinePicture(valid[i].dataUrl, cellRange)
    // 再在图后追加编号文字（caption 开启时）
    if (options.caption !== false) {
      const after = cell.Range
      after.Collapse(0) // wdCollapseEnd
      after.InsertAfter('\n' + String(valid[i].value))
    }
  }
  return { written: valid.length, rows, columns }
}
```

> 注：`Collapse(0)` = `wdCollapseEnd`。若 WPS 内核单元格内图文定位有偏差，Task 8 手测时按实际微调（例如改用 `cell.Range.Text` 预留占位再插图）。

- [ ] **Step 3: 校验语法**

Run: `cd /work/chayuan-wps && npx eslint src/utils/tools/gridWriter.js --no-ignore`
Expected: 无 error。

- [ ] **Step 4: 提交**

```bash
git -C /work/chayuan-wps add src/utils/tools/gridWriter.js src/utils/documentActions.js
git -C /work/chayuan-wps commit -m "feat(tools): add generic grid writer (table + image + caption) for tool assistants"
```

---

## Task 4: 工具定义表

把条码工具的表单 schema + 生成 + 写回绑定集中到一处，面板由它驱动。

**Files:**
- Create: `src/utils/tools/toolDefinitions.js`

- [ ] **Step 1: 写工具定义表**

Create `src/utils/tools/toolDefinitions.js`:

```js
// 工具助手定义表。面板 ToolAssistantPanel 由此驱动。
// 注意：与 src/services/toolRegistry/ 无关（那是 LLM 工具执行策略）。
import { generate as generateBarcode } from './barcode.js'
import { writeGrid } from './gridWriter.js'

// 字段类型：text / number / select / textarea / radio / checkbox
const BARCODE_TOOL = {
  id: 'tools.barcode',
  label: '条形码批量生成',
  formSchema: [
    {
      key: 'dataSource', type: 'radio', label: '数据源', default: 'sequence',
      options: [{ value: 'sequence', label: '流水号' }, { value: 'list', label: '粘贴列表' }]
    },
    { key: 'prefix', type: 'text', label: '前缀', default: 'WP-', showWhen: { dataSource: 'sequence' } },
    { key: 'start', type: 'number', label: '起始号', default: 1, min: 0, showWhen: { dataSource: 'sequence' } },
    { key: 'count', type: 'number', label: '个数', default: 10, min: 1, max: 500, showWhen: { dataSource: 'sequence' } },
    { key: 'padding', type: 'number', label: '补零位数', default: 4, min: 0, max: 12, showWhen: { dataSource: 'sequence' } },
    { key: 'suffix', type: 'text', label: '后缀（可空）', default: '', showWhen: { dataSource: 'sequence' } },
    { key: 'listText', type: 'textarea', label: '编号列表（每行一个）', default: '', showWhen: { dataSource: 'list' } },
    {
      key: 'type', type: 'select', label: '条码类型', default: 'CODE128',
      options: [{ value: 'CODE128', label: 'Code128' }, { value: 'EAN13', label: 'EAN-13' }, { value: 'CODE39', label: 'Code39' }]
    },
    { key: 'showText', type: 'checkbox', label: '显示编号文字', default: true },
    { key: 'columns', type: 'number', label: '每行列数', default: 4, min: 1, max: 10 },
    {
      key: 'size', type: 'select', label: '条码尺寸', default: 'medium',
      options: [{ value: 'small', label: '小' }, { value: 'medium', label: '中' }, { value: 'large', label: '大' }]
    }
  ],
  generate: (params) => generateBarcode(params),
  writeBack: (genResult, params) =>
    writeGrid(genResult.items, { columns: params.columns, caption: params.showText !== false })
}

const TOOL_DEFINITIONS = { [BARCODE_TOOL.id]: BARCODE_TOOL }

export function getToolDefinition(toolId) {
  return TOOL_DEFINITIONS[toolId] || null
}

// 用 formSchema 的 default 生成初始表单值
export function buildDefaultParams(toolDef) {
  const out = {}
  ;(toolDef?.formSchema || []).forEach((f) => { out[f.key] = f.default })
  return out
}

// 字段在当前表单值下是否可见
export function isFieldVisible(field, params) {
  if (!field.showWhen) return true
  return Object.entries(field.showWhen).every(([k, v]) => params[k] === v)
}
```

- [ ] **Step 2: 加冒烟断言（schema 完整性，纯逻辑可测）**

在 `scripts/test-barcode-tool-smoke.mjs` 的 `main()` 末尾（`console.log` 总结之前）追加：

```js
  const { getToolDefinition, buildDefaultParams, isFieldVisible } =
    await import(repoRoot + 'src/utils/tools/toolDefinitions.js')
  const def = getToolDefinition('tools.barcode')
  assert('条码工具已注册', !!def && def.id === 'tools.barcode')
  const dp = buildDefaultParams(def)
  assert('默认参数:数据源=流水号', dp.dataSource === 'sequence')
  assert('默认参数:个数=10', dp.count === 10)
  assert('流水号字段在 sequence 下可见', isFieldVisible(def.formSchema.find((f) => f.key === 'prefix'), dp))
  assert('列表字段在 sequence 下隐藏', !isFieldVisible(def.formSchema.find((f) => f.key === 'listText'), dp))
  assert('未知工具返回 null', getToolDefinition('tools.nope') === null)
```

- [ ] **Step 3: 运行冒烟测试**

Run: `node scripts/test-barcode-tool-smoke.mjs`
Expected: PASS（`ALL PASS`）。

> 说明：该脚本会 `import` `toolDefinitions.js`，它再 `import` `barcode.js`（含 `import JsBarcode`）。jsbarcode 在 node 顶层 import 不应抛错（仅在调用 `document.createElement` 时才需 DOM）。若 node 端 import 即报错，将 `barcode.js` 顶部 `import JsBarcode` 改为在 `renderBarcode` 内 `const JsBarcode = (await import('jsbarcode')).default`，并把 `renderBarcode`/`generate` 改 async（面板侧已 await 调用，见 Task 5 Step 实现）。

- [ ] **Step 4: 提交**

```bash
git -C /work/chayuan-wps add src/utils/tools/toolDefinitions.js scripts/test-barcode-tool-smoke.mjs
git -C /work/chayuan-wps commit -m "feat(tools): add tool definitions table + schema visibility helpers"
```

---

## Task 5: 通用工具面板 ToolAssistantPanel.vue

schema 驱动表单 + 预览 + 插入文档。Vue 组件无法 node 单测，WPS/浏览器手测（Task 8）。

**Files:**
- Create: `src/components/ToolAssistantPanel.vue`

- [ ] **Step 1: 写组件**

Create `src/components/ToolAssistantPanel.vue`:

```vue
<template>
  <div class="tool-panel" v-if="toolDef">
    <div class="tool-panel__header">
      <span class="tool-panel__title">{{ toolDef.label }}</span>
    </div>

    <div class="tool-panel__form">
      <template v-for="field in visibleFields" :key="field.key">
        <label class="tool-field">
          <span class="tool-field__label">{{ field.label }}</span>

          <input v-if="field.type === 'text'" type="text" v-model="params[field.key]" />

          <input v-else-if="field.type === 'number'" type="number"
                 :min="field.min" :max="field.max"
                 v-model.number="params[field.key]" />

          <textarea v-else-if="field.type === 'textarea'" rows="6" v-model="params[field.key]"></textarea>

          <select v-else-if="field.type === 'select'" v-model="params[field.key]">
            <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>

          <span v-else-if="field.type === 'radio'" class="tool-field__radios">
            <label v-for="opt in field.options" :key="opt.value" class="tool-radio">
              <input type="radio" :value="opt.value" v-model="params[field.key]" />{{ opt.label }}
            </label>
          </span>

          <input v-else-if="field.type === 'checkbox'" type="checkbox" v-model="params[field.key]" />
        </label>
      </template>
    </div>

    <div class="tool-panel__actions">
      <button :disabled="busy" @click="onPreview">生成预览</button>
      <button :disabled="busy || validCount === 0" @click="onInsert">插入到文档</button>
    </div>

    <div v-if="invalidCount > 0" class="tool-panel__warn">
      {{ invalidCount }} 个编号非法，将跳过：{{ invalidSummary }}
    </div>

    <div class="tool-panel__preview" v-if="previewItems.length">
      <div class="tool-preview-grid" :style="gridStyle">
        <div v-for="(it, idx) in previewItems" :key="idx"
             class="tool-preview-cell" :class="{ 'is-invalid': !it.ok }">
          <img v-if="it.ok" :src="it.dataUrl" alt="" />
          <span v-else class="tool-preview-cell__err">{{ it.value }}：{{ it.error }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getToolDefinition, buildDefaultParams, isFieldVisible } from '../utils/tools/toolDefinitions.js'

export default {
  name: 'ToolAssistantPanel',
  props: {
    toolId: { type: String, required: true }
  },
  data() {
    const toolDef = getToolDefinition(this.toolId)
    return {
      toolDef,
      params: toolDef ? buildDefaultParams(toolDef) : {},
      previewItems: [],
      invalidCount: 0,
      busy: false
    }
  },
  computed: {
    visibleFields() {
      if (!this.toolDef) return []
      return this.toolDef.formSchema.filter((f) => isFieldVisible(f, this.params))
    },
    validCount() {
      return this.previewItems.filter((it) => it.ok).length
    },
    invalidSummary() {
      return this.previewItems.filter((it) => !it.ok).map((it) => it.value).slice(0, 5).join('、')
    },
    gridStyle() {
      const cols = Math.max(1, Number(this.params.columns) || 1)
      return { gridTemplateColumns: `repeat(${cols}, 1fr)` }
    }
  },
  watch: {
    toolId(newId) {
      this.toolDef = getToolDefinition(newId)
      this.params = this.toolDef ? buildDefaultParams(this.toolDef) : {}
      this.previewItems = []
      this.invalidCount = 0
    }
  },
  methods: {
    async onPreview() {
      if (!this.toolDef || this.busy) return
      this.busy = true
      try {
        const result = await this.toolDef.generate(this.params)
        this.previewItems = result.items || []
        this.invalidCount = result.invalidCount || 0
      } catch (e) {
        this.$emit('error', e?.message || '生成失败')
      } finally {
        this.busy = false
      }
    },
    async onInsert() {
      if (!this.toolDef || this.busy) return
      this.busy = true
      try {
        let result = { items: this.previewItems, invalidCount: this.invalidCount }
        if (!this.previewItems.length) {
          result = await this.toolDef.generate(this.params)
          this.previewItems = result.items || []
          this.invalidCount = result.invalidCount || 0
        }
        const written = await this.toolDef.writeBack(result, this.params)
        this.$emit('inserted', written)
      } catch (e) {
        this.$emit('error', e?.message || '插入失败')
      } finally {
        this.busy = false
      }
    }
  }
}
</script>

<style scoped>
.tool-panel { display: flex; flex-direction: column; gap: 12px; padding: 12px; overflow: auto; }
.tool-panel__title { font-weight: 600; font-size: 15px; }
.tool-panel__form { display: flex; flex-direction: column; gap: 8px; }
.tool-field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.tool-field__label { color: #555; }
.tool-field input[type="text"], .tool-field input[type="number"], .tool-field select, .tool-field textarea {
  border: 1px solid #d9d9d9; border-radius: 4px; padding: 6px 8px; font-size: 13px;
}
.tool-field__radios { display: flex; gap: 16px; }
.tool-radio { display: inline-flex; align-items: center; gap: 4px; }
.tool-panel__actions { display: flex; gap: 8px; }
.tool-panel__actions button {
  flex: 1; padding: 8px 12px; border-radius: 4px; border: 1px solid #1677ff;
  background: #1677ff; color: #fff; cursor: pointer;
}
.tool-panel__actions button:disabled { opacity: .5; cursor: not-allowed; }
.tool-panel__warn { color: #d4380d; font-size: 12px; }
.tool-preview-grid { display: grid; gap: 8px; }
.tool-preview-cell {
  border: 1px solid #eee; border-radius: 4px; padding: 6px; text-align: center; background: #fff;
}
.tool-preview-cell img { max-width: 100%; }
.tool-preview-cell.is-invalid { border-color: #ffccc7; background: #fff2f0; }
.tool-preview-cell__err { color: #d4380d; font-size: 12px; }
</style>
```

- [ ] **Step 2: 校验语法**

Run: `cd /work/chayuan-wps && npx eslint src/components/ToolAssistantPanel.vue --no-ignore`
Expected: 无 error。

- [ ] **Step 3: 提交**

```bash
git -C /work/chayuan-wps add src/components/ToolAssistantPanel.vue
git -C /work/chayuan-wps commit -m "feat(tools): add generic schema-driven ToolAssistantPanel with preview"
```

---

## Task 6: 注册表加分组 + 条码助手 + isToolAssistant 查询

**Files:**
- Modify: `src/utils/assistantRegistry.js`（`ASSISTANT_GROUPS` 约 line 44-48；附近的内置助手数组与导出区）

- [ ] **Step 1: 加 tools 分组**

修改 `src/utils/assistantRegistry.js` line 44-48：

```js
export const ASSISTANT_GROUPS = [
  { key: 'core', label: '系统助手功能' },
  { key: 'analysis', label: '文本分析分组' },
  { key: 'tools', label: '工具助手' },
  { key: 'custom', label: '自定义智能助手' }
]
```

- [ ] **Step 2: 注册条码工具助手**

在 `assistantRegistry.js` 找到核心内置助手数组（`CORE_BUILTIN_ASSISTANTS`，Explore 记为约 line 403 起）。在该数组中追加一条：

```js
  {
    id: 'tools.barcode',
    label: '条形码批量生成',
    shortLabel: '条形码',
    icon: '▌▌',
    group: 'tools',
    supportsRibbon: false,
    defaultDisplayLocations: ['ribbon-more'],
    runtimeCapabilities: { isToolAssistant: true, toolId: 'tools.barcode' },
    description: '按流水号或粘贴列表批量生成条形码，网格排版插入文档'
  },
```

> 注意：本助手**不含** `systemPrompt` / `userPromptTemplate`（不走 LLM）。`modelType` 不设或设 `'none'`，避免被多模态分支误判——若注册表对缺失字段有校验，参照同数组其它项补 `modelType: 'chat'` 但保持 `isToolAssistant: true`（分叉在 UI 层，模型类型不会被触达）。

- [ ] **Step 3: 加 isToolAssistant 查询辅助并导出**

在 `assistantRegistry.js` 末尾（导出区）追加：

```js
// 给定助手 key/id，返回其工具能力 { isToolAssistant, toolId } 或 null
export function getAssistantToolInfo(assistantId) {
  const def = (typeof getAssistantById === 'function')
    ? getAssistantById(assistantId)
    : BUILTIN_ASSISTANTS.find((a) => a.id === assistantId || a.key === assistantId)
  const caps = def?.runtimeCapabilities
  if (caps?.isToolAssistant) {
    return { isToolAssistant: true, toolId: caps.toolId || def.id }
  }
  return null
}
```

> 实现前先 `grep -nE "export function getAssistantById|const BUILTIN_ASSISTANTS" src/utils/assistantRegistry.js` 确认可用的查找函数名，用既有的那个；若已有按 id 查定义的导出函数，直接复用，不要新建重复查找。

- [ ] **Step 4: 校验语法**

Run: `cd /work/chayuan-wps && npx eslint src/utils/assistantRegistry.js --no-ignore`
Expected: 无 error。

- [ ] **Step 5: 冒烟验证分组与注册（纯逻辑）**

在 `scripts/test-barcode-tool-smoke.mjs` 末尾追加：

```js
  const reg = await import(repoRoot + 'src/utils/assistantRegistry.js')
  assert('ASSISTANT_GROUPS 含 tools', reg.ASSISTANT_GROUPS.some((g) => g.key === 'tools'))
  assert('getAssistantToolInfo 命中条码', reg.getAssistantToolInfo('tools.barcode')?.toolId === 'tools.barcode')
  assert('getAssistantToolInfo 普通助手返回 null', reg.getAssistantToolInfo('summary') === null)
```

Run: `node scripts/test-barcode-tool-smoke.mjs`
Expected: PASS。（若 `assistantRegistry.js` 在 node 端 import 报错——它可能引入浏览器依赖——则把这三条断言移到一个独立的、只测纯导出的小脚本，或在脚本顶部按既有 smoke 脚本那样 `globalThis.window ||= {...}` 打桩，参照 `scripts/test-service-smoke.mjs` 头部写法。）

- [ ] **Step 6: 提交**

```bash
git -C /work/chayuan-wps add src/utils/assistantRegistry.js scripts/test-barcode-tool-smoke.mjs
git -C /work/chayuan-wps commit -m "feat(tools): register tools group + barcode tool assistant + getAssistantToolInfo"
```

---

## Task 7: AIAssistantDialog 分叉 + 挂载面板

**Files:**
- Modify: `src/components/AIAssistantDialog.vue`（`runAssistant` 约 line 15552；模板右侧区；import 区；data）

- [ ] **Step 1: import 工具查询 + 组件**

在 `AIAssistantDialog.vue` 的 `<script>` import 区加：

```js
import ToolAssistantPanel from './ToolAssistantPanel.vue'
import { getAssistantToolInfo } from '../utils/assistantRegistry.js'
```

并在 `components: { ... }` 注册中加入 `ToolAssistantPanel`（若该组件用 options API 的 `components`；先 `grep -n "components:" src/components/AIAssistantDialog.vue` 确认位置）。

- [ ] **Step 2: data 加面板状态**

在组件 `data()` 返回对象里加：

```js
      activeToolId: '',
```

- [ ] **Step 3: runAssistant 早期分叉**

修改 `runAssistant` 开头（line 15557 置锁之后、`confirmAssistantRun` 之前）插入：

```js
      this.assistantRunLoadingKey = item.key
      try {
        const toolInfo = getAssistantToolInfo(item.key)
        if (toolInfo?.isToolAssistant) {
          this.assistantRunLoadingKey = ''
          this.activeToolId = toolInfo.toolId
          this.openDialogRoute('tool') // 见 Step 4；若 openDialogRoute 不支持该参数，改为设置一个 this.rightPaneMode='tool' 标志
          return
        }
        const launchInfo = getAssistantLaunchInfo(item.key)
```

> 实现前 `grep -n "openDialogRoute" src/components/AIAssistantDialog.vue` 看它如何切换右侧视图，沿用同一机制。如果右侧视图由某个 `currentView`/`route` 字段驱动，就设那个字段为工具态，而不是新造一套。

- [ ] **Step 4: 模板右侧渲染面板**

在右侧主区（对话区所在容器）加一个与「对话区」并列的分支，当处于工具态时渲染面板：

```vue
        <ToolAssistantPanel
          v-if="activeToolId"
          :tool-id="activeToolId"
          @inserted="onToolInserted"
          @error="onToolError"
        />
```

> 放在右侧 pane 的根条件里，并确保进入工具态时对话区 `v-else` 或条件隐藏。具体挂哪个容器，依 Step 3 选定的右侧视图切换字段决定（与现有对话/参数收集视图互斥）。

- [ ] **Step 5: 加回调 + 退出工具态**

在 `methods` 加：

```js
    onToolInserted(written) {
      const n = written?.written || 0
      this.$message?.success ? this.$message.success(`已插入 ${n} 个条码`) : window.alert(`已插入 ${n} 个条码`)
    },
    onToolError(msg) {
      this.$message?.error ? this.$message.error(msg) : window.alert(msg)
    },
```

> 用项目既有的提示组件；先 `grep -nE "\$message|showToast|Notify|notify" src/components/AIAssistantDialog.vue` 看已有的提示方式并沿用，不要新引 UI 库。退出工具态（点其它对话/助手）时把 `activeToolId` 清空——在已有的「打开某对话/新建对话」方法里加 `this.activeToolId = ''`。

- [ ] **Step 6: 校验语法**

Run: `cd /work/chayuan-wps && npx eslint src/components/AIAssistantDialog.vue --no-ignore`
Expected: 无新增 error（仓库历史 warning 可能存在，只看本文件本次改动行附近）。

- [ ] **Step 7: 提交**

```bash
git -C /work/chayuan-wps add src/components/AIAssistantDialog.vue
git -C /work/chayuan-wps commit -m "feat(tools): fork tool assistants in runAssistant + mount ToolAssistantPanel"
```

---

## Task 8: 构建 + WPS 内手测验收

**Files:** 无（验收）

- [ ] **Step 1: 全量冒烟**

Run: `node scripts/test-barcode-tool-smoke.mjs`
Expected: `ALL PASS`。

- [ ] **Step 2: targeted lint**

Run: `cd /work/chayuan-wps && npx eslint "src/utils/tools/*.js" "src/components/ToolAssistantPanel.vue" "src/components/AIAssistantDialog.vue" "src/utils/assistantRegistry.js"`
Expected: 触达文件无 error；如全量仓库有历史 lint 问题，按 CLAUDE.md 只报告 targeted 结果。

- [ ] **Step 3: 构建**

Run: `cd /work/chayuan-wps && npm run build`
Expected: 构建成功，无报错（jsbarcode 被正确打包）。

- [ ] **Step 4: WPS 内手测（人工）**

按 `CLAUDE.md` 的 WPS 构建方式起加载项（如 `npm run dev` 或 `npm run build:wps-debug`），在 WPS 内：

1. 打开 AI 助手面板 → 助手列表出现「工具助手」分组 → 内有「条形码」。
2. 点「条形码」→ 右侧出现参数表单（非对话）。
3. 数据源=流水号、前缀 `WP-`、起始 1、个数 12、补零 4、Code128、显示编号、列数 4、中尺寸 → 点「生成预览」→ 面板出现 12 个条码图（3 行 × 4 列）。
4. 点「插入到文档」→ 文档出现 3×4 网格表格，每格条码图 + 下方 `WP-0001…WP-0012`。
5. 切数据源=粘贴列表，粘贴 4 行（含一行非法 EAN-13 如 `123`，类型选 EAN-13）→ 预览：非法项标红、提示「1 个编号非法，将跳过」→ 插入：仅插合法项。
6. 切回某个普通 AI 助手 → 右侧恢复对话区，`activeToolId` 已清空。

记录结果；若单元格图文定位异常，回 Task 3 Step 2 注释处微调。

- [ ] **Step 5: 提交（仅当手测有微调代码时）**

```bash
git -C /work/chayuan-wps add -A
git -C /work/chayuan-wps commit -m "fix(tools): adjust barcode grid cell layout per WPS manual test"
```

---

## 自查（Self-Review 结果）

- **Spec 覆盖：** 分组(T6)、条码流水号+粘贴列表(T1)、三种条码类型(T2)、网格写回(T3)、预览面板(T5)、分叉(T7)、jsbarcode(T2)、非法跳过(T2 generate + T5 提示)、扩展骨架(T4 toolDefinitions + 通用 writeGrid/panel)、不做导出(未列任务) —— 全部有任务对应。
- **占位扫描：** 无 TBD/TODO；纯逻辑给完整代码，浏览器/WPS 部分给完整实现 + 手测（node 不可测属客观限制，已注明）。
- **类型/命名一致：** `generate`/`writeGrid`/`getToolDefinition`/`getAssistantToolInfo`/`isFieldVisible`/`buildDefaultParams` 全程一致；工具定义文件定名 `toolDefinitions.js`（避开既有 `services/toolRegistry/`）。
- **风险已标：** jsbarcode 在 WPS canvas 渲染、单元格图文定位 —— 均在对应任务注释 + T8 手测兜底。
