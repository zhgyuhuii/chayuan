/**
 * Model S 绑定目标解析（对话↔文档路由的执行侧地基）。
 *
 * 设计依据：plans/Model S-对话驻留与文档路由绑定-共识定稿.md（Q1/Q4 裁决）。
 * S2 路由探针真机实证（2026-11-21）：非活动 Document 对象可完整静默读写——
 * 解析只要求「绑定文档在打开集合里可找到」，不要求它是活动文档；写入走对象模型，
 * 焦点零打扰。解析顺序：docLinkId（文件内身份，随另存/改名/拷贝走，T1b 三宿主实证）
 * → docId（FullName/Name 归一比对）→ 调用方自定回落（无 pin 链路保持 ActiveDocument 旧语义）。
 *
 * 宿主感知：Writer=Documents/Windows 集合，表格=Workbooks，演示=Presentations。
 * 逐项 try：跨宿主属性访问会抛 COM 异常而非返回 undefined（docScope 同款教训）。
 */
import { readDocumentChatLinkId } from '../documentIdentity.js'

function normalizeKey(p) {
  return String(p || '').trim().toLowerCase().replace(/\/+$/, '')
}

/** 诊断/面板侧比对用：与解析器同源的归一键 */
export function normalizeDocTargetKey(p) {
  return normalizeKey(p)
}

/**
 * 宿主感知枚举全部打开文档：[{ doc, name, fullName, docLinkId, isActive }]
 * @param {object} [opts] { withIdentity?: boolean } — withIdentity=true 才逐文档读身份
 *   载体（Variables/Tags/Names，每文档 1-N 次跨进程 COM 调用）。默认 false：轮询/胶囊
 *   路径绝不做身份读取（2026-11-21 真机：每拍全枚举+身份读把切文档卡死）；只在写路径
 *   解析（resolveBoundDocument 带 docLinkId pin）时开启。
 */
export function enumerateHostDocuments(app = null, host = '', opts = {}) {
  const withIdentity = opts.withIdentity === true
  const application = app || (typeof window !== 'undefined' ? window.Application : null)
  if (!application) return []
  // 【2026-11-21 写通道全灭根因】必须是 let：host 缺省时此处两次赋值（探测+兜底），
  // const 会抛 'Assignment to constant variable'——dispatch 写门不传 host，全部写
  // 操作连预览一起炸（真机 6 连败实证）。回归锁定见 docTarget.unit.test.js。
  let hostKind = String(host || '').trim()
  if (!hostKind) {
    try { hostKind = String(application.Documents ? 'wps' : application.Workbooks ? 'et' : application.Presentations ? 'wpp' : 'wps') } catch (_) { hostKind = 'wps' }
  }
  let activeKey = ''
  try {
    const probe = hostKind === 'et' ? application.ActiveWorkbook : hostKind === 'wpp' ? application.ActivePresentation : application.ActiveDocument
    if (probe) activeKey = normalizeKey(probe.FullName || probe.Name || '')
  } catch (_) { /* ignore */ }

  const items = []
  const seen = new Set()
  const push = (doc) => {
    if (!doc) return
    let fullName = ''
    let name = ''
    try { fullName = String(doc.FullName || '') } catch (_) { return }
    try { name = String(doc.Name || '') } catch (_) { /* ignore */ }
    const key = normalizeKey(fullName || name)
    if (!key || seen.has(key)) return
    let linkId = null
    if (withIdentity) {
      try { linkId = readDocumentChatLinkId(doc) || null } catch (_) { linkId = null }
    }
    seen.add(key)
    items.push({
      doc,
      name,
      fullName,
      docLinkId: linkId,
      key,
      isActive: !!activeKey && key === activeKey
    })
  }

  const collections = hostKind === 'et'
    ? [application.Workbooks]
    : hostKind === 'wpp'
      ? [application.Presentations]
      : [application.Documents, application.Windows]
  for (const collection of collections) {
    let n = 0
    try { n = Number(collection?.Count || 0) } catch (_) { n = 0 }
    for (let i = 1; i <= n; i++) {
      try { push(collection.Item(i)) } catch (_) { /* 跳过坏项 */ }
    }
  }
  // Writer 的 Windows 集合元素是 Window（.Document 取文档）而非文档本身
  if (hostKind === 'wps') {
    let n = 0
    try { n = Number(application.Windows?.Count || 0) } catch (_) { n = 0 }
    for (let i = 1; i <= n; i++) {
      try { push(application.Windows.Item(i)?.Document) } catch (_) { /* skip */ }
    }
  }
  return items
}

/**
 * 按会话绑定解析目标文档。docLinkId 精确匹配优先；docId（FullName/Name）归一比对次之
 * （精确 → 唯一子串）；两者皆空/皆未命中返回 DOC_NOT_OPEN（孤儿会话，Q7 裁决的执行侧形态）。
 * @returns {{ ok:true, doc, key, name, fullName, docLinkId, isActive } | { ok:false, code:'DOC_NOT_OPEN', message, docId }}
 */
export function resolveBoundDocument({ docLinkId = '', docId = '', host = '', app = null } = {}) {
  const link = String(docLinkId || '').trim()
  const id = String(docId || '').trim()
  if (!link && !id) {
    return { ok: false, code: 'DOC_NOT_OPEN', message: '本对话未绑定文档', docId: id }
  }
  // 身份读取只在带 docLinkId pin 的解析里发生（写路径冷调用）；docId 匹配零额外 COM
  const items = enumerateHostDocuments(app, host, { withIdentity: !!link })
  if (link) {
    const byLink = items.find(it => it.docLinkId && String(it.docLinkId) === link)
    if (byLink) return { ok: true, ...byLink }
  }
  if (id) {
    const want = normalizeKey(id)
    const exact = items.find(it => it.key === want || normalizeKey(it.name) === want)
    if (exact) return { ok: true, ...exact }
    const partial = items.filter(it => it.key.includes(want) || want.includes(it.key))
    if (partial.length === 1) return { ok: true, ...partial[0] }
  }
  const name = id ? id.split('/').pop() : ''
  return {
    ok: false,
    code: 'DOC_NOT_OPEN',
    message: `本对话绑定的文档「${name || link || '未知'}」当前没有打开。请重新打开该文档后继续，或把对话改绑到当前文档。`,
    docId: id
  }
}
