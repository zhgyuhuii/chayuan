/**
 * chatApiMultimodal — 多模态(图片输入)接口骨架
 *
 * 解决 P6 问题:WPS 文档里的图片不能识别。
 * 用 OpenAI / Anthropic 的多模态消息格式包装图片。
 *
 * 用法:
 *   import { chatWithImages } from '@/utils/chatApiMultimodal.js'
 *
 *   const text = await chatWithImages({
 *     providerId: 'openai',
 *     modelId: 'gpt-4o',
 *     systemPrompt: '描述图片中的内容',
 *     userText: '这张图里有什么?',
 *     images: [{ kind: 'base64', mimeType: 'image/png', data: '...base64...' }]
 *   })
 */

import { chatCompletion } from './chatApi.js'

const VISION_CAPABLE_PATTERNS = [
  /gpt-4o/, /gpt-4-turbo/, /gpt-4-vision/,    // OpenAI
  /claude-3/, /claude-4/, /claude-3-5/,        // Anthropic(需 vision 能力的版本)
  /gemini.*vision|gemini-1\.5|gemini-2/,        // Google
  /qwen.*vl|qwen2-vl/,                          // 通义
  /yi.*vision/                                  // 零一万物
]

export function isVisionCapable(modelId) {
  const id = String(modelId || '').toLowerCase()
  return VISION_CAPABLE_PATTERNS.some(re => re.test(id))
}

/**
 * 把 image 列表转成 OpenAI/Anthropic 多模态消息内容数组。
 *   image:{ kind: 'url' | 'base64', url?, data?, mimeType? }
 *   provider:'openai' / 'anthropic' — 不同 schema
 */
function buildImageContent(images, provider) {
  const out = []
  const isAnthropic = /anthropic|claude/i.test(String(provider || ''))
  for (const img of (images || [])) {
    if (!img) continue
    if (isAnthropic) {
      if (img.kind === 'url') {
        out.push({ type: 'image', source: { type: 'url', url: img.url } })
      } else if (img.kind === 'base64') {
        out.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mimeType || 'image/png',
            data: img.data
          }
        })
      }
    } else {
      // OpenAI 风格(GPT-4 Vision)
      if (img.kind === 'url') {
        out.push({ type: 'image_url', image_url: { url: img.url, detail: img.detail || 'auto' } })
      } else if (img.kind === 'base64') {
        const dataUrl = `data:${img.mimeType || 'image/png'};base64,${img.data}`
        out.push({ type: 'image_url', image_url: { url: dataUrl, detail: img.detail || 'auto' } })
      }
    }
  }
  return out
}

/**
 * 调用多模态聊天。返回 text。
 *   options:
 *     providerId, modelId       必填
 *     systemPrompt              可选
 *     userText                  必填(图片 + 提示)
 *     images                    [{ kind, url? / data?, mimeType?, detail? }]
 *     signal                    AbortSignal
 *
 * 如果 model 不支持 vision → 抛错(让调用方降级文字模式)。
 */
export async function chatWithImages(options = {}) {
  const provider = String(options.providerId || '')
  const model = String(options.modelId || '')
  if (!isVisionCapable(model)) {
    throw new Error(`模型 ${model} 不支持多模态(vision)输入`)
  }
  const images = options.images || []
  if (!images.length) {
    throw new Error('chatWithImages: images 数组不能为空')
  }

  const messages = []
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: String(options.systemPrompt) })
  }

  // user 消息:文本 + 图片混合
  const userContent = []
  userContent.push({ type: 'text', text: String(options.userText || '请看图片') })
  for (const c of buildImageContent(images, provider)) {
    userContent.push(c)
  }
  messages.push({ role: 'user', content: userContent })

  return chatCompletion({
    providerId: options.providerId,
    modelId: options.modelId,
    ribbonModelId: options.ribbonModelId,
    messages,
    signal: options.signal,
    temperature: typeof options.temperature === 'number' ? options.temperature : 0.3,
    max_tokens: options.maxTokens || 1500
  })
}

/**
 * 把 ArrayBuffer / Blob / File 转 base64(浏览器原生 FileReader)。
 */
export async function fileToBase64(file) {
  if (!file) return ''
  if (typeof FileReader === 'undefined') return ''
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.slice(idx + 1) : result)
    }
    reader.onerror = () => reject(new Error('FileReader 读取失败'))
    reader.readAsDataURL(file)
  })
}

export default {
  chatWithImages,
  isVisionCapable,
  fileToBase64
}
