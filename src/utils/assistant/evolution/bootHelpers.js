/**
 * bootHelpers — 进化系统启动的"自动接线"辅助
 *
 * 项目里"当前默认模型"通过 modelSettings.getDefaultModelId() 取(composite id),
 * 用 parseModelCompositeId 拆为 { providerId, modelId }。
 * 这里把"读模型 → 调 bootEvolutionSystem"打包成一个静默 helper:
 *   - 找不到默认模型 → 返回 null,不报错(用户可能还没配)
 *   - 已经 boot 过 → 返回当前 stop 函数(不重复 boot)
 *   - 成功 boot → 返回新的 stop 函数
 *
 * 用法(在 App.vue onMounted 或 main.js 末尾):
 *   import { tryAutoBoot } from '@/utils/assistant/evolution/bootHelpers.js'
 *   tryAutoBoot()
 *
 * 用法(在 SettingsDialog 的"保存默认模型"按钮里):
 *   await saveDefaultModelId(...)
 *   tryAutoBoot()  // 用户刚配好模型 → 立即启动进化
 */

import { getDefaultModelId, parseModelCompositeId } from '../../modelSettings.js'
import { bootEvolutionSystem, getCurrentEvolutionDeps } from './evolutionBoot.js'

let _autoBootStopFn = null

/**
 * 从项目现有 modelSettings 解析当前默认模型。
 * 返回 { providerId, modelId } 或 null。
 */
export function resolveCurrentModel() {
  const compositeId = getDefaultModelId()
  if (!compositeId) return null
  const parsed = parseModelCompositeId(compositeId)
  if (!parsed?.providerId || !parsed?.modelId) return null
  return parsed
}

/**
 * 尝试自动启动进化系统:
 *   - 已 boot 且 model 没变 → no-op,返回当前 stopFn
 *   - 没 model 配置 → no-op,返回 null
 *   - 配置成功 → boot,返回 stopFn
 *
 * 失败永远不抛 — 进化系统是辅助功能,不该阻塞主流程。
 */
export function tryAutoBoot(options = {}) {
  // 已 boot:不重复
  if (getCurrentEvolutionDeps()) return _autoBootStopFn

  const model = resolveCurrentModel()
  if (!model) {
    if (options.verbose && typeof console !== 'undefined') {
      console.info('[evolution] tryAutoBoot 跳过:未配置默认模型')
    }
    return null
  }

  try {
    _autoBootStopFn = bootEvolutionSystem({
      model,
      checkIntervalMs: options.checkIntervalMs,
      maxParallel: options.maxParallel,
      runSample: options.runSample
    })
    if (typeof console !== 'undefined') {
      console.info(`[evolution] auto-boot 完成 · model=${model.providerId}/${model.modelId}`)
    }
    return _autoBootStopFn
  } catch (e) {
    if (typeof console !== 'undefined') {
      console.warn('[evolution] auto-boot 失败,稍后可重试:', e?.message || e)
    }
    return null
  }
}

/**
 * 若已自动启动 → stop 并清缓存;
 * 用户切换模型时可先 stop 再 tryAutoBoot,等价于 reboot。
 */
export function stopAutoBoot() {
  if (typeof _autoBootStopFn === 'function') {
    try { _autoBootStopFn() } catch (_) {}
  }
  _autoBootStopFn = null
}

/** 模型切换:先停再起,等价于"重新接线"。 */
export function rebootForModelChange(options = {}) {
  stopAutoBoot()
  return tryAutoBoot(options)
}

export default {
  resolveCurrentModel,
  tryAutoBoot,
  stopAutoBoot,
  rebootForModelChange
}
