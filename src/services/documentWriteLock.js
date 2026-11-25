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
  const fp = getDocumentFingerprint()
  const docId = getActiveDocId()
  if (baseline.docId && docId && docId !== baseline.docId) {
    // docId 变了但内容指纹一致：最常见是未保存文档被保存——docId 从 Name 兜底值
    // （如「文档1」）变成 FullName 完整路径，内容一字未动。内容没变 + 写回目标
    // 就是当前活动文档，放行（防「任务运行期间保存」误报活动文档已切换）。
    if (fp === baseline.fp) return { ok: true }
    return { ok: false, reason: '活动文档已切换' }
  }
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
let lockSeq = 0

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
 * 强制释放写锁（僵尸 job 自愈专用）：看门狗放弃等待一个永不 settle 的写 handler
 * 时调用。除清掉 owner 外，还必须把挂死者所在的链节跳过去——写 FIFO 靠 promise
 * 链（writeTail）推进而不是 owner 标志，只清旗标的话后续写者仍被链门挡死。
 * 做法：链节用「可外部 settle 的链门」包装 run()，这里 reject 链门即让链继续
 * 流转；挂死 fn 日后迟到 settle 时，结果进入已 settle 的链门（幂等丢弃），其
 * finally 因 owner 身份不符而空转（不清旗标、不滚基线，见 run 内注释）。
 * 按 lockId 严格匹配：挂死的可能只是锁队列里的等待者（持锁者是同 method 的
 * 另一个健康 job），按 label 匹配会误杀健康持锁者。
 * @param {string} lockId - withDocumentWriteLock 返回的 handle.id
 * @returns {boolean} 是否确实释放了一个持锁者
 */
export function forceReleaseLock(lockId) {
  const want = String(lockId || '')
  if (!owner || !want || owner.id !== want) return false
  const stuck = owner
  owner = null
  try {
    stuck.linkSettle?.reject(makeError('DOC_WRITE_LOCK_FORCED_RELEASE', '写 handler 挂死已被强制放行，本节写链路已跳过。'))
  } catch { /* ignore */ }
  try { console.warn(`[documentWriteLock] force-release stuck owner label=${stuck.label} id=${stuck.id}`) } catch { /* ignore */ }
  notifySubscribers()
  return true
}

/**
 * 持锁执行 fn。等待期间可 cancel()；轮到时依次校验：
 * 取消 → 活动文档身份 → OCC 基线（仅校验调用者的 baselineToken，PR5 起各回合
 * 互不洗白），任一失败即拒绝并抛错（不占用写窗口）。
 * @param {{ label?: string, expectDocId?: string, baselineToken?: string|null, occAdvisory?: boolean }} opts
 *   baselineToken=null 与 ''/缺省语义不同：null=显式跳过 OCC（跨 webview 直写，基线表不可达），
 *   ''/缺省=匿名槽（最近一次基线，UI 直调旧语义）；occAdvisory=true 时 OCC 整体降级放行。
 * @param {() => Promise<any>} fn
 */
export function withDocumentWriteLock(opts = {}, fn) {
  const label = String(opts.label || 'document-write')
  const lockId = `wl-${++lockSeq}`
  const expectDocId = opts.expectDocId !== undefined ? opts.expectDocId : getActiveDocId()
  // null 必须原样穿透到 OCC 闸门——String(null||'') 会把它吞成匿名槽，派发写就拿
  // 陈旧基线硬校验误报「活动文档已切换」（2026-11-21 真机写回失败根因之一）
  const baselineToken = opts.baselineToken === null ? null : String(opts.baselineToken || ANON_TOKEN)
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
    // baselineToken=null（跨 webview 直写，2026-11-21 真机）：OCC 指纹校验跳过——
    // 基线表 per-webview 内存态，跨引擎实例校验必然误报；身份校验+写锁串行仍生效。
    // occAdvisory（2026-11-21 真机多轮实证）：MCP 派发写（跨 webview token）OCC 降级为
    // 放行——指纹校验在此架构误报率 100%（面板/基座/执行侧三实例基线不可达）；
    // 防误写由三道硬防线承担：__expectedDocId 身份校验 + originalText 文本匹配 +
    // 写锁 FIFO 串行。同 webview 本地调用（不带 occAdvisory）OCC 语义不变。
    if (baselineToken !== null && !opts.occAdvisory) {
      const verdict = verifyWriteBaseline(baselineToken)
      if (!verdict.ok) {
        throw makeError('DOCUMENT_MODIFIED_SINCE_BASELINE', `写回前校验失败：${verdict.reason}。请重新读取文档内容后重试，或改用带备份的写回方式。`)
      }
    }
    const myToken = { label, id: lockId, linkSettle: waiter.linkSettle }
    owner = myToken
    notifySubscribers()
    try {
      return await fn()
    } finally {
      if (owner === myToken) {
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
        // baselineToken=null（OCC 显式跳过）不滚任何槽——null 写连基线采样都不做，
        // 也不能借道把匿名槽洗成跨 webview 写后态（匿名槽属于本 webview 的 UI 直调链路）。
        const rollDocId = getActiveDocId()
        if (baselineToken !== null && (baselineToken === ANON_TOKEN || rollDocId === nowDocId)) {
          const rollFp = getDocumentFingerprint()
          baselines.set(baselineToken, { docId: rollDocId, fp: rollFp })
          if (baselineToken !== ANON_TOKEN) {
            baselines.set(ANON_TOKEN, { docId: rollDocId, fp: rollFp })
          }
        }
        notifySubscribers()
      }
      // owner !== myToken：已被 forceReleaseLock 强制放行，本次为迟到 settle——
      // 幂等空转。不能清 owner（会误伤强放后新上岗的持锁者）、不能滚基线
      // （会把并发写者的 OCC 校验洗白），也不能从这里 return（finally 里
      // return 会吞掉 fn 的异常，直接落空即可）
    }
  }

  // 链门包装：run 的完成 promise 可被 forceReleaseLock 外部 settle——挂死的
  // handler 永不 settle 时，看门狗 reject 链门即可让 writeTail 继续流转，
  // 后续写者不再被堵死在这节链路上
  const chained = writeTail.then(
    () => new Promise((resolve, reject) => {
      waiter.linkSettle = { resolve, reject }
      run().then(resolve, reject)
    }),
    () => new Promise((resolve, reject) => {
      waiter.linkSettle = { resolve, reject }
      run().then(resolve, reject)
    })
  )
  writeTail = chained.catch(() => { /* 链继续，跳过失败者 */ })
  const result = new Promise((resolve, reject) => {
    waiter.rejectEarly = reject
    chained.then(resolve, reject)
  })
  queue.push(waiter)
  notifySubscribers()
  return {
    promise: result,
    cancel: waiter.handle.cancel,
    id: lockId
  }
}

// FIFO 链尾：保证严格先到先写；单个等待者的失败不阻断后续
let writeTail = Promise.resolve()
