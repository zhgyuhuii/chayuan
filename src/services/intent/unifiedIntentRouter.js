import { classifyIntent } from '../../utils/router/localIntentClassifier.js'
import { collectIntentContext } from './contextCollector.js'
import { inferActionDsl, inferLane } from './actionDsl.js'
import { evaluateIntentRisk, buildClarification } from './riskPolicy.js'
import { resolveIntentScope } from './scopeResolver.js'
import { createIntentPlan, normalizeConfidenceScore } from './schemas.js'

function normalizeRuleIntent(ruleIntent = {}) {
  const confidenceText = String(ruleIntent?.confidence || '').trim().toLowerCase()
  const score = confidenceText === 'high' ? 0.92 : confidenceText === 'medium' ? 0.72 : confidenceText === 'low' ? 0.45 : 0
  return {
    kind: String(ruleIntent?.kind || '').trim(),
    confidence: score,
    reason: String(ruleIntent?.reason || '').trim()
  }
}

function mergeConfidence(localIntent = {}, ruleIntent = {}) {
  const localScore = normalizeConfidenceScore(localIntent?.score, 0.5)
  const ruleScore = normalizeRuleIntent(ruleIntent).confidence
  return Math.max(localScore, ruleScore || 0)
}

function inferLaneConfidence(text = '', lane = '', context = {}) {
  const input = String(text || '').trim()
  if (!input) return 0
  if (lane === 'document_review' && /(审查|审核|审阅|校对|检查|合规|风险|问题)/.test(input)) return 0.86
  if (lane === 'knowledge_query' && (context.kbBinding?.enabled || /(知识库|资料库|制度库|数据库|库里)/.test(input))) return 0.86
  if (lane === 'assistant_call' && /(调用|执行|启动|跑一下).{0,32}(助手|智能体|功能)?/.test(input)) return 0.84
  return 0
}

export function buildUnifiedIntentPlan(text = '', options = {}) {
  const input = String(text || '').trim()
  const context = collectIntentContext(options)
  const localIntent = options.localIntent || classifyIntent(input, {
    hasSelection: context.hasSelection,
    attachments: context.attachments
  })
  const lane = inferLane(input, localIntent, context)
  const scope = resolveIntentScope(input, lane, context)
  const dsl = inferActionDsl(input, lane, context, localIntent)
  const basePlan = createIntentPlan({
    lane,
    intent: dsl.action.name,
    confidence: Math.max(
      mergeConfidence(localIntent, options.ruleIntent),
      inferLaneConfidence(input, lane, context)
    ),
    source: 'hybrid-local',
    scope,
    action: dsl.action,
    output: dsl.output,
    knowledge: {
      ...context.kbBinding,
      usage: context.kbBinding.enabled
        ? lane === 'document_review'
          ? 'grounded_review'
          : lane === 'knowledge_query'
            ? 'answer_query'
            : 'grounding'
        : 'none'
    },
    diagnostics: {
      reason: [
        localIntent?.reason,
        normalizeRuleIntent(options.ruleIntent).reason,
        scope.reason
      ].filter(Boolean).join(' '),
      candidates: Array.isArray(localIntent?.allCandidates) ? localIntent.allCandidates : [],
      matchedRules: [
        localIntent?.subKind ? `local:${localIntent.subKind}` : '',
        options.ruleIntent?.kind ? `rule:${options.ruleIntent.kind}` : ''
      ].filter(Boolean)
    }
  })

  const risk = evaluateIntentRisk(basePlan)
  const planWithRisk = createIntentPlan({
    ...basePlan,
    risk: risk.risk,
    needsConfirmation: risk.needsConfirmation
  })
  const clarifyQuestion = buildClarification(planWithRisk)
  return createIntentPlan({
    ...planWithRisk,
    clarifyQuestion,
    diagnostics: {
      ...planWithRisk.diagnostics,
      reason: [
        planWithRisk.diagnostics?.reason,
        clarifyQuestion ? `需要澄清：${clarifyQuestion}` : ''
      ].filter(Boolean).join(' ')
    }
  })
}

export default {
  buildUnifiedIntentPlan
}
