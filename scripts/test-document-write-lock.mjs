#!/usr/bin/env node
/* eslint-env node */
/**
 * documentWriteLock 单元测试（PR9）——纯逻辑：FIFO 顺序 / 排队取消 /
 * 文档切换拒绝 / OCC 基线（含并行洗白变体 O9）/ 写后滚动更新 / 失败不阻断队列 /
 * 全文指纹（中段等长替换可检出）。
 *
 * 用法：node scripts/test-document-write-lock.mjs
 */
import {
  getDocumentFingerprint,
  setWriteBaseline,
  resetWriteBaselines,
  getWriteBaseline,
  withDocumentWriteLock
} from '../src/services/documentWriteLock.js'

let passed = 0
let failed = 0
function ok(cond, label) {
  if (cond) {
    passed++
    console.log(`✓ ${label}`)
  } else {
    failed++
    console.error(`✗ ${label}`)
  }
}
function errCode(p) {
  return p.then(() => null, e => e?.code || e?.name || String(e))
}
const delay = (ms) => new Promise(r => setTimeout(r, ms))

/* ── WPS 环境桩：可编程的 ActiveDocument ─────────────────────── */
function makeDoc(id, text) {
  const doc = {
    _id: id,
    _text: text,
    get FullName() { return doc._id },
    get Name() { return doc._id },
    get Content() { return { get Text() { return doc._text } } },
    get Paragraphs() { return { get Count() { return doc._text.split('\r').length } } }
  }
  return doc
}
const state = { doc: makeDoc('docA.docx', '第一段张三\r第二段李四\r第三段王五') }
globalThis.window = { Application: { get ActiveDocument() { return state.doc } } }

/* ── T1 FIFO 顺序 ────────────────────────────────────────────── */
{
  resetWriteBaselines()
  const order = []
  const mk = (tag, ms = 5) => withDocumentWriteLock({ label: tag }, async () => {
    order.push(tag)
    await delay(ms)
    return tag
  })
  const rs = await Promise.all([mk('a'), mk('b'), mk('c')].map(x => x.promise))
  ok(JSON.stringify(order) === JSON.stringify(['a', 'b', 'c']), 'T1 FIFO 严格按入队顺序执行')
  ok(JSON.stringify(rs) === JSON.stringify(['a', 'b', 'c']), 'T1 各等待者拿到自己的结果')
}

/* ── T2 排队中取消：本人收到 CANCELLED，他人不受影响 ──────────── */
{
  resetWriteBaselines()
  const order = []
  const a = withDocumentWriteLock({ label: 'a' }, async () => { await delay(20); order.push('a') })
  const b = withDocumentWriteLock({ label: 'b' }, async () => { order.push('b') })
  const c = withDocumentWriteLock({ label: 'c' }, async () => { order.push('c') })
  await delay(2)
  b.cancel()
  ok((await errCode(b.promise)) === 'DOC_WRITE_LOCK_CANCELLED', 'T2 取消者收到 DOC_WRITE_LOCK_CANCELLED')
  await Promise.all([a.promise, c.promise])
  ok(JSON.stringify(order) === JSON.stringify(['a', 'c']), 'T2 取消不阻断队列（a、c 照常执行）')
}

/* ── T3 排队期间活动文档切换 → DOC_SWITCHED ──────────────────── */
{
  resetWriteBaselines()
  const a = withDocumentWriteLock({ label: 'a' }, async () => { await delay(15); return 'a' })
  const b = withDocumentWriteLock({ label: 'b', expectDocId: 'docA.docx' }, async () => 'b')
  await delay(2)
  state.doc = makeDoc('docB.docx', '另一篇文档')
  ok((await errCode(b.promise)) === 'DOC_SWITCHED', 'T3 排队期间切文档 → DOC_SWITCHED')
  ok((await a.promise) === 'a', 'T3 已持锁的写入不受后续切换影响')
  state.doc = makeDoc('docA.docx', '第一段张三\r第二段李四\r第三段王五')
}

/* ── T4 OCC：token A 基线 → 手动编辑 → A 的写被拒 ─────────────── */
{
  resetWriteBaselines()
  setWriteBaseline(undefined, undefined, 'turnA')
  state.doc._text = state.doc._text.replace('张三', '张三（改）') // 模拟手动编辑
  const w = withDocumentWriteLock({ label: 'w', baselineToken: 'turnA' }, async () => 'written')
  ok((await errCode(w.promise)) === 'DOCUMENT_MODIFIED_SINCE_BASELINE', 'T4 手动编辑后本回合写被 OCC 拒绝')
  state.doc._text = '第一段张三\r第二段李四\r第三段王五'
}

/* ── T5 并行洗白变体（O9，最危险路径）：手动编辑后 B 会话开新回合，
       A 的写仍被拒——B 的新基线不能洗白 A 的校验 ───────────────── */
{
  resetWriteBaselines()
  setWriteBaseline(undefined, undefined, 'turnA')
  state.doc._text = state.doc._text.replace('李四', '李四!') // 用户手动改正文
  setWriteBaseline(undefined, undefined, 'turnB')           // B 会话回合起点重立基线（旧行为=洗白）
  const w = withDocumentWriteLock({ label: 'w', baselineToken: 'turnA' }, async () => 'A 写入')
  ok((await errCode(w.promise)) === 'DOCUMENT_MODIFIED_SINCE_BASELINE', 'T5 B 的新基线不能洗白 A：A 的写仍被拒（O9）')
  // B 自己的写（基线=编辑后状态）应通过
  const wb = withDocumentWriteLock({ label: 'wb', baselineToken: 'turnB' }, async () => {
    state.doc._text = state.doc._text.replace('王五', '王五!')
    return 'B 写入'
  })
  ok((await wb.promise) === 'B 写入', 'T5 B 基于新鲜基线的写照常通过')
  // A 在 B 写之后再写：A 的基线仍是回合起点 → 被 B 的写拦下（语义 last-writer-wins 废除）
  const wa2 = withDocumentWriteLock({ label: 'wa2', baselineToken: 'turnA' }, async () => 'A 再写')
  ok((await errCode(wa2.promise)) === 'DOCUMENT_MODIFIED_SINCE_BASELINE', 'T5 A 基于过期读取的写被 B 的写入拦下')
  state.doc._text = '第一段张三\r第二段李四\r第三段王五'
}

/* ── T6 写后滚动更新：同 token 连续写不误报 ───────────────────── */
{
  resetWriteBaselines()
  setWriteBaseline(undefined, undefined, 'turnC')
  const w1 = withDocumentWriteLock({ label: 'w1', baselineToken: 'turnC' }, async () => {
    state.doc._text = state.doc._text.replace('张三', '张三1')
    return 1
  })
  ok((await w1.promise) === 1, 'T6 第一次写通过')
  const w2 = withDocumentWriteLock({ label: 'w2', baselineToken: 'turnC' }, async () => {
    state.doc._text = state.doc._text.replace('李四', '李四2')
    return 2
  })
  ok((await w2.promise) === 2, 'T6 同回合第二次写不被自己的写误报')
  state.doc._text = '第一段张三\r第二段李四\r第三段王五'
}

/* ── T7 fn 抛错：锁释放、队列继续 ─────────────────────────────── */
{
  resetWriteBaselines()
  const order = []
  const bad = withDocumentWriteLock({ label: 'bad' }, async () => { throw new Error('boom') })
  const good = withDocumentWriteLock({ label: 'good' }, async () => { order.push('good'); return 'ok' })
  const badErr = await errCode(bad.promise)
  ok(badErr === 'Error' || badErr === 'boom', `T7 失败者收到自身错误（${badErr}）`)
  ok((await good.promise) === 'ok', 'T7 失败不阻断后续（good 执行）')
}

/* ── T8 全文指纹：中段等长替换可检出 ──────────────────────────── */
{
  const fp1 = getDocumentFingerprint()
  state.doc._text = state.doc._text.replace('李四', '赵六') // 等长中段替换
  const fp2 = getDocumentFingerprint()
  ok(fp1 !== fp2, 'T8 全文指纹检出中段等长替换（旧实现首尾 48 字盲区）')
  state.doc._text = '第一段张三\r第二段李四\r第三段王五'
  ok(getDocumentFingerprint() === fp1, 'T8 指纹稳定（内容复原后一致）')
}

/* ── T9 匿名槽：不带 token 的 UI 直调写与跨文档保护 ───────────── */
{
  resetWriteBaselines()
  setWriteBaseline() // 匿名基线（docA）
  const w = withDocumentWriteLock({ label: 'ui' }, async () => 'ui-ok')
  ok((await w.promise) === 'ui-ok', 'T9 匿名写基线一致时通过')
  // 匿名基线仍属 docA，切到 docB 后匿名写被拒（校对卡跨文档保护）
  state.doc = makeDoc('docB.docx', 'docB 内容')
  const w2 = withDocumentWriteLock({ label: 'ui2' }, async () => 'ui2-ok')
  const code = await errCode(w2.promise)
  ok(code === 'DOC_SWITCHED' || code === 'DOCUMENT_MODIFIED_SINCE_BASELINE', `T9 跨文档匿名写被拒（${code}）`)
  state.doc = makeDoc('docA.docx', '第一段张三\r第二段李四\r第三段王五')
}

/* ── T10 getWriteBaseline 读取隔离 ───────────────────────────── */
{
  resetWriteBaselines()
  setWriteBaseline('FP_A', 'docA.docx', 'turnX')
  const a = getWriteBaseline('turnX')
  const anon = getWriteBaseline()
  ok(a.fp === 'FP_A' && a.docId === 'docA.docx', 'T10 token 基线可读')
  ok(anon.fp === 'FP_A', 'T10 匿名槽随 token 基线刷新（无 token 链路旧语义）')
  const other = getWriteBaseline('turnY')
  ok(other.fp === '', 'T10 未登记 token 无基线（写入视为无保护放行）')
}

console.log(failed === 0 ? `\nALL ${passed} TESTS PASSED` : `\n${failed} FAILED / ${passed} passed`)
process.exitCode = failed === 0 ? 0 : 1
