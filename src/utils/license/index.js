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

// ── HMAC Key 占位 ──────────────────────────────────────────────────────────────
// TODO: 真实 key 待接入。
//   - 接入方案 A：import.meta.env.VITE_LICENSE_HMAC_KEY（打包时注入，需在 .env 配置）
//   - 接入方案 B：运行时从 server 拉取并缓存（防硬编码）
// 当前占位 key 仅用于本地开发调试，与 server 端不匹配，生产环境验签必然失败。
const PLACEHOLDER_HMAC_KEY_TODO = 'placeholder-hmac-key-todo'

/**
 * 从环境变量或占位 key 构建 hmacKeysById 映射。
 * ver(0..15) → hmac key string
 * 真实部署时 key 来自 import.meta.env.VITE_LICENSE_HMAC_KEY。
 */
function buildHmacKeysById() {
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LICENSE_HMAC_KEY) || ''
  const effectiveKey = envKey || PLACEHOLDER_HMAC_KEY_TODO
  // 当前只有 ver=1 的 key；未来多版本时扩展此映射
  return { 1: effectiveKey }
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
