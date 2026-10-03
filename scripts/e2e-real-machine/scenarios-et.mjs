/**
 * 表格（et 宿主）车道场景：60 个（E01–E60），覆盖 spreadsheet 全部 21 个 action。
 * 每场景绑定工作表 Sxx（seed 数据：8 列订单表 × 21 行），marker = 该表 Z1 写「Exx完成」。
 */
import { FILES_DIR } from './harness.mjs'
import fs from 'node:fs'
import path from 'node:path'

const ART = path.resolve(FILES_DIR, '..')

/** 读取一维单元格 */
async function cell(tool, sheet, a1) {
  const r = await tool('spreadsheet', { action: 'range_read', sheet, range: `${a1}:${a1}` })
  return r?.values?.[0]?.[0]
}
/** 读区域 */
async function rng(tool, sheet, a1) {
  const r = await tool('spreadsheet', { action: 'range_read', sheet, range: a1 })
  return r?.values || []
}

/** 标准 marker 验证：Sxx!Z1 含「Exx完成」 */
const vM = (id) => async ({ tool }) => {
  const sheet = `S${id.slice(1)}`
  const v = await cell(tool, sheet, 'Z1')
  const ok = String(v ?? '').includes(`${id}完成`)
  return [ok, `${sheet}!Z1=${String(v).slice(0, 60)}`]
}

/** sheet 清单 */
async function sheets(tool) {
  const r = await tool('spreadsheet', { action: 'sheet_list' })
  return (r?.sheets || []).map(s => s?.name || s)
}
const usedRows = async (tool, sheet) => {
  const r = await tool('spreadsheet', { action: 'used_range', sheet })
  return r?.rowCount ?? r?.rows ?? (r?.range ? Number(String(r.range).match(/(\d+):?(\d+)?$/)?.[2] || 0) : 0)
}
const chartCount = async (tool, sheet) => {
  const r = await tool('spreadsheet', { action: 'chart_list', sheet })
  return r?.total ?? (r?.charts || []).length ?? 0
}
const fileExists = (p) => fs.existsSync(p) && fs.statSync(p).size > 100

export const SCENARIOS = [
  { id: 'E01', desc: 'status+sheet_list 报告',
    prompt: '读取表格状态（spreadsheet status）与全部工作表清单（sheet_list），报告工作簿名称与工作表数量（只读）。完成后在表 S01 的 Z1 单元格写入文本「E01完成」。',
    verify: vM('E01') },
  { id: 'E02', desc: '写 10 列表头 + 30 行模拟数据',
    prompt: '在表 S02 写入库存表：A1:J1 表头依次为 物料编码/物料名/类别/库存量/安全库存/单价/金额/仓库/更新日期/备注；A2:J31 写 30 行合理模拟数据（物料编码 M001-M030，类别在 电子件/机械件/耗材 中选取）。完成后在 S02 的 Z1 写「E02完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const h = await rng(tool, 'S02', 'A1:J1')
      const rows = await usedRows(tool, 'S02')
      const m31 = await cell(tool, 'S02', 'A31')
      const ok = h?.[0]?.length === 10 && h[0][0] === '物料编码' && Number(rows) >= 31 && String(m31 || '').includes('M030')
      return [ok, `headers=${h?.[0]?.length} rows=${rows} A31=${m31}`]
    } },
  { id: 'E03', desc: '金额公式列',
    prompt: '在表 S03 的 G2 单元格写公式 =D2*E2（D 列数量 × E 列单价），然后填充到 G2:G21 整列（用 range_write 写二维数组，"="开头会按公式写入）。完成后在 S03 的 Z1 写「E03完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const d = await cell(tool, 'S03', 'D2')
      const e = await cell(tool, 'S03', 'E2')
      const g = await cell(tool, 'S03', 'G2')
      const expect = Number(d) * Number(e)
      const ok = Number(g) === expect && expect > 0
      return [ok, `D2=${d} E2=${e} G2=${g} expect=${expect}`]
    } },
  { id: 'E04', desc: '统计块 SUM/AVERAGE/MAX/MIN/COUNTA',
    prompt: '在表 S04 的 J1:K5 建统计块：J1=合计金额 K1==SUM(F2:F21)；J2=平均单价 K2==AVERAGE(E2:E21)；J3=最大数量 K3==MAX(D2:D21)；J4=最小数量 K4==MIN(D2:D21)；J5=订单数 K5==COUNTA(A2:A21)（A列是文本订单ID，须用 COUNTA）。完成后在 S04 的 Z1 写「E04完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const k1 = await cell(tool, 'S04', 'K1')
      const k5 = await cell(tool, 'S04', 'K5')
      const ok = Number(k1) > 0 && Number(k5) === 20
      return [ok, `K1=${k1} K5=${k5}`]
    } },
  { id: 'E05', desc: 'used_range 报告',
    prompt: '读取表 S05 的 used_range，报告数据区域范围与行列数（只读）。完成后在 S05 的 Z1 写「E05完成」。',
    verify: vM('E05') },
  { id: 'E06', desc: '只读汇总报告',
    prompt: '只读任务：读取表 S06 的 A1:H21，输出洞察：哪个产品金额（F列）合计最高、订单量最多的区域（H列）。结论带具体数字，不要修改表格。完成后在 S06 的 Z1 写「E06完成」。',
    timeout: 300,
    verify: vM('E06') },
  { id: 'E07', desc: 'find 查找订单号',
    prompt: '在表 S07 中用 find 查找「PO07」前缀的订单（what=PO07003），报告命中单元格位置。完成后在 S07 的 Z1 写「E07完成」。',
    verify: vM('E07') },
  { id: 'E08', desc: 'find_replace 批量替换',
    prompt: '在表 S08 用 find_replace 把「无人机」全部替换为「无人飞行器」，报告替换处数。完成后在 S08 的 Z1 写「E08完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const f = await tool('spreadsheet', { action: 'find', sheet: 'S08', what: '无人机' })
      const n = f?.total ?? (f?.matches || []).length ?? -1
      const v = await cell(tool, 'S08', 'Z1')
      return [(n === 0 || n === -1) && String(v).includes('E08完成'), `残留无人机=${n} Z1=${v}`]
    } },
  { id: 'E09', desc: '建对照表+跨表 VLOOKUP',
    prompt: '两步：1) 新建工作表「S09对照」，A1=产品 B1=指导价，A2:A6 写 步枪/火炮/导弹/装甲车/无人机，B2:B6 写 2000/8000/50000/30000/9000；2) 回到表 S09，在 I1 写表头「指导价」，I2:I21 用 VLOOKUP 按 C 列产品名从「S09对照」查指导价。完成后在 S09 的 Z1 写「E09完成」。',
    timeout: 360,
    verify: async ({ tool }) => {
      const sl = await sheets(tool)
      const i2 = await cell(tool, 'S09', 'I2')
      const v = await cell(tool, 'S09', 'Z1')
      return [sl.includes('S09对照') && Number(i2) > 0 && String(v).includes('E09完成'), `对照表=${sl.includes('S09对照')} I2=${i2} Z1=${v}`]
    } },
  { id: 'E10', desc: '行插入',
    prompt: '在表 S10 的第 2 行之前插入一行（row_insert row=2），并在新行写入：A2=PO10NEW、C2=步枪、D2=10、E2=3000、F2=30000。完成后在 S10 的 Z1 写「E10完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const a2 = await cell(tool, 'S10', 'A2')
      const rows = await usedRows(tool, 'S10')
      const v = await cell(tool, 'S10', 'Z1')
      return [String(a2) === 'PO10NEW' && Number(rows) >= 22 && String(v).includes('E10完成'), `A2=${a2} rows=${rows} Z1=${v}`]
    } },
  { id: 'E11', desc: '列插入',
    prompt: '在表 S11 的 C 列之前插入一列（column_insert col=3），新列 C1 写表头「序号」，C2:C21 写 1-20。完成后在 S11 的 Z1 写「E11完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const c1 = await cell(tool, 'S11', 'C1')
      const c21 = await cell(tool, 'S11', 'C21')
      const v = await cell(tool, 'S11', 'Z1')
      return [String(c1) === '序号' && Number(c21) === 20 && String(v).includes('E11完成'), `C1=${c1} C21=${c21} Z1=${v}`]
    } },
  { id: 'E12', desc: '行列删除',
    prompt: '在表 S12：1) 删除第 3 行（row_delete row=3）；2) 删除第 8 列（column_delete col=8，即 H 列区域列）。完成后在 S12 的 Z1 写「E12完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const rows = await usedRows(tool, 'S12')
      const v = await cell(tool, 'S12', 'Z1')
      return [Number(rows) <= 21 && String(v).includes('E12完成'), `rows=${rows}(删后应为21) Z1=${v}`]
    } },
  { id: 'E13', desc: '按金额降序排序',
    prompt: '把表 S13 的 A1:H21 按金额（F 列）降序排序（sort keyColumn=6 order=desc header=true，整行联动）。完成后在 S13 的 Z1 写「E13完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const col = await rng(tool, 'S13', 'F2:F21')
      const vals = (col || []).map(r => Number(r[0]))
      let desc = true
      for (let i = 1; i < vals.length; i++) if (vals[i] > vals[i - 1]) desc = false
      const v = await cell(tool, 'S13', 'Z1')
      return [desc && vals.every(Number.isFinite) && String(v).includes('E13完成'), `desc=${desc} F2:F4=${vals.slice(0, 3)} Z1=${v}`]
    } },
  { id: 'E14', desc: '按数量升序排序',
    prompt: '把表 S14 的 A1:H21 按数量（D 列）升序排序（sort keyColumn=4 order=asc header=true）。完成后在 S14 的 Z1 写「E14完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const col = await rng(tool, 'S14', 'D2:D21')
      const vals = (col || []).map(r => Number(r[0]))
      let asc = true
      for (let i = 1; i < vals.length; i++) if (vals[i] < vals[i - 1]) asc = false
      const v = await cell(tool, 'S14', 'Z1')
      return [asc && String(v).includes('E14完成'), `asc=${asc} D2:D4=${vals.slice(0, 3)} Z1=${v}`]
    } },
  { id: 'E15', desc: '自动筛选',
    prompt: '对表 S15 的 A1:H21 开启自动筛选（autofilter），筛选条件 field=3（产品列）criteria=导弹。完成后在 S15 的 Z1 写「E15完成」。',
    timeout: 300,
    verify: vM('E15') },
  { id: 'E16', desc: '空值填充',
    prompt: '先把表 S16 的 G2:G5 清空（range_write 写空字符串），然后把 G2:G21 的空值单元格填充为「未知客户」（其它已有值不动）。完成后在 S16 的 Z1 写「E16完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const col = await rng(tool, 'S16', 'G2:G5')
      const vals = (col || []).map(r => String(r[0] ?? '').trim())
      const v = await cell(tool, 'S16', 'Z1')
      return [vals.every(x => x.length > 0) && String(v).includes('E16完成'), `G2:G5=${vals} Z1=${v}`]
    } },
  { id: 'E17', desc: '重复数据清理',
    prompt: '在表 S17：先把 A3 单元格改为与 A2 相同的订单ID（制造一条重复），然后用任意方式清理 A 列重复：重复订单ID只保留最早一行（第2行），把重复行整行删除。完成后在 S17 的 Z1 写「E17完成」。',
    timeout: 360,
    verify: async ({ tool }) => {
      const a2 = await cell(tool, 'S17', 'A2')
      const f = await tool('spreadsheet', { action: 'find', sheet: 'S17', what: String(a2), whole: true })
      const n = f?.total ?? (f?.matches || []).length ?? 99
      const v = await cell(tool, 'S17', 'Z1')
      return [n <= 1 && String(v).includes('E17完成'), `A2=${a2} 命中=${n} Z1=${v}`]
    } },
  { id: 'E18', desc: '异常值检测（只读）',
    prompt: '只读检查表 S18 的数据质量：F 列金额是否有非正数、D 列数量是否超出 1-50 合理区间、A 列订单ID是否有重复。输出数据质量报告，不要修改数据。完成后在 S18 的 Z1 写「E18完成」。',
    verify: vM('E18') },
  { id: 'E19', desc: '日期格式统一',
    prompt: '把表 S19 的 B 列（日期）统一格式化为文本格式「2026年M月D日」（如 2026年3月5日，读取原日期后写入格式化文本，注意保持原日期不变只是换写法）。完成后在 S19 的 Z1 写「E19完成」。',
    timeout: 360,
    verify: async ({ tool }) => {
      const b2 = String(await cell(tool, 'S19', 'B2') ?? '')
      const v = await cell(tool, 'S19', 'Z1')
      return [/2026年\d+月\d+日/.test(b2) && String(v).includes('E19完成'), `B2=${b2} Z1=${v}`]
    } },
  { id: 'E20', desc: '文本拆分列',
    prompt: '在表 S20 的 I1:J1 写表头「区域组」「子区」，然后把 H 列的区域值按映射拆到 I、J 两列：华北→(北方,华北)、华东→(南方,华东)、华南→(南方,华南)、西南→(南方,西南)，I2:J21 填入对应文本。完成后在 S20 的 Z1 写「E20完成」。',
    timeout: 360,
    verify: async ({ tool }) => {
      const i2 = await cell(tool, 'S20', 'I2')
      const h2 = await cell(tool, 'S20', 'H2')
      const v = await cell(tool, 'S20', 'Z1')
      const map = { 华北: '北方', 华东: '南方', 华南: '南方', 西南: '南方' }
      const ok = String(i2) === map[String(h2)] && String(v).includes('E20完成')
      return [ok, `H2=${h2} I2=${i2} Z1=${v}`]
    } },
  { id: 'E21', desc: 'IF 状态列',
    prompt: '在表 S21 的 I1 写表头「量级」，I2:I21 写公式 =IF(D2>=30,"高","低")。完成后在 S21 的 Z1 写「E21完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const d2 = Number(await cell(tool, 'S21', 'D2'))
      const i2 = String(await cell(tool, 'S21', 'I2') ?? '')
      const ok = i2 === (d2 >= 30 ? '高' : '低')
      return [ok, `D2=${d2} I2=${i2}`]
    } },
  { id: 'E22', desc: 'RANK 排名列',
    prompt: '在表 S22 的 I1 写表头「金额排名」，I2:I21 写公式 =RANK(F2,F$2:F$21)。完成后在 S22 的 Z1 写「E22完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const i2 = Number(await cell(tool, 'S22', 'I2'))
      const v = await cell(tool, 'S22', 'Z1')
      return [i2 >= 1 && i2 <= 20 && String(v).includes('E22完成'), `I2=${i2} Z1=${v}`]
    } },
  { id: 'E23', desc: '占比列',
    prompt: '在表 S23 的 I1 写表头「金额占比%」，I2:I21 写公式 =F2/SUM(F$2:F$21)*100，保留两位小数（可用 ROUND）。完成后在 S23 的 Z1 写「E23完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const col = await rng(tool, 'S23', 'I2:I21')
      const vals = (col || []).map(r => Number(r[0]))
      const sum = vals.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
      const v = await cell(tool, 'S23', 'Z1')
      return [Math.abs(sum - 100) < 1 && String(v).includes('E23完成'), `Σ占比=${sum.toFixed(2)} Z1=${v}`]
    } },
  { id: 'E24', desc: 'COUNTIF 统计块',
    prompt: '在表 S24 的 J1:K6 建统计块：J1=产品 K1=订单数；J2:J6 写 步枪/火炮/导弹/装甲车/无人机，K2:K6 用 COUNTIF 统计 C 列各产品数量。完成后在 S24 的 Z1 写「E24完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const k2 = await cell(tool, 'S24', 'K2')
      const j2 = await cell(tool, 'S24', 'J2')
      const v = await cell(tool, 'S24', 'Z1')
      return [String(j2) === '步枪' && Number(k2) >= 1 && String(v).includes('E24完成'), `J2=${j2} K2=${k2} Z1=${v}`]
    } },
  { id: 'E25', desc: '表头样式（加粗+底色）',
    prompt: '美化表 S25：A1:H1 表头加粗、底色 #DDEBF7、字体白色（format style {bold:true, bgColor:"#DDEBF7", fontColor:"#FFFFFF"}）。完成后在 S25 的 Z1 写「E25完成」。',
    timeout: 300,
    verify: vM('E25') },
  { id: 'E26', desc: '数字格式',
    prompt: '把表 S26 的 F2:F21（金额）设置数字格式 #,##0.00（format numberFormat）。完成后在 S26 的 Z1 写「E26完成」。',
    verify: vM('E26') },
  { id: 'E27', desc: '合并标题行',
    prompt: '在表 S27：先把 A1 改写为「S27 订单明细总表」，然后合并 A1:H1（format style {merge:true}）并居中。完成后在 S27 的 Z1 写「E27完成」。',
    timeout: 300,
    verify: vM('E27') },
  { id: 'E28', desc: '列宽行高',
    prompt: '调整表 S28 版面：A-H 列列宽设为 14（format columnWidth），1-21 行行高设为 18（format rowHeight）。完成后在 S28 的 Z1 写「E28完成」。',
    timeout: 300,
    verify: vM('E28') },
  { id: 'E29', desc: '斑马纹',
    prompt: '给表 S29 的数据区做斑马纹：偶数行（第2、4、6…20行）A:H 底色 #F5F7FA，奇数行不动（可用多次 format 调用）。完成后在 S29 的 Z1 写「E29完成」。',
    timeout: 360,
    verify: vM('E29') },
  { id: 'E30', desc: '边框',
    prompt: '给表 S30 的 A1:H21 加细边框（format style {border:"thin"}）。完成后在 S30 的 Z1 写「E30完成」。',
    timeout: 300,
    verify: vM('E30') },
  { id: 'E31', desc: '负值标红',
    prompt: '在表 S31 的 I 列（I2:I21）写入 F 列金额与 200000 的差值公式 =F2-200000，然后把 I 列中负数的字体颜色设为红色 #FF0000（format fontColor）。完成后在 S31 的 Z1 写「E31完成」。',
    timeout: 360,
    verify: vM('E31') },
  { id: 'E32', desc: '对齐',
    prompt: '把表 S32 的 A1:H1 表头居中对齐，数据区 A2:H21 的 D、E、F 列右对齐（format align）。完成后在 S32 的 Z1 写「E32完成」。',
    timeout: 300,
    verify: vM('E32') },
  { id: 'E33', desc: '统一标题字体',
    prompt: '把表 S33 的 A1:H1 表头字体统一设为「苹方-简」（format fontName="PingFang SC"，若失败则用「微软雅黑」），字号 12。完成后在 S33 的 Z1 写「E33完成」。',
    timeout: 300,
    verify: vM('E33') },
  { id: 'E34', desc: '自动换行',
    prompt: '把表 S34 的 G 列（客户列 G2:G21）开启自动换行（format wrapText=true），并把 G 列列宽设为 10。完成后在 S34 的 Z1 写「E34完成」。',
    timeout: 300,
    verify: vM('E34') },
  { id: 'E35', desc: '柱状图',
    prompt: '用表 S35 的 C 列产品和 F 列金额汇总数据（可在 J1:K7 先建 COUNTIF/SUMIF 汇总），然后 chart_add 一张柱状图（type=column，dataRange 取汇总区，标题「S35 产品金额」）。完成后在 S35 的 Z1 写「E35完成」。',
    timeout: 360,
    verify: async ({ tool }) => [await chartCount(tool, 'S35') >= 1 && String(await cell(tool, 'S35', 'Z1')).includes('E35完成'), `charts=${await chartCount(tool, 'S35')}`] },
  { id: 'E36', desc: '饼图',
    prompt: '对表 S36 按 H 列区域统计订单数（在 J1:K6 建 COUNTIF 汇总），chart_add 一张饼图（type=pie，标题「S36 区域分布」）。完成后在 S36 的 Z1 写「E36完成」。',
    timeout: 360,
    verify: async ({ tool }) => [await chartCount(tool, 'S36') >= 1 && String(await cell(tool, 'S36', 'Z1')).includes('E36完成'), `charts=${await chartCount(tool, 'S36')}`] },
  { id: 'E37', desc: '折线图',
    prompt: '对表 S37 按 B 列月份（取 MM 部分）汇总金额（J 列月份 1-9 月，K 列 SUMIF），chart_add 折线图（type=line，标题「S37 月度金额」）。完成后在 S37 的 Z1 写「E37完成」。',
    timeout: 360,
    verify: async ({ tool }) => [await chartCount(tool, 'S37') >= 1 && String(await cell(tool, 'S37', 'Z1')).includes('E37完成'), `charts=${await chartCount(tool, 'S37')}`] },
  { id: 'E38', desc: '条形图',
    prompt: '对表 S38 按 C 列产品统计数量合计（SUMIF 到 J1:K6），chart_add 条形图（type=bar，标题「S38 产品数量」）。完成后在 S38 的 Z1 写「E38完成」。',
    timeout: 360,
    verify: async ({ tool }) => [await chartCount(tool, 'S38') >= 1 && String(await cell(tool, 'S38', 'Z1')).includes('E38完成'), `charts=${await chartCount(tool, 'S38')}`] },
  { id: 'E39', desc: '面积图',
    prompt: '用表 S39 的 D2:D21 数量列做 chart_add 面积图（type=area，dataRange=D1:D21，标题「S39 数量走势」）。完成后在 S39 的 Z1 写「E39完成」。',
    timeout: 360,
    verify: async ({ tool }) => [await chartCount(tool, 'S39') >= 1 && String(await cell(tool, 'S39', 'Z1')).includes('E39完成'), `charts=${await chartCount(tool, 'S39')}`] },
  { id: 'E40', desc: '雷达图',
    prompt: '对表 S40 按 H 列区域统计金额（SUMIF 到 J1:K6），chart_add 雷达图（type=radar，标题「S40 区域金额」）。完成后在 S40 的 Z1 写「E40完成」。',
    timeout: 360,
    verify: async ({ tool }) => [await chartCount(tool, 'S40') >= 1 && String(await cell(tool, 'S40', 'Z1')).includes('E40完成'), `charts=${await chartCount(tool, 'S40')}`] },
  { id: 'E41', desc: '图表导出 PNG',
    prompt: '表 S41 已有一张图表（若无则先对 F2:F21 chart_add 柱状图），用 chart_export 把它导出为 PNG 到 ' + path.join(ART, 'et-chart.png') + '。完成后在 S41 的 Z1 写「E41完成」。',
    timeout: 360,
    verify: async ({ tool }) => [fileExists(path.join(ART, 'et-chart.png')) && String(await cell(tool, 'S41', 'Z1')).includes('E41完成'), `png=${fileExists(path.join(ART, 'et-chart.png'))}`] },
  { id: 'E42', desc: '图表清单报告',
    prompt: '列出表 S42 的图表清单（chart_list，只读），报告图表数量；若为 0，先给 F2:F21 添加一张柱状图再列一次。完成后在 S42 的 Z1 写「E42完成」。',
    timeout: 360,
    verify: vM('E42') },
  { id: 'E43', desc: '导出 CSV',
    prompt: '把表 S43 导出为 CSV（export format=csv）到 ' + path.join(ART, 'et-s43.csv') + '。完成后在 S43 的 Z1 写「E43完成」。',
    timeout: 300,
    verify: async ({ tool }) => [fileExists(path.join(ART, 'et-s43.csv')) && String(await cell(tool, 'S43', 'Z1')).includes('E43完成'), `csv=${fileExists(path.join(ART, 'et-s43.csv'))}`] },
  { id: 'E44', desc: '导出 PDF',
    prompt: '把当前工作簿导出为 PDF（export format=pdf）到 ' + path.join(ART, 'et-s44.pdf') + '（会含所有表，正常）。完成后在 S44 的 Z1 写「E44完成」。',
    timeout: 360,
    verify: async ({ tool }) => [fileExists(path.join(ART, 'et-s44.pdf')) && String(await cell(tool, 'S44', 'Z1')).includes('E44完成'), `pdf=${fileExists(path.join(ART, 'et-s44.pdf'))}`] },
  { id: 'E45', desc: '重命名工作表',
    prompt: '把工作表 S45 重命名为「S45重命名」（sheet_rename）。完成后在「S45重命名」表的 Z1 写「E45完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const sl = await sheets(tool)
      const v = await cell(tool, 'S45重命名', 'Z1')
      return [sl.includes('S45重命名') && !sl.includes('S45') && String(v).includes('E45完成'), `sheets含新名=${sl.includes('S45重命名')} Z1=${v}`]
    } },
  { id: 'E46', desc: '新建工作表',
    prompt: '新建工作表「S46新增」（sheet_add，放到最后），在新表 A1 写「新建表测试」。完成后在「S46新增」表的 Z1 写「E46完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const sl = await sheets(tool)
      const a1 = await cell(tool, 'S46新增', 'A1')
      return [sl.includes('S46新增') && String(a1).includes('新建表测试'), `exists=${sl.includes('S46新增')} A1=${a1}`]
    } },
  { id: 'E47', desc: '删除工作表',
    prompt: '删除工作表 S47（sheet_delete，其它表保留）。',
    timeout: 300,
    verify: async ({ tool }) => {
      const sl = await sheets(tool)
      return [!sl.includes('S47'), `S47已删=${!sl.includes('S47')} 表数=${sl.length}`]
    } },
  { id: 'E48', desc: '整表复制到新表',
    prompt: '把表 S48 的 A1:H21 数据复制到新建表「S48副本」（先 range_read S48 再 range_write 到 S48副本）。完成后在「S48副本」表的 Z1 写「E48完成」。',
    timeout: 360,
    verify: async ({ tool }) => {
      const a = await cell(tool, 'S48', 'A2')
      const b = await cell(tool, 'S48副本', 'A2')
      const f2 = Number(await cell(tool, 'S48副本', 'F2'))
      return [String(a) === String(b) && f2 > 0, `S48!A2=${a} 副本!A2=${b} 副本!F2=${f2}`]
    } },
  { id: 'E49', desc: '双表合并',
    prompt: '新建表「S49汇总」：把 S01 的 A1:H21 与 S02 的 A2:H21（数据行，不含表头）先后追加进去（S01 在前，S02 紧随其后），形成约 40 行数据的合并表。完成后在「S49汇总」表的 Z1 写「E49完成」。',
    timeout: 420,
    verify: async ({ tool }) => {
      const rows = await usedRows(tool, 'S49汇总')
      return [Number(rows) >= 40, `汇总行数=${rows}`]
    } },
  { id: 'E50', desc: '第二份 CSV 备份',
    prompt: '把表 S50 的 A1:H21 区域导出为 CSV 备份（export format=csv）到 ' + path.join(ART, 'et-s50-backup.csv') + '。完成后在 S50 的 Z1 写「E50完成」。',
    timeout: 300,
    verify: async ({ tool }) => [fileExists(path.join(ART, 'et-s50-backup.csv')) && String(await cell(tool, 'S50', 'Z1')).includes('E50完成'), `csv=${fileExists(path.join(ART, 'et-s50-backup.csv'))}`] },
  { id: 'E51', desc: '生成 100 行员工表',
    prompt: '在表 S51 生成员工花名册：A1:F1 表头 工号/姓名/部门/入职年月/基本工资/绩效系数；写 100 行数据（工号 E001-E100，部门在 研发/市场/交付/职能 中选取，基本工资 8000-30000，绩效系数 0.8-1.5）。完成后在 S51 的 Z1 写「E51完成」。',
    timeout: 420,
    verify: async ({ tool }) => {
      const rows = await usedRows(tool, 'S51')
      const a101 = await cell(tool, 'S51', 'A101')
      const v = await cell(tool, 'S51', 'Z1')
      return [Number(rows) >= 101 && String(a101).includes('E100') && String(v).includes('E51完成'), `rows=${rows} A101=${a101} Z1=${v}`]
    } },
  { id: 'E52', desc: '12 月预算表 + 合计',
    prompt: '在表 S52 生成年度预算：A1 写「月份」B1 写「预算万元」，A2:A13 写 1月-12月，B2:B13 写 80-150 之间的数值；A14 写「合计」B14 用 =SUM(B2:B13)。完成后在 S52 的 Z1 写「E52完成」。',
    timeout: 360,
    verify: async ({ tool }) => {
      const b = await rng(tool, 'S52', 'B2:B13')
      const total = (b || []).reduce((s, r) => s + Number(r[0] || 0), 0)
      const b14 = Number(await cell(tool, 'S52', 'B14'))
      const v = await cell(tool, 'S52', 'Z1')
      return [Math.abs(b14 - total) < 0.01 && total > 0 && String(v).includes('E52完成'), `ΣB2:B13=${total.toFixed(1)} B14=${b14} Z1=${v}`]
    } },
  { id: 'E53', desc: '销售漏斗统计',
    prompt: '在表 S53 建 K1:M6 销售漏斗统计：K 列阶段（线索/意向/报价/成交/回款），L 列数量（线索 500、意向 320、报价 180、成交 95、回款 80），M 列转化率（相对上一阶段 %，用公式或数值均可）。完成后在 S53 的 Z1 写「E53完成」。',
    timeout: 360,
    verify: async ({ tool }) => {
      const l3 = await cell(tool, 'S53', 'L3')
      const v = await cell(tool, 'S53', 'Z1')
      return [Number(l3) === 320 && String(v).includes('E53完成'), `L3=${l3} Z1=${v}`]
    } },
  { id: 'E54', desc: '考勤统计',
    prompt: '在表 S54 生成 3 月考勤表：A1:D1 表头 姓名/应出勤/实出勤/出勤率，写 20 行员工数据（应出勤 22，实出勤 18-22），D 列用公式 =C2/B2。完成后在 S54 的 Z1 写「E54完成」。',
    timeout: 420,
    verify: async ({ tool }) => {
      const b2 = Number(await cell(tool, 'S54', 'B2'))
      const c2 = Number(await cell(tool, 'S54', 'C2'))
      const d2 = Number(await cell(tool, 'S54', 'D2'))
      const v = await cell(tool, 'S54', 'Z1')
      return [b2 === 22 && Math.abs(d2 - c2 / b2) < 0.01 && String(v).includes('E54完成'), `B2=${b2} C2=${c2} D2=${d2} Z1=${v}`]
    } },
  { id: 'E55', desc: '库存预警标记',
    prompt: '在表 S55：I1 写表头「预警」，I2:I21 写公式 =IF(D2<15,"补货","充足")（D 列为数量）。然后把 I 列值为「补货」的单元格底色标黄 #FFF2CC。完成后在 S55 的 Z1 写「E55完成」。',
    timeout: 420,
    verify: vM('E55') },
  { id: 'E56', desc: '含税价计算',
    prompt: '在表 S56：I1 写表头「含税价」，I2:I21 写公式 =ROUND(F2*1.13,2)（金额 13% 增值税）。完成后在 S56 的 Z1 写「E56完成」。',
    timeout: 300,
    verify: async ({ tool }) => {
      const f2 = Number(await cell(tool, 'S56', 'F2'))
      const i2 = Number(await cell(tool, 'S56', 'I2'))
      const v = await cell(tool, 'S56', 'Z1')
      return [Math.abs(i2 - f2 * 1.13) < 0.01 && String(v).includes('E56完成'), `F2=${f2} I2=${i2} Z1=${v}`]
    } },
  { id: 'E57', desc: '成绩等级',
    prompt: '在表 S57 生成成绩表：A1:C1 表头 姓名/分数/等级，写 30 行（分数 55-100），C 列等级用公式 =IF(B2>=90,"优",IF(B2>=75,"良",IF(B2>=60,"及格","不及格")))。完成后在 S57 的 Z1 写「E57完成」。',
    timeout: 420,
    verify: async ({ tool }) => {
      const b2 = Number(await cell(tool, 'S57', 'B2'))
      const c2 = String(await cell(tool, 'S57', 'C2'))
      const expect = b2 >= 90 ? '优' : b2 >= 75 ? '良' : b2 >= 60 ? '及格' : '不及格'
      return [c2 === expect && String(await cell(tool, 'S57', 'Z1')).includes('E57完成'), `B2=${b2} C2=${c2} expect=${expect}`]
    } },
  { id: 'E58', desc: '项目排期日期序列',
    prompt: '在表 S58 生成项目排期：A1:C1 表头 任务/开始日/结束日；写 10 个任务，开始日从 2026-10-08 起每个任务顺延 7 天，结束日=开始日+6 天（日期写 YYYY-MM-DD 文本）。完成后在 S58 的 Z1 写「E58完成」。',
    timeout: 360,
    verify: async ({ tool }) => {
      const b2 = String(await cell(tool, 'S58', 'B2') ?? '')
      const b3 = String(await cell(tool, 'S58', 'B3') ?? '')
      const v = await cell(tool, 'S58', 'Z1')
      return [b2.includes('2026-10-08') && b3.includes('2026-10-15') && String(v).includes('E58完成'), `B2=${b2} B3=${b3} Z1=${v}`]
    } },
  { id: 'E59', desc: '工资表实发公式',
    prompt: '在表 S59 生成工资表：A1:F1 表头 姓名/基本工资/社保扣款/公积金/个税/实发，写 15 行（基本工资 10000-25000，社保=基本×10.5% 公式，公积金=基本×12% 公式，个税=基本×3% 公式，实发=基本-社保-公积金-个税 公式）。完成后在 S59 的 Z1 写「E59完成」。',
    timeout: 420,
    verify: async ({ tool }) => {
      const b = Number(await cell(tool, 'S59', 'B2'))
      const f = Number(await cell(tool, 'S59', 'F2'))
      const expect = b - b * 0.105 - b * 0.12 - b * 0.03
      const v = await cell(tool, 'S59', 'Z1')
      return [Math.abs(f - expect) < 0.01 && String(v).includes('E59完成'), `B2=${b} F2=${f} expect=${expect.toFixed(1)} Z1=${v}`]
    } },
  { id: 'E60', desc: '全册状态报告',
    prompt: '只读任务：读取工作簿状态（status）与 sheet_list，报告：工作簿名、工作表总数、前 5 个表名。完成后在 S60 的 Z1 写「E60完成」。',
    timeout: 300,
    verify: vM('E60') },
  { id: 'E61', desc: '表格插图能力边界（负面用例）',
    prompt: '先新建工作表「S61」（sheet_add），然后尝试把本地图片 /Users/zyh/work/chayuan-wps/artifacts/e2e-180/files/seed-image.png 插入到该表。如果当前表格工具不支持插图，请如实报告不支持及具体原因，并仍在「S61」表的 Z1 单元格写「E61完成」。不要虚构插入成功。',
    timeout: 300,
    verify: vM('E61') }
]
