/** 顶部按钮逐项测试运行器：et → wpp 顺序执行（结果并入 results-*-vm.jsonl） */
import { runLane } from './harness.mjs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const SHOTS_DIR = process.env.CHAYUAN_SHOTS_DIR || '/Users/zyh/work/chayuan-wps/artifacts/e2e-v2/shots-vm'
fs.mkdirSync(SHOTS_DIR, { recursive: true })

function shot(name) {
  try {
    const file = path.join(SHOTS_DIR, name)
    const cmdTpl = process.env.CHAYUAN_SHOT_CMD
    if (cmdTpl) {
      execSync(cmdTpl.replace('{file}', JSON.stringify(file)), { timeout: 30000, stdio: 'ignore' })
    } else {
      try { execSync('open -a wpsoffice', { timeout: 10000, stdio: 'ignore' }) } catch { /* ignore */ }
      execSync('sleep 2')
      execSync(`screencapture -x "${file}"`, { timeout: 20000, stdio: 'ignore' })
    }
    console.log(`    📸 ${name}`)
  } catch (e) {
    console.log(`    ⚠ 截图失败 ${name}: ${String(e.message).slice(0, 80)}`)
  }
}

const SHOTS = process.env.CHAYUAN_SHOTS_DIR || '/Users/zyh/work/chayuan-wps/artifacts/e2e-v2/shots-vm'
const TAG = process.env.CHAYUAN_TAG || ''

async function main() {
  const et = await import('./scenarios-buttons-et.mjs')
  const results = await runLane('et', et.SCENARIOS, {
    jsonlName: `../e2e-v2/results-et${TAG}.jsonl`,
    onDone: (rec) => shot(`et-${rec.id}${rec.attempt > 1 ? '-r' + rec.attempt : ''}.png`)
  })
  const wpp = await import('./scenarios-buttons-wpp.mjs')
  const results2 = await runLane('wpp', wpp.SCENARIOS, {
    jsonlName: `../e2e-v2/results-wpp${TAG}.jsonl`,
    onDone: (rec) => shot(`wpp-${rec.id}${rec.attempt > 1 ? '-r' + rec.attempt : ''}.png`)
  })
  const all = [...results, ...results2]
  const passed = all.filter(r => r.pass).length
  console.log(`\n===== 按钮测试汇总: ${passed}/${all.length} PASS =====`)
  for (const f of all.filter(r => !r.pass)) console.log(`  FAIL ${f.id}: ${String(f.evidence).slice(0, 140)}`)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
