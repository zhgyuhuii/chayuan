// 流水号模板纯逻辑：展开 {seq:N} / {date:FMT} / {rand:N}。无浏览器依赖，可 node 测试。

const RAND_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混 0/O/1/I

function zeroPad(num, width) {
  const s = String(num)
  const w = Math.max(0, Number(width) || 0)
  return s.length >= w ? s : '0'.repeat(w - s.length) + s
}

function formatDate(dateVal, fmt) {
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal)
  if (Number.isNaN(d.getTime())) throw new Error('日期无效')
  const YYYY = String(d.getFullYear())
  const YY = YYYY.slice(-2)
  const MM = zeroPad(d.getMonth() + 1, 2)
  const DD = zeroPad(d.getDate(), 2)
  return String(fmt || 'YYYYMMDD')
    .replace(/YYYY/g, YYYY)
    .replace(/YY/g, YY)
    .replace(/MM/g, MM)
    .replace(/DD/g, DD)
}

function randStr(n, rng) {
  let s = ''
  for (let i = 0; i < n; i += 1) {
    s += RAND_CHARSET[Math.floor(rng() * RAND_CHARSET.length)]
  }
  return s
}

function renderOne(tpl, seqVal, dateVal, rng) {
  return tpl.replace(/\{([^}]*)\}/g, (m, body) => {
    const seqMatch = /^seq(?::(\d+))?$/.exec(body)
    if (seqMatch) return zeroPad(seqVal, seqMatch[1] ? Number(seqMatch[1]) : 0)
    const dateMatch = /^date(?::([YMD-]+))?$/.exec(body)
    if (dateMatch) return formatDate(dateVal, dateMatch[1] || 'YYYYMMDD')
    const randMatch = /^rand:(\d+)$/.exec(body)
    if (randMatch) return randStr(Number(randMatch[1]), rng)
    throw new Error(`未知占位符 {${body}}`)
  })
}

// options: { start, step, count, date, rng }
// 返回 { items:[{ value, ok, error }], invalidCount }
export function expandTemplate(template, options = {}) {
  const tpl = String(template == null ? '' : template)
  const rawStart = Number(options.start)
  const start = Number.isFinite(rawStart) ? Math.max(0, Math.trunc(rawStart)) : 1
  const rawStep = Number(options.step)
  const step = Number.isFinite(rawStep) ? Math.trunc(rawStep) : 1
  const count = Math.max(0, Number(options.count) || 0)
  const rng = typeof options.rng === 'function' ? options.rng : Math.random
  const dateVal = options.date ? options.date : new Date()
  const items = []
  let invalidCount = 0
  for (let i = 0; i < count; i += 1) {
    try {
      items.push({ value: renderOne(tpl, start + i * step, dateVal, rng), ok: true })
    } catch (e) {
      invalidCount += 1
      items.push({ value: '', ok: false, error: e?.message || '模板错误' })
    }
  }
  return { items, invalidCount }
}
