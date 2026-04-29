/**
 * modelCommands — 把"切换默认模型"做成 ⌘K 命令
 *
 * 思路:
 *   - 每个已启用的 chat 模型注册成一条命令(`model.set.<compositeId>`)
 *   - 一条 `model.show.current` 看当前是什么
 *   - 一条 `model.refresh` 重新读模型表(添加新 provider 后可调)
 *
 * 切换模型会触发 rebootForModelChange,让进化系统在新模型下立即生效。
 *
 * 注册时机:
 *   App.vue 在 ribbon onAddinLoad 之后调用 registerModelCommands();
 *   未来用户通过 SettingsDialog 添加/启用了新模型,可调 model.refresh 命令重新注册。
 */

import { registerCommands, unregisterByGroup } from './commandRegistry.js'
import {
  getFlatModelsFromSettings,
  getDefaultModelId,
  setDefaultModelId
} from '../modelSettings.js'
import { rebootForModelChange } from '../assistant/evolution/bootHelpers.js'

const GROUP = '模型'

function buildModelEntry(model, currentDefaultId) {
  const isCurrent = model.id === currentDefaultId
  return {
    id: `model.set.${model.id}`,
    group: GROUP,
    icon: isCurrent ? '✓' : '◯',
    title: `${isCurrent ? '当前 · ' : ''}切换到「${model.name}」`,
    subtitle: `${model.providerId}/${model.modelId}`,
    keywords: [model.name, model.modelId, model.providerId, 'switch', 'default', '默认', '切换'],
    priority: isCurrent ? 0 : 10,   // 当前模型不需要再高亮(已是默认)
    handler: () => {
      try {
        setDefaultModelId(model.id)
        if (typeof console !== 'undefined') {
          console.info(`[model] 默认模型已切换 → ${model.providerId}/${model.modelId}`)
        }
      } catch (e) {
        if (typeof console !== 'undefined') console.error('[model] 切换失败:', e?.message || e)
        return
      }
      // 让进化系统跟着切
      try { rebootForModelChange() } catch (_) { /* 进化是辅助,失败不阻塞 */ }
    }
  }
}

function buildMetaEntries(currentDefaultId, refreshFn) {
  return [
    {
      id: 'model.show.current',
      group: GROUP,
      icon: '🎯',
      title: '查看当前默认模型',
      keywords: ['current', 'show', '当前', '默认'],
      priority: 50,
      handler: () => {
        if (typeof console === 'undefined') return
        if (!currentDefaultId) console.log('[model] 当前未设置默认模型')
        else console.log(`[model] 当前默认模型:${currentDefaultId}`)
      }
    },
    {
      id: 'model.refresh',
      group: GROUP,
      icon: '↻',
      title: '刷新模型清单(添加 / 启用了新 provider 后调用)',
      keywords: ['refresh', 'reload', '刷新'],
      priority: 5,
      handler: () => {
        const stop = refreshFn()
        if (typeof console !== 'undefined') {
          console.info(`[model] 已重新注册 ${stop?.length || '未知'} 条模型命令`)
        }
      }
    }
  ]
}

/**
 * 注册当前所有可用的 chat 模型作为 ⌘K 命令。
 * 返回 unregister 函数。
 *
 *   options.modelType: 'chat' | 'embedding' | 'vision' | ...(默认 'chat')
 *   options.maxModels: 限制条数(过多会让面板冗余,默认 20)
 */
export function registerModelCommands(options = {}) {
  const modelType = options.modelType || 'chat'
  const maxModels = Math.max(3, Math.min(options.maxModels || 20, 50))

  // 内部 refresh:先反注册整组,再重新注册当前列表。返回新的 unreg。
  let _currentUnreg = null
  const refresh = () => {
    if (_currentUnreg) { try { _currentUnreg() } catch (_) {} _currentUnreg = null }
    try { unregisterByGroup(GROUP) } catch (_) {}
    return doRegister()
  }

  function doRegister() {
    const currentDefaultId = getDefaultModelId() || ''
    const flat = (getFlatModelsFromSettings(modelType) || []).slice(0, maxModels)
    const cmds = [
      ...buildMetaEntries(currentDefaultId, refresh),
      ...flat.map(m => buildModelEntry(m, currentDefaultId))
    ]
    _currentUnreg = registerCommands(cmds)
    return cmds
  }

  doRegister()

  return function unregisterAll() {
    if (_currentUnreg) { try { _currentUnreg() } catch (_) {} _currentUnreg = null }
    try { unregisterByGroup(GROUP) } catch (_) {}
  }
}

export default {
  registerModelCommands
}
