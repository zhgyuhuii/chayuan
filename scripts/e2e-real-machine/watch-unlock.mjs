/**
 * 锁屏守望者：锁屏期间 WPS webview 的 LLM 流被系统挂起（真机实证：直接工具写正常、
 * chat_turn 全部零写入），本进程每 2 分钟发一个探针回合，写入成功即判定解锁，
 * 随后顺序补跑 et/wpp 全部剩余场景（含截图）。
 * 用法：node watch-unlock.mjs <et逗号清单> <wpp逗号清单>
 */
import { tool, sleep, MODEL } from './harness.mjs'
import { execSync } from 'node:child_process'

const ET_TODO = process.argv[2] || ''
const WPP_TODO = process.argv[3] || ''
const MAX_WAIT_MIN = 300

let unlocked = false
for (let i = 0; i < MAX_WAIT_MIN && !unlocked; i++) {
  const cell = `J${(i % 40) + 10}`
  try {
    await tool('chat_turn', {
      turnId: `probe-wait-${Date.now()}`, scopeKey: 'probe', host: 'et',
      userText: `请在「公式演示」表的 ${cell} 单元格写入文本：解锁探针OK。只做这一件事。`, model: MODEL
    })
  } catch { /* ignore */ }
  await sleep(60_000)
  try {
    const r = await tool('spreadsheet', { action: 'range_read', sheet: '公式演示', range: `${cell}:${cell}` })
    const v = r?.values?.[0]?.[0]
    if (v) { console.log(`[${new Date().toISOString()}] ✅ 解锁确认（${cell}=${v}），开始补跑`); unlocked = true; break }
  } catch { /* ignore */ }
  console.log(`[${new Date().toISOString()}] 仍锁定（探针无写入），继续等待 ${i + 1}/${MAX_WAIT_MIN}`)
}

if (!unlocked) { console.error('等待超时（5 小时）未解锁，退出'); process.exit(1) }

if (ET_TODO) {
  execSync(`node run-v2.mjs --lane et --no-restart --only ${ET_TODO}`, { stdio: 'inherit', cwd: new URL('.', import.meta.url).pathname })
}
if (WPP_TODO) {
  execSync(`node run-v2.mjs --lane wpp --no-restart --only ${WPP_TODO}`, { stdio: 'inherit', cwd: new URL('.', import.meta.url).pathname })
}
console.log('== 补跑全部完成 ==')
