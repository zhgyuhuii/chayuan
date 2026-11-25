/**
 * agentImageTier — 三级生图 Tier1（模型生图）的 webview 侧执行链。
 *
 * agent 循环里的 generate_image 原本只有 sidecar 原生通道（dataDir/image-gen.json
 * 手工配置），设置页里配置的图像生成模型到不了 agent —— Tier1 实际是死的。
 * 这里把「默认设置 → 图像生成」里启用的模型接进来：
 *   逐个模型尝试 mediaApi.generateImageAsset（阿里百炼原生/ OpenAI 兼容双通道
 *   已内置）→ 产物 base64 落盘 → 返回本地路径给插入工具（picture_add / image）。
 *
 * 落盘双通道（2026-11-25 生图 EPERM 治理，同日二次修正顺序）：
 *   ① webview FileSystem.writeAsBinaryString 写 Env.GetTempPath()——WPS 自己写
 *     自己沙盒，AddPicture 必然可读（手动文生图同款通道，真机验证）
 *   ② 失败 → sidecar /tmp-image（容器 tmp-images 候选链 → dataDir 回落）
 *   两通道全败 → 立即终止模型队列（reason:'persist-failed'）——落盘失败与模型
 *   无关，换模型只会重复付费并在同一点失败。
 *
 * 三级铁律（照抄 chayuan-office image-source 共识 #3）：本模块只做模型生图；
 * 全部失败返回 ok:false，由调用方（agentCoreSkill）回落 sidecar 原生通道
 * （仅 model-failed / no-model），仍失败则模型按配图策略降级 image_search /
 * svg_add —— 绝不静默替位。
 */

import { getFlatModelsFromSettings } from '../../utils/modelSettings.js'
import { getDefaultModelIdForCategory } from '../../utils/assistantSettings.js'
import { generateImageAsset } from '../../utils/mediaApi.js'
import { uploadTmpImage } from '../mcpBridge/mcpHttpClient.js'
// 轻量写入层（勿改回 documentActions：其重依赖链会撞冒烟打包 stub 缺口）
import { saveGeneratedAssetToFile } from '../../utils/generatedMediaWriter.js'

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

/** 扩展名 → MIME（data URL 用；未知回落 png） */
function mimeFromExt(ext) {
  const e = String(ext || '').toLowerCase()
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg'
  if (e === 'webp') return 'image/webp'
  if (e === 'gif') return 'image/gif'
  return 'image/png'
}

/**
 * canvas 缩略图：最长边 ≤512px 的 dataURL（webview 里有 canvas；生成即小图，
 * 不受原尺寸/体积影响——对话直显、放大兜底、下载兜底全靠它）。失败返回空串。
 */
function makeThumbFromBase64(base64, mime, maxPx = 512) {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.onload = () => {
        try {
          const scale = Math.min(1, maxPx / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
          const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale))
          const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale))
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) { resolve(''); return }
          ctx.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL(mime === 'image/png' ? 'image/png' : 'image/jpeg', 0.85))
        } catch { resolve('') }
      }
      img.onerror = () => resolve('')
      img.src = `data:${mime};base64,${base64}`
    } catch { resolve('') }
  })
}

/**
 * 落盘双通道（2026-11-25 二次修正——顺序反转）：
 * ① webview FileSystem.writeAsBinaryString 写 Env.GetTempPath()——WPS 自己写自己
 *    沙盒，AddPicture 必然可读（手动文生图同款通道）；sidecar 通道在本机实测
 *    容器路径 EPERM → 回落 dataDir（~/.config，容器外）→ AddPicture 读不到，
 *    插入必然失败，所以它只能当兜底而非主通道。
 * ② sidecar /tmp-image（容器路径优先、dataDir 回落）——给无法走 webview
 *    FileSystem 的极端环境兜底。
 * base64 原样带出；thumb（canvas 512px dataURL）供对话直显/放大/下载——
 * 路径在容器外或不可读时图片仍然可见可用。
 * @returns {Promise<{ok: true, path: string, via: string, base64: string, mime: string, thumb: string, full: string} | {ok: false, error: string}>}
 */
async function persistImageAsset(asset, { signal } = {}) {
  const mime = mimeFromExt(asset.extension)
  try {
    const path = saveGeneratedAssetToFile(
      { base64: asset.base64, extension: asset.extension || 'png' },
      { prefix: 'gen_image' }
    )
    const thumb = await makeThumbFromBase64(asset.base64, mime)
    return {
      ok: true,
      path,
      via: 'webview-temp',
      base64: asset.base64,
      mime,
      thumb,
      full: `data:${mime};base64,${asset.base64}`
    }
  } catch (e) {
    const webviewErr = String(e.message || e).slice(0, 160)
    try {
      const saved = await uploadTmpImage(asset.base64, asset.extension || 'png', { signal })
      if (saved?.path) {
        const thumb = await makeThumbFromBase64(asset.base64, mime)
        return {
          ok: true,
          path: saved.path,
          via: 'sidecar-tmp-image',
          base64: asset.base64,
          mime,
          thumb,
          full: `data:${mime};base64,${asset.base64}`
        }
      }
      throw new Error(saved?.error || 'sidecar 落盘无路径返回')
    } catch (e2) {
      return {
        ok: false,
        error: `落盘两通道全败：webview ${webviewErr}；sidecar ${String(e2.message || e2).slice(0, 160)}`
      }
    }
  }
}

/**
 * @returns {Promise<
 *   | { ok: true, tier: 'model', path: string, modelId: string, providerId: string, via: string, thumb: string, full: string }
 *   | { ok: false, reason: 'bad-input'|'no-model'|'aborted'|'model-failed'|'persist-failed', error?: string, errors?: string[], hint?: string }
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
    // ① 生成阶段（模型相关）：失败才换下一个模型
    let asset
    try {
      asset = await generateImageAsset({
        providerId: m.providerId,
        modelId: m.modelId,
        prompt: p,
        aspectRatio: String(aspectRatio || '').trim(),
        signal
      })
      if (!asset?.base64) throw new Error('生图结果为空')
    } catch (e) {
      if (signal?.aborted) return { ok: false, reason: 'aborted', error: '已停止' }
      errors.push(`${m.name || m.modelId}: ${String(e.message || e).slice(0, 120)}`)
      continue
    }
    // ② 落盘阶段（与模型无关）：sidecar 容器路径失败 → webview 临时目录兜底
    const persist = await persistImageAsset(asset, { signal })
    if (persist.ok) {
      return {
        ok: true,
        tier: 'model',
        path: persist.path,
        modelId: m.modelId,
        providerId: m.providerId,
        via: persist.via,
        base64: persist.base64,
        mime: persist.mime
      }
    }
    return {
      ok: false,
      reason: 'persist-failed',
      error: `${persist.error}（模型 ${m.name || m.modelId} 已生成成功，仅落盘失败）`,
      hint: '落盘失败与生图模型无关，换模型重试只会重复付费：请检查磁盘权限（macOS 完全磁盘访问授权 chayuan-mcp）或重启 WPS 后重试。'
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
