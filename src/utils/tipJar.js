/**
 * 「支持我们」随缘提示 — 生命周期状态机（共识定案：常驻低频版 B + 全中性文案）。
 *
 * 与 starPrompt.js（求 GitHub Star）同一谱系，语义对齐：
 *   - 只有用户已从产品中获得价值后才出现（任务成功完成 ≥ MIN_TASKS 次）
 *   - 触发门槛带随机抖动（THRESHOLD_MIN..MAX），不可预测、无"倒计时赶工"感
 *   - 两次展示之间至少静默 MIN_GAP_MS（7 天）
 *   - 「不再提示」后静默 SNOOZE_MS（30 天），设置里可永久关闭
 *   - 与 star-prompt 互斥：另一个提示刚出现过的冷却期内顺延，避免连环乞讨感
 *
 * 持久化：localStorage `nd_tip_jar_prompt`（加载项各 webview 同源共享）。
 */

const STORAGE_KEY = 'nd_tip_jar_prompt'
/** star-prompt 的存储 key（互斥查询用，与 starPrompt.js 保持一致） */
const STAR_STORAGE_KEY = 'nd_github_star_prompt'

/** 任务成功完成次数达到 [MIN, MAX] 区间内随机门槛后才首次出现 */
export const THRESHOLD_MIN = 8
export const THRESHOLD_MAX = 12
/** 任务次数超过 MAX 仍未展示则下次任务完成必弹（封顶兜底，防随机永远躲过） */
export const THRESHOLD_FORCE = THRESHOLD_MAX + 4
/** 两次展示的最短间隔 */
export const MIN_GAP_MS = 7 * 24 * 60 * 60 * 1000
/** 「不再提示」后的静默期 */
export const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000
/** 另一提示（star-prompt / 打赏）展示后的互斥冷却 */
export const MUTEX_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

/** 文案池：全中性（共识拍板：不出现「主人」等称谓）。展示时随机取一条。 */
export const COPY_POOL = [
  '如果这次帮你省了时间，可以点击二维码支持我们——你的支持是我持续进化的最大动力',
  '又帮你干完一件活。觉得效果不错的话，欢迎扫码支持我们，让我进化得更快',
  '任务完成了。如果察元AI对你有帮助，可以扫码支持我们，这是我们坚持下去的全部理由',
  '这次任务还顺利吗？如果觉得好用，可以扫码支持我们——开源免费，全靠用户养活',
  '活干完了。你的支持能换来更快的进化速度，点击二维码可以请我们喝杯咖啡',
  '如果这份产出让你满意，欢迎扫码支持；不满意也请告诉我们，那是更珍贵的养料',
  '帮你把活干完了。觉得不错的话，扫码支持一下，下个版本会因你而更好一点',
  '任务收工。支持我们，就是支持一个开源办公 AI 的持续成长',
]

/** @typedef {{tasksDone?: number, nextThreshold?: number, shownCount?: number, lastShownAt?: number, snoozedUntil?: number, disabledForever?: boolean}} TipJarState */

export function asTipJarState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const raw = value
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined)
  const bool = (v) => (v === true ? true : undefined)
  return {
    tasksDone: num(raw.tasksDone),
    nextThreshold: num(raw.nextThreshold),
    shownCount: num(raw.shownCount),
    lastShownAt: num(raw.lastShownAt),
    snoozedUntil: num(raw.snoozedUntil),
    disabledForever: bool(raw.disabledForever)
  }
}

function rollThreshold() {
  return THRESHOLD_MIN + Math.floor(Math.random() * (THRESHOLD_MAX - THRESHOLD_MIN + 1))
}

export function initialState() {
  return { nextThreshold: rollThreshold() }
}

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return asTipJarState(raw ? JSON.parse(raw) : null)
  } catch {
    return {}
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* quota 等异常忽略 */ }
}

function readStarLastShownAt() {
  try {
    const raw = localStorage.getItem(STAR_STORAGE_KEY)
    const s = raw ? JSON.parse(raw) : null
    return typeof s?.lastShownAt === 'number' ? s.lastShownAt : 0
  } catch {
    return 0
  }
}

/**
 * 任务成功完成一次：累计并返回当前是否应展示。
 * 展示与否由调用方最终裁决（如用户正在打字则放弃，见 withAbandoned）。
 * @returns {{show: boolean, tasksDone: number}}
 */
export function recordTaskDone(state = readState(), now = Date.now()) {
  if (state.disabledForever) return { show: false, tasksDone: state.tasksDone ?? 0 }
  const next = { ...state, tasksDone: (state.tasksDone ?? 0) + 1 }
  next.show = shouldShowTipJar(next, now)
  writeState(next)
  return { show: next.show, tasksDone: next.tasksDone }
}

export function shouldShowTipJar(state, now = Date.now()) {
  if (state.disabledForever) return false
  const done = state.tasksDone ?? 0
  const shown = state.shownCount ?? 0
  // 门槛未到:只对「从未弹过」的环境启用 FORCE 封顶兜底(防随机永远错过);
  // 弹过一次后一律以重掷的 nextThreshold 为准(7 天 MIN_GAP 已另设节奏下限)
  if (done < (state.nextThreshold ?? THRESHOLD_MIN)) {
    if (shown > 0 || done < THRESHOLD_FORCE) return false
  }
  // 展示节奏:两次之间至少 MIN_GAP(以 lastShownAt 为准——组件 markShown 时写入;
  // 若状态缺失则 shownCount>0 分支上方已保证门槛语义完整)
  if (shown > 0 && now - (state.lastShownAt ?? 0) < MIN_GAP_MS) return false
  if (now < (state.snoozedUntil ?? 0)) return false
  // 互斥:star-prompt 或自己最近展示过 → 冷却期内顺延
  const lastAny = Math.max(state.lastShownAt ?? 0, readStarLastShownAt())
  if (lastAny && now - lastAny < MUTEX_COOLDOWN_MS) return false
  return true
}

/** 随机取一条文案 */
export function pickCopy() {
  return COPY_POOL[Math.floor(Math.random() * COPY_POOL.length)]
}

/** 本次已展示：计数 + 时间戳。@returns {string} 使用的文案 */
export function markShown(state = readState(), now = Date.now()) {
  const next = {
    ...state,
    shownCount: (state.shownCount ?? 0) + 1,
    lastShownAt: now
  }
  // 弹过后重掷下一道门槛（相对当前累计值，保持抖动区间）
  next.nextThreshold = (next.tasksDone ?? 0) + rollThreshold()
  delete next.show
  writeState(next)
  return pickCopy()
}

/** 触发后被放弃（用户正在打字等）：只重掷门槛不动计数，本回合绝不弹 */
export function withAbandoned(state = readState(), now = Date.now()) {
  const next = { ...state }
  next.nextThreshold = (next.tasksDone ?? 0) + 1 // 下次任务完成再裁决
  delete next.show
  writeState(next)
  return next
}

/**
 * 用户表态。
 * @param {'supported'|'later'|'never'} kind supported=已支持（仅缩短冷却语义，仍受 MIN_GAP_MS 约束）；
 *   later=以后再说（30 天静默）；never=不再提示（永久关闭）
 */
export function resolveTipJar(kind = 'later') {
  const state = readState()
  const next = { ...state }
  if (kind === 'never') next.disabledForever = true
  else if (kind === 'later') next.snoozedUntil = Date.now() + SNOOZE_MS
  // supported：不额外处理，MIN_GAP_MS 已保证节奏
  writeState(next)
}

/** 是否已永久关闭（供设置页读取） */
export function isTipJarDisabledForever() {
  return readState().disabledForever === true
}

/** 供设置页/调试：恢复展示资格（清除永久关闭） */
export function enableTipJar() {
  const next = { ...readState(), disabledForever: undefined }
  writeState(next)
}
