/**
 * bootPerf — 启动期耗时探针(临时诊断用,定位完瓶颈后可移除)
 *
 * 用法:
 *   import { bootMark, bootDump } from '@/utils/bootPerf.js'
 *   bootMark('main.js 顶层 import 完')
 *   ...
 *   bootMark('App.vue onMounted 进入')
 *   ...
 *   bootMark('AIAssistantDialog mounted 完成')
 *   bootDump()  // 把整条时间线打印成一张表
 *
 * 也可在 console 里随时手动:
 *   __chayuanBootDump()
 *   __chayuanBootMarks   // 原始数组
 */

const t0 = (typeof performance !== 'undefined' && typeof performance.now === 'function')
  ? performance.now()
  : Date.now()

const marks = []
let last = t0

function _now() {
  return (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now()
}

export function bootMark(label) {
  const now = _now()
  const sinceStart = +(now - t0).toFixed(1)
  const sinceLast = +(now - last).toFixed(1)
  last = now
  const entry = { label: String(label || ''), sinceStart, sinceLast }
  marks.push(entry)
  // 单行实时输出 — 让用户在 devtools 里可以看到刷屏式的过程
  if (typeof console !== 'undefined') {
    console.log(`[BOOT +${sinceStart}ms] (+${sinceLast}ms) ${entry.label}`)
  }
  return entry
}

/**
 * 测一段函数(同步或 async)的耗时,自动 bootMark 起止。
 *   await bootMeasure('loadHistory', () => this.loadHistory())
 */
export function bootMeasure(label, fn) {
  const start = _now()
  const result = (() => {
    try { return fn() } catch (e) {
      bootMark(`${label} (throw: ${e?.message || e})`)
      throw e
    }
  })()
  if (result && typeof result.then === 'function') {
    return result.then(v => {
      const dur = +(_now() - start).toFixed(1)
      bootMark(`${label} [${dur}ms]`)
      return v
    }, e => {
      const dur = +(_now() - start).toFixed(1)
      bootMark(`${label} [${dur}ms, reject]`)
      throw e
    })
  }
  const dur = +(_now() - start).toFixed(1)
  bootMark(`${label} [${dur}ms]`)
  return result
}

/**
 * 把整条时间线 dump 成一张可读表。
 * 行内同时给出累计 ms / 该 step 增量 ms,便于一眼定位耗时大头。
 */
export function bootDump(title) {
  if (typeof console === 'undefined') return marks.slice()
  const heading = String(title || 'chayuan boot timeline')
  try {
    console.group(`[BOOT] ${heading} (total ${marks.length} steps)`)
    // 表格视图(若支持)
    if (typeof console.table === 'function') {
      console.table(marks.map(m => ({
        '+ms (cum)': m.sinceStart,
        '+ms (delta)': m.sinceLast,
        step: m.label
      })))
    } else {
      marks.forEach(m => {
        console.log(`  +${m.sinceStart}ms (+${m.sinceLast}ms)  ${m.label}`)
      })
    }
    // 找出耗时最大的 5 步,单独高亮
    const top = [...marks].sort((a, b) => b.sinceLast - a.sinceLast).slice(0, 5)
    console.log('[BOOT] top-5 slowest steps:')
    top.forEach(m => console.log(`  +${m.sinceLast}ms  ${m.label}`))
    console.groupEnd()
  } catch (_) { /* group/table 失败不影响主流程 */ }
  return marks.slice()
}

// 暴露给 devtools 控制台,便于在没有 import 上下文的环境里手动 dump。
if (typeof window !== 'undefined') {
  window.__chayuanBootMarks = marks
  window.__chayuanBootDump = bootDump
  window.__chayuanBootT0 = t0
}
