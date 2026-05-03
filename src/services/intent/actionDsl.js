import { INTENT_LANES, OUTPUT_MODES } from './schemas.js'

const REVIEW_PATTERN = /(审查|审核|审阅|校对|检查|合规|风险|问题|瑕疵|漏洞|对比|判断|评估)/
const KB_QUERY_PATTERN = /(知识库|资料库|制度库|库里|根据.*库|查询|检索|有几个|多少个|数量|总数|统计|有哪些|列出|查一下)/
const STRUCTURED_AGG_PATTERN = /(有几个|多少个|数量|总数|统计|平均|最大|最小|占比|汇总|count|sum|avg|max|min)/i
const ASSISTANT_PATTERN = /(?:用|调用|执行|启动|跑一下)\s*[「『"]?([^,，。.!?！？「」『』"]{2,32})[」』"]?\s*(?:助手|智能体|功能)?/

function has(pattern, text) {
  return pattern.test(String(text || '').trim())
}

function detectOutputMode(text = '') {
  const t = String(text || '').trim()
  if (/(批注|标注|注释|评论)/.test(t)) return OUTPUT_MODES.ADD_COMMENT
  if (/(替换|改成|修改为|换成|覆盖原文|直接改)/.test(t)) return OUTPUT_MODES.REPLACE
  if (/(插入到.*后|放到.*后|追加到.*后|写到.*后|后面)/.test(t)) return OUTPUT_MODES.INSERT_AFTER
  if (/(插入到.*前|放到.*前|前面)/.test(t)) return OUTPUT_MODES.PREPEND
  if (/(追加|加到文末|放到文末)/.test(t)) return OUTPUT_MODES.APPEND
  if (/(只回复|不要写入|不要改文档|生成报告|报告形式)/.test(t)) return OUTPUT_MODES.REPORT
  return OUTPUT_MODES.REPLY
}

function detectFormatAction(text = '') {
  const t = String(text || '').trim()
  if (/(加粗|粗体|bold)/i.test(t)) return { name: 'format.bold', parameters: { bold: true }, outputMode: OUTPUT_MODES.FORMAT }
  if (/(斜体|italic)/i.test(t)) return { name: 'format.italic', parameters: { italic: true }, outputMode: OUTPUT_MODES.FORMAT }
  if (/(下划线|underline)/i.test(t)) return { name: 'format.underline', parameters: { underline: true }, outputMode: OUTPUT_MODES.FORMAT }
  if (/(字号|字体大小|字体|颜色|对齐|行距)/.test(t)) return { name: 'format.generic', parameters: {}, outputMode: OUTPUT_MODES.FORMAT }
  return null
}

function detectTransformAction(text = '') {
  const t = String(text || '').trim()
  if (/(翻译|译成|翻成|中译英|英译中)/.test(t)) return { name: 'transform.translate', parameters: { targetLanguage: detectTargetLanguage(t) } }
  if (/(扩写|展开|补充)/.test(t)) return { name: 'transform.expand', parameters: {} }
  if (/(缩写|精简|压缩)/.test(t)) return { name: 'transform.abbreviate', parameters: {} }
  if (/(润色|优化表达|通顺|专业)/.test(t)) return { name: 'transform.polish', parameters: {} }
  if (/(改写|重写|换种说法)/.test(t)) return { name: 'transform.rewrite', parameters: {} }
  if (/(摘要|总结|概括|提炼)/.test(t)) return { name: 'transform.summarize', parameters: {} }
  return null
}

function detectTargetLanguage(text = '') {
  if (/(英文|英语|英译)/.test(text)) return 'en'
  if (/(中文|汉语|中译)/.test(text)) return 'zh'
  if (/(日文|日语)/.test(text)) return 'ja'
  if (/(韩文|韩语)/.test(text)) return 'ko'
  if (/(法文|法语)/.test(text)) return 'fr'
  if (/(德文|德语)/.test(text)) return 'de'
  return ''
}

function detectAssistantName(text = '') {
  const match = String(text || '').trim().match(ASSISTANT_PATTERN)
  return match ? String(match[1] || '').trim() : ''
}

export function inferLane(text = '', localIntent = {}, context = {}) {
  const t = String(text || '').trim()
  const hasKnowledge = context.kbBinding?.enabled === true
  const localKind = String(localIntent?.kind || '').trim()
  const localSubKind = String(localIntent?.subKind || '').trim()

  if (detectAssistantName(t) || localKind === 'assistant-task') return INTENT_LANES.ASSISTANT_CALL
  if (has(REVIEW_PATTERN, t) && (/(文档|全文|全篇|选中|这段|原文|条款|合同|材料)/.test(t) || context.hasDocument || context.hasSelection)) {
    return INTENT_LANES.DOCUMENT_REVIEW
  }
  if ((hasKnowledge || /知识库|资料库|制度库|数据库|表里|库里/.test(t)) && has(KB_QUERY_PATTERN, t) && !/(批注|替换|改写|润色|翻译|插入|加粗|审查原文)/.test(t)) {
    return INTENT_LANES.KNOWLEDGE_QUERY
  }
  if (localKind === 'wps-capability') return INTENT_LANES.WPS_CAPABILITY
  if (localKind === 'generated-output') return INTENT_LANES.GENERATED_OUTPUT
  if (localKind === 'document-operation' || localSubKind) return INTENT_LANES.DOCUMENT_OPERATION
  return INTENT_LANES.CHAT
}

export function inferActionDsl(text = '', lane = INTENT_LANES.CHAT, context = {}, localIntent = {}) {
  const t = String(text || '').trim()
  const outputMode = detectOutputMode(t)
  const formatAction = detectFormatAction(t)
  if (formatAction) {
    return {
      action: { type: 'format', name: formatAction.name, parameters: formatAction.parameters },
      output: { mode: formatAction.outputMode, anchor: 'current_range' }
    }
  }

  if (lane === INTENT_LANES.KNOWLEDGE_QUERY) {
    const aggregate = has(STRUCTURED_AGG_PATTERN, t)
    return {
      action: {
        type: 'knowledge_query',
        name: aggregate ? 'knowledge.structured_aggregate' : 'knowledge.search',
        parameters: {
          query: t,
          queryKind: aggregate ? 'structured_aggregate' : 'semantic'
        }
      },
      output: { mode: OUTPUT_MODES.REPLY, anchor: 'none' }
    }
  }

  if (lane === INTENT_LANES.ASSISTANT_CALL) {
    return {
      action: {
        type: 'assistant',
        name: 'assistant.run',
        parameters: {
          assistantName: detectAssistantName(t) || context.assistantName || '',
          assistantId: context.assistantId || ''
        }
      },
      output: { mode: outputMode, anchor: outputMode === OUTPUT_MODES.ADD_COMMENT ? 'issue_range' : 'resolved_scope' }
    }
  }

  if (lane === INTENT_LANES.DOCUMENT_REVIEW) {
    const withKb = context.kbBinding?.enabled === true || /(知识库|制度库|资料库|依据|根据)/.test(t)
    return {
      action: {
        type: 'review',
        name: withKb ? 'review.with_knowledge_base' : 'review.document',
        parameters: {
          reviewMode: withKb ? 'compare_with_kb' : 'document_only',
          commentMode: outputMode === OUTPUT_MODES.ADD_COMMENT || /(批注|标注)/.test(t)
        }
      },
      output: { mode: outputMode === OUTPUT_MODES.REPLY ? OUTPUT_MODES.REPORT : outputMode, anchor: 'issue_range' }
    }
  }

  const transform = detectTransformAction(t)
  if (transform) {
    return {
      action: { type: 'transform', name: transform.name, parameters: transform.parameters },
      output: { mode: outputMode, anchor: 'resolved_scope' }
    }
  }

  if (/(替换|改成|修改为|换成)/.test(t)) {
    return {
      action: { type: 'edit', name: 'edit.replace_text', parameters: { rawInstruction: t } },
      output: { mode: OUTPUT_MODES.REPLACE, anchor: 'resolved_scope' }
    }
  }

  return {
    action: {
      type: lane,
      name: String(localIntent?.subKind || lane || INTENT_LANES.CHAT).trim(),
      parameters: {}
    },
    output: { mode: outputMode, anchor: outputMode === OUTPUT_MODES.ADD_COMMENT ? 'current_range' : 'none' }
  }
}

export default {
  inferLane,
  inferActionDsl
}
