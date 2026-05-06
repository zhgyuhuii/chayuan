/**
 * connectionCipher — 凭据加密(AES-GCM + 设备绑定 key)
 *
 * 设计参考: plan-knowledge-base-integration.md §3.2.4
 *   - deviceKey 派生自浏览器/设备指纹 + OPFS 持久化盐;每次启动重派生,不写盘
 *   - encrypt(plaintext) → "<base64 iv>:<base64 ciphertext>"
 *   - decrypt(envelope)  → plaintext
 *   - 副作用:换设备 / 清 OPFS 后凭据需重新输入(feature, not bug)
 *
 * 注意:
 *   - WPS 加载项的 webview 通常支持 SubtleCrypto,但兼容性需在 wps 端回归
 *   - 测试环境 fallback:若 SubtleCrypto 不在,降级为不加密(明文 base64) +
 *     console.warn,避免阻塞开发;v1 上线前必须在 main 入口校验 SubtleCrypto 可用
 */

const SALT_KEY = 'chayuan-kb-cipher-salt-v1'
const KEY_INFO = new TextEncoder().encode('chayuan-kb-cipher-v1')

let _keyPromise = null

function _isSubtleAvailable() {
  return typeof globalThis.crypto !== 'undefined'
      && typeof globalThis.crypto.subtle !== 'undefined'
}

async function _getOrCreateSalt() {
  // 优先 OPFS;不可用退到 localStorage(开发环境/测试)
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.getDirectory) {
      const root = await navigator.storage.getDirectory()
      try {
        const handle = await root.getFileHandle(SALT_KEY)
        const file = await handle.getFile()
        const buf = await file.arrayBuffer()
        if (buf.byteLength === 32) return new Uint8Array(buf)
      } catch (e) {
        // 不存在 → 创建
      }
      const fresh = globalThis.crypto.getRandomValues(new Uint8Array(32))
      const handle = await root.getFileHandle(SALT_KEY, { create: true })
      const writable = await handle.createWritable()
      await writable.write(fresh)
      await writable.close()
      return fresh
    }
  } catch (e) {
    // OPFS 不可用 → fall through
  }
  // localStorage fallback
  try {
    const existing = globalThis.localStorage?.getItem(SALT_KEY)
    if (existing) {
      const arr = atob(existing).split('').map(c => c.charCodeAt(0))
      if (arr.length === 32) return new Uint8Array(arr)
    }
    const fresh = globalThis.crypto.getRandomValues(new Uint8Array(32))
    const b64 = btoa(String.fromCharCode(...fresh))
    globalThis.localStorage?.setItem(SALT_KEY, b64)
    return fresh
  } catch (e) {
    // 最后兜底:固定盐(仅测试),线上不应走到这里
    return new Uint8Array(32)
  }
}

async function _deriveKey() {
  if (_keyPromise) return _keyPromise
  _keyPromise = (async () => {
    if (!_isSubtleAvailable()) {
      throw new Error('SubtleCrypto unavailable; cannot derive cipher key')
    }
    const salt = await _getOrCreateSalt()
    // 设备指纹素材:userAgent + screen 大小;盐保证同设备不同安装也不同
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : 'node') || ''
    const screen = (typeof globalThis !== 'undefined' && globalThis.screen)
      ? `${globalThis.screen.width}x${globalThis.screen.height}` : '0x0'
    const ikm = new TextEncoder().encode(`${ua}|${screen}`)
    const baseKey = await globalThis.crypto.subtle.importKey(
      'raw', ikm, 'HKDF', false, ['deriveKey']
    )
    return globalThis.crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info: KEY_INFO },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  })()
  return _keyPromise
}

function _b64encode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

function _b64decode(str) {
  const bin = atob(str)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

export async function encrypt(plaintext) {
  if (plaintext == null) return ''
  const text = String(plaintext)
  if (!text) return ''
  if (!_isSubtleAvailable()) {
    // 开发兜底:明文 base64 + plain: 前缀,线上必定要 SubtleCrypto
    if (typeof console !== 'undefined') {
      console.warn('[kb.cipher] SubtleCrypto unavailable, using plaintext fallback')
    }
    return `plain:${btoa(unescape(encodeURIComponent(text)))}`
  }
  const key = await _deriveKey()
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const ct = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text)
  )
  return `${_b64encode(iv)}:${_b64encode(ct)}`
}

export async function decrypt(envelope) {
  if (!envelope) return ''
  const str = String(envelope)
  if (str.startsWith('plain:')) {
    try {
      return decodeURIComponent(escape(atob(str.slice(6))))
    } catch (e) {
      return ''
    }
  }
  const [ivB64, ctB64] = str.split(':')
  if (!ivB64 || !ctB64) throw new Error('invalid cipher envelope')
  if (!_isSubtleAvailable()) {
    throw new Error('SubtleCrypto unavailable; cannot decrypt')
  }
  const key = await _deriveKey()
  const pt = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: _b64decode(ivB64) },
    key,
    _b64decode(ctB64)
  )
  return new TextDecoder().decode(pt)
}

export function _resetKeyForTest() {
  _keyPromise = null
}
