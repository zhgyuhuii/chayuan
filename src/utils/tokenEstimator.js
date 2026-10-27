/**
 * tokenEstimator — 字符 ↔ token 保守估算（file_parse 预算体系的基础）。
 *
 * 设计约束：
 * - 全链路不引入 tokenizer 依赖（webview bundle 体积 + 各家 tokenizer 不通用），
 *   用「保守高估」策略：估算值 ≥ 真实 token 数，保证按预算截取永不超模型上限。
 * - 中文按 1 字 ≈ 1 token 估（主流国产 tokenizer 实际 0.6~0.75，取高保安全）；
 *   非中文按 3 字符 ≈ 1 token 估（实际 ~4）。混合文本按 CJK 占比加权。
 * - 双向 API：estimateTokens(text) 供结果标注；charsBudgetFor(text 样本, tokens)
 *   把 token 预算换算成「这份文本还能装多少字符」。
 */

const CJK_RE = /[\u3000-\u303f\u3040-\u30ff\u31c0-\u31ef\u3200-\u32ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/

/** 统计文本里 CJK 字符占比（0~1），只抽样头/中/尾共 ≤12k 字符，避免超长文本全扫 */
function cjkRatio(text) {
  const s = String(text || '')
  if (!s) return 0
  const sample =
    s.length <= 12000
      ? s
      : s.slice(0, 4000) + s.slice(Math.floor(s.length / 2) - 2000, Math.floor(s.length / 2) + 2000) + s.slice(-4000)
  let cjk = 0
  for (let i = 0; i < sample.length; i++) {
    if (CJK_RE.test(sample[i])) cjk++
  }
  return cjk / sample.length
}

/**
 * 保守估算文本 token 数（≥ 真实值）
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  const s = String(text || '')
  if (!s) return 0
  const ratio = cjkRatio(s)
  const cjkChars = Math.round(s.length * ratio)
  const otherChars = s.length - cjkChars
  return Math.ceil(cjkChars * 1 + (otherChars / 3))
}

/**
 * 按 token 预算换算这份文本可容纳的字符数（保守：只会少不会多）
 * @param {string} textLike - 同源文本样本（用于测 CJK 占比），传空按纯中文最保守
 * @param {number} tokens - token 预算
 * @returns {number} 字符预算
 */
export function charsBudgetFor(textLike, tokens) {
  const t = Math.max(0, Number(tokens) || 0)
  if (!t) return 0
  const ratio = cjkRatio(textLike)
  // 与 estimateTokens 严格互逆：estimateTokens(C 字符) = C×(r + (1-r)/3) = tokens
  // → charsPerToken = 1/(r + (1-r)/3) = 3/(1+2r)。纯中文 1.0、纯非中文 3.0。
  const charsPerToken = 3 / (1 + 2 * ratio)
  return Math.floor(t * charsPerToken)
}

/** 混合文本的等效 chars/token（展示用，随返回体透出便于调用方自查） */
export function charsPerTokenOf(textLike) {
  const ratio = cjkRatio(textLike)
  return Math.round((3 / (1 + 2 * ratio)) * 100) / 100
}

/**
 * 头尾保真压缩采样（面板 5 处内联逻辑的公共化，供 file_parse 摘要档与后续复用）：
 * 预算内返回原文；超预算时保留头部 2/3 + 省略标记 + 尾部 1/3。
 * @param {string} text
 * @param {number} maxChars - 字符预算
 * @param {{ headRatio?: number, marker?: (omitted: number) => string }} opts
 * @returns {{ text: string, truncated: boolean, omittedChars: number }}
 */
export function sampleHeadTail(text, maxChars, opts = {}) {
  const s = String(text || '')
  const limit = Math.max(0, Number(maxChars) || 0)
  if (s.length <= limit) return { text: s, truncated: false, omittedChars: 0 }
  const headRatio = opts.headRatio ?? 2 / 3
  const headLen = Math.max(1, Math.floor(limit * headRatio))
  const tailLen = Math.max(1, limit - headLen - 1)
  const omitted = s.length - headLen - tailLen
  const marker = opts.marker ? opts.marker(omitted) : `\n…[中段已压缩省略约 ${omitted} 字]…\n`
  return {
    text: s.slice(0, headLen) + marker + s.slice(s.length - tailLen),
    truncated: true,
    omittedChars: omitted
  }
}

export default { estimateTokens, charsBudgetFor, charsPerTokenOf, sampleHeadTail }
