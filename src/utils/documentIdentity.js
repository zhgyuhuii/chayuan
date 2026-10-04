/**
 * 文档对话身份载体（多文档对话一一对应的根基）。
 *
 * T1/T1b 真机实证结论（plans/v3方案评审结论-多文档会话绑定.md 第九/十节）：
 * - Writer：doc.Variables（Word 文档变量，随 docx settings.xml 落盘）——生产 v5.1.5 已用
 * - ET：Workbook.Names——RefersTo 第二参必须是字符串字面量公式 '="value"'；裸字符串会
 *   造出非法名称并在 SaveAs 时炸掉 WPS 写盘器（真机实证）
 * - WPP：Presentation.Tags——落盘 ppt/tags/tagN.xml 标准 p:tagLst 槽位；tag 名会被
 *   大写化（大小写不敏感，比对一律 toUpperCase）；Tags.Item(name) 直接返回值字符串
 *   （.Value 为 undefined）
 *
 * 身份随文件走：另存/改名/拷贝天然跟随，无外部登记表、无时序竞争。
 * 载体选择按能力探测（Variables→Tags→Names）而非宿主判断——跨宿主属性访问
 * 会抛 COM 异常而非返回 undefined，逐项 try 兜底。
 */
export const DOC_CHAT_LINK_KEY = 'chayuan_ai_chat_link_id'

function readVariablesCarrier(doc, key) {
  if (!doc?.Variables) return null
  const v = doc.Variables.Item(key)
  return String(v?.Value || '').trim() || null
}

function writeVariablesCarrier(doc, key, value) {
  if (!doc?.Variables) return false
  try {
    doc.Variables.Add(key, value)
    return true
  } catch (_) {
    try {
      const existing = doc.Variables.Item(key)
      if (existing) {
        existing.Value = value
        return true
      }
    } catch (__) { /* 新建失败且无既存项 */ }
  }
  return false
}

function readTagsCarrier(doc, key) {
  if (!doc?.Tags) return null
  const upper = key.toUpperCase()
  // Item(name) 直接返回值字符串（WPS 绑定真机实证）；缺失时不抛错的实现靠回退遍历兜底
  try {
    const got = doc.Tags.Item(key)
    if (typeof got === 'string') return got.trim() || null
    if (got && typeof got === 'object' && got.Value !== undefined) return String(got.Value).trim() || null
  } catch (_) { /* 落入遍历 */ }
  const n = Number(doc.Tags.Count || 0)
  for (let i = 1; i <= n; i++) {
    if (String(doc.Tags.Name(i)).toUpperCase() === upper) {
      return String(doc.Tags.Value(i)).trim() || null
    }
  }
  return null
}

function writeTagsCarrier(doc, key, value) {
  if (!doc?.Tags) return false
  doc.Tags.Add(key, value)
  return true
}

function stripNameFormula(raw) {
  return String(raw || '')
    .replace(/^=/, '')
    .replace(/^"/, '')
    .replace(/"$/, '')
    .trim()
}

function readNamesCarrier(doc, key) {
  if (!doc?.Names) return null
  // .Value 缺失的构建回退 .RefersTo（varsProbe 同期实证过的形态）
  const raw = doc.Names.Item(key)?.Value || doc.Names.Item(key)?.RefersTo
  const val = stripNameFormula(raw)
  return val || null
}

function writeNamesCarrier(doc, key, value) {
  if (!doc?.Names) return false
  // RefersTo 必须字符串字面量公式形式（真机实证：裸字符串毒化工作簿）
  doc.Names.Add(key, `="${value}"`)
  return true
}

/** 读文档身份；无载体/无身份返回 null（不写入、不产生副作用） */
export function readDocumentChatLinkId(doc) {
  const readers = [readVariablesCarrier, readTagsCarrier, readNamesCarrier]
  for (const read of readers) {
    try {
      const v = read(doc, DOC_CHAT_LINK_KEY)
      if (v) return v
    } catch (_) { /* 该载体不可用，试下一个 */ }
  }
  return null
}

/** 写文档身份（仅在确认缺失后调用——Names.Add 对既存名会抛错）；成功返回 true */
export function writeDocumentChatLinkId(doc, value) {
  const normalized = String(value || '').trim()
  if (!normalized) return false
  const writers = [writeVariablesCarrier, writeTagsCarrier, writeNamesCarrier]
  for (const write of writers) {
    try {
      if (write(doc, DOC_CHAT_LINK_KEY, normalized)) {
        // 写后即读校验（存在≠可读，CDP 只读教训同样适用）
        return readDocumentChatLinkId(doc) === normalized
      }
    } catch (_) { /* 该载体不可写，试下一个 */ }
  }
  return false
}

export function buildDocumentChatLinkId() {
  return `docchat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** 幂等确保文档身份：读不到才生成并写入；写入失败（如只读载体）返回 null */
export function ensureDocumentChatLinkId(doc) {
  const existing = readDocumentChatLinkId(doc)
  if (existing) return existing
  const created = buildDocumentChatLinkId()
  return writeDocumentChatLinkId(doc, created) ? created : null
}

const CARRIER_READERS = [
  ['Variables', readVariablesCarrier],
  ['Tags', readTagsCarrier],
  ['Names', readNamesCarrier]
]
const CARRIER_WRITERS = [
  ['Variables', writeVariablesCarrier],
  ['Tags', writeTagsCarrier],
  ['Names', writeNamesCarrier]
]

/** 诊断/测试用：报告身份与载体；ensure=true 时缺失则补写 */
export function describeDocumentIdentity(doc, { ensure = false } = {}) {
  for (const [carrier, read] of CARRIER_READERS) {
    try {
      const v = read(doc, DOC_CHAT_LINK_KEY)
      if (v) return { id: v, carrier, ensured: false }
    } catch (_) { /* 该载体不可用 */ }
  }
  if (!ensure) return { id: null, carrier: null, ensured: false }
  const created = buildDocumentChatLinkId()
  for (const [carrier, write] of CARRIER_WRITERS) {
    try {
      if (write(doc, DOC_CHAT_LINK_KEY, created) && readDocumentChatLinkId(doc) === created) {
        return { id: created, carrier, ensured: true }
      }
    } catch (_) { /* 试下一个 */ }
  }
  return { id: null, carrier: null, ensured: false, error: '全部载体不可写' }
}
