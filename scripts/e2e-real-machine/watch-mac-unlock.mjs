/**
 * Mac 解锁守望：探针回合恢复落笔 = 解锁 → 自动完成本机收尾：
 *  1) 激活 WPS 截三宿主菜单图
 *  2) Mac chat_turn 抽测（ET 数据洞察 + WPP 整套摘要）
 *  3) 结果写 artifacts/e2e-v2/results-mac-unlock.jsonl
 */
import { tool, sleep, MODEL } from './harness.mjs'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const OUT = '/Users/zyh/work/chayuan-wps/artifacts/e2e-v2'
const SHOTS = path.join(OUT, 'shots-mac')
fs.mkdirSync(SHOTS, { recursive: true })
const RESULTS = path.join(OUT, 'results-mac-unlock.jsonl')
const log = (r) => fs.appendFileSync(RESULTS, JSON.stringify(r) + '\n')

// ── 1) 等解锁（探针 60s×240 ≈ 4h 上限）
let unlocked = false
for (let i = 0; i < 240 && !unlocked; i++) {
  const cell = `P${(i % 30) + 5}`
  try {
    await tool('chat_turn', { turnId: `mac-probe-${Date.now()}`, scopeKey: 'probe', host: 'et',
      userText: `请在「公式演示」表的 ${cell} 单元格写入数字 1。只做这一件事。`, model: MODEL })
  } catch { /* ignore */ }
  await sleep(45_000)
  try {
    const r = await tool('spreadsheet', { action: 'range_read', sheet: '公式演示', range: `${cell}:${cell}` })
    if (r?.values?.[0]?.[0]) { console.log(`[${new Date().toISOString()}] Mac 已解锁，开始收尾`); unlocked = true; break }
  } catch { /* ignore */ }
  console.log(`[${new Date().toISOString()}] 仍锁定 ${i + 1}/240`)
}
if (!unlocked) { console.error('4 小时未解锁'); process.exit(1) }

const shot = (name) => {
  try {
    execSync('open -a wpsoffice', { timeout: 10000, stdio: 'ignore' })
    execSync('sleep 3')
    execSync(`screencapture -x "${path.join(SHOTS, name)}"`, { timeout: 20000, stdio: 'ignore' })
    console.log(`📸 ${name}`)
  } catch (e) { console.log(`⚠ 截图失败 ${name}: ${e.message}`) }
}

// ── 2) 三宿主菜单截图
execSync('open -a wpsoffice "/Users/zyh/work/chayuan-wps/artifacts/e2e-180/files/e2e-et2.xlsx"', { timeout: 20000, stdio: 'ignore' })
await sleep(12000); shot('mac-et-menu.png')
execSync('open -a wpsoffice "/Users/zyh/work/chayuan-wps/artifacts/e2e-180/files/e2e-wpp2.pptx"', { timeout: 20000, stdio: 'ignore' })
await sleep(10000); shot('mac-wpp-menu.png')
execSync('open -a wpsoffice "/Users/zyh/work/chayuan-wps/artifacts/e2e-180/files/e2e-contract2.docx"', { timeout: 20000, stdio: 'ignore' })
await sleep(10000); shot('mac-writer-menu.png')

// ── 3) chat_turn 抽测（顶部按钮提示词原文）
const cases = [
  { id: 'MAC-E-INSIGHT', host: 'et', prompt: '请分析当前工作表的已用数据区域（不要修改表格），输出：1) 数据概况（行列数与字段含义）；2) 关键趋势与结构占比；3) 异常值或缺失提醒；4) 最值得注意的 5 个要点。结论要带具体数字依据。分析对象用「销售明细」表。完成后在「销售明细」表 Z8 写「MAC-E-INSIGHTOK」。' },
  { id: 'MAC-P-SUMMARY', host: 'wpp', prompt: '请通读当前演示稿全部页面（slide_list + slide_read），在第 1 页之后新增一页摘要页（layout 用 text），标题"核心要点"，列出整套内容的 3-5 条要点。' }
]
for (const c of cases) {
  const t0 = Date.now()
  try {
    await tool('chat_turn', { turnId: `mac-${c.id}`, scopeKey: 'mac-unlock', host: c.host, userText: c.prompt, model: MODEL })
    await sleep(30000)
    let ok = false, ev = ''
    for (let w = 0; w < 20 && !ok; w++) {
      if (c.host === 'et') {
        const r = await tool('spreadsheet', { action: 'range_read', sheet: '销售明细', range: 'Z8:Z8' })
        ok = String(r?.values?.[0]?.[0] ?? '').includes('MAC-E-INSIGHTOK')
        ev = `销售明细!Z8=${String(r?.values?.[0]?.[0] ?? '').slice(0, 40)}`
      } else {
        const r = await tool('presentation', { action: 'slide_list' })
        const titles = (r?.slides || []).map(s => String(s?.title || ''))
        ok = titles.some(t => t.includes('核心要点'))
        ev = `核心要点页=${ok}`
      }
      if (!ok) await sleep(10000)
    }
    log({ id: c.id, pass: ok, evidence: ev, secs: Math.round((Date.now() - t0) / 1000) })
    console.log(`${ok ? 'PASS' : 'FAIL'} ${c.id} ${ev}`)
  } catch (e) {
    log({ id: c.id, pass: false, evidence: String(e.message).slice(0, 120) })
  }
}
// 恢复活动工作簿
execSync('open -a wpsoffice "/Users/zyh/work/chayuan-wps/artifacts/e2e-180/files/e2e-et2.xlsx"', { timeout: 20000, stdio: 'ignore' })
console.log('== Mac 收尾自动流程完成 ==')
