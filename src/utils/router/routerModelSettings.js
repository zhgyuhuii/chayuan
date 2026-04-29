/**
 * routerModelSettings — 路由模型与对话模型解耦
 *
 * v2 计划:路由判定用小/快模型(温度 0,200 token),对话用大模型。
 * 当前项目里只有一个 defaultModelId,两者共用。
 *
 * 这里实现:
 *   - getRouterModelId() / setRouterModelId(id)
 *   - 默认值:取 defaultModelId(向后兼容);用户改了就独立保存
 *   - resolveRouterModel():返回 { providerId, modelId },作为 routerCall 的 model 入参
 */

import {
  getDefaultModelId,
  parseModelCompositeId
} from '../modelSettings.js'
import { loadGlobalSettings, saveGlobalSettings } from '../globalSettings.js'

const KEY = 'routerModelId'

export function getRouterModelId() {
  const settings = loadGlobalSettings()
  const explicit = settings[KEY]
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim()
  return getDefaultModelId() || null
}

export function setRouterModelId(modelId) {
  const v = String(modelId || '').trim()
  if (!v) {
    // 清空 = 跟随 defaultModelId
    saveGlobalSettings({ [KEY]: null })
    return null
  }
  saveGlobalSettings({ [KEY]: v })
  return v
}

/** 是否显式独立设置(true)还是跟随 default(false)。 */
export function isRouterModelIndependent() {
  const settings = loadGlobalSettings()
  return typeof settings[KEY] === 'string' && settings[KEY].trim() !== ''
}

/** 解析为 { providerId, modelId };找不到 → null。 */
export function resolveRouterModel() {
  const id = getRouterModelId()
  if (!id) return null
  const parsed = parseModelCompositeId(id)
  if (!parsed?.providerId || !parsed?.modelId) return null
  return parsed
}

export default {
  getRouterModelId,
  setRouterModelId,
  isRouterModelIndependent,
  resolveRouterModel
}
