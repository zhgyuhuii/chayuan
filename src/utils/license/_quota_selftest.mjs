// _quota_selftest.mjs — 运行: node src/utils/license/_quota_selftest.mjs
// 验证命名额度池 + checkCapability 各分支（mock localStorage，isPaid 注入避开 globalSettings）。
import assert from 'node:assert/strict'

const mem = {}
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v) },
  removeItem: (k) => { delete mem[k] },
}

const {
  checkCapability, incQuota, getQuotaRemaining, canUseQuota, getQuotaLimit, getQuotaUsed,
} = await import('../licenseStore.js')

// 1) 已购买：任何能力放行
assert.equal(checkCapability('chat', true).allowed, true)
assert.equal(checkCapability('analysis.security-check', true).allowed, true)

// 2) 涉密类现为付费专属：未购买时直接拦截（paidOnly=true，不走 assistant 池）
let r = checkCapability('analysis.security-check', false)
assert.equal(r.allowed, false); assert.equal(r.paidOnly, true); assert.equal(r.reason, 'security_check')
r = checkCapability('analysis.secret-keyword-extract', false)
assert.equal(r.allowed, false); assert.equal(r.paidOnly, true); assert.equal(r.reason, 'secret_keyword')
r = checkCapability('document-declassify', false)
assert.equal(r.allowed, false); assert.equal(r.paidOnly, true); assert.equal(r.reason, 'declassify')
r = checkCapability('document-declassify-restore', false)
assert.equal(r.allowed, false); assert.equal(r.paidOnly, true); assert.equal(r.reason, 'declassify_restore')

// 3) chat 池：30 次后超额
assert.equal(getQuotaLimit('chat'), 30)
// remaining 是「本次消耗前」剩余（调用方放行后才 incQuota）
assert.equal(checkCapability('chat', false).remaining, 30)
for (let i = 0; i < 30; i++) { assert.equal(checkCapability('chat', false).allowed, true); incQuota('chat') }
r = checkCapability('chat', false)
assert.equal(r.allowed, false); assert.equal(r.reason, 'chat_quota'); assert.equal(r.remaining, 0)

// 4) assistant 池：5 次后超额；普通/未知 key 落 assistant 池
assert.equal(getQuotaLimit('assistant'), 5)
for (let i = 0; i < 5; i++) { assert.equal(checkCapability('some-normal-assistant', false).allowed, true); incQuota('assistant') }
r = checkCapability('assistant', false)
assert.equal(r.allowed, false); assert.equal(r.reason, 'assistant_quota')

// localStorage 不可用时安全降级
const saved = globalThis.localStorage
delete globalThis.localStorage
assert.equal(getQuotaUsed('chat'), 0)
assert.equal(canUseQuota('chat'), true)
globalThis.localStorage = saved

console.log('OK _quota_selftest 全部通过')
