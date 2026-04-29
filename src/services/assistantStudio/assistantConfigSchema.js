const VALID_INPUT_SOURCES = new Set(['selection-preferred', 'selection-only', 'document'])
const VALID_OUTPUT_FORMATS = new Set(['plain', 'markdown', 'bullet-list', 'json'])
const VALID_DOCUMENT_ACTIONS = new Set(['replace', 'insert', 'insert-after', 'prepend', 'comment', 'link-comment', 'comment-replace', 'append', 'none'])

function cleanString(value = '', fallback = '') {
  const text = String(value || '').trim()
  return text || fallback
}

export function normalizeAssistantConfig(config = {}, options = {}) {
  const fallbackName = cleanString(options.fallbackName, '智能助手')
  const name = cleanString(config.name, fallbackName)
  return {
    ...config,
    name,
    description: cleanString(config.description),
    persona: cleanString(config.persona),
    systemPrompt: cleanString(config.systemPrompt, '你是一位专业智能助手，请根据用户输入完成任务。'),
    userPromptTemplate: cleanString(config.userPromptTemplate, '{{input}}'),
    inputSource: VALID_INPUT_SOURCES.has(config.inputSource) ? config.inputSource : 'selection-preferred',
    outputFormat: VALID_OUTPUT_FORMATS.has(config.outputFormat) ? config.outputFormat : 'markdown',
    documentAction: VALID_DOCUMENT_ACTIONS.has(config.documentAction) ? config.documentAction : 'insert',
    temperature: Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 0.3
  }
}

export function validateAssistantConfig(config = {}) {
  const normalized = normalizeAssistantConfig(config)
  const issues = []
  if (!cleanString(normalized.name) || normalized.name === '未命名助手') {
    issues.push({ field: 'name', code: 'invalid-name', message: '助手名称不能为空，也不能是“未命名助手”' })
  }
  if (!cleanString(normalized.systemPrompt)) {
    issues.push({ field: 'systemPrompt', code: 'missing-system-prompt', message: '系统提示词不能为空' })
  }
  if (!cleanString(normalized.userPromptTemplate) || !String(normalized.userPromptTemplate).includes('{{input}}')) {
    issues.push({ field: 'userPromptTemplate', code: 'missing-input-placeholder', message: '用户提示词模板必须包含 {{input}}' })
  }
  if (Number(normalized.temperature) < 0 || Number(normalized.temperature) > 2) {
    issues.push({ field: 'temperature', code: 'temperature-out-of-range', message: '温度建议在 0 到 2 之间' })
  }
  return {
    ok: issues.length === 0,
    issues,
    normalized
  }
}

export default {
  normalizeAssistantConfig,
  validateAssistantConfig
}
