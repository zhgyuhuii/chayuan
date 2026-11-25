/**
 * Writer 脚注/尾注 dispatch（footnote.<action>，2026-11-25 收割对接）：
 * 上游 genoffice docs 编辑器有 insert_footnote/insert_endnote，chayuan-wps 的
 * Writer 工具面此前没有脚注/尾注能力。对象模型为 Word VBA 的 JS 镜像
 * （官方 office_v19）：ActiveDocument.Footnotes / Endnotes，Add(Range, Reference, Text)。
 *
 * Mac JSAPI 纪律（与 AddPicture 同款）：方法/属性双形态探测，插入以 count 增量
 * 为准——对象实参形态不兼容时静默 no-op，必须用计数验证后如实报错。
 */
import { requireHost, safeGet, hostError } from './hostDispatch.js'
import { resolveAnchorRange } from './formatReviewDispatch.js'

function getDoc() {
  // window 探测整体 try 包裹（无 window 环境/未注入 Application 都归一为「没打开文档」）
  const doc = (() => {
    try { return window.Application?.ActiveDocument || null } catch { return null }
  })()
  if (!doc) throw hostError('NO_ACTIVE_DOCUMENT', '当前没有打开的文档，请在 WPS 文字中打开一个文档后重试。')
  return doc
}

function normalizeKind(params) {
  const kind = String(params?.kind || 'footnote').trim()
  if (kind !== 'footnote' && kind !== 'endnote') {
    throw hostError('INVALID_PARAMS', `kind 只支持 footnote|endnote（收到：${kind}）`)
  }
  return kind
}

function notesOf(doc, kind) {
  const notes = kind === 'endnote' ? doc.Endnotes : doc.Footnotes
  if (!notes) {
    throw hostError('NOTES_UNAVAILABLE', `当前 JSAPI 不支持${kind === 'endnote' ? '尾注' : '脚注'}对象（Footnotes/Endnotes 不可用）`)
  }
  return notes
}

function notesCount(notes) {
  return Number(safeGet(() => notes.Count, 0)) || 0
}

function clip(s, n) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, n)
}

function listNotes(doc, kind, limit = 100) {
  const notes = notesOf(doc, kind)
  const count = notesCount(notes)
  const items = []
  for (let i = 1; i <= Math.min(count, Math.max(1, Number(limit) || 100)); i++) {
    const item = safeGet(() => notes.Item(i))
    if (!item) continue
    items.push({
      index: i,
      text: clip(safeGet(() => item.Range?.Text), 200),
      reference: clip(safeGet(() => item.Reference?.Text), 40)
    })
  }
  return { kind, count, items, truncated: count > items.length }
}

function handleFootnoteList(params) {
  const doc = getDoc()
  const kind = String(params?.kind || 'footnote').trim()
  if (kind === 'both') {
    return {
      ok: true,
      host: 'wps',
      footnote: listNotes(doc, 'footnote', params?.limit),
      endnote: listNotes(doc, 'endnote', params?.limit)
    }
  }
  const normalized = normalizeKind({ kind })
  return { ok: true, host: 'wps', ...listNotes(doc, normalized, params?.limit) }
}

function handleFootnoteAdd(params) {
  const doc = getDoc()
  const kind = normalizeKind(params)
  const text = String(params?.text || '').trim()
  if (!text) throw hostError('INVALID_PARAMS', 'text 必填（脚注/尾注内容）')
  const anchor = resolveAnchorRange(doc, params)
  if (!anchor?.range) {
    throw hostError(
      'NO_ANCHOR',
      '需要插入锚点：传 originalText（正文锚文本，自动定位首次出现）或 start/end 字符区间，或先在文档里选中目标位置（默认取当前选区）。'
    )
  }
  const notes = notesOf(doc, kind)
  const before = notesCount(notes)
  // JSAPI 双形态：方法调用为主；异常吞掉后以 count 增量判定成败（静默 no-op 检测）
  try {
    notes.Add(anchor.range, '', text)
  } catch (_) {
    try {
      notes.Add(anchor.range)
    } catch (e2) {
      throw hostError('FOOTNOTE_ADD_FAILED', `脚注插入调用失败：${String(e2?.message || e2).slice(0, 120)}`)
    }
    // 只插了引用标记没带文本 → 补写内容
    const inserted = safeGet(() => notes.Item(before + 1))
    if (inserted) {
      try {
        const r = safeGet(() => inserted.Range)
        if (r && typeof r.Text !== 'undefined') r.Text = text
      } catch { /* 内容补写失败不阻塞（引用标记已在） */ }
    }
  }
  const after = notesCount(notes)
  if (!(after > before)) {
    throw hostError(
      'FOOTNOTE_ADD_FAILED',
      '脚注插入未生效（count 未增长）——当前 WPS 版本 JSAPI 可能不支持 Footnotes.Add，请人工插入。'
    )
  }
  return {
    ok: true,
    host: 'wps',
    kind,
    index: after,
    anchor: { start: anchor.start, end: anchor.end, how: anchor.how },
    text: clip(text, 200)
  }
}

function handleFootnoteDelete(params) {
  const doc = getDoc()
  const kind = normalizeKind(params)
  const index = Number(params?.index)
  if (!Number.isFinite(index) || index < 1) {
    throw hostError('INVALID_PARAMS', 'index 必填（list 返回的 1-based 序号）')
  }
  const notes = notesOf(doc, kind)
  const before = notesCount(notes)
  if (index > before) {
    throw hostError('FOOTNOTE_NOT_FOUND', `序号超界：${kind === 'endnote' ? '尾注' : '脚注'}共 ${before} 条，无第 ${index} 条`)
  }
  const item = safeGet(() => notes.Item(index))
  if (!item) throw hostError('FOOTNOTE_NOT_FOUND', `找不到第 ${index} 条（对象为空）`)
  let deleted = false
  try {
    item.Delete()
    deleted = true
  } catch {
    try {
      notes.Item(index).Delete()
      deleted = true
    } catch { /* 双形态都失败 */ }
  }
  const after = notesCount(notes)
  if (!deleted && !(after < before)) {
    throw hostError('FOOTNOTE_DELETE_FAILED', '删除未生效（count 未减少）——请人工删除。')
  }
  return { ok: true, host: 'wps', kind, deletedIndex: index, remaining: Number.isFinite(after) ? after : before - 1 }
}

/**
 * @param {string} action 'footnote.' 后缀：list | add | delete
 * @param {object} params { kind?, limit?, text?, originalText?, start?, end?, scope?, index? }
 */
export function handleFootnoteAction(action, params = {}) {
  requireHost('wps')
  switch (action) {
    case 'list':
      return handleFootnoteList(params)
    case 'add':
      return handleFootnoteAdd(params)
    case 'delete':
      return handleFootnoteDelete(params)
    default:
      throw hostError('METHOD_NOT_FOUND', `未知 footnote action：${action}（可用：list|add|delete）`)
  }
}

export default { handleFootnoteAction }
