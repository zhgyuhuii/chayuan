/**
 * agnes 限速恢复守望：探针回合 <45s 落笔 = 速率窗口开启 → 顺序补跑剩余场景。
 * 用法：node watch-rate.mjs <et逗号清单> <wpp逗号清单>
 */
import { tool, sleep, MODEL } from './harness.mjs'
import { execSync } from 'node:child_process'

const ET_TODO = process.argv[2] || ''
const WPP_TODO = process.argv[3] || ''
const t0 = Date.now()
let go = false
for (let i = 0; i < 72 && !go; i++) {   // 最多 ~6 小时
  const cell = `J${(i % 40) + 20}`
  const probeId = `probe-rate-${Date.now()}`
  const sent = Date.now()
  try {
    await tool('chat_turn', { turnId: probeId, scopeKey: 'probe', host: 'et',
      userText: `请在「公式演示」表的 ${cell} 单元格写入数字 1。`, model: MODEL })
  } catch { /* ignore */ }
  let ok = false
  for (let w = 0; w < 5; w++) {        // 最多 ~50s 等落笔
    await sleep(10_000)
    try {
      const r = await tool('spreadsheet', { action: 'range_read', sheet: '公式演示', range: `${cell}:${cell}` })
      if (r?.values?.[0]?.[0]) { ok = true; break }
    } catch { /* ignore */ }
  }
  const dt = Math.round((Date.now() - sent) / 1000)
  if (ok && dt <= 45) { console.log(`[${new Date().toISOString()}] ✅ 速率窗口开启（探针 ${dt}s），开始补跑`); go = true; break }
  console.log(`[${new Date().toISOString()}] 仍限速（探针 ${ok ? dt + 's 才落笔' : '未落笔'}），8 分钟后再试 ${i + 1}/72`)
  await sleep(8 * 60_000)
}
if (!go) { console.error('6 小时内未等到速率窗口，退出'); process.exit(1) }

const CWD = new URL('.', import.meta.url).pathname
try {
  if (ET_TODO) execSync(`node run-v2.mjs --lane et --no-restart --only ${ET_TODO}`, { stdio: 'inherit', cwd: CWD })
} catch (e) { console.log('et 车道非零退出（继续）:', String(e.message).slice(0, 120)) }
try {
  if (WPP_TODO) execSync(`node run-v2.mjs --lane wpp --no-restart --only ${WPP_TODO}`, { stdio: 'inherit', cwd: CWD })
} catch (e) { console.log('wpp 车道非零退出（继续）:', String(e.message).slice(0, 120)) }
console.log('== watch-rate 补跑完成 ==')
