/**
 * rolloutBucketing — 灰度分桶机制(5% → 25% → 50% → 100%)
 *
 * v2 计划 P5「灰度分桶上线」。一个候选不是直接 100% 启用,而是:
 *   stage 0:  5%  → 跑 N 小时无 breach → 进 stage 1
 *   stage 1: 25%
 *   stage 2: 50%
 *   stage 3: 100%
 *
 * 「桶」用 djb2 hash on assistantId+userKey 决定;同一 user 在同一 assistant 上桶号稳定。
 * 任何 stage 出现 breach(回滚条件)→ 立即回到上一 stage 或终止。
 *
 * 持久到 localStorage。
 */

import { loadGlobalSettings, saveGlobalSettings } from '../../globalSettings.js'

const KEY = 'rolloutBuckets'
const STAGES = Object.freeze([5, 25, 50, 100])
const DEFAULT_STAGE_HOURS = 6

function load() {
  const s = loadGlobalSettings()
  return s[KEY] && typeof s[KEY] === 'object' ? s[KEY] : {}
}
function save(map) { saveGlobalSettings({ [KEY]: map }) }
function ensure(map, key) {
  if (!map[key]) map[key] = { stage: 0, enteredAt: Date.now(), promotionCount: 0 }
  return map[key]
}

/* ────────── hash ────────── */

function djb2(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * 给定 assistantId + userKey,返回 0..99 的桶号(稳定)。
 */
export function getBucket(assistantId, userKey = 'default') {
  return djb2(`${assistantId}|${userKey}`) % 100
}

/* ────────── 状态 ────────── */

/**
 * 当前某个 candidate 的灰度状态。
 *   返回:{ stage, enteredAt, percentage, promotionCount }
 */
export function getRolloutStatus(assistantId, candidateVersionId) {
  const key = `${assistantId}|${candidateVersionId}`
  const map = load()
  const e = map[key] || { stage: 0, enteredAt: Date.now(), promotionCount: 0 }
  return {
    stage: e.stage,
    enteredAt: e.enteredAt,
    percentage: STAGES[e.stage] ?? 100,
    promotionCount: e.promotionCount,
    nextThreshold: STAGES[e.stage + 1] || null
  }
}

/**
 * 判断当前用户是否在该 candidate 的灰度命中范围。
 *   userKey:稳定用户标识(machine id / user id 等)
 */
export function isUserInRollout(assistantId, candidateVersionId, userKey = 'default') {
  const status = getRolloutStatus(assistantId, candidateVersionId)
  const bucket = getBucket(assistantId, userKey)
  return bucket < status.percentage
}

/**
 * 评估是否可以晋升到下一 stage。
 *   options.minHoursAtStage  当前 stage 至少待多久(默认 6 小时)
 *   options.breach           是否检测到 breach(若 true 立即降级)
 *   返回:{ action: 'advance'|'hold'|'rollback', newStage, reason }
 */
export function evaluateRollout(assistantId, candidateVersionId, options = {}) {
  const key = `${assistantId}|${candidateVersionId}`
  const map = load()
  const e = ensure(map, key)
  const minHours = Number(options.minHoursAtStage) || DEFAULT_STAGE_HOURS
  const ageH = (Date.now() - e.enteredAt) / 3600_000

  if (options.breach === true) {
    if (e.stage > 0) {
      e.stage -= 1
      e.enteredAt = Date.now()
      save(map)
      return { action: 'rollback', newStage: e.stage, reason: 'breach detected' }
    }
    // 在 stage 0 还 breach → 删除整个记录(终止 rollout)
    delete map[key]
    save(map)
    return { action: 'rollback', newStage: -1, reason: 'breach at stage 0 → terminate' }
  }

  if (e.stage >= STAGES.length - 1) {
    return { action: 'hold', newStage: e.stage, reason: 'already at 100%' }
  }
  if (ageH < minHours) {
    return { action: 'hold', newStage: e.stage, reason: `等待中(${ageH.toFixed(1)}/${minHours}h)` }
  }

  e.stage += 1
  e.enteredAt = Date.now()
  e.promotionCount += 1
  save(map)
  return { action: 'advance', newStage: e.stage, reason: `passed stage hold,now ${STAGES[e.stage]}%` }
}

/**
 * 直接清掉某个 candidate 的 rollout 记录(用户驳回 / 被自动回滚 等)。
 */
export function clearRollout(assistantId, candidateVersionId) {
  const key = `${assistantId}|${candidateVersionId}`
  const map = load()
  if (map[key]) {
    delete map[key]
    save(map)
    return true
  }
  return false
}

export function listAllRollouts() {
  const map = load()
  return Object.entries(map).map(([key, e]) => {
    const [assistantId, candidateVersionId] = key.split('|')
    return {
      assistantId,
      candidateVersionId,
      stage: e.stage,
      percentage: STAGES[e.stage] ?? 100,
      enteredAt: e.enteredAt,
      promotionCount: e.promotionCount
    }
  })
}

export const STAGES_PCT = STAGES

export default {
  getBucket,
  getRolloutStatus,
  isUserInRollout,
  evaluateRollout,
  clearRollout,
  listAllRollouts,
  STAGES_PCT
}
