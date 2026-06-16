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
  const { parseLabelRows } = await import(repoRoot + 'src/utils/tools/labelData.js')

  const a = expandTemplate('WP-{seq:4}', { start: 1, count: 3, step: 1 })
  assert('seq 个数', a.items.length === 3, `got ${a.items.length}`)
  assert('seq 首项补零', a.items[0].value === 'WP-0001', `got ${a.items[0].value}`)
  assert('seq 末项', a.items[2].value === 'WP-0003', `got ${a.items[2].value}`)

  const b = expandTemplate('{seq:2}', { start: 10, count: 2, step: 5 })
  assert('step 首项', b.items[0].value === '10', `got ${b.items[0].value}`)
  assert('step 次项', b.items[1].value === '15', `got ${b.items[1].value}`)

  const d = new Date(2026, 5, 16)
  assert('date YYYYMMDD', expandTemplate('{date:YYYYMMDD}', { count: 1, date: d }).items[0].value === '20260616')
  assert('date YYYY-MM-DD', expandTemplate('{date:YYYY-MM-DD}', { count: 1, date: d }).items[0].value === '2026-06-16')
  assert('date YYMMDD', expandTemplate('{date:YYMMDD}', { count: 1, date: d }).items[0].value === '260616')
  assert('date 字符串本地解析不差天', expandTemplate('{date:YYYYMMDD}', { count: 1, date: '2026-06-16' }).items[0].value === '20260616')

  const r0 = expandTemplate('{rand:4}', { count: 1, rng: () => 0 })
  assert('rand 固定rng=0 全A', r0.items[0].value === 'AAAA', `got ${r0.items[0].value}`)
  const rr = expandTemplate('{rand:6}', { count: 1, rng: () => 0.5 })
  assert('rand 长度', rr.items[0].value.length === 6)
  assert('rand 字符集', /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/.test(rr.items[0].value))
  assert('rand rng=1.0 不越界', /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]$/.test(expandTemplate('{rand:1}', { count: 1, rng: () => 1 }).items[0].value))
  assert('rand rng=负 不越界', /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]$/.test(expandTemplate('{rand:1}', { count: 1, rng: () => -0.5 }).items[0].value))

  assert('字面前后缀', expandTemplate('AB{seq:2}CD', { start: 1, count: 1 }).items[0].value === 'AB01CD')

  const u = expandTemplate('{foo}', { count: 1 })
  assert('未知token ok=false', u.items[0].ok === false)
  assert('未知token 计入invalid', u.invalidCount === 1)

  const td = await import(repoRoot + 'src/utils/tools/toolDefinitions.js')
  const serial = td.getToolDefinition('tools.serial')
  assert('流水号工具已注册', !!serial && serial.id === 'tools.serial')
  const sp = td.buildDefaultParams(serial)
  assert('流水号默认模板', sp.template === 'WP-{date:YYYYMMDD}-{seq:4}')
  assert('流水号默认个数10', sp.count === 10)
  const sg = serial.generate({ template: 'X-{seq:3}', start: 1, step: 1, count: 2, date: '' })
  assert('流水号 generate 出2项', sg.items.length === 2 && sg.items[0].value === 'X-001')

  const reg2 = await import(repoRoot + 'src/utils/assistantRegistry.js')
  assert('getAssistantToolInfo 命中流水号', reg2.getAssistantToolInfo('tools.serial')?.toolId === 'tools.serial')

  const rows = parseLabelRows('WP-001 | 电机 | 220V\nWP-002|减速器\n\n  ', '|')
  assert('label 行数(空行跳过)', rows.length === 2, `got ${rows.length}`)
  assert('label 字段拆分+trim', rows[0].length === 3 && rows[0][0] === 'WP-001' && rows[0][1] === '电机')
  assert('label 第二行2字段', rows[1].length === 2 && rows[1][1] === '减速器')
  const rowsTab = parseLabelRows('A\tB\tC', 'tab')
  assert('label tab 分隔', rowsTab[0].length === 3 && rowsTab[0][2] === 'C')
  const rowsComma = parseLabelRows('A,B', 'comma')
  assert('label 逗号分隔', rowsComma[0].length === 2 && rowsComma[0][1] === 'B')

  const { fitLabelCodeDims } = await import(repoRoot + 'src/utils/tools/labelComposer.js')
  const sq = fitLabelCodeDims(100, 100, 120)
  assert('fit 方形码 等比', sq.drawW === 120 && sq.drawH === 120)
  const wide = fitLabelCodeDims(300, 60, 120)
  assert('fit 横长条码 加宽不压扁', wide.drawH === 120 && wide.drawW === 600, `got ${wide.drawW}`)
  assert('fit 异常尺寸兜底', fitLabelCodeDims(0, 0, 120).drawW === 120)

  const label = td.getToolDefinition('tools.label')
  assert('标签工具已注册', !!label && label.id === 'tools.label')
  const lp = td.buildDefaultParams(label)
  assert('标签默认分隔符|', lp.separator === '|')
  assert('标签默认码制QR', lp.codeType === 'QR')
  assert('标签默认列数3', lp.columns === 3)
  assert('getAssistantToolInfo 命中标签', reg2.getAssistantToolInfo('tools.label')?.toolId === 'tools.label')

  console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
