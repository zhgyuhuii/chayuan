/**
 * workflowDiff — 工作流版本化 + diff(W5.4)
 *
 * 实现:
 *   - semverCompare(a, b)
 *   - bumpVersion(version, level='patch')
 *   - diffWorkflows(oldWf, newWf) → 节点 / 边 / 配置 的 added / removed / changed
 */

const DEFAULT_VERSION = '0.0.1'

export function parseSemver(s) {
  const m = String(s || '').match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/)
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] || ''
  }
}

export function semverCompare(a, b) {
  const pa = parseSemver(a) || parseSemver(DEFAULT_VERSION)
  const pb = parseSemver(b) || parseSemver(DEFAULT_VERSION)
  if (pa.major !== pb.major) return pa.major - pb.major
  if (pa.minor !== pb.minor) return pa.minor - pb.minor
  if (pa.patch !== pb.patch) return pa.patch - pb.patch
  // prerelease:有 prerelease 的版本 < 无 prerelease
  if (pa.prerelease && !pb.prerelease) return -1
  if (!pa.prerelease && pb.prerelease) return 1
  return 0
}

export function bumpVersion(version, level = 'patch') {
  const p = parseSemver(version) || parseSemver(DEFAULT_VERSION)
  if (level === 'major') return `${p.major + 1}.0.0`
  if (level === 'minor') return `${p.major}.${p.minor + 1}.0`
  return `${p.major}.${p.minor}.${p.patch + 1}`
}

/**
 * 计算两个工作流的差异。
 * 返回:
 *   {
 *     nodesAdded: [{ id, type }],
 *     nodesRemoved: [{ id, type }],
 *     nodesChanged: [{ id, oldConfig, newConfig, configDiff }],
 *     edgesAdded: [...],
 *     edgesRemoved: [...],
 *     metaChanged: { name?, description?, version? }
 *   }
 */
export function diffWorkflows(oldWf, newWf) {
  const oldNodes = new Map((oldWf?.nodes || []).map(n => [n.id, n]))
  const newNodes = new Map((newWf?.nodes || []).map(n => [n.id, n]))

  const nodesAdded = []
  const nodesRemoved = []
  const nodesChanged = []

  for (const [id, n] of newNodes) {
    if (!oldNodes.has(id)) {
      nodesAdded.push({ id, type: n.type })
    } else {
      const oldNode = oldNodes.get(id)
      const oldCfg = oldNode.config || oldNode.payload || {}
      const newCfg = n.config || n.payload || {}
      if (JSON.stringify(oldCfg) !== JSON.stringify(newCfg)) {
        nodesChanged.push({
          id,
          type: n.type,
          oldConfig: oldCfg,
          newConfig: newCfg,
          configDiff: shallowDiff(oldCfg, newCfg)
        })
      }
    }
  }
  for (const [id, n] of oldNodes) {
    if (!newNodes.has(id)) nodesRemoved.push({ id, type: n.type })
  }

  // edges:用 source-target 作 key
  const edgeKey = e => `${e.source}->${e.target}`
  const oldEdges = new Map((oldWf?.edges || []).map(e => [edgeKey(e), e]))
  const newEdges = new Map((newWf?.edges || []).map(e => [edgeKey(e), e]))
  const edgesAdded = []
  const edgesRemoved = []
  for (const [k, e] of newEdges) if (!oldEdges.has(k)) edgesAdded.push(e)
  for (const [k, e] of oldEdges) if (!newEdges.has(k)) edgesRemoved.push(e)

  // meta
  const metaChanged = {}
  for (const key of ['name', 'description', 'version', 'category']) {
    if ((oldWf?.[key] || '') !== (newWf?.[key] || '')) {
      metaChanged[key] = { from: oldWf?.[key], to: newWf?.[key] }
    }
  }

  return {
    nodesAdded,
    nodesRemoved,
    nodesChanged,
    edgesAdded,
    edgesRemoved,
    metaChanged,
    summary: summarizeDiff(nodesAdded, nodesRemoved, nodesChanged, edgesAdded, edgesRemoved)
  }
}

function shallowDiff(a, b) {
  const out = {}
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  for (const k of keys) {
    if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) {
      out[k] = { from: a?.[k], to: b?.[k] }
    }
  }
  return out
}

function summarizeDiff(na, nr, nc, ea, er) {
  const parts = []
  if (na.length) parts.push(`+${na.length} 节点`)
  if (nr.length) parts.push(`-${nr.length} 节点`)
  if (nc.length) parts.push(`~${nc.length} 节点改配置`)
  if (ea.length) parts.push(`+${ea.length} 边`)
  if (er.length) parts.push(`-${er.length} 边`)
  return parts.join(' · ') || '无变化'
}

/**
 * 推断 diff 影响的版本级别(patch/minor/major)。
 *   - 任一节点删除 / type 变化 → major
 *   - 节点 / 边新增 → minor
 *   - 仅 config / meta 微调 → patch
 */
export function recommendBump(diff) {
  if (diff.nodesRemoved.length > 0) return 'major'
  if (diff.nodesChanged.some(c => c.configDiff?.type)) return 'major'
  if (diff.nodesAdded.length > 0 || diff.edgesAdded.length > 0) return 'minor'
  if (diff.edgesRemoved.length > 0) return 'minor'
  return 'patch'
}

export default {
  parseSemver,
  semverCompare,
  bumpVersion,
  diffWorkflows,
  recommendBump
}
