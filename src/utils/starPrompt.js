/**
 * 「去 GitHub 点 Star」提示 — 生命周期状态机。
 *
 * 移植自 chayuan-office apps/shell/src/main/star-prompt.ts（同作者姐妹项目），
 * 语义保持一致：
 *   - 只有用户已从产品中获得价值后才出现（对话页打开 ≥ MIN_OPENS 次）
 *   - 终身最多展示 MAX_SHOWS 次；「以后再说」后至少静默 RESHOW_AFTER_MS
 *   - 任何明确表态（去点 Star / 已经点过）永久解决，绝不再打扰
 *   - GitHub 是否真的点了 Star 无法无 OAuth 检测 —— 打开仓库页即视为已处理，
 *     永不追问一个很可能已经点过的人
 *
 * 持久化：localStorage `nd_github_star_prompt`（加载项各 webview 同源共享）。
 */

const STORAGE_KEY = 'nd_github_star_prompt'

/** 对话页打开次数达到门槛后才首次出现 */
export const MIN_OPENS = 3
/** 终身最多展示次数 */
export const MAX_SHOWS = 2
/** 「以后再说」后的最短静默期 */
export const RESHOW_AFTER_MS = 14 * 24 * 60 * 60 * 1000

export const GITHUB_REPO_URL = 'https://github.com/zhgyuhuii/chayuan'

/** @typedef {{chatOpens?: number, shownCount?: number, lastShownAt?: number, resolved?: 'starred'|'dismissed'|boolean}} StarPromptState */

/** 容忍损坏/缺字段的存量数据 */
export function asStarPromptState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const raw = value
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined)
  return {
    chatOpens: num(raw.chatOpens),
    shownCount: num(raw.shownCount),
    lastShownAt: num(raw.lastShownAt),
    resolved: raw.resolved === true || raw.resolved === 'starred'
      ? 'starred'
      : (raw.resolved === 'dismissed' ? 'dismissed' : undefined)
  }
}

/** 对话页打开：向价值时刻门槛累计；已点赞解决或达展示上限后不再计数 */
export function withChatOpen(state) {
  if (state.resolved === 'starred' || (state.shownCount ?? 0) >= MAX_SHOWS) return state
  return { ...state, chatOpens: (state.chatOpens ?? 0) + 1 }
}

export function shouldShowStarPrompt(state, now = Date.now()) {
  // 只有「已点赞」永久解决；「以后再说」只静默 RESHOW_AFTER_MS
  if (state.resolved === 'starred') return false
  const shown = state.shownCount ?? 0
  if (shown >= MAX_SHOWS) return false
  if ((state.chatOpens ?? 0) < MIN_OPENS) return false
  if (shown > 0 && now - (state.lastShownAt ?? 0) < RESHOW_AFTER_MS) return false
  return true
}

/** 本次已展示：计数 + 时间戳（与 shouldShow 配对调用） */
export function withShown(state, now = Date.now()) {
  return {
    ...state,
    shownCount: (state.shownCount ?? 0) + 1,
    lastShownAt: now
  }
}

/** 明确表态（去点 Star / 已经点过）→ 永久解决 */
export function withResolved(state, kind = 'starred') {
  return { ...state, resolved: kind === 'dismissed' ? 'dismissed' : 'starred' }
}

/* ── 存储适配（webview） ── */

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return asStarPromptState(raw ? JSON.parse(raw) : null)
  } catch {
    return {}
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* quota 等异常忽略 */ }
}

/**
 * 对话页打开时调用：计数并返回当前是否应展示提示。
 * @returns {{show: boolean, chatOpens: number}}
 */
export function recordDialogOpen() {
  let state = readState()
  state = withChatOpen(state)
  writeState(state)
  return { show: shouldShowStarPrompt(state), chatOpens: state.chatOpens ?? 0 }
}

/** 展示时落「已展示」计数 */
export function markShown() {
  writeState(withShown(readState()))
}

/**
 * 用户表态。
 * @param {'starred'|'dismissed'} kind starred=已点赞（永久解决+感谢态），dismissed=以后再说（静默 14 天）
 */
export function resolveStarPrompt(kind = 'starred') {
  writeState(withResolved(readState(), kind))
}

/** 是否已点赞解决（用于常驻微标「已点赞支持开源 ⭐」） */
export function isStarredResolved() {
  return readState().resolved === 'starred'
}
