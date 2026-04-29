/**
 * workflowReplay — 历史 instance 重放(W7.6)
 *
 * 不真跑节点,只把 instance.snapshot 按时间顺序"放电影",
 * 让用户慢速观察每个节点的开始/结束 + 输出。
 *
 * 调用方:
 *   const player = createReplayer(instance)
 *   player.play({ speed: 1, onTick: (event) => {...} })
 *   player.pause()
 *   player.seek(timestamp)
 */

/**
 * 把 instance.snapshot 转换成有序事件列表:
 *   [{ ts, type: 'node:run'|'node:done'|'node:error', nodeId, snapshot }]
 */
export function buildReplayEvents(instance) {
  const events = []
  const snap = instance?.snapshot || {}
  for (const [nodeId, s] of Object.entries(snap)) {
    if (s.startedAt) events.push({ ts: s.startedAt, type: 'node:run', nodeId, snapshot: { ...s } })
    if (s.endedAt) {
      const evType = s.status === 'failed' ? 'node:error' : 'node:done'
      events.push({ ts: s.endedAt, type: evType, nodeId, snapshot: { ...s } })
    }
  }
  events.sort((a, b) => a.ts - b.ts)
  return events
}

/**
 * 创建一个重放播放器。
 *
 *   options.speed:1 = 实时(原始时长),2 = 2x,Infinity = 立即跳到底
 *   options.onTick(event):每个事件触发回调
 *   options.onComplete():全部跑完
 *
 * 返回 player 对象:{ play, pause, seek, getCurrentTime, isPlaying, getEvents }
 */
export function createReplayer(instance, options = {}) {
  const events = buildReplayEvents(instance)
  if (events.length === 0) {
    return {
      play: () => {}, pause: () => {}, seek: () => {},
      getCurrentTime: () => 0, isPlaying: () => false,
      getEvents: () => [],
      getDuration: () => 0
    }
  }

  const startTs = events[0].ts
  const endTs = events[events.length - 1].ts
  const duration = endTs - startTs

  let cursor = 0     // 下一个待发的 event index
  let currentTime = 0  // 相对时间 ms
  let timer = null
  let speed = Math.max(0.01, Number(options.speed) || 1)
  let lastTickAt = 0

  function play() {
    if (timer) return
    lastTickAt = Date.now()
    timer = setInterval(advance, 100)
  }

  function pause() {
    if (timer) { clearInterval(timer); timer = null }
  }

  function advance() {
    const now = Date.now()
    const elapsed = (now - lastTickAt) * speed
    lastTickAt = now
    currentTime += elapsed

    while (cursor < events.length && events[cursor].ts - startTs <= currentTime) {
      const ev = events[cursor]
      try { options.onTick?.(ev) } catch (_) {}
      cursor += 1
    }

    if (cursor >= events.length) {
      pause()
      try { options.onComplete?.() } catch (_) {}
    }
  }

  function seek(targetMs) {
    const target = Math.max(0, Math.min(targetMs, duration))
    currentTime = target
    // 重新定位 cursor
    cursor = 0
    while (cursor < events.length && events[cursor].ts - startTs <= currentTime) {
      cursor += 1
    }
  }

  function setSpeed(s) {
    speed = Math.max(0.01, Number(s) || 1)
  }

  return {
    play,
    pause,
    seek,
    setSpeed,
    getCurrentTime: () => currentTime,
    getDuration: () => duration,
    isPlaying: () => !!timer,
    getEvents: () => events.slice()
  }
}

/**
 * 给某个 instance 的某个节点取出"完整调用栈"(节点输入 / 输出 / 错误 / 子节点)。
 * 用于调试工具的"点节点看详情"。
 */
export function getNodeCallStack(instance, nodeId) {
  const snap = instance?.snapshot || {}
  const node = snap[nodeId]
  if (!node) return null
  const stack = {
    nodeId,
    status: node.status,
    startedAt: node.startedAt,
    endedAt: node.endedAt,
    duration: (node.endedAt || 0) - (node.startedAt || 0),
    input: node.input,
    output: node.output,
    error: node.error,
    attempts: node.attempts || 1,
    children: []
  }
  // 若有 sub-instance,递归(由 caller 提供 lookup)
  return stack
}

export default {
  buildReplayEvents,
  createReplayer,
  getNodeCallStack
}
