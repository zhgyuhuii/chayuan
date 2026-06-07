// src/utils/license/shortcode.js
// 移植自 website/server/license/shortcode.js。
// 浏览器适配：Node crypto → crypto.subtle（WebCrypto API），Buffer → Uint8Array。
// sign() 和 verify() 现在是 async 函数（因 WebCrypto 是异步的）。

import { encode, decode, checkChar } from './base32.js'
import { pack, unpack, issueToDate } from './codec.js'

const DAY_MS = 86400000
// 与 index.js 的 COUNT_VALID_DAYS 一致，避免循环依赖
const COUNT_VALID_DAYS = 30

/**
 * 将原始 key bytes（Uint8Array）或 string 导入为 HMAC-SHA256 CryptoKey。
 */
async function importHmacKey(keyMaterial) {
  let keyBytes
  if (typeof keyMaterial === 'string') {
    keyBytes = new TextEncoder().encode(keyMaterial)
  } else {
    keyBytes = keyMaterial
  }
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

/** hex 字符串 → Uint8Array（机器指纹 16 hex → 8 字节）。 */
function hexToBytes(hex) {
  const clean = String(hex || '').trim()
  const out = new Uint8Array(Math.floor(clean.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16)
  return out
}

/**
 * 计算 HMAC-SHA256(header || fingerprintBytes) 并取前 8 字节。
 * @param {Uint8Array} header - 6 字节头部
 * @param {Uint8Array|string} fp - 机器指纹：16 hex 字符串(→hex解码为8字节) 或 Uint8Array
 * @param {string|Uint8Array} key - HMAC key
 * @returns {Promise<Uint8Array>} 8 字节 tag
 */
async function tag8(header, fp, key) {
  const cryptoKey = await importHmacKey(key)
  // 关键：fp 是 16 hex 字符的机器指纹，必须 hex 解码为 8 字节，与 website server 的
  // Buffer.from(mid,'hex')（payment/issue.js、license-routes.js）一致。旧实现误用
  // TextEncoder（把 hex 当 UTF-8 文本→16字节），导致所有序列号验签 signature 失败。
  const fpBytes = typeof fp === 'string' ? hexToBytes(fp) : fp
  const msg = new Uint8Array(header.length + fpBytes.length)
  msg.set(header, 0)
  msg.set(fpBytes, header.length)
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msg)
  return new Uint8Array(sig).subarray(0, 8)
}

/**
 * 连接两个 Uint8Array（替代 Buffer.concat）。
 */
function concatU8(a, b) {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

/**
 * 常数时间比较两个 Uint8Array（替代 crypto.timingSafeEqual）。
 * 防止计时侧信道攻击。
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/**
 * 每5字符插一个 '-'（序列号可读格式）。
 */
function group(str) {
  return str.replace(/.{5}(?=.)/g, '$&-')
}

/**
 * 签发序列号（通常在 server 端调用，WPS 端移植备用）。
 * @param {object} fields - codec 字段: { ver, kind, modules, value, issueDate, nonce }
 * @param {string|Uint8Array} machineFp - 机器指纹（8字节 hex 字符串）
 * @param {string|Uint8Array} hmacKey - HMAC key
 * @returns {Promise<string>} 带横杠分组的序列号（如 XXXXX-XXXXX-XXXXX-XXXXX-X）
 */
export async function sign(fields, machineFp, hmacKey) {
  const header = pack(fields)
  const tag = await tag8(header, machineFp, hmacKey)
  const body = concatU8(header, tag)          // 14 字节
  return group(encode(body) + checkChar(body))
}

/**
 * 验证序列号。
 * @param {string} serial - 序列号字符串（带或不带横杠）
 * @param {string|Uint8Array} machineFp - 本机指纹（8字节 hex 字符串）
 * @param {Object<number, string|Uint8Array>} hmacKeysById - key ver → hmacKey
 * @returns {Promise<{valid: boolean, reason?: string, fields?: object, expireAt?: Date}>}
 */
export async function verify(serial, machineFp, hmacKeysById) {
  const norm = serial.replace(/-/g, '').toUpperCase()
  // v1: 24 chars (6-byte header + 8-byte tag = 14 bytes → 23 base32 + 1 check)
  // v2: 25 chars (7-byte header + 8-byte tag = 15 bytes → 24 base32 + 1 check)
  const headerLen = norm.length === 24 ? 6 : norm.length === 25 ? 7 : 0
  if (!headerLen) return { valid: false, reason: 'length' }
  const bodyLen = headerLen + 8
  let body
  try { body = decode(norm.slice(0, norm.length - 1)) } catch { return { valid: false, reason: 'decode' } }
  if (body.length !== bodyLen) return { valid: false, reason: 'decode' }
  if (checkChar(body) !== norm[norm.length - 1]) return { valid: false, reason: 'checksum' }

  const header = body.subarray(0, headerLen)
  const givenTag = body.subarray(headerLen, bodyLen)
  const fields = unpack(header)

  const key = hmacKeysById[fields.ver]
  if (!key) return { valid: false, reason: 'unknown-key' }

  const want = await tag8(header, machineFp, key)
  if (!timingSafeEqual(want, givenTag)) return { valid: false, reason: 'signature' }

  if (fields.kind === 0) {
    const expireAt = new Date(issueToDate(fields.issueDate).getTime() + fields.value * DAY_MS)
    return { valid: true, fields, expireAt }
  }
  // kind=1 次数型授权：自签发日起 COUNT_VALID_DAYS 天后失效（三端一致，P3 合并保留）
  const expireAt = new Date(issueToDate(fields.issueDate).getTime() + COUNT_VALID_DAYS * DAY_MS)
  return { valid: true, fields, expireAt }
}
