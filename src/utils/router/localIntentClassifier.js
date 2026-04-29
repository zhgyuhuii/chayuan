/**
 * localIntentClassifier - 本地意图分类器(零 LLM 调用)
 *
 * 用规则正则 + 关键词词袋打分,在 < 1ms 内判断用户输入意图。
 * 命中阈值 >= 0.85 时直接采用,跳过 LLM 路由(节省 1.5–3 秒)。
 *
 * 5 类意图(与 AIAssistantDialog.resolvePrimaryConversationIntent 对齐):
 *   - chat                普通问答 / 闲聊 / 写作
 *   - document-operation  操作文档(改写/翻译/插入/批注/格式)
 *   - wps-capability      WPS 原生能力(保存/插表/字体/对齐)
 *   - generated-output    多模态生成 / 报告导出
 *   - assistant-task      明确点名某个助手
 *
 * 数据来源:基于 plan-v2 §11 的 47 个内置助手 + 28 项能力 + 实战常见短语提取词表。
 */

function safeString(value, fallback = '') {
  const s = String(value ?? '').trim()
  return s || fallback
}

const KIND_CHAT = 'chat'
const KIND_DOC_OP = 'document-operation'
const KIND_WPS = 'wps-capability'
const KIND_GEN = 'generated-output'
const KIND_ASST = 'assistant-task'

/**
 * 规则集 — 每条规则:
 *   pattern: RegExp(必)
 *   kind:    意图类型
 *   score:   0-100,命中加分
 *   subKind: 可选,具体子能力 / 助手 ID 提示
 */
const RULES = [
  // ---------- WPS 原生能力(高置信)----------
  { pattern: /(?:保存|另存为|保存到|导出到|存盘|存档).{0,12}(文档|文件)?/, kind: KIND_WPS, score: 90, subKind: 'save-document' },
  { pattern: /(?:加密|设置密码).{0,8}(?:文档|文件)/, kind: KIND_WPS, score: 90, subKind: 'encrypt-document' },
  { pattern: /(?:解密|去掉密码|移除密码|取消加密).{0,8}(?:文档|文件)/, kind: KIND_WPS, score: 90, subKind: 'decrypt-document' },
  { pattern: /(?:插入|新增|添加).{0,12}(表格)/, kind: KIND_WPS, score: 88, subKind: 'insert-table' },
  { pattern: /(?:插入|新增|添加).{0,8}(分页符|空白页)/, kind: KIND_WPS, score: 88, subKind: 'insert-page-break' },
  { pattern: /字体.{0,8}(改为|设为|换成)/, kind: KIND_WPS, score: 85, subKind: 'set-font-name' },
  { pattern: /(字号|字体大小).{0,8}(改为|设为|换成)|改成.{0,4}号字/, kind: KIND_WPS, score: 85, subKind: 'set-font-size' },
  { pattern: /(加粗|粗体)/, kind: KIND_WPS, score: 80, subKind: 'toggle-bold' },
  { pattern: /(斜体)/, kind: KIND_WPS, score: 80, subKind: 'toggle-italic' },
  { pattern: /(下划线)/, kind: KIND_WPS, score: 80, subKind: 'toggle-underline' },
  { pattern: /(左对齐|右对齐|居中对齐|两端对齐|靠左|靠右)/, kind: KIND_WPS, score: 82, subKind: 'set-alignment' },
  { pattern: /行距.{0,6}(改为|设为)|设置.{0,4}行距/, kind: KIND_WPS, score: 82, subKind: 'set-line-spacing' },

  // ---------- 文档操作(高置信)----------
  { pattern: /(?:改写|换种(?:方式|说法|表达)).{0,8}(这段|这一段|本段|当前段)?/, kind: KIND_DOC_OP, score: 86, subKind: 'analysis.rewrite' },
  { pattern: /扩写|展开.{0,6}(这段|本段|内容)/, kind: KIND_DOC_OP, score: 86, subKind: 'analysis.expand' },
  { pattern: /缩写|压缩|精简.{0,6}(这段|本段)/, kind: KIND_DOC_OP, score: 86, subKind: 'analysis.abbreviate' },
  { pattern: /翻译.{0,16}(成|为|到|译为).{0,16}(英文|中文|日文|韩文|法文|德文|西|俄)/, kind: KIND_DOC_OP, score: 90, subKind: 'translate' },
  { pattern: /翻译(这段|这句|本段|当前)/, kind: KIND_DOC_OP, score: 88, subKind: 'translate' },
  { pattern: /(?:摘要|总结|概括).{0,12}(全文|这段|本文档|这篇|这份)/, kind: KIND_DOC_OP, score: 88, subKind: 'summary' },
  { pattern: /(?:拼写|错别字|错字).{0,6}(检查|纠正|修正)/, kind: KIND_DOC_OP, score: 90, subKind: 'spell-check' },
  { pattern: /提取.{0,4}(关键词|关键字|主题词)/, kind: KIND_DOC_OP, score: 86, subKind: 'analysis.extract-keywords' },
  { pattern: /(润色|优化表达|改得?(更)?(流畅|通顺|专业))/, kind: KIND_DOC_OP, score: 84, subKind: 'analysis.polish' },
  { pattern: /(正式化|改得?更正式|公文化)/, kind: KIND_DOC_OP, score: 84, subKind: 'analysis.formalize' },
  { pattern: /(通俗化|通俗一点|说人话|科普)/, kind: KIND_DOC_OP, score: 84, subKind: 'analysis.simplify' },
  { pattern: /(?:替换|改成|修改成).{0,12}(这段|这一句|当前选中|选中的)/, kind: KIND_DOC_OP, score: 88, subKind: 'replace-selection-text' },

  // ---------- 安全保密 ----------
  { pattern: /(保密检查|涉密(检查|检测))/, kind: KIND_DOC_OP, score: 92, subKind: 'analysis.security-check' },
  { pattern: /(脱密|文档脱密|去标识化|脱敏处理|占位符替换)/, kind: KIND_DOC_OP, score: 92, subKind: 'document-declassify' },
  { pattern: /(密码复原|脱密复原|还原(原文|脱密)|恢复原文)/, kind: KIND_DOC_OP, score: 92, subKind: 'document-declassify-restore' },
  { pattern: /(涉密|敏感).{0,6}(关键词|词).{0,4}提取/, kind: KIND_DOC_OP, score: 90, subKind: 'analysis.secret-keyword-extract' },

  // ---------- 多模态生成 ----------
  { pattern: /(画一?张图|生成图片|文转图|文本转图像)/, kind: KIND_GEN, score: 92, subKind: 'text-to-image' },
  { pattern: /(语音播报|文转语音|文本转语音|生成音频|配音)/, kind: KIND_GEN, score: 92, subKind: 'text-to-audio' },
  { pattern: /(生成视频|文转视频|文本转视频|做(个|条)视频)/, kind: KIND_GEN, score: 92, subKind: 'text-to-video' },
  { pattern: /(导出|生成).{0,6}(报告|PDF|excel|word|docx|表格)/, kind: KIND_GEN, score: 80 },

  // ---------- 显式助手指令 ----------
  { pattern: /(?:用|调用|跑一下|执行|启动)\s*[「『"]?([^,。"」』]{2,20})[」』"]?\s*(?:助手|功能)/, kind: KIND_ASST, score: 88 },

  // ---------- 编审 ----------
  { pattern: /(批注解释|超链接解释|AI痕迹检查|段落.{0,4}序号.{0,4}检查)/, kind: KIND_DOC_OP, score: 86 },
  { pattern: /(文档审计|审计这份|审一遍)/, kind: KIND_DOC_OP, score: 86, subKind: 'analysis.form-field-audit' },
  { pattern: /(表单提取|抽取字段|表单智能提取)/, kind: KIND_DOC_OP, score: 86, subKind: 'analysis.form-field-extract' },

  // ---------- chat 兜底(常见对话特征,低分但用于反向)----------
  { pattern: /(?:你好|hi|hello|help|帮我想|聊聊|怎么(看|理解)|什么意思)/i, kind: KIND_CHAT, score: 70 },
  { pattern: /^(?:写|帮我写)(?:一?(首|篇|段|句))(?:诗|文章|故事|祝福|文案|吐槽)/, kind: KIND_CHAT, score: 80 }
]

/**
 * 关键词词袋(辅助 score),没出现也不扣分,只在 ambiguous 时增强:
 */
const KEYWORD_BOOST = {
  [KIND_DOC_OP]: ['这段', '本段', '当前段', '选中', '全文', '这一句', '原文', '正文', '段落', '文档'],
  [KIND_WPS]: ['插入', '替换', '复制', '粘贴', '保存', '加密', '字体', '字号', '对齐', '颜色', '行距'],
  [KIND_GEN]: ['图片', '语音', '视频', '导出', '生成', '下载'],
  [KIND_CHAT]: ['为什么', '怎么', '是什么', '能不能', '帮帮我', '请问', '建议']
}

function tokenize(text) {
  return Array.from(new Set(
    String(text || '')
      .toLowerCase()
      .match(/[一-龥a-z0-9]{1,}/g) || []
  ))
}

function bagBoost(text, kind) {
  const words = tokenize(text)
  const set = new Set(words)
  const dict = KEYWORD_BOOST[kind] || []
  let hits = 0
  for (const w of dict) if (set.has(w.toLowerCase())) hits++
  return Math.min(15, hits * 5)   // 最多加 15 分
}

/**
 * 主入口:返回最高分的意图。
 *
 *   options:
 *     hasSelection:  当前有选区,doc-op 类得分加成
 *     attachments:   有附件,gen 类得分加成
 *
 *   返回:
 *     {
 *       kind,
 *       confidence: 'high'|'medium'|'low',
 *       score: 0-100,
 *       subKind,
 *       reason,
 *       allCandidates: [...]
 *     }
 */
export function classifyIntent(text, options = {}) {
  const input = safeString(text)
  if (!input) {
    return { kind: KIND_CHAT, confidence: 'low', score: 0, subKind: '', reason: '空输入', allCandidates: [] }
  }

  const scored = []
  for (const rule of RULES) {
    if (rule.pattern.test(input)) {
      const boost = bagBoost(input, rule.kind)
      let s = rule.score + boost

      // 上下文加成
      if (options.hasSelection && rule.kind === KIND_DOC_OP) s += 5
      if (options.attachments && rule.kind === KIND_GEN) s += 6
      if (input.length > 60 && rule.kind === KIND_CHAT) s -= 6   // 长文 + chat 嫌疑降低

      scored.push({ ...rule, score: Math.max(0, Math.min(100, s)) })
    }
  }

  if (scored.length === 0) {
    return {
      kind: KIND_CHAT,
      confidence: 'low',
      score: 50,
      subKind: '',
      reason: '无规则命中,默认 chat',
      allCandidates: []
    }
  }

  scored.sort((a, b) => b.score - a.score)
  const top = scored[0]

  let confidence = 'low'
  if (top.score >= 90) confidence = 'high'
  else if (top.score >= 75) confidence = 'medium'

  return {
    kind: top.kind,
    confidence,
    score: top.score,
    subKind: top.subKind || '',
    reason: `命中规则 ${top.pattern.source.slice(0, 60)} (${top.score} 分)`,
    allCandidates: scored.slice(0, 5).map(r => ({
      kind: r.kind, score: r.score, subKind: r.subKind || ''
    }))
  }
}

/**
 * 是否高置信可跳过 LLM 路由:阈值 0.85(score >= 85)。
 */
export function isHighConfidence(result, threshold = 85) {
  return result && result.score >= threshold
}

export default {
  classifyIntent,
  isHighConfidence,
  KIND_CHAT, KIND_DOC_OP, KIND_WPS, KIND_GEN, KIND_ASST
}
