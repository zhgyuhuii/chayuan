/**
 * agentImageTier — 三级生图 Tier1（模型生图）的 webview 侧执行链。
 *
 * agent 循环里的 generate_image 原本只有 sidecar 原生通道（dataDir/image-gen.json
 * 手工配置），设置页里配置的图像生成模型到不了 agent —— Tier1 实际是死的。
 * 这里把「默认设置 → 图像生成」里启用的模型接进来：
 *   逐个模型尝试 mediaApi.generateImageAsset（阿里百炼原生/ OpenAI 兼容双通道
 *   已内置）→ 产物 base64 经 sidecar /tmp-image 落盘到 WPS 容器可读路径 →
 *   返回本地路径给插入工具（picture_add / image）。
 *
 * 三级铁律（照抄 chayuan-office image-source 共识 #3）：本模块只做模型生图；
 * 全部失败返回 ok:false，由调用方（agentCoreSkill）回落 sidecar 原生通道，
 * 仍失败则模型按配图策略降级 image_search / svg_add —— 绝不静默替位。
 */

import { getFlatModelsFromSettings } from '../../utils/modelSettings.js'
import { getDefaultModelIdForCategory } from '../../utils/assistantSettings.js'
import { generateImageAsset } from '../../utils/mediaApi.js'
import { uploadTmpImage } from '../mcpBridge/mcpHttpClient.js'

const MAX_MODEL_ATTEMPTS = 3

/**
 * 尝试队列：用户在「设置 → 默认设置 → 图像生成模型」选定的默认模型排到队首，
 * 其余已启用厂商的图像模型按原顺序作后备（默认模型不可用时仍能自动补位）。
 * 存储里的 composite id 已失效（厂商被停用等）时队列保持原样。
 */
function orderModelsByDefault(models) {
  const ordered = models.slice()
  let defaultId = ''
  try {
    defaultId = String(getDefaultModelIdForCategory('image') || '')
  } catch { /* PluginStorage 不可用按无默认 */ }
  if (!defaultId) return ordered
  const idx = ordered.findIndex(m => m.id === defaultId)
  if (idx > 0) ordered.unshift(...ordered.splice(idx, 1))
  return ordered
}

/**
 * @returns {Promise<
 *   | { ok: true, tier: 'model', path: string, modelId: string, providerId: string }
 *   | { ok: false, reason: 'bad-input'|'no-model'|'aborted'|'model-failed', error?: string, errors?: string[] }
 * >}
 */
export async function generateImageViaModelChain({ prompt, aspectRatio, signal } = {}) {
  const p = String(prompt || '').trim()
  if (!p) return { ok: false, reason: 'bad-input', error: '缺少生图描述 prompt' }
  if (signal?.aborted) return { ok: false, reason: 'aborted', error: '已停止' }

  const models = getFlatModelsFromSettings('image-generation')
  if (!models.length) {
    return {
      ok: false,
      reason: 'no-model',
      error: '未配置图像生成模型（设置 → 默认设置 → 图像生成）'
    }
  }

  const errors = []
  const ordered = orderModelsByDefault(models)
  for (const m of ordered.slice(0, MAX_MODEL_ATTEMPTS)) {
    try {
      const asset = await generateImageAsset({
        providerId: m.providerId,
        modelId: m.modelId,
        prompt: p,
        aspectRatio: String(aspectRatio || '').trim(),
        signal
      })
      if (!asset?.base64) throw new Error('生图结果为空')
      // 落盘到 WPS 容器可读目录（与 image_search 下载目录同层），插入工具直接可用
      const saved = await uploadTmpImage(asset.base64, asset.extension || 'png', { signal })
      if (!saved?.path) throw new Error('生图结果落盘失败')
      return {
        ok: true,
        tier: 'model',
        path: saved.path,
        modelId: m.modelId,
        providerId: m.providerId
      }
    } catch (e) {
      if (signal?.aborted) return { ok: false, reason: 'aborted', error: '已停止' }
      errors.push(`${m.name || m.modelId}: ${String(e.message || e).slice(0, 120)}`)
    }
  }
  return {
    ok: false,
    reason: 'model-failed',
    errors,
    error: `已启用的图像生成模型全部调用失败（${errors.join('；')}）。请到 设置 → 默认设置 → 图像生成模型 检查所选模型的密钥、API 地址与生图权限，无需重启应用。`
  }
}

export default { generateImageViaModelChain }
