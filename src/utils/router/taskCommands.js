/**
 * taskCommands — 任务系统的 ⌘K 命令(T-5.2)
 *
 * 注册 6 条命令:
 *   - task.center.open    打开 /task-center
 *   - task.cancel.all     取消所有运行中
 *   - task.retry.failed   重跑所有失败
 *   - task.clean.completed  清理已完成
 *   - task.capsule.show   显示时间胶囊(导航到 task-center 并自动打开)
 *   - task.achievements   显示成就
 */

import { registerCommands } from './commandRegistry.js'
import { getTasks, removeTask } from '../taskListStore.js'
import { emit } from '../task/taskEventBus.js'
import toast from '../toastService.js'

const GROUP = '任务'

export function registerTaskCommands() {
  return registerCommands([
    {
      id: 'task.center.open',
      group: GROUP,
      icon: '📋',
      title: '打开任务中心',
      keywords: ['task', 'center', '任务', '中心'],
      priority: 80,
      handler: () => {
        if (typeof window !== 'undefined') {
          const base = window.location.href.split('#')[0]
          window.location.href = base + '#/task-center'
        }
      }
    },
    {
      id: 'task.cancel.all',
      group: GROUP,
      icon: '✕',
      title: '取消所有运行中的任务',
      keywords: ['cancel', 'stop', '停止', '取消'],
      handler: () => {
        const tasks = getTasks() || []
        const running = tasks.filter(t => t.status === 'running' || t.status === 'queued')
        if (running.length === 0) { toast.info('当前无运行中任务'); return }
        for (const t of running) {
          emit('task:cancelled', { taskId: t.id, kind: t.kind, reason: 'cmd-cancel-all' })
        }
        toast.success(`已请求取消 ${running.length} 个任务`)
      }
    },
    {
      id: 'task.retry.failed',
      group: GROUP,
      icon: '🔁',
      title: '重跑所有失败的任务',
      keywords: ['retry', '重跑', 'failed', '失败'],
      handler: () => {
        const tasks = getTasks() || []
        const failed = tasks.filter(t => t.status === 'failed' && t.canRetry !== false)
        if (failed.length === 0) { toast.info('当前无失败任务可重跑'); return }
        for (const t of failed) {
          emit('task:retried', { taskId: t.id, kind: t.kind })
        }
        toast.success(`已请求重跑 ${failed.length} 个任务`)
      }
    },
    {
      id: 'task.clean.completed',
      group: GROUP,
      icon: '🧹',
      title: '清理已完成的任务',
      keywords: ['clean', '清理', 'clear', 'completed'],
      handler: () => {
        const tasks = getTasks() || []
        const completed = tasks.filter(t => t.status === 'completed' && !t.starred)
        if (completed.length === 0) { toast.info('当前无可清理的任务'); return }
        completed.forEach(t => removeTask(t.id))
        toast.success(`已清理 ${completed.length} 条已完成任务`)
      }
    },
    {
      id: 'task.capsule.show',
      group: GROUP,
      icon: '📅',
      title: '查看时间胶囊(本月回顾)',
      keywords: ['capsule', 'wrap', 'review', '回顾'],
      priority: 50,
      handler: () => {
        if (typeof window !== 'undefined') {
          const base = window.location.href.split('#')[0]
          window.location.href = base + '#/task-center?capsule=1'
        }
      }
    },
    {
      id: 'task.achievements',
      group: GROUP,
      icon: '🏆',
      title: '查看成就',
      keywords: ['achievements', '成就', 'badge'],
      handler: () => {
        if (typeof window !== 'undefined') {
          const base = window.location.href.split('#')[0]
          window.location.href = base + '#/task-center?achievements=1'
        }
      }
    }
  ])
}

export default { registerTaskCommands }
