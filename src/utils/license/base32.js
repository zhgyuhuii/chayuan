// src/utils/license/base32.js
// Crockford Base32: 数字保留,去掉易混字母 I L O U;输入时 I/L->1 O->0。
// 移植自 website/server/license/base32.js，将 Buffer 换成 Uint8Array（浏览器兼容）。
// 参考 https://www.crockford.com/base32.html

const ENC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'        // 32 符号
const CHECK = ENC + '*~$=U'                            // 37 符号(校验位用)

const DEC = {}
for (let i = 0; i < ENC.length; i++) DEC[ENC[i]] = i
DEC['O'] = 0; DEC['I'] = 1; DEC['L'] = 1               // 输入容错别名

export function encode(buf) {
  let bits = 0, value = 0, out = ''
  for (const b of buf) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += ENC[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    value &= (1 << bits) - 1                           // 只留剩余低位,防 32 位溢出
  }
  if (bits > 0) out += ENC[(value << (5 - bits)) & 31]
  return out
}

export function decode(str) {
  let bits = 0, value = 0
  const out = []
  for (const raw of str.toUpperCase()) {
    if (raw === '-') continue
    const v = DEC[raw]
    if (v === undefined) throw new Error(`invalid base32 symbol: ${raw}`)
    value = (value << 5) | v
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
      value &= (1 << bits) - 1
    }
  }
  return new Uint8Array(out)
}

// Crockford mod-37 校验符:把全部数据字节当大整数取模 37。
export function checkChar(buf) {
  let n = BigInt(0)
  for (const b of buf) n = (n * BigInt(256) + BigInt(b)) % BigInt(37)
  return CHECK[Number(n)]
}
