/**
 * 文本归一化（与 attachmentTextParser.normalizeText 同一实现，抽为公共模块；
 * 面板旧代码暂不改动以控制爆炸半径，新代码统一从这里引）。
 */
export function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default { normalizeText }
