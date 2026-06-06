// _selftest.mjs — 运行方式: node src/utils/license/_selftest.mjs
// 测试：用 website shortcode.sign 生成序列号，再用移植的 WPS verify 验签，确认字节兼容。
// Node 22 原生支持 globalThis.crypto (WebCrypto)，与浏览器 crypto.subtle 兼容。

import { createHmac, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto'

// ─── 辅助：复用 website server/license 原始实现（Node Buffer 版）用于 sign ───
const ENC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CHECK = ENC + '*~$=U'
const DEC = {}
for (let i = 0; i < ENC.length; i++) DEC[ENC[i]] = i
DEC['O'] = 0; DEC['I'] = 1; DEC['L'] = 1

function encodeB(buf) {
  let bits = 0, value = 0, out = ''
  for (const b of buf) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += ENC[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    value &= (1 << bits) - 1
  }
  if (bits > 0) out += ENC[(value << (5 - bits)) & 31]
  return out
}

function checkCharB(buf) {
  let n = 0n
  for (const b of buf) n = (n * 256n + BigInt(b)) % 37n
  return CHECK[Number(n)]
}

const EPOCH_MS = Date.UTC(2026, 0, 1)
const DAY_MS = 86400000
const WIDTHS = { ver: 4, kind: 1, modules: 8, value: 14, issueDate: 13, nonce: 8 }
const ORDER = ['ver', 'kind', 'modules', 'value', 'issueDate', 'nonce']

function packB(fields) {
  let v = 0n
  for (const k of ORDER) {
    const w = WIDTHS[k]
    const val = fields[k]
    v = (v << BigInt(w)) | BigInt(val)
  }
  const buf = Buffer.alloc(6)
  for (let i = 5; i >= 0; i--) { buf[i] = Number(v & 0xffn); v >>= 8n }
  return buf
}

function tag8B(header, fp, key) {
  return createHmac('sha256', key).update(header).update(fp).digest().subarray(0, 8)
}

function group(str) {
  return str.replace(/.{5}(?=.)/g, '$&-')
}

function signNode(fields, fp, key) {
  const header = packB(fields)
  const body = Buffer.concat([header, tag8B(header, fp, key)])
  return group(encodeB(body) + checkCharB(body))
}

// ─── 移植版（browser compat，使用 globalThis.crypto）───

import { verify } from './shortcode.js'

// ─── 测试主体 ───────────────────────────────────────────────────────────────

const HMAC_KEY = 'test-hmac-key-for-selftest'
const FINGERPRINT = 'a1b2c3d4e5f6a7b8'   // 16 char hex = 8 bytes（模拟指纹）

const fields = {
  ver: 1,
  kind: 0,           // 时间授权
  modules: 1,        // bit0 = wps
  value: 365,        // 365 天
  issueDate: Math.floor((Date.now() - EPOCH_MS) / DAY_MS),
  nonce: 42
}

async function run() {
  console.log('=== WPS license 验签自测 ===\n')

  // 1. 用 Node 原版 sign 生成序列号（fp 按 website issueLicense 真路径 hex 解码为 8 字节）
  const serial = signNode(fields, Buffer.from(FINGERPRINT, 'hex'), HMAC_KEY)
  console.log('Node sign 生成序列号:', serial)

  // 2. 用移植的 browser verify 验签
  const keysById = { [fields.ver]: HMAC_KEY }
  const result = await verify(serial, FINGERPRINT, keysById)
  console.log('Browser verify 结果:', result)

  if (!result.valid) {
    console.error('\n[FAIL] 验签失败，原因:', result.reason)
    process.exit(1)
  }

  // 3. 校验字段一致性
  const ok =
    result.fields.ver === fields.ver &&
    result.fields.kind === fields.kind &&
    result.fields.modules === fields.modules &&
    result.fields.value === fields.value &&
    result.fields.issueDate === fields.issueDate &&
    result.fields.nonce === fields.nonce

  if (!ok) {
    console.error('\n[FAIL] 字段不匹配:', result.fields, '期望:', fields)
    process.exit(1)
  }

  // 4. 测试错误指纹拒绝
  const badFp = 'ffffffffffffffff'
  const badResult = await verify(serial, badFp, keysById)
  if (badResult.valid) {
    console.error('\n[FAIL] 错误指纹应该验签失败但通过了')
    process.exit(1)
  }
  console.log('错误指纹验签失败(预期):', badResult.reason)

  // 5. 测试篡改序列号拒绝
  const tampered = serial.slice(0, 5) + 'X' + serial.slice(6)
  const tamperedResult = await verify(tampered, FINGERPRINT, keysById)
  if (tamperedResult.valid) {
    console.error('\n[FAIL] 篡改序列号应该验签失败但通过了')
    process.exit(1)
  }
  console.log('篡改序列号验签失败(预期):', tamperedResult.reason)

  // 6. 测试次数授权（kind=1）
  const fieldsCount = { ...fields, kind: 1, value: 100, ver: 1 }
  const serialCount = signNode(fieldsCount, Buffer.from(FINGERPRINT, 'hex'), HMAC_KEY)
  const countResult = await verify(serialCount, FINGERPRINT, keysById)
  if (!countResult.valid || countResult.fields.kind !== 1 || countResult.fields.value !== 100) {
    console.error('\n[FAIL] 次数授权验签失败:', countResult)
    process.exit(1)
  }
  if (countResult.expireAt !== undefined) {
    console.error('\n[FAIL] 次数授权不应有 expireAt')
    process.exit(1)
  }
  console.log('次数授权验签通过(kind=1, value=100, expireAt=undefined)')

  console.log('\n[PASS] 所有自测通过！Node sign ↔ Browser verify 字节兼容。')
}

run().catch(e => {
  console.error('[ERROR]', e)
  process.exit(1)
})
