/**
 * opQueue — 跨窗口文档操作序列化队列
 *
 * v2 计划 P4「主进程 op 队列(BroadcastChannel + ribbon 监听)」。
 * 多个 dialog 窗口同时想写文档时,主任务窗格作为「leader」按 FIFO 序列化执行,
 * 避免 Application 状态被并发写坏。
 *
 * 协议:
 *   - 任意窗口调 enqueueOp({ kind, payload }) → 通过 BroadcastChannel 发到 leader
 *   - leader 注册 onOp(handler) 接收 + 串行执行
 *   - 执行结果回 broadcast,enqueueOp 的 Promise 在收到结果时 resolve
 *
 * 简化:
 *   - 没有 leader election —— 调用方约定主任务窗格当 leader,其他窗口当 client
 *   - 单一队列,无优先级
 *   - 5 秒超时,超时 reject
 */

const CHANNEL_NAME = 'chayuan-op-queue'
const REPLY_CHANNEL_NAME = 'chayuan-op-queue-reply'
const DEFAULT_TIMEOUT_MS = 5000

let _channel = null
let _replyChannel = null
let _opSeq = 0

function ensureChannel() {
  if (typeof window === 'undefined') return null
  if (typeof BroadcastChannel !== 'function') return null
  if (!_channel) {
    try { _channel = new BroadcastChannel(CHANNEL_NAME) } catch { return null }
  }
  return _channel
}
function ensureReplyChannel() {
  if (typeof window === 'undefined') return null
  if (typeof BroadcastChannel !== 'function') return null
  if (!_replyChannel) {
    try { _replyChannel = new BroadcastChannel(REPLY_CHANNEL_NAME) } catch { return null }
  }
  return _replyChannel
}

/* ────────── Leader API ────────── */

let _leaderHandler = null
let _leaderListener = null

/**
 * 让本窗口成为 leader,接管 op 处理。
 * 任意时刻只允许一个 leader(后者覆盖前者)。
 */
export function becomeLeader(handler) {
  if (typeof handler !== 'function') return false
  const ch = ensureChannel()
  const rch = ensureReplyChannel()
  if (!ch || !rch) return false

  _leaderHandler = handler
  if (_leaderListener) ch.removeEventListener('message', _leaderListener)
  _leaderListener = async (e) => {
    const { id, kind, payload } = e.data || {}
    if (!id || !kind) return
    let result, error
    try {
      result = await _leaderHandler({ kind, payload })
    } catch (err) {
      error = String(err?.message || err)
    }
    rch.postMessage({ id, ok: !error, result, error })
  }
  ch.addEventListener('message', _leaderListener)
  return true
}

export function resignLeader() {
  if (_leaderListener && _channel) {
    _channel.removeEventListener('message', _leaderListener)
  }
  _leaderHandler = null
  _leaderListener = null
}

/* ────────── Client API ────────── */

const _pending = new Map()  // id → { resolve, reject, timer }

let _replyListenerInstalled = false
function ensureReplyListener() {
  if (_replyListenerInstalled) return
  const rch = ensureReplyChannel()
  if (!rch) return
  rch.addEventListener('message', (e) => {
    const { id, ok, result, error } = e.data || {}
    const slot = _pending.get(id)
    if (!slot) return
    clearTimeout(slot.timer)
    _pending.delete(id)
    if (ok) slot.resolve(result)
    else slot.reject(new Error(error || '执行失败'))
  })
  _replyListenerInstalled = true
}

/**
 * 把一个 op 发给 leader,等待结果。
 *   options.timeoutMs  默认 5000
 *   options.localFallback  无 leader 时是否本地直接处理 op(传一个函数即直接调)
 */
export function enqueueOp(kind, payload = {}, options = {}) {
  const ch = ensureChannel()
  if (!ch) {
    // 无 BroadcastChannel → 直接本地处理
    if (typeof options.localFallback === 'function') {
      return Promise.resolve(options.localFallback({ kind, payload }))
    }
    return Promise.reject(new Error('无 BroadcastChannel 且未提供 localFallback'))
  }
  ensureReplyListener()
  const id = `op_${++_opSeq}_${Date.now().toString(36)}`
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      _pending.delete(id)
      reject(new Error(`op '${kind}' 超时 ${timeoutMs}ms(没有 leader 响应)`))
    }, timeoutMs)
    _pending.set(id, { resolve, reject, timer })
    try { ch.postMessage({ id, kind, payload }) } catch (e) {
      clearTimeout(timer)
      _pending.delete(id)
      reject(e)
    }
  })
}

/* ────────── 调试 ────────── */

export function getQueueStatus() {
  return {
    isLeader: !!_leaderHandler,
    pending: _pending.size,
    hasChannel: !!_channel
  }
}

export function close() {
  resignLeader()
  if (_channel) { try { _channel.close() } catch (_) {} _channel = null }
  if (_replyChannel) { try { _replyChannel.close() } catch (_) {} _replyChannel = null }
  _pending.clear()
  _replyListenerInstalled = false
}

export default {
  becomeLeader,
  resignLeader,
  enqueueOp,
  getQueueStatus,
  close
}
