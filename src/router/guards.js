/**
 * router/guards — Vue Router 守卫
 *
 * 解决 P6 问题:进入 /evolution 不验证 booted,首次进入看到一堆"未启动"。
 *
 * 用法(在 router/index.js):
 *   import { installGuards } from './guards.js'
 *   installGuards(router)
 */

import { getEvolutionStatus } from '../utils/assistant/evolution/evolutionBoot.js'
import { resolveCurrentModel } from '../utils/assistant/evolution/bootHelpers.js'
import toast from '../utils/toastService.js'

/**
 * 安装所有路由守卫。
 */
export function installGuards(router) {
  if (!router || typeof router.beforeEach !== 'function') return

  router.beforeEach((to, from, next) => {
    // 进入需要进化系统的页面 → 自动 boot 或重定向
    const NEEDS_EVOLUTION = ['/evolution', '/dashboard']
    if (NEEDS_EVOLUTION.includes(to.path)) {
      const status = getEvolutionStatus()
      if (!status.booted) {
        const model = resolveCurrentModel()
        if (!model) {
          // 没配模型 → 跳到 /welcome 引导
          try {
            toast.warn('请先配置默认模型', { detail: '在欢迎页或设置中选择 chat 模型', timeout: 5000 })
          } catch (_) {}
          next({ path: '/welcome' })
          return
        }
        // 有模型但没 boot → 提示
        try {
          toast.info('进化系统未启动 — 请在 ⌘K 触发 evo.boot', { timeout: 4000 })
        } catch (_) {}
      }
    }

    // 任何 /evolution / /perf / /dashboard / /marketplace 入口 — 仅 desktop
    const DESKTOP_ONLY = ['/evolution', '/perf', '/dashboard', '/marketplace']
    if (DESKTOP_ONLY.includes(to.path)) {
      if (typeof window !== 'undefined' && window.innerWidth < 600) {
        try { toast.warn('该页面针对桌面端优化,移动端体验可能受限') } catch (_) {}
        // 不阻拦,只是提示
      }
    }

    next()
  })

  router.afterEach((to) => {
    // 路由切换后修改 document.title
    if (to.name && typeof document !== 'undefined') {
      document.title = `${to.name} · 察元`
    }
  })
}

export default { installGuards }
