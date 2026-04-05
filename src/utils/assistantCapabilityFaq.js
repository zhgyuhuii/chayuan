import { createDefaultReportSettings } from './reportSettings.js'

const CAPABILITY_QUESTION_PATTERNS = [
  /(能不能|能否|可不可以|是否可以|支不支持|是否支持|能否支持).{0,24}/,
  /(怎么做|如何做|怎么实现|如何实现|怎么配置|如何配置|怎么设置|如何设置|怎么建立|如何建立).{0,24}(助手|功能|流程|模板|报告|审计|文档|批注|摘要|翻译|检查|生成)/,
  /(能不能帮我做|能否帮我做|可不可以帮我做).{0,40}/,
  /^(支持|实现|配置|建立).{0,24}(吗|么|呢)?$/,
  /\bcan\s+you\s+(do|handle|support|build|create)\b/i,
  /\bhow\s+to\s+(do|configure|set\s+up|build|create)\b/i,
  /\bis\s+it\s+possible\s+to\b/i,
  /\bdoes\s+it\s+support\b/i
]

const EXECUTION_REQUEST_PATTERNS = [
  /^(帮我|请帮我|直接帮我|现在帮我|马上帮我|立即帮我).{0,80}/,
  /^(请|帮我|直接).{0,60}(生成|写|改|润色|总结|翻译|检查|分析|提取|审查|处理)/,
  /(给我|替我).{0,30}(生成|写|改|润色|总结|翻译|检查|分析|提取|审查|处理)/,
  /\bplease\s+(write|generate|translate|summarize|review|analyze|edit)\b/i
]

const ASSISTANT_CREATION_HINT_VARIANTS = [
  '如果上面这些能力还不够贴合你的要求，你可以直接告诉我你的具体需要，我可以继续帮你新建一个专用助手来适配。',
  '如果现有功能还不能完全满足你，你可以把目标、场景和输出要求告诉我，我可以帮你新建助手，把这件事固定下来。',
  '如果你觉得上面的能力还差一点点，你可以继续说清楚你的需求，我可以帮你新建一个更贴合你的助手来完成。',
  '如果当前这些功能还不完全符合你的期待，也没关系，你可以直接告诉我你的需要，我可以帮你新建助手来补齐。',
  '如果现有能力没有完全覆盖你的场景，你可以继续把需求告诉我，我可以帮你新建助手，让它更贴近你的使用方式。'
]

const CAPABILITY_RULES = [
  {
    id: 'report-generation',
    patterns: [/(报告|审计报告|分析报告|评估报告|周报|月报|日报|纪要|汇报|总结)/],
    supportLevel: 'direct',
    capabilityCategory: 'report-generation',
    existingAssistantHints: ['summary'],
    buildPrefillDraft(text) {
      const reportType = String(text.match(/(审计报告|分析报告|评估报告|周报|月报|日报|纪要|汇报|总结|报告)/)?.[1] || '报告')
      return {
        name: `${reportType}生成助手`,
        description: `用于按指定结构生成${reportType}的自定义助手`,
        modelType: 'chat',
        inputSource: /全文|整篇|整份|整个文档/.test(text) ? 'document' : 'selection-preferred',
        documentAction: /不写回|仅返回|只返回/.test(text) ? 'none' : 'insert',
        outputFormat: 'markdown',
        reportSettings: {
          ...createDefaultReportSettings(),
          enabled: true,
          type: 'custom',
          customType: reportType
        },
        systemPrompt: `你是一位专业${reportType}写作助手。请根据用户提供的文档、选中内容或上下文，输出结构完整、表达专业、适合正式场景使用的${reportType}。`,
        userPromptTemplate: `请根据以下输入生成一份高质量${reportType}。\n\n要求：\n1. 结构清晰\n2. 结论明确\n3. 保留关键信息\n4. 若信息不足，明确说明“原文未说明”\n\n输入内容：\n---\n{{input}}\n---`
      }
    },
    buildAnswer(text) {
      const reportType = String(text.match(/(审计报告|分析报告|评估报告|周报|月报|日报|纪要|汇报|总结|报告)/)?.[1] || '报告')
      return `这类需求能做，而且已经比较贴近项目现有能力。当前程序既可以直接做${reportType}生成，也可以进一步沉淀成专用助手。现阶段通常能做到按文档或选中内容生成结构化结果，并支持继续写回文档或保留为独立输出。如果你希望长期固定某种${reportType}格式、章节结构或措辞风格，最合适的方式就是创建一个自定义助手，把报告类型、输入范围、输出格式和提示词模板预先配置好。接下来我可以直接帮你打开“创建智能助手”并预填一份${reportType}助手草稿。`
    }
  },
  {
    id: 'document-operation',
    patterns: [/(改文档|修改文档|写回文档|插入文档|替换文档|批注文档|处理当前文档|写回到文档|直接改正文档|文档操作|格式调整|加批注|替换原文|插入当前位置)/],
    supportLevel: 'direct',
    capabilityCategory: 'document-operation',
    existingAssistantHints: ['analysis.rewrite', 'analysis.correct-spell', 'analysis.polish'],
    buildPrefillDraft(text) {
      const useComment = /(批注|评论|注释)/.test(text)
      const useReplace = /(替换|改正文档|直接改|覆盖原文)/.test(text)
      return {
        name: useComment ? '文档批注处理助手' : useReplace ? '文档改写写回助手' : '文档处理助手',
        description: '用于结合当前文档或选中内容完成写回类处理',
        modelType: 'chat',
        inputSource: /全文|整篇|整个文档/.test(text) ? 'document' : 'selection-preferred',
        documentAction: useComment ? 'comment' : useReplace ? 'replace' : 'insert',
        outputFormat: 'markdown',
        systemPrompt: '你是一位面向文档编辑场景的智能助手。请根据输入内容输出可直接用于文档处理的结果，尽量保持结构清晰、可直接写回。',
        userPromptTemplate: `请根据以下输入完成文档处理任务。\n\n任务要求：${String(text || '').trim()}\n\n输入内容：\n---\n{{input}}\n---`
      }
    },
    buildAnswer(text) {
      return `这类需求能做，而且是当前项目的重点方向之一。程序不只是返回一段文字，在很多场景下还能结合选区、全文、批注和写回动作一起工作。当前通常可以做到插入、替换、追加、批注、链接批注，以及围绕选中内容或整篇文档的处理链路。具体做到什么程度，取决于你是想只生成结果，还是要把结果继续写回文档。如果你希望以后反复按同一规则处理类似文档，我可以帮你先建立一个专用助手，把输入范围、写回方式和提示词模板都预填好。`
    }
  },
  {
    id: 'translation',
    patterns: [/(翻译|中译英|英译中|译成|译为|本地化|双语)/],
    supportLevel: 'direct',
    capabilityCategory: 'translation',
    existingAssistantHints: ['translate'],
    buildPrefillDraft(text) {
      const targetLanguage = String(text.match(/(英文|英语|中文|日文|日语|韩文|韩语|法文|法语|德文|德语)/)?.[1] || '英文')
      return {
        name: `文档翻译到${targetLanguage}`,
        description: `用于将文档或选中内容稳定翻译为${targetLanguage}`,
        modelType: 'chat',
        inputSource: /全文|整篇|整个文档/.test(text) ? 'document' : 'selection-preferred',
        documentAction: /替换|覆盖原文/.test(text) ? 'replace' : 'insert',
        outputFormat: 'plain',
        targetLanguage,
        systemPrompt: '你是一位专业翻译助手，擅长在忠实原意的基础上保持结构、语气和术语一致。',
        userPromptTemplate: `请将以下内容翻译为${targetLanguage}。\n\n要求：\n1. 忠实原意\n2. 保持结构\n3. 不额外解释\n\n原文：\n---\n{{input}}\n---`
      }
    },
    buildAnswer(text) {
      return `这类需求可以直接做，而且项目里已经有比较明确的翻译链路。当前通常能按选中内容或全文进行翻译，并尽量保持原有结构、编号和语气。如果你只是偶尔翻译，直接使用现有翻译能力就够了；如果你希望固定目标语言、输出风格或写回方式，更适合建立一个专用翻译助手。我可以帮你预填一个翻译助手草稿，把目标语言、输入范围和结果写回方式一起带过去。`
    }
  },
  {
    id: 'revision',
    patterns: [/(润色|改写|重写|纠错|错别字|语法|病句|正式化|通俗化|统一术语|结构优化|优化表达|修订|校对)/],
    supportLevel: 'direct',
    capabilityCategory: 'revision',
    existingAssistantHints: ['analysis.correct-spell', 'analysis.rewrite', 'analysis.polish', 'analysis.formalize', 'analysis.term-unify'],
    buildPrefillDraft(text) {
      return {
        name: '文档改写优化助手',
        description: '用于润色、改写、纠错或统一术语的自定义助手',
        modelType: 'chat',
        inputSource: /全文|整篇|整个文档/.test(text) ? 'document' : 'selection-preferred',
        documentAction: /(替换|改正文档|直接改|覆盖原文)/.test(text) ? 'replace' : 'insert',
        outputFormat: 'markdown',
        systemPrompt: '你是一位专业文档优化助手，擅长在保持原意的前提下做润色、改写、纠错、正式化和术语统一。',
        userPromptTemplate: `请根据以下要求处理输入文本：${String(text || '').trim()}\n\n输入内容：\n---\n{{input}}\n---`
      }
    },
    buildAnswer(text) {
      return `这类需求能做，而且项目现有内置助手已经覆盖了润色、改写、纠错、正式化、术语统一等多个方向。当前一般能做到围绕选中内容或全文进行文本优化，并按需要插入、替换或只输出结果。如果你希望固定自己的处理标准，例如“统一成汇报风格”“总是按某套规则纠错”，那就非常适合做成自定义助手。我可以继续帮你预填一份改写优化助手草稿。`
    }
  },
  {
    id: 'security-audit',
    patterns: [/(保密检查|涉密|敏感词|审计|审核|审查|合规|风险分析|风险提取|字段提取|表单提取|表单抽取|文档审计)/],
    supportLevel: 'direct',
    capabilityCategory: 'security-audit',
    existingAssistantHints: ['analysis.security-check'],
    buildPrefillDraft(text) {
      const isAudit = /(审计|审核|审查|合规)/.test(text)
      return {
        name: isAudit ? '文档审计助手' : '文档审查分析助手',
        description: '用于保密检查、审计分析、字段提取或风险识别的自定义助手',
        modelType: 'chat',
        inputSource: /选中|局部/.test(text) ? 'selection-preferred' : 'document',
        documentAction: 'none',
        outputFormat: /(提取|字段|结构化|json)/i.test(text) ? 'json' : 'markdown',
        reportSettings: isAudit ? {
          ...createDefaultReportSettings(),
          enabled: true,
          type: 'compliance-audit-report'
        } : createDefaultReportSettings(),
        systemPrompt: '你是一位专业文档审查与分析助手，请基于输入内容输出审慎、可复核、结构清晰的检查或分析结果。',
        userPromptTemplate: `请围绕以下要求处理输入内容：${String(text || '').trim()}\n\n输入内容：\n---\n{{input}}\n---`
      }
    },
    buildAnswer(text) {
      return `这类需求大部分都能做，而且项目里已经有保密检查、表单字段提取、文档审计和风险分析相关能力。当前能做到的程度通常包括基于全文或选中内容做检查、抽取、分析和结构化输出，但是否直接写回文档，要看你希望结果以报告、批注还是结构化数据的形式呈现。如果你打算长期按同一审查口径使用，建立一个自定义助手会更合适，我可以帮你把范围、输出格式和提示词要求预填好。`
    }
  },
  {
    id: 'multimodal',
    patterns: [/(图片|图像|海报|配图|语音|播报|音频|视频|短片|文生图|文生视频|文本转图像|文本转语音|文本转视频)/],
    supportLevel: 'direct',
    capabilityCategory: 'multimodal',
    existingAssistantHints(text) {
      if (/(视频|短片|文生视频|文本转视频)/.test(text)) return ['text-to-video']
      if (/(语音|播报|音频|朗读|文本转语音)/.test(text)) return ['text-to-audio']
      return ['text-to-image']
    },
    buildPrefillDraft(text) {
      const isImage = /(图片|图像|海报|配图|文生图|文本转图像)/.test(text)
      const isVideo = /(视频|短片|文生视频|文本转视频)/.test(text)
      return {
        name: isImage ? '文本转图像助手' : isVideo ? '文本转视频助手' : '文本转语音助手',
        description: '用于多模态生成的自定义助手',
        modelType: isImage ? 'image' : isVideo ? 'video' : 'voice',
        inputSource: 'selection-preferred',
        documentAction: 'none',
        outputFormat: 'markdown',
        systemPrompt: isImage
          ? '你是一位图像生成助手，擅长把文本需求整理为高质量图像生成指令。'
          : isVideo
            ? '你是一位视频生成助手，擅长把文本需求整理为高质量视频生成指令。'
            : '你是一位语音生成助手，擅长把文本需求整理为自然播报语音任务。',
        userPromptTemplate: `请根据以下需求执行多模态生成：${String(text || '').trim()}\n\n输入内容：\n---\n{{input}}\n---`
      }
    },
    buildAnswer(text) {
      return `这类需求能做，当前项目里已经覆盖文本转图像、文本转语音和文本转视频等扩展能力。现阶段通常能做到根据文本需求生成对应的多模态结果，但它更偏向“根据描述生成内容”，不是完整的视频编辑器或图片设计台。如果你希望把某一类生成规则固定下来，例如固定比例、时长、风格或提示词结构，也可以建立一个专用助手，我可以先帮你预填一版草稿。`
    }
  }
]

function normalizeText(text) {
  return String(text || '').trim()
}

function pickRandom(items) {
  if (!Array.isArray(items) || items.length === 0) return ''
  return items[Math.floor(Math.random() * items.length)] || ''
}

function appendAssistantCreationHint(text = '') {
  const base = normalizeText(text)
  const hint = pickRandom(ASSISTANT_CREATION_HINT_VARIANTS)
  if (!base) return hint
  return `${base}${/[。！？!?]$/.test(base) ? '' : '。'}${hint}`
}

function isExecutionLikeRequest(text) {
  return EXECUTION_REQUEST_PATTERNS.some(pattern => pattern.test(text))
}

function isCapabilityQuestion(text) {
  return CAPABILITY_QUESTION_PATTERNS.some(pattern => pattern.test(text))
}

function buildGenericAssistantDraft(text) {
  const normalized = normalizeText(text)
  return {
    name: '自定义流程助手',
    description: '用于处理当前需求的自定义智能助手',
    modelType: 'chat',
    inputSource: /全文|整篇|整个文档/.test(normalized) ? 'document' : 'selection-preferred',
    documentAction: /批注/.test(normalized) ? 'comment' : /替换|直接改|覆盖原文/.test(normalized) ? 'replace' : 'insert',
    outputFormat: /json|结构化/.test(normalized.toLowerCase()) ? 'json' : 'markdown',
    systemPrompt: '你是一位专业智能助手，请根据用户输入完成任务，并尽量输出结构清晰、可直接使用的结果。',
    userPromptTemplate: `请处理以下需求：${normalized}\n\n输入内容：\n---\n{{input}}\n---`
  }
}

function buildGenericCapabilityAnswer(text) {
  return `这类需求不一定都对应现成的单一按钮，但多数情况下可以通过现有能力组合，或者通过创建自定义助手来实现。当前项目已经支持文档处理、摘要、翻译、改写、审查、报告生成、文档写回以及多种扩展助手能力。如果你想把“${normalizeText(text)}”固定成一套可复用流程，我可以帮你打开创建智能助手页面，并预填名称、输入范围、写回方式和提示词模板。`
}

function createSuggestedAction(rule, draft) {
  return {
    type: 'open-prefill-assistant',
    label: '去创建助手',
    viewLabel: Array.isArray(rule?.existingAssistantHints) && rule.existingAssistantHints.length > 0 ? '查看现有功能入口' : '查看助手列表',
    dismissLabel: '暂不需要',
    targetItemKey: 'create-custom-assistant',
    prefillDraft: draft
  }
}

export function resolveAssistantCapabilityFaq(text = '') {
  const raw = normalizeText(text)
  if (!raw) return null
  if (!isCapabilityQuestion(raw)) return null
  if (isExecutionLikeRequest(raw) && !/(能不能|能否|可不可以|是否支持|支不支持|怎么配置|如何配置|怎么设置|如何设置|怎么建立|如何建立)/.test(raw)) {
    return null
  }

  const matchedRule = CAPABILITY_RULES.find(rule => rule.patterns.some(pattern => pattern.test(raw)))
  const supportLevel = matchedRule?.supportLevel || 'assistant-buildable'
  const capabilityCategory = matchedRule?.capabilityCategory || 'custom-assistant'
  const existingAssistantHints = typeof matchedRule?.existingAssistantHints === 'function'
    ? matchedRule.existingAssistantHints(raw)
    : Array.isArray(matchedRule?.existingAssistantHints) ? matchedRule.existingAssistantHints.slice() : []
  const prefillDraft = matchedRule?.buildPrefillDraft ? matchedRule.buildPrefillDraft(raw) : buildGenericAssistantDraft(raw)
  const textAnswer = appendAssistantCreationHint(
    matchedRule?.buildAnswer ? matchedRule.buildAnswer(raw) : buildGenericCapabilityAnswer(raw)
  )

  return {
    type: 'capability-guidance',
    title: '能力说明',
    detail: '本次将直接返回本程序的能力说明，并可继续预填创建助手，不再请求大模型。',
    reason: '已识别为“能不能做XX / 如何实现XX”类能力问答，直接返回本地能力说明。',
    text: textAnswer,
    supportLevel,
    capabilityCategory,
    existingAssistantHints,
    prefillDraft,
    suggestedAction: createSuggestedAction(matchedRule, prefillDraft)
  }
}
