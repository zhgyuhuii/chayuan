/**
 * 真机 180 场景 E2E 运行器。
 *
 * 用法：
 *   node run.mjs --lane writer|et|wpp [--only W01,E02] [--fresh] [--list]
 *   node run.mjs --smoke          # 三车道各跑 1 个冒烟场景
 *
 * 三车道可并行（各自独立进程）：writer 依组切换 7 个文档；et/wpp 各开一个文件跑到底。
 */
import { runLane, openDocument, wpsStatus, tool, sleep, FILES_DIR } from './harness.mjs'
import path from 'node:path'
import fs from 'node:fs'

const args = process.argv.slice(2)
const has = (k) => args.includes(k)
const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null }
const LANE = argOf('--lane') || (has('--smoke') ? 'smoke' : null)
const ONLY = (argOf('--only') || '').split(',').filter(Boolean)
const FRESH = has('--fresh')

if (FRESH) {
  const dir = path.resolve(FILES_DIR, '..')
  for (const f of fs.readdirSync(dir)) {
    if (/^results-.*\.jsonl$/.test(f)) fs.rmSync(path.join(dir, f))
  }
  console.log('已清空历史结果 (--fresh)')
}

function pick(list) {
  if (!ONLY.length) return list
  return list.filter(s => ONLY.includes(s.id))
}

/** IMG_FIRST=1 时把图像场景提到队列最前（三级插图：模型生图/搜图/SVG） */
function orderImageFirst(list, priority) {
  if (process.env.IMG_FIRST !== '1' || !priority) return list
  const head = priority.map(id => list.find(s => s.id === id)).filter(Boolean)
  return [...head, ...list.filter(s => !priority.includes(s.id))]
}

/** LANE_RESUME=1 时用 ensure_open（不 force 重开，保留窗口内未保存状态） */
async function openOrEnsure(filePath, host) {
  if (process.env.LANE_RESUME === '1') {
    const r = await tool('document_ensure_open', { path: filePath }, 60000)
    const online = await (await import('./harness.mjs')).waitHost(host, 60000)
    if (!online) return { ok: false, error: `宿主 ${host} 未在线（resume）` }
    await (await import('./harness.mjs')).sleep(2000)
    return { ok: true }
  }
  return openDocument(filePath, host)
}

async function waitSidecar() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:62588/healthz')
      if (r.ok) return true
    } catch { /* 未起 */ }
    await sleep(2000)
  }
  throw new Error('sidecar healthz 不通')
}

async function activeDocName() {
  const m = await tool('document_meta', {})
  return String(m?.name || m?.document?.name || m?.title || JSON.stringify(m).slice(0, 120))
}

async function openGroupDoc(docPath, expectName) {
  const r = await openOrEnsure(docPath, 'wps')
  if (!r.ok) throw new Error(r.error)
  let name = await activeDocName().catch(() => '')
  // force 重开会把 ribbon webview 打得短暂掉线（真机实证），加重试窗口 12×5s
  for (let i = 0; i < 12 && !name.includes(expectName); i++) {
    await sleep(5000)
    if (i === 6) await tool('document_open', { path: docPath, viaOs: true, activate: true }, 60000).catch(() => {})
    await tool('document_activate', { query: expectName }, 20000).catch(() => {})
    name = await activeDocName().catch(() => '')
  }
  if (!name.includes(expectName)) {
    throw new Error(`活跃文档不符：期望含「${expectName}」，实际「${name}」`)
  }
  return name
}

async function runWriterLane() {
  const { GROUPS, SCENARIOS } = await import('./scenarios-writer.mjs')
  const groups = has('--smoke')
    ? [{ group: 'A', doc: GROUPS[0].doc, ids: ['W01'] }]
    : GROUPS
  const all = []
  for (const g of groups) {
    const base = path.basename(g.doc)
    const expectName = base.replace(/\.docx$/, '')
    console.log(`\n>>> 打开组文档 ${base}`)
    let opened = false
    for (let a = 1; a <= 2 && !opened; a++) {
      try {
        await openGroupDoc(g.doc, expectName)
        opened = true
      } catch (e) {
        if (a < 2) {
          console.log(`!! 组 ${g.group} 第 ${a} 次打开失败（${String(e.message).slice(0, 120)}），20s 后重试`)
          try {
            await import('node:child_process').then(cp => cp.exec('osascript -e \'tell application "wpsoffice" to reopen\''))
          } catch { /* ignore */ }
          await sleep(20000)
        } else {
          console.log(`!! 组 ${g.group} 文档打开失败：${e.message} —— 该组全部场景标记 FAIL`)
          for (const id of g.ids) {
            if (ONLY.length && !ONLY.includes(id)) continue
            all.push({ id, lane: 'wps', pass: false, evidence: `组文档打开失败: ${e.message}`, secs: 0 })
          }
        }
      }
    }
    if (!opened) continue
    const scenarios = pick(SCENARIOS.filter(s => g.ids.includes(s.id)))
    const results = await runLane('wps', scenarios)
    all.push(...results)
  }
  return all
}

async function runEtLane(ids) {
  const { SCENARIOS } = await import('./scenarios-et.mjs')
  const filter = ids || ONLY
  const scenarios = orderImageFirst(filter.length ? SCENARIOS.filter(s => filter.includes(s.id)) : SCENARIOS,
    ['E35', 'E36', 'E37', 'E38', 'E39', 'E40', 'E41', 'E42', 'E61'])
  if (!scenarios.length) return []
  console.log('>>> 打开工作簿 e2e-et.xlsx')
  const r = await openOrEnsure(path.join(FILES_DIR, 'e2e-et.xlsx'), 'et')
  if (!r.ok) throw new Error(r.error)
  return runLane('et', scenarios)
}

async function runWppLane(ids) {
  const { SCENARIOS } = await import('./scenarios-wpp.mjs')
  const filter = ids || ONLY
  const scenarios = orderImageFirst(filter.length ? SCENARIOS.filter(s => filter.includes(s.id)) : SCENARIOS,
    ['P33', 'P34', 'P35', 'P36', 'P37', 'P38', 'P39', 'P40'])
  if (!scenarios.length) return []
  console.log('>>> 打开演示稿 e2e-wpp.pptx')
  const r = await openOrEnsure(path.join(FILES_DIR, 'e2e-wpp.pptx'), 'wpp')
  if (!r.ok) throw new Error(r.error)
  return runLane('wpp', scenarios)
}

async function main() {
  await waitSidecar()
  const st = await wpsStatus()
  console.log('sidecar OK; agents:', (st?.agent?.agents || []).map(a => `${a.addonType}:${a.online ? 'on' : 'off'}`).join(' '))
  if (has('--list')) {
    for (const [lane, mod] of [['writer', './scenarios-writer.mjs'], ['et', './scenarios-et.mjs'], ['wpp', './scenarios-wpp.mjs']]) {
      const { SCENARIOS } = await import(mod)
      console.log(`\n[${lane}] ${SCENARIOS.length} 场景：${SCENARIOS.map(s => s.id).join(' ')}`)
    }
    return
  }
  let results = []
  if (LANE === 'writer') results = await runWriterLane()
  else if (LANE === 'et') results = await runEtLane()
  else if (LANE === 'wpp') results = await runWppLane()
  else if (LANE === 'smoke') {
    const w = await runWriterLane()
    results.push(...w)
    results.push(...await runEtLane(['E01']))
    results.push(...await runWppLane(['P01']))
  } else {
    console.error('用法: node run.mjs --lane writer|et|wpp [--only ID,...] [--fresh] [--list] | --smoke')
    process.exit(1)
  }
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass)
  console.log(`\n========== ${LANE} 汇总: ${passed}/${results.length} PASS ==========`)
  if (failed.length) {
    console.log('失败场景：')
    for (const f of failed) console.log(`  ${f.id}: ${f.evidence?.slice(0, 160)}`)
    process.exitCode = 2
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(1) })
