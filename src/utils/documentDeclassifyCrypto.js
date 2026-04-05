const PASSWORD_MIN_LENGTH = 8
const UPPERCASE_REGEX = /[A-Z]/
const LOWERCASE_REGEX = /[a-z]/
const DIGIT_REGEX = /\d/
const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/
const DEFAULT_PBKDF2_ITERATIONS = 210000

function getCryptoApi() {
  const cryptoApi = globalThis.crypto || window?.crypto || null
  if (!cryptoApi?.subtle) {
    throw new Error('当前环境不支持 Web Crypto，无法执行脱密加密')
  }
  return cryptoApi
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value
  return new Uint8Array(value)
}

function bytesToBase64(bytes) {
  const view = toUint8Array(bytes)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < view.length; i += chunkSize) {
    const chunk = view.subarray(i, Math.min(i + chunkSize, view.length))
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

function base64ToBytes(base64) {
  const binary = atob(String(base64 || ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function getTextEncoder() {
  return new TextEncoder()
}

function getTextDecoder() {
  return new TextDecoder()
}

async function importPasswordKey(password) {
  const cryptoApi = getCryptoApi()
  return cryptoApi.subtle.importKey(
    'raw',
    getTextEncoder().encode(String(password || '')),
    'PBKDF2',
    false,
    ['deriveKey']
  )
}

async function deriveAesKey(password, saltBytes, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  const cryptoApi = getCryptoApi()
  const baseKey = await importPasswordKey(password)
  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  )
}

export function validateDeclassifyPassword(password) {
  const value = String(password || '')
  const errors = []
  if (value.length < PASSWORD_MIN_LENGTH) {
    errors.push(`密码长度不能少于 ${PASSWORD_MIN_LENGTH} 位`)
  }
  if (!UPPERCASE_REGEX.test(value)) {
    errors.push('密码必须包含大写字母')
  }
  if (!LOWERCASE_REGEX.test(value)) {
    errors.push('密码必须包含小写字母')
  }
  if (!DIGIT_REGEX.test(value)) {
    errors.push('密码必须包含数字')
  }
  if (!SPECIAL_CHAR_REGEX.test(value)) {
    errors.push('密码必须包含特殊字符')
  }
  return {
    ok: errors.length === 0,
    errors
  }
}

export async function encryptPayload(password, payload, options = {}) {
  const validation = validateDeclassifyPassword(password)
  if (!validation.ok) {
    throw new Error(validation.errors[0] || '密码强度不符合要求')
  }
  const cryptoApi = getCryptoApi()
  const iterations = Number(options.iterations) > 0
    ? Number(options.iterations)
    : DEFAULT_PBKDF2_ITERATIONS
  const saltBytes = cryptoApi.getRandomValues(new Uint8Array(16))
  const ivBytes = cryptoApi.getRandomValues(new Uint8Array(12))
  const aesKey = await deriveAesKey(password, saltBytes, iterations)
  const plaintext = getTextEncoder().encode(JSON.stringify(payload ?? {}))
  const ciphertext = await cryptoApi.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes
    },
    aesKey,
    plaintext
  )
  return {
    version: 1,
    algorithm: 'AES-GCM-256',
    keyDerivation: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      salt: bytesToBase64(saltBytes)
    },
    iv: bytesToBase64(ivBytes),
    ciphertext: bytesToBase64(ciphertext),
    createdAt: new Date().toISOString()
  }
}

export async function decryptPayload(password, envelope) {
  const source = envelope && typeof envelope === 'object' ? envelope : null
  if (!source?.ciphertext || !source?.iv || !source?.keyDerivation?.salt) {
    throw new Error('脱密载荷已损坏，无法解密')
  }
  const iterations = Number(source?.keyDerivation?.iterations) > 0
    ? Number(source.keyDerivation.iterations)
    : DEFAULT_PBKDF2_ITERATIONS
  try {
    const aesKey = await deriveAesKey(password, base64ToBytes(source.keyDerivation.salt), iterations)
    const plaintext = await getCryptoApi().subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(source.iv)
      },
      aesKey,
      base64ToBytes(source.ciphertext)
    )
    return JSON.parse(getTextDecoder().decode(plaintext))
  } catch (error) {
    throw new Error('密码错误或脱密数据已损坏')
  }
}

export async function fingerprintText(text) {
  const digest = await getCryptoApi().subtle.digest(
    'SHA-256',
    getTextEncoder().encode(String(text || ''))
  )
  return bytesToBase64(digest)
}
