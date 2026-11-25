/**
 * 助手 headless 执行容器（助手 agent 化 A-3）
 *
 * 无 UI 的助手执行入口：ribbon 简单助手（轻通知）、工作流 assistant-invoke 节点、
 * formFieldExtractService 等 programmatic 消费方共用。
 *
 * 容器职责（三审 P0-2 修正）：
 *  1. 并发上限：同 webview 并发 headless ≤2（对齐 chatTurnRunner MAX_CONCURRENT_TURNS），
 *     超额 FIFO 排队——防止工作流并行回合把单条长轮询/job 队列压垮互踩；
 *  2. 目标文档身份注入：发起侧取当前活动对象 FullName 注入 __expectedDocId 保留字段，
 *     写回派发（dispatch 写锁）排队期间比对身份，防切档写错文件；
 *  3. 不在 dispatch handler 内 await（本容器从面板/ribbon 侧发起 callLocalTool，
 *     经 sidecar→agentHub 异步派发，天然不占基座 dispatch 互斥——ack/detached 语义）。
 */

import { runAssistantAgentExecution } from './assistantAgentTurn.js'

const MAX_CONCURRENT_HEADLESS = 2

let _active = 0
const _waiters = []

function acquireSlot() {
  if (_active < MAX_CONCURRENT_HEADLESS) {
    _active++
    return Promise.resolve()
  }
  return new Promise((resolve) => _waiters.push(resolve))
}

function releaseSlot() {
  _active = Math.max(0, _active - 1)
  const next = _waiters.shift()
  if (next) {
    _active++
    next()
  }
}

/** 宿主感知取当前活动对象身份（与 dispatch.js getHostActiveObjectId 同语义的发起侧版本） */
function getActiveObjectId() {
  try {
    const app = window.Application
    const probe = (get) => {
      try {
        const obj = get()
        return obj ? String(obj.FullName || obj.Name || '') : ''
      } catch {
        return ''
      }
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

/**
 * headless 执行一个助手任务（无 UI，事件回调默认空）。
 * @param {object} opts 与 runAssistantAgentExecution 同参，另加：
 * @param {string} [opts.expectDocId] 显式指定目标文档身份（缺省取发起时活动对象）
 * @returns runAssistantAgentExecution 结果（另含 queuedMs 排队耗时）
 */
export async function runAssistantHeadless(opts = {}) {
  // 目标文档身份在入队前采样（三审 P1-2：排队期间用户切档，出队后 pin 到新文档
  // 会把本该拦截的切档放行成写进另一篇）；显式 opts.expectDocId 优先。
  const expectDocId = String(opts.expectDocId || getActiveObjectId() || '')
  const queuedAt = Date.now()
  await acquireSlot()
  const queuedMs = Date.now() - queuedAt
  try {
    return await runAssistantAgentExecution({
      ...opts,
      expectDocId,
      events: opts.events || {}
    })
  } finally {
    releaseSlot()
  }
}

/** 仅供测试/监控：当前并发水位 */
export function headlessActiveCount() {
  return _active
}
