// _gate_selftest.mjs — node src/utils/license/_gate_selftest.mjs
import assert from 'node:assert/strict'
const mem = {}
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k,v)=>{mem[k]=String(v)}, removeItem: k=>{delete mem[k]} }
// stub WPS 弹窗 + location（capabilityGate 的 openPurchaseGuide 依赖）
const calls = []
globalThis.window = { Application: { ShowDialog: (...a) => calls.push(a) }, location: { href: 'http://host/index.html#/' } }

const { ensureCapability } = await import('./capabilityGate.js')

// 1) 已购买：放行、不弹窗
calls.length = 0
assert.equal(ensureCapability('document-declassify', true), true)
assert.equal(calls.length, 0, '已购买不应弹窗')

// 2) 涉密类已改 5 次免费(并入 assistant 池)：首次放行 return true + 弹「每天首次」提醒
calls.length = 0
assert.equal(ensureCapability('analysis.security-check', false), true)   // 1/5
assert.equal(calls.length, 1, '每天首次应弹提醒')
assert.ok(String(calls[0][0]).includes('purchase-guide-dialog'), 'url 应指向购买/提醒窗')
assert.ok(String(calls[0][0]).includes('assistant_quota'), '提醒走 assistant_quota')

// 3) 同日后续放行不再弹提醒；涉密+普通共用 assistant 池(5 次)
calls.length = 0
assert.equal(ensureCapability('document-declassify', false), true)             // 2/5
assert.equal(ensureCapability('document-declassify-restore', false), true)      // 3/5
assert.equal(ensureCapability('normal-x', false), true)                         // 4/5
assert.equal(ensureCapability('analysis.secret-keyword-extract', false), true)  // 5/5
assert.equal(calls.length, 0, '同日不再重复弹提醒')

// 4) 第 6 次超额 → 拦截 + 弹购买(assistant_quota, 剩余0)
calls.length = 0
assert.equal(ensureCapability('normal-x', false), false)
assert.equal(calls.length, 1)
assert.ok(String(calls[calls.length - 1][0]).includes('assistant_quota'))

console.log('OK _gate_selftest 全部通过')
