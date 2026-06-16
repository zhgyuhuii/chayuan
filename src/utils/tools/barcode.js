// 条码浏览器渲染：jsbarcode 画 canvas -> dataURL。依赖 DOM/canvas，仅在 WPS/浏览器运行。
import JsBarcode from 'jsbarcode'
import { buildCodeList, validateBarcodeValue } from './barcodeCodes.js'

const SIZE_PRESET = {
  small: { width: 1, height: 40, fontSize: 12 },
  medium: { width: 2, height: 60, fontSize: 16 },
  large: { width: 3, height: 90, fontSize: 20 }
}

// 单个条码 -> PNG dataURL；失败抛错由调用方捕获
export function renderBarcode(value, type, size, displayValue) {
  const preset = SIZE_PRESET[size] || SIZE_PRESET.medium
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, String(value), {
    format: String(type || 'CODE128').toUpperCase(),
    width: preset.width,
    height: preset.height,
    fontSize: preset.fontSize,
    displayValue: displayValue !== false,
    margin: 6,
    background: '#ffffff'
  })
  return canvas.toDataURL('image/png')
}

// params: { dataSource, prefix, start, count, padding, suffix, listText, type, size, showText }
// 返回 { items:[{ value, dataUrl, ok, error }], invalidCount }
export function generate(params = {}) {
  const values = buildCodeList(params)
  const type = params.type || 'CODE128'
  let invalidCount = 0
  const items = values.map((value) => {
    const check = validateBarcodeValue(value, type)
    if (!check.ok) {
      invalidCount += 1
      return { value, dataUrl: '', ok: false, error: check.error }
    }
    try {
      const dataUrl = renderBarcode(value, type, params.size, params.showText)
      return { value, dataUrl, ok: true }
    } catch (e) {
      invalidCount += 1
      return { value, dataUrl: '', ok: false, error: e?.message || '渲染失败' }
    }
  })
  return { items, invalidCount }
}
