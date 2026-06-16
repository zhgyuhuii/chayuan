// 标签数据纯逻辑：把粘贴的多行多字段文本按分隔符拆成 string[][]。无浏览器依赖,可 node 测试。

// separator: '|' | 'tab' | 'comma'
function resolveSep(separator) {
  if (separator === 'tab') return '\t'
  if (separator === 'comma') return ','
  return '|'
}

// 返回 string[][]：每行一个字段数组；空行跳过；字段已 trim。
export function parseLabelRows(listText, separator) {
  const sep = resolveSep(separator)
  return String(listText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(sep).map((f) => f.trim()))
}
