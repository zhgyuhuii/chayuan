/**
 * leaderElection — opQueue leader 自动选举
 *
 * 解决 P6 问题:opQueue.becomeLeader 是手动指定,多 dialog 同时打开会乱。
 *
 * 算法(Bully 简化版):
 *   - 每个窗口启动时生成随机 instanceId(高位时间戳 + 随机)
 *   - 通过 BroadcastChannel 发心跳:'leader-heartbeat' { instanceId, ts }
 *   - 每 500ms 检查:
 *     - 1.5 秒内无任何心跳 → 我宣布自己是 leader
 *     - 收到 instanceId > 我的 心跳 → 让位
 *     - 收到 instanceId < 我的 心跳 → 强制成为 leader
 *
 * 用法:
 *   import { startLeaderElection, isLeader, onLeaderChange } from '...'
 *
 *   const stop = startLeaderElection()   // App.vue mount 调
 *
 *   if (isLeader()) {
 *     // 我是 leader,可以 becomeLeader(handleOp)
 *   }
 */

const CHANNEL = 'chayuan-leader-election'
const HEARTBEAT_INTERVAL = 500
const LEADER_TIMEOUT = 1500

let _channel = null
let _myInstanceId = ''
let _leaderId = ''
let _heartbeatTimer = null
let _checkTimer = null
let _lastHeartbeatAt = 0
const _listeners = new Set()

function makeInstanceId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function notifyChange() {
  for (const fn of _listeners) {
    try { fn({ isLeader: _leaderId === _myInstanceId, leaderId: _leaderId }) } catch (_) {}
  }
}

function ensureChannel() {
  if (_channel) return _channel
  if (typeof window === 'undefined' || typeof BroadcastChannel !== 'function') return null
  try { _channel = new BroadcastChannel(CHANNEL) } catch { return null }
  return _channel
}

/**
 * 启动 leader 选举。返回 stop 函数。
 *   options.onChange?  leader 变化时回调
 */
export function startLeaderElection(options = {}) {
  const ch = ensureChannel()
  if (!ch) {
    // 单窗口或不支持 BC → 直接当 leader
    _myInstanceId = makeInstanceId()
    _leaderId = _myInstanceId
    if (options.onChange) options.onChange({ isLeader: true, leaderId: _myInstanceId })
    return () => {}
  }
  _myInstanceId = makeInstanceId()
  if (options.onChange) _listeners.add(options.onChange)

  ch.addEventListener('message', (e) => {
    const { type, instanceId, ts } = e.data || {}
    if (type === 'leader-heartbeat' && instanceId) {
      _lastHeartbeatAt = ts || Date.now()
      // 比较 instanceId(字典序);大的胜出
      if (instanceId > _myInstanceId) {
        if (_leaderId !== instanceId) {
          _leaderId = instanceId
          notifyChange()
        }
      } else if (instanceId < _myInstanceId && _leaderId !== _myInstanceId) {
        // 我应该是 leader,强制重夺
        _leaderId = _myInstanceId
        notifyChange()
        sendHeartbeat()
      }
    }
  })

  // 初始假设我是 leader,但等其他窗口反馈
  setTimeout(() => {
    if (Date.now() - _lastHeartbeatAt > LEADER_TIMEOUT) {
      _leaderId = _myInstanceId
      notifyChange()
    }
  }, 600)

  // 心跳
  function sendHeartbeat() {
    if (_leaderId !== _myInstanceId) return
    try {
      ch.postMessage({ type: 'leader-heartbeat', instanceId: _myInstanceId, ts: Date.now() })
    } catch (_) {}
  }
  _heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

  // 检查 leader 是否还活着
  _checkTimer = setInterval(() => {
    if (_leaderId === _myInstanceId) return  // 我是 leader,不用 check
    if (Date.now() - _lastHeartbeatAt > LEADER_TIMEOUT) {
      _leaderId = _myInstanceId
      notifyChange()
      sendHeartbeat()
    }
  }, HEARTBEAT_INTERVAL)

  return function stopElection() {
    if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null }
    if (_checkTimer) { clearInterval(_checkTimer); _checkTimer = null }
    if (options.onChange) _listeners.delete(options.onChange)
  }
}

export function isLeader() {
  return _leaderId !== '' && _leaderId === _myInstanceId
}

export function getLeaderId() { return _leaderId }
export function getMyInstanceId() { return _myInstanceId }

export function onLeaderChange(fn) {
  if (typeof fn !== 'function') return () => {}
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

export default {
  startLeaderElection,
  isLeader,
  getLeaderId,
  getMyInstanceId,
  onLeaderChange
}
