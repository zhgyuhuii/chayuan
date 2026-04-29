/**
 * marketplaceCryptoSigner — 真密码学签名(HMAC-SHA256 / Ed25519)
 *
 * 解决 P6 问题:marketplaceManager 用 djb2 假签名,可被伪造。
 * 用 Web Crypto SubtleCrypto 实现真签名。
 *
 * 提供 2 种模式:
 *   - HMAC-SHA256:对称密钥(简单,但密钥需要分发)
 *   - 验签 only(import):用户拿到一段 publisherPublicKey 后只验签,不签名
 *
 * 用法:
 *   import signer from '@/utils/assistant/marketplaceCryptoSigner.js'
 *
 *   // 签包(开发者侧):
 *   const sig = await signer.signHmac(packageJson, secretKey)
 *
 *   // 验包(用户侧):
 *   const ok = await signer.verifyHmac(packageJson, sig, publisherSharedSecret)
 *
 *   // Ed25519 验签(需 publisher 公钥):
 *   const ok2 = await signer.verifyEd25519(packageJson, sig, publisherPubKeyBase64)
 */

const enc = (s) => new TextEncoder().encode(s)

/* ────────── HMAC-SHA256 ────────── */

async function hmacKey(secret) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API 不可用')
  }
  return crypto.subtle.importKey(
    'raw',
    enc(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

function bytesToBase64(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64')
}

function base64ToBytes(b64) {
  const bin = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function canonicalize(packageJson) {
  // 稳定字符串化:递归排序 keys
  const sortKeys = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj
    if (Array.isArray(obj)) return obj.map(sortKeys)
    return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = sortKeys(obj[k]); return acc }, {})
  }
  // 不参与签名的字段
  const cleaned = { ...packageJson }
  delete cleaned.signature
  return JSON.stringify(sortKeys(cleaned))
}

export async function signHmac(packageJson, secret) {
  const key = await hmacKey(secret)
  const data = enc(canonicalize(packageJson))
  const sig = await crypto.subtle.sign('HMAC', key, data)
  return bytesToBase64(new Uint8Array(sig))
}

export async function verifyHmac(packageJson, signatureB64, secret) {
  if (!packageJson || !signatureB64 || !secret) return false
  try {
    const key = await hmacKey(secret)
    const data = enc(canonicalize(packageJson))
    const sig = base64ToBytes(signatureB64)
    return await crypto.subtle.verify('HMAC', key, sig, data)
  } catch { return false }
}

/* ────────── Ed25519 验签(只验) ────────── */

export async function verifyEd25519(packageJson, signatureB64, publisherPubKeyB64) {
  if (typeof crypto === 'undefined' || !crypto.subtle) return false
  if (!packageJson || !signatureB64 || !publisherPubKeyB64) return false
  try {
    const pubKey = await crypto.subtle.importKey(
      'raw',
      base64ToBytes(publisherPubKeyB64),
      { name: 'Ed25519' },
      false,
      ['verify']
    )
    const data = enc(canonicalize(packageJson))
    const sig = base64ToBytes(signatureB64)
    return await crypto.subtle.verify('Ed25519', pubKey, sig, data)
  } catch { return false }
}

/* ────────── 综合验签(尝试 HMAC + Ed25519) ────────── */

/**
 * 验签 with 多种候选机制。
 *   pkg.signatureType: 'hmac' | 'ed25519'(可选)
 *   options.hmacSecret / options.publisherPubKey
 */
export async function verifyPackage(pkg, options = {}) {
  if (!pkg?.signature) return { ok: false, error: '无签名' }
  const type = pkg.signatureType || (options.hmacSecret ? 'hmac' : 'ed25519')
  if (type === 'hmac') {
    if (!options.hmacSecret) return { ok: false, error: '缺 hmacSecret' }
    const ok = await verifyHmac(pkg, pkg.signature, options.hmacSecret)
    return { ok, error: ok ? '' : 'HMAC 验签失败' }
  }
  if (type === 'ed25519') {
    if (!options.publisherPubKey) return { ok: false, error: '缺 publisherPubKey' }
    const ok = await verifyEd25519(pkg, pkg.signature, options.publisherPubKey)
    return { ok, error: ok ? '' : 'Ed25519 验签失败' }
  }
  return { ok: false, error: `未知 signatureType: ${type}` }
}

export default {
  signHmac,
  verifyHmac,
  verifyEd25519,
  verifyPackage,
  canonicalize
}
