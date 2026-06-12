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
 * 命名额度池(本地按日计数,各池独立重置):
 *   - chat 池: 30 次/天；key: cy_quota_chat_<YYYY-MM-DD>
 *   - assistant 池: 2 次/天；key: cy_quota_assistant_<YYYY-MM-DD>
 *   - 不做 server 计数,MVP 阶段本地计数
 *
 * 用法:
 *   import licenseStore from '@/utils/licenseStore.js'
 *   // 激活
 *   const r = await licenseStore.activate('XXXXX-XXXXX-XXXXX-XXXXX-X')
 *   // 检查是否有付费权限
 *   if (licenseStore.isFeatureAllowed('wps')) { ... }
 *   // 能力门控（含额度检查）
 *   const { allowed, reason, remaining } = licenseStore.checkCapability('chat')
 */

import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'
import { getFingerprint, getCandidateFingerprints } from './license/fingerprint.js'
import { verifySerial, hasModule, MODULE_BIT_WPS } from './license/index.js'

// ── 常量 ────────────────────────────────────────────────────────────

const KEY = 'chayuanLicense'

// 命名额度池（按日重置，各自独立）；key: cy_quota_<pool>_<YYYY-MM-DD>
const QUOTAS = { chat: 30, assistant: 2 }

// 付费专属能力：key -> 弹窗 reason（零免费，未购买直接拦截）。
// 涉密类（脱密/脱密还原/保密检查/涉密关键词提取）现为付费专属，不再走免费池。
// 免费用户触碰任一涉密能力 → 弹购买引导；持任意 wps 付费授权放行。
const PAID_ONLY = {
  'document-declassify': 'declassify',
  'document-declassify-restore': 'declassify_restore',
  'analysis.security-check': 'security_check',
  'analysis.secret-keyword-extract': 'secret_keyword',
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

// ── 共存纯函数 ──────────────────────────────────────────────────────

/**
 * 归一化许可记录到共存模型 { timeExpireAt, counts, countExpireAt }(兼容老单 kind rec)。
 * 非 active 返回空授权。
 */
export function normalizeRec(rec) {
  if (!rec || rec.plan !== 'active') return { timeExpireAt: null, counts: 0, countExpireAt: null }
  if ('timeExpireAt' in rec || 'counts' in rec) {
    return {
      timeExpireAt: rec.timeExpireAt || null,
      counts: typeof rec.counts === 'number' ? rec.counts : 0,
      countExpireAt: rec.countExpireAt || null,
    }
  }
  if (rec.kind === 'time') return { timeExpireAt: rec.expireAt || null, counts: 0, countExpireAt: null }
  if (rec.kind === 'count') return { timeExpireAt: null, counts: typeof rec.value === 'number' ? rec.value : 0, countExpireAt: rec.expireAt || null }
  return { timeExpireAt: null, counts: 0, countExpireAt: null }
}

/**
 * 共存有效性判定(纯函数)。time 有效优先;time 过期后看 count(带次数有效期)。
 */
export function evalLicense(rec, now) {
  const n = normalizeRec(rec)
  const timeValid = !!(n.timeExpireAt && new Date(n.timeExpireAt).getTime() > now)
  const countValid = n.counts > 0 && (!n.countExpireAt || new Date(n.countExpireAt).getTime() > now)
  return { timeValid, countValid, counts: n.counts, timeExpireAt: n.timeExpireAt, countExpireAt: n.countExpireAt, active: timeValid || countValid }
}

// ── 时长叠加 + 去重 ─────────────────────────────────────────────────

/** 序列号是否已激活过(防同码重复刷;与主记录同走 globalSettings 双后端)。 */
export function isSerialUsed(serial) {
  try {
    const s = loadGlobalSettings()
    const a = Array.isArray(s.usedSerials) ? s.usedSerials : []
    return a.includes(serial)
  } catch (e) { return false }
}

/** 记录序列号已激活。 */
export function markSerialUsed(serial) {
  try {
    const s = loadGlobalSettings()
    const a = Array.isArray(s.usedSerials) ? s.usedSerials : []
    if (!a.includes(serial)) { a.push(serial); saveGlobalSettings({ usedSerials: a }) }
  } catch (e) { /* ignore */ }
}

/**
 * 计算叠加后的许可记录(纯函数,便于测试)。共存模型:time/count 不互相覆盖。
 *   existing: 现有 getLicense() 结果;result: 验签结果({kind:0/1, value, expireAt?});serial;now=Date.now()
 * time(kind=0): 累加到期天数,不动 counts。count(kind=1): 累加次数,不动 timeExpireAt。
 */
export function computeStackedRec(existing, result, serial, now) {
  const cur = normalizeRec(existing)
  let timeExpireAt = cur.timeExpireAt
  let counts = cur.counts
  let countExpireAt = cur.countExpireAt
  if (result.kind === 0) {                          // time:累加到期天数,不动 counts
    let curExp = timeExpireAt ? new Date(timeExpireAt).getTime() : 0
    if (Number.isNaN(curExp)) curExp = 0
    timeExpireAt = new Date(Math.max(curExp, now) + result.value * 86400000).toISOString()
  } else {                                          // count:累加次数,不动 timeExpireAt
    counts = cur.counts + result.value
    const rExp = result.expireAt ? new Date(result.expireAt).getTime() : 0
    const curCExp = countExpireAt ? new Date(countExpireAt).getTime() : 0
    countExpireAt = (rExp || curCExp) ? new Date(Math.max(curCExp, rExp)).toISOString() : null
  }
  return { plan: 'active', serial, modules: ['wps'], timeExpireAt, counts, countExpireAt, activatedAt: now }
}

// ── 状态读取 ────────────────────────────────────────────────────────

/**
 * 返回当前许可记录(自动校验有效期/次数,共存模型)。
 */
export function getLicense() {
  const rec = load()
  if (rec.plan !== 'active') return rec
  const ev = evalLicense(rec, Date.now())
  if (!ev.active) {
    const expired = { ...rec, plan: 'expired' }
    save(expired)
    return expired
  }
  return { ...rec, timeExpireAt: ev.timeExpireAt, counts: ev.counts, countExpireAt: ev.countExpireAt }
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

/** 本地验签失败原因 → 中文文案。 */
function _reasonText(reason) {
  switch (reason) {
    case 'empty-serial': return '序列号不能为空'
    case 'empty-fingerprint': return '设备指纹缺失'
    case 'length': return '序列号长度不正确，请检查是否完整'
    case 'decode': return '序列号格式错误，请检查输入'
    case 'checksum': return '序列号校验失败，请核对每一位'
    case 'unknown-key': return '序列号密钥版本不匹配，请更新到最新版本'
    case 'signature': return '序列号与本机不匹配，请核对购买时填写的本机指纹是否正确'
    default: return '序列号无效，请检查后重试'
  }
}

/**
 * 激活序列号:本地验签(离线,不联网) → 存储激活态。
 * HMAC key 由构建注入 VITE_LICENSE_HMAC_KEY（见 license/index.js）。
 * @param {string} serial - 序列号(带或不带横杠)
 * @returns {Promise<{ok:boolean, plan?:string, modules?:string[], kind?:string, value?:number, expireAt?:string, error?:string}>}
 */
export async function activate(serial) {
  const k = String(serial || '').trim()
  if (!k) return { ok: false, error: '序列号不能为空' }

  // 候选指纹：desktop 指纹（若装了 desktop）+ WPS 自身指纹，激活时逐个尝试，
  // 任一验签通过即激活——兼容「用 desktop 指纹购买」与「用 WPS 指纹购买」两种序列号。
  let candidates = []
  try {
    candidates = await getCandidateFingerprints()
  } catch (e) { /* 下面兜底 */ }
  if (!candidates.length) {
    try { const fp = await getFingerprint(); if (fp) candidates = [fp] } catch (e) { /* */ }
  }
  candidates = candidates.filter((m) => /^[0-9a-f]{16}$/i.test(m))
  if (!candidates.length) {
    return { ok: false, error: '获取设备指纹失败，无法激活' }
  }

  // 本地验签（离线，不联网）：逐个候选指纹尝试，任一通过即采用。
  let result = null
  let lastReason = 'signature'
  for (const mid of candidates) {
    let r
    try {
      r = await verifySerial(k, mid)
    } catch (e) {
      lastReason = 'verify-error'
      continue
    }
    if (r.valid) { result = r; break }
    lastReason = r.reason
  }
  if (!result) {
    return { ok: false, error: _reasonText(lastReason) }
  }
  // 本产品只认含 wps 模块位的授权
  if (!hasModule(result.modules, MODULE_BIT_WPS)) {
    return { ok: false, error: '该序列号不包含「察元 AI 文档助手」授权' }
  }

  // 防同码重复刷(永久有效下的安全底线)
  if (isSerialUsed(k)) return { ok: false, error: '该序列号已激活过' }
  // 叠加到现有授权(time 累加到期天数 / count 累加次数),而非覆盖
  const rec = computeStackedRec(getLicense(), result, k, Date.now())
  save(rec)
  markSerialUsed(k)

  return {
    ok: true,
    plan: 'active',
    modules: rec.modules,
    timeExpireAt: rec.timeExpireAt || null,
    counts: rec.counts,
    countExpireAt: rec.countExpireAt || null,
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
  const rec = getLicense()

  if (isPaid) {
    const ev = evalLicense(rec, Date.now())
    if (ev.timeValid) {
      return { allowed: true }                       // 时间有效:不限次,不扣
    }
    if (ev.countValid && cap !== 'chat') {
      return { allowed: true, licenseCount: true, remaining: ev.counts }  // 过期后扣次数
    }
    // chat 或无有效次数 → 落下方免费门控
  }

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

/**
 * 扣减一次「次数授权」的剩余次数（本地离线扣减；WPS 加载项无服务端实时扣次）。
 * 共存模型:扣 counts 字段,不影响 timeExpireAt。扣到 0 且无 time 时置为 expired。
 * @returns {number} 扣减后的剩余次数
 */
export function consumeLicenseCount() {
  const rec = load()
  const ev = evalLicense(rec, Date.now())
  if (rec.plan !== 'active' || ev.counts <= 0) return ev.counts
  const next = Math.max(0, ev.counts - 1)
  const updated = { ...rec, timeExpireAt: ev.timeExpireAt, counts: next, countExpireAt: ev.countExpireAt }
  delete updated.kind; delete updated.value; delete updated.expireAt
  if (next <= 0 && !ev.timeValid) updated.plan = 'expired'
  save(updated)
  return next
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
  consumeLicenseCount,
}
