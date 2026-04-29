/**
 * installEvolutionScheduler — 一键安装定时进化系统
 *
 * 把以下 3 个定时器一次性挂上(以前各自分散):
 *   - daily evaluation cycle(每天 03:00,scheduler.installEvolutionScheduler)
 *   - rollback monitor 高频 tick(每 2 小时,sampleAndDecide for all observations)
 *   - 网络重连自动重启
 *
 * 在 main.js / App.vue onMounted 调一次即可。
 */

import { installEvolutionScheduler as installCron } from './scheduler.js'
import { listObservations, sampleAndDecide } from './rollbackMonitor.js'
import { getCurrentEvolutionDeps } from './evolutionBoot.js'
import toast from '../../toastService.js'

let _stopCron = null
let _rollbackTimer = null
const ROLLBACK_TICK_MS = 2 * 60 * 60_000  // 2 小时

async function rollbackTick() {
  const deps = getCurrentEvolutionDeps()
  if (!deps) return  // 进化系统未启动 → 不跑
  const observations = listObservations() || []
  if (!observations.length) return

  for (const obs of observations) {
    if (obs.rolledBack) continue
    try {
      const decision = await sampleAndDecide({
        assistantId: obs.assistantId,
        callRollback: async (previousVersionId, reason) => {
          await deps.setActiveVersion(obs.assistantId, previousVersionId)
          if (typeof window !== 'undefined') {
            toast.warn(`助手已自动回滚`, {
              detail: `${obs.assistantId}: ${reason}`,
              actionLabel: '查看',
              onAction: () => {
                const base = window.location.href.split('#')[0]
                window.location.href = base + '#/evolution'
              }
            })
          }
        }
      })
      if (decision?.rolledBack && typeof console !== 'undefined') {
        console.info(`[evolution-rollback] ${obs.assistantId} 自动回滚: ${decision.reason}`)
      }
    } catch (e) {
      if (typeof console !== 'undefined') {
        console.warn(`[evolution-rollback] ${obs.assistantId} sampleAndDecide 失败:`, e?.message)
      }
    }
  }
}

/**
 * 安装全部定时器。返回 stop 函数。
 *   options.cron        透传给 installCron(beforeRun / afterRun 等)
 *   options.rollbackTickMs  默认 2 小时;较小值更快回滚但耗 API
 */
export function installAllEvolutionTimers(options = {}) {
  const deps = getCurrentEvolutionDeps()
  if (!deps) {
    if (typeof console !== 'undefined') {
      console.warn('[installAllEvolutionTimers] 进化系统未 boot,跳过')
    }
    return () => {}
  }

  // daily cycle
  if (!_stopCron) {
    _stopCron = installCron({
      deps,
      ...(options.cron || {})
    })
  }

  // rollback tick
  if (!_rollbackTimer) {
    const ms = Number(options.rollbackTickMs) || ROLLBACK_TICK_MS
    // 启动 5 分钟后第一次跑(避开冷启高峰)
    setTimeout(() => { rollbackTick().catch(() => {}) }, 5 * 60_000)
    _rollbackTimer = setInterval(() => { rollbackTick().catch(() => {}) }, ms)
  }

  if (typeof console !== 'undefined') {
    console.info('[installAllEvolutionTimers] 已安装 daily cycle + 2h 回滚 tick')
  }

  return function stopAll() {
    if (_stopCron) { try { _stopCron() } catch (_) {} _stopCron = null }
    if (_rollbackTimer) { clearInterval(_rollbackTimer); _rollbackTimer = null }
  }
}

export default {
  installAllEvolutionTimers
}
