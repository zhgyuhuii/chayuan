/**
 * 顶部按钮逐项功能测试（et 宿主）：提示词与 ribbon.js RIBBON_ASSISTANT_PROMPTS 一致
 * （保真），prefill 类在冒号后补参数，autoSend 只读类追加落笔标记以便确定性验证。
 * 加密/解密（对话流）放最后，跑完恢复 e2e-et2 为活动工作簿由外部负责。
 */
import { FILES_DIR } from './harness.mjs'
import path from 'node:path'

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
const vM = (sheet, id) => async ({ tool }) => {
  const v = await cell(tool, sheet, 'Z5')
  return [String(v ?? '').includes(`${id}OK`), `${sheet}!Z5=${String(v).slice(0, 60)}`]
}
const sheetExists = async (tool, name) => (await sheets(tool)).includes(name)

export const SCENARIOS = [
  { id: 'BT-E1', desc: '顶部·公式助手（生成方向）',
    prompt: '请为当前表格生成公式并写入指定单元格（优先用 SUM/SUMIF/VLOOKUP 等标准函数，数字由表格自己计算）。我的需求：在「公式演示」表的 L1 写 A 列最大值（MAX 公式），L2 写 A 列平均值（ROUND 到 1 位小数）。',
    timeout: 360,
    verify: async ({ tool }) => {
      const l1 = Number(await cell(tool, '公式演示', 'L1'))
      const ok = Math.abs(l1 - 91) < 0.01
      return [ok, `公式演示!L1=${l1}（A 列最大值期望 91）`]
    } },
  { id: 'BT-E2', desc: '顶部·数据洞察（autoSend）',
    prompt: '请分析当前工作表的已用数据区域（不要修改表格），输出：1) 数据概况（行列数与字段含义）；2) 关键趋势与结构占比；3) 异常值或缺失提醒；4) 最值得注意的 5 个要点。结论要带具体数字依据。分析对象用「销售明细」表。完成后在「销售明细」表 Z5 写「BT-E2OK」。',
    timeout: 420, verify: vM('销售明细', 'BT-E2') },
  { id: 'BT-E3', desc: '顶部·一键图表',
    prompt: '请根据当前工作表数据生成图表：先读取数据判断字段类型，推荐最合适的图型并说明理由，再用工具创建图表。我的补充要求：用「销售区域」表的区域销售额汇总（若已有汇总表可直接用；没有则先按区域聚合），生成柱状图，放在新位置。',
    timeout: 420,
    verify: async ({ tool }) => {
      let charts = 0
      for (const s of await sheets(tool)) {
        const r = await tool('spreadsheet', { action: 'chart_list', sheet: s })
        charts += Number(r?.total ?? (r?.charts || []).length ?? 0)
      }
      return [charts >= 2, `全簿图表数=${charts}（原 1 + 新增 ≥1）`]
    } },
  { id: 'BT-E4', desc: '顶部·数据清洗（autoSend）',
    prompt: '请检查当前工作表已用区域的数据质量：重复行、空值单元格、日期/数字/文本格式混写、首尾多余空格。先输出问题清单（位置+类型+建议处理方式），不要直接修改，等我回复"确认清理"后再执行。检查对象用「应收账款」表。完成后在「应收账款」表 Z5 写「BT-E4OK」。',
    timeout: 420, verify: vM('应收账款', 'BT-E4') },
  { id: 'BT-E5', desc: '顶部·报表结论（autoSend）',
    prompt: '请读取当前表格全部数据，输出一份简明结论报告：核心数字、结构/环比变化、值得注意的风险点。不超过 300 字，不要修改表格。数据用「退货明细」表（共 20 条退货记录）。完成后在「退货明细」表 Z5 写「BT-E5OK」。',
    timeout: 420, verify: vM('退货明细', 'BT-E5') },
  { id: 'BT-E6', desc: '顶部·一键美化（autoSend）',
    prompt: '请美化当前工作表排版（不要改动任何数值）：表头行加粗+深底白字+居中，数据区加细边框，数字列右对齐、文本列左对齐，列宽适当加宽（全部用 format 完成）。完成后报告触及区域。美化对象用「分组名单」表。完成后在「分组名单」表 Z5 写「BT-E6OK」。',
    timeout: 420, verify: vM('分组名单', 'BT-E6') },
  { id: 'BT-E7', desc: '顶部·保密检查（autoSend）',
    prompt: '请对当前工作表做保密检查（只读不改）：扫描已用区域，识别 手机号/身份证号/银行卡号/邮箱/工资薪酬列 等敏感数据，输出问题清单（位置+类型+样例脱敏展示，如 138****1234），不要修改任何单元格。检查对象用「客户资料」表（含手机号/身份证/银行卡列）。把问题清单写入新表「保密检查」，并在「客户资料」表 Z5 写「BT-E7OK」。',
    timeout: 480,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '保密检查')
      const hit = ok1 && (await (async () => {
        const vals = await rng(tool, '保密检查', 'A1:T30')
        return vals.flat().some(v => String(v ?? '').includes('身份') || String(v ?? '').includes('手机') || String(v ?? '').includes('银行'))
      })())
      return [ok1 && hit, `保密检查=${ok1} 敏感项命中=${hit}`]
    } },
  { id: 'BT-E8', desc: '顶部·排序汇总（下拉）',
    prompt: '请对当前数据表排序/汇总。我的要求：把「商机表」按金额降序排序（保留表头整行联动），并在 J1:K2 写统计——J1=商机总数 K1==COUNTA(A2:A11)，J2=金额合计 K2==SUM(C2:C11)。完成后在「商机表」Z5 写「BT-E8OK」。',
    timeout: 420,
    verify: async ({ tool }) => {
      const k1 = Number(await cell(tool, '商机表', 'K1'))
      const k2 = Number(await cell(tool, '商机表', 'K2'))
      return [k1 === 10 && Math.abs(k2 - 460000) < 1, `K1=${k1}（期望 10） K2=${k2}（期望 460000）`]
    } },
  { id: 'BT-E9', desc: '顶部·文档抽取成表（下拉·跨宿主）',
    pre: async () => {
      const { osOpenDoc } = await import('./harness.mjs')
      const r = await osOpenDoc('e2e-contract2', path.join(FILES_DIR, 'e2e-contract2.docx'))
      if (!r) throw new Error('无法置活动文档 e2e-contract2（跨宿主读目标）')
      return { ok: true }
    },
    prompt: '请从 Word 文档抽取信息生成台账表：先 document_get_text 读取文档内容（当前活动文档「e2e-contract2」为软件开发合同），按字段清单抽取——甲方/乙方/合同金额/合同期限/签署日期，在当前工作簿新建工作表「合同台账」写入一行（表头=字段名，缺失标「未提及」）。完成后在「合同台账」表 Z5 写「BT-E9OK」。',
    timeout: 480,
    verify: async ({ tool }) => {
      const ok1 = await sheetExists(tool, '合同台账')
      const hit = ok1 && (await (async () => {
        const vals = await rng(tool, '合同台账', 'A1:T10')
        return vals.flat().some(v => String(v ?? '').includes('128000') || String(v ?? '').includes('128,000'))
      })())
      return [ok1 && hit, `合同台账=${ok1} 金额命中=${hit}`]
    } },
  { id: 'BT-E10', desc: '顶部·加密工作簿（对话流·放最后）',
    prompt: '请给当前工作簿设置打开密码。密码直接使用：Cy@Btn2026（不必再向我询问）。拿到密码后用 spreadsheet 工具 security_encrypt_save（password 参数，savePath 用 /home/zyh/e2e-v2-files/btn-enc-test.xlsx）完成加密并报告保存路径。提醒我：密码遗忘无法找回。',
    timeout: 480,
    verify: async ({ tool }) => {
      // 命令行验证由外部 scp + openpyxl 完成；这里先确认回合成功（savePath 文件存在由外部核）
      return [true, '回合完成，外部验证文件加密状态']
    } },
  { id: 'BT-E11', desc: '顶部·解密工作簿（对话流·最后）',
    prompt: '请移除当前工作簿的打开密码（密码为 Cy@Btn2026）。用 spreadsheet 工具 security_decrypt_save（savePath 用 /home/zyh/e2e-v2-files/btn-dec-test.xlsx）完成解密并报告保存路径。',
    timeout: 480,
    verify: async ({ tool }) => [true, '回合完成，外部验证文件解密状态'] },
]
