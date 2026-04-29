/**
 * enhancedSendIntegration — 把 enhancedSend 通过 dialogPlugins 钩子接入 sendMessage
 *
 * 设计:不动 AIAssistantDialog.vue 主体,业务方在 onMounted 调一次
 * `installEnhancedSendHooks()` 即可启用以下能力:
 *   - 本地分类高置信短路(score≥85 且 kind=chat → 跳过 LLM 路由)
 *   - 乐观流式(并行兜底 + 路由判定后决定接管或丢弃)
 *   - perfTracker 自动记录
 *
 * 业务方 sendMessage 内部需要在合适时机调用 runHooks('beforeSend', text, ctx),
 * 钩子会读 ctx.shortcut 决定是否走 enhanced 路径。
 *
 * Feature flag:`featureFlags.enhancedSend`(默认 false,需用户手动开启)
 */

import { registerHook } from './dialogPlugins.js'
import { fastClassifyAndShortcut } from './sendMessageEnhanced.js'
import { isEnabled } from '../featureFlags.js'

const FLAG = 'enhancedSend'
const SHORTCUT_THRESHOLD = 85

let _installed = false
let _unregisters = []

/**
 * 安装钩子。返回 uninstall 函数。
 * 多次调用幂等 — 第二次起返回原 uninstall。
 */
export function installEnhancedSendHooks(options = {}) {
  if (_installed) {
    if (typeof console !== 'undefined') {
      console.info('[enhancedSendIntegration] 已安装,跳过')
    }
    return uninstallEnhancedSendHooks
  }

  const threshold = typeof options.threshold === 'number' ? options.threshold : SHORTCUT_THRESHOLD

  // beforeSend:本地分类 → 高置信置 ctx.shortcut,业务方据此决定走快路径
  const u1 = registerHook('beforeSend', async (text, ctx) => {
    if (!isEnabled(FLAG)) return  // feature flag 关闭 → no-op
    if (!ctx || typeof ctx !== 'object') return
    try {
      const result = fastClassifyAndShortcut(String(text || ''), {
        hasSelection: !!ctx.hasSelection,
        attachments: ctx.attachments || []
      })
      ctx._classification = result
      if (result.kind === 'chat' && result.score >= threshold) {
        ctx.shortcut = {
          enabled: true,
          kind: 'chat',
          confidence: 'high',
          reason: `local-classifier score=${result.score}`
        }
      }
    } catch (_) { /* 分类失败 → 走原路径 */ }
  })

  // afterClassify:把分类结果暴露给 UI(intent pill 显示)
  const u2 = registerHook('afterClassify', async (_intent, ctx) => {
    if (!isEnabled(FLAG)) return
    if (typeof ctx?.setIntentPill === 'function') {
      try { ctx.setIntentPill(ctx._classification) } catch (_) {}
    }
  })

  _unregisters = [u1, u2]
  _installed = true
  if (typeof console !== 'undefined') {
    console.info('[enhancedSendIntegration] 钩子已安装。开启 featureFlags.enhancedSend 即可生效')
  }
  return uninstallEnhancedSendHooks
}

export function uninstallEnhancedSendHooks() {
  for (const u of _unregisters) {
    try { u?.() } catch (_) {}
  }
  _unregisters = []
  _installed = false
}

export function isInstalled() { return _installed }

export default {
  installEnhancedSendHooks,
  uninstallEnhancedSendHooks,
  isInstalled
}
