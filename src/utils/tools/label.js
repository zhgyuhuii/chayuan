// 标签工具编排:解析行 -> 出码(二维码/条码) -> 合成标签图。浏览器,仅在 WPS/浏览器运行。
import { parseLabelRows } from './labelData.js'
import { renderQr } from './qr.js'
import { renderBarcode } from './barcode.js'
import { composeLabel } from './labelComposer.js'

const QR_PX = { small: 120, medium: 180, large: 260 }

// params: { listText, separator, codeType:'QR'|'CODE128', size }
// 返回 { items:[{ value, dataUrl, ok, error }], invalidCount }
export async function generate(params = {}) {
  const rows = parseLabelRows(params.listText, params.separator)
  const size = params.size || 'medium'
  const items = []
  let invalidCount = 0
  for (let i = 0; i < rows.length; i += 1) {
    const fields = rows[i]
    const codeValue = fields[0] || ''
    const textLines = fields.slice(1)
    if (!codeValue) {
      invalidCount += 1
      items.push({ value: '(空)', dataUrl: '', ok: false, error: '缺少码内容' })
      continue
    }
    try {
      const codeDataUrl = params.codeType === 'CODE128'
        ? renderBarcode(codeValue, 'CODE128', size, false)
        : await renderQr(codeValue, QR_PX[size] || QR_PX.medium)
      const dataUrl = await composeLabel({ codeDataUrl, textLines, size })
      items.push({ value: codeValue, dataUrl, ok: true })
    } catch (e) {
      invalidCount += 1
      items.push({ value: codeValue, dataUrl: '', ok: false, error: e?.message || '标签生成失败' })
    }
  }
  return { items, invalidCount }
}
