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
 * - OCC：setWriteBaseline() 在回合起点记录文档指纹；每次写前核对，若指纹变化
 *   （被手动编辑或其它未持锁方修改）则拒绝写入；己方写成功后滚动更新基线，
 *   因此同一回合的连续写不会误报。
 */

function getActiveDocId() {
  try {
    const doc = window.Application?.ActiveDocument
    if (!doc) return ''
    return String(doc.FullName || doc.Name || '')
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

export function getDocumentFingerprint() {
  try {
    const doc = window.Application?.ActiveDocument
    if (!doc) return ''
    let text = ''
    try { text = String(doc.Content?.Text || '') } catch { text = '' }
    let paraCount = 0
    try { paraCount = Number(doc.Paragraphs?.Count || 0) } catch { paraCount = 0 }
    const head = text.slice(0, 48)
    const tailText = text.slice(-48)
    return `${paraCount}:${text.length}:${hashLite(head)}:${hashLite(tailText)}`
  } catch {
    return ''
  }
}

let baseline = { docId: '', fp: '' }

/** 回合起点调用：记录当前文档指纹作为 OCC 基线 */
export function setWriteBaseline(fp = getDocumentFingerprint(), docId = getActiveDocId()) {
  baseline = { docId, fp }
}

export function getWriteBaseline() {
  return { ...baseline }
}

function verifyWriteBaseline() {
  if (!baseline.fp) return { ok: true }
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
 * 取消 → 活动文档身份 → OCC 基线，任一失败即拒绝并抛错（不占用写窗口）。
 * @param {{ label?: string, expectDocId?: string }} opts
 * @param {() => Promise<any>} fn
 */
export function withDocumentWriteLock(opts = {}, fn) {
  const label = String(opts.label || 'document-write')
  const expectDocId = opts.expectDocId !== undefined ? opts.expectDocId : getActiveDocId()
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
    if (expectDocId && nowDocId && expectDocId !== nowDocId) {
      throw makeError('DOC_SWITCHED', '排队等待期间活动文档已切换，本次写回已取消（避免写到错误文档）。')
    }
    if (owner) {
      // 链式队列理论上不会出现；兜底防御
      throw makeError('DOC_WRITE_LOCK_BUSY', '文档写锁被占用，本次写回未执行。')
    }
    const verdict = verifyWriteBaseline()
    if (!verdict.ok) {
      throw makeError('DOCUMENT_MODIFIED_SINCE_BASELINE', `写回前校验失败：${verdict.reason}。请重新读取文档内容后重试，或改用带备份的写回方式。`)
    }
    owner = { label }
    notifySubscribers()
    try {
      return await fn()
    } finally {
      owner = null
      // 写后滚动更新基线（无论成败），同回合连续写不误报
      setWriteBaseline(getDocumentFingerprint(), nowDocId)
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
