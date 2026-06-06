/**
 * qrcode — 本地二维码生成（离线、不依赖外部服务，保护隐私）
 *
 * 统一封装 node-qrcode 的浏览器实现，供购买引导弹窗 / 控制面板购买入口复用。
 * 返回 PNG dataURL，可直接作为 <img :src>。
 */
import QRCode from 'qrcode'

/**
 * 生成二维码 dataURL。
 * @param {string} text - 编码内容（通常是购买链接）
 * @param {number} size - 像素边长，默认 160
 * @returns {Promise<string>} data:image/png;base64,... ；失败返回空串
 */
export async function toDataUrl(text, size = 160) {
  try {
    return await QRCode.toDataURL(String(text || ''), {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#1e293b', light: '#ffffff' },
    })
  } catch (e) {
    return ''
  }
}

export default { toDataUrl }
