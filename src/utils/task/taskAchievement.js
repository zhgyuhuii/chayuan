/**
 * taskAchievement — 成就系统(T-4.1)
 *
 * 解锁条件:
 *   - 累计 10 / 100 / 1000 次任务 → 青铜 / 银 / 金 推荐徽章
 *   - 第一次完成某个 kind(如 first-workflow / first-evolution) → 启航徽章
 *   - 1 天内 N 次成功(连续打卡)
 *
 * 持久到 localStorage(achievementsState)。
 * 触发 toast(用一次性大动效 chy-promote-glow)+ taskEventBus emit('task:achievement-unlocked')
 */

import { loadGlobalSettings, saveGlobalSettings } from '../globalSettings.js'
import { onlyEvent } from './taskEventBus.js'
import toast from '../toastService.js'

const KEY = 'chayuanAchievements'

const ACHIEVEMENTS = Object.freeze([
  // 累计任务数
  { id: 'total-10',   threshold: 10,   icon: '🥉', label: '青铜操盘手', detail: '累计完成 10 次任务' },
  { id: 'total-100',  threshold: 100,  icon: '🥈', label: '银牌操盘手', detail: '累计完成 100 次任务' },
  { id: 'total-1000', threshold: 1000, icon: '🥇', label: '金牌操盘手', detail: '累计完成 1000 次任务,你是真爱用户' },
  // 类型首次
  { id: 'first-assistant',    kindFirst: 'assistant',   icon: '🤖', label: '助手启航', detail: '首次执行助手任务' },
  { id: 'first-workflow',     kindFirst: 'workflow',    icon: '⚙', label: '编排者', detail: '首次执行工作流' },
  { id: 'first-spell-check',  kindFirst: 'spell-check', icon: '✓', label: '校对师', detail: '首次拼写检查' },
  { id: 'first-evolution',    kindFirst: 'evolution',   icon: '🌱', label: '进化派', detail: '首次启动进化系统' },
  // 速度
  { id: 'speedrun-10',  speedrun: { count: 10, withinSec: 60 }, icon: '⚡', label: '极速 10 连', detail: '一分钟内完成 10 次任务' }
])

const DEFAULT_STATE = {
  totalCompleted: 0,
  unlocked: {},        // id → unlockedAt
  kindFirst: {},       // kind → taskId(首次完成)
  speedrunBuffer: []   // 最近完成时间戳数组
}

/* ────────── 状态 ────────── */

function load() {
  const s = loadGlobalSettings()
  const m = s[KEY]
  if (!m || typeof m !== 'object') return JSON.parse(JSON.stringify(DEFAULT_STATE))
  return {
    totalCompleted: Number(m.totalCompleted) || 0,
    unlocked: m.unlocked && typeof m.unlocked === 'object' ? { ...m.unlocked } : {},
    kindFirst: m.kindFirst && typeof m.kindFirst === 'object' ? { ...m.kindFirst } : {},
    speedrunBuffer: Array.isArray(m.speedrunBuffer) ? [...m.speedrunBuffer] : []
  }
}

function save(state) {
  return saveGlobalSettings({ [KEY]: state })
}

/* ────────── API ────────── */

export function getState() { return load() }

export function listAchievements() {
  return ACHIEVEMENTS.map(a => ({ ...a, unlocked: !!load().unlocked[a.id] }))
}

export function getUnlocked() {
  const state = load()
  return ACHIEVEMENTS.filter(a => state.unlocked[a.id]).map(a => ({
    ...a,
    unlockedAt: state.unlocked[a.id]
  }))
}

/**
 * 任务完成时调一次。检测是否解锁新成就并 toast。
 * 返回 unlocked 数组。
 */
export function onTaskCompleted(task) {
  if (!task) return []
  const state = load()
  state.totalCompleted += 1

  // speedrun buffer
  const now = Date.now()
  state.speedrunBuffer = state.speedrunBuffer.filter(ts => now - ts <= 60000)
  state.speedrunBuffer.push(now)

  const newlyUnlocked = []

  for (const a of ACHIEVEMENTS) {
    if (state.unlocked[a.id]) continue

    let met = false
    if (a.threshold && state.totalCompleted >= a.threshold) met = true
    if (a.kindFirst && task.kind === a.kindFirst && !state.kindFirst[a.kindFirst]) {
      met = true
      state.kindFirst[a.kindFirst] = task.id
    }
    if (a.speedrun && state.speedrunBuffer.length >= a.speedrun.count) {
      const first = state.speedrunBuffer[state.speedrunBuffer.length - a.speedrun.count]
      if (now - first <= a.speedrun.withinSec * 1000) met = true
    }

    if (met) {
      state.unlocked[a.id] = now
      newlyUnlocked.push(a)
    }
  }

  save(state)

  // toast 庆祝
  for (const a of newlyUnlocked) {
    try {
      toast.success(`🎉 解锁成就:${a.label}`, {
        detail: a.detail,
        timeout: 6000
      })
    } catch (_) {}
  }
  return newlyUnlocked
}

/**
 * 启动期一次性安装监听(task:completed → 检测成就)。
 * 返回 unsubscribe。
 */
export function installAchievementListener() {
  return onlyEvent('task:completed', msg => {
    if (msg?.success === false) return
    onTaskCompleted({ id: msg.taskId, kind: msg.kind })
  })
}

export function reset() {
  save({ ...DEFAULT_STATE })
}

export default {
  ACHIEVEMENTS,
  getState,
  listAchievements,
  getUnlocked,
  onTaskCompleted,
  installAchievementListener,
  reset
}
