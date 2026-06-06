/**
 * capabilityGate — 统一能力门控收口。
 * 全项目唯一「检查能力 → 未通过弹独立购买引导窗 → 通过则计数」入口。
 */
import { checkCapability, incQuota, isPaidPlan } from '../licenseStore.js'

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

/**
 * 统一门控。
 * @param {string} cap - 'chat' | 'document-declassify' | 'document-declassify-restore' | 助手 key
 * @param {boolean} [isPaid] - 默认 isPaidPlan()，测试可注入
 * @returns {boolean} 放行=true；false=已弹购买引导，调用方应中止
 */
export function ensureCapability(cap, isPaid = isPaidPlan()) {
  const r = checkCapability(cap, isPaid)
  if (!r.allowed) {
    openPurchaseGuide(r.reason)
    return false
  }
  if (r.pool) incQuota(r.pool)
  return true
}

export default { ensureCapability }
