// 工具助手定义表。面板 ToolAssistantPanel 由此驱动。
// 注意：与 src/services/toolRegistry/ 无关（那是 LLM 工具执行策略）。
import { generate as generateBarcode } from './barcode.js'
import { writeGrid, writeTextGrid } from './gridWriter.js'
import { expandTemplate } from './serialTemplate.js'
import { generate as generateLabel } from './label.js'

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
  // 条码图本身已由 JsBarcode 把编号画在下方(showText 控制),不再单独插一行文字编号,
  // 否则编号会重复显示。caption 能力留给将来二维码等"图内无文字"的工具。
  writeBack: (genResult, params) =>
    writeGrid(genResult.items, { columns: params.columns, caption: false })
}

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

const TOOL_DEFINITIONS = {
  [BARCODE_TOOL.id]: BARCODE_TOOL,
  [SERIAL_TOOL.id]: SERIAL_TOOL,
  [LABEL_TOOL.id]: LABEL_TOOL
}

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
