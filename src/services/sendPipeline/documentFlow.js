import { resolveDocumentTaskInputScope } from '../../utils/documentTaskScope.js'

export const DIRECT_DOCUMENT_CHAR_LIMIT = 12000

const PROMPT_ONLY_CREATION_PATTERN = /(帮我|请|给我|麻烦)?\s*(写|撰写|起草|创作|生成|输出|制作|列出|设计).{0,40}(教程|指南|说明|手册|文档|文章|方案|计划|提纲|大纲|模板|报告|材料|内容)|(?:教程|指南|说明|手册).{0,16}(写出来|生成|输出|怎么写|如何写)/
const EXISTING_DOCUMENT_MATERIAL_PATTERN = /(基于|根据|依据|参考|结合|围绕|针对|对|把|将|总结|摘要|概括|提炼|分析|解读|翻译|润色|改写|校对|检查|审查|提取|统计|查找|批注|脱密|修订|修改|删除|替换).{0,16}(当前文档|这份文档|这个文档|全文|全篇|整篇|文档全文|选中|选区|这段|本段)/
const TRANSFORM_PATTERN = /(翻译|译成|翻成|中译英|英译中|改写|重写|润色|正式化|通俗化|缩写|扩写|术语统一|公文风|政策)/
const SYNTHESIZE_PATTERN = /(摘要|总结|概括|提炼|关键词|风险|分析|审查|检查|纪要|标题|待办|行动项|结构)/

export function isPromptOnlyCreationRequest(text = '') {
  const normalized = String(text || '').trim()
  if (!normalized) return false
  return PROMPT_ONLY_CREATION_PATTERN.test(normalized) &&
    !EXISTING_DOCUMENT_MATERIAL_PATTERN.test(normalized)
}

export function classifyDocumentRequestStrategy(text = '') {
  const normalized = String(text || '').trim()
  if (TRANSFORM_PATTERN.test(normalized)) return 'transform'
  if (SYNTHESIZE_PATTERN.test(normalized)) return 'synthesize'
  return 'synthesize'
}

export function resolveDocumentFlowScope(text = '', options = {}) {
  if (isPromptOnlyCreationRequest(text)) {
    return {
      requestedScope: 'prompt',
      resolvedScope: 'prompt',
      hasSelection: options.hasSelection === true,
      hasDocument: options.hasDocument === true,
      reason: '用户是在请求从零创作内容，不应因空文档阻断。'
    }
  }
  return resolveDocumentTaskInputScope(text, {
    routeKind: options.routeKind || 'document-operation',
    hasSelection: options.hasSelection === true,
    hasDocument: options.hasDocument === true
  })
}

export function planDocumentFlow(text = '', options = {}) {
  const documentCharCount = Math.max(0, Number(options.documentCharCount || 0))
  const chunkCount = Math.max(0, Number(options.chunkCount || 0))
  const strategy = classifyDocumentRequestStrategy(text)
  const scope = resolveDocumentFlowScope(text, options)
  const requiresDocumentMaterial = scope.resolvedScope === 'document' || scope.resolvedScope === 'selection'
  const canProceedOnEmptyDocument = scope.resolvedScope === 'prompt' || isPromptOnlyCreationRequest(text)
  const useDirectDocumentSubmit = scope.resolvedScope === 'document' &&
    strategy !== 'transform' &&
    documentCharCount > 0 &&
    documentCharCount <= Number(options.directCharLimit || DIRECT_DOCUMENT_CHAR_LIMIT) &&
    chunkCount <= 1

  return {
    strategy,
    scope,
    requiresDocumentMaterial,
    canProceedOnEmptyDocument,
    useDirectDocumentSubmit,
    useChunkedDocumentFlow: scope.resolvedScope === 'document' && !useDirectDocumentSubmit,
    shouldReadFullDocument: scope.resolvedScope === 'document',
    shouldReadSelection: scope.resolvedScope === 'selection',
    reason: [
      scope.reason,
      useDirectDocumentSubmit ? '文档长度未超过直传阈值，可直接提交。' : '',
      scope.resolvedScope === 'document' && !useDirectDocumentSubmit ? '文档需走分块或长文档处理。' : ''
    ].filter(Boolean).join(' ')
  }
}

export default {
  DIRECT_DOCUMENT_CHAR_LIMIT,
  isPromptOnlyCreationRequest,
  classifyDocumentRequestStrategy,
  resolveDocumentFlowScope,
  planDocumentFlow
}
