// _gate_selftest.mjs — node src/utils/license/_gate_selftest.mjs
import assert from 'node:assert/strict'
const mem = {}
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k,v)=>{mem[k]=String(v)}, removeItem: k=>{delete mem[k]} }
// stub WPS 弹窗 + location（capabilityGate 的 openPurchaseGuide 依赖）
const calls = []
globalThis.window = { Application: { ShowDialog: (...a) => calls.push(a) }, location: { href: 'http://host/index.html#/' } }

const { ensureCapability } = await import('./capabilityGate.js')

// 已购买：放行、不弹窗
calls.length = 0
assert.equal(ensureCapability('document-declassify', true), true)
assert.equal(calls.length, 0, '已购买不应弹窗')
// 付费专属未购：拦截 + 弹窗(url 含 purchase-guide-dialog 与 security_check) + 返回 false
calls.length = 0
assert.equal(ensureCapability('analysis.security-check', false), false)
assert.equal(calls.length, 1)
assert.ok(String(calls[0][0]).includes('purchase-guide-dialog'), 'url 应指向购买窗')
assert.ok(String(calls[0][0]).includes('security_check'), 'url 应含 reason')
// 普通助手未购：5 次内放行(计数)，第 6 次拦截弹窗(assistant_quota)
calls.length = 0
for (let i = 0; i < 5; i++) assert.equal(ensureCapability('normal-x', false), true)
assert.equal(ensureCapability('normal-x', false), false)
assert.ok(String(calls[calls.length-1][0]).includes('assistant_quota'))
console.log('OK _gate_selftest 全部通过')
