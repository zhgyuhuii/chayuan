/**
 * workflowTelemetryBridge — 把工作流事件接入 perfTracker / signalStore / toast
 *
 * 不修改 workflowRunner 主代码,通过订阅 workflowProgressChannel 事件,
 * 在外部把数据 fan-out 到三个观测系统。
 *
 * 启动:
 *   import { installTelemetryBridge } from '...'
 *   installTelemetryBridge()
 *
 * 关停:返回值是 detach 函数。
 */

import { onEvent } from './workflowProgressChannel.js'
import { startTimer as startPerfTimer } from '../perfTracker.js'
import { appendSignal } from '../assistant/evolution/signalStore.js'
import toast from '../toastService.js'

const _activeTimers = new Map()  // `${instanceId}:${nodeId}` → stopFn

let _installed = false
let _detach = null

export function installTelemetryBridge() {
  if (_installed) return _detach
  _installed = true

  _detach = onEvent(message => {
    const { eventType, instanceId, nodeId, error } = message
    if (!instanceId) return

    switch (eventType) {
      case 'node:run': {
        const key = `${instanceId}:${nodeId}`
        const stop = startPerfTimer({
          kind: `workflow.node.${message.nodeType || 'unknown'}`,
          providerId: 'workflow-engine',
          modelId: instanceId.slice(-8)  // 用 instance 短 id 作 dimension
        })
        _activeTimers.set(key, stop)
        break
      }

      case 'node:done': {
        const key = `${instanceId}:${nodeId}`
        const stop = _activeTimers.get(key)
        if (stop) {
          stop({ ok: true, bytes: message.outputBytes || 0 })
          _activeTimers.delete(key)
        }
        // 不为每个 done 写 signal 以免过密
        break
      }

      case 'node:error': {
        const key = `${instanceId}:${nodeId}`
        const stop = _activeTimers.get(key)
        if (stop) {
          stop({ ok: false, note: String(error?.message || error || '').slice(0, 80) })
          _activeTimers.delete(key)
        }
        // 单独节点出错也写 signal,便于聚类
        try {
          appendSignal({
            type: 'task',
            assistantId: message.assistantId || `workflow.${instanceId.slice(-8)}`,
            success: false,
            failureCode: 'workflow-node-error',
            userNote: String(error?.message || '').slice(0, 200),
            metadata: {
              instanceId,
              nodeId,
              nodeType: message.nodeType,
              attempt: message.attempt
            }
          })
        } catch (_) {}
        break
      }

      case 'workflow:done': {
        try {
          appendSignal({
            type: 'task',
            assistantId: `workflow.${(message.workflowId || instanceId).slice(-8)}`,
            success: true,
            duration: message.durationMs,
            metadata: {
              instanceId,
              workflowId: message.workflowId,
              nodeCount: message.nodeCount,
              parallelHits: message.parallelHits
            }
          })
        } catch (_) {}
        // 大流程完成 → toast(>5 秒才提)
        if (message.durationMs >= 5000 && typeof window !== 'undefined') {
          toast.success('工作流执行完成', {
            detail: `${message.nodeCount || 0} 节点 · ${(message.durationMs / 1000).toFixed(1)}s`,
            timeout: 5000
          })
        }
        break
      }

      case 'workflow:fail': {
        try {
          appendSignal({
            type: 'task',
            assistantId: `workflow.${(message.workflowId || instanceId).slice(-8)}`,
            success: false,
            failureCode: message.failureCode || 'workflow-fail',
            userNote: String(error?.message || message.reason || '').slice(0, 200),
            metadata: { instanceId, failedNodeId: message.failedNodeId }
          })
        } catch (_) {}
        if (typeof window !== 'undefined') {
          toast.error('工作流执行失败', {
            detail: String(error?.message || message.reason || '').slice(0, 100),
            timeout: 8000
          })
        }
        break
      }

      case 'workflow:cancel': {
        // 静默 — 用户主动取消,无需 toast
        try {
          appendSignal({
            type: 'audit',
            assistantId: `workflow.${(message.workflowId || instanceId).slice(-8)}`,
            success: false,
            userNote: 'cancelled by ' + (message.reason || 'user'),
            metadata: { instanceId }
          })
        } catch (_) {}
        break
      }

      case 'workflow:pause': {
        // 暂停 → 提示一下
        if (typeof window !== 'undefined') {
          toast.info('工作流已暂停', {
            detail: message.reason || '等待人工确认',
            timeout: 3000
          })
        }
        break
      }
    }
  })

  return _detach
}

export function uninstallTelemetryBridge() {
  if (_detach) { try { _detach() } catch (_) {} _detach = null }
  for (const stop of _activeTimers.values()) {
    try { stop({ ok: false, note: 'bridge-detached' }) } catch (_) {}
  }
  _activeTimers.clear()
  _installed = false
}

export function isInstalled() { return _installed }

export default {
  installTelemetryBridge,
  uninstallTelemetryBridge,
  isInstalled
}
