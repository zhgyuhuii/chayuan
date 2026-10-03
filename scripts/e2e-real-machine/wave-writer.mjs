/**
 * Writer 三级插图专项波次：复用 scenarios-writer.mjs 的真实场景定义，
 * 打开 doc-E 后按优先顺序跑图像场景（生图 → 搜图降级 → 清点/导出/删除）。
 * 用法: node wave-writer.mjs
 */
import { runLane, openDocument, wpsStatus, sleep } from './harness.mjs'
import path from 'node:path'
import { FILES_DIR } from './harness.mjs'

const { SCENARIOS } = await import('./scenarios-writer.mjs')
const IDS = ['W42', 'W41', 'W43', 'W44', 'W45'] // 生图 → 搜图 → 清点 → 导出 → 删除
const wave = IDS.map(id => SCENARIOS.find(s => s.id === id)).filter(Boolean)

const st = await wpsStatus()
console.log('agents:', (st?.agent?.agents || []).map(a => `${a.addonType}:${a.online ? 'on' : 'off'}`).join(' '))
console.log('>>> 打开 doc-E-图文.docx（图像波次）')
const r = await openDocument(path.join(FILES_DIR, 'doc-E-图文.docx'), 'wps')
if (!r.ok) { console.error(r.error); process.exit(1) }
const results = await runLane('wps', wave, { jsonlName: 'results-wps-wave.jsonl' })
const passed = results.filter(x => x.pass).length
console.log(`图像波次(writer): ${passed}/${results.length} PASS`)
process.exit(passed === results.length ? 0 : 2)
