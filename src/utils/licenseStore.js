/**
 * licenseStore — License / activation 骨架
 *
 * 用户激活流程的骨架。真要做 SaaS / 收费,服务端验签 + 激活 + 续期都要补。
 * 当前实现:本地 license key + 简易校验,仅占位。
 *
 * 状态:
 *   - free:无 license(默认);所有"标记付费"的功能 disabled
 *   - trial:7 天试用,过期后 fallback free
 *   - active:有效 license
 *   - expired:license 过期
 *
 * 用法:
 *   import license from '@/utils/licenseStore.js'
 *   if (license.isFeatureAllowed('shadow-double-run')) { ... }
 *   license.activate('xxx-yyy-zzz')
 */

import { loadGlobalSettings, saveGlobalSettings } from './globalSettings.js'

const KEY = 'chayuanLicense'

const FREE_FEATURES = new Set([
  'spell-check', 'translate', 'summary',
  'evolution-view',                    // 看 /evolution 总览
  'theme-toggle'
])

const PAID_FEATURES = new Set([
  'shadow-double-run',
  'rollout-bucketing',
  'team-share',
  'evolution-dashboard',
  'enterprise-audit',
  'unlimited-assistants',
  'rag-context'
])

function load() {
  const s = loadGlobalSettings()
  return s[KEY] && typeof s[KEY] === 'object' ? s[KEY] : { plan: 'free' }
}

function save(rec) {
  return saveGlobalSettings({ [KEY]: rec })
}

/* ────────── 状态 ────────── */

export function getLicense() {
  const rec = load()
  // 自动 expire trial
  if (rec.plan === 'trial' && rec.expiresAt && Date.now() > rec.expiresAt) {
    rec.plan = 'free'
    rec.expiresAt = 0
    save(rec)
  }
  return rec
}

export function getPlan() {
  return getLicense().plan
}

export function isPaidPlan() {
  return ['active', 'trial'].includes(getPlan())
}

export function isFeatureAllowed(feature) {
  if (FREE_FEATURES.has(feature)) return true
  if (!PAID_FEATURES.has(feature)) return true   // 未声明 = 默认放行(向前兼容)
  return isPaidPlan()
}

/* ────────── 激活 / 试用 ────────── */

/**
 * 简易激活:本地保存 key。真实场景应该:
 *   1. 把 key 提交到服务端
 *   2. 服务端验签并返回 active 标记 + expiresAt
 *   3. 本地存激活后的 token
 */
export function activate(key) {
  const k = String(key || '').trim()
  if (!k || k.length < 12) return { ok: false, error: 'key 过短' }
  // TODO: 真实验签
  save({
    plan: 'active',
    key: k,
    activatedAt: Date.now(),
    expiresAt: Date.now() + 365 * 86400000  // 假设 1 年
  })
  return { ok: true, plan: 'active' }
}

/**
 * 启动 7 天试用。同一设备只能试用一次。
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

export function deactivate() {
  save({ plan: 'free' })
  return { ok: true }
}

/* ────────── 信息 ────────── */

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
  startTrial,
  deactivate,
  listFeatures
}
