import { INTENT_LANES, OUTPUT_MODES, RISK_LEVELS } from './schemas.js'

const HIGH_RISK_OUTPUTS = new Set([
  OUTPUT_MODES.REPLACE,
  OUTPUT_MODES.COMMENT_REPLACE
])

const MEDIUM_RISK_OUTPUTS = new Set([
  OUTPUT_MODES.INSERT,
  OUTPUT_MODES.APPEND,
  OUTPUT_MODES.PREPEND,
  OUTPUT_MODES.INSERT_AFTER,
  OUTPUT_MODES.ADD_COMMENT,
  OUTPUT_MODES.FORMAT
])

export function evaluateIntentRisk(plan = {}) {
  const outputMode = String(plan.output?.mode || '').trim()
  const lane = String(plan.lane || '').trim()
  const scopeKind = String(plan.scope?.kind || '').trim()
  const actionName = String(plan.action?.name || '').trim()

  let risk = RISK_LEVELS.LOW
  if (HIGH_RISK_OUTPUTS.has(outputMode) || /(delete|remove|replace|declassify)/i.test(actionName)) {
    risk = RISK_LEVELS.HIGH
  } else if (MEDIUM_RISK_OUTPUTS.has(outputMode)) {
    risk = RISK_LEVELS.MEDIUM
  }

  if (lane === INTENT_LANES.DOCUMENT_REVIEW && outputMode === OUTPUT_MODES.ADD_COMMENT) {
    risk = RISK_LEVELS.HIGH
  }
  if (scopeKind === 'document' && risk === RISK_LEVELS.MEDIUM) {
    risk = RISK_LEVELS.HIGH
  }

  const needsConfirmation = risk === RISK_LEVELS.HIGH ||
    outputMode !== OUTPUT_MODES.REPLY && outputMode !== OUTPUT_MODES.REPORT

  return {
    risk,
    needsConfirmation
  }
}

export function buildClarification(plan = {}) {
  if (plan.scope?.required && !plan.scope?.available) {
    if (plan.scope?.requested === 'selection') return '当前没有检测到有效选区。请先选中文本，或说明是否改为处理全文。'
    if (plan.scope?.requested === 'document') return '当前没有检测到可用正文。请打开文档或说明是否只按本次输入处理。'
    return '当前缺少执行该文档任务所需的文本范围，请补充处理范围。'
  }
  if (plan.confidence < 0.45 && plan.output?.mode !== OUTPUT_MODES.REPLY) {
    return '我不确定你想直接修改文档还是只生成建议，请说明输出方式。'
  }
  return ''
}

export default {
  evaluateIntentRisk,
  buildClarification
}
