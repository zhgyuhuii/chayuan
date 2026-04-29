/**
 * throttledPersist - 高频持久化的统一节流器
 *
 * 解决 AIAssistantDialog.vue 中 180 处 saveHistory() 同步落盘的主线程卡顿。
 *
 * 提供两种使用方式:
 *
 *   1. 节流装饰器(推荐):
 *        const debouncedSave = createThrottledPersister({
 *          key: 'chatHistory',
 *          getValue: () => this.chatHistory,
 *          serialize: data => JSON.stringify(data),
 *          write: blob => localStorage.setItem('chatHistory', blob)
 *        })
 *        // 之后所有原 saveHistory() 调用改为 debouncedSave()
 *
 *   2. 直接节流执行:
 *        idleDebounce(() => doExpensiveStuff(), { wait: 250 })
 *
 * 工作机制:
 *   - debounce wait(默认 250ms)— 用户快速操作时合并多次写入
 *   - leadingFlush:第一次操作立刻写一次,避免极端情况下"开头丢"
 *   - requestIdleCallback 错峰主线程
 *   - 离开页面前 flushSync 强制落盘
 */

const ACTIVE_PERSISTERS = new Set()

function safeNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * 通用 idle-aware debounce。
 *  options:
 *    wait: ms,默认 250
 *    leading: 第一次立即触发,默认 false
 *    idle: 用 requestIdleCallback 错峰,默认 true
 */
export function idleDebounce(fn, options = {}) {
  const wait = safeNumber(options.wait, 250)
  const useIdle = options.idle !== false
  const leading = options.leading === true

  let timer = null
  let leadingDone = false
  let pendingArgs = null

  const invoke = () => {
    const args = pendingArgs || []
    pendingArgs = null
    leadingDone = false
    const run = () => {
      try { fn(...args) } catch (e) { console.warn('throttledPersist invoke fail:', e) }
    }
    if (useIdle && typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 1500 })
    } else {
      run()
    }
  }

  function debounced(...args) {
    pendingArgs = args
    if (leading && !leadingDone) {
      leadingDone = true
      invoke()
      return
    }
    if (timer) clearTimeout(timer)
    timer = setTimeout(invoke, wait)
  }

  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
      invoke()
    }
  }
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    pendingArgs = null
    leadingDone = false
  }

  return debounced
}

/**
 * 创建一个针对某个 store/key 的节流持久化器。
 *
 *   options:
 *     key:        诊断标识
 *     getValue:   () => 当前值(必填)
 *     serialize:  (value) => string,默认 JSON.stringify
 *     write:      (blob) => void(必填)
 *     wait:       默认 250
 *     leading:    默认 false
 *     onError:    (e) => void
 *
 *   返回函数(每次调用都会触发一次节流写入)
 *   附带 flush() / cancel() / now()
 */
export function createThrottledPersister(options = {}) {
  const key = String(options.key || 'unknown-store')
  const getValue = typeof options.getValue === 'function' ? options.getValue : () => null
  const serialize = typeof options.serialize === 'function' ? options.serialize : v => JSON.stringify(v)
  const write = typeof options.write === 'function' ? options.write : null
  if (!write) {
    throw new Error(`throttledPersist[${key}]: missing write()`)
  }

  const onError = typeof options.onError === 'function' ? options.onError : (e) => {
    console.warn(`throttledPersist[${key}] write fail:`, e)
  }

  let lastSerialized = ''   // 同值跳过写入,避免无意义 IO

  const doWrite = () => {
    let value, blob
    try {
      value = getValue()
      blob = serialize(value)
    } catch (e) {
      onError(e)
      return
    }
    if (blob === lastSerialized) return
    try {
      write(blob)
      lastSerialized = blob
    } catch (e) {
      onError(e)
    }
  }

  const debounced = idleDebounce(doWrite, {
    wait: safeNumber(options.wait, 250),
    leading: options.leading === true,
    idle: options.idle !== false
  })

  const persister = function (...args) {
    return debounced(...args)
  }
  persister.flush = () => debounced.flush()
  persister.cancel = () => debounced.cancel()
  persister.now = () => doWrite()
  persister.key = key

  ACTIVE_PERSISTERS.add(persister)
  return persister
}

/**
 * 强制把所有活跃 persister 立即落盘(beforeunload 时调用)。
 */
export function flushAllPersisters() {
  for (const p of ACTIVE_PERSISTERS) {
    try { p.flush() } catch (_) {}
  }
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('beforeunload', flushAllPersisters)
  } catch (_) {}
}

export default {
  createThrottledPersister,
  idleDebounce,
  flushAllPersisters
}
