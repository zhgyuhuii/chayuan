/**
 * 结构化分批任务中「仅锚点批注」策略的单一配置源：
 * - 凡文档动作为批注 / 链接批注且助手非「修订类」(revision-edits)，均只通过 text-anchor / 坐标等 operations 落点；
 * - 禁止全文或大块分块兜底批注、禁止把 plan 统计 JSON 当批注正文。
 * 涉密关键词、保密检查等在 getStructuredJsonAnchorExtraRules 中有额外字段要求；其他助手依赖通用批注锚点说明。
 */

export const ANALYSIS_SECRET_KEYWORD_EXTRACT_ID = 'analysis.secret-keyword-extract'
export const ANALYSIS_SECURITY_CHECK_ID = 'analysis.security-check'
/** AI 痕迹检查：与保密检查共用「命中片段」Markdown 抽取规则，便于结构化批注锚点 */
export const ANALYSIS_AI_TRACE_CHECK_ID = 'analysis.ai-trace-check'

/** 文档动作为批注类（与 revision-edits 模式组合由调用方判断） */
export function isAnchoredCommentDocumentAction(documentAction) {
  const a = String(documentAction || '').trim()
  return a === 'comment' || a === 'link-comment'
}

/**
 * 从保密检查 Markdown（通常在 JSON 的 summary/content 中）提取「命中片段」原文。
 */
export function extractHitFragmentsFromSecurityCheckMarkdown(markdown) {
  const text = String(markdown || '')
  const out = []
  const seen = new Set()
  const add = (raw) => {
    let t = String(raw || '').trim()
    t = t.replace(/^[`「'"“]+|[`」'"”]+$/g, '').replace(/\*\*/g, '').trim()
    if (t.length < 2 || seen.has(t)) return
    if (/^(无|暂无|未发现|没有|不适用)\s*$/u.test(t)) return
    seen.add(t)
    out.push(t)
  }
  let m
  // 模型常见变体：- **命中片段：** `原文`（加粗标签 + 中英文冒号 + 反引号）
  const reBacktickPatterns = [
    /\*\*命中片段[：:]\*\*\s*`([^`\n]+)`/g,
    /[-*]\s*\*\*命中片段[：:]\*\*\s*`([^`\n]+)`/g,
    /[-*]\s*\*{1,2}\s*命中片段\s*\*{1,2}\s*[：:]\s*`([^`\n]+)`/g,
    /命中片段\s*\*{0,2}\s*[：:]\s*\*{0,2}\s*`([^`\n]+)`/g
  ]
  for (const reBacktick of reBacktickPatterns) {
    while ((m = reBacktick.exec(text)) !== null) add(m[1])
  }
  const reLinePatterns = [
    /[-*]\s*\*\*命中片段[：:]\*\*\s*(?!`)([^\n]+)/g,
    /[-*]\s*命中片段[：:]\s*(?!`)([^\n]+)/g
  ]
  for (const reLine of reLinePatterns) {
    while ((m = reLine.exec(text)) !== null) add(m[1])
  }
  return out
}

function resolveExecutionPlanBatchPayload(batch) {
  const root = batch?.response?.parsed
  if (!root || typeof root !== 'object') return null
  const inner = root.parsed && typeof root.parsed === 'object' ? root.parsed : null
  return inner || root
}

export function collectSecretKeywordTermsFromPlan(executionPlan) {
  const batches = Array.isArray(executionPlan?.batches) ? executionPlan.batches : []
  const seen = new Set()
  const out = []
  batches.forEach((batch) => {
    const payload = resolveExecutionPlanBatchPayload(batch)
    const kws = Array.isArray(payload?.keywords) ? payload.keywords : []
    kws.forEach((kw) => {
      const term = String(kw?.term ?? kw?.text ?? '').trim()
      if (!term || seen.has(term)) return
      seen.add(term)
      out.push(term)
    })
  })
  return out
}

export function collectSecurityCheckHitFragmentsFromPlan(executionPlan) {
  const batches = Array.isArray(executionPlan?.batches) ? executionPlan.batches : []
  const seen = new Set()
  const out = []
  batches.forEach((batch) => {
    const payload = resolveExecutionPlanBatchPayload(batch)
    if (!payload) return
    const md = [payload.summary, payload.content, payload.analysis]
      .map(s => String(s || '').trim())
      .filter(Boolean)
      .join('\n')
    extractHitFragmentsFromSecurityCheckMarkdown(md).forEach((frag) => {
      if (!seen.has(frag)) {
        seen.add(frag)
        out.push(frag)
      }
    })
  })
  return out
}

/** 从各批次的 summary/content 聚合「命中片段」（与保密检查同一格式） */
export function collectAiTraceHitFragmentsFromPlan(executionPlan) {
  return collectSecurityCheckHitFragmentsFromPlan(executionPlan)
}

/** applyStructuredExecutionPlan 末尾：批注类结构化计划禁止全文兜底批注 */
export function buildAnchorOnlyStructuredCommentSkipApplyResult() {
  return {
    ok: true,
    action: 'none',
    message:
      '未能将批注锚定到原文（operations 中 originalText 或关键词 term 须与正文逐字一致），已跳过全文单条批注。请查看任务清单对照修改后重试。',
    writeTargets: [],
    protectionMode: 'anchor-only-structured-comment-skip',
    protectionApplied: true
  }
}

/** 追加到结构化 JSON 系统说明中的、按助手与文档动作区分的锚点规则 */
export function getStructuredJsonAnchorExtraRules(assistantId, documentAction = '') {
  const id = String(assistantId || '').trim()
  const act = String(documentAction || '').trim()
  const parts = []
  if (id === ANALYSIS_SECURITY_CHECK_ID) {
    parts.push([
      '保密检查：须将完整审查结论写入 JSON 的 summary 字段；summary 内仍使用模板要求的 Markdown 小节（## 高风险项 等）。',
      '每条风险项必须包含「命中片段」且反引号内为 ChunkText 中的连续原文（逐字照抄）；推荐格式：- **命中片段：** `原文片段`（加粗与否均可，反引号内必须与正文一致）；operations 可留空 []。'
    ].join('\n'))
  }
  if (id === ANALYSIS_AI_TRACE_CHECK_ID) {
    parts.push([
      'AI 痕迹检查：须将本分段的审查结论写入 JSON 的 summary 字段；summary 内使用模板要求的 Markdown 小节（## 高疑似项 等）。',
      '每条疑似项必须包含「命中片段」，且反引号内为 ChunkText 中的连续原文（逐字照抄）；推荐格式：- **命中片段：** `原文片段`；operations 可留空 []，由系统从 summary 合成锚点批注。'
    ].join('\n'))
  }
  if (id === ANALYSIS_SECRET_KEYWORD_EXTRACT_ID) {
    parts.push([
      '涉密关键词：必须输出 keywords 数组；每个 term 必须是当前 ChunkText 中可直接搜索到的连续原文子串，不得改写或概括。',
      '若本段出现部队番号、单位全称、联系人、电话、项目/系统名、内部编号等确需脱密实体，必须列入 keywords，不得以「示例」「技术文档」「疑似虚构」为由整段留空；',
      '仅当本段确实无可脱密实体时返回 "keywords":[]。'
    ].join('\n'))
  }
  if (act === 'comment' || act === 'link-comment') {
    parts.push([
      '当前文档动作为批注或链接批注：禁止仅靠 summary/content 覆盖整段或整篇；每条需落点的意见必须通过 operations 中的 comment（配合 text-anchor 等）锚定到 ChunkText 中的具体原文，originalText 须逐字照抄。',
      '不要把统计类 JSON、任务概览或泛泛总结当作批注正文；批注文案应简短，并与锚点原文一一对应。'
    ].join('\n'))
  }
  return parts.filter(Boolean).join('\n\n')
}
