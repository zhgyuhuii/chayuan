import { chatCompletion } from './chatApi.js'

function normalizeString(value, fallback = '') {
  const normalized = String(value || '').trim()
  return normalized || fallback
}

function parseJsonCandidate(raw) {
  const text = String(raw || '').trim()
  if (!text) return null
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = block?.[1] ? block[1].trim() : text
  const tryParse = (value) => {
    try {
      return JSON.parse(value)
    } catch (_) {
      return null
    }
  }
  const direct = tryParse(candidate)
  if (direct) return direct
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return tryParse(candidate.slice(start, end + 1))
  }
  return null
}

export function buildAssistantRepairPrompt(assistant = {}, evidence = {}) {
  return [
    '你是一名“助手修复工程师”，负责基于失败证据修复一个已有助手。',
    '请优先说明问题根因，再给出修复后的配置建议和差异摘要。',
    '',
    '【当前助手】',
    JSON.stringify({
      name: assistant?.name,
      description: assistant?.description,
      persona: assistant?.persona,
      systemPrompt: assistant?.systemPrompt,
      userPromptTemplate: assistant?.userPromptTemplate,
      modelType: assistant?.modelType,
      outputFormat: assistant?.outputFormat,
      documentAction: assistant?.documentAction,
      inputSource: assistant?.inputSource,
      reportSettings: assistant?.reportSettings,
      mediaOptions: assistant?.mediaOptions
    }, null, 2),
    '',
    '【失败证据】',
    JSON.stringify(evidence || {}, null, 2),
    '',
    '【输出格式】',
    '{"rootCause":"","repairReason":"","diffSummary":[],"candidate":{"description":"","persona":"","systemPrompt":"","userPromptTemplate":"","outputFormat":"","documentAction":"","inputSource":"","targetLanguage":"","reportSettings":{},"mediaOptions":{}}}'
  ].join('\n')
}

export async function buildAssistantRepairDraft({ assistant, evidence, model }) {
  if (!model?.providerId || !model?.modelId) {
    throw new Error('当前没有可用模型，无法生成修复草案')
  }
  const raw = await chatCompletion({
    providerId: model.providerId,
    modelId: model.modelId,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: '你是助手修复工程师。只输出合法 JSON，不要输出 Markdown、解释或额外说明。'
      },
      {
        role: 'user',
        content: buildAssistantRepairPrompt(assistant, evidence)
      }
    ]
  })
  const parsed = parseJsonCandidate(raw)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('模型未返回可解析的修复草案')
  }
  return {
    rootCause: normalizeString(parsed?.rootCause),
    repairReason: normalizeString(parsed?.repairReason),
    diffSummary: Array.isArray(parsed?.diffSummary) ? parsed.diffSummary.map(item => normalizeString(item)).filter(Boolean) : [],
    candidate: parsed?.candidate && typeof parsed.candidate === 'object' ? parsed.candidate : {}
  }
}
