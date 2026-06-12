/* eslint-env node, es2021 */
// 指纹修复回归验证(无 vitest,独立 node 脚本)
// 用真实现场数据验证两个不变量:
//   1. 治本:cy_machine_id 存在时 getFingerprint 必须沿用它(不再因升级跳变)
//   2. 救场:getCandidateFingerprints 必须同时含 cy_machine_id 与 sha256(cy_machine_raw)
// ── 最小宿主 mock:无 window.Application(文件层/OS 全失败,模拟那台 WPS 宿主) ──
const store = {}
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v) },
  removeItem: (k) => { delete store[k] },
}
globalThis.window = {}                 // 无 Application → getApplication()=null → FS/OS 失败
// navigator 用 Node 自带(无 storage → OPFS 自然失败)
globalThis.fetch = async () => { throw new Error('no network (sidecar unreachable)') }

const REAL = { cy_machine_id: 'd709f5b1af2190be', cy_machine_raw: '28b130374d099b9584ecfaac28f52817' }
const EXPECT_RAW_FP = '110738fd271cf837' // = sha256(cy_machine_raw)[:16]

const { getFingerprint, getCandidateFingerprints, _resetFingerprintCache } =
  await import('../src/utils/license/fingerprint.js')

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}${extra ? '  ' + extra : ''}`) }

// 测试1:治本 —— cy_machine_id 存在 → getFingerprint 沿用它(购买时的 d709 变回来)
store.cy_machine_id = REAL.cy_machine_id
store.cy_machine_raw = REAL.cy_machine_raw
_resetFingerprintCache()
const fp1 = await getFingerprint()
ok('治本: getFingerprint 沿用 cy_machine_id(d709)', fp1 === REAL.cy_machine_id, `got=${fp1}`)

// 测试2:救场 —— 候选同时含 d709(购买锚点) 与 110738(升级后显示值)
_resetFingerprintCache()
const cands = await getCandidateFingerprints()
ok('救场: 候选含 cy_machine_id(d709)', cands.includes(REAL.cy_machine_id), `cands=${JSON.stringify(cands)}`)
ok('救场: 候选含 sha256(cy_machine_raw)=110738', cands.includes(EXPECT_RAW_FP), `cands=${JSON.stringify(cands)}`)

// 测试3:稳定性 —— cy_machine_id 不存在(全新装)时不抛错,生成后焊死锚点
for (const k of Object.keys(store)) delete store[k]
_resetFingerprintCache()
const fp3a = await getFingerprint()
const anchored = store.cy_machine_id
_resetFingerprintCache()
const fp3b = await getFingerprint()
ok('稳定: 全新装生成后焊死 cy_machine_id', !!anchored && fp3a === fp3b && fp3a === anchored, `a=${fp3a} b=${fp3b} anchored=${anchored}`)

console.log(`\n结果: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
