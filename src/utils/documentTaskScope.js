/**
 * 根据用户自然语言与当前文档状态，判定本轮任务应使用的材料范围。
 * 纯函数，便于单测与脚本回归；运行时由 AIAssistantDialog 注入 hasSelection / hasDocument。
 *
 * @param {string} text - 用户输入
 * @param {{ routeKind?: string, hasSelection?: boolean, hasDocument?: boolean }} [options]
 * @returns {{ requestedScope: string, resolvedScope: string, hasSelection: boolean, hasDocument: boolean, reason: string }}
 */
export function resolveDocumentTaskInputScope(text = '', options = {}) {
  const normalized = String(text || '').trim()
  const routeKind = String(options.routeKind || '').trim()
  const hasSelection = options.hasSelection === true
  const hasDocument = options.hasDocument === true

  const useSelectionMaterialCue = /(?:请|要|想|需要|麻烦|帮忙|帮我)?(?:使用|用|基于|针对|对于|对|把|将|依据|参考|结合|围绕|按|按照)\s*(?:我|当前)?\s*(?:选中的|选中(?:的内容|的文字|的文本|的部分)?|选区(?:的内容|的文字)?|所选(?:的内容|的文字)?|当前选中|高亮(?:的|部分)?|这段|本段|这一段|光标(?:处|所在|位置)?|鼠标(?:所在|选中)?)/.test(normalized)
  const useDocumentMaterialCue = /(?:请|要|想|需要|麻烦|帮忙|帮我)?(?:使用|用|基于|针对|对于|对|把|将|依据|参考|结合|围绕|按|按照)\s*(?:全文|全篇|整篇|整个文档|整份文档|全稿|文档全文|本篇|本稿)/.test(normalized)
  const hasSelectionCue = useSelectionMaterialCue ||
    /(选中|选区|所选|当前选中|这段|本段|当前段落|这一段|高亮|划线|圈选|光标处|光标位置|选中文字|圈出来的|以选中(?:内容)?为准|按选中(?:内容)?(?:来|处理|执行)?|按选区(?:内容)?(?:来|处理|执行)?)/i.test(normalized)
  const hasDocumentCue = useDocumentMaterialCue ||
    /(全文|全篇|整篇|整个文档|当前文档|整份|全稿|整份文档|本篇全文|文档全文|通篇|整文|全文内容|以全文为准|按全文(?:来|处理|执行)?|按整篇(?:来|处理|执行)?)/i.test(normalized)
  const preferSelectionCue = /(优先[^，。；;,.!?！？\n]{0,24}(?:选中|选区|这段)|先[^，。；;,.!?！？\n]{0,24}(?:选中|选区|这段)|(?:选中|选区|这段)[^，。；;,.!?！？\n]{0,24}(?:优先|先处理)|以(?:选中|选区|这段)[^，。；;,.!?！？\n]{0,24}为准|按(?:选中|选区|这段)[^，。；;,.!?！？\n]{0,24}为准|(?:选中|选区|这段)[^，。；;,.!?！？\n]{0,24}(?:为准|来|来做|处理即可|为主|主要看)|无论[^，。；;,.!?！？\n]{0,24}都[^，。；;,.!?！？\n]{0,24}(?:选中|选区|这段))/.test(normalized)
  const preferDocumentCue = /(优先[^，。；;,.!?！？\n]{0,24}(?:全文|全篇|整篇|文档)|先[^，。；;,.!?！？\n]{0,24}(?:全文|全篇|整篇|文档)|(?:全文|全篇|整篇|文档)[^，。；;,.!?！？\n]{0,24}(?:优先|先处理)|以(?:全文|全篇|整篇|文档)[^，。；;,.!?！？\n]{0,24}为准|按(?:全文|全篇|整篇|文档)[^，。；;,.!?！？\n]{0,24}为准|(?:全文|全篇|整篇|文档)[^，。；;,.!?！？\n]{0,24}(?:为准|来|来做|处理即可|为主|主要看)|无论[^，。；;,.!?！？\n]{0,24}都[^，。；;,.!?！？\n]{0,24}(?:全文|全篇|整篇|文档))/.test(normalized)
  const denySelectionCue = /(不要.*(?:选中|选区|这段)|不基于.*(?:选中|选区|这段)|不是.*(?:选中|选区|这段)|忽略.*(?:选中|选区|这段)|不用.*(?:选中|选区|这段)|别用.*(?:选中|选区|这段))/.test(normalized)
  const denyDocumentCue = /(不要.*(?:全文|全篇|整篇|文档)|不基于.*(?:全文|全篇|整篇|文档)|不是.*(?:全文|全篇|整篇|文档)|忽略.*(?:全文|全篇|整篇|文档)|不用.*(?:全文|全篇|整篇|文档)|别用.*(?:全文|全篇|整篇|文档))/.test(normalized)
  const forcePromptCue = /(只根据(?:我的)?(?:输入|要求|问题|这条消息|本次输入)|仅根据(?:我的)?(?:输入|要求|问题)|不要参考(?:选中|选区|全文|全篇|文档)|不参考(?:选中|选区|全文|全篇|文档)|不要基于(?:选中|选区|全文|全篇|文档)|按我输入的内容|按输入(?:来|处理|执行)?|以输入为准|仅按输入|主要看输入|别读文档|不要读文档|不用文档|只看我这句话|仅看我这句话|不要看上下文|不看上下文)/i.test(normalized)

  let requestedScope = routeKind === 'document-operation' ? 'selection-preferred' : 'prompt'
  let reason = routeKind === 'document-operation' ? '文档类会话默认：有选区则优先选区，否则用全文。' : '普通对话默认：不自动附带文档正文，除非你在话里点到全文或选区。'

  if (forcePromptCue) {
    requestedScope = 'prompt'
    reason = '用户明确要求只依据输入（或不要参考文档/选区）。'
  } else if (useSelectionMaterialCue && !denySelectionCue && !preferDocumentCue && (!useDocumentMaterialCue || preferSelectionCue)) {
    requestedScope = 'selection'
    reason = '用户表述为对「选中/选区/本段」等材料进行操作。'
  } else if (useDocumentMaterialCue && !denyDocumentCue && !preferSelectionCue && (!useSelectionMaterialCue || preferDocumentCue)) {
    requestedScope = 'document'
    reason = '用户表述为对「全文/整篇」进行操作。'
  } else if (preferSelectionCue && !denySelectionCue) {
    requestedScope = 'selection'
    reason = '用户要求优先处理选中范围。'
  } else if (preferDocumentCue && !denyDocumentCue) {
    requestedScope = 'document'
    reason = '用户要求优先处理全文。'
  } else if (hasSelectionCue && !denySelectionCue && (!hasDocumentCue || denyDocumentCue)) {
    requestedScope = 'selection'
    reason = '话里主要指向选中、选区或当前段落位置。'
  } else if (hasDocumentCue && !denyDocumentCue && (!hasSelectionCue || denySelectionCue)) {
    requestedScope = 'document'
    reason = '话里主要指向全文或整篇文档。'
  } else if (hasSelectionCue && hasDocumentCue) {
    requestedScope = preferDocumentCue ? 'document' : preferSelectionCue ? 'selection' : 'selection-preferred'
    reason = '同时提到选区与全文，按优先词或默认「有选区优先选区」处理。'
  }

  let resolvedScope = requestedScope
  if (requestedScope === 'selection') {
    resolvedScope = hasSelection ? 'selection' : (hasDocument ? 'document' : 'prompt')
    if (resolvedScope !== 'selection' && hasSelection === false) {
      reason += ' 当前无有效选区，已改用' + (resolvedScope === 'document' ? '全文' : '仅输入') + '。'
    }
  } else if (requestedScope === 'document') {
    resolvedScope = hasDocument ? 'document' : (hasSelection ? 'selection' : 'prompt')
    if (resolvedScope !== 'document') {
      reason += ' 当前文档为空则回退到' + (resolvedScope === 'selection' ? '选区' : '仅输入') + '。'
    }
  } else if (requestedScope === 'selection-preferred') {
    resolvedScope = hasSelection ? 'selection' : (hasDocument ? 'document' : 'prompt')
    reason = hasSelection
      ? '未点名范围，但有选区，按选区处理。'
      : hasDocument
        ? '未点名范围且无选区，按全文处理。'
        : '无文档也无选区，仅按输入与附件。'
  }

  return {
    requestedScope,
    resolvedScope,
    hasSelection,
    hasDocument,
    reason: String(reason || '').trim()
  }
}
