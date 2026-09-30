/**
 * 文档写锁（本窗口全局单写者 + FIFO 排队 + OCC 基线校验）。
 *
 * 背景：多会话并行后，多个回合可能同时要写当前文档。WPS 文档的两批修订
 * 没有 merge 工具，写冲突不可恢复，故所有「写文档」动作必须持锁串行；
 * 纯读操作（get_text/chunks/locate 等）不拿锁、完全并行。
 *
 * - withDocumentWriteLock(opts, fn)：排队拿锁后执行 fn，结束自动释放。
 *   排队顺序严格 FIFO（promise 链保证）；队列快照经订阅回调通知 UI。
 * - 拿到锁时校验「活动文档身份」与 enqueue 时一致，防止排队期间用户切走文档
 *   导致写落到错误文档上。
 * - OCC（基线按 ownerToken 隔离，PR5）：回合起点 setWriteBaseline(token) 记录
 *   本回合视角的文档指纹；带 baselineToken 的写在写前只核对自己 token 的基线，
 *   其它回合再开新基线也「洗白」不了本回合的校验——手动编辑后另一会话发消息，
 *   本回合的写仍会被 DOCUMENT_MODIFIED_SINCE_BASELINE 拦下。己方写成功后仅
 *   滚动更新自己的基线（同一回合连续写不误报）。不带 token 的写（UI 直调链路：
 *   校对卡按钮、备份回滚等用户显式动作）共用匿名基线槽。
 * - 指纹为全文 hash（段落数+长度+全文）：旧实现只看首尾各 48 字，中段等长替换
 *   （"张三"→"李四"）三者全不变，OCC 穿透；反正全文已取出，直接 hash 全文。
 */

function getActiveDocId() {
  try {
    const app = window.Application
    // 宿主感知：文字=ActiveDocument；表格=ActiveWorkbook；演示=ActivePresentation。
    // 同一 webview 只会运行在一个宿主里，按存在性依次探测（官方 office_v19：
    // window.Application 即当前宿主根对象）。非文字宿主此前返回 ''，会让身份
    // 校验静默失效——ET/WPP 接入后必须能校验"写前活动对象没被切走"。
    const probe = (get) => {
      try {
        const obj = get()
        if (obj) return String(obj.FullName || obj.Name || '')
      } catch { /* ignore */ }
      return ''
    }
    return (
      probe(() => app?.ActiveDocument) ||
      probe(() => app?.ActiveWorkbook) ||
      probe(() => app?.ActivePresentation)
    )
  } catch {
    return ''
  }
}

function hashLite(text) {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

// 表格 OCC 指纹上限：已用区域超过该格数后指纹退化为"维度+工作表名"（防止
// 大表逐格采样拖垮写锁；超限表的脏写风险由两段确认+快照承担）
const ET_FINGERPRINT_MAX_CELLS = 20_000

function etFingerprint(wb) {
  const sheet = wb.ActiveSheet
  if (!sheet) return 'et:no-sheet'
  const sheetName = String(sheet.Name || '')
  const used = sheet.UsedRange
  if (!used) return `et:${sheetName}:empty`
  let rows = 0
  let cols = 0
  let address = ''
  try { rows = Number(used.Rows?.Count || 0) } catch { /* ignore */ }
  try { cols = Number(used.Columns?.Count || 0) } catch { /* ignore */ }
  try { address = String(used.Address || '') } catch { /* ignore */ }
  const dims = `${sheetName}:${address}:${rows}x${cols}`
  if (rows * cols > ET_FINGERPRINT_MAX_CELLS) return `et:${dims}:dimsonly`
  try {
    // Value2 整块读取可能返回纯数组或 Item(r,c) 包装对象（官方未承诺形态），
    // 统一摊平成文本再 hash
    const v = used.Value2
    let text = ''
    if (Array.isArray(v) && Array.isArray(v[0])) {
      for (const row of v) text += row.join('\u0001') + '\u0002'
    } else if (Array.isArray(v)) {
      text = v.join('\u0001')
    } else if (v && typeof v.Item === 'function') {
      outer: for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          let cell = ''
          try { cell = String(v.Item(r, c) ?? '') } catch { cell = '?' }
          text += cell + '\u0001'
          if (text.length > 1_000_000) break outer
        }
        text += '\u0002'
      }
    } else {
      text = String(v ?? '')
    }
    return `et:${dims}:${text.length}:${hashLite(text)}`
  } catch {
    return `et:${dims}:bulkread-failed`
  }
}

function wppFingerprint(pres) {
  const slides = pres.Slides
  let count = 0
  try { count = Number(slides?.Count || 0) } catch { /* ignore */ }
  let text = ''
  for (let i = 1; i <= count; i++) {
    try {
      const shapes = slides.Item(i).Shapes
      const shapeCount = Number(shapes.Count || 0)
      for (let j = 1; j <= shapeCount; j++) {
        const sh = shapes.Item(j)
        if (Number(sh.HasTextFrame) !== 0) {
          text += String(sh.TextFrame.TextRange.Text || '') + '\u0001'
        }
      }
      text += '\u0002'
    } catch { /* ignore */ }
  }
  return `wpp:${count}:${text.length}:${hashLite(text)}`
}

export function getDocumentFingerprint() {
  try {
    const app = window.Application
    const probe = (get) => {
      try {
        const obj = get()
        return obj || null
      } catch {
        return null
      }
    }
    const doc = probe(() => app?.ActiveDocument)
    if (doc) {
      let text = ''
      try { text = String(doc.Content?.Text || '') } catch { text = '' }
      let paraCount = 0
      try { paraCount = Number(doc.Paragraphs?.Count || 0) } catch { paraCount = 0 }
      return `wps:${paraCount}:${text.length}:${hashLite(text)}`
    }
    const wb = probe(() => app?.ActiveWorkbook)
    if (wb) return etFingerprint(wb)
    const pres = probe(() => app?.ActivePresentation)
    if (pres) return wppFingerprint(pres)
    return ''
  } catch {
    return ''
  }
}

/**
 * 基线表：ownerToken（回合唯一）→ { docId, fp }。
 * '' 键 = 匿名槽，供不带 token 的 UI 直调写链路；任何 setWriteBaseline 都会
 * 顺带刷新匿名槽，保持无 token 链路的旧语义（最近一次记录为参照）。
 */
const ANON_TOKEN = ''
const baselines = new Map()

/** 回合起点调用：记录当前文档指纹作为本回合的 OCC 基线 */
export function setWriteBaseline(fp = getDocumentFingerprint(), docId = getActiveDocId(), ownerToken = ANON_TOKEN) {
  const token = String(ownerToken || ANON_TOKEN)
  baselines.set(token, { docId, fp })
  if (token !== ANON_TOKEN) baselines.set(ANON_TOKEN, { docId, fp })
}

export function getWriteBaseline(ownerToken = ANON_TOKEN) {
  const entry = baselines.get(String(ownerToken || ANON_TOKEN))
  return entry ? { ...entry } : { docId: '', fp: '' }
}

/** 仅供测试/重置使用 */
export function resetWriteBaselines() {
  baselines.clear()
}

// 跨 WebView 可能没有本地基线，回合目标文档仍由 expectDocId 独立校验。
function verifyWriteBaseline(ownerToken) {
  const baseline = baselines.get(String(ownerToken || ANON_TOKEN))
  if (!baseline || !baseline.fp) return { ok: true }
  const docId = getActiveDocId()
  if (baseline.docId && docId && docId !== baseline.docId) {
    return { ok: false, reason: '活动文档已切换' }
  }
  const fp = getDocumentFingerprint()
  if (fp !== baseline.fp) {
    return { ok: false, reason: '文档内容在本回合期间已被修改（可能为手动编辑或其它操作）' }
  }
  return { ok: true }
}

function makeError(code, message) {
  const err = new Error(message)
  err.code = code
  return err
}

let owner = null
const queue = [] // 尚未轮到的等待者 { label, cancelled, handle }
const subscribers = new Set()

function snapshot() {
  return {
    locked: !!owner,
    ownerLabel: owner ? owner.label : '',
    queue: queue.map((w, i) => ({ label: w.label, position: i + 1, handle: w.handle }))
  }
}

function notifySubscribers() {
  const snap = snapshot()
  for (const cb of subscribers) {
    try { cb(snap) } catch { /* 订阅方异常不影响锁 */ }
  }
}

export function subscribeLockState(cb) {
  subscribers.add(cb)
  cb(snapshot())
  return () => subscribers.delete(cb)
}

export function getLockState() {
  return snapshot()
}

/**
 * 持锁执行 fn。等待期间可 cancel()；轮到时依次校验：
 * 取消 → 活动文档身份 → OCC 基线（仅校验调用者的 baselineToken，PR5 起各回合
 * 互不洗白），任一失败即拒绝并抛错（不占用写窗口）。
 * @param {{ label?: string, expectDocId?: string, baselineToken?: string }} opts
 * @param {() => Promise<any>} fn
 */
export function withDocumentWriteLock(opts = {}, fn) {
  const label = String(opts.label || 'document-write')
  const expectDocId = opts.expectDocId !== undefined ? opts.expectDocId : getActiveDocId()
  const baselineToken = String(opts.baselineToken || ANON_TOKEN)
  const waiter = { label, cancelled: false, handle: null, rejectEarly: null }
  waiter.handle = {
    cancel: () => {
      if (waiter.cancelled) return
      waiter.cancelled = true
      const idx = queue.indexOf(waiter)
      if (idx >= 0) {
        // 尚未轮到:立即拒绝,调用方马上收到取消结果;链槽到达时 run() 会再次短路
        queue.splice(idx, 1)
        if (waiter.rejectEarly) {
          waiter.rejectEarly(makeError('DOC_WRITE_LOCK_CANCELLED', '已取消等待文档写锁，本次写回未执行。'))
        }
        notifySubscribers()
      }
      // 已在执行(不在队列):写动作本身无法中断,保持原语义
    }
  }

  const run = async () => {
    // 轮到我：先移出队列再执行校验/写入
    const idx = queue.indexOf(waiter)
    if (idx >= 0) queue.splice(idx, 1)
    if (waiter.cancelled) {
      throw makeError('DOC_WRITE_LOCK_CANCELLED', '已取消等待文档写锁，本次写回未执行。')
    }
    const nowDocId = getActiveDocId()
    if (expectDocId && expectDocId !== nowDocId) {
      throw makeError('DOC_SWITCHED', '排队等待期间活动文档已切换，本次写回已取消（避免写到错误文档）。')
    }
    if (owner) {
      // 链式队列理论上不会出现；兜底防御
      throw makeError('DOC_WRITE_LOCK_BUSY', '文档写锁被占用，本次写回未执行。')
    }
    const verdict = verifyWriteBaseline(baselineToken)
    if (!verdict.ok) {
      throw makeError('DOCUMENT_MODIFIED_SINCE_BASELINE', `写回前校验失败：${verdict.reason}。请重新读取文档内容后重试，或改用带备份的写回方式。`)
    }
    owner = { label }
    notifySubscribers()
    try {
      return await fn()
    } finally {
      // 写后沉淀：部分写操作（典型=分页符 break.insert）返回时 WPS 对文档结构的
      // 二次更新（段落计数/全文 Text）尚未完成，立即取指纹会把「未沉淀态」存成
      // 基线，随后真实指纹漂移 → 本 token 的所有后续写全部撞
      // DOCUMENT_MODIFIED_SINCE_BASELINE（2026-09-17 实测：首个 break.insert ok、
      // 之后同回合写永久被拦直至回合轮次烧尽）。持锁静置 300ms 等 WPS 沉淀后再
      // 采样滚动，把基线钉在稳定态。
      try {
        await new Promise((resolve) => setTimeout(resolve, 300))
      } catch { /* ignore */ }
      owner = null
      // 回合基线不能因写后沉淀期间切换文档而重新绑定到另一篇文档。
      const rollDocId = getActiveDocId()
      if (baselineToken === ANON_TOKEN || rollDocId === nowDocId) {
        const rollFp = getDocumentFingerprint()
        baselines.set(baselineToken, { docId: rollDocId, fp: rollFp })
        if (baselineToken !== ANON_TOKEN) {
          baselines.set(ANON_TOKEN, { docId: rollDocId, fp: rollFp })
        }
      }
      notifySubscribers()
    }
  }

  const chained = writeTail.then(run, run)
  writeTail = chained.catch(() => { /* 链继续，跳过失败者 */ })
  const result = new Promise((resolve, reject) => {
    waiter.rejectEarly = reject
    chained.then(resolve, reject)
  })
  queue.push(waiter)
  notifySubscribers()
  return {
    promise: result,
    cancel: waiter.handle.cancel
  }
}

// FIFO 链尾：保证严格先到先写；单个等待者的失败不阻断后续
let writeTail = Promise.resolve()
