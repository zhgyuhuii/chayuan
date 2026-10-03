/**
 * Mac 解锁守望 → 自动清理重装察元助手 → 全套验证。
 * 步骤：等解锁（探针恢复）→ 清空三插件目录 → 全新部署（dist + 每宿主 ribbon）
 *   → 校验部署 → 拉起 WPS 三宿主 → 对话框清扫 → 安全动作冒烟（文件级）
 *   → 三宿主菜单截图 → 顶部按钮抽测 2 项 → 结果落盘。
 */
import { tool, sleep, MODEL } from './harness.mjs'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const DIST = '/Users/zyh/work/chayuan-wps/dist'
const J = path.join(os.homedir(), 'Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons')
const F = '/Users/zyh/work/chayuan-wps/artifacts/e2e-180/files'
const OUT = '/Users/zyh/work/chayuan-wps/artifacts/e2e-v2'
const SHOTS = path.join(OUT, 'shots-mac')
fs.mkdirSync(SHOTS, { recursive: true })
const RESULTS = path.join(OUT, 'results-mac-reinstall.jsonl')
const log = (r) => { fs.appendFileSync(RESULTS, JSON.stringify(r) + '\n'); console.log(JSON.stringify(r).slice(0, 160)) }
const sh = (cmd, timeout = 30000) => execSync(cmd, { timeout, stdio: 'ignore' })

// ── 1) 等解锁
let unlocked = false
for (let i = 0; i < 240 && !unlocked; i++) {
  const cell = `P${(i % 30) + 5}`
  try {
    await tool('chat_turn', { turnId: `ri-probe-${Date.now()}`, scopeKey: 'probe', host: 'et',
      userText: `请在「公式演示」表的 ${cell} 单元格写入数字 1。只做这一件事。`, model: MODEL })
  } catch { /* ignore */ }
  await sleep(45_000)
  try {
    const r = await tool('spreadsheet', { action: 'range_read', sheet: '公式演示', range: `${cell}:${cell}` })
    if (r?.values?.[0]?.[0]) { console.log('Mac 已解锁，开始重装'); unlocked = true; break }
  } catch { /* ignore */ }
  console.log(`仍锁定 ${i + 1}/240`)
}
if (!unlocked) { console.error('4 小时未解锁，退出'); process.exit(1) }

// ── 2) 停 WPS + 清空插件目录
try { sh('pkill -9 -x wpsoffice', 15000) } catch { /* ignore */ }
await sleep(5000)
for (const d of ['chayuan_5.1.7', 'chayuan-et_5.1.7', 'chayuan-wpp_5.1.7']) {
  try { sh(`rm -rf "${path.join(J, d)}"`, 30000); log({ step: 'clean', dir: d, ok: true }) }
  catch (e) { log({ step: 'clean', dir: d, ok: false, err: String(e.message).slice(0, 100) }) }
}
// ── 3) 全新部署
const hosts = [
  { dir: 'chayuan_5.1.7', ribbon: 'ribbon.xml' },
  { dir: 'chayuan-et_5.1.7', ribbon: 'ribbon-et.xml' },
  { dir: 'chayuan-wpp_5.1.7', ribbon: 'ribbon-wpp.xml' }
]
for (const h of hosts) {
  try {
    sh(`rsync -a --delete --exclude='ribbon*.xml' "${DIST}/" "${path.join(J, h.dir)}/"`, 120000)
    sh(`cp "${path.join(DIST, h.ribbon)}" "${path.join(J, h.dir, 'ribbon.xml')}"`, 30000)
    log({ step: 'deploy', dir: h.dir, ok: true })
  } catch (e) { log({ step: 'deploy', dir: h.dir, ok: false, err: String(e.message).slice(0, 100) }) }
}
// ── 4) 部署校验
for (const [dir, expect, absent] of [
  ['chayuan-et_5.1.7', 'btnEtMoreMerge', 'btnSpellGrammar'],
  ['chayuan-wpp_5.1.7', 'btnWppSecEncrypt', 'btnRewrite'],
  ['chayuan_5.1.7', 'btnDocumentDeclassify', 'btnEtFormula']
]) {
  let has = false, leak = true
  try {
    has = fs.readFileSync(path.join(J, dir, 'ribbon.xml'), 'utf8').includes(expect)
    leak = fs.readFileSync(path.join(J, dir, 'ribbon.xml'), 'utf8').includes(absent)
  } catch { /* ignore */ }
  log({ step: 'verify', dir, hasExpect: has, hasLeak: leak, ok: has && !leak })
}
// ── 5) 拉起 WPS 三宿主
for (const f of ['e2e-et2.xlsx', 'e2e-wpp2.pptx', 'e2e-contract2.docx']) {
  try { sh(`open -a wpsoffice "${path.join(F, f)}"`, 20000) } catch { /* ignore */ }
  await sleep(14000)
}
await sleep(15000)
// 对话框清扫
try { sh(`osascript -e 'tell application "System Events" to tell process "wpsoffice" to click button 1 of window 1'`, 15000) } catch { /* ignore */ }
await sleep(8000)
let hostsOnline = []
try {
  const st = await tool('wps_status', {}, 20000)
  hostsOnline = (st?.agent?.agents || []).filter(a => a.online).map(a => a.addonType)
} catch { /* ignore */ }
log({ step: 'hosts', online: hostsOnline })

// ── 6) 安全动作冒烟（文件级）
try {
  const r = await tool('spreadsheet', { action: 'security_encrypt_save',
    password: 'Cy@Reinstall1', savePath: '/tmp/mac-reinstall-enc.xlsx', confirmed: true }, 60000)
  const encOk = r?.ok === true
  let fileEncrypted = false
  try {
    execSync(`python3 -c "from openpyxl import load_workbook; load_workbook('/tmp/mac-reinstall-enc.xlsx')"`, { timeout: 30000, stdio: 'ignore' })
  } catch { fileEncrypted = true }
  log({ step: 'encrypt-smoke', apiOk: encOk, fileEncrypted, ok: encOk && fileEncrypted })
} catch (e) { log({ step: 'encrypt-smoke', ok: false, err: String(e.message).slice(0, 120) }) }

// ── 7) 三宿主菜单截图
const shot = async (name, file) => {
  try { sh(`open -a wpsoffice "${file}"`, 20000) } catch { /* ignore */ }
  await sleep(9000)
  try {
    sh('open -a wpsoffice', 10000); await sleep(2500)
    sh(`screencapture -x "${path.join(SHOTS, name)}"`, 20000)
    console.log(`📸 ${name}`)
  } catch (e) { console.log(`⚠ 截图失败 ${name}`) }
}
await shot('reinstall-et-menu.png', path.join(F, 'e2e-et2.xlsx'))
await shot('reinstall-wpp-menu.png', path.join(F, 'e2e-wpp2.pptx'))
await shot('reinstall-writer-menu.png', path.join(F, 'e2e-contract2.docx'))

// ── 8) 顶部按钮抽测
const cases = [
  { id: 'RI-E-INSIGHT', host: 'et', sheet: '销售明细', marker: 'RI-E-INSIGHTOK',
    prompt: '请分析当前工作表的已用数据区域（不要修改表格），输出：1) 数据概况；2) 关键趋势与结构占比；3) 异常值或缺失提醒；4) 最值得注意的 5 个要点。结论要带具体数字依据。分析对象用「销售明细」表。完成后在「销售明细」表 Z9 写「RI-E-INSIGHTOK」。' },
  { id: 'RI-P-SUMMARY', host: 'wpp',
    prompt: '请通读当前演示稿全部页面（slide_list + slide_read），在第 1 页之后新增一页摘要页（layout 用 text），标题"核心要点"，列出整套内容的 3-5 条要点。' }
]
try { sh(`open -a wpsoffice "${path.join(F, 'e2e-et2.xlsx')}"`, 20000) } catch { /* ignore */ }
await sleep(8000)
for (const c of cases) {
  if (c.host === 'wpp') { try { sh(`open -a wpsoffice "${path.join(F, 'e2e-wpp2.pptx')}"`, 20000) } catch { /* ignore */ } ; await sleep(8000) }
  const t0 = Date.now()
  try {
    await tool('chat_turn', { turnId: `ri-${c.id}`, scopeKey: 'reinstall', host: c.host, userText: c.prompt, model: MODEL })
    await sleep(25000)
    let ok = false, ev = ''
    for (let w = 0; w < 24 && !ok; w++) {
      try {
        if (c.host === 'et') {
          const r = await tool('spreadsheet', { action: 'range_read', sheet: c.sheet, range: 'Z9:Z9' })
          ok = String(r?.values?.[0]?.[0] ?? '').includes(c.marker)
          ev = `${c.sheet}!Z9=${String(r?.values?.[0]?.[0] ?? '').slice(0, 40)}`
        } else {
          const r = await tool('presentation', { action: 'slide_list' })
          const titles = (r?.slides || []).map(s => String(s?.title || ''))
          ok = titles.some(t => t.includes('核心要点'))
          ev = `核心要点页=${ok}`
        }
      } catch { /* ignore */ }
      if (!ok) await sleep(10000)
    }
    log({ id: c.id, pass: ok, evidence: ev, secs: Math.round((Date.now() - t0) / 1000) })
  } catch (e) { log({ id: c.id, pass: false, err: String(e.message).slice(0, 120) }) }
}
try { sh(`open -a wpsoffice "${path.join(F, 'e2e-et2.xlsx')}"`, 20000) } catch { /* ignore */ }
console.log('== 重装自动流程完成 ==')
