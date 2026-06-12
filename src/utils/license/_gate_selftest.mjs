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

// 2) 涉密类现为付费专属：未购买时拦截 + 弹购买引导
calls.length = 0
assert.equal(ensureCapability('analysis.security-check', false), false)
assert.equal(calls.length, 1, '涉密未购买应弹购买引导')
assert.ok(String(calls[0][0]).includes('purchase-guide-dialog'), 'url 应指向购买引导窗')
assert.ok(String(calls[0][0]).includes('security_check'), '弹窗 reason 为 security_check')

// 3) 其余涉密 key 同样拦截；普通 cap 仍走 assistant 池(2 次)
calls.length = 0
assert.equal(ensureCapability('document-declassify', false), false)
assert.equal(ensureCapability('document-declassify-restore', false), false)
assert.equal(ensureCapability('analysis.secret-keyword-extract', false), false)
assert.equal(ensureCapability('normal-x', false), true)                         // 1/2
assert.equal(ensureCapability('normal-y', false), true)                         // 2/2

// 4) 普通 cap 超额 → 拦截 + 弹购买(assistant_quota, 剩余0)
calls.length = 0
assert.equal(ensureCapability('normal-z', false), false)                        // assistant 池 2 次已耗尽 → 超额
assert.ok(String(calls[calls.length - 1][0]).includes('assistant_quota'))

console.log('OK _gate_selftest 全部通过')
