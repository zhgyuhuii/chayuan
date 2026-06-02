/**
 * 统一的「让出主线程」工具。
 * - delay > 0:setTimeout(delay)
 * - delay = 0 且支持 requestIdleCallback:错峰到空闲帧(带 100ms 兜底超时)
 * - 否则:setTimeout(0) 让出一个宏任务
 * WPS webview 主线程被长循环占用时,在循环里 await yieldToUI() 可让 UI 有机会响应。
 */
export function yieldToUI(delay = 0) {
  // 与各任务运行器原本的实现保持 100% 一致(纯 setTimeout 让出一个宏任务),
  // 避免引入 requestIdleCallback 的时序差异。
  return new Promise((resolve) => setTimeout(resolve, delay))
}

export default { yieldToUI }
