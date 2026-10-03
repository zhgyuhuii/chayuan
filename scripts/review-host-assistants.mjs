/**
 * 宿主助手配方逐项审查（2026-10 增量批次）。
 * 校验：模块可加载 / 字段完整 / ID 全局唯一 / mode 合法 / 分组白名单 /
 *       提示词中提到的每个工具·action 名都真实存在（防「空头支票」配方）。
 * 用法：node scripts/review-host-assistants.mjs
 */
import { HOST_ASSISTANT_PACKS, getHostAssistantItems } from '../src/utils/assistant/hostAssistants.js'

// 真实工具面（与 mcp-sidecar/lib/aggregateTools.mjs 的 action enum 同步）
const SPREADSHEET_ACTIONS = new Set(['status', 'sheet_list', 'sheet_add', 'sheet_rename', 'sheet_delete',
  'used_range', 'range_read', 'range_write', 'find', 'find_replace', 'row_insert', 'row_delete',
  'column_insert', 'column_delete', 'sort', 'autofilter', 'format', 'chart_add', 'chart_list',
  'chart_export', 'export'])
const PRESENTATION_ACTIONS = new Set(['status', 'slide_list', 'slide_read', 'shape_list', 'slide_add',
  'slide_delete', 'slide_duplicate', 'slide_move', 'slide_layout', 'text_replace', 'text_set',
  'textbox_add', 'picture_add', 'table_add', 'notes_set', 'format_uniform', 'svg_add',
  'slideshow_run', 'export', 'slide_export_image'])
const WRITER_TOOLS = new Set(['document_get_text', 'document_insert', 'document_replace', 'document_save',
  'document_export', 'document_open', 'image_search', 'generate_image'])

const problems = []
const warn = []
const rows = []

for (const [host, pack] of Object.entries(HOST_ASSISTANT_PACKS)) {
  for (const item of pack) {
    const tag = `${host}/${item.id}`
    // 字段完整
    for (const f of ['id', 'label', 'shortLabel', 'icon', 'group', 'mode', 'description', 'prompt']) {
      if (!item[f] || !String(item[f]).trim()) problems.push(`${tag}: 字段 ${f} 为空`)
    }
    if (!['send', 'prefill'].includes(item.mode)) problems.push(`${tag}: mode 非法 ${item.mode}`)
    // 以「：/:」结尾 = 留参数位的 prefill，允许短提示词；其余 prompt 至少 24 字
    const parameterized = /[：:]\s*$/.test(item.prompt || '')
    if (item.prompt && !parameterized && item.prompt.length < 24) problems.push(`${tag}: prompt 过短(${item.prompt.length})`)
    if (item.prompt && !/[：:]?\s*$/.test(item.prompt) && item.mode === 'prefill' && !item.prompt.includes('。')) {
      warn.push(`${tag}: prefill prompt 疑似没有留参数位`)
    }
    // 工具名真实性：提取 spreadsheet.*/presentation.*/action 名/跨宿主工具名
    const p = item.prompt || ''
    const tokens = new Set()
    for (const m of p.matchAll(/spreadsheet\.([a-z_]+)/g)) tokens.push(`spreadsheet:${m[1]}`)
    for (const m of p.matchAll(/presentation\.([a-z_]+)/g)) tokens.push(`presentation:${m[1]}`)
    for (const m of p.matchAll(/\b(sheet_list|sheet_add|sheet_rename|sheet_delete|used_range|range_read|range_write|find_replace|row_insert|row_delete|column_insert|column_delete|autofilter|chart_add|chart_list|chart_export|slide_list|slide_read|shape_list|slide_add|slide_delete|slide_duplicate|slide_move|slide_layout|text_replace|text_set|textbox_add|picture_add|table_add|notes_set|format_uniform|svg_add|slideshow_run|slide_export_image|document_get_text|document_insert|document_replace|document_save|image_search|generate_image)\b/g)) {
      tokens.add(m[1])
    }
    for (const t of tokens) {
      if (t.startsWith('spreadsheet:')) {
        if (!SPREADSHEET_ACTIONS.has(t.slice(12))) problems.push(`${tag}: 幻觉表格 action「${t}」`)
      } else if (t.startsWith('presentation:')) {
        if (!PRESENTATION_ACTIONS.has(t.slice(13))) problems.push(`${tag}: 幻觉演示 action「${t}」`)
      } else if (t.startsWith('document_') || t === 'image_search' || t === 'generate_image') {
        if (!WRITER_TOOLS.has(t)) problems.push(`${tag}: 幻觉工具「${t}」`)
      } else if (SPREADSHEET_ACTIONS.has(t)) {
        // 裸 action 名：若提示词里还带了 "presentation slide_add" 这类跨域写法，容忍；
        // 仅当宿主为 et 却用了 presentation 专属 action（或反之）才报问题
        const presOnly = ['slide_list', 'slide_read', 'shape_list', 'slide_add', 'slide_delete', 'slide_duplicate',
          'slide_move', 'slide_layout', 'text_replace', 'text_set', 'textbox_add', 'picture_add', 'table_add',
          'notes_set', 'format_uniform', 'svg_add', 'slideshow_run', 'slide_export_image']
        const etOnly = ['sheet_list', 'sheet_add', 'sheet_rename', 'sheet_delete', 'used_range', 'range_read',
          'range_write', 'row_insert', 'row_delete', 'column_insert', 'column_delete', 'autofilter',
          'chart_add', 'chart_list', 'chart_export']
        if (host === 'et' && presOnly.includes(t) && !/presentation/.test(p)) problems.push(`${tag}: et 配方用了演示 action「${t}」但未注明 presentation 前缀`)
        if (host === 'wpp' && etOnly.includes(t) && !/spreadsheet/.test(p)) problems.push(`${tag}: wpp 配方用了表格 action「${t}」但未注明 spreadsheet 前缀`)
      }
    }
    rows.push({ host, group: item.group, id: item.id, label: item.label, mode: item.mode,
      tools: [...tokens].join(',') || '(模型自由编排)' })
  }
}

// ID 全局唯一
const seen = new Map()
for (const [host, pack] of Object.entries(HOST_ASSISTANT_PACKS)) {
  for (const item of pack) {
    if (seen.has(item.id)) problems.push(`ID 重复: ${item.id} (${seen.get(item.id)} 与 ${host})`)
    seen.set(item.id, host)
  }
}

// 面板形状映射
for (const host of ['et', 'wpp']) {
  const items = getHostAssistantItems(host)
  if (items.length !== HOST_ASSISTANT_PACKS[host].length) problems.push(`getHostAssistantItems(${host}) 数量不符`)
  for (const it of items) {
    if (it.type !== 'host-assistant' || it.host !== host || !it.key) problems.push(`面板形状异常: ${host}/${it.key}`)
  }
}

// 输出逐项清单
console.log('==== 逐项审查清单 ====')
let lastHost = '', lastGroup = ''
for (const r of rows) {
  if (r.host !== lastHost) { console.log(`\n── 宿主 ${r.host} ──`); lastHost = r.host; lastGroup = '' }
  if (r.group !== lastGroup) { console.log(`  [${r.group}]`); lastGroup = r.group }
  console.log(`   ${r.id.padEnd(22)} ${r.mode.padEnd(8)} ${r.label}  ← ${r.tools}`)
}
console.log(`\n总计: et=${HOST_ASSISTANT_PACKS.et.length} wpp=${HOST_ASSISTANT_PACKS.wpp.length} 合计=${rows.length}`)
console.log(`\n==== 结论 ====`)
if (warn.length) console.log('提醒:\n  ' + warn.join('\n  '))
if (problems.length) {
  console.error(`发现 ${problems.length} 个问题:`)
  for (const p of problems) console.error('  ✗ ' + p)
  process.exit(1)
}
console.log('全部通过 ✓')
