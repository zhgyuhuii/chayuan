/**
 * licenseStore — License / activation 管理(WPS 加载项)
 *
 * 激活流程:
 *   1. activate(serial) 调用 website server POST /api/license/verify 验签
 *   2. 服务端持有 HMAC key,本地不存 key,防伪造
 *   3. 验签通过则本地持久化激活态(serial + modules + kind + value + expireAt)
 *
 * 授权状态:
 *   - 未激活:无持久化激活记录
 *   - 激活·有效:有记录且(time: expireAt 未过期 / count: value > 0)
 *   - 激活·过期/耗尽:有记录但已无效
 *
 * 免费次数(本地按日计数):
 *   - 每日最多 FREE_DAILY 次(默认 5)
 *   - key: cy_assistant_count_<YYYY-MM-DD>
 *   - 不做 server 计数,MVP 阶段本地计数
 *
 * 用法:
 *   import licenseStore from '@/utils/licenseStore.js'
 *   // 激活
 *   const r = await licenseStore.activate('XXXXX-XXXXX-XXXXX-XXXXX-X')
 *   // 检查是否有付费权限
 *   if (licenseStore.isFeatureAllowed('wps')) { ... }
 *   // 免费次数
 *   if (licenseStore.canUseFree()) licenseStore.incDailyFreeUsed()
 */

import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
import { getFingerprint } from './license/fingerprint.js'

// ── 常量 ────────────────────────────────────────────────────────────

const KEY = 'chayuanLicense'
const FREE_DAILY = 5   // 每日免费次数上限（保留，兼容旧引用）

// 命名额度池（按日重置，各自独立）；key: cy_quota_<pool>_<YYYY-MM-DD>
const QUOTAS = { chat: 30, assistant: 5 }

// 付费专属能力：key -> 弹窗 reason（零免费，未购买直接拦截）
const PAID_ONLY = {
  'document-declassify': 'declassify',
  'document-declassify-restore': 'declassify_restore',
  'analysis.security-check': 'security_check',
  'analysis.secret-keyword-extract': 'secret_keyword',
}

// verify 接口地址(server 端验签,不含 HMAC key)
// 'aidooo.com' 经 XOR 0x5a + base64 混淆,运行时还原。
// 说明:客户端必须连接该域名,此处仅做源码混淆,抓包仍可见。
const _H = 'OzM+NTU1dDk1Nw=='
function _getVerifyEndpoint() {
  const raw = atob(_H)
  let h = ''
  for (let i = 0; i < raw.length; i++) {
    h += String.fromCharCode(raw.charCodeAt(i) ^ 0x5a)
  }
  return 'https://' + h + '/api/license/verify'
}

const FREE_FEATURES = new Set([
  'spell-check', 'translate', 'summary',
  'evolution-view',
  'theme-toggle'
])

const PAID_FEATURES = new Set([
  'wps',
  'shadow-double-run',
  'rollout-bucketing',
  'team-share',
  'evolution-dashboard',
  'enterprise-audit',
  'unlimited-assistants',
  'rag-context'
])

// ── 内部 load/save ──────────────────────────────────────────────────

function load() {
  const s = loadGlobalSettings()
  return s[KEY] && typeof s[KEY] === 'object' ? s[KEY] : { plan: 'free' }
}

function save(rec) {
  return saveGlobalSettings({ [KEY]: rec })
}

// ── 状态读取 ────────────────────────────────────────────────────────

/**
 * 返回当前许可记录(自动校验有效期/次数)。
 */
export function getLicense() {
  const rec = load()
  if (rec.plan !== 'active') return rec

  // time 授权:到期检查
  if (rec.kind === 'time' && rec.expireAt) {
    if (Date.now() >= new Date(rec.expireAt).getTime()) {
      const expired = { ...rec, plan: 'expired' }
      save(expired)
      return expired
    }
  }
  // count 授权:次数耗尽检查
  if (rec.kind === 'count' && typeof rec.value === 'number' && rec.value <= 0) {
    const exhausted = { ...rec, plan: 'expired' }
    save(exhausted)
    return exhausted
  }
  return rec
}

export function getPlan() {
  return getLicense().plan
}

/**
 * 是否有有效的付费激活(plan=active,modules 含 wps 或未指定,且未过期/未耗尽)。
 */
export function isPaidPlan() {
  const rec = getLicense()
  if (rec.plan !== 'active') return false
  // 如果有 modules 列表,检查是否包含 wps
  if (Array.isArray(rec.modules) && rec.modules.length > 0) {
    return rec.modules.includes('wps') || rec.modules.includes('chat')
  }
  return true
}

/**
 * 检查某功能是否被允许。
 * - 免费功能永远放行
 * - 付费功能:有有效付费授权,或在免费次数内
 */
export function isFeatureAllowed(feature) {
  if (FREE_FEATURES.has(feature)) return true
  if (!PAID_FEATURES.has(feature)) return true   // 未声明 = 默认放行(向前兼容)
  return isPaidPlan()
}

// ── 激活 ────────────────────────────────────────────────────────────

/**
 * 激活序列号:调用 website server 验签 → 存储激活态。
 * @param {string} serial - 序列号(带或不带横杠)
 * @returns {Promise<{ok:boolean, plan?:string, modules?:string[], kind?:string, value?:number, expireAt?:string, error?:string}>}
 */
export async function activate(serial) {
  const k = String(serial || '').trim()
  if (!k) return { ok: false, error: '序列号不能为空' }

  let mid
  try {
    mid = await getFingerprint()
  } catch (e) {
    return { ok: false, error: '获取设备指纹失败: ' + e.message }
  }
  if (!mid || !/^[0-9a-f]{16}$/i.test(mid)) {
    return { ok: false, error: '设备指纹格式异常' }
  }

  let resp, data
  try {
    resp = await fetch(_getVerifyEndpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serial: k, mid }),
    })
    data = await resp.json()
  } catch (e) {
    return { ok: false, error: '网络错误: ' + e.message }
  }

  if (!data.valid) {
    return { ok: false, error: data.reason || 'invalid' }
  }

  // 验签通过,持久化激活态
  const rec = {
    plan: 'active',
    serial: k,
    modules: data.modules || [],
    kind: data.kind,
    value: data.value,
    activatedAt: Date.now(),
    ...(data.expireAt ? { expireAt: data.expireAt } : {}),
  }
  save(rec)

  return {
    ok: true,
    plan: 'active',
    modules: rec.modules,
    kind: rec.kind,
    value: rec.value,
    expireAt: rec.expireAt || null,
  }
}

/**
 * 取消激活。
 */
export function deactivate() {
  save({ plan: 'free' })
  return { ok: true }
}

// ── 命名额度池（按日计数） ──────────────────────────────────────────
function quotaKey(pool) {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `cy_quota_${pool}_${y}-${m}-${day}`
}

export function getQuotaLimit(pool) {
  return QUOTAS[pool] || 0
}

export function getQuotaUsed(pool) {
  try {
    if (typeof localStorage === 'undefined') return 0
    const n = parseInt(localStorage.getItem(quotaKey(pool)), 10)
    return isNaN(n) || n < 0 ? 0 : n
  } catch {
    return 0
  }
}

export function getQuotaRemaining(pool) {
  return Math.max(0, getQuotaLimit(pool) - getQuotaUsed(pool))
}

export function canUseQuota(pool) {
  return getQuotaUsed(pool) < getQuotaLimit(pool)
}

export function incQuota(pool) {
  try {
    if (typeof localStorage === 'undefined') return 0
    const next = getQuotaUsed(pool) + 1
    localStorage.setItem(quotaKey(pool), String(next))
    return next
  } catch {
    return 0
  }
}

/**
 * 统一能力门控。
 * @param {string} cap - 'chat' | 'assistant' | 助手 key（含付费专属 4 个 key）
 * @param {boolean} [isPaid] - 是否已购买（默认 isPaidPlan()；测试可注入）
 * @returns {{allowed:boolean, reason?:string, pool?:string, remaining?:number, paidOnly?:boolean}}
 */
export function checkCapability(cap, isPaid = isPaidPlan()) {
  if (isPaid) return { allowed: true }

  // 付费专属：零免费，直接拦截
  if (PAID_ONLY[cap]) {
    return { allowed: false, reason: PAID_ONLY[cap], paidOnly: true }
  }

  // 额度类：chat 独立池；其余（含未知普通助手）落 assistant 池
  const pool = cap === 'chat' ? 'chat' : 'assistant'
  if (canUseQuota(pool)) {
    return { allowed: true, pool, remaining: getQuotaRemaining(pool) }
  }
  return { allowed: false, reason: `${pool}_quota`, pool, remaining: 0 }
}

// ── 兼容别名：旧「执行助手免费次数」= assistant 池 ────────────────────
export function getDailyFreeUsed() { return getQuotaUsed('assistant') }
export function canUseFree() { return canUseQuota('assistant') }
export function incDailyFreeUsed() { return incQuota('assistant') }
export function getDailyFreeRemaining() { return getQuotaRemaining('assistant') }

// ── 兼容:保留原有试用接口骨架 ─────────────────────────────────────

/**
 * 启动 7 天试用(本地试用,向前兼容)。
 */
export function startTrial() {
  const rec = load()
  if (rec.trialUsed) return { ok: false, error: '试用已用过' }
  save({
    plan: 'trial',
    trialUsed: true,
    activatedAt: Date.now(),
    expiresAt: Date.now() + 7 * 86400000
  })
  return { ok: true, plan: 'trial' }
}

export function listFeatures() {
  return {
    free: Array.from(FREE_FEATURES),
    paid: Array.from(PAID_FEATURES)
  }
}

export default {
  getLicense,
  getPlan,
  isPaidPlan,
  isFeatureAllowed,
  activate,
  deactivate,
  startTrial,
  listFeatures,
  getDailyFreeUsed,
  getDailyFreeRemaining,
  canUseFree,
  incDailyFreeUsed,
  getQuotaLimit,
  getQuotaUsed,
  getQuotaRemaining,
  canUseQuota,
  incQuota,
  checkCapability,
}
