/**
 * 文档会话作用域（纯函数）：历史跟随文件的键控决策层。
 *
 * 背景（真机缺陷："打开文档历史对话丢失"）：
 * - 旧实现在 scope 解析路径上写入文档身份（变量/标签/名称）——身份只活在内存，
 *   用户不保存就关文档，重开即生成新身份 → scope 键漂移 → 历史失联。
 * - 本模块把解析改成【只读】：身份存在就用，不存在就落到稳定键
 *   （path_/name_），绝不产生写副作用。身份改由发消息时懒嵌入
 *   （ensureDocumentChatLinkId），用户此后任意一次保存都让身份随文件落盘。
 * - 键优先级：doc_<linkId>（随文件走：另存/改名/拷贝天然跟随）
 *   → path_<FullName>（同路径重开稳定）→ name_<Name> → no_active_document。
 * - 采纳探针（computeFallbackScopeKeys）：当前键无历史时，按身份优先级的
 *   低位找同文档旧键（升级搁浅的 path_/name_ 历史、身份翻转前的历史），
 *   只向下探、不做跨文件合并。
 */
import { readDocumentChatLinkId } from '../documentIdentity.js'

/** 宿主感知取活动对象：Writer=ActiveDocument，表格=ActiveWorkbook，演示=ActivePresentation。
 *  逐项 try：部分宿主访问非本宿主的活动对象属性会抛 COM 异常而非返回 undefined。 */
export function getActiveHostDocument(app) {
  let doc = null
  try { doc = app?.ActiveDocument || null } catch (_) { /* 非文字宿主 */ }
  if (!doc) { try { doc = app?.ActiveWorkbook || null } catch (_) { /* 非表格宿主 */ } }
  if (!doc) { try { doc = app?.ActivePresentation || null } catch (_) { /* 非演示宿主 */ } }
  return doc
}

export function fnv1a32(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function createScopedStorageSuffix(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return 'default'
  const base = text.replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'default'
  // 非 ASCII（中文文件名——本产品主航道）曾被整体剔除：同目录下《A报告.docx》
  // 与《B报告.docx》坍缩到同一键，历史互相串扰。含非 ASCII 的原文附加 8 位
  // 指纹消歧；纯 ASCII 保持旧键逐字节不变（既存数据零迁移）
  if (/[^\x00-\x7F]/.test(text)) {
    return `${base.slice(0, 100)}_${fnv1a32(text).toString(36)}`
  }
  return base
}

/**
 * 只读解析文档会话作用域。无写副作用（身份写入只在发消息时懒嵌）。
 * @returns {{scopeKey:string, documentLinkId:string, docId:string, source:string, fullName:string, name:string}}
 */
export function resolveDocumentScope(doc) {
  const fullName = String(doc?.FullName || '').trim()
  const name = String(doc?.Name || '').trim()
  // docId = 对话所属文档身份（远程回合执行侧校验"对话↔文档"绑定用）
  const docId = fullName || name
  let docLinkId = null
  if (doc) {
    try { docLinkId = readDocumentChatLinkId(doc) } catch (_) { /* 载体异常按缺失处理 */ }
  }
  if (docLinkId) {
    return {
      scopeKey: `doc_${createScopedStorageSuffix(docLinkId)}`,
      documentLinkId: docLinkId,
      docId: docId || `docvar:${docLinkId}`,
      source: 'document-variable',
      fullName,
      name
    }
  }
  if (fullName) {
    return {
      scopeKey: `path_${createScopedStorageSuffix(fullName)}`,
      documentLinkId: '',
      docId,
      source: 'document-path',
      fullName,
      name
    }
  }
  if (name) {
    return {
      scopeKey: `name_${createScopedStorageSuffix(name)}`,
      documentLinkId: '',
      docId,
      source: 'document-name',
      fullName,
      name
    }
  }
  return {
    scopeKey: 'no_active_document',
    documentLinkId: '',
    docId: '',
    source: 'fallback',
    fullName: '',
    name: ''
  }
}

/**
 * 采纳探针：当前 scope 无历史时，按身份优先级低位找同文档旧键。
 * doc_* ← path_* ← name_*；只向下探（上探会把同名未保存文档的历史并进来）。
 */
export function computeFallbackScopeKeys(scopeKey, { fullName = '', name = '' } = {}) {
  const current = String(scopeKey || '')
  const pathKey = fullName ? `path_${createScopedStorageSuffix(fullName)}` : ''
  const nameKey = name ? `name_${createScopedStorageSuffix(name)}` : ''
  const probes = []
  if (current.startsWith('doc_')) {
    if (pathKey) probes.push(pathKey)
    if (nameKey) probes.push(nameKey)
  } else if (current.startsWith('path_')) {
    if (nameKey) probes.push(nameKey)
  }
  return probes.filter((key) => key && key !== current)
}

/**
 * 同文档身份升级判定：发消息时懒嵌身份会让解析结果从 path_/name_ 翻转为
 * doc_*，docId（FullName/Name）不变。这种翻转绝不能在回合进行中执行
 * （会话消息对象引用必须活过整个回合），sync 据此推迟到 busy 解除后迁移；
 * 而真正的文档切换（docId 变了）维持既有 busy 清屏防线。
 */
export function isSameDocumentScopeChange(nextScope, currentDocId) {
  const nextDocId = String(nextScope?.docId || '').trim()
  const prevDocId = String(currentDocId || '').trim()
  return !!nextDocId && !!prevDocId && nextDocId === prevDocId
}
