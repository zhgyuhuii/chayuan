/**
 * workflowShare — 工作流 export / import + 签名(W5.2)
 *
 * 沿用 marketplaceCryptoSigner 的 HMAC / Ed25519 验签机制。
 * 导出 / 导入格式与 P5 teamShare 一致(formatVersion=1)。
 */

import { signHmac, verifyPackage } from '../assistant/marketplaceCryptoSigner.js'

const FORMAT_VERSION = 1
const SHARE_PREFIX = 'chayuan://install?wf='

export function exportWorkflowJSON(workflow, options = {}) {
  if (!workflow?.id) throw new Error('exportWorkflowJSON: workflow.id 必填')
  const safe = {
    formatVersion: FORMAT_VERSION,
    kind: 'workflow',
    exportedAt: new Date().toISOString(),
    publisher: options.publisher || 'local',
    workflow: {
      id: String(workflow.id),
      name: String(workflow.name || ''),
      description: String(workflow.description || ''),
      version: String(workflow.version || '1.0.0'),
      category: workflow.category || '',
      tags: Array.isArray(workflow.tags) ? workflow.tags : [],
      nodes: workflow.nodes || [],
      edges: workflow.edges || [],
      variables: workflow.variables || {}
    }
  }
  return JSON.stringify(safe, null, 2)
}

export async function exportSignedWorkflow(workflow, hmacSecret, options = {}) {
  const json = exportWorkflowJSON(workflow, options)
  const parsed = JSON.parse(json)
  const signature = await signHmac(parsed, hmacSecret)
  parsed.signature = signature
  parsed.signatureType = 'hmac'
  return JSON.stringify(parsed, null, 2)
}

export async function importWorkflowJSON(jsonStr, options = {}) {
  let parsed
  try { parsed = JSON.parse(jsonStr) }
  catch (e) { return { ok: false, error: `JSON 解析失败: ${e.message}` } }

  if (parsed?.formatVersion !== FORMAT_VERSION) {
    return { ok: false, error: `不支持的 formatVersion: ${parsed?.formatVersion}` }
  }
  if (parsed?.kind !== 'workflow') {
    return { ok: false, error: `非 workflow 包(kind=${parsed?.kind})` }
  }

  // 验签(若包带 signature)
  if (parsed.signature && options.hmacSecret) {
    const v = await verifyPackage(parsed, { hmacSecret: options.hmacSecret })
    if (!v.ok && options.skipSignatureCheck !== true) {
      return { ok: false, error: `验签失败: ${v.error}` }
    }
  } else if (parsed.signature && options.publisherPubKey) {
    const v = await verifyPackage(parsed, { publisherPubKey: options.publisherPubKey })
    if (!v.ok && options.skipSignatureCheck !== true) {
      return { ok: false, error: `验签失败: ${v.error}` }
    }
  }

  const wf = parsed.workflow
  if (!wf?.id || !Array.isArray(wf.nodes)) {
    return { ok: false, error: 'workflow 字段缺失或损坏' }
  }
  // 注入元数据
  if (options.namespacePrefix) {
    wf.id = `${options.namespacePrefix}${wf.id}`
  }
  wf._imported = {
    publisher: parsed.publisher || 'unknown',
    importedAt: new Date().toISOString(),
    signed: !!parsed.signature
  }
  return { ok: true, workflow: wf }
}

/**
 * 生成 deeplink 字符串(chayuan://install?wf=...)。
 */
export function buildShareLink(workflow, options = {}) {
  const json = exportWorkflowJSON(workflow, options)
  const b64 = (typeof btoa !== 'undefined')
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, 'utf-8').toString('base64')
  return `${SHARE_PREFIX}${b64}`
}

export function parseShareLink(link) {
  const s = String(link || '').trim()
  if (!s.startsWith(SHARE_PREFIX)) return null
  const b64 = s.slice(SHARE_PREFIX.length)
  try {
    const json = (typeof atob !== 'undefined')
      ? decodeURIComponent(escape(atob(b64)))
      : Buffer.from(b64, 'base64').toString('utf-8')
    return JSON.parse(json)
  } catch { return null }
}

export default {
  exportWorkflowJSON,
  exportSignedWorkflow,
  importWorkflowJSON,
  buildShareLink,
  parseShareLink
}
