/**
 * MCP headless license gate — NEVER ShowDialog.
 * Returns structured result for MCP error codes.
 */
import { checkCapability, incQuota, isPaidPlan, consumeLicenseCount } from '../../utils/licenseStore.js'

/**
 * @param {string} cap - e.g. 'spell-check'
 * @param {boolean} [isPaid]
 * @returns {{ allowed: boolean, code?: string, reason?: string, pool?: string }}
 */
export function gateCapability(cap, isPaid = isPaidPlan()) {
  try {
    const r = checkCapability(cap, isPaid)
    if (!r.allowed) {
      return {
        allowed: false,
        code: 'LICENSE_REQUIRED',
        reason: r.reason || 'license_required',
        pool: r.pool
      }
    }
    if (r.licenseCount) {
      try { consumeLicenseCount() } catch { /* ignore */ }
      return { allowed: true }
    }
    if (r.pool) {
      try { incQuota(r.pool) } catch { /* ignore */ }
    }
    return { allowed: true, pool: r.pool }
  } catch (e) {
    return {
      allowed: false,
      code: 'LICENSE_CHECK_FAILED',
      reason: e?.message || String(e)
    }
  }
}

export default { gateCapability }
