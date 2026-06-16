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
  assert('流水号 start 小数取整', buildCodeList({ dataSource: 'sequence', prefix: '', start: 1.9, count: 1, padding: 4 })[0] === '0001', `got ${buildCodeList({ dataSource: 'sequence', prefix: '', start: 1.9, count: 1, padding: 4 })[0]}`)
  assert('流水号 start 负数归零', buildCodeList({ dataSource: 'sequence', prefix: '', start: -5, count: 1, padding: 4 })[0] === '0000', `got ${buildCodeList({ dataSource: 'sequence', prefix: '', start: -5, count: 1, padding: 4 })[0]}`)

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

  const reg = await import(repoRoot + 'src/utils/assistantRegistry.js')
  assert('ASSISTANT_GROUPS 含 tools', reg.ASSISTANT_GROUPS.some((g) => g.key === 'tools'))
  assert('getAssistantToolInfo 命中条码', reg.getAssistantToolInfo('tools.barcode')?.toolId === 'tools.barcode')
  assert('getAssistantToolInfo 普通助手返回 null', reg.getAssistantToolInfo('summary') === null)

  const { dataUrlToBase64, cellImageWidthPt } = await import(repoRoot + 'src/utils/tools/gridWriter.js')
  assert('dataUrlToBase64 取出 png base64', dataUrlToBase64('data:image/png;base64,AAAB') === 'AAAB')
  assert('dataUrlToBase64 非 base64 返回空', dataUrlToBase64('http://x/y.png') === '')
  assert('dataUrlToBase64 空值返回空', dataUrlToBase64('') === '')
  assert('cellImageWidthPt 4列均分', cellImageWidthPt(440, 4) === 99, `got ${cellImageWidthPt(440, 4)}`)
  assert('cellImageWidthPt 1列封顶240', cellImageWidthPt(440, 1) === 240)
  assert('cellImageWidthPt 多列保底40', cellImageWidthPt(440, 100) === 40)
  assert('cellImageWidthPt 读不到宽度用兜底', cellImageWidthPt(0, 4) === 99)

  console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
