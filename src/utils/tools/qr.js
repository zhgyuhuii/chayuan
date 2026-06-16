// 二维码渲染：用 qrcode 库出 PNG dataURL。依赖浏览器(toDataURL 内部用 canvas),仅在 WPS/浏览器运行。
import QRCode from 'qrcode'

// 返回 Promise<dataURL>
export function renderQr(value, sizePx) {
  return QRCode.toDataURL(String(value), { width: Math.max(40, Number(sizePx) || 160), margin: 1 })
}
