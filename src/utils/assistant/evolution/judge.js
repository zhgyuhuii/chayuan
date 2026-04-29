/**
 * judge - LLM 双裁判 + rubric 5 项细则评分
 *
 * 解决"同源裁判 self-preference bias":候选模型自评会平均高 8-15 分(MT-Bench 论文)。
 *
 * 设计:
 *   1. pickJudges: 从用户已配置的模型里选 1-2 个与候选**不同家族**的裁判
 *   2. rubric prompt: 把"哪个更好"拆成 5 项 0-5 分细则
 *   3. 双裁判仲裁:总分差 > 8 标记 disagreement,不一致样本入人工复核队列
 *   4. 结果归一化为 0-100,可直接传入 raceEvaluator 的 judgeScore
 */

import { chatCompletion } from '../../chatApi.js'
import { getFlatModelsFromSettings } from '../../modelSettings.js'
import { withJsonObject } from '../../chatApiEnhancers.js'

function safeString(value, fallback = '') {
  const s = String(value ?? '').trim()
  return s || fallback
}

function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * 推断模型家族,用于"换家族"裁判选择。
 */
export function inferModelFamily(model) {
  const id = String(model?.providerId || model?.id || '').toLowerCase()
  const name = String(model?.modelId || model?.name || '').toLowerCase()
  if (/(openai|gpt|o1|o3|o4)/.test(id) || /^(gpt|o1|o3|o4)/.test(name)) return 'openai'
  if (/(anthropic|claude)/.test(id) || /^claude/.test(name)) return 'anthropic'
  if (/(gemini|google)/.test(id) || /^gemini/.test(name)) return 'google'
  if (/(deepseek)/.test(id) || /^deepseek/.test(name)) return 'deepseek'
  if (/(qwen|tongyi)/.test(id) || /^qwen/.test(name)) return 'qwen'
  if (/(zhipu|glm)/.test(id) || /^glm/.test(name)) return 'zhipu'
  if (/(moonshot|kimi)/.test(id) || /^moonshot|kimi/.test(name)) return 'moonshot'
  if (/(doubao|volc)/.test(id) || /^doubao/.test(name)) return 'doubao'
  if (/(ollama|local|lm-studio|xinference|fastchat|new-api|oneapi)/.test(id)) return 'local'
  return 'unknown'
}

/**
 * 选 1-2 个与候选模型不同家族的裁判模型。
 *
 *   options:
 *     candidateModel:    被评候选用的模型(必填)
 *     wantTwo:           是否要双裁判(默认 false,关键样本时设 true)
 *     allowSameFamily:   兜底(找不到不同家族时是否退回同家族),默认 true
 */
export function pickJudges(options = {}) {
  const candidate = options.candidateModel
  const candFamily = inferModelFamily(candidate)
  const all = (getFlatModelsFromSettings('chat') || []).filter(m => m && m.providerId && m.modelId)
  if (all.length === 0) return []

  const differentFamily = all.filter(m => inferModelFamily(m) !== candFamily)

  const out = []
  const used = new Set()
  for (const m of differentFamily) {
    const fam = inferModelFamily(m)
    if (used.has(fam)) continue
    out.push(m)
    used.add(fam)
    if (out.length >= (options.wantTwo ? 2 : 1)) break
  }

  if (out.length === 0 && options.allowSameFamily !== false) {
    return [all[0]]
  }
  return out
}

/**
 * Rubric 评分 prompt(中文 5 项细则)。
 */
const RUBRIC_PROMPT = [
  '你将看到任务输入 INPUT、参考输出 BASELINE、候选输出 CANDIDATE。',
  '',
  '请按下表对 CANDIDATE 与 BASELINE 各自打分(每项 0-5,允许半分):',
  '1. 核心需求满足度 — 是否解决了 INPUT 的核心需求?',
  '2. 事实可信度 — 是否新增了原文不存在的事实?(0=严重幻觉,5=完全无幻觉)',
  '3. 关键信息保留 — 是否保留了原文的术语 / 数据 / 编号 / 称谓?',
  '4. 输出格式 — 是否符合 expectedOutputFormat / outputSchema?',
  '5. 中文表达 — 中文是否专业、连贯、无翻译腔?',
  '',
  '最后判定 winner ∈ {candidate, baseline, tie}。',
  '',
  '只输出合法 JSON,不要任何解释。结构:',
  '{',
  '  "candidate": [c1, c2, c3, c4, c5],',
  '  "baseline":  [b1, b2, b3, b4, b5],',
  '  "winner":    "candidate|baseline|tie",',
  '  "reason":    "<= 80 字简述"',
  '}'
].join('\n')

/**
 * 单裁判打分。
 *
 *   options:
 *     judgeModel:  必填
 *     input:       INPUT 文本
 *     baseline:    BASELINE 输出
 *     candidate:   CANDIDATE 输出
 *     expected:    可选,期望格式描述
 */
export async function judgeOnce(options = {}) {
  const judge = options.judgeModel
  if (!judge?.providerId || !judge?.modelId) {
    throw new Error('judge: missing judgeModel')
  }
  const messages = [
    { role: 'system', content: '你是公平的评测裁判。只输出合法 JSON,不要解释。' },
    {
      role: 'user',
      content: [
        RUBRIC_PROMPT,
        '',
        '【INPUT】',
        safeString(options.input),
        '',
        '【BASELINE】',
        safeString(options.baseline),
        '',
        '【CANDIDATE】',
        safeString(options.candidate),
        options.expected ? `\n【期望格式】\n${options.expected}` : ''
      ].filter(Boolean).join('\n')
    }
  ]

  const startedAt = Date.now()
  try {
    const extra = withJsonObject({ temperature: 0.1, max_tokens: 600 })
    const raw = await chatCompletion({
      providerId: judge.providerId,
      modelId: judge.modelId,
      messages,
      ...extra
    })
    const parsed = parseJsonCandidate(raw)
    if (!parsed) {
      return { ok: false, error: '裁判返回不可解析的 JSON', raw, durationMs: Date.now() - startedAt }
    }
    const cs = (parsed.candidate || []).map(n => clampScore(n))
    const bs = (parsed.baseline || []).map(n => clampScore(n))
    return {
      ok: true,
      judgeFamily: inferModelFamily(judge),
      candidateScore: cs.reduce((a, b) => a + b, 0),
      baselineScore: bs.reduce((a, b) => a + b, 0),
      candidateRubric: cs,
      baselineRubric: bs,
      winner: ['candidate', 'baseline', 'tie'].includes(parsed.winner) ? parsed.winner : 'tie',
      reason: safeString(parsed.reason).slice(0, 200),
      raw,
      durationMs: Date.now() - startedAt
    }
  } catch (e) {
    return { ok: false, error: e?.message || String(e), durationMs: Date.now() - startedAt }
  }
}

function parseJsonCandidate(raw) {
  const text = String(raw || '').trim()
  if (!text) return null
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = block?.[1] ? block[1].trim() : text
  try { return JSON.parse(candidate) } catch (_) {}
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try { return JSON.parse(candidate.slice(start, end + 1)) } catch (_) {}
  }
  return null
}

function clampScore(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(5, n))
}

/**
 * 主入口:双裁判仲裁。
 *
 *   options:
 *     judges:      显式指定裁判(可选);不传走 pickJudges
 *     candidateModel: 候选用的模型,用于自动 pickJudges
 *     critical:    true 时强制用 2 个裁判,否则单裁判
 *     input/baseline/candidate/expected: 同 judgeOnce
 *
 *   返回:
 *     {
 *       judgeCount, results[], normalizedScore (0-100), winner, disagreement
 *     }
 */
export async function arbitrate(options = {}) {
  let judges = Array.isArray(options.judges) ? options.judges : null
  if (!judges?.length) {
    judges = pickJudges({
      candidateModel: options.candidateModel,
      wantTwo: options.critical === true
    })
  }
  if (!judges.length) {
    return { judgeCount: 0, results: [], normalizedScore: -1, winner: 'inconclusive', disagreement: false }
  }

  const results = await Promise.all(
    judges.map(j => judgeOnce({
      judgeModel: j,
      input: options.input,
      baseline: options.baseline,
      candidate: options.candidate,
      expected: options.expected
    }))
  )
  const ok = results.filter(r => r.ok)
  if (ok.length === 0) {
    return { judgeCount: results.length, results, normalizedScore: -1, winner: 'inconclusive', disagreement: false }
  }

  const avgCand = ok.reduce((s, r) => s + r.candidateScore, 0) / ok.length
  const avgBase = ok.reduce((s, r) => s + r.baselineScore, 0) / ok.length

  const winners = ok.map(r => r.winner)
  let winner = winners[0]
  if (ok.length >= 2 && winners[0] !== winners[1]) winner = 'tie'

  // 总分差(0-25 max,5 项 × 5 分)
  const totalDiff = Math.abs(
    ok.reduce((s, r) => s + r.candidateScore - r.baselineScore, 0) / ok.length
  )
  const disagreement = ok.length >= 2 &&
    Math.abs(ok[0].candidateScore - ok[1].candidateScore) > 8

  // 归一化候选总分到 0-100(候选满分 25)
  const normalizedScore = Math.round((avgCand / 25) * 100)

  return {
    judgeCount: ok.length,
    results,
    avgCandidateScore: avgCand,
    avgBaselineScore: avgBase,
    totalDiff,
    normalizedScore,
    winner,
    disagreement
  }
}

export default {
  inferModelFamily,
  pickJudges,
  judgeOnce,
  arbitrate
}
