/**
 * 表格车道场景（2026-10 助手增量批次）：37 个（NE01–NE37），逐一对应 hostAssistants.js 新增表格配方。
 * 种子工作簿 e2e-et2.xlsx（28 表）；跨宿主场景（NE03/NE35/NE36）需要 wps/wpp 宿主同时在线。
 * marker 约定：来源表 Z1 写「NExx完成」（公式解释等纯报告场景写在指定单元格）。
 */
import { FILES_DIR, activateDoc, osOpenDoc } from './harness.mjs'
import path from 'node:path'

const XLSX = path.join(FILES_DIR, 'e2e-et2.xlsx')

async function cell(tool, sheet, a1) {
  const r = await tool('spreadsheet', { action: 'range_read', sheet, range: `${a1}:${a1}` })
  return r?.values?.[0]?.[0]
}
async function rng(tool, sheet, a1) {
  const r = await tool('spreadsheet', { action: 'range_read', sheet, range: a1 })
  return r?.values || []
}
async function sheets(tool) {
  const r = await tool('spreadsheet', { action: 'sheet_list' })
  return (r?.sheets || []).map(s => s?.name || s)
}
async function usedRows(tool, sheet) {
  const r = await tool('spreadsheet', { action: 'used_range', sheet })
  return r?.rowCount ?? r?.rows ?? 0
}
/** 在区域里找文本/数字命中 */
async function scan(tool, sheet, { text, numMin, numMax, range = 'A1:T40' }) {
  const vals = await rng(tool, sheet, range)
  for (const row of vals) for (const v of row) {
    if (v == null) continue
    const s = String(v)
    if (text && text.some(t => s.includes(t))) return true
    const n = Number(s.replace(/[,%￥¥]/g, ''))
    if (!Number.isNaN(n) && numMin !== undefined && n >= numMin && n <= (numMax ?? numMin)) return true
  }
  return false
}
const vM = (sheet, id) => async ({ tool }) => {
  const v = await cell(tool, sheet, 'Z1')
  return [String(v ?? '').includes(`${id}完成`), `${sheet}!Z1=${String(v).slice(0, 60)}`]
}
const sheetExists = async (tool, name) => {
  const list = await sheets(tool)
  return list.includes(name)
}

export const SCENARIOS = [
  // ── NE01 多表合并汇总（et-merge-sheets）──
  { id: 'NE01', desc: '配方 et-merge-sheets 多表合并汇总',
    prompt: '请把「华东明细」「华北明细」两个工作表的数据合并成一张汇总表：先 sheet_list 列出工作表，逐表 range_read 后按统一表头合并，新建工作表「合并汇总」写入（加一列「来源表」标注每行出处），完成后报告各表并入行数。最后在「华东明细」表 Z1 写「NE01完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '合并汇总')
      const rows = await usedRows(tool, '合并汇总')
      return [Number(rows) >= 13, `合并汇总 rows=${rows}（需≥13）`]
    } },
  // ── NE02 两表对比差异（et-diff-two）──
  { id: 'NE02', desc: '配方 et-diff-two 两表对比差异',
    prompt: '请对比「名册A」「名册B」两张表找差异：按关键列「编号」匹配，标出 ① 只在A表有的行 ② 只在B表有的行 ③ 两表都有但字段值不同的行（列出差异字段与两个值），结果写入新工作表「差异报告」分三个区块，并在两表各自 F 列加「核对结果」标记。最后在「名册A」表 Z1 写「NE02完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '差异报告')
      const hit = await scan(tool, '差异报告', { text: ['仅在', 'P010', 'P011', '差异'] })
      return [ok1 && hit, `差异报告=${ok1} 内容命中=${hit}`]
    } },
  // ── NE04 敏感信息脱敏（et-mask）──
  { id: 'NE04', desc: '配方 et-mask 敏感信息脱敏',
    prompt: '请对「客户资料」表做敏感信息脱敏：手机号中间 4 位打码（如 138****1234）、身份证号保留前 6 后 4、银行卡号保留后 4，在原列右侧（F/G/H 列起）生成脱敏列（不覆盖 B/C/D 原数据），完成后报告每类处理条数。最后在「客户资料」表 Z1 写「NE04完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const hit = await scan(tool, '客户资料', { text: ['****'], range: 'A1:L10' })
      return [hit, `脱敏标记 **** 命中=${hit}`]
    } },
  // ── NE05 智能分列（et-split-cols）──
  { id: 'NE05', desc: '配方 et-split-cols 智能分列',
    prompt: '请把「联系方式」表 A 列拆成两列：按空格分隔拆出 姓名/电话，写入 B 列（姓名）和 C 列（电话），B1=姓名 C1=电话，原 A 列保留，完成后报告拆分行数。最后在「联系方式」表 Z1 写「NE05完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const b2 = await cell(tool, '联系方式', 'B2')
      const c2 = await cell(tool, '联系方式', 'C2')
      const ok = String(b2 ?? '').includes('张三') && String(c2 ?? '').includes('13800001234')
      return [ok, `B2=${b2} C2=${c2}`]
    } },
  // ── NE06 工作表拆分（et-split-sheets）──
  { id: 'NE06', desc: '配方 et-split-sheets 工作表拆分',
    prompt: '请按「订单明细」表 C 列（部门）的取值把该表拆成多个工作表：每个部门一个新表（华东/华北/华南），表头与原表一致，数据行按部门归类，完成后报告各表行数。最后在「订单明细」表 Z1 写「NE06完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const list = await sheets(tool)
      const need = ['华东', '华北', '华南'].filter(n => list.includes(n))
      return [need.length === 3, `拆分表=${need.join(',')}（需3个）`]
    } },
  // ── NE07 公式解释（et-formula-explain）──
  { id: 'NE07', desc: '配方 et-formula-explain 公式解释',
    prompt: '「公式演示」表 B2 的公式是 =SUMIF(A1:A6,">50")（工具读不到公式文本，以此为准；A1:A6 是数值列，B2 当前显示 146）。请用大白话解释这个公式在算什么，并调用 spreadsheet 工具 range_write 把一句话解释写入 D1（不超过 60 字）、E1 写改进建议或「无」。D1/E1 写入是硬性交付物，写完后在对话里展开详细解释。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const d1 = String((await rng(tool, '公式演示', 'D1:D1'))?.[0]?.[0] ?? '')
      return [d1.length >= 8, `公式演示!D1=${d1.slice(0, 60)}`]
    } },
  // ── NE08 一键美化（et-beautify）──
  { id: 'NE08', desc: '配方 et-beautify 一键美化',
    prompt: '第一步：先在「销售明细」表 Z1 单元格写入文本「NE08完成」。第二步：美化该表排版（不要改动任何数值）——表头行加粗+深底白字+居中，数据区加细边框，销售额列右对齐，列宽适当加宽（全部用 format 完成），完成后报告触及区域。',
    timeout: 360,
    attempts: 3,
    verify: vM('销售明细', 'NE08') },
  // ── NE09 异常标色（et-mark）──
  { id: 'NE09', desc: '配方 et-mark 异常标色',
    prompt: '请按规则给「销售明细」表异常数据标色：销售额 < 1000 的行整行浅红底色（format bgColor），并在 E 列写入异常原因文字（E1 表头「异常原因」），完成后报告异常行数。最后在 Z1 写「NE09完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const vals = await rng(tool, '销售明细', 'E2:E13')
      const hits = vals.flat().filter(v => v != null && String(v).trim() !== '').length
      return [hits >= 2, `E列异常原因数=${hits}（需≥2）`]
    } },
  // ── NE10 应收账龄分析（et-fin-aging）──
  { id: 'NE10', desc: '配方 et-fin-aging 应收账龄分析',
    prompt: '请对「应收账款」表做账龄分析：按账龄分段（0-30 天/31-90 天/91-180 天/180 天以上，基于 TODAY-应收日期），新建「账龄分析」表输出各分段未收金额（应收-已收）与超龄客户 TOP5，180 天以上的行标红，账龄基准日用今天。最后在「应收账款」表 Z1 写「NE10完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '账龄分析')
      const hit = ok1 && (await scan(tool, '账龄分析', { text: ['180', '账龄', '分段'], range: 'A1:AZ60' })
        || await scan(tool, '账龄分析', { numMin: 180, numMax: 3650, range: 'A1:AZ60' }))
      return [ok1 && hit, `账龄分析=${ok1} 内容命中=${hit}`]
    } },
  // ── NE11 银行余额调节表（et-fin-bankrec）──
  { id: 'NE11', desc: '配方 et-fin-bankrec 银行余额调节表',
    prompt: '请生成银行余额调节表：对比「银行流水」「账面记录」两表，逐笔按日期+金额勾对，未匹配项按四类分列（企业已收银行未收/企业已付银行未付/银行已收企业未收/银行已付企业未付），新建「余额调节表」写入并用公式校验调节后两边平衡。最后在「银行流水」表 Z1 写「NE11完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '余额调节表')
      const hit = await scan(tool, '余额调节表', { text: ['调节', '未达', '未收', '未付'] })
      return [ok1 && hit, `余额调节表=${ok1} 内容命中=${hit}`]
    } },
  // ── NE12 月末结账自查（et-fin-closecheck）──
  { id: 'NE12', desc: '配方 et-fin-closecheck 月末结账自查',
    prompt: '请对「账表」做月末结账前自查（只读不改）：① 借贷是否平衡 ② 凭证号是否断号 ③ 是否有金额异常。输出问题清单（位置+问题+建议），并写入新表「自查结果」。最后在「账表」表 Z1 写「NE12完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '自查结果')
      const hit = await scan(tool, '自查结果', { text: ['V007', '断号', '不平衡'] })
      return [ok1 && hit, `自查结果=${ok1} 问题命中=${hit}`]
    } },
  // ── NE13 退货退款分析（et-ec-refund）──
  { id: 'NE13', desc: '配方 et-ec-refund 退货退款分析',
    prompt: '「退货明细」表 A2:D21 有 20 条退货记录（本期总订单 100 笔）。请分三步完成分析：① sheet_add 新建「退货分析」表；② 新表 A1=原因、B1=笔数，A2:B6 按退货原因归类统计（COUNTIF 公式引用退货明细!C 列）；③ E1=退货率、F1=公式 COUNTA(退货明细!A2:A21)/100，E2 写金额损失最大的商品名。所有格子必须写入实际内容，不要留空占位。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '退货分析')
      const hit = ok1 && (await scan(tool, '退货分析', { text: ['退货率', '20%'], range: 'A1:AZ60' })
        || await scan(tool, '退货分析', { numMin: 0.19, numMax: 0.21, range: 'A1:AZ60' })
        || await scan(tool, '退货分析', { numMin: 19, numMax: 21, range: 'A1:AZ60' }))
      return [ok1 && hit, `退货分析=${ok1} 退货率命中=${hit}`]
    } },
  // ── NE14 大促ROI复盘（et-ec-roi）──
  { id: 'NE14', desc: '配方 et-ec-roi 大促ROI复盘',
    prompt: '请复盘「大促费用」表的大促 ROI：按渠道计算投产比（GMV/费用 公式列）、客单价忽略，新建「ROI复盘」表：A 列渠道、B 列费用、C 列 GMV、D 列 ROI，ROI 低于 1 的行标红，D2 应为渠道A 的 ROI。最后在「大促费用」表 Z1 写「NE14完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const d2 = await cell(tool, 'ROI复盘', 'D2')
      const ok = Math.abs(Number(d2) - 2.5) < 0.05
      return [ok, `ROI复盘!D2=${d2}（期望 2.5）`]
    } },
  // ── NE15 评价关键词提取（et-ec-keywords）──
  { id: 'NE15', desc: '配方 et-ec-keywords 评价关键词提取',
    prompt: '「评价数据」表 A2:A21 有 20 条商品评价。请分两步：① sheet_add 新建「关键词」表，写表头 A1=词、B1=频次、C1=正负面；② A2:C11 提取出现频次最高的 10 个关键词（如 物流/质量/客服 等，B 列写频次数字或 COUNTIF 公式，C 列写 正面 或 负面）。所有格子必须写入实际内容，不要留空占位。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '关键词')
      const hit = await scan(tool, '关键词', { text: ['物流'] })
      return [ok1 && hit, `关键词=${ok1} 物流命中=${hit}`]
    } },
  // ── NE16 离职率分析（et-hr-turnover）──
  { id: 'NE16', desc: '配方 et-hr-turnover 离职率分析',
    prompt: '请分析「离职记录」表：按部门计算离职率（离职人数/期均在册，期均在册口径：技术部 20 人、销售部 12 人、人事部 6 人、财务部 5 人），新建「离职分析」表输出（B2 放技术部离职率，小数），标出离职率偏高的部门并给 2 条观察。最后在「离职记录」表 Z1 写「NE16完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const b2 = await cell(tool, '离职分析', 'B2')
      const s = String(b2 ?? '')
      const n = Number(s.replace(/[%\s]/g, ''))
      const numOk = !Number.isNaN(n) && (Math.abs(n - 0.2) < 0.01 || Math.abs(n - 20) < 0.5)
      // VM 的 range_read 对公式格返回公式串（Mac 返回计算值），公式也算实质命中
      const fOk = /\d/.test(s) && /[*+\/-]|SUM|IF|COUNT/.test(s)
      return [numOk || fOk, `离职分析!B2=${b2}`]
    } },
  // ── NE17 社保公积金核算（et-hr-social）──
  { id: 'NE17', desc: '配方 et-hr-social 社保公积金核算',
    prompt: '请核算「社保名单」表的社保个人部分：缴费基数按 下限5000/上限25000 截断（MIN/MAX 公式），个人费率 养老8%+医疗2%+失业0.5%，新建「社保核算」表：A列姓名、B列缴费基数、C列个人缴纳合计（公式），C2 应为张三的合计。最后在「社保名单」表 Z1 写「NE17完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const c2 = await cell(tool, '社保核算', 'C2')
      const cs = String(c2 ?? '')
      const ok = Math.abs(Number(c2) - 1050) < 0.51 || cs.includes('0.105')
      return [ok, `社保核算!C2=${c2}（张三期望 1050）`]
    } },
  // ── NE18 绩效分布对照（et-hr-perfbox）──
  { id: 'NE18', desc: '配方 et-hr-perfbox 绩效分布对照',
    prompt: '请统计「绩效结果」表：按绩效等级×部门输出人数矩阵（COUNTIFS 公式，新建「绩效分布」表存放，行=部门 列=A/B/C），与强制分布比例 A:B:C=2:7:1 对照给出超编/缺编结论。最后在「绩效结果」表 Z1 写「NE18完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '绩效分布')
      const hit = await scan(tool, '绩效分布', { text: ['A', 'C', '技术部'] })
      return [ok1 && hit, `绩效分布=${ok1} 矩阵命中=${hit}`]
    } },
  // ── NE19 商机金额漏斗（et-sale-funnel-amt）──
  { id: 'NE19', desc: '配方 et-sale-funnel-amt 商机金额漏斗',
    prompt: '请按商机阶段统计「商机表」的金额漏斗：各阶段（初步接触/方案报价/商务谈判/成交）商机数量与金额合计（SUMIF/COUNTIF 公式），新建「金额漏斗」表输出并计算阶段转化率，标出金额流失最大的环节。最后在「商机表」表 Z1 写「NE19完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '金额漏斗')
      const hit = await scan(tool, '金额漏斗', { numMin: 79999, numMax: 80001 })
        || await scan(tool, '金额漏斗', { text: ['SUMIF', '成交'] })
      return [ok1 && hit, `金额漏斗=${ok1} 成交80000命中=${hit}`]
    } },
  // ── NE20 客户分布图（et-sale-region）──
  { id: 'NE20', desc: '配方 et-sale-region 客户分布图',
    prompt: '请按区域维度统计「销售区域」表：各区域客户数（COUNTIF）与销售额合计（SUMIF），新建「区域汇总」表存放，并用 chart_add 基于汇总数据生成柱状图（图表标题「区域销售对比」）。最后在「销售区域」表 Z1 写「NE20完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '区域汇总')
      let charts = 0
      for (const s of await sheets(tool)) {
        const r = await tool('spreadsheet', { action: 'chart_list', sheet: s })
        charts += Number(r?.total ?? (r?.charts || []).length ?? 0)
      }
      return [ok1 && charts >= 1, `区域汇总=${ok1} 全簿图表数=${charts}`]
    } },
  // ── NE21 试卷质量分析（et-edu-exam）──
  { id: 'NE21', desc: '配方 et-edu-exam 试卷质量分析',
    prompt: '请对「成绩表」做试卷质量分析：5 道题满分依次 20/20/10/25/25，逐题计算难度系数（平均得分/满分）与区分度（前27%高分组均分/满分 − 后27%低分组均分/满分），新建「试卷分析」表输出逐题指标，标出过难或区分度差的题。最后在「成绩表」表 Z1 写「NE21完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '试卷分析')
      const rows = ok1 ? await usedRows(tool, '试卷分析') : 0
      return [ok1 && Number(rows) >= 6, `试卷分析=${ok1} rows=${rows}（需≥6）`]
    } },
  // ── NE22 随机分组排座（et-edu-group）──
  { id: 'NE22', desc: '配方 et-edu-group 随机分组排座',
    prompt: '请把「分组名单」表的 12 人随机分成 3 组：新建「分组表」，A 列组名（固定用 第1组/第2组/第3组）、B 列姓名，每组 4 人，完成后报告各组名单。最后在「分组名单」表 Z1 写「NE22完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '分组表')
      const hit = await scan(tool, '分组表', { text: ['第1组'] }) && await scan(tool, '分组表', { text: ['第2组'] }) && await scan(tool, '分组表', { text: ['第3组'] })
      return [ok1 && hit, `分组表=${ok1} 三组名齐全=${hit}`]
    } },
  // ── NE23 课程表生成（et-edu-timetable）──
  { id: 'NE23', desc: '配方 et-edu-timetable 课程表生成',
    prompt: '请生成初二（3）班课程表：新建「课程表」表，行=节次（第1-6节）、列=周一~周五，科目池 语文/数学/英语/物理/体育/音乐（每天 6 节，语文数学各每天 1 节，教师名可用 张老师/李老师/王老师），写入科目+教师。最后在任意单元格确认后报告排课总数，并在「课程表」表 Z1 写「NE23完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '课程表')
      const hit = ok1 && await scan(tool, '课程表', { text: ['周一'] }) && await scan(tool, '课程表', { text: ['周五'] })
      return [ok1 && hit, `课程表=${ok1} 周一~周五表头=${hit}`]
    } },
  // ── NE24 排班表生成（et-med-schedule）──
  { id: 'NE24', desc: '配方 et-med-schedule 排班表生成',
    prompt: '请为诊所生成一周排班表：人员 张医生/李护士/王医生/赵护士/钱医助，日期 下周一~下周日 7 天，班次只用 白班/晚班/休，约束：每天白班≥2人、晚班≥1人、每人本周休≥2天，新建「排班表」（行=人员 列=日期），并在表下方统计每人班次数。最后在「排班表」表 Z1 写「NE24完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '排班表')
      const hit = ok1 && await scan(tool, '排班表', { text: ['休'] }) && await scan(tool, '排班表', { text: ['白班', '晚班'] })
      return [ok1 && hit, `排班表=${ok1} 班次命中=${hit}`]
    } },
  // ── NE25 随访到期名单（et-med-followup）──
  { id: 'NE25', desc: '配方 et-med-followup 随访到期名单',
    prompt: '请从「患者记录」表筛选随访名单：随访周期 30 天，计算距上次随访天数（TODAY-上次随访日期），把已到期与 3 日内到期的患者按紧迫度排序写入新表「随访名单」（已到期标红）。最后在「患者记录」表 Z1 写「NE25完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '随访名单')
      const hit1 = ok1 && await scan(tool, '随访名单', { text: ['张三'] })
      const hit2 = ok1 && await scan(tool, '随访名单', { text: ['王五'] })
      return [ok1 && hit1 && hit2, `随访名单=${ok1} 张三=${hit1} 王五=${hit2}`]
    } },
  // ── NE26 BOM成本汇总（et-mfg-bom）──
  { id: 'NE26', desc: '配方 et-mfg-bom BOM成本汇总',
    prompt: '请核算「BOM清单」表成本：子件成本=用量×单价，父件成本=子件合计（半成品B=3×5=15），整机A=零件X+零件Y+半成品B，新建「成本汇总」表：A列物料、B列单位成本（公式），B2=整机A 单位成本，并标出成本占比最高的物料。最后在「BOM清单」表 Z1 写「NE26完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const b2 = await cell(tool, '成本汇总', 'B2')
      const bs = String(b2 ?? '');const ok = Math.abs(Number(b2) - 50) < 0.01 || (/\d/.test(bs) && /[*+\/-]|SUM|IF/.test(bs))
      return [ok, `成本汇总!B2=${b2}（整机A 期望 50）`]
    } },
  // ── NE27 盘点差异表（et-mfg-stocktake）──
  { id: 'NE27', desc: '配方 et-mfg-stocktake 盘点差异表',
    prompt: '请对「库存账实」表生成盘点差异表：新建「盘点差异」，A列=SKU、B列=差异量（实盘-账面，公式）、C列=差异率、D列=差异金额（差异量×单价），差异不为0的行标色，按差异金额绝对值降序，A2 应为 S1。最后在「库存账实」表 Z1 写「NE27完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const a2 = await cell(tool, '盘点差异', 'A2')
      const b2 = await cell(tool, '盘点差异', 'B2')
      const ok = String(a2 ?? '').includes('S1') && (Math.abs(Number(b2) + 5) < 0.01 || (/\d/.test(String(b2 ?? '')) && /[*+\/-]|SUM|IF/.test(String(b2 ?? ''))))
      return [ok, `A2=${a2} B2=${b2}（S1 期望 -5）`]
    } },
  // ── NE28 统计填报校验（et-gov-statcheck）──
  { id: 'NE28', desc: '配方 et-gov-statcheck 统计填报校验',
    prompt: '请对「统计报表」做逻辑校验（只读不改原表）：① 合计=分项之和 ② 本期=上期+增减 ③ 必填非空，把问题清单（单元格+违反规则+实际值）写入新表「校验报告」。最后在「统计报表」表 Z1 写「NE28完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '校验报告')
      const hit = ok1 && await scan(tool, '校验报告', { text: ['合计', '增减'] })
      return [ok1 && hit, `校验报告=${ok1} 规则命中=${hit}`]
    } },
  // ── NE29 名册核对（et-gov-rostercheck）──
  { id: 'NE29', desc: '配方 et-gov-rostercheck 名册核对',
    prompt: '请核对「名册A」「名册B」两份名册：按「编号」匹配，新建「核对报告」：A列写核对项，B列计数——B2=仅在A表的行数、B3=仅在B表的行数、B4=信息不一致的行数（手机号不同算不一致），并列出各行的明细。最后在「名册A」表 Z1 写「NE29完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const b2 = Number(await cell(tool, '核对报告', 'B2'))
      const b3 = Number(await cell(tool, '核对报告', 'B3'))
      const b4 = Number(await cell(tool, '核对报告', 'B4'))
      const ok = b2 === 1 && b3 === 1 && b4 === 1
      return [ok, `B2=${b2} B3=${b3} B4=${b4}（期望 1/1/1）`]
    } },
  // ── NE30 日销盘点差异（et-shop-diff）──
  { id: 'NE30', desc: '配方 et-shop-diff 日销盘点差异',
    prompt: '请对「库存账实」表生成门店日盘差异表：新建「日盘差异」，A列=SKU、B列=损耗量（账面数量-实盘数量，公式）、C列=损耗率（损耗量/账面数量，百分比），损耗率大于 5% 的行标色，A2 应为 S1。最后在「库存账实」表 Z1 写「NE30完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const a2 = await cell(tool, '日盘差异', 'A2')
      const b2 = await cell(tool, '日盘差异', 'B2')
      const ok = String(a2 ?? '').includes('S1') && (Math.abs(Number(b2) - 5) < 0.01 || (/\d/.test(String(b2 ?? '')) && /[*+\/-]|SUM|IF/.test(String(b2 ?? ''))))
      return [ok, `A2=${a2} B2=${b2}（S1 损耗期望 5）`]
    } },
  // ── NE31 供应商对价（et-shop-supply）──
  { id: 'NE31', desc: '配方 et-shop-supply 供应商对价',
    prompt: '请对「比价表」做供应商对价分析：按商品汇总各供应商报价，新建「对价结果」表输出 商品/最低价供应商/最低价/价差率（（最高-最低）/最低 公式），P1打印纸 的最低价供应商应为乙供应商，并给推荐供货组合。最后在「比价表」表 Z1 写「NE31完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '对价结果')
      const hit1 = ok1 && await scan(tool, '对价结果', { text: ['P1'] })
      const hit2 = ok1 && await scan(tool, '对价结果', { text: ['乙'] })
      return [ok1 && hit1 && hit2, `对价结果=${ok1} P1=${hit1} 乙=${hit2}`]
    } },
  // ── NE32 旅行预算表（et-life-travel）──
  { id: 'NE32', desc: '配方 et-life-travel 旅行预算表',
    prompt: '请创建成都 5 日旅行预算表：新建「旅行预算」表，表头 日期/城市/项目/类别/预算/实际/差额（差额=预算-实际 公式），按 5 天预填框架行（每天 3 行，类别在 交通/住宿/餐饮/门票/其他 中），末尾附分类汇总块（SUMIF）。最后在「旅行预算」表 Z1 写「NE32完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '旅行预算')
      const hit = ok1 && await scan(tool, '旅行预算', { text: ['预算'] }) && await scan(tool, '旅行预算', { text: ['差额'] })
      return [ok1 && hit, `旅行预算=${ok1} 表头命中=${hit}`]
    } },
  // ── NE33 还贷计划表（et-life-loan）──
  { id: 'NE33', desc: '配方 et-life-loan 还贷计划表',
    prompt: '请创建等额本息还贷计划表：新建「还贷计划」，参数区 A1=贷款额1000000、A2=年利率3.6%、A3=期数240，用 PMT/IPMT/PPMT 公式生成 240 期逐期计划（期次/月供/利息/本金/剩余本金），末尾汇总利息总额。最后在「还贷计划」表 Z1 写「NE33完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '还贷计划')
      const hit = ok1 && (await scan(tool, '还贷计划', { numMin: 5830, numMax: 5875, range: 'A1:H30' })
        || await scan(tool, '还贷计划', { text: ['PMT'], range: 'A1:H40' }))
      return [ok1 && hit, `还贷计划=${ok1} 月供5851/PMT命中=${hit}`]
    } },
  // ── NE34 体重健身追踪（et-life-fitness）──
  { id: 'NE34', desc: '配方 et-life-fitness 体重健身追踪',
    prompt: '请创建体重健身追踪表：新建「健身追踪」，参数区放 身高1.75米，表头 日期/体重kg/运动类型/时长min/摄入kcal/BMI（BMI=体重/身高² 公式），预填 7 天示例数据（体重 72-75 波动），并用 chart_add 基于体重列生成折线图。最后在「健身追踪」表 Z1 写「NE34完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '健身追踪')
      const hit = ok1 && await scan(tool, '健身追踪', { text: ['BMI'] })
      return [ok1 && hit, `健身追踪=${ok1} BMI=${hit}`]
    } },
  // ── NE37 表格翻译（et-translate）──
  { id: 'NE37', desc: '配方 et-translate 表格翻译',
    prompt: '请把「华东明细」表翻译成英文：读取已用区域，仅翻译文本单元格（订单号、数字保持原样），新建工作表「翻译版」按相同行列结构写入英文译文。完成后在「华东明细」表 Z1 写「NE37完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '翻译版')
      const b2 = ok1 ? String((await rng(tool, '翻译版', 'B2:B2'))?.[0]?.[0] ?? '') : ''
      const ok = /[A-Za-z]{3,}/.test(b2) && !b2.includes('台灯') && !b2.includes('文档')
      return [ok1 && ok, `翻译版=${ok1} B2=${b2.slice(0, 40)}`]
    } },
  // ── 跨宿主场景（需 wps/wpp 宿主在线）──
  // ── NE03 数据日报生成（et-x-report，读 et 写 wps）──
  { id: 'NE03', desc: '配方 et-x-report 数据日报生成（跨宿主写 Word）',
    pre: async () => {
      const r = await osOpenDoc('e2e-讲义2', path.join(FILES_DIR, 'e2e-讲义2.docx'))
      if (!r) throw new Error('无法把 e2e-讲义2 置为活动文档（跨宿主写目标）')
      return { ok: true }
    },
    prompt: '请把「销售明细」表（et 宿主当前工作簿）生成一份数据日报，写入打开的 Word 文档「e2e-讲义2」（它是 wps 宿主当前活动文档）：先 range_read 读取数据提炼 8-9 月销售核心数字，然后组织日报全文（标题+日期+总体情况/主要变化/风险提示，带数字依据），用 document_insert 一次性 append 写入（position 用 append）。注意：日报文本的最后必须以「NE03完成」结尾。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const r = await tool('document_get_text', {})
      const text = typeof r === 'string' ? r : JSON.stringify(r)
      return [text.includes('NE03完成'), `doc 含标记=${text.includes('NE03完成')} len=${text.length}`]
    } },
  // ── NE35 文档抽取成表（et-x-extract，读 wps 写 et）──
  { id: 'NE35', desc: '配方 et-x-extract 文档抽取成表（跨宿主读 Word）',
    pre: async () => {
      const r = await osOpenDoc('e2e-contract2', path.join(FILES_DIR, 'e2e-contract2.docx'))
      if (!r) throw new Error('无法把 e2e-contract2 置为活动文档（跨宿主读目标）')
      return { ok: true }
    },
    prompt: '请从当前打开的 Word 文档「e2e-contract2」抽取信息生成台账：先 document_get_text 读取全文，抽取 甲方/乙方/合同金额/合同期限/签署日期 五个字段，在当前工作簿新建「台账」表写入一行（表头=字段名，缺失标「未提及」）。最后在「台账」表 Z1 写「NE35完成」。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '台账')
      const hit = ok1 && (await scan(tool, '台账', { text: ['128000', '128,000', '￥128'] }) || await scan(tool, '台账', { numMin: 127999, numMax: 128001 }))
      return [ok1 && hit, `台账=${ok1} 金额命中=${hit}`]
    } },
  // ── NE36 数据战报页（et-x-ppt，读 et 写 wpp）──
  { id: 'NE36', desc: '配方 et-x-ppt 数据战报页（跨宿主写 PPT）',
    prompt: '请把「销售区域」表关键数据做成演示稿战报页：读取数据提炼 3-5 个核心数字（各区域销售额合计、TOP 区域），在打开的演示稿末尾新增一页（presentation slide_add，text 版式，标题含「战报」二字，每条要点一行带数字），完成后报告新增页码。',
    timeout: 360,
    attempts: 3,
    verify: async ({ tool }) => {
      const r = await tool('presentation', { action: 'slide_list' })
      const titles = (r?.slides || []).map(s => String(s?.title || ''))
      return [titles.some(t => t.includes('战报')), `战报页命中=${titles.filter(t => t.includes('战报')).length}/${titles.length}`]
    } },
]

export const ET2_FILE = XLSX
