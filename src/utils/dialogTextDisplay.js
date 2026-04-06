/**
 * Strip markdown-style punctuation from text shown in assistant dialog UI
 * so users do not see raw * - # etc. from model output.
 */
export function sanitizeDialogDisplaySymbols(text) {
  if (text == null) return ''
  let s = String(text)
  if (!s) return ''
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  s = s.replace(/\*/g, '')
  s = s.replace(/`/g, '')
  s = s.replace(/^#{1,6}\s*/gm, '')
  s = s.replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, '')
  s = s.replace(/^(\s*)[-*+]\s+/gm, '$1')
  s = s.replace(/^(\s*)>\s?/gm, '$1')
  s = s.replace(/~{2}/g, '')
  s = s.replace(/_{2,}/g, '')
  return s
}

function toHalfWidthDigits(s) {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 48))
}

/**
 * Normalize LLM-style numbered lists (e.g. "1、xx 2、xx" on one line) into line breaks
 * so paste into Word / insert document gets one item per paragraph. Idempotent enough for typical output.
 */
export function normalizeLlmEnumerationLayout(text) {
  if (text == null) return ''
  let s = toHalfWidthDigits(String(text))
  if (!s.trim()) return s

  // After sentence punctuation, start numbered item on a new line: "如下：1、"
  s = s.replace(/([。；：:！？])(\s*)(\d{1,2})([、])\s*/g, '$1\n$3$4 ')

  // (1) (2) style with following text
  s = s.replace(/(?<=[^\n\r])(\s*)(\([1-9]\d?\))\s+(?=[\u4e00-\u9fffA-Za-z「【（])/g, '\n$2 ')

  // Mid-line " 2、" " 3、" (space + number +顿号)
  s = s.replace(/(?<=[^\n\r])(\s+)(\d{1,2})([、])\s*/g, '\n$2$3 ')

  // Mid-line " 2. " western numbering before Chinese/Latin (avoid 3.14)
  s = s.replace(/(?<=[^\n\r])(\s+)(\d{1,2})[.．]\s+(?=[\u4e00-\u9fffA-Za-z「【（])/g, '\n$2、 ')

  // Line-start "1. " -> "1、"
  s = s.replace(/(^|\n)(\s*)(\d{1,2})[.．]\s+/g, '$1$2$3、 ')

  // Trim excessive blank lines (keep at most one blank line)
  s = s.replace(/\n{3,}/g, '\n\n')

  s = s
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')

  return s.trim()
}

/** Display pipeline: list layout then symbol strip (for chat bubbles & assistant summaries). */
export function prepareDialogDisplayText(text) {
  let s = String(text ?? '')
  if (!s) return ''
  s = normalizeLlmEnumerationLayout(s)
  s = sanitizeDialogDisplaySymbols(s)
  return s
}
