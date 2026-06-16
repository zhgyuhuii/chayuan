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
  // 条码图本身已由 JsBarcode 把编号画在下方(showText 控制),不再单独插一行文字编号,
  // 否则编号会重复显示。caption 能力留给将来二维码等"图内无文字"的工具。
  writeBack: (genResult, params) =>
    writeGrid(genResult.items, { columns: params.columns, caption: false })
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
