/* eslint-env node, es2021 */
// 时长叠加 + 去重 纯逻辑验证(不依赖真实验签)
globalThis.window = {}
const store = {}
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: (k) => { delete store[k] },
}
const { computeStackedRec, isSerialUsed, markSerialUsed } = await import('../src/utils/licenseStore.js')

let pass = 0, fail = 0
const ok = (n, c, e = '') => { (c ? pass++ : fail++); console.log(`${c ? '[PASS]' : '[FAIL]'} ${n}${e ? '  ' + e : ''}`) }
const DAY = 86400000
const now = 1_700_000_000_000

// time 叠加(已有未过期 → 剩余 + value)
const e1 = { plan: 'active', kind: 'time', expireAt: new Date(now + 30 * DAY).toISOString() }
const r1 = computeStackedRec(e1, { kind: 0, value: 30 }, 'S1', now)
ok('time 叠加(30+30=60天)', Math.abs(new Date(r1.expireAt).getTime() - (now + 60 * DAY)) < 2000, `exp=${r1.expireAt}`)

// time 从过期/free(base=now)
const r2 = computeStackedRec({ plan: 'free' }, { kind: 0, value: 30 }, 'S2', now)
ok('time 从now(30天)', Math.abs(new Date(r2.expireAt).getTime() - (now + 30 * DAY)) < 2000, `exp=${r2.expireAt}`)

// count 叠加
const e3 = { plan: 'active', kind: 'count', value: 50 }
const r3 = computeStackedRec(e3, { kind: 1, value: 50 }, 'S3', now)
ok('count 叠加(50+50=100)', r3.value === 100, `value=${r3.value}`)

// 去重
markSerialUsed('S1')
ok('去重: 已用命中', isSerialUsed('S1') === true)
ok('去重: 未用不命中', isSerialUsed('S9') === false)

// 损坏 expireAt 不 throw(Critical 回归)
let threw = false
try {
  const rc = computeStackedRec({ plan: 'active', kind: 'time', expireAt: 'corrupted' }, { kind: 0, value: 30 }, 'SX', now)
  ok('损坏expireAt兜底(now+30天)', Math.abs(new Date(rc.expireAt).getTime() - (now + 30 * DAY)) < 2000, `exp=${rc.expireAt}`)
} catch (e) { threw = true }
ok('损坏expireAt不抛错', threw === false)

console.log(`\n结果: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
