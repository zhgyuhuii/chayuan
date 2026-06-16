// 条码纯逻辑：编号列表构造 + 校验。无浏览器/jsbarcode 依赖，可 node 直接测试。

export function zeroPad(num, width) {
  const s = String(num)
  const w = Math.max(0, Number(width) || 0)
  return s.length >= w ? s : '0'.repeat(w - s.length) + s
}

// params: { dataSource:'sequence'|'list', prefix, start, count, padding, suffix, listText }
export function buildCodeList(params = {}) {
  if (params.dataSource === 'list') {
    return String(params.listText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }
  const prefix = String(params.prefix || '')
  const suffix = String(params.suffix || '')
  const rawStart = Number(params.start)
  const start = Number.isFinite(rawStart) ? Math.max(0, Math.trunc(rawStart)) : 1
  const count = Math.max(0, Number(params.count) || 0)
  const padding = Math.max(0, Number(params.padding) || 0)
  const out = []
  for (let i = 0; i < count; i += 1) {
    out.push(prefix + zeroPad(start + i, padding) + suffix)
  }
  return out
}

function ean13CheckDigit(d12) {
  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    sum += Number(d12[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10
}

// 返回 { ok:boolean, error?:string }
export function validateBarcodeValue(value, type) {
  const v = String(value == null ? '' : value)
  if (!v) return { ok: false, error: '编号为空' }
  const t = String(type || '').toUpperCase()
  if (t === 'EAN13') {
    if (!/^\d{12,13}$/.test(v)) return { ok: false, error: 'EAN-13 需 12 或 13 位数字' }
    if (v.length === 13 && Number(v[12]) !== ean13CheckDigit(v.slice(0, 12))) {
      return { ok: false, error: 'EAN-13 校验位不正确' }
    }
    return { ok: true }
  }
  if (t === 'CODE39') {
    if (!/^[A-Z0-9 \-.$/+%]+$/.test(v)) {
      return { ok: false, error: 'Code39 仅支持大写字母、数字与 - . $ / + % 空格' }
    }
    return { ok: true }
  }
  // CODE128 与其它：任意非空字符串
  return { ok: true }
}
