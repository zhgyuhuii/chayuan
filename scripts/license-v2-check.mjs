// node scripts/license-v2-check.mjs —— 跨语言金标:验 website 产出的 v1/v2 短码能否被 wps verify 通过。
import { webcrypto } from 'node:crypto'
if (!globalThis.crypto) globalThis.crypto = webcrypto

const { verify } = await import('../src/utils/license/shortcode.js')

const KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const FP = '1122334455667788'
const keys = { 1: Uint8Array.from(KEY_HEX.match(/../g).map((h) => parseInt(h, 16))) }

// v1 time 金标(来自 desktop test_shortcode.py, 同 KEY/FP); v2 count 金标(来自 website license-golden-v2)
const V1_TIME = '20407-G4Q00-50485-11B32-AM84'
const V2_COUNT = '3040G-1J0JW-0A6KC-ZCG0C-2V0E5'

let fail = 0
async function check(name, serial, wantKind, wantMods, wantBit8) {
  const r = await verify(serial, FP, keys)
  const ok = r.valid && r.fields.kind === wantKind && r.fields.modules === wantMods && (!wantBit8 || !!(r.fields.modules & (1 << 8)))
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: valid=${r.valid} kind=${r.fields && r.fields.kind} modules=0x${r.fields && r.fields.modules.toString(16)}`)
  if (!ok) fail++
}
await check('v1-time', V1_TIME, 0, 1, false)
await check('v2-count', V2_COUNT, 1, 0x0101, true)
process.exit(fail ? 1 : 0)
