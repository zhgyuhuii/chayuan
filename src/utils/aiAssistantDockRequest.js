/**
 * aiAssistantDockRequest - 停靠形态切换的跨 webview 请求通道。
 *
 * 为什么需要：停靠/悬浮的编排（CreateTaskPane/ShowDialog/Delete）必须在 ribbon
 * 基座 webview 里执行——浮窗（ShowDialog）上下文里调 CreateTaskPane 在部分宿主
 * 会连带顶掉浮窗且面板不渲染（2026-10-06 WPP 真机实证）；停靠面板页里调 Delete
 * 可能连带销毁自身 webview。基座 webview 三宿主常驻（图标 GetImage 即运行于此），
 * 由它统一执行，发起方（浮窗/面板页）只发请求等结果。
 *
 * 通道：localStorage + storage 事件（与 aiAssistantWindowManager 同机制同域；
 * 按宿主分域后缀，三宿主互不串扰）。请求键每次写入带新 requestId，结果键由
 * ribbon webview 写回，发起方监听/轮询双保险。
 */
import { detectAddonType } from './host/hostType.js'

const hostSuffix = () => `_${detectAddonType()}`
const requestKey = () => `nd_ai_assistant_dock_request${hostSuffix()}`
const resultKey = () => `nd_ai_assistant_dock_result${hostSuffix()}`

const RESULT_TIMEOUT_DEFAULT_MS = 30000 // 基座编排最坏路径：ready 15s + 尺寸验证 9s + 余量

export { requestKey as dockRequestStorageKey, resultKey as dockResultStorageKey }

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * 发送形态切换请求（发起方：浮窗/面板页）。
 * @param {'float'|'left'|'right'|'bottom'} action float=转浮窗，其余=停靠方向
 * @param {object} query 透传给 openFloat/dockTo 的 query（prompt 等）
 * @returns {{requestId:string}|null} 写入失败返回 null
 */
export function sendDockSwitchRequest(action, query = {}) {
  const requestId = `dock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const ok = writeJson(requestKey(), {
    requestId,
    action: String(action || ''),
    query: query || {},
    requestedAt: Date.now()
  })
  return ok ? { requestId } : null
}

/**
 * 等待基座执行结果（发起方调用）。storage 事件 + 轮询双保险（同源跨 webview
 * 的 storage 事件依赖 WPS webview 实现，轮询兜底）。
 * @returns {Promise<{ok:boolean, reason?:string, mode?:string}|null>}
 *   null=基座无响应（超时）；超时不代表失败——基座可能仍在执行，调用方按
 *   「未完成」提示并保持当前形态。
 */
export function awaitDockSwitchResult(requestId, timeoutMs = RESULT_TIMEOUT_DEFAULT_MS) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    let timer = null
    let poll = null
    const cleanup = () => {
      if (timer) window.clearTimeout(timer)
      if (poll) window.clearInterval(poll)
      window.removeEventListener('storage', onStorage)
    }
    const check = () => {
      const result = readJson(resultKey())
      if (result && result.requestId === requestId) {
        cleanup()
        resolve(result.result ?? { ok: false, reason: result.reason || 'unknown' })
        return true
      }
      return false
    }
    const onStorage = (event) => {
      if (event.key === resultKey()) check()
    }
    if (check()) return
    window.addEventListener('storage', onStorage)
    poll = window.setInterval(check, 250)
    timer = window.setTimeout(() => {
      cleanup()
      resolve(null)
    }, timeoutMs)
  })
}

/**
 * 基座侧：注册请求监听（ribbon.js OnAddinLoad 调用，每个基座 webview 一次）。
 * 执行传入的 runner（基座自己的 dockManager 动作），结果写回结果键。
 * @param {(action:string, query:object)=>Promise<{ok:boolean,reason?:string,mode?:string}>} runner
 */
export function registerDockSwitchRunner(runner) {
  const onStorage = (event) => {
    if (event.key !== requestKey()) return
    let payload = null
    try {
      payload = event.newValue ? JSON.parse(event.newValue) : null
    } catch {
      payload = null
    }
    if (!payload || !payload.requestId || !payload.action) return
    // 并发保护：同一时刻只处理一个请求；过旧请求（>20s）丢弃
    if (registerDockSwitchRunner._busy) return
    if (Date.now() - Number(payload.requestedAt || 0) > 20000) return
    registerDockSwitchRunner._busy = true
    Promise.resolve()
      .then(() => runner(String(payload.action), payload.query || {}))
      .catch((e) => ({ ok: false, reason: String(e?.message || e) }))
      .then((result) => {
        writeJson(resultKey(), {
          requestId: payload.requestId,
          result: result || { ok: false, reason: 'runner-empty-result' },
          finishedAt: Date.now()
        })
        registerDockSwitchRunner._busy = false
      })
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
