/**
 * evolutionCommands — 把进化系统的常用动作注册到 ⌘K 命令面板
 *
 * 命令(均使用 evolutionBoot 提供的全局 deps,无需 caller 注入):
 *   evo.cycle.run       立即跑一次完整评估周期
 *   evo.snapshot.log    控制台打印当前所有助手健康分 + 灰度 + 观察期
 *   evo.scheduler.toggle 切换 daily 自动调度开关
 *   evo.scheduler.now    立即跑一次(等同 cycle.run,但走 scheduler 路径会持久化结果)
 *
 * 用法:
 *   import { registerEvolutionCommands } from '@/utils/router/evolutionCommands.js'
 *   // 任何时机调用一次(即使进化系统还没 boot,命令本身也会注册;
 *   //  执行时若发现未 boot 会给提示而非崩溃)
 *   registerEvolutionCommands()
 */

import { registerCommands } from './commandRegistry.js'
import { runDailyEvaluationCycle, getFlowSnapshot } from '../assistant/evolution/promotionFlow.js'
import { getCurrentEvolutionDeps } from '../assistant/evolution/evolutionBoot.js'
import {
  getSchedulerConfig,
  setSchedulerEnabled,
  runEvolutionNow
} from '../assistant/evolution/scheduler.js'
import { getStats as getPerfStats, clear as clearPerf } from '../perfTracker.js'
import { rebootForModelChange, resolveCurrentModel } from '../assistant/evolution/bootHelpers.js'
import { toggleTheme, setTheme, getTheme, getEffectiveTheme } from './themeToggle.js'

function ensureBooted() {
  const deps = getCurrentEvolutionDeps()
  if (!deps) {
    if (typeof console !== 'undefined') {
      console.warn('[evolutionCommands] 进化系统未启动。请在 main.js 调用 bootEvolutionSystem({ model })')
    }
    return null
  }
  return deps
}

function fmtSummary(result) {
  if (!result) return '(无结果)'
  return [
    `evaluated=${result.evaluated || 0}`,
    `promoted=${result.promoted || 0}`,
    `shadowStarted=${result.shadowStarted || 0}`,
    `rolledBack=${result.rolledBack || 0}`,
    `errors=${(result.errors || []).length}`,
    `${result.durationMs || 0}ms`
  ].join(' · ')
}

export function registerEvolutionCommands(options = {}) {
  const list = [
    {
      id: 'evo.page.open',
      group: '进化',
      icon: '🌱',
      title: '打开助手进化中心',
      keywords: ['evolution', 'page', 'panel', '进化中心', 'dashboard'],
      priority: 80,
      handler: () => {
        if (typeof window !== 'undefined') {
          // 用 hash 路由直接跳转,不需要拿到 router 实例
          const base = window.location.href.split('#')[0]
          window.location.href = base + '#/evolution'
        }
      }
    },
    {
      id: 'evo.boot',
      group: '进化',
      icon: '⚡',
      title: '启动/重启进化系统(基于当前默认模型)',
      keywords: ['boot', 'start', 'init', '启动', '重启', 'reboot'],
      priority: 75,
      handler: () => {
        const model = resolveCurrentModel()
        if (!model) {
          if (typeof console !== 'undefined') {
            console.warn('[evolution] 无法启动:未配置默认模型(modelSettings.defaultModelId 为空)')
          }
          return
        }
        const stop = rebootForModelChange()
        if (typeof console !== 'undefined') {
          if (stop) console.info(`[evolution] 已${getCurrentEvolutionDeps() ? '重启' : '启动'} · model=${model.providerId}/${model.modelId}`)
          else console.warn('[evolution] 启动失败,详见上方日志')
        }
      }
    },
    {
      id: 'evo.cycle.run',
      group: '进化',
      icon: '⟳',
      title: '运行助手进化评估周期',
      keywords: ['evolution', 'cycle', 'evaluate', '评估', '进化'],
      priority: 60,
      handler: async () => {
        const deps = ensureBooted()
        if (!deps) return
        if (typeof console !== 'undefined') console.log('[evolution] 开始周期评估…')
        try {
          const result = await runDailyEvaluationCycle({ deps })
          if (typeof console !== 'undefined') console.log('[evolution] 周期完成:', fmtSummary(result), result)
          if (typeof options.onResult === 'function') options.onResult(result)
        } catch (e) {
          if (typeof console !== 'undefined') console.error('[evolution] 周期失败:', e)
        }
      }
    },

    {
      id: 'evo.snapshot.log',
      group: '进化',
      icon: '📊',
      title: '查看助手健康度快照',
      keywords: ['snapshot', 'health', 'race', '健康分', '快照'],
      handler: () => {
        const deps = ensureBooted()
        if (!deps) return
        const snapshot = getFlowSnapshot({ deps })
        if (typeof console === 'undefined') return
        if (!snapshot.length) {
          console.log('[evolution] 无可进化的助手')
          return
        }
        console.group('[evolution] 助手健康快照')
        snapshot.forEach(row => {
          const h = row.health
          const tags = []
          if (row.shadow) tags.push(`灰度:${row.shadow.versionId}`)
          if (row.observation) tags.push(`观察:${row.observation.versionId}(${row.observation.sampleCount}样本)`)
          if (!row.anchorRegistered) tags.push('未锚定')
          console.log(
            `  ${row.id.padEnd(36)}  ` +
            (h ? `R=${h.R} A=${h.A} C=${h.C} E=${h.E} 总=${h.total}` : '无信号') +
            (tags.length ? '  · ' + tags.join(' / ') : '')
          )
        })
        console.groupEnd()
      }
    },

    {
      id: 'evo.scheduler.toggle',
      group: '进化',
      icon: '⏱',
      title: '切换进化系统每日自动调度',
      keywords: ['scheduler', 'cron', 'daily', '调度', '每日'],
      handler: () => {
        const cfg = getSchedulerConfig()
        const next = !cfg.enabled
        setSchedulerEnabled(next)
        if (typeof console !== 'undefined') {
          console.log(`[evolution] daily 调度已 ${next ? '启用' : '禁用'}(下次目标 ${cfg.triggerHour}:00)`)
        }
      }
    },

    {
      id: 'evo.scheduler.now',
      group: '进化',
      icon: '▶',
      title: '现在就跑一次进化(走 scheduler,会更新 lastRunAt)',
      keywords: ['run', 'now', 'force', '立即', '强制'],
      handler: async () => {
        const deps = ensureBooted()
        if (!deps) return
        try {
          const result = await runEvolutionNow({ deps })
          if (typeof console !== 'undefined') console.log('[evolution] 立即执行完成:', fmtSummary(result))
        } catch (e) {
          if (typeof console !== 'undefined') console.error('[evolution] 立即执行失败:', e)
        }
      }
    },

    /* ─── 总览 ─── */
    {
      id: 'tour.open',
      group: '帮助',
      icon: '🗺',
      title: '功能总览(看所有路由 / 命令 / 模块)',
      keywords: ['tour', 'overview', '总览', '巡检', 'features'],
      priority: 90,
      handler: () => {
        if (typeof window !== 'undefined') {
          const base = window.location.href.split('#')[0]
          window.location.href = base + '#/tour'
        }
      }
    },

    /* ─── 控制台 ─── */
    {
      id: 'control.open',
      group: '帮助',
      icon: '⚙',
      title: '打开控制台(Feature Flags / 助手安装 / License / 个性记忆 / 遥测)',
      keywords: ['control', 'panel', '控制台', 'flags', 'license', 'memory'],
      priority: 88,
      handler: () => {
        if (typeof window !== 'undefined') {
          const base = window.location.href.split('#')[0]
          window.location.href = base + '#/control'
        }
      }
    },

    /* ─── 助手市场 ─── */
    {
      id: 'marketplace.open',
      group: '助手',
      icon: '🛍',
      title: '打开助手市场(查看所有可用助手)',
      keywords: ['marketplace', 'store', '市场', '助手', 'browse'],
      priority: 78,
      handler: () => {
        if (typeof window !== 'undefined') {
          const base = window.location.href.split('#')[0]
          window.location.href = base + '#/marketplace'
        }
      }
    },

    /* ─── 性能监测 ─── */
    {
      id: 'perf.page.open',
      group: '诊断',
      icon: '📊',
      title: '打开 LLM 延迟监控页',
      keywords: ['perf', 'page', 'dashboard', '延迟', '性能', 'p95'],
      priority: 70,
      handler: () => {
        if (typeof window !== 'undefined') {
          const base = window.location.href.split('#')[0]
          window.location.href = base + '#/perf'
        }
      }
    },
    {
      id: 'perf.stats.log',
      group: '诊断',
      icon: '⏱',
      title: '查看 LLM 调用延迟统计',
      keywords: ['perf', 'latency', 'p95', 'p99', '延迟', '性能'],
      handler: () => {
        const s = getPerfStats()
        if (typeof console === 'undefined') return
        if (!s.count) {
          console.log('[perf] 暂无数据(enhancedStream / enhancedOnce 调用一次后即开始记录)')
          return
        }
        console.group(`[perf] ${s.count} 次调用 · ok=${s.ok} fail=${s.fail}`)
        console.log(`avg=${s.avg}ms · p50=${s.p50}ms · p95=${s.p95}ms · p99=${s.p99}ms`)
        console.log('byKind:', s.byKind)
        console.log('byModel:', s.byModel)
        console.groupEnd()
      }
    },
    {
      id: 'perf.stats.clear',
      group: '诊断',
      icon: '🗑',
      title: '清空 LLM 延迟统计',
      keywords: ['clear', 'reset', '清空'],
      handler: () => {
        clearPerf()
        if (typeof console !== 'undefined') console.log('[perf] 已清空')
      }
    },

    /* ─── 外观 ─── */
    {
      id: 'theme.toggle',
      group: '外观',
      icon: '🌓',
      title: '切换暗色 / 亮色主题',
      keywords: ['theme', 'dark', 'light', 'mode', '主题', '暗色', '亮色'],
      handler: () => {
        const next = toggleTheme()
        if (typeof console !== 'undefined') console.log(`[theme] 切换到 ${next}`)
      }
    },
    {
      id: 'theme.auto',
      group: '外观',
      icon: '◐',
      title: '主题:跟随系统',
      keywords: ['theme', 'auto', 'system', '跟随系统'],
      handler: () => {
        setTheme('auto')
        if (typeof console !== 'undefined') console.log(`[theme] 已恢复为「跟随系统」(当前生效:${getEffectiveTheme()})`)
      },
      when: () => getTheme() !== 'auto'
    }
  ]

  return registerCommands(list)
}

export default {
  registerEvolutionCommands
}
