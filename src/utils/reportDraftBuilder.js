import { chatCompletion } from './chatApi.js'
import { getReportTypeLabel, REPORT_TYPE_OPTIONS } from './reportSettings.js'

function extractJsonCandidate(raw) {
  const text = String(raw || '').trim()
  if (!text) return ''
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (block?.[1]) return block[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1).trim()
  return text
}

function parseDraft(raw) {
  const candidate = extractJsonCandidate(raw)
  if (!candidate) throw new Error('模型未返回可解析的报告草稿')
  return JSON.parse(candidate)
}

function normalizeOutlineSections(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => {
      if (typeof item === 'string') {
        const text = item.trim()
        return text ? { title: text, points: [] } : null
      }
      if (!item || typeof item !== 'object') return null
      const title = String(item.title || item.name || '').trim()
      const points = Array.isArray(item.points)
        ? item.points.map(point => String(point || '').trim()).filter(Boolean)
        : []
      return title ? { title, points } : null
    })
    .filter(Boolean)
}

function normalizeDraft(parsed, fallback = {}) {
  return {
    reportName: String(parsed?.reportName || fallback.reportName || '').trim(),
    industry: String(parsed?.industry || fallback.industry || '').trim(),
    reportType: String(parsed?.reportType || fallback.reportType || '').trim(),
    outlineSections: normalizeOutlineSections(parsed?.outlineSections),
    writingGuidance: String(parsed?.writingGuidance || '').trim(),
    generationPrompt: String(parsed?.generationPrompt || '').trim()
  }
}

export async function buildReportDraftWithModel(options = {}) {
  const model = options.model || null
  if (!model?.providerId || !model?.modelId) {
    throw new Error('未找到可用模型，无法起草报告草稿')
  }
  const reportType = String(options.reportType || 'general-analysis-report').trim() || 'general-analysis-report'
  const reportTypeLabel = getReportTypeLabel(reportType, options.customReportType || '')
  const systemPrompt = [
    '你是一位报告起草助手，负责先生成“报告名称 + 大纲 + 写作口径”，供用户确认后再开始正式生成。',
    '你必须只输出合法 JSON，不要输出 Markdown、解释或多余文字。',
    '请确保大纲适合正式报告/总结文件，标题清晰，结构可直接编辑。',
    `可选报告类型包括：${REPORT_TYPE_OPTIONS.map(item => `${item.value}:${item.label}`).join(' | ')}`,
    'JSON 格式：{"reportName":"","industry":"","reportType":"","outlineSections":[{"title":"","points":["",""]}],"writingGuidance":"","generationPrompt":""}'
  ].join('\n')
  const userPrompt = [
    '请根据以下参数起草一份报告生成草稿。',
    '',
    `行业：${String(options.industry || '').trim() || '未指定'}`,
    `报告名称：${String(options.reportName || '').trim() || '未指定'}`,
    `报告类型：${reportTypeLabel}`,
    `输出格式：${String(options.outputFormat || 'md').trim() || 'md'}`,
    `处理范围：${String(options.scope || 'document').trim() || 'document'}`,
    options.presetPersona ? `推荐角色参考：${String(options.presetPersona).trim()}` : '',
    options.presetPrompt ? `推荐写作口径参考：${String(options.presetPrompt).trim()}` : '',
    '',
    '用户需求：',
    String(options.requirementText || '').trim() || '(空)',
    '',
    '请输出适合正式生成的草稿对象。'
  ].join('\n')
  const raw = await chatCompletion({
    providerId: model.providerId,
    modelId: model.modelId,
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  })
  const parsed = parseDraft(raw)
  return normalizeDraft(parsed, {
    reportName: options.reportName,
    industry: options.industry,
    reportType
  })
}
