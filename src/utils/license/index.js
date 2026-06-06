// src/utils/license/index.js
// WPS 端 license 验签入口。
//
// 使用方：
//   import { verifySerial, getFingerprint } from '@/utils/license/index.js'
//   const fp = await getFingerprint()
//   const result = await verifySerial(serial, fp)
//   // result: { valid, modules, kind, value, expireAt?, reason? }
//
// HMAC key 说明：
//   - 当前使用占位 key（PLACEHOLDER_HMAC_KEY_TODO）。
//   - 真实 key 来源待定：选项 A: 打包时从构建环境注入（import.meta.env.VITE_LICENSE_HMAC_KEY）；
//     选项 B: 首次激活时从 server 端点 GET /api/v1/license/hmac-key 获取并本地缓存。
//   - 换用真实 key 后，hmacKeysById 映射需与 website/server/license 端保持一致（ver -> key）。

import { verify } from './shortcode.js'
export { getFingerprint } from './fingerprint.js'

// ── HMAC Key（内置，与 website 签发端 hmac_key_v1 同一把）────────────────────────
// chayuan-wps 离线运行，本地验签需打包 HMAC key。HMAC 为对称密钥，打包后理论上
// 可被逆向提取以伪造序列号——这是离线本地验签的固有取舍（与 desktop 内嵌一致）。
// 优先级：构建注入 VITE_LICENSE_HMAC_KEY（hex）> 内置默认。
const BUILTIN_HMAC_KEY_V1_HEX = 'c639c67cfbc8ceef0efbae305db1ab62d06aecacdc9956a55aa5ab4971b8c471'

// 服务端 Ed25519 公钥（token 验签用）。当前 WPS 走短码 HMAC 验签，暂未使用，保留备用。
export const ED25519_PUBLIC_KEY_HEX = 'c8366a17bc0aa51e4aedc45b61ba213324b821c1580d0139dc74377f01df2715'

/** hex 字符串 → Uint8Array（与 website 的 Buffer.from(hex,'hex') 字节一致）。 */
function hexToBytes(hex) {
  const clean = String(hex || '').trim()
  const out = new Uint8Array(Math.floor(clean.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16)
  return out
}

/**
 * 构建 hmacKeysById 映射：ver(0..15) → HMAC key 字节(Uint8Array)。
 * 关键：必须 hex 解码为字节后传给 verify，否则 shortcode.importHmacKey 会把 hex 字符串
 * 当 UTF-8 文本编码，与 website 签发端字节不一致导致验签失败。
 */
function buildHmacKeysById() {
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LICENSE_HMAC_KEY) || ''
  const hex = envKey || BUILTIN_HMAC_KEY_V1_HEX
  // 当前只有 ver=1 的 key；未来多版本时扩展此映射
  return { 1: hexToBytes(hex) }
}

/**
 * 验证序列号（本地验签，不联网）。
 *
 * @param {string} serial - 序列号（带或不带横杠，如 "XXXXX-XXXXX-XXXXX-XXXXX-X"）
 * @param {string} fingerprint - 本机指纹（16字符小写hex），由 getFingerprint() 返回
 * @param {Object<number, string>} [hmacKeysOverride] - 可选：覆盖默认 hmacKeysById（测试用）
 * @returns {Promise<{valid: boolean, reason?: string, modules?: number, kind?: number, value?: number, expireAt?: Date}>}
 *   - valid: 验签是否通过
 *   - reason: 失败原因（'length'|'decode'|'checksum'|'unknown-key'|'signature'）
 *   - modules: 授权模块位掩码（valid=true 时）
 *   - kind: 0=时间授权 1=次数授权（valid=true 时）
 *   - value: 授权天数(kind=0) 或 次数(kind=1)（valid=true 时）
 *   - expireAt: 到期时间（kind=0 且 valid=true 时）
 */
export async function verifySerial(serial, fingerprint, hmacKeysOverride) {
  if (!serial || typeof serial !== 'string') return { valid: false, reason: 'empty-serial' }
  if (!fingerprint || typeof fingerprint !== 'string') return { valid: false, reason: 'empty-fingerprint' }

  const keysById = hmacKeysOverride || buildHmacKeysById()

  const result = await verify(serial, fingerprint, keysById)
  if (!result.valid) return result

  // 解包 fields 为友好字段
  const { fields, expireAt } = result
  return {
    valid: true,
    modules: fields.modules,
    kind: fields.kind,
    value: fields.value,
    expireAt,
    _fields: fields   // 内部完整字段，调试用
  }
}

/**
 * 检查某 module bit 是否被授权（modules 是 8 位掩码）。
 * 模块位定义（与 website/server/payment/modules.js 对齐）：
 *   bit 0 = wps（察元AI文档助手）
 *   bit 1 = desktop（察元桌面版）
 *   ... 后续扩展
 */
export function hasModule(modules, bit) {
  return (modules & (1 << bit)) !== 0
}

export const MODULE_BIT_WPS = 0
export const MODULE_BIT_DESKTOP = 1
