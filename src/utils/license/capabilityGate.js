/**
 * capabilityGate — 统一能力门控收口。
 * 全项目唯一「检查能力 → 未通过弹独立购买引导窗 → 通过则计数」入口。
 */
import { checkCapability, incQuota, isPaidPlan, consumeLicenseCount } from '../licenseStore.js'

/**
 * 打开独立购买引导窗（任何上下文通用，不依赖 Vue 实例）。
 *
 * URL 拼法：window.location.href 去掉 # 后部分 + #/purchase-guide-dialog?reason=...
 * 在 WPS webview 中 href 形如 http://host/index.html#/current-route，
 * split('#')[0] 得到 http://host/index.html，拼上 hash 后 SPA 路由正常解析。
 * file:// 离线场景下同理，与 Util.GetUrlPath()+GetRouterHash() 等价。
 */
function openPurchaseGuide(reason) {
  try {
    const base = String(window.location.href || '').split('#')[0]
    const url = base + '#/purchase-guide-dialog?reason=' + encodeURIComponent(reason || '')
    // 尺寸不乘 dpr（与任务进度窗一致，避免不同 webview dpr 差异）
    window.Application.ShowDialog(url, '购买授权', 460, 660, false)
  } catch (e) {
    // 弹窗失败静默（门控仍拦截）
  }
}

/** 「每天首次提醒」标记（localStorage，按日）。 */
function _reminderKey() {
  const d = new Date()
  return `cy_usage_reminder_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function _reminderShownToday() {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(_reminderKey()) === '1' } catch (e) { return false }
}
function _markReminderShown() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(_reminderKey(), '1') } catch (e) { /* 静默 */ }
}

/**
 * 统一门控。
 * - 未购买且超额 → 弹购买引导，返回 false（调用方中止）。
 * - 未购买但有剩余 → 计数放行；并在「每天首次」弹一次提醒窗
 *   （剩余次数 + 购买码 + 分享码 + 公众号，对齐 desktop，不阻断执行）。
 * - 已购买 → 直接放行，不弹、不计数。
 * @param {string} cap - 'chat' | 助手 key（含涉密类）
 * @param {boolean} [isPaid] - 默认 isPaidPlan()，测试可注入
 * @returns {boolean} 放行=true；false=已弹购买引导，调用方应中止
 */
export function ensureCapability(cap, isPaid = isPaidPlan()) {
  const r = checkCapability(cap, isPaid)
  if (!r.allowed) {
    openPurchaseGuide(r.reason)
    return false
  }
  // 次数授权:助手/付费功能每次扣 1 次购买次数(扣到 0 自动过期,后续回落免费门控)
  if (r.licenseCount) {
    consumeLicenseCount()
    return true
  }
  if (r.pool) {
    incQuota(r.pool)
    // 每天首次免费使用 → 弹提醒窗（不阻断执行），同 desktop 的「每天一次」体验
    if (!_reminderShownToday()) {
      _markReminderShown()
      openPurchaseGuide(`${r.pool}_quota`)
    }
  }
  return true
}

export default { ensureCapability }
