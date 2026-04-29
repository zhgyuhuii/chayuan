/**
 * failureCluster - 失败信号聚类
 *
 * 把 SignalStore 里的失败信号按模式归组,产出"失败证据包"供候选生成器消费。
 *
 * 两阶段聚类:
 *   1. 规则聚类(零成本):按 failureCode + signal.type 直接 groupBy
 *   2. 二级 LLM 标签(可选,小模型):规则聚类后大组(>=5)进一步打标签
 *      标签例:'lost-honorific','json-parse-fail','over-rewrite','hallucination',...
 *
 * 输出:数组 [{ assistantId, cluster, count, samples, firstSeen, lastSeen, ... }]
 */

import { listSignalsByAssistant } from './signalStore.js'

const DEFAULT_WINDOW_DAYS = 7
const MIN_CLUSTER_SIZE = 3
const MAX_SAMPLES_PER_CLUSTER = 20

function safeNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function safeString(value, fallback = '') {
  const s = String(value ?? '').trim()
  return s || fallback
}

/**
 * 判断一条 signal 是否算"失败"。
 *   reject(被撤销)
 *   task 且 success=false
 *   thumbs 且 metadata.value=down
 *   audit 且 status=denied/failed
 */
export function isFailure(signal) {
  if (!signal) return false
  if (signal.type === 'reject') return true
  if (signal.type === 'task' && signal.success === false) return true
  if (signal.type === 'thumbs' && signal.metadata?.value === 'down') return true
  if (signal.type === 'audit' && (signal.metadata?.status === 'denied' || signal.metadata?.status === 'failed')) return true
  return false
}

function groupBy(arr, keyFn) {
  const map = new Map()
  for (const item of arr) {
    const k = String(keyFn(item) || '_unknown')
    const list = map.get(k) || []
    list.push(item)
    map.set(k, list)
  }
  return map
}

/**
 * 规则聚类的"标签生成":根据 signal 的属性产出可读 cluster key。
 */
function ruleBasedClusterKey(signal) {
  // 高优先级:有明确 failureCode 的
  if (signal.failureCode) return `code:${signal.failureCode}`

  // 撤销 + 用户备注 = "user-rejected:$shortNote"
  if (signal.type === 'reject' && signal.userNote) {
    const short = signal.userNote.replace(/\s+/g, ' ').slice(0, 24)
    return `rejected:${short}`
  }
  if (signal.type === 'reject') return 'rejected:no-reason'

  // thumbs down + note
  if (signal.type === 'thumbs' && signal.metadata?.value === 'down' && signal.userNote) {
    const short = signal.userNote.replace(/\s+/g, ' ').slice(0, 24)
    return `thumbs-down:${short}`
  }
  if (signal.type === 'thumbs' && signal.metadata?.value === 'down') return 'thumbs-down:no-reason'

  // 任务失败但无 code:用降级标志区分
  if (signal.type === 'task' && signal.success === false) {
    if (signal.metadata?.downgraded === true) return 'task-downgraded'
    if (signal.metadata?.timeout === true) return 'task-timeout'
    return 'task-failed-other'
  }

  // 审计拒绝
  if (signal.type === 'audit') {
    return `audit:${signal.metadata?.status || 'unknown'}`
  }

  return '_unknown'
}

/**
 * 主入口:对单个助手做聚类。
 *
 *   options:
 *     days:           滚动窗口天数,默认 7
 *     minSize:        最小成簇大小,默认 3
 *     maxSamples:     每簇最多样本数,默认 20
 *     llmRefine:      可选 async (cluster, samples) => labelRecords[]
 *                     仅当 cluster >= 5 时调用,产出更细的二级标签
 *
 *   返回: cluster 数组,按 count 降序
 */
export async function clusterFailuresForAssistant(assistantId, options = {}) {
  const id = safeString(assistantId)
  if (!id) return []
  const days = safeNumber(options.days, DEFAULT_WINDOW_DAYS)
  const minSize = safeNumber(options.minSize, MIN_CLUSTER_SIZE)
  const maxSamples = safeNumber(options.maxSamples, MAX_SAMPLES_PER_CLUSTER)

  const signals = listSignalsByAssistant(id, { days })
  const failures = signals.filter(isFailure)
  if (failures.length < minSize) return []

  // 阶段 1:规则聚类
  const ruleGroups = groupBy(failures, ruleBasedClusterKey)
  const clusters = []

  for (const [clusterKey, group] of ruleGroups) {
    if (group.length < minSize) continue

    // 阶段 2(可选):大组用 LLM 二级细分
    let subClusters = [{ key: clusterKey, samples: group }]
    if (typeof options.llmRefine === 'function' && group.length >= 5) {
      try {
        const refined = await options.llmRefine(clusterKey, group)
        if (Array.isArray(refined) && refined.length > 0) {
          subClusters = refined
            .map(item => ({
              key: `${clusterKey}/${safeString(item.label, 'subgroup')}`,
              samples: Array.isArray(item.samples) ? item.samples : []
            }))
            .filter(sc => sc.samples.length >= 1)
        }
      } catch (e) {
        // 退化到只用规则聚类
      }
    }

    for (const sc of subClusters) {
      const samples = sc.samples
      if (samples.length < minSize) continue
      const sorted = samples.sort((a, b) => b.timestamp - a.timestamp)
      clusters.push({
        assistantId: id,
        cluster: sc.key,
        count: samples.length,
        samples: sorted.slice(0, maxSamples),
        firstSeen: Math.min(...samples.map(s => s.timestamp)),
        lastSeen: Math.max(...samples.map(s => s.timestamp)),
        windowDays: days,
        signalTypes: Array.from(new Set(samples.map(s => s.type)))
      })
    }
  }

  return clusters.sort((a, b) => b.count - a.count)
}

/**
 * 把聚类结果包装成"失败证据包",供候选生成器消费。
 *
 *   options:
 *     anchorPrompt: anchorPrompt 对象,会带进证据包给 LLM 看(强约束)
 *     totalCalls:   过去 windowDays 内所有任务调用数(用于算 rejectionRate)
 *     raceBefore:   当前版本 RACE 健康分(供候选了解差距)
 *
 *   返回: 证据包数组,每个 cluster 一个
 */
export function buildEvidencePackages(clusters, options = {}) {
  return clusters.map(cluster => ({
    assistantId: cluster.assistantId,
    currentVersion: safeString(options.currentVersion, '1.0.0'),
    failureCluster: cluster.cluster,
    windowDays: cluster.windowDays,
    samples: cluster.samples.map(s => ({
      id: s.id,
      type: s.type,
      version: s.version,
      timestamp: s.timestamp,
      taskId: s.taskId,
      duration: s.duration,
      tokens: s.tokens,
      failureCode: s.failureCode,
      userNote: s.userNote,
      documentAction: s.documentAction
      // 注意:不导出 inputHash/outputHash,给 LLM 看也没意义
      // 真实原文需要从 taskListStore 按 taskId 查 + 脱敏后再带入
    })),
    metrics: {
      count: cluster.count,
      firstSeen: new Date(cluster.firstSeen).toISOString(),
      lastSeen: new Date(cluster.lastSeen).toISOString(),
      rejectionRate: options.totalCalls > 0
        ? cluster.count / options.totalCalls
        : null,
      raceBefore: options.raceBefore || null
    },
    anchorPrompt: options.anchorPrompt || null
  }))
}

/**
 * 计算"是否需要进化建议"的决策。
 *
 *   options:
 *     failureRateThreshold: 低于此比例认为不需要,默认 0.05
 *     criticalRateThreshold: 高于此比例视为紧急,默认 0.15
 *
 *   返回: { propose, urgency, totalFailures, totalSignals, rate, clusters }
 */
export async function shouldProposeEvolution(assistantId, options = {}) {
  const days = safeNumber(options.days, DEFAULT_WINDOW_DAYS)
  const signals = listSignalsByAssistant(assistantId, { days })
  const failures = signals.filter(isFailure)
  const total = signals.length
  const rate = total > 0 ? failures.length / total : 0

  const lowThreshold = safeNumber(options.failureRateThreshold, 0.05)
  const highThreshold = safeNumber(options.criticalRateThreshold, 0.15)

  if (total < 10) {
    return { propose: false, urgency: 'none', reason: '信号样本不足', totalFailures: failures.length, totalSignals: total, rate, clusters: [] }
  }
  if (rate < lowThreshold) {
    return { propose: false, urgency: 'none', reason: '失败率低于阈值', totalFailures: failures.length, totalSignals: total, rate, clusters: [] }
  }

  const clusters = await clusterFailuresForAssistant(assistantId, options)
  if (clusters.length === 0) {
    return { propose: false, urgency: 'none', reason: '失败模式分散无聚类', totalFailures: failures.length, totalSignals: total, rate, clusters: [] }
  }

  const urgency = rate >= highThreshold ? 'high' : 'normal'
  return {
    propose: true,
    urgency,
    reason: urgency === 'high' ? '失败率超出关键阈值' : '失败聚类清晰,建议进化',
    totalFailures: failures.length,
    totalSignals: total,
    rate,
    clusters
  }
}

export default {
  isFailure,
  clusterFailuresForAssistant,
  buildEvidencePackages,
  shouldProposeEvolution
}
