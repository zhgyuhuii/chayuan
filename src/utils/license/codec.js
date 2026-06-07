// src/utils/license/codec.js
// v1: 6 字节头部: ver(4) kind(1) modules(8)  value(14) issueDate(13) nonce(8) = 48bit
// v2: 7 字节头部: ver(4) kind(1) modules(16) value(14) issueDate(13) nonce(8) = 56bit
// 移植自 website/server/license/codec.js，将 Buffer.alloc 换成 Uint8Array（浏览器兼容）。
export const EPOCH_MS = Date.UTC(2026, 0, 1)          // 2026-01-01 UTC
const DAY_MS = 86400000

const ORDER = ['ver', 'kind', 'modules', 'value', 'issueDate', 'nonce']
const WIDTHS_V1 = { ver: 4, kind: 1, modules: 8,  value: 14, issueDate: 13, nonce: 8 }
const WIDTHS_V2 = { ver: 4, kind: 1, modules: 16, value: 14, issueDate: 13, nonce: 8 }

export function pack(fields) {
  const WIDTHS = fields.modules > 0xff ? WIDTHS_V2 : WIDTHS_V1
  let v = BigInt(0)
  for (const k of ORDER) {
    const w = WIDTHS[k]
    const val = fields[k]
    if (!Number.isInteger(val) || val < 0 || val >= (1 << w)) {
      throw new Error(`field ${k}=${val} out of ${w}-bit range`)
    }
    v = (v << BigInt(w)) | BigInt(val)
  }
  const n = WIDTHS === WIDTHS_V2 ? 7 : 6
  const buf = new Uint8Array(n)
  for (let i = n - 1; i >= 0; i--) { buf[i] = Number(v & BigInt(255)); v >>= BigInt(8) }
  return buf
}

export function unpack(buf) {
  const WIDTHS = buf.length === 7 ? WIDTHS_V2 : WIDTHS_V1
  let v = BigInt(0)
  for (const b of buf) v = (v << BigInt(8)) | BigInt(b)
  const out = {}
  for (let i = ORDER.length - 1; i >= 0; i--) {
    const k = ORDER[i]
    const w = BigInt(WIDTHS[k])
    out[k] = Number(v & ((BigInt(1) << w) - BigInt(1)))
    v >>= w
  }
  return out
}

export function dateToIssue(date) {
  return Math.floor((date.getTime() - EPOCH_MS) / DAY_MS)
}

export function issueToDate(n) {
  return new Date(EPOCH_MS + n * DAY_MS)
}
