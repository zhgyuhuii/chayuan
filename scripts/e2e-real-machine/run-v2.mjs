/**
 * 真机 64 场景（2026-10 助手增量批次）运行器 + 截图。
 *
 * 用法：
 *   node run-v2.mjs --setup                 # 重启 WPS 并打开全部种子文件（先跑一次）
 *   node run-v2.mjs --lane et|wpp [--only ID,...] [--no-restart] [--fresh]
 *   node run-v2.mjs --summary               # 汇总结果与截图清单
 *
 * 结果 → artifacts/e2e-v2/results-<lane>.jsonl；截图 → artifacts/e2e-v2/shots/<lane>-<ID>.png
 * 每个场景结束（PASS/FAIL）后全屏截图一张（screencapture -x，WPS 应在前台）。
 */
import { runLane, openDocument, wpsStatus, tool, sleep, FILES_DIR, activateDoc, osOpenDoc, waitHost } from './harness.mjs'
import path from 'node:path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const has = (k) => args.includes(k)
const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null }
const LANE = argOf('--lane')
const ONLY = (argOf('--only') || '').split(',').filter(Boolean)

const OUT_DIR = path.resolve(FILES_DIR, '..', '..', 'e2e-v2')
const SHOTS_DIR = process.env.CHAYUAN_SHOTS_DIR || path.join(OUT_DIR, 'shots')
fs.mkdirSync(SHOTS_DIR, { recursive: true })

const pick = (list) => (ONLY.length ? list.filter(s => ONLY.includes(s.id)) : list)

function shot(name) {
  try {
    const file = path.join(SHOTS_DIR, name)
    const cmdTpl = process.env.CHAYUAN_SHOT_CMD
    if (cmdTpl) {
      // 远程模式：由外部命令截屏（如 VMware：vmrun captureScreen <vmx> {file}）
      try { execSync(cmdTpl.replace('{file}', JSON.stringify(file)), { timeout: 30000, stdio: 'ignore' }); console.log(`    📸 ${name}`) } catch (e) {
        console.log(`    ⚠ 截图失败 ${name}: ${String(e.message).slice(0, 80)}`)
      }
      return
    }
    // Mac 模式：WPS 调前台再截（真机实证：后台 Space 只能拍到墙纸）
    try { execSync('open -a wpsoffice', { timeout: 10000, stdio: 'ignore' }) } catch { /* ignore */ }
    execSync('sleep 2')
    execSync(`screencapture -x "${file}"`, { timeout: 20000, stdio: 'ignore' })
    console.log(`    📸 ${name}`)
  } catch (e) {
    console.log(`    ⚠ 截图失败 ${name}: ${String(e.message).slice(0, 80)}`)
  }
}

const docName = async () => {
  const m = await tool('document_meta', {}).catch(() => null)
  return String(m?.name || m?.document?.name || m?.title || JSON.stringify(m).slice(0, 80))
}

async function waitSidecar() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch('http://127.0.0.1:62588/healthz'); if (r.ok) return } catch { /* 未起 */ }
    await sleep(2000)
  }
  throw new Error('sidecar healthz 不通')
}

async function setup() {
  console.log('== 重启 WPS 并打开种子文件 ==')
  try { execSync('pkill -x wpsoffice', { timeout: 10000, stdio: 'ignore' }) } catch { /* 本就没开 */ }
  await sleep(6000)
  // 清掉窗口恢复状态：否则上次会话的旧文档会被还原，挤掉活动工作簿（真机实证）
  try { execSync(`rm -rf "$HOME/Library/Saved Application State/com.kingsoft.wpsoffice.mac.savedState"`, { timeout: 10000, stdio: 'ignore' }) } catch { /* ignore */ }
  const { ET2_FILE } = await import('./scenarios-et-v2.mjs')
  const { WPP2_FILE } = await import('./scenarios-wpp-v2.mjs')
  const contract = path.join(FILES_DIR, 'e2e-contract2.docx')
  const handout2 = path.join(FILES_DIR, 'e2e-讲义2.docx')
  const handout3 = path.join(FILES_DIR, 'e2e-讲义3.docx')
  if (!fs.existsSync(handout3)) fs.copyFileSync(handout2, handout3)

  // 全部走 open CLI（document_open force 会让 ribbon webview 掉线，真机实证多文档下宿主成批掉线）
  for (const [f, host] of [[ET2_FILE, 'et'], [WPP2_FILE, 'wpp'], [contract, 'wps'], [handout2, 'wps'], [handout3, 'wps']]) {
    console.log(`>> open ${path.basename(f)}（等 ${host} 宿主）`)
    execSync(`open -a wpsoffice "${f}"`, { timeout: 20000, stdio: 'ignore' })
    await sleep(12000)
    if (host !== 'wps') {
      const ok = await waitHost(host, 60000)
      if (!ok) throw new Error(`${host} 宿主未上线`)
    }
  }
  // 回到 et 工作簿作为活动工作簿（open CLI 重开即可，不必 activate）
  execSync(`open -a wpsoffice "${ET2_FILE}"`, { timeout: 20000, stdio: 'ignore' })
  await sleep(6000)
  const etSt = await tool('spreadsheet', { action: 'status' }, 20000)
  const wppSt = await tool('presentation', { action: 'status' }, 20000)
  console.log('活动工作簿:', etSt?.workbook?.name || JSON.stringify(etSt).slice(0, 100))
  console.log('活动演示稿:', wppSt?.presentation?.name || JSON.stringify(wppSt).slice(0, 100))
  if (etSt?.workbook?.name !== 'e2e-et2.xlsx' || wppSt?.presentation?.name !== 'e2e-wpp2.pptx') {
    throw new Error('活动对象不符，setup 失败')
  }
  const st = await wpsStatus()
  console.log('agents:', (st?.agent?.agents || []).map(a => `${a.addonType}:${a.online ? 'on' : 'off'}`).join(' '))
}

async function runEt() {
  const { SCENARIOS, ET2_FILE } = await import('./scenarios-et-v2.mjs')
  if (process.env.CHAYUAN_REMOTE === '1') {
    // 远程模式：不做本机聚焦（open CLI 是 Mac 专属），仅校验活动对象
    const st = await tool('spreadsheet', { action: 'status' }, 20000)
    console.log(`et 车道开始（远程），活动工作簿=${st?.workbook?.name || '未知'}`)
    if (st?.workbook?.name !== 'e2e-et2.xlsx') throw new Error('远程活动工作簿不是 e2e-et2.xlsx，拒绝开跑')
  } else {
    const name = await osOpenDoc('e2e-et2', ET2_FILE)
    const st = await tool('spreadsheet', { action: 'status' }, 20000)
    console.log(`et 车道开始，活动工作簿=${st?.workbook?.name || name || '未知'}`)
    if (st?.workbook?.name !== 'e2e-et2.xlsx') throw new Error('活动工作簿不是 e2e-et2.xlsx，拒绝开跑')
  }
  return runLane('et', pick(SCENARIOS), {
    jsonlName: `../e2e-v2/results-et${process.env.CHAYUAN_TAG || ''}.jsonl`,
    onDone: (rec) => shot(`et-${rec.id}${rec.attempt > 1 ? '-r' + rec.attempt : ''}.png`)
  })
}

async function runWpp() {
  const { SCENARIOS, WPP2_FILE } = await import('./scenarios-wpp-v2.mjs')
  if (process.env.CHAYUAN_REMOTE === '1') {
    const st = await tool('presentation', { action: 'status' }, 20000)
    console.log(`wpp 车道开始（远程），活动演示稿=${st?.presentation?.name || '未知'}`)
    if (st?.presentation?.name !== 'e2e-wpp2.pptx') throw new Error('远程活动演示稿不是 e2e-wpp2.pptx，拒绝开跑')
  } else {
    const name = await osOpenDoc('e2e-wpp2', WPP2_FILE)
    const st = await tool('presentation', { action: 'status' }, 20000)
    console.log(`wpp 车道开始，活动演示稿=${st?.presentation?.name || name || '未知'}`)
    if (st?.presentation?.name !== 'e2e-wpp2.pptx') throw new Error('活动演示稿不是 e2e-wpp2.pptx，拒绝开跑')
  }
  return runLane('wpp', pick(SCENARIOS), {
    jsonlName: `../e2e-v2/results-wpp${process.env.CHAYUAN_TAG || ''}.jsonl`,
    onDone: (rec) => shot(`wpp-${rec.id}${rec.attempt > 1 ? '-r' + rec.attempt : ''}.png`)
  })
}

async function summary() {
  for (const lane of ['et', 'wpp']) {
    const p = path.join(OUT_DIR, `results-${lane}.jsonl`)
    if (!fs.existsSync(p)) { console.log(`[${lane}] 无结果`); continue }
    const recs = fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
    const pass = recs.filter(r => r.pass).length
    console.log(`[${lane}] ${pass}/${recs.length} PASS`)
    for (const r of recs.filter(r => !r.pass)) console.log(`  FAIL ${r.id} ${r.desc} :: ${String(r.evidence).slice(0, 140)}`)
  }
  const shots = fs.existsSync(SHOTS_DIR) ? fs.readdirSync(SHOTS_DIR) : []
  console.log(`截图 ${shots.length} 张 → ${SHOTS_DIR}`)
}

async function main() {
  await waitSidecar()
  if (has('--setup')) return setup()
  if (has('--summary')) return summary()
  if (has('--fresh')) {
    for (const f of fs.readdirSync(OUT_DIR)) {
      if (/^results-.*\.jsonl$/.test(f)) fs.rmSync(path.join(OUT_DIR, f))
    }
    console.log('已清空历史结果 (--fresh)')
  }
  if (!has('--no-restart')) await setup()
  let results = []
  if (LANE === 'et') results = await runEt()
  else if (LANE === 'wpp') results = await runWpp()
  else if (LANE === 'all') {
    results.push(...await runEt())
    results.push(...await runWpp())
  } else {
    console.error('用法: node run-v2.mjs --setup | --lane et|wpp|all [--only ID,...] [--no-restart] [--fresh] | --summary')
    process.exit(1)
  }
  const passed = results.filter(r => r.pass).length
  console.log(`\n========== ${LANE} 汇总: ${passed}/${results.length} PASS ========== `)
  if (passed < results.length) process.exitCode = 2
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
