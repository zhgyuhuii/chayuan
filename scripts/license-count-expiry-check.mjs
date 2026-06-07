// node scripts/license-count-expiry-check.mjs —— 验 count 序列号 verify 返回 expireAt。
import { webcrypto } from 'node:crypto'
if (!globalThis.crypto) globalThis.crypto = webcrypto
const { verify } = await import('../src/utils/license/shortcode.js')
const KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const FP = '1122334455667788'
const keys = { 1: Uint8Array.from(KEY_HEX.match(/../g).map((h) => parseInt(h, 16))) }
// COUNT_SERIAL: 同 KEY/FP 的次数金标(来自 desktop test_shortcode.py)
const COUNT_SERIAL = '3080C-G0002-JZ6XA-79BJG-YER6'
const r = await verify(COUNT_SERIAL, FP, keys)
const ok = r.valid && r.fields.kind === 1 && r.expireAt instanceof Date
console.log(`${ok ? 'PASS' : 'FAIL'} count-expiry: valid=${r.valid} kind=${r.fields?.kind} expireAt=${r.expireAt}`)
process.exit(ok ? 0 : 1)
