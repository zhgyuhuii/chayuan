/**
 * Mac 重装守望 v2：解锁判据 = WPS 容器 FS 可写（touch 12s 内成功），
 * 不依赖 LLM（agnes 限速会误判）。解锁后自动：清理 → 重装 → 校验 →
 * 拉起三宿主 → 安全冒烟 → 菜单截图 → 按钮抽测。
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
const log = (r) => { fs.appendFileSync(RESULTS, JSON.stringify(r) + '\n'); console.log(JSON.stringify(r).slice(0, 170)) }
const shT = (cmd, timeout = 30000) => execSync(cmd, { timeout, stdio: 'ignore' })

/** 容器 FS 可写性探测（12s 超时） */
function containerWritable() {
  try {
    execSync(`touch "${path.join(J, '.wtest')}" && rm -f "${path.join(J, '.wtest')}"`, { timeout: 12000, stdio: 'ignore' })
    return true
  } catch { return false }
}

console.log('等待解锁（判据=容器 FS 可写，每 30s 探测）…')
let unlocked = false
for (let i = 0; i < 480 && !unlocked; i++) {
  if (containerWritable()) { console.log(`[${new Date().toISOString()}] ✓ 容器 FS 可写 = 已解锁，开始重装`); unlocked = true; break }
  if (i % 4 === 0) console.log(`[${new Date().toISOString()}] 仍锁定 ${i}/480`)
  await sleep(30_000)
}
if (!unlocked) { console.error('4 小时未解锁，退出'); process.exit(1) }

// 1) 停 WPS + 清理
try { shT('pkill -9 -x wpsoffice', 15000) } catch { /* ignore */ }
await sleep(5000)
for (const d of ['chayuan_5.1.7', 'chayuan-et_5.1.7', 'chayuan-wpp_5.1.7']) {
  try { shT(`rm -rf "${path.join(J, d)}"`, 60000); log({ step: 'clean', dir: d, ok: true }) }
  catch (e) { log({ step: 'clean', dir: d, ok: false, err: String(e.message).slice(0, 90) }) }
}
// 2) 全新部署
for (const h of [{ dir: 'chayuan_5.1.7', ribbon: 'ribbon.xml' }, { dir: 'chayuan-et_5.1.7', ribbon: 'ribbon-et.xml' }, { dir: 'chayuan-wpp_5.1.7', ribbon: 'ribbon-wpp.xml' }]) {
  try {
    shT(`rsync -a --delete --exclude='ribbon*.xml' "${DIST}/" "${path.join(J, h.dir)}/"`, 180000)
    shT(`cp "${path.join(DIST, h.ribbon)}" "${path.join(J, h.dir, 'ribbon.xml')}"`, 30000)
    log({ step: 'deploy', dir: h.dir, ok: true })
  } catch (e) { log({ step: 'deploy', dir: h.dir, ok: false, err: String(e.message).slice(0, 90) }) }
}
// 3) 校验
for (const [dir, expect, absent] of [
  ['chayuan-et_5.1.7', 'btnEtMoreMerge', 'btnSpellGrammar'],
  ['chayuan-wpp_5.1.7', 'btnWppSecEncrypt', 'btnRewrite'],
  ['chayuan_5.1.7', 'btnDocumentDeclassify', 'btnEtFormula']
]) {
  let has = false, leak = true
  try {
    const t = fs.readFileSync(path.join(J, dir, 'ribbon.xml'), 'utf8')
    has = t.includes(expect); leak = t.includes(absent)
  } catch { /* ignore */ }
  log({ step: 'verify', dir, expect: has, leak, ok: has && !leak })
}
// 4) 拉起 WPS
for (const f of ['e2e-et2.xlsx', 'e2e-wpp2.pptx', 'e2e-contract2.docx']) {
  try { shT(`open -a wpsoffice "${path.join(F, f)}"`, 20000) } catch { /* ignore */ }
  await sleep(14000)
}
await sleep(15000)
try { shT(`osascript -e 'tell application "System Events" to tell process "wpsoffice" to click button 1 of window 1'`, 15000) } catch { /* ignore */ }
await sleep(8000)
let hosts = []
try {
  const st = await tool('wps_status', {}, 20000)
  hosts = (st?.agent?.agents || []).filter(a => a.online).map(a => a.addonType)
} catch { /* ignore */ }
log({ step: 'hosts', online: hosts })

// 5) 安全冒烟
try {
  const r = await tool('spreadsheet', { action: 'security_encrypt_save',
    password: 'Cy@Reinstall1', savePath: '/tmp/mac-reinstall-enc.xlsx', confirmed: true }, 60000)
  let fileEncrypted = false
  try {
    execSync(`python3 -c "from openpyxl import load_workbook; load_workbook('/tmp/mac-reinstall-enc.xlsx')"`, { timeout: 30000, stdio: 'ignore' })
  } catch { fileEncrypted = true }
  log({ step: 'encrypt-smoke', apiOk: r?.ok === true, fileEncrypted, ok: r?.ok === true && fileEncrypted })
} catch (e) { log({ step: 'encrypt-smoke', ok: false, err: String(e.message).slice(0, 110) }) }

// 6) 菜单截图
const shot = async (name, file) => {
  try { shT(`open -a wpsoffice "${file}"`, 20000) } catch { /* ignore */ }
  await sleep(9000)
  try {
    shT('open -a wpsoffice', 10000); await sleep(2500)
    shT(`screencapture -x "${path.join(SHOTS, name)}"`, 20000)
    console.log(`📸 ${name}`)
  } catch { console.log(`⚠ 截图失败 ${name}`) }
}
await shot('reinstall-et-menu.png', path.join(F, 'e2e-et2.xlsx'))
await shot('reinstall-wpp-menu.png', path.join(F, 'e2e-wpp2.pptx'))
await shot('reinstall-writer-menu.png', path.join(F, 'e2e-contract2.docx'))

// 7) 按钮抽测
const cases = [
  { id: 'RI-E-INSIGHT', host: 'et', sheet: '销售明细', marker: 'RI-E-INSIGHTOK', activate: 'e2e-et2.xlsx',
    prompt: '请分析当前工作表的已用数据区域（不要修改表格），输出：1) 数据概况；2) 关键趋势与结构占比；3) 异常值或缺失提醒；4) 最值得注意的 5 个要点。结论要带具体数字依据。分析对象用「销售明细」表。完成后在「销售明细」表 Z9 写「RI-E-INSIGHTOK」。' },
  { id: 'RI-P-SUMMARY', host: 'wpp', activate: 'e2e-wpp2.pptx',
    prompt: '请通读当前演示稿全部页面（slide_list + slide_read），在第 1 页之后新增一页摘要页（layout 用 text），标题"核心要点"，列出整套内容的 3-5 条要点。' }
]
for (const c of cases) {
  try { shT(`open -a wpsoffice "${path.join(F, c.activate)}"`, 20000) } catch { /* ignore */ }
  await sleep(8000)
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
          ok = (r?.slides || []).some(s => String(s?.title || '').includes('核心要点'))
          ev = `核心要点页=${ok}`
        }
      } catch { /* ignore */ }
      if (!ok) await sleep(10000)
    }
    log({ id: c.id, pass: ok, evidence: ev, secs: Math.round((Date.now() - t0) / 1000) })
  } catch (e) { log({ id: c.id, pass: false, err: String(e.message).slice(0, 110) }) }
}
try { shT(`open -a wpsoffice "${path.join(F, 'e2e-et2.xlsx')}"`, 20000) } catch { /* ignore */ }
console.log('== 重装自动流程完成 ==')
