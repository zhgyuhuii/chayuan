/**
 * 每 webview 的 MCP Agent 自启（桥接可靠性兜底）。
 *
 * 注册原先只挂在 ribbon 主 webview 的 OnAddinLoad 上，且动态 import 单发、
 * 失败只 warn 一次（实测 2026-09-17：wpsjs debug 反复重启仍报「WPS 桥接未连接」；
 * vite dev 按需编译竞态、jsaddons 安全层 jsaddinblockhost 对加载项 webview 的
 * 环回拦截，任一环节失败即注册路径永久死亡）。而 ShowDialog 浮窗等其它 webview
 * 访问 sidecar 是通的——现在所有 webview（ribbon/浮窗/停靠面板）各自起长轮询：
 * 任意窗口活着桥接就在，不再依赖单一窗口。
 *
 * 多 agent 并存是 agentHub 的既定语义（long-poll 按 agentId 派发 job，dispatch
 * 与写锁在任一 webview 行为一致）；webview 关闭后其 agent 靠心跳超时自然退场。
 */
const IMPORT_RETRY_DELAYS = [1000, 3000, 9000]

let starting = false

export function startAutoAgent() {
  if (starting) return
  // 无 window.Application 的 webview（部分 ShowDialog 浮窗）不能执行 WPS job——
  // 接到文档调用会永久挂起（sidecar 侧超时、任务平白失败）。这类窗口不注册，
  // 长轮询交给 ribbon/TaskPane 等有真 API 的 webview。typeof 探测为纯 JS 检查，
  // 不触碰桥、不会挂起。
  if (typeof window.Application === 'undefined') {
    console.info('[autoAgent] skip: no window.Application in this webview', String(window.location?.pathname || ''))
    return
  }
  starting = true
    ; (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const m = await import('./agentClient.js')
          m.startMcpAgent()
          console.info('[autoAgent] MCP Agent long-poll started', String(window.location?.pathname || ''))
          return
        } catch (e) {
          if (attempt >= IMPORT_RETRY_DELAYS.length) {
            console.warn('[autoAgent] MCP Agent start failed after retries:', e)
            return
          }
          await new Promise((resolve) => setTimeout(resolve, IMPORT_RETRY_DELAYS[attempt]))
        }
      }
    })()
}
