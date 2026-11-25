/**
 * 变换分块器（旧版「分段单次对话」同构，纯函数零依赖）：按段落边界切块
 * （段界=天然变换边界），超长单段硬切（切片间零分隔——同段延续，重组时
 * 不引入换行）。无损性不变量：chunks.map(c => c.text + c.sep).join('') === 原文。
 */
export function splitTransformChunks(text, maxLen = 3000) {
  const paras = String(text || '').split('\n')
  const chunks = []
  let cur = null
  const pushCur = () => {
    if (cur && cur.parts.length) {
      chunks.push({ text: cur.parts.join('\n'), sep: '\n' })
    }
    cur = null
  }
  for (const p of paras) {
    if (!p.trim()) continue // 空行不进块（块间 \n 已表达分段；空段落无语义）
    if (cur && cur.len + p.length + 1 > maxLen) pushCur()
    if (p.length > maxLen) {
      pushCur()
      for (let i = 0; i < p.length; i += maxLen) {
        const last = i + maxLen >= p.length
        chunks.push({ text: p.slice(i, i + maxLen), sep: last ? '\n' : '' })
      }
      continue
    }
    if (!cur) cur = { parts: [], len: 0 }
    cur.parts.push(p)
    cur.len += p.length + 1
  }
  pushCur()
  if (chunks.length) chunks[chunks.length - 1].sep = ''
  return chunks
}
