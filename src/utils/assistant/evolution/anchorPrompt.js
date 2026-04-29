/**
 * anchorPrompt - 助手原始意图锚
 *
 * 多次进化会让助手悄悄偏离最初设计意图(prompt drift)。
 * 解决方案:每个助手定义一个不可随版本更改的 anchorPrompt,
 * 候选生成时强约束在 anchor 边界内,晋升前检测 driftScore。
 *
 * 与版本(version)的关系:
 *   - version 是可变的,每次进化都会涨
 *   - anchorPrompt 是只读的,只能通过"重置到 anchor"特殊路径恢复
 */

const STORAGE_KEY = 'chayuan/v2/assistantAnchorStore'

import { loadGlobalSettings, saveGlobalSettings } from '../../globalSettings.js'

function safeString(value, fallback = '') {
  const s = String(value ?? '').trim()
  return s || fallback
}

function loadStore() {
  const settings = loadGlobalSettings()
  const raw = settings?.[STORAGE_KEY]
  return raw && typeof raw === 'object' ? raw : {}
}

function saveStore(store) {
  saveGlobalSettings({ [STORAGE_KEY]: store })
}

/**
 * 注册助手的原始意图锚。第一次创建助手时调用,**仅一次**。
 * 已存在的 anchor 不会被覆盖,除非传 force=true(用户主动"重置 anchor")。
 */
export function registerAnchor(assistantId, anchor, options = {}) {
  const id = safeString(assistantId)
  if (!id) return null
  const store = loadStore()
  if (store[id] && options.force !== true) {
    return store[id]
  }
  const record = {
    assistantId: id,
    systemPrompt: safeString(anchor?.systemPrompt),
    userPromptTemplate: safeString(anchor?.userPromptTemplate),
    intentDescription: safeString(anchor?.intentDescription),
    capabilityBoundary: Array.isArray(anchor?.capabilityBoundary)
      ? anchor.capabilityBoundary.map(item => safeString(item)).filter(Boolean)
      : [],
    forbiddenBehaviors: Array.isArray(anchor?.forbiddenBehaviors)
      ? anchor.forbiddenBehaviors.map(item => safeString(item)).filter(Boolean)
      : [],
    expectedOutputFormat: safeString(anchor?.expectedOutputFormat),
    locale: safeString(anchor?.locale, 'zh-CN'),
    createdAt: store[id]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  store[id] = record
  saveStore(store)
  return record
}

export function getAnchor(assistantId) {
  const id = safeString(assistantId)
  if (!id) return null
  return loadStore()[id] || null
}

export function listAnchors() {
  return Object.values(loadStore())
}

/**
 * 用户主动"重置到 anchor":返回 anchor 对象,由调用方决定如何把
 * 当前助手 systemPrompt/userPromptTemplate 改写回去。
 */
export function resolveResetSnapshot(assistantId) {
  const anchor = getAnchor(assistantId)
  if (!anchor) return null
  return {
    systemPrompt: anchor.systemPrompt,
    userPromptTemplate: anchor.userPromptTemplate,
    expectedOutputFormat: anchor.expectedOutputFormat
  }
}

/**
 * 生成 candidate 时附加的强约束 prompt 片段,可拼接到 candidateGenerator 的 system 提示词。
 */
export function buildAnchorConstraintPrompt(anchor) {
  if (!anchor) return ''
  const lines = ['【原始意图锚】候选必须保留以下边界,不允许扩张职责:']
  if (anchor.intentDescription) lines.push(`- 设计意图:${anchor.intentDescription}`)
  if (anchor.capabilityBoundary?.length) {
    lines.push('- 能力范围:')
    for (const item of anchor.capabilityBoundary) lines.push(`  · ${item}`)
  }
  if (anchor.forbiddenBehaviors?.length) {
    lines.push('- 禁止行为:')
    for (const item of anchor.forbiddenBehaviors) lines.push(`  · ${item}`)
  }
  if (anchor.expectedOutputFormat) {
    lines.push(`- 期望输出格式:${anchor.expectedOutputFormat}`)
  }
  return lines.join('\n')
}

/**
 * driftScore - 简易启发式:候选 vs anchor 系统提示词的 token 差异 + 长度差异。
 * 真正的 drift 检测应在 P3 用 LLM 二次判定,这里先给出 0-100 的粗值。
 */
export function computeDriftScore(candidate, assistantId) {
  const anchor = getAnchor(assistantId)
  if (!anchor) return 0

  const cand = safeString(candidate?.systemPrompt) + '\n' + safeString(candidate?.userPromptTemplate)
  const ank = anchor.systemPrompt + '\n' + anchor.userPromptTemplate
  if (!cand || !ank) return 0

  const tokenize = s => Array.from(new Set(s.toLowerCase().match(/[一-龥a-z0-9]{2,}/g) || []))
  const tCand = tokenize(cand)
  const tAnk = tokenize(ank)
  const setAnk = new Set(tAnk)
  const inter = tCand.filter(t => setAnk.has(t)).length
  const overlap = inter / Math.max(1, Math.min(tCand.length, tAnk.length))
  const overlapDrift = (1 - overlap) * 60   // 词汇 drift,最大贡献 60

  const lenDiff = Math.abs(cand.length - ank.length) / Math.max(ank.length, 1)
  const lenDrift = Math.min(40, lenDiff * 40)   // 长度 drift,最大 40

  return Math.round(Math.min(100, overlapDrift + lenDrift))
}

export const DRIFT_THRESHOLD = 30   // 高于此值标记为 drift,禁止自动晋升

export function isDrifted(candidate, assistantId, threshold = DRIFT_THRESHOLD) {
  const score = computeDriftScore(candidate, assistantId)
  return { drifted: score > threshold, score }
}

export default {
  registerAnchor,
  getAnchor,
  listAnchors,
  resolveResetSnapshot,
  buildAnchorConstraintPrompt,
  computeDriftScore,
  isDrifted,
  DRIFT_THRESHOLD
}
