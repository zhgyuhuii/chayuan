/**
 * VM 全宿主×全场景最终测试：高频率助手 + 生图 + 搜图 + 跨宿主。
 * 三宿主（et/wpp/wps）× 内容生成/生图/搜图全覆盖。
 */
import { runLane, openDocument, tool, sleep, FILES_DIR } from './harness.mjs'
import path from 'node:path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

const OUT = '/Users/zyh/work/chayuan-wps/artifacts/e2e-v2'
const SHOTS = path.join(OUT, 'shots-vm-final')
fs.mkdirSync(SHOTS, { recursive: true })

function shot(name) {
  try {
    const cmd = process.env.CHAYUAN_SHOT_CMD || `screencapture -x "${path.join(SHOTS, name)}"`
    execSync(cmd.replace('{file}', JSON.stringify(path.join(SHOTS, name))), { timeout: 30000, stdio: 'ignore' })
    console.log(`    📸 ${name}`)
  } catch (e) { console.log(`    ⚠ 截图失败 ${name}`) }
}

// ── et 车道：高频助手 5 项 ──
const etTests = [
  { id: 'FIN-01', desc: '表格·数据洞察（autoSend 高频）',
    prompt: '请分析「销售明细」表的已用数据区域（不要修改表格），输出：1) 数据概况（行列数与字段含义）；2) 关键趋势与结构占比；3) 异常值或缺失提醒；4) 最值得注意的 5 个要点。结论要带具体数字依据。完成后在「销售明细」表 Z6 写「FIN-01OK」。',
    timeout: 360, attempts: 3,
    verify: async ({ tool }) => {
      const r = await tool('spreadsheet', { action: 'range_read', sheet: '销售明细', range: 'Z6:Z6' })
      const v = String(r?.values?.[0]?.[0] ?? '')
      return [v.includes('FIN-01OK'), `Z6=${v.slice(0, 40)}`]
    } },
  { id: 'FIN-02', desc: '表格·一键图表',
    prompt: '请根据「销售区域」表数据生成图表：先读取数据判断字段类型，推荐最合适的图型并说明理由，再用工具创建图表。在「销售区域」表末尾新建一个「图表数据」区域（H1:I5，列名 区域/销售额，按区域聚合 SUMIF），然后 chart_add 基于该区域生成柱状图。完成后在「销售区域」表 Z5 写「FIN-02OK」。',
    timeout: 480, attempts: 3,
    verify: async ({ tool }) => {
      const marker = String((await tool('spreadsheet', { action: 'range_read', sheet: '销售区域', range: 'Z5:Z5' }))?.values?.[0]?.[0] ?? '')
      let charts = 0
      for (const s of await (async () => { const r = await tool('spreadsheet', { action: 'sheet_list' }); return (r?.sheets || []).map(s => s?.name || s) })()) {
        const r = await tool('spreadsheet', { action: 'chart_list', sheet: s })
        charts += Number(r?.total ?? (r?.charts || []).length ?? 0)
      }
      return [marker.includes('FIN-02OK') && charts >= 1, `标记=${marker.includes('FIN-02OK')} 图表=${charts}`]
    } },
  { id: 'FIN-03', desc: '表格·报表结论（autoSend 高频）',
    prompt: '请读取「大促费用」表全部数据，输出一份简明结论报告：核心数字、结构/环比变化、值得注意的风险点。不超过 300 字，不要修改表格。完成后在「大促费用」表 Z5 写「FIN-03OK」。',
    timeout: 360, attempts: 3,
    verify: async ({ tool }) => {
      const r = await tool('spreadsheet', { action: 'range_read', sheet: '大促费用', range: 'Z5:Z5' })
      const v = String(r?.values?.[0]?.[0] ?? '')
      return [v.includes('FIN-03OK'), `Z5=${v.slice(0, 40)}`]
    } },
  { id: 'FIN-04', desc: '表格·数据清洗（autoSend 高频）',
    prompt: '请检查「应收账款」表已用区域的数据质量：重复行、空值单元格、日期/数字/文本格式混写、首尾多余空格。先输出问题清单（位置+类型+建议处理方式），不要直接修改，等我回复"确认清理"后再执行。完成后在「应收账款」表 Z5 写「FIN-04OK」。',
    timeout: 420, attempts: 3,
    verify: async ({ tool }) => {
      const r = await tool('spreadsheet', { action: 'range_read', sheet: '应收账款', range: 'Z5:Z5' })
      const v = String(r?.values?.[0]?.[0] ?? '')
      return [v.includes('FIN-04OK'), `Z5=${v.slice(0, 40)}`]
    } },
  { id: 'FIN-05', desc: '表格·跨宿主数据战报页（读 et 写 wpp）',
    prompt: '请把「销售区域」表关键数据做成演示稿战报页：读取数据提炼 3 个核心数字（总销售额、最大区域、区域数），在打开的演示稿末尾新增一页（presentation slide_add，text 版式，标题含「战报」二字，每条要点一行带数字），完成后报告新增页码。',
    timeout: 600, attempts: 2,
    verify: async ({ tool }) => {
      const r = await tool('presentation', { action: 'slide_list' })
      const titles = (r?.slides || []).map(s => String(s?.title || ''))
      return [titles.some(t => t.includes('战报')), `战报页=${titles.filter(t => t.includes('战报')).length}/${titles.length}`]
    } },
]

// ── wpp 车道：高频助手 + 生图 + 搜图 5 项 ──
async function slideList(tool) {
  const r = await tool('presentation', { action: 'slide_list' })
  return (r?.slides || []).map(s => ({ index: Number(s?.index) || 0, title: String(s?.title || '') }))
}
async function lastShapes(tool) {
  const list = await slideList(tool)
  if (!list.length) return []
  const r = await tool('presentation', { action: 'shape_list', index: list.length })
  return (r?.shapes || []).map(s => String(s?.text || ''))
}

const wppTests = [
  { id: 'FIN-06', desc: '演示·整套校对（autoSend 高频）',
    prompt: '请通读当前演示稿全部页面（slide_list + slide_read）做只读校对：错别字、重复词、占位符文本、明显标点问题。输出问题清单（页码+原文+修改建议），不要修改任何文字。完成后在最后一页右下角 textbox_add 写「FIN-06OK」。',
    timeout: 480, attempts: 3,
    pre: async ({ tool }) => { await tool('presentation', { action: 'status' }) },
    verify: async ({ tool }) => {
      const texts = await lastShapes(tool)
      return [hasMarker(texts, 'FIN-06OK'), `末页 marker=${hasMarker(texts, 'FIN-06OK')}`]
    } },
  { id: 'FIN-07', desc: '演示·口播稿（autoSend 高频）',
    prompt: '请为当前演示稿的前 3 页生成演讲者备注（口播稿）：先逐页读取内容，每页写口语化演讲词（3-5 句），第 1 页注明开场白。用 notes_set 写入。完成后在第 1 页右下角 textbox_add 写「FIN-07OK」。',
    timeout: 600, attempts: 3,
    pre: async ({ tool }) => { await tool('presentation', { action: 'status' }) },
    verify: async ({ tool }) => {
      const r = await tool('presentation', { action: 'shape_list', index: 1 })
      const texts = (r?.shapes || []).map(s => String(s?.text || ''))
      return [texts.some(t => t.includes('FIN-07OK')), `第1页 marker=${texts.some(t => t.includes('FIN-07OK'))}`]
    } },
  { id: 'FIN-08', desc: '演示·生图配图（qwen-image-3.0）',
    prompt: '请先生成一张图：主题「云端智能大脑与数据流」，蓝色科技扁平风。用 generate_image 工具（size 1024x1024），拿到返回的本地 path 后，新增一页 text 版式页（标题「AI 生图示例」），用 presentation picture_add 把图片插入该页居中。完成后在最后一页右下角 textbox_add 写「FIN-08OK」。',
    timeout: 600, attempts: 2,
    pre: async ({ tool }) => { await tool('presentation', { action: 'status' }) },
    verify: async ({ tool }) => {
      const list = await slideList(tool)
      const texts = await lastShapes(tool)
      const added = list.length
      return [added >= 1 && texts.some(t => t.includes('FIN-08OK')), `页数=${list.length} 末页标记=${texts.some(t => t.includes('FIN-08OK'))}`]
    } },
  { id: 'FIN-09', desc: '演示·搜图配图（必应源）',
    prompt: '请为当前演示稿配图：用 image_search 搜索 1 张与「智慧城市」相关的真实图片（关键词：smart city 蓝色），用 presentation picture_add 插入到最后一页。若搜图失败，改用 svg_add 矢量兜底。完成后在最后一页右下角 textbox_add 写「FIN-09OK」并注明来源。',
    timeout: 600, attempts: 2,
    pre: async ({ tool }) => { await tool('presentation', { action: 'status' }) },
    verify: async ({ tool }) => {
      const texts = await lastShapes(tool)
      const hasOk = texts.some(t => t.includes('FIN-09OK'))
      return [hasOk, `末页标记=${hasOk}`]
    } },
  { id: 'FIN-10', desc: '演示·AI生成PPT（3页 qwen3-max）',
    prompt: '请生成一套 3 页演示稿追加到末尾：① 察元AI 产品定位 ② 核心功能（离线优先/内网可用/多宿主协同）③ 客户案例摘要。每页 text 版式。完成后在最后一页右下角 textbox_add 写「FIN-10OK」。',
    timeout: 600, attempts: 2,
    pre: async ({ tool }) => { await tool('presentation', { action: 'status' }) },
    verify: async ({ tool }) => {
      const list = await slideList(tool)
      const texts = await lastShapes(tool)
      return [texts.some(t => t.includes('FIN-10OK')), `页数=${list.length} 标记=${texts.some(t => t.includes('FIN-10OK'))}`]
    } },
]

function hasMarker(texts, id) { return texts.some(t => t.includes(id)) }

// ── 执行 ──
async function main() {
  const all = []
  console.log('\n===== et 表格车道（5 项高频助手）=====')
  all.push(...await runLane('et', etTests, {
    jsonlName: '../e2e-v2/results-et-final.jsonl',
    onDone: (rec) => shot(`et-${rec.id}.png`)
  }))
  console.log('\n===== wpp 演示车道（5 项高频 + 生图 + 搜图）=====')
  all.push(...await runLane('wpp', wppTests, {
    jsonlName: '../e2e-v2/results-wpp-final.jsonl',
    onDone: (rec) => shot(`wpp-${rec.id}.png`)
  }))
  const passed = all.filter(r => r.pass).length
  console.log(`\n========== 最终汇总: ${passed}/${all.length} PASS ==========`)
  for (const f of all.filter(r => !r.pass)) console.log(`  FAIL ${f.id}: ${String(f.evidence).slice(0, 140)}`)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
