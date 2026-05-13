/**
 * router/guards — Vue Router 守卫
 *
 * 解决 P6 问题:进入 /evolution 不验证 booted,首次进入看到一堆"未启动"。
 *
 * 用法(在 router/index.js):
 *   import { installGuards } from './guards.js'
 *   installGuards(router)
 *
 * 性能注意:不在顶层 import 进化系统/bootHelpers — 它们的子图(promotionFlow →
 * raceEvaluator / judge / candidateGenerator / failureCluster...)很大,启动期没
 * 必要把它们解析进主 bundle。只有真正切到 /evolution 或 /dashboard 时才动态加载。
 */

import toast from '../utils/toastService.js'

const NEEDS_EVOLUTION = ['/evolution', '/dashboard']
const DESKTOP_ONLY = ['/evolution', '/perf', '/dashboard', '/marketplace']

/**
 * 安装所有路由守卫。
 */
export function installGuards(router) {
  if (!router || typeof router.beforeEach !== 'function') return

  router.beforeEach((to, from, next) => {
    // 桌面端提示 — 同步,廉价
    if (DESKTOP_ONLY.includes(to.path)) {
      if (typeof window !== 'undefined' && window.innerWidth < 600) {
        try { toast.warn('该页面针对桌面端优化,移动端体验可能受限') } catch (_) { /* 提示失败不阻拦路由 */ }
      }
    }

    // 进化系统校验 — 异步,只在去 /evolution 或 /dashboard 时加载,
    // 把整张 promotionFlow / raceEvaluator / judge 子图踢出冷启动主 bundle。
    if (!NEEDS_EVOLUTION.includes(to.path)) {
      next()
      return
    }

    Promise.all([
      import('../utils/assistant/evolution/evolutionBoot.js'),
      import('../utils/assistant/evolution/bootHelpers.js')
    ]).then(([{ getEvolutionStatus }, { resolveCurrentModel }]) => {
      const status = getEvolutionStatus()
      if (status.booted) { next(); return }
      const model = resolveCurrentModel()
      if (!model) {
        try { toast.warn('请先配置默认模型', { detail: '在欢迎页或设置中选择 chat 模型', timeout: 5000 }) }
        catch (_) { /* toast 失败不阻拦路由 */ }
        next({ path: '/welcome' })
        return
      }
      try { toast.info('进化系统未启动 — 请在 ⌘K 触发 evo.boot', { timeout: 4000 }) }
      catch (_) { /* toast 失败不阻拦路由 */ }
      next()
    }).catch(() => next())
  })

  router.afterEach((to) => {
    // 路由切换后修改 document.title
    if (to.name && typeof document !== 'undefined') {
      document.title = `${to.name} · 察元`
    }
  })
}

export default { installGuards }
