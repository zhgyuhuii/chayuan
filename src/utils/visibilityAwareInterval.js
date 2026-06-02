/**
 * 注册一个感知页面可见性的定时器:
 *  - document 隐藏时暂停(clearInterval)
 *  - 恢复可见时续跑(可选立即执行一次)
 * 返回清理函数(移除定时器与 visibilitychange 监听)。
 *
 * 适用:可暂停的 UI 轮询(任务进度、表单模式检测等)。
 * 不适用:多窗口存活心跳 —— 隐藏期间仍需维持存活,不能暂停。
 */
export function registerVisibilityAwareInterval(fn, ms, options = {}) {
  const { runOnVisible = true } = options
  let timerId = null

  function start() {
    if (timerId !== null) return
    if (runOnVisible) { try { fn() } catch (_) { /* 忽略单次回调异常 */ } }
    timerId = setInterval(fn, ms)
  }
  function stop() {
    if (timerId !== null) { clearInterval(timerId); timerId = null }
  }
  function onVisibility() {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'visible') start()
    else stop()
  }

  if (typeof document === 'undefined' || document.visibilityState === 'visible') start()
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)

  return () => {
    stop()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
  }
}

export default { registerVisibilityAwareInterval }
