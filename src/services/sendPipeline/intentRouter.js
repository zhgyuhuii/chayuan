import { classifyIntent, isHighConfidence } from '../../utils/router/localIntentClassifier.js'

const MODEL_ROUTE_CACHE_TTL_MS = 2 * 60 * 1000
const MODEL_ROUTE_CACHE_MAX = 80
const modelRouteCache = new Map()

function normalizeConfidence(value = '') {
  const confidence = String(value || '').trim().toLowerCase()
  return ['high', 'medium', 'low'].includes(confidence) ? confidence : 'low'
}

function normalizeIntent(value = {}, fallbackKind = 'chat') {
  return {
    kind: String(value?.kind || fallbackKind || 'chat').trim() || 'chat',
    confidence: normalizeConfidence(value?.confidence),
    reason: String(value?.reason || '').trim()
  }
}

function normalizeTextForCache(text = '') {
  return String(text || '').trim().replace(/\s+/g, ' ').slice(0, 2000)
}

export function buildModelRouteCacheKey(text = '', options = {}) {
  const modelKey = [
    options.providerId || '',
    options.modelId || ''
  ].join('/')
  const attachmentSig = (Array.isArray(options.attachments) ? options.attachments : [])
    .map(item => `${String(item?.name || '').trim()}:${Number(item?.size || item?.content?.length || 0)}`)
    .join('|')
  return [
    modelKey,
    options.hasSelection === true ? 'sel:1' : 'sel:0',
    attachmentSig,
    normalizeTextForCache(text)
  ].join('\n')
}

export function getCachedModelRouteIntent(text = '', options = {}) {
  const key = buildModelRouteCacheKey(text, options)
  const hit = modelRouteCache.get(key)
  if (!hit) return null
  if (Date.now() - Number(hit.at || 0) > MODEL_ROUTE_CACHE_TTL_MS) {
    modelRouteCache.delete(key)
    return null
  }
  return {
    ...hit.intent,
    reason: [hit.intent?.reason, '命中短期路由缓存。'].filter(Boolean).join(' '),
    cacheHit: true
  }
}

export function setCachedModelRouteIntent(text = '', intent = {}, options = {}) {
  const key = buildModelRouteCacheKey(text, options)
  modelRouteCache.set(key, {
    at: Date.now(),
    intent: normalizeIntent(intent)
  })
  while (modelRouteCache.size > MODEL_ROUTE_CACHE_MAX) {
    const firstKey = modelRouteCache.keys().next().value
    if (!firstKey) break
    modelRouteCache.delete(firstKey)
  }
}

export function clearModelRouteCache() {
  modelRouteCache.clear()
}

export function resolveLocalIntentShortcut(text = '', options = {}) {
  const ruleIntent = normalizeIntent(options.ruleIntent)
  if (ruleIntent.confidence === 'high') {
    return {
      ...ruleIntent,
      shortcut: 'rule-high-confidence',
      reason: [ruleIntent.reason, '本地规则高置信，已跳过模型路由。'].filter(Boolean).join(' ')
    }
  }

  const localIntent = classifyIntent(text, {
    hasSelection: options.hasSelection === true,
    attachments: Array.isArray(options.attachments) ? options.attachments : []
  })
  if (isHighConfidence(localIntent)) {
    return {
      kind: String(localIntent.kind || 'chat').trim() || 'chat',
      confidence: 'high',
      reason: [
        localIntent.reason,
        localIntent.subKind ? `本地子类型：${localIntent.subKind}` : '',
        '本地分类器高置信，已跳过模型路由。'
      ].filter(Boolean).join(' '),
      shortcut: 'classifier-high-confidence',
      localIntent
    }
  }

  return {
    ...ruleIntent,
    shortcut: '',
    localIntent
  }
}

export default {
  resolveLocalIntentShortcut,
  buildModelRouteCacheKey,
  getCachedModelRouteIntent,
  setCachedModelRouteIntent,
  clearModelRouteCache
}
