/**
 * taskTimeCapsule — 任务"时间胶囊"年度 / 月度回顾(T-4.2)
 *
 * 输入:hot 任务(localStorage 50 条)+ cold 任务(IndexedDB 全量)
 * 输出:
 *   - 时段总览(任务总数 / 完成率 / 总用时 / 总 LLM 调用)
 *   - Top 助手 / 工作流(最爱用)
 *   - 高峰时段(用户最活跃的小时段)
 *   - 失败聚类(最常见错误)
 *   - 关键事件(首次执行 X / 解锁 X 成就)
 *
 * 像 Spotify Wrapped 风格,每月 / 每年用户主动调一次。
 */

import { listColdTasks } from './taskTieredStorage.js'

/**
 * 生成回顾。
 *   options:
 *     period: 'year' | 'month' | 'week' | 'all',默认 'month'
 *     hotTasks: hot 任务列表(由 caller 传入,通常是 taskListStore.getTasks())
 *
 * 返回:回顾对象。
 */
export async function generateCapsule(options = {}) {
  const period = options.period || 'month'
  const hotTasks = Array.isArray(options.hotTasks) ? options.hotTasks : []

  // 时间范围
  const now = Date.now()
  let since = 0
  if (period === 'year')  since = now - 365 * 86400000
  if (period === 'month') since = now - 30  * 86400000
  if (period === 'week')  since = now - 7   * 86400000

  // 合并 hot + cold
  const cold = await listColdTasks({ limit: 5000 })
  const all = [...hotTasks, ...cold]
    .filter(t => (t.endedAt || t.createdAt || 0) >= since)

  if (all.length === 0) {
    return { empty: true, period, since, total: 0 }
  }

  // 1. 总览
  const completed = all.filter(t => t.status === 'completed').length
  const failed = all.filter(t => t.status === 'failed').length
  const totalDuration = all.reduce((sum, t) => sum + ((t.endedAt || 0) - (t.startedAt || 0)), 0)

  // 2. Top kind
  const byKind = {}
  for (const t of all) {
    const k = t.kind || 'custom'
    byKind[k] = (byKind[k] || 0) + 1
  }
  const topKind = Object.entries(byKind).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // 3. Top assistant / workflow
  const byAssistant = {}
  for (const t of all) {
    const a = t.metadata?.assistantId || t.metadata?.workflowId
    if (a) byAssistant[a] = (byAssistant[a] || 0) + 1
  }
  const topAssistant = Object.entries(byAssistant).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // 4. 高峰时段(by hour 0-23)
  const byHour = new Array(24).fill(0)
  for (const t of all) {
    const h = new Date(t.startedAt || t.createdAt).getHours()
    byHour[h] += 1
  }
  const peakHour = byHour.indexOf(Math.max(...byHour))

  // 5. 失败聚类
  const errorClusters = {}
  for (const t of all) {
    if (t.status !== 'failed') continue
    const key = t.error?.code || t.error?.userMessage?.slice(0, 20) || 'unknown'
    errorClusters[key] = (errorClusters[key] || 0) + 1
  }
  const topErrors = Object.entries(errorClusters).sort((a, b) => b[1] - a[1]).slice(0, 3)

  // 6. 趣味洞察
  const insights = []
  if (completed >= 100) insights.push(`总共完成了 ${completed} 次任务,平均每天 ${(completed / Math.max(1, (now - since) / 86400000)).toFixed(1)} 次`)
  if (totalDuration > 3600_000) insights.push(`总执行时间 ${(totalDuration / 3600_000).toFixed(1)} 小时,大约相当于看了 ${Math.round(totalDuration / 90 / 60_000)} 部电影`)
  if (peakHour >= 0) insights.push(`你最爱在 ${peakHour}:00 ~ ${peakHour + 1}:00 用察元,${peakHour < 9 ? '是个早起族' : peakHour > 21 ? '是个夜猫子' : '是个标准上班族'}`)
  if (topKind[0] && topKind[0][1] / all.length > 0.6) insights.push(`60% 以上的任务是「${topKind[0][0]}」类型 — 你已经形成稳定的工作流`)
  if (failed === 0 && completed > 5) insights.push(`零失败 ${completed} 次完美记录 ✨`)

  return {
    empty: false,
    period,
    since,
    until: now,
    total: all.length,
    completed,
    failed,
    successRate: all.length === 0 ? 0 : Math.round((completed / all.length) * 100),
    totalDurationMs: totalDuration,
    avgDurationMs: all.length === 0 ? 0 : Math.round(totalDuration / all.length),
    topKind,
    topAssistant,
    byHour,
    peakHour,
    topErrors,
    insights
  }
}

/**
 * 把回顾对象渲染为 markdown 文本(用户可分享)。
 */
export function renderCapsuleMarkdown(capsule) {
  if (!capsule || capsule.empty) return '本期无任务记录。'

  const periodLabel = ({ year: '年', month: '月', week: '周', all: '全部' })[capsule.period] || capsule.period
  const md = [
    `# 察元 · 时间胶囊(本${periodLabel}回顾)`,
    '',
    `📊 **总览**:${capsule.total} 个任务 · ${capsule.successRate}% 成功率 · 总耗时 ${formatDur(capsule.totalDurationMs)}`,
    '',
    `🏆 **最爱的 5 类任务**`,
    ...capsule.topKind.map(([k, n], i) => `${i + 1}. ${k} — ${n} 次`),
    ''
  ]
  if (capsule.topAssistant.length) {
    md.push(`🤖 **最爱的助手 / 工作流**`)
    capsule.topAssistant.forEach(([id, n], i) => md.push(`${i + 1}. \`${id}\` — ${n} 次`))
    md.push('')
  }
  if (capsule.topErrors.length) {
    md.push(`⚠ **最常见错误**`)
    capsule.topErrors.forEach(([msg, n]) => md.push(`- ${msg} (${n} 次)`))
    md.push('')
  }
  if (capsule.insights.length) {
    md.push(`✨ **洞察**`)
    capsule.insights.forEach(i => md.push(`- ${i}`))
  }
  return md.join('\n')
}

function formatDur(ms) {
  if (!ms) return '0s'
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600_000) return `${Math.round(ms / 60000)} 分钟`
  return `${(ms / 3600_000).toFixed(1)} 小时`
}

export default {
  generateCapsule,
  renderCapsuleMarkdown
}
