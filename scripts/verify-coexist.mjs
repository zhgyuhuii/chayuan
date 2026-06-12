/* eslint-env node, es2021 */
globalThis.window = {}
const store = {}
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: (k) => { delete store[k] },
}
const { normalizeRec, evalLicense, computeStackedRec } = await import('../src/utils/licenseStore.js')

let pass = 0, fail = 0
const ok = (n, c, e = '') => { (c ? pass++ : fail++); console.log(`${c ? '[PASS]' : '[FAIL]'} ${n}${e ? '  ' + e : ''}`) }
const DAY = 86400000
const now = 1_700_000_000_000

ok('norm 老time', JSON.stringify(normalizeRec({ plan: 'active', kind: 'time', expireAt: new Date(now + 30 * DAY).toISOString() }))
  === JSON.stringify({ timeExpireAt: new Date(now + 30 * DAY).toISOString(), counts: 0, countExpireAt: null }))
ok('norm 老count', JSON.stringify(normalizeRec({ plan: 'active', kind: 'count', value: 50, expireAt: new Date(now + 10 * DAY).toISOString() }))
  === JSON.stringify({ timeExpireAt: null, counts: 50, countExpireAt: new Date(now + 10 * DAY).toISOString() }))
ok('norm 非active', normalizeRec({ plan: 'free' }).counts === 0 && normalizeRec({ plan: 'free' }).timeExpireAt === null)

const recT = { plan: 'active', timeExpireAt: new Date(now + 30 * DAY).toISOString(), counts: 0 }
const afterCount = computeStackedRec(recT, { kind: 1, value: 50 }, 'S1', now)
ok('已有time激活count: time保留', afterCount.timeExpireAt === recT.timeExpireAt, `te=${afterCount.timeExpireAt}`)
ok('已有time激活count: counts=50', afterCount.counts === 50, `c=${afterCount.counts}`)

const recC = { plan: 'active', timeExpireAt: null, counts: 50 }
const afterTime = computeStackedRec(recC, { kind: 0, value: 30 }, 'S2', now)
ok('已有count激活time: counts保留', afterTime.counts === 50, `c=${afterTime.counts}`)
ok('已有count激活time: time=now+30天', Math.abs(new Date(afterTime.timeExpireAt).getTime() - (now + 30 * DAY)) < 2000)

ok('eval time有效', evalLicense({ plan: 'active', timeExpireAt: new Date(now + DAY).toISOString(), counts: 0 }, now).timeValid === true)
ok('eval time过期+count有效', (() => { const e = evalLicense({ plan: 'active', timeExpireAt: new Date(now - DAY).toISOString(), counts: 5 }, now); return e.timeValid === false && e.countValid === true && e.active === true })())
ok('eval 都无→inactive', evalLicense({ plan: 'active', timeExpireAt: new Date(now - DAY).toISOString(), counts: 0 }, now).active === false)
ok('eval count过期', evalLicense({ plan: 'active', counts: 5, countExpireAt: new Date(now - DAY).toISOString() }, now).countValid === false)

console.log(`\n结果: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
